/**
 * ORACLE Watch UI Definitions
 * Stories watch-3, watch-4 - Watch app main screen and notification handling
 */

import {
  OODAPhase,
  OODA_COLORS,
  OODA_ICONS,
  SignalUrgency,
  URGENCY_COLORS,
  WatchSignal,
  WatchStep,
  WatchGhostAction,
  WatchOracleState,
  QuickAction,
  DEFAULT_QUICK_ACTIONS,
  WatchNotification,
  WatchNotificationType,
  StepStatus,
  STEP_STATUS_COLORS,
} from './types';
import { watchBridge, WatchMessageType } from './WatchBridge';

// ============================================================================
// MAIN SCREEN DATA
// ============================================================================

export interface MainScreenData {
  // Header
  currentPhase: OODAPhase;
  phaseColor: string;
  phaseIcon: string;

  // Signal summary (top 3)
  topSignals: {
    id: string;
    title: string;
    urgency: SignalUrgency;
    urgencyColor: string;
  }[];

  // Current step (swipeable)
  currentStep: {
    id: string;
    title: string;
    status: StepStatus;
    statusColor: string;
    estimatedMinutes?: number;
  } | null;

  // Quick actions
  quickActions: QuickAction[];

  // Status bar
  systemConfidence: number;
  isConnected: boolean;
  lastSyncTime: string;
}

/**
 * Generate main screen data from watch state
 */
export function generateMainScreenData(
  state: WatchOracleState,
  isConnected: boolean
): MainScreenData {
  // Top 3 signals sorted by urgency
  const urgencyOrder: SignalUrgency[] = ['critical', 'high', 'medium', 'low'];
  const topSignals = [...state.topSignals]
    .sort((a, b) => urgencyOrder.indexOf(a.urgency) - urgencyOrder.indexOf(b.urgency))
    .slice(0, 3)
    .map(signal => ({
      id: signal.id,
      title: signal.title,
      urgency: signal.urgency,
      urgencyColor: URGENCY_COLORS[signal.urgency],
    }));

  // Current step
  const currentStep = state.currentStep
    ? {
        id: state.currentStep.id,
        title: state.currentStep.title,
        status: state.currentStep.status,
        statusColor: STEP_STATUS_COLORS[state.currentStep.status],
        estimatedMinutes: state.currentStep.estimatedMinutes,
      }
    : null;

  // Quick actions based on state
  const quickActions: QuickAction[] = DEFAULT_QUICK_ACTIONS.map(action => {
    switch (action.type) {
      case 'approve_ghost':
        return {
          ...action,
          enabled: state.pendingGhostActions.length > 0,
          payload: state.pendingGhostActions[0]?.id,
        };
      case 'complete_step':
        return {
          ...action,
          enabled: currentStep !== null && currentStep.status === 'in_progress',
          payload: currentStep?.id,
        };
      case 'pause_loop':
        return {
          ...action,
          enabled: state.currentPhase !== 'idle',
        };
      default:
        return action;
    }
  });

  // Format last sync time
  const syncAgo = Date.now() - state.lastSyncedAt;
  const syncMinutes = Math.floor(syncAgo / 60000);
  const lastSyncTime =
    syncMinutes < 1
      ? 'Just now'
      : syncMinutes < 60
      ? `${syncMinutes}m ago`
      : `${Math.floor(syncMinutes / 60)}h ago`;

  return {
    currentPhase: state.currentPhase,
    phaseColor: OODA_COLORS[state.currentPhase],
    phaseIcon: OODA_ICONS[state.currentPhase],
    topSignals,
    currentStep,
    quickActions,
    systemConfidence: state.systemConfidence,
    isConnected,
    lastSyncTime,
  };
}

// ============================================================================
// FORCE TOUCH MENU
// ============================================================================

export interface ForceTouchMenuItem {
  id: string;
  title: string;
  icon: string;
  enabled: boolean;
}

export const FORCE_TOUCH_MENU: ForceTouchMenuItem[] = [
  { id: 'scan', title: 'Radar Scan', icon: 'antenna.radiowaves.left.and.right', enabled: true },
  { id: 'refresh', title: 'Refresh', icon: 'arrow.clockwise', enabled: true },
  { id: 'settings', title: 'Settings', icon: 'gear', enabled: true },
  { id: 'help', title: 'Help', icon: 'questionmark.circle', enabled: true },
];

// ============================================================================
// NOTIFICATION HANDLING
// ============================================================================

export interface NotificationAction {
  id: string;
  title: string;
  destructive: boolean;
  handler: (notificationId: string, payload: any) => Promise<void>;
}

export interface NotificationCategory {
  id: string;
  actions: NotificationAction[];
  hiddenPreviewsBodyPlaceholder: string;
}

/**
 * Notification categories for different ORACLE events
 */
