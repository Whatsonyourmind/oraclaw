# Feature Landscape: Paid Algorithm API Platform

**Domain:** Developer-facing paid ML/algorithm API with dual billing (Stripe metered + x402 machine payments)
**Researched:** 2026-03-28
**Overall confidence:** HIGH (triangulated across multiple authoritative sources, verified against existing OraClaw codebase)

---

## Table Stakes

Features users expect from any paid API. Missing any of these and developers leave before converting.

### Authentication and Key Management

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| API key issuance and rotation | Developers cannot use a paid API without keys | Low | Unkey SDK already installed. Wire `@unkey/api` verification into the auth middleware that currently does prefix-matching (`ok_test_`, `ok_live_`). |
| Tiered access (free/starter/growth/scale) | Industry standard; devs evaluate on free tier before paying | Low | Rate limit tiers already defined in `api-public.ts` (100/1,667/16,667/166,667 daily). Needs Unkey integration for real validation. |
| Bearer token auth header | Universal pattern; every HTTP client supports it | Low | Already implemented in `checkApiKey()`. |
| Key revocation | Security requirement; compromised keys must be killable instantly | Low | Delegate to Unkey's revocation API. |

### Billing and Payments

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Stripe metered billing (pay-per-call) | 43% of SaaS now uses hybrid subscription + usage; devs expect it | Medium | `StripeService` exists (658 lines) but is not wired into routes. Core work: emit `stripe.billing.meterEvents.create()` on each API call, integrate webhook handler for invoice finalization. |
| Free tier with clear limits | 2-5% free-to-paid conversion is standard; free tier drives adoption | Low | Already defined (100 calls/day). Needs enforcement via Unkey, not in-memory map. |
| Pricing page with tier comparison | Devs will not sign up for paid if pricing is unclear | Low | Static page or JSON endpoint listing tiers, quotas, and per-call costs. |
| Invoice and receipt access | Legal and accounting requirement for any business paying for an API | Low | Stripe handles this natively via customer portal. |
| Overage handling / hard vs soft caps | Devs need to know what happens when they exceed quota | Low | Define policy: hard cap on free tier (429 response), soft cap with overage billing on paid tiers. |

### Documentation

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| OpenAPI / Swagger spec | 70% of developers cite it as the first thing they look for | Medium | Generate from Fastify route schemas. Fastify has `@fastify/swagger` plugin for auto-generation. |
| Interactive API playground | Reduces time-to-first-call by 50%; developers expect "try it now" | Medium | Swagger UI or Scalar (modern alternative) served at `/docs`. |
| Quickstart guide (< 5 min to first call) | Industry benchmark is 5-minute time-to-first-call | Low | Single markdown/HTML page: get key, install SDK, make first call, see result. Three code examples (curl, Node.js, Python). |
| Code examples per endpoint | 65% of developers prefer learning through practical examples | Medium | At minimum: curl, JavaScript (SDK), Python. Include in OpenAPI spec `x-codeSamples`. |
| Error reference | Developers debug by error code; without a reference they open support tickets | Low | Enumerate all error codes, HTTP statuses, and messages in a single reference page. |

### Error Handling and Reliability

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Standardized error response format (RFC 9457) | Machine-parseable errors are table stakes for programmatic consumers | Low | Return `{ type, title, status, detail, instance }` on every error. Currently errors are ad-hoc strings. |
| Rate limit headers | `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` in every response | Low | Industry standard. Lets clients self-throttle instead of hammering until 429. |
| Request ID in every response | Enables support debugging; every major API returns one | Low | Generate UUID per request, return in `X-Request-Id` header, include in error responses. |
| Idempotency key support | Prevents duplicate billing on retries; payment-critical APIs require this | Medium | Accept `Idempotency-Key` header on POST endpoints, cache responses for 24 hours. Critical because OraClaw bills per call. |

### Versioning

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| URL-based API versioning (`/api/v1/...`) | Already implemented. Must maintain as versions evolve. | Low | Routes already use `/api/v1/`. Keep this pattern. |
| Deprecation policy (6-month notice minimum) | 52% of developers cite breaking changes as top integration concern | Low | Document policy. When v2 ships, v1 gets sunset date headers. |
| Changelog | Developers monitor changelogs to detect breaking changes | Low | Maintain `CHANGELOG.md` published at `/api/changelog`. |

