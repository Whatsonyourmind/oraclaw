/**
 * Attention Mechanism
 * Story alg-8 - Self-attention for prioritizing signals and tasks
 *
 * Implements attention mechanisms including self-attention, multi-head attention,
 * positional encoding, Query-Key-Value computation, and support for masking
 * and causal attention.
 */

/**
 * Represents a token/element in a sequence
 */
export interface SequenceToken {
  /** Unique identifier */
  id: string;
  /** Token value/embedding vector */
  embedding: number[];
  /** Position in sequence */
  position: number;
  /** Token type (for heterogeneous sequences) */
  type?: string;
  /** Token metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Query-Key-Value triple for attention computation
 */
export interface QKV {
  /** Query vectors (batch x seq_len x d_k) */
  query: number[][];
  /** Key vectors (batch x seq_len x d_k) */
  key: number[][];
  /** Value vectors (batch x seq_len x d_v) */
  value: number[][];
}

/**
 * Attention weights and output
 */
export interface AttentionOutput {
  /** Output vectors after attention */
  output: number[][];
  /** Attention weight matrix (seq_len x seq_len) */
  weights: number[][];
  /** Entropy of attention distribution per position */
  entropy: number[];
  /** Top-k attended positions per query */
  topAttended: Array<Array<{ position: number; weight: number }>>;
}

/**
 * Multi-head attention output
 */
export interface MultiHeadOutput {
  /** Combined output from all heads */
  output: number[][];
  /** Individual head outputs */
  headOutputs: AttentionOutput[];
  /** Head-wise attention patterns */
  headPatterns: Array<{ headIndex: number; dominantPattern: string; avgEntropy: number }>;
}

/**
 * Positional encoding type
 */
export type PositionalEncodingType =
  | 'sinusoidal'
  | 'learned'
  | 'rotary'
  | 'relative'
  | 'alibi';

/**
 * Attention mask type
 */
export type MaskType =
  | 'none'
  | 'causal'
  | 'bidirectional'
  | 'local'
  | 'sparse'
  | 'custom';

/**
 * Configuration for attention mechanism
 */
export interface AttentionConfig {
  /** Embedding dimension */
  embeddingDim: number;
  /** Key/Query dimension */
  keyDim: number;
  /** Value dimension */
  valueDim: number;
  /** Number of attention heads */
  numHeads: number;
  /** Dropout rate (0-1) */
  dropoutRate: number;
  /** Temperature for softmax scaling */
  temperature: number;
  /** Use scaled dot-product attention */
  useScaling: boolean;
  /** Positional encoding type */
  positionalEncoding: PositionalEncodingType;
  /** Maximum sequence length for positional encoding */
  maxSequenceLength: number;
  /** Mask type */
  maskType: MaskType;
  /** Local attention window size (for local masking) */
  localWindowSize: number;
  /** Sparsity pattern for sparse attention */
  sparsityFactor: number;
}

/**
 * Weight matrices for linear projections
 */
export interface ProjectionWeights {
  /** Query projection matrix */
  Wq: number[][];
  /** Key projection matrix */
  Wk: number[][];
  /** Value projection matrix */
  Wv: number[][];
  /** Output projection matrix */
  Wo: number[][];
}

/**
 * Attention statistics for monitoring
 */
export interface AttentionStats {
  /** Average attention entropy (higher = more distributed) */
  avgEntropy: number;
  /** Average attention sparsity (fraction of near-zero weights) */
  avgSparsity: number;
  /** Attention concentration (how much focus on few positions) */
  concentration: number;
  /** Effective receptive field size */
  effectiveReceptiveField: number;
  /** Head diversity (how different are head patterns) */
  headDiversity: number;
}

/**
 * Signal/task for prioritization
 */
export interface Signal {
  /** Signal identifier */
  id: string;
  /** Signal features as embedding */
  features: number[];
  /** Priority score (computed by attention) */
  priority?: number;
  /** Importance weight */
  importance: number;
  /** Urgency factor */
  urgency: number;
  /** Signal category */
  category: string;
  /** Timestamp */
  timestamp: number;
  /** Dependencies on other signals */
  dependencies?: string[];
}

/**
 * Prioritized signal output
 */
export interface PrioritizedSignal extends Signal {
  /** Computed attention-based priority */
  priority: number;
  /** Confidence in priority */
  confidence: number;
  /** Related signals that influenced priority */
  relatedSignals: Array<{ signalId: string; influence: number }>;
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
 * Attention Mechanism Service
 *
 * Provides self-attention, multi-head attention, and signal prioritization
 * capabilities for the ORACLE system.
 */
export class AttentionMechanismService {
  private config: AttentionConfig;
  private random: () => number;
  private projectionWeights: Map<number, ProjectionWeights> = new Map();
  private positionalEncodings: number[][] | null = null;
  private learnedPositionalEncodings: number[][] | null = null;

