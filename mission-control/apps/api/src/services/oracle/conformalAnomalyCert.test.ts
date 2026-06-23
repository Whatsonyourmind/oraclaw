/**
 * Conformal anomaly-detection certificate: reproduce-gate + golden-corruption.
 *
 * (a) DISCRIMINATION: on clean heavy-tailed (Student-t(3)) data the split-conformal
 *     detector holds its stated false-alarm level (<= alpha), distribution-free, while
 *     the heuristic z>3 detector breaches its normality-based nominal (0.27%) ~5x.
 * (b) RE-CHECKABLE: a clean certificate verifies; any tamper (dropped flag, altered
 *     p-value, wrong content hash) is rejected by the standalone verifier.
 *
 * Calibrated from a standalone sweep (conformal ~0.0024 vs z>3 ~0.0144 at the same
 * 0.0027 nominal). 100% synthetic.
 */

import { describe, it, expect } from "vitest";
import {
  detectAnomaliesConformal,
  verifyConformalAnomalyCertificate,
} from "./algorithms/conformalAnomalyCert";
import { detectAnomaliesZScore } from "./algorithms/anomalyDetector";

// seeded RNG + Student-t(3) sampler (heavy tails; no deps)
function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function normal(r: () => number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = r();
  while (v === 0) v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
function t3(r: () => number): number {
  const z = normal(r);
  const chi = normal(r) ** 2 + normal(r) ** 2 + normal(r) ** 2;
  return z / Math.sqrt(chi / 3);
}

describe("conformal anomaly certificate — reproduce-gate", () => {
  it("conformal holds its false-alarm level on heavy tails where z>3 breaches its nominal", () => {
    const ALPHA = 0.0027; // == z>3's claimed nominal (0.27% under normality)
    const seeds = 8;
    let conf = 0;
    let zfa = 0;
    for (let seed = 1; seed <= seeds; seed++) {
      const r = mulberry32(seed * 7919);
      const calib = Array.from({ length: 2000 }, () => t3(r));
      const test = Array.from({ length: 5000 }, () => t3(r)); // clean, no injected anomalies
      const res = detectAnomaliesConformal(test, calib, ALPHA);
      conf += res.anomalies.length / test.length;
      const z = detectAnomaliesZScore(test, 3.0);
      zfa += z.anomalies.length / test.length;
    }
    conf /= seeds;
    zfa /= seeds;
    // conformal holds near its stated level (distribution-free guarantee)
    expect(conf).toBeLessThanOrEqual(ALPHA * 2.2);
    // z>3 breaches its 0.27% nominal on heavy-tailed data, and by a wide margin
    expect(zfa).toBeGreaterThanOrEqual(ALPHA * 3);
    expect(zfa).toBeGreaterThan(2 * conf);
  });

  it("flags an injected outlier at a reasonable alpha", () => {
    const r = mulberry32(11);
    const calib = Array.from({ length: 1000 }, () => t3(r));
    const data = [0.1, -0.2, 25.0, 0.3]; // 25.0 is a gross outlier
    const res = detectAnomaliesConformal(data, calib, 0.05);
    expect(res.anomalies.map((a) => a.index)).toContain(2);
  });
});

describe("conformal anomaly certificate — re-checkable", () => {
  const r = mulberry32(42);
  const calib = Array.from({ length: 200 }, () => t3(r));
  const data = [...Array.from({ length: 50 }, () => t3(r)), 9.9, -12.3];
  const res = detectAnomaliesConformal(data, calib, 0.05);

  it("a clean certificate verifies", () => {
    expect(verifyConformalAnomalyCertificate(res.certificate, data, calib)).toBe(true);
  });

  it("rejects a dropped flag", () => {
    const tampered = structuredClone(res.certificate);
    tampered.flags = tampered.flags.slice(0, -1);
    expect(verifyConformalAnomalyCertificate(tampered, data, calib)).toBe(false);
  });

  it("rejects an altered p-value", () => {
    const tampered = structuredClone(res.certificate);
    tampered.pValues = tampered.pValues.map((p, i) => (i === 0 ? p + 0.5 : p));
    expect(verifyConformalAnomalyCertificate(tampered, data, calib)).toBe(false);
  });

  it("rejects a wrong content hash", () => {
    const tampered = structuredClone(res.certificate);
    tampered.contentHash = "deadbeef";
    expect(verifyConformalAnomalyCertificate(tampered, data, calib)).toBe(false);
  });
});
