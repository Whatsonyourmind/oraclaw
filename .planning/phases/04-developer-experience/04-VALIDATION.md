---
phase: 4
slug: developer-experience
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-30
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 1.2.0 |
| **Config file** | `mission-control/apps/api/vitest.config.ts` |
| **Quick run command** | `cd mission-control/apps/api && npx vitest run` |
| **Full suite command** | `cd mission-control && npm run test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd mission-control/apps/api && npx vitest run`
- **After every plan wave:** Run `cd mission-control && npm run test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 0 | DX-01 | unit | `npx vitest run src/plugins/swagger.test.ts` | ❌ W0 | ⬜ pending |
| 04-01-02 | 01 | 0 | DX-02 | unit | `npx vitest run src/utils/problem-details.test.ts` | ❌ W0 | ⬜ pending |
| 04-01-03 | 01 | 0 | DX-03 | unit | `npx vitest run src/routes/llms-txt.test.ts` | ❌ W0 | ⬜ pending |
| 04-02-01 | 02 | 1 | DX-01 | integration | `npx vitest run src/plugins/swagger.test.ts` | ❌ W0 | ⬜ pending |
| 04-02-02 | 02 | 1 | DX-02 | integration | `npx vitest run src/utils/problem-details.test.ts` | ❌ W0 | ⬜ pending |
| 04-02-03 | 02 | 1 | DX-02 | integration | `npx vitest run src/routes/billing/subscribe.test.ts src/routes/billing/portal.test.ts` | ✅ | ⬜ pending |
| 04-02-04 | 02 | 1 | DX-03 | integration | `npx vitest run src/routes/llms-txt.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/plugins/swagger.test.ts` — stubs for DX-01 (Scalar serves at /docs, OpenAPI 3.1 version)
- [ ] `src/utils/problem-details.test.ts` — stubs for DX-02 (helper function, content-type header)
- [ ] `src/routes/llms-txt.test.ts` — stubs for DX-03 (route exists, returns valid content)
- [ ] `npm install @scalar/fastify-api-reference` — Scalar package install

*Existing infrastructure covers billing route tests (subscribe.test.ts, portal.test.ts, auth.test.ts).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Scalar UI renders correctly | DX-01 | Visual rendering verification | Start dev server, visit /docs, verify interactive playground loads |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
