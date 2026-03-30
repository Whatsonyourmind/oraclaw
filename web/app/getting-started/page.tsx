import Link from "next/link";

export const metadata = {
  title: "Get Started",
  description:
    "Get from zero to first OraClaw API call in under 2 minutes. Free tier included, no API key required. curl examples for all 19 algorithms.",
  alternates: {
    canonical: "/getting-started",
  },
};

export default function GettingStartedPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Breadcrumb */}
      <nav className="text-xs font-mono text-gray-500 mb-8">
        <Link href="/" className="hover:text-gray-300">
          Home
        </Link>
        <span className="mx-2">/</span>
        <span className="text-gray-300">Get Started</span>
      </nav>

      <h1 className="text-3xl font-mono font-bold mb-4">Get Started</h1>
      <p className="text-gray-400 mb-12">
        From zero to first API call in under 2 minutes. The free tier gives you
        100 calls per day with no API key required.
      </p>

      {/* Step 1 */}
      <section className="mb-12">
        <div className="flex items-center gap-3 mb-4">
          <span className="w-8 h-8 rounded-full bg-claw-500 text-black font-mono font-bold text-sm flex items-center justify-center">
            1
          </span>
          <h2 className="text-xl font-mono font-bold">Make Your First Call</h2>
        </div>
        <p className="text-sm text-gray-400 mb-4">
          No setup needed. The free tier works without authentication. Just send
          a POST request:
        </p>

        {/* curl */}
        <div className="mb-4">
          <div className="text-xs font-mono text-gray-500 mb-1">curl</div>
          <div className="rounded-lg border border-gray-800 bg-gray-900 p-4 overflow-x-auto">
            <pre className="text-sm font-mono text-gray-300">
{`curl -X POST https://oraclaw-api.onrender.com/api/v1/optimize/bandit \\
  -H 'Content-Type: application/json' \\
  -d '{
    "arms": [
      {"id": "A", "name": "Option A", "pulls": 10, "totalReward": 7},
      {"id": "B", "name": "Option B", "pulls": 10, "totalReward": 5},
      {"id": "C", "name": "Option C", "pulls": 2, "totalReward": 1.8}
    ],
    "algorithm": "ucb1"
  }'`}
            </pre>
          </div>
        </div>

        {/* JavaScript */}
        <div className="mb-4">
          <div className="text-xs font-mono text-gray-500 mb-1">JavaScript / TypeScript</div>
          <div className="rounded-lg border border-gray-800 bg-gray-900 p-4 overflow-x-auto">
            <pre className="text-sm font-mono text-gray-300">
{`const response = await fetch(
  'https://oraclaw-api.onrender.com/api/v1/optimize/bandit',
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      arms: [
        { id: 'A', name: 'Option A', pulls: 10, totalReward: 7 },
        { id: 'B', name: 'Option B', pulls: 10, totalReward: 5 },
        { id: 'C', name: 'Option C', pulls: 2, totalReward: 1.8 },
      ],
      algorithm: 'ucb1',
    }),
  }
);

const result = await response.json();
console.log(result.selected); // { id: "C", name: "Option C" }`}
            </pre>
          </div>
        </div>

        {/* Python */}
        <div className="mb-4">
          <div className="text-xs font-mono text-gray-500 mb-1">Python</div>
          <div className="rounded-lg border border-gray-800 bg-gray-900 p-4 overflow-x-auto">
            <pre className="text-sm font-mono text-gray-300">
{`import requests

response = requests.post(
    'https://oraclaw-api.onrender.com/api/v1/optimize/bandit',
    json={
        'arms': [
            {'id': 'A', 'name': 'Option A', 'pulls': 10, 'totalReward': 7},
            {'id': 'B', 'name': 'Option B', 'pulls': 10, 'totalReward': 5},
            {'id': 'C', 'name': 'Option C', 'pulls': 2, 'totalReward': 1.8},
        ],
        'algorithm': 'ucb1',
    }
)

result = response.json()
print(result['selected'])  # {'id': 'C', 'name': 'Option C'}`}
            </pre>
          </div>
        </div>

        {/* npm SDK */}
        <div>
          <div className="text-xs font-mono text-gray-500 mb-1">@oraclaw/bandit SDK</div>
          <div className="rounded-lg border border-gray-800 bg-gray-900 p-4 overflow-x-auto">
            <pre className="text-sm font-mono text-gray-300">
{`npm install @oraclaw/bandit`}
            </pre>
          </div>
          <div className="rounded-lg border border-gray-800 bg-gray-900 p-4 mt-2 overflow-x-auto">
            <pre className="text-sm font-mono text-gray-300">
{`import { OraClaw } from '@oraclaw/bandit';

const client = new OraClaw({ apiKey: 'your-api-key' }); // optional for free tier

const result = await client.optimize({
  arms: [
    { id: 'A', name: 'Option A', pulls: 10, totalReward: 7 },
    { id: 'B', name: 'Option B', pulls: 10, totalReward: 5 },
    { id: 'C', name: 'Option C', pulls: 2, totalReward: 1.8 },
  ],
  algorithm: 'ucb1',
});

console.log(result.selected); // { id: "C", name: "Option C" }`}
            </pre>
          </div>
        </div>
      </section>

      {/* Step 2 */}
      <section className="mb-12">
        <div className="flex items-center gap-3 mb-4">
          <span className="w-8 h-8 rounded-full bg-claw-500 text-black font-mono font-bold text-sm flex items-center justify-center">
            2
          </span>
          <h2 className="text-xl font-mono font-bold">Understand the Result</h2>
        </div>
        <p className="text-sm text-gray-400 mb-4">
          The bandit endpoint returns a JSON object with the selected arm, its
          score, and the algorithm used:
        </p>
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-4 overflow-x-auto">
          <pre className="text-sm font-mono text-ooda-decide">
{`{
  "selected": {
    "id": "C",          // The arm the algorithm recommends
    "name": "Option C"
  },
  "score": 1.876,       // UCB1 score (exploitation + exploration)
  "algorithm": "ucb1",
  "exploitation": 0.9,  // Average reward of this arm
  "exploration": 0.976, // Exploration bonus (uncertainty)
  "regret": 0.1         // Cumulative regret vs. best arm
}`}
          </pre>
        </div>
        <p className="text-xs text-gray-500 mt-3">
          Option C was selected because it has high exploitation (0.9 avg reward)
          AND high exploration bonus (only 2 pulls, high uncertainty). UCB1
          balances both factors.
        </p>
      </section>

      {/* Step 3 */}
      <section className="mb-12">
        <div className="flex items-center gap-3 mb-4">
          <span className="w-8 h-8 rounded-full bg-claw-500 text-black font-mono font-bold text-sm flex items-center justify-center">
            3
          </span>
          <h2 className="text-xl font-mono font-bold">Get an API Key (Optional)</h2>
        </div>
        <p className="text-sm text-gray-400 mb-4">
          The free tier allows 100 calls per day without an API key. For higher
          limits, create an API key:
        </p>
        <div className="p-4 rounded-lg border border-gray-800 bg-gray-900/50">
          <div className="space-y-3 text-sm">
            <div className="flex gap-3">
              <span className="text-claw-500 font-mono shrink-0">1.</span>
              <span className="text-gray-400">
                Subscribe at{" "}
                <code className="text-ooda-orient bg-gray-800 px-1.5 py-0.5 rounded text-xs">
                  POST /api/v1/billing/subscribe
                </code>{" "}
                with your email and tier (starter/growth/scale)
              </span>
            </div>
            <div className="flex gap-3">
              <span className="text-claw-500 font-mono shrink-0">2.</span>
              <span className="text-gray-400">
                Complete Stripe Checkout to activate your subscription
              </span>
            </div>
            <div className="flex gap-3">
              <span className="text-claw-500 font-mono shrink-0">3.</span>
              <span className="text-gray-400">
                Add your API key to requests:{" "}
                <code className="text-ooda-orient bg-gray-800 px-1.5 py-0.5 rounded text-xs">
                  Authorization: Bearer your-key
                </code>
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Quick Reference */}
      <section className="mb-12">
        <h2 className="text-xl font-mono font-bold mb-4">Pricing</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { tier: "Free", price: "$0", calls: "100/day", highlight: true },
            { tier: "Starter", price: "$99/mo", calls: "50K/mo", highlight: false },
            { tier: "Growth", price: "$499/mo", calls: "500K/mo", highlight: false },
            { tier: "Scale", price: "$2,499/mo", calls: "5M/mo", highlight: false },
          ].map((t) => (
            <div
              key={t.tier}
              className={`p-4 rounded-lg border text-center ${
                t.highlight
                  ? "border-claw-500/50 bg-claw-500/5"
                  : "border-gray-800 bg-gray-900/50"
              }`}
            >
              <div className="text-xs font-mono text-gray-500">{t.tier}</div>
              <div className="text-lg font-mono font-bold text-white mt-1">
                {t.price}
              </div>
              <div className="text-xs font-mono text-gray-500 mt-1">
                {t.calls}
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-3 text-center">
          AI agents can also pay per call with USDC via x402 machine payments.{" "}
          <Link href="/docs" className="text-claw-500 hover:text-claw-400">
            See API docs
          </Link>{" "}
          for details.
        </p>
      </section>

      {/* Next Steps */}
      <section>
        <h2 className="text-xl font-mono font-bold mb-4">Next Steps</h2>
        <div className="grid md:grid-cols-3 gap-4">
          <Link
            href="/algorithms"
            className="p-4 rounded-lg border border-gray-800 bg-gray-900/50 card-hover"
          >
            <h3 className="text-sm font-mono font-semibold text-white mb-1">
              Browse Algorithms
            </h3>
            <p className="text-xs text-gray-500">
              See all 19 algorithms with descriptions and pricing.
            </p>
          </Link>
          <Link
            href="/try/montecarlo"
            className="p-4 rounded-lg border border-gray-800 bg-gray-900/50 card-hover"
          >
            <h3 className="text-sm font-mono font-semibold text-white mb-1">
              Try Monte Carlo
            </h3>
            <p className="text-xs text-gray-500">
              Run probabilistic simulations in the browser.
            </p>
          </Link>
          <Link
            href="/docs"
            className="p-4 rounded-lg border border-gray-800 bg-gray-900/50 card-hover"
          >
            <h3 className="text-sm font-mono font-semibold text-white mb-1">
              API Reference
            </h3>
            <p className="text-xs text-gray-500">
              Interactive Scalar playground with all endpoints.
            </p>
          </Link>
        </div>
      </section>
    </div>
  );
}