  /**
   * Creates a new Attention Mechanism service
   * @param config - Configuration options
   * @param seed - Random seed for reproducibility
   */
  constructor(config: Partial<AttentionConfig> = {}, seed?: number) {
    this.config = {
      embeddingDim: config.embeddingDim ?? 64,
      keyDim: config.keyDim ?? 64,
      valueDim: config.valueDim ?? 64,
      numHeads: config.numHeads ?? 8,
      dropoutRate: config.dropoutRate ?? 0.1,
      temperature: config.temperature ?? 1.0,
      useScaling: config.useScaling ?? true,
      positionalEncoding: config.positionalEncoding ?? 'sinusoidal',
      maxSequenceLength: config.maxSequenceLength ?? 512,
      maskType: config.maskType ?? 'none',
      localWindowSize: config.localWindowSize ?? 32,
      sparsityFactor: config.sparsityFactor ?? 0.1,
    };
    this.random = createRandom(seed);

    // Initialize positional encodings
    this.initializePositionalEncodings();

    // Initialize projection weights for each head
    this.initializeProjectionWeights();
  }

  /**
   * Initialize sinusoidal positional encodings
   *
   * PE(pos, 2i) = sin(pos / 10000^(2i/d_model))
   * PE(pos, 2i+1) = cos(pos / 10000^(2i/d_model))
   *
   * O(maxSequenceLength * embeddingDim) time complexity
   */
  private initializePositionalEncodings(): void {
    const { maxSequenceLength, embeddingDim } = this.config;
    this.positionalEncodings = [];

    for (let pos = 0; pos < maxSequenceLength; pos++) {
      const encoding: number[] = [];

      for (let i = 0; i < embeddingDim; i++) {
        const angle = pos / Math.pow(10000, (2 * Math.floor(i / 2)) / embeddingDim);

        if (i % 2 === 0) {
          encoding.push(Math.sin(angle));
        } else {
          encoding.push(Math.cos(angle));
        }
      }

      this.positionalEncodings.push(encoding);
    }

    // Initialize learned encodings if needed
    if (this.config.positionalEncoding === 'learned') {
      this.learnedPositionalEncodings = [];
      for (let pos = 0; pos < maxSequenceLength; pos++) {
        const encoding: number[] = [];
        for (let i = 0; i < embeddingDim; i++) {
          encoding.push((this.random() - 0.5) * 0.02);
        }
        this.learnedPositionalEncodings.push(encoding);
      }
    }
  }

  /**
   * Initialize projection weight matrices
   *
   * O(numHeads * embeddingDim * keyDim) time complexity
   */
  private initializeProjectionWeights(): void {
    const { numHeads, embeddingDim, keyDim, valueDim } = this.config;
    const headDim = Math.floor(embeddingDim / numHeads);

    for (let h = 0; h < numHeads; h++) {
      const scale = Math.sqrt(2.0 / (embeddingDim + headDim));

      const Wq = this.initializeMatrix(embeddingDim, headDim, scale);
      const Wk = this.initializeMatrix(embeddingDim, headDim, scale);
      const Wv = this.initializeMatrix(embeddingDim, headDim, scale);
      const Wo = this.initializeMatrix(headDim, embeddingDim, scale);

      this.projectionWeights.set(h, { Wq, Wk, Wv, Wo });
    }
  }

  /**
   * Initialize a weight matrix with Xavier initialization
   * @param rows - Number of rows
   * @param cols - Number of columns
   * @param scale - Initialization scale
   * @returns Weight matrix
   *
   * O(rows * cols) time complexity
   */
  private initializeMatrix(rows: number, cols: number, scale: number): number[][] {
    const matrix: number[][] = [];
    for (let i = 0; i < rows; i++) {
      const row: number[] = [];
      for (let j = 0; j < cols; j++) {
        // Xavier initialization
        row.push((this.random() - 0.5) * 2 * scale);
      }
      matrix.push(row);
    }
    return matrix;
  }

