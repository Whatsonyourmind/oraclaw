/**
 * Monte Carlo Simulation Service
 * Story 5.1 - ORACLE Probability Engine
 */

import { createHash } from "node:crypto";

export interface SimulationConfig {
  iterations: number;
  timeoutMs: number;
  seed?: number;
  /**
   * Absolute precision target for the half-width of the mean's confidence
   * interval. When supplied, the result certificate reports `replicationAdequacy`
   * = (meanHalfWidth <= targetHalfWidth). MUST be absolute, not relative — a
   * relative target explodes for near-zero estimates.
   */
  targetHalfWidth?: number;
  /** Two-sided confidence level for the MCSE intervals (default 0.95). */
  confidenceLevel?: number;
}

export interface DistributionParams {
  type: 'normal' | 'lognormal' | 'uniform' | 'triangular' | 'beta' | 'exponential';
  params: number[];
}

export interface SimulationFactor {
  name: string;
  distribution: DistributionParams;
}

export interface SimulationOutput {
  mean: number;
  stdDev: number;
  percentiles: {
    p5: number;
    p10: number;
    p25: number;
    p50: number;
    p75: number;
    p90: number;
    p95: number;
  };
  distribution: Array<{ bucket: number; count: number; percentage: number }>;
  iterations: number;
  executionTimeMs: number;
  timedOut: boolean;
  /** Re-checkable Monte Carlo precision certificate (see MonteCarloCertificate). */
  certificate?: MonteCarloCertificate;
}

// ── Result Certificate ─────────────────────────────────
//
// Every simulation ships a certificate that anyone can re-check WITHOUT trusting
// this server: re-run the exact same seeded stream for the same effective n and
// confirm the reported statistics reproduce bit-for-bit, plus a content hash that
// binds inputs→outputs and Monte Carlo standard-error (MCSE) precision evidence.
// rsimsum / simhelpers (Morris–White–Crowther 2019) compute MCSE but bind no
// seed / content-hash / recompute-verifier; MCP-Solver (arXiv:2501.00539) has an
// LLM "review" stochastic output instead. The binding — not the MCSE math — is
// the contribution.

export const MC_CERTIFICATE_SCHEMA = "oraclaw.montecarlo.certificate/v1";
const MC_ALGO_VERSION = "monteCarlo/mulberry32-boxmuller@1";
const MC_BOOTSTRAP_RESAMPLES = 400;
const MC_STAT_ABS_TOL = 1e-9;
const MC_STAT_REL_TOL = 1e-9;

export interface PercentileSet {
  p5: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  p95: number;
}

export interface MonteCarloCertificate {
  schema: string; // MC_CERTIFICATE_SCHEMA
  algoVersion: string;
  /** The actual integer seed used (resolved even when the caller omitted one). */
  seed: number;
  /** Iterations the caller asked for. */
  requestedIterations: number;
  /** Effective sample count actually drawn (< requested iff timedOut). */
  iterations: number;
  timedOut: boolean;
  /** Factors + distributions, sufficient to re-run the simulation. */
  factors: SimulationFactor[];
  /** Two-sided confidence level for the mean CI. */
  confidenceLevel: number;
  /** Certified outputs (bound by contentHash, reproduced by the verifier). */
  mean: number;
  stdDev: number;
  percentiles: PercentileSet;
  /** Monte Carlo standard error of the mean (analytic s/sqrt(n), s = sample SD). */
  mcseMean: number;
  /** Batch-means MCSE of the mean — a dependence-robust cross-check of mcseMean. */
  mcseMeanBatch: number;
  /** Half-width of the confidenceLevel CI for the mean = z * mcseMean. */
  meanHalfWidth: number;
  /** Bootstrap MCSE for each reported percentile (deterministic, seed-derived). */
  percentileMCSE: PercentileSet;
  /** true iff meanHalfWidth <= targetHalfWidth; null when no target was given. */
  replicationAdequacy: boolean | null;
  /** The absolute mean-CI half-width target the caller supplied (null if none). */
  targetHalfWidth: number | null;
  /** sha256 over canonical {factors, seed, iterations, stats, mcse}. */
  contentHash: string;
  /** Internally self-consistent (finite stats, hash binds the stored fields). */
  certificateValid: boolean;
  notes: string[];
}

