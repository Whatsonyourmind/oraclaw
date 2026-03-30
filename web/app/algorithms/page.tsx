import Link from "next/link";
import {
  ALGORITHMS,
  CATEGORY_COLORS,
  getAlgorithmsByCategory,
  type AlgorithmCategory,
} from "@/lib/algorithms";

export const metadata = {
  title: "Algorithms - OraClaw",
  description:
    "Browse 19 production-grade ML algorithms for optimization, simulation, prediction, and planning.",
};

const CATEGORY_ORDER: AlgorithmCategory[] = [
  "Optimize",
  "Simulate",
  "Solve",
  "Analyze",
  "Predict",
  "Detect",
  "Score",
  "Plan",
];

const CATEGORY_DESCRIPTIONS: Record<AlgorithmCategory, string> = {
  Optimize:
    "Evolutionary and bandit algorithms for finding optimal solutions in large search spaces.",
  Simulate:
    "Monte Carlo and scenario simulations for risk assessment and what-if analysis.",
  Solve:
    "Constraint satisfaction and pathfinding for scheduling, routing, and resource allocation.",
  Analyze:
    "Graph analysis, portfolio risk, and multi-model consensus for complex data interpretation.",
  Predict:
    "Bayesian inference, ensemble methods, and time series forecasting for probabilistic predictions.",
  Detect:
    "Statistical anomaly detection and signal scanning for identifying unusual patterns.",
  Score:
    "Convergence and calibration scoring for evaluating prediction quality and source agreement.",
  Plan:
    "Pathfinding and critical path analysis for sequencing tasks and finding optimal routes.",
};

export default function AlgorithmsPage() {
  const grouped = getAlgorithmsByCategory();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <div className="mb-12">
        <h1 className="text-3xl md:text-4xl font-mono font-bold mb-4">
          Algorithm Catalog
        </h1>
        <p className="text-gray-400 max-w-2xl">
          {ALGORITHMS.length} production-grade algorithms across{" "}
          {CATEGORY_ORDER.length} categories. All endpoints return results in
          under 25ms with zero LLM cost.
        </p>
        <div className="flex flex-wrap gap-2 mt-4">
          {CATEGORY_ORDER.map((cat) => (
            <a
              key={cat}
              href={`#${cat.toLowerCase()}`}
              className={`text-xs font-mono px-3 py-1 rounded-full border ${CATEGORY_COLORS[cat]}`}
            >
              {cat} ({grouped[cat]?.length || 0})
            </a>
          ))}
        </div>
      </div>

      {/* Categories */}
      {CATEGORY_ORDER.map((category) => {
        const algos = grouped[category];
        if (!algos || algos.length === 0) return null;

        return (
          <section key={category} id={category.toLowerCase()} className="mb-16">
            <div className="mb-6">
              <h2 className="text-xl font-mono font-bold text-white flex items-center gap-3">
                <span
                  className={`text-xs font-mono px-3 py-1 rounded-full border ${CATEGORY_COLORS[category]}`}
                >
                  {category}
                </span>
              </h2>
              <p className="text-sm text-gray-500 mt-2">
                {CATEGORY_DESCRIPTIONS[category]}
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {algos.map((algo) => (
                <div
                  key={algo.id}
                  className="p-5 rounded-lg border border-gray-800 bg-gray-900/50 card-hover flex flex-col"
                >
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-mono font-semibold text-white text-sm">
                      {algo.name}
                    </h3>
                    <span className="text-xs font-mono text-claw-400 whitespace-nowrap ml-2">
                      {algo.pricePerCall}
                    </span>
                  </div>

                  <p className="text-xs text-gray-400 leading-relaxed mb-4 flex-1">
                    {algo.description}
                  </p>

                  <div className="flex flex-wrap gap-1 mb-4">
                    {algo.useCases.slice(0, 3).map((uc) => (
                      <span
                        key={uc}
                        className="text-[10px] font-mono text-gray-500 bg-gray-800 px-2 py-0.5 rounded"
                      >
                        {uc}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center justify-between text-[10px] font-mono text-gray-600 border-t border-gray-800 pt-3">
                    <span>{algo.avgLatency}</span>
                    <span>{algo.complexity}</span>
                    <Link
                      href={`/try/${algo.id}`}
                      className="text-claw-500 hover:text-claw-400 transition-colors"
                    >
                      Try It &rarr;
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
