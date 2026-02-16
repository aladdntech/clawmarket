require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const path = require('path');
const config = require('./src/shared/config');
const { connect } = require('./src/shared/db');
const { authMiddleware, resolveUser } = require('./src/shared/auth');
const { errorHandler } = require('./src/shared/errors');
const {
  corsMiddleware,
  requestIdMiddleware,
  enforceJsonContentType,
  sanitizeRequest,
  botApiKeyMiddleware,
  createRateLimiter
} = require('./src/shared/security');
const { registerChannelRoutes } = require('./src/channels');

// ─── Global Process Hardening ───────────────────────────────
// Never crash on unhandled errors — log them and keep running
process.on('uncaughtException', (err) => {
  console.error('🔥 Uncaught Exception (server kept running):', err.message);
  console.error(err.stack);
});
process.on('unhandledRejection', (reason) => {
  console.error('🔥 Unhandled Rejection (server kept running):', reason);
});

const app = express();

// ─── Security & Middleware ──────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(requestIdMiddleware);
app.use(corsMiddleware);
app.use(cookieParser());
app.use(enforceJsonContentType);

// Safe JSON parsing — catch malformed bodies
app.use((req, res, next) => {
  express.json({ limit: '1mb' })(req, res, (err) => {
    if (err) {
      console.warn(`⚠️ Bad JSON from ${req.ip}: ${err.message}`);
      return res.status(400).json({ error: 'Invalid JSON body', code: 'BAD_REQUEST' });
    }
    next();
  });
});
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(sanitizeRequest);

// Rate limiting
const globalLimiter = createRateLimiter({
  name: 'global',
  windowMs: 15 * 60 * 1000,
  max: 100,
  keyGenerator: (req) => req.ip
});
app.use('/api/', globalLimiter);

const authLimiter = createRateLimiter({
  name: 'auth',
  windowMs: 60 * 1000,
  max: 5,
  keyGenerator: (req) => req.ip
});
app.use('/api/auth', authLimiter);

const botMessageLimiter = createRateLimiter({
  name: 'bot-message',
  windowMs: 60 * 1000,
  max: 30,
  keyGenerator: (req) => req.body?.sessionId || req.body?.userId || req.query?.sessionId || req.params?.id || req.ip
});
app.use('/api/bot/message', botMessageLimiter);

const listingsLimiter = createRateLimiter({
  name: 'listings-crud',
  windowMs: 60 * 1000,
  max: 20,
  keyGenerator: (req) => req.userId || req.sessionToken || req.apiKey || req.ip
});
app.use('/api/listings', (req, res, next) => {
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    return listingsLimiter(req, res, next);
  }
  next();
});

const searchLimiter = createRateLimiter({
  name: 'search',
  windowMs: 60 * 1000,
  max: 60,
  keyGenerator: (req) => req.ip
});
const searchGate = (req, res, next) => {
  if (req.method === 'GET' && req.query?.search) {
    return searchLimiter(req, res, next);
  }
  next();
};
app.use('/api/listings', searchGate);
app.use('/api/agents', searchGate);

// Static files (web UI)
app.use(express.static(path.join(__dirname, 'public')));

// Public webhook channels (Telegram/WhatsApp)
try {
  registerChannelRoutes(app);
  console.log('✅ Channel webhooks loaded');
} catch (err) {
  console.warn('⚠️  Channel webhooks not ready:', err.message);
}

// Bot webhook API key (optional)
app.use('/api/bot', botApiKeyMiddleware);

// Auth middleware for API routes
app.use('/api/', authMiddleware, resolveUser);

// ─── Health Check ───────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'ClawMarket is running',
    version: config.platform.version,
    uptime: Math.floor(process.uptime())
  });
});

// ─── Load API Routes ────────────────────────────────────────
function loadRoutes() {
  // Auth routes (loaded FIRST — they need to be public)
  try {
    const authRoutes = require('./src/auth/routes');
    app.use(authRoutes);
    console.log('✅ Auth routes loaded');
  } catch (err) {
    console.warn('⚠️  Auth routes not ready:', err.message);
  }

  try {
    const marketplaceRoutes = require('./src/marketplace/routes');
    app.use(marketplaceRoutes);
    console.log('✅ Marketplace routes loaded');
  } catch (err) {
    console.warn('⚠️  Marketplace routes not ready:', err.message);
  }

  try {
    const paymentRoutes = require('./src/payments/routes');
    app.use(paymentRoutes);
    console.log('✅ Payment routes loaded');
  } catch (err) {
    console.warn('⚠️  Payment routes not ready:', err.message);
  }

  try {
    const botRoutes = require('./src/bot/routes');
    app.use('/api/bot', botRoutes);
    console.log('✅ Bot routes loaded');
  } catch (err) {
    console.warn('⚠️  Bot routes not ready:', err.message);
  }

  try {
    const trustRoutes = require('./src/trust/routes');
    app.use(trustRoutes);
    console.log('✅ Trust routes loaded');
  } catch (err) {
    console.warn('⚠️  Trust routes not ready:', err.message);
  }

  try {
    const adminRoutes = require('./src/admin/routes');
    app.use('/api/admin', adminRoutes);
    console.log('✅ Admin routes loaded');
  } catch (err) {
    console.warn('⚠️  Admin routes not ready:', err.message);
  }

  try {
    const domainRoutes = require('./src/domains/routes');
    app.use(domainRoutes);
    console.log('✅ Domain routes loaded');
  } catch (err) {
    console.warn('⚠️  Domain routes not ready:', err.message);
  }

  // ─── Error Handler (AFTER all routes) ───────────────────
  app.use(errorHandler);

  // ─── 404 for unknown API routes (AFTER all routes) ──────
  app.use('/api/*', (req, res) => {
    res.status(404).json({ error: 'Endpoint not found', code: 'NOT_FOUND' });
  });

  // ─── SPA Fallback ─────────────────────────────────────────
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });
}

// ─── Start Server ───────────────────────────────────────────
async function start() {
  try {
    await connect();
    loadRoutes();
    
    app.listen(config.port, () => {
      console.log(`
╔══════════════════════════════════════════╗
║          🏪 ClawMarket v${config.platform.version}           ║
║   AI-Powered Marketplace for Everyone   ║
╠══════════════════════════════════════════╣
║  Port: ${config.port}                              ║
║  Escrow: ${config.tron.escrowAddress.slice(0, 10)}...      ║
║  Fee: ${config.tron.feeRate * 100}%                             ║
║  LLM: ${config.llm.copilot.model}                ║
╚══════════════════════════════════════════╝
      `);
    });
  } catch (err) {
    console.error('❌ Failed to start ClawMarket:', err);
    process.exit(1);
  }
}

start();

module.exports = app;
