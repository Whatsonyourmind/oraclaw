/**
 * free-tier-rate-limit.ts
 *
 * BILL-02: Free-tier IP-based rate limiting using @fastify/rate-limit.
 *
 * - Limits unauthenticated callers (no Authorization header) to 100 calls per 24 hours
 * - Authenticated callers bypass this limit entirely (Unkey handles their rate limits)
 * - Returns RFC 9457 problem detail on 429
 *
 * IMPORTANT: @fastify/rate-limit uses the onRequest hook, which fires BEFORE preHandler.
 * The skip function checks request.headers.authorization (always available at onRequest),
 * NOT request.billingPath (which is set later in the preHandler by the Unkey auth middleware).
 */

import type { FastifyInstance } from 'fastify';
import rateLimit from '@fastify/rate-limit';

/**
 * Register free-tier rate limiting on a Fastify instance.
 * Must be called before route registration.
 */
export async function registerFreeTierRateLimit(fastify: FastifyInstance): Promise<void> {
  await fastify.register(rateLimit, {
    max: 100,
    timeWindow: 86_400_000, // 24 hours in milliseconds

    // Rate limit by IP address
    keyGenerator: (request) => request.ip,

    // Skip rate limiting for authenticated requests (they have their own Unkey limits)
    // CRITICAL: Use raw header, NOT request.billingPath -- onRequest fires BEFORE preHandler
    // @fastify/rate-limit uses `allowList` (not `skip`) to bypass rate limiting
    allowList: (request) => !!request.headers.authorization,

    // RFC 9457 problem detail response
    errorResponseBuilder: (_request, context) => ({
      type: 'https://web-olive-one-89.vercel.app/errors/rate-limited',
      title: 'Free tier rate limit exceeded',
      status: 429,
      detail: 'Free tier allows 100 API calls per day. Upgrade for higher limits.',
      'retry-after': Math.ceil(context.ttl / 1000),
    }),

    // Include standard rate limit headers
    addHeaders: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
      'retry-after': true,
    },
  });
}
