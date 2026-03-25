/**
 * Probability Engine Service
 * Story 5.2 - ORACLE Bayesian Prediction Engine
 *
 * Enhanced with proper conjugate posteriors via jstat.
 * Supports Beta-Bernoulli (binary outcomes), credible intervals,
 * and likelihood-based evidence incorporation.
 */

// @ts-expect-error — jstat has no type declarations
import jStat from "jstat";

export interface PredictionFactor {
  name: string;
  value: number;
  weight: number;
  direction: 'positive' | 'negative' | 'neutral';
}

export interface BayesianPrior {
  alpha: number; // Successes + 1
  beta: number; // Failures + 1
}

export interface CalibrationBucket {
  predictions: number;
  correct: number;
  accuracy: number;
}

export interface CalibrationState {
  brierScore: number;
  buckets: Record<string, CalibrationBucket>;
  totalPredictions: number;
  resolvedPredictions: number;
}

export interface PredictionResult {
  confidence: number;
  factors: PredictionFactor[];
  prior: BayesianPrior;
  decayedConfidence?: number;
}

export class ProbabilityEngineService {
  /**
   * Generate prediction with multi-factor weighting
   * Combines multiple factors into a single confidence score
   */
  generatePrediction(factors: PredictionFactor[], prior?: BayesianPrior): PredictionResult {
    if (factors.length === 0) {
      return {
        confidence: 0.5,
        factors: [],
        prior: prior || { alpha: 1, beta: 1 },
      };
    }

    // Calculate weighted sum of factor contributions
    let totalWeight = 0;
    let weightedSum = 0;

    for (const factor of factors) {
      const contribution = factor.direction === 'positive'
        ? factor.value * factor.weight
        : factor.direction === 'negative'
          ? (1 - factor.value) * factor.weight
          : 0.5 * factor.weight;

      weightedSum += contribution;
      totalWeight += factor.weight;
    }

    // Base confidence from factors
    let confidence = totalWeight > 0 ? weightedSum / totalWeight : 0.5;

    // Apply Bayesian prior if provided
    if (prior) {
      // Combine with prior using Beta distribution mean
      const priorMean = prior.alpha / (prior.alpha + prior.beta);
      const priorStrength = prior.alpha + prior.beta;

      // Weight prior based on sample size (more samples = stronger prior influence)
      const priorWeight = Math.min(priorStrength / 20, 0.5); // Max 50% prior influence
      confidence = confidence * (1 - priorWeight) + priorMean * priorWeight;
    }

    // Clamp to valid probability range
    confidence = Math.max(0.01, Math.min(0.99, confidence));

    return {
      confidence,
      factors,
      prior: prior || { alpha: 1, beta: 1 },
    };
  }

  /**
   * Bayesian update: P(H|E) = P(E|H) * P(H) / P(E)
   * For Beta-Bernoulli: Beta(α, β) → Beta(α + successes, β + failures)
   */
  bayesianUpdate(prior: BayesianPrior, outcome: boolean): BayesianPrior {
    return {
      alpha: prior.alpha + (outcome ? 1 : 0),
      beta: prior.beta + (outcome ? 0 : 1),
    };
  }

  /**
   * Get posterior mean from Beta distribution
   * E[Beta(α, β)] = α / (α + β)
   */
  getPosteriorMean(prior: BayesianPrior): number {
    return prior.alpha / (prior.alpha + prior.beta);
  }

  /**
   * Get posterior variance from Beta distribution
   * Var[Beta(α, β)] = αβ / ((α+β)²(α+β+1))
   */
  getPosteriorVariance(prior: BayesianPrior): number {
    const { alpha, beta } = prior;
    const sum = alpha + beta;
    return (alpha * beta) / (sum * sum * (sum + 1));
  }

