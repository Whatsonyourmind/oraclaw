/**
 * ORACLE Productivity Charts
 * Visualizations for productivity metrics
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Svg, {
  Path,
  Circle,
  Line,
  G,
  Text as SvgText,
  Rect,
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
} from 'react-native-svg';

// Types
interface DailyProductivity {
  date: string;
  dayLabel: string;
  score: number;
  tasksCompleted: number;
  focusMinutes: number;
  meetingMinutes: number;
}

interface TaskTrend {
  label: string;
  completed: number;
  target?: number;
}

interface FocusBreakdown {
  category: string;
  minutes: number;
  color: string;
}

interface WorkRatio {
  deepWork: number;
  shallowWork: number;
  meetings: number;
  breaks: number;
}

interface ProductivityChartsProps {
  weeklyData: DailyProductivity[];
  taskTrends: TaskTrend[];
  focusBreakdown: FocusBreakdown[];
  workRatio: WorkRatio;
  onDayPress?: (date: string) => void;
  onPeriodChange?: (period: 'week' | 'month' | 'quarter') => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH - 48;
const CHART_HEIGHT = 200;
const PADDING = { top: 20, right: 20, bottom: 40, left: 40 };

// Weekly Productivity Line Chart
const WeeklyProductivityChart: React.FC<{
  data: DailyProductivity[];
  onDayPress?: (date: string) => void;
}> = ({ data, onDayPress }) => {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const animatedValues = useRef(data.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    Animated.stagger(
      50,
      animatedValues.map((anim) =>
        Animated.spring(anim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 50,
          friction: 7,
        })
      )
    ).start();
  }, []);

  if (data.length === 0) return null;

  const chartWidth = CHART_WIDTH - PADDING.left - PADDING.right;
  const chartHeight = CHART_HEIGHT - PADDING.top - PADDING.bottom;

  const maxScore = Math.max(...data.map(d => d.score), 100);
  const minScore = 0;

  const getX = (index: number) => PADDING.left + (index / (data.length - 1)) * chartWidth;
  const getY = (value: number) => PADDING.top + chartHeight - ((value - minScore) / (maxScore - minScore)) * chartHeight;

  // Create path for the line
  const linePath = data
    .map((point, index) => {
      const x = getX(index);
      const y = getY(point.score);
      return index === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
    })
    .join(' ');

  // Create path for the gradient area
  const areaPath = `${linePath} L ${getX(data.length - 1)} ${PADDING.top + chartHeight} L ${PADDING.left} ${PADDING.top + chartHeight} Z`;

  return (
    <View style={styles.chartContainer}>
      <Text style={styles.chartTitle}>Weekly Productivity</Text>
      <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
        <Defs>
          <SvgLinearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#4F46E5" stopOpacity="0.3" />
            <Stop offset="100%" stopColor="#4F46E5" stopOpacity="0" />
          </SvgLinearGradient>
        </Defs>

        {/* Grid lines */}
        {[0, 25, 50, 75, 100].map((value) => (
          <G key={value}>
            <Line
              x1={PADDING.left}
              y1={getY(value)}
              x2={CHART_WIDTH - PADDING.right}
              y2={getY(value)}
              stroke="#E5E7EB"
              strokeWidth="1"
              strokeDasharray="4 4"
            />
            <SvgText
              x={PADDING.left - 8}
              y={getY(value) + 4}
              fontSize="10"
              fill="#9CA3AF"
              textAnchor="end"
            >
              {value}
            </SvgText>
          </G>
        ))}

        {/* Area fill */}
        <Path d={areaPath} fill="url(#areaGradient)" />

        {/* Main line */}
        <Path
          d={linePath}
          stroke="#4F46E5"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data points */}
        {data.map((point, index) => (
          <G key={index}>
            <Circle
              cx={getX(index)}
              cy={getY(point.score)}
              r={selectedIndex === index ? 8 : 6}
              fill={selectedIndex === index ? '#4F46E5' : '#FFFFFF'}
              stroke="#4F46E5"
              strokeWidth="3"
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSelectedIndex(index);
                onDayPress?.(point.date);
              }}
            />
            <SvgText
              x={getX(index)}
              y={CHART_HEIGHT - 10}
              fontSize="11"
              fill="#6B7280"
              textAnchor="middle"
            >
              {point.dayLabel}
            </SvgText>
          </G>
        ))}

        {/* Selected point tooltip */}
        {selectedIndex !== null && (
          <G>
            <Rect
              x={getX(selectedIndex) - 35}
              y={getY(data[selectedIndex].score) - 40}
              width="70"
              height="28"
              rx="6"
              fill="#1F2937"
            />
            <SvgText
              x={getX(selectedIndex)}
              y={getY(data[selectedIndex].score) - 22}
              fontSize="12"
              fill="#FFFFFF"
              textAnchor="middle"
              fontWeight="600"
            >
              {data[selectedIndex].score}%
            </SvgText>
          </G>
        )}
      </Svg>
    </View>
  );
};

