#!/usr/bin/env npx tsx
/**
 * Create a beta API key for lead conversion.
 *
 * Usage:
 *   npx tsx scripts/create-beta-key.ts --email user@example.com --name "juliosuas" --notes "airbnb-manager #13"
 */

import { Unkey } from '@unkey/api';

const args = process.argv.slice(2);
function getArg(flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx >= 0 ? args[idx + 1] : undefined;
}

const email = getArg('--email');
const name = getArg('--name') || 'beta-user';
const notes = getArg('--notes') || '';

if (!email) {
  console.error('Usage: npx tsx scripts/create-beta-key.ts --email <email> --name <name> --notes <notes>');
  process.exit(1);
}

const rootKey = process.env.UNKEY_ROOT_KEY;
const apiId = process.env.UNKEY_API_ID;

if (!rootKey || !apiId) {
  console.error('Missing UNKEY_ROOT_KEY or UNKEY_API_ID environment variables.');
  console.error('Set them or create a .env file with these values.');
  process.exit(1);
}

const unkey = new Unkey({ rootKey });

const thirtyDays = Date.now() + 30 * 24 * 60 * 60 * 1000;

async function main() {
  const response = await unkey.keys.createKey({
    apiId,
    prefix: 'ok_beta',
    name: `${name} (${email}) — beta`,
    meta: {
      tier: 'growth',
      beta: true,
      betaExpiry: new Date(thirtyDays).toISOString(),
      name,
      email,
      notes,
      createdAt: new Date().toISOString(),
    },
    ratelimits: [{
      name: 'api_calls',
      limit: 16_667,       // growth tier: ~500K/month
      duration: 86_400_000, // 24 hours
      autoApply: true,
    }],
    expires: thirtyDays,
    enabled: true,
  });

  if (response.error) {
    console.error('Failed to create key:', response.error);
    process.exit(1);
  }

  const { keyId, key } = response.data;

  console.log('\n═══════════════════════════════════════════');
  console.log('  OraClaw Beta Key Created');
  console.log('═══════════════════════════════════════════');
  console.log(`  Name:    ${name}`);
  console.log(`  Email:   ${email}`);
  console.log(`  Notes:   ${notes}`);
  console.log(`  Tier:    growth (16,667 calls/day)`);
  console.log(`  Expires: ${new Date(thirtyDays).toISOString().split('T')[0]}`);
  console.log(`  Key ID:  ${keyId}`);
  console.log(`  API Key: ${key}`);
  console.log('═══════════════════════════════════════════');
  console.log('\nOnboarding message (copy-paste):');
  console.log('───────────────────────────────────────────');
  console.log(`Hey ${name}! I set up a free OraClaw API key for you — full access to all 12 optimization tools for 30 days.`);
  console.log('');
  console.log(`Your API key: ${key}`);
  console.log('');
  console.log('Quick start (MCP — add to your Claude config):');
  console.log('```json');
  console.log('"oraclaw": {');
  console.log('  "command": "npx",');
  console.log('  "args": ["@oraclaw/mcp-server"],');
  console.log('  "env": {');
  console.log(`    "ORACLAW_API_KEY": "${key}"`);
  console.log('  }');
  console.log('}');
  console.log('```');
  console.log('');
  console.log('Or use the REST API directly:');
  console.log(`curl -X POST https://oraclaw-api.onrender.com/api/v1/optimize/bandit \\`);
  console.log(`  -H "Authorization: Bearer ${key}" \\`);
  console.log(`  -H "Content-Type: application/json" \\`);
  console.log(`  -d '{"arms":[{"id":"a","pulls":10,"totalReward":7},{"id":"b","pulls":10,"totalReward":5}]}'`);
  console.log('');
  console.log('This key gives you access to all tools including LP solver, graph analytics, CMA-ES, and portfolio risk.');
  console.log('Let me know if you hit any issues — I\'ll fix them same day.');
  console.log('───────────────────────────────────────────');

  // Append to tracking file
  const fs = await import('fs');
  const path = await import('path');
  const trackingFile = path.join(import.meta.dirname, '..', 'beta-keys.json');
  let tracking: Array<Record<string, unknown>> = [];
  try {
    tracking = JSON.parse(fs.readFileSync(trackingFile, 'utf-8'));
  } catch { /* file doesn't exist yet */ }
  tracking.push({
    name,
    email,
    notes,
    keyId,
    tier: 'growth',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(thirtyDays).toISOString(),
  });
  fs.writeFileSync(trackingFile, JSON.stringify(tracking, null, 2));
  console.log(`\nTracked in ${trackingFile}`);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
