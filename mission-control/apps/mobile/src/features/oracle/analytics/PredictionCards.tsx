/**
 * ORACLE Prediction Cards
 * Display predictions with gauges, probability indicators, and confidence intervals
 */

import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Animated,
  Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Svg, {
  Circle,
  Path,
  G,
  Text as SvgText,
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
} from 'react-native-svg';

// Types
interface Prediction {
  id: string;
  type: 'task_completion' | 'workload_forecast' | 'deadline_risk' | 'burnout_risk' | 'goal_success';
  title: string;
  subtitle?: string;
  probability: number;
  confidence: number;
  description: string;
  factors?: PredictionFactor[];
  timeline?: TimelineMilestone[];
  recommendations?: string[];
  severity?: 'low' | 'medium' | 'high' | 'critical';
}

interface PredictionFactor {
  name: string;
  impact: 'positive' | 'negative' | 'neutral';
  weight: number;
  description: string;
}

interface TimelineMilestone {
  date: Date;
  label: string;
  probability: number;
  status: 'on_track' | 'at_risk' | 'delayed' | 'completed';
}

interface PredictionCardsProps {
  predictions: Prediction[];
  loading?: boolean;
  onPredictionPress?: (predictionId: string) => void;
  onFactorPress?: (predictionId: string, factorName: string) => void;
  onViewDetails?: (predictionId: string) => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Animated Gauge Component
const RiskGauge: React.FC<{
  value: number;
  label: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  size?: number;
}> = ({ value, label, severity = 'medium', size = 120 }) => {
  const animatedValue = useRef(new Animated.Value(0)).current;
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: value,
      duration: 1200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();

    // Animate display value
    const steps = 30;
    const stepValue = value / steps;
    let current = 0;
    const interval = setInterval(() => {
      current += stepValue;
      if (current >= value) {
        setDisplayValue(Math.round(value));
        clearInterval(interval);
      } else {
        setDisplayValue(Math.round(current));
      }
    }, 40);

    return () => clearInterval(interval);
  }, [value]);

  const getColor = () => {
    switch (severity) {
      case 'critical': return '#DC2626';
      case 'high': return '#F59E0B';
      case 'medium': return '#3B82F6';
      case 'low': return '#22C55E';
      default: return '#3B82F6';
    }
  };

  const color = getColor();
  const centerX = size / 2;
  const centerY = size / 2;
  const radius = (size - 20) / 2;
  const strokeWidth = 12;

  // Arc calculations
  const startAngle = 135;
  const endAngle = 405;
  const angleRange = endAngle - startAngle;

  const createArcPath = (startDeg: number, endDeg: number, r: number) => {
    const start = {
      x: centerX + r * Math.cos((startDeg * Math.PI) / 180),
      y: centerY + r * Math.sin((startDeg * Math.PI) / 180),
    };
    const end = {
      x: centerX + r * Math.cos((endDeg * Math.PI) / 180),
      y: centerY + r * Math.sin((endDeg * Math.PI) / 180),
    };
    const largeArcFlag = endDeg - startDeg > 180 ? 1 : 0;

    return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;
  };

  const backgroundPath = createArcPath(startAngle, endAngle, radius);
  const progressAngle = startAngle + (value / 100) * angleRange;
  const progressPath = createArcPath(startAngle, progressAngle, radius);

  return (
    <View style={styles.gaugeContainer}>
      <Svg width={size} height={size}>
        <Defs>
          <SvgLinearGradient id="gaugeGradient" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0%" stopColor="#22C55E" />
            <Stop offset="50%" stopColor="#F59E0B" />
            <Stop offset="100%" stopColor="#DC2626" />
          </SvgLinearGradient>
        </Defs>

        {/* Background arc */}
        <Path
          d={backgroundPath}
          stroke="#E5E7EB"
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
        />

        {/* Progress arc */}
        <Path
          d={progressPath}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
        />

        {/* Center text */}
        <SvgText
          x={centerX}
          y={centerY}
          fontSize="28"
          fontWeight="700"
          fill="#1F2937"
          textAnchor="middle"
          alignmentBaseline="middle"
        >
          {displayValue}%
        </SvgText>
      </Svg>
      <Text style={styles.gaugeLabel}>{label}</Text>
    </View>
  );
};

