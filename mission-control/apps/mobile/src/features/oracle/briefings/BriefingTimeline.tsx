/**
 * BriefingTimeline Component
 * Timeline view of events and tasks with progress indicators
 */
import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Animated,
  Easing,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ORACLE_COLORS } from '../../../store/oracle';

const { width } = Dimensions.get('window');

// ============================================================================
// Types
// ============================================================================

export type TimelineItemType = 'meeting' | 'task' | 'deadline' | 'milestone' | 'event' | 'break' | 'now';
export type TimelineItemStatus = 'completed' | 'in_progress' | 'upcoming' | 'overdue' | 'skipped';

export interface TimelineItem {
  id: string;
  type: TimelineItemType;
  title: string;
  time: string;
  endTime?: string;
  description?: string;
  status: TimelineItemStatus;
  priority?: 'critical' | 'high' | 'medium' | 'low';
  location?: string;
  attendees?: number;
  progress?: number;
  project?: string;
}

interface BriefingTimelineProps {
  items: TimelineItem[];
  showNowIndicator?: boolean;
  onItemPress?: (item: TimelineItem) => void;
}

// ============================================================================
// Type Configuration
// ============================================================================

const TYPE_CONFIG: Record<TimelineItemType, { icon: string; color: string }> = {
  meeting: { icon: 'people', color: ORACLE_COLORS.observe },
  task: { icon: 'checkbox', color: ORACLE_COLORS.act },
  deadline: { icon: 'alarm', color: '#FF6B6B' },
  milestone: { icon: 'flag', color: ORACLE_COLORS.orient },
  event: { icon: 'calendar', color: '#9C27B0' },
  break: { icon: 'cafe', color: '#607D8B' },
  now: { icon: 'radio-button-on', color: ORACLE_COLORS.decide },
};

const STATUS_CONFIG: Record<TimelineItemStatus, { opacity: number; lineColor: string }> = {
  completed: { opacity: 0.6, lineColor: ORACLE_COLORS.act },
  in_progress: { opacity: 1, lineColor: ORACLE_COLORS.observe },
  upcoming: { opacity: 1, lineColor: '#555' },
  overdue: { opacity: 1, lineColor: '#FF6B6B' },
  skipped: { opacity: 0.4, lineColor: '#333' },
};

// ============================================================================
// Timeline Item Component
// ============================================================================

interface TimelineItemCardProps {
  item: TimelineItem;
  isFirst: boolean;
  isLast: boolean;
  index: number;
  onPress?: () => void;
}

