"use client";

import { useState } from "react";

const MCP_CONFIG = JSON.stringify(
  {
    mcpServers: {
      oraclaw: {
        command: "npx",
        args: ["-y", "@oraclaw/mcp-server"],
      },
    },
  },
  null,
  2
);

export function McpConfig() {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(MCP_CONFIG);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = MCP_CONFIG;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900/50 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-900 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-claw-400">{">"}</span>
          <span className="text-sm font-mono text-gray-300">
            Add to your AI agent
          </span>
        </div>
        <span className="text-xs font-mono text-gray-600">
          {expanded ? "[-]" : "[+]"}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-gray-800">
          <div className="px-4 py-3 space-y-3">
            <p className="text-xs font-mono text-gray-500">
              Add this to your Claude Code MCP config (
              <span className="text-gray-400">~/.claude/mcp.json</span>) to use
              OraClaw algorithms as AI agent tools:
            </p>

            <div className="relative rounded border border-gray-700 bg-gray-900">
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-800">
                <span className="text-xs font-mono text-gray-600">
                  mcp.json
                </span>
                <button
                  onClick={handleCopy}
                  className="text-xs font-mono px-2.5 py-1 rounded border border-gray-700 text-gray-400 hover:text-claw-400 hover:border-claw-500/30 transition-colors"
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
              <pre className="px-3 py-2.5 text-sm font-mono text-ooda-orient whitespace-pre overflow-x-auto">
                {MCP_CONFIG}
              </pre>
            </div>

            <p className="text-xs font-mono text-gray-600">
              Once configured, your agent can call any of the 18 OraClaw
              algorithms natively.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
