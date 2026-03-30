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
    callsPerMonth: '3,000',
    callsPerDay: '100',
    pricePerCall: '$0.00',
    description: 'Get started instantly. No credit card required.',
    features: [
      '100 API calls per day',
      'All 19 algorithms',
      'Sub-25ms response times',
      'Community support',
      'Rate limited by IP',
    ],
    cta: 'Start Free',
    highlighted: false,
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
      { name: 'Monthly API calls', free: '3,000', starter: '10,000', growth: '100,000', scale: '1,000,000', enterprise: 'Unlimited' },
      { name: 'Daily rate limit', free: '100', starter: '~333', growth: '~3,333', scale: '~33,333', enterprise: 'Unlimited' },
      { name: 'Algorithms available', free: '19', starter: '19', growth: '19', scale: '19', enterprise: '19+' },
      { name: 'Response time', free: '<25ms', starter: '<25ms', growth: '<25ms', scale: '<25ms', enterprise: '<25ms' },
    ],
  },
  {
    category: 'Authentication',
    features: [
      { name: 'IP-based access', free: true, starter: true, growth: true, scale: true, enterprise: true },
      { name: 'API key (Unkey)', free: false, starter: true, growth: true, scale: true, enterprise: true },
      { name: 'x402 USDC payments', free: false, starter: false, growth: true, scale: true, enterprise: true },
    ],
  },
  {
    category: 'Support',
    features: [
      { name: 'Documentation', free: true, starter: true, growth: true, scale: true, enterprise: true },
      { name: 'Community support', free: true, starter: true, growth: true, scale: true, enterprise: true },
      { name: 'Email support', free: false, starter: true, growth: true, scale: true, enterprise: true },
      { name: 'Priority support', free: false, starter: false, growth: true, scale: true, enterprise: true },
      { name: 'Dedicated support', free: false, starter: false, growth: false, scale: true, enterprise: true },
      { name: 'Slack channel', free: false, starter: false, growth: false, scale: false, enterprise: true },
    ],
  },
  {
    category: 'Features',
    features: [
      { name: 'Usage dashboard', free: false, starter: true, growth: true, scale: true, enterprise: true },
      { name: 'Usage analytics', free: false, starter: false, growth: true, scale: true, enterprise: true },
      { name: 'Webhook notifications', free: false, starter: false, growth: true, scale: true, enterprise: true },
      { name: 'SLA guarantee', free: false, starter: false, growth: false, scale: true, enterprise: true },
      { name: 'Custom algorithms', free: false, starter: false, growth: false, scale: false, enterprise: true },
    ],
  },
];
