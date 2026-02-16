// src/shared/email.js — basic SMTP email helper (OTP + order notifications)

let nodemailer = null;
try {
  // Optional dependency — if not installed, we fallback to console logs
  // eslint-disable-next-line global-require
  nodemailer = require('nodemailer');
} catch (err) {
  nodemailer = null;
}

const smtpConfig = {
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined,
  user: process.env.SMTP_USER,
  pass: process.env.SMTP_PASS,
  from: process.env.SMTP_FROM
};

function isSMTPConfigured() {
  return !!(smtpConfig.host && smtpConfig.port && smtpConfig.from);
}

let transporter = null;
function getTransporter() {
  if (!isSMTPConfigured()) return null;
  if (!nodemailer) return null;
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: smtpConfig.host,
    port: smtpConfig.port,
    secure: smtpConfig.port === 465,
    auth: smtpConfig.user && smtpConfig.pass ? {
      user: smtpConfig.user,
      pass: smtpConfig.pass
    } : undefined
  });
  return transporter;
}

function baseTemplate(title, bodyHtml) {
  return `
  <div style="font-family:Arial,sans-serif;background:#f6f6f6;padding:24px;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #eee;">
      <div style="background:#0f172a;color:#ffffff;padding:16px 24px;">
        <div style="font-size:18px;font-weight:700;">ClawMarket</div>
        <div style="font-size:12px;opacity:0.85;">AI Agent Marketplace</div>
      </div>
      <div style="padding:24px;">
        <h2 style="margin:0 0 12px 0;font-size:18px;color:#111827;">${title}</h2>
        <div style="font-size:14px;color:#374151;line-height:1.5;">${bodyHtml}</div>
      </div>
      <div style="padding:16px 24px;color:#6b7280;font-size:12px;border-top:1px solid #f0f0f0;">
        This is an automated message from ClawMarket. If you didn’t request this, you can ignore it.
      </div>
    </div>
  </div>`;
}

async function sendMail(to, subject, html) {
  const tx = getTransporter();
  if (!tx) {
    console.log('[EMAIL] SMTP not configured — skipping send');
    console.log('[EMAIL] To:', to);
    console.log('[EMAIL] Subject:', subject);
    console.log('[EMAIL] HTML:', html);
    return { skipped: true };
  }

  try {
    await tx.sendMail({
      from: smtpConfig.from,
      to,
      subject,
      html
    });
    return { sent: true };
  } catch (err) {
    console.error('[EMAIL] Failed to send:', err.message);
    return { error: err.message };
  }
}

async function sendOTP(email, code) {
  if (!email) return { skipped: true };
  const subject = 'Your ClawMarket verification code';
  const html = baseTemplate('Your verification code', `
    <p>Your one-time code is:</p>
    <div style="font-size:24px;font-weight:700;letter-spacing:2px;margin:12px 0;">${code}</div>
    <p>This code expires in 10–15 minutes.</p>
  `);
  return sendMail(email, subject, html);
}

async function sendWelcome(email, name) {
  if (!email) return { skipped: true };
  const subject = 'Welcome to ClawMarket';
  const html = baseTemplate('Welcome!', `
    <p>Hi ${name || 'there'},</p>
    <p>Thanks for joining ClawMarket. You can now browse, buy, and sell AI agent services with escrow protection.</p>
  `);
  return sendMail(email, subject, html);
}

async function sendOrderUpdate(email, orderData) {
  if (!email) return { skipped: true };
  const {
    event,
    role,
    orderNumber,
    listingTitle,
    status,
    amount,
    currency,
    trackingNumber,
    carrier
  } = orderData || {};

  const subject = `Order update: ${orderNumber || ''} ${event ? `(${event})` : ''}`.trim();
  const html = baseTemplate('Order update', `
    <p>Hello ${role || 'there'},</p>
    <p>Your order <strong>${orderNumber || ''}</strong> for <strong>${listingTitle || 'an item'}</strong> has a new update.</p>
    <ul style="padding-left:18px;">
      ${status ? `<li>Status: <strong>${status}</strong></li>` : ''}
      ${amount ? `<li>Amount: <strong>${amount} ${currency || 'USDT'}</strong></li>` : ''}
      ${carrier ? `<li>Carrier: <strong>${carrier}</strong></li>` : ''}
      ${trackingNumber ? `<li>Tracking #: <strong>${trackingNumber}</strong></li>` : ''}
    </ul>
    <p>Log in to ClawMarket for full details.</p>
  `);
  return sendMail(email, subject, html);
}

module.exports = {
  sendOTP,
  sendWelcome,
  sendOrderUpdate
};
