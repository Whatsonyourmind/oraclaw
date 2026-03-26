# OraClaw Launch PRD — Sequential Execution Plan

**Date**: March 26, 2026
**Owner**: Luka Stanisljevic
**Status**: IN PROGRESS — blocked on browser auth

---

## Problem Statement

OraClaw has 19 algorithms, 945 passing tests, green CI, 14 SDK packages, 14 ClawHub skills, an MCP server, LangChain wrappers, and 10 outreach messages sent to real GitHub targets (26K+ stars reached). But **nothing is actually live**:

- API: Render service not responding (build/config issue)
- npm: 0/14 packages published (token can't publish)
- ClawHub: 0/14 skills published (not logged in)
- Outreach: 10 messages sent with broken links and non-functional install commands

One developer (hideya, langchain-mcp-tools-py, 27★) already responded positively and asked for npm publishing. The Figma-Context-MCP maintainer (13.9K★) closed the issue. Every hour we delay, credibility erodes.

---

## Success Criteria

1. `curl https://oraclaw-api.onrender.com/api/v1/health` returns 200 with 19 algorithms listed
2. `npm view @oraclaw/mcp-server` shows published package
3. `npx @oraclaw/mcp-server` starts and connects to live API
4. All 14 SDK packages installable from npm
5. All 14 ClawHub skills discoverable via `clawhub search oraclaw`
6. hideya gets a follow-up comment with working npm install command
7. All outreach issue links resolve (no 404s)

---

## Phase 1: Browser Authentication (PREREQUISITE — needs user)

All subsequent phases require authenticated browser sessions. Use Chrome extension (claude-in-chrome) or Playwright.

### Step 1.1: npm Login
- Navigate to `https://www.npmjs.com/login`
- Sign in as `lukastan`
- Complete CLI auth at: `npm login --auth-type=web` (CLI generates URL, browser approves)
- **Verify**: `npm profile get` returns user info (not 403)
- **Verify**: `npm publish` no longer returns 2FA error

### Step 1.2: Render Dashboard Access
- Navigate to `https://dashboard.render.com`
- Sign in via GitHub OAuth
- **Verify**: Can see oraclaw-api service

### Step 1.3: ClawHub Login
- Run `clawhub login` (opens browser)
- Approve in browser
- **Verify**: `clawhub whoami` returns username

### Step 1.4: Fly.io Login (backup if Render fails)
- Run `flyctl auth login` (opens browser)
- Sign in via GitHub
- **Verify**: `flyctl auth whoami` returns username

---

## Phase 2: Fix Render Deployment (API must be live first)

The API must be live before publishing packages (packages call the API).

### Step 2.1: Check Render Dashboard
- Navigate to `https://dashboard.render.com/web/srv-d71jk87diees73f4be50/events`
- Check build logs for errors
- Verify settings:
  - **Repo**: `Whatsonyourmind/oraclaw-core` (PRIVATE — has algorithm source)
  - **Branch**: `master`
  - **Root Directory**: `mission-control`
  - **Build Command**: `npm install && npm install -g tsx`
  - **Start Command**: `tsx apps/api/src/server.ts`
  - **Node version**: 20+
  - Remove any hardcoded PORT env var (Render injects its own)

### Step 2.2: Trigger Deploy
- Click "Clear build cache & deploy"
- Monitor build logs in real-time
- If build fails: read error, fix locally, push to `core`, re-deploy

### Step 2.3: Verify API
- `curl https://oraclaw-api.onrender.com/health` → `{"status":"ok","service":"oraclaw-api"}`
- `curl https://oraclaw-api.onrender.com/api/v1/health` → 19 algorithms, v2.3.0
- `curl -X POST https://oraclaw-api.onrender.com/api/v1/optimize/bandit -H "Content-Type: application/json" -d '{"arms":[{"id":"a","name":"A","pulls":10,"totalReward":7},{"id":"b","name":"B","pulls":10,"totalReward":5}]}'` → returns selected arm

### Step 2.4: Backup — Deploy on Fly.io
If Render can't be fixed:
- `cd mission-control && flyctl launch --name oraclaw-api --region fra`
- Create Dockerfile or use `flyctl deploy` with buildpacks
- Update all API URLs to new Fly.io domain

---

## Phase 3: Publish npm Packages

### Step 3.1: Publish MCP Server
```bash
cd packages/mcp-server && npm publish --access public
```
- **Verify**: `npm view @oraclaw/mcp-server`
- **Verify**: `npx @oraclaw/mcp-server` starts without error

### Step 3.2: Publish All 14 SDK Packages
```bash
bash scripts/publish-all-npm.sh
```
Packages: bandit, solver, decide, graph, calibrate, simulate, evolve, bayesian, ensemble, risk, pathfind, forecast, anomaly, cmaes

- **Verify**: `npm view @oraclaw/bandit` for each

### Step 3.3: Update SDK base URLs
If API URL changed from `oraclaw-api.onrender.com`, update all SDK packages:
- `packages/sdk/*/src/index.ts` — update default `baseUrl`
- Bump version to 1.0.1 and republish

---

## Phase 4: Publish ClawHub Skills

### Step 4.1: Login
```bash
clawhub login
```

### Step 4.2: Publish All 14 Skills
```bash
bash scripts/publish-all-clawhub.sh
```
Skills: oraclaw-bandit through oraclaw-cmaes

- **Verify**: `clawhub search oraclaw` returns all 14

---

## Phase 5: Fix Outreach Links & Follow Up

### Step 5.1: Reply to hideya (DONE — replied with correct URLs + npm ETA)

### Step 5.2: Update All Outreach Issues with Working Links
For each of the 10 issues, add a comment with:
- Working `npx @oraclaw/mcp-server` command
- Working API health endpoint
- Correct GitHub file URLs (with `mission-control/` prefix)

Issues to update:
1. neonone123/moltdirectory#9
2. xiaotonng/lc2mcp#11
3. hideya/langchain-mcp-tools-py#51 (add npm link once published)
4. strnad/CrewAI-Studio#112
5. lemony-ai/cascadeflow#178
6. kukapay/binance-alpha-mcp#2
7. tonykipkemboi/trip_planner_agent#5
8. Oscarling/openclaw-team#106
9. GLips/Figma-Context-MCP#309 (CLOSED — skip or reopen?)
10. hangwin/mcp-chrome#318

### Step 5.3: Re-open Figma-Context-MCP Issue (optional)
- Only if everything is working perfectly
- More professional to open a new, concise issue with working links

---

## Phase 6: Verify End-to-End

### Step 6.1: Full Integration Test
```bash
# API responds
curl https://oraclaw-api.onrender.com/api/v1/health

# npm package works
npx @oraclaw/mcp-server &  # starts MCP server
# (kill after verify)

# SDK works
node -e "const {OraBandit} = require('@oraclaw/bandit'); console.log('OK')"

# ClawHub discoverable
clawhub search oraclaw
```

### Step 6.2: README Links Check
- All links in `README.md` resolve (no 404)
- API endpoint examples work
- npm install commands work

---

## Architecture Notes

### Public vs Private Repo
- **oraclaw** (PUBLIC): SDKs, skills, README, LangChain wrappers, MCP server (API-calling version)
- **oraclaw-core** (PRIVATE): Full codebase with 18 algorithm source files, all tests, API routes

### .gitignore Strategy
- `.gitignore` blocks algorithm `.ts` files and `api-public.ts`
- Private repo uses `git add -f` to force-track these files
- Never push algorithm commit to `origin` (public), only to `core` (private)

### Key Files
- `apps/api/src/server.ts` — Lightweight Fastify entry point (async main wrapper)
- `apps/api/src/routes/oracle/api-public.ts` — 18 public API endpoints
- `packages/mcp-server/src/index.npm.ts` — API-calling MCP server for npm
- `packages/mcp-server/src/index.ts` — Local MCP server (imports algorithms directly)
- `packages/sdk/*` — 14 thin API client packages
- `packages/clawhub-skills/*` — 14 skill definitions with SKILL.md
- `scripts/publish-all-npm.sh` — Batch npm publish
- `scripts/publish-all-clawhub.sh` — Batch ClawHub publish
- `integrations/langchain/oraclaw_tools.py` — 6 LangChain tool wrappers

---

## Timeline

| Phase | Duration | Depends On |
|-------|----------|------------|
| 1. Browser Auth | 5 min | User present at keyboard |
| 2. Render Fix | 10-15 min | Phase 1.2 |
| 3. npm Publish | 5 min | Phase 1.1 + Phase 2 |
| 4. ClawHub Publish | 5 min | Phase 1.3 |
| 5. Fix Outreach | 10 min | Phase 2 + Phase 3 |
| 6. Verify E2E | 5 min | All above |
| **TOTAL** | **~45 min** | |

---

## Blockers Log

| Blocker | Root Cause | Fix |
|---------|-----------|-----|
| npm 403 on publish | Granular token missing "bypass 2FA" flag | `npm login --auth-type=web` for session token |
| Render not responding | server.ts had top-level await in CJS mode | FIXED — wrapped in async main(). Dashboard config needs verification |
| CI red badges | Algorithm files missing from repos + flaky Monte Carlo test | FIXED — all 945 tests pass, CI green on private repo |
| Outreach 404 links | URLs missing `mission-control/` prefix | FIXED in reply to hideya, need to update other issues |
| ClawHub not logged in | CLI needs browser auth | `clawhub login` |
| Playwright no sessions | Isolated browser has no saved cookies/sessions | Use Chrome extension (claude-in-chrome) instead, or user authenticates via passkey |
