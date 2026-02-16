// ─── Channel Formatters ──────────────────────────────────────
// Format bot responses for WhatsApp, Telegram, and Web clients

/**
 * Format generic data for WhatsApp (plain text, *bold*, lists)
 */
function formatForWhatsApp(data) {
  if (typeof data === 'string') return data;
  if (!data) return '';

  if (data.listings) return formatListings(data.listings, 'whatsapp');
  if (data.order) return formatOrder(data.order, 'whatsapp');
  if (data.agent) return formatAgentProfile(data.agent, 'whatsapp');
  if (data.message) return data.message;

  return JSON.stringify(data, null, 2);
}

/**
 * Format generic data for Telegram (markdown, structured)
 */
function formatForTelegram(data) {
  if (typeof data === 'string') return data;
  if (!data) return '';

  if (data.listings) return formatListings(data.listings, 'telegram');
  if (data.order) return formatOrder(data.order, 'telegram');
  if (data.agent) return formatAgentProfile(data.agent, 'telegram');
  if (data.message) return data.message;

  return JSON.stringify(data, null, 2);
}

/**
 * Format generic data for Web (structured JSON)
 */
function formatForWeb(data) {
  if (typeof data === 'string') return { message: data };
  return data || {};
}

/**
 * Format a list of listings for a given channel
 */
function formatListings(listings, channel) {
  if (!listings || listings.length === 0) {
    const msg = 'No listings found. Try different search terms or browse all available listings.';
    return channel === 'web' ? { message: msg, listings: [] } : msg;
  }

  if (channel === 'web') {
    return {
      message: `Found ${listings.length} listing${listings.length !== 1 ? 's' : ''}`,
      listings: listings.map(_sanitizeListing)
    };
  }

  if (channel === 'telegram') {
    let text = `🔍 *Found ${listings.length} listing${listings.length !== 1 ? 's' : ''}:*\n\n`;
    listings.forEach((l, i) => {
      const price = _formatPrice(l.price);
      text += `*${i + 1}. ${_esc(l.title)}*\n`;
      text += `💰 ${price}`;
      if (l.category) text += ` • 📁 ${_esc(l.category)}`;
      text += '\n';
      if (l.description) text += `${_truncate(_esc(l.description), 100)}\n`;
      text += `🆔 \`${l._id}\`\n\n`;
    });
    text += '💡 _Send the listing ID to see full details_';
    return text;
  }

  // WhatsApp (default)
  let text = `🔍 Found ${listings.length} listing${listings.length !== 1 ? 's' : ''}:\n\n`;
  listings.forEach((l, i) => {
    const price = _formatPrice(l.price);
    text += `*${i + 1}. ${l.title}*\n`;
    text += `💰 ${price}`;
    if (l.category) text += ` • 📁 ${l.category}`;
    text += '\n';
    if (l.description) text += `${_truncate(l.description, 100)}\n`;
    text += `🆔 ${l._id}\n\n`;
  });
  text += '💡 Send the listing ID to see full details';
  return text;
}

/**
 * Format an order for a given channel
 */
function formatOrder(order, channel) {
  if (!order) {
    const msg = 'Order not found.';
    return channel === 'web' ? { message: msg } : msg;
  }

  if (channel === 'web') {
    return {
      message: 'Order details',
      order: _sanitizeOrder(order)
    };
  }

  const statusEmoji = {
    pending: '⏳',
    confirmed: '✅',
    processing: '⚙️',
    shipped: '🚚',
    delivered: '📦',
    completed: '🎉',
    cancelled: '❌',
    disputed: '⚠️',
    refunded: '💸'
  };

  const emoji = statusEmoji[order.status] || '📋';
  const price = _formatPrice(order.price || order.amount);
  const date = order.createdAt ? new Date(order.createdAt).toLocaleDateString() : 'N/A';

  if (channel === 'telegram') {
    let text = `${emoji} *Order Details*\n\n`;
    text += `*Order #:* \`${order.orderNumber || order._id}\`\n`;
    text += `*Status:* ${order.status || 'unknown'}\n`;
    text += `*Amount:* ${price}\n`;
    text += `*Date:* ${date}\n`;
    if (order.listingTitle) text += `*Item:* ${_esc(order.listingTitle)}\n`;
    if (order.trackingNumber) text += `*Tracking:* \`${order.trackingNumber}\`\n`;
    return text;
  }

  // WhatsApp
  let text = `${emoji} *Order Details*\n\n`;
  text += `*Order #:* ${order.orderNumber || order._id}\n`;
  text += `*Status:* ${order.status || 'unknown'}\n`;
  text += `*Amount:* ${price}\n`;
  text += `*Date:* ${date}\n`;
  if (order.listingTitle) text += `*Item:* ${order.listingTitle}\n`;
  if (order.trackingNumber) text += `*Tracking:* ${order.trackingNumber}\n`;
  return text;
}

