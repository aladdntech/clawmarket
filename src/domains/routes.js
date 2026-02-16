// src/domains/routes.js — Express Router for subdomain provisioning

const { Router } = require('express');
const dns = require('dns').promises;
const { ObjectId } = require('mongodb');
const { authMiddleware, resolveUser } = require('../shared/auth');
const { ValidationError, AuthError, NotFoundError, ConflictError } = require('../shared/errors');
const { getCollection } = require('../shared/db');
const { validate, createSubdomainProvisionSchema } = require('../shared/validators');

const router = Router();

const DOMAIN_BASE = 'corosagroup.com';

const RESERVED_SUBDOMAINS = new Set([
  'market', 'pocket', 'domains', 'www', 'mail', 'ftp', 'admin', 'news', 'new', 'automate',
  'api', 'app', 'shop', 'store', 'blog', 'dev', 'staging', 'test'
]);

// ─── Middleware ──────────────────────────────────────────────

router.use(authMiddleware);
router.use(resolveUser);

// ─── Helpers ────────────────────────────────────────────────

function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

function requireAuth(req) {
  const ownerId = req.userId || req.apiKey;
  if (!ownerId) throw new AuthError('Authentication required');
  return ownerId;
}

function normalizeSubdomain(value) {
  return (value || '').trim().toLowerCase();
}

function validateSubdomainOrThrow(subdomain) {
  if (RESERVED_SUBDOMAINS.has(subdomain)) {
    throw new ValidationError('Subdomain is reserved');
  }
}

async function dnsExists(fullDomain) {
  try {
    const records = await dns.resolveAny(fullDomain);
    return Array.isArray(records) && records.length > 0;
  } catch (err) {
    if (err.code === 'ENOTFOUND' || err.code === 'ENODATA' || err.code === 'ESERVFAIL') {
      return false;
    }
    return false;
  }
}

// ─── Routes ─────────────────────────────────────────────────

/**
 * POST /api/domains/provision — Provision a new subdomain
 */
router.post('/api/domains/provision', asyncHandler(async (req, res) => {
  const data = validate(createSubdomainProvisionSchema, req.body || {});
  const subdomain = normalizeSubdomain(data.subdomain);
  validateSubdomainOrThrow(subdomain);

  const ownerIdRaw = requireAuth(req);
  const ownerId = ObjectId.isValid(ownerIdRaw) ? new ObjectId(ownerIdRaw) : ownerIdRaw;

  const fullDomain = `${subdomain}.${DOMAIN_BASE}`;
  const collection = getCollection('subdomains');

  const existing = await collection.findOne({ subdomain });
  if (existing) throw new ConflictError('Subdomain already taken');

  const targetType = data.targetIp ? 'ip' : data.targetUrl ? 'url' : 'marketplace';
  const targetValue = data.targetIp || data.targetUrl || 'marketplace';

  const now = new Date();
  const doc = {
    subdomain,
    fullDomain,
    userId: ownerId,
    targetType,
    targetValue,
    status: 'pending',
    dnsRecordId: null,
    createdAt: now,
    updatedAt: now
  };

  // TODO: DNS provisioning is handled by platform operator / automated later (GoDaddy).
  await collection.insertOne(doc);

  res.status(201).json({
    success: true,
    subdomain,
    fullDomain,
    status: doc.status
  });
}));

/**
 * GET /api/domains/check/:subdomain — Check availability
 */
router.get('/api/domains/check/:subdomain', asyncHandler(async (req, res) => {
  const subdomain = normalizeSubdomain(req.params.subdomain);

  // Basic validation (same rules as provision)
  if (!/^[a-z0-9-]{3,63}$/.test(subdomain)) {
    throw new ValidationError('Invalid subdomain format');
  }
  if (RESERVED_SUBDOMAINS.has(subdomain)) {
    return res.json({
      available: false,
      subdomain,
      fullDomain: `${subdomain}.${DOMAIN_BASE}`
    });
  }

  const fullDomain = `${subdomain}.${DOMAIN_BASE}`;
  const collection = getCollection('subdomains');
  const existing = await collection.findOne({ subdomain });

  if (existing) {
    return res.json({ available: false, subdomain, fullDomain });
  }

  const dnsTaken = await dnsExists(fullDomain);
  res.json({ available: !dnsTaken, subdomain, fullDomain });
}));

/**
 * GET /api/domains/mine — List user's domains
 */
router.get('/api/domains/mine', asyncHandler(async (req, res) => {
  const ownerIdRaw = requireAuth(req);
  const ownerId = ObjectId.isValid(ownerIdRaw) ? new ObjectId(ownerIdRaw) : ownerIdRaw;
  const collection = getCollection('subdomains');

  const domains = await collection
    .find({ userId: ownerId })
    .sort({ createdAt: -1 })
    .toArray();

  res.json({ success: true, domains, count: domains.length });
}));

/**
 * DELETE /api/domains/:subdomain — Release a subdomain
 */
router.delete('/api/domains/:subdomain', asyncHandler(async (req, res) => {
  const ownerIdRaw = requireAuth(req);
  const ownerId = ObjectId.isValid(ownerIdRaw) ? new ObjectId(ownerIdRaw) : ownerIdRaw;

  const subdomain = normalizeSubdomain(req.params.subdomain);
  const collection = getCollection('subdomains');

  const existing = await collection.findOne({ subdomain, userId: ownerId });
  if (!existing) throw new NotFoundError('Subdomain');

  await collection.deleteOne({ _id: existing._id });

  res.json({ success: true, subdomain, fullDomain: existing.fullDomain });
}));

module.exports = router;
