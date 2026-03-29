import { Router } from 'express';
import { query } from '../db.js';

export const creatorsRoutes = Router();

// Cache for initial load
let creatorsInitCache: { data: any; ts: number } | null = null;
const CACHE_TTL = 60_000;

// Combined initial load — payouts + stats + balances in one call
creatorsRoutes.get('/all', async (_req, res) => {
  try {
    if (creatorsInitCache && Date.now() - creatorsInitCache.ts < CACHE_TTL) {
      return res.json(creatorsInitCache.data);
    }

    const [payouts, payoutCount, stats, balances] = await Promise.all([
      query(`
        SELECT
          c.id,
          c."createTimestamp",
          c.amount,
          c.currency,
          c.status,
          c."commissionRate",
          c.commission,
          c.net,
          c."roleType",
          c.comment,
          c.reason,
          c."exportedAt",
          u."fullName",
          u.email,
          bi."bankCode",
          bi."bankAccountNumber"
        FROM cashout c
        JOIN users u ON c."userId"::text = u.id::text
        LEFT JOIN "tw-bank-info" bi ON c."bankInfoId"::text = bi.id::text
        ORDER BY c."createTimestamp" DESC
        LIMIT 50
      `),
      query(`SELECT COUNT(*) as count FROM cashout`),
      query(`
        SELECT
          status,
          COUNT(*) as count,
          COALESCE(SUM(amount), 0) as total_amount,
          COALESCE(SUM(commission), 0) as total_commission,
          COALESCE(SUM(net), 0) as total_net
        FROM cashout
        GROUP BY status
        ORDER BY count DESC
      `),
      query(`
        SELECT pb.*, sa.profile->>'username' as "igUsername"
        FROM "player-balance" pb
        LEFT JOIN "social-accounts" sa ON sa."userId"::text = pb.userid::text AND sa.platform = 'Instagram' AND sa."deletedAt" IS NULL
        WHERE pb.balance > 0
        ORDER BY pb.balance DESC
        LIMIT 50
      `),
    ]);

    const data = {
      payouts: {
        payouts: payouts.rows,
        total: parseInt(payoutCount.rows[0].count),
        page: 1,
        limit: 50,
      },
      stats: stats.rows.map((r: any) => ({
        status: r.status,
        count: parseInt(r.count),
        totalAmount: parseFloat(r.total_amount),
        totalCommission: parseFloat(r.total_commission),
        totalNet: parseFloat(r.total_net),
      })),
      balances: balances.rows,
    };

    creatorsInitCache = { data, ts: Date.now() };
    res.json(data);
  } catch (err) {
    console.error('Creators all error:', err);
    res.status(500).json({ error: 'Failed to fetch creators data' });
  }
});

// Creator payouts list
creatorsRoutes.get('/payouts', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;
    const status = req.query.status as string;

    let whereClause = '';
    const params: any[] = [limit, offset];

    if (status) {
      params.push(status);
      whereClause = `WHERE c.status = $3`;
    }

    const [payouts, total] = await Promise.all([
      query(`
        SELECT
          c.id,
          c."createTimestamp",
          c.amount,
          c.currency,
          c.status,
          c."commissionRate",
          c.commission,
          c.net,
          c."roleType",
          c.comment,
          c.reason,
          c."exportedAt",
          u."fullName",
          u.email,
          bi."bankCode",
          bi."bankAccountNumber"
        FROM cashout c
        JOIN users u ON c."userId"::text = u.id::text
        LEFT JOIN "tw-bank-info" bi ON c."bankInfoId"::text = bi.id::text
        ${whereClause}
        ORDER BY c."createTimestamp" DESC
        LIMIT $1 OFFSET $2
      `, params),
      query(`SELECT COUNT(*) as count FROM cashout ${whereClause}`, status ? [status] : []),
    ]);

    res.json({
      payouts: payouts.rows,
      total: parseInt(total.rows[0].count),
      page,
      limit,
    });
  } catch (err) {
    console.error('Creator payouts error:', err);
    res.status(500).json({ error: 'Failed to fetch creator payouts' });
  }
});

// Payout summary stats
creatorsRoutes.get('/stats', async (_req, res) => {
  try {
    const result = await query(`
      SELECT
        status,
        COUNT(*) as count,
        COALESCE(SUM(amount), 0) as total_amount,
        COALESCE(SUM(commission), 0) as total_commission,
        COALESCE(SUM(net), 0) as total_net
      FROM cashout
      GROUP BY status
      ORDER BY count DESC
    `);

    res.json(result.rows.map((r: any) => ({
      status: r.status,
      count: parseInt(r.count),
      totalAmount: parseFloat(r.total_amount),
      totalCommission: parseFloat(r.total_commission),
      totalNet: parseFloat(r.total_net),
    })));
  } catch (err) {
    console.error('Creator stats error:', err);
    res.status(500).json({ error: 'Failed to fetch creator stats' });
  }
});

// Player balance overview
creatorsRoutes.get('/balances', async (_req, res) => {
  try {
    const result = await query(`
      SELECT pb.*, sa.profile->>'username' as "igUsername"
      FROM "player-balance" pb
      LEFT JOIN "social-accounts" sa ON sa."userId"::text = pb.userid::text AND sa.platform = 'Instagram' AND sa."deletedAt" IS NULL
      WHERE pb.balance > 0
      ORDER BY pb.balance DESC
      LIMIT 50
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Player balances error:', err);
    res.status(500).json({ error: 'Failed to fetch player balances' });
  }
});
