/**
 * Markov Chain State Predictor
 * Story alg-5 - Predict next likely user states for proactive suggestions
 *
 * Implements Markov Chain state prediction with Hidden Markov Models,
 * Viterbi algorithm for most likely state sequences, and Forward-Backward
 * algorithm for state probabilities.
 */

/**
 * Represents an observable state in the Markov Chain
 */
export interface MarkovState {
  /** Unique state identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** State metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Represents a transition between states
 */
export interface StateTransition {
  /** Source state ID */
  fromState: string;
  /** Target state ID */
  toState: string;
  /** Transition count */
  count: number;
  /** Transition probability (normalized) */
  probability: number;
  /** Average time between states (ms) */
  avgTimeDelta?: number;
  /** Transition metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Transition matrix type: from_state -> to_state -> probability
 */
export type TransitionMatrix = Map<string, Map<string, number>>;

/**
 * Hidden Markov Model parameters
 */
export interface HMMParameters {
  /** Number of hidden states */
  numHiddenStates: number;
  /** Initial state distribution (pi) */
  initialDistribution: number[];
  /** State transition probabilities (A matrix) */
  transitionMatrix: number[][];
  /** Emission probabilities (B matrix): P(observation | hidden_state) */
  emissionMatrix: number[][];
  /** Hidden state names */
  hiddenStateNames?: string[];
  /** Observable state names */
  observableStateNames?: string[];
}

/**
 * Prediction result with confidence intervals
 */
export interface StatePrediction {
  /** Predicted next state */
  state: string;
  /** Prediction probability */
  probability: number;
  /** Confidence interval lower bound */
  confidenceLower: number;
  /** Confidence interval upper bound */
  confidenceUpper: number;
  /** All state probabilities */
  stateProbabilities: Map<string, number>;
  /** Entropy of the prediction (uncertainty measure) */
  entropy: number;
}

/**
 * Viterbi algorithm result
 */
export interface ViterbiResult {
  /** Most likely state sequence */
  stateSequence: string[];
  /** Probability of this sequence */
  probability: number;
  /** Log probability (for numerical stability) */
  logProbability: number;
  /** Path probabilities at each step */
  pathProbabilities: number[][];
}

/**
 * Forward-Backward algorithm result
 */
export interface ForwardBackwardResult {
  /** Forward probabilities (alpha) */
  forwardProbabilities: number[][];
  /** Backward probabilities (beta) */
  backwardProbabilities: number[][];
  /** State probabilities at each time step (gamma) */
  stateProbabilities: number[][];
  /** Total sequence probability */
  sequenceProbability: number;
}

/**
 * Historical observation for learning
 */
export interface Observation {
  /** State ID */
  state: string;
  /** Timestamp of observation */
  timestamp: number;
  /** Context at time of observation */
  context?: Record<string, unknown>;
}

/**
 * Configuration for Markov Chain
 */
export interface MarkovChainConfig {
  /** Smoothing parameter for transition probabilities (Laplace smoothing) */
  smoothingAlpha: number;
  /** Minimum observations before making predictions */
  minObservations: number;
  /** Confidence level for intervals (0-1) */
  confidenceLevel: number;
  /** Learning rate for online updates */
  learningRate: number;
  /** Time decay factor for older observations */
  timeDecayFactor: number;
}

/**
 * Training statistics
 */
export interface TrainingStats {
  /** Total number of observations */
  totalObservations: number;
  /** Number of unique states observed */
  uniqueStates: number;
  /** Number of unique transitions observed */
  uniqueTransitions: number;
  /** Average log likelihood of data */
  avgLogLikelihood: number;
  /** Last update timestamp */
  lastUpdate: number;
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
 * Markov Chain State Predictor
 *
 * Provides state prediction using first-order Markov Chains and
 * Hidden Markov Models for more complex state inference.
 */
export class MarkovChainPredictor {
  private config: MarkovChainConfig;
  private states: Map<string, MarkovState> = new Map();
  private transitionCounts: Map<string, Map<string, number>> = new Map();
  private transitionMatrix: TransitionMatrix = new Map();
  private observations: Observation[] = [];
  private totalTransitions: number = 0;
  private random: () => number;

