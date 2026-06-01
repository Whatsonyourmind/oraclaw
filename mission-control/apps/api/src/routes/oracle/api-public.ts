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
import { z } from "zod";
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
import { createUsageTracker } from "../../services/usageTracker";
import { db } from "../../services/database/client";

// ── Zod Schemas ──────────────────────────────────────────

const ScheduleTaskSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  durationMinutes: z.number().positive(),
  priority: z.number(),
  deadline: z.number().optional(),
  energyRequired: z.enum(["high", "medium", "low"]),
  category: z.string().optional(),
});

const TimeSlotSchema = z.object({
  id: z.string().min(1),
  startTime: z.number({ invalid_type_error: "startTime must be a Unix timestamp (number), not a string like '09:00'" }),
  durationMinutes: z.number().positive(),
  energyLevel: z.enum(["high", "medium", "low"]),
});

const ScheduleInputSchema = z.object({
  tasks: z.array(ScheduleTaskSchema).min(1, "At least one task is required"),
  slots: z.array(TimeSlotSchema).min(1, "At least one time slot is required"),
});

const BanditArmSchema = z.object({
  id: z.string().min(1, "arm.id is required (got empty string)"),
  name: z.string().min(1, "arm.name is required (got empty string)"),
  pulls: z.number().int().min(0).optional(),
  totalReward: z.number().optional(),
});

const BanditInputSchema = z.object({
  arms: z.array(BanditArmSchema).min(2, "At least 2 arms are required. If you passed bare strings like ['A','B'], wrap each as {id, name}."),
  algorithm: z.enum(["ucb1", "thompson", "epsilon-greedy"]).optional(),
  config: z.object({
    explorationConstant: z.number().positive().optional(),
    rewardDecay: z.number().min(0).max(1).optional(),
  }).optional(),
});

const ContextualBanditHistorySchema = z.object({
  armId: z.string().min(1),
  reward: z.number(),
  context: z.array(z.number()).min(1),
});

const ContextualBanditInputSchema = z.object({
  arms: z.array(BanditArmSchema).min(2, "At least 2 arms are required. Each must be {id: string, name: string}."),
  context: z.array(z.number()).min(1, "context must be a numeric feature vector with at least one dimension"),
  history: z.array(ContextualBanditHistorySchema).optional(),
  alpha: z.number().positive().optional(),
}).superRefine((val, ctx) => {
  if (val.history) {
    const mismatch = val.history.find((h) => h.context.length !== val.context.length);
    if (mismatch) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["history"],
        message: `history[].context length must match top-level context length (${val.context.length})`,
      });
    }
    const armIds = new Set(val.arms.map((a) => a.id));
    const unknownArm = val.history.find((h) => !armIds.has(h.armId));
    if (unknownArm) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["history"],
        message: `history[].armId "${unknownArm.armId}" is not in arms[]`,
      });
    }
  }
});

const ConvergenceSourceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  probability: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1).optional(),
  volume: z.number().positive().optional(),
  lastUpdated: z.number().default(() => Date.now()),
});

const ConvergenceInputSchema = z.object({
  sources: z.array(ConvergenceSourceSchema).min(1, "At least one source is required"),
  config: z.object({
    wA: z.number().optional(),
    wD: z.number().optional(),
    wU: z.number().optional(),
    wF: z.number().optional(),
    scale: z.number().optional(),
    shift: z.number().optional(),
    freshnessHalfLifeMs: z.number().positive().optional(),
    outlierThreshold: z.number().min(0).max(1).optional(),
  }).optional(),
});

const ForecastInputSchema = z.object({
  data: z.array(z.number()).min(2, "Forecast requires at least 2 data points"),
  steps: z.number().int().positive(),
  method: z.enum(["arima", "holt-winters"]).optional(),
  seasonLength: z.number().int().positive().optional(),
}).superRefine((val, ctx) => {
  const method = val.method ?? "arima";
  if (method === "arima" && val.data.length < 20) {
    ctx.addIssue({
      code: z.ZodIssueCode.too_small,
      minimum: 20,
      type: "array",
      inclusive: true,
      path: ["data"],
      message: "Forecast requires at least 20 data points for ARIMA. Use method: 'holt-winters' for smaller datasets.",
    });
  }
  if (method === "holt-winters") {
    const seasonLen = val.seasonLength ?? 4;
    const minLen = 2 * seasonLen;
    if (val.data.length < minLen) {
      ctx.addIssue({
        code: z.ZodIssueCode.too_small,
        minimum: minLen,
        type: "array",
        inclusive: true,
        path: ["data"],
        message: `Holt-Winters requires at least ${minLen} data points (2 × seasonLength=${seasonLen})`,
      });
    }
  }
});

