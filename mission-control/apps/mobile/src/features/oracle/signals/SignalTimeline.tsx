/**
 * SignalTimeline Component
 * Horizontal scrolling timeline with signals, milestones, and density heatmap
 */
import React, { useState, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Signal, UrgencyLevel } from '@mission-control/shared-types';
import { ORACLE_COLORS, getUrgencyColor } from '../theme';

// ============================================================================
// TYPES
// ============================================================================

export interface TimelineSignal {
  signal: Signal;
  position: number; // 0-100 percentage
  duration?: number; // percentage width
  isActive: boolean;
  isCritical: boolean;
}

export interface TimelineMilestone {
  id: string;
  name: string;
  date: string;
  position: number;
  relatedSignals: string[];
}

export interface DeadlineMarker {
  signalId: string;
  signalTitle: string;
  deadline: string;
  proximity: 'overdue' | 'critical' | 'warning' | 'upcoming' | 'distant';
  hoursRemaining: number;
}

export interface DensityPeriod {
  periodStart: string;
  periodEnd: string;
  signalCount: number;
  density: 'low' | 'medium' | 'high' | 'critical';
}

export interface SignalTimelineProps {
  startDate: string;
  endDate: string;
  signals: TimelineSignal[];
  milestones?: TimelineMilestone[];
  deadlines?: DeadlineMarker[];
  densityMap?: DensityPeriod[];
  onSignalPress: (signal: Signal) => void;
  onMilestonePress?: (milestone: TimelineMilestone) => void;
  onDateSelect?: (date: string) => void;
  showDensityHeatmap?: boolean;
  showMilestones?: boolean;
  showDeadlines?: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TIMELINE_HEIGHT = 200;
const TIMELINE_PADDING = 16;
const SIGNAL_ROW_HEIGHT = 50;
const MARKER_SIZE = 12;
const MIN_TIMELINE_WIDTH = SCREEN_WIDTH * 2;

const DENSITY_COLORS: Record<DensityPeriod['density'], string> = {
  low: '#1A1A1A',
  medium: '#2A3A2A',
  high: '#3A4A3A',
  critical: '#4A3A3A',
};

const PROXIMITY_COLORS: Record<DeadlineMarker['proximity'], string> = {
  overdue: '#FF4444',
  critical: '#FF6B6B',
  warning: '#FFD700',
  upcoming: '#00BFFF',
  distant: '#666666',
};

// ============================================================================
// COMPONENT
// ============================================================================

export const SignalTimeline: React.FC<SignalTimelineProps> = ({
  startDate,
  endDate,
  signals,
  milestones = [],
  deadlines = [],
  densityMap = [],
  onSignalPress,
  onMilestonePress,
  onDateSelect,
  showDensityHeatmap = true,
  showMilestones = true,
  showDeadlines = true,
}) => {
  // State
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [hoveredSignal, setHoveredSignal] = useState<string | null>(null);

  // Refs
  const scrollViewRef = useRef<ScrollView>(null);
  const timelineWidth = Math.max(MIN_TIMELINE_WIDTH, SCREEN_WIDTH * 2) * zoomLevel;

  // Parse dates
  const start = useMemo(() => new Date(startDate), [startDate]);
  const end = useMemo(() => new Date(endDate), [endDate]);
  const totalDuration = end.getTime() - start.getTime();

  // Generate date labels
  const dateLabels = useMemo(() => {
    const labels: Array<{ date: Date; label: string; position: number }> = [];
    const dayDuration = 24 * 60 * 60 * 1000;
    const totalDays = Math.ceil(totalDuration / dayDuration);
    const labelInterval = Math.max(1, Math.floor(totalDays / 10));

    for (let i = 0; i <= totalDays; i += labelInterval) {
      const date = new Date(start.getTime() + i * dayDuration);
      labels.push({
        date,
        label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        position: (i / totalDays) * 100,
      });
    }

    return labels;
  }, [start, totalDuration]);

  // Get position for a date
  const getPositionForDate = useCallback(
    (date: string) => {
      const d = new Date(date);
      return ((d.getTime() - start.getTime()) / totalDuration) * 100;
    },
    [start, totalDuration]
  );

  // Get date for position
  const getDateForPosition = useCallback(
    (position: number) => {
      const time = start.getTime() + (position / 100) * totalDuration;
      return new Date(time).toISOString();
    },
    [start, totalDuration]
  );

  // Handle zoom
  const handleZoomIn = useCallback(() => {
    setZoomLevel((prev) => Math.min(3, prev + 0.5));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoomLevel((prev) => Math.max(0.5, prev - 0.5));
  }, []);

  // Handle date selection
  const handleTimelinePress = useCallback(
    (event: any) => {
      const x = event.nativeEvent.locationX;
      const position = (x / timelineWidth) * 100;
      const date = getDateForPosition(position);
      setSelectedDate(date);
      onDateSelect?.(date);
    },
    [timelineWidth, getDateForPosition, onDateSelect]
  );

  // Scroll to today
  const scrollToToday = useCallback(() => {
    const today = new Date().toISOString();
    const position = getPositionForDate(today);
    const scrollX = (position / 100) * timelineWidth - SCREEN_WIDTH / 2;
    scrollViewRef.current?.scrollTo({ x: Math.max(0, scrollX), animated: true });
  }, [getPositionForDate, timelineWidth]);

  // Render density heatmap
  const renderDensityHeatmap = () => {
    if (!showDensityHeatmap || densityMap.length === 0) return null;

    return (
      <View style={styles.densityContainer}>
        {densityMap.map((period, index) => {
          const startPos = getPositionForDate(period.periodStart);
          const endPos = getPositionForDate(period.periodEnd);
          const width = ((endPos - startPos) / 100) * timelineWidth;

          return (
            <View
              key={index}
              style={[
                styles.densityBar,
                {
                  left: (startPos / 100) * timelineWidth,
                  width,
                  backgroundColor: DENSITY_COLORS[period.density],
                },
              ]}
            >
              {period.signalCount > 0 && (
                <Text style={styles.densityCount}>{period.signalCount}</Text>
              )}
            </View>
          );
        })}
      </View>
    );
  };

  // Render timeline axis
  const renderTimelineAxis = () => (
    <View style={[styles.timelineAxis, { width: timelineWidth }]}>
      {/* Main line */}
      <View style={styles.axisLine} />

      {/* Date labels */}
      {dateLabels.map((label, index) => (
        <View
          key={index}
          style={[
            styles.dateMarker,
            { left: (label.position / 100) * timelineWidth },
          ]}
        >
          <View style={styles.dateMarkerTick} />
          <Text style={styles.dateMarkerLabel}>{label.label}</Text>
        </View>
      ))}

      {/* Today marker */}
      {(() => {
        const todayPos = getPositionForDate(new Date().toISOString());
        if (todayPos >= 0 && todayPos <= 100) {
          return (
            <View
              style={[
                styles.todayMarker,
                { left: (todayPos / 100) * timelineWidth },
              ]}
            >
              <View style={styles.todayLine} />
              <Text style={styles.todayLabel}>Today</Text>
            </View>
          );
        }
        return null;
      })()}
    </View>
  );

  // Render signals
  const renderSignals = () => (
    <View style={[styles.signalsContainer, { width: timelineWidth }]}>
      {signals.map((item, index) => {
        const left = (item.position / 100) * timelineWidth;
        const width = item.duration
          ? (item.duration / 100) * timelineWidth
          : MARKER_SIZE;
        const urgencyColor = getUrgencyColor(item.signal.urgency);
        const isHovered = hoveredSignal === item.signal.id;

        return (
          <TouchableOpacity
            key={item.signal.id}
            style={[
              styles.signalMarker,
              {
                left,
                width: Math.max(MARKER_SIZE, width),
                top: (index % 3) * 20 + 10,
                backgroundColor: urgencyColor,
                opacity: item.isActive ? 1 : 0.5,
              },
              isHovered && styles.signalMarkerHovered,
            ]}
            onPress={() => onSignalPress(item.signal)}
            onPressIn={() => setHoveredSignal(item.signal.id)}
            onPressOut={() => setHoveredSignal(null)}
          >
            {item.isCritical && (
              <View style={styles.criticalIndicator}>
                <Ionicons name="alert" size={8} color="#FFFFFF" />
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );

  // Render milestones
  const renderMilestones = () => {
    if (!showMilestones || milestones.length === 0) return null;

    return (
      <View style={[styles.milestonesContainer, { width: timelineWidth }]}>
        {milestones.map((milestone) => {
          const left = (milestone.position / 100) * timelineWidth;

          return (
            <TouchableOpacity
              key={milestone.id}
              style={[styles.milestoneMarker, { left }]}
              onPress={() => onMilestonePress?.(milestone)}
            >
              <View style={styles.milestoneDiamond} />
              <Text style={styles.milestoneLabel} numberOfLines={1}>
                {milestone.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  // Render deadline markers
  const renderDeadlines = () => {
    if (!showDeadlines || deadlines.length === 0) return null;

    return (
      <View style={[styles.deadlinesContainer, { width: timelineWidth }]}>
        {deadlines.map((deadline) => {
          const position = getPositionForDate(deadline.deadline);
          const left = (position / 100) * timelineWidth;
          const color = PROXIMITY_COLORS[deadline.proximity];

          return (
            <View key={deadline.signalId} style={[styles.deadlineMarker, { left }]}>
              <View style={[styles.deadlineLine, { backgroundColor: color }]} />
              <View style={[styles.deadlineFlag, { backgroundColor: color }]}>
                <Ionicons
                  name={
                    deadline.proximity === 'overdue'
                      ? 'alert'
                      : deadline.proximity === 'critical'
                      ? 'warning'
                      : 'flag'
                  }
                  size={10}
                  color="#000000"
                />
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  // Render signal tooltip
  const renderHoveredSignalTooltip = () => {
    if (!hoveredSignal) return null;

    const signal = signals.find((s) => s.signal.id === hoveredSignal);
    if (!signal) return null;

    const left = (signal.position / 100) * timelineWidth;

    return (
      <View style={[styles.signalTooltip, { left: left - 75 }]}>
        <Text style={styles.signalTooltipTitle} numberOfLines={1}>
          {signal.signal.title}
        </Text>
        <View style={styles.signalTooltipMeta}>
          <View
            style={[
              styles.signalTooltipBadge,
              { backgroundColor: getUrgencyColor(signal.signal.urgency) },
            ]}
          >
            <Text style={styles.signalTooltipBadgeText}>
              {signal.signal.urgency}
            </Text>
          </View>
          <Text style={styles.signalTooltipDate}>
            {new Date(signal.signal.created_at).toLocaleDateString()}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>TIMELINE</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerButton} onPress={scrollToToday}>
            <Ionicons name="today-outline" size={18} color={ORACLE_COLORS.observe} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton} onPress={handleZoomOut}>
            <Ionicons name="remove-outline" size={18} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.zoomText}>{Math.round(zoomLevel * 100)}%</Text>
          <TouchableOpacity style={styles.headerButton} onPress={handleZoomIn}>
            <Ionicons name="add-outline" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#FF4444' }]} />
          <Text style={styles.legendText}>Critical</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#FF9500' }]} />
          <Text style={styles.legendText}>High</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#FFD700' }]} />
          <Text style={styles.legendText}>Medium</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#00FF88' }]} />
          <Text style={styles.legendText}>Low</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={styles.legendDiamond} />
          <Text style={styles.legendText}>Milestone</Text>
        </View>
      </View>

      {/* Timeline ScrollView */}
      <ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={true}
        style={styles.timelineScroll}
        contentContainerStyle={[
          styles.timelineContent,
          { width: timelineWidth },
        ]}
      >
        <View style={styles.timelineWrapper}>
          {/* Density Heatmap */}
          {renderDensityHeatmap()}

          {/* Milestones */}
          {renderMilestones()}

          {/* Deadlines */}
          {renderDeadlines()}

          {/* Signals */}
          {renderSignals()}

          {/* Hovered Signal Tooltip */}
          {renderHoveredSignalTooltip()}

          {/* Timeline Axis */}
          {renderTimelineAxis()}
        </View>
      </ScrollView>

      {/* Date Range Info */}
      <View style={styles.dateRange}>
        <Text style={styles.dateRangeText}>
          {start.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </Text>
        <Ionicons name="arrow-forward" size={14} color="#666666" />
        <Text style={styles.dateRangeText}>
          {end.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </Text>
      </View>

      {/* Signal Stats */}
      <View style={styles.stats}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{signals.length}</Text>
          <Text style={styles.statLabel}>Total Signals</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            {signals.filter((s) => s.isActive).length}
          </Text>
          <Text style={styles.statLabel}>Active</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            {signals.filter((s) => s.isCritical).length}
          </Text>
          <Text style={styles.statLabel}>Critical</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{milestones.length}</Text>
          <Text style={styles.statLabel}>Milestones</Text>
        </View>
      </View>
    </View>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#222222',
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: ORACLE_COLORS.observe,
    letterSpacing: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomText: {
    fontSize: 12,
    color: '#888888',
    minWidth: 40,
    textAlign: 'center',
  },
  legend: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 16,
    flexWrap: 'wrap',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendDiamond: {
    width: 8,
    height: 8,
    backgroundColor: '#FFD700',
    transform: [{ rotate: '45deg' }],
  },
  legendText: {
    fontSize: 10,
    color: '#888888',
  },
  timelineScroll: {
    flex: 1,
  },
  timelineContent: {
    minHeight: TIMELINE_HEIGHT + 100,
  },
  timelineWrapper: {
    flex: 1,
    paddingTop: 20,
    paddingBottom: 40,
  },
  densityContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 24,
    flexDirection: 'row',
  },
  densityBar: {
    position: 'absolute',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  densityCount: {
    fontSize: 9,
    color: '#888888',
  },
  milestonesContainer: {
    position: 'absolute',
    top: 30,
    left: 0,
    height: 40,
  },
  milestoneMarker: {
    position: 'absolute',
    alignItems: 'center',
    width: 60,
    marginLeft: -30,
  },
  milestoneDiamond: {
    width: 10,
    height: 10,
    backgroundColor: '#FFD700',
    transform: [{ rotate: '45deg' }],
    marginBottom: 4,
  },
  milestoneLabel: {
    fontSize: 9,
    color: '#CCCCCC',
    textAlign: 'center',
  },
  deadlinesContainer: {
    position: 'absolute',
    top: 30,
    left: 0,
    height: 100,
  },
  deadlineMarker: {
    position: 'absolute',
    alignItems: 'center',
  },
  deadlineLine: {
    width: 2,
    height: 80,
  },
  deadlineFlag: {
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  signalsContainer: {
    position: 'absolute',
    top: 80,
    left: 0,
    height: 80,
  },
  signalMarker: {
    position: 'absolute',
    height: MARKER_SIZE,
    borderRadius: MARKER_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  signalMarkerHovered: {
    transform: [{ scale: 1.3 }],
    zIndex: 10,
  },
  criticalIndicator: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  signalTooltip: {
    position: 'absolute',
    top: -50,
    width: 150,
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#333333',
    zIndex: 100,
  },
  signalTooltipTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  signalTooltipMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  signalTooltipBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  signalTooltipBadgeText: {
    fontSize: 9,
    color: '#000000',
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  signalTooltipDate: {
    fontSize: 9,
    color: '#888888',
  },
  timelineAxis: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    height: 40,
  },
  axisLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#333333',
  },
  dateMarker: {
    position: 'absolute',
    alignItems: 'center',
  },
  dateMarkerTick: {
    width: 1,
    height: 8,
    backgroundColor: '#666666',
  },
  dateMarkerLabel: {
    fontSize: 10,
    color: '#888888',
    marginTop: 4,
  },
  todayMarker: {
    position: 'absolute',
    alignItems: 'center',
    top: -130,
    zIndex: 50,
  },
  todayLine: {
    width: 2,
    height: 140,
    backgroundColor: ORACLE_COLORS.observe,
  },
  todayLabel: {
    fontSize: 10,
    color: ORACLE_COLORS.observe,
    fontWeight: 'bold',
    marginTop: 4,
  },
  dateRange: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#222222',
  },
  dateRangeText: {
    fontSize: 12,
    color: '#CCCCCC',
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#0A0A0A',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  statLabel: {
    fontSize: 10,
    color: '#888888',
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});

export default SignalTimeline;