  /**
   * Creates a new Markov Chain predictor
   * @param config - Configuration options
   * @param seed - Random seed for reproducibility
   */
  constructor(config: Partial<MarkovChainConfig> = {}, seed?: number) {
    this.config = {
      smoothingAlpha: config.smoothingAlpha ?? 1.0,
      minObservations: config.minObservations ?? 10,
      confidenceLevel: config.confidenceLevel ?? 0.95,
      learningRate: config.learningRate ?? 0.1,
      timeDecayFactor: config.timeDecayFactor ?? 0.99,
    };
    this.random = createRandom(seed);
  }

  /**
   * Register a state in the Markov Chain
   * @param state - State to register
   *
   * O(1) time complexity
   */
  addState(state: MarkovState): void {
    this.states.set(state.id, state);
    if (!this.transitionCounts.has(state.id)) {
      this.transitionCounts.set(state.id, new Map());
    }
  }

  /**
   * Register multiple states at once
   * @param states - Array of states to register
   *
   * O(n) time complexity where n = number of states
   */
  addStates(states: MarkovState[]): void {
    for (const state of states) {
      this.addState(state);
    }
  }

  /**
   * Record an observation (state transition)
   * @param state - Current state
   * @param context - Optional context
   *
   * O(1) time complexity
   */
  observe(state: string, context?: Record<string, unknown>): void {
    const observation: Observation = {
      state,
      timestamp: Date.now(),
      context,
    };

    // Add state if not exists
    if (!this.states.has(state)) {
      this.addState({ id: state, name: state });
    }

    // Update transition counts from previous state
    if (this.observations.length > 0) {
      const previousState = this.observations[this.observations.length - 1].state;
      this.incrementTransition(previousState, state);
    }

    this.observations.push(observation);
  }

  /**
   * Increment transition count between states
   * @param fromState - Source state
   * @param toState - Target state
   *
   * O(1) time complexity
   */
  private incrementTransition(fromState: string, toState: string): void {
    if (!this.transitionCounts.has(fromState)) {
      this.transitionCounts.set(fromState, new Map());
    }

    const fromCounts = this.transitionCounts.get(fromState)!;
    const currentCount = fromCounts.get(toState) ?? 0;
    fromCounts.set(toState, currentCount + 1);

    this.totalTransitions++;

    // Update transition matrix
    this.updateTransitionProbabilities(fromState);
  }

  /**
   * Update transition probabilities from a state using Laplace smoothing
   * @param fromState - Source state
   *
   * O(n) time complexity where n = number of states
   */
  private updateTransitionProbabilities(fromState: string): void {
    const counts = this.transitionCounts.get(fromState);
    if (!counts) return;

    const numStates = this.states.size;
    const alpha = this.config.smoothingAlpha;

    // Total count from this state (with smoothing)
    let totalCount = 0;
    for (const count of counts.values()) {
      totalCount += count;
    }
    const smoothedTotal = totalCount + alpha * numStates;

    // Calculate probabilities
    const probabilities = new Map<string, number>();

    for (const stateId of this.states.keys()) {
      const count = counts.get(stateId) ?? 0;
      const probability = (count + alpha) / smoothedTotal;
      probabilities.set(stateId, probability);
    }

    this.transitionMatrix.set(fromState, probabilities);
  }

  /**
   * Learn transition matrix from historical observations
   * @param observations - Array of state observations in order
   *
   * O(n) time complexity where n = number of observations
   */
  learnFromHistory(observations: Observation[]): void {
    // Sort by timestamp
    const sorted = [...observations].sort((a, b) => a.timestamp - b.timestamp);

    // Apply time decay to older observations
    const now = Date.now();
    const maxAge = sorted.length > 0 ? now - sorted[0].timestamp : 0;

    for (let i = 0; i < sorted.length; i++) {
      const observation = sorted[i];

      // Add state if not exists
      if (!this.states.has(observation.state)) {
        this.addState({ id: observation.state, name: observation.state });
      }

      // Apply time decay weight
      const age = now - observation.timestamp;
      const weight = Math.pow(this.config.timeDecayFactor, age / (maxAge + 1));

      // Update transition counts
      if (i > 0) {
        const previousState = sorted[i - 1].state;
        this.incrementTransitionWeighted(previousState, observation.state, weight);
      }

      this.observations.push(observation);
    }

    // Rebuild full transition matrix
    this.rebuildTransitionMatrix();
  }

