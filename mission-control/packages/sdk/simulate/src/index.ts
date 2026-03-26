/**
 * @oraclaw/simulate — Monte Carlo Simulation SDK
 *
 * Thin API client. No algorithm source code is included.
 * All computation runs server-side on OraClaw's infrastructure.
 */

export interface SimulateParams {
  /** Number of simulation iterations (default: 10000) */
  iterations?: number;
  /** Distribution type for random sampling */
  distribution?: "normal" | "uniform" | "triangular" | "lognormal" | "beta";
  /** Input variables with their distribution parameters */
  variables: Array<{
    name: string;
    min?: number;
    max?: number;
    mean?: number;
    stdDev?: number;
    mode?: number;
  }>;
  /** Expression or model to evaluate per iteration */
  model: string;
  /** Confidence level for interval calculation (default: 0.95) */
  confidenceLevel?: number;
}

export interface SimulateResult {
  mean: number;
  median: number;
  stdDev: number;
  min: number;
  max: number;
  percentiles: Record<string, number>;
  confidenceInterval: { lower: number; upper: number; level: number };
  histogram: Array<{ bin: number; count: number }>;
  iterations: number;
}

export interface OraSimulateConfig {
  apiKey?: string;
  baseUrl?: string;
}

export class OraSimulate {
  private apiKey: string;
  private baseUrl: string;

  constructor(config: OraSimulateConfig = {}) {
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

  /** Run a Monte Carlo simulation with configurable distributions and iterations */
  async simulate(params: SimulateParams): Promise<SimulateResult> {
    return this.post("/api/v1/simulate/montecarlo", params);
  }
}

export default OraSimulate;
