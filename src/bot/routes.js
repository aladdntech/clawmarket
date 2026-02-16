const express = require('express');
const { processMessage } = require('./orchestrator');
const { getSession, clearSession } = require('./session');
const { ValidationError } = require('../shared/errors');

const router = express.Router();

// ─── POST /api/bot/message ─── Generic message endpoint ────
router.post('/message', async (req, res) => {
  try {
    const { userId, message, channel } = req.body;

    if (!userId || !message) {
      return res.status(400).json({
        error: 'Missing required fields: userId, message',
        code: 'VALIDATION_ERROR'
      });
    }

    const response = await processMessage(
      String(userId),
      String(message),
      channel || 'web'
    );

    res.json({
      success: true,
      response,
      channel: channel || 'web'
    });
  } catch (err) {
    console.error('Bot message error:', err);
    res.status(500).json({
      error: 'Failed to process message',
      code: 'BOT_ERROR'
    });
  }
});

// ─── POST /api/bot/whatsapp ─── WhatsApp webhook ───────────
router.post('/whatsapp', async (req, res) => {
  try {
    // WhatsApp Cloud API webhook format
    const body = req.body;

    // Webhook verification (GET handled separately, but some providers POST)
    if (body['hub.mode'] === 'subscribe') {
      return res.status(200).send(body['hub.challenge'] || 'OK');
    }

    // Extract message from WhatsApp webhook payload
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const messageData = value?.messages?.[0];

    if (!messageData) {
      // Status update or other non-message webhook — acknowledge
      return res.status(200).json({ status: 'ok' });
    }

    const userId = messageData.from; // WhatsApp phone number
    const message = _extractWhatsAppText(messageData);

    if (!message) {
      return res.status(200).json({ status: 'ok', note: 'non-text message ignored' });
    }

    const response = await processMessage(userId, message, 'whatsapp');

    // In production, you'd send this back via WhatsApp API
    // For now, return it in the response
    res.json({
      success: true,
      to: userId,
      response
    });
  } catch (err) {
    console.error('WhatsApp webhook error:', err);
    // Always 200 to WhatsApp to prevent retries
    res.status(200).json({ status: 'error', message: err.message });
  }
});

// ─── POST /api/bot/telegram ─── Telegram webhook ───────────
router.post('/telegram', async (req, res) => {
  try {
    const update = req.body;

    // Extract message from Telegram update
    const telegramMessage = update.message || update.edited_message;

    if (!telegramMessage || !telegramMessage.text) {
      return res.status(200).json({ status: 'ok', note: 'non-text update ignored' });
    }

    const userId = String(telegramMessage.from.id);
    const message = telegramMessage.text;
    const chatId = telegramMessage.chat.id;

    const response = await processMessage(userId, message, 'telegram');

    // In production, you'd call Telegram sendMessage API
    // For now, return the response
    res.json({
      success: true,
      method: 'sendMessage',
      chat_id: chatId,
      text: response,
      parse_mode: 'Markdown'
    });
  } catch (err) {
    console.error('Telegram webhook error:', err);
    // Always 200 to Telegram to prevent retries
    res.status(200).json({ status: 'error', message: err.message });
  }
});

// ─── GET /api/bot/session/:id ─── Get session state ────────
router.get('/session/:id', async (req, res) => {
  try {
    const session = await getSession(req.params.id);
    res.json({ success: true, session });
  } catch (err) {
    console.error('Session get error:', err);
    res.status(500).json({ error: 'Failed to get session', code: 'SESSION_ERROR' });
  }
});

// ─── DELETE /api/bot/session/:id ─── Clear session ─────────
router.delete('/session/:id', async (req, res) => {
  try {
    await clearSession(req.params.id);
    res.json({ success: true, message: 'Session cleared' });
  } catch (err) {
    console.error('Session clear error:', err);
    res.status(500).json({ error: 'Failed to clear session', code: 'SESSION_ERROR' });
  }
});

// ─── Helper: Extract text from WhatsApp message types ──────
function _extractWhatsAppText(messageData) {
  if (!messageData) return null;

  switch (messageData.type) {
    case 'text':
      return messageData.text?.body || null;
    case 'interactive':
      // Button reply or list reply
      return messageData.interactive?.button_reply?.title
        || messageData.interactive?.list_reply?.title
        || null;
    case 'button':
      return messageData.button?.text || null;
    default:
      return null;
  }
}

module.exports = router;
