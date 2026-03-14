/**
 * TeamDashboard Component
 *
 * Team overview with member cards, workload visualization,
 * availability indicators, and team health metrics.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
} from 'react-native';

// Types
interface TeamMember {
  id: string;
  name: string;
  avatar?: string;
  role: string;
  availability: 'available' | 'busy' | 'away' | 'offline' | 'dnd';
  statusMessage?: string;
  currentLoad: number;
  maxCapacity: number;
  activeTasks: number;
  completedThisWeek: number;
}

interface TeamMetrics {
  healthScore: number;
  healthTrend: 'improving' | 'stable' | 'declining';
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
  avgResponseTime: string;
}

interface Goal {
  id: string;
  title: string;
  progress: number;
  targetDate: Date;
  status: 'on_track' | 'at_risk' | 'behind';
}

interface Announcement {
  id: string;
  title: string;
  author: string;
  priority: 'urgent' | 'important' | 'normal';
  createdAt: Date;
}

interface TeamDashboardProps {
  teamName?: string;
  members?: TeamMember[];
  metrics?: TeamMetrics;
  goals?: Goal[];
  announcements?: Announcement[];
  onMemberPress?: (member: TeamMember) => void;
  onDelegatePress?: (member: TeamMember) => void;
  onGoalPress?: (goal: Goal) => void;
  onAnnouncementPress?: (announcement: Announcement) => void;
  onRefresh?: () => Promise<void>;
}

// Mock data
const mockMembers: TeamMember[] = [
  {
    id: '1',
    name: 'Alice Johnson',
    role: 'Team Lead',
    availability: 'available',
    currentLoad: 72,
    maxCapacity: 100,
    activeTasks: 5,
    completedThisWeek: 8,
  },
  {
    id: '2',
    name: 'Bob Smith',
    role: 'Senior Analyst',
    availability: 'busy',
    statusMessage: 'In a meeting until 3pm',
    currentLoad: 88,
    maxCapacity: 100,
    activeTasks: 7,
    completedThisWeek: 4,
  },
  {
    id: '3',
    name: 'Carol Davis',
    role: 'Analyst',
    availability: 'available',
    currentLoad: 45,
    maxCapacity: 100,
    activeTasks: 3,
    completedThisWeek: 6,
  },
  {
    id: '4',
    name: 'David Wilson',
    role: 'Developer',
    availability: 'away',
    statusMessage: 'On vacation until Jan 5',
    currentLoad: 0,
    maxCapacity: 100,
    activeTasks: 0,
    completedThisWeek: 0,
  },
];

const mockMetrics: TeamMetrics = {
  healthScore: 78,
  healthTrend: 'improving',
  totalTasks: 45,
  completedTasks: 32,
  overdueTasks: 3,
  avgResponseTime: '2.5h',
};

const mockGoals: Goal[] = [
  {
    id: '1',
    title: 'Q1 Revenue Target',
    progress: 65,
    targetDate: new Date('2026-03-31'),
    status: 'on_track',
  },
  {
    id: '2',
    title: 'Customer Satisfaction Score > 90%',
    progress: 82,
    targetDate: new Date('2026-02-28'),
    status: 'on_track',
  },
  {
    id: '3',
    title: 'Launch New Product Feature',
    progress: 35,
    targetDate: new Date('2026-02-15'),
    status: 'at_risk',
  },
];

const mockAnnouncements: Announcement[] = [
  {
    id: '1',
    title: 'All-hands meeting moved to Friday 2pm',
    author: 'Alice Johnson',
    priority: 'important',
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
  },
  {
    id: '2',
    title: 'New process for signal triage',
    author: 'Bob Smith',
    priority: 'normal',
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
  },
];

const { width: screenWidth } = Dimensions.get('window');

export const TeamDashboard: React.FC<TeamDashboardProps> = ({
  teamName = 'Strategy Team',
  members = mockMembers,
  metrics = mockMetrics,
  goals = mockGoals,
  announcements = mockAnnouncements,
  onMemberPress,
  onDelegatePress,
  onGoalPress,
  onAnnouncementPress,
  onRefresh,
}) => {
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await onRefresh?.();
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh]);

  const getAvailabilityColor = (availability: TeamMember['availability']): string => {
    switch (availability) {
      case 'available': return '#10B981';
      case 'busy': return '#F59E0B';
      case 'away': return '#6B7280';
      case 'offline': return '#D1D5DB';
      case 'dnd': return '#EF4444';
    }
  };

  const getAvailabilityLabel = (availability: TeamMember['availability']): string => {
    switch (availability) {
      case 'available': return 'Available';
      case 'busy': return 'Busy';
      case 'away': return 'Away';
      case 'offline': return 'Offline';
      case 'dnd': return 'Do Not Disturb';
    }
  };

  const getLoadColor = (load: number): string => {
    if (load < 50) return '#10B981';
    if (load < 75) return '#F59E0B';
    return '#EF4444';
  };

  const getHealthScoreColor = (score: number): string => {
    if (score >= 75) return '#10B981';
    if (score >= 50) return '#F59E0B';
    return '#EF4444';
  };

  const getGoalStatusColor = (status: Goal['status']): string => {
    switch (status) {
      case 'on_track': return '#10B981';
      case 'at_risk': return '#F59E0B';
      case 'behind': return '#EF4444';
    }
  };

  const formatTimeAgo = (date: Date): string => {
    const diff = Date.now() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const renderHealthScore = () => (
    <View style={styles.healthCard}>
      <View style={styles.healthHeader}>
        <Text style={styles.healthTitle}>Team Health</Text>
        <View style={styles.healthTrend}>
          <Text style={[
            styles.healthTrendText,
            { color: metrics.healthTrend === 'improving' ? '#10B981' :
              metrics.healthTrend === 'declining' ? '#EF4444' : '#6B7280' }
          ]}>
            {metrics.healthTrend === 'improving' ? 'Trending Up' :
              metrics.healthTrend === 'declining' ? 'Trending Down' : 'Stable'}
          </Text>
        </View>
      </View>

      <View style={styles.healthScoreContainer}>
        <View style={styles.healthScoreCircle}>
          <Text style={[styles.healthScoreValue, { color: getHealthScoreColor(metrics.healthScore) }]}>
            {metrics.healthScore}
          </Text>
          <Text style={styles.healthScoreLabel}>/100</Text>
        </View>

        <View style={styles.healthMetrics}>
          <View style={styles.healthMetric}>
            <Text style={styles.healthMetricValue}>{metrics.completedTasks}/{metrics.totalTasks}</Text>
            <Text style={styles.healthMetricLabel}>Tasks Done</Text>
          </View>
          <View style={styles.healthMetricDivider} />
          <View style={styles.healthMetric}>
            <Text style={[styles.healthMetricValue, metrics.overdueTasks > 0 && { color: '#EF4444' }]}>
              {metrics.overdueTasks}
            </Text>
            <Text style={styles.healthMetricLabel}>Overdue</Text>
          </View>
          <View style={styles.healthMetricDivider} />
          <View style={styles.healthMetric}>
            <Text style={styles.healthMetricValue}>{metrics.avgResponseTime}</Text>
            <Text style={styles.healthMetricLabel}>Avg Response</Text>
          </View>
        </View>
      </View>
    </View>
  );

  const renderMemberCard = (member: TeamMember) => (
    <TouchableOpacity
      key={member.id}
      style={styles.memberCard}
      onPress={() => onMemberPress?.(member)}
      activeOpacity={0.7}
    >
      <View style={styles.memberHeader}>
        <View style={styles.memberAvatar}>
          <Text style={styles.memberAvatarText}>
            {member.name.split(' ').map(n => n[0]).join('')}
          </Text>
          <View
            style={[
              styles.availabilityDot,
              { backgroundColor: getAvailabilityColor(member.availability) },
            ]}
          />
        </View>
        <View style={styles.memberInfo}>
          <Text style={styles.memberName}>{member.name}</Text>
          <Text style={styles.memberRole}>{member.role}</Text>
        </View>
      </View>

      <View style={styles.availabilityBadge}>
        <View
          style={[
            styles.availabilityIndicator,
            { backgroundColor: getAvailabilityColor(member.availability) },
          ]}
        />
        <Text style={styles.availabilityText}>
          {getAvailabilityLabel(member.availability)}
        </Text>
      </View>

      {member.statusMessage && (
        <Text style={styles.statusMessage} numberOfLines={1}>
          {member.statusMessage}
        </Text>
      )}

      <View style={styles.workloadContainer}>
        <View style={styles.workloadHeader}>
          <Text style={styles.workloadLabel}>Workload</Text>
          <Text style={[styles.workloadValue, { color: getLoadColor(member.currentLoad) }]}>
            {member.currentLoad}%
          </Text>
        </View>
        <View style={styles.workloadBarBg}>
          <View
            style={[
              styles.workloadBarFill,
              {
                width: `${member.currentLoad}%`,
                backgroundColor: getLoadColor(member.currentLoad),
              },
            ]}
          />
        </View>
      </View>

      <View style={styles.memberStats}>
        <View style={styles.memberStat}>
          <Text style={styles.memberStatValue}>{member.activeTasks}</Text>
          <Text style={styles.memberStatLabel}>Active</Text>
        </View>
        <View style={styles.memberStat}>
          <Text style={styles.memberStatValue}>{member.completedThisWeek}</Text>
          <Text style={styles.memberStatLabel}>Done/Week</Text>
        </View>
      </View>

      {member.availability !== 'offline' && member.availability !== 'away' && (
        <TouchableOpacity
          style={styles.delegateButton}
          onPress={() => onDelegatePress?.(member)}
        >
          <Text style={styles.delegateButtonText}>Delegate Task</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );

  const renderGoalCard = (goal: Goal) => (
    <TouchableOpacity
      key={goal.id}
      style={styles.goalCard}
      onPress={() => onGoalPress?.(goal)}
    >
      <View style={styles.goalHeader}>
        <Text style={styles.goalTitle} numberOfLines={2}>{goal.title}</Text>
        <View style={[
          styles.goalStatusBadge,
          { backgroundColor: getGoalStatusColor(goal.status) + '20' }
        ]}>
          <Text style={[styles.goalStatusText, { color: getGoalStatusColor(goal.status) }]}>
            {goal.status.replace('_', ' ').toUpperCase()}
          </Text>
        </View>
      </View>

      <View style={styles.goalProgress}>
        <View style={styles.goalProgressBarBg}>
          <View
            style={[
              styles.goalProgressBarFill,
              {
                width: `${goal.progress}%`,
                backgroundColor: getGoalStatusColor(goal.status),
              },
            ]}
          />
        </View>
        <Text style={styles.goalProgressText}>{goal.progress}%</Text>
      </View>

      <Text style={styles.goalDueDate}>
        Due: {goal.targetDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
      </Text>
    </TouchableOpacity>
  );

  const renderAnnouncementCard = (announcement: Announcement) => (
    <TouchableOpacity
      key={announcement.id}
      style={styles.announcementCard}
      onPress={() => onAnnouncementPress?.(announcement)}
    >
      {announcement.priority !== 'normal' && (
        <View style={[
          styles.priorityIndicator,
          { backgroundColor: announcement.priority === 'urgent' ? '#EF4444' : '#F59E0B' }
        ]} />
      )}
      <View style={styles.announcementContent}>
        <Text style={styles.announcementTitle} numberOfLines={2}>
          {announcement.title}
        </Text>
        <View style={styles.announcementMeta}>
          <Text style={styles.announcementAuthor}>{announcement.author}</Text>
          <Text style={styles.announcementTime}>{formatTimeAgo(announcement.createdAt)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.teamName}>{teamName}</Text>
        <View style={styles.memberCount}>
          <Text style={styles.memberCountText}>{members.length} members</Text>
          <View style={styles.onlineCount}>
            <View style={styles.onlineDot} />
            <Text style={styles.onlineCountText}>
              {members.filter(m => m.availability === 'available').length} online
            </Text>
          </View>
        </View>
      </View>

      {/* Health Score */}
      {renderHealthScore()}

      {/* Team Members */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Team Members</Text>
          <TouchableOpacity>
            <Text style={styles.seeAllText}>See All</Text>
          </TouchableOpacity>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.membersScroll}
        >
          {members.map(renderMemberCard)}
        </ScrollView>
      </View>

      {/* Goals */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Active Goals</Text>
          <TouchableOpacity>
            <Text style={styles.seeAllText}>See All</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.goalsList}>
          {goals.map(renderGoalCard)}
        </View>
      </View>

      {/* Announcements */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Announcements</Text>
          <TouchableOpacity>
            <Text style={styles.seeAllText}>See All</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.announcementsList}>
          {announcements.map(renderAnnouncementCard)}
        </View>
      </View>

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  teamName: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  memberCount: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberCountText: {
    fontSize: 14,
    color: '#6B7280',
    marginRight: 16,
  },
  onlineCount: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginRight: 6,
  },
  onlineCountText: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: '500',
  },
  healthCard: {
    margin: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  healthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  healthTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  healthTrend: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  healthTrendText: {
    fontSize: 14,
    fontWeight: '500',
  },
  healthScoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  healthScoreCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 24,
  },
  healthScoreValue: {
    fontSize: 32,
    fontWeight: '700',
  },
  healthScoreLabel: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  healthMetrics: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  healthMetric: {
    alignItems: 'center',
  },
  healthMetricValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  healthMetricLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  healthMetricDivider: {
    width: 1,
    backgroundColor: '#E5E7EB',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  seeAllText: {
    fontSize: 14,
    color: '#3B82F6',
    fontWeight: '500',
  },
  membersScroll: {
    paddingHorizontal: 16,
    gap: 12,
  },
  memberCard: {
    width: screenWidth * 0.55,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  memberHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  memberAvatarText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4B5563',
  },
  availabilityDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  memberRole: {
    fontSize: 13,
    color: '#6B7280',
  },
  availabilityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  availabilityIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  availabilityText: {
    fontSize: 12,
    color: '#6B7280',
  },
  statusMessage: {
    fontSize: 12,
    color: '#9CA3AF',
    fontStyle: 'italic',
    marginBottom: 12,
  },
  workloadContainer: {
    marginBottom: 12,
  },
  workloadHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  workloadLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  workloadValue: {
    fontSize: 12,
    fontWeight: '600',
  },
  workloadBarBg: {
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
  },
  workloadBarFill: {
    height: 6,
    borderRadius: 3,
  },
  memberStats: {
    flexDirection: 'row',
    gap: 24,
    marginBottom: 12,
  },
  memberStat: {
    alignItems: 'center',
  },
  memberStatValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  memberStatLabel: {
    fontSize: 11,
    color: '#6B7280',
  },
  delegateButton: {
    paddingVertical: 10,
    backgroundColor: '#DBEAFE',
    borderRadius: 8,
    alignItems: 'center',
  },
  delegateButtonText: {
    fontSize: 13,
    color: '#2563EB',
    fontWeight: '600',
  },
  goalsList: {
    paddingHorizontal: 16,
    gap: 12,
  },
  goalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  goalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  goalTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginRight: 12,
  },
  goalStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  goalStatusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  goalProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  goalProgressBarBg: {
    flex: 1,
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    marginRight: 12,
  },
  goalProgressBarFill: {
    height: 6,
    borderRadius: 3,
  },
  goalProgressText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    width: 40,
    textAlign: 'right',
  },
  goalDueDate: {
    fontSize: 12,
    color: '#6B7280',
  },
  announcementsList: {
    paddingHorizontal: 16,
    gap: 8,
  },
  announcementCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  priorityIndicator: {
    width: 4,
    borderRadius: 2,
    marginRight: 12,
  },
  announcementContent: {
    flex: 1,
  },
  announcementTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 4,
  },
  announcementMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  announcementAuthor: {
    fontSize: 12,
    color: '#6B7280',
  },
  announcementTime: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  bottomSpacer: {
    height: 40,
  },
});

export default TeamDashboard;
