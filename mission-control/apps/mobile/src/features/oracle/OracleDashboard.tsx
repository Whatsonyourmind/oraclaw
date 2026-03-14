/**
 * OracleDashboard Component
 * Story 7.15 - Unified view of all OODA phases with animations
 */
import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Animated,
  Easing,
  Dimensions,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { OODAPhase } from '@mission-control/shared-types';
import {
  useOracleStore,
  useOracleSelectors,
  useRadarSelectors,
  useOrientSelectors,
  useDecideSelectors,
  useActSelectors,
  ORACLE_COLORS,
} from '../../store/oracle';
import { ORACLE_TIMING, oracleStyles, getPhaseColor } from './theme';

const { width } = Dimensions.get('window');

const PHASE_CONFIG: Record<OODAPhase, { icon: string; label: string; description: string }> = {
  observe: {
    icon: 'radio-outline',
    label: 'OBSERVE',
    description: 'Scanning for signals',
  },
  orient: {
    icon: 'compass-outline',
    label: 'ORIENT',
    description: 'Analyzing context',
  },
  decide: {
    icon: 'git-branch-outline',
    label: 'DECIDE',
    description: 'Evaluating options',
  },
  act: {
    icon: 'rocket-outline',
    label: 'ACT',
    description: 'Executing plan',
  },
  idle: {
    icon: 'pause-outline',
    label: 'IDLE',
    description: 'Standing by',
  },
};

interface PhaseCardProps {
  phase: OODAPhase;
  isActive: boolean;
  stats: { label: string; value: number }[];
  onPress: () => void;
}

