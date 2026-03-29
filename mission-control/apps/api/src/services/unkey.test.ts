/**
 * Unkey Key Management Service Tests
 *
 * Tests for createApiKey, rotateApiKey, revokeApiKey and TIER_RATE_LIMITS config.
 * Covers AUTH-01 (key creation) and AUTH-02 (rotation, revocation).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  mockCreateKeySuccess,
  mockRerollKeySuccess,
} from '../test-utils/mock-unkey';

// ── Mock @unkey/api module ──────────────────────────────────
// vi.mock is hoisted above all imports, so we must use vi.hoisted()
// to declare mockKeys before the hoisted vi.mock factory runs.

const mockKeys = vi.hoisted(() => ({
  verifyKey: vi.fn(),
  createKey: vi.fn(),
  rerollKey: vi.fn(),
  deleteKey: vi.fn(),
}));

vi.mock('@unkey/api', () => {
  return {
    Unkey: class MockUnkey {
      keys = mockKeys;
    },
  };
});

// Import AFTER mocking so the module gets our mock Unkey
import { createApiKey, rotateApiKey, revokeApiKey, TIER_RATE_LIMITS } from './unkey';

describe('TIER_RATE_LIMITS config', () => {
  it('has all expected tiers', () => {
    expect(TIER_RATE_LIMITS).toHaveProperty('starter');
    expect(TIER_RATE_LIMITS).toHaveProperty('growth');
    expect(TIER_RATE_LIMITS).toHaveProperty('scale');
    expect(TIER_RATE_LIMITS).toHaveProperty('enterprise');
  });

  it('has correct daily limits', () => {
    expect(TIER_RATE_LIMITS.starter).toEqual({ limit: 1667, duration: 86_400_000 });
    expect(TIER_RATE_LIMITS.growth).toEqual({ limit: 16667, duration: 86_400_000 });
    expect(TIER_RATE_LIMITS.scale).toEqual({ limit: 166667, duration: 86_400_000 });
    expect(TIER_RATE_LIMITS.enterprise).toEqual({ limit: 1_000_000, duration: 86_400_000 });
  });
});

describe('createApiKey', () => {
  beforeEach(() => {
    mockKeys.createKey.mockReset();
  });

  it('calls createKey with correct parameters', async () => {
    mockKeys.createKey.mockResolvedValueOnce(mockCreateKeySuccess());

    await createApiKey('starter', 'cus_123', 'user@test.com');

    expect(mockKeys.createKey).toHaveBeenCalledTimes(1);
    const callArgs = mockKeys.createKey.mock.calls[0][0];
    expect(callArgs.prefix).toBe('ok_live');
    expect(callArgs.meta).toEqual({ tier: 'starter', stripeCustomerId: 'cus_123' });
    expect(callArgs.ratelimits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          autoApply: true,
          limit: 1667,
          duration: 86_400_000,
        }),
      ]),
    );
    expect(callArgs.enabled).toBe(true);
  });

  it('returns key and keyId on success', async () => {
    mockKeys.createKey.mockResolvedValueOnce(mockCreateKeySuccess());

    const result = await createApiKey('starter', 'cus_123', 'user@test.com');

    expect(result).toHaveProperty('key', 'ok_live_test123');
    expect(result).toHaveProperty('keyId', 'key_new');
  });

  it('throws on SDK error', async () => {
    mockKeys.createKey.mockRejectedValueOnce(new Error('SDK error'));

    await expect(createApiKey('starter', 'cus_123', 'user@test.com')).rejects.toThrow('SDK error');
  });

  it('defaults to starter limits for unknown tier', async () => {
    mockKeys.createKey.mockResolvedValueOnce(mockCreateKeySuccess());

    await createApiKey('unknown_tier', 'cus_123', 'user@test.com');

    const callArgs = mockKeys.createKey.mock.calls[0][0];
    expect(callArgs.ratelimits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          limit: 1667,
          duration: 86_400_000,
        }),
      ]),
    );
  });
});

describe('rotateApiKey', () => {
  beforeEach(() => {
    mockKeys.rerollKey.mockReset();
  });

  it('calls rerollKey with keyId and default 1-hour expiration', async () => {
    mockKeys.rerollKey.mockResolvedValueOnce(mockRerollKeySuccess());

    await rotateApiKey('key_abc');

    expect(mockKeys.rerollKey).toHaveBeenCalledWith({
      keyId: 'key_abc',
      expiration: 3_600_000,
    });
  });

  it('accepts custom expiration', async () => {
    mockKeys.rerollKey.mockResolvedValueOnce(mockRerollKeySuccess());

    await rotateApiKey('key_abc', 0);

    expect(mockKeys.rerollKey).toHaveBeenCalledWith({
      keyId: 'key_abc',
      expiration: 0,
    });
  });

  it('returns new key on success', async () => {
    mockKeys.rerollKey.mockResolvedValueOnce(mockRerollKeySuccess());

    const result = await rotateApiKey('key_abc');

    expect(result).toHaveProperty('key', 'ok_live_rotated456');
    expect(result).toHaveProperty('keyId', 'key_rotated');
  });

  it('throws on error', async () => {
    mockKeys.rerollKey.mockRejectedValueOnce(new Error('Reroll failed'));

    await expect(rotateApiKey('key_abc')).rejects.toThrow('Reroll failed');
  });
});

describe('revokeApiKey', () => {
  beforeEach(() => {
    mockKeys.deleteKey.mockReset();
  });

  it('calls deleteKey with keyId', async () => {
    mockKeys.deleteKey.mockResolvedValueOnce({
      meta: { requestId: 'req_delete' },
      data: {},
    });

    await revokeApiKey('key_abc');

    expect(mockKeys.deleteKey).toHaveBeenCalledWith({ keyId: 'key_abc' });
  });

  it('throws on error', async () => {
    mockKeys.deleteKey.mockRejectedValueOnce(new Error('Delete failed'));

    await expect(revokeApiKey('key_abc')).rejects.toThrow('Delete failed');
  });
});
