// src/payments/fees.js — Fee calculation & order number generation

const config = require('../shared/config');

/**
 * Calculate platform fee for a given amount
 * @param {number} amount - Gross amount in USDT
 * @returns {{ grossAmount: number, fee: number, netAmount: number }}
 */
function calculateFee(amount) {
  const rate = config.tron.feeRate || 0.005;
  const fee = Math.round(amount * rate * 1e6) / 1e6; // 6 decimal precision (USDT)
  const netAmount = Math.round((amount - fee) * 1e6) / 1e6;
  return {
    grossAmount: amount,
    fee,
    netAmount
  };
}

/**
 * Generate a unique order number in CM-YYYYMMDD-XXXX format
 * @returns {string}
 */
function generateOrderNumber() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const rand = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  return `CM-${y}${m}${d}-${rand}`;
}

module.exports = { calculateFee, generateOrderNumber };
