/**
 * OraClaw Performance Benchmark — measures latency, throughput, and accuracy
 * Run: npx tsx scripts/benchmark-all.ts
 */

import Fastify from "fastify";
import { oracleRoutes } from "../apps/api/src/routes/oracle/index.js";

async function main() {
  const app = Fastify({ logger: false });
  await app.register(oracleRoutes);
  await app.ready();

  const results: Array<{
    name: string;
    avgMs: number;
    minMs: number;
    maxMs: number;
    p95Ms: number;
    opsPerSec: number;
    outputSize: number;
    correct: boolean;
  }> = [];

  async function bench(name: string, method: string, url: string, payload: unknown, iterations: number, validator?: (body: any) => boolean) {
    const times: number[] = [];
    let lastBody: any = null;
    let outputSize = 0;

    // Warmup
    await app.inject({ method: method as any, url, payload: payload as any });

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      const res = await app.inject({ method: method as any, url, payload: payload as any });
      const elapsed = performance.now() - start;
      times.push(elapsed);
      lastBody = JSON.parse(res.body);
      outputSize = res.body.length;
    }

    times.sort((a, b) => a - b);
    const avg = times.reduce((s, t) => s + t, 0) / times.length;
    const p95 = times[Math.floor(times.length * 0.95)]!;
    const correct = validator ? validator(lastBody) : true;

    results.push({
      name,
      avgMs: Math.round(avg * 100) / 100,
      minMs: Math.round(times[0]! * 100) / 100,
      maxMs: Math.round(times[times.length - 1]! * 100) / 100,
      p95Ms: Math.round(p95 * 100) / 100,
      opsPerSec: Math.round(1000 / avg),
      outputSize,
      correct,
    });

    console.log(`${correct ? "OK" : "!!"} ${name.padEnd(25)} avg=${avg.toFixed(1)}ms  p95=${p95.toFixed(1)}ms  ops/s=${Math.round(1000 / avg)}  size=${outputSize}b`);
  }

  console.log("=== OraClaw Performance Benchmark ===\n");
  console.log("Running 50 iterations per endpoint...\n");

  // 1. Bandit — small (3 arms)
  await bench("bandit-3arms", "POST", "/api/v1/optimize/bandit", {
    arms: [
      { id: "a", name: "A", pulls: 100, totalReward: 35 },
      { id: "b", name: "B", pulls: 80, totalReward: 32 },
      { id: "c", name: "C", pulls: 50, totalReward: 22 },
    ],
    algorithm: "ucb1",
  }, 50, (b) => b.selected?.id && b.score > 0);

  // 2. Bandit — large (20 arms)
  await bench("bandit-20arms", "POST", "/api/v1/optimize/bandit", {
    arms: Array.from({ length: 20 }, (_, i) => ({
      id: `arm-${i}`, name: `Arm ${i}`, pulls: 50 + i * 10, totalReward: 15 + Math.random() * 30,
    })),
    algorithm: "thompson",
  }, 50, (b) => b.selected?.id);

  // 3. Contextual Bandit — 3 arms, 5 features, 20 history
  await bench("ctx-bandit-5feat", "POST", "/api/v1/optimize/contextual-bandit", {
    arms: [{ id: "a", name: "A" }, { id: "b", name: "B" }, { id: "c", name: "C" }],
    context: [0.8, 0.9, 0.2, 0.5, 0.3],
    history: Array.from({ length: 20 }, (_, i) => ({
      armId: ["a", "b", "c"][i % 3],
      reward: Math.random(),
      context: Array.from({ length: 5 }, () => Math.random()),
    })),
  }, 50, (b) => b.selected?.id && b.confidenceWidth > 0);

  // 4. Constraint Solver — budget allocation (3 vars, 2 constraints)
  await bench("solver-small", "POST", "/api/v1/solve/constraints", {
    direction: "maximize",
    objective: { ads: 2.5, content: 1.8, events: 3.2 },
    variables: [
      { name: "ads", lower: 0, upper: 50000 },
      { name: "content", lower: 0, upper: 30000 },
      { name: "events", lower: 0, upper: 20000, type: "integer" },
    ],
    constraints: [
      { name: "budget", coefficients: { ads: 1, content: 1, events: 1 }, upper: 80000 },
      { name: "min_content", coefficients: { content: 1 }, lower: 10000 },
    ],
  }, 50, (b) => b.status === "optimal" && b.objectiveValue > 200000);

  // 5. Constraint Solver — large (10 vars, 8 constraints)
  const vars10 = Array.from({ length: 10 }, (_, i) => ({ name: `x${i}`, lower: 0, upper: 100, type: "continuous" as const }));
  const obj10: Record<string, number> = {};
  vars10.forEach((v, i) => { obj10[v.name] = 1 + i * 0.5; });
  await bench("solver-10vars", "POST", "/api/v1/solve/constraints", {
    direction: "maximize", objective: obj10, variables: vars10,
    constraints: [
      { name: "total", coefficients: Object.fromEntries(vars10.map(v => [v.name, 1])), upper: 500 },
      ...vars10.slice(0, 4).map((v, i) => ({ name: `min${i}`, coefficients: { [v.name]: 1 }, lower: 10 })),
    ],
  }, 50, (b) => b.status === "optimal");

  // 6. Schedule — 5 tasks, 5 slots
  await bench("schedule-5x5", "POST", "/api/v1/solve/schedule", {
    tasks: Array.from({ length: 5 }, (_, i) => ({
      id: `t${i}`, name: `Task ${i}`, durationMinutes: 30 + i * 15, priority: 9 - i,
      energyRequired: (["high", "medium", "low"] as const)[i % 3],
    })),
    slots: Array.from({ length: 5 }, (_, i) => ({
      id: `s${i}`, startTime: 1711350000 + i * 3600, durationMinutes: 60 + i * 15,
      energyLevel: (["high", "high", "medium", "medium", "low"] as const)[i],
    })),
  }, 50, (b) => b.assignments?.length > 0);

  // 7. Decision Graph — 10 nodes, 15 edges
  const gNodes = Array.from({ length: 10 }, (_, i) => ({
    id: `n${i}`, type: "action" as const, label: `Node ${i}`,
    urgency: (["critical", "high", "medium", "low"] as const)[i % 4],
    confidence: 0.3 + Math.random() * 0.6, impact: 0.2 + Math.random() * 0.7, timestamp: Date.now(),
  }));
  const gEdges = Array.from({ length: 15 }, (_, i) => ({
    source: `n${i % 10}`, target: `n${(i * 3 + 1) % 10}`, type: "enables" as const, weight: 0.3 + Math.random() * 0.6,
  })).filter(e => e.source !== e.target);
  await bench("graph-10nodes", "POST", "/api/v1/analyze/graph", {
    nodes: gNodes, edges: gEdges.slice(0, 12), sourceGoal: "n0", targetGoal: "n9",
  }, 50, (b) => b.pageRank && b.totalNodes === 10);

  // 8. Convergence — 5 sources
  await bench("convergence-5src", "POST", "/api/v1/score/convergence", {
    sources: Array.from({ length: 5 }, (_, i) => ({
      id: `s${i}`, name: `Source ${i}`, probability: 0.5 + (Math.random() - 0.5) * 0.4,
      volume: 1000 * (i + 1), lastUpdated: Date.now(),
    })),
  }, 50, (b) => b.score >= 0 && b.score <= 1);

  // 9. Calibration — 100 predictions
  await bench("calibration-100", "POST", "/api/v1/score/calibration", {
    predictions: Array.from({ length: 100 }, () => Math.random()),
    outcomes: Array.from({ length: 100 }, () => Math.round(Math.random())),
  }, 50, (b) => b.brier_score >= 0 && b.brier_score <= 1);

  // 10. Monte Carlo — 5000 iterations
  await bench("montecarlo-5k", "POST", "/api/v1/simulate/montecarlo", {
    distribution: "normal", params: { mean: 100000, stddev: 25000 }, iterations: 5000,
  }, 20, (b) => b.mean > 90000 && b.mean < 110000);

  // 11. Monte Carlo — 500 iterations (fast)
  await bench("montecarlo-500", "POST", "/api/v1/simulate/montecarlo", {
    distribution: "lognormal", params: { mean: 11, stddev: 0.5 }, iterations: 500,
  }, 50, (b) => b.mean > 0);

  // 12. Genetic Algorithm — 30 pop, 50 gen
  await bench("ga-30pop-50gen", "POST", "/api/v1/optimize/evolve", {
    populationSize: 30, maxGenerations: 50, geneLength: 4,
    bounds: Array.from({ length: 4 }, () => ({ min: 0, max: 100 })),
    mutationRate: 0.05, crossoverRate: 0.85,
    selectionMethod: "tournament", crossoverMethod: "uniform",
    fitnessWeights: [0.4, 0.3, 0.2, 0.1],
  }, 20, (b) => b.bestChromosome && b.executionTimeMs < 500);

  // 13. Bayesian — 3 factors
  await bench("bayesian-3factor", "POST", "/api/v1/predict/bayesian", {
    prior: 0.5,
    evidence: [
      { factor: "data", weight: 0.4, value: 0.75 },
      { factor: "expert", weight: 0.3, value: 0.60 },
      { factor: "base", weight: 0.3, value: 0.40 },
    ],
  }, 50, (b) => b.posterior >= 0 && b.posterior <= 1);

  // 14. Ensemble — 4 models
  await bench("ensemble-4model", "POST", "/api/v1/predict/ensemble", {
    predictions: [
      { modelId: "a", prediction: 0.72, confidence: 0.85, historicalAccuracy: 0.78 },
      { modelId: "b", prediction: 0.68, confidence: 0.80, historicalAccuracy: 0.74 },
      { modelId: "c", prediction: 0.45, confidence: 0.70, historicalAccuracy: 0.65 },
      { modelId: "d", prediction: 0.80, confidence: 0.60, historicalAccuracy: 0.82 },
    ],
  }, 50, (b) => b.consensus >= 0 && b.consensus <= 1);

  // 15. Scenario — 3 scenarios
  await bench("scenario-3", "POST", "/api/v1/simulate/scenario", {
    scenarios: [
      { name: "Aggressive", variables: { spend: 100000, price: 29, team: 10 } },
      { name: "Conservative", variables: { spend: 30000, price: 49, team: 5 } },
      { name: "Balanced", variables: { spend: 60000, price: 39, team: 7 } },
    ],
    baseCase: { spend: 50000, price: 39, team: 6 },
  }, 50, (b) => b.results?.length > 0);

  // Summary
  console.log("\n=== PERFORMANCE SUMMARY ===\n");
  console.log("Endpoint".padEnd(26) + "Avg(ms)".padStart(8) + "P95(ms)".padStart(8) + "Ops/s".padStart(8) + "Size(b)".padStart(8) + " Correct");
  console.log("-".repeat(75));
  for (const r of results) {
    console.log(
      r.name.padEnd(26) +
      String(r.avgMs).padStart(8) +
      String(r.p95Ms).padStart(8) +
      String(r.opsPerSec).padStart(8) +
      String(r.outputSize).padStart(8) +
      (r.correct ? "   OK" : "   FAIL")
    );
  }

  // Categorize
  const fast = results.filter(r => r.avgMs < 5);
  const medium = results.filter(r => r.avgMs >= 5 && r.avgMs < 50);
  const slow = results.filter(r => r.avgMs >= 50);

  console.log(`\nFast (<5ms): ${fast.length} | Medium (5-50ms): ${medium.length} | Slow (>50ms): ${slow.length}`);
  console.log(`All correct: ${results.every(r => r.correct) ? "YES" : "NO — check failures"}`);

  await app.close();
}

main().catch(console.error);
