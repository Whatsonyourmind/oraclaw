---
phase: 07-npm-and-mcp-distribution
plan: 02
subsystem: infra
tags: [npm, publishing, oidc, github-actions, trusted-publishing, ci-cd]

# Dependency graph
requires:
  - phase: 07-01
    provides: compiled SDK + MCP server packages with dist/ output
provides:
  - publish-all.sh local script with version-check, retry, and summary
  - publish-packages.yml GitHub Actions OIDC Trusted Publishing workflow
  - Old publish-all-npm.sh deleted (superseded)
affects: [08-clawhub-distribution]

# Tech tracking
tech-stack:
  added: []
  patterns: [oidc-trusted-publishing, npm-provenance-attestation, version-skip-check]

key-files:
  created:
    - mission-control/scripts/publish-all.sh
    - mission-control/.github/workflows/publish-packages.yml
  deleted:
    - mission-control/scripts/publish-all-npm.sh (superseded by publish-all.sh)

key-decisions:
  - "publish-all.sh checks npm view before each publish to skip already-published versions"
  - "Up to 3 retries per package on publish failure with 5s delay"
  - "GitHub Actions workflow uses OIDC id-token: write for trusted publishing"
  - "npm --provenance flag generates signed provenance attestations"
  - "workflow_dispatch with dry-run option for safe testing"
  - "Subshell ( cd ... ) in workflow prevents cwd drift between SDK iterations"

patterns-established:
  - "Version-check-before-publish: npm view name@version check prevents immutable version conflicts"
  - "OIDC trusted publishing: id-token: write + --provenance replaces expiring npm tokens"
  - "Dry-run workflow input for safe CI testing without actual registry writes"

requirements-completed: [DIST-01, DIST-02, DIST-04]

# Metrics
duration: 3min
completed: 2026-03-30
---

# Phase 7 Plan 2: Publish Script and GitHub Actions OIDC Workflow Summary

**Created the local publish script and GitHub Actions OIDC Trusted Publishing workflow for all 15 @oraclaw packages**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-30T16:20:00Z
- **Completed:** 2026-03-30T16:23:00Z
- **Tasks:** 1 automated + 1 human checkpoint
- **Files modified:** 3 (1 created, 1 existing verified, 1 deleted)

## Accomplishments
- `publish-all.sh` script covers all 14 SDK packages + MCP server with version-check, retry (3 attempts), and summary
- `publish-packages.yml` GitHub Actions workflow has OIDC `id-token: write`, `--provenance` flag, dry-run input, and skip logic
- Old `publish-all-npm.sh` deleted (no version-check, no retry, no MCP server -- superseded)
- Full test suite passes (1044 tests, 36 files, zero regressions)

## Files Created/Modified
- `mission-control/scripts/publish-all.sh` - Local publish script with skip/retry/summary for all 15 packages
- `mission-control/.github/workflows/publish-packages.yml` - OIDC trusted publishing workflow
- `mission-control/scripts/publish-all-npm.sh` - DELETED (superseded by publish-all.sh)

## Human Checkpoint (Task 2)

Task 2 is a blocking human-verify gate. The user must:
1. Run `cd mission-control && npm login` (browser auth required)
2. Run `bash scripts/publish-all.sh` to publish all 15 packages
3. Verify with `npm info @oraclaw/<name> version` for each package
4. (Optional) Configure OIDC trusted publishing on npmjs.com for each package

**Expected outcome:** 5 packages at v1.1.0 (previously published), 9 SDK at v1.0.0, MCP server at v1.0.0.

## Decisions Made
- publish-all.sh uses `npm view "$name@$version" version` to detect already-published versions and skip them
- GitHub Actions workflow uses `workflow_dispatch` (manual trigger only, not on every push)
- OIDC trusted publishing configured via `permissions: id-token: write` + `--provenance` flag
- Old publish-all-npm.sh removed to avoid confusion between overlapping scripts

## Deviations from Plan

None. All automated artifacts were already in place from a prior session. Verification confirmed completeness.

## Issues Encountered
None.

## User Setup Required
- **npm login** -- browser authentication needed before first publish (npm classic tokens deprecated Dec 2025)
- **OIDC configuration** -- after initial publish, configure trusted publishers on each package's npmjs.com access page

## Next Phase Readiness
- Phase 7 automated work is complete
- npm publish requires human auth (documented above)
- Phase 8 (ClawHub Distribution) can proceed independently once ClawHub CLI auth is resolved

---
*Phase: 07-npm-and-mcp-distribution*
*Completed: 2026-03-30*
