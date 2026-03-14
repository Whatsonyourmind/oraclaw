/**
 * DecisionJournal Component
 * Story adv-18 - Decision journal mobile screen
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
  TextInput,
  Modal,
  FlatList,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type {
  DecisionJournalEntry,
  JournalOutcomeStatus,
  JournalCategory,
  JournalStats,
  JournalFollowup,
} from '@mission-control/shared-types';
import { ORACLE_COLORS } from '../../../store/oracle';
import { oracleStyles } from '../theme';

const { width, height } = Dimensions.get('window');

// Outcome status configuration
const OUTCOME_CONFIG: Record<JournalOutcomeStatus, { icon: string; color: string; label: string }> = {
  pending: { icon: 'time-outline', color: '#888', label: 'Pending' },
  success: { icon: 'checkmark-circle', color: '#4CAF50', label: 'Success' },
  partial: { icon: 'ellipse-outline', color: '#FF9800', label: 'Partial' },
  failure: { icon: 'close-circle', color: '#F44336', label: 'Failure' },
  cancelled: { icon: 'ban', color: '#9E9E9E', label: 'Cancelled' },
  unknown: { icon: 'help-circle', color: '#607D8B', label: 'Unknown' },
};

// Category configuration
const CATEGORY_CONFIG: Record<JournalCategory, { icon: string; color: string }> = {
  career: { icon: 'briefcase', color: '#2196F3' },
  financial: { icon: 'cash', color: '#4CAF50' },
  health: { icon: 'heart', color: '#E91E63' },
  relationship: { icon: 'people', color: '#9C27B0' },
  project: { icon: 'folder', color: '#FF9800' },
  personal: { icon: 'person', color: '#00BCD4' },
  business: { icon: 'business', color: '#3F51B5' },
  technical: { icon: 'code-slash', color: '#607D8B' },
  other: { icon: 'ellipsis-horizontal', color: '#9E9E9E' },
};

// Mock data
const MOCK_ENTRIES: DecisionJournalEntry[] = [
  {
    id: '1',
    user_id: 'mock-user',
    title: 'Accept the Senior Developer Role',
    situation: 'Offered a promotion to Senior Developer with more responsibilities but also higher pay.',
    options_considered: ['Accept immediately', 'Negotiate terms', 'Decline and stay current'],
    chosen_option: 'Negotiate terms',
    reasoning: 'Wanted to ensure the compensation matched the increased responsibilities.',
    outcome_status: 'success',
    outcome_description: 'Successfully negotiated a 15% raise and flexible hours.',
    reflection: 'Taking time to negotiate was the right call. Never accept the first offer.',
    lessons_learned: ['Always negotiate', 'Know your worth', 'Prepare counterarguments'],
    tags: ['career', 'negotiation', 'growth'],
    category: 'career',
    importance: 'major',
    emotional_state_before: 'Anxious but excited',
    emotional_state_after: 'Confident and satisfied',
    stress_level: 7,
    confidence_in_decision: 0.85,
    decision_date: '2026-01-15T10:00:00.000Z',
    time_pressure: 'moderate',
    deliberation_time_hours: 48,
    is_private: true,
    is_favorite: true,
    metadata: {},
    created_at: '2026-01-15T10:00:00.000Z',
    updated_at: '2026-01-20T14:00:00.000Z',
  },
  {
    id: '2',
    user_id: 'mock-user',
    title: 'Switch to TypeScript for New Project',
    situation: 'Starting a new project and need to decide on JavaScript vs TypeScript.',
    options_considered: ['JavaScript', 'TypeScript', 'Both (gradual migration)'],
    chosen_option: 'TypeScript',
    reasoning: 'Better type safety, IDE support, and fewer bugs in production.',
    outcome_status: 'success',
    outcome_description: 'Project is more maintainable, caught many bugs at compile time.',
    lessons_learned: ['TypeScript overhead pays off for larger projects'],
    tags: ['technical', 'programming', 'tools'],
    category: 'technical',
    importance: 'moderate',
    stress_level: 3,
    confidence_in_decision: 0.9,
    decision_date: '2026-01-10T09:00:00.000Z',
    is_private: false,
    is_favorite: false,
    metadata: {},
    created_at: '2026-01-10T09:00:00.000Z',
    updated_at: '2026-01-25T10:00:00.000Z',
  },
  {
    id: '3',
    user_id: 'mock-user',
    title: 'Hire Additional Team Member',
    situation: 'Team is overloaded with work. Need to decide whether to hire now or wait.',
    options_considered: ['Hire now', 'Wait for Q2 budget', 'Use contractors'],
    chosen_option: 'Use contractors',
    outcome_status: 'partial',
    outcome_description: 'Contractors helped but onboarding took longer than expected.',
    tags: ['business', 'hiring', 'team'],
    category: 'business',
    importance: 'major',
    stress_level: 8,
    confidence_in_decision: 0.6,
    decision_date: '2026-01-05T14:00:00.000Z',
    would_decide_differently: true,
    alternative_considered: 'Should have pushed harder for Q1 budget approval for full-time hire.',
    is_private: true,
    is_favorite: false,
    metadata: {},
    created_at: '2026-01-05T14:00:00.000Z',
    updated_at: '2026-01-28T16:00:00.000Z',
  },
  {
    id: '4',
    user_id: 'mock-user',
    title: 'Start Morning Exercise Routine',
    situation: 'Energy levels dropping in afternoon. Considering morning exercise.',
    category: 'health',
    importance: 'moderate',
    outcome_status: 'pending',
    tags: ['health', 'routine', 'energy'],
    decision_date: '2026-01-28T07:00:00.000Z',
    is_private: true,
    is_favorite: false,
    metadata: {},
    created_at: '2026-01-28T07:00:00.000Z',
    updated_at: '2026-01-28T07:00:00.000Z',
  },
];

const MOCK_STATS: JournalStats = {
  total_entries: 23,
  entries_by_category: {
    career: 5,
    financial: 3,
    health: 4,
    relationship: 2,
    project: 4,
    personal: 2,
    business: 2,
    technical: 1,
    other: 0,
  },
  entries_by_outcome: {
    pending: 4,
    success: 12,
    partial: 4,
    failure: 2,
    cancelled: 1,
    unknown: 0,
  },
  success_rate: 0.67,
  average_confidence: 0.72,
  decisions_reviewed: 15,
  lessons_captured: 42,
  most_common_tags: [
    { tag: 'career', count: 8 },
    { tag: 'technical', count: 6 },
    { tag: 'growth', count: 5 },
  ],
};

const MOCK_FOLLOWUPS: JournalFollowup[] = [
  {
    id: 'f1',
    journal_id: '4',
    user_id: 'mock-user',
    followup_type: 'review_outcome',
    scheduled_date: '2026-02-04T07:00:00.000Z',
    is_completed: false,
    is_dismissed: false,
    created_at: '2026-01-28T07:00:00.000Z',
  },
];

// View mode types
type ViewMode = 'timeline' | 'list' | 'stats';

// Timeline Entry Card Component
interface EntryCardProps {
  entry: DecisionJournalEntry;
  onPress: () => void;
  onFavorite: () => void;
}

const EntryCard: React.FC<EntryCardProps> = ({ entry, onPress, onFavorite }) => {
  const outcomeConfig = OUTCOME_CONFIG[entry.outcome_status];
  const categoryConfig = CATEGORY_CONFIG[entry.category];
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 6,
      tension: 40,
      useNativeDriver: true,
    }).start();
  }, []);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <Animated.View style={[styles.entryCard, { transform: [{ scale: scaleAnim }] }]}>
        {/* Header */}
        <View style={styles.entryHeader}>
          <View style={[styles.categoryBadge, { backgroundColor: `${categoryConfig.color}20` }]}>
            <Ionicons name={categoryConfig.icon as any} size={14} color={categoryConfig.color} />
            <Text style={[styles.categoryText, { color: categoryConfig.color }]}>
              {entry.category}
            </Text>
          </View>
          <TouchableOpacity onPress={onFavorite} style={styles.favoriteButton}>
            <Ionicons
              name={entry.is_favorite ? 'star' : 'star-outline'}
              size={20}
              color={entry.is_favorite ? '#FFD700' : '#888'}
            />
          </TouchableOpacity>
        </View>

        {/* Title */}
        <Text style={styles.entryTitle} numberOfLines={2}>
          {entry.title}
        </Text>

        {/* Situation preview */}
        {entry.situation && (
          <Text style={styles.entrySituation} numberOfLines={2}>
            {entry.situation}
          </Text>
        )}

        {/* Outcome Status */}
        <View style={styles.entryOutcome}>
          <Ionicons name={outcomeConfig.icon as any} size={16} color={outcomeConfig.color} />
          <Text style={[styles.outcomeText, { color: outcomeConfig.color }]}>
            {outcomeConfig.label}
          </Text>
        </View>

        {/* Tags */}
        {entry.tags.length > 0 && (
          <View style={styles.tagsRow}>
            {entry.tags.slice(0, 3).map((tag, index) => (
              <View key={index} style={styles.tagBadge}>
                <Text style={styles.tagText}>#{tag}</Text>
              </View>
            ))}
            {entry.tags.length > 3 && (
              <Text style={styles.moreTagsText}>+{entry.tags.length - 3}</Text>
            )}
          </View>
        )}

        {/* Footer */}
        <View style={styles.entryFooter}>
          <Text style={styles.dateText}>{formatDate(entry.decision_date)}</Text>
          {entry.lessons_learned && entry.lessons_learned.length > 0 && (
            <View style={styles.lessonsIndicator}>
              <Ionicons name="bulb" size={12} color="#FFD700" />
              <Text style={styles.lessonsCount}>{entry.lessons_learned.length}</Text>
            </View>
          )}
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
};

