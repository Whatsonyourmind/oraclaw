/**
 * QuickResolve Component
 * Story ux-4 - One-Tap Problem Resolution
 *
 * Features:
 * - Pre-computed solution suggestions
 * - Swipe-to-apply actions
 * - Undo capability with 5-second window
 * - Batch resolution mode
 * - Confidence indicators for suggestions
 * - Smart defaults based on user history
 * - Haptic feedback on actions
 *
 * Time Complexity: O(n) for rendering workflows
 * Space Complexity: O(k) where k = undo stack size
 */
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Modal,
  ActivityIndicator,
  Dimensions,
  ScrollView,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  withDelay,
  runOnJS,
  interpolate,
  Extrapolate,
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
} from 'react-native-reanimated';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  useUXStore,
  useUXSelectors,
  ResolutionWorkflow,
  ResolutionStep,
} from '../../../store/oracle/uxStore';
import { ORACLE_COLORS, ORACLE_TIMING } from '../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = 80;
const BATCH_SWIPE_THRESHOLD = 60;

// Resolution card state
export type ResolutionState = 'idle' | 'executing' | 'success' | 'failure' | 'undoing';

// Resolution result
export interface ResolutionResult {
  workflowId: string;
  success: boolean;
  timestamp: number;
  message?: string;
  undoAvailable: boolean;
  undoExpiresAt?: number;
}

// Pre-computed suggestion with confidence
export interface ResolutionSuggestion {
  workflow: ResolutionWorkflow;
  confidence: number;
  reason: string;
  predictedOutcome?: string;
  estimatedTime: number; // milliseconds
  relatedItems: string[];
  smartDefaults?: Record<string, unknown>;
}

// Batch resolution item
export interface BatchResolutionItem {
  id: string;
  workflowId: string;
  selected: boolean;
  priority: number;
  suggestion: ResolutionSuggestion;
}

interface QuickResolveProps {
  onResolution?: (result: ResolutionResult) => void;
  showHistory?: boolean;
  maxVisible?: number;
  enableBatchMode?: boolean;
  suggestions?: ResolutionSuggestion[];
}

/**
 * Compute smart suggestions based on user history and context
 * Uses historical success rates and recent patterns
 */
const computeSuggestions = (
  workflows: ResolutionWorkflow[],
  recentResolutions: Array<{ workflowId: string; timestamp: string; success: boolean }>,
  contextMode?: string
): ResolutionSuggestion[] => {
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;
  const recentWorkflowUsage = new Map<string, number>();

  // Count recent successful usages (last hour)
  recentResolutions.forEach((r) => {
    if (r.success && now - new Date(r.timestamp).getTime() < oneHour) {
      recentWorkflowUsage.set(r.workflowId, (recentWorkflowUsage.get(r.workflowId) || 0) + 1);
    }
  });

  return workflows
    .map((workflow) => {
      const totalExecutions = workflow.successCount + workflow.failureCount;
      const successRate = totalExecutions > 0 ? workflow.successCount / totalExecutions : 0.5;
      const recentUsage = recentWorkflowUsage.get(workflow.id) || 0;

      // Calculate confidence based on multiple factors
      let confidence = successRate * 0.4; // Base from success rate
      confidence += Math.min(recentUsage * 0.1, 0.3); // Recent usage bonus (max 0.3)
      confidence += totalExecutions > 10 ? 0.2 : totalExecutions * 0.02; // Experience factor
      confidence += workflow.avgExecutionTime < 1000 ? 0.1 : 0; // Fast execution bonus

      // Context-based adjustments
      if (contextMode === 'meeting' && workflow.id === 'resolve-calendar-conflict') {
        confidence += 0.15;
      } else if (contextMode === 'deepwork' && workflow.id === 'snooze-deadline') {
        confidence += 0.15;
      }

      // Determine reason for suggestion
      let reason = 'Based on overall success rate';
      if (recentUsage >= 2) {
        reason = 'Frequently used recently';
      } else if (successRate >= 0.9) {
        reason = 'High success rate';
      } else if (workflow.avgExecutionTime < 500) {
        reason = 'Fast execution time';
      }

      return {
        workflow,
        confidence: Math.min(confidence, 1),
        reason,
        predictedOutcome: `Expected ${Math.round(successRate * 100)}% success`,
        estimatedTime: workflow.avgExecutionTime || 500,
        relatedItems: [],
        smartDefaults: getSmartDefaults(workflow.id, recentResolutions),
      };
    })
    .sort((a, b) => b.confidence - a.confidence);
};

