/**
 * ORACLE Insights Dashboard
 * Main insights view with cards, trending metrics, alerts, and recommendations
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Dimensions,
  RefreshControl,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';

// Types
interface Insight {
  id: string;
  type: 'pattern' | 'anomaly' | 'opportunity' | 'risk' | 'trend' | 'comparison' | 'recommendation';
  category: string;
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'critical' | 'success';
  confidence: number;
  actionable: boolean;
  actions?: InsightAction[];
  data: Record<string, any>;
  createdAt: Date;
  dismissed: boolean;
}

interface InsightAction {
  id: string;
  label: string;
  type: 'navigate' | 'quick_action' | 'dismiss' | 'remind_later';
  payload?: Record<string, any>;
}

interface TrendingMetric {
  id: string;
  name: string;
  value: number;
  previousValue: number;
  change: number;
  direction: 'up' | 'down' | 'stable';
  isPositive: boolean;
  unit?: string;
}

interface InsightsDashboardProps {
  insights: Insight[];
  trendingMetrics: TrendingMetric[];
  loading?: boolean;
  onRefresh?: () => Promise<void>;
  onInsightAction?: (insightId: string, actionId: string) => void;
  onInsightDismiss?: (insightId: string) => void;
  onMetricPress?: (metricId: string) => void;
  onViewAllInsights?: () => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 48;

// Insight Card Component
const InsightCard: React.FC<{
  insight: Insight;
  onAction?: (actionId: string) => void;
  onDismiss?: () => void;
  style?: any;
}> = ({ insight, onAction, onDismiss, style }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const dismissAnim = useRef(new Animated.Value(0)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.98,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  const handleDismiss = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.timing(dismissAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      onDismiss?.();
    });
  };

  const getSeverityColors = () => {
    switch (insight.severity) {
      case 'critical':
        return { bg: ['#FEE2E2', '#FECACA'] as const, accent: '#DC2626', icon: '!' };
      case 'warning':
        return { bg: ['#FEF3C7', '#FDE68A'] as const, accent: '#D97706', icon: '!' };
      case 'success':
        return { bg: ['#DCFCE7', '#BBF7D0'] as const, accent: '#16A34A', icon: '+' };
      default:
        return { bg: ['#DBEAFE', '#BFDBFE'] as const, accent: '#2563EB', icon: 'i' };
    }
  };

  const getTypeIcon = () => {
    switch (insight.type) {
      case 'pattern': return 'P';
      case 'anomaly': return 'A';
      case 'opportunity': return 'O';
      case 'risk': return 'R';
      case 'trend': return 'T';
      case 'comparison': return 'C';
      case 'recommendation': return 'R';
      default: return 'I';
    }
  };

  const colors = getSeverityColors();

  return (
    <Animated.View
      style={[
        styles.insightCard,
        style,
        {
          transform: [
            { scale: scaleAnim },
            { translateX: dismissAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, SCREEN_WIDTH],
            })},
          ],
          opacity: dismissAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [1, 0],
          }),
        },
      ]}
    >
      <LinearGradient
        colors={colors.bg}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.insightCardGradient}
      >
        <View style={styles.insightHeader}>
          <View style={[styles.insightTypeIcon, { backgroundColor: colors.accent }]}>
            <Text style={styles.insightTypeIconText}>{getTypeIcon()}</Text>
          </View>
          <View style={styles.insightHeaderText}>
            <Text style={styles.insightCategory}>{insight.category.toUpperCase()}</Text>
            <Text style={styles.insightTitle}>{insight.title}</Text>
          </View>
          <TouchableOpacity
            onPress={handleDismiss}
            style={styles.dismissButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.dismissButtonText}>X</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.insightDescription}>{insight.description}</Text>

        <View style={styles.insightMeta}>
          <View style={styles.confidenceBadge}>
            <Text style={styles.confidenceText}>
              {Math.round(insight.confidence * 100)}% confidence
            </Text>
          </View>
        </View>

        {insight.actionable && insight.actions && insight.actions.length > 0 && (
          <View style={styles.insightActions}>
            {insight.actions.slice(0, 2).map((action) => (
              <TouchableOpacity
                key={action.id}
                style={[
                  styles.actionButton,
                  action.type === 'quick_action' && { backgroundColor: colors.accent },
                ]}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  onAction?.(action.id);
                }}
              >
                <Text
                  style={[
                    styles.actionButtonText,
                    action.type === 'quick_action' && { color: '#FFFFFF' },
                  ]}
                >
                  {action.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </LinearGradient>
    </Animated.View>
  );
};

// Trending Metric Card
const TrendingMetricCard: React.FC<{
  metric: TrendingMetric;
  onPress?: () => void;
}> = ({ metric, onPress }) => {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, []);

  const getChangeColor = () => {
    if (metric.direction === 'stable') return '#6B7280';
    return metric.isPositive ? '#16A34A' : '#DC2626';
  };

  const getArrow = () => {
    if (metric.direction === 'up') return '+';
    if (metric.direction === 'down') return '-';
    return '=';
  };

  return (
    <TouchableOpacity
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.();
      }}
      activeOpacity={0.8}
    >
      <Animated.View
        style={[
          styles.metricCard,
          {
            opacity: animatedValue,
            transform: [{
              translateY: animatedValue.interpolate({
                inputRange: [0, 1],
                outputRange: [20, 0],
              }),
            }],
          },
        ]}
      >
        <Text style={styles.metricName}>{metric.name}</Text>
        <Text style={styles.metricValue}>
          {metric.value}{metric.unit}
        </Text>
        <View style={styles.metricChange}>
          <Text style={[styles.metricChangeText, { color: getChangeColor() }]}>
            {getArrow()} {Math.abs(metric.change).toFixed(1)}%
          </Text>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
};

// Anomaly Alert Banner
const AnomalyAlert: React.FC<{
  anomaly: Insight;
  onPress?: () => void;
}> = ({ anomaly, onPress }) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (anomaly.severity === 'critical') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [anomaly.severity]);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9}>
      <Animated.View
        style={[
          styles.anomalyAlert,
          anomaly.severity === 'critical' && styles.anomalyAlertCritical,
          { transform: [{ scale: pulseAnim }] },
        ]}
      >
        <View style={styles.anomalyIcon}>
          <Text style={styles.anomalyIconText}>!</Text>
        </View>
        <View style={styles.anomalyContent}>
          <Text style={styles.anomalyTitle}>{anomaly.title}</Text>
          <Text style={styles.anomalyDescription} numberOfLines={1}>
            {anomaly.description}
          </Text>
        </View>
        <Text style={styles.anomalyArrow}>&gt;</Text>
      </Animated.View>
    </TouchableOpacity>
  );
};

// Recommendation Carousel Item
const RecommendationItem: React.FC<{
  recommendation: Insight;
  onAction?: (actionId: string) => void;
  width: number;
}> = ({ recommendation, onAction, width }) => {
  return (
    <View style={[styles.recommendationCard, { width }]}>
      <LinearGradient
        colors={['#4F46E5', '#7C3AED']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.recommendationGradient}
      >
        <View style={styles.recommendationIcon}>
          <Text style={styles.recommendationIconText}>Suggestion</Text>
        </View>
        <Text style={styles.recommendationTitle}>{recommendation.title}</Text>
        <Text style={styles.recommendationDescription} numberOfLines={2}>
          {recommendation.description}
        </Text>
        {recommendation.actions && recommendation.actions.length > 0 && (
          <TouchableOpacity
            style={styles.recommendationButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onAction?.(recommendation.actions![0].id);
            }}
          >
            <Text style={styles.recommendationButtonText}>
              {recommendation.actions[0].label}
            </Text>
          </TouchableOpacity>
        )}
      </LinearGradient>
    </View>
  );
};

// Main Component
export const InsightsDashboard: React.FC<InsightsDashboardProps> = ({
  insights,
  trendingMetrics,
  loading = false,
  onRefresh,
  onInsightAction,
  onInsightDismiss,
  onMetricPress,
  onViewAllInsights,
}) => {
  const [refreshing, setRefreshing] = useState(false);
  const carouselRef = useRef<FlatList>(null);
  const [activeRecommendationIndex, setActiveRecommendationIndex] = useState(0);

  // Filter insights by type
  const anomalies = insights.filter(i => i.type === 'anomaly' && !i.dismissed);
  const recommendations = insights.filter(i => i.type === 'recommendation' && !i.dismissed);
  const otherInsights = insights.filter(
    i => !['anomaly', 'recommendation'].includes(i.type) && !i.dismissed
  );
  const highPriorityInsights = otherInsights.filter(
    i => i.severity === 'critical' || i.severity === 'warning'
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await onRefresh?.();
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh]);

  const handleRecommendationScroll = (event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / (CARD_WIDTH + 16));
    setActiveRecommendationIndex(index);
  };

  if (loading && insights.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4F46E5" />
        <Text style={styles.loadingText}>Analyzing your data...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor="#4F46E5"
        />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Insights</Text>
        <TouchableOpacity onPress={onViewAllInsights}>
          <Text style={styles.viewAllText}>View All</Text>
        </TouchableOpacity>
      </View>

      {/* Anomaly Alerts */}
      {anomalies.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Alerts</Text>
          {anomalies.slice(0, 3).map((anomaly) => (
            <AnomalyAlert
              key={anomaly.id}
              anomaly={anomaly}
              onPress={() => onInsightAction?.(anomaly.id, 'view')}
            />
          ))}
        </View>
      )}

      {/* Trending Metrics */}
      {trendingMetrics.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Trending</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.metricsContainer}
          >
            {trendingMetrics.map((metric) => (
              <TrendingMetricCard
                key={metric.id}
                metric={metric}
                onPress={() => onMetricPress?.(metric.id)}
              />
            ))}
          </ScrollView>
        </View>
      )}

      {/* Recommendations Carousel */}
      {recommendations.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recommendations</Text>
          <FlatList
            ref={carouselRef}
            data={recommendations}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            snapToInterval={CARD_WIDTH + 16}
            decelerationRate="fast"
            contentContainerStyle={styles.carouselContainer}
            onScroll={handleRecommendationScroll}
            scrollEventThrottle={16}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <RecommendationItem
                recommendation={item}
                onAction={(actionId) => onInsightAction?.(item.id, actionId)}
                width={CARD_WIDTH}
              />
            )}
          />
          {/* Carousel Indicators */}
          <View style={styles.carouselIndicators}>
            {recommendations.slice(0, 5).map((_, index) => (
              <View
                key={index}
                style={[
                  styles.carouselIndicator,
                  index === activeRecommendationIndex && styles.carouselIndicatorActive,
                ]}
              />
            ))}
          </View>
        </View>
      )}

      {/* High Priority Insights */}
      {highPriorityInsights.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Important</Text>
          {highPriorityInsights.slice(0, 5).map((insight) => (
            <InsightCard
              key={insight.id}
              insight={insight}
              onAction={(actionId) => onInsightAction?.(insight.id, actionId)}
              onDismiss={() => onInsightDismiss?.(insight.id)}
            />
          ))}
        </View>
      )}

      {/* Other Insights */}
      {otherInsights.filter(i => !highPriorityInsights.includes(i)).length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>More Insights</Text>
          {otherInsights
            .filter(i => !highPriorityInsights.includes(i))
            .slice(0, 5)
            .map((insight) => (
              <InsightCard
                key={insight.id}
                insight={insight}
                onAction={(actionId) => onInsightAction?.(insight.id, actionId)}
                onDismiss={() => onInsightDismiss?.(insight.id)}
              />
            ))}
        </View>
      )}

      {/* Empty State */}
      {insights.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateIcon}>Insights</Text>
          <Text style={styles.emptyStateTitle}>No insights yet</Text>
          <Text style={styles.emptyStateDescription}>
            Keep using the app and we&apos;ll identify patterns and opportunities for you.
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
    paddingTop: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1F2937',
  },
  viewAllText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4F46E5',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    paddingHorizontal: 24,
    marginBottom: 12,
  },

  // Insight Card
  insightCard: {
    marginHorizontal: 24,
    marginBottom: 12,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  insightCardGradient: {
    padding: 16,
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  insightTypeIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  insightTypeIconText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  insightHeaderText: {
    flex: 1,
  },
  insightCategory: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  insightTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  dismissButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dismissButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  insightDescription: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
    marginBottom: 12,
  },
  insightMeta: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  confidenceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  confidenceText: {
    fontSize: 12,
    color: '#6B7280',
  },
  insightActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.8)',
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },

  // Trending Metrics
  metricsContainer: {
    paddingHorizontal: 24,
    gap: 12,
  },
  metricCard: {
    width: 140,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  metricName: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  metricChange: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metricChangeText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Anomaly Alert
  anomalyAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 24,
    marginBottom: 8,
    padding: 14,
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  anomalyAlertCritical: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FECACA',
  },
  anomalyIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#D97706',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  anomalyIconText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  anomalyContent: {
    flex: 1,
  },
  anomalyTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  anomalyDescription: {
    fontSize: 13,
    color: '#6B7280',
  },
  anomalyArrow: {
    fontSize: 18,
    color: '#9CA3AF',
    marginLeft: 8,
  },

  // Recommendations Carousel
  carouselContainer: {
    paddingHorizontal: 24,
  },
  recommendationCard: {
    marginRight: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  recommendationGradient: {
    padding: 20,
    minHeight: 160,
  },
  recommendationIcon: {
    marginBottom: 12,
  },
  recommendationIconText: {
    fontSize: 24,
    color: '#FFFFFF',
  },
  recommendationTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  recommendationDescription: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 20,
    marginBottom: 16,
  },
  recommendationButton: {
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  recommendationButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  carouselIndicators: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 12,
    gap: 8,
  },
  carouselIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D1D5DB',
  },
  carouselIndicatorActive: {
    backgroundColor: '#4F46E5',
    width: 24,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
  },
  emptyStateIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  emptyStateDescription: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  bottomSpacer: {
    height: 32,
  },
});

export default InsightsDashboard;
