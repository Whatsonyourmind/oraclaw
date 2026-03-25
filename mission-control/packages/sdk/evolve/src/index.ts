/**
 * @oraclaw/evolve — Genetic Algorithm Optimizer SDK
 *
 * Thin API client. No algorithm source code is included.
 * All computation runs server-side on OraClaw's infrastructure.
 */

export interface EvolveParams {
  /** Objective functions to optimize (supports multi-objective) */
  objectives: Array<{
    name: string;
    direction: "minimize" | "maximize";
    expression: string;
  }>;
  /** Decision variables with bounds */
  variables: Array<{
    name: string;
    min: number;
    max: number;
    type?: "continuous" | "integer" | "binary";
  }>;
  /** Optional constraints */
  constraints?: Array<{
    expression: string;
    type: "eq" | "leq" | "geq";
    value: number;
  }>;
  /** Population size per generation (default: 100) */
  populationSize?: number;
  /** Number of generations (default: 200) */
  generations?: number;
  /** Crossover rate (default: 0.8) */
  crossoverRate?: number;
  /** Mutation rate (default: 0.05) */
  mutationRate?: number;
}

export interface EvolveResult {
  bestSolution: Record<string, number>;
  bestFitness: number[];
  paretoFront: Array<{
    solution: Record<string, number>;
    fitness: number[];
    rank: number;
  }>;
  convergence: Array<{ generation: number; bestFitness: number }>;
  generations: number;
  evaluations: number;
}

export interface OraEvolveConfig {
  apiKey?: string;
  baseUrl?: string;
}

export class OraEvolve {
  private apiKey: string;
  private baseUrl: string;

  constructor(config: OraEvolveConfig = {}) {
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

  /** Optimize using Genetic Algorithm with multi-objective Pareto support */
  async optimize(params: EvolveParams): Promise<EvolveResult> {
    return this.post("/api/v1/optimize/evolve", params);
  }
}

export default OraEvolve;
