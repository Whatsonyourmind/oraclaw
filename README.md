# OraClaw

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-1%2C072_passing-brightgreen)](mission-control)
[![Algorithms](https://img.shields.io/badge/algorithms-19-orange)](web/lib/algorithms.ts)
[![Latency](https://img.shields.io/badge/latency-%3C25ms-blue)](mission-control/scripts/benchmark-all.ts)
[![npm](https://img.shields.io/badge/npm-%40oraclaw-blue)](https://www.npmjs.com/org/oraclaw)
[![MCP](https://img.shields.io/badge/MCP-12_tools-green)](https://modelcontextprotocol.io)
[![API Status](https://img.shields.io/badge/API-live-brightgreen)](https://oraclaw-api.onrender.com)
[![Sponsor](https://img.shields.io/badge/sponsor-%E2%9D%A4-pink)](https://github.com/sponsors/Whatsonyourmind)

**Decision intelligence for AI agents. 19 algorithms, 12 MCP tools, sub-25ms. Zero LLM cost.**

OraClaw gives your AI agent real decision-making capabilities -- bandits, solvers, forecasters, risk models -- without burning tokens on reasoning. Every tool runs deterministically, returns structured JSON, and costs nothing to compute.

---

## Try It Now

The API is live. No signup, no API key, no SDK install. Just curl:

```bash
curl -X POST https://oraclaw-api.onrender.com/api/v1/optimize/bandit \
  -H 'Content-Type: application/json' \
  -d '{
    "arms": [
      {"id": "A", "name": "Option A", "pulls": 10, "totalReward": 7},
      {"id": "B", "name": "Option B", "pulls": 10, "totalReward": 5},
      {"id": "C", "name": "Option C", "pulls": 2, "totalReward": 1.8}
    ],
    "algorithm": "ucb1"
  }'
```

Response (<1ms):
```json
{
  "selected": { "id": "C", "name": "Option C" },
  "score": 1.876,
  "algorithm": "ucb1",
  "exploitation": 0.9,
  "exploration": 0.976,
  "regret": 0.1
}
```

The bandit correctly identifies Option C as under-explored and selects it for testing -- balancing exploration and exploitation without you writing any statistics code.

---

## Quick Start

### Option 1: REST API (no install)

Hit any of 17 endpoints directly. Free tier (100 calls/day) needs no auth.

```bash
# Bayesian inference
curl -X POST https://oraclaw-api.onrender.com/api/v1/predict/bayesian \
  -H 'Content-Type: application/json' \
  -d '{"prior": 0.3, "evidence": [{"factor": "positive_test", "weight": 0.9, "value": 0.05}]}'

# Monte Carlo simulation
curl -X POST https://oraclaw-api.onrender.com/api/v1/simulate/montecarlo \
  -H 'Content-Type: application/json' \
  -d '{"simulations": 1000, "distribution": "normal", "params": {"mean": 100, "stddev": 15}}'

# Anomaly detection
curl -X POST https://oraclaw-api.onrender.com/api/v1/detect/anomaly \
  -H 'Content-Type: application/json' \
  -d '{"data": [10, 12, 11, 13, 50, 12, 11, 10], "method": "zscore", "threshold": 2.0}'
```

### Option 2: MCP Server (for AI agents)

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

### Option 3: npm SDK

```bash
npm install @oraclaw/bandit
```

```typescript
import { OraBandit } from '@oraclaw/bandit';

const client = new OraBandit({ baseUrl: 'https://oraclaw-api.onrender.com' });
const result = await client.optimize({
  arms: [
    { id: 'A', name: 'Short Subject', pulls: 500, totalReward: 175 },
    { id: 'B', name: 'Long Subject', pulls: 300, totalReward: 126 },
  ],
  algorithm: 'ucb1',
});
```

14 SDK packages available: `@oraclaw/bandit`, `@oraclaw/solver`, `@oraclaw/simulate`, `@oraclaw/risk`, `@oraclaw/forecast`, `@oraclaw/anomaly`, `@oraclaw/graph`, `@oraclaw/bayesian`, `@oraclaw/ensemble`, `@oraclaw/calibrate`, `@oraclaw/evolve`, `@oraclaw/pathfind`, `@oraclaw/cmaes`, `@oraclaw/decide`

---

## Algorithms (19)

| # | Algorithm | Endpoint | Avg Latency | Use Case |
|---|-----------|----------|-------------|----------|
| 1 | Multi-Armed Bandit | `/api/v1/optimize/bandit` | 0.01ms | A/B testing, feature flags |
| 2 | Contextual Bandit (LinUCB) | `/api/v1/optimize/contextual-bandit` | 0.05ms | Personalized recommendations |
| 3 | CMA-ES | `/api/v1/optimize/cmaes` | 12ms | Continuous optimization |
| 4 | Genetic Algorithm | `/api/v1/optimize/evolve` | 8ms | Multi-objective optimization |
| 5 | Monte Carlo Simulation | `/api/v1/simulate/montecarlo` | 4ms | Risk assessment, financial modeling |
| 6 | Scenario Planning | `/api/v1/simulate/scenario` | <3ms | What-if analysis |
| 7 | Constraint Solver (LP/MIP) | `/api/v1/solve/constraints` | 2ms | Resource allocation, scheduling |
| 8 | Schedule Optimizer | `/api/v1/solve/schedule` | 3ms | Task assignment |
| 9 | Decision Graph | `/api/v1/analyze/graph` | 0.5ms | PageRank, community detection |
| 10 | Portfolio Risk (VaR/CVaR) | `/api/v1/analyze/risk` | <2ms | Portfolio management |
| 11 | Bayesian Inference | `/api/v1/predict/bayesian` | 0.02ms | Belief updating, diagnosis |
| 12 | Ensemble Model | `/api/v1/predict/ensemble` | 0.03ms | Model aggregation |
| 13 | Time Series Forecast | `/api/v1/predict/forecast` | 0.08ms | Demand forecasting |
| 14 | Anomaly Detection | `/api/v1/detect/anomaly` | 0.01ms | Fraud, monitoring |
| 15 | Convergence Scoring | `/api/v1/score/convergence` | 0.04ms | Multi-source agreement |
| 16 | Calibration Scoring | `/api/v1/score/calibration` | 0.02ms | Prediction quality |
| 17 | A* Pathfinding | `/api/v1/plan/pathfind` | 0.1ms | Route planning, critical path |

14 of 17 endpoints respond in under 1ms. All under 25ms.

---

## MCP Tools (12)

| Tool | What It Does |
|------|-------------|
| `optimize_bandit` | A/B test any set of options with UCB1, Thompson Sampling, or Epsilon-Greedy |
| `optimize_contextual` | Context-aware selection using LinUCB |
| `optimize_cmaes` | Black-box continuous optimization (CMA-ES) |
| `solve_constraints` | LP/MIP/QP optimization via HiGHS |
| `solve_schedule` | Energy-matched task scheduling |
| `analyze_decision_graph` | PageRank, Louvain communities, bottleneck detection |
| `analyze_portfolio_risk` | VaR and CVaR (Expected Shortfall) |
| `score_convergence` | Multi-source agreement scoring |
| `score_calibration` | Brier score and log score for prediction quality |
| `predict_forecast` | ARIMA and Holt-Winters time series forecasting |
| `detect_anomaly` | Z-Score and IQR anomaly detection |
| `plan_pathfind` | A* pathfinding with k-shortest paths |

---

## Pricing

| Tier | Calls | Price | Auth |
|------|-------|-------|------|
| **Free** | 100/day | $0 | None |
| **Starter** | 10K/mo | $9/mo | API key |
| **Growth** | 100K/mo | $49/mo | API key |
| **Scale** | 1M/mo | $199/mo | API key |
| **Enterprise** | Custom | Custom | API key |

**USDC pay-per-call (x402):** AI agents pay $0.01-$0.15 per call autonomously with USDC on Base. No subscription, no API key. Machine-to-machine payments.

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
| Anomaly Detection (100 pts) | 0.01 ms | 100,000 ops/s | Verified |
| Holt-Winters (48 pts) | 0.08 ms | 12,500 ops/s | Verified |
| A* Pathfinding (10 nodes) | 0.1 ms | 10,000 ops/s | Verified |
| Decision Graph (10 nodes) | 0.5 ms | 2,000 ops/s | Verified |
| Constraint Solver (3 vars) | 2 ms | 500 ops/s | Verified |
| Schedule (5 tasks x 5 slots) | 3 ms | 333 ops/s | Verified |
| Monte Carlo (5,000 iters) | 4 ms | 250 ops/s | Verified |
| Genetic Algorithm (30 pop, 50 gen) | 8 ms | 125 ops/s | Verified |
| CMA-ES 2D (Rosenbrock) | 12 ms | 83 ops/s | 6e-14 fitness |
| CMA-ES 10D (Sphere) | 22 ms | 45 ops/s | Verified |

---

## Products (14 npm packages)

| Package | Description |
|---------|-------------|
| `@oraclaw/bandit` | A/B testing and feature optimization powered by contextual bandits |
| `@oraclaw/solver` | Energy-matched task scheduling and LP/MIP resource allocation |
| `@oraclaw/cmaes` | SOTA derivative-free continuous optimizer |
| `@oraclaw/graph` | PageRank, community detection, and critical path analysis |
| `@oraclaw/forecast` | Time series forecasting with ARIMA and Holt-Winters |
| `@oraclaw/anomaly` | Sub-millisecond anomaly detection via Z-score and IQR |
| `@oraclaw/risk` | VaR, CVaR, stress testing, and multi-factor risk scoring |
| `@oraclaw/bayesian` | Bayesian inference engine |
| `@oraclaw/simulate` | Monte Carlo simulation with 6 distribution types |
| `@oraclaw/ensemble` | Multi-model consensus and prediction aggregation |
| `@oraclaw/calibrate` | Calibration scoring and forecast quality metrics |
| `@oraclaw/evolve` | Genetic algorithm with multi-objective Pareto optimization |
| `@oraclaw/pathfind` | A* pathfinding with cost/time/risk breakdown |
| `@oraclaw/decide` | Full decision intelligence pipeline |

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

## Project Structure

```
oraclaw/
  mission-control/
    apps/
      api/           # Fastify backend (17 endpoints, 19 algorithms)
      mobile/        # Expo React Native app
    packages/
      mcp-server/    # MCP server (12 tools for AI agents)
      sdk/           # 14 npm packages (@oraclaw/*)
      clawhub-skills/# 14 ClawHub skills for agent marketplaces
      shared-types/  # TypeScript interfaces
      schemas/       # Zod validation
  web/               # Next.js 15 dashboard + docs
  launch/            # GTM materials
```

---

## Development

```bash
cd mission-control

# Start dev server
npm run dev

# Run tests (1,072 passing)
npm run test

# Run benchmarks
npx tsx scripts/benchmark-all.ts

# Type check
cd apps/api && npx tsc --noEmit
```

---

## Links

- **Live API:** https://oraclaw-api.onrender.com
- **npm:** https://www.npmjs.com/org/oraclaw
- **GitHub:** https://github.com/Whatsonyourmind/oracle

---

## License

[MIT](LICENSE)
