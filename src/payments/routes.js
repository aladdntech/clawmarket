// src/payments/routes.js — Express Router for payments & escrow API

const { Router } = require('express');
const { authMiddleware } = require('../shared/auth');
const { AppError, NotFoundError, ValidationError } = require('../shared/errors');
const { validate, createOrderSchema } = require('../shared/validators');
const config = require('../shared/config');
const escrow = require('./escrow');
const { getUSDTBalance } = require('./tron');
const { notifyOrderEvent } = require('../shared/notifications');

const router = Router();

// ─── Middleware ──────────────────────────────────────────────

router.use(authMiddleware);

// ─── Helper ─────────────────────────────────────────────────

function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// ─── Routes ─────────────────────────────────────────────────

/**
 * POST /api/orders — Create a new order
 */
router.post('/api/orders', asyncHandler(async (req, res) => {
  const data = validate(createOrderSchema, req.body);
  const buyerAgentId = data.buyerAgentId || req.apiKey || req.userId || 'anonymous';
  const order = await escrow.createOrder(
    data.listingId,
    buyerAgentId,
    data.quantity,
    data.shippingAddress || null
  );
  await notifyOrderEvent(order._id.toString(), 'order.created', {
    listingId: data.listingId
  });
  res.status(201).json({ success: true, order });
}));

/**
 * GET /api/orders/user/:userId — Get orders for a user
 * Query: ?role=buyer|seller
 * NOTE: This must be before /api/orders/:id to avoid "user" matching as :id
 */
router.get('/api/orders/user/:userId', asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const role = req.query.role || 'buyer';
  const orders = await escrow.getUserOrders(userId, role);
  res.json({ success: true, orders, count: orders.length });
}));

/**
 * GET /api/orders/:id — Get a single order
 */
router.get('/api/orders/:id', asyncHandler(async (req, res) => {
  const order = await escrow.getOrder(req.params.id);
  res.json({ success: true, order });
}));

/**
 * POST /api/orders/:id/verify — Verify payment on blockchain
 */
router.post('/api/orders/:id/verify', asyncHandler(async (req, res) => {
  const result = await escrow.verifyPayment(req.params.id);
  if (result.matched) {
    await notifyOrderEvent(result.order._id.toString(), 'order.paid', {
      txHash: result.order.escrow?.depositTxHash
    });
    res.json({ success: true, matched: true, order: result.order });
  } else {
    res.json({ success: true, matched: false, message: result.message, order: result.order });
  }
}));

/**
 * POST /api/orders/:id/ship — Mark order as shipped
 */
router.post('/api/orders/:id/ship', asyncHandler(async (req, res) => {
  const { carrier, trackingNumber } = req.body || {};
  const order = await escrow.markShipped(req.params.id, carrier, trackingNumber);
  await notifyOrderEvent(order._id.toString(), 'order.shipped', { carrier, trackingNumber });
  res.json({ success: true, order });
}));

/**
 * POST /api/orders/:id/deliver — Mark order as delivered
 */
router.post('/api/orders/:id/deliver', asyncHandler(async (req, res) => {
  const { proof } = req.body || {};
  const order = await escrow.markDelivered(req.params.id, proof);
  await notifyOrderEvent(order._id.toString(), 'order.delivered', { hasProof: !!proof });
  res.json({ success: true, order });
}));

/**
 * POST /api/orders/:id/confirm — Buyer confirms receipt (releases escrow)
 */
router.post('/api/orders/:id/confirm', asyncHandler(async (req, res) => {
  const order = await escrow.confirmReceipt(req.params.id);
  await notifyOrderEvent(order._id.toString(), 'order.completed', {});
  res.json({ success: true, order });
}));

/**
 * POST /api/orders/:id/dispute — Open a dispute
 */
router.post('/api/orders/:id/dispute', asyncHandler(async (req, res) => {
  const { reason, description } = req.body || {};
  const order = await escrow.openDispute(req.params.id, reason, description);
  await notifyOrderEvent(order._id.toString(), 'order.disputed', { reason, description });
  res.json({ success: true, order });
}));

/**
 * POST /api/orders/:id/refund — Refund an order
 */
router.post('/api/orders/:id/refund', asyncHandler(async (req, res) => {
  const order = await escrow.refundOrder(req.params.id);
  res.json({ success: true, order });
}));

/**
 * GET /api/wallet/balance — Get escrow wallet USDT balance
 */
router.get('/api/wallet/balance', asyncHandler(async (req, res) => {
  const address = config.tron.escrowAddress;
  const balance = await getUSDTBalance(address);
  res.json({
    success: true,
    address,
    balance,
    currency: 'USDT',
    network: 'TRON'
  });
}));

module.exports = router;
