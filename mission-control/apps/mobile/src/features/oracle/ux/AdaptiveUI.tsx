/**
 * AdaptiveUI Component
 * Story ux-3 - Adaptive UI Context System
 *
 * Features:
 * - Context modes: meeting, deepwork, planning, commute, default
 * - Calendar-based auto-detection
 * - Manual override controls
 * - Mode-specific layouts
 * - Transition animations between modes
 *
 * Time Complexity: O(n) for rendering mode options
 * Space Complexity: O(1) for animation values
 */
import React, { useEffect, useRef, useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  StyleSheet,
  Modal,
  ScrollView,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  useAdaptiveStore,
  useAdaptiveSelectors,
  ContextMode,
} from '../../../store/oracle/adaptiveStore';
import { useUXStore } from '../../../store/oracle/uxStore';
import { ORACLE_COLORS, ORACLE_TIMING } from '../theme';

// Mode configuration for display
interface ModeConfig {
  name: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  features: string[];
}

const MODE_CONFIGS: Record<ContextMode, ModeConfig> = {
  meeting: {
    name: 'Meeting Mode',
    description: 'Simplified UI for active meetings',
    icon: 'people',
    color: '#FF6B6B',
    features: ['Quick actions only', 'Critical alerts', 'Audio muted'],
  },
  deepwork: {
    name: 'Deep Work',
    description: 'Focused mode for concentrated work',
    icon: 'code',
    color: '#00BFFF',
    features: ['Minimal distractions', 'No notifications', 'Progress tracking'],
  },
  planning: {
    name: 'Planning Mode',
    description: 'Expanded view for planning sessions',
    icon: 'calendar',
    color: '#FFD700',
    features: ['Full dashboard', 'Risk analysis', 'Decision tools'],
  },
  commute: {
    name: 'Commute Mode',
    description: 'Audio-first interface for travel',
    icon: 'car',
    color: '#9B59B6',
    features: ['Voice control', 'Large buttons', 'Audio briefings'],
  },
  default: {
    name: 'Default Mode',
    description: 'Standard ORACLE experience',
    icon: 'apps',
    color: '#00FF88',
    features: ['All features', 'Full notifications', 'Standard layout'],
  },
};

interface AdaptiveUIProps {
  onContextChange?: (context: ContextMode) => void;
  showModeSelector?: boolean;
  showStatusBar?: boolean;
}

/**
 * AdaptiveUI Context Provider and Mode Indicator
 * Provides context-aware UI adaptation with visual transitions
 */
