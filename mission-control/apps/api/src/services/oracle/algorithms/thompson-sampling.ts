/**
 * Thompson Sampling Contextual Bandit (20th algorithm)
 *
 * Posterior-sampling counterpart to LinUCB. Maintains a Bayesian posterior
 * N(μ_a, v² Σ_a) over linear reward weights for each arm, and on every
 * selection step draws a Gaussian sample θ_a, picks the arm with the
 * largest x^T θ_a.
 *
 * Reference: Agrawal & Goyal, "Thompson Sampling for Contextual Bandits with
 * Linear Payoffs", ICML 2013. We track the precision matrix directly
 * (B = Σ^{-1}) and the sufficient statistic f = Σ x_t r_t, so the posterior
 * mean is μ = B^{-1} f and the covariance is v² B^{-1}.
 *
 * Why both LinUCB and Thompson Sampling? LinUCB is deterministic and gives
 * tighter finite-sample regret bounds in theory; Thompson Sampling tends to
 * win on real datasets (Chapelle & Li, NeurIPS 2011) and stochastically
 * diversifies exploration — handy when the reward distribution is highly
 * non-linear and the point estimate of θ is unreliable early on.
 *
 * Zero external deps — pure TypeScript Cholesky, forward/back substitution,
 * and Box-Muller for Gaussian draws (Math.random-only fallback avoids the
 * jstat import cycle in this module).
 */

// ── Types ──────────────────────────────────────────────────

/**
 * Per-arm posterior over the linear reward weights.
 *
 * We store the precision matrix `SigmaInv` (B in the paper) and the
 * sufficient statistic `b = Σ r_t x_t`. The posterior mean μ and
 * covariance Σ can be reconstructed on demand via Cholesky, so updates
 * remain numerically stable over long histories.
 */
export interface ThompsonArm {
  id: string;
  /** Running mean estimate: μ = SigmaInv^{-1} b  (d-dimensional) */
  mu: number[];
  /** Precision matrix B = λI + Σ x x^T  (d × d, symmetric PD) */
  SigmaInv: number[][];
  /** Sufficient statistic f = Σ r x  (d-dimensional) */
  b: number[];
  /** Number of times this arm has been played */
  pulls: number;
  /** Cumulative reward observed for this arm */
  totalReward: number;
  metadata?: Record<string, unknown>;
}

export interface ThompsonSamplingState {
  arms: ThompsonArm[];
  /** Context dimension */
  d: number;
  /** Exploration constant (posterior scale). Default 1.0. */
  v: number;
}

export interface ThompsonSelection {
  armId: string;
  /** The sampled x^T θ_a that won the argmax */
  sampledReward: number;
  /** Sampled θ_a for the winning arm (for debugging / introspection) */
  sampledTheta: number[];
  context: number[];
}

// ── Matrix Utilities (self-contained, same style as LinUCB) ─

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

function cloneMatrix(A: number[][]): number[][] {
  return A.map((row) => row.slice());
}

function cloneArm(arm: ThompsonArm): ThompsonArm {
  return {
    id: arm.id,
    mu: arm.mu.slice(),
    SigmaInv: cloneMatrix(arm.SigmaInv),
    b: arm.b.slice(),
    pulls: arm.pulls,
    totalReward: arm.totalReward,
    metadata: arm.metadata ? { ...arm.metadata } : undefined,
  };
}

function dot(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i]! * b[i]!;
  return sum;
}

/**
 * In-place rank-1 update  A ← A + x x^T.
 * Symmetric, so we only need to touch the upper triangle and mirror.
 */
function addOuterProduct(A: number[][], x: number[]): void {
  const d = x.length;
  for (let i = 0; i < d; i++) {
    for (let j = i; j < d; j++) {
      const delta = x[i]! * x[j]!;
      A[i]![j] = A[i]![j]! + delta;
      if (i !== j) A[j]![i] = A[j]![i]! + delta;
    }
  }
}

/**
 * Cholesky factorisation A = L L^T for symmetric positive-definite A.
 *
 * Used for both (a) solving A x = b and (b) multivariate normal sampling —
 * if z is a vector of i.i.d. standard normals then L z has covariance A.
 */