// Task Completion Trends Bar Chart
const TaskTrendsChart: React.FC<{
  data: TaskTrend[];
}> = ({ data }) => {
  const animatedHeights = useRef(data.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    Animated.stagger(
      80,
      animatedHeights.map((anim) =>
        Animated.spring(anim, {
          toValue: 1,
          useNativeDriver: false,
          tension: 40,
          friction: 8,
        })
      )
    ).start();
  }, []);

  if (data.length === 0) return null;

  const maxValue = Math.max(...data.map(d => Math.max(d.completed, d.target ?? 0)));
  const barWidth = (CHART_WIDTH - 48) / data.length - 12;

  return (
    <View style={styles.chartContainer}>
      <Text style={styles.chartTitle}>Task Completion</Text>
      <View style={styles.barChartContainer}>
        {data.map((item, index) => {
          const barHeight = (item.completed / maxValue) * 140;
          const targetHeight = item.target ? (item.target / maxValue) * 140 : 0;

          return (
            <View key={index} style={styles.barGroup}>
              <View style={styles.barWrapper}>
                {/* Target line */}
                {item.target && (
                  <View
                    style={[
                      styles.targetLine,
                      { bottom: targetHeight },
                    ]}
                  />
                )}
                {/* Actual bar */}
                <Animated.View
                  style={[
                    styles.bar,
                    {
                      width: barWidth,
                      height: animatedHeights[index].interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, barHeight],
                      }),
                      backgroundColor: item.completed >= (item.target ?? 0) ? '#22C55E' : '#3B82F6',
                    },
                  ]}
                />
              </View>
              <Text style={styles.barLabel}>{item.label}</Text>
              <Text style={styles.barValue}>{item.completed}</Text>
            </View>
          );
        })}
      </View>
      <View style={styles.legendContainer}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#3B82F6' }]} />
          <Text style={styles.legendText}>Completed</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendLine]} />
          <Text style={styles.legendText}>Target</Text>
        </View>
      </View>
    </View>
  );
};

