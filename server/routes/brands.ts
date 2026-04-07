import { Router } from 'express';
import { query } from '../db.js';

export const brandsRoutes = Router();

// Cache for initial load (no search, page 1)
let brandsInitCache: { data: any; ts: number } | null = null;
const CACHE_TTL = 30_000;

// Combined initial load — brand list + subscription stats in one call
brandsRoutes.get('/all', async (_req, res) => {
  try {
    if (brandsInitCache && Date.now() - brandsInitCache.ts < CACHE_TTL) {
      return res.json(brandsInitCache.data);
    }

    const [brands, total, subStats, expiringPlans, leastActive] = await Promise.all([
      query(`
        SELECT
          b.id as "brandId",
          CASE WHEN LOWER(b.name) = 'my default brand'
            THEN COALESCE((SELECT s.name FROM stores s WHERE s."brandId"::text = b.id::text AND s."deleteTimestamp" IS NULL LIMIT 1), b.name)
            ELSE b.name
          END as "brandName",
          b."isActive",
          b."createTimestamp" as "brandCreatedAt",
          u.id as "userId",
          u."fullName",
          u.email,
          u."phoneNumber",
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
          bb.balance,
          (SELECT COUNT(*) FROM user_brands ub2 WHERE ub2."userId"::text = u.id::text AND ub2.role = 'owner') as "brandCount"
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
        LEFT JOIN "brand-balance" bb ON bb."userid"::text = u.id::text AND LOWER(bb.currency) = 'twd'
        WHERE 'brand' = ANY(u.roles)
          AND EXISTS (SELECT 1 FROM stores s WHERE s."brandId"::text = b.id::text AND s."deleteTimestamp" IS NULL)
        ORDER BY b."createTimestamp" DESC
        LIMIT 50
      `),
      query(`
        SELECT COUNT(DISTINCT b.id) as count
        FROM brands b
        JOIN user_brands ub ON ub."brandId" = b.id AND ub.role = 'owner'
        JOIN users u ON ub."userId"::text = u.id::text
        WHERE EXISTS (SELECT 1 FROM stores s WHERE s."brandId"::text = b.id::text AND s."deleteTimestamp" IS NULL)
      `),
      query(`
        SELECT
          u."subscriptionLevel",
          COUNT(*) as count
        FROM users u
        JOIN user_brands ub ON ub."userId"::text = u.id::text AND ub.role = 'owner'
        JOIN brands b ON b.id = ub."brandId"
        WHERE EXISTS (SELECT 1 FROM stores s WHERE s."brandId"::text = b.id::text AND s."deleteTimestamp" IS NULL)
        GROUP BY u."subscriptionLevel"
        ORDER BY count DESC
      `),
      query(`
        WITH expiring AS (
          -- Custom-plan expirations
          SELECT
            cp."expiryDate" as "expiryDate",
            u.id as "userId",
            u."fullName", u.email, u."phoneNumber", u."subscriptionLevel",
            CASE WHEN LOWER(b.name) = 'my default brand'
              THEN COALESCE((SELECT s.name FROM stores s WHERE s."brandId"::text = b.id::text AND s."deleteTimestamp" IS NULL LIMIT 1), b.name)
              ELSE b.name
            END as "brandName",
            bb.balance
          FROM "custom-plans" cp
          JOIN users u ON cp."userId"::text = u.id::text
          JOIN user_brands ub ON ub."userId"::text = u.id::text AND ub.role = 'owner'
          JOIN brands b ON b.id = ub."brandId"
          LEFT JOIN "brand-balance" bb ON bb."userid"::text = u.id::text AND LOWER(bb.currency) = 'twd'
          WHERE cp."expiryDate" IS NOT NULL
            AND cp."expiryDate" >= NOW() - INTERVAL '30 days'
            AND cp."expiryDate" <= NOW() + INTERVAL '90 days'

          UNION ALL

          -- Deposit-based subscription expirations
          SELECT
            (dr."createTimestamp" + (dr.every || ' months')::interval) as "expiryDate",
            u.id as "userId",
            u."fullName", u.email, u."phoneNumber", u."subscriptionLevel",
            CASE WHEN LOWER(b.name) = 'my default brand'
              THEN COALESCE((SELECT s.name FROM stores s WHERE s."brandId"::text = b.id::text AND s."deleteTimestamp" IS NULL LIMIT 1), b.name)
              ELSE b.name
            END as "brandName",
            bb.balance
          FROM users u
          JOIN LATERAL (
            SELECT * FROM "deposit-record" d
            WHERE d."userId"::text = u.id::text AND d.status = 'succeeded' AND d.every IS NOT NULL AND d.every > 0
            ORDER BY d."createTimestamp" DESC LIMIT 1
          ) dr ON true
          JOIN user_brands ub ON ub."userId"::text = u.id::text AND ub.role = 'owner'
          JOIN brands b ON b.id = ub."brandId"
          LEFT JOIN "brand-balance" bb ON bb."userid"::text = u.id::text AND LOWER(bb.currency) = 'twd'
          WHERE u."subscriptionLevel" IS NOT NULL AND u."subscriptionLevel" NOT IN ('free')
            AND (dr."createTimestamp" + (dr.every || ' months')::interval) >= NOW() - INTERVAL '30 days'
            AND (dr."createTimestamp" + (dr.every || ' months')::interval) <= NOW() + INTERVAL '90 days'
            AND NOT EXISTS (SELECT 1 FROM "custom-plans" cp WHERE cp."userId"::text = u.id::text AND cp."expiryDate" IS NOT NULL)
        )
        SELECT * FROM (
          SELECT DISTINCT ON ("userId") * FROM expiring ORDER BY "userId", "expiryDate" ASC
        ) t ORDER BY "expiryDate" ASC
        LIMIT 30
      `),
      query(`
        SELECT
          u.id as "userId",
          u."fullName",
          u.email,
          u."phoneNumber",
          u."subscriptionLevel",
          u."updateTimestamp" as "lastActive",
          CASE WHEN LOWER(b.name) = 'my default brand'
            THEN COALESCE((SELECT s.name FROM stores s WHERE s."brandId"::text = b.id::text AND s."deleteTimestamp" IS NULL LIMIT 1), b.name)
            ELSE b.name
          END as "brandName",
          bb.balance
        FROM users u
        JOIN user_brands ub ON ub."userId"::text = u.id::text AND ub.role = 'owner'
        JOIN brands b ON b.id = ub."brandId"
        LEFT JOIN "brand-balance" bb ON bb."userid"::text = u.id::text AND LOWER(bb.currency) = 'twd'
        WHERE EXISTS (SELECT 1 FROM stores s WHERE s."brandId"::text = b.id::text AND s."deleteTimestamp" IS NULL)
          AND u."updateTimestamp" IS NOT NULL
        ORDER BY u."updateTimestamp" ASC
        LIMIT 50
      `),
    ]);

    const data = {
      brands: brands.rows,
      total: parseInt(total.rows[0].count),
      page: 1,
      limit: 50,
      subStats: subStats.rows,
      expiringPlans: expiringPlans.rows,
      leastActive: leastActive.rows,
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

    const subscription = req.query.subscription as string;
    const hasStore = req.query.hasStore !== 'false'; // default true

    let whereClause = `WHERE 'brand' = ANY(u.roles)`;
    const params: any[] = [limit, offset];
    let paramIndex = 3;

    if (search) {
      params.push(`%${search}%`);
      whereClause += ` AND (COALESCE(b.name, '') ILIKE $${paramIndex} OR u."fullName" ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex} OR u."phoneNumber" ILIKE $${paramIndex})`;
      paramIndex++;
    }

    if (subscription === 'subscribed') {
      whereClause += ` AND u."subscriptionLevel" IS NOT NULL AND u."subscriptionLevel" NOT IN ('free', 'monthly_plan_unlimited')`;
    } else if (subscription === 'free') {
      whereClause += ` AND (u."subscriptionLevel" IS NULL OR u."subscriptionLevel" IN ('free', 'monthly_plan_unlimited'))`;
    }

    if (hasStore && !search) {
      whereClause += ` AND EXISTS (SELECT 1 FROM stores s WHERE s."brandId"::text = b.id::text AND s."deleteTimestamp" IS NULL)`;
    }

    const [brands, total] = await Promise.all([
      query(`
        SELECT
          b.id as "brandId",
          CASE WHEN b.name IS NULL THEN NULL
            WHEN LOWER(b.name) = 'my default brand'
            THEN COALESCE((SELECT s.name FROM stores s WHERE s."brandId"::text = b.id::text AND s."deleteTimestamp" IS NULL LIMIT 1), b.name)
            ELSE b.name
          END as "brandName",
          b."isActive",
          b."createTimestamp" as "brandCreatedAt",
          u.id as "userId",
          u."fullName",
          u.email,
          u."phoneNumber",
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
          bb.balance,
          (SELECT COUNT(*) FROM user_brands ub2 WHERE ub2."userId"::text = u.id::text AND ub2.role = 'owner') as "brandCount"
        FROM users u
        LEFT JOIN user_brands ub ON ub."userId"::text = u.id::text AND ub.role = 'owner'
        LEFT JOIN brands b ON b.id = ub."brandId"
        LEFT JOIN "custom-plans" cp ON cp."userId"::text = u.id::text
        LEFT JOIN LATERAL (
          SELECT amount, "createTimestamp", "includedSubscriptionLevel", "unsubscribedAt"
          FROM "deposit-record"
          WHERE "userId"::text = u.id::text AND status = 'succeeded'
          ORDER BY "createTimestamp" DESC
          LIMIT 1
        ) latest_deposit ON true
        LEFT JOIN "brand-balance" bb ON bb."userid"::text = u.id::text AND LOWER(bb.currency) = 'twd'
        ${whereClause}
        ORDER BY u."createTimestamp" DESC
        LIMIT $1 OFFSET $2
      `, params),
      (() => {
        let countWhere = `WHERE 'brand' = ANY(u.roles)`;
        const countParams: any[] = [];
        let ci = 1;
        if (search) {
          countParams.push(`%${search}%`);
          countWhere += ` AND (COALESCE(b.name, '') ILIKE $${ci} OR u."fullName" ILIKE $${ci} OR u.email ILIKE $${ci} OR u."phoneNumber" ILIKE $${ci})`;
          ci++;
        }
        if (subscription === 'subscribed') {
          countWhere += ` AND u."subscriptionLevel" IS NOT NULL AND u."subscriptionLevel" NOT IN ('free', 'monthly_plan_unlimited')`;
        } else if (subscription === 'free') {
          countWhere += ` AND (u."subscriptionLevel" IS NULL OR u."subscriptionLevel" IN ('free', 'monthly_plan_unlimited'))`;
        }
        if (hasStore && !search) {
          countWhere += ` AND EXISTS (SELECT 1 FROM stores s WHERE s."brandId"::text = b.id::text AND s."deleteTimestamp" IS NULL)`;
        }
        return query(`
          SELECT COUNT(DISTINCT u.id) as count
          FROM users u
          LEFT JOIN user_brands ub ON ub."userId"::text = u.id::text AND ub.role = 'owner'
          LEFT JOIN brands b ON b.id = ub."brandId"
          ${countWhere}
        `, countParams);
      })(),
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
      JOIN brands b ON b.id = ub."brandId"
      WHERE EXISTS (SELECT 1 FROM stores s WHERE s."brandId"::text = b.id::text AND s."deleteTimestamp" IS NULL)
      GROUP BY u."subscriptionLevel"
      ORDER BY count DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Subscription stats error:', err);
    res.status(500).json({ error: 'Failed to fetch subscription stats' });
  }
});
