/**
 * ORACLE Watch App - Main Exports
 * Stories watch-1 through watch-6
 */

// Apple Watch Bridge
export {
  watchBridge,
  useWatchConnectivity,
  type WatchMessageType,
  type WatchMessage,
  type WatchState,
  type OracleWatchData,
} from './WatchBridge';

// Complication Data Provider
export {
  complicationDataProvider,
  useComplicationData,
  type ComplicationFamily,
  type ComplicationTemplate,
} from './ComplicationDataProvider';

// Watch UI Definitions
export {
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
  type MainScreenData,
  type ForceTouchMenuItem,
  type NotificationAction,
  type NotificationCategory,
  type HapticType,
  type HapticPattern,
  type SwipeScreen,
} from './WatchUI';

// Wear OS Bridge
export {
  wearOSBridge,
  useWearOSConnectivity,
  generateStatusTile,
  generateSignalsTile,
  generateStepTile,
  type WearNode,
  type WearMessagePath,
  type WearOSState,
  type WearTileData,
  type OracleStatusTile,
  type SignalsSummaryTile,
  type CurrentStepTile,
} from './WearOSBridge';

// Types
export * from './types';
