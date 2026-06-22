/**
 * Standalone, solver-free re-checker for a {@link SolveCertificate}.
 *
 * This module is deliberately INDEPENDENT of the producer: it imports neither
 * `highs` (no solver) nor `constraintOptimizer` (no producer logic). It only
 * uses `node:crypto` for the SHA-256 recompute. Everything it needs —
 * canonicalisation, primal/objective/integrality re-check, content-hash binding,
 * and the dual-bound re-derivation — is re-implemented here from scratch. The
 * point of a re-checkable certificate is that a third party who trusts NOTHING
 * about the server can run this one file against {problem, solution, certificate}
 * and get an honest verdict. `certVerifier.independence.test.ts` build-asserts the
 * no-forbidden-import property so the independence cannot silently regress.
 *
 * Soundness of the optimality check rests on weak duality. The verifier
 * RE-DERIVES the dual bound from the certificate's (untrusted) multipliers via
 * the same Lagrangian box-min the producer used. Because that box-min is a valid
 * lower bound for ANY non-negative multipliers, a recomputed bound can never
 * exceed the incumbent — so a forged "proven-optimal" claim is mathematically
 * impossible to sustain: either the claimed bound is not reproducible from the
 * multipliers, or the reproduced gap is positive. An exact-rational (BigInt
 * dyadic) path removes floating-point doubt from the bound-vs-incumbent sign.
 *
 * Honest scope (matches the producer): the bound is the ROOT LP relaxation, not
 * a branch-and-bound (VIPR) proof; `gap-bounded` brackets the optimum, it does
 * not declare the incumbent suboptimal. Infeasible/unbounded statuses are not
 * certified here (no Farkas/IIS witness — a documented fast-follow).
 */

import { createHash } from "node:crypto";

// ── Structural types (intentionally local — no producer import) ─────────────

export interface VOptimizationVariable {
  name: string;
  lower?: number;
  upper?: number;
  type?: "continuous" | "integer" | "binary";
}
export interface VConstraint {
  name: string;
  coefficients: Record<string, number>;
  lower?: number;
  upper?: number;
}
export interface VOptimizationProblem {
  direction: "minimize" | "maximize";
  objective: Record<string, number>;
  variables: VOptimizationVariable[];
  constraints: VConstraint[];
}
export interface VSolveCertificate {
  schema: string;
  algoVersion: string;
  problemClass: "LP" | "MIP";
  status: "optimal" | "infeasible" | "unbounded" | "unknown";
  objectiveValue: number;
  contentHash: string;
  optimality?: {
    optimalityClass: "proven-optimal" | "gap-bounded" | "feasible-no-bound";
    dualBound: number | null;
    optimalityGapAbs: number | null;
    optimalityGapRel: number | null;
    boundMethod: string;
    multipliers: Record<string, number>;
    note: string;
  };
}

// Tolerances mirror the producer's published contract.
const PRIMAL_TOL = 1e-6;
const OBJ_ABS_TOL = 1e-6;
const OBJ_REL_TOL = 1e-6;
const INT_TOL = 1e-6;
const GAP_ABS_TOL = 1e-6;
const GAP_REL_TOL = 1e-6;
const HIGHS_INF = 1e29;

const isFiniteBound = (x: number): boolean => Number.isFinite(x) && Math.abs(x) < HIGHS_INF;

function effectiveBounds(v: VOptimizationVariable): [number, number] {
  if (v.type === "binary") return [0, 1];
  return [v.lower ?? 0, v.upper ?? 1e30];
}

// ── Content-hash recompute (independent canonicalize) ───────────────────────

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

function recomputeContentHash(
  problem: VOptimizationProblem,
  cert: VSolveCertificate,
  solution: Record<string, number>,
): string {
  const payload = {
    schema: cert.schema,
    algoVersion: cert.algoVersion,
    direction: problem.direction,
    objective: problem.objective,
    variables: problem.variables,
    constraints: problem.constraints,
    status: cert.status,
    objectiveValue: cert.objectiveValue,
    solution,
  };
  return createHash("sha256").update(JSON.stringify(canonicalize(payload))).digest("hex");
}

// ── Primal / objective / integrality re-check ───────────────────────────────

