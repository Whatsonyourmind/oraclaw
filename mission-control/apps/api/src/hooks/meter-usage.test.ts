/**
 * meter-usage.test.ts
 *
 * TDD RED phase: Tests for the Stripe Billing Meter onResponse hook.
 * Covers BILL-01a through BILL-01e:
 *   a) Calls meterEvents.create for authenticated stripe requests (200)
 *   b) Skips free tier (billingPath='free')
 *   c) Skips when no stripeCustomerId
 *   d) Skips for 4xx and 5xx status codes
 *   e) Catches Stripe API errors (fire-and-forget)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockStripe } from '../test-utils/mock-stripe';
import { createMeterUsageHook } from './meter-usage';

// ── Helpers ─────────────────────────────────────────────────

function makeRequest(overrides: Record<string, unknown> = {}) {
  return {
    billingPath: 'stripe' as const,
    stripeCustomerId: 'cus_test123',
    id: 'req-uuid-1',
    log: { error: vi.fn() },
    ...overrides,
  } as any;
}

function makeReply(overrides: Record<string, unknown> = {}) {
  return {
    statusCode: 200,
    ...overrides,
  } as any;
}

// ── Tests ───────────────────────────────────────────────────

describe('createMeterUsageHook', () => {
  let meterEventsCreate: ReturnType<typeof vi.fn>;
  let hook: ReturnType<typeof createMeterUsageHook>;

  beforeEach(() => {
    const mock = createMockStripe();
    meterEventsCreate = mock.meterEventsCreate;
    hook = createMeterUsageHook(mock.client, 'api_calls');
  });

  // BILL-01a: authenticated stripe request with 200 -> meter event created
  it('emits a meter event for authenticated stripe requests with 2xx status', async () => {
    const request = makeRequest();
    const reply = makeReply();

    await hook(request, reply);

    // Allow fire-and-forget promise to resolve
    await new Promise((r) => setTimeout(r, 10));

    expect(meterEventsCreate).toHaveBeenCalledTimes(1);
  });

  // BILL-01d: correct event_name, stripe_customer_id, value, identifier
  it('sends correct event_name, stripe_customer_id, value, and identifier', async () => {
    const request = makeRequest({ id: 'req-abc-42' });
    const reply = makeReply();

    await hook(request, reply);
    await new Promise((r) => setTimeout(r, 10));

    expect(meterEventsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        event_name: 'api_calls',
        payload: {
          stripe_customer_id: 'cus_test123',
          value: '1',
        },
        identifier: expect.stringContaining('req-abc-42'),
      }),
    );
  });

  // BILL-01b: free tier (billingPath='free') -> NOT metered
  it('does NOT meter free tier requests (billingPath=free)', async () => {
    const request = makeRequest({ billingPath: 'free' });
    const reply = makeReply();

    await hook(request, reply);
    await new Promise((r) => setTimeout(r, 10));

    expect(meterEventsCreate).not.toHaveBeenCalled();
  });

  // BILL-01b: no stripeCustomerId -> NOT metered
  it('does NOT meter requests without stripeCustomerId', async () => {
    const request = makeRequest({ stripeCustomerId: undefined });
    const reply = makeReply();

    await hook(request, reply);
    await new Promise((r) => setTimeout(r, 10));

    expect(meterEventsCreate).not.toHaveBeenCalled();
  });

  // BILL-01c: 4xx status -> NOT metered
  it('does NOT meter requests with 4xx status codes', async () => {
    const request = makeRequest();
    const reply = makeReply({ statusCode: 404 });

    await hook(request, reply);
    await new Promise((r) => setTimeout(r, 10));

    expect(meterEventsCreate).not.toHaveBeenCalled();
  });

  // BILL-01c: 5xx status -> NOT metered
  it('does NOT meter requests with 5xx status codes', async () => {
    const request = makeRequest();
    const reply = makeReply({ statusCode: 500 });

    await hook(request, reply);
    await new Promise((r) => setTimeout(r, 10));

    expect(meterEventsCreate).not.toHaveBeenCalled();
  });

  // BILL-01e: Stripe API error -> does not throw, logs error
  it('catches Stripe API errors and logs them without throwing', async () => {
    const stripeError = new Error('Stripe rate limit exceeded');
    meterEventsCreate.mockRejectedValueOnce(stripeError);

    const request = makeRequest();
    const reply = makeReply();

    // Must NOT throw
    await hook(request, reply);
    await new Promise((r) => setTimeout(r, 10));

    expect(request.log.error).toHaveBeenCalledWith(
      expect.objectContaining({ err: stripeError }),
      expect.stringContaining('meter event failed'),
    );
  });
});
