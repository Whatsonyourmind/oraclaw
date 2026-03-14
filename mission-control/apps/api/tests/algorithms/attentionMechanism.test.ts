/**
 * Attention Mechanism Tests
 * Tests for attention weight calculation, multi-head attention,
 * and priority focusing for ORACLE decision support
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ============================================================================
// Types
// ============================================================================

interface AttentionConfig {
  numHeads: number;
  keyDim: number;
  valueDim: number;
  dropoutRate: number;
  temperature: number;
}

interface AttentionOutput {
  output: number[][];
  weights: number[][];
  headWeights?: number[][][];
}

// ============================================================================
// Attention Mechanism Implementation (for testing)
// ============================================================================

/**
 * Softmax function for attention weights
 */
function softmax(values: number[], temperature: number = 1.0): number[] {
  const scaled = values.map(v => v / temperature);
  const max = Math.max(...scaled);
  const exp = scaled.map(v => Math.exp(v - max));
  const sum = exp.reduce((a, b) => a + b, 0);
  return exp.map(v => v / sum);
}

/**
 * Dot product of two vectors
 */
function dotProduct(a: number[], b: number[]): number {
  return a.reduce((sum, val, i) => sum + val * b[i], 0);
}

/**
 * Matrix multiplication
 */
function matmul(a: number[][], b: number[][]): number[][] {
  const rowsA = a.length;
  const colsA = a[0]?.length || 0;
  const colsB = b[0]?.length || 0;

  const result: number[][] = [];
  for (let i = 0; i < rowsA; i++) {
    result[i] = [];
    for (let j = 0; j < colsB; j++) {
      let sum = 0;
      for (let k = 0; k < colsA; k++) {
        sum += a[i][k] * b[k][j];
      }
      result[i][j] = sum;
    }
  }
  return result;
}

/**
 * Transpose a matrix
 */
