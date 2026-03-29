import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { dashboardRoutes } from './routes/dashboard.js';
import { revenueRoutes } from './routes/revenue.js';
import { brandsRoutes } from './routes/brands.js';
import { creatorsRoutes } from './routes/creators.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3101;

app.use(cors());
app.use(express.json());

app.use('/api/dashboard', dashboardRoutes);
app.use('/api/revenue', revenueRoutes);
app.use('/api/brands', brandsRoutes);
app.use('/api/creators', creatorsRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
