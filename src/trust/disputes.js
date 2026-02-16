const { ObjectId } = require('mongodb');
const { getCollection } = require('../shared/db');
const { NotFoundError, ValidationError, ConflictError } = require('../shared/errors');
const { logAudit } = require('../shared/audit');
const { validate, createDisputeSchema } = require('../shared/validators');
const { callLLM } = require('../shared/langchain');

// States where an order can be disputed
const DISPUTABLE_STATES = ['escrow_funded', 'shipped', 'delivered'];

// Valid dispute outcomes
const VALID_OUTCOMES = ['full_refund', 'partial_refund', 'release_to_seller'];

// Valid evidence types
const VALID_EVIDENCE_TYPES = ['screenshot', 'document', 'link', 'text'];

/**
 * Parse a string to ObjectId safely, throw ValidationError on invalid
 */
function toObjectId(id, label = 'ID') {
  if (!id || !ObjectId.isValid(id)) {
    throw new ValidationError(`Invalid ${label}: ${id}`);
  }
  return new ObjectId(id);
}

/**
 * Open a dispute on an order
 */
async function openDispute(orderId, raisedBy, reason, description) {
  const orderOid = toObjectId(orderId, 'orderId');
  const raisedByOid = toObjectId(raisedBy, 'raisedBy');

  // Validate input via schema
  validate(createDisputeSchema, { orderId, reason, description });

  const orders = getCollection('orders');
  const disputes = getCollection('disputes');

  // Check order exists
  const order = await orders.findOne({ _id: orderOid });
  if (!order) {
    throw new NotFoundError('Order');
  }

  // Check order is in a disputable state
  if (!DISPUTABLE_STATES.includes(order.status)) {
    throw new ValidationError(
      `Order cannot be disputed in status "${order.status}". Must be one of: ${DISPUTABLE_STATES.join(', ')}`
    );
  }

  // Check that raisedBy is buyer or seller on this order
  const isBuyer = order.buyerAgentId.toString() === raisedByOid.toString();
  const isSeller = order.sellerAgentId.toString() === raisedByOid.toString();
  if (!isBuyer && !isSeller) {
    throw new ValidationError('Only the buyer or seller of this order can open a dispute');
  }

  // Check no existing open dispute on this order
  const existing = await disputes.findOne({
    orderId: orderOid,
    status: { $in: ['open', 'under_review'] }
  });
  if (existing) {
    throw new ConflictError('An open dispute already exists for this order');
  }

  const now = new Date();
  const dispute = {
    orderId: orderOid,
    raisedBy: raisedByOid,
    raisedByRole: isBuyer ? 'buyer' : 'seller',
    reason,
    description,
    status: 'open',
    evidence: [],
    aiSuggestion: null,
    outcome: null,
    resolvedBy: null,
    resolvedAt: null,
    createdAt: now,
    updatedAt: now
  };

  const result = await disputes.insertOne(dispute);
  dispute._id = result.insertedId;

  // Update order status to "disputed" and freeze escrow
  await orders.updateOne(
    { _id: orderOid },
    {
      $set: {
        status: 'disputed',
        'escrow.frozen': true,
        updatedAt: now
      }
    }
  );

  await logAudit(
    'dispute.opened',
    'agent', raisedByOid.toString(),
    'dispute', dispute._id.toString(),
    { orderId: orderOid.toString(), reason, description }
  );

  return dispute;
}

/**
 * Submit evidence for a dispute
 */
async function submitEvidence(disputeId, submittedBy, type, url, description) {
  const disputeOid = toObjectId(disputeId, 'disputeId');
  const submittedByOid = toObjectId(submittedBy, 'submittedBy');

  if (!VALID_EVIDENCE_TYPES.includes(type)) {
    throw new ValidationError(
      `Invalid evidence type "${type}". Must be one of: ${VALID_EVIDENCE_TYPES.join(', ')}`
    );
  }

  if (!description || description.trim().length === 0) {
    throw new ValidationError('Evidence description is required');
  }

  const disputes = getCollection('disputes');
  const dispute = await disputes.findOne({ _id: disputeOid });
  if (!dispute) {
    throw new NotFoundError('Dispute');
  }

  // Can only add evidence to open or under_review disputes
  if (!['open', 'under_review'].includes(dispute.status)) {
    throw new ValidationError(`Cannot add evidence to a dispute with status "${dispute.status}"`);
  }

  // Verify submitter is buyer or seller on the order
  const orders = getCollection('orders');
  const order = await orders.findOne({ _id: dispute.orderId });
  if (!order) {
    throw new NotFoundError('Order');
  }

  const isBuyer = order.buyerAgentId.toString() === submittedByOid.toString();
  const isSeller = order.sellerAgentId.toString() === submittedByOid.toString();
  if (!isBuyer && !isSeller) {
    throw new ValidationError('Only the buyer or seller can submit evidence');
  }

  const now = new Date();
  const evidence = {
    _id: new ObjectId(),
    submittedBy: submittedByOid,
    role: isBuyer ? 'buyer' : 'seller',
    type,
    url: url || null,
    description,
    submittedAt: now
  };

  await disputes.updateOne(
    { _id: disputeOid },
    {
      $push: { evidence },
      $set: { status: 'under_review', updatedAt: now }
    }
  );

  await logAudit(
    'dispute.evidence_submitted',
    'agent', submittedByOid.toString(),
    'dispute', disputeOid.toString(),
    { evidenceType: type, description }
  );

  return evidence;
}

/**
 * Get a dispute with its associated order details
 */
