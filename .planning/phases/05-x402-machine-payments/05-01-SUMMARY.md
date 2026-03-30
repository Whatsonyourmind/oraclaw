---
phase: 05-x402-machine-payments
plan: 01
subsystem: payments
tags: [x402, usdc, blockchain, fastify-hooks, machine-payments, base-chain]

# Dependency graph
requires:
  - phase: 04-dx
    provides: sendProblem helper and ProblemTypes registry for RFC 9457 error responses
  - phase: 01-auth
    provides: FastifyRequest type augmentation and billingPath pattern
provides:
  - createX402PaymentHook preHandler factory for x402 USDC payment verification
  - createX402SettleHook onResponse factory for fire-and-forget settlement
  - PAYMENT_REQUIRED error type in ProblemTypes registry
  - billingPath extended to 'stripe' | 'free' | 'x402'
  - mock-x402.ts factory for testing x402 hooks
affects: [05-02-integration, billing, auth]

# Tech tracking
tech-stack:
  added: ["@x402/core@2.8.0", "@x402/evm@2.8.0"]
  patterns: [x402-hook-factory, fire-and-forget-settlement, loose-x402-server-interface]

key-files:
  created:
    - mission-control/apps/api/src/hooks/x402-payment.ts
    - mission-control/apps/api/src/hooks/x402-settle.ts
    - mission-control/apps/api/src/test-utils/mock-x402.ts
    - mission-control/apps/api/src/hooks/x402-payment.test.ts
  modified:
    - mission-control/apps/api/package.json
    - mission-control/apps/api/src/middleware/auth.ts
    - mission-control/apps/api/src/utils/problem-details.ts

key-decisions:
  - "Loose X402Server interface instead of importing @x402/core types directly for decoupling"
  - "Manual base64 JSON decode instead of @x402/core decodePaymentSignatureHeader to avoid import path uncertainty"
  - "Check both payment-signature and x-payment headers for v1/v2 compatibility"

patterns-established:
  - "x402 hook factory pattern: createX402PaymentHook(server, wallet, price, network) mirrors createMeterUsageHook(stripe, eventName)"
  - "Fire-and-forget settlement in onResponse matching meter-usage.ts pattern"
  - "Loose interface typing for injected server (X402Server) avoids tight coupling to @x402/core internals"

requirements-completed: [INFRA-02, BILL-04]

# Metrics
duration: 4min
completed: 2026-03-30
---

# Phase 5 Plan 1: x402 Payment Hooks Summary

**x402 USDC payment preHandler hook with RFC 9457 error responses and fire-and-forget onResponse settlement**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-30T09:02:09Z
- **Completed:** 2026-03-30T09:06:30Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Installed @x402/core@2.8.0 and @x402/evm@2.8.0 with full subpath exports verified
- Created x402 payment preHandler hook that validates PAYMENT-SIGNATURE/X-PAYMENT headers and returns 402 with payment requirements on failure
- Created x402 settlement onResponse hook with fire-and-forget pattern matching meter-usage.ts
- Extended billingPath union type to include 'x402' and added x402Payment property to FastifyRequest
- Added PAYMENT_REQUIRED to ProblemTypes registry (now 13 error types)
- All 8 new tests pass, full suite of 1029 tests green with zero regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Install x402 packages, extend types, add mock factory and RED test stubs** - `e0db2c5` (test)
2. **Task 2: Implement x402 payment hook and settlement hook (GREEN phase)** - `a9656d9` (feat)

_TDD workflow: Task 1 is RED phase (failing tests), Task 2 is GREEN phase (passing implementation)_

## Files Created/Modified
- `src/hooks/x402-payment.ts` - x402 preHandler hook factory: validates payment headers, verifies via injected server, sets billingPath='x402'
- `src/hooks/x402-settle.ts` - x402 onResponse settlement hook factory: fire-and-forget settlement on 2xx responses
- `src/test-utils/mock-x402.ts` - Mock x402 server factory with verifyPayment, settlePayment, buildPaymentRequirements stubs
- `src/hooks/x402-payment.test.ts` - 8 unit tests covering payment verification, passthrough, 402 errors, and settlement behavior
- `src/middleware/auth.ts` - Extended billingPath union to include 'x402', added x402Payment property
- `src/utils/problem-details.ts` - Added PAYMENT_REQUIRED to ProblemTypes registry
- `apps/api/package.json` - Added @x402/core@2.8.0 and @x402/evm@2.8.0 dependencies

## Decisions Made
- Used a loose `X402Server` interface instead of importing @x402/core types directly. This avoids tight coupling to @x402/core internal type paths (which have multiple subpath exports: `/server`, `/http`, `/client`) and makes the hooks testable with simple mock objects.
- Used manual `Buffer.from(header, 'base64').toString()` + `JSON.parse()` instead of `decodePaymentSignatureHeader` from @x402/core. The decode utility has uncertain import paths (`@x402/core`, `@x402/core/http`, or `@x402/core/server`). Manual decode is simpler and sufficient for our needs.
- Checking both `payment-signature` and `x-payment` headers for v1/v2 protocol compatibility, matching the official @x402/fastify adapter behavior.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required. The hooks receive the x402 server as a parameter; Plan 02 will handle server initialization and env var configuration.

## Next Phase Readiness
- Payment and settlement hooks are ready for Plan 02 to wire into the Fastify server
- Plan 02 will: create x402ResourceServer instance, register hooks in correct order (before Unkey auth), configure env vars
- The mock-x402.ts factory is ready for integration tests in Plan 02

## Self-Check: PASSED

All 5 created/modified files verified on disk. Both task commits (e0db2c5, a9656d9) verified in git log. 8/8 tests passing. 1029/1029 full suite tests passing.

---
*Phase: 05-x402-machine-payments*
*Completed: 2026-03-30*
