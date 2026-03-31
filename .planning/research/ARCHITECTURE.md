# Architecture Patterns: API Monetization & Billing Integration

**Domain:** API monetization for an existing Fastify 5.8 REST API (19 algorithm endpoints)
**Researched:** 2026-03-28
**Updated:** 2026-03-28 (corrected x402 approach: native Fastify hooks, not Express compat layer)
**Overall Confidence:** HIGH (verified against official docs + existing codebase)

---

## Recommended Architecture

### System Overview

The monetization system is a **middleware layer** that wraps existing algorithm endpoints. It does NOT restructure them. Three concerns are added to every request lifecycle:

1. **Authentication/Entitlement** -- Is this caller allowed? (Unkey or x402 header)
2. **Execution** -- Run the algorithm (unchanged)
3. **Metering** -- Record usage for billing (Stripe meter event or USDC settled)

These map to two independent billing paths that share the same algorithm endpoints:

```
Path A: API Key (Unkey) --> Rate Limit Check --> Algorithm --> Stripe Meter Event
Path B: x402 Header     --> Payment Verify   --> Algorithm --> Settlement Confirmed
```

### Component Diagram

```
                        Incoming Request
                              |
                    +--------------------+
                    | Fastify preHandler |
                    |   (auth router)    |
                    +--------------------+
                     /                  \
            Has API Key?           Has X-PAYMENT header?
                /                          \
    +-----------------+          +-------------------+
    | Unkey verifyKey |          | @x402/core        |
    | (rate limit +   |          | ResourceServer    |
    |  tier resolve)  |          | (native Fastify   |
    +-----------------+          |  preHandler hook)  |
            |                    +-------------------+
            v                            |
    +-----------------+          +-----------------+
    | Tier Entitlement|          | Payment Valid?  |
    | free/starter/   |          | YES: proceed    |
    | growth/scale    |          | NO: 402 + hints |
    +-----------------+          +-----------------+
            \                          /
             \                        /
              v                      v
        +---------------------------+
        |   Algorithm Execution     |
        |   (existing 17 endpoints) |
        |   (unchanged logic)       |
        +---------------------------+
                    |
           +--------+--------+
           |                 |
    +-----------+     +------------+
    | Stripe    |     | x402       |
    | Meter     |     | Settlement |
    | Event     |     | (already   |
    | (async,   |     |  done by   |
    | onResponse|     |  facilitator)
    | hook)     |     +------------+
    +-----------+
                    |
                    v
              Response to Client
              + Rate Limit Headers
              + X-Request-Id
              + X-Algorithm-Duration-Ms
```

---

## Component Boundaries

| Component | Responsibility | Communicates With | Existing Code |
|-----------|---------------|-------------------|---------------|
| **Auth Router** (preHandler) | Detects billing path (API key vs x402 vs free) and routes to correct validator | Unkey SDK, @x402/core ResourceServer | Partial -- `checkApiKey()` in `api-public.ts` (in-memory, needs Unkey) |
| **Unkey Middleware** | Validates API key, checks rate limit, resolves tier + customerId | Unkey cloud API (`@unkey/api`) | Stubbed -- `@unkey/api` v2.3.2 installed, code has TODO comments |
| **x402 Middleware** | Returns 402 with payment hints or verifies X-PAYMENT header | @x402/core ResourceServer + facilitator (Stripe or CDP) | Not started -- `viem` v2.47.6 installed, wallet created, zero x402 code |
| **Tier Config** | Maps tier to rate limits, allowed endpoints, per-call price | Auth router, Unkey middleware | Partial -- `RATE_LIMITS` object in `api-public.ts` |
| **Usage Meter** | Sends meter events to Stripe asynchronously after response | Stripe Billing Meters API (`stripe@21.0.1`) | Stubbed -- `logUsage()` in `api-public.ts` is in-memory array, has TODO for Stripe |
| **Stripe Service** | Customer management, subscriptions, webhooks, invoices | Stripe API | Complete -- 658-line `stripe.ts` with full sub/invoice/webhook handling. Needs apiVersion bump from `2023-10-16` to `2026-03-25.dahlia`. |
| **Webhook Handler** | Receives Stripe events (payment_failed, subscription_updated, etc.) | Stripe webhooks, internal state | Complete -- `handleWebhookEvent()` in `stripe.ts` covers 8 event types |
| **Algorithm Endpoints** | Execute ML algorithms, return results | No billing awareness | Complete -- 17 endpoints in `api-public.ts`, all working |
| **Route Pricing Config** | Single source of truth for per-endpoint pricing | x402 middleware, Stripe meter, pricing endpoint | Not started -- pricing is hardcoded in `api-public.ts` |

