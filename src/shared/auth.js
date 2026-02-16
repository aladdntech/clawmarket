const crypto = require('crypto');
const { getCollection } = require('./db');
const { ObjectId } = require('mongodb');

// ─── Session Token Management ───────────────────────────────

/**
 * Generate a secure session token
 */
function generateSessionToken() {
  return 'cms_' + crypto.randomBytes(32).toString('hex');
}

/**
 * Generate a short OTP (6 digits)
 */
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Generate a magic link token (URL-safe)
 */
function generateMagicToken() {
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * Generate a new API key for an agent (for programmatic access)
 */
function generateApiKey() {
  return 'cm_' + crypto.randomBytes(24).toString('hex');
}

/**
 * Generate a recovery code set (8 codes, 8 chars each)
 */
function generateRecoveryCodes() {
  const codes = [];
  for (let i = 0; i < 8; i++) {
    codes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
  }
  return codes;
}

// ─── Auth Middleware ─────────────────────────────────────────

function authMiddleware(req, res, next) {
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;
  const sessionToken = req.headers['authorization']?.replace('Bearer ', '') || 
                        req.cookies?.session_token;

  // All GET requests to /api are public (browsing the marketplace)
  if (req.method === 'GET') {
    if (apiKey) req.apiKey = apiKey;
    if (sessionToken) req.sessionToken = sessionToken;
    return next();
  }

  // Bot/webhook endpoints are public (POST from WhatsApp, Telegram, etc.)
  if (req.originalUrl.startsWith('/api/bot')) {
    if (apiKey) req.apiKey = apiKey;
    return next();
  }

  // Auth endpoints are public
  if (req.originalUrl.startsWith('/api/auth')) {
    return next();
  }

  // For mutations (POST/PUT/DELETE), require either session token or API key
  if (!apiKey && !sessionToken) {
    return res.status(401).json({ 
      error: 'Authentication required. Log in or provide an API key.', 
      code: 'AUTH_REQUIRED',
      loginUrl: '/#/login'
    });
  }

  if (apiKey) req.apiKey = apiKey;
  if (sessionToken) req.sessionToken = sessionToken;
  next();
}

/**
 * Middleware to resolve the authenticated user from session token
 */
async function resolveUser(req, res, next) {
  if (req.sessionToken) {
    try {
      const session = await getCollection('sessions').findOne({
        token: req.sessionToken,
        expiresAt: { $gt: new Date() }
      });
      if (session) {
        req.userId = session.userId;
        req.user = await getCollection('users').findOne({ _id: new ObjectId(session.userId) });
      }
    } catch (err) {
      // Session lookup failed — not critical
    }
  }
  next();
}

module.exports = { 
  authMiddleware, 
  resolveUser,
  generateApiKey, 
  generateSessionToken, 
  generateOTP, 
  generateMagicToken,
  generateRecoveryCodes
};
