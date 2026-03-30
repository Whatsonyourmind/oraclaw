---
phase: 05-x402-machine-payments
plan: 02
subsystem: payments
tags: [x402, usdc, fastify-hooks, machine-payments, hook-ordering, billing-paths]

# Dependency graph
requires:
  - phase: 05-x402-machine-payments
    plan: 01
    provides: createX402PaymentHook, createX402SettleHook, mock-x402.ts factory, billingPath='x402' type
  - phase: 01-auth
    provides: createAuthMiddleware, billingPath pattern, mock-unkey.ts factory
  - phase: 02-stripe
    provides: createMeterUsageHook, mock-stripe.ts factory
provides:
  - x402 hooks wired into Fastify server with correct preHandler ordering
  - Unkey auth skip when billingPath already set by x402
  - x402 settlement onResponse hook registered after Stripe meter
  - Lazy x402ResourceServer initialization in start() function
  - Integration tests proving three billing paths (free, stripe, x402) coexist
affects: [06-batch-endpoint, mcp-server, sdk-packages]

# Tech tracking
tech-stack:
  added: []
  patterns: [x402-hook-ordering-before-auth, billingPath-guard-skip, lazy-x402-init, three-path-integration-test]

key-files:
  created: []
  modified:
    - mission-control/apps/api/src/index.ts
    - mission-control/apps/api/src/hooks/x402-payment.test.ts

key-decisions:
  - "x402 preHandler registered BEFORE Unkey auth preHandler for correct hook ordering"
  - "Unkey auth guarded by !request.billingPath to skip when x402 already set"
  - "Lazy x402Server init via dynamic import with graceful fallback if packages unavailable"
  - "Integration tests mock at service boundary (x402/Unkey/Stripe) but use real Fastify hook registration"

patterns-established:
  - "Hook ordering: rate-limit -> x402 payment -> Unkey auth -> rate-limit headers -> Stripe meter -> x402 settle"
  - "billingPath guard pattern: downstream hooks check billingPath before executing to avoid double-processing"
  - "Three-path integration test pattern: test all billing paths in same Fastify instance with mock services"

requirements-completed: [BILL-04, INFRA-02]

# Metrics
duration: 4min
completed: 2026-03-30
---

# Phase 5 Plan 2: x402 Hook Integration Summary

**x402 payment hooks wired into Fastify server with correct preHandler ordering, Unkey auth skip, and integration tests proving three billing paths coexist**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-30T09:09:22Z
- **Completed:** 2026-03-30T09:14:02Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Wired x402 payment preHandler hook BEFORE Unkey auth preHandler in index.ts with documented hook ordering
- Modified Unkey auth to skip when billingPath already set by x402 payment hook (no verifyKey call)
- Added x402 settlement onResponse hook and lazy initX402() in start() function
- 4 new integration tests prove all three billing paths (free, stripe, x402) coexist without cross-contamination
- Full test suite: 1033 tests passing with zero regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire x402 hooks into index.ts with correct ordering** - `75574bb` (feat)
2. **Task 2: Add integration tests for three billing paths coexistence** - `0330716` (test)

## Files Created/Modified
- `src/index.ts` - x402 hook imports, initX402() lazy init, preHandler before Unkey, settlement onResponse, hook ordering comment
- `src/hooks/x402-payment.test.ts` - 4 new integration tests: x402 bypasses auth, free tier works, Stripe works, three paths sequential

## Decisions Made
- x402 preHandler registered BEFORE Unkey auth preHandler. The Unkey hook now checks `!request.billingPath` and skips if x402 already set it. This means x402-paid requests never touch the Unkey API.
- Lazy initialization pattern for x402ResourceServer: dynamic imports in initX402() with try/catch so the server starts even if x402 packages are missing or facilitator is unreachable.
- Integration tests mock at service boundary (x402 server, Unkey client, Stripe client) but use real Fastify hook registration to verify ordering. This catches wiring bugs that unit tests cannot.
- Environment variables (RECEIVING_WALLET_ADDRESS, X402_PRICE_PER_CALL, X402_NETWORK) read once at module level for efficiency.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required. The x402 hooks use environment variables that are optional (server starts without them, x402 is just disabled).

## Next Phase Readiness
- Phase 5 (x402 Machine Payments) is now complete: both hooks (Plan 01) and integration (Plan 02) done
- AI agents can call any /api/v1/* endpoint with PAYMENT-SIGNATURE header and pay with USDC
- Three billing paths (free, stripe, x402) coexist without interference
- Ready for Phase 6 (Batch Endpoint) which may need to consider x402 billing for batch requests

## Self-Check: PASSED

All 2 modified files verified on disk. Both task commits (75574bb, 0330716) verified in git log. 12/12 x402 tests passing. 1033/1033 full suite tests passing.

---
*Phase: 05-x402-machine-payments*
*Completed: 2026-03-30*
