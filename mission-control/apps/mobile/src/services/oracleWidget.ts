/**
 * ORACLE Widget Service
 * Story adv-23 - Home screen widget for ORACLE status
 *
 * Note: Full widget implementation requires native modules (expo-widgets or react-native-widget-extension).
 * This service provides the data layer and configuration for widget communication.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { OODAPhase, Signal } from '@mission-control/shared-types';

// Storage keys
const WIDGET_STORAGE_KEYS = {
  SMALL_WIDGET_DATA: 'oracle_widget_small',
  MEDIUM_WIDGET_DATA: 'oracle_widget_medium',
  LARGE_WIDGET_DATA: 'oracle_widget_large',
  WIDGET_CONFIG: 'oracle_widget_config',
  LAST_UPDATE: 'oracle_widget_last_update',
};

// Widget size types
export type WidgetSize = 'small' | 'medium' | 'large';

// Widget data structures
export interface SmallWidgetData {
  currentPhase: OODAPhase;
  phaseColor: string;
  topSignal: {
    title: string;
    urgency: string;
    type: string;
  } | null;
  lastUpdated: string;
}

export interface MediumWidgetData extends SmallWidgetData {
  signals: Array<{
    id: string;
    title: string;
    urgency: string;
    type: string;
  }>;
  quickAction: {
    type: 'scan' | 'decide' | 'plan';
    label: string;
  };
  systemHealth: 'healthy' | 'degraded' | 'error';
}

export interface LargeWidgetData extends MediumWidgetData {
  stats: {
    signalsToday: number;
    decisionsComplete: number;
    predictionAccuracy: number;
    activeSteps: number;
  };
  upcomingDeadlines: Array<{
    title: string;
    dueDate: string;
    urgency: string;
  }>;
  recentActivity: Array<{
    type: string;
    description: string;
    timestamp: string;
  }>;
}

export interface WidgetConfig {
  refreshInterval: number; // minutes
  showNotifications: boolean;
  compactMode: boolean;
  accentColor: string;
  enableQuickActions: boolean;
}

const DEFAULT_CONFIG: WidgetConfig = {
  refreshInterval: 15,
  showNotifications: true,
  compactMode: false,
  accentColor: '#00BFFF', // ORACLE observe blue
  enableQuickActions: true,
};

// Phase colors
const PHASE_COLORS: Record<OODAPhase, string> = {
  observe: '#00BFFF',
  orient: '#FFD700',
  decide: '#FF6B6B',
  act: '#00FF88',
  idle: '#888888',
};

class OracleWidgetService {
  private config: WidgetConfig = DEFAULT_CONFIG;

  /**
   * Initialize widget service
   */
  async initialize(): Promise<void> {
    try {
      const savedConfig = await AsyncStorage.getItem(WIDGET_STORAGE_KEYS.WIDGET_CONFIG);
      if (savedConfig) {
        this.config = { ...DEFAULT_CONFIG, ...JSON.parse(savedConfig) };
      }
    } catch (error) {
      console.error('[OracleWidget] Init error:', error);
    }
  }

  /**
   * Get configuration
   */
  getConfig(): WidgetConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  async updateConfig(updates: Partial<WidgetConfig>): Promise<void> {
    this.config = { ...this.config, ...updates };
    await AsyncStorage.setItem(
      WIDGET_STORAGE_KEYS.WIDGET_CONFIG,
      JSON.stringify(this.config)
    );
  }

  /**
   * Generate small widget data
   */
  async getSmallWidgetData(
    currentPhase: OODAPhase,
    signals: Signal[]
  ): Promise<SmallWidgetData> {
    const topSignal = signals
      .filter((s) => s.status !== 'dismissed')
      .sort((a, b) => {
        const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        return (urgencyOrder[a.urgency] || 4) - (urgencyOrder[b.urgency] || 4);
      })[0];

    const data: SmallWidgetData = {
      currentPhase,
      phaseColor: PHASE_COLORS[currentPhase],
      topSignal: topSignal
        ? {
            title: topSignal.title,
            urgency: topSignal.urgency,
            type: topSignal.type,
          }
        : null,
      lastUpdated: new Date().toISOString(),
    };

    await this.saveWidgetData('small', data);
    return data;
  }

  /**
   * Generate medium widget data
   */
  async getMediumWidgetData(
    currentPhase: OODAPhase,
    signals: Signal[],
    systemHealth: 'healthy' | 'degraded' | 'error'
  ): Promise<MediumWidgetData> {
    const sortedSignals = signals
      .filter((s) => s.status !== 'dismissed')
      .sort((a, b) => {
        const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        return (urgencyOrder[a.urgency] || 4) - (urgencyOrder[b.urgency] || 4);
      })
      .slice(0, 3);

    const quickAction = this.determineQuickAction(currentPhase, signals.length);

    const data: MediumWidgetData = {
      currentPhase,
      phaseColor: PHASE_COLORS[currentPhase],
      topSignal: sortedSignals[0]
        ? {
            title: sortedSignals[0].title,
            urgency: sortedSignals[0].urgency,
            type: sortedSignals[0].type,
          }
        : null,
      signals: sortedSignals.map((s) => ({
        id: s.id,
        title: s.title,
        urgency: s.urgency,
        type: s.type,
      })),
      quickAction,
      systemHealth,
      lastUpdated: new Date().toISOString(),
    };

    await this.saveWidgetData('medium', data);
    return data;
  }

  /**
   * Generate large widget data
   */
  async getLargeWidgetData(
    currentPhase: OODAPhase,
    signals: Signal[],
    systemHealth: 'healthy' | 'degraded' | 'error',
    stats: {
      signalsToday: number;
      decisionsComplete: number;
      predictionAccuracy: number;
      activeSteps: number;
    },
    deadlines: Array<{ title: string; dueDate: string; urgency: string }>,
    activity: Array<{ type: string; description: string; timestamp: string }>
  ): Promise<LargeWidgetData> {
    const mediumData = await this.getMediumWidgetData(currentPhase, signals, systemHealth);

    const data: LargeWidgetData = {
      ...mediumData,
      stats,
      upcomingDeadlines: deadlines.slice(0, 3),
      recentActivity: activity.slice(0, 5),
    };

    await this.saveWidgetData('large', data);
    return data;
  }

  /**
   * Determine appropriate quick action based on context
   */
  private determineQuickAction(
    phase: OODAPhase,
    signalCount: number
  ): { type: 'scan' | 'decide' | 'plan'; label: string } {
    if (phase === 'idle' || signalCount === 0) {
      return { type: 'scan', label: 'Start Scan' };
    }
    if (phase === 'observe' || phase === 'orient') {
      return { type: 'decide', label: 'Make Decision' };
    }
    return { type: 'plan', label: 'View Plan' };
  }

  /**
   * Save widget data to storage
   */
  private async saveWidgetData(
    size: WidgetSize,
    data: SmallWidgetData | MediumWidgetData | LargeWidgetData
  ): Promise<void> {
    const key = {
      small: WIDGET_STORAGE_KEYS.SMALL_WIDGET_DATA,
      medium: WIDGET_STORAGE_KEYS.MEDIUM_WIDGET_DATA,
      large: WIDGET_STORAGE_KEYS.LARGE_WIDGET_DATA,
    }[size];

    await AsyncStorage.setItem(key, JSON.stringify(data));
    await AsyncStorage.setItem(
      WIDGET_STORAGE_KEYS.LAST_UPDATE,
      new Date().toISOString()
    );

    // In a real implementation, this would trigger a native widget update
    // via expo-widgets or react-native-widget-extension
    this.notifyWidgetUpdate(size);
  }

  /**
   * Get cached widget data
   */
  async getCachedWidgetData<T>(size: WidgetSize): Promise<T | null> {
    const key = {
      small: WIDGET_STORAGE_KEYS.SMALL_WIDGET_DATA,
      medium: WIDGET_STORAGE_KEYS.MEDIUM_WIDGET_DATA,
      large: WIDGET_STORAGE_KEYS.LARGE_WIDGET_DATA,
    }[size];

    try {
      const data = await AsyncStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  /**
   * Get last update timestamp
   */
  async getLastUpdateTime(): Promise<Date | null> {
    try {
      const timestamp = await AsyncStorage.getItem(WIDGET_STORAGE_KEYS.LAST_UPDATE);
      return timestamp ? new Date(timestamp) : null;
    } catch {
      return null;
    }
  }

  /**
   * Check if widget data is stale
   */
  async isDataStale(): Promise<boolean> {
    const lastUpdate = await this.getLastUpdateTime();
    if (!lastUpdate) return true;

    const staleThreshold = this.config.refreshInterval * 60 * 1000; // Convert to ms
    return Date.now() - lastUpdate.getTime() > staleThreshold;
  }

  /**
   * Notify native widget to refresh
   * In production, this would use SharedGroupPreferences (iOS) or SharedPreferences (Android)
   */
  private notifyWidgetUpdate(size: WidgetSize): void {
    console.log(`[OracleWidget] Notifying ${size} widget to update`);

    // iOS: Would use expo-app-groups or UserDefaults with app group
    // Android: Would use SharedPreferences and AppWidgetManager

    // Example for expo-widgets (when available):
    // if (Platform.OS === 'ios') {
    //   WidgetKit.reloadTimelines('OracleSmallWidget');
    // } else {
    //   NativeModules.WidgetModule.updateWidget(size);
    // }
  }

  /**
   * Handle widget tap action
   */
  getDeepLinkForAction(action: string): string {
    const deepLinks: Record<string, string> = {
      scan: 'oracle://radar/scan',
      decide: 'oracle://decisions',
      plan: 'oracle://act',
      status: 'oracle://dashboard',
      signal: 'oracle://radar', // Would include signal ID
    };

    return deepLinks[action] || 'oracle://dashboard';
  }

  /**
   * Format widget display values
   */
  formatters = {
    phase: (phase: OODAPhase): string => {
      const names: Record<OODAPhase, string> = {
        observe: 'Observing',
        orient: 'Orienting',
        decide: 'Deciding',
        act: 'Acting',
        idle: 'Idle',
      };
      return names[phase];
    },

    urgency: (urgency: string): string => {
      const icons: Record<string, string> = {
        critical: '',
        high: '',
        medium: '',
        low: '',
      };
      return icons[urgency] || '';
    },

    relativeTime: (timestamp: string): string => {
      const now = Date.now();
      const then = new Date(timestamp).getTime();
      const diff = now - then;

      if (diff < 60000) return 'Just now';
      if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
      if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
      return `${Math.floor(diff / 86400000)}d ago`;
    },

    percentage: (value: number): string => {
      return `${Math.round(value * 100)}%`;
    },
  };
}

// Export singleton
export const oracleWidgetService = new OracleWidgetService();

// Widget configuration interface for native module
export interface NativeWidgetConfig {
  widgetFamily: 'systemSmall' | 'systemMedium' | 'systemLarge';
  backgroundColor: string;
  accentColor: string;
  fontColor: string;
  data: SmallWidgetData | MediumWidgetData | LargeWidgetData;
}

// Generate native widget config
export function generateNativeWidgetConfig(
  size: WidgetSize,
  data: SmallWidgetData | MediumWidgetData | LargeWidgetData,
  config: WidgetConfig
): NativeWidgetConfig {
  const widgetFamilyMap: Record<WidgetSize, NativeWidgetConfig['widgetFamily']> = {
    small: 'systemSmall',
    medium: 'systemMedium',
    large: 'systemLarge',
  };

  return {
    widgetFamily: widgetFamilyMap[size],
    backgroundColor: '#0a0a0a',
    accentColor: config.accentColor,
    fontColor: '#FFFFFF',
    data,
  };
}
