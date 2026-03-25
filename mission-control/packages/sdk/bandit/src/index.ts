/**
 * @oraclaw/bandit — A/B Testing & Feature Optimization SDK
 *
 * Thin API client. No algorithm source code is included.
 * All computation runs server-side on OraClaw's infrastructure.
 */

export interface Arm {
  id: string;
  name: string;
  pulls?: number;
  totalReward?: number;
}

export interface BanditResult {
  selected: { id: string; name: string };
  score: number;
  algorithm: "ucb1" | "thompson" | "epsilon-greedy";
  exploitation?: number;
  exploration?: number;
  regret: { cumulativeRegret: number; averageRegret: number; estimatedOptimalArm: string };
}

export interface ContextualResult {
  selected: { id: string; name: string };
  score: number;
  expectedReward: number;
  confidenceWidth: number;
  algorithm: "linucb";
}

export interface OraBanditConfig {
  apiKey?: string;
  baseUrl?: string;
}

export class OraBandit {
  private apiKey: string;
  private baseUrl: string;

  constructor(config: OraBanditConfig = {}) {
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

  /** Select the best option using Multi-Armed Bandit (UCB1/Thompson/ε-Greedy) */
  async optimize(arms: Arm[], algorithm?: "ucb1" | "thompson" | "epsilon-greedy"): Promise<BanditResult> {
    return this.post("/api/v1/optimize/bandit", { arms, algorithm });
  }

  /** Context-aware selection using LinUCB — learns which options work best in which situations */
  async optimizeContextual(
    arms: Array<{ id: string; name: string }>,
    context: number[],
    history?: Array<{ armId: string; reward: number; context: number[] }>,
  ): Promise<ContextualResult> {
    return this.post("/api/v1/optimize/contextual-bandit", { arms, context, history });
  }
}

export default OraBandit;