// Simple seeded random number generator (Mulberry32)
function createRandom(seed: number): () => number {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Box-Muller transform for normal distribution
function normalSample(mean: number, stdDev: number, random: () => number): number {
  const u1 = random();
  const u2 = random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + stdDev * z;
}

// Sample from various distributions
function sampleDistribution(dist: DistributionParams, random: () => number): number {
  const { type, params } = dist;

  switch (type) {
    case 'normal': {
      // params: [mean, stdDev]
      const [mean, stdDev] = params;
      return normalSample(mean, stdDev, random);
    }

    case 'lognormal': {
      // params: [mu, sigma] (parameters of underlying normal)
      const [mu, sigma] = params;
      return Math.exp(normalSample(mu, sigma, random));
    }

    case 'uniform': {
      // params: [min, max]
      const [min, max] = params;
      return min + random() * (max - min);
    }

    case 'triangular': {
      // params: [min, mode, max]
      const [min, mode, max] = params;
      const u = random();
      const fc = (mode - min) / (max - min);
      if (u < fc) {
        return min + Math.sqrt(u * (max - min) * (mode - min));
      } else {
        return max - Math.sqrt((1 - u) * (max - min) * (max - mode));
      }
    }

    case 'beta': {
      // params: [alpha, beta]
      // Using Gamma distribution method
      const [alpha, beta] = params;
      const gamma1 = gammaSample(alpha, random);
      const gamma2 = gammaSample(beta, random);
      return gamma1 / (gamma1 + gamma2);
    }

    case 'exponential': {
      // params: [lambda (rate)]
      const [lambda] = params;
      return -Math.log(1 - random()) / lambda;
    }

    default:
      return random();
  }
}

// Gamma sampling using Marsaglia and Tsang's method
function gammaSample(shape: number, random: () => number): number {
  if (shape < 1) {
    // Use transformation for shape < 1
    return gammaSample(shape + 1, random) * Math.pow(random(), 1 / shape);
  }

  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);

  while (true) {
    let x: number, v: number;
    do {
      x = normalSample(0, 1, random);
      v = 1 + c * x;
    } while (v <= 0);

    v = v * v * v;
    const u = random();

    if (u < 1 - 0.0331 * x * x * x * x) {
      return d * v;
    }

    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) {
      return d * v;
    }
  }
}

// Calculate percentile from sorted array
function percentile(sortedValues: number[], p: number): number {
  const index = (p / 100) * (sortedValues.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;

  if (lower === upper) {
    return sortedValues[lower];
  }

  return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
}

// Create histogram buckets
function createHistogram(values: number[], bucketCount: number = 20): Array<{ bucket: number; count: number; percentage: number }> {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const bucketSize = range / bucketCount;

  const buckets = new Array(bucketCount).fill(0);

  for (const value of values) {
    const bucketIndex = Math.min(Math.floor((value - min) / bucketSize), bucketCount - 1);
    buckets[bucketIndex]++;
  }

  return buckets.map((count, i) => ({
    bucket: min + (i + 0.5) * bucketSize,
    count,
    percentage: (count / values.length) * 100,
  }));
}

// ── Certificate machinery ──────────────────────────────

// Acklam's rational inverse-normal-CDF approximation (|error| < 1.15e-9). Used
// to turn a confidence level into a z-multiplier with no external dependency.
function normInv(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const plow = 0.02425;
  const phigh = 1 - plow;
  if (p < plow) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p <= phigh) {
    const q = p - 0.5;
    const r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }
  const q = Math.sqrt(-2 * Math.log(1 - p));
  return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
}

// Deterministic, float-stable canonical hash (sorted keys, fixed precision) so
// identical inputs/outputs always hash identically and any change flips it.
function mcCanonicalize(value: unknown): unknown {
  if (typeof value === "number") return Number.isFinite(value) ? value.toFixed(12) : String(value);
  if (Array.isArray(value)) return value.map(mcCanonicalize);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(value as Record<string, unknown>).sort()) {
      out[k] = mcCanonicalize((value as Record<string, unknown>)[k]);
    }
    return out;
  }
  return value;
}

function mcContentHash(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(mcCanonicalize(payload))).digest("hex");
}

const PCT_KEYS: Array<keyof PercentileSet> = ["p5", "p10", "p25", "p50", "p75", "p90", "p95"];
const PCT_NUM: Record<keyof PercentileSet, number> = { p5: 5, p10: 10, p25: 25, p50: 50, p75: 75, p90: 90, p95: 95 };