  /**
   * Increment transition count with a weight
   * @param fromState - Source state
   * @param toState - Target state
   * @param weight - Weight for this transition
   *
   * O(1) time complexity
   */
  private incrementTransitionWeighted(fromState: string, toState: string, weight: number): void {
    if (!this.transitionCounts.has(fromState)) {
      this.transitionCounts.set(fromState, new Map());
    }

    const fromCounts = this.transitionCounts.get(fromState)!;
    const currentCount = fromCounts.get(toState) ?? 0;
    fromCounts.set(toState, currentCount + weight);

    this.totalTransitions += weight;
  }

  /**
   * Rebuild complete transition matrix
   *
   * O(n^2) time complexity where n = number of states
   */
  private rebuildTransitionMatrix(): void {
    for (const stateId of this.states.keys()) {
      this.updateTransitionProbabilities(stateId);
    }
  }

  /**
   * Get transition probability between two states
   * @param fromState - Source state
   * @param toState - Target state
   * @returns Transition probability
   *
   * O(1) time complexity
   */
  getTransitionProbability(fromState: string, toState: string): number {
    const stateProbs = this.transitionMatrix.get(fromState);
    if (!stateProbs) {
      // Return uniform probability if no data
      return 1 / Math.max(1, this.states.size);
    }
    return stateProbs.get(toState) ?? 1 / this.states.size;
  }

  /**
   * Predict next state from current state
   * @param currentState - Current state ID
   * @returns Prediction with confidence intervals
   *
   * O(n) time complexity where n = number of states
   */
  predictNextState(currentState: string): StatePrediction {
    const stateProbs = this.transitionMatrix.get(currentState);

    if (!stateProbs || this.observations.length < this.config.minObservations) {
      // Not enough data - return uniform distribution
      const uniformProb = 1 / Math.max(1, this.states.size);
      const allStates = Array.from(this.states.keys());
      const randomState = allStates[Math.floor(this.random() * allStates.length)] ?? currentState;

      return {
        state: randomState,
        probability: uniformProb,
        confidenceLower: 0,
        confidenceUpper: 1,
        stateProbabilities: new Map(allStates.map(s => [s, uniformProb])),
        entropy: Math.log(this.states.size),
      };
    }

    // Find most likely next state
    let maxState = currentState;
    let maxProb = 0;

    for (const [state, prob] of stateProbs.entries()) {
      if (prob > maxProb) {
        maxProb = prob;
        maxState = state;
      }
    }

    // Calculate entropy (uncertainty measure)
    let entropy = 0;
    for (const prob of stateProbs.values()) {
      if (prob > 0) {
        entropy -= prob * Math.log(prob);
      }
    }

    // Calculate confidence interval using Wilson score interval
    const n = this.getTransitionCount(currentState);
    const z = this.getZScore(this.config.confidenceLevel);
    const { lower, upper } = this.wilsonScoreInterval(maxProb, n, z);

    return {
      state: maxState,
      probability: maxProb,
      confidenceLower: lower,
      confidenceUpper: upper,
      stateProbabilities: new Map(stateProbs),
      entropy,
    };
  }

  /**
   * Get total transition count from a state
   * @param state - State ID
   * @returns Total count
   *
   * O(n) time complexity where n = number of outgoing transitions
   */
  private getTransitionCount(state: string): number {
    const counts = this.transitionCounts.get(state);
    if (!counts) return 0;

    let total = 0;
    for (const count of counts.values()) {
      total += count;
    }
    return total;
  }

