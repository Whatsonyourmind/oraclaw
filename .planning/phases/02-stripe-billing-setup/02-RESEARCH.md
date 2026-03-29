# Phase 2: Stripe Billing Setup - Research

**Researched:** 2026-03-29
**Domain:** Stripe SDK installation, API version upgrade, Billing Meters API integration with Fastify onResponse hook
**Confidence:** HIGH

## Summary

Phase 2 installs the Stripe Node.js SDK v21.0.1 as a real dependency (replacing the current `@ts-ignore` import), upgrades the apiVersion from the obsolete `2023-10-16` to `2026-03-25.dahlia`, and wires Stripe Billing Meters to emit a meter event on every authenticated API call via an async `onResponse` hook.

The existing codebase is well-prepared for this work. Phase 1 already wired Unkey auth middleware that sets `request.stripeCustomerId` and `request.billingPath` on every request. The StripeService at `apps/api/src/services/billing/stripe.ts` (658 lines) has working customer management, subscriptions, webhooks, and invoicing -- all of which remain compatible with the new API version. The only things missing are: (1) stripe in package.json, (2) the apiVersion bump, and (3) the meter event emission hook.

The Stripe Billing Meters API replaces the legacy `usage_records` API (removed in API version `2025-03-31.basil`). Meter events are fire-and-forget, support 1,000 events/second, enforce 24-hour idempotency via the `identifier` field, and are processed asynchronously by Stripe. Fastify's `onResponse` hook fires after the response has been sent to the client, making it the ideal location for non-blocking meter event emission.

**Primary recommendation:** Install `stripe@21.0.1`, bump apiVersion in one line, add a single `onResponse` hook that calls `stripe.billing.meterEvents.create()` for requests where `billingPath === 'stripe'`. This is a focused, low-risk change that touches 3 files.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INFRA-01 | Stripe SDK v21.0.1 installed and apiVersion upgraded to 2026-03-25.dahlia | SDK version confirmed on npm (published 2026-03-27). apiVersion `2026-03-25.dahlia` has no breaking changes to billing/subscriptions. Stripe.Decimal breaking change only affects Issuing fields, not the StripeService's integer amount fields. |
| BILL-01 | API calls are metered via Stripe Billing Meters API (upgrade from removed legacy usage_records) | Billing Meters API verified via official docs. `stripe.billing.meterEvents.create()` accepts `event_name`, `payload.stripe_customer_id`, `payload.value`, and `identifier`. Rate limit: 1,000 events/sec. Idempotency: 24-hour rolling window on `identifier`. Processing: asynchronous. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `stripe` | 21.0.1 | Stripe API client for metered billing, subscriptions, invoices | Industry standard. Latest version pins `apiVersion: '2026-03-25.dahlia'`. NOT currently in package.json -- imported with `@ts-ignore`. Must install as real dependency. |
| `fastify` | 5.8.4 | HTTP server with lifecycle hooks (onResponse for metering) | Already deployed. `onResponse` hook fires after response sent to client -- perfect for non-blocking meter events. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@unkey/api` | 2.3.2 | Auth middleware that provides `request.stripeCustomerId` | Already installed and wired in Phase 1. No changes needed -- provides the customer ID for meter events. |
| `vitest` | 1.2.0 | Test framework for unit tests | Already configured. Use for testing the metering hook with mocked Stripe client. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Stripe Billing Meters | Metronome (acquired by Stripe) | Stripe acquired Metronome; native Meters API handles OraClaw's scale without extra vendor. |
| Stripe Billing Meters | Orb, Lago | Adds a billing vendor when Stripe does metering natively. Unnecessary complexity. |
| onResponse hook | Custom queue (BullMQ) | Overkill at current scale. Stripe handles 1K events/sec. Queue only needed at >1K/sec sustained. |

**Installation:**
```bash
cd mission-control/apps/api && npm install stripe@21.0.1
```

## Architecture Patterns

### Recommended File Structure
```
apps/api/src/
├── middleware/
│   ├── auth.ts                    # Existing -- sets request.stripeCustomerId (Phase 1)
│   └── auth.test.ts               # Existing -- 11 tests passing
├── hooks/
│   └── meter-usage.ts             # NEW -- onResponse hook for Stripe meter events
├── services/
│   └── billing/
│       └── stripe.ts              # MODIFY -- apiVersion bump, remove @ts-ignore
├── test-utils/
│   ├── mock-unkey.ts              # Existing -- Unkey mock factory
│   └── mock-stripe.ts             # NEW -- Stripe mock factory (same pattern as mock-unkey.ts)
└── index.ts                       # MODIFY -- register onResponse hook
```

### Pattern 1: Async Meter Events via onResponse Hook
**What:** Send Stripe meter events in Fastify's `onResponse` hook, which fires after the response is already sent to the client.
**When to use:** Every authenticated API call where `request.billingPath === 'stripe'` and `request.stripeCustomerId` is set.
**Why:** Metering must never add latency to API responses. The onResponse hook is explicitly designed for side effects like "sending data to external services, for example, to gather statistics" (Fastify docs).

```typescript
// Source: Stripe API Reference + Fastify Hooks docs
// hooks/meter-usage.ts

