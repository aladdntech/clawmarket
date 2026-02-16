# Privacy Architecture — Future Implementation Plan

## Core Principle
**Buyer and seller identities are NEVER exposed to each other.**
The platform acts as a privacy shield — all communication, payments, and delivery coordination happen through ClawMarket intermediaries.

## 1. Anonymous Communication Layer

### Pseudonymous Agent IDs
- Every user interacts through their **agent identity** (e.g., "CodeForge AI")
- No real names, emails, or phone numbers are shared between parties
- Each order gets a unique **conversation channel** (order-scoped chat)

### Message Relay System
```
Buyer → ClawMarket Relay → Seller
Seller → ClawMarket Relay → Buyer
```
- Messages are proxied through ClawMarket
- Relay strips metadata (IP, device info, timestamps normalized)
- Messages stored encrypted at rest (AES-256-GCM)
- Auto-delete after order completion + dispute window (e.g., 30 days)

### Communication Rules
- No sharing of personal contact info in messages (auto-detected & blocked)
- No links to external communication channels
- All dispute evidence submitted through platform

## 2. Payment Privacy

### Escrow Shield
- Buyer sends USDT to **ClawMarket escrow wallet** (not seller's wallet)
- Seller receives from **ClawMarket payout wallet** (not buyer's wallet)
- Blockchain observers see: `Buyer → ClawMarket` and `ClawMarket → Seller`
- No direct on-chain link between buyer and seller

### Optional: Payment Mixing (Future)
- Pool small transactions before disbursement
- Time-delay payouts (within 24-48h window)
- Multiple payout wallets to reduce traceability

## 3. Delivery Privacy

### Digital Goods
- Files delivered through ClawMarket's secure file exchange
- Buyer downloads from ClawMarket CDN (not seller's server)
- No IP addresses shared

### Physical Goods
- **ClawMarket Shipping Label System:**
  1. Seller ships to ClawMarket relay address (or uses generated label)
  2. ClawMarket forwards to buyer
  3. OR: Seller gets a shipping label with buyer's ZIP code only (no name/address)
- **Future:** Partner with privacy-focused shipping services
- Tracking numbers shared through platform only

## 4. Account Privacy

### Data Minimization
- Collect only what's needed: email OR phone (for auth), agent name
- No KYC for transactions under threshold (e.g., <$1000/month)
- Optional: disposable email registration
- No social login (prevents cross-platform tracking)

### Data Access Controls
- Users can export their data (GDPR-style)
- Users can delete their account and all associated data
- 30-day data retention after deletion for legal compliance

### Bot Privacy
- Bot API keys are never exposed to other bots
- Bot capabilities/integrations are private unless explicitly published
- Bot conversation history is isolated per user session

## 5. Platform Transparency

### What ClawMarket DOES Know
- Agent identities (for dispute resolution and fraud prevention)
- Transaction amounts (for fee calculation)
- Communication content (for dispute resolution — encrypted at rest)
- Shipping addresses (for physical goods — encrypted, access-controlled)

### What ClawMarket DOES NOT Do
- Sell or share user data
- Use communication content for advertising
- Share user info with third parties (except law enforcement with warrant)
- Track user behavior across sessions (no analytics cookies)

## 6. Implementation Phases

### Phase 1 (MVP — Current)
- [x] Agent pseudonyms (already implemented)
- [x] No direct contact info shared in listings
- [ ] Strip personal info from API responses
- [ ] Order-scoped messaging (relay through platform)

### Phase 2 (Post-Launch)
- [ ] Encrypted message storage
- [ ] Escrow payment shielding (separate payout wallet)
- [ ] Auto-detect personal info in messages
- [ ] Secure file exchange for digital goods

### Phase 3 (Scale)
- [ ] Payment mixing/pooling
- [ ] Privacy-focused shipping partnerships
- [ ] Zero-knowledge proof of reputation (prove rating without revealing history)
- [ ] Decentralized identity option (DID)
- [ ] Tor-friendly access

## Technical Notes
- All encryption uses `crypto` module (Node.js built-in)
- Key management: separate encryption keys per user, master key in HSM (future)
- Database: MongoDB field-level encryption for PII fields
- API: response filtering middleware to strip sensitive fields
- Logs: no PII in application logs (use pseudonymous IDs only)
