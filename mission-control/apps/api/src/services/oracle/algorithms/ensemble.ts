/**
 * Ensemble Prediction Model
 * Story alg-7 - Combine multiple models for robust predictions
 *
 * Implements ensemble methods including weighted voting, stacking meta-learner,
 * and automatic calibration based on historical accuracy.
 */

/**
 * Prediction from a single model
 */
export interface ModelPrediction {
  /** Predicted value */
  value: number;
  /** Prediction confidence (0-1) */
  confidence: number;
  /** Optional probability distribution over classes */
  probabilities?: number[];
  /** Model-specific metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Model types supported by the ensemble
 */
export type ModelType = 'bayesian' | 'ml' | 'heuristic' | 'statistical' | 'rule-based';

/**
 * Model registration interface
 */
export interface EnsembleModelEntry {
  /** Unique model identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Model type category */
  type: ModelType;
  /** Model weight in ensemble (0-1) */
  weight: number;
  /** Prediction function */
  predict: (input: unknown) => ModelPrediction;
  /** Whether model is currently active */
  active: boolean;
  /** Model metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Performance tracking for a model
 */
export interface ModelPerformance {
  /** Model ID */
  modelId: string;
  /** Total predictions made */
  totalPredictions: number;
  /** Correct predictions (for classification) */
  correctPredictions: number;
  /** Mean absolute error (for regression) */
  meanAbsoluteError: number;
  /** Mean squared error (for regression) */
  meanSquaredError: number;
  /** Calibration score (how well confidence matches accuracy) */
  calibrationScore: number;
  /** Recent accuracy (last n predictions) */
  recentAccuracy: number;
  /** Accuracy history */
  accuracyHistory: number[];
}

/**
 * Ensemble prediction result
 */
export interface EnsemblePrediction {
  /** Combined predicted value */
  value: number;
  /** Overall confidence */
  confidence: number;
  /** Uncertainty quantification (variance of predictions) */
  uncertainty: number;
  /** Individual model predictions */
  modelPredictions: Map<string, ModelPrediction>;
  /** Weights used for combination */
  weightsUsed: Map<string, number>;
  /** Prediction method used */
  method: 'weighted-voting' | 'stacking' | 'bayesian-averaging';
  /** Ensemble agreement score (0-1) */
  agreement: number;
}

/**
 * Stacking meta-learner configuration
 */
export interface StackingConfig {
  /** Number of cross-validation folds */
  cvFolds: number;
  /** Meta-learner type */
  metaLearner: 'linear' | 'ridge' | 'neural';
  /** Regularization strength (for ridge) */
  regularization: number;
  /** Learning rate (for neural) */
  learningRate: number;
}

/**
 * Ensemble configuration
 */
export interface EnsembleConfig {
  /** Method for combining predictions */
  combinationMethod: 'weighted-voting' | 'stacking' | 'bayesian-averaging';
  /** Auto-calibrate weights based on performance */
  autoCalibrate: boolean;
  /** Minimum weight for any model */
  minWeight: number;
  /** Maximum weight for any model */
  maxWeight: number;
  /** Window size for recent performance calculation */
  performanceWindow: number;
  /** Calibration learning rate */
  calibrationRate: number;
  /** Stacking configuration (if using stacking) */
  stackingConfig?: StackingConfig;
  /** Diversity bonus (encourage diverse predictions) */
  diversityBonus: number;
}

/**
 * Training example for calibration
 */
export interface TrainingExample {
  /** Input data */
  input: unknown;
  /** Actual outcome */
  actual: number;
  /** Timestamp */
  timestamp: number;
  /** Model predictions at this time */
  predictions: Map<string, ModelPrediction>;
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
 * Ensemble Prediction Model
 *
 * Combines multiple models using weighted voting, stacking, or Bayesian
 * model averaging for more robust predictions with uncertainty quantification.
 */
export class EnsembleModel {
  private config: EnsembleConfig;
  private models: Map<string, EnsembleModelEntry> = new Map();
  private performance: Map<string, ModelPerformance> = new Map();
  private trainingHistory: TrainingExample[] = [];
  private stackingWeights: number[] = [];
  private random: () => number;

