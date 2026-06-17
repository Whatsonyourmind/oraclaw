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
import { createHash } from "node:crypto";

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

/**
 * A re-checkable result certificate attached to every solve().
 *
 * The point: a caller (or an independent third party) can VERIFY the returned
 * answer without trusting the solver — recompute primal feasibility + the
 * objective from the returned solution, and (for pure LPs) check the KKT
 * optimality conditions from the solver's dual values. `verifyCertificate()`
 * does exactly this and returns false if the solution is tampered with.
 *
 * Honest scope (enforced by what HiGHS actually exposes):
 *  - Duality evidence is LP-ONLY. HiGHS exposes no dual values for MIP/binary
 *    models, so for those `duality` is omitted and optimality is attested by
 *    primal feasibility + integrality + objective recomputation + content hash.
 *  - For `infeasible`/`unbounded` this build of HiGHS (WASM) exposes no dual
 *    ray, so we cannot emit a Farkas/IIS witness; `certificateValid` is false
 *    and a note says the status is the solver's report, not independently
 *    certified. We deliberately do NOT call it a Farkas certificate.
 */
export interface SolveCertificate {
  schema: string; // SOLVE_CERTIFICATE_SCHEMA
  algoVersion: string;
  problemClass: "LP" | "MIP";
  status: "optimal" | "infeasible" | "unbounded" | "unknown";
  /** Absolute tolerance used for primal-feasibility / objective checks. */
  tolerance: number;
  /** True only when re-checkable evidence supports the reported `status`. */
  certificateValid: boolean;
  objectiveValue: number;
  /** c·x recomputed from the returned solution (null when no solution). */
  recomputedObjective: number | null;
  objectiveConsistent: boolean;
  primalFeasible: boolean;
  /** Worst constraint/bound violation (0 = feasible). */
  maxPrimalResidual: number;
  worstConstraint: string | null;
  /** MIP only: integrality of integer/binary variables. */
  integrality?: { integral: boolean; maxFractionalViolation: number };
  /** LP only: KKT optimality evidence from solver duals. */
  duality?: {
    complementarySlackness: number;
    stationarityResidual: number;
    /** LP primal-dual gap expressed via complementary slackness. */
    dualityGapCS: number;
    note: string;
  };
  /** sha256 over canonical {problem, status, objective, solution}. */
  contentHash: string;
  notes: string[];
}

export interface OptimizationResult {
  status: "optimal" | "infeasible" | "unbounded" | "error";
  objectiveValue: number;
  solution: Record<string, number>;
  dualValues?: Record<string, number>;
  /** Re-checkable optimality / feasibility certificate (see SolveCertificate). */
  certificate?: SolveCertificate;
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

// ── Result Certificate ─────────────────────────────────
//
// A solve() answer ships with a certificate that anyone can re-check WITHOUT
// the solver: recompute feasibility + objective from the returned solution,
// check the content hash binds those inputs→outputs, and (for LPs) verify the
// KKT optimality conditions from the solver's dual values. No public
// optimization MCP server returns a machine-checkable proof object today
// (MCP-Solver, arXiv:2501.00539, has an LLM "review" the solution instead).

export const SOLVE_CERTIFICATE_SCHEMA = "oraclaw.solve.certificate/v1";
const SOLVE_ALGO_VERSION = "constraintOptimizer/highs-wasm@1";

const PRIMAL_TOL = 1e-6; // constraint / variable-bound feasibility
const OBJ_ABS_TOL = 1e-6;
const OBJ_REL_TOL = 1e-6;
const DUAL_TOL = 1e-4; // complementary slackness / stationarity (dual precision)
const INT_TOL = 1e-6; // integrality
const HIGHS_INF = 1e29; // |bound| at/above this is treated as infinite

const isFiniteBound = (x: number): boolean => Number.isFinite(x) && Math.abs(x) < HIGHS_INF;

function effectiveBounds(v: OptimizationVariable): [number, number] {
  if (v.type === "binary") return [0, 1];
  return [v.lower ?? 0, v.upper ?? 1e30];
}

// Deterministic, float-stable canonical hash (sorted keys, fixed precision)
// so the same inputs/outputs always hash identically and any change flips it.
function canonicalize(value: unknown): unknown {
  if (typeof value === "number") return Number.isFinite(value) ? value.toFixed(12) : String(value);
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(value as Record<string, unknown>).sort()) {
      out[k] = canonicalize((value as Record<string, unknown>)[k]);
    }
    return out;
  }
  return value;
}

