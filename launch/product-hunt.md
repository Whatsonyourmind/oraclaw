# OraClaw - Product Hunt Launch Draft

## Tagline (60 chars max)

Decision intelligence API for AI agents. 19 algorithms, <1ms.

## Short Description (260 chars max)

OraClaw gives AI agents real decision-making power -- bandits, solvers, forecasters, risk models -- without burning tokens on reasoning. 19 production-grade ML algorithms, sub-25ms latency, pay-per-call pricing. No ML expertise required. Free tier included.

## Detailed Description (1200 chars max)

Most AI agents waste tokens trying to "reason" about optimization, scheduling, and risk. OraClaw replaces that with 19 deterministic ML algorithms that return structured JSON in under 25ms.

What you get:
- Multi-Armed Bandits (UCB1, Thompson Sampling) for A/B testing any set of options
- CMA-ES and Genetic Algorithms for continuous and combinatorial optimization
- Monte Carlo simulation with 6 distribution types
- LP/MIP constraint solver (HiGHS) for resource allocation
- Bayesian inference, ensemble models, time series forecasting
- Portfolio risk (VaR/CVaR), anomaly detection, graph analysis

Every algorithm runs deterministically on a single CPU core. No GPU, no LLM calls, no model drift. Same input = same output, every time.

Integration options:
- REST API: curl any of 17 endpoints at oraclaw-api.onrender.com
- MCP Server: 12 tools for Claude, GPT, and other AI agents
- npm SDKs: 14 typed packages (@oraclaw/bandit, @oraclaw/solver, etc.)

Pricing starts free (100 calls/day, no auth). Paid tiers from $9/mo. AI agents can pay autonomously with USDC via x402 protocol at $0.01-$0.15 per call.

Built by a solo developer. 1,072 tests passing. MIT licensed.

## 5 Key Features

1. **19 Production ML Algorithms** -- Bandits, solvers, forecasters, risk models, anomaly detection, graph analysis, genetic algorithms, CMA-ES, Monte Carlo simulation, and more. All sub-25ms, 14 under 1ms.

2. **MCP Server for AI Agents** -- 12 tools that plug directly into Claude Code, Claude Desktop, or any MCP-compatible agent. Your AI calls `optimize_bandit` or `solve_constraints` and gets a statistically grounded answer instantly.

3. **Zero LLM Cost** -- Every endpoint runs a deterministic algorithm. No tokens burned, no GPU required, no model drift. The compute cost is effectively zero compared to LLM reasoning.

4. **Dual Payment Rails** -- Traditional Stripe billing (API keys, monthly plans) or autonomous USDC machine payments via x402 protocol. AI agents can pay for their own compute.

5. **14 npm SDK Packages** -- `@oraclaw/bandit`, `@oraclaw/solver`, `@oraclaw/simulate`, `@oraclaw/risk`, and 10 more. Each is a thin TypeScript client with full type safety. Install only what you need.

## Pricing

| Tier | Calls | Price | Auth Required |
|------|-------|-------|---------------|
| Free | 100/day | $0 | No |
| Starter | 10,000/mo | $9/mo | API key |
| Growth | 100,000/mo | $49/mo | API key |
| Scale | 1,000,000/mo | $199/mo | API key |
| Enterprise | Custom | Custom | API key |
| USDC Pay-per-call | Unlimited | $0.01-$0.15/call | x402 wallet |

## Topics / Tags

- Artificial Intelligence
- Developer Tools
- APIs
- Machine Learning
- SaaS

## Maker Comment (draft)

Hi PH! I'm Luka, a solo developer building OraClaw.

The idea is simple: AI agents are great at language but terrible at math. When your agent needs to decide between 5 A/B test variants, optimize a schedule, or assess portfolio risk, it either hallucinates an answer or burns thousands of tokens trying to reason through it.

OraClaw gives agents (and developers) access to 19 real ML algorithms via a simple API. Every call returns a deterministic, mathematically correct result in under 25ms.

The free tier requires no auth -- just curl the endpoint and get a result. I'd love your feedback on what algorithms to add next.
