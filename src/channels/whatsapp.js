const express = require('express');

function createWhatsAppRouter({ getSessionId, callBotMessage, formatChannelMessage }) {
  const router = express.Router();
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  router.get('/', (req, res) => {
    try {
      const mode = req.query['hub.mode'];
      const token = req.query['hub.verify_token'];
      const challenge = req.query['hub.challenge'];
      if (mode === 'subscribe' && token && token === verifyToken) {
        return res.status(200).send(challenge);
      }
      res.status(403).send('Verification failed');
    } catch (err) {
      console.error('WhatsApp verify error:', err.message);
      res.status(500).send('Error');
    }
  });

  router.post('/', async (req, res) => {
    try {
      const body = req.body || {};
      const messageData = extractWhatsAppMessage(body);
      if (!messageData || !messageData.text) {
        return res.status(200).json({ status: 'ok', note: 'non-text message ignored' });
      }

      const sessionId = getSessionId('whatsapp', messageData.from);
      const botResponse = await callBotMessage({ userId: sessionId, message: messageData.text, channel: 'web' });
      const text = formatChannelMessage('whatsapp', botResponse);

      await sendWhatsAppMessage({ accessToken, phoneNumberId, to: messageData.from, text });
      res.status(200).json({ status: 'ok' });
    } catch (err) {
      console.error('WhatsApp webhook error:', err.message);
      res.status(200).json({ status: 'error', message: err.message });
    }
  });

  return router;
}

function extractWhatsAppMessage(body) {
  const entry = body.entry?.[0];
  const changes = entry?.changes?.[0];
  const value = changes?.value;
  const message = value?.messages?.[0];
  if (!message) return null;

  let text = null;
  switch (message.type) {
    case 'text':
      text = message.text?.body || null;
      break;
    case 'interactive':
      text = message.interactive?.button_reply?.title
        || message.interactive?.list_reply?.title
        || null;
      break;
    case 'button':
      text = message.button?.text || null;
      break;
    default:
      text = null;
  }

  return { from: message.from, text };
}

async function sendWhatsAppMessage({ accessToken, phoneNumberId, to, text }) {
  if (!accessToken || !phoneNumberId) {
    console.warn('WhatsApp credentials missing; skipping message send');
    return;
  }
  if (!text) return;

  try {
    await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        text: { body: text }
      })
    });
  } catch (err) {
    console.error('WhatsApp send failed:', err.message);
  }
}

module.exports = createWhatsAppRouter;
