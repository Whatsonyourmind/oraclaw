/**
 * swagger.test.ts
 *
 * Tests for DX-01:
 *   1. /docs route exists and returns 200 (Scalar playground is served)
 *   2. OpenAPI JSON spec reports openapi version "3.1.0"
 *   3. OpenAPI spec info.title is "OraClaw Decision Intelligence API"
 *   4. OpenAPI spec info.version is "2.3.0"
 *   5. OpenAPI spec components.securitySchemes includes apiKey scheme
 *   6. OpenAPI spec has tags for algorithm categories
 *
 * Uses Fastify inject pattern: creates a minimal Fastify app, registers swagger plugin,
 * adds a dummy route so the spec has at least one endpoint.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { registerSwagger } from './swagger';

describe('registerSwagger (Scalar + OpenAPI 3.1)', () => {
  let app: FastifyInstance;
  let spec: any;

  beforeAll(async () => {
    app = Fastify();

    // Register the swagger plugin
    await registerSwagger(app);

    // Add a dummy route so the spec has at least one endpoint
    app.get('/api/v1/test', {
      schema: {
        tags: ['Health'],
        response: { 200: { type: 'object', properties: { ok: { type: 'boolean' } } } },
      },
    }, async () => ({ ok: true }));

    await app.ready();

    // Get the OpenAPI spec object
    spec = app.swagger();
  });

  afterAll(async () => {
    await app.close();
  });

  // Test 1: /docs route exists and returns 200 (Scalar playground is served)
  it('serves Scalar playground at /docs returning 200', async () => {
    const response = await app.inject({ method: 'GET', url: '/docs' });
    expect(response.statusCode).toBe(200);
  });

  // Test 2: OpenAPI spec reports version "3.1.0"
  it('reports OpenAPI version 3.1.0', () => {
    expect(spec.openapi).toBe('3.1.0');
  });

  // Test 3: info.title is "OraClaw Decision Intelligence API"
  it('has info.title "OraClaw Decision Intelligence API"', () => {
    expect(spec.info.title).toBe('OraClaw Decision Intelligence API');
  });

  // Test 4: info.version is "2.3.0"
  it('has info.version "2.3.0"', () => {
    expect(spec.info.version).toBe('2.3.0');
  });

  // Test 5: securitySchemes includes apiKey scheme
  it('has apiKey security scheme', () => {
    const schemes = spec.components?.securitySchemes;
    expect(schemes).toBeDefined();
    expect(schemes.apiKey).toBeDefined();
    expect(schemes.apiKey.type).toBe('apiKey');
    expect(schemes.apiKey.name).toBe('Authorization');
    expect(schemes.apiKey.in).toBe('header');
  });

  // Test 6: has tags for algorithm categories
  it('has tags for algorithm categories', () => {
    const tagNames = spec.tags?.map((t: any) => t.name) ?? [];
    const expectedTags = ['Optimize', 'Simulate', 'Solve', 'Analyze', 'Predict', 'Detect', 'Score', 'Plan', 'Billing', 'Health'];
    for (const tag of expectedTags) {
      expect(tagNames).toContain(tag);
    }
  });
});
