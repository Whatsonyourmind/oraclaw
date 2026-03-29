# Requirements: OraClaw Revenue-Ready Launch

**Defined:** 2026-03-29
**Core Value:** Developers and AI agents can call production-grade decision algorithms via API and pay per use

## v1 Requirements

### Authentication

- [x] **AUTH-01**: API consumers can create and manage API keys via Unkey
- [x] **AUTH-02**: API keys can be rotated and revoked without downtime
- [x] **AUTH-03**: Rate limits enforced per tier via Unkey (not in-memory), replacing prefix-based auth
- [x] **AUTH-04**: Every API response includes rate limit headers (X-RateLimit-Remaining, X-RateLimit-Limit, X-RateLimit-Reset)

### Billing

- [ ] **BILL-01**: API calls are metered via Stripe Billing Meters API (upgrade from removed legacy usage_records)
- [ ] **BILL-02**: Free tier allows 100 calls/day without API key
- [ ] **BILL-03**: Paid tiers (starter/growth/scale/enterprise) billed per call via Stripe metered subscription
- [ ] **BILL-04**: AI agents can pay per call via x402 USDC machine payments (native Fastify preHandler)
- [ ] **BILL-05**: Users can view usage and invoices via Stripe customer portal

### Developer Experience

- [ ] **DX-01**: OpenAPI 3.1 spec generated from routes with Scalar interactive playground
- [ ] **DX-02**: All error responses follow RFC 9457 problem details format
- [ ] **DX-03**: llms.txt file served at /llms.txt for AI assistant discovery
- [ ] **DX-04**: Batch endpoint accepts multiple algorithm calls in one request at 50% discount

### Distribution

- [ ] **DIST-01**: All 14 npm SDK packages published to @oraclaw scope (10 remaining)
- [ ] **DIST-02**: @oraclaw/mcp-server published to npm
- [ ] **DIST-03**: 14 ClawHub skills published with USDC pricing
- [ ] **DIST-04**: npm Trusted Publishing configured via GitHub Actions OIDC (no more token expiry)

### Infrastructure

- [ ] **INFRA-01**: Stripe SDK v21.0.1 installed and apiVersion upgraded to 2026-03-25.dahlia
- [ ] **INFRA-02**: x402 packages installed (@x402/core, @x402/evm) with native Fastify hook
- [ ] **INFRA-03**: End-to-end billing verification (free -> paid -> metered -> invoice -> x402)

## v2 Requirements

### Growth Features

- **GROW-01**: Usage analytics dashboard (self-service)
- **GROW-02**: Webhook notifications for quota alerts and billing events
- **GROW-03**: Self-service API key management portal
- **GROW-04**: SDK code examples in 5+ languages

### Infrastructure

- **INFRA-04**: Render paid tier upgrade for always-on service
- **INFRA-05**: Redis/Supabase for durable rate limiting and caching
- **INFRA-06**: Stripe + x402 unified revenue dashboard

## Out of Scope

| Feature | Reason |
|---------|--------|
| Admin dashboard / UI | API-first, no frontend for this milestone |
| Custom model training | Ship existing 19 algorithms, no new development |
| GraphQL API | REST is standard for algorithm APIs, GraphQL adds complexity |
| OAuth2 provider | API keys are simpler, Unkey handles the complexity |
| Credit/token system | Per-call metering is simpler and proven |
| Third-party algorithm marketplace | Focus on own algorithms, don't build a platform |
| Outreach and marketing | Separate milestone per user decision |
| Mobile app | API-only for this milestone |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Complete |
| AUTH-02 | Phase 1 | Complete |
| AUTH-03 | Phase 1 | Complete |
| AUTH-04 | Phase 1 | Complete |
| INFRA-01 | Phase 2 | Pending |
| BILL-01 | Phase 2 | Pending |
| BILL-02 | Phase 3 | Pending |
| BILL-03 | Phase 3 | Pending |
| BILL-05 | Phase 3 | Pending |
| DX-01 | Phase 4 | Pending |
| DX-02 | Phase 4 | Pending |
| DX-03 | Phase 4 | Pending |
| BILL-04 | Phase 5 | Pending |
| INFRA-02 | Phase 5 | Pending |
| DX-04 | Phase 6 | Pending |
| DIST-01 | Phase 7 | Pending |
| DIST-02 | Phase 7 | Pending |
| DIST-04 | Phase 7 | Pending |
| DIST-03 | Phase 8 | Pending |
| INFRA-03 | Phase 8 | Pending |

**Coverage:**
- v1 requirements: 19 total
- Mapped to phases: 19
- Unmapped: 0

---
*Requirements defined: 2026-03-29*
*Last updated: 2026-03-28 after roadmap creation (8-phase structure)*
