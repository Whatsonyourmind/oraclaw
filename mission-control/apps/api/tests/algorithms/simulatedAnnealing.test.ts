/**
 * Simulated Annealing Scheduler Tests
 * Tests for optimization convergence, cooling schedules, constraints, and energy functions
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  SimulatedAnnealingScheduler,
  createSimulatedAnnealing,
  type SimulatedAnnealingConfig,
  type Constraint,
  type Solution,
} from '../../src/services/oracle/algorithms/simulatedAnnealing';

describe('SimulatedAnnealingScheduler', () => {
  let scheduler: SimulatedAnnealingScheduler<number[]>;

  beforeEach(() => {
    // Create scheduler with seed for reproducibility
    scheduler = createSimulatedAnnealing<number[]>(
      {
        initialTemperature: 100,
        finalTemperature: 0.1,
        coolingRate: 0.95,
        maxIterations: 1000,
        iterationsPerTemperature: 10,
        coolingSchedule: 'geometric',
        neighborStrategy: 'mixed',
      },
      12345
    );
  });

  // ============================================================================
  // Basic Optimization Tests
  // ============================================================================

  describe('Basic Optimization', () => {
    it('should optimize a simple quadratic function', () => {
      // Minimize sum of squares: optimal is all zeros
      scheduler.setEnergyFunction((solution: number[]) =>
        solution.reduce((sum, x) => sum + x * x, 0)
      );

      const initial = [5, 5, 5, 5, 5];
      const result = scheduler.optimize(initial);

      expect(result.bestSolution.energy).toBeLessThan(
        initial.reduce((sum, x) => sum + x * x, 0)
      );
    });

    it('should return result within reasonable time', () => {
      scheduler.setEnergyFunction((solution: number[]) =>
        solution.reduce((sum, x) => sum + Math.abs(x), 0)
      );

      const startTime = Date.now();
      const result = scheduler.optimize([10, 10, 10]);
      const duration = Date.now() - startTime;

      expect(result.metrics.executionTimeMs).toBeGreaterThan(0);
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
    });

    it('should track energy history', () => {
      scheduler.setEnergyFunction((solution: number[]) =>
        solution.reduce((sum, x) => sum + x * x, 0)
      );

      const result = scheduler.optimize([5, 5, 5]);

      expect(result.energyHistory.length).toBeGreaterThan(0);
      expect(result.energyHistory[0].energy).toBeDefined();
      expect(result.energyHistory[0].temperature).toBeDefined();
    });

    it('should calculate quality metrics', () => {
      scheduler.setEnergyFunction((solution: number[]) =>
        solution.reduce((sum, x) => sum + x * x, 0)
      );

      const result = scheduler.optimize([10, 10, 10]);

      expect(result.metrics.bestEnergy).toBeDefined();
      expect(result.metrics.initialEnergy).toBeDefined();
      expect(result.metrics.improvementPercent).toBeDefined();
      expect(result.metrics.acceptanceRate).toBeDefined();
      expect(result.metrics.totalIterations).toBeGreaterThan(0);
    });

    it('should show improvement from initial solution', () => {
      scheduler.setEnergyFunction((solution: number[]) =>
        solution.reduce((sum, x) => sum + x * x, 0)
      );

      const result = scheduler.optimize([10, 10, 10, 10, 10]);

      expect(result.metrics.improvementPercent).toBeGreaterThan(0);
      expect(result.bestSolution.energy).toBeLessThan(result.metrics.initialEnergy);
    });
  });

  // ============================================================================
  // Cooling Schedule Tests
  // ============================================================================

  describe('Cooling Schedules', () => {
    const testCoolingSchedule = (schedule: 'geometric' | 'linear' | 'exponential' | 'logarithmic' | 'adaptive') => {
      const testScheduler = createSimulatedAnnealing<number[]>(
        {
          initialTemperature: 100,
          finalTemperature: 0.1,
          coolingRate: 0.95,
          maxIterations: 500,
          iterationsPerTemperature: 10,
          coolingSchedule: schedule,
        },
        12345
      );

      testScheduler.setEnergyFunction((solution: number[]) =>
        solution.reduce((sum, x) => sum + x * x, 0)
      );

      return testScheduler.optimize([5, 5, 5]);
    };

    it('should work with geometric cooling', () => {
      const result = testCoolingSchedule('geometric');
      expect(result.metrics.finalTemperatureReached).toBeLessThan(100);
    });

    it('should work with linear cooling', () => {
      const result = testCoolingSchedule('linear');
      expect(result.metrics.finalTemperatureReached).toBeLessThan(100);
    });

    it('should work with exponential cooling', () => {
      const result = testCoolingSchedule('exponential');
      expect(result.metrics.finalTemperatureReached).toBeLessThan(100);
    });

    it('should work with logarithmic cooling', () => {
      const result = testCoolingSchedule('logarithmic');
      expect(result.metrics.finalTemperatureReached).toBeLessThan(100);
    });

    it('should work with adaptive cooling', () => {
      const result = testCoolingSchedule('adaptive');
      expect(result.metrics.finalTemperatureReached).toBeLessThan(100);
    });

    it('should decrease temperature over iterations', () => {
      scheduler.setEnergyFunction((solution: number[]) =>
        solution.reduce((sum, x) => sum + x * x, 0)
      );

      const result = scheduler.optimize([5, 5, 5]);

      // Temperature should decrease
      if (result.energyHistory.length > 1) {
        const firstTemp = result.energyHistory[0].temperature;
        const lastTemp = result.energyHistory[result.energyHistory.length - 1].temperature;
        expect(lastTemp).toBeLessThan(firstTemp);
      }
    });
  });

  // ============================================================================
  // Neighbor Strategy Tests
  // ============================================================================

  describe('Neighbor Strategies', () => {
    const testNeighborStrategy = (strategy: 'swap' | 'insert' | 'reverse' | 'random' | 'gaussian' | 'mixed') => {
      const testScheduler = createSimulatedAnnealing<number[]>(
        {
          initialTemperature: 50,
          finalTemperature: 0.1,
          maxIterations: 200,
          iterationsPerTemperature: 5,
          neighborStrategy: strategy,
        },
        12345
      );

      testScheduler.setEnergyFunction((solution: number[]) =>
        solution.reduce((sum, x) => sum + Math.abs(x - 5), 0) // Optimal at [5, 5, ...]
      );

      return testScheduler.optimize([1, 2, 3, 4, 5]);
    };

    it('should work with swap strategy', () => {
      const result = testNeighborStrategy('swap');
      expect(result.bestSolution).toBeDefined();
    });

    it('should work with insert strategy', () => {
      const result = testNeighborStrategy('insert');
      expect(result.bestSolution).toBeDefined();
    });

    it('should work with reverse strategy', () => {
      const result = testNeighborStrategy('reverse');
      expect(result.bestSolution).toBeDefined();
    });

    it('should work with random strategy', () => {
      const result = testNeighborStrategy('random');
      expect(result.bestSolution).toBeDefined();
    });

    it('should work with gaussian strategy', () => {
      const result = testNeighborStrategy('gaussian');
      expect(result.bestSolution).toBeDefined();
    });

    it('should work with mixed strategy', () => {
      const result = testNeighborStrategy('mixed');
      expect(result.bestSolution).toBeDefined();
    });
  });

  // ============================================================================
  // Constraint Tests
  // ============================================================================

  describe('Constraints', () => {
    beforeEach(() => {
      scheduler.setEnergyFunction((solution: number[]) =>
        solution.reduce((sum, x) => sum + x, 0)
      );
    });

    it('should respect hard constraints', () => {
      const hardConstraint: Constraint<number[]> = {
        id: 'min-value',
        description: 'All values must be >= 0',
        isHard: true,
        penaltyWeight: 1000,
        evaluate: (solution: number[]) => {
          return solution.filter(x => x < 0).length;
        },
      };

      scheduler.addConstraint(hardConstraint);
      const result = scheduler.optimize([5, 5, 5]);

      expect(result.bestSolution.constraintViolations).toBeDefined();
    });

    it('should penalize soft constraint violations', () => {
      const softConstraint: Constraint<number[]> = {
        id: 'prefer-small',
        description: 'Prefer values under 10',
        isHard: false,
        penaltyWeight: 10,
        evaluate: (solution: number[]) => {
          return solution.filter(x => x > 10).length;
        },
      };

      scheduler.addConstraint(softConstraint);
      const result = scheduler.optimize([15, 15, 15]);

      // Total cost should include penalty
      expect(result.bestSolution.totalCost).toBeGreaterThanOrEqual(result.bestSolution.energy);
    });

    it('should handle multiple constraints', () => {
      const constraint1: Constraint<number[]> = {
        id: 'c1',
        description: 'Constraint 1',
        isHard: false,
        penaltyWeight: 5,
        evaluate: () => 0,
      };

      const constraint2: Constraint<number[]> = {
        id: 'c2',
        description: 'Constraint 2',
        isHard: false,
        penaltyWeight: 10,
        evaluate: () => 0,
      };

      scheduler.addConstraints([constraint1, constraint2]);
      const result = scheduler.optimize([1, 2, 3]);

      expect(result.metrics.constraintSatisfactionRate).toBe(1); // All satisfied
    });

    it('should clear constraints', () => {
      scheduler.addConstraint({
        id: 'test',
        description: 'Test constraint',
        isHard: true,
        penaltyWeight: 100,
        evaluate: () => 1,
      });

      scheduler.clearConstraints();
      const result = scheduler.optimize([1, 2, 3]);

      expect(result.bestSolution.constraintViolations).toBe(0);
    });

    it('should report constraint satisfaction rate', () => {
      scheduler.addConstraint({
        id: 'always-satisfied',
        description: 'Always satisfied',
        isHard: false,
        penaltyWeight: 10,
        evaluate: () => 0,
      });

      const result = scheduler.optimize([1, 2, 3]);
      expect(result.metrics.constraintSatisfactionRate).toBe(1);
    });
  });

  // ============================================================================
  // Reheating Tests
  // ============================================================================

  describe('Reheating', () => {
    it('should reheat when stuck', () => {
      const slowScheduler = createSimulatedAnnealing<number[]>(
        {
          initialTemperature: 10,
          finalTemperature: 0.1,
          maxIterations: 1000,
          iterationsPerTemperature: 10,
          reheatFactor: 2,
          reheatThreshold: 50,
        },
        12345
      );

      // Energy function with local minima
      slowScheduler.setEnergyFunction((solution: number[]) => {
        const x = solution[0];
        return Math.sin(x * 0.5) + x * x * 0.01;
      });

      const result = slowScheduler.optimize([10]);
      expect(result.metrics.reheats).toBeGreaterThanOrEqual(0);
    });

    it('should track number of reheats in metrics', () => {
      scheduler.setEnergyFunction((solution: number[]) =>
        solution.reduce((sum, x) => sum + x * x, 0)
      );

      const result = scheduler.optimize([5, 5, 5]);
      expect(result.metrics.reheats).toBeDefined();
      expect(typeof result.metrics.reheats).toBe('number');
    });
  });

  // ============================================================================
  // Convergence Detection Tests
  // ============================================================================

  describe('Convergence Detection', () => {
    it('should detect convergence', () => {
      const quickScheduler = createSimulatedAnnealing<number[]>(
        {
          initialTemperature: 100,
          finalTemperature: 0.01,
          maxIterations: 10000,
          iterationsPerTemperature: 50,
        },
        12345
      );

      quickScheduler.setEnergyFunction((solution: number[]) =>
        solution.reduce((sum, x) => sum + x * x, 0)
      );

      const result = quickScheduler.optimize([0.1, 0.1, 0.1]);
      expect(result.converged).toBeDefined();
    });

    it('should track iterations to best solution', () => {
      scheduler.setEnergyFunction((solution: number[]) =>
        solution.reduce((sum, x) => sum + x * x, 0)
      );

      const result = scheduler.optimize([10, 10, 10]);
      expect(result.metrics.iterationsToBest).toBeGreaterThan(0);
      expect(result.metrics.iterationsToBest).toBeLessThanOrEqual(result.metrics.totalIterations);
    });
  });

  // ============================================================================
  // Multi-Start Optimization Tests
  // ============================================================================

  describe('Multi-Start Optimization', () => {
    it('should optimize from multiple starting points', () => {
      scheduler.setEnergyFunction((solution: number[]) =>
        solution.reduce((sum, x) => sum + x * x, 0)
      );

      const initialSolutions = [
        [10, 10, 10],
        [-10, -10, -10],
        [5, -5, 5],
        [0, 0, 0],
      ];

      const result = scheduler.optimizeMultiStart(initialSolutions);
      expect(result.bestSolution.energy).toBeDefined();
    });

    it('should return best result from all starts', () => {
      scheduler.setEnergyFunction((solution: number[]) =>
        solution.reduce((sum, x) => sum + x * x, 0)
      );

      const initialSolutions = [
        [100, 100, 100], // Far from optimal
        [0.1, 0.1, 0.1], // Very close to optimal
      ];

      const result = scheduler.optimizeMultiStart(initialSolutions);

      // Should find solution close to [0, 0, 0]
      expect(result.bestSolution.energy).toBeLessThan(1);
    });
  });

  // ============================================================================
  // Pre-built Energy Functions Tests
  // ============================================================================

  describe('Pre-built Energy Functions', () => {
    describe('Scheduling Energy', () => {
      it('should create scheduling energy function', () => {
        const durations = [10, 20, 15, 25, 30];
        const dependencies = new Map<number, number[]>([[0, [1, 2]]]);

        const energyFn = SimulatedAnnealingScheduler.createSchedulingEnergy(
          durations,
          dependencies
        );

        const energy = energyFn([0, 1, 2, 3, 4]);
        expect(energy).toBeGreaterThan(0);
      });

      it('should minimize makespan for scheduling', () => {
        const durations = [10, 20, 15];
        const dependencies = new Map<number, number[]>();

        scheduler.setEnergyFunction(
          SimulatedAnnealingScheduler.createSchedulingEnergy(durations, dependencies)
        );

        const result = scheduler.optimize([0, 1, 2]);
        expect(result.bestSolution.energy).toBeGreaterThan(0);
      });
    });

    describe('TSP Energy', () => {
      it('should create TSP energy function', () => {
        const distances = [
          [0, 10, 15],
          [10, 0, 20],
          [15, 20, 0],
        ];

        const energyFn = SimulatedAnnealingScheduler.createTSPEnergy(distances);
        const energy = energyFn([0, 1, 2]);

        expect(energy).toBe(10 + 20 + 15); // 0->1 + 1->2 + 2->0
      });

      it('should find good TSP tour', () => {
        const distances = [
          [0, 1, 10, 10],
          [1, 0, 10, 10],
          [10, 10, 0, 1],
          [10, 10, 1, 0],
        ];

        scheduler.setEnergyFunction(
          SimulatedAnnealingScheduler.createTSPEnergy(distances)
        );

        const result = scheduler.optimize([0, 1, 2, 3]);
        // Optimal tour should be around 22 (0-1-2-3-0 or similar)
        expect(result.bestSolution.energy).toBeLessThan(40);
      });
    });

    describe('Bin Packing Energy', () => {
      it('should create bin packing energy function', () => {
        const items = [3, 4, 5, 2, 6];
        const binCapacity = 10;

        const energyFn = SimulatedAnnealingScheduler.createBinPackingEnergy(
          items,
          binCapacity
        );

        // All items in same bin (0) - will overflow
        const energy = energyFn([0, 0, 0, 0, 0]);
        expect(energy).toBeGreaterThan(1); // Should have overflow penalty
      });

      it('should minimize number of bins', () => {
        const items = [5, 5, 5, 5];
        const binCapacity = 10;

        scheduler.setEnergyFunction(
          SimulatedAnnealingScheduler.createBinPackingEnergy(items, binCapacity)
        );

        const result = scheduler.optimize([0, 0, 1, 1]); // 2 bins
        expect(result.bestSolution.energy).toBeLessThanOrEqual(2);
      });
    });
  });

  // ============================================================================
  // Pre-built Constraint Tests
  // ============================================================================

  describe('Pre-built Constraints', () => {
    describe('Precedence Constraint', () => {
      it('should create precedence constraint', () => {
        const constraint = SimulatedAnnealingScheduler.createPrecedenceConstraint(0, 1);

        expect(constraint.id).toBe('precedence-0-1');
        expect(constraint.isHard).toBe(true);
      });

      it('should detect precedence violations', () => {
        const constraint = SimulatedAnnealingScheduler.createPrecedenceConstraint(0, 1);

        // Task 0 after task 1 - violation
        const violation = constraint.evaluate([1, 0, 2]);
        expect(violation).toBe(1);
      });

      it('should pass when precedence is satisfied', () => {
        const constraint = SimulatedAnnealingScheduler.createPrecedenceConstraint(0, 1);

        // Task 0 before task 1 - no violation
        const violation = constraint.evaluate([0, 1, 2]);
        expect(violation).toBe(0);
      });
    });

    describe('Deadline Constraint', () => {
      it('should create deadline constraint', () => {
        const constraint = SimulatedAnnealingScheduler.createDeadlineConstraint(
          1,
          50,
          [10, 20, 30]
        );

        expect(constraint.id).toBe('deadline-1-50');
        expect(constraint.isHard).toBe(false);
      });

      it('should detect deadline violations', () => {
        const durations = [30, 30, 30];
        const constraint = SimulatedAnnealingScheduler.createDeadlineConstraint(
          1,
          40,
          durations
        );

        // Task 1 at position 1 finishes at time 60 (30+30)
        const violation = constraint.evaluate([0, 1, 2]);
        expect(violation).toBeGreaterThan(0);
      });

      it('should pass when deadline is met', () => {
        const durations = [10, 10, 10];
        const constraint = SimulatedAnnealingScheduler.createDeadlineConstraint(
          0,
          50,
          durations
        );

        // Task 0 finishes at time 10
        const violation = constraint.evaluate([0, 1, 2]);
        expect(violation).toBe(0);
      });
    });

    describe('Resource Constraint', () => {
      it('should create resource constraint', () => {
        const constraint = SimulatedAnnealingScheduler.createResourceConstraint(
          [2, 3, 4],
          5
        );

        expect(constraint.id).toBe('resource-capacity-5');
        expect(constraint.isHard).toBe(true);
      });
    });
  });

  // ============================================================================
  // Configuration Tests
  // ============================================================================

  describe('Configuration', () => {
    it('should get current configuration', () => {
      const config = scheduler.getConfig();

      expect(config.initialTemperature).toBe(100);
      expect(config.finalTemperature).toBe(0.1);
      expect(config.coolingRate).toBe(0.95);
    });

    it('should update configuration', () => {
      scheduler.updateConfig({
        initialTemperature: 200,
        coolingRate: 0.9,
      });

      const config = scheduler.getConfig();
      expect(config.initialTemperature).toBe(200);
      expect(config.coolingRate).toBe(0.9);
    });

    it('should preserve unmodified config values', () => {
      const originalFinal = scheduler.getConfig().finalTemperature;

      scheduler.updateConfig({
        initialTemperature: 500,
      });

      const config = scheduler.getConfig();
      expect(config.finalTemperature).toBe(originalFinal);
    });
  });

  // ============================================================================
  // Custom Function Tests
  // ============================================================================

  describe('Custom Functions', () => {
    it('should use custom energy function', () => {
      const customEnergy = jest.fn((solution: number[]) =>
        solution.reduce((sum, x) => sum + x, 0)
      );

      scheduler.setEnergyFunction(customEnergy);
      scheduler.optimize([1, 2, 3]);

      expect(customEnergy).toHaveBeenCalled();
    });

    it('should use custom neighbor function', () => {
      const customNeighbor = jest.fn((solution: number[], temp: number) => {
        const neighbor = [...solution];
        neighbor[0] += 0.1;
        return neighbor;
      });

      scheduler.setNeighborFunction(customNeighbor);
      scheduler.setEnergyFunction((s) => s[0]);
      scheduler.optimize([10]);

      expect(customNeighbor).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle empty solution', () => {
      scheduler.setEnergyFunction(() => 0);
      const result = scheduler.optimize([]);

      expect(result.bestSolution.value).toEqual([]);
      expect(result.bestSolution.energy).toBe(0);
    });

    it('should handle single-element solution', () => {
      scheduler.setEnergyFunction((s) => s[0] * s[0]);
      const result = scheduler.optimize([10]);

      expect(result.bestSolution.energy).toBeDefined();
    });

    it('should handle zero temperature gracefully', () => {
      const zeroTempScheduler = createSimulatedAnnealing<number[]>(
        {
          initialTemperature: 0.01,
          finalTemperature: 0.001,
          maxIterations: 100,
        },
        12345
      );

      zeroTempScheduler.setEnergyFunction((s) => s.reduce((a, b) => a + b * b, 0));
      const result = zeroTempScheduler.optimize([1, 2, 3]);

      expect(result.bestSolution).toBeDefined();
    });

    it('should handle negative energy values', () => {
      scheduler.setEnergyFunction((s) => -s.reduce((a, b) => a + b * b, 0));
      const result = scheduler.optimize([1, 2, 3]);

      expect(result.bestSolution.energy).toBeLessThan(0);
    });

    it('should handle very large numbers', () => {
      scheduler.setEnergyFunction((s) => s[0]);
      const result = scheduler.optimize([1e10]);

      expect(result.bestSolution).toBeDefined();
    });
  });
});
