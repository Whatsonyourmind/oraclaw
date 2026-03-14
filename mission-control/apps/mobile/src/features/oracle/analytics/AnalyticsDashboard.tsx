/**
 * AnalyticsDashboard Component
 * Story adv-5 - Analytics dashboard with charts and metrics
 */
import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Animated,
  Dimensions,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AnalyticsDashboardData } from '@mission-control/shared-types';
import { ORACLE_COLORS } from '../../../store/oracle';
import { oracleStyles } from '../theme';

const { width } = Dimensions.get('window');

// Date range options
type DateRange = '7d' | '30d' | '90d' | 'all';

const DATE_RANGE_OPTIONS: Array<{ key: DateRange; label: string }> = [
  { key: '7d', label: '7 Days' },
  { key: '30d', label: '30 Days' },
  { key: '90d', label: '90 Days' },
  { key: 'all', label: 'All Time' },
];

// Mock data for demo
const MOCK_DASHBOARD: AnalyticsDashboardData = {
  total_predictions: 127,
  accuracy_rate: 0.73,
  total_decisions_completed: 45,
  active_sessions_today: 3,
  prediction_accuracy_trend: [
    { date: '2026-01-24', accuracy: 0.68, count: 12 },
    { date: '2026-01-25', accuracy: 0.72, count: 15 },
    { date: '2026-01-26', accuracy: 0.71, count: 18 },
    { date: '2026-01-27', accuracy: 0.75, count: 22 },
    { date: '2026-01-28', accuracy: 0.74, count: 20 },
    { date: '2026-01-29', accuracy: 0.78, count: 25 },
    { date: '2026-01-30', accuracy: 0.73, count: 15 },
  ],
  feature_usage: {
    observe: 245,
    orient: 156,
    decide: 89,
    act: 134,
    probability: 78,
  },
  system_health: {
    status: 'healthy',
    avg_latency_ms: 145,
    error_rate: 0.02,
    uptime_percentage: 99.8,
  },
  top_signal_types: [
    { type: 'deadline', count: 45, percentage: 35.4 },
    { type: 'opportunity', count: 32, percentage: 25.2 },
    { type: 'risk', count: 28, percentage: 22.0 },
    { type: 'conflict', count: 15, percentage: 11.8 },
    { type: 'anomaly', count: 7, percentage: 5.5 },
  ],
  period_start: '2026-01-24T00:00:00.000Z',
  period_end: '2026-01-31T00:00:00.000Z',
};

interface SummaryCardProps {
  icon: string;
  label: string;
  value: string | number;
  subtext?: string;
  color: string;
}

const SummaryCard: React.FC<SummaryCardProps> = ({ icon, label, value, subtext, color }) => {
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 6,
      tension: 40,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.View style={[styles.summaryCard, { transform: [{ scale: scaleAnim }] }]}>
      <View style={[styles.summaryIcon, { backgroundColor: `${color}20` }]}>
        <Ionicons name={icon as any} size={24} color={color} />
      </View>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
      {subtext && <Text style={styles.summarySubtext}>{subtext}</Text>}
    </Animated.View>
  );
};

interface MiniLineChartProps {
  data: Array<{ date: string; accuracy: number; count: number }>;
}

