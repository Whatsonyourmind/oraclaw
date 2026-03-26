/**
 * @oraclaw/cmaes — CMA-ES Continuous Optimization SDK
 * Thin API client. No algorithm source code is included.
 */

export interface CMAESResult {
  bestSolution: number[];
  bestFitness: number;
  iterations: number;
  evaluations: number;
  converged: boolean;
  executionTimeMs: number;
}

export interface OraCMAESConfig { apiKey?: string; baseUrl?: string }

export class OraCMAES {
  private apiKey: string;
  private baseUrl: string;

  constructor(config: OraCMAESConfig = {}) {
    this.apiKey = config.apiKey ?? process.env.ORACLAW_API_KEY ?? "";
    this.baseUrl = config.baseUrl ?? process.env.ORACLAW_API_URL ?? "https://vigilant-rotary-phone-97r5w6j6964pcp4gr-3001.app.github.dev";
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}) },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`OraClaw API error: ${res.status}`);
    return res.json() as Promise<T>;
  }

  async optimize(params: {
    dimension: number;
    initialMean?: number[];
    initialSigma?: number;
    maxIterations?: number;
    objectiveWeights: number[];
  }): Promise<CMAESResult> {
    return this.post("/api/v1/optimize/cmaes", params);
  }
}

export default OraCMAES;
