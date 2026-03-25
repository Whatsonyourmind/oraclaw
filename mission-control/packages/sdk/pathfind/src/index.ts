/**
 * @oraclaw/pathfind — A* Pathfinding SDK
 *
 * Thin API client. No algorithm source code is included.
 * All computation runs server-side on OraClaw's infrastructure.
 */

export interface PathNode {
  id: string;
  name: string;
  cost?: number;
  time?: number;
  risk?: number;
  metadata?: Record<string, unknown>;
}

export interface PathEdge {
  from: string;
  to: string;
  weight?: number;
  type?: "dependency" | "optional" | "parallel";
}

export interface PathfindParams {
  /** Nodes in the workflow graph */
  nodes: PathNode[];
  /** Edges connecting nodes */
  edges: PathEdge[];
  /** Start node ID */
  start: string;
  /** Goal node ID */
  goal: string;
  /** Optimization target */
  optimizeFor?: "cost" | "time" | "risk" | "balanced";
  /** Number of alternative paths to return (default: 1) */
  kPaths?: number;
  /** Heuristic function type */
  heuristic?: "manhattan" | "euclidean" | "zero";
  /** Constraints on the path */
  constraints?: {
    maxCost?: number;
    maxTime?: number;
    maxRisk?: number;
    requiredNodes?: string[];
    excludedNodes?: string[];
  };
}

export interface PathfindResult {
  optimalPath: {
    nodes: string[];
    totalCost: number;
    totalTime: number;
    totalRisk: number;
    steps: Array<{
      from: string;
      to: string;
      cost: number;
      time: number;
      risk: number;
    }>;
  };
  alternativePaths?: Array<{
    nodes: string[];
    totalCost: number;
    totalTime: number;
    totalRisk: number;
  }>;
  criticalPath: string[];
  bottlenecks: Array<{
    nodeId: string;
    impact: number;
    reason: string;
  }>;
  nodesExplored: number;
}

export interface OraPathfindConfig {
  apiKey?: string;
  baseUrl?: string;
}

export class OraPathfind {
  private apiKey: string;
  private baseUrl: string;

  constructor(config: OraPathfindConfig = {}) {
    this.apiKey = config.apiKey ?? process.env.ORACLAW_API_KEY ?? "";
    this.baseUrl = config.baseUrl ?? process.env.ORACLAW_API_URL ?? "https://api.oraclaw.dev";
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`OraClaw API error: ${res.status} ${res.statusText}`);
    return res.json() as Promise<T>;
  }

  /** Find the optimal path through a workflow graph using A* with cost/time/risk breakdown */
  async findPath(params: PathfindParams): Promise<PathfindResult> {
    return this.post("/api/v1/plan/pathfind", params);
  }
}

export default OraPathfind;
