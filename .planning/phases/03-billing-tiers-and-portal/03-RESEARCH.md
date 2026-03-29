# Phase 3: Billing Tiers and Portal - Research

**Researched:** 2026-03-28
**Domain:** Stripe metered subscriptions, free-tier IP rate limiting, customer portal
**Confidence:** HIGH

## Summary

Phase 3 implements three distinct concerns on top of the Phase 1 (Unkey auth) and Phase 2 (Stripe SDK + meter usage hook) foundations: (1) free-tier IP-based rate limiting for unauthenticated callers at 100 calls/day, (2) Stripe Products/Prices/Subscriptions configuration for paid tiers billed per metered call, and (3) a customer portal endpoint that redirects paying customers to Stripe's hosted billing management page.

The auth middleware (`middleware/auth.ts`) already sets `billingPath: 'free'` and `tier: 'free'` for requests without an Authorization header but does NOT enforce any rate limit on those requests. The meter usage hook (`hooks/meter-usage.ts`) already skips free-tier requests. The StripeService (`services/billing/stripe.ts`) already has full customer, subscription, and webhook management. The missing pieces are: a rate limiter on the free path, Stripe object creation (meter, product, metered prices per tier), subscription creation flow, and the portal session endpoint.

**Primary recommendation:** Use `@fastify/rate-limit` v10.x (Fastify 5 compatible) for free-tier IP rate limiting with in-memory LRU store. Use the standard Stripe v1 API for products, prices (per_unit + metered), and subscriptions -- NOT the v2 pricing plans API which is in private preview. Use `stripe.billingPortal.sessions.create()` for the customer portal endpoint.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BILL-02 | Free tier allows 100 calls/day without API key | `@fastify/rate-limit` v10.x with in-memory store, keyGenerator=request.ip, max=100, timeWindow='1 day', applied only when billingPath='free' |
| BILL-03 | Paid tiers (starter/growth/scale/enterprise) billed per call via Stripe metered subscription | Stripe Product + metered Price (per_unit, recurring.meter) per tier, Subscription linking customer to price. Meter events already firing via Phase 2 hook. |
| BILL-05 | Users can view usage and invoices via Stripe customer portal | `stripe.billingPortal.sessions.create({ customer, return_url })` returns a temporary URL. Requires portal configuration in Stripe Dashboard first. |
</phase_requirements>

## Standard Stack

### Core (Phase 3 Additions)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@fastify/rate-limit` | 10.x | IP-based rate limiting for free tier | Official Fastify plugin, in-memory LRU by default, Fastify 5 compatible. Zero external dependencies (no Redis needed for single-instance). |
| `stripe` | 21.0.1 (already installed) | Subscriptions, portal sessions, product/price management | Already installed in Phase 2. billingPortal.sessions.create() is the portal API. |

### Already Installed (No Changes)

| Library | Version | Purpose |
|---------|---------|---------|
| `@unkey/api` | 2.3.2 | API key verification + rate limiting for paid tiers |
| `stripe` | 21.0.1 | SDK with dahlia API version |
| `fastify` | 5.8.4 | HTTP framework |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@fastify/rate-limit` | In-memory Map + setInterval cleanup (already exists in `rateLimiter.ts`) | The existing `rateLimiter.ts` is 475 lines of custom code for the old ORACLE system. `@fastify/rate-limit` is 1 line of registration, battle-tested, and handles edge cases (LRU eviction, header injection). Don't reuse the old rate limiter -- it has different tier names (free/basic/premium/enterprise) and different concerns (AI requests, batch operations). |
| `@fastify/rate-limit` | `@unkey/ratelimit` for free tier too | Unkey rate limiting requires a key. Free tier has no key. IP-based limiting must happen locally. |
| Stripe v1 Products/Prices | Stripe v2 Pricing Plans API | v2 is in private preview (`2026-03-25.preview` API version), has limitations (max 5 checkout items, no discounts, no Connect). v1 Products + Prices + metered recurring is GA and proven. |

**Installation:**
```bash
cd mission-control && npm install @fastify/rate-limit
```

## Architecture Patterns

### Recommended Project Structure (Phase 3 additions)

```
src/
  hooks/
    meter-usage.ts           # (exists) onResponse hook for Stripe meter events
    free-tier-rate-limit.ts  # (NEW) @fastify/rate-limit config for free tier only
  middleware/
    auth.ts                  # (exists) Unkey preHandler, sets billingPath/tier
  services/
    billing/
      stripe.ts              # (exists) StripeService with customer/sub/webhook mgmt
      portal.ts              # (NEW) createPortalSession() wrapper
      tiers.ts               # (NEW) Tier config: Stripe price IDs, limits, pricing
  routes/
    billing/
      portal.ts              # (NEW) POST /api/v1/billing/portal-session
      subscribe.ts           # (NEW) POST /api/v1/billing/subscribe (creates subscription)
