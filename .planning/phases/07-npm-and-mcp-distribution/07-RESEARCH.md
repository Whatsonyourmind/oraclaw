# Phase 7: npm and MCP Distribution - Research

**Researched:** 2026-03-30
**Domain:** npm package publishing, OIDC trusted publishing, TypeScript build tooling, MCP server distribution
**Confidence:** HIGH

## Summary

This phase publishes 14 @oraclaw/* SDK packages and the @oraclaw/mcp-server to npm, then configures GitHub Actions OIDC Trusted Publishing for future token-free releases. The SDK packages are single-file thin API clients (40-119 lines each) currently pointing `main` at raw TypeScript source. They need a build step to produce JavaScript + declaration files before publishing.

Five packages (bandit, calibrate, decide, graph, solver) were previously published at version 1.0.0 with raw TypeScript source (no build step). Nine SDK packages and the MCP server have never been published. The npm token is currently expired (E401), which is expected since npm deprecated all classic tokens on December 9, 2025. OIDC trusted publishing replaces the need for long-lived tokens entirely.

**Critical discovery:** The 14 SDK packages under `packages/sdk/*` are NOT npm workspace members. The workspace glob `packages/*` matches `packages/sdk` as a directory, not the individual packages inside it. Publishing must use a per-package loop, not `npm publish --workspaces`.

**Primary recommendation:** Use tsc (not tsup) for building since all packages are ESM-only single-file modules with zero dependencies. Add a shared tsconfig.sdk.json at `packages/sdk/tsconfig.json`, per-package tsconfig extending it, and a build script. For initial publish of the 9 new packages + MCP server, authenticate via `npm login` in browser, publish all with `--access public`, then configure OIDC trusted publishing on each package's npm access page. Version the 5 already-published packages as 1.1.0 (compiled JS replaces raw TS).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- All 14 SDK packages exist in `packages/sdk/` with `@oraclaw/*` scoped names and package.json files
- Packages currently point `main` and `types` at TypeScript source -- must be built to JS before publishing
- Add a build step (tsc or tsup) to each SDK package to produce dist/ output
- Update each package.json: `main` -> `dist/index.js`, `types` -> `dist/index.d.ts`, add `files: ["dist"]`
- All packages use MIT license, version 1.0.0, and link to github.com/Whatsonyourmind/oraclaw
- @oraclaw/mcp-server exists in `packages/mcp-server/` with `bin` entry pointing to `src/index.npm.ts`
- Must be built similarly -- bin should point to compiled JS, not TS source
- The MCP server depends on `@modelcontextprotocol/sdk` -- this is a real dependency, not devDep
- Publish all packages in a single CI run using workspace publish command or per-package loop
- Use `npm publish --access public` for scoped packages (required for @oraclaw/* scope)
- No private packages should be published (client-sdk and shared-types are `"private": true`)
- Verify each package is installable after publish with `npm info @oraclaw/<name>`
- Configure npm provenance via GitHub Actions OIDC -- no NPM_TOKEN secret needed
- Add `permissions: id-token: write` to the publish workflow
- Use `npm publish --provenance` flag which enables OIDC-based publishing
- Create a new workflow file (e.g., `publish-packages.yml`) or extend existing `release.yml`
- Configure npm trusted publishing in npmjs settings for the @oraclaw org/scope
- npm publish can fail transiently -- add retry logic
- A `retry-npm-publish.sh` script already exists in `mission-control/scripts/`
- Skip already-published versions (check with `npm view` before publishing)

### Claude's Discretion
- Build tool choice (tsc vs tsup vs unbuild) -- researcher will investigate
- Exact workflow trigger strategy (manual dispatch, tag-based, or push-to-main)
- Whether to use changesets or simple version management
- Monorepo publish tooling (npm workspaces `--workspaces` flag vs per-package loop)

### Deferred Ideas (OUT OF SCOPE)
- SDK code examples in 5+ languages (GROW-04) -- v2 requirement
- Automated changelog generation per package -- future enhancement
- npm download badge in READMEs -- cosmetic, post-launch
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DIST-01 | All 14 npm SDK packages published to @oraclaw scope (10 remaining) | Build configuration (tsconfig + build scripts), per-package publish loop, version strategy for 5 already-published packages |
| DIST-02 | @oraclaw/mcp-server published to npm | MCP server build with shebang handling, bin entry pointing to compiled JS, @modelcontextprotocol/sdk as dependency |
| DIST-04 | npm Trusted Publishing configured via GitHub Actions OIDC (no more token expiry) | OIDC workflow configuration, per-package trusted publisher setup on npmjs.com, npm CLI v11.5.1+ requirement |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| typescript | 5.3.3 | Compile TS to JS + .d.ts declarations | Already in monorepo devDeps, tsc is sufficient for single-file ESM packages |
| npm CLI | 11.5.1+ | Publishing with OIDC/provenance support | Required for trusted publishing; local is 11.6.2 on Node 24 |
| @modelcontextprotocol/sdk | ^1.12.0 | MCP server runtime dependency | Already declared in mcp-server package.json |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| actions/setup-node | v4 | GitHub Actions Node setup with registry-url | In publish workflow for npm auth |
| setup-npm-trusted-publish | latest | Create placeholder packages for OIDC setup | Only if first publish via CI is needed (not needed here -- manual first publish) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| tsc | tsup | tsup adds bundling, tree-shaking, CJS support -- overkill for single-file ESM packages with no dependencies. tsc is simpler, already available. |
| tsc | unbuild | Similar to tsup -- unnecessary complexity for these tiny packages |
| per-package loop | npm workspaces --workspaces | SDK packages are NOT workspace members (nested under packages/sdk/*). Cannot use --workspaces flag. |
| changesets | simple version bumps | 14 packages all version-locked at 1.0.0. Changesets adds overhead for no benefit at this stage. Simple version management is correct. |

**Build tool decision: Use tsc.**
Rationale: Every SDK package is a single `src/index.ts` file (40-119 lines), ESM-only (`"type": "module"`), with zero dependencies. tsc produces `.js` + `.d.ts` + `.d.ts.map` which is all that's needed. tsup would add an unnecessary devDependency and configuration layer for packages that need zero bundling. TypeScript 5.3.3 is already installed as a workspace devDep.

## Architecture Patterns

### Build Infrastructure Layout
```
packages/
├── sdk/
│   ├── tsconfig.sdk.json         # Shared base config for all SDK packages
│   ├── bandit/
│   │   ├── src/index.ts          # Source (existing)
│   │   ├── tsconfig.json         # Extends ../tsconfig.sdk.json (NEW)
│   │   ├── package.json          # Updated: main, types, files, scripts (MODIFIED)
│   │   └── dist/                 # Build output (NEW, gitignored)
│   │       ├── index.js
│   │       ├── index.d.ts
│   │       └── index.d.ts.map
│   ├── anomaly/
│   │   └── (same pattern)
│   └── ... (14 packages total)
├── mcp-server/
│   ├── src/index.npm.ts          # Source with #!/usr/bin/env node shebang
│   ├── tsconfig.json             # NEW
│   ├── package.json              # Updated: bin, main, files, scripts
│   └── dist/                     # Build output (NEW, gitignored)
│       ├── index.npm.js          # With shebang prepended
│       └── index.npm.d.ts
```

### Pattern 1: Shared tsconfig.sdk.json
**What:** A base TypeScript config all 14 SDK packages extend
**When to use:** For all SDK packages to ensure consistent compilation
**Example:**
```typescript
// packages/sdk/tsconfig.sdk.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

```typescript
// packages/sdk/bandit/tsconfig.json
{
  "extends": "../tsconfig.sdk.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  }
}
```

### Pattern 2: Updated SDK package.json
**What:** Standard fields for npm-publishable ESM package
**Example:**
```json
{
  "name": "@oraclaw/bandit",
  "version": "1.1.0",
  "description": "...",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsc",
    "prepublishOnly": "npm run build"
  },
  "publishConfig": {
    "access": "public",
    "provenance": true
  }
}
```

### Pattern 3: MCP Server package.json
**What:** CLI-executable MCP server with shebang
**Example:**
```json
{
  "name": "@oraclaw/mcp-server",
  "version": "1.0.0",
  "type": "module",
  "main": "dist/index.npm.js",
  "bin": {
    "oraclaw-mcp": "dist/index.npm.js"
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsc && node -e \"const fs=require('fs');const f='dist/index.npm.js';const c=fs.readFileSync(f,'utf8');if(!c.startsWith('#!'))fs.writeFileSync(f,'#!/usr/bin/env node\\n'+c)\"",
    "prepublishOnly": "npm run build"
  },
  "publishConfig": {
    "access": "public",
    "provenance": true
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.12.0"
  }
}
```

### Pattern 4: GitHub Actions Publish Workflow with OIDC
**What:** Token-free publishing via OIDC trusted publishing
**Example:**
```yaml
name: Publish Packages
on:
  workflow_dispatch:

permissions:
  contents: read
  id-token: write  # Required for OIDC

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          registry-url: 'https://registry.npmjs.org'
      - name: Install npm 11.5.1+
        run: npm install -g npm@latest
      - name: Build and publish SDK packages
        run: |
          for pkg in packages/sdk/*/; do
            name=$(node -p "require('./$pkg/package.json').name")
            version=$(node -p "require('./$pkg/package.json').version")
            published=$(npm view "$name@$version" version 2>/dev/null || echo "")
            if [ "$published" = "$version" ]; then
              echo "Skipping $name@$version (already published)"
              continue
            fi
            cd "$pkg"
            npm run build
            npm publish --provenance --access public
            cd -
          done
      - name: Build and publish MCP server
        run: |
          cd packages/mcp-server
          npm run build
          npm publish --provenance --access public
