/**
 * ORACLE Orient Store - ORIENT Module
 * Story 6.2
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  StrategicContext,
  StrategicHorizon,
  Correlation,
  RiskOpportunityAssessment,
  HorizonType,
} from '@mission-control/shared-types';

interface OrientState {
  // State
  activeContext: StrategicContext | null;
  horizons: Record<HorizonType, StrategicHorizon | null>;
  correlations: Correlation[];
  assessments: RiskOpportunityAssessment[];
  selectedHorizon: HorizonType;
  isGenerating: boolean;
  isRefreshing: boolean;
  error: string | null;

  // Actions
  generateOrientation: (signalIds?: string[]) => Promise<void>;
  selectHorizon: (horizon: HorizonType) => void;
  refreshCorrelations: () => Promise<void>;
  setActiveContext: (context: StrategicContext | null) => void;
  setHorizon: (type: HorizonType, horizon: StrategicHorizon | null) => void;
  setAllHorizons: (horizons: Record<HorizonType, StrategicHorizon>) => void;
  setCorrelations: (correlations: Correlation[]) => void;
  setAssessments: (assessments: RiskOpportunityAssessment[]) => void;
  addAssessment: (assessment: RiskOpportunityAssessment) => void;
  updateAssessment: (id: string, updates: Partial<RiskOpportunityAssessment>) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initialState = {
  activeContext: null,
  horizons: {
    immediate: null,
    today: null,
    week: null,
    month: null,
  },
  correlations: [],
  assessments: [],
  selectedHorizon: 'today' as HorizonType,
  isGenerating: false,
  isRefreshing: false,
  error: null,
};

export const useOrientStore = create<OrientState>()(
  persist(
    (set, get) => ({
      ...initialState,

      generateOrientation: async (signalIds) => {
        set({ isGenerating: true, error: null });
        try {
          // In production, call API: POST /api/oracle/orient/generate
          // and then POST /api/oracle/orient/horizons/all

          set({
            isGenerating: false,
          });
        } catch (error) {
          set({
            isGenerating: false,
            error: error instanceof Error ? error.message : 'Failed to generate orientation',
          });
        }
      },

      selectHorizon: (horizon) => set({ selectedHorizon: horizon }),

      refreshCorrelations: async () => {
        set({ isRefreshing: true, error: null });
        try {
          // In production, call API: GET /api/oracle/orient/correlations

          set({ isRefreshing: false });
        } catch (error) {
          set({
            isRefreshing: false,
            error: error instanceof Error ? error.message : 'Failed to refresh correlations',
          });
        }
      },

      setActiveContext: (context) => set({ activeContext: context }),

      setHorizon: (type, horizon) =>
        set((state) => ({
          horizons: { ...state.horizons, [type]: horizon },
        })),

      setAllHorizons: (horizons) => set({ horizons }),

      setCorrelations: (correlations) => set({ correlations }),

      setAssessments: (assessments) => set({ assessments }),

      addAssessment: (assessment) =>
        set((state) => ({
          assessments: [assessment, ...state.assessments],
        })),

      updateAssessment: (id, updates) =>
        set((state) => ({
          assessments: state.assessments.map((a) =>
            a.id === id ? { ...a, ...updates, updated_at: new Date().toISOString() } : a
          ),
        })),

      setError: (error) => set({ error }),

      reset: () => set(initialState),
    }),
    {
      name: 'oracle-orient-storage',
      partialize: (state) => ({
        selectedHorizon: state.selectedHorizon,
      }),
    }
  )
);

// Selectors
export const useOrientSelectors = {
  currentHorizon: () =>
    useOrientStore((state) => state.horizons[state.selectedHorizon]),

  hasActiveContext: () =>
    useOrientStore((state) => state.activeContext !== null),

  risks: () =>
    useOrientStore((state) =>
      state.assessments.filter((a) => a.assessment_type === 'risk')
    ),

  opportunities: () =>
    useOrientStore((state) =>
      state.assessments.filter((a) => a.assessment_type === 'opportunity')
    ),

  criticalRisks: () =>
    useOrientStore((state) =>
      state.assessments.filter(
        (a) => a.assessment_type === 'risk' && a.impact_level === 'critical'
      )
    ),

  strongCorrelations: () =>
    useOrientStore((state) =>
      state.correlations.filter((c) => Math.abs(c.strength) > 0.7)
    ),

  horizonSummary: () =>
    useOrientStore((state) => {
      const summary: Record<HorizonType, { goals: number; actions: number; risks: number }> = {
        immediate: { goals: 0, actions: 0, risks: 0 },
        today: { goals: 0, actions: 0, risks: 0 },
        week: { goals: 0, actions: 0, risks: 0 },
        month: { goals: 0, actions: 0, risks: 0 },
      };

      (Object.keys(state.horizons) as HorizonType[]).forEach((type) => {
        const horizon = state.horizons[type];
        if (horizon) {
          summary[type] = {
            goals: horizon.goals?.length || 0,
            actions: horizon.actions?.length || 0,
            risks: horizon.risks?.length || 0,
          };
        }
      });

      return summary;
    }),
};
