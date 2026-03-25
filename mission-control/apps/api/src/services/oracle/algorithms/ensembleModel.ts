/**
 * Ensemble Model
 * Story alg-7 - Combine predictions from multiple algorithms
 *
 * Implements ensemble learning with weighted voting, stacking, and bagging
 * strategies for combining predictions from heterogeneous models like
 * MAB, GA, Q-Learning, and others.
 */

/**
 * Prediction from a base model
 */
export interface BasePrediction {
  /** Unique identifier for the prediction */
  id: string;
  /** Model that generated this prediction */
  modelId: string;
  /** Model type for heterogeneous handling */
  modelType: 'mab' | 'ga' | 'qlearning' | 'markov' | 'annealing' | 'astar' | 'neural' | 'custom';
  /** Predicted value (can be numeric or categorical) */
  value: number | string;
  /** Confidence score (0-1) */
  confidence: number;
  /** Raw probability distribution (if available) */
  probabilities?: Map<string | number, number>;
  /** Timestamp of prediction */
  timestamp: number;
  /** Model-specific metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Historical performance record for a model
 */
export interface ModelPerformance {
  /** Model identifier */
  modelId: string;
  /** Total number of predictions */
  totalPredictions: number;
  /** Number of correct predictions */
  correctPredictions: number;
  /** Accuracy rate (0-1) */
  accuracy: number;
  /** Mean Absolute Error for regression */
  mae: number;
  /** Root Mean Square Error */
  rmse: number;
  /** Recent accuracy (sliding window) */
  recentAccuracy: number;
  /** Last update timestamp */
  lastUpdate: number;
  /** Performance history over time */
  accuracyHistory: Array<{ timestamp: number; accuracy: number }>;
}

/**
 * Ensemble prediction result with confidence intervals
 */
export interface EnsemblePrediction {
  /** Final combined prediction value */
  value: number | string;
  /** Overall confidence score (0-1) */
  confidence: number;
  /** Lower bound of confidence interval */
  confidenceLower: number;
  /** Upper bound of confidence interval */
  confidenceUpper: number;
  /** Prediction variance across models */
  variance: number;
  /** Entropy (uncertainty measure) */
  entropy: number;
  /** Individual model contributions */
  modelContributions: Array<{
    modelId: string;
    weight: number;
    prediction: number | string;
    contribution: number;
  }>;
  /** Aggregated probability distribution */
  aggregatedProbabilities?: Map<string | number, number>;
  /** Ensemble method used */
  method: EnsembleMethod;
  /** Prediction timestamp */
  timestamp: number;
}

/**
 * Ensemble combination method
 */
export type EnsembleMethod =
  | 'weighted-voting'
  | 'simple-voting'
  | 'stacking'
  | 'bagging'
  | 'boosting'
  | 'averaging'
  | 'weighted-averaging'
  | 'median'
  | 'bayesian';

/**
 * Weight update strategy
 */
export type WeightStrategy =
  | 'accuracy-based'
  | 'recency-weighted'
  | 'exponential-decay'
  | 'performance-rank'
  | 'bayesian-update'
  | 'fixed';

/**
 * Configuration for Ensemble Model
 */
export interface EnsembleConfig {
  /** Combination method */
  method: EnsembleMethod;
  /** Weight update strategy */
  weightStrategy: WeightStrategy;
  /** Initial weight for new models */
  initialWeight: number;
  /** Minimum weight threshold */
  minWeight: number;
  /** Maximum weight threshold */
  maxWeight: number;
  /** Learning rate for weight updates */
  learningRate: number;
  /** Sliding window size for recent performance */
  recentWindowSize: number;
  /** Decay factor for exponential weight decay */
  decayFactor: number;
  /** Confidence level for intervals (0-1) */
  confidenceLevel: number;
  /** Minimum models required for prediction */
  minModels: number;
  /** Enable diversity bonus (reward models with different predictions) */
  diversityBonus: boolean;
  /** Diversity bonus weight */
  diversityWeight: number;
}

/**
 * Stacking meta-learner training data
 */
export interface StackingTrainingSample {
  /** Base model predictions */
  basePredictions: Map<string, number | string>;
  /** Actual ground truth value */
  groundTruth: number | string;
  /** Features from context */
  contextFeatures?: number[];
  /** Timestamp */
  timestamp: number;
}

/**
 * Bootstrap sample for bagging
 */
export interface BootstrapSample {
  /** Sample indices */
  indices: number[];
  /** Model trained on this sample */
  modelId: string;
  /** Out-of-bag indices for validation */
  oobIndices: number[];
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
 * Ensemble Model Service
 *
 * Combines predictions from multiple heterogeneous algorithms using
 * various ensemble strategies with dynamic weight adjustment based
 * on recent accuracy.
 */
export class EnsembleModelService {
  private config: EnsembleConfig;
  private random: () => number;
  private modelWeights: Map<string, number> = new Map();
  private modelPerformance: Map<string, ModelPerformance> = new Map();
  private predictions: Map<string, BasePrediction[]> = new Map();
  private stackingTrainingData: StackingTrainingSample[] = [];
  private metaLearnerWeights: Map<string, number> = new Map();