```

### Anti-Patterns to Avoid
- **Publishing TypeScript source directly:** The 5 previously published packages shipped .ts files. Consumers cannot import them without tsx/ts-node. Always compile to JS.
- **Using `npm publish --workspaces` for SDK packages:** The SDK packages are nested under `packages/sdk/*` which is not matched by the workspace glob `packages/*`. Must use per-package loop.
- **Storing npm tokens as GitHub secrets:** Classic tokens were permanently deprecated December 2025. OIDC trusted publishing is the only supported path.
- **Publishing without `--access public`:** Scoped packages default to restricted (paid). First publish must use `--access public`.
- **Forgetting shebang on MCP server bin:** Without `#!/usr/bin/env node`, `npx @oraclaw/mcp-server` will fail on Unix systems.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| TypeScript compilation | Custom build scripts per package | tsc with shared tsconfig | 14 packages must compile identically; shared config ensures consistency |
| Shebang prepending | Manual file editing | Build script that checks and prepends | tsc does not add shebangs; need a post-build step for MCP server bin |
| Version skip logic | Custom npm view parsing | Existing `retry-npm-publish.sh` pattern + `npm view` check | Already solved; the existing script has the right retry + skip pattern |
| OIDC authentication | Manual token management | GitHub Actions OIDC + npm trusted publishing | npm classic tokens are permanently dead; OIDC is the only path forward |

**Key insight:** These are 14 nearly-identical single-file packages. The build infrastructure should be shared (one tsconfig, one build loop), not 14 independent build configurations.

## Common Pitfalls

### Pitfall 1: npm Trusted Publishing requires package to exist first
**What goes wrong:** You configure OIDC in the workflow but the package has never been published. npm returns 404.
**Why it happens:** Unlike PyPI, npm requires a package to exist on the registry before you can configure trusted publishing in its access settings.
**How to avoid:** Publish all packages manually first (via `npm login` + `npm publish --access public`), THEN configure trusted publishing on each package's access page at `https://www.npmjs.com/package/@oraclaw/<name>/access`.
**Warning signs:** 404 errors during first CI publish.

### Pitfall 2: npm CLI version too old for trusted publishing
**What goes wrong:** OIDC token exchange fails silently or with cryptic auth errors.
**Why it happens:** Trusted publishing requires npm CLI v11.5.1+. Node 22 ships with npm 10, not 11.
**How to avoid:** In GitHub Actions, explicitly install npm@latest (`npm install -g npm@latest`) after `setup-node`. Local machine has npm 11.6.2 (good).
**Warning signs:** `E401 Unauthorized` in CI despite correct OIDC permissions.

### Pitfall 3: Workspace glob does not match nested SDK packages
**What goes wrong:** `npm publish --workspaces` publishes mcp-server but skips all 14 SDK packages.
**Why it happens:** `"workspaces": ["packages/*"]` matches `packages/mcp-server` but NOT `packages/sdk/bandit` (two levels deep).
**How to avoid:** Use a for-loop over `packages/sdk/*/` directories. The MCP server CAN use workspace publish since it is a direct child of `packages/`.
**Warning signs:** Only mcp-server publishes; SDK packages silently skipped.

### Pitfall 4: Scoped packages default to restricted access
**What goes wrong:** `npm publish` fails with 402 Payment Required for @oraclaw/* packages.
**Why it happens:** npm scoped packages default to restricted (requires paid plan). Must pass `--access public` on first publish.
**How to avoid:** Use `--access public` flag or set `"publishConfig": { "access": "public" }` in package.json.
**Warning signs:** 402 error on first publish only (subsequent version publishes inherit the access level).

### Pitfall 5: Missing shebang on MCP server bin entry
**What goes wrong:** `npx @oraclaw/mcp-server` fails with "cannot execute binary file" on Linux/macOS.
**Why it happens:** tsc strips the `#!/usr/bin/env node` shebang comment from the source. The compiled JS has no shebang.
**How to avoid:** Add a post-build step that prepends the shebang if missing. The source file already has it, but tsc does not preserve it.
**Warning signs:** Works on Windows (ignores shebang), fails on Unix.

