import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import type { Signal, GhostAction } from '@mission-control/shared-types';

// ==========================================
// Notification Channel Configuration
// ==========================================

export const NOTIFICATION_CHANNELS = {
  SIGNALS_CRITICAL: 'oracle-signals-critical',
  SIGNALS_HIGH: 'oracle-signals-high',
  SIGNALS_MEDIUM: 'oracle-signals-medium',
  GHOST_ACTIONS: 'oracle-ghost-actions',
  COPILOT: 'oracle-copilot',
  SYSTEM: 'oracle-system',
} as const;

const CHANNEL_CONFIGS: Record<string, Notifications.AndroidNotificationChannelInput> = {
  [NOTIFICATION_CHANNELS.SIGNALS_CRITICAL]: {
    name: 'Critical Signals',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#FF6B6B',
    sound: 'signal.wav',
    description: 'Urgent signals requiring immediate attention',
  },
  [NOTIFICATION_CHANNELS.SIGNALS_HIGH]: {
    name: 'High Priority Signals',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 250],
    lightColor: '#FFD700',
    description: 'High priority signals and alerts',
  },
  [NOTIFICATION_CHANNELS.SIGNALS_MEDIUM]: {
    name: 'Medium Priority Signals',
    importance: Notifications.AndroidImportance.LOW,
    lightColor: '#00BFFF',
    description: 'Standard signal notifications',
  },
  [NOTIFICATION_CHANNELS.GHOST_ACTIONS]: {
    name: 'Ghost Actions',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 100, 100, 100],
    lightColor: '#00FF88',
    description: 'Pre-prepared actions ready for approval',
  },
  [NOTIFICATION_CHANNELS.COPILOT]: {
    name: 'Copilot Guidance',
    importance: Notifications.AndroidImportance.LOW,
    lightColor: '#00FF88',
    description: 'Execution guidance and suggestions',
  },
  [NOTIFICATION_CHANNELS.SYSTEM]: {
    name: 'System',
    importance: Notifications.AndroidImportance.MIN,
    description: 'ORACLE system notifications',
  },
};

// ==========================================
// Notification Configuration
// ==========================================

// Configure how notifications are handled when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// ==========================================
// Types
// ==========================================

export interface NotificationPayload {
  type: 'signal' | 'ghost_action' | 'copilot' | 'system';
  id: string;
  route?: string;
  params?: Record<string, string>;
}

export interface PermissionStatus {
  granted: boolean;
  canAskAgain: boolean;
  status: Notifications.PermissionStatus;
}

// ==========================================
// Initialization
// ==========================================

let notificationListener: Notifications.Subscription | null = null;
let responseListener: Notifications.Subscription | null = null;

/**
 * Initialize the notification service
 * Should be called early in app lifecycle
 */
export async function initializeNotifications(): Promise<boolean> {
  try {
    // Create Android notification channels
    if (Platform.OS === 'android') {
      await createNotificationChannels();
    }

    // Set up notification listeners
    setupNotificationListeners();

    console.log('[ORACLE Notifications] Initialized successfully');
    return true;
  } catch (error) {
    console.error('[ORACLE Notifications] Initialization failed:', error);
    return false;
  }
}

/**
 * Create notification channels for Android
 */
async function createNotificationChannels(): Promise<void> {
  for (const [channelId, config] of Object.entries(CHANNEL_CONFIGS)) {
    await Notifications.setNotificationChannelAsync(channelId, config);
  }
  console.log('[ORACLE Notifications] Channels created');
}

/**
 * Set up notification response listeners for deep linking
 */
function setupNotificationListeners(): void {
  // Clean up existing listeners
  if (notificationListener) {
    notificationListener.remove();
  }
  if (responseListener) {
    responseListener.remove();
  }

  // Listen for notifications received while app is foregrounded
  notificationListener = Notifications.addNotificationReceivedListener(notification => {
    console.log('[ORACLE Notifications] Received:', notification.request.identifier);
  });

  // Listen for interactions with notifications
  responseListener = Notifications.addNotificationResponseReceivedListener(response => {
    handleNotificationResponse(response);
  });
}

