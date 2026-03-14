/**
 * ORACLE Adaptive UI Store - Context-Aware State Management
 * Story ux-3 - Adaptive UI Context System
 *
 * Manages:
 * - Context modes: meeting, deepwork, planning, commute, default
 * - Calendar-based auto-detection
 * - Manual override controls
 * - Context history tracking
 * - Mode-specific layout preferences
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Context mode types
export type ContextMode = 'meeting' | 'deepwork' | 'planning' | 'commute' | 'default';

// Context detection source
export type DetectionSource = 'calendar' | 'location' | 'time' | 'manual' | 'activity';

// Context history entry
export interface ContextHistoryEntry {
  context: ContextMode;
  timestamp: number;
  source: DetectionSource;
  duration?: number; // ms
  metadata?: Record<string, unknown>;
}

// Calendar event that can trigger context change
export interface CalendarEvent {
  id: string;
  title: string;
  startTime: number;
  endTime: number;
  type: 'meeting' | 'focus' | 'travel' | 'planning' | 'other';
  location?: string;
  attendees?: number;
}

// Context detection rule
export interface ContextRule {
  id: string;
  name: string;
  enabled: boolean;
  priority: number; // Higher = more priority
  conditions: ContextCondition[];
  targetContext: ContextMode;
}

// Context condition for rules
export interface ContextCondition {
  type: 'time_range' | 'calendar_event' | 'location' | 'activity' | 'custom';
  config: Record<string, unknown>;
}

// Mode-specific preferences
export interface ModePreferences {
  notificationsEnabled: boolean;
  notificationPriority: 'all' | 'high' | 'critical' | 'none';
  voiceEnabled: boolean;
  gesturesEnabled: boolean;
  dashboardLayout: string; // Layout name from dashboard store
  autoAdvanceEnabled: boolean;
  transitionDuration: number; // ms
}

// Adaptive State interface
export interface AdaptiveState {
  // Current context
  currentContext: ContextMode;
  previousContext: ContextMode | null;
  contextStartTime: number;

  // Auto-detection
  autoDetect: boolean;
  detectionRules: ContextRule[];
  activeCalendarEvents: CalendarEvent[];
  lastDetectionCheck: number;
  detectionInterval: number; // ms

  // Override
  manualOverride: boolean;
  overrideExpiresAt: number | null;

  // History
  contextHistory: ContextHistoryEntry[];

  // Mode preferences
  modePreferences: Record<ContextMode, ModePreferences>;

  // Transition
  isTransitioning: boolean;
  transitionProgress: number;

  // Actions
  setContext: (context: ContextMode, source: DetectionSource, metadata?: Record<string, unknown>) => void;
  setAutoDetect: (enabled: boolean) => void;
  setManualOverride: (context: ContextMode, durationMs?: number) => void;
  clearOverride: () => void;

  addCalendarEvent: (event: CalendarEvent) => void;
  removeCalendarEvent: (eventId: string) => void;
  updateCalendarEvents: (events: CalendarEvent[]) => void;

  addDetectionRule: (rule: ContextRule) => void;
  updateDetectionRule: (ruleId: string, updates: Partial<ContextRule>) => void;
  removeDetectionRule: (ruleId: string) => void;

  updateModePreferences: (mode: ContextMode, preferences: Partial<ModePreferences>) => void;

  detectContext: () => ContextMode;
  runAutoDetection: () => void;

  startTransition: () => void;
  updateTransitionProgress: (progress: number) => void;
  endTransition: () => void;

  getContextDuration: () => number;
  getContextStats: () => Record<ContextMode, { totalTime: number; count: number }>;

  reset: () => void;
}

// Default mode preferences
const DEFAULT_MODE_PREFERENCES: Record<ContextMode, ModePreferences> = {
  meeting: {
    notificationsEnabled: true,
    notificationPriority: 'critical',
    voiceEnabled: false,
    gesturesEnabled: true,
    dashboardLayout: 'Meeting',
    autoAdvanceEnabled: false,
    transitionDuration: 300,
  },
  deepwork: {
    notificationsEnabled: false,
    notificationPriority: 'critical',
    voiceEnabled: false,
    gesturesEnabled: false,
    dashboardLayout: 'Focus',
    autoAdvanceEnabled: true,
    transitionDuration: 500,
  },
  planning: {
    notificationsEnabled: true,
    notificationPriority: 'high',
    voiceEnabled: true,
    gesturesEnabled: true,
    dashboardLayout: 'Planning',
    autoAdvanceEnabled: true,
    transitionDuration: 400,
  },
  commute: {
    notificationsEnabled: true,
    notificationPriority: 'high',
    voiceEnabled: true,
    gesturesEnabled: true,
    dashboardLayout: 'Commute',
    autoAdvanceEnabled: false,
    transitionDuration: 300,
  },
  default: {
    notificationsEnabled: true,
    notificationPriority: 'all',
    voiceEnabled: true,
    gesturesEnabled: true,
    dashboardLayout: 'Default',
    autoAdvanceEnabled: true,
    transitionDuration: 400,
  },
};

// Default detection rules
const DEFAULT_DETECTION_RULES: ContextRule[] = [
  {
    id: 'rule-meeting-calendar',
    name: 'Meeting from Calendar',
    enabled: true,
    priority: 100,
    conditions: [
      {
        type: 'calendar_event',
        config: { eventType: 'meeting', attendeesMin: 1 },
      },
    ],
    targetContext: 'meeting',
  },
  {
    id: 'rule-focus-calendar',
    name: 'Focus Time from Calendar',
    enabled: true,
    priority: 90,
    conditions: [
      {
        type: 'calendar_event',
        config: { eventType: 'focus' },
      },
    ],
    targetContext: 'deepwork',
  },
  {
    id: 'rule-commute-time',
    name: 'Commute Hours',
    enabled: true,
    priority: 50,
    conditions: [
      {
        type: 'time_range',
        config: {
          ranges: [
            { start: '07:00', end: '09:00' },
            { start: '17:00', end: '19:00' },
          ],
          weekdaysOnly: true,
        },
      },
    ],
    targetContext: 'commute',
  },
  {
    id: 'rule-planning-morning',
    name: 'Morning Planning',
    enabled: true,
    priority: 40,
    conditions: [
      {
        type: 'time_range',
        config: {
          ranges: [{ start: '09:00', end: '10:00' }],
          weekdaysOnly: true,
        },
      },
    ],
    targetContext: 'planning',
  },
];

const initialState = {
  currentContext: 'default' as ContextMode,
  previousContext: null as ContextMode | null,
  contextStartTime: Date.now(),

  autoDetect: true,
  detectionRules: DEFAULT_DETECTION_RULES,
  activeCalendarEvents: [] as CalendarEvent[],
  lastDetectionCheck: 0,
  detectionInterval: 60000, // 1 minute

  manualOverride: false,
  overrideExpiresAt: null as number | null,

  contextHistory: [] as ContextHistoryEntry[],

  modePreferences: DEFAULT_MODE_PREFERENCES,

  isTransitioning: false,
  transitionProgress: 0,
};

/**
 * Adaptive UI Store
 * Manages context-aware UI state with auto-detection and manual overrides
 */
