/**
 * CurrentStepFocus Component
 * Story 7.13 - Active step with full details and copilot guidance
 */
import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Animated,
  Modal,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ExecutionStep } from '@mission-control/shared-types';
import { ORACLE_COLORS, ORACLE_TIMING } from '../theme';

interface CurrentStepFocusProps {
  step?: ExecutionStep;
  copilotGuidance?: string;
  onComplete: (step: ExecutionStep) => void;
  onReportBlocker: (step: ExecutionStep, description: string) => void;
}

export const CurrentStepFocus: React.FC<CurrentStepFocusProps> = ({
  step,
  copilotGuidance,
  onComplete,
  onReportBlocker,
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const [showBlockerModal, setShowBlockerModal] = useState(false);
  const [blockerDescription, setBlockerDescription] = useState('');

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: ORACLE_TIMING.fadeIn,
      useNativeDriver: true,
    }).start();

    // Pulse animation for active indicator
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const handleComplete = () => {
    if (step) {
      onComplete(step);
    }
  };

  const handleReportBlocker = () => {
    if (step && blockerDescription.trim()) {
      onReportBlocker(step, blockerDescription);
      setShowBlockerModal(false);
      setBlockerDescription('');
    }
  };

  const pulseOpacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.8],
  });

  if (!step) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="checkmark-done-circle" size={64} color="#444444" />
        <Text style={styles.emptyTitle}>No Active Step</Text>
        <Text style={styles.emptyText}>
          All steps are complete or there's no active plan
        </Text>
      </View>
    );
  }

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      {/* Active Indicator */}
      <View style={styles.activeIndicator}>
        <Animated.View
          style={[
            styles.pulseRing,
            { opacity: pulseOpacity },
          ]}
        />
        <View style={styles.activeIcon}>
          <Ionicons name="locate" size={24} color={ORACLE_COLORS.act} />
        </View>
        <Text style={styles.activeLabel}>CURRENT STEP</Text>
      </View>

      {/* Step Content */}
      <View style={styles.stepContent}>
        <Text style={styles.stepTitle}>{step.title}</Text>

        {step.description && (
          <Text style={styles.stepDescription}>{step.description}</Text>
        )}

        {/* Duration Estimate */}
        {step.estimated_duration && (
          <View style={styles.durationRow}>
            <Ionicons name="time-outline" size={18} color={ORACLE_COLORS.act} />
            <Text style={styles.durationText}>
              Estimated: {step.estimated_duration}
            </Text>
          </View>
        )}

        {/* Instructions */}
        {step.instructions && step.instructions.length > 0 && (
          <View style={styles.instructionsSection}>
            <Text style={styles.sectionLabel}>INSTRUCTIONS</Text>
            {step.instructions.map((instruction, index) => (
              <View key={index} style={styles.instructionItem}>
                <View style={styles.instructionNumber}>
                  <Text style={styles.instructionNumberText}>{index + 1}</Text>
                </View>
                <Text style={styles.instructionText}>{instruction}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Copilot Guidance */}
      {copilotGuidance && (
        <View style={styles.guidanceSection}>
          <View style={styles.guidanceHeader}>
            <Ionicons name="sparkles" size={18} color={ORACLE_COLORS.act} />
            <Text style={styles.guidanceTitle}>COPILOT GUIDANCE</Text>
          </View>
          <Text style={styles.guidanceText}>{copilotGuidance}</Text>
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={styles.completeButton}
          onPress={handleComplete}
        >
          <Ionicons name="checkmark-circle" size={24} color="#000000" />
          <Text style={styles.completeButtonText}>COMPLETE STEP</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.blockerButton}
          onPress={() => setShowBlockerModal(true)}
        >
          <Ionicons name="alert-circle" size={24} color="#FF6B6B" />
          <Text style={styles.blockerButtonText}>REPORT BLOCKER</Text>
        </TouchableOpacity>
      </View>

      {/* Tips */}
      <View style={styles.tipsSection}>
        <Text style={styles.tipsLabel}>QUICK TIPS</Text>
        <View style={styles.tipItem}>
          <Ionicons name="bulb-outline" size={14} color="#FFD700" />
          <Text style={styles.tipText}>
            Focus on this step before moving to the next
          </Text>
        </View>
        <View style={styles.tipItem}>
          <Ionicons name="chatbubble-outline" size={14} color="#00BFFF" />
          <Text style={styles.tipText}>
            Report blockers early to get help faster
          </Text>
        </View>
      </View>

      {/* Blocker Modal */}
      <Modal
        visible={showBlockerModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowBlockerModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowBlockerModal(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Ionicons name="alert-circle" size={24} color="#FF6B6B" />
              <Text style={styles.modalTitle}>Report Blocker</Text>
              <TouchableOpacity onPress={() => setShowBlockerModal(false)}>
                <Ionicons name="close" size={24} color="#888888" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalLabel}>
              What's blocking this step?
            </Text>

            <TextInput
              style={styles.blockerInput}
              value={blockerDescription}
              onChangeText={setBlockerDescription}
              placeholder="Describe the blocker..."
              placeholderTextColor="#666666"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowBlockerModal(false)}
              >
                <Text style={styles.modalCancelText}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalSubmitButton,
                  !blockerDescription.trim() && styles.modalSubmitButtonDisabled,
                ]}
                onPress={handleReportBlocker}
                disabled={!blockerDescription.trim()}
              >
                <Text style={styles.modalSubmitText}>REPORT</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: ORACLE_COLORS.act,
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 48,
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
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
  activeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  pulseRing: {
    position: 'absolute',
    left: -8,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: ORACLE_COLORS.act,
  },
  activeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 255, 136, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activeLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: ORACLE_COLORS.act,
    letterSpacing: 1,
  },
  stepContent: {
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  stepDescription: {
    fontSize: 14,
    color: '#CCCCCC',
    lineHeight: 22,
    marginBottom: 16,
  },
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  durationText: {
    fontSize: 14,
    color: ORACLE_COLORS.act,
    marginLeft: 8,
    fontWeight: '600',
  },
  instructionsSection: {
    marginTop: 16,
  },
  sectionLabel: {
    fontSize: 10,
    color: '#888888',
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 12,
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  instructionNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: ORACLE_COLORS.act,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  instructionNumberText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#000000',
  },
  instructionText: {
    flex: 1,
    fontSize: 14,
    color: '#CCCCCC',
    lineHeight: 22,
  },
  guidanceSection: {
    backgroundColor: 'rgba(0, 255, 136, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  guidanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  guidanceTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: ORACLE_COLORS.act,
    marginLeft: 8,
    letterSpacing: 1,
  },
  guidanceText: {
    fontSize: 14,
    color: '#CCCCCC',
    lineHeight: 22,
  },
  actionsContainer: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  completeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ORACLE_COLORS.act,
    paddingVertical: 14,
    borderRadius: 8,
    marginRight: 8,
  },
  completeButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#000000',
    marginLeft: 8,
  },
  blockerButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FF6B6B',
  },
  blockerButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FF6B6B',
    marginLeft: 8,
  },
  tipsSection: {
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#333333',
  },
  tipsLabel: {
    fontSize: 10,
    color: '#888888',
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 10,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  tipText: {
    fontSize: 12,
    color: '#AAAAAA',
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 20,
    width: '100%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginLeft: 12,
  },
  modalLabel: {
    fontSize: 14,
    color: '#CCCCCC',
    marginBottom: 12,
  },
  blockerInput: {
    backgroundColor: '#0D0D0D',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#FFFFFF',
    minHeight: 100,
    borderWidth: 1,
    borderColor: '#333333',
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  modalCancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginRight: 12,
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#888888',
  },
  modalSubmitButton: {
    backgroundColor: '#FF6B6B',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  modalSubmitButtonDisabled: {
    opacity: 0.5,
  },
  modalSubmitText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#000000',
  },
});
