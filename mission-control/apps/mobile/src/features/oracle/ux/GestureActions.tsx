/**
 * GestureActions Component
 * Story ux-1 - Gesture-Based Quick Actions
 *
 * Swipe gestures for rapid decisions:
 * - Swipe right = approve (green feedback)
 * - Swipe left = defer (yellow feedback)
 * - Swipe up = escalate (red feedback)
 * - Swipe down = dismiss (gray feedback)
 *
 * Features:
 * - Uses react-native-gesture-handler for smooth gestures
 * - Haptic feedback with expo-haptics
 * - Visual feedback animations
 * - Configurable thresholds and actions
 */
import React, { useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  Animated,
  StyleSheet,
  Dimensions,
} from 'react-native';
import {
  PanGestureHandler,
  PanGestureHandlerGestureEvent,
  State,
} from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useUXStore, useUXSelectors } from '../../../store/oracle/uxStore';
import { ORACLE_COLORS, ORACLE_TIMING } from '../theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SWIPE_THRESHOLD = 80;
const VELOCITY_THRESHOLD = 500;

// Gesture action types
export interface GestureAction {
  direction: 'left' | 'right' | 'up' | 'down';
  action: 'approve' | 'defer' | 'escalate' | 'dismiss';
  color: string;
  icon: string;
  hapticStyle: 'light' | 'medium' | 'heavy';
  label: string;
}

// Default gesture action mapping
const GESTURE_ACTIONS: GestureAction[] = [
  {
    direction: 'right',
    action: 'approve',
    color: '#00FF88', // Green
    icon: 'checkmark-circle',
    hapticStyle: 'medium',
    label: 'Approve',
  },
  {
    direction: 'left',
    action: 'defer',
    color: '#FFD700', // Yellow
    icon: 'time',
    hapticStyle: 'light',
    label: 'Defer',
  },
  {
    direction: 'up',
    action: 'escalate',
    color: '#FF4444', // Red
    icon: 'arrow-up-circle',
    hapticStyle: 'heavy',
    label: 'Escalate',
  },
  {
    direction: 'down',
    action: 'dismiss',
    color: '#808080', // Gray
    icon: 'close-circle',
    hapticStyle: 'light',
    label: 'Dismiss',
  },
];

interface GestureActionsProps {
  children: React.ReactNode;
  onAction: (action: GestureAction['action']) => void;
  enabled?: boolean;
  itemId?: string;
  showHints?: boolean;
}

/**
 * GestureActions wrapper component
 * Wraps children with swipe gesture detection
 *
 * Time Complexity: O(1) for gesture handling
 * Space Complexity: O(1) for animation values
 */
