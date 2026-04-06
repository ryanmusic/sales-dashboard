import { Router, Request, Response } from 'express';
import { query } from '../db.js';

export const campaignsRoutes = Router();

let campaignsInitCache: { data: any; ts: number } | null = null;
const CACHE_TTL = 30_000;

// Combined initial load
campaignsRoutes.get('/all', async (_req, res) => {
  try {
    if (campaignsInitCache && Date.now() - campaignsInitCache.ts < CACHE_TTL) {
      return res.json(campaignsInitCache.data);
    }

    const [campaigns, stats, expiring] = await Promise.all([
      query(`
        SELECT
          ac.id,
          ac.title,
          ac.status,
          ac.slots,
          ac."currentSlots",
          ac."startTimestamp",
          ac."endTimestamp",
          ac."createTimestamp",
          ac."reqBudgetPerPost",
          ac."paymentType",
          ac."currencyCode",
          ac."invitationMsg",
          ac.requirement,
          ac."missionReq",
          ac."productExchangeDescription",
          ac."requiredHashtags",
          ac."acceptedPlatforms",
          ac."isFreeProductIncluded",
          ac."freeProductValue",
          s.name as "storeName",
          b.name as "brandName",
          u."fullName" as "ownerName",
          u.email as "ownerEmail",
          u."phoneNumber" as "ownerPhone",
          (SELECT COUNT(*) FROM "cc-slot-reservations" r WHERE r."callCardId" = ac.id) as "reservationCount"
        FROM "attention-cards" ac
        JOIN stores s ON s.id = ac."storeId"
        LEFT JOIN brands b ON b.id::text = s."brandId"::text
        LEFT JOIN user_brands ub ON ub."brandId" = b.id AND ub.role = 'owner'
        LEFT JOIN users u ON u.id::text = ub."userId"::text
        ORDER BY ac."createTimestamp" DESC
        LIMIT 50
      `),
      query(`
        SELECT status, COUNT(*) as count
        FROM "attention-cards"
        GROUP BY status
        ORDER BY count DESC
      `),
      query(`
        SELECT
          ac.id,
          ac.title,
          ac.status,
          ac.slots,
          ac."currentSlots",
          ac."endTimestamp",
          ac."invitationMsg",
          ac.requirement,
          ac."missionReq",
          ac."productExchangeDescription",
          ac."requiredHashtags",
          ac."acceptedPlatforms",
          ac."isFreeProductIncluded",
          ac."freeProductValue",
          s.name as "storeName",
          b.name as "brandName",
          u."fullName" as "ownerName",
          u.email as "ownerEmail",
          u."phoneNumber" as "ownerPhone",
          (SELECT COUNT(*) FROM "cc-slot-reservations" r WHERE r."callCardId" = ac.id) as "reservationCount"
        FROM "attention-cards" ac
        JOIN stores s ON s.id = ac."storeId"
        LEFT JOIN brands b ON b.id::text = s."brandId"::text
        LEFT JOIN user_brands ub ON ub."brandId" = b.id AND ub.role = 'owner'
        LEFT JOIN users u ON u.id::text = ub."userId"::text
        WHERE ac.status = 'active'
          AND ac."endTimestamp" IS NOT NULL
          AND ac."endTimestamp" >= NOW() - INTERVAL '7 days'
          AND ac."endTimestamp" <= NOW() + INTERVAL '14 days'
        ORDER BY ac."endTimestamp" ASC
        LIMIT 20
      `),
    ]);

    const data = {
      campaigns: campaigns.rows,
      total: stats.rows.reduce((sum: number, r: any) => sum + parseInt(r.count), 0),
      stats: stats.rows,
      expiring: expiring.rows,
    };

    campaignsInitCache = { data, ts: Date.now() };
    res.json(data);
  } catch (err) {
    console.error('Campaigns all error:', err);
    res.status(500).json({ error: 'Failed to fetch campaigns data' });
  }
});