  /**
   * Creates a new Ensemble Model service
   * @param config - Configuration options
   * @param seed - Random seed for reproducibility
   */
  constructor(config: Partial<EnsembleConfig> = {}, seed?: number) {
    this.config = {
      method: config.method ?? 'weighted-voting',
      weightStrategy: config.weightStrategy ?? 'accuracy-based',
      initialWeight: config.initialWeight ?? 1.0,
      minWeight: config.minWeight ?? 0.01,
      maxWeight: config.maxWeight ?? 10.0,
      learningRate: config.learningRate ?? 0.1,
      recentWindowSize: config.recentWindowSize ?? 50,
      decayFactor: config.decayFactor ?? 0.95,
      confidenceLevel: config.confidenceLevel ?? 0.95,
      minModels: config.minModels ?? 2,
      diversityBonus: config.diversityBonus ?? true,
      diversityWeight: config.diversityWeight ?? 0.1,
    };
    this.random = createRandom(seed);
  }

  /**
   * Register a model with the ensemble
   * @param modelId - Unique model identifier
   * @param modelType - Type of model for heterogeneous handling
   * @param initialWeight - Optional initial weight
   *
   * O(1) time complexity
   */
  registerModel(
    modelId: string,
    modelType: BasePrediction['modelType'],
    initialWeight?: number
  ): void {
    if (this.modelWeights.has(modelId)) {
      return; // Already registered
    }

    this.modelWeights.set(modelId, initialWeight ?? this.config.initialWeight);
    this.modelPerformance.set(modelId, {
      modelId,
      totalPredictions: 0,
      correctPredictions: 0,
      accuracy: 0.5, // Start with neutral accuracy
      mae: 0,
      rmse: 0,
      recentAccuracy: 0.5,
      lastUpdate: Date.now(),
      accuracyHistory: [],
    });
    this.predictions.set(modelId, []);
  }

  /**
   * Submit a prediction from a base model
   * @param prediction - Base model prediction
   *
   * O(1) time complexity
   */
  submitPrediction(prediction: BasePrediction): void {
    if (!this.modelWeights.has(prediction.modelId)) {
      this.registerModel(prediction.modelId, prediction.modelType);
    }

    const modelPredictions = this.predictions.get(prediction.modelId) ?? [];
    modelPredictions.push(prediction);

    // Keep only recent predictions
    if (modelPredictions.length > this.config.recentWindowSize * 2) {
      modelPredictions.shift();
    }

    this.predictions.set(prediction.modelId, modelPredictions);
  }

  /**
   * Get current predictions from all models
   * @returns Map of model ID to most recent prediction
   *
   * O(n) time complexity where n = number of models
   */
  getCurrentPredictions(): Map<string, BasePrediction> {
    const current = new Map<string, BasePrediction>();

    for (const [modelId, preds] of this.predictions) {
      if (preds.length > 0) {
        current.set(modelId, preds[preds.length - 1]);
      }
    }

    return current;
  }

  /**
   * Combine predictions using the configured ensemble method
   * @param targetPredictions - Optional specific predictions to combine
   * @returns Combined ensemble prediction
   *
   * O(n) time complexity where n = number of models
   */
  combine(targetPredictions?: BasePrediction[]): EnsemblePrediction {
    const predictions = targetPredictions ?? Array.from(this.getCurrentPredictions().values());

    if (predictions.length < this.config.minModels) {
      throw new Error(`Insufficient models for ensemble: ${predictions.length} < ${this.config.minModels}`);
    }

    switch (this.config.method) {
      case 'weighted-voting':
        return this.weightedVoting(predictions);
      case 'simple-voting':
        return this.simpleVoting(predictions);
      case 'stacking':
        return this.stacking(predictions);
      case 'bagging':
        return this.bagging(predictions);
      case 'weighted-averaging':
        return this.weightedAveraging(predictions);
      case 'averaging':
        return this.simpleAveraging(predictions);
      case 'median':
        return this.medianCombination(predictions);
      case 'bayesian':
        return this.bayesianCombination(predictions);
      default:
        return this.weightedVoting(predictions);
    }
  }

  /**
   * Weighted voting for classification/discrete predictions
   * @param predictions - Base model predictions
   * @returns Combined prediction
   *
   * O(n * m) time complexity where n = models, m = unique values
   */
  private weightedVoting(predictions: BasePrediction[]): EnsemblePrediction {
    const voteWeights = new Map<string | number, number>();
    const contributions: EnsemblePrediction['modelContributions'] = [];
    let totalWeight = 0;

    // Collect weighted votes
    for (const pred of predictions) {
      const weight = this.getEffectiveWeight(pred.modelId, pred.confidence);
      const value = pred.value;

      const currentWeight = voteWeights.get(value) ?? 0;
      voteWeights.set(value, currentWeight + weight);
      totalWeight += weight;

      contributions.push({
        modelId: pred.modelId,
        weight,
        prediction: value,
        contribution: weight,
      });
    }

    // Normalize to probabilities
    const probabilities = new Map<string | number, number>();
    for (const [value, weight] of voteWeights) {
      probabilities.set(value, weight / totalWeight);
    }

    // Find winner
    let maxWeight = -Infinity;
    let winner: string | number = '';

    for (const [value, weight] of voteWeights) {
      if (weight > maxWeight) {
        maxWeight = weight;
        winner = value;
      }
    }

    // Calculate metrics
    const confidence = maxWeight / totalWeight;
    const variance = this.calculateVariance(predictions);
    const entropy = this.calculateEntropy(probabilities);
    const { lower, upper } = this.calculateConfidenceInterval(confidence, predictions.length);

    return {
      value: winner,
      confidence,
      confidenceLower: lower,
      confidenceUpper: upper,
      variance,
      entropy,
      modelContributions: contributions,
      aggregatedProbabilities: probabilities,
      method: 'weighted-voting',
      timestamp: Date.now(),
    };
  }

