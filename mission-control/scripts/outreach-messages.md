# OraClaw Launch Outreach — 10 Personalized Messages

## Target: AI Agent Builders on GitHub (find via search)

### Search queries to find targets:
```
GitHub: "openclaw" "skill" pushed:>2026-03-01
GitHub: "langchain" "tools" language:python stars:>50 pushed:>2026-03-01
GitHub: "crewai" "agent" language:python pushed:>2026-03-01
GitHub: "mcp" "server" language:typescript stars:>20 pushed:>2026-03-01
GitHub: "ai agent" "optimization" pushed:>2026-03-01
```

---

### Message 1: OpenClaw Skill Builder
> Hey [name], saw your [skill-name] OpenClaw skill — nice work. I built a set of computational tools (bandits, LP solver, forecasting) as MCP tools that pair well with what you're building. They fill the "math" gap — things like optimal scheduling, anomaly detection, A/B testing. All sub-5ms, zero LLM cost. `clawhub install oraclaw-bandit` if you want to try. Happy to help integrate.

### Message 2: LangChain Agent Developer
> Hey [name], noticed your [agent-name] LangChain agent. I made a set of decision intelligence tools (OraClaw) — things LLMs are bad at: optimal scheduling (LP solver), A/B testing (contextual bandits), anomaly detection, time series forecasting. All sub-5ms, math-based, not LLM-based. I have LangChain tool wrappers ready: `from oraclaw_tools import OraBanditTool, OraSolverTool`. Want me to send the Python file?

### Message 3: CrewAI Multi-Agent Developer
> Hey [name], love the multi-agent setup in [repo]. One thing I noticed: when your agents disagree, how do you decide? I built `oraclaw-ensemble` — it mathematically combines multiple agent outputs into an optimal consensus with uncertainty quantification. Also have a contextual bandit that learns which agent is best for which task. MCP server, works with CrewAI. Want to try?

### Message 4: Trading/Finance Agent Builder
> Hey [name], saw your [trading-bot]. I built OraClaw — a set of financial computation tools: Monte Carlo simulation (5K iterations in 1.3ms), VaR/CVaR with correlation matrices, anomaly detection, ARIMA forecasting. All via MCP — your agent calls them like any tool. No LLM cost, pure math. Might be useful for risk calculations in your pipeline?

### Message 5: Scheduling/Productivity Agent
> Hey [name], your [scheduler/planner] is cool. I built an LP/MIP solver (HiGHS, same tech airlines use) that does optimal task scheduling with energy matching — assigns high-priority tasks to high-energy time slots. It's 3ms and provably optimal (not heuristic). Available as MCP tool. Want to see it in action on your use case?

### Message 6: MCP Server Developer
> Hey [name], saw your [mcp-server] — great implementation. I built a complementary MCP server (OraClaw) with 12 decision intelligence tools: bandits, LP solver, graph analytics (PageRank), anomaly detection, CMA-ES optimizer, forecasting. Zero overlap with your tools — they compose well. Could cross-reference in READMEs?

### Message 7: Data Analysis Agent
> Hey [name], your data analysis agent looks solid. One gap I see in most data agents: they can detect patterns but can't score if something is actually anomalous (vs just different). I built `oraclaw-anomaly` — statistical z-score/IQR detection that answers "is this data point abnormal?" in 0.04ms. Also have convergence scoring for "do these data sources agree?" Worth a look?

### Message 8: Project Management Agent
> Hey [name], saw your [pm-agent]. Two tools that might help: (1) `oraclaw-graph` — feed in your tasks as nodes and dependencies as edges, get back PageRank (which task matters most), bottlenecks, and critical path. (2) `oraclaw-pathfind` — A* optimal sequencing. Both <1ms. Would make your agent's dependency analysis much sharper.

### Message 9: ML/Hyperparameter Tuning Agent
> Hey [name], noticed you're doing hyperparameter tuning in [repo]. I implemented CMA-ES (the SOTA continuous optimizer — what Google uses internally) as an MCP tool. It's 10-100x more sample-efficient than grid search, converges on Rosenbrock to 6e-14 in 1.2ms. If your agent needs to tune continuous params, this replaces your grid search loop.

### Message 10: General AI Agent Framework
> Hey [name], your agent framework is impressive. I built OraClaw — 12 MCP tools that give agents mathematical superpowers: optimal decisions (bandits), scheduling (LP solver), forecasting (ARIMA), anomaly detection, graph analysis (PageRank), continuous optimization (CMA-ES). All sub-5ms, zero LLM cost. The idea: use LLMs for reasoning, use OraClaw for computation. They're complementary. `clawhub install oraclaw-bandit` to try.

---

## Key messaging principles:
1. Lead with THEIR project, not yours
2. Identify a specific gap
3. Offer a concrete tool for that gap
4. Give install command (one line)
5. Offer to help integrate
6. Short — under 100 words