export function cholesky(A: number[][]): number[][] {
  const n = A.length;
  const L: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = 0;
      for (let k = 0; k < j; k++) {
        sum += L[i]![k]! * L[j]![k]!;
      }
      if (i === j) {
        // Small floor prevents sqrt(0) / NaN if numerics go sideways.
        const val = A[i]![i]! - sum;
        L[i]![j] = Math.sqrt(Math.max(val, 1e-12));
      } else {
        L[i]![j] = (A[i]![j]! - sum) / L[j]![j]!;
      }
    }
  }

  return L;
}

/**
 * Solve A x = b using a precomputed Cholesky L of A.
 */
function choleskySolveWithL(L: number[][], b: number[]): number[] {
  const n = L.length;
  // Forward substitution: L y = b
  const y = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let j = 0; j < i; j++) sum += L[i]![j]! * y[j]!;
    y[i] = (b[i]! - sum) / L[i]![i]!;
  }
  // Back substitution: L^T x = y
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = 0;
    for (let j = i + 1; j < n; j++) sum += L[j]![i]! * x[j]!;
    x[i] = (y[i]! - sum) / L[i]![i]!;
  }
  return x;
}

function choleskySolve(A: number[][], b: number[]): number[] {
  return choleskySolveWithL(cholesky(A), b);
}

/**
 * Box-Muller transform: convert two U(0,1) draws into two i.i.d. N(0,1) draws.
 * Math.random is seedable only via a patched global; tests that need
 * reproducibility pass an RNG through the config.
 */
