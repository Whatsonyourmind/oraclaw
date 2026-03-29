# OraClaw — Revenue-Ready Launch

## What This Is

OraClaw is an AI decision intelligence platform exposing 19 ML algorithms as a paid API service. It provides multi-armed bandits, genetic algorithms, Monte Carlo simulation, Bayesian inference, graph analysis, constraint optimization, and more — all as zero-dependency HTTP endpoints. Revenue comes from two billing paths: Stripe metered billing (API keys) and x402 machine payments (USDC on Base).

## Core Value

Developers and AI agents can call production-grade decision algorithms via API and pay per use — no ML expertise required, no model training, instant results.

## Requirements

### Validated

- Validated 19 algorithms implemented and tested (945 tests passing)
- Validated API deployed on Render with 17+ public endpoints
- Validated 4 npm SDK packages published (@oraclaw/bandit, solver, decide, graph)
- Validated CI/CD pipelines green (CI + Deploy)
- Validated Performance optimizations shipped (compression, timeouts, keep-alive)
- Validated Docker multi-stage build working

### Active

- [ ] Publish remaining 10 npm SDK packages (simulate, evolve, bayesian, ensemble, risk, pathfind, forecast, anomaly, cmaes, mcp-server)
- [ ] Publish 14 ClawHub skills to marketplace
- [ ] Wire Stripe metered billing into API routes (service layer exists, needs route integration)
- [ ] Wire Unkey API key validation for gated access
- [ ] Implement x402/USDC machine payment path (wallet configured, viem installed, zero implementation)
- [ ] End-to-end billing verification (free tier → paid tier → metered usage → invoice)

### Out of Scope

- Outreach and marketing — separate milestone
- Render paid tier upgrade — staying on free tier with keep-alive cron
- Mobile app features — API-only for this milestone
- New algorithm development — ship what's built
- Dashboard/admin UI — API-first, no frontend

## Context

- **API**: Fastify 5.8.4, live at oraclaw-api.onrender.com, 19 algorithms, <25ms per algorithm
- **npm**: @oraclaw scope on npmjs, 4 of 14 packages published, 167 downloads in first week
- **Billing infra built but not wired**: Stripe service (658 lines), Unkey SDK installed, wallet configured (0x4509...bC93), viem installed
- **ClawHub skills**: 14 SKILL.md manifests with pricing ($0.01–$0.15/call), publish scripts ready
- **Auth blocker**: npm token expired (E401), ClawHub CLI not authenticated — both need browser login
- **Outreach interest**: hideya (langchain-mcp-tools) responded asking for npm link

## Constraints

- **Auth**: npm and ClawHub publishing require browser-based login (user at keyboard)
- **Free tier**: Render free plan — 512MB memory, spins down after 15min (mitigated with cron)
- **Budget**: Free tier optimized — Gemini 15 req/min, 100 API req/min rate limit
- **Existing code**: Stripe service, Unkey SDK, viem are installed but not integrated into routes

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Both Stripe + x402 at launch | Maximize revenue paths — SaaS + crypto-native | — Pending |
| Stay on Render free tier | Keep-alive cron sufficient, upgrade based on traffic | — Pending |
| Outreach is separate milestone | Keep launch focused on product readiness | — Pending |
| Pre-compiled JS over tsx runtime | Cut cold-start by 2-5s on free tier | Validated |

---
*Last updated: 2026-03-29 after GSD initialization*
