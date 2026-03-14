import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import * as Battery from 'expo-battery';
import * as Network from 'expo-network';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Task identifier
export const ORACLE_BACKGROUND_TASK = 'oracle-background-sync';

// Storage keys
const STORAGE_KEYS = {
  LAST_SYNC: '@oracle/lastSync',
  PENDING_SIGNALS: '@oracle/pendingSignals',
  SYNC_RESULTS: '@oracle/syncResults',
  SYNC_CONFIG: '@oracle/syncConfig',
};

// Configuration defaults
const DEFAULT_CONFIG = {
  minimumBatteryLevel: 20, // Don't sync below 20%
  requiresNetworkConnectivity: true,
  allowsCellular: true, // Allow sync on cellular by default
  maxSyncAge: 15 * 60 * 1000, // 15 minutes in ms
};

// Types
export interface OracleSyncConfig {
  minimumBatteryLevel: number;
  requiresNetworkConnectivity: boolean;
  allowsCellular: boolean;
  maxSyncAge: number;
}

export interface SyncResult {
  timestamp: number;
  success: boolean;
  signalsDetected: number;
  error?: string;
  batteryLevel?: number;
  networkType?: string;
}

// ==========================================
// Background Task Definition
// ==========================================

TaskManager.defineTask(ORACLE_BACKGROUND_TASK, async () => {
  const now = Date.now();
  console.log(`[ORACLE] Background sync started at ${new Date(now).toISOString()}`);

  try {
    // Check conditions before syncing
    const canSync = await checkSyncConditions();
    if (!canSync.allowed) {
      console.log(`[ORACLE] Sync skipped: ${canSync.reason}`);
      await saveSyncResult({
        timestamp: now,
        success: false,
        signalsDetected: 0,
        error: canSync.reason,
      });
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    // Perform the radar scan
    const result = await performRadarScan();

    // Store results for foreground pickup
    await saveSyncResult({
      timestamp: now,
      success: true,
      signalsDetected: result.signals?.length || 0,
      batteryLevel: canSync.batteryLevel,
      networkType: canSync.networkType,
    });

    // Store pending signals
    if (result.signals && result.signals.length > 0) {
      await savePendingSignals(result.signals);
      console.log(`[ORACLE] Background sync complete: ${result.signals.length} signals detected`);
      return BackgroundFetch.BackgroundFetchResult.NewData;
    }

    console.log('[ORACLE] Background sync complete: no new signals');
    return BackgroundFetch.BackgroundFetchResult.NoData;
  } catch (error) {
    console.error('[ORACLE] Background sync failed:', error);
    await saveSyncResult({
      timestamp: now,
      success: false,
      signalsDetected: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

// ==========================================
// Condition Checking
// ==========================================

async function checkSyncConditions(): Promise<{
  allowed: boolean;
  reason?: string;
  batteryLevel?: number;
  networkType?: string;
}> {
  // Load config
  const config = await loadSyncConfig();

  // Check last sync time to avoid too frequent syncs
  const lastSync = await getLastSyncTime();
  if (lastSync && Date.now() - lastSync < config.maxSyncAge) {
    return { allowed: false, reason: 'Synced recently' };
  }

  // Check battery level
  try {
    const batteryLevel = await Battery.getBatteryLevelAsync();
    const batteryPercent = batteryLevel * 100;

    if (batteryPercent < config.minimumBatteryLevel) {
      return {
        allowed: false,
        reason: `Battery too low (${batteryPercent.toFixed(0)}%)`,
        batteryLevel: batteryPercent,
      };
    }

    // Check if low power mode is enabled
    const isLowPowerMode = await Battery.isLowPowerModeEnabledAsync();
    if (isLowPowerMode) {
      return {
        allowed: false,
        reason: 'Low power mode enabled',
        batteryLevel: batteryPercent,
      };
    }

    // Check network connectivity
    if (config.requiresNetworkConnectivity) {
      const networkState = await Network.getNetworkStateAsync();

      if (!networkState.isConnected) {
        return {
          allowed: false,
          reason: 'No network connection',
          batteryLevel: batteryPercent,
        };
      }

      if (!networkState.isInternetReachable) {
        return {
          allowed: false,
          reason: 'Internet not reachable',
          batteryLevel: batteryPercent,
          networkType: networkState.type,
        };
      }

      // Check cellular restriction
      if (networkState.type === Network.NetworkStateType.CELLULAR && !config.allowsCellular) {
        return {
          allowed: false,
          reason: 'Cellular sync disabled',
          batteryLevel: batteryPercent,
          networkType: 'cellular',
        };
      }

      return {
        allowed: true,
        batteryLevel: batteryPercent,
        networkType: networkState.type,
      };
    }

    return { allowed: true, batteryLevel: batteryPercent };
  } catch (error) {
    // If we can't check conditions, allow sync
    console.warn('[ORACLE] Failed to check conditions:', error);
    return { allowed: true };
  }
}

// ==========================================
// Radar Scan (Background)
// ==========================================

async function performRadarScan(): Promise<{
  signals: any[];
  clusters: any[];
}> {
  // In a real implementation, this would call the API
  // For background tasks, we make a lightweight check
  try {
    const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';
    const response = await fetch(`${apiUrl}/api/oracle/observe/scan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data_types: ['calendar', 'tasks'],
        background: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    return {
      signals: data.data?.signals || [],
      clusters: data.data?.clusters || [],
    };
  } catch (error) {
    console.error('[ORACLE] Radar scan failed:', error);
    // Return empty results on failure
    return { signals: [], clusters: [] };
  }
}

// ==========================================
// Storage Helpers
// ==========================================

async function loadSyncConfig(): Promise<OracleSyncConfig> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEYS.SYNC_CONFIG);
    if (stored) {
      return { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
    }
  } catch (error) {
    console.warn('[ORACLE] Failed to load config:', error);
  }
  return DEFAULT_CONFIG;
}

async function getLastSyncTime(): Promise<number | null> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEYS.LAST_SYNC);
    return stored ? parseInt(stored, 10) : null;
  } catch (error) {
    return null;
  }
}

async function saveSyncResult(result: SyncResult): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.LAST_SYNC, result.timestamp.toString());

    // Keep last 10 results
    const existingResults = await AsyncStorage.getItem(STORAGE_KEYS.SYNC_RESULTS);
    const results: SyncResult[] = existingResults ? JSON.parse(existingResults) : [];
    results.unshift(result);
    await AsyncStorage.setItem(
      STORAGE_KEYS.SYNC_RESULTS,
      JSON.stringify(results.slice(0, 10))
    );
  } catch (error) {
    console.error('[ORACLE] Failed to save sync result:', error);
  }
}

async function savePendingSignals(signals: any[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.PENDING_SIGNALS, JSON.stringify(signals));
  } catch (error) {
    console.error('[ORACLE] Failed to save pending signals:', error);
  }
}

// ==========================================
// Public API
// ==========================================

/**
 * Register the background task for ORACLE sync
 * Should be called early in app initialization
 */
export async function registerOracleBackgroundTask(): Promise<boolean> {
  try {
    // Check if already registered
    const isRegistered = await TaskManager.isTaskRegisteredAsync(ORACLE_BACKGROUND_TASK);
    if (isRegistered) {
      console.log('[ORACLE] Background task already registered');
      return true;
    }

    // Register with 15-minute minimum interval
    await BackgroundFetch.registerTaskAsync(ORACLE_BACKGROUND_TASK, {
      minimumInterval: 15 * 60, // 15 minutes (minimum allowed by OS)
      stopOnTerminate: false,
      startOnBoot: true,
    });

    console.log('[ORACLE] Background task registered successfully');
    return true;
  } catch (error) {
    console.error('[ORACLE] Failed to register background task:', error);
    return false;
  }
}

/**
 * Unregister the background task
 */
export async function unregisterOracleBackgroundTask(): Promise<boolean> {
  try {
    await BackgroundFetch.unregisterTaskAsync(ORACLE_BACKGROUND_TASK);
    console.log('[ORACLE] Background task unregistered');
    return true;
  } catch (error) {
    console.error('[ORACLE] Failed to unregister background task:', error);
    return false;
  }
}

/**
 * Check if background task is registered and get status
 */
export async function getBackgroundTaskStatus(): Promise<{
  isRegistered: boolean;
  status: BackgroundFetch.BackgroundFetchStatus;
}> {
  const isRegistered = await TaskManager.isTaskRegisteredAsync(ORACLE_BACKGROUND_TASK);
  const status = await BackgroundFetch.getStatusAsync();

  return { isRegistered, status };
}

/**
 * Get pending signals from last background sync
 */
export async function getPendingSignals(): Promise<any[]> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEYS.PENDING_SIGNALS);
    if (stored) {
      // Clear after reading
      await AsyncStorage.removeItem(STORAGE_KEYS.PENDING_SIGNALS);
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('[ORACLE] Failed to get pending signals:', error);
  }
  return [];
}

/**
 * Get recent sync results
 */
export async function getSyncHistory(): Promise<SyncResult[]> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEYS.SYNC_RESULTS);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('[ORACLE] Failed to get sync history:', error);
    return [];
  }
}

/**
 * Update sync configuration
 */
export async function updateSyncConfig(config: Partial<OracleSyncConfig>): Promise<void> {
  try {
    const current = await loadSyncConfig();
    const updated = { ...current, ...config };
    await AsyncStorage.setItem(STORAGE_KEYS.SYNC_CONFIG, JSON.stringify(updated));
  } catch (error) {
    console.error('[ORACLE] Failed to update config:', error);
  }
}

/**
 * Manually trigger a background sync (for testing)
 */
export async function triggerManualSync(): Promise<SyncResult> {
  const now = Date.now();
  console.log('[ORACLE] Manual sync triggered');

  try {
    const canSync = await checkSyncConditions();
    if (!canSync.allowed) {
      const result: SyncResult = {
        timestamp: now,
        success: false,
        signalsDetected: 0,
        error: canSync.reason,
      };
      return result;
    }

    const scanResult = await performRadarScan();
    const result: SyncResult = {
      timestamp: now,
      success: true,
      signalsDetected: scanResult.signals?.length || 0,
      batteryLevel: canSync.batteryLevel,
      networkType: canSync.networkType,
    };

    await saveSyncResult(result);
    if (scanResult.signals?.length > 0) {
      await savePendingSignals(scanResult.signals);
    }

    return result;
  } catch (error) {
    const result: SyncResult = {
      timestamp: now,
      success: false,
      signalsDetected: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    await saveSyncResult(result);
    return result;
  }
}
