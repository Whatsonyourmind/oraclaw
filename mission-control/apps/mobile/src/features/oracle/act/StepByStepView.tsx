/**
 * StepByStepView Component
 * Story 7.12 - Expandable step list with status icons
 */
import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  LayoutAnimation,
  Platform,
  UIManager,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ExecutionStep, StepStatus } from '@mission-control/shared-types';
import { ORACLE_COLORS, ORACLE_TIMING } from '../theme';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface StepByStepViewProps {
  steps: ExecutionStep[];
  onComplete: (step: ExecutionStep) => void;
  onReportBlocker: (step: ExecutionStep, description: string) => void;
}

const STATUS_CONFIG: Record<StepStatus, { icon: string; color: string; label: string }> = {
  pending: { icon: 'ellipse-outline', color: '#666666', label: 'Pending' },
  in_progress: { icon: 'play-circle', color: ORACLE_COLORS.act, label: 'In Progress' },
  completed: { icon: 'checkmark-circle', color: '#00FF88', label: 'Completed' },
  blocked: { icon: 'alert-circle', color: '#FF6B6B', label: 'Blocked' },
  skipped: { icon: 'play-skip-forward-circle', color: '#888888', label: 'Skipped' },
};

export const StepByStepView: React.FC<StepByStepViewProps> = ({
  steps,
  onComplete,
  onReportBlocker,
}) => {
  const [expandedStepId, setExpandedStepId] = useState<string | null>(null);
  const rotationAnims = useRef<{ [key: string]: Animated.Value }>({}).current;

  const getRotationAnim = (stepId: string): Animated.Value => {
    if (!rotationAnims[stepId]) {
      rotationAnims[stepId] = new Animated.Value(0);
    }
    return rotationAnims[stepId];
  };

  const toggleExpand = (stepId: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const rotationAnim = getRotationAnim(stepId);
    const isExpanding = expandedStepId !== stepId;

    Animated.timing(rotationAnim, {
      toValue: isExpanding ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();

    setExpandedStepId(isExpanding ? stepId : null);
  };

  const renderStep = (step: ExecutionStep, index: number) => {
    const status = STATUS_CONFIG[step.status] || STATUS_CONFIG.pending;
    const isExpanded = expandedStepId === step.id;
    const rotationAnim = getRotationAnim(step.id);

    const rotateIcon = rotationAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '180deg'],
    });

    const isCompleted = step.status === 'completed';
    const isBlocked = step.status === 'blocked';
    const canComplete = step.status === 'in_progress' || step.status === 'pending';

    return (
      <View key={step.id} style={styles.stepContainer}>
        {/* Step Connector Line */}
        {index > 0 && (
          <View
            style={[
              styles.connectorLine,
              {
                backgroundColor: isCompleted ? '#00FF88' : '#333333',
              },
            ]}
          />
        )}

        {/* Step Header */}
        <TouchableOpacity
          style={[
            styles.stepHeader,
            isExpanded && styles.stepHeaderExpanded,
            isCompleted && styles.stepHeaderCompleted,
            isBlocked && styles.stepHeaderBlocked,
          ]}
          onPress={() => toggleExpand(step.id)}
          activeOpacity={0.8}
        >
          {/* Status Icon */}
          <View style={[styles.statusIcon, { backgroundColor: `${status.color}20` }]}>
            <Ionicons name={status.icon as any} size={20} color={status.color} />
          </View>

          {/* Step Info */}
          <View style={styles.stepInfo}>
            <View style={styles.stepTitleRow}>
              <Text style={styles.stepNumber}>Step {index + 1}</Text>
              <View style={[styles.statusBadge, { backgroundColor: status.color }]}>
                <Text style={styles.statusBadgeText}>{status.label}</Text>
              </View>
            </View>
            <Text
              style={[
                styles.stepTitle,
                isCompleted && styles.stepTitleCompleted,
              ]}
              numberOfLines={2}
            >
              {step.title}
            </Text>
            {step.estimated_duration && (
              <View style={styles.durationRow}>
                <Ionicons name="time-outline" size={12} color="#888888" />
                <Text style={styles.durationText}>
                  ~{step.estimated_duration}
                </Text>
              </View>
            )}
          </View>

          {/* Expand Icon */}
          <Animated.View style={{ transform: [{ rotate: rotateIcon }] }}>
            <Ionicons name="chevron-down" size={20} color="#888888" />
          </Animated.View>
        </TouchableOpacity>

        {/* Expanded Content */}
        {isExpanded && (
          <View style={styles.expandedContent}>
            {/* Description */}
            {step.description && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>DESCRIPTION</Text>
                <Text style={styles.descriptionText}>{step.description}</Text>
              </View>
            )}

            {/* Instructions */}
            {step.instructions && step.instructions.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>INSTRUCTIONS</Text>
                {step.instructions.map((instruction, i) => (
                  <View key={i} style={styles.instructionItem}>
                    <Text style={styles.instructionNumber}>{i + 1}.</Text>
                    <Text style={styles.instructionText}>{instruction}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Dependencies */}
            {step.dependencies && step.dependencies.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>DEPENDENCIES</Text>
                {step.dependencies.map((dep, i) => (
                  <View key={i} style={styles.dependencyItem}>
                    <Ionicons name="git-branch-outline" size={14} color="#888888" />
                    <Text style={styles.dependencyText}>{typeof dep === 'string' ? dep : JSON.stringify(dep)}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Blocker Info */}
            {step.blocker_description && (
              <View style={styles.blockerSection}>
                <Ionicons name="alert-circle" size={16} color="#FF6B6B" />
                <Text style={styles.blockerText}>{step.blocker_description}</Text>
              </View>
            )}

            {/* Actions */}
            <View style={styles.actionsRow}>
              {canComplete && (
                <TouchableOpacity
                  style={styles.completeButton}
                  onPress={() => onComplete(step)}
                >
                  <Ionicons name="checkmark" size={18} color="#000000" />
                  <Text style={styles.completeButtonText}>COMPLETE</Text>
                </TouchableOpacity>
              )}
              {!isCompleted && !isBlocked && (
                <TouchableOpacity
                  style={styles.blockerButton}
                  onPress={() => onReportBlocker(step, '')}
                >
                  <Ionicons name="alert" size={18} color="#FF6B6B" />
                  <Text style={styles.blockerButtonText}>BLOCKED</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {steps.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="list-outline" size={48} color="#444444" />
          <Text style={styles.emptyText}>No steps in this plan</Text>
        </View>
      ) : (
        steps.map((step, index) => renderStep(step, index))
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  stepContainer: {
    position: 'relative',
  },
  connectorLine: {
    position: 'absolute',
    left: 28,
    top: -8,
    width: 2,
    height: 8,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#333333',
  },
  stepHeaderExpanded: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    marginBottom: 0,
  },
  stepHeaderCompleted: {
    borderColor: 'rgba(0, 255, 136, 0.3)',
  },
  stepHeaderBlocked: {
    borderColor: 'rgba(255, 107, 107, 0.3)',
  },
  statusIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stepInfo: {
    flex: 1,
  },
  stepTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  stepNumber: {
    fontSize: 10,
    color: '#888888',
    fontWeight: '600',
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#000000',
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  stepTitleCompleted: {
    textDecorationLine: 'line-through',
    color: '#888888',
  },
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  durationText: {
    fontSize: 11,
    color: '#888888',
    marginLeft: 4,
  },
  expandedContent: {
    backgroundColor: '#1A1A1A',
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    padding: 16,
    paddingTop: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: '#333333',
  },
  section: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 10,
    color: '#888888',
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 8,
  },
  descriptionText: {
    fontSize: 13,
    color: '#CCCCCC',
    lineHeight: 20,
  },
  instructionItem: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  instructionNumber: {
    fontSize: 12,
    color: ORACLE_COLORS.act,
    fontWeight: 'bold',
    width: 20,
  },
  instructionText: {
    flex: 1,
    fontSize: 13,
    color: '#CCCCCC',
    lineHeight: 20,
  },
  dependencyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  dependencyText: {
    fontSize: 12,
    color: '#AAAAAA',
    marginLeft: 8,
  },
  blockerSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  blockerText: {
    flex: 1,
    fontSize: 13,
    color: '#FF6B6B',
    lineHeight: 20,
    marginLeft: 8,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#333333',
  },
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ORACLE_COLORS.act,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginLeft: 8,
  },
  completeButtonText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#000000',
    marginLeft: 4,
  },
  blockerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  blockerButtonText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FF6B6B',
    marginLeft: 4,
  },
  emptyState: {
    alignItems: 'center',
    padding: 48,
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#666666',
    marginTop: 12,
  },
});