  /**
   * Simple majority voting
   * @param predictions - Base model predictions
   * @returns Combined prediction
   *
   * O(n) time complexity where n = number of predictions
   */
  private simpleVoting(predictions: BasePrediction[]): EnsemblePrediction {
    const votes = new Map<string | number, number>();
    const contributions: EnsemblePrediction['modelContributions'] = [];

    for (const pred of predictions) {
      const current = votes.get(pred.value) ?? 0;
      votes.set(pred.value, current + 1);

      contributions.push({
        modelId: pred.modelId,
        weight: 1,
        prediction: pred.value,
        contribution: 1,
      });
    }

    // Find majority winner
    let maxVotes = 0;
    let winner: string | number = '';

    for (const [value, count] of votes) {
      if (count > maxVotes) {
        maxVotes = count;
        winner = value;
      }
    }

    const confidence = maxVotes / predictions.length;
    const variance = this.calculateVariance(predictions);

    // Convert to probabilities
    const probabilities = new Map<string | number, number>();
    for (const [value, count] of votes) {
      probabilities.set(value, count / predictions.length);
    }

    const entropy = this.calculateEntropy(probabilities);
    const { lower, upper } = this.calculateConfidenceInterval(confidence, predictions.length);

    return {
      value: winner,
      confidence,
      confidenceLower: lower,
      confidenceUpper: upper,
      variance,
      entropy,
      modelContributions: contributions,
      aggregatedProbabilities: probabilities,
      method: 'simple-voting',
      timestamp: Date.now(),
    };
  }

  /**
   * Weighted averaging for regression/continuous predictions
   * @param predictions - Base model predictions
   * @returns Combined prediction
   *
   * O(n) time complexity where n = number of predictions
   */
  private weightedAveraging(predictions: BasePrediction[]): EnsemblePrediction {
    const numericPreds = predictions.filter(p => typeof p.value === 'number');

    if (numericPreds.length === 0) {
      throw new Error('Weighted averaging requires numeric predictions');
    }

    let weightedSum = 0;
    let totalWeight = 0;
    const contributions: EnsemblePrediction['modelContributions'] = [];

    for (const pred of numericPreds) {
      const weight = this.getEffectiveWeight(pred.modelId, pred.confidence);
      weightedSum += (pred.value as number) * weight;
      totalWeight += weight;

      contributions.push({
        modelId: pred.modelId,
        weight,
        prediction: pred.value,
        contribution: ((pred.value as number) * weight) / totalWeight,
      });
    }

    const average = weightedSum / totalWeight;
    const variance = this.calculateVarianceNumeric(numericPreds.map(p => p.value as number));
    const stdDev = Math.sqrt(variance);

    // Confidence based on variance
    const confidence = Math.max(0, Math.min(1, 1 - variance / (Math.abs(average) + 1)));
    const { lower, upper } = this.calculatePredictionInterval(average, stdDev, numericPreds.length);

    return {
      value: average,
      confidence,
      confidenceLower: lower,
      confidenceUpper: upper,
      variance,
      entropy: Math.log(stdDev + 1),
      modelContributions: contributions,
      method: 'weighted-averaging',
      timestamp: Date.now(),
    };
  }

  /**
   * Simple averaging for regression
   * @param predictions - Base model predictions
   * @returns Combined prediction
   *
   * O(n) time complexity where n = number of predictions
   */
  private simpleAveraging(predictions: BasePrediction[]): EnsemblePrediction {
    const numericPreds = predictions.filter(p => typeof p.value === 'number');

    if (numericPreds.length === 0) {
      throw new Error('Averaging requires numeric predictions');
    }

    const values = numericPreds.map(p => p.value as number);
    const average = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = this.calculateVarianceNumeric(values);
    const stdDev = Math.sqrt(variance);

    const contributions = numericPreds.map(pred => ({
      modelId: pred.modelId,
      weight: 1 / numericPreds.length,
      prediction: pred.value,
      contribution: (pred.value as number) / numericPreds.length,
    }));

    const confidence = Math.max(0, Math.min(1, 1 - variance / (Math.abs(average) + 1)));
    const { lower, upper } = this.calculatePredictionInterval(average, stdDev, numericPreds.length);

    return {
      value: average,
      confidence,
      confidenceLower: lower,
      confidenceUpper: upper,
      variance,
      entropy: Math.log(stdDev + 1),
      modelContributions: contributions,
      method: 'averaging',
      timestamp: Date.now(),
    };
  }