export const useAdaptiveStore = create<AdaptiveState>()(
  persist(
    (set, get) => ({
      ...initialState,

      /**
       * Set the current context mode
       * Time Complexity: O(1)
       */
      setContext: (context, source, metadata) => {
        const state = get();
        const now = Date.now();

        // Don't change if same context
        if (state.currentContext === context) return;

        // Calculate duration of previous context
        const previousDuration = now - state.contextStartTime;

        // Add to history
        const historyEntry: ContextHistoryEntry = {
          context: state.currentContext,
          timestamp: state.contextStartTime,
          source: source,
          duration: previousDuration,
          metadata,
        };

        set({
          previousContext: state.currentContext,
          currentContext: context,
          contextStartTime: now,
          contextHistory: [historyEntry, ...state.contextHistory.slice(0, 99)],
        });
      },

      /**
       * Enable/disable auto-detection
       */
      setAutoDetect: (enabled) => set({ autoDetect: enabled }),

      /**
       * Set manual override with optional expiration
       * @param context - Target context
       * @param durationMs - Override duration in ms (default: 1 hour)
       */
      setManualOverride: (context, durationMs = 3600000) => {
        const now = Date.now();
        set({
          manualOverride: true,
          overrideExpiresAt: now + durationMs,
        });
        get().setContext(context, 'manual');
      },

      /**
       * Clear manual override and return to auto-detection
       */
      clearOverride: () => {
        set({
          manualOverride: false,
          overrideExpiresAt: null,
        });

        // Run detection to set appropriate context
        if (get().autoDetect) {
          get().runAutoDetection();
        }
      },

      /**
       * Add a calendar event for context detection
       */
      addCalendarEvent: (event) => set((state) => ({
        activeCalendarEvents: [...state.activeCalendarEvents, event],
      })),

      /**
       * Remove a calendar event
       */
      removeCalendarEvent: (eventId) => set((state) => ({
        activeCalendarEvents: state.activeCalendarEvents.filter((e) => e.id !== eventId),
      })),

      /**
       * Update all calendar events (batch update)
       */
      updateCalendarEvents: (events) => set({ activeCalendarEvents: events }),

      /**
       * Add a detection rule
       */
      addDetectionRule: (rule) => set((state) => ({
        detectionRules: [...state.detectionRules, rule],
      })),

      /**
       * Update a detection rule
       */
      updateDetectionRule: (ruleId, updates) => set((state) => ({
        detectionRules: state.detectionRules.map((r) =>
          r.id === ruleId ? { ...r, ...updates } : r
        ),
      })),

      /**
       * Remove a detection rule
       */
      removeDetectionRule: (ruleId) => set((state) => ({
        detectionRules: state.detectionRules.filter((r) => r.id !== ruleId),
      })),

      /**
       * Update mode-specific preferences
       */
      updateModePreferences: (mode, preferences) => set((state) => ({
        modePreferences: {
          ...state.modePreferences,
          [mode]: { ...state.modePreferences[mode], ...preferences },
        },
      })),

      /**
       * Detect appropriate context based on rules and calendar
       * Time Complexity: O(n * m) where n = rules, m = conditions per rule
       * @returns Detected context mode
       */
      detectContext: (): ContextMode => {
        const state = get();
        const now = Date.now();
        const currentTime = new Date();

        // Sort rules by priority (higher first)
        const sortedRules = [...state.detectionRules]
          .filter((r) => r.enabled)
          .sort((a, b) => b.priority - a.priority);

        for (const rule of sortedRules) {
          let allConditionsMet = true;

          for (const condition of rule.conditions) {
            if (!evaluateCondition(condition, state.activeCalendarEvents, currentTime, now)) {
              allConditionsMet = false;
              break;
            }
          }

          if (allConditionsMet) {
            return rule.targetContext;
          }
        }

        return 'default';
      },

      /**
       * Run auto-detection and update context if needed
       */
      runAutoDetection: () => {
        const state = get();

        // Check if override is still active
        if (state.manualOverride && state.overrideExpiresAt) {
          if (Date.now() < state.overrideExpiresAt) {
            return; // Override still active
          }
          // Override expired, clear it
          set({ manualOverride: false, overrideExpiresAt: null });
        }

        if (!state.autoDetect) return;

        const detectedContext = get().detectContext();

        if (detectedContext !== state.currentContext) {
          get().startTransition();
          get().setContext(detectedContext, 'calendar');
        }

        set({ lastDetectionCheck: Date.now() });
      },

      /**
       * Start context transition animation
       */
      startTransition: () => set({ isTransitioning: true, transitionProgress: 0 }),

      /**
       * Update transition animation progress
       */
      updateTransitionProgress: (progress) => set({ transitionProgress: Math.min(1, Math.max(0, progress)) }),

      /**
       * End context transition animation
       */
      endTransition: () => set({ isTransitioning: false, transitionProgress: 1 }),

      /**
       * Get duration of current context in ms
       */
      getContextDuration: (): number => {
        return Date.now() - get().contextStartTime;
      },

      /**
       * Get statistics for each context mode
       * Time Complexity: O(n) where n = history entries
       */
      getContextStats: (): Record<ContextMode, { totalTime: number; count: number }> => {
        const state = get();
        const stats: Record<ContextMode, { totalTime: number; count: number }> = {
          meeting: { totalTime: 0, count: 0 },
          deepwork: { totalTime: 0, count: 0 },
          planning: { totalTime: 0, count: 0 },
          commute: { totalTime: 0, count: 0 },
          default: { totalTime: 0, count: 0 },
        };

        for (const entry of state.contextHistory) {
          if (entry.duration) {
            stats[entry.context].totalTime += entry.duration;
            stats[entry.context].count += 1;
          }
        }

        // Add current context time
        stats[state.currentContext].totalTime += get().getContextDuration();
        stats[state.currentContext].count += 1;

        return stats;
      },

      /**
       * Reset store to initial state
       */
      reset: () => set(initialState),
    }),
    {
      name: 'oracle-adaptive-storage',
      partialize: (state) => ({
        autoDetect: state.autoDetect,
        detectionRules: state.detectionRules,
        modePreferences: state.modePreferences,
        contextHistory: state.contextHistory.slice(0, 50),
      }),
    }
  )
);