  /**
   * Get Z-score for confidence level
   * @param confidence - Confidence level (0-1)
   * @returns Z-score
   *
   * O(1) time complexity
   */
  private getZScore(confidence: number): number {
    // Approximation for common confidence levels
    const levels: Record<number, number> = {
      0.90: 1.645,
      0.95: 1.96,
      0.99: 2.576,
    };

    const rounded = Math.round(confidence * 100) / 100;
    return levels[rounded] ?? 1.96;
  }

  /**
   * Wilson score interval for proportion confidence intervals
   * @param p - Proportion
   * @param n - Sample size
   * @param z - Z-score
   * @returns Lower and upper bounds
   *
   * O(1) time complexity
   */
  private wilsonScoreInterval(p: number, n: number, z: number): { lower: number; upper: number } {
    if (n === 0) return { lower: 0, upper: 1 };

    const denominator = 1 + z * z / n;
    const center = p + z * z / (2 * n);
    const spread = z * Math.sqrt((p * (1 - p) + z * z / (4 * n)) / n);

    return {
      lower: Math.max(0, (center - spread) / denominator),
      upper: Math.min(1, (center + spread) / denominator),
    };
  }

  /**
   * Predict state sequence of length k
   * @param currentState - Current state
   * @param k - Number of steps to predict
   * @returns Sequence of predicted states
   *
   * O(k * n) time complexity where n = number of states
   */
  predictSequence(currentState: string, k: number): Array<{ state: string; probability: number }> {
    const sequence: Array<{ state: string; probability: number }> = [];
    let state = currentState;
    let cumulativeProb = 1;

    for (let i = 0; i < k; i++) {
      const prediction = this.predictNextState(state);
      cumulativeProb *= prediction.probability;
      sequence.push({
        state: prediction.state,
        probability: cumulativeProb,
      });
      state = prediction.state;
    }

    return sequence;
  }

  /**
   * Get stationary distribution (long-term state probabilities)
   *
   * Uses power iteration method to find the eigenvector with eigenvalue 1.
   *
   * @param maxIterations - Maximum iterations for convergence
   * @param tolerance - Convergence tolerance
   * @returns Stationary distribution
   *
   * O(maxIterations * n^2) time complexity where n = number of states
   */
  getStationaryDistribution(maxIterations: number = 1000, tolerance: number = 1e-10): Map<string, number> {
    const states = Array.from(this.states.keys());
    const n = states.length;

    if (n === 0) return new Map();

    // Initialize uniform distribution
    let distribution = new Array(n).fill(1 / n);

    // Power iteration
    for (let iter = 0; iter < maxIterations; iter++) {
      const newDistribution = new Array(n).fill(0);

      // Matrix-vector multiplication: pi' = pi * P
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          const prob = this.getTransitionProbability(states[i], states[j]);
          newDistribution[j] += distribution[i] * prob;
        }
      }

      // Normalize
      const sum = newDistribution.reduce((a, b) => a + b, 0);
      for (let i = 0; i < n; i++) {
        newDistribution[i] /= sum;
      }

      // Check convergence
      let maxDiff = 0;
      for (let i = 0; i < n; i++) {
        maxDiff = Math.max(maxDiff, Math.abs(newDistribution[i] - distribution[i]));
      }

      distribution = newDistribution;

      if (maxDiff < tolerance) break;
    }

    // Convert to map
    const result = new Map<string, number>();
    for (let i = 0; i < n; i++) {
      result.set(states[i], distribution[i]);
    }

    return result;
  }

  // ==================== Hidden Markov Model Methods ====================

