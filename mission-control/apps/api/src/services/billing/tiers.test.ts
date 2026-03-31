/**
 * tiers.test.ts
 *
 * Tests for BILL-03a: Tier configuration correctness.
 * Verifies TIER_CONFIG is the single source of truth for all tier metadata.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('TIER_CONFIG', () => {
  const TIER_KEYS = ['free', 'pay_per_call', 'starter', 'growth', 'scale', 'enterprise'] as const;
  const REQUIRED_FIELDS = [
    'name',
    'stripePriceId',
    'dailyLimit',
    'monthlyCallsIncluded',
    'unitAmountDecimal',
    'description',
  ] as const;

  // We need to dynamically import so env mocks take effect
  let TIER_CONFIG: Record<string, any>;

  beforeEach(async () => {
    // Set env vars for paid tier Stripe price IDs
    process.env.STRIPE_PRICE_PAY_PER_CALL = 'price_pay_per_call_test';
    process.env.STRIPE_PRICE_STARTER = 'price_starter_test';
    process.env.STRIPE_PRICE_GROWTH = 'price_growth_test';
    process.env.STRIPE_PRICE_SCALE = 'price_scale_test';
    process.env.STRIPE_PRICE_ENTERPRISE = 'price_enterprise_test';

    // Clear module cache and re-import
    vi.resetModules();
    const mod = await import('./tiers');
    TIER_CONFIG = mod.TIER_CONFIG;
  });

  afterEach(() => {
    delete process.env.STRIPE_PRICE_PAY_PER_CALL;
    delete process.env.STRIPE_PRICE_STARTER;
    delete process.env.STRIPE_PRICE_GROWTH;
    delete process.env.STRIPE_PRICE_SCALE;
    delete process.env.STRIPE_PRICE_ENTERPRISE;
  });

  // BILL-03a: All 6 tiers exist
  it('exports all 6 tier keys: free, pay_per_call, starter, growth, scale, enterprise', () => {
    const keys = Object.keys(TIER_CONFIG);
    for (const tier of TIER_KEYS) {
      expect(keys).toContain(tier);
    }
    expect(keys).toHaveLength(6);
  });

  // BILL-03a: Each tier has required fields
  it.each(TIER_KEYS)('tier "%s" has all required fields', (tierKey) => {
    const tier = TIER_CONFIG[tierKey];
    for (const field of REQUIRED_FIELDS) {
      expect(tier).toHaveProperty(field);
    }
  });

  // BILL-03a3: Free tier specifics
  it('free tier has dailyLimit=25 and empty stripePriceId', () => {
    const free = TIER_CONFIG.free;
    expect(free.dailyLimit).toBe(25);
    expect(free.stripePriceId).toBe('');
    expect(free.monthlyCallsIncluded).toBe(750);
    expect(free.unitAmountDecimal).toBe('0');
  });

  // BILL-03a4: Pay-per-call tier specifics
  it('pay_per_call tier has dailyLimit=1000, monthlyCallsIncluded=0, unitAmountDecimal=0.5', () => {
    const payPerCall = TIER_CONFIG.pay_per_call;
    expect(payPerCall.dailyLimit).toBe(1000);
    expect(payPerCall.monthlyCallsIncluded).toBe(0);
    expect(payPerCall.unitAmountDecimal).toBe('0.5');
    expect(payPerCall.name).toBe('Pay-per-call');
  });

  it('pay_per_call tier reads stripePriceId from STRIPE_PRICE_PAY_PER_CALL env', () => {
    expect(TIER_CONFIG.pay_per_call.stripePriceId).toBe('price_pay_per_call_test');
  });

  // BILL-03a2: Paid tiers source stripePriceId from env vars
  it('starter tier reads stripePriceId from STRIPE_PRICE_STARTER env', () => {
    expect(TIER_CONFIG.starter.stripePriceId).toBe('price_starter_test');
  });

  it('growth tier reads stripePriceId from STRIPE_PRICE_GROWTH env', () => {
    expect(TIER_CONFIG.growth.stripePriceId).toBe('price_growth_test');
  });

  it('scale tier reads stripePriceId from STRIPE_PRICE_SCALE env', () => {
    expect(TIER_CONFIG.scale.stripePriceId).toBe('price_scale_test');
  });

  it('enterprise tier reads stripePriceId from STRIPE_PRICE_ENTERPRISE env', () => {
    expect(TIER_CONFIG.enterprise.stripePriceId).toBe('price_enterprise_test');
  });

  // BILL-03a2: Paid tier limits
  it('starter tier has dailyLimit=1667 and monthlyCallsIncluded=50000', () => {
    expect(TIER_CONFIG.starter.dailyLimit).toBe(1667);
    expect(TIER_CONFIG.starter.monthlyCallsIncluded).toBe(50000);
    expect(TIER_CONFIG.starter.unitAmountDecimal).toBe('0.198');
  });

  it('growth tier has dailyLimit=16667 and monthlyCallsIncluded=500000', () => {
    expect(TIER_CONFIG.growth.dailyLimit).toBe(16667);
    expect(TIER_CONFIG.growth.monthlyCallsIncluded).toBe(500000);
    expect(TIER_CONFIG.growth.unitAmountDecimal).toBe('0.0998');
  });

  it('scale tier has dailyLimit=166667 and monthlyCallsIncluded=5000000', () => {
    expect(TIER_CONFIG.scale.dailyLimit).toBe(166667);
    expect(TIER_CONFIG.scale.monthlyCallsIncluded).toBe(5000000);
    expect(TIER_CONFIG.scale.unitAmountDecimal).toBe('0.04998');
  });

  it('enterprise tier has dailyLimit=0 (unlimited) and monthlyCallsIncluded=0 (custom)', () => {
    expect(TIER_CONFIG.enterprise.dailyLimit).toBe(0);
    expect(TIER_CONFIG.enterprise.monthlyCallsIncluded).toBe(0);
    expect(TIER_CONFIG.enterprise.unitAmountDecimal).toBe('0');
  });
});
