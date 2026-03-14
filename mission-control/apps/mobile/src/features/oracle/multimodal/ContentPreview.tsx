/**
 * ContentPreview Component
 * Preview processed content with extracted data
 *
 * Features:
 * - Display processed content summary
 * - Show extracted entities, dates, action items
 * - Display generated signals
 * - Support different content types
 * - Interactive expansion for details
 *
 * @module features/oracle/multimodal/ContentPreview
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ScrollView,
  Image,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ORACLE_COLORS, ORACLE_TIMING, getUrgencyColor, getImpactColor } from '../theme';

// ============================================================================
// Types
// ============================================================================

/**
 * Content type
 */
type ContentType = 'image' | 'document' | 'audio' | 'video' | 'url';

/**
 * Extracted entity
 */
interface ExtractedEntity {
  type: 'person' | 'organization' | 'location' | 'date' | 'money' | 'percentage' | 'email' | 'phone' | 'url';
  value: string;
  confidence: number;
}

/**
 * Extracted date
 */
interface ExtractedDate {
  text: string;
  date: Date | null;
  type: 'deadline' | 'meeting' | 'event' | 'reference';
  confidence: number;
}

/**
 * Extracted action item
 */
interface ExtractedActionItem {
  id: string;
  text: string;
  type: 'task' | 'decision' | 'follow_up' | 'review' | 'respond' | 'schedule';
  priority: 'high' | 'medium' | 'low';
  owner?: string;
  deadline?: ExtractedDate;
  confidence: number;
}

/**
 * Generated signal
 */
interface OracleSignal {
  id: string;
  type: 'action_item' | 'deadline' | 'opportunity' | 'risk' | 'information' | 'meeting' | 'decision';
  urgency: 'critical' | 'high' | 'medium' | 'low';
  impact: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  confidence: number;
}

/**
 * Processing result data
 */
interface ProcessingResult {
  processingId: string;
  contentType: ContentType;
  filename?: string;
  url?: string;
  status: 'success' | 'partial' | 'failed';
  processingTimeMs: number;
  signals: OracleSignal[];
  extractedText?: string;
  summary?: string;
  keyPoints?: string[];
  entities: ExtractedEntity[];
  dates: ExtractedDate[];
  actionItems: ExtractedActionItem[];
  metadata: Record<string, any>;
  thumbnail?: string;
}

/**
 * Props for ContentPreview
 */
