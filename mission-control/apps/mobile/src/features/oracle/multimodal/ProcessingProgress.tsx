/**
 * ProcessingProgress Component
 * Show processing status with animations
 *
 * Features:
 * - Animated progress indicator
 * - Stage-by-stage status display
 * - Estimated time remaining
 * - Cancel/retry options
 * - Error handling display
 *
 * @module features/oracle/multimodal/ProcessingProgress
 */

import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ORACLE_COLORS, ORACLE_TIMING, getPhaseColor } from '../theme';

// ============================================================================
// Types
// ============================================================================

/**
 * Processing status
 */
type ProcessingStatus =
  | 'queued'
  | 'processing'
  | 'extracting'
  | 'analyzing'
  | 'generating_signals'
  | 'completed'
  | 'failed';

/**
 * Processing progress data
 */
interface ProcessingProgressData {
  processingId: string;
  status: ProcessingStatus;
  progress: number; // 0-100
  stage: string;
  message?: string;
  error?: string;
  startTime?: number;
  estimatedDuration?: number;
}

/**
 * Props for ProcessingProgress
 */
interface ProcessingProgressProps {
  data: ProcessingProgressData;
  onCancel?: () => void;
  onRetry?: () => void;
  onDismiss?: () => void;
  showDetails?: boolean;
  compact?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export const ProcessingProgress: React.FC<ProcessingProgressProps> = ({
  data,
  onCancel,
  onRetry,
  onDismiss,
  showDetails = true,
  compact = false,
}) => {
  const [timeElapsed, setTimeElapsed] = useState(0);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;

  // Fade in animation
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: ORACLE_TIMING.fadeIn,
      useNativeDriver: true,
    }).start();
  }, []);

  // Progress animation
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: data.progress,
      duration: 300,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    }).start();
  }, [data.progress]);

  // Pulse animation for active processing
  useEffect(() => {
    if (data.status !== 'completed' && data.status !== 'failed') {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [data.status]);

  // Spinner animation
  useEffect(() => {
    if (data.status !== 'completed' && data.status !== 'failed') {
      const spin = Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      spin.start();
      return () => spin.stop();
    }
  }, [data.status]);

  // Time elapsed counter
  useEffect(() => {
    if (data.status !== 'completed' && data.status !== 'failed' && data.startTime) {
      const interval = setInterval(() => {
        setTimeElapsed(Math.floor((Date.now() - data.startTime!) / 1000));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [data.status, data.startTime]);

  const spinInterpolate = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  const getStatusColor = () => {
    switch (data.status) {
      case 'completed':
        return ORACLE_COLORS.act;
      case 'failed':
        return '#FF4444';
      case 'queued':
        return '#666666';
      default:
        return ORACLE_COLORS.observe;
    }
  };

  const getStatusIcon = () => {
    switch (data.status) {
      case 'completed':
        return 'checkmark-circle';
      case 'failed':
        return 'alert-circle';
      case 'queued':
        return 'time-outline';
      default:
        return 'sync';
    }
  };

  const getStageLabel = () => {
    switch (data.stage) {
      case 'detecting_content_type':
        return 'Detecting content type...';
      case 'routing_to_processor':
        return 'Routing to processor...';
      case 'processing_image':
        return 'Analyzing image...';
      case 'processing_document':
        return 'Parsing document...';
      case 'processing_audio':
        return 'Transcribing audio...';
      case 'processing_video':
        return 'Processing video...';
      case 'processing_url':
        return 'Fetching content...';
      case 'extracting_entities':
        return 'Extracting entities...';
      case 'extracting_dates':
        return 'Finding dates...';
      case 'extracting_action_items':
        return 'Detecting action items...';
      case 'generating_signals':
        return 'Generating signals...';
      case 'completed':
        return 'Complete!';
      case 'error':
        return 'Error occurred';
      case 'from_cache':
        return 'Retrieved from cache';
      default:
        return data.stage || 'Processing...';
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) {
      return `${mins}m ${secs}s`;
    }
    return `${secs}s`;
  };

  if (compact) {
    return (
      <CompactProgress
        data={data}
        statusColor={getStatusColor()}
        progressWidth={progressWidth}
      />
    );
  }

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      {/* Header with status icon */}
      <View style={styles.header}>
        <Animated.View
          style={[
            styles.statusIconContainer,
            {
              backgroundColor: `${getStatusColor()}20`,
              transform: [
                { scale: data.status === 'completed' || data.status === 'failed' ? 1 : pulseAnim },
              ],
            },
          ]}
        >
          {data.status !== 'completed' && data.status !== 'failed' && data.status !== 'queued' ? (
            <Animated.View style={{ transform: [{ rotate: spinInterpolate }] }}>
              <Ionicons name="sync" size={28} color={getStatusColor()} />
            </Animated.View>
          ) : (
            <Ionicons name={getStatusIcon() as any} size={28} color={getStatusColor()} />
          )}
        </Animated.View>

        <View style={styles.headerInfo}>
          <Text style={styles.statusText}>{getStatusLabel(data.status)}</Text>
          <Text style={styles.stageText}>{getStageLabel()}</Text>
        </View>

        {data.status !== 'completed' && data.status !== 'failed' && onCancel && (
          <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
            <Ionicons name="close" size={20} color="#666666" />
          </TouchableOpacity>
        )}

        {data.status === 'completed' && onDismiss && (
          <TouchableOpacity style={styles.cancelButton} onPress={onDismiss}>
            <Ionicons name="close" size={20} color="#666666" />
          </TouchableOpacity>
        )}
      </View>

      {/* Progress bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <Animated.View
            style={[
              styles.progressFill,
              {
                width: progressWidth,
                backgroundColor: getStatusColor(),
              },
            ]}
          />
        </View>
        <Text style={[styles.progressText, { color: getStatusColor() }]}>
          {Math.round(data.progress)}%
        </Text>
      </View>

      {/* Details */}
      {showDetails && (
        <View style={styles.details}>
          {/* Time info */}
          {data.startTime && data.status !== 'completed' && data.status !== 'failed' && (
            <View style={styles.detailRow}>
              <Ionicons name="time-outline" size={14} color="#666666" />
              <Text style={styles.detailText}>
                Elapsed: {formatTime(timeElapsed)}
              </Text>
              {data.estimatedDuration && timeElapsed < data.estimatedDuration && (
                <Text style={styles.detailTextSecondary}>
                  ~{formatTime(data.estimatedDuration - timeElapsed)} remaining
                </Text>
              )}
            </View>
          )}

          {/* Completion time */}
          {data.status === 'completed' && data.startTime && (
            <View style={styles.detailRow}>
              <Ionicons name="checkmark-done-outline" size={14} color={ORACLE_COLORS.act} />
              <Text style={styles.detailText}>
                Completed in {formatTime(timeElapsed)}
              </Text>
            </View>
          )}

          {/* Processing ID */}
          <View style={styles.detailRow}>
            <Ionicons name="finger-print-outline" size={14} color="#666666" />
            <Text style={styles.detailTextSmall}>
              ID: {data.processingId.substring(0, 20)}...
            </Text>
          </View>

          {/* Custom message */}
          {data.message && (
            <View style={styles.detailRow}>
              <Ionicons name="information-circle-outline" size={14} color="#888888" />
              <Text style={styles.detailText}>{data.message}</Text>
            </View>
          )}

          {/* Error message */}
          {data.status === 'failed' && data.error && (
            <View style={styles.errorContainer}>
              <Ionicons name="warning-outline" size={16} color="#FF4444" />
              <Text style={styles.errorText}>{data.error}</Text>
            </View>
          )}
        </View>
      )}

      {/* Processing stages indicator */}
      {data.status !== 'completed' && data.status !== 'failed' && (
        <View style={styles.stagesContainer}>
          <ProcessingStage
            label="Extract"
            isActive={['processing', 'extracting'].includes(data.status)}
            isComplete={['analyzing', 'generating_signals', 'completed'].includes(data.status) || data.progress > 40}
          />
          <View style={styles.stageConnector} />
          <ProcessingStage
            label="Analyze"
            isActive={data.status === 'analyzing' || (data.progress > 40 && data.progress < 80)}
            isComplete={['generating_signals', 'completed'].includes(data.status) || data.progress > 80}
          />
          <View style={styles.stageConnector} />
          <ProcessingStage
            label="Generate"
            isActive={data.status === 'generating_signals' || data.progress >= 80}
            isComplete={data.status === 'completed'}
          />
        </View>
      )}

      {/* Action buttons */}
      {data.status === 'failed' && (
        <View style={styles.actions}>
          {onRetry && (
            <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
              <Ionicons name="refresh-outline" size={18} color="#FFFFFF" />
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          )}
          {onDismiss && (
            <TouchableOpacity style={styles.dismissButton} onPress={onDismiss}>
              <Text style={styles.dismissButtonText}>Dismiss</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </Animated.View>
  );
};

// ============================================================================
// Sub-components
// ============================================================================

/**
 * Processing stage indicator
 */
const ProcessingStage: React.FC<{
  label: string;
  isActive: boolean;
  isComplete: boolean;
}> = ({ label, isActive, isComplete }) => {
  const color = isComplete
    ? ORACLE_COLORS.act
    : isActive
    ? ORACLE_COLORS.observe
    : '#444444';

  return (
    <View style={styles.stage}>
      <View
        style={[
          styles.stageDot,
          {
            backgroundColor: color,
            borderColor: isActive ? ORACLE_COLORS.observe : 'transparent',
            borderWidth: isActive ? 2 : 0,
          },
        ]}
      >
        {isComplete && (
          <Ionicons name="checkmark" size={10} color="#000000" />
        )}
      </View>
      <Text style={[styles.stageLabel, { color }]}>{label}</Text>
    </View>
  );
};

/**
 * Compact progress display
 */
const CompactProgress: React.FC<{
  data: ProcessingProgressData;
  statusColor: string;
  progressWidth: Animated.AnimatedInterpolation<string>;
}> = ({ data, statusColor, progressWidth }) => {
  return (
    <View style={styles.compactContainer}>
      <View style={styles.compactHeader}>
        {data.status !== 'completed' && data.status !== 'failed' ? (
          <Animated.View style={styles.compactSpinner}>
            <Ionicons name="sync" size={16} color={statusColor} />
          </Animated.View>
        ) : (
          <Ionicons
            name={data.status === 'completed' ? 'checkmark-circle' : 'alert-circle'}
            size={16}
            color={statusColor}
          />
        )}
        <Text style={styles.compactText} numberOfLines={1}>
          {data.stage || 'Processing...'}
        </Text>
        <Text style={[styles.compactProgress, { color: statusColor }]}>
          {Math.round(data.progress)}%
        </Text>
      </View>
      <View style={styles.compactProgressBar}>
        <Animated.View
          style={[
            styles.compactProgressFill,
            { width: progressWidth, backgroundColor: statusColor },
          ]}
        />
      </View>
    </View>
  );
};

// ============================================================================
// Helpers
// ============================================================================

const getStatusLabel = (status: ProcessingStatus): string => {
  switch (status) {
    case 'queued':
      return 'Queued';
    case 'processing':
      return 'Processing';
    case 'extracting':
      return 'Extracting Content';
    case 'analyzing':
      return 'Analyzing';
    case 'generating_signals':
      return 'Generating Signals';
    case 'completed':
      return 'Completed';
    case 'failed':
      return 'Failed';
    default:
      return 'Processing';
  }
};

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  headerInfo: {
    flex: 1,
  },
  statusText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  stageText: {
    fontSize: 13,
    color: '#888888',
  },
  cancelButton: {
    padding: 8,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  progressBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#333333',
    borderRadius: 4,
    overflow: 'hidden',
    marginRight: 12,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    fontWeight: 'bold',
    width: 45,
    textAlign: 'right',
  },
  details: {
    gap: 8,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 12,
    color: '#AAAAAA',
  },
  detailTextSecondary: {
    fontSize: 12,
    color: '#666666',
    marginLeft: 'auto',
  },
  detailTextSmall: {
    fontSize: 11,
    color: '#666666',
    fontFamily: 'monospace',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255, 68, 68, 0.1)',
    padding: 10,
    borderRadius: 8,
    gap: 8,
    marginTop: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    color: '#FF4444',
    lineHeight: 18,
  },
  stagesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  stage: {
    alignItems: 'center',
  },
  stageDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  stageLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  stageConnector: {
    width: 40,
    height: 2,
    backgroundColor: '#333333',
    marginHorizontal: 8,
    marginBottom: 16,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ORACLE_COLORS.observe,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    gap: 6,
    flex: 1,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  dismissButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#444444',
  },
  dismissButtonText: {
    fontSize: 14,
    color: '#888888',
  },
  compactContainer: {
    backgroundColor: '#222222',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  compactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  compactSpinner: {},
  compactText: {
    flex: 1,
    fontSize: 12,
    color: '#CCCCCC',
  },
  compactProgress: {
    fontSize: 12,
    fontWeight: '600',
  },
  compactProgressBar: {
    height: 4,
    backgroundColor: '#333333',
    borderRadius: 2,
    overflow: 'hidden',
  },
  compactProgressFill: {
    height: '100%',
    borderRadius: 2,
  },
});

export default ProcessingProgress;
