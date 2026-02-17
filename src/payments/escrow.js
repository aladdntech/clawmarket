// src/payments/escrow.js — Escrow state machine for ClawMarket orders

const { ObjectId } = require('mongodb');
const { getCollection } = require('../shared/db');
const { NotFoundError, ValidationError, AppError } = require('../shared/errors');
const { logAudit } = require('../shared/audit');
const config = require('../shared/config');
const { calculateFee, generateOrderNumber } = require('./fees');
const { checkIncomingUSDT, sendUSDT } = require('./tron');

// ─── Valid state transitions ────────────────────────────────

const VALID_TRANSITIONS = {
  pending_payment:  ['escrow_funded', 'cancelled', 'refunded'],
  escrow_funded:    ['processing', 'shipped', 'disputed', 'refunded'],
  processing:       ['shipped', 'disputed', 'refunded'],
  shipped:          ['delivered', 'disputed'],
  delivered:        ['completed', 'disputed'],
  completed:        [],       // terminal
  refunded:         [],       // terminal
  cancelled:        [],       // terminal
  disputed:         ['refunded', 'completed'] // resolved by admin
};

function assertTransition(currentStatus, targetStatus) {
  const allowed = VALID_TRANSITIONS[currentStatus];
  if (!allowed || !allowed.includes(targetStatus)) {
    throw new ValidationError(
      `Invalid state transition: "${currentStatus}" → "${targetStatus}"`
    );
  }
}

function toObjectId(id) {
  if (id instanceof ObjectId) return id;
  if (typeof id === 'string' && ObjectId.isValid(id)) return new ObjectId(id);
  throw new ValidationError(`Invalid ID: ${id}`);
}

function timelineEntry(event, by, details = {}) {
  return { event, at: new Date(), by, details };
}

async function resolveParticipant(id, label = 'Participant') {
  const agents = getCollection('agents');
  const users = getCollection('users');
  const oid = toObjectId(id);

  let profile = await agents.findOne({ _id: oid });
  if (profile) return { type: 'agent', profile };

  profile = await users.findOne({ _id: oid });
  if (profile) return { type: 'user', profile };

  throw new NotFoundError(label);
}

function summarizeParticipant(participant) {
  const profile = participant.profile || {};
  return {
    type: participant.type,
    id: profile._id ? profile._id.toString() : null,
    userId: profile.userId ? profile.userId.toString() : (participant.type === 'user' && profile._id ? profile._id.toString() : null),
    displayName: profile.displayName || profile.name || profile.username || null
  };
}

async function resolveTronWalletAddress(participant) {
  const profile = participant.profile || {};
  const directAddress = profile.walletAddress || (profile.wallets || []).find(w => w.network === 'tron')?.address;
  if (directAddress) return directAddress;

  if (participant.type === 'agent' && profile.userId) {
    const user = await getCollection('users').findOne({ _id: toObjectId(profile.userId) });
    if (user) {
      const userAddress = user.walletAddress || (user.wallets || []).find(w => w.network === 'tron')?.address;
      if (userAddress) return userAddress;
    }
  }

  return config.tron.escrowAddress;
}

// ─── Escrow operations ──────────────────────────────────────

/**
 * Create a new order (pending_payment).
 */
