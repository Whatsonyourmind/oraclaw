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
  if (!res.ok) throw new Error(`OraClaw API ${res.status}: ${await res.text()}`);
  return res.json();
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
  { name: "oraclaw", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

// ── Tool Definitions ──────────────────────────────────

const TOOLS = [
  {
    name: "optimize_bandit",
    description: "Multi-Armed Bandit (UCB1/Thompson/ε-Greedy). Select the best option from a set — optimal explore/exploit tradeoff. <1ms.",
    inputSchema: {
      type: "object" as const,
      properties: {
        arms: { type: "array", items: { type: "object" }, description: "Options: [{id, name, pulls, totalReward}]" },
        algorithm: { type: "string", enum: ["ucb1", "thompson", "epsilon-greedy"], description: "Algorithm (default: ucb1)" },
      },
      required: ["arms"],
    },
  },
  {
    name: "optimize_contextual",
    description: "Contextual Bandit (LinUCB). Context-aware selection — learns which option works best in which situation.",
    inputSchema: {
      type: "object" as const,
      properties: {
        arms: { type: "array", items: { type: "object" }, description: "[{id, name}]" },
        context: { type: "array", items: { type: "number" }, description: "Context feature vector" },
        history: { type: "array", items: { type: "object" }, description: "Past observations [{armId, reward, context}]" },
      },
      required: ["arms", "context"],
    },
  },
  {
    name: "optimize_cmaes",
    description: "CMA-ES continuous optimization. Tune parameters, calibrate models. 10-100x more efficient than grid search.",
    inputSchema: {
      type: "object" as const,
      properties: {
        dimension: { type: "number", description: "Number of parameters" },
        objectiveWeights: { type: "array", items: { type: "number" }, description: "Weight per dimension" },
        initialSigma: { type: "number", description: "Initial step size (default: 0.3)" },
        maxIterations: { type: "number", description: "Max iterations (default: 200)" },
      },
      required: ["dimension", "objectiveWeights"],
    },
  },
  {
    name: "solve_constraints",
    description: "LP/MIP/QP optimization (HiGHS). Budget allocation, scheduling, resource planning. Provably optimal.",
    inputSchema: {
      type: "object" as const,
      properties: {
        direction: { type: "string", enum: ["maximize", "minimize"] },
        objective: { type: "object", description: "Variable → coefficient" },
        variables: { type: "array", items: { type: "object" }, description: "[{name, lower?, upper?, type?}]" },
        constraints: { type: "array", items: { type: "object" }, description: "[{name, coefficients, upper?, lower?}]" },
      },
      required: ["direction", "objective", "variables", "constraints"],
    },
  },
  {
    name: "solve_schedule",
    description: "Optimal task scheduling with energy matching. Assigns tasks to time slots maximizing productivity.",
    inputSchema: {
      type: "object" as const,
      properties: {
        tasks: { type: "array", items: { type: "object" }, description: "[{id, name, duration, priority, energyRequired}]" },
        slots: { type: "array", items: { type: "object" }, description: "[{id, name, duration, energyLevel}]" },
      },
      required: ["tasks", "slots"],
    },
  },
  {
    name: "analyze_graph",
    description: "Graph analytics: PageRank, Louvain communities, shortest path, bottleneck detection.",
    inputSchema: {
      type: "object" as const,
      properties: {
        nodes: { type: "array", items: { type: "object" }, description: "[{id, type?, label?, ...}]" },
        edges: { type: "array", items: { type: "object" }, description: "[{source, target, type?, weight?}]" },
      },
      required: ["nodes", "edges"],
    },
  },
  {
    name: "analyze_risk",
    description: "Portfolio risk: VaR/CVaR with correlation matrices. Monte Carlo simulation.",
    inputSchema: {
      type: "object" as const,
      properties: {
        returns: { type: "array", items: { type: "array", items: { type: "number" } }, description: "Asset return series" },
        weights: { type: "array", items: { type: "number" }, description: "Portfolio weights" },
        confidence: { type: "number", description: "Confidence level (default: 0.95)" },
      },
      required: ["returns", "weights"],
    },
  },
  {
    name: "score_convergence",
    description: "Multi-source agreement scoring. How much do different signals/sources agree?",
    inputSchema: {
      type: "object" as const,
      properties: {
        distributions: { type: "array", items: { type: "object" }, description: "[{sourceId, values: number[]}]" },
      },
      required: ["distributions"],
    },
  },
  {
    name: "predict_forecast",
    description: "Time series forecasting (ARIMA / Holt-Winters). Predict future values with confidence intervals.",
    inputSchema: {
      type: "object" as const,
      properties: {
        data: { type: "array", items: { type: "number" }, description: "Historical values" },
        steps: { type: "number", description: "Steps to forecast" },
        method: { type: "string", enum: ["arima", "holt-winters"], description: "Method (default: arima)" },
      },
      required: ["data", "steps"],
    },
  },
  {
    name: "detect_anomaly",
    description: "Anomaly/outlier detection (Z-score / IQR). Sub-millisecond.",
    inputSchema: {
      type: "object" as const,
      properties: {
        data: { type: "array", items: { type: "number" }, description: "Numeric data" },
        method: { type: "string", enum: ["zscore", "iqr"], description: "Method (default: zscore)" },
        threshold: { type: "number", description: "Detection threshold (default: 3.0)" },
      },
      required: ["data"],
    },
  },
  {
    name: "plan_pathfind",
    description: "A* pathfinding with k-shortest paths (Yen's algorithm). Optimal routing.",
    inputSchema: {
      type: "object" as const,
      properties: {
        nodes: { type: "array", items: { type: "object" }, description: "[{id, x?, y?}]" },
        edges: { type: "array", items: { type: "object" }, description: "[{source, target, cost}]" },
        start: { type: "string", description: "Start node ID" },
        goal: { type: "string", description: "Goal node ID" },
        k: { type: "number", description: "Number of paths (default: 1)" },
      },
      required: ["nodes", "edges", "start", "goal"],
    },
  },
  {
    name: "simulate_montecarlo",
    description: "Monte Carlo simulation. 5K iterations in ~1ms. Risk quantification, scenario analysis.",
    inputSchema: {
      type: "object" as const,
      properties: {
        distribution: { type: "object", description: "{type: 'normal'|'uniform'|'triangular', params: number[]}" },
        iterations: { type: "number", description: "Number of iterations (default: 5000)" },
      },
      required: ["distribution"],
    },
  },
];

// ── Endpoint mapping ──────────────────────────────────

const ENDPOINTS: Record<string, string> = {
  optimize_bandit: "/api/v1/optimize/bandit",
  optimize_contextual: "/api/v1/optimize/contextual-bandit",
  optimize_cmaes: "/api/v1/optimize/cmaes",
  solve_constraints: "/api/v1/solve/constraints",
  solve_schedule: "/api/v1/solve/schedule",
  analyze_graph: "/api/v1/analyze/graph",
  analyze_risk: "/api/v1/analyze/risk",
  score_convergence: "/api/v1/score/convergence",
  predict_forecast: "/api/v1/predict/forecast",
  detect_anomaly: "/api/v1/detect/anomaly",
  plan_pathfind: "/api/v1/plan/pathfind",
  simulate_montecarlo: "/api/v1/simulate/montecarlo",
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
    const msg = err instanceof Error ? err.message : String(err);
    return { content: [{ type: "text", text: `Error: ${msg}` }], isError: true };
  }
});

// ── Start ─────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