/**
 * Evaluate a single condition
 * @param condition - Condition to evaluate
 * @param events - Active calendar events
 * @param currentTime - Current Date object
 * @param now - Current timestamp in ms
 * @returns Whether the condition is met
 */
function evaluateCondition(
  condition: ContextCondition,
  events: CalendarEvent[],
  currentTime: Date,
  now: number
): boolean {
  switch (condition.type) {
    case 'calendar_event': {
      const config = condition.config as { eventType?: string; attendeesMin?: number };
      const activeEvent = events.find((e) => {
        const isActive = now >= e.startTime && now <= e.endTime;
        const typeMatches = !config.eventType || e.type === config.eventType;
        const hasEnoughAttendees = !config.attendeesMin || (e.attendees || 0) >= config.attendeesMin;
        return isActive && typeMatches && hasEnoughAttendees;
      });
      return !!activeEvent;
    }

    case 'time_range': {
      const config = condition.config as {
        ranges: Array<{ start: string; end: string }>;
        weekdaysOnly?: boolean;
      };

      // Check weekday condition
      const dayOfWeek = currentTime.getDay();
      if (config.weekdaysOnly && (dayOfWeek === 0 || dayOfWeek === 6)) {
        return false;
      }

      // Check time ranges
      const currentHour = currentTime.getHours();
      const currentMinute = currentTime.getMinutes();
      const currentMinutes = currentHour * 60 + currentMinute;

      for (const range of config.ranges) {
        const [startHour, startMin] = range.start.split(':').map(Number);
        const [endHour, endMin] = range.end.split(':').map(Number);
        const startMinutes = startHour * 60 + startMin;
        const endMinutes = endHour * 60 + endMin;

        if (currentMinutes >= startMinutes && currentMinutes <= endMinutes) {
          return true;
        }
      }
      return false;
    }

    case 'location':
    case 'activity':
    case 'custom':
    default:
      // These would require platform-specific implementations
      return false;
  }
}

