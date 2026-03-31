/**
 * Unkey Auth Middleware for Public API Routes
 *
 * - preHandler: verifies API key via Unkey (auth + rate limiting in one call)
 * - onSend: injects X-RateLimit-* headers on all responses
 *
 * Free tier (no Authorization header) skips Unkey entirely.
 * SDK/network errors return 503, not 401.
 */

import type { Unkey } from '@unkey/api';
import type { FastifyRequest, FastifyReply } from 'fastify';

// ── Fastify Request Augmentation ─────────────────────────

declare module 'fastify' {
  interface FastifyRequest {
    tier: string;
    keyId?: string;
    stripeCustomerId?: string;
    rateLimitRemaining?: number;
    rateLimitLimit?: number;
    rateLimitReset?: number;
    billingPath: 'stripe' | 'free' | 'x402';
    x402Payment?: { paymentPayload: unknown; requirements: unknown };
    isBatchRequest?: boolean;
    batchSize?: number;
  }
}

// ── Auth Middleware (preHandler) ──────────────────────────

const CODE_TO_STATUS: Record<string, number> = {
  NOT_FOUND: 401,
  RATE_LIMITED: 429,
  DISABLED: 403,
  EXPIRED: 401,
  USAGE_EXCEEDED: 429,
  FORBIDDEN: 403,
  INSUFFICIENT_PERMISSIONS: 403,
};

/**
 * Create a preHandler hook that verifies API keys via Unkey.
 * Handles auth, tier resolution, and rate limiting in a single verifyKey() call.
 */
export function createAuthMiddleware(unkeyClient: Unkey) {
  return async function unkeyAuthHandler(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const authHeader = request.headers.authorization;

    // No auth header = free tier (skip Unkey entirely)
    if (!authHeader) {
      request.tier = 'free';
      request.billingPath = 'free';
      return;
    }

    const key = authHeader.replace('Bearer ', '');

    let response;
    try {
      response = await unkeyClient.keys.verifyKey({ key });
    } catch (err: unknown) {
      // SDK / network error -- return 503, never 401
      request.log.error({ err }, 'Unkey verification failed');
      reply.code(503).send({
        type: 'https://web-olive-one-89.vercel.app/errors/service-unavailable',
        title: 'Authentication service unavailable',
        status: 503,
        detail: 'Unable to verify API key. Please retry.',
      });
      return;
    }

    const { data } = response;

    // Extract rate limit info and set headers (even on invalid keys)
    const rl = data.ratelimits?.[0];
    if (rl) {
      reply.header('X-RateLimit-Remaining', rl.remaining);
      reply.header('X-RateLimit-Limit', rl.limit);
      reply.header('X-RateLimit-Reset', rl.reset);
      request.rateLimitRemaining = rl.remaining;
      request.rateLimitLimit = rl.limit;
      request.rateLimitReset = rl.reset;
    }

    // Key verification failed
    if (!data.valid) {
      const code = data.code as string;
      const status = CODE_TO_STATUS[code] ?? 401;
      reply.code(status).send({
        type: `https://web-olive-one-89.vercel.app/errors/${code.toLowerCase().replaceAll('_', '-')}`,
        title: code === 'RATE_LIMITED' ? 'Rate limit exceeded' : 'Unauthorized',
        status,
        detail: `Key verification failed: ${code}`,
      });
      return;
    }

    // Valid key -- attach context for downstream route handlers
    request.tier = (data.meta?.tier as string) ?? 'starter';
    request.keyId = data.keyId;
    request.stripeCustomerId = data.meta?.stripeCustomerId as string | undefined;
    request.billingPath = 'stripe';
  };
}

// ── Rate Limit Headers Hook (onSend) ─────────────────────

/**
 * onSend hook that ensures X-RateLimit-* headers appear on ALL responses,
 * including successful ones. The preHandler sets them on errors and stores
 * them on the request; this hook picks them up for success paths.
 */
export async function rateLimitHeadersHook(
  request: FastifyRequest,
  reply: FastifyReply,
  payload: unknown,
): Promise<unknown> {
  if (request.rateLimitRemaining !== undefined) {
    reply.header('X-RateLimit-Remaining', request.rateLimitRemaining);
    reply.header('X-RateLimit-Limit', request.rateLimitLimit);
    reply.header('X-RateLimit-Reset', request.rateLimitReset);
  }
  return payload;
}
