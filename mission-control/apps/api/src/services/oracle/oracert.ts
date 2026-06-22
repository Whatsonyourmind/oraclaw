/**
 * OraCert — one in-toto-conformant, re-derivable-result predicate shared by
 * heterogeneous producers (this server's SolveCertificate and an external tool's
 * BuildManifest).
 *
 * Standard supply-chain predicates (in-toto Statement v1, SLSA Provenance,
 * the test-result predicate) bind their subject by DIGEST ONLY — a verifier
 * confirms "these are the bytes", never "this result is correct". OraCert adds
 * a method-tagged **re-derivation witness**: enough information for a
 * standalone, LLM-free verifier to re-establish the *correctness* of the
 * result the predicate commits to — for a solve, by recomputing primal
 * feasibility + the objective + the content hash from the returned solution
 * (exactly what `verifyCertificate` does), with no solver in the loop.
 *
 * This module is the thin TS emitter. The matching LLM-free verifier ships in
 * an external tool (`external-tool.oracert`), which also re-derives the an external tool
 * branch (recompute the workbook SHA-256 + re-run the schedule audit on the
 * bound .xlsx). The content hash is canonicalised identically on both
 * runtimes (sorted keys + `toFixed(12)`), locked by a committed golden vector.
 */

import type {
  OptimizationProblem,
  SolveCertificate,
} from "./algorithms/constraintOptimizer.js";

export const ORACERT_STATEMENT_TYPE = "https://in-toto.io/Statement/v1";
export const ORACERT_PREDICATE_TYPE = "oracert.dev/redrivable-result/v1";

export interface OraCertSubject {
  name: string;
  digest: { sha256: string };
}

export interface OraCertStatement {
  _type: string; // ORACERT_STATEMENT_TYPE
  subject: OraCertSubject[];
  predicateType: string; // ORACERT_PREDICATE_TYPE
  predicate: {
    /** Re-derivation method tag = the producer certificate's schema. */
    method: string;
    /** Always true: this predicate carries a re-derivation witness. */
    redrivable: true;
    producer: { name: string; version: string };
    /** Method-specific evidence the verifier re-runs. */
    witness: Record<string, unknown>;
  };
}

/**
 * Wrap a {@link SolveCertificate} (+ the problem and returned solution) into an
 * OraCert in-toto Statement. The subject digest is the certificate's content
 * hash — itself a sha256 over the canonical inputs+outputs — so the verifier
 * re-derives the subject digest rather than trusting it. The witness carries
 * everything `verifyCertificate(problem, solution, certificate)` needs.
 */
export function toOraCertStatement(
  certificate: SolveCertificate,
  problem: OptimizationProblem,
  solution: Record<string, number>,
  subjectName = "constraint-optimization-result",
): OraCertStatement {
  return {
    _type: ORACERT_STATEMENT_TYPE,
    subject: [{ name: subjectName, digest: { sha256: certificate.contentHash } }],
    predicateType: ORACERT_PREDICATE_TYPE,
    predicate: {
      method: certificate.schema,
      redrivable: true,
      producer: { name: "oraclaw", version: certificate.algoVersion },
      witness: { certificate, problem, solution },
    },
  };
}