// Focus Time Breakdown Donut Chart
const FocusBreakdownChart: React.FC<{
  data: FocusBreakdown[];
}> = ({ data }) => {
  const [selectedSegment, setSelectedSegment] = useState<number | null>(null);
  const animatedRotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(animatedRotation, {
      toValue: 1,
      useNativeDriver: true,
      tension: 30,
      friction: 8,
    }).start();
  }, []);

  if (data.length === 0) return null;

  const total = data.reduce((sum, item) => sum + item.minutes, 0);
  const centerX = CHART_WIDTH / 2;
  const centerY = 100;
  const radius = 70;
  const innerRadius = 45;

  let currentAngle = -90; // Start from top

  const segments = data.map((item, index) => {
    const percentage = item.minutes / total;
    const angle = percentage * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    currentAngle = endAngle;

    const largeArcFlag = angle > 180 ? 1 : 0;

    const startOuterX = centerX + radius * Math.cos((startAngle * Math.PI) / 180);
    const startOuterY = centerY + radius * Math.sin((startAngle * Math.PI) / 180);
    const endOuterX = centerX + radius * Math.cos((endAngle * Math.PI) / 180);
    const endOuterY = centerY + radius * Math.sin((endAngle * Math.PI) / 180);

    const startInnerX = centerX + innerRadius * Math.cos((endAngle * Math.PI) / 180);
    const startInnerY = centerY + innerRadius * Math.sin((endAngle * Math.PI) / 180);
    const endInnerX = centerX + innerRadius * Math.cos((startAngle * Math.PI) / 180);
    const endInnerY = centerY + innerRadius * Math.sin((startAngle * Math.PI) / 180);

    const path = `
      M ${startOuterX} ${startOuterY}
      A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endOuterX} ${endOuterY}
      L ${startInnerX} ${startInnerY}
      A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${endInnerX} ${endInnerY}
      Z
    `;

    return { ...item, path, percentage, index };
  });

  return (
    <View style={styles.chartContainer}>
      <Text style={styles.chartTitle}>Focus Time Breakdown</Text>
      <View style={styles.donutContainer}>
        <Svg width={CHART_WIDTH} height={200}>
          {segments.map((segment) => (
            <Path
              key={segment.index}
              d={segment.path}
              fill={segment.color}
              opacity={selectedSegment === null || selectedSegment === segment.index ? 1 : 0.4}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSelectedSegment(selectedSegment === segment.index ? null : segment.index);
              }}
            />
          ))}
          {/* Center text */}
          <SvgText
            x={centerX}
            y={centerY - 8}
            fontSize="24"
            fontWeight="700"
            fill="#1F2937"
            textAnchor="middle"
          >
            {Math.round(total / 60)}h
          </SvgText>
          <SvgText
            x={centerX}
            y={centerY + 12}
            fontSize="12"
            fill="#6B7280"
            textAnchor="middle"
          >
            Focus Time
          </SvgText>
        </Svg>
      </View>
      {/* Legend */}
      <View style={styles.donutLegend}>
        {data.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.donutLegendItem,
              selectedSegment === index && styles.donutLegendItemActive,
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setSelectedSegment(selectedSegment === index ? null : index);
            }}
          >
            <View style={[styles.donutLegendDot, { backgroundColor: item.color }]} />
            <Text style={styles.donutLegendText}>{item.category}</Text>
            <Text style={styles.donutLegendValue}>
              {Math.round(item.minutes / 60)}h {item.minutes % 60}m
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