function standardNormal(rng: () => number): number {
  let u1 = rng();
  const u2 = rng();
  // Avoid log(0).
  if (u1 < 1e-12) u1 = 1e-12;
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function sampleStandardNormalVector(d: number, rng: () => number): number[] {
  const z = new Array<number>(d);
  for (let i = 0; i < d; i++) z[i] = standardNormal(rng);
  return z;
}

/**
 * Draw θ ~ N(μ, (v²) Σ) where Σ = B^{-1}.
 *
 * Trick: if L L^T = B then (L^{-T}) z has covariance B^{-1}. So we
 * forward-substitute z through L^T to get w and then return μ + v · w.
 *
 * Equivalent to: solve L^T w = z, output μ + v w.
 */
export function sampleMultivariateNormal(
  mu: number[],
  SigmaInv: number[][],
  v: number,
  rng: () => number = Math.random,
): number[] {
  const d = mu.length;
  const L = cholesky(SigmaInv);
  const z = sampleStandardNormalVector(d, rng);

  // Back substitution L^T w = z.
  const w = new Array(d).fill(0);
  for (let i = d - 1; i >= 0; i--) {
    let sum = 0;
    for (let j = i + 1; j < d; j++) sum += L[j]![i]! * w[j]!;
    w[i] = (z[i]! - sum) / L[i]![i]!;
  }

  const theta = new Array<number>(d);
  for (let i = 0; i < d; i++) theta[i] = mu[i]! + v * w[i]!;
  return theta;
}

// ── Public API ──────────────────────────────────────────────

/**
 * Initialise a fresh Thompson Sampling state over `armIds` with context
 * dimension `d`. Each arm starts with a standard normal prior μ = 0,
 * Σ^{-1} = I (so covariance is the identity — maximally uncertain within
 * the scale controlled by `v`).
 *
 * @param armIds Non-empty list of arm identifiers.
 * @param d Context dimension. Must match all future context vectors.
 * @param v Posterior scale / exploration constant. Higher = more exploration.
 *          Default 1.0 which matches Agrawal & Goyal's prior variance.
 */
export function initThompsonSampling(
  armIds: string[],
  d: number,
  v: number = 1.0,
): ThompsonSamplingState {
  if (!Array.isArray(armIds) || armIds.length === 0) {
    throw new Error("Thompson Sampling requires at least one arm");
  }
  if (!Number.isInteger(d) || d <= 0) {
    throw new Error(`Context dimension must be a positive integer, got ${d}`);
  }
  if (!(v > 0) || !Number.isFinite(v)) {
    throw new Error(`Exploration constant v must be a positive finite number, got ${v}`);
  }

  const seen = new Set<string>();
  const arms: ThompsonArm[] = armIds.map((id) => {
    if (seen.has(id)) {
      throw new Error(`Duplicate arm id "${id}"`);
    }
    seen.add(id);
    return {
      id,
      mu: zeros(d),
      SigmaInv: identity(d),
      b: zeros(d),
      pulls: 0,
      totalReward: 0,
    };
  });

  return { arms, d, v };
}

/**
 * Select the next arm by drawing one θ_a ~ N(μ_a, v² Σ_a) per arm,
 * then taking the arm with the largest x^T θ_a. This is the core of
 * Thompson Sampling: exploration emerges naturally from posterior
 * uncertainty rather than from a deterministic confidence bonus.
 *
 * @throws if the context dimension does not match the state, or if the
 *         state contains no arms.
 */
export function selectArm(
  state: ThompsonSamplingState,
  context: number[],
  rng: () => number = Math.random,
): ThompsonSelection {
  if (context.length !== state.d) {
    throw new Error(
      `Context dimension mismatch: expected ${state.d}, got ${context.length}`,
    );
  }
  if (state.arms.length === 0) {
    throw new Error("No arms available");
  }

  let bestArmId = state.arms[0]!.id;
  let bestReward = -Infinity;
  let bestTheta: number[] = [];

  for (const arm of state.arms) {
    const theta = sampleMultivariateNormal(arm.mu, arm.SigmaInv, state.v, rng);
    const sampledReward = dot(context, theta);
    if (sampledReward > bestReward) {
      bestReward = sampledReward;
      bestArmId = arm.id;
      bestTheta = theta;
    }
  }

  return {
    armId: bestArmId,
    sampledReward: bestReward,
    sampledTheta: bestTheta,
    context,
  };
}

/**
 * Bayesian update after observing reward `r` for `armId` in `context`.
 *
 * Update rules (conjugate Gaussian–Gaussian linear model):
 *   B_new  = B_old  + x x^T
 *   f_new  = f_old  + r x
 *   μ_new  = B_new^{-1} f_new
 *
 * Returns a *new* state — the existing state is not mutated so callers
 * can safely share immutable snapshots across requests.
 */
export function updateThompsonSampling(
  state: ThompsonSamplingState,
  armId: string,
  context: number[],
  reward: number,
): ThompsonSamplingState {
  if (context.length !== state.d) {
    throw new Error(
      `Context dimension mismatch: expected ${state.d}, got ${context.length}`,
    );
  }
  if (!Number.isFinite(reward)) {
    throw new Error(`Reward must be a finite number, got ${reward}`);
  }

  const idx = state.arms.findIndex((a) => a.id === armId);
  if (idx === -1) {
    throw new Error(`Arm "${armId}" not found`);
  }

  const nextArms = state.arms.map((a, i) => (i === idx ? cloneArm(a) : a));
  const arm = nextArms[idx]!;

  addOuterProduct(arm.SigmaInv, context);
  for (let i = 0; i < state.d; i++) {
    arm.b[i] = arm.b[i]! + reward * context[i]!;
  }
  arm.mu = choleskySolve(arm.SigmaInv, arm.b);
  arm.pulls += 1;
  arm.totalReward += reward;

  return { arms: nextArms, d: state.d, v: state.v };
}

/**
 * Single-shot convenience: replay a history of trials and then select the
 * next arm for the given context. Useful for stateless HTTP clients.
 */
export function recommend(
  armIds: string[],
  d: number,
  history: Array<{ armId: string; context: number[]; reward: number }>,
  context: number[],
  v: number = 1.0,
  rng: () => number = Math.random,
): { armId: string; sampledReward: number; state: ThompsonSamplingState } {
  let state = initThompsonSampling(armIds, d, v);
  for (const trial of history) {
    state = updateThompsonSampling(state, trial.armId, trial.context, trial.reward);
  }
  const choice = selectArm(state, context, rng);
  return { armId: choice.armId, sampledReward: choice.sampledReward, state };
}

/**
 * Read-only posterior mean for an arm (μ_a). Convenience for analytics
 * dashboards that want to surface "what does the model think the best
 * weights are right now?" without kicking a stochastic sample.
 */
export function getPosteriorMean(state: ThompsonSamplingState, armId: string): number[] {
  const arm = state.arms.find((a) => a.id === armId);
  if (!arm) throw new Error(`Arm "${armId}" not found`);
  return arm.mu.slice();
}
