const { ObjectId } = require('mongodb');
const { getCollection } = require('../shared/db');
const { agentExecute, callLLM } = require('../shared/langchain');
const { logAudit } = require('../shared/audit');
const { getSession, addToHistory } = require('./session');
const { formatResponse, formatListings, formatOrder, formatAgentProfile } = require('./formatters');

// ─── System Prompt ──────────────────────────────────────────

const SYSTEM_PROMPT = `You are the ClawMarket assistant — a friendly, knowledgeable guide for an AI-powered marketplace where autonomous agents buy and sell digital goods and services.

Your personality:
- Warm and conversational, never robotic
- Concise but helpful — don't dump walls of text
- You understand crypto (USDT/TRC-20) payments naturally
- You proactively suggest next steps

What you can do:
- Search and browse marketplace listings
- Show listing details
- Search for and view agent profiles
- Help users place orders
- Check order status
- List a user's orders

Guidelines:
- ALWAYS use the provided tools to fetch real data. NEVER invent listings, prices, agents, or orders.
- If a search returns no results, say so honestly and suggest alternatives.
- When showing listings or agents, use the tool — don't make up examples.
- For orders, always confirm details before creating.
- Keep responses focused and natural.
- If someone greets you, be friendly and briefly explain what you can help with.
- If you don't understand a request, ask for clarification.`;

// ─── Tool Definitions ───────────────────────────────────────

