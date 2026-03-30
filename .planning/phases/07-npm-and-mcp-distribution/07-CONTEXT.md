# Phase 7: npm and MCP Distribution - Context

**Gathered:** 2026-03-30
**Status:** Ready for planning
**Source:** Auto-advance (decisions derived from codebase analysis, package structure, and requirements)

<domain>
## Phase Boundary

Publish all 14 @oraclaw/* SDK packages and the @oraclaw/mcp-server to npm. Configure GitHub Actions OIDC Trusted Publishing so future releases require no npm tokens. The 14 SDK packages are thin API clients (zero algorithm code leaked). The MCP server exposes 12 tools for AI agents.

</domain>

<decisions>
## Implementation Decisions

### SDK package preparation
- All 14 SDK packages exist in `packages/sdk/` with `@oraclaw/*` scoped names and package.json files
- Packages currently point `main` and `types` at TypeScript source — must be built to JS before publishing
- Add a build step (tsc or tsup) to each SDK package to produce dist/ output
- Update each package.json: `main` → `dist/index.js`, `types` → `dist/index.d.ts`, add `files: ["dist"]`
- All packages use MIT license, version 1.0.0, and link to github.com/Whatsonyourmind/oraclaw

### MCP server preparation
- @oraclaw/mcp-server exists in `packages/mcp-server/` with `bin` entry pointing to `src/index.npm.ts`
- Must be built similarly — bin should point to compiled JS, not TS source
- The MCP server depends on `@modelcontextprotocol/sdk` — this is a real dependency, not devDep
- The server exposes 12 tools matching the algorithm categories

### Publishing strategy
- Publish all packages in a single CI run using a workspace publish command or per-package loop
- Use `npm publish --access public` for scoped packages (required for @oraclaw/* scope)
- No private packages should be published (client-sdk and shared-types are `"private": true`)
- Verify each package is installable after publish with `npm info @oraclaw/<name>`

### GitHub Actions OIDC Trusted Publishing (DIST-04)
- Configure npm provenance via GitHub Actions OIDC — no NPM_TOKEN secret needed
- Add `permissions: id-token: write` to the publish workflow
- Use `npm publish --provenance` flag which enables OIDC-based publishing
- Create a new workflow file (e.g., `publish-packages.yml`) or extend existing `release.yml`
- Configure npm trusted publishing in npm.js settings for the @oraclaw org/scope

### Retry/resilience for publish
- npm publish can fail transiently — add retry logic (script wrapper or GitHub Action retry)
- A `retry-npm-publish.sh` script already exists in `mission-control/scripts/`
- Skip already-published versions (check with `npm view` before publishing)

### Claude's Discretion
- Build tool choice (tsc vs tsup vs unbuild) — researcher will investigate
- Exact workflow trigger strategy (manual dispatch, tag-based, or push-to-main)
- Whether to use changesets or simple version management
- Monorepo publish tooling (npm workspaces `--workspaces` flag vs per-package loop)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/sdk/*/package.json`: All 14 SDK packages with @oraclaw/* names, descriptions, keywords
- `packages/mcp-server/package.json`: MCP server with bin entry and @modelcontextprotocol/sdk dependency
- `mission-control/scripts/retry-npm-publish.sh`: Existing retry wrapper for npm publish
- `mission-control/.github/workflows/release.yml`: Existing release workflow with semantic versioning
- `.github/workflows/ci.yml`: Existing CI workflow

### Established Patterns
- npm workspaces configured in monorepo root package.json
- TypeScript compilation via tsc (api uses vitest.config.ts, shared-types has tsconfig.json)
- MIT license across all packages
- GitHub repository at Whatsonyourmind/oraclaw

### Integration Points
- npm registry: @oraclaw scope (needs to exist on npmjs.com)
- GitHub Actions: OIDC provider for npm trusted publishing
- `packages/sdk/*/src/index.ts`: Entry points for each SDK package
- `packages/mcp-server/src/index.npm.ts`: MCP server entry point

</code_context>

<specifics>
## Specific Ideas

- The 14 SDK packages are thin API clients — they call the OraClaw API, no algorithm source code shipped
- The MCP server provides AI agents a way to discover and call OraClaw tools programmatically
- GitHub account is Whatsonyourmind, `gh` CLI is authenticated with full scopes
- Trusted Publishing eliminates the npm token expiry problem (DIST-04 requirement)
- The existing retry-npm-publish.sh script suggests prior experience with publish failures

</specifics>

<deferred>
## Deferred Ideas

- SDK code examples in 5+ languages (GROW-04) — v2 requirement
- Automated changelog generation per package — future enhancement
- npm download badge in READMEs — cosmetic, post-launch

</deferred>

---

*Phase: 07-npm-and-mcp-distribution*
*Context gathered: 2026-03-30*
