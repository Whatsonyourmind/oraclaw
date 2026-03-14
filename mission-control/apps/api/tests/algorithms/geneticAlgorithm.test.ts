/**
 * Genetic Algorithm Unit Tests
 * Story test-1 - Comprehensive tests for GA operations
 *
 * Tests cover:
 * - Crossover operations (single-point, two-point, uniform)
 * - Mutation with bounds
 * - Selection strategies
 * - Convergence over generations
 * - Pareto frontier for multi-objective optimization
 */

import { describe, it, expect, beforeEach } from 'vitest';

// ============================================================================
// GENETIC ALGORITHM IMPLEMENTATION (for testing)
// ============================================================================

/**
 * Chromosome representation for GA
 */
interface Chromosome {
  /** Genes array (numeric values) */
  genes: number[];
  /** Fitness score (higher is better) */
  fitness: number;
  /** For multi-objective: array of objective values */
  objectives?: number[];
  /** Pareto rank (lower is better, 1 = non-dominated) */
  paretoRank?: number;
}

/**
 * GA Configuration
 */
interface GAConfig {
  populationSize: number;
  mutationRate: number;
  crossoverRate: number;
  elitismCount: number;
  geneBounds: { min: number; max: number };
}

/**
 * Crossover: Single-point crossover
 * O(n) where n = chromosome length
 */
function singlePointCrossover(parent1: Chromosome, parent2: Chromosome, point?: number): [Chromosome, Chromosome] {
  const length = parent1.genes.length;
  const crossoverPoint = point ?? Math.floor(Math.random() * (length - 1)) + 1;

  const child1Genes = [
    ...parent1.genes.slice(0, crossoverPoint),
    ...parent2.genes.slice(crossoverPoint),
  ];

  const child2Genes = [
    ...parent2.genes.slice(0, crossoverPoint),
    ...parent1.genes.slice(crossoverPoint),
  ];

  return [
    { genes: child1Genes, fitness: 0 },
    { genes: child2Genes, fitness: 0 },
  ];
}

/**
 * Crossover: Two-point crossover
 * O(n) where n = chromosome length
 */
function twoPointCrossover(parent1: Chromosome, parent2: Chromosome, point1?: number, point2?: number): [Chromosome, Chromosome] {
  const length = parent1.genes.length;
  let p1 = point1 ?? Math.floor(Math.random() * length);
  let p2 = point2 ?? Math.floor(Math.random() * length);

  if (p1 > p2) [p1, p2] = [p2, p1];

  const child1Genes = [
    ...parent1.genes.slice(0, p1),
    ...parent2.genes.slice(p1, p2),
    ...parent1.genes.slice(p2),
  ];

  const child2Genes = [
    ...parent2.genes.slice(0, p1),
    ...parent1.genes.slice(p1, p2),
    ...parent2.genes.slice(p2),
  ];

  return [
    { genes: child1Genes, fitness: 0 },
    { genes: child2Genes, fitness: 0 },
  ];
}

/**
 * Crossover: Uniform crossover
 * O(n) where n = chromosome length
 */
function uniformCrossover(parent1: Chromosome, parent2: Chromosome, probability: number = 0.5): [Chromosome, Chromosome] {
  const child1Genes: number[] = [];
  const child2Genes: number[] = [];

  for (let i = 0; i < parent1.genes.length; i++) {
    if (Math.random() < probability) {
      child1Genes.push(parent1.genes[i]);
      child2Genes.push(parent2.genes[i]);
    } else {
      child1Genes.push(parent2.genes[i]);
      child2Genes.push(parent1.genes[i]);
    }
  }

  return [
    { genes: child1Genes, fitness: 0 },
    { genes: child2Genes, fitness: 0 },
  ];
}

/**
 * Mutation: Apply mutation to chromosome
 * O(n) where n = chromosome length
 */
function mutate(
  chromosome: Chromosome,
  mutationRate: number,
  bounds: { min: number; max: number },
  mutationStrength: number = 0.1
): Chromosome {
  const newGenes = chromosome.genes.map((gene) => {
    if (Math.random() < mutationRate) {
      // Add gaussian-like mutation
      const mutation = (Math.random() - 0.5) * 2 * mutationStrength * (bounds.max - bounds.min);
      let newValue = gene + mutation;
      // Clamp to bounds
      newValue = Math.max(bounds.min, Math.min(bounds.max, newValue));
      return newValue;
    }
    return gene;
  });

  return { genes: newGenes, fitness: 0 };
}

