/**
 * signup.ts
 *
 * POST /signup — Self-service API key creation.
 *
 * Flow: email → Stripe customer → Unkey API key → return key.
 * Zero friction: no password, no payment upfront.
 * User gets 1,000 calls/day on pay-per-call tier ($0.005/call, billed monthly).
 * To upgrade: POST /api/v1/billing/subscribe with desired tier.
 *
 * If the email already has a Stripe customer with an active subscription,
 * the key is created on the matching tier with appropriate rate limits.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { stripeService, stripe } from '../../services/billing/stripe';
import { createApiKey } from '../../services/unkey';
import { TIER_CONFIG } from '../../services/billing/tiers';

interface SignupBody {
  email: string;
}

export async function signupRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post<{ Body: SignupBody }>(
    '/signup',
    async (request: FastifyRequest<{ Body: SignupBody }>, reply: FastifyReply) => {
      const { email } = request.body || {};

      // 1. Validate email
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return reply.code(400).send({
          type: 'https://oraclaw-api.onrender.com/errors/invalid-email',
          title: 'Invalid email',
          status: 400,
          detail: 'A valid email address is required.',
        });
      }

      try {
        // 2. Get or create Stripe customer
        const customer = await stripeService.getOrCreateCustomer({
          userId: email,
          email,
        });

        // 3. Check for active subscription to determine tier
        let tier = 'pay_per_call';
        try {
          const subs = await stripe.subscriptions.list({
            customer: customer.id,
            status: 'active',
            limit: 1,
          });
          if (subs.data.length > 0) {
            const priceId = subs.data[0].items.data[0]?.price?.id;
            if (priceId) {
              for (const [t, config] of Object.entries(TIER_CONFIG)) {
                if (config.stripePriceId === priceId) {
                  tier = t;
                  break;
                }
              }
            }
          }
        } catch {
          // Subscription lookup failed — default to pay_per_call
        }

        // 4. Create Unkey API key
        const { key } = await createApiKey(tier, customer.id, email);

        // 5. Return key + onboarding info
        const tierConfig = TIER_CONFIG[tier];

        return reply.code(201).send({
          api_key: key,
          tier,
          customer_id: customer.id,
          daily_limit: tierConfig?.dailyLimit ?? 1000,
          pricing: tier === 'pay_per_call'
            ? '$0.005 per API call, billed monthly via Stripe'
            : `${tierConfig?.name} — ${tierConfig?.description}`,
          important: 'Save this API key — it cannot be retrieved again.',
          next_steps: {
            use_key: `Add header: Authorization: Bearer <your-key>`,
            test: 'curl -X POST https://oraclaw-api.onrender.com/api/v1/optimize/bandit -H "Authorization: Bearer <your-key>" -H "Content-Type: application/json" -d \'{"arms":[{"id":"a","name":"A"},{"id":"b","name":"B"}]}\'',
            subscribe: 'POST /api/v1/billing/subscribe {"tier":"starter"} for higher limits',
            portal: 'POST /api/v1/billing/portal-session to manage billing',
            docs: 'GET /api/v1/health for all available endpoints',
          },
        });
      } catch (err: unknown) {
        request.log.error({ err }, 'Signup failed');
        return reply.code(502).send({
          type: 'https://oraclaw-api.onrender.com/errors/signup-failed',
          title: 'Signup failed',
          status: 502,
          detail: 'Unable to create account. Please retry.',
        });
      }
    },
  );
}
