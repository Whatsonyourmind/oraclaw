/**
 * CMA-ES — Covariance Matrix Adaptation Evolution Strategy
 *
 * State-of-the-art continuous black-box optimisation algorithm.
 * Adapts a multivariate normal search distribution N(m, sigma^2 * C) to
 * find the minimum of an objective function without gradient information.
 *
 * Key components implemented:
 *   - Population sampling from multivariate normal
 *   - Weighted recombination of mu-best individuals
 *   - Cumulative step-size adaptation (CSA / path-length control)
 *   - Covariance matrix adaptation (rank-1 + rank-mu updates)
 *   - Eigendecomposition via Jacobi rotation for sampling
 *   - Box-Muller transform for normal variate generation
 *
 * Reference: Hansen, N. (2016). "The CMA Evolution Strategy: A Tutorial."
 *
 * Pure TypeScript, zero external dependencies (uses seeded RNG).
 */

// ── Types ────────────────────────────────────────────────

/** Configuration for the CMA-ES optimiser */
export interface CMAESConfig {
  /** Dimensionality of the search space */
  dimension: number;
  /** Population size (lambda). Default: 4 + floor(3 * ln(n)) */
  populationSize?: number;
  /** Initial mean vector. Default: zeros */
  initialMean?: number[];
  /** Initial step size (sigma). Default: 0.5 */
  initialSigma?: number;
  /** Maximum number of generations. Default: 1000 * dimension */
  maxIterations?: number;
  /** Convergence tolerance on fitness change. Default: 1e-12 */
  tolerance?: number;
  /** Random seed for reproducibility */
  seed?: number;
}

/** Result returned by the CMA-ES optimiser */
export interface CMAESResult {
  /** Best solution vector found */
  bestSolution: number[];
  /** Fitness value of the best solution (minimised) */
  bestFitness: number;
  /** Number of generations completed */
  iterations: number;
  /** Total objective function evaluations */
  evaluations: number;
  /** Whether the optimiser converged within tolerance */
  converged: boolean;
  /** Wall-clock execution time in milliseconds */
  executionTimeMs: number;
}

// ── Seeded RNG (copied from multiArmedBandit.ts) ────────

function createRandom(seed: number): () => number {
  let s = seed;
  return function () {
    let t = (s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Box-Muller normal variate generator ──────────────────

/**
 * Generate a standard normal variate via the Box-Muller transform.
 * @param rng - Uniform [0,1) random number generator
 * @returns A sample from N(0, 1)
 */
function randn(rng: () => number): number {
  const u1 = rng();
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1 + 1e-300)) * Math.cos(2 * Math.PI * u2);
}

// ── Dense matrix helpers (column-major flat arrays) ──────

type Matrix = number[];

function matZeros(n: number): Matrix {
  return new Array(n * n).fill(0);
}

function matIdentity(n: number): Matrix {
  const m = matZeros(n);
  for (let i = 0; i < n; i++) m[i * n + i] = 1;
  return m;
}

function matGet(m: Matrix, n: number, r: number, c: number): number {
  return m[r * n + c]!;
}

function matSet(m: Matrix, n: number, r: number, c: number, v: number): void {
  m[r * n + c] = v;
}

/** C = A * B  (n x n dense) */
function matMul(a: Matrix, b: Matrix, n: number): Matrix {
  const c = matZeros(n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      let s = 0;
      for (let k = 0; k < n; k++) {
        s += matGet(a, n, i, k) * matGet(b, n, k, j);
      }
      matSet(c, n, i, j, s);
    }
  }
  return c;
}

/** Return A^T */
function matTranspose(a: Matrix, n: number): Matrix {
  const t = matZeros(n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      matSet(t, n, j, i, matGet(a, n, i, j));
    }
  }
  return t;
}

// ── Jacobi Eigendecomposition ────────────────────────────

/**
 * Eigendecomposition of a symmetric matrix via cyclic Jacobi rotation.
 *
 * Returns eigenvalues (D) and eigenvectors (V) such that A = V * diag(D) * V^T.
 * Converges for all real symmetric matrices.
 *
 * @param sym - Symmetric n x n matrix (flat array, will be mutated)
 * @param n   - Dimension
 * @returns { eigenvalues: number[], eigenvectors: Matrix }
 *
 * O(n^3 * sweeps) — typically 5-10 sweeps suffice
 */
