/**
 * Input-validation tests for the constraint solver.
 *
 * A malformed payload to the (paid) solve endpoint must yield a clear, actionable
 * error rather than a cryptic runtime crash (e.g. "problem.variables.some is not a
 * function") surfacing as an opaque 500. validateProblem() guards the shape.
 */

import { describe, it, expect } from "vitest";
import {
  solve,
  validateProblem,
  type OptimizationProblem,
} from "./algorithms/constraintOptimizer";

const good = {
  objective: { x: 1 },
  variables: [{ name: "x", type: "continuous" as const }],
  constraints: [],
  direction: "minimize" as const,
} as unknown as OptimizationProblem;

describe("validateProblem", () => {
  it("accepts a well-formed problem", () => {
    expect(() => validateProblem(good)).not.toThrow();
  });

  it("rejects a non-object problem", () => {
    expect(() => validateProblem(null as unknown as OptimizationProblem)).toThrow(/Invalid problem/);
  });

  it("rejects a missing/invalid objective", () => {
    expect(() => validateProblem({ variables: good.variables, constraints: [] } as unknown as OptimizationProblem))
      .toThrow(/objective/);
  });

  it("rejects variables that are not a non-empty array (the .some crash repro)", () => {
    expect(() => validateProblem({ objective: { x: 1 }, variables: {}, constraints: [] } as unknown as OptimizationProblem))
      .toThrow(/variables/);
    expect(() => validateProblem({ objective: { x: 1 }, variables: [], constraints: [] } as unknown as OptimizationProblem))
      .toThrow(/variables/);
  });

  it("rejects a variable without a string name", () => {
    expect(() => validateProblem({ objective: { x: 1 }, variables: [{ type: "binary" }], constraints: [] } as unknown as OptimizationProblem))
      .toThrow(/name/);
  });

  it("rejects constraints that are not an array", () => {
    expect(() => validateProblem({ objective: { x: 1 }, variables: good.variables, constraints: null } as unknown as OptimizationProblem))
      .toThrow(/constraints/);
  });
});

describe("solve input guard", () => {
  it("rejects a malformed payload with a clear error instead of a raw crash", async () => {
    const bad = { objective: { x: 1 }, variables: {} } as unknown as OptimizationProblem;
    await expect(solve(bad)).rejects.toThrow(/variables/);
  });
});
