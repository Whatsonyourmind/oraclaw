#!/usr/bin/env npx tsx
/**
 * setup-stripe.ts
 *
 * Creates OraClaw's Stripe product catalog:
 *   Free ($0), Starter ($9/mo), Growth ($49/mo), Scale ($199/mo), Enterprise (custom)
 *
 * Usage:
 *   STRIPE_SECRET_KEY=sk_test_xxx npx tsx scripts/setup-stripe.ts
 *
 * After running, set the printed STRIPE_PRICE_* env vars on your API server.
 */

import Stripe from 'stripe';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

if (!STRIPE_SECRET_KEY) {
  console.error('ERROR: STRIPE_SECRET_KEY environment variable is required.');
  console.error('Usage: STRIPE_SECRET_KEY=sk_test_xxx npx tsx scripts/setup-stripe.ts');
  process.exit(1);
}

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2026-03-25.dahlia',
});

interface TierDefinition {
  key: string;
  name: string;
  description: string;
  monthlyPrice: number; // in cents, 0 for free/custom
  dailyLimit: number;
  monthlyCallsIncluded: number;
  features: string[];
}

const TIERS: TierDefinition[] = [
  {
    key: 'free',
    name: 'Free',
    description: 'Get started with 100 API calls per day. No credit card required.',
    monthlyPrice: 0,
    dailyLimit: 100,
    monthlyCallsIncluded: 3_000,
    features: [
      '100 API calls/day',
      '3,000 calls/month',
      'All 19 algorithms',
      'Community support',
    ],
  },
  {
    key: 'starter',
    name: 'Starter',
    description: 'For individual developers and small projects.',
    monthlyPrice: 900, // $9.00
    dailyLimit: 1_667,
    monthlyCallsIncluded: 50_000,
    features: [
      '10,000 API calls/month',
      '~333 calls/day',
      'All 19 algorithms',
      'Email support',
      'API key management',
    ],
  },
  {
    key: 'growth',
    name: 'Growth',
    description: 'For growing teams with production workloads.',
    monthlyPrice: 4_900, // $49.00
    dailyLimit: 16_667,
    monthlyCallsIncluded: 500_000,
    features: [
      '100,000 API calls/month',
      '~3,333 calls/day',
      'All 19 algorithms',
      'Priority support',
      'Usage analytics',
      'Webhook notifications',
    ],
  },
  {
    key: 'scale',
    name: 'Scale',
    description: 'For high-volume applications and enterprise workloads.',
    monthlyPrice: 19_900, // $199.00
    dailyLimit: 166_667,
    monthlyCallsIncluded: 5_000_000,
    features: [
      '1,000,000 API calls/month',
      '~33,333 calls/day',
      'All 19 algorithms',
      'Dedicated support',
      'Advanced analytics',
      'Custom webhooks',
      'SLA guarantee',
    ],
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    description: 'Custom limits, dedicated support, and SLA. Contact sales.',
    monthlyPrice: 0, // Custom pricing
    dailyLimit: 0,
    monthlyCallsIncluded: 0,
    features: [
      'Unlimited API calls',
      'Custom rate limits',
      'Dedicated infrastructure',
      'White-glove onboarding',
      'Enterprise SLA (99.9%)',
      'Priority support with Slack channel',
      'Custom algorithms',
    ],
  },
];

async function main() {
  console.log('=== OraClaw Stripe Product Catalog Setup ===\n');

  // Create the product
  console.log('Creating product: OraClaw Decision Intelligence API...');
  const product = await stripe.products.create({
    name: 'OraClaw Decision Intelligence API',
    description:
      '19 production-grade ML algorithms for optimization, simulation, prediction, and planning. Sub-25ms response times.',
    metadata: {
      project: 'oraclaw',
      version: 'v2.3.0',
    },
  });
  console.log(`  Product ID: ${product.id}\n`);

  const envVars: Record<string, string> = {};

  for (const tier of TIERS) {
    if (tier.key === 'free') {
      console.log(`Skipping price creation for Free tier (no Stripe price needed).`);
      continue;
    }

    if (tier.key === 'enterprise') {
      // Create enterprise as a custom price marker (no fixed amount)
      console.log(`Creating price for Enterprise tier (custom/contact sales)...`);
      const price = await stripe.prices.create({
        product: product.id,
        currency: 'usd',
        unit_amount: 99_900, // $999 placeholder
        recurring: { interval: 'month' },
        nickname: `OraClaw Enterprise (Custom)`,
        metadata: {
          tier: 'enterprise',
          daily_limit: '0',
          monthly_calls: '0',
          custom_pricing: 'true',
        },
      });
      const envKey = `STRIPE_PRICE_ENTERPRISE`;
      envVars[envKey] = price.id;
      console.log(`  ${envKey}=${price.id}\n`);
      continue;
    }

    console.log(`Creating price for ${tier.name} tier ($${tier.monthlyPrice / 100}/mo)...`);
    const price = await stripe.prices.create({
      product: product.id,
      currency: 'usd',
      unit_amount: tier.monthlyPrice,
      recurring: { interval: 'month' },
      nickname: `OraClaw ${tier.name}`,
      metadata: {
        tier: tier.key,
        daily_limit: String(tier.dailyLimit),
        monthly_calls: String(tier.monthlyCallsIncluded),
      },
    });

    const envKey = `STRIPE_PRICE_${tier.key.toUpperCase()}`;
    envVars[envKey] = price.id;
    console.log(`  ${envKey}=${price.id}\n`);
  }

  // Create a customer portal configuration
  console.log('Creating Stripe Customer Portal configuration...');
  try {
    const portalConfig = await stripe.billingPortal.configurations.create({
      business_profile: {
        headline: 'OraClaw - Manage your subscription',
      },
      features: {
        subscription_update: {
          enabled: true,
          default_allowed_updates: ['price'],
          proration_behavior: 'create_prorations',
          products: [
            {
              product: product.id,
              prices: Object.values(envVars),
            },
          ],
        },
        subscription_cancel: {
          enabled: true,
          mode: 'at_period_end',
          cancellation_reason: {
            enabled: true,
            options: [
              'too_expensive',
              'missing_features',
              'switched_service',
              'unused',
              'other',
            ],
          },
        },
        invoice_history: {
          enabled: true,
        },
        payment_method_update: {
          enabled: true,
        },
      },
    });
    console.log(`  Portal Config ID: ${portalConfig.id}\n`);
  } catch (e: any) {
    console.log(`  Portal config skipped: ${e.message}\n`);
  }

  // Summary
  console.log('=== SETUP COMPLETE ===\n');
  console.log('Add these environment variables to your API server:\n');
  for (const [key, value] of Object.entries(envVars)) {
    console.log(`${key}=${value}`);
  }
  console.log(`\nSTRIPE_PRODUCT_ID=${product.id}`);
  console.log(`\nDon't forget to also set:`);
  console.log(`  STRIPE_SECRET_KEY=sk_live_xxx (or sk_test_xxx)`);
  console.log(`  STRIPE_PUBLISHABLE_KEY=pk_live_xxx (or pk_test_xxx)`);
  console.log(`  STRIPE_WEBHOOK_SECRET=whsec_xxx`);
}

main().catch((err) => {
  console.error('Setup failed:', err.message);
  process.exit(1);
});
