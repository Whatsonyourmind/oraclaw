/**
 * Correlation Matrix & Portfolio Risk
 *
 * Fills the gap in the OODA-loop risk product by providing:
 *   - Pearson correlation matrix computation for multi-asset return series
 *   - Covariance matrix computation
 *   - Parametric Value-at-Risk (VaR) and Conditional VaR (CVaR / Expected Shortfall)
 *
 * Uses `jstat` for the normal inverse CDF (percent-point function).
 */

// @ts-expect-error — jstat has no type declarations
import jStat from "jstat";

// ── Types ────────────────────────────────────────────────

/** Correlation matrix result */
export interface CorrelationMatrixResult {
  /** n x n Pearson correlation matrix */
  matrix: number[][];
  /** Optional asset labels for display */
  labels?: string[];
}

/** Covariance matrix result */
export interface CovarianceMatrixResult {
  /** n x n sample covariance matrix */
  matrix: number[][];
}

/** Portfolio risk metrics */
export interface PortfolioVaRResult {
  /** Value-at-Risk (positive number = potential loss) */
  var: number;
  /** Conditional VaR / Expected Shortfall */
  cvar: number;
  /** Annualised expected portfolio return (scaled to horizon) */
  expectedReturn: number;
  /** Annualised portfolio volatility (scaled to horizon) */
  volatility: number;
}

// ── Helpers ──────────────────────────────────────────────

/**
 * Compute the mean of an array.
 * @param arr - Numeric array
 * @returns Arithmetic mean
 *
 * O(n)
 */
function mean(arr: number[]): number {
  let s = 0;
  for (let i = 0; i < arr.length; i++) s += arr[i]!;
  return s / arr.length;
}

/**
 * Compute sample standard deviation.
 * @param arr  - Numeric array
 * @param mu   - Pre-computed mean (optional)
 * @returns Sample standard deviation (Bessel-corrected)
 *
 * O(n)
 */
function stdDev(arr: number[], mu?: number): number {
  const m = mu ?? mean(arr);
  let ss = 0;
  for (let i = 0; i < arr.length; i++) {
    const d = arr[i]! - m;
    ss += d * d;
  }
  return arr.length > 1 ? Math.sqrt(ss / (arr.length - 1)) : 0;
}

// ── Correlation Matrix ───────────────────────────────────

/**
 * Compute the Pearson correlation matrix for a set of asset return series.
 *
 * Each element of `assets` is a time series of returns. All series must have
 * the same length.
 *
 * @param assets - Array of return series (one per asset)
 * @param labels - Optional asset labels
 * @returns CorrelationMatrixResult with n x n correlation matrix
 *
 * O(k^2 * T) where k = number of assets, T = time series length
 */
export function computeCorrelationMatrix(
  assets: number[][],
  labels?: string[],
): CorrelationMatrixResult {
  const k = assets.length;
  if (k === 0) return { matrix: [], labels };

  const T = assets[0]!.length;
  for (let i = 1; i < k; i++) {
    if (assets[i]!.length !== T) {
      throw new Error(
        `All asset return series must have the same length. Asset 0 has ${T}, asset ${i} has ${assets[i]!.length}.`,
      );
    }
  }

  if (T < 2) {
    throw new Error("Return series must contain at least 2 observations");
  }

  // Pre-compute means and standard deviations
  const means: number[] = assets.map((a) => mean(a));
  const stds: number[] = assets.map((a, i) => stdDev(a, means[i]));

  // Build correlation matrix
  const matrix: number[][] = [];

  for (let i = 0; i < k; i++) {
    const row: number[] = [];
    for (let j = 0; j < k; j++) {
      if (i === j) {
        row.push(1);
      } else if (j < i) {
        // Symmetric — reuse previously computed value
        row.push(matrix[j]![i]!);
      } else {
        // Pearson correlation
        const si = stds[i]!;
        const sj = stds[j]!;
        if (si === 0 || sj === 0) {
          row.push(0);
        } else {
          let cov = 0;
          for (let t = 0; t < T; t++) {
            cov += (assets[i]![t]! - means[i]!) * (assets[j]![t]! - means[j]!);
          }
          cov /= T - 1;
          row.push(cov / (si * sj));
        }
      }
    }
    matrix.push(row);
  }

  return { matrix, labels };
}

// ── Covariance Matrix ────────────────────────────────────

/**
 * Compute the sample covariance matrix for a set of asset return series.
 *
 * @param assets - Array of return series (one per asset)
 * @returns CovarianceMatrixResult with n x n covariance matrix
 *
 * O(k^2 * T)
 */
