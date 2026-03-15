/**
 * Swagger/OpenAPI Plugin
 * Provides API documentation at /docs endpoint
 */

import { FastifyInstance } from 'fastify';

export async function registerSwagger(fastify: FastifyInstance): Promise<void> {
  try {
    const swagger = await import('@fastify/swagger');
    const swaggerUI = await import('@fastify/swagger-ui');

    await fastify.register(swagger.default, {
      openapi: {
        openapi: '3.0.3',
        info: {
          title: 'ORACLE Decision Intelligence API',
          description: `
## ORACLE - Observe, Orient, Decide, Act Loop Engine

The ORACLE API provides decision intelligence capabilities through the OODA loop framework.

### Authentication
All /api/oracle/* endpoints require JWT Bearer token authentication.
Obtain tokens via POST /api/auth/login or POST /api/auth/register.

### OODA Loop Phases
- **Observe**: Signal detection, radar scanning, anomaly detection
- **Orient**: Strategic context, horizon planning, correlations
- **Decide**: Decision analysis, Monte Carlo simulation, stakeholder input
- **Act**: Execution planning, copilot guidance, outcome tracking

### Real-Time Events
WebSocket connections available at /ws with JWT auth for live updates.
          `,
          version: '2.0.0',
          contact: {
            name: 'ORACLE Team',
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
        ],
        tags: [
          { name: 'Auth', description: 'Authentication endpoints' },
          { name: 'Oracle', description: 'OODA loop orchestration' },
          { name: 'Observe', description: 'Signal detection and radar scanning' },
          { name: 'Orient', description: 'Strategic context and planning' },
          { name: 'Decide', description: 'Decision analysis and simulation' },
          { name: 'Act', description: 'Execution planning and tracking' },
          { name: 'Journal', description: 'Decision journal management' },
          { name: 'Analytics', description: 'Analytics and metrics' },
          { name: 'Scenarios', description: 'Scenario planning and what-if analysis' },
          { name: 'WebSocket', description: 'Real-time event streaming' },
          { name: 'Health', description: 'System health checks' },
        ],
        components: {
          securitySchemes: {
            bearerAuth: {
              type: 'http',
              scheme: 'bearer',
              bearerFormat: 'JWT',
              description: 'JWT access token obtained from /api/auth/login',
            },
          },
          schemas: {
            APIResponse: {
              type: 'object',
              properties: {
                success: { type: 'boolean' },
                data: { type: 'object' },
                error: { type: 'string' },
              },
            },
            AuthTokens: {
              type: 'object',
              properties: {
                accessToken: { type: 'string' },
                refreshToken: { type: 'string' },
                expiresIn: { type: 'number', description: 'Access token expiry in seconds' },
              },
            },
            User: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                email: { type: 'string', format: 'email' },
                subscription_tier: { type: 'string', enum: ['free', 'pro'] },
                created_at: { type: 'string', format: 'date-time' },
                last_active: { type: 'string', format: 'date-time' },
              },
            },
            Signal: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                signal_type: { type: 'string', enum: ['deadline', 'conflict', 'opportunity', 'risk', 'anomaly', 'pattern'] },
                title: { type: 'string' },
                urgency: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
                impact: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
                confidence: { type: 'number', minimum: 0, maximum: 1 },
                status: { type: 'string', enum: ['active', 'acknowledged', 'dismissed', 'resolved'] },
              },
            },
            Decision: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                title: { type: 'string' },
                decision_type: { type: 'string', enum: ['strategic', 'tactical', 'operational', 'general'] },
                status: { type: 'string', enum: ['pending', 'analyzing', 'decided', 'executed', 'cancelled'] },
                urgency: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
                confidence: { type: 'number', minimum: 0, maximum: 1 },
              },
            },
            ExecutionPlan: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                title: { type: 'string' },
                status: { type: 'string', enum: ['draft', 'active', 'paused', 'completed', 'failed'] },
                health_score: { type: 'number', minimum: 0, maximum: 1 },
                progress_percentage: { type: 'number', minimum: 0, maximum: 100 },
              },
            },
            OracleState: {
              type: 'object',
              properties: {
                current_phase: { type: 'string', enum: ['observe', 'orient', 'decide', 'act', 'idle'] },
                loop_running: { type: 'boolean' },
                loop_paused: { type: 'boolean' },
                system_confidence: { type: 'number' },
              },
            },
          },
        },
        security: [{ bearerAuth: [] }],
      },
    });

    await fastify.register(swaggerUI.default, {
      routePrefix: '/docs',
      uiConfig: {
        docExpansion: 'list',
        deepLinking: true,
        displayRequestDuration: true,
        filter: true,
        tryItOutEnabled: true,
      },
      staticCSP: true,
    });

    console.log('[Swagger] API documentation available at /docs');
  } catch (error) {
    console.warn('[Swagger] Failed to register swagger plugins:', (error as Error).message);
  }
}
