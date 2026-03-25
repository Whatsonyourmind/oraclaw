/**
 * Time Series Forecasting
 *
 * Provides ARIMA-based forecasting (via the `arima` WASM package) and a pure
 * TypeScript Holt-Winters (triple exponential smoothing) fallback.
 *
 * Usage:
 *   const result = await forecast([1,2,3,4,5], 3);          // auto-ARIMA
 *   const hw = holtWinters([1,2,3,4,5,6,7,8], 4, 3);       // Holt-Winters
 */

import ARIMA from "arima";

// ── Types ────────────────────────────────────────────────

/** Result produced by both ARIMA and Holt-Winters forecasters */
export interface ForecastResult {
  /** Point forecasts for each requested step */
  forecast: number[];
  /** Confidence bands (approximate 95 %) */
  confidence: { lower: number[]; upper: number[] };
  /** Human-readable model description */
  model: string;
}

/** Configuration for the ARIMA forecaster */
export interface ForecastConfig {
  /** Auto-regressive order (default: auto) */
  p?: number;
  /** Differencing order (default: auto) */
  d?: number;
  /** Moving-average order (default: auto) */
  q?: number;
  /** Seasonal auto-regressive order */
  P?: number;
  /** Seasonal differencing order */
  D?: number;
  /** Seasonal moving-average order */
  Q?: number;
  /** Seasonal period length */
  s?: number;
  /** Use automatic order detection (default: true) */
  auto?: boolean;
  /** Verbosity flag passed to the ARIMA WASM module */
  verbose?: boolean;
}

/** Configuration for Holt-Winters exponential smoothing */
export interface HoltWintersConfig {
  /** Level smoothing factor 0-1 (default: auto-optimised) */
  alpha?: number;
  /** Trend smoothing factor 0-1 (default: auto-optimised) */
  beta?: number;
  /** Seasonal smoothing factor 0-1 (default: auto-optimised) */
  gamma?: number;
}

// ── ARIMA Forecaster ─────────────────────────────────────

/**
 * Forecast future values using ARIMA / auto-ARIMA.
 *
 * @param data   - Historical time series (minimum 8 observations recommended)
 * @param steps  - Number of future steps to forecast
 * @param config - Optional ARIMA hyper-parameters; defaults to auto-ARIMA
 * @returns ForecastResult with point forecasts + 95 % confidence bands
 *
 * O(n * iterations) where n = data length, iterations = model fitting
 */
export function forecast(
  data: number[],
  steps: number,
  config: ForecastConfig = {},
): ForecastResult {
  if (data.length < 2) {
    throw new Error("Time series must contain at least 2 observations");
  }
  if (steps < 1) {
    throw new Error("Steps must be at least 1");
  }

  const useAuto = config.auto !== false && config.p === undefined && config.d === undefined && config.q === undefined;

  const arimaOpts = {
    p: config.p ?? 0,
    d: config.d ?? 0,
    q: config.q ?? 0,
    P: config.P ?? 0,
    D: config.D ?? 0,
    Q: config.Q ?? 0,
    s: config.s ?? 0,
    verbose: config.verbose ?? false,
    auto: useAuto,
  };

  const model = new ARIMA(arimaOpts);
  model.train(data);

  const [pred, errors] = model.predict(steps);

  // Build 95 % confidence bands from standard errors
  const z = 1.96;
  const lower: number[] = [];
  const upper: number[] = [];

  for (let i = 0; i < pred.length; i++) {
    const se = errors[i] !== undefined ? Math.abs(errors[i]!) : 0;
    lower.push(pred[i]! - z * se);
    upper.push(pred[i]! + z * se);
  }

  const modelName = useAuto
    ? "auto-ARIMA"
    : `ARIMA(${arimaOpts.p},${arimaOpts.d},${arimaOpts.q})`;

  return {
    forecast: pred,
    confidence: { lower, upper },
    model: modelName,
  };
}

// ── Holt-Winters (Triple Exponential Smoothing) ──────────

/**
 * Grid-search for optimal smoothing parameters (alpha, beta, gamma).
 *
 * Minimises one-step-ahead MSE over a coarse 0.1-step grid.
 *
 * @returns Best { alpha, beta, gamma }
 */
function optimiseHWParams(
  data: number[],
  seasonLength: number,
): { alpha: number; beta: number; gamma: number } {
  let bestAlpha = 0.3;
  let bestBeta = 0.1;
  let bestGamma = 0.1;
  let bestMSE = Infinity;

  const step = 0.1;

  for (let a = 0.1; a <= 0.9; a += step) {
    for (let b = 0.01; b <= 0.5; b += step) {
      for (let g = 0.01; g <= 0.5; g += step) {
        const mse = hwFitMSE(data, seasonLength, a, b, g);
        if (mse < bestMSE) {
          bestMSE = mse;
          bestAlpha = a;
          bestBeta = b;
          bestGamma = g;
        }
      }
    }
  }

  return { alpha: bestAlpha, beta: bestBeta, gamma: bestGamma };
}

/**
 * Compute one-step-ahead MSE for a Holt-Winters model with given params.
 */
