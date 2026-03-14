/**
 * Attention-Based Signal Prioritizer
 * Story alg-8 - Transformer attention for dynamic signal weighting
 *
 * Implements multi-head self-attention mechanism for prioritizing signals
 * based on context including user history, time, and goals.
 */

/**
 * Represents a signal to be prioritized
 */
export interface Signal {
  /** Unique signal identifier */
  id: string;
  /** Signal type/category */
  type: string;
  /** Raw signal content */
  content: unknown;
  /** Feature vector for attention */
  embedding: number[];
  /** Original priority (if any) */
  basePriority?: number;
  /** Signal timestamp */
  timestamp: number;
  /** Signal metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Context for attention computation
 */
export interface AttentionContext {
  /** User history embeddings */
  userHistory: number[][];
  /** Current time features (hour, day, etc.) */
  timeFeatures: number[];
  /** User goals embeddings */
  goalEmbeddings: number[][];
  /** Current focus/attention state */
  focusState?: number[];
  /** Context metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Single attention head output
 */
export interface AttentionHeadOutput {
  /** Attention weights (queries x keys) */
  weights: number[][];
  /** Output values */
  output: number[][];
  /** Head-specific learned patterns */
  patterns?: string[];
}

/**
 * Multi-head attention output
 */
export interface MultiHeadAttentionOutput {
  /** Combined output after all heads */
  output: number[][];
  /** Individual head outputs */
  headOutputs: AttentionHeadOutput[];
  /** Attention weights from each head */
  attentionWeights: number[][][];
  /** Visualization data */
  visualizationData: AttentionVisualization;
}

/**
 * Attention visualization data
 */
export interface AttentionVisualization {
  /** Labels for query items */
  queryLabels: string[];
  /** Labels for key items */
  keyLabels: string[];
  /** Aggregated attention weights (averaged across heads) */
  aggregatedWeights: number[][];
  /** Most attended items per query */
  topAttendedItems: Array<{ query: string; attended: string[]; weights: number[] }>;
  /** Attention entropy per query (measure of focus) */
  entropyPerQuery: number[];
}

/**
 * Priority score for a signal
 */
export interface PriorityScore {
  /** Signal ID */
  signalId: string;
  /** Computed priority score (0-1) */
  score: number;
  /** Base priority contribution */
  basePriorityContribution: number;
  /** Attention-based contribution */
  attentionContribution: number;
  /** Context relevance score */
  contextRelevance: number;
  /** Explanation of why this priority was assigned */
  explanation: string[];
  /** Contributing factors */
  factors: Array<{ factor: string; weight: number }>;
}

/**
 * Configuration for attention mechanism
 */
export interface AttentionConfig {
  /** Embedding dimension */
  embeddingDim: number;
  /** Number of attention heads */
  numHeads: number;
  /** Head dimension (embeddingDim / numHeads) */
  headDim: number;
  /** Dropout rate during training */
  dropoutRate: number;
  /** Temperature for softmax */
  temperature: number;
  /** Whether to use positional encoding */
  usePositionalEncoding: boolean;
  /** Maximum sequence length for positional encoding */
  maxSeqLength: number;
  /** Weight for base priority in final score */
  basePriorityWeight: number;
  /** Weight for attention score in final score */
  attentionWeight: number;
}

/**
 * Learned attention parameters
 */
export interface AttentionParameters {
  /** Query projection weights per head: [numHeads][embeddingDim][headDim] */
  queryWeights: number[][][];
  /** Key projection weights per head */
  keyWeights: number[][][];
  /** Value projection weights per head */
  valueWeights: number[][][];
  /** Output projection weights */
  outputWeights: number[][];
  /** Output bias */
  outputBias: number[];
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
 * Attention-Based Signal Prioritizer
 *
 * Implements scaled dot-product attention with multi-head mechanism
 * for prioritizing signals based on contextual relevance.
 */
export class AttentionPrioritizer {
  private config: AttentionConfig;
  private params: AttentionParameters;
  private random: () => number;
  private positionalEncoding: number[][] | null = null;

