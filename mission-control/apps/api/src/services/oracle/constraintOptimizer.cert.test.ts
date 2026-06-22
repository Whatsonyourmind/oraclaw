/**
 * Result-certificate tests for the HiGHS LP/MIP solver.
 *
 * The certificate is a re-checkable proof object: a third party can verify the
 * returned answer WITHOUT trusting the solver, and a tampered solution must be
 * rejected. These tests prove exactly that.
 */

import { describe, it, expect } from "vitest";
import {
  solve,
  recheckSolve,
  verifyCertificate,
  SOLVE_CERTIFICATE_SCHEMA,
  type OptimizationProblem,
} from "./algorithms/constraintOptimizer";

describe("solve() result certificate — LP", () => {
  // maximize 3x + 2y  s.t.  x + y <= 4,  x <= 2,  x,y >= 0
  // unique optimum: x=2, y=2, objective = 10
  const lp: OptimizationProblem = {
    direction: "maximize",
    objective: { x: 3, y: 2 },
    variables: [
      { name: "x", lower: 0 },
      { name: "y", lower: 0 },
    ],
    constraints: [
      { name: "cap", coefficients: { x: 1, y: 1 }, upper: 4 },
      { name: "xcap", coefficients: { x: 1 }, upper: 2 },
    ],
  };

  it("solves to the known optimum and emits a valid certificate", async () => {
    const res = await solve(lp);
    expect(res.status).toBe("optimal");
    expect(res.objectiveValue).toBeCloseTo(10, 6);
    expect(res.solution.x).toBeCloseTo(2, 6);
    expect(res.solution.y).toBeCloseTo(2, 6);

    const cert = res.certificate!;
    expect(cert).toBeDefined();
    expect(cert.schema).toBe(SOLVE_CERTIFICATE_SCHEMA);
    expect(cert.problemClass).toBe("LP");
    expect(cert.status).toBe("optimal");
    expect(cert.certificateValid).toBe(true);
    expect(cert.primalFeasible).toBe(true);
    expect(cert.objectiveConsistent).toBe(true);
    expect(cert.recomputedObjective).toBeCloseTo(10, 6);
    expect(cert.maxPrimalResidual).toBeLessThanOrEqual(cert.tolerance);
    expect(cert.contentHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("ships LP duality evidence with a small duality gap", async () => {
    const res = await solve(lp);
    const cert = res.certificate!;
    expect(cert.duality).toBeDefined();
    expect(cert.duality!.dualityGapCS).toBeLessThanOrEqual(1e-4);
    expect(cert.duality!.complementarySlackness).toBeLessThanOrEqual(1e-4);
    expect(cert.duality!.stationarityResidual).toBeLessThanOrEqual(1e-4);
  });

  it("verifies the honest solution and REJECTS a tampered one (the whole point)", async () => {
    const res = await solve(lp);
    const cert = res.certificate!;

    const honest = verifyCertificate(lp, res.solution, cert);
    expect(honest.valid).toBe(true);
    expect(honest.reasons).toHaveLength(0);

    // Tamper: push x past its x<=2 cap. The re-checker must flip to invalid.
    const tampered = { ...res.solution, x: res.solution.x + 2 };
    const bad = verifyCertificate(lp, tampered, cert);
    expect(bad.valid).toBe(false);
    expect(bad.reasons.length).toBeGreaterThan(0);

    // Independent feasibility re-check also catches it (no solver involved).
    expect(recheckSolve(lp, tampered).feasible).toBe(false);
  });

  it("content hash is deterministic across solves and binds the solution", async () => {
    const a = await solve(lp);
    const b = await solve(lp);
    expect(a.certificate!.contentHash).toBe(b.certificate!.contentHash);
    // A different (here: tampered) solution would not match this hash.
    const bad = verifyCertificate(lp, { ...a.solution, y: a.solution.y + 1 }, a.certificate!);
    expect(bad.reasons).toContain(
      "content hash mismatch (solution does not match the certified inputs/outputs)",
    );
  });
});

describe("solve() result certificate — MIP", () => {
  // maximize x + y  s.t.  x + y <= 1,  x,y binary  ->  optimum = 1
  const mip: OptimizationProblem = {
    direction: "maximize",
    objective: { x: 1, y: 1 },
    variables: [
      { name: "x", type: "binary" },
      { name: "y", type: "binary" },
    ],
    constraints: [{ name: "pickone", coefficients: { x: 1, y: 1 }, upper: 1 }],
  };

  it("attests MIP optimality via feasibility + integrality, NOT duality", async () => {
    const res = await solve(mip);
    expect(res.status).toBe("optimal");
    expect(res.objectiveValue).toBeCloseTo(1, 6);

    const cert = res.certificate!;
    expect(cert.problemClass).toBe("MIP");
    expect(cert.duality).toBeUndefined(); // HiGHS exposes no duals for MIP — honest
    expect(cert.integrality).toBeDefined();
    expect(cert.integrality!.integral).toBe(true);
    expect(cert.certificateValid).toBe(true);
    expect(verifyCertificate(mip, res.solution, cert).valid).toBe(true);
  });

  it("rejects a fractional (non-integral) tampered MIP solution", async () => {
    const res = await solve(mip);
    const cert = res.certificate!;
    const fractional = { x: 0.5, y: 0.5 };
    const bad = verifyCertificate(mip, fractional, cert);
    expect(bad.valid).toBe(false);
    expect(bad.reasons.some((r) => r.includes("integrality") || r.includes("hash"))).toBe(true);
  });
});

describe("solve() result certificate — root dual-bound optimality", () => {
  it("LP attaches a proven-optimal root bound that meets the objective", async () => {
    const lp: OptimizationProblem = {
      direction: "maximize",
      objective: { x: 3, y: 2 },
      variables: [{ name: "x", lower: 0 }, { name: "y", lower: 0 }],
      constraints: [
        { name: "cap", coefficients: { x: 1, y: 1 }, upper: 4 },
        { name: "xcap", coefficients: { x: 1 }, upper: 2 },
      ],
    };
    const res = await solve(lp);
    const o = res.certificate!.optimality!;
    expect(o).toBeDefined();
    expect(o.optimalityClass).toBe("proven-optimal");
    expect(o.dualBound).toBeCloseTo(10, 6);
    expect(o.optimalityGapAbs).toBeCloseTo(0, 6);
    expect(o.boundMethod).toMatch(/Lagrangian/);
  });

  it("a MIP with an integrality gap is reported gap-bounded, NOT proven-optimal", async () => {
    // max x+y s.t. 2x+2y<=3, x,y binary -> integer optimum 1, root relaxation 1.5
    const mip: OptimizationProblem = {
      direction: "maximize",
      objective: { x: 1, y: 1 },
      variables: [{ name: "x", type: "binary" }, { name: "y", type: "binary" }],
      constraints: [{ name: "cap", coefficients: { x: 2, y: 2 }, upper: 3 }],
    };
    const res = await solve(mip);
    expect(res.objectiveValue).toBeCloseTo(1, 6);
    const o = res.certificate!.optimality!;
    expect(o.optimalityClass).toBe("gap-bounded");
    expect(o.dualBound).toBeCloseTo(1.5, 6); // valid upper bound on the maximum
    expect(o.optimalityGapAbs).toBeCloseTo(0.5, 6);
    // The dual bound is a VALID bound (>= the integer optimum for a maximisation).
    expect(o.dualBound!).toBeGreaterThanOrEqual(res.objectiveValue - 1e-9);
  });
});

describe("solve() result certificate — binary-domain + honest-optimality regression", () => {
  // Regression for an adversarial finding: an explicit Bounds row used to override
  // the Binary section's [0,1] domain (binary vars could exceed 1), which produced
  // an infeasible incumbent and a FALSE proven-optimal. Both must now be correct.
  const knapsack: OptimizationProblem = {
    direction: "maximize",
    objective: { x1: 60, x2: 100, x3: 120 },
    variables: [
      { name: "x1", type: "binary" },
      { name: "x2", type: "binary" },
      { name: "x3", type: "binary" },
    ],
    constraints: [{ name: "cap", coefficients: { x1: 10, x2: 20, x3: 30 }, upper: 50 }],
  };

  it("binary variables stay within {0,1} and return the true integer optimum (220)", async () => {
    const res = await solve(knapsack);
    expect(res.status).toBe("optimal");
    expect(res.objectiveValue).toBeCloseTo(220, 6); // true binary optimum (was a bogus 300)
    for (const v of Object.values(res.solution)) {
      expect(v).toBeGreaterThanOrEqual(-1e-6);
      expect(v).toBeLessThanOrEqual(1 + 1e-6); // never > 1 for a binary var
    }
    expect(res.certificate!.primalFeasible).toBe(true);
    expect(res.certificate!.integrality!.integral).toBe(true);
  });

  it("does NOT fabricate proven-optimal on a real integrality gap (220 vs root 240)", async () => {
    const res = await solve(knapsack);
    const o = res.certificate!.optimality!;
    expect(o.optimalityClass).toBe("gap-bounded"); // honest: NOT proven-optimal
    expect(o.dualBound!).toBeGreaterThanOrEqual(res.objectiveValue - 1e-9); // valid bound
    expect(o.dualBound).toBeCloseTo(240, 6); // the genuine root LP relaxation
    expect(o.optimalityGapAbs).toBeCloseTo(20, 6);
  });
});

describe("solve() result certificate — infeasible", () => {
  // x >= 5 and x <= 1 with x in [0,10] -> infeasible
  const infeasible: OptimizationProblem = {
    direction: "minimize",
    objective: { x: 1 },
    variables: [{ name: "x", lower: 0, upper: 10 }],
    constraints: [
      { name: "lo", coefficients: { x: 1 }, lower: 5 },
      { name: "hi", coefficients: { x: 1 }, upper: 1 },
    ],
  };

  it("does NOT certify an infeasible report (no Farkas witness available)", async () => {
    const res = await solve(infeasible);
    const cert = res.certificate!;
    expect(cert.certificateValid).toBe(false);
    expect(["infeasible", "unknown"]).toContain(cert.status);
    expect(cert.notes.join(" ")).toMatch(/Farkas|not independently certified|no optimal/i);
  });
});
