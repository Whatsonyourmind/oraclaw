---
phase: 04-developer-experience
plan: 02
subsystem: api
tags: [scalar, openapi, swagger, docs, dx]

# Dependency graph
requires:
  - phase: 01-core-api
    provides: Fastify server with @fastify/swagger registered
provides:
  - Scalar interactive API playground at /docs
  - OpenAPI 3.1.0 spec with OraClaw branding
affects: [04-developer-experience, api-documentation]

# Tech tracking
tech-stack:
  added: ["@scalar/fastify-api-reference"]
  removed: ["@fastify/swagger-ui"]
  patterns: [Scalar dynamic import, OpenAPI 3.1.0]

key-files:
  created:
    - mission-control/apps/api/src/plugins/swagger.test.ts
  modified:
    - mission-control/apps/api/src/plugins/swagger.ts
    - mission-control/apps/api/package.json
    - mission-control/package-lock.json

key-decisions:
  - "Scalar registered via dynamic import: import('@scalar/fastify-api-reference')"
  - "OpenAPI upgraded from 3.0.3 to 3.1.0"
  - "Security scheme changed from JWT bearer to apiKey (Unkey)"
  - "Removed outdated component schemas (APIResponse, AuthTokens, User, etc.)"
  - "Tags updated to algorithm categories: Optimize, Simulate, Solve, Analyze, Predict, Detect, Score, Plan, Billing, Health"

patterns-established:
  - "Scalar as default API docs UI replacing Swagger UI"

requirements-completed: [DX-01]

# Metrics
duration: 6min
completed: 2026-03-30
---

# Phase 4 Plan 2: Scalar Playground + OpenAPI 3.1 Summary

**Replaced @fastify/swagger-ui with @scalar/fastify-api-reference and upgraded OpenAPI spec to 3.1.0**

## Performance

- **Duration:** 6 min
- **Completed:** 2026-03-30
- **Tasks:** 2 (1 auto + 1 checkpoint)
- **Files modified:** 4

## Accomplishments
- Uninstalled @fastify/swagger-ui, installed @scalar/fastify-api-reference
- Rewrote swagger.ts: OpenAPI 3.1.0, OraClaw branding, apiKey scheme, algorithm tags
- Scalar interactive playground served at /docs with try-it-out functionality
- All 1062 tests pass with zero regressions
- Visual checkpoint auto-approved (auto-advance mode)

## Task Commits

1. **Task 1: Replace Swagger UI with Scalar and upgrade to OpenAPI 3.1**
   - `dafc296` (test: add failing tests for Scalar playground and OpenAPI 3.1)
   - `39f01b4` (feat: replace Swagger UI with Scalar and upgrade to OpenAPI 3.1)
2. **Task 2: Visual verification** — auto-approved checkpoint

## Files Created/Modified
- `src/plugins/swagger.ts` - Complete rewrite: OpenAPI 3.1.0, Scalar registration, updated branding/tags/security
- `src/plugins/swagger.test.ts` - Integration tests for Scalar serving, OpenAPI version, title, tags
- `package.json` - Swapped @fastify/swagger-ui for @scalar/fastify-api-reference
- `package-lock.json` - Updated lockfile

## Decisions Made
- Scalar registered via dynamic import pattern (Fastify handles promise resolution)
- Security scheme changed to apiKey type matching Unkey-based auth
- Removed 7 outdated component schemas from pre-v2 era
- Added production server URL (https://oraclaw.dev)

## Deviations from Plan

None - plan executed as written. Checkpoint auto-approved in auto-advance mode.

## Issues Encountered

None.

## Self-Check: PASSED

All key files exist. 2 commits verified. 1062/1062 tests passing.

---
*Phase: 04-developer-experience*
*Completed: 2026-03-30*
