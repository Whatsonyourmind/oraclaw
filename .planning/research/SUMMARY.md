# Research Summary: OraClaw Revenue-Ready Launch

**Domain:** Paid ML/algorithm API platform with dual billing (Stripe metered + x402 machine payments)
**Researched:** 2026-03-28
**Updated:** 2026-03-28 (version pinning, Stripe Meters migration, x402 V2 packages, native Fastify approach)
**Overall confidence:** HIGH

## Executive Summary

The paid API platform market in 2026 has a clear set of table stakes that every developer-facing API must have: API key management, metered billing, OpenAPI documentation with an interactive playground, standardized error responses, rate limiting with transparent headers, and a public status page. OraClaw has the bones of most of these (rate limits defined, StripeService written, health endpoint live) but none are fully wired end-to-end. The gap between "code exists" and "revenue flows" is the integration work.

Three critical technical facts emerged from research that affect implementation: (1) Stripe's legacy `usage_records` API was **removed** in version `2025-03-31.basil` -- the existing StripeService using `apiVersion: '2023-10-16'` must be upgraded to v21.0.1 with the new Billing Meters API. (2) There is no `@x402/fastify` package, and the codebase should NOT add `@fastify/middie` to use the Express adapter -- instead, `@x402/core` v2.3.0 is transport-agnostic and a native Fastify preHandler hook is ~50 lines. (3) The `stripe` npm package is imported with `@ts-ignore` but not actually listed in `package.json` -- it must be installed as a real dependency.

OraClaw's strongest differentiator is its AI agent native positioning. The x402 payment protocol has crossed 75+ million transactions by early 2026, with Stripe and Coinbase both shipping official integrations. Stripe now acts as an x402 facilitator itself (preview, March 2026), meaning OraClaw can get unified dashboard visibility across both Stripe metered billing AND x402 crypto payments. Combined with 12 MCP tools and 14 npm SDK packages, OraClaw can be the first algorithm API that AI agents discover, use, and pay for autonomously.

The biggest risk is shipping billing without proper API key validation. The current in-memory rate tracking and prefix-based key validation (`ok_live_*` = growth tier) is a placeholder that anyone who reads the source can exploit. Unkey must be wired first because every downstream feature (rate limiting, metered billing, usage tracking, quota alerts) depends on knowing who is making the call.

## Key Findings

**Stack:** Fastify 5.8.4 + Unkey @2.3.2 (API keys) + Stripe @21.0.1 Billing Meters (metered) + @x402/core @2.3.0 (machine payments) + viem @2.47.6 (wallet) + Scalar (API docs)
**Architecture:** Dual-path middleware: Auth (Unkey verifyKey) -> Rate Limit -> Algorithm -> Stripe Meter Event (async onResponse) || x402 (native preHandler) -> Algorithm -> Settlement (facilitator)
**Critical pitfall:** StripeService uses removed API (`apiVersion: '2023-10-16'`). Must upgrade to `2026-03-25.dahlia` and use Billing Meters API, not legacy `usage_records`.

## Implications for Roadmap

Based on research, suggested phase structure:

1. **Auth and Key Management** - Wire Unkey into API routes, replace in-memory prefix matching
   - Addresses: API key issuance, rotation, revocation, tier validation, distributed rate limiting
   - Avoids: Billing without attribution pitfall; prefix-based auth bypass

2. **Billing Integration** - Install stripe@21.0.1, bump apiVersion, wire Billing Meters
   - Addresses: Revenue generation, meter event emission, invoice access, overage handling
   - Avoids: Using deprecated legacy usage_records API; in-memory usage tracking lost on restart
   - Note: Create Meter + metered Price in Stripe Dashboard as setup step

3. **Developer Experience** - OpenAPI spec, Scalar playground, quickstart, error standardization
   - Addresses: Documentation, onboarding (<5 min TTFC), RFC 9457 errors, rate limit headers
   - Avoids: Slow onboarding killing conversion

4. **AI Agent Revenue Path** - x402 native Fastify hook, ClawHub skills, MCP server publish, llms.txt
   - Addresses: x402 payments via @x402/core (NOT @x402/express), AI agent discovery
   - Avoids: Express compatibility layer degrading Fastify performance
   - Note: Ship x402 as beta behind feature flag; use Stripe or CDP as facilitator

5. **Marketplace Distribution** - Publish remaining 10 npm SDK packages, 14 ClawHub skills
   - Addresses: Developer adoption, AI agent discoverability, npm presence
   - Blockers: npm token expired (E401), ClawHub CLI not authenticated -- both need browser login

6. **Growth Features** - Batch endpoint, usage dashboard, webhook notifications
   - Addresses: Power user needs, developer stickiness, self-service
   - Avoids: Premature optimization before core billing works

**Phase ordering rationale:**
- Auth must come first because billing, rate limiting, and usage tracking all depend on customer identity
- Billing before DX because revenue capability is the milestone's core goal
- DX before AI agent path because human developers convert faster and validate the product
- AI agent path before marketplace because x402 middleware is needed for USDC-priced skills
- Marketplace before growth features because 10 unpublished SDK packages are already written
- Growth features last because they optimize an already-working product

**Research flags for phases:**
- Phase 1: Standard patterns (Unkey docs comprehensive), unlikely to need research
- Phase 2: Stripe Meters API well-documented but apiVersion migration may surface edge cases in existing StripeService code
- Phase 4: x402 V2 is new (V2 launched recently) -- monitor @x402/core for breaking changes. Native Fastify implementation needs careful testing.
- Phase 5: npm auth blocker requires browser-based login (cannot be automated)

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All versions verified on npm (stripe@21.0.1, @x402/core@2.3.0, @unkey/api@2.3.2, viem@2.47.6). Stripe Meters API verified against official docs. |
| Features | HIGH | Triangulated across Zuplo, Stripe, Moesif, Postman reports, and competitor analysis |
| Architecture | HIGH | Dual-path middleware is standard API monetization pattern. Native Fastify x402 approach verified against @x402/core being transport-agnostic. |
| Pitfalls | HIGH | Stripe legacy API removal verified via official changelog. In-memory tracking issues verified by reading codebase. x402 security maturity is MEDIUM confidence. |

## Gaps to Address

- x402 V2 session-based access patterns (wallet identity, reusable sessions) need phase-specific research when building that phase
- Stripe machine payments preview access may require applying through Stripe Dashboard -- verify eligibility before depending on Stripe as x402 facilitator
- Unkey's pricing at scale (beyond 1,000 monthly active keys) should be verified before growth phase
- ClawHub marketplace authentication flow needs browser-based investigation (cannot be automated by Claude)
- Regulatory implications of USDC payment acceptance (GENIUS Act, money transmitter obligations) need legal review before x402 goes live in production