  /**
   * Creates a new Attention prioritizer
   * @param config - Configuration options
   * @param seed - Random seed for reproducibility
   */
  constructor(config: Partial<AttentionConfig> = {}, seed?: number) {
    const embeddingDim = config.embeddingDim ?? 64;
    const numHeads = config.numHeads ?? 4;

    this.config = {
      embeddingDim,
      numHeads,
      headDim: Math.floor(embeddingDim / numHeads),
      dropoutRate: config.dropoutRate ?? 0.1,
      temperature: config.temperature ?? 1.0,
      usePositionalEncoding: config.usePositionalEncoding ?? true,
      maxSeqLength: config.maxSeqLength ?? 512,
      basePriorityWeight: config.basePriorityWeight ?? 0.3,
      attentionWeight: config.attentionWeight ?? 0.7,
    };

    this.random = createRandom(seed);
    this.params = this.initializeParameters();

    if (this.config.usePositionalEncoding) {
      this.positionalEncoding = this.generatePositionalEncoding();
    }
  }

  /**
   * Initialize attention parameters with Xavier initialization
   * @returns Initialized parameters
   *
   * O(numHeads * embeddingDim * headDim) time complexity
   */
  private initializeParameters(): AttentionParameters {
    const { embeddingDim, numHeads, headDim } = this.config;

    // Xavier initialization scale
    const scale = Math.sqrt(2 / (embeddingDim + headDim));

    const initMatrix = (rows: number, cols: number): number[][] => {
      const matrix: number[][] = [];
      for (let i = 0; i < rows; i++) {
        matrix[i] = [];
        for (let j = 0; j < cols; j++) {
          // Box-Muller for normal distribution
          const u1 = this.random();
          const u2 = this.random();
          const normal = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
          matrix[i][j] = normal * scale;
        }
      }
      return matrix;
    };

    // Initialize per-head weights
    const queryWeights: number[][][] = [];
    const keyWeights: number[][][] = [];
    const valueWeights: number[][][] = [];

    for (let h = 0; h < numHeads; h++) {
      queryWeights.push(initMatrix(embeddingDim, headDim));
      keyWeights.push(initMatrix(embeddingDim, headDim));
      valueWeights.push(initMatrix(embeddingDim, headDim));
    }

    return {
      queryWeights,
      keyWeights,
      valueWeights,
      outputWeights: initMatrix(numHeads * headDim, embeddingDim),
      outputBias: new Array(embeddingDim).fill(0),
    };
  }

  /**
   * Generate sinusoidal positional encoding
   * @returns Positional encoding matrix
   *
   * O(maxSeqLength * embeddingDim) time complexity
   */
  private generatePositionalEncoding(): number[][] {
    const { maxSeqLength, embeddingDim } = this.config;
    const encoding: number[][] = [];

    for (let pos = 0; pos < maxSeqLength; pos++) {
      encoding[pos] = [];
      for (let i = 0; i < embeddingDim; i++) {
        const angle = pos / Math.pow(10000, (2 * Math.floor(i / 2)) / embeddingDim);
        encoding[pos][i] = i % 2 === 0 ? Math.sin(angle) : Math.cos(angle);
      }
    }

    return encoding;
  }

  /**
   * Matrix multiplication
   * @param a - First matrix
   * @param b - Second matrix
   * @returns Product matrix
   *
   * O(n * m * p) time complexity where dimensions are n x m and m x p
   */
  private matmul(a: number[][], b: number[][]): number[][] {
    const rows = a.length;
    const cols = b[0]?.length ?? 0;
    const inner = b.length;

    const result: number[][] = [];
    for (let i = 0; i < rows; i++) {
      result[i] = [];
      for (let j = 0; j < cols; j++) {
        let sum = 0;
        for (let k = 0; k < inner; k++) {
          sum += (a[i]?.[k] ?? 0) * (b[k]?.[j] ?? 0);
        }
        result[i][j] = sum;
      }
    }

    return result;
  }

