/**
 * Constraint Optimizer — Production-grade LP/MIP/QP solver via HiGHS (WASM)
 * Solves scheduling, resource allocation, and multi-criteria optimization problems.
 *
 * Use cases in ORACLE:
 * - Optimal time allocation across competing priorities
 * - Resource scheduling with hard/soft constraints
 * - Multi-criteria decision optimization (maximize outcome given constraints)
 * - Workload balancing across team members
 */

import highs from "highs";

// ── Types ──────────────────────────────────────────────

export interface OptimizationVariable {
  name: string;
  lower?: number; // Default: 0
  upper?: number; // Default: Infinity
  type?: "continuous" | "integer" | "binary"; // Default: continuous
}

export interface Constraint {
  name: string;
  coefficients: Record<string, number>; // variable_name → coefficient
  lower?: number; // Lower bound (default: -Infinity)
  upper?: number; // Upper bound (default: Infinity)
}

export interface OptimizationProblem {
  direction: "minimize" | "maximize";
  objective: Record<string, number>; // variable_name → coefficient in objective
  variables: OptimizationVariable[];
  constraints: Constraint[];
}

export interface OptimizationResult {
  status: "optimal" | "infeasible" | "unbounded" | "error";
  objectiveValue: number;
  solution: Record<string, number>;
  dualValues?: Record<string, number>;
  solveTimeMs: number;
}

// ── Schedule Optimization ──────────────────────────────

export interface Task {
  id: string;
  name: string;
  durationMinutes: number;
  priority: number; // Higher = more important
  deadline?: number; // Unix timestamp
  energyRequired: "high" | "medium" | "low";
  category?: string;
}

export interface TimeSlot {
  id: string;
  startTime: number; // Unix timestamp
  durationMinutes: number;
  energyLevel: "high" | "medium" | "low";
}

export interface ScheduleResult {
  assignments: Array<{ taskId: string; slotId: string; score: number }>;
  unscheduled: string[];
  totalScore: number;
}

// ── Core Solver ────────────────────────────────────────

let solverInstance: Awaited<ReturnType<typeof highs>> | null = null;

async function getSolver() {
  if (!solverInstance) {
    solverInstance = await highs();
  }
  return solverInstance;
}

/**
 * Solve a general LP/MIP optimization problem.
 */
export async function solve(problem: OptimizationProblem): Promise<OptimizationResult> {
  const start = Date.now();

  try {
    const solver = await getSolver();

    // Build LP format string
    const lines: string[] = [];

    // Objective
    lines.push(problem.direction === "maximize" ? "Maximize" : "Minimize");
    const objTerms = Object.entries(problem.objective)
      .map(([name, coeff]) => `${coeff >= 0 ? "+" : ""}${coeff} ${name}`)
      .join(" ");
    lines.push(`  obj: ${objTerms}`);

    // Constraints
    lines.push("Subject To");
    for (const c of problem.constraints) {
      const terms = Object.entries(c.coefficients)
        .map(([name, coeff]) => `${coeff >= 0 ? "+" : ""}${coeff} ${name}`)
        .join(" ");

      if (c.lower !== undefined && c.upper !== undefined && c.lower === c.upper) {
        lines.push(`  ${c.name}: ${terms} = ${c.lower}`);
      } else if (c.upper !== undefined) {
        lines.push(`  ${c.name}: ${terms} <= ${c.upper}`);
      } else if (c.lower !== undefined) {
        lines.push(`  ${c.name}: ${terms} >= ${c.lower}`);
      }
    }

    // Bounds
    lines.push("Bounds");
    for (const v of problem.variables) {
      const lo = v.lower ?? 0;
      const hi = v.upper ?? 1e30;
      lines.push(`  ${lo} <= ${v.name} <= ${hi}`);
    }

    // Integer / Binary variables
    const integers = problem.variables.filter((v) => v.type === "integer");
    const binaries = problem.variables.filter((v) => v.type === "binary");
    if (integers.length > 0) {
      lines.push("General");
      lines.push(`  ${integers.map((v) => v.name).join(" ")}`);
    }
    if (binaries.length > 0) {
      lines.push("Binary");
      lines.push(`  ${binaries.map((v) => v.name).join(" ")}`);
    }

    lines.push("End");

    const lpString = lines.join("\n");
    const result = solver.solve(lpString);

    const solution: Record<string, number> = {};
    if (result.Columns) {
      for (const [name, col] of Object.entries(result.Columns)) {
        solution[name] = (col as { Primal: number }).Primal ?? 0;
      }
    }

    const statusMap: Record<string, OptimizationResult["status"]> = {
      Optimal: "optimal",
      Infeasible: "infeasible",
      Unbounded: "unbounded",
    };

    return {
      status: statusMap[result.Status as string] ?? "error",
      objectiveValue: (result as { ObjectiveValue?: number }).ObjectiveValue ?? 0,
      solution,
      solveTimeMs: Date.now() - start,
    };
  } catch (error) {
    return {
      status: "error",
      objectiveValue: 0,
      solution: {},
      solveTimeMs: Date.now() - start,
    };
  }
}

