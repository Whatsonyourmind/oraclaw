/**
 * problem-details.test.ts
 *
 * Tests for RFC 9457 Problem Details helper:
 *   - sendProblem sets correct status, content-type, and body fields
 *   - Extension fields pass through
 *   - Global error handler returns RFC 9457 for 500, 429, 400, 404 errors
 *   - 500 errors hide internal details
 *
 * Uses Fastify inject pattern (same as free-tier-rate-limit.test.ts).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { sendProblem, ProblemTypes, type ProblemDetail } from './problem-details';

describe('sendProblem helper', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();

    // Test route: basic sendProblem
    app.get('/test-problem', async (_request, reply) => {
      return sendProblem(reply, 422, ProblemTypes.VALIDATION, 'Validation Error', 'Name is required');
    });

    // Test route: sendProblem with extension fields
    app.get('/test-extension', async (_request, reply) => {
      return sendProblem(reply, 429, ProblemTypes.RATE_LIMITED, 'Rate Limited', 'Too many requests', {
        'retry-after': 60,
      });
    });

    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  // Test 1: sendProblem sets status code, content-type, and body with type/title/status/detail
  it('sets status code, content-type application/problem+json, and body fields', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/test-problem',
    });

    expect(response.statusCode).toBe(422);
    expect(response.headers['content-type']).toContain('application/problem+json');

    const body = JSON.parse(response.body);
    expect(body.type).toBe(ProblemTypes.VALIDATION);
    expect(body.title).toBe('Validation Error');
    expect(body.status).toBe(422);
    expect(body.detail).toBe('Name is required');
  });

  // Test 2: sendProblem passes through extension fields
  it('passes through extension fields like retry-after', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/test-extension',
    });

    expect(response.statusCode).toBe(429);
    const body = JSON.parse(response.body);
    expect(body['retry-after']).toBe(60);
    expect(body.type).toBe(ProblemTypes.RATE_LIMITED);
    expect(body.title).toBe('Rate Limited');
    expect(body.status).toBe(429);
    expect(body.detail).toBe('Too many requests');
  });
});

describe('Global error handler (RFC 9457)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();

    // Route that throws a generic error (triggers 500)
    app.get('/throw-500', async () => {
      throw new Error('Something broke internally');
    });

    // Route that throws a 429 rate-limit error
    app.get('/throw-429', async () => {
      const err: Error & { statusCode?: number } = new Error('Rate limit');
      err.statusCode = 429;
      throw err;
    });

    // Route that throws a Fastify validation error (400)
    app.get('/throw-400', async () => {
      const err: Error & { statusCode?: number; validation?: unknown } = new Error('Bad request');
      err.statusCode = 400;
      err.validation = [{ message: 'body must have required property "name"' }];
      throw err;
    });

    // Route that throws a 404 error
    app.get('/throw-404', async () => {
      const err: Error & { statusCode?: number } = new Error('Not found');
      err.statusCode = 404;
      throw err;
    });

    // Global error handler (same logic as index.ts will use)
    app.setErrorHandler((error: Error & { statusCode?: number; validation?: unknown }, _request, reply) => {
      const status = error.statusCode || 500;

      if (error.validation) {
        return sendProblem(reply, 400, ProblemTypes.VALIDATION, 'Validation Error', error.message);
      }
      if (status === 429) {
        return sendProblem(reply, 429, ProblemTypes.RATE_LIMITED, 'Rate limit exceeded', 'Too many requests. Please try again later.', { 'retry-after': 60 });
      }
      if (status === 404) {
        return sendProblem(reply, 404, ProblemTypes.NOT_FOUND, 'Not Found', error.message);
      }

      // Default 500 -- hide internal details
      return sendProblem(reply, 500, ProblemTypes.INTERNAL, 'Internal Server Error', 'An unexpected error occurred. Please try again.');
    });

    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  // Test 3: Global error handler returns RFC 9457 for generic 500 errors
  it('returns RFC 9457 format for 500 errors', async () => {
    const response = await app.inject({ method: 'GET', url: '/throw-500' });

    expect(response.statusCode).toBe(500);
    expect(response.headers['content-type']).toContain('application/problem+json');

    const body = JSON.parse(response.body);
    expect(body.type).toBe(ProblemTypes.INTERNAL);
    expect(body.title).toBe('Internal Server Error');
    expect(body.status).toBe(500);
    expect(body.detail).toBe('An unexpected error occurred. Please try again.');
  });

  // Test 4: Global error handler returns RFC 9457 for 429 rate limit errors
  it('returns RFC 9457 format for 429 rate limit errors', async () => {
    const response = await app.inject({ method: 'GET', url: '/throw-429' });

    expect(response.statusCode).toBe(429);
    expect(response.headers['content-type']).toContain('application/problem+json');

    const body = JSON.parse(response.body);
    expect(body.type).toBe(ProblemTypes.RATE_LIMITED);
    expect(body.title).toBe('Rate limit exceeded');
    expect(body.status).toBe(429);
    expect(body['retry-after']).toBe(60);
  });

  // Test 5: Global error handler returns RFC 9457 for Fastify validation errors (400)
  it('returns RFC 9457 format for validation errors', async () => {
    const response = await app.inject({ method: 'GET', url: '/throw-400' });

    expect(response.statusCode).toBe(400);
    expect(response.headers['content-type']).toContain('application/problem+json');

    const body = JSON.parse(response.body);
    expect(body.type).toBe(ProblemTypes.VALIDATION);
    expect(body.title).toBe('Validation Error');
    expect(body.status).toBe(400);
  });

  // Test 6: Global error handler returns RFC 9457 for 404 errors
  it('returns RFC 9457 format for 404 errors', async () => {
    const response = await app.inject({ method: 'GET', url: '/throw-404' });

    expect(response.statusCode).toBe(404);
    expect(response.headers['content-type']).toContain('application/problem+json');

    const body = JSON.parse(response.body);
    expect(body.type).toBe(ProblemTypes.NOT_FOUND);
    expect(body.title).toBe('Not Found');
    expect(body.status).toBe(404);
  });

  // Test 7: 500 errors hide internal details
  it('hides internal error details for 500 responses', async () => {
    const response = await app.inject({ method: 'GET', url: '/throw-500' });

    const body = JSON.parse(response.body);
    // Should NOT contain the actual error message "Something broke internally"
    expect(body.detail).not.toContain('Something broke internally');
    expect(body.detail).toBe('An unexpected error occurred. Please try again.');
  });
});