### Status and Monitoring

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Health check endpoint | Load balancers, monitoring tools, and developers all expect `/health` | Low | Already implemented at `/api/v1/health`. |
| Public status page | Paid customers need to know if the service is down vs their code is broken | Low | Use OpenStatus (free, open-source) or a simple static page powered by UptimeRobot (free tier). |

---

## Differentiators

Features that set OraClaw apart. Not expected by default, but create competitive advantage and stickiness.

### AI Agent Native (x402 Machine Payments)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| x402 payment protocol (HTTP 402) | AI agents pay per call with USDC on Base -- no accounts, no subscriptions, zero onboarding friction. 75M+ x402 transactions settled by early 2026. OraClaw is one of the first algorithm APIs to support this. | High | Wallet configured (0x4509...bC93), viem installed. Need: x402 middleware that intercepts 402, verifies USDC payment on Base, then proxies to algorithm. Coinbase and Stripe both have x402 SDKs now. |
| MCP server for AI agent tool use | AI agents (Claude, GPT, custom) discover and call OraClaw algorithms as native tools. Already have 12 MCP tools defined. | Low | MCP server package exists with 12 tools. Publish to npm. This is a massive differentiator -- most algorithm APIs have no MCP presence. |
| llms.txt for AI discovery | AI coding assistants (Cursor, Claude Code) find OraClaw documentation automatically. 849+ sites adopted by early 2026. | Low | Create `/llms.txt` at root describing all 19 algorithms, endpoints, and pricing. Takes 1 hour. |
| ClawHub skills marketplace | 14 skill manifests ready for publish. Agents self-configure using SKILL.md. No equivalent exists for algorithm APIs. | Low | Skills are written. Just need ClawHub CLI authentication and publish. |

### Developer Experience Excellence

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Batch endpoint (`/api/v1/batch`) | Run multiple algorithm calls in one request. OpenAI, Anthropic, Google all offer batch at 50% discount. For OraClaw: run 100 bandit optimizations or Monte Carlo simulations in one call. | Medium | Accept array of `{ endpoint, params }` objects, execute in parallel, return array of results. Optionally offer 25-50% discount on batch calls to incentivize adoption. |
| SDK packages (npm) | `npm install @oraclaw/bandit` is 10x faster onboarding than raw HTTP. 4 of 14 already published; 167 downloads in first week shows demand. | Low | Publish remaining 10 packages. SDKs are already written as thin API clients. |
| Usage dashboard endpoint | Self-service usage analytics so devs track their own consumption. Reduces support tickets by 50%. | Medium | `/api/v1/usage` returns call counts, costs, top endpoints, rate limit remaining. Uses the existing `usageLog` array (upgrade to persistent storage). |
| Webhook notifications | Notify customers when they hit 80%/100% of quota, when invoices are generated, when new algorithms are added. | Medium | Stripe webhook handling for billing events + custom quota threshold webhooks. |

### Algorithm-Specific Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Algorithm recommendation endpoint | "I have this problem, which algorithm should I use?" -- an endpoint that takes a problem description and returns the best algorithm + parameters. No competitor does this. | Medium | `/api/v1/recommend` accepts `{ problem_type, constraints, data_shape }` and returns ranked algorithm suggestions with confidence scores. Can be rule-based initially, AI-enhanced later. |
| Chained algorithm pipelines | Run observe -> orient -> decide -> act as a single pipeline call. The OODA loop is OraClaw's unique IP -- expose it as a composable pipeline. | High | `/api/v1/pipeline` accepts OODA steps, chains outputs, returns full decision trail. Unique to OraClaw. |
| Performance guarantees | All algorithms <25ms, 14/18 under 1ms. Publish latency SLAs per algorithm. No ML API publishes per-algorithm latency guarantees. | Low | Add `X-Algorithm-Duration-Ms` header to every response. Publish latency table in docs. This is free marketing -- pure math algorithms are consistently fast. |

### Trust and Transparency

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Algorithm explainability in responses | Return not just results but reasoning: "Bandit chose Option B because UCB1 score was 0.87 vs 0.62 for Option A". Builds trust. | Low | Most algorithms already compute intermediate values. Include `explanation` field in responses with human-readable reasoning. |
| Accuracy verification data | Publish test results: "CMA-ES achieves 6e-14 on Rosenbrock". No competitor publishes verified accuracy benchmarks. | Low | Already have 945 tests. Package benchmark results into `/api/v1/benchmarks` endpoint or docs page. |

---

