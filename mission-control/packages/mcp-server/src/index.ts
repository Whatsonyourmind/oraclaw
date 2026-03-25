#!/usr/bin/env npx tsx
/**
 * OraClaw MCP Server — Exposes decision intelligence algorithms to AI agents
 *
 * Install in Claude Code:
 *   claude mcp add oraclaw npx tsx /path/to/packages/mcp-server/src/index.ts
 *
 * Or in mcp.json:
 *   "oraclaw": { "command": "npx", "args": ["tsx", "/path/to/index.ts"] }
 *
 * Tools exposed:
 *   optimize_bandit          — Multi-Armed Bandit (UCB1/Thompson/ε-Greedy)
 *   optimize_contextual      — Contextual Bandit (LinUCB)
 *   optimize_cmaes           — CMA-ES continuous black-box optimization
 *   solve_constraints        — LP/MIP/QP Optimization (HiGHS)
 *   solve_schedule           — Task scheduling with energy matching
 *   analyze_decision_graph   — PageRank, communities, critical path
 *   analyze_portfolio_risk   — VaR/CVaR portfolio risk analysis
 *   score_convergence        — Multi-source agreement scoring
 *   score_calibration        — Brier + log score for predictions
 *   predict_forecast         — ARIMA / Holt-Winters time series forecasting
 *   detect_anomaly           — Z-Score / IQR anomaly detection
 *   plan_pathfind            — A* pathfinding with k-shortest paths
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// Import algorithms (relative to monorepo)
import { createBandit } from "../../apps/api/src/services/oracle/algorithms/multiArmedBandit.js";
import { createContextualBandit } from "../../apps/api/src/services/oracle/algorithms/contextualBandit.js";
import { createDecisionGraph } from "../../apps/api/src/services/oracle/algorithms/decisionGraph.js";
import {
  computeConvergence,
  brierScore,
  logScore,
} from "../../apps/api/src/services/oracle/algorithms/convergenceScoring.js";
import {
  solve,
  optimizeSchedule,
} from "../../apps/api/src/services/oracle/algorithms/constraintOptimizer.js";
import {
  AStarPathfinder,
  Heuristics,
  type GraphNode,
  type GraphEdge,
} from "../../apps/api/src/services/oracle/algorithms/astar.js";
import {
  forecast,
  holtWinters,
} from "../../apps/api/src/services/oracle/algorithms/timeSeries.js";
import {
  detectAnomaliesZScore,
  detectAnomaliesIQR,
} from "../../apps/api/src/services/oracle/algorithms/anomalyDetector.js";
import {
  optimizeCMAES,
  type CMAESConfig,
} from "../../apps/api/src/services/oracle/algorithms/cmaes.js";
import {
  portfolioVaR,
} from "../../apps/api/src/services/oracle/algorithms/correlationMatrix.js";

const server = new Server(
  {
    name: "oraclaw-decision-intelligence",
    version: "2.0.0",
  },
  {
    capabilities: { tools: {} },
  },
);

// ── Tool Definitions ───────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "optimize_bandit",
      description:
        "Multi-Armed Bandit optimization. Given a set of options (arms) with historical performance, selects the best option using UCB1, Thompson Sampling, or Epsilon-Greedy. Use for A/B testing, feature flag optimization, or any explore-exploit tradeoff.",
      inputSchema: {
        type: "object" as const,
        properties: {
          arms: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                name: { type: "string" },
                pulls: { type: "number", description: "Number of times tried" },
                totalReward: { type: "number", description: "Cumulative reward (0-1 scale)" },
              },
              required: ["id", "name"],
            },
            description: "Options to choose from, with optional history",
          },
          algorithm: {
            type: "string",
            enum: ["ucb1", "thompson", "epsilon-greedy"],
            description: "Selection algorithm (default: ucb1)",
          },
        },
        required: ["arms"],
      },
    },
    {
      name: "optimize_contextual",
      description:
        "Contextual Bandit (LinUCB). Selects the best option given CONTEXT FEATURES like time of day, energy level, urgency, complexity. Learns which options work best in which situations. Use for personalized recommendations, adaptive task prioritization, or context-aware decisions.",
      inputSchema: {
        type: "object" as const,
        properties: {
          arms: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                name: { type: "string" },
              },
              required: ["id", "name"],
            },
          },
          context: {
            type: "array",
            items: { type: "number" },
            description: "Feature vector describing current situation (e.g., [timeOfDay, energy, urgency])",
          },
          history: {
            type: "array",
            items: {
              type: "object",
              properties: {
                armId: { type: "string" },
                reward: { type: "number" },
                context: { type: "array", items: { type: "number" } },
              },
            },
            description: "Past observations to learn from",
          },
        },
        required: ["arms", "context"],
      },
    },
    {
      name: "solve_constraints",
      description:
        "Linear/Integer Programming solver (HiGHS). Solves optimization problems with constraints. Use for resource allocation, budget optimization, scheduling with hard limits, or any problem where you maximize/minimize an objective subject to constraints.",
      inputSchema: {
        type: "object" as const,
        properties: {
          direction: { type: "string", enum: ["minimize", "maximize"] },
          objective: {
            type: "object",
            description: "Variable name → coefficient in objective function",
            additionalProperties: { type: "number" },
          },
          variables: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                lower: { type: "number" },
                upper: { type: "number" },
                type: { type: "string", enum: ["continuous", "integer", "binary"] },
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
    },
    {
      name: "solve_schedule",
      description:
        "Optimal task scheduling. Given tasks (with priority, duration, energy requirement) and time slots (with available energy), finds the assignment that maximizes priority-weighted completion with energy matching. Use for daily planning, sprint planning, or resource scheduling.",
      inputSchema: {
        type: "object" as const,
        properties: {
          tasks: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                name: { type: "string" },
                durationMinutes: { type: "number" },
                priority: { type: "number", description: "Higher = more important" },
                energyRequired: { type: "string", enum: ["high", "medium", "low"] },
              },
              required: ["id", "name", "durationMinutes", "priority", "energyRequired"],
            },
          },
          slots: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                startTime: { type: "number" },
                durationMinutes: { type: "number" },
                energyLevel: { type: "string", enum: ["high", "medium", "low"] },
              },
              required: ["id", "startTime", "durationMinutes", "energyLevel"],
            },
          },
        },
        required: ["tasks", "slots"],
      },
    },
    {
      name: "analyze_decision_graph",
      description:
        "Graph analysis for decision networks. Computes PageRank (most influential decisions), Louvain communities (clusters of related decisions), bottlenecks (blocking nodes), and critical path. Use for dependency analysis, project planning, or understanding decision impact chains.",
      inputSchema: {
        type: "object" as const,
        properties: {
          nodes: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                type: { type: "string", enum: ["decision", "signal", "action", "outcome", "constraint", "goal"] },
                label: { type: "string" },
                urgency: { type: "string", enum: ["critical", "high", "medium", "low"] },
                confidence: { type: "number" },
                impact: { type: "number" },
                timestamp: { type: "number" },
              },
              required: ["id", "type", "label", "urgency", "confidence", "impact", "timestamp"],
            },
          },
          edges: {
            type: "array",
            items: {
              type: "object",
              properties: {
                source: { type: "string" },
                target: { type: "string" },
                type: { type: "string", enum: ["depends_on", "influences", "blocks", "enables", "conflicts_with", "supports"] },
                weight: { type: "number" },
              },
              required: ["source", "target", "type", "weight"],
            },
          },
          sourceGoal: { type: "string", description: "Start node for critical path" },
          targetGoal: { type: "string", description: "End node for critical path" },
        },
        required: ["nodes", "edges"],
      },
    },
    {
      name: "score_convergence",
      description:
        "Multi-source convergence scoring. Given multiple prediction/data sources, computes how much they agree using Hellinger distance, entropy, and directional consensus. Use for assessing forecast reliability, data quality, or expert agreement.",
      inputSchema: {
        type: "object" as const,
        properties: {
          sources: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                name: { type: "string" },
                probability: { type: "number", description: "Prediction 0-1" },
                confidence: { type: "number" },
                volume: { type: "number" },
                lastUpdated: { type: "number" },
              },
              required: ["id", "name", "probability", "lastUpdated"],
            },
          },
        },
        required: ["sources"],
      },
    },
    {
      name: "score_calibration",
      description:
        "Calibration scoring for predictions. Computes Brier score and log score given predictions and outcomes. Use for evaluating forecaster accuracy, model calibration, or prediction market performance.",
      inputSchema: {
        type: "object" as const,
        properties: {
          predictions: {
            type: "array",
            items: { type: "number" },
            description: "Predicted probabilities (0-1)",
          },
          outcomes: {
            type: "array",
            items: { type: "number" },
            description: "Actual outcomes (0 or 1)",
          },
        },
        required: ["predictions", "outcomes"],
      },
    },
    {
      name: "plan_pathfind",
      description:
        "A* pathfinding through task/decision graphs. Finds the optimal path considering time, cost, and risk factors. Supports multiple heuristics and k-shortest paths (Yen's algorithm). Use for critical path analysis, project dependency navigation, or finding least-cost routes through decision networks.",
      inputSchema: {
        type: "object" as const,
        properties: {
          nodes: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                cost: { type: "number", description: "Estimated cost at this node" },
                time: { type: "number", description: "Estimated time at this node" },
                risk: { type: "number", description: "Risk factor 0-1" },
              },
              required: ["id"],
            },
            description: "Nodes in the task/decision graph",
          },
          edges: {
            type: "array",
            items: {
              type: "object",
              properties: {
                from: { type: "string" },
                to: { type: "string" },
                cost: { type: "number", description: "Monetary cost to traverse" },
                time: { type: "number", description: "Time cost to traverse" },
                risk: { type: "number", description: "Risk of traversal 0-1" },
              },
              required: ["from", "to"],
            },
            description: "Directed edges connecting nodes",
          },
          start: { type: "string", description: "Start node ID" },
          end: { type: "string", description: "Goal node ID" },
          heuristic: {
            type: "string",
            enum: ["zero", "time", "cost", "risk", "weighted"],
            description: "Heuristic function (default: zero = Dijkstra)",
          },
          kPaths: {
            type: "number",
            description: "Number of alternative paths to find (default: 1)",
          },
        },
        required: ["nodes", "edges", "start", "end"],
      },
    },
    {
      name: "predict_forecast",
      description:
        "Time series forecasting using ARIMA or Holt-Winters (triple exponential smoothing). Given historical numeric data, predicts future values with confidence bands. Use for demand forecasting, trend prediction, financial projections, or any sequential data extrapolation.",
      inputSchema: {
        type: "object" as const,
        properties: {
          data: {
            type: "array",
            items: { type: "number" },
            description: "Historical time series observations (minimum 2 for ARIMA, 2*seasonLength for Holt-Winters)",
          },
          steps: {
            type: "number",
            description: "Number of future steps to forecast",
          },
          method: {
            type: "string",
            enum: ["arima", "holt-winters"],
            description: "Forecasting method (default: arima)",
          },
          seasonLength: {
            type: "number",
            description: "Season length for Holt-Winters (e.g., 12 for monthly with yearly season). Required if method is holt-winters.",
          },
        },
        required: ["data", "steps"],
      },
    },
    {
      name: "detect_anomaly",
      description:
        "Anomaly detection in numeric data using Z-Score or IQR methods. Z-Score flags points exceeding a standard deviation threshold (parametric, assumes normality). IQR flags points outside interquartile fences (non-parametric, robust to skew). Use for fraud detection, quality control, sensor monitoring, or data cleaning.",
      inputSchema: {
        type: "object" as const,
        properties: {
          data: {
            type: "array",
            items: { type: "number" },
            description: "Numeric observations to scan for anomalies",
          },
          method: {
            type: "string",
            enum: ["zscore", "iqr"],
            description: "Detection method (default: zscore)",
          },
          threshold: {
            type: "number",
            description: "Z-score cutoff (default 3.0) or IQR multiplier (default 1.5)",
          },
        },
        required: ["data"],
      },
    },
    {
      name: "optimize_cmaes",
      description:
        "CMA-ES (Covariance Matrix Adaptation Evolution Strategy) for continuous black-box optimization. Finds the optimal solution vector that maximizes a weighted objective without gradients. Use for hyperparameter tuning, engineering design optimization, portfolio weight optimization, or any continuous optimization problem.",
      inputSchema: {
        type: "object" as const,
        properties: {
          dimension: {
            type: "number",
            description: "Dimensionality of the search space",
          },
          objectiveWeights: {
            type: "array",
            items: { type: "number" },
            description: "Weights for the objective function (fitness = weighted sum of variables)",
          },
          initialMean: {
            type: "array",
            items: { type: "number" },
            description: "Initial mean vector (default: zeros)",
          },
          initialSigma: {
            type: "number",
            description: "Initial step size (default: 0.5)",
          },
          maxIterations: {
            type: "number",
            description: "Maximum generations (default: 1000 * dimension, capped at 5000)",
          },
        },
        required: ["dimension", "objectiveWeights"],
      },
    },
    {
      name: "analyze_portfolio_risk",
      description:
        "Portfolio risk analysis computing Value-at-Risk (VaR) and Conditional VaR (Expected Shortfall) using the variance-covariance (delta-normal) method. Given portfolio weights and historical asset returns, quantifies potential losses at a given confidence level. Use for risk management, portfolio construction, regulatory capital, or stress testing.",
      inputSchema: {
        type: "object" as const,
        properties: {
          weights: {
            type: "array",
            items: { type: "number" },
            description: "Portfolio weights (should sum to ~1)",
          },
          returns: {
            type: "array",
            items: {
              type: "array",
              items: { type: "number" },
            },
            description: "Array of asset return series (one array per asset, all same length)",
          },
          confidence: {
            type: "number",
            description: "Confidence level, e.g. 0.95 or 0.99 (default: 0.95)",
          },
          horizonDays: {
            type: "number",
            description: "Risk horizon in trading days (default: 1)",
          },
        },
        required: ["weights", "returns"],
      },
    },
  ],
}));

// ── Tool Execution ─────────────────────────────────────

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "optimize_bandit": {
        const { arms, algorithm } = args as { arms: Array<{ id: string; name: string; pulls?: number; totalReward?: number }>; algorithm?: string };
        const bandit = createBandit();
        for (const arm of arms) {
          bandit.addArm(arm.id, arm.name);
          if (arm.pulls && arm.totalReward !== undefined) {
            for (let i = 0; i < arm.pulls; i++) {
              bandit.recordReward(arm.id, arm.totalReward / arm.pulls);
            }
          }
        }
        const sel = algorithm === "thompson" ? bandit.selectArmThompson() : algorithm === "epsilon-greedy" ? bandit.selectArmEpsilonGreedy() : bandit.selectArmUCB1();
        return { content: [{ type: "text", text: JSON.stringify({ selected: sel.arm.id, name: sel.arm.name, score: sel.score, algorithm: sel.algorithm, regret: bandit.calculateRegret() }, null, 2) }] };
      }

      case "optimize_contextual": {
        const { arms, context, history } = args as { arms: Array<{ id: string; name: string }>; context: number[]; history?: Array<{ armId: string; reward: number; context: number[] }> };
        const bandit = createContextualBandit({ dimensions: context.length });
        for (const arm of arms) bandit.addArm(arm.id, arm.name);
        if (history) for (const h of history) bandit.recordReward(h.armId, h.reward, h.context);
        const sel = bandit.selectArm(context);
        return { content: [{ type: "text", text: JSON.stringify({ selected: sel.arm.id, name: sel.arm.name, score: sel.score, expectedReward: sel.expectedReward, confidenceWidth: sel.confidenceWidth }, null, 2) }] };
      }

      case "solve_constraints": {
        const result = await solve(args as Parameters<typeof solve>[0]);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "solve_schedule": {
        const { tasks, slots } = args as { tasks: Parameters<typeof optimizeSchedule>[0]; slots: Parameters<typeof optimizeSchedule>[1] };
        const result = await optimizeSchedule(tasks, slots);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "analyze_decision_graph": {
        const { nodes, edges, sourceGoal, targetGoal } = args as { nodes: any[]; edges: any[]; sourceGoal?: string; targetGoal?: string };
        const graph = createDecisionGraph();
        for (const n of nodes) graph.addNode(n);
        for (const e of edges) graph.addEdge(e);
        const analysis = graph.analyze(sourceGoal, targetGoal);
        return { content: [{ type: "text", text: JSON.stringify(analysis, null, 2) }] };
      }

      case "score_convergence": {
        const { sources } = args as { sources: Parameters<typeof computeConvergence>[0] };
        const result = computeConvergence(sources);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "score_calibration": {
        const { predictions, outcomes } = args as { predictions: number[]; outcomes: number[] };
        return { content: [{ type: "text", text: JSON.stringify({ brier_score: brierScore(predictions, outcomes), log_score: logScore(predictions, outcomes), n: predictions.length }, null, 2) }] };
      }

      case "plan_pathfind": {
        const { nodes, edges, start: startNode, end, heuristic: hName, kPaths } = args as {
          nodes: Array<{ id: string; cost?: number; time?: number; risk?: number }>;
          edges: Array<{ from: string; to: string; cost?: number; time?: number; risk?: number }>;
          start: string;
          end: string;
          heuristic?: string;
          kPaths?: number;
        };

        const pathfinder = new AStarPathfinder();
        const graph = pathfinder.createGraph(true);

        for (const node of nodes) {
          const gn: GraphNode = {
            id: node.id,
            name: node.id,
            estimatedCost: node.cost,
            estimatedTime: node.time,
            riskFactor: node.risk,
          };
          pathfinder.addNode(graph, gn);
        }

        for (const edge of edges) {
          const ge: GraphEdge = {
            from: edge.from,
            to: edge.to,
            weight: edge.cost ?? edge.time ?? 1,
            timeCost: edge.time,
            monetaryCost: edge.cost,
            risk: edge.risk,
          };
          pathfinder.addEdge(graph, ge);
        }

        const heuristic = hName === "time" ? Heuristics.time
          : hName === "cost" ? Heuristics.cost
          : hName === "risk" ? Heuristics.risk
          : hName === "weighted" ? Heuristics.weighted(1, 1, 0.5)
          : Heuristics.zero;

        const result = pathfinder.findPath(graph, startNode, end, heuristic);

        const response: Record<string, unknown> = {
          path: result.path,
          totalCost: result.totalCost,
          breakdown: { time: result.costBreakdown.time, cost: result.costBreakdown.money, risk: result.costBreakdown.risk },
          found: result.found,
          nodesExplored: result.nodesExplored,
          executionTimeMs: result.executionTimeMs,
        };

        if (kPaths && kPaths > 1) {
          const kResults = pathfinder.findAlternativePaths(graph, startNode, end, kPaths, heuristic);
          response.alternativePaths = kResults.slice(1).map(r => ({ path: r.path, cost: r.totalCost }));
        }

        return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
      }

      case "predict_forecast": {
        const { data, steps, method, seasonLength } = args as {
          data: number[];
          steps: number;
          method?: "arima" | "holt-winters";
          seasonLength?: number;
        };
        const m = method ?? "arima";
        const result = m === "holt-winters"
          ? holtWinters(data, seasonLength ?? 4, steps)
          : forecast(data, steps);
        return { content: [{ type: "text", text: JSON.stringify({ forecast: result.forecast, confidence: result.confidence, model: result.model, method: m }, null, 2) }] };
      }

      case "detect_anomaly": {
        const { data, method, threshold } = args as {
          data: number[];
          method?: "zscore" | "iqr";
          threshold?: number;
        };
        const m = method ?? "zscore";
        if (m === "iqr") {
          const result = detectAnomaliesIQR(data, threshold ?? 1.5);
          return { content: [{ type: "text", text: JSON.stringify({ method: "iqr", anomalies: result.anomalies, q1: result.q1, q3: result.q3, iqr: result.iqr, lowerBound: result.lowerBound, upperBound: result.upperBound, count: result.anomalies.length }, null, 2) }] };
        }
        const result = detectAnomaliesZScore(data, threshold ?? 3.0);
        return { content: [{ type: "text", text: JSON.stringify({ method: "zscore", anomalies: result.anomalies, mean: result.mean, stdDev: result.stdDev, threshold: result.threshold, count: result.anomalies.length }, null, 2) }] };
      }

      case "optimize_cmaes": {
        const { dimension, objectiveWeights, initialMean, initialSigma, maxIterations } = args as {
          dimension: number;
          objectiveWeights: number[];
          initialMean?: number[];
          initialSigma?: number;
          maxIterations?: number;
        };
        const weights = objectiveWeights;
        const objectiveFn = (x: number[]): number => {
          let score = 0;
          for (let i = 0; i < x.length; i++) score += x[i]! * (weights[i] ?? 1);
          return -score; // CMA-ES minimises; negate for maximisation
        };
        const cfg: CMAESConfig = { dimension, initialMean, initialSigma: initialSigma ?? 0.5, maxIterations: Math.min(maxIterations ?? 1000, 5000) };
        const result = optimizeCMAES(objectiveFn, cfg);
        return { content: [{ type: "text", text: JSON.stringify({ bestSolution: result.bestSolution, bestFitness: -result.bestFitness, iterations: result.iterations, evaluations: result.evaluations, converged: result.converged, executionTimeMs: result.executionTimeMs }, null, 2) }] };
      }

      case "analyze_portfolio_risk": {
        const { weights, returns, confidence, horizonDays } = args as {
          weights: number[];
          returns: number[][];
          confidence?: number;
          horizonDays?: number;
        };
        const result = portfolioVaR(weights, returns, confidence ?? 0.95, horizonDays ?? 1);
        return { content: [{ type: "text", text: JSON.stringify({ var: result.var, cvar: result.cvar, expectedReturn: result.expectedReturn, volatility: result.volatility }, null, 2) }] };
      }

      default:
        return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };
    }
  } catch (error) {
    return { content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
  }
});

// ── Start Server ───────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("OraClaw MCP Server running — 12 tools, 19 algorithms");
}

main().catch(console.error);
