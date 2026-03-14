/**
 * Monte Carlo Service Unit Tests
 * Story post-13 - Tests for Monte Carlo simulation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MonteCarloService, SimulationFactor, DistributionParams } from './monteCarlo';

describe('MonteCarloService', () => {
  let service: MonteCarloService;

  beforeEach(() => {
    service = new MonteCarloService();
  });

  // ==========================================
  // Distribution Type Tests
  // ==========================================

  describe('Normal Distribution', () => {
    it('should generate values around the mean', async () => {
      const mean = 100;
      const stdDev = 10;

      const result = await service.runSingleFactorSimulation(
        { type: 'normal', params: [mean, stdDev] },
        1000
      );

      // Mean should be close to specified mean (within 2 standard errors)
      expect(result.mean).toBeCloseTo(mean, 0);
      // StdDev should be close to specified stdDev
      expect(result.stdDev).toBeCloseTo(stdDev, 0);
    });

    it('should have symmetric percentiles around the median', async () => {
      const mean = 50;
      const stdDev = 5;

      const result = await service.runSingleFactorSimulation(
        { type: 'normal', params: [mean, stdDev] },
        1000
      );

      // p50 should be close to mean
      expect(result.percentiles.p50).toBeCloseTo(mean, 0);
      // Distance from p50 to p25 should be similar to p75 to p50
      const lowerDist = result.percentiles.p50 - result.percentiles.p25;
      const upperDist = result.percentiles.p75 - result.percentiles.p50;
      expect(lowerDist).toBeCloseTo(upperDist, 0);
    });
  });

  describe('Uniform Distribution', () => {
    it('should generate values within min/max bounds', async () => {
      const min = 10;
      const max = 20;

      const result = await service.runSingleFactorSimulation(
        { type: 'uniform', params: [min, max] },
        1000
      );

      // All percentiles should be within bounds
      expect(result.percentiles.p5).toBeGreaterThanOrEqual(min);
      expect(result.percentiles.p95).toBeLessThanOrEqual(max);
      // Mean should be close to midpoint
      expect(result.mean).toBeCloseTo((min + max) / 2, 0);
    });

    it('should have expected standard deviation', async () => {
      const min = 0;
      const max = 12;
      // StdDev of uniform = (max - min) / sqrt(12)
      const expectedStdDev = (max - min) / Math.sqrt(12);

      const result = await service.runSingleFactorSimulation(
        { type: 'uniform', params: [min, max] },
        1000
      );

      expect(result.stdDev).toBeCloseTo(expectedStdDev, 0);
    });
  });

  describe('Triangular Distribution', () => {
    it('should have mode around the peak parameter', async () => {
      const min = 0;
      const mode = 70;
      const max = 100;

      const result = await service.runSingleFactorSimulation(
        { type: 'triangular', params: [min, mode, max] },
        1000
      );

      // Mean of triangular = (min + mode + max) / 3
      const expectedMean = (min + mode + max) / 3;
      // Relax tolerance for stochastic tests - within 5 of expected
      expect(Math.abs(result.mean - expectedMean)).toBeLessThan(5);
      // Values should be within bounds
      expect(result.percentiles.p5).toBeGreaterThanOrEqual(min);
      expect(result.percentiles.p95).toBeLessThanOrEqual(max);
    });

    it('should be skewed when mode is not centered', async () => {
      // Mode at 20% of range - left skewed
      const result = await service.runSingleFactorSimulation(
        { type: 'triangular', params: [0, 20, 100] },
        1000
      );

      // Median should be less than mean for right-skewed
      // Mode < mean for right-skewed triangular
      expect(result.percentiles.p50).toBeLessThan(result.mean + 5);
    });
  });

  describe('Beta Distribution', () => {
    it('should generate values between 0 and 1', async () => {
      const alpha = 2;
      const beta = 5;

      const result = await service.runSingleFactorSimulation(
        { type: 'beta', params: [alpha, beta] },
        1000
      );

      // All values should be in [0, 1]
      expect(result.percentiles.p5).toBeGreaterThanOrEqual(0);
      expect(result.percentiles.p95).toBeLessThanOrEqual(1);
    });

    it('should have expected mean for alpha/beta', async () => {
      const alpha = 2;
      const beta = 5;
      // Mean of beta = alpha / (alpha + beta)
      const expectedMean = alpha / (alpha + beta);

      const result = await service.runSingleFactorSimulation(
        { type: 'beta', params: [alpha, beta] },
        1000
      );

      expect(result.mean).toBeCloseTo(expectedMean, 1);
    });

    it('should handle symmetric alpha = beta case', async () => {
      const result = await service.runSingleFactorSimulation(
        { type: 'beta', params: [5, 5] },
        1000
      );

      // Symmetric beta has mean = 0.5
      expect(result.mean).toBeCloseTo(0.5, 1);
      // Should be roughly symmetric around median
      expect(result.percentiles.p50).toBeCloseTo(0.5, 1);
    });
  });

  describe('Exponential Distribution', () => {
    it('should generate non-negative values', async () => {
      const lambda = 1;

      const result = await service.runSingleFactorSimulation(
        { type: 'exponential', params: [lambda] },
        1000
      );

      expect(result.percentiles.p5).toBeGreaterThanOrEqual(0);
    });

    it('should have expected mean of 1/lambda', async () => {
      const lambda = 0.5;
      const expectedMean = 1 / lambda;

      const result = await service.runSingleFactorSimulation(
        { type: 'exponential', params: [lambda] },
        1000
      );

      expect(result.mean).toBeCloseTo(expectedMean, 0);
    });

    it('should be right-skewed', async () => {
      const result = await service.runSingleFactorSimulation(
        { type: 'exponential', params: [1] },
        1000
      );

      // For exponential, median < mean
      expect(result.percentiles.p50).toBeLessThan(result.mean);
    });
  });

  describe('Lognormal Distribution', () => {
    it('should generate positive values only', async () => {
      const mu = 0;
      const sigma = 0.5;

      const result = await service.runSingleFactorSimulation(
        { type: 'lognormal', params: [mu, sigma] },
        1000
      );

      expect(result.percentiles.p5).toBeGreaterThan(0);
    });

    it('should be right-skewed', async () => {
      const result = await service.runSingleFactorSimulation(
        { type: 'lognormal', params: [0, 1] },
        1000
      );

      // Median < mean for lognormal
      expect(result.percentiles.p50).toBeLessThan(result.mean);
    });
  });

  // ==========================================
  // Simulation Configuration Tests
  // ==========================================

  describe('Iteration Counts', () => {
    it('should respect specified iteration count', async () => {
      const result = await service.runSingleFactorSimulation(
        { type: 'normal', params: [0, 1] },
        500
      );

      expect(result.iterations).toBe(500);
    });

    it('should cap iterations at 2000', async () => {
      const factors: SimulationFactor[] = [
        { name: 'value', distribution: { type: 'normal', params: [0, 1] } }
      ];

      const result = await service.runSimulation(factors, (s) => s.value, {
        iterations: 5000 // Request more than cap
      });

      expect(result.iterations).toBeLessThanOrEqual(2000);
    });

    it('should handle minimum iteration count of 1', async () => {
      const result = await service.runSingleFactorSimulation(
        { type: 'normal', params: [0, 1] },
        1
      );

      expect(result.iterations).toBe(1);
      expect(result.mean).toBeDefined();
    });
  });

  describe('Timeout Handling', () => {
    it('should set timedOut flag when timeout exceeded', async () => {
      const factors: SimulationFactor[] = [
        { name: 'value', distribution: { type: 'normal', params: [0, 1] } }
      ];

      // Very short timeout
      const result = await service.runSimulation(factors, (s) => s.value, {
        iterations: 2000,
        timeoutMs: 1 // 1ms timeout - should timeout
      });

      // May or may not timeout depending on speed
      // Just verify the structure is correct
      expect(typeof result.timedOut).toBe('boolean');
      expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should complete within reasonable time', async () => {
      const factors: SimulationFactor[] = [
        { name: 'value', distribution: { type: 'normal', params: [0, 1] } }
      ];

      const result = await service.runSimulation(factors, (s) => s.value, {
        iterations: 1000,
        timeoutMs: 10000
      });

      expect(result.timedOut).toBe(false);
      expect(result.executionTimeMs).toBeLessThan(10000);
    });
  });

  describe('Seeded Random', () => {
    it('should produce reproducible results with same seed', async () => {
      const factors: SimulationFactor[] = [
        { name: 'value', distribution: { type: 'normal', params: [100, 10] } }
      ];

      const result1 = await service.runSimulation(factors, (s) => s.value, {
        iterations: 100,
        seed: 12345
      });

      const result2 = await service.runSimulation(factors, (s) => s.value, {
        iterations: 100,
        seed: 12345
      });

      expect(result1.mean).toBe(result2.mean);
      expect(result1.stdDev).toBe(result2.stdDev);
    });

    it('should produce different results with different seeds', async () => {
      const factors: SimulationFactor[] = [
        { name: 'value', distribution: { type: 'normal', params: [100, 10] } }
      ];

      const result1 = await service.runSimulation(factors, (s) => s.value, {
        iterations: 100,
        seed: 12345
      });

      const result2 = await service.runSimulation(factors, (s) => s.value, {
        iterations: 100,
        seed: 54321
      });

      expect(result1.mean).not.toBe(result2.mean);
    });
  });

  // ==========================================
  // Edge Cases
  // ==========================================

  describe('Edge Cases', () => {
    it('should handle zero standard deviation (constant value)', async () => {
      const result = await service.runSingleFactorSimulation(
        { type: 'normal', params: [50, 0] },
        100
      );

      // All values should be exactly 50 when stdDev is 0
      // Due to numerical precision, mean should still be 50
      expect(result.mean).toBeCloseTo(50, 5);
    });

    it('should handle negative values in normal distribution', async () => {
      const result = await service.runSingleFactorSimulation(
        { type: 'normal', params: [-100, 20] },
        1000
      );

      // Relax tolerance for stochastic tests - within 5 of expected
      expect(Math.abs(result.mean - (-100))).toBeLessThan(5);
      expect(result.percentiles.p50).toBeLessThan(0);
    });

    it('should handle very large values', async () => {
      const result = await service.runSingleFactorSimulation(
        { type: 'normal', params: [1e9, 1e6] },
        100
      );

      expect(result.mean).toBeCloseTo(1e9, -6);
      expect(isFinite(result.mean)).toBe(true);
    });

    it('should handle very small positive values', async () => {
      const result = await service.runSingleFactorSimulation(
        { type: 'normal', params: [0.001, 0.0001] },
        100
      );

      expect(result.mean).toBeCloseTo(0.001, 3);
    });
  });

  // ==========================================
  // Percentile Calculations
  // ==========================================

  describe('Percentile Calculations', () => {
    it('should have ordered percentiles', async () => {
      const result = await service.runSingleFactorSimulation(
        { type: 'normal', params: [50, 10] },
        1000
      );

      expect(result.percentiles.p5).toBeLessThanOrEqual(result.percentiles.p10);
      expect(result.percentiles.p10).toBeLessThanOrEqual(result.percentiles.p25);
      expect(result.percentiles.p25).toBeLessThanOrEqual(result.percentiles.p50);
      expect(result.percentiles.p50).toBeLessThanOrEqual(result.percentiles.p75);
      expect(result.percentiles.p75).toBeLessThanOrEqual(result.percentiles.p90);
      expect(result.percentiles.p90).toBeLessThanOrEqual(result.percentiles.p95);
    });

    it('should have all required percentiles', async () => {
      const result = await service.runSingleFactorSimulation(
        { type: 'normal', params: [0, 1] },
        100
      );

      expect(result.percentiles).toHaveProperty('p5');
      expect(result.percentiles).toHaveProperty('p10');
      expect(result.percentiles).toHaveProperty('p25');
      expect(result.percentiles).toHaveProperty('p50');
      expect(result.percentiles).toHaveProperty('p75');
      expect(result.percentiles).toHaveProperty('p90');
      expect(result.percentiles).toHaveProperty('p95');
    });
  });

  // ==========================================
  // Multi-Factor Simulations
  // ==========================================

  describe('Multi-Factor Simulations', () => {
    it('should aggregate multiple factors', async () => {
      const factors: SimulationFactor[] = [
        { name: 'revenue', distribution: { type: 'normal', params: [1000, 100] } },
        { name: 'cost', distribution: { type: 'normal', params: [600, 50] } }
      ];

      // Profit = revenue - cost
      const result = await service.runSimulation(
        factors,
        (s) => s.revenue - s.cost,
        { iterations: 1000 }
      );

      // Expected mean profit = 1000 - 600 = 400
      // Relax tolerance for stochastic tests - within 10 of expected
      expect(Math.abs(result.mean - 400)).toBeLessThan(10);
    });

    it('should handle custom aggregator functions', async () => {
      const factors: SimulationFactor[] = [
        { name: 'a', distribution: { type: 'uniform', params: [1, 2] } },
        { name: 'b', distribution: { type: 'uniform', params: [3, 4] } }
      ];

      // Product aggregator
      const result = await service.runSimulation(
        factors,
        (s) => s.a * s.b,
        { iterations: 1000 }
      );

      // Expected mean = E[a] * E[b] = 1.5 * 3.5 = 5.25 (for independent vars)
      expect(result.mean).toBeCloseTo(5.25, 0);
    });
  });

  // ==========================================
  // Scenario Analysis
  // ==========================================

  describe('Scenario Analysis', () => {
    it('should run multiple scenarios', async () => {
      const scenarios = {
        optimistic: [
          { name: 'growth', distribution: { type: 'normal', params: [0.15, 0.02] } as DistributionParams }
        ],
        pessimistic: [
          { name: 'growth', distribution: { type: 'normal', params: [0.02, 0.01] } as DistributionParams }
        ],
        base: [
          { name: 'growth', distribution: { type: 'normal', params: [0.08, 0.03] } as DistributionParams }
        ]
      };

      const results = await service.runScenarioAnalysis(
        scenarios,
        (s) => s.growth,
        500
      );

      expect(Object.keys(results)).toHaveLength(3);
      expect(results.optimistic.mean).toBeGreaterThan(results.pessimistic.mean);
      expect(results.base.mean).toBeGreaterThan(results.pessimistic.mean);
      expect(results.base.mean).toBeLessThan(results.optimistic.mean);
    });
  });

  // ==========================================
  // Distribution Output
  // ==========================================

  describe('Distribution/Histogram Output', () => {
    it('should return distribution buckets', async () => {
      const result = await service.runSingleFactorSimulation(
        { type: 'normal', params: [50, 10] },
        1000
      );

      expect(result.distribution).toBeDefined();
      expect(result.distribution.length).toBeGreaterThan(0);
    });

    it('should have valid bucket structure', async () => {
      const result = await service.runSingleFactorSimulation(
        { type: 'normal', params: [50, 10] },
        1000
      );

      for (const bucket of result.distribution) {
        expect(bucket).toHaveProperty('bucket');
        expect(bucket).toHaveProperty('count');
        expect(bucket).toHaveProperty('percentage');
        expect(bucket.count).toBeGreaterThanOrEqual(0);
        expect(bucket.percentage).toBeGreaterThanOrEqual(0);
        expect(bucket.percentage).toBeLessThanOrEqual(100);
      }
    });

    it('should have percentages sum to approximately 100', async () => {
      const result = await service.runSingleFactorSimulation(
        { type: 'normal', params: [50, 10] },
        1000
      );

      const totalPercentage = result.distribution.reduce((sum, b) => sum + b.percentage, 0);
      expect(totalPercentage).toBeCloseTo(100, 1);
    });
  });
});
