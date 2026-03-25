/**
 * Contextual Bandit — LinUCB Algorithm
 * SOTA context-aware decision optimization.
 *
 * Unlike standard MAB which treats each arm independently,
 * contextual bandits use FEATURES of the current situation to make
 * better arm selections. LinUCB assumes linear reward-context dependency.
 *
 * Use cases in ORACLE:
 * - Context-aware task prioritization (time of day, energy, deadline proximity)
 * - Adaptive notification timing (user activity, focus state, location)
 * - Personalized decision strategy selection (based on decision type, stakes, time pressure)
 *
 * Reference: "A Contextual-Bandit Approach to Personalized News Article Recommendation"
 * Li et al., 2010 (WWW). This is the LinUCB algorithm used by Yahoo! News.
 */

// ── Types ──────────────────────────────────────────────

export interface ContextualArm {
  id: string;
  name: string;
  /** d×d matrix A = D^T D + I (feature outer products + identity) */
  A: number[][];
  /** d×1 vector b = D^T c (feature × reward sum) */
  b: number[];
  pulls: number;
  totalReward: number;
  metadata?: Record<string, unknown>;
}

export interface ContextualBanditConfig {
  /** Exploration parameter alpha (default: 1.0, higher = more exploration) */
  alpha?: number;
  /** Number of context features (MUST match context vectors length) */
  dimensions: number;
}

export interface ContextualSelection {
  arm: ContextualArm;
  score: number;
  /** Estimated reward (exploitation component) */
  expectedReward: number;
  /** Confidence width (exploration component) */
  confidenceWidth: number;
  context: number[];
}

// ── Matrix Utilities (minimal, no external deps) ───────

function identity(d: number): number[][] {
  const I: number[][] = [];
  for (let i = 0; i < d; i++) {
    I[i] = new Array(d).fill(0);
    I[i]![i] = 1;
  }
  return I;
}

function zeros(d: number): number[] {
  return new Array(d).fill(0);
}

function matAdd(A: number[][], B: number[][]): number[][] {
  return A.map((row, i) => row.map((val, j) => val + B[i]![j]!));
}

function outerProduct(a: number[], b: number[]): number[][] {
  return a.map((ai) => b.map((bj) => ai * bj));
}

function vecAdd(a: number[], b: number[]): number[] {
  return a.map((ai, i) => ai + b[i]!);
}

function vecScale(a: number[], s: number): number[] {
  return a.map((ai) => ai * s);
}

function matVecMul(A: number[][], x: number[]): number[] {
  return A.map((row) => row.reduce((sum, val, j) => sum + val * x[j]!, 0));
}

function dot(a: number[], b: number[]): number {
  return a.reduce((sum, ai, i) => sum + ai * b[i]!, 0);
}

/**
 * Solve Ax = b using Cholesky decomposition.
 * A must be symmetric positive definite (which A_a always is due to identity init).
 */
function choleskySolve(A: number[][], b: number[]): number[] {
  const n = A.length;

  // Cholesky decomposition: A = L * L^T
  const L: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = 0;
      for (let k = 0; k < j; k++) {
        sum += L[i]![k]! * L[j]![k]!;
      }
      if (i === j) {
        const val = A[i]![i]! - sum;
        L[i]![j] = Math.sqrt(Math.max(val, 1e-12));
      } else {
        L[i]![j] = (A[i]![j]! - sum) / L[j]![j]!;
      }
    }
  }

  // Forward substitution: L * y = b
  const y = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let j = 0; j < i; j++) {
      sum += L[i]![j]! * y[j]!;
    }
    y[i] = (b[i]! - sum) / L[i]![i]!;
  }

  // Back substitution: L^T * x = y
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = 0;
    for (let j = i + 1; j < n; j++) {
      sum += L[j]![i]! * x[j]!;
    }
    x[i] = (y[i]! - sum) / L[i]![i]!;
  }

  return x;
}

/**
 * Compute x^T A^{-1} x efficiently using Cholesky.
 * Returns the quadratic form without explicitly computing A^{-1}.
 */
function quadraticForm(A: number[][], x: number[]): number {
  const Ainv_x = choleskySolve(A, x);
  return dot(x, Ainv_x);
}

// ── LinUCB Service ─────────────────────────────────────

export class ContextualBanditService {
  private arms: Map<string, ContextualArm> = new Map();
  private config: Required<ContextualBanditConfig>;

  constructor(config: ContextualBanditConfig) {
    this.config = {
      alpha: config.alpha ?? 1.0,
      dimensions: config.dimensions,
    };
  }

  /**
   * Add a new arm.
   * Initializes A = I_d (identity) and b = 0_d (zeros).
   */
  addArm(id: string, name: string, metadata?: Record<string, unknown>): void {
    if (this.arms.has(id)) {
      throw new Error(`Arm "${id}" already exists`);
    }

    this.arms.set(id, {
      id,
      name,
      A: identity(this.config.dimensions),
      b: zeros(this.config.dimensions),
      pulls: 0,
      totalReward: 0,
      metadata,
    });
  }

