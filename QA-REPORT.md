## Test: Health Check
- Request: GET https://market.aladdn.app/health
- Status: 200
- Result: ✅ PASS
- Notes: Server responded OK
- Response snippet: {"status":"ok","message":"ClawMarket is running"}

## Test: List Listings
- Request: GET https://market.aladdn.app/api/listings
- Status: 200
- Result: ✅ PASS
- Notes: Returned listings array with pagination fields
- Response snippet: {"listings":[{"_id":"6993208ab3394555d7b7f46d",...}],"total":19,"page":1,"pages":1}

## Test: Filter Listings by Category=services
- Request: GET https://market.aladdn.app/api/listings?category=services
- Status: 200
- Result: ⚠️ WARN
- Notes: Filter returned empty set; categories appear to use human-readable names (e.g., "Design & Creative") rather than "services".
- Response snippet: {"listings":[],"total":0,"page":1,"pages":1}

## Test: Search Listings (logo)
- Request: GET https://market.aladdn.app/api/listings?search=logo
- Status: 200
- Result: ✅ PASS
- Notes: Returned matching listing(s)
- Response snippet: {"listings":[{"title":"Professional Logo Design"}],"total":1}

## Test: Get Categories
- Request: GET https://market.aladdn.app/api/categories
- Status: 200
- Result: ✅ PASS
- Notes: Categories returned with counts
- Response snippet: [{"category":"Design & Creative","listingCount":3},...]

## Test: List Agents
- Request: GET https://market.aladdn.app/api/agents
- Status: 200
- Result: ✅ PASS
- Notes: Agents list returned
- Response snippet: {"agents":[{"name":"CryptoGuard"},...],"total":10}

## Test: Search Agents (crypto)
- Request: GET https://market.aladdn.app/api/agents?search=crypto
- Status: 200
- Result: ✅ PASS
- Notes: CryptoGuard returned
- Response snippet: {"agents":[{"name":"CryptoGuard"}],"total":1}

## Test: Get Listing Detail
- Request: GET https://market.aladdn.app/api/listings/6993208ab3394555d7b7f467
- Status: 200
- Result: ✅ PASS
- Notes: Listing detail returned
- Response snippet: {"_id":"6993208ab3394555d7b7f467","title":"Professional Logo Design"}

## Test: Register Seller
- Request: POST https://market.aladdn.app/api/auth/register
- Status: 201
- Result: ✅ PASS
- Notes: Account created; agent in response was null
- Response snippet: {"success":true,"userId":"699344018b8cff15a3e6b41a","sessionToken":"cms_0094...","agent":null}

## Test: Register Buyer
- Request: POST https://market.aladdn.app/api/auth/register
- Status: 201
- Result: ✅ PASS
- Notes: Account created; agent in response was null
- Response snippet: {"success":true,"userId":"699344068b8cff15a3e6b41e","sessionToken":"cms_94ac...","agent":null}

## Test: Auth Me (Seller)
- Request: GET https://market.aladdn.app/api/auth/me
- Status: 200
- Result: ✅ PASS
- Notes: Authenticated true
- Response snippet: {"authenticated":true,"user":{"email":"qa-seller@test.clawmarket.ai"},"agents":[]}

## Test: Auth Me (Buyer)
- Request: GET https://market.aladdn.app/api/auth/me
- Status: 200
- Result: ✅ PASS
- Notes: Authenticated true
- Response snippet: {"authenticated":true,"user":{"email":"qa-buyer@test.clawmarket.ai"},"agents":[]}

## Test: Create Listing (Seller)
- Request: POST https://market.aladdn.app/api/listings
- Status: 500
- Result: ❌ FAIL
- Notes: Internal error when creating listing (both with price number and price object). Blocks seller flow.
- Response snippet: {"error":"Cannot read properties of undefined (reading 'map')","code":"INTERNAL_ERROR"}

## Test: Create Listing Missing Required Fields (Edge Case)
- Request: POST https://market.aladdn.app/api/listings
- Status: 500
- Result: ❌ FAIL
- Notes: Expected validation error; got internal error.
- Response snippet: {"error":"Cannot read properties of undefined (reading 'map')","code":"INTERNAL_ERROR"}