function buildTools(userId) {
  return [
    {
      name: 'search_listings',
      description: 'Search marketplace listings. Call with no params to get latest listings. Use query for keyword search, category to filter, minPrice/maxPrice for price range. Always call this when users want to browse or see listings.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search keywords (searches title, description, tags)' },
          category: { type: 'string', description: 'Filter by category' },
          minPrice: { type: 'number', description: 'Minimum price in USDT' },
          maxPrice: { type: 'number', description: 'Maximum price in USDT' },
          limit: { type: 'number', description: 'Max results to return (default 5)' }
        }
      },
      execute: async (params) => {
        const filter = { available: true };

        if (params.query) {
          filter.$text = { $search: params.query };
        }
        if (params.category) {
          filter.category = { $regex: params.category, $options: 'i' };
        }
        if (params.minPrice || params.maxPrice) {
          filter['price.amount'] = {};
          if (params.minPrice) filter['price.amount'].$gte = params.minPrice;
          if (params.maxPrice) filter['price.amount'].$lte = params.maxPrice;
        }

        const limit = Math.min(params.limit || 5, 10);
        let listings = await getCollection('listings')
          .find(filter)
          .limit(limit)
          .sort(params.query ? { score: { $meta: 'textScore' } } : { createdAt: -1 })
          .toArray();

        // Fallback: if text search returned nothing, try without $text but sort by price
        if (listings.length === 0 && params.query) {
          delete filter.$text;
          // Try regex on title/description instead
          filter.$or = [
            { title: { $regex: params.query.split(/\s+/).join('|'), $options: 'i' } },
            { description: { $regex: params.query.split(/\s+/).join('|'), $options: 'i' } }
          ];
          listings = await getCollection('listings')
            .find(filter)
            .limit(limit)
            .sort({ 'price.amount': 1 })
            .toArray();
        }

        // If still nothing and we have price filters, just return cheapest available
        if (listings.length === 0 && (params.minPrice !== undefined || params.maxPrice !== undefined)) {
          const priceFilter = { available: true };
          if (params.minPrice) priceFilter['price.amount'] = { $gte: params.minPrice };
          if (params.maxPrice) priceFilter['price.amount'] = { ...priceFilter['price.amount'], $lte: params.maxPrice };
          listings = await getCollection('listings')
            .find(priceFilter)
            .limit(limit)
            .sort({ 'price.amount': 1 })
            .toArray();
        }

        return { listings, count: listings.length };
      }
    },
    {
      name: 'view_listing',
      description: 'Get full details of a specific listing by its ID',
      parameters: {
        type: 'object',
        properties: {
          listingId: { type: 'string', description: 'The listing ID' }
        },
        required: ['listingId']
      },
      execute: async (params) => {
        if (!ObjectId.isValid(params.listingId)) {
          return { error: 'Invalid listing ID format' };
        }
        const listing = await getCollection('listings').findOne({
          _id: new ObjectId(params.listingId)
        });
        if (!listing) return { error: 'Listing not found' };
        return { listing };
      }
    },
    {
      name: 'search_agents',
      description: 'Search for agents/sellers on the marketplace by name or category',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search by agent name or description' },
          category: { type: 'string', description: 'Filter by agent category' },
          limit: { type: 'number', description: 'Max results (default 5)' }
        }
      },
      execute: async (params) => {
        const filter = { active: true };

        if (params.query) {
          filter.$text = { $search: params.query };
        }
        if (params.category) {
          filter.category = { $regex: params.category, $options: 'i' };
        }

        const limit = Math.min(params.limit || 5, 10);
        const agents = await getCollection('agents')
          .find(filter)
          .limit(limit)
          .project({ apiKey: 0 }) // never expose API keys
          .sort({ 'rating.average': -1 })
          .toArray();

        return { agents, count: agents.length };
      }
    },
    {
      name: 'view_agent',
      description: 'Get the profile of a specific agent by ID',
      parameters: {
        type: 'object',
        properties: {
          agentId: { type: 'string', description: 'The agent ID' }
        },
        required: ['agentId']
      },
      execute: async (params) => {
        if (!ObjectId.isValid(params.agentId)) {
          return { error: 'Invalid agent ID format' };
        }
        const agent = await getCollection('agents').findOne(
          { _id: new ObjectId(params.agentId) },
          { projection: { apiKey: 0 } }
        );
        if (!agent) return { error: 'Agent not found' };
        return { agent };
      }
    },
    {
      name: 'create_order',
      description: 'Create a purchase order for a listing. Requires listing ID and buyer agent ID.',
      parameters: {
        type: 'object',
        properties: {
          listingId: { type: 'string', description: 'The listing to purchase' },
          buyerAgentId: { type: 'string', description: 'The buyer agent ID' },
          notes: { type: 'string', description: 'Optional notes for the seller' }
        },
        required: ['listingId', 'buyerAgentId']
      },
      execute: async (params) => {
        if (!ObjectId.isValid(params.listingId)) return { error: 'Invalid listing ID' };
        if (!ObjectId.isValid(params.buyerAgentId)) return { error: 'Invalid buyer agent ID' };

        // Fetch listing
        const listing = await getCollection('listings').findOne({
          _id: new ObjectId(params.listingId),
          available: true
        });
        if (!listing) return { error: 'Listing not found or unavailable' };

        // Fetch buyer agent
        const buyerAgent = await getCollection('agents').findOne({
          _id: new ObjectId(params.buyerAgentId)
        });
        if (!buyerAgent) return { error: 'Buyer agent not found' };

        // Generate order number
        const orderNumber = `CM-${Date.now().toString(36).toUpperCase()}`;

        const order = {
          orderNumber,
          listingId: listing._id.toString(),
          listingTitle: listing.title,
          sellerAgentId: listing.agentId,
          buyerAgentId: params.buyerAgentId,
          price: listing.price,
          status: 'pending',
          notes: params.notes || null,
          channel: 'bot',
          initiatedBy: userId,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        const result = await getCollection('orders').insertOne(order);
        order._id = result.insertedId;

        await logAudit(
          'order.create',
          'bot_user',
          userId,
          'order',
          result.insertedId.toString(),
          {
            orderNumber,
            listingId: params.listingId,
            buyerAgentId: params.buyerAgentId,
            amount: listing.price,
            channel: 'bot'
          }
        );

        return { order, message: 'Order created successfully!' };
      }
    },
    {
      name: 'check_order',
      description: 'Check the status of a specific order by order number or ID',
      parameters: {
        type: 'object',
        properties: {
          orderId: { type: 'string', description: 'Order ID or order number (e.g. CM-XXXXX)' }
        },
        required: ['orderId']
      },
      execute: async (params) => {
        let order;

        // Try by order number first
        order = await getCollection('orders').findOne({ orderNumber: params.orderId });

        // Try by ObjectId
        if (!order && ObjectId.isValid(params.orderId)) {
          order = await getCollection('orders').findOne({ _id: new ObjectId(params.orderId) });
        }

        if (!order) return { error: 'Order not found' };
        return { order };
      }
    },
    {
      name: 'my_orders',
      description: 'List orders for a given agent (as buyer or seller)',
      parameters: {
        type: 'object',
        properties: {
          agentId: { type: 'string', description: 'Agent ID to find orders for' },
          status: { type: 'string', description: 'Filter by status (pending, confirmed, completed, etc.)' },
          limit: { type: 'number', description: 'Max orders to return (default 5)' }
        },
        required: ['agentId']
      },
      execute: async (params) => {
        if (!ObjectId.isValid(params.agentId)) return { error: 'Invalid agent ID' };

        const filter = {
          $or: [
            { buyerAgentId: params.agentId },
            { sellerAgentId: params.agentId }
          ]
        };

        if (params.status) {
          filter.status = params.status;
        }

        const limit = Math.min(params.limit || 5, 20);
        const orders = await getCollection('orders')
          .find(filter)
          .limit(limit)
          .sort({ createdAt: -1 })
          .toArray();

        return { orders, count: orders.length };
      }
    },
    {
      name: 'help',
      description: 'Show what the bot can do and available commands',
      parameters: {
        type: 'object',
        properties: {}
      },
      execute: async () => {
        return {
          message: `Here's what I can help you with:

🔍 *Browse & Search* — Find listings by keyword, category, or price range
📋 *Listing Details* — Get full info on any listing (just send me the ID)
🤖 *Find Agents* — Search for sellers and view their profiles
🛒 *Place Orders* — Purchase listings through the marketplace
📦 *Check Orders* — Track your order status
📜 *My Orders* — See all your recent orders

Just tell me what you need in plain language! For example:
• "Show me the latest listings"
• "Search for data analysis agents"
• "What's the status of order CM-ABC123?"
• "I want to buy listing 507f1f77bcf86cd799439011"`
        };
      }
    }
  ];
}

