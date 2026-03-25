/**
 * Simulated Annealing Scheduler
 * Story alg-6 - Near-optimal scheduling for complex constraints
 *
 * Implements Simulated Annealing with various cooling schedules, constraint
 * satisfaction, and neighbor generation strategies for optimization problems.
 */

/**
 * Represents a solution in the search space
 */
export interface Solution<T = number[]> {
  /** Solution representation */
  value: T;
  /** Energy (cost) of the solution - lower is better */
  energy: number;
  /** Constraint violations (0 = no violations) */
  constraintViolations: number;
  /** Total cost including penalties */
  totalCost: number;
  /** Solution metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Cooling schedule types
 */
export type CoolingSchedule = 'geometric' | 'linear' | 'adaptive' | 'exponential' | 'logarithmic';

/**
 * Neighbor generation strategy
 */
export type NeighborStrategy = 'swap' | 'insert' | 'reverse' | 'random' | 'gaussian' | 'mixed';

/**
 * Constraint definition
 */
export interface Constraint<T = number[]> {
  /** Constraint identifier */
  id: string;
  /** Constraint description */
  description: string;
  /** Whether this is a hard constraint (must be satisfied) */
  isHard: boolean;
  /** Penalty weight for soft constraints */
  penaltyWeight: number;
  /** Constraint evaluation function - returns violation amount (0 = satisfied) */
  evaluate: (solution: T) => number;
}

/**
 * Configuration for Simulated Annealing
 */
export interface SimulatedAnnealingConfig {
  /** Initial temperature */
  initialTemperature: number;
  /** Final temperature (stopping condition) */
  finalTemperature: number;
  /** Cooling rate for geometric schedule (0 < rate < 1) */
  coolingRate: number;
  /** Maximum iterations */
  maxIterations: number;
  /** Iterations at each temperature */
  iterationsPerTemperature: number;
  /** Cooling schedule type */
  coolingSchedule: CoolingSchedule;
  /** Neighbor generation strategy */
  neighborStrategy: NeighborStrategy;
  /** Penalty multiplier for constraint violations */
  constraintPenaltyMultiplier: number;
  /** Reheating factor when stuck */
  reheatFactor: number;
  /** Iterations without improvement before reheating */
  reheatThreshold: number;
}

/**
 * Quality metrics for the optimization
 */
export interface QualityMetrics {
  /** Best solution found */
  bestEnergy: number;
  /** Initial solution energy */
  initialEnergy: number;
  /** Improvement percentage */
  improvementPercent: number;
  /** Total iterations run */
  totalIterations: number;
  /** Acceptance rate (accepted / proposed) */
  acceptanceRate: number;
  /** Number of times solution was reheated */
  reheats: number;
  /** Iterations to find best solution */
  iterationsToBest: number;
  /** Final temperature */
  finalTemperatureReached: number;
  /** Constraint satisfaction rate */
  constraintSatisfactionRate: number;
  /** Execution time in milliseconds */
  executionTimeMs: number;
}

/**
 * Result of simulated annealing
 */
export interface AnnealingResult<T = number[]> {
  /** Best solution found */
  bestSolution: Solution<T>;
  /** Quality metrics */
  metrics: QualityMetrics;
  /** Energy history (sampled) */
  energyHistory: Array<{ iteration: number; energy: number; temperature: number }>;
  /** Whether convergence was detected */
  converged: boolean;
}

// Random number generator
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

/**
 * Simulated Annealing Scheduler
 *
 * Provides near-optimal solutions for complex optimization problems
 * with constraints through probabilistic hill climbing.
 */
export class SimulatedAnnealingScheduler<T = number[]> {
  private config: SimulatedAnnealingConfig;
  private random: () => number;
  private constraints: Constraint<T>[] = [];
  private energyFunction: ((solution: T) => number) | null = null;
  private neighborFunction: ((solution: T, temperature: number) => T) | null = null;

