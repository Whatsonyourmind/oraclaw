---
phase: 06-batch-endpoint
plan: 01
subsystem: api
tags: [fastify, batch, promise-allsettled, rfc-9457, dispatch-map]

# Dependency graph
requires:
  - phase: 04-dx
    provides: RFC 9457 problem-details utility and ProblemTypes registry
  - phase: 01-auth
    provides: FastifyRequest type augmentation (tier, billingPath, keyId)
provides:
  - POST /api/v1/batch endpoint with parallel algorithm dispatch
  - ALGORITHM_DISPATCH lookup table for all 17 algorithms
  - FastifyRequest.isBatchRequest and FastifyRequest.batchSize fields
affects: [06-batch-endpoint plan 02 (batch metering), 07-npm-publish, 08-clawhub]

# Tech tracking
tech-stack:
  added: []
  patterns: [dispatch-map-pattern, promise-allsettled-partial-failure, inline-rfc9457-errors]

key-files:
  created:
    - mission-control/apps/api/src/routes/oracle/api-batch.ts
    - mission-control/apps/api/src/routes/oracle/api-batch.test.ts
  modified:
    - mission-control/apps/api/src/middleware/auth.ts

key-decisions:
  - "Direct function dispatch via lookup table instead of app.inject() to avoid hook re-execution"
  - "Promise.allSettled for parallel execution with partial-failure handling"
  - "HTTP 200 always returned from batch endpoint; per-call errors inline in RFC 9457 format"
  - "ALGORITHM_DISPATCH exported for testability and potential reuse"

patterns-established:
  - "Dispatch map pattern: Record<string, (params: unknown) => Promise<unknown>> for algorithm routing"
  - "Inline RFC 9457 errors: per-call error objects in results array instead of sendProblem to reply"
  - "Request metadata pattern: isBatchRequest/batchSize set on request for downstream hook awareness"

requirements-completed: [DX-04]

# Metrics
duration: 5min
completed: 2026-03-30
---

# Phase 6 Plan 01: Batch Endpoint Route + Dispatch Map Summary

**POST /api/v1/batch with 17-algorithm dispatch map, Promise.allSettled parallel execution, and 11 TDD tests**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-30T09:57:40Z
- **Completed:** 2026-03-30T10:02:11Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Created batch endpoint accepting array of algorithm calls with ordered results
- Built ALGORITHM_DISPATCH lookup table covering all 17 algorithms from api-public.ts
- Implemented partial failure handling via Promise.allSettled with RFC 9457 inline errors
- Added 11 comprehensive TDD tests covering validation, dispatch, metadata, and request context
- All 1044 tests pass with zero regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Augment FastifyRequest types and create batch route with dispatch map** - `d06f1bd` (feat)
2. **Task 2: TDD tests for batch endpoint** - `806a171` (test)

## Files Created/Modified
- `mission-control/apps/api/src/routes/oracle/api-batch.ts` - Batch route plugin with ALGORITHM_DISPATCH map and POST /api/v1/batch handler
- `mission-control/apps/api/src/routes/oracle/api-batch.test.ts` - 11 unit tests using app.inject() for HTTP-level testing
- `mission-control/apps/api/src/middleware/auth.ts` - Added isBatchRequest and batchSize to FastifyRequest augmentation

## Decisions Made
- Direct function dispatch via ALGORITHM_DISPATCH lookup table (not app.inject) to avoid hook re-execution per-call
- Promise.allSettled used for parallel execution ensuring partial failures don't abort other calls
- HTTP 200 always returned from batch endpoint; per-call errors use inline RFC 9457 format (not sendProblem which writes to reply)
- Unknown algorithms produce a rejected promise with descriptive error message, mapped to error in results array
- Request.isBatchRequest and request.batchSize set after dispatch for downstream metering hooks (Plan 02)
- Tests use real algorithm execution (score/calibration, detect/anomaly) for realistic validation

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Batch route ready for Plan 02 (batch metering and server registration)
- isBatchRequest/batchSize fields on request ready for meter-usage-batch hook
- ALGORITHM_DISPATCH exported for potential reuse in docs/SDK generation
- All 17 algorithms verified working through batch dispatch

## Self-Check: PASSED

All files verified present. All commit hashes verified in git log.

---
*Phase: 06-batch-endpoint*
*Completed: 2026-03-30*