  /**
   * Median combination (robust to outliers)
   * @param predictions - Base model predictions
   * @returns Combined prediction
   *
   * O(n log n) time complexity due to sorting
   */
  private medianCombination(predictions: BasePrediction[]): EnsemblePrediction {
    const numericPreds = predictions.filter(p => typeof p.value === 'number');

    if (numericPreds.length === 0) {
      throw new Error('Median requires numeric predictions');
    }

    const values = numericPreds.map(p => p.value as number).sort((a, b) => a - b);
    const n = values.length;
    const median = n % 2 === 0
      ? (values[n / 2 - 1] + values[n / 2]) / 2
      : values[Math.floor(n / 2)];

    const variance = this.calculateVarianceNumeric(values);
    const mad = this.calculateMAD(values, median);

    const contributions = numericPreds.map(pred => ({
      modelId: pred.modelId,
      weight: Math.abs((pred.value as number) - median) < mad ? 1 : 0.5,
      prediction: pred.value,
      contribution: 1 / numericPreds.length,
    }));

    // Confidence based on MAD
    const confidence = Math.max(0, Math.min(1, 1 - mad / (Math.abs(median) + 1)));

    // Use MAD-based interval
    const z = this.getZScore(this.config.confidenceLevel);
    const lower = median - z * mad * 1.4826; // Consistency constant
    const upper = median + z * mad * 1.4826;

    return {
      value: median,
      confidence,
      confidenceLower: lower,
      confidenceUpper: upper,
      variance,
      entropy: Math.log(mad + 1),
      modelContributions: contributions,
      method: 'median',
      timestamp: Date.now(),
    };
  }

  /**
   * Stacking with meta-learner
   * @param predictions - Base model predictions
   * @returns Combined prediction
   *
   * O(n) time complexity where n = number of predictions
   */
  private stacking(predictions: BasePrediction[]): EnsemblePrediction {
    // Use meta-learner weights if trained, otherwise fall back to weighted averaging
    if (this.metaLearnerWeights.size === 0) {
      return this.weightedAveraging(predictions);
    }

    const numericPreds = predictions.filter(p => typeof p.value === 'number');
    let weightedSum = 0;
    let totalWeight = 0;
    const contributions: EnsemblePrediction['modelContributions'] = [];

    for (const pred of numericPreds) {
      const metaWeight = this.metaLearnerWeights.get(pred.modelId) ?? 1;
      const effectiveWeight = metaWeight * pred.confidence;

      weightedSum += (pred.value as number) * effectiveWeight;
      totalWeight += effectiveWeight;

      contributions.push({
        modelId: pred.modelId,
        weight: effectiveWeight,
        prediction: pred.value,
        contribution: ((pred.value as number) * effectiveWeight),
      });
    }

    const stackedValue = totalWeight > 0 ? weightedSum / totalWeight : 0;
    const variance = this.calculateVarianceNumeric(numericPreds.map(p => p.value as number));
    const confidence = Math.max(0, Math.min(1, 1 - variance / (Math.abs(stackedValue) + 1)));

    const stdDev = Math.sqrt(variance);
    const { lower, upper } = this.calculatePredictionInterval(stackedValue, stdDev, numericPreds.length);

    return {
      value: stackedValue,
      confidence,
      confidenceLower: lower,
      confidenceUpper: upper,
      variance,
      entropy: Math.log(variance + 1),
      modelContributions: contributions,
      method: 'stacking',
      timestamp: Date.now(),
    };
  }

  /**
   * Bagging with bootstrap aggregation
   * @param predictions - Base model predictions
   * @returns Combined prediction
   *
   * O(n) time complexity where n = number of predictions
   */
  private bagging(predictions: BasePrediction[]): EnsemblePrediction {
    // Perform bootstrap sampling
    const numBootstraps = Math.min(10, predictions.length);
    const bootstrapPredictions: (number | string)[] = [];

    for (let b = 0; b < numBootstraps; b++) {
      // Sample with replacement
      const sample: BasePrediction[] = [];
      for (let i = 0; i < predictions.length; i++) {
        const idx = Math.floor(this.random() * predictions.length);
        sample.push(predictions[idx]);
      }

      // Aggregate sample (simple average for numeric, voting for categorical)
      const numericSample = sample.filter(p => typeof p.value === 'number');
      if (numericSample.length > 0) {
        const avg = numericSample.reduce((s, p) => s + (p.value as number), 0) / numericSample.length;
        bootstrapPredictions.push(avg);
      } else {
        const votes = new Map<string | number, number>();
        for (const p of sample) {
          votes.set(p.value, (votes.get(p.value) ?? 0) + 1);
        }
        let maxVotes = 0;
        let winner: string | number = '';
        for (const [v, c] of votes) {
          if (c > maxVotes) {
            maxVotes = c;
            winner = v;
          }
        }
        bootstrapPredictions.push(winner);
      }
    }

    // Aggregate bootstrap predictions
    const isNumeric = bootstrapPredictions.every(p => typeof p === 'number');

    if (isNumeric) {
      const values = bootstrapPredictions as number[];
      const average = values.reduce((a, b) => a + b, 0) / values.length;
      const variance = this.calculateVarianceNumeric(values);
      const stdDev = Math.sqrt(variance);
      const confidence = Math.max(0, Math.min(1, 1 - variance / (Math.abs(average) + 1)));
      const { lower, upper } = this.calculatePredictionInterval(average, stdDev, values.length);

      return {
        value: average,
        confidence,
        confidenceLower: lower,
        confidenceUpper: upper,
        variance,
        entropy: Math.log(variance + 1),
        modelContributions: predictions.map(p => ({
          modelId: p.modelId,
          weight: 1 / predictions.length,
          prediction: p.value,
          contribution: 1 / predictions.length,
        })),
        method: 'bagging',
        timestamp: Date.now(),
      };
    }

    // Categorical case
    const votes = new Map<string | number, number>();
    for (const p of bootstrapPredictions) {
      votes.set(p, (votes.get(p) ?? 0) + 1);
    }

    let maxVotes = 0;
    let winner: string | number = '';
    for (const [v, c] of votes) {
      if (c > maxVotes) {
        maxVotes = c;
        winner = v;
      }
    }

    const confidence = maxVotes / bootstrapPredictions.length;
    const probabilities = new Map<string | number, number>();
    for (const [v, c] of votes) {
      probabilities.set(v, c / bootstrapPredictions.length);
    }

    return {
      value: winner,
      confidence,
      confidenceLower: confidence * 0.8,
      confidenceUpper: Math.min(1, confidence * 1.2),
      variance: 1 - confidence,
      entropy: this.calculateEntropy(probabilities),
      modelContributions: predictions.map(p => ({
        modelId: p.modelId,
        weight: 1 / predictions.length,
        prediction: p.value,
        contribution: 1 / predictions.length,
      })),
      aggregatedProbabilities: probabilities,
      method: 'bagging',
      timestamp: Date.now(),
    };
  }

