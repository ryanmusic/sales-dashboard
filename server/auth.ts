import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

function getSecret() { return process.env.JWT_SECRET || 'tellit-dashboard-secret-change-me'; }

// Users: env-based for now. USERS format: "user1:pass1:role,user2:pass2:role"
// Roles: admin (full access), operator (no revenue/profit data)
function getUsers(): Array<{ username: string; password: string; role: string }> {
  const usersEnv = process.env.USERS;
  if (usersEnv) {
    return usersEnv.split(',').map((u) => {
      const [username, password, role] = u.trim().split(':');
      return { username, password, role: role || 'operator' };
    });
  }
  // Fallback to legacy single admin
  return [
    { username: process.env.ADMIN_USER || 'admin', password: process.env.ADMIN_PASS || 'admin', role: 'admin' },
  ];
}

export function login(req: Request, res: Response) {
  const { username, password } = req.body;
  const users = getUsers();
  const user = users.find((u) => u.username === username && u.password === password);
  if (user) {
    const token = jwt.sign({ user: user.username, role: user.role }, getSecret(), { expiresIn: '7d' });
    return res.json({ token, role: user.role });
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
