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

// Shared upgrade-path constants — used by BOTH the premium (403) and
// rate-limit (429) recovery messages so the signup URL and x402 hint never drift.
const SIGNUP_URL = "https://web-olive-one-89.vercel.app/signup";
const X402_HINT = "Or pay per call with x402 USDC on Base ($0.001/call, no signup).";

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
  if (res.status === 429) {
    const body = await res.json().catch(() => ({})) as Record<string, unknown>;
    const detail = (typeof body.detail === "string" && body.detail)
      || (typeof body.title === "string" && body.title)
      || "Rate limit exceeded.";
    // Prefer the structured retry_after if the problem+json carries one, else the header.
    const headerRetry = res.headers.get("retry-after");
    let retryAfter: number | undefined;
    if (typeof body.retry_after === "number") retryAfter = body.retry_after;
    else if (headerRetry && !Number.isNaN(Number(headerRetry))) retryAfter = Number(headerRetry);
    throw new RateLimitError(detail, retryAfter);
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

class RateLimitError extends Error {
  constructor(public detail: string, public retryAfter?: number) {
    super(`Rate limited: ${detail}`);
    this.name = 'RateLimitError';
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
  { name: "oraclaw", version: "1.4.2" },
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
      "Select the next option to try from 2+ variants that each have observed pull/reward history, balancing exploitation " +
      "against exploration (UCB1, Thompson sampling, or epsilon-greedy). Use when you must pick one arm now from A/B test " +
      "variants, ad/email/copy options, or ranked recommendations and have past trial counts. Returns the chosen arm plus " +
      "exploitation score, exploration bonus, and a regret estimate. For per-call context features use optimize_contextual; " +
      "for continuous parameters use optimize_cmaes.",
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
      "Select the best option given a numeric context/feature vector, using a LinUCB contextual bandit that learns " +
      "per-context preferences from optional history. Use when the best choice changes with situational features that " +
      "vary call-to-call (user/segment attributes, time of day, current regime). Returns the chosen arm with its LinUCB " +
      "expected reward and confidence width. If you have no per-call features, use optimize_bandit.",
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
      "[Premium] Optimize N continuous parameters against a weighted-sum objective using CMA-ES, suited to " +
      "non-convex/noisy/gradient-free landscapes. Use for hyperparameter search, simulator calibration, or control-policy " +
      "tuning where you supply per-dimension objective weights. Returns the best parameter vector, its objective value, " +
      "iteration/evaluation counts, and a converged flag; stochastic init means repeated runs may differ. Use optimize_evolve " +
      "for discrete spaces and solve_constraints for linear/MIP constraints. Premium: needs an ORACLAW_API_KEY OR a per-call x402 payment (no signup).",
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
      "[Premium] Solve a linear / mixed-integer / quadratic program with the HiGHS solver and return a provably optimal " +
      "assignment. Use when your objective and constraints are linear (or quadratic) over named continuous/integer/binary " +
      "variables: budget allocation, supply or capacity planning with integer counts, allocation with hard caps. Returns " +
      "solver status (optimal/infeasible/unbounded), the objective value, and the solved value per variable. Use " +
      "optimize_cmaes for black-box objectives and solve_schedule for task-to-slot assignment. Premium: needs an ORACLAW_API_KEY OR a per-call x402 payment (no signup).",
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
      "Assign tasks to time slots to maximize total score by matching each task's energy requirement to a slot's energy " +
      "level (and respecting duration). Use for deep-work blocking, shift or session planning, or any task-to-slot fit " +
      "where high-energy work should land in high-energy slots. Returns the assignments, any unassigned task IDs, and a " +
      "total score. For arbitrary linear constraints use solve_constraints; for routing use plan_pathfind.",
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
      "[Premium] Compute structural metrics of a directed weighted graph: PageRank centrality, Louvain community clusters, " +
      "an optional critical path between two given nodes, and bottleneck nodes. Use to find the most influential nodes, " +
      "cluster a dependency/knowledge graph, or locate chokepoints in supply or process networks. Returns per-node PageRank " +
      "and community index, cluster summaries, the critical path with its weight, and bottlenecks. For a single " +
      "source-to-goal route, use plan_pathfind (free). Premium: needs an ORACLAW_API_KEY OR a per-call x402 payment (no signup).",
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
      "[Premium] Compute portfolio Value-at-Risk and Conditional VaR (Expected Shortfall) from a historical [asset][time] " +
      "return matrix and portfolio weights, accounting for cross-asset correlation. Use to size downside risk on a weighted " +
      "multi-asset book, attribute risk, or run drawdown scenarios with auditable inputs. Returns VaR and CVaR (loss as a " +
      "positive number) at the requested confidence, plus expected return, volatility, and the horizon used. To sample " +
      "outcomes from a parametric distribution instead, use simulate_montecarlo. Premium: needs an ORACLAW_API_KEY OR a per-call x402 payment (no signup).",
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
      "Score how strongly multiple independent sources agree on a single event's probability, using Hellinger-distance " +
      "agreement plus penalties for dispersion/uncertainty and a freshness weight (recency, source volume, and confidence). " +
      "Use to fuse 0..1 estimates from polls, prediction markets, or model outputs into one number. Returns a 0..1 " +
      "convergence score, the volume-weighted consensus probability, source count, and component breakdown. To combine " +
      "N point predictions instead, use predict_ensemble.",
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
      "[Premium] Forecast the next N values of one evenly-spaced numeric time series using ARIMA (non-seasonal trend) or " +
      "Holt-Winters (additive seasonal, set seasonLength). Use for short-to-medium horizon point forecasts of demand, KPIs, " +
      "or capacity. Returns the point forecast array plus lower/upper confidence bands and the fitted model description. " +
      "ARIMA requires at least 20 observations; Holt-Winters needs at least 2 x seasonLength. To flag outliers instead of " +
      "projecting, use detect_anomaly. Premium: needs an ORACLAW_API_KEY OR a per-call x402 payment (no signup).",
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
      "[Premium] Flag outlier points in a numeric series using a Z-score test (parametric, assumes near-normal) or IQR test " +
      "(robust to skew/heavy tails). Use for metric monitoring, fraud/abuse signals, sensor noise, or quality control. " +
      "Returns each anomaly's index, value, and score, plus the underlying statistics (mean/stdDev/threshold for Z-score; " +
      "q1/q3/IQR/bounds for IQR) and an anomaly count. To project a series forward instead, use predict_forecast. " +
      "Premium: needs an ORACLAW_API_KEY OR a per-call x402 payment (no signup).",
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
      "Find the shortest path (or k-shortest paths) between a start and end node in a weighted directed graph using A* with " +
      "selectable heuristic (zero=Dijkstra, time, cost, risk, weighted) and Yen's algorithm for alternatives. Use for " +
      "routing, dependency resolution, or 'how do I get from X to Y' over a graph; set kPaths>1 for alternatives. Returns " +
      "the path node IDs, total cost, a time/cost/risk breakdown, nodes explored, and a found flag. For centrality/communities " +
      "use analyze_graph; for task-to-slot assignment use solve_schedule.",
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
      "Draw N samples from one parametric distribution (normal, lognormal, uniform, triangular, beta, or exponential) and " +
      "summarize the resulting spread. Use to quantify uncertainty around a single random factor: an NPV under an uncertain " +
      "growth rate, a latency tail, or a reserve estimate. Returns the mean, standard deviation, p5/p25/p50/p75/p95 " +
      "percentiles, a histogram, and the iteration count; each call re-samples (non-deterministic) and is capped at 2000 " +
      "iterations. For correlated multi-asset risk, use analyze_risk.",
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
      "Measure how well a set of probability predictions matched observed binary outcomes, returning the Brier score and log " +
      "score (lower is better). Use to evaluate a forecaster's or model's calibration: predictions[i] is the probability " +
      "assigned to event i and outcomes[i] is 1 if it occurred, else 0 (arrays must be equal length). Returns brier_score, " +
      "log_score, the number of predictions, and the mean predicted vs mean observed rate. To measure agreement across " +
      "multiple sources instead, use score_convergence.",
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
      "Update a prior probability with weighted evidence signals using a Beta posterior (the prior seeds Beta(prior*10, " +
      "(1-prior)*10)). Use for incremental belief revision: start from a baseline probability and fold in signals, each a " +
      "value in [0,1] with a weight, to get a revised posterior. Returns the updated posterior, the prior, per-factor " +
      "contributions, posterior mean and variance, and a sharpness/calibration score. To combine N independent point " +
      "predictions use predict_ensemble; to sample a full distribution use simulate_montecarlo.",
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
      "Combine 2+ model point predictions into one consensus using weighted voting, stacking, or Bayesian model averaging, " +
      "weighting each model by its confidence or supplied historicalAccuracy. Use to fuse heterogeneous predictors " +
      "(statistical, ML, and human forecasters) into a single number with an uncertainty estimate. Returns the consensus " +
      "value and confidence, per-model weight share, Shannon entropy of the weights, a cross-model agreement score, " +
      "epistemic/aleatoric/total uncertainty with a confidence interval, and per-model contributions. To score agreement " +
      "on a single event probability instead, use score_convergence.",
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
      "Run a genetic algorithm over a fixed-length gene vector (binary, integer, real, or permutation bounds) against a " +
      "weighted-sum fitness, with an optional Pareto frontier for multi-objective runs. Use for discrete or mixed search " +
      "spaces (feature selection, integer allocation, permutation/TSP-style problems) or when you want several non-dominated " +
      "solutions. Returns the best chromosome and fitness, the Pareto frontier when applicable, the convergence generation, " +
      "total generations, and recent fitness history; results vary run to run (stochastic). For smooth continuous objectives, " +
      "use optimize_cmaes.",
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
      "Compare named what-if scenarios against a base case where the outcome metric is the sum of the input variables, and " +
      "rank which variables swing the outcome most. Use for budget sensitivity, deal/forecast what-ifs, or capacity planning " +
      "across demand assumptions: define a base case of variable=value, then scenarios that override a subset. Returns the " +
      "base outcome, each scenario's outcome with absolute and percent delta and per-variable changes, plus a sensitivity " +
      "ranking by total absolute swing. For random sampling from a distribution, use simulate_montecarlo.",
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
            `"${name}" needs an OraClaw API key (premium tool).`,
            ``,
            `Get one in 30 seconds — enter your email at:`,
            `  ${SIGNUP_URL}`,
            ``,
            `Then add it to your MCP config:`,
            `  "oraclaw": {`,
            `    "command": "npx",`,
            `    "args": ["-y", "@oraclaw/mcp-server"],`,
            `    "env": { "ORACLAW_API_KEY": "<your-key>" }`,
            `  }`,
            ``,
            `Free tools that work without a key: ${err.freeTools.join(', ')}`,
            ``,
            X402_HINT,
          ].join('\n'),
        }],
      };
    }
    if (err instanceof RateLimitError) {
      const retryLine = typeof err.retryAfter === "number"
        ? `Retry after ${err.retryAfter} seconds.`
        : `Retry after the window resets.`;
      return {
        content: [{
          type: "text",
          text: [
            `Rate limit hit on "${name}" (HTTP 429): ${err.detail}`,
            retryLine,
            ``,
            `Raise your limit — sign up free for an API key at:`,
            `  ${SIGNUP_URL}`,
            ``,
            X402_HINT,
          ].join('\n'),
        }],
      };
    }
    const msg = err instanceof Error ? err.message : String(err);
    return { content: [{ type: "text", text: `Error: ${msg}` }], isError: true };
  }
});