  /**
   * Bayesian model combination
   * @param predictions - Base model predictions
   * @returns Combined prediction
   *
   * O(n * m) time complexity where n = models, m = unique values
   */
  private bayesianCombination(predictions: BasePrediction[]): EnsemblePrediction {
    // Use posterior model probabilities based on performance
    const posteriors = new Map<string, number>();
    let totalPosterior = 0;

    for (const [modelId, perf] of this.modelPerformance) {
      // Prior is proportional to historical accuracy
      const prior = perf.accuracy + 0.01;
      // Likelihood based on confidence and recency
      const likelihood = perf.recentAccuracy + 0.01;
      const posterior = prior * likelihood;
      posteriors.set(modelId, posterior);
      totalPosterior += posterior;
    }

    // Normalize posteriors
    for (const [modelId, post] of posteriors) {
      posteriors.set(modelId, post / totalPosterior);
    }

    // Combine predictions with Bayesian weights
    const valueWeights = new Map<string | number, number>();
    const contributions: EnsemblePrediction['modelContributions'] = [];

    for (const pred of predictions) {
      const bayesWeight = posteriors.get(pred.modelId) ?? 1 / predictions.length;
      const current = valueWeights.get(pred.value) ?? 0;
      valueWeights.set(pred.value, current + bayesWeight * pred.confidence);

      contributions.push({
        modelId: pred.modelId,
        weight: bayesWeight,
        prediction: pred.value,
        contribution: bayesWeight * pred.confidence,
      });
    }

    // Normalize and find winner
    let totalWeight = 0;
    for (const w of valueWeights.values()) {
      totalWeight += w;
    }

    let maxWeight = 0;
    let winner: string | number = '';
    const probabilities = new Map<string | number, number>();

    for (const [value, weight] of valueWeights) {
      const normalizedWeight = weight / totalWeight;
      probabilities.set(value, normalizedWeight);
      if (normalizedWeight > maxWeight) {
        maxWeight = normalizedWeight;
        winner = value;
      }
    }

    const confidence = maxWeight;
    const entropy = this.calculateEntropy(probabilities);
    const { lower, upper } = this.calculateConfidenceInterval(confidence, predictions.length);

    return {
      value: winner,
      confidence,
      confidenceLower: lower,
      confidenceUpper: upper,
      variance: 1 - confidence,
      entropy,
      modelContributions: contributions,
      aggregatedProbabilities: probabilities,
      method: 'bayesian',
      timestamp: Date.now(),
    };
  }

  /**
   * Record actual outcome and update model performance
   * @param predictionId - ID of the prediction
   * @param actualValue - Actual ground truth value
   *
   * O(n) time complexity where n = number of models
   */
  recordOutcome(predictionId: string, actualValue: number | string): void {
    for (const [modelId, preds] of this.predictions) {
      const pred = preds.find(p => p.id === predictionId);
      if (pred) {
        this.updateModelPerformance(modelId, pred, actualValue);
      }
    }

    // Also update stacking training data
    const sample: StackingTrainingSample = {
      basePredictions: new Map(),
      groundTruth: actualValue,
      timestamp: Date.now(),
    };

    for (const [modelId, preds] of this.predictions) {
      const pred = preds.find(p => p.id === predictionId);
      if (pred) {
        sample.basePredictions.set(modelId, pred.value);
      }
    }

    if (sample.basePredictions.size > 0) {
      this.stackingTrainingData.push(sample);
      if (this.stackingTrainingData.length > 1000) {
        this.stackingTrainingData.shift();
      }
    }
  }

