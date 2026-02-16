require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const config = require('./src/shared/config');
const { connect } = require('./src/shared/db');
const { authMiddleware } = require('./src/shared/auth');
const { errorHandler } = require('./src/shared/errors');

const app = express();

// ─── Security & Middleware ──────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests', code: 'RATE_LIMIT' }
});
app.use('/api/', limiter);

// Static files (web UI)
app.use(express.static(path.join(__dirname, 'public')));

// Auth middleware for API routes
app.use('/api/', authMiddleware);

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
