# Reddit Posts -- OraClaw Launch

Ready-to-post titles and bodies for 7 subreddits. Each tailored to the subreddit's culture and moderation norms.

---

## r/MachineLearning

**Title:** [P] OraClaw -- 19 deterministic optimization algorithms as a REST API for AI agents (bandits, LP/MIP, Monte Carlo, VaR/CVaR). Sub-millisecond, open-source.

**Body:**

I built an API that gives AI agents access to real optimization algorithms instead of asking LLMs to "reason" about mathematical problems.

**The problem:** When you ask GPT-4 to pick the best A/B test variant, it pattern-matches from training data. It doesn't compute UCB1 scores. When you ask it for Value-at-Risk, it doesn't run Monte Carlo simulations. The answers look plausible but aren't mathematically grounded.

**What OraClaw does:** 19 deterministic algorithms exposed as REST endpoints, MCP tools (for Claude/ChatGPT agents), and npm packages:

- Multi-Armed Bandit (UCB1, Thompson Sampling, Epsilon-Greedy) -- 0.01ms
- Contextual Bandit (LinUCB) -- 0.05ms
- Constraint Solver (LP/MIP via HiGHS WASM) -- 2ms
- Monte Carlo Simulation (6 distributions) -- 4ms
- Portfolio Risk (VaR, CVaR, Expected Shortfall) -- 2ms
- CMA-ES (derivative-free continuous optimization) -- 12ms
- Genetic Algorithm (multi-objective, Pareto frontier) -- 8ms
- Bayesian Inference, Ensemble, Time Series (ARIMA + Holt-Winters), Anomaly Detection, Decision Graph (PageRank, Louvain), A* Pathfinding, and more

**Benchmarks:** 14/17 endpoints respond in under 1ms. All under 25ms. 1,072 tests passing. CMA-ES achieves 6e-14 fitness on Rosenbrock.

**Stack:** Fastify 5 + TypeScript (strict), HiGHS for LP/MIP, graphology for graph algorithms, jstat for distributions.

Try it now (no signup):

```bash
curl -X POST https://oraclaw-api.onrender.com/api/v1/optimize/bandit \
  -H 'Content-Type: application/json' \
  -d '{"arms": [{"id": "A", "pulls": 500, "totalReward": 175}, {"id": "B", "pulls": 300, "totalReward": 126}, {"id": "C", "pulls": 12, "totalReward": 8}], "algorithm": "ucb1"}'
```

GitHub: https://github.com/Whatsonyourmind/oracle | MIT licensed

Happy to discuss the exploration-exploitation tradeoff implementation or the HiGHS WASM integration -- both were interesting engineering challenges.

---

## r/artificial

