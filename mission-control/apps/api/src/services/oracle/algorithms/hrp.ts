/**
 * Hierarchical Risk Parity (HRP) — 21st algorithm
 *
 * Portfolio-construction algorithm that allocates capital across N assets
 * by exploiting the hierarchical structure of their correlation matrix
 * rather than inverting a covariance matrix (Markowitz, 1952). HRP is
 * numerically stable on ill-conditioned covariance matrices, requires no
 * expected-return estimate, and produces diversified weights even when
 * assets are highly collinear — all situations where classical mean-
 * variance optimisation breaks down.
 *
 * Reference: Marcos López de Prado, "Building Diversified Portfolios that
 * Outperform Out-of-Sample", Journal of Portfolio Management (2016).
 *
 * The algorithm proceeds in three stages:
 *
 *   1. Tree Clustering
 *      Compute the correlation matrix C of asset returns, convert to a
 *      distance metric d(i,j) = sqrt(0.5 * (1 - C(i,j))) which is a valid
 *      metric on the unit sphere, and run single-linkage agglomerative
 *      clustering to produce a binary tree.
 *
 *   2. Quasi-Diagonalisation
 *      Reorder the rows/cols of C so that similar assets sit next to each
 *      other — i.e. walk the tree in DFS order. This has the effect of
 *      concentrating mass on the diagonal of C so that local cluster
 *      variance is well-defined.
 *
 *   3. Recursive Bisection
 *      Starting from the full ordered list, repeatedly split each subset
 *      in half and allocate inversely proportional to the *cluster
 *      variance* w_cluster^T Σ w_cluster where w_cluster is the inverse-
 *      variance portfolio inside that subset. This is the "risk parity"
 *      step: each branch of the tree gets a risk allocation inversely
 *      proportional to its own variance.
 *
 * Zero external deps — all linear algebra is hand-rolled, same style as
 * thompson-sampling.ts and cmaes.ts. Runtime is O(N^3) dominated by the
 * single-linkage loop; 10 assets complete in well under 1 ms.
 */

// ── Types ────────────────────────────────────────────────────

/**
 * Binary tree node produced by the clustering stage. Leaf nodes carry an
 * `assetIndex` into the original returns matrix; internal nodes carry
 * `left` / `right` children plus the distance at which the merge happened
 * (useful for visualisation and cluster-count thresholding).
 */
export interface ClusterNode {
  /** Unique incrementing id — leaves get their asset index, internals get >= N */
  id: number;
  /** Leaf only — index into the input `assetIds` array */
  assetIndex?: number;
  /** Leaf only — mirror of `assetIds[assetIndex]` for ease of consumption */
  assetId?: string;
  /** Internal nodes */
  left?: ClusterNode;
  right?: ClusterNode;
  /** Distance at which this merge happened (0 for leaves) */
  distance: number;
  /** Number of leaves reachable under this node */
  size: number;
}

export interface HRPInput {
  /** T rows (time), N cols (assets). Each row is one period's returns. */
  returns: number[][];
  /** Length-N asset identifiers aligned with the columns of `returns`. */
  assetIds: string[];
}

export interface HRPOutput {
  /** Portfolio weights, keyed by asset id. Sums to 1.0. */
  weights: Record<string, number>;
  /** Root of the hierarchical cluster tree. */
  clusterTree: ClusterNode;
  /** Asset ids in quasi-diagonal order (DFS leaf order). */
  quasiDiagOrder: string[];
}

// ── Statistics helpers ───────────────────────────────────────

function mean(xs: number[]): number {
  let s = 0;
  for (let i = 0; i < xs.length; i++) s += xs[i]!;
  return s / xs.length;
}

/**
 * Column-wise sample variance (Bessel-corrected for T > 1).
 * Falls back to a small floor for constant columns so that inverse-
 * variance weighting cannot divide by zero.
 */
function variance(xs: number[]): number {
  const n = xs.length;
  if (n < 2) return 1e-12;
  const m = mean(xs);
  let s = 0;
  for (let i = 0; i < n; i++) {
    const d = xs[i]! - m;
    s += d * d;
  }
  const v = s / (n - 1);
  return v < 1e-12 ? 1e-12 : v;
}

/**
 * Correlation matrix of an N-column returns matrix using the standard
 * Pearson estimator. Returns an N×N symmetric matrix with 1's on the
 * diagonal. Constant columns (zero variance) are treated as uncorrelated
 * with everything else so the downstream distance metric stays finite.
 */