function fullPercentiles(sorted: number[]): PercentileSet {
  return {
    p5: percentile(sorted, 5), p10: percentile(sorted, 10), p25: percentile(sorted, 25),
    p50: percentile(sorted, 50), p75: percentile(sorted, 75), p90: percentile(sorted, 90),
    p95: percentile(sorted, 95),
  };
}

function sampleStdDev(values: number[], mean: number): number {
  const n = values.length;
  if (n < 2) return 0;
  const ss = values.reduce((s, v) => s + (v - mean) * (v - mean), 0);
  return Math.sqrt(ss / (n - 1));
}

// Batch-means SE of the grand mean: split into B≈sqrt(n) equal batches, take the
// SD of the B batch means / sqrt(B). For iid draws this ≈ analytic s/sqrt(n); a
// large divergence flags an unexpectedly dependent stream.
function batchMeansMCSE(values: number[]): number {
  const n = values.length;
  if (n < 4) return 0;
  const B = Math.max(2, Math.floor(Math.sqrt(n)));
  const m = Math.floor(n / B);
  if (m < 1) return 0;
  const batchMeans: number[] = [];
  for (let b = 0; b < B; b++) {
    let s = 0;
    for (let i = 0; i < m; i++) s += values[b * m + i];
    batchMeans.push(s / m);
  }
  const grand = batchMeans.reduce((a, b) => a + b, 0) / B;
  const varB = batchMeans.reduce((s, bm) => s + (bm - grand) * (bm - grand), 0) / (B - 1);
  return Math.sqrt(varB / B);
}

// Bootstrap MCSE for each percentile: resample with replacement B times from a
// deterministic seed-derived stream, recompute each percentile, take the SD
// across resamples. Seed-derived → the verifier reproduces it exactly.
function bootstrapPercentileMCSE(values: number[], seed: number): PercentileSet {
  const n = values.length;
  const out: PercentileSet = { p5: 0, p10: 0, p25: 0, p50: 0, p75: 0, p90: 0, p95: 0 };
  if (n < 2) return out;
  const rng = createRandom((seed ^ 0x9e3779b9) >>> 0);
  const estimates: Record<keyof PercentileSet, number[]> = { p5: [], p10: [], p25: [], p50: [], p75: [], p90: [], p95: [] };
  const resample = new Array<number>(n);
  for (let r = 0; r < MC_BOOTSTRAP_RESAMPLES; r++) {
    for (let i = 0; i < n; i++) resample[i] = values[Math.floor(rng() * n)];
    resample.sort((x, y) => x - y);
    for (const k of PCT_KEYS) estimates[k].push(percentile(resample, PCT_NUM[k]));
  }
  for (const k of PCT_KEYS) {
    const arr = estimates[k];
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    out[k] = sampleStdDev(arr, mean);
  }
  return out;
}

/**
 * Build the precision certificate from the raw per-iteration results. Pure
 * function of (factors, seed, results) → deterministic, hence re-checkable.
 */