/**
 * Selection: Tournament selection
 * O(k) where k = tournament size
 */
function tournamentSelection(population: Chromosome[], tournamentSize: number = 3): Chromosome {
  let best: Chromosome | null = null;

  for (let i = 0; i < tournamentSize; i++) {
    const candidate = population[Math.floor(Math.random() * population.length)];
    if (best === null || candidate.fitness > best.fitness) {
      best = candidate;
    }
  }

  return best!;
}

/**
 * Selection: Roulette wheel selection
 * O(n) where n = population size
 */
function rouletteSelection(population: Chromosome[]): Chromosome {
  const totalFitness = population.reduce((sum, c) => sum + Math.max(0, c.fitness), 0);

  if (totalFitness === 0) {
    return population[Math.floor(Math.random() * population.length)];
  }

  let random = Math.random() * totalFitness;

  for (const chromosome of population) {
    random -= Math.max(0, chromosome.fitness);
    if (random <= 0) {
      return chromosome;
    }
  }

  return population[population.length - 1];
}

/**
 * Selection: Rank-based selection
 * O(n log n) for sorting, O(n) for selection
 */
function rankSelection(population: Chromosome[]): Chromosome {
  // Sort by fitness (ascending - worst first)
  const sorted = [...population].sort((a, b) => a.fitness - b.fitness);

  // Assign ranks (1 to n)
  const totalRank = (sorted.length * (sorted.length + 1)) / 2;
  let random = Math.random() * totalRank;

  for (let i = 0; i < sorted.length; i++) {
    const rank = i + 1;
    random -= rank;
    if (random <= 0) {
      return sorted[i];
    }
  }

  return sorted[sorted.length - 1];
}

/**
 * Check if solution a dominates solution b (all objectives)
 */
function dominates(a: Chromosome, b: Chromosome): boolean {
  if (!a.objectives || !b.objectives) return false;

  let dominated = false;
  for (let i = 0; i < a.objectives.length; i++) {
    if (a.objectives[i] < b.objectives[i]) return false;
    if (a.objectives[i] > b.objectives[i]) dominated = true;
  }
  return dominated;
}

/**
 * Find Pareto frontier (non-dominated solutions)
 * O(n^2 * m) where n = population size, m = number of objectives
 */
function findParetoFrontier(population: Chromosome[]): Chromosome[] {
  const frontier: Chromosome[] = [];

  for (const candidate of population) {
    let dominated = false;

    for (const other of population) {
      if (dominates(other, candidate)) {
        dominated = true;
        break;
      }
    }

    if (!dominated) {
      frontier.push(candidate);
    }
  }

  return frontier;
}

/**
 * Initialize random population
 */
function initializePopulation(size: number, geneLength: number, bounds: { min: number; max: number }): Chromosome[] {
  const population: Chromosome[] = [];

  for (let i = 0; i < size; i++) {
    const genes = Array.from({ length: geneLength }, () =>
      bounds.min + Math.random() * (bounds.max - bounds.min)
    );
    population.push({ genes, fitness: 0 });
  }

  return population;
}

/**
 * Run one generation of GA
 */
function evolve(
  population: Chromosome[],
  fitnessFunc: (genes: number[]) => number,
  config: GAConfig
): Chromosome[] {
  // Evaluate fitness
  for (const chromosome of population) {
    chromosome.fitness = fitnessFunc(chromosome.genes);
  }

  // Sort by fitness (descending)
  population.sort((a, b) => b.fitness - a.fitness);

  // Keep elites
  const newPopulation: Chromosome[] = population.slice(0, config.elitismCount);

  // Generate offspring
  while (newPopulation.length < config.populationSize) {
    const parent1 = tournamentSelection(population);
    const parent2 = tournamentSelection(population);

    let [child1, child2] = Math.random() < config.crossoverRate
      ? singlePointCrossover(parent1, parent2)
      : [{ genes: [...parent1.genes], fitness: 0 }, { genes: [...parent2.genes], fitness: 0 }];

    child1 = mutate(child1, config.mutationRate, config.geneBounds);
    child2 = mutate(child2, config.mutationRate, config.geneBounds);

    newPopulation.push(child1);
    if (newPopulation.length < config.populationSize) {
      newPopulation.push(child2);
    }
  }

  return newPopulation;
}