// Probability Indicator
const ProbabilityIndicator: React.FC<{
  probability: number;
  confidence: number;
  label: string;
}> = ({ probability, confidence, label }) => {
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(progressAnim, {
      toValue: probability,
      useNativeDriver: false,
      tension: 30,
      friction: 8,
    }).start();
  }, [probability]);

  const getColor = () => {
    if (probability >= 0.7) return '#22C55E';
    if (probability >= 0.4) return '#F59E0B';
    return '#DC2626';
  };

  return (
    <View style={styles.probabilityContainer}>
      <View style={styles.probabilityHeader}>
        <Text style={styles.probabilityLabel}>{label}</Text>
        <View style={styles.confidenceBadge}>
          <Text style={styles.confidenceText}>
            {Math.round(confidence * 100)}% confident
          </Text>
        </View>
      </View>
      <View style={styles.probabilityBarContainer}>
        <Animated.View
          style={[
            styles.probabilityBar,
            {
              width: progressAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
              backgroundColor: getColor(),
            },
          ]}
        />
        {/* Confidence interval marks */}
        <View
          style={[
            styles.confidenceIntervalStart,
            { left: `${Math.max(0, (probability - (1 - confidence) / 2) * 100)}%` },
          ]}
        />
        <View
          style={[
            styles.confidenceIntervalEnd,
            { left: `${Math.min(100, (probability + (1 - confidence) / 2) * 100)}%` },
          ]}
        />
      </View>
      <View style={styles.probabilityValues}>
        <Text style={styles.probabilityValue}>
          {Math.round(probability * 100)}% likely
        </Text>
      </View>
    </View>
  );
};

// Forecast Timeline
const ForecastTimeline: React.FC<{
  milestones: TimelineMilestone[];
}> = ({ milestones }) => {
  const getStatusColor = (status: TimelineMilestone['status']) => {
    switch (status) {
      case 'completed': return '#22C55E';
      case 'on_track': return '#3B82F6';
      case 'at_risk': return '#F59E0B';
      case 'delayed': return '#DC2626';
      default: return '#6B7280';
    }
  };

  return (
    <View style={styles.timelineContainer}>
      {milestones.map((milestone, index) => (
        <View key={index} style={styles.timelineItem}>
          {/* Connector line */}
          {index < milestones.length - 1 && (
            <View
              style={[
                styles.timelineConnector,
                { backgroundColor: getStatusColor(milestones[index + 1].status) },
              ]}
            />
          )}

          {/* Milestone dot */}
          <View
            style={[
              styles.timelineDot,
              { backgroundColor: getStatusColor(milestone.status) },
            ]}
          >
            {milestone.status === 'completed' && (
              <Text style={styles.timelineDotCheck}>check</Text>
            )}
          </View>

          {/* Milestone content */}
          <View style={styles.timelineContent}>
            <Text style={styles.timelineDate}>
              {new Date(milestone.date).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              })}
            </Text>
            <Text style={styles.timelineLabel}>{milestone.label}</Text>
            <View
              style={[
                styles.timelineStatus,
                { backgroundColor: getStatusColor(milestone.status) + '20' },
              ]}
            >
              <Text
                style={[
                  styles.timelineStatusText,
                  { color: getStatusColor(milestone.status) },
                ]}
              >
                {milestone.status.replace('_', ' ')}
              </Text>
            </View>
          </View>
        </View>
      ))}
    </View>
  );
};