// ── solve() Intent Classifier ──────────────────────────
//
// Pure keyword-overlap guess of which algorithm class a free-text prompt maps
// to. Mirrors the client-side teaser in web/app/demo/page.tsx so the captured
// `guessed_class` column reflects the same routing the user was shown. Zero
// network, zero LLM cost — just substring scoring.

const INTENT_PROBLEM_CLASSES: ReadonlyArray<{ id: string; keywords: readonly string[] }> = [
  { id: "multi_armed_bandit", keywords: ["a/b", "ab test", "variant", "explore", "exploit", "which option", "landing page", "best arm"] },
  { id: "contextual_bandit", keywords: ["personalize", "context", "feature", "per user", "segment", "tailor"] },
  { id: "thompson_sampling", keywords: ["thompson", "bayesian bandit", "posterior sampling", "conversion rate"] },
  { id: "calibration", keywords: ["calibrat", "brier", "log score", "how accurate", "forecast accuracy", "reliability"] },
  { id: "wilson_ci", keywords: ["confidence interval", "wilson", "proportion", "rate uncertainty", "margin of error"] },
  { id: "beta_bernoulli", keywords: ["success rate", "click rate", "conversion", "binary outcome", "yes/no", "prior"] },
  { id: "monte_carlo", keywords: ["monte carlo", "simulate", "simulation", "probability of", "what are the odds", "uncertainty", "distribution"] },
  { id: "lp_mip", keywords: ["allocate", "schedule", "assign", "constraint", "maximize", "minimize", "budget", "capacity", "resource", "optimize"] },
  { id: "anomaly_detection", keywords: ["anomaly", "outlier", "spike", "unusual", "fraud", "detect", "abnormal"] },
  { id: "time_series_forecast", keywords: ["forecast", "predict next", "trend", "seasonal", "future value", "time series", "projection"] },
  { id: "kalman_filter", keywords: ["kalman", "track", "noisy sensor", "smoothing", "state estimate", "filter"] },
  { id: "pagerank", keywords: ["pagerank", "rank nodes", "importance", "influence", "centrality", "network rank"] },
  { id: "community_detection", keywords: ["community", "cluster", "group", "segment graph", "louvain", "modularity"] },
  { id: "shortest_path", keywords: ["shortest path", "route", "fastest way", "navigate", "critical path", "fewest steps"] },
  { id: "hrp_portfolio", keywords: ["portfolio", "allocate assets", "diversif", "weights", "risk parity", "rebalance"] },
  { id: "ensemble_convergence", keywords: ["ensemble", "combine models", "consensus", "agreement", "aggregate predictions", "multiple sources"] },
  { id: "causal_entropy_balancing", keywords: ["causal", "treatment effect", "confound", "balance", "counterfactual", "impact of"] },
  { id: "simulated_annealing", keywords: ["annealing", "global optimum", "rearrange", "layout", "tour", "combinatorial"] },
  { id: "genetic_algorithm", keywords: ["genetic", "evolve", "evolution", "many variables", "tune parameters", "search space"] },
  { id: "q_learning", keywords: ["q-learning", "reinforcement", "reward", "policy", "agent learns", "sequential decision"] },
];

export function guessIntentClass(prompt: string): string | null {
  const text = prompt.toLowerCase();
  if (text.trim().length < 4) return null;
  let bestId: string | null = null;
  let bestScore = 0;
  for (const pc of INTENT_PROBLEM_CLASSES) {
    let score = 0;
    for (const kw of pc.keywords) {
      if (text.includes(kw)) score += kw.includes(" ") ? 2 : 1;
    }
    if (score > bestScore) {
      bestScore = score;
      bestId = pc.id;
    }
  }
  return bestScore > 0 ? bestId : null;
}

// ── Route Registration ─────────────────────────────────

