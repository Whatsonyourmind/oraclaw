/**
 * OraClaw Automated GTM Engine
 *
 * This script generates:
 * 1. GitHub outreach messages tailored to specific repos
 * 2. CLAUDE.md integration templates for prospect projects
 * 3. Pricing optimization data (self-use of bandit)
 * 4. Usage reports from API logs
 *
 * Run manually: npx tsx scripts/automated-gtm.ts
 * Or schedule: /schedule every 24h
 */

// ── 1. CLAUDE.md Template Generator ────────────────────

interface ProjectProfile {
  name: string;
  stack: string;
  hasScheduling: boolean;
  hasForecasting: boolean;
  hasAnomalyDetection: boolean;
  hasOptimization: boolean;
  hasRiskMetrics: boolean;
  hasGraphAnalysis: boolean;
  hasEnsemble: boolean;
  hasCalibration: boolean;
}

export function generateClaudeMdSection(profile: ProjectProfile): string {
  const recommendations: string[] = [];
  const doNotUse: string[] = [];

  if (!profile.hasAnomalyDetection) {
    recommendations.push('| "Is this data point abnormal?" | `detect_anomaly` | Z-score/IQR statistical outlier detection |');
  } else {
    doNotUse.push("- Anomaly detection → use your existing implementation");
  }

  if (!profile.hasForecasting) {
    recommendations.push('| "What happens next? (time series)" | `predict_forecast` | ARIMA/Holt-Winters with confidence intervals |');
  } else {
    doNotUse.push("- Time series forecasting → use your existing implementation");
  }

  if (!profile.hasScheduling) {
    recommendations.push('| "Schedule tasks optimally" | `solve_schedule` | Energy-matched task assignment (LP/MIP solver) |');
    recommendations.push('| "Allocate budget with constraints" | `solve_constraints` | Provably optimal LP/MIP optimization |');
  } else {
    doNotUse.push("- Scheduling/allocation → use your existing implementation");
  }

  if (!profile.hasOptimization) {
    recommendations.push('| "Optimize continuous parameters" | `optimize_cmaes` | SOTA derivative-free optimizer |');
    recommendations.push('| "Choose the best option from data" | `optimize_bandit` | Multi-Armed Bandit (UCB1/Thompson) |');
  } else {
    doNotUse.push("- Optimization → use your existing implementation");
  }

  if (!profile.hasRiskMetrics) {
    recommendations.push('| "Portfolio risk?" | `analyze_portfolio_risk` | VaR/CVaR with correlation matrix |');
  } else {
    doNotUse.push("- Risk metrics → use your existing implementation");
  }

  if (!profile.hasGraphAnalysis) {
    recommendations.push('| "Find bottlenecks/dependencies" | `analyze_decision_graph` | PageRank + Louvain communities |');
    recommendations.push('| "Critical path through tasks" | `plan_pathfind` | A* shortest path with cost/time/risk |');
  } else {
    doNotUse.push("- Graph analysis → use your existing implementation");
  }

  if (!profile.hasEnsemble) {
    recommendations.push('| "Combine multiple model outputs" | `predict_ensemble` | Weighted consensus with uncertainty |');
  } else {
    doNotUse.push("- Ensemble/consensus → use your existing implementation");
  }

  if (!profile.hasCalibration) {
    recommendations.push('| "Score prediction accuracy" | `score_calibration` | Brier score + log score |');
    recommendations.push('| "Do data sources agree?" | `score_convergence` | Multi-source Hellinger distance |');
  }

  let section = `## OraClaw MCP Tools (Available via MCP)

The \`oraclaw\` MCP server provides 12 decision intelligence tools. All run locally, sub-5ms, zero LLM cost.

**Add to your Claude config:**
\`\`\`json
"oraclaw": { "command": "npx", "args": ["tsx", "path/to/oraclaw-mcp/index.ts"] }
\`\`\`

**Use OraClaw when:**

| Situation | Tool | Why |
|-----------|------|-----|
${recommendations.join("\n")}
`;

  if (doNotUse.length > 0) {
    section += `
**DO NOT use OraClaw for (your project already handles these):**
${doNotUse.join("\n")}
`;
  }

  return section;
}

// ── 2. GitHub Outreach Message Generator ───────────────