  /**
   * Get positional encoding for a position
   * @param position - Position in sequence
   * @returns Positional encoding vector
   *
   * O(1) time complexity
   */
  getPositionalEncoding(position: number): number[] {
    if (position < 0 || position >= this.config.maxSequenceLength) {
      throw new Error(`Position ${position} out of bounds [0, ${this.config.maxSequenceLength})`);
    }

    switch (this.config.positionalEncoding) {
      case 'sinusoidal':
        return this.positionalEncodings![position];
      case 'learned':
        return this.learnedPositionalEncodings![position];
      case 'rotary':
        return this.getRotaryPositionalEncoding(position);
      case 'alibi':
        return this.getALiBiEncoding(position);
      default:
        return this.positionalEncodings![position];
    }
  }

  /**
   * Get rotary positional encoding (RoPE)
   * @param position - Position in sequence
   * @returns Rotary encoding vector
   *
   * O(embeddingDim) time complexity
   */
  private getRotaryPositionalEncoding(position: number): number[] {
    const { embeddingDim } = this.config;
    const encoding: number[] = [];

    for (let i = 0; i < embeddingDim; i += 2) {
      const theta = position / Math.pow(10000, i / embeddingDim);
      encoding.push(Math.cos(theta));
      encoding.push(Math.sin(theta));
    }

    return encoding;
  }

  /**
   * Get ALiBi (Attention with Linear Biases) encoding
   * @param position - Position in sequence
   * @returns ALiBi bias vector
   *
   * O(maxSequenceLength) time complexity
   */
  private getALiBiEncoding(position: number): number[] {
    const { maxSequenceLength, numHeads } = this.config;
    const biases: number[] = [];

    // ALiBi uses linear biases based on distance
    for (let i = 0; i < maxSequenceLength; i++) {
      const distance = Math.abs(position - i);
      // Slope varies per head (will be applied during attention)
      const slope = Math.pow(2, -(8 / numHeads));
      biases.push(-slope * distance);
    }

    return biases;
  }

  /**
   * Apply positional encoding to embeddings
   * @param embeddings - Input embeddings (seq_len x embedding_dim)
   * @returns Embeddings with positional encoding added
   *
   * O(seq_len * embedding_dim) time complexity
   */
  addPositionalEncoding(embeddings: number[][]): number[][] {
    const result: number[][] = [];

    for (let pos = 0; pos < embeddings.length; pos++) {
      const encoding = this.getPositionalEncoding(pos);
      const combined: number[] = [];

      for (let i = 0; i < embeddings[pos].length; i++) {
        combined.push(embeddings[pos][i] + (encoding[i] ?? 0));
      }

      result.push(combined);
    }

    return result;
  }

  /**
   * Matrix multiplication
   * @param A - First matrix
   * @param B - Second matrix
   * @returns Result matrix
   *
   * O(n * m * k) time complexity
   */
  private matmul(A: number[][], B: number[][]): number[][] {
    const rowsA = A.length;
    const colsA = A[0]?.length ?? 0;
    const colsB = B[0]?.length ?? 0;

    const result: number[][] = [];

    for (let i = 0; i < rowsA; i++) {
      const row: number[] = [];
      for (let j = 0; j < colsB; j++) {
        let sum = 0;
        for (let k = 0; k < colsA; k++) {
          sum += (A[i][k] ?? 0) * (B[k]?.[j] ?? 0);
        }
        row.push(sum);
      }
      result.push(row);
    }

    return result;
  }

  /**
   * Transpose a matrix
   * @param M - Matrix to transpose
   * @returns Transposed matrix
   *
   * O(n * m) time complexity
   */
  private transpose(M: number[][]): number[][] {
    if (M.length === 0) return [];

    const rows = M.length;
    const cols = M[0].length;
    const result: number[][] = [];

    for (let j = 0; j < cols; j++) {
      const row: number[] = [];
      for (let i = 0; i < rows; i++) {
        row.push(M[i][j]);
      }
      result.push(row);
    }

    return result;
  }

