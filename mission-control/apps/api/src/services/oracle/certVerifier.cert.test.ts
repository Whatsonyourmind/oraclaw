/**
 * Standalone solver-free verifier — round-trip, optimality classification, and a
 * 5-class corruption suite. Every corruption test EMPIRICALLY flips the verdict
 * from valid→invalid, which is the entire point of a re-checkable certificate.
 *
 * The verifier is also build-asserted to be independent of the producer: it must
 * import neither `highs` (the solver) nor `constraintOptimizer` (the producer
 * path), so a third party can re-derive correctness trusting nothing.
 */

import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { solve, type OptimizationProblem } from "./algorithms/constraintOptimizer";
import { verifySolveCertificate, type VSolveCertificate } from "./certVerifier";

// Problems reused across the suite.
const LP: OptimizationProblem = {
  direction: "maximize",
  objective: { x: 3, y: 2 },
  variables: [{ name: "x", lower: 0 }, { name: "y", lower: 0 }],
  constraints: [
    { name: "cap", coefficients: { x: 1, y: 1 }, upper: 4 },
    { name: "xcap", coefficients: { x: 1 }, upper: 2 },
  ],
};

// Integrality gap: relaxation gives 1.5, the integer optimum is 1.
const MIP_GAP: OptimizationProblem = {
  direction: "maximize",
  objective: { x: 1, y: 1 },
  variables: [{ name: "x", type: "binary" }, { name: "y", type: "binary" }],
  constraints: [{ name: "cap", coefficients: { x: 2, y: 2 }, upper: 3 }],
};

// Tight relaxation: root bound meets the integer optimum (1).
const MIP_PROVEN: OptimizationProblem = {
  direction: "maximize",
  objective: { x: 1, y: 1 },
  variables: [{ name: "x", type: "binary" }, { name: "y", type: "binary" }],
  constraints: [{ name: "pickone", coefficients: { x: 1, y: 1 }, upper: 1 }],
};