  /**
   * Initialize HMM parameters randomly
   * @param numHidden - Number of hidden states
   * @param numObservable - Number of observable states
   * @returns Initialized HMM parameters
   *
   * O(numHidden * numObservable) time complexity
   */
  initializeHMM(numHidden: number, numObservable: number): HMMParameters {
    // Initialize random transition matrix (row-stochastic)
    const transitionMatrix: number[][] = [];
    for (let i = 0; i < numHidden; i++) {
      const row = new Array(numHidden).fill(0).map(() => this.random());
      const sum = row.reduce((a, b) => a + b, 0);
      transitionMatrix.push(row.map(v => v / sum));
    }

    // Initialize random emission matrix (row-stochastic)
    const emissionMatrix: number[][] = [];
    for (let i = 0; i < numHidden; i++) {
      const row = new Array(numObservable).fill(0).map(() => this.random());
      const sum = row.reduce((a, b) => a + b, 0);
      emissionMatrix.push(row.map(v => v / sum));
    }

    // Initialize random initial distribution
    const initialDistribution = new Array(numHidden).fill(0).map(() => this.random());
    const sum = initialDistribution.reduce((a, b) => a + b, 0);
    for (let i = 0; i < numHidden; i++) {
      initialDistribution[i] /= sum;
    }

    return {
      numHiddenStates: numHidden,
      initialDistribution,
      transitionMatrix,
      emissionMatrix,
    };
  }

  /**
   * Viterbi algorithm - find most likely hidden state sequence
   *
   * Given a sequence of observations, finds the most likely sequence
   * of hidden states that generated them.
   *
   * @param observations - Sequence of observation indices
   * @param hmm - HMM parameters
   * @returns Most likely state sequence
   *
   * O(T * N^2) time complexity where T = observations length, N = hidden states
   */
  viterbi(observations: number[], hmm: HMMParameters): ViterbiResult {
    const T = observations.length;
    const N = hmm.numHiddenStates;

    if (T === 0) {
      return {
        stateSequence: [],
        probability: 1,
        logProbability: 0,
        pathProbabilities: [],
      };
    }

    // Use log probabilities for numerical stability
    const logA = hmm.transitionMatrix.map(row => row.map(p => Math.log(p + 1e-300)));
    const logB = hmm.emissionMatrix.map(row => row.map(p => Math.log(p + 1e-300)));
    const logPi = hmm.initialDistribution.map(p => Math.log(p + 1e-300));

    // Delta: best path probability to state i at time t
    const delta: number[][] = [];
    // Psi: backpointer for path reconstruction
    const psi: number[][] = [];

    // Initialize
    delta[0] = [];
    psi[0] = [];
    for (let i = 0; i < N; i++) {
      delta[0][i] = logPi[i] + logB[i][observations[0]];
      psi[0][i] = 0;
    }

    // Recursion
    for (let t = 1; t < T; t++) {
      delta[t] = [];
      psi[t] = [];

      for (let j = 0; j < N; j++) {
        let maxVal = -Infinity;
        let maxIdx = 0;

        for (let i = 0; i < N; i++) {
          const val = delta[t - 1][i] + logA[i][j];
          if (val > maxVal) {
            maxVal = val;
            maxIdx = i;
          }
        }

        delta[t][j] = maxVal + logB[j][observations[t]];
        psi[t][j] = maxIdx;
      }
    }

    // Find best final state
    let maxFinal = -Infinity;
    let finalState = 0;
    for (let i = 0; i < N; i++) {
      if (delta[T - 1][i] > maxFinal) {
        maxFinal = delta[T - 1][i];
        finalState = i;
      }
    }

    // Backtrack to find path
    const stateIndices: number[] = new Array(T);
    stateIndices[T - 1] = finalState;
    for (let t = T - 2; t >= 0; t--) {
      stateIndices[t] = psi[t + 1][stateIndices[t + 1]];
    }

    // Convert to state names
    const stateNames = hmm.hiddenStateNames ?? stateIndices.map(i => `H${i}`);
    const stateSequence = stateIndices.map(i => stateNames[i]);

    return {
      stateSequence,
      probability: Math.exp(maxFinal),
      logProbability: maxFinal,
      pathProbabilities: delta,
    };
  }