async function createOrder(listingId, buyerAgentId, quantity = 1, shippingAddress = null) {
  const listings = getCollection('listings');
  const orders = getCollection('orders');

  // Look up listing
  const listing = await listings.findOne({ _id: toObjectId(listingId) });
  if (!listing) throw new NotFoundError('Listing');
  if (!listing.available && listing.available !== undefined) {
    throw new ValidationError('Listing is no longer available');
  }
  if (listing.stock !== undefined && listing.stock < quantity) {
    throw new ValidationError(`Insufficient stock (available: ${listing.stock})`);
  }

  // Look up seller participant (agent or user)
  const sellerParticipant = await resolveParticipant(listing.agentId, 'Seller');

  // Look up buyer participant (agent or user)
  const buyerParticipant = await resolveParticipant(buyerAgentId, 'Buyer');

  // Physical listings need a shipping address
  if (listing.deliveryType === 'physical' && !shippingAddress) {
    throw new ValidationError('Shipping address is required for physical items');
  }

  // Calculate totals
  const unitPrice = listing.price.amount;
  const totalAmount = unitPrice * quantity;
  const fees = calculateFee(totalAmount);
  const orderNumber = generateOrderNumber();

  const now = new Date();
  const order = {
    orderNumber,
    listingId: toObjectId(listingId),
    buyerAgentId: toObjectId(buyerAgentId),
    sellerAgentId: toObjectId(listing.agentId),
    buyerParticipant: summarizeParticipant(buyerParticipant),
    sellerParticipant: summarizeParticipant(sellerParticipant),
    status: 'pending_payment',
    listing: {
      title: listing.title,
      type: listing.type,
      deliveryType: listing.deliveryType,
      unitPrice,
      currency: listing.price.currency || 'USDT'
    },
    quantity,
    shippingAddress: shippingAddress || null,
    escrow: {
      expectedAmount: fees.totalAmount,
      platformFee: fees.platformFee,
      networkFee: fees.networkFee,
      sellerReceives: fees.sellerReceives,
      // Legacy compat
      fee: fees.platformFee,
      netAmount: fees.sellerReceives,
      depositAddress: config.tron.escrowAddress,
      depositReference: null,
      depositTxHash: null,
      releaseTxHash: null,
      feeTxHash: null
    },
    delivery: {
      carrier: null,
      trackingNumber: null,
      proof: null
    },
    timeline: [
      timelineEntry('order_created', buyerAgentId.toString(), {
        orderNumber,
        listingId,
        itemAmount: fees.grossAmount,
        platformFee: fees.platformFee,
        networkFee: fees.networkFee,
        totalAmount: fees.totalAmount,
        sellerReceives: fees.sellerReceives
      })
    ],
    createdAt: now,
    updatedAt: now
  };

  const result = await orders.insertOne(order);
  order._id = result.insertedId;

  await logAudit('order_created', 'agent', buyerAgentId.toString(), 'order', order._id.toString(), {
    orderNumber,
    totalAmount: fees.totalAmount,
    platformFee: fees.platformFee,
    networkFee: fees.networkFee,
    listingId
  });

  console.log(`[ESCROW] Order ${orderNumber} created — ${fees.grossAmount} USDT + ${fees.networkFee} network fee = ${fees.totalAmount} total`);
  return order;
}

/**
 * Verify that payment has been received on-chain for a given order.
 */
async function verifyPayment(orderId) {
  const orders = getCollection('orders');
  const oid = toObjectId(orderId);

  const order = await orders.findOne({ _id: oid });
  if (!order) throw new NotFoundError('Order');

  if (order.status !== 'pending_payment') {
    throw new ValidationError(`Cannot verify payment — order status is "${order.status}"`);
  }

  // Check blockchain for incoming USDT to escrow address
  const sinceTs = order.createdAt.getTime() - 60_000; // 1 min before creation
  const transfers = await checkIncomingUSDT(config.tron.escrowAddress, sinceTs);

  // Try to match a transfer to this order by amount (± 0.01 USDT tolerance)
  const expectedAmount = order.escrow.expectedAmount;
  const match = transfers.find(tx => {
    return Math.abs(tx.amount - expectedAmount) <= 0.01;
  });

  if (!match) {
    return { matched: false, order, message: 'No matching payment found on-chain yet' };
  }

  // Check that this tx hasn't been claimed by another order
  const alreadyClaimed = await orders.findOne({
    'escrow.depositTxHash': match.txHash,
    _id: { $ne: oid }
  });
  if (alreadyClaimed) {
    return { matched: false, order, message: 'Matching transaction already claimed by another order' };
  }

  assertTransition(order.status, 'escrow_funded');

  const update = {
    $set: {
      status: 'escrow_funded',
      'escrow.depositTxHash': match.txHash,
      'escrow.depositReference': match.txHash,
      updatedAt: new Date()
    },
    $push: {
      timeline: timelineEntry('payment_verified', 'system', {
        txHash: match.txHash,
        amount: match.amount,
        from: match.from
      })
    }
  };

  await orders.updateOne({ _id: oid }, update);

  const updated = await orders.findOne({ _id: oid });

  await logAudit('payment_verified', 'system', 'system', 'order', orderId.toString(), {
    txHash: match.txHash,
    amount: match.amount
  });

  console.log(`[ESCROW] Order ${order.orderNumber} payment verified — tx ${match.txHash}`);
  return { matched: true, order: updated };
}

/**
 * Mark an order as shipped.
 */