  /**
   * Update performance metrics for a model
   * @param modelId - Model identifier
   * @param prediction - The prediction made
   * @param actualValue - Actual ground truth
   *
   * O(1) time complexity
   */
  private updateModelPerformance(
    modelId: string,
    prediction: BasePrediction,
    actualValue: number | string
  ): void {
    const perf = this.modelPerformance.get(modelId);
    if (!perf) return;

    perf.totalPredictions++;

    // Check if correct
    const isCorrect = typeof actualValue === 'number' && typeof prediction.value === 'number'
      ? Math.abs(actualValue - prediction.value) < 0.01
      : actualValue === prediction.value;

    if (isCorrect) {
      perf.correctPredictions++;
    }

    perf.accuracy = perf.correctPredictions / perf.totalPredictions;

    // Update MAE/RMSE for numeric predictions
    if (typeof actualValue === 'number' && typeof prediction.value === 'number') {
      const error = actualValue - prediction.value;
      const n = perf.totalPredictions;
      perf.mae = ((n - 1) * perf.mae + Math.abs(error)) / n;
      perf.rmse = Math.sqrt(((n - 1) * perf.rmse * perf.rmse + error * error) / n);
    }

    // Update recent accuracy (exponential moving average)
    const alpha = 2 / (this.config.recentWindowSize + 1);
    perf.recentAccuracy = alpha * (isCorrect ? 1 : 0) + (1 - alpha) * perf.recentAccuracy;

    // Record history
    perf.accuracyHistory.push({
      timestamp: Date.now(),
      accuracy: perf.recentAccuracy,
    });

    // Trim history
    if (perf.accuracyHistory.length > 100) {
      perf.accuracyHistory.shift();
    }

    perf.lastUpdate = Date.now();

    // Update weights based on performance
    this.updateWeights();
  }

  /**
   * Update model weights based on performance
   *
   * O(n) time complexity where n = number of models
   */
  private updateWeights(): void {
    switch (this.config.weightStrategy) {
      case 'accuracy-based':
        this.updateWeightsAccuracy();
        break;
      case 'recency-weighted':
        this.updateWeightsRecency();
        break;
      case 'exponential-decay':
        this.updateWeightsExponentialDecay();
        break;
      case 'performance-rank':
        this.updateWeightsRank();
        break;
      case 'bayesian-update':
        this.updateWeightsBayesian();
        break;
      case 'fixed':
        // No update
        break;
    }
  }

  /**
   * Update weights based on accuracy
   *
   * O(n) time complexity where n = number of models
   */
  private updateWeightsAccuracy(): void {
    for (const [modelId, perf] of this.modelPerformance) {
      const currentWeight = this.modelWeights.get(modelId) ?? this.config.initialWeight;
      const targetWeight = perf.accuracy + this.config.minWeight;
      const newWeight = currentWeight + this.config.learningRate * (targetWeight - currentWeight);
      this.modelWeights.set(modelId, this.clampWeight(newWeight));
    }
  }

  /**
   * Update weights with recency weighting
   *
   * O(n) time complexity where n = number of models
   */
  private updateWeightsRecency(): void {
    const now = Date.now();

    for (const [modelId, perf] of this.modelPerformance) {
      const timeSinceUpdate = now - perf.lastUpdate;
      const recencyFactor = Math.exp(-timeSinceUpdate / (24 * 60 * 60 * 1000)); // Daily decay
      const newWeight = perf.recentAccuracy * recencyFactor + this.config.minWeight;
      this.modelWeights.set(modelId, this.clampWeight(newWeight));
    }
  }

  /**
   * Update weights with exponential decay
   *
   * O(n) time complexity where n = number of models
   */
  private updateWeightsExponentialDecay(): void {
    for (const [modelId, perf] of this.modelPerformance) {
      const currentWeight = this.modelWeights.get(modelId) ?? this.config.initialWeight;
      const decayedWeight = currentWeight * this.config.decayFactor;
      const performanceBoost = perf.recentAccuracy * (1 - this.config.decayFactor);
      const newWeight = decayedWeight + performanceBoost;
      this.modelWeights.set(modelId, this.clampWeight(newWeight));
    }
  }

  /**
   * Update weights based on performance rank
   *
   * O(n log n) time complexity due to sorting
   */
  private updateWeightsRank(): void {
    const rankings = Array.from(this.modelPerformance.values())
      .sort((a, b) => b.recentAccuracy - a.recentAccuracy);

    const n = rankings.length;
    for (let i = 0; i < n; i++) {
      const rank = n - i; // Highest accuracy gets highest rank
      const weight = (rank / n) * (this.config.maxWeight - this.config.minWeight) + this.config.minWeight;
      this.modelWeights.set(rankings[i].modelId, weight);
    }
  }

  /**
   * Bayesian weight update
   *
   * O(n) time complexity where n = number of models
   */
  private updateWeightsBayesian(): void {
    // Use Beta distribution posterior
    for (const [modelId, perf] of this.modelPerformance) {
      // Beta distribution parameters
      const alpha = perf.correctPredictions + 1;
      const beta = perf.totalPredictions - perf.correctPredictions + 1;

      // Posterior mean
      const posteriorMean = alpha / (alpha + beta);

      // Weight includes uncertainty (higher weight for lower variance)
      const posteriorVariance = (alpha * beta) / ((alpha + beta) ** 2 * (alpha + beta + 1));
      const certaintyBonus = 1 / (1 + posteriorVariance * 10);

      const newWeight = posteriorMean * certaintyBonus + this.config.minWeight;
      this.modelWeights.set(modelId, this.clampWeight(newWeight));
    }
  }

