import { Router } from 'express';
import { query } from '../db.js';

export const brandsRoutes = Router();

// Cache for initial load (no search, page 1)
let brandsInitCache: { data: any; ts: number } | null = null;
const CACHE_TTL = 60_000;

// Combined initial load — brand list + subscription stats in one call
brandsRoutes.get('/all', async (_req, res) => {
  try {
    if (brandsInitCache && Date.now() - brandsInitCache.ts < CACHE_TTL) {
      return res.json(brandsInitCache.data);
    }

    const [brands, total, subStats] = await Promise.all([
      query(`
        SELECT
          b.id as "brandId",
          b.name as "brandName",
          b."isActive",
          b."createTimestamp" as "brandCreatedAt",
          u.id as "userId",
          u."fullName",
          u.email,
          u."subscriptionLevel",
          u."isActive" as "userActive",
          u."createTimestamp" as "userCreatedAt",
          cp."expiryDate" as "planExpiry",
          cp."commissionRate" as "customCommissionRate",
          latest_deposit.amount as "lastDepositAmount",
          latest_deposit."createTimestamp" as "lastDepositDate",
          latest_deposit."includedSubscriptionLevel" as "lastDepositPlan",
          latest_deposit."unsubscribedAt",
          bb."totalincome" as "totalDeposited",
          bb.balance
        FROM brands b
        JOIN user_brands ub ON ub."brandId" = b.id AND ub.role = 'owner'
        JOIN users u ON ub."userId"::text = u.id::text
        LEFT JOIN "custom-plans" cp ON cp."userId"::text = u.id::text
        LEFT JOIN LATERAL (
          SELECT amount, "createTimestamp", "includedSubscriptionLevel", "unsubscribedAt"
          FROM "deposit-record"
          WHERE "userId"::text = u.id::text AND status = 'succeeded'
          ORDER BY "createTimestamp" DESC
          LIMIT 1
        ) latest_deposit ON true
        LEFT JOIN "brand-balance" bb ON bb."userid"::text = u.id::text AND bb.currency = 'USD'
        WHERE 'brand' = ANY(u.roles)
        ORDER BY b."createTimestamp" DESC
        LIMIT 50
      `),
      query(`
        SELECT COUNT(DISTINCT b.id) as count
        FROM brands b
        JOIN user_brands ub ON ub."brandId" = b.id AND ub.role = 'owner'
        JOIN users u ON ub."userId"::text = u.id::text
      `),
      query(`
        SELECT
          u."subscriptionLevel",
          COUNT(*) as count
        FROM users u
        JOIN user_brands ub ON ub."userId"::text = u.id::text AND ub.role = 'owner'
        GROUP BY u."subscriptionLevel"
        ORDER BY count DESC
      `),
    ]);

    const data = {
      brands: brands.rows,
      total: parseInt(total.rows[0].count),
      page: 1,
      limit: 50,
      subStats: subStats.rows,
    };

    brandsInitCache = { data, ts: Date.now() };
    res.json(data);
  } catch (err) {
    console.error('Brands all error:', err);
    res.status(500).json({ error: 'Failed to fetch brands data' });
  }
});

// Brand list with subscription info
brandsRoutes.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;
    const search = req.query.search as string;

    let whereClause = `WHERE 'brand' = ANY(u.roles)`;
    const params: any[] = [limit, offset];

    if (search) {
      params.push(`%${search}%`);
      whereClause += ` AND (b.name ILIKE $3 OR u."fullName" ILIKE $3 OR u.email ILIKE $3)`;
    }

    const [brands, total] = await Promise.all([
      query(`
        SELECT
          b.id as "brandId",
          b.name as "brandName",
          b."isActive",
          b."createTimestamp" as "brandCreatedAt",
          u.id as "userId",
          u."fullName",
          u.email,
          u."subscriptionLevel",
          u."isActive" as "userActive",
          u."createTimestamp" as "userCreatedAt",
          cp."expiryDate" as "planExpiry",
          cp."commissionRate" as "customCommissionRate",
          latest_deposit.amount as "lastDepositAmount",
          latest_deposit."createTimestamp" as "lastDepositDate",
          latest_deposit."includedSubscriptionLevel" as "lastDepositPlan",
          latest_deposit."unsubscribedAt",
          bb."totalincome" as "totalDeposited",
          bb.balance
        FROM brands b
        JOIN user_brands ub ON ub."brandId" = b.id AND ub.role = 'owner'
        JOIN users u ON ub."userId"::text = u.id::text
        LEFT JOIN "custom-plans" cp ON cp."userId"::text = u.id::text
        LEFT JOIN LATERAL (
          SELECT amount, "createTimestamp", "includedSubscriptionLevel", "unsubscribedAt"
          FROM "deposit-record"
          WHERE "userId"::text = u.id::text AND status = 'succeeded'
          ORDER BY "createTimestamp" DESC
          LIMIT 1
        ) latest_deposit ON true
        LEFT JOIN "brand-balance" bb ON bb."userid"::text = u.id::text AND bb.currency = 'USD'
        ${whereClause}
        ORDER BY b."createTimestamp" DESC
        LIMIT $1 OFFSET $2
      `, params),
      query(`
        SELECT COUNT(DISTINCT b.id) as count
        FROM brands b
        JOIN user_brands ub ON ub."brandId" = b.id AND ub.role = 'owner'
        JOIN users u ON ub."userId"::text = u.id::text
        ${search ? `WHERE 'brand' = ANY(u.roles) AND (b.name ILIKE $1 OR u."fullName" ILIKE $1 OR u.email ILIKE $1)` : ''}
      `, search ? [`%${search}%`] : []),
    ]);

    res.json({
      brands: brands.rows,
      total: parseInt(total.rows[0].count),
      page,
      limit,
    });
  } catch (err) {
    console.error('Brands error:', err);
    res.status(500).json({ error: 'Failed to fetch brands' });
  }
});

// Subscription level distribution
brandsRoutes.get('/subscription-stats', async (_req, res) => {
  try {
    const result = await query(`
      SELECT
        u."subscriptionLevel",
        COUNT(*) as count
      FROM users u
      JOIN user_brands ub ON ub."userId"::text = u.id::text AND ub.role = 'owner'
      
      GROUP BY u."subscriptionLevel"
      ORDER BY count DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Subscription stats error:', err);
    res.status(500).json({ error: 'Failed to fetch subscription stats' });
  }
});
