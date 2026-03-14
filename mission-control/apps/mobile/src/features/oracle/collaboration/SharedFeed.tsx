/**
 * SharedFeed Component
 *
 * Displays shared signals with permission badges, quick actions,
 * and filtering capabilities.
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Image,
  Modal,
} from 'react-native';

// Types
interface SharedSignal {
  id: string;
  signalId: string;
  signalTitle: string;
  signalType: string;
  signalPriority: 'critical' | 'high' | 'medium' | 'low';
  sharedBy: {
    id: string;
    name: string;
    avatar?: string;
  };
  sharedAt: Date;
  permission: 'view' | 'comment' | 'edit' | 'full';
  note?: string;
  viewCount: number;
  commentCount: number;
  hasUnread: boolean;
  assignee?: {
    id: string;
    name: string;
    avatar?: string;
  };
}

interface SharedFeedProps {
  signals?: SharedSignal[];
  onSignalPress?: (signal: SharedSignal) => void;
  onRefresh?: () => Promise<void>;
  onFilterChange?: (filters: FilterState) => void;
  loading?: boolean;
}

interface FilterState {
  shareType: 'all' | 'shared_with_me' | 'shared_by_me';
  permission?: ('view' | 'comment' | 'edit' | 'full')[];
  signalType?: string[];
  priority?: ('critical' | 'high' | 'medium' | 'low')[];
  sharedBy?: string[];
}

// Mock data
const mockSignals: SharedSignal[] = [
  {
    id: '1',
    signalId: 'sig_001',
    signalTitle: 'Competitor launching new product line',
    signalType: 'market',
    signalPriority: 'high',
    sharedBy: {
      id: 'user1',
      name: 'Alice Johnson',
    },
    sharedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    permission: 'edit',
    note: 'Take a look at this - might affect our Q2 strategy',
    viewCount: 12,
    commentCount: 4,
    hasUnread: true,
  },
  {
    id: '2',
    signalId: 'sig_002',
    signalTitle: 'Supply chain disruption alert',
    signalType: 'operational',
    signalPriority: 'critical',
    sharedBy: {
      id: 'user2',
      name: 'Bob Smith',
    },
    sharedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    permission: 'view',
    viewCount: 45,
    commentCount: 8,
    hasUnread: false,
    assignee: {
      id: 'user3',
      name: 'Carol Davis',
    },
  },
  {
    id: '3',
    signalId: 'sig_003',
    signalTitle: 'Customer sentiment trending negative',
    signalType: 'customer',
    signalPriority: 'medium',
    sharedBy: {
      id: 'user3',
      name: 'Carol Davis',
    },
    sharedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    permission: 'comment',
    note: 'Need team input on response strategy',
    viewCount: 23,
    commentCount: 12,
    hasUnread: true,
  },
];

export const SharedFeed: React.FC<SharedFeedProps> = ({
  signals = mockSignals,
  onSignalPress,
  onRefresh,
  onFilterChange,
  loading = false,
}) => {
  const [refreshing, setRefreshing] = useState(false);
  const [filters, setFilters] = useState<FilterState>({ shareType: 'all' });
  const [showFilterModal, setShowFilterModal] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await onRefresh?.();
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh]);

  const handleFilterChange = useCallback((newFilters: FilterState) => {
    setFilters(newFilters);
    onFilterChange?.(newFilters);
    setShowFilterModal(false);
  }, [onFilterChange]);

  const filteredSignals = useMemo(() => {
    return signals.filter(signal => {
      if (filters.permission && !filters.permission.includes(signal.permission)) {
        return false;
      }
      if (filters.priority && !filters.priority.includes(signal.signalPriority)) {
        return false;
      }
      if (filters.signalType && !filters.signalType.includes(signal.signalType)) {
        return false;
      }
      return true;
    });
  }, [signals, filters]);

  const getPriorityColor = (priority: SharedSignal['signalPriority']): string => {
    switch (priority) {
      case 'critical': return '#EF4444';
      case 'high': return '#F59E0B';
      case 'medium': return '#3B82F6';
      case 'low': return '#6B7280';
    }
  };

  const getPermissionBadge = (permission: SharedSignal['permission']) => {
    const config = {
      view: { label: 'View', color: '#6B7280', bg: '#F3F4F6' },
      comment: { label: 'Comment', color: '#3B82F6', bg: '#DBEAFE' },
      edit: { label: 'Edit', color: '#10B981', bg: '#D1FAE5' },
      full: { label: 'Full', color: '#8B5CF6', bg: '#EDE9FE' },
    };
    return config[permission];
  };

  const getSignalTypeIcon = (type: string): string => {
    switch (type) {
      case 'market': return 'M';
      case 'operational': return 'O';
      case 'customer': return 'C';
      case 'financial': return 'F';
      case 'regulatory': return 'R';
      default: return 'S';
    }
  };

  const formatTimeAgo = (date: Date): string => {
    const now = Date.now();
    const diff = now - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days === 1) return 'Yesterday';
    return `${days}d ago`;
  };

  const renderSignalCard = ({ item: signal }: { item: SharedSignal }) => {
    const permissionBadge = getPermissionBadge(signal.permission);

    return (
      <TouchableOpacity
        style={[styles.signalCard, signal.hasUnread && styles.signalCardUnread]}
        onPress={() => onSignalPress?.(signal)}
        activeOpacity={0.7}
      >
        {signal.hasUnread && <View style={styles.unreadIndicator} />}

        <View style={styles.cardHeader}>
          <View style={styles.typeContainer}>
            <View
              style={[
                styles.typeIcon,
                { backgroundColor: `${getPriorityColor(signal.signalPriority)}20` },
              ]}
            >
              <Text
                style={[
                  styles.typeIconText,
                  { color: getPriorityColor(signal.signalPriority) },
                ]}
              >
                {getSignalTypeIcon(signal.signalType)}
              </Text>
            </View>
            <View
              style={[
                styles.priorityDot,
                { backgroundColor: getPriorityColor(signal.signalPriority) },
              ]}
            />
          </View>
          <View
            style={[
              styles.permissionBadge,
              { backgroundColor: permissionBadge.bg },
            ]}
          >
            <Text style={[styles.permissionText, { color: permissionBadge.color }]}>
              {permissionBadge.label}
            </Text>
          </View>
        </View>

        <Text style={styles.signalTitle} numberOfLines={2}>
          {signal.signalTitle}
        </Text>

        {signal.note && (
          <View style={styles.noteContainer}>
            <Text style={styles.noteText} numberOfLines={2}>
              "{signal.note}"
            </Text>
          </View>
        )}

        <View style={styles.sharedByContainer}>
          <View style={styles.sharedByAvatar}>
            {signal.sharedBy.avatar ? (
              <Image
                source={{ uri: signal.sharedBy.avatar }}
                style={styles.avatarImage}
              />
            ) : (
              <Text style={styles.avatarText}>
                {signal.sharedBy.name.split(' ').map(n => n[0]).join('')}
              </Text>
            )}
          </View>
          <View style={styles.sharedByInfo}>
            <Text style={styles.sharedByLabel}>Shared by</Text>
            <Text style={styles.sharedByName}>{signal.sharedBy.name}</Text>
          </View>
          <Text style={styles.sharedTime}>{formatTimeAgo(signal.sharedAt)}</Text>
        </View>

        {signal.assignee && (
          <View style={styles.assigneeContainer}>
            <Text style={styles.assigneeLabel}>Assigned to:</Text>
            <View style={styles.assigneeInfo}>
              <View style={styles.assigneeAvatar}>
                <Text style={styles.assigneeAvatarText}>
                  {signal.assignee.name.split(' ').map(n => n[0]).join('')}
                </Text>
              </View>
              <Text style={styles.assigneeName}>{signal.assignee.name}</Text>
            </View>
          </View>
        )}

        <View style={styles.statsContainer}>
          <View style={styles.stat}>
            <Text style={styles.statIcon}>O</Text>
            <Text style={styles.statValue}>{signal.viewCount}</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statIcon}>C</Text>
            <Text style={styles.statValue}>{signal.commentCount}</Text>
          </View>
        </View>

        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.quickAction}>
            <Text style={styles.quickActionText}>View</Text>
          </TouchableOpacity>
          {signal.permission !== 'view' && (
            <TouchableOpacity style={styles.quickAction}>
              <Text style={styles.quickActionText}>Comment</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[styles.quickAction, styles.quickActionPrimary]}>
            <Text style={styles.quickActionTextPrimary}>Triage</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.filterTabs}>
        {(['all', 'shared_with_me', 'shared_by_me'] as const).map(type => (
          <TouchableOpacity
            key={type}
            style={[
              styles.filterTab,
              filters.shareType === type && styles.filterTabActive,
            ]}
            onPress={() => handleFilterChange({ ...filters, shareType: type })}
          >
            <Text
              style={[
                styles.filterTabText,
                filters.shareType === type && styles.filterTabTextActive,
              ]}
            >
              {type === 'all' ? 'All' : type === 'shared_with_me' ? 'With Me' : 'By Me'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={styles.filterButton}
        onPress={() => setShowFilterModal(true)}
      >
        <Text style={styles.filterButtonText}>Filter</Text>
        {(filters.permission || filters.priority || filters.signalType) && (
          <View style={styles.filterBadge} />
        )}
      </TouchableOpacity>
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>~</Text>
      <Text style={styles.emptyTitle}>No shared signals</Text>
      <Text style={styles.emptyDescription}>
        Signals shared with you will appear here
      </Text>
    </View>
  );

  const renderFilterModal = () => (
    <Modal
      visible={showFilterModal}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowFilterModal(false)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => setShowFilterModal(false)}>
            <Text style={styles.modalCancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Filters</Text>
          <TouchableOpacity
            onPress={() => handleFilterChange({ shareType: filters.shareType })}
          >
            <Text style={styles.modalReset}>Reset</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.filterSection}>
          <Text style={styles.filterSectionTitle}>Permission Level</Text>
          <View style={styles.filterOptions}>
            {(['view', 'comment', 'edit', 'full'] as const).map(perm => {
              const badge = getPermissionBadge(perm);
              const isSelected = filters.permission?.includes(perm);
              return (
                <TouchableOpacity
                  key={perm}
                  style={[
                    styles.filterOption,
                    isSelected && styles.filterOptionSelected,
                  ]}
                  onPress={() => {
                    const current = filters.permission || [];
                    const updated = isSelected
                      ? current.filter(p => p !== perm)
                      : [...current, perm];
                    handleFilterChange({
                      ...filters,
                      permission: updated.length > 0 ? updated : undefined,
                    });
                  }}
                >
                  <Text
                    style={[
                      styles.filterOptionText,
                      isSelected && styles.filterOptionTextSelected,
                    ]}
                  >
                    {badge.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.filterSection}>
          <Text style={styles.filterSectionTitle}>Priority</Text>
          <View style={styles.filterOptions}>
            {(['critical', 'high', 'medium', 'low'] as const).map(priority => {
              const isSelected = filters.priority?.includes(priority);
              return (
                <TouchableOpacity
                  key={priority}
                  style={[
                    styles.filterOption,
                    isSelected && { backgroundColor: getPriorityColor(priority) + '20' },
                  ]}
                  onPress={() => {
                    const current = filters.priority || [];
                    const updated = isSelected
                      ? current.filter(p => p !== priority)
                      : [...current, priority];
                    handleFilterChange({
                      ...filters,
                      priority: updated.length > 0 ? updated : undefined,
                    });
                  }}
                >
                  <View
                    style={[
                      styles.priorityIndicator,
                      { backgroundColor: getPriorityColor(priority) },
                    ]}
                  />
                  <Text
                    style={[
                      styles.filterOptionText,
                      isSelected && styles.filterOptionTextSelected,
                    ]}
                  >
                    {priority.charAt(0).toUpperCase() + priority.slice(1)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <TouchableOpacity
          style={styles.applyButton}
          onPress={() => setShowFilterModal(false)}
        >
          <Text style={styles.applyButtonText}>Apply Filters</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={filteredSignals}
        renderItem={renderSignalCard}
        keyExtractor={item => item.id}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
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
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  filterTabs: {
    flexDirection: 'row',
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 4,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  filterTabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  filterTabText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  filterTabTextActive: {
    color: '#111827',
    fontWeight: '600',
  },
  filterButton: {
    marginLeft: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterButtonText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  filterBadge: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3B82F6',
    marginLeft: 6,
  },
  signalCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  signalCardUnread: {
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6',
  },
  unreadIndicator: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3B82F6',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  typeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  typeIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeIconText: {
    fontSize: 14,
    fontWeight: '700',
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 8,
  },
  permissionBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  permissionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  signalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    lineHeight: 22,
    marginBottom: 8,
  },
  noteContainer: {
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  noteText: {
    fontSize: 14,
    color: '#6B7280',
    fontStyle: 'italic',
    lineHeight: 20,
  },
  sharedByContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sharedByAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  avatarImage: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  avatarText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#4B5563',
  },
  sharedByInfo: {
    flex: 1,
  },
  sharedByLabel: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  sharedByName: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '500',
  },
  sharedTime: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  assigneeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 12,
  },
  assigneeLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginRight: 8,
  },
  assigneeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  assigneeAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  assigneeAvatarText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#2563EB',
  },
  assigneeName: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '500',
  },
  statsContainer: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 16,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statIcon: {
    fontSize: 14,
    color: '#9CA3AF',
    marginRight: 4,
  },
  statValue: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  quickActions: {
    flexDirection: 'row',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 12,
    marginTop: 4,
  },
  quickAction: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  quickActionPrimary: {
    backgroundColor: '#3B82F6',
  },
  quickActionText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '600',
  },
  quickActionTextPrimary: {
    color: '#FFFFFF',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyIcon: {
    fontSize: 48,
    color: '#D1D5DB',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalCancel: {
    fontSize: 16,
    color: '#6B7280',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  modalReset: {
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
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
  },
  filterOptionSelected: {
    backgroundColor: '#DBEAFE',
  },
  filterOptionText: {
    fontSize: 14,
    color: '#6B7280',
  },
  filterOptionTextSelected: {
    color: '#2563EB',
    fontWeight: '500',
  },
  priorityIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  applyButton: {
    marginHorizontal: 16,
    marginTop: 24,
    paddingVertical: 16,
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    alignItems: 'center',
  },
  applyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default SharedFeed;
