/**
 * llms-txt.ts
 *
 * GET /llms.txt -- AI discovery route following the llms.txt specification.
 * Allows AI assistants to discover OraClaw's capabilities, endpoints,
 * authentication options, and documentation links.
 *
 * @see https://llmstxt.org
 */

import type { FastifyInstance } from 'fastify';

const LLMS_TXT_CONTENT = `# OraClaw

> Decision intelligence API — 17 MCP tools, all under 25ms. No LLM cost, pure math.

## Free Tools (no API key needed, 25 calls/day)

- POST /api/v1/optimize/bandit -- Multi-Armed Bandit (UCB1/Thompson/epsilon-Greedy)
- POST /api/v1/optimize/contextual-bandit -- Contextual Bandit (LinUCB)
- POST /api/v1/optimize/evolve -- Genetic algorithm / evolutionary optimization
- POST /api/v1/simulate/montecarlo -- Monte Carlo simulation
- POST /api/v1/simulate/scenario -- Scenario planning simulation
- POST /api/v1/solve/schedule -- Task scheduling with energy matching
- POST /api/v1/plan/pathfind -- A* pathfinding with k-shortest paths
- POST /api/v1/score/convergence -- Multi-source agreement scoring
- POST /api/v1/score/calibration -- Probability calibration scoring
- POST /api/v1/predict/bayesian -- Bayesian inference / belief updating
- POST /api/v1/predict/ensemble -- Ensemble model prediction

## Premium Tools (free API key signup required)

- POST /api/v1/detect/anomaly -- Z-score/IQR anomaly detection
- POST /api/v1/predict/forecast -- ARIMA/Holt-Winters time series
- POST /api/v1/solve/constraints -- LP/MIP/QP optimization (HiGHS)
- POST /api/v1/analyze/graph -- PageRank, Louvain communities
- POST /api/v1/optimize/cmaes -- CMA-ES continuous optimization
- POST /api/v1/analyze/risk -- Portfolio VaR/CVaR

## Authentication

- **Free tier**: No API key. 25 calls/day, 11 free tools.
- **Signup**: POST /api/v1/auth/signup with {"email":"you@example.com"} -- instant API key, all 17 tools.
- **Paid tiers**: $0.005/call (pay-per-call), $9-199/mo (subscriptions).
- **Machine payments**: x402 USDC on Base ($0.001/call, all tools).

## Links

- npm: @oraclaw/mcp-server (v1.1.1)
- GitHub: https://github.com/Whatsonyourmind/oraclaw
- Pricing: GET /api/v1/pricing
`;

/**
 * MCP Server Card for Smithery and other MCP registries.
 * @see https://smithery.ai/docs/build/publish#troubleshooting
 */
const SERVER_CARD = {
  name: "oraclaw",
  version: "1.1.1",
  description: "Decision intelligence for AI agents — 11 free + 6 premium MCP tools. Bandits, Monte Carlo, scheduling free. LP solver, graph analytics, anomaly detection, forecasting require API key.",
  vendor: "Whatsonyourmind",
  homepage: "https://github.com/Whatsonyourmind/oraclaw",
  tools: [
    { name: "optimize_bandit", description: "Multi-Armed Bandit (UCB1/Thompson/epsilon-Greedy)", tier: "free" },
    { name: "optimize_contextual", description: "Contextual Bandit (LinUCB)", tier: "free" },
    { name: "simulate_montecarlo", description: "Monte Carlo simulation", tier: "free" },
    { name: "solve_schedule", description: "Task scheduling with energy matching", tier: "free" },
    { name: "plan_pathfind", description: "A* pathfinding with k-shortest paths", tier: "free" },
    { name: "score_convergence", description: "Multi-source agreement scoring", tier: "free" },
    { name: "optimize_evolve", description: "Genetic algorithm / evolutionary optimization", tier: "free" },
    { name: "score_calibration", description: "Probability calibration scoring", tier: "free" },
    { name: "predict_bayesian", description: "Bayesian inference / belief updating", tier: "free" },
    { name: "predict_ensemble", description: "Ensemble model prediction", tier: "free" },
    { name: "simulate_scenario", description: "Scenario planning simulation", tier: "free" },
    { name: "detect_anomaly", description: "Z-score/IQR anomaly detection", tier: "premium" },
    { name: "predict_forecast", description: "ARIMA/Holt-Winters forecasting", tier: "premium" },
    { name: "solve_constraints", description: "LP/MIP/QP optimization (HiGHS)", tier: "premium" },
    { name: "analyze_graph", description: "PageRank, Louvain communities, shortest path", tier: "premium" },
    { name: "optimize_cmaes", description: "CMA-ES continuous optimization", tier: "premium" },
    { name: "analyze_risk", description: "Portfolio VaR/CVaR risk analysis", tier: "premium" },
  ],
  auth: {
    type: "bearer",
    signup: "POST /api/v1/auth/signup with {\"email\":\"you@example.com\"}",
  },
  links: {
    npm: "https://www.npmjs.com/package/@oraclaw/mcp-server",
    github: "https://github.com/Whatsonyourmind/oraclaw",
    pricing: "https://oraclaw-api.onrender.com/api/v1/pricing",
  },
};

export async function llmsTxtRoute(fastify: FastifyInstance): Promise<void> {
  fastify.get('/llms.txt', async (_request, reply) => {
    return reply.type('text/plain').send(LLMS_TXT_CONTENT);
  });

  fastify.get('/.well-known/mcp/server-card.json', async (_request, reply) => {
    return reply.type('application/json').send(SERVER_CARD);
  });
}
