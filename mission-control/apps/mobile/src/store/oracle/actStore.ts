/**
 * ORACLE Act Store - ACT Module
 * Story 6.4
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  ExecutionPlan,
  ExecutionStep,
  CopilotState,
  Lesson,
  ExecutionOutcome,
  PlanStatus,
  StepStatus,
} from '@mission-control/shared-types';

interface ActState {
  // State
  activePlan: ExecutionPlan | null;
  plans: ExecutionPlan[];
  currentStep: ExecutionStep | null;
  copilotState: CopilotState | null;
  learnings: Lesson[];
  outcomes: ExecutionOutcome[];
  isExecuting: boolean;
  error: string | null;

  // Actions
  startPlan: (planId: string) => Promise<void>;
  completeStep: (stepId: string, notes?: string) => Promise<void>;
  reportBlocker: (stepId: string, description: string, severity: string) => Promise<void>;
  adjustPlan: (adjustment: { type: string; reason: string; changes: any }) => Promise<void>;
  recordOutcome: (outcome: Partial<ExecutionOutcome>) => Promise<void>;
  refreshCopilot: () => Promise<void>;
  setActivePlan: (plan: ExecutionPlan | null) => void;
  setPlans: (plans: ExecutionPlan[]) => void;
  addPlan: (plan: ExecutionPlan) => void;
  updatePlan: (id: string, updates: Partial<ExecutionPlan>) => void;
  setCurrentStep: (step: ExecutionStep | null) => void;
  updateStep: (stepId: string, updates: Partial<ExecutionStep>) => void;
  setCopilotState: (state: CopilotState | null) => void;
  setLearnings: (learnings: Lesson[]) => void;
  addLearning: (learning: Lesson) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initialState = {
  activePlan: null,
  plans: [],
  currentStep: null,
  copilotState: null,
  learnings: [],
  outcomes: [],
  isExecuting: false,
  error: null,
};

export const useActStore = create<ActState>()(
  persist(
    (set, get) => ({
      ...initialState,

      startPlan: async (planId) => {
        const plan = get().plans.find((p) => p.id === planId);
        if (!plan) return;

        set({
          activePlan: { ...plan, status: 'active' as PlanStatus, started_at: new Date().toISOString() },
          isExecuting: true,
        });

        // Set first pending step as current
        const steps = plan.steps || [];
        const firstStep = steps.find((s) => s.status === 'pending');
        if (firstStep) {
          set({ currentStep: { ...firstStep, status: 'in_progress' as StepStatus, started_at: new Date().toISOString() } });
        }

        // In production, call API: PATCH /api/oracle/act/plans/:id with status: 'active'
      },

      completeStep: async (stepId, notes) => {
        set((state) => {
          if (!state.activePlan) return state;

          const updatedSteps = (state.activePlan.steps || []).map((s) =>
            s.id === stepId
              ? {
                  ...s,
                  status: 'completed' as StepStatus,
                  completed_at: new Date().toISOString(),
                  notes: notes || s.notes,
                }
              : s
          );

          const completedCount = updatedSteps.filter((s) => s.status === 'completed').length;
          const progress = (completedCount / updatedSteps.length) * 100;

          // Find next pending step
          const nextStep = updatedSteps.find((s) => s.status === 'pending');

          return {
            activePlan: {
              ...state.activePlan,
              steps: updatedSteps,
              completed_steps: completedCount,
              progress_percentage: progress,
            },
            currentStep: nextStep
              ? { ...nextStep, status: 'in_progress' as StepStatus, started_at: new Date().toISOString() }
              : null,
          };
        });

        // In production, call API: PATCH /api/oracle/act/plans/:id/steps/:stepId
      },

      reportBlocker: async (stepId, description, severity) => {
        set((state) => {
          if (!state.activePlan) return state;

          const updatedSteps = (state.activePlan.steps || []).map((s) =>
            s.id === stepId
              ? {
                  ...s,
                  status: 'blocked' as StepStatus,
                  blockers: [
                    ...(s.blockers || []),
                    { description, severity: severity as any },
                  ],
                }
              : s
          );

          const blockedCount = updatedSteps.filter((s) => s.status === 'blocked').length;

          return {
            activePlan: {
              ...state.activePlan,
              steps: updatedSteps,
              blocked_steps: blockedCount,
              health_score: Math.max(0, 1 - blockedCount * 0.2),
            },
          };
        });

        // In production, call API: POST /api/oracle/act/plans/:id/blockers
      },

      adjustPlan: async (adjustment) => {
        set((state) => {
          if (!state.activePlan) return state;

          // Apply adjustment based on type
          // In production, this would be handled by the API

          return state;
        });

        // In production, call API: POST /api/oracle/act/plans/:id/adjust
      },

      recordOutcome: async (outcome) => {
        const plan = get().activePlan;
        if (!plan) return;

        const fullOutcome: ExecutionOutcome = {
          id: `outcome_${Date.now()}`,
          plan_id: plan.id,
          user_id: 'current_user',
          outcome_type: outcome.outcome_type || 'success',
          summary: outcome.summary || '',
          actual_results: outcome.actual_results || {},
          expected_results: outcome.expected_results || {},
          variance_analysis: {},
          success_factors: outcome.success_factors || [],
          failure_factors: outcome.failure_factors || [],
          recommendations: outcome.recommendations || [],
          confidence: outcome.confidence || 0.8,
          metadata: {},
          created_at: new Date().toISOString(),
        };

        set((state) => ({
          outcomes: [fullOutcome, ...state.outcomes],
          activePlan: state.activePlan
            ? {
                ...state.activePlan,
                status: 'completed' as PlanStatus,
                actual_completion: new Date().toISOString(),
              }
            : null,
          isExecuting: false,
        }));

        // In production, call API: POST /api/oracle/act/plans/:id/outcome
      },

      refreshCopilot: async () => {
        const { activePlan, currentStep } = get();
        if (!activePlan) return;

        // In production, call API: POST /api/oracle/act/plans/:id/copilot

        set({
          copilotState: {
            current_step_id: currentStep?.id,
            suggestions: [],
            health_assessment: {
              overall: 'healthy',
              issues: [],
              positives: [],
            },
            predictions: {
              completion_likelihood: 0.8,
              risk_factors: [],
            },
            last_updated: new Date().toISOString(),
          },
        });
      },

      setActivePlan: (plan) =>
        set({
          activePlan: plan,
          currentStep: plan?.steps?.find((s) => s.status === 'in_progress') || null,
        }),

      setPlans: (plans) => set({ plans }),

      addPlan: (plan) =>
        set((state) => ({
          plans: [plan, ...state.plans],
        })),

      updatePlan: (id, updates) =>
        set((state) => ({
          plans: state.plans.map((p) =>
            p.id === id ? { ...p, ...updates, updated_at: new Date().toISOString() } : p
          ),
          activePlan:
            state.activePlan?.id === id
              ? { ...state.activePlan, ...updates, updated_at: new Date().toISOString() }
              : state.activePlan,
        })),

      setCurrentStep: (step) => set({ currentStep: step }),

      updateStep: (stepId, updates) =>
        set((state) => {
          if (!state.activePlan) return state;

          return {
            activePlan: {
              ...state.activePlan,
              steps: (state.activePlan.steps || []).map((s) =>
                s.id === stepId ? { ...s, ...updates } : s
              ),
            },
            currentStep:
              state.currentStep?.id === stepId
                ? { ...state.currentStep, ...updates }
                : state.currentStep,
          };
        }),

      setCopilotState: (state) => set({ copilotState: state }),

      setLearnings: (learnings) => set({ learnings }),

      addLearning: (learning) =>
        set((state) => ({
          learnings: [learning, ...state.learnings],
        })),

      setError: (error) => set({ error }),

      reset: () => set(initialState),
    }),
    {
      name: 'oracle-act-storage',
      partialize: (state) => ({
        plans: state.plans.slice(0, 10),
        learnings: state.learnings.slice(0, 50),
      }),
    }
  )
);

// Selectors
export const useActSelectors = {
  activePlans: () =>
    useActStore((state) =>
      state.plans.filter((p) => p.status === 'active' || p.status === 'paused')
    ),

  completedPlans: () =>
    useActStore((state) =>
      state.plans.filter((p) => p.status === 'completed')
    ),

  planProgress: () =>
    useActStore((state) =>
      state.activePlan
        ? {
            completed: state.activePlan.completed_steps || 0,
            total: state.activePlan.total_steps || 0,
            blocked: state.activePlan.blocked_steps || 0,
            percentage: state.activePlan.progress_percentage || 0,
          }
        : null
    ),

  hasCopilotWarnings: () =>
    useActStore((state) =>
      (state.copilotState?.suggestions || []).some(
        (s) => s.type === 'warning' || s.priority === 'critical'
      )
    ),

  recentLearnings: () =>
    useActStore((state) => state.learnings.slice(0, 10)),

  planHealth: () =>
    useActStore((state) =>
      state.activePlan
        ? {
            score: state.activePlan.health_score || 1,
            status: state.copilotState?.health_assessment?.overall || 'healthy',
          }
        : null
    ),
};