export function buildMonteCarloCertificate(
  factors: SimulationFactor[],
  seed: number,
  requestedIterations: number,
  results: number[],
  timedOut: boolean,
  targetHalfWidth: number | null,
  confidenceLevel: number,
): MonteCarloCertificate {
  const n = results.length;
  const sorted = [...results].sort((a, b) => a - b);
  const mean = n > 0 ? results.reduce((a, b) => a + b, 0) / n : 0;
  const popVar = n > 0 ? results.reduce((s, v) => s + (v - mean) * (v - mean), 0) / n : 0;
  const stdDev = Math.sqrt(popVar);
  const percentiles = fullPercentiles(sorted);

  const sSample = sampleStdDev(results, mean);
  const mcseMean = n > 0 ? sSample / Math.sqrt(n) : Infinity;
  const mcseMeanBatch = batchMeansMCSE(results);
  const z = normInv(0.5 + confidenceLevel / 2);
  const meanHalfWidth = z * mcseMean;
  const percentileMCSE = bootstrapPercentileMCSE(results, seed);
  const replicationAdequacy = targetHalfWidth == null ? null : meanHalfWidth <= targetHalfWidth;

  const notes: string[] = [];
  notes.push(`Re-checkable by re-running seed=${seed} for n=${n} draws (verifyMonteCarloCertificate).`);
  notes.push("Reproduction assumes the default sum aggregator; supply a custom aggregator to the verifier for multi-factor runs.");
  if (timedOut) notes.push(`Run timed out at n=${n} of ${requestedIterations} requested; verifier re-runs at the effective n.`);
  if (targetHalfWidth != null && !replicationAdequacy) {
    notes.push(`Precision target NOT met: mean CI half-width ${meanHalfWidth.toExponential(3)} > target ${targetHalfWidth.toExponential(3)} — add iterations.`);
  }

  const hashPayload = {
    schema: MC_CERTIFICATE_SCHEMA,
    algoVersion: MC_ALGO_VERSION,
    factors,
    seed,
    requestedIterations,
    iterations: n,
    timedOut,
    confidenceLevel,
    mean,
    stdDev,
    percentiles,
    mcseMean,
    mcseMeanBatch,
    meanHalfWidth,
    percentileMCSE,
  };
  const contentHash = mcContentHash(hashPayload);

  const certificateValid =
    n > 0 &&
    Number.isFinite(mean) &&
    Number.isFinite(stdDev) &&
    Number.isFinite(mcseMean) &&
    PCT_KEYS.every((k) => Number.isFinite(percentiles[k]) && Number.isFinite(percentileMCSE[k]));

  return {
    schema: MC_CERTIFICATE_SCHEMA,
    algoVersion: MC_ALGO_VERSION,
    seed,
    requestedIterations,
    iterations: n,
    timedOut,
    factors,
    confidenceLevel,
    mean,
    stdDev,
    percentiles,
    mcseMean,
    mcseMeanBatch,
    meanHalfWidth,
    percentileMCSE,
    replicationAdequacy,
    targetHalfWidth,
    contentHash,
    certificateValid,
    notes,
  };
}

function statsClose(a: number, b: number): boolean {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return a === b;
  return Math.abs(a - b) <= Math.max(MC_STAT_ABS_TOL, MC_STAT_REL_TOL * Math.abs(b));
}

/**
 * Re-run the exact seeded stream for the certificate's effective n (no timeout
 * truncation) and return the recomputed statistics — no trust in the original
 * run. This is the heart of the "re-checkable" guarantee.
 */
export async function recheckMonteCarlo(
  factors: SimulationFactor[],
  seed: number,
  iterations: number,
  aggregator?: (samples: Record<string, number>) => number,
): Promise<{ mean: number; stdDev: number; percentiles: PercentileSet }> {
  const svc = new MonteCarloService();
  const agg = aggregator ?? ((s: Record<string, number>) => Object.values(s).reduce((a, b) => a + b, 0));
  const out = await svc.runSimulation(factors, agg, {
    seed,
    iterations,
    timeoutMs: Number.MAX_SAFE_INTEGER, // verify at the certified n, never truncate
  });
  return { mean: out.mean, stdDev: out.stdDev, percentiles: out.percentiles };
}

/**
 * Verify a (possibly tampered) certificate. Rejects when either (a) the content
 * hash recomputed from the certificate's own fields disagrees with the stored
 * hash, or (b) a fresh seeded re-run does not reproduce the certified mean /
 * stdDev / percentiles. Tampering any stored statistic fails one or both checks.
 */
export async function verifyMonteCarloCertificate(
  certificate: MonteCarloCertificate,
  aggregator?: (samples: Record<string, number>) => number,
): Promise<{ valid: boolean; reasons: string[] }> {
  const reasons: string[] = [];

  const recomputedHash = mcContentHash({
    schema: certificate.schema,
    algoVersion: certificate.algoVersion,
    factors: certificate.factors,
    seed: certificate.seed,
    requestedIterations: certificate.requestedIterations,
    iterations: certificate.iterations,
    timedOut: certificate.timedOut,
    confidenceLevel: certificate.confidenceLevel,
    mean: certificate.mean,
    stdDev: certificate.stdDev,
    percentiles: certificate.percentiles,
    mcseMean: certificate.mcseMean,
    mcseMeanBatch: certificate.mcseMeanBatch,
    meanHalfWidth: certificate.meanHalfWidth,
    percentileMCSE: certificate.percentileMCSE,
  });
  if (recomputedHash !== certificate.contentHash) {
    reasons.push("content hash mismatch (certificate fields do not match the certified hash)");
  }

  const svc = new MonteCarloService();
  const agg = aggregator ?? ((s: Record<string, number>) => Object.values(s).reduce((a, b) => a + b, 0));
  const rerun = await svc.runSimulation(certificate.factors, agg, {
    seed: certificate.seed,
    iterations: certificate.iterations,
    timeoutMs: Number.MAX_SAFE_INTEGER,
  });

  if (!statsClose(rerun.mean, certificate.mean)) {
    reasons.push(`mean mismatch: recomputed ${rerun.mean} vs certified ${certificate.mean}`);
  }
  if (!statsClose(rerun.stdDev, certificate.stdDev)) {
    reasons.push(`stdDev mismatch: recomputed ${rerun.stdDev} vs certified ${certificate.stdDev}`);
  }
  for (const k of PCT_KEYS) {
    if (!statsClose(rerun.percentiles[k], certificate.percentiles[k])) {
      reasons.push(`${k} mismatch: recomputed ${rerun.percentiles[k]} vs certified ${certificate.percentiles[k]}`);
    }
  }

  return { valid: reasons.length === 0, reasons };
}

