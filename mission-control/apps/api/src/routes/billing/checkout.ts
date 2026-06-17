/**
 * checkout.ts
 *
 * GET /checkout?tier=...  — Public, keyless self-serve Stripe Checkout entry.
 *
 * OC-PAY-1: The web pricing page links here. Unlike POST /subscribe (which
 * requires an authenticated Stripe customer), this route is anonymous: Stripe
 * Checkout collects the customer's email and creates the customer itself.
 *
 * Resolves at /api/v1/billing/checkout once registered with that prefix.
 * It validates the tier, looks up the configured Stripe price, creates a
 * Checkout Session, and 302-redirects the browser to checkout.stripe.com.
 *
 * The route is inert until STRIPE_SECRET_KEY (+ STRIPE_PRICE_* ) are set on the
 * server: with no price configured it returns a 400 Problem Details response.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { TIER_CONFIG } from '../../services/billing/tiers';
import { stripeService } from '../../services/billing/stripe';

// ── Query Schema ────────────────────────────────────────────

interface CheckoutQuery {
  tier?: string;
  success_url?: string;
  cancel_url?: string;
}

// ── Tiers that can be checked out anonymously ───────────────

const CHECKOUTABLE_TIERS = new Set(['pay_per_call', 'starter', 'growth', 'scale']);

const SITE_URL = 'https://web-olive-one-89.vercel.app';

// ── Route Plugin ────────────────────────────────────────────

export async function checkoutRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get<{ Querystring: CheckoutQuery }>(
    '/checkout',
    async (request: FastifyRequest<{ Querystring: CheckoutQuery }>, reply: FastifyReply) => {
      const { tier, success_url, cancel_url } = request.query || {};

      // 1. Validate tier — only self-serve paid tiers (reject free/enterprise/unknown).
      if (!tier || !CHECKOUTABLE_TIERS.has(tier)) {
        return reply.code(400).type('application/problem+json').send({
          type: 'https://web-olive-one-89.vercel.app/errors/invalid-tier',
          title: 'Invalid tier',
          status: 400,
          detail: `Unknown or non-checkoutable tier '${tier ?? ''}'. Valid tiers: pay_per_call, starter, growth, scale.`,
        });
      }

      // 2. Look up the configured Stripe price.
      const priceId = TIER_CONFIG[tier]?.stripePriceId;
      if (!priceId) {
        return reply.code(400).type('application/problem+json').send({
          type: 'https://web-olive-one-89.vercel.app/errors/tier-not-configured',
          title: 'Tier not configured',
          status: 400,
          detail: `Stripe price ID not configured for tier '${tier}'. Contact support.`,
        });
      }

      // 3. Build redirect URLs from the query, defaulting to the site URL.
      const successUrl = success_url || `${SITE_URL}/dashboard?checkout=success&tier=${tier}`;
      const cancelUrl = cancel_url || `${SITE_URL}/pricing?checkout=canceled`;

      // 4. Create an anonymous Checkout Session and 302-redirect to Stripe.
      try {
        const checkout = await stripeService.createCheckoutSession({
          priceId,
          successUrl,
          cancelUrl,
          metadata: { tier },
        });
        return reply.redirect(checkout.checkout_url, 302);
      } catch (err: unknown) {
        request.log.error({ err }, 'Failed to create anonymous checkout session');
        return reply.code(502).type('application/problem+json').send({
          type: 'https://web-olive-one-89.vercel.app/errors/checkout-failed',
          title: 'Checkout session creation failed',
          status: 502,
          detail: 'Unable to create Stripe Checkout session. Please retry.',
        });
      }
    },
  );
}