export function correlationMatrix(returns: number[][]): number[][] {
  const T = returns.length;
  if (T === 0) {
    throw new Error("Cannot compute correlation on empty returns matrix");
  }
  const N = returns[0]!.length;
  if (N === 0) {
    throw new Error("Returns matrix must have at least one asset column");
  }

  // Column means
  const means = new Array<number>(N).fill(0);
  for (let t = 0; t < T; t++) {
    const row = returns[t]!;
    if (row.length !== N) {
      throw new Error(`Row ${t} has length ${row.length}, expected ${N}`);
    }
    for (let i = 0; i < N; i++) means[i]! += row[i]!;
  }
  for (let i = 0; i < N; i++) means[i]! /= T;

  // Column standard deviations (sample, Bessel-corrected when T > 1)
  const stds = new Array<number>(N).fill(0);
  for (let t = 0; t < T; t++) {
    const row = returns[t]!;
    for (let i = 0; i < N; i++) {
      const d = row[i]! - means[i]!;
      stds[i]! += d * d;
    }
  }
  const denom = T > 1 ? T - 1 : 1;
  for (let i = 0; i < N; i++) {
    stds[i] = Math.sqrt(stds[i]! / denom);
  }

  // Pearson correlation
  const C: number[][] = Array.from({ length: N }, () => new Array(N).fill(0));
  for (let i = 0; i < N; i++) C[i]![i] = 1;

  for (let i = 0; i < N; i++) {
    for (let j = i + 1; j < N; j++) {
      if (stds[i]! < 1e-12 || stds[j]! < 1e-12) {
        // Constant column — treat as zero-correlation so distance is finite.
        C[i]![j] = 0;
        C[j]![i] = 0;
        continue;
      }
      let cov = 0;
      for (let t = 0; t < T; t++) {
        cov += (returns[t]![i]! - means[i]!) * (returns[t]![j]! - means[j]!);
      }
      cov /= denom;
      let corr = cov / (stds[i]! * stds[j]!);
      // Numerical clipping — Pearson is bounded in [-1, 1] analytically.
      if (corr > 1) corr = 1;
      if (corr < -1) corr = -1;
      C[i]![j] = corr;
      C[j]![i] = corr;
    }
  }
  return C;
}

/**
 * Column-wise variances of a returns matrix. Exposed publicly because the
 * recursive-bisection stage needs it alongside the correlation matrix.
 */
export function columnVariances(returns: number[][]): number[] {
  const T = returns.length;
  const N = returns[0]!.length;
  const vars = new Array<number>(N).fill(0);
  for (let j = 0; j < N; j++) {
    const col = new Array<number>(T);
    for (let t = 0; t < T; t++) col[t] = returns[t]![j]!;
    vars[j] = variance(col);
  }
  return vars;
}

/**
 * Build the covariance matrix Σ = diag(σ) C diag(σ) from a correlation
 * matrix and a vector of column variances. Using the decomposition is
 * numerically friendlier than recomputing cov directly when variances
 * have very different magnitudes.
 */
export function covarianceFromCorr(corr: number[][], variances: number[]): number[][] {
  const N = corr.length;
  const stds = variances.map((v) => Math.sqrt(v));
  const cov: number[][] = Array.from({ length: N }, () => new Array(N).fill(0));
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      cov[i]![j] = corr[i]![j]! * stds[i]! * stds[j]!;
    }
  }
  return cov;
}

// ── Stage 1: Single-Linkage Hierarchical Clustering ──────────

/**
 * Convert a correlation matrix into López de Prado's distance metric:
 *   d(i,j) = sqrt(0.5 * (1 - corr(i,j)))
 *
 * This is a proper metric on the unit sphere of return vectors. Zero
 * distance means perfectly correlated; sqrt(1) = 1 means perfectly
 * anti-correlated; sqrt(0.5) ≈ 0.707 means uncorrelated.
 */
export function correlationDistance(corr: number[][]): number[][] {
  const N = corr.length;
  const D: number[][] = Array.from({ length: N }, () => new Array(N).fill(0));
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const arg = 0.5 * (1 - corr[i]![j]!);
      D[i]![j] = Math.sqrt(Math.max(arg, 0));
    }
  }
  return D;
}

/**
 * Single-linkage agglomerative clustering. On each step we find the
 * closest pair of active clusters and merge them; the distance from the
 * new cluster to every other cluster is the *minimum* of the two old
 * distances (definition of single linkage). Worst case O(N^3) which is
 * fine for portfolio sizes — HRP is aimed at hundreds of assets, not
 * millions.
 *
 * Returns the root of the resulting binary tree, preserving original
 * asset indices on the leaves.
 */