  /**
   * Creates a new Ensemble model
   * @param config - Configuration options
   * @param seed - Random seed for reproducibility
   */
  constructor(config: Partial<EnsembleConfig> = {}, seed?: number) {
    this.config = {
      combinationMethod: config.combinationMethod ?? 'weighted-voting',
      autoCalibrate: config.autoCalibrate ?? true,
      minWeight: config.minWeight ?? 0.01,
      maxWeight: config.maxWeight ?? 0.5,
      performanceWindow: config.performanceWindow ?? 100,
      calibrationRate: config.calibrationRate ?? 0.1,
      stackingConfig: config.stackingConfig ?? {
        cvFolds: 5,
        metaLearner: 'ridge',
        regularization: 0.1,
        learningRate: 0.01,
      },
      diversityBonus: config.diversityBonus ?? 0.1,
    };
    this.random = createRandom(seed);
  }

  /**
   * Register a model in the ensemble
   * @param model - Model to register
   *
   * O(1) time complexity
   */
  registerModel(model: EnsembleModelEntry): void {
    this.models.set(model.id, model);

    // Initialize performance tracking
    this.performance.set(model.id, {
      modelId: model.id,
      totalPredictions: 0,
      correctPredictions: 0,
      meanAbsoluteError: 0,
      meanSquaredError: 0,
      calibrationScore: 1,
      recentAccuracy: 0.5,
      accuracyHistory: [],
    });
  }

  /**
   * Register multiple models
   * @param models - Models to register
   *
   * O(n) time complexity where n = number of models
   */
  registerModels(models: EnsembleModelEntry[]): void {
    for (const model of models) {
      this.registerModel(model);
    }
  }

  /**
   * Get a registered model
   * @param modelId - Model identifier
   * @returns Model or undefined
   *
   * O(1) time complexity
   */
  getModel(modelId: string): EnsembleModelEntry | undefined {
    return this.models.get(modelId);
  }

  /**
   * Get all registered models
   * @returns Array of models
   *
   * O(n) time complexity where n = number of models
   */
  getAllModels(): EnsembleModelEntry[] {
    return Array.from(this.models.values());
  }

  /**
   * Enable or disable a model
   * @param modelId - Model identifier
   * @param active - Whether to activate
   *
   * O(1) time complexity
   */
  setModelActive(modelId: string, active: boolean): void {
    const model = this.models.get(modelId);
    if (model) {
      model.active = active;
    }
  }

  /**
   * Get model performance
   * @param modelId - Model identifier
   * @returns Performance metrics
   *
   * O(1) time complexity
   */
  getModelPerformance(modelId: string): ModelPerformance | undefined {
    return this.performance.get(modelId);
  }

  /**
   * Get all model performances
   * @returns Map of model ID to performance
   *
   * O(1) time complexity
   */
  getAllPerformances(): Map<string, ModelPerformance> {
    return new Map(this.performance);
  }

  /**
   * Make ensemble prediction using weighted voting
   * @param input - Input data
   * @returns Ensemble prediction
   *
   * O(n) time complexity where n = number of models
   */
  private weightedVotingPredict(input: unknown): EnsemblePrediction {
    const modelPredictions = new Map<string, ModelPrediction>();
    const weightsUsed = new Map<string, number>();

    // Collect predictions from active models
    let totalWeight = 0;
    const predictions: Array<{ value: number; weight: number; confidence: number }> = [];

    for (const model of this.models.values()) {
      if (!model.active) continue;

      try {
        const prediction = model.predict(input);
        modelPredictions.set(model.id, prediction);

        // Adjust weight by confidence
        const effectiveWeight = model.weight * prediction.confidence;
        weightsUsed.set(model.id, effectiveWeight);
        totalWeight += effectiveWeight;

        predictions.push({
          value: prediction.value,
          weight: effectiveWeight,
          confidence: prediction.confidence,
        });
      } catch {
        // Model failed - skip it
        console.warn(`Model ${model.id} failed to predict`);
      }
    }

    if (predictions.length === 0) {
      return {
        value: 0,
        confidence: 0,
        uncertainty: 1,
        modelPredictions,
        weightsUsed,
        method: 'weighted-voting',
        agreement: 0,
      };
    }

    // Calculate weighted average
    let weightedSum = 0;
    for (const p of predictions) {
      weightedSum += p.value * (p.weight / totalWeight);
    }

    // Calculate variance (uncertainty)
    let variance = 0;
    for (const p of predictions) {
      variance += (p.weight / totalWeight) * Math.pow(p.value - weightedSum, 2);
    }

    // Calculate agreement (1 - coefficient of variation)
    const stdDev = Math.sqrt(variance);
    const agreement = weightedSum !== 0 ?
      Math.max(0, 1 - Math.abs(stdDev / weightedSum)) : 0;

    // Calculate overall confidence
    const avgConfidence = predictions.reduce((sum, p) =>
      sum + p.confidence * (p.weight / totalWeight), 0);

    return {
      value: weightedSum,
      confidence: avgConfidence * agreement,
      uncertainty: variance,
      modelPredictions,
      weightsUsed,
      method: 'weighted-voting',
      agreement,
    };
  }