export const GestureActions: React.FC<GestureActionsProps> = ({
  children,
  onAction,
  enabled = true,
  itemId,
  showHints = false,
}) => {
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const feedbackOpacity = useRef(new Animated.Value(0)).current;
  const feedbackScale = useRef(new Animated.Value(0.8)).current;
  const activeActionRef = useRef<GestureAction | null>(null);

  const { gesturesEnabled, gestureConfig, hapticEnabled } = useUXStore();

  // Get the action based on current gesture direction
  const getActionForDirection = useCallback((dx: number, dy: number): GestureAction | null => {
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    const threshold = gestureConfig.swipeThreshold || SWIPE_THRESHOLD;

    // Determine primary direction
    if (absDx > absDy && absDx > threshold) {
      return GESTURE_ACTIONS.find((a) => a.direction === (dx > 0 ? 'right' : 'left')) || null;
    } else if (absDy > absDx && absDy > threshold) {
      return GESTURE_ACTIONS.find((a) => a.direction === (dy < 0 ? 'up' : 'down')) || null;
    }
    return null;
  }, [gestureConfig.swipeThreshold]);

  // Trigger haptic feedback
  const triggerHaptic = useCallback(async (style: GestureAction['hapticStyle']) => {
    if (!hapticEnabled || !gestureConfig.hapticEnabled) return;

    try {
      switch (style) {
        case 'light':
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          break;
        case 'medium':
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          break;
        case 'heavy':
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          break;
      }
    } catch (error) {
      // Haptics may not be available on all devices
      console.warn('Haptic feedback not available:', error);
    }
  }, [hapticEnabled, gestureConfig.hapticEnabled]);

  // Show visual feedback for action
  const showFeedback = useCallback((action: GestureAction) => {
    activeActionRef.current = action;

    Animated.parallel([
      Animated.spring(feedbackOpacity, {
        toValue: 1,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }),
      Animated.spring(feedbackScale, {
        toValue: 1,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }),
    ]).start();
  }, [feedbackOpacity, feedbackScale]);

  // Hide visual feedback
  const hideFeedback = useCallback(() => {
    Animated.parallel([
      Animated.timing(feedbackOpacity, {
        toValue: 0,
        duration: ORACLE_TIMING.fadeOut,
        useNativeDriver: true,
      }),
      Animated.timing(feedbackScale, {
        toValue: 0.8,
        duration: ORACLE_TIMING.fadeOut,
        useNativeDriver: true,
      }),
    ]).start(() => {
      activeActionRef.current = null;
    });
  }, [feedbackOpacity, feedbackScale]);

  // Reset position with animation
  const resetPosition = useCallback(() => {
    Animated.parallel([
      Animated.spring(translateX, {
        toValue: 0,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }),
    ]).start();
  }, [translateX, translateY]);

  // Execute action with animation
  const executeAction = useCallback((action: GestureAction) => {
    // Trigger haptic
    triggerHaptic(action.hapticStyle);

    // Show feedback
    showFeedback(action);

    // Animate out in the direction of the swipe
    const toX = action.direction === 'left' ? -SCREEN_WIDTH : action.direction === 'right' ? SCREEN_WIDTH : 0;
    const toY = action.direction === 'up' ? -SCREEN_HEIGHT : action.direction === 'down' ? SCREEN_HEIGHT : 0;

    Animated.timing(action.direction === 'left' || action.direction === 'right' ? translateX : translateY, {
      toValue: action.direction === 'left' || action.direction === 'right' ? toX : toY,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      // Call the action handler
      onAction(action.action);

      // Reset after a brief delay
      setTimeout(() => {
        translateX.setValue(0);
        translateY.setValue(0);
        hideFeedback();
      }, 100);
    });
  }, [onAction, triggerHaptic, showFeedback, hideFeedback, translateX, translateY]);

  // Handle gesture events
  const onGestureEvent = useCallback(
    (event: PanGestureHandlerGestureEvent) => {
      if (!enabled || !gesturesEnabled) return;

      const { translationX, translationY } = event.nativeEvent;

      translateX.setValue(translationX);
      translateY.setValue(translationY);

      // Update visual feedback based on current position
      const action = getActionForDirection(translationX, translationY);
      if (action && action !== activeActionRef.current) {
        showFeedback(action);
        // Light haptic on direction change
        triggerHaptic('light');
      } else if (!action && activeActionRef.current) {
        hideFeedback();
      }
    },
    [enabled, gesturesEnabled, translateX, translateY, getActionForDirection, showFeedback, hideFeedback, triggerHaptic]
  );

  // Handle gesture state changes
  const onHandlerStateChange = useCallback(
    (event: PanGestureHandlerGestureEvent) => {
      if (!enabled || !gesturesEnabled) return;

      const { state, translationX, translationY, velocityX, velocityY } = event.nativeEvent;

      if (state === State.END) {
        const action = getActionForDirection(translationX, translationY);

        // Check if swipe was fast enough or far enough
        const isFastEnough = Math.abs(velocityX) > VELOCITY_THRESHOLD || Math.abs(velocityY) > VELOCITY_THRESHOLD;
        const threshold = gestureConfig.swipeThreshold || SWIPE_THRESHOLD;
        const isFarEnough = Math.abs(translationX) > threshold || Math.abs(translationY) > threshold;

        if (action && (isFastEnough || isFarEnough)) {
          executeAction(action);
        } else {
          resetPosition();
          hideFeedback();
        }
      }
    },
    [enabled, gesturesEnabled, getActionForDirection, gestureConfig.swipeThreshold, executeAction, resetPosition, hideFeedback]
  );

  if (!enabled || !gesturesEnabled) {
    return <>{children}</>;
  }

  // Calculate feedback background color based on active action
  const feedbackColor = activeActionRef.current?.color || '#00FF88';

  return (
    <View style={styles.container}>
      {/* Action hints */}
      {showHints && (
        <View style={styles.hintsContainer}>
          {GESTURE_ACTIONS.map((action) => (
            <View
              key={action.direction}
              style={[
                styles.hint,
                (styles as any)[`hint${action.direction.charAt(0).toUpperCase() + action.direction.slice(1)}`],
              ]}
            >
              <Ionicons name={action.icon as any} size={16} color={action.color} />
              <Text style={[styles.hintText, { color: action.color }]}>{action.label}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Visual feedback overlay */}
      <Animated.View
        style={[
          styles.feedbackOverlay,
          {
            opacity: feedbackOpacity,
            transform: [{ scale: feedbackScale }],
            backgroundColor: activeActionRef.current?.color || 'transparent',
          },
        ]}
        pointerEvents="none"
      >
        {activeActionRef.current && (
          <View style={styles.feedbackContent}>
            <Ionicons
              name={activeActionRef.current.icon as any}
              size={48}
              color="#FFFFFF"
            />
            <Text style={styles.feedbackText}>{activeActionRef.current.label}</Text>
          </View>
        )}
      </Animated.View>

      {/* Gesture handler wrapper */}
      <PanGestureHandler
        onGestureEvent={onGestureEvent}
        onHandlerStateChange={onHandlerStateChange}
        activeOffsetX={[-10, 10]}
        activeOffsetY={[-10, 10]}
      >
        <Animated.View
          style={[
            styles.gestureContainer,
            {
              transform: [
                { translateX: translateX },
                { translateY: translateY },
              ],
            },
          ]}
        >
          {children}
        </Animated.View>
      </PanGestureHandler>
    </View>
  );
};

/**
 * GestureActionCard - A pre-styled card with gesture actions
 */
interface GestureActionCardProps {
  title: string;
  description?: string;
  urgency?: 'low' | 'medium' | 'high' | 'critical';
  onAction: (action: GestureAction['action']) => void;
  children?: React.ReactNode;
}

export const GestureActionCard: React.FC<GestureActionCardProps> = ({
  title,
  description,
  urgency = 'medium',
  onAction,
  children,
}) => {
  const urgencyColors = {
    low: ORACLE_COLORS.act,
    medium: ORACLE_COLORS.orient,
    high: '#FF6B6B',
    critical: '#FF4444',
  };

  return (
    <GestureActions onAction={onAction} showHints>
      <View style={[styles.card, { borderLeftColor: urgencyColors[urgency] }]}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{title}</Text>
          <View style={[styles.urgencyBadge, { backgroundColor: urgencyColors[urgency] }]}>
            <Text style={styles.urgencyText}>{urgency.toUpperCase()}</Text>
          </View>
        </View>
        {description && <Text style={styles.cardDescription}>{description}</Text>}
        {children}
        <View style={styles.cardFooter}>
          <Text style={styles.swipeHint}>Swipe to take action</Text>
        </View>
      </View>
    </GestureActions>
  );
};

/**
 * Hook to use gesture actions programmatically
 */
export const useGestureActions = () => {
  const { gesturesEnabled, gestureConfig, hapticEnabled, setGesturesEnabled, updateGestureConfig } = useUXStore();

  const triggerHaptic = useCallback(async (style: GestureAction['hapticStyle']) => {
    if (!hapticEnabled || !gestureConfig.hapticEnabled) return;

    try {
      switch (style) {
        case 'light':
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          break;
        case 'medium':
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          break;
        case 'heavy':
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          break;
      }
    } catch (error) {
      console.warn('Haptic feedback not available:', error);
    }
  }, [hapticEnabled, gestureConfig.hapticEnabled]);

  const triggerNotification = useCallback(async (type: 'success' | 'warning' | 'error') => {
    if (!hapticEnabled) return;

    try {
      switch (type) {
        case 'success':
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          break;
        case 'warning':
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          break;
        case 'error':
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          break;
      }
    } catch (error) {
      console.warn('Haptic notification not available:', error);
    }
  }, [hapticEnabled]);

  return {
    gesturesEnabled,
    gestureConfig,
    setGesturesEnabled,
    updateGestureConfig,
    triggerHaptic,
    triggerNotification,
    actions: GESTURE_ACTIONS,
  };
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  gestureContainer: {
    backgroundColor: 'transparent',
  },
  hintsContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: -1,
  },
  hint: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    opacity: 0.4,
  },
  hintRight: {
    right: -60,
  },
  hintLeft: {
    left: -60,
  },
  hintUp: {
    top: -40,
  },
  hintDown: {
    bottom: -40,
  },
  hintText: {
    fontSize: 10,
    fontWeight: 'bold',
    marginLeft: 4,
    textTransform: 'uppercase',
  },
  feedbackOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    zIndex: 10,
  },
  feedbackContent: {
    alignItems: 'center',
  },
  feedbackText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 8,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    marginVertical: 6,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    flex: 1,
  },
  urgencyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  urgencyText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#000000',
  },
  cardDescription: {
    fontSize: 14,
    color: '#AAAAAA',
    lineHeight: 20,
    marginBottom: 12,
  },
  cardFooter: {
    borderTopWidth: 1,
    borderTopColor: '#333333',
    paddingTop: 12,
    marginTop: 8,
  },
  swipeHint: {
    fontSize: 12,
    color: '#666666',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default GestureActions;