interface ContentPreviewProps {
  result: ProcessingResult;
  onSignalPress?: (signal: OracleSignal) => void;
  onActionItemPress?: (item: ExtractedActionItem) => void;
  onEntityPress?: (entity: ExtractedEntity) => void;
  onDismiss?: () => void;
  showRawText?: boolean;
  compact?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export const ContentPreview: React.FC<ContentPreviewProps> = ({
  result,
  onSignalPress,
  onActionItemPress,
  onEntityPress,
  onDismiss,
  showRawText = false,
  compact = false,
}) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['summary', 'signals'])
  );
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

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const getContentTypeIcon = (type: ContentType) => {
    switch (type) {
      case 'image':
        return 'image-outline';
      case 'document':
        return 'document-text-outline';
      case 'audio':
        return 'musical-notes-outline';
      case 'video':
        return 'videocam-outline';
      case 'url':
        return 'link-outline';
      default:
        return 'document-outline';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return ORACLE_COLORS.act;
      case 'partial':
        return ORACLE_COLORS.orient;
      case 'failed':
        return '#FF4444';
      default:
        return '#666666';
    }
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  if (compact) {
    return (
      <CompactPreview
        result={result}
        onPress={() => toggleSection('expand')}
      />
    );
  }

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
        <View style={styles.headerLeft}>
          <View style={[styles.typeIcon, { backgroundColor: `${ORACLE_COLORS.observe}20` }]}>
            <Ionicons
              name={getContentTypeIcon(result.contentType) as any}
              size={24}
              color={ORACLE_COLORS.observe}
            />
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.filename} numberOfLines={1}>
              {result.filename || result.url || 'Processed Content'}
            </Text>
            <View style={styles.headerMeta}>
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(result.status) }]}>
                <Text style={styles.statusText}>{result.status.toUpperCase()}</Text>
              </View>
              <Text style={styles.processingTime}>
                {formatDuration(result.processingTimeMs)}
              </Text>
            </View>
          </View>
        </View>
        {onDismiss && (
          <TouchableOpacity style={styles.dismissButton} onPress={onDismiss}>
            <Ionicons name="close" size={24} color="#666666" />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Thumbnail for images/videos */}
        {result.thumbnail && (
          <Image source={{ uri: result.thumbnail }} style={styles.thumbnail} resizeMode="cover" />
        )}

        {/* Summary Section */}
        {result.summary && (
          <SectionCard
            title="Summary"
            icon="bulb-outline"
            isExpanded={expandedSections.has('summary')}
            onToggle={() => toggleSection('summary')}
          >
            <Text style={styles.summaryText}>{result.summary}</Text>
          </SectionCard>
        )}

        {/* Key Points */}
        {result.keyPoints && result.keyPoints.length > 0 && (
          <SectionCard
            title="Key Points"
            icon="list-outline"
            count={result.keyPoints.length}
            isExpanded={expandedSections.has('keyPoints')}
            onToggle={() => toggleSection('keyPoints')}
          >
            {result.keyPoints.map((point, index) => (
              <View key={index} style={styles.keyPointRow}>
                <View style={styles.keyPointBullet} />
                <Text style={styles.keyPointText}>{point}</Text>
              </View>
            ))}
          </SectionCard>
        )}

        {/* Signals */}
        {result.signals.length > 0 && (
          <SectionCard
            title="Generated Signals"
            icon="radio-outline"
            count={result.signals.length}
            isExpanded={expandedSections.has('signals')}
            onToggle={() => toggleSection('signals')}
            color={ORACLE_COLORS.observe}
          >
            {result.signals.map((signal) => (
              <SignalCard
                key={signal.id}
                signal={signal}
                onPress={() => onSignalPress?.(signal)}
              />
            ))}
          </SectionCard>
        )}

        {/* Action Items */}
        {result.actionItems.length > 0 && (
          <SectionCard
            title="Action Items"
            icon="checkbox-outline"
            count={result.actionItems.length}
            isExpanded={expandedSections.has('actionItems')}
            onToggle={() => toggleSection('actionItems')}
            color={ORACLE_COLORS.act}
          >
            {result.actionItems.map((item) => (
              <ActionItemCard
                key={item.id}
                item={item}
                onPress={() => onActionItemPress?.(item)}
              />
            ))}
          </SectionCard>
        )}

        {/* Dates */}
        {result.dates.length > 0 && (
          <SectionCard
            title="Dates Detected"
            icon="calendar-outline"
            count={result.dates.length}
            isExpanded={expandedSections.has('dates')}
            onToggle={() => toggleSection('dates')}
            color={ORACLE_COLORS.decide}
          >
            {result.dates.map((date, index) => (
              <DateCard key={index} date={date} />
            ))}
          </SectionCard>
        )}

        {/* Entities */}
        {result.entities.length > 0 && (
          <SectionCard
            title="Extracted Entities"
            icon="pricetags-outline"
            count={result.entities.length}
            isExpanded={expandedSections.has('entities')}
            onToggle={() => toggleSection('entities')}
            color={ORACLE_COLORS.orient}
          >
            <View style={styles.entitiesGrid}>
              {result.entities.map((entity, index) => (
                <EntityChip
                  key={index}
                  entity={entity}
                  onPress={() => onEntityPress?.(entity)}
                />
              ))}
            </View>
          </SectionCard>
        )}

        {/* Raw Text */}
        {showRawText && result.extractedText && (
          <SectionCard
            title="Extracted Text"
            icon="document-text-outline"
            isExpanded={expandedSections.has('rawText')}
            onToggle={() => toggleSection('rawText')}
          >
            <Text style={styles.rawText} numberOfLines={20}>
              {result.extractedText}
            </Text>
          </SectionCard>
        )}

        {/* Metadata */}
        <SectionCard
          title="Metadata"
          icon="information-circle-outline"
          isExpanded={expandedSections.has('metadata')}
          onToggle={() => toggleSection('metadata')}
        >
          <View style={styles.metadataGrid}>
            {Object.entries(result.metadata).map(([key, value]) => (
              <View key={key} style={styles.metadataItem}>
                <Text style={styles.metadataKey}>{key.replace(/_/g, ' ')}</Text>
                <Text style={styles.metadataValue}>{String(value)}</Text>
              </View>
            ))}
          </View>
        </SectionCard>
      </ScrollView>
    </Animated.View>
  );
};

// ============================================================================
// Sub-components
// ============================================================================

/**
 * Section card with collapsible content
 */
const SectionCard: React.FC<{
  title: string;
  icon: string;
  count?: number;
  isExpanded: boolean;
  onToggle: () => void;
  color?: string;
  children: React.ReactNode;
}> = ({ title, icon, count, isExpanded, onToggle, color = ORACLE_COLORS.observe, children }) => {
  return (
    <View style={styles.sectionCard}>
      <TouchableOpacity style={styles.sectionHeader} onPress={onToggle} activeOpacity={0.7}>
        <View style={styles.sectionHeaderLeft}>
          <Ionicons name={icon as any} size={18} color={color} />
          <Text style={styles.sectionTitle}>{title}</Text>
          {count !== undefined && (
            <View style={[styles.countBadge, { backgroundColor: color }]}>
              <Text style={styles.countText}>{count}</Text>
            </View>
          )}
        </View>
        <Ionicons
          name={isExpanded ? 'chevron-up' : 'chevron-down'}
          size={18}
          color="#666666"
        />
      </TouchableOpacity>
      {isExpanded && <View style={styles.sectionContent}>{children}</View>}
    </View>
  );
};