  /**
   * Make ensemble prediction using stacking
   * @param input - Input data
   * @returns Ensemble prediction
   *
   * O(n) time complexity where n = number of models
   */
  private stackingPredict(input: unknown): EnsemblePrediction {
    const modelPredictions = new Map<string, ModelPrediction>();
    const weightsUsed = new Map<string, number>();

    // Collect base model predictions
    const baseValues: number[] = [];

    for (const model of this.models.values()) {
      if (!model.active) continue;

      try {
        const prediction = model.predict(input);
        modelPredictions.set(model.id, prediction);
        baseValues.push(prediction.value);
      } catch {
        baseValues.push(0); // Default value on failure
      }
    }

    // Apply meta-learner
    let finalValue: number;

    if (this.stackingWeights.length === baseValues.length && baseValues.length > 0) {
      // Use trained stacking weights
      finalValue = 0;
      for (let i = 0; i < baseValues.length; i++) {
        finalValue += baseValues[i] * this.stackingWeights[i];
        weightsUsed.set(Array.from(this.models.keys())[i], this.stackingWeights[i]);
      }
    } else {
      // Fall back to equal weights
      finalValue = baseValues.length > 0 ?
        baseValues.reduce((a, b) => a + b, 0) / baseValues.length : 0;
    }

    // Calculate variance
    const mean = baseValues.length > 0 ?
      baseValues.reduce((a, b) => a + b, 0) / baseValues.length : 0;
    const variance = baseValues.length > 0 ?
      baseValues.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / baseValues.length : 1;

    // Calculate agreement
    const stdDev = Math.sqrt(variance);
    const agreement = mean !== 0 ? Math.max(0, 1 - Math.abs(stdDev / mean)) : 0;

    return {
      value: finalValue,
      confidence: agreement,
      uncertainty: variance,
      modelPredictions,
      weightsUsed,
      method: 'stacking',
      agreement,
    };
  }