  /**
   * Creates a new Simulated Annealing scheduler
   * @param config - Configuration options
   * @param seed - Random seed for reproducibility
   */
  constructor(config: Partial<SimulatedAnnealingConfig> = {}, seed?: number) {
    this.config = {
      initialTemperature: config.initialTemperature ?? 1000,
      finalTemperature: config.finalTemperature ?? 0.01,
      coolingRate: config.coolingRate ?? 0.95,
      maxIterations: config.maxIterations ?? 100000,
      iterationsPerTemperature: config.iterationsPerTemperature ?? 100,
      coolingSchedule: config.coolingSchedule ?? 'geometric',
      neighborStrategy: config.neighborStrategy ?? 'mixed',
      constraintPenaltyMultiplier: config.constraintPenaltyMultiplier ?? 1000,
      reheatFactor: config.reheatFactor ?? 1.5,
      reheatThreshold: config.reheatThreshold ?? 1000,
    };
    this.random = createRandom(seed);
  }

  /**
   * Set the energy function
   * @param fn - Function that calculates energy (cost) of a solution
   */
  setEnergyFunction(fn: (solution: T) => number): void {
    this.energyFunction = fn;
  }

  /**
   * Set custom neighbor generation function
   * @param fn - Function that generates a neighbor solution
   */
  setNeighborFunction(fn: (solution: T, temperature: number) => T): void {
    this.neighborFunction = fn;
  }

  /**
   * Add a constraint
   * @param constraint - Constraint to add
   */
  addConstraint(constraint: Constraint<T>): void {
    this.constraints.push(constraint);
  }

  /**
   * Add multiple constraints
   * @param constraints - Constraints to add
   */
  addConstraints(constraints: Constraint<T>[]): void {
    this.constraints.push(...constraints);
  }

  /**
   * Clear all constraints
   */
  clearConstraints(): void {
    this.constraints = [];
  }

  /**
   * Calculate total constraint violation
   * @param solution - Solution to evaluate
   * @returns Total violation and penalty
   *
   * O(c) time complexity where c = number of constraints
   */
  private evaluateConstraints(solution: T): { violations: number; penalty: number } {
    let totalViolations = 0;
    let totalPenalty = 0;

    for (const constraint of this.constraints) {
      const violation = constraint.evaluate(solution);

      if (violation > 0) {
        totalViolations += violation;

        if (constraint.isHard) {
          // Hard constraint - very high penalty
          totalPenalty += violation * this.config.constraintPenaltyMultiplier * 1000;
        } else {
          // Soft constraint - weighted penalty
          totalPenalty += violation * constraint.penaltyWeight;
        }
      }
    }

    return { violations: totalViolations, penalty: totalPenalty };
  }

  /**
   * Calculate total cost of a solution
   * @param solution - Solution value
   * @returns Complete solution object with costs
   *
   * O(energyFunction + constraints) time complexity
   */
  private evaluateSolution(solutionValue: T): Solution<T> {
    const energy = this.energyFunction ? this.energyFunction(solutionValue) : 0;
    const { violations, penalty } = this.evaluateConstraints(solutionValue);

    return {
      value: solutionValue,
      energy,
      constraintViolations: violations,
      totalCost: energy + penalty,
    };
  }

  /**
   * Calculate temperature for next step
   * @param iteration - Current iteration
   * @param currentTemp - Current temperature
   * @param acceptanceRate - Recent acceptance rate
   * @returns New temperature
   *
   * O(1) time complexity
   */
  private getNextTemperature(
    iteration: number,
    currentTemp: number,
    acceptanceRate: number
  ): number {
    switch (this.config.coolingSchedule) {
      case 'geometric':
        return currentTemp * this.config.coolingRate;

      case 'linear': {
        const totalSteps = this.config.maxIterations / this.config.iterationsPerTemperature;
        const step = Math.floor(iteration / this.config.iterationsPerTemperature);
        const range = this.config.initialTemperature - this.config.finalTemperature;
        return this.config.initialTemperature - (range * step / totalSteps);
      }

      case 'exponential':
        return this.config.initialTemperature *
          Math.exp(-iteration / (this.config.maxIterations / 10));

      case 'logarithmic':
        return this.config.initialTemperature / (1 + Math.log(1 + iteration));

      case 'adaptive': {
        // Adjust cooling based on acceptance rate
        // High acceptance -> cool faster, low acceptance -> cool slower
        const targetAcceptance = 0.3;
        const factor = acceptanceRate > targetAcceptance ?
          this.config.coolingRate :
          Math.sqrt(this.config.coolingRate);
        return currentTemp * factor;
      }

      default:
        return currentTemp * this.config.coolingRate;
    }
  }

