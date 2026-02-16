// src/shared/notifications.js — event-driven order notifications

const { EventEmitter } = require('events');
const { ObjectId } = require('mongodb');
const { getCollection } = require('./db');
const { sendOrderUpdate } = require('./email');
const { logAudit } = require('./audit');

const emitter = new EventEmitter();

const ORDER_EVENTS = [
  'order.created',
  'order.paid',
  'order.shipped',
  'order.delivered',
  'order.completed',
  'order.disputed'
];

function toObjectId(id) {
  if (id instanceof ObjectId) return id;
  if (typeof id === 'string' && ObjectId.isValid(id)) return new ObjectId(id);
  return null;
}

function canEmail(user) {
  return !!(user && user.email && (user.notificationPrefs?.email !== false));
}

async function loadOrderContext(orderId) {
  const orders = getCollection('orders');
  const agents = getCollection('agents');
  const users = getCollection('users');

  const oid = toObjectId(orderId);
  if (!oid) return null;

  const order = await orders.findOne({ _id: oid });
  if (!order) return null;

  const buyerAgent = await agents.findOne({ _id: order.buyerAgentId });
  const sellerAgent = await agents.findOne({ _id: order.sellerAgentId });

  const buyerUser = buyerAgent ? await users.findOne({ _id: toObjectId(buyerAgent.userId) }) : null;
  const sellerUser = sellerAgent ? await users.findOne({ _id: toObjectId(sellerAgent.userId) }) : null;

  return { order, buyerUser, sellerUser };
}

async function handleOrderEvent(event, payload) {
  const { order, buyerUser, sellerUser, metadata } = payload;

  const baseData = {
    event,
    orderNumber: order.orderNumber,
    listingTitle: order.listing?.title,
    status: order.status,
    amount: order.escrow?.expectedAmount,
    currency: order.listing?.currency || 'USDT',
    trackingNumber: order.delivery?.trackingNumber,
    carrier: order.delivery?.carrier
  };

  if (canEmail(buyerUser)) {
    await sendOrderUpdate(buyerUser.email, {
      ...baseData,
      role: 'buyer',
      recipientName: buyerUser.name,
      metadata
    });
  }

  if (canEmail(sellerUser)) {
    await sendOrderUpdate(sellerUser.email, {
      ...baseData,
      role: 'seller',
      recipientName: sellerUser.name,
      metadata
    });
  }

  await logAudit(event, 'system', 'system', 'order', order._id.toString(), {
    metadata: metadata || null
  });
}

// Register listeners
ORDER_EVENTS.forEach((event) => {
  emitter.on(event, (payload) => {
    handleOrderEvent(event, payload).catch((err) => {
      console.error(`[NOTIFY] Failed to handle ${event}:`, err.message);
    });
  });
});

async function notifyOrderEvent(orderId, event, metadata = {}) {
  if (!ORDER_EVENTS.includes(event)) {
    console.warn('[NOTIFY] Unknown order event:', event);
    return { skipped: true };
  }

  try {
    const ctx = await loadOrderContext(orderId);
    if (!ctx) return { skipped: true };

    emitter.emit(event, {
      ...ctx,
      metadata
    });
    return { queued: true };
  } catch (err) {
    console.error('[NOTIFY] notifyOrderEvent failed:', err.message);
    return { error: err.message };
  }
}

module.exports = {
  notifyOrderEvent,
  ORDER_EVENTS
};
