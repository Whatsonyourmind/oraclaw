# Domain Pitfalls

**Domain:** API Monetization, Metered Billing, npm SDK Distribution, Crypto Payments
**Project:** OraClaw Revenue-Ready Launch
**Researched:** 2026-03-28
**Updated:** 2026-03-28 (Stripe version specifics, x402 native Fastify correction)

---

## Critical Pitfalls

Mistakes that cause rewrites, lost revenue, or launch failure.

---

### Pitfall 1: In-Memory Rate Limiting and Usage Tracking Will Lose Revenue Data

**What goes wrong:** OraClaw currently uses in-memory `Map` objects for rate limiting (`dailyCounts`) and usage logging (`usageLog` array). On Render's free tier, the service restarts on every deploy and spins down after 15 minutes of inactivity. Every restart wipes all rate limit counters and usage events. Customers who hit their rate limit, then wait for a restart, get a fresh counter. Usage events that should trigger Stripe meter events vanish.

**Why it happens:** In-memory tracking is the fastest path to a working prototype. The codebase has comments like `// In production: send to Stripe meter` and `// replace with Unkey in production` -- the intent exists, but the wiring does not.

**Consequences:**
- Revenue leakage: API calls happen but are never billed because usage events are lost on restart
- Rate limit bypass: Users get fresh counters after every cold start (every 15 minutes on free tier)
- No billing reconciliation possible -- there is no durable record of what was consumed
- Free tier abuse at scale: sophisticated users can time requests around cold starts

**Prevention:**
1. Wire Unkey for rate limiting immediately -- it is already installed (`@unkey/api@2.3.2`), provides durable per-key tracking, and eliminates the in-memory `Map`
2. Send Stripe Billing Meter events in the `onResponse` hook (async, non-blocking). Fire-and-forget with `identifier` for idempotency
3. If meter event failure rate is concerning, buffer events to Supabase first (durable), then batch-send to Stripe
4. Add a usage reconciliation check: compare Unkey's verified-key counts against Stripe meter event summaries weekly

**Detection:** Compare Unkey verification counts with Stripe meter event counts. If they diverge by more than 1%, investigate immediately.

**Phase:** Must be addressed in the billing integration phase (wiring Stripe + Unkey). This is the single highest-priority fix.

**Confidence:** HIGH -- verified by reading the actual codebase (`api-public.ts`).

---

### Pitfall 2: Stripe Service Uses Removed Legacy API (apiVersion '2023-10-16')

**What goes wrong:** The Stripe service file (`stripe.ts`) uses `apiVersion: '2023-10-16'`. This is 2+ years old. As of Stripe API version `2025-03-31.basil`:
- `createUsageRecord` on SubscriptionItems: **REMOVED**
- `listUsageRecordSummaries` on SubscriptionItems: **REMOVED**
- `SubscriptionItemUsageRecord` and `SubscriptionItemUsageRecordSummary` resources: **REMOVED**
- All metered prices must now be backed by Billing Meters

The `stripe` npm package is not even in `package.json` -- it is imported with `@ts-ignore`. The latest Stripe SDK is v21.0.1 (published 2026-03-27) which pins `apiVersion: '2026-03-25.dahlia'`.

**Why it happens:** The StripeService was scaffolded during the transition period. Most tutorials and StackOverflow answers still reference the legacy `usage_records` API.

**Consequences:**
- If you implement metered billing using the old `createUsageRecord` pattern, it will throw errors on any API version >= `2025-03-31.basil`
- Billing that "works" on the old version will break when Stripe auto-upgrades or when the SDK is updated
- Complete billing failure: usage never gets recorded, invoices show $0
- Wasted development time building against a deprecated API

**Prevention:**
1. Install `stripe@21.0.1` as an actual dependency (not @ts-ignore)
2. Update `apiVersion` from `'2023-10-16'` to `'2026-03-25.dahlia'`
3. Use the new Billing Meters API exclusively: `stripe.billing.meterEvents.create()` with `event_name` and `payload` containing `stripe_customer_id` and `value`
4. Create meters in Stripe Dashboard or via `stripe.billing.meters.create()`
5. Verify the existing StripeService subscription/webhook code still works on the new version (the breaking changes in `2025-03-31.basil` affect usage records, not subscriptions -- but test)

