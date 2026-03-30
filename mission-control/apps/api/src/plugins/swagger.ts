/**
 * Swagger/OpenAPI Plugin
 * Registers @fastify/swagger for OpenAPI 3.1 spec generation
 * and @scalar/fastify-api-reference for interactive playground at /docs
 */

import { FastifyInstance } from 'fastify';
import fastifySwagger from '@fastify/swagger';
import scalarPlugin from '@scalar/fastify-api-reference';

export async function registerSwagger(fastify: FastifyInstance): Promise<void> {
  await fastify.register(fastifySwagger, {
    openapi: {
      openapi: '3.1.0',
      info: {
        title: 'OraClaw Decision Intelligence API',
        description:
          'AI decision intelligence platform built on the OODA loop framework ' +
          '(Observe, Orient, Decide, Act). Provides 19 production-grade ML algorithms ' +
          'with <25ms response times for optimization, simulation, prediction, and planning.',
        version: '2.3.0',
        contact: {
          name: 'OraClaw',
          url: 'https://github.com/Whatsonyourmind/oracle',
        },
        license: {
          name: 'MIT',
        },
      },
      servers: [
        {
          url: 'http://localhost:3001',
          description: 'Development server',
        },
        {
          url: 'https://oraclaw.dev',
          description: 'Production server',
        },
      ],
      tags: [
        { name: 'Optimize', description: 'Genetic algorithm, simulated annealing, constraint optimization' },
        { name: 'Simulate', description: 'Monte Carlo simulation, scenario planning' },
        { name: 'Solve', description: 'A* pathfinding, constraint satisfaction, LP/MIP' },
        { name: 'Analyze', description: 'Ensemble analysis, convergence scoring, attention' },
        { name: 'Predict', description: 'Bayesian inference, Markov chains, Q-learning' },
        { name: 'Detect', description: 'Signal detection, anomaly patterns, radar scanning' },
        { name: 'Score', description: 'Multi-armed bandit, contextual bandit, decision scoring' },
        { name: 'Plan', description: 'Execution planning, critical path, decision graphs' },
        { name: 'Billing', description: 'Subscription management, usage metering, customer portal' },
        { name: 'Health', description: 'System health checks and diagnostics' },
      ],
      components: {
        securitySchemes: {
          apiKey: {
            type: 'apiKey',
            name: 'Authorization',
            in: 'header',
            description: 'Bearer <your-api-key> from Unkey',
          },
        },
      },
    },
  });

  await fastify.register(scalarPlugin, {
    routePrefix: '/docs',
    logLevel: 'silent',
  });
}
