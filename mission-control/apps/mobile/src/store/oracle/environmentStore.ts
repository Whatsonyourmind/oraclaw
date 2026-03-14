/**
 * ORACLE Environment Store - Environment Awareness Module
 * Story 6.5
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  EnvironmentState,
  ContextGraph,
  ContextNode,
  GhostAction,
  AttentionBudget,
  GhostActionStatus,
} from '@mission-control/shared-types';

interface EnvironmentStoreState {
  // State
  currentSnapshot: EnvironmentState | null;
  contextGraph: ContextGraph | null;
  ghostActions: GhostAction[];
  attentionBudget: AttentionBudget;
  proactivityLevel: 'low' | 'medium' | 'high';
  isCapturing: boolean;
  error: string | null;

  // Actions
  captureSnapshot: () => Promise<void>;
  updateGraph: (nodes?: ContextNode[], edges?: any[]) => void;
  approveGhostAction: (actionId: string) => Promise<void>;
  rejectGhostAction: (actionId: string) => Promise<void>;
  executeGhostAction: (actionId: string) => Promise<void>;
  setProactivityLevel: (level: 'low' | 'medium' | 'high') => void;
  setCurrentSnapshot: (snapshot: EnvironmentState | null) => void;
  setContextGraph: (graph: ContextGraph | null) => void;
  setGhostActions: (actions: GhostAction[]) => void;
  addGhostAction: (action: GhostAction) => void;
  updateGhostAction: (id: string, updates: Partial<GhostAction>) => void;
  updateAttentionBudget: (updates: Partial<AttentionBudget>) => void;
  consumeAttention: (amount: number, category?: string) => void;
  resetDailyBudget: () => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const defaultAttentionBudget: AttentionBudget = {
  total_daily_budget: 100,
  used_today: 0,
  remaining: 100,
  category_budgets: {},
  interruption_threshold: 0.7,
  focus_mode_active: false,
  last_reset: new Date().toISOString(),
};

const initialState = {
  currentSnapshot: null,
  contextGraph: null,
  ghostActions: [],
  attentionBudget: defaultAttentionBudget,
  proactivityLevel: 'medium' as const,
  isCapturing: false,
  error: null,
};

export const useEnvironmentStore = create<EnvironmentStoreState>()(
  persist(
    (set, get) => ({
      ...initialState,

      captureSnapshot: async () => {
        set({ isCapturing: true, error: null });
        try {
          // In production:
          // 1. Get device state, location, battery, network
          // 2. Get calendar context
          // 3. Call API: POST /api/oracle/environment/snapshot

          const snapshot: EnvironmentState = {
            id: `snapshot_${Date.now()}`,
            user_id: 'current_user',
            snapshot_type: 'manual',
            location: {},
            device_state: {
              platform: 'react-native',
              is_foreground: true,
            },
            network_state: {
              type: 'wifi',
              is_connected: true,
            },
            calendar_context: {},
            time_context: {
              local_time: new Date().toISOString(),
              day_of_week: new Date().toLocaleDateString('en-US', { weekday: 'long' }),
            },
            active_apps: [],
            metadata: {},
            created_at: new Date().toISOString(),
          };

          set({
            currentSnapshot: snapshot,
            isCapturing: false,
          });
        } catch (error) {
          set({
            isCapturing: false,
            error: error instanceof Error ? error.message : 'Failed to capture snapshot',
          });
        }
      },

      updateGraph: (nodes, edges) => {
        set((state) => ({
          contextGraph: state.contextGraph
            ? {
                ...state.contextGraph,
                nodes: nodes || state.contextGraph.nodes,
                edges: edges || state.contextGraph.edges,
                generated_at: new Date().toISOString(),
              }
            : {
                nodes: nodes || [],
                edges: edges || [],
                depth: 2,
                generated_at: new Date().toISOString(),
              },
        }));
      },

      approveGhostAction: async (actionId) => {
        set((state) => ({
          ghostActions: state.ghostActions.map((a) =>
            a.id === actionId
              ? {
                  ...a,
                  status: 'approved' as GhostActionStatus,
                  approved_at: new Date().toISOString(),
                }
              : a
          ),
        }));

        // In production, call API: PATCH /api/oracle/environment/ghost-actions/:id
      },

      rejectGhostAction: async (actionId) => {
        set((state) => ({
          ghostActions: state.ghostActions.map((a) =>
            a.id === actionId
              ? {
                  ...a,
                  status: 'rejected' as GhostActionStatus,
                  rejected_at: new Date().toISOString(),
                }
              : a
          ),
        }));

        // In production, call API: PATCH /api/oracle/environment/ghost-actions/:id
      },

      executeGhostAction: async (actionId) => {
        const action = get().ghostActions.find((a) => a.id === actionId);
        if (!action || action.status !== 'approved') return;

        set((state) => ({
          ghostActions: state.ghostActions.map((a) =>
            a.id === actionId
              ? {
                  ...a,
                  status: 'executed' as GhostActionStatus,
                  executed_at: new Date().toISOString(),
                }
              : a
          ),
        }));

        // In production, call API: POST /api/oracle/environment/ghost-actions/:id/execute
      },

      setProactivityLevel: (level) => set({ proactivityLevel: level }),

      setCurrentSnapshot: (snapshot) => set({ currentSnapshot: snapshot }),

      setContextGraph: (graph) => set({ contextGraph: graph }),

      setGhostActions: (actions) => set({ ghostActions: actions }),

      addGhostAction: (action) =>
        set((state) => ({
          ghostActions: [action, ...state.ghostActions],
        })),

      updateGhostAction: (id, updates) =>
        set((state) => ({
          ghostActions: state.ghostActions.map((a) =>
            a.id === id ? { ...a, ...updates, updated_at: new Date().toISOString() } : a
          ),
        })),

      updateAttentionBudget: (updates) =>
        set((state) => ({
          attentionBudget: { ...state.attentionBudget, ...updates },
        })),

      consumeAttention: (amount, category) => {
        set((state) => {
          const newUsed = state.attentionBudget.used_today + amount;
          const newRemaining = Math.max(0, state.attentionBudget.total_daily_budget - newUsed);

          const categoryBudgets = { ...state.attentionBudget.category_budgets };
          if (category) {
            const cat = categoryBudgets[category] || { allocated: 20, used: 0 };
            categoryBudgets[category] = { ...cat, used: cat.used + amount };
          }

          return {
            attentionBudget: {
              ...state.attentionBudget,
              used_today: newUsed,
              remaining: newRemaining,
              category_budgets: categoryBudgets,
            },
          };
        });
      },

      resetDailyBudget: () =>
        set((state) => ({
          attentionBudget: {
            ...state.attentionBudget,
            used_today: 0,
            remaining: state.attentionBudget.total_daily_budget,
            category_budgets: Object.fromEntries(
              Object.entries(state.attentionBudget.category_budgets).map(
                ([k, v]) => [k, { ...v, used: 0 }]
              )
            ),
            last_reset: new Date().toISOString(),
          },
        })),

      setError: (error) => set({ error }),

      reset: () => set(initialState),
    }),
    {
      name: 'oracle-environment-storage',
      partialize: (state) => ({
        proactivityLevel: state.proactivityLevel,
        attentionBudget: state.attentionBudget,
      }),
    }
  )
);

// Selectors
export const useEnvironmentSelectors = {
  pendingGhostActions: () =>
    useEnvironmentStore((state) =>
      state.ghostActions.filter((a) => a.status === 'pending')
    ),

  approvedGhostActions: () =>
    useEnvironmentStore((state) =>
      state.ghostActions.filter((a) => a.status === 'approved')
    ),

  highConfidenceGhostActions: () =>
    useEnvironmentStore((state) =>
      state.ghostActions.filter((a) => a.status === 'pending' && a.confidence >= 0.8)
    ),

  attentionRemaining: () =>
    useEnvironmentStore((state) => state.attentionBudget.remaining),

  shouldInterrupt: () =>
    useEnvironmentStore((state) => {
      const { attentionBudget } = state;
      const usageRatio = attentionBudget.used_today / attentionBudget.total_daily_budget;
      return usageRatio < attentionBudget.interruption_threshold && !attentionBudget.focus_mode_active;
    }),

  contextNodeCount: () =>
    useEnvironmentStore((state) => state.contextGraph?.nodes.length || 0),

  isWorkHours: () =>
    useEnvironmentStore((state) =>
      state.currentSnapshot?.time_context?.is_work_hours ?? false
    ),
};
