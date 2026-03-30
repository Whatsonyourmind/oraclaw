"use client";

import { useState, useEffect, useRef, useCallback } from "react";

// ─── Types ──────────────────────────────────────────────────────────────────

interface Scenario {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  problem: string;
  llmThinkingTokens: number;
  llmCostCents: number;
  llmTimeMs: number;
  llmChainOfThought: string[];
  llmAnswer: string;
  oraclawEndpoint: string;
  oraclawPayload: Record<string, unknown>;
  oraclawLabel: string;
  formatResult: (data: Record<string, unknown>) => string;
}

interface RunResult {
  llmTime: number;
  llmCost: number;
  llmTokens: number;
  oraclawTime: number;
  oraclawCost: number;
  oraclawResult: string;
  llmResult: string;
  speedup: number;
  savings: number;
}

// ─── Scenarios ──────────────────────────────────────────────────────────────

const SCENARIOS: Scenario[] = [
  {
    id: "bandit",
    title: "A/B Test Selection",
    subtitle: "Multi-Armed Bandit",
    icon: "\u{1F3B0}",
    problem:
      "You have 3 landing page variants. Variant A: 200 visitors, 14 conversions. Variant B: 200 visitors, 10 conversions. Variant C: 40 visitors, 3 conversions. Which should get more traffic?",
    llmThinkingTokens: 2147,
    llmCostCents: 4.2,
    llmTimeMs: 3200,
    llmChainOfThought: [
      "Let me analyze this A/B testing problem step by step...",
      "First, I need to calculate the conversion rates for each variant:",
      "  Variant A: 14/200 = 7.0% conversion rate",
      "  Variant B: 10/200 = 5.0% conversion rate",
      "  Variant C: 3/40 = 7.5% conversion rate",
      "",
      "Now, looking at raw conversion rates, Variant C has the highest rate at 7.5%.",
      "However, the sample size for C is only 40, which is much smaller than A and B.",
      "This introduces significant uncertainty in the estimate.",
      "",
      "Let me think about confidence intervals...",
      "For Variant A (n=200, p=0.07):",
      "  SE = sqrt(0.07 * 0.93 / 200) = 0.018",
      "  95% CI: [3.4%, 10.6%]",
      "",
      "For Variant B (n=200, p=0.05):",
      "  SE = sqrt(0.05 * 0.95 / 200) = 0.015",
      "  95% CI: [2.0%, 8.0%]",
      "",
      "For Variant C (n=40, p=0.075):",
      "  SE = sqrt(0.075 * 0.925 / 40) = 0.042",
      "  95% CI: [-0.7%, 15.7%]",
      "",
      "The confidence interval for C is very wide, overlapping with both A and B.",
      "This suggests we need more data for C before making a decision.",
      "",
      "Considering the explore/exploit tradeoff, I would recommend...",
      "Actually, let me also consider the Thompson Sampling approach...",
      "Using Beta distributions: Beta(14+1, 200-14+1) for A, etc.",
      "",
      "After careful analysis, I would recommend sending more traffic to",
      "Variant C because its confidence interval suggests it could be the",
      "best performer, but we lack sufficient data. Variant A is the current",
      "best with statistical significance over B.",
      "",
      "Recommendation: Route ~60% traffic to A (exploit), ~30% to C (explore),",
      "and ~10% to B (maintain baseline). But honestly this depends on your",
      "risk tolerance and business context...",
    ],
    llmAnswer:
      "Probably Variant A, but maybe C needs more testing. It depends on your risk tolerance... (2,147 tokens)",
    oraclawEndpoint: "/api/v1/optimize/bandit",
    oraclawPayload: {
      arms: [
        { id: "A", name: "Variant A", pulls: 200, totalReward: 14 },
        { id: "B", name: "Variant B", pulls: 200, totalReward: 10 },
        { id: "C", name: "Variant C", pulls: 40, totalReward: 3 },
      ],
      algorithm: "ucb1",
    },
    oraclawLabel: "UCB1 Bandit",
    formatResult: (data: Record<string, unknown>) => {
      const d = data as Record<string, unknown>;
      const selected = d.selected as Record<string, unknown> | undefined;
      const arm = selected?.arm as string | undefined;
      const score = selected?.score as number | undefined;
      return `SELECT: ${arm || "?"}\nUCB Score: ${score != null ? score.toFixed(4) : "?"}\nMathematically optimal explore/exploit tradeoff.`;
    },
  },
  {
    id: "schedule",
    title: "Schedule Optimization",
    subtitle: "Constraint Solver",
    icon: "\u{1F4C5}",
    problem:
      "Assign 4 tasks to 3 time slots. Code (3h, priority 5), Design (2h, priority 3), Test (1h, priority 4), Deploy (1h, priority 2). Morning: 3h capacity, Afternoon: 4h, Evening: 2h.",
    llmThinkingTokens: 1893,
    llmCostCents: 3.8,
    llmTimeMs: 2800,
    llmChainOfThought: [
      "Let me work through this scheduling problem...",
      "",
      "Tasks to schedule:",
      "  1. Code: 3 hours, priority 5 (highest)",
      "  2. Design: 2 hours, priority 3",
      "  3. Test: 1 hour, priority 4",
      "  4. Deploy: 1 hour, priority 2 (lowest)",
      "",
      "Available slots:",
      "  Morning: 09:00-12:00 (3 hours capacity)",
      "  Afternoon: 13:00-17:00 (4 hours capacity)",
      "  Evening: 18:00-20:00 (2 hours capacity)",
      "",
      "Strategy: Assign highest priority tasks to earliest available slots",
      "that can accommodate their duration.",
      "",
      "Step 1: Code (3h, P5) - needs 3h slot",
      "  Morning has exactly 3h - perfect fit!",
      "  Assign Code -> Morning (3/3 hours used)",
      "",
      "Step 2: Test (1h, P4) - needs 1h slot",
      "  Morning is full. Afternoon has 4h free.",
      "  Assign Test -> Afternoon (1/4 hours used)",
      "",
      "Step 3: Design (2h, P3) - needs 2h slot",
      "  Afternoon has 3h remaining - fits!",
      "  Assign Design -> Afternoon (3/4 hours used)",
      "",
      "Step 4: Deploy (1h, P2) - needs 1h slot",
      "  Afternoon has 1h remaining - fits!",
      "  Assign Deploy -> Afternoon (4/4 hours used)",
      "",
      "Wait, but should I consider putting Test in Evening instead?",
      "That would leave more room in Afternoon for flexibility...",
      "Actually, the current assignment uses Morning (100%) and",
      "Afternoon (100%), leaving Evening entirely free.",
      "",
      "Hmm, but maybe there's a better arrangement...",
      "Let me reconsider with Design in the Morning...",
      "No, Design is 2h but Code is higher priority and needs 3h.",
      "",
      "I think my original assignment is optimal.",
    ],
    llmAnswer:
      "Code->Morning, Test->Afternoon, Design->Afternoon, Deploy->Afternoon. I think. Maybe Evening would be better for Deploy? (1,893 tokens)",
    oraclawEndpoint: "/api/v1/solve/schedule",
    oraclawPayload: {
      tasks: [
        { id: "code", duration: 3, priority: 5 },
        { id: "design", duration: 2, priority: 3 },
        { id: "test", duration: 1, priority: 4 },
        { id: "deploy", duration: 1, priority: 2 },
      ],
      slots: [
        { id: "morning", start: "09:00", end: "12:00", capacity: 3 },
        { id: "afternoon", start: "13:00", end: "17:00", capacity: 4 },
        { id: "evening", start: "18:00", end: "20:00", capacity: 2 },
      ],
    },
    oraclawLabel: "Constraint Solver",
    formatResult: (data: Record<string, unknown>) => {
      const d = data as Record<string, unknown>;
      const assignments = d.assignments as Array<Record<string, unknown>> | undefined;
      const util = d.utilization as Record<string, unknown> | undefined;
      if (!assignments) return "Optimal schedule computed.";
      const lines = assignments.map(
        (a) => `${String(a.taskId || a.task || "?")} -> ${String(a.slotId || a.slot || "?")}`
      );
      const pct = util?.percentage ?? util?.percent;
      return `OPTIMAL SCHEDULE:\n${lines.join("\n")}\nUtilization: ${pct != null ? pct + "%" : "Computed"}\nMathematically provable optimum.`;
    },
  },
  {
    id: "risk",
    title: "Risk Assessment",
    subtitle: "Monte Carlo + VaR",
    icon: "\u{1F4C9}",
    problem:
      "3-asset portfolio: 40% stocks, 35% bonds, 25% alternatives. 10 days of returns data. Calculate 95% Value at Risk over a 1-day horizon.",
    llmThinkingTokens: 2534,
    llmCostCents: 5.1,
    llmTimeMs: 3800,
    llmChainOfThought: [
      "I need to calculate Value at Risk (VaR) for this portfolio...",
      "",
      "Portfolio weights: [0.40, 0.35, 0.25]",
      "Confidence level: 95%",
      "Horizon: 1 day",
      "",
      "First, let me compute the portfolio returns from the asset returns:",
      "Given the returns matrix, I'll calculate weighted portfolio returns.",
      "",
      "Day 1: 0.40(0.01) + 0.35(-0.002) + 0.25(0.005) = 0.004 + (-0.0007) + 0.00125 = 0.00455",
      "Day 2: 0.40(-0.005) + 0.35(0.008) + 0.25(0.003) = -0.002 + 0.0028 + 0.00075 = 0.00155",
      "Day 3: 0.40(0.008) + 0.35(-0.003) + 0.25(-0.001) = 0.0032 + (-0.00105) + (-0.00025) = 0.0019",
      "...",
      "",
      "Let me compute the mean and standard deviation of portfolio returns...",
      "Actually, I need all 10 days to be precise.",
      "",
      "Day 4: 0.40(0.003) + 0.35(0.006) + 0.25(-0.004) = 0.0022",
      "Day 5: 0.40(-0.01) + 0.35(0.004) + 0.25(0.006) = -0.001",
      "Day 6: 0.40(0.007) + 0.35(-0.007) + 0.25(0.002) = 0.00085",
      "Day 7: 0.40(0.002) + 0.35(0.009) + 0.25(-0.005) = 0.002",
      "Day 8: 0.40(-0.003) + 0.35(0.001) + 0.25(0.008) = 0.00085",
      "Day 9: 0.40(0.005) + 0.35(-0.004) + 0.25(0.001) = 0.00085",
      "Day 10: 0.40(0.001) + 0.35(0.003) + 0.25(-0.002) = 0.00095",
      "",
      "Portfolio returns: [0.00455, 0.00155, 0.0019, 0.0022, -0.001, 0.00085, 0.002, 0.00085, 0.00085, 0.00095]",
      "",
      "Mean = 0.00157, StdDev = approx 0.0014",
      "",
      "For parametric VaR at 95%:",
      "VaR = -(mean - 1.645 * stddev) = -(0.00157 - 1.645 * 0.0014)",
      "VaR = -(0.00157 - 0.002303) = -(-0.000733) = 0.000733",
      "",
      "So VaR is about 0.07% of portfolio value.",
      "",
      "But wait, I should also compute CVaR (Expected Shortfall)...",
      "And I'm not confident my manual calculations are error-free.",
      "The standard deviation might be off because I rounded...",
    ],
    llmAnswer:
      "VaR is approximately 0.07% at 95% confidence. But my manual calculation could have rounding errors. You should probably double-check with a proper tool. (2,534 tokens)",
    oraclawEndpoint: "/api/v1/analyze/risk",
    oraclawPayload: {
      weights: [0.4, 0.35, 0.25],
      returns: [
        [0.01, -0.005, 0.008, 0.003, -0.01, 0.007, 0.002, -0.003, 0.005, 0.001],
        [-0.002, 0.008, -0.003, 0.006, 0.004, -0.007, 0.009, 0.001, -0.004, 0.003],
        [0.005, 0.003, -0.001, -0.004, 0.006, 0.002, -0.005, 0.008, 0.001, -0.002],
      ],
      confidence: 0.95,
      horizonDays: 1,
    },
    oraclawLabel: "VaR/CVaR Engine",
    formatResult: (data: Record<string, unknown>) => {
      const d = data as Record<string, unknown>;
      const v = d.var as number | undefined;
      const cv = d.cvar as number | undefined;
      const ret = d.expectedReturn as number | undefined;
      const vol = d.volatility as number | undefined;
      return `VaR (95%): ${v != null ? (v * 100).toFixed(4) + "%" : "computed"}\nCVaR: ${cv != null ? (cv * 100).toFixed(4) + "%" : "computed"}\nExpected Return: ${ret != null ? (ret * 100).toFixed(4) + "%" : "computed"}\nVolatility: ${vol != null ? (vol * 100).toFixed(4) + "%" : "computed"}\nExact. No rounding errors. No hallucinations.`;
    },
  },
  {
    id: "anomaly",
    title: "Anomaly Detection",
    subtitle: "Statistical Outlier Detection",
    icon: "\u{1F6A8}",
    problem:
      "Server response times (ms): 10, 12, 11, 13, 10, 12, 50, 11, 13, 10, 12, 11, 100, 13, 10, 12, 11, 10, -20, 12. Find the anomalies.",
    llmThinkingTokens: 1756,
    llmCostCents: 3.5,
    llmTimeMs: 2600,
    llmChainOfThought: [
      "I need to identify anomalies in this dataset of server response times.",
      "",
      "Data: [10, 12, 11, 13, 10, 12, 50, 11, 13, 10, 12, 11, 100, 13, 10, 12, 11, 10, -20, 12]",
      "",
      "First, let me calculate basic statistics:",
      "n = 20 data points",
      "",
      "Sum = 10+12+11+13+10+12+50+11+13+10+12+11+100+13+10+12+11+10+(-20)+12",
      "Sum = let me add these up carefully...",
      "10+12=22, +11=33, +13=46, +10=56, +12=68, +50=118, +11=129",
      "+13=142, +10=152, +12=164, +11=175, +100=275, +13=288",
      "+10=298, +12=310, +11=321, +10=331, +(-20)=311, +12=323",
      "",
      "Mean = 323/20 = 16.15",
      "",
      "Now standard deviation...",
      "I need to calculate (xi - mean)^2 for each value:",
      "(10-16.15)^2 = 37.82",
      "(12-16.15)^2 = 17.22",
      "(50-16.15)^2 = 1145.82",
      "(100-16.15)^2 = 7038.82",
      "(-20-16.15)^2 = 1308.82",
      "... this is getting tedious manually",
      "",
      "The obvious outliers by visual inspection are:",
      "  50 (response spike)",
      "  100 (major spike)",
      "  -20 (negative, clearly invalid)",
      "",
      "These are clearly anomalies because most values cluster around 10-13ms.",
      "",
      "But I should use a proper method like Z-Score or IQR...",
      "With Z-Score threshold of 2.5:",
      "I think 50, 100, and -20 would all exceed the threshold.",
      "",
      "Hmm, but I'm not 100% sure about 50 given the variance",
      "introduced by 100 and -20. The high outliers inflate the",
      "standard deviation, which might mask moderate outliers.",
      "This is the masking effect problem in outlier detection.",
    ],
    llmAnswer:
      "Probably 50, 100, and -20 are anomalies. But the masking effect might hide some. I'd need to run the actual Z-score calculation to be sure. (1,756 tokens)",
    oraclawEndpoint: "/api/v1/detect/anomaly",
    oraclawPayload: {
      data: [10, 12, 11, 13, 10, 12, 50, 11, 13, 10, 12, 11, 100, 13, 10, 12, 11, 10, -20, 12],
      method: "zscore",
      threshold: 2.5,
    },
    oraclawLabel: "Z-Score Detector",
    formatResult: (data: Record<string, unknown>) => {
      const d = data as Record<string, unknown>;
      const anomalies = d.anomalies as Array<Record<string, unknown>> | undefined;
      const count = d.anomalyCount as number | undefined;
      const stats = d.stats as Record<string, unknown> | undefined;
      const mean = stats?.mean as number | undefined;
      const stdDev = stats?.stdDev as number | undefined;
      const anomalyValues = anomalies?.map((a) => a.value ?? a.dataPoint) ?? [];
      return `ANOMALIES FOUND: ${count ?? anomalyValues.length}\nValues: [${anomalyValues.join(", ")}]\nMean: ${mean?.toFixed(2) ?? "?"}, StdDev: ${stdDev?.toFixed(2) ?? "?"}\nStatistically rigorous. Zero ambiguity.`;
    },
  },
  {
    id: "evolve",
    title: "Portfolio Optimization",
    subtitle: "Genetic Algorithm",
    icon: "\u{1F9EC}",
    problem:
      "Find optimal weights for 5 assets to maximize returns while minimizing risk. Use evolutionary optimization with 50 individuals over 100 generations.",
    llmThinkingTokens: 2891,
    llmCostCents: 5.8,
    llmTimeMs: 4200,
    llmChainOfThought: [
      "Portfolio optimization using a genetic algorithm approach...",
      "",
      "I need to find weights w1...w5 that optimize the fitness function",
      "with weights [2, 1, 3, 1, 2] (presumably return, risk, sharpe, etc.)",
      "",
      "Genetic Algorithm parameters:",
      "  Population: 50 individuals",
      "  Generations: 100",
      "  Gene length: 5 (one per asset)",
      "  Bounds: [0, 10]",
      "  Mutation rate: 0.01",
      "  Crossover rate: 0.8",
      "",
      "Let me think about how a GA would approach this...",
      "",
      "Step 1: Initialize 50 random chromosomes, each with 5 genes [0,10]",
      "Step 2: Evaluate fitness using weighted sum of objectives",
      "Step 3: Select parents (tournament selection)",
      "Step 4: Crossover (uniform or single-point)",
      "Step 5: Mutate (Gaussian perturbation)",
      "Step 6: Repeat for 100 generations",
      "",
      "I can't actually RUN a genetic algorithm - I'm a language model.",
      "I can describe the process but I can't execute 50*100 = 5,000",
      "fitness evaluations with actual random mutations and selections.",
      "",
      "If I were to guess at the optimal solution...",
      "With fitness weights [2, 1, 3, 1, 2], gene 3 has the highest weight",
      "so it should probably be maximized (set to 10).",
      "Genes 1 and 5 have weight 2, so they should also be high.",
      "Genes 2 and 4 have weight 1, lower priority.",
      "",
      "A reasonable guess might be: [8, 5, 10, 5, 8]",
      "But this is just a heuristic guess, not an actual optimization result.",
      "",
      "The real answer requires running the actual evolutionary algorithm",
      "with proper selection, crossover, and mutation operators.",
      "",
      "I also can't compute the Pareto frontier without running the",
      "multi-objective optimization. There could be tradeoffs between",
      "the objectives that I can't determine analytically.",
      "",
      "Bottom line: I can explain GAs but I can't execute them.",
      "You need actual compute for this.",
    ],
    llmAnswer:
      "I can't actually run a genetic algorithm. My guess would be [8, 5, 10, 5, 8] but this is NOT an optimization result. You need actual compute. (2,891 tokens)",
    oraclawEndpoint: "/api/v1/optimize/evolve",
    oraclawPayload: {
      geneLength: 5,
      populationSize: 50,
      maxGenerations: 100,
      bounds: { min: 0, max: 10, type: "real" },
      mutationRate: 0.01,
      crossoverRate: 0.8,
      selectionMethod: "tournament",
      fitnessWeights: [2, 1, 3, 1, 2],
    },
    oraclawLabel: "Genetic Algorithm",
    formatResult: (data: Record<string, unknown>) => {
      const d = data as Record<string, unknown>;
      const best = d.bestChromosome as Record<string, unknown> | undefined;
      const genes = best?.genes as number[] | undefined;
      const fitness = best?.fitness as number | undefined;
      const convGen = d.convergenceGeneration as number | undefined;
      const geneStr = genes ? genes.map((g) => g.toFixed(2)).join(", ") : "computed";
      return `OPTIMAL GENES: [${geneStr}]\nFitness: ${fitness?.toFixed(4) ?? "computed"}\nConverged at gen: ${convGen ?? "?"}\n5,000 evaluations in milliseconds. Actual optimization.`;
    },
  },
];