  /**
   * Make ensemble prediction using Bayesian model averaging
   * @param input - Input data
   * @returns Ensemble prediction
   *
   * O(n) time complexity where n = number of models
   */
  private bayesianAveragingPredict(input: unknown): EnsemblePrediction {
    const modelPredictions = new Map<string, ModelPrediction>();
    const weightsUsed = new Map<string, number>();

    // Calculate model weights based on historical performance
    const posteriorWeights = new Map<string, number>();
    let totalPosterior = 0;

    for (const model of this.models.values()) {
      if (!model.active) continue;

      const perf = this.performance.get(model.id);
      if (!perf) continue;

      // Prior based on model weight
      const prior = model.weight;

      // Likelihood based on recent accuracy
      const likelihood = perf.recentAccuracy + 0.01; // Add small constant to avoid zero

      // Posterior (unnormalized)
      const posterior = prior * likelihood * perf.calibrationScore;
      posteriorWeights.set(model.id, posterior);
      totalPosterior += posterior;
    }

    // Normalize and collect predictions
    const predictions: Array<{ value: number; weight: number }> = [];

    for (const model of this.models.values()) {
      if (!model.active) continue;

      try {
        const prediction = model.predict(input);
        modelPredictions.set(model.id, prediction);

        const posterior = posteriorWeights.get(model.id) ?? 0;
        const normalizedWeight = totalPosterior > 0 ? posterior / totalPosterior : 0;
        weightsUsed.set(model.id, normalizedWeight);

        predictions.push({
          value: prediction.value,
          weight: normalizedWeight,
        });
      } catch {
        // Skip failed models
      }
    }

    // Calculate weighted prediction
    let weightedSum = 0;
    for (const p of predictions) {
      weightedSum += p.value * p.weight;
    }

    // Calculate variance (Bayesian model uncertainty)
    let variance = 0;
    for (const p of predictions) {
      variance += p.weight * Math.pow(p.value - weightedSum, 2);
    }

    // Add within-model uncertainty
    for (const [modelId, pred] of modelPredictions) {
      const weight = weightsUsed.get(modelId) ?? 0;
      const modelVariance = (1 - pred.confidence) * Math.pow(pred.value, 2);
      variance += weight * modelVariance;
    }

    // Calculate agreement
    const stdDev = Math.sqrt(variance);
    const agreement = weightedSum !== 0 ?
      Math.max(0, 1 - Math.abs(stdDev / weightedSum)) : 0;

    return {
      value: weightedSum,
      confidence: agreement,
      uncertainty: variance,
      modelPredictions,
      weightsUsed,
      method: 'bayesian-averaging',
      agreement,
    };
  }

  /**
   * Make ensemble prediction
   * @param input - Input data
   * @returns Ensemble prediction
   *
   * O(n) time complexity where n = number of models
   */
  predict(input: unknown): EnsemblePrediction {
    switch (this.config.combinationMethod) {
      case 'stacking':
        return this.stackingPredict(input);
      case 'bayesian-averaging':
        return this.bayesianAveragingPredict(input);
      case 'weighted-voting':
      default:
        return this.weightedVotingPredict(input);
    }
  }

  /**
   * Record actual outcome for calibration
   * @param input - Original input
   * @param actual - Actual outcome
   * @param predictions - Predictions made at the time
   *
   * O(n) time complexity where n = number of models
   */
  recordOutcome(input: unknown, actual: number, predictions?: EnsemblePrediction): void {
    // Get predictions if not provided
    const preds = predictions ?? this.predict(input);

    // Store training example
    this.trainingHistory.push({
      input,
      actual,
      timestamp: Date.now(),
      predictions: preds.modelPredictions,
    });

    // Maintain history window
    while (this.trainingHistory.length > this.config.performanceWindow * 10) {
      this.trainingHistory.shift();
    }

    // Update model performances
    for (const [modelId, prediction] of preds.modelPredictions) {
      this.updateModelPerformance(modelId, prediction, actual);
    }

    // Auto-calibrate if enabled
    if (this.config.autoCalibrate) {
      this.calibrateWeights();
    }
  }

  /**
   * Update performance metrics for a model
   * @param modelId - Model identifier
   * @param prediction - Model's prediction
   * @param actual - Actual outcome
   *
   * O(1) time complexity
   */
  private updateModelPerformance(
    modelId: string,
    prediction: ModelPrediction,
    actual: number
  ): void {
    const perf = this.performance.get(modelId);
    if (!perf) return;

    perf.totalPredictions++;

    // Update error metrics (exponential moving average)
    const error = Math.abs(prediction.value - actual);
    const squaredError = error * error;
    const alpha = 0.1;

    perf.meanAbsoluteError = perf.meanAbsoluteError * (1 - alpha) + error * alpha;
    perf.meanSquaredError = perf.meanSquaredError * (1 - alpha) + squaredError * alpha;

    // Update accuracy (for binary/categorical)
    const threshold = 0.5;
    const correct = error < threshold ? 1 : 0;
    perf.correctPredictions += correct;

    // Update recent accuracy
    perf.accuracyHistory.push(correct);
    if (perf.accuracyHistory.length > this.config.performanceWindow) {
      perf.accuracyHistory.shift();
    }
    perf.recentAccuracy = perf.accuracyHistory.length > 0 ?
      perf.accuracyHistory.reduce((a, b) => a + b, 0) / perf.accuracyHistory.length : 0.5;

    // Update calibration score (how well confidence matches accuracy)
    const expectedAccuracy = prediction.confidence;
    const actualAccuracy = correct;
    const calibrationError = Math.abs(expectedAccuracy - actualAccuracy);
    perf.calibrationScore = perf.calibrationScore * (1 - alpha) +
      (1 - calibrationError) * alpha;
  }