describe("certVerifier — module independence (build assertion)", () => {
  it("imports neither the solver (highs) nor the producer (constraintOptimizer)", () => {
    const src = readFileSync(new URL("./certVerifier.ts", import.meta.url), "utf8");
    const imports = src
      .split("\n")
      .filter((l) => /^\s*import\b/.test(l) || /\bfrom\s+["']/.test(l));
    for (const line of imports) {
      expect(line, `forbidden solver import: ${line}`).not.toMatch(/from\s+["']highs["']/);
      expect(line, `forbidden producer import: ${line}`).not.toMatch(/constraintOptimizer/);
    }
    // Sanity: the only runtime dependency it is allowed is node:crypto.
    expect(src).toMatch(/from\s+["']node:crypto["']/);
  });
});

describe("certVerifier — round-trip on honest certificates", () => {
  it("LP: verifies and classifies proven-optimal with an exact-tight bound", async () => {
    const res = await solve(LP);
    const v = verifySolveCertificate(LP, res.solution, res.certificate! as VSolveCertificate);
    expect(v.valid).toBe(true);
    expect(v.reasons).toHaveLength(0);
    expect(v.recomputed.optimalityClass).toBe("proven-optimal");
    expect(v.recomputed.dualBound).toBeCloseTo(10, 6);
    expect(v.recomputed.boundExactSign).toBe(0); // exact: bound equals incumbent
    expect(res.certificate!.optimality!.optimalityClass).toBe("proven-optimal");
  });

  it("MIP with a true integrality gap: gap-bounded, bound strictly valid, NOT proven", async () => {
    const res = await solve(MIP_GAP);
    expect(res.objectiveValue).toBeCloseTo(1, 6);
    const cert = res.certificate!;
    expect(cert.optimality!.optimalityClass).toBe("gap-bounded");
    expect(cert.optimality!.dualBound).toBeCloseTo(1.5, 6);
    expect(cert.optimality!.optimalityGapAbs).toBeCloseTo(0.5, 6);
    // Honest wording: never claims optimality when a gap remains.
    expect(cert.optimality!.note).toMatch(/UNPROVEN|branch-and-bound/i);

    const v = verifySolveCertificate(MIP_GAP, res.solution, cert as VSolveCertificate);
    expect(v.valid).toBe(true); // feasible + correct objective ⇒ a VALID answer (just not proven optimal)
    expect(v.recomputed.optimalityClass).toBe("gap-bounded");
    expect(v.recomputed.boundExactSign).toBe(1); // exact: bound strictly below incumbent (valid)
  });

  it("MIP proven-optimal at the relaxation root", async () => {
    const res = await solve(MIP_PROVEN);
    const cert = res.certificate!;
    expect(cert.optimality!.optimalityClass).toBe("proven-optimal");
    expect(cert.optimality!.optimalityGapAbs).toBeCloseTo(0, 6);
    const v = verifySolveCertificate(MIP_PROVEN, res.solution, cert as VSolveCertificate);
    expect(v.valid).toBe(true);
    expect(v.recomputed.optimalityClass).toBe("proven-optimal");
    expect(v.recomputed.boundExactSign).toBe(0);
  });

  it("re-derived bound agrees with the producer's emitted bound (cross-implementation)", async () => {
    for (const p of [LP, MIP_GAP, MIP_PROVEN]) {
      const res = await solve(p);
      const v = verifySolveCertificate(p, res.solution, res.certificate! as VSolveCertificate);
      expect(v.recomputed.dualBound).toBeCloseTo(res.certificate!.optimality!.dualBound!, 6);
    }
  });
});

describe("certVerifier — 5-class corruption suite (each must flip valid→invalid)", () => {
  it("baseline honest certificate verifies", async () => {
    const res = await solve(MIP_GAP);
    expect(verifySolveCertificate(MIP_GAP, res.solution, res.certificate! as VSolveCertificate).valid).toBe(true);
  });

  it("class 1 — perturbed primal solution", async () => {
    const res = await solve(MIP_GAP);
    const v = verifySolveCertificate(
      MIP_GAP,
      { ...res.solution, x: (res.solution.x ?? 0) + 0.4 },
      res.certificate! as VSolveCertificate,
    );
    expect(v.valid).toBe(false);
    expect(v.reasons.some((r) => /primal infeasible|integrality|hash/.test(r))).toBe(true);
  });

  it("class 2 — inflated certified objective value", async () => {
    const res = await solve(MIP_GAP);
    const cert = { ...res.certificate!, objectiveValue: res.certificate!.objectiveValue + 5 } as VSolveCertificate;
    const v = verifySolveCertificate(MIP_GAP, res.solution, cert);
    expect(v.valid).toBe(false);
    expect(v.reasons.some((r) => /objective mismatch|hash/.test(r))).toBe(true);
  });

  it("class 3 — fractional (non-integral) integer variable", async () => {
    const res = await solve(MIP_GAP);
    const v = verifySolveCertificate(MIP_GAP, { x: 0.5, y: 0.5 }, res.certificate! as VSolveCertificate);
    expect(v.valid).toBe(false);
    expect(v.reasons.some((r) => /integrality|hash/.test(r))).toBe(true);
  });

  it("class 4 — forged dual bound + false proven-optimal claim (no solver can hide this)", async () => {
    const res = await solve(MIP_GAP); // genuine gap of 0.5
    const forged = {
      ...res.certificate!,
      optimality: {
        ...res.certificate!.optimality!,
        dualBound: res.objectiveValue, // pretend the bound meets the incumbent
        optimalityClass: "proven-optimal" as const,
        optimalityGapAbs: 0,
      },
    } as VSolveCertificate;
    const v = verifySolveCertificate(MIP_GAP, res.solution, forged);
    expect(v.valid).toBe(false);
    // The bound is NOT reproducible from the multipliers, and the gap is real.
    expect(v.reasons.some((r) => /not reproducible from multipliers/.test(r))).toBe(true);
    expect(v.reasons.some((r) => /claims proven-optimal but recomputed gap/.test(r))).toBe(true);
  });

  it("class 5 — tampered content hash", async () => {
    const res = await solve(MIP_GAP);
    const cert = {
      ...res.certificate!,
      contentHash: res.certificate!.contentHash.replace(/.$/, (c) => (c === "0" ? "1" : "0")),
    } as VSolveCertificate;
    const v = verifySolveCertificate(MIP_GAP, res.solution, cert);
    expect(v.valid).toBe(false);
    expect(v.reasons).toContain(
      "content hash mismatch (solution does not match the certified inputs/outputs)",
    );
  });
});

describe("certVerifier — exact-rational bound check has teeth a float check would miss", () => {
  it("flags a dual bound that exceeds the incumbent via exact-sign (invalid bound)", async () => {
    const res = await solve(MIP_GAP);
    // Inflating the certified objective makes the (real) bound exceed the new incumbent.
    const cert = { ...res.certificate!, objectiveValue: res.certificate!.objectiveValue + 3 } as VSolveCertificate;
    const v = verifySolveCertificate(MIP_GAP, res.solution, cert, { exact: true });
    expect(v.recomputed.boundExactSign).toBe(-1);
    expect(v.reasons.some((r) => /exceeds incumbent.*exact-rational/.test(r))).toBe(true);
  });
});
