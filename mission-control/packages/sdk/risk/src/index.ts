/**
 * @oraclaw/risk — Risk Assessment Engine SDK
 *
 * Thin API client. No algorithm source code is included.
 * All computation runs server-side on OraClaw's infrastructure.
 */

export interface RiskParams {
  /** Portfolio positions or risk factors */
  positions: Array<{
    asset: string;
    value: number;
    weight?: number;
    returns?: number[];
    volatility?: number;
  }>;
  /** Confidence level for VaR/CVaR (default: 0.95) */
  confidenceLevel?: number;
  /** Time horizon in days (default: 1) */
  horizon?: number;
  /** Number of Monte Carlo iterations (default: 10000) */
  iterations?: number;
  /** Stress test scenarios */
  stressScenarios?: Array<{
    name: string;
    shocks: Record<string, number>;
  }>;
  /** Correlation matrix between assets */
  correlations?: number[][];
}

export interface RiskResult {
  var: { value: number; confidence: number; horizon: number };
  cvar: { value: number; confidence: number };
  expectedLoss: number;
  worstCase: number;
  stressTests?: Array<{
    scenario: string;
    portfolioLoss: number;
    affectedPositions: Array<{ asset: string; loss: number }>;
  }>;
  riskFactors: Array<{
    factor: string;
    contribution: number;
    sensitivity: number;
  }>;
  diversificationBenefit: number;
}

export interface ConvergenceParams {
  /** Signals or predictions to score for convergence */
  signals: Array<{
    sourceId: string;
    value: number;
    confidence?: number;
    distribution?: number[];
  }>;
  /** Method for measuring agreement */
  method?: "hellinger" | "kl-divergence" | "wasserstein";
  /** Threshold for convergence (default: 0.7) */
  threshold?: number;
}

export interface ConvergenceResult {
  score: number;
  converged: boolean;
  pairwiseDistances: Array<{
    source1: string;
    source2: string;
    distance: number;
  }>;
  clusters: Array<{
    centroid: number;
    members: string[];
    internalAgreement: number;
  }>;
  outliers: string[];
  method: string;
}

export interface OraRiskConfig {
  apiKey?: string;
  baseUrl?: string;
}

export class OraRisk {
  private apiKey: string;
  private baseUrl: string;

  constructor(config: OraRiskConfig = {}) {
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

  /** Assess portfolio risk — VaR, CVaR, stress testing, and factor decomposition */
  async assessRisk(params: RiskParams): Promise<RiskResult> {
    return this.post("/api/v1/simulate/montecarlo", params);
  }

  /** Score convergence across multiple prediction signals */
  async scoreConvergence(params: ConvergenceParams): Promise<ConvergenceResult> {
    return this.post("/api/v1/score/convergence", params);
  }
}

export default OraRisk;