async function markShipped(orderId, carrier, trackingNumber) {
  const orders = getCollection('orders');
  const oid = toObjectId(orderId);

  const order = await orders.findOne({ _id: oid });
  if (!order) throw new NotFoundError('Order');

  assertTransition(order.status, 'shipped');

  const update = {
    $set: {
      status: 'shipped',
      'delivery.carrier': carrier || null,
      'delivery.trackingNumber': trackingNumber || null,
      updatedAt: new Date()
    },
    $push: {
      timeline: timelineEntry('order_shipped', order.sellerAgentId.toString(), {
        carrier,
        trackingNumber
      })
    }
  };

  await orders.updateOne({ _id: oid }, update);
  const updated = await orders.findOne({ _id: oid });

  await logAudit('order_shipped', 'agent', order.sellerAgentId.toString(), 'order', orderId.toString(), {
    carrier,
    trackingNumber
  });

  console.log(`[ESCROW] Order ${order.orderNumber} shipped via ${carrier}`);
  return updated;
}

/**
 * Mark an order as delivered (e.g. digital delivery with proof).
 */
async function markDelivered(orderId, proof) {
  const orders = getCollection('orders');
  const oid = toObjectId(orderId);

  const order = await orders.findOne({ _id: oid });
  if (!order) throw new NotFoundError('Order');

  // Allow transition from escrow_funded (digital), processing, or shipped (physical)
  assertTransition(order.status, 'delivered');

  const update = {
    $set: {
      status: 'delivered',
      'delivery.proof': proof || null,
      updatedAt: new Date()
    },
    $push: {
      timeline: timelineEntry('order_delivered', order.sellerAgentId.toString(), {
        proof: proof ? '(attached)' : null
      })
    }
  };

  await orders.updateOne({ _id: oid }, update);
  const updated = await orders.findOne({ _id: oid });

  await logAudit('order_delivered', 'agent', order.sellerAgentId.toString(), 'order', orderId.toString(), {
    hasProof: !!proof
  });

  console.log(`[ESCROW] Order ${order.orderNumber} delivered`);
  return updated;
}

/**
 * Buyer confirms receipt → triggers escrow release.
 */
async function confirmReceipt(orderId) {
  const orders = getCollection('orders');
  const oid = toObjectId(orderId);

  const order = await orders.findOne({ _id: oid });
  if (!order) throw new NotFoundError('Order');

  assertTransition(order.status, 'completed');

  // Release escrow funds
  await releaseEscrow(orderId);

  // Update to completed
  const update = {
    $set: {
      status: 'completed',
      updatedAt: new Date()
    },
    $push: {
      timeline: timelineEntry('receipt_confirmed', order.buyerAgentId.toString(), {})
    }
  };

  await orders.updateOne({ _id: oid }, update);
  const updated = await orders.findOne({ _id: oid });

  await logAudit('receipt_confirmed', 'agent', order.buyerAgentId.toString(), 'order', orderId.toString(), {});

  console.log(`[ESCROW] Order ${order.orderNumber} completed`);
  return updated;
}

/**
 * Release escrowed USDT: send net amount to seller, fee to platform.
 */
async function releaseEscrow(orderId) {
  const orders = getCollection('orders');
  const oid = toObjectId(orderId);

  const order = await orders.findOne({ _id: oid });
  if (!order) throw new NotFoundError('Order');

  // Look up seller participant to get their wallet
  const sellerParticipant = await resolveParticipant(order.sellerAgentId, 'Seller');
  const sellerAddress = await resolveTronWalletAddress(sellerParticipant);

  const sellerPayout = order.escrow.sellerReceives || order.escrow.netAmount;
  const platformFee = order.escrow.platformFee || order.escrow.fee;
  const networkFee = order.escrow.networkFee || 0;

  console.log(`[ESCROW] Releasing ${sellerPayout} USDT to seller ${sellerAddress} (platform fee: ${platformFee}, network fee: ${networkFee} retained)`);

  try {
    // Send seller payout (item price minus platform fee)
    // Network fee + platform fee stay in escrow wallet (self-sustaining)
    const releaseTxHash = await sendUSDT(sellerAddress, sellerPayout);

    const updateFields = {
      'escrow.releaseTxHash': releaseTxHash,
      updatedAt: new Date()
    };

    // Platform fee + network fee remain in escrow wallet — self-sustaining model
    updateFields['escrow.feeTxHash'] = 'retained_in_escrow';

    await orders.updateOne({ _id: oid }, {
      $set: updateFields,
      $push: {
        timeline: timelineEntry('escrow_released', 'system', {
          releaseTxHash,
          sellerPayout,
          platformFee,
          networkFee,
          sellerAddress
        })
      }
    });

    await logAudit('escrow_released', 'system', 'system', 'order', orderId.toString(), {
      releaseTxHash,
      sellerPayout,
      platformFee,
      networkFee,
      sellerAddress
    });

    console.log(`[ESCROW] Escrow released for order ${order.orderNumber} — tx ${releaseTxHash}`);
    return releaseTxHash;
  } catch (err) {
    console.error(`[ESCROW] Failed to release escrow for order ${order.orderNumber}:`, err.message);

    // Record the failure in timeline but don't crash the order
    await orders.updateOne({ _id: oid }, {
      $push: {
        timeline: timelineEntry('escrow_release_failed', 'system', {
          error: err.message
        })
      }
    });

    throw new AppError(`Escrow release failed: ${err.message}`, 500, 'ESCROW_RELEASE_FAILED');
  }
}

