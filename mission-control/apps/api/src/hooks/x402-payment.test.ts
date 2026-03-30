/**
 * x402-payment.test.ts
 *
 * TDD tests for x402 payment preHandler hook and settlement onResponse hook.
 * Covers BILL-04a through BILL-04h:
 *   a) Valid PAYMENT-SIGNATURE header sets billingPath='x402' and tier='x402'
 *   b) No payment header passes through (returns undefined)
 *   c) Invalid payment returns 402 with RFC 9457 problem details
 *   d) 402 response includes payment requirements
 *   e) Settlement fires on 2xx
 *   f) Settlement skips on 4xx
 *   g) Settlement skips when no x402Payment
 */

import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { createMockX402 } from '../test-utils/mock-x402';
import { createX402PaymentHook } from './x402-payment';
import { createX402SettleHook } from './x402-settle';

// ── Helpers ─────────────────────────────────────────────────

/** Encode a payment payload as base64 JSON (simulates client header) */
function encodePaymentHeader(payload: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

// ── Payment Hook Tests ──────────────────────────────────────

describe('createX402PaymentHook', () => {
  let app: FastifyInstance;
  let mock: ReturnType<typeof createMockX402>;

  beforeAll(async () => {
    mock = createMockX402();
    app = Fastify({ logger: false });

    const paymentHook = createX402PaymentHook(
      mock.server,
      '0x077Etest',
      '$0.001',
      'eip155:8453',
    );

    app.addHook('preHandler', paymentHook);

    // Test route that returns request context set by hook
    app.get('/test', async (request) => {
      return {
        tier: request.tier,
        billingPath: request.billingPath,
        x402Payment: request.x402Payment,
      };
    });

    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    mock.verifyPayment.mockReset().mockResolvedValue({ isValid: true });
    mock.settlePayment.mockReset().mockResolvedValue({ success: true, transaction: '0xabc123', network: 'eip155:8453' });
    mock.buildPaymentRequirements.mockReset().mockResolvedValue([{ scheme: 'exact', network: 'eip155:8453', amount: '1000', asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', payTo: '0x077Etest', maxTimeoutSeconds: 300, extra: {} }]);
    mock.findMatchingRequirements.mockReset().mockReturnValue({ scheme: 'exact', network: 'eip155:8453', amount: '1000' });
  });

  // BILL-04a: valid PAYMENT-SIGNATURE header sets billingPath='x402' and tier='x402'
  it('valid payment sets billingPath to x402 and tier to x402', async () => {
    const payload = { x402Version: 2, payload: { sig: '0xtest' } };
    const response = await app.inject({
      method: 'GET',
      url: '/test',
      headers: { 'payment-signature': encodePaymentHeader(payload) },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.billingPath).toBe('x402');
    expect(body.tier).toBe('x402');
    expect(body.x402Payment).toBeDefined();
  });

  // BILL-04b: no payment header passes through (does not set billingPath)
  it('no payment header passes through without error', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/test',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    // billingPath should NOT be 'x402' (undefined or whatever default is)
    expect(body.billingPath).not.toBe('x402');
    expect(mock.verifyPayment).not.toHaveBeenCalled();
  });

  // BILL-04c: invalid payment returns 402 with problem details
  it('invalid payment returns 402 with problem details', async () => {
    mock.verifyPayment.mockResolvedValueOnce({ isValid: false, invalidReason: 'bad signature' });

    const payload = { x402Version: 2, payload: { sig: '0xbad' } };
    const response = await app.inject({
      method: 'GET',
      url: '/test',
      headers: { 'payment-signature': encodePaymentHeader(payload) },
    });

    expect(response.statusCode).toBe(402);
    const body = JSON.parse(response.payload);
    expect(body.type).toBe('https://oraclaw.dev/errors/payment-required');
    expect(response.headers['content-type']).toContain('application/problem+json');
  });

  // BILL-04d: 402 response includes payment requirements
  it('402 response includes payment requirements', async () => {
    mock.verifyPayment.mockResolvedValueOnce({ isValid: false, invalidReason: 'insufficient' });

    const payload = { x402Version: 2, payload: { sig: '0xbad' } };
    const response = await app.inject({
      method: 'GET',
      url: '/test',
      headers: { 'payment-signature': encodePaymentHeader(payload) },
    });

    expect(response.statusCode).toBe(402);
    const body = JSON.parse(response.payload);
    expect(body.paymentRequirements).toBeDefined();
    expect(Array.isArray(body.paymentRequirements)).toBe(true);
  });

  // BILL-04g (partial): no matching requirements returns 402
  it('no matching requirements returns 402 with payment requirements', async () => {
    mock.findMatchingRequirements.mockReturnValueOnce(null);

    const payload = { x402Version: 2, payload: { sig: '0xwrong' } };
    const response = await app.inject({
      method: 'GET',
      url: '/test',
      headers: { 'payment-signature': encodePaymentHeader(payload) },
    });

    expect(response.statusCode).toBe(402);
    const body = JSON.parse(response.payload);
    expect(body.type).toBe('https://oraclaw.dev/errors/payment-required');
    expect(body.paymentRequirements).toBeDefined();
  });
});

// ── Settlement Hook Tests ───────────────────────────────────

describe('createX402SettleHook', () => {
  let mock: ReturnType<typeof createMockX402>;
  let settleHook: ReturnType<typeof createX402SettleHook>;

  beforeEach(() => {
    mock = createMockX402();
    settleHook = createX402SettleHook(mock.server);
  });

  // Helper to create mock request/reply objects
  function makeRequest(overrides: Record<string, unknown> = {}) {
    return {
      billingPath: 'x402' as const,
      x402Payment: {
        paymentPayload: { x402Version: 2, payload: { sig: '0xtest' } },
        requirements: { scheme: 'exact', network: 'eip155:8453', amount: '1000' },
      },
      log: { info: vi.fn(), error: vi.fn() },
      ...overrides,
    } as any;
  }

  function makeReply(overrides: Record<string, unknown> = {}) {
    return {
      statusCode: 200,
      ...overrides,
    } as any;
  }

  // BILL-04e: settlement fires on 2xx
  it('settlement fires on 2xx response', async () => {
    const request = makeRequest();
    const reply = makeReply();

    await settleHook(request, reply);
    await new Promise((r) => setTimeout(r, 10));

    expect(mock.settlePayment).toHaveBeenCalledTimes(1);
    expect(mock.settlePayment).toHaveBeenCalledWith(
      request.x402Payment.paymentPayload,
      request.x402Payment.requirements,
    );
  });

  // BILL-04f: settlement skips on 4xx
  it('settlement skips on 4xx response', async () => {
    const request = makeRequest();
    const reply = makeReply({ statusCode: 400 });

    await settleHook(request, reply);
    await new Promise((r) => setTimeout(r, 10));

    expect(mock.settlePayment).not.toHaveBeenCalled();
  });

  // BILL-04h: settlement skips when no x402Payment
  it('settlement skips when no x402Payment on request', async () => {
    const request = makeRequest({ billingPath: 'stripe', x402Payment: undefined });
    const reply = makeReply();

    await settleHook(request, reply);
    await new Promise((r) => setTimeout(r, 10));

    expect(mock.settlePayment).not.toHaveBeenCalled();
  });
});
