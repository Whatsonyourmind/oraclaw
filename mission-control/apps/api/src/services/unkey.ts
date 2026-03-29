/**
 * Unkey Client Singleton & Key Management
 *
 * Provides API key creation, rotation, and revocation via Unkey SDK v2.3.2.
 * Rate limits are configured per-key at creation time with autoApply: true,
 * so verifyKey() handles both auth and rate limiting in a single call.
 */

import { Unkey } from '@unkey/api';

// ── Singleton ────────────────────────────────────────────

export const unkey = new Unkey({
  rootKey: process.env.UNKEY_ROOT_KEY!,
});

// ── Tier Rate Limit Config ───────────────────────────────

export const TIER_RATE_LIMITS: Record<string, { limit: number; duration: number }> = {
  starter:    { limit: 1_667,     duration: 86_400_000 },  // ~50K/month as daily
  growth:     { limit: 16_667,    duration: 86_400_000 },  // ~500K/month
  scale:      { limit: 166_667,   duration: 86_400_000 },  // ~5M/month
  enterprise: { limit: 1_000_000, duration: 86_400_000 },  // effectively unlimited
};

// ── Key Management ───────────────────────────────────────

/**
 * Create a new API key with tier-based rate limits.
 * Returns { keyId, key } -- the key is shown to the user ONCE.
 */
export async function createApiKey(
  tier: string,
  stripeCustomerId: string,
  userEmail: string,
): Promise<{ keyId: string; key: string }> {
  const limits = TIER_RATE_LIMITS[tier] ?? TIER_RATE_LIMITS.starter;

  const response = await unkey.keys.createKey({
    apiId: process.env.UNKEY_API_ID!,
    prefix: 'ok_live',
    name: `${userEmail} - ${tier}`,
    externalId: stripeCustomerId,
    meta: { tier, stripeCustomerId },
    ratelimits: [{
      name: 'api_calls',
      limit: limits.limit,
      duration: limits.duration,
      autoApply: true,
    }],
    enabled: true,
  });

  return { keyId: response.data.keyId, key: response.data.key };
}

/**
 * Rotate an API key. The old key remains valid for `expirationMs` (default 1 hour).
 * Returns the new { keyId, key }.
 */
export async function rotateApiKey(
  keyId: string,
  expirationMs: number = 3_600_000,
): Promise<{ keyId: string; key: string }> {
  const response = await unkey.keys.rerollKey({
    keyId,
    expiration: expirationMs,
  });

  return { keyId: response.data.keyId, key: response.data.key };
}

/**
 * Permanently revoke an API key. Takes effect immediately.
 */
export async function revokeApiKey(keyId: string): Promise<void> {
  await unkey.keys.deleteKey({ keyId });
}