### Pitfall 6: Publishing raw TypeScript that consumers cannot use
**What goes wrong:** Published package has `main: "src/index.ts"` -- consumers get type errors or cannot import.
**Why it happens:** The 5 previously published packages at 1.0.0 shipped raw TS. This technically works only if consumers have tsx/ts-node.
**How to avoid:** Always compile to JS before publishing. Set `"files": ["dist"]` to exclude src/ from tarball.
**Warning signs:** Package tarball contains .ts files instead of .js files.

### Pitfall 7: OIDC trusted publishing needs per-package configuration
**What goes wrong:** OIDC works for one package but fails for others.
**Why it happens:** Trusted publishing is configured per-package on npmjs.com, not per-scope or per-org. Each of the 15 packages needs its own trusted publisher configuration.
**How to avoid:** After first manual publish, visit the access page for ALL 15 packages and configure the same GitHub Actions workflow.
**Warning signs:** First package publishes in CI; subsequent packages fail with auth error.

## Code Examples

### Build all SDK packages (shell script)
```bash
#!/bin/bash
# Build all 14 SDK packages
SDK_DIR="packages/sdk"
for pkg_dir in "$SDK_DIR"/*/; do
  pkg_name=$(node -p "require('./$pkg_dir/package.json').name")
  echo "Building $pkg_name..."
  cd "$pkg_dir"
  npx tsc
  cd - > /dev/null
done
echo "All SDK packages built."
```