const MiniLineChart: React.FC<MiniLineChartProps> = ({ data }) => {
  if (data.length === 0) return null;

  const maxAccuracy = Math.max(...data.map((d) => d.accuracy), 1);
  const minAccuracy = Math.min(...data.map((d) => d.accuracy), 0);
  const range = maxAccuracy - minAccuracy || 0.1;
  const chartHeight = 120;
  const chartWidth = width - 80;
  const pointSpacing = chartWidth / (data.length - 1 || 1);

  return (
    <View style={styles.chartContainer}>
      <Text style={styles.chartTitle}>Prediction Accuracy Trend</Text>
      <View style={styles.lineChart}>
        {/* Grid lines */}
        <View style={styles.gridLines}>
          <View style={styles.gridLine} />
          <View style={styles.gridLine} />
          <View style={styles.gridLine} />
        </View>

        {/* Y-axis labels */}
        <View style={styles.yAxisLabels}>
          <Text style={styles.axisLabel}>{Math.round(maxAccuracy * 100)}%</Text>
          <Text style={styles.axisLabel}>{Math.round((maxAccuracy + minAccuracy) / 2 * 100)}%</Text>
          <Text style={styles.axisLabel}>{Math.round(minAccuracy * 100)}%</Text>
        </View>

        {/* Chart area */}
        <View style={styles.chartArea}>
          {/* Line path using Views (simplified) */}
          {data.map((point, index) => {
            const x = index * pointSpacing;
            const normalizedY = (point.accuracy - minAccuracy) / range;
            const y = chartHeight - normalizedY * chartHeight;

            return (
              <View key={index} style={styles.pointContainer}>
                {/* Line to next point */}
                {index < data.length - 1 && (
                  <View
                    style={[
                      styles.lineSegment,
                      {
                        left: x + 6,
                        top: y,
                        width: pointSpacing,
                        backgroundColor: ORACLE_COLORS.observe,
                      },
                    ]}
                  />
                )}
                {/* Point */}
                <View
                  style={[
                    styles.dataPoint,
                    {
                      left: x,
                      top: y - 6,
                      backgroundColor: ORACLE_COLORS.observe,
                    },
                  ]}
                />
              </View>
            );
          })}
        </View>

        {/* X-axis labels */}
        <View style={styles.xAxisLabels}>
          {data.filter((_, i) => i % 2 === 0 || i === data.length - 1).map((point, index) => (
            <Text key={index} style={styles.axisLabel}>
              {point.date.slice(5, 10)}
            </Text>
          ))}
        </View>
      </View>
    </View>
  );
};

interface BarChartProps {
  data: Record<string, number>;
  colors: Record<string, string>;
}

