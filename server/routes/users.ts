import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db.js';

export const usersRoutes = Router();

// Create brand account: user + brand + store + user_brand + optional custom-plan
usersRoutes.post('/create', async (req, res) => {
  try {
    const {
      fullName,
      email,
      phoneNumber,
      password,
      brandName,
      storeName,
      subscriptionLevel,
      customPlan, // { limits, expiryDate, commissionRate }
    } = req.body;

    if (!password || (!email && !phoneNumber)) {
      return res.status(400).json({ error: 'Password and either email or phone required' });
    }

    // Check if user already exists
    if (email) {
      const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
      if (existing.rows.length > 0) {
        return res.status(409).json({ error: 'Email already registered' });
      }
    }
    if (phoneNumber) {
      const existing = await query('SELECT id FROM users WHERE "phoneNumber" = $1', [phoneNumber]);
      if (existing.rows.length > 0) {
        return res.status(409).json({ error: 'Phone number already registered' });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const subLevel = subscriptionLevel || 'free';

    // 1. Create user
    const userResult = await query(
      `INSERT INTO users ("fullName", email, "phoneNumber", password, "subscriptionLevel", roles, "isActive")
       VALUES ($1, $2, $3, $4, $5::users_subscriptionlevel_enum, '{brand}', true)
       RETURNING id`,
      [fullName || null, email || null, phoneNumber || null, hashedPassword, subLevel],
    );
    const userId = userResult.rows[0].id;

    // 2. Create brand
    const bName = brandName || storeName || 'My Default Brand';
    const brandResult = await query(
      `INSERT INTO brands (name, "isActive") VALUES ($1, true) RETURNING id`,
      [bName],
    );
    const brandId = brandResult.rows[0].id;

    // 3. Link user to brand
    await query(
      `INSERT INTO user_brands ("userId", "brandId", role, "isDefault") VALUES ($1, $2, 'owner', true)`,
      [userId, brandId],
    );

    // 4. Create store
    const sName = storeName || brandName || 'Default Store';
    await query(
      `INSERT INTO stores ("userId", name, country, about, "brandId") VALUES ($1, $2, 'TW', '', $3)`,
      [userId, sName, brandId],
    );

    // 5. Create custom plan if provided
    if (customPlan && customPlan.limits && Object.keys(customPlan.limits).length > 0) {
      await query(
        `INSERT INTO "custom-plans" ("userId", limits, "expiryDate", "commissionRate")
         VALUES ($1, $2, $3, $4)`,
        [
          userId,
          JSON.stringify(customPlan.limits),
          customPlan.expiryDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          customPlan.commissionRate || null,
        ],
      );
    }

    res.json({ success: true, userId, brandId });
  } catch (err) {
    console.error('Create account error:', err);
    res.status(500).json({ error: 'Failed to create account' });
  }
});
