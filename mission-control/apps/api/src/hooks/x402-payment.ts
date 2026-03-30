/**
 * x402-payment.ts
 *
 * x402 Payment preHandler hook for machine-to-machine USDC payments.
 * Validates the PAYMENT-SIGNATURE or X-PAYMENT header via an injected
 * x402 resource server, sets billingPath='x402' on valid payment, or
 * returns 402 with RFC 9457 problem details on failure.
 *
 * The hook receives the resource server as a parameter (same pattern as
 * createMeterUsageHook receiving Stripe). Tests inject a mock server.
 *
 * Hook ordering: runs BEFORE Unkey auth. If valid x402 payment header
 * is present, Unkey verification is skipped entirely.
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import { sendProblem, ProblemTypes } from '../utils/problem-details';

/**
 * x402 resource server interface (loose typing to avoid tight coupling
 * to @x402/core internals). The real server and mock both satisfy this.
 */
interface X402Server {
  verifyPayment(paymentPayload: unknown, requirements: unknown): Promise<{ isValid: boolean; invalidReason?: string }>;
  buildPaymentRequirements(config: { scheme: string; payTo: string; price: string; network: string }): Promise<unknown[]>;
  findMatchingRequirements(requirements: unknown[], paymentPayload: unknown): unknown | null;
}

/**
 * Create a preHandler hook that verifies x402 USDC payment headers.
 * If no payment header is present, the hook passes through (returns undefined)
 * so that downstream auth middleware (Unkey) handles the request.
 *
 * @param server - x402 resource server instance (injected for testability)
 * @param walletAddress - Receiving wallet address (e.g., from RECEIVING_WALLET_ADDRESS env)
 * @param pricePerCall - Price per API call (e.g., '$0.001')
 * @param network - Chain identifier (e.g., 'eip155:8453' for Base mainnet)
 * @returns Async preHandler hook function
 */
export function createX402PaymentHook(
  server: X402Server,
  walletAddress: string,
  pricePerCall: string,
  network: string,
) {
  return async function x402PaymentHandler(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    // Check for x402 payment header (Fastify lowercases all headers)
    const paymentHeader =
      (request.headers['payment-signature'] as string | undefined) ||
      (request.headers['x-payment'] as string | undefined);

    // No payment header = pass through to Unkey auth
    if (!paymentHeader) {
      return;
    }

    try {
      // Decode the base64 JSON payment payload
      const paymentPayload = JSON.parse(
        Buffer.from(paymentHeader, 'base64').toString(),
      );

      // Build payment requirements for this request
      const requirements = await server.buildPaymentRequirements({
        scheme: 'exact',
        payTo: walletAddress,
        price: pricePerCall,
        network,
      });

      // Find matching requirements
      const matching = server.findMatchingRequirements(
        requirements,
        paymentPayload,
      );

      if (!matching) {
        return sendProblem(
          reply,
          402,
          ProblemTypes.PAYMENT_REQUIRED,
          'Payment Required',
          'No matching payment requirements',
          { paymentRequirements: requirements },
        );
      }

      // Verify payment with facilitator
      const verifyResult = await server.verifyPayment(paymentPayload, matching);

      if (!verifyResult.isValid) {
        return sendProblem(
          reply,
          402,
          ProblemTypes.PAYMENT_REQUIRED,
          'Payment Required',
          `Payment verification failed: ${verifyResult.invalidReason}`,
          { paymentRequirements: requirements },
        );
      }

      // Payment verified -- set billing path and tier
      request.billingPath = 'x402';
      request.tier = 'x402';
      // Store payment context for settlement in onResponse
      request.x402Payment = { paymentPayload, requirements: matching };
    } catch (err) {
      request.log.error({ err }, 'x402 payment verification failed');
      return sendProblem(
        reply,
        402,
        ProblemTypes.PAYMENT_REQUIRED,
        'Payment Required',
        'Invalid payment header',
      );
    }
  };
}