**Title:** I replaced 2,000 tokens of GPT-4 "reasoning" with a 0.01ms API call -- and it gave the correct answer (GPT-4 didn't)

**Body:**

I was building an AI agent that needed to pick the best variant in an A/B test. The standard approach: ask GPT-4 to "reason" about the data.

GPT-4 picked Variant B (42% conversion rate, 300 samples). The mathematically correct answer is Variant C (66.7% rate, 12 samples) -- because UCB1 accounts for exploration, not just exploitation. With only 12 samples, the confidence interval is wide enough that exploring C has higher expected value.

The LLM spent 2,000 tokens, 3 seconds, and $0.04 to arrive at the wrong answer.

So I built OraClaw -- 19 optimization/simulation/risk algorithms as a REST API. The bandit endpoint gives the correct UCB1 answer in 0.01ms for $0.01.

This isn't an argument against LLMs. It's an argument against asking LLMs to do math. LLMs are extraordinary at interpreting user intent, handling ambiguity, and generating plans. They're terrible at computing confidence intervals, solving linear programs, and running Monte Carlo simulations.

The right architecture: let the LLM decide *what* to optimize, then call a deterministic algorithm to *do* the optimization.

API is live with a free tier (100 calls/day, no signup): https://oraclaw-api.onrender.com

GitHub (MIT): https://github.com/Whatsonyourmind/oracle

---

## r/programming

**Title:** 19 optimization algorithms as a REST API -- bandits, LP solver, Monte Carlo, VaR -- all under 25ms, free tier, open-source

**Body:**

I built OraClaw because I kept seeing the same pattern: developers asking LLMs to "think about" optimization problems that have exact algorithmic solutions.

**What it is:** 17 REST endpoints covering 19 algorithms. Fastify 5, TypeScript, zero external service dependencies. All computation happens on the server in pure TS (except HiGHS which is WASM).

**The interesting endpoints:**

| Endpoint | Algorithm | Latency |
|----------|-----------|---------|
| `/api/v1/optimize/bandit` | UCB1 / Thompson / Epsilon-Greedy | 0.01ms |
| `/api/v1/solve/constraints` | LP/MIP via HiGHS (WASM) | 2ms |
| `/api/v1/simulate/montecarlo` | 6 distribution types, configurable iterations | 4ms |
| `/api/v1/analyze/risk` | VaR, CVaR, stress testing | 2ms |
| `/api/v1/optimize/cmaes` | CMA-ES continuous optimization | 12ms |
| `/api/v1/analyze/graph` | PageRank, Louvain communities | 0.5ms |
| `/api/v1/predict/forecast` | ARIMA + Holt-Winters | 0.08ms |

**Try it:**

```bash
curl -X POST https://oraclaw-api.onrender.com/api/v1/optimize/bandit \
  -H 'Content-Type: application/json' \
  -d '{"arms": [{"id": "A", "pulls": 500, "totalReward": 175}, {"id": "B", "pulls": 12, "totalReward": 8}], "algorithm": "ucb1"}'
```

No signup, no API key, 100 free calls/day.

Also ships as an MCP server (12 tools for AI agents) and 14 npm packages (`@oraclaw/bandit`, `@oraclaw/solver`, etc.).

1,072 tests. MIT license. Full source on GitHub: https://github.com/Whatsonyourmind/oracle

---

## r/SideProject

**Title:** I built an API that gives AI agents real math instead of "reasoning" -- 19 algorithms, 0.01ms latency, free tier, live now

**Body:**

**What:** OraClaw -- a decision intelligence API with 19 optimization, simulation, and risk algorithms.

**Why:** I was building AI agents and kept hitting the same wall: asking GPT-4 to pick the best A/B test variant, it spends $0.04 and 3 seconds to give a plausible-but-wrong answer. A multi-armed bandit algorithm gives the provably correct answer in 0.01ms for $0.01.

**The journey:**
- Started as a personal decision-making app (OODA loop framework)
- Added algorithms one by one as I needed them for actual problems
- Hit 19 algorithms, 1,072 tests, realized this should be an API
- Integrated HiGHS (industrial LP/MIP solver) via WASM -- that was a fun challenge
- Added MCP server support so AI agents (Claude, ChatGPT) can call the algorithms natively
- Built 14 npm SDK packages for direct integration

**Revenue model:** Free tier (100/day), then $9/mo to $199/mo. Also supports autonomous machine-to-machine payments via USDC on Base (x402 protocol) -- AI agents can pay per call without a human.

**Stack:** Fastify 5, TypeScript (strict), Expo 55 + React Native (mobile app), Next.js 15 (dashboard), PostgreSQL (Supabase), Turborepo monorepo.

**Current state:** API live on Render, npm packages published, 945+ tests on the core monorepo. Looking for early users and feedback.

Try it: https://oraclaw-api.onrender.com (just curl any endpoint, no signup)

GitHub: https://github.com/Whatsonyourmind/oracle

Would love feedback on the API design -- especially from anyone building AI agents or working in optimization.

---

## r/webdev

**Title:** Built a REST API with 17 endpoints that all respond in under 25ms -- here's how Fastify 5 + TypeScript made it possible

**Body:**

I built OraClaw, a decision intelligence API with 19 algorithms (bandits, LP solver, Monte Carlo, risk models, graph analysis). The performance story turned out to be the most interesting part.

**Latency breakdown:**
- 14/17 endpoints respond in under 1ms
- Heaviest endpoint (CMA-ES 10D): 22ms
- No external service calls at computation time -- everything runs in-process

**How:**

1. **Fastify 5** over Express. The difference is real -- Fastify's schema-based serialization means the JSON response is compiled at startup, not at request time. For endpoints returning in 0.01ms, serialization overhead matters.

2. **Pure TypeScript algorithms.** No Python subprocess, no external API call. The bandit algorithm is ~100 lines of math. The constraint solver uses HiGHS compiled to WASM -- runs in the same V8 isolate as the request handler.

3. **Zero allocation in hot paths.** The bandit and Bayesian endpoints reuse pre-allocated arrays. When your computation takes 0.01ms, a single unnecessary allocation shows up in the benchmark.

4. **MCP server** for AI agents -- 12 tools that Claude/ChatGPT can call natively. This was the most fun integration to build. If you're not familiar with MCP (Model Context Protocol), it lets AI agents call external tools as if they were native capabilities.

**Try it:**

```bash
curl -X POST https://oraclaw-api.onrender.com/api/v1/optimize/bandit \
  -H 'Content-Type: application/json' \
  -d '{"arms": [{"id": "A", "pulls": 500, "totalReward": 175}, {"id": "B", "pulls": 12, "totalReward": 8}], "algorithm": "ucb1"}'
```

Free tier, no signup, 100 calls/day. GitHub: https://github.com/Whatsonyourmind/oracle

---

## r/node

**Title:** Fastify 5 + HiGHS WASM + TypeScript: How I built 17 REST endpoints that all respond under 25ms

**Body:**

Sharing a project that pushed what I thought was possible with Node.js performance.

**OraClaw** is a decision intelligence API -- 19 algorithms (multi-armed bandits, LP/MIP solver, Monte Carlo simulation, graph analysis, risk models) running as a Fastify 5 server. Everything is TypeScript, no Python, no external compute services.

**The stack:**
- Fastify 5.8.4 (strict TypeScript)
- HiGHS via WASM for LP/MIP constraint solving
- graphology for graph algorithms (PageRank, Louvain communities)
- jstat + simple-statistics for distributions
- Turborepo monorepo with 14 npm packages

**Performance numbers (50-iteration benchmark on single core):**

| Endpoint | Avg Latency | Throughput |
|----------|------------|------------|
| Bandit (UCB1) | 0.01ms | 100K ops/s |
| Bayesian (3 factors) | 0.02ms | 50K ops/s |
| Anomaly Detection | 0.01ms | 100K ops/s |
| Constraint Solver (LP) | 2ms | 500 ops/s |
| Monte Carlo (5K sims) | 4ms | 250 ops/s |
| CMA-ES (10D) | 22ms | 45 ops/s |

**Interesting engineering decisions:**

1. HiGHS WASM integration was the hardest part. The `highs` npm package works, but loading the WASM module has a cold-start penalty. Solution: pre-load at server startup, keep the instance warm.

2. Fastify's schema-based serialization is a real advantage when your computation takes microseconds. Express's JSON.stringify overhead would dominate the response time at this scale.

3. The MCP server (Model Context Protocol) lets AI agents call these algorithms as native tools. 12 tools exposed. It's basically a JSON-RPC interface that Claude and ChatGPT understand natively.

4. Also published as 14 thin SDK packages (`@oraclaw/bandit`, `@oraclaw/solver`, etc.) -- each is just an API client, zero algorithm code leaked into client packages.

1,072 tests passing. MIT license.

Try it: `curl -X POST https://oraclaw-api.onrender.com/api/v1/optimize/bandit -H 'Content-Type: application/json' -d '{"arms":[{"id":"A","pulls":500,"totalReward":175},{"id":"B","pulls":12,"totalReward":8}],"algorithm":"ucb1"}'`

GitHub: https://github.com/Whatsonyourmind/oracle

---

## r/ChatGPT

**Title:** I gave Claude and ChatGPT real math tools instead of asking them to "reason" about optimization -- the difference is night and day

**Body:**

If you've ever asked ChatGPT to pick the best option in an A/B test, optimize a schedule, or calculate portfolio risk, you've probably noticed it gives confident-sounding answers that are often wrong.

That's because LLMs don't compute -- they pattern-match. When you ask for Value-at-Risk, it doesn't run a Monte Carlo simulation. When you ask it to pick the best A/B variant, it doesn't compute UCB1 scores. It generates text that *looks like* the output of those calculations.

I built OraClaw -- 19 real optimization algorithms that AI agents can call via MCP (Model Context Protocol). Instead of asking the LLM to think about the math, the LLM calls a tool that does the math correctly.

**How it works with Claude:**

Add the MCP server to your config:

```json
{
  "mcpServers": {
    "oraclaw": {
      "command": "npx",
      "args": ["tsx", "node_modules/@oraclaw/mcp-server/src/index.ts"]
    }
  }
}
```

Then ask Claude:

> "I have three pricing tiers being A/B tested. Tier A has 500 conversions from 2000 visitors, Tier B has 200 from 600, Tier C has 15 from 30. Which should I show next?"

Instead of reasoning about it (and probably getting it wrong), Claude calls `optimize_bandit` and gets the UCB1-optimal answer in 0.01ms. It then explains the result in natural language.

**Available tools:**
- `optimize_bandit` -- A/B testing with UCB1, Thompson, Epsilon-Greedy
- `optimize_contextual` -- Context-aware selection (LinUCB)
- `solve_constraints` -- LP/MIP optimization (uses the same solver as commercial OR software)
- `analyze_portfolio_risk` -- VaR, CVaR, stress testing
- `predict_forecast` -- ARIMA + Holt-Winters time series
- `detect_anomaly` -- Z-score and IQR anomaly detection
- Plus 6 more (12 total)

The LLM handles the conversation, intent, and explanation. OraClaw handles the math. Best of both worlds.

You can also just hit the REST API directly without MCP:

```bash
curl -X POST https://oraclaw-api.onrender.com/api/v1/optimize/bandit \
  -H 'Content-Type: application/json' \
  -d '{"arms": [{"id": "A", "pulls": 2000, "totalReward": 500}, {"id": "B", "pulls": 600, "totalReward": 200}, {"id": "C", "pulls": 30, "totalReward": 15}], "algorithm": "ucb1"}'
```

Free tier, no signup needed. GitHub (MIT): https://github.com/Whatsonyourmind/oracle
