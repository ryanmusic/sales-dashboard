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

// Top customers by revenue + AR/AP summary
dashboardRoutes.get('/finance', async (_req, res) => {
  try {
    const [topCustomers, accountsReceivable, accountsPayable, revByCampaign] = await Promise.all([
      // Top 20 customers by revenue (last 12 months), exclude internal
      query(`
        SELECT
          u.id as "userId",
          u."fullName",
          u.email,
          u."phoneNumber",
          CASE WHEN LOWER(b.name) = 'my default brand'
            THEN COALESCE((SELECT s.name FROM stores s WHERE s."brandId"::text = b.id::text AND s."deleteTimestamp" IS NULL LIMIT 1), b.name)
            ELSE b.name
          END as "brandName",
          SUM(d.amount::numeric) as "totalRevenue",
          COUNT(*) as "depositCount",
          MAX(d."createTimestamp") as "lastDeposit"
        FROM "deposit-record" d
        JOIN users u ON u.id::text = d."userId"::text
        JOIN user_brands ub ON ub."userId"::text = u.id::text AND ub.role = 'owner'
        JOIN brands b ON b.id = ub."brandId"
        WHERE d.status = 'succeeded'
          AND d."createTimestamp" >= NOW() - INTERVAL '12 months'
          AND u.email NOT ILIKE '%tellitapp.ai'
        GROUP BY u.id, u."fullName", u.email, u."phoneNumber", b.id, b.name
        ORDER BY "totalRevenue" DESC
        LIMIT 20
      `),
      // Accounts Receivable: pending/failed deposits
      query(`
        SELECT
          u."fullName",
          u.email,
          CASE WHEN LOWER(b.name) = 'my default brand'
            THEN COALESCE((SELECT s.name FROM stores s WHERE s."brandId"::text = b.id::text AND s."deleteTimestamp" IS NULL LIMIT 1), b.name)
            ELSE b.name
          END as "brandName",
          d.amount::numeric,
          d.status,
          d."createTimestamp"
        FROM "deposit-record" d
        JOIN users u ON u.id::text = d."userId"::text
        JOIN user_brands ub ON ub."userId"::text = u.id::text AND ub.role = 'owner'
        JOIN brands b ON b.id = ub."brandId"
        WHERE d.status IN ('pending')
          AND u.email NOT ILIKE '%tellitapp.ai'
        ORDER BY d.amount::numeric DESC
        LIMIT 50
      `),
      // Accounts Payable: pending creator cashouts
      query(`
        SELECT
          c.id,
          u."fullName" as "creatorName",
          u.email,
          (SELECT sa.profile->>'username' FROM "social-accounts" sa WHERE sa."userId"::text = u.id::text AND sa.platform = 'Instagram' AND sa."deletedAt" IS NULL LIMIT 1) as "igUsername",
          c.amount::numeric,
          c.commission::numeric,
          c.net::numeric,
          c.status,
          c."createTimestamp",
          c."commissionRate"
        FROM cashout c
        JOIN users u ON u.id::text = c."userId"::text
        WHERE c.status IN ('pending', 'processing', 'approved')
        ORDER BY c."createTimestamp" DESC
        LIMIT 50
      `),
      // Revenue by campaign (top 20)
      query(`
        SELECT
          ac.id,
          ac.title,
          ac.status,
          ac.slots,
          s.name as "storeName",
          CASE WHEN LOWER(b2.name) = 'my default brand'
            THEN COALESCE((SELECT s2.name FROM stores s2 WHERE s2."brandId"::text = b2.id::text AND s2."deleteTimestamp" IS NULL LIMIT 1), b2.name)
            ELSE b2.name
          END as "brandName",
          COALESCE(sub.total_views, 0) as "totalViews",
          COALESCE(sub.total_likes, 0) as "totalLikes",
          COALESCE(sub.accepted_count, 0) as "acceptedCount",
          COALESCE(res.total_reservations, 0) as "totalReservations"
        FROM "attention-cards" ac
        JOIN stores s ON s.id = ac."storeId"
        JOIN brands b2 ON b2.id::text = s."brandId"::text
        LEFT JOIN LATERAL (
          SELECT
            SUM((ps."postSnapshot"->>'view_count')::int) as total_views,
            SUM((ps."postSnapshot"->>'like_count')::int) as total_likes,
            COUNT(*) as accepted_count
          FROM "post-submissions" ps
          WHERE ps."callCardId" = ac.id AND ps.status = 'accepted' AND ps."postSnapshot" IS NOT NULL
        ) sub ON true
        LEFT JOIN LATERAL (
          SELECT COUNT(*) as total_reservations
          FROM "cc-slot-reservations" r
          WHERE r."callCardId" = ac.id AND r.status IN ('booked', 'boooked', 'pending', 'used')
        ) res ON true
        WHERE ac.status IN ('active', 'concluded')
        ORDER BY COALESCE(sub.total_views, 0) DESC
        LIMIT 20
      `),
    ]);

    // Summary totals
    const arTotal = accountsReceivable.rows.reduce((s: number, r: any) => s + parseFloat(r.amount), 0);
    const apTotal = accountsPayable.rows.reduce((s: number, r: any) => s + parseFloat(r.amount), 0);
    const apNetTotal = accountsPayable.rows.reduce((s: number, r: any) => s + (parseFloat(r.net) || 0), 0);

    res.json({
      topCustomers: topCustomers.rows,
      accountsReceivable: { records: accountsReceivable.rows, total: arTotal },
      accountsPayable: { records: accountsPayable.rows, total: apTotal, netTotal: apNetTotal },
      revByCampaign: revByCampaign.rows,
    });
  } catch (err) {
    console.error('Finance dashboard error:', err);
    res.status(500).json({ error: 'Failed to fetch finance data' });
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