export const NOTIFICATION_CATEGORIES: NotificationCategory[] = [
  {
    id: 'signal_critical',
    actions: [
      {
        id: 'investigate',
        title: 'Investigate',
        destructive: false,
        handler: async (notificationId, payload) => {
          // Open signal details
          console.log('[WatchNotification] Investigate signal:', payload.signalId);
        },
      },
      {
        id: 'dismiss',
        title: 'Dismiss',
        destructive: true,
        handler: async (notificationId, payload) => {
          await watchBridge.sendToWatch('DISMISS_SIGNAL', { signalId: payload.signalId });
        },
      },
    ],
    hiddenPreviewsBodyPlaceholder: 'Critical signal detected',
  },
  {
    id: 'ghost_action',
    actions: [
      {
        id: 'approve',
        title: 'Approve',
        destructive: false,
        handler: async (notificationId, payload) => {
          await watchBridge.sendToWatch('APPROVE_ACTION', { actionId: payload.actionId });
        },
      },
      {
        id: 'reject',
        title: 'Reject',
        destructive: true,
        handler: async (notificationId, payload) => {
          // Reject ghost action
          console.log('[WatchNotification] Reject action:', payload.actionId);
        },
      },
    ],
    hiddenPreviewsBodyPlaceholder: 'Action ready for approval',
  },
  {
    id: 'step_reminder',
    actions: [
      {
        id: 'complete',
        title: 'Complete',
        destructive: false,
        handler: async (notificationId, payload) => {
          await watchBridge.sendToWatch('COMPLETE_STEP', { stepId: payload.stepId });
        },
      },
      {
        id: 'skip',
        title: 'Skip',
        destructive: false,
        handler: async (notificationId, payload) => {
          // Skip step
          console.log('[WatchNotification] Skip step:', payload.stepId);
        },
      },
    ],
    hiddenPreviewsBodyPlaceholder: 'Step reminder',
  },
];

/**
 * Generate a watch notification from ORACLE event
 */
export function generateWatchNotification(
  type: WatchNotificationType,
  title: string,
  body: string,
  payload: any
): WatchNotification {
  const category = NOTIFICATION_CATEGORIES.find(c => c.id === type);

  return {
    id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type,
    title,
    body,
    actionable: category !== undefined,
    actions: category?.actions.map(a => ({
      id: a.id,
      title: a.title,
      destructive: a.destructive,
    })),
    payload,
  };
}

/**
 * Generate notification for critical signal
 */
export function generateSignalNotification(signal: WatchSignal): WatchNotification {
  const isCritical = signal.urgency === 'critical';

  return generateWatchNotification(
    isCritical ? 'signal_critical' : 'signal_high',
    `${signal.urgency.toUpperCase()} Signal`,
    signal.title,
    { signalId: signal.id }
  );
}

/**
 * Generate notification for ghost action
 */
export function generateGhostActionNotification(action: WatchGhostAction): WatchNotification {
  return generateWatchNotification(
    'ghost_action_ready',
    'Action Ready',
    action.title,
    { actionId: action.id, actionType: action.type }
  );
}

/**
 * Generate notification for step completion reminder
 */
export function generateStepNotification(step: WatchStep): WatchNotification {
  return generateWatchNotification(
    'step_reminder',
    'Step Reminder',
    step.title,
    { stepId: step.id }
  );
}

// ============================================================================
// HAPTIC FEEDBACK
// ============================================================================

export type HapticType =
  | 'notification'
  | 'directionUp'
  | 'directionDown'
  | 'success'
  | 'failure'
  | 'retry'
  | 'start'
  | 'stop'
  | 'click';

export interface HapticPattern {
  type: HapticType;
  delay?: number;
}

/**
 * Haptic patterns for different events
 */
export const HAPTIC_PATTERNS: Record<string, HapticPattern[]> = {
  signal_critical: [
    { type: 'notification' },
    { type: 'notification', delay: 200 },
    { type: 'notification', delay: 200 },
  ],
  signal_high: [
    { type: 'notification' },
    { type: 'notification', delay: 300 },
  ],
  ghost_action_ready: [
    { type: 'directionUp' },
    { type: 'success', delay: 150 },
  ],
  step_completed: [
    { type: 'success' },
  ],
  plan_blocked: [
    { type: 'failure' },
    { type: 'retry', delay: 200 },
  ],
  phase_change: [
    { type: 'click' },
  ],
  scan_start: [
    { type: 'start' },
  ],
  scan_complete: [
    { type: 'stop' },
  ],
};

/**
 * Get haptic pattern for notification type
 */
export function getHapticPattern(type: WatchNotificationType | string): HapticPattern[] {
  return HAPTIC_PATTERNS[type] || [{ type: 'notification' }];
}

// ============================================================================
// SWIPE NAVIGATION
// ============================================================================

export interface SwipeScreen {
  id: string;
  title: string;
  type: 'signals' | 'step' | 'actions' | 'settings';
}

export const SWIPE_SCREENS: SwipeScreen[] = [
  { id: 'signals', title: 'Signals', type: 'signals' },
  { id: 'step', title: 'Current Step', type: 'step' },
  { id: 'actions', title: 'Ghost Actions', type: 'actions' },
];

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  generateMainScreenData,
  generateWatchNotification,
  generateSignalNotification,
  generateGhostActionNotification,
  generateStepNotification,
  getHapticPattern,
  FORCE_TOUCH_MENU,
  NOTIFICATION_CATEGORIES,
  HAPTIC_PATTERNS,
  SWIPE_SCREENS,
};