  /**
   * Transpose a matrix
   * @param matrix - Input matrix
   * @returns Transposed matrix
   *
   * O(n * m) time complexity
   */
  private transpose(matrix: number[][]): number[][] {
    if (matrix.length === 0) return [];

    const rows = matrix.length;
    const cols = matrix[0].length;
    const result: number[][] = [];

    for (let j = 0; j < cols; j++) {
      result[j] = [];
      for (let i = 0; i < rows; i++) {
        result[j][i] = matrix[i][j];
      }
    }

    return result;
  }

  /**
   * Softmax function (row-wise)
   * @param matrix - Input matrix
   * @returns Softmax output
   *
   * O(n * m) time complexity
   */
  private softmax(matrix: number[][]): number[][] {
    return matrix.map(row => {
      const max = Math.max(...row);
      const exps = row.map(v => Math.exp((v - max) / this.config.temperature));
      const sum = exps.reduce((a, b) => a + b, 0);
      return exps.map(e => e / (sum + 1e-10));
    });
  }

  /**
   * Scaled dot-product attention
   *
   * Attention(Q, K, V) = softmax(QK^T / sqrt(d_k)) * V
   *
   * @param queries - Query matrix [seq_len, dim]
   * @param keys - Key matrix [seq_len, dim]
   * @param values - Value matrix [seq_len, dim]
   * @returns Attention output and weights
   *
   * O(seq_len^2 * dim) time complexity
   */
  private scaledDotProductAttention(
    queries: number[][],
    keys: number[][],
    values: number[][]
  ): { output: number[][]; weights: number[][] } {
    const dim = keys[0]?.length ?? 1;
    const scale = Math.sqrt(dim);

    // QK^T
    const scores = this.matmul(queries, this.transpose(keys));

    // Scale
    for (let i = 0; i < scores.length; i++) {
      for (let j = 0; j < (scores[i]?.length ?? 0); j++) {
        scores[i][j] /= scale;
      }
    }

    // Softmax
    const weights = this.softmax(scores);

    // Weighted values
    const output = this.matmul(weights, values);

    return { output, weights };
  }

  /**
   * Multi-head attention computation
   *
   * MultiHead(Q, K, V) = Concat(head_1, ..., head_h) * W_O
   * where head_i = Attention(Q * W_Q_i, K * W_K_i, V * W_V_i)
   *
   * @param embeddings - Input embeddings [seq_len, embedding_dim]
   * @param context - Optional context for cross-attention
   * @returns Multi-head attention output
   *
   * O(numHeads * seq_len^2 * headDim) time complexity
   */
  multiHeadAttention(
    embeddings: number[][],
    context?: number[][]
  ): MultiHeadAttentionOutput {
    const { numHeads, headDim } = this.config;
    const seqLen = embeddings.length;

    // Use context for keys/values if provided (cross-attention)
    const keyValueSource = context ?? embeddings;

    const headOutputs: AttentionHeadOutput[] = [];
    const allWeights: number[][][] = [];

    // Process each attention head
    for (let h = 0; h < numHeads; h++) {
      // Project to queries, keys, values
      const queries = this.matmul(embeddings, this.params.queryWeights[h]);
      const keys = this.matmul(keyValueSource, this.params.keyWeights[h]);
      const values = this.matmul(keyValueSource, this.params.valueWeights[h]);

      // Compute attention
      const { output, weights } = this.scaledDotProductAttention(queries, keys, values);

      headOutputs.push({ weights, output });
      allWeights.push(weights);
    }

    // Concatenate heads
    const concatenated: number[][] = [];
    for (let i = 0; i < seqLen; i++) {
      concatenated[i] = [];
      for (let h = 0; h < numHeads; h++) {
        for (let j = 0; j < headDim; j++) {
          concatenated[i].push(headOutputs[h].output[i]?.[j] ?? 0);
        }
      }
    }

    // Output projection
    const output = this.matmul(concatenated, this.params.outputWeights);

    // Add bias
    for (let i = 0; i < output.length; i++) {
      for (let j = 0; j < (output[i]?.length ?? 0); j++) {
        output[i][j] += this.params.outputBias[j];
      }
    }

    // Generate visualization data
    const visualizationData = this.generateVisualizationData(
      allWeights,
      embeddings.map((_, i) => `signal-${i}`),
      keyValueSource.map((_, i) => `context-${i}`)
    );

    return {
      output,
      headOutputs,
      attentionWeights: allWeights,
      visualizationData,
    };
  }

