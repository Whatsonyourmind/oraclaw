# GTM Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship 5 GTM improvements that convert the 82 GitHub comments and 5 Moltbook posts into actual users: enhanced playground, API analytics, blog post, social proof, feedback link.

**Architecture:** Enhance existing Next.js 16 web dashboard (React 19, Tailwind, dark theme) and Fastify 5.8.4 API. Leverage existing components (TryItForm, algorithm metadata, examples) and DB schema (oracle_analytics_events).

**Tech Stack:** Next.js 16, React 19, Tailwind CSS, Fastify 5.8.4, PostgreSQL

---

### Task 1: Enhanced Playground Page

Enhance the existing `/try/[algorithm]` experience with pre-filled scenario buttons, auto-generated curl commands, and MCP config snippet.

**Files:**
- Modify: `web/app/try/[algorithm]/page.tsx`
- Modify: `web/components/TryItForm.tsx`
- Create: `web/components/CurlCommand.tsx`
- Create: `web/components/McpConfig.tsx`
- Create: `web/components/ScenarioButtons.tsx`

**What to build:**
- ScenarioButtons: 3 pre-filled scenarios per algorithm (click to auto-fill the input)
- CurlCommand: auto-generated curl command from current input (copy button)
- McpConfig: "Add to Claude Code" JSON snippet with copy button
- Wire into existing TryItForm flow

### Task 2: API Analytics Middleware

Wire up the existing `oracle_analytics_events` DB table with an onResponse hook.

**Files:**
- Create: `mission-control/apps/api/src/middleware/analytics.ts`
- Modify: `mission-control/apps/api/src/server.ts` (register hook)

**What to build:**
- `createAnalyticsHook()` factory function (fire-and-forget pattern)
- Logs: endpoint, method, status, duration_ms, tier, billingPath, user_agent, ip
- Registered as onResponse hook in the existing pipeline

### Task 3: Blog Route + "Why Agents Should Never Do Math" Post

Create blog routing and publish the existing content plus a new thesis post.

**Files:**
- Create: `web/app/blog/page.tsx` (blog index)
- Create: `web/app/blog/[slug]/page.tsx` (blog post renderer)
- Create: `web/content/why-agents-should-never-do-math.md` (new post)
- Modify: `web/app/layout.tsx` (add Blog nav link)

**What to build:**
- Blog index listing all posts with title, date, excerpt
- Markdown renderer for individual posts
- New "Why AI Agents Should Never Do Math" post (thesis piece)
- Nav link in header

### Task 4: Social Proof on Landing Page

Add testimonial quotes from real community interactions.

**Files:**
- Modify: `web/app/page.tsx` (add testimonials section)

**What to build:**
- Testimonials section after features grid with real quotes:
  - LunarLaurus: "Oraclaw looks pretty impressive though!"
  - SwapTrade/OthmanImam: "This is awesome. Looking forward to have you in the next wave"
  - taidarilla: "Math that doesn't need to be re-done by every agent who needs it is surprisingly rare infrastructure"
  - Nickalus12: contributed MCP setup improvements

### Task 5: README Feedback Link

Add "What are you building?" link to README.

**Files:**
- Modify: `README.md`

**What to build:**
- New section after Source Code table: "Building with OraClaw? Tell us what you're working on" linking to GitHub Discussions #1 (What should we build next?)
