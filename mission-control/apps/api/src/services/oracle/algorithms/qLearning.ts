/**
 * Q-Learning Agent
 * Story alg-3 - Reinforcement learning for optimal action sequencing
 *
 * Implements Q-Learning with epsilon-greedy exploration, experience replay,
 * and temporal difference learning for learning optimal policies.
 */

/**
 * Represents a state in the environment
 */
export interface State {
  /** Unique state identifier */
  id: string;
  /** State features for function approximation */
  features?: Record<string, number>;
  /** Whether this is a terminal state */
  isTerminal?: boolean;
}

/**
 * Represents an action that can be taken
 */
export interface Action {
  /** Unique action identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Action parameters */
  params?: Record<string, unknown>;
}

/**
 * Experience tuple for replay buffer
 */
export interface Experience {
  /** State before action */
  state: string;
  /** Action taken */
  action: string;
  /** Reward received */
  reward: number;
  /** Next state after action */
  nextState: string;
  /** Whether next state is terminal */
  done: boolean;
  /** Timestamp of experience */
  timestamp: number;
  /** Priority for prioritized experience replay */
  priority?: number;
}

/**
 * Q-Table type: state -> action -> Q-value
 */
export type QTable = Map<string, Map<string, number>>;

/**
 * Configuration for Q-Learning agent
 */
export interface QLearningConfig {
  /** Learning rate (alpha) - how much to update Q-values */
  learningRate: number;
  /** Discount factor (gamma) - importance of future rewards */
  discountFactor: number;
  /** Initial exploration rate (epsilon) */
  epsilon: number;
  /** Minimum exploration rate */
  epsilonMin: number;
  /** Epsilon decay rate per episode */
  epsilonDecay: number;
  /** Experience replay buffer size */
  replayBufferSize: number;
  /** Batch size for experience replay */
  batchSize: number;
  /** Use prioritized experience replay */
  prioritizedReplay: boolean;
  /** Default Q-value for unvisited state-action pairs */
  defaultQValue: number;
}

/**
 * Policy extracted from Q-table
 */
export interface Policy {
  /** State to action mapping */
  stateActionMap: Map<string, string>;
  /** Expected value for each state */
  stateValues: Map<string, number>;
  /** Entropy of the policy (measure of randomness) */
  entropy: number;
}

/**
 * Training statistics
 */
export interface TrainingStats {
  /** Total number of episodes */
  episodes: number;
  /** Total number of steps */
  steps: number;
  /** Average reward per episode */
  avgReward: number;
  /** Current exploration rate */
  currentEpsilon: number;
  /** Number of unique states visited */
  statesVisited: number;
  /** Number of state-action pairs with Q-values */
  qValuesLearned: number;
  /** Average TD error */
  avgTDError: number;
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
 * Q-Learning Agent
 *
 * Implements tabular Q-Learning with experience replay for learning
 * optimal action sequences in discrete state-action spaces.
 */
export class QLearningAgent {
  private config: QLearningConfig;
  private qTable: QTable = new Map();
  private replayBuffer: Experience[] = [];
  private actions: Set<string> = new Set();
  private random: () => number;
  private currentEpsilon: number;
  private stats: TrainingStats;

  /**
   * Creates a new Q-Learning agent
   * @param config - Configuration options
   * @param seed - Random seed for reproducibility
   */
  constructor(config: Partial<QLearningConfig> = {}, seed?: number) {
    this.config = {
      learningRate: config.learningRate ?? 0.1,
      discountFactor: config.discountFactor ?? 0.95,
      epsilon: config.epsilon ?? 1.0,
      epsilonMin: config.epsilonMin ?? 0.01,
      epsilonDecay: config.epsilonDecay ?? 0.995,
      replayBufferSize: config.replayBufferSize ?? 10000,
      batchSize: config.batchSize ?? 32,
      prioritizedReplay: config.prioritizedReplay ?? false,
      defaultQValue: config.defaultQValue ?? 0,
    };
    this.random = createRandom(seed);
    this.currentEpsilon = this.config.epsilon;
    this.stats = {
      episodes: 0,
      steps: 0,
      avgReward: 0,
      currentEpsilon: this.currentEpsilon,
      statesVisited: 0,
      qValuesLearned: 0,
      avgTDError: 0,
    };
  }

  /**
   * Register available actions
   * @param actions - Array of action IDs or Action objects
   *
   * O(n) time complexity where n = number of actions
   */
  registerActions(actions: (string | Action)[]): void {
    for (const action of actions) {
      const actionId = typeof action === 'string' ? action : action.id;
      this.actions.add(actionId);
    }
  }

  /**
   * Get Q-value for a state-action pair
   * @param state - State identifier
   * @param action - Action identifier
   * @returns Q-value
   *
   * O(1) time complexity
   */
  getQValue(state: string, action: string): number {
    const stateQ = this.qTable.get(state);
    if (!stateQ) {
      return this.config.defaultQValue;
    }
    return stateQ.get(action) ?? this.config.defaultQValue;
  }

