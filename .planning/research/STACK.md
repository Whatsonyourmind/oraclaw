# Technology Stack

**Project:** OraClaw Revenue-Ready Launch (API Monetization & Marketplace)
**Researched:** 2026-03-28
**Updated:** 2026-03-28 (version pinning, x402 V2 packages, Stripe Meters migration)

## Recommended Stack

This stack builds on what exists. No rip-and-replace -- only additions to fill revenue-readiness gaps.

### Core Framework (Already Deployed, No Changes)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Fastify | 5.8.4 | HTTP server | Already deployed, live on Render. All billing routes plug into existing route structure via lifecycle hooks. |
| TypeScript | 5.3.3 | Type safety | Already in use, strict mode. |
| Node.js | 22.x LTS | Runtime | Already deployed. Stripe SDK 21.x requires Node 18+. |
| Turborepo | 1.13.3 | Monorepo | Already managing apps/ and packages/ workspaces. |

### Billing & Payments (New + Integration Needed)

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| `stripe` | **21.0.1** | Metered billing, subscriptions, invoices | Industry standard. **NOT installed** -- the `stripe.ts` service has `@ts-ignore` on its import. Must install as a real dependency. New Billing Meters API replaces legacy usage records (removed in API version `2025-03-31.basil`). The existing 658-line StripeService needs only apiVersion bump and meter event wiring. Stripe is also the only provider integrating as an x402 facilitator, unifying both billing paths in one dashboard. | HIGH |
| `@unkey/api` | **2.3.2** | API key creation, verification, rate limiting, tier resolution | Purpose-built for developer API key management. Single `verifyKey()` call handles validation + rate limiting + usage quotas in one round trip. Already installed. No competitor matches this focused feature set at this price point. Free tier covers 1,000 monthly active keys. Recently rebuilt in Go for 6x performance. | HIGH |
| `@unkey/ratelimit` | **2.1.2** | Distributed per-key rate limiting | Pairs with @unkey/api for tiered rate limits (free: 100/min, paid: 1000/min). Edge-distributed, no Redis required. Eliminates the in-memory `Map<string, {count, resetAt}>` that resets on every deploy. | MEDIUM |

### x402 Machine Payments (New Implementation)

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| `@x402/core` | **2.3.0** | Protocol types, payment verification, settlement logic | Official Coinbase-maintained x402 V2 reference SDK. **Transport-agnostic** -- provides `ResourceServer`, `FacilitatorClient`, and payment scheme types that work with any HTTP framework. This is the foundation; framework middleware packages are thin wrappers around it. | HIGH |
| `@x402/evm` | **latest** (2.x) | EVM chain payment scheme (Base USDC) | Handles ERC-20 payment verification and settlement on Base using the `exact` payment scheme. Required for USDC on Base (chain ID `eip155:8453`). | HIGH |
| `viem` | **2.47.6** | Ethereum/Base chain interaction | Already installed at this exact version. TypeScript-first Ethereum interface. Required by `@x402/evm` for payment signing and wallet operations. Supports Base chain natively. | HIGH |
| Stripe as x402 facilitator | N/A (API config) | Payment settlement, deposit addresses | Stripe now acts as an x402 facilitator (announced March 2026, preview). Creates `PaymentIntent` with `payment_method_types: ["crypto"]` in deposit mode, generates Base USDC deposit addresses, auto-captures on settlement. Gives you x402 payments AND Stripe dashboard visibility in one integration. Requires API version `2026-03-04.preview` or later for machine payments. | HIGH |
| Coinbase CDP facilitator | N/A (API fallback) | Alternative payment facilitator | Free tier: 1,000 transactions/month, then $0.001/tx. Use as fallback if Stripe machine payments preview is not yet available for your account. Processes ERC-20 on Base, Polygon, and Solana. | MEDIUM |