// Paginated campaign list with filters
campaignsRoutes.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;
    const search = req.query.search as string;
    const status = req.query.status as string;

    let whereClause = 'WHERE 1=1';
    const params: any[] = [limit, offset];
    let paramIndex = 3;

    if (search) {
      params.push(`%${search}%`);
      whereClause += ` AND (ac.title ILIKE $${paramIndex} OR s.name ILIKE $${paramIndex} OR b.name ILIKE $${paramIndex} OR u."fullName" ILIKE $${paramIndex})`;
      paramIndex++;
    }

    if (status) {
      params.push(status);
      whereClause += ` AND ac.status = $${paramIndex}`;
      paramIndex++;
    }

    const [campaigns, total] = await Promise.all([
      query(`
        SELECT
          ac.id,
          ac.title,
          ac.status,
          ac.slots,
          ac."currentSlots",
          ac."startTimestamp",
          ac."endTimestamp",
          ac."createTimestamp",
          ac."reqBudgetPerPost",
          ac."paymentType",
          ac."currencyCode",
          ac."invitationMsg",
          ac.requirement,
          ac."missionReq",
          ac."productExchangeDescription",
          ac."requiredHashtags",
          ac."acceptedPlatforms",
          ac."isFreeProductIncluded",
          ac."freeProductValue",
          s.name as "storeName",
          b.name as "brandName",
          u."fullName" as "ownerName",
          u.email as "ownerEmail",
          u."phoneNumber" as "ownerPhone",
          (SELECT COUNT(*) FROM "cc-slot-reservations" r WHERE r."callCardId" = ac.id) as "reservationCount"
        FROM "attention-cards" ac
        JOIN stores s ON s.id = ac."storeId"
        LEFT JOIN brands b ON b.id::text = s."brandId"::text
        LEFT JOIN user_brands ub ON ub."brandId" = b.id AND ub.role = 'owner'
        LEFT JOIN users u ON u.id::text = ub."userId"::text
        ${whereClause}
        ORDER BY ac."createTimestamp" DESC
        LIMIT $1 OFFSET $2
      `, params),
      (() => {
        let countWhere = 'WHERE 1=1';
        const countParams: any[] = [];
        let ci = 1;
        if (search) {
          countParams.push(`%${search}%`);
          countWhere += ` AND (ac.title ILIKE $${ci} OR s.name ILIKE $${ci} OR b.name ILIKE $${ci} OR u."fullName" ILIKE $${ci})`;
          ci++;
        }
        if (status) {
          countParams.push(status);
          countWhere += ` AND ac.status = $${ci}`;
          ci++;
        }
        return query(`
          SELECT COUNT(*) as count
          FROM "attention-cards" ac
          JOIN stores s ON s.id = ac."storeId"
          LEFT JOIN brands b ON b.id::text = s."brandId"::text
          LEFT JOIN user_brands ub ON ub."brandId" = b.id AND ub.role = 'owner'
          LEFT JOIN users u ON u.id::text = ub."userId"::text
          ${countWhere}
        `, countParams);
      })(),
    ]);

    res.json({
      campaigns: campaigns.rows,
      total: parseInt(total.rows[0].count),
      page,
      limit,
    });
  } catch (err) {
    console.error('Campaigns error:', err);
    res.status(500).json({ error: 'Failed to fetch campaigns' });
  }
});

// Get reservations for a specific campaign
campaignsRoutes.get('/:id/reservations', async (req: Request, res: Response) => {
  try {
    const result = await query(`
      SELECT
        r.id,
        r.status,
        r."createTimestamp",
        r."expireTimestamp",
        r."redeemedTimestamp",
        r."cancelTimestamp",
        r."approvedAt",
        r."usedAt",
        r."extendedCount",
        r.comment,
        r."violationCount",
        r."playerId",
        u."fullName" as "creatorName",
        u.email as "creatorEmail",
        u."phoneNumber" as "creatorPhone",
        (SELECT sa.profile->>'username' FROM "social-accounts" sa WHERE sa."userId"::text = r."playerId"::text AND sa.platform = 'Instagram' LIMIT 1) as "igUsername",
        ps.status as "submissionStatus",
        ps."postSnapshot"->>'like_count' as "postLikes",
        ps."postSnapshot"->>'view_count' as "postViews",
        p."contentObj"->>'url' as "postUrl"
      FROM "cc-slot-reservations" r
      JOIN users u ON u.id::text = r."playerId"::text
      LEFT JOIN "post-submissions" ps ON ps."callCardId" = r."callCardId" AND ps."playerId"::text = r."playerId"::text AND ps.status = 'accepted'
      LEFT JOIN posts p ON p.id = ps."postId"
      WHERE r."callCardId" = $1
      ORDER BY r."createTimestamp" DESC
    `, [req.params.id]);

    res.json(result.rows);
  } catch (err) {
    console.error('Reservations error:', err);
    res.status(500).json({ error: 'Failed to fetch reservations' });
  }
});

