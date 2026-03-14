/**
 * NotificationCenter Component
 *
 * Comprehensive notification management with grouping,
 * quick actions, and settings access.
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  SectionList,
  Modal,
  Switch,
} from 'react-native';

// Types
interface Notification {
  id: string;
  type: NotificationType;
  category: NotificationCategory;
  title: string;
  message: string;
  priority: 'critical' | 'high' | 'normal' | 'low';
  status: 'unread' | 'read' | 'acted';
  actor?: {
    id: string;
    name: string;
    avatar?: string;
  };
  target?: {
    type: string;
    id: string;
    name: string;
  };
  actions?: NotificationAction[];
  createdAt: Date;
  groupId?: string;
}

type NotificationType =
  | 'signal_alert'
  | 'task_delegated'
  | 'task_completed'
  | 'decision_required'
  | 'mention'
  | 'comment'
  | 'reaction'
  | 'deadline_approaching'
  | 'goal_update'
  | 'team_announcement';

type NotificationCategory =
  | 'signals'
  | 'tasks'
  | 'decisions'
  | 'collaboration'
  | 'team';

interface NotificationAction {
  id: string;
  label: string;
  type: 'primary' | 'secondary' | 'danger';
}

interface NotificationGroup {
  title: string;
  data: Notification[];
}

interface NotificationCenterProps {
  notifications?: Notification[];
  onNotificationPress?: (notification: Notification) => void;
  onActionPress?: (notification: Notification, actionId: string) => Promise<void>;
  onMarkAsRead?: (notificationId: string) => Promise<void>;
  onMarkAllAsRead?: () => Promise<void>;
  onDismiss?: (notificationId: string) => Promise<void>;
  onSettingsPress?: () => void;
  onRefresh?: () => Promise<void>;
}

// Mock data
const mockNotifications: Notification[] = [
  {
    id: '1',
    type: 'signal_alert',
    category: 'signals',
    title: 'New High-Priority Signal',
    message: 'Market disruption detected in the semiconductor sector',
    priority: 'critical',
    status: 'unread',
    target: { type: 'signal', id: 'sig_001', name: 'Market Signal' },
    actions: [
      { id: 'view', label: 'View', type: 'primary' },
      { id: 'dismiss', label: 'Dismiss', type: 'secondary' },
    ],
    createdAt: new Date(Date.now() - 10 * 60 * 1000),
  },
  {
    id: '2',
    type: 'task_delegated',
    category: 'tasks',
    title: 'Task Delegated to You',
    message: 'Alice Johnson assigned you "Analyze competitor pricing"',
    priority: 'high',
    status: 'unread',
    actor: { id: 'alice', name: 'Alice Johnson' },
    target: { type: 'task', id: 'task_001', name: 'Analyze competitor pricing' },
    actions: [
      { id: 'accept', label: 'Accept', type: 'primary' },
      { id: 'decline', label: 'Decline', type: 'danger' },
    ],
    createdAt: new Date(Date.now() - 30 * 60 * 1000),
  },
  {
    id: '3',
    type: 'mention',
    category: 'collaboration',
    title: 'You were mentioned',
    message: 'Bob Smith mentioned you in a comment on "Q2 Strategy Review"',
    priority: 'normal',
    status: 'unread',
    actor: { id: 'bob', name: 'Bob Smith' },
    actions: [
      { id: 'reply', label: 'Reply', type: 'primary' },
    ],
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
  },
  {
    id: '4',
    type: 'deadline_approaching',
    category: 'tasks',
    title: 'Deadline Approaching',
    message: '"Customer analysis report" is due in 2 hours',
    priority: 'high',
    status: 'read',
    target: { type: 'task', id: 'task_002', name: 'Customer analysis report' },
    createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
  },
  {
    id: '5',
    type: 'team_announcement',
    category: 'team',
    title: 'Team Announcement',
    message: 'Weekly sync moved to Thursday at 2pm',
    priority: 'normal',
    status: 'read',
    actor: { id: 'carol', name: 'Carol Davis' },
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
  },
  {
    id: '6',
    type: 'goal_update',
    category: 'team',
    title: 'Goal Progress Update',
    message: 'Q1 Revenue Target is now at 75% completion',
    priority: 'normal',
    status: 'read',
    target: { type: 'goal', id: 'goal_001', name: 'Q1 Revenue Target' },
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
  },
];

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  notifications = mockNotifications,
  onNotificationPress,
  onActionPress,
  onMarkAsRead,
  onMarkAllAsRead,
  onDismiss,
  onSettingsPress,
  onRefresh,
}) => {
  const [refreshing, setRefreshing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [groupByType, setGroupByType] = useState<'time' | 'category'>('time');

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await onRefresh?.();
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh]);

  const unreadCount = useMemo(() =>
    notifications.filter(n => n.status === 'unread').length,
    [notifications]
  );

  const groupedNotifications = useMemo(() => {
    if (groupByType === 'category') {
      const groups: Record<string, Notification[]> = {};
      notifications.forEach(n => {
        if (!groups[n.category]) {
          groups[n.category] = [];
        }
        groups[n.category].push(n);
      });

      return Object.entries(groups).map(([category, data]) => ({
        title: getCategoryLabel(category as NotificationCategory),
        data,
      }));
    }

    // Group by time
    const now = Date.now();
    const today: Notification[] = [];
    const yesterday: Notification[] = [];
    const older: Notification[] = [];

    notifications.forEach(n => {
      const diff = now - n.createdAt.getTime();
      const dayMs = 24 * 60 * 60 * 1000;

      if (diff < dayMs) {
        today.push(n);
      } else if (diff < 2 * dayMs) {
        yesterday.push(n);
      } else {
        older.push(n);
      }
    });

    const groups: NotificationGroup[] = [];
    if (today.length > 0) groups.push({ title: 'Today', data: today });
    if (yesterday.length > 0) groups.push({ title: 'Yesterday', data: yesterday });
    if (older.length > 0) groups.push({ title: 'Earlier', data: older });

    return groups;
  }, [notifications, groupByType]);

  const getCategoryLabel = (category: NotificationCategory): string => {
    const labels: Record<NotificationCategory, string> = {
      signals: 'Signals',
      tasks: 'Tasks',
      decisions: 'Decisions',
      collaboration: 'Collaboration',
      team: 'Team',
    };
    return labels[category];
  };

  const getPriorityColor = (priority: Notification['priority']): string => {
    switch (priority) {
      case 'critical': return '#EF4444';
      case 'high': return '#F59E0B';
      case 'normal': return '#3B82F6';
      case 'low': return '#6B7280';
    }
  };

  const getTypeIcon = (type: NotificationType): string => {
    switch (type) {
      case 'signal_alert': return 'S';
      case 'task_delegated': return 'T';
      case 'task_completed': return 'C';
      case 'decision_required': return 'D';
      case 'mention': return '@';
      case 'comment': return 'C';
      case 'reaction': return 'R';
      case 'deadline_approaching': return '!';
      case 'goal_update': return 'G';
      case 'team_announcement': return 'A';
      default: return 'N';
    }
  };

  const formatTime = (date: Date): string => {
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

  const renderNotification = ({ item: notification }: { item: Notification }) => {
    const isUnread = notification.status === 'unread';

    return (
      <TouchableOpacity
        style={[
          styles.notificationCard,
          isUnread && styles.notificationCardUnread,
        ]}
        onPress={() => {
          onNotificationPress?.(notification);
          if (isUnread) {
            onMarkAsRead?.(notification.id);
          }
        }}
        activeOpacity={0.7}
      >
        {/* Priority Indicator */}
        {notification.priority === 'critical' || notification.priority === 'high' ? (
          <View
            style={[
              styles.priorityBar,
              { backgroundColor: getPriorityColor(notification.priority) },
            ]}
          />
        ) : null}

        <View style={styles.notificationContent}>
          {/* Header */}
          <View style={styles.notificationHeader}>
            <View
              style={[
                styles.typeIcon,
                { backgroundColor: `${getPriorityColor(notification.priority)}20` },
              ]}
            >
              <Text
                style={[
                  styles.typeIconText,
                  { color: getPriorityColor(notification.priority) },
                ]}
              >
                {getTypeIcon(notification.type)}
              </Text>
            </View>
            <View style={styles.headerText}>
              <Text style={styles.notificationTitle} numberOfLines={1}>
                {notification.title}
              </Text>
              <Text style={styles.notificationTime}>
                {formatTime(notification.createdAt)}
              </Text>
            </View>
            {isUnread && <View style={styles.unreadDot} />}
          </View>

          {/* Message */}
          <Text style={styles.notificationMessage} numberOfLines={2}>
            {notification.message}
          </Text>

          {/* Actor */}
          {notification.actor && (
            <View style={styles.actorContainer}>
              <View style={styles.actorAvatar}>
                <Text style={styles.actorAvatarText}>
                  {notification.actor.name.split(' ').map(n => n[0]).join('')}
                </Text>
              </View>
              <Text style={styles.actorName}>{notification.actor.name}</Text>
            </View>
          )}

          {/* Actions */}
          {notification.actions && notification.actions.length > 0 && (
            <View style={styles.actionsContainer}>
              {notification.actions.map(action => (
                <TouchableOpacity
                  key={action.id}
                  style={[
                    styles.actionButton,
                    action.type === 'primary' && styles.actionButtonPrimary,
                    action.type === 'danger' && styles.actionButtonDanger,
                  ]}
                  onPress={() => onActionPress?.(notification, action.id)}
                >
                  <Text
                    style={[
                      styles.actionButtonText,
                      action.type === 'primary' && styles.actionButtonTextPrimary,
                      action.type === 'danger' && styles.actionButtonTextDanger,
                    ]}
                  >
                    {action.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Dismiss Button */}
        <TouchableOpacity
          style={styles.dismissButton}
          onPress={() => onDismiss?.(notification.id)}
        >
          <Text style={styles.dismissButtonText}>x</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const renderSectionHeader = ({ section }: { section: NotificationGroup }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{section.title}</Text>
      <Text style={styles.sectionCount}>{section.data.length}</Text>
    </View>
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerTop}>
        <Text style={styles.title}>Notifications</Text>
        <View style={styles.headerActions}>
          {unreadCount > 0 && (
            <TouchableOpacity
              style={styles.markAllButton}
              onPress={onMarkAllAsRead}
            >
              <Text style={styles.markAllText}>Mark all read</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => setShowSettings(true)}
          >
            <Text style={styles.settingsIcon}>S</Text>
          </TouchableOpacity>
        </View>
      </View>

      {unreadCount > 0 && (
        <View style={styles.unreadBadge}>
          <Text style={styles.unreadBadgeText}>
            {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
          </Text>
        </View>
      )}

      <View style={styles.groupToggle}>
        <TouchableOpacity
          style={[
            styles.groupOption,
            groupByType === 'time' && styles.groupOptionActive,
          ]}
          onPress={() => setGroupByType('time')}
        >
          <Text
            style={[
              styles.groupOptionText,
              groupByType === 'time' && styles.groupOptionTextActive,
            ]}
          >
            By Time
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.groupOption,
            groupByType === 'category' && styles.groupOptionActive,
          ]}
          onPress={() => setGroupByType('category')}
        >
          <Text
            style={[
              styles.groupOptionText,
              groupByType === 'category' && styles.groupOptionTextActive,
            ]}
          >
            By Category
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>N</Text>
      <Text style={styles.emptyTitle}>All caught up!</Text>
      <Text style={styles.emptyDescription}>
        No new notifications at the moment
      </Text>
    </View>
  );

  const renderSettingsModal = () => (
    <Modal
      visible={showSettings}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowSettings(false)}
    >
      <View style={styles.settingsContainer}>
        <View style={styles.settingsHeader}>
          <TouchableOpacity onPress={() => setShowSettings(false)}>
            <Text style={styles.settingsClose}>Done</Text>
          </TouchableOpacity>
          <Text style={styles.settingsTitle}>Notification Settings</Text>
          <View style={{ width: 50 }} />
        </View>

        <View style={styles.settingsContent}>
          <View style={styles.settingSection}>
            <Text style={styles.settingSectionTitle}>Categories</Text>

            {(['signals', 'tasks', 'decisions', 'collaboration', 'team'] as NotificationCategory[]).map(category => (
              <View key={category} style={styles.settingRow}>
                <Text style={styles.settingLabel}>
                  {getCategoryLabel(category)}
                </Text>
                <Switch value={true} />
              </View>
            ))}
          </View>

          <View style={styles.settingSection}>
            <Text style={styles.settingSectionTitle}>Delivery</Text>

            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Push Notifications</Text>
              <Switch value={true} />
            </View>
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Email Notifications</Text>
              <Switch value={false} />
            </View>
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Daily Digest</Text>
              <Switch value={true} />
            </View>
          </View>

          <View style={styles.settingSection}>
            <Text style={styles.settingSectionTitle}>Quiet Hours</Text>

            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Enable Quiet Hours</Text>
              <Switch value={false} />
            </View>
            <Text style={styles.settingHint}>
              Silence non-critical notifications during specified hours
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={styles.container}>
      <SectionList
        sections={groupedNotifications}
        renderItem={renderNotification}
        renderSectionHeader={renderSectionHeader}
        keyExtractor={item => item.id}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      />
      {renderSettingsModal()}
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
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  markAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  markAllText: {
    fontSize: 14,
    color: '#3B82F6',
    fontWeight: '500',
  },
  settingsButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsIcon: {
    fontSize: 16,
    color: '#6B7280',
  },
  unreadBadge: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  unreadBadgeText: {
    fontSize: 13,
    color: '#2563EB',
    fontWeight: '500',
  },
  groupToggle: {
    flexDirection: 'row',
    marginHorizontal: 16,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 4,
  },
  groupOption: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  groupOptionActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  groupOptionText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  groupOptionTextActive: {
    color: '#111827',
    fontWeight: '600',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  sectionCount: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  notificationCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  notificationCardUnread: {
    backgroundColor: '#FAFBFF',
  },
  priorityBar: {
    width: 4,
  },
  notificationContent: {
    flex: 1,
    padding: 14,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  typeIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  typeIconText: {
    fontSize: 14,
    fontWeight: '700',
  },
  headerText: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  notificationTime: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3B82F6',
  },
  notificationMessage: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 10,
  },
  actorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  actorAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
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
    fontSize: 13,
    color: '#374151',
    fontWeight: '500',
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  actionButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
  },
  actionButtonPrimary: {
    backgroundColor: '#3B82F6',
  },
  actionButtonDanger: {
    backgroundColor: '#FEE2E2',
  },
  actionButtonText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '600',
  },
  actionButtonTextPrimary: {
    color: '#FFFFFF',
  },
  actionButtonTextDanger: {
    color: '#DC2626',
  },
  dismissButton: {
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  dismissButtonText: {
    fontSize: 18,
    color: '#9CA3AF',
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
  settingsContainer: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  settingsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  settingsClose: {
    fontSize: 16,
    color: '#3B82F6',
    fontWeight: '500',
  },
  settingsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  settingsContent: {
    flex: 1,
  },
  settingSection: {
    backgroundColor: '#FFFFFF',
    marginTop: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  settingSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 8,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  settingLabel: {
    fontSize: 16,
    color: '#111827',
  },
  settingHint: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 8,
    paddingBottom: 8,
  },
});

export default NotificationCenter;
