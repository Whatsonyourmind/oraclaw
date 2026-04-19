"use client";

import { useState } from "react";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://oraclaw-api.onrender.com";

interface SignupResult {
  api_key: string;
  tier: string;
  daily_limit: number;
  pricing: string;
}

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SignupResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/api/v1/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || data.title || "Signup failed. Please retry.");
      } else {
        setResult(data);
      }
    } catch {
      setError("Network error. Please retry.");
    } finally {
      setLoading(false);
    }
  }

  async function copy(text: string, label: string) {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 1500);
  }

  if (result) {
    const claudeConfig = JSON.stringify(
      {
        mcpServers: {
          oraclaw: {
            command: "npx",
            args: ["-y", "@oraclaw/mcp-server"],
            env: { ORACLAW_API_KEY: result.api_key },
          },
        },
      },
      null,
      2,
    );

    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-3xl md:text-4xl font-mono font-bold mb-2">
          Your <span className="gradient-text">API key</span>
        </h1>
        <p className="text-gray-400 mb-8">Save it now — it can&apos;t be retrieved again.</p>

        <div className="bg-gray-900 border border-claw-500/30 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between gap-4">
            <code className="font-mono text-sm break-all text-claw-400">{result.api_key}</code>
            <button
              onClick={() => copy(result.api_key, "key")}
              className="px-3 py-1.5 bg-claw-500 hover:bg-claw-400 text-black font-mono text-xs rounded flex-shrink-0"
            >
              {copied === "key" ? "copied!" : "copy"}
            </button>
          </div>
          <div className="mt-3 text-xs text-gray-500 font-mono">
            tier: {result.tier} · {result.daily_limit.toLocaleString()} calls/day · {result.pricing}
          </div>
        </div>

        <h2 className="text-xl font-mono font-bold mt-10 mb-3">Add to Claude Desktop / Cursor / Cline</h2>
        <p className="text-gray-400 mb-3 text-sm">
          Paste into your <code className="text-claw-400">claude_desktop_config.json</code> (or equivalent MCP config):
        </p>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 mb-2 relative">
          <button
            onClick={() => copy(claudeConfig, "config")}
            className="absolute top-3 right-3 px-3 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 font-mono text-xs rounded"
          >
            {copied === "config" ? "copied!" : "copy"}
          </button>
          <pre className="font-mono text-sm text-gray-300 overflow-x-auto pr-16">
            <code>{claudeConfig}</code>
          </pre>
        </div>

        <h2 className="text-xl font-mono font-bold mt-10 mb-3">Or call the API directly</h2>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 mb-2">
          <pre className="font-mono text-xs text-gray-300 overflow-x-auto">
            <code>{`curl -X POST ${API_URL}/api/v1/optimize/bandit \\
  -H "Authorization: Bearer ${result.api_key}" \\
  -H "Content-Type: application/json" \\
  -d '{"arms":[{"id":"a","name":"A"},{"id":"b","name":"B"}]}'`}</code>
          </pre>
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href="/getting-started"
            className="px-4 py-2 bg-claw-500 hover:bg-claw-400 text-black font-mono text-sm rounded"
          >
            see all 17 tools →
          </Link>
          <Link
            href="/pricing"
            className="px-4 py-2 border border-gray-700 hover:border-claw-500 text-gray-300 font-mono text-sm rounded"
          >
            upgrade tiers
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <h1 className="text-3xl md:text-5xl font-mono font-bold mb-4 text-center">
        Get your <span className="gradient-text">API key</span>
      </h1>
      <p className="text-center text-gray-400 mb-10">
        One field. Instant key. 1,000 calls/day on pay-per-call ($0.005/call).
        <br />
        No credit card needed to start. Cancel anytime.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
          autoFocus
          className="w-full px-4 py-3 bg-gray-900 border border-gray-700 focus:border-claw-500 focus:outline-none rounded font-mono text-base"
        />
        <button
          type="submit"
          disabled={loading || !email}
          className="w-full px-4 py-3 bg-claw-500 hover:bg-claw-400 disabled:bg-gray-800 disabled:text-gray-500 text-black font-mono font-bold rounded"
        >
          {loading ? "creating key..." : "get API key"}
        </button>
      </form>

      {error && (
        <div className="mt-4 p-3 bg-red-900/20 border border-red-700 rounded text-red-400 font-mono text-sm">
          {error}
        </div>
      )}

      <div className="mt-12 text-center text-sm text-gray-500">
        <Link href="/pricing" className="hover:text-claw-400">
          see pricing tiers
        </Link>
        <span className="mx-3">·</span>
        <Link href="/getting-started" className="hover:text-claw-400">
          read docs first
        </Link>
      </div>

      <div className="mt-16 p-6 bg-gray-900 border border-gray-800 rounded-lg">
        <h2 className="font-mono font-bold mb-2 text-claw-400">What you get</h2>
        <ul className="space-y-1 text-sm text-gray-400 font-mono">
          <li>· 17 MCP tools (bandits, Monte Carlo, LP solver, forecasting, graph analytics, more)</li>
          <li>· Sub-25ms latency on all algorithms</li>
          <li>· Use via Claude Desktop, Cursor, Cline, or call the REST API directly</li>
          <li>· 1,000 calls/day on pay-per-call; upgrade to Starter ($9/mo) anytime</li>
        </ul>
      </div>
    </div>
  );
}
