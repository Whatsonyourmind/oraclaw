/**
 * ORACLE Settings Screen
 * Story adv-31 - Comprehensive settings interface
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  RefreshControl,
} from 'react-native';
import Slider from '@react-native-community/slider';
import {
  oracleSettingsService,
  OracleSettings as Settings,
  ProactivityLevel,
  NotificationType,
  ThemeMode,
  OODAColorScheme,
  SETTINGS_SECTIONS,
  DEFAULT_SETTINGS,
} from '../../../services/oracleSettings';
import { ORACLE_COLORS } from '../theme';

// Section component props
interface SectionProps {
  title: string;
  description: string;
  icon: string;
  children: React.ReactNode;
  onReset?: () => void;
}

function SettingsSection({ title, description, icon, children, onReset }: SectionProps) {
  const [expanded, setExpanded] = useState(true);

  return (
    <View style={styles.section}>
      <TouchableOpacity
        style={styles.sectionHeader}
        onPress={() => setExpanded(!expanded)}
      >
        <Text style={styles.sectionIcon}>{icon}</Text>
        <View style={styles.sectionInfo}>
          <Text style={styles.sectionTitle}>{title}</Text>
          <Text style={styles.sectionDescription}>{description}</Text>
        </View>
        <Text style={styles.expandIcon}>{expanded ? '▼' : '▶'}</Text>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.sectionContent}>
          {children}
          {onReset && (
            <TouchableOpacity style={styles.resetButton} onPress={onReset}>
              <Text style={styles.resetButtonText}>Reset Section</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

// Toggle setting component
function ToggleSetting({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description?: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.settingRow}>
      <View style={styles.settingInfo}>
        <Text style={styles.settingLabel}>{label}</Text>
        {description && <Text style={styles.settingDescription}>{description}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: '#333', true: ORACLE_COLORS.observe + '88' }}
        thumbColor={value ? ORACLE_COLORS.observe : '#666'}
      />
    </View>
  );
}

// Slider setting component
function SliderSetting({
  label,
  description,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  description?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (value: number) => void;
}) {
  return (
    <View style={styles.sliderSetting}>
      <View style={styles.sliderHeader}>
        <Text style={styles.settingLabel}>{label}</Text>
        <Text style={styles.sliderValue}>
          {value}{unit}
        </Text>
      </View>
      {description && <Text style={styles.settingDescription}>{description}</Text>}
      <Slider
        style={styles.slider}
        minimumValue={min}
        maximumValue={max}
        step={step}
        value={value}
        onValueChange={onChange}
        minimumTrackTintColor={ORACLE_COLORS.observe}
        maximumTrackTintColor="#333"
        thumbTintColor={ORACLE_COLORS.observe}
      />
    </View>
  );
}

// Option selector component
function OptionSetting<T extends string>({
  label,
  description,
  value,
  options,
  onChange,
}: {
  label: string;
  description?: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.optionSetting}>
      <Text style={styles.settingLabel}>{label}</Text>
      {description && <Text style={styles.settingDescription}>{description}</Text>}
      <View style={styles.optionButtons}>
        {options.map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.optionButton,
              value === option.value && styles.optionButtonSelected,
            ]}
            onPress={() => onChange(option.value)}
          >
            <Text
              style={[
                styles.optionButtonText,
                value === option.value && styles.optionButtonTextSelected,
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

export default function OracleSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [refreshing, setRefreshing] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const loaded = await oracleSettingsService.loadSettings();
    setSettings(loaded);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadSettings();
    setRefreshing(false);
  }, []);

  const updateSetting = async <K extends keyof Settings>(key: K, value: Settings[K]) => {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    setHasChanges(true);
    await oracleSettingsService.updateSetting(key, value);
  };

  const updateNotificationPref = async (type: NotificationType, enabled: boolean) => {
    const updated = {
      ...settings,
      notification_preferences: {
        ...settings.notification_preferences,
        [type]: enabled,
      },
    };
    setSettings(updated);
    setHasChanges(true);
    await oracleSettingsService.updateNotificationPreference(type, enabled);
  };

  const resetSection = async (sectionId: string) => {
    Alert.alert(
      'Reset Section',
      'Are you sure you want to reset this section to defaults?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            await oracleSettingsService.resetSection(sectionId);
            await loadSettings();
          },
        },
      ]
    );
  };

  const resetAll = () => {
    Alert.alert(
      'Reset All Settings',
      'Are you sure you want to reset ALL settings to defaults? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset All',
          style: 'destructive',
          onPress: async () => {
            await oracleSettingsService.resetToDefaults();
            await loadSettings();
            Alert.alert('Settings Reset', 'All settings have been restored to defaults.');
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ORACLE_COLORS.observe} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>ORACLE Settings</Text>
          <Text style={styles.subtitle}>Customize your ORACLE experience</Text>
        </View>

        {/* Proactivity Section */}
        <SettingsSection
          title="Proactivity"
          description="Control how actively ORACLE assists you"
          icon="⚡"
          onReset={() => resetSection('proactivity')}
        >
          <OptionSetting<ProactivityLevel>
            label="Proactivity Level"
            description="How often ORACLE proactively suggests actions"
            value={settings.proactivity_level}
            options={[
              { value: 'minimal', label: 'Minimal' },
              { value: 'balanced', label: 'Balanced' },
              { value: 'aggressive', label: 'Aggressive' },
            ]}
            onChange={(value) => updateSetting('proactivity_level', value)}
          />

          <ToggleSetting
            label="Auto Scan"
            description="Automatically scan for signals periodically"
            value={settings.auto_scan_enabled}
            onChange={(value) => updateSetting('auto_scan_enabled', value)}
          />

          {settings.auto_scan_enabled && (
            <SliderSetting
              label="Scan Interval"
              value={settings.auto_scan_interval_minutes}
              min={5}
              max={60}
              step={5}
              unit=" min"
              onChange={(value) => updateSetting('auto_scan_interval_minutes', value)}
            />
          )}

          <ToggleSetting
            label="Background Sync"
            description="Sync data when app is in background"
            value={settings.background_sync_enabled}
            onChange={(value) => updateSetting('background_sync_enabled', value)}
          />
        </SettingsSection>

        {/* Notifications Section */}
        <SettingsSection
          title="Notifications"
          description="Manage alerts and reminders"
          icon="🔔"
          onReset={() => resetSection('notifications')}
        >
          <ToggleSetting
            label="Enable Notifications"
            value={settings.notifications_enabled}
            onChange={(value) => updateSetting('notifications_enabled', value)}
          />

          {settings.notifications_enabled && (
            <>
              <Text style={styles.subSectionTitle}>Notification Types</Text>

              <ToggleSetting
                label="Critical Signals"
                value={settings.notification_preferences.critical_signals}
                onChange={(value) => updateNotificationPref('critical_signals', value)}
              />
              <ToggleSetting
                label="High Priority Signals"
                value={settings.notification_preferences.high_signals}
                onChange={(value) => updateNotificationPref('high_signals', value)}
              />
              <ToggleSetting
                label="Medium Priority Signals"
                value={settings.notification_preferences.medium_signals}
                onChange={(value) => updateNotificationPref('medium_signals', value)}
              />
              <ToggleSetting
                label="Ghost Actions"
                value={settings.notification_preferences.ghost_actions}
                onChange={(value) => updateNotificationPref('ghost_actions', value)}
              />
              <ToggleSetting
                label="Copilot Suggestions"
                value={settings.notification_preferences.copilot_suggestions}
                onChange={(value) => updateNotificationPref('copilot_suggestions', value)}
              />
              <ToggleSetting
                label="Prediction Outcomes"
                value={settings.notification_preferences.prediction_outcomes}
                onChange={(value) => updateNotificationPref('prediction_outcomes', value)}
              />

              <ToggleSetting
                label="Quiet Hours"
                description="Silence notifications during specific hours"
                value={settings.quiet_hours_enabled}
                onChange={(value) => updateSetting('quiet_hours_enabled', value)}
              />
            </>
          )}
        </SettingsSection>

        {/* Confidence Section */}
        <SettingsSection
          title="Confidence Thresholds"
          description="Adjust prediction confidence levels"
          icon="🎯"
          onReset={() => resetSection('confidence')}
        >
          <SliderSetting
            label="Low Confidence Threshold"
            description="Predictions below this are marked as low confidence"
            value={settings.confidence_threshold_low}
            min={0.2}
            max={0.7}
            step={0.05}
            unit=""
            onChange={(value) => updateSetting('confidence_threshold_low', Math.round(value * 100) / 100)}
          />

          <SliderSetting
            label="High Confidence Threshold"
            description="Predictions above this are marked as high confidence"
            value={settings.confidence_threshold_high}
            min={0.6}
            max={0.95}
            step={0.05}
            unit=""
            onChange={(value) => updateSetting('confidence_threshold_high', Math.round(value * 100) / 100)}
          />

          <ToggleSetting
            label="Show Low Confidence Predictions"
            description="Display predictions below the low threshold"
            value={settings.show_low_confidence_predictions}
            onChange={(value) => updateSetting('show_low_confidence_predictions', value)}
          />
        </SettingsSection>

        {/* Data Retention Section */}
        <SettingsSection
          title="Data Retention"
          description="Control data storage and archiving"
          icon="💾"
          onReset={() => resetSection('retention')}
        >
          <SliderSetting
            label="Data Retention Period"
            description="How long to keep historical data"
            value={settings.data_retention_days}
            min={30}
            max={365}
            step={30}
            unit=" days"
            onChange={(value) => updateSetting('data_retention_days', value)}
          />

          <ToggleSetting
            label="Auto-Archive Completed"
            description="Automatically archive completed decisions"
            value={settings.auto_archive_completed}
            onChange={(value) => updateSetting('auto_archive_completed', value)}
          />

          {settings.auto_archive_completed && (
            <SliderSetting
              label="Archive After"
              value={settings.archive_after_days}
              min={7}
              max={90}
              step={7}
              unit=" days"
              onChange={(value) => updateSetting('archive_after_days', value)}
            />
          )}
        </SettingsSection>

        {/* Appearance Section */}
        <SettingsSection
          title="Appearance"
          description="Theme and display settings"
          icon="🎨"
          onReset={() => resetSection('appearance')}
        >
          <OptionSetting<ThemeMode>
            label="Theme"
            value={settings.theme_mode}
            options={[
              { value: 'dark', label: 'Dark' },
              { value: 'light', label: 'Light' },
              { value: 'system', label: 'System' },
            ]}
            onChange={(value) => updateSetting('theme_mode', value)}
          />

          <OptionSetting<OODAColorScheme>
            label="OODA Colors"
            description="Color scheme for OODA loop phases"
            value={settings.ooda_color_scheme}
            options={[
              { value: 'default', label: 'Default' },
              { value: 'colorblind', label: 'Colorblind' },
              { value: 'high_contrast', label: 'High Contrast' },
            ]}
            onChange={(value) => updateSetting('ooda_color_scheme', value)}
          />

          <View style={styles.colorPreview}>
            <Text style={styles.colorPreviewLabel}>Color Preview:</Text>
            <View style={styles.colorSwatches}>
              {(['observe', 'orient', 'decide', 'act'] as const).map((phase) => (
                <View
                  key={phase}
                  style={[styles.colorSwatch, { backgroundColor: oracleSettingsService.getOODAColors()[phase] }]}
                >
                  <Text style={styles.colorSwatchLabel}>{phase.charAt(0).toUpperCase()}</Text>
                </View>
              ))}
            </View>
          </View>
        </SettingsSection>

        {/* Accessibility Section */}
        <SettingsSection
          title="Accessibility"
          description="Accessibility options"
          icon="♿"
          onReset={() => resetSection('accessibility')}
        >
          <ToggleSetting
            label="Large Text"
            description="Increase text size throughout the app"
            value={settings.large_text}
            onChange={(value) => updateSetting('large_text', value)}
          />

          <ToggleSetting
            label="Reduce Motion"
            description="Minimize animations and motion effects"
            value={settings.reduce_motion}
            onChange={(value) => updateSetting('reduce_motion', value)}
          />

          <ToggleSetting
            label="High Contrast"
            description="Increase color contrast for better visibility"
            value={settings.high_contrast}
            onChange={(value) => updateSetting('high_contrast', value)}
          />
        </SettingsSection>

        {/* Privacy Section */}
        <SettingsSection
          title="Privacy"
          description="Control data sharing"
          icon="🔒"
          onReset={() => resetSection('privacy')}
        >
          <ToggleSetting
            label="Analytics"
            description="Help improve ORACLE with anonymous usage data"
            value={settings.analytics_enabled}
            onChange={(value) => updateSetting('analytics_enabled', value)}
          />

          <ToggleSetting
            label="Crash Reporting"
            description="Automatically report crashes to help fix bugs"
            value={settings.crash_reporting_enabled}
            onChange={(value) => updateSetting('crash_reporting_enabled', value)}
          />

          <ToggleSetting
            label="Share Anonymous Usage"
            description="Contribute to aggregated usage statistics"
            value={settings.share_anonymous_usage}
            onChange={(value) => updateSetting('share_anonymous_usage', value)}
          />
        </SettingsSection>

        {/* Advanced Section */}
        <SettingsSection
          title="Advanced"
          description="Developer options"
          icon="🔧"
          onReset={() => resetSection('advanced')}
        >
          <ToggleSetting
            label="Developer Mode"
            description="Enable advanced debugging features"
            value={settings.developer_mode}
            onChange={(value) => updateSetting('developer_mode', value)}
          />

          {settings.developer_mode && (
            <ToggleSetting
              label="Debug Logging"
              description="Log detailed debug information"
              value={settings.debug_logging}
              onChange={(value) => updateSetting('debug_logging', value)}
            />
          )}
        </SettingsSection>

        {/* Reset All Button */}
        <TouchableOpacity style={styles.resetAllButton} onPress={resetAll}>
          <Text style={styles.resetAllText}>Reset All Settings</Text>
        </TouchableOpacity>

        {/* Version Info */}
        <View style={styles.versionInfo}>
          <Text style={styles.versionText}>ORACLE Settings v1.0</Text>
          <Text style={styles.versionText}>Last sync: {settings.last_sync || 'Never'}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  content: {
    flex: 1,
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    color: '#888',
    marginTop: 4,
  },
  section: {
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  sectionIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  sectionInfo: {
    flex: 1,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  sectionDescription: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
  expandIcon: {
    color: '#666',
    fontSize: 12,
  },
  sectionContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    color: '#fff',
    fontSize: 14,
  },
  settingDescription: {
    color: '#666',
    fontSize: 12,
    marginTop: 2,
  },
  sliderSetting: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sliderValue: {
    color: ORACLE_COLORS.observe,
    fontSize: 14,
    fontWeight: '600',
  },
  slider: {
    width: '100%',
    height: 40,
    marginTop: 8,
  },
  optionSetting: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  optionButtons: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 8,
  },
  optionButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  optionButtonSelected: {
    backgroundColor: ORACLE_COLORS.observe + '22',
    borderColor: ORACLE_COLORS.observe,
  },
  optionButtonText: {
    color: '#888',
    fontSize: 12,
    fontWeight: '500',
  },
  optionButtonTextSelected: {
    color: ORACLE_COLORS.observe,
  },
  subSectionTitle: {
    color: '#888',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  colorPreview: {
    paddingVertical: 12,
  },
  colorPreviewLabel: {
    color: '#888',
    fontSize: 12,
    marginBottom: 8,
  },
  colorSwatches: {
    flexDirection: 'row',
    gap: 12,
  },
  colorSwatch: {
    width: 48,
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorSwatchLabel: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 16,
  },
  resetButton: {
    marginTop: 12,
    padding: 8,
    alignItems: 'center',
  },
  resetButtonText: {
    color: '#666',
    fontSize: 12,
  },
  resetAllButton: {
    margin: 16,
    padding: 16,
    backgroundColor: '#331111',
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ff4444',
  },
  resetAllText: {
    color: '#ff4444',
    fontSize: 16,
    fontWeight: '600',
  },
  versionInfo: {
    padding: 16,
    alignItems: 'center',
    marginBottom: 32,
  },
  versionText: {
    color: '#444',
    fontSize: 12,
  },
});
