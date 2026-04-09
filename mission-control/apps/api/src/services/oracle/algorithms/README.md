# OraClaw Algorithms (Proprietary)

The algorithm implementations are not open-source.

**Use OraClaw via:**
- **MCP**: `clawhub install oraclaw-bandit`
- **SDK**: `npm install @oraclaw/bandit`
- **API**: https://oraclaw-api.onrender.com/api/v1/health

20 algorithms, 12 MCP tools, sub-5ms, zero LLM cost.

## Algorithm Catalog

| # | Algorithm | File | Category | Notes |
|---|-----------|------|----------|-------|
| 1 | Multi-Armed Bandit (UCB1 / Thompson / ε-Greedy) | `multiArmedBandit.ts` | Bandit | Context-free option selection |
| 2 | Contextual Bandit (LinUCB) | `contextualBandit.ts` | Bandit | Context-aware, UCB-style exploration |
| 3 | Thompson Sampling Contextual Bandit | `thompson-sampling.ts` | Bandit | Posterior-sampling counterpart to LinUCB (Agrawal-Goyal 2013) |
| 4 | Genetic Algorithm | `geneticAlgorithm.ts` | Optimization | Pareto frontier, multi-objective |
| 5 | Q-Learning | `qLearning.ts` | RL | Experience replay |
| 6 | A* Pathfinding | `astar.ts` | Search | Critical path + K-shortest |
| 7 | Ensemble Model | `ensemble.ts` / `ensembleModel.ts` | ML | Voting / stacking / BMA |
| 8 | Simulated Annealing | `simulatedAnnealing.ts` | Optimization | 5 cooling schedules |
| 9 | Markov Chain | `markovChain.ts` | Probability | State transitions |
| 10 | Attention Mechanism | `attention.ts` / `attentionMechanism.ts` | Neural | Multi-head |
| 11 | CMA-ES | `cmaes.ts` | Optimization | Continuous black-box |
| 12 | Constraint Optimizer (HiGHS) | `constraintOptimizer.ts` | Optimization | LP/MIP |
| 13 | Convergence Scoring | `convergenceScoring.ts` | Probability | Hellinger distance |
| 14 | Correlation Matrix | `correlationMatrix.ts` | Statistics | Portfolio VaR |
| 15 | Decision Graph | `decisionGraph.ts` | Graph | PageRank, Louvain |
| 16 | Anomaly Detector | `anomalyDetector.ts` | Detection | Z-score + IQR |
| 17 | Time Series (Holt-Winters) | `timeSeries.ts` | Forecasting | Triple exponential smoothing |

> Helper services (not standalone algorithms): `convergenceScoring`, `correlationMatrix`.
> Items are numbered by first-class public API endpoint, not by file count.

### Thompson Sampling Contextual Bandit (new)

Posterior-sampling variant of LinUCB. Each arm maintains a Bayesian
posterior `N(μ_a, v² Σ_a)` over linear reward weights. On every pull
we draw `θ_a ~ N(μ_a, v² Σ_a)` and pick the arm maximising `x^T θ_a`.

**Reference**: Agrawal & Goyal, "Thompson Sampling for Contextual Bandits
with Linear Payoffs" (ICML 2013).

**HTTP endpoints** (`thompson-sampling.route.ts`):

| Method | Path | Body | Purpose |
|--------|------|------|---------|
| POST | `/v1/thompson-sampling/init` | `{ armIds, d, v? }` | Zero-history state |
| POST | `/v1/thompson-sampling/select` | `{ state, context }` | Sample an arm |
| POST | `/v1/thompson-sampling/update` | `{ state, armId, context, reward }` | Bayesian update |
| POST | `/v1/thompson-sampling/recommend` | `{ armIds, d, history, context, v? }` | Single-shot replay + select |

**Why both LinUCB and Thompson Sampling?** LinUCB is deterministic and
gives tighter finite-sample regret bounds in theory; Thompson Sampling
tends to win on real datasets (Chapelle & Li, NeurIPS 2011) and naturally
diversifies exploration without a tunable UCB bonus. Serving both lets
callers pick the exploration strategy that fits their reward landscape.