/**
 * Signal card
 */
const SignalCard: React.FC<{
  signal: OracleSignal;
  onPress?: () => void;
}> = ({ signal, onPress }) => {
  const urgencyColor = getUrgencyColor(signal.urgency);
  const impactColor = getImpactColor(signal.impact);

  return (
    <TouchableOpacity
      style={[styles.signalCard, { borderLeftColor: urgencyColor }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.signalHeader}>
        <Text style={styles.signalTitle} numberOfLines={1}>
          {signal.title}
        </Text>
        <View style={styles.signalBadges}>
          <View style={[styles.urgencyBadge, { backgroundColor: urgencyColor }]}>
            <Text style={styles.badgeText}>{signal.urgency.toUpperCase()}</Text>
          </View>
        </View>
      </View>
      <Text style={styles.signalDescription} numberOfLines={2}>
        {signal.description}
      </Text>
      <View style={styles.signalFooter}>
        <Text style={styles.signalType}>{signal.type.replace(/_/g, ' ')}</Text>
        <Text style={styles.signalConfidence}>
          {Math.round(signal.confidence * 100)}% confidence
        </Text>
      </View>
    </TouchableOpacity>
  );
};

/**
 * Action item card
 */
const ActionItemCard: React.FC<{
  item: ExtractedActionItem;
  onPress?: () => void;
}> = ({ item, onPress }) => {
  const priorityColor = item.priority === 'high' ? '#FF4444' : item.priority === 'medium' ? '#FFA500' : '#00FF88';

  return (
    <TouchableOpacity
      style={styles.actionItemCard}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={[styles.priorityIndicator, { backgroundColor: priorityColor }]} />
      <View style={styles.actionItemContent}>
        <Text style={styles.actionItemText} numberOfLines={2}>
          {item.text}
        </Text>
        <View style={styles.actionItemMeta}>
          <View style={styles.actionItemType}>
            <Ionicons name="flag-outline" size={12} color="#666666" />
            <Text style={styles.actionItemTypeText}>{item.type.replace(/_/g, ' ')}</Text>
          </View>
          {item.owner && (
            <View style={styles.actionItemOwner}>
              <Ionicons name="person-outline" size={12} color="#666666" />
              <Text style={styles.actionItemOwnerText}>{item.owner}</Text>
            </View>
          )}
          {item.deadline && (
            <View style={styles.actionItemDeadline}>
              <Ionicons name="calendar-outline" size={12} color="#FF6B6B" />
              <Text style={styles.actionItemDeadlineText}>{item.deadline.text}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

/**
 * Date card
 */
const DateCard: React.FC<{ date: ExtractedDate }> = ({ date }) => {
  const typeColor = date.type === 'deadline' ? '#FF4444' : date.type === 'meeting' ? ORACLE_COLORS.orient : ORACLE_COLORS.observe;

  return (
    <View style={styles.dateCard}>
      <View style={[styles.dateIcon, { backgroundColor: `${typeColor}20` }]}>
        <Ionicons name="calendar" size={16} color={typeColor} />
      </View>
      <View style={styles.dateContent}>
        <Text style={styles.dateText}>{date.text}</Text>
        <View style={styles.dateMeta}>
          <View style={[styles.dateTypeBadge, { backgroundColor: typeColor }]}>
            <Text style={styles.dateTypeText}>{date.type.toUpperCase()}</Text>
          </View>
          {date.date && (
            <Text style={styles.dateFormatted}>
              {date.date.toLocaleDateString()}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
};

/**
 * Entity chip
 */
const EntityChip: React.FC<{
  entity: ExtractedEntity;
  onPress?: () => void;
}> = ({ entity, onPress }) => {
  const getEntityIcon = (type: string) => {
    switch (type) {
      case 'person':
        return 'person-outline';
      case 'organization':
        return 'business-outline';
      case 'location':
        return 'location-outline';
      case 'date':
        return 'calendar-outline';
      case 'money':
        return 'cash-outline';
      case 'email':
        return 'mail-outline';
      case 'phone':
        return 'call-outline';
      case 'url':
        return 'link-outline';
      default:
        return 'pricetag-outline';
    }
  };

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else if (entity.type === 'url') {
      Linking.openURL(entity.value);
    } else if (entity.type === 'email') {
      Linking.openURL(`mailto:${entity.value}`);
    } else if (entity.type === 'phone') {
      Linking.openURL(`tel:${entity.value}`);
    }
  };

  return (
    <TouchableOpacity style={styles.entityChip} onPress={handlePress} activeOpacity={0.7}>
      <Ionicons name={getEntityIcon(entity.type) as any} size={14} color="#888888" />
      <Text style={styles.entityText} numberOfLines={1}>
        {entity.value}
      </Text>
    </TouchableOpacity>
  );
};

/**
 * Compact preview
 */
const CompactPreview: React.FC<{
  result: ProcessingResult;
  onPress: () => void;
}> = ({ result, onPress }) => {
  return (
    <TouchableOpacity style={styles.compactContainer} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.compactLeft}>
        <View style={[styles.compactIcon, { backgroundColor: `${ORACLE_COLORS.observe}20` }]}>
          <Ionicons name="checkmark-circle" size={20} color={ORACLE_COLORS.act} />
        </View>
        <View style={styles.compactInfo}>
          <Text style={styles.compactTitle} numberOfLines={1}>
            {result.filename || result.url || 'Processed'}
          </Text>
          <Text style={styles.compactMeta}>
            {result.signals.length} signals, {result.actionItems.length} actions
          </Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#666666" />
    </TouchableOpacity>
  );
};

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  typeIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerInfo: {
    flex: 1,
  },
  filename: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  headerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#000000',
  },
  processingTime: {
    fontSize: 11,
    color: '#666666',
  },
  dismissButton: {
    padding: 4,
  },
  content: {
    padding: 16,
    paddingTop: 8,
  },
  thumbnail: {
    width: '100%',
    height: 150,
    borderRadius: 8,
    marginBottom: 16,
  },
  summaryText: {
    fontSize: 14,
    color: '#CCCCCC',
    lineHeight: 22,
  },
  sectionCard: {
    backgroundColor: '#222222',
    borderRadius: 8,
    marginBottom: 12,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  countBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    minWidth: 20,
    alignItems: 'center',
  },
  countText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#000000',
  },
  sectionContent: {
    padding: 12,
    paddingTop: 0,
  },
  keyPointRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  keyPointBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: ORACLE_COLORS.observe,
    marginTop: 6,
    marginRight: 10,
  },
  keyPointText: {
    flex: 1,
    fontSize: 13,
    color: '#CCCCCC',
    lineHeight: 20,
  },
  signalCard: {
    backgroundColor: '#2A2A2A',
    borderRadius: 8,
    borderLeftWidth: 3,
    padding: 12,
    marginBottom: 8,
  },
  signalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  signalTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  signalBadges: {
    flexDirection: 'row',
    gap: 4,
  },
  urgencyBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#000000',
  },
  signalDescription: {
    fontSize: 12,
    color: '#AAAAAA',
    lineHeight: 18,
    marginBottom: 8,
  },
  signalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  signalType: {
    fontSize: 10,
    color: '#666666',
    textTransform: 'uppercase',
  },
  signalConfidence: {
    fontSize: 10,
    color: '#666666',
  },
  actionItemCard: {
    flexDirection: 'row',
    backgroundColor: '#2A2A2A',
    borderRadius: 8,
    marginBottom: 8,
    overflow: 'hidden',
  },
  priorityIndicator: {
    width: 4,
  },
  actionItemContent: {
    flex: 1,
    padding: 12,
  },
  actionItemText: {
    fontSize: 13,
    color: '#FFFFFF',
    lineHeight: 20,
    marginBottom: 8,
  },
  actionItemMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionItemType: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionItemTypeText: {
    fontSize: 11,
    color: '#666666',
    textTransform: 'capitalize',
  },
  actionItemOwner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionItemOwnerText: {
    fontSize: 11,
    color: '#666666',
  },
  actionItemDeadline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionItemDeadlineText: {
    fontSize: 11,
    color: '#FF6B6B',
  },
  dateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2A2A2A',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  dateIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  dateContent: {
    flex: 1,
  },
  dateText: {
    fontSize: 13,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  dateMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateTypeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  dateTypeText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#000000',
  },
  dateFormatted: {
    fontSize: 11,
    color: '#666666',
  },
  entitiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  entityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2A2A2A',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
    maxWidth: '48%',
  },
  entityText: {
    fontSize: 12,
    color: '#CCCCCC',
    flex: 1,
  },
  rawText: {
    fontSize: 12,
    color: '#AAAAAA',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    lineHeight: 18,
  },
  metadataGrid: {
    gap: 8,
  },
  metadataItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metadataKey: {
    fontSize: 12,
    color: '#666666',
    textTransform: 'capitalize',
  },
  metadataValue: {
    fontSize: 12,
    color: '#CCCCCC',
  },
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  compactLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  compactIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  compactInfo: {
    flex: 1,
  },
  compactTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  compactMeta: {
    fontSize: 11,
    color: '#666666',
    marginTop: 2,
  },
});

export default ContentPreview;
