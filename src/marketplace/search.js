const { getCollection } = require('../shared/db');

// ─── Search Listings ────────────────────────────────────────
async function searchListings({
  query,
  category,
  type,
  condition,
  minPrice,
  maxPrice,
  deliveryType,
  page = 1,
  limit = 20,
} = {}) {
  const filter = { available: true };

  if (query && typeof query === 'string') {
    filter.$text = { $search: query };
  }
  if (category) {
    filter.category = category;
  }
  if (type) {
    filter.type = type;
  }
  if (condition) {
    filter.condition = condition;
  }
  if (deliveryType) {
    filter.deliveryType = deliveryType;
  }
  if (minPrice !== undefined || maxPrice !== undefined) {
    filter['price.amount'] = {};
    if (minPrice !== undefined) filter['price.amount'].$gte = Number(minPrice);
    if (maxPrice !== undefined) filter['price.amount'].$lte = Number(maxPrice);
  }

  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const safePage = Math.max(Number(page) || 1, 1);
  const skip = (safePage - 1) * safeLimit;

  const col = getCollection('listings');

  // Build sort: if text query, sort by relevance score; otherwise by newest
  const sort = query ? { score: { $meta: 'textScore' } } : { createdAt: -1 };
  const projection = query ? { score: { $meta: 'textScore' } } : {};

  const [listings, total] = await Promise.all([
    col.find(filter, { projection }).sort(sort).skip(skip).limit(safeLimit).toArray(),
    col.countDocuments(filter),
  ]);

  return {
    listings,
    total,
    page: safePage,
    pages: Math.ceil(total / safeLimit) || 1,
  };
}

// ─── Search Agents ──────────────────────────────────────────
async function searchAgents({ query, category, page = 1, limit = 20 } = {}) {
  const filter = { active: { $ne: false } };

  if (query && typeof query === 'string') {
    filter.$text = { $search: query };
  }
  if (category) {
    filter.category = category;
  }

  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const safePage = Math.max(Number(page) || 1, 1);
  const skip = (safePage - 1) * safeLimit;

  const col = getCollection('agents');

  const sort = query ? { score: { $meta: 'textScore' } } : { createdAt: -1 };
  const projection = query ? { score: { $meta: 'textScore' } } : {};

  const [agents, total] = await Promise.all([
    col.find(filter, { projection }).sort(sort).skip(skip).limit(safeLimit).toArray(),
    col.countDocuments(filter),
  ]);

  return {
    agents,
    total,
    page: safePage,
    pages: Math.ceil(total / safeLimit) || 1,
  };
}

// ─── Categories ─────────────────────────────────────────────
async function getCategories() {
  const [agentCats, listingCats] = await Promise.all([
    getCollection('agents').aggregate([
      { $match: { active: { $ne: false } } },
      { $group: { _id: '$category', agentCount: { $sum: 1 } } },
    ]).toArray(),
    getCollection('listings').aggregate([
      { $match: { available: true } },
      { $group: { _id: '$category', listingCount: { $sum: 1 } } },
    ]).toArray(),
  ]);

  // Merge into a single map
  const map = {};
  for (const { _id, agentCount } of agentCats) {
    if (!_id) continue;
    map[_id] = { category: _id, agentCount, listingCount: 0 };
  }
  for (const { _id, listingCount } of listingCats) {
    if (!_id) continue;
    if (!map[_id]) map[_id] = { category: _id, agentCount: 0, listingCount: 0 };
    map[_id].listingCount = listingCount;
  }

  return Object.values(map).sort((a, b) => a.category.localeCompare(b.category));
}

// ─── Stats ──────────────────────────────────────────────────
async function getStats() {
  const [totalAgents, totalListings, orderStats] = await Promise.all([
    getCollection('agents').countDocuments({ active: { $ne: false } }),
    getCollection('listings').countDocuments({ available: true }),
    getCollection('orders')
      .aggregate([
        { $match: { status: 'completed' } },
        {
          $group: {
            _id: null,
            completedOrders: { $sum: 1 },
            totalRevenue: { $sum: '$total.amount' },
          },
        },
      ])
      .toArray(),
  ]);

  const stats = orderStats[0] || { completedOrders: 0, totalRevenue: 0 };

  return {
    totalAgents,
    totalListings,
    completedOrders: stats.completedOrders,
    totalRevenue: stats.totalRevenue,
  };
}

module.exports = { searchListings, searchAgents, getCategories, getStats };
