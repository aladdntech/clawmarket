const config = require('../shared/config');
const { formatResponse } = require('../bot/formatters');
const createTelegramRouter = require('./telegram');
const createWhatsAppRouter = require('./whatsapp');

const sessionMap = new Map();

function getSessionId(channel, userId) {
  const key = `${channel}:${userId}`;
  if (!sessionMap.has(key)) {
    sessionMap.set(key, key); // stable session id per channel/user
  }
  return sessionMap.get(key);
}

async function callBotMessage({ userId, message, channel = 'web' }) {
  const url = `http://127.0.0.1:${config.port}/api/bot/message`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, message, channel })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data || data.error) {
      return { error: data?.error || 'Bot request failed' };
    }
    return data.response ?? data;
  } catch (err) {
    console.error('Bot endpoint call failed:', err.message);
    return { error: 'Bot endpoint unreachable' };
  }
}

function formatChannelMessage(channel, botResponse) {
  if (!botResponse) return '';
  if (typeof botResponse === 'string') return botResponse;
  if (botResponse.response) botResponse = botResponse.response;
  return formatResponse(botResponse, channel);
}

function registerChannelRoutes(app) {
  app.use(
    '/api/webhooks/telegram',
    createTelegramRouter({ getSessionId, callBotMessage, formatChannelMessage })
  );
  app.use(
    '/api/webhooks/whatsapp',
    createWhatsAppRouter({ getSessionId, callBotMessage, formatChannelMessage })
  );
  return app;
}

module.exports = {
  registerChannelRoutes,
  getSessionId,
  formatChannelMessage
};
