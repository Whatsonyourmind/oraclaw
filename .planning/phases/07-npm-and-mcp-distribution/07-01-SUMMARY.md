---
phase: 07-npm-and-mcp-distribution
plan: 01
subsystem: infra
tags: [typescript, tsc, npm, sdk, mcp, build, publishing, declarations]

# Dependency graph
requires:
  - phase: none
    provides: existing SDK and MCP source packages
provides:
  - Shared tsconfig.sdk.json base config for all 14 SDK packages
  - Per-package tsconfig.json with dist/ compilation
  - Compiled JS + .d.ts type declarations for all 14 SDKs
  - Compiled MCP server binary with shebang for npx execution
  - Updated package.json files with dist/ paths, exports maps, publishConfig
affects: [07-02-npm-publish, 08-clawhub-distribution]

# Tech tracking
tech-stack:
  added: []
  patterns: [shared-tsconfig-extends, shebang-injection-build-script, exports-map-convention]

key-files:
  created:
    - mission-control/packages/sdk/tsconfig.sdk.json
    - mission-control/packages/sdk/*/tsconfig.json (14 files)
    - mission-control/packages/mcp-server/tsconfig.json
  modified:
    - mission-control/packages/sdk/*/package.json (14 files)
    - mission-control/packages/mcp-server/package.json

key-decisions:
  - "tsconfig.json must override include/exclude locally (paths in extended tsconfig resolve relative to parent)"
  - "MCP server build script chains tsc + Node shebang injection for cross-platform bin entry"
  - "5 already-published SDKs bumped to 1.1.0; 9 unpublished + MCP stay at 1.0.0"
  - "tsx peerDependency removed from MCP server (no longer needed after JS compilation)"

patterns-established:
  - "SDK tsconfig extends: per-package tsconfig.json extends ../tsconfig.sdk.json with local include/exclude overrides"
  - "npm package.json convention: main->dist/index.js, types->dist/index.d.ts, exports map, files:[dist], publishConfig.access:public"
  - "MCP shebang injection: build script appends #!/usr/bin/env node if missing after tsc compilation"

requirements-completed: [DIST-01, DIST-02]

# Metrics
duration: 4min
completed: 2026-03-30
---

# Phase 7 Plan 1: TypeScript Build Infrastructure Summary

**Compiled all 14 SDK packages and MCP server from TypeScript to publishable JavaScript with type declarations and npm-ready package.json configs**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-30T10:34:38Z
- **Completed:** 2026-03-30T10:39:01Z
- **Tasks:** 2
- **Files modified:** 31

## Accomplishments
- All 14 SDK packages compile cleanly to dist/ with index.js, index.d.ts, index.d.ts.map, and sourcemaps
- MCP server compiles to dist/index.npm.js with shebang preserved for npx execution
- All 15 package.json files updated with dist/ paths, exports map, files array, and publishConfig
- 5 previously-published packages versioned at 1.1.0; 9 unpublished + MCP at 1.0.0
- Full test suite passes (1044 tests, 36 files, zero regressions)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create shared tsconfig and build infrastructure for all 14 SDK packages** - `3c5931c` (feat)
2. **Task 2: Build MCP server with shebang and update package.json** - `7865cc7` (feat)

## Files Created/Modified
- `mission-control/packages/sdk/tsconfig.sdk.json` - Shared base TypeScript config (ES2022, NodeNext, declarations)
- `mission-control/packages/sdk/*/tsconfig.json` - 14 per-package configs extending shared base
- `mission-control/packages/sdk/*/package.json` - 14 updated SDKs with dist paths, exports, publishConfig
- `mission-control/packages/mcp-server/tsconfig.json` - MCP server config (only index.npm.ts)
- `mission-control/packages/mcp-server/package.json` - Updated with build script, dist paths, removed tsx peerDep

## Decisions Made
- tsconfig `include`/`exclude` must be overridden in per-package tsconfig.json because paths in extended configs resolve relative to the parent tsconfig's directory, not the child's
- MCP server build uses `tsc && node -e "..."` to chain compilation with conditional shebang injection
- Removed `tsx` peerDependency from MCP server since compiled JS no longer needs TypeScript runtime
- Kept `@modelcontextprotocol/sdk` as a real runtime dependency for MCP server

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed tsconfig include/exclude path resolution**
- **Found during:** Task 1 (SDK compilation)
- **Issue:** Per-package tsconfig.json inheriting `include: ["src/**/*"]` from parent resolved the path relative to parent directory (`../src/**/*`), finding no input files
- **Fix:** Added explicit `include` and `exclude` arrays to each per-package tsconfig.json to override parent paths
- **Files modified:** All 14 packages/sdk/*/tsconfig.json
- **Verification:** All 14 packages compiled cleanly after fix
- **Committed in:** 3c5931c (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary fix for TypeScript path resolution. No scope creep.

## Issues Encountered
None beyond the tsconfig path resolution issue documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 15 packages ready for `npm publish` (Plan 07-02)
- dist/ directories are gitignored (compiled artifacts, not committed)
- npm authentication needed before publishing (noted in STATE.md blockers)

---
*Phase: 07-npm-and-mcp-distribution*
*Completed: 2026-03-30*
