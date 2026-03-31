# OraClaw Billing Status -- Production Readiness Checklist

Last updated: 2026-03-30

---

## 1. AI Agent Billing (x402 USDC)

**Status: CODE COMPLETE, NEEDS ENV VERIFICATION**

### What exists
- `hooks/x402-payment.ts` -- preHandler hook validates `PAYMENT-SIGNATURE` or `X-PAYMENT` headers via x402 resource server, sets `billingPath='x402'`
- `hooks/x402-settle.ts` -- onResponse hook settles USDC payment after successful (2xx) responses, fire-and-forget
- `server.ts` lines 86-108 -- initializes x402 resource server with `@x402/core/server` + `@x402/evm/exact/server`
- `server.ts` lines 146-157 -- wires x402 payment preHandler hook (runs BEFORE Unkey auth)
- `server.ts` lines 226-234 -- wires x402 settlement onResponse hook
- Full test coverage: `x402-payment.test.ts` (7 tests), `e2e-billing.test.ts` (3 x402 tests)

### Env vars needed vs set (Render)
| Variable | Required | render.yaml | Status |
|----------|----------|-------------|--------|
| `RECEIVING_WALLET_ADDRESS` | YES | `0x450996401D587C8206803F544cCA74C33f6FbC93` | SET (Coinbase Base wallet) |
| `X402_PRICE_PER_CALL` | optional | not set | OK (defaults to `$0.001`) |
| `X402_NETWORK` | optional | not set | OK (defaults to `eip155:84532` = Base Sepolia testnet) |
| `X402_FACILITATOR_URL` | optional | not set | OK (defaults to `https://x402.org/facilitator`) |

### What's working
- Payment verification flow: header parsing, base64 decode, requirement matching, facilitator verification
- Settlement flow: fire-and-forget USDC settlement after 2xx responses
- Billing path isolation: x402 requests bypass Unkey auth and skip Stripe metering
- All tests pass (payment verification, settlement, integration with 3 billing paths)

### What needs attention
- **NETWORK**: Currently defaults to Base Sepolia TESTNET (`eip155:84532`). For production, set `X402_NETWORK=eip155:8453` (Base mainnet) on Render.
- **WALLET FUNDS**: The wallet `0x4509...bC93` needs USDC on Base to receive payments. Verify it has been funded/activated.
- **npm packages**: `@x402/core` and `@x402/evm` must be installed. If missing at build time, x402 gracefully degrades (disabled with warning).
- **PRICE PER CALL**: The default `$0.001` is a flat rate for all endpoints. The pricing endpoint shows per-algorithm prices ($0.01-$0.10). Consider implementing per-endpoint pricing or keep the flat rate as minimum.

### Action items
- [ ] Set `X402_NETWORK=eip155:8453` on Render for mainnet (or keep testnet for staging)
- [ ] Verify `@x402/core` and `@x402/evm` are in package.json dependencies
- [ ] Verify wallet `0x4509...bC93` is accessible on Base mainnet

---

## 2. Human/Dev Billing (Stripe)

**Status: CODE COMPLETE, MISSING WEBHOOK ENDPOINT + ENV VARS NEEDED**

### What exists
- `services/billing/stripe.ts` -- Full StripeService class: customer mgmt, checkout sessions, subscriptions, invoices, payment methods, webhook handling, coupons
- `services/billing/tiers.ts` -- TIER_CONFIG: 5 tiers (free/starter/growth/scale/enterprise) with Stripe price IDs from env vars
- `routes/billing/subscribe.ts` -- `POST /api/v1/billing/subscribe` creates Stripe Checkout session for paid tiers
- `routes/billing/portal.ts` -- `POST /api/v1/billing/portal-session` creates Stripe Customer Portal session
- `hooks/meter-usage.ts` -- onResponse hook emits Stripe Billing Meter events for authenticated API calls
- `middleware/auth.ts` -- Unkey auth sets `stripeCustomerId` from API key metadata for downstream billing
- `services/unkey.ts` -- Key management: create/rotate/revoke API keys with tier-based rate limits
- Full test coverage: `subscribe.test.ts`, `portal.test.ts`, `meter-usage.test.ts`, `tiers.test.ts`, `e2e-billing.test.ts`