// Stats Card Component
interface StatsCardProps {
  stats: JournalStats;
}

const StatsCard: React.FC<StatsCardProps> = ({ stats }) => {
  return (
    <View style={styles.statsContainer}>
      {/* Summary Row */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.total_entries}</Text>
          <Text style={styles.statLabel}>Entries</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{Math.round(stats.success_rate * 100)}%</Text>
          <Text style={styles.statLabel}>Success</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.lessons_captured}</Text>
          <Text style={styles.statLabel}>Lessons</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.decisions_reviewed}</Text>
          <Text style={styles.statLabel}>Reviewed</Text>
        </View>
      </View>

      {/* Outcome Breakdown */}
      <View style={styles.outcomeBreakdown}>
        <Text style={styles.sectionTitle}>Outcomes</Text>
        <View style={styles.outcomeBar}>
          {Object.entries(stats.entries_by_outcome).map(([status, count]) => {
            if (count === 0) return null;
            const percentage = (count / stats.total_entries) * 100;
            const config = OUTCOME_CONFIG[status as JournalOutcomeStatus];
            return (
              <View
                key={status}
                style={[
                  styles.outcomeSegment,
                  { width: `${percentage}%`, backgroundColor: config.color },
                ]}
              />
            );
          })}
        </View>
        <View style={styles.outcomeLegend}>
          {Object.entries(stats.entries_by_outcome).map(([status, count]) => {
            if (count === 0) return null;
            const config = OUTCOME_CONFIG[status as JournalOutcomeStatus];
            return (
              <View key={status} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: config.color }]} />
                <Text style={styles.legendText}>
                  {config.label}: {count}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Top Tags */}
      <View style={styles.topTagsSection}>
        <Text style={styles.sectionTitle}>Top Tags</Text>
        <View style={styles.topTagsRow}>
          {stats.most_common_tags.map((item, index) => (
            <View key={item.tag} style={styles.topTagItem}>
              <Text style={styles.topTagText}>#{item.tag}</Text>
              <Text style={styles.topTagCount}>{item.count}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
};

// Entry Detail Modal
interface EntryDetailModalProps {
  entry: DecisionJournalEntry | null;
  visible: boolean;
  onClose: () => void;
  onRecordOutcome: () => void;
  onAddReflection: () => void;
  onExport: () => void;
}

const EntryDetailModal: React.FC<EntryDetailModalProps> = ({
  entry,
  visible,
  onClose,
  onRecordOutcome,
  onAddReflection,
  onExport,
}) => {
  if (!entry) return null;

  const outcomeConfig = OUTCOME_CONFIG[entry.outcome_status];
  const categoryConfig = CATEGORY_CONFIG[entry.category];

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Decision Details</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#888" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            {/* Category & Importance */}
            <View style={styles.detailRow}>
              <View style={[styles.categoryBadge, { backgroundColor: `${categoryConfig.color}20` }]}>
                <Ionicons name={categoryConfig.icon as any} size={14} color={categoryConfig.color} />
                <Text style={[styles.categoryText, { color: categoryConfig.color }]}>
                  {entry.category}
                </Text>
              </View>
              <View style={styles.importanceBadge}>
                <Text style={styles.importanceText}>{entry.importance}</Text>
              </View>
            </View>

            {/* Title */}
            <Text style={styles.detailTitle}>{entry.title}</Text>

            {/* Date */}
            <Text style={styles.detailDate}>{formatDate(entry.decision_date)}</Text>

            {/* Situation */}
            <View style={styles.detailSection}>
              <Text style={styles.detailSectionTitle}>Situation</Text>
              <Text style={styles.detailText}>{entry.situation}</Text>
            </View>

            {/* Options Considered */}
            {entry.options_considered && entry.options_considered.length > 0 && (
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Options Considered</Text>
                {entry.options_considered.map((option, index) => (
                  <View key={index} style={styles.optionItem}>
                    <Text style={styles.optionNumber}>{index + 1}.</Text>
                    <Text
                      style={[
                        styles.optionText,
                        option === entry.chosen_option && styles.chosenOption,
                      ]}
                    >
                      {option}
                      {option === entry.chosen_option && ' (Chosen)'}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Reasoning */}
            {entry.reasoning && (
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Reasoning</Text>
                <Text style={styles.detailText}>{entry.reasoning}</Text>
              </View>
            )}

            {/* Outcome */}
            <View style={styles.detailSection}>
              <Text style={styles.detailSectionTitle}>Outcome</Text>
              <View style={styles.outcomeStatusRow}>
                <Ionicons name={outcomeConfig.icon as any} size={20} color={outcomeConfig.color} />
                <Text style={[styles.outcomeStatusText, { color: outcomeConfig.color }]}>
                  {outcomeConfig.label}
                </Text>
              </View>
              {entry.outcome_description && (
                <Text style={styles.detailText}>{entry.outcome_description}</Text>
              )}
            </View>

            {/* Reflection */}
            {entry.reflection && (
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Reflection</Text>
                <Text style={styles.detailText}>{entry.reflection}</Text>
              </View>
            )}

            {/* Lessons Learned */}
            {entry.lessons_learned && entry.lessons_learned.length > 0 && (
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Lessons Learned</Text>
                {entry.lessons_learned.map((lesson, index) => (
                  <View key={index} style={styles.lessonItem}>
                    <Ionicons name="bulb" size={14} color="#FFD700" />
                    <Text style={styles.lessonText}>{lesson}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Would Decide Differently */}
            {entry.would_decide_differently && entry.alternative_considered && (
              <View style={[styles.detailSection, styles.hindsightSection]}>
                <Text style={styles.hindsightTitle}>In Hindsight...</Text>
                <Text style={styles.detailText}>{entry.alternative_considered}</Text>
              </View>
            )}

            {/* Emotional Context */}
            {(entry.emotional_state_before || entry.stress_level) && (
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Context</Text>
                {entry.emotional_state_before && (
                  <Text style={styles.contextText}>
                    Feeling before: {entry.emotional_state_before}
                  </Text>
                )}
                {entry.emotional_state_after && (
                  <Text style={styles.contextText}>
                    Feeling after: {entry.emotional_state_after}
                  </Text>
                )}
                {entry.stress_level && (
                  <Text style={styles.contextText}>Stress level: {entry.stress_level}/10</Text>
                )}
                {entry.confidence_in_decision && (
                  <Text style={styles.contextText}>
                    Confidence: {Math.round(entry.confidence_in_decision * 100)}%
                  </Text>
                )}
              </View>
            )}

            {/* Tags */}
            {entry.tags.length > 0 && (
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Tags</Text>
                <View style={styles.tagsWrap}>
                  {entry.tags.map((tag, index) => (
                    <View key={index} style={styles.tagBadgeLarge}>
                      <Text style={styles.tagTextLarge}>#{tag}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </ScrollView>

          {/* Actions */}
          <View style={styles.modalActions}>
            {entry.outcome_status === 'pending' && (
              <TouchableOpacity style={styles.actionButton} onPress={onRecordOutcome}>
                <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                <Text style={styles.actionButtonText}>Record Outcome</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.actionButton} onPress={onAddReflection}>
              <Ionicons name="create" size={20} color={ORACLE_COLORS.orient} />
              <Text style={styles.actionButtonText}>Add Reflection</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={onExport}>
              <Ionicons name="download" size={20} color={ORACLE_COLORS.observe} />
              <Text style={styles.actionButtonText}>Export</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// New Entry Modal
interface NewEntryModalProps {
  visible: boolean;
  onClose: () => void;
  onCreate: (entry: Partial<DecisionJournalEntry>) => void;
}

const NewEntryModal: React.FC<NewEntryModalProps> = ({ visible, onClose, onCreate }) => {
  const [title, setTitle] = useState('');
  const [situation, setSituation] = useState('');
  const [category, setCategory] = useState<JournalCategory>('other');

  const handleCreate = () => {
    if (!title.trim() || !situation.trim()) {
      Alert.alert('Required', 'Please enter a title and situation');
      return;
    }

    onCreate({
      title: title.trim(),
      situation: situation.trim(),
      category,
      tags: [],
    });

    setTitle('');
    setSituation('');
    setCategory('other');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New Journal Entry</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#888" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            {/* Title */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Title *</Text>
              <TextInput
                style={styles.textInput}
                value={title}
                onChangeText={setTitle}
                placeholder="What decision did you make?"
                placeholderTextColor="#666"
              />
            </View>

            {/* Situation */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Situation *</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={situation}
                onChangeText={setSituation}
                placeholder="Describe the context and circumstances..."
                placeholderTextColor="#666"
                multiline
                numberOfLines={4}
              />
            </View>

            {/* Category */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.categoryOptions}>
                  {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
                    <TouchableOpacity
                      key={key}
                      style={[
                        styles.categoryOption,
                        category === key && { backgroundColor: `${config.color}30` },
                      ]}
                      onPress={() => setCategory(key as JournalCategory)}
                    >
                      <Ionicons
                        name={config.icon as any}
                        size={16}
                        color={category === key ? config.color : '#888'}
                      />
                      <Text
                        style={[
                          styles.categoryOptionText,
                          category === key && { color: config.color },
                        ]}
                      >
                        {key}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
          </ScrollView>

          <TouchableOpacity style={styles.createButton} onPress={handleCreate}>
            <Text style={styles.createButtonText}>Create Entry</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// Main Component
export const DecisionJournal: React.FC = () => {
  const insets = useSafeAreaInsets();
  const [viewMode, setViewMode] = useState<ViewMode>('timeline');
  const [entries, setEntries] = useState<DecisionJournalEntry[]>(MOCK_ENTRIES);
  const [stats, setStats] = useState<JournalStats>(MOCK_STATS);
  const [followups, setFollowups] = useState<JournalFollowup[]>(MOCK_FOLLOWUPS);
  const [selectedEntry, setSelectedEntry] = useState<DecisionJournalEntry | null>(null);
  const [showNewEntry, setShowNewEntry] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const filteredEntries = entries.filter((entry) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      entry.title.toLowerCase().includes(query) ||
      entry.situation?.toLowerCase().includes(query) ||
      entry.tags.some((tag) => tag.toLowerCase().includes(query))
    );
  });

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // In production: fetch from API
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  const handleToggleFavorite = (entryId: string) => {
    setEntries((prev) =>
      prev.map((e) => (e.id === entryId ? { ...e, is_favorite: !e.is_favorite } : e))
    );
  };

  const handleCreateEntry = (newEntry: Partial<DecisionJournalEntry>) => {
    const entry: DecisionJournalEntry = {
      id: Date.now().toString(),
      user_id: 'mock-user',
      title: newEntry.title || '',
      situation: newEntry.situation || '',
      category: newEntry.category || 'other',
      importance: 'moderate',
      outcome_status: 'pending',
      tags: newEntry.tags || [],
      decision_date: new Date().toISOString(),
      is_private: true,
      is_favorite: false,
      metadata: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setEntries((prev) => [entry, ...prev]);
  };

  const renderTimelineView = () => {
    // Group entries by month
    const grouped: Record<string, DecisionJournalEntry[]> = {};
    filteredEntries.forEach((entry) => {
      const date = new Date(entry.decision_date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
      if (!grouped[monthKey]) {
        grouped[monthKey] = [];
      }
      grouped[monthKey].push(entry);
    });

    return (
      <ScrollView
        style={styles.timeline}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {Object.entries(grouped)
          .sort((a, b) => b[0].localeCompare(a[0]))
          .map(([monthKey, monthEntries]) => {
            const date = new Date(`${monthKey}-01`);
            const monthLabel = date.toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
            });

            return (
              <View key={monthKey} style={styles.monthSection}>
                <Text style={styles.monthHeader}>{monthLabel}</Text>
                {monthEntries.map((entry) => (
                  <EntryCard
                    key={entry.id}
                    entry={entry}
                    onPress={() => setSelectedEntry(entry)}
                    onFavorite={() => handleToggleFavorite(entry.id)}
                  />
                ))}
              </View>
            );
          })}
        <View style={{ height: 100 }} />
      </ScrollView>
    );
  };

  const renderListView = () => (
    <FlatList
      data={filteredEntries}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <EntryCard
          entry={item}
          onPress={() => setSelectedEntry(item)}
          onFavorite={() => handleToggleFavorite(item.id)}
        />
      )}
      contentContainerStyle={styles.listContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListEmptyComponent={
        <View style={styles.emptyState}>
          <Ionicons name="journal" size={48} color="#444" />
          <Text style={styles.emptyText}>No entries found</Text>
        </View>
      }
    />
  );

  const renderStatsView = () => (
    <ScrollView
      style={styles.statsScrollView}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <StatsCard stats={stats} />

      {/* Pending Followups */}
      {followups.length > 0 && (
        <View style={styles.followupsSection}>
          <Text style={styles.sectionTitle}>Pending Reviews</Text>
          {followups.map((followup) => {
            const entry = entries.find((e) => e.id === followup.journal_id);
            if (!entry) return null;

            return (
              <TouchableOpacity
                key={followup.id}
                style={styles.followupCard}
                onPress={() => setSelectedEntry(entry)}
              >
                <Ionicons name="notifications" size={20} color={ORACLE_COLORS.orient} />
                <View style={styles.followupContent}>
                  <Text style={styles.followupTitle}>{entry.title}</Text>
                  <Text style={styles.followupDate}>
                    Review by {new Date(followup.scheduled_date).toLocaleDateString()}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#888" />
              </TouchableOpacity>
            );
          })}
        </View>
      )}
      <View style={{ height: 100 }} />
    </ScrollView>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Decision Journal</Text>
        <TouchableOpacity style={styles.addButton} onPress={() => setShowNewEntry(true)}>
          <Ionicons name="add" size={24} color="#FFF" />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#888" />
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search entries..."
          placeholderTextColor="#666"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color="#888" />
          </TouchableOpacity>
        )}
      </View>

      {/* View Mode Tabs */}
      <View style={styles.viewModeTabs}>
        {(['timeline', 'list', 'stats'] as ViewMode[]).map((mode) => (
          <TouchableOpacity
            key={mode}
            style={[styles.viewModeTab, viewMode === mode && styles.viewModeTabActive]}
            onPress={() => setViewMode(mode)}
          >
            <Ionicons
              name={
                mode === 'timeline'
                  ? 'git-commit'
                  : mode === 'list'
                  ? 'list'
                  : 'bar-chart'
              }
              size={18}
              color={viewMode === mode ? ORACLE_COLORS.orient : '#888'}
            />
            <Text
              style={[styles.viewModeText, viewMode === mode && styles.viewModeTextActive]}
            >
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={ORACLE_COLORS.orient} />
        </View>
      ) : viewMode === 'timeline' ? (
        renderTimelineView()
      ) : viewMode === 'list' ? (
        renderListView()
      ) : (
        renderStatsView()
      )}

      {/* Entry Detail Modal */}
      <EntryDetailModal
        entry={selectedEntry}
        visible={selectedEntry !== null}
        onClose={() => setSelectedEntry(null)}
        onRecordOutcome={() => {
          Alert.alert('Record Outcome', 'This would open the outcome recording form');
        }}
        onAddReflection={() => {
          Alert.alert('Add Reflection', 'This would open the reflection editor');
        }}
        onExport={() => {
          Alert.alert('Export', 'Entry would be exported to markdown');
        }}
      />

      {/* New Entry Modal */}
      <NewEntryModal
        visible={showNewEntry}
        onClose={() => setShowNewEntry(false)}
        onCreate={handleCreateEntry}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFF',
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: ORACLE_COLORS.orient,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    marginHorizontal: 20,
    paddingHorizontal: 12,
    borderRadius: 12,
    height: 44,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    color: '#FFF',
    fontSize: 16,
  },
  viewModeTabs: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  viewModeTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: '#1a1a1a',
  },
  viewModeTabActive: {
    backgroundColor: `${ORACLE_COLORS.orient}20`,
  },
  viewModeText: {
    color: '#888',
    marginLeft: 6,
    fontSize: 14,
  },
  viewModeTextActive: {
    color: ORACLE_COLORS.orient,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timeline: {
    flex: 1,
    paddingHorizontal: 20,
  },
  monthSection: {
    marginBottom: 24,
  },
  monthHeader: {
    fontSize: 18,
    fontWeight: '600',
    color: '#888',
    marginBottom: 12,
  },
  entryCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
    textTransform: 'capitalize',
  },
  favoriteButton: {
    padding: 4,
  },
  entryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 4,
  },
  entrySituation: {
    fontSize: 14,
    color: '#888',
    marginBottom: 8,
  },
  entryOutcome: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  outcomeText: {
    fontSize: 13,
    marginLeft: 6,
    fontWeight: '500',
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  tagBadge: {
    backgroundColor: '#333',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 10,
    marginRight: 6,
    marginBottom: 4,
  },
  tagText: {
    fontSize: 11,
    color: '#888',
  },
  moreTagsText: {
    fontSize: 11,
    color: '#666',
    marginLeft: 4,
  },
  entryFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  dateText: {
    fontSize: 12,
    color: '#666',
  },
  lessonsIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lessonsCount: {
    fontSize: 12,
    color: '#FFD700',
    marginLeft: 4,
  },
  listContent: {
    padding: 20,
    paddingBottom: 100,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    color: '#666',
    fontSize: 16,
    marginTop: 12,
  },
  statsScrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  statsContainer: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
  },
  statLabel: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },
  outcomeBreakdown: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 12,
  },
  outcomeBar: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: '#333',
  },
  outcomeSegment: {
    height: '100%',
  },
  outcomeLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginBottom: 8,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  legendText: {
    fontSize: 12,
    color: '#888',
  },
  topTagsSection: {
    marginTop: 4,
  },
  topTagsRow: {
    flexDirection: 'row',
  },
  topTagItem: {
    backgroundColor: '#333',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  topTagText: {
    fontSize: 13,
    color: '#FFF',
  },
  topTagCount: {
    fontSize: 13,
    color: ORACLE_COLORS.orient,
    marginLeft: 6,
    fontWeight: '600',
  },
  followupsSection: {
    marginBottom: 16,
  },
  followupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  followupContent: {
    flex: 1,
    marginLeft: 12,
  },
  followupTitle: {
    fontSize: 15,
    color: '#FFF',
    fontWeight: '500',
  },
  followupDate: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: height * 0.9,
    paddingBottom: 34,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFF',
  },
  modalBody: {
    padding: 20,
    maxHeight: height * 0.6,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  importanceBadge: {
    backgroundColor: '#333',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 10,
    marginLeft: 8,
  },
  importanceText: {
    fontSize: 12,
    color: '#888',
    textTransform: 'capitalize',
  },
  detailTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 4,
  },
  detailDate: {
    fontSize: 14,
    color: '#888',
    marginBottom: 20,
  },
  detailSection: {
    marginBottom: 20,
  },
  detailSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: ORACLE_COLORS.orient,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  detailText: {
    fontSize: 15,
    color: '#CCC',
    lineHeight: 22,
  },
  optionItem: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  optionNumber: {
    fontSize: 14,
    color: '#888',
    width: 20,
  },
  optionText: {
    flex: 1,
    fontSize: 14,
    color: '#CCC',
  },
  chosenOption: {
    color: ORACLE_COLORS.act,
    fontWeight: '600',
  },
  outcomeStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  outcomeStatusText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  lessonItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  lessonText: {
    flex: 1,
    fontSize: 14,
    color: '#CCC',
    marginLeft: 8,
  },
  hindsightSection: {
    backgroundColor: '#2a1a1a',
    padding: 12,
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#FF6B6B',
  },
  hindsightTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF6B6B',
    marginBottom: 8,
  },
  contextText: {
    fontSize: 14,
    color: '#888',
    marginBottom: 4,
  },
  tagsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tagBadgeLarge: {
    backgroundColor: '#333',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
    marginRight: 8,
    marginBottom: 8,
  },
  tagTextLarge: {
    fontSize: 13,
    color: '#FFF',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 16,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  actionButton: {
    alignItems: 'center',
    padding: 12,
  },
  actionButtonText: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#0a0a0a',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 12,
    padding: 14,
    color: '#FFF',
    fontSize: 16,
  },
  textArea: {
    height: 120,
    textAlignVertical: 'top',
  },
  categoryOptions: {
    flexDirection: 'row',
  },
  categoryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginRight: 8,
    backgroundColor: '#0a0a0a',
    borderWidth: 1,
    borderColor: '#333',
  },
  categoryOptionText: {
    fontSize: 13,
    color: '#888',
    marginLeft: 6,
    textTransform: 'capitalize',
  },
  createButton: {
    backgroundColor: ORACLE_COLORS.orient,
    marginHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
});

export default DecisionJournal;
