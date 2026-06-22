/**
 * Estimation-error certificate tests for delta-normal portfolio VaR/ES.
 *
 * The certificate quantifies the SAMPLING error of a parametric VaR/ES point
 * estimate (muP, sigmaP estimated from T observations) with closed-form
 * delta-method standard errors, and is re-checkable: recompute from the inputs
 * and a tampered statistic is rejected. These tests prove that, plus the
 * falsifiable small-window behaviour (ES not distinct from VaR; wide ES CI).
 */

import { describe, it, expect } from "vitest";
import {
  portfolioVaR,
  buildRiskCertificate,
  verifyRiskCertificate,
  RISK_CERTIFICATE_SCHEMA,
} from "./algorithms/correlationMatrix";

// Deterministic normal-ish return generator (Mulberry32 + Box-Muller).
function genReturns(nAssets: number, T: number, seed: number): number[][] {
  let s = seed >>> 0;
  const rnd = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const norm = (mu: number, sd: number) => {
    const u1 = Math.max(rnd(), 1e-12);
    const u2 = rnd();
    return mu + sd * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  };
  const out: number[][] = [];
  for (let a = 0; a < nAssets; a++) {
    const row: number[] = [];
    for (let t = 0; t < T; t++) row.push(norm(0.0005, 0.012 + 0.003 * a));
    out.push(row);
  }
  return out;
}

const weights = [0.6, 0.4];

describe("analyze_risk estimation-error certificate", () => {
  it("attaches a well-formed certificate with delta-method SEs", () => {
    const returns = genReturns(2, 1000, 42);
    const result = portfolioVaR(weights, returns, 0.95, 1);
    const cert = buildRiskCertificate(weights, returns, 0.95, 1, result);

    expect(cert.schema).toBe(RISK_CERTIFICATE_SCHEMA);
    expect(cert.method).toBe("delta-normal");
    expect(cert.effectiveSampleSupport).toBe(1000);
    expect(cert.certificateValid).toBe(true);
    expect(cert.contentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(cert.seVaR).toBeGreaterThan(0);
    expect(cert.seES).toBeGreaterThan(0);
    expect(cert.varCI[0]).toBeLessThan(cert.varValue);
    expect(cert.varCI[1]).toBeGreaterThan(cert.varValue);
    // ES exceeds VaR for the normal model, and at T=1000 the gap is resolvable.
    expect(cert.esGap).toBeGreaterThan(0);
    expect(cert.esStatisticallyDistinctFromVaR).toBe(true);
  });

  it("verifies an honest certificate and REJECTS a tampered statistic", () => {
    const returns = genReturns(2, 800, 7);
    const result = portfolioVaR(weights, returns, 0.99, 10);
    const cert = buildRiskCertificate(weights, returns, 0.99, 10, result);

    const honest = verifyRiskCertificate(cert, weights, returns);
    expect(honest.valid).toBe(true);
    expect(honest.reasons).toHaveLength(0);

    const tampered = { ...cert, varValue: cert.varValue * 0.5 };
    const bad = verifyRiskCertificate(tampered, weights, returns);
    expect(bad.valid).toBe(false);
    expect(bad.reasons.length).toBeGreaterThan(0);

    // Re-checking against DIFFERENT inputs (tampered data) also fails via hash.
    const otherReturns = genReturns(2, 800, 8);
    expect(verifyRiskCertificate(cert, weights, otherReturns).valid).toBe(false);
  });

  it("content hash is deterministic for identical inputs", () => {
    const returns = genReturns(2, 500, 123);
    const a = buildRiskCertificate(weights, returns, 0.95, 1, portfolioVaR(weights, returns, 0.95, 1));
    const b = buildRiskCertificate(weights, returns, 0.95, 1, portfolioVaR(weights, returns, 0.95, 1));
    expect(a.contentHash).toBe(b.contentHash);
  });

  it("FALSIFIABLE: small windows do not resolve ES from VaR; SE(gap) shrinks with T", () => {
    const small = genReturns(2, 5, 99);
    const large = genReturns(2, 4000, 99);
    const certSmall = buildRiskCertificate(weights, small, 0.95, 1, portfolioVaR(weights, small, 0.95, 1));
    const certLarge = buildRiskCertificate(weights, large, 0.95, 1, portfolioVaR(weights, large, 0.95, 1));

    // Tiny window: the ES–VaR gap is within estimation noise → not distinct.
    expect(certSmall.esStatisticallyDistinctFromVaR).toBe(false);
    // Large window: distinct.
    expect(certLarge.esStatisticallyDistinctFromVaR).toBe(true);
    // SE of the gap shrinks as the window grows.
    expect(certLarge.seEsGap).toBeLessThan(certSmall.seEsGap);
    // And on a moderate window the ES CI half-width is wide relative to the gap.
    const mod = genReturns(2, 40, 5);
    const certMod = buildRiskCertificate(weights, mod, 0.95, 1, portfolioVaR(weights, mod, 0.95, 1));
    const esHalfWidth = certMod.ciLevel ? (certMod.esCI[1] - certMod.esValue) : 0;
    expect(esHalfWidth).toBeGreaterThan(certMod.esGap);
  });

  it("optional Kupiec backtest rejects a miscalibrated VaR and passes a calibrated one", () => {
    const returns = genReturns(2, 1000, 321);
    const result = portfolioVaR(weights, returns, 0.95, 1);

    // 16% breaches on a 95% VaR (expected 5%) over 250 days → reject.
    const tooMany = Array.from({ length: 250 }, (_, i) => (i % 6 === 0 ? 1 : 0)); // ~16.7%
    const certBad = buildRiskCertificate(weights, returns, 0.95, 1, result, { realizedExceedances: tooMany });
    expect(certBad.kupiec).toBeDefined();
    expect(certBad.kupiec!.expectedRate).toBeCloseTo(0.05, 12);
    expect(certBad.kupiec!.rejectAt5pct).toBe(true);

    // ~5% breaches → do not reject.
    const calibrated = Array.from({ length: 260 }, (_, i) => (i % 20 === 0 ? 1 : 0)); // ~5%
    const certOk = buildRiskCertificate(weights, returns, 0.95, 1, result, { realizedExceedances: calibrated });
    expect(certOk.kupiec!.rejectAt5pct).toBe(false);
  });
});
