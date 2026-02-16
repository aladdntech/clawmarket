const { ObjectId } = require('mongodb');
const { getCollection } = require('../shared/db');
const { validate, createUserSchema, createAgentSchema, createListingSchema } = require('../shared/validators');
const { generateApiKey } = require('../shared/auth');
const { logAudit } = require('../shared/audit');
const { ValidationError, NotFoundError } = require('../shared/errors');

// ─── Helper ─────────────────────────────────────────────────
function toObjectId(id) {
  if (!ObjectId.isValid(id)) {
    throw new ValidationError(`Invalid ID: ${id}`);
  }
  return new ObjectId(id);
}

// ─── Users ──────────────────────────────────────────────────
async function createUser(data) {
  const clean = validate(createUserSchema, data);
  const doc = {
    ...clean,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const result = await getCollection('users').insertOne(doc);
  const user = { ...doc, _id: result.insertedId };

  await logAudit('user.create', 'system', null, 'user', result.insertedId.toString(), { name: clean.name });

  return user;
}

async function getUser(id) {
  const oid = toObjectId(id);
  const user = await getCollection('users').findOne({ _id: oid });
  if (!user) throw new NotFoundError('User');
  return user;
}

// ─── Agents ─────────────────────────────────────────────────
async function createAgent(data) {
  const clean = validate(createAgentSchema, data);
  const apiKey = generateApiKey();
  const doc = {
    ...clean,
    userId: clean.userId,
    apiKey,
    rating: { average: 0, count: 0 },
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const result = await getCollection('agents').insertOne(doc);
  const agent = { ...doc, _id: result.insertedId };

  await logAudit('agent.create', 'user', clean.userId, 'agent', result.insertedId.toString(), {
    name: clean.name,
    category: clean.category,
  });

  return agent;
}

async function getAgent(id) {
  const oid = toObjectId(id);
  const agent = await getCollection('agents').findOne({ _id: oid });
  if (!agent) throw new NotFoundError('Agent');
  return agent;
}

async function getAgentByApiKey(apiKey) {
  const agent = await getCollection('agents').findOne({ apiKey });
  if (!agent) throw new NotFoundError('Agent');
  return agent;
}

// ─── Listings ───────────────────────────────────────────────
async function createListing(data) {
  const clean = validate(createListingSchema, data);
  const doc = {
    ...clean,
    available: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const result = await getCollection('listings').insertOne(doc);
  const listing = { ...doc, _id: result.insertedId };

  await logAudit('listing.create', 'agent', clean.agentId, 'listing', result.insertedId.toString(), {
    title: clean.title,
    category: clean.category,
    price: clean.price,
  });

  return listing;
}

async function getListing(id) {
  const oid = toObjectId(id);
  const listing = await getCollection('listings').findOne({ _id: oid });
  if (!listing) throw new NotFoundError('Listing');
  return listing;
}

async function updateListing(id, updates) {
  const oid = toObjectId(id);

  // Prevent overwriting system fields
  delete updates._id;
  delete updates.createdAt;

  const result = await getCollection('listings').findOneAndUpdate(
    { _id: oid },
    { $set: { ...updates, updatedAt: new Date() } },
    { returnDocument: 'after' }
  );

  const listing = result.value || result;
  if (!listing || !listing._id) throw new NotFoundError('Listing');

  await logAudit('listing.update', 'agent', listing.agentId, 'listing', oid.toString(), {
    fields: Object.keys(updates),
  });

  return listing;
}

async function deleteListing(id) {
  const oid = toObjectId(id);

  const result = await getCollection('listings').findOneAndUpdate(
    { _id: oid },
    { $set: { available: false, updatedAt: new Date() } },
    { returnDocument: 'after' }
  );

  const listing = result.value || result;
  if (!listing || !listing._id) throw new NotFoundError('Listing');

  await logAudit('listing.delete', 'agent', listing.agentId, 'listing', oid.toString(), {
    title: listing.title,
  });

  return listing;
}

module.exports = {
  createUser,
  getUser,
  createAgent,
  getAgent,
  getAgentByApiKey,
  createListing,
  getListing,
  updateListing,
  deleteListing,
};
