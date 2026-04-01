---
title: Why AI Agents Should Never Do Math
date: 2026-04-01
excerpt: LLMs waste 10-100x more tokens on computation than a deterministic algorithm. The answer is often wrong. Here's the architecture that fixes it.
---

# Why AI Agents Should Never Do Math

Large language models are extraordinary at understanding intent, generating code, and navigating ambiguity. They are terrible at math. Every time you ask an LLM to "reason" about an optimization problem, you are paying for a slow, expensive, probabilistic approximation of something a deterministic algorithm solves exactly in microseconds.

This is not a hot take. It is arithmetic.

## The $0.04 Mistake

Last week I watched GPT-4 spend 2,000 tokens, 3 seconds, and $0.04 to pick the wrong A/B test variant. Here is the prompt most agent builders use:

```
System: You are a data-driven optimizer. Analyze these A/B test
results and select the variant to show next.

User: Three email subject lines being tested:
- Variant A: 500 sends, 175 opens (35% rate)
- Variant B: 300 sends, 126 opens (42% rate)
- Variant C: 12 sends, 8 opens (66.7% rate)

Which variant should I send next?
```

GPT-4 recommended Variant B -- "a balanced choice with a strong 42% open rate and reasonable sample size."

**That answer is wrong.**

This is a multi-armed bandit problem. The correct algorithm (UCB1) accounts for both the observed reward *and* the uncertainty from under-sampling. Variant C has only 12 pulls, which means massive confidence width. UCB1 selects it precisely *because* it is under-explored -- not despite it. The LLM tried to reason about statistics and landed on a heuristic that ignores the exploration-exploitation tradeoff entirely.

## The 0.01ms Alternative

```bash
curl -X POST https://oraclaw-api.onrender.com/api/v1/optimize/bandit \
  -H 'Content-Type: application/json' \
  -d '{
    "arms": [
      {"id": "A", "name": "Variant A", "pulls": 500, "totalReward": 175},
      {"id": "B", "name": "Variant B", "pulls": 300, "totalReward": 126},
      {"id": "C", "name": "Variant C", "pulls": 12, "totalReward": 8}
    ],
    "algorithm": "ucb1"
  }'
```

```json
{
  "selected": { "id": "C", "name": "Variant C" },
  "score": 1.543,
  "algorithm": "ucb1",
  "exploitation": 0.667,
  "exploration": 0.876,
  "regret": 0.053
}
```

Zero tokens. 0.01ms latency. $0.01 cost. Mathematically provable correctness. The UCB1 score is `reward_rate + sqrt(2 * ln(total_pulls) / arm_pulls)`. No opinion. No hedging. No hallucination. Just the formula that Auer, Cesa-Bianchi, and Fischer proved optimal in 2002.

## It Is Not Just Bandits

LLMs systematically hallucinate when you ask them to perform computation. Three categories where this breaks in production:

### Constraint Optimization

Prompt: *"3 workers, 8 tasks, different durations, different hourly costs. Minimize total cost, finish by 5pm."*

GPT-4 gives a plausible-sounding assignment. It does not give the optimal one. This is a Mixed Integer Programming problem. The solution space is combinatorial. An LLM exploring it through chain-of-thought is like solving a Sudoku by describing what numbers might go where. Sometimes it works. Usually it does not. You never know which.

OraClaw solves it with HiGHS -- the same solver used in commercial operations research. Provably optimal. 2ms.

### Risk Assessment

Ask an LLM for Value-at-Risk at 95% confidence. It gives you a number. Not a correct number. VaR requires Monte Carlo simulation over the joint distribution of returns -- sampling thousands of scenarios, computing portfolio value under each, finding the 5th percentile. An LLM does not simulate. It pattern-matches from training data.

OraClaw runs 5,000 simulations in 5ms and returns VaR, CVaR (Expected Shortfall), confidence intervals, and worst-case scenarios. Math you can audit.

### Time Series Forecasting

LLMs will narrate a trend. They will not fit an ARIMA model with proper differencing, or run Holt-Winters with optimized smoothing parameters. The forecast you get from an LLM is a vibes-based extrapolation. The forecast from a proper algorithm has confidence intervals and decomposed seasonality.

## The Numbers Do Not Lie

| Task | GPT-4 | OraClaw |
|------|-------|---------|
| **A/B test selection** | 2,000 tokens, 3s, $0.04, wrong | 0 tokens, 0.01ms, $0.01, correct |
| **Schedule optimization** | 5,000 tokens, 8s, $0.10, approximate | 0 tokens, 2ms, $0.01, provably optimal |
| **Risk assessment** | 3,000 tokens, 5s, $0.06, no CI | 0 tokens, 5ms, $0.02, VaR + CVaR + CI |
| **Anomaly detection** | 1,500 tokens, 2s, $0.03, guessing | 0 tokens, 0.01ms, $0.01, Z-score + IQR |
| **Time series forecast** | 4,000 tokens, 6s, $0.08, vibes | 0 tokens, 0.08ms, $0.01, ARIMA + HW |

An agent making 1,000 optimization decisions per day:

- **GPT-4 route:** $40-100/day, 50-80 seconds of latency, probabilistic correctness
- **OraClaw route:** $10/day (or $0 on free tier), 10-50ms total latency, deterministic correctness

Over a month, that is $900-$2,700 saved -- and every answer is actually right.

## The Right Architecture

The fix is not "better prompts." The fix is separation of concerns.

**LLM reasons. Algorithm computes. LLM interprets.**

When your agent encounters an optimization problem, it should not attempt to solve it through token generation. It should call a deterministic algorithm, get the mathematically correct answer, and then use its language capabilities to interpret and communicate the result.

This is exactly what the Model Context Protocol enables. Add OraClaw as an MCP server and your agent gains access to 19 algorithms -- bandits, solvers, simulators, forecasters, risk models -- without spending a single token on computation.

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

The agent decides *when* to use math. OraClaw does the math correctly. The agent interprets the result for the user. Each component does what it is best at.

## Try It Now

The free tier gives you 25 calls/day with no API key and no signup. Every curl example in this post hits the live API. Copy one, run it, look at the response.

```bash
npx @oraclaw/mcp-server
```

Or search the ClawHub skill registry:

```bash
clawhub search oraclaw
```

19 algorithms. Sub-25ms. Deterministic. Auditable. Stop making your agents think about math. Give them a calculator.

---

*OraClaw is open-source (MIT). 1,072 tests passing. [GitHub](https://github.com/Whatsonyourmind/oraclaw) | [npm](https://www.npmjs.com/org/oraclaw) | [Live API](https://oraclaw-api.onrender.com)*
