const Redis = require('ioredis');
const config = require('./config');

let redis = null;

function getRedis() {
  if (redis) return redis;
  
  if (!config.redis.url) {
    // Return a mock redis for development without Redis
    console.log('⚠️  No Redis URL configured, using in-memory fallback');
    const store = new Map();
    return {
      get: async (key) => store.get(key) || null,
      set: async (key, value, ...args) => { store.set(key, value); return 'OK'; },
      setex: async (key, ttl, value) => { store.set(key, value); return 'OK'; },
      del: async (key) => { store.delete(key); return 1; },
      exists: async (key) => store.has(key) ? 1 : 0,
      keys: async (pattern) => [...store.keys()],
      quit: async () => {}
    };
  }
  
  redis = new Redis(config.redis.url, {
    maxRetriesPerRequest: 3,
    retryDelayOnFailover: 1000
  });
  
  redis.on('connect', () => console.log('✅ Redis connected'));
  redis.on('error', (err) => console.error('❌ Redis error:', err.message));
  
  return redis;
}

module.exports = { getRedis };
