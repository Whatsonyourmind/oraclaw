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
import { createHash } from "node:crypto";

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

// ── Estimation-error certificate ─────────────────────────
//
// analyze_risk reports a parametric (delta-normal) VaR/ES point estimate from a
// finite return window. That point estimate carries SAMPLING ERROR: muP and
// sigmaP are estimated from T observations. This certificate quantifies that
// error with closed-form delta-method standard errors (no bootstrap — the
// estimator is parametric) and a re-checkable content hash. It is NOT new
// statistics (Jorion delta-method; Var(s) for normal samples; Kupiec 1995) and
// makes NO claim of beating any library — the contribution is binding a
// recomputable estimator-error CI + an ES-distinctness flag into an MCP tool.
//
// Scope: SE is valid under the iid-normal assumption only (invalid under heavy
// tails / autocorrelation). effectiveSampleSupport is the ESTIMATION WINDOW T,
// NOT a tail subset.

export const RISK_CERTIFICATE_SCHEMA = "oraclaw.risk.certificate/v1";
const RISK_ALGO_VERSION = "correlationMatrix/delta-normal@1";
const RISK_ABS_TOL = 1e-9;
const RISK_REL_TOL = 1e-9;

export interface RiskCertificate {
  schema: string;
  algoVersion: string;
  method: "delta-normal";
  confidence: number; // VaR/ES tail confidence (e.g. 0.95)
  horizonDays: number;
  ciLevel: number; // two-sided CI level for the estimation-error intervals
  /** T — the estimation window length (NOT a tail subset). */
  effectiveSampleSupport: number;
  varValue: number;
  esValue: number;
  expectedReturn: number;
  volatility: number;
  /** Delta-method standard error of the VaR point estimate. */
  seVaR: number;
  /** Delta-method standard error of the ES point estimate. */
  seES: number;
  varCI: [number, number];
  esCI: [number, number];
  /** ES − VaR. */
  esGap: number;
  seEsGap: number;
  /**
   * True iff the ES−VaR gap exceeds the ES estimate's own ciLevel CI half-width
   * (ciLevel·SE(ES)) — i.e. the ES estimate is precise enough at this window to
   * separate it from VaR. False on short windows where the mean-estimation term
   * in SE(ES) swamps the gap (flips ~T>70 at 95%). NOT a test of H0: ES=VaR (the
   * gap is a deterministic positive multiple of sigmaP under the normal model).
   */
  esStatisticallyDistinctFromVaR: boolean;
  /** Optional Kupiec unconditional-coverage backtest (only when exceedances given). */
  kupiec?: {
    observations: number;
    exceedances: number;
    expectedRate: number;
    lrUC: number;
    pValue: number;
    rejectAt5pct: boolean;
  };
  contentHash: string;
  certificateValid: boolean;
  notes: string[];
}

function riskCanonicalize(value: unknown): unknown {
  if (typeof value === "number") return Number.isFinite(value) ? value.toFixed(12) : String(value);
  if (Array.isArray(value)) return value.map(riskCanonicalize);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(value as Record<string, unknown>).sort()) {
      out[k] = riskCanonicalize((value as Record<string, unknown>)[k]);
    }
    return out;
  }
  return value;
}

function riskContentHash(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(riskCanonicalize(payload))).digest("hex");
}

function kupiecLR(observations: number, exceedances: number, expectedRate: number): { lrUC: number; pValue: number; rejectAt5pct: boolean } {
  const n = observations;
  const x = exceedances;
  const p = expectedRate;
  if (n <= 0 || p <= 0 || p >= 1 || x < 0 || x > n) {
    return { lrUC: NaN, pValue: NaN, rejectAt5pct: false };
  }
  const piHat = x / n;
  const lnL0 = (n - x) * Math.log(1 - p) + x * Math.log(p);
  // π̂ at a boundary makes the unrestricted log-lik a limit (0·ln0 → 0).
  const term0 = piHat <= 0 ? 0 : (n - x) * Math.log(1 - piHat);
  const term1 = piHat >= 1 ? 0 : x * Math.log(piHat);
  const lnL1 = term0 + term1;
  const lrUC = -2 * (lnL0 - lnL1);
  const pValue = 1 - (jStat.chisquare.cdf(lrUC, 1) as number);
  return { lrUC, pValue, rejectAt5pct: pValue < 0.05 };
}