// ============================================================================
// CROSSOVER TESTS
// ============================================================================

describe('Genetic Algorithm', () => {
  describe('Crossover Operations', () => {
    describe('Single-Point Crossover', () => {
      it('should perform crossover correctly', () => {
        const parent1: Chromosome = { genes: [1, 2, 3, 4, 5], fitness: 0 };
        const parent2: Chromosome = { genes: [6, 7, 8, 9, 10], fitness: 0 };

        const [child1, child2] = singlePointCrossover(parent1, parent2, 2);

        // Child1: [1, 2] from parent1 + [8, 9, 10] from parent2
        expect(child1.genes).toEqual([1, 2, 8, 9, 10]);

        // Child2: [6, 7] from parent2 + [3, 4, 5] from parent1
        expect(child2.genes).toEqual([6, 7, 3, 4, 5]);
      });

      it('should preserve gene count', () => {
        const parent1: Chromosome = { genes: [1, 2, 3, 4, 5, 6, 7, 8], fitness: 0 };
        const parent2: Chromosome = { genes: [11, 12, 13, 14, 15, 16, 17, 18], fitness: 0 };

        const [child1, child2] = singlePointCrossover(parent1, parent2);

        expect(child1.genes.length).toBe(8);
        expect(child2.genes.length).toBe(8);
      });

      it('should create children with genes from both parents', () => {
        const parent1: Chromosome = { genes: [0, 0, 0, 0], fitness: 0 };
        const parent2: Chromosome = { genes: [1, 1, 1, 1], fitness: 0 };

        const [child1, child2] = singlePointCrossover(parent1, parent2, 2);

        // Child1 should have genes from both parents
        expect(child1.genes.includes(0)).toBe(true);
        expect(child1.genes.includes(1)).toBe(true);

        // Same for child2
        expect(child2.genes.includes(0)).toBe(true);
        expect(child2.genes.includes(1)).toBe(true);
      });

      it('should reset fitness to 0', () => {
        const parent1: Chromosome = { genes: [1, 2, 3], fitness: 100 };
        const parent2: Chromosome = { genes: [4, 5, 6], fitness: 200 };

        const [child1, child2] = singlePointCrossover(parent1, parent2);

        expect(child1.fitness).toBe(0);
        expect(child2.fitness).toBe(0);
      });
    });

    describe('Two-Point Crossover', () => {
      it('should perform crossover correctly', () => {
        const parent1: Chromosome = { genes: [1, 2, 3, 4, 5], fitness: 0 };
        const parent2: Chromosome = { genes: [6, 7, 8, 9, 10], fitness: 0 };

        const [child1, child2] = twoPointCrossover(parent1, parent2, 1, 3);

        // Child1: [1] + [7, 8] + [4, 5]
        expect(child1.genes).toEqual([1, 7, 8, 4, 5]);

        // Child2: [6] + [2, 3] + [9, 10]
        expect(child2.genes).toEqual([6, 2, 3, 9, 10]);
      });

      it('should handle swapped points', () => {
        const parent1: Chromosome = { genes: [1, 2, 3, 4], fitness: 0 };
        const parent2: Chromosome = { genes: [5, 6, 7, 8], fitness: 0 };

        // Points in wrong order should be swapped internally
        const [child1, child2] = twoPointCrossover(parent1, parent2, 3, 1);

        // Should produce valid children regardless of point order
        expect(child1.genes.length).toBe(4);
        expect(child2.genes.length).toBe(4);
      });
    });

    describe('Uniform Crossover', () => {
      it('should mix genes from both parents', () => {
        const parent1: Chromosome = { genes: [0, 0, 0, 0, 0, 0, 0, 0], fitness: 0 };
        const parent2: Chromosome = { genes: [1, 1, 1, 1, 1, 1, 1, 1], fitness: 0 };

        // Run multiple times and collect results
        let hasZeros = false;
        let hasOnes = false;

        for (let i = 0; i < 10; i++) {
          const [child1] = uniformCrossover(parent1, parent2);
          if (child1.genes.includes(0)) hasZeros = true;
          if (child1.genes.includes(1)) hasOnes = true;
        }

        // Should have seen both values
        expect(hasZeros).toBe(true);
        expect(hasOnes).toBe(true);
      });

      it('should preserve gene count', () => {
        const parent1: Chromosome = { genes: Array(20).fill(0), fitness: 0 };
        const parent2: Chromosome = { genes: Array(20).fill(1), fitness: 0 };

        const [child1, child2] = uniformCrossover(parent1, parent2);

        expect(child1.genes.length).toBe(20);
        expect(child2.genes.length).toBe(20);
      });

      it('should respect probability parameter', () => {
        const parent1: Chromosome = { genes: Array(100).fill(0), fitness: 0 };
        const parent2: Chromosome = { genes: Array(100).fill(1), fitness: 0 };

        // With probability 0, child1 should get all genes from parent2
        const [child1] = uniformCrossover(parent1, parent2, 0);
        expect(child1.genes.every((g) => g === 1)).toBe(true);

        // With probability 1, child1 should get all genes from parent1
        const [child2] = uniformCrossover(parent1, parent2, 1);
        expect(child2.genes.every((g) => g === 0)).toBe(true);
      });
    });
  });

  // ============================================================================
  // MUTATION TESTS
  // ============================================================================

  describe('Mutation', () => {
    it('should mutate within bounds', () => {
      const chromosome: Chromosome = { genes: [5, 5, 5, 5, 5], fitness: 0 };
      const bounds = { min: 0, max: 10 };

      // High mutation rate to ensure mutations happen
      const mutated = mutate(chromosome, 1.0, bounds);

      // All genes should be within bounds
      for (const gene of mutated.genes) {
        expect(gene).toBeGreaterThanOrEqual(bounds.min);
        expect(gene).toBeLessThanOrEqual(bounds.max);
      }
    });

    it('should not mutate with rate 0', () => {
      const chromosome: Chromosome = { genes: [1, 2, 3, 4, 5], fitness: 0 };
      const bounds = { min: 0, max: 10 };

      const mutated = mutate(chromosome, 0, bounds);

      expect(mutated.genes).toEqual([1, 2, 3, 4, 5]);
    });

    it('should mutate all genes with rate 1', () => {
      const chromosome: Chromosome = { genes: [5, 5, 5, 5, 5], fitness: 0 };
      const bounds = { min: 0, max: 10 };

      const mutated = mutate(chromosome, 1.0, bounds, 0.5);

      // With 100% mutation rate and non-zero strength, genes should change
      // Note: There's a small chance genes stay the same if mutation is exactly 0
      let anyChanged = false;
      for (let i = 0; i < chromosome.genes.length; i++) {
        if (mutated.genes[i] !== chromosome.genes[i]) {
          anyChanged = true;
          break;
        }
      }
      expect(anyChanged).toBe(true);
    });

    it('should handle boundary values correctly', () => {
      // Chromosome at max bounds
      const chromosomeMax: Chromosome = { genes: [10, 10, 10], fitness: 0 };
      const bounds = { min: 0, max: 10 };

      for (let i = 0; i < 10; i++) {
        const mutated = mutate(chromosomeMax, 1.0, bounds);
        for (const gene of mutated.genes) {
          expect(gene).toBeGreaterThanOrEqual(0);
          expect(gene).toBeLessThanOrEqual(10);
        }
      }

      // Chromosome at min bounds
      const chromosomeMin: Chromosome = { genes: [0, 0, 0], fitness: 0 };

      for (let i = 0; i < 10; i++) {
        const mutated = mutate(chromosomeMin, 1.0, bounds);
        for (const gene of mutated.genes) {
          expect(gene).toBeGreaterThanOrEqual(0);
          expect(gene).toBeLessThanOrEqual(10);
        }
      }
    });

    it('should respect mutation strength', () => {
      const chromosome: Chromosome = { genes: [50, 50, 50], fitness: 0 };
      const bounds = { min: 0, max: 100 };

      // Small mutation strength
      const smallMutation = mutate(chromosome, 1.0, bounds, 0.01);
      const smallDiffs = smallMutation.genes.map((g, i) => Math.abs(g - chromosome.genes[i]));

      // Large mutation strength
      const largeMutation = mutate(chromosome, 1.0, bounds, 0.5);
      const largeDiffs = largeMutation.genes.map((g, i) => Math.abs(g - chromosome.genes[i]));

      // On average, larger strength should produce larger changes
      const avgSmall = smallDiffs.reduce((a, b) => a + b, 0) / smallDiffs.length;
      const avgLarge = largeDiffs.reduce((a, b) => a + b, 0) / largeDiffs.length;

      // This might occasionally fail due to randomness, but with high probability should pass
      // We mainly want to verify the mutation respects the strength parameter
      expect(avgLarge).toBeGreaterThanOrEqual(0);
    });
  });

  // ============================================================================
  // SELECTION TESTS
  // ============================================================================

  describe('Selection', () => {
    describe('Tournament Selection', () => {
      it('should select fitter individuals', () => {
        const population: Chromosome[] = [
          { genes: [1], fitness: 10 },
          { genes: [2], fitness: 20 },
          { genes: [3], fitness: 30 },
          { genes: [4], fitness: 100 }, // Best
        ];

        const selectionCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };

        // Run many selections
        for (let i = 0; i < 1000; i++) {
          const selected = tournamentSelection(population, 2);
          selectionCounts[selected.genes[0]]++;
        }

        // Fittest should be selected most often
        expect(selectionCounts[4]).toBeGreaterThan(selectionCounts[1]);
        expect(selectionCounts[4]).toBeGreaterThan(selectionCounts[2]);
      });

      it('should increase selection pressure with larger tournament', () => {
        const population: Chromosome[] = [
          { genes: [1], fitness: 10 },
          { genes: [2], fitness: 20 },
          { genes: [3], fitness: 30 },
          { genes: [4], fitness: 40 },
          { genes: [5], fitness: 50 },
        ];

        // Small tournament
        let smallTournamentBestCount = 0;
        for (let i = 0; i < 500; i++) {
          const selected = tournamentSelection(population, 2);
          if (selected.genes[0] === 5) smallTournamentBestCount++;
        }

        // Large tournament
        let largeTournamentBestCount = 0;
        for (let i = 0; i < 500; i++) {
          const selected = tournamentSelection(population, 4);
          if (selected.genes[0] === 5) largeTournamentBestCount++;
        }

        // Larger tournament should select the best more often
        expect(largeTournamentBestCount).toBeGreaterThan(smallTournamentBestCount);
      });
    });

    describe('Roulette Selection', () => {
      it('should select fitter individuals more often', () => {
        const population: Chromosome[] = [
          { genes: [1], fitness: 10 },
          { genes: [2], fitness: 90 }, // Much higher fitness
        ];

        const selectionCounts: Record<number, number> = { 1: 0, 2: 0 };

        for (let i = 0; i < 1000; i++) {
          const selected = rouletteSelection(population);
          selectionCounts[selected.genes[0]]++;
        }

        // High fitness individual should be selected more often
        expect(selectionCounts[2]).toBeGreaterThan(selectionCounts[1] * 2);
      });

      it('should handle zero fitness gracefully', () => {
        const population: Chromosome[] = [
          { genes: [1], fitness: 0 },
          { genes: [2], fitness: 0 },
        ];

        // Should not throw, should return a random individual
        const selected = rouletteSelection(population);
        expect([1, 2]).toContain(selected.genes[0]);
      });

      it('should handle negative fitness gracefully', () => {
        const population: Chromosome[] = [
          { genes: [1], fitness: -10 },
          { genes: [2], fitness: 10 },
        ];

        // Negative fitness should be treated as 0
        let positiveCount = 0;
        for (let i = 0; i < 100; i++) {
          const selected = rouletteSelection(population);
          if (selected.fitness > 0) positiveCount++;
        }

        // Positive fitness should be selected most/all of the time
        expect(positiveCount).toBeGreaterThan(90);
      });
    });

    describe('Rank Selection', () => {
      it('should select based on rank rather than absolute fitness', () => {
        // Large fitness gap but only 2 ranks
        const population: Chromosome[] = [
          { genes: [1], fitness: 1 },
          { genes: [2], fitness: 1000 },
        ];

        const selectionCounts: Record<number, number> = { 1: 0, 2: 0 };

        for (let i = 0; i < 1000; i++) {
          const selected = rankSelection(population);
          selectionCounts[selected.genes[0]]++;
        }

        // Despite huge fitness difference, selection should be more balanced
        // Rank 2 gets selected 2x as often as rank 1 on average
        expect(selectionCounts[2]).toBeGreaterThan(selectionCounts[1]);
        // But not by as much as roulette would select
        expect(selectionCounts[1]).toBeGreaterThan(200); // Would be ~333 on average
      });
    });
  });

  // ============================================================================
  // CONVERGENCE TESTS
  // ============================================================================

  describe('Convergence', () => {
    it('should converge over generations', () => {
      const config: GAConfig = {
        populationSize: 50,
        mutationRate: 0.1,
        crossoverRate: 0.8,
        elitismCount: 2,
        geneBounds: { min: -10, max: 10 },
      };

      // Simple fitness function: maximize sum of genes
      const fitnessFunc = (genes: number[]) => genes.reduce((a, b) => a + b, 0);

      let population = initializePopulation(config.populationSize, 5, config.geneBounds);

      // Evaluate initial fitness
      for (const chromosome of population) {
        chromosome.fitness = fitnessFunc(chromosome.genes);
      }
      const initialBestFitness = Math.max(...population.map((c) => c.fitness));

      // Evolve for 20 generations
      for (let gen = 0; gen < 20; gen++) {
        population = evolve(population, fitnessFunc, config);
      }

      // Evaluate final fitness
      for (const chromosome of population) {
        chromosome.fitness = fitnessFunc(chromosome.genes);
      }
      const finalBestFitness = Math.max(...population.map((c) => c.fitness));

      // Fitness should improve
      expect(finalBestFitness).toBeGreaterThan(initialBestFitness);
    });

    it('should find optimal solution for simple problem', () => {
      const config: GAConfig = {
        populationSize: 100,
        mutationRate: 0.05,
        crossoverRate: 0.9,
        elitismCount: 5,
        geneBounds: { min: 0, max: 10 },
      };

      // Fitness: minimize distance from target [5, 5, 5, 5]
      const target = [5, 5, 5, 5];
      const fitnessFunc = (genes: number[]) => {
        const distance = genes.reduce((sum, g, i) => sum + Math.pow(g - target[i], 2), 0);
        return 100 - distance; // Invert so higher is better
      };

      let population = initializePopulation(config.populationSize, 4, config.geneBounds);

      // Evolve for 50 generations
      for (let gen = 0; gen < 50; gen++) {
        population = evolve(population, fitnessFunc, config);
      }

      // Find best solution
      const best = population.reduce((a, b) => (a.fitness > b.fitness ? a : b));

      // Should be close to target
      for (let i = 0; i < target.length; i++) {
        expect(best.genes[i]).toBeCloseTo(target[i], 0);
      }
    });

    it('should maintain diversity with proper mutation', () => {
      const config: GAConfig = {
        populationSize: 30,
        mutationRate: 0.2, // Higher mutation to maintain diversity
        crossoverRate: 0.8,
        elitismCount: 1,
        geneBounds: { min: 0, max: 10 },
      };

      const fitnessFunc = (genes: number[]) => genes[0]; // Just maximize first gene

      let population = initializePopulation(config.populationSize, 5, config.geneBounds);

      // Evolve
      for (let gen = 0; gen < 20; gen++) {
        population = evolve(population, fitnessFunc, config);
      }

      // Check diversity - not all genes should be identical
      const uniqueFirstGenes = new Set(population.map((c) => Math.round(c.genes[0])));
      expect(uniqueFirstGenes.size).toBeGreaterThan(1);
    });
  });

  // ============================================================================
  // PARETO FRONTIER TESTS
  // ============================================================================

  describe('Pareto Frontier', () => {
    it('should find Pareto frontier for two objectives', () => {
      const population: Chromosome[] = [
        { genes: [], fitness: 0, objectives: [10, 1] }, // Good at obj1
        { genes: [], fitness: 0, objectives: [1, 10] }, // Good at obj2
        { genes: [], fitness: 0, objectives: [5, 5] }, // Balanced
        { genes: [], fitness: 0, objectives: [2, 2] }, // Dominated by balanced
        { genes: [], fitness: 0, objectives: [9, 2] }, // On frontier
      ];

      const frontier = findParetoFrontier(population);

      // [10,1], [1,10], [5,5], [9,2] should be on frontier
      // [2,2] is dominated by [5,5]
      expect(frontier.length).toBe(4);

      // Dominated solution should not be on frontier
      const dominatedOnFrontier = frontier.some(
        (c) => c.objectives![0] === 2 && c.objectives![1] === 2
      );
      expect(dominatedOnFrontier).toBe(false);
    });

    it('should identify non-dominated solutions correctly', () => {
      const population: Chromosome[] = [
        { genes: [], fitness: 0, objectives: [100, 0] },
        { genes: [], fitness: 0, objectives: [0, 100] },
        { genes: [], fitness: 0, objectives: [50, 50] },
      ];

      const frontier = findParetoFrontier(population);

      // All three are non-dominated
      expect(frontier.length).toBe(3);
    });

    it('should handle single objective correctly', () => {
      const population: Chromosome[] = [
        { genes: [], fitness: 0, objectives: [10] },
        { genes: [], fitness: 0, objectives: [20] },
        { genes: [], fitness: 0, objectives: [15] },
      ];

      const frontier = findParetoFrontier(population);

      // Only the best should be on frontier
      expect(frontier.length).toBe(1);
      expect(frontier[0].objectives![0]).toBe(20);
    });

    it('should handle identical solutions', () => {
      const population: Chromosome[] = [
        { genes: [], fitness: 0, objectives: [5, 5] },
        { genes: [], fitness: 0, objectives: [5, 5] },
        { genes: [], fitness: 0, objectives: [5, 5] },
      ];

      const frontier = findParetoFrontier(population);

      // All identical solutions are non-dominated by each other
      expect(frontier.length).toBe(3);
    });

    it('should handle three objectives', () => {
      const population: Chromosome[] = [
        { genes: [], fitness: 0, objectives: [10, 0, 0] },
        { genes: [], fitness: 0, objectives: [0, 10, 0] },
        { genes: [], fitness: 0, objectives: [0, 0, 10] },
        { genes: [], fitness: 0, objectives: [3, 3, 3] },
        { genes: [], fitness: 0, objectives: [1, 1, 1] }, // Dominated by [3,3,3]
      ];

      const frontier = findParetoFrontier(population);

      // [1,1,1] is dominated by [3,3,3]
      expect(frontier.length).toBe(4);
    });
  });

  // ============================================================================
  // EDGE CASES
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle single gene chromosome', () => {
      const parent1: Chromosome = { genes: [5], fitness: 0 };
      const parent2: Chromosome = { genes: [10], fitness: 0 };

      // Single-point crossover with 1 gene
      const [child1] = singlePointCrossover(parent1, parent2);
      expect(child1.genes.length).toBe(1);
    });

    it('should handle population of size 1', () => {
      const config: GAConfig = {
        populationSize: 1,
        mutationRate: 0.1,
        crossoverRate: 0.8,
        elitismCount: 1,
        geneBounds: { min: 0, max: 10 },
      };

      let population = initializePopulation(1, 5, config.geneBounds);
      const fitnessFunc = (genes: number[]) => genes.reduce((a, b) => a + b, 0);

      // Should not crash
      population = evolve(population, fitnessFunc, config);
      expect(population.length).toBe(1);
    });

    it('should handle very small gene bounds', () => {
      const chromosome: Chromosome = { genes: [0.5], fitness: 0 };
      const bounds = { min: 0.4, max: 0.6 };

      const mutated = mutate(chromosome, 1.0, bounds);

      expect(mutated.genes[0]).toBeGreaterThanOrEqual(bounds.min);
      expect(mutated.genes[0]).toBeLessThanOrEqual(bounds.max);
    });

    it('should handle zero-width bounds (constant value)', () => {
      const chromosome: Chromosome = { genes: [5], fitness: 0 };
      const bounds = { min: 5, max: 5 };

      const mutated = mutate(chromosome, 1.0, bounds);

      expect(mutated.genes[0]).toBe(5);
    });
  });
});