function jacobiEigen(
  sym: Matrix,
  n: number,
): { eigenvalues: number[]; eigenvectors: Matrix } {
  const a = [...sym]; // work copy
  const v = matIdentity(n);
  const maxSweeps = 100;
  const eps = 1e-15;

  for (let sweep = 0; sweep < maxSweeps; sweep++) {
    // Check off-diagonal convergence
    let offDiag = 0;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        offDiag += matGet(a, n, i, j) * matGet(a, n, i, j);
      }
    }
    if (offDiag < eps) break;

    for (let p = 0; p < n; p++) {
      for (let q = p + 1; q < n; q++) {
        const apq = matGet(a, n, p, q);
        if (Math.abs(apq) < eps) continue;

        const app = matGet(a, n, p, p);
        const aqq = matGet(a, n, q, q);
        const tau = (aqq - app) / (2 * apq);

        const t = tau >= 0
          ? 1 / (tau + Math.sqrt(1 + tau * tau))
          : -1 / (-tau + Math.sqrt(1 + tau * tau));

        const c = 1 / Math.sqrt(1 + t * t);
        const s = t * c;

        // Rotate rows/columns p, q of A
        matSet(a, n, p, p, app - t * apq);
        matSet(a, n, q, q, aqq + t * apq);
        matSet(a, n, p, q, 0);
        matSet(a, n, q, p, 0);

        for (let r = 0; r < n; r++) {
          if (r === p || r === q) continue;
          const arp = matGet(a, n, r, p);
          const arq = matGet(a, n, r, q);
          matSet(a, n, r, p, c * arp - s * arq);
          matSet(a, n, p, r, c * arp - s * arq);
          matSet(a, n, r, q, s * arp + c * arq);
          matSet(a, n, q, r, s * arp + c * arq);
        }

        // Accumulate eigenvectors
        for (let r = 0; r < n; r++) {
          const vrp = matGet(v, n, r, p);
          const vrq = matGet(v, n, r, q);
          matSet(v, n, r, p, c * vrp - s * vrq);
          matSet(v, n, r, q, s * vrp + c * vrq);
        }
      }
    }
  }

  const eigenvalues: number[] = [];
  for (let i = 0; i < n; i++) {
    eigenvalues.push(matGet(a, n, i, i));
  }

  return { eigenvalues, eigenvectors: v };
}

// ── CMA-ES Optimiser ────────────────────────────────────

/**
 * Minimise an objective function using CMA-ES.
 *
 * @param objectiveFn - Function to minimise. Receives an n-dimensional vector, returns a scalar.
 * @param config      - Optimiser configuration
 * @returns CMAESResult with the best solution, fitness, and convergence metadata
 *
 * Typical complexity: O(maxIter * lambda * n^2) for sampling + recombination,
 * plus O(n^3) per generation for eigendecomposition.
 */
