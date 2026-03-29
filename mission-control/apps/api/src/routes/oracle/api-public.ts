/**
 * OraClaw Public API — Exposes 14 decision intelligence algorithms as HTTP endpoints
 *
 * Two billing paths:
 *   Path A: API key (Unkey) → Stripe metered billing
 *   Path B: Machine payments (x402/MPP) → USDC on Base
 *
 * All endpoints accept JSON, return JSON. No LLM cost — pure algorithms.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { createBandit } from "../../services/oracle/algorithms/multiArmedBandit";
import { createContextualBandit } from "../../services/oracle/algorithms/contextualBandit";
import { createDecisionGraph } from "../../services/oracle/algorithms/decisionGraph";
import { computeConvergence, brierScore, logScore } from "../../services/oracle/algorithms/convergenceScoring";
import { solve, optimizeSchedule } from "../../services/oracle/algorithms/constraintOptimizer";
import { MonteCarloService, type DistributionParams } from "../../services/oracle/monteCarlo";
import { GeneticAlgorithmEngine, type GeneBounds } from "../../services/oracle/algorithms/geneticAlgorithm";
import { ProbabilityEngineService } from "../../services/oracle/probability";
import { EnsembleModel, type EnsembleModelEntry, type ModelPrediction } from "../../services/oracle/algorithms/ensemble";
import { scenarioPlanningService } from "../../services/oracle/scenarioPlanning";
import { AStarPathfinder, Heuristics, type GraphNode, type GraphEdge } from "../../services/oracle/algorithms/astar";
import { forecast, holtWinters } from "../../services/oracle/algorithms/timeSeries";
import { detectAnomaliesZScore, detectAnomaliesIQR } from "../../services/oracle/algorithms/anomalyDetector";
import { optimizeCMAES, type CMAESConfig } from "../../services/oracle/algorithms/cmaes";
import { portfolioVaR } from "../../services/oracle/algorithms/correlationMatrix";

// ── Route Registration ─────────────────────────────────

export default async function publicApiRoutes(fastify: FastifyInstance) {

  // ── Health ─────────────────────────────────────────

  fastify.get("/api/v1/health", async () => ({
    status: "ok",
    algorithms: 19,
    version: "2.3.0",
    endpoints: [
      "/api/v1/optimize/bandit",
      "/api/v1/optimize/contextual-bandit",
      "/api/v1/optimize/evolve",
      "/api/v1/optimize/cmaes",
      "/api/v1/simulate/montecarlo",
      "/api/v1/simulate/scenario",
      "/api/v1/solve/schedule",
      "/api/v1/solve/constraints",
      "/api/v1/analyze/graph",
      "/api/v1/analyze/risk",
      "/api/v1/predict/bayesian",
      "/api/v1/predict/ensemble",
      "/api/v1/predict/forecast",
      "/api/v1/detect/anomaly",
      "/api/v1/score/convergence",
      "/api/v1/score/calibration",
      "/api/v1/plan/pathfind",
    ],
  }));

  // ── Usage Stats ────────────────────────────────────

  fastify.get("/api/v1/usage", async (request) => ({
    tier: request.tier,
    billingPath: request.billingPath,
  }));

  // ── 1. Multi-Armed Bandit ──────────────────────────

  fastify.post("/api/v1/optimize/bandit", async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as {
      arms: Array<{ id: string; name: string; pulls?: number; totalReward?: number }>;
      algorithm?: "ucb1" | "thompson" | "epsilon-greedy";
      config?: { explorationConstant?: number; rewardDecay?: number };
    };

    const bandit = createBandit(body.config);
    for (const arm of body.arms) {
      bandit.addArm(arm.id, arm.name);
      if (arm.pulls && arm.totalReward !== undefined) {
        for (let i = 0; i < arm.pulls; i++) {
          bandit.recordReward(arm.id, arm.totalReward / arm.pulls);
        }
      }
    }

    const algo = body.algorithm ?? "ucb1";
    const selection = algo === "thompson"
      ? bandit.selectArmThompson()
      : algo === "epsilon-greedy"
        ? bandit.selectArmEpsilonGreedy()
        : bandit.selectArmUCB1();

    return {
      selected: { id: selection.arm.id, name: selection.arm.name },
      score: selection.score,
      algorithm: selection.algorithm,
      exploitation: selection.exploitationScore,
      exploration: selection.explorationBonus,
      regret: bandit.calculateRegret(),
    };
  });

  // ── 2. Contextual Bandit (LinUCB) ─────────────────

  fastify.post("/api/v1/optimize/contextual-bandit", async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as {
      arms: Array<{ id: string; name: string }>;
      context: number[];
      history?: Array<{ armId: string; reward: number; context: number[] }>;
      alpha?: number;
    };

    const bandit = createContextualBandit({
      dimensions: body.context.length,
      alpha: body.alpha ?? 1.0,
    });

    for (const arm of body.arms) {
      bandit.addArm(arm.id, arm.name);
    }

    if (body.history) {
      for (const h of body.history) {
        bandit.recordReward(h.armId, h.reward, h.context);
      }
    }

    const selection = bandit.selectArm(body.context);

    return {
      selected: { id: selection.arm.id, name: selection.arm.name },
      score: selection.score,
      expectedReward: selection.expectedReward,
      confidenceWidth: selection.confidenceWidth,
      algorithm: "linucb",
    };
  });

  // ── 3. Constraint Optimizer (LP/MIP) ───────────────

  fastify.post("/api/v1/solve/constraints", async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Parameters<typeof solve>[0];
    const result = await solve(body);

    return result;
  });

  // ── 4. Schedule Optimizer ──────────────────────────

  fastify.post("/api/v1/solve/schedule", async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as {
      tasks: Parameters<typeof optimizeSchedule>[0];
      slots: Parameters<typeof optimizeSchedule>[1];
    };

    const result = await optimizeSchedule(body.tasks, body.slots);

    return result;
  });

  // ── 5. Decision Graph Analysis ─────────────────────

  fastify.post("/api/v1/analyze/graph", async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as {
      nodes: Parameters<ReturnType<typeof createDecisionGraph>["addNode"]>[0][];
      edges: Parameters<ReturnType<typeof createDecisionGraph>["addEdge"]>[0][];
      sourceGoal?: string;
      targetGoal?: string;
    };

    const graph = createDecisionGraph();
    for (const node of body.nodes) graph.addNode(node);
    for (const edge of body.edges) graph.addEdge(edge);

    const analysis = graph.analyze(body.sourceGoal, body.targetGoal);

    return analysis;
  });

  // ── 6. Convergence Scoring ─────────────────────────

  fastify.post("/api/v1/score/convergence", async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as {
      sources: Parameters<typeof computeConvergence>[0];
      config?: Parameters<typeof computeConvergence>[1];
    };

    const result = computeConvergence(body.sources, body.config);

    return result;
  });

  // ── 7. Calibration Scoring ─────────────────────────

  fastify.post("/api/v1/score/calibration", async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as {
      predictions: number[];
      outcomes: number[];
    };

    return {
      brier_score: brierScore(body.predictions, body.outcomes),
      log_score: logScore(body.predictions, body.outcomes),
      n_predictions: body.predictions.length,
      mean_prediction: body.predictions.reduce((a, b) => a + b, 0) / body.predictions.length,
      mean_outcome: body.outcomes.reduce((a, b) => a + b, 0) / body.outcomes.length,
    };
  });

  // ── 8. Monte Carlo Simulation ─────────────────────

  fastify.post("/api/v1/simulate/montecarlo", async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as {
      simulations: number;
      distribution: DistributionParams["type"];
      params: { mean?: number; stddev?: number; min?: number; max?: number; mode?: number; alpha?: number; beta?: number; lambda?: number };
      iterations?: number;
    };

    // Map user-friendly params to distribution params array
    const distParams: number[] = [];
    switch (body.distribution) {
      case "normal":
        distParams.push(body.params.mean ?? 0, body.params.stddev ?? 1);
        break;
      case "lognormal":
        distParams.push(body.params.mean ?? 0, body.params.stddev ?? 1);
        break;
      case "uniform":
        distParams.push(body.params.min ?? 0, body.params.max ?? 1);
        break;
      case "triangular":
        distParams.push(body.params.min ?? 0, body.params.mode ?? 0.5, body.params.max ?? 1);
        break;
      case "beta":
        distParams.push(body.params.alpha ?? 2, body.params.beta ?? 5);
        break;
      case "exponential":
        distParams.push(body.params.lambda ?? 1);
        break;
      default:
        distParams.push(body.params.mean ?? 0, body.params.stddev ?? 1);
    }

    const mcService = new MonteCarloService();
    const iterations = Math.min(body.simulations ?? body.iterations ?? 1000, 2000);

    const result = await mcService.runSingleFactorSimulation(
      { type: body.distribution, params: distParams },
      iterations,
    );

    return {
      mean: result.mean,
      stdDev: result.stdDev,
      percentiles: {
        p5: result.percentiles.p5,
        p25: result.percentiles.p25,
        p50: result.percentiles.p50,
        p75: result.percentiles.p75,
        p95: result.percentiles.p95,
      },
      histogram: result.distribution,
      iterations: result.iterations,
      executionTimeMs: result.executionTimeMs,
      timedOut: result.timedOut,
    };
  });

  // ── 9. Genetic Algorithm (Evolve) ────────────────

  fastify.post("/api/v1/optimize/evolve", async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as {
      populationSize?: number;
      maxGenerations?: number;
      geneLength: number;
      bounds?: { min: number; max: number; type?: "binary" | "integer" | "real" | "permutation" };
      mutationRate?: number;
      crossoverRate?: number;
      selectionMethod?: "tournament" | "roulette" | "rank";
      crossoverMethod?: "single-point" | "two-point" | "uniform";
      fitnessWeights?: number[];
    };

    const engine = new GeneticAlgorithmEngine({
      populationSize: Math.min(body.populationSize ?? 100, 500),
      maxGenerations: Math.min(body.maxGenerations ?? 100, 500),
      mutationRate: body.mutationRate ?? 0.01,
      crossoverRate: body.crossoverRate ?? 0.8,
      selectionMethod: body.selectionMethod ?? "tournament",
      crossoverMethod: body.crossoverMethod ?? "single-point",
    });

    const geneBounds: GeneBounds = {
      min: body.bounds?.min ?? 0,
      max: body.bounds?.max ?? 1,
      type: body.bounds?.type ?? "real",
    };

    engine.initializePopulation(body.geneLength, geneBounds);

    // Default fitness: weighted sum of genes (caller can shape via fitnessWeights)
    const weights = body.fitnessWeights ?? new Array(body.geneLength).fill(1);
    const fitnessFunction = (genes: number[]): number => {
      let score = 0;
      for (let i = 0; i < genes.length; i++) {
        score += genes[i] * (weights[i] ?? 1);
      }
      return score;
    };

    const result = engine.run(fitnessFunction, geneBounds);

    return {
      bestChromosome: {
        genes: result.bestChromosome.genes,
        fitness: result.bestChromosome.fitness,
      },
      paretoFrontier: result.paretoFrontier?.map(c => ({
        genes: c.genes,
        fitness: c.fitness,
      })),
      convergenceGeneration: result.convergenceGeneration,
      totalGenerations: result.totalGenerations,
      executionTimeMs: result.executionTimeMs,
      fitnessHistory: result.fitnessHistory.slice(-20),
    };
  });

  // ── 10. Bayesian Belief Update ───────────────────

  fastify.post("/api/v1/predict/bayesian", async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as {
      prior: number;
      evidence: Array<{ factor: string; weight: number; value: number }>;
    };

    const probabilityEngine = new ProbabilityEngineService();

    // Convert evidence into PredictionFactors
    const factors = body.evidence.map(e => ({
      name: e.factor,
      value: Math.max(0, Math.min(1, e.value)),
      weight: e.weight,
      direction: "positive" as const,
    }));

    // Build prior from the provided probability
    const priorAlpha = Math.max(1, body.prior * 10);
    const priorBeta = Math.max(1, (1 - body.prior) * 10);

    const prediction = probabilityEngine.generatePrediction(factors, {
      alpha: priorAlpha,
      beta: priorBeta,
    });

    // Calculate calibration score from the prior strength
    const posteriorMean = probabilityEngine.getPosteriorMean(prediction.prior);
    const posteriorVariance = probabilityEngine.getPosteriorVariance(prediction.prior);
    const calibrationScore = 1 - Math.sqrt(posteriorVariance);

    return {
      posterior: prediction.confidence,
      priorProbability: body.prior,
      factors: prediction.factors.map(f => ({
        name: f.name,
        value: f.value,
        weight: f.weight,
        direction: f.direction,
      })),
      posteriorMean,
      posteriorVariance,
      calibrationScore,
    };
  });

  // ── 11. Ensemble Multi-Model Consensus ───────────

  fastify.post("/api/v1/predict/ensemble", async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as {
      predictions: Array<{
        modelId: string;
        prediction: number;
        confidence: number;
        historicalAccuracy?: number;
      }>;
      method?: "weighted-voting" | "stacking" | "bayesian-averaging";
    };

    const ensemble = new EnsembleModel({
      combinationMethod: body.method ?? "weighted-voting",
      autoCalibrate: false,
    });

    // Register each model from the input
    for (const p of body.predictions) {
      const weight = p.historicalAccuracy ?? p.confidence;
      const capturedPrediction = p;
      const entry: EnsembleModelEntry = {
        id: p.modelId,
        name: p.modelId,
        type: "statistical",
        weight,
        predict: (): ModelPrediction => ({
          value: capturedPrediction.prediction,
          confidence: capturedPrediction.confidence,
        }),
        active: true,
      };
      ensemble.registerModel(entry);
    }

    const result = ensemble.predict(null);
    const uncertainty = ensemble.getUncertaintyMetrics(result);

    // Calculate entropy from weights
    const weightsArray = Array.from(result.weightsUsed.values());
    const totalWeight = weightsArray.reduce((a, b) => a + b, 0);
    const entropy = totalWeight > 0
      ? -weightsArray.reduce((sum, w) => {
          const p = w / totalWeight;
          return p > 0 ? sum + p * Math.log2(p) : sum;
        }, 0)
      : 0;

    // Build model contributions
    const modelContributions: Record<string, { weight: number; prediction: number; contribution: number }> = {};
    for (const p of body.predictions) {
      const w = result.weightsUsed.get(p.modelId) ?? 0;
      modelContributions[p.modelId] = {
        weight: totalWeight > 0 ? w / totalWeight : 0,
        prediction: p.prediction,
        contribution: totalWeight > 0 ? (w / totalWeight) * p.prediction : 0,
      };
    }

    return {
      consensus: result.value,
      confidence: result.confidence,
      weights: Object.fromEntries(result.weightsUsed),
      entropy,
      agreement: result.agreement,
      uncertainty: {
        epistemic: uncertainty.epistemic,
        aleatoric: uncertainty.aleatoric,
        total: uncertainty.total,
        confidenceInterval: uncertainty.confidenceInterval,
      },
      modelContributions,
      method: result.method,
    };
  });

  // ── 12. Scenario Planning (What-If) ─────────────

  fastify.post("/api/v1/simulate/scenario", async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as {
      scenarios: Array<{ name: string; variables: Record<string, number> }>;
      baseCase: Record<string, number>;
    };

    // Create a temporary decision context for scenario comparison
    const userId = "api-" + (request.tier);
    const baseScenario = await scenarioPlanningService.createScenario(userId, {
      name: "Base Case",
      description: "API base case scenario",
      scenario_type: "baseline",
      is_baseline: true,
    });

    // Add base case variables
    for (const [varName, varValue] of Object.entries(body.baseCase)) {
      await scenarioPlanningService.addVariable(baseScenario.id, {
        name: varName,
        category: "economic",
        variable_type: "numeric",
        current_value: { value: varValue, unit: "number" },
        baseline_value: { value: varValue, unit: "number" },
      });
    }

    // Calculate base case outcome (sum of all variables as default)
    const baseOutcome = Object.values(body.baseCase).reduce((a, b) => a + b, 0);

    // Process each scenario
    const results: Array<{
      scenario: string;
      outcome: number;
      delta: number;
      deltaPercent: number;
      variables: Record<string, { value: number; change: number; changePercent: number }>;
    }> = [];

    // Track sensitivity per variable
    const sensitivityMap: Record<string, number> = {};

    for (const scenario of body.scenarios) {
      const scenarioOutcome = Object.entries(scenario.variables).reduce((sum, [key, val]) => {
        return sum + val;
      }, 0);

      // Calculate per-variable changes
      const varDetails: Record<string, { value: number; change: number; changePercent: number }> = {};
      for (const [varName, varValue] of Object.entries(scenario.variables)) {
        const baseValue = body.baseCase[varName] ?? 0;
        const change = varValue - baseValue;
        const changePercent = baseValue !== 0 ? (change / baseValue) * 100 : 0;
        varDetails[varName] = { value: varValue, change, changePercent };

        // Accumulate absolute sensitivity
        sensitivityMap[varName] = (sensitivityMap[varName] ?? 0) + Math.abs(change);
      }

      const delta = scenarioOutcome - baseOutcome;
      const deltaPercent = baseOutcome !== 0 ? (delta / baseOutcome) * 100 : 0;

      results.push({
        scenario: scenario.name,
        outcome: scenarioOutcome,
        delta,
        deltaPercent,
        variables: varDetails,
      });
    }

    // Rank variables by total sensitivity across all scenarios
    const sensitivityRanking = Object.entries(sensitivityMap)
      .sort(([, a], [, b]) => b - a)
      .map(([variable, totalSwing]) => ({ variable, totalSwing }));

    // Clean up temporary scenarios
    await scenarioPlanningService.deleteScenario(baseScenario.id);

    return {
      baseCase: {
        outcome: baseOutcome,
        variables: body.baseCase,
      },
      results,
      sensitivityRanking,
      scenarioCount: body.scenarios.length,
    };
  });

  // ── 13. A* Pathfinding ──────────────────────────────

  fastify.post("/api/v1/plan/pathfind", async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as {
      nodes: Array<{ id: string; cost?: number; time?: number; risk?: number }>;
      edges: Array<{ from: string; to: string; cost?: number; time?: number; risk?: number }>;
      start: string;
      end: string;
      heuristic?: "zero" | "time" | "cost" | "risk" | "weighted";
      kPaths?: number;
    };

    // Build graph from input
    const pathfinder = new AStarPathfinder();
    const graph = pathfinder.createGraph(true);

    for (const node of body.nodes) {
      const graphNode: GraphNode = {
        id: node.id,
        name: node.id,
        estimatedCost: node.cost,
        estimatedTime: node.time,
        riskFactor: node.risk,
      };
      pathfinder.addNode(graph, graphNode);
    }

    for (const edge of body.edges) {
      const graphEdge: GraphEdge = {
        from: edge.from,
        to: edge.to,
        weight: edge.cost ?? edge.time ?? 1,
        timeCost: edge.time,
        monetaryCost: edge.cost,
        risk: edge.risk,
      };
      pathfinder.addEdge(graph, graphEdge);
    }

    // Select heuristic
    const heuristicName = body.heuristic ?? "zero";
    const heuristic = heuristicName === "time"
      ? Heuristics.time
      : heuristicName === "cost"
        ? Heuristics.cost
        : heuristicName === "risk"
          ? Heuristics.risk
          : heuristicName === "weighted"
            ? Heuristics.weighted(1, 1, 0.5)
            : Heuristics.zero;

    // Find primary path
    const result = pathfinder.findPath(graph, body.start, body.end, heuristic);

    // Find alternative paths if requested
    let alternativePaths: Array<{ path: string[]; cost: number }> | undefined;
    if (body.kPaths && body.kPaths > 1) {
      const kResults = pathfinder.findAlternativePaths(
        graph, body.start, body.end, body.kPaths, heuristic
      );
      // Skip the first (same as primary), return the rest
      alternativePaths = kResults.slice(1).map(r => ({
        path: r.path,
        cost: r.totalCost,
      }));
    }

    return {
      path: result.path,
      totalCost: result.totalCost,
      breakdown: {
        time: result.costBreakdown.time,
        cost: result.costBreakdown.money,
        risk: result.costBreakdown.risk,
      },
      nodesExplored: result.nodesExplored,
      found: result.found,
      executionTimeMs: result.executionTimeMs,
      alternativePaths,
    };
  });

  // ── 14. Time Series Forecasting ───────────────────────

  fastify.post("/api/v1/predict/forecast", async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as {
      data: number[];
      steps: number;
      method?: "arima" | "holt-winters";
      seasonLength?: number;
    };

    const method = body.method ?? "arima";

    let result;
    if (method === "holt-winters") {
      const seasonLen = body.seasonLength ?? 4;
      result = holtWinters(body.data, seasonLen, body.steps);
    } else {
      result = forecast(body.data, body.steps);
    }

    return {
      forecast: result.forecast,
      confidence: result.confidence,
      model: result.model,
      method,
      inputLength: body.data.length,
      steps: body.steps,
    };
  });

  // ── 15. Anomaly Detection ────────────────────────────

  fastify.post("/api/v1/detect/anomaly", async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as {
      data: number[];
      method?: "zscore" | "iqr";
      threshold?: number;
    };

    const method = body.method ?? "zscore";

    if (method === "iqr") {
      const result = detectAnomaliesIQR(body.data, body.threshold ?? 1.5);
      return {
        method: "iqr",
        anomalies: result.anomalies,
        stats: {
          q1: result.q1,
          q3: result.q3,
          iqr: result.iqr,
          lowerBound: result.lowerBound,
          upperBound: result.upperBound,
        },
        totalPoints: body.data.length,
        anomalyCount: result.anomalies.length,
      };
    }

    const result = detectAnomaliesZScore(body.data, body.threshold ?? 3.0);
    return {
      method: "zscore",
      anomalies: result.anomalies,
      stats: {
        mean: result.mean,
        stdDev: result.stdDev,
        threshold: result.threshold,
      },
      totalPoints: body.data.length,
      anomalyCount: result.anomalies.length,
    };
  });

  // ── 16. CMA-ES Continuous Optimization ───────────────

  fastify.post("/api/v1/optimize/cmaes", async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as {
      dimension: number;
      initialMean?: number[];
      initialSigma?: number;
      maxIterations?: number;
      objectiveWeights: number[];
    };

    // Fitness function: weighted sum of variables (same pattern as evolve endpoint)
    const weights = body.objectiveWeights;
    const objectiveFn = (x: number[]): number => {
      let score = 0;
      for (let i = 0; i < x.length; i++) {
        score += x[i]! * (weights[i] ?? 1);
      }
      // CMA-ES minimises, so negate for maximisation (consistent with evolve)
      return -score;
    };

    const cmaConfig: CMAESConfig = {
      dimension: body.dimension,
      initialMean: body.initialMean,
      initialSigma: body.initialSigma ?? 0.5,
      maxIterations: Math.min(body.maxIterations ?? 1000, 5000),
    };

    const result = optimizeCMAES(objectiveFn, cmaConfig);

    return {
      bestSolution: result.bestSolution,
      bestFitness: -result.bestFitness,  // Un-negate for the caller
      iterations: result.iterations,
      evaluations: result.evaluations,
      converged: result.converged,
      executionTimeMs: result.executionTimeMs,
    };
  });

  // ── 17. Portfolio Risk (VaR / CVaR) ─────────────────

  fastify.post("/api/v1/analyze/risk", async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as {
      weights: number[];
      returns: number[][];
      confidence?: number;
      horizonDays?: number;
    };

    const confidence = body.confidence ?? 0.95;
    const horizonDays = body.horizonDays ?? 1;

    const result = portfolioVaR(body.weights, body.returns, confidence, horizonDays);

    return {
      var: result.var,
      cvar: result.cvar,
      expectedReturn: result.expectedReturn,
      volatility: result.volatility,
      confidence,
      horizonDays,
      assets: body.weights.length,
    };
  });

  // ── Pricing / Docs Endpoint ────────────────────────

  fastify.get("/api/v1/pricing", async () => ({
    tiers: {
      free: { price: "$0", calls_per_month: 3000, algorithms: "all", support: "community" },
      starter: { price: "$99/mo", calls_per_month: 50000, algorithms: "all", support: "email" },
      growth: { price: "$499/mo", calls_per_month: 500000, algorithms: "all", support: "priority" },
      scale: { price: "$2,499/mo", calls_per_month: 5000000, algorithms: "all", support: "dedicated" },
      enterprise: { price: "custom", calls_per_month: "unlimited", algorithms: "all + custom", support: "white-glove" },
    },
    machine_payments: {
      protocol: "x402 / Stripe MPP",
      currency: "USDC on Base",
      per_call: {
        bandit: "$0.01",
        contextual_bandit: "$0.02",
        constraints: "$0.10",
        schedule: "$0.10",
        graph: "$0.05",
        convergence: "$0.02",
        calibration: "$0.01",
        montecarlo: "$0.05",
        evolve: "$0.10",
        bayesian: "$0.02",
        ensemble: "$0.05",
        scenario: "$0.08",
        pathfind: "$0.03",
        forecast: "$0.05",
        anomaly: "$0.02",
        cmaes: "$0.10",
        portfolio_risk: "$0.10",
      },
    },
  }));
}
