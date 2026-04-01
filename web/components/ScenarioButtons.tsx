"use client";

export interface Scenario {
  name: string;
  description: string;
  input: Record<string, unknown>;
}

interface ScenarioButtonsProps {
  scenarios: Scenario[];
  onSelect: (input: Record<string, unknown>) => void;
}

export function ScenarioButtons({ scenarios, onSelect }: ScenarioButtonsProps) {
  if (scenarios.length === 0) return null;

  return (
    <div>
      <h3 className="text-xs font-mono text-gray-500 mb-3">
        Quick scenarios
      </h3>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {scenarios.map((scenario) => (
          <button
            key={scenario.name}
            onClick={() => onSelect(scenario.input)}
            className="group text-left px-4 py-3 rounded-lg border border-gray-800 bg-gray-900/50 hover:border-claw-500/30 hover:bg-gray-900 transition-all"
          >
            <div className="text-sm font-mono font-semibold text-gray-300 group-hover:text-claw-400 transition-colors mb-1">
              {scenario.name}
            </div>
            <div className="text-xs font-mono text-gray-600 leading-relaxed">
              {scenario.description}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
