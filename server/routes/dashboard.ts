import { Router } from 'express';
import { query } from '../db.js';

export const dashboardRoutes = Router();

// Simple in-memory cache
let dashboardCache: { data: any; ts: number } | null = null;
const CACHE_TTL = 30_000;

// Combined endpoint — returns stats + chart + recent transactions in one call
dashboardRoutes.get('/all', async (req, res) => {
  try {
    if (dashboardCache && Date.now() - dashboardCache.ts < CACHE_TTL) {
      return res.json(dashboardCache.data);
    }

    const months = parseInt(req.query.months as string) || 12;

    const [revenue, creatorPayouts, activeBrands, activeSubscriptions, profit, chart, recentTxns] = await Promise.all([
      query(`
        SELECT
          COALESCE(SUM(amount), 0) as total,
          COALESCE(SUM(CASE WHEN "createTimestamp" >= NOW() - INTERVAL '30 days' THEN amount ELSE 0 END), 0) as last_30d,
          COALESCE(SUM(CASE WHEN "createTimestamp" >= NOW() - INTERVAL '7 days' THEN amount ELSE 0 END), 0) as last_7d
        FROM "deposit-record"
        WHERE status = 'succeeded'
      `),
      query(`
        SELECT
          COALESCE(SUM(amount), 0) as total,
          COALESCE(SUM(CASE WHEN "createTimestamp" >= NOW() - INTERVAL '30 days' THEN amount ELSE 0 END), 0) as last_30d
        FROM cashout
        WHERE status = 'wired_successful'
      `),
      query(`
        SELECT COUNT(DISTINCT b.id) as count
        FROM brands b
        WHERE b."isActive" = true
      `),
      query(`
        SELECT COUNT(*) as count
        FROM users u
        JOIN user_brands ub ON ub."userId"::text = u.id::text AND ub.role = 'owner'
        WHERE u."subscriptionLevel" IS NOT NULL
          AND u."subscriptionLevel" NOT IN ('free')
      `),
      query(`
        SELECT
          COALESCE((SELECT SUM(commission) FROM cashout WHERE status = 'wired_successful'), 0) as cashout_commission,
          COALESCE((SELECT SUM(amount) FROM "deposit-record" WHERE status = 'succeeded' AND "includedSubscriptionLevel" IS NOT NULL), 0) as subscription_revenue
      `),
      query(`
        SELECT
          DATE_TRUNC('month', "createTimestamp") as month,
          SUM(amount) as revenue,
          COUNT(*) as transactions
        FROM "deposit-record"
        WHERE status = 'succeeded'
          AND "createTimestamp" >= NOW() - make_interval(months => $1)
        GROUP BY DATE_TRUNC('month', "createTimestamp")
        ORDER BY month ASC
      `, [months]),
      query(`
        SELECT
          t.id,
          t."createTimestamp",
          t.amount,
          t.currency,
          t.type,
          t.description,
          u_from."fullName" as "fromName",
          u_to."fullName" as "toName"
        FROM transactions t
        LEFT JOIN users u_from ON t."fromId"::text = u_from.id::text
        LEFT JOIN users u_to ON t."toId"::text = u_to.id::text
        ORDER BY t."createTimestamp" DESC
        LIMIT 20
      `),
    ]);

    const cashoutCommission = parseFloat(profit.rows[0].cashout_commission);
    const subscriptionRevenue = parseFloat(profit.rows[0].subscription_revenue);

    const data = {
      stats: {
        totalRevenue: parseFloat(revenue.rows[0].total),
        revenueLast30d: parseFloat(revenue.rows[0].last_30d),
        revenueLast7d: parseFloat(revenue.rows[0].last_7d),
        totalCreatorPayouts: parseFloat(creatorPayouts.rows[0].total),
        creatorPayoutsLast30d: parseFloat(creatorPayouts.rows[0].last_30d),
        activeBrands: parseInt(activeBrands.rows[0].count),
        activeSubscriptions: parseInt(activeSubscriptions.rows[0].count),
        profit: cashoutCommission + subscriptionRevenue,
        profitCashoutCommission: cashoutCommission,
        profitSubscription: subscriptionRevenue,
      },
      chartData: chart.rows.map((r: any) => ({
        month: r.month,
        revenue: parseFloat(r.revenue),
        transactions: parseInt(r.transactions),
      })),
      recentTransactions: recentTxns.rows,
    };

    dashboardCache = { data, ts: Date.now() };
    res.json(data);
  } catch (err) {
    console.error('Dashboard all error:', err);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

// KPI summary stats (kept for backward compat)
dashboardRoutes.get('/stats', async (_req, res) => {
  try {
    const [revenue, creatorPayouts, activeBrands, activeSubscriptions, profit] = await Promise.all([
      query(`
        SELECT
          COALESCE(SUM(amount), 0) as total,
          COALESCE(SUM(CASE WHEN "createTimestamp" >= NOW() - INTERVAL '30 days' THEN amount ELSE 0 END), 0) as last_30d,
          COALESCE(SUM(CASE WHEN "createTimestamp" >= NOW() - INTERVAL '7 days' THEN amount ELSE 0 END), 0) as last_7d
        FROM "deposit-record"
        WHERE status = 'succeeded'
      `),
      query(`
        SELECT
          COALESCE(SUM(amount), 0) as total,
          COALESCE(SUM(CASE WHEN "createTimestamp" >= NOW() - INTERVAL '30 days' THEN amount ELSE 0 END), 0) as last_30d
        FROM cashout
        WHERE status = 'wired_successful'
      `),
      query(`
        SELECT COUNT(DISTINCT b.id) as count
        FROM brands b
        WHERE b."isActive" = true
      `),
      query(`
        SELECT COUNT(*) as count
        FROM users u
        JOIN user_brands ub ON ub."userId"::text = u.id::text AND ub.role = 'owner'
        WHERE u."subscriptionLevel" IS NOT NULL
          AND u."subscriptionLevel" NOT IN ('free')
      `),
      // Profit = cashout commissions (10% of player withdrawals) + subscription deposits
      query(`
        SELECT
          COALESCE((SELECT SUM(commission) FROM cashout WHERE status = 'wired_successful'), 0) as cashout_commission,
          COALESCE((SELECT SUM(amount) FROM "deposit-record" WHERE status = 'succeeded' AND "includedSubscriptionLevel" IS NOT NULL), 0) as subscription_revenue
      `),
    ]);

    const cashoutCommission = parseFloat(profit.rows[0].cashout_commission);
    const subscriptionRevenue = parseFloat(profit.rows[0].subscription_revenue);

    res.json({
      totalRevenue: parseFloat(revenue.rows[0].total),
      revenueLast30d: parseFloat(revenue.rows[0].last_30d),
      revenueLast7d: parseFloat(revenue.rows[0].last_7d),
      totalCreatorPayouts: parseFloat(creatorPayouts.rows[0].total),
      creatorPayoutsLast30d: parseFloat(creatorPayouts.rows[0].last_30d),
      activeBrands: parseInt(activeBrands.rows[0].count),
      activeSubscriptions: parseInt(activeSubscriptions.rows[0].count),
      profit: cashoutCommission + subscriptionRevenue,
      profitCashoutCommission: cashoutCommission,
      profitSubscription: subscriptionRevenue,
    });
  } catch (err) {
    console.error('Dashboard stats error:', err);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

// Revenue over time (monthly)
dashboardRoutes.get('/revenue-chart', async (req, res) => {
  try {
    const months = parseInt(req.query.months as string) || 12;
    const result = await query(`
      SELECT
        DATE_TRUNC('month', "createTimestamp") as month,
        SUM(amount) as revenue,
        COUNT(*) as transactions
      FROM "deposit-record"
      WHERE status = 'succeeded'
        AND "createTimestamp" >= NOW() - make_interval(months => $1)
      GROUP BY DATE_TRUNC('month', "createTimestamp")
      ORDER BY month ASC
    `, [months]);

    res.json(result.rows.map((r: any) => ({
      month: r.month,
      revenue: parseFloat(r.revenue),
      transactions: parseInt(r.transactions),
    })));
  } catch (err) {
    console.error('Revenue chart error:', err);
    res.status(500).json({ error: 'Failed to fetch revenue chart' });
  }
});

// Recent transactions
dashboardRoutes.get('/recent-transactions', async (_req, res) => {
  try {
    const result = await query(`
      SELECT
        t.id,
        t."createTimestamp",
        t.amount,
        t.currency,
        t.type,
        t.description,
        u_from."fullName" as "fromName",
        u_to."fullName" as "toName"
      FROM transactions t
      LEFT JOIN users u_from ON t."fromId"::text = u_from.id::text
      LEFT JOIN users u_to ON t."toId"::text = u_to.id::text
      ORDER BY t."createTimestamp" DESC
      LIMIT 20
    `);

    res.json(result.rows);
  } catch (err) {
    console.error('Recent transactions error:', err);
    res.status(500).json({ error: 'Failed to fetch recent transactions' });
  }
});