export default async function publicApiRoutes(fastify: FastifyInstance) {

  // ── Usage Tracker (global observability) ──────────
  //
  // Records every /api/v1/* request (authenticated or free) into an
  // in-memory aggregated snapshot. Exposed via /api/v1/admin/usage for
  // operator monitoring. Persists to disk periodically so within-session
  // state survives short hiccups; not a replacement for a real analytics
  // pipeline.

  const usageTracker = createUsageTracker({
    logger: { info: (msg, label) => fastify.log.info(msg, label), warn: (msg, label) => fastify.log.warn(msg, label) },
  });
  await usageTracker.load();
  usageTracker.startPersistLoop();

  fastify.addHook("onResponse", async (request, reply) => {
    const url = request.url ?? "";
    // Only track /api/v1/* routes; skip websockets, static assets, health
    // probes, and the usage endpoint itself (avoid self-reference loops).
    if (!url.startsWith("/api/v1/")) return;
    if (url.startsWith("/api/v1/admin/usage")) return;
    if (url.startsWith("/api/v1/health")) return;
    if (url.startsWith("/api/v1/telemetry/")) return;
    usageTracker.record({
      tier: request.tier ?? "unknown",
      keyId: request.keyId,
      billingPath: request.billingPath ?? "unknown",
      route: url,
      status: reply.statusCode,
    });
  });

  fastify.addHook("onClose", async () => {
    usageTracker.stopPersistLoop();
    await usageTracker.persist();
  });

  // ── Health ─────────────────────────────────────────

  fastify.get("/api/v1/health", async () => ({
    status: "ok",
    algorithms: 20,
    version: "2.3.1",
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
      "/v1/thompson-sampling/init",
      "/v1/thompson-sampling/select",
      "/v1/thompson-sampling/update",
      "/v1/thompson-sampling/recommend",
    ],
  }));

  // ── Usage Stats ────────────────────────────────────

  fastify.get("/api/v1/usage", async (request) => ({
    tier: request.tier,
    billingPath: request.billingPath,
  }));

  // ── Admin Usage Dashboard ──────────────────────────
  //
  // Aggregated observability snapshot. Gated by ADMIN_KEY env var —
  // requests must supply `X-Admin-Key` header matching the env value.
  // If ADMIN_KEY is not set at boot, the endpoint returns 503 rather
  // than exposing data to anonymous callers.
  //
  // Returned shape: see UsageSnapshot in services/usageTracker.ts.

  fastify.get("/api/v1/admin/usage", async (request, reply) => {
    const configured = process.env.ADMIN_KEY;
    if (!configured) {
      return reply.code(503).send({
        error: "admin_not_configured",
        detail: "ADMIN_KEY env var not set; admin endpoint disabled",
      });
    }
    const supplied = request.headers["x-admin-key"];
    if (supplied !== configured) {
      return reply.code(401).send({
        error: "unauthorized",
        detail: "missing or invalid X-Admin-Key header",
      });
    }
    return usageTracker.getSnapshot();
  });

  // ── MCP Telemetry (anonymous tool usage counters) ──

  const mcpCounts: Record<string, { calls: number; errors: number; totalMs: number }> = {};

  fastify.post("/api/v1/telemetry/mcp", async (request: FastifyRequest, reply: FastifyReply) => {
    const { tool, durationMs, ok } = request.body as { tool?: string; durationMs?: number; ok?: boolean; ts?: number };
    if (!tool || typeof tool !== "string") return reply.status(400).send({ error: "tool required" });
    if (!mcpCounts[tool]) mcpCounts[tool] = { calls: 0, errors: 0, totalMs: 0 };
    mcpCounts[tool].calls++;
    if (!ok) mcpCounts[tool].errors++;
    mcpCounts[tool].totalMs += typeof durationMs === "number" ? durationMs : 0;
    fastify.log.info({ mcp_tool: tool, duration: durationMs, ok }, "mcp-telemetry");
    return { received: true };
  });

  fastify.get("/api/v1/telemetry/mcp/summary", async () => {
    const tools = Object.entries(mcpCounts).map(([tool, s]) => ({
      tool, calls: s.calls, errors: s.errors, avgMs: s.calls ? Math.round(s.totalMs / s.calls) : 0,
    }));
    tools.sort((a, b) => b.calls - a.calls);
    return { tools, totalCalls: tools.reduce((s, t) => s + t.calls, 0), since: "server-boot" };
  });

  // ── solve() Demand Probe (anonymous intent capture) ──
  //
  // Validates demand for natural-language optimization routing BEFORE the
  // router is built. Always logs to stdout (retrievable from Render logs)
  // and best-effort persists to solve_intents if a DB is connected. No
  // auth, no API key — inherits the free-tier IP rate-limit + analytics hooks.

  fastify.post("/api/v1/intent", async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as { prompt?: unknown; email?: unknown; source?: unknown };
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    if (!prompt) return reply.status(400).send({ error: "prompt required (non-empty string)" });
    if (prompt.length > 2000) return reply.status(400).send({ error: "prompt too long (max 2000 chars)" });
    // Email is optional. If omitted/empty, no email is stored. If a non-empty
    // value is supplied it must be a valid address — otherwise reject (400)
    // rather than silently dropping it.
    const rawEmail = typeof body.email === "string" ? body.email.trim() : "";
    const emailValid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(rawEmail);
    if (rawEmail && !emailValid) {
      return reply.status(400).send({ error: "invalid email" });
    }
    const email = emailValid ? rawEmail : undefined;
    const source = typeof body.source === "string" ? body.source.slice(0, 80) : undefined;
    const guessedClass = guessIntentClass(prompt);
    const ts = Date.now();

    fastify.log.info({ intent: { prompt, email, source, guessedClass, ts } }, "solve-intent");

    // Fire-and-forget persist — guarded so a missing table never errors the request.
    if (db.isConnected()) {
      db.query(
        `INSERT INTO solve_intents (prompt, email, source, guessed_class, created_at) VALUES ($1, $2, $3, $4, to_timestamp($5 / 1000.0))`,
        [prompt, email ?? null, source ?? null, guessedClass ?? null, ts],
      ).catch((err) => fastify.log.warn({ err }, "solve_intents insert failed (non-fatal)"));
    }

    return { status: "received", message: "You're on the solve() beta waitlist." };
  });

  // ── 1. Multi-Armed Bandit ──────────────────────────

  fastify.post("/api/v1/optimize/bandit", async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = BanditInputSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.status(400);
      return {
        error: "Invalid bandit input",
        details: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      };
    }
    const body = parsed.data;

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
    const parsed = ContextualBanditInputSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.status(400);
      return {
        error: "Invalid contextual-bandit input",
        details: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      };
    }
    const body = parsed.data;

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
    const parsed = ScheduleInputSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.status(400);
      return {
        error: "Invalid schedule input",
        details: parsed.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      };
    }

    const { tasks, slots } = parsed.data;
    const result = await optimizeSchedule(tasks, slots);

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
    const parsed = ConvergenceInputSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.status(400);
      return {
        error: "Invalid convergence input",
        details: parsed.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      };
    }

    const result = computeConvergence(parsed.data.sources, parsed.data.config);

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
    const parsed = ForecastInputSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.status(400);
      return {
        error: "Invalid forecast input",
        details: parsed.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      };
    }

    const body = parsed.data;
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
    signup: "POST /api/v1/auth/signup with {\"email\":\"you@example.com\"} to get an API key instantly",
    tools: {
      free: {
        count: 6,
        list: ["optimize_bandit", "optimize_contextual", "solve_schedule", "score_convergence", "plan_pathfind", "simulate_montecarlo"],
        access: "No API key needed (25 calls/day, IP-based rate limiting)",
      },
      premium: {
        count: 6,
        list: ["solve_constraints (LP/MIP/QP)", "analyze_graph (PageRank/Louvain)", "optimize_cmaes (CMA-ES)", "analyze_risk (VaR/CVaR)", "detect_anomaly (Z-score/IQR)", "predict_forecast (ARIMA/Holt-Winters)"],
        access: "Requires API key — sign up free at POST /api/v1/auth/signup",
      },
    },
    tiers: {
      free: {
        price: "$0",
        calls_per_day: 25,
        calls_per_month: 750,
        tools: "6 free tools only",
        auth: "No API key needed (IP-based rate limiting)",
      },
      pay_per_call: {
        price: "$0.005/call",
        calls_per_day: 1000,
        tools: "All 12 tools (free + premium)",
        billing: "Metered — billed monthly via Stripe",
        auth: "API key required (signup to get one)",
      },
      starter: {
        price: "$9/mo",
        calls_per_month: 50000,
        calls_per_day: 1667,
        tools: "All 12 tools",
        support: "email",
      },
      growth: {
        price: "$49/mo",
        calls_per_month: 500000,
        calls_per_day: 16667,
        tools: "All 12 tools",
        support: "priority",
      },
      scale: {
        price: "$199/mo",
        calls_per_month: 5000000,
        calls_per_day: 166667,
        tools: "All 12 tools",
        support: "dedicated",
      },
    },
    machine_payments: {
      protocol: "x402 (USDC on Base mainnet)",
      how: "Send payment proof in X-PAYMENT header — no API key or signup needed",
      per_call: "$0.001 (all 12 tools)",
    },
    upgrade: "POST /api/v1/billing/subscribe with {\"tier\":\"starter\"} (requires API key auth)",
  }));
}
