---
phase: 01-auth-and-access-control
plan: 02
subsystem: testing
tags: [unkey, vitest, mocking, auth-tests, rate-limiting, tdd]

# Dependency graph
requires:
  - phase: 01-auth-and-access-control/plan-01
    provides: Auth middleware (createAuthMiddleware, rateLimitHeadersHook) and key management (createApiKey, rotateApiKey, revokeApiKey)
provides:
  - Shared Unkey SDK mock utility (createMockUnkey, preset response factories)
  - Auth middleware test suite (10 tests covering preHandler and onSend)
  - Key management service test suite (12 tests covering CRUD and config)
  - 22 total new tests proving AUTH-01 through AUTH-04
affects: [stripe-billing-tests, x402-tests, api-integration-tests]

# Tech tracking
tech-stack:
  added: []
  patterns: ["vi.hoisted() for module-level mock declarations used by hoisted vi.mock()", "Class-based mock constructor for Unkey SDK (vi.mock with class MockUnkey)", "app.inject() with mock preHandler/onSend for isolated middleware testing"]

key-files:
  created:
    - mission-control/apps/api/src/test-utils/mock-unkey.ts
    - mission-control/apps/api/src/middleware/auth.test.ts
    - mission-control/apps/api/src/services/unkey.test.ts
  modified: []

key-decisions:
  - "Used vi.hoisted() + class-based mock constructor to handle vitest mock hoisting with module-level Unkey singleton"
  - "Mock responses match SDK v2.3.2 actual shape (meta + data, not data + error) consistent with Plan 01 deviation"

patterns-established:
  - "Mock Unkey pattern: createMockUnkey() returns object with keys.verifyKey/createKey/rerollKey/deleteKey as vi.fn()"
  - "Middleware test pattern: minimal Fastify app with addHook() + GET /test route returning request context"
  - "Service mock pattern: vi.hoisted() + vi.mock() with class for module-level singletons"

requirements-completed: [AUTH-01, AUTH-02, AUTH-03, AUTH-04]

# Metrics
duration: 6min
completed: 2026-03-29
---

# Phase 1 Plan 2: Unkey Auth Test Coverage Summary

**22 vitest tests proving Unkey auth middleware (valid/invalid/rate-limited/disabled/expired/SDK-error) and key management (create/rotate/revoke) with shared mock utility**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-29T19:59:22Z
- **Completed:** 2026-03-29T20:06:00Z
- **Tasks:** 2
- **Files created:** 3

## Accomplishments
- Shared Unkey mock utility with 6 preset response factories matching SDK v2.3.2 actual response shapes
- Auth middleware tests covering all verification outcomes: valid (200), NOT_FOUND (401), RATE_LIMITED (429), DISABLED (403), EXPIRED (401), SDK error (503)
- Rate limit header tests verifying X-RateLimit-Remaining/Limit/Reset present on success and 429, absent on free tier
- Key management tests verifying createApiKey (autoApply:true, tier fallback), rotateApiKey (default/custom expiration), revokeApiKey
- Full regression: 967 tests passing (945 existing + 22 new)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create shared Unkey mock utility and auth middleware tests** - `46871ce` (test)
2. **Task 2: Create key management tests and run full regression suite** - `5931cb6` (test)

## Files Created/Modified
- `mission-control/apps/api/src/test-utils/mock-unkey.ts` - Shared mock factory with createMockUnkey(), mockVerifyValid/Invalid/RateLimited/SdkError, mockCreateKeySuccess, mockRerollKeySuccess
- `mission-control/apps/api/src/middleware/auth.test.ts` - 10 tests for preHandler (7 cases) and onSend (3 header cases)
- `mission-control/apps/api/src/services/unkey.test.ts` - 12 tests for TIER_RATE_LIMITS config (2), createApiKey (4), rotateApiKey (4), revokeApiKey (2)

## Decisions Made
- **Used vi.hoisted() for mock declarations:** Vitest hoists vi.mock() above all imports, but the mock factory references mockKeys which is declared later. Using vi.hoisted() ensures mockKeys exists when the hoisted vi.mock() factory executes.
- **Class-based Unkey mock constructor:** vi.fn().mockImplementation() does not work as a constructor with `new` in vitest v4.0.18 (monorepo root). Using `class MockUnkey { keys = mockKeys }` inside vi.mock() properly handles the `new Unkey()` call in unkey.ts.
- **Mock response shapes match SDK v2.3.2:** Responses use `{ meta, data }` (not `{ data, error }`) consistent with the SDK behavior discovered in Plan 01.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed vi.mock hoisting issue with vi.hoisted()**
- **Found during:** Task 2 (key management tests)
- **Issue:** `const mockKeys` declared before `vi.mock()` in source order, but vitest hoists vi.mock() above all declarations, causing "Cannot access 'mockKeys' before initialization" error.
- **Fix:** Changed `const mockKeys = { ... }` to `const mockKeys = vi.hoisted(() => ({ ... }))` which creates the mock in the hoisted scope.
- **Files modified:** mission-control/apps/api/src/services/unkey.test.ts
- **Committed in:** 5931cb6 (Task 2 commit)

**2. [Rule 1 - Bug] Fixed mock constructor for vitest v4.0.18 compatibility**
- **Found during:** Task 2 (full regression suite)
- **Issue:** `vi.fn().mockImplementation(() => ({ keys: mockKeys }))` failed as constructor when tests run via monorepo root (vitest v4.0.18). Error: "not a constructor".
- **Fix:** Replaced with `class MockUnkey { keys = mockKeys }` inside vi.mock() factory.
- **Files modified:** mission-control/apps/api/src/services/unkey.test.ts
- **Committed in:** 5931cb6 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both fixes necessary for tests to run correctly. No scope creep.

## Issues Encountered
None beyond the mock hoisting deviations documented above.

## User Setup Required
None - no external service configuration required (all tests use mocked Unkey SDK).

## Next Phase Readiness
- Auth middleware and key management are fully tested with 22 test cases
- All 4 AUTH requirements (AUTH-01 through AUTH-04) verified by automated tests
- Mock utility is reusable for downstream phases that need to test auth-gated behavior
- Phase 2 (Stripe billing) can build on the auth foundation with confidence

## Self-Check: PASSED

All files verified present on disk:
- mission-control/apps/api/src/test-utils/mock-unkey.ts
- mission-control/apps/api/src/middleware/auth.test.ts
- mission-control/apps/api/src/services/unkey.test.ts
- .planning/phases/01-auth-and-access-control/01-02-SUMMARY.md

All commits verified in git log:
- 46871ce (Task 1)
- 5931cb6 (Task 2)

---
*Phase: 01-auth-and-access-control*
*Completed: 2026-03-29*
