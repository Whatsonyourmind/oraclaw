"use client";

import { useState, useCallback } from "react";

interface TryItFormProps {
  algorithmId: string;
  algorithmName: string;
  endpoint: string;
  defaultInput: Record<string, unknown>;
  description: string;
}

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "https://oraclaw-api.onrender.com";

export function TryItForm({
  algorithmId,
  algorithmName,
  endpoint,
  defaultInput,
  description,
}: TryItFormProps) {
  const [input, setInput] = useState(JSON.stringify(defaultInput, null, 2));
  const [output, setOutput] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timing, setTiming] = useState<number | null>(null);
  const [apiKey, setApiKey] = useState("");

  const handleSubmit = useCallback(async () => {
    setLoading(true);
    setError(null);
    setOutput(null);
    setTiming(null);

    try {
      const parsed = JSON.parse(input);
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (apiKey.trim()) {
        headers["Authorization"] = `Bearer ${apiKey.trim()}`;
      }

      const start = performance.now();
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        headers,
        body: JSON.stringify(parsed),
      });
      const elapsed = performance.now() - start;
      setTiming(Math.round(elapsed));

      const data = await response.json();

      if (!response.ok) {
        setError(`HTTP ${response.status}: ${data.title || data.detail || JSON.stringify(data)}`);
        setOutput(JSON.stringify(data, null, 2));
      } else {
        setOutput(JSON.stringify(data, null, 2));
      }
    } catch (err) {
      if (err instanceof SyntaxError) {
        setError("Invalid JSON input. Please check your syntax.");
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unknown error occurred.");
      }
    } finally {
      setLoading(false);
    }
  }, [input, apiKey, endpoint]);

  const handleReset = useCallback(() => {
    setInput(JSON.stringify(defaultInput, null, 2));
    setOutput(null);
    setError(null);
    setTiming(null);
  }, [defaultInput]);

  return (
    <div className="space-y-6">
      {/* Description */}
      <p className="text-sm text-gray-400">{description}</p>

      {/* API Key (optional) */}
      <div>
        <label className="block text-xs font-mono text-gray-500 mb-1">
          API Key (optional -- free tier works without one)
        </label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="Bearer your-api-key"
          className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm font-mono text-gray-300 placeholder-gray-600 focus:outline-none focus:border-claw-500/50"
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Input */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-mono text-gray-500">
              POST {endpoint}
            </label>
            <button
              onClick={handleReset}
              className="text-xs font-mono text-gray-600 hover:text-gray-400 transition-colors"
            >
              Reset
            </button>
          </div>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={Math.max(15, input.split("\n").length + 2)}
            className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-sm font-mono text-gray-300 resize-y focus:outline-none focus:border-claw-500/50"
            spellCheck={false}
          />
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="mt-3 w-full px-4 py-2.5 bg-claw-500 text-black font-mono font-semibold rounded-lg hover:bg-claw-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Running..." : "Run Algorithm"}
          </button>
        </div>

        {/* Output */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-mono text-gray-500">Response</label>
            {timing !== null && (
              <span className="text-xs font-mono text-claw-400">
                {timing}ms (network + compute)
              </span>
            )}
          </div>
          <div className="w-full min-h-[300px] px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg overflow-auto">
            {error && (
              <div className="text-xs font-mono text-red-400 mb-2">
                {error}
              </div>
            )}
            {output ? (
              <pre className="text-sm font-mono text-ooda-decide whitespace-pre-wrap">
                {output}
              </pre>
            ) : (
              <div className="text-sm font-mono text-gray-600 flex items-center justify-center h-full min-h-[250px]">
                {loading
                  ? "Executing algorithm..."
                  : "Click \"Run Algorithm\" to see results"}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
