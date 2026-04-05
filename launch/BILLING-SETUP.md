# OraClaw Billing Setup Guide

Step-by-step guide to make billing operational on Render.

## Pre-requisites

- Render account with the OraClaw API deployed (https://oraclaw-api.onrender.com)
- Stripe account (https://dashboard.stripe.com)
- Unkey account (https://unkey.com)

---

## Step 1: Configure Stripe (US-101)

The API auto-provisions Stripe products on boot via `provision.ts`. You just need to set the secret key.

1. Go to Stripe Dashboard -> Developers -> API Keys
2. Copy the **Secret Key** (starts with `sk_live_` or `sk_test_`)
3. Go to Render Dashboard -> OraClaw API service -> Environment
4. Set these environment variables:

| Variable | Value | Notes |
|----------|-------|-------|
| `STRIPE_SECRET_KEY` | `sk_live_...` or `sk_test_...` | Use test key first for smoke testing |
| `STRIPE_PUBLISHABLE_KEY` | `pk_live_...` or `pk_test_...` | Needed for client-side checkout |
| `STRIPE_METER_EVENT_NAME` | `api_calls` | Standard meter event |
| `STRIPE_BATCH_METER_EVENT_NAME` | `api_calls_batch` | Batch meter event |
| `PORTAL_RETURN_URL` | `https://oraclaw-api.onrender.com` | Where portal redirects after |

5. Deploy the service (or it auto-deploys on env var change)
6. Check logs for: `[BOOT] Stripe products provisioned` or `Products already exist`
7. **IMPORTANT**: After first deploy, check logs for the auto-provisioned webhook secret. Copy it and set:

| Variable | Value | Notes |
|----------|-------|-------|
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` (from boot logs) | Required for webhook signature verification |
| `STRIPE_PRICE_PAY_PER_CALL` | `price_...` (from boot logs) | Auto-provisioned price ID |
| `STRIPE_PRICE_STARTER` | `price_...` (from boot logs) | Auto-provisioned price ID |
| `STRIPE_PRICE_GROWTH` | `price_...` (from boot logs) | Auto-provisioned price ID |
| `STRIPE_PRICE_SCALE` | `price_...` (from boot logs) | Auto-provisioned price ID |

8. Redeploy after setting price IDs

## Step 2: Configure Unkey (US-102)

1. Go to https://unkey.com -> Sign up / Log in
2. Create a new **Root Key** (Settings -> Root Keys -> Create)
3. Create a new **API** (APIs -> Create API) -- record the API ID
4. Go to Render Dashboard -> OraClaw API service -> Environment
5. Set:

| Variable | Value | Notes |
|----------|-------|-------|
| `UNKEY_ROOT_KEY` | `unkey_...` | Root key with full permissions |
| `UNKEY_API_ID` | `api_...` | API workspace ID |

6. Deploy the service
7. Check logs for: `[BOOT] Unkey auth enabled` (absence of warning)

## Step 3: Configure x402 USDC Payments (US-103)

1. Go to Render Dashboard -> OraClaw API service -> Environment
2. Set:

| Variable | Value | Notes |
|----------|-------|-------|
| `RECEIVING_WALLET_ADDRESS` | `0x450996401D587C8206803F544cCA74C33f6FbC93` | Base USDC wallet |
| `X402_NETWORK` | `eip155:8453` | Base mainnet (NOT Sepolia testnet) |
| `X402_PRICE_PER_CALL` | `$0.001` | Per-call USDC price |
| `X402_FACILITATOR_URL` | `https://x402.org/facilitator` | x402 facilitator |

3. Deploy the service
4. Check logs for: `[BOOT] x402 payment system initialized`

## Step 4: Smoke Test (US-104)

After all env vars are set and deployed, run these checks:

### 4a. Health Check
```bash
curl https://oraclaw-api.onrender.com/health
```
Expected:
```json
{
  "status": "ok",
  "billing": { "unkey": true, "stripe": true, "x402": true }
}
```

### 4b. Signup
```bash
curl -X POST https://oraclaw-api.onrender.com/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"smoke-test@example.com"}'
```
Expected: Returns `api_key`, `tier`, `daily_limit`

### 4c. Authenticated API Call
```bash
curl -X POST https://oraclaw-api.onrender.com/api/v1/optimize/bandit \
  -H "Authorization: Bearer <API_KEY_FROM_STEP_4b>" \
  -H "Content-Type: application/json" \
  -d '{"arms":[{"id":"a","pulls":10,"totalReward":7},{"id":"b","pulls":10,"totalReward":5}]}'
```
Expected: Result with `_meta.tier` and `_meta.calls_remaining`

### 4d. Premium Tool on Free Tier (should 403)
```bash
curl -X POST https://oraclaw-api.onrender.com/api/v1/solve/constraints \
  -H "Content-Type: application/json" \
  -d '{"direction":"maximize","objective":{"x":1},"variables":[{"name":"x","lower":0,"upper":10}],"constraints":[]}'
```
Expected: 403 with `"title": "Premium tool -- API key required"`

### 4e. Premium Tool with API Key (should 200)
```bash
curl -X POST https://oraclaw-api.onrender.com/api/v1/solve/constraints \
  -H "Authorization: Bearer <API_KEY_FROM_STEP_4b>" \
  -H "Content-Type: application/json" \
  -d '{"direction":"maximize","objective":{"x":1},"variables":[{"name":"x","lower":0,"upper":10}],"constraints":[]}'
```
Expected: 200 with LP solver result

### 4f. Checkout Session
```bash
curl -X POST https://oraclaw-api.onrender.com/api/v1/billing/subscribe \
  -H "Authorization: Bearer <API_KEY_FROM_STEP_4b>" \
  -H "Content-Type: application/json" \
  -d '{"tier":"starter"}'
```
Expected: Returns `checkout_url` -- open in browser, should show Stripe Checkout

### 4g. Pricing Endpoint
```bash
curl https://oraclaw-api.onrender.com/api/v1/pricing
```
Expected: Shows free (8 tools) vs premium (4 tools) breakdown

## Step 5: Go Live Checklist

- [ ] Health check returns `unkey: true, stripe: true, x402: true`
- [ ] Signup returns API key
- [ ] Free tier gets 403 on premium tools
- [ ] Paid tier gets 200 on premium tools
- [ ] Checkout session creates valid Stripe URL
- [ ] Metered billing events appear in Stripe Dashboard
- [ ] Webhook endpoint receives events (test with Stripe CLI: `stripe trigger invoice.paid`)

## Troubleshooting

**"Stripe metered billing disabled" in logs**
-> `STRIPE_SECRET_KEY` not set or set to `sk_test_placeholder`

**"Unkey auth disabled, all requests treated as free tier"**
-> `UNKEY_ROOT_KEY` not set

**"x402 payment system not available"**
-> `RECEIVING_WALLET_ADDRESS` not set, or x402 packages not installed

**Webhook 401 errors**
-> `STRIPE_WEBHOOK_SECRET` doesn't match. Re-check the auto-provisioned secret from boot logs.

**Price IDs empty**
-> First deploy creates products but doesn't persist price IDs to env vars. You must copy them from the logs and set them manually.
