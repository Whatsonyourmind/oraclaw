/**
 * Test all 13 OraClaw API endpoints with realistic data.
 * Run: npx tsx scripts/test-all-endpoints.ts
 */

import Fastify from "fastify";
import { oracleRoutes } from "../apps/api/src/routes/oracle/index.js";

async function main() {
  const app = Fastify({ logger: false });
  await app.register(oracleRoutes);
  await app.ready();

  const results: Array<{ name: string; status: number; ok: boolean; output: unknown }> = [];

  async function test(name: string, method: string, url: string, payload?: unknown) {
    try {
      const res = await app.inject({ method: method as any, url, payload: payload as any });
      const body = JSON.parse(res.body);
      const ok = res.statusCode === 200;
      results.push({ name, status: res.statusCode, ok, output: body });
      console.log(`${ok ? "PASS" : "FAIL"} [${res.statusCode}] ${name}`);
      if (!ok) console.log("  Error:", JSON.stringify(body).slice(0, 200));
      return body;
    } catch (e: any) {
      results.push({ name, status: 500, ok: false, output: e.message });
      console.log(`FAIL [ERR] ${name}: ${e.message}`);
      return null;
    }
  }

  console.log("=== OraClaw API Endpoint Tests ===\n");

  // 1. Health
  await test("health", "GET", "/api/v1/health");

  // 2. Bandit (UCB1)
  await test("bandit-ucb1", "POST", "/api/v1/optimize/bandit", {
    arms: [
      { id: "a", name: "Variant A", pulls: 100, totalReward: 35 },
      { id: "b", name: "Variant B", pulls: 80, totalReward: 32 },
      { id: "c", name: "Variant C", pulls: 50, totalReward: 22 },
    ],
    algorithm: "ucb1",
  });

  // 3. Contextual Bandit
  await test("contextual-bandit", "POST", "/api/v1/optimize/contextual-bandit", {
    arms: [
      { id: "deep-work", name: "Deep Work" },
      { id: "quick-tasks", name: "Quick Tasks" },
    ],
    context: [0.8, 0.9, 0.2],
    history: [
      { armId: "deep-work", reward: 0.9, context: [0.3, 0.9, 0.1] },
      { armId: "quick-tasks", reward: 0.7, context: [0.8, 0.3, 0.9] },
    ],
  });

  // 4. Constraint Solver
  await test("constraint-solver", "POST", "/api/v1/solve/constraints", {
    direction: "maximize",
    objective: { ads: 2.5, content: 1.8, events: 3.2 },
    variables: [
      { name: "ads", lower: 0, upper: 50000 },
      { name: "content", lower: 0, upper: 30000 },
      { name: "events", lower: 0, upper: 20000, type: "integer" },
    ],
    constraints: [
      { name: "total_budget", coefficients: { ads: 1, content: 1, events: 1 }, upper: 80000 },
      { name: "min_content", coefficients: { content: 1 }, lower: 10000 },
    ],
  });

  // 5. Schedule Optimizer
  await test("schedule-optimizer", "POST", "/api/v1/solve/schedule", {
    tasks: [
      { id: "report", name: "Q1 Report", durationMinutes: 120, priority: 9, energyRequired: "high" },
      { id: "emails", name: "Clear Inbox", durationMinutes: 30, priority: 3, energyRequired: "low" },
      { id: "design", name: "Design Review", durationMinutes: 60, priority: 7, energyRequired: "medium" },
    ],
    slots: [
      { id: "morning", startTime: 1711350000, durationMinutes: 120, energyLevel: "high" },
      { id: "mid-am", startTime: 1711357200, durationMinutes: 60, energyLevel: "medium" },
      { id: "lunch", startTime: 1711360800, durationMinutes: 30, energyLevel: "low" },
    ],
  });

  // 6. Decision Graph
  await test("decision-graph", "POST", "/api/v1/analyze/graph", {
    nodes: [
      { id: "auth", type: "action", label: "Build Auth", urgency: "critical", confidence: 0.8, impact: 0.9, timestamp: Date.now() },
      { id: "payments", type: "action", label: "Stripe", urgency: "high", confidence: 0.6, impact: 0.8, timestamp: Date.now() },
      { id: "launch", type: "goal", label: "Launch", urgency: "critical", confidence: 0.5, impact: 1.0, timestamp: Date.now() },
    ],
    edges: [
      { source: "auth", target: "payments", type: "enables", weight: 0.9 },
      { source: "payments", target: "launch", type: "enables", weight: 0.9 },
    ],
    sourceGoal: "auth",
    targetGoal: "launch",
  });

  // 7. Convergence
  await test("convergence", "POST", "/api/v1/score/convergence", {
    sources: [
      { id: "poly", name: "Polymarket", probability: 0.67, volume: 5000000, lastUpdated: Date.now() },
      { id: "kalshi", name: "Kalshi", probability: 0.72, volume: 3000000, lastUpdated: Date.now() },
      { id: "meta", name: "Metaculus", probability: 0.63, lastUpdated: Date.now() },
      { id: "gpt", name: "GPT", probability: 0.41, lastUpdated: Date.now() },
    ],
  });

  // 8. Calibration
  await test("calibration", "POST", "/api/v1/score/calibration", {
    predictions: [0.80, 0.65, 0.30, 0.90, 0.55, 0.10],
    outcomes: [1, 1, 0, 1, 0, 0],
  });

  // 9. Monte Carlo
  await test("monte-carlo", "POST", "/api/v1/simulate/montecarlo", {
    distribution: "normal",
    params: { mean: 100000, stddev: 25000 },
    iterations: 5000,
  });

  // 10. Genetic Algorithm
  await test("genetic-algorithm", "POST", "/api/v1/optimize/evolve", {
    populationSize: 30,
    maxGenerations: 50,
    geneLength: 3,
    bounds: [{ min: 0, max: 100 }, { min: 0, max: 100 }, { min: 0, max: 100 }],
    mutationRate: 0.05,
    crossoverRate: 0.85,
    selectionMethod: "tournament",
    crossoverMethod: "uniform",
    fitnessWeights: [0.5, 0.3, 0.2],
  });

  // 11. Bayesian
  await test("bayesian", "POST", "/api/v1/predict/bayesian", {
    prior: 0.5,
    evidence: [
      { factor: "market_data", weight: 0.3, value: 0.75 },
      { factor: "expert_opinion", weight: 0.2, value: 0.60 },
      { factor: "base_rate", weight: 0.5, value: 0.40 },
    ],
  });

  // 12. Ensemble
  await test("ensemble", "POST", "/api/v1/predict/ensemble", {
    predictions: [
      { modelId: "claude", prediction: 0.72, confidence: 0.85, historicalAccuracy: 0.78 },
      { modelId: "gpt", prediction: 0.68, confidence: 0.80, historicalAccuracy: 0.74 },
      { modelId: "gemini", prediction: 0.45, confidence: 0.70, historicalAccuracy: 0.65 },
    ],
  });

  // 13. Scenario
  await test("scenario", "POST", "/api/v1/simulate/scenario", {
    scenarios: [
      { name: "Aggressive", variables: { spend: 100000, price: 29, team: 10 } },
      { name: "Conservative", variables: { spend: 30000, price: 49, team: 5 } },
    ],
    baseCase: { spend: 50000, price: 39, team: 6 },
  });

  // 14. Pricing
  await test("pricing", "GET", "/api/v1/pricing");

  // Summary
  console.log("\n=== SUMMARY ===");
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  console.log(`${passed} PASSED, ${failed} FAILED out of ${results.length} tests`);

  if (failed > 0) {
    console.log("\nFailed endpoints:");
    for (const r of results.filter((r) => !r.ok)) {
      console.log(`  - ${r.name}: ${r.status} — ${JSON.stringify(r.output).slice(0, 200)}`);
    }
  }

  // Print detailed output for key endpoints
  console.log("\n=== KEY OUTPUTS ===");
  for (const r of results) {
    if (r.ok && r.name !== "health" && r.name !== "pricing") {
      console.log(`\n--- ${r.name} ---`);
      console.log(JSON.stringify(r.output, null, 2).slice(0, 500));
    }
  }

  await app.close();
}

main().catch(console.error);
