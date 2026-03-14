/**
 * SignalCard Component
 * Story 7.2 - Display individual signal with urgency/impact badges
 */
import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Signal, SignalType } from '@mission-control/shared-types';
import { useRadarStore } from '../../../store/oracle';
import { ORACLE_COLORS, ORACLE_TIMING, oracleStyles, getUrgencyColor, getImpactColor } from '../theme';

interface SignalCardProps {
  signal: Signal;
  onPress?: () => void;
}

const SIGNAL_ICONS: Record<SignalType, string> = {
  calendar_conflict: 'calendar-outline',
  deadline_approaching: 'alarm-outline',
  pattern_anomaly: 'trending-up-outline',
  opportunity_window: 'sunny-outline',
  resource_shortage: 'battery-half-outline',
  stakeholder_signal: 'people-outline',
  external_event: 'globe-outline',
};

export const SignalCard: React.FC<SignalCardProps> = ({ signal, onPress }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const { dismissSignal, investigateSignal } = useRadarStore();

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: ORACLE_TIMING.fadeIn,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: ORACLE_TIMING.fadeIn,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleDismiss = () => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: ORACLE_TIMING.fadeOut,
      useNativeDriver: true,
    }).start(() => {
      dismissSignal(signal.id);
    });
  };

  const handleInvestigate = () => {
    investigateSignal(signal.id);
    onPress?.();
  };

  const urgencyColor = getUrgencyColor(signal.urgency);
  const impactColor = getImpactColor(signal.impact);
  const iconName = SIGNAL_ICONS[signal.signal_type] || 'alert-circle-outline';

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
          borderLeftColor: urgencyColor,
        },
      ]}
    >
      <TouchableOpacity
        style={styles.content}
        onPress={handleInvestigate}
        activeOpacity={0.8}
      >
        {/* Icon */}
        <View style={[styles.iconContainer, { backgroundColor: `${urgencyColor}20` }]}>
          <Ionicons name={iconName as any} size={20} color={urgencyColor} />
        </View>

        {/* Main content */}
        <View style={styles.mainContent}>
          {/* Type label */}
          <Text style={styles.typeLabel}>
            {signal.signal_type.replace(/_/g, ' ').toUpperCase()}
          </Text>

          {/* Title */}
          <Text style={styles.title} numberOfLines={2}>
            {signal.title}
          </Text>

          {/* Description */}
          {signal.description && (
            <Text style={styles.description} numberOfLines={2}>
              {signal.description}
            </Text>
          )}

          {/* Badges */}
          <View style={styles.badgeRow}>
            <View style={[styles.badge, { backgroundColor: urgencyColor }]}>
              <Text style={styles.badgeText}>{signal.urgency.toUpperCase()}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: impactColor }]}>
              <Text style={styles.badgeText}>{signal.impact.toUpperCase()} IMPACT</Text>
            </View>
          </View>

          {/* Confidence */}
          <View style={styles.confidenceContainer}>
            <Text style={styles.confidenceLabel}>Confidence</Text>
            <View style={styles.confidenceBar}>
              <View
                style={[
                  styles.confidenceFill,
                  {
                    width: `${signal.confidence * 100}%`,
                    backgroundColor: urgencyColor,
                  },
                ]}
              />
            </View>
            <Text style={[styles.confidenceValue, { color: urgencyColor }]}>
              {Math.round(signal.confidence * 100)}%
            </Text>
          </View>

          {/* Source */}
          {signal.source && (
            <View style={styles.sourceRow}>
              <Ionicons name="location-outline" size={12} color="#666666" />
              <Text style={styles.sourceText}>{signal.source}</Text>
            </View>
          )}
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleInvestigate}
          >
            <Ionicons name="search-outline" size={18} color={ORACLE_COLORS.observe} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleDismiss}
          >
            <Ionicons name="close-outline" size={18} color="#666666" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    overflow: 'hidden',
  },
  content: {
    flexDirection: 'row',
    padding: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  mainContent: {
    flex: 1,
  },
  typeLabel: {
    fontSize: 10,
    color: '#888888',
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 4,
  },
  title: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
    lineHeight: 20,
  },
  description: {
    fontSize: 12,
    color: '#AAAAAA',
    lineHeight: 18,
    marginBottom: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginRight: 6,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#000000',
    letterSpacing: 0.5,
  },
  confidenceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  confidenceLabel: {
    fontSize: 10,
    color: '#666666',
    marginRight: 8,
    width: 60,
  },
  confidenceBar: {
    flex: 1,
    height: 4,
    backgroundColor: '#333333',
    borderRadius: 2,
    overflow: 'hidden',
    marginRight: 8,
  },
  confidenceFill: {
    height: '100%',
    borderRadius: 2,
  },
  confidenceValue: {
    fontSize: 11,
    fontWeight: 'bold',
    width: 35,
    textAlign: 'right',
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sourceText: {
    fontSize: 10,
    color: '#666666',
    marginLeft: 4,
  },
  actions: {
    justifyContent: 'space-between',
    marginLeft: 8,
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
});