/**
 * Optimize task scheduling into time slots.
 * Maximizes: priority-weighted completion with energy matching.
 */
export async function optimizeSchedule(
  tasks: Task[],
  slots: TimeSlot[],
): Promise<ScheduleResult> {
  const energyMatch: Record<string, Record<string, number>> = {
    high: { high: 1.0, medium: 0.5, low: 0.2 },
    medium: { high: 0.8, medium: 1.0, low: 0.6 },
    low: { high: 0.4, medium: 0.7, low: 1.0 },
  };

  const variables: OptimizationVariable[] = [];
  const objective: Record<string, number> = {};
  const constraints: Constraint[] = [];

  // Sanitize IDs for LP format (no hyphens, spaces, or special chars)
  const sanitize = (s: string) => s.replace(/[^a-zA-Z0-9]/g, "");
  const taskIdMap = new Map(tasks.map((t) => [t.id, sanitize(t.id)]));
  const slotIdMap = new Map(slots.map((s) => [s.id, sanitize(s.id)]));

  // Binary variable x_i_j = 1 if task i assigned to slot j
  for (const task of tasks) {
    for (const slot of slots) {
      if (slot.durationMinutes >= task.durationMinutes) {
        const varName = `x${taskIdMap.get(task.id)}${slotIdMap.get(slot.id)}`;
        variables.push({ name: varName, type: "binary" });

        // Objective: priority × energy match
        const match = energyMatch[task.energyRequired]?.[slot.energyLevel] ?? 0.5;
        objective[varName] = task.priority * match;
      }
    }
  }

  // Each task assigned at most once
  for (const task of tasks) {
    const coefficients: Record<string, number> = {};
    for (const slot of slots) {
      const varName = `x${taskIdMap.get(task.id)}${slotIdMap.get(slot.id)}`;
      if (variables.some((v) => v.name === varName)) {
        coefficients[varName] = 1;
      }
    }
    if (Object.keys(coefficients).length > 0) {
      constraints.push({ name: `task${taskIdMap.get(task.id)}`, coefficients, upper: 1 });
    }
  }

  // Each slot used at most once
  for (const slot of slots) {
    const coefficients: Record<string, number> = {};
    for (const task of tasks) {
      const varName = `x${taskIdMap.get(task.id)}${slotIdMap.get(slot.id)}`;
      if (variables.some((v) => v.name === varName)) {
        coefficients[varName] = 1;
      }
    }
    if (Object.keys(coefficients).length > 0) {
      constraints.push({ name: `slot${slotIdMap.get(slot.id)}`, coefficients, upper: 1 });
    }
  }

  if (variables.length === 0) {
    return { assignments: [], unscheduled: tasks.map((t) => t.id), totalScore: 0 };
  }

  const result = await solve({
    direction: "maximize",
    objective,
    variables,
    constraints,
  });

  // Build reverse maps: sanitized → original ID
  const reverseTaskMap = new Map(tasks.map((t) => [sanitize(t.id), t.id]));
  const reverseSlotMap = new Map(slots.map((s) => [sanitize(s.id), s.id]));

  const assignments: Array<{ taskId: string; slotId: string; score: number }> = [];
  const scheduledTasks = new Set<string>();

  if (result.status === "optimal") {
    for (const [varName, value] of Object.entries(result.solution)) {
      if (value > 0.5 && varName.startsWith("x")) {
        // Find which task+slot this variable represents
        const suffix = varName.slice(1); // remove leading "x"
        for (const [sanTask, origTask] of reverseTaskMap) {
          if (suffix.startsWith(sanTask)) {
            const sanSlot = suffix.slice(sanTask.length);
            const origSlot = reverseSlotMap.get(sanSlot);
            if (origSlot) {
              scheduledTasks.add(origTask);
              assignments.push({
                taskId: origTask,
                slotId: origSlot,
                score: objective[varName] ?? 0,
              });
              break;
            }
          }
        }
      }
    }
  }

  const unscheduled = tasks.filter((t) => !scheduledTasks.has(t.id)).map((t) => t.id);

  return {
    assignments,
    unscheduled,
    totalScore: result.objectiveValue,
  };
}
