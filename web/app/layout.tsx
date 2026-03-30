import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "OraClaw - Decision Intelligence as an API",
  description:
    "19 production-grade ML algorithms for optimization, simulation, prediction, and planning. Sub-25ms response times. Pay per call.",
  keywords: [
    "decision intelligence",
    "ML API",
    "optimization",
    "Monte Carlo",
    "Bayesian inference",
    "genetic algorithm",
    "pathfinding",
    "multi-armed bandit",
  ],
};

const navLinks = [
  { href: "/algorithms", label: "Algorithms" },
  { href: "/docs", label: "API Docs" },
  { href: "/getting-started", label: "Get Started" },
  { href: "/try/bandit", label: "Try It" },
];

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen flex flex-col">
        {/* Header */}
        <header className="border-b border-gray-800 bg-gray-950/80 backdrop-blur-sm sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <Link
                href="/"
                className="flex items-center gap-2 font-mono font-bold text-xl"
              >
                <span className="text-claw-500">&gt;_</span>
                <span className="text-white">OraClaw</span>
              </Link>

              <nav className="hidden md:flex items-center gap-6">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="text-sm text-gray-400 hover:text-claw-400 transition-colors font-mono"
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>

              <div className="flex items-center gap-3">
                <a
                  href="https://github.com/Whatsonyourmind/oracle"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-white transition-colors"
                  aria-label="GitHub"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path
                      fillRule="evenodd"
                      d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                      clipRule="evenodd"
                    />
                  </svg>
                </a>
                <a
                  href="https://www.npmjs.com/org/oraclaw"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-mono text-gray-500 hover:text-red-400 transition-colors"
                >
                  npm
                </a>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1">{children}</main>

        {/* Footer */}
        <footer className="border-t border-gray-800 bg-gray-950">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="text-sm text-gray-500 font-mono">
                <span className="text-claw-500">&gt;_</span> OraClaw v2.3.0 -- 19 algorithms, {"<"}25ms
              </div>
              <div className="flex items-center gap-6 text-sm text-gray-500">
                <Link href="/algorithms" className="hover:text-gray-300 transition-colors">
                  Algorithms
                </Link>
                <Link href="/docs" className="hover:text-gray-300 transition-colors">
                  API Docs
                </Link>
                <a
                  href="https://github.com/Whatsonyourmind/oracle"
                  className="hover:text-gray-300 transition-colors"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  GitHub
                </a>
                <a
                  href="https://oraclaw-api.onrender.com/health"
                  className="hover:text-gray-300 transition-colors"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  API Status
                </a>
              </div>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