  /**
   * Forward algorithm - calculate probability of observation sequence
   *
   * @param observations - Sequence of observation indices
   * @param hmm - HMM parameters
   * @returns Forward probabilities (alpha)
   *
   * O(T * N^2) time complexity where T = observations length, N = hidden states
   */
  forward(observations: number[], hmm: HMMParameters): number[][] {
    const T = observations.length;
    const N = hmm.numHiddenStates;

    if (T === 0) return [];

    const alpha: number[][] = [];

    // Initialize
    alpha[0] = [];
    for (let i = 0; i < N; i++) {
      alpha[0][i] = hmm.initialDistribution[i] * hmm.emissionMatrix[i][observations[0]];
    }

    // Forward pass
    for (let t = 1; t < T; t++) {
      alpha[t] = [];
      for (let j = 0; j < N; j++) {
        let sum = 0;
        for (let i = 0; i < N; i++) {
          sum += alpha[t - 1][i] * hmm.transitionMatrix[i][j];
        }
        alpha[t][j] = sum * hmm.emissionMatrix[j][observations[t]];
      }

      // Normalize to prevent underflow
      const scale = alpha[t].reduce((a, b) => a + b, 0);
      if (scale > 0) {
        for (let j = 0; j < N; j++) {
          alpha[t][j] /= scale;
        }
      }
    }

    return alpha;
  }

  /**
   * Backward algorithm - calculate backward probabilities
   *
   * @param observations - Sequence of observation indices
   * @param hmm - HMM parameters
   * @returns Backward probabilities (beta)
   *
   * O(T * N^2) time complexity where T = observations length, N = hidden states
   */
  backward(observations: number[], hmm: HMMParameters): number[][] {
    const T = observations.length;
    const N = hmm.numHiddenStates;

    if (T === 0) return [];

    const beta: number[][] = new Array(T);

    // Initialize
    beta[T - 1] = new Array(N).fill(1);

    // Backward pass
    for (let t = T - 2; t >= 0; t--) {
      beta[t] = [];
      for (let i = 0; i < N; i++) {
        let sum = 0;
        for (let j = 0; j < N; j++) {
          sum += hmm.transitionMatrix[i][j] *
                 hmm.emissionMatrix[j][observations[t + 1]] *
                 beta[t + 1][j];
        }
        beta[t][i] = sum;
      }

      // Normalize to prevent underflow
      const scale = beta[t].reduce((a, b) => a + b, 0);
      if (scale > 0) {
        for (let i = 0; i < N; i++) {
          beta[t][i] /= scale;
        }
      }
    }

    return beta;
  }

  /**
   * Forward-Backward algorithm - calculate state probabilities
   *
   * Computes the probability of being in each hidden state at each
   * time step given the complete observation sequence.
   *
   * @param observations - Sequence of observation indices
   * @param hmm - HMM parameters
   * @returns Forward-backward result with state probabilities
   *
   * O(T * N^2) time complexity where T = observations length, N = hidden states
   */
  forwardBackward(observations: number[], hmm: HMMParameters): ForwardBackwardResult {
    const alpha = this.forward(observations, hmm);
    const beta = this.backward(observations, hmm);

    const T = observations.length;
    const N = hmm.numHiddenStates;

    if (T === 0) {
      return {
        forwardProbabilities: [],
        backwardProbabilities: [],
        stateProbabilities: [],
        sequenceProbability: 1,
      };
    }

    // Calculate gamma (state probabilities)
    const gamma: number[][] = [];

    for (let t = 0; t < T; t++) {
      gamma[t] = [];
      let sum = 0;

      for (let i = 0; i < N; i++) {
        gamma[t][i] = alpha[t][i] * beta[t][i];
        sum += gamma[t][i];
      }

      // Normalize
      if (sum > 0) {
        for (let i = 0; i < N; i++) {
          gamma[t][i] /= sum;
        }
      }
    }

    // Calculate sequence probability
    const sequenceProbability = alpha[T - 1].reduce((a, b) => a + b, 0);

    return {
      forwardProbabilities: alpha,
      backwardProbabilities: beta,
      stateProbabilities: gamma,
      sequenceProbability,
    };
  }