/**
 * Get smart defaults based on user history
 */
const getSmartDefaults = (
  workflowId: string,
  recentResolutions: Array<{ workflowId: string; timestamp: string; success: boolean }>
): Record<string, unknown> => {
  const defaults: Record<string, unknown> = {};

  switch (workflowId) {
    case 'snooze-deadline':
      // If user recently snoozed, suggest longer duration
      const recentSnoozes = recentResolutions.filter(
        (r) => r.workflowId === 'snooze-deadline' && r.success
      ).length;
      defaults.duration = recentSnoozes > 2 ? '2h' : '1h';
      defaults.reason = 'Need more time';
      break;
    case 'delegate-task':
      defaults.notifyDelegate = true;
      defaults.includeBriefing = true;
      break;
    case 'mark-complete':
      defaults.addNote = false;
      defaults.notifyStakeholders = true;
      break;
    default:
      break;
  }

  return defaults;
};

/**
 * QuickResolve Component
 * Provides one-tap resolution cards with swipe-to-apply and undo capability
 */
export const QuickResolve: React.FC<QuickResolveProps> = ({
  onResolution,
  showHistory = true,
  maxVisible = 4,
  enableBatchMode = true,
  suggestions: externalSuggestions,
}) => {
  const [activeWorkflow, setActiveWorkflow] = useState<string | null>(null);
  const [workflowState, setWorkflowState] = useState<ResolutionState>('idle');
  const [lastResult, setLastResult] = useState<ResolutionResult | null>(null);
  const [showUndoToast, setShowUndoToast] = useState(false);
  const [undoCountdown, setUndoCountdown] = useState(5);
  const [showAllModal, setShowAllModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [batchMode, setBatchMode] = useState(false);
  const [batchItems, setBatchItems] = useState<BatchResolutionItem[]>([]);
  const [batchExecuting, setBatchExecuting] = useState(false);
  const [batchProgress, setBatchProgress] = useState(0);

  const {
    resolutionWorkflows,
    recentResolutions,
    executeResolution,
    undoResolution,
    clearExpiredUndo,
    hapticEnabled,
    currentContext,
  } = useUXStore();

  const topWorkflows = useUXSelectors.topResolutionWorkflows();
  const hasActiveUndo = useUXSelectors.hasActiveUndo();

  // Compute suggestions with smart defaults
  const computedSuggestions = useMemo(() => {
    if (externalSuggestions) return externalSuggestions;
    return computeSuggestions(resolutionWorkflows, recentResolutions, currentContext);
  }, [externalSuggestions, resolutionWorkflows, recentResolutions, currentContext]);

  // Animation values for undo toast
  const undoProgress = useSharedValue(1);
  const undoToastY = useSharedValue(100);

  // Clear expired undo entries periodically
  useEffect(() => {
    const interval = setInterval(clearExpiredUndo, 1000);
    return () => clearInterval(interval);
  }, [clearExpiredUndo]);

  // Undo countdown timer
  useEffect(() => {
    if (showUndoToast && undoCountdown > 0) {
      const timer = setTimeout(() => {
        setUndoCountdown((prev) => prev - 1);
        undoProgress.value = withTiming((undoCountdown - 1) / 5, { duration: 1000 });
      }, 1000);

      return () => clearTimeout(timer);
    } else if (undoCountdown === 0) {
      hideUndoToast();
    }
  }, [showUndoToast, undoCountdown]);

  // Show undo toast
  const showUndoToastFn = useCallback(() => {
    setShowUndoToast(true);
    setUndoCountdown(5);
    undoProgress.value = 1;
    undoToastY.value = withSpring(0, { damping: 15 });
  }, []);

  // Hide undo toast
  const hideUndoToast = useCallback(() => {
    undoToastY.value = withTiming(100, { duration: 200 });
    setTimeout(() => setShowUndoToast(false), 200);
  }, []);

  // Trigger haptic feedback
  const triggerHaptic = useCallback(
    async (type: 'light' | 'medium' | 'heavy' | 'success' | 'error') => {
      if (!hapticEnabled) return;

      try {
        switch (type) {
          case 'light':
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            break;
          case 'medium':
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            break;
          case 'heavy':
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            break;
          case 'success':
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            break;
          case 'error':
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            break;
        }
      } catch (error) {
        console.warn('Haptic feedback not available:', error);
      }
    },
    [hapticEnabled]
  );

  // Execute a resolution workflow
  const handleExecute = useCallback(async (workflow: ResolutionWorkflow) => {
    if (workflowState !== 'idle') return;

    setActiveWorkflow(workflow.id);
    setWorkflowState('executing');
    triggerHaptic('medium');

    try {
      const success = await executeResolution(workflow.id);

      const result: ResolutionResult = {
        workflowId: workflow.id,
        success,
        timestamp: Date.now(),
        message: success ? 'Resolution completed' : 'Resolution failed',
        undoAvailable: success,
        undoExpiresAt: success ? Date.now() + 5000 : undefined,
      };

      setLastResult(result);
      setWorkflowState(success ? 'success' : 'failure');
      triggerHaptic(success ? 'success' : 'error');

      if (success) {
        showUndoToastFn();
      }

      onResolution?.(result);

      setTimeout(() => {
        setWorkflowState('idle');
        setActiveWorkflow(null);
      }, success ? 1500 : 2500);
    } catch (error) {
      setWorkflowState('failure');
      triggerHaptic('error');
      setTimeout(() => {
        setWorkflowState('idle');
        setActiveWorkflow(null);
      }, 2000);
    }
  }, [workflowState, executeResolution, triggerHaptic, onResolution, showUndoToastFn]);

  // Handle undo
  const handleUndo = useCallback(async () => {
    if (!hasActiveUndo) return;

    setWorkflowState('undoing');
    hideUndoToast();
    triggerHaptic('light');

    const success = await undoResolution();

    if (success) {
      triggerHaptic('success');
    }

    setWorkflowState('idle');
  }, [hasActiveUndo, undoResolution, triggerHaptic, hideUndoToast]);

  // Toggle batch mode
  const toggleBatchMode = useCallback(() => {
    if (!batchMode) {
      // Initialize batch items from suggestions
      const items: BatchResolutionItem[] = computedSuggestions.slice(0, 6).map((suggestion, index) => ({
        id: `batch-${suggestion.workflow.id}`,
        workflowId: suggestion.workflow.id,
        selected: false,
        priority: index + 1,
        suggestion,
      }));
      setBatchItems(items);
    }
    setBatchMode(!batchMode);
    triggerHaptic('light');
  }, [batchMode, computedSuggestions, triggerHaptic]);

  // Toggle batch item selection
  const toggleBatchItem = useCallback((itemId: string) => {
    setBatchItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, selected: !item.selected } : item
      )
    );
    triggerHaptic('light');
  }, [triggerHaptic]);

  // Execute batch resolution
  const executeBatch = useCallback(async () => {
    const selectedItems = batchItems.filter((item) => item.selected);
    if (selectedItems.length === 0) return;

    setBatchExecuting(true);
    setBatchProgress(0);
    triggerHaptic('medium');

    const results: ResolutionResult[] = [];

    for (let i = 0; i < selectedItems.length; i++) {
      const item = selectedItems[i];
      setBatchProgress((i + 1) / selectedItems.length);

      try {
        const success = await executeResolution(item.workflowId);
        results.push({
          workflowId: item.workflowId,
          success,
          timestamp: Date.now(),
          undoAvailable: success,
        });

        // Small delay between executions for visual feedback
        await new Promise((resolve) => setTimeout(resolve, 300));
      } catch {
        results.push({
          workflowId: item.workflowId,
          success: false,
          timestamp: Date.now(),
          undoAvailable: false,
        });
      }
    }

    const allSuccess = results.every((r) => r.success);
    triggerHaptic(allSuccess ? 'success' : 'error');

    setBatchExecuting(false);
    setBatchMode(false);
    setBatchItems([]);

    if (allSuccess) {
      showUndoToastFn();
    }

    results.forEach((result) => onResolution?.(result));
  }, [batchItems, executeResolution, triggerHaptic, showUndoToastFn, onResolution]);

  // Render confidence indicator
  const renderConfidenceIndicator = (confidence: number) => {
    const color = confidence >= 0.8 ? ORACLE_COLORS.act :
                  confidence >= 0.5 ? ORACLE_COLORS.orient :
                  ORACLE_COLORS.decide;

    return (
      <View style={styles.confidenceContainer}>
        <View style={styles.confidenceBar}>
          <View style={[styles.confidenceFill, { width: `${confidence * 100}%`, backgroundColor: color }]} />
        </View>
        <Text style={[styles.confidenceText, { color }]}>
          {Math.round(confidence * 100)}%
        </Text>
      </View>
    );
  };

  // Animated undo toast style
  const undoToastStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: undoToastY.value }],
  }));

  const undoProgressStyle = useAnimatedStyle(() => ({
    width: `${undoProgress.value * 100}%`,
  }));

  // Render swipeable workflow card
  const renderSwipeableCard = ({ item: suggestion, index }: { item: ResolutionSuggestion; index: number }) => {
    return (
      <SwipeableResolutionCard
        key={suggestion.workflow.id}
        suggestion={suggestion}
        isActive={activeWorkflow === suggestion.workflow.id}
        workflowState={activeWorkflow === suggestion.workflow.id ? workflowState : 'idle'}
        onExecute={() => handleExecute(suggestion.workflow)}
        onSwipeApply={() => handleExecute(suggestion.workflow)}
        hapticEnabled={hapticEnabled}
        index={index}
      />
    );
  };

  // Render batch mode item
  const renderBatchItem = ({ item }: { item: BatchResolutionItem }) => {
    const workflow = item.suggestion.workflow;

    return (
      <TouchableOpacity
        style={[
          styles.batchItem,
          item.selected && styles.batchItemSelected,
        ]}
        onPress={() => toggleBatchItem(item.id)}
        activeOpacity={0.7}
      >
        <View style={[styles.batchCheckbox, item.selected && styles.batchCheckboxSelected]}>
          {item.selected && <Ionicons name="checkmark" size={16} color="#000000" />}
        </View>
        <View style={styles.batchContent}>
          <Text style={styles.batchName}>{workflow.name}</Text>
          <Text style={styles.batchReason}>{item.suggestion.reason}</Text>
        </View>
        {renderConfidenceIndicator(item.suggestion.confidence)}
      </TouchableOpacity>
    );
  };

  // Render history item
  const renderHistoryItem = ({ item }: { item: typeof recentResolutions[0] }) => {
    const workflow = resolutionWorkflows.find((w) => w.id === item.workflowId);
    if (!workflow) return null;

    const date = new Date(item.timestamp);
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return (
      <View style={styles.historyItem}>
        <View style={[styles.historyIcon, { backgroundColor: item.success ? ORACLE_COLORS.act : '#FF4444' }]}>
          <Ionicons
            name={item.success ? 'checkmark' : 'close'}
            size={14}
            color="#000000"
          />
        </View>
        <View style={styles.historyContent}>
          <Text style={styles.historyName}>{workflow.name}</Text>
          <Text style={styles.historyTime}>{timeStr}</Text>
        </View>
      </View>
    );
  };

  return (
    <GestureHandlerRootView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.sectionTitle}>QUICK RESOLVE</Text>
        <View style={styles.headerActions}>
          {enableBatchMode && (
            <TouchableOpacity
              style={[styles.headerButton, batchMode && styles.headerButtonActive]}
              onPress={toggleBatchMode}
            >
              <Ionicons
                name={batchMode ? 'layers' : 'layers-outline'}
                size={20}
                color={batchMode ? ORACLE_COLORS.act : '#888888'}
              />
            </TouchableOpacity>
          )}
          {showHistory && recentResolutions.length > 0 && (
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => setShowHistoryModal(true)}
            >
              <Ionicons name="time-outline" size={20} color="#888888" />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => setShowAllModal(true)}
          >
            <Ionicons name="grid-outline" size={20} color="#888888" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Batch Mode */}
      {batchMode ? (
        <Animated.View entering={FadeIn} exiting={FadeOut}>
          <View style={styles.batchHeader}>
            <Text style={styles.batchTitle}>
              Select workflows to execute ({batchItems.filter((i) => i.selected).length} selected)
            </Text>
          </View>
          <FlatList
            data={batchItems}
            keyExtractor={(item) => item.id}
            renderItem={renderBatchItem}
            showsVerticalScrollIndicator={false}
            scrollEnabled={false}
          />
          {batchItems.some((i) => i.selected) && (
            <TouchableOpacity
              style={[styles.batchExecuteButton, batchExecuting && styles.batchExecuteButtonDisabled]}
              onPress={executeBatch}
              disabled={batchExecuting}
            >
              {batchExecuting ? (
                <View style={styles.batchProgressContainer}>
                  <ActivityIndicator size="small" color="#000000" />
                  <Text style={styles.batchExecuteText}>
                    Executing... {Math.round(batchProgress * 100)}%
                  </Text>
                </View>
              ) : (
                <>
                  <Ionicons name="flash" size={20} color="#000000" />
                  <Text style={styles.batchExecuteText}>
                    Execute {batchItems.filter((i) => i.selected).length} Workflows
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </Animated.View>
      ) : (
        /* Suggestion Cards with Swipe */
        <FlatList
          data={computedSuggestions.slice(0, maxVisible)}
          keyExtractor={(item) => item.workflow.id}
          renderItem={renderSwipeableCard}
          showsVerticalScrollIndicator={false}
          scrollEnabled={false}
        />
      )}

      {/* Show more button */}
      {!batchMode && resolutionWorkflows.length > maxVisible && (
        <TouchableOpacity
          style={styles.showMoreButton}
          onPress={() => setShowAllModal(true)}
        >
          <Text style={styles.showMoreText}>
            +{resolutionWorkflows.length - maxVisible} more workflows
          </Text>
          <Ionicons name="chevron-forward" size={16} color="#888888" />
        </TouchableOpacity>
      )}

      {/* Undo Toast */}
      {showUndoToast && (
        <Animated.View style={[styles.undoToast, undoToastStyle]}>
          <View style={styles.undoContent}>
            <Ionicons name="checkmark-circle" size={20} color={ORACLE_COLORS.act} />
            <Text style={styles.undoText}>Resolution completed</Text>
            <TouchableOpacity style={styles.undoButton} onPress={handleUndo}>
              <Text style={styles.undoButtonText}>UNDO ({undoCountdown}s)</Text>
            </TouchableOpacity>
          </View>
          <Animated.View style={[styles.undoProgressBar, undoProgressStyle]} />
        </Animated.View>
      )}

      {/* All Workflows Modal */}
      <Modal
        visible={showAllModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowAllModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>All Workflows</Text>
              <TouchableOpacity onPress={() => setShowAllModal(false)}>
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {computedSuggestions.map((suggestion) => (
                <TouchableOpacity
                  key={suggestion.workflow.id}
                  style={styles.modalWorkflowCard}
                  onPress={() => {
                    setShowAllModal(false);
                    handleExecute(suggestion.workflow);
                  }}
                >
                  <View style={[styles.workflowIcon, { backgroundColor: getWorkflowColor(suggestion.workflow.id) }]}>
                    <Ionicons name={getWorkflowIcon(suggestion.workflow.id)} size={24} color="#000000" />
                  </View>
                  <View style={styles.workflowContent}>
                    <Text style={styles.workflowName}>{suggestion.workflow.name}</Text>
                    <Text style={styles.workflowDescription}>{suggestion.reason}</Text>
                  </View>
                  {renderConfidenceIndicator(suggestion.confidence)}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* History Modal */}
      <Modal
        visible={showHistoryModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowHistoryModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Resolution History</Text>
              <TouchableOpacity onPress={() => setShowHistoryModal(false)}>
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={recentResolutions.slice(0, 20)}
              keyExtractor={(item, index) => `${item.workflowId}-${index}`}
              renderItem={renderHistoryItem}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.modalList}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Ionicons name="document-outline" size={48} color="#444444" />
                  <Text style={styles.emptyText}>No resolution history yet</Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>
    </GestureHandlerRootView>
  );
};

/**
 * SwipeableResolutionCard - Card with swipe-to-apply gesture
 */
interface SwipeableResolutionCardProps {
  suggestion: ResolutionSuggestion;
  isActive: boolean;
  workflowState: ResolutionState;
  onExecute: () => void;
  onSwipeApply: () => void;
  hapticEnabled: boolean;
  index: number;
}

const SwipeableResolutionCard: React.FC<SwipeableResolutionCardProps> = ({
  suggestion,
  isActive,
  workflowState,
  onExecute,
  onSwipeApply,
  hapticEnabled,
  index,
}) => {
  const { workflow, confidence, reason, estimatedTime } = suggestion;
  const translateX = useSharedValue(0);
  const scale = useSharedValue(1);
  const actionOpacity = useSharedValue(0);

  const successRate = workflow.successCount + workflow.failureCount > 0
    ? workflow.successCount / (workflow.successCount + workflow.failureCount)
    : 1;

  // Pan gesture for swipe-to-apply
  const panGesture = Gesture.Pan()
    .activeOffsetX([-20, 20])
    .onUpdate((event) => {
      translateX.value = Math.max(0, event.translationX);
      actionOpacity.value = interpolate(
        event.translationX,
        [0, SWIPE_THRESHOLD],
        [0, 1],
        Extrapolate.CLAMP
      );
    })
    .onEnd((event) => {
      if (event.translationX > SWIPE_THRESHOLD) {
        // Trigger swipe apply
        translateX.value = withTiming(SCREEN_WIDTH, { duration: 200 }, () => {
          runOnJS(onSwipeApply)();
        });
        if (hapticEnabled) {
          runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Medium);
        }
      } else {
        translateX.value = withSpring(0);
        actionOpacity.value = withTiming(0);
      }
    });

  // Tap gesture for direct execute
  const tapGesture = Gesture.Tap()
    .onStart(() => {
      scale.value = withSequence(
        withTiming(0.95, { duration: 100 }),
        withTiming(1, { duration: 100 })
      );
    })
    .onEnd(() => {
      runOnJS(onExecute)();
    });

  const composedGesture = Gesture.Race(panGesture, tapGesture);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { scale: scale.value },
    ],
  }));

  const actionIndicatorStyle = useAnimatedStyle(() => ({
    opacity: actionOpacity.value,
    transform: [{ scale: actionOpacity.value }],
  }));

  const confidenceColor = confidence >= 0.8 ? ORACLE_COLORS.act :
                          confidence >= 0.5 ? ORACLE_COLORS.orient :
                          ORACLE_COLORS.decide;

  return (
    <Animated.View
      entering={FadeIn.delay(index * 50)}
      style={styles.swipeableContainer}
    >
      {/* Swipe action indicator */}
      <Animated.View style={[styles.swipeActionIndicator, actionIndicatorStyle]}>
        <Ionicons name="flash" size={32} color={ORACLE_COLORS.act} />
        <Text style={styles.swipeActionText}>APPLY</Text>
      </Animated.View>

      <GestureDetector gesture={composedGesture}>
        <Animated.View
          style={[
            styles.workflowCard,
            cardStyle,
            isActive && workflowState === 'executing' && styles.workflowCardExecuting,
            isActive && workflowState === 'success' && styles.workflowCardSuccess,
            isActive && workflowState === 'failure' && styles.workflowCardFailure,
          ]}
        >
          {/* Icon */}
          <View style={[styles.workflowIcon, { backgroundColor: getWorkflowColor(workflow.id) }]}>
            {isActive && workflowState === 'executing' ? (
              <ActivityIndicator size="small" color="#000000" />
            ) : (
              <Ionicons name={getWorkflowIcon(workflow.id)} size={24} color="#000000" />
            )}
          </View>

          {/* Content */}
          <View style={styles.workflowContent}>
            <View style={styles.workflowTitleRow}>
              <Text style={styles.workflowName}>{workflow.name}</Text>
              {/* Confidence badge */}
              <View style={[styles.confidenceBadge, { backgroundColor: confidenceColor }]}>
                <Text style={styles.confidenceBadgeText}>{Math.round(confidence * 100)}%</Text>
              </View>
            </View>
            <Text style={styles.workflowDescription} numberOfLines={1}>
              {reason}
            </Text>
            {/* Estimated time */}
            <View style={styles.metaRow}>
              <Ionicons name="time-outline" size={12} color="#666666" />
              <Text style={styles.metaText}>~{Math.round(estimatedTime / 1000)}s</Text>
              <View style={styles.metaSeparator} />
              <Ionicons name="trending-up" size={12} color="#666666" />
              <Text style={styles.metaText}>{Math.round(successRate * 100)}% success</Text>
            </View>
          </View>

          {/* Execute indicator */}
          <View style={styles.executeIndicator}>
            {workflowState === 'idle' || !isActive ? (
              <View style={styles.swipeHint}>
                <Ionicons name="chevron-forward" size={16} color="#666666" />
                <Ionicons name="chevron-forward" size={16} color="#888888" style={{ marginLeft: -10 }} />
              </View>
            ) : workflowState === 'success' && isActive ? (
              <Ionicons name="checkmark-circle" size={28} color={ORACLE_COLORS.act} />
            ) : workflowState === 'failure' && isActive ? (
              <Ionicons name="close-circle" size={28} color="#FF4444" />
            ) : null}
          </View>
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
};

// Helper functions
function getWorkflowIcon(id: string): keyof typeof Ionicons.glyphMap {
  const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
    'resolve-calendar-conflict': 'calendar',
    'snooze-deadline': 'alarm',
    'delegate-task': 'people',
    'mark-complete': 'checkmark-circle',
  };
  return icons[id] || 'flash';
}

