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

> Decision intelligence API with 19 ML algorithms. No LLM cost -- pure math.

OraClaw implements the OODA loop (Observe, Orient, Decide, Act) as a REST API.
Each endpoint runs a production-grade algorithm and returns structured JSON.
Free tier available -- no API key needed for up to 25 calls/day.

## Endpoints

### Optimize
- POST /api/oracle/decide/decisions -- Multi-Armed Bandit (UCB1, Thompson, epsilon-Greedy)
- POST /api/oracle/decide/simulate -- Monte Carlo simulation with risk analysis

### Simulate
- POST /api/oracle/probability/montecarlo -- Monte Carlo probability estimation
- POST /api/oracle/probability/bayesian -- Bayesian inference with prior updates

### Solve
- POST /api/oracle/act/steps -- A* pathfinding with critical path analysis
- POST /api/oracle/scenarios/create -- Scenario planning with genetic algorithms

### Analyze
- POST /api/oracle/observe/scan -- Signal detection and anomaly patterns
- POST /api/oracle/orient/context -- Strategic context building
- GET /api/oracle/analytics/insights -- Analytics and performance insights

### Predict
- POST /api/oracle/query/natural -- Natural language decision queries

### Detect
- POST /api/oracle/observe/scan -- Radar scanning and signal detection

### Score
- POST /api/oracle/decide/decisions -- Convergence scoring across multiple signals

### Plan
- POST /api/oracle/act/steps -- Execution planning with constraint optimization

## Authentication

- **Free tier**: No API key required. Rate limited to 25 calls/day per IP.
- **Paid tiers**: Pass API key via \`Authorization: Bearer <key>\` header. Higher rate limits and priority processing.
- **Machine payments**: x402 USDC micropayments for per-call billing without subscriptions.

## Docs

- Interactive playground: /docs
- OpenAPI specification: /docs/json
`;

export async function llmsTxtRoute(fastify: FastifyInstance): Promise<void> {
  fastify.get('/llms.txt', async (_request, reply) => {
    return reply.type('text/plain').send(LLMS_TXT_CONTENT);
  });
}
