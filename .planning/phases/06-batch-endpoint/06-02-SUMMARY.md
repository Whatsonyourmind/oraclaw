---
phase: 06-batch-endpoint
plan: 02
subsystem: api
tags: [fastify, stripe, metering, batch, billing, onresponse-hook]

# Dependency graph
requires:
  - phase: 06-batch-endpoint
    provides: Batch route plugin (api-batch.ts) with isBatchRequest/batchSize on FastifyRequest
  - phase: 02-stripe
    provides: Stripe client, createMeterUsageHook factory, mock-stripe test utility
provides:
  - Batch route registered and accessible at POST /api/v1/batch in running server
  - Batch-specific Stripe metering at 50% rate via separate meter event name (api_calls_batch)
  - Double-metering prevention (per-call meter hook skips batch requests)
affects: [07-npm-publish, 08-clawhub]

# Tech tracking
tech-stack:
  added: []
  patterns: [batch-metering-hook-pattern, dual-meter-event-names]

key-files:
  created: []
  modified:
    - mission-control/apps/api/src/index.ts
    - mission-control/apps/api/src/hooks/meter-usage.ts

key-decisions:
  - "Batch meter hook inline in index.ts (consistent with existing per-call meter hook pattern)"
  - "Whole-number batchSize value in meter event; 50% discount achieved via Stripe meter unit pricing, not fractional values"
  - "Separate meter event name (api_calls_batch) for batch vs per-call metering distinction"
  - "isBatchRequest guard added to existing meter hook to prevent double-metering"

patterns-established:
  - "Dual meter event pattern: separate Stripe meter event names for per-call vs batch billing with different unit prices"
  - "Batch skip guard: downstream hooks check isBatchRequest to avoid redundant processing"

requirements-completed: [DX-04]

# Metrics
duration: 2min
completed: 2026-03-30
---

# Phase 6 Plan 02: Batch Metering + Server Wiring Summary

**Batch route wired into Fastify server with dual Stripe metering: per-call hook skips batches, batch hook emits at 50% rate via separate meter event name**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-30T10:04:58Z
- **Completed:** 2026-03-30T10:06:54Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- Registered batch route in Fastify server (POST /api/v1/batch accessible with all auth hooks)
- Added isBatchRequest guard to existing meter-usage.ts to prevent double-metering of batch requests
- Added batch-specific onResponse metering hook in index.ts with separate event name (api_calls_batch)
- All 1044 tests pass including 7 meter-usage tests and 11 batch endpoint tests

## Task Commits

Each task was committed atomically:

1. **Task 1: Update meter-usage.ts to skip batch requests and wire batch route into index.ts** - `6856121` (feat)

## Files Created/Modified
- `mission-control/apps/api/src/index.ts` - Added batchRoute import, server.register(batchRoute), and batch metering onResponse hook
- `mission-control/apps/api/src/hooks/meter-usage.ts` - Added isBatchRequest early-return guard to prevent double-metering

## Decisions Made
- Batch meter hook kept inline in index.ts (not a separate file) to match existing per-call meter hook pattern
- Whole-number value (batchSize) sent to Stripe meter events; 50% discount is a Stripe Dashboard unit pricing concern
- Separate meter event name (STRIPE_BATCH_METER_EVENT_NAME / api_calls_batch) for billing distinction
- Fire-and-forget pattern with .catch() logging consistent with per-call meter hook

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required. The STRIPE_BATCH_METER_EVENT_NAME env var defaults to 'api_calls_batch' and the Stripe meter must be configured in the Dashboard with the 50% unit price.

## Next Phase Readiness
- Batch endpoint fully operational: route registered, auth hooks fire, metering correct
- Phase 6 (Batch Endpoint) complete -- ready for Phase 7 (npm publish)
- npm token expired blocker remains for Phase 7

## Self-Check: PASSED

All files verified present. All commit hashes verified in git log.

---
*Phase: 06-batch-endpoint*
*Completed: 2026-03-30*
