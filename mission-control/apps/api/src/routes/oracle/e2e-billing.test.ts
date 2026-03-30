/**
 * e2e-billing.test.ts
 *
 * End-to-end billing verification tests for INFRA-03.
 * Verifies all three billing paths work correctly:
 *   1. Free-tier: no auth header -> algorithm result -> no Stripe meter event
 *   2. Stripe-tier: API key -> algorithm result -> Stripe meter event emitted
 *   3. x402-tier: USDC payment header -> algorithm result -> settlement triggered
 *   4. Batch: batch call -> 50% metered discount via separate meter event
 *
 * Also verifies all 17 algorithm endpoints return valid 200 responses.
 *
 * Uses Fastify inject (no real HTTP) with mock Unkey, Stripe, and x402 services.
 */

import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import publicApiRoutes from './api-public';
import batchRoute from './api-batch';
import { createMockStripe } from '../../test-utils/mock-stripe';
import { createMockUnkey, mockVerifyValid } from '../../test-utils/mock-unkey';
import { createMockX402 } from '../../test-utils/mock-x402';
import { createAuthMiddleware, rateLimitHeadersHook } from '../../middleware/auth';
import { createMeterUsageHook } from '../../hooks/meter-usage';
import { createX402PaymentHook } from '../../hooks/x402-payment';
import { createX402SettleHook } from '../../hooks/x402-settle';

// ── Shared Mocks ──────────────────────────────────────────────

const mockStripe = createMockStripe();
const mockUnkey = createMockUnkey();
const mockX402 = createMockX402();

// ── App Setup ─────────────────────────────────────────────────

let app: FastifyInstance;

