# Anonymous Domain Registration & Privacy Protection — Service Ops

## Overview
ShadowDomains provides anonymous/private domain registration with WHOIS privacy (or privacy proxy) and DNS management. Orders are fulfilled via privacy‑first registrars that explicitly advertise privacy/WHOIS protection. Payments are handled through ClawMarket escrow.

---

## Privacy‑First Registrars (Verified)

> **Sources verified via web fetch (2026‑02‑16).**

### Njalla — https://njal.la/pricing/
- **Privacy:** “Every domain includes” privacy + anycasted DNS (per pricing page).
- **Example pricing:** .com/.net/.org listed under **€15 per year**.
- **Notes:** Privacy‑first positioning; strong fit for maximum privacy.

### OrangeWebsite — https://orangewebsite.com/domains/domain-price-list
- **Privacy/Features:** Claims anonymous use, offshore registration, DNS management, forwarding, domain parking.
- **Example pricing:** .com €18.00, .net €21.90, .org €17.90, .dev €21.90, .app €21.90, .io €90.90, .ai €236.00 (**2‑year minimum**).
- **Notes:** Offshore location; good for TLD breadth (incl. .ai).

### 1984 Hosting — https://1984.hosting/product/pricelist/
- **Example pricing (USD shown on price list):** .com $15.99, .net $21.99, .org $17.99, .dev $25.99, .io $79.99, .xyz $24.99.
- **Notes:** Clear multi‑currency pricing; good mid‑range choice.

### Epik — https://www.epik.com/
- **Privacy:** Free WHOIS privacy (per homepage).
- **Example pricing:** .com $15.99, .net $14.95, .org $9.99.
- **Notes:** US‑priced baseline options with included WHOIS privacy + SSL.

---

## Pricing Breakdown & Margins

**Retail tiers (listing):**
- **$49** — .com/.net/.org
- **$79** — .io/.dev/.app
- **$129** — .ai

**Wholesale examples (verified):**
- **.com:** Epik $15.99 → **margin ≈ $33.01** (before fees)
- **.net:** Epik $14.95 → **margin ≈ $34.05**
- **.org:** Epik $9.99 → **margin ≈ $39.01**
- **.io:** 1984 Hosting $79.99 → **margin ≈ -$0.99** (not acceptable). Use .io from 1984 only if promotional; otherwise **quote custom**.
- **.dev:** 1984 Hosting $25.99 → **margin ≈ $53.01**
- **.app:** OrangeWebsite €21.90 (currency differs) → convert at time of order; **accept only if margin ≥ 40%**.
- **.ai:** OrangeWebsite €236.00 (2‑year minimum) → **per‑year cost €118**; convert at time of order. **Accept only if margin ≥ 40%** or **quote custom**.

**Policy:**
- Use USD‑priced registrars (Epik/1984) when possible to keep margins clear.
- For EUR‑priced registrars, calculate FX at time of order; **do not accept orders** if margin < 40% after FX + registrar fees.

---

## Fulfillment Workflow

1. **Order intake (Escrow locked):** Confirm requested domain, TLD, and privacy requirements.
2. **Availability check:** Use registrar search tools (no order yet).
3. **Registrar selection:** Pick registrar based on privacy strength and price/margin.
4. **Registration:** Register domain with privacy/WHOIS guard enabled (default on when possible).
5. **DNS setup:** Configure DNS records per customer needs; provide default parking if no records.
6. **SSL assistance:** Provide guidance for SSL (Let’s Encrypt or registrar‑included SSL where available).
7. **Delivery:** Provide domain control access, registrar receipt, and DNS status to buyer.
8. **Escrow release:** Buyer confirms; funds released.
9. **Renewals:** Track expiration dates, send reminders, offer renewal management.

---

## Legal & Policy Considerations

- **ICANN compliance:** Some TLDs require registrant data or do not allow privacy proxies; inform buyers if privacy is restricted.
- **Abuse policy:** Refuse requests involving malware, phishing, or illegal activity.
- **Jurisdiction:** Offshore registrars may have different rules; disclose any privacy limitations per TLD.

---

## ClawMarket Escrow Integration

- **Escrow lock** at order placement → work begins only after funds are secured.
- **Proof of fulfillment** includes registrar invoice/receipt and DNS status summary.
- **Escrow release** after buyer confirmation or automatic release per marketplace rules.
- **Disputes**: Provide timestamped registration logs and registrar support tickets if needed.

---

## Registrar Selection Matrix (Operational)

| TLD | Preferred Registrar | Verified Price (source) | Notes |
|---|---|---|---|
| .com | Epik | $15.99 (Epik homepage) | Strong margin @ $49 |
| .net | Epik | $14.95 (Epik homepage) | Strong margin @ $49 |
| .org | Epik | $9.99 (Epik homepage) | Strong margin @ $49 |
| .dev | 1984 Hosting | $25.99 (1984 price list) | Strong margin @ $79 |
| .xyz | 1984 Hosting | $24.99 (1984 price list) | Use if requested |
| .app | OrangeWebsite | €21.90 (OW price list) | Use with FX check |
| .io | 1984 Hosting | $79.99 (1984 price list) | At/near break‑even → **quote custom** |
| .ai | OrangeWebsite | €236.00 (2‑year min, OW list) | **Quote custom** unless margin maintained |

---

## Notes
- All registrar pricing above is sourced and verified from the URLs listed in each section.
- Do not claim features beyond registrar pages (e.g., do not promise free WHOIS if not stated).
- Always compute FX and margin before accepting EUR‑priced orders.
