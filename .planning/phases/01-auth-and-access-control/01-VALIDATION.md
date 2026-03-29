---
phase: 01-auth-and-access-control
type: validation
created: 2026-03-29
---

# Phase 1: Auth and Access Control — Validation Strategy

## Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 1.2.0 |
| Config file | `mission-control/apps/api/vitest.config.ts` |
| Quick run | `cd mission-control/apps/api && npx vitest run --reporter=verbose` |
| Full suite | `cd mission-control && npm run test` |

## Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | Wave |
|--------|----------|-----------|-------------------|------|
| AUTH-01 | Key creation via Unkey SDK, verification, tier metadata | unit | `npx vitest run src/middleware/auth.test.ts` | 2 |
| AUTH-02 | Key rotation with overlap, revocation stops access | unit | `npx vitest run src/services/unkey.test.ts` | 2 |
| AUTH-03 | Rate limits per tier, 429 on exceed, replaces in-memory | unit+integration | `npx vitest run src/middleware/auth.test.ts` | 2 |
| AUTH-04 | X-RateLimit-Remaining/Limit/Reset on every response | integration | `npx vitest run src/middleware/auth.test.ts` | 2 |

## Sampling Rate

- **Per task commit:** `cd mission-control/apps/api && npx vitest run --reporter=verbose`
- **Per wave merge:** `cd mission-control && npm run test` (full 945+ tests)
- **Phase gate:** Full suite green before `/gsd:verify-work`

## Wave/Task/Test Matrix

| Wave | Plan | Task | Test File | Automated Command |
|------|------|------|-----------|-------------------|
| 1 | 01-01 | 1 | (typecheck only) | `npx tsc --noEmit` |
| 1 | 01-01 | 2 | (typecheck only) | `npx tsc --noEmit` |
| 2 | 01-02 | 1 | `auth.test.ts` | `npx vitest run src/middleware/auth.test.ts` |
| 2 | 01-02 | 2 | `unkey.test.ts` | `npx vitest run src/services/unkey.test.ts` |

## Regression Gate

Full existing suite (945+ tests) must pass after each wave.
