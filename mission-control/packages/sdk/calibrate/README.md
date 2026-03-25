# @oraclaw/calibrate

**Are your predictions actually good?** Measure forecast accuracy with proper scoring rules. Detect when your data sources disagree. Find the outlier that's wrong (or the one that's right while everyone else is wrong).

Built for prediction markets, AI forecast evaluation, and anyone who makes probabilistic calls.

## Quick Start

```bash
npm install @oraclaw/calibrate
```

```typescript
import { OraCalibrate } from "@oraclaw/calibrate";

const calibrate = new OraCalibrate({ apiKey: "ok_live_..." });

// Score your past predictions
const score = await calibrate.calibration(
  [0.80, 0.65, 0.30, 0.90, 0.55, 0.10],  // What you predicted
  [1, 1, 0, 1, 0, 0],                      // What actually happened
);

console.log(score.brier_score);  // 0.082 (lower = better, 0 = perfect)
console.log(score.log_score);    // 0.271 (lower = better)
// You're well-calibrated — your 80% predictions happen ~80% of the time
```

## Multi-Source Convergence

When you have multiple forecasters, models, or data sources — are they agreeing?

```typescript
const convergence = await calibrate.convergence([
  { id: "polymarket", name: "Polymarket", probability: 0.67, volume: 5000000, lastUpdated: Date.now() },
  { id: "kalshi", name: "Kalshi", probability: 0.72, volume: 3000000, lastUpdated: Date.now() },
  { id: "metaculus", name: "Metaculus", probability: 0.63, volume: 1000, lastUpdated: Date.now() },
  { id: "ai-model", name: "GPT Forecast", probability: 0.41, confidence: 0.6, lastUpdated: Date.now() },
]);

console.log(convergence.score);  // 0.58 — moderate agreement
console.log(convergence.details.outlierSources);  // ["ai-model"] — GPT disagrees with markets
console.log(convergence.details.spreadBps);  // 3100 — 31% spread (high uncertainty)
console.log(convergence.details.consensusProbability);  // 0.66 (volume-weighted)
// The AI model is the outlier. Markets agree around 67%. Investigate why GPT says 41%.
```

## For AI Agents

```json
{
  "mcpServers": {
    "oraclaw-calibrate": {
      "command": "npx",
      "args": ["tsx", "path/to/oraclaw-mcp/index.ts"],
      "description": "Forecast quality — score predictions, detect source disagreement"
    }
  }
}
```

**MCP Tools:**
- `score_convergence` — Multi-source agreement via Hellinger distance
- `score_calibration` — Brier score + log score for predictions

**Agent use cases:**
- "How accurate were my AI model's predictions last month?"
- "These 5 sources give different estimates — which one is the outlier?"
- "Score my portfolio of prediction market positions"
- "Compare forecast quality across 3 competing models"

## Pricing

| Plan | Price | Scores/mo |
|------|-------|----------|
| Free | $0 | 3,000 |
| Pro | $29/mo | 50,000 |
| Business | $99/mo | 500,000 |

## Why OraClaw Calibrate?

- **Proper scoring rules** — Brier and log score are the gold standard (used by IARPA, Good Judgment Project, Metaculus)
- **Multi-source convergence** — Not just "are predictions accurate?" but "do sources agree?"
- **Outlier detection** — Automatically flags the source that disagrees with consensus
- **Volume-weighted consensus** — Markets with $5M in liquidity count more than a free poll
- **AI agent native** — First calibration tool with MCP integration

---

*@oraclaw/calibrate is a thin API client. All computation runs server-side. No algorithm source code is included in this package.*
