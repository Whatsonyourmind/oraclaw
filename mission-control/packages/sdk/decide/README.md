# @oraclaw/decide

**Make $1M decisions with $0 consultants.** Structured decision intelligence that turns gut feelings into quantified confidence. The OODA loop, automated.

McKinsey charges $500K for a strategy engagement. This gives you the analytical framework for $19/month.

## Quick Start

```bash
npm install @oraclaw/decide
```

```typescript
import { OraDecide } from "@oraclaw/decide";

const decide = new OraDecide({ apiKey: "ok_live_..." });

// Should we expand to Germany or France first?
const result = await decide.chooseBest([
  { id: "germany", name: "Germany Expansion", pulls: 12, totalReward: 8.4 },
  { id: "france", name: "France Expansion", pulls: 8, totalReward: 6.2 },
  { id: "nordics", name: "Nordic Bundle", pulls: 5, totalReward: 4.1 },
]);

// Are your advisors agreeing or giving conflicting signals?
const convergence = await decide.scoreConvergence([
  { id: "cfo", name: "CFO Analysis", probability: 0.72, lastUpdated: Date.now() },
  { id: "market", name: "Market Research", probability: 0.68, lastUpdated: Date.now() },
  { id: "advisor", name: "Board Advisor", probability: 0.45, lastUpdated: Date.now() },
]);
// convergence.details.outlierSources → ["advisor"] — your advisor disagrees
// convergence.score → 0.61 — moderate agreement, investigate the gap
```

## Decision Network Analysis

Map your decisions, find what's blocking you, and discover which choices have the highest ripple effect:

```typescript
const analysis = await decide.analyzeDecisionNetwork(
  [
    { id: "hire-cto", type: "decision", label: "Hire CTO", urgency: "critical", confidence: 0.4, impact: 0.9, timestamp: Date.now() },
    { id: "launch-v2", type: "goal", label: "Launch V2", urgency: "high", confidence: 0.6, impact: 0.8, timestamp: Date.now() },
    { id: "raise-seed", type: "decision", label: "Raise Seed Round", urgency: "high", confidence: 0.5, impact: 0.9, timestamp: Date.now() },
    { id: "product-market-fit", type: "signal", label: "PMF Signal", urgency: "medium", confidence: 0.7, impact: 0.7, timestamp: Date.now() },
  ],
  [
    { source: "hire-cto", target: "launch-v2", type: "enables", weight: 0.9 },
    { source: "product-market-fit", target: "raise-seed", type: "enables", weight: 0.8 },
    { source: "launch-v2", target: "product-market-fit", type: "influences", weight: 0.7 },
    { source: "raise-seed", target: "hire-cto", type: "enables", weight: 0.6 },
  ],
);

// analysis.pageRank → { "launch-v2": 0.34, "hire-cto": 0.28, ... }
// analysis.bottlenecks → [{ id: "hire-cto", score: 0.41 }]
// The CTO hire is the bottleneck blocking everything else
```

## For AI Agents

```json
{
  "mcpServers": {
    "oraclaw-decide": {
      "command": "npx",
      "args": ["tsx", "path/to/oraclaw-mcp/index.ts"],
      "description": "Decision intelligence — analyze options, map dependencies, score agreement"
    }
  }
}
```

**MCP Tools:**
- `optimize_bandit` — Best option from historical data
- `optimize_contextual` — Context-aware decisions
- `analyze_decision_graph` — PageRank + bottleneck detection
- `score_convergence` — Multi-source agreement scoring

**Agent use cases:**
- "Which of these 3 strategies should we pursue?"
- "Map the dependencies between these 8 decisions and find the critical path"
- "Our 4 data sources disagree — which one is the outlier?"
- "Given my current energy and deadline pressure, what should I decide on first?"

## Pricing

| Plan | Price | Decisions/mo |
|------|-------|-------------|
| Free | $0 | 100 |
| Pro | $19/mo | 2,000 |
| Team | $49/seat/mo | 10,000 |
| Enterprise | $99/seat/mo | Unlimited + SSO |

---

*@oraclaw/decide is a thin API client. All computation runs server-side. No algorithm source code is included in this package.*
