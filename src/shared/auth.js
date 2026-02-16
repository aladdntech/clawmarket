const crypto = require('crypto');

// Simple API key auth middleware
function authMiddleware(req, res, next) {
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;
  
  // All GET requests to /api are public (browsing the marketplace)
  if (req.method === 'GET') {
    if (apiKey) req.apiKey = apiKey;
    return next();
  }

  // Bot/webhook endpoints are public (POST from WhatsApp, Telegram, etc.)
  if (req.originalUrl.startsWith('/api/bot')) {
    if (apiKey) req.apiKey = apiKey;
    return next();
  }
  
  // For mutations (POST/PUT/DELETE), require API key
  if (!apiKey) {
    return res.status(401).json({ error: 'API key required', code: 'AUTH_REQUIRED' });
  }
  
  // Store the API key for downstream use (agent lookup)
  req.apiKey = apiKey;
  next();
}

// Generate a new API key for an agent
function generateApiKey() {
  return 'cm_' + crypto.randomBytes(24).toString('hex');
}

module.exports = { authMiddleware, generateApiKey };
