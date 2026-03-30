# OraClaw - Twitter/X Launch Thread

## Tweet 1 (Hook)

Launching OraClaw -- decision intelligence as an API.

19 ML algorithms. Sub-25ms. Zero LLM cost.

Your AI agent can now do real math instead of hallucinating it.

Free to try, no API key needed.

oraclaw-api.onrender.com

## Tweet 2 (The Problem)

AI agents are great at language. They're terrible at optimization.

Ask Claude to pick the best A/B test variant and it "reasons" through it. Ask it to optimize a schedule and it burns 2000 tokens guessing.

OraClaw replaces that with deterministic algorithms that give the mathematically correct answer in <1ms.

## Tweet 3 (What's Inside)

19 algorithms in one API:

- Multi-Armed Bandits (UCB1, Thompson, LinUCB)
- CMA-ES + Genetic Algorithms
- Monte Carlo simulation (6 distributions)
- LP/MIP constraint solver (HiGHS)
- Bayesian inference + ensemble models
- Time series forecasting (ARIMA, Holt-Winters)
- Portfolio VaR/CVaR
- Anomaly detection
- Graph analysis (PageRank, Louvain)
- A* pathfinding

## Tweet 4 (Performance)

Performance numbers (single CPU core, no GPU):

Bandit selection: 0.01ms (100K ops/sec)
Bayesian inference: 0.02ms (50K ops/sec)
Anomaly detection: 0.01ms (100K ops/sec)
Constraint solver: 2ms (500 ops/sec)
CMA-ES optimization: 12ms (83 ops/sec)

14 of 18 endpoints under 1ms.
All under 25ms.
1,072 tests passing.

## Tweet 5 (Integration)

3 ways to use it:

1. REST API -- curl any endpoint, get JSON back
2. MCP Server -- 12 tools for Claude/GPT agents
3. npm SDKs -- 14 typed packages (@oraclaw/*)

```bash
curl -X POST https://oraclaw-api.onrender.com/api/v1/optimize/bandit \
  -H 'Content-Type: application/json' \
  -d '{"arms":[{"id":"A","pulls":10,"totalReward":7},{"id":"B","pulls":10,"totalReward":5},{"id":"C","pulls":2,"totalReward":1.8}],"algorithm":"ucb1"}'
```

Try it right now. No signup.

## Tweet 6 (Pricing + AI Payments)

Pricing:
- Free: 100 calls/day, no auth
- Starter: $9/mo (10K calls)
- Growth: $49/mo (100K calls)
- Scale: $199/mo (1M calls)

The interesting part: AI agents can pay autonomously with USDC via x402 protocol. Machine-to-machine payments for machine intelligence.

## Tweet 7 (CTA)

OraClaw is MIT licensed and live right now.

API: oraclaw-api.onrender.com
GitHub: github.com/Whatsonyourmind/oracle
npm: @oraclaw/*

If you're building AI agents that need to make actual decisions (not just talk about them), give it a try.

What algorithms should I add next?
