# @oraclaw/bandit

**Ship winning features 3x faster.** Stop guessing which variant wins — let the algorithm find it while maximizing conversions.

Drop-in replacement for Statsig, Eppo, and LaunchDarkly's experimentation layer. No data warehouse needed. Works from the first request.

## Quick Start

```bash
npm install @oraclaw/bandit
```

```typescript
import { OraBandit } from "@oraclaw/bandit";

const bandit = new OraBandit({ apiKey: "ok_live_..." });

// Which checkout flow converts best?
const result = await bandit.optimize([
  { id: "single-page", name: "Single Page Checkout", pulls: 1200, totalReward: 420 },
  { id: "multi-step", name: "Multi-Step Wizard", pulls: 800, totalReward: 312 },
  { id: "express", name: "Express Checkout", pulls: 400, totalReward: 180 },
]);

console.log(result.selected.name); // "Express Checkout"
console.log(result.score);         // 0.487 (UCB1 score)
```

## Context-Aware Optimization

Not all users are the same. LinUCB learns which variant works best **for each context**:

```typescript
const result = await bandit.optimizeContextual(
  [
    { id: "long-form", name: "Detailed Product Page" },
    { id: "quick-buy", name: "One-Click Purchase" },
    { id: "comparison", name: "Side-by-Side Compare" },
  ],
  // Context: [timeOfDay, isMobile, priceRange, returningUser]
  [0.75, 1.0, 0.3, 1.0],  // Evening, mobile, low price, returning
  // Historical observations (learns over time)
  previousObservations,
);

// Mobile returning users in evening → "One-Click Purchase" wins
// Desktop new users at noon → "Side-by-Side Compare" wins
// The algorithm discovers this automatically
```

## For AI Agents

Add to your Claude Code / AI agent config:

```json
{
  "mcpServers": {
    "oraclaw-bandit": {
      "command": "npx",
      "args": ["tsx", "path/to/oraclaw-mcp/index.ts"],
      "description": "A/B testing optimization — pick the best variant automatically"
    }
  }
}
```

**MCP Tools available:**
- `optimize_bandit` — Best variant selection (UCB1, Thompson Sampling, ε-Greedy)
- `optimize_contextual` — Context-aware selection (learns user segments automatically)

**Agent use cases:**
- "Which email subject line should I send to this segment?"
- "Should I show the upsell modal to this user?"
- "Which prompt template performs best for this task type?"

## Pricing

| Plan | Price | Calls/mo |
|------|-------|----------|
| Free | $0 | 3,000 |
| Starter | $49/mo | 50,000 |
| Growth | $199/mo | 500,000 |
| Scale | Custom | Unlimited |

## Why OraClaw Bandit vs. Statsig/Eppo?

| | OraClaw Bandit | Statsig | Eppo |
|--|---------------|---------|------|
| **Works from request #1** | Yes (Thompson Sampling) | No (needs sample size) | No |
| **Context-aware** | Yes (LinUCB) | Limited | Limited |
| **No data warehouse needed** | Yes | Requires warehouse | Requires warehouse |
| **AI agent native (MCP)** | Yes | No | No |
| **Price (50K decisions/mo)** | $49/mo | $299/mo | Custom |
| **Zero LLM cost** | Yes (pure math) | Yes | Yes |

---

*@oraclaw/bandit is a thin API client. All optimization runs server-side. No algorithm source code is included in this package.*
