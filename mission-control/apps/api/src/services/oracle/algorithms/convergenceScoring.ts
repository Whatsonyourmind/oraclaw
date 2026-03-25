// Enhanced Convergence Scoring — ported from OS Multi Science ICM framework
// Computes multi-source agreement for prediction market forecasts
// Uses Hellinger distance, entropy-based uncertainty, and sigmoid aggregation

export interface PredictionSource {
  id: string;
  name: string;
  probability: number; // 0-1 for binary, array for multi-outcome
  confidence?: number;
  volume?: number;
  lastUpdated: number; // Unix timestamp
}

export interface ConvergenceResult {
  score: number; // 0-1, higher = more convergence
  components: {
    agreement: number; // A: pairwise agreement between sources
    direction: number; // D: how strongly sources agree on direction
    uncertainty: number; // U: inverse of average uncertainty
    freshness: number; // F: recency-weighted score
  };
  weights: { wA: number; wD: number; wU: number; wF: number };
  details: {
    pairwiseDistances: Array<{ source1: string; source2: string; distance: number }>;
    outlierSources: string[];
    consensusProbability: number;
    spreadBps: number;
  };
}

export interface ConvergenceConfig {
  wA?: number; // Agreement weight (default 1.0)
  wD?: number; // Direction weight (default 0.8)
  wU?: number; // Uncertainty weight (default 0.7)
  wF?: number; // Freshness weight (default 0.5)
  scale?: number; // Sigmoid scale (default 6.0)
  shift?: number; // Sigmoid shift (default 0.5)
  freshnessHalfLifeMs?: number; // How fast freshness decays (default 1 hour)
  outlierThreshold?: number; // Hellinger distance for outlier detection (default 0.3)
}

const DEFAULTS: Required<ConvergenceConfig> = {
  wA: 1.0,
  wD: 0.8,
  wU: 0.7,
  wF: 0.5,
  scale: 6.0,
  shift: 0.5,
  freshnessHalfLifeMs: 3600_000,
  outlierThreshold: 0.3,
};

// ── Distance Metrics ─────────────────────────────────────

function hellingerDistance(p: number, q: number): number {
  const sp = Math.sqrt(Math.max(0, p));
  const sq = Math.sqrt(Math.max(0, q));
  const sp2 = Math.sqrt(Math.max(0, 1 - p));
  const sq2 = Math.sqrt(Math.max(0, 1 - q));
  return Math.sqrt(0.5 * ((sp - sq) ** 2 + (sp2 - sq2) ** 2));
}

function jensenShannonDistance(p: number, q: number): number {
  const eps = 1e-12;
  const m1 = (p + q) / 2;
  const m2 = ((1 - p) + (1 - q)) / 2;
  const kl1 = p > eps ? p * Math.log(p / (m1 + eps)) : 0;
  const kl2 = (1 - p) > eps ? (1 - p) * Math.log((1 - p) / (m2 + eps)) : 0;
  const kl3 = q > eps ? q * Math.log(q / (m1 + eps)) : 0;
  const kl4 = (1 - q) > eps ? (1 - q) * Math.log((1 - q) / (m2 + eps)) : 0;
  return Math.sqrt(Math.max(0, 0.5 * (kl1 + kl2 + kl3 + kl4)));
}