---

## Data Flow: Path A (API Key + Stripe Metered Billing)

This is the primary revenue path for human developers using SDKs.

### Request Flow

```
1. Client sends:  POST /api/v1/optimize/bandit
                  Authorization: Bearer ok_live_abc123

2. preHandler hook fires:
   a. Extract key from Authorization header
   b. Call Unkey: verifyKey({ key: "ok_live_abc123", apiId: "api_xxx" })
   c. Unkey returns: { valid: true, meta: { tier: "growth", stripeCustomerId: "cus_xyz" },
                       ratelimits: [{ remaining: 4521, exceeded: false }] }
   d. If !valid or exceeded --> 401/429 response, stop
   e. Attach { tier, stripeCustomerId, ratelimitRemaining } to request

3. Route handler executes algorithm (unchanged)

4. onResponse hook fires (async, non-blocking):
   a. Send Stripe meter event:
      stripe.billing.meterEvents.create({
        event_name: "api_calls",
        payload: {
          stripe_customer_id: "cus_xyz",
          value: "1"
        },
        identifier: `${request.id}-${Date.now()}`  // idempotency
      })
   b. Set response headers:
      X-RateLimit-Remaining: 4521
      X-Request-Id: <uuid>
      X-Algorithm-Duration-Ms: 2.4

5. Response sent to client (does NOT wait for meter event)
```

### Key Design Decision: Unkey Handles Rate Limiting

Unkey's `verifyKey` does authentication AND rate limiting in a single API call. This replaces the current in-memory `dailyCounts` Map. Benefits:

- **Distributed**: Works across multiple Render instances if you scale
- **Persistent**: Survives server restarts (current in-memory map resets on every deploy)
- **Configurable**: Limits set per-key in Unkey dashboard, not hard-coded
- **Built-in**: Rate limit `remaining` count returned with every verify call

The current `checkRateLimit()` function and `dailyCounts` Map in `api-public.ts` should be deleted once Unkey is wired.

### Key Design Decision: Async Meter Events via onResponse

Stripe meter events are fire-and-forget. They MUST NOT block the response. Use Fastify's `onResponse` hook (fires after response is already sent to the client).

Stripe handles 1,000 meter events/second synchronously, 10,000/second via v2 meter event streams. At OraClaw's current scale, the standard API is more than sufficient.

If a meter event fails, it does not affect the API response. Log the failure. Stripe enforces idempotency via the `identifier` field, so retries are safe.

---

## Data Flow: Path B (x402 Machine Payments)

This is the revenue path for AI agents paying per-call with USDC.

### Request Flow

```
1. Agent sends:  POST /api/v1/optimize/bandit
                 (no Authorization header, no X-PAYMENT header)

2. x402 preHandler detects: no payment header for a priced route
   --> Responds HTTP 402 with headers:
       Payment-Required: { accepts: [{ scheme: "exact", price: "0.01",
                           network: "eip155:8453",
                           payTo: "0x4509...bC93" }] }

3. Agent constructs payment (signs USDC transfer via its wallet)

4. Agent retries:  POST /api/v1/optimize/bandit
                   X-PAYMENT: <signed-payment-blob>

5. x402 preHandler:
   a. Instantiate @x402/core ResourceServer with facilitator client
   b. Call resourceServer.verify(paymentHeader, routeConfig)
   c. Facilitator verifies payment on-chain, settles USDC
   d. Returns: { valid: true, settled: true }
   e. If invalid --> 402 again with error details

6. Route handler executes algorithm (unchanged)

7. Response sent to agent. Payment already settled by facilitator.
   No meter event needed -- revenue is on-chain.
```

### Key Design Decision: Native Fastify x402 (NOT Express Compatibility Layer)