/**
 * Format an agent profile for a given channel
 */
function formatAgentProfile(agent, channel) {
  if (!agent) {
    const msg = 'Agent not found.';
    return channel === 'web' ? { message: msg } : msg;
  }

  if (channel === 'web') {
    return {
      message: 'Agent profile',
      agent: _sanitizeAgent(agent)
    };
  }

  const rating = agent.rating
    ? `${'⭐'.repeat(Math.round(agent.rating.average || 0))} (${agent.rating.count || 0} reviews)`
    : 'No ratings yet';

  if (channel === 'telegram') {
    let text = `🤖 *${_esc(agent.name)}*\n\n`;
    if (agent.description) text += `${_esc(agent.description)}\n\n`;
    text += `📁 *Category:* ${_esc(agent.category || 'General')}\n`;
    text += `⭐ *Rating:* ${rating}\n`;
    text += `📊 *Status:* ${agent.active ? '🟢 Active' : '🔴 Inactive'}\n`;
    text += `🆔 \`${agent._id}\`\n`;
    return text;
  }

  // WhatsApp
  let text = `🤖 *${agent.name}*\n\n`;
  if (agent.description) text += `${agent.description}\n\n`;
  text += `📁 *Category:* ${agent.category || 'General'}\n`;
  text += `⭐ *Rating:* ${rating}\n`;
  text += `📊 *Status:* ${agent.active ? '🟢 Active' : '🔴 Inactive'}\n`;
  text += `🆔 ${agent._id}\n`;
  return text;
}

/**
 * Format response based on channel
 */
function formatResponse(data, channel) {
  switch (channel) {
    case 'whatsapp': return formatForWhatsApp(data);
    case 'telegram': return formatForTelegram(data);
    case 'web': return formatForWeb(data);
    default: return formatForWhatsApp(data); // fallback to plain text
  }
}

// ─── Helpers ────────────────────────────────────────────────

function _formatPrice(price) {
  if (!price) return 'Price not set';
  if (typeof price === 'object') {
    return `${price.amount || 0} ${price.currency || 'USDT'}`;
  }
  return `${price} USDT`;
}

function _truncate(str, maxLen) {
  if (!str) return '';
  return str.length > maxLen ? str.substring(0, maxLen) + '...' : str;
}

function _esc(str) {
  if (!str) return '';
  // Escape Telegram markdown special chars
  return String(str).replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
}

function _sanitizeListing(listing) {
  if (!listing) return null;
  return {
    id: listing._id,
    title: listing.title,
    description: listing.description,
    price: listing.price,
    category: listing.category,
    type: listing.type,
    condition: listing.condition,
    available: listing.available,
    tags: listing.tags
  };
}

function _sanitizeOrder(order) {
  if (!order) return null;
  return {
    id: order._id,
    orderNumber: order.orderNumber,
    status: order.status,
    price: order.price || order.amount,
    listingTitle: order.listingTitle,
    createdAt: order.createdAt,
    trackingNumber: order.trackingNumber
  };
}

function _sanitizeAgent(agent) {
  if (!agent) return null;
  return {
    id: agent._id,
    name: agent.name,
    description: agent.description,
    category: agent.category,
    rating: agent.rating,
    active: agent.active
  };
}

module.exports = {
  formatForWhatsApp,
  formatForTelegram,
  formatForWeb,
  formatListings,
  formatOrder,
  formatAgentProfile,
  formatResponse
};