import type { FastifyRequest, FastifyReply } from 'fastify';
import type Stripe from 'stripe';

export function createMeterUsageHook(stripe: Stripe, eventName: string) {
  return async function meterUsageHook(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    // Only meter authenticated Stripe-billed requests that succeeded
    if (
      request.billingPath !== 'stripe' ||
      !request.stripeCustomerId ||
      reply.statusCode >= 400
    ) {
      return;
    }

    // Fire-and-forget: do NOT await -- onResponse already fired after client got response
    stripe.billing.meterEvents.create({
      event_name: eventName,
      payload: {
        stripe_customer_id: request.stripeCustomerId,
        value: '1',
      },
      identifier: `${request.id}-${Date.now()}`,
    }).catch((err) => {
      request.log.error({ err }, 'Stripe meter event failed');
    });
  };
}
```

### Pattern 2: apiVersion Upgrade in StripeService
**What:** Change the Stripe client initialization from `apiVersion: '2023-10-16'` to `apiVersion: '2026-03-25.dahlia'` and remove the `@ts-ignore`.
**When to use:** One-time change in `services/billing/stripe.ts` line 30-31.

```typescript
// BEFORE (current):
// @ts-ignore - stripe is an optional dependency
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder', {
  apiVersion: '2023-10-16',
});

