/**
 * checkout.test.ts
 *
 * Tests for GET /api/v1/billing/checkout (OC-PAY-1 self-serve checkout).
 * Covers:
 *   - Valid paid tier -> 302 redirect to the Stripe checkout URL
 *   - Free tier        -> 400 (not checkoutable)
 *   - Enterprise tier  -> 400 (not checkoutable)
 *   - Unknown tier     -> 400
 *   - Tier with no configured price -> 400 'Tier not configured'
 */

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';

// ── Mocks (hoisted) ────────────────────────────────────────

const { mockCheckoutCreate, mockTierConfig } = vi.hoisted(() => {
  const mockCheckoutCreate = vi.fn().mockResolvedValue({
    checkout_url: 'https://checkout.stripe.com/test_anon',
    session_id: 'cs_test_anon',
    expires_at: '2026-04-01T00:00:00.000Z',
  });

  const mockTierConfig: Record<string, any> = {
    free: { name: 'Free', stripePriceId: '', dailyLimit: 25, monthlyCallsIncluded: 750, unitAmountDecimal: '0', description: 'Free' },
    pay_per_call: { name: 'Pay-per-call', stripePriceId: 'price_ppc_test', dailyLimit: 1000, monthlyCallsIncluded: 0, unitAmountDecimal: '0.5', description: 'PPC' },
    starter: { name: 'Starter', stripePriceId: 'price_starter_test', dailyLimit: 1667, monthlyCallsIncluded: 50_000, unitAmountDecimal: '0.198', description: 'Starter' },
    growth: { name: 'Growth', stripePriceId: 'price_growth_test', dailyLimit: 16_667, monthlyCallsIncluded: 500_000, unitAmountDecimal: '0.0998', description: 'Growth' },
    // scale intentionally has NO price configured to test the 400 path
    scale: { name: 'Scale', stripePriceId: '', dailyLimit: 166_667, monthlyCallsIncluded: 5_000_000, unitAmountDecimal: '0.04998', description: 'Scale' },
    enterprise: { name: 'Enterprise', stripePriceId: 'price_enterprise_test', dailyLimit: 0, monthlyCallsIncluded: 0, unitAmountDecimal: '0', description: 'Enterprise' },
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

import { checkoutRoutes } from './checkout';

describe('GET /checkout (OC-PAY-1)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();
    app.register(checkoutRoutes);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects (302) to the Stripe checkout URL for a valid tier (starter)', async () => {
    const response = await app.inject({ method: 'GET', url: '/checkout?tier=starter' });

    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe('https://checkout.stripe.com/test_anon');
    expect(mockCheckoutCreate).toHaveBeenCalledWith(
      expect.objectContaining({ priceId: 'price_starter_test', metadata: { tier: 'starter' } }),
    );
    // Anonymous path: no customerId passed.
    expect(mockCheckoutCreate.mock.calls[0][0]).not.toHaveProperty('customerId');
  });

  it('passes through caller-supplied success_url / cancel_url', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/checkout?tier=growth&success_url=https%3A%2F%2Fx.test%2Fok&cancel_url=https%3A%2F%2Fx.test%2Fno',
    });

    expect(response.statusCode).toBe(302);
    expect(mockCheckoutCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        priceId: 'price_growth_test',
        successUrl: 'https://x.test/ok',
        cancelUrl: 'https://x.test/no',
      }),
    );
  });

  it('returns 400 for the free tier', async () => {
    const response = await app.inject({ method: 'GET', url: '/checkout?tier=free' });
    expect(response.statusCode).toBe(400);
    expect(mockCheckoutCreate).not.toHaveBeenCalled();
  });

  it('returns 400 for the enterprise tier', async () => {
    const response = await app.inject({ method: 'GET', url: '/checkout?tier=enterprise' });
    expect(response.statusCode).toBe(400);
    expect(mockCheckoutCreate).not.toHaveBeenCalled();
  });

  it('returns 400 for an unknown tier', async () => {
    const response = await app.inject({ method: 'GET', url: '/checkout?tier=platinum' });
    expect(response.statusCode).toBe(400);
    expect(mockCheckoutCreate).not.toHaveBeenCalled();
  });

  it("returns 400 'Tier not configured' when the price ID is empty", async () => {
    const response = await app.inject({ method: 'GET', url: '/checkout?tier=scale' });
    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.title).toBe('Tier not configured');
    expect(mockCheckoutCreate).not.toHaveBeenCalled();
  });
});
