/**
 * BriefingCard Component
 * Individual briefing section card with expand/collapse animations
 */
import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  Easing,
  StyleSheet,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ORACLE_COLORS } from '../../../store/oracle';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ============================================================================
// Types
// ============================================================================

export type BriefingSectionType =
  | 'priorities'
  | 'meetings'
  | 'deadlines'
  | 'risks'
  | 'accomplishments'
  | 'pending'
  | 'metrics'
  | 'weather'
  | 'traffic'
  | 'recommendations'
  | 'goals'
  | 'trends'
  | 'health_scores'
  | 'critical_issues'
  | 'resources'
  | 'escalations'
  | 'kpis'
  | 'decisions'
  | 'stakeholders'
  | 'custom';

export type PriorityLevel = 'critical' | 'high' | 'medium' | 'low';

export interface BriefingSectionData {
  type: BriefingSectionType;
  title: string;
  content: string | string[];
  data?: any;
  metadata?: {
    count?: number;
    priority?: string;
    timestamp?: string;
  };
}

interface BriefingCardProps {
  section: BriefingSectionData;
  index: number;
  initiallyExpanded?: boolean;
  highlight?: boolean;
  onItemPress?: (item: any, index: number) => void;
}

// ============================================================================
// Section Configuration
// ============================================================================

const SECTION_CONFIG: Record<BriefingSectionType, { icon: string; color: string }> = {
  priorities: { icon: 'flag', color: ORACLE_COLORS.decide },
  meetings: { icon: 'calendar', color: ORACLE_COLORS.observe },
  deadlines: { icon: 'alarm', color: '#FF6B6B' },
  risks: { icon: 'warning', color: '#FFA500' },
  accomplishments: { icon: 'trophy', color: ORACLE_COLORS.act },
  pending: { icon: 'hourglass', color: '#9E9E9E' },
  metrics: { icon: 'stats-chart', color: ORACLE_COLORS.orient },
  weather: { icon: 'partly-sunny', color: '#87CEEB' },
  traffic: { icon: 'car', color: '#607D8B' },
  recommendations: { icon: 'bulb', color: '#FFD700' },
  goals: { icon: 'trending-up', color: ORACLE_COLORS.act },
  trends: { icon: 'analytics', color: ORACLE_COLORS.observe },
  health_scores: { icon: 'pulse', color: '#4CAF50' },
  critical_issues: { icon: 'alert-circle', color: '#F44336' },
  resources: { icon: 'cube', color: '#9C27B0' },
  escalations: { icon: 'megaphone', color: '#E91E63' },
  kpis: { icon: 'speedometer', color: ORACLE_COLORS.orient },
  decisions: { icon: 'git-branch', color: ORACLE_COLORS.decide },
  stakeholders: { icon: 'people', color: '#00BCD4' },
  custom: { icon: 'document-text', color: '#9E9E9E' },
};

// ============================================================================
// BriefingCard Component
// ============================================================================

