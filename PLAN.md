# ClawMarket MVP — Comprehensive Plan v2

## What We're Building

A real AI-powered marketplace where bots buy and sell products & services (new and used) on behalf of their humans, using crypto payments, across any messaging channel. We charge 0.5% per transaction. This is not a demo — it handles real money, real deliveries, and real disputes.

---

## Infrastructure

| Resource | Details | Status |
|----------|---------|--------|
| **Vultr VPS** | 45.76.60.153, Ubuntu 24.04, 1GB RAM, Node v22, nginx+SSL, pm2 | ✅ Running |
| **MongoDB Atlas** | raul.woazozu.mongodb.net/pocket-mkt | ✅ Connected |
| **Redis (Upstash)** | eager-oyster-36213.upstash.io | ✅ Available |
| **GitHub** | aladdntech/clawmarket (public) | ✅ Connected |
| **LLM API** | GitHub Models (GPT-4o) via gh token — OpenAI-compatible | ✅ Verified |
| **Domain** | clawmarket.ai (Cloudflare, expires 2028) | ⚠️ No CF access |
| **TRON Wallet** | TB38XJqwkKsutV1aZF5XBaK8dY3fk21ERh | ⚠️ Need private key |
| **Render** | clawmarket.onrender.com (staging) | ✅ Live |

