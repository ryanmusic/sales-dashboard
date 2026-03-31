import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

function getSecret() { return process.env.JWT_SECRET || 'tellit-dashboard-secret-change-me'; }

export function login(req: Request, res: Response) {
  const { username, password } = req.body;
  const adminUser = process.env.ADMIN_USER || 'admin';
  const adminPass = process.env.ADMIN_PASS || 'admin';
  if (username === adminUser && password === adminPass) {
    const token = jwt.sign({ user: username }, getSecret(), { expiresIn: '7d' });
    return res.json({ token });
  }
  res.status(401).json({ error: 'Invalid credentials' });
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
