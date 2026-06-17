# OraClaw MCP Server

**17 decision-intelligence tools your AI agent can call. Sub-25ms. 11 free without a key.**

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

Drop that into your Claude Desktop / Cursor / Cline MCP config and your agent can immediately:

> *"I have 3 email subject line variants with these click rates. Which should I send next?"*

The agent calls `optimize_bandit` → gets a statistically optimal arm in **0.01ms**:

```
{ "selected": { "id": "C", "name": "Option C" },
  "score": 1.876, "exploitation": 0.9, "exploration": 0.976, "regret": 0.1 }
```

No LLM math, no hallucinated formulas, no setup beyond the snippet above.

---

## All 17 tools

| Free (no key) | What it does |
|---|---|
| `optimize_bandit` | UCB1 / Thompson / ε-greedy arm selection |
| `optimize_contextual` | LinUCB contextual bandit (per-situation choice) |
| `optimize_evolve` | Genetic algorithm (discrete + multi-objective) |
| `solve_schedule` | Task → time-slot assignment with energy matching |
| `score_convergence` | Multi-source probability consensus (Hellinger) |
| `score_calibration` | Brier + log score for forecaster accuracy |
| `predict_bayesian` | Beta posterior update from weighted evidence |
| `predict_ensemble` | Multi-model consensus + uncertainty decomposition |
| `plan_pathfind` | A* + Yen's k-shortest paths |
| `simulate_montecarlo` | Single-factor Monte Carlo (6 distributions) |
| `simulate_scenario` | What-if comparison + sensitivity ranking |

| Premium (need API key) | What it does |
|---|---|
| `optimize_cmaes` | CMA-ES continuous black-box optimization |
| `solve_constraints` | LP / MIP / QP solver (HiGHS, provably optimal) |
| `analyze_graph` | PageRank + Louvain + critical path + bottlenecks |
| `analyze_risk` | Portfolio VaR / CVaR with correlation |
| `predict_forecast` | ARIMA / Holt-Winters time series |
| `detect_anomaly` | Z-score / IQR outlier detection |

Every tool ships with an explicit `inputSchema`, `outputSchema`, and MCP behavior annotations (`readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`) so your agent knows exactly what it gets back.

---

## Get a key for premium tools

[**oraclaw signup →**](https://web-olive-one-89.vercel.app/signup) — one email field, instant key, no card needed. 1,000 calls/day on pay-per-call ($0.005/call). Upgrade to Starter $9/mo for 50k/month.

Then add `ORACLAW_API_KEY` to your MCP env:

```json
{
  "mcpServers": {
    "oraclaw": {
      "command": "npx",
      "args": ["-y", "@oraclaw/mcp-server"],
      "env": { "ORACLAW_API_KEY": "your-key-here" }
    }
  }
}
```

---

## Use the API directly (no MCP)

```bash
curl -X POST https://oraclaw-api.onrender.com/api/v1/optimize/bandit \
  -H "Content-Type: application/json" \
  -d '{
    "arms": [
      {"id":"A", "name":"Option A", "pulls":10, "totalReward":7},
      {"id":"B", "name":"Option B", "pulls":10, "totalReward":5}
    ],
    "algorithm": "ucb1"
  }'
```

Free tier: **25 calls/day per IP, no key required**.

---

## Why agents need this

LLMs can't reliably do: bandit selection, LP optimization, time-series forecasting, graph centrality, Monte Carlo sampling, or anomaly detection. They confabulate the math. OraClaw is the deterministic substrate underneath your agent — every answer is a real algorithm, returns structured JSON, and runs in under 25ms.

- **Source**: [github.com/Whatsonyourmind/oraclaw](https://github.com/Whatsonyourmind/oraclaw)
- **API docs**: [oraclaw-api.onrender.com](https://oraclaw-api.onrender.com)
- **Pricing**: [web-olive-one-89.vercel.app/pricing](https://web-olive-one-89.vercel.app/pricing)
- **License**: MIT
