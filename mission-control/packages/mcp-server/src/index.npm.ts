#!/usr/bin/env node
/**
 * OraClaw MCP Server (npm distribution) — Decision intelligence for AI agents
 *
 * Install: npx @oraclaw/mcp-server
 *
 * Or add to Claude Code:
 *   claude mcp add oraclaw -- npx @oraclaw/mcp-server
 *
 * Or in mcp.json:
 *   "oraclaw": { "command": "npx", "args": ["@oraclaw/mcp-server"] }
 *
 * Set ORACLAW_API_URL and ORACLAW_API_KEY env vars to configure.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const API_URL = process.env.ORACLAW_API_URL || "https://oraclaw-api.onrender.com";
const API_KEY = process.env.ORACLAW_API_KEY || "";
const TELEMETRY = process.env.ORACLAW_TELEMETRY !== "false"; // opt-out via env var

async function callAPI(endpoint: string, body: unknown): Promise<unknown> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (API_KEY) headers["Authorization"] = `Bearer ${API_KEY}`;
  const res = await fetch(`${API_URL}${endpoint}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (res.status === 403) {
    const body = await res.json().catch(() => ({})) as Record<string, unknown>;
    throw new PremiumToolError((body.tool as string) || endpoint, (body.free_tools as string[]) || []);
  }
  if (!res.ok) throw new Error(`OraClaw API ${res.status}: ${await res.text()}`);
  return res.json();
}

class PremiumToolError extends Error {
  constructor(public tool: string, public freeTools: string[]) {
    super(`Premium tool: ${tool}`);
    this.name = 'PremiumToolError';
  }
}

/** Fire-and-forget telemetry — tool name + duration only, no PII, no inputs */
function trackTool(tool: string, durationMs: number, ok: boolean): void {
  if (!TELEMETRY) return;
  fetch(`${API_URL}/api/v1/telemetry/mcp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tool, durationMs, ok, ts: Date.now() }),
  }).catch(() => {}); // silent — never block the user
}

const server = new Server(
  { name: "oraclaw", version: "1.3.0" },
  { capabilities: { tools: {} } }
);

// ── Tool Definitions ──────────────────────────────────
//
// Every tool below ships:
//   - inputSchema:  full property typing for arguments
//   - outputSchema: structured return shape so callers can parse without guessing
//   - annotations:  MCP behavioral hints (readOnly, idempotent, openWorld)
//
// All tools call the OraClaw API at $ORACLAW_API_URL (default oraclaw-api.onrender.com).
// Free tier: 25 calls/day per IP, no key. Premium tools require ORACLAW_API_KEY.

const TOOLS = [
  {
    name: "optimize_bandit",
    description:
      "Pick the best option from a set of variants (Multi-Armed Bandit: UCB1, Thompson sampling, or ε-greedy). " +
      "Use this when you have N options with observed reward history and need to choose the next one with optimal " +
      "explore/exploit tradeoff (A/B test arm selection, ad/email variant routing, recommendation ranking). " +
      "For context-dependent selection (different best option per user/situation), use optimize_contextual instead. " +
      "For continuous parameter tuning, use optimize_cmaes. Returns the selected arm + score breakdown in <1ms.",
    inputSchema: {
      type: "object" as const,
      properties: {
        arms: {
          type: "array",
          minItems: 2,
          description: "Candidate options to choose between (at least 2).",
          items: {
            type: "object",
            properties: {
              id: { type: "string", description: "Stable identifier for this arm." },
              name: { type: "string", description: "Display label." },
              pulls: { type: "integer", minimum: 0, description: "Number of times this arm has been tried." },
              totalReward: { type: "number", description: "Cumulative reward across pulls (any scale)." },
            },
            required: ["id", "name"],
          },
        },
        algorithm: {
          type: "string",
          enum: ["ucb1", "thompson", "epsilon-greedy"],
          description: "Selection algorithm (default: ucb1). UCB1 is deterministic; thompson/epsilon-greedy sample.",
        },
      },
      required: ["arms"],
    },
    outputSchema: {
      type: "object" as const,
      properties: {
        selected: {
          type: "object",
          properties: { id: { type: "string" }, name: { type: "string" } },
          required: ["id", "name"],
          description: "The chosen arm.",
        },
        score: { type: "number", description: "Combined exploitation + exploration score." },
        algorithm: { type: "string", description: "Which algorithm produced the selection." },
        exploitation: { type: "number", description: "Pure mean-reward component." },
        exploration: { type: "number", description: "Uncertainty bonus added to exploitation." },
        regret: { type: "number", description: "Cumulative regret estimate (lower is better)." },
      },
      required: ["selected", "score", "algorithm"],
    },
    annotations: {
      title: "Bandit Selection (UCB1 / Thompson / ε-Greedy)",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },

  {
    name: "optimize_contextual",
    description:
      "Pick the best option given a situational context vector (LinUCB contextual bandit). " +
      "Use when the best option depends on features that vary per call (user demographics, time of day, " +
      "weather, market regime). Pass observed history so the model can learn per-context preferences. " +
      "If you have no per-call context features, use optimize_bandit instead. Returns selected arm with " +
      "expected reward + confidence width.",
    inputSchema: {
      type: "object" as const,
      properties: {
        arms: {
          type: "array",
          minItems: 2,
          items: {
            type: "object",
            properties: { id: { type: "string" }, name: { type: "string" } },
            required: ["id", "name"],
          },
        },
        context: {
          type: "array",
          items: { type: "number" },
          minItems: 1,
          description: "Numeric feature vector describing the current situation. Length must match across calls.",
        },
        history: {
          type: "array",
          description: "Optional past observations to seed the model.",
          items: {
            type: "object",
            properties: {
              armId: { type: "string" },
              reward: { type: "number" },
              context: { type: "array", items: { type: "number" } },
            },
            required: ["armId", "reward", "context"],
          },
        },
        alpha: { type: "number", description: "Exploration coefficient (default: 1.0). Higher = more exploration." },
      },
      required: ["arms", "context"],
    },
    outputSchema: {
      type: "object" as const,
      properties: {
        selected: { type: "object", properties: { id: { type: "string" }, name: { type: "string" } }, required: ["id", "name"] },
        score: { type: "number", description: "expectedReward + alpha * confidenceWidth." },
        expectedReward: { type: "number", description: "LinUCB point estimate of reward." },
        confidenceWidth: { type: "number", description: "Uncertainty bound on the estimate." },
        algorithm: { type: "string", const: "linucb" },
      },
      required: ["selected", "score", "expectedReward", "confidenceWidth", "algorithm"],
    },
    annotations: {
      title: "Contextual Bandit (LinUCB)",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },

  {
    name: "optimize_cmaes",
    description:
      "[Premium] Continuous black-box optimization via CMA-ES (Covariance Matrix Adaptation Evolution Strategy). " +
      "Use for tuning N continuous parameters when the objective is non-convex, noisy, or has no gradient — " +
      "hyperparameter search, simulator calibration, control policy tuning. 10-100x fewer evaluations than grid search. " +
      "For discrete combinatorial problems, use optimize_evolve. For LP/MIP problems with linear constraints, use solve_constraints. " +
      "Stochastic init means re-runs with the same input may differ slightly. Requires ORACLAW_API_KEY.",
    inputSchema: {
      type: "object" as const,
      properties: {
        dimension: { type: "integer", minimum: 1, description: "Number of parameters to optimize." },
        objectiveWeights: {
          type: "array",
          items: { type: "number" },
          description: "Per-dimension weight in the linear default objective. Length must equal dimension.",
        },
        initialSigma: { type: "number", minimum: 0, description: "Initial step size (default: 0.5)." },
        maxIterations: { type: "integer", minimum: 1, maximum: 5000, description: "Max generations (default: 1000, capped at 5000)." },
        initialMean: { type: "array", items: { type: "number" }, description: "Optional starting point in parameter space." },
      },
      required: ["dimension", "objectiveWeights"],
    },
    outputSchema: {
      type: "object" as const,
      properties: {
        bestSolution: { type: "array", items: { type: "number" }, description: "Best parameter vector found." },
        bestFitness: { type: "number", description: "Objective value at bestSolution (caller's sign convention)." },
        iterations: { type: "integer", description: "Generations actually run." },
        evaluations: { type: "integer", description: "Total objective evaluations." },
        converged: { type: "boolean", description: "Whether convergence criteria were met before maxIterations." },
        executionTimeMs: { type: "number" },
      },
      required: ["bestSolution", "bestFitness", "iterations", "converged"],
    },
    annotations: {
      title: "CMA-ES Continuous Optimization (Premium)",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },

  {
    name: "solve_constraints",
    description:
      "[Premium] Solve linear / mixed-integer / quadratic programs (HiGHS solver). " +
      "Use when the objective and constraints are linear (or quadratic) and you need a provably optimal solution: " +
      "budget allocation across line items, supply chain optimization, capacity planning with integer counts, " +
      "portfolio construction with hard caps. For continuous black-box objectives, use optimize_cmaes. " +
      "For task→slot scheduling, use solve_schedule. Returns variable assignments + objective value. Requires ORACLAW_API_KEY.",
    inputSchema: {
      type: "object" as const,
      properties: {
        direction: { type: "string", enum: ["maximize", "minimize"] },
        objective: {
          type: "object",
          description: "Map of variable name → coefficient in the objective function.",
          additionalProperties: { type: "number" },
        },
        variables: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              lower: { type: "number", description: "Lower bound (default: 0 / -inf depending on type)." },
              upper: { type: "number", description: "Upper bound (default: +inf)." },
              type: { type: "string", enum: ["continuous", "integer", "binary"], description: "Default: continuous." },
            },
            required: ["name"],
          },
        },
        constraints: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              coefficients: { type: "object", additionalProperties: { type: "number" } },
              lower: { type: "number" },
              upper: { type: "number" },
            },
            required: ["name", "coefficients"],
          },
        },
      },
      required: ["direction", "objective", "variables", "constraints"],
    },
    outputSchema: {
      type: "object" as const,
      properties: {
        status: { type: "string", description: "e.g. 'optimal', 'infeasible', 'unbounded'." },
        objectiveValue: { type: "number", description: "Objective at the optimum (when status='optimal')." },
        variables: {
          type: "object",
          additionalProperties: { type: "number" },
          description: "Map of variable name → solved value.",
        },
      },
      required: ["status"],
    },
    annotations: {
      title: "LP / MIP / QP Solver (HiGHS, Premium)",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },

  {
    name: "solve_schedule",
    description:
      "Assign tasks to time slots maximizing productivity, matching task energy requirements with slot energy levels. " +
      "Use specifically for task→slot assignment with energy matching (deep-work scheduling, shift planning, " +
      "exercise scheduling). For general resource allocation with arbitrary linear constraints, use solve_constraints. " +
      "For sequence/route problems, use plan_pathfind. Deterministic.",
    inputSchema: {
      type: "object" as const,
      properties: {
        tasks: {
          type: "array",
          minItems: 1,
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              duration: { type: "number", description: "Required slot duration (minutes)." },
              priority: { type: "number", description: "Higher = more important." },
              energyRequired: { type: "number", minimum: 0, maximum: 1, description: "0..1 energy demand." },
            },
            required: ["id", "duration"],
          },
        },
        slots: {
          type: "array",
          minItems: 1,
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              duration: { type: "number" },
              energyLevel: { type: "number", minimum: 0, maximum: 1 },
            },
            required: ["id", "duration"],
          },
        },
      },
      required: ["tasks", "slots"],
    },
    outputSchema: {
      type: "object" as const,
      properties: {
        assignments: {
          type: "array",
          items: {
            type: "object",
            properties: { taskId: { type: "string" }, slotId: { type: "string" }, score: { type: "number" } },
            required: ["taskId", "slotId"],
          },
        },
        unassignedTasks: { type: "array", items: { type: "string" }, description: "Task IDs that did not fit." },
        totalScore: { type: "number" },
      },
      required: ["assignments"],
    },
    annotations: {
      title: "Task-to-Slot Schedule Optimizer",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },

  {
    name: "analyze_graph",
    description:
      "[Premium] Compute structural properties of a directed graph: PageRank centrality, Louvain community detection, " +
      "shortest critical path between two nodes, and bottleneck identification. Use to surface influential nodes, " +
      "community clusters, or chokepoints in dependency graphs, knowledge graphs, supply chains, social networks. " +
      "For pathfinding alone (single source→goal route), use plan_pathfind — it's faster and free. Requires ORACLAW_API_KEY.",
    inputSchema: {
      type: "object" as const,
      properties: {
        nodes: {
          type: "array",
          minItems: 1,
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              type: { type: "string" },
              label: { type: "string" },
              confidence: { type: "number", minimum: 0, maximum: 1 },
            },
            required: ["id"],
          },
        },
        edges: {
          type: "array",
          items: {
            type: "object",
            properties: {
              source: { type: "string" },
              target: { type: "string" },
              type: { type: "string" },
              weight: { type: "number" },
            },
            required: ["source", "target"],
          },
        },
        sourceGoal: { type: "string", description: "Optional: node ID to use as start of critical path." },
        targetGoal: { type: "string", description: "Optional: node ID to use as end of critical path." },
      },
      required: ["nodes", "edges"],
    },
    outputSchema: {
      type: "object" as const,
      properties: {
        pageRank: { type: "object", additionalProperties: { type: "number" }, description: "Node ID → PageRank score." },
        communities: { type: "object", additionalProperties: { type: "integer" }, description: "Node ID → community index." },
        clusters: {
          type: "array",
          items: {
            type: "object",
            properties: {
              community: { type: "integer" },
              nodes: { type: "array", items: { type: "string" } },
              avgConfidence: { type: "number" },
            },
          },
        },
        criticalPath: { type: "array", items: { type: "string" }, description: "Node IDs from sourceGoal to targetGoal." },
        criticalPathWeight: { type: "number" },
        bottlenecks: { type: "array", description: "Nodes whose removal most disconnects the graph." },
        totalNodes: { type: "integer" },
      },
      required: ["pageRank", "communities", "totalNodes"],
    },
    annotations: {
      title: "Graph Analytics (PageRank + Louvain + Critical Path, Premium)",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },

  {
    name: "analyze_risk",
    description:
      "[Premium] Compute portfolio Value-at-Risk (VaR) and Conditional VaR (Expected Shortfall) from historical " +
      "asset return series, accounting for cross-asset correlation. Use for portfolio risk attribution, " +
      "regulatory capital sizing, drawdown scenario analysis. Returns are matrix [asset][time] of period returns. " +
      "For simulating outcomes from a parametric distribution rather than historical data, use simulate_montecarlo. " +
      "Requires ORACLAW_API_KEY.",
    inputSchema: {
      type: "object" as const,
      properties: {
        returns: {
          type: "array",
          minItems: 1,
          items: { type: "array", items: { type: "number" } },
          description: "[asset][time] matrix of period returns (e.g. daily). Each row same length.",
        },
        weights: {
          type: "array",
          items: { type: "number" },
          minItems: 1,
          description: "Portfolio weights per asset. Length must equal returns.length. Should sum to 1.",
        },
        confidence: { type: "number", minimum: 0, maximum: 1, description: "VaR confidence level (default: 0.95)." },
        horizonDays: { type: "integer", minimum: 1, description: "Horizon in days, scales VaR by sqrt(horizon) (default: 1)." },
      },
      required: ["returns", "weights"],
    },
    outputSchema: {
      type: "object" as const,
      properties: {
        var: { type: "number", description: "Value-at-Risk at the requested confidence (loss expressed as positive number)." },
        cvar: { type: "number", description: "Conditional VaR (mean loss beyond VaR threshold)." },
        expectedReturn: { type: "number" },
        volatility: { type: "number" },
        confidence: { type: "number" },
        horizonDays: { type: "integer" },
        assets: { type: "integer" },
      },
      required: ["var", "cvar", "expectedReturn", "volatility"],
    },
    annotations: {
      title: "Portfolio VaR / CVaR (Premium)",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },

  {
    name: "score_convergence",
    description:
      "Score how much multiple independent sources agree on a probability estimate, weighting by recency, volume, and confidence. " +
      "Use to fuse signals from polling, prediction markets, model ensembles, or any source emitting a 0..1 probability. " +
      "Returns an aggregate convergence score, the consensus probability, and per-pair disagreement so you can see which " +
      "sources are outliers. Free tier. For comparing pre-binned distributions, prefer this over simulate_montecarlo.",
    inputSchema: {
      type: "object" as const,
      properties: {
        sources: {
          type: "array",
          minItems: 1,
          description: "Independent estimators each emitting a probability for the same event.",
          items: {
            type: "object",
            properties: {
              id: { type: "string", description: "Stable source identifier." },
              name: { type: "string", description: "Display label." },
              probability: { type: "number", minimum: 0, maximum: 1, description: "This source's probability estimate." },
              confidence: { type: "number", minimum: 0, maximum: 1, description: "Optional. Source-reported certainty." },
              volume: { type: "number", minimum: 0, description: "Optional. Sample size / liquidity behind the estimate." },
              lastUpdated: { type: "integer", description: "Optional. Unix epoch ms; older sources are downweighted." },
            },
            required: ["id", "name", "probability"],
          },
        },
        config: {
          type: "object",
          description: "Optional weighting overrides.",
          properties: {
            wA: { type: "number", description: "Weight on agreement component." },
            wD: { type: "number", description: "Weight on dispersion penalty." },
            wU: { type: "number", description: "Weight on uncertainty penalty." },
            wF: { type: "number", description: "Weight on freshness." },
            scale: { type: "number" },
            shift: { type: "number" },
            freshnessHalfLifeMs: { type: "number", minimum: 1 },
            outlierThreshold: { type: "number", minimum: 0, maximum: 1 },
          },
        },
      },
      required: ["sources"],
    },
    outputSchema: {
      type: "object" as const,
      properties: {
        convergenceScore: { type: "number", minimum: 0, maximum: 1, description: "Overall agreement (1=consensus, 0=divergent)." },
        consensusProbability: { type: "number", minimum: 0, maximum: 1, description: "Weighted aggregate probability." },
        sources: { type: "integer", description: "Number of sources used." },
        components: {
          type: "object",
          description: "Per-component scores feeding the aggregate.",
        },
      },
      required: ["convergenceScore"],
    },
    annotations: {
      title: "Multi-Source Probability Convergence",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },

  {
    name: "predict_forecast",
    description:
      "[Premium] Project future values from a univariate time series using ARIMA or Holt-Winters (additive seasonal). " +
      "Use for short-to-medium horizon point forecasts with confidence bands: demand planning, KPI projection, " +
      "capacity forecasting. ARIMA suits non-seasonal trend data; Holt-Winters handles repeating seasonality (set seasonLength). " +
      "Needs at least ~20 observations for stable fit. For point-anomaly flags rather than projection, use detect_anomaly. " +
      "Requires ORACLAW_API_KEY.",
    inputSchema: {
      type: "object" as const,
      properties: {
        data: {
          type: "array",
          items: { type: "number" },
          minItems: 2,
          description: "Historical values, evenly spaced. ARIMA needs ≥20 points; Holt-Winters needs ≥2 × seasonLength.",
        },
        steps: { type: "integer", minimum: 1, description: "Number of future periods to forecast." },
        method: { type: "string", enum: ["arima", "holt-winters"], description: "Default: arima." },
        seasonLength: { type: "integer", minimum: 2, description: "Period of seasonality (only used by holt-winters). Default: 4." },
      },
      required: ["data", "steps"],
    },
    outputSchema: {
      type: "object" as const,
      properties: {
        forecast: { type: "array", items: { type: "number" }, description: "Point forecasts, length = steps." },
        confidence: {
          type: "object",
          properties: {
            lower: { type: "array", items: { type: "number" } },
            upper: { type: "array", items: { type: "number" } },
            level: { type: "number", description: "e.g. 0.95" },
          },
        },
        model: { type: "string", description: "Fitted model description." },
        method: { type: "string", enum: ["arima", "holt-winters"] },
        inputLength: { type: "integer" },
        steps: { type: "integer" },
      },
      required: ["forecast", "method", "steps"],
    },
    annotations: {
      title: "Time Series Forecast (ARIMA / Holt-Winters, Premium)",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },

  {
    name: "detect_anomaly",
    description:
      "[Premium] Flag outlier points in a numeric series using Z-score (parametric, assumes ~normal) or IQR (robust to skew). " +
      "Use for monitoring metrics, fraud signals, sensor noise, quality control. Z-score is faster and tighter on near-normal " +
      "data; IQR is the right default when the distribution has heavy tails or known outliers. Returns indices + values + " +
      "the underlying statistics. For projecting a series forward, use predict_forecast. Requires ORACLAW_API_KEY.",
    inputSchema: {
      type: "object" as const,
      properties: {
        data: { type: "array", items: { type: "number" }, minItems: 4, description: "Numeric series to scan." },
        method: { type: "string", enum: ["zscore", "iqr"], description: "Default: zscore." },
        threshold: {
          type: "number",
          description: "Z-score: standard deviations above mean (default: 3.0). IQR: multiplier on IQR (default: 1.5).",
        },
      },
      required: ["data"],
    },
    outputSchema: {
      type: "object" as const,
      properties: {
        method: { type: "string", enum: ["zscore", "iqr"] },
        anomalies: {
          type: "array",
          items: {
            type: "object",
            properties: { index: { type: "integer" }, value: { type: "number" }, score: { type: "number" } },
          },
        },
        stats: {
          type: "object",
          description: "For zscore: {mean, stdDev, threshold}. For iqr: {q1, q3, iqr, lowerBound, upperBound}.",
        },
        totalPoints: { type: "integer" },
        anomalyCount: { type: "integer" },
      },
      required: ["method", "anomalies", "anomalyCount"],
    },
    annotations: {
      title: "Anomaly Detection (Z-score / IQR, Premium)",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },

  {
    name: "plan_pathfind",
    description:
      "Find the shortest (or k-shortest) path between two nodes in a weighted graph using A* + Yen's algorithm. " +
      "Use for routing, dependency resolution, project critical-path discovery, or 'how do I get from X to Y' questions on graphs. " +
      "Set kPaths>1 to also return alternatives. For full graph structure analysis (centrality, communities), use analyze_graph. " +
      "For task-to-time-slot assignment, use solve_schedule. Free.",
    inputSchema: {
      type: "object" as const,
      properties: {
        nodes: {
          type: "array",
          minItems: 2,
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              cost: { type: "number", description: "Heuristic cost estimate at this node (used by 'cost' heuristic)." },
              time: { type: "number" },
              risk: { type: "number" },
            },
            required: ["id"],
          },
        },
        edges: {
          type: "array",
          items: {
            type: "object",
            properties: {
              from: { type: "string" },
              to: { type: "string" },
              cost: { type: "number" },
              time: { type: "number" },
              risk: { type: "number" },
            },
            required: ["from", "to"],
          },
        },
        start: { type: "string", description: "Start node ID." },
        end: { type: "string", description: "Goal node ID." },
        heuristic: {
          type: "string",
          enum: ["zero", "time", "cost", "risk", "weighted"],
          description: "A* heuristic. 'zero' = Dijkstra (default).",
        },
        kPaths: { type: "integer", minimum: 1, description: "Return up to k alternative paths (default: 1)." },
      },
      required: ["nodes", "edges", "start", "end"],
    },
    outputSchema: {
      type: "object" as const,
      properties: {
        path: { type: "array", items: { type: "string" }, description: "Node IDs from start to end." },
        totalCost: { type: "number" },
        breakdown: {
          type: "object",
          properties: { time: { type: "number" }, cost: { type: "number" }, risk: { type: "number" } },
        },
        nodesExplored: { type: "integer" },
        found: { type: "boolean", description: "False if no path exists." },
        executionTimeMs: { type: "number" },
        alternativePaths: {
          type: "array",
          items: {
            type: "object",
            properties: { path: { type: "array", items: { type: "string" } }, cost: { type: "number" } },
          },
          description: "Only present when kPaths > 1.",
        },
      },
      required: ["path", "totalCost", "found"],
    },
    annotations: {
      title: "A* / Yen's K-Shortest Paths",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },

  {
    name: "simulate_montecarlo",
    description:
      "Sample N draws from a parametric distribution and return summary statistics + percentiles + histogram. " +
      "Use to quantify uncertainty around a single random factor: project NPV with uncertain growth rate, " +
      "estimate latency tail percentiles, size insurance reserves. Supports normal/lognormal/uniform/triangular/beta/exponential. " +
      "For multi-asset portfolio risk with correlations, use analyze_risk. Each call re-samples (non-idempotent). " +
      "Capped at 2000 iterations on the free tier.",
    inputSchema: {
      type: "object" as const,
      properties: {
        distribution: {
          type: "string",
          enum: ["normal", "lognormal", "uniform", "triangular", "beta", "exponential"],
          description: "Distribution family to sample from.",
        },
        params: {
          type: "object",
          description: "Distribution parameters. Required keys depend on distribution: normal/lognormal={mean,stddev}, uniform={min,max}, triangular={min,mode,max}, beta={alpha,beta}, exponential={lambda}.",
          properties: {
            mean: { type: "number" },
            stddev: { type: "number" },
            min: { type: "number" },
            max: { type: "number" },
            mode: { type: "number" },
            alpha: { type: "number" },
            beta: { type: "number" },
            lambda: { type: "number" },
          },
        },
        simulations: { type: "integer", minimum: 1, maximum: 2000, description: "Number of samples (default: 1000, max: 2000 free)." },
      },
      required: ["distribution", "params"],
    },
    outputSchema: {
      type: "object" as const,
      properties: {
        mean: { type: "number" },
        stdDev: { type: "number" },
        percentiles: {
          type: "object",
          properties: {
            p5: { type: "number" }, p25: { type: "number" }, p50: { type: "number" },
            p75: { type: "number" }, p95: { type: "number" },
          },
        },
        histogram: { type: "array", items: { type: "object" }, description: "Bucketed counts." },
        iterations: { type: "integer" },
        executionTimeMs: { type: "number" },
        timedOut: { type: "boolean" },
      },
      required: ["mean", "stdDev", "percentiles", "iterations"],
    },
    annotations: {
      title: "Monte Carlo Simulation (single factor)",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },

  {
    name: "score_calibration",
    description:
      "Score how well-calibrated a set of probability predictions are against observed binary outcomes using Brier score " +
      "and log score. Use to evaluate forecaster accuracy, model calibration, prediction-market fairness. Lower Brier/log " +
      "score = better. predictions[i] is the probability assigned to event i; outcomes[i] is 1 if it happened, 0 otherwise. " +
      "For comparing multiple forecasters' agreement, use score_convergence instead. Free.",
    inputSchema: {
      type: "object" as const,
      properties: {
        predictions: {
          type: "array",
          items: { type: "number", minimum: 0, maximum: 1 },
          minItems: 1,
          description: "Predicted probabilities in [0,1].",
        },
        outcomes: {
          type: "array",
          items: { type: "number", enum: [0, 1] },
          minItems: 1,
          description: "Binary realised outcomes. Must be the same length as predictions.",
        },
      },
      required: ["predictions", "outcomes"],
    },
    outputSchema: {
      type: "object" as const,
      properties: {
        brier_score: { type: "number", description: "Mean squared error between probability and outcome (lower is better)." },
        log_score: { type: "number", description: "Negative log-likelihood (lower is better; -inf possible if a 0-prob event happens)." },
        n_predictions: { type: "integer" },
        mean_prediction: { type: "number" },
        mean_outcome: { type: "number" },
      },
      required: ["brier_score", "log_score", "n_predictions"],
    },
    annotations: {
      title: "Calibration Scoring (Brier + Log)",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },

  {
    name: "predict_bayesian",
    description:
      "Update a prior probability with weighted evidence using a Beta-Bayesian posterior. " +
      "Use for incremental belief revision: starting from a baseline probability, fold in new signals (each with a value " +
      "in [0,1] and a weight) and get an updated posterior plus calibration score. Suited to fraud-risk scoring, A/B test " +
      "stopping decisions, diagnostic probability stacking. For combining N independent model predictions, use predict_ensemble. " +
      "For full distribution sampling, use simulate_montecarlo. Free.",
    inputSchema: {
      type: "object" as const,
      properties: {
        prior: {
          type: "number",
          minimum: 0,
          maximum: 1,
          description: "Prior probability of the event (0..1). Used to seed Beta(prior*10, (1-prior)*10).",
        },
        evidence: {
          type: "array",
          minItems: 1,
          description: "Pieces of evidence to fold in.",
          items: {
            type: "object",
            properties: {
              factor: { type: "string", description: "Identifier / label for this signal." },
              weight: { type: "number", description: "How heavily this signal counts." },
              value: { type: "number", minimum: 0, maximum: 1, description: "Signal value in [0,1]." },
            },
            required: ["factor", "weight", "value"],
          },
        },
      },
      required: ["prior", "evidence"],
    },
    outputSchema: {
      type: "object" as const,
      properties: {
        posterior: { type: "number", minimum: 0, maximum: 1, description: "Updated probability after folding in evidence." },
        priorProbability: { type: "number" },
        factors: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              value: { type: "number" },
              weight: { type: "number" },
              direction: { type: "string", enum: ["positive", "negative"] },
            },
          },
        },
        posteriorMean: { type: "number" },
        posteriorVariance: { type: "number" },
        calibrationScore: { type: "number", description: "1 - sqrt(variance); higher = sharper posterior." },
      },
      required: ["posterior", "posteriorMean", "posteriorVariance"],
    },
    annotations: {
      title: "Bayesian Belief Update (Beta posterior)",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },

  {
    name: "predict_ensemble",
    description:
      "Combine N model predictions into a single consensus value using weighted voting, stacking, or Bayesian model averaging. " +
      "Returns the consensus, decomposed uncertainty (epistemic vs aleatoric), agreement score, weight share per model, and " +
      "Shannon entropy of the weight distribution. Use to fuse outputs from heterogeneous predictors (statistical + ML + " +
      "human forecasters). For fusing source-agreement on a probability of one event, use score_convergence. Free.",
    inputSchema: {
      type: "object" as const,
      properties: {
        predictions: {
          type: "array",
          minItems: 2,
          description: "Predictions from each model (at least 2).",
          items: {
            type: "object",
            properties: {
              modelId: { type: "string", description: "Stable model identifier." },
              prediction: { type: "number", description: "Point prediction (any numeric scale)." },
              confidence: { type: "number", minimum: 0, maximum: 1, description: "Model-reported confidence [0,1]." },
              historicalAccuracy: { type: "number", minimum: 0, maximum: 1, description: "Optional. Overrides confidence for weighting." },
            },
            required: ["modelId", "prediction", "confidence"],
          },
        },
        method: {
          type: "string",
          enum: ["weighted-voting", "stacking", "bayesian-averaging"],
          description: "Combination method (default: weighted-voting).",
        },
      },
      required: ["predictions"],
    },
    outputSchema: {
      type: "object" as const,
      properties: {
        consensus: { type: "number", description: "Combined point prediction." },
        confidence: { type: "number", minimum: 0, maximum: 1, description: "Aggregate confidence." },
        weights: { type: "object", additionalProperties: { type: "number" }, description: "modelId → weight used." },
        entropy: { type: "number", description: "Shannon entropy of the weight distribution (higher = more diversified)." },
        agreement: { type: "number", description: "Cross-model agreement score (1=all agree, 0=disagree)." },
        uncertainty: {
          type: "object",
          properties: {
            epistemic: { type: "number", description: "Model uncertainty (reducible with more data)." },
            aleatoric: { type: "number", description: "Irreducible noise." },
            total: { type: "number" },
            confidenceInterval: {
              type: "object",
              properties: { lower: { type: "number" }, upper: { type: "number" } },
            },
          },
        },
        modelContributions: {
          type: "object",
          additionalProperties: {
            type: "object",
            properties: { weight: { type: "number" }, prediction: { type: "number" }, contribution: { type: "number" } },
          },
        },
        method: { type: "string" },
      },
      required: ["consensus", "confidence", "method"],
    },
    annotations: {
      title: "Ensemble Multi-Model Consensus",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },

  {
    name: "optimize_evolve",
    description:
      "Genetic algorithm for combinatorial / discrete optimization with optional Pareto frontier for multi-objective problems. " +
      "Use when the search space is discrete or mixed (binary feature selection, integer allocation, permutation problems like TSP), " +
      "or when you want to explore multiple non-dominated solutions. For continuous black-box parameters, use optimize_cmaes — " +
      "it converges faster on smooth objectives. Stochastic: same input gives different best chromosome each run. Free.",
    inputSchema: {
      type: "object" as const,
      properties: {
        geneLength: { type: "integer", minimum: 1, description: "Number of genes (variables) per chromosome." },
        bounds: {
          type: "object",
          properties: {
            min: { type: "number", description: "Per-gene lower bound." },
            max: { type: "number", description: "Per-gene upper bound." },
            type: {
              type: "string",
              enum: ["binary", "integer", "real", "permutation"],
              description: "Default: real.",
            },
          },
        },
        fitnessWeights: {
          type: "array",
          items: { type: "number" },
          description: "Per-gene weights in the default linear fitness sum. Length should equal geneLength.",
        },
        populationSize: { type: "integer", minimum: 2, maximum: 500, description: "Default: 100, capped at 500." },
        maxGenerations: { type: "integer", minimum: 1, maximum: 500, description: "Default: 100, capped at 500." },
        mutationRate: { type: "number", minimum: 0, maximum: 1, description: "Per-gene mutation probability (default: 0.01)." },
        crossoverRate: { type: "number", minimum: 0, maximum: 1, description: "Crossover probability (default: 0.8)." },
        selectionMethod: { type: "string", enum: ["tournament", "roulette", "rank"], description: "Default: tournament." },
        crossoverMethod: { type: "string", enum: ["single-point", "two-point", "uniform"], description: "Default: single-point." },
      },
      required: ["geneLength"],
    },
    outputSchema: {
      type: "object" as const,
      properties: {
        bestChromosome: {
          type: "object",
          properties: {
            genes: { type: "array", items: { type: "number" } },
            fitness: { type: "number" },
          },
          required: ["genes", "fitness"],
        },
        paretoFrontier: {
          type: "array",
          description: "Non-dominated solutions (multi-objective only).",
          items: {
            type: "object",
            properties: {
              genes: { type: "array", items: { type: "number" } },
              fitness: { type: "number" },
            },
          },
        },
        convergenceGeneration: { type: "integer", description: "Generation at which best fitness stopped improving." },
        totalGenerations: { type: "integer" },
        executionTimeMs: { type: "number" },
        fitnessHistory: { type: "array", items: { type: "number" }, description: "Last 20 generations' best fitness." },
      },
      required: ["bestChromosome", "totalGenerations"],
    },
    annotations: {
      title: "Genetic Algorithm (discrete + multi-objective)",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },

  {
    name: "simulate_scenario",
    description:
      "Compare named what-if scenarios against a base case, returning per-scenario outcome delta plus a sensitivity ranking " +
      "showing which input variables move the outcome most across scenarios. Use for budget sensitivity analysis, deal " +
      "what-ifs, capacity planning under multiple demand assumptions. The default outcome metric is the sum of input variables — " +
      "supply scenarios that vary individual drivers to isolate their impact. For random sampling from a distribution, use " +
      "simulate_montecarlo. Free.",
    inputSchema: {
      type: "object" as const,
      properties: {
        baseCase: {
          type: "object",
          additionalProperties: { type: "number" },
          description: "Variable name → baseline value.",
        },
        scenarios: {
          type: "array",
          minItems: 1,
          description: "Named what-if scenarios. Each overrides any subset of baseCase variables.",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              variables: { type: "object", additionalProperties: { type: "number" } },
            },
            required: ["name", "variables"],
          },
        },
      },
      required: ["baseCase", "scenarios"],
    },
    outputSchema: {
      type: "object" as const,
      properties: {
        baseCase: {
          type: "object",
          properties: {
            outcome: { type: "number" },
            variables: { type: "object", additionalProperties: { type: "number" } },
          },
        },
        results: {
          type: "array",
          items: {
            type: "object",
            properties: {
              scenario: { type: "string" },
              outcome: { type: "number" },
              delta: { type: "number", description: "outcome − baseCase.outcome" },
              deltaPercent: { type: "number" },
              variables: {
                type: "object",
                additionalProperties: {
                  type: "object",
                  properties: {
                    value: { type: "number" },
                    change: { type: "number" },
                    changePercent: { type: "number" },
                  },
                },
              },
            },
          },
        },
        sensitivityRanking: {
          type: "array",
          description: "Variables ranked by total absolute swing across scenarios.",
          items: {
            type: "object",
            properties: { variable: { type: "string" }, totalSwing: { type: "number" } },
          },
        },
        scenarioCount: { type: "integer" },
      },
      required: ["baseCase", "results", "scenarioCount"],
    },
    annotations: {
      title: "What-If Scenario Comparison + Sensitivity",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
];

// ── Endpoint mapping ──────────────────────────────────

const ENDPOINTS: Record<string, string> = {
  optimize_bandit: "/api/v1/optimize/bandit",
  optimize_contextual: "/api/v1/optimize/contextual-bandit",
  optimize_cmaes: "/api/v1/optimize/cmaes",
  optimize_evolve: "/api/v1/optimize/evolve",
  solve_constraints: "/api/v1/solve/constraints",
  solve_schedule: "/api/v1/solve/schedule",
  analyze_graph: "/api/v1/analyze/graph",
  analyze_risk: "/api/v1/analyze/risk",
  score_convergence: "/api/v1/score/convergence",
  score_calibration: "/api/v1/score/calibration",
  predict_forecast: "/api/v1/predict/forecast",
  predict_bayesian: "/api/v1/predict/bayesian",
  predict_ensemble: "/api/v1/predict/ensemble",
  detect_anomaly: "/api/v1/detect/anomaly",
  plan_pathfind: "/api/v1/plan/pathfind",
  simulate_montecarlo: "/api/v1/simulate/montecarlo",
  simulate_scenario: "/api/v1/simulate/scenario",
};

// ── Handlers ──────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const endpoint = ENDPOINTS[name];
  if (!endpoint) {
    return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };
  }
  const t0 = Date.now();
  try {
    const result = await callAPI(endpoint, args);
    trackTool(name, Date.now() - t0, true);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  } catch (err) {
    trackTool(name, Date.now() - t0, false);
    if (err instanceof PremiumToolError) {
      return {
        content: [{
          type: "text",
          text: [
            `Premium tool — API key required`,
            ``,
            `"${name}" requires an OraClaw API key (free signup).`,
            ``,
            `To unlock all 12 tools:`,
            `1. Run: curl -X POST ${API_URL}/api/v1/auth/signup -H "Content-Type: application/json" -d '{"email":"you@example.com"}'`,
            `2. Set ORACLAW_API_KEY in your MCP config`,
            ``,
            `Free tools available now: ${err.freeTools.join(', ')}`,
          ].join('\n'),
        }],
      };
    }
    const msg = err instanceof Error ? err.message : String(err);
    return { content: [{ type: "text", text: `Error: ${msg}` }], isError: true };
  }
});

// ── Start ─────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
