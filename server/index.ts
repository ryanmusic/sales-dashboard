import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { login, authMiddleware } from './auth.js';
import { dashboardRoutes } from './routes/dashboard.js';
import { revenueRoutes } from './routes/revenue.js';
import { brandsRoutes } from './routes/brands.js';
import { creatorsRoutes } from './routes/creators.js';
import { campaignsRoutes } from './routes/campaigns.js';
import { usersRoutes } from './routes/users.js';
import { vipRoutes } from './routes/vip.js';
import { transactionsRoutes } from './routes/transactions.js';

const app = express();
const PORT = process.env.PORT || 3101;

app.use(cors());
app.use(express.json());

// Public routes
app.post('/api/login', login);
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Protected routes
app.use('/api', authMiddleware);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/revenue', revenueRoutes);
app.use('/api/brands', brandsRoutes);
app.use('/api/creators', creatorsRoutes);
app.use('/api/campaigns', campaignsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/vip', vipRoutes);
app.use('/api/transactions', transactionsRoutes);

// Serve static frontend in production
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));
app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

const server = app.listen(Number(PORT), () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
server.on('error', (err: any) => {
  if (err.code === 'EADDRINUSE') {
    const next = Number(PORT) + 1;
    console.log(`Port ${PORT} in use, trying ${next}...`);
    app.listen(next, () => {
      console.log(`Server running on http://localhost:${next}`);
    });
  } else {
    throw err;
  }
});