### Publish all packages with skip logic (shell script)
```bash
#!/bin/bash
# Publish SDK packages, skipping already-published versions
for pkg_dir in packages/sdk/*/; do
  name=$(node -p "require('./$pkg_dir/package.json').name")
  version=$(node -p "require('./$pkg_dir/package.json').version")

  # Check if already published
  published=$(npm view "$name@$version" version 2>/dev/null || echo "")
  if [ "$published" = "$version" ]; then
    echo "SKIP $name@$version (already published)"
    continue
  fi

  echo "Publishing $name@$version..."
  cd "$pkg_dir"
  npm publish --access public --provenance
  cd - > /dev/null
done

# Publish MCP server
cd packages/mcp-server
name=$(node -p "require('./package.json').name")
version=$(node -p "require('./package.json').version")
published=$(npm view "$name@$version" version 2>/dev/null || echo "")
if [ "$published" != "$version" ]; then
  npm publish --access public --provenance
fi
cd - > /dev/null
```

### MCP server shebang build step
```bash
# After tsc compiles index.npm.ts -> dist/index.npm.js
# Prepend shebang if missing
FILE="dist/index.npm.js"
if ! head -1 "$FILE" | grep -q '^#!'; then
  echo '#!/usr/bin/env node' | cat - "$FILE" > temp && mv temp "$FILE"
fi
# On Unix, make executable
chmod +x "$FILE" 2>/dev/null || true
```