/**
 * Build the estimation-error certificate for a delta-normal VaR/ES result.
 * Pure function of (weights, returns, confidence, horizonDays) → deterministic
 * and re-checkable. `result` is the matching `portfolioVaR` output.
 */
export function buildRiskCertificate(
  weights: number[],
  returns: number[][],
  confidence: number,
  horizonDays: number,
  result: PortfolioVaRResult,
  opts: { ciLevel?: number; realizedExceedances?: number[] } = {},
): RiskCertificate {
  const ciLevel = opts.ciLevel ?? 0.95;
  const T = returns[0]?.length ?? 0;
  const h = horizonDays;

  // Recover the daily portfolio moments from the horizon-scaled result.
  const sigmaP = h > 0 ? result.volatility / Math.sqrt(h) : 0;

  const z = jStat.normal.inv(confidence, 0, 1) as number;
  const phiZ = jStat.normal.pdf(z, 0, 1) as number;
  const kES = phiZ / (1 - confidence);

  // Sampling variances under iid-normal: Var(mean)=σ²/T, Var(s)≈σ²/(2(T-1)).
  const varMu = T > 0 ? (sigmaP * sigmaP) / T : Infinity;
  const varSigma = T > 1 ? (sigmaP * sigmaP) / (2 * (T - 1)) : Infinity;

  // VaR = -h·muP + √h·z·sigmaP ; ES = -h·muP + √h·kES·sigmaP. Mean and SD
  // estimators are independent for normal samples → no cross term.
  const seVaR = Math.sqrt(h * h * varMu + h * z * z * varSigma);
  const seES = Math.sqrt(h * h * varMu + h * kES * kES * varSigma);

  // ES − VaR = √h·sigmaP·(kES − z): the muP terms cancel, so it depends only on sigmaP.
  const esGap = result.cvar - result.var;
  const seEsGap = Math.sqrt(h * (kES - z) * (kES - z) * varSigma);

  const zCI = jStat.normal.inv(0.5 + ciLevel / 2, 0, 1) as number;
  const varCI: [number, number] = [result.var - zCI * seVaR, result.var + zCI * seVaR];
  const esCI: [number, number] = [result.cvar - zCI * seES, result.cvar + zCI * seES];
  // The gap is positive whenever sigmaP>0; the useful question is whether the ES
  // estimate is precise enough (its CI half-width < the gap) at this window.
  const esStatisticallyDistinctFromVaR = Number.isFinite(seES) && esGap > zCI * seES;

  const notes: string[] = [];
  notes.push("Estimation-error SE under the iid-normal assumption — INVALID under heavy tails or autocorrelation.");
  notes.push("effectiveSampleSupport is the estimation window T, not a tail subset.");
  if (!esStatisticallyDistinctFromVaR) {
    notes.push(`ES estimate too imprecise to separate from VaR at this window: gap ${esGap.toExponential(3)} <= ES ${ciLevel}-CI half-width ${(zCI * seES).toExponential(3)} — add observations.`);
  }

  let kupiec: RiskCertificate["kupiec"];
  if (opts.realizedExceedances && opts.realizedExceedances.length > 0) {
    const obs = opts.realizedExceedances.length;
    const exc = opts.realizedExceedances.reduce((a, b) => a + (b ? 1 : 0), 0);
    const expectedRate = 1 - confidence;
    const k = kupiecLR(obs, exc, expectedRate);
    kupiec = { observations: obs, exceedances: exc, expectedRate, lrUC: k.lrUC, pValue: k.pValue, rejectAt5pct: k.rejectAt5pct };
    if (k.rejectAt5pct) notes.push("Kupiec POF rejects correct unconditional coverage at 5% — the VaR model is miscalibrated on the supplied exceedances.");
  }

  const hashPayload = {
    schema: RISK_CERTIFICATE_SCHEMA,
    algoVersion: RISK_ALGO_VERSION,
    method: "delta-normal",
    confidence,
    horizonDays,
    ciLevel,
    weights,
    returns,
    varValue: result.var,
    esValue: result.cvar,
    expectedReturn: result.expectedReturn,
    volatility: result.volatility,
    seVaR,
    seES,
    esGap,
    seEsGap,
  };
  const contentHash = riskContentHash(hashPayload);

  const certificateValid =
    T >= 2 &&
    [result.var, result.cvar, seVaR, seES, esGap, seEsGap].every((x) => Number.isFinite(x));

  return {
    schema: RISK_CERTIFICATE_SCHEMA,
    algoVersion: RISK_ALGO_VERSION,
    method: "delta-normal",
    confidence,
    horizonDays,
    ciLevel,
    effectiveSampleSupport: T,
    varValue: result.var,
    esValue: result.cvar,
    expectedReturn: result.expectedReturn,
    volatility: result.volatility,
    seVaR,
    seES,
    varCI,
    esCI,
    esGap,
    seEsGap,
    esStatisticallyDistinctFromVaR,
    kupiec,
    contentHash,
    certificateValid,
    notes,
  };
}

