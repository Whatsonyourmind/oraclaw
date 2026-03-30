/**
 * api-batch.test.ts
 *
 * TDD tests for POST /api/v1/batch endpoint.
 * Covers:
 *   - Validation: empty calls, missing calls, batch > 20
 *   - Dispatch: ordered results, partial failure, all-fail, unknown algorithm
 *   - Metadata: meta.total, succeeded + failed, algorithm field in each result
 *   - Request context: isBatchRequest and batchSize set on request
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import batchRoute from './api-batch';

// ── Test App Setup ───────────────────────────────────────────

let app: FastifyInstance;
let capturedRequest: { isBatchRequest?: boolean; batchSize?: number } = {};

beforeAll(async () => {
  app = Fastify({ logger: false });

  // Capture request context for batch metadata assertions
  app.addHook('onResponse', async (request) => {
    capturedRequest = {
      isBatchRequest: request.isBatchRequest,
      batchSize: request.batchSize,
    };
  });

  // Provide default request decorators that auth middleware normally sets
  app.addHook('preHandler', async (request) => {
    if (!(request as any).tier) {
      (request as any).tier = 'starter';
    }
    if (!(request as any).billingPath) {
      (request as any).billingPath = 'stripe';
    }
  });

  await app.register(batchRoute);
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

// ── Helpers ──────────────────────────────────────────────────

function makeBatchRequest(calls: Array<{ algorithm: string; params: unknown }>) {
  return app.inject({
    method: 'POST',
    url: '/api/v1/batch',
    payload: { calls },
  });
}

// Simple calibration params (pure math, fast, no external deps)
const calibrationParams = {
  predictions: [0.9, 0.8, 0.7],
  outcomes: [1, 1, 0],
};

// Simple anomaly detection params (pure math, fast)
const anomalyParams = {
  data: [1, 2, 3, 100, 2, 3, 1],
  method: 'zscore',
  threshold: 2.0,
};

// ── Tests ────────────────────────────────────────────────────

describe('POST /api/v1/batch', () => {
  describe('validation', () => {
    it('returns 400 when calls array is missing', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/batch',
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.type).toContain('validation');
      expect(body.detail).toContain('calls');
    });

    it('returns 400 when calls array is empty', async () => {
      const response = await makeBatchRequest([]);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.type).toContain('validation');
      expect(body.detail).toContain('empty');
    });

    it('returns 400 when batch exceeds 20 calls', async () => {
      const calls = Array.from({ length: 21 }, (_, i) => ({
        algorithm: 'score/calibration',
        params: calibrationParams,
      }));

      const response = await makeBatchRequest(calls);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.type).toContain('validation');
      expect(body.detail).toContain('20');
    });
  });

  describe('dispatch', () => {
    it('returns results in same order as request', async () => {
      const response = await makeBatchRequest([
        { algorithm: 'score/calibration', params: calibrationParams },
        {
          algorithm: 'detect/anomaly',
          params: anomalyParams,
        },
      ]);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.results).toHaveLength(2);
      expect(body.results[0].algorithm).toBe('score/calibration');
      expect(body.results[1].algorithm).toBe('detect/anomaly');
      expect(body.results[0].status).toBe('success');
      expect(body.results[1].status).toBe('success');
    });

    it('returns partial results (success + error) for mixed batch', async () => {
      const response = await makeBatchRequest([
        { algorithm: 'score/calibration', params: calibrationParams },
        { algorithm: 'nonexistent/algo', params: {} },
      ]);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.results).toHaveLength(2);
      expect(body.results[0].status).toBe('success');
      expect(body.results[0].data).toBeDefined();
      expect(body.results[1].status).toBe('error');
      expect(body.results[1].error).toBeDefined();
      expect(body.results[1].error.detail).toContain('nonexistent/algo');
    });

    it('returns 200 with all errors when every call uses unknown algorithm', async () => {
      const response = await makeBatchRequest([
        { algorithm: 'fake/one', params: {} },
        { algorithm: 'fake/two', params: {} },
      ]);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.results).toHaveLength(2);
      expect(body.results[0].status).toBe('error');
      expect(body.results[1].status).toBe('error');
      expect(body.meta.succeeded).toBe(0);
      expect(body.meta.failed).toBe(2);
    });

    it('unknown algorithm returns error with algorithm name in detail', async () => {
      const response = await makeBatchRequest([
        { algorithm: 'does-not-exist/xyz', params: {} },
      ]);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.results[0].status).toBe('error');
      expect(body.results[0].algorithm).toBe('does-not-exist/xyz');
      expect(body.results[0].error.detail).toContain('does-not-exist/xyz');
      expect(body.results[0].error.type).toBeDefined();
      expect(body.results[0].error.title).toBeDefined();
      expect(body.results[0].error.status).toBeDefined();
    });
  });

  describe('metadata', () => {
    it('meta.total matches calls length', async () => {
      const response = await makeBatchRequest([
        { algorithm: 'score/calibration', params: calibrationParams },
        { algorithm: 'score/calibration', params: calibrationParams },
        { algorithm: 'score/calibration', params: calibrationParams },
      ]);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.meta.total).toBe(3);
    });

    it('meta.succeeded + meta.failed equals meta.total', async () => {
      const response = await makeBatchRequest([
        { algorithm: 'score/calibration', params: calibrationParams },
        { algorithm: 'unknown/algo', params: {} },
        { algorithm: 'detect/anomaly', params: anomalyParams },
      ]);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.meta.succeeded + body.meta.failed).toBe(body.meta.total);
      expect(body.meta.succeeded).toBe(2);
      expect(body.meta.failed).toBe(1);
    });

    it('each result includes algorithm field', async () => {
      const response = await makeBatchRequest([
        { algorithm: 'score/calibration', params: calibrationParams },
        { algorithm: 'unknown/test', params: {} },
      ]);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      for (const result of body.results) {
        expect(result.algorithm).toBeDefined();
        expect(typeof result.algorithm).toBe('string');
      }
    });
  });

  describe('request context', () => {
    it('sets isBatchRequest=true and batchSize=N on request', async () => {
      // Reset captured state
      capturedRequest = {};

      const response = await makeBatchRequest([
        { algorithm: 'score/calibration', params: calibrationParams },
        { algorithm: 'score/calibration', params: calibrationParams },
      ]);

      expect(response.statusCode).toBe(200);

      // The onResponse hook captured the request properties
      expect(capturedRequest.isBatchRequest).toBe(true);
      expect(capturedRequest.batchSize).toBe(2);
    });
  });
});
