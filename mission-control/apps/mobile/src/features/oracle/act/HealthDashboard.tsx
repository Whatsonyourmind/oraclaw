/**
 * HealthDashboard Component
 * Story 7.14 - Overall progress and health indicators
 */
import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  Animated,
  Easing,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ExecutionPlan, CopilotState } from '@mission-control/shared-types';
import { ORACLE_COLORS, ORACLE_TIMING } from '../theme';

interface HealthDashboardProps {
  plan?: ExecutionPlan;
  progress: number;
  completedCount: number;
  totalCount: number;
  blockedCount: number;
  copilotState?: CopilotState;
}

export const HealthDashboard: React.FC<HealthDashboardProps> = ({
  plan,
  progress,
  completedCount,
  totalCount,
  blockedCount,
  copilotState,
}) => {
  const progressAnim = useRef(new Animated.Value(0)).current;
  const healthAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const healthScore = plan?.health_score ?? copilotState?.health_assessment?.score ?? 0.7;
  const onTrack = copilotState?.health_assessment?.on_track ?? progress >= 0.8;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: ORACLE_TIMING.fadeIn,
        useNativeDriver: true,
      }),
      Animated.timing(progressAnim, {
        toValue: progress,
        duration: 800,
        easing: Easing.out(Easing.ease),
        useNativeDriver: false,
      }),
      Animated.timing(healthAnim, {
        toValue: healthScore,
        duration: 1000,
        easing: Easing.out(Easing.ease),
        useNativeDriver: false,
      }),
    ]).start();
  }, [progress, healthScore]);

  const getHealthColor = (score: number): string => {
    if (score >= 0.8) return '#00FF88';
    if (score >= 0.6) return '#FFD700';
    if (score >= 0.4) return '#FFA500';
    return '#FF6B6B';
  };

  const getHealthLabel = (score: number): string => {
    if (score >= 0.8) return 'Excellent';
    if (score >= 0.6) return 'Good';
    if (score >= 0.4) return 'Fair';
    return 'At Risk';
  };

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const healthWidth = healthAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      {/* Main Progress Ring */}
      <View style={styles.progressSection}>
        <View style={styles.progressRing}>
          <View style={styles.progressRingOuter}>
            <View style={styles.progressRingInner}>
              <Text style={styles.progressPercent}>
                {Math.round(progress * 100)}%
              </Text>
              <Text style={styles.progressLabel}>Complete</Text>
            </View>
          </View>
          {/* Animated arc would go here in a real implementation */}
        </View>

        <View style={styles.statsColumn}>
          <View style={styles.statItem}>
            <View style={[styles.statIcon, { backgroundColor: 'rgba(0, 255, 136, 0.2)' }]}>
              <Ionicons name="checkmark" size={16} color="#00FF88" />
            </View>
            <Text style={styles.statValue}>{completedCount}</Text>
            <Text style={styles.statLabel}>Done</Text>
          </View>

          <View style={styles.statItem}>
            <View style={[styles.statIcon, { backgroundColor: `rgba(${ORACLE_COLORS.act}, 0.2)` }]}>
              <Ionicons name="play" size={16} color={ORACLE_COLORS.act} />
            </View>
            <Text style={styles.statValue}>{totalCount - completedCount - blockedCount}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>

          <View style={styles.statItem}>
            <View style={[styles.statIcon, { backgroundColor: 'rgba(255, 107, 107, 0.2)' }]}>
              <Ionicons name="alert" size={16} color="#FF6B6B" />
            </View>
            <Text style={styles.statValue}>{blockedCount}</Text>
            <Text style={styles.statLabel}>Blocked</Text>
          </View>
        </View>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressBarSection}>
        <View style={styles.progressBarHeader}>
          <Text style={styles.progressBarLabel}>OVERALL PROGRESS</Text>
          <Text style={styles.progressBarValue}>
            {completedCount} / {totalCount} steps
          </Text>
        </View>
        <View style={styles.progressBar}>
          <Animated.View
            style={[
              styles.progressFill,
              { width: progressWidth },
            ]}
          />
        </View>
      </View>

      {/* Health Score */}
      <View style={styles.healthSection}>
        <View style={styles.healthHeader}>
          <Text style={styles.healthLabel}>HEALTH SCORE</Text>
          <View style={styles.healthStatus}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: getHealthColor(healthScore) },
              ]}
            />
            <Text style={[styles.healthStatusText, { color: getHealthColor(healthScore) }]}>
              {getHealthLabel(healthScore)}
            </Text>
          </View>
        </View>
        <View style={styles.healthBar}>
          <Animated.View
            style={[
              styles.healthFill,
              {
                width: healthWidth,
                backgroundColor: getHealthColor(healthScore),
              },
            ]}
          />
        </View>
      </View>

      {/* On Track Indicator */}
      <View style={styles.trackSection}>
        <View style={styles.trackIndicator}>
          <Ionicons
            name={onTrack ? 'checkmark-circle' : 'alert-circle'}
            size={20}
            color={onTrack ? '#00FF88' : '#FFA500'}
          />
          <Text
            style={[
              styles.trackText,
              { color: onTrack ? '#00FF88' : '#FFA500' },
            ]}
          >
            {onTrack ? 'On Track' : 'Needs Attention'}
          </Text>
        </View>

        {/* Time estimate if available */}
        {copilotState?.predictions?.estimated_completion && (
          <View style={styles.timeEstimate}>
            <Ionicons name="time-outline" size={14} color="#888888" />
            <Text style={styles.timeEstimateText}>
              Est. completion: {copilotState.predictions.estimated_completion}
            </Text>
          </View>
        )}
      </View>

      {/* Quick Actions */}
      {blockedCount > 0 && (
        <View style={styles.alertBanner}>
          <Ionicons name="warning" size={18} color="#FF6B6B" />
          <Text style={styles.alertText}>
            {blockedCount} step{blockedCount > 1 ? 's' : ''} blocked. Review to continue.
          </Text>
        </View>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  progressSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  progressRing: {
    marginRight: 20,
  },
  progressRingOuter: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 8,
    borderColor: ORACLE_COLORS.act,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressRingInner: {
    alignItems: 'center',
  },
  progressPercent: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  progressLabel: {
    fontSize: 10,
    color: '#888888',
    marginTop: 2,
  },
  statsColumn: {
    flex: 1,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    width: 30,
  },
  statLabel: {
    fontSize: 12,
    color: '#888888',
  },
  progressBarSection: {
    marginBottom: 16,
  },
  progressBarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressBarLabel: {
    fontSize: 10,
    color: '#888888',
    fontWeight: '600',
    letterSpacing: 1,
  },
  progressBarValue: {
    fontSize: 12,
    color: '#AAAAAA',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#333333',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: ORACLE_COLORS.act,
    borderRadius: 4,
  },
  healthSection: {
    marginBottom: 16,
  },
  healthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  healthLabel: {
    fontSize: 10,
    color: '#888888',
    fontWeight: '600',
    letterSpacing: 1,
  },
  healthStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  healthStatusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  healthBar: {
    height: 6,
    backgroundColor: '#333333',
    borderRadius: 3,
    overflow: 'hidden',
  },
  healthFill: {
    height: '100%',
    borderRadius: 3,
  },
  trackSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#333333',
  },
  trackIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trackText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  timeEstimate: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeEstimateText: {
    fontSize: 12,
    color: '#888888',
    marginLeft: 6,
  },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  alertText: {
    flex: 1,
    fontSize: 13,
    color: '#FF6B6B',
    marginLeft: 10,
  },
});
