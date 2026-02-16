const express = require('express');

function createTelegramRouter({ getSessionId, callBotMessage, formatChannelMessage }) {
  const router = express.Router();
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;

  router.post('/setup', async (req, res) => {
    try {
      if (!token) return res.status(400).json({ error: 'Missing TELEGRAM_BOT_TOKEN' });
      const { url } = req.body || {};
      if (!url) return res.status(400).json({ error: 'Missing webhook url' });

      const result = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, secret_token: secret })
      });
      const data = await result.json().catch(() => ({}));
      res.status(result.ok ? 200 : 400).json(data);
    } catch (err) {
      console.error('Telegram setup error:', err.message);
      res.status(500).json({ error: 'Failed to set webhook' });
    }
  });

  router.post('/', async (req, res) => {
    try {
      if (secret) {
        const headerSecret = req.headers['x-telegram-bot-api-secret-token'];
        if (headerSecret !== secret) {
          return res.status(401).json({ status: 'unauthorized' });
        }
      }

      const update = req.body || {};
      const { messageText, chatId, userId } = extractTelegramUpdate(update);

      if (!messageText || !chatId || !userId) {
        return res.status(200).json({ status: 'ok', note: 'non-text update ignored' });
      }

      const sessionId = getSessionId('telegram', userId);
      const botResponse = await callBotMessage({ userId: sessionId, message: messageText, channel: 'web' });
      const text = formatChannelMessage('telegram', botResponse);
      const replyMarkup = buildInlineKeyboard(botResponse);

      await sendTelegramMessage({ token, chatId, text, replyMarkup });
      res.status(200).json({ status: 'ok' });
    } catch (err) {
      console.error('Telegram webhook error:', err.message);
      res.status(200).json({ status: 'error', message: err.message });
    }
  });

  return router;
}

function extractTelegramUpdate(update) {
  if (update.callback_query) {
    const cq = update.callback_query;
    const chatId = cq.message?.chat?.id;
    const userId = cq.from?.id;
    const data = cq.data || '';
    const messageText = data.startsWith('buy:')
      ? `buy ${data.replace('buy:', '')}`
      : data.startsWith('details:')
        ? `details ${data.replace('details:', '')}`
        : data;
    return { messageText, chatId, userId };
  }

  const msg = update.message || update.edited_message;
  if (!msg || !msg.text) return { messageText: null };
  return { messageText: msg.text, chatId: msg.chat?.id, userId: msg.from?.id };
}

function buildInlineKeyboard(botResponse) {
  const listings = botResponse?.listings || botResponse?.response?.listings;
  if (!Array.isArray(listings) || listings.length === 0) return undefined;

  const keyboard = listings.slice(0, 5).map((l) => ([
    { text: 'Buy', callback_data: `buy:${l._id || l.id}` },
    { text: 'Details', callback_data: `details:${l._id || l.id}` }
  ]));

  return { inline_keyboard: keyboard };
}

async function sendTelegramMessage({ token, chatId, text, replyMarkup }) {
  if (!token) {
    console.warn('TELEGRAM_BOT_TOKEN not set; skipping sendMessage');
    return;
  }
  if (!text) return;

  try {
    const payload = {
      chat_id: chatId,
      text,
      parse_mode: 'Markdown'
    };
    if (replyMarkup) payload.reply_markup = replyMarkup;

    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    console.error('Telegram sendMessage failed:', err.message);
  }
}

module.exports = createTelegramRouter;
