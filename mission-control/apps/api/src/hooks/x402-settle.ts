/**
 * x402-settle.ts
 *
 * x402 Settlement onResponse hook for on-chain USDC payment settlement.
 * After a successful (2xx) response to an x402-paid request, settles
 * the payment via the facilitator.
 *
 * Fire-and-forget pattern (same as meter-usage.ts): settlement does NOT
 * block the response. Failures are logged but never thrown.
 */

import type { FastifyRequest, FastifyReply } from 'fastify';

/**
 * x402 resource server interface for settlement.
 */
interface X402Server {
  settlePayment(paymentPayload: unknown, requirements: unknown): Promise<{
    success: boolean;
    transaction?: string;
    network?: string;
    errorReason?: string;
  }>;
}

/**
 * Factory that creates an async Fastify onResponse hook for x402 settlement.
 *
 * @param server - x402 resource server instance (injected for testability)
 * @returns Async onResponse hook function
 */
export function createX402SettleHook(server: X402Server) {
  return async function x402SettleHandler(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    // Only settle x402-paid requests that succeeded
    if (
      request.billingPath !== 'x402' ||
      !request.x402Payment ||
      reply.statusCode >= 400
    ) {
      return;
    }

    const { paymentPayload, requirements } = request.x402Payment;

    // Fire-and-forget: settle payment without blocking the response.
    // The .catch() ensures errors are logged but never bubble up.
    server
      .settlePayment(paymentPayload, requirements)
      .then((result) => {
        if (result.success) {
          request.log.info(
            { tx: result.transaction, network: result.network },
            'x402 payment settled',
          );
        } else {
          request.log.error(
            { reason: result.errorReason },
            'x402 settlement failed',
          );
        }
      })
      .catch((err) => {
        request.log.error({ err }, 'x402 settlement error');
      });
  };
}
