/**
 * provision.ts
 *
 * Auto-provisions Stripe products, billing meters, and prices on server boot.
 * Idempotent: searches for existing OraClaw products first, only creates if missing.
 * Falls back gracefully if Stripe API calls fail — subscribe will fail until
 * STRIPE_PRICE_* env vars are manually set.
 */

import type Stripe from 'stripe';
import { TIER_CONFIG } from './tiers';

interface ProductDef {
  name: string;
  metered?: boolean;
  unitAmountDecimal?: string;
  unitAmount?: number;
}

const PRODUCT_DEFS: Record<string, ProductDef> = {
  pay_per_call: {
    name: 'OraClaw API — Pay per Call',
    metered: true,
    unitAmountDecimal: '0.5', // $0.005 per call
  },
  starter: {
    name: 'OraClaw Starter — 50K calls/mo',
    unitAmount: 900, // $9/mo
  },
  growth: {
    name: 'OraClaw Growth — 500K calls/mo',
    unitAmount: 4900, // $49/mo
  },
  scale: {
    name: 'OraClaw Scale — 5M calls/mo',
    unitAmount: 19900, // $199/mo
  },
};

type Logger = { info: (...a: unknown[]) => void; warn: (...a: unknown[]) => void };

/**
 * Find or create the billing meter for API call tracking.
 */
async function findOrCreateMeter(stripe: Stripe, logger: Logger): Promise<string | null> {
  const eventName = process.env.STRIPE_METER_EVENT_NAME || 'api_calls';
  try {
    const meters = await stripe.billing.meters.list({ limit: 100 });
    const existing = meters.data.find(m => m.event_name === eventName);
    if (existing) {
      logger.info(`[PROVISION] Billing meter found: ${existing.id} (${eventName})`);
      return existing.id;
    }

    const meter = await stripe.billing.meters.create({
      display_name: 'OraClaw API Calls',
      event_name: eventName,
      default_aggregation: { formula: 'sum' },
      value_settings: { event_payload_key: 'value' },
    });
    logger.info(`[PROVISION] Billing meter created: ${meter.id}`);
    return meter.id;
  } catch (err) {
    logger.warn({ err }, '[PROVISION] Billing meter setup failed — metered billing may not work');
    return null;
  }
}

/**
 * Find or create a Stripe product + price for a tier.
 */
async function findOrCreateTierPrice(
  stripe: Stripe,
  tier: string,
  def: ProductDef,
  meterId: string | null,
  logger: Logger,
): Promise<string | null> {
  // Search for existing product by metadata
  try {
    const search = await stripe.products.search({
      query: `metadata['oraclaw_tier']:'${tier}'`,
    });
    if (search.data.length > 0) {
      const prices = await stripe.prices.list({
        product: search.data[0].id,
        active: true,
        limit: 1,
      });
      if (prices.data.length > 0) {
        logger.info(`[PROVISION] ${tier}: existing price ${prices.data[0].id}`);
        return prices.data[0].id;
      }
    }
  } catch {
    // Search API may fail — fall through to creation
  }

  // Create product
  const product = await stripe.products.create({
    name: def.name,
    metadata: { oraclaw_tier: tier, provider: 'oraclaw' },
  });
  logger.info(`[PROVISION] ${tier}: created product ${product.id}`);

  // Create price
  if (def.metered) {
    if (!meterId) {
      logger.warn(`[PROVISION] ${tier}: no billing meter — skipping metered price`);
      return null;
    }
    const price = await stripe.prices.create({
      product: product.id,
      currency: 'usd',
      recurring: { interval: 'month', meter: meterId } as Stripe.PriceCreateParams.Recurring,
      // Stripe SDK v21 types expect Decimal, but runtime accepts string
      unit_amount_decimal: def.unitAmountDecimal as any,
      billing_scheme: 'per_unit',
    });
    logger.info(`[PROVISION] ${tier}: created metered price ${price.id} ($${def.unitAmountDecimal}/100 per call)`);
    return price.id;
  }

  const price = await stripe.prices.create({
    product: product.id,
    currency: 'usd',
    recurring: { interval: 'month' },
    unit_amount: def.unitAmount!,
  });
  logger.info(`[PROVISION] ${tier}: created price ${price.id} ($${def.unitAmount! / 100}/mo)`);
  return price.id;
}

/**
 * Auto-provision Stripe products and prices for all paid tiers.
 *
 * - If STRIPE_PRICE_* env vars are set, uses those directly.
 * - Otherwise searches for existing products tagged with oraclaw_tier metadata.
 * - Creates products/prices that don't exist yet.
 * - Updates TIER_CONFIG in-place with discovered/created price IDs.
 */
export async function provisionStripeProducts(
  stripe: Stripe,
  logger: Logger,
): Promise<void> {
  // Check if all env vars are already set
  const envComplete = ['PAY_PER_CALL', 'STARTER', 'GROWTH', 'SCALE'].every(
    t => (process.env[`STRIPE_PRICE_${t}`] || '').startsWith('price_'),
  );

  if (envComplete) {
    logger.info('[PROVISION] All STRIPE_PRICE_* env vars set — skipping auto-provision');
    return;
  }

  logger.info('[PROVISION] Auto-provisioning Stripe products...');

  const meterId = await findOrCreateMeter(stripe, logger);

  for (const [tier, def] of Object.entries(PRODUCT_DEFS)) {
    const envKey = `STRIPE_PRICE_${tier.toUpperCase()}`;
    const envVal = process.env[envKey];

    // Skip if env var already set
    if (envVal && envVal.startsWith('price_')) {
      TIER_CONFIG[tier].stripePriceId = envVal;
      continue;
    }

    try {
      const priceId = await findOrCreateTierPrice(stripe, tier, def, meterId, logger);
      if (priceId && TIER_CONFIG[tier]) {
        TIER_CONFIG[tier].stripePriceId = priceId;
      }
    } catch (err) {
      logger.warn({ err }, `[PROVISION] Failed to provision ${tier} — set ${envKey} manually`);
    }
  }

  logger.info('[PROVISION] Done. Tier price IDs:', Object.fromEntries(
    Object.entries(TIER_CONFIG)
      .filter(([, v]) => v.stripePriceId)
      .map(([k, v]) => [k, v.stripePriceId]),
  ));
}
