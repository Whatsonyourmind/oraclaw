/**
 * pricing.ts
 *
 * Shared pricing tier configuration for the web dashboard.
 * Maps to the backend's TIER_CONFIG and Stripe product catalog.
 */

export interface PricingTier {
  key: string;
  name: string;
  price: string;
  priceNote: string;
  callsPerMonth: string;
  callsPerDay: string;
  pricePerCall: string;
  description: string;
  features: string[];
  cta: string;
  highlighted: boolean;
  badge?: string;
}

export const PRICING_TIERS: PricingTier[] = [
  {
    key: 'free',
    name: 'Free',
    price: '$0',
    priceNote: 'forever',
    callsPerMonth: '750',
    callsPerDay: '25',
    pricePerCall: '$0.00',
    description: 'Get started instantly. No credit card required.',
    features: [
      '25 API calls per day',
      'All 19 algorithms',
      'Sub-25ms response times',
      'Community support',
      'Rate limited by IP',
    ],
    cta: 'Start Free',
    highlighted: false,
  },
  {
    key: 'pay_per_call',
    name: 'Pay-per-call',
    price: '$0.005',
    priceNote: '/call',
    callsPerMonth: 'Unlimited',
    callsPerDay: '1,000',
    pricePerCall: '$0.005',
    description: 'No monthly commitment. Pay only for what you use. Billed monthly via Stripe.',
    features: [
      'No monthly subscription',
      '$0.005 per API call (half a cent)',
      'All 19 algorithms',
      'Sub-25ms response times',
      'API key authentication',
      'Usage dashboard',
      'Billed monthly via Stripe',
    ],
    cta: 'Start Metered',
    highlighted: false,
    badge: 'No Commitment',
  },
  {
    key: 'starter',
    name: 'Starter',
    price: '$9',
    priceNote: '/month',
    callsPerMonth: '10,000',
    callsPerDay: '~333',
    pricePerCall: '$0.0009',
    description: 'For individual developers and side projects.',
    features: [
      '10,000 API calls per month',
      'All 19 algorithms',
      'Sub-25ms response times',
      'API key authentication',
      'Email support',
      'Usage dashboard',
    ],
    cta: 'Get Started',
    highlighted: false,
  },
  {
    key: 'growth',
    name: 'Growth',
    price: '$49',
    priceNote: '/month',
    callsPerMonth: '100,000',
    callsPerDay: '~3,333',
    pricePerCall: '$0.0005',
    description: 'For growing teams with production workloads.',
    features: [
      '100,000 API calls per month',
      'All 19 algorithms',
      'Sub-25ms response times',
      'API key authentication',
      'Priority support',
      'Usage analytics & webhooks',
      'Team management',
    ],
    cta: 'Subscribe',
    highlighted: true,
    badge: 'Most Popular',
  },
  {
    key: 'scale',
    name: 'Scale',
    price: '$199',
    priceNote: '/month',
    callsPerMonth: '1,000,000',
    callsPerDay: '~33,333',
    pricePerCall: '$0.0002',
    description: 'For high-volume applications and enterprise workloads.',
    features: [
      '1,000,000 API calls per month',
      'All 19 algorithms',
      'Sub-25ms response times',
      'API key authentication',
      'Dedicated support',
      'Advanced analytics',
      'Custom webhooks & SLA',
      'Priority queue',
    ],
    cta: 'Subscribe',
    highlighted: false,
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    price: 'Custom',
    priceNote: '',
    callsPerMonth: 'Unlimited',
    callsPerDay: 'Unlimited',
    pricePerCall: 'Volume discount',
    description: 'Custom limits, dedicated support, and SLA.',
    features: [
      'Unlimited API calls',
      'All 19 algorithms',
      'Sub-25ms response times',
      'Dedicated infrastructure',
      'White-glove onboarding',
      'Enterprise SLA (99.9%)',
      'Priority support + Slack',
      'Custom algorithm development',
    ],
    cta: 'Contact Sales',
    highlighted: false,
  },
];

export const FEATURE_COMPARISON = [
  {
    category: 'API Access',
    features: [
      { name: 'Monthly API calls', free: '750', pay_per_call: 'Unlimited', starter: '10,000', growth: '100,000', scale: '1,000,000', enterprise: 'Unlimited' },
      { name: 'Daily rate limit', free: '25', pay_per_call: '1,000', starter: '~333', growth: '~3,333', scale: '~33,333', enterprise: 'Unlimited' },
      { name: 'Algorithms available', free: '19', pay_per_call: '19', starter: '19', growth: '19', scale: '19', enterprise: '19+' },
      { name: 'Response time', free: '<25ms', pay_per_call: '<25ms', starter: '<25ms', growth: '<25ms', scale: '<25ms', enterprise: '<25ms' },
    ],
  },
  {
    category: 'Billing',
    features: [
      { name: 'Monthly subscription', free: false, pay_per_call: false, starter: true, growth: true, scale: true, enterprise: true },
      { name: 'Pay-per-call metering', free: false, pay_per_call: true, starter: false, growth: false, scale: false, enterprise: false },
      { name: 'x402 USDC payments', free: false, pay_per_call: false, starter: false, growth: true, scale: true, enterprise: true },
    ],
  },
  {
    category: 'Authentication',
    features: [
      { name: 'IP-based access', free: true, pay_per_call: true, starter: true, growth: true, scale: true, enterprise: true },
      { name: 'API key (Unkey)', free: false, pay_per_call: true, starter: true, growth: true, scale: true, enterprise: true },
    ],
  },
  {
    category: 'Support',
    features: [
      { name: 'Documentation', free: true, pay_per_call: true, starter: true, growth: true, scale: true, enterprise: true },
      { name: 'Community support', free: true, pay_per_call: true, starter: true, growth: true, scale: true, enterprise: true },
      { name: 'Email support', free: false, pay_per_call: true, starter: true, growth: true, scale: true, enterprise: true },
      { name: 'Priority support', free: false, pay_per_call: false, starter: false, growth: true, scale: true, enterprise: true },
      { name: 'Dedicated support', free: false, pay_per_call: false, starter: false, growth: false, scale: true, enterprise: true },
      { name: 'Slack channel', free: false, pay_per_call: false, starter: false, growth: false, scale: false, enterprise: true },
    ],
  },
  {
    category: 'Features',
    features: [
      { name: 'Usage dashboard', free: false, pay_per_call: true, starter: true, growth: true, scale: true, enterprise: true },
      { name: 'Usage analytics', free: false, pay_per_call: false, starter: false, growth: true, scale: true, enterprise: true },
      { name: 'Webhook notifications', free: false, pay_per_call: false, starter: false, growth: true, scale: true, enterprise: true },
      { name: 'SLA guarantee', free: false, pay_per_call: false, starter: false, growth: false, scale: true, enterprise: true },
      { name: 'Custom algorithms', free: false, pay_per_call: false, starter: false, growth: false, scale: false, enterprise: true },
    ],
  },
];
