import { createHash, timingSafeEqual } from 'node:crypto';

import bcrypt from 'bcryptjs';

export const PASSWORD_BCRYPT_COST = 12;
export const PASSWORD_MIN_LENGTH = 12;
// bcrypt ignores input past 72 bytes
export const PASSWORD_MAX_BYTES = 72;

const BCRYPT_HASH_RE = /^\$2[aby]\$(\d{2})\$[./A-Za-z0-9]{53}$/;
const ROLES = new Set(['admin', 'operator']);

export interface Account {
  username: string;
  role: string;
  passwordHash?: string;
  // Transition only: cleartext still in .env.
  legacyPassword?: string;
}

export interface LoadedAccounts {
  accounts: Account[];
  errors: string[];
  cleartextUsers: string[];
}

export function isValidPasswordHash(hash: unknown): hash is string {
  const m = typeof hash === 'string' ? BCRYPT_HASH_RE.exec(hash) : null;
  return !!m && Number(m[1]) >= PASSWORD_BCRYPT_COST;
}

export function looksLikeBcrypt(value: string): boolean {
  return value.startsWith('$2');
}

export function validateNewPassword(password: string): string | undefined {
  if (password.length < PASSWORD_MIN_LENGTH) return `password must be at least ${PASSWORD_MIN_LENGTH} characters`;
  if (Buffer.byteLength(password, 'utf8') > PASSWORD_MAX_BYTES) return `password must be at most ${PASSWORD_MAX_BYTES} bytes`;
  return undefined;
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, PASSWORD_BCRYPT_COST);
}

/**
 * Accounts come from USERS="user:<bcrypt hash>:role,..." and/or ADMIN_USER + ADMIN_PASS_HASH (role admin).
 * There is no default account: nothing configured means nobody can log in. Error strings never contain
 * a password or hash.
 */
export function loadAccounts(env: NodeJS.ProcessEnv = process.env): LoadedAccounts {
  const accounts: Account[] = [];
  const errors: string[] = [];
  const add = (account: Account) => {
    if (accounts.some((a) => a.username === account.username)) {
      errors.push(`user ${account.username} is configured more than once; ignoring the duplicate`);
      return;
    }
    accounts.push(account);
  };
  const secret = (username: string, role: string, value: string, source: string) => {
    if (looksLikeBcrypt(value)) {
      if (!isValidPasswordHash(value)) {
        errors.push(`${source} for ${username} is not a bcrypt hash with cost >= ${PASSWORD_BCRYPT_COST}; ignoring it`);
        return;
      }
      add({ username, role, passwordHash: value });
    } else {
      add({ username, role, legacyPassword: value });
    }
  };

  for (const raw of (env.USERS ?? '').split(',')) {
    if (!raw.trim()) continue;
    const [username, value, roleRaw] = raw.trim().split(':');
    const role = roleRaw || 'operator';
    if (!username || !value) {
      errors.push('USERS has an entry without a username or password hash; ignoring it');
      continue;
    }
    if (!ROLES.has(role)) {
      errors.push(`USERS entry for ${username} has unknown role ${role}; ignoring it`);
      continue;
    }
    secret(username, role, value, 'USERS entry');
  }

  const adminUser = env.ADMIN_USER?.trim();
  const adminHash = env.ADMIN_PASS_HASH?.trim();
  const adminLegacy = env.ADMIN_PASS;
  if (adminUser) {
    if (adminHash && adminLegacy) {
      errors.push('set ADMIN_PASS_HASH or ADMIN_PASS, not both; ignoring ADMIN_USER');
    } else if (adminHash) {
      if (!looksLikeBcrypt(adminHash)) errors.push('ADMIN_PASS_HASH is not a bcrypt hash; ignoring ADMIN_USER');
      else secret(adminUser, 'admin', adminHash, 'ADMIN_PASS_HASH');
    } else if (adminLegacy) {
      add({ username: adminUser, role: 'admin', legacyPassword: adminLegacy });
    } else {
      errors.push('ADMIN_USER is set without ADMIN_PASS_HASH; ignoring it');
    }
  }

  const cleartextUsers = accounts.filter((a) => a.legacyPassword !== undefined).map((a) => a.username);
  return { accounts, errors, cleartextUsers };
}

function constantTimeEquals(a: string, b: string): boolean {
  const digest = (s: string) => createHash('sha256').update(s, 'utf8').digest();
  return timingSafeEqual(digest(a), digest(b));
}

let dummyHash: Promise<string> | undefined;

