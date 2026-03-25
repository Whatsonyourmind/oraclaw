/**
 * Multi-Armed Bandit Algorithms
 * Story alg-1 - Decision Optimization using UCB1 and Thompson Sampling
 *
 * Implements exploration-exploitation trade-off for optimal decision selection.
 */

/**
 * Represents a single arm (option) in the bandit problem
 */
export interface BanditArm {
  /** Unique identifier for this arm */
  id: string;
  /** Human-readable name */
  name: string;
  /** Total reward accumulated from this arm */
  totalReward: number;
  /** Number of times this arm has been pulled */
  pulls: number;
  /** Beta distribution alpha parameter (successes + 1) for Thompson Sampling */
  alpha: number;
  /** Beta distribution beta parameter (failures + 1) for Thompson Sampling */
  beta: number;
  /** Additional metadata for context */
  metadata?: Record<string, unknown>;
}

/**
 * Configuration for the Multi-Armed Bandit
 */
export interface BanditConfig {
  /** Exploration constant for UCB1 (default: sqrt(2)) */
  explorationConstant?: number;
  /** Initial alpha for Thompson Sampling priors (default: 1) */
  initialAlpha?: number;
  /** Initial beta for Thompson Sampling priors (default: 1) */
  initialBeta?: number;
  /** Decay factor for rewards (0-1, 1 = no decay) */
  rewardDecay?: number;
}

/**
 * Result of arm selection with metadata
 */
export interface ArmSelection {
  /** Selected arm */
  arm: BanditArm;
  /** The score used to select this arm */
  score: number;
  /** Algorithm used for selection */
  algorithm: 'ucb1' | 'thompson' | 'epsilon-greedy';
  /** Exploitation component of score (for UCB1) */
  exploitationScore?: number;
  /** Exploration bonus component (for UCB1) */
  explorationBonus?: number;
}

/**
 * Reward history entry for tracking
 */
export interface RewardHistoryEntry {
  /** Timestamp of the reward */
  timestamp: number;
  /** Arm that received the reward */
  armId: string;
  /** Reward value (0-1 for binary, any number for continuous) */
  reward: number;
  /** Context in which reward was received */
  context?: Record<string, unknown>;
}

/**
 * Regret metrics for performance monitoring
 */
export interface RegretMetrics {
  /** Cumulative regret: sum of (optimal_reward - actual_reward) */
  cumulativeRegret: number;
  /** Average regret per pull */
  averageRegret: number;
  /** Estimated optimal arm based on current data */
  estimatedOptimalArm: string;
  /** Number of times optimal arm was selected */
  optimalArmPulls: number;
  /** Total number of pulls */
  totalPulls: number;
}

