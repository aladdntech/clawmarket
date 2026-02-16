// src/payments/routes.js — Express Router for payments & escrow API

const { Router } = require('express');
const { authMiddleware } = require('../shared/auth');
const { AppError, NotFoundError, ValidationError } = require('../shared/errors');
const { validate, createOrderSchema } = require('../shared/validators');
const { getCollection } = require('../shared/db');
const config = require('../shared/config');
const escrow = require('./escrow');
const { getUSDTBalance } = require('./tron');
const { notifyOrderEvent } = require('../shared/notifications');
const { generatePaymentQR, generateAddressQR, buildTronUri } = require('./qr');

const router = Router();

// ─── Helper ─────────────────────────────────────────────────

function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

async function buildPaymentOptions(order) {
  const address = config.tron.escrowAddress;
  const amountValue = order?.escrow?.expectedAmount ?? order?.escrow?.totalAmount ?? 0;
  const amount = typeof amountValue === 'number' ? amountValue.toFixed(2) : String(amountValue);
  const qrData = buildTronUri(address, amount, 'USDT');
  const qrCode = await generatePaymentQR(address, amount, 'TRON (TRC20)');
  const addressQrCode = await generateAddressQR(address);

  return {
    paymentOptions: [
      {
        network: 'TRON (TRC20)',
        currency: 'USDT',
        address,
        amount,
        qrData,
        qrCode,
        addressQrCode,
        note: `Send exactly ${amount} USDT on the TRON (TRC20) network. Do NOT use other networks.`
      },
      {
        network: 'Bitcoin (BTC)',
        currency: 'BTC',
        address: null,
        note: 'Bitcoin payments coming soon. Contact support if you need BTC payment.'
      },
      {
        network: 'Ethereum (ERC20)',
        currency: 'USDT',
        address: null,
        note: 'ERC20 payments coming soon. TRON (TRC20) is recommended for lowest fees.'
      },
      {
        network: 'Credit/Debit Card',
        currency: 'USD',
        note: 'Buy USDT on an exchange (Binance, Coinbase, etc.) and send to the TRON address above. This takes ~10 minutes for first-time users.'
      }
    ],
    preferredNetwork: 'TRON (TRC20)',
    warnings: [
      '⚠️ Always verify the network before sending. Sending on wrong network = lost funds.',
      '⚠️ Send the EXACT amount shown. Extra or missing amounts delay processing.'
    ]
  };
}

// ─── Routes ─────────────────────────────────────────────────

/**
 * GET /api/payments/options/:orderId — Public payment options for an order
 */
router.get('/api/payments/options/:orderId', asyncHandler(async (req, res) => {
  const order = await escrow.getOrder(req.params.orderId);
  const paymentOptions = await buildPaymentOptions(order);
  res.json({ success: true, orderId: order._id.toString(), ...paymentOptions });
}));

// ─── Middleware ──────────────────────────────────────────────

router.use(authMiddleware);

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

  const defaultShipping = {
    method: null,
    trackingNumber: null,
    carrier: null,
    shippedAt: null,
    estimatedDelivery: null
  };

  await getCollection('orders').updateOne(
    { _id: order._id },
    { $set: { shipping: defaultShipping } }
  );
  order.shipping = defaultShipping;

  await notifyOrderEvent(order._id.toString(), 'order.created', {
    listingId: data.listingId
  });
  const paymentOptions = await buildPaymentOptions(order);
  res.status(201).json({ success: true, order, paymentOptions });
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
  const { carrier, trackingNumber, method, estimatedDelivery } = req.body || {};
  const order = await escrow.markShipped(req.params.id, carrier, trackingNumber);

  const shippingUpdate = {
    method: method || null,
    trackingNumber: trackingNumber || null,
    carrier: carrier || null,
    shippedAt: new Date(),
    estimatedDelivery: estimatedDelivery ? new Date(estimatedDelivery) : null
  };

  await getCollection('orders').updateOne(
    { _id: order._id },
    { $set: { shipping: shippingUpdate } }
  );
  order.shipping = shippingUpdate;

  await notifyOrderEvent(order._id.toString(), 'order.shipped', { carrier, trackingNumber, method, estimatedDelivery });
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
 * POST /api/orders/:id/delivered — Buyer confirms delivery (or auto-confirm)
 */
router.post('/api/orders/:id/delivered', asyncHandler(async (req, res) => {
  const { proof } = req.body || {};
  let order = await escrow.markDelivered(req.params.id, proof);
  await notifyOrderEvent(order._id.toString(), 'order.delivered', { hasProof: !!proof });

  const estimated = order.shipping?.estimatedDelivery ? new Date(order.shipping.estimatedDelivery) : null;
  if (estimated) {
    const autoConfirmAt = new Date(estimated);
    autoConfirmAt.setDate(autoConfirmAt.getDate() + 3);
    if (new Date() >= autoConfirmAt) {
      order = await escrow.confirmReceipt(req.params.id);
      await notifyOrderEvent(order._id.toString(), 'order.completed', { autoConfirmed: true });
    }
  }

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