  /**
   * Set Q-value for a state-action pair
   * @param state - State identifier
   * @param action - Action identifier
   * @param value - Q-value to set
   *
   * O(1) time complexity
   */
  setQValue(state: string, action: string, value: number): void {
    if (!this.qTable.has(state)) {
      this.qTable.set(state, new Map());
    }
    this.qTable.get(state)!.set(action, value);
  }

  /**
   * Get all Q-values for a state
   * @param state - State identifier
   * @returns Map of action to Q-value
   *
   * O(1) time complexity
   */
  getStateQValues(state: string): Map<string, number> {
    return this.qTable.get(state) ?? new Map();
  }

  /**
   * Get the maximum Q-value for a state
   * @param state - State identifier
   * @returns Maximum Q-value
   *
   * O(n) time complexity where n = number of actions
   */
  getMaxQValue(state: string): number {
    const stateQ = this.qTable.get(state);
    if (!stateQ || stateQ.size === 0) {
      return this.config.defaultQValue;
    }
    return Math.max(...stateQ.values());
  }

  /**
   * Select action using epsilon-greedy strategy
   *
   * With probability epsilon, selects a random action (exploration).
   * Otherwise, selects the action with highest Q-value (exploitation).
   *
   * @param state - Current state identifier
   * @param availableActions - Optional list of available actions in this state
   * @returns Selected action
   *
   * O(n) time complexity where n = number of actions
   */
  selectAction(state: string, availableActions?: string[]): string {
    const actions = availableActions ?? Array.from(this.actions);

    if (actions.length === 0) {
      throw new Error('No actions available for selection');
    }

    // Exploration: random action
    if (this.random() < this.currentEpsilon) {
      const randomIndex = Math.floor(this.random() * actions.length);
      return actions[randomIndex];
    }

    // Exploitation: best action
    let bestAction = actions[0];
    let bestQValue = this.getQValue(state, actions[0]);

    for (const action of actions) {
      const qValue = this.getQValue(state, action);
      if (qValue > bestQValue) {
        bestQValue = qValue;
        bestAction = action;
      }
    }

    return bestAction;
  }

  /**
   * Select action using softmax (Boltzmann) exploration
   *
   * Actions are selected probabilistically based on their Q-values,
   * with higher Q-values having higher selection probability.
   *
   * @param state - Current state identifier
   * @param temperature - Temperature parameter (higher = more exploration)
   * @param availableActions - Optional list of available actions
   * @returns Selected action
   *
   * O(n) time complexity where n = number of actions
   */
  selectActionSoftmax(state: string, temperature: number = 1.0, availableActions?: string[]): string {
    const actions = availableActions ?? Array.from(this.actions);

    if (actions.length === 0) {
      throw new Error('No actions available for selection');
    }

    // Calculate softmax probabilities
    const qValues = actions.map(a => this.getQValue(state, a));
    const maxQ = Math.max(...qValues);

    // Subtract max for numerical stability
    const expValues = qValues.map(q => Math.exp((q - maxQ) / temperature));
    const sumExp = expValues.reduce((a, b) => a + b, 0);
    const probabilities = expValues.map(e => e / sumExp);

    // Sample from probability distribution
    const rand = this.random();
    let cumProb = 0;

    for (let i = 0; i < actions.length; i++) {
      cumProb += probabilities[i];
      if (rand < cumProb) {
        return actions[i];
      }
    }

    return actions[actions.length - 1];
  }

  /**
   * Perform TD(0) update on Q-value
   *
   * Q(s,a) <- Q(s,a) + alpha * (reward + gamma * max_a' Q(s',a') - Q(s,a))
   *
   * @param state - Current state
   * @param action - Action taken
   * @param reward - Reward received
   * @param nextState - Next state
   * @param done - Whether episode ended
   * @returns TD error
   *
   * O(n) time complexity where n = number of actions
   */
  update(
    state: string,
    action: string,
    reward: number,
    nextState: string,
    done: boolean
  ): number {
    const currentQ = this.getQValue(state, action);

    // Target: reward + discounted max future value
    const target = done
      ? reward
      : reward + this.config.discountFactor * this.getMaxQValue(nextState);

    // TD error
    const tdError = target - currentQ;

    // Update Q-value
    const newQ = currentQ + this.config.learningRate * tdError;
    this.setQValue(state, action, newQ);

    return tdError;
  }

