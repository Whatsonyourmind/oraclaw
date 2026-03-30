# Roadmap: OraClaw Platform Maturity

## Overview

OraClaw v21.0 shipped the revenue-ready launch: authentication, dual-path billing (Stripe + x402), SDK distribution, and ClawHub marketplace. v22.0 takes the platform from "ready to earn" to "ready to scale" by adding the web presence, observability, API hardening, and developer growth features needed to support real production traffic and customer acquisition.

## Milestone History

### v21.0 — Revenue-Ready Launch (COMPLETED 2026-03-30)

8 phases, 17 plans, ~1.1 hours. Delivered Unkey auth, Stripe metered billing, x402 USDC payments, batch endpoint, 14 npm SDKs, 14 ClawHub skills, E2E billing verification.

See: `.planning/milestones/v21.0-COMPLETED.md`

---

## v22.0 — Platform Maturity

**Goal:** Make OraClaw production-grade for real traffic: web dashboard for developer onboarding, observability for operations, API hardening for reliability, and growth tooling for adoption.

**Why this order:**
1. Web dashboard comes first because developers need a landing page and interactive playground to discover and try algorithms
2. Observability comes second because you need to see what's happening before you can optimize it
3. API hardening comes third because rate limiting improvements and caching require observability data to tune
4. Advanced algorithms and growth features come last because they drive adoption on top of a stable, observable platform

## Phases

- [x] **Phase 1: Web Dashboard & Documentation Site** - Next.js landing page with Scalar API playground, algorithm catalog, and getting-started guides (completed 2026-03-30)
- [ ] **Phase 2: Observability & Monitoring** - Structured logging, Prometheus metrics, Grafana dashboards, health checks, and alerting
- [ ] **Phase 3: API Hardening & Performance** - Response caching, request validation tightening, graceful degradation, and load testing
- [ ] **Phase 4: Advanced Algorithms & Model Registry** - 3-5 new SOTA algorithms, algorithm versioning, A/B testing framework for algorithm selection
- [ ] **Phase 5: Developer Growth & Analytics** - Usage analytics dashboard, webhook notifications, SDK examples in 5+ languages, changelog feed

## Phase Details

### Phase 1: Web Dashboard & Documentation Site
**Goal**: Developers can discover, try, and integrate OraClaw from a single web destination in under 5 minutes
**Depends on**: Nothing (first phase)
**Requirements**: WEB-01, WEB-02, WEB-03, DX-01 (carried from v21.0)
**Success Criteria** (what must be TRUE):
  1. A public Next.js site at oraclaw.dev (or subdomain) shows algorithm catalog with interactive try-it forms
  2. Scalar API playground is embedded and connected to the live API with pre-filled examples
  3. Getting-started guide walks through: get API key -> make first call -> see result in under 2 minutes
  4. The site is deployed and accessible (Vercel or similar)
**Plans:** 2/2 plans complete

Plans:
- [x] 01-01-PLAN.md -- Next.js scaffold, algorithm catalog (17 algorithms), Scalar playground embed
- [x] 01-02-PLAN.md -- Interactive try-it forms (17 algorithms), getting-started guide, code examples

**Notes:**
- Web app at `web/` (standalone outside monorepo to avoid React 18/19 conflict with mobile app)
- 24 static pages generated (homepage, algorithms, docs, getting-started, 17 try-it pages, not-found)
- Build: 101 kB first load JS shared

### Phase 2: Observability & Monitoring
**Goal**: Operations team can see real-time API health, algorithm performance, billing flow status, and get alerted on anomalies
**Depends on**: Nothing (can run parallel with Phase 1)
**Requirements**: OBS-01, OBS-02, OBS-03, OBS-04
**Success Criteria** (what must be TRUE):
  1. Structured JSON logging with request ID correlation across the full request lifecycle
  2. Prometheus metrics exported for request rate, latency percentiles, error rate, and algorithm-specific timings
  3. Grafana dashboards show real-time API health, billing pipeline status, and algorithm performance
  4. Alerting configured for error rate spikes, latency degradation, and billing pipeline failures
**Plans:** TBD

### Phase 3: API Hardening & Performance
**Goal**: API handles 10x current capacity without degradation, with proper caching, input validation, and graceful error handling
**Depends on**: Phase 2 (needs metrics to tune)
**Requirements**: PERF-01, PERF-02, PERF-03, PERF-04
**Success Criteria** (what must be TRUE):
  1. Response caching (ETag/conditional GET) reduces redundant computation for repeated calls
  2. Request payload validation rejects malformed inputs before reaching algorithm layer
  3. Circuit breaker pattern prevents cascade failures when downstream services (Stripe, Unkey) are down
  4. Load test results show <100ms p99 latency at 100 concurrent requests
**Plans:** TBD

### Phase 4: Advanced Algorithms & Model Registry
**Goal**: Platform offers 24+ algorithms with versioning, so developers can pin algorithm versions and try new ones without breaking existing integrations
**Depends on**: Phase 3 (stable API needed)
**Requirements**: ALG-01, ALG-02, ALG-03
**Success Criteria** (what must be TRUE):
  1. 3-5 new algorithms added: MCTS (Monte Carlo Tree Search), PSO (Particle Swarm), Neural Architecture Search, Causal Inference, or Conformal Prediction
  2. Algorithm versioning system allows callers to specify version (v1, v2) or use latest
  3. Algorithm registry provides metadata (input schema, output schema, complexity, pricing) for each algorithm
**Plans:** TBD

### Phase 5: Developer Growth & Analytics
**Goal**: Developers have self-service tools to monitor their own usage, get notified on quota changes, and integrate faster with code examples
**Depends on**: Phase 2 (needs observability for analytics)
**Requirements**: GROW-01, GROW-02, GROW-03, GROW-04 (carried from v21.0 REQUIREMENTS.md)
**Success Criteria** (what must be TRUE):
  1. Usage analytics endpoint returns per-algorithm call counts, latency percentiles, and cost for the authenticated user
  2. Webhook notifications fire on quota threshold (80%, 100%) and billing events (invoice created, payment failed)
  3. SDK code examples published for Python, JavaScript, Go, Rust, and curl
  4. Changelog RSS/JSON feed auto-generated from git tags or a changelog file
**Plans:** TBD

## Progress

**Execution Order:**
Phases 1 and 2 can execute in parallel. Phase 3 depends on Phase 2. Phase 4 depends on Phase 3. Phase 5 depends on Phase 2.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Web Dashboard & Documentation Site | 2/2 | Complete | 2026-03-30 |
| 2. Observability & Monitoring | 0/? | Not Started | — |
| 3. API Hardening & Performance | 0/? | Not Started | — |
| 4. Advanced Algorithms & Model Registry | 0/? | Not Started | — |
| 5. Developer Growth & Analytics | 0/? | Not Started | — |
