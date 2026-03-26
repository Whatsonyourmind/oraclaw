/**
 * @oraclaw/ensemble — Multi-Model Consensus SDK
 *
 * Thin API client. No algorithm source code is included.
 * All computation runs server-side on OraClaw's infrastructure.
 */

export interface ModelPrediction {
  modelId: string;
  prediction: number | number[] | Record<string, number>;
  confidence?: number;
  weight?: number;
  metadata?: Record<string, unknown>;
}

export interface EnsembleParams {
  /** Predictions from individual models */
  predictions: ModelPrediction[];
  /** Aggregation strategy */
  method?: "weighted-vote" | "stacking" | "bayesian-model-averaging" | "rank-average";
  /** Task type for method-specific behavior */
  taskType?: "classification" | "regression" | "ranking";
  /** Whether to optimize weights automatically */
  autoWeight?: boolean;
  /** Historical accuracy data for weight calibration */
  history?: Array<{
    modelId: string;
    predicted: number;
    actual: number;
  }>;
}

export interface EnsembleResult {
  consensus: number | number[] | Record<string, number>;
  confidence: number;
  agreement: number;
  weights: Record<string, number>;
  modelContributions: Array<{
    modelId: string;
    weight: number;
    deviation: number;
    influence: number;
  }>;
  method: string;
  diversityScore: number;
}

export interface OraEnsembleConfig {
  apiKey?: string;
  baseUrl?: string;
}

export class OraEnsemble {
  private apiKey: string;
  private baseUrl: string;

  constructor(config: OraEnsembleConfig = {}) {
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

  /** Combine predictions from multiple models into an optimal consensus */
  async combine(params: EnsembleParams): Promise<EnsembleResult> {
    return this.post("/api/v1/predict/ensemble", params);
  }
}

export default OraEnsemble;
