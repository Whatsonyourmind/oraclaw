import Link from "next/link";
import { PRICING_TIERS } from "@/lib/pricing";

const stats = [
  { value: "19", label: "Algorithms" },
  { value: "<25ms", label: "Avg Latency" },
  { value: "1,072", label: "Tests Passing" },
  { value: "15", label: "npm Packages" },
];

const features = [
  {
    title: "Pure Algorithms, No LLM Cost",
    description:
      "Every endpoint runs a deterministic ML algorithm. No GPU required, no token billing, no model drift. You get the same result every time for the same input.",
    icon: "cpu",
  },
  {
    title: "Dual Billing Paths",
    description:
      "Pay with Stripe API keys for traditional metered billing, or use x402 USDC machine payments for autonomous AI agents. Free tier included (100 calls/day).",
    icon: "wallet",
  },
  {
    title: "15 SDK Packages on npm",
    description:
      "Install @oraclaw/bandit, @oraclaw/solver, @oraclaw/simulate, and 12 more. Each SDK is a thin TypeScript client with full type safety.",
    icon: "package",
  },
  {
    title: "MCP Server for AI Agents",
    description:
      "@oraclaw/mcp-server exposes 12 tools for Claude, GPT, and other AI agents to call decision algorithms directly via the Model Context Protocol.",
    icon: "bot",
  },
];

const socialProof = [
  { metric: "945+", label: "Tests Passing", detail: "24 test suites, zero flaky" },
  { metric: "19", label: "ML Algorithms", detail: "2 SOTA, 11 prod-grade" },
  { metric: "<1ms", label: "Fastest Response", detail: "14/18 algos under 1ms" },
  { metric: "6e-14", label: "CMA-ES Accuracy", detail: "Rosenbrock benchmark" },
  { metric: "15", label: "npm Packages", detail: "Published and ready" },
  { metric: "12", label: "MCP Tools", detail: "For AI agent integration" },
];

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