**There is no `@x402/fastify` package.** The official packages are `@x402/express`, `@x402/hono`, and `@x402/next`.

**Use `@x402/core` directly with a native Fastify `preHandler` hook.**

The `@x402/core` package is transport-agnostic. It exports `ResourceServer` and `HTTPFacilitatorClient` that handle the protocol logic. The framework-specific packages (`@x402/express`, etc.) are thin wrappers (~30 lines) that call these same core functions.

**Do NOT use `@fastify/middie` or `@fastify/express`** to run the Express x402 middleware inside Fastify. This would:
- Add an Express compatibility layer that degrades Fastify's performance
- Create debugging complexity (Express semantics inside Fastify lifecycle)
- Add unnecessary dependencies
- The codebase currently does NOT use any Express compatibility -- adding it solely for x402 is wrong

**Native implementation (~50 lines):**

```typescript
import { ResourceServer, HTTPFacilitatorClient } from '@x402/core/server';
import { ExactEvmScheme } from '@x402/evm/exact/server';

// One-time setup
const facilitatorClient = new HTTPFacilitatorClient({
  url: 'https://x402.org/facilitator',  // testnet
  // Production: Stripe facilitator or CDP facilitator
});

const x402Server = new ResourceServer(facilitatorClient)
  .register('eip155:8453', new ExactEvmScheme());

// Route pricing config (shared with Stripe metering)
const ROUTE_PRICING = {
  'POST /api/v1/optimize/bandit':     { price: '0.01', network: 'eip155:8453' },
  'POST /api/v1/simulate/montecarlo': { price: '0.05', network: 'eip155:8453' },
  'POST /api/v1/solve/constraints':   { price: '0.10', network: 'eip155:8453' },
};

// Fastify preHandler hook
async function x402PreHandler(request, reply) {
  const routeKey = `${request.method} ${request.routeOptions.url}`;
  const pricing = ROUTE_PRICING[routeKey];
  if (!pricing) return; // Route not priced for x402

  const paymentHeader = request.headers['x-payment'];
  if (!paymentHeader) {
    return reply.code(402)
      .header('payment-required', JSON.stringify({
        accepts: [{
          scheme: 'exact',
          price: pricing.price,
          network: pricing.network,
          payTo: process.env.RECEIVING_WALLET_ADDRESS,
        }],
      }))
      .send({ error: 'Payment required', price: pricing.price });
  }

  const result = await x402Server.verify(paymentHeader, {
    price: pricing.price,
    network: pricing.network,
    payTo: process.env.RECEIVING_WALLET_ADDRESS,
  });

  if (!result.valid) {
    return reply.code(402).send({ error: 'Invalid payment', details: result.error });
  }

  request.billingPath = 'x402';
  request.paymentResult = result;
}
```

---

## Data Flow: Combined Auth Router Logic

The auth router (preHandler) handles three cases in priority order:

```typescript
async function billingMiddleware(request, reply) {
  const apiKey = request.headers.authorization?.replace('Bearer ', '');
  const x402Payment = request.headers['x-payment'];

  if (x402Payment) {
    // Path B: x402 machine payment (highest priority -- explicit payment)
    await x402PreHandler(request, reply);
    return;
  }

  if (apiKey) {
    // Path A: API key (Unkey + Stripe metered)
    const { result, error } = await verifyKey({
      key: apiKey,
      apiId: process.env.UNKEY_API_ID,
    });

    if (error || !result.valid) {
      const code = result?.code === 'RATE_LIMITED' ? 429 : 401;
      return reply.code(code).send({
        type: 'https://web-olive-one-89.vercel.app/errors/auth',
        title: result?.code === 'RATE_LIMITED' ? 'Rate limit exceeded' : 'Unauthorized',
        status: code,
        detail: result?.code || 'Invalid API key',
      });
    }

    request.billingPath = 'stripe';
    request.tier = result.meta?.tier ?? 'free';
    request.stripeCustomerId = result.meta?.stripeCustomerId;
    request.ratelimitRemaining = result.ratelimits?.[0]?.remaining;
    return;
  }

  // Path C: No auth = free tier (rate limited by IP)
  request.billingPath = 'free';
  request.tier = 'free';
  // Apply free tier rate limit via simple in-memory counter (acceptable for free tier only)
}
```

