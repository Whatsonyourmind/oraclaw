/**
 * subscribe.test.ts
 *
 * Tests for POST /api/v1/billing/subscribe (BILL-03b).
 * Covers:
 *   BILL-03b:  Valid paid tier creates Stripe Checkout Session
 *   BILL-03b2: Unknown tier returns 400 RFC 9457
 *   BILL-03b3: Free tier returns 400 (no subscription for free)
 *   BILL-03b4: No stripeCustomerId returns 403
 */

import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';

// ── Mocks (hoisted) ────────────────────────────────────────

const { mockCheckoutCreate, mockTierConfig } = vi.hoisted(() => {
  const mockCheckoutCreate = vi.fn().mockResolvedValue({
    checkout_url: 'https://checkout.stripe.com/test_xxx',
    session_id: 'cs_test_xxx',
    expires_at: '2026-04-01T00:00:00.000Z',
  });

  const mockTierConfig: Record<string, any> = {
    free: {
      name: 'Free',
      stripePriceId: '',
      dailyLimit: 100,
      monthlyCallsIncluded: 3000,
      unitAmountDecimal: '0',
      description: 'Free tier',
    },
    starter: {
      name: 'Starter',
      stripePriceId: 'price_starter_test',
      dailyLimit: 1667,
      monthlyCallsIncluded: 50_000,
      unitAmountDecimal: '0.198',
      description: 'Starter tier',
    },
    growth: {
      name: 'Growth',
      stripePriceId: 'price_growth_test',
      dailyLimit: 16_667,
      monthlyCallsIncluded: 500_000,
      unitAmountDecimal: '0.0998',
      description: 'Growth tier',
    },
    scale: {
      name: 'Scale',
      stripePriceId: 'price_scale_test',
      dailyLimit: 166_667,
      monthlyCallsIncluded: 5_000_000,
      unitAmountDecimal: '0.04998',
      description: 'Scale tier',
    },
    enterprise: {
      name: 'Enterprise',
      stripePriceId: 'price_enterprise_test',
      dailyLimit: 0,
      monthlyCallsIncluded: 0,
      unitAmountDecimal: '0',
      description: 'Enterprise tier',
    },
  };

  return { mockCheckoutCreate, mockTierConfig };
});

vi.mock('../../services/billing/stripe', () => ({
  stripeService: {
    createCheckoutSession: mockCheckoutCreate,
  },
}));

vi.mock('../../services/billing/tiers', () => ({
  TIER_CONFIG: mockTierConfig,
}));

// ── Test Setup ─────────────────────────────────────────────

import { subscribeRoutes } from './subscribe';

describe('POST /subscribe (BILL-03b)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();

    // Simulate Unkey auth middleware setting request properties
    app.addHook('preHandler', async (request) => {
      const body = request.body as Record<string, any> | undefined;
      // Use custom header to simulate auth context for testing
      const customerId = request.headers['x-test-stripe-customer-id'] as string | undefined;
      const tier = request.headers['x-test-tier'] as string | undefined;

      request.stripeCustomerId = customerId;
      request.tier = tier || 'free';
      request.billingPath = customerId ? 'stripe' : 'free';
    });

    app.register(subscribeRoutes);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // BILL-03b: Valid tier 'starter' with stripeCustomerId -> 200 with checkout_url
  it('creates Checkout Session for valid paid tier (starter)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/subscribe',
      headers: {
        'x-test-stripe-customer-id': 'cus_test_123',
        'x-test-tier': 'starter',
      },
      payload: { tier: 'starter' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toHaveProperty('checkout_url');
    expect(body).toHaveProperty('session_id');
    expect(body).toHaveProperty('expires_at');
    expect(mockCheckoutCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: 'cus_test_123',
        priceId: 'price_starter_test',
      }),
    );
  });

  // BILL-03b2: Unknown tier 'platinum' -> 400
  it('returns 400 for unknown tier', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/subscribe',
      headers: {
        'x-test-stripe-customer-id': 'cus_test_123',
        'x-test-tier': 'starter',
      },
      payload: { tier: 'platinum' },
    });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body).toHaveProperty('type');
    expect(body).toHaveProperty('title');
    expect(body).toHaveProperty('status', 400);
    expect(body).toHaveProperty('detail');
  });

  // BILL-03b3: Free tier -> 400
  it('returns 400 when subscribing to free tier', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/subscribe',
      headers: {
        'x-test-stripe-customer-id': 'cus_test_123',
        'x-test-tier': 'starter',
      },
      payload: { tier: 'free' },
    });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body).toHaveProperty('status', 400);
    expect(body.detail).toContain('free');
  });

  // BILL-03b3: Enterprise tier -> 400 (contact sales)
  it('returns 400 when subscribing to enterprise tier', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/subscribe',
      headers: {
        'x-test-stripe-customer-id': 'cus_test_123',
        'x-test-tier': 'starter',
      },
      payload: { tier: 'enterprise' },
    });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body).toHaveProperty('status', 400);
  });

  // BILL-03b4: No stripeCustomerId -> 403
  it('returns 403 when no stripeCustomerId present', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/subscribe',
      payload: { tier: 'starter' },
    });

    expect(response.statusCode).toBe(403);
    const body = response.json();
    expect(body).toHaveProperty('type');
    expect(body).toHaveProperty('title');
    expect(body).toHaveProperty('status', 403);
    expect(body).toHaveProperty('detail');
  });
});
