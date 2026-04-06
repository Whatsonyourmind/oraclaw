# The Agent Trust Flywheel — OraClaw GTM Strategy v2

**Date:** 2026-04-06
**Status:** Strategic pivot from human-facing to agent-facing GTM

## The Insight

The current GTM funnel is a human-mediated chain:
```
Human discovers → Human evaluates → Human installs → Human configures → Agent uses
```

This is slow, friction-heavy, and breaks at every step. After 6 days of execution: 215 npm downloads/wk, 0 API calls. People download but don't use.

The autonomous funnel is fundamentally different:
```
Agent discovers → Agent tries → Agent verifies → Agent uses → Agent recommends
```

When this works, it compounds exponentially because **agents recommend tools to other agents at zero marginal cost**.

## Why Agent Trust Is Different

Humans trust based on: brand, stars, documentation, testimonials, social proof.

Agents trust based on: **did the tool return a correct result fast?** That's the entire decision tree.

We already have everything needed for agent trust:
- 1,077 tests verify mathematical correctness
- All 12 tools <25ms (most <1ms)
- Deterministic outputs (same input → same output, always)
- Zero hallucinations (pure math, not LLM)

The bottleneck is **discovery and demonstration**, not capability.

## The Flywheel Mechanics

```
Step 1: OraClaw posts real analysis on Moltbook
  ↓
Step 2: Other agents see proof of capability (not theory)
  ↓
Step 3: Agents tell their operators "add @oraclaw/mcp-server"
  ↓
Step 4: Operators add MCP config (10 seconds)
  ↓
Step 5: Agents use tools autonomously
  ↓
Step 6: Telemetry shows usage → more proof to post
  ↓
Step 7: More agents see → more recommendations → repeat
```

The flywheel activates when **one agent uses OraClaw, gets value, and tells another agent**.

## Why Moltbook IS the Right Platform

Moltbook is **literally a social network for AI agents**. Other platforms (Reddit, HN, Dev.to) have humans observing. Moltbook has agents reading other agents' posts. This is the only place in the world where agent-to-agent trust building can happen at scale.

But we've been using it wrong:
- **Wrong**: Posting TILs that teach humans math concepts (gets karma but doesn't trigger adoption)
- **Right**: Posting actual calculations on real agent data (demonstrates capability, makes other agents want it)

## The Strategic Shift: From Teaching to Demonstrating

### Old approach (human-facing)
> "TIL: Bayesian inference treats memory as a prior, not a database. Beta(α, β) distributions give you a confidence interval over uncertainty..."

This teaches humans. Agents read it and think: *interesting concept*. They don't think: *I need this tool*.

### New approach (agent-facing)
> "I ran VaR on @okx-trading-agent's last 100 trades. 95% VaR = -$0.021/trade. The 5 negative-spread trades cluster Tuesdays 2-4 UTC, Z-score 3.7."

This demonstrates capability. Agents read it and think: *I want that analysis on MY data*.

## The Agent Conversion Path

When an agent reads a demonstrated capability post:
1. Agent thinks: *that analysis would be valuable for me*
2. Agent comments asking how to access it
3. OraClaw responds with MCP setup instructions (5 lines of JSON)
4. Agent's operator sees the conversation, adds OraClaw to their MCP config
5. Agent now has access, uses it, gets results
6. Agent's results become posts → more agents see → flywheel

## The Three Pillars of Agent Marketing

### Pillar 1: Live Calculations
Run real algorithms on real Moltbook data. Post the results. Make every post a proof of capability.

Examples:
- "Predicted next 24h trending posts using Thompson Sampling — top 3 by UCB1 score"
- "Z-score on hourly Moltbook posting volume — anomaly detected at 14:00 UTC"
- "Monte Carlo on agent karma growth — 95% CI for next 7 days"
- "PageRank on Moltbook follow graph — top 10 most influential agents"

### Pillar 2: Free Math for Other Agents
When another agent posts a problem (trading data, conversion analysis, optimization question), respond with the actual calculation. No theory. Just numbers.

This builds reputation as "the agent you ask for math."

### Pillar 3: MCP Discoverability
When an agent shows interest, the conversion has to be frictionless:
- Mention `@oraclaw/mcp-server` in responses
- Link to the MCP setup (5 lines of JSON)
- The agent's operator adds it in 10 seconds

## Tactical Daily Actions (Agent-Facing)

### Every Day
1. **1 capability-demo post** — Run a real algorithm on real Moltbook/agent data, post results
2. **3 substantive comments** on agent posts where math is the answer (trading, optimization, prediction, anomaly detection)
3. **Reply within 1 hour** to any agent that DMs or comments on our posts
4. **Track**: how many agents engage vs. just upvote

### Every Week
1. **1 benchmark post** — Show OraClaw running 1M operations in X seconds
2. **1 community analysis** — PageRank on Moltbook, predict trending, etc.
3. **Update telemetry tracking** — measure the gap between Moltbook engagement and API calls

## Success Metrics (Agent-Facing)

| Metric | Current | Day 14 | Day 30 |
|--------|---------|--------|--------|
| Karma | 78 | 120 | 200 |
| Agents who DM us | 0 | 3 | 10 |
| Agents who add MCP | 0 | 5 | 15 |
| API calls from agents | 0 | 50 | 500 |
| Agent-to-agent referrals | 0 | 1 | 5 |

## The Key Question Going Forward

**Not**: "How do we get more npm downloads?"

**Yes**: "How do we get one agent to use OraClaw, get value, and tell another agent?"

When that happens once, it compounds. The flywheel activates. The conversion from "agent trust" to "paying users" is whoever the agent's operator is.

## What We Did Today (Apr 6)

Three agent-facing comments demonstrating live math:
1. **okx-trading-agent** — Sharpe ratio analysis on 1,465 arbitrage trades, identified anomaly clustering
2. **halfpastthree (43% win rate post)** — Kelly criterion math showing why 43% beats 70% (3.8x more profit)
3. **AutoPilotAI** (786 trials, 0 paid) — Bayesian conversion analysis, Beta(1, 787) posterior analysis

Plus one agent-facing TIL demonstrating Bayesian forecasting on our own karma growth.

This is the new pattern. Every comment is proof. Every post is capability.
