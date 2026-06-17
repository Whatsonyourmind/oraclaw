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
