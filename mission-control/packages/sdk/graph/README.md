# @oraclaw/graph

**Find the decisions that matter most.** PageRank for your projects. Community detection for your dependencies. Critical path through your roadmap.

Feed in any network of connected things — tasks, decisions, features, people — and get back: what's most influential, what clusters together, and what's the bottleneck.

## Quick Start

```bash
npm install @oraclaw/graph
```

```typescript
import { OraGraph } from "@oraclaw/graph";

const graph = new OraGraph({ apiKey: "ok_live_..." });

const analysis = await graph.analyze(
  [
    { id: "auth", type: "action", label: "Build Auth System", urgency: "critical", confidence: 0.8, impact: 0.9, timestamp: Date.now() },
    { id: "payments", type: "action", label: "Stripe Integration", urgency: "high", confidence: 0.6, impact: 0.8, timestamp: Date.now() },
    { id: "launch", type: "goal", label: "Public Launch", urgency: "critical", confidence: 0.5, impact: 1.0, timestamp: Date.now() },
    { id: "onboarding", type: "action", label: "User Onboarding Flow", urgency: "medium", confidence: 0.7, impact: 0.6, timestamp: Date.now() },
    { id: "monitoring", type: "action", label: "Error Monitoring", urgency: "low", confidence: 0.9, impact: 0.4, timestamp: Date.now() },
  ],
  [
    { source: "auth", target: "payments", type: "enables", weight: 0.9 },
    { source: "auth", target: "onboarding", type: "enables", weight: 0.8 },
    { source: "payments", target: "launch", type: "enables", weight: 0.9 },
    { source: "onboarding", target: "launch", type: "enables", weight: 0.7 },
    { source: "monitoring", target: "launch", type: "supports", weight: 0.3 },
  ],
  "auth",    // start
  "launch",  // end
);

console.log(analysis.pageRank);
// { auth: 0.31, payments: 0.24, launch: 0.22, onboarding: 0.15, monitoring: 0.08 }
// Auth is the most influential node — everything depends on it

console.log(analysis.bottlenecks);
// [{ id: "auth", score: 0.41 }, { id: "payments", score: 0.28 }]

console.log(analysis.criticalPath);
// ["auth", "payments", "launch"] — the shortest path to your goal

console.log(analysis.communities);
// { auth: 0, payments: 0, launch: 0, onboarding: 1, monitoring: 1 }
// Two clusters: core launch path vs. supporting features
```

## For AI Agents

```json
{
  "mcpServers": {
    "oraclaw-graph": {
      "command": "npx",
      "args": ["tsx", "path/to/oraclaw-mcp/index.ts"],
      "description": "Graph analysis — PageRank, communities, critical path, bottleneck detection"
    }
  }
}
```

**MCP Tool:** `analyze_decision_graph`

**Agent use cases:**
- "Which of these 20 Jira tickets is blocking the most other work?"
- "Cluster these 50 features into logical groups for sprint planning"
- "What's the critical path from current state to product launch?"
- "Rank these team members by influence in the communication network"

## Pricing

| Plan | Price | Analyses/mo |
|------|-------|------------|
| Free | $0 | 500 |
| Starter | $99/mo | 10,000 |
| Growth | $499/mo | 100,000 |

---

*@oraclaw/graph is a thin API client. All computation runs server-side. No algorithm source code is included in this package.*