  /**
   * Select the best arm given the current context using LinUCB.
   *
   * For each arm a:
   *   θ_a = A_a^{-1} b_a          (estimated reward coefficients)
   *   p_a = θ_a^T x + α √(x^T A_a^{-1} x)   (UCB score)
   *
   * Select arm with highest p_a.
   *
   * @param context - Feature vector of length `dimensions` describing current situation
   */
  selectArm(context: number[]): ContextualSelection {
    if (context.length !== this.config.dimensions) {
      throw new Error(
        `Context dimension mismatch: expected ${this.config.dimensions}, got ${context.length}`,
      );
    }

    if (this.arms.size === 0) {
      throw new Error("No arms available");
    }

    let bestArm: ContextualArm | null = null;
    let bestScore = -Infinity;
    let bestExpected = 0;
    let bestWidth = 0;

    for (const arm of this.arms.values()) {
      // θ_a = A_a^{-1} b_a
      const theta = choleskySolve(arm.A, arm.b);

      // Expected reward: θ_a^T x
      const expectedReward = dot(theta, context);

      // Confidence width: α √(x^T A_a^{-1} x)
      const confidenceWidth = this.config.alpha * Math.sqrt(quadraticForm(arm.A, context));

      // UCB score
      const score = expectedReward + confidenceWidth;

      if (score > bestScore) {
        bestScore = score;
        bestArm = arm;
        bestExpected = expectedReward;
        bestWidth = confidenceWidth;
      }
    }

    return {
      arm: bestArm!,
      score: bestScore,
      expectedReward: bestExpected,
      confidenceWidth: bestWidth,
      context,
    };
  }

  /**
   * Record reward for an arm given the context it was shown.
   *
   * Updates:
   *   A_a ← A_a + x x^T    (add outer product of context)
   *   b_a ← b_a + r x       (add reward-scaled context)
   *
   * @param armId - The arm that was selected
   * @param reward - Observed reward (0-1 recommended, but any value works)
   * @param context - The SAME context vector used in selectArm()
   */
  recordReward(armId: string, reward: number, context: number[]): void {
    const arm = this.arms.get(armId);
    if (!arm) throw new Error(`Arm "${armId}" not found`);

    if (context.length !== this.config.dimensions) {
      throw new Error(
        `Context dimension mismatch: expected ${this.config.dimensions}, got ${context.length}`,
      );
    }

    // A_a ← A_a + x x^T
    arm.A = matAdd(arm.A, outerProduct(context, context));

    // b_a ← b_a + r * x
    arm.b = vecAdd(arm.b, vecScale(context, reward));

    arm.pulls++;
    arm.totalReward += reward;
  }

  /**
   * Get the learned weight vector for an arm.
   * θ_a = A_a^{-1} b_a
   */
  getWeights(armId: string): number[] {
    const arm = this.arms.get(armId);
    if (!arm) throw new Error(`Arm "${armId}" not found`);
    return choleskySolve(arm.A, arm.b);
  }

  /**
   * Predict reward for a specific arm + context without selecting.
   */
  predict(armId: string, context: number[]): { expected: number; confidence: number } {
    const arm = this.arms.get(armId);
    if (!arm) throw new Error(`Arm "${armId}" not found`);

    const theta = choleskySolve(arm.A, arm.b);
    const expected = dot(theta, context);
    const confidence = this.config.alpha * Math.sqrt(quadraticForm(arm.A, context));

    return { expected, confidence };
  }

  getArms(): ContextualArm[] {
    return Array.from(this.arms.values());
  }

  /**
   * Export state for persistence (matrices + stats).
   */
  exportState(): {
    arms: Array<{ id: string; name: string; A: number[][]; b: number[]; pulls: number; totalReward: number; metadata?: Record<string, unknown> }>;
    config: Required<ContextualBanditConfig>;
  } {
    return {
      arms: Array.from(this.arms.values()).map((arm) => ({
        id: arm.id,
        name: arm.name,
        A: arm.A,
        b: arm.b,
        pulls: arm.pulls,
        totalReward: arm.totalReward,
        metadata: arm.metadata,
      })),
      config: { ...this.config },
    };
  }

  /**
   * Import previously exported state.
   */
  importState(state: ReturnType<ContextualBanditService["exportState"]>): void {
    this.arms.clear();
    this.config = { ...state.config };
    for (const arm of state.arms) {
      this.arms.set(arm.id, { ...arm });
    }
  }
}

export function createContextualBandit(config: ContextualBanditConfig): ContextualBanditService {
  return new ContextualBanditService(config);
}

// ── Example: Task Prioritization Context ───────────────
//
// Dimensions = 6:
//   [0] timeOfDay       (0=midnight, 0.5=noon, 1=midnight)
//   [1] energyLevel     (0=exhausted, 1=peak)
//   [2] deadlineUrgency (0=no deadline, 1=overdue)
//   [3] taskComplexity  (0=trivial, 1=very complex)
//   [4] focusState      (0=distracted, 1=deep focus)
//   [5] dayOfWeek       (0=Mon, 1=Sun, normalized 0-1)
//
// Arms = decision strategies:
//   "deep-work"     — tackle hardest task first
//   "quick-wins"    — clear easy tasks to build momentum
//   "deadline-first" — prioritize by deadline urgency
//   "energy-match"  — match task complexity to energy
//   "delegate"      — delegate or defer
//
// Reward = user satisfaction × completion rate (0-1)
