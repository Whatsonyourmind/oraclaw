/**
 * Shared Stripe Mock Utility
 *
 * Provides a mock factory for the Stripe client with billing.meterEvents.create(),
 * checkout.sessions.create(), and billingPortal.sessions.create() stubbed.
 * Follows the same factory pattern as mock-unkey.ts.
 *
 * The mock returns both the client (for injection) and individual method spies
 * (for assertions), matching the mock-unkey.ts convention.
 */

import { vi } from 'vitest';

// ── Mock Stripe Client Factory ───────────────────────────────

/**
 * Creates a mock Stripe client with billing, checkout, and portal stubs.
 * Returns the mock client and individual method spies for assertions.
 *
 * Usage:
 *   const { client, meterEventsCreate, checkoutSessionsCreate, billingPortalSessionsCreate } = createMockStripe();
 *   // inject client into service under test
 *   // assert: expect(checkoutSessionsCreate).toHaveBeenCalledWith({ ... });
 */
export function createMockStripe() {
  const meterEventsCreate = vi.fn().mockResolvedValue({ id: 'mevt_mock_123' });

  const checkoutSessionsCreate = vi.fn().mockResolvedValue({
    id: 'cs_test_xxx',
    url: 'https://checkout.stripe.com/test_xxx',
    expires_at: Math.floor(Date.now() / 1000) + 3600,
  });

  const billingPortalSessionsCreate = vi.fn().mockResolvedValue({
    url: 'https://billing.stripe.com/session/test_xxx',
  });

  const mockStripe = {
    billing: {
      meterEvents: {
        create: meterEventsCreate,
      },
    },
    checkout: {
      sessions: {
        create: checkoutSessionsCreate,
      },
    },
    billingPortal: {
      sessions: {
        create: billingPortalSessionsCreate,
      },
    },
  };

  return {
    client: mockStripe as any,
    meterEventsCreate,
    checkoutSessionsCreate,
    billingPortalSessionsCreate,
  };
}