function riskClose(a: number, b: number): boolean {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return a === b;
  return Math.abs(a - b) <= Math.max(RISK_ABS_TOL, RISK_REL_TOL * Math.abs(b));
}

/**
 * Re-check a (possibly tampered) risk certificate: recompute portfolioVaR + the
 * delta-method SEs from the supplied inputs and confirm they reproduce the
 * certified values, plus that the content hash binds the certificate's own
 * fields. Any tampered statistic fails one or both checks.
 */
export function verifyRiskCertificate(
  certificate: RiskCertificate,
  weights: number[],
  returns: number[][],
): { valid: boolean; reasons: string[] } {
  const reasons: string[] = [];

  const recomputedHash = riskContentHash({
    schema: certificate.schema,
    algoVersion: certificate.algoVersion,
    method: certificate.method,
    confidence: certificate.confidence,
    horizonDays: certificate.horizonDays,
    ciLevel: certificate.ciLevel,
    weights,
    returns,
    varValue: certificate.varValue,
    esValue: certificate.esValue,
    expectedReturn: certificate.expectedReturn,
    volatility: certificate.volatility,
    seVaR: certificate.seVaR,
    seES: certificate.seES,
    esGap: certificate.esGap,
    seEsGap: certificate.seEsGap,
  });
  if (recomputedHash !== certificate.contentHash) {
    reasons.push("content hash mismatch (certificate fields or inputs do not match the certified hash)");
  }

  const re = portfolioVaR(weights, returns, certificate.confidence, certificate.horizonDays);
  const reCert = buildRiskCertificate(weights, returns, certificate.confidence, certificate.horizonDays, re, { ciLevel: certificate.ciLevel });
  if (!riskClose(re.var, certificate.varValue)) reasons.push(`VaR mismatch: recomputed ${re.var} vs certified ${certificate.varValue}`);
  if (!riskClose(re.cvar, certificate.esValue)) reasons.push(`ES mismatch: recomputed ${re.cvar} vs certified ${certificate.esValue}`);
  if (!riskClose(reCert.seVaR, certificate.seVaR)) reasons.push(`SE(VaR) mismatch: recomputed ${reCert.seVaR} vs certified ${certificate.seVaR}`);
  if (!riskClose(reCert.seES, certificate.seES)) reasons.push(`SE(ES) mismatch: recomputed ${reCert.seES} vs certified ${certificate.seES}`);

  return { valid: reasons.length === 0, reasons };
}