  /**
   * Add experience to replay buffer
   * @param experience - Experience tuple
   *
   * O(1) amortized time complexity
   */
  addExperience(experience: Omit<Experience, 'timestamp' | 'priority'>): void {
    const fullExperience: Experience = {
      ...experience,
      timestamp: Date.now(),
      priority: this.config.prioritizedReplay ? 1.0 : undefined,
    };

    this.replayBuffer.push(fullExperience);

    // Maintain buffer size
    if (this.replayBuffer.length > this.config.replayBufferSize) {
      this.replayBuffer.shift();
    }
  }

  /**
   * Sample experiences from replay buffer
   * @param batchSize - Number of experiences to sample
   * @returns Array of experiences
   *
   * O(batchSize) time complexity for uniform sampling
   * O(bufferSize) time complexity for prioritized sampling
   */
  sampleExperiences(batchSize?: number): Experience[] {
    const size = batchSize ?? this.config.batchSize;

    if (this.replayBuffer.length === 0) {
      return [];
    }

    const actualSize = Math.min(size, this.replayBuffer.length);

    if (this.config.prioritizedReplay) {
      return this.samplePrioritized(actualSize);
    }

    return this.sampleUniform(actualSize);
  }

  /**
   * Uniform random sampling
   * @param size - Number of samples
   * @returns Sampled experiences
   *
   * O(size) time complexity
   */
  private sampleUniform(size: number): Experience[] {
    const samples: Experience[] = [];
    const indices = new Set<number>();

    while (indices.size < size) {
      const index = Math.floor(this.random() * this.replayBuffer.length);
      if (!indices.has(index)) {
        indices.add(index);
        samples.push(this.replayBuffer[index]);
      }
    }

    return samples;
  }

  /**
   * Prioritized experience replay sampling
   * @param size - Number of samples
   * @returns Sampled experiences
   *
   * O(bufferSize) time complexity
   */
  private samplePrioritized(size: number): Experience[] {
    // Calculate priorities and sum
    const priorities = this.replayBuffer.map(e => e.priority ?? 1.0);
    const totalPriority = priorities.reduce((a, b) => a + b, 0);

    const samples: Experience[] = [];
    const sampled = new Set<number>();

    while (samples.length < size) {
      const target = this.random() * totalPriority;
      let cumulative = 0;

      for (let i = 0; i < this.replayBuffer.length; i++) {
        cumulative += priorities[i];
        if (cumulative >= target && !sampled.has(i)) {
          sampled.add(i);
          samples.push(this.replayBuffer[i]);
          break;
        }
      }
    }

    return samples;
  }

  /**
   * Update experience priorities based on TD errors
   * @param experiences - Experiences to update
   * @param tdErrors - TD errors for each experience
   *
   * O(n * m) time complexity where n = experiences, m = buffer size
   */
  updatePriorities(experiences: Experience[], tdErrors: number[]): void {
    for (let i = 0; i < experiences.length; i++) {
      const exp = experiences[i];
      const index = this.replayBuffer.findIndex(
        e => e.state === exp.state && e.action === exp.action && e.timestamp === exp.timestamp
      );

      if (index >= 0) {
        // Priority based on TD error magnitude with small constant to avoid zero
        this.replayBuffer[index].priority = Math.abs(tdErrors[i]) + 0.01;
      }
    }
  }

  /**
   * Perform experience replay learning
   * @param batchSize - Number of experiences to replay
   * @returns Average TD error
   *
   * O(batchSize * numActions) time complexity
   */
  replayExperiences(batchSize?: number): number {
    const experiences = this.sampleExperiences(batchSize);

    if (experiences.length === 0) {
      return 0;
    }

    const tdErrors: number[] = [];

    for (const exp of experiences) {
      const tdError = this.update(exp.state, exp.action, exp.reward, exp.nextState, exp.done);
      tdErrors.push(tdError);
    }

    // Update priorities if using prioritized replay
    if (this.config.prioritizedReplay) {
      this.updatePriorities(experiences, tdErrors);
    }

    return tdErrors.reduce((a, b) => a + Math.abs(b), 0) / tdErrors.length;
  }

  /**
   * Decay exploration rate after episode
   *
   * O(1) time complexity
   */
  decayEpsilon(): void {
    this.currentEpsilon = Math.max(
      this.config.epsilonMin,
      this.currentEpsilon * this.config.epsilonDecay
    );
    this.stats.currentEpsilon = this.currentEpsilon;
  }