### Marketplace & Distribution

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| npm (`@oraclaw/*`) | npm CLI v10+ | SDK package distribution | 14 thin API client packages under `@oraclaw` scope. 4 already published (167 downloads first week), 10 remaining. ESM + TypeScript declarations. Zero runtime dependencies. | HIGH |
| ClawHub CLI (`clawhub`) | latest | AI agent skill marketplace publishing | 14 SKILL.md manifests ready with pricing ($0.01-$0.15/call). `clawhub publish ./my-skill` workflow. Skills discoverable via vector search by AI agents. Requires GitHub account (1 week old minimum). | MEDIUM |

### Documentation (New Addition)

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| `@fastify/swagger` | latest (9.x) | OpenAPI 3.1 spec generation | Already installed (9.7.0). Auto-generates from Fastify route schemas. Zero manual spec maintenance. | HIGH |
| `@scalar/fastify-api-reference` | latest | Interactive API playground | Modern alternative to Swagger UI. Better DX, dark mode, TypeScript-first. Replaces dated Swagger UI. | MEDIUM |

### Monitoring (New Addition)

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| OpenStatus | free tier | Public status page + uptime monitoring | Open-source, free, monitors from multiple regions. Takes 30 minutes to set up. Required for any paid API. | MEDIUM |

---

## Detailed Technology Decisions

### 1. Stripe: Install Package + Upgrade to Billing Meters API

**STATUS:** `stripe` is imported in `stripe.ts` with `@ts-ignore` but is **NOT in package.json**. It must be added as a real dependency.

**CRITICAL:** The existing StripeService uses `apiVersion: '2023-10-16'`. This is 2+ years old.

- The **legacy usage records API** (`createUsageRecord`, `listUsageRecordSummaries`) was **removed** in Stripe version `2025-03-31.basil`
- The new approach: **Billing Meters** -- create a Meter, attach it to a Price, send Meter Events per API call
- Stripe SDK v21.0.1 (latest, published 2 days ago) pins API version `2026-03-25.dahlia`
- Meter Events support 1,000 events/second (10,000/sec with v2 streams)
- Metronome (acquired by Stripe) features are folding into Stripe Billing natively

**Implementation pattern (Node.js SDK v21):**
```typescript
// 1. Create meter (one-time, Dashboard or API)
const meter = await stripe.billing.meters.create({
  display_name: 'OraClaw API Calls',
  event_name: 'api_call',
  default_aggregation: { formula: 'sum' },
});

// 2. Create metered price tied to the meter
const price = await stripe.prices.create({
  currency: 'usd',
  product: 'prod_OraClaw',
  recurring: { interval: 'month', meter: meter.id, usage_type: 'metered' },
  unit_amount: 1, // $0.01 per unit (100 = $1)
  billing_scheme: 'per_unit',
});

// 3. On each API call, report usage (fire-and-forget)
await stripe.billing.meterEvents.create({
  event_name: 'api_call',
  payload: {
    value: '1',
    stripe_customer_id: 'cus_xxx',
  },
  identifier: `${requestId}-${Date.now()}`, // idempotency
});
```

**Version decision:** Use `stripe@21.0.1` with `apiVersion: '2026-03-25.dahlia'`. Do NOT stay on the old `2023-10-16` version. The StripeService's subscription and webhook handling code is compatible with the new API version -- the breaking change is only in usage records (which we're replacing with meters anyway).

### 2. Unkey: verifyKey() in Fastify preHandler Hook (No Plugin Needed)

**There is no `@unkey/fastify` plugin.** Integration is trivial via Fastify's native `preHandler` hook -- no compatibility layer needed.

```typescript
import { verifyKey } from '@unkey/api';

const authHook = async (request, reply) => {
  const key = request.headers.authorization?.replace('Bearer ', '');
  if (!key) return reply.code(401).send({ error: 'API key required' });

  const { result, error } = await verifyKey({
    key,
    apiId: process.env.UNKEY_API_ID,
  });
  if (error || !result.valid) {
    const code = result?.code === 'RATE_LIMITED' ? 429 : 401;
    return reply.code(code).send({ error: result?.code || 'Invalid key' });
  }

  // Attach metadata for downstream billing
  request.unkeyMeta = result; // includes: tier, rateLimit remaining, stripeCustomerId
};
```

