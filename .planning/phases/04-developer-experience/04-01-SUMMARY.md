---
phase: 04-developer-experience
plan: 01
subsystem: api
tags: [rfc-9457, problem-details, llms-txt, error-handling, ai-discovery]

# Dependency graph
requires:
  - phase: 03-billing
    provides: Existing RFC 9457 patterns in billing routes and auth middleware
provides:
  - sendProblem helper and ProblemTypes registry for standardized error responses
  - GET /llms.txt AI discovery endpoint for agent-readable API documentation
affects: [04-developer-experience, api-error-handling, ai-agent-integration]

# Tech tracking
tech-stack:
  added: []
  patterns: [RFC 9457 problem-details, llms.txt AI discovery, sendProblem helper]

key-files:
  created:
    - mission-control/apps/api/src/utils/problem-details.ts
    - mission-control/apps/api/src/utils/problem-details.test.ts
    - mission-control/apps/api/src/routes/llms-txt.ts
    - mission-control/apps/api/src/routes/llms-txt.test.ts
  modified:
    - mission-control/apps/api/src/index.ts

key-decisions:
  - "sendProblem helper returns FastifyReply for chaining; sets application/problem+json content-type"
  - "ProblemTypes registry has 12 error URIs under https://oraclaw.dev/errors/ namespace"
  - "500 errors hide internal details with generic message for security"
  - "llms.txt content is a const string literal (no dynamic generation needed)"

patterns-established:
  - "sendProblem(reply, status, ProblemTypes.X, title, detail, extra?) for all error responses"
  - "Fastify plugin pattern for simple GET routes (llmsTxtRoute)"

requirements-completed: [DX-02, DX-03]

# Metrics
duration: 4min
completed: 2026-03-30
---

# Phase 4 Plan 1: Problem Details & llms.txt Summary

**RFC 9457 problem-details helper with 12 error types, updated global error handler, and llms.txt AI discovery route**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-30T06:44:45Z
- **Completed:** 2026-03-30T06:49:01Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Created sendProblem helper with ProblemTypes registry covering all 12 error types used across the codebase
- Updated global error handler and all 8 inline error responses in index.ts to RFC 9457 format
- Added GET /llms.txt endpoint with full API discovery content following the llms.txt specification
- All 1062 tests pass with zero regressions

## Task Commits

Each task was committed atomically (TDD: test then feat):

1. **Task 1: RFC 9457 problem-details helper and global error handler**
   - `cd6f061` (test: failing tests for problem-details)
   - `580d727` (feat: implement helper and update error handler)
2. **Task 2: llms.txt AI discovery route**
   - `3274fed` (test: failing tests for llms-txt route)
   - `0ed161d` (feat: implement llms-txt route and register in index)

## Files Created/Modified
- `src/utils/problem-details.ts` - RFC 9457 sendProblem helper, ProblemDetail interface, ProblemTypes registry
- `src/utils/problem-details.test.ts` - 7 tests for helper and global error handler behavior
- `src/routes/llms-txt.ts` - GET /llms.txt Fastify plugin with AI-discoverable API documentation
- `src/routes/llms-txt.test.ts` - 7 tests for content-type, structure, sections, and content
- `src/index.ts` - Import sendProblem, replace 8 inline errors, rewrite global error handler, register llms-txt route

## Decisions Made
- sendProblem helper returns FastifyReply for chaining -- matches Fastify's native .send() pattern
- ProblemTypes registry uses 12 URIs under https://oraclaw.dev/errors/ namespace covering validation, not-found, rate-limited, unauthorized, internal, service-unavailable, and all billing-specific errors
- 500 errors always return generic detail "An unexpected error occurred. Please try again." to avoid leaking internal information
- llms.txt content is a const string literal -- no dynamic generation, serving is O(1)
- Did NOT modify auth.ts, free-tier-rate-limit.ts, subscribe.ts, or portal.ts -- they already used RFC 9457 format correctly

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- sendProblem helper available for any future routes that need error responses
- llms.txt provides AI agent discovery -- agents can now introspect OraClaw endpoints
- Ready for plan 04-02 (Scalar playground / OpenAPI improvements)

## Self-Check: PASSED

All 5 files exist. All 4 commits verified. 1062/1062 tests passing.

---
*Phase: 04-developer-experience*
*Completed: 2026-03-30*
