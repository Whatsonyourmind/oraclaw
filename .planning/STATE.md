---
gsd_state_version: 1.0
milestone: v21.0
milestone_name: milestone
status: complete
stopped_at: Completed 08-03-PLAN.md
last_updated: "2026-03-30T18:00:00Z"
last_activity: 2026-03-30 -- Completed 08-03-PLAN.md (Demo Script + .env.example)
progress:
  total_phases: 8
  completed_phases: 8
  total_plans: 17
  completed_plans: 17
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-29)

**Core value:** Developers and AI agents can call production-grade decision algorithms via API and pay per use
**Current focus:** v21.0 milestone COMPLETE (8/8 phases, 17/17 plans)

## Current Position

Phase: 8 of 8 (ClawHub Distribution + E2E Verification)
Plan: 3 of 3 in current phase (COMPLETE)
Status: All 17 plans complete across 8 phases
Last activity: 2026-03-30 -- Completed 08-03-PLAN.md (Demo Script + .env.example)

Progress: [██████████] 100%

## Performance Metrics

**Velocity:**
- Total plans completed: 17
- Average duration: 3.8 min
- Total execution time: ~1.1 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-auth | 2 | 15 min | 7.5 min |
| 02-stripe | 2 | 12 min | 6 min |
| 03-billing | 2 | 9 min | 4.5 min |
| 04-dx | 1 | 4 min | 4 min |
| 05-x402 | 2 | 8 min | 4 min |
| 06-batch | 2 | 7 min | 3.5 min |
| 07-npm-dist | 2 | 7 min | 3.5 min |
| 08-clawhub-e2e | 3 | 9 min | 3 min |

**Recent Trend:**
- Last 5 plans: 07-01 (4 min), 07-02 (3 min), 08-01 (4 min), 08-02 (3 min), 08-03 (2 min)
- Trend: Stable / improving

*Updated after each plan completion*
| Phase 05-x402 P01 | 4min | 2 tasks | 7 files |
| Phase 05-x402 P02 | 4min | 2 tasks | 2 files |
| Phase 06-batch P01 | 5min | 2 tasks | 3 files |
| Phase 06-batch P02 | 2min | 1 tasks | 2 files |
| Phase 07-npm-dist P01 | 4min | 2 tasks | 31 files |
| Phase 07-npm-dist P02 | 3min | 1 tasks | 3 files |
| Phase 08-clawhub-e2e P01 | 4min | 1 tasks | 17 files |
| Phase 08-clawhub-e2e P02 | 3min | 1 tasks | 1 files |
| Phase 08-clawhub-e2e P03 | 2min | 1 tasks | 2 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Auth must come first because billing, rate limiting, and usage tracking all depend on customer identity
- Stripe metered billing split from tier enforcement (Phases 2 and 3) because SDK upgrade + metering is distinct from business logic
- x402 is independent payment path (Phase 5), not gated behind Stripe completion
- Batch endpoint (Phase 6) is its own phase due to discount metering complexity
- Unkey SDK v2.3.2 throws on errors (try/catch), not { data, error } pattern
- Rate limit headers set in both preHandler and onSend to cover all response paths
- Free tier (no auth header) skips Unkey entirely to preserve quota
- vi.hoisted() required for module-level mock declarations used by hoisted vi.mock()
- Class-based mock constructor for Unkey SDK in vitest (vi.fn().mockImplementation not constructable in v4)
- Stripe SDK v21 dahlia has 6 breaking type changes from v15 (2023-10-16): coupon->discounts, retrieveUpcoming->createPreview, current_period_start/end removed, invoice.subscription->parent.subscription_details
- Pinned stripe@21.0.1 exact (no caret) for reproducible builds
- mock-stripe.ts follows mock-unkey.ts factory pattern: returns { client, meterEventsCreate }
- Fire-and-forget meter events: .catch() logs errors but never blocks API response
- Hook factory pattern (createXHook) for testability with injected Stripe client
- Meter event identifier: request.id + Date.now() for idempotency
- @fastify/rate-limit v10 uses allowList (not skip) to bypass rate limiting for authenticated requests
- Tier config (TIER_CONFIG) reads Stripe price IDs from env vars for test/staging/prod portability
- Free-tier rate limiter registered after swagger but before Unkey preHandler hook for correct ordering
- Raw stripe client for billingPortal.sessions.create (StripeService does not expose portal methods)
- Enterprise tier rejected at subscribe endpoint with 400 (contact sales, not self-service Checkout)
- NON_SUBSCRIBABLE_TIERS Set for O(1) exclusion of free and enterprise from subscription flow
- sendProblem helper returns FastifyReply for chaining; sets application/problem+json content-type
- ProblemTypes registry has 12 error URIs under https://oraclaw.dev/errors/ namespace
- 500 errors hide internal details with generic message for security
- llms.txt content is a const string literal (no dynamic generation needed)
- [Phase 05-x402]: Loose X402Server interface instead of importing @x402/core types for hook decoupling
- [Phase 05-x402]: Manual base64 JSON decode for payment headers instead of @x402/core utility (import path uncertainty)
- [Phase 05-x402]: Check both payment-signature and x-payment headers for v1/v2 x402 protocol compatibility
- [Phase 05-x402]: x402 preHandler registered BEFORE Unkey auth; Unkey guarded by !request.billingPath
- [Phase 05-x402]: Lazy x402ResourceServer init via dynamic import with graceful fallback if packages unavailable
- [Phase 05-x402]: Integration tests mock at service boundary but use real Fastify hook registration for ordering verification

- [Phase 06-batch]: Direct function dispatch via ALGORITHM_DISPATCH lookup table (not app.inject) avoids hook re-execution per batch call
- [Phase 06-batch]: Promise.allSettled for parallel execution; HTTP 200 always returned with per-call inline RFC 9457 errors
- [Phase 06-batch]: isBatchRequest/batchSize on FastifyRequest for downstream metering hooks (Plan 02)
- [Phase 06-batch]: Batch meter hook inline in index.ts; whole-number batchSize value with separate meter event name (api_calls_batch)

- [Phase 07-npm-dist]: tsconfig include/exclude must be overridden locally in per-package tsconfig.json (extended paths resolve relative to parent)
- [Phase 07-npm-dist]: MCP server build: tsc + conditional shebang injection; tsx peerDependency removed after JS compilation
- [Phase 07-npm-dist]: 5 published SDKs bumped to 1.1.0 (format changed from raw TS to compiled JS); 9 unpublished + MCP at 1.0.0

- [Phase 08-clawhub-e2e]: ClawHub skill package.json includes clawhub field with price, currency, endpoint, method
- [Phase 08-clawhub-e2e]: Publish script uses clawhub info for skip detection, 3 retries per skill
- [Phase 08-clawhub-e2e]: E2E tests cover all 3 billing paths (free, stripe, x402) + batch with mock injection
- [Phase 08-clawhub-e2e]: Forecast endpoint needs 12+ data points with holt-winters method for reliable results

### Pending Todos

None.

### Blockers/Concerns

- npm token expired (E401) -- browser login required for npm publish
- ClawHub CLI not authenticated -- browser login required for clawhub publish
- x402 V2 is new -- monitor @x402/core for breaking changes
- Stripe machine payments preview access may need Dashboard verification

## Session Continuity

Last session: 2026-03-30T18:00:00Z
Stopped at: v21.0 milestone COMPLETE (17/17 plans, 8/8 phases)
Resume file: Run /gsd:complete-milestone to archive, or /gsd:new-milestone for v22.0