  /**
   * Compute Query, Key, Value projections
   * @param embeddings - Input embeddings
   * @param headIndex - Which attention head
   * @returns QKV triple
   *
   * O(seq_len * embedding_dim * key_dim) time complexity
   */
  computeQKV(embeddings: number[][], headIndex: number): QKV {
    const weights = this.projectionWeights.get(headIndex);
    if (!weights) {
      throw new Error(`No weights for head ${headIndex}`);
    }

    const query = this.matmul(embeddings, weights.Wq);
    const key = this.matmul(embeddings, weights.Wk);
    const value = this.matmul(embeddings, weights.Wv);

    return { query, key, value };
  }

  /**
   * Apply softmax with temperature scaling
   * @param logits - Input logits
   * @param temperature - Temperature for scaling
   * @returns Softmax probabilities
   *
   * O(n) time complexity
   */
  softmax(logits: number[], temperature: number = 1.0): number[] {
    const scaledLogits = logits.map(l => l / temperature);
    const maxLogit = Math.max(...scaledLogits);
    const expLogits = scaledLogits.map(l => Math.exp(l - maxLogit));
    const sumExp = expLogits.reduce((a, b) => a + b, 0);
    return expLogits.map(e => e / sumExp);
  }

  /**
   * Apply softmax to each row of a matrix
   * @param matrix - Input matrix
   * @param temperature - Temperature for scaling
   * @returns Matrix with softmax applied row-wise
   *
   * O(n * m) time complexity
   */
  private rowWiseSoftmax(matrix: number[][], temperature: number): number[][] {
    return matrix.map(row => this.softmax(row, temperature));
  }

  /**
   * Create attention mask
   * @param seqLen - Sequence length
   * @param maskType - Type of mask to create
   * @returns Mask matrix (true = attend, false = mask out)
   *
   * O(seqLen^2) time complexity
   */
  createMask(seqLen: number, maskType?: MaskType): boolean[][] {
    const type = maskType ?? this.config.maskType;
    const mask: boolean[][] = [];

    for (let i = 0; i < seqLen; i++) {
      const row: boolean[] = [];
      for (let j = 0; j < seqLen; j++) {
        switch (type) {
          case 'none':
            row.push(true);
            break;
          case 'causal':
            // Can only attend to previous positions
            row.push(j <= i);
            break;
          case 'bidirectional':
            row.push(true);
            break;
          case 'local':
            // Local window attention
            row.push(Math.abs(i - j) <= this.config.localWindowSize);
            break;
          case 'sparse':
            // Sparse attention pattern
            row.push(j % Math.floor(1 / this.config.sparsityFactor) === 0 || j === i);
            break;
          default:
            row.push(true);
        }
      }
      mask.push(row);
    }

    return mask;
  }

  /**
   * Apply mask to attention scores
   * @param scores - Attention scores
   * @param mask - Boolean mask
   * @returns Masked scores (masked positions set to -Infinity)
   *
   * O(n * m) time complexity
   */
  private applyMask(scores: number[][], mask: boolean[][]): number[][] {
    const masked: number[][] = [];

    for (let i = 0; i < scores.length; i++) {
      const row: number[] = [];
      for (let j = 0; j < scores[i].length; j++) {
        if (mask[i]?.[j]) {
          row.push(scores[i][j]);
        } else {
          row.push(-Infinity);
        }
      }
      masked.push(row);
    }

    return masked;
  }

  /**
   * Scaled Dot-Product Attention
   *
   * Attention(Q, K, V) = softmax(QK^T / sqrt(d_k)) * V
   *
   * @param query - Query vectors
   * @param key - Key vectors
   * @param value - Value vectors
   * @param mask - Optional attention mask
   * @returns Attention output
   *
   * O(seq_len^2 * d_k) time complexity
   */
  scaledDotProductAttention(
    query: number[][],
    key: number[][],
    value: number[][],
    mask?: boolean[][]
  ): AttentionOutput {
    const seqLen = query.length;
    const dk = query[0]?.length ?? 1;

    // Compute QK^T
    const keyT = this.transpose(key);
    let scores = this.matmul(query, keyT);

    // Scale
    if (this.config.useScaling) {
      const scale = Math.sqrt(dk);
      scores = scores.map(row => row.map(s => s / scale));
    }

    // Apply mask if provided
    if (mask) {
      scores = this.applyMask(scores, mask);
    }

    // Softmax with temperature
    const weights = this.rowWiseSoftmax(scores, this.config.temperature);

    // Apply dropout during training (simplified: just compute without dropout)
    const output = this.matmul(weights, value);

    // Calculate entropy and top attended positions
    const entropy: number[] = [];
    const topAttended: Array<Array<{ position: number; weight: number }>> = [];

    for (let i = 0; i < weights.length; i++) {
      // Entropy
      let e = 0;
      for (const w of weights[i]) {
        if (w > 0) {
          e -= w * Math.log2(w);
        }
      }
      entropy.push(e);

      // Top-k attended
      const indexed = weights[i].map((w, idx) => ({ position: idx, weight: w }));
      indexed.sort((a, b) => b.weight - a.weight);
      topAttended.push(indexed.slice(0, 5));
    }

    return { output, weights, entropy, topAttended };
  }