  /**
   * Baum-Welch algorithm - train HMM parameters from observations
   *
   * Iteratively improves HMM parameters to maximize the likelihood
   * of the observed data using the EM algorithm.
   *
   * @param observations - Sequence of observation indices
   * @param hmm - Initial HMM parameters
   * @param maxIterations - Maximum iterations
   * @param tolerance - Convergence tolerance
   * @returns Trained HMM parameters
   *
   * O(maxIterations * T * N^2) time complexity
   */
  baumWelch(
    observations: number[],
    hmm: HMMParameters,
    maxIterations: number = 100,
    tolerance: number = 1e-6
  ): HMMParameters {
    const T = observations.length;
    const N = hmm.numHiddenStates;
    const M = hmm.emissionMatrix[0].length;

    if (T < 2) return hmm;

    let currentHMM = {
      ...hmm,
      initialDistribution: [...hmm.initialDistribution],
      transitionMatrix: hmm.transitionMatrix.map(row => [...row]),
      emissionMatrix: hmm.emissionMatrix.map(row => [...row]),
    };

    let prevLogLikelihood = -Infinity;

    for (let iter = 0; iter < maxIterations; iter++) {
      const alpha = this.forward(observations, currentHMM);
      const beta = this.backward(observations, currentHMM);

      // Calculate xi (transition probabilities between states at consecutive times)
      const xi: number[][][] = [];
      for (let t = 0; t < T - 1; t++) {
        xi[t] = [];
        let sum = 0;

        for (let i = 0; i < N; i++) {
          xi[t][i] = [];
          for (let j = 0; j < N; j++) {
            xi[t][i][j] = alpha[t][i] *
                          currentHMM.transitionMatrix[i][j] *
                          currentHMM.emissionMatrix[j][observations[t + 1]] *
                          beta[t + 1][j];
            sum += xi[t][i][j];
          }
        }

        // Normalize
        if (sum > 0) {
          for (let i = 0; i < N; i++) {
            for (let j = 0; j < N; j++) {
              xi[t][i][j] /= sum;
            }
          }
        }
      }

      // Calculate gamma
      const gamma: number[][] = [];
      for (let t = 0; t < T; t++) {
        gamma[t] = [];
        let sum = 0;

        for (let i = 0; i < N; i++) {
          gamma[t][i] = alpha[t][i] * beta[t][i];
          sum += gamma[t][i];
        }

        if (sum > 0) {
          for (let i = 0; i < N; i++) {
            gamma[t][i] /= sum;
          }
        }
      }

      // Update initial distribution
      for (let i = 0; i < N; i++) {
        currentHMM.initialDistribution[i] = gamma[0][i];
      }

      // Update transition matrix
      for (let i = 0; i < N; i++) {
        let gammaSum = 0;
        for (let t = 0; t < T - 1; t++) {
          gammaSum += gamma[t][i];
        }

        for (let j = 0; j < N; j++) {
          let xiSum = 0;
          for (let t = 0; t < T - 1; t++) {
            xiSum += xi[t][i][j];
          }
          currentHMM.transitionMatrix[i][j] = gammaSum > 0 ? xiSum / gammaSum : 1 / N;
        }
      }

      // Update emission matrix
      for (let i = 0; i < N; i++) {
        let gammaSum = 0;
        for (let t = 0; t < T; t++) {
          gammaSum += gamma[t][i];
        }

        for (let k = 0; k < M; k++) {
          let sumForK = 0;
          for (let t = 0; t < T; t++) {
            if (observations[t] === k) {
              sumForK += gamma[t][i];
            }
          }
          currentHMM.emissionMatrix[i][k] = gammaSum > 0 ? sumForK / gammaSum : 1 / M;
        }
      }

      // Check convergence
      const logLikelihood = Math.log(alpha[T - 1].reduce((a, b) => a + b, 0) + 1e-300);
      if (Math.abs(logLikelihood - prevLogLikelihood) < tolerance) {
        break;
      }
      prevLogLikelihood = logLikelihood;
    }

    return currentHMM;
  }

  // ==================== Integration Methods ====================

