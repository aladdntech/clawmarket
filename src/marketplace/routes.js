const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../shared/auth');
const { NotFoundError, ValidationError } = require('../shared/errors');
const {
  createUser,
  getUser,
  createAgent,
  getAgent,
  createListing,
  getListing,
  updateListing,
  deleteListing,
} = require('./models');
const { searchListings, searchAgents, getCategories, getStats } = require('./search');
const { getCollection } = require('../shared/db');
const { validate, listingFilterSchema } = require('../shared/validators');

// Apply auth middleware to all routes
router.use(authMiddleware);

function haversineKm(lat1, lng1, lat2, lng2) {
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371; // km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function normalizeSearchQuery(req) {
  if (Object.prototype.hasOwnProperty.call(req.query, 'search') && typeof req.query.search !== 'string') {
    req.query.search = String(req.query.search);
  }
}

// ─── Users ──────────────────────────────────────────────────

// POST /api/users
router.post('/api/users', async (req, res, next) => {
  try {
    const user = await createUser(req.body);
    res.status(201).json(user);
  } catch (err) {
    next(err);
  }
});

// GET /api/users/:id
router.get('/api/users/:id', async (req, res, next) => {
  try {
    const user = await getUser(req.params.id);
    res.json(user);
  } catch (err) {
    next(err);
  }
});

// ─── Agents ─────────────────────────────────────────────────

// POST /api/agents
router.post('/api/agents', async (req, res, next) => {
  try {
    const agent = await createAgent(req.body);
    res.status(201).json(agent);
  } catch (err) {
    next(err);
  }
});

// GET /api/agents
router.get('/api/agents', async (req, res, next) => {
  try {
    normalizeSearchQuery(req);
    const { search, category, page, limit } = req.query;
    const result = await searchAgents({
      query: search,
      category,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/agents/:id
router.get('/api/agents/:id', async (req, res, next) => {
  try {
    const agent = await getAgent(req.params.id);
    // Also fetch agent's listings
    const listings = await getCollection('listings')
      .find({ agentId: agent._id.toString(), available: true })
      .sort({ createdAt: -1 })
      .toArray();
    res.json({ ...agent, listings });
  } catch (err) {
    next(err);
  }
});

// ─── Listings ───────────────────────────────────────────────

// POST /api/listings
router.post('/api/listings', async (req, res, next) => {
  try {
    // Auto-assign agentId from authenticated user if not provided
    if (!req.body.agentId && req.userId) {
      req.body.agentId = req.userId;
    }
    if (!req.body.agentId && req.apiKey) {
      req.body.agentId = req.apiKey;
    }
    if (!req.body.agentId) {
      req.body.agentId = 'anonymous';
    }
    const listing = await createListing(req.body);
    res.status(201).json(listing);
  } catch (err) {
    next(err);
  }
});

// GET /api/listings
router.get('/api/listings', async (req, res, next) => {
  try {
    normalizeSearchQuery(req);
    const params = validate(listingFilterSchema, req.query);
    const {
      search, category, type, condition,
      minPrice, maxPrice, deliveryType,
      country, city, shipsTo, nearby, radius,
      page, limit,
    } = params;

    const hasLocationFilters = !!(country || city || shipsTo || nearby || radius);

    if (!hasLocationFilters) {
      const result = await searchListings({
        query: search,
        category,
        type,
        condition,
        minPrice: minPrice !== undefined ? Number(minPrice) : undefined,
        maxPrice: maxPrice !== undefined ? Number(maxPrice) : undefined,
        deliveryType,
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
      });
      return res.json(result);
    }

    const filter = { available: true };
    if (search && typeof search === 'string') {
      filter.$text = { $search: search };
    }
    if (category) filter.category = category;
    if (type) filter.type = type;
    if (condition) filter.condition = condition;
    if (deliveryType) filter.deliveryType = deliveryType;
    if (minPrice !== undefined || maxPrice !== undefined) {
      filter['price.amount'] = {};
      if (minPrice !== undefined) filter['price.amount'].$gte = Number(minPrice);
      if (maxPrice !== undefined) filter['price.amount'].$lte = Number(maxPrice);
    }
    if (country) filter['location.country'] = country;
    if (city) filter['location.city'] = city;
    if (shipsTo) {
      filter['location.shipsTo'] = { $in: [shipsTo, shipsTo.toUpperCase(), 'worldwide', 'WORLDWIDE'] };
    }

    const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
    const safePage = Math.max(Number(page) || 1, 1);
    const skip = (safePage - 1) * safeLimit;

    const col = getCollection('listings');
    const sort = search ? { score: { $meta: 'textScore' } } : { createdAt: -1 };
    const projection = search ? { score: { $meta: 'textScore' } } : {};

    let listings = [];
    let total = 0;

    if (nearby) {
      const [latStr, lngStr] = nearby.split(',');
      const lat = Number(latStr);
      const lng = Number(lngStr);
      const kmRadius = Number(radius) || 50;

      const all = await col.find(filter, { projection }).sort(sort).toArray();
      const filtered = all.filter((listing) => {
        const coords = listing.location?.coordinates;
        if (!coords || typeof coords.lat !== 'number' || typeof coords.lng !== 'number') return false;
        const distance = haversineKm(lat, lng, coords.lat, coords.lng);
        return distance <= kmRadius;
      });

      total = filtered.length;
      listings = filtered.slice(skip, skip + safeLimit);
    } else {
      [listings, total] = await Promise.all([
        col.find(filter, { projection }).sort(sort).skip(skip).limit(safeLimit).toArray(),
        col.countDocuments(filter),
      ]);
    }

    res.json({
      listings,
      total,
      page: safePage,
      pages: Math.ceil(total / safeLimit) || 1,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/listings/:id
router.get('/api/listings/:id', async (req, res, next) => {
  try {
    const listing = await getListing(req.params.id);
    res.json(listing);
  } catch (err) {
    next(err);
  }
});

// PUT /api/listings/:id
router.put('/api/listings/:id', async (req, res, next) => {
  try {
    const listing = await updateListing(req.params.id, req.body);
    res.json(listing);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/listings/:id
router.delete('/api/listings/:id', async (req, res, next) => {
  try {
    const listing = await deleteListing(req.params.id);
    res.json({ message: 'Listing deleted', listing });
  } catch (err) {
    next(err);
  }
});

// ─── Categories & Stats ────────────────────────────────────

// GET /api/categories
router.get('/api/categories', async (req, res, next) => {
  try {
    const categories = await getCategories();
    res.json(categories);
  } catch (err) {
    next(err);
  }
});

// GET /api/stats
router.get('/api/stats', async (req, res, next) => {
  try {
    const stats = await getStats();
    res.json(stats);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