  /**
   * Multi-Head Attention
   *
   * Runs multiple attention heads in parallel and concatenates results.
   *
   * @param embeddings - Input embeddings with positional encoding
   * @param mask - Optional attention mask
   * @returns Multi-head attention output
   *
   * O(numHeads * seq_len^2 * d_k) time complexity
   */
  multiHeadAttention(embeddings: number[][], mask?: boolean[][]): MultiHeadOutput {
    const headOutputs: AttentionOutput[] = [];
    const allHeadValues: number[][][] = [];

    // Create mask if not provided
    const actualMask = mask ?? this.createMask(embeddings.length);

    // Run attention for each head
    for (let h = 0; h < this.config.numHeads; h++) {
      const qkv = this.computeQKV(embeddings, h);
      const headOutput = this.scaledDotProductAttention(
        qkv.query,
        qkv.key,
        qkv.value,
        actualMask
      );
      headOutputs.push(headOutput);
      allHeadValues.push(headOutput.output);
    }

    // Concatenate head outputs
    const concatenated: number[][] = [];
    for (let i = 0; i < embeddings.length; i++) {
      const row: number[] = [];
      for (let h = 0; h < this.config.numHeads; h++) {
        row.push(...allHeadValues[h][i]);
      }
      concatenated.push(row);
    }

    // Project back to embedding dimension (simplified: use averaging)
    const output = concatenated.map(row => {
      const result: number[] = [];
      const chunkSize = Math.floor(row.length / this.config.embeddingDim);
      for (let i = 0; i < this.config.embeddingDim; i++) {
        let sum = 0;
        for (let j = 0; j < chunkSize; j++) {
          sum += row[i * chunkSize + j] ?? 0;
        }
        result.push(sum / chunkSize);
      }
      return result;
    });

    // Analyze head patterns
    const headPatterns = headOutputs.map((ho, idx) => {
      const avgEntropy = ho.entropy.reduce((a, b) => a + b, 0) / ho.entropy.length;

      // Determine dominant pattern
      let dominantPattern = 'distributed';
      if (avgEntropy < 1) {
        dominantPattern = 'focused';
      } else if (avgEntropy > 3) {
        dominantPattern = 'uniform';
      }

      // Check for diagonal/local pattern
      let diagonalScore = 0;
      for (let i = 0; i < ho.weights.length; i++) {
        diagonalScore += ho.weights[i][i] ?? 0;
      }
      if (diagonalScore / ho.weights.length > 0.5) {
        dominantPattern = 'local';
      }

      return { headIndex: idx, dominantPattern, avgEntropy };
    });

    return { output, headOutputs, headPatterns };
  }

  /**
   * Self-attention for a sequence of tokens
   * @param tokens - Input tokens with embeddings
   * @returns Attention output with updated embeddings
   *
   * O(numHeads * seq_len^2 * d_k) time complexity
   */
  selfAttention(tokens: SequenceToken[]): {
    output: MultiHeadOutput;
    updatedTokens: SequenceToken[];
  } {
    // Extract embeddings and add positional encoding
    const embeddings = tokens.map(t => t.embedding);
    const withPositional = this.addPositionalEncoding(embeddings);

    // Run multi-head attention
    const output = this.multiHeadAttention(withPositional);

    // Create updated tokens with attention-weighted embeddings
    const updatedTokens: SequenceToken[] = tokens.map((token, idx) => ({
      ...token,
      embedding: output.output[idx],
      metadata: {
        ...token.metadata,
        attentionEntropy: output.headOutputs[0].entropy[idx],
        topAttended: output.headOutputs[0].topAttended[idx],
      },
    }));

    return { output, updatedTokens };
  }