function recheck(
  problem: VOptimizationProblem,
  solution: Record<string, number>,
): { feasible: boolean; maxResidual: number; worst: string | null; objective: number } {
  const x = (n: string): number => solution[n] ?? 0;
  let maxResidual = 0;
  let worst: string | null = null;

  for (const c of problem.constraints) {
    let lhs = 0;
    for (const [n, coeff] of Object.entries(c.coefficients)) lhs += coeff * x(n);
    let r = 0;
    if (c.lower !== undefined) r = Math.max(r, c.lower - lhs);
    if (c.upper !== undefined) r = Math.max(r, lhs - c.upper);
    if (r > maxResidual) { maxResidual = r; worst = c.name; }
  }
  for (const v of problem.variables) {
    const [lo, hi] = effectiveBounds(v);
    const xv = x(v.name);
    const r = Math.max(0, isFiniteBound(lo) ? lo - xv : 0, isFiniteBound(hi) ? xv - hi : 0);
    if (r > maxResidual) { maxResidual = r; worst = `var:${v.name}`; }
  }

  let objective = 0;
  for (const [n, coeff] of Object.entries(problem.objective)) objective += coeff * x(n);
  return { feasible: maxResidual <= PRIMAL_TOL, maxResidual, worst, objective };
}

function integralityViolation(problem: VOptimizationProblem, solution: Record<string, number>): number {
  let m = 0;
  for (const v of problem.variables) {
    if (v.type === "integer" || v.type === "binary") {
      const xv = solution[v.name] ?? 0;
      m = Math.max(m, Math.abs(xv - Math.round(xv)));
    }
  }
  return m;
}

// ── Dual bound re-derivation (float) ────────────────────────────────────────

function lagrangianBoundMin(
  cMin: Record<string, number>,
  variables: VOptimizationVariable[],
  constraints: VConstraint[],
  multipliers: Record<string, number>,
): number {
  const known = new Set(variables.map((v) => v.name));
  for (const n of Object.keys(cMin)) if (!known.has(n)) return Number.NEGATIVE_INFINITY;
  for (const c of constraints) for (const n of Object.keys(c.coefficients)) if (!known.has(n)) return Number.NEGATIVE_INFINITY;

  let best = Number.NEGATIVE_INFINITY;
  for (const s of [1, -1] as const) {
    let constTerm = 0;
    const g: Record<string, number> = {};
    for (const v of variables) g[v.name] = cMin[v.name] ?? 0;
    for (const c of constraints) {
      const w = s * (multipliers[c.name] ?? 0);
      const loFin = c.lower !== undefined && isFiniteBound(c.lower);
      const hiFin = c.upper !== undefined && isFiniteBound(c.upper);
      const mu = loFin ? Math.max(0, w) : 0;
      const nu = hiFin ? Math.max(0, -w) : 0;
      if (mu !== 0) constTerm += mu * (c.lower as number);
      if (nu !== 0) constTerm -= nu * (c.upper as number);
      const net = nu - mu;
      if (net !== 0) for (const [n, a] of Object.entries(c.coefficients)) g[n] = (g[n] ?? 0) + net * a;
    }
    let boxMin = 0;
    let finite = true;
    for (const v of variables) {
      const gj = g[v.name] ?? 0;
      const [lo, hi] = effectiveBounds(v);
      if (gj > 0) { if (isFiniteBound(lo)) boxMin += gj * lo; else { finite = false; break; } }
      else if (gj < 0) { if (isFiniteBound(hi)) boxMin += gj * hi; else { finite = false; break; } }
    }
    if (finite) best = Math.max(best, constTerm + boxMin);
  }
  return best;
}

// ── Exact-rational (BigInt dyadic) dual-bound re-derivation ──────────────────
//
// IEEE-754 doubles are exact dyadic rationals, so the entire Lagrangian box-min
// can be evaluated with zero rounding error. This removes float doubt from the
// "is the bound ≤ the incumbent" verdict that backs a proven-optimal claim.

type Rat = { n: bigint; d: bigint }; // invariant: d > 0, reduced

function rgcd(a: bigint, b: bigint): bigint {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b) { [a, b] = [b, a % b]; }
  return a || 1n;
}
function rat(n: bigint, d: bigint = 1n): Rat {
  if (d < 0n) { n = -n; d = -d; }
  const g = rgcd(n, d);
  return { n: n / g, d: d / g };
}
function ratFromFloat(x: number): Rat {
  if (!Number.isFinite(x)) throw new Error("ratFromFloat: non-finite");
  if (x === 0) return { n: 0n, d: 1n };
  const buf = new ArrayBuffer(8);
  const dv = new DataView(buf);
  dv.setFloat64(0, x);
  const bits = dv.getBigUint64(0);
  const sign = (bits >> 63n) & 1n;
  const exp = Number((bits >> 52n) & 0x7ffn);
  const mant = bits & 0xfffffffffffffn;
  let num: bigint;
  let den: bigint;
  if (exp === 0) {
    num = mant;
    den = 1n << 1074n; // subnormal: 2^-1074
  } else {
    num = mant | (1n << 52n); // implicit leading 1
    const e = exp - 1075; // 1075 = bias(1023) + mantissa(52)
    if (e >= 0) { num <<= BigInt(e); den = 1n; }
    else { den = 1n << BigInt(-e); }
  }
  if (sign) num = -num;
  return rat(num, den);
}
const rAdd = (a: Rat, b: Rat): Rat => rat(a.n * b.d + b.n * a.d, a.d * b.d);
const rSub = (a: Rat, b: Rat): Rat => rat(a.n * b.d - b.n * a.d, a.d * b.d);
const rMul = (a: Rat, b: Rat): Rat => rat(a.n * b.n, a.d * b.d);
const rCmp = (a: Rat, b: Rat): number => {
  const l = a.n * b.d;
  const r = b.n * a.d;
  return l < r ? -1 : l > r ? 1 : 0;
};