### Env vars needed vs set (Render)
| Variable | Required | render.yaml | Status |
|----------|----------|-------------|--------|
| `STRIPE_SECRET_KEY` | YES | `sync: false` (set via Render dashboard) | MUST VERIFY on Render dashboard |
| `STRIPE_PRICE_STARTER` | YES (for subscribe) | NOT in render.yaml | MUST ADD to Render dashboard |
| `STRIPE_PRICE_GROWTH` | YES (for subscribe) | NOT in render.yaml | MUST ADD to Render dashboard |
| `STRIPE_PRICE_SCALE` | YES (for subscribe) | NOT in render.yaml | MUST ADD to Render dashboard |
| `STRIPE_PRICE_ENTERPRISE` | optional | NOT in render.yaml | Optional (enterprise is non-subscribable) |
| `STRIPE_WEBHOOK_SECRET` | YES (for webhooks) | NOT in render.yaml | MUST ADD after webhook endpoint created |
| `STRIPE_PUBLISHABLE_KEY` | client-side only | NOT needed server-side | N/A (used by frontend) |
| `STRIPE_METER_EVENT_NAME` | optional | not set | OK (defaults to `api_calls`) |
| `STRIPE_BATCH_METER_EVENT_NAME` | optional | not set | OK (defaults to `api_calls_batch`) |
| `PORTAL_RETURN_URL` | optional | not set | OK (defaults to `https://web-olive-one-89.vercel.app`) |
| `UNKEY_ROOT_KEY` | YES (for auth) | NOT in render.yaml | MUST ADD to Render dashboard |
| `UNKEY_API_ID` | YES (for key creation) | NOT in render.yaml | MUST ADD to Render dashboard |

### What's working
- Stripe client initialization (graceful degradation: if no `STRIPE_SECRET_KEY`, Stripe metering is disabled)
- Tier configuration reads price IDs from env vars at startup
- Subscribe route validates tier, rejects free/enterprise, creates Checkout session
- Portal route creates Stripe Customer Portal session for managing billing
- Meter usage hook emits events only for `billingPath='stripe'` requests with `stripeCustomerId`
- Batch metering at 50% rate via separate meter event
- Unkey auth middleware resolves tier + stripeCustomerId from API key metadata

### What's broken / missing
1. **NO STRIPE WEBHOOK ENDPOINT**: The `StripeService` has `constructWebhookEvent()` and `handleWebhookEvent()` methods (fully implemented for 8 event types), but there is NO route that receives Stripe webhook HTTP requests. Without this:
   - Subscription lifecycle events (created/updated/deleted) are NOT processed
   - Payment failures are NOT detected
   - Invoice events are NOT tracked
   - Trial ending notifications are NOT received

2. **STRIPE_PRICE_* env vars**: The tier config reads from env at module load time. If `STRIPE_PRICE_STARTER` etc. are not set, the subscribe endpoint returns "Stripe price ID not configured for tier" (400 error).

3. **UNKEY not configured on Render**: Without `UNKEY_ROOT_KEY`, all requests are treated as free tier (no `stripeCustomerId` is ever set, so subscribe/portal routes always return 403).

### Action items
- [x] Stripe webhook route implemented (`POST /api/v1/billing/webhook`) -- see below
- [ ] Set `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_GROWTH`, `STRIPE_PRICE_SCALE` on Render dashboard
- [ ] Set `STRIPE_WEBHOOK_SECRET` on Render dashboard (get from Stripe Dashboard > Webhooks after creating endpoint)
- [ ] Set `UNKEY_ROOT_KEY` and `UNKEY_API_ID` on Render dashboard
- [ ] Create Stripe webhook endpoint in Stripe Dashboard pointing to `https://oraclaw-api.onrender.com/api/v1/billing/webhook`
- [ ] Create Stripe Billing Meter named `api_calls` in Stripe Dashboard
- [ ] Create Stripe prices for starter/growth/scale tiers in Stripe Dashboard

---

## 3. Enterprise Billing

**Status: PLACEHOLDER ONLY (by design)**

