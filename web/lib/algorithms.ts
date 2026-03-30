export interface Algorithm {
  id: string;
  name: string;
  category: AlgorithmCategory;
  endpoint: string;
  description: string;
  useCases: string[];
  pricePerCall: string;
  complexity: string;
  avgLatency: string;
  inputSchema: Record<string, string>;
  outputFields: string[];
}

export type AlgorithmCategory =
  | "Optimize"
  | "Simulate"
  | "Solve"
  | "Analyze"
  | "Predict"
  | "Detect"
  | "Score"
  | "Plan";

export const CATEGORY_COLORS: Record<AlgorithmCategory, string> = {
  Optimize: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  Simulate: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  Solve: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  Analyze: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  Predict: "bg-green-500/20 text-green-400 border-green-500/30",
  Detect: "bg-red-500/20 text-red-400 border-red-500/30",
  Score: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  Plan: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
};

export const ALGORITHMS: Algorithm[] = [
  // ── Optimize ──────────────────────────────────────
  {
    id: "bandit",
    name: "Multi-Armed Bandit",
    category: "Optimize",
    endpoint: "/api/v1/optimize/bandit",
    description:
      "UCB1, Thompson Sampling, and Epsilon-Greedy algorithms for explore/exploit decisions. Maximizes cumulative reward across options with unknown payoffs.",
    useCases: ["A/B testing", "Ad placement", "Feature rollout", "Content recommendation"],
    pricePerCall: "$0.01",
    complexity: "O(n)",
    avgLatency: "<1ms",
    inputSchema: {
      arms: "Array of {id, name, pulls?, totalReward?}",
      algorithm: "'ucb1' | 'thompson' | 'epsilon-greedy'",
      config: "{explorationConstant?, rewardDecay?}",
    },
    outputFields: ["selected", "score", "algorithm", "exploitation", "exploration", "regret"],
  },
  {
    id: "contextual-bandit",
    name: "Contextual Bandit (LinUCB)",
    category: "Optimize",
    endpoint: "/api/v1/optimize/contextual-bandit",
    description:
      "Context-aware decision making using linear upper confidence bound. Uses feature vectors (time, energy, urgency) to make personalized selections.",
    useCases: ["Personalized recommendations", "Dynamic pricing", "Treatment selection", "Resource allocation"],
    pricePerCall: "$0.02",
    complexity: "O(d^2 * k)",
    avgLatency: "<1ms",
    inputSchema: {
      arms: "Array of {id, name}",
      context: "number[] (feature vector)",
      history: "Array of {armId, reward, context}",
      alpha: "number (exploration parameter)",
    },
    outputFields: ["selected", "score", "expectedReward", "confidenceWidth", "algorithm"],
  },
  {
    id: "evolve",
    name: "Genetic Algorithm",
    category: "Optimize",
    endpoint: "/api/v1/optimize/evolve",
    description:
      "Multi-objective evolutionary optimization with Pareto frontier. Supports tournament, roulette, and rank selection with configurable crossover and mutation.",
    useCases: ["Portfolio optimization", "Feature selection", "Hyperparameter tuning", "Layout optimization"],
    pricePerCall: "$0.10",
    complexity: "O(g * n * d)",
    avgLatency: "<10ms",
    inputSchema: {
      geneLength: "number",
      populationSize: "number (max 500)",
      maxGenerations: "number (max 500)",
      bounds: "{min, max, type}",
      fitnessWeights: "number[]",
    },
    outputFields: ["bestChromosome", "paretoFrontier", "convergenceGeneration", "fitnessHistory"],
  },
  {
    id: "cmaes",
    name: "CMA-ES",
    category: "Optimize",
    endpoint: "/api/v1/optimize/cmaes",
    description:
      "Covariance Matrix Adaptation Evolution Strategy for continuous black-box optimization. State-of-the-art for derivative-free numerical optimization.",
    useCases: ["Neural network tuning", "Engineering design", "Calibration", "Continuous optimization"],
    pricePerCall: "$0.10",
    complexity: "O(d^2 * n)",
    avgLatency: "<5ms",
    inputSchema: {
      dimension: "number",
      initialMean: "number[]",
      initialSigma: "number",
      maxIterations: "number (max 5000)",
      objectiveWeights: "number[]",
    },
    outputFields: ["bestSolution", "bestFitness", "iterations", "evaluations", "converged"],
  },

  // ── Simulate ──────────────────────────────────────
  {
    id: "montecarlo",
    name: "Monte Carlo Simulation",
    category: "Simulate",
    endpoint: "/api/v1/simulate/montecarlo",
    description:
      "Run thousands of probabilistic simulations with configurable distributions. Supports normal, lognormal, uniform, triangular, beta, and exponential.",
    useCases: ["Risk assessment", "Financial modeling", "Project estimation", "Reliability analysis"],
    pricePerCall: "$0.05",
    complexity: "O(n * k)",
    avgLatency: "<5ms",
    inputSchema: {
      simulations: "number (max 2000)",
      distribution: "'normal' | 'lognormal' | 'uniform' | 'triangular' | 'beta' | 'exponential'",
      params: "{mean?, stddev?, min?, max?, mode?, alpha?, beta?, lambda?}",
    },
    outputFields: ["mean", "stdDev", "percentiles", "histogram", "iterations"],
  },
  {
    id: "scenario",
    name: "Scenario Planning",
    category: "Simulate",
    endpoint: "/api/v1/simulate/scenario",
    description:
      "What-if analysis comparing multiple scenarios against a base case. Calculates outcome deltas, per-variable impact, and sensitivity rankings.",
    useCases: ["Business planning", "Investment analysis", "Strategy evaluation", "Budget forecasting"],
    pricePerCall: "$0.08",
    complexity: "O(s * v)",
    avgLatency: "<3ms",
    inputSchema: {
      baseCase: "Record<string, number>",
      scenarios: "Array of {name, variables: Record<string, number>}",
    },
    outputFields: ["baseCase", "results", "sensitivityRanking", "scenarioCount"],
  },

  // ── Solve ─────────────────────────────────────────
  {
    id: "constraints",
    name: "Constraint Optimizer (LP/MIP)",
    category: "Solve",
    endpoint: "/api/v1/solve/constraints",
    description:
      "Linear and mixed-integer programming using HiGHS solver (WASM). Production-grade LP/MIP/QP solver for resource allocation and scheduling.",
    useCases: ["Resource allocation", "Supply chain", "Scheduling", "Production planning"],
    pricePerCall: "$0.10",
    complexity: "Problem-dependent",
    avgLatency: "<10ms",
    inputSchema: {
      objective: "{coefficients, direction: 'maximize' | 'minimize'}",
      constraints: "Array of {coefficients, rhs, type: 'leq' | 'eq' | 'geq'}",
      bounds: "Array of {lower?, upper?, type?}",
    },
    outputFields: ["status", "objectiveValue", "variables", "dualValues"],
  },
  {
    id: "schedule",
    name: "Schedule Optimizer",
    category: "Solve",
    endpoint: "/api/v1/solve/schedule",
    description:
      "Optimal task-to-slot assignment using constraint satisfaction. Respects deadlines, priorities, and resource constraints.",
    useCases: ["Meeting scheduling", "Workforce planning", "Task assignment", "Classroom scheduling"],
    pricePerCall: "$0.10",
    complexity: "O(t * s)",
    avgLatency: "<5ms",
    inputSchema: {
      tasks: "Array of {id, duration, priority, deadline?}",
      slots: "Array of {id, start, end, capacity?}",
    },
    outputFields: ["assignments", "unassigned", "utilization"],
  },

  // ── Analyze ───────────────────────────────────────
  {
    id: "graph",
    name: "Decision Graph",
    category: "Analyze",
    endpoint: "/api/v1/analyze/graph",
    description:
      "Graph analysis with PageRank, Louvain community detection, and shortest path using graphology. Model decisions as interconnected nodes.",
    useCases: ["Dependency analysis", "Impact mapping", "Network analysis", "Decision trees"],
    pricePerCall: "$0.05",
    complexity: "O(V + E)",
    avgLatency: "<3ms",
    inputSchema: {
      nodes: "Array of {id, type?, weight?}",
      edges: "Array of {source, target, weight?}",
      sourceGoal: "string (optional)",
      targetGoal: "string (optional)",
    },
    outputFields: ["pageRank", "communities", "shortestPath", "centralityScores"],
  },
  {
    id: "risk",
    name: "Portfolio Risk (VaR/CVaR)",
    category: "Analyze",
    endpoint: "/api/v1/analyze/risk",
    description:
      "Value at Risk and Conditional VaR for portfolio risk assessment. Computes expected return, volatility, and tail risk metrics.",
    useCases: ["Portfolio management", "Risk budgeting", "Regulatory compliance", "Hedge fund analytics"],
    pricePerCall: "$0.10",
    complexity: "O(n^2 * t)",
    avgLatency: "<2ms",
    inputSchema: {
      weights: "number[] (portfolio weights)",
      returns: "number[][] (historical returns matrix)",
      confidence: "number (e.g., 0.95)",
      horizonDays: "number",
    },
    outputFields: ["var", "cvar", "expectedReturn", "volatility"],
  },

  // ── Predict ───────────────────────────────────────
  {
    id: "bayesian",
    name: "Bayesian Inference",
    category: "Predict",
    endpoint: "/api/v1/predict/bayesian",
    description:
      "Bayesian belief updating with configurable priors and evidence factors. Computes posterior probability, calibration score, and credible intervals.",
    useCases: ["Medical diagnosis", "Fraud detection", "Spam filtering", "Hypothesis testing"],
    pricePerCall: "$0.02",
    complexity: "O(e)",
    avgLatency: "<1ms",
    inputSchema: {
      prior: "number (0-1)",
      evidence: "Array of {factor, weight, value}",
    },
    outputFields: ["posterior", "priorProbability", "posteriorMean", "posteriorVariance", "calibrationScore"],
  },
  {
    id: "ensemble",
    name: "Ensemble Model",
    category: "Predict",
    endpoint: "/api/v1/predict/ensemble",
    description:
      "Combine multiple model predictions using weighted voting, stacking, or Bayesian model averaging. Quantifies epistemic and aleatoric uncertainty.",
    useCases: ["Model aggregation", "Forecast combination", "Expert consensus", "Ensemble learning"],
    pricePerCall: "$0.05",
    complexity: "O(m)",
    avgLatency: "<1ms",
    inputSchema: {
      predictions: "Array of {modelId, prediction, confidence, historicalAccuracy?}",
      method: "'weighted-voting' | 'stacking' | 'bayesian-averaging'",
    },
    outputFields: ["consensus", "confidence", "weights", "entropy", "uncertainty", "modelContributions"],
  },
  {
    id: "forecast",
    name: "Time Series Forecast",
    category: "Predict",
    endpoint: "/api/v1/predict/forecast",
    description:
      "ARIMA and Holt-Winters forecasting for time series data. Produces point forecasts with confidence intervals and model diagnostics.",
    useCases: ["Demand forecasting", "Revenue projection", "Inventory planning", "Capacity planning"],
    pricePerCall: "$0.05",
    complexity: "O(n * s)",
    avgLatency: "<3ms",
    inputSchema: {
      data: "number[] (historical values)",
      steps: "number (forecast horizon)",
      method: "'arima' | 'holt-winters'",
      seasonLength: "number (for Holt-Winters)",
    },
    outputFields: ["forecast", "confidence", "model", "method"],
  },

  // ── Detect ────────────────────────────────────────
  {
    id: "anomaly",
    name: "Anomaly Detection",
    category: "Detect",
    endpoint: "/api/v1/detect/anomaly",
    description:
      "Statistical anomaly detection using Z-Score and IQR methods. Identifies outliers in numerical data with configurable sensitivity thresholds.",
    useCases: ["Fraud detection", "System monitoring", "Quality control", "Data cleaning"],
    pricePerCall: "$0.02",
    complexity: "O(n)",
    avgLatency: "<1ms",
    inputSchema: {
      data: "number[]",
      method: "'zscore' | 'iqr'",
      threshold: "number (default: 3.0 for zscore, 1.5 for iqr)",
    },
    outputFields: ["method", "anomalies", "stats", "totalPoints", "anomalyCount"],
  },

  // ── Score ─────────────────────────────────────────
  {
    id: "convergence",
    name: "Convergence Scoring",
    category: "Score",
    endpoint: "/api/v1/score/convergence",
    description:
      "Multi-source signal agreement via Hellinger distance. Measures how much independent sources converge on the same prediction.",
    useCases: ["Prediction markets", "Expert consensus", "Multi-sensor fusion", "Signal verification"],
    pricePerCall: "$0.02",
    complexity: "O(s^2)",
    avgLatency: "<1ms",
    inputSchema: {
      sources: "Array of source distributions",
      config: "{method?, weights?}",
    },
    outputFields: ["convergenceScore", "pairwiseDistances", "consensus"],
  },
  {
    id: "calibration",
    name: "Calibration Scoring",
    category: "Score",
    endpoint: "/api/v1/score/calibration",
    description:
      "Brier score and log score for evaluating prediction calibration. Measures how well predicted probabilities match actual outcomes.",
    useCases: ["Forecaster evaluation", "Model calibration", "Prediction accuracy", "Weather verification"],
    pricePerCall: "$0.01",
    complexity: "O(n)",
    avgLatency: "<1ms",
    inputSchema: {
      predictions: "number[] (predicted probabilities)",
      outcomes: "number[] (actual 0/1 outcomes)",
    },
    outputFields: ["brier_score", "log_score", "n_predictions", "mean_prediction", "mean_outcome"],
  },

  // ── Plan ──────────────────────────────────────────
  {
    id: "pathfind",
    name: "A* Pathfinding",
    category: "Plan",
    endpoint: "/api/v1/plan/pathfind",
    description:
      "A* shortest path with K-shortest alternatives using Yen's algorithm. Supports cost, time, and risk heuristics with weighted multi-objective search.",
    useCases: ["Route planning", "Critical path analysis", "Network routing", "Project sequencing"],
    pricePerCall: "$0.03",
    complexity: "O(E log V)",
    avgLatency: "<2ms",
    inputSchema: {
      nodes: "Array of {id, cost?, time?, risk?}",
      edges: "Array of {from, to, cost?, time?, risk?}",
      start: "string",
      end: "string",
      heuristic: "'zero' | 'time' | 'cost' | 'risk' | 'weighted'",
      kPaths: "number (for alternatives)",
    },
    outputFields: ["path", "totalCost", "breakdown", "nodesExplored", "alternativePaths"],
  },
];

export function getAlgorithmsByCategory(): Record<AlgorithmCategory, Algorithm[]> {
  const grouped: Record<string, Algorithm[]> = {};
  for (const algo of ALGORITHMS) {
    if (!grouped[algo.category]) grouped[algo.category] = [];
    grouped[algo.category].push(algo);
  }
  return grouped as Record<AlgorithmCategory, Algorithm[]>;
}

export function getAlgorithmById(id: string): Algorithm | undefined {
  return ALGORITHMS.find((a) => a.id === id);
}