**Detection:** Any code using `stripe.subscriptionItems.createUsageRecord()` or `stripe.subscriptionItems.listUsageRecordSummaries()` is using the removed API. Search for these patterns.

**Phase:** Stripe billing integration phase. Must be the FIRST thing done before writing any metering code.

**Confidence:** HIGH -- verified via Stripe official changelog (`2025-03-31.basil`) and npm registry (v21.0.1 confirmed).

---

### Pitfall 3: Stripe Webhook Handler Lacks Idempotency and Durable Processing

**What goes wrong:** The current `handleWebhookEvent` method in `stripe.ts` processes events synchronously and has no idempotency checks. Stripe retries failed webhook deliveries up to 3 days with exponential backoff. Without idempotency, duplicate events cause duplicate side effects. On Render free tier, the server may be asleep when Stripe sends a webhook, and POST requests to sleeping services have reported reliability issues.

**Why it happens:** The webhook handler was built as a clean event-routing abstraction. Idempotency and durable queuing are "production hardening" that gets deferred.

**Consequences:**
- Duplicate charges or duplicate access provisioning
- Out-of-order events corrupt state
- Webhooks hitting a sleeping Render instance may fail all retries
- Inconsistent state between Stripe and your database

**Prevention:**
1. Store processed `event.id` values in Supabase. Before processing any webhook, check if `event.id` exists -- if yes, return 200 immediately
2. Separate receipt from processing: validate signature, write raw event to Supabase, return 200 within milliseconds. Process asynchronously
3. Handle out-of-order events by checking timestamps
4. For Render free tier: ensure keep-alive cron runs at least every 10 minutes (not 15)

**Detection:** Monitor Stripe webhook delivery dashboard for failed deliveries. Any failure rate above 0% needs investigation.

**Phase:** Stripe billing integration phase, specifically webhook route wiring.

**Confidence:** HIGH -- verified via codebase review and Stripe documentation on retry behavior.

---

### Pitfall 4: Using Express Compatibility Layer for x402 in Fastify

**What goes wrong:** The natural approach is to use `@x402/express` middleware via `@fastify/middie` or `@fastify/express`. This adds an Express compatibility layer that degrades Fastify's performance, creates debugging complexity (Express semantics inside Fastify lifecycle), and adds unnecessary dependencies.

**Why it happens:** There is no `@x402/fastify` package. The obvious path is the Express adapter. The `@x402/express` README suggests using it with Express, and developers reach for compatibility layers.

**Consequences:**
- Performance degradation from Express compat layer
- Debugging complexity (two middleware models)
- Unnecessary dependencies in a codebase that doesn't use Express anywhere
- Potential lifecycle ordering issues between Express middleware and Fastify hooks

**Prevention:**
1. Use `@x402/core` (v2.3.0) directly -- it is transport-agnostic and exports `ResourceServer` and `HTTPFacilitatorClient`
2. Write a native Fastify `preHandler` hook (~50 lines) that calls `@x402/core`'s verify/settle functions
3. The Express middleware packages are thin wrappers around `@x402/core` -- replicate the same logic natively

**Detection:** Any import of `@fastify/middie`, `@fastify/express`, or `@x402/express` in the codebase should be flagged.

**Phase:** x402 implementation phase. Architecture decision must be made before any code is written.

**Confidence:** HIGH -- verified that `@x402/core` is transport-agnostic (official GitHub, npm page). No `@x402/fastify` exists (checked npm registry).

---

### Pitfall 5: x402 Protocol Maturity and Security Risk

**What goes wrong:** x402 was created by Coinbase in May 2025, with V2 launching recently. It has significant adoption (75M+ transactions) but has no published formal security audits from major firms. Building a production payment system on unaudited infrastructure means accepting unknown security risk.

