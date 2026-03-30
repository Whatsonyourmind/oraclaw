---
phase: 5
slug: x402-machine-payments
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-30
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 1.2.0 |
| **Config file** | `mission-control/apps/api/vitest.config.ts` |
| **Quick run command** | `cd mission-control/apps/api && npx vitest run src/hooks/x402-payment.test.ts` |
| **Full suite command** | `cd mission-control && npm run test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd mission-control/apps/api && npx vitest run src/hooks/x402-payment.test.ts`
- **After every plan wave:** Run `cd mission-control && npm run test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | INFRA-02 | unit | `npx vitest run src/hooks/x402-payment.test.ts -t "initializes"` | ❌ W0 | ⬜ pending |
| 05-01-02 | 01 | 1 | BILL-04 | unit | `npx vitest run src/hooks/x402-payment.test.ts -t "valid payment"` | ❌ W0 | ⬜ pending |
| 05-01-03 | 01 | 1 | BILL-04 | unit | `npx vitest run src/hooks/x402-payment.test.ts -t "no payment header"` | ❌ W0 | ⬜ pending |
| 05-01-04 | 01 | 1 | BILL-04 | unit | `npx vitest run src/hooks/x402-payment.test.ts -t "invalid payment"` | ❌ W0 | ⬜ pending |
| 05-02-01 | 02 | 1 | BILL-04 | integration | `npx vitest run src/hooks/x402-payment.test.ts -t "bypasses Unkey"` | ❌ W0 | ⬜ pending |
| 05-02-02 | 02 | 1 | BILL-04 | integration | `npx vitest run src/hooks/x402-payment.test.ts -t "three billing paths"` | ❌ W0 | ⬜ pending |
| 05-02-03 | 02 | 1 | BILL-04 | unit | `npx vitest run src/hooks/x402-payment.test.ts -t "settlement"` | ❌ W0 | ⬜ pending |
| 05-02-04 | 02 | 1 | BILL-04 | unit | `npx vitest run src/hooks/x402-payment.test.ts -t "402 response"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/hooks/x402-payment.test.ts` — stubs for BILL-04 and INFRA-02 (all test cases)
- [ ] `src/test-utils/mock-x402.ts` — mock x402ResourceServer factory
- [ ] Package install: `npm install @x402/core@2.8.0 @x402/evm@2.8.0` — INFRA-02

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| End-to-end x402 payment with funded wallet | BILL-04 | Requires real USDC on testnet | Fund wallet, send x402 request to running server, verify payment settles |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