  /**
   * Calibrate model weights based on performance
   *
   * O(n) time complexity where n = number of models
   */
  private calibrateWeights(): void {
    // Calculate performance scores
    const scores = new Map<string, number>();
    let totalScore = 0;

    for (const [modelId, perf] of this.performance) {
      const model = this.models.get(modelId);
      if (!model || !model.active) continue;

      // Score based on accuracy, calibration, and diversity
      const accuracyScore = perf.recentAccuracy;
      const calibrationScore = perf.calibrationScore;

      // Calculate diversity (how different this model is from others)
      let diversityScore = 0;
      if (this.trainingHistory.length > 0) {
        const recentHistory = this.trainingHistory.slice(-10);
        for (const example of recentHistory) {
          const thisPred = example.predictions.get(modelId);
          if (!thisPred) continue;

          for (const [otherId, otherPred] of example.predictions) {
            if (otherId === modelId) continue;
            diversityScore += Math.abs(thisPred.value - otherPred.value);
          }
        }
        diversityScore /= Math.max(1, recentHistory.length * (this.models.size - 1));
      }

      const score = accuracyScore * 0.6 +
                   calibrationScore * 0.3 +
                   diversityScore * this.config.diversityBonus;

      scores.set(modelId, score);
      totalScore += score;
    }

    // Update weights
    for (const [modelId, score] of scores) {
      const model = this.models.get(modelId);
      if (!model) continue;

      const targetWeight = totalScore > 0 ? score / totalScore : 1 / this.models.size;

      // Smooth weight update
      const newWeight = model.weight * (1 - this.config.calibrationRate) +
                       targetWeight * this.config.calibrationRate;

      // Clamp to bounds
      model.weight = Math.max(this.config.minWeight,
                              Math.min(this.config.maxWeight, newWeight));
    }

    // Renormalize weights
    let totalWeight = 0;
    for (const model of this.models.values()) {
      if (model.active) totalWeight += model.weight;
    }

    if (totalWeight > 0) {
      for (const model of this.models.values()) {
        if (model.active) model.weight /= totalWeight;
      }
    }
  }

  /**
   * Train stacking meta-learner
   * @param trainingData - Training examples
   *
   * O(n * m * k) time complexity where n = examples, m = models, k = iterations
   */
  trainStackingMetaLearner(trainingData?: TrainingExample[]): void {
    const data = trainingData ?? this.trainingHistory;
    if (data.length < 10) return;

    const numModels = this.models.size;
    const modelIds = Array.from(this.models.keys());

    // Prepare features and targets
    const features: number[][] = [];
    const targets: number[] = [];

    for (const example of data) {
      const row: number[] = [];
      for (const modelId of modelIds) {
        const pred = example.predictions.get(modelId);
        row.push(pred?.value ?? 0);
      }
      features.push(row);
      targets.push(example.actual);
    }

    // Train based on meta-learner type
    const stackConfig = this.config.stackingConfig!;

    switch (stackConfig.metaLearner) {
      case 'linear':
        this.stackingWeights = this.trainLinearWeights(features, targets);
        break;
      case 'ridge':
        this.stackingWeights = this.trainRidgeWeights(
          features, targets, stackConfig.regularization
        );
        break;
      case 'neural':
        this.stackingWeights = this.trainNeuralWeights(
          features, targets, stackConfig.learningRate
        );
        break;
    }
  }