const FeatureUsageChart: React.FC<BarChartProps> = ({ data, colors }) => {
  const maxValue = Math.max(...Object.values(data), 1);
  const entries = Object.entries(data);

  return (
    <View style={styles.chartContainer}>
      <Text style={styles.chartTitle}>Feature Usage</Text>
      <View style={styles.barChart}>
        {entries.map(([key, value], index) => {
          const barWidthPercent = (value / maxValue) * 100;
          const color = colors[key] || '#888888';

          return (
            <View key={key} style={styles.barRow}>
              <Text style={styles.barLabel}>{key.toUpperCase()}</Text>
              <View style={styles.barTrack}>
                <Animated.View
                  style={[
                    styles.barFill,
                    {
                      width: `${barWidthPercent}%`,
                      backgroundColor: color,
                    },
                  ]}
                />
              </View>
              <Text style={styles.barValue}>{value}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

interface HealthIndicatorProps {
  status: 'healthy' | 'degraded' | 'critical';
  latency: number;
  errorRate: number;
  uptime: number;
}

const HealthIndicator: React.FC<HealthIndicatorProps> = ({ status, latency, errorRate, uptime }) => {
  const statusColor = {
    healthy: '#00FF88',
    degraded: '#FFD700',
    critical: '#FF6B6B',
  }[status];

  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (status !== 'healthy') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [status]);

  return (
    <View style={styles.healthContainer}>
      <Text style={styles.chartTitle}>System Health</Text>
      <View style={styles.healthContent}>
        {/* Status indicator */}
        <View style={styles.healthStatus}>
          <Animated.View
            style={[
              styles.statusDot,
              { backgroundColor: statusColor, transform: [{ scale: pulseAnim }] },
            ]}
          />
          <Text style={[styles.statusText, { color: statusColor }]}>
            {status.toUpperCase()}
          </Text>
        </View>

        {/* Health metrics */}
        <View style={styles.healthMetrics}>
          <View style={styles.healthMetric}>
            <Ionicons name="speedometer-outline" size={16} color="#888888" />
            <Text style={styles.healthMetricValue}>{latency}ms</Text>
            <Text style={styles.healthMetricLabel}>Avg Latency</Text>
          </View>
          <View style={styles.healthMetric}>
            <Ionicons name="warning-outline" size={16} color="#888888" />
            <Text style={styles.healthMetricValue}>{(errorRate * 100).toFixed(1)}%</Text>
            <Text style={styles.healthMetricLabel}>Error Rate</Text>
          </View>
          <View style={styles.healthMetric}>
            <Ionicons name="checkmark-circle-outline" size={16} color="#888888" />
            <Text style={styles.healthMetricValue}>{uptime.toFixed(1)}%</Text>
            <Text style={styles.healthMetricLabel}>Uptime</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

interface SignalTypeBreakdownProps {
  data: Array<{ type: string; count: number; percentage: number }>;
}

const SignalTypeBreakdown: React.FC<SignalTypeBreakdownProps> = ({ data }) => {
  const signalColors: Record<string, string> = {
    deadline: '#FF6B6B',
    opportunity: '#00FF88',
    risk: '#FFD700',
    conflict: '#FF8C00',
    anomaly: '#00BFFF',
    pattern: '#9B59B6',
    dependency: '#E91E63',
    resource: '#00CED1',
  };

  return (
    <View style={styles.breakdownContainer}>
      <Text style={styles.chartTitle}>Top Signal Types</Text>
      <View style={styles.breakdownContent}>
        {data.map((item, index) => (
          <View key={item.type} style={styles.breakdownRow}>
            <View style={[styles.breakdownDot, { backgroundColor: signalColors[item.type] || '#888888' }]} />
            <Text style={styles.breakdownLabel}>{item.type}</Text>
            <View style={styles.breakdownBar}>
              <View
                style={[
                  styles.breakdownBarFill,
                  {
                    width: `${item.percentage}%`,
                    backgroundColor: signalColors[item.type] || '#888888',
                  },
                ]}
              />
            </View>
            <Text style={styles.breakdownValue}>{item.count}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

export const AnalyticsDashboard: React.FC = () => {
  const insets = useSafeAreaInsets();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const [selectedRange, setSelectedRange] = useState<DateRange>('7d');
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dashboardData, setDashboardData] = useState<AnalyticsDashboardData>(MOCK_DASHBOARD);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, []);

  const fetchDashboardData = useCallback(async (range: DateRange) => {
    setIsLoading(true);
    try {
      // In production: fetch from API
      // const response = await api.get('/api/oracle/analytics/dashboard', { params: { range } });
      // setDashboardData(response.data);

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 500));
      setDashboardData(MOCK_DASHBOARD);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchDashboardData(selectedRange);
    setIsRefreshing(false);
  }, [selectedRange, fetchDashboardData]);

  const handleRangeChange = (range: DateRange) => {
    setSelectedRange(range);
    fetchDashboardData(range);
  };

  const featureColors = {
    observe: ORACLE_COLORS.observe,
    orient: ORACLE_COLORS.orient,
    decide: ORACLE_COLORS.decide,
    act: ORACLE_COLORS.act,
    probability: '#9B59B6',
  };

  return (
    <View style={[oracleStyles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Analytics</Text>
          <Text style={styles.headerSubtitle}>ORACLE Performance Metrics</Text>
        </View>
        <TouchableOpacity style={styles.exportButton}>
          <Ionicons name="download-outline" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Date Range Selector */}
      <View style={styles.dateRangeContainer}>
        {DATE_RANGE_OPTIONS.map((option) => (
          <TouchableOpacity
            key={option.key}
            style={[
              styles.dateRangeButton,
              selectedRange === option.key && styles.dateRangeButtonActive,
            ]}
            onPress={() => handleRangeChange(option.key)}
          >
            <Text
              style={[
                styles.dateRangeText,
                selectedRange === option.key && styles.dateRangeTextActive,
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={oracleStyles.content}
        contentContainerStyle={oracleStyles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="#00BFFF"
          />
        }
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={ORACLE_COLORS.observe} />
            <Text style={styles.loadingText}>Loading analytics...</Text>
          </View>
        ) : (
          <Animated.View style={{ opacity: fadeAnim }}>
            {/* Summary Cards */}
            <View style={styles.summaryGrid}>
              <SummaryCard
                icon="analytics-outline"
                label="Predictions"
                value={dashboardData.total_predictions}
                color={ORACLE_COLORS.observe}
              />
              <SummaryCard
                icon="checkmark-circle-outline"
                label="Accuracy"
                value={`${Math.round(dashboardData.accuracy_rate * 100)}%`}
                subtext={dashboardData.accuracy_rate >= 0.7 ? 'Good' : 'Needs calibration'}
                color={dashboardData.accuracy_rate >= 0.7 ? '#00FF88' : '#FFD700'}
              />
              <SummaryCard
                icon="git-branch-outline"
                label="Decisions"
                value={dashboardData.total_decisions_completed}
                color={ORACLE_COLORS.decide}
              />
              <SummaryCard
                icon="people-outline"
                label="Sessions"
                value={dashboardData.active_sessions_today}
                subtext="Today"
                color={ORACLE_COLORS.act}
              />
            </View>

            {/* Prediction Accuracy Chart */}
            <MiniLineChart data={dashboardData.prediction_accuracy_trend} />

            {/* Feature Usage Chart */}
            <FeatureUsageChart data={dashboardData.feature_usage} colors={featureColors} />

            {/* System Health */}
            <HealthIndicator
              status={dashboardData.system_health.status}
              latency={dashboardData.system_health.avg_latency_ms}
              errorRate={dashboardData.system_health.error_rate}
              uptime={dashboardData.system_health.uptime_percentage}
            />

            {/* Signal Type Breakdown */}
            <SignalTypeBreakdown data={dashboardData.top_signal_types} />
          </Animated.View>
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
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#888888',
    marginTop: 2,
  },
  exportButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#333333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateRangeContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#0D0D0D',
  },
  dateRangeButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  dateRangeButtonActive: {
    backgroundColor: ORACLE_COLORS.observe,
  },
  dateRangeText: {
    fontSize: 12,
    color: '#888888',
    fontWeight: '600',
  },
  dateRangeTextActive: {
    color: '#000000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: '#888888',
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  summaryCard: {
    width: (width - 52) / 2,
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    margin: 4,
    alignItems: 'center',
  },
  summaryIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#888888',
  },
  summarySubtext: {
    fontSize: 10,
    color: '#666666',
    marginTop: 4,
  },
  chartContainer: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  chartTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  lineChart: {
    height: 180,
    position: 'relative',
  },
  gridLines: {
    position: 'absolute',
    left: 40,
    right: 0,
    top: 0,
    height: 120,
    justifyContent: 'space-between',
  },
  gridLine: {
    height: 1,
    backgroundColor: '#333333',
  },
  yAxisLabels: {
    position: 'absolute',
    left: 0,
    top: 0,
    height: 120,
    justifyContent: 'space-between',
  },
  axisLabel: {
    fontSize: 10,
    color: '#666666',
  },
  chartArea: {
    position: 'absolute',
    left: 40,
    right: 0,
    top: 0,
    height: 120,
  },
  pointContainer: {
    position: 'absolute',
  },
  lineSegment: {
    position: 'absolute',
    height: 2,
    borderRadius: 1,
  },
  dataPoint: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#0D0D0D',
  },
  xAxisLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 130,
    paddingLeft: 40,
  },
  barChart: {
    paddingTop: 8,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  barLabel: {
    width: 70,
    fontSize: 11,
    color: '#888888',
    fontWeight: '600',
  },
  barTrack: {
    flex: 1,
    height: 20,
    backgroundColor: '#333333',
    borderRadius: 10,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 10,
  },
  barValue: {
    width: 40,
    fontSize: 12,
    color: '#FFFFFF',
    textAlign: 'right',
    fontWeight: '600',
  },
  healthContainer: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  healthContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  healthStatus: {
    alignItems: 'center',
    marginRight: 24,
  },
  statusDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginBottom: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  healthMetrics: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  healthMetric: {
    alignItems: 'center',
  },
  healthMetricValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 4,
  },
  healthMetricLabel: {
    fontSize: 10,
    color: '#666666',
    marginTop: 2,
  },
  breakdownContainer: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  breakdownContent: {
    paddingTop: 8,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  breakdownDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  breakdownLabel: {
    width: 80,
    fontSize: 12,
    color: '#CCCCCC',
    textTransform: 'capitalize',
  },
  breakdownBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#333333',
    borderRadius: 4,
    overflow: 'hidden',
    marginRight: 12,
  },
  breakdownBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  breakdownValue: {
    width: 30,
    fontSize: 12,
    color: '#888888',
    textAlign: 'right',
  },
});

export default AnalyticsDashboard;
