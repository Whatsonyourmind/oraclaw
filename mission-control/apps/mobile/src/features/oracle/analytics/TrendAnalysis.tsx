/**
 * ORACLE Trend Analysis
 * Multi-line comparison charts with period selectors and annotations
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Animated,
  PanResponder,
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
interface DataSeries {
  id: string;
  label: string;
  data: DataPoint[];
  color: string;
  visible: boolean;
}

interface DataPoint {
  date: Date;
  value: number;
  annotation?: Annotation;
}

interface Annotation {
  id: string;
  label: string;
  type: 'event' | 'milestone' | 'note';
  color?: string;
}

interface TrendIndicator {
  direction: 'up' | 'down' | 'stable';
  changePercent: number;
  label: string;
}

interface PeriodOption {
  id: string;
  label: string;
  days: number;
}

interface TrendAnalysisProps {
  series: DataSeries[];
  title: string;
  subtitle?: string;
  trends: TrendIndicator[];
  onPeriodChange?: (period: string) => void;
  onDataPointPress?: (seriesId: string, dataPoint: DataPoint) => void;
  onAnnotationPress?: (annotation: Annotation) => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH - 48;
const CHART_HEIGHT = 220;
const PADDING = { top: 30, right: 20, bottom: 50, left: 50 };

const PERIOD_OPTIONS: PeriodOption[] = [
  { id: '7d', label: '7D', days: 7 },
  { id: '14d', label: '14D', days: 14 },
  { id: '30d', label: '30D', days: 30 },
  { id: '90d', label: '90D', days: 90 },
  { id: '1y', label: '1Y', days: 365 },
];

// Trend Indicator Badge
const TrendBadge: React.FC<{
  trend: TrendIndicator;
}> = ({ trend }) => {
  const getColor = () => {
    if (trend.direction === 'up') return trend.changePercent >= 0 ? '#22C55E' : '#DC2626';
    if (trend.direction === 'down') return trend.changePercent < 0 ? '#22C55E' : '#DC2626';
    return '#6B7280';
  };

  const getIcon = () => {
    if (trend.direction === 'up') return '+ ';
    if (trend.direction === 'down') return '- ';
    return '= ';
  };

  return (
    <View style={[styles.trendBadge, { backgroundColor: getColor() + '15' }]}>
      <Text style={[styles.trendIcon, { color: getColor() }]}>
        {getIcon()}
      </Text>
      <View style={styles.trendContent}>
        <Text style={[styles.trendPercent, { color: getColor() }]}>
          {trend.changePercent > 0 ? '+' : ''}{trend.changePercent.toFixed(1)}%
        </Text>
        <Text style={styles.trendLabel}>{trend.label}</Text>
      </View>
    </View>
  );
};

// Series Legend Item
const LegendItem: React.FC<{
  series: DataSeries;
  onToggle: () => void;
}> = ({ series, onToggle }) => {
  return (
    <TouchableOpacity
      style={[
        styles.legendItem,
        !series.visible && styles.legendItemDisabled,
      ]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onToggle();
      }}
    >
      <View
        style={[
          styles.legendDot,
          { backgroundColor: series.visible ? series.color : '#D1D5DB' },
        ]}
      />
      <Text
        style={[
          styles.legendText,
          !series.visible && styles.legendTextDisabled,
        ]}
      >
        {series.label}
      </Text>
    </TouchableOpacity>
  );
};

// Multi-Line Chart Component
const MultiLineChart: React.FC<{
  series: DataSeries[];
  selectedPeriod: number;
  onDataPointPress?: (seriesId: string, dataPoint: DataPoint) => void;
}> = ({ series, selectedPeriod, onDataPointPress }) => {
  const [selectedPoint, setSelectedPoint] = useState<{
    seriesId: string;
    pointIndex: number;
    x: number;
    y: number;
  } | null>(null);

  const [tooltipOpacity] = useState(new Animated.Value(0));

  // Calculate chart dimensions
  const chartWidth = CHART_WIDTH - PADDING.left - PADDING.right;
  const chartHeight = CHART_HEIGHT - PADDING.top - PADDING.bottom;

  // Get visible series
  const visibleSeries = series.filter(s => s.visible);

  if (visibleSeries.length === 0) {
    return (
      <View style={styles.emptyChart}>
        <Text style={styles.emptyChartText}>Select a series to view</Text>
      </View>
    );
  }

  // Calculate min/max values across all visible series
  const allValues = visibleSeries.flatMap(s => s.data.map(d => d.value));
  const maxValue = Math.max(...allValues);
  const minValue = Math.min(...allValues, 0);
  const valueRange = maxValue - minValue || 1;

  // Get date range
  const allDates = visibleSeries[0]?.data.map(d => d.date) || [];
  const dateRange = allDates.length > 1
    ? allDates[allDates.length - 1].getTime() - allDates[0].getTime()
    : 1;

  const getX = (date: Date) => {
    const firstDate = allDates[0]?.getTime() || 0;
    return PADDING.left + ((date.getTime() - firstDate) / dateRange) * chartWidth;
  };

  const getY = (value: number) => {
    return PADDING.top + chartHeight - ((value - minValue) / valueRange) * chartHeight;
  };

  // Create paths for each series
  const createPath = (data: DataPoint[]) => {
    return data
      .map((point, index) => {
        const x = getX(point.date);
        const y = getY(point.value);
        return index === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
      })
      .join(' ');
  };

  // Create smooth curve path
  const createSmoothPath = (data: DataPoint[]) => {
    if (data.length < 2) return '';

    const points = data.map(d => ({ x: getX(d.date), y: getY(d.value) }));

    let path = `M ${points[0].x} ${points[0].y}`;

    for (let i = 1; i < points.length; i++) {
      const p0 = points[i - 1];
      const p1 = points[i];

      const cp1x = p0.x + (p1.x - p0.x) * 0.4;
      const cp1y = p0.y;
      const cp2x = p0.x + (p1.x - p0.x) * 0.6;
      const cp2y = p1.y;

      path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p1.x} ${p1.y}`;
    }

    return path;
  };

  const handlePointPress = (seriesId: string, pointIndex: number, x: number, y: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedPoint({ seriesId, pointIndex, x, y });

    Animated.spring(tooltipOpacity, {
      toValue: 1,
      useNativeDriver: true,
    }).start();

    const foundSeries = series.find(s => s.id === seriesId);
    if (foundSeries && onDataPointPress) {
      onDataPointPress(seriesId, foundSeries.data[pointIndex]);
    }
  };

  // Generate Y-axis labels
  const yAxisLabels = Array.from({ length: 5 }, (_, i) => {
    const value = minValue + (valueRange / 4) * i;
    return { value, y: getY(value) };
  });

  // Generate X-axis labels
  const xAxisLabels = allDates.filter((_, i) =>
    i === 0 || i === allDates.length - 1 || i % Math.ceil(allDates.length / 5) === 0
  );

  return (
    <View style={styles.chartWrapper}>
      <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
        <Defs>
          {visibleSeries.map(s => (
            <SvgLinearGradient
              key={`gradient-${s.id}`}
              id={`gradient-${s.id}`}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <Stop offset="0%" stopColor={s.color} stopOpacity="0.3" />
              <Stop offset="100%" stopColor={s.color} stopOpacity="0" />
            </SvgLinearGradient>
          ))}
        </Defs>

        {/* Grid lines */}
        {yAxisLabels.map((label, i) => (
          <G key={`grid-${i}`}>
            <Line
              x1={PADDING.left}
              y1={label.y}
              x2={CHART_WIDTH - PADDING.right}
              y2={label.y}
              stroke="#E5E7EB"
              strokeWidth="1"
              strokeDasharray={i === 0 ? "0" : "4 4"}
            />
            <SvgText
              x={PADDING.left - 8}
              y={label.y + 4}
              fontSize="10"
              fill="#9CA3AF"
              textAnchor="end"
            >
              {label.value.toFixed(0)}
            </SvgText>
          </G>
        ))}

        {/* X-axis labels */}
        {xAxisLabels.map((date, i) => (
          <SvgText
            key={`x-label-${i}`}
            x={getX(date)}
            y={CHART_HEIGHT - 10}
            fontSize="10"
            fill="#9CA3AF"
            textAnchor="middle"
          >
            {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </SvgText>
        ))}

        {/* Series lines and areas */}
        {visibleSeries.map(s => {
          const path = createSmoothPath(s.data);
          const areaPath = `${path} L ${getX(s.data[s.data.length - 1].date)} ${PADDING.top + chartHeight} L ${PADDING.left} ${PADDING.top + chartHeight} Z`;

          return (
            <G key={s.id}>
              {/* Area fill */}
              <Path
                d={areaPath}
                fill={`url(#gradient-${s.id})`}
              />
              {/* Line */}
              <Path
                d={path}
                stroke={s.color}
                strokeWidth="2.5"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </G>
          );
        })}

        {/* Data points with annotations */}
        {visibleSeries.map(s =>
          s.data.map((point, i) => (
            <G key={`${s.id}-point-${i}`}>
              <Circle
                cx={getX(point.date)}
                cy={getY(point.value)}
                r={selectedPoint?.seriesId === s.id && selectedPoint?.pointIndex === i ? 8 : 4}
                fill={s.color}
                stroke="#FFFFFF"
                strokeWidth="2"
                onPress={() => handlePointPress(s.id, i, getX(point.date), getY(point.value))}
              />
              {/* Annotation marker */}
              {point.annotation && (
                <G>
                  <Circle
                    cx={getX(point.date)}
                    cy={getY(point.value) - 16}
                    r={6}
                    fill={point.annotation.color || '#F59E0B'}
                  />
                  <SvgText
                    x={getX(point.date)}
                    y={getY(point.value) - 13}
                    fontSize="8"
                    fill="#FFFFFF"
                    textAnchor="middle"
                    fontWeight="bold"
                  >
                    !
                  </SvgText>
                </G>
              )}
            </G>
          ))
        )}

        {/* Selected point tooltip */}
        {selectedPoint && (
          <G>
            <Rect
              x={selectedPoint.x - 50}
              y={selectedPoint.y - 45}
              width="100"
              height="32"
              rx="6"
              fill="#1F2937"
            />
            <SvgText
              x={selectedPoint.x}
              y={selectedPoint.y - 32}
              fontSize="11"
              fill="#FFFFFF"
              textAnchor="middle"
            >
              {(() => {
                const s = series.find(s => s.id === selectedPoint.seriesId);
                const point = s?.data[selectedPoint.pointIndex];
                return point ? point.value.toFixed(1) : '';
              })()}
            </SvgText>
            <SvgText
              x={selectedPoint.x}
              y={selectedPoint.y - 20}
              fontSize="9"
              fill="#9CA3AF"
              textAnchor="middle"
            >
              {(() => {
                const s = series.find(s => s.id === selectedPoint.seriesId);
                const point = s?.data[selectedPoint.pointIndex];
                return point?.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              })()}
            </SvgText>
          </G>
        )}
      </Svg>
    </View>
  );
};