  /**
   * Generate visualization data from attention weights
   * @param weights - Attention weights from all heads
   * @param queryLabels - Labels for query items
   * @param keyLabels - Labels for key items
   * @returns Visualization data
   *
   * O(numHeads * queryLen * keyLen) time complexity
   */
  private generateVisualizationData(
    weights: number[][][],
    queryLabels: string[],
    keyLabels: string[]
  ): AttentionVisualization {
    const numHeads = weights.length;
    const queryLen = weights[0]?.length ?? 0;
    const keyLen = weights[0]?.[0]?.length ?? 0;

    // Aggregate weights across heads
    const aggregatedWeights: number[][] = [];
    for (let i = 0; i < queryLen; i++) {
      aggregatedWeights[i] = [];
      for (let j = 0; j < keyLen; j++) {
        let sum = 0;
        for (let h = 0; h < numHeads; h++) {
          sum += weights[h]?.[i]?.[j] ?? 0;
        }
        aggregatedWeights[i][j] = sum / numHeads;
      }
    }

    // Find top attended items per query
    const topAttendedItems: Array<{ query: string; attended: string[]; weights: number[] }> = [];
    for (let i = 0; i < queryLen; i++) {
      const indexed = aggregatedWeights[i].map((w, j) => ({ weight: w, index: j }));
      indexed.sort((a, b) => b.weight - a.weight);
      const top3 = indexed.slice(0, 3);

      topAttendedItems.push({
        query: queryLabels[i] ?? `query-${i}`,
        attended: top3.map(t => keyLabels[t.index] ?? `key-${t.index}`),
        weights: top3.map(t => t.weight),
      });
    }

    // Calculate entropy per query
    const entropyPerQuery: number[] = [];
    for (let i = 0; i < queryLen; i++) {
      let entropy = 0;
      for (let j = 0; j < keyLen; j++) {
        const p = aggregatedWeights[i][j];
        if (p > 0) {
          entropy -= p * Math.log(p);
        }
      }
      entropyPerQuery.push(entropy);
    }

    return {
      queryLabels,
      keyLabels,
      aggregatedWeights,
      topAttendedItems,
      entropyPerQuery,
    };
  }

  /**
   * Encode context into attention format
   * @param context - Raw context data
   * @returns Encoded context embeddings
   *
   * O(context_size * embedding_dim) time complexity
   */
  encodeContext(context: AttentionContext): number[][] {
    const { embeddingDim } = this.config;
    const encoded: number[][] = [];

    // Encode user history
    for (const historyItem of context.userHistory) {
      const padded = this.padOrTruncate(historyItem, embeddingDim);
      encoded.push(padded);
    }

    // Encode time features (expand to embedding dimension)
    const timeEmbedding = this.expandFeatures(context.timeFeatures, embeddingDim);
    encoded.push(timeEmbedding);

    // Encode goals
    for (const goal of context.goalEmbeddings) {
      const padded = this.padOrTruncate(goal, embeddingDim);
      encoded.push(padded);
    }

    // Encode focus state if present
    if (context.focusState) {
      const focusEmbedding = this.padOrTruncate(context.focusState, embeddingDim);
      encoded.push(focusEmbedding);
    }

    // Add positional encoding
    if (this.positionalEncoding) {
      for (let i = 0; i < encoded.length; i++) {
        for (let j = 0; j < embeddingDim; j++) {
          encoded[i][j] += this.positionalEncoding[i % this.config.maxSeqLength][j];
        }
      }
    }

    return encoded;
  }