**Why Unkey, not alternatives:**
| Alternative | Why Not |
|-------------|---------|
| `fastify-api-key` | Too simple -- no rate limiting, no tiers, no analytics, no key rotation |
| Roll-your-own with PostgreSQL | Reinventing key management is a security risk. Unkey handles creation, rotation, revocation, rate limits, per-key analytics |
| Auth0 / Clerk | Full auth systems -- overkill for API key gating on a headless API with no user sessions |
| Zuplo | Bundles gateway + keys, but OraClaw already has Fastify. Adding a gateway layer is unnecessary complexity |

### 3. x402: Native Fastify preHandler Hook (NOT @x402/express via middie)

**There is no `@x402/fastify` package.** The available framework adapters are:
- `@x402/express` -- Express middleware
- `@x402/hono` -- Hono middleware
- `@x402/next` -- Next.js middleware

**Use `@x402/core` + `@x402/evm` directly with a native Fastify `preHandler` hook.** The core package is transport-agnostic by design. The Express middleware is just a thin wrapper (~30 lines) around `@x402/core`'s `ResourceServer`.

**Do NOT use `@fastify/express` or `@fastify/middie`** to run the Express x402 middleware. This adds an Express compatibility layer that:
- Degrades Fastify's performance advantages
- Adds unnecessary dependencies
- Creates debugging complexity (Express semantics inside Fastify lifecycle)

Building a native Fastify x402 handler is approximately 50 lines of code using `@x402/core`'s `ResourceServer` API:

```typescript
import { ResourceServer, HTTPFacilitatorClient } from '@x402/core/server';
import { ExactEvmScheme } from '@x402/evm/exact/server';

const facilitatorClient = new HTTPFacilitatorClient({
  url: 'https://x402.org/facilitator', // testnet
});

const x402Server = new ResourceServer(facilitatorClient)
  .register('eip155:8453', new ExactEvmScheme());

// Fastify preHandler hook
const x402Hook = async (request, reply) => {
  const paymentHeader = request.headers['x-payment'];
  if (!paymentHeader) {
    // Return 402 with payment requirements
    return reply.code(402).header('payment-required', JSON.stringify({
      accepts: [{ scheme: 'exact', price: routePrice, network: 'eip155:8453',
                  payTo: process.env.RECEIVING_WALLET_ADDRESS }],
    })).send({ error: 'Payment required' });
  }

  const result = await x402Server.verify(paymentHeader, routeConfig);
  if (!result.valid) {
    return reply.code(402).send({ error: 'Invalid payment', details: result.error });
  }

  request.billingPath = 'x402';
  request.paymentResult = result;
};
```

**Facilitator choice:** Stripe now supports x402 natively (preview, March 2026). When using Stripe as facilitator, it creates a `PaymentIntent` with `payment_method_types: ["crypto"]` in deposit mode on Base. This gives unified dashboard visibility for both Stripe metered billing AND x402 crypto payments. If Stripe machine payments preview is not yet enabled for your account, fall back to Coinbase CDP facilitator (1,000 free tx/month).

### 4. npm SDK Publishing: ESM + TypeScript + Trusted Publishing

The 14 SDK packages follow a validated pattern (4 already published, 167 downloads first week):
- Scoped under `@oraclaw`
- Thin API clients (zero algorithm source code leaked)
- `"type": "module"` for ESM
- Zero runtime dependencies
- TypeScript source served directly (no build step needed for initial publish)

**Immediate action:** 10 packages need `npm publish --access public`. The `E401` token requires browser-based `npm login` first.

**Post-launch automation:** Set up npm Trusted Publishing via GitHub Actions OIDC. This replaces stored npm tokens entirely -- GitHub proves its identity to npm, npm issues short-lived credentials. No more expired tokens blocking publishes.

### 5. ClawHub Skills: SKILL.md + clawhub CLI

14 SKILL.md manifests are complete with pricing ($0.01-$0.15/call in USDC). Publishing:
1. `clawhub login` (GitHub OAuth -- requires browser)
2. `clawhub publish ./oraclaw-bandit` (per skill)

