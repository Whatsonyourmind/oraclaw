import Link from "next/link";
import { notFound } from "next/navigation";
import { TryItForm } from "@/components/TryItForm";
import { getAlgorithmById, ALGORITHMS, CATEGORY_COLORS } from "@/lib/algorithms";
import { ALGORITHM_EXAMPLES } from "@/lib/examples";

interface PageProps {
  params: Promise<{ algorithm: string }>;
}

export async function generateStaticParams() {
  return ALGORITHMS.map((algo) => ({ algorithm: algo.id }));
}

export async function generateMetadata({ params }: PageProps) {
  const { algorithm } = await params;
  const algo = getAlgorithmById(algorithm);
  if (!algo) return { title: "Not Found - OraClaw" };

  return {
    title: `Try ${algo.name} - OraClaw`,
    description: algo.description,
  };
}

export default async function TryAlgorithmPage({ params }: PageProps) {
  const { algorithm } = await params;
  const algo = getAlgorithmById(algorithm);
  const example = ALGORITHM_EXAMPLES[algorithm];

  if (!algo || !example) {
    notFound();
  }

  // Get other algorithms for the sidebar
  const otherAlgorithms = ALGORITHMS.filter((a) => a.id !== algorithm);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <nav className="text-xs font-mono text-gray-500 mb-6">
        <Link href="/" className="hover:text-gray-300">
          Home
        </Link>
        <span className="mx-2">/</span>
        <Link href="/algorithms" className="hover:text-gray-300">
          Algorithms
        </Link>
        <span className="mx-2">/</span>
        <span className="text-gray-300">{algo.name}</span>
      </nav>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Main Content */}
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-4">
            <h1 className="text-2xl font-mono font-bold">{algo.name}</h1>
            <span
              className={`text-xs font-mono px-2 py-0.5 rounded-full border ${
                CATEGORY_COLORS[algo.category]
              }`}
            >
              {algo.category}
            </span>
          </div>

          {/* Metadata */}
          <div className="flex flex-wrap gap-4 mb-6 text-xs font-mono text-gray-500">
            <span>Price: <span className="text-claw-400">{algo.pricePerCall}/call</span></span>
            <span>Latency: <span className="text-ooda-orient">{algo.avgLatency}</span></span>
            <span>Complexity: <span className="text-gray-400">{algo.complexity}</span></span>
          </div>

          {/* Try It Form */}
          <TryItForm
            algorithmId={algo.id}
            algorithmName={algo.name}
            endpoint={algo.endpoint}
            defaultInput={example.input}
            description={example.description}
          />

          {/* Input/Output Schema */}
          <div className="grid md:grid-cols-2 gap-4 mt-8">
            <div className="p-4 rounded-lg border border-gray-800 bg-gray-900/50">
              <h3 className="text-xs font-mono text-gray-500 mb-3">Input Schema</h3>
              <div className="space-y-2">
                {Object.entries(algo.inputSchema).map(([key, type]) => (
                  <div key={key} className="text-xs font-mono">
                    <span className="text-ooda-orient">{key}</span>
                    <span className="text-gray-600">: </span>
                    <span className="text-gray-400">{type}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-4 rounded-lg border border-gray-800 bg-gray-900/50">
              <h3 className="text-xs font-mono text-gray-500 mb-3">Output Fields</h3>
              <div className="flex flex-wrap gap-2">
                {algo.outputFields.map((field) => (
                  <span
                    key={field}
                    className="text-xs font-mono text-ooda-decide bg-ooda-decide/10 px-2 py-0.5 rounded"
                  >
                    {field}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar: Other Algorithms */}
        <div className="lg:w-64 shrink-0">
          <h3 className="text-xs font-mono text-gray-500 mb-3">Other Algorithms</h3>
          <div className="space-y-1">
            {otherAlgorithms.map((a) => (
              <Link
                key={a.id}
                href={`/try/${a.id}`}
                className="block px-3 py-2 text-xs font-mono text-gray-400 hover:text-claw-400 hover:bg-gray-900 rounded transition-colors"
              >
                {a.name}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
