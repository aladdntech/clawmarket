const { ObjectId } = require('mongodb');
const { getCollection } = require('../shared/db');
const { NotFoundError, ValidationError, ConflictError } = require('../shared/errors');
const { logAudit } = require('../shared/audit');
const { validate, createReviewSchema } = require('../shared/validators');

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
 * Recalculate and update an agent's average rating
 */
async function recalculateAgentRating(agentId) {
  const agentOid = typeof agentId === 'string' ? toObjectId(agentId, 'agentId') : agentId;
  const reviews = getCollection('reviews');
  const agents = getCollection('agents');

  const pipeline = [
    { $match: { revieweeId: agentOid } },
    {
      $group: {
        _id: null,
        avgRating: { $avg: '$rating' },
        count: { $sum: 1 }
      }
    }
  ];

  const [result] = await reviews.aggregate(pipeline).toArray();

  const avgRating = result ? Math.round(result.avgRating * 100) / 100 : 0;
  const reviewCount = result ? result.count : 0;

  await agents.updateOne(
    { _id: agentOid },
    {
      $set: {
        'rating.average': avgRating,
        'rating.count': reviewCount,
        updatedAt: new Date()
      }
    }
  );

  return { average: avgRating, count: reviewCount };
}

/**
 * Create a review for a completed order
 */
async function createReview(orderId, reviewerId, rating, comment) {
  const orderOid = toObjectId(orderId, 'orderId');
  const reviewerOid = toObjectId(reviewerId, 'reviewerId');

  // Validate input
  validate(createReviewSchema, { orderId, rating, comment });

  const orders = getCollection('orders');
  const reviewsColl = getCollection('reviews');

  // Check order exists
  const order = await orders.findOne({ _id: orderOid });
  if (!order) {
    throw new NotFoundError('Order');
  }

  // Order must be completed to leave a review
  if (order.status !== 'completed') {
    throw new ValidationError(
      `Cannot review an order with status "${order.status}". Order must be completed.`
    );
  }

  // Reviewer must be buyer or seller on this order
  const isBuyer = order.buyerAgentId.toString() === reviewerOid.toString();
  const isSeller = order.sellerAgentId.toString() === reviewerOid.toString();
  if (!isBuyer && !isSeller) {
    throw new ValidationError('Only the buyer or seller of this order can leave a review');
  }

  // Determine who is being reviewed (the other party)
  const revieweeId = isBuyer ? order.sellerAgentId : order.buyerAgentId;
  const reviewerRole = isBuyer ? 'buyer' : 'seller';

  // Check for duplicate review (same reviewer on same order)
  const existing = await reviewsColl.findOne({
    orderId: orderOid,
    reviewerId: reviewerOid
  });
  if (existing) {
    throw new ConflictError('You have already reviewed this order');
  }

  const now = new Date();
  const review = {
    orderId: orderOid,
    reviewerId: reviewerOid,
    revieweeId,
    reviewerRole,
    rating,
    comment: comment || null,
    createdAt: now,
    updatedAt: now
  };

  const result = await reviewsColl.insertOne(review);
  review._id = result.insertedId;

  // Recalculate the reviewee's average rating
  const newRating = await recalculateAgentRating(revieweeId);

  await logAudit(
    'review.created',
    'agent', reviewerOid.toString(),
    'review', review._id.toString(),
    {
      orderId: orderOid.toString(),
      revieweeId: revieweeId.toString(),
      rating,
      newAverage: newRating.average,
      newCount: newRating.count
    }
  );

  return {
    ...review,
    revieweeRating: newRating
  };
}

/**
 * Get paginated reviews for an agent
 */
async function getAgentReviews(agentId, page = 1, limit = 20) {
  const agentOid = toObjectId(agentId, 'agentId');

  page = Math.max(1, parseInt(page) || 1);
  limit = Math.min(100, Math.max(1, parseInt(limit) || 20));
  const skip = (page - 1) * limit;

  const reviews = getCollection('reviews');

  const [items, total] = await Promise.all([
    reviews
      .find({ revieweeId: agentOid })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray(),
    reviews.countDocuments({ revieweeId: agentOid })
  ]);

  return {
    reviews: items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
}

/**
 * Get aggregate rating for an agent
 */
async function getAgentRating(agentId) {
  const agentOid = toObjectId(agentId, 'agentId');
  const reviews = getCollection('reviews');

  const pipeline = [
    { $match: { revieweeId: agentOid } },
    {
      $group: {
        _id: null,
        average: { $avg: '$rating' },
        count: { $sum: 1 },
        distribution: {
          $push: '$rating'
        }
      }
    }
  ];

  const [result] = await reviews.aggregate(pipeline).toArray();

  if (!result) {
    return { average: 0, count: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } };
  }

  // Build rating distribution
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const r of result.distribution) {
    distribution[r] = (distribution[r] || 0) + 1;
  }

  return {
    average: Math.round(result.average * 100) / 100,
    count: result.count,
    distribution
  };
}

module.exports = {
  createReview,
  getAgentReviews,
  getAgentRating
};