  /**
   * Generate a neighbor solution using default strategies
   * @param current - Current solution
   * @param temperature - Current temperature
   * @returns Neighbor solution
   *
   * O(n) time complexity where n = solution length
   */
  private generateNeighborDefault(current: number[], temperature: number): number[] {
    const neighbor = [...current];
    const n = neighbor.length;

    if (n === 0) return neighbor;

    // Adaptive step size based on temperature
    const normalizedTemp = temperature / this.config.initialTemperature;

    switch (this.config.neighborStrategy) {
      case 'swap': {
        // Swap two random elements
        const i = Math.floor(this.random() * n);
        let j = Math.floor(this.random() * n);
        while (j === i && n > 1) {
          j = Math.floor(this.random() * n);
        }
        [neighbor[i], neighbor[j]] = [neighbor[j], neighbor[i]];
        break;
      }

      case 'insert': {
        // Remove element and insert at new position
        const fromIdx = Math.floor(this.random() * n);
        const toIdx = Math.floor(this.random() * n);
        const element = neighbor.splice(fromIdx, 1)[0];
        neighbor.splice(toIdx, 0, element);
        break;
      }

      case 'reverse': {
        // Reverse a subsequence
        let i = Math.floor(this.random() * n);
        let j = Math.floor(this.random() * n);
        if (i > j) [i, j] = [j, i];
        while (i < j) {
          [neighbor[i], neighbor[j]] = [neighbor[j], neighbor[i]];
          i++;
          j--;
        }
        break;
      }

      case 'gaussian': {
        // Gaussian perturbation
        const idx = Math.floor(this.random() * n);
        const scale = normalizedTemp * 0.5;
        // Box-Muller transform for normal distribution
        const u1 = this.random();
        const u2 = this.random();
        const normal = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        neighbor[idx] += normal * scale;
        break;
      }

      case 'random': {
        // Random value within bounds (assuming 0-1 range)
        const idx = Math.floor(this.random() * n);
        neighbor[idx] = this.random();
        break;
      }

      case 'mixed':
      default: {
        // Mix of strategies based on temperature
        const strategyRoll = this.random();
        if (strategyRoll < 0.3) {
          // Swap
          const i = Math.floor(this.random() * n);
          let j = Math.floor(this.random() * n);
          while (j === i && n > 1) {
            j = Math.floor(this.random() * n);
          }
          [neighbor[i], neighbor[j]] = [neighbor[j], neighbor[i]];
        } else if (strategyRoll < 0.6) {
          // Gaussian
          const idx = Math.floor(this.random() * n);
          const scale = normalizedTemp * 0.3;
          const u1 = this.random();
          const u2 = this.random();
          const normal = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
          neighbor[idx] += normal * scale;
        } else if (strategyRoll < 0.8) {
          // Insert
          const fromIdx = Math.floor(this.random() * n);
          const toIdx = Math.floor(this.random() * n);
          const element = neighbor.splice(fromIdx, 1)[0];
          neighbor.splice(toIdx, 0, element);
        } else {
          // Reverse
          let i = Math.floor(this.random() * n);
          let j = Math.floor(this.random() * n);
          if (i > j) [i, j] = [j, i];
          while (i < j) {
            [neighbor[i], neighbor[j]] = [neighbor[j], neighbor[i]];
            i++;
            j--;
          }
        }
        break;
      }
    }

    return neighbor;
  }

