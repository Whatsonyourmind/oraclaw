import Link from "next/link";
import { PRICING_TIERS, FEATURE_COMPARISON } from "@/lib/pricing";

export const metadata = {
  title: "Pricing",
  description:
    "Simple, transparent pricing for decision intelligence. Free tier (25 calls/day), Starter $9/mo, Growth $49/mo, Scale $199/mo. All 19 algorithms included.",
  alternates: {
    canonical: "/pricing",
  },
};

function CheckIcon() {
  return (
    <svg
      className="w-4 h-4 text-claw-500 flex-shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg
      className="w-4 h-4 text-gray-700 flex-shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

export default function PricingPage() {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://oraclaw-api.onrender.com";

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <div className="text-center mb-16">
        <h1 className="text-3xl md:text-5xl font-mono font-bold mb-4">
          Simple, transparent{" "}
          <span className="gradient-text">pricing</span>
        </h1>
        <p className="text-gray-400 max-w-2xl mx-auto text-lg">
          Start free. Scale as you grow. All plans include every algorithm,
          sub-25ms latency, and full API access.
        </p>
      </div>

      {/* Pricing Cards */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-20">
        {PRICING_TIERS.map((tier) => (
          <div
            key={tier.key}
            className={`relative flex flex-col p-6 rounded-lg border ${
              tier.highlighted
                ? "border-claw-500 bg-claw-500/5 glow-green"
                : tier.key === "pay_per_call"
                ? "border-ooda-orient/50 bg-ooda-orient/5"
                : "border-gray-800 bg-gray-900/50"
            } card-hover`}
          >
            {tier.badge && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className={`text-xs font-mono font-bold px-3 py-1 rounded-full ${
                  tier.key === "pay_per_call"
                    ? "bg-ooda-orient text-black"
                    : "bg-claw-500 text-black"
                }`}>
                  {tier.badge}
                </span>
              </div>
            )}

            <div className="mb-6">
              <h3 className="text-lg font-mono font-semibold text-white mb-1">
                {tier.name}
              </h3>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-mono font-bold text-white">
                  {tier.price}
                </span>
                {tier.priceNote && (
                  <span className="text-sm text-gray-500 font-mono">
                    {tier.priceNote}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-2">{tier.description}</p>
            </div>

            <div className="flex-1 mb-6">
              <div className="space-y-2">
                {tier.features.map((feature) => (
                  <div key={feature} className="flex items-start gap-2">
                    <CheckIcon />
                    <span className="text-xs text-gray-300">{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              {tier.key === "free" ? (
                <Link
                  href="/getting-started"
                  className="block w-full text-center px-4 py-2.5 bg-gray-800 text-white font-mono text-sm font-semibold rounded-lg hover:bg-gray-700 transition-colors"
                >
                  {tier.cta}
                </Link>
              ) : tier.key === "enterprise" ? (
                <a
                  href="mailto:luka.stanisljevic@gmail.com?subject=OraClaw%20Enterprise%20Inquiry"
                  className="block w-full text-center px-4 py-2.5 border border-gray-700 text-gray-300 font-mono text-sm font-semibold rounded-lg hover:border-claw-500/50 hover:text-claw-400 transition-colors"
                >
                  {tier.cta}
                </a>
              ) : (
                <a
                  href={`${API_URL}/api/billing/checkout?tier=${tier.key}`}
                  className={`block w-full text-center px-4 py-2.5 font-mono text-sm font-semibold rounded-lg transition-colors ${
                    tier.highlighted
                      ? "bg-claw-500 text-black hover:bg-claw-400"
                      : tier.key === "pay_per_call"
                      ? "bg-ooda-orient text-black hover:bg-ooda-orient/80"
                      : "bg-gray-800 text-white hover:bg-gray-700"
                  }`}
                >
                  {tier.cta}
                </a>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* USDC Pay-per-call Section */}
      <div className="mb-20">
        <div className="text-center p-8 rounded-lg border border-ooda-orient/30 bg-ooda-orient/5">
          <div className="flex items-center justify-center gap-2 mb-4">
            <svg className="w-6 h-6 text-ooda-orient" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h2 className="text-2xl font-mono font-bold text-white">
              x402 USDC Machine Payments
            </h2>
          </div>
          <p className="text-gray-400 max-w-2xl mx-auto mb-4">
            AI agents can pay per API call using USDC on Base via the x402 protocol.
            No subscription needed -- just include the payment header. Perfect for
            autonomous agents that need on-demand decision intelligence.
          </p>
          <div className="flex flex-wrap justify-center gap-4 text-sm font-mono">
            <div className="px-4 py-2 rounded border border-gray-700 bg-gray-900/50">
              <span className="text-gray-500">Protocol:</span>{" "}
              <span className="text-ooda-orient">x402</span>
            </div>
            <div className="px-4 py-2 rounded border border-gray-700 bg-gray-900/50">
              <span className="text-gray-500">Currency:</span>{" "}
              <span className="text-ooda-orient">USDC (Base)</span>
            </div>
            <div className="px-4 py-2 rounded border border-gray-700 bg-gray-900/50">
              <span className="text-gray-500">Cost:</span>{" "}
              <span className="text-ooda-orient">$0.01/call</span>
            </div>
            <div className="px-4 py-2 rounded border border-gray-700 bg-gray-900/50">
              <span className="text-gray-500">Wallet:</span>{" "}
              <span className="text-ooda-orient">0x077E...Cdde</span>
            </div>
          </div>
        </div>
      </div>

      {/* Feature Comparison Table */}
      <div className="mb-16">
        <h2 className="text-2xl font-mono font-bold text-center mb-8">
          Feature Comparison
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left font-mono text-gray-400 py-3 px-4 min-w-[200px]">
                  Feature
                </th>
                {[
                  { name: "Free", key: "free" },
                  { name: "Pay-per-call", key: "pay_per_call" },
                  { name: "Starter", key: "starter" },
                  { name: "Growth", key: "growth" },
                  { name: "Scale", key: "scale" },
                  { name: "Enterprise", key: "enterprise" },
                ].map(
                  (col) => (
                    <th
                      key={col.key}
                      className={`text-center font-mono py-3 px-3 min-w-[100px] ${
                        col.key === "growth"
                          ? "text-claw-400"
                          : col.key === "pay_per_call"
                          ? "text-ooda-orient"
                          : "text-gray-400"
                      }`}
                    >
                      {col.name}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {FEATURE_COMPARISON.map((section) => (
                <>
                  <tr key={section.category}>
                    <td
                      colSpan={7}
                      className="font-mono font-semibold text-white py-3 px-4 bg-gray-900/50 border-b border-gray-800"
                    >
                      {section.category}
                    </td>
                  </tr>
                  {section.features.map((feature) => (
                    <tr
                      key={feature.name}
                      className="border-b border-gray-800/50 hover:bg-gray-900/30"
                    >
                      <td className="text-gray-300 py-2.5 px-4 font-mono text-xs">
                        {feature.name}
                      </td>
                      {(
                        ["free", "pay_per_call", "starter", "growth", "scale", "enterprise"] as const
                      ).map((tier) => {
                        const value = (feature as any)[tier];
                        return (
                          <td
                            key={tier}
                            className="text-center py-2.5 px-3"
                          >
                            {typeof value === "boolean" ? (
                              value ? (
                                <span className="inline-flex justify-center">
                                  <CheckIcon />
                                </span>
                              ) : (
                                <span className="inline-flex justify-center">
                                  <XIcon />
                                </span>
                              )
                            ) : (
                              <span
                                className={`text-xs font-mono ${
                                  tier === "growth"
                                    ? "text-claw-400"
                                    : tier === "pay_per_call"
                                    ? "text-ooda-orient"
                                    : "text-gray-400"
                                }`}
                              >
                                {value}
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* FAQ */}
      <div className="max-w-3xl mx-auto">
        <h2 className="text-2xl font-mono font-bold text-center mb-8">
          Frequently Asked Questions
        </h2>
        <div className="space-y-6">
          {[
            {
              q: "Do I need an API key for the free tier?",
              a: "No. The free tier is rate-limited by IP address. Just call the API directly. No signup, no API key, no credit card.",
            },
            {
              q: "What happens if I exceed my rate limit?",
              a: "You'll receive a 429 Too Many Requests response with a Retry-After header. Upgrade your plan for higher limits, switch to pay-per-call metered billing, or use x402 USDC machine payments.",
            },
            {
              q: "Can I change plans anytime?",
              a: "Yes. Upgrades are prorated immediately. Downgrades take effect at the end of your billing cycle. You can manage your subscription in the dashboard.",
            },
            {
              q: "What are x402 USDC payments?",
              a: "x402 is a machine payment protocol. AI agents can pay $0.01 per API call using USDC on Base L2. No subscription needed -- include the payment header and the call is authorized instantly.",
            },
            {
              q: "What is pay-per-call billing?",
              a: "Pay-per-call is Stripe metered billing with no monthly subscription fee. You only pay $0.005 (half a cent) per API call, billed at the end of each month. Perfect if you want to avoid a monthly commitment but need more than the free tier.",
            },
            {
              q: "Is there a free trial for paid plans?",
              a: "The free tier is permanently free. Paid plans can be canceled anytime with no commitment. Pay-per-call has zero upfront cost -- you only pay for actual usage.",
            },
          ].map((faq) => (
            <div
              key={faq.q}
              className="p-5 rounded-lg border border-gray-800 bg-gray-900/50"
            >
              <h3 className="font-mono font-semibold text-white text-sm mb-2">
                {faq.q}
              </h3>
              <p className="text-xs text-gray-400 leading-relaxed">{faq.a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
