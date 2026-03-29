/**
 * portal.test.ts
 *
 * Tests for POST /api/v1/billing/portal-session (BILL-05).
 * Covers:
 *   BILL-05a: Valid stripeCustomerId -> 200 with portal { url }
 *   BILL-05b: No stripeCustomerId -> 403 RFC 9457
 *   BILL-05c: Verifies billingPortal.sessions.create called with correct params
 */

import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';

// ── Mocks (hoisted) ────────────────────────────────────────

const { mockPortalCreate } = vi.hoisted(() => {
  const mockPortalCreate = vi.fn().mockResolvedValue({
    url: 'https://billing.stripe.com/session/test_portal_xxx',
  });
  return { mockPortalCreate };
});

vi.mock('../../services/billing/stripe', () => ({
  stripe: {
    billingPortal: {
      sessions: {
        create: mockPortalCreate,
      },
    },
  },
}));

// ── Test Setup ─────────────────────────────────────────────

import { portalRoutes } from './portal';

describe('POST /portal-session (BILL-05)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();

    // Simulate Unkey auth middleware setting request properties
    app.addHook('preHandler', async (request) => {
      const customerId = request.headers['x-test-stripe-customer-id'] as string | undefined;
      request.stripeCustomerId = customerId;
      request.tier = customerId ? 'starter' : 'free';
      request.billingPath = customerId ? 'stripe' : 'free';
    });

    app.register(portalRoutes);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // BILL-05a: Valid stripeCustomerId -> 200 with portal URL
  it('returns portal session URL for paying customer', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/portal-session',
      headers: {
        'x-test-stripe-customer-id': 'cus_test_456',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toHaveProperty('url');
    expect(body.url).toBe('https://billing.stripe.com/session/test_portal_xxx');
  });

  // BILL-05b: No stripeCustomerId -> 403 with RFC 9457
  it('returns 403 for free-tier user without stripeCustomerId', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/portal-session',
    });

    expect(response.statusCode).toBe(403);
    const body = response.json();
    expect(body).toHaveProperty('type');
    expect(body).toHaveProperty('title');
    expect(body).toHaveProperty('status', 403);
    expect(body).toHaveProperty('detail');
  });

  // BILL-05c: Verify billingPortal.sessions.create called with correct params
  it('calls billingPortal.sessions.create with customer and return_url', async () => {
    await app.inject({
      method: 'POST',
      url: '/portal-session',
      headers: {
        'x-test-stripe-customer-id': 'cus_test_789',
      },
    });

    expect(mockPortalCreate).toHaveBeenCalledTimes(1);
    expect(mockPortalCreate).toHaveBeenCalledWith({
      customer: 'cus_test_789',
      return_url: expect.any(String),
    });
  });
});
