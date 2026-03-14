/**
 * ORACLE Settings Service
 * Story adv-30 - Settings and preferences management
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// Storage keys
const SETTINGS_KEY = '@oracle_settings';

// Proactivity levels
export type ProactivityLevel = 'minimal' | 'balanced' | 'aggressive';

// Notification types
export type NotificationType =
  | 'critical_signals'
  | 'high_signals'
  | 'medium_signals'
  | 'low_signals'
  | 'ghost_actions'
  | 'copilot_suggestions'
  | 'prediction_outcomes'
  | 'decision_reminders'
  | 'journal_reminders';

// Theme options
export type ThemeMode = 'dark' | 'light' | 'system';
export type OODAColorScheme = 'default' | 'colorblind' | 'high_contrast' | 'custom';

// Settings interface
export interface OracleSettings {
  // Proactivity
  proactivity_level: ProactivityLevel;
  auto_scan_enabled: boolean;
  auto_scan_interval_minutes: number;
  background_sync_enabled: boolean;

  // Notifications
  notifications_enabled: boolean;
  notification_preferences: Record<NotificationType, boolean>;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string; // HH:MM format
  quiet_hours_end: string;

  // Confidence thresholds
  confidence_threshold_low: number;  // Below this = low confidence (0-1)
  confidence_threshold_high: number; // Above this = high confidence (0-1)
  show_low_confidence_predictions: boolean;

  // Data retention
  data_retention_days: number;
  auto_archive_completed: boolean;
  archive_after_days: number;

  // Theme and display
  theme_mode: ThemeMode;
  ooda_color_scheme: OODAColorScheme;
  custom_colors?: {
    observe: string;
    orient: string;
    decide: string;
    act: string;
  };

  // Accessibility
  large_text: boolean;
  reduce_motion: boolean;
  high_contrast: boolean;

  // Privacy
  analytics_enabled: boolean;
  crash_reporting_enabled: boolean;
  share_anonymous_usage: boolean;

  // Advanced
  developer_mode: boolean;
  api_endpoint?: string;
  debug_logging: boolean;

  // Sync
  last_sync: string;
  sync_frequency_minutes: number;
}

// Default settings
export const DEFAULT_SETTINGS: OracleSettings = {
  // Proactivity
  proactivity_level: 'balanced',
  auto_scan_enabled: true,
  auto_scan_interval_minutes: 15,
  background_sync_enabled: true,

  // Notifications
  notifications_enabled: true,
  notification_preferences: {
    critical_signals: true,
    high_signals: true,
    medium_signals: false,
    low_signals: false,
    ghost_actions: true,
    copilot_suggestions: true,
    prediction_outcomes: true,
    decision_reminders: true,
    journal_reminders: true,
  },
  quiet_hours_enabled: false,
  quiet_hours_start: '22:00',
  quiet_hours_end: '07:00',

  // Confidence thresholds
  confidence_threshold_low: 0.5,
  confidence_threshold_high: 0.8,
  show_low_confidence_predictions: true,

  // Data retention
  data_retention_days: 90,
  auto_archive_completed: true,
  archive_after_days: 30,

  // Theme
  theme_mode: 'dark',
  ooda_color_scheme: 'default',

  // Accessibility
  large_text: false,
  reduce_motion: false,
  high_contrast: false,

  // Privacy
  analytics_enabled: true,
  crash_reporting_enabled: true,
  share_anonymous_usage: false,

  // Advanced
  developer_mode: false,
  debug_logging: false,

  // Sync
  last_sync: '',
  sync_frequency_minutes: 30,
};

// Settings sections for UI organization
export interface SettingsSection {
  id: string;
  title: string;
  description: string;
  icon: string;
}

export const SETTINGS_SECTIONS: SettingsSection[] = [
  { id: 'proactivity', title: 'Proactivity', description: 'Control how actively ORACLE assists you', icon: '⚡' },
  { id: 'notifications', title: 'Notifications', description: 'Manage alerts and reminders', icon: '🔔' },
  { id: 'confidence', title: 'Confidence', description: 'Adjust prediction thresholds', icon: '🎯' },
  { id: 'retention', title: 'Data Retention', description: 'Control data storage and archiving', icon: '💾' },
  { id: 'appearance', title: 'Appearance', description: 'Theme and display settings', icon: '🎨' },
  { id: 'accessibility', title: 'Accessibility', description: 'Accessibility options', icon: '♿' },
  { id: 'privacy', title: 'Privacy', description: 'Control data sharing', icon: '🔒' },
  { id: 'advanced', title: 'Advanced', description: 'Developer options', icon: '🔧' },
];

class OracleSettingsService {
  private settings: OracleSettings = DEFAULT_SETTINGS;
  private listeners: Set<(settings: OracleSettings) => void> = new Set();

  /**
   * Initialize settings service
   */
  async initialize(): Promise<void> {
    await this.loadSettings();
  }

  /**
   * Load settings from storage
   */
  async loadSettings(): Promise<OracleSettings> {
    try {
      const stored = await AsyncStorage.getItem(SETTINGS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Merge with defaults to handle new settings
        this.settings = { ...DEFAULT_SETTINGS, ...parsed };
      } else {
        this.settings = DEFAULT_SETTINGS;
      }
      return this.settings;
    } catch (error) {
      console.error('[OracleSettings] Failed to load settings:', error);
      this.settings = DEFAULT_SETTINGS;
      return this.settings;
    }
  }

  /**
   * Save settings to storage
   */
  async saveSettings(): Promise<void> {
    try {
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
      this.notifyListeners();
    } catch (error) {
      console.error('[OracleSettings] Failed to save settings:', error);
      throw error;
    }
  }

  /**
   * Get current settings
   */
  getSettings(): OracleSettings {
    return { ...this.settings };
  }

  /**
   * Update settings
   */
  async updateSettings(updates: Partial<OracleSettings>): Promise<OracleSettings> {
    this.settings = { ...this.settings, ...updates };
    await this.saveSettings();
    return this.settings;
  }

  /**
   * Update a single setting
   */
  async updateSetting<K extends keyof OracleSettings>(
    key: K,
    value: OracleSettings[K]
  ): Promise<void> {
    this.settings[key] = value;
    await this.saveSettings();
  }

  /**
   * Update notification preference
   */
  async updateNotificationPreference(
    type: NotificationType,
    enabled: boolean
  ): Promise<void> {
    this.settings.notification_preferences = {
      ...this.settings.notification_preferences,
      [type]: enabled,
    };
    await this.saveSettings();
  }

  /**
   * Reset settings to defaults
   */
  async resetToDefaults(): Promise<OracleSettings> {
    this.settings = { ...DEFAULT_SETTINGS };
    await this.saveSettings();
    return this.settings;
  }

  /**
   * Reset specific section to defaults
   */
  async resetSection(sectionId: string): Promise<void> {
    const sectionKeys = this.getSectionKeys(sectionId);
    for (const key of sectionKeys) {
      (this.settings as any)[key] = (DEFAULT_SETTINGS as any)[key];
    }
    await this.saveSettings();
  }

  /**
   * Get keys for a settings section
   */
  private getSectionKeys(sectionId: string): (keyof OracleSettings)[] {
    const sections: Record<string, (keyof OracleSettings)[]> = {
      proactivity: ['proactivity_level', 'auto_scan_enabled', 'auto_scan_interval_minutes', 'background_sync_enabled'],
      notifications: ['notifications_enabled', 'notification_preferences', 'quiet_hours_enabled', 'quiet_hours_start', 'quiet_hours_end'],
      confidence: ['confidence_threshold_low', 'confidence_threshold_high', 'show_low_confidence_predictions'],
      retention: ['data_retention_days', 'auto_archive_completed', 'archive_after_days'],
      appearance: ['theme_mode', 'ooda_color_scheme', 'custom_colors'],
      accessibility: ['large_text', 'reduce_motion', 'high_contrast'],
      privacy: ['analytics_enabled', 'crash_reporting_enabled', 'share_anonymous_usage'],
      advanced: ['developer_mode', 'api_endpoint', 'debug_logging'],
    };
    return sections[sectionId] || [];
  }

  /**
   * Export settings
   */
  async exportSettings(): Promise<string> {
    return JSON.stringify(this.settings, null, 2);
  }

  /**
   * Import settings
   */
  async importSettings(json: string): Promise<void> {
    try {
      const imported = JSON.parse(json);
      this.settings = { ...DEFAULT_SETTINGS, ...imported };
      await this.saveSettings();
    } catch (error) {
      throw new Error('Invalid settings format');
    }
  }

  /**
   * Subscribe to settings changes
   */
  subscribe(listener: (settings: OracleSettings) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notify listeners of settings changes
   */
  private notifyListeners(): void {
    const currentSettings = this.getSettings();
    this.listeners.forEach(listener => listener(currentSettings));
  }

  /**
   * Check if currently in quiet hours
   */
  isInQuietHours(): boolean {
    if (!this.settings.quiet_hours_enabled) return false;

    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();

    const [startHour, startMin] = this.settings.quiet_hours_start.split(':').map(Number);
    const [endHour, endMin] = this.settings.quiet_hours_end.split(':').map(Number);

    const startTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;

    if (startTime <= endTime) {
      // Same day range (e.g., 09:00 - 17:00)
      return currentTime >= startTime && currentTime < endTime;
    } else {
      // Overnight range (e.g., 22:00 - 07:00)
      return currentTime >= startTime || currentTime < endTime;
    }
  }

  /**
   * Get effective confidence threshold
   */
  getEffectiveThreshold(type: 'low' | 'high'): number {
    return type === 'low'
      ? this.settings.confidence_threshold_low
      : this.settings.confidence_threshold_high;
  }

  /**
   * Get OODA colors based on scheme
   */
  getOODAColors(): { observe: string; orient: string; decide: string; act: string } {
    switch (this.settings.ooda_color_scheme) {
      case 'colorblind':
        return {
          observe: '#0077BB', // Blue
          orient: '#EE7733', // Orange
          decide: '#CC3311', // Red
          act: '#009988',    // Teal
        };
      case 'high_contrast':
        return {
          observe: '#FFFFFF',
          orient: '#FFFF00',
          decide: '#FF0000',
          act: '#00FF00',
        };
      case 'custom':
        return this.settings.custom_colors || {
          observe: '#00BFFF',
          orient: '#FFD700',
          decide: '#FF6B6B',
          act: '#00FF88',
        };
      default:
        return {
          observe: '#00BFFF',
          orient: '#FFD700',
          decide: '#FF6B6B',
          act: '#00FF88',
        };
    }
  }
}

export const oracleSettingsService = new OracleSettingsService();

// React hook for settings
export function useOracleSettings() {
  return {
    getSettings: oracleSettingsService.getSettings.bind(oracleSettingsService),
    updateSettings: oracleSettingsService.updateSettings.bind(oracleSettingsService),
    updateSetting: oracleSettingsService.updateSetting.bind(oracleSettingsService),
    updateNotificationPreference: oracleSettingsService.updateNotificationPreference.bind(oracleSettingsService),
    resetToDefaults: oracleSettingsService.resetToDefaults.bind(oracleSettingsService),
    resetSection: oracleSettingsService.resetSection.bind(oracleSettingsService),
    subscribe: oracleSettingsService.subscribe.bind(oracleSettingsService),
    isInQuietHours: oracleSettingsService.isInQuietHours.bind(oracleSettingsService),
    getOODAColors: oracleSettingsService.getOODAColors.bind(oracleSettingsService),
  };
}