  /**
   * Get effective weight for a model considering confidence and diversity
   * @param modelId - Model identifier
   * @param confidence - Prediction confidence
   * @returns Effective weight
   *
   * O(1) time complexity
   */
  private getEffectiveWeight(modelId: string, confidence: number): number {
    const baseWeight = this.modelWeights.get(modelId) ?? this.config.initialWeight;
    return baseWeight * confidence;
  }

  /**
   * Train stacking meta-learner
   *
   * O(n * m) time complexity where n = training samples, m = models
   */
  trainMetaLearner(): void {
    if (this.stackingTrainingData.length < 10) {
      return; // Not enough data
    }

    // Simple linear regression for meta-learner weights
    const modelIds = Array.from(this.modelPerformance.keys());
    const numModels = modelIds.length;

    // Build feature matrix and target vector
    const X: number[][] = [];
    const y: number[] = [];

    for (const sample of this.stackingTrainingData) {
      if (typeof sample.groundTruth !== 'number') continue;

      const features: number[] = [];
      for (const modelId of modelIds) {
        const pred = sample.basePredictions.get(modelId);
        if (typeof pred === 'number') {
          features.push(pred);
        } else {
          features.push(0);
        }
      }

      if (features.length === numModels) {
        X.push(features);
        y.push(sample.groundTruth);
      }
    }

    if (X.length < numModels) return;

    // Solve using gradient descent
    const weights = new Array(numModels).fill(1 / numModels);
    const learningRate = 0.01;
    const iterations = 100;

    for (let iter = 0; iter < iterations; iter++) {
      const gradients = new Array(numModels).fill(0);

      for (let i = 0; i < X.length; i++) {
        let prediction = 0;
        for (let j = 0; j < numModels; j++) {
          prediction += weights[j] * X[i][j];
        }
        const error = prediction - y[i];

        for (let j = 0; j < numModels; j++) {
          gradients[j] += error * X[i][j];
        }
      }

      // Update weights
      for (let j = 0; j < numModels; j++) {
        weights[j] -= learningRate * gradients[j] / X.length;
      }
    }

    // Normalize weights
    const sum = weights.reduce((a, b) => a + Math.abs(b), 0);
    for (let j = 0; j < numModels; j++) {
      this.metaLearnerWeights.set(modelIds[j], Math.abs(weights[j]) / sum);
    }
  }

  /**
   * Clamp weight to configured bounds
   * @param weight - Weight to clamp
   * @returns Clamped weight
   *
   * O(1) time complexity
   */
  private clampWeight(weight: number): number {
    return Math.max(this.config.minWeight, Math.min(this.config.maxWeight, weight));
  }

  /**
   * Calculate variance for mixed predictions
   * @param predictions - Predictions to analyze
   * @returns Variance measure
   *
   * O(n) time complexity
   */
  private calculateVariance(predictions: BasePrediction[]): number {
    const numericPreds = predictions.filter(p => typeof p.value === 'number');

    if (numericPreds.length > 0) {
      return this.calculateVarianceNumeric(numericPreds.map(p => p.value as number));
    }

    // For categorical, return disagreement rate
    const votes = new Map<string | number, number>();
    for (const pred of predictions) {
      votes.set(pred.value, (votes.get(pred.value) ?? 0) + 1);
    }

    const maxVotes = Math.max(...votes.values());
    return 1 - maxVotes / predictions.length;
  }

  /**
   * Calculate variance for numeric values
   * @param values - Numeric values
   * @returns Variance
   *
   * O(n) time complexity
   */
  private calculateVarianceNumeric(values: number[]): number {
    if (values.length === 0) return 0;

    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  }

  /**
   * Calculate Median Absolute Deviation
   * @param values - Numeric values
   * @param median - Median value
   * @returns MAD
   *
   * O(n log n) time complexity due to sorting
   */
  private calculateMAD(values: number[], median: number): number {
    const absoluteDeviations = values.map(v => Math.abs(v - median)).sort((a, b) => a - b);
    const n = absoluteDeviations.length;
    return n % 2 === 0
      ? (absoluteDeviations[n / 2 - 1] + absoluteDeviations[n / 2]) / 2
      : absoluteDeviations[Math.floor(n / 2)];
  }

  /**
   * Calculate entropy of probability distribution
   * @param probabilities - Probability distribution
   * @returns Entropy
   *
   * O(n) time complexity where n = number of unique values
   */
  private calculateEntropy(probabilities: Map<string | number, number>): number {
    let entropy = 0;
    for (const prob of probabilities.values()) {
      if (prob > 0) {
        entropy -= prob * Math.log2(prob);
      }
    }
    return entropy;
  }

