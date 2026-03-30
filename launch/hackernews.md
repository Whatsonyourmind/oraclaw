# OraClaw - Hacker News Launch Post

## Title (under 80 chars)

Show HN: OraClaw -- 19 ML algorithms as an API, sub-25ms, USDC machine payments

## URL

https://oraclaw-api.onrender.com

## Text

OraClaw is a decision intelligence API that gives AI agents (and developers) access to 19 production-grade ML algorithms via REST endpoints.

The motivation: LLM agents waste tokens trying to "reason" about optimization problems they can't actually solve. When an agent needs to pick the best A/B test variant, it either hallucinate a choice or burns thousands of tokens on chain-of-thought that produces a mathematically wrong answer. OraClaw replaces that with deterministic algorithms.

What's in the box:
- Multi-Armed Bandits (UCB1, Thompson Sampling, LinUCB)
- CMA-ES and Genetic Algorithm optimizers
- LP/MIP constraint solver via HiGHS (WASM)
- Monte Carlo simulation with 6 distribution types
- Bayesian inference, ensemble models, time series forecasting
- Portfolio risk (VaR/CVaR), anomaly detection (Z-Score/IQR)
- Decision graphs (PageRank, Louvain communities via graphology)
- A* pathfinding with Yen's k-shortest paths

Technical details:
- Built with Fastify 5 + TypeScript (strict mode)
- All algorithms are pure TypeScript, no external ML services
- 14 of 18 endpoints respond in under 1ms, all under 25ms
- 1,072 tests passing across 24 test suites
- CMA-ES achieves 6e-14 fitness on the Rosenbrock function
- MCP server with 12 tools for Claude/GPT integration
- 14 npm SDK packages (@oraclaw/bandit, @oraclaw/solver, etc.)

Payment model:
- Free tier: 100 calls/day, no auth required
- Paid tiers: $9-$199/mo via Stripe
- x402 protocol: AI agents pay per-call with USDC on Base ($0.01-$0.15/call)

The x402 part is what I find most interesting technically. An AI agent can autonomously decide it needs to solve a constraint optimization problem, pay $0.10 in USDC, get the result, and continue -- no human in the loop for billing.

Try it now (no signup):

```
curl -X POST https://oraclaw-api.onrender.com/api/v1/optimize/bandit \
  -H 'Content-Type: application/json' \
  -d '{"arms":[{"id":"A","pulls":10,"totalReward":7},{"id":"B","pulls":10,"totalReward":5}],"algorithm":"ucb1"}'
```

MIT licensed. GitHub: https://github.com/Whatsonyourmind/oracle

Looking for feedback on: (1) which algorithms to add next, (2) whether the x402 machine payment model makes sense for your use case, (3) pricing structure.
