/**
 * ORACLE UX Store - User Experience State Management
 * Stories ux-1 through ux-5
 *
 * Manages:
 * - UI context modes (meeting, deep work, planning, commute)
 * - Dashboard layouts and widgets
 * - Voice control settings
 * - Gesture preferences
 * - Haptic feedback settings
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Widget types available for dashboard
export type WidgetType =
  | 'priority'
  | 'signals'
  | 'decisions'
  | 'schedule'
  | 'risks'
  | 'progress'
  | 'quick-actions'
  | 'metrics';

// UI Context modes
export type UIContextMode =
  | 'meeting'
  | 'deepwork'
  | 'planning'
  | 'commute'
  | 'default';

// Dashboard widget configuration
export interface DashboardWidget {
  id: string;
  type: WidgetType;
  position: { row: number; col: number };
  size: { width: number; height: number };
  config: Record<string, unknown>;
  visible: boolean;
}

// Voice command configuration
export interface VoiceCommandConfig {
  enabled: boolean;
  wakeWordEnabled: boolean;
  feedbackMode: 'audio' | 'visual' | 'both';
  offlineCommandsEnabled: boolean;
  language: string;
}

// Gesture configuration
export interface GestureConfig {
  enabled: boolean;
  swipeThreshold: number;
  hapticEnabled: boolean;
  hapticIntensity: 'light' | 'medium' | 'heavy';
  customActions: Record<string, string>;
}

// Resolution workflow
export interface ResolutionWorkflow {
  id: string;
  name: string;
  description: string;
  steps: ResolutionStep[];
  successCount: number;
  failureCount: number;
  lastUsed: string | null;
  avgExecutionTime: number;
}

export interface ResolutionStep {
  id: string;
  type: 'api_call' | 'navigation' | 'notification' | 'update_state';
  config: Record<string, unknown>;
  rollbackConfig?: Record<string, unknown>;
}

// UX State interface
interface UXState {
  // Context
  currentContext: UIContextMode;
  contextHistory: Array<{ context: UIContextMode; timestamp: string }>;
  autoContextEnabled: boolean;
  contextOverrideUntil: string | null;

  // Dashboard
  dashboardLayout: DashboardWidget[];
  savedLayouts: Record<string, DashboardWidget[]>;
  activeLayoutName: string;
  editMode: boolean;

  // Voice
  voiceEnabled: boolean;
  voiceConfig: VoiceCommandConfig;
  voiceCommandHistory: Array<{ command: string; action: string; timestamp: string }>;
  isListening: boolean;

  // Gestures
  gesturesEnabled: boolean;
  gestureConfig: GestureConfig;

  // Haptic
  hapticEnabled: boolean;

  // Quick Resolve
  resolutionWorkflows: ResolutionWorkflow[];
  recentResolutions: Array<{ workflowId: string; timestamp: string; success: boolean }>;
  undoStack: Array<{ workflowId: string; rollbackData: unknown; expiresAt: string }>;

  // Actions
  setContext: (context: UIContextMode, override?: boolean) => void;
  setAutoContext: (enabled: boolean) => void;
  clearContextOverride: () => void;

  addWidget: (widget: DashboardWidget) => void;
  removeWidget: (widgetId: string) => void;
  updateWidget: (widgetId: string, updates: Partial<DashboardWidget>) => void;
  reorderWidgets: (widgets: DashboardWidget[]) => void;
  saveLayout: (name: string) => void;
  loadLayout: (name: string) => void;
  deleteLayout: (name: string) => void;
  setEditMode: (enabled: boolean) => void;

  setVoiceEnabled: (enabled: boolean) => void;
  updateVoiceConfig: (config: Partial<VoiceCommandConfig>) => void;
  setListening: (listening: boolean) => void;
  addVoiceCommand: (command: string, action: string) => void;

  setGesturesEnabled: (enabled: boolean) => void;
  updateGestureConfig: (config: Partial<GestureConfig>) => void;

  setHapticEnabled: (enabled: boolean) => void;

  addResolutionWorkflow: (workflow: ResolutionWorkflow) => void;
  updateResolutionStats: (workflowId: string, success: boolean, executionTime: number) => void;
  executeResolution: (workflowId: string) => Promise<boolean>;
  addToUndoStack: (workflowId: string, rollbackData: unknown) => void;
  undoResolution: () => Promise<boolean>;
  clearExpiredUndo: () => void;

  reset: () => void;
}

// Default widgets for different contexts
const DEFAULT_WIDGETS: DashboardWidget[] = [
  {
    id: 'priority-widget',
    type: 'priority',
    position: { row: 0, col: 0 },
    size: { width: 2, height: 1 },
    config: { showCount: 5 },
    visible: true,
  },
  {
    id: 'signals-widget',
    type: 'signals',
    position: { row: 1, col: 0 },
    size: { width: 1, height: 1 },
    config: { filter: 'active' },
    visible: true,
  },
  {
    id: 'decisions-widget',
    type: 'decisions',
    position: { row: 1, col: 1 },
    size: { width: 1, height: 1 },
    config: { showPending: true },
    visible: true,
  },
  {
    id: 'schedule-widget',
    type: 'schedule',
    position: { row: 2, col: 0 },
    size: { width: 2, height: 1 },
    config: { view: 'today' },
    visible: true,
  },
];

// Context-specific layout presets
const CONTEXT_LAYOUTS: Record<UIContextMode, Partial<DashboardWidget>[]> = {
  meeting: [
    { type: 'quick-actions', size: { width: 2, height: 2 } },
    { type: 'schedule', size: { width: 2, height: 1 } },
  ],
  deepwork: [
    { type: 'priority', size: { width: 2, height: 1 } },
    { type: 'progress', size: { width: 2, height: 1 } },
  ],
  planning: [
    { type: 'signals', size: { width: 1, height: 1 } },
    { type: 'decisions', size: { width: 1, height: 1 } },
    { type: 'risks', size: { width: 2, height: 1 } },
    { type: 'schedule', size: { width: 2, height: 1 } },
    { type: 'metrics', size: { width: 2, height: 1 } },
  ],
  commute: [
    { type: 'priority', size: { width: 2, height: 2 } },
    { type: 'quick-actions', size: { width: 2, height: 2 } },
  ],
  default: DEFAULT_WIDGETS,
};

// Default resolution workflows
const DEFAULT_RESOLUTION_WORKFLOWS: ResolutionWorkflow[] = [
  {
    id: 'resolve-calendar-conflict',
    name: 'Resolve Calendar Conflict',
    description: 'Automatically reschedule or decline conflicting meetings',
    steps: [
      { id: 'step-1', type: 'api_call', config: { endpoint: '/calendar/resolve-conflict' } },
      { id: 'step-2', type: 'notification', config: { message: 'Calendar conflict resolved' } },
    ],
    successCount: 0,
    failureCount: 0,
    lastUsed: null,
    avgExecutionTime: 0,
  },
  {
    id: 'snooze-deadline',
    name: 'Snooze Deadline',
    description: 'Extend deadline by configured amount',
    steps: [
      { id: 'step-1', type: 'api_call', config: { endpoint: '/tasks/extend-deadline' } },
      { id: 'step-2', type: 'update_state', config: { action: 'updateSignal' } },
    ],
    successCount: 0,
    failureCount: 0,
    lastUsed: null,
    avgExecutionTime: 0,
  },
  {
    id: 'delegate-task',
    name: 'Quick Delegate',
    description: 'Delegate task to suggested team member',
    steps: [
      { id: 'step-1', type: 'api_call', config: { endpoint: '/tasks/delegate' } },
      { id: 'step-2', type: 'notification', config: { message: 'Task delegated successfully' } },
    ],
    successCount: 0,
    failureCount: 0,
    lastUsed: null,
    avgExecutionTime: 0,
  },
  {
    id: 'mark-complete',
    name: 'Mark Complete',
    description: 'Mark item as completed with optional note',
    steps: [
      { id: 'step-1', type: 'update_state', config: { action: 'markComplete' } },
      { id: 'step-2', type: 'api_call', config: { endpoint: '/tasks/complete' } },
    ],
    successCount: 0,
    failureCount: 0,
    lastUsed: null,
    avgExecutionTime: 0,
  },
];

const initialState = {
  // Context
  currentContext: 'default' as UIContextMode,
  contextHistory: [],
  autoContextEnabled: true,
  contextOverrideUntil: null,

  // Dashboard
  dashboardLayout: DEFAULT_WIDGETS,
  savedLayouts: {
    'Default': DEFAULT_WIDGETS,
    'Meeting': CONTEXT_LAYOUTS.meeting.map((w, i) => ({
      id: `meeting-${i}`,
      ...w,
      position: { row: Math.floor(i / 2), col: i % 2 },
      config: {},
      visible: true,
    })) as DashboardWidget[],
    'Focus': CONTEXT_LAYOUTS.deepwork.map((w, i) => ({
      id: `focus-${i}`,
      ...w,
      position: { row: i, col: 0 },
      config: {},
      visible: true,
    })) as DashboardWidget[],
  },
  activeLayoutName: 'Default',
  editMode: false,

  // Voice
  voiceEnabled: false,
  voiceConfig: {
    enabled: false,
    wakeWordEnabled: false,
    feedbackMode: 'both' as const,
    offlineCommandsEnabled: true,
    language: 'en-US',
  },
  voiceCommandHistory: [],
  isListening: false,

  // Gestures
  gesturesEnabled: true,
  gestureConfig: {
    enabled: true,
    swipeThreshold: 50,
    hapticEnabled: true,
    hapticIntensity: 'medium' as const,
    customActions: {},
  },

  // Haptic
  hapticEnabled: true,

  // Quick Resolve
  resolutionWorkflows: DEFAULT_RESOLUTION_WORKFLOWS,
  recentResolutions: [],
  undoStack: [],
};

export const useUXStore = create<UXState>()(
  persist(
    (set, get) => ({
      ...initialState,

      // Context Actions
      setContext: (context, override = false) => {
        const now = new Date().toISOString();
        set((state) => ({
          currentContext: context,
          contextHistory: [
            { context, timestamp: now },
            ...state.contextHistory.slice(0, 49),
          ],
          contextOverrideUntil: override
            ? new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hour override
            : state.contextOverrideUntil,
        }));
      },

      setAutoContext: (enabled) => set({ autoContextEnabled: enabled }),

      clearContextOverride: () => set({
        contextOverrideUntil: null,
        currentContext: 'default',
      }),

      // Dashboard Actions
      addWidget: (widget) => set((state) => ({
        dashboardLayout: [...state.dashboardLayout, widget],
      })),

      removeWidget: (widgetId) => set((state) => ({
        dashboardLayout: state.dashboardLayout.filter((w) => w.id !== widgetId),
      })),

      updateWidget: (widgetId, updates) => set((state) => ({
        dashboardLayout: state.dashboardLayout.map((w) =>
          w.id === widgetId ? { ...w, ...updates } : w
        ),
      })),

      reorderWidgets: (widgets) => set({ dashboardLayout: widgets }),

      saveLayout: (name) => set((state) => ({
        savedLayouts: {
          ...state.savedLayouts,
          [name]: [...state.dashboardLayout],
        },
        activeLayoutName: name,
      })),

      loadLayout: (name) => {
        const state = get();
        const layout = state.savedLayouts[name];
        if (layout) {
          set({
            dashboardLayout: [...layout],
            activeLayoutName: name,
          });
        }
      },

      deleteLayout: (name) => set((state) => {
        const { [name]: _, ...rest } = state.savedLayouts;
        return {
          savedLayouts: rest,
          activeLayoutName: state.activeLayoutName === name ? 'Default' : state.activeLayoutName,
        };
      }),

      setEditMode: (enabled) => set({ editMode: enabled }),

      // Voice Actions
      setVoiceEnabled: (enabled) => set((state) => ({
        voiceEnabled: enabled,
        voiceConfig: { ...state.voiceConfig, enabled },
      })),

      updateVoiceConfig: (config) => set((state) => ({
        voiceConfig: { ...state.voiceConfig, ...config },
      })),

      setListening: (listening) => set({ isListening: listening }),

      addVoiceCommand: (command, action) => set((state) => ({
        voiceCommandHistory: [
          { command, action, timestamp: new Date().toISOString() },
          ...state.voiceCommandHistory.slice(0, 99),
        ],
      })),

      // Gesture Actions
      setGesturesEnabled: (enabled) => set((state) => ({
        gesturesEnabled: enabled,
        gestureConfig: { ...state.gestureConfig, enabled },
      })),

      updateGestureConfig: (config) => set((state) => ({
        gestureConfig: { ...state.gestureConfig, ...config },
      })),

      // Haptic Actions
      setHapticEnabled: (enabled) => set({ hapticEnabled: enabled }),

      // Resolution Actions
      addResolutionWorkflow: (workflow) => set((state) => ({
        resolutionWorkflows: [...state.resolutionWorkflows, workflow],
      })),

      updateResolutionStats: (workflowId, success, executionTime) => set((state) => ({
        resolutionWorkflows: state.resolutionWorkflows.map((w) => {
          if (w.id !== workflowId) return w;
          const newSuccessCount = success ? w.successCount + 1 : w.successCount;
          const newFailureCount = success ? w.failureCount : w.failureCount + 1;
          const totalCount = newSuccessCount + newFailureCount;
          const newAvgTime = (w.avgExecutionTime * (totalCount - 1) + executionTime) / totalCount;
          return {
            ...w,
            successCount: newSuccessCount,
            failureCount: newFailureCount,
            lastUsed: new Date().toISOString(),
            avgExecutionTime: newAvgTime,
          };
        }),
        recentResolutions: [
          { workflowId, timestamp: new Date().toISOString(), success },
          ...state.recentResolutions.slice(0, 49),
        ],
      })),

      executeResolution: async (workflowId) => {
        const state = get();
        const workflow = state.resolutionWorkflows.find((w) => w.id === workflowId);
        if (!workflow) return false;

        const startTime = Date.now();

        try {
          // In production, execute each step
          // For now, simulate execution
          await new Promise((resolve) => setTimeout(resolve, 500));

          const executionTime = Date.now() - startTime;
          get().updateResolutionStats(workflowId, true, executionTime);

          // Add to undo stack with 5 second expiry
          get().addToUndoStack(workflowId, { timestamp: new Date().toISOString() });

          return true;
        } catch {
          const executionTime = Date.now() - startTime;
          get().updateResolutionStats(workflowId, false, executionTime);
          return false;
        }
      },

      addToUndoStack: (workflowId, rollbackData) => set((state) => ({
        undoStack: [
          {
            workflowId,
            rollbackData,
            expiresAt: new Date(Date.now() + 5000).toISOString(), // 5 second window
          },
          ...state.undoStack,
        ],
      })),

      undoResolution: async () => {
        const state = get();
        const validUndo = state.undoStack.find(
          (u) => new Date(u.expiresAt) > new Date()
        );

        if (!validUndo) return false;

        try {
          // In production, execute rollback
          await new Promise((resolve) => setTimeout(resolve, 300));

          set((state) => ({
            undoStack: state.undoStack.filter((u) => u !== validUndo),
          }));

          return true;
        } catch {
          return false;
        }
      },

      clearExpiredUndo: () => set((state) => ({
        undoStack: state.undoStack.filter(
          (u) => new Date(u.expiresAt) > new Date()
        ),
      })),

      reset: () => set(initialState),
    }),
    {
      name: 'oracle-ux-storage',
      partialize: (state) => ({
        currentContext: state.currentContext,
        autoContextEnabled: state.autoContextEnabled,
        dashboardLayout: state.dashboardLayout,
        savedLayouts: state.savedLayouts,
        activeLayoutName: state.activeLayoutName,
        voiceEnabled: state.voiceEnabled,
        voiceConfig: state.voiceConfig,
        gesturesEnabled: state.gesturesEnabled,
        gestureConfig: state.gestureConfig,
        hapticEnabled: state.hapticEnabled,
        resolutionWorkflows: state.resolutionWorkflows,
      }),
    }
  )
);

// Selectors
export const useUXSelectors = {
  isContextOverridden: () =>
    useUXStore((state) =>
      state.contextOverrideUntil !== null &&
      new Date(state.contextOverrideUntil) > new Date()
    ),

  contextDisplayName: () =>
    useUXStore((state) => {
      const names: Record<UIContextMode, string> = {
        meeting: 'Meeting Mode',
        deepwork: 'Deep Work',
        planning: 'Planning Mode',
        commute: 'Commute Mode',
        default: 'Default',
      };
      return names[state.currentContext];
    }),

  visibleWidgets: () =>
    useUXStore((state) =>
      state.dashboardLayout.filter((w) => w.visible)
    ),

  topResolutionWorkflows: () =>
    useUXStore((state) =>
      [...state.resolutionWorkflows]
        .sort((a, b) => {
          const aScore = a.successCount / Math.max(1, a.successCount + a.failureCount);
          const bScore = b.successCount / Math.max(1, b.successCount + b.failureCount);
          return bScore - aScore;
        })
        .slice(0, 5)
    ),

  hasActiveUndo: () =>
    useUXStore((state) =>
      state.undoStack.some((u) => new Date(u.expiresAt) > new Date())
    ),

  recentVoiceCommands: () =>
    useUXStore((state) => state.voiceCommandHistory.slice(0, 10)),

  layoutNames: () =>
    useUXStore((state) => Object.keys(state.savedLayouts)),
};