**Priority order rationale:** x402 first because an explicit payment should always be honored. API key second. Anonymous/free last.

---

## Stripe Setup Requirements (One-Time)

Before the middleware can send meter events, these must exist in Stripe:

| Stripe Object | Purpose | Created Via |
|---------------|---------|-------------|
| **Meter** (`api_calls`) | Counts API calls per customer per billing period, aggregation: sum | Stripe Dashboard or `stripe.billing.meters.create()` |
| **Product** (`OraClaw API`) | The thing being sold | Stripe Dashboard or API |
| **Price** (usage-based, tied to meter) | e.g., $0.01/call or tiered | `stripe.prices.create()` with `recurring.meter` |
| **Customers** | One per paying user, linked to Unkey key via `meta.stripeCustomerId` | Created on signup via existing `StripeService.getOrCreateCustomer()` |
| **Subscriptions** | Links customer to metered price | Created when user upgrades from free tier |

The existing `StripeService` handles customers, subscriptions, and webhooks. What is MISSING:

1. **Stripe package installation** -- `stripe` is not in `package.json` (imported with `@ts-ignore`)
2. **apiVersion bump** -- from `2023-10-16` to `2026-03-25.dahlia`
3. **Meter creation** -- one-time via Dashboard or API
4. **Metered Price creation** -- tied to the meter
5. **Meter event emission** -- the `logUsage()` function needs to call `stripe.billing.meterEvents.create()` instead of pushing to an in-memory array

---

## Unkey Setup Requirements (One-Time)

| Unkey Object | Purpose | Created Via |
|--------------|---------|-------------|
| **API** | Namespace for OraClaw API keys | Unkey Dashboard |
| **Root Key** | Server-side key for verifyKey calls | Unkey Dashboard, set as `UNKEY_ROOT_KEY` env var |
| **Keys** (per user) | API keys issued to customers (e.g., `ok_live_abc123`) | Unkey API on user signup |
| **Rate Limit Namespace** | `api_calls` with per-tier limits | Configured in key metadata or Unkey Dashboard |

Keys should store metadata: `{ tier: "growth", stripeCustomerId: "cus_xyz" }` so billing middleware can resolve the Stripe customer for meter events without a database lookup.

---

## Patterns to Follow

### Pattern 1: Billing-Transparent Handlers

Algorithm route handlers have ZERO billing awareness. They receive a parsed request body, run the algorithm, return results. All billing logic lives in hooks.

**What:** Billing is a cross-cutting concern handled by Fastify lifecycle hooks, never by route handlers.
**Why:** 17 existing endpoints are written and tested. Adding billing code to each is error-prone and creates 17 maintenance points.
**Example:**

```typescript
// GOOD: Handler knows nothing about billing
fastify.post("/api/v1/optimize/bandit", {
  preHandler: [billingMiddleware],  // handles auth + rate limit
  onResponse: [meterUsage],        // fires Stripe meter event
}, async (request) => {
  // Pure algorithm logic, unchanged
  const result = runBandit(request.body);
  return { selected: result.arm, score: result.score };
});
```

### Pattern 2: Async Metering via onResponse Hook

**What:** Send Stripe meter events in Fastify's `onResponse` hook, which fires after the response is already sent to the client.
**Why:** Metering must never add latency to API responses. The <25ms algorithm performance is a selling point.
**Example:**

```typescript
fastify.addHook("onResponse", async (request, reply) => {
  if (request.billingPath === "stripe" && request.stripeCustomerId) {
    stripe.billing.meterEvents.create({
      event_name: "api_calls",
      payload: {
        stripe_customer_id: request.stripeCustomerId,
        value: "1",
      },
      identifier: `${request.id}-${Date.now()}`,
    }).catch(err => fastify.log.error({ err }, "Meter event failed"));
  }
});
```

### Pattern 3: Route-Level Pricing Config (Single Source of Truth)

**What:** Define per-endpoint pricing in a single config object used by both billing paths.
**Why:** Pricing is a business decision, not code logic. A single source of truth prevents x402 prices from diverging from Stripe meter values.
**Example:**

