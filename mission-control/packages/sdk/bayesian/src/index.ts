/**
 * @oraclaw/bayesian — Bayesian Inference Engine SDK
 *
 * Thin API client. No algorithm source code is included.
 * All computation runs server-side on OraClaw's infrastructure.
 */

export interface BayesianParams {
  /** Prior probability distribution */
  prior: {
    distribution: "beta" | "normal" | "uniform" | "dirichlet";
    params: Record<string, number | number[]>;
  };
  /** Observed evidence / likelihood data */
  evidence: {
    successes?: number;
    failures?: number;
    observations?: number[];
    likelihood?: "binomial" | "normal" | "poisson";
  };
  /** Hypotheses to evaluate (for discrete Bayesian) */
  hypotheses?: Array<{
    name: string;
    priorProbability: number;
    likelihoodGivenEvidence: number;
  }>;
  /** Number of posterior samples (default: 10000) */
  samples?: number;
}

export interface BayesianResult {
  posterior: {
    distribution: string;
    params: Record<string, number | number[]>;
    mean: number;
    median: number;
    mode: number;
    credibleInterval: { lower: number; upper: number; level: number };
  };
  hypotheses?: Array<{
    name: string;
    posteriorProbability: number;
    bayesFactor: number;
  }>;
  bayesFactor?: number;
  informationGain: number;
  samples?: number;
}

export interface OraBayesianConfig {
  apiKey?: string;
  baseUrl?: string;
}

export class OraBayesian {
  private apiKey: string;
  private baseUrl: string;

  constructor(config: OraBayesianConfig = {}) {
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

  /** Run Bayesian inference — update prior beliefs with observed evidence */
  async infer(params: BayesianParams): Promise<BayesianResult> {
    return this.post("/api/v1/predict/bayesian", params);
  }
}

export default OraBayesian;