export const BriefingCard: React.FC<BriefingCardProps> = ({
  section,
  index,
  initiallyExpanded = false,
  highlight = false,
  onItemPress,
}) => {
  const [expanded, setExpanded] = useState(initiallyExpanded);

  // Animation values
  const revealAnim = useRef(new Animated.Value(0)).current;
  const highlightAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(expanded ? 1 : 0)).current;
  const contentHeight = useRef(new Animated.Value(expanded ? 1 : 0)).current;

  const config = SECTION_CONFIG[section.type] || SECTION_CONFIG.custom;
  const items = Array.isArray(section.content) ? section.content : [section.content];

  // Reveal animation on mount
  useEffect(() => {
    Animated.timing(revealAnim, {
      toValue: 1,
      duration: 400,
      delay: index * 100,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [index]);

  // Highlight animation for priority items
  useEffect(() => {
    if (highlight) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(highlightAnim, {
            toValue: 1,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
          Animated.timing(highlightAnim, {
            toValue: 0,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
        ])
      ).start();
    }
  }, [highlight]);

  const toggleExpanded = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(!expanded);

    Animated.spring(rotateAnim, {
      toValue: expanded ? 0 : 1,
      friction: 8,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };

  const translateY = revealAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [30, 0],
  });

  const rotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const highlightBorderColor = highlightAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(0,0,0,0)', config.color],
  });

  const getPriorityIndicator = (text: string): PriorityLevel | null => {
    const upper = text.toUpperCase();
    if (upper.includes('[CRITICAL]') || upper.includes('[!!!]')) return 'critical';
    if (upper.includes('[HIGH]') || upper.includes('[!!]')) return 'high';
    if (upper.includes('[MEDIUM]') || upper.includes('[!]')) return 'medium';
    if (upper.includes('[LOW]')) return 'low';
    return null;
  };

  const getPriorityColor = (priority: PriorityLevel): string => {
    const colors: Record<PriorityLevel, string> = {
      critical: '#F44336',
      high: '#FF6B6B',
      medium: '#FFA500',
      low: '#4CAF50',
    };
    return colors[priority];
  };

  const cleanText = (text: string): string => {
    return text
      .replace(/\[CRITICAL\]/gi, '')
      .replace(/\[HIGH\]/gi, '')
      .replace(/\[MEDIUM\]/gi, '')
      .replace(/\[LOW\]/gi, '')
      .replace(/\[!!!\]/g, '')
      .replace(/\[!!\]/g, '')
      .replace(/\[!\]/g, '')
      .replace(/\[OK\]/g, '')
      .replace(/\[\+\+\]/g, '')
      .replace(/\[--\]/g, '')
      .trim();
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: revealAnim,
          transform: [{ translateY }],
        },
        highlight && {
          borderColor: highlightBorderColor,
          borderWidth: 2,
        },
      ]}
    >
      {/* Header */}
      <TouchableOpacity style={styles.header} onPress={toggleExpanded} activeOpacity={0.7}>
        <View style={[styles.iconContainer, { backgroundColor: `${config.color}20` }]}>
          <Ionicons name={config.icon as any} size={20} color={config.color} />
        </View>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>{section.title || section.type.replace(/_/g, ' ')}</Text>
          {section.metadata?.count !== undefined && (
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{section.metadata.count}</Text>
            </View>
          )}
        </View>
        <Animated.View style={{ transform: [{ rotate: rotation }] }}>
          <Ionicons name="chevron-down" size={20} color="#888" />
        </Animated.View>
      </TouchableOpacity>

      {/* Content */}
      {expanded && (
        <View style={styles.content}>
          {items.map((item, idx) => {
            const priority = getPriorityIndicator(item);
            const displayText = cleanText(item);

            return (
              <TouchableOpacity
                key={idx}
                style={styles.itemRow}
                onPress={() => onItemPress?.(section.data?.[idx] || item, idx)}
                activeOpacity={onItemPress ? 0.7 : 1}
                disabled={!onItemPress}
              >
                {priority ? (
                  <View style={[styles.priorityDot, { backgroundColor: getPriorityColor(priority) }]} />
                ) : (
                  <View style={styles.bulletDot} />
                )}
                <Text style={[styles.itemText, priority && { color: getPriorityColor(priority) }]}>
                  {displayText}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Collapsed Preview */}
      {!expanded && items.length > 0 && (
        <View style={styles.preview}>
          <Text style={styles.previewText} numberOfLines={1}>
            {cleanText(items[0])}
            {items.length > 1 && ` (+${items.length - 1} more)`}
          </Text>
        </View>
      )}
    </Animated.View>
  );
};

// ============================================================================
// Compact BriefingCard Variant
// ============================================================================

interface CompactBriefingCardProps {
  section: BriefingSectionData;
  onPress?: () => void;
}

export const CompactBriefingCard: React.FC<CompactBriefingCardProps> = ({ section, onPress }) => {
  const config = SECTION_CONFIG[section.type] || SECTION_CONFIG.custom;
  const items = Array.isArray(section.content) ? section.content : [section.content];

  return (
    <TouchableOpacity
      style={styles.compactContainer}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress}
    >
      <View style={[styles.compactIcon, { backgroundColor: `${config.color}20` }]}>
        <Ionicons name={config.icon as any} size={16} color={config.color} />
      </View>
      <View style={styles.compactContent}>
        <Text style={styles.compactTitle}>{section.title}</Text>
        <Text style={styles.compactPreview} numberOfLines={1}>
          {items.length > 0 ? items[0] : 'No data'}
        </Text>
      </View>
      {section.metadata?.count !== undefined && (
        <View style={[styles.compactBadge, { backgroundColor: `${config.color}30` }]}>
          <Text style={[styles.compactBadgeText, { color: config.color }]}>
            {section.metadata.count}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  titleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
    textTransform: 'capitalize',
  },
  countBadge: {
    backgroundColor: '#333',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  countText: {
    fontSize: 12,
    color: '#888',
    fontWeight: '600',
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
    marginRight: 12,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#555',
    marginTop: 7,
    marginRight: 12,
  },
  itemText: {
    flex: 1,
    fontSize: 14,
    color: '#CCC',
    lineHeight: 20,
  },
  preview: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  previewText: {
    fontSize: 13,
    color: '#888',
  },
  // Compact styles
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  compactIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  compactContent: {
    flex: 1,
  },
  compactTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 2,
  },
  compactPreview: {
    fontSize: 12,
    color: '#888',
  },
  compactBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  compactBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
});

export default BriefingCard;
