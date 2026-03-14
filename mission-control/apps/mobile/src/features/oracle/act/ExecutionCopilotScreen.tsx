/**
 * ExecutionCopilotScreen Component
 * Story 7.11 - Main execution dashboard with copilot guidance
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Animated,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ExecutionStep } from '@mission-control/shared-types';
import { useActStore, useActSelectors } from '../../../store/oracle';
import { ORACLE_COLORS, ORACLE_TIMING, oracleStyles } from '../theme';
import { StepByStepView } from './StepByStepView';
import { CurrentStepFocus } from './CurrentStepFocus';
import { HealthDashboard } from './HealthDashboard';

export const ExecutionCopilotScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [viewMode, setViewMode] = useState<'focus' | 'list'>('focus');

  const {
    currentPlan,
    steps,
    copilotSuggestions,
    isExecuting,
    getCopilotGuidance,
    completeStep,
    reportBlocker,
  } = useActStore();

  const currentStep = useActSelectors.currentStep();
  const completedSteps = useActSelectors.completedSteps();
  const blockedSteps = useActSelectors.blockedSteps();
  const planProgress = useActSelectors.planProgress();
  const copilotState = useActSelectors.copilotState();

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: ORACLE_TIMING.fadeIn,
      useNativeDriver: true,
    }).start();
  }, []);

  const handleRefreshGuidance = async () => {
    if (currentPlan) {
      await getCopilotGuidance(currentPlan.id);
    }
  };

  const handleCompleteStep = async (step: ExecutionStep) => {
    await completeStep(step.id);
  };

  const handleReportBlocker = async (step: ExecutionStep, description: string) => {
    await reportBlocker(step.id, description);
  };

  return (
    <View style={[oracleStyles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[oracleStyles.header, { borderBottomColor: ORACLE_COLORS.act }]}>
        <View>
          <Text style={[oracleStyles.headerTitle, { color: ORACLE_COLORS.act }]}>
            EXECUTION COPILOT
          </Text>
          <Text style={oracleStyles.headerSubtitle}>
            {isExecuting ? 'Execution in progress' : 'Ready to execute'}
          </Text>
        </View>
        <View style={[oracleStyles.phaseIndicator, { borderColor: ORACLE_COLORS.act }]}>
          <View style={[oracleStyles.phaseDot, { backgroundColor: ORACLE_COLORS.act }]} />
          <Text style={[oracleStyles.phaseText, { color: ORACLE_COLORS.act }]}>
            ACT
          </Text>
        </View>
      </View>

      <ScrollView
        style={oracleStyles.content}
        contentContainerStyle={oracleStyles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Health Dashboard */}
        <HealthDashboard
          plan={currentPlan}
          progress={planProgress}
          completedCount={completedSteps.length}
          totalCount={steps.length}
          blockedCount={blockedSteps.length}
          copilotState={copilotState}
        />

        {/* Current Plan Card */}
        {currentPlan ? (
          <Animated.View style={[styles.planCard, { opacity: fadeAnim }]}>
            <View style={styles.planHeader}>
              <View style={styles.planTitleRow}>
                <Ionicons name="rocket-outline" size={20} color={ORACLE_COLORS.act} />
                <Text style={styles.planTitle}>{currentPlan.title}</Text>
              </View>
              <TouchableOpacity
                style={styles.refreshButton}
                onPress={handleRefreshGuidance}
              >
                <Ionicons name="sparkles-outline" size={18} color={ORACLE_COLORS.act} />
              </TouchableOpacity>
            </View>

            {/* Progress Bar */}
            <View style={styles.progressSection}>
              <View style={styles.progressBar}>
                <Animated.View
                  style={[
                    styles.progressFill,
                    {
                      width: `${planProgress * 100}%`,
                    },
                  ]}
                />
              </View>
              <Text style={styles.progressText}>
                {Math.round(planProgress * 100)}% Complete
              </Text>
            </View>

            {/* Step counts */}
            <View style={styles.stepCounts}>
              <View style={styles.stepCount}>
                <Ionicons name="checkmark-circle" size={16} color="#00FF88" />
                <Text style={styles.stepCountText}>
                  {completedSteps.length} Done
                </Text>
              </View>
              <View style={styles.stepCount}>
                <Ionicons name="play-circle" size={16} color={ORACLE_COLORS.act} />
                <Text style={styles.stepCountText}>
                  {steps.filter((s) => s.status === 'in_progress').length} Active
                </Text>
              </View>
              <View style={styles.stepCount}>
                <Ionicons name="alert-circle" size={16} color="#FF6B6B" />
                <Text style={styles.stepCountText}>
                  {blockedSteps.length} Blocked
                </Text>
              </View>
            </View>
          </Animated.View>
        ) : (
          <View style={styles.emptyPlan}>
            <Ionicons name="document-outline" size={64} color="#444444" />
            <Text style={styles.emptyTitle}>No Active Plan</Text>
            <Text style={styles.emptyText}>
              Create an execution plan from a decision to get started
            </Text>
          </View>
        )}

        {/* Copilot Suggestions Panel */}
        {copilotSuggestions.length > 0 && (
          <View style={styles.suggestionsPanel}>
            <View style={styles.suggestionHeader}>
              <Ionicons name="sparkles" size={18} color={ORACLE_COLORS.act} />
              <Text style={styles.suggestionTitle}>COPILOT GUIDANCE</Text>
            </View>
            {copilotSuggestions.slice(0, 3).map((suggestion, index) => (
              <View key={index} style={styles.suggestionItem}>
                <View style={[styles.suggestionIcon, { backgroundColor: getSuggestionColor(suggestion.type) }]}>
                  <Ionicons
                    name={getSuggestionIcon(suggestion.type) as any}
                    size={14}
                    color="#000000"
                  />
                </View>
                <View style={styles.suggestionContent}>
                  <Text style={styles.suggestionText}>{suggestion.content}</Text>
                  {suggestion.action && (
                    <TouchableOpacity style={styles.suggestionAction}>
                      <Text style={styles.suggestionActionText}>
                        {suggestion.action}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* View Mode Toggle */}
        <View style={styles.viewToggle}>
          <TouchableOpacity
            style={[styles.toggleButton, viewMode === 'focus' && styles.toggleButtonActive]}
            onPress={() => setViewMode('focus')}
          >
            <Ionicons
              name="locate-outline"
              size={18}
              color={viewMode === 'focus' ? ORACLE_COLORS.act : '#666666'}
            />
            <Text
              style={[
                styles.toggleButtonText,
                viewMode === 'focus' && styles.toggleButtonTextActive,
              ]}
            >
              FOCUS
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleButton, viewMode === 'list' && styles.toggleButtonActive]}
            onPress={() => setViewMode('list')}
          >
            <Ionicons
              name="list-outline"
              size={18}
              color={viewMode === 'list' ? ORACLE_COLORS.act : '#666666'}
            />
            <Text
              style={[
                styles.toggleButtonText,
                viewMode === 'list' && styles.toggleButtonTextActive,
              ]}
            >
              ALL STEPS
            </Text>
          </TouchableOpacity>
        </View>

        {/* View Content */}
        {viewMode === 'focus' ? (
          <CurrentStepFocus
            step={currentStep}
            copilotGuidance={
              copilotSuggestions.find((s) => s.step_id === currentStep?.id)?.content
            }
            onComplete={handleCompleteStep}
            onReportBlocker={handleReportBlocker}
          />
        ) : (
          <StepByStepView
            steps={steps}
            onComplete={handleCompleteStep}
            onReportBlocker={handleReportBlocker}
          />
        )}
      </ScrollView>
    </View>
  );
};

const getSuggestionColor = (type?: string): string => {
  switch (type) {
    case 'tip':
      return ORACLE_COLORS.act;
    case 'warning':
      return '#FFA500';
    case 'blocker':
      return '#FF6B6B';
    case 'optimization':
      return '#00BFFF';
    default:
      return '#888888';
  }
};

const getSuggestionIcon = (type?: string): string => {
  switch (type) {
    case 'tip':
      return 'bulb-outline';
    case 'warning':
      return 'warning-outline';
    case 'blocker':
      return 'stop-circle-outline';
    case 'optimization':
      return 'flash-outline';
    default:
      return 'information-circle-outline';
  }
};

const styles = StyleSheet.create({
  planCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: ORACLE_COLORS.act,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  planTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  planTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginLeft: 10,
    flex: 1,
  },
  refreshButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 255, 136, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressSection: {
    marginBottom: 16,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#333333',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: ORACLE_COLORS.act,
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    color: ORACLE_COLORS.act,
    fontWeight: 'bold',
    textAlign: 'right',
  },
  stepCounts: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  stepCount: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepCountText: {
    fontSize: 12,
    color: '#AAAAAA',
    marginLeft: 6,
  },
  emptyPlan: {
    alignItems: 'center',
    padding: 48,
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666666',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#555555',
    textAlign: 'center',
  },
  suggestionsPanel: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  suggestionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  suggestionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: ORACLE_COLORS.act,
    marginLeft: 8,
    letterSpacing: 1,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  suggestionIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  suggestionContent: {
    flex: 1,
  },
  suggestionText: {
    fontSize: 13,
    color: '#CCCCCC',
    lineHeight: 20,
  },
  suggestionAction: {
    marginTop: 8,
  },
  suggestionActionText: {
    fontSize: 12,
    color: ORACLE_COLORS.act,
    fontWeight: '600',
  },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  toggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
  },
  toggleButtonActive: {
    backgroundColor: 'rgba(0, 255, 136, 0.15)',
  },
  toggleButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666666',
    marginLeft: 6,
  },
  toggleButtonTextActive: {
    color: ORACLE_COLORS.act,
  },
});