interface RepoProfile {
  repoName: string;
  ownerName: string;
  description: string;
  language: string;
  stars: number;
  gaps: string[];
}

export function generateOutreachMessage(repo: RepoProfile): string {
  const gapList = repo.gaps
    .map((g) => `  - ${g}`)
    .join("\n");

  return `Hey ${repo.ownerName},

I saw ${repo.repoName} — ${repo.description}. Really solid work.

I built a free MCP server (OraClaw) that might fill some gaps I noticed:
${gapList}

It's 12 tools, all sub-5ms, zero LLM cost per call. Works with Claude Code, Cursor, OpenClaw.

Install: \`clawhub install oraclaw-bandit\` (or whichever tool fits)

No lock-in — it's an MCP server, so it just adds tools to your AI assistant. Happy to help integrate if useful.`;
}

// ── 3. Pricing Optimization (Self-Use of Bandit) ───────

interface PricingExperiment {
  endpoint: string;
  currentPrice: number;
  testPrices: number[];
  metric: "revenue" | "volume" | "conversion";
}

export function generatePricingExperiments(): PricingExperiment[] {
  return [
    { endpoint: "bandit", currentPrice: 0.01, testPrices: [0.005, 0.01, 0.02, 0.03], metric: "revenue" },
    { endpoint: "solver", currentPrice: 0.10, testPrices: [0.05, 0.10, 0.15, 0.20], metric: "revenue" },
    { endpoint: "forecast", currentPrice: 0.05, testPrices: [0.02, 0.05, 0.08, 0.10], metric: "revenue" },
    { endpoint: "cmaes", currentPrice: 0.10, testPrices: [0.05, 0.10, 0.20, 0.30], metric: "revenue" },
    { endpoint: "anomaly", currentPrice: 0.02, testPrices: [0.01, 0.02, 0.03, 0.05], metric: "volume" },
  ];
}

// ── 4. Case Study Template ─────────────────────────────

export function generateCaseStudy(
  projectName: string,
  existingCapabilities: number,
  gapsFilled: number,
  tools: string[],
): string {
  return `## ${projectName} — OraClaw Integration Case Study

**Project**: ${projectName}
**Existing capabilities**: ${existingCapabilities} sophisticated services
**Gaps filled by OraClaw**: ${gapsFilled} tools added
**Tools used**: ${tools.join(", ")}
**Code changes**: 0 (CLAUDE.md guidance only)
**Risk of breakage**: 0 (additive only, nothing replaced)

**Key insight**: Even a mature project with ${existingCapabilities}+ existing services still had ${gapsFilled} gaps that OraClaw filled — without touching a single line of existing code.

This is OraClaw's value: it fills gaps, not replaces code.`;
}

// ── Generate Everything ────────────────────────────────

console.log("=== OraClaw GTM Assets Generated ===\n");

// Case studies from real integrations
console.log(generateCaseStudy("EU Predictions", 12, 6, ["contextual bandit", "forecast", "anomaly", "cmaes", "constraints", "pathfind"]));
console.log();
console.log(generateCaseStudy("Aither (PE Platform)", 300, 7, ["anomaly", "forecast", "contextual bandit", "decision graph", "pathfind", "cmaes", "ensemble"]));
console.log();
console.log(generateCaseStudy("CreditAI", 15, 9, ["anomaly", "portfolio risk", "forecast", "cmaes", "contextual bandit", "constraints", "ensemble", "montecarlo", "convergence"]));

console.log("\n=== Sample Outreach Message ===\n");
console.log(generateOutreachMessage({
  repoName: "agent-toolkit",
  ownerName: "dev",
  description: "Multi-agent orchestration framework",
  language: "TypeScript",
  stars: 500,
  gaps: [
    "No A/B testing for agent strategies → oraclaw-bandit",
    "No optimal task scheduling → oraclaw-solver",
    "No anomaly detection for agent monitoring → oraclaw-anomaly",
  ],
}));

console.log("\n=== CLAUDE.md Template (for a project with no analytics) ===\n");
console.log(generateClaudeMdSection({
  name: "generic-saas",
  stack: "Next.js + tRPC",
  hasScheduling: false,
  hasForecasting: false,
  hasAnomalyDetection: false,
  hasOptimization: false,
  hasRiskMetrics: false,
  hasGraphAnalysis: false,
  hasEnsemble: false,
  hasCalibration: false,
}));
