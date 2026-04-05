/**
 * tiers.ts
 *
 * Single source of truth for all tier metadata and Stripe price IDs.
 * Used by rate limiting, subscription routes, and billing portal.
 *
 * BILL-03: Tier configuration with Stripe price IDs, daily limits,
 * monthly call inclusions, and per-call costs.
 */

export interface TierConfig {
  /** Display name for the tier */
  name: string;
  /** Stripe Price ID (empty string for free tier) */
  stripePriceId: string;
  /** Maximum API calls per 24-hour window (0 = unlimited) */
  dailyLimit: number;
  /** Calls included per billing month (0 = unlimited/custom) */
  monthlyCallsIncluded: number;
  /** Cost per additional call beyond included, in decimal string (Stripe format) */
  unitAmountDecimal: string;
  /** Human-readable tier description */
  description: string;
}

/**
 * TIER_CONFIG: canonical tier definitions.
 *
 * Paid tier Stripe price IDs are sourced from environment variables
 * so the same code works across test, staging, and production.
 */
export const TIER_CONFIG: Record<string, TierConfig> = {
  free: {
    name: 'Free',
    stripePriceId: '',
    dailyLimit: 25,
    monthlyCallsIncluded: 750,
    unitAmountDecimal: '0',
    description: 'Get started with 25 API calls per day. No credit card required.',
  },
  pay_per_call: {
    name: 'Pay-per-call',
    stripePriceId: process.env.STRIPE_PRICE_PAY_PER_CALL || '',
    dailyLimit: 1000,
    monthlyCallsIncluded: 0,
    unitAmountDecimal: '0.5',
    description: 'No monthly commitment. Pay $0.005 per API call. Billed monthly via Stripe.',
  },
  starter: {
    name: 'Starter',
    stripePriceId: process.env.STRIPE_PRICE_STARTER || '',
    dailyLimit: 1667,
    monthlyCallsIncluded: 50_000,
    unitAmountDecimal: '0.198',
    description: 'For individual developers and small projects.',
  },
  growth: {
    name: 'Growth',
    stripePriceId: process.env.STRIPE_PRICE_GROWTH || '',
    dailyLimit: 16_667,
    monthlyCallsIncluded: 500_000,
    unitAmountDecimal: '0.0998',
    description: 'For growing teams with production workloads.',
  },
  scale: {
    name: 'Scale',
    stripePriceId: process.env.STRIPE_PRICE_SCALE || '',
    dailyLimit: 166_667,
    monthlyCallsIncluded: 5_000_000,
    unitAmountDecimal: '0.04998',
    description: 'For high-volume applications and enterprise workloads.',
  },
  enterprise: {
    name: 'Enterprise',
    stripePriceId: process.env.STRIPE_PRICE_ENTERPRISE || '',
    dailyLimit: 0,
    monthlyCallsIncluded: 0,
    unitAmountDecimal: '0',
    description: 'Custom limits, dedicated support, and SLA. Contact sales.',
  },
};

/**
 * Premium tools require an API key (any paid tier or pay_per_call).
 * Free tier (unauthenticated IP-based) gets 403 on these endpoints.
 */
export const PREMIUM_ENDPOINTS = new Set([
  '/api/v1/solve/constraints',    // LP/MIP/QP (HiGHS) — unique as MCP
  '/api/v1/analyze/graph',        // PageRank/Louvain — unique as MCP
  '/api/v1/optimize/cmaes',       // CMA-ES continuous optimization
  '/api/v1/analyze/risk',         // VaR/CVaR portfolio risk
]);

export const FREE_TOOLS = [
  'optimize_bandit', 'optimize_contextual', 'solve_schedule',
  'score_convergence', 'predict_forecast', 'detect_anomaly',
  'plan_pathfind', 'simulate_montecarlo',
];

export const PREMIUM_TOOLS = [
  'solve_constraints', 'analyze_graph', 'optimize_cmaes', 'analyze_risk',
];