export default function HomePage() {
  const displayTiers = PRICING_TIERS.filter((t) => t.key !== "enterprise");

  return (
    <div>
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-claw-500/5 to-transparent" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 md:py-32 relative">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-4xl md:text-6xl font-bold font-mono tracking-tight mb-6">
              Decision Intelligence{" "}
              <span className="gradient-text">as an API</span>
            </h1>
            <p className="text-lg md:text-xl text-gray-400 mb-8 max-w-2xl mx-auto">
              19 production-grade ML algorithms for optimization, simulation,
              prediction, and planning. Sub-25ms response times. Pay per call.
              No ML expertise required.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/pricing"
                className="px-8 py-3.5 bg-claw-500 text-black font-mono font-semibold rounded-lg hover:bg-claw-400 transition-colors text-lg"
              >
                Get API Key
              </Link>
              <Link
                href="/try/bandit"
                className="px-8 py-3.5 border border-gray-700 text-gray-300 font-mono rounded-lg hover:border-claw-500/50 hover:text-claw-400 transition-colors text-lg"
              >
                Try Free
              </Link>
            </div>
            <p className="text-xs text-gray-600 mt-4 font-mono">
              Free tier: 100 calls/day. No credit card. No API key required.
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-16 max-w-2xl mx-auto">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="text-center p-4 rounded-lg border border-gray-800 bg-gray-900/50"
              >
                <div className="text-2xl md:text-3xl font-mono font-bold text-claw-400">
                  {stat.value}
                </div>
                <div className="text-xs text-gray-500 mt-1 font-mono">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="border-y border-gray-800 bg-gray-900/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <h2 className="text-sm font-mono text-gray-500 text-center mb-8 uppercase tracking-wider">
            Battle-Tested in Production
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {socialProof.map((item) => (
              <div key={item.label} className="text-center">
                <div className="text-xl md:text-2xl font-mono font-bold text-claw-400">
                  {item.metric}
                </div>
                <div className="text-xs text-white font-mono mt-1">
                  {item.label}
                </div>
                <div className="text-[10px] text-gray-600 font-mono mt-0.5">
                  {item.detail}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Code Example */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-sm font-mono text-gray-500 mb-4 text-center">
            One API call. Instant result.
          </h2>
          <div className="rounded-lg border border-gray-800 bg-gray-900 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-800 bg-gray-900/80">
              <div className="w-3 h-3 rounded-full bg-red-500/60" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
              <div className="w-3 h-3 rounded-full bg-green-500/60" />
              <span className="text-xs text-gray-500 ml-2 font-mono">
                terminal
              </span>
            </div>
            <pre className="p-4 text-sm font-mono overflow-x-auto">
              <code>
                <span className="text-gray-500">$ </span>
                <span className="text-claw-400">curl</span>
                <span className="text-gray-300">
                  {
                    " -X POST https://oraclaw-api.onrender.com/api/v1/optimize/bandit \\"
                  }
                </span>
                {"\n"}
                <span className="text-gray-300">
                  {"  -H 'Content-Type: application/json' \\"}
                </span>
                {"\n"}
                <span className="text-gray-300">{"  -d '{"}</span>
                {"\n"}
                <span className="text-ooda-orient">
                  {'    "arms": ['}
                </span>
                {"\n"}
                <span className="text-ooda-orient">
                  {
                    '      {"id": "A", "name": "Option A", "pulls": 10, "totalReward": 7},'
                  }
                </span>
                {"\n"}
                <span className="text-ooda-orient">
                  {
                    '      {"id": "B", "name": "Option B", "pulls": 10, "totalReward": 5},'
                  }
                </span>
                {"\n"}
                <span className="text-ooda-orient">
                  {
                    '      {"id": "C", "name": "Option C", "pulls": 2, "totalReward": 1.8}'
                  }
                </span>
                {"\n"}
                <span className="text-ooda-orient">{"    ],"}</span>
                {"\n"}
                <span className="text-ooda-orient">
                  {'    "algorithm": "ucb1"'}
                </span>
                {"\n"}
                <span className="text-gray-300">{"  }'"}</span>
                {"\n\n"}
                <span className="text-gray-500">
                  {"// Response (<1ms):"}
                </span>
                {"\n"}
                <span className="text-ooda-decide">{`{
  "selected": { "id": "C", "name": "Option C" },
  "score": 1.876,
  "algorithm": "ucb1",
  "exploitation": 0.9,
  "exploration": 0.976,
  "regret": 0.1
}`}</span>
              </code>
            </pre>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-mono font-bold mb-3">
            Why OraClaw?
          </h2>
          <p className="text-gray-400 max-w-xl mx-auto">
            Production-ready decision intelligence without the complexity.
          </p>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="p-6 rounded-lg border border-gray-800 bg-gray-900/50 card-hover"
            >
              <h3 className="text-lg font-mono font-semibold text-white mb-2">
                {feature.title}
              </h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing Preview */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-mono font-bold mb-3">
            Simple, transparent{" "}
            <span className="gradient-text">pricing</span>
          </h2>
          <p className="text-gray-400 max-w-xl mx-auto">
            Start free. Scale as you grow. All plans include every algorithm.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {displayTiers.map((tier) => (
            <div
              key={tier.key}
              className={`relative flex flex-col p-6 rounded-lg border ${
                tier.highlighted
                  ? "border-claw-500 bg-claw-500/5 glow-green"
                  : "border-gray-800 bg-gray-900/50"
              } card-hover`}
            >
              {tier.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-claw-500 text-black text-xs font-mono font-bold px-3 py-1 rounded-full">
                    {tier.badge}
                  </span>
                </div>
              )}

              <h3 className="text-lg font-mono font-semibold text-white mb-1">
                {tier.name}
              </h3>
              <div className="flex items-baseline gap-1 mb-4">
                <span className="text-3xl font-mono font-bold text-white">
                  {tier.price}
                </span>
                {tier.priceNote && (
                  <span className="text-sm text-gray-500 font-mono">
                    {tier.priceNote}
                  </span>
                )}
              </div>

              <div className="flex-1 space-y-2 mb-6">
                {tier.features.slice(0, 4).map((feature) => (
                  <div key={feature} className="flex items-start gap-2">
                    <CheckIcon />
                    <span className="text-xs text-gray-300">{feature}</span>
                  </div>
                ))}
              </div>

              {tier.key === "free" ? (
                <Link
                  href="/getting-started"
                  className="block w-full text-center px-4 py-2.5 bg-gray-800 text-white font-mono text-sm font-semibold rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Start Free
                </Link>
              ) : (
                <Link
                  href="/pricing"
                  className={`block w-full text-center px-4 py-2.5 font-mono text-sm font-semibold rounded-lg transition-colors ${
                    tier.highlighted
                      ? "bg-claw-500 text-black hover:bg-claw-400"
                      : "bg-gray-800 text-white hover:bg-gray-700"
                  }`}
                >
                  {tier.cta}
                </Link>
              )}
            </div>
          ))}
        </div>

        <div className="text-center">
          <Link
            href="/pricing"
            className="text-sm font-mono text-claw-500 hover:text-claw-400 transition-colors"
          >
            View full pricing comparison &rarr;
          </Link>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center p-10 rounded-lg border border-gray-800 bg-gradient-to-b from-gray-900 to-gray-950 glow-green">
          <h2 className="text-2xl md:text-3xl font-mono font-bold mb-4">
            Start making better decisions
          </h2>
          <p className="text-gray-400 mb-8 max-w-lg mx-auto">
            Free tier includes 100 calls per day. No credit card required. No
            API key needed.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/pricing"
              className="px-8 py-3.5 bg-claw-500 text-black font-mono font-semibold rounded-lg hover:bg-claw-400 transition-colors"
            >
              Get API Key
            </Link>
            <Link
              href="/try/bandit"
              className="px-8 py-3.5 border border-gray-700 text-gray-300 font-mono rounded-lg hover:border-claw-500/50 hover:text-claw-400 transition-colors"
            >
              Try an Algorithm
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