  /**
   * Pad or truncate vector to target dimension
   * @param vector - Input vector
   * @param targetDim - Target dimension
   * @returns Padded/truncated vector
   *
   * O(targetDim) time complexity
   */
  private padOrTruncate(vector: number[], targetDim: number): number[] {
    if (vector.length >= targetDim) {
      return vector.slice(0, targetDim);
    }
    const padded = [...vector];
    while (padded.length < targetDim) {
      padded.push(0);
    }
    return padded;
  }

  /**
   * Expand features to higher dimension
   * @param features - Input features
   * @param targetDim - Target dimension
   * @returns Expanded features
   *
   * O(targetDim) time complexity
   */
  private expandFeatures(features: number[], targetDim: number): number[] {
    const expanded: number[] = [];
    const repeat = Math.ceil(targetDim / Math.max(1, features.length));

    for (let r = 0; r < repeat; r++) {
      for (const f of features) {
        if (expanded.length < targetDim) {
          expanded.push(f);
        }
      }
    }

    return expanded.slice(0, targetDim);
  }

  /**
   * Compute priority scores for signals
   * @param signals - Signals to prioritize
   * @param context - Context for attention
   * @returns Priority scores for each signal
   *
   * O(numSignals^2 * embeddingDim + context_processing) time complexity
   */
  computePriorityScores(
    signals: Signal[],
    context: AttentionContext
  ): PriorityScore[] {
    if (signals.length === 0) {
      return [];
    }

    // Encode signals
    const signalEmbeddings = signals.map(s =>
      this.padOrTruncate(s.embedding, this.config.embeddingDim)
    );

    // Add positional encoding to signals
    if (this.positionalEncoding) {
      for (let i = 0; i < signalEmbeddings.length; i++) {
        for (let j = 0; j < this.config.embeddingDim; j++) {
          signalEmbeddings[i][j] += this.positionalEncoding[i % this.config.maxSeqLength][j];
        }
      }
    }

    // Encode context
    const contextEmbeddings = this.encodeContext(context);

    // Self-attention on signals
    const selfAttentionOutput = this.multiHeadAttention(signalEmbeddings);

    // Cross-attention with context
    const crossAttentionOutput = this.multiHeadAttention(signalEmbeddings, contextEmbeddings);

    // Combine outputs
    const priorityScores: PriorityScore[] = [];

    for (let i = 0; i < signals.length; i++) {
      const signal = signals[i];

      // Calculate attention-based score from self-attention
      // (how much attention other signals pay to this one)
      let selfAttentionScore = 0;
      for (let j = 0; j < signals.length; j++) {
        if (i !== j) {
          // Average attention received from other signals across heads
          let received = 0;
          for (const weights of selfAttentionOutput.attentionWeights) {
            received += weights[j]?.[i] ?? 0;
          }
          selfAttentionScore += received / this.config.numHeads;
        }
      }
      selfAttentionScore /= Math.max(1, signals.length - 1);

      // Calculate context relevance from cross-attention
      let contextRelevance = 0;
      for (const weights of crossAttentionOutput.attentionWeights) {
        // Sum of attention weights from this signal to context
        const row = weights[i] ?? [];
        contextRelevance += row.reduce((a, b) => a + b, 0) / Math.max(1, row.length);
      }
      contextRelevance /= this.config.numHeads;

      // Calculate output magnitude as additional signal
      const outputMagnitude = Math.sqrt(
        crossAttentionOutput.output[i].reduce((sum, v) => sum + v * v, 0)
      ) / this.config.embeddingDim;

      // Combine attention scores
      const attentionScore = (selfAttentionScore * 0.3 + contextRelevance * 0.5 + outputMagnitude * 0.2);

      // Base priority contribution
      const basePriorityContribution = signal.basePriority ?? 0.5;

      // Final score
      const finalScore = this.config.basePriorityWeight * basePriorityContribution +
                        this.config.attentionWeight * attentionScore;

      // Generate explanation
      const explanation = this.generateExplanation(
        signal,
        selfAttentionScore,
        contextRelevance,
        outputMagnitude,
        crossAttentionOutput.visualizationData.topAttendedItems[i]
      );

      // Contributing factors
      const factors = [
        { factor: 'Base Priority', weight: this.config.basePriorityWeight * basePriorityContribution },
        { factor: 'Self Attention', weight: this.config.attentionWeight * selfAttentionScore * 0.3 },
        { factor: 'Context Relevance', weight: this.config.attentionWeight * contextRelevance * 0.5 },
        { factor: 'Signal Strength', weight: this.config.attentionWeight * outputMagnitude * 0.2 },
      ];

      priorityScores.push({
        signalId: signal.id,
        score: Math.max(0, Math.min(1, finalScore)),
        basePriorityContribution: basePriorityContribution * this.config.basePriorityWeight,
        attentionContribution: attentionScore * this.config.attentionWeight,
        contextRelevance,
        explanation,
        factors,
      });
    }

    // Sort by score descending
    priorityScores.sort((a, b) => b.score - a.score);

    return priorityScores;
  }

