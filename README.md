# OraClaw

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-1%2C072_passing-brightgreen)](mission-control)
[![MCP](https://img.shields.io/badge/MCP-12_tools-green)](https://modelcontextprotocol.io)
[![Algorithms](https://img.shields.io/badge/algorithms-19-orange)](web/lib/algorithms.ts)
[![Latency](https://img.shields.io/badge/latency-%3C25ms-blue)](mission-control/scripts/benchmark-all.ts)
[![npm](https://img.shields.io/badge/npm-%40oraclaw-blue)](https://www.npmjs.com/org/oraclaw)
[![API Status](https://img.shields.io/badge/API-live-brightgreen)](https://oraclaw-api.onrender.com)

**MCP Optimization Tools for AI Agents** -- 12 tools, 19 algorithms, sub-25ms. Zero LLM cost.

Your AI agent can't do math. OraClaw gives it deterministic optimization, simulation, forecasting, and risk analysis through the Model Context Protocol. Every tool returns structured JSON, runs in under 25ms, and costs nothing to compute.

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

## MCP Tool Catalog (12 tools)

| Tool | What It Does | Latency |
|------|-------------|---------|
| `optimize_bandit` | A/B test selection via UCB1, Thompson Sampling, Epsilon-Greedy | 0.01ms |
| `optimize_contextual` | Context-aware personalized selection via LinUCB | 0.05ms |
| `optimize_cmaes` | Black-box continuous optimization (CMA-ES) | 12ms |
| `solve_constraints` | LP/MIP/QP optimization via HiGHS solver | 2ms |
| `solve_schedule` | Energy-matched task scheduling | 3ms |
| `analyze_decision_graph` | PageRank, Louvain communities, bottleneck detection | 0.5ms |
| `analyze_portfolio_risk` | VaR and CVaR (Expected Shortfall) | <2ms |
| `score_convergence` | Multi-source agreement scoring | 0.04ms |
| `score_calibration` | Brier score and log score for prediction quality | 0.02ms |
| `predict_forecast` | ARIMA and Holt-Winters time series forecasting | 0.08ms |
| `detect_anomaly` | Z-Score and IQR anomaly detection | 0.01ms |
| `plan_pathfind` | A* pathfinding with k-shortest paths | 0.1ms |

14 of 17 REST endpoints respond in under 1ms. All under 25ms.

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

# Anomaly detection
curl -X POST https://oraclaw-api.onrender.com/api/v1/detect/anomaly \
  -H 'Content-Type: application/json' \
  -d '{"data": [10, 12, 11, 13, 50, 12, 11, 10], "method": "zscore", "threshold": 2.0}'
```

---

## Pricing

| Tier | Calls | Price | Auth |
|------|-------|-------|------|
| **Free** | 25/day | $0 | None |
| **Pay-per-call** | 1K/day | $0.005/call | API key |
| **Starter** | 10K/mo | $9/mo | API key |
| **Growth** | 100K/mo | $49/mo | API key |
| **Scale** | 1M/mo | $199/mo | API key |

**x402 USDC:** AI agents pay $0.01-$0.15 per call with USDC on Base. No subscription, no API key.

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
- **GitHub:** https://github.com/Whatsonyourmind/oracle

---

If this saved your agent from hallucinating math, star us :star:

## License

[MIT](LICENSE)
