/**
 * Shared x402 Mock Utility
 *
 * Provides a mock factory for the x402 resource server with verifyPayment(),
 * settlePayment(), buildPaymentRequirements(), findMatchingRequirements(),
 * and initialize() stubbed.
 * Follows the same factory pattern as mock-stripe.ts and mock-unkey.ts.
 *
 * The mock returns both the server (for injection) and individual method spies
 * (for assertions), matching the mock-stripe.ts convention.
 */

import { vi } from 'vitest';

// ── Mock x402 Resource Server Factory ───────────────────────

/**
 * Creates a mock x402 resource server with verify, settle, build, and find stubs.
 * Returns the mock server and individual method spies for assertions.
 *
 * Usage:
 *   const { server, verifyPayment, settlePayment, buildPaymentRequirements } = createMockX402();
 *   // inject server into hook factory
 *   // assert: expect(verifyPayment).toHaveBeenCalledWith({ ... });
 */
export function createMockX402() {
  const verifyPayment = vi.fn().mockResolvedValue({ isValid: true });

  const settlePayment = vi.fn().mockResolvedValue({
    success: true,
    transaction: '0xabc123',
    network: 'eip155:8453',
  });

  const buildPaymentRequirements = vi.fn().mockResolvedValue([
    {
      scheme: 'exact',
      network: 'eip155:8453',
      amount: '1000',
      asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      payTo: '0x077Etest',
      maxTimeoutSeconds: 300,
      extra: {},
    },
  ]);

  const findMatchingRequirements = vi.fn().mockReturnValue({
    scheme: 'exact',
    network: 'eip155:8453',
    amount: '1000',
  });

  const initialize = vi.fn().mockResolvedValue(undefined);

  const server = {
    verifyPayment,
    settlePayment,
    buildPaymentRequirements,
    findMatchingRequirements,
    initialize,
  };

  return {
    server: server as any,
    verifyPayment,
    settlePayment,
    buildPaymentRequirements,
    findMatchingRequirements,
    initialize,
  };
}