  /**
   * Generate explanation for priority score
   * @param signal - The signal
   * @param selfScore - Self-attention score
   * @param contextScore - Context relevance score
   * @param magnitude - Output magnitude
   * @param topAttended - Top attended context items
   * @returns Explanation strings
   *
   * O(1) time complexity
   */
  private generateExplanation(
    signal: Signal,
    selfScore: number,
    contextScore: number,
    magnitude: number,
    topAttended?: { query: string; attended: string[]; weights: number[] }
  ): string[] {
    const explanations: string[] = [];

    // Self-attention explanation
    if (selfScore > 0.5) {
      explanations.push(`High inter-signal relevance (${(selfScore * 100).toFixed(1)}%)`);
    } else if (selfScore < 0.2) {
      explanations.push(`Independent signal with low inter-signal attention`);
    }

    // Context relevance
    if (contextScore > 0.6) {
      explanations.push(`Strongly relevant to current context (${(contextScore * 100).toFixed(1)}%)`);
    } else if (contextScore > 0.3) {
      explanations.push(`Moderately relevant to context`);
    } else {
      explanations.push(`Low context relevance`);
    }

    // Base priority
    if (signal.basePriority !== undefined) {
      if (signal.basePriority > 0.7) {
        explanations.push(`High base priority assigned`);
      } else if (signal.basePriority < 0.3) {
        explanations.push(`Low base priority assigned`);
      }
    }

    // Signal type
    explanations.push(`Signal type: ${signal.type}`);

    // Top attended items
    if (topAttended && topAttended.attended.length > 0) {
      explanations.push(`Most relevant context: ${topAttended.attended[0]}`);
    }

    return explanations;
  }

  /**
   * Get attention weight visualization for RADAR integration
   * @param signals - Signals that were prioritized
   * @param context - Context used
   * @returns Visualization-ready data
   *
   * O(numSignals^2) time complexity
   */
  getRADARVisualizationData(
    signals: Signal[],
    context: AttentionContext
  ): {
    signalLabels: string[];
    contextLabels: string[];
    signalToSignalWeights: number[][];
    signalToContextWeights: number[][];
    priorityRanking: Array<{ id: string; score: number; rank: number }>;
  } {
    const priorities = this.computePriorityScores(signals, context);

    // Get signal embeddings and compute attention
    const signalEmbeddings = signals.map(s =>
      this.padOrTruncate(s.embedding, this.config.embeddingDim)
    );
    const contextEmbeddings = this.encodeContext(context);

    const selfAttention = this.multiHeadAttention(signalEmbeddings);
    const crossAttention = this.multiHeadAttention(signalEmbeddings, contextEmbeddings);

    return {
      signalLabels: signals.map(s => s.id),
      contextLabels: this.generateContextLabels(context),
      signalToSignalWeights: selfAttention.visualizationData.aggregatedWeights,
      signalToContextWeights: crossAttention.visualizationData.aggregatedWeights,
      priorityRanking: priorities.map((p, i) => ({
        id: p.signalId,
        score: p.score,
        rank: i + 1,
      })),
    };
  }