export function singleLinkage(distance: number[][], assetIds: string[]): ClusterNode {
  const N = distance.length;
  if (N === 0) {
    throw new Error("Cannot cluster an empty distance matrix");
  }
  if (N === 1) {
    return {
      id: 0,
      assetIndex: 0,
      assetId: assetIds[0]!,
      distance: 0,
      size: 1,
    };
  }

  // Active cluster set. We store ClusterNode by row index, and maintain a
  // mutable distance matrix over those same indices. Deactivated rows get
  // set to Infinity so they're never picked as argmin.
  const active: (ClusterNode | null)[] = assetIds.map((id, i) => ({
    id: i,
    assetIndex: i,
    assetId: id,
    distance: 0,
    size: 1,
  }));

  // Clone the distance matrix — we mutate it in place.
  const D: number[][] = distance.map((row) => row.slice());
  let nextId = N;

  for (let step = 0; step < N - 1; step++) {
    // Find the closest pair (i, j), i < j, both still active.
    let bestI = -1;
    let bestJ = -1;
    let bestD = Infinity;
    for (let i = 0; i < N; i++) {
      if (active[i] === null) continue;
      for (let j = i + 1; j < N; j++) {
        if (active[j] === null) continue;
        if (D[i]![j]! < bestD) {
          bestD = D[i]![j]!;
          bestI = i;
          bestJ = j;
        }
      }
    }

    if (bestI === -1) break; // Should never happen if N >= 2.

    const left = active[bestI]!;
    const right = active[bestJ]!;
    const merged: ClusterNode = {
      id: nextId++,
      left,
      right,
      distance: bestD,
      size: left.size + right.size,
    };

    // Single linkage: new distance to cluster k is min(D[bestI][k], D[bestJ][k]).
    for (let k = 0; k < N; k++) {
      if (k === bestI || k === bestJ || active[k] === null) continue;
      const newD = Math.min(D[bestI]![k]!, D[bestJ]![k]!);
      D[bestI]![k] = newD;
      D[k]![bestI] = newD;
    }

    // Replace cluster bestI with the merge, deactivate bestJ.
    active[bestI] = merged;
    active[bestJ] = null;
    // Block anyone from re-picking j.
    for (let k = 0; k < N; k++) {
      D[bestJ]![k] = Infinity;
      D[k]![bestJ] = Infinity;
    }
  }

  // The single remaining active cluster is the root.
  const root = active.find((c) => c !== null);
  if (!root) {
    throw new Error("Single-linkage clustering failed — no root node");
  }
  return root;
}

// ── Stage 2: Quasi-Diagonalisation ───────────────────────────

/**
 * DFS traversal of the cluster tree, returning the leaf asset indices in
 * left-to-right order. This reorders the original asset list so that
 * correlated assets sit next to each other — the "quasi-diagonal" of
 * the correlation matrix.
 */
export function quasiDiagonalize(node: ClusterNode): number[] {
  const order: number[] = [];
  const stack: ClusterNode[] = [node];
  while (stack.length > 0) {
    const cur = stack.pop()!;
    if (cur.assetIndex !== undefined) {
      order.push(cur.assetIndex);
    } else {
      // Push right first so that left is processed first (DFS pre-order).
      if (cur.right) stack.push(cur.right);
      if (cur.left) stack.push(cur.left);
    }
  }
  return order;
}

// ── Stage 3: Recursive Bisection ─────────────────────────────

/**
 * Inverse-variance portfolio for a given subset of asset indices against
 * the full covariance matrix. w_i ∝ 1 / σ_i², normalised to sum to 1.
 */
function inverseVarianceWeights(indices: number[], cov: number[][]): number[] {
  const w = new Array<number>(indices.length).fill(0);
  let total = 0;
  for (let k = 0; k < indices.length; k++) {
    const i = indices[k]!;
    const v = cov[i]![i]!;
    const inv = v > 1e-12 ? 1 / v : 1 / 1e-12;
    w[k] = inv;
    total += inv;
  }
  if (total <= 0) {
    // Degenerate — equal-weight fallback.
    return w.map(() => 1 / indices.length);
  }
  for (let k = 0; k < w.length; k++) w[k]! /= total;
  return w;
}

/**
 * Cluster variance w^T Σ w where w is the inverse-variance portfolio
 * inside the cluster. This is the "risk" of the cluster used to allocate
 * capital inversely-proportionally in recursive bisection.
 */
function clusterVariance(indices: number[], cov: number[][]): number {
  const w = inverseVarianceWeights(indices, cov);
  let total = 0;
  for (let a = 0; a < indices.length; a++) {
    for (let b = 0; b < indices.length; b++) {
      total += w[a]! * w[b]! * cov[indices[a]!]![indices[b]!]!;
    }
  }
  return total;
}

