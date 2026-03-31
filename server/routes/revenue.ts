import { Router } from 'express';
import { query } from '../db.js';

export const revenueRoutes = Router();

// Cache for initial load
let revenueInitCache: { data: any; ts: number } | null = null;
const CACHE_TTL = 30_000;

// Combined initial load
revenueRoutes.get('/all', async (_req, res) => {
  try {
    if (revenueInitCache && Date.now() - revenueInitCache.ts < CACHE_TTL) {
      return res.json(revenueInitCache.data);
    }

    const [breakdown, deposits, depositCount, mrr] = await Promise.all([
      query(`
        SELECT type, currency, SUM(amount) as total, COUNT(*) as count
        FROM transactions
        GROUP BY type, currency
        ORDER BY total DESC
      `),
      query(`
        SELECT
          dr.id, dr."createTimestamp", dr.amount, dr.currency, dr.status,
          dr."includedSubscriptionLevel", dr."includedNumberOfStores",
          dr.every, dr."taxAmount", dr."unsubscribedAt",
          u."fullName" as "userName", u.email as "userEmail"
        FROM "deposit-record" dr
        LEFT JOIN users u ON dr."userId"::text = u.id::text
        ORDER BY dr."createTimestamp" DESC
        LIMIT 50
      `),
      query(`SELECT COUNT(*) as count FROM "deposit-record"`),
      query(`
        SELECT
          DATE_TRUNC('month', dr."createTimestamp") as month,
          SUM(CASE WHEN dr.every IS NOT NULL AND dr.every > 0 THEN dr.amount ELSE 0 END) as subscription_revenue,
          SUM(CASE WHEN dr.every IS NULL OR dr.every = 0 THEN dr.amount ELSE 0 END) as onetime_revenue,
          SUM(dr.amount) as total_revenue
        FROM "deposit-record" dr
        WHERE dr.status = 'succeeded'
          AND dr."createTimestamp" >= NOW() - INTERVAL '12 months'
        GROUP BY DATE_TRUNC('month', dr."createTimestamp")
        ORDER BY month ASC
      `),
    ]);

    const data = {
      breakdown: breakdown.rows,
      deposits: {
        records: deposits.rows,
        total: parseInt(depositCount.rows[0].count),
        page: 1,
        limit: 50,
      },
      mrr: mrr.rows.map((r: any) => ({
        month: r.month,
        subscriptionRevenue: parseFloat(r.subscription_revenue),
        onetimeRevenue: parseFloat(r.onetime_revenue),
        totalRevenue: parseFloat(r.total_revenue),
      })),
    };

    revenueInitCache = { data, ts: Date.now() };
    res.json(data);
  } catch (err) {
    console.error('Revenue all error:', err);
    res.status(500).json({ error: 'Failed to fetch revenue data' });
  }
});

// Revenue breakdown by type
revenueRoutes.get('/breakdown', async (_req, res) => {
  try {
    const result = await query(`
      SELECT
        type,
        currency,
        SUM(amount) as total,
        COUNT(*) as count
      FROM transactions
      GROUP BY type, currency
      ORDER BY total DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Revenue breakdown error:', err);
    res.status(500).json({ error: 'Failed to fetch revenue breakdown' });
  }
});

// Deposit records (subscriptions + one-time)
revenueRoutes.get('/deposits', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;

    const [records, total] = await Promise.all([
      query(`
        SELECT
          dr.id,
          dr."createTimestamp",
          dr.amount,
          dr.currency,
          dr.status,
          dr."includedSubscriptionLevel",
          dr."includedNumberOfStores",
          dr.every,
          dr."taxAmount",
          dr."unsubscribedAt",
          u."fullName" as "userName",
          u.email as "userEmail"
        FROM "deposit-record" dr
        LEFT JOIN users u ON dr."userId"::text = u.id::text
        ORDER BY dr."createTimestamp" DESC
        LIMIT $1 OFFSET $2
      `, [limit, offset]),
      query(`SELECT COUNT(*) as count FROM "deposit-record"`),
    ]);

    res.json({
      records: records.rows,
      total: parseInt(total.rows[0].count),
      page,
      limit,
    });
  } catch (err) {
    console.error('Deposits error:', err);
    res.status(500).json({ error: 'Failed to fetch deposits' });
  }
});

// Monthly recurring revenue
revenueRoutes.get('/mrr', async (_req, res) => {
  try {
    const result = await query(`
      SELECT
        DATE_TRUNC('month', dr."createTimestamp") as month,
        SUM(CASE WHEN dr.every IS NOT NULL AND dr.every > 0 THEN dr.amount ELSE 0 END) as subscription_revenue,
        SUM(CASE WHEN dr.every IS NULL OR dr.every = 0 THEN dr.amount ELSE 0 END) as onetime_revenue,
        SUM(dr.amount) as total_revenue
      FROM "deposit-record" dr
      WHERE dr.status = 'succeeded'
        AND dr."createTimestamp" >= NOW() - INTERVAL '12 months'
      GROUP BY DATE_TRUNC('month', dr."createTimestamp")
      ORDER BY month ASC
    `);

    res.json(result.rows.map((r: any) => ({
      month: r.month,
      subscriptionRevenue: parseFloat(r.subscription_revenue),
      onetimeRevenue: parseFloat(r.onetime_revenue),
      totalRevenue: parseFloat(r.total_revenue),
    })));
  } catch (err) {
    console.error('MRR error:', err);
    res.status(500).json({ error: 'Failed to fetch MRR data' });
  }
});
