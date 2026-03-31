import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import { login, authMiddleware } from './auth.js';
import { dashboardRoutes } from './routes/dashboard.js';
import { revenueRoutes } from './routes/revenue.js';
import { brandsRoutes } from './routes/brands.js';
import { creatorsRoutes } from './routes/creators.js';
import { campaignsRoutes } from './routes/campaigns.js';

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

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
