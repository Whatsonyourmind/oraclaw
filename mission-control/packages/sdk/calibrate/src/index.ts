/**
 * @oraclaw/calibrate — Prediction Quality & Forecast Scoring SDK
 *
 * Thin API client. No algorithm source code is included.
 * All computation runs server-side on OraClaw's infrastructure.
 */

export interface PredictionSource {
  id: string;
  name: string;
  probability: number;
  confidence?: number;
  volume?: number;
  lastUpdated: number;
}

export interface ConvergenceResult {
  score: number;
  components: { agreement: number; direction: number; uncertainty: number; freshness: number };
  details: {
    pairwiseDistances: Array<{ source1: string; source2: string; distance: number }>;
    outlierSources: string[];
    consensusProbability: number;
    spreadBps: number;
  };
}

export interface CalibrationResult {
  brier_score: number;
  log_score: number;
  n_predictions: number;
  mean_prediction: number;
  mean_outcome: number;
}

export interface OraCalibrateConfig {
  apiKey?: string;
  baseUrl?: string;
}

export class OraCalibrate {
  private apiKey: string;
  private baseUrl: string;

  constructor(config: OraCalibrateConfig = {}) {
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

  /** Score how much multiple prediction sources agree (Hellinger distance + entropy) */
  async convergence(sources: PredictionSource[]): Promise<ConvergenceResult> {
    return this.post("/api/v1/score/convergence", { sources });
  }

  /** Compute Brier score + log score for prediction accuracy */
  async calibration(predictions: number[], outcomes: number[]): Promise<CalibrationResult> {
    return this.post("/api/v1/score/calibration", { predictions, outcomes });
  }
}

export default OraCalibrate;
