/**
 * Genetic Algorithm Engine
 * Story alg-2 - Multi-objective plan optimization using evolutionary computation
 *
 * Implements genetic algorithms with various selection, crossover, and mutation
 * strategies for optimizing execution plans and decision sequences.
 */

/**
 * Represents a chromosome (candidate solution) in the genetic algorithm
 */
export interface Chromosome<T = number> {
  /** Gene values representing the solution encoding */
  genes: T[];
  /** Fitness score (higher is better) */
  fitness: number;
  /** Multi-objective fitness scores for Pareto optimization */
  objectives?: number[];
  /** Generation this chromosome was created in */
  generation?: number;
  /** Unique identifier */
  id?: string;
  /** Parent IDs for genealogy tracking */
  parentIds?: string[];
}

/**
 * Configuration for the genetic algorithm
 */
export interface GeneticAlgorithmConfig {
  /** Population size */
  populationSize: number;
  /** Maximum number of generations */
  maxGenerations: number;
  /** Base mutation rate (0-1) */
  mutationRate: number;
  /** Crossover probability (0-1) */
  crossoverRate: number;
  /** Selection method */
  selectionMethod: 'tournament' | 'roulette' | 'rank';
  /** Crossover method */
  crossoverMethod: 'single-point' | 'two-point' | 'uniform';
  /** Tournament size for tournament selection */
  tournamentSize?: number;
  /** Elitism: number of best individuals to preserve */
  elitism?: number;
  /** Enable adaptive mutation rate */
  adaptiveMutation?: boolean;
  /** Fitness threshold for early termination */
  fitnessThreshold?: number;
  /** Number of objectives for multi-objective optimization */
  numObjectives?: number;
}

/**
 * Result of running the genetic algorithm
 */
export interface GeneticAlgorithmResult<T = number> {
  /** Best solution found */
  bestChromosome: Chromosome<T>;
  /** Pareto frontier for multi-objective optimization */
  paretoFrontier?: Chromosome<T>[];
  /** Final population */
  population: Chromosome<T>[];
  /** Generation at which convergence occurred */
  convergenceGeneration: number;
  /** Total generations run */
  totalGenerations: number;
  /** Fitness history per generation */
  fitnessHistory: Array<{ generation: number; best: number; average: number; worst: number }>;
  /** Execution time in milliseconds */
  executionTimeMs: number;
}

/**
 * Gene encoding types for different problem domains
 */
export type GeneType = 'binary' | 'integer' | 'real' | 'permutation';

/**
 * Gene bounds for numeric genes
 */
export interface GeneBounds {
  min: number;
  max: number;
  type: GeneType;
}

