/**
 * Anomaly Detection
 *
 * Three complementary methods for identifying outliers in numeric data:
 *   1. Z-Score — parametric, assumes approximate normality
 *   2. IQR (Interquartile Range) — non-parametric, robust to skew
 *   3. StreamingAnomalyDetector — Welford's online algorithm for real-time feeds
 *
 * Uses `simple-statistics` for robust z-score and IQR primitives.
 */

import {
  mean as ssMean,
  standardDeviation as ssStdDev,
  quantile as ssQuantile,
  interquartileRange as ssIQR,
} from "simple-statistics";

// ── Types ────────────────────────────────────────────────

/** Result of a batch z-score anomaly scan */
export interface AnomalyResult {
  /** Detected anomalies with index, value, and z-score */
  anomalies: Array<{ index: number; value: number; zScore: number }>;
  /** Population mean */
  mean: number;
  /** Population standard deviation */
  stdDev: number;
  /** Z-score threshold that was applied */
  threshold: number;
}

/** Result of a batch IQR anomaly scan */
export interface IQRAnomalyResult {
  /** Detected anomalies with index and value */
  anomalies: Array<{ index: number; value: number }>;
  /** First quartile (25th percentile) */
  q1: number;
  /** Third quartile (75th percentile) */
  q3: number;
  /** Interquartile range (q3 - q1) */
  iqr: number;
  /** Lower fence: q1 - k * iqr */
  lowerBound: number;
  /** Upper fence: q3 + k * iqr */
  upperBound: number;
}

/** Single observation result from the streaming detector */
export interface StreamingResult {
  /** Whether this value was flagged as an anomaly */
  isAnomaly: boolean;
  /** Absolute z-score of this observation */
  zScore: number;
  /** The observed value */
  value: number;
  /** Running mean after incorporating this value */
  mean: number;
  /** Running standard deviation after incorporating this value */
  stdDev: number;
}

// ── Z-Score Detector ─────────────────────────────────────

/**
 * Detect anomalies using the z-score method.
 *
 * A data point is an anomaly if its absolute z-score exceeds `threshold`.
 * Default threshold of 3.0 corresponds to ~0.27 % of a normal distribution.
 *
 * @param data      - Numeric observations
 * @param threshold - z-score cutoff (default 3.0)
 * @returns AnomalyResult with flagged indices, mean, stdDev, and threshold
 *
 * O(n) time, O(k) space where k = number of anomalies
 */
export function detectAnomaliesZScore(
  data: number[],
  threshold: number = 3.0,
): AnomalyResult {
  if (data.length < 2) {
    return { anomalies: [], mean: data[0] ?? 0, stdDev: 0, threshold };
  }

  const mu = ssMean(data);
  const sigma = ssStdDev(data);

  if (sigma === 0) {
    return { anomalies: [], mean: mu, stdDev: 0, threshold };
  }

  const anomalies: Array<{ index: number; value: number; zScore: number }> = [];

  for (let i = 0; i < data.length; i++) {
    const z = (data[i]! - mu) / sigma;
    if (Math.abs(z) > threshold) {
      anomalies.push({ index: i, value: data[i]!, zScore: z });
    }
  }

  return { anomalies, mean: mu, stdDev: sigma, threshold };
}

// ── IQR Detector ─────────────────────────────────────────

/**
 * Detect anomalies using the Interquartile Range (IQR) method.
 *
 * Values outside [Q1 - k*IQR, Q3 + k*IQR] are flagged. The default
 * multiplier k = 1.5 flags "mild" outliers; k = 3.0 flags "extreme" outliers.
 *
 * @param data - Numeric observations
 * @param k    - IQR multiplier (default 1.5)
 * @returns IQRAnomalyResult with flagged indices and fence values
 *
 * O(n log n) due to quantile computation, O(k) space
 */