async function getDispute(disputeId) {
  const disputeOid = toObjectId(disputeId, 'disputeId');

  const disputes = getCollection('disputes');
  const dispute = await disputes.findOne({ _id: disputeOid });
  if (!dispute) {
    throw new NotFoundError('Dispute');
  }

  // Attach order details
  const orders = getCollection('orders');
  const order = await orders.findOne({ _id: dispute.orderId });

  return {
    ...dispute,
    order: order || null
  };
}

/**
 * Resolve a dispute with an outcome
 */
async function resolveDispute(disputeId, outcome, reason, resolvedBy) {
  const disputeOid = toObjectId(disputeId, 'disputeId');
  const resolvedByOid = toObjectId(resolvedBy, 'resolvedBy');

  if (!VALID_OUTCOMES.includes(outcome)) {
    throw new ValidationError(
      `Invalid outcome "${outcome}". Must be one of: ${VALID_OUTCOMES.join(', ')}`
    );
  }

  if (!reason || reason.trim().length === 0) {
    throw new ValidationError('Resolution reason is required');
  }

  const disputes = getCollection('disputes');
  const dispute = await disputes.findOne({ _id: disputeOid });
  if (!dispute) {
    throw new NotFoundError('Dispute');
  }

  if (dispute.status === 'resolved') {
    throw new ConflictError('Dispute is already resolved');
  }

  if (!['open', 'under_review'].includes(dispute.status)) {
    throw new ValidationError(`Cannot resolve dispute with status "${dispute.status}"`);
  }

  const now = new Date();

  // Update dispute
  await disputes.updateOne(
    { _id: disputeOid },
    {
      $set: {
        status: 'resolved',
        outcome,
        resolutionReason: reason,
        resolvedBy: resolvedByOid,
        resolvedAt: now,
        updatedAt: now
      }
    }
  );

  // Update order status based on outcome
  const orders = getCollection('orders');
  let orderStatus;
  let escrowAction;

  switch (outcome) {
    case 'full_refund':
      orderStatus = 'refunded';
      escrowAction = 'refund_full';
      break;
    case 'partial_refund':
      orderStatus = 'partially_refunded';
      escrowAction = 'refund_partial';
      break;
    case 'release_to_seller':
      orderStatus = 'completed';
      escrowAction = 'release';
      break;
  }

  await orders.updateOne(
    { _id: dispute.orderId },
    {
      $set: {
        status: orderStatus,
        'escrow.frozen': false,
        'escrow.action': escrowAction,
        updatedAt: now
      }
    }
  );

  await logAudit(
    'dispute.resolved',
    'agent', resolvedByOid.toString(),
    'dispute', disputeOid.toString(),
    { outcome, reason, orderStatus }
  );

  return {
    disputeId: disputeOid.toString(),
    outcome,
    reason,
    orderStatus,
    resolvedAt: now
  };
}

/**
 * AI-powered mediation — suggests a resolution but NEVER auto-resolves
 */
async function aiMediate(disputeId) {
  const disputeOid = toObjectId(disputeId, 'disputeId');

  const disputes = getCollection('disputes');
  const dispute = await disputes.findOne({ _id: disputeOid });
  if (!dispute) {
    throw new NotFoundError('Dispute');
  }

  if (dispute.status === 'resolved') {
    throw new ValidationError('Cannot mediate a resolved dispute');
  }

  // Gather order details
  const orders = getCollection('orders');
  const order = await orders.findOne({ _id: dispute.orderId });

  // Build evidence summary for the LLM
  const evidenceSummary = dispute.evidence.map((e, i) =>
    `Evidence ${i + 1} (${e.role}, ${e.type}): ${e.description}${e.url ? ` [${e.url}]` : ''}`
  ).join('\n');

  const messages = [
    {
      role: 'system',
      content: 'You are a fair marketplace dispute mediator. Review the evidence and suggest: full_refund, partial_refund, or release_to_seller. Explain your reasoning. Respond with JSON: {"suggestion": "...", "reasoning": "...", "confidence": "high|medium|low"}'
    },
    {
      role: 'user',
      content: `Dispute Details:
- Reason: ${dispute.reason}
- Description: ${dispute.description}
- Raised by: ${dispute.raisedByRole}
- Order status before dispute: ${order ? order.status : 'unknown'}
- Order amount: ${order?.price?.amount || 'unknown'} ${order?.price?.currency || ''}

Evidence submitted:
${evidenceSummary || 'No evidence submitted yet.'}

Please analyze and suggest a fair resolution.`
    }
  ];

  const aiResponse = await callLLM(messages, {
    temperature: 0.3,
    jsonMode: true,
    maxTokens: 1000
  });

  // Parse the response
  let suggestion;
  if (typeof aiResponse === 'object') {
    suggestion = aiResponse;
  } else {
    try {
      suggestion = JSON.parse(aiResponse);
    } catch {
      suggestion = { suggestion: 'unknown', reasoning: aiResponse, confidence: 'low' };
    }
  }

  // Store the AI suggestion on the dispute (DOES NOT auto-resolve)
  const now = new Date();
  await disputes.updateOne(
    { _id: disputeOid },
    {
      $set: {
        aiSuggestion: {
          ...suggestion,
          generatedAt: now
        },
        updatedAt: now
      }
    }
  );

  await logAudit(
    'dispute.ai_mediation',
    'system', 'ai_mediator',
    'dispute', disputeOid.toString(),
    { suggestion: suggestion.suggestion, confidence: suggestion.confidence }
  );

  return {
    disputeId: disputeOid.toString(),
    suggestion: suggestion.suggestion,
    reasoning: suggestion.reasoning,
    confidence: suggestion.confidence,
    note: 'This is a suggestion only. A human admin must resolve the dispute.'
  };
}

module.exports = {
  openDispute,
  submitEvidence,
  getDispute,
  resolveDispute,
  aiMediate
};