  /**
   * Generate a neighbor solution
   * @param current - Current solution
   * @param temperature - Current temperature
   * @returns Neighbor solution
   *
   * O(neighborFunction) time complexity
   */
  private generateNeighbor(current: T, temperature: number): T {
    if (this.neighborFunction) {
      return this.neighborFunction(current, temperature);
    }

    // Default implementation for number arrays
    if (Array.isArray(current) && (current.length === 0 || typeof current[0] === 'number')) {
      return this.generateNeighborDefault(current as number[], temperature) as T;
    }

    throw new Error('Custom neighbor function required for non-numeric solutions');
  }

  /**
   * Calculate acceptance probability
   * @param currentEnergy - Current solution energy
   * @param neighborEnergy - Neighbor solution energy
   * @param temperature - Current temperature
   * @returns Probability of accepting the neighbor
   *
   * O(1) time complexity
   */
  private acceptanceProbability(
    currentEnergy: number,
    neighborEnergy: number,
    temperature: number
  ): number {
    if (neighborEnergy < currentEnergy) {
      return 1.0; // Always accept better solutions
    }

    // Metropolis criterion
    return Math.exp((currentEnergy - neighborEnergy) / temperature);
  }

  /**
   * Detect convergence based on energy variance
   * @param recentEnergies - Recent energy values
   * @returns Whether algorithm has converged
   *
   * O(n) time complexity where n = recentEnergies length
   */
  private detectConvergence(recentEnergies: number[]): boolean {
    if (recentEnergies.length < 100) return false;

    const recent = recentEnergies.slice(-100);
    const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const variance = recent.reduce((sum, e) => sum + Math.pow(e - avg, 2), 0) / recent.length;
    const stdDev = Math.sqrt(variance);

    // Converged if standard deviation is less than 0.1% of average
    return stdDev < Math.abs(avg) * 0.001;
  }

  /**
   * Run simulated annealing optimization
   * @param initialSolution - Starting solution
   * @returns Optimization result
   *
   * O(maxIterations * (energyFunction + neighborFunction + constraints)) time complexity
   */
  optimize(initialSolution: T): AnnealingResult<T> {
    const startTime = Date.now();

    // Initialize
    let current = this.evaluateSolution(initialSolution);
    let best = { ...current };
    let temperature = this.config.initialTemperature;

    // Metrics tracking
    let totalAccepted = 0;
    let totalProposed = 0;
    let iterationsSinceImprovement = 0;
    let reheats = 0;
    let iterationsToBest = 0;

    // History tracking (sampled)
    const energyHistory: Array<{ iteration: number; energy: number; temperature: number }> = [];
    const recentEnergies: number[] = [];
    const historyInterval = Math.max(1, Math.floor(this.config.maxIterations / 1000));

    let iteration = 0;
    let converged = false;

    // Main optimization loop
    while (iteration < this.config.maxIterations && temperature > this.config.finalTemperature) {
      // Iterations at current temperature
      let tempAccepted = 0;

      for (let i = 0; i < this.config.iterationsPerTemperature; i++) {
        iteration++;
        totalProposed++;

        // Generate and evaluate neighbor
        const neighborValue = this.generateNeighbor(current.value, temperature);
        const neighbor = this.evaluateSolution(neighborValue);

        // Acceptance decision
        const acceptProb = this.acceptanceProbability(
          current.totalCost,
          neighbor.totalCost,
          temperature
        );

        if (this.random() < acceptProb) {
          current = neighbor;
          totalAccepted++;
          tempAccepted++;

          // Update best if improved
          if (current.totalCost < best.totalCost) {
            best = { ...current };
            iterationsToBest = iteration;
            iterationsSinceImprovement = 0;
          }
        }

        // Track for convergence detection
        recentEnergies.push(current.totalCost);
        if (recentEnergies.length > 200) {
          recentEnergies.shift();
        }
      }

      // Record history (sampled)
      if (iteration % historyInterval === 0) {
        energyHistory.push({
          iteration,
          energy: current.totalCost,
          temperature,
        });
      }

      // Calculate acceptance rate at this temperature
      const tempAcceptanceRate = tempAccepted / this.config.iterationsPerTemperature;

      // Cool down
      const previousTemp = temperature;
      temperature = this.getNextTemperature(iteration, temperature, tempAcceptanceRate);

      // Ensure temperature decreases
      if (temperature >= previousTemp) {
        temperature = previousTemp * this.config.coolingRate;
      }

      // Check for stuck condition and reheat
      iterationsSinceImprovement++;
      if (iterationsSinceImprovement >= this.config.reheatThreshold) {
        temperature = Math.min(
          temperature * this.config.reheatFactor,
          this.config.initialTemperature * 0.5
        );
        reheats++;
        iterationsSinceImprovement = 0;
      }

      // Check convergence
      if (this.detectConvergence(recentEnergies)) {
        converged = true;
        break;
      }
    }

    // Calculate final metrics
    const constraintsEvaluated = this.constraints.length > 0;
    let satisfiedConstraints = 0;
    for (const constraint of this.constraints) {
      if (constraint.evaluate(best.value) === 0) {
        satisfiedConstraints++;
      }
    }

    const metrics: QualityMetrics = {
      bestEnergy: best.energy,
      initialEnergy: this.evaluateSolution(initialSolution).energy,
      improvementPercent: this.evaluateSolution(initialSolution).energy > 0 ?
        ((this.evaluateSolution(initialSolution).energy - best.energy) /
          this.evaluateSolution(initialSolution).energy) * 100 : 0,
      totalIterations: iteration,
      acceptanceRate: totalProposed > 0 ? totalAccepted / totalProposed : 0,
      reheats,
      iterationsToBest,
      finalTemperatureReached: temperature,
      constraintSatisfactionRate: constraintsEvaluated ?
        satisfiedConstraints / this.constraints.length : 1,
      executionTimeMs: Date.now() - startTime,
    };

    return {
      bestSolution: best,
      metrics,
      energyHistory,
      converged,
    };
  }

