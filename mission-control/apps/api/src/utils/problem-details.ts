/**
 * problem-details.ts
 *
 * RFC 9457 Problem Details for HTTP APIs.
 * Provides a shared helper and error type registry so every error response
 * from the OraClaw API uses the standard application/problem+json format.
 *
 * @see https://www.rfc-editor.org/rfc/rfc9457
 */

import type { FastifyReply } from 'fastify';

/**
 * RFC 9457 Problem Details object.
 * Core fields: type, title, status, detail, instance.
 * Extension fields allowed via index signature.
 */
export interface ProblemDetail {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance?: string;
  [key: string]: unknown;
}

/**
 * Registry of problem type URIs used across the OraClaw API.
 * Each maps to a stable URI under https://web-olive-one-89.vercel.app/errors/.
 */
export const ProblemTypes = {
  VALIDATION: 'https://web-olive-one-89.vercel.app/errors/validation',
  NOT_FOUND: 'https://web-olive-one-89.vercel.app/errors/not-found',
  RATE_LIMITED: 'https://web-olive-one-89.vercel.app/errors/rate-limited',
  UNAUTHORIZED: 'https://web-olive-one-89.vercel.app/errors/unauthorized',
  INTERNAL: 'https://web-olive-one-89.vercel.app/errors/internal',
  SERVICE_UNAVAILABLE: 'https://web-olive-one-89.vercel.app/errors/service-unavailable',
  CHECKOUT_FAILED: 'https://web-olive-one-89.vercel.app/errors/checkout-failed',
  PORTAL_FAILED: 'https://web-olive-one-89.vercel.app/errors/portal-failed',
  NO_BILLING_ACCOUNT: 'https://web-olive-one-89.vercel.app/errors/no-billing-account',
  INVALID_TIER: 'https://web-olive-one-89.vercel.app/errors/invalid-tier',
  NON_SUBSCRIBABLE_TIER: 'https://web-olive-one-89.vercel.app/errors/non-subscribable-tier',
  TIER_NOT_CONFIGURED: 'https://web-olive-one-89.vercel.app/errors/tier-not-configured',
  PAYMENT_REQUIRED: 'https://web-olive-one-89.vercel.app/errors/payment-required',
} as const;

/**
 * Send an RFC 9457 Problem Details response.
 *
 * Sets status code, content-type to application/problem+json, and sends
 * a JSON body with type, title, status, detail, plus any extension fields.
 *
 * @param reply  - Fastify reply object
 * @param status - HTTP status code
 * @param type   - Problem type URI (use ProblemTypes registry)
 * @param title  - Short human-readable summary
 * @param detail - Longer human-readable explanation
 * @param extra  - Optional extension fields (e.g., retry-after)
 */
export function sendProblem(
  reply: FastifyReply,
  status: number,
  type: string,
  title: string,
  detail: string,
  extra?: Record<string, unknown>,
): FastifyReply {
  const body: ProblemDetail = {
    type,
    title,
    status,
    detail,
    ...extra,
  };

  return reply.code(status).type('application/problem+json').send(body);
}
