/**
 * Auth Middleware Tests
 *
 * Tests for Unkey auth preHandler and rate limit headers onSend hook.
 * Covers AUTH-01 (key verification), AUTH-03 (rate limiting), AUTH-04 (headers).
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { createAuthMiddleware, rateLimitHeadersHook } from './auth';
import {
  createMockUnkey,
  mockVerifyValid,
  mockVerifyInvalid,
  mockVerifyRateLimited,
  mockVerifySdkError,
} from '../test-utils/mock-unkey';

describe('Auth Middleware', () => {
  let app: FastifyInstance;
  let mockUnkey: ReturnType<typeof createMockUnkey>;

  beforeAll(async () => {
    mockUnkey = createMockUnkey();
    app = Fastify({ logger: false });

    // Register preHandler (auth middleware)
    const authHandler = createAuthMiddleware(mockUnkey as any);
    app.addHook('preHandler', authHandler);

    // Register onSend (rate limit headers)
    app.addHook('onSend', rateLimitHeadersHook);

    // Test route that returns request context set by middleware
    app.get('/test', async (request) => {
      return {
        tier: request.tier,
        billingPath: request.billingPath,
        keyId: request.keyId,
        stripeCustomerId: request.stripeCustomerId,
      };
    });

    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    // Reset all mock call history between tests
    mockUnkey.keys.verifyKey.mockReset();
  });

  // ── AUTH-01: Key Verification (preHandler) ──────────────────

  describe('Auth Middleware - preHandler', () => {
    it('returns free tier when no Authorization header', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/test',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.tier).toBe('free');
      expect(body.billingPath).toBe('free');
      // Unkey should NOT be called for free tier
      expect(mockUnkey.keys.verifyKey).not.toHaveBeenCalled();
    });

    it('returns 200 with tier from valid key', async () => {
      mockUnkey.keys.verifyKey.mockResolvedValueOnce(
        mockVerifyValid({ tier: 'growth', stripeCustomerId: 'cus_growth_123' }),
      );

      const response = await app.inject({
        method: 'GET',
        url: '/test',
        headers: { authorization: 'Bearer ok_live_xxx' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.tier).toBe('growth');
      expect(body.billingPath).toBe('stripe');
      expect(body.stripeCustomerId).toBe('cus_growth_123');
      expect(mockUnkey.keys.verifyKey).toHaveBeenCalledWith({ key: 'ok_live_xxx' });
    });

    it('returns 401 for NOT_FOUND key', async () => {
      mockUnkey.keys.verifyKey.mockResolvedValueOnce(
        mockVerifyInvalid('NOT_FOUND'),
      );

      const response = await app.inject({
        method: 'GET',
        url: '/test',
        headers: { authorization: 'Bearer ok_live_invalid' },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload);
      expect(body.type).toContain('not-found');
    });

    it('returns 429 for RATE_LIMITED key', async () => {
      mockUnkey.keys.verifyKey.mockResolvedValueOnce(mockVerifyRateLimited());

      const response = await app.inject({
        method: 'GET',
        url: '/test',
        headers: { authorization: 'Bearer ok_live_ratelimited' },
      });

      expect(response.statusCode).toBe(429);
      const body = JSON.parse(response.payload);
      expect(body.title).toBe('Rate limit exceeded');
    });

    it('returns 403 for DISABLED key', async () => {
      mockUnkey.keys.verifyKey.mockResolvedValueOnce(
        mockVerifyInvalid('DISABLED'),
      );

      const response = await app.inject({
        method: 'GET',
        url: '/test',
        headers: { authorization: 'Bearer ok_live_disabled' },
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.payload);
      expect(body.type).toContain('disabled');
    });

    it('returns 401 for EXPIRED key', async () => {
      mockUnkey.keys.verifyKey.mockResolvedValueOnce(
        mockVerifyInvalid('EXPIRED'),
      );

      const response = await app.inject({
        method: 'GET',
        url: '/test',
        headers: { authorization: 'Bearer ok_live_expired' },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload);
      expect(body.type).toContain('expired');
    });

    it('returns 503 on Unkey SDK error', async () => {
      mockUnkey.keys.verifyKey.mockRejectedValueOnce(mockVerifySdkError());

      const response = await app.inject({
        method: 'GET',
        url: '/test',
        headers: { authorization: 'Bearer ok_live_error' },
      });

      expect(response.statusCode).toBe(503);
      const body = JSON.parse(response.payload);
      expect(body.title).toContain('unavailable');
      expect(body.type).toContain('service-unavailable');
    });
  });

  // ── AUTH-04: Rate Limit Headers (onSend) ──────────────────

  describe('Rate Limit Headers - onSend', () => {
    it('includes X-RateLimit-* headers on valid key response', async () => {
      mockUnkey.keys.verifyKey.mockResolvedValueOnce(
        mockVerifyValid({ remaining: 42, limit: 1667, reset: 1700000000000 }),
      );

      const response = await app.inject({
        method: 'GET',
        url: '/test',
        headers: { authorization: 'Bearer ok_live_headers' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
      expect(response.headers['x-ratelimit-limit']).toBeDefined();
      expect(response.headers['x-ratelimit-reset']).toBeDefined();
      expect(String(response.headers['x-ratelimit-remaining'])).toBe('42');
      expect(String(response.headers['x-ratelimit-limit'])).toBe('1667');
      expect(String(response.headers['x-ratelimit-reset'])).toBe('1700000000000');
    });

    it('includes X-RateLimit-* headers on 429 response', async () => {
      mockUnkey.keys.verifyKey.mockResolvedValueOnce(mockVerifyRateLimited());

      const response = await app.inject({
        method: 'GET',
        url: '/test',
        headers: { authorization: 'Bearer ok_live_rl_headers' },
      });

      expect(response.statusCode).toBe(429);
      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
      expect(response.headers['x-ratelimit-limit']).toBeDefined();
      expect(response.headers['x-ratelimit-reset']).toBeDefined();
      expect(String(response.headers['x-ratelimit-remaining'])).toBe('0');
    });

    it('omits X-RateLimit-* headers for free tier', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/test',
        // No authorization header = free tier
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['x-ratelimit-remaining']).toBeUndefined();
      expect(response.headers['x-ratelimit-limit']).toBeUndefined();
      expect(response.headers['x-ratelimit-reset']).toBeUndefined();
    });
  });
});