const TimelineItemCard: React.FC<TimelineItemCardProps> = ({
  item,
  isFirst,
  isLast,
  index,
  onPress,
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  const typeConfig = TYPE_CONFIG[item.type];
  const statusConfig = STATUS_CONFIG[item.status];

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        delay: index * 80,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        delay: index * 80,
        useNativeDriver: true,
      }),
    ]).start();

    // Animate progress if present
    if (item.progress !== undefined) {
      Animated.timing(progressAnim, {
        toValue: item.progress / 100,
        duration: 800,
        delay: index * 80 + 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    }
  }, [index, item.progress]);

  const formatTime = (timeStr: string): string => {
    const date = new Date(timeStr);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const getDuration = (): string | null => {
    if (!item.endTime) return null;
    const start = new Date(item.time);
    const end = new Date(item.endTime);
    const diffMinutes = Math.round((end.getTime() - start.getTime()) / 60000);
    if (diffMinutes < 60) return `${diffMinutes}m`;
    const hours = Math.floor(diffMinutes / 60);
    const mins = diffMinutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <Animated.View
      style={[
        styles.timelineItem,
        {
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      {/* Timeline Line */}
      <View style={styles.timelineTrack}>
        {!isFirst && (
          <View
            style={[
              styles.lineTop,
              { backgroundColor: statusConfig.lineColor },
            ]}
          />
        )}
        <View
          style={[
            styles.dot,
            { backgroundColor: typeConfig.color },
            item.status === 'completed' && styles.dotCompleted,
          ]}
        >
          {item.status === 'completed' && (
            <Ionicons name="checkmark" size={12} color="#FFF" />
          )}
          {item.status === 'in_progress' && (
            <Animated.View
              style={[
                styles.dotPulse,
                { backgroundColor: typeConfig.color },
              ]}
            />
          )}
        </View>
        {!isLast && (
          <View
            style={[
              styles.lineBottom,
              { backgroundColor: '#555' },
            ]}
          />
        )}
      </View>

      {/* Content Card */}
      <TouchableOpacity
        style={[
          styles.cardContainer,
          { opacity: statusConfig.opacity },
          item.status === 'in_progress' && styles.cardActive,
        ]}
        onPress={onPress}
        activeOpacity={onPress ? 0.7 : 1}
        disabled={!onPress}
      >
        {/* Time Badge */}
        <View style={styles.timeBadge}>
          <Text style={styles.timeText}>{formatTime(item.time)}</Text>
          {getDuration() && (
            <Text style={styles.durationText}>{getDuration()}</Text>
          )}
        </View>

        {/* Card Content */}
        <View style={styles.cardContent}>
          <View style={styles.cardHeader}>
            <View style={[styles.typeIcon, { backgroundColor: `${typeConfig.color}20` }]}>
              <Ionicons name={typeConfig.icon as any} size={14} color={typeConfig.color} />
            </View>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {item.title}
            </Text>
            {item.priority === 'critical' && (
              <View style={styles.criticalBadge}>
                <Text style={styles.criticalText}>!</Text>
              </View>
            )}
          </View>

          {item.description && (
            <Text style={styles.cardDescription} numberOfLines={2}>
              {item.description}
            </Text>
          )}

          {/* Metadata Row */}
          <View style={styles.metadataRow}>
            {item.location && (
              <View style={styles.metadataItem}>
                <Ionicons name="location" size={12} color="#888" />
                <Text style={styles.metadataText}>{item.location}</Text>
              </View>
            )}
            {item.attendees !== undefined && (
              <View style={styles.metadataItem}>
                <Ionicons name="people" size={12} color="#888" />
                <Text style={styles.metadataText}>{item.attendees}</Text>
              </View>
            )}
            {item.project && (
              <View style={styles.metadataItem}>
                <Ionicons name="folder" size={12} color="#888" />
                <Text style={styles.metadataText}>{item.project}</Text>
              </View>
            )}
          </View>

          {/* Progress Bar */}
          {item.progress !== undefined && (
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <Animated.View
                  style={[
                    styles.progressFill,
                    {
                      width: progressWidth,
                      backgroundColor: item.status === 'overdue' ? '#FF6B6B' : typeConfig.color,
                    },
                  ]}
                />
              </View>
              <Text style={styles.progressText}>{item.progress}%</Text>
            </View>
          )}
        </View>

        {/* Status Indicator */}
        {item.status === 'overdue' && (
          <View style={styles.overdueIndicator}>
            <Ionicons name="alert" size={14} color="#FF6B6B" />
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

// ============================================================================
// Now Indicator Component
// ============================================================================

const NowIndicator: React.FC = () => {
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const opacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.5, 1],
  });

  const scale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.2],
  });

  return (
    <View style={styles.nowIndicator}>
      <View style={styles.nowLine} />
      <View style={styles.nowBadge}>
        <Animated.View style={[styles.nowPulse, { opacity, transform: [{ scale }] }]} />
        <Text style={styles.nowText}>NOW</Text>
      </View>
      <View style={styles.nowLine} />
    </View>
  );
};

// ============================================================================
// Main BriefingTimeline Component
// ============================================================================

export const BriefingTimeline: React.FC<BriefingTimelineProps> = ({
  items,
  showNowIndicator = true,
  onItemPress,
}) => {
  // Sort items by time
  const sortedItems = [...items].sort((a, b) =>
    new Date(a.time).getTime() - new Date(b.time).getTime()
  );

  // Find where to insert "now" indicator
  const now = new Date();
  let nowIndex = sortedItems.findIndex(
    (item) => new Date(item.time).getTime() > now.getTime()
  );
  if (nowIndex === -1) nowIndex = sortedItems.length;

  // Render items with now indicator
  const renderItems = () => {
    const elements: JSX.Element[] = [];

    sortedItems.forEach((item, index) => {
      // Insert now indicator before this item if needed
      if (showNowIndicator && index === nowIndex) {
        elements.push(<NowIndicator key="now-indicator" />);
      }

      elements.push(
        <TimelineItemCard
          key={item.id}
          item={item}
          isFirst={index === 0}
          isLast={index === sortedItems.length - 1}
          index={index}
          onPress={onItemPress ? () => onItemPress(item) : undefined}
        />
      );
    });

    // Add now indicator at the end if all items are in the past
    if (showNowIndicator && nowIndex === sortedItems.length) {
      elements.push(<NowIndicator key="now-indicator" />);
    }

    return elements;
  };

  if (sortedItems.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Ionicons name="calendar-outline" size={48} color="#444" />
        <Text style={styles.emptyText}>No events scheduled</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.timeline}>{renderItems()}</View>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
};

// ============================================================================
// Compact Timeline Component
// ============================================================================

interface CompactTimelineProps {
  items: TimelineItem[];
  maxItems?: number;
  onSeeMore?: () => void;
}

export const CompactTimeline: React.FC<CompactTimelineProps> = ({
  items,
  maxItems = 3,
  onSeeMore,
}) => {
  const sortedItems = [...items]
    .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
    .slice(0, maxItems);

  const formatTime = (timeStr: string): string => {
    const date = new Date(timeStr);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  return (
    <View style={styles.compactContainer}>
      {sortedItems.map((item, index) => {
        const typeConfig = TYPE_CONFIG[item.type];
        return (
          <View key={item.id} style={styles.compactItem}>
            <View style={[styles.compactDot, { backgroundColor: typeConfig.color }]} />
            <Text style={styles.compactTime}>{formatTime(item.time)}</Text>
            <Text style={styles.compactTitle} numberOfLines={1}>
              {item.title}
            </Text>
          </View>
        );
      })}
      {items.length > maxItems && onSeeMore && (
        <TouchableOpacity style={styles.seeMoreButton} onPress={onSeeMore}>
          <Text style={styles.seeMoreText}>+{items.length - maxItems} more</Text>
          <Ionicons name="chevron-forward" size={14} color={ORACLE_COLORS.observe} />
        </TouchableOpacity>
      )}
    </View>
  );
};

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  timeline: {
    paddingLeft: 16,
    paddingRight: 16,
    paddingTop: 8,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  timelineTrack: {
    width: 24,
    alignItems: 'center',
    marginRight: 12,
  },
  lineTop: {
    width: 2,
    flex: 1,
    minHeight: 20,
  },
  lineBottom: {
    width: 2,
    flex: 1,
    minHeight: 20,
  },
  dot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dotCompleted: {
    backgroundColor: ORACLE_COLORS.act,
  },
  dotPulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  cardContainer: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#333',
  },
  cardActive: {
    borderColor: ORACLE_COLORS.observe,
  },
  timeBadge: {
    marginRight: 12,
    alignItems: 'flex-end',
    minWidth: 50,
  },
  timeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFF',
  },
  durationText: {
    fontSize: 11,
    color: '#888',
    marginTop: 2,
  },
  cardContent: {
    flex: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  typeIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  cardTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
  criticalBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FF6B6B',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  criticalText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFF',
  },
  cardDescription: {
    fontSize: 12,
    color: '#888',
    marginBottom: 6,
  },
  metadataRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  metadataItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
    marginTop: 4,
  },
  metadataText: {
    fontSize: 11,
    color: '#888',
    marginLeft: 4,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  progressBar: {
    flex: 1,
    height: 4,
    backgroundColor: '#333',
    borderRadius: 2,
    overflow: 'hidden',
    marginRight: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 11,
    color: '#888',
    width: 35,
    textAlign: 'right',
  },
  overdueIndicator: {
    marginLeft: 8,
  },
  // Now indicator styles
  nowIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
  },
  nowLine: {
    flex: 1,
    height: 1,
    backgroundColor: ORACLE_COLORS.decide,
  },
  nowBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ORACLE_COLORS.decide,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginHorizontal: 8,
  },
  nowPulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFF',
    marginRight: 6,
  },
  nowText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFF',
    letterSpacing: 1,
  },
  // Empty state
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
  },
  // Compact styles
  compactContainer: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 12,
  },
  compactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  compactDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 10,
  },
  compactTime: {
    fontSize: 12,
    color: '#888',
    width: 60,
  },
  compactTitle: {
    flex: 1,
    fontSize: 14,
    color: '#FFF',
  },
  seeMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 12,
  },
  seeMoreText: {
    fontSize: 13,
    color: ORACLE_COLORS.observe,
    marginRight: 4,
  },
});

export default BriefingTimeline;