## Anti-Features

Features to deliberately NOT build. Each would waste time, add complexity, or hurt the product.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Admin dashboard / web UI | Out of scope per PROJECT.md. Building a frontend delays API revenue by weeks. API-first is the correct strategy for algorithm APIs -- developers want endpoints, not GUIs. | Expose all admin functions as API endpoints. Use Stripe's hosted customer portal for billing management. |
| Custom model training / fine-tuning | OraClaw algorithms are zero-dependency pure math -- no training required. Adding training pipelines would 10x infrastructure complexity for minimal value. | Market the "no training needed, works from request #1" as a feature. This is a genuine advantage over ML platforms that require data pipelines. |
| Multi-region deployment | Free tier Render, single region. Premature optimization. Latency is already <25ms per algorithm. | Monitor demand by region. If >30% of traffic comes from a non-US region, add a Render instance there. |
| GraphQL API | REST with JSON is the standard for algorithm APIs. GraphQL adds complexity with no benefit when endpoints are independent computations. AI agents and MCP tools work with REST, not GraphQL. | Stick with REST + OpenAPI. If developers request specific field selection, add `?fields=` query parameter. |
| OAuth2 / social login | Algorithm APIs use API keys, not user sessions. OAuth adds massive complexity. Enterprise SSO is a future concern, not a launch concern. | API keys via Unkey. If enterprise customers require SSO later, Unkey supports it. |
| Marketplace / third-party algorithms | Building a platform for others to publish algorithms is a different business entirely. Focus on being the best algorithm provider, not a marketplace operator. | Keep OraClaw as a curated, quality-controlled algorithm set. Add new algorithms based on customer requests. |
| Real-time streaming / WebSocket for algorithms | Algorithms return in <25ms. Streaming adds protocol complexity for zero benefit. WebSocket is for chat, not computation. | Batch endpoint covers the "many results" use case. Keep responses synchronous. |
| Mobile SDKs (iOS/Android native) | Algorithm APIs are called from backends and AI agents, not mobile apps. The existing React Native mobile app is a separate product, not an SDK distribution concern. | JavaScript/TypeScript SDK works in React Native. Python SDK covers backend. Add Go SDK only if demand materializes. |
| Credit/token system with wallet | Adds fintech complexity (refunds, expiry, balance management). Stripe metered billing and x402 per-call payments already cover both payment paths elegantly. | Stripe handles metered billing with monthly invoicing. x402 handles per-call crypto payments. No need for an intermediate credit layer. |

---

## Feature Dependencies

```
API Key Management (Unkey) ──> Rate Limiting (enforced) ──> Metered Billing (Stripe)
                                                        ──> Overage Handling
                                                        ──> Usage Dashboard

OpenAPI Spec ──> Interactive Playground (Swagger/Scalar)
             ──> SDK Code Generation (future)
             ──> llms.txt (references endpoints)

Standardized Errors (RFC 9457) ──> Error Reference Docs
                                ──> Idempotency Key Support

Health Endpoint ──> Status Page (monitors health)

Stripe Webhook Handler ──> Invoice Notifications
                       ──> Quota Threshold Alerts

x402 Middleware ──> MCP Server (can accept x402 payments)
               ──> ClawHub Skills (priced in USDC)

Batch Endpoint ──> Pipeline Endpoint (batch is simpler prerequisite)
```

### Critical Path

```
1. Unkey integration (everything else depends on real API key validation)
2. Stripe metered billing (revenue depends on this)
3. Standardized errors + rate limit headers (developer trust)
4. OpenAPI spec + playground (developer onboarding)
5. x402 middleware (second revenue path)
```

---

## MVP Recommendation

### Must ship (table stakes -- without these, no developer will pay):

1. **Unkey API key validation** -- replace in-memory prefix matching with real key verification. Enables all downstream features.
2. **Stripe metered billing wired into routes** -- the StripeService exists but is disconnected. Emit meter events on each API call. This is the revenue switch.
3. **Standardized error responses** -- RFC 9457 format on every error. Include request ID and rate limit headers.
4. **OpenAPI spec + Swagger/Scalar playground** -- `@fastify/swagger` auto-generates from route schemas. Serve at `/docs`.
5. **Quickstart guide** -- one page: get key, install `@oraclaw/bandit`, make first call, see result. Three languages (curl, JS, Python).
6. **Pricing page / endpoint** -- JSON at `/api/v1/pricing` listing all tiers, quotas, and per-call costs.
7. **Public status page** -- OpenStatus or UptimeRobot free tier. Takes 30 minutes to set up.

