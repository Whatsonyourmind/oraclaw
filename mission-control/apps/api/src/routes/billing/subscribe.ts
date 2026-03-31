/**
 * subscribe.ts
 *
 * POST /subscribe — Create a Stripe Checkout Session for a paid tier.
 *
 * BILL-03b: Validates tier against TIER_CONFIG, rejects free/enterprise/unknown,
 * requires stripeCustomerId from Unkey auth context, and returns checkout URL.
 *
 * All error responses follow RFC 9457 Problem Details format.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { TIER_CONFIG } from '../../services/billing/tiers';
import { stripeService } from '../../services/billing/stripe';

// ── Request Schema ──────────────────────────────────────────

interface SubscribeBody {
  tier: string;
  success_url?: string;
  cancel_url?: string;
}

// ── Tiers that cannot be subscribed to via Checkout ─────────

const NON_SUBSCRIBABLE_TIERS = new Set(['free', 'enterprise']);

// ── Route Plugin ────────────────────────────────────────────

export async function subscribeRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post<{ Body: SubscribeBody }>(
    '/subscribe',
    async (request: FastifyRequest<{ Body: SubscribeBody }>, reply: FastifyReply) => {
      const { tier, success_url, cancel_url } = request.body || {};

      // 1. Require Stripe customer identity (set by Unkey auth middleware)
      if (!request.stripeCustomerId) {
        return reply.code(403).send({
          type: 'https://web-olive-one-89.vercel.app/errors/no-billing-account',
          title: 'No billing account',
          status: 403,
          detail:
            'A Stripe customer ID is required to subscribe. Authenticate with a paid API key.',
        });
      }

      // 2. Validate tier exists in TIER_CONFIG
      if (!tier || !(tier in TIER_CONFIG)) {
        return reply.code(400).send({
          type: 'https://web-olive-one-89.vercel.app/errors/invalid-tier',
          title: 'Invalid tier',
          status: 400,
          detail: `Unknown tier '${tier}'. Valid paid tiers: pay_per_call, starter, growth, scale.`,
        });
      }

      // 3. Reject non-subscribable tiers (free, enterprise)
      if (NON_SUBSCRIBABLE_TIERS.has(tier)) {
        const reason =
          tier === 'free'
            ? 'The free tier does not require a subscription.'
            : 'Enterprise subscriptions require a custom agreement. Contact sales.';
        return reply.code(400).send({
          type: 'https://web-olive-one-89.vercel.app/errors/non-subscribable-tier',
          title: 'Tier not available for self-service subscription',
          status: 400,
          detail: reason,
        });
      }

      // 4. Look up Stripe price ID
      const tierConfig = TIER_CONFIG[tier];
      const priceId = tierConfig.stripePriceId;

      if (!priceId) {
        return reply.code(400).send({
          type: 'https://web-olive-one-89.vercel.app/errors/tier-not-configured',
          title: 'Tier not configured',
          status: 400,
          detail: `Stripe price ID not configured for tier '${tier}'. Contact support.`,
        });
      }

      // 5. Create Stripe Checkout Session
      try {
        const checkout = await stripeService.createCheckoutSession({
          customerId: request.stripeCustomerId,
          priceId,
          successUrl: success_url || 'https://web-olive-one-89.vercel.app/billing/success',
          cancelUrl: cancel_url || 'https://web-olive-one-89.vercel.app/billing/cancel',
          metadata: { tier },
        });

        return reply.code(200).send(checkout);
      } catch (err: unknown) {
        request.log.error({ err }, 'Failed to create checkout session');
        return reply.code(502).send({
          type: 'https://web-olive-one-89.vercel.app/errors/checkout-failed',
          title: 'Checkout session creation failed',
          status: 502,
          detail: 'Unable to create Stripe Checkout session. Please retry.',
        });
      }
    },
  );
}