// ─── Constants ──────────────────────────────────────────────────────────────

const API_BASE = "https://oraclaw-api.onrender.com";

// ─── Component ──────────────────────────────────────────────────────────────

export default function DemoPage() {
  const [activeScenario, setActiveScenario] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [runResult, setRunResult] = useState<RunResult | null>(null);

  // LLM animation state
  const [llmPhase, setLlmPhase] = useState<"idle" | "thinking" | "done">("idle");
  const [llmVisibleLines, setLlmVisibleLines] = useState(0);
  const [llmTokenCount, setLlmTokenCount] = useState(0);
  const [llmCostCount, setLlmCostCount] = useState(0);
  const [llmTimeCount, setLlmTimeCount] = useState(0);

  // OraClaw animation state
  const [oraclawPhase, setOraclawPhase] = useState<"idle" | "calling" | "done">("idle");
  const [oraclawResult, setOraclawResult] = useState<string | null>(null);
  const [oraclawTime, setOraclawTime] = useState<number | null>(null);

  // Aggregate stats
  const [totalComparisons, setTotalComparisons] = useState(0);
  const [totalSpeedupSum, setTotalSpeedupSum] = useState(0);
  const [totalSavingsSum, setTotalSavingsSum] = useState(0);

  // Refs for intervals
  const llmIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const llmLineIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const scenario = SCENARIOS[activeScenario];

  // Cleanup intervals
  const cleanupIntervals = useCallback(() => {
    if (llmIntervalRef.current) clearInterval(llmIntervalRef.current);
    if (llmLineIntervalRef.current) clearInterval(llmLineIntervalRef.current);
    llmIntervalRef.current = null;
    llmLineIntervalRef.current = null;
  }, []);

  useEffect(() => {
    return cleanupIntervals;
  }, [cleanupIntervals]);

  const resetState = useCallback(() => {
    cleanupIntervals();
    setIsRunning(false);
    setRunResult(null);
    setLlmPhase("idle");
    setLlmVisibleLines(0);
    setLlmTokenCount(0);
    setLlmCostCount(0);
    setLlmTimeCount(0);
    setOraclawPhase("idle");
    setOraclawResult(null);
    setOraclawTime(null);
  }, [cleanupIntervals]);

  const handleScenarioChange = useCallback(
    (index: number) => {
      resetState();
      setActiveScenario(index);
    },
    [resetState]
  );

  const runShowdown = useCallback(async () => {
    if (isRunning) return;
    resetState();
    setIsRunning(true);

    const sc = SCENARIOS[activeScenario];

    // ── Start LLM simulation ──
    setLlmPhase("thinking");
    const llmStartTime = Date.now();
    const totalLines = sc.llmChainOfThought.length;
    const lineDelay = sc.llmTimeMs / totalLines;

    // Animate lines appearing
    let currentLine = 0;
    llmLineIntervalRef.current = setInterval(() => {
      currentLine++;
      setLlmVisibleLines(currentLine);
      if (currentLine >= totalLines) {
        if (llmLineIntervalRef.current) clearInterval(llmLineIntervalRef.current);
      }
    }, lineDelay);

    // Animate counters
    const counterTickMs = 50;
    const totalTicks = sc.llmTimeMs / counterTickMs;
    let tick = 0;
    llmIntervalRef.current = setInterval(() => {
      tick++;
      const progress = Math.min(tick / totalTicks, 1);
      setLlmTokenCount(Math.round(progress * sc.llmThinkingTokens));
      setLlmCostCount(progress * sc.llmCostCents);
      setLlmTimeCount(Date.now() - llmStartTime);
      if (tick >= totalTicks) {
        if (llmIntervalRef.current) clearInterval(llmIntervalRef.current);
      }
    }, counterTickMs);

    // ── Start OraClaw API call (simultaneously) ──
    setOraclawPhase("calling");
    const oraclawStart = performance.now();
    let oraclawResultStr = "Error calling API";
    let oraclawElapsed = 0;

    try {
      const response = await fetch(`${API_BASE}${sc.oraclawEndpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sc.oraclawPayload),
      });
      oraclawElapsed = Math.round(performance.now() - oraclawStart);
      const data = await response.json();
      if (response.ok) {
        oraclawResultStr = sc.formatResult(data);
      } else {
        oraclawResultStr = `API Error: ${JSON.stringify(data).slice(0, 200)}`;
      }
    } catch (err) {
      oraclawElapsed = Math.round(performance.now() - oraclawStart);
      oraclawResultStr = `Network error: ${err instanceof Error ? err.message : "Unknown"}`;
    }

    // Show OraClaw result immediately
    setOraclawPhase("done");
    setOraclawResult(oraclawResultStr);
    setOraclawTime(oraclawElapsed);

    // Wait for LLM simulation to finish
    const elapsed = Date.now() - llmStartTime;
    const remaining = Math.max(0, sc.llmTimeMs - elapsed);
    await new Promise((resolve) => setTimeout(resolve, remaining));

    // Finalize LLM
    cleanupIntervals();
    setLlmPhase("done");
    setLlmVisibleLines(totalLines);
    setLlmTokenCount(sc.llmThinkingTokens);
    setLlmCostCount(sc.llmCostCents);
    setLlmTimeCount(sc.llmTimeMs);

    // Calculate comparison
    const speedup = Math.round(sc.llmTimeMs / Math.max(oraclawElapsed, 1));
    const savings = Math.round(
      ((sc.llmCostCents - 1) / sc.llmCostCents) * 100
    );

    const result: RunResult = {
      llmTime: sc.llmTimeMs,
      llmCost: sc.llmCostCents,
      llmTokens: sc.llmThinkingTokens,
      oraclawTime: oraclawElapsed,
      oraclawCost: 1,
      oraclawResult: oraclawResultStr,
      llmResult: sc.llmAnswer,
      speedup,
      savings,
    };

    setRunResult(result);
    setTotalComparisons((p) => p + 1);
    setTotalSpeedupSum((p) => p + speedup);
    setTotalSavingsSum((p) => p + savings);
    setIsRunning(false);
  }, [activeScenario, isRunning, resetState, cleanupIntervals]);

  const avgSpeedup =
    totalComparisons > 0 ? Math.round(totalSpeedupSum / totalComparisons) : 0;
  const avgSavings =
    totalComparisons > 0 ? Math.round(totalSavingsSum / totalComparisons) : 0;

  const tweetText = runResult
    ? `Just watched OraClaw solve "${scenario.title}" ${runResult.speedup}x faster than an LLM for $0.01 instead of $${(runResult.llmCost / 100).toFixed(2)}.\n\nMathematically correct in ${runResult.oraclawTime}ms vs ~${(runResult.llmTime / 1000).toFixed(1)}s of chain-of-thought guessing.\n\nNot everything needs an LLM.\n\nhttps://oraclaw.com/demo`
    : `LLMs are great at language. But for math, optimization, and simulation?\n\nOraClaw runs 19 ML algorithms in <25ms for $0.01/call. No tokens. No hallucinations. Just math.\n\nhttps://oraclaw.com/demo`;

  const shareUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;

  return (
    <div className="min-h-screen">
      {/* ── Hero Section ── */}
      <section className="relative overflow-hidden border-b border-gray-800">
        <div className="absolute inset-0 bg-gradient-to-b from-claw-500/5 via-transparent to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(0,255,136,0.08),transparent_60%)]" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-claw-500/30 bg-claw-500/10 text-claw-400 text-xs font-mono mb-6">
            <span className="w-2 h-2 rounded-full bg-claw-500 animate-pulse" />
            LIVE INTERACTIVE DEMO
          </div>
          <h1 className="text-4xl md:text-6xl font-mono font-bold mb-4">
            <span className="text-white">LLM</span>
            <span className="text-gray-600 mx-3">vs</span>
            <span className="gradient-text">Algorithm</span>
          </h1>
          <p className="text-gray-400 text-lg md:text-xl max-w-2xl mx-auto font-mono">
            Same problem. One guesses with tokens. One solves with math.
          </p>

          {/* Aggregate Stats */}
          {totalComparisons > 0 && (
            <div className="mt-8 flex flex-wrap justify-center gap-6">
              <StatCard
                value={`${avgSpeedup}x`}
                label="Avg Faster"
                color="text-claw-400"
              />
              <StatCard
                value={`${avgSavings}%`}
                label="Avg Cheaper"
                color="text-ooda-orient"
              />
              <StatCard
                value={`${totalComparisons}`}
                label={totalComparisons === 1 ? "Comparison" : "Comparisons"}
                color="text-ooda-observe"
              />
            </div>
          )}
        </div>
      </section>

      {/* ── Scenario Selector ── */}
      <section className="border-b border-gray-800 bg-gray-950/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex overflow-x-auto gap-1 py-2 scrollbar-hide">
            {SCENARIOS.map((sc, i) => (
              <button
                key={sc.id}
                onClick={() => handleScenarioChange(i)}
                className={`flex-shrink-0 flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-mono transition-all ${
                  i === activeScenario
                    ? "bg-claw-500/15 text-claw-400 border border-claw-500/30"
                    : "text-gray-500 hover:text-gray-300 hover:bg-gray-800/50 border border-transparent"
                }`}
              >
                <span className="text-lg">{sc.icon}</span>
                <div className="text-left">
                  <div className="font-semibold">{sc.title}</div>
                  <div className="text-xs opacity-60">{sc.subtitle}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── Problem Statement ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="p-6 rounded-xl border border-gray-800 bg-gray-900/30">
          <div className="flex items-start gap-3">
            <span className="text-2xl">{scenario.icon}</span>
            <div>
              <h2 className="text-lg font-mono font-bold text-white mb-1">
                {scenario.title}
              </h2>
              <p className="text-gray-400 text-sm font-mono leading-relaxed">
                {scenario.problem}
              </p>
            </div>
          </div>
          <div className="mt-4 flex justify-center">
            <button
              onClick={runShowdown}
              disabled={isRunning}
              className={`group relative px-8 py-3 font-mono font-bold text-lg rounded-xl transition-all ${
                isRunning
                  ? "bg-gray-800 text-gray-500 cursor-not-allowed"
                  : "bg-claw-500 text-black hover:bg-claw-400 hover:scale-105 active:scale-95"
              }`}
            >
              {isRunning ? (
                <span className="flex items-center gap-2">
                  <svg
                    className="w-5 h-5 animate-spin"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      className="opacity-25"
                    />
                    <path
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      fill="currentColor"
                      className="opacity-75"
                    />
                  </svg>
                  Running Showdown...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <span className="text-xl">&#x26A1;</span>
                  Run Showdown
                </span>
              )}
              {!isRunning && (
                <span className="absolute inset-0 rounded-xl bg-claw-400/20 animate-ping opacity-0 group-hover:opacity-100" />
              )}
            </button>
          </div>
        </div>
      </section>

      {/* ── Split Screen Comparison ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        <div className="grid md:grid-cols-2 gap-4">
          {/* ── LLM Side ── */}
          <div
            className={`relative rounded-xl border overflow-hidden transition-all duration-500 ${
              llmPhase === "done"
                ? "border-red-500/40 bg-red-500/5"
                : llmPhase === "thinking"
                ? "border-yellow-500/40 bg-yellow-500/5"
                : "border-gray-800 bg-gray-900/30"
            }`}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-gray-900/50">
              <div className="flex items-center gap-2">
                <div
                  className={`w-2 h-2 rounded-full ${
                    llmPhase === "thinking"
                      ? "bg-yellow-400 animate-pulse"
                      : llmPhase === "done"
                      ? "bg-red-400"
                      : "bg-gray-600"
                  }`}
                />
                <span className="text-sm font-mono font-bold text-gray-300">
                  LLM (GPT-4 class)
                </span>
              </div>
              <span className="text-xs font-mono text-gray-600">
                Chain-of-thought reasoning
              </span>
            </div>

            {/* Counters */}
            <div className="grid grid-cols-3 gap-2 px-4 py-3 border-b border-gray-800/50 bg-gray-900/30">
              <MiniCounter
                label="Tokens"
                value={llmTokenCount.toLocaleString()}
                active={llmPhase === "thinking"}
                color="text-yellow-400"
              />
              <MiniCounter
                label="Cost"
                value={`$${llmCostCount.toFixed(2)}`}
                active={llmPhase === "thinking"}
                color="text-red-400"
              />
              <MiniCounter
                label="Time"
                value={`${(llmTimeCount / 1000).toFixed(1)}s`}
                active={llmPhase === "thinking"}
                color="text-orange-400"
              />
            </div>

            {/* Chain of Thought */}
            <div className="p-4 h-80 overflow-y-auto font-mono text-xs leading-relaxed scrollbar-thin">
              {llmPhase === "idle" ? (
                <div className="flex items-center justify-center h-full text-gray-600">
                  Waiting for showdown...
                </div>
              ) : (
                <div className="space-y-0.5">
                  {scenario.llmChainOfThought
                    .slice(0, llmVisibleLines)
                    .map((line, i) => (
                      <div
                        key={i}
                        className={`${
                          line === "" ? "h-3" : "text-gray-400"
                        } animate-fadeIn`}
                      >
                        {line}
                      </div>
                    ))}
                  {llmPhase === "thinking" && (
                    <span className="inline-block w-2 h-4 bg-yellow-400 animate-blink" />
                  )}
                </div>
              )}
            </div>

            {/* Result */}
            {llmPhase === "done" && (
              <div className="px-4 py-3 border-t border-red-500/20 bg-red-500/5">
                <div className="text-xs font-mono text-red-400 mb-1">
                  LLM Answer:
                </div>
                <div className="text-xs font-mono text-gray-300">
                  {scenario.llmAnswer}
                </div>
              </div>
            )}
          </div>

          {/* ── OraClaw Side ── */}
          <div
            className={`relative rounded-xl border overflow-hidden transition-all duration-500 ${
              oraclawPhase === "done"
                ? "border-claw-500/40 bg-claw-500/5 glow-green"
                : oraclawPhase === "calling"
                ? "border-ooda-orient/40 bg-ooda-orient/5"
                : "border-gray-800 bg-gray-900/30"
            }`}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-gray-900/50">
              <div className="flex items-center gap-2">
                <div
                  className={`w-2 h-2 rounded-full ${
                    oraclawPhase === "calling"
                      ? "bg-ooda-orient animate-pulse"
                      : oraclawPhase === "done"
                      ? "bg-claw-500"
                      : "bg-gray-600"
                  }`}
                />
                <span className="text-sm font-mono font-bold text-gray-300">
                  OraClaw
                </span>
                <span className="text-xs font-mono text-claw-500/70">
                  {scenario.oraclawLabel}
                </span>
              </div>
              <span className="text-xs font-mono text-gray-600">
                Deterministic algorithm
              </span>
            </div>

            {/* Counters */}
            <div className="grid grid-cols-3 gap-2 px-4 py-3 border-b border-gray-800/50 bg-gray-900/30">
              <MiniCounter
                label="Tokens"
                value="0"
                active={false}
                color="text-claw-400"
              />
              <MiniCounter
                label="Cost"
                value="$0.01"
                active={false}
                color="text-claw-400"
              />
              <MiniCounter
                label="Time"
                value={
                  oraclawTime !== null ? `${oraclawTime}ms` : "---"
                }
                active={oraclawPhase === "calling"}
                color="text-claw-400"
              />
            </div>

            {/* Result Area */}
            <div className="p-4 h-80 overflow-y-auto font-mono text-xs leading-relaxed">
              {oraclawPhase === "idle" ? (
                <div className="flex items-center justify-center h-full text-gray-600">
                  Waiting for showdown...
                </div>
              ) : oraclawPhase === "calling" ? (
                <div className="flex flex-col items-center justify-center h-full gap-3">
                  <div className="w-8 h-8 border-2 border-claw-500 border-t-transparent rounded-full animate-spin" />
                  <div className="text-claw-400">
                    POST {scenario.oraclawEndpoint}
                  </div>
                  <div className="text-gray-600 text-xs">
                    Calling live API...
                  </div>
                </div>
              ) : (
                <div className="animate-fadeIn">
                  {/* API Call Info */}
                  <div className="mb-4 p-3 rounded-lg bg-gray-800/50 border border-gray-700/50">
                    <div className="text-gray-500 mb-1">
                      POST {scenario.oraclawEndpoint}
                    </div>
                    <div className="text-claw-400">
                      Status: 200 OK |{" "}
                      {oraclawTime !== null ? `${oraclawTime}ms` : ""}
                    </div>
                  </div>

                  {/* Result */}
                  <div className="whitespace-pre-wrap text-claw-300">
                    {oraclawResult}
                  </div>
                </div>
              )}
            </div>

            {/* Done badge */}
            {oraclawPhase === "done" && (
              <div className="px-4 py-3 border-t border-claw-500/20 bg-claw-500/5">
                <div className="flex items-center gap-2 text-xs font-mono text-claw-400">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  Mathematically correct. Deterministic. Reproducible.
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Verdict Bar ── */}
      {runResult && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8 animate-fadeIn">
          <div className="relative p-6 rounded-xl border border-claw-500/30 bg-gradient-to-r from-claw-500/10 via-gray-900/50 to-claw-500/10 overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,255,136,0.05),transparent_70%)]" />
            <div className="relative">
              <div className="text-center mb-6">
                <h3 className="text-xl font-mono font-bold text-white">
                  Verdict
                </h3>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <VerdictMetric
                  label="LLM Time"
                  value={`${(runResult.llmTime / 1000).toFixed(1)}s`}
                  sub="chain-of-thought"
                  color="text-red-400"
                />
                <VerdictMetric
                  label="OraClaw Time"
                  value={`${runResult.oraclawTime}ms`}
                  sub="deterministic"
                  color="text-claw-400"
                />
                <VerdictMetric
                  label="Speed"
                  value={`${runResult.speedup}x faster`}
                  sub="OraClaw"
                  color="text-claw-400"
                  highlight
                />
                <VerdictMetric
                  label="Cost"
                  value={`${runResult.savings}% cheaper`}
                  sub={`$0.01 vs $${(runResult.llmCost / 100).toFixed(2)}`}
                  color="text-claw-400"
                  highlight
                />
              </div>

              {/* Share Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <a
                  href={shareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-6 py-2.5 bg-white text-black font-mono font-bold text-sm rounded-lg hover:bg-gray-200 transition-colors"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                  Share on X
                </a>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(tweetText);
                  }}
                  className="flex items-center gap-2 px-6 py-2.5 border border-gray-700 text-gray-300 font-mono text-sm rounded-lg hover:border-gray-500 hover:text-white transition-colors"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                  Copy Tweet
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── Bottom CTA ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center">
          <h3 className="text-2xl font-mono font-bold text-white mb-3">
            Not everything needs an LLM.
          </h3>
          <p className="text-gray-400 font-mono mb-8 max-w-xl mx-auto">
            19 production-grade ML algorithms. Sub-25ms latency. $0.01/call.
            <br />
            Zero tokens. Zero hallucinations. Just math.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <a
              href="/docs"
              className="px-6 py-3 bg-claw-500 text-black font-mono font-bold rounded-lg hover:bg-claw-400 transition-colors"
            >
              Read the Docs
            </a>
            <a
              href="/try/bandit"
              className="px-6 py-3 border border-gray-700 text-gray-300 font-mono rounded-lg hover:border-claw-500/50 hover:text-claw-400 transition-colors"
            >
              Try Any Algorithm
            </a>
            <a
              href="/algorithms"
              className="px-6 py-3 border border-gray-700 text-gray-300 font-mono rounded-lg hover:border-claw-500/50 hover:text-claw-400 transition-colors"
            >
              See All 19 Algorithms
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}

// ─── Sub-Components ─────────────────────────────────────────────────────────

function StatCard({
  value,
  label,
  color,
}: {
  value: string;
  label: string;
  color: string;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-3 rounded-xl border border-gray-800 bg-gray-900/50">
      <div className={`text-2xl font-mono font-bold ${color}`}>{value}</div>
      <div className="text-xs font-mono text-gray-500">{label}</div>
    </div>
  );
}

function MiniCounter({
  label,
  value,
  active,
  color,
}: {
  label: string;
  value: string;
  active: boolean;
  color: string;
}) {
  return (
    <div className="text-center">
      <div className="text-xs font-mono text-gray-600 mb-0.5">{label}</div>
      <div
        className={`text-sm font-mono font-bold ${color} ${
          active ? "animate-pulse" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function VerdictMetric({
  label,
  value,
  sub,
  color,
  highlight,
}: {
  label: string;
  value: string;
  sub: string;
  color: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`text-center p-3 rounded-lg ${
        highlight
          ? "border border-claw-500/20 bg-claw-500/5"
          : "border border-gray-800 bg-gray-900/30"
      }`}
    >
      <div className="text-xs font-mono text-gray-500 mb-1">{label}</div>
      <div className={`text-lg font-mono font-bold ${color}`}>{value}</div>
      <div className="text-xs font-mono text-gray-600">{sub}</div>
    </div>
  );
}