function transpose(matrix: number[][]): number[][] {
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
 * Scaled Dot-Product Attention
 */
class ScaledDotProductAttention {
  private temperature: number;

  constructor(keyDim: number, temperature?: number) {
    this.temperature = temperature ?? Math.sqrt(keyDim);
  }

  /**
   * Compute attention weights and output
   * @param queries - Query vectors [seqLen, keyDim]
   * @param keys - Key vectors [seqLen, keyDim]
   * @param values - Value vectors [seqLen, valueDim]
   * @param mask - Optional attention mask
   */
  forward(
    queries: number[][],
    keys: number[][],
    values: number[][],
    mask?: boolean[][]
  ): AttentionOutput {
    const seqLen = queries.length;

    // Compute attention scores: Q * K^T / sqrt(d_k)
    const keysT = transpose(keys);
    const scores = matmul(queries, keysT).map(row =>
      row.map(v => v / this.temperature)
    );

    // Apply mask if provided
    if (mask) {
      for (let i = 0; i < seqLen; i++) {
        for (let j = 0; j < seqLen; j++) {
          if (mask[i][j]) {
            scores[i][j] = -Infinity;
          }
        }
      }
    }

    // Apply softmax to get attention weights
    const weights = scores.map(row => softmax(row, 1.0));

    // Compute output: weights * V
    const output = matmul(weights, values);

    return { output, weights };
  }
}

/**
 * Multi-Head Attention
 */
class MultiHeadAttention {
  private heads: ScaledDotProductAttention[];
  private numHeads: number;
  private keyDim: number;

  constructor(config: AttentionConfig) {
    this.numHeads = config.numHeads;
    this.keyDim = config.keyDim;
    this.heads = [];

    for (let i = 0; i < config.numHeads; i++) {
      this.heads.push(new ScaledDotProductAttention(config.keyDim, config.temperature));
    }
  }

  /**
   * Compute multi-head attention
   */
  forward(
    queries: number[][],
    keys: number[][],
    values: number[][],
    mask?: boolean[][]
  ): AttentionOutput {
    const headOutputs: AttentionOutput[] = [];

    // Run each head
    for (const head of this.heads) {
      headOutputs.push(head.forward(queries, keys, values, mask));
    }

    // Concatenate outputs (simplified - just average for this implementation)
    const seqLen = queries.length;
    const valueDim = values[0]?.length || 0;
    const output: number[][] = [];
    const weights: number[][] = [];

    for (let i = 0; i < seqLen; i++) {
      output[i] = new Array(valueDim).fill(0);
      weights[i] = new Array(seqLen).fill(0);

      for (const headOutput of headOutputs) {
        for (let j = 0; j < valueDim; j++) {
          output[i][j] += headOutput.output[i][j] / this.numHeads;
        }
        for (let j = 0; j < seqLen; j++) {
          weights[i][j] += headOutput.weights[i][j] / this.numHeads;
        }
      }
    }

    return {
      output,
      weights,
      headWeights: headOutputs.map(h => h.weights),
    };
  }
}

/**
 * Priority Attention for ORACLE
 * Focuses attention on high-priority items
 */
class PriorityAttention {
  private baseAttention: ScaledDotProductAttention;
  private priorityBoost: number;

  constructor(keyDim: number, priorityBoost: number = 2.0) {
    this.baseAttention = new ScaledDotProductAttention(keyDim);
    this.priorityBoost = priorityBoost;
  }

  /**
   * Compute attention with priority weighting
   * @param queries - Query vectors
   * @param keys - Key vectors
   * @param values - Value vectors
   * @param priorities - Priority scores for each position (0-1)
   */
  forward(
    queries: number[][],
    keys: number[][],
    values: number[][],
    priorities: number[]
  ): AttentionOutput {
    // Get base attention
    const result = this.baseAttention.forward(queries, keys, values);

    // Boost attention weights based on priorities
    const boostedWeights = result.weights.map(row => {
      const boosted = row.map((w, i) => w * (1 + priorities[i] * this.priorityBoost));
      const sum = boosted.reduce((a, b) => a + b, 0);
      return boosted.map(w => w / sum); // Renormalize
    });

    // Recompute output with boosted weights
    const output = matmul(boostedWeights, values);

    return { output, weights: boostedWeights };
  }
}

// ============================================================================
// Tests
// ============================================================================

describe('Attention Mechanism', () => {
  // ============================================================================
  // Softmax Tests
  // ============================================================================

  describe('Softmax Function', () => {
    it('should produce probabilities that sum to 1', () => {
      const values = [1, 2, 3, 4, 5];
      const probs = softmax(values);

      const sum = probs.reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1, 5);
    });

    it('should produce all non-negative values', () => {
      const values = [-2, -1, 0, 1, 2];
      const probs = softmax(values);

      probs.forEach(p => expect(p).toBeGreaterThanOrEqual(0));
    });

    it('should give highest probability to highest value', () => {
      const values = [1, 5, 2, 3, 4];
      const probs = softmax(values);

      const maxProb = Math.max(...probs);
      expect(probs[1]).toBe(maxProb);
    });

    it('should handle uniform values', () => {
      const values = [1, 1, 1, 1];
      const probs = softmax(values);

      probs.forEach(p => expect(p).toBeCloseTo(0.25, 5));
    });

    it('should respect temperature parameter', () => {
      const values = [1, 2];

      const lowTemp = softmax(values, 0.5); // More peaked
      const highTemp = softmax(values, 2.0); // More uniform

      const diffLow = Math.abs(lowTemp[0] - lowTemp[1]);
      const diffHigh = Math.abs(highTemp[0] - highTemp[1]);

      expect(diffLow).toBeGreaterThan(diffHigh);
    });

    it('should handle single value', () => {
      const probs = softmax([5]);
      expect(probs[0]).toBe(1);
    });

    it('should handle very large values without overflow', () => {
      const values = [1000, 1001, 1002];
      const probs = softmax(values);

      const sum = probs.reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1, 5);
    });

    it('should handle very negative values', () => {
      const values = [-1000, -1001, -1002];
      const probs = softmax(values);

      const sum = probs.reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1, 5);
    });
  });

  // ============================================================================
  // Scaled Dot-Product Attention Tests
  // ============================================================================

  describe('Scaled Dot-Product Attention', () => {
    let attention: ScaledDotProductAttention;

    beforeEach(() => {
      attention = new ScaledDotProductAttention(4);
    });

    it('should compute attention output', () => {
      const queries = [[1, 0, 0, 0], [0, 1, 0, 0]];
      const keys = [[1, 0, 0, 0], [0, 1, 0, 0]];
      const values = [[1, 2], [3, 4]];

      const result = attention.forward(queries, keys, values);

      expect(result.output).toHaveLength(2);
      expect(result.output[0]).toHaveLength(2);
    });

    it('should produce normalized attention weights', () => {
      const queries = [[1, 0, 0, 0], [0, 1, 0, 0]];
      const keys = [[1, 0, 0, 0], [0, 1, 0, 0]];
      const values = [[1, 2], [3, 4]];

      const result = attention.forward(queries, keys, values);

      result.weights.forEach(row => {
        const sum = row.reduce((a, b) => a + b, 0);
        expect(sum).toBeCloseTo(1, 5);
      });
    });

    it('should attend to matching keys', () => {
      const queries = [[1, 0, 0, 0]];
      const keys = [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0]];
      const values = [[1, 0], [0, 1], [0, 0]];

      const result = attention.forward(queries, keys, values);

      // First key matches query best
      expect(result.weights[0][0]).toBeGreaterThan(result.weights[0][1]);
      expect(result.weights[0][0]).toBeGreaterThan(result.weights[0][2]);
    });

    it('should apply attention mask', () => {
      const queries = [[1, 0], [0, 1]];
      const keys = [[1, 0], [0, 1]];
      const values = [[1, 0], [0, 1]];
      const mask = [[false, true], [false, false]]; // Block position [0,1]

      const attentionWithMask = new ScaledDotProductAttention(2);
      const result = attentionWithMask.forward(queries, keys, values, mask);

      // Position [0,1] should have zero weight
      expect(result.weights[0][1]).toBeCloseTo(0, 5);
      // All weight goes to unmasked position
      expect(result.weights[0][0]).toBeCloseTo(1, 5);
    });

    it('should scale by sqrt(d_k)', () => {
      const keyDim = 64;
      const attention64 = new ScaledDotProductAttention(keyDim);

      const queries = [new Array(keyDim).fill(1)];
      const keys = [new Array(keyDim).fill(1)];
      const values = [[1]];

      // Should not throw due to large dot products
      const result = attention64.forward(queries, keys, values);
      expect(result.output).toBeDefined();
    });
  });

  // ============================================================================
  // Multi-Head Attention Tests
  // ============================================================================

  describe('Multi-Head Attention', () => {
    let multiHead: MultiHeadAttention;

    beforeEach(() => {
      multiHead = new MultiHeadAttention({
        numHeads: 4,
        keyDim: 8,
        valueDim: 8,
        dropoutRate: 0,
        temperature: Math.sqrt(8),
      });
    });

    it('should produce output with correct dimensions', () => {
      const seqLen = 5;
      const dim = 8;

      const queries = Array.from({ length: seqLen }, () =>
        Array.from({ length: dim }, () => Math.random())
      );
      const keys = Array.from({ length: seqLen }, () =>
        Array.from({ length: dim }, () => Math.random())
      );
      const values = Array.from({ length: seqLen }, () =>
        Array.from({ length: dim }, () => Math.random())
      );

      const result = multiHead.forward(queries, keys, values);

      expect(result.output).toHaveLength(seqLen);
      expect(result.output[0]).toHaveLength(dim);
    });

    it('should provide attention weights from all heads', () => {
      const queries = [[1, 0, 0, 0, 0, 0, 0, 0]];
      const keys = [[1, 0, 0, 0, 0, 0, 0, 0], [0, 1, 0, 0, 0, 0, 0, 0]];
      const values = [[1, 2, 3, 4, 5, 6, 7, 8], [8, 7, 6, 5, 4, 3, 2, 1]];

      const result = multiHead.forward(queries, keys, values);

      expect(result.headWeights).toBeDefined();
      expect(result.headWeights).toHaveLength(4); // 4 heads
    });

    it('should combine outputs from all heads', () => {
      const seqLen = 3;
      const dim = 8;

      const queries = Array.from({ length: seqLen }, () =>
        Array.from({ length: dim }, () => 1)
      );
      const keys = queries;
      const values = queries;

      const result = multiHead.forward(queries, keys, values);

      // Output should be defined and not all zeros
      expect(result.output.flat().some(v => v !== 0)).toBe(true);
    });

    it('should work with different numbers of heads', () => {
      const configs = [1, 2, 4, 8];

      configs.forEach(numHeads => {
        const mha = new MultiHeadAttention({
          numHeads,
          keyDim: 8,
          valueDim: 8,
          dropoutRate: 0,
          temperature: Math.sqrt(8),
        });

        const queries = [[1, 0, 0, 0, 0, 0, 0, 0]];
        const keys = [[1, 0, 0, 0, 0, 0, 0, 0]];
        const values = [[1, 2, 3, 4, 5, 6, 7, 8]];

        const result = mha.forward(queries, keys, values);
        expect(result.headWeights).toHaveLength(numHeads);
      });
    });
  });

  // ============================================================================
  // Priority Attention Tests
  // ============================================================================

  describe('Priority Attention', () => {
    let priorityAttention: PriorityAttention;

    beforeEach(() => {
      priorityAttention = new PriorityAttention(4, 2.0);
    });

    it('should boost attention on high-priority items', () => {
      const queries = [[1, 1, 1, 1]];
      const keys = [[1, 1, 1, 1], [1, 1, 1, 1]]; // Same keys
      const values = [[1, 0], [0, 1]];
      const priorities = [0.1, 0.9]; // Second item is high priority

      const result = priorityAttention.forward(queries, keys, values, priorities);

      // Second item should have more attention despite same key similarity
      expect(result.weights[0][1]).toBeGreaterThan(result.weights[0][0]);
    });

    it('should maintain normalized weights', () => {
      const queries = [[1, 0, 0, 0]];
      const keys = [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0]];
      const values = [[1, 0], [0, 1], [1, 1]];
      const priorities = [0.5, 0.8, 0.3];

      const result = priorityAttention.forward(queries, keys, values, priorities);

      const sum = result.weights[0].reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1, 5);
    });

    it('should handle zero priorities', () => {
      const queries = [[1, 1, 1, 1]];
      const keys = [[1, 1, 1, 1], [1, 1, 1, 1]];
      const values = [[1, 0], [0, 1]];
      const priorities = [0, 0];

      const result = priorityAttention.forward(queries, keys, values, priorities);

      // Should still produce valid output
      expect(result.output).toBeDefined();
      const sum = result.weights[0].reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1, 5);
    });

    it('should handle all-high priorities', () => {
      const queries = [[1, 1, 1, 1]];
      const keys = [[1, 1, 1, 1], [1, 1, 1, 1]];
      const values = [[1, 0], [0, 1]];
      const priorities = [1, 1];

      const result = priorityAttention.forward(queries, keys, values, priorities);

      // Should be roughly equal since priorities are the same
      expect(result.weights[0][0]).toBeCloseTo(result.weights[0][1], 1);
    });

    it('should respect priority boost parameter', () => {
      const queries = [[1, 1, 1, 1]];
      const keys = [[1, 1, 1, 1], [1, 1, 1, 1]];
      const values = [[1, 0], [0, 1]];
      const priorities = [0, 1];

      const lowBoost = new PriorityAttention(4, 0.5);
      const highBoost = new PriorityAttention(4, 5.0);

      const lowResult = lowBoost.forward(queries, keys, values, priorities);
      const highResult = highBoost.forward(queries, keys, values, priorities);

      // High boost should give more weight difference
      const lowDiff = Math.abs(lowResult.weights[0][0] - lowResult.weights[0][1]);
      const highDiff = Math.abs(highResult.weights[0][0] - highResult.weights[0][1]);

      expect(highDiff).toBeGreaterThan(lowDiff);
    });
  });

  // ============================================================================
  // ORACLE Integration Tests
  // ============================================================================

  describe('ORACLE Integration', () => {
    it('should focus attention on urgent signals', () => {
      const priorityAttention = new PriorityAttention(4, 3.0);

      // Simulate signals with urgency scores
      const signalEmbeddings = [
        [0.1, 0.2, 0.3, 0.4], // Low urgency signal
        [0.5, 0.6, 0.7, 0.8], // Medium urgency signal
        [0.9, 0.8, 0.7, 0.6], // High urgency signal
      ];

      const urgencyScores = [0.2, 0.5, 0.9];

      // Query represents current context
      const contextQuery = [[0.5, 0.5, 0.5, 0.5]];

      const result = priorityAttention.forward(
        contextQuery,
        signalEmbeddings,
        signalEmbeddings,
        urgencyScores
      );

      // High urgency signal should get most attention
      expect(result.weights[0][2]).toBeGreaterThan(result.weights[0][0]);
      expect(result.weights[0][2]).toBeGreaterThan(result.weights[0][1]);
    });

    it('should aggregate decision factors using attention', () => {
      const multiHead = new MultiHeadAttention({
        numHeads: 2,
        keyDim: 4,
        valueDim: 4,
        dropoutRate: 0,
        temperature: 2,
      });

      // Decision factors
      const factors = [
        [1, 0, 0, 0], // Cost factor
        [0, 1, 0, 0], // Time factor
        [0, 0, 1, 0], // Risk factor
        [0, 0, 0, 1], // Quality factor
      ];

      // Query represents decision criteria weights
      const criteria = [[0.3, 0.3, 0.2, 0.2]];

      const result = multiHead.forward(criteria, factors, factors);

      // Output should be weighted combination
      expect(result.output).toHaveLength(1);
      expect(result.output[0]).toHaveLength(4);
    });

    it('should handle temporal attention for action sequences', () => {
      const attention = new ScaledDotProductAttention(4);

      // Temporal sequence of actions
      const actions = [
        [1, 0, 0, 0], // Past action 1
        [0, 1, 0, 0], // Past action 2
        [0, 0, 1, 0], // Current action
      ];

      // Current state as query
      const currentState = [[0, 0, 1, 0]];

      // Causal mask - can't attend to future
      const causalMask = [[false, false, false]];

      const result = attention.forward(
        currentState,
        actions,
        actions,
        causalMask
      );

      // Should produce valid attention pattern
      expect(result.weights[0].reduce((a, b) => a + b)).toBeCloseTo(1, 5);
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle single position sequence', () => {
      const attention = new ScaledDotProductAttention(4);

      const queries = [[1, 2, 3, 4]];
      const keys = [[1, 2, 3, 4]];
      const values = [[5, 6, 7, 8]];

      const result = attention.forward(queries, keys, values);

      expect(result.weights[0][0]).toBe(1);
      expect(result.output[0]).toEqual([5, 6, 7, 8]);
    });

    it('should handle zero vectors', () => {
      const attention = new ScaledDotProductAttention(4);

      const queries = [[0, 0, 0, 0]];
      const keys = [[0, 0, 0, 0], [1, 0, 0, 0]];
      const values = [[1, 2], [3, 4]];

      const result = attention.forward(queries, keys, values);

      // Should still produce valid output
      expect(result.output).toBeDefined();
      expect(isFinite(result.output[0][0])).toBe(true);
    });

    it('should handle very small key dimension', () => {
      const attention = new ScaledDotProductAttention(1);

      const queries = [[1]];
      const keys = [[1], [2]];
      const values = [[10], [20]];

      const result = attention.forward(queries, keys, values);

      expect(result.output).toHaveLength(1);
    });

    it('should handle large sequences', () => {
      const attention = new ScaledDotProductAttention(8);
      const seqLen = 100;
      const dim = 8;

      const queries = Array.from({ length: seqLen }, () =>
        Array.from({ length: dim }, () => Math.random())
      );
      const keys = queries;
      const values = queries;

      const result = attention.forward(queries, keys, values);

      expect(result.output).toHaveLength(seqLen);
      result.weights.forEach(row => {
        const sum = row.reduce((a, b) => a + b, 0);
        expect(sum).toBeCloseTo(1, 3);
      });
    });
  });
});
