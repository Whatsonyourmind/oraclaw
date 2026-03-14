/**
 * ORACLE Master Store - Orchestration
 * Story 6.6
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  OracleState,
  OODAPhase,
  OODALoopRecord,
  OracleConfig,
} from '@mission-control/shared-types';

// Re-export all individual stores
export { useRadarStore, useRadarSelectors } from './radarStore';
export { useOrientStore, useOrientSelectors } from './orientStore';
export { useDecideStore, useDecideSelectors } from './decideStore';
export { useActStore, useActSelectors } from './actStore';
export { useEnvironmentStore, useEnvironmentSelectors } from './environmentStore';
export { useUXStore, useUXSelectors } from './uxStore';
export { useAdaptiveStore, useAdaptiveSelectors } from './adaptiveStore';
export { useDashboardStore, useDashboardSelectors } from './dashboardStore';

// ORACLE colors for consistent theming
export const ORACLE_COLORS = {
  observe: '#00BFFF', // Electric blue - scanning
  orient: '#FFD700', // Gold - thinking
  decide: '#FF6B6B', // Coral - decision point
  act: '#00FF88', // Matrix green - executing
  idle: '#808080', // Gray - idle
} as const;

interface OracleStoreState {
  // State
  currentPhase: OODAPhase;
  activeSignalIds: string[];
  activeContextId: string | null;
  activeDecisionId: string | null;
  activePlanId: string | null;
  loopHistory: OODALoopRecord[];
  systemConfidence: number;
  loopRunning: boolean;
  loopPaused: boolean;
  lastPhaseTransition: string;
  config: OracleConfig;
  error: string | null;

  // Actions
  transitionPhase: (phase: OODAPhase) => void;
  startLoop: () => Promise<void>;
  pauseLoop: () => void;
  resumeLoop: () => void;
  stopLoop: () => void;
  setActiveSignals: (signalIds: string[]) => void;
  setActiveContext: (contextId: string | null) => void;
  setActiveDecision: (decisionId: string | null) => void;
  setActivePlan: (planId: string | null) => void;
  addLoopRecord: (record: OODALoopRecord) => void;
  updateSystemConfidence: (confidence: number) => void;
  updateConfig: (updates: Partial<OracleConfig>) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const defaultConfig: OracleConfig = {
  scan_interval_minutes: 15,
  auto_orient_enabled: true,
  auto_decide_threshold: 0.8,
  auto_execute_enabled: false,
  ghost_action_approval_mode: 'always_ask',
  proactivity_level: 'medium',
  attention_budget: {
    total_daily_budget: 100,
    used_today: 0,
    remaining: 100,
    category_budgets: {},
    interruption_threshold: 0.7,
    focus_mode_active: false,
    last_reset: new Date().toISOString(),
  },
  notification_preferences: {
    critical_signals: true,
    decision_prompts: true,
    execution_updates: true,
    learning_summaries: false,
  },
};

const initialState = {
  currentPhase: 'idle' as OODAPhase,
  activeSignalIds: [],
  activeContextId: null,
  activeDecisionId: null,
  activePlanId: null,
  loopHistory: [],
  systemConfidence: 0.7,
  loopRunning: false,
  loopPaused: false,
  lastPhaseTransition: new Date().toISOString(),
  config: defaultConfig,
  error: null,
};

export const useOracleStore = create<OracleStoreState>()(
  persist(
    (set, get) => ({
      ...initialState,

      transitionPhase: (phase) => {
        set((state) => ({
          currentPhase: phase,
          lastPhaseTransition: new Date().toISOString(),
        }));
      },

      startLoop: async () => {
        set({
          loopRunning: true,
          loopPaused: false,
          currentPhase: 'observe',
          lastPhaseTransition: new Date().toISOString(),
          error: null,
        });

        // In production, this would:
        // 1. Call API: POST /api/oracle/loop/start
        // 2. Set up background task for autonomous loop
      },

      pauseLoop: () => {
        set({
          loopPaused: true,
        });

        // In production, call API: POST /api/oracle/loop/pause
      },

      resumeLoop: () => {
        set({
          loopPaused: false,
        });

        // In production, call API: POST /api/oracle/loop/resume
      },

      stopLoop: () => {
        set({
          loopRunning: false,
          loopPaused: false,
          currentPhase: 'idle',
          lastPhaseTransition: new Date().toISOString(),
        });

        // In production, call API: POST /api/oracle/loop/stop
      },

      setActiveSignals: (signalIds) => set({ activeSignalIds: signalIds }),

      setActiveContext: (contextId) => set({ activeContextId: contextId }),

      setActiveDecision: (decisionId) => set({ activeDecisionId: decisionId }),

      setActivePlan: (planId) => set({ activePlanId: planId }),

      addLoopRecord: (record) =>
        set((state) => ({
          loopHistory: [record, ...state.loopHistory.slice(0, 99)], // Keep last 100
        })),

      updateSystemConfidence: (confidence) =>
        set({ systemConfidence: Math.max(0, Math.min(1, confidence)) }),

      updateConfig: (updates) =>
        set((state) => ({
          config: { ...state.config, ...updates },
        })),

      setError: (error) => set({ error }),

      reset: () => set(initialState),
    }),
    {
      name: 'oracle-main-storage',
      partialize: (state) => ({
        config: state.config,
        systemConfidence: state.systemConfidence,
        loopHistory: state.loopHistory.slice(0, 20),
      }),
    }
  )
);

// Selectors
export const useOracleSelectors = {
  phaseColor: () =>
    useOracleStore((state) => ORACLE_COLORS[state.currentPhase]),

  isActive: () =>
    useOracleStore((state) => state.loopRunning && !state.loopPaused),

  hasActiveWork: () =>
    useOracleStore((state) =>
      state.activeSignalIds.length > 0 ||
      state.activeContextId !== null ||
      state.activeDecisionId !== null ||
      state.activePlanId !== null
    ),

  recentLoopRecords: () =>
    useOracleStore((state) => state.loopHistory.slice(0, 10)),

  loopStats: () =>
    useOracleStore((state) => {
      const records = state.loopHistory;
      return {
        totalLoops: records.length,
        completedLoops: records.filter((r) => r.ended_at).length,
        totalSignalsProcessed: records.reduce((sum, r) => sum + r.signals_processed, 0),
        totalDecisionsMade: records.reduce((sum, r) => sum + r.decisions_made, 0),
        totalActionsExecuted: records.reduce((sum, r) => sum + r.actions_executed, 0),
        averageConfidence:
          records.length > 0
            ? records.reduce((sum, r) => sum + r.confidence, 0) / records.length
            : 0,
      };
    }),

  proactivitySettings: () =>
    useOracleStore((state) => ({
      level: state.config.proactivity_level,
      autoOrient: state.config.auto_orient_enabled,
      autoDecideThreshold: state.config.auto_decide_threshold,
      autoExecute: state.config.auto_execute_enabled,
      ghostActionMode: state.config.ghost_action_approval_mode,
    })),
};

// Combined hook for getting ORACLE state overview
export const useOracleOverview = () => {
  const oracle = useOracleStore();

  return {
    phase: oracle.currentPhase,
    phaseColor: ORACLE_COLORS[oracle.currentPhase],
    isRunning: oracle.loopRunning,
    isPaused: oracle.loopPaused,
    confidence: oracle.systemConfidence,
    activeItems: {
      signals: oracle.activeSignalIds.length,
      hasContext: oracle.activeContextId !== null,
      hasDecision: oracle.activeDecisionId !== null,
      hasPlan: oracle.activePlanId !== null,
    },
    actions: {
      start: oracle.startLoop,
      pause: oracle.pauseLoop,
      resume: oracle.resumeLoop,
      stop: oracle.stopLoop,
      transitionPhase: oracle.transitionPhase,
    },
  };
};
