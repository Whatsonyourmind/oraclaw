# @oraclaw/solver

**Your AI scheduler that matches tasks to your energy.** Stop forcing deep work at 4pm. Let the optimizer plan your day around how you actually perform.

Industrial-grade LP/MIP solver (same tech behind airline scheduling and supply chains) — now in a simple API for daily planning, sprint planning, and resource allocation.

## Quick Start

```bash
npm install @oraclaw/solver
```

```typescript
import { OraSolver } from "@oraclaw/solver";

const solver = new OraSolver({ apiKey: "ok_live_..." });

const result = await solver.schedule(
  [
    { id: "report", name: "Q1 Financial Report", durationMinutes: 120, priority: 9, energyRequired: "high" },
    { id: "emails", name: "Process Inbox", durationMinutes: 30, priority: 3, energyRequired: "low" },
    { id: "design", name: "Review Design Specs", durationMinutes: 60, priority: 7, energyRequired: "medium" },
    { id: "standup", name: "Team Standup", durationMinutes: 15, priority: 8, energyRequired: "low" },
    { id: "research", name: "Competitor Analysis", durationMinutes: 90, priority: 6, energyRequired: "high" },
  ],
  [
    { id: "morning", startTime: 1711350000, durationMinutes: 120, energyLevel: "high" },
    { id: "mid-am", startTime: 1711357200, durationMinutes: 60, energyLevel: "medium" },
    { id: "lunch", startTime: 1711360800, durationMinutes: 30, energyLevel: "low" },
    { id: "afternoon", startTime: 1711364400, durationMinutes: 90, energyLevel: "medium" },
    { id: "late-pm", startTime: 1711369800, durationMinutes: 60, energyLevel: "low" },
  ],
);

// Result: Q1 Report → morning (high energy match)
//         Design Review → mid-am
//         Emails → lunch (low energy, low priority)
//         Research → afternoon
//         Standup → late-pm
```

## Custom Optimization

Solve any resource allocation problem with hard constraints:

```typescript
// Budget allocation: maximize ROI across 3 channels with constraints
const result = await solver.optimize({
  direction: "maximize",
  objective: { ads: 2.5, content: 1.8, events: 3.2 },  // ROI coefficients
  variables: [
    { name: "ads", lower: 0, upper: 50000 },
    { name: "content", lower: 0, upper: 30000 },
    { name: "events", lower: 0, upper: 20000, type: "integer" },
  ],
  constraints: [
    { name: "total_budget", coefficients: { ads: 1, content: 1, events: 1 }, upper: 80000 },
    { name: "min_content", coefficients: { content: 1 }, lower: 10000 },
  ],
});

console.log(result.solution);  // { ads: 50000, content: 10000, events: 20000 }
console.log(result.objectiveValue);  // 207000 (optimal ROI)
```

## For AI Agents

```json
{
  "mcpServers": {
    "oraclaw-solver": {
      "command": "npx",
      "args": ["tsx", "path/to/oraclaw-mcp/index.ts"],
      "description": "Task scheduling and constraint optimization for daily planning"
    }
  }
}
```

**MCP Tools:**
- `solve_schedule` — Optimal task-to-slot assignment with energy matching
- `solve_constraints` — General LP/MIP optimization for any resource problem

**Agent use cases:**
- "Plan my day optimally given these tasks and my energy curve"
- "Allocate this $50K budget across 4 marketing channels to maximize leads"
- "Schedule these 12 sprint tasks across 5 developers with skill matching"
- "Find the minimum-cost staffing plan that covers all shifts"

## Pricing

| Plan | Price | Calls/mo |
|------|-------|----------|
| Free | $0 | 3,000 |
| Starter | $9/mo | 10,000 |
| Growth | $29/mo | 100,000 |
| Scale | Custom | Unlimited |

## Why OraClaw Solver vs. Motion/Reclaim?

| | OraClaw Solver | Motion | Reclaim |
|--|---------------|--------|---------|
| **Custom constraints** | Any LP/MIP problem | Calendar only | Calendar only |
| **Energy matching** | Yes (high/med/low) | Basic | No |
| **Budget/resource optimization** | Yes (general solver) | No | No |
| **API-first** | Yes | No API | Limited API |
| **AI agent native (MCP)** | Yes | No | No |
| **Price** | $9/mo | $34/mo | $8/mo |

---

*@oraclaw/solver is a thin API client. All optimization runs server-side. No algorithm source code is included in this package.*
