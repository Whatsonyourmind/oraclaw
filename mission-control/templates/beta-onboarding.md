# OraClaw Beta Onboarding

Hey {NAME}! I set up a free OraClaw API key for you — full access to all 12 optimization tools for 30 days, no credit card needed.

## Your API Key

```
{API_KEY}
```

## Quick Start: MCP (Claude Code / Claude Desktop)

Add to your MCP config:

```json
"oraclaw": {
  "command": "npx",
  "args": ["@oraclaw/mcp-server"],
  "env": {
    "ORACLAW_API_KEY": "{API_KEY}"
  }
}
```

Then ask Claude: "Use the LP solver to allocate my budget across 3 projects" or "Run a Monte Carlo simulation with 10,000 iterations."

## Quick Start: REST API

```bash
# Multi-Armed Bandit — which option is best?
curl -X POST https://oraclaw-api.onrender.com/api/v1/optimize/bandit \
  -H "Authorization: Bearer {API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"arms":[{"id":"a","pulls":10,"totalReward":7},{"id":"b","pulls":10,"totalReward":5}]}'

# LP Solver — optimal resource allocation
curl -X POST https://oraclaw-api.onrender.com/api/v1/solve/constraints \
  -H "Authorization: Bearer {API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"direction":"maximize","objective":{"x":5,"y":4},"variables":[{"name":"x","lower":0,"upper":10},{"name":"y","lower":0,"upper":10}],"constraints":[{"name":"budget","coefficients":{"x":2,"y":3},"upper":24}]}'

# Graph Analytics — find important nodes
curl -X POST https://oraclaw-api.onrender.com/api/v1/analyze/graph \
  -H "Authorization: Bearer {API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"nodes":[{"id":"A"},{"id":"B"},{"id":"C"},{"id":"D"}],"edges":[{"source":"A","target":"B","weight":1},{"source":"B","target":"C","weight":2},{"source":"C","target":"D","weight":1},{"source":"A","target":"D","weight":3}]}'
```

## All 12 Tools

| Tool | What It Does |
|------|-------------|
| `optimize_bandit` | Best option selection (UCB1/Thompson) |
| `optimize_contextual` | Context-aware selection (LinUCB) |
| `solve_constraints` | LP/MIP/QP optimization (HiGHS) |
| `solve_schedule` | Task scheduling with energy matching |
| `analyze_graph` | PageRank, communities, shortest path |
| `analyze_risk` | Portfolio VaR/CVaR |
| `score_convergence` | Multi-source agreement scoring |
| `predict_forecast` | Time series (ARIMA/Holt-Winters) |
| `detect_anomaly` | Z-score/IQR anomaly detection |
| `plan_pathfind` | A* with k-shortest paths |
| `simulate_montecarlo` | Monte Carlo simulation |
| `optimize_cmaes` | CMA-ES continuous optimization |

## What Happens After 30 Days

Your beta key expires automatically. To continue:
- **Pay-per-call**: $0.005/call, no minimum (run `POST /api/v1/auth/signup`)
- **Starter**: $9/mo for 50K calls
- **USDC**: $0.001/call via x402 machine payments

## Need Help?

Reply to this message — I'll fix any issues same day.
