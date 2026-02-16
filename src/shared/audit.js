const { getCollection } = require('./db');

async function logAudit(action, actorType, actorId, targetType, targetId, details = {}) {
  try {
    await getCollection('audit_log').insertOne({
      action,
      actorType,
      actorId,
      targetType,
      targetId,
      details,
      timestamp: new Date()
    });
  } catch (err) {
    // Audit logging should never crash the app
    console.error('Audit log error:', err.message);
  }
}

module.exports = { logAudit };