/**
 * Refund order — send USDT back to buyer.
 */
async function refundOrder(orderId) {
  const orders = getCollection('orders');
  const oid = toObjectId(orderId);

  const order = await orders.findOne({ _id: oid });
  if (!order) throw new NotFoundError('Order');

  assertTransition(order.status, 'refunded');

  // Only refund if there was a deposit
  if (!order.escrow.depositTxHash) {
    // No on-chain deposit — just mark as refunded
    await orders.updateOne({ _id: oid }, {
      $set: { status: 'refunded', updatedAt: new Date() },
      $push: {
        timeline: timelineEntry('order_refunded', 'system', { note: 'No deposit to refund' })
      }
    });

    await logAudit('order_refunded', 'system', 'system', 'order', orderId.toString(), {
      note: 'No deposit to refund'
    });

    return await orders.findOne({ _id: oid });
  }

  // Look up buyer wallet
  const buyerParticipant = await resolveParticipant(order.buyerAgentId, 'Buyer');
  const buyerAddress = await resolveTronWalletAddress(buyerParticipant);

  const refundAmount = order.escrow.expectedAmount;

  try {
    const refundTxHash = await sendUSDT(buyerAddress, refundAmount);

    await orders.updateOne({ _id: oid }, {
      $set: {
        status: 'refunded',
        'escrow.refundTxHash': refundTxHash,
        updatedAt: new Date()
      },
      $push: {
        timeline: timelineEntry('order_refunded', 'system', {
          refundTxHash,
          refundAmount,
          buyerAddress
        })
      }
    });

    await logAudit('order_refunded', 'system', 'system', 'order', orderId.toString(), {
      refundTxHash,
      refundAmount,
      buyerAddress
    });

    console.log(`[ESCROW] Order ${order.orderNumber} refunded — tx ${refundTxHash}`);
    return await orders.findOne({ _id: oid });
  } catch (err) {
    console.error(`[ESCROW] Refund failed for order ${order.orderNumber}:`, err.message);
    throw new AppError(`Refund failed: ${err.message}`, 500, 'REFUND_FAILED');
  }
}

/**
 * Open a dispute on an order — freezes escrow.
 */
async function openDispute(orderId, reason, description) {
  const orders = getCollection('orders');
  const oid = toObjectId(orderId);

  const order = await orders.findOne({ _id: oid });
  if (!order) throw new NotFoundError('Order');

  assertTransition(order.status, 'disputed');

  await orders.updateOne({ _id: oid }, {
    $set: {
      status: 'disputed',
      updatedAt: new Date()
    },
    $push: {
      timeline: timelineEntry('dispute_opened', 'system', {
        reason: reason || 'unspecified',
        description: description || ''
      })
    }
  });

  await logAudit('dispute_opened', 'system', 'system', 'order', orderId.toString(), {
    reason,
    description
  });

  console.log(`[ESCROW] Dispute opened on order ${order.orderNumber}`);
  return await orders.findOne({ _id: oid });
}

/**
 * Get a single order by ID.
 */
async function getOrder(orderId) {
  const oid = toObjectId(orderId);
  const order = await getCollection('orders').findOne({ _id: oid });
  if (!order) throw new NotFoundError('Order');
  return order;
}

/**
 * Get orders for a user, filtered by role (buyer or seller).
 */
async function getUserOrders(userId, role = 'buyer') {
  const filter = {};
  if (role === 'buyer') {
    filter.buyerAgentId = toObjectId(userId);
  } else if (role === 'seller') {
    filter.sellerAgentId = toObjectId(userId);
  } else {
    // Return both
    filter.$or = [
      { buyerAgentId: toObjectId(userId) },
      { sellerAgentId: toObjectId(userId) }
    ];
  }

  return await getCollection('orders')
    .find(filter)
    .sort({ createdAt: -1 })
    .toArray();
}

module.exports = {
  createOrder,
  verifyPayment,
  markShipped,
  markDelivered,
  confirmReceipt,
  releaseEscrow,
  refundOrder,
  openDispute,
  getOrder,
  getUserOrders
};
