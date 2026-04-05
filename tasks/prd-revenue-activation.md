# PRD: OraClaw Revenue Activation — From $0 to First Dollar in 30 Days

## Introduction

OraClaw has a production-grade product (19 algorithms, 1,076 tests, <25ms latency, AAA Glama rating) and organic traction (557 npm downloads/week, 213 git clones, 7 stars, 16 active multi-turn conversations). Revenue is $0. External API calls are 0. The billing infrastructure code is fully built but not operational on Render.

This PRD addresses seven interconnected strategic gaps identified in the April 4 evaluation:

1. **Billing is broken** — Stripe/Unkey env vars not set on Render, users literally cannot pay
2. **MCP server has no monetization hook** — the #1 product (203 downloads/wk) runs locally, never hits the API
3. **5 hot leads are not being closed** — juliosuas, radoxtech, hideya, vstash, heisenberg need direct engagement
4. **Too many channels, zero traction** — 20 articles across 3 platforms with near-zero engagement
5. **Dify plugin not shipped** — highest-leverage intent-rich discovery channel is missing
6. **Peer credibility gap** — no merged contributions to established repos
7. **Operational discipline** — still doing things that don't work (volume commenting, content spraying)

**Core thesis**: The engineering is done. Every hour spent building new features is an hour not spent getting the first paying customer.

---

## Goals

