import { Router } from 'express';
import { query } from '../db.js';

export const creatorsRoutes = Router();

// Cache for initial load
let creatorsInitCache: { data: any; ts: number } | null = null;
const CACHE_TTL = 30_000;

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

// Search payouts by IG username
creatorsRoutes.get('/payouts/search', async (req, res) => {
  try {
    const igUsername = req.query.ig as string;
    if (!igUsername) return res.status(400).json({ error: 'ig parameter required' });

    const result = await query(`
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
        bi."bankAccountNumber",
        (SELECT sa.profile->>'username' FROM "social-accounts" sa WHERE sa."userId"::text = u.id::text AND sa.platform = 'Instagram' AND sa."deletedAt" IS NULL LIMIT 1) as "igUsername"
      FROM cashout c
      JOIN users u ON c."userId"::text = u.id::text
      LEFT JOIN "tw-bank-info" bi ON c."bankInfoId"::text = bi.id::text
      WHERE EXISTS (
        SELECT 1 FROM "social-accounts" sa
        WHERE sa."userId"::text = u.id::text AND sa.platform = 'Instagram' AND sa."deletedAt" IS NULL
          AND sa.profile->>'username' ILIKE $1
      )
      ORDER BY c."createTimestamp" DESC
      LIMIT 100
    `, [`%${igUsername}%`]);

    res.json(result.rows);
  } catch (err) {
    console.error('Payout search error:', err);
    res.status(500).json({ error: 'Failed to search payouts' });
  }
});

// Update payout status (approve, reject, wire)
creatorsRoutes.patch('/payouts/:id', async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: 'status is required' });

    const payoutId = req.params.id;

    // If approving, check balance
    if (status === 'approved') {
      const payout = await query(`SELECT "userId", amount FROM cashout WHERE id = $1`, [payoutId]);
      if (payout.rows.length === 0) return res.status(404).json({ error: 'Payout not found' });

      const userId = payout.rows[0].userId;
      const amount = parseFloat(payout.rows[0].amount);

      const bal = await query(
        `SELECT balance FROM "player-balance" WHERE userid::text = $1 AND currency = 'twd'`,
        [userId],
      );
      const balance = bal.rows.length > 0 ? parseFloat(bal.rows[0].balance) : 0;
      if (balance < amount) {
        return res.status(409).json({ error: `Insufficient balance: ${balance} < ${amount}` });
      }
    }

    const result = await query(`
      UPDATE cashout SET status = $1, "exportedAt" = CASE WHEN $1 = 'wired_successful' THEN NOW() ELSE "exportedAt" END
      WHERE id = $2 RETURNING id, status
    `, [status, payoutId]);

    if (result.rowCount === 0) return res.status(404).json({ error: 'Payout not found' });

    // Invalidate cache
    creatorsInitCache = null;

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update payout error:', err);
    res.status(500).json({ error: 'Failed to update payout' });
  }
});

// Lookup creator history: reservations, submissions, payouts by userId or IG username
creatorsRoutes.get('/lookup', async (req, res) => {
  try {
    const ig = req.query.ig as string;
    const userId = req.query.userId as string;

    if (!ig && !userId) return res.status(400).json({ error: 'ig or userId required' });

    // Find user
    let userResult;
    if (userId) {
      userResult = await query(`SELECT id, "fullName", email, "phoneNumber" FROM users WHERE id::text = $1`, [userId]);
    } else {
      userResult = await query(`
        SELECT u.id, u."fullName", u.email, u."phoneNumber"
        FROM users u
        JOIN "social-accounts" sa ON sa."userId"::text = u.id::text
        WHERE sa.platform = 'Instagram' AND sa."deletedAt" IS NULL
          AND sa.profile->>'username' ILIKE $1
        LIMIT 1
      `, [`%${ig}%`]);
    }

    if (userResult.rows.length === 0) return res.json({ user: null, reservations: [], submissions: [], payouts: [] });

    const user = userResult.rows[0];
    const uid = user.id;

    // Get IG username
    const igResult = await query(
      `SELECT profile->>'username' as "igUsername", profile->>'follower_count' as followers FROM "social-accounts" WHERE "userId"::text = $1 AND platform = 'Instagram' AND "deletedAt" IS NULL LIMIT 1`,
      [uid],
    );

    const [reservations, submissions, payouts] = await Promise.all([
      query(`
        SELECT r.id, r.status, r."createTimestamp", r."expireTimestamp", r."approvedAt", r."usedAt",
          r."callCardId",
          ac.title as "campaignTitle", ac.status as "campaignStatus",
          s.name as "storeName"
        FROM "cc-slot-reservations" r
        JOIN "attention-cards" ac ON ac.id = r."callCardId"
        JOIN stores s ON s.id = ac."storeId"
        WHERE r."playerId"::text = $1
        ORDER BY r."createTimestamp" DESC
        LIMIT 50
      `, [uid]),
      query(`
        SELECT ps.id, ps.status, ps."createTimestamp", ps."acceptedAt",
          ps."callCardId",
          ps."postSnapshot"->>'view_count' as "viewCount",
          ps."postSnapshot"->>'like_count' as "likeCount",
          p."contentObj"->>'url' as "postUrl",
          ac.title as "campaignTitle"
        FROM "post-submissions" ps
        JOIN "attention-cards" ac ON ac.id = ps."callCardId"
        JOIN posts p ON p.id = ps."postId"
        WHERE ps."playerId"::text = $1
        ORDER BY ps."createTimestamp" DESC
        LIMIT 50
      `, [uid]),
      query(`
        SELECT c.id, c.status, c."createTimestamp", c.amount, c.currency, c.commission, c.net,
          bi."bankCode", bi."bankAccountNumber"
        FROM cashout c
        LEFT JOIN "tw-bank-info" bi ON c."bankInfoId"::text = bi.id::text
        WHERE c."userId"::text = $1
        ORDER BY c."createTimestamp" DESC
        LIMIT 50
      `, [uid]),
    ]);

    res.json({
      user: { ...user, igUsername: igResult.rows[0]?.igUsername, followers: igResult.rows[0]?.followers },
      reservations: reservations.rows,
      submissions: submissions.rows,
      payouts: payouts.rows,
    });
  } catch (err) {
    console.error('Creator lookup error:', err);
    res.status(500).json({ error: 'Failed to lookup creator' });
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
