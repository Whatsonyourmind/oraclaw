# Roadmap: OraClaw Revenue-Ready Launch

## Overview

OraClaw has 19 algorithms deployed and tested but zero revenue flowing. This roadmap takes the platform from "code exists" to "money comes in" by wiring authentication, dual-path billing (Stripe metered + x402 USDC), developer-facing documentation, and marketplace distribution. Every phase delivers a verifiable capability, ordered so that each unlocks the next: identity first, then billing, then docs, then distribution, then full verification.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Auth and Access Control** - Wire Unkey API key management, tier-based rate limiting, and rate limit headers into all routes
- [ ] **Phase 2: Stripe Billing Setup** - Upgrade Stripe SDK to v21.0.1, wire Billing Meters API for per-call metering
- [ ] **Phase 3: Billing Tiers and Portal** - Implement free/paid tier enforcement and Stripe customer portal access
- [ ] **Phase 4: Developer Experience** - OpenAPI 3.1 spec with Scalar playground, RFC 9457 errors, and llms.txt for AI discovery
- [ ] **Phase 5: x402 Machine Payments** - Native Fastify preHandler for USDC machine payments via @x402/core
- [ ] **Phase 6: Batch Endpoint** - Multi-algorithm batch calls in one request with 50% metered discount
- [ ] **Phase 7: npm and MCP Distribution** - Publish remaining 10 SDK packages and MCP server with Trusted Publishing
- [ ] **Phase 8: ClawHub Distribution and E2E Verification** - Publish 14 ClawHub skills and verify full billing flow end-to-end

## Phase Details

### Phase 1: Auth and Access Control
**Goal**: API consumers can authenticate, manage keys, and receive transparent rate limiting on every call
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04
**Success Criteria** (what must be TRUE):
  1. A developer can create an API key via Unkey and use it to call any OraClaw endpoint successfully
  2. A developer can rotate or revoke an API key and the old key stops working immediately without API downtime
  3. Rate limits are enforced per tier via Unkey's distributed system (not in-memory), and exceeding the limit returns HTTP 429
  4. Every API response includes X-RateLimit-Remaining, X-RateLimit-Limit, and X-RateLimit-Reset headers
**Plans:** 2 plans

Plans:
- [ ] 01-01-PLAN.md — Unkey auth middleware, rate limit headers, old auth removal
- [ ] 01-02-PLAN.md — Key management tests, auth middleware tests, full regression

### Phase 2: Stripe Billing Setup
**Goal**: API calls generate Stripe meter events that flow into the billing system
**Depends on**: Phase 1
**Requirements**: INFRA-01, BILL-01
**Success Criteria** (what must be TRUE):
  1. Stripe SDK v21.0.1 is installed as a real dependency (no @ts-ignore) with apiVersion 2026-03-25.dahlia
  2. Every authenticated API call emits a Stripe Billing Meter event (via async onResponse hook, not blocking the response)
  3. Meter events appear in the Stripe Dashboard under Billing > Meters within seconds of an API call
**Plans:** 2 plans

Plans:
- [ ] 02-01-PLAN.md — Stripe SDK install, apiVersion upgrade, mock factory
- [ ] 02-02-PLAN.md — Meter usage onResponse hook (TDD: tests first, then implementation + wiring)

### Phase 3: Billing Tiers and Portal
**Goal**: Developers can use OraClaw for free or pay for higher usage, and view their billing in a self-service portal
**Depends on**: Phase 2
**Requirements**: BILL-02, BILL-03, BILL-05
**Success Criteria** (what must be TRUE):
  1. An unauthenticated caller can make up to 100 API calls per day without an API key (free tier)
  2. A paid subscriber on any tier (starter/growth/scale/enterprise) is billed per call via Stripe metered subscription
  3. A paying customer can access the Stripe customer portal to view usage, invoices, and manage their subscription
**Plans:** 2 plans

Plans:
- [ ] 03-01-PLAN.md — Free-tier IP rate limiting (@fastify/rate-limit), tier config with Stripe price IDs
- [ ] 03-02-PLAN.md — Subscription checkout route, customer portal session endpoint, billing route wiring