/**
 * Handle notification tap/interaction
 */
function handleNotificationResponse(response: Notifications.NotificationResponse): void {
  const payload = response.notification.request.content.data as NotificationPayload | undefined;

  if (!payload) {
    console.warn('[ORACLE Notifications] No payload in notification');
    return;
  }

  console.log('[ORACLE Notifications] Response:', payload.type, payload.id);

  // Navigate based on notification type
  switch (payload.type) {
    case 'signal':
      router.push({
        pathname: '/oracle/radar',
        params: { signalId: payload.id },
      });
      break;

    case 'ghost_action':
      router.push({
        pathname: '/oracle/ghost-actions',
        params: { actionId: payload.id },
      });
      break;

    case 'copilot':
      router.push({
        pathname: '/oracle/act',
        params: { focusStep: payload.id },
      });
      break;

    default:
      router.push('/oracle');
  }
}

// ==========================================
// Permission Handling
// ==========================================

/**
 * Request notification permissions
 */
export async function requestNotificationPermission(): Promise<PermissionStatus> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();

  if (existingStatus === 'granted') {
    return { granted: true, canAskAgain: true, status: existingStatus };
  }

  const { status, canAskAgain } = await Notifications.requestPermissionsAsync();

  return {
    granted: status === 'granted',
    canAskAgain,
    status,
  };
}

/**
 * Check current permission status
 */
export async function getNotificationPermissionStatus(): Promise<PermissionStatus> {
  const { status, canAskAgain } = await Notifications.getPermissionsAsync();

  return {
    granted: status === 'granted',
    canAskAgain,
    status,
  };
}

// ==========================================
// Signal Notifications
// ==========================================

/**
 * Send notification for a detected signal
 */
export async function notifySignal(signal: Partial<Signal>): Promise<string | null> {
  if (!signal.id || !signal.title) {
    console.warn('[ORACLE Notifications] Invalid signal data');
    return null;
  }

  // Determine channel based on urgency
  let channelId = NOTIFICATION_CHANNELS.SIGNALS_MEDIUM;
  let priority = Notifications.AndroidNotificationPriority.DEFAULT;

  if (signal.urgency === 'critical') {
    channelId = NOTIFICATION_CHANNELS.SIGNALS_CRITICAL;
    priority = Notifications.AndroidNotificationPriority.HIGH;
  } else if (signal.urgency === 'high') {
    channelId = NOTIFICATION_CHANNELS.SIGNALS_HIGH;
    priority = Notifications.AndroidNotificationPriority.DEFAULT;
  }

  const urgencyIcon = getUrgencyIcon(signal.urgency || 'medium');

  try {
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: `${urgencyIcon} ${signal.title}`,
        body: signal.description || 'New signal detected',
        data: {
          type: 'signal',
          id: signal.id,
        } as NotificationPayload,
        sound: signal.urgency === 'critical' ? 'signal.wav' : undefined,
        badge: 1,
        ...(Platform.OS === 'android' && {
          channelId,
          priority,
        }),
      },
      trigger: null, // Send immediately
    });

    console.log(`[ORACLE Notifications] Signal notification sent: ${notificationId}`);
    return notificationId;
  } catch (error) {
    console.error('[ORACLE Notifications] Failed to send signal notification:', error);
    return null;
  }
}

/**
 * Send notification for multiple signals
 */
export async function notifySignals(signals: Partial<Signal>[]): Promise<void> {
  // Group by urgency and send summary for non-critical
  const critical = signals.filter(s => s.urgency === 'critical');
  const other = signals.filter(s => s.urgency !== 'critical');

  // Send individual notifications for critical signals
  for (const signal of critical) {
    await notifySignal(signal);
  }

  // Send summary for others if multiple
  if (other.length > 1) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `${other.length} new signals detected`,
        body: other.map(s => s.title).slice(0, 3).join(', ') + (other.length > 3 ? '...' : ''),
        data: { type: 'signal', id: 'summary' } as NotificationPayload,
        ...(Platform.OS === 'android' && {
          channelId: NOTIFICATION_CHANNELS.SIGNALS_MEDIUM,
        }),
      },
      trigger: null,
    });
  } else if (other.length === 1) {
    await notifySignal(other[0]);
  }
}

