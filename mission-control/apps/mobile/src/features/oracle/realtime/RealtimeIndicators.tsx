/**
 * ORACLE Realtime Indicators
 * Story rt-3 - Visual indicators for realtime connection status
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Modal,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ORACLE_COLORS, ORACLE_TIMING, oracleStyles } from '../theme';
import { RealtimeConnectionStatus, ConnectionState } from '../../../hooks/useOracleRealtime';

const { width } = Dimensions.get('window');

// ============================================================================
// CONNECTION STATUS INDICATOR
// ============================================================================

interface ConnectionStatusIndicatorProps {
  status: RealtimeConnectionStatus;
  isOnline: boolean;
  showLabel?: boolean;
  size?: 'small' | 'medium' | 'large';
  onPress?: () => void;
}

export function ConnectionStatusIndicator({
  status,
  isOnline,
  showLabel = false,
  size = 'medium',
  onPress,
}: ConnectionStatusIndicatorProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  // Get status color
  const getStatusColor = useCallback(() => {
    if (!isOnline) return '#FF4444'; // Red for offline
    switch (status) {
      case 'connected':
        return '#00FF88'; // Green
      case 'connecting':
        return '#FFD700'; // Yellow
      case 'disconnected':
        return '#FF8C00'; // Orange
      case 'error':
        return '#FF4444'; // Red
      default:
        return '#808080'; // Gray
    }
  }, [status, isOnline]);

  const color = getStatusColor();

  // Pulse animation for connecting state
  useEffect(() => {
    if (status === 'connecting') {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.3,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [status, pulseAnim]);

  // Glow animation for connected state
  useEffect(() => {
    if (status === 'connected') {
      const glow = Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: false,
          }),
          Animated.timing(glowAnim, {
            toValue: 0,
            duration: 1500,
            useNativeDriver: false,
          }),
        ])
      );
      glow.start();
      return () => glow.stop();
    } else {
      glowAnim.setValue(0);
    }
  }, [status, glowAnim]);

  const sizeMap = {
    small: { dot: 8, container: 24 },
    medium: { dot: 12, container: 32 },
    large: { dot: 16, container: 40 },
  };

  const dimensions = sizeMap[size];

  const getStatusLabel = () => {
    if (!isOnline) return 'Offline';
    switch (status) {
      case 'connected':
        return 'Live';
      case 'connecting':
        return 'Connecting...';
      case 'disconnected':
        return 'Disconnected';
      case 'error':
        return 'Error';
      default:
        return 'Unknown';
    }
  };

  const content = (
    <View style={[styles.statusContainer, { height: dimensions.container }]}>
      <Animated.View
        style={[
          styles.statusDot,
          {
            width: dimensions.dot,
            height: dimensions.dot,
            borderRadius: dimensions.dot / 2,
            backgroundColor: color,
            transform: [{ scale: pulseAnim }],
            shadowColor: color,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: glowAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0.3, 0.8],
            }),
            shadowRadius: 8,
          },
        ]}
      />
      {showLabel && (
        <Text style={[styles.statusLabel, { color }]}>{getStatusLabel()}</Text>
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

// ============================================================================
// LIVE UPDATE PULSE
// ============================================================================

interface LiveUpdatePulseProps {
  isActive: boolean;
  color?: string;
  size?: number;
  children?: React.ReactNode;
}

export function LiveUpdatePulse({
  isActive,
  color = ORACLE_COLORS.act,
  size = 40,
  children,
}: LiveUpdatePulseProps) {
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isActive) {
      // Start pulse animation
      Animated.parallel([
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0,
            duration: 700,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(scaleAnim, {
            toValue: 1.1,
            duration: 150,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 150,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    }
  }, [isActive, pulseAnim, scaleAnim]);

  return (
    <View style={[styles.pulseContainer, { width: size, height: size }]}>
      <Animated.View
        style={[
          styles.pulseRing,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderColor: color,
            opacity: pulseAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 0.6],
            }),
            transform: [
              {
                scale: pulseAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 1.5],
                }),
              },
            ],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.pulseContent,
          {
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {children}
      </Animated.View>
    </View>
  );
}

// ============================================================================
// TOAST NOTIFICATION SYSTEM
// ============================================================================

export interface ToastNotification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'critical';
  title: string;
  message?: string;
  duration?: number;
  action?: {
    label: string;
    onPress: () => void;
  };
}

interface ToastContainerProps {
  notifications: ToastNotification[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ notifications, onDismiss }: ToastContainerProps) {
  return (
    <View style={styles.toastContainer} pointerEvents="box-none">
      {notifications.map((notification, index) => (
        <Toast
          key={notification.id}
          notification={notification}
          onDismiss={() => onDismiss(notification.id)}
          index={index}
        />
      ))}
    </View>
  );
}

interface ToastProps {
  notification: ToastNotification;
  onDismiss: () => void;
  index: number;
}

function Toast({ notification, onDismiss, index }: ToastProps) {
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Slide in
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto dismiss
    const duration = notification.duration || 4000;
    const timer = setTimeout(() => {
      dismissToast();
    }, duration);

    return () => clearTimeout(timer);
  }, []);

  const dismissToast = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => onDismiss());
  };

  const getTypeColor = () => {
    switch (notification.type) {
      case 'success':
        return ORACLE_COLORS.act;
      case 'warning':
        return ORACLE_COLORS.orient;
      case 'critical':
        return '#FF4444';
      case 'info':
      default:
        return ORACLE_COLORS.observe;
    }
  };

  const getTypeIcon = () => {
    switch (notification.type) {
      case 'success':
        return 'checkmark-circle';
      case 'warning':
        return 'warning';
      case 'critical':
        return 'alert-circle';
      case 'info':
      default:
        return 'information-circle';
    }
  };

  const color = getTypeColor();

  return (
    <Animated.View
      style={[
        styles.toast,
        {
          transform: [{ translateY: slideAnim }],
          opacity: opacityAnim,
          marginTop: index * 8,
          borderLeftColor: color,
        },
      ]}
    >
      <TouchableOpacity
        style={styles.toastContent}
        onPress={dismissToast}
        activeOpacity={0.9}
      >
        <Ionicons name={getTypeIcon()} size={24} color={color} />
        <View style={styles.toastTextContainer}>
          <Text style={[styles.toastTitle, { color }]}>{notification.title}</Text>
          {notification.message && (
            <Text style={styles.toastMessage}>{notification.message}</Text>
          )}
        </View>
        {notification.action && (
          <TouchableOpacity
            style={[styles.toastAction, { borderColor: color }]}
            onPress={() => {
              notification.action?.onPress();
              dismissToast();
            }}
          >
            <Text style={[styles.toastActionText, { color }]}>
              {notification.action.label}
            </Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={dismissToast} style={styles.toastDismiss}>
          <Ionicons name="close" size={20} color="#666" />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ============================================================================
// OFFLINE MODE INDICATOR
// ============================================================================

interface OfflineModeIndicatorProps {
  isOffline: boolean;
  pendingOperations?: number;
  onRetry?: () => void;
}

export function OfflineModeIndicator({
  isOffline,
  pendingOperations = 0,
  onRetry,
}: OfflineModeIndicatorProps) {
  const slideAnim = useRef(new Animated.Value(isOffline ? 0 : -60)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: isOffline ? 0 : -60,
      useNativeDriver: true,
      friction: 8,
    }).start();
  }, [isOffline, slideAnim]);

  return (
    <Animated.View
      style={[
        styles.offlineBanner,
        { transform: [{ translateY: slideAnim }] },
      ]}
    >
      <View style={styles.offlineContent}>
        <Ionicons name="cloud-offline" size={20} color="#FF4444" />
        <Text style={styles.offlineText}>You're offline</Text>
        {pendingOperations > 0 && (
          <View style={styles.pendingBadge}>
            <Text style={styles.pendingText}>{pendingOperations}</Text>
          </View>
        )}
      </View>
      {onRetry && (
        <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
          <Ionicons name="refresh" size={18} color="#FFFFFF" />
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

// ============================================================================
// REALTIME STATUS BAR
// ============================================================================

interface RealtimeStatusBarProps {
  connection: ConnectionState;
  activeSubscriptions?: number;
  lastUpdate?: number;
  showExpanded?: boolean;
}

export function RealtimeStatusBar({
  connection,
  activeSubscriptions = 0,
  lastUpdate,
  showExpanded = false,
}: RealtimeStatusBarProps) {
  const [expanded, setExpanded] = useState(showExpanded);
  const heightAnim = useRef(new Animated.Value(showExpanded ? 80 : 40)).current;

  const toggleExpanded = () => {
    const newExpanded = !expanded;
    setExpanded(newExpanded);
    Animated.spring(heightAnim, {
      toValue: newExpanded ? 80 : 40,
      useNativeDriver: false,
      friction: 8,
    }).start();
  };

  const formatLastUpdate = () => {
    if (!lastUpdate) return 'Never';
    const seconds = Math.floor((Date.now() - lastUpdate) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    return `${Math.floor(minutes / 60)}h ago`;
  };

  return (
    <Animated.View style={[styles.statusBar, { height: heightAnim }]}>
      <TouchableOpacity
        style={styles.statusBarHeader}
        onPress={toggleExpanded}
        activeOpacity={0.8}
      >
        <View style={styles.statusBarLeft}>
          <ConnectionStatusIndicator
            status={connection.status}
            isOnline={connection.isOnline}
            size="small"
          />
          <Text style={styles.statusBarTitle}>
            {connection.isOnline ? 'Realtime' : 'Offline'}
          </Text>
        </View>
        <View style={styles.statusBarRight}>
          {activeSubscriptions > 0 && (
            <View style={styles.subscriptionBadge}>
              <Text style={styles.subscriptionText}>{activeSubscriptions}</Text>
            </View>
          )}
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={16}
            color="#888"
          />
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.statusBarDetails}>
          <View style={styles.statusDetail}>
            <Text style={styles.statusDetailLabel}>Status</Text>
            <Text style={[styles.statusDetailValue, { color: getStatusColor(connection.status, connection.isOnline) }]}>
              {connection.status}
            </Text>
          </View>
          <View style={styles.statusDetail}>
            <Text style={styles.statusDetailLabel}>Last Update</Text>
            <Text style={styles.statusDetailValue}>{formatLastUpdate()}</Text>
          </View>
          <View style={styles.statusDetail}>
            <Text style={styles.statusDetailLabel}>Channels</Text>
            <Text style={styles.statusDetailValue}>{activeSubscriptions}</Text>
          </View>
        </View>
      )}
    </Animated.View>
  );
}

function getStatusColor(status: RealtimeConnectionStatus, isOnline: boolean): string {
  if (!isOnline) return '#FF4444';
  switch (status) {
    case 'connected':
      return '#00FF88';
    case 'connecting':
      return '#FFD700';
    case 'disconnected':
      return '#FF8C00';
    case 'error':
      return '#FF4444';
    default:
      return '#808080';
  }
}

// ============================================================================
// HOOK FOR TOAST MANAGEMENT
// ============================================================================

export function useToastNotifications() {
  const [notifications, setNotifications] = useState<ToastNotification[]>([]);

  const showToast = useCallback((notification: Omit<ToastNotification, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setNotifications(prev => [...prev, { ...notification, id }]);
    return id;
  }, []);

  const dismissToast = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const dismissAll = useCallback(() => {
    setNotifications([]);
  }, []);

  // Convenience methods
  const showInfo = useCallback((title: string, message?: string) => {
    return showToast({ type: 'info', title, message });
  }, [showToast]);

  const showSuccess = useCallback((title: string, message?: string) => {
    return showToast({ type: 'success', title, message });
  }, [showToast]);

  const showWarning = useCallback((title: string, message?: string) => {
    return showToast({ type: 'warning', title, message });
  }, [showToast]);

  const showCritical = useCallback((title: string, message?: string, action?: ToastNotification['action']) => {
    return showToast({ type: 'critical', title, message, action, duration: 8000 });
  }, [showToast]);

  return {
    notifications,
    showToast,
    dismissToast,
    dismissAll,
    showInfo,
    showSuccess,
    showWarning,
    showCritical,
    ToastContainer: () => (
      <ToastContainer notifications={notifications} onDismiss={dismissToast} />
    ),
  };
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  // Connection Status
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    elevation: 3,
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  // Pulse
  pulseContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  pulseRing: {
    position: 'absolute',
    borderWidth: 2,
  },
  pulseContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Toast
  toastContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20,
    left: 16,
    right: 16,
    zIndex: 1000,
  },
  toast: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    marginBottom: 8,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  toastContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  toastTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  toastTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  toastMessage: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  toastAction: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    marginLeft: 8,
  },
  toastActionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  toastDismiss: {
    padding: 4,
    marginLeft: 4,
  },

  // Offline Banner
  offlineBanner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1A1A1A',
    borderBottomWidth: 2,
    borderBottomColor: '#FF4444',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: Platform.OS === 'ios' ? 50 : 12,
    zIndex: 999,
  },
  offlineContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  offlineText: {
    color: '#FF4444',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  pendingBadge: {
    backgroundColor: '#FF4444',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
  },
  pendingText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 68, 68, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },

  // Status Bar
  statusBar: {
    backgroundColor: '#1A1A1A',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    overflow: 'hidden',
  },
  statusBarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 40,
  },
  statusBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusBarTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  statusBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  subscriptionBadge: {
    backgroundColor: ORACLE_COLORS.observe,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginRight: 8,
  },
  subscriptionText: {
    color: '#000',
    fontSize: 11,
    fontWeight: 'bold',
  },
  statusBarDetails: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  statusDetail: {
    alignItems: 'center',
  },
  statusDetailLabel: {
    color: '#666',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  statusDetailValue: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
});

export default {
  ConnectionStatusIndicator,
  LiveUpdatePulse,
  ToastContainer,
  OfflineModeIndicator,
  RealtimeStatusBar,
  useToastNotifications,
};