// Comparison View
const ComparisonView: React.FC<{
  series: DataSeries[];
  periodLabel: string;
}> = ({ series, periodLabel }) => {
  const visibleSeries = series.filter(s => s.visible);

  return (
    <View style={styles.comparisonContainer}>
      <Text style={styles.comparisonTitle}>Period Comparison</Text>
      <View style={styles.comparisonGrid}>
        {visibleSeries.map(s => {
          const firstValue = s.data[0]?.value || 0;
          const lastValue = s.data[s.data.length - 1]?.value || 0;
          const change = lastValue - firstValue;
          const changePercent = firstValue !== 0 ? (change / firstValue) * 100 : 0;

          return (
            <View key={s.id} style={styles.comparisonCard}>
              <View style={[styles.comparisonIndicator, { backgroundColor: s.color }]} />
              <View style={styles.comparisonContent}>
                <Text style={styles.comparisonLabel}>{s.label}</Text>
                <Text style={styles.comparisonValue}>
                  {lastValue.toFixed(1)}
                </Text>
                <Text
                  style={[
                    styles.comparisonChange,
                    { color: change >= 0 ? '#22C55E' : '#DC2626' },
                  ]}
                >
                  {change >= 0 ? '+' : ''}{changePercent.toFixed(1)}%
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
};

// Main Component
export const TrendAnalysis: React.FC<TrendAnalysisProps> = ({
  series: initialSeries,
  title,
  subtitle,
  trends,
  onPeriodChange,
  onDataPointPress,
  onAnnotationPress,
}) => {
  const [selectedPeriod, setSelectedPeriod] = useState('30d');
  const [series, setSeries] = useState(initialSeries);

  useEffect(() => {
    setSeries(initialSeries);
  }, [initialSeries]);

  const handlePeriodChange = (periodId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedPeriod(periodId);
    onPeriodChange?.(periodId);
  };

  const handleSeriesToggle = (seriesId: string) => {
    setSeries(prev =>
      prev.map(s =>
        s.id === seriesId ? { ...s, visible: !s.visible } : s
      )
    );
  };

  const selectedPeriodDays = PERIOD_OPTIONS.find(p => p.id === selectedPeriod)?.days || 30;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{title}</Text>
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>
      </View>

      {/* Trend Indicators */}
      {trends.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.trendsContainer}
        >
          {trends.map((trend, index) => (
            <TrendBadge key={index} trend={trend} />
          ))}
        </ScrollView>
      )}

      {/* Period Selector */}
      <View style={styles.periodSelector}>
        {PERIOD_OPTIONS.map((period) => (
          <TouchableOpacity
            key={period.id}
            style={[
              styles.periodButton,
              selectedPeriod === period.id && styles.periodButtonActive,
            ]}
            onPress={() => handlePeriodChange(period.id)}
          >
            <Text
              style={[
                styles.periodButtonText,
                selectedPeriod === period.id && styles.periodButtonTextActive,
              ]}
            >
              {period.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Chart */}
      <View style={styles.chartContainer}>
        <MultiLineChart
          series={series}
          selectedPeriod={selectedPeriodDays}
          onDataPointPress={onDataPointPress}
        />
      </View>

      {/* Legend */}
      <View style={styles.legendContainer}>
        {series.map(s => (
          <LegendItem
            key={s.id}
            series={s}
            onToggle={() => handleSeriesToggle(s.id)}
          />
        ))}
      </View>

      {/* Comparison View */}
      <ComparisonView
        series={series}
        periodLabel={PERIOD_OPTIONS.find(p => p.id === selectedPeriod)?.label || ''}
      />

      {/* Annotations List */}
      {series.some(s => s.data.some(d => d.annotation)) && (
        <View style={styles.annotationsContainer}>
          <Text style={styles.annotationsTitle}>Events & Milestones</Text>
          {series
            .flatMap(s => s.data.filter(d => d.annotation).map(d => d.annotation!))
            .filter((a, i, arr) => arr.findIndex(b => b.id === a.id) === i)
            .map((annotation) => (
              <TouchableOpacity
                key={annotation.id}
                style={styles.annotationItem}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onAnnotationPress?.(annotation);
                }}
              >
                <View
                  style={[
                    styles.annotationDot,
                    { backgroundColor: annotation.color || '#F59E0B' },
                  ]}
                />
                <Text style={styles.annotationLabel}>{annotation.label}</Text>
                <Text style={styles.annotationType}>{annotation.type}</Text>
              </TouchableOpacity>
            ))}
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
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
  },

  // Trends
  trendsContainer: {
    paddingBottom: 16,
    gap: 12,
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    marginRight: 12,
  },
  trendIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  trendContent: {},
  trendPercent: {
    fontSize: 16,
    fontWeight: '700',
  },
  trendLabel: {
    fontSize: 11,
    color: '#6B7280',
  },

  // Period Selector
  periodSelector: {
    flexDirection: 'row',
    backgroundColor: '#E5E7EB',
    borderRadius: 10,
    padding: 4,
    marginBottom: 20,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
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
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  periodButtonTextActive: {
    color: '#1F2937',
  },

  // Chart
  chartContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  chartWrapper: {
    alignItems: 'center',
  },
  emptyChart: {
    height: CHART_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyChartText: {
    fontSize: 14,
    color: '#9CA3AF',
  },

  // Legend
  legendContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  legendItemDisabled: {
    opacity: 0.5,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  legendText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#374151',
  },
  legendTextDisabled: {
    color: '#9CA3AF',
  },

  // Comparison
  comparisonContainer: {
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
  comparisonTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  comparisonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  comparisonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    width: (SCREEN_WIDTH - 80) / 2,
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
  },
  comparisonIndicator: {
    width: 4,
    height: 40,
    borderRadius: 2,
    marginRight: 12,
  },
  comparisonContent: {},
  comparisonLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 2,
  },
  comparisonValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  comparisonChange: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },

  // Annotations
  annotationsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  annotationsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  annotationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  annotationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 12,
  },
  annotationLabel: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
  },
  annotationType: {
    fontSize: 12,
    color: '#9CA3AF',
    textTransform: 'capitalize',
  },

  bottomSpacer: {
    height: 32,
  },
});

export default TrendAnalysis;