```

### Pattern 1: Conditional Rate Limiting (Free Tier Only)

**What:** Apply `@fastify/rate-limit` only to free-tier requests (no Authorization header), bypassing it for authenticated callers whose rate limits are already handled by Unkey.

**When to use:** Free-tier IP rate limiting that coexists with Unkey-managed paid tier limits.

**Example:**
```typescript
// Source: @fastify/rate-limit README + Fastify 5 docs
import rateLimit from '@fastify/rate-limit';

await fastify.register(rateLimit, {
  global: false,  // NOT global -- only applied where we want it
});

// In the auth preHandler, AFTER Unkey check:
// If billingPath === 'free', apply rate limit
fastify.addHook('preHandler', async (request, reply) => {
  if (request.url.startsWith('/api/v1/') && request.billingPath === 'free') {
    // Apply the rate limit check for free tier
    await request.server.rateLimit({
      max: 100,
      timeWindow: '1 day',  // 86400000ms
      keyGenerator: (req) => req.ip,
    })(request, reply);
  }
});
```

**Alternative approach (simpler):** Register `@fastify/rate-limit` globally but use `skip` to bypass authenticated requests:

```typescript
await fastify.register(rateLimit, {
  max: 100,
  timeWindow: '1 day',
  keyGenerator: (request) => request.ip,
  // Skip rate limiting for authenticated users (Unkey handles their limits)
  skip: (request) => {
    return request.headers.authorization !== undefined;
  },
  // Only apply to /api/v1/* routes
  onExceeding: undefined,
  addHeaders: {
    'x-ratelimit-limit': true,
    'x-ratelimit-remaining': true,
    'x-ratelimit-reset': true,
    'retry-after': true,
  },
});
```

**Key consideration:** `@fastify/rate-limit` uses an `onRequest` hook, which fires BEFORE `preHandler`. This means the auth middleware has not yet run when rate-limit checks happen. The `skip` function must check the raw Authorization header, not `request.billingPath` (which is set later in preHandler). This is actually fine -- if Authorization header exists, skip the IP rate limit (Unkey will handle it in preHandler).

### Pattern 2: Stripe Object Hierarchy for Metered Billing

**What:** Create the correct Stripe object chain: Meter -> Product -> Price (metered) -> Subscription.

**When to use:** Setting up per-call billing with different tier prices.

**Example:**
```typescript
// Source: Stripe Usage-Based Billing Implementation Guide
// This is one-time setup (Dashboard or seed script), NOT per-request code.

// 1. Meter already exists from Phase 2 (event_name: 'api_calls')

// 2. Product: one product for the entire API
const product = await stripe.products.create({
  name: 'OraClaw API',
  description: 'Decision intelligence algorithms API',
});

// 3. Price: one metered price per tier (different unit costs)
// Starter: $0.002/call ($99/50K calls equivalent)
const starterPrice = await stripe.prices.create({
  product: product.id,
  currency: 'usd',
  unit_amount: 0.2,  // $0.002 in cents = 0.2 cents
  billing_scheme: 'per_unit',
  recurring: {
    interval: 'month',
    usage_type: 'metered',
    meter: 'mtr_xxx',  // meter ID from Phase 2
  },
  nickname: 'starter',
  metadata: { tier: 'starter' },
});

// 4. Subscription: created when user upgrades from free
const subscription = await stripe.subscriptions.create({
  customer: 'cus_xxx',
  items: [{ price: starterPrice.id }],
});
```

**Tier pricing math (from existing /api/v1/pricing endpoint):**

| Tier | Monthly Price | Included Calls | Effective Per-Call |
|------|--------------|----------------|-------------------|
| free | $0 | 100/day (3,000/mo) | $0 |
| starter | $99/mo | 50,000 | $0.00198 |
| growth | $499/mo | 500,000 | $0.000998 |
| scale | $2,499/mo | 5,000,000 | $0.0004998 |
| enterprise | custom | unlimited | negotiated |

**Implementation choice:** Use `per_unit` pricing with `unit_amount_decimal` for sub-cent amounts. Each tier gets a separate Stripe Price object tied to the same meter. The unit_amount represents the per-call cost at that tier level.

### Pattern 3: Customer Portal Session Endpoint

**What:** A Fastify route that creates a Stripe billing portal session and returns the temporary URL.

**When to use:** When a paying customer wants to view invoices, update payment methods, or cancel their subscription.

**Example:**
```typescript
// Source: Stripe API Reference - billingPortal.sessions.create
// Verified against stripe@21.0.1 types (BillingPortal/SessionsResource.d.ts)