  /**
   * Extract policy from Q-table
   *
   * @returns Greedy policy derived from current Q-values
   *
   * O(n * m) time complexity where n = states, m = actions
   */
  extractPolicy(): Policy {
    const stateActionMap = new Map<string, string>();
    const stateValues = new Map<string, number>();
    let totalEntropy = 0;

    for (const [state, actionQs] of this.qTable.entries()) {
      // Find best action
      let bestAction = '';
      let bestQ = -Infinity;

      for (const [action, qValue] of actionQs.entries()) {
        if (qValue > bestQ) {
          bestQ = qValue;
          bestAction = action;
        }
      }

      stateActionMap.set(state, bestAction);
      stateValues.set(state, bestQ);

      // Calculate entropy for this state
      const qValues = Array.from(actionQs.values());
      if (qValues.length > 1) {
        const maxQ = Math.max(...qValues);
        const expValues = qValues.map(q => Math.exp(q - maxQ));
        const sum = expValues.reduce((a, b) => a + b, 0);
        const probs = expValues.map(e => e / sum);

        for (const p of probs) {
          if (p > 0) {
            totalEntropy -= p * Math.log(p);
          }
        }
      }
    }

    return {
      stateActionMap,
      stateValues,
      entropy: totalEntropy / Math.max(1, this.qTable.size),
    };
  }

  /**
   * Get best action for a state from the learned policy
   * @param state - State identifier
   * @returns Best action or undefined if state not in Q-table
   *
   * O(m) time complexity where m = number of actions for state
   */
  getBestAction(state: string): string | undefined {
    const stateQ = this.qTable.get(state);
    if (!stateQ || stateQ.size === 0) {
      return undefined;
    }

    let bestAction = '';
    let bestQ = -Infinity;

    for (const [action, qValue] of stateQ.entries()) {
      if (qValue > bestQ) {
        bestQ = qValue;
        bestAction = action;
      }
    }

    return bestAction;
  }

  /**
   * Get training statistics
   * @returns Current training stats
   *
   * O(1) time complexity
   */
  getStats(): TrainingStats {
    let qValuesLearned = 0;
    for (const actionQs of this.qTable.values()) {
      qValuesLearned += actionQs.size;
    }

    return {
      ...this.stats,
      statesVisited: this.qTable.size,
      qValuesLearned,
    };
  }

  /**
   * Update episode statistics
   * @param episodeReward - Total reward for the episode
   *
   * O(1) time complexity
   */
  recordEpisode(episodeReward: number): void {
    this.stats.episodes++;
    // Exponential moving average of rewards
    const alpha = 0.1;
    this.stats.avgReward = this.stats.avgReward * (1 - alpha) + episodeReward * alpha;
  }

  /**
   * Increment step counter
   *
   * O(1) time complexity
   */
  recordStep(): void {
    this.stats.steps++;
  }

  /**
   * Export Q-table for persistence
   * @returns Serializable Q-table
   *
   * O(n * m) time complexity where n = states, m = actions per state
   */
  exportQTable(): Record<string, Record<string, number>> {
    const exported: Record<string, Record<string, number>> = {};

    for (const [state, actionQs] of this.qTable.entries()) {
      exported[state] = {};
      for (const [action, qValue] of actionQs.entries()) {
        exported[state][action] = qValue;
      }
    }

    return exported;
  }

  /**
   * Import Q-table from serialized form
   * @param data - Serialized Q-table
   *
   * O(n * m) time complexity where n = states, m = actions per state
   */
  importQTable(data: Record<string, Record<string, number>>): void {
    this.qTable.clear();

    for (const [state, actionQs] of Object.entries(data)) {
      const stateMap = new Map<string, number>();
      for (const [action, qValue] of Object.entries(actionQs)) {
        stateMap.set(action, qValue);
      }
      this.qTable.set(state, stateMap);
    }
  }

  /**
   * Get current exploration rate
   * @returns Current epsilon value
   *
   * O(1) time complexity
   */
  getEpsilon(): number {
    return this.currentEpsilon;
  }

  /**
   * Set exploration rate manually
   * @param epsilon - New epsilon value
   *
   * O(1) time complexity
   */
  setEpsilon(epsilon: number): void {
    this.currentEpsilon = Math.max(this.config.epsilonMin, Math.min(1, epsilon));
    this.stats.currentEpsilon = this.currentEpsilon;
  }

  /**
   * Get replay buffer size
   * @returns Current buffer size
   *
   * O(1) time complexity
   */
  getReplayBufferSize(): number {
    return this.replayBuffer.length;
  }

  /**
   * Clear replay buffer
   *
   * O(1) time complexity
   */
  clearReplayBuffer(): void {
    this.replayBuffer = [];
  }

  /**
   * Reset agent to initial state
   *
   * O(1) time complexity
   */
  reset(): void {
    this.qTable.clear();
    this.replayBuffer = [];
    this.currentEpsilon = this.config.epsilon;
    this.stats = {
      episodes: 0,
      steps: 0,
      avgReward: 0,
      currentEpsilon: this.currentEpsilon,
      statesVisited: 0,
      qValuesLearned: 0,
      avgTDError: 0,
    };
  }
}

// Factory function
export function createQLearningAgent(
  config?: Partial<QLearningConfig>,
  seed?: number
): QLearningAgent {
  return new QLearningAgent(config, seed);
}

// Default singleton
export const qLearningAgent = new QLearningAgent();
