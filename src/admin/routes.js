const express = require('express');
const { ObjectId } = require('mongodb');
const { getCollection } = require('../shared/db');
const { getRedis } = require('../shared/redis');
const { resolveUser } = require('../shared/auth');

const router = express.Router();

async function adminAuth(req, res, next) {
  const adminKey = process.env.ADMIN_API_KEY;
  const authHeader = req.headers['authorization'];
  const bearer = authHeader?.startsWith('Bearer ') ? authHeader.replace('Bearer ', '') : null;
  const headerKey = req.headers['x-admin-api-key'];
  const provided = headerKey || bearer;

  if (adminKey && provided === adminKey) return next();

  if (req.user && req.user.role === 'admin') return next();

  return res.status(403).json({
    error: 'Admin access required',
    code: 'ADMIN_ONLY'
  });
}

router.use(resolveUser, adminAuth);

// GET /api/admin/stats
router.get('/stats', async (req, res, next) => {
  try {
    const users = await getCollection('users').countDocuments();
    const agents = await getCollection('agents').countDocuments();
    const listings = await getCollection('listings').countDocuments();
    const orders = await getCollection('orders').countDocuments();

    const revenueAgg = await getCollection('orders').aggregate([
      { $match: { 'escrow.fee': { $exists: true } } },
      { $group: { _id: null, total: { $sum: '$escrow.fee' } } }
    ]).toArray();

    const revenue = revenueAgg[0]?.total || 0;

    res.json({ users, agents, listings, orders, revenue });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/users
router.get('/users', async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const search = req.query.search?.trim();

    const filter = {};
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    const cursor = getCollection('users')
      .find(filter)
      .project({ recoveryCodes: 0 })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const [items, total] = await Promise.all([
      cursor.toArray(),
      getCollection('users').countDocuments(filter)
    ]);

    res.json({
      page,
      limit,
      total,
      items
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/orders
router.get('/orders', async (req, res, next) => {
  try {
    const { status, startDate, endDate } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const orders = await getCollection('orders')
      .find(filter)
      .sort({ createdAt: -1 })
      .toArray();

    res.json({ count: orders.length, orders });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/audit
router.get('/audit', async (req, res, next) => {
  try {
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
    const logs = await getCollection('audit_log')
      .find({})
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();

    res.json({ count: logs.length, logs });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/users/:id/ban
router.post('/users/:id/ban', async (req, res, next) => {
  try {
    const userId = new ObjectId(req.params.id);
    await getCollection('users').updateOne(
      { _id: userId },
      { $set: { banned: true, updatedAt: new Date() } }
    );
    const user = await getCollection('users').findOne({ _id: userId }, { projection: { recoveryCodes: 0 } });
    res.json({ success: true, user });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/listings/:id/remove
router.post('/listings/:id/remove', async (req, res, next) => {
  try {
    const listingId = new ObjectId(req.params.id);
    await getCollection('listings').updateOne(
      { _id: listingId },
      { $set: { status: 'removed', available: false, updatedAt: new Date() } }
    );
    const listing = await getCollection('listings').findOne({ _id: listingId });
    res.json({ success: true, listing });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/health
router.get('/health', async (req, res, next) => {
  try {
    const db = getCollection('users').db;
    let dbStatus = 'ok';
    try {
      await db.command({ ping: 1 });
    } catch (err) {
      dbStatus = 'error';
    }

    let redisStatus = 'unknown';
    try {
      const redis = getRedis();
      if (typeof redis.ping === 'function') {
        await redis.ping();
        redisStatus = 'ok';
      } else {
        redisStatus = 'fallback';
      }
    } catch (err) {
      redisStatus = 'error';
    }

    res.json({
      status: 'ok',
      db: dbStatus,
      redis: redisStatus,
      uptime: Math.floor(process.uptime()),
      memory: process.memoryUsage()
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