// ─── Main Entry Point ───────────────────────────────────────

/**
 * Process an incoming message from any channel
 * @param {string} userId - Unique user identifier
 * @param {string} message - User's message text
 * @param {string} channel - Channel: 'whatsapp', 'telegram', 'web'
 * @returns {string|object} Formatted response for the channel
 */
async function processMessage(userId, message, channel = 'web') {
  try {
    // Get session and record user message
    const session = await getSession(userId);
    await addToHistory(userId, 'user', message);

    // Build context from session history
    const historyContext = session.history
      .map(h => `${h.role}: ${h.content}`)
      .join('\n');

    const contextualMessage = historyContext
      ? `[Conversation history]\n${historyContext}\n\n[Current message]\n${message}`
      : message;

    // Execute with tools
    const tools = buildTools(userId);
    const result = await agentExecute(SYSTEM_PROMPT, contextualMessage, tools, {
      temperature: 0.3
    });

    let response;

    if (result.error) {
      response = `Sorry, something went wrong: ${result.error}. Please try again.`;
    } else if (result.response) {
      // Direct text response from the LLM (no tool used)
      response = typeof result.response === 'string'
        ? result.response
        : formatResponse(result.response, channel);
    } else if (result.tool && result.result) {
      // Tool was executed — format the result with LLM for natural language
      const toolResult = result.result;

      if (toolResult.error) {
        response = `I ran into an issue: ${toolResult.error}`;
      } else {
        // Use the LLM to turn raw tool output into a natural response
        response = await _naturalizeToolResult(result.tool, toolResult, message, channel);
      }
    } else {
      response = "I'm not sure how to help with that. Try asking me to search listings, check orders, or type 'help' for options.";
    }

    // Record assistant response in history
    const responseText = typeof response === 'string' ? response : JSON.stringify(response);
    await addToHistory(userId, 'assistant', responseText);

    return response;
  } catch (err) {
    console.error('Bot processMessage error:', err);
    return channel === 'web'
      ? { error: 'Something went wrong. Please try again in a moment.', code: 'BOT_ERROR' }
      : "Oops, something went wrong on my end 😅 Please try again in a moment.";
  }
}

/**
 * Turn raw tool output into a natural-sounding response,
 * or use direct formatting for structured data
 */
async function _naturalizeToolResult(toolName, toolResult, originalMessage, channel) {
  // For structured data, format directly without another LLM call
  if (toolName === 'search_listings' && toolResult.listings) {
    return formatListings(toolResult.listings, channel);
  }
  if (toolName === 'view_listing' && toolResult.listing) {
    const formatted = formatResponse({ listings: [toolResult.listing] }, channel);
    return formatted;
  }
  if (toolName === 'search_agents' && toolResult.agents) {
    if (toolResult.agents.length === 0) {
      return 'No agents found matching your search. Try different keywords or browse all agents.';
    }
    if (channel === 'web') {
      return { message: `Found ${toolResult.count} agent(s)`, agents: toolResult.agents };
    }
    let text = `🤖 Found ${toolResult.count} agent${toolResult.count !== 1 ? 's' : ''}:\n\n`;
    toolResult.agents.forEach((a, i) => {
      text += formatAgentProfile(a, channel) + '\n';
    });
    return text;
  }
  if (toolName === 'view_agent' && toolResult.agent) {
    return formatAgentProfile(toolResult.agent, channel);
  }
  if (toolName === 'create_order' && toolResult.order) {
    const prefix = '🎉 *Order placed successfully!*\n\n';
    return prefix + formatOrder(toolResult.order, channel);
  }
  if (toolName === 'check_order' && toolResult.order) {
    return formatOrder(toolResult.order, channel);
  }
  if (toolName === 'my_orders' && toolResult.orders) {
    if (toolResult.orders.length === 0) {
      return 'No orders found for this agent.';
    }
    if (channel === 'web') {
      return { message: `Found ${toolResult.count} order(s)`, orders: toolResult.orders };
    }
    let text = `📦 *Your Orders* (${toolResult.count}):\n\n`;
    toolResult.orders.forEach(o => {
      text += formatOrder(o, channel) + '\n---\n\n';
    });
    return text;
  }
  if (toolName === 'help') {
    return formatResponse(toolResult, channel);
  }

  // Fallback: let LLM summarize
  try {
    const summary = await callLLM([
      { role: 'system', content: 'Summarize this tool result naturally and concisely for the user. Be friendly.' },
      { role: 'user', content: `User asked: "${originalMessage}"\nTool "${toolName}" returned: ${JSON.stringify(toolResult)}` }
    ], { maxTokens: 500 });
    return summary;
  } catch {
    return formatResponse(toolResult, channel);
  }
}

module.exports = { processMessage };
