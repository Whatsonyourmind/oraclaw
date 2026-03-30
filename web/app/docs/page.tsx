"use client";

import { useEffect, useRef } from "react";

const API_SPEC_URL =
  process.env.NEXT_PUBLIC_API_URL
    ? `${process.env.NEXT_PUBLIC_API_URL}/docs/json`
    : "https://oraclaw-api.onrender.com/docs/json";

export default function DocsPage() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load Scalar API Reference CDN
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/@scalar/api-reference@latest";
    script.async = true;

    script.onload = () => {
      if (containerRef.current) {
        // Clear previous content
        containerRef.current.innerHTML = "";

        // Create the Scalar element
        const scalarEl = document.createElement("div");
        scalarEl.id = "scalar-api-reference";
        scalarEl.setAttribute("data-url", API_SPEC_URL);
        scalarEl.setAttribute("data-proxy-url", "https://proxy.scalar.com");
        containerRef.current.appendChild(scalarEl);
      }
    };

    document.head.appendChild(script);

    // Load Scalar CSS
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://cdn.jsdelivr.net/npm/@scalar/api-reference@latest/dist/style.min.css";
    document.head.appendChild(link);

    return () => {
      // Cleanup
      if (script.parentNode) script.parentNode.removeChild(script);
      if (link.parentNode) link.parentNode.removeChild(link);
    };
  }, []);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-mono font-bold mb-2">API Documentation</h1>
        <p className="text-sm text-gray-400 mb-4">
          Interactive API playground powered by{" "}
          <a
            href="https://scalar.com"
            className="text-claw-500 hover:text-claw-400"
            target="_blank"
            rel="noopener noreferrer"
          >
            Scalar
          </a>
          . Try any endpoint directly from the browser.
        </p>
        <div className="flex gap-4 text-xs font-mono">
          <span className="text-gray-500">
            Base URL:{" "}
            <code className="text-ooda-orient">
              https://oraclaw-api.onrender.com
            </code>
          </span>
          <span className="text-gray-500">
            Spec:{" "}
            <a
              href={API_SPEC_URL}
              className="text-claw-500 hover:text-claw-400"
              target="_blank"
              rel="noopener noreferrer"
            >
              OpenAPI 3.1
            </a>
          </span>
        </div>
      </div>

      {/* Scalar Container */}
      <div ref={containerRef} className="w-full">
        <div className="flex items-center justify-center py-24 text-gray-500 font-mono text-sm">
          Loading API documentation...
        </div>
      </div>
    </div>
  );
}