export function optimizeCMAES(
  objectiveFn: (x: number[]) => number,
  config: CMAESConfig,
): CMAESResult {
  const t0 = Date.now();

  const n = config.dimension;
  if (n < 1) throw new Error("Dimension must be at least 1");

  const lambda = config.populationSize ?? (4 + Math.floor(3 * Math.log(n)));
  const mu = Math.floor(lambda / 2);
  const maxIter = config.maxIterations ?? 1000 * n;
  const tol = config.tolerance ?? 1e-12;
  const sigma0 = config.initialSigma ?? 0.5;
  const rng = createRandom(config.seed ?? 42);

  // ── Initialise mean vector
  const mean: number[] = config.initialMean
    ? [...config.initialMean]
    : new Array(n).fill(0);

  // ── Recombination weights (log-linear)
  const rawWeights: number[] = [];
  for (let i = 0; i < mu; i++) {
    rawWeights.push(Math.log(mu + 0.5) - Math.log(i + 1));
  }
  const wSum = rawWeights.reduce((a, b) => a + b, 0);
  const weights = rawWeights.map((w) => w / wSum);
  const muEff = 1 / weights.reduce((s, w) => s + w * w, 0);

  // ── Adaptation learning rates
  const cSigma = (muEff + 2) / (n + muEff + 5);
  const dSigma = 1 + 2 * Math.max(0, Math.sqrt((muEff - 1) / (n + 1)) - 1) + cSigma;
  const cc = (4 + muEff / n) / (n + 4 + 2 * muEff / n);
  const c1 = 2 / ((n + 1.3) * (n + 1.3) + muEff);
  const cmu = Math.min(
    1 - c1,
    2 * (muEff - 2 + 1 / muEff) / ((n + 2) * (n + 2) + muEff),
  );

  // Expected length of N(0,I) vector
  const chiN = Math.sqrt(n) * (1 - 1 / (4 * n) + 1 / (21 * n * n));

  // ── State variables
  let sigma = sigma0;
  let C = matIdentity(n);             // Covariance matrix
  let pSigma = new Array(n).fill(0);  // Evolution path for sigma
  let pC = new Array(n).fill(0);      // Evolution path for C
  let eigenvalues = new Array(n).fill(1);
  let B = matIdentity(n);             // Eigenvectors of C
  let invSqrtC = matIdentity(n);      // C^(-1/2) for CSA

  let bestFitness = Infinity;
  let bestSolution = [...mean];
  let evaluations = 0;
  let converged = false;
  let generation = 0;

  // Eigendecomposition update counter
  let eigenUpdateGen = 0;
  const eigenUpdateInterval = Math.max(1, Math.floor(1 / (10 * n * (c1 + cmu))));

  for (generation = 0; generation < maxIter; generation++) {
    // ── Sample population
    const population: number[][] = [];
    const fitnesses: number[] = [];

    for (let k = 0; k < lambda; k++) {
      // z_k ~ N(0, I)
      const z: number[] = [];
      for (let i = 0; i < n; i++) z.push(randn(rng));

      // y_k = B * D * z_k  (where D = diag(sqrt(eigenvalues)))
      const y: number[] = new Array(n).fill(0);
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          y[i] += matGet(B, n, i, j) * Math.sqrt(Math.max(0, eigenvalues[j]!)) * z[j]!;
        }
      }

      // x_k = mean + sigma * y_k
      const x: number[] = [];
      for (let i = 0; i < n; i++) {
        x.push(mean[i]! + sigma * y[i]!);
      }

      population.push(x);
      const f = objectiveFn(x);
      fitnesses.push(f);
      evaluations++;

      if (f < bestFitness) {
        bestFitness = f;
        bestSolution = [...x];
      }
    }

    // ── Sort by fitness (ascending — minimisation)
    const indices = fitnesses.map((_, i) => i).sort((a, b) => fitnesses[a]! - fitnesses[b]!);

    // ── Weighted recombination → new mean
    const oldMean = [...mean];
    for (let i = 0; i < n; i++) {
      let s = 0;
      for (let k = 0; k < mu; k++) {
        s += weights[k]! * population[indices[k]!]![i]!;
      }
      mean[i] = s;
    }

    // ── Cumulative step-size adaptation (CSA)
    const meanDiff: number[] = [];
    for (let i = 0; i < n; i++) {
      meanDiff.push((mean[i]! - oldMean[i]!) / sigma);
    }

    // invSqrtC * meanDiff
    const invCMd: number[] = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        invCMd[i] += matGet(invSqrtC, n, i, j) * meanDiff[j]!;
      }
    }

    const csFactor = Math.sqrt(cSigma * (2 - cSigma) * muEff);
    for (let i = 0; i < n; i++) {
      pSigma[i] = (1 - cSigma) * pSigma[i]! + csFactor * invCMd[i]!;
    }

    // ||pSigma||
    let pSigmaNorm = 0;
    for (let i = 0; i < n; i++) {
      pSigmaNorm += pSigma[i]! * pSigma[i]!;
    }
    pSigmaNorm = Math.sqrt(pSigmaNorm);

    // Update sigma
    sigma *= Math.exp((cSigma / dSigma) * (pSigmaNorm / chiN - 1));

    // ── Covariance matrix adaptation
    // Heaviside function for pC stall prevention
    const hSigma =
      pSigmaNorm / Math.sqrt(1 - Math.pow(1 - cSigma, 2 * (generation + 1))) < (1.4 + 2 / (n + 1)) * chiN
        ? 1
        : 0;

    const ccFactor = Math.sqrt(cc * (2 - cc) * muEff);
    for (let i = 0; i < n; i++) {
      pC[i] = (1 - cc) * pC[i]! + hSigma * ccFactor * meanDiff[i]!;
    }

    // rank-1 update: c1 * pC * pC^T
    // rank-mu update: cmu * sum(w_k * y_k * y_k^T)
    const newC = matZeros(n);
    const cOldFactor = 1 - c1 - cmu + (1 - hSigma) * c1 * cc * (2 - cc);

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        let val = cOldFactor * matGet(C, n, i, j);

        // rank-1
        val += c1 * pC[i]! * pC[j]!;

        // rank-mu
        let rmu = 0;
        for (let k = 0; k < mu; k++) {
          const yi = (population[indices[k]!]![i]! - oldMean[i]!) / sigma;
          const yj = (population[indices[k]!]![j]! - oldMean[j]!) / sigma;
          rmu += weights[k]! * yi * yj;
        }
        val += cmu * rmu;

        matSet(newC, n, i, j, val);
      }
    }
    C = newC;

    // ── Eigendecomposition (periodic for efficiency)
    if (generation - eigenUpdateGen >= eigenUpdateInterval) {
      eigenUpdateGen = generation;

      // Enforce symmetry
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const avg = (matGet(C, n, i, j) + matGet(C, n, j, i)) / 2;
          matSet(C, n, i, j, avg);
          matSet(C, n, j, i, avg);
        }
      }

      const { eigenvalues: evals, eigenvectors: evecs } = jacobiEigen(C, n);
      eigenvalues = evals;
      B = evecs;

      // Compute C^(-1/2) = B * diag(1/sqrt(D)) * B^T
      const diagInvSqrt = matZeros(n);
      for (let i = 0; i < n; i++) {
        const ev = Math.max(1e-20, eigenvalues[i]!);
        matSet(diagInvSqrt, n, i, i, 1 / Math.sqrt(ev));
      }
      invSqrtC = matMul(matMul(B, diagInvSqrt, n), matTranspose(B, n), n);
    }

    // ── Convergence check
    const sortedFit = indices.map((i) => fitnesses[i]!);
    const fitnessRange = sortedFit[sortedFit.length - 1]! - sortedFit[0]!;

    if (fitnessRange < tol && generation > 10) {
      converged = true;
      break;
    }

    // Sigma too small or too large guard
    if (sigma < 1e-20 || sigma > 1e20) {
      break;
    }
  }

  return {
    bestSolution,
    bestFitness,
    iterations: generation,
    evaluations,
    converged,
    executionTimeMs: Date.now() - t0,
  };
}