  /**
   * Integrate with OBSERVE phase - provide state predictions
   * @param currentState - Current observed state
   * @param context - Additional context
   * @returns Prediction data for OBSERVE phase
   *
   * O(n) time complexity where n = number of states
   */
  getObservePhaseData(currentState: string, context?: Record<string, unknown>): {
    prediction: StatePrediction;
    stationaryDistribution: Map<string, number>;
    recentTransitions: StateTransition[];
  } {
    const prediction = this.predictNextState(currentState);
    const stationaryDistribution = this.getStationaryDistribution();

    // Get recent transitions from current state
    const recentTransitions: StateTransition[] = [];
    const counts = this.transitionCounts.get(currentState);
    const probs = this.transitionMatrix.get(currentState);

    if (counts && probs) {
      for (const [toState, count] of counts.entries()) {
        recentTransitions.push({
          fromState: currentState,
          toState,
          count,
          probability: probs.get(toState) ?? 0,
        });
      }
    }

    // Sort by probability
    recentTransitions.sort((a, b) => b.probability - a.probability);

    return {
      prediction,
      stationaryDistribution,
      recentTransitions: recentTransitions.slice(0, 5),
    };
  }

  /**
   * Get training statistics
   * @returns Current training stats
   *
   * O(n) time complexity where n = number of transitions
   */
  getStats(): TrainingStats {
    let uniqueTransitions = 0;
    for (const counts of this.transitionCounts.values()) {
      uniqueTransitions += counts.size;
    }

    // Calculate average log likelihood of recent observations
    let avgLogLikelihood = 0;
    if (this.observations.length > 1) {
      let totalLogLik = 0;
      for (let i = 1; i < this.observations.length; i++) {
        const prob = this.getTransitionProbability(
          this.observations[i - 1].state,
          this.observations[i].state
        );
        totalLogLik += Math.log(prob + 1e-300);
      }
      avgLogLikelihood = totalLogLik / (this.observations.length - 1);
    }

    return {
      totalObservations: this.observations.length,
      uniqueStates: this.states.size,
      uniqueTransitions,
      avgLogLikelihood,
      lastUpdate: this.observations.length > 0 ?
        this.observations[this.observations.length - 1].timestamp : 0,
    };
  }

  /**
   * Export state for persistence
   * @returns Serializable state
   *
   * O(n^2) time complexity where n = number of states
   */
  exportState(): {
    states: MarkovState[];
    transitionCounts: Record<string, Record<string, number>>;
    observations: Observation[];
    config: MarkovChainConfig;
  } {
    const transitionCounts: Record<string, Record<string, number>> = {};
    for (const [from, counts] of this.transitionCounts.entries()) {
      transitionCounts[from] = {};
      for (const [to, count] of counts.entries()) {
        transitionCounts[from][to] = count;
      }
    }

    return {
      states: Array.from(this.states.values()),
      transitionCounts,
      observations: [...this.observations],
      config: { ...this.config },
    };
  }

  /**
   * Import state from persistence
   * @param state - Serialized state
   *
   * O(n^2) time complexity where n = number of states
   */
  importState(state: {
    states: MarkovState[];
    transitionCounts: Record<string, Record<string, number>>;
    observations: Observation[];
    config?: Partial<MarkovChainConfig>;
  }): void {
    this.states.clear();
    this.transitionCounts.clear();
    this.observations = [];

    for (const markovState of state.states) {
      this.states.set(markovState.id, markovState);
    }

    for (const [from, counts] of Object.entries(state.transitionCounts)) {
      const countMap = new Map<string, number>();
      for (const [to, count] of Object.entries(counts)) {
        countMap.set(to, count);
        this.totalTransitions += count;
      }
      this.transitionCounts.set(from, countMap);
    }

    this.observations = [...state.observations];

    if (state.config) {
      this.config = { ...this.config, ...state.config };
    }

    this.rebuildTransitionMatrix();
  }

  /**
   * Reset the predictor
   *
   * O(1) time complexity
   */
  reset(): void {
    this.states.clear();
    this.transitionCounts.clear();
    this.transitionMatrix.clear();
    this.observations = [];
    this.totalTransitions = 0;
  }
}

// Factory function
export function createMarkovChainPredictor(
  config?: Partial<MarkovChainConfig>,
  seed?: number
): MarkovChainPredictor {
  return new MarkovChainPredictor(config, seed);
}

// Default singleton
export const markovChainPredictor = new MarkovChainPredictor();