function solveContentHash(
  problem: OptimizationProblem,
  status: string,
  objectiveValue: number,
  solution: Record<string, number>,
): string {
  const payload = {
    schema: SOLVE_CERTIFICATE_SCHEMA,
    algoVersion: SOLVE_ALGO_VERSION,
    direction: problem.direction,
    objective: problem.objective,
    variables: problem.variables,
    constraints: problem.constraints,
    status,
    objectiveValue,
    solution,
  };
  return createHash("sha256").update(JSON.stringify(canonicalize(payload))).digest("hex");
}

/**
 * Independently re-check a candidate solution against the problem — no solver,
 * no dual values, zero trust. Recomputes every constraint LHS + variable bound
 * and the objective. This is the heart of the "re-checkable" guarantee.
 */
export function recheckSolve(
  problem: OptimizationProblem,
  solution: Record<string, number>,
): {
  feasible: boolean;
  maxResidual: number;
  worstConstraint: string | null;
  objective: number;
  perConstraint: Record<string, number>;
} {
  const x = (n: string): number => solution[n] ?? 0;
  let maxResidual = 0;
  let worst: string | null = null;
  const perConstraint: Record<string, number> = {};

  for (const c of problem.constraints) {
    let lhs = 0;
    for (const [n, coeff] of Object.entries(c.coefficients)) lhs += coeff * x(n);
    let r = 0;
    if (c.lower !== undefined) r = Math.max(r, c.lower - lhs);
    if (c.upper !== undefined) r = Math.max(r, lhs - c.upper);
    perConstraint[c.name] = r;
    if (r > maxResidual) {
      maxResidual = r;
      worst = c.name;
    }
  }

  for (const v of problem.variables) {
    const [lo, hi] = effectiveBounds(v);
    const xv = x(v.name);
    const r = Math.max(0, isFiniteBound(lo) ? lo - xv : 0, isFiniteBound(hi) ? xv - hi : 0);
    if (r > maxResidual) {
      maxResidual = r;
      worst = `var:${v.name}`;
    }
  }

  let objective = 0;
  for (const [n, coeff] of Object.entries(problem.objective)) objective += coeff * x(n);

  return { feasible: maxResidual <= PRIMAL_TOL, maxResidual, worstConstraint: worst, objective, perConstraint };
}

function integralityViolation(problem: OptimizationProblem, solution: Record<string, number>): number {
  let m = 0;
  for (const v of problem.variables) {
    if (v.type === "integer" || v.type === "binary") {
      const xv = solution[v.name] ?? 0;
      m = Math.max(m, Math.abs(xv - Math.round(xv)));
    }
  }
  return m;
}

interface RawDualRow {
  Name?: string;
  Dual?: number;
}