  /**
   * Generate labels for context items
   * @param context - Context data
   * @returns Array of labels
   *
   * O(context_size) time complexity
   */
  private generateContextLabels(context: AttentionContext): string[] {
    const labels: string[] = [];

    for (let i = 0; i < context.userHistory.length; i++) {
      labels.push(`history-${i}`);
    }

    labels.push('time-features');

    for (let i = 0; i < context.goalEmbeddings.length; i++) {
      labels.push(`goal-${i}`);
    }

    if (context.focusState) {
      labels.push('focus-state');
    }

    return labels;
  }

  /**
   * Update attention parameters (simple gradient descent)
   * @param signalEmbeddings - Signal embeddings
   * @param targetPriorities - Target priority scores
   * @param learningRate - Learning rate
   *
   * O(numHeads * seq_len^2 * headDim) time complexity
   */
  updateParameters(
    signalEmbeddings: number[][],
    targetPriorities: number[],
    learningRate: number = 0.01
  ): void {
    // Forward pass
    const output = this.multiHeadAttention(signalEmbeddings);

    // Calculate output magnitudes as predictions
    const predictions = output.output.map(row =>
      Math.sqrt(row.reduce((sum, v) => sum + v * v, 0)) / this.config.embeddingDim
    );

    // Calculate gradients (simplified - just output weights)
    for (let i = 0; i < predictions.length; i++) {
      const error = predictions[i] - targetPriorities[i];

      // Update output bias
      for (let j = 0; j < this.config.embeddingDim; j++) {
        this.params.outputBias[j] -= learningRate * error * 0.1;
      }
    }
  }

  /**
   * Export state for persistence
   * @returns Serializable state
   *
   * O(parameters_size) time complexity
   */
  exportState(): {
    config: AttentionConfig;
    params: AttentionParameters;
  } {
    return {
      config: { ...this.config },
      params: {
        queryWeights: this.params.queryWeights.map(h => h.map(r => [...r])),
        keyWeights: this.params.keyWeights.map(h => h.map(r => [...r])),
        valueWeights: this.params.valueWeights.map(h => h.map(r => [...r])),
        outputWeights: this.params.outputWeights.map(r => [...r]),
        outputBias: [...this.params.outputBias],
      },
    };
  }

  /**
   * Import state from persistence
   * @param state - Serialized state
   *
   * O(parameters_size) time complexity
   */
  importState(state: {
    config?: Partial<AttentionConfig>;
    params?: AttentionParameters;
  }): void {
    if (state.config) {
      this.config = { ...this.config, ...state.config };
    }

    if (state.params) {
      this.params = {
        queryWeights: state.params.queryWeights.map(h => h.map(r => [...r])),
        keyWeights: state.params.keyWeights.map(h => h.map(r => [...r])),
        valueWeights: state.params.valueWeights.map(h => h.map(r => [...r])),
        outputWeights: state.params.outputWeights.map(r => [...r]),
        outputBias: [...state.params.outputBias],
      };
    }
  }

  /**
   * Get configuration
   * @returns Current configuration
   *
   * O(1) time complexity
   */
  getConfig(): AttentionConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   * @param config - New configuration values
   *
   * O(1) time complexity (may trigger re-initialization)
   */
  updateConfig(config: Partial<AttentionConfig>): void {
    const needsReinit = config.embeddingDim !== undefined &&
                       config.embeddingDim !== this.config.embeddingDim ||
                       config.numHeads !== undefined &&
                       config.numHeads !== this.config.numHeads;

    this.config = { ...this.config, ...config };
    this.config.headDim = Math.floor(this.config.embeddingDim / this.config.numHeads);

    if (needsReinit) {
      this.params = this.initializeParameters();
      if (this.config.usePositionalEncoding) {
        this.positionalEncoding = this.generatePositionalEncoding();
      }
    }
  }
}

// Factory function
export function createAttentionPrioritizer(
  config?: Partial<AttentionConfig>,
  seed?: number
): AttentionPrioritizer {
  return new AttentionPrioritizer(config, seed);
}

// Default singleton
export const attentionPrioritizer = new AttentionPrioritizer();
