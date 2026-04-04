import { Router } from 'express';
import { query } from '../db.js';

export const vipRoutes = Router();

let vipCache: { data: any; ts: number } | null = null;
const CACHE_TTL = 60_000; // 1 min

vipRoutes.get('/scoring', async (_req, res) => {
  try {
    if (vipCache && Date.now() - vipCache.ts < CACHE_TTL) {
      return res.json(vipCache.data);
    }

    const result = await query(`
      WITH brand_users AS (
        SELECT DISTINCT ON (u.id)
          u.id as "userId",
          u."fullName",
          u.email,
          u."phoneNumber",
          u."subscriptionLevel",
          u."updateTimestamp" as "lastActive",
          b.id as "brandId",
          CASE WHEN LOWER(b.name) = 'my default brand'
            THEN COALESCE((SELECT s.name FROM stores s WHERE s."brandId"::text = b.id::text AND s."deleteTimestamp" IS NULL LIMIT 1), b.name)
            ELSE b.name
          END as "brandName",
          b."createTimestamp" as "brandCreatedAt"
        FROM users u
        JOIN user_brands ub ON ub."userId"::text = u.id::text AND ub.role = 'owner'
        JOIN brands b ON b.id = ub."brandId"
        WHERE EXISTS (SELECT 1 FROM stores s WHERE s."brandId"::text = b.id::text AND s."deleteTimestamp" IS NULL)
          AND u.email NOT ILIKE '%tellitapp.ai'
          AND 'brand' = ANY(u.roles)
        ORDER BY u.id, b."createTimestamp" DESC
      )
      SELECT
        bu.*,
        COALESCE(spend_3m.total, 0) as "spend3m",
        COALESCE(spend_year.total, 0) as "spendYear",
        COALESCE(spend_year.monthly_avg, 0) as "monthlyAvg",
        COALESCE(activity.active_months, 0) as "activeMonths",
        COALESCE(tasks.task_count, 0) as "taskCount",
        COALESCE(this_q.revenue, 0)::numeric as "thisQuarterRev",
        COALESCE(last_q.revenue, 0)::numeric as "lastQuarterRev",
        last_card."lastCardDate",
        last_reservation."lastCreatorDate",
        cp."expiryDate" as "planExpiry",
        bb.balance
      FROM brand_users bu
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(amount::numeric), 0) as total
        FROM "deposit-record" d
        WHERE d."userId"::text = bu."userId"::text AND d.status = 'succeeded'
          AND d."createTimestamp" >= NOW() - INTERVAL '3 months'
      ) spend_3m ON true
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(amount::numeric), 0) as total,
               COALESCE(SUM(amount::numeric) / GREATEST(EXTRACT(EPOCH FROM (NOW() - MIN(d."createTimestamp"))) / 2592000, 1), 0) as monthly_avg
        FROM "deposit-record" d
        WHERE d."userId"::text = bu."userId"::text AND d.status = 'succeeded'
          AND d."createTimestamp" >= NOW() - INTERVAL '12 months'
      ) spend_year ON true
      LEFT JOIN LATERAL (
        SELECT COUNT(DISTINCT to_char(ac."createTimestamp", 'YYYY-MM')) as active_months
        FROM "attention-cards" ac
        JOIN stores s ON s.id = ac."storeId" AND s."brandId"::text = bu."brandId"::text
        WHERE ac."createTimestamp" >= NOW() - INTERVAL '3 months'
      ) activity ON true
      LEFT JOIN LATERAL (
        SELECT COUNT(*) as task_count
        FROM "attention-cards" ac
        JOIN stores s ON s.id = ac."storeId" AND s."brandId"::text = bu."brandId"::text
        WHERE ac."createTimestamp" >= NOW() - INTERVAL '3 months'
      ) tasks ON true
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(amount::numeric), 0) as revenue
        FROM "deposit-record" d
        WHERE d."userId"::text = bu."userId"::text AND d.status = 'succeeded'
          AND d."createTimestamp" >= date_trunc('quarter', NOW())
      ) this_q ON true
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(amount::numeric), 0) as revenue
        FROM "deposit-record" d
        WHERE d."userId"::text = bu."userId"::text AND d.status = 'succeeded'
          AND d."createTimestamp" >= date_trunc('quarter', NOW()) - INTERVAL '3 months'
          AND d."createTimestamp" < date_trunc('quarter', NOW())
      ) last_q ON true
      LEFT JOIN LATERAL (
        SELECT MAX(ac."createTimestamp") as "lastCardDate"
        FROM "attention-cards" ac
        JOIN stores s ON s.id = ac."storeId" AND s."brandId"::text = bu."brandId"::text
      ) last_card ON true
      LEFT JOIN LATERAL (
        SELECT MAX(r."createTimestamp") as "lastCreatorDate"
        FROM "cc-slot-reservations" r
        JOIN "attention-cards" ac ON ac.id = r."callCardId"
        JOIN stores s ON s.id = ac."storeId" AND s."brandId"::text = bu."brandId"::text
        WHERE r.status IN ('booked', 'boooked', 'pending', 'used')
      ) last_reservation ON true
      LEFT JOIN "custom-plans" cp ON cp."userId"::text = bu."userId"::text
      LEFT JOIN "brand-balance" bb ON bb."userid"::text = bu."userId"::text AND LOWER(bb.currency) = 'twd'
      ORDER BY spend_3m.total DESC
    `);

    // Compute VIP scores in JS
    const customers = result.rows.map((r: any) => {
      const spend3m = parseFloat(r.spend3m) || 0;
      const spendYear = parseFloat(r.spendYear) || 0;
      const monthlyAvg = parseFloat(r.monthlyAvg) || 0;
      const activeMonths = parseInt(r.activeMonths) || 0;
      const taskCount = parseInt(r.taskCount) || 0;
      const thisQ = parseFloat(r.thisQuarterRev) || 0;
      const lastQ = parseFloat(r.lastQuarterRev) || 0;

      // Score components
      const scoreSpend = Math.min(100, Math.log(1 + spend3m) / Math.log(1 + 50000) * 100);
      const scoreActive = activeMonths === 0 ? 0 : activeMonths === 1 ? 33 : activeMonths === 2 ? 66 : 100;
      const scoreTasks = Math.min(100, taskCount / 10 * 100);

      let scoreGrowth = 50; // default: no change
      if (lastQ > 0) {
        const growthRate = (thisQ - lastQ) / lastQ;
        if (growthRate <= -0.5) scoreGrowth = 0;
        else if (growthRate <= 0) scoreGrowth = 50 + growthRate * 100; // -50%→0, 0%→50
        else if (growthRate <= 1) scoreGrowth = 50 + growthRate * 40; // 0%→50, 100%→90
        else scoreGrowth = Math.min(100, 90 + (growthRate - 1) * 10); // 100%→90, 200%→100
      } else if (thisQ > 0) {
        scoreGrowth = 80; // new spender
      }

      const vipScore = Math.round(
        0.4 * scoreSpend + 0.25 * scoreActive + 0.2 * scoreTasks + 0.15 * scoreGrowth,
      );

      // Tier assignment
      let tier: string;
      const sub = r.subscriptionLevel || 'free';
      if (spendYear >= 500000 || monthlyAvg >= 50000) {
        tier = 'strategic';
      } else if (
        (sub.includes('enterprise') && vipScore >= 85) ||
        (sub.includes('advanced') && vipScore >= 75) ||
        (sub.includes('standard') && vipScore >= 85) // basic high performer
      ) {
        tier = 'strategic';
      } else if (
        (sub.includes('advanced') && vipScore >= 60) ||
        (sub.includes('standard') && vipScore >= 75) ||
        vipScore >= 75
      ) {
        tier = 'growth';
      } else if (sub === 'free' && spend3m === 0) {
        tier = 'free';
      } else {
        tier = 'transactional';
      }

      // At risk detection
      const now = Date.now();
      const lastCardMs = r.lastCardDate ? new Date(r.lastCardDate).getTime() : 0;
      const lastCreatorMs = r.lastCreatorDate ? new Date(r.lastCreatorDate).getTime() : 0;
      const daysSinceCard = lastCardMs ? Math.floor((now - lastCardMs) / 86400000) : 999;
      const daysSinceCreator = lastCreatorMs ? Math.floor((now - lastCreatorMs) / 86400000) : 999;

      const thresholds: Record<string, number> = { strategic: 90, growth: 60, transactional: 30, free: 999 };
      const threshold = thresholds[tier] || 30;
      const atRisk = daysSinceCard >= threshold && daysSinceCreator >= threshold && tier !== 'free';
      const inactiveDays = Math.min(daysSinceCard, daysSinceCreator);

      return {
        ...r,
        spend3m,
        spendYear,
        monthlyAvg: Math.round(monthlyAvg),
        scoreSpend: Math.round(scoreSpend),
        scoreActive,
        scoreTasks: Math.round(scoreTasks),
        scoreGrowth: Math.round(scoreGrowth),
        vipScore,
        tier,
        atRisk,
        inactiveDays: inactiveDays === 999 ? null : inactiveDays,
      };
    });

    const tierCounts = { strategic: 0, growth: 0, transactional: 0, free: 0 };
    let atRiskCount = 0;
    customers.forEach((c: any) => {
      tierCounts[c.tier as keyof typeof tierCounts]++;
      if (c.atRisk) atRiskCount++;
    });

    const data = { customers, tierCounts, atRiskCount };
    vipCache = { data, ts: Date.now() };
    res.json(data);
  } catch (err) {
    console.error('VIP scoring error:', err);
    res.status(500).json({ error: 'Failed to compute VIP scoring' });
  }
});