function computeLpDuality(
  problem: OptimizationProblem,
  solution: Record<string, number>,
  cols: Record<string, { Dual?: number }>,
  rows: RawDualRow[],
):
  | { dualsAvailable: false }
  | { dualsAvailable: true; complementarySlackness: number; stationarityResidual: number; dualityGapCS: number; note: string } {
  const x = (n: string): number => solution[n] ?? 0;

  // Reduced costs z_j (column duals).
  const z: Record<string, number> = {};
  let anyDual = false;
  for (const v of problem.variables) {
    const col = cols[v.name];
    if (col && typeof col.Dual === "number") {
      z[v.name] = col.Dual;
      anyDual = true;
    }
  }

  // Shadow prices y_i (row duals) — map by name, fall back to positional index.
  const rowByName: Record<string, RawDualRow> = {};
  for (const r of rows) if (r && typeof r.Name === "string") rowByName[r.Name] = r;
  const y = problem.constraints.map((c, i) => {
    const r = rowByName[c.name] ?? rows[i];
    if (r && typeof r.Dual === "number") {
      anyDual = true;
      return r.Dual;
    }
    return 0;
  });

  if (!anyDual) return { dualsAvailable: false };

  // Complementary slackness: a nonzero dual must pair with a binding primal.
  let cs = 0;
  for (const v of problem.variables) {
    const zj = z[v.name] ?? 0;
    if (zj === 0) continue;
    const [lo, hi] = effectiveBounds(v);
    const xv = x(v.name);
    const dists: number[] = [];
    if (isFiniteBound(lo)) dists.push(Math.abs(xv - lo));
    if (isFiniteBound(hi)) dists.push(Math.abs(xv - hi));
    if (dists.length) cs = Math.max(cs, Math.abs(zj) * Math.min(...dists));
  }
  problem.constraints.forEach((c, i) => {
    const yi = y[i] ?? 0;
    if (yi === 0) return;
    let lhs = 0;
    for (const [n, coeff] of Object.entries(c.coefficients)) lhs += coeff * x(n);
    const dists: number[] = [];
    if (c.lower !== undefined && isFiniteBound(c.lower)) dists.push(Math.abs(lhs - c.lower));
    if (c.upper !== undefined && isFiniteBound(c.upper)) dists.push(Math.abs(lhs - c.upper));
    if (dists.length) cs = Math.max(cs, Math.abs(yi) * Math.min(...dists));
  });

  // Stationarity (KKT gradient): c == Aᵀy + z, in the minimization sense.
  // Robust to the solver's single global dual-sign convention (test ±1).
  const cMin = (n: string): number => {
    const c = problem.objective[n] ?? 0;
    return problem.direction === "maximize" ? -c : c;
  };
  const resForSign = (s: number): number => {
    let m = 0;
    for (const v of problem.variables) {
      let aTy = 0;
      problem.constraints.forEach((c, i) => {
        const a = c.coefficients[v.name];
        if (a) aTy += a * (y[i] ?? 0);
      });
      m = Math.max(m, Math.abs(cMin(v.name) - s * (aTy + (z[v.name] ?? 0))));
    }
    return m;
  };
  const stationarityResidual = Math.min(resForSign(1), resForSign(-1));

  return {
    dualsAvailable: true,
    complementarySlackness: cs,
    stationarityResidual,
    dualityGapCS: cs,
    note: `LP primal-dual gap via complementary slackness; dual checks at tol ${DUAL_TOL}`,
  };
}

function buildSolveCertificate(
  problem: OptimizationProblem,
  rawResult: { Columns?: Record<string, { Dual?: number }>; Rows?: RawDualRow[] } | null,
  solution: Record<string, number>,
  status: OptimizationResult["status"],
  objectiveValue: number,
): SolveCertificate {
  const problemClass: "LP" | "MIP" =
    problem.variables.some((v) => v.type === "integer" || v.type === "binary") ? "MIP" : "LP";
  const certStatus: SolveCertificate["status"] =
    status === "optimal" || status === "infeasible" || status === "unbounded" ? status : "unknown";
  const notes: string[] = [];
  const contentHash = solveContentHash(problem, certStatus, objectiveValue, solution);

  const base = {
    schema: SOLVE_CERTIFICATE_SCHEMA,
    algoVersion: SOLVE_ALGO_VERSION,
    problemClass,
    status: certStatus,
    tolerance: PRIMAL_TOL,
    contentHash,
  };

  if (certStatus !== "optimal") {
    if (certStatus === "infeasible" || certStatus === "unbounded") {
      notes.push(
        `Solver reports '${certStatus}'. This build of HiGHS (WASM) exposes no dual ray, so no Farkas/IIS witness is available — this status is the solver's report and is NOT independently certified here.`,
      );
    } else {
      notes.push("Solver returned no optimal solution; no certificate evidence computed.");
    }
    return {
      ...base,
      certificateValid: false,
      objectiveValue,
      recomputedObjective: null,
      objectiveConsistent: false,
      primalFeasible: false,
      maxPrimalResidual: Number.POSITIVE_INFINITY,
      worstConstraint: null,
      notes,
    };
  }

  // optimal → re-check primal feasibility + objective from the returned solution.
  const recheck = recheckSolve(problem, solution);
  const objTol = Math.max(OBJ_ABS_TOL, OBJ_REL_TOL * Math.abs(objectiveValue));
  const objectiveConsistent = Math.abs(recheck.objective - objectiveValue) <= objTol;
  const primalFeasible = recheck.feasible;

  let integrality: SolveCertificate["integrality"];
  let duality: SolveCertificate["duality"];
  let optimalityOK = true;

  if (problemClass === "MIP") {
    const iv = integralityViolation(problem, solution);
    integrality = { integral: iv <= INT_TOL, maxFractionalViolation: iv };
    optimalityOK = integrality.integral;
    notes.push(
      "MIP: HiGHS exposes no LP duals for integer models — optimality is attested by primal feasibility + integrality + objective recomputation + content hash (no duality gap claimed).",
    );
  } else {
    const d = computeLpDuality(problem, solution, rawResult?.Columns ?? {}, rawResult?.Rows ?? []);
    if (d.dualsAvailable) {
      duality = {
        complementarySlackness: d.complementarySlackness,
        stationarityResidual: d.stationarityResidual,
        dualityGapCS: d.dualityGapCS,
        note: d.note,
      };
      optimalityOK = d.complementarySlackness <= DUAL_TOL && d.stationarityResidual <= DUAL_TOL;
      notes.push(
        `LP optimality evidence: complementary slackness ${d.complementarySlackness.toExponential(2)}, stationarity ${d.stationarityResidual.toExponential(2)} (dual tol ${DUAL_TOL}).`,
      );
    } else {
      notes.push(
        "LP solved but solver returned no dual values; optimality attested by primal feasibility + objective recomputation only.",
      );
    }
  }

  const certificateValid = primalFeasible && objectiveConsistent && optimalityOK;

  return {
    ...base,
    certificateValid,
    objectiveValue,
    recomputedObjective: recheck.objective,
    objectiveConsistent,
    primalFeasible,
    maxPrimalResidual: recheck.maxResidual,
    worstConstraint: recheck.worstConstraint,
    integrality,
    duality,
    notes,
  };
}

