#!/usr/bin/env npx tsx
/**
 * setup-unkey.ts
 *
 * Bootstraps an Unkey API for OraClaw with tier-based rate limits.
 * Creates the API and namespace, then prints the required env vars.
 *
 * Usage:
 *   UNKEY_ROOT_KEY=ulk_xxx npx tsx scripts/setup-unkey.ts
 *
 * After running, set the printed UNKEY_API_ID env var on your API server.
 */

import { Unkey } from '@unkey/api';

const UNKEY_ROOT_KEY = process.env.UNKEY_ROOT_KEY;

if (!UNKEY_ROOT_KEY) {
  console.error('ERROR: UNKEY_ROOT_KEY environment variable is required.');
  console.error('Usage: UNKEY_ROOT_KEY=ulk_xxx npx tsx scripts/setup-unkey.ts');
  process.exit(1);
}

const unkey = new Unkey({ rootKey: UNKEY_ROOT_KEY });

interface TierRateLimit {
  tier: string;
  name: string;
  limit: number;
  duration: number; // ms
  description: string;
}

const TIER_RATE_LIMITS: TierRateLimit[] = [
  {
    tier: 'free',
    name: 'Free',
    limit: 100,
    duration: 86_400_000, // 24 hours
    description: '100 calls/day',
  },
  {
    tier: 'starter',
    name: 'Starter',
    limit: 1_667,
    duration: 86_400_000,
    description: '~50K calls/month as daily limit ($9/mo)',
  },
  {
    tier: 'growth',
    name: 'Growth',
    limit: 16_667,
    duration: 86_400_000,
    description: '~500K calls/month as daily limit ($49/mo)',
  },
  {
    tier: 'scale',
    name: 'Scale',
    limit: 166_667,
    duration: 86_400_000,
    description: '~5M calls/month as daily limit ($199/mo)',
  },
  {
    tier: 'enterprise',
    name: 'Enterprise',
    limit: 1_000_000,
    duration: 86_400_000,
    description: 'Effectively unlimited (custom)',
  },
];

async function main() {
  console.log('=== OraClaw Unkey API Setup ===\n');

  // Create the API
  console.log('Creating Unkey API: OraClaw Decision Intelligence...');
  const apiResponse = await unkey.apis.createApi({
    name: 'OraClaw Decision Intelligence API',
  });

  if (apiResponse.error) {
    console.error('Failed to create API:', apiResponse.error.message);
    process.exit(1);
  }

  const apiId = apiResponse.data.apiId;
  console.log(`  API ID: ${apiId}\n`);

  // Create a demo key for each tier to verify the setup
  console.log('Creating demo keys for each tier...\n');

  for (const tierConfig of TIER_RATE_LIMITS) {
    if (tierConfig.tier === 'free') {
      console.log(`  ${tierConfig.name}: No API key needed (rate limited by IP)`);
      continue;
    }

    console.log(`  Creating demo key for ${tierConfig.name} tier...`);
    const keyResponse = await unkey.keys.createKey({
      apiId,
      prefix: 'ok_demo',
      name: `Demo - ${tierConfig.name} tier`,
      meta: {
        tier: tierConfig.tier,
        demo: 'true',
      },
      ratelimits: [
        {
          name: 'api_calls',
          limit: tierConfig.limit,
          duration: tierConfig.duration,
          autoApply: true,
        },
      ],
      enabled: true,
    });

    if (keyResponse.error) {
      console.error(`    Failed: ${keyResponse.error.message}`);
      continue;
    }

    console.log(`    Key ID: ${keyResponse.data.keyId}`);
    console.log(`    Key:    ${keyResponse.data.key}`);
    console.log(`    Limit:  ${tierConfig.description}\n`);
  }

  // Summary
  console.log('=== SETUP COMPLETE ===\n');
  console.log('Add this environment variable to your API server:\n');
  console.log(`UNKEY_API_ID=${apiId}`);
  console.log(`\nAlso ensure you have set:`);
  console.log(`  UNKEY_ROOT_KEY=${UNKEY_ROOT_KEY.slice(0, 10)}...`);

  console.log('\n--- Tier Rate Limits ---');
  console.log('Tier        | Daily Limit   | Monthly Est.   | Price');
  console.log('------------|---------------|----------------|-------');
  for (const t of TIER_RATE_LIMITS) {
    const monthly = t.limit * 30;
    const prices: Record<string, string> = {
      free: 'Free',
      starter: '$9/mo',
      growth: '$49/mo',
      scale: '$199/mo',
      enterprise: 'Custom',
    };
    console.log(
      `${t.name.padEnd(12)}| ${String(t.limit).padEnd(14)}| ${String(monthly.toLocaleString()).padEnd(15)}| ${prices[t.tier]}`
    );
  }

  console.log('\nKey creation function signature:');
  console.log('  createApiKey(tier, stripeCustomerId, userEmail)');
  console.log('  Returns { keyId, key } -- the key is shown to the user ONCE.');
}

main().catch((err) => {
  console.error('Setup failed:', err.message);
  process.exit(1);
});
