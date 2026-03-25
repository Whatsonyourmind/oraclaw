/**
 * @oraclaw/forecast — Time Series Forecasting SDK
 * Thin API client. No algorithm source code is included.
 */

export interface ForecastResult {
  forecast: number[];
  confidence: { lower: number[]; upper: number[] };
  model: string;
}

export interface OraForecastConfig { apiKey?: string; baseUrl?: string }

export class OraForecast {
  private apiKey: string;
  private baseUrl: string;

  constructor(config: OraForecastConfig = {}) {
    this.apiKey = config.apiKey ?? process.env.ORACLAW_API_KEY ?? "";
    this.baseUrl = config.baseUrl ?? process.env.ORACLAW_API_URL ?? "https://api.oraclaw.dev";
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

  async forecast(data: number[], steps: number, method?: "arima" | "holt-winters", seasonLength?: number): Promise<ForecastResult> {
    return this.post("/api/v1/predict/forecast", { data, steps, method, seasonLength });
  }
}

export default OraForecast;
