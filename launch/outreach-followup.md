# OraClaw - Outreach Templates

---

## Template 1: Follow-Up with Previously Contacted Maintainers

**Subject:** Quick update -- OraClaw is live with [specific algorithm relevant to their project]

Hi [Name],

I reached out [timeframe] ago about OraClaw, a decision intelligence API for AI agents. Wanted to share a quick update -- the API is now live and you can try it without any signup:

```bash
curl -X POST https://oraclaw-api.onrender.com/api/v1/optimize/bandit \
  -H 'Content-Type: application/json' \
  -d '{"arms":[{"id":"A","pulls":10,"totalReward":7},{"id":"B","pulls":5,"totalReward":3}],"algorithm":"ucb1"}'
```

Since we last talked, we've shipped:
- 19 algorithms live (bandits, solvers, forecasters, risk models, anomaly detection)
- MCP server with 12 tools for AI agent integration
- 14 npm SDK packages (@oraclaw/*)
- x402 USDC machine payments (agents pay per-call autonomously)
- 1,072 tests passing, all endpoints under 25ms

I think [specific integration point with their project] could be a good fit. For example, [concrete use case showing how their project benefits].

Would you be open to a 15-minute call to explore this? Happy to set up a sandbox with your specific use case pre-configured.

Links:
- Live API: https://oraclaw-api.onrender.com
- GitHub: https://github.com/Whatsonyourmind/oracle
- npm: https://www.npmjs.com/org/oraclaw
- Docs: https://oraclaw-api.onrender.com/docs

Best,
Luka

---

## Template 2: NEW Outreach -- AI Agent Framework Maintainers

**Target frameworks:** CrewAI, AutoGen, LangGraph, LlamaIndex, Semantic Kernel, Haystack, Mastra, Vercel AI SDK, Phidata, Agency Swarm, TaskWeaver

**Subject:** Free tool integration: 19 ML algorithms for [Framework] agents (MCP + REST)

Hi [Name],

I'm Luka, creator of OraClaw -- a decision intelligence API that gives AI agents access to 19 production-grade ML algorithms (bandits, solvers, forecasters, risk models) without burning tokens on reasoning.

I think this could be a strong fit for [Framework] because [specific reason]:

**For CrewAI:** Agents making multi-step decisions can call `optimize_bandit` to select the best tool/approach based on historical performance, or `solve_constraints` to allocate resources across crew members optimally.

**For AutoGen:** Multi-agent conversations about optimization problems can be resolved in <1ms with a deterministic algorithm instead of multiple LLM rounds. Agents get mathematically correct answers instead of debating.

**For LangGraph:** Graph-based workflows can use `analyze_decision_graph` for PageRank and community detection on their state graphs, `plan_pathfind` for optimal routing through complex workflows, or `predict_forecast` for adaptive loop control.

**For LlamaIndex / Haystack:** RAG pipelines can use `score_convergence` to measure multi-source agreement, `score_calibration` for retrieval quality metrics, or `detect_anomaly` to flag outlier documents.

**For Vercel AI SDK / Mastra:** Streaming AI apps can add real decision logic -- `optimize_bandit` for feature flags, `simulate_montecarlo` for risk assessment, `predict_bayesian` for real-time belief updates.

Integration is simple:
- **MCP Server**: Add to your agent's tool config (12 tools, works with any MCP-compatible agent)
- **REST API**: Hit any of 17 endpoints -- free tier (100 calls/day) requires no auth
- **npm SDK**: `npm install @oraclaw/bandit` (14 typed packages)

Quick demo (try it now):
```bash
curl -X POST https://oraclaw-api.onrender.com/api/v1/optimize/bandit \
  -H 'Content-Type: application/json' \
  -d '{"arms":[{"id":"A","pulls":100,"totalReward":70},{"id":"B","pulls":100,"totalReward":55}],"algorithm":"ucb1"}'
```

I'd love to either:
1. Submit a PR adding OraClaw as an example tool integration
2. Write a guide showing [Framework] + OraClaw for a specific use case
3. Jump on a quick call to discuss the best integration path

What works best for you?

Links:
- Live API: https://oraclaw-api.onrender.com
- GitHub: https://github.com/Whatsonyourmind/oracle
- npm packages: https://www.npmjs.com/org/oraclaw
- MCP config example: https://github.com/Whatsonyourmind/oracle#quick-start

Best,
Luka Stanisljevic
github.com/Whatsonyourmind

---

## Template 3: Cold Outreach -- Developer Influencers / Newsletter Authors

**Subject:** Decision intelligence API -- might be interesting for [their newsletter/channel]

Hi [Name],

I follow [their content] and really enjoyed [specific piece]. Thought you might find this interesting:

I built OraClaw, a decision intelligence API that packages 19 ML algorithms (bandits, optimizers, solvers, forecasters) into simple REST endpoints. The idea: AI agents are great at language but terrible at math, so give them access to real algorithms instead of making them reason about optimization.

A few things that might catch your readers' attention:
- All 19 algorithms run in pure TypeScript, no GPU, under 25ms
- Free tier needs no auth -- just curl and get a result
- AI agents can pay per-call with USDC (x402 protocol) -- machine-to-machine payments
- MCP server lets Claude/GPT agents call algorithms directly
- 1,072 tests, CMA-ES hits 6e-14 on Rosenbrock, MIT licensed

Happy to provide a technical writeup, code samples, or jump on a call if you want to dig deeper.

Live API: https://oraclaw-api.onrender.com
GitHub: https://github.com/Whatsonyourmind/oracle

Cheers,
Luka