export const AdaptiveUI: React.FC<AdaptiveUIProps> = ({
  onContextChange,
  showModeSelector = true,
  showStatusBar = true,
}) => {
  const [showModeModal, setShowModeModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  const {
    currentContext,
    autoDetect,
    manualOverride,
    isTransitioning,
    transitionProgress,
    setContext,
    setAutoDetect,
    setManualOverride,
    clearOverride,
    runAutoDetection,
    endTransition,
  } = useAdaptiveStore();

  const modePreferences = useAdaptiveSelectors.currentModePreferences();
  const contextInfo = useAdaptiveSelectors.contextDisplayInfo();
  const isOverrideActive = useAdaptiveSelectors.isOverrideActive();
  const overrideTimeRemaining = useAdaptiveSelectors.overrideTimeRemaining();

  const { hapticEnabled } = useUXStore();

  // Animation values
  const modeColorAnim = useRef(new Animated.Value(0)).current;
  const modeScaleAnim = useRef(new Animated.Value(1)).current;
  const transitionAnim = useRef(new Animated.Value(0)).current;

  // Previous context for transition animation
  const previousContextRef = useRef<ContextMode>(currentContext);

  // Run auto-detection on mount and periodically
  useEffect(() => {
    if (autoDetect && !manualOverride) {
      runAutoDetection();
      const interval = setInterval(runAutoDetection, 60000); // Check every minute
      return () => clearInterval(interval);
    }
  }, [autoDetect, manualOverride, runAutoDetection]);

  // Animate mode transitions
  useEffect(() => {
    if (previousContextRef.current !== currentContext) {
      // Trigger transition animation
      Animated.sequence([
        Animated.parallel([
          Animated.timing(modeScaleAnim, {
            toValue: 0.9,
            duration: 150,
            useNativeDriver: true,
          }),
          Animated.timing(modeColorAnim, {
            toValue: 0,
            duration: 150,
            useNativeDriver: false,
          }),
        ]),
        Animated.parallel([
          Animated.spring(modeScaleAnim, {
            toValue: 1,
            useNativeDriver: true,
            tension: 100,
            friction: 8,
          }),
          Animated.timing(modeColorAnim, {
            toValue: 1,
            duration: modePreferences?.transitionDuration || 400,
            useNativeDriver: false,
          }),
        ]),
      ]).start(() => {
        endTransition();
        onContextChange?.(currentContext);
      });

      // Haptic feedback on mode change
      if (hapticEnabled) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }

      previousContextRef.current = currentContext;
    }
  }, [currentContext, modePreferences, hapticEnabled, onContextChange, endTransition, modeColorAnim, modeScaleAnim]);

  // Transition progress animation
  useEffect(() => {
    if (isTransitioning) {
      Animated.timing(transitionAnim, {
        toValue: transitionProgress,
        duration: 100,
        useNativeDriver: false,
      }).start();
    }
  }, [isTransitioning, transitionProgress, transitionAnim]);

  // Handle mode selection
  const handleModeSelect = useCallback((mode: ContextMode) => {
    if (hapticEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setManualOverride(mode, 3600000); // 1 hour override
    setShowModeModal(false);
  }, [setManualOverride, hapticEnabled]);

  // Handle override clear
  const handleClearOverride = useCallback(() => {
    if (hapticEnabled) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    clearOverride();
  }, [clearOverride, hapticEnabled]);

  // Format remaining time
  const formatTimeRemaining = (ms: number): string => {
    const minutes = Math.floor(ms / 60000);
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return `${hours}h ${mins}m`;
    }
    return `${minutes}m`;
  };

  const currentConfig = MODE_CONFIGS[currentContext];

  // Interpolate background color for transition
  const backgroundColor = modeColorAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [
      MODE_CONFIGS[previousContextRef.current].color + '20',
      currentConfig.color + '20',
    ],
  });

  return (
    <View style={styles.container}>
      {/* Status Bar */}
      {showStatusBar && (
        <Animated.View
          style={[
            styles.statusBar,
            {
              backgroundColor,
              transform: [{ scale: modeScaleAnim }],
            },
          ]}
        >
          <View style={styles.statusContent}>
            <View style={styles.modeInfo}>
              <View style={[styles.modeIcon, { backgroundColor: currentConfig.color }]}>
                <Ionicons name={currentConfig.icon} size={16} color="#000000" />
              </View>
              <View style={styles.modeTextContainer}>
                <Text style={[styles.modeName, { color: currentConfig.color }]}>
                  {currentConfig.name}
                </Text>
                {isOverrideActive && (
                  <Text style={styles.overrideText}>
                    Override: {formatTimeRemaining(overrideTimeRemaining)}
                  </Text>
                )}
              </View>
            </View>

            <View style={styles.statusActions}>
              {isOverrideActive && (
                <TouchableOpacity
                  style={styles.clearButton}
                  onPress={handleClearOverride}
                >
                  <Ionicons name="close-circle" size={20} color="#888888" />
                </TouchableOpacity>
              )}

              {showModeSelector && (
                <TouchableOpacity
                  style={styles.modeSelectorButton}
                  onPress={() => setShowModeModal(true)}
                >
                  <Ionicons name="chevron-down" size={20} color={currentConfig.color} />
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.settingsButton}
                onPress={() => setShowSettingsModal(true)}
              >
                <Ionicons name="settings-outline" size={20} color="#888888" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Transition progress indicator */}
          {isTransitioning && (
            <Animated.View
              style={[
                styles.transitionBar,
                {
                  width: transitionAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                  backgroundColor: currentConfig.color,
                },
              ]}
            />
          )}
        </Animated.View>
      )}

      {/* Mode Selection Modal */}
      <Modal
        visible={showModeModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowModeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Mode</Text>
              <TouchableOpacity onPress={() => setShowModeModal(false)}>
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modeList}>
              {(Object.keys(MODE_CONFIGS) as ContextMode[]).map((mode) => {
                const config = MODE_CONFIGS[mode];
                const isActive = mode === currentContext;

                return (
                  <TouchableOpacity
                    key={mode}
                    style={[
                      styles.modeItem,
                      isActive && { borderColor: config.color },
                    ]}
                    onPress={() => handleModeSelect(mode)}
                  >
                    <View style={[styles.modeItemIcon, { backgroundColor: config.color }]}>
                      <Ionicons name={config.icon} size={24} color="#000000" />
                    </View>
                    <View style={styles.modeItemContent}>
                      <Text style={[styles.modeItemName, isActive && { color: config.color }]}>
                        {config.name}
                      </Text>
                      <Text style={styles.modeItemDescription}>{config.description}</Text>
                      <View style={styles.modeFeatures}>
                        {config.features.map((feature, index) => (
                          <View key={index} style={styles.featureBadge}>
                            <Text style={styles.featureText}>{feature}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                    {isActive && (
                      <Ionicons name="checkmark-circle" size={24} color={config.color} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Settings Modal */}
      <Modal
        visible={showSettingsModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowSettingsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Adaptive UI Settings</Text>
              <TouchableOpacity onPress={() => setShowSettingsModal(false)}>
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.settingsList}>
              <View style={styles.settingItem}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>Auto-Detect Context</Text>
                  <Text style={styles.settingDescription}>
                    Automatically switch modes based on calendar and time
                  </Text>
                </View>
                <Switch
                  value={autoDetect}
                  onValueChange={setAutoDetect}
                  trackColor={{ false: '#333333', true: ORACLE_COLORS.act + '60' }}
                  thumbColor={autoDetect ? ORACLE_COLORS.act : '#888888'}
                />
              </View>

              <View style={styles.settingItem}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>Notifications</Text>
                  <Text style={styles.settingDescription}>
                    {modePreferences?.notificationsEnabled ? 'Enabled' : 'Disabled'} ({modePreferences?.notificationPriority} priority)
                  </Text>
                </View>
                <Ionicons
                  name={modePreferences?.notificationsEnabled ? 'notifications' : 'notifications-off'}
                  size={24}
                  color={modePreferences?.notificationsEnabled ? ORACLE_COLORS.act : '#888888'}
                />
              </View>

              <View style={styles.settingItem}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>Voice Control</Text>
                  <Text style={styles.settingDescription}>
                    {modePreferences?.voiceEnabled ? 'Active in this mode' : 'Disabled in this mode'}
                  </Text>
                </View>
                <Ionicons
                  name={modePreferences?.voiceEnabled ? 'mic' : 'mic-off'}
                  size={24}
                  color={modePreferences?.voiceEnabled ? ORACLE_COLORS.observe : '#888888'}
                />
              </View>

              <View style={styles.settingItem}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>Gestures</Text>
                  <Text style={styles.settingDescription}>
                    {modePreferences?.gesturesEnabled ? 'Active in this mode' : 'Disabled in this mode'}
                  </Text>
                </View>
                <Ionicons
                  name={modePreferences?.gesturesEnabled ? 'hand-left' : 'hand-left-outline'}
                  size={24}
                  color={modePreferences?.gesturesEnabled ? ORACLE_COLORS.orient : '#888888'}
                />
              </View>

              <View style={styles.settingItem}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>Dashboard Layout</Text>
                  <Text style={styles.settingDescription}>
                    Using "{modePreferences?.dashboardLayout}" layout
                  </Text>
                </View>
                <Ionicons name="grid" size={24} color={ORACLE_COLORS.observe} />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

/**
 * ModeIndicator - Compact mode indicator for headers
 */
interface ModeIndicatorProps {
  size?: 'small' | 'medium' | 'large';
  showName?: boolean;
  onPress?: () => void;
}

export const ModeIndicator: React.FC<ModeIndicatorProps> = ({
  size = 'medium',
  showName = true,
  onPress,
}) => {
  const { currentContext } = useAdaptiveStore();
  const config = MODE_CONFIGS[currentContext];

  const sizes = {
    small: { icon: 14, text: 10, padding: 6 },
    medium: { icon: 18, text: 12, padding: 8 },
    large: { icon: 24, text: 14, padding: 12 },
  };

  const s = sizes[size];

  return (
    <TouchableOpacity
      style={[
        styles.modeIndicator,
        { paddingHorizontal: s.padding, paddingVertical: s.padding / 2 },
        { backgroundColor: config.color + '20', borderColor: config.color },
      ]}
      onPress={onPress}
      disabled={!onPress}
    >
      <Ionicons name={config.icon} size={s.icon} color={config.color} />
      {showName && (
        <Text style={[styles.modeIndicatorText, { fontSize: s.text, color: config.color }]}>
          {config.name.split(' ')[0]}
        </Text>
      )}
    </TouchableOpacity>
  );
};

/**
 * ContextAwareWrapper - Wraps children with context-specific styling
 */
interface ContextAwareWrapperProps {
  children: React.ReactNode;
  applyOpacity?: boolean;
  applyBorder?: boolean;
}

export const ContextAwareWrapper: React.FC<ContextAwareWrapperProps> = ({
  children,
  applyOpacity = false,
  applyBorder = false,
}) => {
  const { currentContext, isTransitioning } = useAdaptiveStore();
  const config = MODE_CONFIGS[currentContext];

  return (
    <View
      style={[
        styles.contextWrapper,
        applyOpacity && { opacity: isTransitioning ? 0.7 : 1 },
        applyBorder && { borderColor: config.color, borderWidth: 1 },
      ]}
    >
      {children}
    </View>
  );
};

/**
 * Hook for using adaptive context in components
 */
export const useAdaptiveContext = () => {
  const {
    currentContext,
    autoDetect,
    manualOverride,
    isTransitioning,
    setManualOverride,
    clearOverride,
    runAutoDetection,
  } = useAdaptiveStore();

  const modePreferences = useAdaptiveSelectors.currentModePreferences();
  const contextInfo = useAdaptiveSelectors.contextDisplayInfo();

  return {
    context: currentContext,
    config: MODE_CONFIGS[currentContext],
    preferences: modePreferences,
    info: contextInfo,
    autoDetect,
    manualOverride,
    isTransitioning,
    setMode: setManualOverride,
    clearOverride,
    refresh: runAutoDetection,
    allModes: MODE_CONFIGS,
  };
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  statusBar: {
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    overflow: 'hidden',
  },
  statusContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
  },
  modeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  modeIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modeTextContainer: {
    marginLeft: 10,
  },
  modeName: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  overrideText: {
    fontSize: 10,
    color: '#888888',
    marginTop: 2,
  },
  statusActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clearButton: {
    padding: 4,
    marginRight: 8,
  },
  modeSelectorButton: {
    padding: 4,
    marginRight: 8,
  },
  settingsButton: {
    padding: 4,
  },
  transitionBar: {
    height: 2,
    position: 'absolute',
    bottom: 0,
    left: 0,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  modeList: {
    maxHeight: 400,
  },
  modeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#252525',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  modeItemIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modeItemContent: {
    flex: 1,
    marginLeft: 12,
  },
  modeItemName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  modeItemDescription: {
    fontSize: 12,
    color: '#888888',
    marginTop: 2,
  },
  modeFeatures: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  featureBadge: {
    backgroundColor: '#333333',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    marginRight: 6,
    marginBottom: 4,
  },
  featureText: {
    fontSize: 10,
    color: '#AAAAAA',
  },
  settingsList: {
    maxHeight: 400,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  settingDescription: {
    fontSize: 12,
    color: '#888888',
    marginTop: 2,
  },
  modeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
  },
  modeIndicatorText: {
    fontWeight: 'bold',
    marginLeft: 6,
  },
  contextWrapper: {
    flex: 1,
  },
});

export default AdaptiveUI;
