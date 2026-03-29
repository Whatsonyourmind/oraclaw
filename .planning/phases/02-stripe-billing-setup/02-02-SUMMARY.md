---
phase: 02-stripe-billing-setup
plan: 02
subsystem: payments
tags: [stripe, billing, metering, fastify-hooks, tdd, onResponse]

# Dependency graph
requires:
  - phase: 02-stripe-billing-setup
    plan: 01
    provides: Stripe SDK v21.0.1 with dahlia API, mock-stripe.ts factory
  - phase: 01-auth-and-access-control
    provides: Unkey auth middleware (billingPath, stripeCustomerId on request)
provides:
  - "createMeterUsageHook factory for Stripe Billing Meter onResponse events"
  - "Fire-and-forget meter event emission on every authenticated /api/v1/* request"
  - "BILL-01 complete: per-call usage metering for pay-per-use revenue model"
affects: [03-billing-tiers, 06-batch-endpoint, 08-e2e-verification]

# Tech tracking
tech-stack:
  added: []
  patterns: [fastify-onResponse-hook-factory, fire-and-forget-billing, tdd-red-green]

key-files:
  created:
    - mission-control/apps/api/src/hooks/meter-usage.ts
    - mission-control/apps/api/src/hooks/meter-usage.test.ts
  modified:
    - mission-control/apps/api/src/index.ts

key-decisions:
  - "Fire-and-forget pattern: meter event .catch() logs errors but never blocks the API response"
  - "Hook scoped to /api/v1/* routes via URL prefix check in onResponse registration (matches preHandler auth pattern)"
  - "Identifier uses request.id + Date.now() for idempotency"

patterns-established:
  - "Hook factory pattern: createXHook(deps, config) returns async (request, reply) => void for testability"
  - "Fire-and-forget billing: never await external billing calls in hot path, use .catch() for error logging"

requirements-completed: [BILL-01]

# Metrics
duration: 3min
completed: 2026-03-29
---

# Phase 2 Plan 02: Stripe Billing Meter Usage Hook Summary

**TDD-driven onResponse hook emitting Stripe Billing Meter events for every authenticated API call, with 7 tests covering all metering conditions**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-29T20:52:51Z
- **Completed:** 2026-03-29T20:55:40Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- TDD RED: 7 failing tests covering BILL-01a through BILL-01e (authenticated metering, free tier skip, missing customerId skip, 4xx/5xx skip, error logging)
- TDD GREEN: createMeterUsageHook factory with fire-and-forget Stripe billing.meterEvents.create()
- Wired onResponse hook into Fastify server for /api/v1/* routes
- Full regression: 974 tests pass across 27 files, tsc --noEmit clean

## Task Commits

Each task was committed atomically:

1. **Task 1: RED -- Write failing tests for meter usage hook** - `255ec03` (test)
2. **Task 2: GREEN -- Implement meter usage hook and wire into server** - `c0b43d3` (feat)

## Files Created/Modified
- `mission-control/apps/api/src/hooks/meter-usage.ts` - Factory function creating async onResponse hook for Stripe meter events
- `mission-control/apps/api/src/hooks/meter-usage.test.ts` - 7 unit tests covering all metering conditions (BILL-01a-e)
- `mission-control/apps/api/src/index.ts` - Added imports and onResponse hook registration for /api/v1/* routes

## Decisions Made
- **Fire-and-forget pattern:** Meter event emission uses `.catch()` instead of try/catch with await, ensuring the billing call never blocks the API response. The hook is still async so Fastify can track its lifecycle.
- **Hook scoped to /api/v1/*:** Matches the existing preHandler auth pattern -- only public API routes are metered, not internal health checks or oracle routes.
- **Idempotency identifier:** Uses `${request.id}-${Date.now()}` to generate unique identifiers per meter event, preventing duplicate billing on retries.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required

**External services require manual configuration.** From Plan 01 (02-01-SUMMARY.md):
- `STRIPE_SECRET_KEY` - From Stripe Dashboard > Developers > API keys
- `STRIPE_WEBHOOK_SECRET` - From Stripe Dashboard > Developers > Webhooks
- `STRIPE_METER_EVENT_NAME` - Default: `api_calls` (create meter in Stripe Dashboard > Billing > Meters)

## Next Phase Readiness
- BILL-01 complete: every authenticated API call with billingPath='stripe' emits a Stripe Billing Meter event
- Phase 2 fully complete: Stripe SDK installed, apiVersion upgraded, meter usage hook wired
- Ready for Phase 3 (billing tiers) which will use the metered data for tier enforcement
- 974 tests passing, zero type errors

## Self-Check: PASSED

- [x] meter-usage.ts exists
- [x] meter-usage.test.ts exists
- [x] 02-02-SUMMARY.md exists
- [x] Commit 255ec03 (RED) exists
- [x] Commit c0b43d3 (GREEN) exists

---
*Phase: 02-stripe-billing-setup*
*Completed: 2026-03-29*
