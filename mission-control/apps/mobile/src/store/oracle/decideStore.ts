/**
 * ORACLE Decide Store - DECIDE Module
 * Story 6.3
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Decision,
  DecisionOption,
  SimulationResult,
  CriticalPath,
  DecisionStatus,
} from '@mission-control/shared-types';

interface DecideState {
  // State
  decisions: Decision[];
  activeDecision: Decision | null;
  activeOptions: DecisionOption[];
  simulations: Record<string, SimulationResult>; // optionId -> result
  criticalPath: CriticalPath | null;
  isSimulating: boolean;
  simulationProgress: number; // 0-100
  comparisonOptionIds: string[];
  error: string | null;

  // Actions
  createDecision: (title: string, description?: string) => Promise<Decision>;
  generateOptions: (decisionId: string) => Promise<void>;
  runSimulation: (optionId: string, iterations?: number) => Promise<void>;
  selectOption: (decisionId: string, optionId: string, rationale?: string) => Promise<void>;
  setActiveDecision: (decision: Decision | null) => void;
  setDecisions: (decisions: Decision[]) => void;
  addDecision: (decision: Decision) => void;
  updateDecision: (id: string, updates: Partial<Decision>) => void;
  setActiveOptions: (options: DecisionOption[]) => void;
  setSimulation: (optionId: string, result: SimulationResult) => void;
  setCriticalPath: (path: CriticalPath | null) => void;
  toggleComparison: (optionId: string) => void;
  clearComparison: () => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initialState = {
  decisions: [],
  activeDecision: null,
  activeOptions: [],
  simulations: {},
  criticalPath: null,
  isSimulating: false,
  simulationProgress: 0,
  comparisonOptionIds: [],
  error: null,
};

export const useDecideStore = create<DecideState>()(
  persist(
    (set, get) => ({
      ...initialState,

      createDecision: async (title, description) => {
        const decision: Decision = {
          id: `decision_${Date.now()}`,
          user_id: 'current_user',
          title,
          description,
          decision_type: 'general',
          status: 'pending',
          urgency: 'medium',
          confidence: 0.5,
          constraints: [],
          criteria: [],
          metadata: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        set((state) => ({
          decisions: [decision, ...state.decisions],
          activeDecision: decision,
        }));

        // In production, call API: POST /api/oracle/decide/decisions

        return decision;
      },

      generateOptions: async (decisionId) => {
        set({ error: null });
        try {
          // In production, call API: POST /api/oracle/decide/decisions/:id/options

          set({ activeOptions: [] });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to generate options',
          });
        }
      },

      runSimulation: async (optionId, iterations = 1000) => {
        set({ isSimulating: true, simulationProgress: 0, error: null });
        try {
          // Simulate progress updates
          const progressInterval = setInterval(() => {
            set((state) => ({
              simulationProgress: Math.min(state.simulationProgress + 10, 90),
            }));
          }, 200);

          // In production, call API: POST /api/oracle/decide/decisions/:id/options/:optionId/simulate

          clearInterval(progressInterval);
          set({
            isSimulating: false,
            simulationProgress: 100,
          });
        } catch (error) {
          set({
            isSimulating: false,
            simulationProgress: 0,
            error: error instanceof Error ? error.message : 'Simulation failed',
          });
        }
      },

      selectOption: async (decisionId, optionId, rationale) => {
        try {
          // In production, call API: PATCH /api/oracle/decide/decisions/:id/select

          set((state) => ({
            activeDecision: state.activeDecision
              ? {
                  ...state.activeDecision,
                  selected_option_id: optionId,
                  decision_rationale: rationale,
                  status: 'decided' as DecisionStatus,
                  decided_at: new Date().toISOString(),
                }
              : null,
            decisions: state.decisions.map((d) =>
              d.id === decisionId
                ? {
                    ...d,
                    selected_option_id: optionId,
                    decision_rationale: rationale,
                    status: 'decided' as DecisionStatus,
                    decided_at: new Date().toISOString(),
                  }
                : d
            ),
          }));
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to select option',
          });
        }
      },

      setActiveDecision: (decision) =>
        set({ activeDecision: decision, activeOptions: [], simulations: {}, criticalPath: null }),

      setDecisions: (decisions) => set({ decisions }),

      addDecision: (decision) =>
        set((state) => ({
          decisions: [decision, ...state.decisions],
        })),

      updateDecision: (id, updates) =>
        set((state) => ({
          decisions: state.decisions.map((d) =>
            d.id === id ? { ...d, ...updates, updated_at: new Date().toISOString() } : d
          ),
          activeDecision:
            state.activeDecision?.id === id
              ? { ...state.activeDecision, ...updates, updated_at: new Date().toISOString() }
              : state.activeDecision,
        })),

      setActiveOptions: (options) => set({ activeOptions: options }),

      setSimulation: (optionId, result) =>
        set((state) => ({
          simulations: { ...state.simulations, [optionId]: result },
        })),

      setCriticalPath: (path) => set({ criticalPath: path }),

      toggleComparison: (optionId) =>
        set((state) => {
          const ids = state.comparisonOptionIds;
          if (ids.includes(optionId)) {
            return { comparisonOptionIds: ids.filter((id) => id !== optionId) };
          }
          if (ids.length >= 3) return state; // Max 3 options for comparison
          return { comparisonOptionIds: [...ids, optionId] };
        }),

      clearComparison: () => set({ comparisonOptionIds: [] }),

      setError: (error) => set({ error }),

      reset: () => set(initialState),
    }),
    {
      name: 'oracle-decide-storage',
      partialize: (state) => ({
        decisions: state.decisions.slice(0, 20), // Keep only recent 20
      }),
    }
  )
);

// Selectors
export const useDecideSelectors = {
  pendingDecisions: () =>
    useDecideStore((state) =>
      state.decisions.filter((d) => d.status === 'pending' || d.status === 'analyzing')
    ),

  decidedDecisions: () =>
    useDecideStore((state) =>
      state.decisions.filter((d) => d.status === 'decided' || d.status === 'executed')
    ),

  recommendedOption: () =>
    useDecideStore((state) =>
      state.activeOptions.find((o) => o.is_recommended)
    ),

  comparisonOptions: () =>
    useDecideStore((state) =>
      state.activeOptions.filter((o) => state.comparisonOptionIds.includes(o.id))
    ),

  hasSimulationResults: () =>
    useDecideStore((state) => Object.keys(state.simulations).length > 0),

  optionWithSimulation: () =>
    useDecideStore((state) =>
      state.activeOptions.map((option) => ({
        ...option,
        simulation: state.simulations[option.id] || null,
      }))
    ),
};
