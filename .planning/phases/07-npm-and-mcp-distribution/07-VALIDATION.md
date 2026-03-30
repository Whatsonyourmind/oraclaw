---
phase: 7
slug: npm-and-mcp-distribution
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-30
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest + shell scripts |
| **Config file** | `mission-control/vitest.config.ts` |
| **Quick run command** | `cd mission-control && npx vitest run` |
| **Full suite command** | `cd mission-control && npm run test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd mission-control && npx vitest run`
- **After every plan wave:** Run `cd mission-control && npm run test`
- **Before `/gsd:verify-work`:** Full suite must be green + all 15 packages verified
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 01 | 1 | DIST-01 | unit | `node -e "require('./packages/sdk/bandit/dist/index.js')"` per package | ❌ W0 | ⬜ pending |
| 07-01-02 | 01 | 1 | DIST-02 | smoke | `head -1 packages/mcp-server/dist/index.npm.js \| grep shebang` | ❌ W0 | ⬜ pending |
| 07-02-01 | 02 | 2 | DIST-01 | integration | `npm info @oraclaw/bandit version` per package | N/A (requires publish) | ⬜ pending |
| 07-02-02 | 02 | 2 | DIST-02 | integration | `npm info @oraclaw/mcp-server version` | N/A (requires publish) | ⬜ pending |
| 07-02-03 | 02 | 2 | DIST-04 | manual | Review publish-packages.yml for OIDC permissions | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Build all SDK packages to dist/ with tsc
- [ ] Build MCP server with shebang prepended
- [ ] Package.json fields updated (main, types, files pointing to dist/)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| npm publish succeeds for all 15 packages | DIST-01, DIST-02 | Requires npm auth and registry access | Run `npm login` then publish script |
| OIDC trusted publishing works from GitHub Actions | DIST-04 | Requires GitHub Actions run + npm org config | Push to trigger workflow, verify provenance |
| MCP server discoverable by AI agent | DIST-02 | Requires MCP client connection | Install @oraclaw/mcp-server globally, configure in Claude/Cursor |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
