/**
 * @oraclaw/anomaly — Anomaly Detection SDK
 * Thin API client. No algorithm source code is included.
 */

export interface AnomalyResult {
  anomalies: Array<{ index: number; value: number; zScore?: number }>;
  mean: number;
  stdDev: number;
  threshold: number;
  method: string;
}

export interface OraAnomalyConfig { apiKey?: string; baseUrl?: string }

export class OraAnomaly {
  private apiKey: string;
  private baseUrl: string;

  constructor(config: OraAnomalyConfig = {}) {
    this.apiKey = config.apiKey ?? process.env.ORACLAW_API_KEY ?? "";
    this.baseUrl = config.baseUrl ?? process.env.ORACLAW_API_URL ?? "https://oraclaw-api.onrender.com";
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

  async detect(data: number[], method?: "zscore" | "iqr", threshold?: number): Promise<AnomalyResult> {
    return this.post("/api/v1/detect/anomaly", { data, method, threshold });
  }
}

export default OraAnomaly;
