/**
 * CriticalPathDiagram Component
 * Story 7.10 - Gantt-like timeline with dependencies and critical path
 */
import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Animated,
  Dimensions,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { CriticalPath } from '@mission-control/shared-types';
import { ORACLE_COLORS, ORACLE_TIMING } from '../theme';

const { width } = Dimensions.get('window');
const TIMELINE_WIDTH = width * 1.5;
const ROW_HEIGHT = 48;

interface CriticalPathDiagramProps {
  criticalPath: CriticalPath;
}

interface PathStep {
  id: string;
  name: string;
  duration: number;
  start: number;
  isCritical: boolean;
  dependencies: string[];
}

export const CriticalPathDiagram: React.FC<CriticalPathDiagramProps> = ({
  criticalPath,
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: ORACLE_TIMING.fadeIn,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: ORACLE_TIMING.fadeIn,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Parse critical path data into steps
  const parseSteps = (): PathStep[] => {
    // Use path_steps if available, otherwise create from critical_nodes
    if (criticalPath.path_steps && Array.isArray(criticalPath.path_steps)) {
      return criticalPath.path_steps.map((step: any, index: number) => ({
        id: step.id || `step-${index}`,
        name: step.name || step.title || `Step ${index + 1}`,
        duration: step.duration || 1,
        start: step.start || index,
        isCritical: step.is_critical !== false,
        dependencies: step.dependencies || [],
      }));
    }

    if (criticalPath.critical_nodes && Array.isArray(criticalPath.critical_nodes)) {
      return criticalPath.critical_nodes.map((node: string, index: number) => ({
        id: `node-${index}`,
        name: node,
        duration: 1,
        start: index,
        isCritical: true,
        dependencies: index > 0 ? [`node-${index - 1}`] : [],
      }));
    }

    // Fallback mock data for demonstration
    return [
      { id: '1', name: 'Initial Setup', duration: 2, start: 0, isCritical: true, dependencies: [] },
      { id: '2', name: 'Design Phase', duration: 3, start: 2, isCritical: true, dependencies: ['1'] },
      { id: '3', name: 'Development', duration: 5, start: 5, isCritical: true, dependencies: ['2'] },
      { id: '4', name: 'Testing', duration: 2, start: 10, isCritical: true, dependencies: ['3'] },
      { id: '5', name: 'Review', duration: 2, start: 5, isCritical: false, dependencies: ['2'] },
    ];
  };

  const steps = parseSteps();
  const maxEnd = Math.max(...steps.map((s) => s.start + s.duration));
  const unitWidth = (TIMELINE_WIDTH - 100) / maxEnd;

  const renderTimelineHeader = () => {
    const units = Array.from({ length: Math.ceil(maxEnd) + 1 }, (_, i) => i);
    return (
      <View style={styles.timelineHeader}>
        <View style={styles.labelColumn} />
        <View style={styles.timelineScale}>
          {units.map((unit) => (
            <View
              key={unit}
              style={[styles.timeUnit, { width: unitWidth }]}
            >
              <Text style={styles.timeUnitText}>{unit}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const renderDependencyLines = (step: PathStep, index: number) => {
    // Draw lines from dependencies to this step
    return step.dependencies.map((depId) => {
      const depIndex = steps.findIndex((s) => s.id === depId);
      if (depIndex === -1) return null;

      const depStep = steps[depIndex];
      const startX = 100 + (depStep.start + depStep.duration) * unitWidth;
      const endX = 100 + step.start * unitWidth;
      const startY = depIndex * ROW_HEIGHT + ROW_HEIGHT / 2;
      const endY = index * ROW_HEIGHT + ROW_HEIGHT / 2;

      return (
        <View
          key={`${depId}-${step.id}`}
          style={[
            styles.dependencyLine,
            {
              left: startX,
              top: Math.min(startY, endY),
              width: Math.max(endX - startX, 1),
              height: Math.abs(endY - startY) + 2,
            },
          ]}
        >
          <View
            style={[
              styles.horizontalLine,
              { width: Math.max(endX - startX, 1) / 2 },
            ]}
          />
          <View
            style={[
              styles.verticalLine,
              { height: Math.abs(endY - startY) },
            ]}
          />
        </View>
      );
    });
  };

  const renderStep = (step: PathStep, index: number) => {
    const barWidth = step.duration * unitWidth;
    const barLeft = 100 + step.start * unitWidth;

    return (
      <View key={step.id} style={styles.stepRow}>
        <View style={styles.labelColumn}>
          <Text style={styles.stepLabel} numberOfLines={1}>
            {step.name}
          </Text>
        </View>
        <View style={styles.stepTimeline}>
          {renderDependencyLines(step, index)}
          <Animated.View
            style={[
              styles.stepBar,
              {
                left: barLeft - 100,
                width: barWidth,
                backgroundColor: step.isCritical ? ORACLE_COLORS.decide : '#444444',
                opacity: fadeAnim,
                transform: [
                  {
                    scaleX: fadeAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            <Text style={styles.stepBarText} numberOfLines={1}>
              {step.duration}d
            </Text>
          </Animated.View>
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
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <Ionicons name="git-network-outline" size={20} color={ORACLE_COLORS.decide} />
        <Text style={styles.headerTitle}>CRITICAL PATH</Text>
      </View>

      {/* Summary Stats */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>
            {criticalPath.total_duration || maxEnd}
          </Text>
          <Text style={styles.summaryLabel}>Total Duration</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{steps.length}</Text>
          <Text style={styles.summaryLabel}>Steps</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>
            {steps.filter((s) => s.isCritical).length}
          </Text>
          <Text style={styles.summaryLabel}>Critical</Text>
        </View>
      </View>

      {/* Gantt Chart */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chartContainer}
      >
        <View style={styles.chart}>
          {renderTimelineHeader()}
          <View style={styles.stepsContainer}>
            {steps.map((step, index) => renderStep(step, index))}
          </View>
        </View>
      </ScrollView>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: ORACLE_COLORS.decide }]} />
          <Text style={styles.legendText}>Critical Path</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: '#444444' }]} />
          <Text style={styles.legendText}>Non-Critical</Text>
        </View>
      </View>

      {/* Bottlenecks */}
      {criticalPath.bottlenecks && criticalPath.bottlenecks.length > 0 && (
        <View style={styles.bottlenecksSection}>
          <Text style={styles.sectionLabel}>BOTTLENECKS</Text>
          {criticalPath.bottlenecks.map((bottleneck: string, index: number) => (
            <View key={index} style={styles.bottleneckItem}>
              <Ionicons name="alert-circle" size={14} color="#FFA500" />
              <Text style={styles.bottleneckText}>{bottleneck}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Parallel Tracks */}
      {criticalPath.parallel_tracks && criticalPath.parallel_tracks.length > 0 && (
        <View style={styles.parallelSection}>
          <Text style={styles.sectionLabel}>PARALLEL TRACKS</Text>
          {criticalPath.parallel_tracks.map((track: string, index: number) => (
            <View key={index} style={styles.parallelItem}>
              <Ionicons name="git-branch" size={14} color="#00BFFF" />
              <Text style={styles.parallelText}>{track}</Text>
            </View>
          ))}
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
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: ORACLE_COLORS.decide,
    marginLeft: 8,
    letterSpacing: 1,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    marginBottom: 16,
    backgroundColor: '#0D0D0D',
    borderRadius: 8,
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  summaryLabel: {
    fontSize: 10,
    color: '#888888',
    marginTop: 2,
  },
  chartContainer: {
    paddingRight: 20,
  },
  chart: {
    width: TIMELINE_WIDTH,
  },
  timelineHeader: {
    flexDirection: 'row',
    height: 24,
    marginBottom: 8,
  },
  labelColumn: {
    width: 100,
  },
  timelineScale: {
    flexDirection: 'row',
    flex: 1,
  },
  timeUnit: {
    alignItems: 'center',
  },
  timeUnitText: {
    fontSize: 10,
    color: '#666666',
  },
  stepsContainer: {
    position: 'relative',
  },
  stepRow: {
    flexDirection: 'row',
    height: ROW_HEIGHT,
    alignItems: 'center',
  },
  stepLabel: {
    fontSize: 11,
    color: '#AAAAAA',
    paddingRight: 8,
  },
  stepTimeline: {
    flex: 1,
    height: ROW_HEIGHT,
    position: 'relative',
    borderLeftWidth: 1,
    borderLeftColor: '#333333',
  },
  stepBar: {
    position: 'absolute',
    top: (ROW_HEIGHT - 24) / 2,
    height: 24,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 30,
  },
  stepBarText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#000000',
  },
  dependencyLine: {
    position: 'absolute',
  },
  horizontalLine: {
    height: 2,
    backgroundColor: '#555555',
  },
  verticalLine: {
    width: 2,
    backgroundColor: '#555555',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#333333',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
  },
  legendColor: {
    width: 16,
    height: 8,
    borderRadius: 2,
    marginRight: 6,
  },
  legendText: {
    fontSize: 11,
    color: '#888888',
  },
  bottlenecksSection: {
    marginTop: 16,
  },
  sectionLabel: {
    fontSize: 10,
    color: '#888888',
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 8,
  },
  bottleneckItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 165, 0, 0.1)',
    padding: 10,
    borderRadius: 8,
    marginBottom: 6,
  },
  bottleneckText: {
    flex: 1,
    fontSize: 12,
    color: '#CCCCCC',
    marginLeft: 8,
  },
  parallelSection: {
    marginTop: 12,
  },
  parallelItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 191, 255, 0.1)',
    padding: 10,
    borderRadius: 8,
    marginBottom: 6,
  },
  parallelText: {
    flex: 1,
    fontSize: 12,
    color: '#CCCCCC',
    marginLeft: 8,
  },
});