```typescript
const ROUTE_PRICING: Record<string, { usdPrice: string; meterValue: number }> = {
  "POST /api/v1/optimize/bandit":          { usdPrice: "0.01",  meterValue: 1 },
  "POST /api/v1/simulate/montecarlo":      { usdPrice: "0.05",  meterValue: 5 },
  "POST /api/v1/solve/constraints":        { usdPrice: "0.10",  meterValue: 10 },
  "POST /api/v1/optimize/cmaes":           { usdPrice: "0.15",  meterValue: 15 },
};
```

### Pattern 4: RFC 9457 Error Responses

**What:** All error responses follow RFC 9457 Problem Details format.
**Why:** Machine-parseable errors are table stakes for API consumers.
**Example:**

```typescript
{
  type: "https://web-olive-one-89.vercel.app/errors/rate-limited",
  title: "Rate limit exceeded",
  status: 429,
  detail: "Growth tier allows 500,000 calls/month. 0 remaining.",
  instance: "/api/v1/optimize/bandit",
  "x-request-id": "req_abc123",
  "x-ratelimit-reset": "2026-04-01T00:00:00Z"
}
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Billing Logic in Route Handlers

**What:** Calling `checkApiKey()` and `logUsage()` inside each route handler (current pattern in `api-public.ts`)
**Why bad:** 17 handlers each call these manually. Adding a new billing path means editing all 17. Missing one = revenue leakage.
**Instead:** Single `preHandler` hook registered at the route prefix level. All routes under `/api/v1/` get billing automatically.

### Anti-Pattern 2: In-Memory Rate Limiting for Paid Tiers

**What:** Using a `Map<string, { count, resetAt }>` for rate tracking (current pattern)
**Why bad:** Resets on every deploy and every cold start (every 15 minutes on Render free tier).
**Instead:** Unkey handles distributed rate limiting. Keep in-memory counter ONLY for anonymous free tier (no key = no Unkey call).

### Anti-Pattern 3: Synchronous Meter Events

**What:** `await stripe.billing.meterEvents.create(...)` inside the request handler
**Why bad:** Adds 100-300ms network latency to every API call. Stripe meter events are async by design.
**Instead:** Fire-and-forget in `onResponse` hook. If event fails, log and retry.

### Anti-Pattern 4: Express Compatibility Layer for x402

**What:** Using `@fastify/middie` or `@fastify/express` to run `@x402/express` middleware inside Fastify
**Why bad:** Adds an Express compatibility layer that degrades performance, creates debugging complexity, and adds unnecessary dependencies. The codebase does not use Express compatibility anywhere.
**Instead:** Use `@x402/core` directly with a native Fastify `preHandler` hook. The core package is transport-agnostic. The native implementation is ~50 lines.

### Anti-Pattern 5: Separate Auth for Each Billing Path

**What:** Two completely independent middleware stacks that don't know about each other
**Why bad:** Edge cases (request has BOTH an API key AND an x402 payment header) cause undefined behavior.
**Instead:** Single auth router that checks headers in priority order: x402 first (explicit payment > subscription), then API key, then anonymous free.

---

## Suggested Build Order

Dependencies between components dictate the order:

```
Phase 1: Unkey Integration (replaces in-memory auth)
   |
   +-- No external dependency. @unkey/api already installed.
   +-- Replaces checkApiKey() and checkRateLimit() in api-public.ts
   +-- Can be tested with Unkey test keys immediately
   |
Phase 2: Stripe Meter Wiring (replaces in-memory usage log)
   |
   +-- Depends on: Unkey working (need stripeCustomerId from key metadata)
   +-- Install stripe@21.0.1, bump apiVersion to 2026-03-25.dahlia
   +-- Create meter + metered price in Stripe Dashboard
   +-- Replace logUsage() with stripe.billing.meterEvents.create()
   +-- Wire onResponse hook
   |
Phase 3: Billing Middleware Refactor
   |
   +-- Depends on: Unkey + Stripe meter both working
   +-- Extract checkApiKey/logUsage from each handler into shared preHandler/onResponse
   +-- Single auth router pattern (see Combined Auth Router above)
   +-- Add rate limit headers, request ID, RFC 9457 errors
   +-- Test: free tier, starter tier, rate limit hit, meter event sent
   |
