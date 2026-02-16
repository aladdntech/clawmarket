const cors = require('cors');
const crypto = require('crypto');
const { getRedis } = require('./redis');

const ALLOWED_HOSTS = [
  'market.aladdn.app',
  'clawmarket.onrender.com',
  'localhost:3001'
];

const corsMiddleware = cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    try {
      const host = new URL(origin).host;
      if (ALLOWED_HOSTS.includes(host)) return callback(null, true);
      return callback(new Error('Not allowed by CORS'));
    } catch (err) {
      return callback(new Error('Invalid origin'));
    }
  },
  credentials: true
});

function requestIdMiddleware(req, res, next) {
  const existing = req.headers['x-request-id'];
  const id = existing || (crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex'));
  req.requestId = id;
  res.setHeader('X-Request-ID', id);
  next();
}

function enforceJsonContentType(req, res, next) {
  const methods = ['POST', 'PUT', 'PATCH'];
  if (methods.includes(req.method)) {
    if (!req.is('application/json')) {
      return res.status(415).json({
        error: 'Content-Type must be application/json',
        code: 'UNSUPPORTED_MEDIA_TYPE'
      });
    }
  }
  next();
}

function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }
  Object.keys(obj).forEach((key) => {
    const value = obj[key];
    if (key.startsWith('$')) {
      const newKey = key.slice(1);
      delete obj[key];
      if (newKey && !(newKey in obj)) {
        obj[newKey] = sanitizeObject(value);
      }
      return;
    }
    obj[key] = sanitizeObject(value);
  });
  return obj;
}

function sanitizeRequest(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    sanitizeObject(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    sanitizeObject(req.query);
  }
  next();
}

function botApiKeyMiddleware(req, res, next) {
  const requiredKey = process.env.BOT_API_KEY;
  if (!requiredKey) return next();

  const headerKey = req.headers['x-bot-api-key'];
  const authHeader = req.headers['authorization'];
  const bearer = authHeader?.startsWith('Bearer ') ? authHeader.replace('Bearer ', '') : null;
  const provided = headerKey || bearer;

  if (provided !== requiredKey) {
    return res.status(401).json({
      error: 'Invalid bot API key',
      code: 'BOT_AUTH_REQUIRED'
    });
  }
  next();
}

const inMemoryLimiterStore = new Map();

async function incrementWithRedis(key, windowMs) {
  const redis = getRedis();
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.pexpire(key, windowMs);
  }
  return count;
}

function incrementInMemory(key, windowMs) {
  const now = Date.now();
  const record = inMemoryLimiterStore.get(key);
  if (!record || record.resetAt <= now) {
    const resetAt = now + windowMs;
    inMemoryLimiterStore.set(key, { count: 1, resetAt });
    return { count: 1, resetAt };
  }
  record.count += 1;
  return record;
}

function createRateLimiter({ name, windowMs, max, keyGenerator }) {
  return async function rateLimiter(req, res, next) {
    try {
      const identifier = keyGenerator ? keyGenerator(req) : req.ip;
      const key = `rl:${name}:${identifier}`;
      let count;
      let resetAt;

      try {
        count = await incrementWithRedis(key, windowMs);
      } catch (err) {
        const record = incrementInMemory(key, windowMs);
        count = record.count;
        resetAt = record.resetAt;
      }

      if (count > max) {
        if (resetAt) {
          res.setHeader('Retry-After', Math.ceil((resetAt - Date.now()) / 1000));
        }
        return res.status(429).json({
          error: 'Too many requests',
          code: 'RATE_LIMIT'
        });
      }
      next();
    } catch (err) {
      next();
    }
  };
}

module.exports = {
  corsMiddleware,
  requestIdMiddleware,
  enforceJsonContentType,
  sanitizeRequest,
  botApiKeyMiddleware,
  createRateLimiter
};
