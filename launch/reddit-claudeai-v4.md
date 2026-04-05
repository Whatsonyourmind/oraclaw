# r/ClaudeAI Post — v4 (6/6 split, Apr 5)

**Title:** I gave Claude real math tools via MCP — 12 algorithms, all under 25ms, 6 free

**Body:**

I kept running into the same problem: Claude is great at reasoning about what to optimize, but when you actually need it to *do the math* — pick the best A/B variant, solve a scheduling problem, run a Monte Carlo simulation — it burns thousands of tokens to approximate what a real algorithm does in 2ms.

So I built an MCP server with 12 optimization algorithms that handle the math correctly.

**30-second setup:**
```json
{
  "mcpServers": {
    "oraclaw": {
      "command": "npx",
      "args": ["-y", "@oraclaw/mcp-server"]
    }
  }
}
```

**6 free tools (no signup needed):**
- **Multi-armed bandits** (UCB1/Thompson/epsilon-Greedy) — "which option should I pick?"
- **Contextual bandits** (LinUCB) — context-aware selection
- **Monte Carlo simulation** — risk modeling, scenario analysis
- **Task scheduler** — energy-matched time slot allocation
- **A* pathfinding** — optimal routing with k-shortest paths
- **Convergence scoring** — multi-source agreement measurement

**6 premium tools (free API key signup):**
- **LP/MIP solver** (HiGHS) — scheduling, budget allocation, constraint satisfaction
- **Graph analytics** — PageRank, Louvain communities, shortest path
- **Anomaly detection** — Z-score/IQR outlier detection
- **Time series forecasting** — ARIMA/Holt-Winters with confidence intervals
- **CMA-ES optimization** — continuous parameter tuning
- **Portfolio risk** — VaR/CVaR with correlation matrices

Free tools work instantly with zero config. Premium tools just need a free API key (`curl -X POST oraclaw-api.onrender.com/api/v1/auth/signup -d '{"email":"you@example.com"}'`).

Every tool returns deterministic, mathematically correct results. No LLM tokens burned on trying to do math.

**Performance:** 14/18 algorithms under 1ms. All under 25ms. 1,076 tests passing. Glama AAA rating.

GitHub: https://github.com/Whatsonyourmind/oraclaw
npm: `@oraclaw/mcp-server` (v1.1.1)

What decision-making problems are you running into with Claude? Curious which algorithms would be most useful.

---

## Prepared responses for likely questions:

**Q: "How is this different from just using scipy/numpy?"**
A: Those are local Python libraries you'd need to set up. This is an MCP server — Claude can call these tools directly in conversation. No Python env needed, no code to write. Ask Claude "which A/B variant should I pick" and it uses the bandit, not a chain-of-thought guess.

**Q: "Is this free?"**
A: 6 tools are completely free, no signup. 6 premium tools need a free API key (takes 10 seconds, no credit card). After that, pay-per-call is $0.005 if you want higher limits.

**Q: "Can I self-host?"**
A: The MCP server runs locally on your machine via npx. The free tools work offline. Premium tools call the hosted API for authentication.

**Q: "Is this AI-generated?"**
A: The algorithms are pure TypeScript implementations — UCB1, Thompson Sampling, HiGHS LP solver, etc. 1,076 tests verify mathematical correctness. CMA-ES achieves 6e-14 on the Rosenbrock function.

**Q: "Why not just ask Claude to do the math?"**
A: Claude spent 3 weeks picking the wrong A/B variant because it "reasoned" about statistics instead of computing them. A Thompson Sampling bandit catches the winner on day one. LLMs hallucinate math. Algorithms don't.
