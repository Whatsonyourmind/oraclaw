/**
 * BriefingSettings Component
 * Configure briefing preferences and schedules
 */
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Switch,
  StyleSheet,
  Modal,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ORACLE_COLORS } from '../../../store/oracle';

// ============================================================================
// Types
// ============================================================================

export type BriefingType = 'morning' | 'evening' | 'weekly' | 'sitrep' | 'executive';
export type NotificationChannel = 'push' | 'email' | 'slack' | 'none';
export type VerbosityLevel = 'concise' | 'standard' | 'detailed';

export interface BriefingSchedule {
  type: BriefingType;
  enabled: boolean;
  time: string;
  days: number[];
  notificationChannel: NotificationChannel;
}

export interface BriefingPreferences {
  verbosityLevel: VerbosityLevel;
  includeWeather: boolean;
  includeTraffic: boolean;
  includeQuotes: boolean;
  audioEnabled: boolean;
  audioAutoPlay: boolean;
  audioSpeed: number;
  timezone: string;
  schedules: BriefingSchedule[];
}

interface BriefingSettingsProps {
  preferences: BriefingPreferences;
  onUpdate: (updates: Partial<BriefingPreferences>) => void;
  onSave?: () => void;
}

// ============================================================================
// Default Preferences
// ============================================================================

const DEFAULT_PREFERENCES: BriefingPreferences = {
  verbosityLevel: 'standard',
  includeWeather: true,
  includeTraffic: true,
  includeQuotes: true,
  audioEnabled: true,
  audioAutoPlay: false,
  audioSpeed: 1.0,
  timezone: 'America/New_York',
  schedules: [
    { type: 'morning', enabled: true, time: '07:00', days: [1, 2, 3, 4, 5], notificationChannel: 'push' },
    { type: 'evening', enabled: true, time: '18:00', days: [1, 2, 3, 4, 5], notificationChannel: 'push' },
    { type: 'weekly', enabled: true, time: '09:00', days: [1], notificationChannel: 'email' },
  ],
};

// ============================================================================
// Briefing Type Config
// ============================================================================

const BRIEFING_TYPE_CONFIG: Record<BriefingType, { icon: string; color: string; label: string; description: string }> = {
  morning: {
    icon: 'sunny',
    color: ORACLE_COLORS.orient,
    label: 'Morning Briefing',
    description: 'Start your day with priorities, meetings, and deadlines',
  },
  evening: {
    icon: 'moon',
    color: ORACLE_COLORS.observe,
    label: 'Evening Briefing',
    description: 'Review accomplishments and prepare for tomorrow',
  },
  weekly: {
    icon: 'calendar',
    color: ORACLE_COLORS.act,
    label: 'Weekly Briefing',
    description: 'Week in review with trends and goal progress',
  },
  sitrep: {
    icon: 'radio',
    color: '#FF6B6B',
    label: 'Situation Report',
    description: 'Real-time status of critical issues and risks',
  },
  executive: {
    icon: 'briefcase',
    color: '#9C27B0',
    label: 'Executive Summary',
    description: 'High-level KPIs and strategic updates',
  },
};

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const NOTIFICATION_CHANNELS: { value: NotificationChannel; label: string; icon: string }[] = [
  { value: 'push', label: 'Push', icon: 'notifications' },
  { value: 'email', label: 'Email', icon: 'mail' },
  { value: 'slack', label: 'Slack', icon: 'chatbubbles' },
  { value: 'none', label: 'None', icon: 'notifications-off' },
];

// ============================================================================
// Schedule Editor Modal
// ============================================================================

interface ScheduleEditorModalProps {
  visible: boolean;
  schedule: BriefingSchedule;
  onClose: () => void;
  onSave: (schedule: BriefingSchedule) => void;
}

