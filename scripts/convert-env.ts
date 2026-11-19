// Usage: yarn admin:convert-env [path/to/.env] [--dry-run]
// Rewrites cleartext ADMIN_PASS -> ADMIN_PASS_HASH and cleartext USERS entries -> bcrypt hashes (same
// passwords). Keeps a 600-mode backup, re-verifies every hash, prints usernames only.
import { chmodSync, readFileSync, renameSync, writeFileSync } from 'node:fs';

import dotenv from 'dotenv';

import { convertEnv, loadAccounts, verifyAccount } from '../server/lib/credentials.js';

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const path = args.find((a) => !a.startsWith('--')) ?? '.env';
  const original = readFileSync(path, 'utf8');
  const result = await convertEnv(original);

  console.log(`file: ${path}`);
  console.log(`${dryRun ? 'would convert' : 'converted'}: ${result.converted.join(', ') || '(none)'}`);
  if (result.content === original) {
    console.log('nothing to change');
    return;
  }
  if (dryRun) return;

  const backup = `${path}.bak-adminpw-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  writeFileSync(backup, original, { mode: 0o600, flag: 'wx' });
  const tmp = `${path}.tmp-${process.pid}`;
  writeFileSync(tmp, result.content, { mode: 0o600, flag: 'wx' });
  renameSync(tmp, path);
  chmodSync(path, 0o600);

  const loaded = loadAccounts(dotenv.parse(readFileSync(path, 'utf8')));
  let ok = loaded.cleartextUsers.length === 0 && loaded.errors.length === 0;
  for (const [user, cleartext] of result.cleartextByUser) {
    if (!ok) break;
    ok = (await verifyAccount(loaded.accounts, user, cleartext))?.passwordHash !== undefined;
  }
  if (!ok) {
    writeFileSync(path, original, { mode: 0o600 });
    throw new Error('verification failed; restored the original file');
  }
  console.log(`verified: ${result.converted.length} hash(es) match the previous passwords; mode 600`);
  console.log(`backup (still holds the old cleartext; delete it once login is confirmed): ${backup}`);
}

main().catch((err) => {
  console.error(`admin:convert-env: ${err.message}`);
  process.exit(1);
});