**Why it happens:** x402 is the best fit for AI agent payments (HTTP-native, USDC, per-request), and OraClaw's wallet infrastructure is already configured.

**Consequences:**
- Payment verification bugs could allow free API access
- Protocol changes (V2 migration) could break integration
- Regulatory uncertainty if stablecoin payment processing triggers money transmitter obligations

**Prevention:**
1. Ship x402 as a **beta** payment path, not the primary one. Stripe metered billing is the production default
2. Use Coinbase's hosted facilitator (or Stripe as facilitator) -- shifts security responsibility to them
3. Set maximum per-call payment ceiling ($0.15) to limit exposure
4. Keep x402 behind a feature flag that can be disabled instantly
5. Monitor wallet balance against expected revenue

**Detection:** If wallet balance grows slower than API call volume suggests, investigate payment verification.

**Phase:** x402 implementation phase. Ship after Stripe billing is fully operational.

**Confidence:** MEDIUM -- x402 adoption metrics verified, but security audit status based on absence of published audits.

---

### Pitfall 6: Render Free Tier as Production Infrastructure for a Paid API

**What goes wrong:** Charging customers while running on infrastructure with 25-second cold starts, 512MB memory limits, and 15-minute sleep cycles undermines the product. A developer paying per API call expects sub-second responses, not a 25-second wait.

**Why it happens:** "Stay on free tier, upgrade based on traffic" is the current decision. Sound for pre-revenue, but the transition point is before you start charging.

**Consequences:**
- First paid API call takes 25+ seconds, developer abandons immediately
- POST-to-sleeping-service bug: paid calls silently fail
- Credibility damage kills word-of-mouth

**Prevention:**
1. Upgrade to Render paid tier ($7/month Starter) before enabling paid billing
2. If budget is zero, implement aggressive keep-alive (every 5 min) and document cold start risk
3. Add response time SLA to documentation
4. Monitor P95 latency

**Detection:** Track TTFB on all responses. Alert on any >5 seconds.

**Phase:** Infrastructure, before billing goes live. Launch blocker for paid tiers.

**Confidence:** HIGH -- Render free tier behavior verified via community reports and official docs.

---

## Moderate Pitfalls

---

### Pitfall 7: API Key Prefix Scheme Is Not Real Authentication

**What goes wrong:** The current `checkApiKey` determines tier by key prefix: `ok_test_` = starter, `ok_live_` = growth. Anyone can generate a key like `ok_live_anything` and get growth-tier access for free.

**Prevention:** Replace prefix-check with Unkey `verifyKey()` calls before going live. One-function change.

**Phase:** API key validation phase. Must complete before billing is enabled.

**Confidence:** HIGH -- verified by reading `api-public.ts`.

---

### Pitfall 8: No Metering Reconciliation Between Unkey, Application, and Stripe

**What goes wrong:** Three systems count API calls. If any disagree, you either undercharge (revenue leakage) or overcharge (chargebacks, trust damage).

**Prevention:**
1. Designate Unkey verification as canonical "this call happened" event
2. Build daily reconciliation: compare Unkey analytics to Stripe meter summaries
3. Store metering events in Supabase with cross-reference IDs
4. Alert on divergence > 0.5%

**Phase:** Billing integration, after both Unkey and Stripe wired.

**Confidence:** MEDIUM -- well-documented problem in usage-based billing literature.

---

### Pitfall 9: Pricing Hardcoded in Application Code

**What goes wrong:** Pricing structure is in `api-public.ts` as a static object. Changing prices requires code change + deploy. In the first 6 months, pricing changes are frequent.

**Prevention:**
1. Store pricing in Stripe Products/Prices as source of truth
2. Or store in environment variables / Supabase config table
3. Cache pricing with 5-minute TTL

**Phase:** Billing integration phase, part of Stripe Products/Prices setup.

**Confidence:** HIGH -- universally documented anti-pattern.

---

### Pitfall 10: npm Token Expiration and Publishing Pipeline Fragility