/** Exact Lagrangian min-space bound; null when unbounded in the relaxed direction. */
function lagrangianBoundMinExact(
  cMin: Record<string, number>,
  variables: VOptimizationVariable[],
  constraints: VConstraint[],
  multipliers: Record<string, number>,
): Rat | null {
  const known = new Set(variables.map((v) => v.name));
  for (const n of Object.keys(cMin)) if (!known.has(n)) return null;
  for (const c of constraints) for (const n of Object.keys(c.coefficients)) if (!known.has(n)) return null;

  const ZERO: Rat = { n: 0n, d: 1n };
  let best: Rat | null = null;
  for (const s of [1, -1] as const) {
    let constTerm: Rat = ZERO;
    const g: Record<string, Rat> = {};
    for (const v of variables) g[v.name] = ratFromFloat(cMin[v.name] ?? 0);
    for (const c of constraints) {
      const w = rMul(rat(BigInt(s)), ratFromFloat(multipliers[c.name] ?? 0));
      const loFin = c.lower !== undefined && isFiniteBound(c.lower);
      const hiFin = c.upper !== undefined && isFiniteBound(c.upper);
      const mu = loFin ? (rCmp(w, ZERO) > 0 ? w : ZERO) : ZERO;
      const nu = hiFin ? (rCmp(w, ZERO) < 0 ? rMul(rat(-1n), w) : ZERO) : ZERO;
      if (rCmp(mu, ZERO) !== 0) constTerm = rAdd(constTerm, rMul(mu, ratFromFloat(c.lower as number)));
      if (rCmp(nu, ZERO) !== 0) constTerm = rSub(constTerm, rMul(nu, ratFromFloat(c.upper as number)));
      const net = rSub(nu, mu);
      if (rCmp(net, ZERO) !== 0) {
        for (const [n, a] of Object.entries(c.coefficients)) {
          g[n] = rAdd(g[n] ?? ZERO, rMul(net, ratFromFloat(a)));
        }
      }
    }
    let boxMin: Rat = ZERO;
    let finite = true;
    for (const v of variables) {
      const gj = g[v.name] ?? ZERO;
      const cmp = rCmp(gj, ZERO);
      const [lo, hi] = effectiveBounds(v);
      if (cmp > 0) {
        if (isFiniteBound(lo)) boxMin = rAdd(boxMin, rMul(gj, ratFromFloat(lo)));
        else { finite = false; break; }
      } else if (cmp < 0) {
        if (isFiniteBound(hi)) boxMin = rAdd(boxMin, rMul(gj, ratFromFloat(hi)));
        else { finite = false; break; }
      }
    }
    if (finite) {
      const total = rAdd(constTerm, boxMin);
      if (best === null || rCmp(total, best) > 0) best = total;
    }
  }
  return best;
}

// ── Public verifier ─────────────────────────────────────────────────────────

export interface VerifyOptions {
  /** Re-derive the dual bound in exact BigInt rationals (default true). */
  exact?: boolean;
}

export interface VerifyResult {
  valid: boolean;
  reasons: string[];
  recomputed: {
    feasible: boolean;
    maxResidual: number;
    objective: number;
    integralityViolation: number | null;
    contentHashMatches: boolean;
    dualBound: number | null;
    optimalityGapAbs: number | null;
    optimalityClass: "proven-optimal" | "gap-bounded" | "feasible-no-bound" | "n/a";
    /** Exact sign of (incumbent − bound) in min-space: 1 valid-strict, 0 tight, −1 INVALID. */
    boundExactSign: -1 | 0 | 1 | null;
  };
}

/**
 * Re-check a solve certificate against a candidate solution with no solver and
 * no trust in the producer. Returns a verdict plus everything it recomputed.
 */
