"use client";

import { useState } from "react";
import Link from "next/link";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://oraclaw-api.onrender.com";

interface UsageStats {
  tier: string;
  callsToday: number;
  callsThisMonth: number;
  dailyLimit: number;
  monthlyLimit: number;
}

export default function DashboardPage() {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [keyVisible, setKeyVisible] = useState(false);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tier] = useState("free");

  // Placeholder usage stats for demo
  const usage: UsageStats = {
    tier: "Free",
    callsToday: 0,
    callsThisMonth: 0,
    dailyLimit: 25,
    monthlyLimit: 750,
  };

  const handleRequestKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // In production, this would call the API to create an Unkey key
      // For now, show the flow and link to subscription
      const res = await fetch(`${API_URL}/api/billing/request-key`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (res.ok) {
        const data = await res.json();
        setApiKey(data.key);
      } else {
        // Graceful fallback -- API billing routes may not be configured yet
        setError(
          "API key provisioning is being set up. Subscribe to a paid plan to get your API key immediately."
        );
      }
    } catch {
      setError(
        "API key provisioning is being set up. Subscribe to a paid plan to get your API key immediately."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <div className="mb-10">
        <h1 className="text-3xl font-mono font-bold mb-2">Dashboard</h1>
        <p className="text-gray-400">
          Manage your API keys, view usage, and manage your subscription.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6 mb-10">
        {/* Current Plan */}
        <div className="p-6 rounded-lg border border-gray-800 bg-gray-900/50">
          <h3 className="text-xs font-mono text-gray-500 uppercase mb-2">
            Current Plan
          </h3>
          <div className="text-2xl font-mono font-bold text-claw-400 mb-1">
            {usage.tier}
          </div>
          <p className="text-xs text-gray-500">
            {tier === "free"
              ? "No credit card required"
              : "Managed via Stripe"}
          </p>
          <Link
            href="/pricing"
            className="inline-block mt-4 text-xs font-mono text-claw-500 hover:text-claw-400 transition-colors"
          >
            Upgrade Plan &rarr;
          </Link>
        </div>

        {/* Calls Today */}
        <div className="p-6 rounded-lg border border-gray-800 bg-gray-900/50">
          <h3 className="text-xs font-mono text-gray-500 uppercase mb-2">
            Calls Today
          </h3>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-mono font-bold text-white">
              {usage.callsToday}
            </span>
            <span className="text-xs text-gray-500 font-mono">
              / {usage.dailyLimit.toLocaleString()}
            </span>
          </div>
          <div className="mt-3 w-full bg-gray-800 rounded-full h-1.5">
            <div
              className="bg-claw-500 h-1.5 rounded-full transition-all"
              style={{
                width: `${Math.min(
                  (usage.callsToday / usage.dailyLimit) * 100,
                  100
                )}%`,
              }}
            />
          </div>
        </div>

        {/* Calls This Month */}
        <div className="p-6 rounded-lg border border-gray-800 bg-gray-900/50">
          <h3 className="text-xs font-mono text-gray-500 uppercase mb-2">
            Calls This Month
          </h3>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-mono font-bold text-white">
              {usage.callsThisMonth}
            </span>
            <span className="text-xs text-gray-500 font-mono">
              / {usage.monthlyLimit.toLocaleString()}
            </span>
          </div>
          <div className="mt-3 w-full bg-gray-800 rounded-full h-1.5">
            <div
              className="bg-claw-500 h-1.5 rounded-full transition-all"
              style={{
                width: `${Math.min(
                  (usage.callsThisMonth / usage.monthlyLimit) * 100,
                  100
                )}%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* API Key Section */}
      <div className="p-6 rounded-lg border border-gray-800 bg-gray-900/50 mb-10">
        <h2 className="text-lg font-mono font-semibold text-white mb-4">
          API Key
        </h2>

        {apiKey ? (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 font-mono text-sm bg-gray-800 px-4 py-3 rounded border border-gray-700">
                {keyVisible ? (
                  <span className="text-claw-400">{apiKey}</span>
                ) : (
                  <span className="text-gray-500">
                    ok_live_{"*".repeat(32)}
                  </span>
                )}
              </div>
              <button
                onClick={() => setKeyVisible(!keyVisible)}
                className="px-3 py-3 text-xs font-mono border border-gray-700 rounded hover:border-gray-600 text-gray-400 hover:text-white transition-colors"
              >
                {keyVisible ? "Hide" : "Show"}
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(apiKey);
                }}
                className="px-3 py-3 text-xs font-mono border border-gray-700 rounded hover:border-gray-600 text-gray-400 hover:text-white transition-colors"
              >
                Copy
              </button>
            </div>
            <p className="text-xs text-yellow-500/80 font-mono">
              Save this key now. It will only be shown once.
            </p>
          </div>
        ) : (
          <div>
            <p className="text-sm text-gray-400 mb-4">
              {tier === "free"
                ? "The free tier doesn't require an API key. Upgrade to a paid plan to get a managed API key with higher limits."
                : "Request an API key for your current plan."}
            </p>

            <form onSubmit={handleRequestKey} className="flex gap-3 mb-4">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                className="flex-1 px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm font-mono text-white placeholder-gray-600 focus:outline-none focus:border-claw-500/50"
              />
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2.5 bg-claw-500 text-black font-mono text-sm font-semibold rounded-lg hover:bg-claw-400 transition-colors disabled:opacity-50"
              >
                {loading ? "Requesting..." : "Request API Key"}
              </button>
            </form>

            {error && (
              <div className="p-3 rounded border border-yellow-500/30 bg-yellow-500/5">
                <p className="text-xs text-yellow-500 font-mono">{error}</p>
                <Link
                  href="/pricing"
                  className="inline-block mt-2 text-xs font-mono text-claw-500 hover:text-claw-400"
                >
                  View plans &rarr;
                </Link>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Quick Start */}
      <div className="p-6 rounded-lg border border-gray-800 bg-gray-900/50 mb-10">
        <h2 className="text-lg font-mono font-semibold text-white mb-4">
          Quick Start
        </h2>
        <div className="space-y-4">
          <div>
            <h3 className="text-xs font-mono text-gray-500 uppercase mb-2">
              Free Tier (No API Key)
            </h3>
            <div className="bg-gray-800 rounded p-3 overflow-x-auto">
              <pre className="text-xs font-mono text-gray-300">
{`curl -X POST ${API_URL}/api/v1/optimize/bandit \\
  -H 'Content-Type: application/json' \\
  -d '{"arms":[{"id":"A","pulls":10,"totalReward":7},{"id":"B","pulls":10,"totalReward":5}],"algorithm":"ucb1"}'`}
              </pre>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-mono text-gray-500 uppercase mb-2">
              With API Key (Paid Plans)
            </h3>
            <div className="bg-gray-800 rounded p-3 overflow-x-auto">
              <pre className="text-xs font-mono text-gray-300">
{`curl -X POST ${API_URL}/api/v1/optimize/bandit \\
  -H 'Content-Type: application/json' \\
  -H 'Authorization: Bearer ok_live_your_key_here' \\
  -d '{"arms":[{"id":"A","pulls":10,"totalReward":7},{"id":"B","pulls":10,"totalReward":5}],"algorithm":"ucb1"}'`}
              </pre>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-mono text-gray-500 uppercase mb-2">
              npm SDK
            </h3>
            <div className="bg-gray-800 rounded p-3 overflow-x-auto">
              <pre className="text-xs font-mono text-gray-300">
{`npm install @oraclaw/bandit

import { bandit } from '@oraclaw/bandit';

const result = await bandit({
  arms: [{ id: 'A', pulls: 10, totalReward: 7 }, { id: 'B', pulls: 10, totalReward: 5 }],
  algorithm: 'ucb1',
});`}
              </pre>
            </div>
          </div>
        </div>
      </div>

      {/* Pay-per-call Option */}
      <div className="p-6 rounded-lg border border-ooda-orient/30 bg-ooda-orient/5 mb-10">
        <div className="flex items-center gap-2 mb-3">
          <svg className="w-5 h-5 text-ooda-orient" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <h2 className="text-lg font-mono font-semibold text-white">
            Pay-per-call Billing
          </h2>
        </div>
        <p className="text-sm text-gray-400 mb-3">
          No monthly subscription needed. Pay just <span className="text-ooda-orient font-mono font-semibold">$0.005 per call</span> (half a cent), billed monthly via Stripe.
          Perfect for variable workloads or getting started without commitment.
        </p>
        <Link
          href="/pricing"
          className="inline-block px-4 py-2 bg-ooda-orient text-black font-mono text-sm font-semibold rounded-lg hover:bg-ooda-orient/80 transition-colors"
        >
          Switch to Pay-per-call
        </Link>
      </div>

      {/* Subscription Management */}
      <div className="p-6 rounded-lg border border-gray-800 bg-gray-900/50">
        <h2 className="text-lg font-mono font-semibold text-white mb-4">
          Subscription Management
        </h2>
        <p className="text-sm text-gray-400 mb-4">
          Manage your subscription, update payment methods, view invoices, and
          change plans through the Stripe Customer Portal. Pay-per-call usage is
          also visible in your Stripe dashboard.
        </p>
        <div className="flex flex-wrap gap-3">
          <a
            href={`${API_URL}/api/billing/portal`}
            className="px-4 py-2.5 border border-gray-700 text-gray-300 font-mono text-sm rounded-lg hover:border-claw-500/50 hover:text-claw-400 transition-colors"
          >
            Manage Subscription
          </a>
          <Link
            href="/pricing"
            className="px-4 py-2.5 border border-gray-700 text-gray-300 font-mono text-sm rounded-lg hover:border-claw-500/50 hover:text-claw-400 transition-colors"
          >
            Change Plan
          </Link>
          <Link
            href="/docs"
            className="px-4 py-2.5 border border-gray-700 text-gray-300 font-mono text-sm rounded-lg hover:border-claw-500/50 hover:text-claw-400 transition-colors"
          >
            API Documentation
          </Link>
        </div>
      </div>
    </div>
  );
}