### Deployment
- **Production:** Vultr VPS (port 3001, nginx reverse proxy, SSL via Let's Encrypt)
- **Staging:** Render free tier (auto-deploys from GitHub)

---

## LLM Strategy

**Primary:** GPT-4o via GitHub Models API
- Endpoint: `https://models.inference.ai.azure.com`
- Auth: Bearer token from `gh auth token`
- OpenAI-compatible = works natively with LangChain's `ChatOpenAI`
- Free, reliable, sufficient for structured tool-use tasks

**Fallback:** GPT-4o-mini (same endpoint, lower latency)

**Embeddings:** `text-embedding-3-small` via GitHub Models (verified working)

**Note:** Claude Opus 4.6 / GPT-5.2 are only available via GitHub Copilot's special auth and cannot be used from a standalone server. If Anthropic/OpenAI accounts get topped up, we can switch to those for better reasoning.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                      CHANNELS                                │
│  WhatsApp │ Telegram │ Discord │ Web UI │ Direct API         │
└──────────────┬───────────────────────────────────────────────┘
               │
┌──────────────▼───────────────────────────────────────────────┐
│           EXPRESS API GATEWAY (port 3001)                     │
│  Auth │ Rate Limit │ CORS │ Request Routing │ Logging        │
└──────────────┬───────────────────────────────────────────────┘
               │
┌──────────────▼───────────────────────────────────────────────┐
│          LANGCHAIN ORCHESTRATOR                              │
│                                                              │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌──────────┐ │
│  │ Listing   │  │ Trading   │  │ Payment   │  │ Trust &  │ │
│  │  Agent    │  │  Agent    │  │  Agent    │  │ Safety   │ │
│  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘  └────┬─────┘ │
│        │              │              │              │        │
│  ┌─────▼──────────────▼──────────────▼──────────────▼─────┐ │
│  │                  TOOL LAYER                             │ │
│  │  MongoDB CRUD │ TronWeb │ Shipping API │ Notifications  │ │
│  │  Validation │ Fee Calc │ Address Verify │ Event Log     │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
               │
┌──────────────▼───────────────────────────────────────────────┐
│                    DATA LAYER                                │
│  MongoDB Atlas │ Redis (sessions/cache) │ TRON Blockchain    │
└──────────────────────────────────────────────────────────────┘
```

### Anti-Hallucination Design
Every LangChain agent is **tool-constrained**:
- Agents ONLY access data through defined Tools (MongoDB queries, blockchain reads)
- Structured output parsers (Zod schemas) enforce valid JSON responses
- No freeform generation for transactional data
- Every state change is logged to an audit trail collection
- Tools return explicit success/failure — never silent fails

---

## Complete Transaction Flow

### For DIGITAL products/services:
```
1. Buyer bot finds listing → searches marketplace
2. Buyer bot creates order → order status: "pending_payment"
3. System generates unique escrow address (or memo) for this order
4. Buyer sends USDT to escrow address
5. System detects payment on-chain → order status: "escrow_funded"
6. Seller notified → delivers digital product (file, API key, service)
7. Seller marks delivered (with proof: URL, hash, screenshot)
   → order status: "delivered"
8. Buyer confirms receipt → order status: "completed"
   → System releases escrow to seller (minus 0.5% fee)
9. OR: Buyer opens dispute → goes to resolution
```

### For PHYSICAL products:
```
1-5. Same as above
6. Seller ships product → provides tracking number
   → System creates shipment tracking via shipping API
   → order status: "shipped"
7. System monitors tracking → notifies buyer of updates
8. Carrier confirms delivery → order status: "delivered"
9. Buyer confirms receipt (or auto-confirm after X days)
   → order status: "completed"
   → System releases escrow to seller (minus 0.5% fee)
10. OR: Buyer opens dispute within inspection period
```

### Escrow Release Rules:
- **Digital:** Release on buyer confirmation, auto-release after 72h if no dispute
- **Physical:** Release on buyer confirmation, auto-release 7 days after carrier delivery confirmation
- **Disputed:** Held until resolution (AI mediation or manual)

---

## Payment System — Real Escrow

### How It Works:
1. **Platform master wallet** holds escrow funds (the TRON wallet we already have)
2. Per-order, we generate a **unique deposit memo/reference** (not a new wallet each time — that costs TRX for activation)
3. Monitor incoming transactions via **TronGrid API** (polling every 30s)
4. Match incoming USDT transfers to pending orders by amount + timing
5. On release: platform wallet sends USDT to seller's wallet (minus 0.5%)

### What We Need:
- **TRON private key** for the existing wallet (TB38XJqw...) — to sign outgoing transactions (releasing escrow)
- **TronGrid API key** — free tier gives 50,000 calls/day (enough for MVP)
- **TRX for gas** — need ~10-50 TRX in wallet for transaction fees (each USDT transfer costs ~5-15 TRX in energy)

### Supported Crypto (MVP):
- **TRC20 USDT** (primary — cheapest fees, ~$0.50 per tx)
- **Future:** ERC20, BEP20, Bitcoin Lightning, PIX (Brazil), Interac (Canada)

---

## Delivery System

### Digital Deliveries:
- Seller uploads file or provides download link
- System stores delivery proof (hash + URL)
- Buyer gets notified with download link

### Physical Deliveries — Shipping Integration:

**Option A: EasyPost API (recommended for MVP)**
- Free to sign up, pay per label
- 100+ carriers (USPS, FedEx, UPS, DHL, Correios Brazil, Canada Post)
- Rate shopping, label generation, tracking, delivery confirmation
- No monthly fees — only pay when buying labels

**Option B: Seller-managed shipping**
- Seller ships on their own, enters tracking number
- System tracks via carrier APIs (free tracking lookup)
- Less integrated but zero cost for us

**MVP approach:** Start with Option B (seller-managed), add EasyPost later for premium sellers.

### Delivery Types:
| Type | Delivery Method | Escrow Release Trigger |
|------|----------------|----------------------|
| Digital file | Direct download link | Buyer confirms |
| Digital service | Seller marks complete + proof | Buyer confirms |
| Physical (domestic) | Carrier tracking | Delivery confirmed + buyer window |
| Physical (international) | Carrier tracking | Delivery confirmed + buyer window |
| In-person | Both parties confirm | Dual confirmation |

---

## Database Schema (MongoDB)

### `users` — Account holders (humans behind the bots)
```json
{
  "_id": "ObjectId",
  "type": "buyer|seller|both",
  "name": "Israel Silva",
  "email": "info@aladdn.app",
  "phone": "+16476995787",
  "country": "CA",
  "kycStatus": "none|pending|verified",
  "wallets": [
    { "network": "tron", "address": "T...", "label": "main" }
  ],
  "createdAt": "ISODate"
}
```

### `agents` — AI agents acting on behalf of users
```json
{
  "_id": "ObjectId",
  "userId": "ObjectId",
  "name": "PixelForge AI",
  "description": "...",
  "capabilities": ["Logo Design"],
  "category": "Design & Creative",
  "apiKey": "cm_...",
  "channels": ["whatsapp:+16476995787"],
  "rating": { "avg": 4.9, "count": 342 },
  "verified": false,
  "active": true,
  "createdAt": "ISODate"
}
```

### `listings` — Products and services for sale
```json
{
  "_id": "ObjectId",
  "agentId": "ObjectId",
  "sellerId": "ObjectId",
  "type": "product|service",
  "condition": "new|used|refurbished|na",
  "title": "Logo Design Package",
  "description": "...",
  "price": { "amount": 150.00, "currency": "USDT" },
  "category": "Design & Creative",
  "tags": ["logo", "branding"],
  "images": ["url1"],
  "deliveryType": "digital|physical|in_person",
  "deliveryDetails": {
    "digital": { "format": "zip", "size": "50MB" },
    "physical": {
      "weight": 0.5,
      "dimensions": { "l": 10, "w": 8, "h": 2, "unit": "in" },
      "shipsFrom": { "country": "BR", "city": "São Paulo" },
      "shipsTo": ["BR", "US", "CA", "WORLDWIDE"]
    }
  },
  "stock": 10,
  "available": true,
  "createdAt": "ISODate"
}
```

### `orders` — Transactions
```json
{
  "_id": "ObjectId",
  "orderNumber": "CM-20260216-0001",
  "listingId": "ObjectId",
  "buyerAgentId": "ObjectId",
  "sellerAgentId": "ObjectId",
  "buyerUserId": "ObjectId",
  "sellerUserId": "ObjectId",
  "status": "pending_payment|escrow_funded|processing|shipped|delivered|completed|disputed|refunded|cancelled",
  "price": { "amount": 150.00, "currency": "USDT" },
  "fee": { "amount": 0.75, "currency": "USDT", "rate": 0.005 },
  "escrow": {
    "expectedAmount": 150.00,
    "depositReference": "CM-20260216-0001",
    "txHash": null,
    "fundedAt": null,
    "releaseTxHash": null,
    "releasedAt": null
  },
  "delivery": {
    "type": "physical",
    "carrier": "correios",
    "trackingNumber": "BR123456789",
    "shippedAt": null,
    "deliveredAt": null,
    "proof": null
  },
  "shippingAddress": {
    "name": "John Doe",
    "street": "123 Main St",
    "city": "Toronto",
    "state": "ON",
    "country": "CA",
    "zip": "M5V 2T6"
  },
  "inspectionPeriod": 72,
  "autoReleaseAt": null,
  "timeline": [
    { "event": "order_created", "at": "ISODate", "by": "buyer_agent" },
    { "event": "payment_detected", "at": "ISODate", "txHash": "..." }
  ],
  "createdAt": "ISODate",
  "updatedAt": "ISODate"
}
```

### `disputes` — Dispute resolution
```json
{
  "_id": "ObjectId",
  "orderId": "ObjectId",
  "raisedBy": "ObjectId",
  "reason": "item_not_received|item_not_as_described|service_not_delivered|other",
  "description": "...",
  "evidence": [
    { "type": "screenshot", "url": "...", "submittedBy": "buyer", "at": "ISODate" }
  ],
  "status": "open|under_review|resolved_buyer|resolved_seller|escalated",
  "resolution": {
    "outcome": "full_refund|partial_refund|release_to_seller",
    "amount": 150.00,
    "reason": "...",
    "resolvedBy": "ai|admin",
    "at": "ISODate"
  },
  "messages": [
    { "from": "buyer", "text": "...", "at": "ISODate" }
  ],
  "createdAt": "ISODate"
}
```

### `reviews` — Post-transaction ratings
```json
{
  "_id": "ObjectId",
  "orderId": "ObjectId",
  "reviewerId": "ObjectId",
  "revieweeId": "ObjectId",
  "rating": 5,
  "comment": "Excellent service, fast delivery",
  "createdAt": "ISODate"
}
```

### `audit_log` — Every action recorded (anti-hallucination)
```json
{
  "_id": "ObjectId",
  "action": "order.create|payment.verify|escrow.release|dispute.open",
  "actorType": "agent|system|admin",
  "actorId": "ObjectId",
  "targetType": "order|listing|agent",
  "targetId": "ObjectId",
  "details": {},
  "timestamp": "ISODate"
}
```

---

## Module Breakdown (5 Agents)

### Agent 0: Project Manager (me — main session)
- Creates shared infrastructure (`src/shared/`)
- Coordinates the 4 coding agents
- Integrates modules
- Deploys to Vultr
- Updates this plan with real status

### Agent 1: Marketplace Core (`src/marketplace/`)
**Files:** routes.js, models.js, search.js, langchain-agent.js

**Responsibilities:**
- User registration + agent registration
- Listing CRUD (create, read, update, delete, search)
- Category management
- Text search + filters (price, category, condition, delivery type, location)
- LangChain agent with tools: searchListings, createListing, registerAgent, getProfile

**API Endpoints:**
```
POST   /api/users              — Register user
GET    /api/users/:id          — User profile
POST   /api/agents             — Register agent
GET    /api/agents             — List/search agents
GET    /api/agents/:id         — Agent detail + listings
POST   /api/listings           — Create listing
GET    /api/listings           — Search/filter listings
GET    /api/listings/:id       — Listing detail
PUT    /api/listings/:id       — Update listing
DELETE /api/listings/:id       — Remove listing
GET    /api/categories         — Categories with counts
GET    /api/stats              — Platform stats
```

### Agent 2: Payments & Escrow (`src/payments/`)
**Files:** routes.js, escrow.js, tron.js, fees.js, monitor.js, langchain-agent.js

**Responsibilities:**
- Escrow state machine (pending → funded → released/refunded)
- USDT deposit monitoring (poll TronGrid every 30s)
- Payment verification (match tx to order by amount + reference)
- Escrow release (sign + broadcast USDT transfer to seller)
- 0.5% fee deduction
- Auto-release timer (72h digital, 7d physical after delivery)
- Transaction audit logging

**API Endpoints:**
```
POST   /api/orders             — Create order (initiates escrow)
GET    /api/orders/:id         — Order status + escrow status
POST   /api/orders/:id/verify  — Manual payment verification trigger
POST   /api/orders/:id/ship    — Seller marks shipped + tracking
POST   /api/orders/:id/deliver — Seller marks delivered (digital)
POST   /api/orders/:id/confirm — Buyer confirms receipt → release escrow
POST   /api/orders/:id/dispute — Open dispute (freezes escrow)
GET    /api/orders/user/:id    — User's order history
GET    /api/wallet/balance     — Platform wallet balance
```

### Agent 3: Bot Integration (`src/bot/`)
**Files:** routes.js, orchestrator.js, session.js, formatters.js, langchain-agent.js

**Responsibilities:**
- Main LangChain orchestrator that routes natural language to the right sub-agent
- Per-user conversation memory (Redis-backed)
- Channel-specific formatters (WhatsApp, Telegram, Discord, Web)
- Webhook endpoints for each channel
- Intent detection: "I want to buy X" vs "list my product" vs "check my order"

**API Endpoints:**
```
POST   /api/bot/message        — Universal message endpoint
POST   /api/bot/whatsapp       — WhatsApp webhook
POST   /api/bot/telegram       — Telegram webhook
GET    /api/bot/session/:id    — Session state
POST   /api/bot/command        — Direct structured command
```

### Agent 4: Trust & Delivery (`src/trust/`)
**Files:** routes.js, disputes.js, ratings.js, shipping.js, verification.js, langchain-agent.js

**Responsibilities:**
- Dispute lifecycle (open → evidence → review → resolve)
- AI-powered dispute mediation (GPT-4o reviews evidence, suggests resolution)
- Rating/review system
- Shipping tracking integration (carrier API lookups)
- Delivery confirmation logic
- Agent verification (basic trust scores)

**API Endpoints:**
```
POST   /api/disputes           — Open dispute
GET    /api/disputes/:id       — Dispute detail
POST   /api/disputes/:id/evidence — Submit evidence
POST   /api/disputes/:id/resolve  — Resolve dispute
POST   /api/reviews            — Post review
GET    /api/reviews/agent/:id  — Agent reviews
GET    /api/shipping/track/:carrier/:tracking — Track shipment
POST   /api/shipping/rates     — Get shipping rates (future)
```

---

## Shared Infrastructure (`src/shared/`)

Built by PM agent before spawning coding agents:

```
src/shared/
├── db.js              — MongoDB connection + collections
├── redis.js           — Redis client (sessions, cache)
├── config.js          — Environment config loader
├── auth.js            — API key auth middleware
├── errors.js          — Standard error classes + handler
├── audit.js           — Audit log writer
├── langchain.js       — Shared LangChain setup (model, memory config)
└── validators.js      — Zod schemas for all inputs
```

---

## What I Need From You

### Critical (can't build without):
1. **TRON private key** for wallet TB38XJqwkKsutV1aZF5XBaK8dY3fk21ERh
   - Needed to sign escrow release transactions
   - Without it, we can receive but can't release
   - ⚠️ If you don't have it, we need to create a new wallet

2. **TronGrid API key** — free at https://www.trongrid.io/
   - Needed to monitor incoming USDT transactions
   - Without it, rate-limited to 15 req/min (might work for MVP)

### Important (needed before launch, not before building):
3. **Company details** for the platform
   - Which entity operates ClawMarket? (Brazil company? Canada company?)
   - Terms of service and basic legal framework
   - This affects dispute resolution and compliance

4. **Shipping accounts** (only if we want integrated labels)
   - EasyPost API key (free signup, pay per label)
   - Or: start with seller-managed shipping (no integration needed)

### Nice-to-have (can do later):
5. **WhatsApp Business API** credentials (if you want a dedicated ClawMarket bot number)
6. **Telegram Bot Token** for a @ClawMarketBot
7. **Cloudflare access** for clawmarket.ai domain

### What I Can Do Autonomously (no input needed):
- ✅ Set up the full codebase structure
- ✅ Build all API endpoints
- ✅ Set up MongoDB collections and indexes
- ✅ Configure LangChain agents with GPT-4o
- ✅ Build the web UI
- ✅ Deploy to Vultr
- ✅ Set up nginx + SSL
- ✅ Configure auto-deployment from GitHub
- ✅ Build the escrow state machine
- ✅ Implement payment monitoring (read-only until I have the private key)
- ✅ Build shipping tracking (carrier API lookups are free)
- ✅ Build dispute resolution system

---

## NPM Dependencies

```json
{
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "helmet": "^7.1.0",
    "express-rate-limit": "^7.1.4",
    "mongodb": "^6.3.0",
    "ioredis": "^5.3.2",
    "langchain": "^0.3.0",
    "@langchain/openai": "^0.3.0",
    "dotenv": "^16.3.1",
    "zod": "^3.22.4",
    "tronweb": "^6.0.0",
    "uuid": "^9.0.0",
    "winston": "^3.11.0"
  }
}
```

---

## Execution Order

### Phase 0: Shared Infrastructure (PM — before spawning agents)
1. Create project structure
2. Build `src/shared/*` modules
3. Set up `.env` with real credentials
4. Verify MongoDB connection from codebase
5. Verify GPT-4o connection via LangChain

### Phase 1: Parallel Coding (4 agents simultaneously)
- Agent 1: Marketplace Core
- Agent 2: Payments & Escrow
- Agent 3: Bot Integration
- Agent 4: Trust & Delivery

### Phase 2: Integration (PM)
1. Wire all modules into main `server.js`
2. Run integration tests
3. Push to GitHub → auto-deploy to Render (staging)
4. Verify on staging
5. Deploy to Vultr (production)

### Phase 3: Go Live
1. Configure nginx for clawmarket.ai (once domain DNS is sorted)
2. Seed marketplace with initial listings
3. Test full transaction flow end-to-end
4. Open for beta users

---

## Status Board

| Module | Agent | Session | Status | Last Update |
|--------|-------|---------|--------|-------------|
| Shared Infrastructure | PM | main | ✅ Complete | Feb 16 09:48 |
| Marketplace Core | Agent 1 | clawmarket-marketplace | 🔄 Building | Feb 16 09:48 |
| Payments & Escrow | Agent 2 | clawmarket-payments | 🔄 Building | Feb 16 09:48 |
| Bot Integration | Agent 3 | clawmarket-bot | 🔄 Building | Feb 16 09:48 |
| Trust & Delivery | Agent 4 | clawmarket-trust | 🔄 Building | Feb 16 09:48 |
| Integration | PM | main | Not started | — |
| Vultr Deployment | PM | main | Not started | — |
| Domain Setup | PM | main | Blocked (no CF access) | — |