export function detectAnomaliesIQR(
  data: number[],
  k: number = 1.5,
): IQRAnomalyResult {
  if (data.length < 4) {
    const q1 = data.length > 0 ? ssQuantile(data, 0.25) : 0;
    const q3 = data.length > 0 ? ssQuantile(data, 0.75) : 0;
    const iqr = q3 - q1;
    return {
      anomalies: [],
      q1,
      q3,
      iqr,
      lowerBound: q1 - k * iqr,
      upperBound: q3 + k * iqr,
    };
  }

  const q1 = ssQuantile(data, 0.25);
  const q3 = ssQuantile(data, 0.75);
  const iqr = ssIQR(data);
  const lowerBound = q1 - k * iqr;
  const upperBound = q3 + k * iqr;

  const anomalies: Array<{ index: number; value: number }> = [];

  for (let i = 0; i < data.length; i++) {
    if (data[i]! < lowerBound || data[i]! > upperBound) {
      anomalies.push({ index: i, value: data[i]! });
    }
  }

  return { anomalies, q1, q3, iqr, lowerBound, upperBound };
}

// ── Streaming Anomaly Detector (Welford) ─────────────────

/**
 * Real-time anomaly detector using Welford's online algorithm.
 *
 * Maintains running mean and variance incrementally without storing the full
 * data history. Each call to `update()` ingests one new observation and
 * returns whether it is anomalous relative to the distribution seen so far.
 *
 * Welford's algorithm is numerically stable for computing online variance:
 *   - M1(n) = M1(n-1) + (x - M1(n-1)) / n
 *   - M2(n) = M2(n-1) + (x - M1(n-1)) * (x - M1(n))
 *   - variance = M2(n) / (n - 1)
 *
 * O(1) time and O(1) space per update.
 */
export class StreamingAnomalyDetector {
  /** Z-score threshold for anomaly flagging */
  private readonly threshold: number;

  /** Number of observations ingested */
  private count: number = 0;

  /** Running mean (M1) */
  private m1: number = 0;

  /** Running sum of squared deviations (M2) */
  private m2: number = 0;

  /** Minimum observations before anomaly detection activates */
  private readonly warmup: number;

  /**
   * Create a new streaming anomaly detector.
   *
   * @param threshold - z-score cutoff for anomaly flagging (default 3.0)
   * @param warmup    - Observations to collect before flagging starts (default 10)
   */
  constructor(threshold: number = 3.0, warmup: number = 10) {
    this.threshold = threshold;
    this.warmup = Math.max(2, warmup);
  }

  /**
   * Ingest a new observation and check for anomaly.
   *
   * @param value - The new data point
   * @returns StreamingResult with anomaly flag, z-score, and running statistics
   *
   * O(1) time, O(1) space
   */
  update(value: number): StreamingResult {
    this.count++;

    if (this.count === 1) {
      this.m1 = value;
      this.m2 = 0;
      return {
        isAnomaly: false,
        zScore: 0,
        value,
        mean: this.m1,
        stdDev: 0,
      };
    }

    // Welford's incremental update
    const delta = value - this.m1;
    this.m1 += delta / this.count;
    const delta2 = value - this.m1;
    this.m2 += delta * delta2;

    const variance = this.m2 / (this.count - 1);
    const stdDev = Math.sqrt(variance);

    // Compute z-score (only meaningful after warmup)
    const zScore = stdDev > 0 ? Math.abs((value - this.m1) / stdDev) : 0;
    const isAnomaly = this.count >= this.warmup && zScore > this.threshold;

    return {
      isAnomaly,
      zScore,
      value,
      mean: this.m1,
      stdDev,
    };
  }

  /**
   * Get current running statistics without adding a new observation.
   *
   * @returns Current mean, stdDev, and count
   */
  getStats(): { mean: number; stdDev: number; count: number } {
    const variance = this.count > 1 ? this.m2 / (this.count - 1) : 0;
    return {
      mean: this.m1,
      stdDev: Math.sqrt(variance),
      count: this.count,
    };
  }

  /**
   * Reset the detector to its initial state.
   */
  reset(): void {
    this.count = 0;
    this.m1 = 0;
    this.m2 = 0;
  }
}