### Verification: test package installability
```bash
# After publishing, verify each package
for pkg in bandit anomaly bayesian calibrate cmaes decide ensemble evolve forecast graph pathfind risk simulate solver; do
  echo -n "@oraclaw/$pkg: "
  npm info "@oraclaw/$pkg" version 2>&1
done
echo -n "@oraclaw/mcp-server: "
npm info "@oraclaw/mcp-server" version 2>&1
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| npm classic tokens | OIDC Trusted Publishing | Dec 2025 (tokens deprecated) | Classic tokens permanently revoked; OIDC is the only CI/CD publish method |
| `npm publish` with token | `npm publish --provenance` with OIDC | Jul 2025 (GA) | Provenance attestations generated automatically when using trusted publishing |
| Manual token rotation | Zero token management | Dec 2025 | No secrets to store, rotate, or leak |
| `main: "src/index.ts"` | `main: "dist/index.js"` with build step | Industry standard | Publishing raw TS is non-standard; consumers need runtime TS support |

**Deprecated/outdated:**
- **npm classic tokens:** Permanently deprecated December 9, 2025. All existing classic tokens revoked. Cannot create new ones.
- **`always-auth` in .npmrc:** Deprecated by npm, no longer needed with OIDC.
- **`NPM_TOKEN` GitHub secret pattern:** No longer works. Replace with `permissions: id-token: write` in workflow.

## Current State: Published vs Unpublished

| Package | npm Status | Version | Notes |
|---------|-----------|---------|-------|
| @oraclaw/bandit | Published | 1.0.0 | Raw TS source, needs rebuild + republish as 1.1.0 |
| @oraclaw/calibrate | Published | 1.0.0 | Raw TS source, needs rebuild + republish as 1.1.0 |
| @oraclaw/decide | Published | 1.0.0 | Raw TS source, needs rebuild + republish as 1.1.0 |
| @oraclaw/graph | Published | 1.0.0 | Raw TS source, needs rebuild + republish as 1.1.0 |
| @oraclaw/solver | Published | 1.0.0 | Raw TS source, needs rebuild + republish as 1.1.0 |
| @oraclaw/anomaly | NOT published | -- | First publish needed |
| @oraclaw/bayesian | NOT published | -- | First publish needed |
| @oraclaw/cmaes | NOT published | -- | First publish needed |
| @oraclaw/ensemble | NOT published | -- | First publish needed |
| @oraclaw/evolve | NOT published | -- | First publish needed |
| @oraclaw/forecast | NOT published | -- | First publish needed |
| @oraclaw/pathfind | NOT published | -- | First publish needed |
| @oraclaw/risk | NOT published | -- | First publish needed |
| @oraclaw/simulate | NOT published | -- | First publish needed |
| @oraclaw/mcp-server | NOT published | -- | First publish needed |

**Workspace membership:**
- SDK packages (`packages/sdk/*`): NOT workspace members (nested too deep for `packages/*` glob)
- MCP server (`packages/mcp-server`): IS a workspace member

**npm auth status:** Expired (E401). Must run `npm login` in browser before any publishing.

## Version Strategy

**For 5 already-published packages (bandit, calibrate, decide, graph, solver):**
- Currently at 1.0.0 with raw TypeScript source
- Bump to 1.1.0 with compiled JavaScript output
- This is a minor version bump: the API is identical, but the distribution format changed (TS -> JS)
- Cannot republish 1.0.0 (npm immutability)

**For 9 unpublished packages + mcp-server:**
- Publish at 1.0.0 with compiled JavaScript output

## Publish Workflow Strategy

**Recommendation: `workflow_dispatch` (manual trigger)**
Rationale:
- Publishing is not something that should happen on every push
- Tag-based triggers add version management complexity with 15 packages
- Manual dispatch gives explicit control over when packages are published
- Can add tag-based automation later when version strategy matures
- The existing `release.yml` is for the API/Docker image, not SDK packages -- keep them separate

**Workflow file:** Create new `publish-packages.yml` (not extend `release.yml`)

## Open Questions

1. **npm scope registration**
   - What we know: The @oraclaw scope clearly exists (5 packages already published under it by `lukastan`)
   - What's unclear: Whether it's a user scope or org scope
   - Recommendation: No action needed -- scope is already working

2. **READMEs for 9 unpublished packages**
   - What we know: Only the 5 published packages have READMEs. The 9 unpublished ones do not.
   - What's unclear: Whether to generate READMEs before publishing
   - Recommendation: Generate minimal READMEs for all 9 packages (npm shows README on package page). Keep them short -- just description, install command, and usage example.

3. **MCP server peerDependencies on tsx**
   - What we know: Current package.json has `"peerDependencies": { "tsx": "^4.0.0" }`
   - What's unclear: After compiling to JS, tsx is no longer needed at runtime
   - Recommendation: Remove the tsx peerDependency since the compiled JS runs directly with node

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.0.18 |
| Config file | `mission-control/vitest.config.ts` |
| Quick run command | `cd mission-control && npx vitest run` |
| Full suite command | `cd mission-control && npx vitest run --reporter=verbose` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DIST-01 | SDK packages build to valid JS + .d.ts | unit | `cd mission-control && node -e "for(const p of ['bandit','anomaly','bayesian','calibrate','cmaes','decide','ensemble','evolve','forecast','graph','pathfind','risk','simulate','solver']){const j=require('./packages/sdk/'+p+'/dist/index.js');console.log(p+': OK')}"` | No -- Wave 0 |
| DIST-01 | SDK packages have correct package.json fields | unit | `cd mission-control && node -e "..."` (validate main, types, files, exports fields) | No -- Wave 0 |
| DIST-02 | MCP server builds to executable JS with shebang | unit | `cd mission-control && head -1 packages/mcp-server/dist/index.npm.js | grep '#!/usr/bin/env node'` | No -- Wave 0 |
| DIST-02 | MCP server starts and lists tools | smoke | `cd mission-control && echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | timeout 5 node packages/mcp-server/dist/index.npm.js` | No -- Wave 0 |
| DIST-04 | Publish workflow YAML is valid | manual-only | Review `.github/workflows/publish-packages.yml` for correct OIDC permissions | N/A |

### Sampling Rate
- **Per task commit:** `cd mission-control && npx vitest run`
- **Per wave merge:** Full test suite + manual build verification
- **Phase gate:** All 15 packages verified installable via `npm info`

### Wave 0 Gaps
- [ ] Build verification script that checks all 14 SDK packages compile correctly
- [ ] MCP server smoke test (start + list tools via stdin/stdout JSON-RPC)
- [ ] Package.json field validation script (main, types, files, exports, publishConfig)

## Sources

### Primary (HIGH confidence)
- npm registry queries (`npm view @oraclaw/*`) -- verified 5 published, 9+1 unpublished
- Codebase analysis -- verified workspace globs, package.json contents, source file structure
- [npm Trusted Publishing docs](https://docs.npmjs.com/trusted-publishers/) -- OIDC setup requirements
- [npm Provenance docs](https://docs.npmjs.com/generating-provenance-statements/) -- `--provenance` flag

### Secondary (MEDIUM confidence)
- [Phil Nash blog on trusted publishing gotchas](https://philna.sh/blog/2026/01/28/trusted-publishing-npm/) -- per-package configuration, provenance flag requirement
- [GitHub Changelog: npm OIDC GA](https://github.blog/changelog/2025-07-31-npm-trusted-publishing-with-oidc-is-generally-available/) -- npm CLI v11.5.1+ requirement
- [AI Hero: Publish MCP server to npm](https://www.aihero.dev/publish-your-mcp-server-to-npm) -- MCP server package.json pattern with bin + shebang
- [Mastra MCP publishing guide](https://mastra.ai/docs/mcp/publishing-mcp-server) -- shebang prepending in build step
- [setup-npm-trusted-publish](https://github.com/azu/setup-npm-trusted-publish) -- first-publish limitation for OIDC

### Tertiary (LOW confidence)
- Node 22 ships npm 10 (not 11) -- GitHub issue discussions suggest this but exact bundled version varies by minor release. CI workflow should always install npm@latest to be safe.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - tsc is already in the monorepo, npm OIDC is well-documented
- Architecture: HIGH - codebase directly inspected, workspace membership verified, all package.json files read
- Pitfalls: HIGH - verified against actual npm registry state and npm CLI behavior
- OIDC setup: MEDIUM - documented from official sources but not yet tested in this repo's CI

**Research date:** 2026-03-30
**Valid until:** 2026-04-30 (npm OIDC is stable; tsc and package.json patterns are long-lived)
