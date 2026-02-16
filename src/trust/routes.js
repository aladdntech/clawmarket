const { Router } = require('express');
const { authMiddleware } = require('../shared/auth');
const { AppError } = require('../shared/errors');
const { openDispute, submitEvidence, getDispute, resolveDispute, aiMediate } = require('./disputes');
const { createReview, getAgentReviews, getAgentRating } = require('./ratings');
const { trackShipment, estimateDelivery } = require('./shipping');

const router = Router();

// ─── Helper: async route wrapper ────────────────────────────
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Get the agent ID from the request.
 * In a real app, authMiddleware would resolve the API key to an agent.
 * For now we accept it from the body or a header.
 */
function getAgentId(req) {
  return req.body?.agentId || req.headers['x-agent-id'] || null;
}

// ─── DISPUTES ───────────────────────────────────────────────

// POST /api/disputes — Open a dispute
router.post('/api/disputes', authMiddleware, asyncHandler(async (req, res) => {
  const { orderId, reason, description } = req.body;
  const raisedBy = getAgentId(req);

  if (!raisedBy) {
    return res.status(400).json({ error: 'agentId is required (body or x-agent-id header)', code: 'VALIDATION_ERROR' });
  }

  const dispute = await openDispute(orderId, raisedBy, reason, description);
  res.status(201).json(dispute);
}));

// GET /api/disputes/:id — Get dispute details
router.get('/api/disputes/:id', asyncHandler(async (req, res) => {
  const dispute = await getDispute(req.params.id);
  res.json(dispute);
}));

// POST /api/disputes/:id/evidence — Submit evidence
router.post('/api/disputes/:id/evidence', authMiddleware, asyncHandler(async (req, res) => {
  const { type, url, description } = req.body;
  const submittedBy = getAgentId(req);

  if (!submittedBy) {
    return res.status(400).json({ error: 'agentId is required (body or x-agent-id header)', code: 'VALIDATION_ERROR' });
  }

  const evidence = await submitEvidence(req.params.id, submittedBy, type, url, description);
  res.status(201).json(evidence);
}));

// POST /api/disputes/:id/mediate — AI mediation (suggest only)
router.post('/api/disputes/:id/mediate', authMiddleware, asyncHandler(async (req, res) => {
  const result = await aiMediate(req.params.id);
  res.json(result);
}));

// POST /api/disputes/:id/resolve — Resolve dispute
router.post('/api/disputes/:id/resolve', authMiddleware, asyncHandler(async (req, res) => {
  const { outcome, reason } = req.body;
  const resolvedBy = getAgentId(req);

  if (!resolvedBy) {
    return res.status(400).json({ error: 'agentId is required (body or x-agent-id header)', code: 'VALIDATION_ERROR' });
  }

  const result = await resolveDispute(req.params.id, outcome, reason, resolvedBy);
  res.json(result);
}));

// ─── REVIEWS ────────────────────────────────────────────────

// POST /api/reviews — Create a review
router.post('/api/reviews', authMiddleware, asyncHandler(async (req, res) => {
  const { orderId, rating, comment } = req.body;
  const reviewerId = getAgentId(req);

  if (!reviewerId) {
    return res.status(400).json({ error: 'agentId is required (body or x-agent-id header)', code: 'VALIDATION_ERROR' });
  }

  const review = await createReview(orderId, reviewerId, rating, comment);
  res.status(201).json(review);
}));

// GET /api/reviews/agent/:agentId — Get reviews for an agent
router.get('/api/reviews/agent/:agentId', asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const result = await getAgentReviews(req.params.agentId, page, limit);
  res.json(result);
}));

// ─── SHIPPING ───────────────────────────────────────────────

// GET /api/shipping/track/:carrier/:tracking — Track a shipment
router.get('/api/shipping/track/:carrier/:tracking', asyncHandler(async (req, res) => {
  const result = trackShipment(req.params.carrier, req.params.tracking);
  res.json(result);
}));

// GET /api/shipping/estimate — Estimate delivery time
router.get('/api/shipping/estimate', asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const result = estimateDelivery(from, to);
  res.json(result);
}));

module.exports = router;
