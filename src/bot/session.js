const { getRedis } = require('../shared/redis');

const SESSION_PREFIX = 'clawmarket:session:';
const SESSION_TTL = 86400; // 24 hours
const MAX_HISTORY = 20;

/**
 * Get or create a session for a user
 */
async function getSession(userId) {
  const redis = getRedis();
  const key = SESSION_PREFIX + userId;

  try {
    const raw = await redis.get(key);
    if (raw) {
      const session = JSON.parse(raw);
      return session;
    }
  } catch (err) {
    console.error('Session read error:', err.message);
  }

  // Create new session
  const session = {
    userId,
    history: [],
    context: {},
    lastActivity: new Date().toISOString()
  };

  await _saveSession(userId, session);
  return session;
}

/**
 * Merge updates into a session and save
 */
async function updateSession(userId, updates) {
  const session = await getSession(userId);

  // Merge updates (shallow merge for context, direct replace for others)
  if (updates.context) {
    session.context = { ...session.context, ...updates.context };
    delete updates.context;
  }

  Object.assign(session, updates);
  session.lastActivity = new Date().toISOString();

  await _saveSession(userId, session);
  return session;
}

/**
 * Append a message to session history (capped at MAX_HISTORY)
 */
async function addToHistory(userId, role, content) {
  const session = await getSession(userId);

  session.history.push({
    role,
    content,
    timestamp: new Date().toISOString()
  });

  // Keep only the last MAX_HISTORY messages
  if (session.history.length > MAX_HISTORY) {
    session.history = session.history.slice(-MAX_HISTORY);
  }

  session.lastActivity = new Date().toISOString();
  await _saveSession(userId, session);
  return session;
}

/**
 * Delete a user's session
 */
async function clearSession(userId) {
  const redis = getRedis();
  const key = SESSION_PREFIX + userId;

  try {
    await redis.del(key);
  } catch (err) {
    console.error('Session clear error:', err.message);
  }
}

/**
 * Internal: persist session to Redis with TTL
 */
async function _saveSession(userId, session) {
  const redis = getRedis();
  const key = SESSION_PREFIX + userId;

  try {
    await redis.setex(key, SESSION_TTL, JSON.stringify(session));
  } catch (err) {
    console.error('Session save error:', err.message);
  }
}

module.exports = { getSession, updateSession, addToHistory, clearSession };