  /**
   * Train linear regression weights
   * @param features - Feature matrix
   * @param targets - Target values
   * @returns Weights
   *
   * O(n * m^2) time complexity using normal equations
   */
  private trainLinearWeights(features: number[][], targets: number[]): number[] {
    const n = features.length;
    const m = features[0]?.length ?? 0;

    if (n === 0 || m === 0) return new Array(m).fill(1 / m);

    // Simple gradient descent for linear regression
    const weights = new Array(m).fill(1 / m);
    const learningRate = 0.01;
    const iterations = 100;

    for (let iter = 0; iter < iterations; iter++) {
      const gradients = new Array(m).fill(0);

      for (let i = 0; i < n; i++) {
        let predicted = 0;
        for (let j = 0; j < m; j++) {
          predicted += weights[j] * features[i][j];
        }

        const error = predicted - targets[i];

        for (let j = 0; j < m; j++) {
          gradients[j] += error * features[i][j];
        }
      }

      // Update weights
      for (let j = 0; j < m; j++) {
        weights[j] -= learningRate * gradients[j] / n;
      }
    }

    return weights;
  }

  /**
   * Train ridge regression weights
   * @param features - Feature matrix
   * @param targets - Target values
   * @param lambda - Regularization strength
   * @returns Weights
   *
   * O(n * m^2 + iterations) time complexity
   */
  private trainRidgeWeights(
    features: number[][],
    targets: number[],
    lambda: number
  ): number[] {
    const n = features.length;
    const m = features[0]?.length ?? 0;

    if (n === 0 || m === 0) return new Array(m).fill(1 / m);

    // Gradient descent with L2 regularization
    const weights = new Array(m).fill(1 / m);
    const learningRate = 0.01;
    const iterations = 100;

    for (let iter = 0; iter < iterations; iter++) {
      const gradients = new Array(m).fill(0);

      for (let i = 0; i < n; i++) {
        let predicted = 0;
        for (let j = 0; j < m; j++) {
          predicted += weights[j] * features[i][j];
        }

        const error = predicted - targets[i];

        for (let j = 0; j < m; j++) {
          gradients[j] += error * features[i][j];
        }
      }

      // Update weights with regularization
      for (let j = 0; j < m; j++) {
        gradients[j] = gradients[j] / n + lambda * weights[j];
        weights[j] -= learningRate * gradients[j];
      }
    }

    return weights;
  }

  /**
   * Train simple neural network weights
   * @param features - Feature matrix
   * @param targets - Target values
   * @param learningRate - Learning rate
   * @returns Weights
   *
   * O(n * m * iterations) time complexity
   */
  private trainNeuralWeights(
    features: number[][],
    targets: number[],
    learningRate: number
  ): number[] {
    const n = features.length;
    const m = features[0]?.length ?? 0;

    if (n === 0 || m === 0) return new Array(m).fill(1 / m);

    // Single layer neural network (essentially softmax regression)
    const weights = new Array(m).fill(0).map(() => this.random() * 0.1);
    const iterations = 200;

    for (let iter = 0; iter < iterations; iter++) {
      // Shuffle data
      const indices = Array.from({ length: n }, (_, i) => i);
      for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(this.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
      }

      for (const idx of indices) {
        // Forward pass
        let predicted = 0;
        for (let j = 0; j < m; j++) {
          predicted += weights[j] * features[idx][j];
        }

        // Apply non-linearity (tanh)
        const activated = Math.tanh(predicted);

        // Backward pass
        const error = activated - targets[idx];
        const derivative = 1 - activated * activated; // tanh derivative

        for (let j = 0; j < m; j++) {
          weights[j] -= learningRate * error * derivative * features[idx][j];
        }
      }
    }

    // Normalize to sum to 1
    const sum = weights.reduce((a, b) => a + Math.abs(b), 0);
    return weights.map(w => Math.abs(w) / (sum + 1e-10));
  }