fastify.post('/api/v1/billing/portal-session', async (request, reply) => {
  // Must be an authenticated paying customer
  if (!request.stripeCustomerId) {
    return reply.code(403).send({
      type: 'https://oraclaw.dev/errors/no-subscription',
      title: 'No billing account',
      status: 403,
      detail: 'Free tier users do not have a billing portal. Upgrade to access billing management.',
    });
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: request.stripeCustomerId,
    return_url: process.env.PORTAL_RETURN_URL || 'https://oraclaw.dev/dashboard',
  });

  return { url: session.url };
});
```

**Prerequisites (one-time, in Stripe Dashboard):**
1. Go to Settings > Customer portal
2. Enable "Invoice history" (lets customers see usage-based invoices)
3. Enable "Payment methods" (lets customers update cards)
4. Optionally enable "Cancel subscription" with retention offer
5. Set a default return URL
6. Save configuration (MUST be done in test mode before test-mode sessions work)

### Anti-Patterns to Avoid

- **Using @fastify/rate-limit with Redis for free tier:** Single-instance deployment on Render free tier. In-memory LRU is correct. Redis adds infrastructure cost and latency for a free tier that will reset on deploys anyway (which is acceptable for free users).
- **Building a custom billing portal UI:** Stripe's hosted portal handles invoices, payment methods, and subscription cancellation. Building this yourself is hundreds of hours of work for PCI compliance alone.
- **Creating subscriptions without a payment method:** A metered subscription with no payment method will generate invoices that can never be paid. Require payment method attachment before subscription creation (use Checkout Session or Setup Intent).
- **Using the Stripe v2 Pricing Plans API:** It is in private preview with significant limitations. Stick with v1 Products + Prices.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Free tier rate limiting | Custom in-memory Map with cleanup intervals | `@fastify/rate-limit` v10 | Already 475 lines of buggy custom code in `rateLimiter.ts`. The plugin handles LRU eviction, header injection, and edge cases in ~1 line of config. |
| Billing management UI | Invoice viewer, payment method forms | `stripe.billingPortal.sessions.create()` | Stripe hosts the entire portal. PCI compliance, invoice PDFs, payment method updates -- all handled. |
| Subscription lifecycle | Custom state machine for sub status | Stripe webhooks + existing `handleWebhookEvent()` | StripeService already handles 8 webhook event types including subscription created/updated/deleted. |
| Metered invoice calculation | Manual usage aggregation + invoice math | Stripe Billing Meters | Stripe automatically aggregates meter events and generates invoices. Phase 2 already wired the meter event hook. |

**Key insight:** Phase 3 is mostly Stripe configuration (Products, Prices, Portal settings) and two small code additions (free-tier rate limit plugin, portal session endpoint). The heavy lifting is already done in Phases 1-2.

## Common Pitfalls

### Pitfall 1: Portal Configuration Not Saved in Test Mode

**What goes wrong:** `stripe.billingPortal.sessions.create()` throws "No portal configuration found" error.
**Why it happens:** The Stripe Customer Portal requires explicit configuration in the Dashboard BEFORE sessions can be created. This must be done separately for test mode and live mode.
**How to avoid:** Before writing any code, go to Stripe Dashboard > Settings > Customer portal > Save configuration in test mode. Document this as a prerequisite.
**Warning signs:** 400/404 errors from the portal session API with "configuration" in the error message.

### Pitfall 2: Rate Limit Hook Order with @fastify/rate-limit

**What goes wrong:** `@fastify/rate-limit` uses an `onRequest` hook, which fires BEFORE `preHandler` hooks. This means `request.billingPath` is not yet set when the rate limiter runs.
**Why it happens:** Fastify hook lifecycle: onRequest -> preParsing -> preValidation -> preHandler -> handler.
**How to avoid:** Use the `skip` function with `request.headers.authorization` (raw header, always available) instead of `request.billingPath` (set in preHandler). If the Authorization header exists, skip rate limiting (Unkey handles it).
**Warning signs:** All requests being rate limited, including authenticated ones.

### Pitfall 3: Metered Price unit_amount for Sub-Cent Values

**What goes wrong:** Stripe `unit_amount` is an integer (cents). $0.002/call cannot be represented as an integer.
**Why it happens:** `unit_amount` only accepts whole numbers. For sub-cent pricing, you need `unit_amount_decimal`.
**How to avoid:** Use `unit_amount_decimal: '0.2'` (string, in cents) instead of `unit_amount: 0.2` (rejected). Or use `transform_quantity` to bill per 100/1000 calls at a higher unit price.
**Warning signs:** Stripe API error "unit_amount must be a positive integer" or "Amount must be at least 50 cents" on subscription creation.

### Pitfall 4: Subscription Without Payment Method

**What goes wrong:** Metered subscription is created with `payment_behavior: 'default_incomplete'`, invoice is generated at end of month, payment fails because no payment method on file.
**Why it happens:** Metered subscriptions don't require upfront payment, so Stripe allows creation without a payment method.
**How to avoid:** Use Stripe Checkout Session for subscription creation (collects payment method automatically) rather than direct `subscriptions.create()`. The existing `createCheckoutSession()` method in StripeService already handles this.
**Warning signs:** `invoice.payment_failed` webhook events for customers who never added a card.

### Pitfall 5: Free Tier Counter Resets on Deploy

**What goes wrong:** Free-tier users get a fresh 100 calls after every Render deploy (which happens on each git push).
**Why it happens:** `@fastify/rate-limit` in-memory store is ephemeral. Render free tier cold-starts after 15 minutes of inactivity.
**How to avoid:** Accept this as a known limitation for free tier. Document it. The free tier is a funnel to paid -- a few extra calls on redeploy is not revenue-impacting. If it becomes a problem later, add Redis (INFRA-05 in v2 requirements).
**Warning signs:** None -- this is expected behavior for the current infrastructure.

## Code Examples

### Free Tier Rate Limiting with @fastify/rate-limit

```typescript
// Source: @fastify/rate-limit v10 README (Fastify 5 compatible)
// File: src/hooks/free-tier-rate-limit.ts

