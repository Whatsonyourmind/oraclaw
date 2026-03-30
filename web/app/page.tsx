import Link from "next/link";

const stats = [
  { value: "19", label: "Algorithms" },
  { value: "<25ms", label: "Avg Latency" },
  { value: "1,072", label: "Tests Passing" },
  { value: "$0.01", label: "Per Call" },
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
    title: "14 SDK Packages",
    description:
      "Install @oraclaw/bandit, @oraclaw/solver, @oraclaw/simulate, and 11 more. Each SDK is a thin TypeScript client with full type safety.",
    icon: "package",
  },
  {
    title: "MCP Server for AI Agents",
    description:
      "@oraclaw/mcp-server exposes 12 tools for Claude, GPT, and other AI agents to call decision algorithms directly via the Model Context Protocol.",
    icon: "bot",
  },
];

export default function HomePage() {
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
                href="/getting-started"
                className="px-6 py-3 bg-claw-500 text-black font-mono font-semibold rounded-lg hover:bg-claw-400 transition-colors"
              >
                Get Started Free
              </Link>
              <Link
                href="/algorithms"
                className="px-6 py-3 border border-gray-700 text-gray-300 font-mono rounded-lg hover:border-claw-500/50 hover:text-claw-400 transition-colors"
              >
                Browse Algorithms
              </Link>
            </div>
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
              <span className="text-xs text-gray-500 ml-2 font-mono">terminal</span>
            </div>
            <pre className="p-4 text-sm font-mono overflow-x-auto">
              <code>
                <span className="text-gray-500">$ </span>
                <span className="text-claw-400">curl</span>
                <span className="text-gray-300">{" -X POST https://oraclaw-api.onrender.com/api/v1/optimize/bandit \\"}</span>
                {"\n"}
                <span className="text-gray-300">{"  -H 'Content-Type: application/json' \\"}</span>
                {"\n"}
                <span className="text-gray-300">{"  -d '{"}</span>
                {"\n"}
                <span className="text-ooda-orient">{"    \"arms\": ["}</span>
                {"\n"}
                <span className="text-ooda-orient">{"      {\"id\": \"A\", \"name\": \"Option A\", \"pulls\": 10, \"totalReward\": 7},"}</span>
                {"\n"}
                <span className="text-ooda-orient">{"      {\"id\": \"B\", \"name\": \"Option B\", \"pulls\": 10, \"totalReward\": 5},"}</span>
                {"\n"}
                <span className="text-ooda-orient">{"      {\"id\": \"C\", \"name\": \"Option C\", \"pulls\": 2, \"totalReward\": 1.8}"}</span>
                {"\n"}
                <span className="text-ooda-orient">{"    ],"}</span>
                {"\n"}
                <span className="text-ooda-orient">{"    \"algorithm\": \"ucb1\""}</span>
                {"\n"}
                <span className="text-gray-300">{"  }'"}</span>
                {"\n\n"}
                <span className="text-gray-500">{"// Response (<1ms):"}</span>
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

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center p-8 rounded-lg border border-gray-800 bg-gradient-to-b from-gray-900 to-gray-950 glow-green">
          <h2 className="text-2xl font-mono font-bold mb-4">
            Start making better decisions
          </h2>
          <p className="text-gray-400 mb-6 max-w-lg mx-auto">
            Free tier includes 100 calls per day. No credit card required. No API key needed.
          </p>
          <Link
            href="/try/bandit"
            className="inline-block px-6 py-3 bg-claw-500 text-black font-mono font-semibold rounded-lg hover:bg-claw-400 transition-colors"
          >
            Try an Algorithm Now
          </Link>
        </div>
      </section>
    </div>
  );
}
