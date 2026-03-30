export interface AlgorithmExample {
  name: string;
  description: string;
  input: Record<string, unknown>;
}

export const ALGORITHM_EXAMPLES: Record<string, AlgorithmExample> = {
  bandit: {
    name: "Multi-Armed Bandit",
    description:
      "Choose the best option among 3 alternatives with uncertain payoffs. UCB1 balances exploitation of known-good options with exploration of uncertain ones.",
    input: {
      arms: [
        { id: "A", name: "Option A", pulls: 10, totalReward: 7 },
        { id: "B", name: "Option B", pulls: 10, totalReward: 5 },
        { id: "C", name: "Option C", pulls: 2, totalReward: 1.8 },
      ],
      algorithm: "ucb1",
    },
  },

  "contextual-bandit": {
    name: "Contextual Bandit (LinUCB)",
    description:
      "Make context-aware decisions using feature vectors. The bandit learns which arm performs best given the current context (time of day, energy level, etc.).",
    input: {
      arms: [
        { id: "email", name: "Email campaign" },
        { id: "social", name: "Social media" },
        { id: "search", name: "Search ads" },
      ],
      context: [0.8, 0.6, 0.3],
      history: [
        { armId: "email", reward: 0.7, context: [0.9, 0.5, 0.2] },
        { armId: "social", reward: 0.4, context: [0.3, 0.8, 0.7] },
      ],
      alpha: 1.0,
    },
  },

  evolve: {
    name: "Genetic Algorithm",
    description:
      "Evolutionary optimization that evolves a population of solutions. Tournament selection, crossover, and mutation to find optimal parameter configurations.",
    input: {
      geneLength: 5,
      populationSize: 50,
      maxGenerations: 100,
      bounds: { min: 0, max: 10, type: "real" },
      mutationRate: 0.01,
      crossoverRate: 0.8,
      selectionMethod: "tournament",
      fitnessWeights: [2, 1, 3, 1, 2],
    },
  },

  cmaes: {
    name: "CMA-ES",
    description:
      "Covariance Matrix Adaptation for continuous optimization. State-of-the-art derivative-free optimizer for finding global optima.",
    input: {
      dimension: 3,
      initialMean: [1.0, 1.0, 1.0],
      initialSigma: 0.5,
      maxIterations: 500,
      objectiveWeights: [2.0, 3.0, 1.5],
    },
  },

  montecarlo: {
    name: "Monte Carlo Simulation",
    description:
      "Run 1000 simulations with a normal distribution. Returns statistical summary including percentiles, mean, standard deviation, and histogram.",
    input: {
      simulations: 1000,
      distribution: "normal",
      params: { mean: 100, stddev: 15 },
    },
  },

  scenario: {
    name: "Scenario Planning",
    description:
      "Compare 3 what-if scenarios against a base case. Calculates deltas, per-variable impact, and sensitivity rankings.",
    input: {
      baseCase: { revenue: 1000000, costs: 600000, growth: 10 },
      scenarios: [
        {
          name: "Optimistic",
          variables: { revenue: 1500000, costs: 650000, growth: 25 },
        },
        {
          name: "Pessimistic",
          variables: { revenue: 800000, costs: 700000, growth: 2 },
        },
        {
          name: "High Growth",
          variables: { revenue: 1200000, costs: 900000, growth: 40 },
        },
      ],
    },
  },

  constraints: {
    name: "Constraint Optimizer (LP/MIP)",
    description:
      "Maximize profit subject to resource constraints using linear programming. HiGHS solver (production-grade, WASM).",
    input: {
      objective: {
        coefficients: [5, 4, 3],
        direction: "maximize",
      },
      constraints: [
        { coefficients: [6, 4, 2], rhs: 240, type: "leq" },
        { coefficients: [3, 2, 5], rhs: 270, type: "leq" },
        { coefficients: [1, 1, 1], rhs: 60, type: "leq" },
      ],
      bounds: [
        { lower: 0 },
        { lower: 0 },
        { lower: 0 },
      ],
    },
  },

  schedule: {
    name: "Schedule Optimizer",
    description:
      "Assign 4 tasks to 3 time slots respecting duration and priority constraints.",
    input: {
      tasks: [
        { id: "design", duration: 2, priority: 3 },
        { id: "code", duration: 3, priority: 5 },
        { id: "test", duration: 1, priority: 4 },
        { id: "deploy", duration: 1, priority: 2 },
      ],
      slots: [
        { id: "morning", start: "09:00", end: "12:00", capacity: 3 },
        { id: "afternoon", start: "13:00", end: "17:00", capacity: 4 },
        { id: "evening", start: "18:00", end: "20:00", capacity: 2 },
      ],
    },
  },

  graph: {
    name: "Decision Graph",
    description:
      "Analyze a network of decisions with PageRank scoring, community detection, and shortest path analysis.",
    input: {
      nodes: [
        { id: "market-research", type: "decision", weight: 0.8 },
        { id: "build-mvp", type: "decision", weight: 0.9 },
        { id: "hire-team", type: "decision", weight: 0.7 },
        { id: "launch", type: "goal", weight: 1.0 },
        { id: "fundraise", type: "decision", weight: 0.6 },
      ],
      edges: [
        { source: "market-research", target: "build-mvp", weight: 0.9 },
        { source: "build-mvp", target: "launch", weight: 0.95 },
        { source: "hire-team", target: "build-mvp", weight: 0.8 },
        { source: "fundraise", target: "hire-team", weight: 0.7 },
        { source: "market-research", target: "fundraise", weight: 0.5 },
      ],
      sourceGoal: "market-research",
      targetGoal: "launch",
    },
  },

  risk: {
    name: "Portfolio Risk (VaR/CVaR)",
    description:
      "Calculate Value at Risk and Conditional VaR for a 3-asset portfolio with 30 days of historical returns.",
    input: {
      weights: [0.4, 0.35, 0.25],
      returns: [
        [0.01, -0.005, 0.008, 0.003, -0.01, 0.007, 0.002, -0.003, 0.005, 0.001],
        [-0.002, 0.008, -0.003, 0.006, 0.004, -0.007, 0.009, 0.001, -0.004, 0.003],
        [0.005, 0.003, -0.001, -0.004, 0.006, 0.002, -0.005, 0.008, 0.001, -0.002],
      ],
      confidence: 0.95,
      horizonDays: 1,
    },
  },

  bayesian: {
    name: "Bayesian Inference",
    description:
      "Update a prior belief (60% probability) with 3 evidence factors. Returns posterior probability, calibration score, and credible interval.",
    input: {
      prior: 0.6,
      evidence: [
        { factor: "market_trend", weight: 0.8, value: 0.75 },
        { factor: "competitor_analysis", weight: 0.5, value: 0.4 },
        { factor: "user_feedback", weight: 0.9, value: 0.85 },
      ],
    },
  },

  ensemble: {
    name: "Ensemble Model",
    description:
      "Combine predictions from 4 different models using weighted voting. Returns consensus value with uncertainty quantification.",
    input: {
      predictions: [
        { modelId: "linear", prediction: 0.72, confidence: 0.85, historicalAccuracy: 0.78 },
        { modelId: "forest", prediction: 0.68, confidence: 0.90, historicalAccuracy: 0.82 },
        { modelId: "neural", prediction: 0.75, confidence: 0.70, historicalAccuracy: 0.85 },
        { modelId: "bayesian", prediction: 0.71, confidence: 0.88, historicalAccuracy: 0.80 },
      ],
      method: "weighted-voting",
    },
  },

  forecast: {
    name: "Time Series Forecast",
    description:
      "Forecast 6 periods ahead using Holt-Winters on monthly sales data with quarterly seasonality.",
    input: {
      data: [
        100, 120, 130, 115, 105, 125, 140, 120, 110, 130, 145, 125, 115, 135,
        150, 130,
      ],
      steps: 6,
      method: "holt-winters",
      seasonLength: 4,
    },
  },

  anomaly: {
    name: "Anomaly Detection",
    description:
      "Detect outliers in sensor data using Z-Score method with a 2.5 standard deviation threshold.",
    input: {
      data: [
        10, 12, 11, 13, 10, 12, 50, 11, 13, 10, 12, 11, 100, 13, 10, 12, 11,
        10, -20, 12,
      ],
      method: "zscore",
      threshold: 2.5,
    },
  },

  convergence: {
    name: "Convergence Scoring",
    description:
      "Measure agreement between 3 independent prediction sources using Hellinger distance.",
    input: {
      sources: [
        { id: "analyst_a", distribution: [0.1, 0.2, 0.4, 0.2, 0.1] },
        { id: "analyst_b", distribution: [0.05, 0.15, 0.5, 0.2, 0.1] },
        { id: "model_c", distribution: [0.1, 0.25, 0.35, 0.2, 0.1] },
      ],
    },
  },

  calibration: {
    name: "Calibration Scoring",
    description:
      "Evaluate how well predicted probabilities match actual outcomes using Brier score and log score.",
    input: {
      predictions: [0.9, 0.7, 0.3, 0.85, 0.1, 0.6, 0.95, 0.4, 0.2, 0.75],
      outcomes: [1, 1, 0, 1, 0, 1, 1, 0, 0, 1],
    },
  },

  pathfind: {
    name: "A* Pathfinding",
    description:
      "Find the shortest path through a 5-node graph with cost, time, and risk weights. Returns primary path plus 2 alternatives.",
    input: {
      nodes: [
        { id: "start", cost: 0 },
        { id: "A", cost: 10, time: 2, risk: 0.1 },
        { id: "B", cost: 5, time: 4, risk: 0.05 },
        { id: "C", cost: 8, time: 1, risk: 0.2 },
        { id: "end", cost: 0 },
      ],
      edges: [
        { from: "start", to: "A", cost: 10, time: 2 },
        { from: "start", to: "B", cost: 5, time: 4 },
        { from: "A", to: "C", cost: 3, time: 1 },
        { from: "A", to: "end", cost: 15, time: 3 },
        { from: "B", to: "C", cost: 8, time: 2 },
        { from: "C", to: "end", cost: 4, time: 1 },
      ],
      start: "start",
      end: "end",
      heuristic: "cost",
      kPaths: 3,
    },
  },
};
