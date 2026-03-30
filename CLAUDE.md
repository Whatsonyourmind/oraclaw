# CLAUDE.md — OraClaw v2.0 (Decision Intelligence Platform)

## Project Overview

**OraClaw** — State-of-the-art AI decision intelligence platform built on the OODA loop framework (Observe, Orient, Decide, Act). Combines 10+ ML algorithms with personal productivity tools for optimal decision-making under uncertainty.

## Tech Stack

- **Backend**: Fastify 5.8.4 + TypeScript 5.3.3 (strict mode)
- **Mobile**: Expo 55 + React Native 0.83.2 + React 19.2 (New Architecture enabled)
- **Database**: PostgreSQL (Supabase), pgvector for embeddings
- **AI**: Google Gemini + OpenAI (dual-model)
- **Real-time**: Fastify WebSocket + Socket.io
- **State**: Zustand (mobile), in-memory (API)
- **Monorepo**: Turborepo + npm workspaces

## Project Structure

```
Handler/
├── mission-control/
│   ├── apps/
│   │   ├── api/          # Fastify backend (15+ routes, 20+ services)
│   │   ├── mobile/       # Expo RN app (25+ features, 86 components)
│   │   └── watch/        # Smartwatch companion
│   ├── packages/
│   │   ├── shared-types/  # 3,333 lines of TypeScript interfaces
│   │   ├── client-sdk/    # SDK for mobile/web
│   │   └── schemas/       # Zod validation
│   └── docker/            # Prometheus + Grafana
├── web/                   # Next.js 15 dashboard (standalone, React 19)
│   ├── app/              # App Router pages (algorithms, docs, try-it, getting-started)
│   ├── components/       # TryItForm, etc.
│   └── lib/              # Algorithm metadata, examples
└── ralph/                 # Ralph autonomous agent
```

## Build & Dev Commands

```bash
# Development
cd mission-control && npm run dev     # Start API + mobile
npm run dev:api                       # API only (port 3001)

# Testing
npm run test                          # Run all 925 tests
npx vitest run                        # Direct vitest
npx vitest run --reporter=verbose     # Verbose output

# Type checking
cd apps/api && npx tsc --noEmit       # API typecheck

# Mobile
cd apps/mobile && npx expo start      # Start Expo dev server
```

## Algorithms (10+ ML Engines)

Located in `apps/api/src/services/oracle/algorithms/`:

### Core (Original)
| Algorithm | File | Lines | Use Case |
|-----------|------|-------|----------|
| Multi-Armed Bandit | `multiArmedBandit.ts` | 638 | UCB1 + Thompson + ε-Greedy for option selection |
| Genetic Algorithm | `geneticAlgorithm.ts` | 753 | Multi-objective optimization, Pareto frontier |
| Q-Learning | `qLearning.ts` | 752 | Reinforcement learning with experience replay |
| A* Pathfinding | `astar.ts` | 857 | Critical path + K-shortest paths (Yen's) |
| Ensemble Model | `ensemble.ts` | 100+ | Weighted voting, stacking, Bayesian model averaging |
| Simulated Annealing | `simulatedAnnealing.ts` | 100+ | 5 cooling schedules, constraint satisfaction |
| Markov Chain | `markovChain.ts` | — | State transitions, pattern prediction |
| Attention Mechanism | `attention.ts` | — | Multi-head attention for signal prioritization |

### Added (Ported + SOTA)
| Algorithm | File | Source | Use Case |
|-----------|------|--------|----------|
| Contextual Bandit (LinUCB) | `contextualBandit.ts` | NEW (SOTA) | Context-aware decisions using features (time, energy, urgency) |
| Convergence Scoring | `convergenceScoring.ts` | EU Predictions (ICM) | Multi-source signal agreement via Hellinger distance |
| Decision Graph | `decisionGraph.ts` | graphology (SOTA) | PageRank, Louvain communities, shortest path |
| Constraint Optimizer | `constraintOptimizer.ts` | HiGHS (WASM) | LP/MIP scheduling, resource allocation |

### SOTA npm Packages Installed
| Package | Purpose |
|---------|---------|
| `graphology` + extensions | Full graph algorithms (PageRank, communities, shortest path) |
| `highs` | Production LP/MIP/QP solver (WASM, same as commercial solvers) |
| `simple-statistics` | Distributions, regression, inference |
| `jstat` | Probability distributions (Beta, Weibull, Poisson, etc.) |
| `bayesian-optimizer` | Gaussian process Bayesian optimization |

## OODA Loop Architecture

```
OBSERVE → Radar scanning, signal detection, anomaly patterns
ORIENT  → Context building, horizon planning, environment graph
DECIDE  → Options generation, Monte Carlo simulation, Bayesian inference
ACT     → Execution planning, copilot guidance, real-time adjustment
```

**Theme**: OODA loop colors — Observe (Blue #0088FF), Orient (Cyan #00FFFF), Decide (Yellow #FFFF00), Act (Green #00FF88), Background (Black #000000)

## API Routes

```
POST /api/oracle/observe/scan          # Signal detection
POST /api/oracle/orient/context        # Strategic context
POST /api/oracle/decide/decisions      # Decision creation
POST /api/oracle/decide/simulate       # Monte Carlo simulation
POST /api/oracle/act/steps             # Execution planning
POST /api/oracle/probability/bayesian  # Bayesian updates
POST /api/oracle/probability/montecarlo
GET  /api/oracle/analytics/insights
POST /api/oracle/query/natural         # NLP interface
POST /api/oracle/scenarios/create
```

## Key Stats

- **Tests**: 945 passing (24 files)
- **API**: 18 public endpoints (v2.3.0)
- **Algorithms**: 18 files, 19 algorithms (2 SOTA + 1 Near-SOTA + 2 Unique IP + 11 Prod-grade + 2 Classic)
- **ClawHub Skills**: 14 published-ready for OpenClaw/MoltBot agents
- **SDK Packages**: 14 thin API clients (zero code leaked)
- **MCP Server**: 12 tools for AI agents (x402 machine payments)
- **Wallet**: Base USDC wallet (0x077E...Cdde)
- **Performance**: All algorithms <25ms, 14/18 under 1ms, accuracy verified (CMA-ES 6e-14 on Rosenbrock)
- **PRD**: 35/35 stories complete
- **Mobile**: 25+ features, 86 components
- **Security**: SQL injection + XSS + CSRF protection (136 security tests)
- **Files**: 394 files, 12 commits

## Upgrade Needs (Remaining)

- ~~Fastify 4 → 5.8.4~~ DONE (March 23, 2026)
- ~~Expo 50 → 55~~ DONE (March 23, 2026) — New Architecture enabled
- ~~React Native 0.73 → 0.83.2~~ DONE (March 23, 2026)
- ~~React 18 → 19.2~~ DONE (March 23, 2026)
- ~~React Navigation v6 → v7~~ DONE (March 23, 2026)
- Bull → BullMQ 5.71 (remaining)
- 163 pre-existing TS type gaps in mobile (shared-types ↔ component mismatches, not from upgrade)

## Key Conventions

- OODA loop is the core mental model — every feature maps to a phase
- All algorithms are zero-dependency pure TypeScript (except new SOTA additions)
- Free tier optimized: Gemini 15 req/min, 100 API req/min rate limit
- Offline-first mobile: queue actions, fallback UI
- Spy-themed aesthetic: matrix green, monospace, scan effects
