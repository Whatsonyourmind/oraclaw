/**
 * @oraclaw/solver — AI Scheduling & Resource Optimization SDK
 *
 * Thin API client. No algorithm source code is included.
 * All computation runs server-side on OraClaw's infrastructure.
 */

export interface Task {
  id: string;
  name: string;
  durationMinutes: number;
  priority: number;
  deadline?: number;
  energyRequired: "high" | "medium" | "low";
  category?: string;
}

export interface TimeSlot {
  id: string;
  startTime: number;
  durationMinutes: number;
  energyLevel: "high" | "medium" | "low";
}

export interface ScheduleResult {
  assignments: Array<{ taskId: string; slotId: string; score: number }>;
  unscheduled: string[];
  totalScore: number;
}

export interface Variable {
  name: string;
  lower?: number;
  upper?: number;
  type?: "continuous" | "integer" | "binary";
}

export interface Constraint {
  name: string;
  coefficients: Record<string, number>;
  lower?: number;
  upper?: number;
}

export interface OptimizationResult {
  status: "optimal" | "infeasible" | "unbounded" | "error";
  objectiveValue: number;
  solution: Record<string, number>;
  solveTimeMs: number;
}

export interface OraSolverConfig {
  apiKey?: string;
  baseUrl?: string;
}

export class OraSolver {
  private apiKey: string;
  private baseUrl: string;

  constructor(config: OraSolverConfig = {}) {
    this.apiKey = config.apiKey ?? process.env.ORACLAW_API_KEY ?? "";
    this.baseUrl = config.baseUrl ?? process.env.ORACLAW_API_URL ?? "https://vigilant-rotary-phone-97r5w6j6964pcp4gr-3001.app.github.dev";
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

  /** Optimize task scheduling into time slots, matching energy and priority */
  async schedule(tasks: Task[], slots: TimeSlot[]): Promise<ScheduleResult> {
    return this.post("/api/v1/solve/schedule", { tasks, slots });
  }

  /** Solve any LP/MIP/QP optimization problem with constraints */
  async optimize(problem: {
    direction: "minimize" | "maximize";
    objective: Record<string, number>;
    variables: Variable[];
    constraints: Constraint[];
  }): Promise<OptimizationResult> {
    return this.post("/api/v1/solve/constraints", problem);
  }
}

export default OraSolver;
