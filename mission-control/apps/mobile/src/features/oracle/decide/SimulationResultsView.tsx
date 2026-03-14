/**
 * SimulationResultsView Component
 * Story 7.9 - Monte Carlo distribution visualization
 */
import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  Dimensions,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { DecisionOption, SimulationResult } from '@mission-control/shared-types';
import { ORACLE_COLORS, ORACLE_TIMING } from '../theme';

const { width } = Dimensions.get('window');
const CHART_WIDTH = width - 80;
const CHART_HEIGHT = 120;
const BAR_COUNT = 20;

interface SimulationResultsViewProps {
  option: DecisionOption;
  simulation?: SimulationResult;
  onClose: () => void;
}

export const SimulationResultsView: React.FC<SimulationResultsViewProps> = ({
  option,
  simulation,
  onClose,
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const barAnims = useRef(
    Array.from({ length: BAR_COUNT }, () => new Animated.Value(0))
  ).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: ORACLE_TIMING.fadeIn,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 65,
        friction: 10,
        useNativeDriver: true,
      }),
    ]).start();

    // Animate bars
    if (simulation) {
      const staggeredAnims = barAnims.map((anim, index) =>
        Animated.timing(anim, {
          toValue: 1,
          duration: 300,
          delay: index * 30,
          useNativeDriver: true,
        })
      );
      Animated.stagger(30, staggeredAnims).start();
    }
  }, [simulation]);

  // Generate histogram data from simulation
  const getHistogramBars = () => {
    if (!simulation || !simulation.distribution) {
      // Generate placeholder bars for visual effect
      return Array.from({ length: BAR_COUNT }, (_, i) => {
        const center = BAR_COUNT / 2;
        const distance = Math.abs(i - center);
        const height = Math.exp(-distance * 0.3) * 0.9 + 0.1;
        return height;
      });
    }

    // Use distribution data if available
    const dist = simulation.distribution as number[];
    if (Array.isArray(dist) && dist.length > 0) {
      const maxVal = Math.max(...dist);
      return dist.slice(0, BAR_COUNT).map((v) => v / maxVal);
    }

    return Array.from({ length: BAR_COUNT }, () => Math.random() * 0.8 + 0.2);
  };

  const histogramBars = getHistogramBars();

  const renderPercentileMarker = (
    label: string,
    value: number | undefined,
    position: number,
    color: string
  ) => {
    if (value === undefined) return null;

    return (
      <View style={[styles.percentileMarker, { left: `${position}%` }]}>
        <View style={[styles.percentileLine, { backgroundColor: color }]} />
        <View style={[styles.percentileLabel, { backgroundColor: color }]}>
          <Text style={styles.percentileLabelText}>{label}</Text>
          <Text style={styles.percentileValue}>{value.toFixed(1)}</Text>
        </View>
      </View>
    );
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Ionicons name="analytics" size={20} color={ORACLE_COLORS.decide} />
          <Text style={styles.headerTitle}>SIMULATION RESULTS</Text>
        </View>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Ionicons name="close" size={20} color="#888888" />
        </TouchableOpacity>
      </View>

      {/* Option Info */}
      <View style={styles.optionInfo}>
        <Text style={styles.optionTitle}>{option.title}</Text>
        {simulation?.iterations && (
          <Text style={styles.iterationsText}>
            {simulation.iterations.toLocaleString()} simulations
          </Text>
        )}
      </View>

      {/* Distribution Chart */}
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>OUTCOME DISTRIBUTION</Text>

        <View style={styles.chart}>
          {histogramBars.map((height, index) => (
            <Animated.View
              key={index}
              style={[
                styles.bar,
                {
                  height: height * CHART_HEIGHT,
                  opacity: barAnims[index],
                  transform: [
                    {
                      scaleY: barAnims[index].interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, 1],
                      }),
                    },
                  ],
                },
              ]}
            />
          ))}
        </View>

        {/* Percentile Markers */}
        {simulation?.percentiles && (
          <View style={styles.percentileContainer}>
            {renderPercentileMarker('P5', simulation.percentiles.p5, 10, '#FF6B6B')}
            {renderPercentileMarker('P50', simulation.percentiles.p50, 50, ORACLE_COLORS.decide)}
            {renderPercentileMarker('P95', simulation.percentiles.p95, 90, '#00FF88')}
          </View>
        )}
      </View>

      {/* Statistics Grid */}
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>MEAN</Text>
          <Text style={styles.statValue}>
            {simulation?.mean?.toFixed(2) || '-'}
          </Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>STD DEV</Text>
          <Text style={styles.statValue}>
            {simulation?.std_deviation?.toFixed(2) || '-'}
          </Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>MIN</Text>
          <Text style={[styles.statValue, { color: '#FF6B6B' }]}>
            {simulation?.percentiles?.p5?.toFixed(2) || '-'}
          </Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>MAX</Text>
          <Text style={[styles.statValue, { color: '#00FF88' }]}>
            {simulation?.percentiles?.p95?.toFixed(2) || '-'}
          </Text>
        </View>
      </View>

      {/* Confidence Intervals */}
      <View style={styles.confidenceSection}>
        <Text style={styles.sectionLabel}>CONFIDENCE INTERVALS</Text>

        <View style={styles.intervalRow}>
          <Text style={styles.intervalLabel}>50% CI</Text>
          <View style={styles.intervalBar}>
            <View style={[styles.intervalFill, styles.interval50]} />
          </View>
          <Text style={styles.intervalRange}>
            {simulation?.percentiles?.p25?.toFixed(1) || '-'} - {simulation?.percentiles?.p75?.toFixed(1) || '-'}
          </Text>
        </View>

        <View style={styles.intervalRow}>
          <Text style={styles.intervalLabel}>90% CI</Text>
          <View style={styles.intervalBar}>
            <View style={[styles.intervalFill, styles.interval90]} />
          </View>
          <Text style={styles.intervalRange}>
            {simulation?.percentiles?.p5?.toFixed(1) || '-'} - {simulation?.percentiles?.p95?.toFixed(1) || '-'}
          </Text>
        </View>
      </View>

      {/* Risk Assessment */}
      {simulation && (
        <View style={styles.riskSection}>
          <View style={styles.riskItem}>
            <Ionicons name="trending-down" size={16} color="#FF6B6B" />
            <Text style={styles.riskLabel}>Downside Risk</Text>
            <Text style={[styles.riskValue, { color: '#FF6B6B' }]}>
              {((simulation.percentiles?.p5 || 0) / (simulation.mean || 1) * 100).toFixed(0)}%
            </Text>
          </View>
          <View style={styles.riskItem}>
            <Ionicons name="trending-up" size={16} color="#00FF88" />
            <Text style={styles.riskLabel}>Upside Potential</Text>
            <Text style={[styles.riskValue, { color: '#00FF88' }]}>
              {((simulation.percentiles?.p95 || 0) / (simulation.mean || 1) * 100).toFixed(0)}%
            </Text>
          </View>
        </View>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: ORACLE_COLORS.decide,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: ORACLE_COLORS.decide,
    marginLeft: 8,
    letterSpacing: 1,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#333333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionInfo: {
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  iterationsText: {
    fontSize: 12,
    color: '#888888',
  },
  chartContainer: {
    marginBottom: 20,
  },
  chartTitle: {
    fontSize: 10,
    color: '#888888',
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 12,
  },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: CHART_HEIGHT,
    backgroundColor: '#0D0D0D',
    borderRadius: 8,
    padding: 8,
  },
  bar: {
    flex: 1,
    backgroundColor: ORACLE_COLORS.decide,
    marginHorizontal: 1,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
    opacity: 0.8,
  },
  percentileContainer: {
    position: 'relative',
    height: 40,
    marginTop: 8,
  },
  percentileMarker: {
    position: 'absolute',
    alignItems: 'center',
    transform: [{ translateX: -20 }],
  },
  percentileLine: {
    width: 2,
    height: 12,
    marginBottom: 4,
  },
  percentileLabel: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  percentileLabelText: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#000000',
    textAlign: 'center',
  },
  percentileValue: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#000000',
    textAlign: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  statCard: {
    width: '25%',
    alignItems: 'center',
    paddingVertical: 12,
  },
  statLabel: {
    fontSize: 9,
    color: '#888888',
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  confidenceSection: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 10,
    color: '#888888',
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 12,
  },
  intervalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  intervalLabel: {
    fontSize: 11,
    color: '#AAAAAA',
    width: 50,
  },
  intervalBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#333333',
    borderRadius: 4,
    marginHorizontal: 10,
    overflow: 'hidden',
  },
  intervalFill: {
    height: '100%',
    borderRadius: 4,
  },
  interval50: {
    width: '50%',
    marginLeft: '25%',
    backgroundColor: ORACLE_COLORS.decide,
  },
  interval90: {
    width: '90%',
    marginLeft: '5%',
    backgroundColor: 'rgba(255, 107, 107, 0.5)',
  },
  intervalRange: {
    fontSize: 11,
    color: '#888888',
    width: 80,
    textAlign: 'right',
  },
  riskSection: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#333333',
  },
  riskItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  riskLabel: {
    fontSize: 11,
    color: '#888888',
    marginLeft: 6,
    marginRight: 8,
  },
  riskValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
});