  /**
   * Run multiple times and return best result
   * @param initialSolutions - Array of starting solutions
   * @returns Best result from all runs
   *
   * O(runs * optimize) time complexity
   */
  optimizeMultiStart(initialSolutions: T[]): AnnealingResult<T> {
    let bestResult: AnnealingResult<T> | null = null;

    for (const initial of initialSolutions) {
      const result = this.optimize(initial);

      if (!bestResult || result.bestSolution.totalCost < bestResult.bestSolution.totalCost) {
        bestResult = result;
      }
    }

    return bestResult!;
  }

  // ==================== Pre-built Energy Functions ====================

  /**
   * Create energy function for scheduling (minimize makespan)
   * @param durations - Task durations
   * @param dependencies - Task dependencies (predecessor -> [successors])
   * @returns Energy function
   */
  static createSchedulingEnergy(
    durations: number[],
    dependencies: Map<number, number[]>
  ): (solution: number[]) => number {
    return (solution: number[]): number => {
      // Solution is a permutation representing task order
      const n = solution.length;
      const startTimes = new Array(n).fill(0);
      const endTimes = new Array(n).fill(0);

      // Calculate start/end times based on dependencies and order
      for (const taskIdx of solution) {
        let earliestStart = 0;

        // Check dependencies
        dependencies.forEach((successors, pred) => {
          if (successors.includes(taskIdx)) {
            earliestStart = Math.max(earliestStart, endTimes[pred]);
          }
        });

        startTimes[taskIdx] = earliestStart;
        endTimes[taskIdx] = earliestStart + durations[taskIdx];
      }

      // Makespan is the maximum end time
      return Math.max(...endTimes);
    };
  }

  /**
   * Create energy function for TSP (traveling salesman)
   * @param distances - Distance matrix
   * @returns Energy function
   */
  static createTSPEnergy(distances: number[][]): (solution: number[]) => number {
    return (solution: number[]): number => {
      let total = 0;
      for (let i = 0; i < solution.length - 1; i++) {
        total += distances[solution[i]][solution[i + 1]];
      }
      // Return to start
      total += distances[solution[solution.length - 1]][solution[0]];
      return total;
    };
  }