// ── CLI flags ─────────────────────────────────────────
//
// `--print-tools` dumps the tool registry (inputSchema + outputSchema +
// annotations) to stdout as JSON and exits. This lets directory crawlers
// (Glama, Smithery inspectors) enumerate the tool surface WITHOUT booting
// the stdio transport or needing any environment variables — fixing the
// "tools: []" issue on server-list pages that run the binary env-less.
//
// `--version` / `--help` are stubs for discoverability.

if (process.argv.includes("--print-tools")) {
  process.stdout.write(JSON.stringify({ tools: TOOLS }, null, 2) + "\n");
  process.exit(0);
}

if (process.argv.includes("--version")) {
  process.stdout.write("1.4.2\n");
  process.exit(0);
}

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  process.stdout.write([
    "OraClaw MCP Server — 17 decision intelligence tools for AI agents",
    "",
    "Usage:",
    "  oraclaw-mcp                  Start stdio MCP server (normal use)",
    "  oraclaw-mcp --print-tools    Print all tool schemas as JSON and exit",
    "  oraclaw-mcp --version        Print version and exit",
    "  oraclaw-mcp --help           Print this help and exit",
    "",
    "Environment:",
    "  ORACLAW_API_KEY              Required for 6 premium tools (free tier otherwise)",
    "  ORACLAW_API_URL              Override API base (default oraclaw-api.onrender.com)",
    "  (Premium tools also accept per-call x402 USDC payments — no signup. See /api/v1/pricing.)",
    "",
    "Docs: https://github.com/Whatsonyourmind/oraclaw",
    "",
  ].join("\n"));
  process.exit(0);
}

// ── Start stdio transport ─────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
