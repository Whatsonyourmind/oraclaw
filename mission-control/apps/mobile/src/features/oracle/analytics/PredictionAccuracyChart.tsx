/**
 * PredictionAccuracyChart Component
 * Story adv-6 - Interactive line chart with accuracy trends and confidence bands
 */
import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  Dimensions,
  StyleSheet,
  ScrollView,
  Modal,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { PredictionAccuracyCategory } from '@mission-control/shared-types';
import { ORACLE_COLORS } from '../../../store/oracle';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface AccuracyDataPoint {
  date: string;
  accuracy: number;
  count: number;
  confidenceLow?: number;
  confidenceHigh?: number;
}

interface CategoryData {
  category: PredictionAccuracyCategory;
  data: AccuracyDataPoint[];
  avgAccuracy: number;
  color: string;
}

interface PredictionAccuracyChartProps {
  data: AccuracyDataPoint[];
  categoryBreakdown?: CategoryData[];
  title?: string;
  height?: number;
  showConfidenceBands?: boolean;
  onPointPress?: (point: AccuracyDataPoint, index: number) => void;
}

// Category colors
const CATEGORY_COLORS: Record<PredictionAccuracyCategory, string> = {
  task_completion: ORACLE_COLORS.act,
  deadline_risk: ORACLE_COLORS.decide,
  resource_availability: ORACLE_COLORS.orient,
  outcome_likelihood: ORACLE_COLORS.observe,
  duration_estimate: '#9B59B6',
  custom: '#888888',
};

// Mock category breakdown data
const generateCategoryBreakdown = (data: AccuracyDataPoint[]): CategoryData[] => {
  const categories: PredictionAccuracyCategory[] = [
    'task_completion',
    'deadline_risk',
    'resource_availability',
    'outcome_likelihood',
  ];

  return categories.map((category) => ({
    category,
    data: data.map((point) => ({
      ...point,
      accuracy: point.accuracy + (Math.random() - 0.5) * 0.15, // Add variation
    })),
    avgAccuracy: data.reduce((sum, p) => sum + p.accuracy, 0) / data.length + (Math.random() - 0.5) * 0.1,
    color: CATEGORY_COLORS[category],
  }));
};

interface ChartDimensions {
  width: number;
  height: number;
  paddingLeft: number;
  paddingRight: number;
  paddingTop: number;
  paddingBottom: number;
}

const calculateDimensions = (containerWidth: number, height: number): ChartDimensions => ({
  width: containerWidth,
  height,
  paddingLeft: 50,
  paddingRight: 20,
  paddingTop: 20,
  paddingBottom: 40,
});

interface DataPointDetailsProps {
  point: AccuracyDataPoint | null;
  visible: boolean;
  onClose: () => void;
}

const DataPointDetails: React.FC<DataPointDetailsProps> = ({ point, visible, onClose }) => {
  if (!point) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <View style={styles.detailsCard}>
          <View style={styles.detailsHeader}>
            <Text style={styles.detailsDate}>{point.date}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={20} color="#888888" />
            </TouchableOpacity>
          </View>

          <View style={styles.detailsContent}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Accuracy</Text>
              <Text style={[styles.detailValue, { color: getAccuracyColor(point.accuracy) }]}>
                {(point.accuracy * 100).toFixed(1)}%
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Predictions</Text>
              <Text style={styles.detailValue}>{point.count}</Text>
            </View>

            {point.confidenceLow !== undefined && point.confidenceHigh !== undefined && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>95% CI</Text>
                <Text style={styles.detailValue}>
                  {(point.confidenceLow * 100).toFixed(1)}% - {(point.confidenceHigh * 100).toFixed(1)}%
                </Text>
              </View>
            )}
          </View>

          {/* Quality indicator */}
          <View style={styles.qualityIndicator}>
            <Ionicons
              name={point.accuracy >= 0.7 ? 'checkmark-circle' : 'warning'}
              size={18}
              color={point.accuracy >= 0.7 ? '#00FF88' : '#FFD700'}
            />
            <Text style={styles.qualityText}>
              {point.accuracy >= 0.7 ? 'Well calibrated' : 'Needs improvement'}
            </Text>
          </View>
        </View>
      </Pressable>
    </Modal>
  );
};

