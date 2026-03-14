/**
 * ORACLE Watch Types
 * Story watch-1 - Shared types for Watch communication
 */

// ============================================================================
// OODA PHASE
// ============================================================================

export type OODAPhase = 'observe' | 'orient' | 'decide' | 'act' | 'idle';

export const OODA_COLORS: Record<OODAPhase, string> = {
  observe: '#00BFFF',
  orient: '#FFD700',
  decide: '#FF6B6B',
  act: '#00FF88',
  idle: '#808080',
};

export const OODA_ICONS: Record<OODAPhase, string> = {
  observe: 'eye',
  orient: 'compass',
  decide: 'checkmark.circle',
  act: 'play.fill',
  idle: 'pause.fill',
};

// ============================================================================
// SIGNAL
// ============================================================================

export type SignalUrgency = 'critical' | 'high' | 'medium' | 'low';

export interface WatchSignal {
  id: string;
  title: string;
  urgency: SignalUrgency;
  type?: string;
  timestamp: number;
}

export const URGENCY_COLORS: Record<SignalUrgency, string> = {
  critical: '#FF0000',
  high: '#FF4444',
  medium: '#FFA500',
  low: '#00FF88',
};

// ============================================================================
// EXECUTION STEP
// ============================================================================

export type StepStatus = 'pending' | 'in_progress' | 'completed' | 'blocked' | 'skipped';

export interface WatchStep {
  id: string;
  title: string;
  status: StepStatus;
  orderIndex: number;
  estimatedMinutes?: number;
}

export const STEP_STATUS_COLORS: Record<StepStatus, string> = {
  pending: '#808080',
  in_progress: '#00BFFF',
  completed: '#00FF88',
  blocked: '#FF4444',
  skipped: '#666666',
};

// ============================================================================
// GHOST ACTION
// ============================================================================

export type GhostActionType =
  | 'send_message'
  | 'schedule_meeting'
  | 'create_task'
  | 'send_email'
  | 'set_reminder'
  | 'update_status';

export interface WatchGhostAction {
  id: string;
  title: string;
  type: GhostActionType;
  confidence: number;
  rationale?: string;
}

// ============================================================================
// COMPLICATION DATA
// ============================================================================

export interface ComplicationData {
  // Current phase
  phase: OODAPhase;
  phaseColor: string;

  // Signals
  signalCount: number;
  topSignalTitle: string | null;
  topSignalUrgency: SignalUrgency | null;

  // Plan progress
  planProgress: number; // 0-100
  currentStepTitle: string | null;

  // Pending items
  pendingGhostActions: number;

  // Next scheduled action
  nextActionTitle: string | null;
  nextActionTime: number | null;

  // Metadata
  lastUpdated: number;
}

// ============================================================================
// WATCH STATE
// ============================================================================

export interface WatchOracleState {
  // Phase
  currentPhase: OODAPhase;

  // Top signals (max 3 for watch display)
  topSignals: WatchSignal[];

  // Current plan
  currentPlan?: {
    id: string;
    title: string;
    progress: number;
    totalSteps: number;
    completedSteps: number;
  };

  // Current step
  currentStep?: WatchStep;

  // Ghost actions awaiting approval
  pendingGhostActions: WatchGhostAction[];

  // System status
  systemConfidence: number;

  // Timestamps
  lastUpdated: number;
  lastSyncedAt: number;
}

// ============================================================================
// QUICK ACTIONS
// ============================================================================

export type QuickActionType =
  | 'scan'
  | 'approve_ghost'
  | 'complete_step'
  | 'dismiss_signal'
  | 'pause_loop'
  | 'resume_loop';

export interface QuickAction {
  type: QuickActionType;
  label: string;
  icon: string;
  enabled: boolean;
  payload?: any;
}

export const DEFAULT_QUICK_ACTIONS: QuickAction[] = [
  { type: 'scan', label: 'Scan', icon: 'antenna.radiowaves.left.and.right', enabled: true },
  { type: 'approve_ghost', label: 'Approve', icon: 'checkmark.circle', enabled: false },
  { type: 'complete_step', label: 'Complete', icon: 'checkmark', enabled: false },
  { type: 'pause_loop', label: 'Pause', icon: 'pause', enabled: true },
];

// ============================================================================
// NOTIFICATION TYPES
// ============================================================================

export type WatchNotificationType =
  | 'signal_critical'
  | 'signal_high'
  | 'ghost_action_ready'
  | 'step_reminder'
  | 'plan_blocked'
  | 'phase_change';

export interface WatchNotification {
  id: string;
  type: WatchNotificationType;
  title: string;
  body: string;
  actionable: boolean;
  actions?: {
    id: string;
    title: string;
    destructive?: boolean;
  }[];
  payload?: any;
}

// ============================================================================
// SETTINGS
// ============================================================================

export interface WatchSettings {
  // Notifications
  enableNotifications: boolean;
  criticalSignalsOnly: boolean;
  hapticFeedback: boolean;

  // Display
  showConfidenceScores: boolean;
  compactMode: boolean;

  // Sync
  syncInterval: number; // seconds
  backgroundRefresh: boolean;
}

export const DEFAULT_WATCH_SETTINGS: WatchSettings = {
  enableNotifications: true,
  criticalSignalsOnly: false,
  hapticFeedback: true,
  showConfidenceScores: true,
  compactMode: false,
  syncInterval: 300, // 5 minutes
  backgroundRefresh: true,
};