  /**
   * Prioritize signals using attention mechanism
   *
   * Uses self-attention to determine signal priorities based on
   * relationships and importance.
   *
   * @param signals - Input signals to prioritize
   * @returns Prioritized signals with attention-based scores
   *
   * O(numHeads * n^2 * d_k) time complexity where n = number of signals
   */
  prioritizeSignals(signals: Signal[]): PrioritizedSignal[] {
    if (signals.length === 0) return [];

    // Convert signals to tokens
    const tokens: SequenceToken[] = signals.map((signal, idx) => ({
      id: signal.id,
      embedding: this.createSignalEmbedding(signal),
      position: idx,
      type: signal.category,
      metadata: { importance: signal.importance, urgency: signal.urgency },
    }));

    // Run self-attention
    const { output, updatedTokens } = this.selfAttention(tokens);

    // Extract priorities from attention patterns
    const prioritizedSignals: PrioritizedSignal[] = signals.map((signal, idx) => {
      // Aggregate attention weights across heads to get influence
      let totalInfluence = 0;
      const relatedSignals: Array<{ signalId: string; influence: number }> = [];

      for (let h = 0; h < this.config.numHeads; h++) {
        const weights = output.headOutputs[h].weights;
        for (let j = 0; j < signals.length; j++) {
          if (j !== idx) {
            const influence = weights[idx][j];
            totalInfluence += influence;

            // Track related signals
            const existing = relatedSignals.find(r => r.signalId === signals[j].id);
            if (existing) {
              existing.influence += influence / this.config.numHeads;
            } else {
              relatedSignals.push({
                signalId: signals[j].id,
                influence: influence / this.config.numHeads,
              });
            }
          }
        }
      }

      // Compute priority as combination of:
      // - Self-importance (from original signal)
      // - Attention-based importance (how much others attend to this)
      // - Urgency factor
      const selfWeight = 0.4;
      const attentionWeight = 0.4;
      const urgencyWeight = 0.2;

      // Calculate received attention (how much other signals attend to this one)
      let receivedAttention = 0;
      for (let h = 0; h < this.config.numHeads; h++) {
        for (let i = 0; i < signals.length; i++) {
          if (i !== idx) {
            receivedAttention += output.headOutputs[h].weights[i][idx];
          }
        }
      }
      receivedAttention /= (signals.length - 1) * this.config.numHeads;

      const priority =
        selfWeight * signal.importance +
        attentionWeight * receivedAttention +
        urgencyWeight * signal.urgency;

      // Confidence based on attention entropy
      const avgEntropy = output.headOutputs
        .map(ho => ho.entropy[idx])
        .reduce((a, b) => a + b, 0) / this.config.numHeads;
      const maxEntropy = Math.log2(signals.length);
      const confidence = 1 - Math.min(1, avgEntropy / maxEntropy);

      // Sort related signals by influence
      relatedSignals.sort((a, b) => b.influence - a.influence);

      return {
        ...signal,
        priority,
        confidence,
        relatedSignals: relatedSignals.slice(0, 5),
      };
    });

    // Sort by priority
    return prioritizedSignals.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Create embedding vector for a signal
   * @param signal - Signal to embed
   * @returns Embedding vector
   *
   * O(embeddingDim) time complexity
   */
  private createSignalEmbedding(signal: Signal): number[] {
    const { embeddingDim } = this.config;

    // If signal has features, use them
    if (signal.features.length >= embeddingDim) {
      return signal.features.slice(0, embeddingDim);
    }

    // Pad or create embedding
    const embedding = [...signal.features];

    // Add normalized importance and urgency
    embedding.push(signal.importance);
    embedding.push(signal.urgency);

    // Hash category to numeric features
    const categoryHash = this.hashString(signal.category);
    for (let i = 0; i < 4; i++) {
      embedding.push((categoryHash >> (i * 8) & 0xff) / 255);
    }

    // Pad to embeddingDim
    while (embedding.length < embeddingDim) {
      embedding.push(0);
    }

    return embedding.slice(0, embeddingDim);
  }

  /**
   * Simple string hash function
   * @param str - String to hash
   * @returns Hash value
   *
   * O(n) time complexity where n = string length
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  /**
   * Cross-attention between two sequences
   * @param querySeq - Query sequence embeddings
   * @param keyValueSeq - Key/Value sequence embeddings
   * @returns Attention output
   *
   * O(numHeads * len_q * len_kv * d_k) time complexity
   */
  crossAttention(
    querySeq: number[][],
    keyValueSeq: number[][]
  ): AttentionOutput {
    // Use first head's weights for cross-attention
    const weights = this.projectionWeights.get(0)!;

    // Project queries from query sequence
    const query = this.matmul(querySeq, weights.Wq);

    // Project keys and values from key/value sequence
    const key = this.matmul(keyValueSeq, weights.Wk);
    const value = this.matmul(keyValueSeq, weights.Wv);

    // No masking for cross-attention (attend to all key/value positions)
    return this.scaledDotProductAttention(query, key, value);
  }

  /**
   * Calculate attention statistics
   * @param output - Multi-head attention output
   * @returns Attention statistics
   *
   * O(numHeads * seq_len^2) time complexity
   */
  calculateStats(output: MultiHeadOutput): AttentionStats {
    const { headOutputs, headPatterns } = output;
    const numHeads = headOutputs.length;

    // Average entropy
    let totalEntropy = 0;
    let entropyCount = 0;
    for (const ho of headOutputs) {
      for (const e of ho.entropy) {
        totalEntropy += e;
        entropyCount++;
      }
    }
    const avgEntropy = entropyCount > 0 ? totalEntropy / entropyCount : 0;

    // Average sparsity (fraction of weights below threshold)
    const threshold = 0.01;
    let sparseCount = 0;
    let totalCount = 0;
    for (const ho of headOutputs) {
      for (const row of ho.weights) {
        for (const w of row) {
          if (w < threshold) sparseCount++;
          totalCount++;
        }
      }
    }
    const avgSparsity = totalCount > 0 ? sparseCount / totalCount : 0;

    // Concentration (average max attention weight)
    let maxWeightSum = 0;
    let rowCount = 0;
    for (const ho of headOutputs) {
      for (const row of ho.weights) {
        maxWeightSum += Math.max(...row);
        rowCount++;
      }
    }
    const concentration = rowCount > 0 ? maxWeightSum / rowCount : 0;

    // Effective receptive field (average number of positions with significant weight)
    const significantThreshold = 0.1 / (headOutputs[0]?.weights[0]?.length ?? 1);
    let receptiveFieldSum = 0;
    let posCount = 0;
    for (const ho of headOutputs) {
      for (const row of ho.weights) {
        let significant = 0;
        for (const w of row) {
          if (w > significantThreshold) significant++;
        }
        receptiveFieldSum += significant;
        posCount++;
      }
    }
    const effectiveReceptiveField = posCount > 0 ? receptiveFieldSum / posCount : 0;

    // Head diversity (variance in head patterns)
    const patternCounts = new Map<string, number>();
    for (const hp of headPatterns) {
      patternCounts.set(hp.dominantPattern, (patternCounts.get(hp.dominantPattern) ?? 0) + 1);
    }
    const headDiversity = patternCounts.size / numHeads;

    return {
      avgEntropy,
      avgSparsity,
      concentration,
      effectiveReceptiveField,
      headDiversity,
    };
  }

  /**
   * Update learned positional encodings
   * @param gradients - Gradients for position embeddings
   * @param learningRate - Learning rate
   *
   * O(maxSequenceLength * embeddingDim) time complexity
   */
  updateLearnedPositionalEncodings(gradients: number[][], learningRate: number): void {
    if (this.config.positionalEncoding !== 'learned' || !this.learnedPositionalEncodings) {
      return;
    }

    for (let pos = 0; pos < gradients.length && pos < this.config.maxSequenceLength; pos++) {
      for (let i = 0; i < gradients[pos].length && i < this.config.embeddingDim; i++) {
        this.learnedPositionalEncodings[pos][i] -= learningRate * gradients[pos][i];
      }
    }
  }

  /**
   * Update projection weights (simplified gradient update)
   * @param headIndex - Which head to update
   * @param gradients - Gradients for projection weights
   * @param learningRate - Learning rate
   *
   * O(embeddingDim^2) time complexity
   */
  updateProjectionWeights(
    headIndex: number,
    gradients: { dWq?: number[][]; dWk?: number[][]; dWv?: number[][]; dWo?: number[][] },
    learningRate: number
  ): void {
    const weights = this.projectionWeights.get(headIndex);
    if (!weights) return;

    if (gradients.dWq) {
      for (let i = 0; i < weights.Wq.length; i++) {
        for (let j = 0; j < weights.Wq[i].length; j++) {
          weights.Wq[i][j] -= learningRate * (gradients.dWq[i]?.[j] ?? 0);
        }
      }
    }

    if (gradients.dWk) {
      for (let i = 0; i < weights.Wk.length; i++) {
        for (let j = 0; j < weights.Wk[i].length; j++) {
          weights.Wk[i][j] -= learningRate * (gradients.dWk[i]?.[j] ?? 0);
        }
      }
    }

    if (gradients.dWv) {
      for (let i = 0; i < weights.Wv.length; i++) {
        for (let j = 0; j < weights.Wv[i].length; j++) {
          weights.Wv[i][j] -= learningRate * (gradients.dWv[i]?.[j] ?? 0);
        }
      }
    }
  }

  /**
   * Export state for persistence
   * @returns Serializable state
   *
   * O(numHeads * embeddingDim^2) time complexity
   */
  exportState(): {
    config: AttentionConfig;
    projectionWeights: Array<{ head: number; weights: ProjectionWeights }>;
    learnedPositionalEncodings: number[][] | null;
  } {
    const projWeights: Array<{ head: number; weights: ProjectionWeights }> = [];
    for (const [head, weights] of this.projectionWeights) {
      projWeights.push({
        head,
        weights: {
          Wq: weights.Wq.map(row => [...row]),
          Wk: weights.Wk.map(row => [...row]),
          Wv: weights.Wv.map(row => [...row]),
          Wo: weights.Wo.map(row => [...row]),
        },
      });
    }

    return {
      config: { ...this.config },
      projectionWeights: projWeights,
      learnedPositionalEncodings: this.learnedPositionalEncodings
        ? this.learnedPositionalEncodings.map(row => [...row])
        : null,
    };
  }

  /**
   * Import state from persistence
   * @param state - Serialized state
   *
   * O(numHeads * embeddingDim^2) time complexity
   */
  importState(state: {
    config?: Partial<AttentionConfig>;
    projectionWeights?: Array<{ head: number; weights: ProjectionWeights }>;
    learnedPositionalEncodings?: number[][] | null;
  }): void {
    if (state.config) {
      this.config = { ...this.config, ...state.config };
    }

    if (state.projectionWeights) {
      this.projectionWeights.clear();
      for (const { head, weights } of state.projectionWeights) {
        this.projectionWeights.set(head, {
          Wq: weights.Wq.map(row => [...row]),
          Wk: weights.Wk.map(row => [...row]),
          Wv: weights.Wv.map(row => [...row]),
          Wo: weights.Wo.map(row => [...row]),
        });
      }
    }

    if (state.learnedPositionalEncodings) {
      this.learnedPositionalEncodings = state.learnedPositionalEncodings.map(row => [...row]);
    }
  }

  /**
   * Get current configuration
   * @returns Configuration copy
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
   * O(1) time complexity (may trigger reinitialization)
   */
  updateConfig(config: Partial<AttentionConfig>): void {
    const needsReinit =
      config.embeddingDim !== undefined ||
      config.keyDim !== undefined ||
      config.valueDim !== undefined ||
      config.numHeads !== undefined ||
      config.maxSequenceLength !== undefined ||
      config.positionalEncoding !== undefined;

    this.config = { ...this.config, ...config };

    if (needsReinit) {
      this.initializePositionalEncodings();
      this.initializeProjectionWeights();
    }
  }

  /**
   * Reset the attention mechanism
   *
   * O(numHeads * embeddingDim^2) time complexity
   */
  reset(): void {
    this.initializePositionalEncodings();
    this.initializeProjectionWeights();
  }
}

// Factory function
export function createAttentionMechanism(
  config?: Partial<AttentionConfig>,
  seed?: number
): AttentionMechanismService {
  return new AttentionMechanismService(config, seed);
}

// Default singleton
export const attentionMechanismService = new AttentionMechanismService();