import rateLimit from '@fastify/rate-limit';
import type { FastifyInstance } from 'fastify';

export async function registerFreeTierRateLimit(fastify: FastifyInstance) {
  await fastify.register(rateLimit, {
    max: 100,
    timeWindow: 86_400_000,  // 24 hours in ms
    keyGenerator: (request) => request.ip,
    // Skip authenticated requests -- Unkey handles their rate limits
    skip: (request) => !!request.headers.authorization,
    // Custom error response matching RFC 9457
    errorResponseBuilder: (request, context) => ({
      type: 'https://oraclaw.dev/errors/rate-limited',
      title: 'Free tier rate limit exceeded',
      status: 429,
      detail: `Free tier allows 100 API calls per day. Upgrade for higher limits.`,
      'retry-after': Math.ceil(context.ttl / 1000),
    }),
    addHeaders: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
      'retry-after': true,
    },
  });
}
```

### Customer Portal Session Endpoint

```typescript
// Source: Stripe BillingPortal.SessionsResource.d.ts (verified in node_modules)
// File: src/routes/billing/portal.ts

import type { FastifyInstance } from 'fastify';
import { stripe } from '../../services/billing/stripe';

export async function portalRoutes(fastify: FastifyInstance) {
  fastify.post('/api/v1/billing/portal-session', async (request, reply) => {
    if (!request.stripeCustomerId) {
      return reply.code(403).send({
        type: 'https://oraclaw.dev/errors/no-billing-account',
        title: 'No billing account',
        status: 403,
        detail: 'Only paid subscribers can access the billing portal.',
      });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: request.stripeCustomerId,
      return_url: process.env.PORTAL_RETURN_URL || 'https://oraclaw.dev',
    });

    return { url: session.url };
  });
}
```

### Tier Configuration (Single Source of Truth)

```typescript
// File: src/services/billing/tiers.ts
// Defines tier metadata, Stripe Price IDs, and limits in one place.

export interface TierConfig {
  name: string;
  stripePriceId: string;     // env var or hardcoded after Stripe setup
  dailyLimit: number;         // Unkey rate limit (calls/day)
  monthlyCallsIncluded: number;
  unitAmountDecimal: string;  // cents, as string for Stripe
  description: string;
}