  /**
   * Get uncertainty quantification for a prediction
   * @param prediction - Ensemble prediction
   * @returns Uncertainty metrics
   *
   * O(n) time complexity where n = number of models
   */
  getUncertaintyMetrics(prediction: EnsemblePrediction): {
    epistemic: number;  // Model uncertainty
    aleatoric: number;  // Data uncertainty
    total: number;      // Total uncertainty
    confidenceInterval: { lower: number; upper: number };
  } {
    const values = Array.from(prediction.modelPredictions.values()).map(p => p.value);
    const confidences = Array.from(prediction.modelPredictions.values()).map(p => p.confidence);

    if (values.length === 0) {
      return {
        epistemic: 1,
        aleatoric: 1,
        total: 1,
        confidenceInterval: { lower: 0, upper: 0 },
      };
    }

    // Epistemic uncertainty (disagreement between models)
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const epistemic = values.reduce((sum, v) =>
      sum + Math.pow(v - mean, 2), 0) / values.length;

    // Aleatoric uncertainty (average within-model uncertainty)
    const aleatoric = confidences.reduce((sum, c) =>
      sum + (1 - c), 0) / confidences.length;

    // Total uncertainty
    const total = Math.sqrt(epistemic + aleatoric * aleatoric);

    // Confidence interval (approximate 95%)
    const stdDev = Math.sqrt(prediction.uncertainty);
    const z = 1.96;

    return {
      epistemic,
      aleatoric,
      total,
      confidenceInterval: {
        lower: prediction.value - z * stdDev,
        upper: prediction.value + z * stdDev,
      },
    };
  }

  /**
   * Get model rankings by performance
   * @returns Sorted array of model IDs with scores
   *
   * O(n log n) time complexity where n = number of models
   */
  getModelRankings(): Array<{ modelId: string; score: number; metrics: ModelPerformance }> {
    const rankings: Array<{ modelId: string; score: number; metrics: ModelPerformance }> = [];

    for (const [modelId, perf] of this.performance) {
      const model = this.models.get(modelId);
      if (!model) continue;

      const score = perf.recentAccuracy * 0.5 +
                   perf.calibrationScore * 0.3 +
                   (1 - perf.meanAbsoluteError) * 0.2;

      rankings.push({ modelId, score, metrics: perf });
    }

    rankings.sort((a, b) => b.score - a.score);
    return rankings;
  }

  /**
   * Export state for persistence
   * @returns Serializable state
   *
   * O(n + h) time complexity where n = models, h = history
   */
  exportState(): {
    config: EnsembleConfig;
    models: Array<{ id: string; weight: number; active: boolean }>;
    performance: Array<[string, ModelPerformance]>;
    stackingWeights: number[];
  } {
    const models = Array.from(this.models.values()).map(m => ({
      id: m.id,
      weight: m.weight,
      active: m.active,
    }));

    return {
      config: { ...this.config },
      models,
      performance: Array.from(this.performance.entries()),
      stackingWeights: [...this.stackingWeights],
    };
  }

  /**
   * Import state from persistence
   * @param state - Serialized state
   *
   * O(n + h) time complexity
   */
  importState(state: {
    config?: Partial<EnsembleConfig>;
    models?: Array<{ id: string; weight: number; active: boolean }>;
    performance?: Array<[string, ModelPerformance]>;
    stackingWeights?: number[];
  }): void {
    if (state.config) {
      this.config = { ...this.config, ...state.config };
    }

    if (state.models) {
      for (const modelState of state.models) {
        const model = this.models.get(modelState.id);
        if (model) {
          model.weight = modelState.weight;
          model.active = modelState.active;
        }
      }
    }

    if (state.performance) {
      for (const [modelId, perf] of state.performance) {
        this.performance.set(modelId, perf);
      }
    }

    if (state.stackingWeights) {
      this.stackingWeights = [...state.stackingWeights];
    }
  }

  /**
   * Reset ensemble state
   *
   * O(n) time complexity where n = number of models
   */
  reset(): void {
    for (const model of this.models.values()) {
      model.weight = 1 / this.models.size;
    }

    for (const perf of this.performance.values()) {
      perf.totalPredictions = 0;
      perf.correctPredictions = 0;
      perf.meanAbsoluteError = 0;
      perf.meanSquaredError = 0;
      perf.calibrationScore = 1;
      perf.recentAccuracy = 0.5;
      perf.accuracyHistory = [];
    }

    this.trainingHistory = [];
    this.stackingWeights = [];
  }
}

// Factory function
export function createEnsembleModel(
  config?: Partial<EnsembleConfig>,
  seed?: number
): EnsembleModel {
  return new EnsembleModel(config, seed);
}

// Default singleton
export const ensembleModel = new EnsembleModel();