function getWorkflowColor(id: string): string {
  const colors: Record<string, string> = {
    'resolve-calendar-conflict': ORACLE_COLORS.observe,
    'snooze-deadline': ORACLE_COLORS.orient,
    'delegate-task': '#9B59B6',
    'mark-complete': ORACLE_COLORS.act,
  };
  return colors[id] || ORACLE_COLORS.act;
}

/**
 * QuickResolveCard - Single resolution card for embedding
 */
interface QuickResolveCardProps {
  workflow: ResolutionWorkflow;
  suggestion?: ResolutionSuggestion;
  onExecute?: (success: boolean) => void;
  compact?: boolean;
}

export const QuickResolveCard: React.FC<QuickResolveCardProps> = ({
  workflow,
  suggestion,
  onExecute,
  compact = false,
}) => {
  const [state, setState] = useState<ResolutionState>('idle');
  const scale = useSharedValue(1);
  const { executeResolution, hapticEnabled } = useUXStore();

  const handlePress = async () => {
    if (state !== 'idle') return;

    setState('executing');

    if (hapticEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    scale.value = withSequence(
      withTiming(0.95, { duration: 100 }),
      withTiming(1, { duration: 100 })
    );

    const success = await executeResolution(workflow.id);
    setState(success ? 'success' : 'failure');

    if (hapticEnabled) {
      Haptics.notificationAsync(
        success
          ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Error
      );
    }

    onExecute?.(success);

    setTimeout(() => setState('idle'), 2000);
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <TouchableOpacity
        style={[
          styles.compactCard,
          compact && styles.compactCardSmall,
          state === 'success' && styles.compactCardSuccess,
          state === 'failure' && styles.compactCardFailure,
        ]}
        onPress={handlePress}
        disabled={state !== 'idle'}
      >
        <View style={[styles.compactIcon, { backgroundColor: getWorkflowColor(workflow.id) }]}>
          {state === 'executing' ? (
            <ActivityIndicator size="small" color="#000000" />
          ) : state === 'success' ? (
            <Ionicons name="checkmark" size={16} color="#000000" />
          ) : state === 'failure' ? (
            <Ionicons name="close" size={16} color="#000000" />
          ) : (
            <Ionicons name={getWorkflowIcon(workflow.id)} size={16} color="#000000" />
          )}
        </View>
        <View style={styles.compactContent}>
          <Text style={styles.compactName} numberOfLines={1}>
            {workflow.name}
          </Text>
          {suggestion && (
            <View style={styles.compactConfidence}>
              <View
                style={[
                  styles.compactConfidenceDot,
                  { backgroundColor: suggestion.confidence >= 0.8 ? ORACLE_COLORS.act : ORACLE_COLORS.orient }
                ]}
              />
              <Text style={styles.compactConfidenceText}>
                {Math.round(suggestion.confidence * 100)}%
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

/**
 * Hook for quick resolution functionality
 */
export const useQuickResolve = () => {
  const {
    resolutionWorkflows,
    recentResolutions,
    executeResolution,
    undoResolution,
    addResolutionWorkflow,
    currentContext,
  } = useUXStore();

  const topWorkflows = useUXSelectors.topResolutionWorkflows();
  const hasActiveUndo = useUXSelectors.hasActiveUndo();

  const suggestions = useMemo(() =>
    computeSuggestions(resolutionWorkflows, recentResolutions, currentContext),
    [resolutionWorkflows, recentResolutions, currentContext]
  );

  return {
    workflows: resolutionWorkflows,
    topWorkflows,
    suggestions,
    recentResolutions,
    hasActiveUndo,
    execute: executeResolution,
    undo: undoResolution,
    addWorkflow: addResolutionWorkflow,
  };
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#888888',
    letterSpacing: 2,
  },
  headerActions: {
    flexDirection: 'row',
  },
  headerButton: {
    padding: 8,
    marginLeft: 8,
  },
  headerButtonActive: {
    backgroundColor: 'rgba(0, 255, 136, 0.1)',
    borderRadius: 8,
  },
  swipeableContainer: {
    position: 'relative',
    marginBottom: 8,
  },
  swipeActionIndicator: {
    position: 'absolute',
    left: 16,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  swipeActionText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: ORACLE_COLORS.act,
    marginTop: 4,
  },
  workflowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#333333',
  },
  workflowCardExecuting: {
    borderColor: ORACLE_COLORS.observe,
    backgroundColor: 'rgba(0, 191, 255, 0.1)',
  },
  workflowCardSuccess: {
    borderColor: ORACLE_COLORS.act,
    backgroundColor: 'rgba(0, 255, 136, 0.1)',
  },
  workflowCardFailure: {
    borderColor: '#FF4444',
    backgroundColor: 'rgba(255, 68, 68, 0.1)',
  },
  workflowIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  workflowContent: {
    flex: 1,
    marginLeft: 12,
  },
  workflowTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  workflowName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    flex: 1,
  },
  workflowDescription: {
    fontSize: 12,
    color: '#888888',
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  metaText: {
    fontSize: 10,
    color: '#666666',
    marginLeft: 4,
  },
  metaSeparator: {
    width: 1,
    height: 10,
    backgroundColor: '#444444',
    marginHorizontal: 8,
  },
  confidenceBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  confidenceBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#000000',
  },
  confidenceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  confidenceBar: {
    width: 40,
    height: 4,
    backgroundColor: '#333333',
    borderRadius: 2,
    overflow: 'hidden',
  },
  confidenceFill: {
    height: '100%',
    borderRadius: 2,
  },
  confidenceText: {
    fontSize: 10,
    fontWeight: 'bold',
    marginLeft: 6,
  },
  executeIndicator: {
    width: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  swipeHint: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  showMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    marginTop: 4,
  },
  showMoreText: {
    fontSize: 12,
    color: '#888888',
    marginRight: 4,
  },
  undoToast: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: ORACLE_COLORS.act,
  },
  undoContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  undoText: {
    flex: 1,
    fontSize: 14,
    color: '#FFFFFF',
    marginLeft: 8,
  },
  undoButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(0, 255, 136, 0.2)',
    borderRadius: 6,
  },
  undoButtonText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: ORACLE_COLORS.act,
  },
  undoProgressBar: {
    height: 3,
    backgroundColor: ORACLE_COLORS.act,
  },
  // Batch mode styles
  batchHeader: {
    marginBottom: 12,
  },
  batchTitle: {
    fontSize: 14,
    color: '#FFFFFF',
  },
  batchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#333333',
  },
  batchItemSelected: {
    borderColor: ORACLE_COLORS.act,
    backgroundColor: 'rgba(0, 255, 136, 0.05)',
  },
  batchCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#555555',
    justifyContent: 'center',
    alignItems: 'center',
  },
  batchCheckboxSelected: {
    backgroundColor: ORACLE_COLORS.act,
    borderColor: ORACLE_COLORS.act,
  },
  batchContent: {
    flex: 1,
    marginLeft: 12,
  },
  batchName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  batchReason: {
    fontSize: 12,
    color: '#888888',
    marginTop: 2,
  },
  batchExecuteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ORACLE_COLORS.act,
    borderRadius: 10,
    padding: 14,
    marginTop: 12,
  },
  batchExecuteButtonDisabled: {
    opacity: 0.7,
  },
  batchExecuteText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#000000',
    marginLeft: 8,
  },
  batchProgressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  // Modal styles
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
  modalList: {
    paddingBottom: 20,
  },
  modalWorkflowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  historyIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  historyContent: {
    flex: 1,
    marginLeft: 12,
  },
  historyName: {
    fontSize: 14,
    color: '#FFFFFF',
  },
  historyTime: {
    fontSize: 12,
    color: '#666666',
    marginTop: 2,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 14,
    color: '#666666',
    marginTop: 12,
  },
  compactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#333333',
  },
  compactCardSmall: {
    padding: 8,
  },
  compactCardSuccess: {
    borderColor: ORACLE_COLORS.act,
    backgroundColor: 'rgba(0, 255, 136, 0.1)',
  },
  compactCardFailure: {
    borderColor: '#FF4444',
    backgroundColor: 'rgba(255, 68, 68, 0.1)',
  },
  compactIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  compactContent: {
    flex: 1,
    marginLeft: 8,
  },
  compactName: {
    fontSize: 12,
    color: '#FFFFFF',
  },
  compactConfidence: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  compactConfidenceDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  compactConfidenceText: {
    fontSize: 10,
    color: '#666666',
  },
});

export default QuickResolve;
