/**
 * @oraclaw/graph — Network Intelligence & Graph Analytics SDK
 *
 * Thin API client. No algorithm source code is included.
 * All computation runs server-side on OraClaw's infrastructure.
 */

export interface GraphNode {
  id: string;
  type: "decision" | "signal" | "action" | "outcome" | "constraint" | "goal";
  label: string;
  urgency: "critical" | "high" | "medium" | "low";
  confidence: number;
  impact: number;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: "depends_on" | "influences" | "blocks" | "enables" | "conflicts_with" | "supports";
  weight: number;
  metadata?: Record<string, unknown>;
}

export interface GraphAnalysis {
  pageRank: Record<string, number>;
  communities: Record<string, number>;
  criticalPath: string[];
  criticalPathWeight: number;
  bottlenecks: Array<{ id: string; score: number }>;
  clusters: Array<{ community: number; nodes: string[]; avgConfidence: number }>;
  totalNodes: number;
  totalEdges: number;
}

export interface OraGraphConfig {
  apiKey?: string;
  baseUrl?: string;
}

export class OraGraph {
  private apiKey: string;
  private baseUrl: string;

  constructor(config: OraGraphConfig = {}) {
    this.apiKey = config.apiKey ?? process.env.ORACLAW_API_KEY ?? "";
    this.baseUrl = config.baseUrl ?? process.env.ORACLAW_API_URL ?? "https://oraclaw-api.onrender.com";
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

  /** Full graph analysis: PageRank, communities, bottlenecks, critical path */
  async analyze(
    nodes: GraphNode[],
    edges: GraphEdge[],
    sourceGoal?: string,
    targetGoal?: string,
  ): Promise<GraphAnalysis> {
    return this.post("/api/v1/analyze/graph", { nodes, edges, sourceGoal, targetGoal });
  }
}

export default OraGraph;
