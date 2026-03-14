/**
 * HorizonPlanView Component
 * Story 7.5 - Detailed view per time horizon with goals and actions
 */
import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  Animated,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { StrategicHorizon, HorizonType } from '@mission-control/shared-types';
import { ORACLE_COLORS, ORACLE_TIMING } from '../theme';

interface HorizonPlanViewProps {
  horizon?: StrategicHorizon;
  horizonType: HorizonType;
}

const HORIZON_CONFIG: Record<HorizonType, { color: string; description: string }> = {
  immediate: {
    color: '#FF6B6B',
    description: 'Actions for the next few hours',
  },
  today: {
    color: ORACLE_COLORS.orient,
    description: 'Goals and actions for today',
  },
  week: {
    color: '#00BFFF',
    description: 'Weekly objectives and milestones',
  },
  month: {
    color: '#00FF88',
    description: 'Monthly strategic goals',
  },
};

export const HorizonPlanView: React.FC<HorizonPlanViewProps> = ({
  horizon,
  horizonType,
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  const config = HORIZON_CONFIG[horizonType];

  useEffect(() => {
    fadeAnim.setValue(0);
    slideAnim.setValue(20);
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
  }, [horizonType]);

  if (!horizon) {
    return (
      <Animated.View
        style={[
          styles.container,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <View style={styles.emptyState}>
          <Ionicons name="calendar-outline" size={48} color="#444444" />
          <Text style={styles.emptyTitle}>
            No {horizonType} plan generated
          </Text>
          <Text style={styles.emptyDescription}>
            {config.description}
          </Text>
        </View>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
          borderColor: config.color,
        },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.horizonBadge, { backgroundColor: config.color }]}>
          <Text style={styles.horizonBadgeText}>
            {horizonType.toUpperCase()}
          </Text>
        </View>
        <Text style={styles.horizonDescription}>{config.description}</Text>
      </View>

      {/* Summary */}
      {horizon.summary && (
        <View style={styles.summarySection}>
          <Text style={styles.summaryText}>{horizon.summary}</Text>
        </View>
      )}

      {/* Goals */}
      {horizon.goals && horizon.goals.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>GOALS</Text>
          {horizon.goals.map((goal, index) => (
            <View key={index} style={styles.goalItem}>
              <View style={[styles.goalNumber, { backgroundColor: config.color }]}>
                <Text style={styles.goalNumberText}>{index + 1}</Text>
              </View>
              <Text style={styles.goalText}>{goal}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Key Actions */}
      {horizon.key_actions && horizon.key_actions.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>KEY ACTIONS</Text>
          {horizon.key_actions.map((action, index) => (
            <View key={index} style={styles.actionItem}>
              <Ionicons
                name="arrow-forward-circle"
                size={18}
                color={config.color}
              />
              <Text style={styles.actionText}>{action}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Dependencies */}
      {horizon.dependencies && horizon.dependencies.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>DEPENDENCIES</Text>
          <View style={styles.dependenciesContainer}>
            {horizon.dependencies.map((dep, index) => (
              <View key={index} style={styles.dependencyItem}>
                <View style={styles.dependencyNode}>
                  <Ionicons name="git-branch-outline" size={14} color="#888888" />
                </View>
                {index < horizon.dependencies!.length - 1 && (
                  <View style={styles.dependencyLine} />
                )}
                <Text style={styles.dependencyText}>{dep}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Risks */}
      {horizon.risks && horizon.risks.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>POTENTIAL RISKS</Text>
          {horizon.risks.map((risk, index) => (
            <View key={index} style={styles.riskItem}>
              <Ionicons name="warning-outline" size={16} color="#FF6B6B" />
              <Text style={styles.riskText}>{risk}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Opportunities */}
      {horizon.opportunities && horizon.opportunities.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>OPPORTUNITIES</Text>
          {horizon.opportunities.map((opp, index) => (
            <View key={index} style={styles.opportunityItem}>
              <Ionicons name="sunny-outline" size={16} color="#00FF88" />
              <Text style={styles.opportunityText}>{opp}</Text>
            </View>
          ))}
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
    borderWidth: 1,
    borderColor: '#333333',
  },
  header: {
    marginBottom: 16,
  },
  horizonBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  horizonBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#000000',
    letterSpacing: 1,
  },
  horizonDescription: {
    fontSize: 12,
    color: '#888888',
  },
  summarySection: {
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
    marginBottom: 16,
  },
  summaryText: {
    fontSize: 14,
    color: '#CCCCCC',
    lineHeight: 22,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 10,
    color: '#888888',
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 12,
  },
  goalItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  goalNumber: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  goalNumberText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#000000',
  },
  goalText: {
    flex: 1,
    fontSize: 14,
    color: '#FFFFFF',
    lineHeight: 22,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  actionText: {
    flex: 1,
    fontSize: 13,
    color: '#CCCCCC',
    lineHeight: 20,
    marginLeft: 10,
  },
  dependenciesContainer: {
    paddingLeft: 8,
  },
  dependencyItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  dependencyNode: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#252525',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  dependencyLine: {
    position: 'absolute',
    left: 11,
    top: 24,
    width: 2,
    height: 20,
    backgroundColor: '#333333',
  },
  dependencyText: {
    flex: 1,
    fontSize: 13,
    color: '#AAAAAA',
    lineHeight: 20,
  },
  riskItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    padding: 10,
    borderRadius: 8,
  },
  riskText: {
    flex: 1,
    fontSize: 13,
    color: '#CCCCCC',
    lineHeight: 20,
    marginLeft: 10,
  },
  opportunityItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
    backgroundColor: 'rgba(0, 255, 136, 0.1)',
    padding: 10,
    borderRadius: 8,
  },
  opportunityText: {
    flex: 1,
    fontSize: 13,
    color: '#CCCCCC',
    lineHeight: 20,
    marginLeft: 10,
  },
  emptyState: {
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666666',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 13,
    color: '#555555',
    textAlign: 'center',
  },
});
