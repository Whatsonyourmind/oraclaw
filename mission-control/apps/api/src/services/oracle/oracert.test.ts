/**
 * OraCert emitter tests — the in-toto Statement that wraps a SolveCertificate.
 *
 * Proves the envelope is in-toto Statement v1 conformant, binds the subject by
 * the certificate's content hash, and carries a witness that re-verifies
 * (the same evidence the standalone an external tool verifier re-runs).
 */

import { describe, it, expect } from "vitest";
import {
  solve,
  verifyCertificate,
  type OptimizationProblem,
} from "./algorithms/constraintOptimizer";
import {
  toOraCertStatement,
  ORACERT_STATEMENT_TYPE,
  ORACERT_PREDICATE_TYPE,
} from "./oracert";

// maximize 3x + 2y  s.t. x+y<=4, x<=2  → x=2,y=2, obj=10
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

describe("OraCert statement (oraclaw.solve.certificate/v1)", () => {
  it("is in-toto Statement v1 conformant and binds the content hash", async () => {
    const res = await solve(lp);
    const cert = res.certificate!;
    const stmt = toOraCertStatement(cert, lp, res.solution);

    expect(stmt._type).toBe(ORACERT_STATEMENT_TYPE);
    expect(stmt.predicateType).toBe(ORACERT_PREDICATE_TYPE);
    expect(stmt.subject).toHaveLength(1);
    expect(stmt.subject[0].digest.sha256).toBe(cert.contentHash);
    expect(stmt.subject[0].digest.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(stmt.predicate.method).toBe(cert.schema);
    expect(stmt.predicate.redrivable).toBe(true);
    expect(stmt.predicate.producer.name).toBe("oraclaw");
    expect(stmt.predicate.producer.version).toBe(cert.algoVersion);
  });

  it("carries a witness that re-verifies independently of the solver", async () => {
    const res = await solve(lp);
    const cert = res.certificate!;
    const stmt = toOraCertStatement(cert, lp, res.solution);

    const w = stmt.predicate.witness as {
      problem: OptimizationProblem;
      solution: Record<string, number>;
      certificate: typeof cert;
    };
    const { valid, reasons } = verifyCertificate(w.problem, w.solution, w.certificate);
    expect(reasons).toEqual([]);
    expect(valid).toBe(true);
  });

  it("breaks verification when the witnessed solution is tampered", async () => {
    const res = await solve(lp);
    const cert = res.certificate!;
    const tampered = { ...res.solution, x: res.solution.x + 1 };
    const { valid } = verifyCertificate(lp, tampered, cert);
    expect(valid).toBe(false);
  });
});