  /**
   * Time-based decay: P(t) = P₀ * e^(-λt)
   * @param initialConfidence P₀
   * @param decayRate λ (lambda) - rate of decay
   * @param timeElapsed t - time elapsed (in same units as decay rate)
   */
  applyTimeDecay(initialConfidence: number, decayRate: number, timeElapsed: number): number {
    const decayedConfidence = initialConfidence * Math.exp(-decayRate * timeElapsed);
    // Decay towards 0.5 (maximum uncertainty) rather than 0
    const uncertainty = 0.5;
    const decayFactor = Math.exp(-decayRate * timeElapsed);
    return uncertainty + (initialConfidence - uncertainty) * decayFactor;
  }

  /**
   * Calculate Brier score for calibration
   * Brier = (1/N) * Σ(forecast - outcome)²
   * Lower is better (0 = perfect, 1 = worst)
   */
  calculateBrierScore(predictions: Array<{ forecast: number; outcome: boolean }>): number {
    if (predictions.length === 0) return 0.25; // Default for no data

    const sumSquaredErrors = predictions.reduce((sum, p) => {
      const outcome = p.outcome ? 1 : 0;
      return sum + Math.pow(p.forecast - outcome, 2);
    }, 0);

    return sumSquaredErrors / predictions.length;
  }

  /**
   * Update calibration state with new prediction outcome
   */
  updateCalibration(
    state: CalibrationState,
    prediction: { forecast: number; outcome: boolean }
  ): CalibrationState {
    // Determine which bucket this prediction falls into
    const bucketKey = this.getBucketKey(prediction.forecast);

    // Update bucket
    const bucket = state.buckets[bucketKey] || { predictions: 0, correct: 0, accuracy: 0 };
    bucket.predictions++;
    if (prediction.outcome) {
      bucket.correct++;
    }
    bucket.accuracy = bucket.correct / bucket.predictions;

    const newBuckets = { ...state.buckets, [bucketKey]: bucket };

    // Recalculate Brier score (incrementally)
    const newResolved = state.resolvedPredictions + 1;
    const outcomeValue = prediction.outcome ? 1 : 0;
    const squaredError = Math.pow(prediction.forecast - outcomeValue, 2);

    // Incremental Brier score update
    const newBrierScore =
      (state.brierScore * state.resolvedPredictions + squaredError) / newResolved;

    return {
      brierScore: newBrierScore,
      buckets: newBuckets,
      totalPredictions: state.totalPredictions,
      resolvedPredictions: newResolved,
    };
  }

  /**
   * Get bucket key for a probability (0-10, 10-20, ..., 90-100)
   */
  private getBucketKey(probability: number): string {
    const bucket = Math.floor(probability * 10) * 10;
    const clamped = Math.max(0, Math.min(90, bucket));
    return `${clamped}-${clamped + 10}`;
  }

  /**
   * Initialize empty calibration state
   */
  initializeCalibration(): CalibrationState {
    const buckets: Record<string, CalibrationBucket> = {};
    for (let i = 0; i < 100; i += 10) {
      buckets[`${i}-${i + 10}`] = { predictions: 0, correct: 0, accuracy: 0 };
    }

    return {
      brierScore: 0,
      buckets,
      totalPredictions: 0,
      resolvedPredictions: 0,
    };
  }