### Phase 4: Developer Experience
**Goal**: Developers can discover, understand, and integrate with OraClaw in under 5 minutes using interactive docs and consistent error handling
**Depends on**: Phase 1
**Requirements**: DX-01, DX-02, DX-03
**Success Criteria** (what must be TRUE):
  1. An OpenAPI 3.1 spec is auto-generated from Fastify routes and served via Scalar interactive playground at a public URL
  2. All error responses across every endpoint follow RFC 9457 problem details format (type, title, status, detail fields)
  3. An llms.txt file is served at /llms.txt describing OraClaw's capabilities for AI assistant discovery
**Plans**: TBD

Plans:
- [ ] 04-01: TBD
- [ ] 04-02: TBD

### Phase 5: x402 Machine Payments
**Goal**: AI agents can pay for OraClaw API calls with USDC via the x402 protocol without any human involvement
**Depends on**: Phase 1
**Requirements**: BILL-04, INFRA-02
**Success Criteria** (what must be TRUE):
  1. @x402/core and @x402/evm packages are installed and a native Fastify preHandler hook validates x402 payment headers
  2. An AI agent can call any gated endpoint by including x402 USDC payment in the request, receiving the algorithm result after settlement
  3. The x402 payment flow works independently of Stripe -- an agent with a funded wallet needs no API key or Stripe subscription
**Plans**: TBD

Plans:
- [ ] 05-01: TBD
- [ ] 05-02: TBD

### Phase 6: Batch Endpoint
**Goal**: Power users and agents can call multiple algorithms in a single request and receive a 50% discount on metered billing
**Depends on**: Phase 2, Phase 3
**Requirements**: DX-04
**Success Criteria** (what must be TRUE):
  1. A single POST request to the batch endpoint can include multiple algorithm calls and returns all results in one response
  2. Partial failures in a batch are handled gracefully -- successful results are returned alongside error details for failed calls
  3. Batch calls are metered at 50% of the per-call rate in Stripe Billing Meters
**Plans**: TBD

Plans:
- [ ] 06-01: TBD

### Phase 7: npm and MCP Distribution
**Goal**: All 14 OraClaw SDK packages and the MCP server are published to npm with automated, token-free publishing
**Depends on**: Phase 1
**Requirements**: DIST-01, DIST-02, DIST-04
**Success Criteria** (what must be TRUE):
  1. All 14 @oraclaw/* SDK packages (including the 10 remaining) are published and installable via npm
  2. @oraclaw/mcp-server is published and an AI agent can discover and use OraClaw tools via MCP
  3. GitHub Actions OIDC Trusted Publishing is configured so future publishes require no npm token
**Plans**: TBD

Plans:
- [ ] 07-01: TBD
- [ ] 07-02: TBD

### Phase 8: ClawHub Distribution and E2E Verification
**Goal**: OraClaw skills are live on ClawHub with USDC pricing and the full billing pipeline is verified end-to-end
**Depends on**: Phase 5, Phase 7
**Requirements**: DIST-03, INFRA-03
**Success Criteria** (what must be TRUE):
  1. All 14 ClawHub skills are published with USDC pricing ($0.01-$0.15/call) and discoverable in the ClawHub marketplace
  2. The full free-tier flow works: unauthenticated call -> algorithm result -> no charge
  3. The full paid-tier flow works: API key call -> algorithm result -> Stripe meter event -> appears on invoice
  4. The full x402 flow works: USDC payment header -> algorithm result -> settlement confirmation
**Plans**: TBD

Plans:
- [ ] 08-01: TBD
- [ ] 08-02: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8
Note: Phases 4, 5, and 7 depend only on Phase 1 and can execute in parallel after Phase 1 completes.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Auth and Access Control | 2/2 | Complete | 2026-03-29 |
| 2. Stripe Billing Setup | 2/2 | Complete | 2026-03-29 |
| 3. Billing Tiers and Portal | 2/2 | Complete | 2026-03-29 |
| 4. Developer Experience | 0/2 | Not started | - |
| 5. x402 Machine Payments | 0/2 | Not started | - |
| 6. Batch Endpoint | 0/1 | Not started | - |
| 7. npm and MCP Distribution | 0/2 | Not started | - |
| 8. ClawHub Distribution and E2E Verification | 0/2 | Not started | - |
