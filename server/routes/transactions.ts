import { Router, Request, Response } from 'express';
import { query } from '../db.js';

export const transactionsRoutes = Router();

// FamilyMart store userId
const FAMILYMART_PHONE = '+886988561717';

// List FamilyMart campaigns with reservation + submission stats
transactionsRoutes.get('/campaigns', async (_req, res) => {
  try {
    const result = await query(`
      SELECT
        ac.id,
        ac.title,
        ac.status,
        ac.slots,
        ac."currentSlots",
        ac."endTimestamp",
        s.name as "storeName"
      FROM "attention-cards" ac
      JOIN stores s ON s.id = ac."storeId"
      WHERE s."userId"::text = (SELECT id::text FROM users WHERE "phoneNumber" = $1 LIMIT 1)
      ORDER BY ac."createTimestamp" DESC
    `, [FAMILYMART_PHONE]);

    res.json(result.rows);
  } catch (err) {
    console.error('Bonus campaigns error:', err);
    res.status(500).json({ error: 'Failed to fetch campaigns' });
  }
});

// Get reservations with submission post stats for a campaign
transactionsRoutes.get('/campaigns/:id/reservations', async (req, res) => {
  try {
    const result = await query(`
      SELECT
        r.id,
        r.status,
        r."playerId",
        r."createTimestamp",
        r."redeemedTimestamp",
        u."fullName" as "creatorName",
        u.email as "creatorEmail",
        (SELECT sa.profile->>'username' FROM "social-accounts" sa WHERE sa."userId"::text = r."playerId"::text AND sa.platform = 'Instagram' AND sa."deletedAt" IS NULL LIMIT 1) as "igUsername",
        ps.id as "submissionId",
        ps.status as "submissionStatus",
        ps."postId",
        ps."postSnapshot"->>'view_count' as "viewCount",
        ps."postSnapshot"->>'like_count' as "likeCount",
        ps."postSnapshot"->>'comment_count' as "commentCount",
        ps."postSnapshot"->>'share_count' as "shareCount",
        p."contentObj"->>'url' as "postUrl"
      FROM "cc-slot-reservations" r
      JOIN users u ON u.id::text = r."playerId"::text
      LEFT JOIN "post-submissions" ps ON ps."callCardId" = r."callCardId" AND ps."playerId"::text = r."playerId"::text
      LEFT JOIN posts p ON p.id = ps."postId"
      WHERE r."callCardId" = $1
        AND r.status IN ('booked', 'boooked', 'pending', 'used')
      ORDER BY (ps."postSnapshot"->>'view_count')::int DESC NULLS LAST
    `, [req.params.id]);

    res.json(result.rows);
  } catch (err) {
    console.error('Bonus reservations error:', err);
    res.status(500).json({ error: 'Failed to fetch reservations' });
  }
});

// Proxy phyllo refresh for a single post
transactionsRoutes.post('/refresh-post/:postId', async (req: Request, res: Response) => {
  try {
    const postId = req.params.postId;
    // Call the backend API server to refresh phyllo
    const backendUrl = process.env.BACKEND_API_URL || 'http://localhost:3000';
    const response = await fetch(`${backendUrl}/api/v1/phyllo/contents/refresh-single?postId=${postId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(response.status).json({ error: err });
    }

    // After refresh, get updated post snapshot
    const updated = await query(`
      SELECT p."contentObj"->>'view_count' as "viewCount",
             p."contentObj"->>'like_count' as "likeCount",
             p."contentObj"->>'comment_count' as "commentCount",
             p."contentObj"->>'share_count' as "shareCount"
      FROM posts p WHERE p.id::text = $1
    `, [postId]);

    // Also update the post-submission snapshot
    if (updated.rows.length > 0) {
      const post = await query(`SELECT "contentObj" FROM posts WHERE id::text = $1`, [postId]);
      if (post.rows.length > 0) {
        const contentObj = post.rows[0].contentObj;
        const snapshot = {
          title: contentObj.title || '',
          like_count: contentObj.like_count || 0,
          view_count: contentObj.view_count || 0,
          share_count: contentObj.share_count || 0,
          comment_count: contentObj.comment_count || 0,
        };
        await query(`
          UPDATE "post-submissions" SET "postSnapshot" = $1, "updateTimestamp" = NOW()
          WHERE "postId"::text = $2
        `, [JSON.stringify(snapshot), postId]);
      }
    }

    res.json({ success: true, stats: updated.rows[0] || null });
  } catch (err) {
    console.error('Phyllo refresh error:', err);
    res.status(500).json({ error: 'Failed to refresh post' });
  }
});

// Refresh all submissions for a campaign
transactionsRoutes.post('/campaigns/:id/refresh-all', async (req: Request, res: Response) => {
  try {
    const campaignId = req.params.id;

    // Get all post IDs for this campaign's submissions
    const submissions = await query(`
      SELECT ps."postId"
      FROM "post-submissions" ps
      WHERE ps."callCardId" = $1 AND ps."postId" IS NOT NULL
    `, [campaignId]);

    const backendUrl = process.env.BACKEND_API_URL || 'http://localhost:3000';
    const results: any[] = [];

    for (const sub of submissions.rows) {
      try {
        await fetch(`${backendUrl}/api/v1/phyllo/contents/refresh-single?postId=${sub.postId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });

        // Update snapshot
        const post = await query(`SELECT "contentObj" FROM posts WHERE id::text = $1`, [sub.postId]);
        if (post.rows.length > 0) {
          const contentObj = post.rows[0].contentObj;
          const snapshot = {
            title: contentObj.title || '',
            like_count: contentObj.like_count || 0,
            view_count: contentObj.view_count || 0,
            share_count: contentObj.share_count || 0,
            comment_count: contentObj.comment_count || 0,
          };
          await query(`
            UPDATE "post-submissions" SET "postSnapshot" = $1, "updateTimestamp" = NOW()
            WHERE "postId"::text = $2
          `, [JSON.stringify(snapshot), sub.postId]);
        }

        results.push({ postId: sub.postId, success: true });
      } catch (err) {
        results.push({ postId: sub.postId, success: false });
      }
    }

    res.json({ refreshed: results.length, results });
  } catch (err) {
    console.error('Refresh all error:', err);
    res.status(500).json({ error: 'Failed to refresh campaign posts' });
  }
});

// Award bonus to selected creators
transactionsRoutes.post('/award', async (req: Request, res: Response) => {
  try {
    const { creatorIds, amount, description } = req.body;
    if (!creatorIds || !Array.isArray(creatorIds) || creatorIds.length === 0) {
      return res.status(400).json({ error: 'creatorIds array is required' });
    }
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Valid amount is required' });
    }

    const desc = description || '全家加碼冠軍獎金';
    const inserted: any[] = [];

    for (const userId of creatorIds) {
      const result = await query(`
        INSERT INTO transactions ("toId", amount, currency, type, description)
        VALUES ($1, $2, 'twd', 'reward', $3)
        RETURNING id, "toId", amount, description
      `, [userId, amount, desc]);
      inserted.push(result.rows[0]);
      // player-balance is a view computed from transactions — no UPDATE needed
    }

    res.json({ success: true, count: inserted.length, transactions: inserted });
  } catch (err) {
    console.error('Award bonus error:', err);
    res.status(500).json({ error: 'Failed to award bonus' });
  }
});