export const TIER_CONFIG: Record<string, TierConfig> = {
  free: {
    name: 'Free',
    stripePriceId: '',  // no subscription
    dailyLimit: 100,
    monthlyCallsIncluded: 3_000,
    unitAmountDecimal: '0',
    description: '100 calls/day, community support',
  },
  starter: {
    name: 'Starter',
    stripePriceId: process.env.STRIPE_PRICE_STARTER || '',
    dailyLimit: 1_667,
    monthlyCallsIncluded: 50_000,
    unitAmountDecimal: '0.198',  // ~$0.00198/call = $99/50K
    description: '50K calls/month, email support',
  },
  growth: {
    name: 'Growth',
    stripePriceId: process.env.STRIPE_PRICE_GROWTH || '',
    dailyLimit: 16_667,
    monthlyCallsIncluded: 500_000,
    unitAmountDecimal: '0.0998',  // ~$0.000998/call = $499/500K
    description: '500K calls/month, priority support',
  },
  scale: {
    name: 'Scale',
    stripePriceId: process.env.STRIPE_PRICE_SCALE || '',
    dailyLimit: 166_667,
    monthlyCallsIncluded: 5_000_000,
    unitAmountDecimal: '0.04998',  // ~$0.0004998/call
    description: '5M calls/month, dedicated support',
  },
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `createUsageRecord` per subscription item | Billing Meters + meter events (decoupled from subscription) | Stripe `2025-03-31.basil` | Meter events go to a Meter, which attaches to Prices. No need to know the subscription item ID at event time. Already adopted in Phase 2. |
| Stripe v2 Pricing Plans (rate cards, metered items) | v1 Products + Prices with `recurring.meter` | v2 is in private preview (March 2026) | v2 adds complexity (rate cards, metered items, pricing plans). v1 is simpler and GA. Use v1 for this phase. |
| Custom billing portal | `stripe.billingPortal.sessions.create()` | Available since ~2020, improved steadily | Stripe hosts the entire portal. Invoices, payment methods, cancellation -- all handled without building UI. |

**Deprecated/outdated:**
- `stripe.subscriptions.create()` with `usage_records`: Removed in `2025-03-31.basil`. Use Billing Meters instead.
- In-memory rate limiting via `rateLimiter.ts`: The existing 475-line `RateLimiter` class in `middleware/rateLimiter.ts` is legacy from the ORACLE system. It uses different tier names (free/basic/premium/enterprise) and tracks AI/batch request types. Do NOT reuse it for the public API free tier. Use `@fastify/rate-limit` instead.

## Open Questions

1. **Stripe Price ID management: environment variables vs. seed script?**
   - What we know: Each tier needs a Stripe Price object linked to the meter. Price IDs must be known at runtime.
   - What's unclear: Whether to create prices via Stripe Dashboard (manual), a one-time seed script, or via API at startup.
   - Recommendation: Create via Stripe Dashboard and store Price IDs as environment variables (`STRIPE_PRICE_STARTER`, `STRIPE_PRICE_GROWTH`, `STRIPE_PRICE_SCALE`). This is the simplest approach and matches the existing pattern of `STRIPE_METER_EVENT_NAME` as env var.

2. **Subscription creation flow: direct API or Checkout Session?**
   - What we know: The existing `createCheckoutSession()` in StripeService collects payment methods automatically. Direct `subscriptions.create()` does not.
   - What's unclear: Whether Phase 3 should expose a Checkout Session-based flow (redirect to Stripe-hosted page) or a direct subscription creation endpoint.
   - Recommendation: Use Checkout Session. It handles payment method collection, SCA/3DS, and creates the subscription automatically. The existing `createCheckoutSession()` method just needs a metered price ID.

3. **Portal configuration: which features to enable?**
   - What we know: Stripe Customer Portal must be configured in Dashboard before sessions work. Features include: invoice history, payment method management, subscription cancellation, subscription update.
   - What's unclear: Whether metered subscriptions support plan switching through the portal (Stripe docs say "subscriptions using usage-based pricing cannot be modified by customers").
   - Recommendation: Enable invoice history + payment method management + cancellation. Disable subscription modification (metered subs cannot be modified via portal anyway). Tier changes should be handled through a custom API endpoint that creates a new subscription with the new price.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 1.2.x |
| Config file | `mission-control/apps/api/vitest.config.ts` |
| Quick run command | `cd mission-control/apps/api && npx vitest run --reporter=verbose` |
| Full suite command | `cd mission-control && npm run test` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BILL-02a | Free tier (no auth header) gets 100/day limit | unit | `cd mission-control/apps/api && npx vitest run src/hooks/free-tier-rate-limit.test.ts -x` | No -- Wave 0 |
| BILL-02b | Free tier gets 429 on 101st call | unit | `cd mission-control/apps/api && npx vitest run src/hooks/free-tier-rate-limit.test.ts -x` | No -- Wave 0 |
| BILL-02c | Authenticated requests bypass free-tier rate limit | unit | `cd mission-control/apps/api && npx vitest run src/hooks/free-tier-rate-limit.test.ts -x` | No -- Wave 0 |
| BILL-03a | Tier config exports correct price IDs and limits | unit | `cd mission-control/apps/api && npx vitest run src/services/billing/tiers.test.ts -x` | No -- Wave 0 |
| BILL-03b | Subscription creation uses metered price for requested tier | unit | `cd mission-control/apps/api && npx vitest run src/routes/billing/subscribe.test.ts -x` | No -- Wave 0 |
| BILL-05a | Portal session created with stripeCustomerId | unit | `cd mission-control/apps/api && npx vitest run src/routes/billing/portal.test.ts -x` | No -- Wave 0 |
| BILL-05b | Portal returns 403 for free-tier users (no stripeCustomerId) | unit | `cd mission-control/apps/api && npx vitest run src/routes/billing/portal.test.ts -x` | No -- Wave 0 |

### Sampling Rate

- **Per task commit:** `cd mission-control/apps/api && npx vitest run --reporter=verbose`
- **Per wave merge:** `cd mission-control && npm run test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/hooks/free-tier-rate-limit.test.ts` -- covers BILL-02a, BILL-02b, BILL-02c
- [ ] `src/services/billing/tiers.test.ts` -- covers BILL-03a
- [ ] `src/routes/billing/subscribe.test.ts` -- covers BILL-03b
- [ ] `src/routes/billing/portal.test.ts` -- covers BILL-05a, BILL-05b
- [ ] `@fastify/rate-limit` install: `cd mission-control && npm install @fastify/rate-limit`

## Sources

### Primary (HIGH confidence)

- Stripe SDK v21.0.1 type definitions (`node_modules/stripe/types/BillingPortal/SessionsResource.d.ts`) -- verified `billingPortal.sessions.create()` accepts `{ customer, return_url, configuration? }`, returns `Session` with `.url`
- [Stripe Customer Portal API Reference](https://docs.stripe.com/api/customer_portal/sessions/create) -- session creation parameters, required portal configuration
- [Stripe Customer Portal Integration Guide](https://docs.stripe.com/customer-management/integrate-customer-portal) -- setup steps, dashboard configuration, limitation that metered subscriptions cannot be modified through portal
- [Stripe Usage-Based Billing Implementation Guide](https://docs.stripe.com/billing/subscriptions/usage-based/implementation-guide) -- meter -> product -> price -> subscription object chain
- [Stripe Recording Usage API](https://docs.stripe.com/billing/subscriptions/usage-based/recording-usage-api) -- meter event fields, idempotency, rate limits (1K/sec v1, 10K/sec v2)
- [@fastify/rate-limit GitHub README](https://github.com/fastify/fastify-rate-limit) -- v10.x for Fastify 5, in-memory LRU default, `skip` function, `keyGenerator`, `errorResponseBuilder`, `onRequest` hook lifecycle position
- Existing codebase: `middleware/auth.ts` (line 24: `billingPath: 'stripe' | 'free'`), `hooks/meter-usage.ts`, `services/billing/stripe.ts`, `services/unkey.ts`

### Secondary (MEDIUM confidence)

- [Stripe Customer Management Overview](https://docs.stripe.com/customer-management) -- portal features: invoice access, payment methods, subscription cancellation
- [Stripe Advanced Pricing Plans](https://docs.stripe.com/billing/subscriptions/usage-based/pricing-plans) -- v2 pricing plans API is in private preview, uses `Stripe-Version: 2026-03-25.preview`

### Tertiary (LOW confidence)

- None -- all findings verified against official docs and installed SDK types.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- `@fastify/rate-limit` v10 verified for Fastify 5, Stripe SDK v21 billingPortal types verified in node_modules
- Architecture: HIGH -- patterns follow existing codebase conventions (hook factories, service singletons, RFC 9457 errors)
- Pitfalls: HIGH -- hook ordering verified against Fastify lifecycle docs, portal configuration requirement verified against Stripe docs, sub-cent pricing verified against Stripe API constraints

**Research date:** 2026-03-28
**Valid until:** 2026-04-28 (Stripe APIs are stable; @fastify/rate-limit is stable)