/**
 * Recursive bisection (stage 3 of HRP). Allocates equal-weight "1.0"
 * to the full ordered list, then recursively splits each subset in half,
 * scaling the left half by (1 - α) and the right half by α where
 *
 *   α = v_left / (v_left + v_right)
 *
 * with v_* = cluster variances. This is the risk-parity trick: the
 * branch with more variance gets less capital.
 */
export function recursiveBisection(order: number[], cov: number[][]): number[] {
  const N = order.length;
  const weights = new Array<number>(N).fill(1);

  // Queue of active slices (start..end inclusive index ranges over `order`).
  const stack: Array<[number, number]> = [[0, N - 1]];
  while (stack.length > 0) {
    const [start, end] = stack.pop()!;
    if (end <= start) continue;

    const mid = Math.floor((start + end + 1) / 2);
    const leftIdx = order.slice(start, mid);
    const rightIdx = order.slice(mid, end + 1);

    const vLeft = clusterVariance(leftIdx, cov);
    const vRight = clusterVariance(rightIdx, cov);
    const total = vLeft + vRight;
    // α = fraction of capital going to the RIGHT cluster (higher-variance
    // side gets less, so α = vLeft / total).
    const alpha = total > 0 ? vLeft / total : 0.5;

    for (let k = start; k < mid; k++) weights[k]! *= 1 - alpha;
    for (let k = mid; k <= end; k++) weights[k]! *= alpha;

    stack.push([start, mid - 1]);
    stack.push([mid, end]);
  }

  return weights;
}

// ── Public API ────────────────────────────────────────────────

/**
 * Full HRP pipeline: tree clustering → quasi-diagonalisation → recursive
 * bisection. Returns portfolio weights (keyed by asset id, summing to 1),
 * the cluster tree, and the quasi-diagonal asset order.
 *
 * @throws if the inputs are empty, mismatched, or contain non-finite values.
 */
export function computeHRP(input: HRPInput): HRPOutput {
  const { returns, assetIds } = input;

  // ── Validation ──
  if (!Array.isArray(returns) || returns.length === 0) {
    throw new Error("Returns matrix cannot be empty");
  }
  if (!Array.isArray(assetIds) || assetIds.length === 0) {
    throw new Error("assetIds cannot be empty");
  }
  const N = assetIds.length;
  for (let t = 0; t < returns.length; t++) {
    const row = returns[t]!;
    if (!Array.isArray(row) || row.length !== N) {
      throw new Error(
        `Row ${t} has length ${row?.length ?? "undefined"}, expected ${N}`,
      );
    }
    for (let i = 0; i < N; i++) {
      if (!Number.isFinite(row[i]!)) {
        throw new Error(`Non-finite return at row ${t}, column ${i}`);
      }
    }
  }
  const seen = new Set<string>();
  for (const id of assetIds) {
    if (seen.has(id)) throw new Error(`Duplicate asset id "${id}"`);
    seen.add(id);
  }

  // ── Single-asset fast path ──
  if (N === 1) {
    const leaf: ClusterNode = {
      id: 0,
      assetIndex: 0,
      assetId: assetIds[0]!,
      distance: 0,
      size: 1,
    };
    return {
      weights: { [assetIds[0]!]: 1 },
      clusterTree: leaf,
      quasiDiagOrder: [assetIds[0]!],
    };
  }

  // ── Stage 1: tree clustering ──
  const corr = correlationMatrix(returns);
  const dist = correlationDistance(corr);
  const tree = singleLinkage(dist, assetIds);

  // Covariance matrix for variance-aware allocation.
  const vars = columnVariances(returns);
  const cov = covarianceFromCorr(corr, vars);

  // ── Stage 2: quasi-diagonalisation ──
  const order = quasiDiagonalize(tree);
  const quasiDiagOrder = order.map((i) => assetIds[i]!);

  // ── Stage 3: recursive bisection ──
  const rawWeights = recursiveBisection(order, cov);

  // Normalise for numerical drift then map back to asset ids.
  const sum = rawWeights.reduce((a, b) => a + b, 0);
  const normalised = sum > 0 ? rawWeights.map((w) => w / sum) : rawWeights;

  const weights: Record<string, number> = {};
  for (let k = 0; k < order.length; k++) {
    weights[assetIds[order[k]!]!] = normalised[k]!;
  }

  return {
    weights,
    clusterTree: tree,
    quasiDiagOrder,
  };
}