- First revenue (any amount, Stripe or x402) within 30 days
- 5+ API signups with keys issued within 14 days
- 1+ paying customer (converted from free to paid tier) within 30 days
- MCP server premium tools generating API key signups within 21 days
- Close at least 2 of 5 hot leads into active users with API keys
- Reddit r/ClaudeAI post live by Day 14, Show HN by Day 28
- Dify plugin published and discoverable within 21 days
- 1 merged PR to an established open-source repo (Ravenwater's universal) within 14 days
- Zero new reputation damage (0 flagged/deleted comments for 30 days)

---

## Workstream 1: Billing Infrastructure Activation

**Problem**: The full billing stack exists in code (stripe.ts 665 lines, unkey.ts 79 lines, provision.ts 241 lines, signup.ts 104 lines) but env vars are not set on Render. A motivated user cannot pay today.

**Existing code to leverage**:
- `mission-control/apps/api/src/services/billing/stripe.ts` — Complete Stripe SDK wrapper
- `mission-control/apps/api/src/services/billing/provision.ts` — Auto-provisions products/prices/webhook on boot
- `mission-control/apps/api/src/services/billing/tiers.ts` — Tier config SSoT
- `mission-control/apps/api/src/services/unkey.ts` — API key creation with tier-based rate limits
- `mission-control/apps/api/src/routes/auth/signup.ts` — Self-service signup endpoint
- `mission-control/apps/api/src/routes/billing/subscribe.ts` — Checkout session creation
- `mission-control/apps/api/src/routes/billing/webhook.ts` — Stripe event handler
- `mission-control/apps/api/src/hooks/meter-usage.ts` — Stripe metered billing events

### US-101: Configure Stripe on Render Production

**Description**: As the operator, I need Stripe env vars set on Render so the billing system initializes on boot.

**Acceptance Criteria**:
- [ ] Create Stripe products and prices in the Stripe Dashboard (or verify auto-provisioning creates them on boot)
- [ ] Set `STRIPE_SECRET_KEY` on Render (live key, not test)
- [ ] Set `STRIPE_PUBLISHABLE_KEY` on Render
- [ ] Set `STRIPE_WEBHOOK_SECRET` on Render (provisioned by `provision.ts` on boot, then persist the value)
- [ ] Set `STRIPE_METER_EVENT_NAME=api_calls` on Render
- [ ] Set `STRIPE_BATCH_METER_EVENT_NAME=api_calls_batch` on Render
- [ ] Set `STRIPE_PRICE_PAY_PER_CALL`, `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_GROWTH`, `STRIPE_PRICE_SCALE` on Render (from auto-provisioned prices)
- [ ] Set `PORTAL_RETURN_URL` on Render
- [ ] Verify `GET /health` returns `billing.stripe: true` after deploy
- [ ] Verify auto-provisioning log shows "Stripe products provisioned" or "Products already exist"

### US-102: Configure Unkey on Render Production

**Description**: As the operator, I need Unkey configured so API keys can be issued to users.

**Acceptance Criteria**:
- [ ] Create Unkey account and workspace at unkey.com
- [ ] Create an API in Unkey dashboard (record the API ID)
- [ ] Set `UNKEY_ROOT_KEY` on Render
- [ ] Set `UNKEY_API_ID` on Render
- [ ] Verify `GET /health` returns `billing.unkey: true` after deploy
- [ ] Test: `POST /api/v1/auth/signup` with `{ "email": "test@example.com" }` returns an API key

### US-103: Configure x402 for Mainnet USDC Payments

**Description**: As the operator, I need x402 on mainnet so machine-to-machine USDC payments work.

**Acceptance Criteria**:
- [ ] Set `RECEIVING_WALLET_ADDRESS` on Render (Base USDC wallet: `0x450996401D587C8206803F544cCA74C33f6FbC93`)
- [ ] Set `X402_NETWORK=eip155:8453` on Render (Base mainnet, NOT Sepolia testnet)
- [ ] Set `X402_PRICE_PER_CALL=$0.001` on Render
- [ ] Set `X402_FACILITATOR_URL=https://x402.org/facilitator` on Render
- [ ] Verify `GET /health` returns `billing.x402: true` after deploy

### US-104: End-to-End Billing Smoke Test

**Description**: As the operator, I need to verify the complete signup-to-payment flow works with real Stripe test mode before going live.

**Acceptance Criteria**:
- [ ] Call `POST /api/v1/auth/signup` with a real email — receive API key
- [ ] Call `POST /api/v1/optimize/bandit` with the API key in Authorization header — receive result with `_meta.tier` and `_meta.calls_remaining`
- [ ] Call `POST /api/v1/billing/subscribe` with `{ "tier": "starter" }` — receive `checkout_url`
- [ ] Open checkout_url in browser — Stripe Checkout page loads with correct price ($9/mo)
- [ ] Complete test purchase with Stripe test card `4242424242424242`
- [ ] Verify webhook fires and subscription status updates
- [ ] Call `POST /api/v1/billing/portal-session` — receive portal URL
- [ ] Open portal URL — Stripe Customer Portal loads showing active subscription
- [ ] Verify metered billing: make 5 API calls, check Stripe Dashboard for meter events
- [ ] Verify usage headers: `X-RateLimit-Remaining` decrements correctly

### US-105: Fix Known Broken Endpoints

**Description**: As a user, I need all 17 algorithm endpoints to return valid results so my first experience isn't a 500 error.

**Acceptance Criteria**:
- [ ] `POST /api/v1/solve/schedule` returns 200 with valid schedule (was returning 500 per GROWTH_PLAN.md)
- [ ] `POST /api/v1/score/convergence` returns non-null scores (was returning nulls per GROWTH_PLAN.md)
- [ ] Run full test suite — all 1,076 tests pass
- [ ] Manual smoke test of all 17 endpoints on production Render URL with sample payloads
- [ ] Document any remaining issues

---

## Workstream 2: MCP Server Premium Gating

**Problem**: The MCP server (203 downloads/week, #1 package) runs locally via `index.npm.ts` which makes HTTP calls to the hosted API. But all 12 tools are available without an API key because the API falls back to the free tier (25 calls/day IP-based). Users get full value locally and never need to sign up. There is no monetization hook in the primary product.

**Architecture decision**: Hard gate — 8 tools free, 4 premium tools require an API key. Premium tools are chosen based on differentiation (no competitor offers these as MCP tools):

| Tool | Tier | Rationale |
|------|------|-----------|
| `optimize_bandit` | Free | Gateway drug, commodity |
| `optimize_contextual` | Free | Entry point to bandits |
| `solve_schedule` | Free | Practical, drives engagement |
| `score_convergence` | Free | Unique IP but lower value |
| `score_calibration` | Free | Common enough |
| `predict_forecast` | Free | Time series, commodity |
| `detect_anomaly` | Free | Anomaly detection, commodity |
| `plan_pathfind` | Free | A* pathfinding, common |
| **`solve_constraints`** | **Premium** | LP/MIP/QP via HiGHS — no other MCP server has this |
| **`analyze_decision_graph`** | **Premium** | PageRank/Louvain/critical path — unique as MCP |
| **`optimize_cmaes`** | **Premium** | CMA-ES continuous optimization — advanced |
| **`analyze_portfolio_risk`** | **Premium** | VaR/CVaR — high-value finance use case |

**Key constraint**: The npm-published MCP server (`index.npm.ts`) already makes HTTP calls to the hosted API. Gating happens at the API level, not in the MCP server code. The MCP server just needs to handle 403 responses gracefully and guide users to sign up.

### US-201: Add Tool-Level Tier Gating to API

**Description**: As a developer, I need the API to return 403 for premium tools when the request is on the free tier, so there's a reason to sign up and pay.

**Acceptance Criteria**:
- [ ] Create a `PREMIUM_TOOLS` constant in `tiers.ts` listing the 4 premium endpoint paths: `/api/v1/solve/constraints`, `/api/v1/analyze/graph`, `/api/v1/optimize/cmaes`, `/api/v1/analyze/risk`
- [ ] Add a preHandler hook (after auth middleware) that checks: if the requested path is in `PREMIUM_TOOLS` AND `request.tier === 'free'`, return 403 with RFC 9457 body:
  ```json
  {
    "type": "https://oraclaw.dev/errors/premium-required",
    "title": "Premium tool — API key required",
    "status": 403,
    "detail": "This tool requires an OraClaw API key. Sign up free at POST /api/v1/auth/signup to get instant access.",
    "signup_url": "https://oraclaw-api.onrender.com/api/v1/auth/signup",
    "tool": "solve_constraints",
    "free_tools": ["optimize_bandit", "optimize_contextual", "solve_schedule", "score_convergence", "score_calibration", "predict_forecast", "detect_anomaly", "plan_pathfind"]
  }
  ```
- [ ] Premium tools work normally for `pay_per_call`, `starter`, `growth`, `scale`, `enterprise` tiers
- [ ] Free tier users can still call the 8 free tools (25/day limit unchanged)
- [ ] Tests added: 403 on free tier for each premium tool, 200 on paid tier for each premium tool
- [ ] Existing 1,076 tests still pass

### US-202: Handle Premium Gating in MCP Server

**Description**: As an MCP server user, I need clear feedback when I try to use a premium tool without an API key, including instructions on how to sign up.

**Acceptance Criteria**:
- [ ] In `index.npm.ts`, when the API returns 403 for a premium tool, the MCP server returns a tool result with `isError: false` (so Claude doesn't retry) and a content message explaining:
  ```
  This tool requires an OraClaw API key (free signup).

  To unlock all 12 tools:
  1. Run: curl -X POST https://oraclaw-api.onrender.com/api/v1/auth/signup -H "Content-Type: application/json" -d '{"email": "you@example.com"}'
  2. Set ORACLAW_API_KEY in your MCP config

  Free tools available now: optimize_bandit, optimize_contextual, solve_schedule, score_convergence, score_calibration, predict_forecast, detect_anomaly, plan_pathfind
  ```
- [ ] The MCP tool listing (`server.listTools()`) annotates premium tools in their descriptions with `[Premium — requires API key]`
- [ ] Free tools continue working without any API key (25 calls/day via IP rate limiting)
- [ ] Telemetry still fires for both free and premium tool attempts (track demand for premium tools)

### US-203: Add Pricing Discovery Endpoint

**Description**: As a developer evaluating OraClaw, I need a pricing endpoint that explains tiers, tool access, and signup instructions.

**Acceptance Criteria**:
- [ ] `GET /api/v1/pricing` returns a JSON response with:
  - All tiers with their limits and prices (from `TIER_CONFIG`)
  - List of free tools and premium tools
  - Signup URL
  - Checkout URL template
- [ ] This endpoint is unauthenticated (no API key needed)
- [ ] The existing `GET /api/v1/pricing` endpoint at line 892 of `api-public.ts` is updated to include tool-tier mapping

### US-204: Update npm Package Descriptions for Premium Tools

**Description**: As a potential user discovering OraClaw on npm, I need the package description to mention both free tools and premium tools so I understand the value proposition.

**Acceptance Criteria**:
- [ ] `@oraclaw/mcp-server` package.json description updated to: "OraClaw Decision Intelligence — 8 free + 4 premium MCP tools for AI agents. Bandits, scheduling, forecasting free. LP solver, graph analytics, CMA-ES, portfolio risk with API key."
- [ ] README in the MCP server package updated with free vs premium tool table
- [ ] Version bumped to 1.1.0 (minor: new premium gating feature)
- [ ] Published to npm

### US-205: Publish MCP Server v1.1.0 with Gating

**Description**: As the operator, I need the updated MCP server with premium gating published to npm and all registries updated.

**Acceptance Criteria**:
- [ ] `npm publish` succeeds for `@oraclaw/mcp-server@1.1.0`
- [ ] MCP Registry entry updated (version bump)
- [ ] Glama listing reflects new version
- [ ] awesome-mcp-servers entry doesn't need updating (just a link)
- [ ] Test: install fresh via `npx @oraclaw/mcp-server` — free tools work, premium tools return signup instructions

---

## Workstream 3: Lead Conversion Program

**Problem**: 5 developers are actively using OraClaw's math or have installed packages, but none have API keys or are paying. They need direct, personalized engagement to convert.

**Approach**: Whatever it takes — free beta access to paid tier, custom integration PRs to their repos, testimonial exchange. The goal is 5 API key signups, not 5 payments. Payment comes after usage.

### US-301: Create Beta Access Program

**Description**: As the operator, I need a way to issue free premium API keys to beta users so hot leads can try all 12 tools without paying.

**Acceptance Criteria**:
- [ ] Create a `createBetaKey(email, name, notes)` function in `unkey.ts` that:
  - Creates an Unkey key with `tier: 'growth'` (16,667 calls/day)
  - Sets metadata: `{ tier: 'growth', beta: true, betaExpiry: '<30 days from now>', name, notes }`
  - Does NOT create a Stripe customer (no billing)
  - Returns the API key
- [ ] Create a CLI script `scripts/create-beta-key.ts` that can be run locally: `npx tsx scripts/create-beta-key.ts --email user@example.com --name "juliosuas" --notes "airbnb-manager #13, installed @oraclaw/bandit"`
- [ ] Script outputs the API key and a copy-pasteable onboarding message for the user
- [ ] Beta keys tracked: script logs to `beta-keys.json` (gitignored) with issue date, expiry, lead name

### US-302: Close juliosuas (Highest Priority — Only Confirmed Install)

**Description**: As the operator, I need to convert juliosuas from `@oraclaw/bandit` npm user to full API key user.

**Acceptance Criteria**:
- [ ] Create beta key for juliosuas
- [ ] Reply on GitHub issue `juliosuas/airbnb-manager#13` with:
  - Acknowledge his install of `@oraclaw/bandit`
  - Offer: "I set up a free premium API key for you — gives you access to all 12 tools including the LP scheduler (great for multi-property allocation). Want me to DM it?"
  - If he's interested, offer a PR to his repo integrating `@oraclaw/mcp-server` with the API key
- [ ] Track response in lead pipeline
- [ ] Do NOT include the API key in a public GitHub comment — offer to DM or use email

### US-303: Close radoxtech (Deepest Technical Engagement)

**Description**: As the operator, I need to convert radoxtech from "answered 7 issues" to active API user.

**Acceptance Criteria**:
- [ ] Create beta key for radoxtech
- [ ] Reply on one of the active issues (#536 context compression or #537 subagent delegation) with:
  - A technical contribution relevant to the issue
  - Mention: "BTW I set up a programmatic API for the algorithms we discussed — happy to share a free key if you want to integrate them into diricode. Zero setup, just HTTP calls."
- [ ] Track response in lead pipeline

### US-304: Close hideya (Highest Strategic Value — LangChain Ecosystem)

**Description**: As the operator, I need to convert hideya from "confirmed 12 tools work" to active collaborator and advocate.

**Acceptance Criteria**:
- [ ] Create beta key for hideya
- [ ] Reply on `langchain-mcp-tools#51` (if not already replied) with:
  - Collaboration offer: "I'd love to add OraClaw as an example integration in your repo's README — happy to submit a PR showing the 12 tools in action with langchain-mcp-tools"
  - Share beta API key privately (email or GitHub DM)
- [ ] If accepted, submit a PR to hideya's repo showing OraClaw + langchain-mcp-tools integration
- [ ] Track response in lead pipeline

### US-305: Close vstash and heisenberg (Implementation Follow-Up)

**Description**: As the operator, I need to follow up with vstash (accepted IDF approach) and heisenberg (shipped V1, collecting data for V2).

**Acceptance Criteria**:
- [ ] Create beta keys for both
- [ ] vstash: Reply on #89 asking about IDF implementation progress, offer beta key for `score_convergence` + `predict_forecast` APIs
- [ ] heisenberg: Reply on #50 asking about Brier score data collection, offer beta key for `score_calibration` API
- [ ] Track responses in lead pipeline

### US-306: Create Onboarding Email Template

**Description**: As the operator, I need a reusable onboarding message to send with beta keys.

**Acceptance Criteria**:
- [ ] Create `templates/beta-onboarding.md` with:
  - Welcome message (personalized placeholder for name + their project)
  - API key (placeholder)
  - Quick start: 3 curl examples (bandit, LP solver, graph)
  - MCP setup: 5 lines of JSON config with their API key
  - "Reply to this if you hit any issues — I'll fix them same day"
  - Explicit: "This key is free for 30 days, no credit card needed. After that, pay-per-call is $0.005/call."
- [ ] Template is <50 lines, can be copy-pasted into GitHub DM or email

---

## Workstream 4: Channel Consolidation & Staged Launch

**Problem**: 20 articles across Dev.to, Hashnode, Medium with near-zero engagement. Draft Reddit and HN posts waiting. Too many channels = zero traction on any. Need focus.

**Decision**: Kill multi-platform content spraying. Go deep on Moltbook (working) + staged high-impact launches (Reddit Day 14, HN Day 28).

### US-401: Kill Content Spraying Operations

**Description**: As the operator, I need to stop investing time in zero-ROI channels so I can focus on what works.

**Acceptance Criteria**:
- [ ] **STOP**: No new Dev.to, Hashnode, or Medium articles until first revenue
- [ ] **STOP**: No more than 3 GitHub comments per day (pure math only, zero product mentions)
- [ ] **STOP**: No new npm packages or features
- [ ] **CONTINUE**: 1 Moltbook TIL per day + engage on 2-3 trending posts (57 karma, growing)
- [ ] **CONTINUE**: Reply to every inbound message within 24h (GitHub, Moltbook DMs, email)
- [ ] Document these rules in a `launch/OPERATING-RULES.md` file for reference

### US-402: Prepare Reddit r/ClaudeAI Launch (Day 14)

**Description**: As the operator, I need the Reddit launch post ready to go live once billing works and PulseMCP lists us.

**Acceptance Criteria**:
- [ ] Update `launch/reddit-claudeai-v3.md` draft to reflect:
  - Premium gating (mention free tools + premium tools)
  - Working signup flow (include real curl to `/api/v1/auth/signup`)
  - Mention Glama AAA rating as social proof
  - Mention specific use case: "LP solver as MCP tool — no other server does this"
- [ ] **Pre-conditions before posting**: (a) billing works end-to-end, (b) MCP server v1.1.0 published with gating, (c) PulseMCP listing live OR Glama link available
- [ ] Post format: "Show r/ClaudeAI" style, lead with problem ("your AI agent hallucinates math"), show solution (MCP tools), include `npx @oraclaw/mcp-server` setup
- [ ] Prepare 5 comment replies for likely questions: "how is this different from X?", "is this free?", "what algorithms?", "can I self-host?", "is this AI-generated?"

### US-403: Prepare Show HN Launch (Day 28)

**Description**: As the operator, I need the HN launch post ready for Day 28, incorporating learnings from the Reddit launch.

**Acceptance Criteria**:
- [ ] Write `launch/show-hn-draft.md` with HN-specific formatting:
  - Title: "Show HN: MCP tools that give AI agents real math (bandits, LP solver, graph analytics)"
  - Body: Technical focus, mention HiGHS WASM LP solver, zero-dependency pure TS algorithms
  - Emphasize what's novel: "first MCP server with production LP/MIP solver"
  - Include performance numbers: "14/18 algorithms under 1ms, CMA-ES achieves 6e-14 on Rosenbrock"
  - Link to GitHub repo, not API docs
- [ ] **Pre-conditions before posting**: (a) Reddit post has been live for 7+ days with no major issues, (b) at least 1 paying customer OR 5 active beta users, (c) Dify plugin published
- [ ] Prepare for HN-specific challenges: "why not just use scipy?", "this is a wrapper", "AI slop"
- [ ] Schedule for Tuesday-Thursday 9-11am ET (optimal HN timing)

### US-404: Check and Respond to Moltbook DMs and Replies

**Description**: As the operator, I need to check 20 unread comment replies and 2 pending DM requests on Moltbook, which may contain high-value collaboration inquiries.

**Acceptance Criteria**:
- [ ] Check Moltbook dashboard at https://www.moltbook.com/humans/dashboard
- [ ] Read and respond to all 20 unread comment replies
- [ ] Read and respond to 2 pending DM requests (may be from han-sajang or libre-coordinator)
- [ ] If any DMs contain collaboration proposals, evaluate and respond
- [ ] Update lead pipeline with any new leads discovered

---

## Workstream 5: Dify Plugin

**Problem**: Dify (langgenius/dify-plugins, 466 stars) is a low-code agent builder where users actively browse for optimization tools. A Dify plugin puts OraClaw in front of intent-rich users — people searching "how do I add optimization to my agent." FlowiseAI (51K stars) is even larger but @leomerida15 is already building that integration.

### US-501: Research Dify Plugin Format

**Description**: As the developer, I need to understand the `.difypkg` format and plugin publishing process before building.

**Acceptance Criteria**:
- [ ] Read `langgenius/dify-plugins` repo README and contribution guide
- [ ] Identify the plugin manifest format (`.difypkg` structure)
- [ ] Identify required fields: name, description, icon, tools, auth
- [ ] Review 2-3 existing Dify plugins as reference implementations
- [ ] Document findings in `launch/dify-plugin-research.md`

### US-502: Build Dify Plugin with 5 Hero Tools

**Description**: As a Dify user, I need an OraClaw plugin that gives me 5 algorithm tools in my Dify workspace.

**Acceptance Criteria**:
- [ ] Plugin exposes 5 tools (highest value for Dify's agentic workflow use case):
  1. `optimize_bandit` — "Which option should my agent pick?"
  2. `solve_constraints` — "How should my agent allocate resources?" (premium)
  3. `analyze_decision_graph` — "What are the most important nodes?" (premium)
  4. `predict_forecast` — "What will happen next?"
  5. `detect_anomaly` — "Is this data point unusual?"
- [ ] Plugin requires `ORACLAW_API_KEY` in auth configuration
- [ ] Plugin makes HTTP calls to `https://oraclaw-api.onrender.com/api/v1/*`
- [ ] Plugin includes clear descriptions for each tool parameter
- [ ] Plugin icon uses OraClaw branding (OODA loop colors)
- [ ] Plugin tested locally with Dify self-hosted instance (or documented setup for testing)

### US-503: Publish Dify Plugin

**Description**: As the operator, I need the Dify plugin published to the dify-plugins marketplace.

**Acceptance Criteria**:
- [ ] Submit PR to `langgenius/dify-plugins` with the plugin package
- [ ] PR description includes: what OraClaw does, 5 tool descriptions, example use case
- [ ] Plugin passes any automated checks in the Dify plugin CI
- [ ] Follow up on PR review within 24h

### US-504: Support FlowiseAI Integration

**Description**: As the operator, I need to support @leomerida15 who is actively building MCP skills integration in FlowiseAI.

**Acceptance Criteria**:
- [ ] Check status of FlowiseAI #5601 for latest updates
- [ ] If @leomerida15 needs testing help, provide: API key, sample payloads, expected responses
- [ ] If integration is ready, test it and provide feedback
- [ ] Offer a beta key for @leomerida15's testing

---

## Workstream 6: Peer Credibility via Open-Source Contribution

**Problem**: OraClaw has zero merged contributions to established open-source repos. This matters because developers evaluate credibility by looking at contribution history. A merged PR to a 491-star repo signals "this person knows what they're doing" more than 200 GitHub comments.

### US-601: Contribute to Ravenwater's universal #196

**Description**: As a contributor, I want to submit a high-quality PR to `stillwater-sc/universal` (491 stars, HPC universal number arithmetic) to build peer credibility with Theodore Omtzigt (Ravenwater), who starred OraClaw.

**Acceptance Criteria**:
- [ ] Read issue #196 on `stillwater-sc/universal` — understand the unum Type I visualization request
- [ ] Fork the repo and create a feature branch
- [ ] Implement the requested feature (likely a visualization or test utility for unum types)
- [ ] Ensure all existing tests pass
- [ ] Submit PR with clear description referencing issue #196
- [ ] PR is pure math/code — zero mention of OraClaw
- [ ] Follow up on reviewer feedback within 24h
- [ ] Track in lead pipeline: if merged, Ravenwater becomes Tier 1 peer relationship

### US-602: Retry Smithery Web Publish

**Description**: As the operator, I need OraClaw listed on Smithery (MCP marketplace) since the CLI publish failed on Windows.

**Acceptance Criteria**:
- [ ] Go to smithery.ai and attempt web-based publishing
- [ ] Provide: npm package name (`@oraclaw/mcp-server`), description, 12 tool listing
- [ ] If web publish succeeds, verify listing is live
- [ ] If web publish also fails, document the error and move on (not blocking)

---

## Workstream 7: Operational Discipline

**Problem**: The first 3 days of GTM (Apr 1-3) generated 9 repos of reputation damage from volume commenting and promotional links. The strategy pivot to "pure math, zero product mentions" is working (29 expert replies on Apr 4 with zero flags) but needs to be codified as permanent operating rules.

### US-701: Create Operating Rules Document

**Description**: As the operator, I need a permanent reference document that codifies what works and what doesn't, so no future session repeats the mistakes.

**Acceptance Criteria**:
- [ ] Create `launch/OPERATING-RULES.md` with:
  - **NEVER**: Include product links, curls, or package imports in GitHub comments
  - **NEVER**: Comment on repos where a maintainer has flagged us (list all 9)
  - **NEVER**: Post on closed issues or maintainer-only threads
  - **NEVER**: Open issues to promote OraClaw on other repos
  - **MAX 3**: GitHub comments per day (pure math, hand-crafted per issue)
  - **MAX 1**: Moltbook TIL per day + 2-3 trending post engagements
  - **ALWAYS**: Reply to inbound messages within 24h
  - **ALWAYS**: Check lead pipeline before starting outreach
  - **ALWAYS**: Verify billing is operational before any launch post
- [ ] List all 9 permanently banned repos/orgs with reasons
- [ ] Reference the feedback memory for detailed reasoning

### US-702: Create Lead Pipeline Tracking System

**Description**: As the operator, I need a simple way to track leads across sessions without relying on memory files.

**Acceptance Criteria**:
- [ ] Create `launch/LEAD-TRACKER.md` with a table for each lead:
  - Name, platform, tier (HOT/WARM/MONITORING), last contact date, next action, beta key issued (Y/N), API calls made
- [ ] Seed with current 5 HOT + 14 WARM leads from memory
- [ ] Include instructions: "Update this file after every lead interaction"
- [ ] This file is the single source of truth — memory files are supplementary context

### US-703: Create 30-Day Execution Calendar

**Description**: As the operator, I need a day-by-day execution calendar so every session knows exactly what to do.

**Acceptance Criteria**:
- [ ] Create `launch/CALENDAR.md` with daily actions for 30 days:

**Week 1 (Days 1-7): Foundation**
  - Day 1: US-101 + US-102 + US-103 (billing infrastructure)
  - Day 2: US-104 (billing smoke test) + US-105 (fix broken endpoints)
  - Day 3: US-201 + US-202 (premium gating API + MCP server)
  - Day 4: US-203 + US-204 (pricing endpoint + npm descriptions)
  - Day 5: US-205 (publish MCP server v1.1.0) + US-301 (beta key system)
  - Day 6: US-302 + US-303 (close juliosuas + radoxtech)
  - Day 7: US-304 + US-305 (close hideya + vstash + heisenberg)

**Week 2 (Days 8-14): Distribution**
  - Day 8: US-501 (Dify research) + US-601 (Ravenwater PR start)
  - Day 9: US-502 (Dify plugin build)
  - Day 10: US-503 (Dify plugin publish) + US-504 (FlowiseAI support)
  - Day 11: US-602 (Smithery retry) + US-404 (Moltbook DMs)
  - Day 12: US-402 (Reddit draft finalization)
  - Day 13: Buffer / respond to lead replies / fix any issues
  - Day 14: **Reddit r/ClaudeAI launch** (if pre-conditions met)

**Week 3 (Days 15-21): Conversion**
  - Day 15-16: Monitor Reddit, respond to every comment within 1h
  - Day 17: Analyze Reddit results, adjust messaging
  - Day 18: Follow up with any new leads from Reddit
  - Day 19: US-601 follow-up (Ravenwater PR review cycle)
  - Day 20: Check telemetry for premium tool demand, adjust gating if needed
  - Day 21: US-403 (Show HN draft)

**Week 4 (Days 22-30): Scale**
  - Day 22-24: HN prep, ensure pre-conditions met
  - Day 25-27: Buffer for lead closing, support, fixes
  - Day 28: **Show HN launch** (if pre-conditions met)
  - Day 29-30: Monitor HN, respond to comments, close leads

- [ ] Each day includes: primary task, ongoing tasks (Moltbook, reply to leads), and success criteria

---

## Functional Requirements

- FR-1: The system MUST accept Stripe payments in production (Render env vars configured and verified)
- FR-2: The system MUST issue API keys via `POST /api/v1/auth/signup` in production
- FR-3: The system MUST accept x402 USDC payments on Base mainnet
- FR-4: The API MUST return 403 for premium tools (`solve_constraints`, `analyze_decision_graph`, `optimize_cmaes`, `analyze_portfolio_risk`) when `request.tier === 'free'`
- FR-5: The API MUST allow premium tools for any paid tier (`pay_per_call`, `starter`, `growth`, `scale`, `enterprise`)
- FR-6: The MCP server MUST return a helpful signup message (not an error) when a premium tool returns 403
- FR-7: The MCP server MUST annotate premium tools in `server.listTools()` descriptions
- FR-8: The `GET /api/v1/pricing` endpoint MUST list free vs premium tools with signup instructions
- FR-9: Beta keys MUST have a 30-day expiry and `growth` tier access (16,667 calls/day)
- FR-10: All 17 API endpoints MUST return 200 with valid data (no 500s, no null scores)
- FR-11: The Dify plugin MUST expose 5 tools and require `ORACLAW_API_KEY` for auth
- FR-12: MCP server v1.1.0 MUST be published to npm with premium gating
- FR-13: Every API response on `/api/v1/*` MUST include `_meta` with tier, calls_remaining, calls_limit (already implemented)
- FR-14: Upgrade nudge MUST appear at 80%+ usage for free/pay_per_call tiers (already implemented)

---

## Non-Goals (Out of Scope)

- **No new algorithms.** 19 is enough. The product is ahead of the GTM.
- **No mobile app work.** The Expo app is not the monetization path.
- **No web dashboard features.** The Next.js dashboard is not the monetization path.
- **No new npm packages.** 15 packages is already fragmented.
- **No arXiv paper.** Defer until post-revenue.
- **No enterprise sales outreach.** Solo developer cannot support enterprise customers yet.
- **No custom domain.** `oraclaw-api.onrender.com` works fine for now.
- **No database migration.** In-memory telemetry is sufficient for the 30-day window.
- **No CI/CD changes.** The daily report workflow exists and works.
- **No refactoring.** The codebase is clean — 1,076 tests pass. Don't touch working code.

---

## Technical Considerations

### Premium Gating Implementation

The gating hook should be added to `server.ts` after the auth middleware (line ~201) and before route handlers. It checks `request.url` against `PREMIUM_TOOLS` paths and `request.tier` against allowed tiers. This is ~30 lines of code.

**Key files to modify**:
- `mission-control/apps/api/src/services/billing/tiers.ts` — Add `PREMIUM_TOOLS` constant
- `mission-control/apps/api/src/server.ts` — Add preHandler hook after auth
- `mission-control/packages/mcp-server/src/index.npm.ts` — Handle 403 responses
- `mission-control/packages/mcp-server/src/index.npm.ts` — Update tool descriptions
- `mission-control/packages/mcp-server/package.json` — Bump to 1.1.0

### Billing Configuration

The auto-provisioning system (`provision.ts`) creates Stripe products on boot. The first deploy with `STRIPE_SECRET_KEY` set will auto-create everything. The webhook secret is generated and logged — it needs to be copied to Render env vars for persistence.

### Beta Key System

The beta key script is a local-only tool. It calls `createApiKey()` from `unkey.ts` with `tier: 'growth'` and additional metadata flags. No API endpoint needed — this is operator-only tooling.

### Dify Plugin

The Dify plugin is a standalone package that makes HTTP calls to the OraClaw API. It does not share code with the MCP server. It needs its own `manifest.yaml` and tool definitions per Dify's plugin format.

---

## Success Metrics

| Metric | Current | Day 14 Target | Day 30 Target |
|--------|---------|---------------|---------------|
| Revenue | $0 | $0 (billing just working) | >$0 (any amount) |
| API signups (keys issued) | 0 | 5+ (beta keys + organic) | 10+ |
| External API calls | 0 | 50+ (from beta users) | 200+ |
| Paying customers | 0 | 0 | 1+ |
| GitHub stars | 7 | 15+ | 30+ |
| npm MCP server downloads/wk | 203 | 300+ | 500+ |
| Premium tool 403s (demand signal) | 0 | 20+ | 50+ |
| Moltbook karma | 57 | 75+ | 100+ |
| Merged OSS PRs | 0 | 1 (Ravenwater) | 1+ |
| Dify plugin published | No | No | Yes |
| Reddit post live | No | Yes | Yes |
| Show HN post live | No | No | Yes |
| Reputation incidents | 9 (cumulative) | 9 (zero new) | 9 (zero new) |

---

## Open Questions

1. **Stripe test vs live mode**: Should we do the smoke test in Stripe test mode first, then switch to live? Or go straight to live with the auto-provisioned products?
2. **Beta key expiry enforcement**: Unkey supports key expiration natively — should we set 30-day TTL at key creation, or manually revoke later?
3. **Premium tool selection**: The 4 chosen premium tools (LP solver, graph, CMA-ES, portfolio risk) are based on differentiation analysis. Should we validate with telemetry data first (run free for 7 days, see which tools get used most, then gate the popular ones)?
4. **Dify plugin approval timeline**: How long does the Dify plugin review process take? This affects the Show HN pre-condition.
5. **hideya collaboration scope**: If hideya accepts the collaboration offer, how much time can we invest in a PR to his repo? Is a full example integration (~2-4 hours) worth it?
6. **x402 demand**: Is it worth the operational complexity of x402 mainnet if the target audience (Claude Code users) don't have crypto wallets? Consider deferring x402 mainnet to post-first-Stripe-revenue.
7. **Reddit account age/karma**: Does the posting account meet r/ClaudeAI's minimum requirements? Some subreddits require minimum karma/age.

---

## Risk Register

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Stripe auto-provisioning fails on Render | Blocks all revenue | Medium | Manual product creation in Stripe Dashboard as fallback |
| Premium gating drives users away instead of converting | Kills MCP downloads | Medium | Monitor npm download trend after v1.1.0. If >20% drop in 7 days, revert to soft gating (rate limit only) |
| Reddit post gets flagged as self-promotion | Wastes launch slot | Medium | Lead with problem, not product. No pricing in post. Link to GitHub, not API. |
| Show HN gets "AI slop" comments | Negative first impression | High | Emphasize pure TypeScript, zero-dependency algorithms. Show benchmarks. Link to test suite (1,076 tests). |
| Beta users consume resources but never pay | $0 revenue, server costs | Low | 30-day expiry on beta keys. Render free tier handles the load. |
| Dify plugin PR rejected | Misses distribution channel | Medium | FlowiseAI integration via @leomerida15 as backup channel |
| Ravenwater PR takes too long / gets rejected | Wasted credibility effort | Low | Timebox to 4 hours. If blocked, contribute to another help-wanted issue. |