beforeAll(async () => {
  app = Fastify({ logger: false });

  // x402 payment hook (preHandler, runs BEFORE Unkey auth)
  const x402PaymentHandler = createX402PaymentHook(
    mockX402.server,
    '0x077Etest',
    '$0.001',
    'eip155:8453',
  );
  app.addHook('preHandler', async (request, reply) => {
    if (request.url.startsWith('/api/v1/')) {
      await x402PaymentHandler(request, reply);
    }
  });

  // Unkey auth hook (preHandler, skips if x402 already set billingPath)
  const unkeyAuthHandler = createAuthMiddleware(mockUnkey as any);
  app.addHook('preHandler', async (request, reply) => {
    if (request.url.startsWith('/api/v1/') && !request.billingPath) {
      await unkeyAuthHandler(request, reply);
    }
  });

  // Rate limit headers (onSend)
  app.addHook('onSend', rateLimitHeadersHook);

  // Stripe meter hook (onResponse)
  const meterUsage = createMeterUsageHook(mockStripe.client, 'api_calls');
  app.addHook('onResponse', async (request, reply) => {
    if (request.url.startsWith('/api/v1/')) {
      await meterUsage(request, reply);
    }
  });

  // Batch metering hook (onResponse)
  app.addHook('onResponse', async (request, reply) => {
    if (
      request.url.startsWith('/api/v1/') &&
      request.isBatchRequest &&
      request.billingPath === 'stripe' &&
      request.stripeCustomerId &&
      reply.statusCode < 400
    ) {
      mockStripe.client.billing.meterEvents
        .create({
          event_name: 'api_calls_batch',
          payload: {
            stripe_customer_id: request.stripeCustomerId,
            value: String(request.batchSize || 0),
          },
          identifier: `${request.id}-batch-${Date.now()}`,
        })
        .catch(() => {});
    }
  });

  // x402 settlement hook (onResponse)
  const settleHandler = createX402SettleHook(mockX402.server);
  app.addHook('onResponse', async (request, reply) => {
    if (request.url.startsWith('/api/v1/')) {
      await settleHandler(request, reply);
    }
  });

  // Register routes
  await app.register(publicApiRoutes);
  await app.register(batchRoute);
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

beforeEach(() => {
  mockStripe.meterEventsCreate.mockClear();
  mockUnkey.keys.verifyKey.mockReset();
  mockX402.verifyPayment.mockClear();
  mockX402.settlePayment.mockClear();
  mockX402.buildPaymentRequirements.mockClear();
  mockX402.findMatchingRequirements.mockClear();
});

// ── Helpers ───────────────────────────────────────────────────

function makeX402PaymentHeader(): string {
  return Buffer.from(
    JSON.stringify({
      scheme: 'exact',
      network: 'eip155:8453',
      amount: '1000',
      signature: '0xfakeSignature',
    }),
  ).toString('base64');
}

// Simple payloads for each endpoint (fast, no external deps)
const ENDPOINT_PAYLOADS: Record<string, { method: string; url: string; payload?: unknown }> = {
  bandit: {
    method: 'POST',
    url: '/api/v1/optimize/bandit',
    payload: {
      arms: [
        { id: 'a', name: 'A', pulls: 10, totalReward: 4 },
        { id: 'b', name: 'B', pulls: 10, totalReward: 3 },
      ],
      algorithm: 'ucb1',
    },
  },
  contextualBandit: {
    method: 'POST',
    url: '/api/v1/optimize/contextual-bandit',
    payload: {
      arms: [
        { id: 'x', name: 'X' },
        { id: 'y', name: 'Y' },
      ],
      context: [0.5, 0.5],
    },
  },
  constraints: {
    method: 'POST',
    url: '/api/v1/solve/constraints',
    payload: {
      direction: 'maximize',
      objective: { x: 1 },
      variables: [{ name: 'x', lower: 0, upper: 10 }],
      constraints: [],
    },
  },
  schedule: {
    method: 'POST',
    url: '/api/v1/solve/schedule',
    payload: {
      tasks: [
        { id: 't1', name: 'T1', durationMinutes: 30, priority: 5, energyRequired: 'low' },
      ],
      slots: [
        { id: 's1', startTime: 1711350000, durationMinutes: 60, energyLevel: 'low' },
      ],
    },
  },
  graph: {
    method: 'POST',
    url: '/api/v1/analyze/graph',
    payload: {
      nodes: [
        { id: 'a', type: 'action', label: 'A', urgency: 'low', confidence: 0.5, impact: 0.5, timestamp: Date.now() },
        { id: 'b', type: 'goal', label: 'B', urgency: 'low', confidence: 0.5, impact: 0.5, timestamp: Date.now() },
      ],
      edges: [{ source: 'a', target: 'b', type: 'enables', weight: 0.5 }],
    },
  },
  convergence: {
    method: 'POST',
    url: '/api/v1/score/convergence',
    payload: {
      sources: [
        { id: 's1', name: 'S1', probability: 0.7, lastUpdated: Date.now() },
        { id: 's2', name: 'S2', probability: 0.6, lastUpdated: Date.now() },
      ],
    },
  },
  calibration: {
    method: 'POST',
    url: '/api/v1/score/calibration',
    payload: {
      predictions: [0.9, 0.8, 0.3],
      outcomes: [1, 1, 0],
    },
  },
  montecarlo: {
    method: 'POST',
    url: '/api/v1/simulate/montecarlo',
    payload: {
      distribution: 'normal',
      params: { mean: 100, stddev: 10 },
      iterations: 100,
    },
  },
  evolve: {
    method: 'POST',
    url: '/api/v1/optimize/evolve',
    payload: {
      geneLength: 2,
      populationSize: 10,
      maxGenerations: 5,
      fitnessWeights: [1, 1],
    },
  },
  bayesian: {
    method: 'POST',
    url: '/api/v1/predict/bayesian',
    payload: {
      prior: 0.5,
      evidence: [{ factor: 'test', weight: 0.5, value: 0.7 }],
    },
  },
  ensemble: {
    method: 'POST',
    url: '/api/v1/predict/ensemble',
    payload: {
      predictions: [
        { modelId: 'm1', prediction: 0.7, confidence: 0.8 },
        { modelId: 'm2', prediction: 0.6, confidence: 0.7 },
      ],
    },
  },
  scenario: {
    method: 'POST',
    url: '/api/v1/simulate/scenario',
    payload: {
      scenarios: [{ name: 'Up', variables: { x: 120 } }],
      baseCase: { x: 100 },
    },
  },
  pathfind: {
    method: 'POST',
    url: '/api/v1/plan/pathfind',
    payload: {
      nodes: [
        { id: 'start', cost: 0 },
        { id: 'end', cost: 0 },
      ],
      edges: [{ from: 'start', to: 'end', cost: 5 }],
      start: 'start',
      end: 'end',
    },
  },
  forecast: {
    method: 'POST',
    url: '/api/v1/predict/forecast',
    payload: {
      data: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120],
      steps: 3,
      method: 'holt-winters',
      seasonLength: 4,
    },
  },
  anomaly: {
    method: 'POST',
    url: '/api/v1/detect/anomaly',
    payload: {
      data: [1, 2, 3, 100, 2, 3, 1],
      method: 'zscore',
      threshold: 2.0,
    },
  },
  cmaes: {
    method: 'POST',
    url: '/api/v1/optimize/cmaes',
    payload: {
      dimension: 2,
      objectiveWeights: [1, 1],
      maxIterations: 10,
    },
  },
  risk: {
    method: 'POST',
    url: '/api/v1/analyze/risk',
    payload: {
      weights: [0.6, 0.4],
      returns: [
        [0.01, -0.02, 0.03, 0.01, -0.01],
        [0.02, 0.01, -0.01, 0.02, 0.00],
      ],
      confidence: 0.95,
    },
  },
};

// ── Tests ─────────────────────────────────────────────────────

describe('E2E Billing Verification (INFRA-03)', () => {
  // ── All Endpoints ─────────────────────────────────────────

  describe('all 17 algorithm endpoints return valid 200 responses', () => {
    for (const [name, config] of Object.entries(ENDPOINT_PAYLOADS)) {
      it(`${name}: ${config.url} returns 200`, async () => {
        // No auth header = free tier
        const response = await app.inject({
          method: config.method as any,
          url: config.url,
          payload: config.payload as any,
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.payload);
        expect(body).toBeDefined();
        expect(typeof body).toBe('object');
      });
    }
  });

  // ── Free-Tier Flow ────────────────────────────────────────

  describe('free-tier billing flow', () => {
    it('unauthenticated call returns result with no Stripe meter event', async () => {
      mockStripe.meterEventsCreate.mockClear();

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/score/calibration',
        payload: {
          predictions: [0.9, 0.7],
          outcomes: [1, 0],
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.brier_score).toBeDefined();

      // Wait briefly for fire-and-forget hooks
      await new Promise((r) => setTimeout(r, 50));

      // No meter event should be emitted for free-tier
      expect(mockStripe.meterEventsCreate).not.toHaveBeenCalled();
    });

    it('free-tier sets billingPath=free and tier=free', async () => {
      // /api/v1/usage returns { tier, billingPath } from request context
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/usage',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.tier).toBe('free');
      expect(body.billingPath).toBe('free');
    });
  });

  // ── Stripe Paid-Tier Flow ─────────────────────────────────

  describe('Stripe paid-tier billing flow', () => {
    it('API key call returns result and emits Stripe meter event', async () => {
      // Setup Unkey mock for valid key
      mockUnkey.keys.verifyKey.mockResolvedValueOnce(
        mockVerifyValid({ tier: 'starter', stripeCustomerId: 'cus_e2e_test' }),
      );
      mockStripe.meterEventsCreate.mockClear();

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/score/calibration',
        headers: { authorization: 'Bearer ok_test_key_123' },
        payload: {
          predictions: [0.9, 0.7],
          outcomes: [1, 0],
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.brier_score).toBeDefined();

      // Wait briefly for fire-and-forget meter event
      await new Promise((r) => setTimeout(r, 50));

      // Meter event should have been emitted
      expect(mockStripe.meterEventsCreate).toHaveBeenCalledTimes(1);
      expect(mockStripe.meterEventsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          event_name: 'api_calls',
          payload: expect.objectContaining({
            stripe_customer_id: 'cus_e2e_test',
            value: '1',
          }),
        }),
      );
    });

    it('paid-tier sets billingPath=stripe and correct tier', async () => {
      mockUnkey.keys.verifyKey.mockResolvedValueOnce(
        mockVerifyValid({ tier: 'growth', stripeCustomerId: 'cus_growth_test' }),
      );

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/usage',
        headers: { authorization: 'Bearer ok_test_growth' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.tier).toBe('growth');
      expect(body.billingPath).toBe('stripe');
    });

    it('includes X-RateLimit headers on Stripe-authenticated responses', async () => {
      mockUnkey.keys.verifyKey.mockResolvedValueOnce(
        mockVerifyValid({
          tier: 'starter',
          stripeCustomerId: 'cus_rl_test',
          remaining: 42,
          limit: 1667,
          reset: 1700000000,
        }),
      );

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/score/calibration',
        headers: { authorization: 'Bearer ok_test_ratelimit' },
        payload: {
          predictions: [0.5],
          outcomes: [1],
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
      expect(response.headers['x-ratelimit-limit']).toBeDefined();
      expect(response.headers['x-ratelimit-reset']).toBeDefined();
    });
  });

  // ── x402 Machine Payment Flow ─────────────────────────────

  describe('x402 machine payment flow', () => {
    it('USDC payment header call returns result and triggers settlement', async () => {
      mockX402.verifyPayment.mockResolvedValueOnce({ isValid: true });
      mockX402.settlePayment.mockClear();
      mockStripe.meterEventsCreate.mockClear();

      const paymentHeader = makeX402PaymentHeader();

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/score/calibration',
        headers: { 'x-payment': paymentHeader },
        payload: {
          predictions: [0.9, 0.7],
          outcomes: [1, 0],
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.brier_score).toBeDefined();

      // Wait briefly for fire-and-forget hooks
      await new Promise((r) => setTimeout(r, 50));

      // x402 settlement should have been called
      expect(mockX402.settlePayment).toHaveBeenCalledTimes(1);

      // No Stripe meter event (x402 path, not stripe path)
      expect(mockStripe.meterEventsCreate).not.toHaveBeenCalled();
    });

    it('x402 payment bypasses Unkey auth', async () => {
      mockX402.verifyPayment.mockResolvedValueOnce({ isValid: true });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/usage',
        headers: { 'x-payment': makeX402PaymentHeader() },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.billingPath).toBe('x402');
      expect(body.tier).toBe('x402');

      // Unkey should NOT have been called
      expect(mockUnkey.keys.verifyKey).not.toHaveBeenCalled();
    });
  });

  // ── Batch Billing Flow ────────────────────────────────────

  describe('batch billing flow', () => {
    it('batch call emits batch meter event at 50% rate', async () => {
      mockUnkey.keys.verifyKey.mockResolvedValueOnce(
        mockVerifyValid({ tier: 'starter', stripeCustomerId: 'cus_batch_test' }),
      );
      mockStripe.meterEventsCreate.mockClear();

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/batch',
        headers: { authorization: 'Bearer ok_test_batch' },
        payload: {
          calls: [
            { algorithm: 'score/calibration', params: { predictions: [0.8], outcomes: [1] } },
            { algorithm: 'detect/anomaly', params: { data: [1, 2, 100, 2, 1], method: 'zscore' } },
          ],
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.meta.total).toBe(2);
      expect(body.meta.succeeded).toBe(2);

      // Wait for fire-and-forget hooks
      await new Promise((r) => setTimeout(r, 100));

      // Should have called meter events -- batch meter event with batchSize
      const batchCalls = mockStripe.meterEventsCreate.mock.calls.filter(
        (call: unknown[]) => (call[0] as any).event_name === 'api_calls_batch',
      );
      expect(batchCalls.length).toBe(1);
      expect(batchCalls[0][0].payload.value).toBe('2');
      expect(batchCalls[0][0].payload.stripe_customer_id).toBe('cus_batch_test');
    });

    it('batch call does NOT emit standard meter event (no double-metering)', async () => {
      mockUnkey.keys.verifyKey.mockResolvedValueOnce(
        mockVerifyValid({ tier: 'starter', stripeCustomerId: 'cus_nodbl_test' }),
      );
      mockStripe.meterEventsCreate.mockClear();

      await app.inject({
        method: 'POST',
        url: '/api/v1/batch',
        headers: { authorization: 'Bearer ok_test_nodbl' },
        payload: {
          calls: [
            { algorithm: 'score/calibration', params: { predictions: [0.5], outcomes: [1] } },
          ],
        },
      });

      // Wait for fire-and-forget hooks
      await new Promise((r) => setTimeout(r, 100));

      // Standard meter (api_calls) should NOT fire for batch requests
      const standardCalls = mockStripe.meterEventsCreate.mock.calls.filter(
        (call: unknown[]) => (call[0] as any).event_name === 'api_calls',
      );
      expect(standardCalls.length).toBe(0);
    });
  });

  // ── Cross-Billing Path ────────────────────────────────────

  describe('billing path isolation', () => {
    it('free tier does not trigger x402 settlement', async () => {
      mockX402.settlePayment.mockClear();

      await app.inject({
        method: 'POST',
        url: '/api/v1/score/calibration',
        payload: { predictions: [0.5], outcomes: [1] },
      });

      await new Promise((r) => setTimeout(r, 50));
      expect(mockX402.settlePayment).not.toHaveBeenCalled();
    });

    it('Stripe tier does not trigger x402 settlement', async () => {
      mockUnkey.keys.verifyKey.mockResolvedValueOnce(
        mockVerifyValid({ tier: 'starter', stripeCustomerId: 'cus_no_x402' }),
      );
      mockX402.settlePayment.mockClear();

      await app.inject({
        method: 'POST',
        url: '/api/v1/score/calibration',
        headers: { authorization: 'Bearer ok_test_no_x402' },
        payload: { predictions: [0.5], outcomes: [1] },
      });

      await new Promise((r) => setTimeout(r, 50));
      expect(mockX402.settlePayment).not.toHaveBeenCalled();
    });
  });
});
