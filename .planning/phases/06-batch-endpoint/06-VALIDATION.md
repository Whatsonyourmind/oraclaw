---
phase: 6
slug: batch-endpoint
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-30
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `mission-control/apps/api/vitest.config.ts` |
| **Quick run command** | `cd mission-control/apps/api && npx vitest run src/routes/oracle/api-batch.test.ts` |
| **Full suite command** | `cd mission-control && npm run test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd mission-control/apps/api && npx vitest run src/routes/oracle/api-batch.test.ts`
- **After every plan wave:** Run `cd mission-control && npm run test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | DX-04 | unit | `npx vitest run src/routes/oracle/api-batch.test.ts -t "accepts batch"` | ❌ W0 | ⬜ pending |
| 06-01-02 | 01 | 1 | DX-04 | unit | `npx vitest run src/routes/oracle/api-batch.test.ts -t "same order"` | ❌ W0 | ⬜ pending |
| 06-01-03 | 01 | 1 | DX-04 | unit | `npx vitest run src/routes/oracle/api-batch.test.ts -t "partial failure"` | ❌ W0 | ⬜ pending |
| 06-01-04 | 01 | 1 | DX-04 | unit | `npx vitest run src/routes/oracle/api-batch.test.ts -t "all fail"` | ❌ W0 | ⬜ pending |
| 06-01-05 | 01 | 1 | DX-04 | unit | `npx vitest run src/routes/oracle/api-batch.test.ts -t "max 20"` | ❌ W0 | ⬜ pending |
| 06-01-06 | 01 | 1 | DX-04 | unit | `npx vitest run src/routes/oracle/api-batch.test.ts -t "meter"` | ❌ W0 | ⬜ pending |
| 06-01-07 | 01 | 1 | DX-04 | unit | `npx vitest run src/routes/oracle/api-batch.test.ts -t "unknown algorithm"` | ❌ W0 | ⬜ pending |
| 06-01-08 | 01 | 1 | DX-04 | unit | `npx vitest run src/routes/oracle/api-batch.test.ts -t "validation"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/routes/oracle/api-batch.test.ts` — stubs for all DX-04 test cases
- [ ] `src/routes/oracle/api-batch.ts` — batch route + dispatch map
- [ ] FastifyRequest type augmentation: `isBatchRequest?: boolean`, `batchSize?: number`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Stripe batch meter event appears in dashboard | DX-04 | Requires live Stripe connection | Call batch endpoint with API key, check Stripe dashboard for meter events |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
