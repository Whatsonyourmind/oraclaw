# OraClaw

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![MCP](https://img.shields.io/badge/MCP-17_tools-green)](https://modelcontextprotocol.io)
[![Algorithms](https://img.shields.io/badge/algorithms-21-orange)](web/lib/algorithms.ts)
[![Latency](https://img.shields.io/badge/latency-%3C25ms-blue)](mission-control/scripts/benchmark-all.ts)
[![npm](https://img.shields.io/badge/npm-%40oraclaw-blue)](https://www.npmjs.com/org/oraclaw)
[![API Status](https://img.shields.io/badge/API-live-brightgreen)](https://oraclaw-api.onrender.com/api/v1/health)

**MCP Optimization Tools for AI Agents** -- 17 tools, 21 algorithms, sub-25ms. Zero LLM cost.

Your AI agent can't do math. OraClaw gives it deterministic optimization, simulation, forecasting, and risk analysis through the Model Context Protocol. Every tool returns structured JSON, runs in under 25ms, and costs nothing to compute.

---

> **🚀 Using OraClaw in production — or want managed hosting, premium tools, or priority support?**
> [**Tell me about your use case →**](https://github.com/Whatsonyourmind/oraclaw/issues/new?template=early-access.yml) — I read every one.
>
> 💬 **Building something with it?** Star the repo and say hi in [**Discussions**](https://github.com/Whatsonyourmind/oraclaw/discussions) — what you build steers what I ship next.

---

## What this solves

LLMs generate plausible text, not mathematically optimal answers. OraClaw gives an AI agent a set of deterministic numerical tools it can call instead of guessing — each returns structured JSON from a real algorithm, with no token spend on reasoning. Concretely:

- **Your agent needs to pick the next variant to try** (A/B test arm, ad/email copy, recommendation) and balance exploration against exploitation — without hand-rolling a bandit or letting the model eyeball it. Call `optimize_bandit` (or `optimize_contextual` when the best choice depends on per-call features).
- **Your agent needs a provably optimal allocation or schedule under hard constraints** (budget split, integer counts, capacity caps) — without the model hallucinating constraints. Call `solve_constraints` (LP/MIP/QP via HiGHS) or `solve_schedule` for task-to-slot fitting.
- **Your agent needs to quantify uncertainty** around an outcome — project a value under an uncertain input, or measure VaR/CVaR on a weighted multi-asset book with auditable assumptions — without a Monte Carlo loop in the prompt. Call `simulate_montecarlo`, `simulate_scenario`, or `analyze_risk`.
- **Your agent needs a point forecast or an outlier flag** on a time series (demand, KPIs, sensor/metric streams) — without inventing trend math. Call `predict_forecast` (ARIMA / Holt-Winters) or `detect_anomaly` (Z-score / IQR).
- **Your agent needs to fuse or score probability signals** — combine model outputs, measure how much independent sources agree, or check whether past predictions were well-calibrated. Call `predict_ensemble`, `score_convergence`, or `score_calibration`.
- **Your agent needs to reason over a graph** — rank influential nodes, cluster a dependency/knowledge graph, find a critical path, or route between two nodes. Call `analyze_graph` or `plan_pathfind`.

---

## Where the algorithms have been used

OraClaw's algorithms have informed implementations in several open-source projects -- through contributed routing specs, algorithm guidance, and shared math -- spanning AI agent orchestration, time-series tracking, vector search, and optimization.

**Selected contributions** (see [`CHANGELOG.md`](CHANGELOG.md) for the full list):

- [`chernistry/bernstein`](https://github.com/chernistry/bernstein) -- agent orchestration framework. LinUCB contextual router (α=0.3) with shadow-evaluation path and interpretable decision reasons, shipped in `codex/issue-367-linucb-router` after a contributed spec correction.
- [`stxkxs/nanohype`](https://github.com/nanohype/nanohype) -- contextual bandit routing, pluggable strategy registry (hash / sliding-TTL / semantic), cost anomaly detection. *"Your input shaped a lot of what actually shipped."*
- [`rfivesix/hypertrack`](https://github.com/rfivesix/hypertrack) -- Bayesian/Kalman-style adaptive estimator with phase-aware ramp. Shipped in 0.8.0-beta.
- [`AlanHuang99/pyrollmatch`](https://github.com/AlanHuang99/pyrollmatch) -- entropy balancing (Hainmueller 2012) with moment constraints + `max_weight` cap. Shipped in v0.1.3.
- [`stffns/vstash`](https://github.com/stffns/vstash) -- IDF-sigmoid relevance weighting. Shipped in v0.17.0.

**Marketplace distribution:**

- ✓ [`punkpeye/awesome-mcp-servers`](https://github.com/punkpeye/awesome-mcp-servers) -- merged
- ✓ [`TensorBlock/awesome-mcp-servers`](https://github.com/TensorBlock/awesome-mcp-servers) -- merged
- ✓ MCP Registry, Glama (Quality A), PulseMCP, toolsdk-ai -- listed

---

## Quick Start

### 1. MCP Server (recommended for AI agents)

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "oraclaw": {
      "command": "npx",
      "args": ["-y", "@oraclaw/mcp-server"]
    }
  }
}
```

Then ask your agent:

> "I have 3 email subject line variants. Which should I send next?"

The agent calls `optimize_bandit` and gets a statistically optimal selection in 0.01ms.

### 2. REST API (no install)

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

Free tier: 25 calls/day, no API key needed.

### 3. npm SDK

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

14 SDK packages: `@oraclaw/bandit`, `@oraclaw/solver`, `@oraclaw/simulate`, `@oraclaw/risk`, `@oraclaw/forecast`, `@oraclaw/anomaly`, `@oraclaw/graph`, `@oraclaw/bayesian`, `@oraclaw/ensemble`, `@oraclaw/calibrate`, `@oraclaw/evolve`, `@oraclaw/pathfind`, `@oraclaw/cmaes`, `@oraclaw/decide`

---

## Why?

LLMs generate plausible text, not optimal solutions. Ask GPT to pick the best A/B test variant and it applies a heuristic that ignores the exploration-exploitation tradeoff. Ask it to solve a linear program and it hallucinates constraints. OraClaw gives your agent access to real algorithms -- bandits, solvers, forecasters, risk models -- that return mathematically correct answers in sub-millisecond time, without burning tokens on reasoning.

---

## MCP Tool Catalog (17 tools)

**Free tier (11 tools, no API key — 25 calls/day per IP):**

| Tool | What It Does | Latency |
|------|-------------|---------|
| `optimize_bandit` | UCB1 / Thompson / Epsilon-Greedy arm selection | 0.01ms |
| `optimize_contextual` | Context-aware LinUCB bandit | 0.05ms |
| `optimize_evolve` | Genetic algorithm for discrete + multi-objective problems | <10ms |
| `solve_schedule` | Energy-matched task scheduling | 3ms |
| `score_convergence` | Multi-source probability consensus (Hellinger) | 0.04ms |
| `score_calibration` | Brier + log score for forecaster accuracy | 0.02ms |
| `predict_bayesian` | Beta posterior update from weighted evidence | 0.05ms |
| `predict_ensemble` | Multi-model consensus + uncertainty decomposition | 0.1ms |
| `plan_pathfind` | A* + Yen's k-shortest paths | 0.1ms |
| `simulate_montecarlo` | Single-factor Monte Carlo (6 distributions) | <2ms |
| `simulate_scenario` | What-if comparison + sensitivity ranking | <5ms |

**Premium tier (6 tools, requires `ORACLAW_API_KEY`):**

| Tool | What It Does | Latency |
|------|-------------|---------|
| `optimize_cmaes` | CMA-ES continuous black-box optimization | 12ms |
| `solve_constraints` | LP / MIP / QP solver via HiGHS (provably optimal) | 2ms |
| `analyze_graph` | PageRank, Louvain communities, bottleneck detection | 0.5ms |
| `analyze_risk` | VaR and CVaR (Expected Shortfall) | <2ms |
| `predict_forecast` | ARIMA + Holt-Winters time series forecasting | 0.08ms |
| `detect_anomaly` | Z-Score + IQR anomaly detection | 0.01ms |

14 of 18 REST endpoints respond in under 1ms. All under 25ms.

---

## Try It Now

The API is live. No signup required.

```bash
# Bayesian inference
curl -X POST https://oraclaw-api.onrender.com/api/v1/predict/bayesian \
  -H 'Content-Type: application/json' \
  -d '{"prior": 0.3, "evidence": [{"factor": "positive_test", "weight": 0.9, "value": 0.05}]}'

# Monte Carlo simulation
curl -X POST https://oraclaw-api.onrender.com/api/v1/simulate/montecarlo \
  -H 'Content-Type: application/json' \
  -d '{"simulations": 1000, "distribution": "normal", "params": {"mean": 100, "stddev": 15}}'

# Monte Carlo with a non-normal distribution
curl -X POST https://oraclaw-api.onrender.com/api/v1/simulate/montecarlo \
  -H 'Content-Type: application/json' \
  -d '{"simulations": 1000, "distribution": "triangular", "params": {"min": 80, "mode": 100, "max": 140}}'
```

> Premium tools (`detect_anomaly`, `predict_forecast`, `analyze_risk`, `solve_constraints`, `analyze_graph`, `optimize_cmaes`) need an API key or an x402 payment — see **Pricing** below.

---

## Pricing

| Tier | Calls | Price | Auth |
|------|-------|-------|------|
| **Free** | 25/day | $0 | None |
| **Pay-per-call** | 1K/day | $0.005/call | API key |
| **Starter** | 50K/mo | $9/mo | API key |
| **Growth** | 500K/mo | $49/mo | API key |
| **Scale** | 5M/mo | $199/mo | API key |

**x402 (for autonomous agents):** pay **$0.001/call** in USDC on Base — no signup, no API key. Send a signed `PAYMENT-SIGNATURE` header on any premium endpoint; the API verifies, meters, and settles per call. Get a key instead with a one-line `POST /api/v1/auth/signup` ({"email":"you@…"}) — instant, no card.

---

## Source Code

| Component | Path |
|-----------|------|
| **MCP Server** | [`mission-control/packages/mcp-server/`](mission-control/packages/mcp-server/) |
| **REST API** | [`mission-control/apps/api/`](mission-control/apps/api/) |
| **Algorithms** | [`mission-control/apps/api/src/services/oracle/algorithms/`](mission-control/apps/api/src/services/oracle/algorithms/) |
| **SDK Packages** | [`mission-control/packages/sdk/`](mission-control/packages/sdk/) |
| **LangChain Tools** | [`mission-control/integrations/langchain/oraclaw_tools.py`](mission-control/integrations/langchain/oraclaw_tools.py) |
| **Mobile App** | [`mission-control/apps/mobile/`](mission-control/apps/mobile/) |
| **Dashboard (Next.js)** | [`web/`](web/) |

---

## Building with OraClaw?

We'd love to hear what you're working on. Share your use case, ask questions, or request features:

- [Tell us what you're building](https://github.com/Whatsonyourmind/oraclaw/discussions/1)
- [Report an issue](https://github.com/Whatsonyourmind/oraclaw/issues)
- [Join the conversation on Moltbook](https://www.moltbook.com/u/oraclaw)

---

## Links

- **Live API:** https://oraclaw-api.onrender.com
- **Dashboard:** https://web-olive-one-89.vercel.app
- **npm:** https://www.npmjs.com/org/oraclaw
- **Demo:** https://web-olive-one-89.vercel.app/demo
- **GitHub:** https://github.com/Whatsonyourmind/oraclaw

---

If this saved your agent from hallucinating math, star us :star:

## License

[MIT](LICENSE)