// Update campaign end date and/or status
campaignsRoutes.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { endTimestamp, status } = req.body;
    if (!endTimestamp && !status) {
      return res.status(400).json({ error: 'endTimestamp or status is required' });
    }

    const sets: string[] = ['"updateTimestamp" = NOW()'];
    const params: any[] = [];
    let i = 1;
    if (endTimestamp) {
      sets.push(`"endTimestamp" = $${i++}`);
      params.push(endTimestamp);
    }
    if (status) {
      sets.push(`status = $${i++}`);
      params.push(status);
    }
    params.push(req.params.id);

    const result = await query(`
      UPDATE "attention-cards"
      SET ${sets.join(', ')}
      WHERE id = $${i++}
      RETURNING id, "endTimestamp", status
    `, params);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    // Invalidate cache
    campaignsInitCache = null;

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update campaign error:', err);
    res.status(500).json({ error: 'Failed to update campaign' });
  }
});

// Update reservation expiry and/or status
campaignsRoutes.patch('/:campaignId/reservations/:reservationId', async (req: Request, res: Response) => {
  try {
    const { expireTimestamp, status } = req.body;
    if (!expireTimestamp && !status) {
      return res.status(400).json({ error: 'expireTimestamp or status is required' });
    }

    const campaignId = req.params.campaignId;
    const reservationId = req.params.reservationId;

    // If reactivating (changing to booked from expired/canceled/rejected), check slot availability
    if (status && (status === 'booked' || status === 'pending')) {
      // Get current reservation status
      const current = await query(
        `SELECT status FROM "cc-slot-reservations" WHERE id = $1 AND "callCardId" = $2`,
        [reservationId, campaignId],
      );
      if (current.rows.length === 0) {
        return res.status(404).json({ error: 'Reservation not found' });
      }
      const oldStatus = current.rows[0].status;
      // If changing from a non-active status to active, check slots
      if (oldStatus === 'expired' || oldStatus === 'canceled' || oldStatus === 'rejected') {
        const campaign = await query(
          `SELECT slots, "currentSlots" FROM "attention-cards" WHERE id = $1`,
          [campaignId],
        );
        if (campaign.rows.length === 0) {
          return res.status(404).json({ error: 'Campaign not found' });
        }
        const { currentSlots } = campaign.rows[0];
        if (currentSlots <= 0) {
          return res.status(409).json({ error: 'No slots available' });
        }
      }
    }

    // Build dynamic update
    const sets: string[] = ['\"updateTimestamp\" = NOW()'];
    const params: any[] = [];
    let i = 1;
    if (expireTimestamp) {
      sets.push(`"expireTimestamp" = $${i++}`);
      params.push(expireTimestamp);
    }
    if (status) {
      sets.push(`"status" = $${i++}`);
      params.push(status);
    }
    params.push(reservationId, campaignId);

    const result = await query(`
      UPDATE "cc-slot-reservations"
      SET ${sets.join(', ')}
      WHERE id = $${i++} AND "callCardId" = $${i++}
      RETURNING id, "expireTimestamp", status
    `, params);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Reservation not found' });
    }

    // If status changed to/from active, update currentSlots on the campaign
    if (status) {
      // Recalculate currentSlots = slots - active reservations count
      await query(`
        UPDATE "attention-cards"
        SET "currentSlots" = slots - (
          SELECT COUNT(*) FROM "cc-slot-reservations"
          WHERE "callCardId" = $1 AND status IN ('booked', 'boooked', 'pending', 'used')
        )
        WHERE id = $1
      `, [campaignId]);
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update reservation error:', err);
    res.status(500).json({ error: 'Failed to update reservation' });
  }
});
