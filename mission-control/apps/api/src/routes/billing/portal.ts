/**
 * portal.ts
 *
 * POST /portal-session — Create a Stripe Customer Portal session.
 *
 * BILL-05a: Returns portal URL for paying customers to manage billing,
 * invoices, and payment methods.
 * BILL-05b: Returns 403 for free-tier users without stripeCustomerId.
 *
 * Uses the raw Stripe client (not StripeService) since the service
 * does not expose billingPortal methods.
 *
 * All error responses follow RFC 9457 Problem Details format.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { stripe } from '../../services/billing/stripe';

// ── Default Return URL ──────────────────────────────────────

const PORTAL_RETURN_URL = process.env.PORTAL_RETURN_URL || 'https://web-olive-one-89.vercel.app';

// ── Route Plugin ────────────────────────────────────────────

export async function portalRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post(
    '/portal-session',
    async (request: FastifyRequest, reply: FastifyReply) => {
      // 1. Require Stripe customer identity (set by Unkey auth middleware)
      if (!request.stripeCustomerId) {
        return reply.code(403).send({
          type: 'https://web-olive-one-89.vercel.app/errors/no-billing-account',
          title: 'No billing account',
          status: 403,
          detail:
            'A Stripe customer ID is required to access the billing portal. Free-tier users do not have a billing account.',
        });
      }

      // 2. Create Stripe Billing Portal session
      try {
        const session = await stripe.billingPortal.sessions.create({
          customer: request.stripeCustomerId,
          return_url: PORTAL_RETURN_URL,
        });

        return reply.code(200).send({ url: session.url });
      } catch (err: unknown) {
        request.log.error({ err }, 'Failed to create portal session');
        return reply.code(502).send({
          type: 'https://web-olive-one-89.vercel.app/errors/portal-failed',
          title: 'Portal session creation failed',
          status: 502,
          detail: 'Unable to create Stripe billing portal session. Please retry.',
        });
      }
    },
  );
}