// Single Prediction Card
const PredictionCard: React.FC<{
  prediction: Prediction;
  onPress?: () => void;
  onViewDetails?: () => void;
}> = ({ prediction, onPress, onViewDetails }) => {
  const [expanded, setExpanded] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const expandAnim = useRef(new Animated.Value(0)).current;

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpanded(!expanded);
    Animated.spring(expandAnim, {
      toValue: expanded ? 0 : 1,
      useNativeDriver: false,
      tension: 50,
      friction: 8,
    }).start();
  };

  const getTypeIcon = () => {
    switch (prediction.type) {
      case 'task_completion': return 'Task';
      case 'workload_forecast': return 'Forecast';
      case 'deadline_risk': return 'Deadline';
      case 'burnout_risk': return 'Risk';
      case 'goal_success': return 'Goal';
      default: return 'Prediction';
    }
  };

  const getGradientColors = (): [string, string] => {
    switch (prediction.severity) {
      case 'critical': return ['#FEE2E2', '#FECACA'];
      case 'high': return ['#FEF3C7', '#FDE68A'];
      case 'medium': return ['#DBEAFE', '#BFDBFE'];
      case 'low': return ['#DCFCE7', '#BBF7D0'];
      default: return ['#F3F4F6', '#E5E7EB'];
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={handlePress}
      onLongPress={onViewDetails}
    >
      <Animated.View
        style={[
          styles.predictionCard,
          { transform: [{ scale: scaleAnim }] },
        ]}
      >
        <LinearGradient
          colors={getGradientColors()}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.predictionGradient}
        >
          {/* Header */}
          <View style={styles.predictionHeader}>
            <View style={styles.predictionType}>
              <Text style={styles.predictionTypeText}>{getTypeIcon()}</Text>
            </View>
            <View style={styles.predictionTitleContainer}>
              <Text style={styles.predictionTitle}>{prediction.title}</Text>
              {prediction.subtitle && (
                <Text style={styles.predictionSubtitle}>{prediction.subtitle}</Text>
              )}
            </View>
          </View>

          {/* Main content based on type */}
          {prediction.type === 'burnout_risk' || prediction.type === 'deadline_risk' ? (
            <View style={styles.gaugeWrapper}>
              <RiskGauge
                value={prediction.probability * 100}
                label={prediction.type === 'burnout_risk' ? 'Risk Level' : 'Risk Score'}
                severity={prediction.severity}
              />
            </View>
          ) : (
            <ProbabilityIndicator
              probability={prediction.probability}
              confidence={prediction.confidence}
              label={prediction.description}
            />
          )}

          {/* Expandable content */}
          <Animated.View
            style={[
              styles.expandableContent,
              {
                maxHeight: expandAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 400],
                }),
                opacity: expandAnim,
              },
            ]}
          >
            {/* Factors */}
            {prediction.factors && prediction.factors.length > 0 && (
              <View style={styles.factorsSection}>
                <Text style={styles.factorsSectionTitle}>Contributing Factors</Text>
                {prediction.factors.map((factor, index) => (
                  <View key={index} style={styles.factorItem}>
                    <View
                      style={[
                        styles.factorImpact,
                        {
                          backgroundColor:
                            factor.impact === 'positive' ? '#22C55E' :
                            factor.impact === 'negative' ? '#DC2626' : '#6B7280',
                        },
                      ]}
                    />
                    <View style={styles.factorContent}>
                      <Text style={styles.factorName}>{factor.name}</Text>
                      <Text style={styles.factorDescription}>{factor.description}</Text>
                    </View>
                    <Text style={styles.factorWeight}>
                      {Math.round(factor.weight * 100)}%
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Timeline */}
            {prediction.timeline && prediction.timeline.length > 0 && (
              <View style={styles.timelineSection}>
                <Text style={styles.timelineSectionTitle}>Timeline</Text>
                <ForecastTimeline milestones={prediction.timeline} />
              </View>
            )}

            {/* Recommendations */}
            {prediction.recommendations && prediction.recommendations.length > 0 && (
              <View style={styles.recommendationsSection}>
                <Text style={styles.recommendationsSectionTitle}>Recommendations</Text>
                {prediction.recommendations.map((rec, index) => (
                  <View key={index} style={styles.recommendationItem}>
                    <Text style={styles.recommendationBullet}> * </Text>
                    <Text style={styles.recommendationText}>{rec}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* View Details Button */}
            <TouchableOpacity
              style={styles.viewDetailsButton}
              onPress={onViewDetails}
            >
              <Text style={styles.viewDetailsButtonText}>View Full Details</Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Expand indicator */}
          <View style={styles.expandIndicator}>
            <Text style={styles.expandIndicatorText}>
              {expanded ? 'Show less' : 'Tap for details'}
            </Text>
          </View>
        </LinearGradient>
      </Animated.View>
    </TouchableOpacity>
  );
};

// Main Component
export const PredictionCards: React.FC<PredictionCardsProps> = ({
  predictions,
  loading = false,
  onPredictionPress,
  onFactorPress,
  onViewDetails,
}) => {
  // Group predictions by type
  const riskPredictions = predictions.filter(p =>
    p.type === 'burnout_risk' || p.type === 'deadline_risk'
  );
  const otherPredictions = predictions.filter(p =>
    p.type !== 'burnout_risk' && p.type !== 'deadline_risk'
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* Risk Predictions */}
      {riskPredictions.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Risk Assessment</Text>
          {riskPredictions.map((prediction) => (
            <PredictionCard
              key={prediction.id}
              prediction={prediction}
              onPress={() => onPredictionPress?.(prediction.id)}
              onViewDetails={() => onViewDetails?.(prediction.id)}
            />
          ))}
        </View>
      )}

      {/* Other Predictions */}
      {otherPredictions.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Forecasts</Text>
          {otherPredictions.map((prediction) => (
            <PredictionCard
              key={prediction.id}
              prediction={prediction}
              onPress={() => onPredictionPress?.(prediction.id)}
              onViewDetails={() => onViewDetails?.(prediction.id)}
            />
          ))}
        </View>
      )}

      {/* Empty State */}
      {predictions.length === 0 && !loading && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateIcon}>Analytics</Text>
          <Text style={styles.emptyStateTitle}>No predictions available</Text>
          <Text style={styles.emptyStateDescription}>
            Complete more tasks and activities to enable predictions.
          </Text>
        </View>
      )}

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  contentContainer: {
    padding: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },

  // Prediction Card
  predictionCard: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  predictionGradient: {
    padding: 20,
  },
  predictionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  predictionType: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  predictionTypeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#4B5563',
    textAlign: 'center',
  },
  predictionTitleContainer: {
    flex: 1,
  },
  predictionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  predictionSubtitle: {
    fontSize: 13,
    color: '#6B7280',
  },

  // Gauge
  gaugeContainer: {
    alignItems: 'center',
    marginVertical: 8,
  },
  gaugeLabel: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '500',
    color: '#4B5563',
  },
  gaugeWrapper: {
    alignItems: 'center',
  },

  // Probability
  probabilityContainer: {
    marginVertical: 8,
  },
  probabilityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  probabilityLabel: {
    fontSize: 14,
    color: '#4B5563',
    flex: 1,
  },
  confidenceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 6,
  },
  confidenceText: {
    fontSize: 11,
    color: '#6B7280',
  },
  probabilityBarContainer: {
    height: 8,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 4,
    overflow: 'hidden',
    position: 'relative',
  },
  probabilityBar: {
    height: '100%',
    borderRadius: 4,
  },
  confidenceIntervalStart: {
    position: 'absolute',
    top: -2,
    width: 2,
    height: 12,
    backgroundColor: '#6B7280',
    borderRadius: 1,
  },
  confidenceIntervalEnd: {
    position: 'absolute',
    top: -2,
    width: 2,
    height: 12,
    backgroundColor: '#6B7280',
    borderRadius: 1,
  },
  probabilityValues: {
    marginTop: 8,
  },
  probabilityValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },

  // Expandable content
  expandableContent: {
    overflow: 'hidden',
    marginTop: 16,
  },
  factorsSection: {
    marginBottom: 16,
  },
  factorsSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  factorItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  factorImpact: {
    width: 4,
    height: 36,
    borderRadius: 2,
    marginRight: 12,
  },
  factorContent: {
    flex: 1,
  },
  factorName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  factorDescription: {
    fontSize: 12,
    color: '#6B7280',
  },
  factorWeight: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginLeft: 8,
  },

  // Timeline
  timelineSection: {
    marginBottom: 16,
  },
  timelineSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  timelineContainer: {
    paddingLeft: 8,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 16,
    position: 'relative',
  },
  timelineConnector: {
    position: 'absolute',
    left: 7,
    top: 20,
    width: 2,
    height: 40,
  },
  timelineDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timelineDotCheck: {
    fontSize: 10,
    color: '#FFFFFF',
  },
  timelineContent: {
    flex: 1,
  },
  timelineDate: {
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 2,
  },
  timelineLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
    marginBottom: 4,
  },
  timelineStatus: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  timelineStatusText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },

  // Recommendations
  recommendationsSection: {
    marginBottom: 16,
  },
  recommendationsSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  recommendationItem: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  recommendationBullet: {
    fontSize: 14,
    color: '#4F46E5',
    marginRight: 8,
  },
  recommendationText: {
    flex: 1,
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 18,
  },
  viewDetailsButton: {
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 8,
    marginTop: 8,
  },
  viewDetailsButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4F46E5',
  },

  // Expand indicator
  expandIndicator: {
    alignItems: 'center',
    marginTop: 12,
  },
  expandIndicatorText: {
    fontSize: 12,
    color: '#9CA3AF',
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  emptyStateDescription: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  bottomSpacer: {
    height: 32,
  },
});

export default PredictionCards;
