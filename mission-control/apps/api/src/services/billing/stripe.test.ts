/**
 * stripe.test.ts
 *
 * Targeted coverage for StripeService.createCheckoutSession (OC-PAY-1).
 * Covers both branches of the customer handling:
 *   - With customerId  -> session.customer is set, no customer_creation
 *   - Without customerId -> customer_creation: 'always', no customer field
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock the Stripe SDK before importing the service ───────────

const { mockSessionsCreate } = vi.hoisted(() => ({
  mockSessionsCreate: vi.fn().mockResolvedValue({
    url: 'https://checkout.stripe.com/test_session',
    id: 'cs_test_123',
    expires_at: Math.floor(Date.now() / 1000) + 3600,
  }),
}));

vi.mock('stripe', () => {
  // Stripe is imported as a default export and instantiated with `new Stripe(...)`.
  // Use a real class so `new Stripe(...)` works as a constructor.
  class StripeMock {
    checkout = { sessions: { create: mockSessionsCreate } };
  }
  return { default: StripeMock };
});

import { stripeService } from './stripe';

describe('StripeService.createCheckoutSession (OC-PAY-1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('attaches an existing customer when customerId is provided', async () => {
    const result = await stripeService.createCheckoutSession({
      customerId: 'cus_existing',
      priceId: 'price_starter',
      successUrl: 'https://x.test/ok',
      cancelUrl: 'https://x.test/no',
      metadata: { tier: 'starter' },
    });

    expect(mockSessionsCreate).toHaveBeenCalledTimes(1);
    const params = mockSessionsCreate.mock.calls[0][0];
    expect(params.customer).toBe('cus_existing');
    expect(params.customer_creation).toBeUndefined();
    expect(result.checkout_url).toBe('https://checkout.stripe.com/test_session');
    expect(result.session_id).toBe('cs_test_123');
  });

  it("sets customer_creation: 'always' for the anonymous (customer-less) branch", async () => {
    const result = await stripeService.createCheckoutSession({
      priceId: 'price_growth',
      successUrl: 'https://x.test/ok',
      cancelUrl: 'https://x.test/no',
      metadata: { tier: 'growth' },
    });

    expect(mockSessionsCreate).toHaveBeenCalledTimes(1);
    const params = mockSessionsCreate.mock.calls[0][0];
    expect(params.customer).toBeUndefined();
    expect(params.customer_creation).toBe('always');
    expect(result.checkout_url).toBe('https://checkout.stripe.com/test_session');
  });
});