export function verifySolveCertificate(
  problem: VOptimizationProblem,
  solution: Record<string, number>,
  cert: VSolveCertificate,
  opts: VerifyOptions = {},
): VerifyResult {
  const exact = opts.exact ?? true;
  const reasons: string[] = [];

  // 1. Primal feasibility + objective.
  const rc = recheck(problem, solution);
  if (!rc.feasible) {
    reasons.push(`primal infeasible: max residual ${rc.maxResidual.toExponential(2)} at ${rc.worst ?? "?"}`);
  }
  const objTol = Math.max(OBJ_ABS_TOL, OBJ_REL_TOL * Math.abs(cert.objectiveValue));
  if (Number.isFinite(cert.objectiveValue) && Math.abs(rc.objective - cert.objectiveValue) > objTol) {
    reasons.push(`objective mismatch: recomputed ${rc.objective} vs certified ${cert.objectiveValue}`);
  }

  // 2. Integrality (MIP).
  let iv: number | null = null;
  if (cert.problemClass === "MIP") {
    iv = integralityViolation(problem, solution);
    if (iv > INT_TOL) reasons.push(`integrality violated: max fractional ${iv.toExponential(2)}`);
  }

  // 3. Content-hash binding.
  const hashMatches = recomputeContentHash(problem, cert, solution) === cert.contentHash;
  if (!hashMatches) {
    reasons.push("content hash mismatch (solution does not match the certified inputs/outputs)");
  }

  // 4. Optimality re-derivation (only when the producer claims it).
  let recomputedClass: VerifyResult["recomputed"]["optimalityClass"] = "n/a";
  let recomputedBound: number | null = null;
  let recomputedGap: number | null = null;
  let boundExactSign: -1 | 0 | 1 | null = null;

  if (cert.optimality) {
    const o = cert.optimality;
    const cMin: Record<string, number> = {};
    for (const [n, c] of Object.entries(problem.objective)) cMin[n] = problem.direction === "maximize" ? -c : c;
    const zmin = problem.direction === "maximize" ? -cert.objectiveValue : cert.objectiveValue;

    let boundMin = lagrangianBoundMin(cMin, problem.variables, problem.constraints, o.multipliers);
    const finite = Number.isFinite(boundMin);
    const tol = Math.max(GAP_ABS_TOL, GAP_REL_TOL * Math.abs(zmin));

    // A valid lower bound can never exceed a feasible incumbent (weak duality);
    // a recomputed bound above the incumbent proves the incumbent is not
    // relaxation-feasible → the optimality claim is invalid. Float detects it;
    // the exact-rational path settles it with zero rounding doubt.
    let overBound = finite && boundMin > zmin + tol;
    if (exact && finite) {
      const be = lagrangianBoundMinExact(cMin, problem.variables, problem.constraints, o.multipliers);
      if (be !== null) {
        boundExactSign = rCmp(ratFromFloat(zmin), be) as -1 | 0 | 1;
        if (boundExactSign < 0) overBound = true;
      }
    }

    if (overBound) {
      reasons.push(
        `dual bound exceeds incumbent (invalid bound — incumbent not relaxation-feasible${exact ? "; exact-rational re-check" : ""})`,
      );
      recomputedClass = "feasible-no-bound";
    } else {
      // Clamp float overshoot exactly as the producer documents.
      if (finite && boundMin > zmin) boundMin = zmin;
      recomputedBound = finite ? (problem.direction === "maximize" ? -boundMin : boundMin) : null;
      recomputedGap = finite ? Math.max(0, zmin - boundMin) : null;
      recomputedClass = !finite ? "feasible-no-bound" : (recomputedGap as number) <= tol ? "proven-optimal" : "gap-bounded";

      // 4a. Claimed bound must be reproducible from the (untrusted) multipliers.
      if (o.dualBound !== null && recomputedBound !== null) {
        const bTol = Math.max(1e-6, 1e-6 * Math.abs(recomputedBound));
        if (Math.abs(o.dualBound - recomputedBound) > bTol) {
          reasons.push(
            `claimed dual bound ${o.dualBound} not reproducible from multipliers (recomputed ${recomputedBound})`,
          );
        }
      } else if (o.dualBound !== null && recomputedBound === null) {
        reasons.push("claimed a finite dual bound but multipliers yield no finite bound");
      }

      // 4b. A "proven-optimal" claim must be justified by the recomputed gap.
      if (o.optimalityClass === "proven-optimal" && recomputedClass !== "proven-optimal") {
        reasons.push(
          `claims proven-optimal but recomputed gap ${recomputedGap === null ? "∞" : (recomputedGap as number).toExponential(2)} > tolerance`,
        );
      }
    }
  }

  return {
    valid: reasons.length === 0 && cert.status === "optimal",
    reasons,
    recomputed: {
      feasible: rc.feasible,
      maxResidual: rc.maxResidual,
      objective: rc.objective,
      integralityViolation: iv,
      contentHashMatches: hashMatches,
      dualBound: recomputedBound,
      optimalityGapAbs: recomputedGap,
      optimalityClass: recomputedClass,
      boundExactSign,
    },
  };
}
