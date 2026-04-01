"use client";

import { useState } from "react";
import { TryItForm } from "./TryItForm";
import { ScenarioButtons } from "./ScenarioButtons";
import type { Scenario } from "./ScenarioButtons";

interface PlaygroundSectionProps {
  algorithmId: string;
  algorithmName: string;
  endpoint: string;
  defaultInput: Record<string, unknown>;
  description: string;
  scenarios: Scenario[];
}

export function PlaygroundSection({
  algorithmId,
  algorithmName,
  endpoint,
  defaultInput,
  description,
  scenarios,
}: PlaygroundSectionProps) {
  const [selectedInput, setSelectedInput] = useState<{
    data: Record<string, unknown>;
    tick: number;
  } | null>(null);

  const handleScenarioSelect = (input: Record<string, unknown>) => {
    // Use tick to ensure re-clicking the same scenario still triggers the update
    setSelectedInput((prev) => ({
      data: input,
      tick: (prev?.tick ?? 0) + 1,
    }));
  };

  return (
    <div className="space-y-6">
      {/* Scenario Buttons */}
      {scenarios.length > 0 && (
        <ScenarioButtons
          scenarios={scenarios}
          onSelect={handleScenarioSelect}
        />
      )}

      {/* Try It Form */}
      <TryItForm
        algorithmId={algorithmId}
        algorithmName={algorithmName}
        endpoint={endpoint}
        defaultInput={defaultInput}
        description={description}
        externalInput={selectedInput?.data ?? null}
        externalInputKey={selectedInput?.tick ?? 0}
      />
    </div>
  );
}