export async function verifyAccount(accounts: Account[], username: unknown, password: unknown): Promise<Account | null> {
  const name = typeof username === 'string' ? username : '';
  const candidate = typeof password === 'string' ? password : '';
  const account = name ? accounts.find((a) => a.username === name) : undefined;
  if (!account || !candidate) {
    // Unknown users still pay one bcrypt compare so timing doesn't reveal which usernames exist.
    dummyHash ??= hashPassword('not-a-real-account-password');
    await bcrypt.compare(candidate || 'x', await dummyHash);
    return null;
  }
  const ok = account.passwordHash
    ? await bcrypt.compare(candidate, account.passwordHash)
    : constantTimeEquals(candidate, account.legacyPassword ?? '');
  return ok ? account : null;
}

const WINDOW_MS = 10 * 60 * 1000;

/** In-memory failed-login counter per username (single process). */
export class LoginLimiter {
  private failures = new Map<string, { count: number; resetAt: number }>();

  constructor(private readonly maxFailures = 10, private readonly now = () => Date.now()) {}

  private key(username: string) {
    return username.trim().toLowerCase().slice(0, 254);
  }

  isBlocked(username: string): boolean {
    const entry = this.failures.get(this.key(username));
    if (!entry) return false;
    if (entry.resetAt <= this.now()) {
      this.failures.delete(this.key(username));
      return false;
    }
    return entry.count >= this.maxFailures;
  }

  recordFailure(username: string): void {
    const key = this.key(username);
    const entry = this.failures.get(key);
    if (!entry || entry.resetAt <= this.now()) this.failures.set(key, { count: 1, resetAt: this.now() + WINDOW_MS });
    else entry.count += 1;
    if (this.failures.size > 10_000) this.failures.clear();
  }

  reset(username: string): void {
    this.failures.delete(this.key(username));
  }
}

export interface EnvConversion {
  content: string;
  converted: string[];
  cleartextByUser: Map<string, string>;
}

function unquote(raw: string): { value: string; quoted: boolean } {
  const v = raw.trim();
  const quoted = v.length >= 2 && (v[0] === "'" || v[0] === '"') && v.at(-1) === v[0];
  return { value: quoted ? v.slice(1, -1) : v, quoted };
}

/** Rewrites cleartext ADMIN_PASS -> ADMIN_PASS_HASH and cleartext USERS entries -> hashes (same passwords). */
export async function convertEnv(
  content: string,
  hash: (pw: string) => Promise<string> = hashPassword,
): Promise<EnvConversion> {
  const converted: string[] = [];
  const cleartextByUser = new Map<string, string>();
  let next = content;

  for (const key of ['ADMIN_PASS', 'USERS', 'ADMIN_USER']) {
    const n = [...content.matchAll(new RegExp(`^${key}=`, 'gm'))].length;
    if (n > 1) throw new Error(`${key} appears ${n} times; keep one`);
  }

  const adminUser = /^ADMIN_USER=(.*)$/m.exec(content);
  const adminPass = /^ADMIN_PASS=(.*)$/m.exec(content);
  if (adminPass) {
    if (/^ADMIN_PASS_HASH=/m.test(content)) throw new Error('both ADMIN_PASS and ADMIN_PASS_HASH are set; remove one by hand');
    const { value } = unquote(adminPass[1]);
    if (!value) throw new Error('ADMIN_PASS is empty');
    const user = adminUser ? unquote(adminUser[1]).value : '';
    if (!user) throw new Error('ADMIN_PASS is set without ADMIN_USER');
    const replacement = `ADMIN_PASS_HASH='${await hash(value)}'`;
    next = next.replace(adminPass[0], () => replacement);
    converted.push(user);
    cleartextByUser.set(user, value);
  }

  const users = /^USERS=(.*)$/m.exec(next);
  if (users) {
    const { value } = unquote(users[1]);
    let changed = false;
    const entries: string[] = [];
    for (const raw of value.split(',')) {
      if (!raw.trim()) continue;
      const [username, secret, role] = raw.trim().split(':');
      if (!username || !secret) throw new Error('USERS has an entry without a username or password');
      if (looksLikeBcrypt(secret)) {
        entries.push(raw.trim());
        continue;
      }
      if (cleartextByUser.has(username)) throw new Error(`user ${username} is configured more than once`);
      entries.push([username, await hash(secret), role || 'operator'].join(':'));
      converted.push(username);
      cleartextByUser.set(username, secret);
      changed = true;
    }
    if (changed) {
      const replacement = `USERS='${entries.join(',')}'`;
      next = next.replace(users[0], () => replacement);
    }
  }

  return { content: next, converted, cleartextByUser };
}