### Should ship (differentiators that justify OraClaw over competitors):

1. **x402 machine payments** -- second revenue path, unique positioning for AI agent economy.
2. **Remaining 10 npm SDK packages** -- already written, just need publishing.
3. **MCP server on npm** -- already built with 12 tools. Publish and it becomes discoverable by every MCP-aware AI agent.
4. **llms.txt** -- 1 hour of work, makes OraClaw discoverable by AI coding assistants.
5. **Batch endpoint** -- follow OpenAI/Anthropic pattern with optional discount.

### Defer (valuable but not launch-blocking):

- **Algorithm recommendation endpoint**: Nice differentiator but requires careful design. Ship after initial usage data shows which algorithms developers struggle to choose between.
- **OODA pipeline endpoint**: High complexity, unique IP. Ship as v1.1 feature after core billing is proven.
- **Webhook notifications**: Stripe handles billing webhooks natively. Custom quota webhooks can wait until developers ask for them.
- **Usage dashboard endpoint**: Start with Stripe's hosted dashboard. Build custom endpoint when usage patterns are understood.

---

## Competitive Positioning

| Capability | OraClaw | RapidAPI Listings | Hugging Face | OpenAI |
|-----------|---------|-------------------|--------------|--------|
| Pure algorithm API (no LLM cost) | YES | Varies | NO (model inference) | NO (token-based) |
| x402 machine payments | YES | NO | NO | NO |
| MCP server for AI agents | YES (12 tools) | NO | Partial | NO |
| Per-algorithm latency SLA | YES (<25ms) | NO | NO | NO |
| ClawHub skills | YES (14 skills) | NO | NO | NO |
| npm SDK packages | YES (14 packages) | Varies | Python only | Python + Node |
| Free tier | YES (100/day) | Varies | YES | YES |
| Metered billing | YES (Stripe) | YES (20% cut) | YES | YES |

---

## Sources

- [Zuplo: API Monetization Ultimate Guide 2026](https://zuplo.com/blog/api-monetization-ultimate-guide)
- [Zuplo: Tiered Pricing Strategy](https://zuplo.com/learning-center/how-tiered-pricing-elevates-your-api-monetization-strategy)
- [Zuplo: API Monetization Platforms Comparison](https://zuplo.com/learning-center/api-monetization-platforms)
- [Moesif: Usage-Based API Billing](https://www.moesif.com/solutions/metered-api-billing)
- [Stripe: Usage-Based Billing Implementation](https://docs.stripe.com/billing/subscriptions/usage-based/implementation-guide)
- [Stripe: Idempotent Requests](https://docs.stripe.com/api/idempotent_requests)
- [Stripe: x402 Machine Payments](https://docs.stripe.com/payments/machine/x402)
- [Coinbase: x402 Documentation](https://docs.cdp.coinbase.com/x402/welcome)
- [x402.org Whitepaper](https://www.x402.org/x402-whitepaper.pdf)
- [Zuplo: MCP API Payments with x402](https://zuplo.com/blog/mcp-api-payments-with-x402)
- [Swagger: API Documentation Best Practices](https://swagger.io/resources/articles/documenting-apis-with-swagger/)
- [Zuplo: API Error Handling Best Practices](https://zuplo.com/learning-center/best-practices-for-api-error-handling)
- [Zuplo: API Backward Compatibility](https://zuplo.com/learning-center/api-versioning-backward-compatibility-best-practices)
- [Postman: API Error Handling Best Practices](https://blog.postman.com/best-practices-for-api-error-handling/)
- [Zuplo: Idempotency Keys Implementation](https://zuplo.com/learning-center/implementing-idempotency-keys-in-rest-apis-a-complete-guide)
- [OpenAI: Batch API](https://developers.openai.com/api/docs/guides/batch)
- [RapidAPI: Monetizing Your API](https://docs.rapidapi.com/docs/monetizing-your-api-on-rapidapicom)
- [Digital API: API Monetization Models 2026](https://www.digitalapi.ai/blogs/api-monetization-models)
- [OpenStatus](https://www.openstatus.dev)
- [Unkey: Developer Platform](https://www.unkey.com/)
- [Composio: APIs for AI Agents Integration Patterns 2026](https://composio.dev/content/apis-ai-agents-integration-patterns)