function binaryEntropy(p: number): number {
  const eps = 1e-12;
  const pc = Math.max(eps, Math.min(1 - eps, p));
  return -(pc * Math.log2(pc) + (1 - pc) * Math.log2(1 - pc));
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

// ── Agreement (A) ────────────────────────────────────────

function computeAgreement(
  sources: PredictionSource[],
): { agreement: number; pairwiseDistances: Array<{ source1: string; source2: string; distance: number }> } {
  if (sources.length < 2) return { agreement: 1, pairwiseDistances: [] };

  const pairwiseDistances: Array<{ source1: string; source2: string; distance: number }> = [];
  let totalDistance = 0;
  let count = 0;

  for (let i = 0; i < sources.length; i++) {
    for (let j = i + 1; j < sources.length; j++) {
      const d = hellingerDistance(sources[i]!.probability, sources[j]!.probability);
      pairwiseDistances.push({
        source1: sources[i]!.id,
        source2: sources[j]!.id,
        distance: d,
      });
      totalDistance += d;
      count++;
    }
  }

  const meanDistance = totalDistance / count;
  // Hellinger distance is bounded [0, 1], so agreement = 1 - mean distance
  const agreement = Math.max(0, Math.min(1, 1 - meanDistance));

  return { agreement, pairwiseDistances };
}

// ── Direction (D) ────────────────────────────────────────

function computeDirection(sources: PredictionSource[]): number {
  if (sources.length < 2) return 1;

  // What fraction of sources agree on >50% vs <50%?
  const above = sources.filter((s) => s.probability > 0.5).length;
  const below = sources.filter((s) => s.probability < 0.5).length;
  const total = sources.length;

  // Direction = how lopsided the vote is (1 = unanimous, 0 = split)
  const maxAgree = Math.max(above, below);
  return maxAgree / total;
}

// ── Uncertainty (U) ──────────────────────────────────────

function computeUncertainty(sources: PredictionSource[]): number {
  if (sources.length === 0) return 0;

  // Average binary entropy of all sources, inverted
  // Low entropy = high certainty = high U score
  let totalEntropy = 0;
  for (const source of sources) {
    totalEntropy += binaryEntropy(source.probability);
  }

  const meanEntropy = totalEntropy / sources.length;
  // Binary entropy max = 1.0 (at p=0.5), so U = 1 - mean_entropy
  return Math.max(0, Math.min(1, 1 - meanEntropy));
}

// ── Freshness (F) ────────────────────────────────────────

function computeFreshness(sources: PredictionSource[], halfLifeMs: number): number {
  if (sources.length === 0) return 0;

  const now = Date.now();
  let totalFreshness = 0;

  for (const source of sources) {
    const ageMs = Math.max(0, now - source.lastUpdated);
    // Exponential decay: freshness = 2^(-age / halfLife)
    const f = Math.pow(2, -ageMs / halfLifeMs);
    totalFreshness += f;
  }

  return totalFreshness / sources.length;
}

// ── Outlier Detection ────────────────────────────────────

function detectOutliers(
  sources: PredictionSource[],
  threshold: number,
): string[] {
  if (sources.length < 3) return [];

  // Consensus = volume-weighted average
  const totalVol = sources.reduce((s, src) => s + (src.volume ?? 1), 0);
  const consensus = sources.reduce(
    (s, src) => s + src.probability * ((src.volume ?? 1) / totalVol),
    0,
  );

  return sources
    .filter((s) => hellingerDistance(s.probability, consensus) > threshold)
    .map((s) => s.id);
}

// ── Main Scoring Function ────────────────────────────────

export function computeConvergence(
  sources: PredictionSource[],
  config: ConvergenceConfig = {},
): ConvergenceResult {
  const cfg = { ...DEFAULTS, ...config };

  if (sources.length === 0) {
    return {
      score: 0,
      components: { agreement: 0, direction: 0, uncertainty: 0, freshness: 0 },
      weights: { wA: cfg.wA, wD: cfg.wD, wU: cfg.wU, wF: cfg.wF },
      details: { pairwiseDistances: [], outlierSources: [], consensusProbability: 0.5, spreadBps: 0 },
    };
  }

  const { agreement, pairwiseDistances } = computeAgreement(sources);
  const direction = computeDirection(sources);
  const uncertainty = computeUncertainty(sources);
  const freshness = computeFreshness(sources, cfg.freshnessHalfLifeMs);

  // Sigmoid aggregation (from OS Multi Science ICM framework)
  const zRaw = cfg.wA * agreement + cfg.wD * direction + cfg.wU * uncertainty + cfg.wF * freshness;
  const totalWeight = cfg.wA + cfg.wD + cfg.wU + cfg.wF;
  const zNorm = zRaw / totalWeight; // Normalize to [0, 1] range
  const z = cfg.scale * (zNorm - cfg.shift);
  const score = sigmoid(z);

  // Compute consensus and spread
  const totalVol = sources.reduce((s, src) => s + (src.volume ?? 1), 0);
  const consensusProbability = sources.reduce(
    (s, src) => s + src.probability * ((src.volume ?? 1) / totalVol),
    0,
  );
  const probs = sources.map((s) => s.probability);
  const spreadBps = Math.round((Math.max(...probs) - Math.min(...probs)) * 10000);

  return {
    score,
    components: { agreement, direction, uncertainty, freshness },
    weights: { wA: cfg.wA, wD: cfg.wD, wU: cfg.wU, wF: cfg.wF },
    details: {
      pairwiseDistances,
      outlierSources: detectOutliers(sources, cfg.outlierThreshold),
      consensusProbability,
      spreadBps,
    },
  };
}

// ── Calibration Metrics ──────────────────────────────────

export function brierScore(predictions: number[], outcomes: number[]): number {
  if (predictions.length !== outcomes.length || predictions.length === 0) return 1;
  let sum = 0;
  for (let i = 0; i < predictions.length; i++) {
    sum += (predictions[i]! - outcomes[i]!) ** 2;
  }
  return sum / predictions.length;
}

export function logScore(predictions: number[], outcomes: number[]): number {
  if (predictions.length !== outcomes.length || predictions.length === 0) return Infinity;
  const eps = 1e-15;
  let sum = 0;
  for (let i = 0; i < predictions.length; i++) {
    const p = Math.max(eps, Math.min(1 - eps, predictions[i]!));
    const y = outcomes[i]!;
    sum += y * Math.log(p) + (1 - y) * Math.log(1 - p);
  }
  return -sum / predictions.length;
}

// ── Anomaly Score (bridges convergence + anomaly detection) ──

/** Result of the combined anomaly-convergence scoring */
export interface AnomalyScoreResult {
  /** Anomaly score 0-1, higher = more anomalous (based on z-score of values) */
  anomalyScore: number;
  /** Convergence score 0-1, higher = more agreement among sources */
  convergenceScore: number;
  /** Combined score: high anomaly + low convergence = flagged */
  combined: number;
  /** Whether the combined score exceeds the flagging threshold */
  flagged: boolean;
}

/**
 * Compute a combined anomaly + convergence score.
 *
 * Bridges the convergence scoring module with anomaly detection by:
 *   1. Computing the convergence score across prediction sources
 *   2. Computing an anomaly score from the raw values array using z-scores
 *   3. Combining them: combined = anomalyScore * (1 - convergenceScore)
 *      High combined = values are anomalous AND sources disagree
 *
 * @param values  - Raw signal values to check for anomalies
 * @param sources - Prediction sources for convergence assessment
 * @param flagThreshold - Combined score above which result is flagged (default 0.5)
 * @returns AnomalyScoreResult with individual and combined scores
 *
 * O(n^2) where n = number of sources (due to pairwise convergence)
 */
export function computeAnomalyScore(
  values: number[],
  sources: PredictionSource[],
  flagThreshold: number = 0.5,
): AnomalyScoreResult {
  // ── Convergence score from sources
  const convergenceResult = computeConvergence(sources);
  const convergenceScore = convergenceResult.score;

  // ── Anomaly score from values using z-score approach
  let anomalyScore = 0;

  if (values.length >= 2) {
    // Compute mean and std of values
    let sum = 0;
    for (let i = 0; i < values.length; i++) sum += values[i]!;
    const mu = sum / values.length;

    let ss = 0;
    for (let i = 0; i < values.length; i++) {
      const d = values[i]! - mu;
      ss += d * d;
    }
    const sigma = Math.sqrt(ss / (values.length - 1));

    if (sigma > 0) {
      // Max absolute z-score across all values, normalised via sigmoid to [0,1]
      let maxZ = 0;
      for (let i = 0; i < values.length; i++) {
        const z = Math.abs((values[i]! - mu) / sigma);
        if (z > maxZ) maxZ = z;
      }
      // Sigmoid mapping: z=0 -> 0.27, z=2 -> 0.73, z=3 -> 0.88, z=5 -> 0.97
      anomalyScore = 1 / (1 + Math.exp(-(maxZ - 1.5)));
    }
  } else if (values.length === 1) {
    // Single value — cannot assess anomaly statistically
    anomalyScore = 0;
  }

  // ── Combined: high anomaly + low convergence = highest concern
  const combined = anomalyScore * (1 - convergenceScore);

  return {
    anomalyScore,
    convergenceScore,
    combined,
    flagged: combined > flagThreshold,
  };
}

export { hellingerDistance, jensenShannonDistance, binaryEntropy };