Phase 4: x402 Machine Payments
   |
   +-- Depends on: Billing middleware pattern established
   +-- Install @x402/core + @x402/evm
   +-- Write native Fastify preHandler hook (NOT Express compat)
   +-- Configure facilitator (testnet first, then Stripe or CDP for mainnet)
   +-- Add x402 path to auth router
   +-- Test: 402 response, payment verification, settlement
   |
Phase 5: End-to-End Verification
   |
   +-- Depends on: All paths working
   +-- Free tier --> 100 calls/day --> 429 on 101st
   +-- Paid tier --> Unkey validates --> algorithm runs --> Stripe meter event
   +-- x402 tier --> 402 challenge --> payment --> algorithm runs --> settled
   +-- Webhook: subscription canceled --> key disabled in Unkey
```

---

## Environment Variables Required

```bash
# Unkey (Path A: authentication + rate limiting)
UNKEY_ROOT_KEY=unkey_xxx          # Server-side root key for verifyKey calls
UNKEY_API_ID=api_xxx              # API namespace in Unkey

# Stripe (Path A: metered billing)
STRIPE_SECRET_KEY=sk_live_xxx     # Already configured in stripe.ts
STRIPE_WEBHOOK_SECRET=whsec_xxx   # Already configured in stripe.ts
STRIPE_METER_EVENT_NAME=api_calls # Set after creating meter in Dashboard

# x402 (Path B: machine payments)
RECEIVING_WALLET_ADDRESS=0x4509...bC93  # Already generated
WALLET_PRIVATE_KEY=0x...                # Already in .env.wallet (gitignored)
X402_FACILITATOR_URL=https://...        # Stripe or CDP facilitator endpoint

# Optional: Stripe as x402 facilitator (requires preview access)
# Uses same STRIPE_SECRET_KEY + apiVersion: '2026-03-04.preview'
```

---

## Scalability Considerations

| Concern | At 100 users | At 10K users | At 1M calls/day |
|---------|-------------|-------------|-----------------|
| **Unkey latency** | ~50ms verify, fine | Same -- Unkey is edge-distributed | Same -- designed for billions |
| **Stripe meter events** | Async, invisible | v1 API: 1K events/sec, plenty | Switch to v2 meter event streams (10K/sec) or pre-aggregate |
| **Rate limit state** | Unkey cloud | Same | Same |
| **x402 facilitator** | CDP free tier (1K tx/month) | May need Stripe facilitator | Self-hosted facilitator or Stripe |
| **Algorithm execution** | <25ms, single instance | Still fast, CPU-bound | Horizontal scale on Render |
| **Memory** | In-memory free-tier counter only | Tiny | Fine, counter per-IP |

---

## Sources

- [Stripe Usage-Based Billing Implementation Guide](https://docs.stripe.com/billing/subscriptions/usage-based/implementation-guide) -- HIGH confidence
- [Stripe Meter Events API (Node.js)](https://docs.stripe.com/api/billing/meter-event/create?lang=node) -- HIGH confidence
- [Stripe Meters API](https://docs.stripe.com/api/billing/meter) -- HIGH confidence
- [Stripe x402 Machine Payments](https://docs.stripe.com/payments/machine/x402) -- HIGH confidence
- [Stripe API Version 2025-03-31.basil](https://docs.stripe.com/changelog/basil) -- HIGH confidence
- [Unkey verifyKey API Reference](https://www.unkey.com/docs/api-reference/v2/keys/verify-api-key) -- HIGH confidence
- [Unkey Fastify Template](https://www.unkey.com/templates/fastify) -- HIGH confidence
- [x402 V2 Launch](https://www.x402.org/writing/x402-v2-launch) -- HIGH confidence
- [x402 GitHub (coinbase/x402)](https://github.com/coinbase/x402) -- HIGH confidence
- [@x402/core npm](https://www.npmjs.com/package/@x402/core) -- v2.3.0 confirmed
- [Coinbase CDP x402 Documentation](https://docs.cdp.coinbase.com/x402/welcome) -- HIGH confidence
- [Fastify Hooks Documentation](https://fastify.dev/docs/latest/Reference/Hooks/) -- HIGH confidence
