"use client";

import { useState } from "react";

interface CurlCommandProps {
  endpoint: string;
  inputJson: string;
}

const API_BASE = "https://oraclaw-api.onrender.com";

export function CurlCommand({ endpoint, inputJson }: CurlCommandProps) {
  const [copied, setCopied] = useState(false);

  let compactJson = "";
  try {
    compactJson = JSON.stringify(JSON.parse(inputJson));
  } catch {
    compactJson = inputJson.replace(/\n/g, "").replace(/\s+/g, " ");
  }

  const curlCommand = `curl -X POST ${API_BASE}${endpoint} \\
  -H "Content-Type: application/json" \\
  -d '${compactJson}'`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(curlCommand);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = curlCommand;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800">
        <span className="text-xs font-mono text-gray-500">cURL</span>
        <button
          onClick={handleCopy}
          className="text-xs font-mono px-2.5 py-1 rounded border border-gray-700 text-gray-400 hover:text-claw-400 hover:border-claw-500/30 transition-colors"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <pre className="px-4 py-3 text-sm font-mono text-green-400 whitespace-pre-wrap overflow-x-auto">
        {curlCommand}
      </pre>
    </div>
  );
}
