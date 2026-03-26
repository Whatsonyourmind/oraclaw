/**
 * @oraclaw/decide — Executive Decision Intelligence SDK
 *
 * Thin API client. No algorithm source code is included.
 * All computation runs server-side on OraClaw's infrastructure.
 */

export interface DecisionOption {
  id: string;
  name: string;
  pulls?: number;
  totalReward?: number;
}

export interface PredictionSource {
  id: string;
  name: string;
  probability: number;
  confidence?: number;
  volume?: number;
  lastUpdated: number;
}

export interface DecisionNode {
  id: string;
  type: "decision" | "signal" | "action" | "outcome" | "constraint" | "goal";
  label: string;
  urgency: "critical" | "high" | "medium" | "low";
  confidence: number;
  impact: number;
  timestamp: number;
}

export interface DecisionEdge {
  source: string;
  target: string;
  type: "depends_on" | "influences" | "blocks" | "enables" | "conflicts_with" | "supports";
  weight: number;
}

export interface OraDecideConfig {
  apiKey?: string;
  baseUrl?: string;
}

export class OraDecide {
  private apiKey: string;
  private baseUrl: string;

  constructor(config: OraDecideConfig = {}) {
    this.apiKey = config.apiKey ?? process.env.ORACLAW_API_KEY ?? "";
    this.baseUrl = config.baseUrl ?? process.env.ORACLAW_API_URL ?? "https://vigilant-rotary-phone-97r5w6j6964pcp4gr-3001.app.github.dev";
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

  /** Select the best option from a set of choices with historical performance data */
  async chooseBest(options: DecisionOption[], algorithm?: "ucb1" | "thompson"): Promise<unknown> {
    return this.post("/api/v1/optimize/bandit", { arms: options, algorithm });
  }

  /** Context-aware decision — learns which choices work best in which situations */
  async chooseForContext(
    options: Array<{ id: string; name: string }>,
    context: number[],
    history?: Array<{ armId: string; reward: number; context: number[] }>,
  ): Promise<unknown> {
    return this.post("/api/v1/optimize/contextual-bandit", { arms: options, context, history });
  }

  /** Analyze how your decisions connect and which ones matter most */
  async analyzeDecisionNetwork(
    nodes: DecisionNode[],
    edges: DecisionEdge[],
    sourceGoal?: string,
    targetGoal?: string,
  ): Promise<unknown> {
    return this.post("/api/v1/analyze/graph", { nodes, edges, sourceGoal, targetGoal });
  }

  /** Score how much your information sources agree (are you getting conflicting signals?) */
  async scoreConvergence(sources: PredictionSource[]): Promise<unknown> {
    return this.post("/api/v1/score/convergence", { sources });
  }
}

export default OraDecide;
