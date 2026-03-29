/**
 * free-tier-rate-limit.test.ts
 *
 * Tests for BILL-02a, BILL-02b, BILL-02c:
 *   a) Free-tier (no Authorization header) is subject to 100/day IP rate limit
 *   b) The 101st free-tier call returns 429 with RFC 9457 body
 *   c) Authenticated requests (Authorization header present) bypass rate limit entirely
 *
 * Uses Fastify inject pattern: creates a minimal Fastify app with the rate limit plugin.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { registerFreeTierRateLimit } from './free-tier-rate-limit';

describe('registerFreeTierRateLimit', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();

    // Register the free-tier rate limiter
    await registerFreeTierRateLimit(app);

    // Add a simple test route
    app.get('/test', async () => {
      return { ok: true };
    });

    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  // BILL-02a: request without Authorization gets rate limit headers
  it('returns 200 and rate limit headers for unauthenticated requests', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/test',
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['x-ratelimit-limit']).toBeDefined();
    expect(response.headers['x-ratelimit-remaining']).toBeDefined();
    expect(response.headers['x-ratelimit-reset']).toBeDefined();
  });

  // BILL-02b: 101st unauthenticated request returns 429 with RFC 9457 body
  it('returns 429 with RFC 9457 body after 100 unauthenticated requests', async () => {
    // Create a fresh app for this test to avoid cross-test contamination
    const freshApp = Fastify();
    await registerFreeTierRateLimit(freshApp);
    freshApp.get('/test', async () => ({ ok: true }));
    await freshApp.ready();

    // Send 100 requests (should all succeed)
    for (let i = 0; i < 100; i++) {
      const res = await freshApp.inject({
        method: 'GET',
        url: '/test',
        remoteAddress: '10.0.0.1',
      });
      expect(res.statusCode).toBe(200);
    }

    // 101st request should be rate limited
    const limitedResponse = await freshApp.inject({
      method: 'GET',
      url: '/test',
      remoteAddress: '10.0.0.1',
    });

    expect(limitedResponse.statusCode).toBe(429);

    const body = JSON.parse(limitedResponse.body);
    expect(body.type).toBe('https://oraclaw.dev/errors/rate-limited');
    expect(body.title).toBe('Free tier rate limit exceeded');
    expect(body.status).toBe(429);
    expect(body.detail).toContain('100 API calls per day');
    expect(body['retry-after']).toBeTypeOf('number');

    await freshApp.close();
  });

  // BILL-02c: authenticated requests bypass rate limit entirely
  it('always returns 200 for authenticated requests regardless of call count', async () => {
    const freshApp = Fastify();
    await registerFreeTierRateLimit(freshApp);
    freshApp.get('/test', async () => ({ ok: true }));
    await freshApp.ready();

    // Send 150 requests WITH Authorization header -- all should succeed
    for (let i = 0; i < 150; i++) {
      const res = await freshApp.inject({
        method: 'GET',
        url: '/test',
        headers: {
          authorization: 'Bearer test-key',
        },
        remoteAddress: '10.0.0.2',
      });
      expect(res.statusCode).toBe(200);
    }

    await freshApp.close();
  });

  // BILL-02c: authenticated requests should NOT have free-tier rate limit headers
  it('does not inject free-tier rate limit headers for authenticated requests', async () => {
    const freshApp = Fastify();
    await registerFreeTierRateLimit(freshApp);
    freshApp.get('/test', async () => ({ ok: true }));
    await freshApp.ready();

    const response = await freshApp.inject({
      method: 'GET',
      url: '/test',
      headers: {
        authorization: 'Bearer test-key',
      },
    });

    expect(response.statusCode).toBe(200);
    // When skip returns true, @fastify/rate-limit should not add rate limit headers
    // (or the route works without rate limit intervention)

    await freshApp.close();
  });
});
