# How can an AI agent run optimization, forecasting, and Monte Carlo math without doing it in the LLM?

Large language models are strong at language and weak at exact numerical work. Ask a model to pick the best A/B test variant and it tends to apply an informal heuristic that ignores the explore/exploit tradeoff. Ask it to solve a linear program and it can quietly invent constraints. Ask it for a forecast and you get a plausible-sounding number with no model behind it. None of these are reliable when an agent has to *act* on the answer.

The robust pattern is to let the agent **call a deterministic tool** for the math and keep the LLM for orchestration and explanation. The Model Context Protocol (MCP) makes that clean: the model sees a set of typed tools, decides which one fits the task, passes structured arguments, and gets structured JSON back. The numerical work happens in real algorithm implementations, not in token-by-token reasoning.

## A worked example: pick the next variant to try

Suppose your agent is running an email subject-line test. You have three variants with observed pulls and rewards, and you need to choose which one to send next while still exploring. That is a multi-armed bandit problem, and an LLM should not be guessing the answer.

Install the MCP server (no API key needed for the free tools):

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

Now the agent can call `optimize_bandit` directly. The same computation is reachable over plain HTTP, which is the easiest way to see exactly what comes back:

```bash
curl -X POST https://oraclaw-api.onrender.com/api/v1/optimize/bandit \
  -H 'Content-Type: application/json' \
  -d '{
    "arms": [
      {"id": "A", "name": "Short subject", "pulls": 500, "totalReward": 175},
      {"id": "B", "name": "Long subject",  "pulls": 300, "totalReward": 126},
      {"id": "C", "name": "Question subject", "pulls": 20, "totalReward": 9}
    ],
    "algorithm": "ucb1"
  }'
```

The response is a single, parseable object:

```json
{
  "selected": { "id": "C", "name": "Question subject" },
  "score": 0.78,
  "algorithm": "ucb1",
  "exploitation": 0.45,
  "exploration": 0.33,
  "regret": 0.12
}
```

Notice the breakdown: the chosen arm is not simply the one with the highest mean — UCB1 adds an exploration bonus for the under-sampled arm. The agent gets the decision *and* the components behind it, so it can explain why. The selection runs in well under a millisecond and costs no tokens.

## Choosing the right tool

The server exposes 17 tools, and each description is written to tell an agent exactly when to reach for it:

- **Selection under uncertainty:** `optimize_bandit`, and `optimize_contextual` when the best choice depends on per-call features (segment, time of day, current regime).
- **Constrained allocation:** `solve_constraints` for linear / mixed-integer / quadratic programs (provably optimal, via the HiGHS solver) and `solve_schedule` for fitting tasks into energy-matched time slots.
- **Search:** `optimize_cmaes` for continuous black-box parameters and `optimize_evolve` (genetic algorithm) for discrete, mixed, or multi-objective spaces.
- **Uncertainty quantification:** `simulate_montecarlo` for a single uncertain factor, `simulate_scenario` for what-if comparisons with a sensitivity ranking, and `analyze_risk` for Value-at-Risk / Conditional VaR on a weighted multi-asset series.
- **Time series:** `predict_forecast` (ARIMA / Holt-Winters) for projection and `detect_anomaly` (Z-score / IQR) for outliers.
- **Probability handling:** `predict_bayesian` to update a prior with weighted evidence, `predict_ensemble` to fuse model predictions, `score_convergence` to measure source agreement, and `score_calibration` to check whether past predictions were honest.
- **Graphs:** `analyze_graph` (PageRank, Louvain communities, critical path, bottlenecks) and `plan_pathfind` (A* with k-shortest paths).

Eleven of these run on the free tier with no API key (25 calls/day per IP); six premium tools — the LP/MIP solver, CMA-ES, graph analytics, VaR/CVaR, forecasting, and anomaly detection — are unlocked with an `ORACLAW_API_KEY`. Every tool returns structured JSON, runs in under 25 ms, and is deterministic except where an algorithm is inherently stochastic (Monte Carlo, the genetic algorithm, and the sampling bandit modes re-sample each call).

## The takeaway

If your agent needs a number it will act on — an allocation, a ranking, a forecast, a risk figure — don't make the language model do the arithmetic. Hand it a typed tool that returns a verifiable answer, and keep the LLM for deciding which tool to call and how to explain the result.

Add it in one line: `npx -y @oraclaw/mcp-server`.