Skills are discovered by AI agents via vector search on ClawHub. The SKILL.md format is the standard. No changes needed to existing manifests.

---

## Versions Summary: What to Install

```bash
# New dependencies to add to apps/api/package.json
npm install stripe@21.0.1
npm install @x402/core @x402/evm
npm install @unkey/ratelimit

# New dev/documentation dependencies
npm install @scalar/fastify-api-reference

# Already installed (verified current versions)
# @unkey/api@2.3.2 -- current, no update needed
# viem@2.47.6 -- current, no update needed
# @fastify/swagger@9.7.0 -- already installed

# Global CLI tools (for publishing)
npm install -g clawhub
```

**Critical version table:**

| Package | Currently | Required | Action |
|---------|-----------|----------|--------|
| `stripe` | NOT in package.json (imported with @ts-ignore) | 21.0.1 | `npm install stripe@21.0.1` + update apiVersion from `2023-10-16` to `2026-03-25.dahlia` |
| `@unkey/api` | 2.3.2 | 2.3.2 | No change |
| `@unkey/ratelimit` | Not installed | 2.1.2 | `npm install @unkey/ratelimit` |
| `viem` | 2.47.6 | 2.47.6 | No change |
| `@x402/core` | Not installed | 2.3.0 | `npm install @x402/core` |
| `@x402/evm` | Not installed | latest (2.x) | `npm install @x402/evm` |
| `@fastify/swagger` | 9.7.0 | 9.7.0 | No change |
| `@scalar/fastify-api-reference` | Not installed | latest | `npm install @scalar/fastify-api-reference` |

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Metered billing | Stripe Billing Meters | Metronome | Stripe acquired Metronome. Native Meters API handles OraClaw's scale. Extra vendor adds cost and complexity. |
| Metered billing | Stripe Billing Meters | Orb | Good product, but adds a billing vendor dependency when Stripe handles metering natively. |
| Metered billing | Stripe Billing Meters | Lago (open source) | Self-hosted complexity. Not worth it when Stripe does this out of the box. |
| API key management | Unkey | `fastify-api-key` | Too simple -- no rate limiting, no tiers, no analytics, no key rotation |
| API key management | Unkey | Custom PostgreSQL | Security risk to reinvent. Unkey handles creation, rotation, revocation, rate limits, analytics. |
| API key management | Unkey | Auth0 / Clerk | Full auth systems -- overkill for headless API key management |
| x402 middleware | Native Fastify hook + `@x402/core` | `@x402/express` via `@fastify/middie` | Express compat layer degrades performance and creates debugging complexity. Core is transport-agnostic by design. |
| x402 facilitator | Stripe (native x402 support) | CDP facilitator (Coinbase) | Stripe gives dashboard visibility + unified billing across both paths. CDP is a good fallback (1,000 free tx/month). |
| x402 facilitator | Stripe (native x402 support) | Self-hosted facilitator | Unnecessary infrastructure burden. Use hosted services. |
| Blockchain SDK | viem | ethers.js v6 | viem is lighter, TypeScript-first, tree-shakeable, better types. Already installed. |
| SDK distribution | npm (scoped @oraclaw) | GitHub Packages | npm is universal. GitHub Packages adds friction for consumers who don't use GitHub. |
| SDK distribution | npm (scoped @oraclaw) | JSR (Deno registry) | JSR is too new, limited adoption. npm is the standard. |
| Agent marketplace | ClawHub | Custom marketplace | ClawHub is the emerging standard for OpenClaw skills. 14 manifests already written. |
| API docs | Scalar | Swagger UI | Scalar is more modern, better DX, dark mode, actively maintained. Swagger UI is dated. |
| API docs | Scalar | Redocly | Redocly is excellent but overkill for a single API. |
| Status page | OpenStatus | Betterstack | Betterstack is paid. OpenStatus is free and open-source. |

---

## Sources

