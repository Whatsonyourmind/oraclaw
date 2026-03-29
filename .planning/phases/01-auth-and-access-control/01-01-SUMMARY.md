---
phase: 01-auth-and-access-control
plan: 01
subsystem: auth
tags: [unkey, api-keys, rate-limiting, fastify-hooks, middleware]

# Dependency graph
requires: []
provides:
  - Unkey client singleton for API key verification
  - Auth preHandler middleware (verifyKey-based auth + rate limiting)
  - Rate limit headers onSend hook (X-RateLimit-Remaining/Limit/Reset)
  - Key management functions (createApiKey, rotateApiKey, revokeApiKey)
  - FastifyRequest augmentation with tier, keyId, stripeCustomerId, billingPath
affects: [stripe-billing, usage-metering, x402-payments, public-api-tests]

# Tech tracking
tech-stack:
  added: ["@unkey/api@2.3.2 (already installed, now wired)"]
  patterns: ["Fastify preHandler for auth, onSend for response headers", "try/catch for SDK errors returning 503", "Module augmentation for FastifyRequest custom properties"]

key-files:
  created:
    - mission-control/apps/api/src/services/unkey.ts
    - mission-control/apps/api/src/middleware/auth.ts
  modified:
    - mission-control/apps/api/src/routes/oracle/api-public.ts
    - mission-control/apps/api/src/index.ts

key-decisions:
  - "SDK v2.3.2 throws on errors (try/catch), not { data, error } pattern -- adjusted from research recommendation"
  - "Rate limit headers set in both preHandler (for error responses) and onSend (for success responses) to ensure all paths covered"
  - "Free tier skips Unkey entirely to avoid wasting Unkey quota on anonymous traffic"

patterns-established:
  - "Unkey auth via preHandler: single verifyKey() call handles auth + rate limiting + tier resolution"
  - "RFC 9457 error responses: { type, title, status, detail } for auth errors"
  - "Request context pattern: middleware sets request.tier/keyId/billingPath, route handlers read them"

requirements-completed: [AUTH-01, AUTH-02, AUTH-03, AUTH-04]

# Metrics
duration: 9min
completed: 2026-03-29
---

# Phase 1 Plan 1: Unkey Auth & Rate Limiting Summary

**Unkey-powered API key auth with distributed rate limiting and X-RateLimit headers, replacing prefix-based stubs and in-memory counters across 17 public API endpoints**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-29T19:46:12Z
- **Completed:** 2026-03-29T19:55:57Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Unkey client singleton with tier-based rate limit config and key lifecycle functions (create/rotate/revoke)
- Auth middleware using single verifyKey() call for authentication, tier resolution, and distributed rate limiting
- Removed 85 lines of old prefix-based auth stubs and 170+ lines of per-handler auth/rate-limit/logging calls from 17 route handlers
- Rate limit headers (X-RateLimit-Remaining, X-RateLimit-Limit, X-RateLimit-Reset) injected on all API responses

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Unkey client singleton and auth middleware with rate limit headers** - `efef77c` (feat)
2. **Task 2: Remove old auth stubs from api-public.ts and wire Unkey middleware to routes** - `c33f298` (feat)

## Files Created/Modified
- `mission-control/apps/api/src/services/unkey.ts` - Unkey client singleton, TIER_RATE_LIMITS config, createApiKey/rotateApiKey/revokeApiKey
- `mission-control/apps/api/src/middleware/auth.ts` - createAuthMiddleware (preHandler), rateLimitHeadersHook (onSend), FastifyRequest augmentation
- `mission-control/apps/api/src/routes/oracle/api-public.ts` - Removed old auth code (checkApiKey, checkRateLimit, dailyCounts, logUsage, usageLog, ApiKeyPayload, RATE_LIMITS)
- `mission-control/apps/api/src/index.ts` - Added Unkey imports, registered preHandler on /api/v1/*, registered onSend hook, removed old rateLimitStore

## Decisions Made
- **SDK error handling via try/catch, not { data, error }:** The Unkey SDK v2.3.2 uses `unwrapAsync` internally and throws exceptions on network/API errors. The research notes assumed a `{ data, error }` return pattern. Adjusted middleware to use try/catch, returning 503 on caught errors.
- **Rate limit headers in both hooks:** Set headers in preHandler (for error replies where onSend might not fire correctly) AND in onSend (for success replies). Ensures headers are present regardless of response path.
- **Free tier skips Unkey entirely:** No Authorization header means no Unkey call, preserving Unkey monthly active key quota for paying customers.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected SDK error handling pattern from { data, error } to try/catch**
- **Found during:** Task 1 (auth middleware implementation)
- **Issue:** Research notes and plan described `{ data, error }` destructuring from verifyKey(). Actual SDK v2.3.2 returns `Promise<{ meta, data }>` and throws on errors via `unwrapAsync`.
- **Fix:** Used try/catch block for SDK/network errors; access `response.data` for verification result.
- **Files modified:** mission-control/apps/api/src/middleware/auth.ts
- **Verification:** TypeScript compiles cleanly; pattern matches installed SDK types.
- **Committed in:** efef77c (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug - incorrect SDK usage pattern)
**Impact on plan:** Essential correction for runtime correctness. No scope creep.

## Issues Encountered
None beyond the SDK pattern deviation documented above.

## User Setup Required

External services require manual configuration before the Unkey middleware can function at runtime:
- `UNKEY_ROOT_KEY` environment variable from Unkey Dashboard -> Settings -> Root Keys
- `UNKEY_API_ID` environment variable from Unkey Dashboard -> APIs -> Create API -> copy API ID
- Create Unkey account and API namespace at https://app.unkey.com

## Next Phase Readiness
- Auth middleware is wired and TypeScript compiles cleanly
- Plan 01-02 (tests) can proceed immediately to verify auth behavior with mocked Unkey SDK
- Stripe billing integration (Phase 2) can use request.tier and request.stripeCustomerId set by this middleware
- Key management functions (createApiKey, rotateApiKey, revokeApiKey) ready for user signup/management flows

## Self-Check: PASSED

All files verified present on disk:
- mission-control/apps/api/src/services/unkey.ts
- mission-control/apps/api/src/middleware/auth.ts
- .planning/phases/01-auth-and-access-control/01-01-SUMMARY.md

All commits verified in git log:
- efef77c (Task 1)
- c33f298 (Task 2)

---
*Phase: 01-auth-and-access-control*
*Completed: 2026-03-29*