function hwFitMSE(
  data: number[],
  seasonLength: number,
  alpha: number,
  beta: number,
  gamma: number,
): number {
  const n = data.length;
  if (n < 2 * seasonLength) return Infinity;

  // Initialise level, trend, seasonal components
  let level = 0;
  for (let i = 0; i < seasonLength; i++) {
    level += data[i]!;
  }
  level /= seasonLength;

  let trend = 0;
  for (let i = 0; i < seasonLength; i++) {
    trend += (data[seasonLength + i]! - data[i]!) / seasonLength;
  }
  trend /= seasonLength;

  const seasonal: number[] = new Array(seasonLength);
  for (let i = 0; i < seasonLength; i++) {
    seasonal[i] = data[i]! - level;
  }

  let sse = 0;
  let count = 0;

  for (let i = seasonLength; i < n; i++) {
    const sIdx = i % seasonLength;
    const forecast = level + trend + seasonal[sIdx]!;
    const error = data[i]! - forecast;
    sse += error * error;
    count++;

    const prevLevel = level;
    level = alpha * (data[i]! - seasonal[sIdx]!) + (1 - alpha) * (level + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
    seasonal[sIdx] = gamma * (data[i]! - level) + (1 - gamma) * seasonal[sIdx]!;
  }

  return count > 0 ? sse / count : Infinity;
}

/**
 * Holt-Winters (additive) triple exponential smoothing forecast.
 *
 * Pure TypeScript implementation -- no external dependencies. Suitable as a
 * fallback when ARIMA WASM is unavailable or when the series has clear
 * seasonality.
 *
 * @param data         - Historical time series
 * @param seasonLength - Length of one seasonal cycle (e.g., 12 for monthly data with yearly season)
 * @param steps        - Number of future steps to forecast
 * @param alpha        - Level smoothing (optional, auto-optimised if omitted)
 * @param beta         - Trend smoothing (optional, auto-optimised if omitted)
 * @param gamma        - Seasonal smoothing (optional, auto-optimised if omitted)
 * @returns ForecastResult with point forecasts + approximate confidence bands
 *
 * O(n + steps) after parameter optimisation; optimisation itself is O(n * grid_size)
 */
export function holtWinters(
  data: number[],
  seasonLength: number,
  steps: number,
  alpha?: number,
  beta?: number,
  gamma?: number,
): ForecastResult {
  if (data.length < 2 * seasonLength) {
    throw new Error(
      `Holt-Winters requires at least 2 full seasons of data (${2 * seasonLength} points for seasonLength=${seasonLength})`,
    );
  }
  if (steps < 1) {
    throw new Error("Steps must be at least 1");
  }
  if (seasonLength < 2) {
    throw new Error("Season length must be at least 2");
  }

  // Determine smoothing parameters
  const params =
    alpha !== undefined && beta !== undefined && gamma !== undefined
      ? { alpha, beta, gamma }
      : optimiseHWParams(data, seasonLength);

  const a = params.alpha;
  const b = params.beta;
  const g = params.gamma;

  // Initialise level: mean of first season
  let level = 0;
  for (let i = 0; i < seasonLength; i++) {
    level += data[i]!;
  }
  level /= seasonLength;

  // Initialise trend: average slope between first two seasons
  let trend = 0;
  for (let i = 0; i < seasonLength; i++) {
    trend += (data[seasonLength + i]! - data[i]!) / seasonLength;
  }
  trend /= seasonLength;

  // Initialise seasonal indices
  const seasonal: number[] = new Array(seasonLength);
  for (let i = 0; i < seasonLength; i++) {
    seasonal[i] = data[i]! - level;
  }

  // Fit the model over the entire historical series
  const residuals: number[] = [];

  for (let i = seasonLength; i < data.length; i++) {
    const sIdx = i % seasonLength;
    const fitted = level + trend + seasonal[sIdx]!;
    residuals.push(data[i]! - fitted);

    const prevLevel = level;
    level = a * (data[i]! - seasonal[sIdx]!) + (1 - a) * (level + trend);
    trend = b * (level - prevLevel) + (1 - b) * trend;
    seasonal[sIdx] = g * (data[i]! - level) + (1 - g) * seasonal[sIdx]!;
  }

  // Forecast
  const pred: number[] = [];
  for (let h = 1; h <= steps; h++) {
    const sIdx = (data.length + h - 1) % seasonLength;
    pred.push(level + h * trend + seasonal[sIdx]!);
  }

  // Approximate confidence bands from residual std dev
  let ss = 0;
  for (const r of residuals) {
    ss += r * r;
  }
  const residualStd = residuals.length > 1 ? Math.sqrt(ss / (residuals.length - 1)) : 0;
  const z = 1.96;

  const lower: number[] = [];
  const upper: number[] = [];
  for (let h = 1; h <= steps; h++) {
    // Widen bands with forecast horizon
    const se = residualStd * Math.sqrt(h);
    lower.push(pred[h - 1]! - z * se);
    upper.push(pred[h - 1]! + z * se);
  }

  return {
    forecast: pred,
    confidence: { lower, upper },
    model: `Holt-Winters(alpha=${a.toFixed(2)}, beta=${b.toFixed(2)}, gamma=${g.toFixed(2)}, season=${seasonLength})`,
  };
}