### Stripe (HIGH confidence)
- [Stripe Billing Meters API](https://docs.stripe.com/api/billing/meter) -- meter creation and configuration
- [Stripe Meter Events API (Node.js)](https://docs.stripe.com/api/billing/meter-event/create?lang=node) -- event creation code examples
- [Stripe Usage-Based Billing Implementation Guide](https://docs.stripe.com/billing/subscriptions/usage-based/implementation-guide) -- full pay-as-you-go workflow
- [Stripe Usage-Based Billing Overview](https://docs.stripe.com/billing/subscriptions/usage-based) -- Metronome acquisition note
- [Stripe x402 Machine Payments](https://docs.stripe.com/payments/machine/x402) -- x402 facilitator implementation
- [Stripe API Version 2025-03-31.basil](https://docs.stripe.com/changelog/basil) -- breaking changes, legacy removal
- [Stripe Legacy Usage Billing Removal](https://docs.stripe.com/changelog/basil/2025-03-31/deprecate-legacy-usage-based-billing) -- migration requirement
- [Stripe Node.js SDK v21.0.1](https://github.com/stripe/stripe-node/releases) -- latest release (published 2026-03-27)
- [stripe on npm](https://www.npmjs.com/package/stripe) -- v21.0.1 confirmed

### x402 Protocol (HIGH confidence)
- [x402 V2 Launch Announcement](https://www.x402.org/writing/x402-v2-launch) -- modular architecture, @x402 npm org, wallet sessions
- [x402 GitHub (Coinbase)](https://github.com/coinbase/x402) -- package list: @x402/core, @x402/evm, @x402/express, @x402/hono, @x402/next, @x402/paywall
- [@x402/core on npm](https://www.npmjs.com/package/@x402/core) -- v2.3.0, published 6 days ago
- [Coinbase CDP x402 Documentation](https://docs.cdp.coinbase.com/x402/welcome) -- facilitator details, free tier (1,000 tx/month)
- [Stripe x402 Integration (The Block)](https://www.theblock.co/post/389352/stripe-adds-x402-integration-usdc-agent-payments) -- Stripe as x402 facilitator

### Unkey (HIGH confidence)
- [Unkey Official Site](https://www.unkey.com/) -- product overview, pricing
- [Unkey Fastify Template](https://www.unkey.com/templates/fastify) -- Fastify integration pattern
- [Unkey verifyKey API Reference](https://www.unkey.com/docs/api-reference/v2/keys/verify-api-key) -- single-call auth + rate limiting
- [@unkey/api on npm](https://www.npmjs.com/package/@unkey/api) -- v2.3.2 confirmed
- [@unkey/ratelimit on npm](https://www.npmjs.com/package/@unkey/ratelimit) -- v2.1.2, published 9 days ago

### viem (HIGH confidence)
- [viem on npm](https://www.npmjs.com/package/viem) -- v2.47.6, published 1 day ago
- [viem Official Documentation](https://viem.sh/) -- Base chain support, wallet client

### npm Publishing (HIGH confidence)
- [npm Scoped Packages Documentation](https://docs.npmjs.com/creating-and-publishing-scoped-public-packages/) -- `--access public` requirement
- [npm Trusted Publishing](https://docs.npmjs.com/generating-provenance-statements) -- OIDC-based publishing from GitHub Actions

### ClawHub / OpenClaw (MEDIUM confidence)
- [ClawHub Official](https://clawhub.ai/) -- skill registry
- [ClawHub Documentation](https://docs.openclaw.ai/tools/clawhub) -- `clawhub publish` workflow
- [ClawHub GitHub (openclaw/clawhub)](https://github.com/openclaw/clawhub) -- skill directory

### API Monetization Landscape (MEDIUM confidence)
- [9 Best Usage-Based Billing Software (2026)](https://blog.alguna.com/usage-based-billing-software/) -- market overview, Metronome/Orb/Lago comparison
- [Best Open-Source Stripe Billing Alternatives (Flexprice)](https://flexprice.io/blog/open-source-stripe-billing-alternatives) -- Lago, Flexprice analysis
- [6 Best Usage-Based Billing for AI Companies (2026)](https://www.paritydeals.com/blog/best-usage-based-billing-platforms/) -- AI-specific billing platforms
