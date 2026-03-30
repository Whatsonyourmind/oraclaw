# Requirements: OraClaw Platform

**Defined:** 2026-03-29
**Core Value:** Developers and AI agents can call production-grade decision algorithms via API and pay per use

## v21.0 Requirements (COMPLETED)

### Authentication

- [x] **AUTH-01**: API consumers can create and manage API keys via Unkey
- [x] **AUTH-02**: API keys can be rotated and revoked without downtime
- [x] **AUTH-03**: Rate limits enforced per tier via Unkey (not in-memory), replacing prefix-based auth
- [x] **AUTH-04**: Every API response includes rate limit headers (X-RateLimit-Remaining, X-RateLimit-Limit, X-RateLimit-Reset)

### Billing

- [x] **BILL-01**: API calls are metered via Stripe Billing Meters API (upgrade from removed legacy usage_records)
- [x] **BILL-02**: Free tier allows 100 calls/day without API key
- [x] **BILL-03**: Paid tiers (starter/growth/scale/enterprise) billed per call via Stripe metered subscription
- [x] **BILL-04**: AI agents can pay per call via x402 USDC machine payments (native Fastify preHandler)
- [x] **BILL-05**: Users can view usage and invoices via Stripe customer portal

### Developer Experience

- [ ] **DX-01**: OpenAPI 3.1 spec generated from routes with Scalar interactive playground (carried to v22.0 Phase 1)
- [x] **DX-02**: All error responses follow RFC 9457 problem details format
- [x] **DX-03**: llms.txt file served at /llms.txt for AI assistant discovery
- [x] **DX-04**: Batch endpoint accepts multiple algorithm calls in one request at 50% discount

### Distribution

- [x] **DIST-01**: All 14 npm SDK packages published to @oraclaw scope (10 remaining)
- [x] **DIST-02**: @oraclaw/mcp-server published to npm
- [x] **DIST-03**: 14 ClawHub skills published with USDC pricing
- [ ] **DIST-04**: npm Trusted Publishing configured via GitHub Actions OIDC (carried to v22.0)

### Infrastructure

- [x] **INFRA-01**: Stripe SDK v21.0.1 installed and apiVersion upgraded to 2026-03-25.dahlia
- [x] **INFRA-02**: x402 packages installed (@x402/core, @x402/evm) with native Fastify hook
- [x] **INFRA-03**: End-to-end billing verification (free -> paid -> metered -> invoice -> x402)

---

## v22.0 Requirements (ACTIVE)

### Web Dashboard

- [ ] **WEB-01**: Public Next.js site with algorithm catalog showing all 19 algorithms with descriptions, input/output schemas, and pricing
- [ ] **WEB-02**: Interactive try-it forms for each algorithm with pre-filled example inputs and live API results
- [ ] **WEB-03**: Getting-started guide: API key creation -> first call -> result, completable in under 2 minutes

### Observability

- [ ] **OBS-01**: Structured JSON logging with request ID correlation across full request lifecycle
- [ ] **OBS-02**: Prometheus metrics for request rate, latency percentiles (p50/p95/p99), error rate, and per-algorithm timings
- [ ] **OBS-03**: Grafana dashboards for real-time API health, billing pipeline status, and algorithm performance
- [ ] **OBS-04**: Alerting for error rate spikes (>5% 5xx), latency degradation (p99 >500ms), and billing pipeline failures

### Performance

- [ ] **PERF-01**: Response caching with ETag/conditional GET for repeated algorithm calls with identical inputs
- [ ] **PERF-02**: Request payload validation rejects malformed inputs before reaching algorithm layer
- [ ] **PERF-03**: Circuit breaker pattern for downstream services (Stripe, Unkey) with graceful degradation
- [ ] **PERF-04**: Load test baseline showing <100ms p99 latency at 100 concurrent requests

### Algorithms

- [ ] **ALG-01**: 3-5 new SOTA algorithms (MCTS, PSO, Neural Architecture Search, Causal Inference, Conformal Prediction)
- [ ] **ALG-02**: Algorithm versioning system (v1, v2, latest) with backward compatibility
- [ ] **ALG-03**: Algorithm registry endpoint returning metadata (input schema, output schema, complexity, pricing)

### Growth (carried from v21.0 v2 requirements)

- [ ] **GROW-01**: Usage analytics endpoint with per-algorithm call counts, latency percentiles, and cost
- [ ] **GROW-02**: Webhook notifications for quota alerts (80%, 100%) and billing events
- [ ] **GROW-03**: Self-service API key management portal (embedded in web dashboard)
- [ ] **GROW-04**: SDK code examples in Python, JavaScript, Go, Rust, and curl

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DX-01 | v22.0 Phase 1 | Carried |
| DIST-04 | v22.0 Phase 1 | Carried |
| WEB-01 | v22.0 Phase 1 | Pending |
| WEB-02 | v22.0 Phase 1 | Pending |
| WEB-03 | v22.0 Phase 1 | Pending |
| OBS-01 | v22.0 Phase 2 | Pending |
| OBS-02 | v22.0 Phase 2 | Pending |
| OBS-03 | v22.0 Phase 2 | Pending |
| OBS-04 | v22.0 Phase 2 | Pending |
| PERF-01 | v22.0 Phase 3 | Pending |
| PERF-02 | v22.0 Phase 3 | Pending |
| PERF-03 | v22.0 Phase 3 | Pending |
| PERF-04 | v22.0 Phase 3 | Pending |
| ALG-01 | v22.0 Phase 4 | Pending |
| ALG-02 | v22.0 Phase 4 | Pending |
| ALG-03 | v22.0 Phase 4 | Pending |
| GROW-01 | v22.0 Phase 5 | Pending |
| GROW-02 | v22.0 Phase 5 | Pending |
| GROW-03 | v22.0 Phase 5 | Pending |
| GROW-04 | v22.0 Phase 5 | Pending |

**Coverage:**
- v21.0 requirements: 19 total (17 complete, 2 carried)
- v22.0 requirements: 18 total
- Mapped to phases: 18
- Unmapped: 0

---
*Requirements defined: 2026-03-29*
*v22.0 requirements added: 2026-03-30*
