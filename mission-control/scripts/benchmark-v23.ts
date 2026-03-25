import { forecast, holtWinters } from "../apps/api/src/services/oracle/algorithms/timeSeries.js";
import { detectAnomaliesZScore, detectAnomaliesIQR, StreamingAnomalyDetector } from "../apps/api/src/services/oracle/algorithms/anomalyDetector.js";
import { optimizeCMAES } from "../apps/api/src/services/oracle/algorithms/cmaes.js";
import { computeCorrelationMatrix, portfolioVaR } from "../apps/api/src/services/oracle/algorithms/correlationMatrix.js";
import { computeConvergence, computeAnomalyScore } from "../apps/api/src/services/oracle/algorithms/convergenceScoring.js";

console.log("=== OraClaw v2.3 — Full Algorithm Benchmark ===\n");

function bench(name: string, fn: () => unknown, iterations = 50) {
  fn(); // warmup
  const times: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const s = performance.now();
    fn();
    times.push(performance.now() - s);
  }
  times.sort((a, b) => a - b);
  const avg = times.reduce((a, b) => a + b) / times.length;
  const p95 = times[Math.floor(times.length * 0.95)]!;
  console.log(
    name.padEnd(42) +
    (avg.toFixed(2) + "ms").padStart(10) +
    (p95.toFixed(2) + "ms").padStart(10) +
    (Math.round(1000 / avg) + "").padStart(8) + " ops/s"
  );
  return avg;
}

console.log("Algorithm".padEnd(42) + "Avg".padStart(10) + "P95".padStart(10) + "Throughput".padStart(8));
console.log("-".repeat(70));

// --- SPEED BENCHMARKS ---

const tsData = Array.from({ length: 48 }, (_, i) => 100 + 20 * Math.sin(i * Math.PI / 6) + i * 2 + Math.random() * 5);
bench("Holt-Winters (48pts → 12 steps)", () => holtWinters(tsData, 12, 12));

try {
  bench("ARIMA (48pts → 6 steps)", () => forecast(tsData, 6, { method: "arima" }), 20);
} catch (e: any) {
  console.log("ARIMA: " + e.message);
}

const anomData = Array.from({ length: 100 }, () => Math.random() * 10 + 50);
anomData[42] = 200; anomData[73] = -50;
bench("Z-Score Anomaly (100pts)", () => detectAnomaliesZScore(anomData, 3));
bench("IQR Anomaly (100pts)", () => detectAnomaliesIQR(anomData, 1.5));

bench("Streaming Anomaly (1000 updates)", () => {
  const d = new StreamingAnomalyDetector();
  for (let i = 0; i < 1000; i++) d.update(Math.random() * 100);
}, 20);

bench("CMA-ES 2D (Rosenbrock)", () => optimizeCMAES(
  ([x, y]: number[]) => (1 - x!) ** 2 + 100 * (y! - x! * x!) ** 2,
  { dimension: 2, initialMean: [0, 0], initialSigma: 1.0, maxIterations: 100 }
), 10);

bench("CMA-ES 5D (Sphere)", () => optimizeCMAES(
  (x: number[]) => x.reduce((s, v) => s + v * v, 0),
  { dimension: 5, initialMean: [3, 3, 3, 3, 3], initialSigma: 1.0, maxIterations: 200 }
), 10);

bench("CMA-ES 10D (Sphere)", () => optimizeCMAES(
  (x: number[]) => x.reduce((s, v) => s + v * v, 0),
  { dimension: 10, initialMean: Array(10).fill(5), initialSigma: 2.0, maxIterations: 500 }
), 5);

const returns = Array.from({ length: 5 }, () => Array.from({ length: 100 }, () => (Math.random() - 0.5) * 0.1));
bench("Correlation Matrix (5×100)", () => computeCorrelationMatrix(returns));
bench("Portfolio VaR (5 assets, 95%)", () => portfolioVaR([0.3, 0.2, 0.2, 0.15, 0.15], returns, 0.95, 10));

const sources = Array.from({ length: 5 }, (_, i) => ({
  id: "s" + i, name: "S" + i, probability: 0.5 + (Math.random() - 0.5) * 0.3,
  volume: 1000 * (i + 1), lastUpdated: Date.now(),
}));
bench("Convergence (5 sources)", () => computeConvergence(sources));
bench("Anomaly Score (combined)", () => computeAnomalyScore(anomData.slice(0, 20), sources));

// --- ACCURACY TESTS ---

console.log("\n=== ACCURACY TESTS ===\n");

const rosen = optimizeCMAES(
  ([x, y]: number[]) => (1 - x!) ** 2 + 100 * (y! - x! * x!) ** 2,
  { dimension: 2, initialMean: [-2, -2], initialSigma: 2.0, maxIterations: 500 }
);
console.log(`CMA-ES Rosenbrock: [${rosen.bestSolution.map(v => v.toFixed(4))}] fitness=${rosen.bestFitness.toExponential(2)} ${rosen.bestFitness < 0.01 ? "PASS" : "FAIL"}`);

const sphere5 = optimizeCMAES(
  (x: number[]) => x.reduce((s, v) => s + v * v, 0),
  { dimension: 5, initialMean: [10, 10, 10, 10, 10], initialSigma: 5.0, maxIterations: 500 }
);
console.log(`CMA-ES 5D Sphere: fitness=${sphere5.bestFitness.toExponential(2)} ${sphere5.bestFitness < 0.01 ? "PASS" : "FAIL"}`);

const cleanData = Array.from({ length: 100 }, () => 50 + Math.random() * 10);
cleanData[25] = 150; cleanData[75] = -20;
const anomResult = detectAnomaliesZScore(cleanData, 2.5);
const foundBoth = anomResult.anomalies.some(a => a.index === 25) && anomResult.anomalies.some(a => a.index === 75);
console.log(`Z-Score: found ${anomResult.anomalies.length} anomalies at [${anomResult.anomalies.map(a => a.index)}] ${foundBoth ? "PASS" : "FAIL"}`);

const varResult = portfolioVaR([0.5, 0.3, 0.2], returns.slice(0, 3), 0.95, 1);
console.log(`VaR(95%,1d): ${(varResult.var * 100).toFixed(2)}% CVaR: ${(varResult.cvar * 100).toFixed(2)}% ${varResult.var > 0 && varResult.cvar > varResult.var ? "PASS" : "FAIL"}`);

const trendData = Array.from({ length: 24 }, (_, i) => 100 + i * 5 + Math.random() * 3);
const hwResult = holtWinters(trendData, 4, 4);
console.log(`Holt-Winters: last=${trendData[23]!.toFixed(0)} forecast=${hwResult.forecast[0]!.toFixed(0)} ${hwResult.forecast[0]! > trendData[23]! ? "PASS" : "FAIL"}`);

const corrResult = computeCorrelationMatrix([[1, 2, 3, 4, 5], [2, 4, 6, 8, 10], [5, 4, 3, 2, 1]], ["A", "B", "C"]);
console.log(`Corr A↔B: ${corrResult.matrix[0]![1]!.toFixed(2)} (expect 1.00) ${Math.abs(corrResult.matrix[0]![1]! - 1) < 0.01 ? "PASS" : "FAIL"}`);
console.log(`Corr A↔C: ${corrResult.matrix[0]![2]!.toFixed(2)} (expect -1.00) ${Math.abs(corrResult.matrix[0]![2]! + 1) < 0.01 ? "PASS" : "FAIL"}`);

console.log("\nDone.");