// ==========================================
// Ghost Action Notifications
// ==========================================

/**
 * Send notification for a ghost action ready for approval
 */
export async function notifyGhostAction(action: Partial<GhostAction>): Promise<string | null> {
  if (!action.id || !action.title) {
    console.warn('[ORACLE Notifications] Invalid ghost action data');
    return null;
  }

  try {
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: '👻 Action Ready',
        body: action.title,
        subtitle: action.rationale || 'Tap to review and approve',
        data: {
          type: 'ghost_action',
          id: action.id,
        } as NotificationPayload,
        ...(Platform.OS === 'android' && {
          channelId: NOTIFICATION_CHANNELS.GHOST_ACTIONS,
        }),
        // Add action buttons for quick approve/dismiss
        categoryIdentifier: 'ghost_action',
      },
      trigger: null,
    });

    console.log(`[ORACLE Notifications] Ghost action notification sent: ${notificationId}`);
    return notificationId;
  } catch (error) {
    console.error('[ORACLE Notifications] Failed to send ghost action notification:', error);
    return null;
  }
}

// ==========================================
// Copilot Notifications
// ==========================================

/**
 * Send notification for copilot guidance
 */
export async function notifyCopilot(message: string, stepId?: string): Promise<string | null> {
  try {
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: '🤖 Copilot',
        body: message,
        data: {
          type: 'copilot',
          id: stepId || 'guidance',
        } as NotificationPayload,
        ...(Platform.OS === 'android' && {
          channelId: NOTIFICATION_CHANNELS.COPILOT,
          priority: Notifications.AndroidNotificationPriority.LOW,
        }),
      },
      trigger: null,
    });

    return notificationId;
  } catch (error) {
    console.error('[ORACLE Notifications] Failed to send copilot notification:', error);
    return null;
  }
}

// ==========================================
// Scheduled Notifications
// ==========================================

/**
 * Schedule a notification for a future time
 */
export async function scheduleNotification(
  title: string,
  body: string,
  triggerAt: Date,
  payload?: Partial<NotificationPayload>
): Promise<string | null> {
  try {
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: payload || { type: 'system', id: 'scheduled' },
        ...(Platform.OS === 'android' && {
          channelId: NOTIFICATION_CHANNELS.SYSTEM,
        }),
      },
      trigger: {
        date: triggerAt,
      },
    });

    return notificationId;
  } catch (error) {
    console.error('[ORACLE Notifications] Failed to schedule notification:', error);
    return null;
  }
}

/**
 * Cancel a scheduled notification
 */
export async function cancelNotification(notificationId: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(notificationId);
}

/**
 * Cancel all scheduled notifications
 */
export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

// ==========================================
// Badge Management
// ==========================================

/**
 * Set the app badge count
 */
export async function setBadgeCount(count: number): Promise<void> {
  await Notifications.setBadgeCountAsync(count);
}

/**
 * Clear the app badge
 */
export async function clearBadge(): Promise<void> {
  await Notifications.setBadgeCountAsync(0);
}

// ==========================================
// Cleanup
// ==========================================

/**
 * Cleanup notification listeners
 */
export function cleanupNotifications(): void {
  if (notificationListener) {
    notificationListener.remove();
    notificationListener = null;
  }
  if (responseListener) {
    responseListener.remove();
    responseListener = null;
  }
}

// ==========================================
// Helpers
// ==========================================

function getUrgencyIcon(urgency: string): string {
  switch (urgency) {
    case 'critical':
      return '🔴';
    case 'high':
      return '🟠';
    case 'medium':
      return '🟡';
    case 'low':
      return '🟢';
    default:
      return '⚪';
  }
}