  /**
   * Check if predictions are well-calibrated
   * Compares predicted probabilities to actual frequencies
   */
  isWellCalibrated(state: CalibrationState, threshold: number = 0.1): boolean {
    for (const [bucketKey, bucket] of Object.entries(state.buckets)) {
      if (bucket.predictions < 10) continue; // Skip buckets with too few samples

      // Expected accuracy is the midpoint of the bucket
      const [low, high] = bucketKey.split('-').map(Number);
      const expected = (low + high) / 200; // Convert to 0-1 scale

      // Check if actual accuracy is within threshold of expected
      if (Math.abs(bucket.accuracy - expected) > threshold) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get calibration adjustment factor
   * Returns a multiplier to adjust overconfident/underconfident predictions
   */
  getCalibrationAdjustment(state: CalibrationState, confidence: number): number {
    const bucketKey = this.getBucketKey(confidence);
    const bucket = state.buckets[bucketKey];

    if (!bucket || bucket.predictions < 5) {
      return 1; // No adjustment with insufficient data
    }

    // Expected accuracy for this bucket
    const [low, high] = bucketKey.split('-').map(Number);
    const expected = (low + high) / 200;

    // Ratio of actual to expected
    return bucket.accuracy / expected;
  }

  /**
   * Proper Bayesian update with likelihood evidence (jstat-powered).
   * Uses Beta conjugate prior: Beta(α, β) + n successes, m failures → Beta(α+n, β+m)
   * Returns full posterior distribution info.
   */
  bayesianUpdateWithEvidence(
    prior: BayesianPrior,
    successes: number,
    failures: number,
  ): {
    posterior: BayesianPrior;
    mean: number;
    variance: number;
    credibleInterval: { lower: number; upper: number };
    mode: number;
    entropy: number;
  } {
    const posterior: BayesianPrior = {
      alpha: prior.alpha + successes,
      beta: prior.beta + failures,
    };

    const a = posterior.alpha;
    const b = posterior.beta;
    const mean = a / (a + b);
    const variance = (a * b) / ((a + b) * (a + b) * (a + b + 1));

    // 95% credible interval via Beta quantile function (jstat)
    const lower = jStat.beta.inv(0.025, a, b);
    const upper = jStat.beta.inv(0.975, a, b);

    // Mode of Beta distribution (most likely value)
    const mode = a > 1 && b > 1 ? (a - 1) / (a + b - 2) : mean;

    // Differential entropy of Beta distribution
    const lnBeta = jStat.betaln(a, b);
    const entropy = lnBeta - (a - 1) * jStat.digamma(a) - (b - 1) * jStat.digamma(b) + (a + b - 2) * jStat.digamma(a + b);

    return { posterior, mean, variance, credibleInterval: { lower, upper }, mode, entropy };
  }

  /**
   * Likelihood ratio update: P(H|E) ∝ P(E|H) × P(H)
   * For continuous evidence, uses likelihood ratio against alternative hypothesis.
   *
   * @param prior - Current belief (0-1)
   * @param likelihoodIfTrue - P(evidence | hypothesis true)
   * @param likelihoodIfFalse - P(evidence | hypothesis false)
   * @returns Updated posterior probability
   */
  likelihoodRatioUpdate(
    prior: number,
    likelihoodIfTrue: number,
    likelihoodIfFalse: number,
  ): { posterior: number; likelihoodRatio: number; logOdds: number } {
    const priorOdds = prior / (1 - prior);
    const lr = likelihoodIfTrue / Math.max(likelihoodIfFalse, 1e-12);
    const posteriorOdds = priorOdds * lr;
    const posterior = Math.max(0.001, Math.min(0.999, posteriorOdds / (1 + posteriorOdds)));

    return {
      posterior,
      likelihoodRatio: lr,
      logOdds: Math.log(posteriorOdds),
    };
  }

  /**
   * Compute posterior predictive probability.
   * "Given what I've seen so far, what's the probability the next outcome is positive?"
   * For Beta-Bernoulli: P(x=1 | data) = α / (α + β) — which is the posterior mean.
   * But also returns the full predictive uncertainty.
   */
  posteriorPredictive(prior: BayesianPrior): {
    probability: number;
    uncertainty: number;
    credibleInterval: { lower: number; upper: number };
    sampleSize: number;
  } {
    const a = prior.alpha;
    const b = prior.beta;
    const probability = a / (a + b);
    const sampleSize = a + b - 2; // Subtract initial prior (1,1)
    const uncertainty = Math.sqrt((a * b) / ((a + b) * (a + b) * (a + b + 1)));

    return {
      probability,
      uncertainty,
      credibleInterval: {
        lower: jStat.beta.inv(0.025, a, b),
        upper: jStat.beta.inv(0.975, a, b),
      },
      sampleSize: Math.max(0, sampleSize),
    };
  }
}

// Singleton instance
export const probabilityEngineService = new ProbabilityEngineService();