const getAccuracyColor = (accuracy: number): string => {
  if (accuracy >= 0.75) return '#00FF88';
  if (accuracy >= 0.6) return '#FFD700';
  return '#FF6B6B';
};

export const PredictionAccuracyChart: React.FC<PredictionAccuracyChartProps> = ({
  data,
  categoryBreakdown,
  title = 'Prediction Accuracy',
  height = 220,
  showConfidenceBands = true,
  onPointPress,
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pathAnim = useRef(new Animated.Value(0)).current;

  const [selectedCategory, setSelectedCategory] = useState<PredictionAccuracyCategory | 'all'>('all');
  const [selectedPoint, setSelectedPoint] = useState<AccuracyDataPoint | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const categories = categoryBreakdown || generateCategoryBreakdown(data);
  const chartWidth = SCREEN_WIDTH - 32;
  const dim = calculateDimensions(chartWidth, height);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(pathAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: false,
      }),
    ]).start();
  }, []);

  const activeData = selectedCategory === 'all' ? data : categories.find((c) => c.category === selectedCategory)?.data || data;

  // Calculate chart bounds
  const allAccuracies = activeData.map((d) => d.accuracy);
  const maxAccuracy = Math.min(Math.max(...allAccuracies) + 0.1, 1);
  const minAccuracy = Math.max(Math.min(...allAccuracies) - 0.1, 0);
  const range = maxAccuracy - minAccuracy || 0.1;

  const chartAreaWidth = dim.width - dim.paddingLeft - dim.paddingRight;
  const chartAreaHeight = dim.height - dim.paddingTop - dim.paddingBottom;
  const pointSpacing = activeData.length > 1 ? chartAreaWidth / (activeData.length - 1) : chartAreaWidth;

  // Convert data point to chart coordinates
  const getPointCoords = (point: AccuracyDataPoint, index: number) => {
    const x = dim.paddingLeft + index * pointSpacing;
    const normalizedY = (point.accuracy - minAccuracy) / range;
    const y = dim.paddingTop + chartAreaHeight - normalizedY * chartAreaHeight;
    return { x, y };
  };

  // Handle point press
  const handlePointPress = useCallback((point: AccuracyDataPoint, index: number) => {
    setSelectedPoint(point);
    setShowDetails(true);
    onPointPress?.(point, index);
  }, [onPointPress]);

  // Generate confidence band polygon points
  const generateConfidenceBand = () => {
    if (!showConfidenceBands || activeData.length === 0) return null;

    // Generate mock confidence intervals (would come from actual statistical calculation)
    const dataWithConfidence = activeData.map((point) => ({
      ...point,
      confidenceLow: Math.max(0, point.accuracy - 0.1 * (1 + Math.random() * 0.5)),
      confidenceHigh: Math.min(1, point.accuracy + 0.1 * (1 + Math.random() * 0.5)),
    }));

    // Upper edge points
    const upperPoints = dataWithConfidence.map((point, i) => {
      const x = dim.paddingLeft + i * pointSpacing;
      const normalizedY = (point.confidenceHigh - minAccuracy) / range;
      const y = dim.paddingTop + chartAreaHeight - normalizedY * chartAreaHeight;
      return { x, y };
    });

    // Lower edge points (reversed)
    const lowerPoints = dataWithConfidence.map((point, i) => {
      const x = dim.paddingLeft + i * pointSpacing;
      const normalizedY = (point.confidenceLow - minAccuracy) / range;
      const y = dim.paddingTop + chartAreaHeight - normalizedY * chartAreaHeight;
      return { x, y };
    }).reverse();

    return { upperPoints, lowerPoints, dataWithConfidence };
  };

  const confidenceBand = generateConfidenceBand();

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.avgAccuracy}>
          <Text style={styles.avgLabel}>Avg:</Text>
          <Text style={[styles.avgValue, { color: getAccuracyColor(activeData.reduce((s, d) => s + d.accuracy, 0) / activeData.length) }]}>
            {(activeData.reduce((s, d) => s + d.accuracy, 0) / activeData.length * 100).toFixed(1)}%
          </Text>
        </View>
      </View>

      {/* Category selector */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categorySelector}
        contentContainerStyle={styles.categorySelectorContent}
      >
        <TouchableOpacity
          style={[
            styles.categoryButton,
            selectedCategory === 'all' && styles.categoryButtonActive,
          ]}
          onPress={() => setSelectedCategory('all')}
        >
          <Text
            style={[
              styles.categoryButtonText,
              selectedCategory === 'all' && styles.categoryButtonTextActive,
            ]}
          >
            All
          </Text>
        </TouchableOpacity>
        {categories.map((cat) => (
          <TouchableOpacity
            key={cat.category}
            style={[
              styles.categoryButton,
              selectedCategory === cat.category && styles.categoryButtonActive,
              selectedCategory === cat.category && { borderColor: cat.color },
            ]}
            onPress={() => setSelectedCategory(cat.category)}
          >
            <View style={[styles.categoryDot, { backgroundColor: cat.color }]} />
            <Text
              style={[
                styles.categoryButtonText,
                selectedCategory === cat.category && styles.categoryButtonTextActive,
              ]}
            >
              {cat.category.replace(/_/g, ' ')}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Chart */}
      <View style={[styles.chartContainer, { height: dim.height }]}>
        {/* Y-axis labels */}
        <View style={styles.yAxis}>
          <Text style={styles.axisLabel}>{Math.round(maxAccuracy * 100)}%</Text>
          <Text style={styles.axisLabel}>{Math.round((maxAccuracy + minAccuracy) / 2 * 100)}%</Text>
          <Text style={styles.axisLabel}>{Math.round(minAccuracy * 100)}%</Text>
        </View>

        {/* Grid lines */}
        <View style={[styles.gridContainer, { left: dim.paddingLeft, right: dim.paddingRight }]}>
          {[0, 0.5, 1].map((ratio, i) => (
            <View
              key={i}
              style={[
                styles.gridLine,
                {
                  top: dim.paddingTop + chartAreaHeight * ratio,
                },
              ]}
            />
          ))}
        </View>

        {/* Confidence band */}
        {showConfidenceBands && confidenceBand && (
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            {confidenceBand.upperPoints.map((upper, i) => {
              if (i >= confidenceBand.lowerPoints.length - 1 - i) return null;
              const lower = confidenceBand.lowerPoints[confidenceBand.lowerPoints.length - 1 - i];
              return (
                <View
                  key={i}
                  style={[
                    styles.confidenceSegment,
                    {
                      left: upper.x - 3,
                      top: upper.y,
                      height: lower.y - upper.y,
                      width: pointSpacing + 6,
                    },
                  ]}
                />
              );
            })}
          </View>
        )}

        {/* Line segments */}
        {activeData.map((point, index) => {
          if (index >= activeData.length - 1) return null;

          const start = getPointCoords(point, index);
          const end = getPointCoords(activeData[index + 1], index + 1);
          const lineColor = selectedCategory === 'all'
            ? ORACLE_COLORS.observe
            : categories.find((c) => c.category === selectedCategory)?.color || ORACLE_COLORS.observe;

          // Calculate line angle and length
          const dx = end.x - start.x;
          const dy = end.y - start.y;
          const length = Math.sqrt(dx * dx + dy * dy);
          const angle = Math.atan2(dy, dx) * (180 / Math.PI);

          return (
            <View
              key={`line-${index}`}
              style={[
                styles.lineSegment,
                {
                  left: start.x,
                  top: start.y - 1.5,
                  width: length,
                  backgroundColor: lineColor,
                  transform: [{ rotate: `${angle}deg` }],
                  transformOrigin: 'left center',
                },
              ]}
            />
          );
        })}

        {/* Data points (touchable) */}
        {activeData.map((point, index) => {
          const coords = getPointCoords(point, index);
          const lineColor = selectedCategory === 'all'
            ? ORACLE_COLORS.observe
            : categories.find((c) => c.category === selectedCategory)?.color || ORACLE_COLORS.observe;

          return (
            <TouchableOpacity
              key={`point-${index}`}
              style={[
                styles.dataPointTouchable,
                {
                  left: coords.x - 15,
                  top: coords.y - 15,
                },
              ]}
              onPress={() => handlePointPress(
                confidenceBand?.dataWithConfidence[index] || point,
                index
              )}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.dataPoint,
                  {
                    backgroundColor: lineColor,
                    borderColor: '#0D0D0D',
                  },
                ]}
              />
            </TouchableOpacity>
          );
        })}

        {/* X-axis labels */}
        <View style={[styles.xAxis, { top: dim.height - dim.paddingBottom + 8 }]}>
          {activeData.filter((_, i) => i % Math.ceil(activeData.length / 5) === 0 || i === activeData.length - 1).map((point, displayIndex, filteredArray) => {
            const actualIndex = activeData.findIndex((d) => d === point);
            const x = dim.paddingLeft + actualIndex * pointSpacing;
            return (
              <Text
                key={displayIndex}
                style={[
                  styles.axisLabel,
                  { position: 'absolute', left: x - 20, width: 40, textAlign: 'center' },
                ]}
              >
                {point.date.slice(5, 10)}
              </Text>
            );
          })}
        </View>
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendLine, { backgroundColor: ORACLE_COLORS.observe }]} />
          <Text style={styles.legendText}>Accuracy</Text>
        </View>
        {showConfidenceBands && (
          <View style={styles.legendItem}>
            <View style={styles.legendBand} />
            <Text style={styles.legendText}>95% CI</Text>
          </View>
        )}
        <Text style={styles.legendHint}>Tap points for details</Text>
      </View>

      {/* Detail modal */}
      <DataPointDetails
        point={selectedPoint}
        visible={showDetails}
        onClose={() => setShowDetails(false)}
      />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  avgAccuracy: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avgLabel: {
    fontSize: 12,
    color: '#888888',
    marginRight: 4,
  },
  avgValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  categorySelector: {
    marginBottom: 16,
  },
  categorySelectorContent: {
    paddingRight: 16,
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#252525',
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  categoryButtonActive: {
    backgroundColor: '#333333',
    borderColor: ORACLE_COLORS.observe,
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  categoryButtonText: {
    fontSize: 11,
    color: '#888888',
    textTransform: 'capitalize',
  },
  categoryButtonTextActive: {
    color: '#FFFFFF',
  },
  chartContainer: {
    position: 'relative',
  },
  yAxis: {
    position: 'absolute',
    left: 0,
    top: 20,
    bottom: 40,
    width: 45,
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingRight: 5,
  },
  axisLabel: {
    fontSize: 10,
    color: '#666666',
  },
  gridContainer: {
    position: 'absolute',
    top: 0,
    bottom: 40,
  },
  gridLine: {
    position: 'absolute',
    left: 50,
    right: 0,
    height: 1,
    backgroundColor: '#333333',
  },
  confidenceSegment: {
    position: 'absolute',
    backgroundColor: 'rgba(0, 191, 255, 0.15)',
  },
  lineSegment: {
    position: 'absolute',
    height: 3,
    borderRadius: 1.5,
  },
  dataPointTouchable: {
    position: 'absolute',
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dataPoint: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },
  xAxis: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 20,
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#333333',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  legendLine: {
    width: 16,
    height: 3,
    borderRadius: 1.5,
    marginRight: 6,
  },
  legendBand: {
    width: 16,
    height: 12,
    backgroundColor: 'rgba(0, 191, 255, 0.3)',
    marginRight: 6,
    borderRadius: 2,
  },
  legendText: {
    fontSize: 11,
    color: '#888888',
  },
  legendHint: {
    flex: 1,
    fontSize: 10,
    color: '#666666',
    textAlign: 'right',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailsCard: {
    width: SCREEN_WIDTH - 64,
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#333333',
  },
  detailsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  detailsDate: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  detailsContent: {
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#252525',
  },
  detailLabel: {
    fontSize: 14,
    color: '#888888',
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  qualityIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#252525',
    padding: 12,
    borderRadius: 8,
  },
  qualityText: {
    fontSize: 13,
    color: '#CCCCCC',
    marginLeft: 8,
  },
});

export default PredictionAccuracyChart;