## Test: Buyer Create Order (using existing listing)
- Request: POST https://market.aladdn.app/api/orders
- Status: 500
- Result: ❌ FAIL
- Notes: Internal error (same as listing creation). Buyer flow blocked; no order ID created.
- Response snippet: {"error":"Cannot read properties of undefined (reading 'map')","code":"INTERNAL_ERROR"}

## Test: Bot Message (hello)
- Request: POST https://market.aladdn.app/api/bot/message
- Status: 400
- Result: ❌ FAIL
- Notes: Endpoint requires userId; request per test plan fails. Follow-up with userId returned BOT_ERROR.
- Response snippet: {"error":"Missing required fields: userId, message","code":"VALIDATION_ERROR"}

## Test: Bot Message (cheapest listing)
- Request: POST https://market.aladdn.app/api/bot/message
- Status: 200
- Result: ✅ PASS
- Notes: Returned listing result
- Response snippet: {"success":true,"response":{"message":"Found 1 listing"}}

## Test: Bot Message (CryptoGuard agent)
- Request: POST https://market.aladdn.app/api/bot/message
- Status: 200
- Result: ✅ PASS
- Notes: Returned agent result
- Response snippet: {"success":true,"response":{"message":"Found 1 agent(s)"}}

## Test: Create Listing Without Auth
- Request: POST https://market.aladdn.app/api/listings
- Status: 401
- Result: ✅ PASS
- Notes: Auth required
- Response snippet: {"error":"Authentication required. Log in or provide an API key."}

## Test: Admin Stats Without Auth
- Request: GET https://market.aladdn.app/api/admin/stats
- Status: 403
- Result: ✅ PASS
- Notes: Admin-only as expected
- Response snippet: {"error":"Admin access required"}

## Test: NoSQL Injection Attempt
- Request: GET https://market.aladdn.app/api/listings?search[$gt]=
- Status: 500
- Result: ❌ FAIL
- Notes: Server error indicates unsanitized query handling.
- Response snippet: {"error":"\"$search\" had the wrong type. Expected string, found array","code":14}

## Test: X-Request-ID Header Presence
- Request: Multiple endpoints
- Status: 200/4xx/5xx
- Result: ✅ PASS
- Notes: X-Request-ID header present on all responses tested.
- Response snippet: X-Request-ID: <uuid>

## Test: Register Existing Email
- Request: POST https://market.aladdn.app/api/auth/register
- Status: 200
- Result: ✅ PASS
- Notes: Graceful handling with existingAccount=true
- Response snippet: {"existingAccount":true,"userId":"699344018b8cff15a3e6b41a"}

## Test: Seller Flow Continuation (Get/Update Listing)
- Request: GET/PUT https://market.aladdn.app/api/listings/:id
- Status: N/A
- Result: ⚠️ WARN
- Notes: Blocked because listing creation failed (no listing ID).
- Response snippet: N/A

## Test: Order Flow (get/pay/ship/deliver/confirm)
- Request: POST/GET https://market.aladdn.app/api/orders/:id...
- Status: N/A
- Result: ⚠️ WARN
- Notes: Blocked because order creation failed (no order ID).
- Response snippet: N/A

## Test: Access чужой order (not belonging to user)
- Request: GET https://market.aladdn.app/api/orders/:id
- Status: N/A
- Result: ⚠️ WARN
- Notes: Blocked due to missing order ID from failed creation.
- Response snippet: N/A

# SUMMARY
- PASS: 14
- FAIL: 5
- WARN: 5

## Critical Issues
1. POST /api/listings consistently returns 500 INTERNAL_ERROR ("Cannot read properties of undefined (reading 'map')"). Blocks seller flow and validation.
2. POST /api/orders returns 500 INTERNAL_ERROR (same error), blocks buyer flow and order state machine.
3. NoSQL injection attempt causes 500 error instead of sanitization/validation.
4. Bot endpoint requires userId; test-plan request fails and "hello" with userId returns BOT_ERROR.
