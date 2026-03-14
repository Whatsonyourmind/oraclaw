/**
 * Probability Engine Service Unit Tests
 * Story post-14 - Tests for Bayesian probability engine
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ProbabilityEngineService,
  PredictionFactor,
  BayesianPrior,
  CalibrationState,
} from './probability';

describe('ProbabilityEngineService', () => {
  let service: ProbabilityEngineService;

  beforeEach(() => {
    service = new ProbabilityEngineService();
  });

  // ==========================================
  // Bayesian Update Tests
  // ==========================================

  describe('Bayesian Update', () => {
    it('should increase alpha on success', () => {
      const prior: BayesianPrior = { alpha: 5, beta: 5 };
      const posterior = service.bayesianUpdate(prior, true);

      expect(posterior.alpha).toBe(6);
      expect(posterior.beta).toBe(5);
    });

    it('should increase beta on failure', () => {
      const prior: BayesianPrior = { alpha: 5, beta: 5 };
      const posterior = service.bayesianUpdate(prior, false);

      expect(posterior.alpha).toBe(5);
      expect(posterior.beta).toBe(6);
    });

    it('should shift posterior mean towards 1 on success', () => {
      const prior: BayesianPrior = { alpha: 5, beta: 5 };
      const priorMean = service.getPosteriorMean(prior);

      const posterior = service.bayesianUpdate(prior, true);
      const posteriorMean = service.getPosteriorMean(posterior);

      expect(posteriorMean).toBeGreaterThan(priorMean);
    });

    it('should shift posterior mean towards 0 on failure', () => {
      const prior: BayesianPrior = { alpha: 5, beta: 5 };
      const priorMean = service.getPosteriorMean(prior);

      const posterior = service.bayesianUpdate(prior, false);
      const posteriorMean = service.getPosteriorMean(posterior);

      expect(posteriorMean).toBeLessThan(priorMean);
    });

    it('should handle uniform prior (alpha=1, beta=1)', () => {
      const prior: BayesianPrior = { alpha: 1, beta: 1 };

      expect(service.getPosteriorMean(prior)).toBe(0.5);

      const afterSuccess = service.bayesianUpdate(prior, true);
      expect(service.getPosteriorMean(afterSuccess)).toBeCloseTo(2 / 3, 5);
    });

    it('should converge with many observations', () => {
      let prior: BayesianPrior = { alpha: 1, beta: 1 };

      // 80 successes, 20 failures = 80% true rate
      for (let i = 0; i < 80; i++) {
        prior = service.bayesianUpdate(prior, true);
      }
      for (let i = 0; i < 20; i++) {
        prior = service.bayesianUpdate(prior, false);
      }

      // Posterior should be close to 0.8
      expect(service.getPosteriorMean(prior)).toBeCloseTo(0.8, 1);
    });
  });

  // ==========================================
  // Posterior Statistics Tests
  // ==========================================

  describe('Posterior Statistics', () => {
    it('should calculate correct posterior mean', () => {
      const prior: BayesianPrior = { alpha: 3, beta: 7 };
      // Mean = alpha / (alpha + beta) = 3 / 10 = 0.3
      expect(service.getPosteriorMean(prior)).toBe(0.3);
    });

    it('should calculate correct posterior variance', () => {
      const prior: BayesianPrior = { alpha: 3, beta: 7 };
      // Variance = (α * β) / ((α+β)² * (α+β+1))
      // = (3 * 7) / (10² * 11) = 21 / 1100 ≈ 0.0191
      const expectedVariance = (3 * 7) / (10 * 10 * 11);
      expect(service.getPosteriorVariance(prior)).toBeCloseTo(expectedVariance, 6);
    });

    it('should decrease variance with more observations', () => {
      const prior1: BayesianPrior = { alpha: 2, beta: 2 };
      const prior2: BayesianPrior = { alpha: 20, beta: 20 };

      const var1 = service.getPosteriorVariance(prior1);
      const var2 = service.getPosteriorVariance(prior2);

      expect(var2).toBeLessThan(var1);
    });
  });

  // ==========================================
  // Time Decay Tests
  // ==========================================

  describe('Confidence Time Decay', () => {
    it('should decay confidence over time', () => {
      const initialConfidence = 0.9;
      const decayRate = 0.1;

      const decayed = service.applyTimeDecay(initialConfidence, decayRate, 1);
      expect(decayed).toBeLessThan(initialConfidence);
    });

    it('should decay towards 0.5 (maximum uncertainty)', () => {
      const initialConfidence = 0.9;
      const decayRate = 0.5;

      // With large time, should approach 0.5
      const decayed = service.applyTimeDecay(initialConfidence, decayRate, 100);
      expect(decayed).toBeCloseTo(0.5, 1);
    });

    it('should not change with zero decay rate', () => {
      const initialConfidence = 0.8;
      const decayed = service.applyTimeDecay(initialConfidence, 0, 10);
      expect(decayed).toBe(initialConfidence);
    });

    it('should not change at time zero', () => {
      const initialConfidence = 0.75;
      const decayed = service.applyTimeDecay(initialConfidence, 0.5, 0);
      expect(decayed).toBe(initialConfidence);
    });

    it('should handle low confidence decaying towards 0.5', () => {
      const initialConfidence = 0.2;
      const decayRate = 0.5;

      // Low confidence should increase towards 0.5
      const decayed = service.applyTimeDecay(initialConfidence, decayRate, 10);
      expect(decayed).toBeGreaterThan(initialConfidence);
      expect(decayed).toBeLessThanOrEqual(0.5);
    });
  });

  // ==========================================
  // Brier Score Tests
  // ==========================================

  describe('Brier Score Calculation', () => {
    it('should return 0 for perfect predictions', () => {
      const predictions = [
        { forecast: 1.0, outcome: true },
        { forecast: 0.0, outcome: false },
        { forecast: 1.0, outcome: true },
      ];

      const brier = service.calculateBrierScore(predictions);
      expect(brier).toBe(0);
    });

    it('should return 1 for perfectly wrong predictions', () => {
      const predictions = [
        { forecast: 0.0, outcome: true },
        { forecast: 1.0, outcome: false },
      ];

      const brier = service.calculateBrierScore(predictions);
      expect(brier).toBe(1);
    });

    it('should return 0.25 for always predicting 0.5', () => {
      // If you always predict 0.5, regardless of outcome:
      // (0.5 - 1)² = 0.25 when true
      // (0.5 - 0)² = 0.25 when false
      const predictions = [
        { forecast: 0.5, outcome: true },
        { forecast: 0.5, outcome: false },
      ];

      const brier = service.calculateBrierScore(predictions);
      expect(brier).toBe(0.25);
    });

    it('should return 0.25 default for empty predictions', () => {
      const brier = service.calculateBrierScore([]);
      expect(brier).toBe(0.25);
    });

    it('should calculate correctly for mixed predictions', () => {
      const predictions = [
        { forecast: 0.8, outcome: true }, // (0.8 - 1)² = 0.04
        { forecast: 0.3, outcome: false }, // (0.3 - 0)² = 0.09
      ];

      const expected = (0.04 + 0.09) / 2;
      const brier = service.calculateBrierScore(predictions);
      expect(brier).toBeCloseTo(expected, 6);
    });
  });

  // ==========================================
  // Calibration Bucket Tests
  // ==========================================

  describe('Calibration Bucket Updates', () => {
    it('should initialize with empty buckets', () => {
      const state = service.initializeCalibration();

      expect(state.brierScore).toBe(0);
      expect(state.totalPredictions).toBe(0);
      expect(state.resolvedPredictions).toBe(0);
      expect(Object.keys(state.buckets)).toHaveLength(10);
    });

    it('should have all 10 calibration buckets', () => {
      const state = service.initializeCalibration();

      const expectedBuckets = [
        '0-10', '10-20', '20-30', '30-40', '40-50',
        '50-60', '60-70', '70-80', '80-90', '90-100',
      ];

      for (const bucket of expectedBuckets) {
        expect(state.buckets[bucket]).toBeDefined();
        expect(state.buckets[bucket].predictions).toBe(0);
        expect(state.buckets[bucket].correct).toBe(0);
      }
    });

    it('should update correct bucket on prediction resolution', () => {
      let state = service.initializeCalibration();

      // Prediction of 0.75 should go in 70-80 bucket
      state = service.updateCalibration(state, {
        forecast: 0.75,
        outcome: true,
      });

      expect(state.buckets['70-80'].predictions).toBe(1);
      expect(state.buckets['70-80'].correct).toBe(1);
      expect(state.buckets['70-80'].accuracy).toBe(1);
    });

    it('should track accuracy per bucket', () => {
      let state = service.initializeCalibration();

      // Add 3 predictions to 60-70 bucket: 2 correct, 1 wrong
      state = service.updateCalibration(state, { forecast: 0.65, outcome: true });
      state = service.updateCalibration(state, { forecast: 0.68, outcome: true });
      state = service.updateCalibration(state, { forecast: 0.62, outcome: false });

      expect(state.buckets['60-70'].predictions).toBe(3);
      expect(state.buckets['60-70'].correct).toBe(2);
      expect(state.buckets['60-70'].accuracy).toBeCloseTo(2 / 3, 6);
    });

    it('should increment resolved predictions count', () => {
      let state = service.initializeCalibration();

      state = service.updateCalibration(state, { forecast: 0.5, outcome: true });
      expect(state.resolvedPredictions).toBe(1);

      state = service.updateCalibration(state, { forecast: 0.5, outcome: false });
      expect(state.resolvedPredictions).toBe(2);
    });

    it('should update Brier score incrementally', () => {
      let state = service.initializeCalibration();

      // First prediction: 0.8 forecast, true outcome
      state = service.updateCalibration(state, { forecast: 0.8, outcome: true });
      const firstError = Math.pow(0.8 - 1, 2); // 0.04
      expect(state.brierScore).toBeCloseTo(firstError, 6);

      // Second prediction: 0.3 forecast, false outcome
      state = service.updateCalibration(state, { forecast: 0.3, outcome: false });
      const secondError = Math.pow(0.3 - 0, 2); // 0.09
      const expectedBrier = (firstError + secondError) / 2;
      expect(state.brierScore).toBeCloseTo(expectedBrier, 6);
    });
  });

  // ==========================================
  // Multi-Factor Weighting Tests
  // ==========================================

  describe('Multi-Factor Weighting', () => {
    it('should return 0.5 for empty factors', () => {
      const result = service.generatePrediction([]);
      expect(result.confidence).toBe(0.5);
    });

    it('should weight factors by their weights', () => {
      const factors: PredictionFactor[] = [
        { name: 'high_weight', value: 0.9, weight: 3, direction: 'positive' },
        { name: 'low_weight', value: 0.1, weight: 1, direction: 'positive' },
      ];

      const result = service.generatePrediction(factors);
      // Weighted average: (0.9*3 + 0.1*1) / (3+1) = 2.8/4 = 0.7
      expect(result.confidence).toBeCloseTo(0.7, 1);
    });

    it('should handle negative direction factors', () => {
      // Negative direction inverts the value: uses (1 - value)
      const factors: PredictionFactor[] = [
        { name: 'factor', value: 0.8, weight: 1, direction: 'negative' },
      ];

      const result = service.generatePrediction(factors);
      // Negative: uses (1 - 0.8) = 0.2
      expect(result.confidence).toBeCloseTo(0.2, 1);
    });

    it('should handle neutral direction factors', () => {
      const factors: PredictionFactor[] = [
        { name: 'factor', value: 0.9, weight: 1, direction: 'neutral' },
      ];

      const result = service.generatePrediction(factors);
      // Neutral always contributes 0.5
      expect(result.confidence).toBe(0.5);
    });

    it('should incorporate Bayesian prior', () => {
      const factors: PredictionFactor[] = [
        { name: 'factor', value: 0.6, weight: 1, direction: 'positive' },
      ];

      // Strong prior with high success rate
      const strongPrior: BayesianPrior = { alpha: 15, beta: 5 }; // Mean = 0.75

      const withoutPrior = service.generatePrediction(factors);
      const withPrior = service.generatePrediction(factors, strongPrior);

      // With strong prior of 0.75, result should be pulled up from 0.6
      expect(withPrior.confidence).toBeGreaterThan(withoutPrior.confidence);
    });

    it('should clamp confidence to valid range', () => {
      const highFactors: PredictionFactor[] = [
        { name: 'factor', value: 1.0, weight: 1, direction: 'positive' },
      ];

      const lowFactors: PredictionFactor[] = [
        { name: 'factor', value: 0.0, weight: 1, direction: 'positive' },
      ];

      const highResult = service.generatePrediction(highFactors);
      const lowResult = service.generatePrediction(lowFactors);

      expect(highResult.confidence).toBeLessThanOrEqual(0.99);
      expect(lowResult.confidence).toBeGreaterThanOrEqual(0.01);
    });

    it('should return all factors in result', () => {
      const factors: PredictionFactor[] = [
        { name: 'f1', value: 0.5, weight: 1, direction: 'positive' },
        { name: 'f2', value: 0.7, weight: 2, direction: 'negative' },
      ];

      const result = service.generatePrediction(factors);
      expect(result.factors).toHaveLength(2);
      expect(result.factors[0].name).toBe('f1');
      expect(result.factors[1].name).toBe('f2');
    });
  });

  // ==========================================
  // Calibration Assessment Tests
  // ==========================================

  describe('Calibration Assessment', () => {
    it('should identify well-calibrated predictions', () => {
      let state = service.initializeCalibration();

      // Add well-calibrated data: 70% bucket has ~70% accuracy
      for (let i = 0; i < 10; i++) {
        state = service.updateCalibration(state, {
          forecast: 0.75,
          outcome: i < 7, // 7 out of 10 correct = 70%
        });
      }

      // Check if well calibrated (within 10% threshold)
      expect(service.isWellCalibrated(state, 0.1)).toBe(true);
    });

    it('should identify overconfident predictions', () => {
      let state = service.initializeCalibration();

      // Add overconfident data: predicting 90% but only 50% correct
      for (let i = 0; i < 20; i++) {
        state = service.updateCalibration(state, {
          forecast: 0.95,
          outcome: i < 10, // Only 50% correct
        });
      }

      // Should not be well calibrated
      expect(service.isWellCalibrated(state, 0.1)).toBe(false);
    });

    it('should return calibration adjustment factor', () => {
      let state = service.initializeCalibration();

      // Overconfident: predicting 80% but only 60% accurate
      for (let i = 0; i < 10; i++) {
        state = service.updateCalibration(state, {
          forecast: 0.85,
          outcome: i < 6, // 60% correct
        });
      }

      const adjustment = service.getCalibrationAdjustment(state, 0.85);
      // Expected 85%, actual 60%, ratio = 60/85 ≈ 0.71
      expect(adjustment).toBeCloseTo(0.6 / 0.85, 1);
    });

    it('should return 1 for insufficient data', () => {
      let state = service.initializeCalibration();

      // Only 2 predictions - below threshold
      state = service.updateCalibration(state, { forecast: 0.75, outcome: true });
      state = service.updateCalibration(state, { forecast: 0.75, outcome: false });

      const adjustment = service.getCalibrationAdjustment(state, 0.75);
      expect(adjustment).toBe(1);
    });
  });

  // ==========================================
  // Edge Cases
  // ==========================================

  describe('Edge Cases', () => {
    it('should handle prediction at bucket boundaries', () => {
      let state = service.initializeCalibration();

      // Exactly 0.7 should go to 70-80 bucket
      state = service.updateCalibration(state, { forecast: 0.7, outcome: true });
      expect(state.buckets['70-80'].predictions).toBe(1);
    });

    it('should handle prediction of exactly 0', () => {
      let state = service.initializeCalibration();

      state = service.updateCalibration(state, { forecast: 0, outcome: false });
      expect(state.buckets['0-10'].predictions).toBe(1);
    });

    it('should handle prediction of exactly 1', () => {
      let state = service.initializeCalibration();

      // 1.0 should be clamped to 90-100 bucket
      state = service.updateCalibration(state, { forecast: 1.0, outcome: true });
      expect(state.buckets['90-100'].predictions).toBe(1);
    });

    it('should handle very small prior sample size', () => {
      const prior: BayesianPrior = { alpha: 1, beta: 1 };
      const factors: PredictionFactor[] = [
        { name: 'factor', value: 0.8, weight: 1, direction: 'positive' },
      ];

      // With small prior, factor evidence should dominate
      const result = service.generatePrediction(factors, prior);
      expect(result.confidence).toBeCloseTo(0.75, 1); // Slightly influenced by prior
    });

    it('should handle very large prior sample size', () => {
      const prior: BayesianPrior = { alpha: 50, beta: 50 }; // Strong prior at 0.5
      const factors: PredictionFactor[] = [
        { name: 'factor', value: 0.9, weight: 1, direction: 'positive' },
      ];

      // With strong prior at 0.5, result should be pulled towards 0.5
      const result = service.generatePrediction(factors, prior);
      expect(result.confidence).toBeLessThan(0.9);
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should handle equal weights', () => {
      const factors: PredictionFactor[] = [
        { name: 'f1', value: 0.2, weight: 1, direction: 'positive' },
        { name: 'f2', value: 0.8, weight: 1, direction: 'positive' },
      ];

      const result = service.generatePrediction(factors);
      // Simple average: (0.2 + 0.8) / 2 = 0.5
      expect(result.confidence).toBeCloseTo(0.5, 2);
    });

    it('should handle zero weights gracefully', () => {
      const factors: PredictionFactor[] = [
        { name: 'factor', value: 0.8, weight: 0, direction: 'positive' },
      ];

      const result = service.generatePrediction(factors);
      // Zero weight means no contribution, should default to 0.5
      expect(result.confidence).toBe(0.5);
    });
  });
});
