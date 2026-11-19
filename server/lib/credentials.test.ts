import assert from 'node:assert/strict';
import { test } from 'node:test';

import bcrypt from 'bcryptjs';

import { LoginLimiter, convertEnv, hashPassword, loadAccounts, validateNewPassword, verifyAccount } from './credentials.js';

const PW = 'correct horse battery';
const hashP = hashPassword(PW);

test('hashes at bcrypt cost 12', async () => {
  assert.match(await hashP, /^\$2[aby]\$12\$/);
});

test('hashed accounts log in with the right password only', async () => {
  const h = await hashP;
  const { accounts, errors, cleartextUsers } = loadAccounts({
    ADMIN_USER: 'admin',
    ADMIN_PASS_HASH: h,
    USERS: `op1:${h}:operator`,
  });
  assert.deepEqual(errors, []);
  assert.deepEqual(cleartextUsers, []);
  assert.equal((await verifyAccount(accounts, 'admin', PW))?.role, 'admin');
  assert.equal((await verifyAccount(accounts, 'op1', PW))?.role, 'operator');
  assert.equal(await verifyAccount(accounts, 'admin', 'wrong password!'), null);
  assert.equal(await verifyAccount(accounts, 'nobody', PW), null);
  assert.equal(await verifyAccount(accounts, 'admin', h), null);
  assert.equal(await verifyAccount(accounts, ['admin'], PW), null);
});

test('no default account: admin/admin and empty config never log in', async () => {
  const { accounts } = loadAccounts({});
  assert.deepEqual(accounts, []);
  assert.equal(await verifyAccount(accounts, 'admin', 'admin'), null);
  assert.equal(loadAccounts({ ADMIN_USER: 'admin' }).accounts.length, 0);
});

test('rejects weak or malformed hashes and ambiguous admin config', async () => {
  const weak = await bcrypt.hash(PW, 10);
  assert.equal(loadAccounts({ ADMIN_USER: 'admin', ADMIN_PASS_HASH: weak }).accounts.length, 0);
  assert.equal(loadAccounts({ ADMIN_USER: 'admin', ADMIN_PASS_HASH: 'sha:abc' }).accounts.length, 0);
  assert.equal(loadAccounts({ ADMIN_USER: 'admin', ADMIN_PASS_HASH: await hashP, ADMIN_PASS: PW }).accounts.length, 0);
  assert.equal(loadAccounts({ USERS: `x:${await hashP}:superuser` }).accounts.length, 0);
});

test('legacy cleartext still verifies during the transition and is reported', async () => {
  const loaded = loadAccounts({ ADMIN_USER: 'admin', ADMIN_PASS: PW, USERS: 'op1:op-pass-123456:operator' });
  assert.deepEqual(loaded.cleartextUsers, ['op1', 'admin']);
  assert.equal((await verifyAccount(loaded.accounts, 'admin', PW))?.username, 'admin');
  assert.equal(await verifyAccount(loaded.accounts, 'admin', `${PW}!`), null);
});

test('login limiter blocks a username after 10 failures and resets after the window', () => {
  let now = 0;
  const limiter = new LoginLimiter(10, () => now);
  for (let i = 0; i < 10; i++) limiter.recordFailure('Admin');
  assert.equal(limiter.isBlocked('admin'), true);
  assert.equal(limiter.isBlocked('op1'), false);
  now += 10 * 60 * 1000;
  assert.equal(limiter.isBlocked('admin'), false);
});

test('validates new password length', () => {
  assert.match(validateNewPassword('short') ?? '', /at least/);
  assert.match(validateNewPassword('x'.repeat(73)) ?? '', /at most/);
  assert.equal(validateNewPassword('long enough password'), undefined);
});

test('env converter hashes ADMIN_PASS and cleartext USERS entries in place', async () => {
  const keep = await hashP;
  const env = `A=1\nADMIN_USER=admin\nADMIN_PASS=${PW}\nUSERS=op1:op-pass-123456:operator,op2:${keep}:admin\nZ=2\n`;
  const out = await convertEnv(env);
  assert.deepEqual(out.converted, ['admin', 'op1']);
  assert.ok(!out.content.includes(PW));
  assert.ok(!out.content.includes('op-pass-123456'));
  assert.ok(out.content.includes(`op2:${keep}:admin`));
  assert.match(out.content, /^A=1\nADMIN_USER=admin\nADMIN_PASS_HASH='\$2[aby]\$12\$.{53}'\nUSERS='op1:\$2[aby]\$12\$.{53}:operator,op2:/);
  const parsed = loadAccounts({
    ADMIN_USER: 'admin',
    ADMIN_PASS_HASH: /ADMIN_PASS_HASH='(.*)'/.exec(out.content)![1],
    USERS: /USERS='(.*)'/.exec(out.content)![1],
  });
  assert.deepEqual(parsed.cleartextUsers, []);
  assert.ok(await verifyAccount(parsed.accounts, 'admin', PW));
  assert.ok(await verifyAccount(parsed.accounts, 'op1', 'op-pass-123456'));
});

test('env converter is a no-op once converted and refuses ambiguous files', async () => {
  const done = `ADMIN_USER=admin\nADMIN_PASS_HASH='${await hashP}'\n`;
  assert.equal((await convertEnv(done)).content, done);
  await assert.rejects(convertEnv('ADMIN_USER=a\nADMIN_PASS=a\nADMIN_PASS=b\n'), /2 times/);
  await assert.rejects(convertEnv('ADMIN_PASS=a\n'), /without ADMIN_USER/);
});

test('rejects out-of-range bcrypt costs', () => {
  const fake = (cost: string) => `$2b$${cost}$${'a'.repeat(53)}`;
  assert.equal(loadAccounts({ ADMIN_USER: 'admin', ADMIN_PASS_HASH: fake('31') }).accounts.length, 0);
  assert.equal(loadAccounts({ USERS: `op:${fake('99')}:operator` }).accounts.length, 0);
});

test('a flood of new usernames cannot reset a live bucket', () => {
  const limiter = new LoginLimiter(10, () => 0);
  for (let i = 0; i < 10; i++) limiter.recordFailure('admin');
  for (let i = 0; i < 10_050; i++) limiter.recordFailure(`spray-${i}`);
  assert.equal(limiter.isBlocked('admin'), true);
  assert.equal(limiter.isBlocked('never-seen'), true);
});

test('env converter reads values with dotenv semantics', async () => {
  const out = await convertEnv('ADMIN_USER=admin\nADMIN_PASS=plain-pass-123 # comment\n');
  assert.equal(out.cleartextByUser.get('admin'), 'plain-pass-123');
});