  /**
   * Create energy function for bin packing
   * @param items - Item sizes
   * @param binCapacity - Capacity of each bin
   * @returns Energy function
   */
  static createBinPackingEnergy(
    items: number[],
    binCapacity: number
  ): (solution: number[]) => number {
    return (solution: number[]): number => {
      // Solution is bin assignment for each item
      const bins = new Map<number, number>();

      for (let i = 0; i < items.length; i++) {
        const binIdx = solution[i];
        bins.set(binIdx, (bins.get(binIdx) ?? 0) + items[i]);
      }

      // Count bins and penalize overflow
      let numBins = bins.size;
      let overflowPenalty = 0;

      for (const [_, load] of bins) {
        if (load > binCapacity) {
          overflowPenalty += (load - binCapacity) * 10;
        }
      }

      return numBins + overflowPenalty;
    };
  }

  // ==================== Pre-built Constraints ====================

  /**
   * Create precedence constraint (task A must finish before task B starts)
   * @param predecessor - Index of predecessor task
   * @param successor - Index of successor task
   * @returns Constraint
   */
  static createPrecedenceConstraint(
    predecessor: number,
    successor: number
  ): Constraint<number[]> {
    return {
      id: `precedence-${predecessor}-${successor}`,
      description: `Task ${predecessor} must precede task ${successor}`,
      isHard: true,
      penaltyWeight: 1000,
      evaluate: (solution: number[]): number => {
        const predPos = solution.indexOf(predecessor);
        const succPos = solution.indexOf(successor);
        if (predPos === -1 || succPos === -1) return 0;
        return predPos < succPos ? 0 : 1;
      },
    };
  }

  /**
   * Create deadline constraint
   * @param taskIndex - Task index
   * @param deadline - Deadline time
   * @param durations - Task durations
   * @returns Constraint
   */
  static createDeadlineConstraint(
    taskIndex: number,
    deadline: number,
    durations: number[]
  ): Constraint<number[]> {
    return {
      id: `deadline-${taskIndex}-${deadline}`,
      description: `Task ${taskIndex} must complete by ${deadline}`,
      isHard: false,
      penaltyWeight: 100,
      evaluate: (solution: number[]): number => {
        // Calculate completion time of task
        let time = 0;
        for (const idx of solution) {
          time += durations[idx];
          if (idx === taskIndex) {
            return Math.max(0, time - deadline);
          }
        }
        return 0;
      },
    };
  }

  /**
   * Create resource constraint (max concurrent usage)
   * @param resourceUsage - Resource usage per task
   * @param maxCapacity - Maximum resource capacity
   * @returns Constraint
   */
  static createResourceConstraint(
    resourceUsage: number[],
    maxCapacity: number
  ): Constraint<number[]> {
    return {
      id: `resource-capacity-${maxCapacity}`,
      description: `Resource usage must not exceed ${maxCapacity}`,
      isHard: true,
      penaltyWeight: 500,
      evaluate: (solution: number[]): number => {
        // Check if any subset of concurrent tasks exceeds capacity
        let totalUsage = 0;
        for (const taskIdx of solution) {
          totalUsage = Math.max(totalUsage, resourceUsage[taskIdx]);
        }
        return Math.max(0, totalUsage - maxCapacity);
      },
    };
  }

  /**
   * Get current configuration
   * @returns Configuration copy
   *
   * O(1) time complexity
   */
  getConfig(): SimulatedAnnealingConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   * @param config - New configuration values
   *
   * O(1) time complexity
   */
  updateConfig(config: Partial<SimulatedAnnealingConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// Factory function
export function createSimulatedAnnealing<T = number[]>(
  config?: Partial<SimulatedAnnealingConfig>,
  seed?: number
): SimulatedAnnealingScheduler<T> {
  return new SimulatedAnnealingScheduler<T>(config, seed);
}

// Default singleton for number array solutions
export const simulatedAnnealingScheduler = new SimulatedAnnealingScheduler<number[]>();