// Random number generator with optional seed
function createRandom(seed?: number): () => number {
  if (seed === undefined) {
    return Math.random;
  }

  let s = seed;
  return function () {
    let t = (s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Generate unique ID
function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

/**
 * Genetic Algorithm Engine
 *
 * Provides evolutionary optimization for complex multi-objective problems.
 * Supports various selection, crossover, and mutation strategies with
 * adaptive parameters.
 */
export class GeneticAlgorithmEngine<T = number> {
  private config: Required<GeneticAlgorithmConfig>;
  private random: () => number;
  private generation: number = 0;
  private population: Chromosome<T>[] = [];
  private fitnessHistory: Array<{ generation: number; best: number; average: number; worst: number }> = [];
  private currentMutationRate: number;

  /**
   * Creates a new Genetic Algorithm engine
   * @param config - Configuration options
   * @param seed - Random seed for reproducibility
   */
  constructor(config: Partial<GeneticAlgorithmConfig> = {}, seed?: number) {
    this.config = {
      populationSize: config.populationSize ?? 100,
      maxGenerations: config.maxGenerations ?? 100,
      mutationRate: config.mutationRate ?? 0.01,
      crossoverRate: config.crossoverRate ?? 0.8,
      selectionMethod: config.selectionMethod ?? 'tournament',
      crossoverMethod: config.crossoverMethod ?? 'single-point',
      tournamentSize: config.tournamentSize ?? 3,
      elitism: config.elitism ?? 2,
      adaptiveMutation: config.adaptiveMutation ?? true,
      fitnessThreshold: config.fitnessThreshold ?? Infinity,
      numObjectives: config.numObjectives ?? 1,
    };
    this.random = createRandom(seed);
    this.currentMutationRate = this.config.mutationRate;
  }

  /**
   * Initialize population with random chromosomes
   * @param geneLength - Number of genes per chromosome
   * @param bounds - Bounds for each gene or single bounds for all
   * @param initializer - Optional custom gene initializer
   *
   * O(populationSize * geneLength) time complexity
   */
  initializePopulation(
    geneLength: number,
    bounds?: GeneBounds | GeneBounds[],
    initializer?: (index: number) => T
  ): void {
    this.population = [];
    this.generation = 0;
    this.fitnessHistory = [];

    for (let i = 0; i < this.config.populationSize; i++) {
      const genes: T[] = [];

      for (let j = 0; j < geneLength; j++) {
        if (initializer) {
          genes.push(initializer(j));
        } else if (bounds) {
          const geneBounds = Array.isArray(bounds) ? bounds[j] : bounds;
          genes.push(this.randomGene(geneBounds) as T);
        } else {
          genes.push(this.random() as T);
        }
      }

      this.population.push({
        genes,
        fitness: 0,
        generation: 0,
        id: generateId(),
      });
    }
  }

  /**
   * Generate a random gene value within bounds
   * @param bounds - Gene bounds
   * @returns Random gene value
   *
   * O(1) time complexity
   */
  private randomGene(bounds: GeneBounds): number {
    switch (bounds.type) {
      case 'binary':
        return this.random() < 0.5 ? 0 : 1;
      case 'integer':
        return Math.floor(bounds.min + this.random() * (bounds.max - bounds.min + 1));
      case 'real':
        return bounds.min + this.random() * (bounds.max - bounds.min);
      case 'permutation':
        return Math.floor(this.random() * (bounds.max - bounds.min + 1));
      default:
        return this.random();
    }
  }

  /**
   * Evaluate fitness for all chromosomes in population
   * @param fitnessFunction - Function that calculates fitness from genes
   *
   * O(populationSize * fitnessFunction) time complexity
   */
  evaluateFitness(
    fitnessFunction: (genes: T[]) => number,
    objectiveFunctions?: Array<(genes: T[]) => number>
  ): void {
    for (const chromosome of this.population) {
      chromosome.fitness = fitnessFunction(chromosome.genes);

      if (objectiveFunctions && objectiveFunctions.length > 0) {
        chromosome.objectives = objectiveFunctions.map(fn => fn(chromosome.genes));
      }
    }

    // Sort by fitness (descending)
    this.population.sort((a, b) => b.fitness - a.fitness);

    // Record fitness history
    const fitnesses = this.population.map(c => c.fitness);
    this.fitnessHistory.push({
      generation: this.generation,
      best: fitnesses[0],
      average: fitnesses.reduce((a, b) => a + b, 0) / fitnesses.length,
      worst: fitnesses[fitnesses.length - 1],
    });
  }

  /**
   * Tournament selection
   *
   * Selects the best individual from a random subset of the population.
   * Higher tournament size increases selection pressure.
   *
   * @returns Selected chromosome
   *
   * O(tournamentSize) time complexity
   */
  private tournamentSelection(): Chromosome<T> {
    const tournamentSize = Math.min(this.config.tournamentSize, this.population.length);
    let best: Chromosome<T> | null = null;

    for (let i = 0; i < tournamentSize; i++) {
      const index = Math.floor(this.random() * this.population.length);
      const candidate = this.population[index];

      if (!best || candidate.fitness > best.fitness) {
        best = candidate;
      }
    }

    return best!;
  }

  /**
   * Roulette wheel selection (fitness proportionate)
   *
   * Probability of selection proportional to fitness.
   * Works best when all fitness values are positive.
   *
   * @returns Selected chromosome
   *
   * O(populationSize) time complexity
   */
  private rouletteSelection(): Chromosome<T> {
    // Handle negative fitness by shifting all values
    const minFitness = Math.min(...this.population.map(c => c.fitness));
    const shift = minFitness < 0 ? -minFitness + 1 : 0;

    const totalFitness = this.population.reduce((sum, c) => sum + c.fitness + shift, 0);
    let target = this.random() * totalFitness;

    for (const chromosome of this.population) {
      target -= chromosome.fitness + shift;
      if (target <= 0) {
        return chromosome;
      }
    }

    return this.population[this.population.length - 1];
  }

  /**
   * Rank-based selection
   *
   * Selection probability based on rank rather than raw fitness.
   * More robust to fitness scaling issues.
   *
   * @returns Selected chromosome
   *
   * O(populationSize) time complexity
   */
  private rankSelection(): Chromosome<T> {
    // Population is already sorted by fitness
    const n = this.population.length;
    const totalRank = (n * (n + 1)) / 2;
    let target = this.random() * totalRank;

    for (let i = 0; i < n; i++) {
      const rank = n - i; // Highest fitness gets highest rank
      target -= rank;
      if (target <= 0) {
        return this.population[i];
      }
    }

    return this.population[0];
  }

  /**
   * Select a parent using the configured selection method
   * @returns Selected chromosome
   *
   * O(tournamentSize) or O(populationSize) depending on method
   */
  private select(): Chromosome<T> {
    switch (this.config.selectionMethod) {
      case 'tournament':
        return this.tournamentSelection();
      case 'roulette':
        return this.rouletteSelection();
      case 'rank':
        return this.rankSelection();
      default:
        return this.tournamentSelection();
    }
  }

  /**
   * Single-point crossover
   *
   * Exchanges genetic material at a single random point.
   *
   * @param parent1 - First parent
   * @param parent2 - Second parent
   * @returns Two offspring
   *
   * O(geneLength) time complexity
   */
  private singlePointCrossover(parent1: Chromosome<T>, parent2: Chromosome<T>): [Chromosome<T>, Chromosome<T>] {
    const point = Math.floor(this.random() * parent1.genes.length);

    const child1Genes = [...parent1.genes.slice(0, point), ...parent2.genes.slice(point)];
    const child2Genes = [...parent2.genes.slice(0, point), ...parent1.genes.slice(point)];

    return [
      { genes: child1Genes, fitness: 0, generation: this.generation, id: generateId(), parentIds: [parent1.id!, parent2.id!] },
      { genes: child2Genes, fitness: 0, generation: this.generation, id: generateId(), parentIds: [parent1.id!, parent2.id!] },
    ];
  }

  /**
   * Two-point crossover
   *
   * Exchanges genetic material between two random points.
   *
   * @param parent1 - First parent
   * @param parent2 - Second parent
   * @returns Two offspring
   *
   * O(geneLength) time complexity
   */
  private twoPointCrossover(parent1: Chromosome<T>, parent2: Chromosome<T>): [Chromosome<T>, Chromosome<T>] {
    const length = parent1.genes.length;
    let point1 = Math.floor(this.random() * length);
    let point2 = Math.floor(this.random() * length);

    if (point1 > point2) {
      [point1, point2] = [point2, point1];
    }

    const child1Genes = [
      ...parent1.genes.slice(0, point1),
      ...parent2.genes.slice(point1, point2),
      ...parent1.genes.slice(point2),
    ];

    const child2Genes = [
      ...parent2.genes.slice(0, point1),
      ...parent1.genes.slice(point1, point2),
      ...parent2.genes.slice(point2),
    ];

    return [
      { genes: child1Genes, fitness: 0, generation: this.generation, id: generateId(), parentIds: [parent1.id!, parent2.id!] },
      { genes: child2Genes, fitness: 0, generation: this.generation, id: generateId(), parentIds: [parent1.id!, parent2.id!] },
    ];
  }

  /**
   * Uniform crossover
   *
   * Each gene is independently inherited from either parent with equal probability.
   *
   * @param parent1 - First parent
   * @param parent2 - Second parent
   * @returns Two offspring
   *
   * O(geneLength) time complexity
   */
  private uniformCrossover(parent1: Chromosome<T>, parent2: Chromosome<T>): [Chromosome<T>, Chromosome<T>] {
    const child1Genes: T[] = [];
    const child2Genes: T[] = [];

    for (let i = 0; i < parent1.genes.length; i++) {
      if (this.random() < 0.5) {
        child1Genes.push(parent1.genes[i]);
        child2Genes.push(parent2.genes[i]);
      } else {
        child1Genes.push(parent2.genes[i]);
        child2Genes.push(parent1.genes[i]);
      }
    }

    return [
      { genes: child1Genes, fitness: 0, generation: this.generation, id: generateId(), parentIds: [parent1.id!, parent2.id!] },
      { genes: child2Genes, fitness: 0, generation: this.generation, id: generateId(), parentIds: [parent1.id!, parent2.id!] },
    ];
  }

  /**
   * Perform crossover using the configured method
   * @param parent1 - First parent
   * @param parent2 - Second parent
   * @returns Two offspring (or clones if crossover doesn't occur)
   *
   * O(geneLength) time complexity
   */
  private crossover(parent1: Chromosome<T>, parent2: Chromosome<T>): [Chromosome<T>, Chromosome<T>] {
    // Check if crossover should occur
    if (this.random() > this.config.crossoverRate) {
      return [
        { ...parent1, genes: [...parent1.genes], fitness: 0, generation: this.generation, id: generateId() },
        { ...parent2, genes: [...parent2.genes], fitness: 0, generation: this.generation, id: generateId() },
      ];
    }

    switch (this.config.crossoverMethod) {
      case 'single-point':
        return this.singlePointCrossover(parent1, parent2);
      case 'two-point':
        return this.twoPointCrossover(parent1, parent2);
      case 'uniform':
        return this.uniformCrossover(parent1, parent2);
      default:
        return this.singlePointCrossover(parent1, parent2);
    }
  }

  /**
   * Mutate a chromosome with adaptive mutation rate
   *
   * @param chromosome - Chromosome to mutate
   * @param bounds - Gene bounds for mutation
   * @returns Mutated chromosome
   *
   * O(geneLength) time complexity
   */
  mutate(chromosome: Chromosome<T>, bounds?: GeneBounds | GeneBounds[]): Chromosome<T> {
    const mutatedGenes = chromosome.genes.map((gene, i) => {
      if (this.random() < this.currentMutationRate) {
        if (bounds) {
          const geneBounds = Array.isArray(bounds) ? bounds[i] : bounds;
          return this.mutateGene(gene as number, geneBounds) as T;
        } else if (typeof gene === 'number') {
          // Default mutation for numeric genes
          return (gene + (this.random() - 0.5) * 0.2) as T;
        }
      }
      return gene;
    });

    return {
      ...chromosome,
      genes: mutatedGenes,
      fitness: 0,
    };
  }

  /**
   * Mutate a single gene within bounds
   * @param gene - Current gene value
   * @param bounds - Gene bounds
   * @returns Mutated gene value
   *
   * O(1) time complexity
   */
  private mutateGene(gene: number, bounds: GeneBounds): number {
    switch (bounds.type) {
      case 'binary':
        return gene === 0 ? 1 : 0;
      case 'integer': {
        const delta = Math.floor((this.random() - 0.5) * (bounds.max - bounds.min) * 0.2);
        return Math.max(bounds.min, Math.min(bounds.max, gene + delta));
      }
      case 'real': {
        const range = bounds.max - bounds.min;
        const delta = (this.random() - 0.5) * range * 0.2;
        return Math.max(bounds.min, Math.min(bounds.max, gene + delta));
      }
      case 'permutation':
        return Math.floor(this.random() * (bounds.max - bounds.min + 1));
      default:
        return gene;
    }
  }

  /**
   * Update adaptive mutation rate based on population diversity and progress
   *
   * O(populationSize) time complexity
   */
  private updateAdaptiveMutationRate(): void {
    if (!this.config.adaptiveMutation) return;

    // Calculate population diversity (variance in fitness)
    const fitnesses = this.population.map(c => c.fitness);
    const avgFitness = fitnesses.reduce((a, b) => a + b, 0) / fitnesses.length;
    const variance = fitnesses.reduce((sum, f) => sum + Math.pow(f - avgFitness, 2), 0) / fitnesses.length;
    const stdDev = Math.sqrt(variance);
    const diversity = stdDev / (Math.abs(avgFitness) + 1e-10);

    // Low diversity -> increase mutation rate
    // High diversity -> decrease mutation rate
    const baseMutationRate = this.config.mutationRate;
    const diversityFactor = Math.max(0.5, Math.min(2.0, 1 / (diversity + 0.1)));

    // Also consider improvement rate
    if (this.fitnessHistory.length >= 2) {
      const recent = this.fitnessHistory.slice(-5);
      const improvement = recent[recent.length - 1].best - recent[0].best;
      if (improvement < 1e-6) {
        // No improvement -> increase mutation
        this.currentMutationRate = Math.min(0.5, baseMutationRate * diversityFactor * 1.5);
      } else {
        this.currentMutationRate = baseMutationRate * diversityFactor;
      }
    }
  }

  /**
   * Evolve one generation
   * @param bounds - Optional gene bounds for mutation
   *
   * O(populationSize * geneLength) time complexity
   */
  evolveGeneration(bounds?: GeneBounds | GeneBounds[]): void {
    const newPopulation: Chromosome<T>[] = [];

    // Elitism: preserve best individuals
    for (let i = 0; i < this.config.elitism && i < this.population.length; i++) {
      newPopulation.push({
        ...this.population[i],
        genes: [...this.population[i].genes],
      });
    }

    // Generate rest of population through selection and crossover
    while (newPopulation.length < this.config.populationSize) {
      const parent1 = this.select();
      const parent2 = this.select();

      const [child1, child2] = this.crossover(parent1, parent2);

      // Mutate children
      newPopulation.push(this.mutate(child1, bounds));
      if (newPopulation.length < this.config.populationSize) {
        newPopulation.push(this.mutate(child2, bounds));
      }
    }

    this.population = newPopulation;
    this.generation++;

    // Update adaptive mutation rate
    this.updateAdaptiveMutationRate();
  }

  /**
   * Calculate Pareto frontier for multi-objective optimization
   *
   * A solution is on the Pareto frontier if no other solution dominates it
   * (i.e., is better in all objectives).
   *
   * @returns Chromosomes on the Pareto frontier
   *
   * O(populationSize^2 * numObjectives) time complexity
   */
  calculateParetoFrontier(): Chromosome<T>[] {
    if (this.config.numObjectives <= 1) {
      return [this.population[0]]; // Single objective: just return best
    }

    const dominated = new Set<number>();

    // Check each pair for dominance
    for (let i = 0; i < this.population.length; i++) {
      if (dominated.has(i)) continue;

      for (let j = 0; j < this.population.length; j++) {
        if (i === j || dominated.has(j)) continue;

        const objI = this.population[i].objectives;
        const objJ = this.population[j].objectives;

        if (!objI || !objJ) continue;

        // Check if j dominates i
        let jDominates = true;
        let jStrictlyBetter = false;

        for (let k = 0; k < objI.length; k++) {
          if (objJ[k] < objI[k]) {
            jDominates = false;
            break;
          }
          if (objJ[k] > objI[k]) {
            jStrictlyBetter = true;
          }
        }

        if (jDominates && jStrictlyBetter) {
          dominated.add(i);
          break;
        }
      }
    }

    // Return non-dominated solutions
    return this.population.filter((_, i) => !dominated.has(i));
  }

  /**
   * Run the genetic algorithm to completion
   * @param fitnessFunction - Function to evaluate fitness
   * @param bounds - Optional gene bounds
   * @param objectiveFunctions - Optional objective functions for multi-objective
   * @returns Algorithm results
   *
   * O(maxGenerations * populationSize * (geneLength + fitnessFunction)) time complexity
   */
  run(
    fitnessFunction: (genes: T[]) => number,
    bounds?: GeneBounds | GeneBounds[],
    objectiveFunctions?: Array<(genes: T[]) => number>
  ): GeneticAlgorithmResult<T> {
    const startTime = Date.now();
    let convergenceGeneration = 0;
    let bestFitness = -Infinity;
    let noImprovementCount = 0;

    // Initial evaluation
    this.evaluateFitness(fitnessFunction, objectiveFunctions);

    while (this.generation < this.config.maxGenerations) {
      // Check for fitness threshold
      if (this.population[0].fitness >= this.config.fitnessThreshold) {
        break;
      }

      // Check for convergence
      if (this.population[0].fitness > bestFitness) {
        bestFitness = this.population[0].fitness;
        convergenceGeneration = this.generation;
        noImprovementCount = 0;
      } else {
        noImprovementCount++;
      }

      // Early termination if no improvement for many generations
      if (noImprovementCount > this.config.maxGenerations / 5) {
        break;
      }

      // Evolve and evaluate
      this.evolveGeneration(bounds);
      this.evaluateFitness(fitnessFunction, objectiveFunctions);
    }

    return {
      bestChromosome: this.population[0],
      paretoFrontier: this.config.numObjectives > 1 ? this.calculateParetoFrontier() : undefined,
      population: [...this.population],
      convergenceGeneration,
      totalGenerations: this.generation,
      fitnessHistory: [...this.fitnessHistory],
      executionTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Get current population
   * @returns Array of chromosomes
   *
   * O(1) time complexity
   */
  getPopulation(): Chromosome<T>[] {
    return [...this.population];
  }

  /**
   * Get current generation number
   * @returns Generation number
   *
   * O(1) time complexity
   */
  getGeneration(): number {
    return this.generation;
  }

  /**
   * Get current mutation rate (may differ from config if adaptive)
   * @returns Current mutation rate
   *
   * O(1) time complexity
   */
  getCurrentMutationRate(): number {
    return this.currentMutationRate;
  }

  /**
   * Get fitness history
   * @returns Array of fitness statistics per generation
   *
   * O(1) time complexity
   */
  getFitnessHistory(): Array<{ generation: number; best: number; average: number; worst: number }> {
    return [...this.fitnessHistory];
  }
}

// Factory function
export function createGeneticAlgorithm<T = number>(
  config?: Partial<GeneticAlgorithmConfig>,
  seed?: number
): GeneticAlgorithmEngine<T> {
  return new GeneticAlgorithmEngine<T>(config, seed);
}

// Default singleton
export const geneticAlgorithmEngine = new GeneticAlgorithmEngine();