// Seeded random number generator for reproducibility
function createRandom(seed: number): () => number {
  let s = seed;
  return function () {
    let t = (s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Sample from Beta distribution using the Gamma distribution method
 * @param alpha - Alpha parameter (shape1)
 * @param beta - Beta parameter (shape2)
 * @param random - Random number generator
 * @returns Sample from Beta(alpha, beta)
 *
 * O(1) time complexity
 */
function betaSample(alpha: number, beta: number, random: () => number): number {
  const gamma1 = gammaSample(alpha, random);
  const gamma2 = gammaSample(beta, random);
  return gamma1 / (gamma1 + gamma2);
}

/**
 * Sample from Gamma distribution using Marsaglia and Tsang's method
 * @param shape - Shape parameter
 * @param random - Random number generator
 * @returns Sample from Gamma(shape, 1)
 *
 * O(1) expected time complexity
 */
function gammaSample(shape: number, random: () => number): number {
  if (shape < 1) {
    return gammaSample(shape + 1, random) * Math.pow(random(), 1 / shape);
  }

  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);

  while (true) {
    let x: number, v: number;
    do {
      // Box-Muller transform for normal sample
      const u1 = random();
      const u2 = random();
      x = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
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

/**
 * Multi-Armed Bandit Service
 *
 * Provides UCB1 and Thompson Sampling algorithms for optimal decision selection
 * under uncertainty. Used for A/B testing, recommendation systems, and
 * adaptive resource allocation.
 */
export class MultiArmedBanditService {
  private arms: Map<string, BanditArm> = new Map();
  private rewardHistory: RewardHistoryEntry[] = [];
  private config: Required<BanditConfig>;
  private random: () => number;
  private totalPulls: number = 0;

  /**
   * Creates a new Multi-Armed Bandit service
   * @param config - Configuration options
   * @param seed - Random seed for reproducibility (optional)
   */
  constructor(config: BanditConfig = {}, seed?: number) {
    this.config = {
      explorationConstant: config.explorationConstant ?? Math.SQRT2,
      initialAlpha: config.initialAlpha ?? 1,
      initialBeta: config.initialBeta ?? 1,
      rewardDecay: config.rewardDecay ?? 1,
    };
    this.random = createRandom(seed ?? Date.now());
  }

  /**
   * Add a new arm to the bandit
   * @param id - Unique identifier for the arm
   * @param name - Human-readable name
   * @param metadata - Optional additional data
   *
   * O(1) time complexity
   */
  addArm(id: string, name: string, metadata?: Record<string, unknown>): void {
    if (this.arms.has(id)) {
      throw new Error(`Arm with id "${id}" already exists`);
    }

    this.arms.set(id, {
      id,
      name,
      totalReward: 0,
      pulls: 0,
      alpha: this.config.initialAlpha,
      beta: this.config.initialBeta,
      metadata,
    });
  }

  /**
   * Add multiple arms at once
   * @param arms - Array of arm definitions
   *
   * O(n) time complexity where n = number of arms
   */
  addArms(arms: Array<{ id: string; name: string; metadata?: Record<string, unknown> }>): void {
    for (const arm of arms) {
      this.addArm(arm.id, arm.name, arm.metadata);
    }
  }

  /**
   * Get all arms
   * @returns Array of all arms
   *
   * O(n) time complexity where n = number of arms
   */
  getArms(): BanditArm[] {
    return Array.from(this.arms.values());
  }

  /**
   * Get a specific arm by ID
   * @param id - Arm identifier
   * @returns The arm or undefined
   *
   * O(1) time complexity
   */
  getArm(id: string): BanditArm | undefined {
    return this.arms.get(id);
  }

  /**
   * Calculate UCB1 score for an arm
   *
   * UCB1 score = empirical_mean + C * sqrt(2 * ln(total_pulls) / arm_pulls)
   *
   * @param arm - The arm to score
   * @returns UCB1 score and components
   *
   * O(1) time complexity
   */
  private calculateUCB1Score(arm: BanditArm): { score: number; exploitation: number; exploration: number } {
    if (arm.pulls === 0) {
      return { score: Infinity, exploitation: 0, exploration: Infinity };
    }

    const exploitation = arm.totalReward / arm.pulls;
    const exploration = this.config.explorationConstant *
      Math.sqrt(2 * Math.log(this.totalPulls) / arm.pulls);

    return {
      score: exploitation + exploration,
      exploitation,
      exploration,
    };
  }

  /**
   * Select an arm using the UCB1 algorithm
   *
   * Upper Confidence Bound algorithm balances exploration and exploitation
   * by adding an exploration bonus that decreases with more samples.
   *
   * @returns Selected arm with score metadata
   *
   * O(n) time complexity where n = number of arms
   */
  selectArmUCB1(): ArmSelection {
    if (this.arms.size === 0) {
      throw new Error('No arms available for selection');
    }

    let bestArm: BanditArm | null = null;
    let bestScore = -Infinity;
    let bestExploitation = 0;
    let bestExploration = 0;

    for (const arm of this.arms.values()) {
      const { score, exploitation, exploration } = this.calculateUCB1Score(arm);

      if (score > bestScore) {
        bestScore = score;
        bestArm = arm;
        bestExploitation = exploitation;
        bestExploration = exploration;
      }
    }

    return {
      arm: bestArm!,
      score: bestScore,
      algorithm: 'ucb1',
      exploitationScore: bestExploitation,
      explorationBonus: bestExploration,
    };
  }

  /**
   * Select an arm using Thompson Sampling
   *
   * Samples from the posterior Beta distribution of each arm and selects
   * the arm with the highest sampled value. Naturally balances exploration
   * and exploitation through posterior uncertainty.
   *
   * @returns Selected arm with sampled score
   *
   * O(n) time complexity where n = number of arms
   */
  selectArmThompson(): ArmSelection {
    if (this.arms.size === 0) {
      throw new Error('No arms available for selection');
    }

    let bestArm: BanditArm | null = null;
    let bestSample = -Infinity;

    for (const arm of this.arms.values()) {
      const sample = betaSample(arm.alpha, arm.beta, this.random);

      if (sample > bestSample) {
        bestSample = sample;
        bestArm = arm;
      }
    }

    return {
      arm: bestArm!,
      score: bestSample,
      algorithm: 'thompson',
    };
  }

  /**
   * Select an arm using epsilon-greedy strategy
   *
   * With probability epsilon, selects a random arm (exploration).
   * Otherwise, selects the arm with highest empirical mean (exploitation).
   *
   * @param epsilon - Exploration probability (0-1)
   * @returns Selected arm
   *
   * O(n) time complexity where n = number of arms
   */
  selectArmEpsilonGreedy(epsilon: number = 0.1): ArmSelection {
    if (this.arms.size === 0) {
      throw new Error('No arms available for selection');
    }

    const armsArray = this.getArms();

    // Explore: random selection
    if (this.random() < epsilon) {
      const randomIndex = Math.floor(this.random() * armsArray.length);
      const arm = armsArray[randomIndex];
      return {
        arm,
        score: arm.pulls > 0 ? arm.totalReward / arm.pulls : 0,
        algorithm: 'epsilon-greedy',
      };
    }

    // Exploit: select best arm
    let bestArm = armsArray[0];
    let bestMean = bestArm.pulls > 0 ? bestArm.totalReward / bestArm.pulls : 0;

    for (const arm of armsArray) {
      const mean = arm.pulls > 0 ? arm.totalReward / arm.pulls : 0;
      if (mean > bestMean) {
        bestMean = mean;
        bestArm = arm;
      }
    }

    return {
      arm: bestArm,
      score: bestMean,
      algorithm: 'epsilon-greedy',
    };
  }

  /**
   * Record a reward for an arm
   *
   * Updates the arm's statistics and Thompson Sampling parameters.
   * For binary rewards (0 or 1), updates Beta distribution directly.
   * For continuous rewards, approximates using mean.
   *
   * @param armId - The arm that received the reward
   * @param reward - Reward value (0-1 for binary, scaled for continuous)
   * @param context - Optional context for the reward
   *
   * O(1) time complexity
   */
  recordReward(armId: string, reward: number, context?: Record<string, unknown>): void {
    const arm = this.arms.get(armId);
    if (!arm) {
      throw new Error(`Arm with id "${armId}" not found`);
    }

    // Apply decay to existing rewards if configured
    if (this.config.rewardDecay < 1) {
      arm.totalReward *= this.config.rewardDecay;
    }

    // Update statistics
    arm.pulls++;
    arm.totalReward += reward;
    this.totalPulls++;

    // Update Beta distribution parameters for Thompson Sampling
    // For binary rewards (0 or 1), this is exact
    // For continuous rewards in [0,1], this is an approximation
    const normalizedReward = Math.max(0, Math.min(1, reward));
    arm.alpha += normalizedReward;
    arm.beta += 1 - normalizedReward;

    // Record in history
    this.rewardHistory.push({
      timestamp: Date.now(),
      armId,
      reward,
      context,
    });
  }

  /**
   * Get reward history for an arm or all arms
   * @param armId - Optional arm ID to filter by
   * @param limit - Maximum number of entries to return
   * @returns Array of reward history entries
   *
   * O(n) time complexity where n = history length
   */
  getRewardHistory(armId?: string, limit?: number): RewardHistoryEntry[] {
    let history = armId
      ? this.rewardHistory.filter(h => h.armId === armId)
      : [...this.rewardHistory];

    // Sort by timestamp descending (most recent first)
    history.sort((a, b) => b.timestamp - a.timestamp);

    if (limit) {
      history = history.slice(0, limit);
    }

    return history;
  }

  /**
   * Calculate regret metrics for performance monitoring
   *
   * Regret measures how much reward was lost by not always choosing
   * the optimal arm. Lower regret indicates better performance.
   *
   * @returns Regret metrics including cumulative and average regret
   *
   * O(n) time complexity where n = number of arms
   */
  calculateRegret(): RegretMetrics {
    if (this.arms.size === 0 || this.totalPulls === 0) {
      return {
        cumulativeRegret: 0,
        averageRegret: 0,
        estimatedOptimalArm: '',
        optimalArmPulls: 0,
        totalPulls: 0,
      };
    }

    // Find optimal arm (highest empirical mean)
    let optimalArm: BanditArm | null = null;
    let optimalMean = -Infinity;

    for (const arm of this.arms.values()) {
      if (arm.pulls > 0) {
        const mean = arm.totalReward / arm.pulls;
        if (mean > optimalMean) {
          optimalMean = mean;
          optimalArm = arm;
        }
      }
    }

    if (!optimalArm) {
      return {
        cumulativeRegret: 0,
        averageRegret: 0,
        estimatedOptimalArm: '',
        optimalArmPulls: 0,
        totalPulls: this.totalPulls,
      };
    }

    // Calculate cumulative regret
    // regret = sum over all pulls of (optimal_mean - actual_reward)
    let cumulativeRegret = 0;

    for (const arm of this.arms.values()) {
      if (arm.pulls > 0) {
        const armMean = arm.totalReward / arm.pulls;
        // Each pull of this arm incurs regret equal to (optimal - this arm's mean)
        const armRegret = Math.max(0, optimalMean - armMean) * arm.pulls;
        cumulativeRegret += armRegret;
      }
    }

    return {
      cumulativeRegret,
      averageRegret: cumulativeRegret / this.totalPulls,
      estimatedOptimalArm: optimalArm.id,
      optimalArmPulls: optimalArm.pulls,
      totalPulls: this.totalPulls,
    };
  }

  /**
   * Get the arm with the highest estimated value
   * @returns The best arm based on empirical mean
   *
   * O(n) time complexity where n = number of arms
   */
  getBestArm(): BanditArm | null {
    let bestArm: BanditArm | null = null;
    let bestMean = -Infinity;

    for (const arm of this.arms.values()) {
      if (arm.pulls > 0) {
        const mean = arm.totalReward / arm.pulls;
        if (mean > bestMean) {
          bestMean = mean;
          bestArm = arm;
        }
      }
    }

    return bestArm;
  }

  /**
   * Reset all arm statistics
   *
   * O(n) time complexity where n = number of arms
   */
  reset(): void {
    for (const arm of this.arms.values()) {
      arm.totalReward = 0;
      arm.pulls = 0;
      arm.alpha = this.config.initialAlpha;
      arm.beta = this.config.initialBeta;
    }
    this.rewardHistory = [];
    this.totalPulls = 0;
  }

  /**
   * Export the current state for persistence
   * @returns Serializable state object
   *
   * O(n + m) time complexity where n = arms, m = history length
   */
  exportState(): {
    arms: BanditArm[];
    rewardHistory: RewardHistoryEntry[];
    totalPulls: number;
    config: Required<BanditConfig>;
  } {
    return {
      arms: this.getArms(),
      rewardHistory: [...this.rewardHistory],
      totalPulls: this.totalPulls,
      config: { ...this.config },
    };
  }

  /**
   * Import a previously exported state
   * @param state - State object from exportState()
   *
   * O(n + m) time complexity where n = arms, m = history length
   */
  importState(state: {
    arms: BanditArm[];
    rewardHistory: RewardHistoryEntry[];
    totalPulls: number;
    config?: Partial<BanditConfig>;
  }): void {
    this.arms.clear();
    for (const arm of state.arms) {
      this.arms.set(arm.id, { ...arm });
    }
    this.rewardHistory = [...state.rewardHistory];
    this.totalPulls = state.totalPulls;

    if (state.config) {
      this.config = {
        ...this.config,
        ...state.config,
      } as Required<BanditConfig>;
    }
  }

  /**
   * Automatically select the best algorithm based on problem characteristics
   * @param numArms - Number of arms in the problem
   * @param totalBudget - Total number of pulls expected
   * @returns Recommended algorithm
   */
  static recommendAlgorithm(numArms: number, totalBudget: number): 'ucb1' | 'thompson' | 'epsilon-greedy' {
    // Thompson Sampling generally performs best for smaller problems
    if (numArms <= 10 && totalBudget >= numArms * 10) {
      return 'thompson';
    }

    // UCB1 has good theoretical guarantees for larger problems
    if (numArms > 10 || totalBudget >= 1000) {
      return 'ucb1';
    }

    // Epsilon-greedy is simple and works well for very small budgets
    return 'epsilon-greedy';
  }
}

// Singleton instance
export const multiArmedBanditService = new MultiArmedBanditService();

// Factory function for creating new instances
export function createBandit(config?: BanditConfig, seed?: number): MultiArmedBanditService {
  return new MultiArmedBanditService(config, seed);
}