  /**
   * Calculate confidence interval for proportion
   * @param proportion - Observed proportion
   * @param n - Sample size
   * @returns Lower and upper bounds
   *
   * O(1) time complexity
   */
  private calculateConfidenceInterval(
    proportion: number,
    n: number
  ): { lower: number; upper: number } {
    const z = this.getZScore(this.config.confidenceLevel);
    const se = Math.sqrt((proportion * (1 - proportion)) / n);

    return {
      lower: Math.max(0, proportion - z * se),
      upper: Math.min(1, proportion + z * se),
    };
  }

  /**
   * Calculate prediction interval for regression
   * @param mean - Predicted mean
   * @param stdDev - Standard deviation
   * @param n - Sample size
   * @returns Lower and upper bounds
   *
   * O(1) time complexity
   */
  private calculatePredictionInterval(
    mean: number,
    stdDev: number,
    n: number
  ): { lower: number; upper: number } {
    const z = this.getZScore(this.config.confidenceLevel);
    const margin = z * stdDev * Math.sqrt(1 + 1 / n);

    return {
      lower: mean - margin,
      upper: mean + margin,
    };
  }

  /**
   * Get Z-score for confidence level
   * @param confidence - Confidence level (0-1)
   * @returns Z-score
   *
   * O(1) time complexity
   */
  private getZScore(confidence: number): number {
    const levels: Record<number, number> = {
      0.90: 1.645,
      0.95: 1.96,
      0.99: 2.576,
    };
    const rounded = Math.round(confidence * 100) / 100;
    return levels[rounded] ?? 1.96;
  }

  /**
   * Get all model weights
   * @returns Map of model ID to weight
   *
   * O(n) time complexity
   */
  getWeights(): Map<string, number> {
    return new Map(this.modelWeights);
  }

  /**
   * Get performance metrics for all models
   * @returns Map of model ID to performance
   *
   * O(n) time complexity
   */
  getPerformanceMetrics(): Map<string, ModelPerformance> {
    return new Map(this.modelPerformance);
  }

  /**
   * Get model diversity score (how different are model predictions)
   * @returns Diversity score (0-1)
   *
   * O(n^2) time complexity where n = number of models
   */
  calculateDiversity(): number {
    const currentPreds = Array.from(this.getCurrentPredictions().values());

    if (currentPreds.length < 2) return 0;

    let totalDisagreement = 0;
    let pairs = 0;

    for (let i = 0; i < currentPreds.length; i++) {
      for (let j = i + 1; j < currentPreds.length; j++) {
        const p1 = currentPreds[i];
        const p2 = currentPreds[j];

        if (typeof p1.value === 'number' && typeof p2.value === 'number') {
          // Numeric disagreement
          const maxVal = Math.max(Math.abs(p1.value), Math.abs(p2.value), 1);
          totalDisagreement += Math.abs(p1.value - p2.value) / maxVal;
        } else {
          // Categorical disagreement
          totalDisagreement += p1.value !== p2.value ? 1 : 0;
        }
        pairs++;
      }
    }

    return pairs > 0 ? totalDisagreement / pairs : 0;
  }

  /**
   * Export state for persistence
   * @returns Serializable state
   *
   * O(n) time complexity
   */
  exportState(): {
    weights: Record<string, number>;
    performance: Record<string, ModelPerformance>;
    metaLearnerWeights: Record<string, number>;
    config: EnsembleConfig;
  } {
    const weights: Record<string, number> = {};
    for (const [id, w] of this.modelWeights) {
      weights[id] = w;
    }

    const performance: Record<string, ModelPerformance> = {};
    for (const [id, p] of this.modelPerformance) {
      performance[id] = { ...p };
    }

    const metaLearnerWeights: Record<string, number> = {};
    for (const [id, w] of this.metaLearnerWeights) {
      metaLearnerWeights[id] = w;
    }

    return {
      weights,
      performance,
      metaLearnerWeights,
      config: { ...this.config },
    };
  }

  /**
   * Import state from persistence
   * @param state - Serialized state
   *
   * O(n) time complexity
   */
  importState(state: {
    weights?: Record<string, number>;
    performance?: Record<string, ModelPerformance>;
    metaLearnerWeights?: Record<string, number>;
    config?: Partial<EnsembleConfig>;
  }): void {
    if (state.weights) {
      this.modelWeights.clear();
      for (const [id, w] of Object.entries(state.weights)) {
        this.modelWeights.set(id, w);
      }
    }

    if (state.performance) {
      this.modelPerformance.clear();
      for (const [id, p] of Object.entries(state.performance)) {
        this.modelPerformance.set(id, p);
      }
    }

    if (state.metaLearnerWeights) {
      this.metaLearnerWeights.clear();
      for (const [id, w] of Object.entries(state.metaLearnerWeights)) {
        this.metaLearnerWeights.set(id, w);
      }
    }

    if (state.config) {
      this.config = { ...this.config, ...state.config };
    }
  }

  /**
   * Reset the ensemble
   *
   * O(1) time complexity
   */
  reset(): void {
    this.modelWeights.clear();
    this.modelPerformance.clear();
    this.predictions.clear();
    this.stackingTrainingData = [];
    this.metaLearnerWeights.clear();
  }
}

// Factory function
export function createEnsembleModel(
  config?: Partial<EnsembleConfig>,
  seed?: number
): EnsembleModelService {
  return new EnsembleModelService(config, seed);
}

// Default singleton
export const ensembleModelService = new EnsembleModelService();