// Selectors
export const useAdaptiveSelectors = {
  currentModePreferences: () =>
    useAdaptiveStore((state) => state.modePreferences[state.currentContext]),

  isOverrideActive: () =>
    useAdaptiveStore((state) =>
      state.manualOverride &&
      state.overrideExpiresAt !== null &&
      Date.now() < state.overrideExpiresAt
    ),

  overrideTimeRemaining: () =>
    useAdaptiveStore((state) => {
      if (!state.manualOverride || !state.overrideExpiresAt) return 0;
      const remaining = state.overrideExpiresAt - Date.now();
      return Math.max(0, remaining);
    }),

  contextDisplayInfo: () =>
    useAdaptiveStore((state) => {
      const displayNames: Record<ContextMode, { name: string; icon: string; color: string }> = {
        meeting: { name: 'Meeting Mode', icon: 'people', color: '#FF6B6B' },
        deepwork: { name: 'Deep Work', icon: 'code', color: '#00BFFF' },
        planning: { name: 'Planning', icon: 'calendar', color: '#FFD700' },
        commute: { name: 'Commute', icon: 'car', color: '#9B59B6' },
        default: { name: 'Default', icon: 'apps', color: '#00FF88' },
      };
      return displayNames[state.currentContext];
    }),

  activeCalendarEventCount: () =>
    useAdaptiveStore((state) => {
      const now = Date.now();
      return state.activeCalendarEvents.filter(
        (e) => now >= e.startTime && now <= e.endTime
      ).length;
    }),

  enabledRulesCount: () =>
    useAdaptiveStore((state) => state.detectionRules.filter((r) => r.enabled).length),
};

export default useAdaptiveStore;
