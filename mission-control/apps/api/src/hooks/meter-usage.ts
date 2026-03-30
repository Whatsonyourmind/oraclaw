/**
 * meter-usage.ts
 *
 * Stripe Billing Meter onResponse hook for per-call usage metering.
 * Emits a meter event for every authenticated API request that:
 *   - has billingPath === 'stripe'
 *   - has a stripeCustomerId
 *   - returned a successful response (< 400)
 *
 * Fire-and-forget pattern: meter event emission does NOT block the response.
 * Failures are logged but never thrown.
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import type Stripe from 'stripe';

/**
 * Factory that creates an async Fastify onResponse hook for Stripe meter events.
 *
 * @param stripe - Stripe client instance (injected for testability)
 * @param eventName - The Stripe Billing Meter event name (e.g. 'api_calls')
 * @returns Async onResponse hook function
 */
export function createMeterUsageHook(stripe: Stripe, eventName: string) {
  return async function meterUsageHook(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    // Only meter authenticated Stripe-billed requests that succeeded
    // Skip batch requests (metered separately at 50% rate via batch hook in index.ts)
    if (
      request.billingPath !== 'stripe' ||
      !request.stripeCustomerId ||
      reply.statusCode >= 400 ||
      request.isBatchRequest
    ) {
      return;
    }

    // Fire-and-forget: emit meter event without blocking the response.
    // The .catch() ensures errors are logged but never bubble up.
    stripe.billing.meterEvents
      .create({
        event_name: eventName,
        payload: {
          stripe_customer_id: request.stripeCustomerId,
          value: '1',
        },
        identifier: `${request.id}-${Date.now()}`,
      })
      .catch((err) => {
        request.log.error({ err }, 'Stripe meter event failed');
      });
  };
}
