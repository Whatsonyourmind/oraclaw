---
phase: 03-billing-tiers-and-portal
plan: 01
subsystem: billing
tags: [fastify, rate-limit, stripe, tiers, billing, ip-rate-limit, rfc-9457]

# Dependency graph
requires:
  - phase: 01-auth-and-access-control
    provides: "Unkey auth middleware with request.headers.authorization for skip logic"
  - phase: 02-stripe-billing-setup
    provides: "Stripe SDK singleton and meter usage hook pattern"
provides:
  - "@fastify/rate-limit free-tier enforcement (100/day by IP)"
  - "TIER_CONFIG single source of truth for all 5 tiers with Stripe price IDs"
  - "registerFreeTierRateLimit() Fastify plugin registration"
  - "TierConfig TypeScript interface for tier metadata"
affects: [03-02-subscription-routes, billing-portal, usage-dashboard]

# Tech tracking
tech-stack:
  added: ["@fastify/rate-limit v10.3.0"]
  patterns: ["allowList function for authenticated request bypass", "RFC 9457 problem detail error responses", "env-sourced Stripe price IDs in tier config"]

key-files:
  created:
    - "mission-control/apps/api/src/hooks/free-tier-rate-limit.ts"
    - "mission-control/apps/api/src/hooks/free-tier-rate-limit.test.ts"
    - "mission-control/apps/api/src/services/billing/tiers.ts"
    - "mission-control/apps/api/src/services/billing/tiers.test.ts"
  modified:
    - "mission-control/apps/api/package.json"
    - "mission-control/apps/api/src/index.ts"

key-decisions:
  - "Used allowList (not skip) for @fastify/rate-limit v10 -- skip is not a valid option"
  - "Tier config reads Stripe price IDs from env vars for test/staging/prod portability"
  - "Rate limiter registered after swagger but before Unkey preHandler hook"

patterns-established:
  - "allowList function pattern: bypass rate limiting based on request.headers.authorization presence"
  - "RFC 9457 error response pattern: type/title/status/detail/retry-after fields"
  - "Tier config as module-level constant with env var resolution at import time"

requirements-completed: [BILL-02, BILL-03]

# Metrics
duration: 5min
completed: 2026-03-29
---

# Phase 03 Plan 01: Free-Tier Rate Limiting and Tier Configuration Summary

**IP-based 100/day rate limiter with @fastify/rate-limit and 5-tier config (free/starter/growth/scale/enterprise) as single source of truth for Stripe billing**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-29T21:25:26Z
- **Completed:** 2026-03-29T21:31:08Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Free-tier IP rate limiting: 100 calls/day, 429 + RFC 9457 on exceed, authenticated callers bypass
- TIER_CONFIG with all 5 tiers including Stripe price IDs from env vars, daily limits, and per-call costs
- 19 new tests covering BILL-02a/b/c and BILL-03a, full suite at 1034 tests (zero regressions)
- Wired into Fastify server before Unkey auth preHandler for correct hook ordering

## Task Commits

Each task was committed atomically:

1. **Task 1: Install @fastify/rate-limit, create free-tier rate limiter and tier config with tests** - `d047e3c` (feat, TDD)
2. **Task 2: Wire free-tier rate limiter into Fastify server** - `208a520` (feat)

## Files Created/Modified
- `mission-control/apps/api/src/hooks/free-tier-rate-limit.ts` - Fastify plugin: 100/day IP rate limit with allowList bypass for auth'd requests
- `mission-control/apps/api/src/hooks/free-tier-rate-limit.test.ts` - 4 tests: 200 + headers, 429 RFC 9457, auth bypass, no leak
- `mission-control/apps/api/src/services/billing/tiers.ts` - TIER_CONFIG with 5 tiers, TierConfig interface
- `mission-control/apps/api/src/services/billing/tiers.test.ts` - 15 tests: all tiers, fields, limits, env var price IDs
- `mission-control/apps/api/package.json` - Added @fastify/rate-limit v10.3.0
- `mission-control/apps/api/src/index.ts` - Import and register free-tier rate limiter

## Decisions Made
- **Used `allowList` instead of `skip`:** @fastify/rate-limit v10 does not have a `skip` option. The `allowList` function serves the same purpose -- returns true to bypass rate limiting for authenticated requests.
- **Env-sourced Stripe price IDs:** Tier config reads `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_GROWTH`, `STRIPE_PRICE_SCALE`, `STRIPE_PRICE_ENTERPRISE` from process.env, defaulting to empty string. This allows the same code to work across test, staging, and production.
- **Plugin registration ordering:** Rate limiter registered after cors/multipart/swagger but before the Unkey auth preHandler, ensuring the onRequest hook fires at the correct point.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Changed `skip` to `allowList` in @fastify/rate-limit config**
- **Found during:** Task 1 (TDD GREEN phase)
- **Issue:** Plan specified `skip` option for @fastify/rate-limit, but v10 uses `allowList` instead. The `skip` option does not exist in the plugin's API.
- **Fix:** Replaced `skip: (request) => !!request.headers.authorization` with `allowList: (request) => !!request.headers.authorization`
- **Files modified:** `mission-control/apps/api/src/hooks/free-tier-rate-limit.ts`
- **Verification:** All 4 rate limit tests pass including authenticated bypass (150 requests at 200)
- **Committed in:** `d047e3c` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary API correction. Identical behavior, different property name. No scope creep.

## Issues Encountered
None beyond the deviation noted above.

## User Setup Required
None - no external service configuration required. Stripe price ID env vars are optional (default to empty string for testing).

## Next Phase Readiness
- TIER_CONFIG is exported and ready for Plan 02 (subscription routes) to consume
- Free-tier rate limiting is active on all routes
- Authenticated callers bypass free-tier limit; Unkey handles their per-key rate limits
- Full test suite green at 1034 tests

## Self-Check: PASSED

All 5 created/modified source files verified on disk. Both task commits (d047e3c, 208a520) verified in git log.

---
*Phase: 03-billing-tiers-and-portal*
*Completed: 2026-03-29*
