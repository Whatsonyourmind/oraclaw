# OraClaw

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![npm](https://img.shields.io/badge/npm-%40oraclaw-blue)](https://www.npmjs.com/org/oraclaw)
[![MCP](https://img.shields.io/badge/MCP-12_tools-green)](https://modelcontextprotocol.io)
[![Sponsor](https://img.shields.io/badge/sponsor-%E2%9D%A4-pink)](https://github.com/sponsors/Whatsonyourmind)

**Decision intelligence for AI agents. 19 algorithms, 12 MCP tools, sub-5ms. Zero LLM cost.**

OraClaw gives your AI agent real decision-making capabilities -- bandits, solvers, forecasters, risk models -- without burning tokens on reasoning. Every tool runs locally, returns structured JSON, and costs nothing to compute.

*Fills gaps, doesn't replace.*

---

## Quick Start

Add to your Claude Code `mcp.json` or `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "oraclaw": {
      "command": "npx",
      "args": ["tsx", "/path/to/oraclaw/packages/mcp-server/src/index.ts"]
    }
  }
}
```

Then ask your agent:

> "Which email subject line should I use? Here are results from the last 3 variants..."

The agent calls `optimize_bandit` and gets a statistically grounded selection in 0.01ms.

---

## Example: Bandit Selection

```typescript
// Your AI agent calls the MCP tool with:
{
  "arms": [
    { "id": "short", "name": "Short Subject", "pulls": 500, "totalReward": 175 },
    { "id": "long",  "name": "Long Subject",  "pulls": 300, "totalReward": 126 },
    { "id": "emoji", "name": "Emoji Subject",  "pulls": 100, "totalReward": 48 }
  ],
  "algorithm": "ucb1"
}

// Response:
{
  "selected": "emoji",
  "name": "Emoji Subject",
  "score": 0.827,
  "algorithm": "ucb1",
  "regret": 0.042
}
```

The bandit balances exploration (trying less-tested options) and exploitation (using what works). No sample size calculations, no waiting for statistical significance.

---

## MCP Tools (12)

| Tool | What It Does |
|------|-------------|
| `optimize_bandit` | A/B test any set of options with UCB1, Thompson Sampling, or Epsilon-Greedy |
| `optimize_contextual` | Context-aware selection using LinUCB -- learns which option works best *in which situation* |
| `optimize_cmaes` | Black-box continuous optimization (CMA-ES). Hyperparameters, portfolio weights, design variables |
| `solve_constraints` | LP/MIP/QP optimization via HiGHS. Budget allocation, resource scheduling with hard limits |
| `solve_schedule` | Energy-matched task scheduling. Assigns tasks to time slots by priority and energy level |
| `analyze_decision_graph` | PageRank, Louvain communities, bottleneck detection, critical path on any network |
| `analyze_portfolio_risk` | VaR and CVaR (Expected Shortfall) via variance-covariance method |
| `score_convergence` | Multi-source agreement scoring using Hellinger distance and entropy |
| `score_calibration` | Brier score and log score for prediction quality |
| `predict_forecast` | ARIMA and Holt-Winters time series forecasting with confidence intervals |
| `detect_anomaly` | Z-Score and IQR anomaly detection for any numeric data |
| `plan_pathfind` | A* pathfinding with cost/time/risk breakdown and k-shortest paths (Yen's algorithm) |

---

## Products (14)

Each product ships as a ClawHub skill (for AI agent marketplaces) and an npm SDK package (`@oraclaw/*`).

| Package | Description |
|---------|-------------|
| `@oraclaw/bandit` | A/B testing and feature optimization powered by contextual bandits |
| `@oraclaw/solver` | Energy-matched task scheduling and LP/MIP resource allocation |
| `@oraclaw/cmaes` | SOTA derivative-free continuous optimizer. 10-100x more efficient than GA on smooth problems |
| `@oraclaw/graph` | PageRank, community detection, and critical path analysis for any network |
| `@oraclaw/forecast` | Time series forecasting with ARIMA and Holt-Winters. Confidence intervals included |
| `@oraclaw/anomaly` | Sub-millisecond anomaly detection via Z-score and IQR |
| `@oraclaw/risk` | VaR, CVaR, stress testing, and multi-factor risk scoring |
| `@oraclaw/bayesian` | Bayesian inference engine. Prior + evidence = posterior |
| `@oraclaw/simulate` | Monte Carlo simulation. 10,000 probabilistic scenarios in milliseconds |
| `@oraclaw/ensemble` | Multi-model consensus. Combine predictions into an optimal aggregate |
| `@oraclaw/calibrate` | Calibration scoring, convergence analysis, and forecast quality metrics |
| `@oraclaw/evolve` | Genetic algorithm optimizer. Multi-objective Pareto optimization |
| `@oraclaw/pathfind` | A* pathfinding for workflow navigation with cost/time/risk breakdown |
| `@oraclaw/decide` | Full decision intelligence pipeline for executives, PMs, and founders |

---

## Performance

All benchmarks measured over 50 iterations on a single core. No GPU, no external services.

| Endpoint | Avg Latency | Throughput | Correctness |
|----------|------------|------------|-------------|
| Bandit (3 arms, UCB1) | 0.01 ms | 100,000 ops/s | Verified |
| Bandit (20 arms, Thompson) | 0.03 ms | 33,333 ops/s | Verified |
| Contextual Bandit (5 features) | 0.05 ms | 20,000 ops/s | Verified |
| Bayesian (3 factors) | 0.02 ms | 50,000 ops/s | Verified |
| Ensemble (4 models) | 0.03 ms | 33,333 ops/s | Verified |
| Convergence (5 sources) | 0.04 ms | 25,000 ops/s | Verified |
| Calibration (100 predictions) | 0.02 ms | 50,000 ops/s | Verified |
| Constraint Solver (3 vars) | 2 ms | 500 ops/s | Verified |
| Constraint Solver (10 vars) | 3 ms | 333 ops/s | Verified |
| Schedule (5 tasks x 5 slots) | 3 ms | 333 ops/s | Verified |
| Decision Graph (10 nodes) | 0.5 ms | 2,000 ops/s | Verified |
| Monte Carlo (5,000 iters) | 4 ms | 250 ops/s | Verified |
| Genetic Algorithm (30 pop, 50 gen) | 8 ms | 125 ops/s | Verified |
| A* Pathfinding (10 nodes) | 0.1 ms | 10,000 ops/s | Verified |
| CMA-ES 2D (Rosenbrock) | 12 ms | 83 ops/s | 6e-14 fitness |
| CMA-ES 10D (Sphere) | 22 ms | 45 ops/s | Verified |
| Anomaly Detection (100 pts) | 0.01 ms | 100,000 ops/s | Verified |
| Holt-Winters (48 pts) | 0.08 ms | 12,500 ops/s | Verified |

14 of 18 endpoints complete in under 1ms. All endpoints under 25ms.

---

## Algorithms (19)

**Core:**
Multi-Armed Bandit (UCB1 + Thompson + Epsilon-Greedy) | Contextual Bandit (LinUCB) | Genetic Algorithm (NSGA-II, Pareto) | Q-Learning (experience replay) | A* Pathfinding (Yen's k-shortest) | Ensemble (weighted voting, stacking, Bayesian averaging) | Simulated Annealing (5 cooling schedules) | Markov Chain (state transitions) | Attention Mechanism (multi-head signal prioritization) | Monte Carlo Simulation | Bayesian Inference

**SOTA Additions:**
CMA-ES (derivative-free continuous optimization) | Decision Graph (graphology -- PageRank, Louvain communities) | Constraint Optimizer (HiGHS WASM -- LP/MIP/QP) | Convergence Scoring (Hellinger distance) | Time Series (ARIMA + Holt-Winters) | Anomaly Detection (Z-Score + IQR + streaming) | Correlation Matrix + Portfolio VaR/CVaR | Calibration Scoring (Brier + log score)

---

## Architecture

Built on the OODA loop framework:

```
OBSERVE  -->  Signal detection, anomaly scanning, data ingestion
ORIENT   -->  Context building, graph analysis, environment mapping
DECIDE   -->  Option generation, Monte Carlo simulation, Bayesian inference
ACT      -->  Execution planning, pathfinding, real-time adjustment
```

**Stack:** Fastify 5 + TypeScript (strict) | Expo 55 + React Native 0.83 | PostgreSQL (Supabase) | Turborepo monorepo

---

## Pricing

| Tier | Calls/Month | Price |
|------|-------------|-------|
| Free | 100/day | $0 |
| Starter | 50K | $49/mo |
| Growth | 500K | $149/mo |
| Scale | 5M | $499/mo |
| Enterprise | Unlimited | Custom |

Machine payments supported via x402 (USDC on Base). $0.01 per call.

---

## Project Structure

```
oraclaw/
  mission-control/
    apps/
      api/           # Fastify backend (18 endpoints, 19 algorithms)
      mobile/        # Expo React Native app
    packages/
      mcp-server/    # MCP server (12 tools for AI agents)
      sdk/           # 14 npm packages (@oraclaw/*)
      clawhub-skills/# 14 ClawHub skills for agent marketplaces
      shared-types/  # TypeScript interfaces
      schemas/       # Zod validation
```

---

## Development

```bash
cd mission-control

# Start dev server
npm run dev

# Run tests (945 passing)
npm run test

# Run benchmarks
npx tsx scripts/benchmark-all.ts

# Type check
cd apps/api && npx tsc --noEmit
```

---

## License

[MIT](LICENSE)
