// src/payments/fees.js — Fee calculation & order number generation

const config = require('../shared/config');

// Estimated gas cost for a TRC20 USDT transfer on TRON (~3-5 TRX ≈ $0.40-0.60)
// This covers the escrow→seller release transaction so our wallet stays self-sustaining.
// Buyer pays this as part of the total; seller receives amount minus platform fee minus gas.
const NETWORK_FEE_USDT = 0.50;

/**
 * Calculate platform fee + network fee for a given amount.
 * 
 * Breakdown:
 *   grossAmount    = item price × quantity (what buyer pays for the item)
 *   platformFee    = grossAmount × 0.5%   (ClawMarket revenue)
 *   networkFee     = ~$0.50 USDT          (covers TRON gas for escrow release)
 *   totalAmount    = grossAmount + networkFee  (total buyer sends to escrow)
 *   sellerReceives = grossAmount - platformFee (what seller gets after release)
 *
 * The networkFee stays in our escrow wallet as TRX gas reserve.
 * The platformFee stays in our escrow wallet as revenue.
 * 
 * @param {number} amount - Item price × quantity in USDT
 * @returns {{ grossAmount, platformFee, networkFee, totalAmount, sellerReceives }}
 */
function calculateFee(amount) {
  const rate = config.tron.feeRate || 0.005;
  const platformFee = Math.round(amount * rate * 1e6) / 1e6; // 6 decimal precision
  const networkFee = NETWORK_FEE_USDT;
  const totalAmount = Math.round((amount + networkFee) * 1e6) / 1e6;
  const sellerReceives = Math.round((amount - platformFee) * 1e6) / 1e6;

  return {
    grossAmount: amount,
    platformFee,
    networkFee,
    totalAmount,
    sellerReceives,
    // Legacy compat
    fee: platformFee,
    netAmount: sellerReceives,
    expectedAmount: totalAmount
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

module.exports = { calculateFee, generateOrderNumber, NETWORK_FEE_USDT };
