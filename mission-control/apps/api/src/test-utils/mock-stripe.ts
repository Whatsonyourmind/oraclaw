/**
 * Shared Stripe Mock Utility
 *
 * Provides a mock factory for the Stripe client with billing.meterEvents.create()
 * stubbed for metered billing tests. Follows the same factory pattern as mock-unkey.ts.
 *
 * The mock returns both the client (for injection) and individual method spies
 * (for assertions), matching the mock-unkey.ts convention.
 */

import { vi } from 'vitest';

// ── Mock Stripe Client Factory ───────────────────────────────

/**
 * Creates a mock Stripe client with billing.meterEvents.create() stubbed.
 * Returns the mock client and individual method spies for assertions.
 *
 * Usage:
 *   const { client, meterEventsCreate } = createMockStripe();
 *   // inject client into service under test
 *   // assert: expect(meterEventsCreate).toHaveBeenCalledWith({ ... });
 */
export function createMockStripe() {
  const meterEventsCreate = vi.fn().mockResolvedValue({ id: 'mevt_mock_123' });

  const mockStripe = {
    billing: {
      meterEvents: {
        create: meterEventsCreate,
      },
    },
  };

  return {
    client: mockStripe as any,
    meterEventsCreate,
  };
}