/**
 * Re-verify a certificate against a (possibly tampered) candidate solution,
 * independently of the solver. Returns { valid, reasons }. A perturbed
 * solution fails on primal feasibility, objective mismatch, and/or the content
 * hash binding — so the certificate genuinely catches a tampered answer.
 */
export function verifyCertificate(
  problem: OptimizationProblem,
  solution: Record<string, number>,
  certificate: SolveCertificate,
): { valid: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const r = recheckSolve(problem, solution);

  if (!r.feasible) {
    reasons.push(
      `primal infeasible: max residual ${r.maxResidual.toExponential(2)} at ${r.worstConstraint ?? "?"}`,
    );
  }
  const objTol = Math.max(OBJ_ABS_TOL, OBJ_REL_TOL * Math.abs(certificate.objectiveValue));
  if (Number.isFinite(certificate.objectiveValue) && Math.abs(r.objective - certificate.objectiveValue) > objTol) {
    reasons.push(`objective mismatch: recomputed ${r.objective} vs certified ${certificate.objectiveValue}`);
  }
  if (certificate.problemClass === "MIP") {
    const iv = integralityViolation(problem, solution);
    if (iv > INT_TOL) reasons.push(`integrality violated: max fractional ${iv.toExponential(2)}`);
  }
  const h = solveContentHash(problem, certificate.status, certificate.objectiveValue, solution);
  if (h !== certificate.contentHash) {
    reasons.push("content hash mismatch (solution does not match the certified inputs/outputs)");
  }

  return { valid: reasons.length === 0 && certificate.status === "optimal", reasons };
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
    const status = statusMap[result.Status as string] ?? "error";
    const objectiveValue = (result as { ObjectiveValue?: number }).ObjectiveValue ?? 0;

    const raw = result as unknown as {
      Columns?: Record<string, { Dual?: number }>;
      Rows?: RawDualRow[];
    };

    // Shadow prices by constraint name (LP only; absent for MIP/infeasible).
    const rows = Array.isArray(raw.Rows) ? raw.Rows : [];
    const rowByName: Record<string, RawDualRow> = {};
    for (const r of rows) if (r && typeof r.Name === "string") rowByName[r.Name] = r;
    const dualValues: Record<string, number> = {};
    problem.constraints.forEach((c, i) => {
      const r = rowByName[c.name] ?? rows[i];
      if (r && typeof r.Dual === "number") dualValues[c.name] = r.Dual;
    });

    const certificate = buildSolveCertificate(problem, raw, solution, status, objectiveValue);

    return {
      status,
      objectiveValue,
      solution,
      ...(Object.keys(dualValues).length > 0 ? { dualValues } : {}),
      certificate,
      solveTimeMs: Date.now() - start,
    };
  } catch (error) {
    const solution: Record<string, number> = {};
    return {
      status: "error",
      objectiveValue: 0,
      solution,
      certificate: buildSolveCertificate(problem, null, solution, "error", 0),
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