**What goes wrong:** npm token expired (E401 confirmed in PROJECT.md). 10 of 14 SDK packages unpublished. npm implemented major authentication changes in November 2025.

**Prevention:**
1. Regenerate automation token with granular @oraclaw scope permissions
2. Use `--provenance` flag for supply chain security
3. Add explicit `files` in package.json to control what's published
4. Test with `npm publish --dry-run` before every real publish
5. Post-launch: set up npm Trusted Publishing via GitHub Actions OIDC (replaces stored tokens entirely)

**Phase:** npm SDK publishing phase. Auth blocker must be resolved first.

**Confidence:** HIGH -- npm token expiration confirmed in PROJECT.md.

---

### Pitfall 11: Stripe Meter Event Rate Limits and Async Processing

**What goes wrong:** Stripe's Meter Event endpoint allows 1,000 events/second. Events are processed asynchronously -- usage on invoices may not immediately reflect recent events. Usage cannot be submitted after billing period ends.

**Prevention:**
1. For OraClaw's current scale, 1,000 events/sec is more than sufficient
2. If approaching limits, pre-aggregate into 1-minute windows (single event with `value: [count]`)
3. Buffer events in Supabase if needed, with retry logic for failures
4. Build usage dashboard reading from local data (real-time), not Stripe summaries (delayed)
5. Process end-of-period usage at least 1 hour before billing period closes

**Detection:** Monitor for 429 responses from Stripe meter event API.

**Phase:** Billing integration phase.

**Confidence:** HIGH -- verified via Stripe official documentation.

---

## Minor Pitfalls

---

### Pitfall 12: Developer Onboarding Friction Kills Conversion

**What goes wrong:** Industry TTFC (Time-to-First-Call) benchmark is under 5 minutes. Without quickstart, playground, or copy-paste curl examples, 50-70% of developers quit.

**Prevention:** Zero-auth try endpoint, copy-paste examples, Scalar playground at `/docs`.

**Phase:** Developer experience phase.

**Confidence:** MEDIUM -- benchmark data from Postman/Treblle research.

---

### Pitfall 13: Regulatory Risk from Stablecoin Payments

**What goes wrong:** GENIUS Act (July 2025) establishes federal stablecoin regulation. Processing USDC payments may trigger money transmitter obligations. Compliance deadline: July 18, 2026.

**Prevention:** Use Coinbase/Stripe hosted facilitator (they handle processing). Consult fintech attorney before production x402. Keep x402 revenue below thresholds until legal review.

**Phase:** x402 implementation phase. Legal review before going live.

**Confidence:** LOW -- regulatory application to API payment recipients is untested.

---

### Pitfall 14: Free Tier Too Generous for Conversion

**What goes wrong:** 100 calls/day (3,000/month) with no key may be enough for most use cases. Nobody upgrades.

**Prevention:** Track limit-hit rate. If <10% hit it, limit is too high. Consider restricting free tier to subset of algorithms.

**Phase:** Post-launch pricing optimization (first 90 days).

**Confidence:** MEDIUM -- optimal limits unknown until real data.

---

### Pitfall 15: SDK Versioning and Immutability Mistakes

**What goes wrong:** With 14 npm packages, inconsistent versioning or broken releases cause integration failures. Published packages cannot be unpublished after 24 hours.

**Prevention:** Lockstep versioning across all 14 packages. Pin `/api/v1/` in SDKs. Test against live API before publish. Use `npm deprecate` for broken versions.

**Phase:** npm SDK publishing phase.