const ScheduleEditorModal: React.FC<ScheduleEditorModalProps> = ({
  visible,
  schedule,
  onClose,
  onSave,
}) => {
  const [localSchedule, setLocalSchedule] = useState<BriefingSchedule>(schedule);
  const config = BRIEFING_TYPE_CONFIG[schedule.type];

  const toggleDay = (day: number) => {
    const days = localSchedule.days.includes(day)
      ? localSchedule.days.filter((d) => d !== day)
      : [...localSchedule.days, day].sort();
    setLocalSchedule({ ...localSchedule, days });
  };

  const updateTime = (adjustment: number) => {
    const [hours, minutes] = localSchedule.time.split(':').map(Number);
    let totalMinutes = hours * 60 + minutes + adjustment;
    if (totalMinutes < 0) totalMinutes = 24 * 60 - 30;
    if (totalMinutes >= 24 * 60) totalMinutes = 0;
    const newHours = Math.floor(totalMinutes / 60);
    const newMinutes = totalMinutes % 60;
    setLocalSchedule({
      ...localSchedule,
      time: `${newHours.toString().padStart(2, '0')}:${newMinutes.toString().padStart(2, '0')}`,
    });
  };

  const formatTime = (time: string): string => {
    const [hours, minutes] = time.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={[styles.modalIconContainer, { backgroundColor: `${config.color}20` }]}>
              <Ionicons name={config.icon as any} size={24} color={config.color} />
            </View>
            <View style={styles.modalTitleContainer}>
              <Text style={styles.modalTitle}>{config.label}</Text>
              <Text style={styles.modalSubtitle}>Configure schedule</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#888" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            {/* Enable/Disable */}
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Enabled</Text>
              <Switch
                value={localSchedule.enabled}
                onValueChange={(enabled) => setLocalSchedule({ ...localSchedule, enabled })}
                trackColor={{ false: '#333', true: `${config.color}60` }}
                thumbColor={localSchedule.enabled ? config.color : '#666'}
              />
            </View>

            {/* Time Picker */}
            <View style={styles.timeSection}>
              <Text style={styles.sectionTitle}>Delivery Time</Text>
              <View style={styles.timePickerRow}>
                <TouchableOpacity
                  style={styles.timeButton}
                  onPress={() => updateTime(-30)}
                >
                  <Ionicons name="remove" size={24} color="#FFF" />
                </TouchableOpacity>
                <View style={styles.timeDisplay}>
                  <Text style={styles.timeText}>{formatTime(localSchedule.time)}</Text>
                </View>
                <TouchableOpacity
                  style={styles.timeButton}
                  onPress={() => updateTime(30)}
                >
                  <Ionicons name="add" size={24} color="#FFF" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Days Selection */}
            <View style={styles.daysSection}>
              <Text style={styles.sectionTitle}>Days</Text>
              <View style={styles.daysRow}>
                {DAYS_OF_WEEK.map((day, index) => (
                  <TouchableOpacity
                    key={day}
                    style={[
                      styles.dayButton,
                      localSchedule.days.includes(index) && {
                        backgroundColor: config.color,
                      },
                    ]}
                    onPress={() => toggleDay(index)}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        localSchedule.days.includes(index) && styles.dayTextActive,
                      ]}
                    >
                      {day}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Notification Channel */}
            <View style={styles.channelSection}>
              <Text style={styles.sectionTitle}>Notification</Text>
              <View style={styles.channelOptions}>
                {NOTIFICATION_CHANNELS.map((channel) => (
                  <TouchableOpacity
                    key={channel.value}
                    style={[
                      styles.channelOption,
                      localSchedule.notificationChannel === channel.value && {
                        borderColor: config.color,
                        backgroundColor: `${config.color}10`,
                      },
                    ]}
                    onPress={() =>
                      setLocalSchedule({ ...localSchedule, notificationChannel: channel.value })
                    }
                  >
                    <Ionicons
                      name={channel.icon as any}
                      size={20}
                      color={
                        localSchedule.notificationChannel === channel.value
                          ? config.color
                          : '#888'
                      }
                    />
                    <Text
                      style={[
                        styles.channelText,
                        localSchedule.notificationChannel === channel.value && {
                          color: config.color,
                        },
                      ]}
                    >
                      {channel.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </ScrollView>

          {/* Actions */}
          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: config.color }]}
              onPress={() => {
                onSave(localSchedule);
                onClose();
              }}
            >
              <Text style={styles.saveButtonText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// ============================================================================
// Main BriefingSettings Component
// ============================================================================

export const BriefingSettings: React.FC<BriefingSettingsProps> = ({
  preferences = DEFAULT_PREFERENCES,
  onUpdate,
  onSave,
}) => {
  const insets = useSafeAreaInsets();
  const [editingSchedule, setEditingSchedule] = useState<BriefingSchedule | null>(null);

  const updateSchedule = useCallback(
    (updatedSchedule: BriefingSchedule) => {
      const schedules = preferences.schedules.map((s) =>
        s.type === updatedSchedule.type ? updatedSchedule : s
      );
      onUpdate({ schedules });
    },
    [preferences.schedules, onUpdate]
  );

  const formatScheduleSummary = (schedule: BriefingSchedule): string => {
    if (!schedule.enabled) return 'Disabled';

    const [hours, minutes] = schedule.time.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    const timeStr = `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;

    if (schedule.days.length === 7) return `Daily at ${timeStr}`;
    if (schedule.days.length === 5 && !schedule.days.includes(0) && !schedule.days.includes(6)) {
      return `Weekdays at ${timeStr}`;
    }
    if (schedule.days.length === 1) {
      return `${DAYS_OF_WEEK[schedule.days[0]]} at ${timeStr}`;
    }

    const dayNames = schedule.days.map((d) => DAYS_OF_WEEK[d].slice(0, 1)).join('');
    return `${dayNames} at ${timeStr}`;
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Schedules Section */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>SCHEDULED BRIEFINGS</Text>
          {preferences.schedules.map((schedule) => {
            const config = BRIEFING_TYPE_CONFIG[schedule.type];
            return (
              <TouchableOpacity
                key={schedule.type}
                style={styles.scheduleCard}
                onPress={() => setEditingSchedule(schedule)}
              >
                <View style={[styles.scheduleIcon, { backgroundColor: `${config.color}20` }]}>
                  <Ionicons name={config.icon as any} size={22} color={config.color} />
                </View>
                <View style={styles.scheduleInfo}>
                  <Text style={styles.scheduleName}>{config.label}</Text>
                  <Text style={styles.scheduleDescription}>{config.description}</Text>
                  <Text
                    style={[
                      styles.scheduleSummary,
                      schedule.enabled ? { color: config.color } : styles.scheduleDisabled,
                    ]}
                  >
                    {formatScheduleSummary(schedule)}
                  </Text>
                </View>
                <View style={styles.scheduleStatus}>
                  <View
                    style={[
                      styles.statusDot,
                      { backgroundColor: schedule.enabled ? config.color : '#444' },
                    ]}
                  />
                  <Ionicons name="chevron-forward" size={20} color="#888" />
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Content Preferences Section */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>CONTENT</Text>

          <View style={styles.settingCard}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Verbosity Level</Text>
                <Text style={styles.settingHint}>How detailed should briefings be</Text>
              </View>
              <View style={styles.segmentedControl}>
                {(['concise', 'standard', 'detailed'] as VerbosityLevel[]).map((level) => (
                  <TouchableOpacity
                    key={level}
                    style={[
                      styles.segmentButton,
                      preferences.verbosityLevel === level && styles.segmentButtonActive,
                    ]}
                    onPress={() => onUpdate({ verbosityLevel: level })}
                  >
                    <Text
                      style={[
                        styles.segmentText,
                        preferences.verbosityLevel === level && styles.segmentTextActive,
                      ]}
                    >
                      {level.charAt(0).toUpperCase() + level.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Include Weather</Text>
                <Text style={styles.settingHint}>Weather forecast in morning briefings</Text>
              </View>
              <Switch
                value={preferences.includeWeather}
                onValueChange={(includeWeather) => onUpdate({ includeWeather })}
                trackColor={{ false: '#333', true: `${ORACLE_COLORS.observe}60` }}
                thumbColor={preferences.includeWeather ? ORACLE_COLORS.observe : '#666'}
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Include Traffic</Text>
                <Text style={styles.settingHint}>Commute information in morning briefings</Text>
              </View>
              <Switch
                value={preferences.includeTraffic}
                onValueChange={(includeTraffic) => onUpdate({ includeTraffic })}
                trackColor={{ false: '#333', true: `${ORACLE_COLORS.observe}60` }}
                thumbColor={preferences.includeTraffic ? ORACLE_COLORS.observe : '#666'}
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Motivational Quotes</Text>
                <Text style={styles.settingHint}>Include quotes in briefings</Text>
              </View>
              <Switch
                value={preferences.includeQuotes}
                onValueChange={(includeQuotes) => onUpdate({ includeQuotes })}
                trackColor={{ false: '#333', true: `${ORACLE_COLORS.observe}60` }}
                thumbColor={preferences.includeQuotes ? ORACLE_COLORS.observe : '#666'}
              />
            </View>
          </View>
        </View>

        {/* Audio Settings Section */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>AUDIO</Text>

          <View style={styles.settingCard}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Audio Briefings</Text>
                <Text style={styles.settingHint}>Enable text-to-speech playback</Text>
              </View>
              <Switch
                value={preferences.audioEnabled}
                onValueChange={(audioEnabled) => onUpdate({ audioEnabled })}
                trackColor={{ false: '#333', true: `${ORACLE_COLORS.observe}60` }}
                thumbColor={preferences.audioEnabled ? ORACLE_COLORS.observe : '#666'}
              />
            </View>

            {preferences.audioEnabled && (
              <>
                <View style={styles.divider} />

                <View style={styles.settingRow}>
                  <View style={styles.settingInfo}>
                    <Text style={styles.settingLabel}>Auto-Play</Text>
                    <Text style={styles.settingHint}>Play audio automatically on open</Text>
                  </View>
                  <Switch
                    value={preferences.audioAutoPlay}
                    onValueChange={(audioAutoPlay) => onUpdate({ audioAutoPlay })}
                    trackColor={{ false: '#333', true: `${ORACLE_COLORS.observe}60` }}
                    thumbColor={preferences.audioAutoPlay ? ORACLE_COLORS.observe : '#666'}
                  />
                </View>

                <View style={styles.divider} />

                <View style={styles.settingRow}>
                  <View style={styles.settingInfo}>
                    <Text style={styles.settingLabel}>Playback Speed</Text>
                    <Text style={styles.settingHint}>Default audio speed</Text>
                  </View>
                  <View style={styles.speedOptions}>
                    {[0.75, 1.0, 1.25, 1.5].map((speed) => (
                      <TouchableOpacity
                        key={speed}
                        style={[
                          styles.speedButton,
                          preferences.audioSpeed === speed && styles.speedButtonActive,
                        ]}
                        onPress={() => onUpdate({ audioSpeed: speed })}
                      >
                        <Text
                          style={[
                            styles.speedButtonText,
                            preferences.audioSpeed === speed && styles.speedButtonTextActive,
                          ]}
                        >
                          {speed}x
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </>
            )}
          </View>
        </View>

        {/* Save Button */}
        {onSave && (
          <TouchableOpacity style={styles.saveMainButton} onPress={onSave}>
            <Text style={styles.saveMainButtonText}>Save Preferences</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Schedule Editor Modal */}
      {editingSchedule && (
        <ScheduleEditorModal
          visible={true}
          schedule={editingSchedule}
          onClose={() => setEditingSchedule(null)}
          onSave={updateSchedule}
        />
      )}
    </View>
  );
};

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  scrollContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '600',
    color: '#888',
    letterSpacing: 1,
    marginBottom: 12,
  },
  scheduleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
  },
  scheduleIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  scheduleInfo: {
    flex: 1,
  },
  scheduleName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 2,
  },
  scheduleDescription: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
  },
  scheduleSummary: {
    fontSize: 13,
    fontWeight: '500',
  },
  scheduleDisabled: {
    color: '#555',
  },
  scheduleStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  settingCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 16,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 48,
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#FFF',
    marginBottom: 2,
  },
  settingHint: {
    fontSize: 12,
    color: '#888',
  },
  divider: {
    height: 1,
    backgroundColor: '#333',
    marginVertical: 12,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: '#333',
    borderRadius: 8,
    padding: 2,
  },
  segmentButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  segmentButtonActive: {
    backgroundColor: ORACLE_COLORS.observe,
  },
  segmentText: {
    fontSize: 12,
    color: '#888',
  },
  segmentTextActive: {
    color: '#FFF',
    fontWeight: '600',
  },
  speedOptions: {
    flexDirection: 'row',
  },
  speedButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#333',
    borderRadius: 6,
    marginLeft: 6,
  },
  speedButtonActive: {
    backgroundColor: ORACLE_COLORS.observe,
  },
  speedButtonText: {
    fontSize: 12,
    color: '#888',
  },
  speedButtonTextActive: {
    color: '#FFF',
    fontWeight: '600',
  },
  saveMainButton: {
    backgroundColor: ORACLE_COLORS.observe,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  saveMainButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  modalIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  modalTitleContainer: {
    flex: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFF',
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#888',
  },
  modalBody: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  timeSection: {
    marginBottom: 24,
  },
  timePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  timeDisplay: {
    paddingHorizontal: 24,
  },
  timeText: {
    fontSize: 32,
    fontWeight: '600',
    color: '#FFF',
  },
  daysSection: {
    marginBottom: 24,
  },
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#888',
  },
  dayTextActive: {
    color: '#FFF',
  },
  channelSection: {
    marginBottom: 24,
  },
  channelOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  channelOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#333',
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  channelText: {
    fontSize: 13,
    color: '#888',
    marginLeft: 8,
  },
  modalActions: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    marginRight: 8,
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#888',
  },
  saveButton: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginLeft: 8,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
});

export default BriefingSettings;
