/**
 * Shared Unkey SDK Mock Utility
 *
 * Provides a mock factory for the @unkey/api Unkey class and preset response
 * factories for verifyKey, createKey, rerollKey, deleteKey operations.
 * All mocks use vi.fn() for assertion support.
 *
 * The real SDK v2.3.2 returns { meta, data } on success and throws on errors.
 * These mocks replicate that behavior: success mocks resolve, error mocks throw.
 */

import { vi } from 'vitest';

// ── Preset Response Factories ───────────────────────────────

/**
 * Mock verifyKey success response with configurable overrides.
 * Returns the full { meta, data } shape matching SDK v2.3.2.
 */
export function mockVerifyValid(overrides?: {
  tier?: string;
  stripeCustomerId?: string;
  keyId?: string;
  remaining?: number;
  limit?: number;
  reset?: number;
}) {
  return {
    meta: { requestId: 'req_mock_valid' },
    data: {
      valid: true,
      code: 'VALID',
      keyId: overrides?.keyId ?? 'key_test',
      meta: {
        tier: overrides?.tier ?? 'starter',
        stripeCustomerId: overrides?.stripeCustomerId ?? 'cus_test',
      },
      ratelimits: [
        {
          name: 'api_calls',
          remaining: overrides?.remaining ?? 99,
          limit: overrides?.limit ?? 1667,
          reset: overrides?.reset ?? Date.now() + 86_400_000,
          exceeded: false,
          autoApply: true,
        },
      ],
    },
  };
}

/**
 * Mock verifyKey failure response for a given code (NOT_FOUND, DISABLED, EXPIRED, etc.)
 */
export function mockVerifyInvalid(code: string) {
  return {
    meta: { requestId: 'req_mock_invalid' },
    data: {
      valid: false,
      code,
      ratelimits: [],
    },
  };
}

/**
 * Mock verifyKey response for rate-limited key.
 */
export function mockVerifyRateLimited() {
  return {
    meta: { requestId: 'req_mock_ratelimited' },
    data: {
      valid: false,
      code: 'RATE_LIMITED',
      ratelimits: [
        {
          name: 'api_calls',
          remaining: 0,
          limit: 1667,
          reset: Date.now() + 3_600_000,
          exceeded: true,
          autoApply: true,
        },
      ],
    },
  };
}

/**
 * Mock SDK error -- the real SDK throws on network/API errors.
 * Use this to simulate what happens when the SDK call rejects.
 */
export function mockVerifySdkError() {
  return new Error('Network error: INTERNAL_SERVER_ERROR');
}

/**
 * Mock createKey success response.
 */
export function mockCreateKeySuccess() {
  return {
    meta: { requestId: 'req_mock_create' },
    data: {
      key: 'ok_live_test123',
      keyId: 'key_new',
    },
  };
}

/**
 * Mock rerollKey success response.
 */
export function mockRerollKeySuccess() {
  return {
    meta: { requestId: 'req_mock_reroll' },
    data: {
      key: 'ok_live_rotated456',
      keyId: 'key_rotated',
    },
  };
}

// ── Mock Unkey Client Factory ───────────────────────────────

/**
 * Creates a mock object mimicking the Unkey SDK class.
 * The mock has a `keys` property with vi.fn() mocks for all key operations.
 *
 * Usage:
 *   const mockUnkey = createMockUnkey();
 *   mockUnkey.keys.verifyKey.mockResolvedValueOnce(mockVerifyValid());
 *   const middleware = createAuthMiddleware(mockUnkey as any);
 */
export function createMockUnkey() {
  return {
    keys: {
      verifyKey: vi.fn(),
      createKey: vi.fn(),
      rerollKey: vi.fn(),
      deleteKey: vi.fn(),
    },
  };
}
