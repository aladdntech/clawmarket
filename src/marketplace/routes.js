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

// Apply auth middleware to all routes
router.use(authMiddleware);

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
    const listing = await createListing(req.body);
    res.status(201).json(listing);
  } catch (err) {
    next(err);
  }
});

// GET /api/listings
router.get('/api/listings', async (req, res, next) => {
  try {
    const {
      search, category, type, condition,
      minPrice, maxPrice, deliveryType,
      page, limit,
    } = req.query;
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
    res.json(result);
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
