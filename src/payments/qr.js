// src/payments/qr.js — QR code generation helpers

const QRCode = require('qrcode');

function buildTronUri(address, amount, token = 'USDT') {
  const amt = amount !== undefined && amount !== null ? String(amount) : '';
  const query = amt ? `?amount=${amt}&token=${token}` : '';
  return `tron:${address}${query}`;
}

async function generatePaymentQR(address, amount, network = 'TRON (TRC20)') {
  let payload = String(address);
  if (network && network.toLowerCase().includes('tron')) {
    payload = buildTronUri(address, amount, 'USDT');
  }
  return QRCode.toDataURL(payload, { type: 'image/png', errorCorrectionLevel: 'M' });
}

async function generateAddressQR(address) {
  return QRCode.toDataURL(String(address), { type: 'image/png', errorCorrectionLevel: 'M' });
}

module.exports = { generatePaymentQR, generateAddressQR, buildTronUri };