// Meeting vs Deep Work Ratio
const WorkRatioChart: React.FC<{
  data: WorkRatio;
}> = ({ data }) => {
  const total = data.deepWork + data.shallowWork + data.meetings + data.breaks;
  const animatedWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(animatedWidth, {
      toValue: 1,
      useNativeDriver: false,
      tension: 30,
      friction: 8,
    }).start();
  }, []);

  const segments = [
    { label: 'Deep Work', value: data.deepWork, color: '#22C55E', percentage: data.deepWork / total },
    { label: 'Shallow Work', value: data.shallowWork, color: '#3B82F6', percentage: data.shallowWork / total },
    { label: 'Meetings', value: data.meetings, color: '#F59E0B', percentage: data.meetings / total },
    { label: 'Breaks', value: data.breaks, color: '#8B5CF6', percentage: data.breaks / total },
  ];

  return (
    <View style={styles.chartContainer}>
      <Text style={styles.chartTitle}>Work Distribution</Text>
      <View style={styles.ratioBarContainer}>
        <View style={styles.ratioBar}>
          {segments.map((segment, index) => (
            <Animated.View
              key={index}
              style={[
                styles.ratioSegment,
                {
                  backgroundColor: segment.color,
                  flex: animatedWidth.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, segment.percentage],
                  }),
                },
                index === 0 && { borderTopLeftRadius: 8, borderBottomLeftRadius: 8 },
                index === segments.length - 1 && { borderTopRightRadius: 8, borderBottomRightRadius: 8 },
              ]}
            />
          ))}
        </View>
      </View>
      <View style={styles.ratioLegend}>
        {segments.map((segment, index) => (
          <View key={index} style={styles.ratioLegendItem}>
            <View style={[styles.ratioLegendDot, { backgroundColor: segment.color }]} />
            <View style={styles.ratioLegendContent}>
              <Text style={styles.ratioLegendLabel}>{segment.label}</Text>
              <Text style={styles.ratioLegendValue}>
                {Math.round(segment.value / 60)}h ({Math.round(segment.percentage * 100)}%)
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
};

// Main Component
export const ProductivityCharts: React.FC<ProductivityChartsProps> = ({
  weeklyData,
  taskTrends,
  focusBreakdown,
  workRatio,
  onDayPress,
  onPeriodChange,
}) => {
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'quarter'>('week');

  const handlePeriodChange = (period: 'week' | 'month' | 'quarter') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedPeriod(period);
    onPeriodChange?.(period);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* Period Selector */}
      <View style={styles.periodSelector}>
        {(['week', 'month', 'quarter'] as const).map((period) => (
          <TouchableOpacity
            key={period}
            style={[
              styles.periodButton,
              selectedPeriod === period && styles.periodButtonActive,
            ]}
            onPress={() => handlePeriodChange(period)}
          >
            <Text
              style={[
                styles.periodButtonText,
                selectedPeriod === period && styles.periodButtonTextActive,
              ]}
            >
              {period.charAt(0).toUpperCase() + period.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Weekly Productivity Chart */}
      <WeeklyProductivityChart data={weeklyData} onDayPress={onDayPress} />

      {/* Task Completion Trends */}
      <TaskTrendsChart data={taskTrends} />

      {/* Focus Time Breakdown */}
      <FocusBreakdownChart data={focusBreakdown} />

      {/* Meeting vs Deep Work Ratio */}
      <WorkRatioChart data={workRatio} />

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
  periodSelector: {
    flexDirection: 'row',
    backgroundColor: '#E5E7EB',
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  periodButtonActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  periodButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  periodButtonTextActive: {
    color: '#1F2937',
  },

  // Chart Container
  chartContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },

  // Bar Chart
  barChartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: 180,
    paddingTop: 20,
  },
  barGroup: {
    alignItems: 'center',
  },
  barWrapper: {
    height: 140,
    justifyContent: 'flex-end',
    marginBottom: 8,
  },
  bar: {
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
  },
  targetLine: {
    position: 'absolute',
    left: -4,
    right: -4,
    height: 2,
    backgroundColor: '#EF4444',
    borderRadius: 1,
  },
  barLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 2,
  },
  barValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginTop: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  legendLine: {
    width: 16,
    height: 2,
    backgroundColor: '#EF4444',
    marginRight: 8,
  },
  legendText: {
    fontSize: 12,
    color: '#6B7280',
  },

  // Donut Chart
  donutContainer: {
    alignItems: 'center',
  },
  donutLegend: {
    marginTop: 16,
  },
  donutLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  donutLegendItemActive: {
    backgroundColor: '#F3F4F6',
  },
  donutLegendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  donutLegendText: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
  },
  donutLegendValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },

  // Ratio Chart
  ratioBarContainer: {
    marginBottom: 20,
  },
  ratioBar: {
    flexDirection: 'row',
    height: 24,
    borderRadius: 8,
    overflow: 'hidden',
  },
  ratioSegment: {
    height: '100%',
  },
  ratioLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  ratioLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '50%',
    paddingVertical: 8,
  },
  ratioLegendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  ratioLegendContent: {
    flex: 1,
  },
  ratioLegendLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  ratioLegendValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },

  bottomSpacer: {
    height: 32,
  },
});

export default ProductivityCharts;
