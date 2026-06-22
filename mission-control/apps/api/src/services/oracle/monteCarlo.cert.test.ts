/**
 * Precision-certificate tests for the Monte Carlo simulator.
 *
 * The certificate is a re-checkable object: a third party can re-derive the
 * reported statistics WITHOUT trusting this server (re-run the recorded seed for
 * the certified n), and a tampered statistic must be rejected. These tests prove
 * exactly that, plus that the MCSE / replication-adequacy evidence is present.
 */

import { describe, it, expect } from "vitest";
import {
  MonteCarloService,
  buildMonteCarloCertificate,
  recheckMonteCarlo,
  verifyMonteCarloCertificate,
  MC_CERTIFICATE_SCHEMA,
  type SimulationFactor,
} from "./monteCarlo";

const svc = new MonteCarloService();
const normalFactor: SimulationFactor = { name: "value", distribution: { type: "normal", params: [100, 15] } };

describe("simulate_montecarlo precision certificate", () => {
  it("attaches a well-formed certificate with MCSE + seed + content hash", async () => {
    const out = await svc.runSingleFactorSimulation({ type: "normal", params: [100, 15] }, 1000, { seed: 42 });
    const cert = out.certificate!;
    expect(cert).toBeDefined();
    expect(cert.schema).toBe(MC_CERTIFICATE_SCHEMA);
    expect(cert.seed).toBe(42);
    expect(cert.iterations).toBe(1000);
    expect(cert.certificateValid).toBe(true);
    expect(cert.contentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(cert.mcseMean).toBeGreaterThan(0);
    expect(Number.isFinite(cert.mcseMeanBatch)).toBe(true);
    expect(cert.meanHalfWidth).toBeGreaterThan(0);
    // Every reported percentile carries a finite bootstrap MCSE.
    for (const k of ["p5", "p10", "p25", "p50", "p75", "p90", "p95"] as const) {
      expect(Number.isFinite(cert.percentileMCSE[k])).toBe(true);
    }
  });

  it("analytic and batch-means MCSE agree to the same order of magnitude for iid draws", async () => {
    const out = await svc.runSingleFactorSimulation({ type: "normal", params: [100, 15] }, 2000, { seed: 7 });
    const cert = out.certificate!;
    // Box-Muller draws are iid → the dependence-robust batch estimate should be
    // within a small constant factor of the analytic one (not an exact equality).
    const ratio = cert.mcseMeanBatch / cert.mcseMean;
    expect(ratio).toBeGreaterThan(0.3);
    expect(ratio).toBeLessThan(3.0);
  });

  it("verifies an honest certificate and REJECTS a tampered statistic (the whole point)", async () => {
    const out = await svc.runSingleFactorSimulation({ type: "normal", params: [100, 15] }, 1000, { seed: 99 });
    const cert = out.certificate!;

    const honest = await verifyMonteCarloCertificate(cert);
    expect(honest.valid).toBe(true);
    expect(honest.reasons).toHaveLength(0);

    // Tamper the certified mean. The re-run reproduces the honest mean and the
    // hash recomputed from the tampered fields no longer matches → invalid.
    const tampered = { ...cert, mean: cert.mean + 5 };
    const bad = await verifyMonteCarloCertificate(tampered);
    expect(bad.valid).toBe(false);
    expect(bad.reasons.length).toBeGreaterThan(0);
  });

  it("rejects a tampered percentile too", async () => {
    const out = await svc.runSingleFactorSimulation({ type: "normal", params: [100, 15] }, 1000, { seed: 5 });
    const cert = out.certificate!;
    const tampered = { ...cert, percentiles: { ...cert.percentiles, p95: cert.percentiles.p95 + 10 } };
    const bad = await verifyMonteCarloCertificate(tampered);
    expect(bad.valid).toBe(false);
    expect(bad.reasons.some((r) => r.includes("p95") || r.includes("hash"))).toBe(true);
  });

  it("content hash is deterministic across runs with the same seed and binds the stats", async () => {
    const a = await svc.runSingleFactorSimulation({ type: "normal", params: [100, 15] }, 1000, { seed: 123 });
    const b = await svc.runSingleFactorSimulation({ type: "normal", params: [100, 15] }, 1000, { seed: 123 });
    expect(a.certificate!.contentHash).toBe(b.certificate!.contentHash);
    expect(a.mean).toBe(b.mean);
    // A different seed changes the draws and therefore the hash.
    const c = await svc.runSingleFactorSimulation({ type: "normal", params: [100, 15] }, 1000, { seed: 124 });
    expect(c.certificate!.contentHash).not.toBe(a.certificate!.contentHash);
  });

  it("recheckMonteCarlo reproduces the certified statistics", async () => {
    const out = await svc.runSingleFactorSimulation({ type: "normal", params: [100, 15] }, 1000, { seed: 321 });
    const cert = out.certificate!;
    const re = await recheckMonteCarlo(cert.factors, cert.seed, cert.iterations);
    expect(re.mean).toBeCloseTo(cert.mean, 9);
    expect(re.stdDev).toBeCloseTo(cert.stdDev, 9);
    expect(re.percentiles.p50).toBeCloseTo(cert.percentiles.p50, 9);
  });

  it("replicationAdequacy reflects an ABSOLUTE half-width target", async () => {
    const loose = await svc.runSingleFactorSimulation({ type: "normal", params: [100, 15] }, 1000, { seed: 2024, targetHalfWidth: 5 });
    expect(loose.certificate!.replicationAdequacy).toBe(true);
    const tight = await svc.runSingleFactorSimulation({ type: "normal", params: [100, 15] }, 1000, { seed: 2024, targetHalfWidth: 0.01 });
    expect(tight.certificate!.replicationAdequacy).toBe(false);
    // No target → null, not a silent pass.
    const none = await svc.runSingleFactorSimulation({ type: "normal", params: [100, 15] }, 1000, { seed: 2024 });
    expect(none.certificate!.replicationAdequacy).toBeNull();
  });

  it("buildMonteCarloCertificate is a pure function of (factors, seed, results)", () => {
    const results = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const a = buildMonteCarloCertificate([normalFactor], 11, 10, results, false, null, 0.95);
    const b = buildMonteCarloCertificate([normalFactor], 11, 10, results, false, null, 0.95);
    expect(a.contentHash).toBe(b.contentHash);
    expect(a.mean).toBeCloseTo(5.5, 12);
  });
});
