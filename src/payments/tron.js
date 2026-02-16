// src/payments/tron.js — TRON blockchain operations (TRC20 USDT)

const { TronWeb } = require('tronweb');
const config = require('../shared/config');

const USDT_CONTRACT = config.tron.usdtContract; // TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t
const USDT_DECIMALS = 6;

/**
 * Create and return a TronWeb instance configured with escrow wallet credentials.
 * @returns {TronWeb}
 */
function initTronWeb() {
  const opts = {
    fullHost: config.tron.fullHost || 'https://api.trongrid.io'
  };

  if (config.tron.escrowPrivateKey) {
    opts.privateKey = config.tron.escrowPrivateKey;
  }

  if (config.tron.apiKey) {
    opts.headers = { 'TRON-PRO-API-KEY': config.tron.apiKey };
  }

  const tronWeb = new TronWeb(opts);
  return tronWeb;
}

/**
 * Get USDT (TRC20) balance for any TRON address.
 * @param {string} address - base58 TRON address
 * @returns {Promise<number>} balance in human-readable USDT (e.g. 10.5)
 */
async function getUSDTBalance(address) {
  try {
    const tronWeb = initTronWeb();
    const contract = await tronWeb.contract().at(USDT_CONTRACT);
    const raw = await contract.methods.balanceOf(address).call();
    // raw can be a BigNumber or hex string; convert to number
    const balance = Number(raw) / Math.pow(10, USDT_DECIMALS);
    console.log(`[TRON] USDT balance for ${address}: ${balance}`);
    return balance;
  } catch (err) {
    console.error(`[TRON] Failed to get USDT balance for ${address}:`, err.message);
    return 0;
  }
}

/**
 * Query TronGrid API for recent TRC20 transfers TO the given address.
 * @param {string} address - base58 TRON address to check
 * @param {number} sinceTimestamp - Unix ms timestamp; only return txns after this
 * @returns {Promise<Array<{txHash: string, from: string, to: string, amount: number, timestamp: number}>>}
 */
async function checkIncomingUSDT(address, sinceTimestamp = 0) {
  try {
    const url = `https://api.trongrid.io/v1/accounts/${address}/transactions/trc20`
      + `?only_to=true&limit=50&contract_address=${USDT_CONTRACT}`;

    const headers = {};
    if (config.tron.apiKey) {
      headers['TRON-PRO-API-KEY'] = config.tron.apiKey;
    }

    const resp = await fetch(url, { headers });
    if (!resp.ok) {
      console.error(`[TRON] TronGrid API error: ${resp.status} ${resp.statusText}`);
      return [];
    }

    const body = await resp.json();
    const data = body.data || [];

    const transfers = data
      .filter(tx => tx.block_timestamp >= sinceTimestamp)
      .map(tx => ({
        txHash: tx.transaction_id,
        from: tx.from,
        to: tx.to,
        amount: Number(tx.value) / Math.pow(10, tx.token_info?.decimals || USDT_DECIMALS),
        timestamp: tx.block_timestamp
      }));

    console.log(`[TRON] Found ${transfers.length} incoming USDT transfers to ${address} since ${sinceTimestamp}`);
    return transfers;
  } catch (err) {
    console.error(`[TRON] Failed to check incoming USDT for ${address}:`, err.message);
    return [];
  }
}

/**
 * Send USDT from escrow wallet to a destination address.
 * @param {string} toAddress - base58 TRON address
 * @param {number} amount - human-readable USDT amount (e.g. 100.5)
 * @returns {Promise<string>} transaction hash
 */
async function sendUSDT(toAddress, amount) {
  const tronWeb = initTronWeb();

  if (!config.tron.escrowPrivateKey) {
    throw new Error('[TRON] Escrow private key not configured — cannot send USDT');
  }

  const rawAmount = Math.round(amount * Math.pow(10, USDT_DECIMALS));

  console.log(`[TRON] Sending ${amount} USDT (${rawAmount} raw) to ${toAddress}...`);

  try {
    const contract = await tronWeb.contract().at(USDT_CONTRACT);
    const tx = await contract.methods.transfer(toAddress, rawAmount).send({
      feeLimit: 100_000_000, // 100 TRX fee limit
      callValue: 0
    });

    // tx is typically the txHash string
    const txHash = typeof tx === 'string' ? tx : tx.txid || tx.transaction?.txID || String(tx);
    console.log(`[TRON] USDT transfer sent: ${txHash}`);
    return txHash;
  } catch (err) {
    console.error(`[TRON] Failed to send ${amount} USDT to ${toAddress}:`, err.message);
    throw err;
  }
}

module.exports = {
  initTronWeb,
  getUSDTBalance,
  checkIncomingUSDT,
  sendUSDT
};