export function computeCovarianceMatrix(
  assets: number[][],
): CovarianceMatrixResult {
  const k = assets.length;
  if (k === 0) return { matrix: [] };

  const T = assets[0]!.length;
  for (let i = 1; i < k; i++) {
    if (assets[i]!.length !== T) {
      throw new Error(
        `All asset return series must have the same length. Asset 0 has ${T}, asset ${i} has ${assets[i]!.length}.`,
      );
    }
  }

  if (T < 2) {
    throw new Error("Return series must contain at least 2 observations");
  }

  const means: number[] = assets.map((a) => mean(a));

  const matrix: number[][] = [];

  for (let i = 0; i < k; i++) {
    const row: number[] = [];
    for (let j = 0; j < k; j++) {
      if (j < i) {
        row.push(matrix[j]![i]!);
      } else {
        let cov = 0;
        for (let t = 0; t < T; t++) {
          cov += (assets[i]![t]! - means[i]!) * (assets[j]![t]! - means[j]!);
        }
        row.push(cov / (T - 1));
      }
    }
    matrix.push(row);
  }

  return { matrix };
}

// ── Portfolio VaR & CVaR ─────────────────────────────────

/**
 * Compute parametric Value-at-Risk and Conditional VaR for a portfolio.
 *
 * Uses the variance-covariance (delta-normal) method:
 *   - Portfolio return: mu_p = w^T * mu
 *   - Portfolio variance: sigma_p^2 = w^T * Sigma * w
 *   - VaR = -(mu_p * sqrt(h)) + sigma_p * sqrt(h) * z_alpha
 *   - CVaR = -(mu_p * sqrt(h)) + sigma_p * sqrt(h) * phi(z_alpha) / (1 - alpha)
 *
 * where z_alpha = Phi^{-1}(alpha), phi = standard normal PDF, Phi^{-1} = inverse CDF.
 *
 * @param weights      - Portfolio weights (must sum to ~1)
 * @param returns      - Array of asset return series (one per asset)
 * @param confidence   - Confidence level, e.g. 0.95 or 0.99
 * @param horizonDays  - Risk horizon in trading days (e.g. 1, 10, 252)
 * @returns PortfolioVaRResult with VaR, CVaR, expected return, and volatility
 *
 * O(k^2 * T + k^2) where k = assets, T = series length
 */
export function portfolioVaR(
  weights: number[],
  returns: number[][],
  confidence: number,
  horizonDays: number,
): PortfolioVaRResult {
  const k = returns.length;

  if (weights.length !== k) {
    throw new Error(
      `Weights length (${weights.length}) must match number of assets (${k})`,
    );
  }
  if (k === 0) {
    throw new Error("At least one asset is required");
  }
  if (confidence <= 0 || confidence >= 1) {
    throw new Error("Confidence must be between 0 and 1 (exclusive)");
  }
  if (horizonDays < 1) {
    throw new Error("Horizon must be at least 1 day");
  }

  const T = returns[0]!.length;
  if (T < 2) {
    throw new Error("Return series must contain at least 2 observations");
  }

  // Asset means (daily)
  const means: number[] = returns.map((r) => mean(r));

  // Covariance matrix
  const { matrix: covMatrix } = computeCovarianceMatrix(returns);

  // Portfolio expected return (daily)
  let muP = 0;
  for (let i = 0; i < k; i++) {
    muP += weights[i]! * means[i]!;
  }

  // Portfolio variance (daily): w^T * Sigma * w
  let varP = 0;
  for (let i = 0; i < k; i++) {
    for (let j = 0; j < k; j++) {
      varP += weights[i]! * weights[j]! * covMatrix[i]![j]!;
    }
  }
  const sigmaP = Math.sqrt(Math.max(0, varP));

  // Scale to horizon
  const sqrtH = Math.sqrt(horizonDays);
  const muH = muP * horizonDays;
  const sigmaH = sigmaP * sqrtH;

  // z_alpha: inverse standard normal CDF at confidence level
  // jStat.normal.inv(p, mean, std) — we want Phi^{-1}(confidence)
  const zAlpha = jStat.normal.inv(confidence, 0, 1) as number;

  // VaR = -(expected return over horizon) + sigma * sqrt(h) * z_alpha
  // Positive VaR = potential loss
  const varValue = -muH + sigmaH * zAlpha;

  // CVaR (Expected Shortfall) for normal distribution:
  // CVaR = -mu_h + sigma_h * phi(z_alpha) / (1 - confidence)
  // where phi(z) = standard normal PDF
  const phiZAlpha = jStat.normal.pdf(zAlpha, 0, 1) as number;
  const cvarValue = -muH + sigmaH * (phiZAlpha / (1 - confidence));

  return {
    var: varValue,
    cvar: cvarValue,
    expectedReturn: muH,
    volatility: sigmaH,
  };
}
