import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

import { LoginLimiter, loadAccounts, verifyAccount, type LoadedAccounts } from './lib/credentials.js';

// Read lazily: ESM evaluates this module before index.ts calls dotenv.config().
function getSecret(): string {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET env var is required');
  return process.env.JWT_SECRET;
}

let loaded: LoadedAccounts | undefined;

/** Called once at startup (after dotenv) so config problems show in the boot log. */
export function initAuth(): LoadedAccounts {
  getSecret();
  loaded = loadAccounts();
  for (const error of loaded.errors) console.error(`[auth] ${error}`);
  if (loaded.cleartextUsers.length > 0) {
    console.warn(
      `[auth] cleartext passwords in .env for: ${loaded.cleartextUsers.join(', ')}. ` +
        'Convert with `yarn admin:convert-env`; cleartext stops working in the next release.',
    );
  }
  if (loaded.accounts.length === 0) console.error('[auth] no login accounts configured; every login will fail');
  return loaded;
}

const limiter = new LoginLimiter();

function forLog(value: unknown): string {
  return String(value ?? '').replace(/[\r\n\t]/g, ' ').slice(0, 254);
}

// Roles: admin (full access), operator (no revenue/profit data)
export async function login(req: Request, res: Response) {
  const { username, password } = req.body || {};
  if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
    return res.status(400).json({ error: 'username and password required' });
  }
  if (limiter.isBlocked(username)) {
    console.warn(`[auth] login rate-limited user=${forLog(username)} ip=${req.ip}`);
    return res.status(429).json({ error: 'Too many failed attempts, try again in 10 minutes' });
  }
  const account = await verifyAccount((loaded ?? initAuth()).accounts, username, password);
  if (!account) {
    limiter.recordFailure(username);
    console.warn(`[auth] login failed user=${forLog(username)} ip=${req.ip}`);
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  limiter.reset(username);
  const token = jwt.sign({ user: account.username, role: account.role }, getSecret(), { expiresIn: '7d' });
  return res.json({ token, role: account.role });
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    jwt.verify(header.slice(7), getSecret());
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}
