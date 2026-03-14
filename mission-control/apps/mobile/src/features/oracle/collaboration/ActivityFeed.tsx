/**
 * ActivityFeed Component
 *
 * Team and personal activity stream with type icons,
 * time grouping, pagination, and filtering.
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Modal,
  ActivityIndicator,
} from 'react-native';

// Types
interface Activity {
  id: string;
  type: ActivityType;
  category: ActivityCategory;
  actor: {
    id: string;
    name: string;
    avatar?: string;
  };
  action: string;
  target?: {
    type: string;
    id: string;
    name: string;
  };
  metadata?: {
    importance: 'critical' | 'high' | 'normal' | 'low';
    tags?: string[];
  };
  timestamp: Date;
}

type ActivityType =
  | 'signal_created'
  | 'signal_shared'
  | 'signal_triaged'
  | 'task_created'
  | 'task_delegated'
  | 'task_completed'
  | 'decision_made'
  | 'comment_added'
  | 'goal_updated'
  | 'member_joined'
  | 'announcement_posted';

type ActivityCategory =
  | 'signals'
  | 'tasks'
  | 'decisions'
  | 'collaboration'
  | 'team';

interface FilterState {
  categories: ActivityCategory[];
  actors: string[];
  dateRange?: { start: Date; end: Date };
  importance?: ('critical' | 'high' | 'normal' | 'low')[];
}

interface ActivityFeedProps {
  activities?: Activity[];
  showTeamFeed?: boolean;
  currentUserId?: string;
  onActivityPress?: (activity: Activity) => void;
  onLoadMore?: () => Promise<void>;
  onRefresh?: () => Promise<void>;
  onFilterChange?: (filters: FilterState) => void;
  hasMore?: boolean;
  loading?: boolean;
}

// Mock data
const mockActivities: Activity[] = [
  {
    id: '1',
    type: 'signal_created',
    category: 'signals',
    actor: { id: 'alice', name: 'Alice Johnson' },
    action: 'created a new signal',
    target: { type: 'signal', id: 'sig_001', name: 'Competitor Product Launch' },
    metadata: { importance: 'high', tags: ['market', 'competitor'] },
    timestamp: new Date(Date.now() - 15 * 60 * 1000),
  },
  {
    id: '2',
    type: 'task_delegated',
    category: 'tasks',
    actor: { id: 'bob', name: 'Bob Smith' },
    action: 'delegated a task to',
    target: { type: 'user', id: 'carol', name: 'Carol Davis' },
    metadata: { importance: 'normal' },
    timestamp: new Date(Date.now() - 45 * 60 * 1000),
  },
  {
    id: '3',
    type: 'decision_made',
    category: 'decisions',
    actor: { id: 'alice', name: 'Alice Johnson' },
    action: 'made a decision on',
    target: { type: 'signal', id: 'sig_002', name: 'Pricing Strategy Update' },
    metadata: { importance: 'critical' },
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
  },
  {
    id: '4',
    type: 'comment_added',
    category: 'collaboration',
    actor: { id: 'carol', name: 'Carol Davis' },
    action: 'commented on',
    target: { type: 'task', id: 'task_001', name: 'Q2 Market Analysis' },
    metadata: { importance: 'normal' },
    timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000),
  },
  {
    id: '5',
    type: 'goal_updated',
    category: 'team',
    actor: { id: 'bob', name: 'Bob Smith' },
    action: 'updated progress on',
    target: { type: 'goal', id: 'goal_001', name: 'Q1 Revenue Target' },
    metadata: { importance: 'normal', tags: ['okr'] },
    timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000),
  },
  {
    id: '6',
    type: 'signal_triaged',
    category: 'signals',
    actor: { id: 'alice', name: 'Alice Johnson' },
    action: 'triaged signal as "Needs Action"',
    target: { type: 'signal', id: 'sig_003', name: 'Supply Chain Alert' },
    metadata: { importance: 'high' },
    timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000),
  },
  {
    id: '7',
    type: 'task_completed',
    category: 'tasks',
    actor: { id: 'carol', name: 'Carol Davis' },
    action: 'completed task',
    target: { type: 'task', id: 'task_002', name: 'Customer Feedback Analysis' },
    metadata: { importance: 'normal' },
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
  },
  {
    id: '8',
    type: 'member_joined',
    category: 'team',
    actor: { id: 'david', name: 'David Wilson' },
    action: 'joined the team',
    metadata: { importance: 'low' },
    timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
  },
];

export const ActivityFeed: React.FC<ActivityFeedProps> = ({
  activities = mockActivities,
  showTeamFeed = true,
  currentUserId = 'alice',
  onActivityPress,
  onLoadMore,
  onRefresh,
  onFilterChange,
  hasMore = true,
  loading = false,
}) => {
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    categories: [],
    actors: [],
  });

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await onRefresh?.();
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh]);

  const handleLoadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;

    setLoadingMore(true);
    try {
      await onLoadMore?.();
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, onLoadMore]);

  const handleFilterChange = useCallback((newFilters: FilterState) => {
    setFilters(newFilters);
    onFilterChange?.(newFilters);
    setShowFilters(false);
  }, [onFilterChange]);

  const filteredActivities = useMemo(() => {
    return activities.filter(activity => {
      if (filters.categories.length > 0 && !filters.categories.includes(activity.category)) {
        return false;
      }
      if (filters.actors.length > 0 && !filters.actors.includes(activity.actor.id)) {
        return false;
      }
      if (filters.importance &&
          activity.metadata?.importance &&
          !filters.importance.includes(activity.metadata.importance)) {
        return false;
      }
      if (filters.dateRange) {
        if (activity.timestamp < filters.dateRange.start ||
            activity.timestamp > filters.dateRange.end) {
          return false;
        }
      }
      return true;
    });
  }, [activities, filters]);

  const groupedActivities = useMemo(() => {
    const groups: { title: string; data: Activity[] }[] = [];
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    const today: Activity[] = [];
    const yesterday: Activity[] = [];
    const thisWeek: Activity[] = [];
    const older: Activity[] = [];

    filteredActivities.forEach(activity => {
      const diff = now - activity.timestamp.getTime();

      if (diff < dayMs) {
        today.push(activity);
      } else if (diff < 2 * dayMs) {
        yesterday.push(activity);
      } else if (diff < 7 * dayMs) {
        thisWeek.push(activity);
      } else {
        older.push(activity);
      }
    });

    if (today.length > 0) groups.push({ title: 'Today', data: today });
    if (yesterday.length > 0) groups.push({ title: 'Yesterday', data: yesterday });
    if (thisWeek.length > 0) groups.push({ title: 'This Week', data: thisWeek });
    if (older.length > 0) groups.push({ title: 'Earlier', data: older });

    return groups;
  }, [filteredActivities]);

  const getTypeIcon = (type: ActivityType): string => {
    switch (type) {
      case 'signal_created': return 'S+';
      case 'signal_shared': return 'SS';
      case 'signal_triaged': return 'ST';
      case 'task_created': return 'T+';
      case 'task_delegated': return 'TD';
      case 'task_completed': return 'TC';
      case 'decision_made': return 'DM';
      case 'comment_added': return 'C';
      case 'goal_updated': return 'G';
      case 'member_joined': return 'MJ';
      case 'announcement_posted': return 'A';
      default: return '?';
    }
  };

  const getCategoryColor = (category: ActivityCategory): string => {
    switch (category) {
      case 'signals': return '#8B5CF6';
      case 'tasks': return '#3B82F6';
      case 'decisions': return '#10B981';
      case 'collaboration': return '#F59E0B';
      case 'team': return '#6366F1';
    }
  };

  const getImportanceColor = (importance?: string): string => {
    switch (importance) {
      case 'critical': return '#EF4444';
      case 'high': return '#F59E0B';
      case 'normal': return '#6B7280';
      case 'low': return '#9CA3AF';
      default: return '#6B7280';
    }
  };

  const formatTime = (date: Date): string => {
    const now = Date.now();
    const diff = now - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));

    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const renderActivityCard = ({ item: activity }: { item: Activity }) => {
    const categoryColor = getCategoryColor(activity.category);

    return (
      <TouchableOpacity
        style={styles.activityCard}
        onPress={() => onActivityPress?.(activity)}
        activeOpacity={0.7}
      >
        <View style={styles.activityLeft}>
          <View
            style={[styles.typeIcon, { backgroundColor: `${categoryColor}15` }]}
          >
            <Text style={[styles.typeIconText, { color: categoryColor }]}>
              {getTypeIcon(activity.type)}
            </Text>
          </View>
          <View style={styles.timeline}>
            <View style={[styles.timelineDot, { backgroundColor: categoryColor }]} />
            <View style={styles.timelineLine} />
          </View>
        </View>

        <View style={styles.activityContent}>
          <View style={styles.activityHeader}>
            <View style={styles.actorContainer}>
              <View style={styles.actorAvatar}>
                <Text style={styles.actorAvatarText}>
                  {activity.actor.name.split(' ').map(n => n[0]).join('')}
                </Text>
              </View>
              <Text style={styles.actorName}>{activity.actor.name}</Text>
            </View>
            <Text style={styles.activityTime}>{formatTime(activity.timestamp)}</Text>
          </View>

          <Text style={styles.activityAction}>
            {activity.action}
            {activity.target && (
              <Text style={styles.targetName}> {activity.target.name}</Text>
            )}
          </Text>

          {activity.metadata?.tags && activity.metadata.tags.length > 0 && (
            <View style={styles.tagsContainer}>
              {activity.metadata.tags.slice(0, 3).map(tag => (
                <View key={tag} style={styles.tag}>
                  <Text style={styles.tagText}>#{tag}</Text>
                </View>
              ))}
            </View>
          )}

          {activity.metadata?.importance && activity.metadata.importance !== 'normal' && (
            <View style={styles.importanceBadge}>
              <View
                style={[
                  styles.importanceDot,
                  { backgroundColor: getImportanceColor(activity.metadata.importance) },
                ]}
              />
              <Text
                style={[
                  styles.importanceText,
                  { color: getImportanceColor(activity.metadata.importance) },
                ]}
              >
                {activity.metadata.importance.toUpperCase()}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderSectionHeader = (title: string) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerTop}>
        <View>
          <Text style={styles.title}>
            {showTeamFeed ? 'Team Activity' : 'My Activity'}
          </Text>
          <Text style={styles.subtitle}>
            {filteredActivities.length} activities
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.filterButton,
            (filters.categories.length > 0 || filters.actors.length > 0) && styles.filterButtonActive,
          ]}
          onPress={() => setShowFilters(true)}
        >
          <Text
            style={[
              styles.filterButtonText,
              (filters.categories.length > 0 || filters.actors.length > 0) && styles.filterButtonTextActive,
            ]}
          >
            Filter
          </Text>
          {(filters.categories.length > 0 || filters.actors.length > 0) && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>
                {filters.categories.length + filters.actors.length}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Quick Filters */}
      <View style={styles.quickFilters}>
        {(['signals', 'tasks', 'decisions', 'collaboration', 'team'] as ActivityCategory[]).map(category => {
          const isActive = filters.categories.includes(category);
          return (
            <TouchableOpacity
              key={category}
              style={[
                styles.quickFilterChip,
                isActive && { backgroundColor: getCategoryColor(category) },
              ]}
              onPress={() => {
                const newCategories = isActive
                  ? filters.categories.filter(c => c !== category)
                  : [...filters.categories, category];
                handleFilterChange({ ...filters, categories: newCategories });
              }}
            >
              <Text
                style={[
                  styles.quickFilterText,
                  isActive && styles.quickFilterTextActive,
                ]}
              >
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  const renderFooter = () => {
    if (!loadingMore) return null;

    return (
      <View style={styles.footer}>
        <ActivityIndicator size="small" color="#3B82F6" />
        <Text style={styles.loadingText}>Loading more...</Text>
      </View>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>A</Text>
      <Text style={styles.emptyTitle}>No activity yet</Text>
      <Text style={styles.emptyDescription}>
        Activity from you and your team will appear here
      </Text>
    </View>
  );

  const renderFilterModal = () => (
    <Modal
      visible={showFilters}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowFilters(false)}
    >
      <View style={styles.filterModal}>
        <View style={styles.filterModalHeader}>
          <TouchableOpacity onPress={() => setShowFilters(false)}>
            <Text style={styles.filterModalCancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.filterModalTitle}>Filters</Text>
          <TouchableOpacity
            onPress={() => handleFilterChange({ categories: [], actors: [] })}
          >
            <Text style={styles.filterModalReset}>Reset</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.filterSection}>
          <Text style={styles.filterSectionTitle}>Categories</Text>
          <View style={styles.filterOptions}>
            {(['signals', 'tasks', 'decisions', 'collaboration', 'team'] as ActivityCategory[]).map(category => {
              const isSelected = filters.categories.includes(category);
              return (
                <TouchableOpacity
                  key={category}
                  style={[
                    styles.filterOption,
                    isSelected && { backgroundColor: getCategoryColor(category) + '20' },
                  ]}
                  onPress={() => {
                    const newCategories = isSelected
                      ? filters.categories.filter(c => c !== category)
                      : [...filters.categories, category];
                    setFilters({ ...filters, categories: newCategories });
                  }}
                >
                  <View
                    style={[
                      styles.filterOptionDot,
                      { backgroundColor: getCategoryColor(category) },
                    ]}
                  />
                  <Text
                    style={[
                      styles.filterOptionText,
                      isSelected && styles.filterOptionTextSelected,
                    ]}
                  >
                    {category.charAt(0).toUpperCase() + category.slice(1)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.filterSection}>
          <Text style={styles.filterSectionTitle}>Importance</Text>
          <View style={styles.filterOptions}>
            {(['critical', 'high', 'normal', 'low'] as const).map(importance => {
              const isSelected = filters.importance?.includes(importance);
              return (
                <TouchableOpacity
                  key={importance}
                  style={[
                    styles.filterOption,
                    isSelected && { backgroundColor: getImportanceColor(importance) + '20' },
                  ]}
                  onPress={() => {
                    const current = filters.importance || [];
                    const updated = isSelected
                      ? current.filter(i => i !== importance)
                      : [...current, importance];
                    setFilters({
                      ...filters,
                      importance: updated.length > 0 ? updated : undefined,
                    });
                  }}
                >
                  <View
                    style={[
                      styles.filterOptionDot,
                      { backgroundColor: getImportanceColor(importance) },
                    ]}
                  />
                  <Text
                    style={[
                      styles.filterOptionText,
                      isSelected && styles.filterOptionTextSelected,
                    ]}
                  >
                    {importance.charAt(0).toUpperCase() + importance.slice(1)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <TouchableOpacity
          style={styles.applyFiltersButton}
          onPress={() => {
            onFilterChange?.(filters);
            setShowFilters(false);
          }}
        >
          <Text style={styles.applyFiltersText}>Apply Filters</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );

  // Flatten grouped activities for FlatList
  const flatData = useMemo(() => {
    const result: (Activity | { type: 'header'; title: string })[] = [];
    groupedActivities.forEach(group => {
      result.push({ type: 'header', title: group.title } as any);
      result.push(...group.data);
    });
    return result;
  }, [groupedActivities]);

  const renderItem = ({ item }: { item: Activity | { type: 'header'; title: string } }) => {
    if ('type' in item && item.type === 'header') {
      return renderSectionHeader(item.title);
    }
    return renderActivityCard({ item: item as Activity });
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={flatData}
        renderItem={renderItem}
        keyExtractor={(item, index) => 'id' in item ? item.id : `header-${index}`}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      />
      {renderFilterModal()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  listContent: {
    paddingBottom: 24,
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  filterButtonActive: {
    backgroundColor: '#DBEAFE',
  },
  filterButtonText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  filterButtonTextActive: {
    color: '#2563EB',
  },
  filterBadge: {
    marginLeft: 6,
    backgroundColor: '#3B82F6',
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  quickFilters: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
  },
  quickFilterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
  },
  quickFilterText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  quickFilterTextActive: {
    color: '#FFFFFF',
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  activityCard: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  activityLeft: {
    alignItems: 'center',
    marginRight: 12,
  },
  typeIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  typeIconText: {
    fontSize: 11,
    fontWeight: '700',
  },
  timeline: {
    flex: 1,
    alignItems: 'center',
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  timelineLine: {
    flex: 1,
    width: 2,
    backgroundColor: '#E5E7EB',
    marginTop: 4,
  },
  activityContent: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  actorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actorAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  actorAvatarText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#4B5563',
  },
  actorName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  activityTime: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  activityAction: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  targetName: {
    color: '#3B82F6',
    fontWeight: '500',
  },
  tagsContainer: {
    flexDirection: 'row',
    marginTop: 10,
    gap: 6,
  },
  tag: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  tagText: {
    fontSize: 11,
    color: '#6B7280',
  },
  importanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  importanceDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  importanceText: {
    fontSize: 11,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    color: '#6B7280',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  emptyIcon: {
    fontSize: 48,
    color: '#D1D5DB',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  filterModal: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  filterModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  filterModalCancel: {
    fontSize: 16,
    color: '#6B7280',
  },
  filterModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  filterModalReset: {
    fontSize: 16,
    color: '#3B82F6',
  },
  filterSection: {
    backgroundColor: '#FFFFFF',
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  filterSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
  },
  filterOptionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  filterOptionText: {
    fontSize: 14,
    color: '#6B7280',
  },
  filterOptionTextSelected: {
    color: '#111827',
    fontWeight: '500',
  },
  applyFiltersButton: {
    marginHorizontal: 16,
    marginTop: 24,
    paddingVertical: 16,
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    alignItems: 'center',
  },
  applyFiltersText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default ActivityFeed;