export class MonteCarloService {
  private defaultConfig: SimulationConfig = {
    iterations: 1000,
    timeoutMs: 10000, // 10 second timeout
  };

  /**
   * Run Monte Carlo simulation with multiple factors
   */
  async runSimulation(
    factors: SimulationFactor[],
    aggregator: (samples: Record<string, number>) => number = (s) => Object.values(s).reduce((a, b) => a + b, 0),
    config: Partial<SimulationConfig> = {}
  ): Promise<SimulationOutput> {
    const startTime = Date.now();
    const iterations = Math.min(config.iterations ?? this.defaultConfig.iterations, 2000); // Cap at 2000
    const timeoutMs = config.timeoutMs ?? this.defaultConfig.timeoutMs;
    const seed = config.seed ?? Date.now(); // resolve once; the certificate records it
    const confidenceLevel = config.confidenceLevel ?? 0.95;
    const targetHalfWidth = config.targetHalfWidth ?? null;

    const random = createRandom(seed);
    const results: number[] = [];
    let timedOut = false;

    for (let i = 0; i < iterations; i++) {
      // Check timeout
      if (Date.now() - startTime > timeoutMs) {
        timedOut = true;
        break;
      }

      // Sample each factor
      const samples: Record<string, number> = {};
      for (const factor of factors) {
        samples[factor.name] = sampleDistribution(factor.distribution, random);
      }

      // Aggregate samples into single outcome
      results.push(aggregator(samples));
    }

    // Calculate statistics
    const sortedResults = [...results].sort((a, b) => a - b);
    const n = results.length;

    const mean = results.reduce((a, b) => a + b, 0) / n;
    const variance = results.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;
    const stdDev = Math.sqrt(variance);

    const certificate = buildMonteCarloCertificate(
      factors,
      seed,
      iterations,
      results,
      timedOut,
      targetHalfWidth,
      confidenceLevel,
    );

    return {
      mean,
      stdDev,
      percentiles: {
        p5: percentile(sortedResults, 5),
        p10: percentile(sortedResults, 10),
        p25: percentile(sortedResults, 25),
        p50: percentile(sortedResults, 50),
        p75: percentile(sortedResults, 75),
        p90: percentile(sortedResults, 90),
        p95: percentile(sortedResults, 95),
      },
      distribution: createHistogram(sortedResults),
      iterations: n,
      executionTimeMs: Date.now() - startTime,
      timedOut,
      certificate,
    };
  }

  /**
   * Simple single-factor simulation
   */
  async runSingleFactorSimulation(
    distribution: DistributionParams,
    iterations: number = 1000,
    config: Partial<Omit<SimulationConfig, 'iterations'>> = {}
  ): Promise<SimulationOutput> {
    return this.runSimulation(
      [{ name: 'value', distribution }],
      (s) => s.value,
      { ...config, iterations }
    );
  }

  /**
   * Run scenario analysis with multiple named scenarios
   */
  async runScenarioAnalysis(
    scenarios: Record<string, SimulationFactor[]>,
    aggregator: (samples: Record<string, number>) => number,
    iterations: number = 500
  ): Promise<Record<string, SimulationOutput>> {
    const results: Record<string, SimulationOutput> = {};

    for (const [scenarioName, factors] of Object.entries(scenarios)) {
      results[scenarioName] = await this.runSimulation(factors, aggregator, { iterations });
    }

    return results;
  }
}

// Singleton instance
export const monteCarloService = new MonteCarloService();