**Confidence:** HIGH -- npm immutability constraints well-documented.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation | Severity |
|-------------|---------------|------------|----------|
| Unkey API Key Wiring | Shipping placeholder prefix auth to production | Replace prefix-check with `verifyKey()` before billing | Critical |
| Stripe Billing | Using apiVersion `2023-10-16` with removed APIs | Install stripe@21.0.1, use `2026-03-25.dahlia`, Billing Meters only | Critical |
| Stripe Billing | stripe not in package.json (@ts-ignore import) | `npm install stripe@21.0.1` as real dependency | Critical |
| Stripe Billing | In-memory usage tracking lost on restart | Stripe meter events in onResponse hook (fire-and-forget) | Critical |
| Stripe Webhooks | No idempotency, duplicate event processing | Store `event.id` in Supabase, check before processing | Critical |
| Stripe Webhooks | Sleeping Render instance misses webhook POST | Keep-alive at 5-min intervals or upgrade to paid tier | High |
| x402 Integration | Using @x402/express via @fastify/middie | Use @x402/core natively with Fastify preHandler hook | High |
| x402 Integration | No security audits on protocol | Ship as beta behind feature flag, use hosted facilitator | High |
| x402 Integration | Regulatory uncertainty on stablecoin payments | Use Coinbase/Stripe as processor, consult attorney | Medium |
| npm SDK Publishing | Expired npm token blocking all publishes | Regenerate token, set up Trusted Publishing post-launch | High |
| npm SDK Publishing | Publishing broken or sensitive data | `--dry-run` first, explicit `files` in package.json | Medium |
| Infrastructure | Cold starts killing paid user experience | Upgrade Render before enabling paid billing ($7/mo) | High |
| Pricing | Hardcoded pricing requires deploy to change | Store in Stripe or config, not code literals | Medium |
| Pricing | Free tier too generous for conversion | Track limit-hit rate, adjust after 90 days | Low |
| Developer Experience | High TTFC causing abandonment | Zero-auth try endpoint, copy-paste examples | Medium |
| Billing Reconciliation | Unkey/app/Stripe count divergence | Daily reconciliation job, canonical event source | Medium |

---

## Sources

### Stripe Billing
- [Stripe Usage-Based Billing (Meters)](https://docs.stripe.com/billing/subscriptions/usage-based)
- [Stripe Legacy Billing Removal (2025-03-31.basil)](https://docs.stripe.com/changelog/basil/2025-03-31/deprecate-legacy-usage-based-billing)
- [Stripe Billing Meters Migration Guide](https://docs.stripe.com/billing/subscriptions/usage-based-legacy/migration-guide)
- [Stripe Meter Events API (Node.js)](https://docs.stripe.com/api/billing/meter-event/create?lang=node)
- [Stripe Node.js SDK v21.0.1](https://github.com/stripe/stripe-node/releases)
- [Stripe API Version 2025-03-31.basil Changelog](https://docs.stripe.com/changelog/basil)

### x402 Protocol
- [x402 V2 Launch](https://www.x402.org/writing/x402-v2-launch)
- [x402 GitHub (Coinbase)](https://github.com/coinbase/x402)
- [@x402/core npm](https://www.npmjs.com/package/@x402/core)
- [Stripe x402 Machine Payments](https://docs.stripe.com/payments/machine/x402)
- [Coinbase CDP x402 Documentation](https://docs.cdp.coinbase.com/x402/welcome)

### Unkey
- [Unkey verifyKey API](https://www.unkey.com/docs/api-reference/v2/keys/verify-api-key)
- [Unkey Fastify Template](https://www.unkey.com/templates/fastify)

### npm Publishing
- [npm Scoped Packages](https://docs.npmjs.com/creating-and-publishing-scoped-public-packages/)
- [npm Trusted Publishing](https://docs.npmjs.com/generating-provenance-statements)

### Infrastructure
- [Render Free Tier Behavior](https://community.render.com/t/do-web-services-on-a-free-tier-go-to-sleep-after-some-time-inactive/3303)

### Regulatory
- [GENIUS Act (Gibson Dunn)](https://www.gibsondunn.com/the-genius-act-a-new-era-of-stablecoin-regulation/)

### API Monetization
- [Usage-Based Billing Best Practices (Flexprice)](https://flexprice.io/blog/how-to-prevent-revenue-leakage-in-usage-based-pricing)
- [Metered Billing Pitfalls (Vayu)](https://www.withvayu.com/blog/implementing-metered-billing-software)
- [API Monetization Guide (Speakeasy)](https://www.speakeasy.com/api-design/monetization)