const PhaseCard: React.FC<PhaseCardProps> = ({ phase, isActive, stats, onPress }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const config = PHASE_CONFIG[phase];
  const color = ORACLE_COLORS[phase];

  useEffect(() => {
    if (isActive) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(scaleAnim, {
            toValue: 1.02,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      scaleAnim.setValue(1);
    }
  }, [isActive]);

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        style={[
          styles.phaseCard,
          isActive && { borderColor: color, borderWidth: 2 },
        ]}
        onPress={onPress}
        activeOpacity={0.8}
      >
        {/* Phase Header */}
        <View style={styles.phaseHeader}>
          <View style={[styles.phaseIcon, { backgroundColor: `${color}20` }]}>
            <Ionicons name={config.icon as any} size={24} color={color} />
          </View>
          <View style={styles.phaseTitleColumn}>
            <Text style={[styles.phaseLabel, { color }]}>{config.label}</Text>
            <Text style={styles.phaseDescription}>{config.description}</Text>
          </View>
          {isActive && (
            <View style={[styles.activeBadge, { backgroundColor: color }]}>
              <Text style={styles.activeBadgeText}>ACTIVE</Text>
            </View>
          )}
        </View>

        {/* Phase Stats */}
        <View style={styles.phaseStats}>
          {stats.map((stat, index) => (
            <View key={index} style={styles.phaseStat}>
              <Text style={styles.phaseStatValue}>{stat.value}</Text>
              <Text style={styles.phaseStatLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

export const OracleDashboard: React.FC = () => {
  const insets = useSafeAreaInsets();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const loopAnim = useRef(new Animated.Value(0)).current;

  const {
    currentPhase,
    loopRunning,
    loopPaused,
    systemConfidence,
    startLoop,
    pauseLoop,
    resumeLoop,
    stopLoop,
    transitionPhase,
  } = useOracleStore();

  const phaseColor = useOracleSelectors.phaseColor();
  const isActive = useOracleSelectors.isActive();
  const loopStats = useOracleSelectors.loopStats();

  // Get stats from individual stores
  const activeSignals = useRadarSelectors.activeSignals();
  const riskCount = useOrientSelectors.riskCount();
  const opportunityCount = useOrientSelectors.opportunityCount();
  const pendingDecisions = useDecideSelectors.pendingDecisions();
  const planProgress = useActSelectors.planProgress();

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: ORACLE_TIMING.fadeIn,
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    if (loopRunning && !loopPaused) {
      Animated.loop(
        Animated.timing(loopAnim, {
          toValue: 1,
          duration: 4000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    } else {
      loopAnim.stopAnimation();
    }
  }, [loopRunning, loopPaused]);

  const handleLoopToggle = async () => {
    if (!loopRunning) {
      await startLoop();
    } else if (loopPaused) {
      resumeLoop();
    } else {
      pauseLoop();
    }
  };

  const handleStopLoop = () => {
    stopLoop();
  };

  const handlePhasePress = (phase: OODAPhase) => {
    // Navigate to phase-specific screen
    transitionPhase(phase);
  };

  const loopRotation = loopAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={[oracleStyles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>ORACLE</Text>
          <Text style={styles.headerSubtitle}>Autonomous Intelligence Loop</Text>
        </View>
        <View style={[styles.confidenceBadge, { backgroundColor: phaseColor }]}>
          <Text style={styles.confidenceText}>
            {Math.round(systemConfidence * 100)}%
          </Text>
        </View>
      </View>

      <ScrollView
        style={oracleStyles.content}
        contentContainerStyle={oracleStyles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Loop Control */}
        <Animated.View style={[styles.loopControl, { opacity: fadeAnim }]}>
          {/* Animated Loop Indicator */}
          <View style={styles.loopIndicator}>
            <Animated.View
              style={[
                styles.loopRing,
                {
                  borderColor: phaseColor,
                  transform: [{ rotate: loopRotation }],
                },
              ]}
            />
            <View style={[styles.loopCenter, { backgroundColor: `${phaseColor}30` }]}>
              <Ionicons
                name={PHASE_CONFIG[currentPhase].icon as any}
                size={32}
                color={phaseColor}
              />
            </View>
          </View>

          {/* Phase Info */}
          <View style={styles.loopInfo}>
            <Text style={[styles.currentPhase, { color: phaseColor }]}>
              {PHASE_CONFIG[currentPhase].label}
            </Text>
            <Text style={styles.phaseStatus}>
              {loopRunning
                ? loopPaused
                  ? 'Paused'
                  : PHASE_CONFIG[currentPhase].description
                : 'Standing by'}
            </Text>
          </View>

          {/* Loop Controls */}
          <View style={styles.loopButtons}>
            <TouchableOpacity
              style={[
                styles.loopButton,
                { backgroundColor: loopRunning && !loopPaused ? '#333333' : phaseColor },
              ]}
              onPress={handleLoopToggle}
            >
              <Ionicons
                name={loopRunning && !loopPaused ? 'pause' : 'play'}
                size={24}
                color={loopRunning && !loopPaused ? phaseColor : '#000000'}
              />
            </TouchableOpacity>
            {loopRunning && (
              <TouchableOpacity style={styles.stopButton} onPress={handleStopLoop}>
                <Ionicons name="stop" size={20} color="#FF6B6B" />
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>

        {/* Loop Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{loopStats.totalLoops}</Text>
            <Text style={styles.statLabel}>Loops</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{loopStats.totalSignalsProcessed}</Text>
            <Text style={styles.statLabel}>Signals</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{loopStats.totalDecisionsMade}</Text>
            <Text style={styles.statLabel}>Decisions</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{loopStats.totalActionsExecuted}</Text>
            <Text style={styles.statLabel}>Actions</Text>
          </View>
        </View>

        {/* Phase Cards */}
        <Text style={styles.sectionTitle}>OODA PHASES</Text>

        <PhaseCard
          phase="observe"
          isActive={currentPhase === 'observe'}
          stats={[
            { label: 'Active Signals', value: activeSignals.length },
            { label: 'Critical', value: activeSignals.filter((s) => s.urgency === 'critical').length },
          ]}
          onPress={() => handlePhasePress('observe')}
        />

        <PhaseCard
          phase="orient"
          isActive={currentPhase === 'orient'}
          stats={[
            { label: 'Risks', value: riskCount },
            { label: 'Opportunities', value: opportunityCount },
          ]}
          onPress={() => handlePhasePress('orient')}
        />

        <PhaseCard
          phase="decide"
          isActive={currentPhase === 'decide'}
          stats={[
            { label: 'Pending', value: pendingDecisions.length },
            { label: 'This Week', value: loopStats.totalDecisionsMade },
          ]}
          onPress={() => handlePhasePress('decide')}
        />

        <PhaseCard
          phase="act"
          isActive={currentPhase === 'act'}
          stats={[
            { label: 'Progress', value: Math.round(planProgress * 100) },
            { label: 'Actions', value: loopStats.totalActionsExecuted },
          ]}
          onPress={() => handlePhasePress('act')}
        />

        {/* Notification Center */}
        {activeSignals.length > 0 && (
          <View style={styles.notificationCenter}>
            <View style={styles.notificationHeader}>
              <Ionicons name="notifications" size={18} color="#FFA500" />
              <Text style={styles.notificationTitle}>SIGNALS REQUIRING ATTENTION</Text>
            </View>
            {activeSignals.slice(0, 3).map((signal, index) => (
              <View key={signal.id} style={styles.notificationItem}>
                <View style={[styles.notificationDot, { backgroundColor: getPhaseColor(signal.urgency) }]} />
                <Text style={styles.notificationText} numberOfLines={1}>
                  {signal.title}
                </Text>
              </View>
            ))}
            {activeSignals.length > 3 && (
              <Text style={styles.moreSignals}>
                +{activeSignals.length - 3} more signals
              </Text>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 4,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#888888',
    marginTop: 2,
  },
  confidenceBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  confidenceText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#000000',
  },
  loopControl: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  loopIndicator: {
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  loopRing: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderStyle: 'dashed',
  },
  loopCenter: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loopInfo: {
    flex: 1,
  },
  currentPhase: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  phaseStatus: {
    fontSize: 13,
    color: '#888888',
  },
  loopButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loopButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stopButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 107, 107, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  statsRow: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  statLabel: {
    fontSize: 10,
    color: '#888888',
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 12,
    color: '#888888',
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 12,
  },
  phaseCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333333',
  },
  phaseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  phaseIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  phaseTitleColumn: {
    flex: 1,
  },
  phaseLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  phaseDescription: {
    fontSize: 12,
    color: '#888888',
    marginTop: 2,
  },
  activeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  activeBadgeText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#000000',
  },
  phaseStats: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#333333',
    paddingTop: 12,
  },
  phaseStat: {
    flex: 1,
    alignItems: 'center',
  },
  phaseStatValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  phaseStatLabel: {
    fontSize: 10,
    color: '#888888',
    marginTop: 2,
  },
  notificationCenter: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 165, 0, 0.3)',
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  notificationTitle: {
    fontSize: 10,
    color: '#FFA500',
    fontWeight: '600',
    letterSpacing: 1,
    marginLeft: 8,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  notificationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 10,
  },
  notificationText: {
    flex: 1,
    fontSize: 13,
    color: '#CCCCCC',
  },
  moreSignals: {
    fontSize: 12,
    color: '#888888',
    textAlign: 'center',
    marginTop: 8,
  },
});