### What exists
- `tiers.ts` -- Enterprise tier config: `dailyLimit: 0` (unlimited), `monthlyCallsIncluded: 0` (custom), `stripePriceId` from `STRIPE_PRICE_ENTERPRISE` env
- `subscribe.ts` -- Rejects enterprise tier with "Enterprise subscriptions require a custom agreement. Contact sales."
- `unkey.ts` -- Enterprise rate limit: 1,000,000 calls/day (effectively unlimited)
- Pricing endpoint shows enterprise as "custom" price with "white-glove" support

### What's working
- Enterprise tier is correctly excluded from self-service subscription flow
- Enterprise API keys (when created via Unkey) have effectively unlimited rate limits
- Enterprise tier correctly returns "contact sales" messaging

### What needs to happen for full enterprise
- [ ] Manual Stripe customer + subscription creation for enterprise clients (admin workflow)
- [ ] Manual Unkey API key creation with enterprise tier metadata
- [ ] Optional: dedicated admin endpoint for onboarding enterprise customers
- [ ] Optional: `STRIPE_PRICE_ENTERPRISE` for custom pricing (not blocking -- enterprise is always manual)

---

## Cross-Cutting Concerns

### Stripe Webhook Endpoint (CRITICAL GAP -- NOW FIXED)

The `StripeService.handleWebhookEvent()` method handles 8 event types:
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `customer.subscription.trial_will_end`
- `invoice.paid`
- `invoice.payment_failed`
- `payment_method.attached`
- `payment_method.detached`

A webhook route has been created at `routes/billing/webhook.ts` and registered in `server.ts`.

### Unkey Free Tier

Unkey offers a free tier:
- 2,500 monthly active keys
- 150,000 monthly verifications
- Sufficient for OraClaw's initial launch

No payment needed for Unkey to start. Just create an account at unkey.dev, get a Root Key and API ID.

### Rate Limiting Architecture

Three layers:
1. `@fastify/rate-limit` (onRequest) -- 25 calls/24h for unauthenticated (IP-based)
2. Unkey rate limits (preHandler) -- tier-based limits configured per-key at creation
3. Stripe metering (onResponse) -- usage tracking for billing, not limiting

### Health Check Endpoint

`GET /health` returns billing system status:
```json
{
  "billing": {
    "unkey": true/false,
    "stripe": true/false,
    "x402": true/false
  }
}
```

---

## Summary: What Must Be Done on Render Dashboard

### Env vars to add (Render Dashboard > oraclaw-api > Environment):

```
STRIPE_SECRET_KEY=sk_live_...          # Should already be set (sync: false in render.yaml)
STRIPE_PRICE_STARTER=price_...         # From Stripe Dashboard > Products
STRIPE_PRICE_GROWTH=price_...          # From Stripe Dashboard > Products
STRIPE_PRICE_SCALE=price_...           # From Stripe Dashboard > Products
STRIPE_WEBHOOK_SECRET=whsec_...        # From Stripe Dashboard > Webhooks
UNKEY_ROOT_KEY=ulk_...                 # From Unkey Dashboard > Root Keys
UNKEY_API_ID=api_...                   # From Unkey Dashboard > APIs
X402_NETWORK=eip155:8453               # Set to mainnet when ready (currently testnet)
```

### Stripe Dashboard setup:
1. Create Products & Prices for Starter ($99/mo), Growth ($499/mo), Scale ($2,499/mo)
2. Create Billing Meter named `api_calls`
3. Create Webhook endpoint: `https://oraclaw-api.onrender.com/api/v1/billing/webhook`
   - Events: `customer.subscription.*`, `invoice.*`, `payment_method.*`
4. Copy webhook signing secret to Render env

### Unkey Dashboard setup:
1. Create account at https://unkey.dev
2. Create API namespace (e.g., "oraclaw-production")
3. Create Root Key with full permissions
4. Copy Root Key and API ID to Render env

### Go-live sequence:
1. Set all env vars on Render
2. Deploy (auto-redeploy on env change)
3. Verify `/health` shows `unkey: true, stripe: true, x402: true`
4. Test free tier: `curl https://oraclaw-api.onrender.com/api/v1/health`
5. Test Stripe: create test API key via Unkey, call subscribe endpoint
6. Test x402: send USDC payment header to any algorithm endpoint
