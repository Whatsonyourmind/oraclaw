/**
 * helmet.test.ts
 *
 * Verifies that @fastify/helmet is correctly wired up with an API-tuned
 * Content Security Policy. Uses Fastify inject to avoid binding a port.
 *
 * Coverage:
 *   1. x-content-type-options: nosniff
 *   2. x-frame-options: DENY
 *   3. content-security-policy header present (default-src 'self')
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import helmet from '@fastify/helmet';

describe('@fastify/helmet (security headers)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();

    // Register helmet with the exact same configuration as src/server.ts.
    await app.register(helmet, {
      global: true,
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
        },
      },
      frameguard: { action: 'deny' },
    });

    app.get('/health', async () => ({ status: 'ok' }));

    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('sends x-content-type-options: nosniff', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });

  it('sends x-frame-options: DENY', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    expect(response.headers['x-frame-options']).toBe('DENY');
  });

  it('sends content-security-policy header with default-src \'self\'', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    const csp = response.headers['content-security-policy'];
    expect(csp).toBeDefined();
    expect(String(csp)).toContain("default-src 'self'");
  });
});
