/**
 * webhook.ts
 *
 * POST /webhook — Stripe Webhook endpoint for subscription lifecycle events.
 *
 * Receives Stripe webhook events, verifies signature, and delegates to
 * StripeService.handleWebhookEvent() for processing.
 *
 * CRITICAL: This route must receive the raw body (not parsed JSON) for
 * signature verification. Fastify's content-type parser is configured
 * to pass raw Buffer for this route.
 *
 * Events handled:
 *   - customer.subscription.created/updated/deleted
 *   - customer.subscription.trial_will_end
 *   - invoice.paid / invoice.payment_failed
 *   - payment_method.attached / payment_method.detached
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { stripeService, stripe } from '../../services/billing/stripe';

// ── Route Plugin ────────────────────────────────────────────

export async function webhookRoutes(fastify: FastifyInstance): Promise<void> {
  // Register raw body content type parser for webhook signature verification.
  // Stripe requires the raw request body to verify the webhook signature.
  fastify.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (_req, body, done) => {
      done(null, body);
    },
  );

  fastify.post(
    '/webhook',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const signature = request.headers['stripe-signature'] as string | undefined;

      if (!signature) {
        return reply.code(400).send({
          type: 'https://oraclaw.dev/errors/missing-signature',
          title: 'Missing Stripe signature',
          status: 400,
          detail: 'The stripe-signature header is required for webhook verification.',
        });
      }

      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      if (!webhookSecret) {
        request.log.error('STRIPE_WEBHOOK_SECRET not configured -- cannot verify webhook');
        return reply.code(500).send({
          type: 'https://oraclaw.dev/errors/webhook-not-configured',
          title: 'Webhook not configured',
          status: 500,
          detail: 'Stripe webhook secret is not configured on the server.',
        });
      }

      let event;
      try {
        event = stripe.webhooks.constructEvent(
          request.body as Buffer,
          signature,
          webhookSecret,
        );
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        request.log.error({ err }, 'Stripe webhook signature verification failed');
        return reply.code(400).send({
          type: 'https://oraclaw.dev/errors/invalid-signature',
          title: 'Invalid webhook signature',
          status: 400,
          detail: `Webhook signature verification failed: ${message}`,
        });
      }

      // Process the event
      try {
        const result = await stripeService.handleWebhookEvent(event);
        request.log.info(
          { eventType: event.type, action: result.action },
          'Stripe webhook processed',
        );

        // Return 200 to acknowledge receipt (Stripe retries on non-2xx)
        return reply.code(200).send({
          received: true,
          action: result.action,
        });
      } catch (err) {
        request.log.error({ err, eventType: event.type }, 'Stripe webhook processing failed');
        // Still return 200 to prevent Stripe from retrying endlessly.
        // Log the error for investigation.
        return reply.code(200).send({
          received: true,
          action: 'error',
          error: 'Processing failed, logged for investigation',
        });
      }
    },
  );
}