// AFTER:
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder', {
  apiVersion: '2026-03-25.dahlia',
});
```

### Pattern 3: Hook Registration in index.ts
**What:** Register the onResponse hook globally for `/api/v1/*` routes, matching the existing preHandler pattern.
**When to use:** One-time addition in `index.ts` after the existing `onSend` hook.

```typescript
// Source: Existing index.ts pattern (lines 67-75)
import { createMeterUsageHook } from './hooks/meter-usage';
import { stripe } from './services/billing/stripe';

// Meter usage for authenticated API calls (fires after response sent)
const meterUsage = createMeterUsageHook(stripe, process.env.STRIPE_METER_EVENT_NAME || 'api_calls');
server.addHook('onResponse', async (request, reply) => {
  if (request.url.startsWith('/api/v1/')) {
    await meterUsage(request, reply);
  }
});
```

### Anti-Patterns to Avoid
- **Synchronous metering:** Never `await stripe.billing.meterEvents.create()` inside a request handler or in a way that blocks the response. The onResponse hook fires after the response is sent, but calling `.catch()` without `await` ensures the hook itself returns quickly.
- **Metering failed requests:** Do NOT meter 4xx/5xx responses. Only successful algorithm executions should count as billable usage.
- **Missing idempotency:** Always include `identifier` to prevent double-counting on retries. The `request.id` (Fastify auto-generates a UUID) + timestamp is sufficient.
- **Hardcoding event_name:** Use an environment variable (`STRIPE_METER_EVENT_NAME`) so the meter name can be configured per environment (test vs live).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Usage metering | Custom in-memory counters or database-backed usage tracking | `stripe.billing.meterEvents.create()` | Stripe handles aggregation, invoice generation, and billing cycle management. In-memory counters reset on deploy (current bug). |
| Idempotency | Custom dedup logic with Redis/DB | Stripe's `identifier` field | 24-hour rolling dedup window built into the API. Free. |
| Meter aggregation | Pre-aggregation into time windows | Stripe Billing Meters `default_aggregation: { formula: 'sum' }` | At current scale (<1K events/sec), let Stripe aggregate. Pre-aggregation needed only above 1K/sec sustained. |
| API version compatibility | Manual Stripe API version pinning per call | SDK v21.0.1's built-in `apiVersion: '2026-03-25.dahlia'` | SDK handles version negotiation. Just pass it at client construction time. |

**Key insight:** Stripe Billing Meters was designed specifically for this use case (API call metering). The entire problem -- recording, aggregating, invoicing, and reconciling usage -- is solved by sending a single API call per request. Building custom metering is both harder and less reliable.

## Common Pitfalls

### Pitfall 1: stripe Not in package.json (@ts-ignore import)
**What goes wrong:** The current code imports `stripe` with `// @ts-ignore - stripe is an optional dependency` (line 13-14 of stripe.ts). The package is NOT in `package.json`. This works in development only because `stripe` happens to exist in a parent `node_modules`. In CI or a clean install, the import fails silently or crashes.
**Why it happens:** The StripeService was scaffolded as optional during early development.
**How to avoid:** `npm install stripe@21.0.1` in `apps/api/` directory. Remove the `@ts-ignore` comment. TypeScript will then validate all Stripe API calls.
**Warning signs:** Build warnings about missing types, runtime `MODULE_NOT_FOUND` errors in CI.

### Pitfall 2: Using Obsolete apiVersion '2023-10-16'
**What goes wrong:** The current StripeService initializes with `apiVersion: '2023-10-16'`. The legacy `usage_records` API was removed in version `2025-03-31.basil`. Any code using `createUsageRecord` or `listUsageRecordSummaries` will throw on API versions >= basil. While the existing StripeService doesn't use these methods, the old apiVersion means TypeScript types won't include the `billing.meterEvents` namespace, causing type errors.
**Why it happens:** The service was written before the billing meters migration.
**How to avoid:** Bump to `apiVersion: '2026-03-25.dahlia'` immediately after installing v21.0.1. The dahlia version has no breaking changes to billing, subscriptions, invoices, or customers -- only UI-related changes to Checkout Sessions and Stripe.js.
**Warning signs:** TypeScript errors on `stripe.billing.meterEvents`, deprecation warnings in API responses.

### Pitfall 3: Awaiting Meter Events in Request Path
**What goes wrong:** If the meter event call is `await`ed inside a handler or preHandler hook, it adds 100-300ms of network latency to every API response. OraClaw's algorithm performance is <25ms -- metering overhead would dwarf execution time.
**Why it happens:** Standard async/await habits. The natural pattern is to await every promise.
**How to avoid:** Use the `onResponse` hook (fires after response sent). Inside it, call `stripe.billing.meterEvents.create().catch(...)` without `await`. This is fire-and-forget by design.
**Warning signs:** API response times jumping from <25ms to 125-325ms after metering is added.

### Pitfall 4: Stripe.Decimal Breaking Change in v21.0.0
**What goes wrong:** SDK v21.0.0 changed all `decimal_string` fields from `string` to `Stripe.Decimal`. Code that reads these fields as `string` will get TypeScript errors.
**Why it happens:** Stripe improved type safety for decimal values.
**How to avoid:** The existing StripeService uses integer `amount` fields (`amount_paid`, `amount_due`, `subtotal`), not `decimal_string` fields. The `Stripe.Decimal` change primarily affects Issuing fields (`quantity_decimal`, `unit_cost_decimal`, etc.). **Impact on this codebase: NONE.** No code changes needed for existing methods. If creating prices with `unit_amount_decimal`, use `Stripe.Decimal.from('0.01')` instead of a bare string.
**Warning signs:** TypeScript compilation errors on fields ending in `_decimal`.

### Pitfall 5: Metering Free Tier or Failed Requests
**What goes wrong:** Sending meter events for free-tier users (no `stripeCustomerId`) causes Stripe API errors. Metering 4xx/5xx responses inflates usage counts and overcharges customers.
**Why it happens:** The onResponse hook fires for ALL responses. Without filtering, it would meter everything.
**How to avoid:** Guard the meter hook with three conditions: (1) `billingPath === 'stripe'`, (2) `stripeCustomerId` is set, (3) `reply.statusCode < 400`. The auth middleware from Phase 1 already sets these properties correctly.
**Warning signs:** Stripe errors about missing `stripe_customer_id`, customer disputes about usage counts.

## Code Examples

Verified patterns from official sources:

### Creating a Billing Meter (one-time setup, Dashboard or API)
```typescript
// Source: https://docs.stripe.com/api/billing/meter/create
const meter = await stripe.billing.meters.create({
  display_name: 'OraClaw API Calls',
  event_name: 'api_calls',
  default_aggregation: { formula: 'sum' },
  customer_mapping: {
    type: 'by_id',
    event_payload_key: 'stripe_customer_id',
  },
  value_settings: {
    event_payload_key: 'value',
  },
});
```

### Creating a Metered Price (one-time setup, Dashboard or API)
```typescript
// Source: https://docs.stripe.com/billing/subscriptions/usage-based/implementation-guide
const price = await stripe.prices.create({
  currency: 'usd',
  product: 'prod_OraClaw',
  recurring: {
    interval: 'month',
    usage_type: 'metered',
    meter: meter.id,  // Links price to the meter
  },
  unit_amount: 1,  // $0.01 per call (in cents)
  billing_scheme: 'per_unit',
});
```

### Emitting a Meter Event (per API call)
```typescript
// Source: https://docs.stripe.com/api/billing/meter-event/create
stripe.billing.meterEvents.create({
  event_name: 'api_calls',
  payload: {
    stripe_customer_id: request.stripeCustomerId,
    value: '1',
  },
  identifier: `${request.id}-${Date.now()}`,  // 24-hour rolling dedup
}).catch((err) => {
  request.log.error({ err }, 'Stripe meter event failed');
});
```

### Mock Stripe Factory for Tests (follows mock-unkey.ts pattern)
```typescript
// Source: Existing mock-unkey.ts pattern in test-utils/
import { vi } from 'vitest';

export function createMockStripe() {
  return {
    billing: {
      meterEvents: {
        create: vi.fn().mockResolvedValue({ id: 'mevt_mock' }),
      },
    },
  } as any;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `stripe.subscriptionItems.createUsageRecord()` | `stripe.billing.meterEvents.create()` | API version 2025-03-31.basil | Legacy usage records fully removed. Must use Billing Meters. |
| `apiVersion: '2023-10-16'` | `apiVersion: '2026-03-25.dahlia'` | SDK v21.0.0 (March 2026) | Latest stable API version. No billing breaking changes. |
| `@ts-ignore` import of stripe | Real dependency in package.json | Immediate | TypeScript validates all Stripe API calls. |
| In-memory usage counters (`usageLog` array) | Stripe Billing Meters | Immediate | Durable metering that survives deploys, restarts, and cold starts. |

**Deprecated/outdated:**
- `createUsageRecord`: Removed in API version `2025-03-31.basil`. Do not use.
- `listUsageRecordSummaries`: Removed in API version `2025-03-31.basil`. Do not use.
- `SubscriptionItemUsageRecord` type: Removed. Use `Stripe.Billing.MeterEvent` instead.

## Open Questions

1. **Stripe Dashboard meter creation vs API**
   - What we know: Meters can be created via Dashboard or API. Both work. Dashboard is simpler for a one-time setup.
   - What's unclear: Whether the meter should be created as a one-time manual Dashboard step or via a setup script.
   - Recommendation: Create meter via Stripe Dashboard manually (one-time action). Document the meter's `event_name` as `api_calls`. Store the event name in `STRIPE_METER_EVENT_NAME` env var. This avoids code that creates meters programmatically (which would need idempotency guards on app startup).

2. **Metering on partial Stripe setup (no subscription yet)**
   - What we know: Meter events can be sent for any customer, even without an active subscription. They accumulate but don't generate invoices without a metered price on a subscription.
   - What's unclear: Whether to gate meter event emission on subscription existence.
   - Recommendation: Send meter events regardless of subscription status. This provides an accurate usage log. Stripe silently accepts events for customers without metered subscriptions -- no errors, no charges. When the customer subscribes later, future events start billing normally.

3. **Environment variable for `STRIPE_METER_EVENT_NAME`**
   - What we know: The meter event name must match exactly between the Stripe Dashboard meter configuration and the API call.
   - What's unclear: Nothing -- this is a simple config question.
   - Recommendation: Default to `api_calls` in code, allow override via `STRIPE_METER_EVENT_NAME` env var. Add to `.env.example`.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 1.2.0 |
| Config file | `mission-control/apps/api/vitest.config.ts` |
| Quick run command | `cd mission-control/apps/api && npx vitest run src/hooks/meter-usage.test.ts` |
| Full suite command | `cd mission-control && npm run test` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INFRA-01 | Stripe SDK installed, apiVersion bumped, TypeScript compiles without @ts-ignore | typecheck | `cd mission-control/apps/api && npx tsc --noEmit` | N/A (build check) |
| BILL-01a | onResponse hook calls `stripe.billing.meterEvents.create()` for authenticated requests | unit | `cd mission-control/apps/api && npx vitest run src/hooks/meter-usage.test.ts` | Wave 0 |
| BILL-01b | onResponse hook skips metering for free tier (no stripeCustomerId) | unit | `cd mission-control/apps/api && npx vitest run src/hooks/meter-usage.test.ts` | Wave 0 |
| BILL-01c | onResponse hook skips metering for failed requests (4xx/5xx) | unit | `cd mission-control/apps/api && npx vitest run src/hooks/meter-usage.test.ts` | Wave 0 |
| BILL-01d | Meter event includes correct event_name, stripe_customer_id, value, identifier | unit | `cd mission-control/apps/api && npx vitest run src/hooks/meter-usage.test.ts` | Wave 0 |
| BILL-01e | Meter event failure does not throw (fire-and-forget with logged error) | unit | `cd mission-control/apps/api && npx vitest run src/hooks/meter-usage.test.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd mission-control/apps/api && npx vitest run --reporter=verbose`
- **Per wave merge:** `cd mission-control && npm run test` (full 945+ tests)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/hooks/meter-usage.test.ts` -- unit tests for meter event emission hook (covers BILL-01a through BILL-01e)
- [ ] `src/test-utils/mock-stripe.ts` -- shared Stripe mock factory (follows mock-unkey.ts pattern)
- [ ] No framework install needed -- vitest already configured

## Sources

### Primary (HIGH confidence)
- [Stripe Billing Meter Event Create API](https://docs.stripe.com/api/billing/meter-event/create) -- Node.js code pattern for `stripe.billing.meterEvents.create()`, `identifier` idempotency (24-hour rolling window), `timestamp` constraints (35 days past, 5 min future)
- [Stripe Billing Meter Create API](https://docs.stripe.com/api/billing/meter/create) -- Meter creation with `event_name`, `default_aggregation`, `customer_mapping`, `value_settings`
- [Stripe Usage-Based Billing Implementation Guide](https://docs.stripe.com/billing/subscriptions/usage-based/implementation-guide) -- Full pay-as-you-go workflow: meter creation, metered price, subscription, event flow to invoices
- [Stripe Recording Usage API](https://docs.stripe.com/billing/subscriptions/usage-based/recording-usage-api) -- Rate limits (1K events/sec standard, 10K/sec v2 streams), async processing, identifier
- [Stripe API Version 2026-03-25.dahlia Changelog](https://docs.stripe.com/changelog/dahlia) -- No breaking changes to billing/subscriptions/invoices. Changes are Checkout UI, Stripe.js, Connect capabilities.
- [Stripe API Version 2025-03-31.basil Changelog](https://docs.stripe.com/changelog/basil) -- Legacy usage_records removal
- [stripe npm package](https://www.npmjs.com/package/stripe) -- v21.0.1 confirmed (published 2026-03-27)
- [Fastify Hooks Reference](https://fastify.dev/docs/latest/Reference/Hooks/) -- onResponse hook fires after response sent, async/await supported, designed for "sending data to external services"
- Codebase: `apps/api/src/services/billing/stripe.ts` -- 658 lines, apiVersion '2023-10-16', @ts-ignore import, all customer/subscription/webhook code compatible with dahlia
- Codebase: `apps/api/src/middleware/auth.ts` -- Phase 1 output. Sets `request.stripeCustomerId`, `request.billingPath`, `request.tier` on every request
- Codebase: `apps/api/src/index.ts` -- Hook registration pattern: global preHandler for `/api/v1/*`, onSend for rate limit headers. No existing onResponse at global level.
- Codebase: `apps/api/package.json` -- `stripe` NOT listed in dependencies (confirmed missing)

### Secondary (MEDIUM confidence)
- [stripe-node GitHub Releases](https://github.com/stripe/stripe-node/releases) -- v21.0.0 breaking change: Stripe.Decimal replaces string for decimal_string fields (Issuing only). v21.0.1 is a CJS/ESM export fix.

### Tertiary (LOW confidence)
- None. All findings verified against primary sources.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- Stripe SDK v21.0.1 confirmed on npm, Billing Meters API verified against official docs, Fastify onResponse hook verified against Fastify docs
- Architecture: HIGH -- Pattern follows existing codebase conventions (auth middleware pattern, test-utils pattern, hook registration in index.ts). Three files modified, two new files created.
- Pitfalls: HIGH -- All pitfalls verified by reading the actual codebase and official Stripe changelogs. No speculative claims.

**Research date:** 2026-03-29
**Valid until:** 2026-04-28 (stable domain -- Stripe SDK versioning is slow-moving, Fastify 5 hooks API is stable)
