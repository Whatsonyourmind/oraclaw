/**
 * Team Analytics Dashboard
 * Story team-6 - Aggregate analytics across team members
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
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import type {
  Team,
  TeamPredictionAccuracy,
  TeamProductivity,
  TeamMemberActivity,
  User,
} from '@mission-control/shared-types';
import { ORACLE_COLORS } from '../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Mock data
const mockAccuracy: TeamPredictionAccuracy = {
  id: '1',
  team_id: 'team-1',
  period_start: '2024-01-01T00:00:00Z',
  period_end: '2024-01-31T23:59:59Z',
  total_predictions: 156,
  resolved_predictions: 142,
  accurate_predictions: 121,
  accuracy_rate: 0.852,
  brier_score: 0.128,
  accuracy_by_category: {
    task_completion: 0.89,
    deadline_risk: 0.78,
    outcome_likelihood: 0.86,
  },
  vs_org_average: 0.05,
  metadata: {},
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const mockProductivity: TeamProductivity = {
  id: '1',
  team_id: 'team-1',
  period_start: '2024-01-01T00:00:00Z',
  period_end: '2024-01-31T23:59:59Z',
  total_decisions: 48,
  decisions_pending: 5,
  decisions_completed: 43,
  avg_decision_time_hours: 4.2,
  total_plans: 32,
  plans_completed: 28,
  plans_on_track: 3,
  plans_at_risk: 1,
  avg_plan_duration_days: 3.5,
  signals_detected: 89,
  signals_acknowledged: 82,
  critical_signals: 7,
  shared_decisions: 24,
  comments_total: 156,
  active_contributors: 5,
  productivity_score: 87.5,
  health_status: 'healthy',
  metadata: {},
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const mockMemberActivity: (TeamMemberActivity & { user: User })[] = [
  {
    id: '1',
    team_id: 'team-1',
    user_id: 'user-1',
    period_start: '2024-01-01T00:00:00Z',
    period_end: '2024-01-31T23:59:59Z',
    decisions_created: 18,
    decisions_completed: 16,
    plans_created: 12,
    plans_completed: 10,
    signals_acknowledged: 34,
    comments_made: 45,
    shares_made: 12,
    prediction_accuracy: 0.89,
    avg_decision_time_hours: 3.2,
    plan_completion_rate: 0.92,
    engagement_score: 94.5,
    metadata: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    user: { id: 'user-1', email: 'alice@company.com', created_at: '', subscription_tier: 'pro' },
  },
  {
    id: '2',
    team_id: 'team-1',
    user_id: 'user-2',
    period_start: '2024-01-01T00:00:00Z',
    period_end: '2024-01-31T23:59:59Z',
    decisions_created: 15,
    decisions_completed: 14,
    plans_created: 10,
    plans_completed: 9,
    signals_acknowledged: 28,
    comments_made: 38,
    shares_made: 8,
    prediction_accuracy: 0.85,
    avg_decision_time_hours: 4.1,
    plan_completion_rate: 0.88,
    engagement_score: 87.2,
    metadata: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    user: { id: 'user-2', email: 'bob@company.com', created_at: '', subscription_tier: 'pro' },
  },
  {
    id: '3',
    team_id: 'team-1',
    user_id: 'user-3',
    period_start: '2024-01-01T00:00:00Z',
    period_end: '2024-01-31T23:59:59Z',
    decisions_created: 10,
    decisions_completed: 9,
    plans_created: 8,
    plans_completed: 7,
    signals_acknowledged: 20,
    comments_made: 42,
    shares_made: 6,
    prediction_accuracy: 0.82,
    avg_decision_time_hours: 5.0,
    plan_completion_rate: 0.85,
    engagement_score: 78.5,
    metadata: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    user: { id: 'user-3', email: 'carol@company.com', created_at: '', subscription_tier: 'free' },
  },
];

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: string;
  color: string;
  trend?: number;
}

function MetricCard({ title, value, subtitle, icon, color, trend }: MetricCardProps) {
  return (
    <View style={styles.metricCard}>
      <View style={[styles.metricIconContainer, { backgroundColor: color + '22' }]}>
        <Ionicons name={icon as any} size={24} color={color} />
      </View>
      <Text style={styles.metricTitle}>{title}</Text>
      <View style={styles.metricValueRow}>
        <Text style={[styles.metricValue, { color }]}>{value}</Text>
        {trend !== undefined && (
          <View style={[styles.trendBadge, { backgroundColor: trend >= 0 ? ORACLE_COLORS.act + '22' : ORACLE_COLORS.decide + '22' }]}>
            <Ionicons
              name={trend >= 0 ? 'arrow-up' : 'arrow-down'}
              size={12}
              color={trend >= 0 ? ORACLE_COLORS.act : ORACLE_COLORS.decide}
            />
            <Text style={[styles.trendText, { color: trend >= 0 ? ORACLE_COLORS.act : ORACLE_COLORS.decide }]}>
              {Math.abs(trend)}%
            </Text>
          </View>
        )}
      </View>
      {subtitle && <Text style={styles.metricSubtitle}>{subtitle}</Text>}
    </View>
  );
}

interface ProgressBarProps {
  progress: number;
  color: string;
  label: string;
  value: string;
}

function ProgressBar({ progress, color, label, value }: ProgressBarProps) {
  return (
    <View style={styles.progressItem}>
      <View style={styles.progressHeader}>
        <Text style={styles.progressLabel}>{label}</Text>
        <Text style={[styles.progressValue, { color }]}>{value}</Text>
      </View>
      <View style={styles.progressBarBg}>
        <View style={[styles.progressBarFill, { width: `${progress * 100}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

interface LeaderboardItemProps {
  rank: number;
  member: TeamMemberActivity & { user: User };
  metric: 'engagement' | 'accuracy' | 'decisions';
}

function LeaderboardItem({ rank, member, metric }: LeaderboardItemProps) {
  const initials = member.user?.email.substring(0, 2).toUpperCase() || 'NA';
  const value = metric === 'engagement'
    ? `${member.engagement_score.toFixed(1)}`
    : metric === 'accuracy'
    ? `${(member.prediction_accuracy * 100).toFixed(0)}%`
    : `${member.decisions_completed}`;

  const rankColors = ['#FFD700', '#C0C0C0', '#CD7F32'];

  return (
    <View style={styles.leaderboardItem}>
      <Text style={[styles.leaderboardRank, { color: rankColors[rank - 1] || '#666' }]}>
        #{rank}
      </Text>
      <View style={styles.leaderboardAvatar}>
        <Text style={styles.leaderboardAvatarText}>{initials}</Text>
      </View>
      <View style={styles.leaderboardInfo}>
        <Text style={styles.leaderboardEmail}>{member.user?.email}</Text>
      </View>
      <Text style={styles.leaderboardValue}>{value}</Text>
    </View>
  );
}

interface SectionProps {
  title: string;
  icon: string;
  iconColor?: string;
  action?: { label: string; onPress: () => void };
  children: React.ReactNode;
}

function Section({ title, icon, iconColor = ORACLE_COLORS.observe, action, children }: SectionProps) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <Ionicons name={icon as any} size={20} color={iconColor} />
          <Text style={styles.sectionTitle}>{title}</Text>
        </View>
        {action && (
          <TouchableOpacity onPress={action.onPress}>
            <Text style={styles.sectionAction}>{action.label}</Text>
          </TouchableOpacity>
        )}
      </View>
      {children}
    </View>
  );
}

interface Props {
  navigation: any;
  route: {
    params: {
      team: Team;
    };
  };
}

export function TeamAnalytics({ navigation, route }: Props) {
  const { team } = route.params;
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<'week' | 'month' | 'quarter'>('month');

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRefreshing(false);
  }, []);

  const handleExport = () => {
    // Navigate to export screen
  };

  const healthColor = mockProductivity.health_status === 'healthy'
    ? ORACLE_COLORS.act
    : mockProductivity.health_status === 'at_risk'
    ? ORACLE_COLORS.orient
    : ORACLE_COLORS.decide;

  const sortedByEngagement = [...mockMemberActivity].sort((a, b) => b.engagement_score - a.engagement_score);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>Team Analytics</Text>
          <Text style={styles.subtitle}>{team.name}</Text>
        </View>
        <TouchableOpacity style={styles.exportButton} onPress={handleExport}>
          <Ionicons name="download-outline" size={22} color={ORACLE_COLORS.observe} />
        </TouchableOpacity>
      </View>

      {/* Period Selector */}
      <View style={styles.periodSelector}>
        {(['week', 'month', 'quarter'] as const).map((p) => (
          <TouchableOpacity
            key={p}
            style={[styles.periodOption, period === p && styles.periodOptionActive]}
            onPress={() => setPeriod(p)}
          >
            <Text style={[styles.periodOptionText, period === p && styles.periodOptionTextActive]}>
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={ORACLE_COLORS.observe}
          />
        }
      >
        {/* Overview Metrics */}
        <View style={styles.metricsGrid}>
          <MetricCard
            title="Productivity"
            value={mockProductivity.productivity_score.toFixed(0)}
            subtitle="Score"
            icon="speedometer"
            color={ORACLE_COLORS.act}
            trend={8}
          />
          <MetricCard
            title="Accuracy"
            value={`${(mockAccuracy.accuracy_rate * 100).toFixed(0)}%`}
            subtitle="Predictions"
            icon="checkmark-circle"
            color={ORACLE_COLORS.observe}
            trend={5}
          />
          <MetricCard
            title="Health"
            value={mockProductivity.health_status.charAt(0).toUpperCase() + mockProductivity.health_status.slice(1)}
            icon="pulse"
            color={healthColor}
          />
          <MetricCard
            title="Active"
            value={mockProductivity.active_contributors}
            subtitle="Contributors"
            icon="people"
            color={ORACLE_COLORS.orient}
          />
        </View>

        {/* Prediction Accuracy by Category */}
        <Section title="Prediction Accuracy" icon="analytics" iconColor={ORACLE_COLORS.observe}>
          <View style={styles.accuracyCard}>
            <View style={styles.accuracyHeader}>
              <View style={styles.accuracyMain}>
                <Text style={styles.accuracyValue}>{(mockAccuracy.accuracy_rate * 100).toFixed(1)}%</Text>
                <Text style={styles.accuracyLabel}>Overall Accuracy</Text>
              </View>
              <View style={styles.brierScore}>
                <Text style={styles.brierValue}>{mockAccuracy.brier_score.toFixed(3)}</Text>
                <Text style={styles.brierLabel}>Brier Score</Text>
              </View>
            </View>
            <View style={styles.accuracyDivider} />
            {Object.entries(mockAccuracy.accuracy_by_category).map(([category, rate]) => (
              <ProgressBar
                key={category}
                label={category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                value={`${(rate * 100).toFixed(0)}%`}
                progress={rate}
                color={ORACLE_COLORS.observe}
              />
            ))}
            <View style={styles.vsOrgRow}>
              <Text style={styles.vsOrgLabel}>vs Org Average</Text>
              <Text style={[styles.vsOrgValue, { color: mockAccuracy.vs_org_average >= 0 ? ORACLE_COLORS.act : ORACLE_COLORS.decide }]}>
                {mockAccuracy.vs_org_average >= 0 ? '+' : ''}{(mockAccuracy.vs_org_average * 100).toFixed(1)}%
              </Text>
            </View>
          </View>
        </Section>

        {/* Decision & Plan Metrics */}
        <Section title="Decisions & Plans" icon="git-branch" iconColor={ORACLE_COLORS.orient}>
          <View style={styles.statsCard}>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{mockProductivity.decisions_completed}</Text>
                <Text style={styles.statLabel}>Decisions Made</Text>
              </View>
              <View style={[styles.statItem, styles.statItemBorder]}>
                <Text style={styles.statValue}>{mockProductivity.avg_decision_time_hours.toFixed(1)}h</Text>
                <Text style={styles.statLabel}>Avg Decision Time</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{mockProductivity.decisions_pending}</Text>
                <Text style={styles.statLabel}>Pending</Text>
              </View>
            </View>
            <View style={styles.statsDivider} />
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{mockProductivity.plans_completed}</Text>
                <Text style={styles.statLabel}>Plans Completed</Text>
              </View>
              <View style={[styles.statItem, styles.statItemBorder]}>
                <Text style={[styles.statValue, { color: ORACLE_COLORS.act }]}>{mockProductivity.plans_on_track}</Text>
                <Text style={styles.statLabel}>On Track</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: ORACLE_COLORS.decide }]}>{mockProductivity.plans_at_risk}</Text>
                <Text style={styles.statLabel}>At Risk</Text>
              </View>
            </View>
          </View>
        </Section>

        {/* Member Leaderboard */}
        <Section
          title="Top Contributors"
          icon="trophy"
          iconColor={ORACLE_COLORS.orient}
          action={{ label: 'See All', onPress: () => {} }}
        >
          <View style={styles.leaderboardCard}>
            {sortedByEngagement.slice(0, 3).map((member, index) => (
              <LeaderboardItem
                key={member.id}
                rank={index + 1}
                member={member}
                metric="engagement"
              />
            ))}
          </View>
        </Section>

        {/* Collaboration Stats */}
        <Section title="Collaboration" icon="chatbubbles" iconColor={ORACLE_COLORS.decide}>
          <View style={styles.collabCard}>
            <View style={styles.collabRow}>
              <View style={styles.collabItem}>
                <Ionicons name="share-outline" size={24} color={ORACLE_COLORS.observe} />
                <Text style={styles.collabValue}>{mockProductivity.shared_decisions}</Text>
                <Text style={styles.collabLabel}>Shared Decisions</Text>
              </View>
              <View style={styles.collabItem}>
                <Ionicons name="chatbox-outline" size={24} color={ORACLE_COLORS.orient} />
                <Text style={styles.collabValue}>{mockProductivity.comments_total}</Text>
                <Text style={styles.collabLabel}>Comments</Text>
              </View>
              <View style={styles.collabItem}>
                <Ionicons name="notifications-outline" size={24} color={ORACLE_COLORS.decide} />
                <Text style={styles.collabValue}>{mockProductivity.signals_acknowledged}</Text>
                <Text style={styles.collabLabel}>Signals Ack'd</Text>
              </View>
            </View>
          </View>
        </Section>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  backButton: {
    padding: 8,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  subtitle: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  exportButton: {
    padding: 8,
    backgroundColor: ORACLE_COLORS.observe + '22',
    borderRadius: 8,
  },
  periodSelector: {
    flexDirection: 'row',
    margin: 16,
    backgroundColor: '#111',
    borderRadius: 8,
    padding: 4,
  },
  periodOption: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  periodOptionActive: {
    backgroundColor: ORACLE_COLORS.observe + '22',
  },
  periodOptionText: {
    fontSize: 14,
    color: '#666',
  },
  periodOptionTextActive: {
    color: ORACLE_COLORS.observe,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  metricCard: {
    width: (SCREEN_WIDTH - 40) / 2,
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 16,
    margin: 4,
  },
  metricIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  metricTitle: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
  },
  metricValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  trendText: {
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 2,
  },
  metricSubtitle: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  },
  section: {
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 10,
  },
  sectionAction: {
    fontSize: 14,
    color: ORACLE_COLORS.observe,
  },
  accuracyCard: {
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 16,
  },
  accuracyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  accuracyMain: {},
  accuracyValue: {
    fontSize: 32,
    fontWeight: '700',
    color: ORACLE_COLORS.observe,
  },
  accuracyLabel: {
    fontSize: 12,
    color: '#888',
  },
  brierScore: {
    alignItems: 'flex-end',
  },
  brierValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  brierLabel: {
    fontSize: 10,
    color: '#888',
  },
  accuracyDivider: {
    height: 1,
    backgroundColor: '#222',
    marginVertical: 16,
  },
  progressItem: {
    marginBottom: 12,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressLabel: {
    fontSize: 13,
    color: '#ccc',
  },
  progressValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  progressBarBg: {
    height: 6,
    backgroundColor: '#222',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  vsOrgRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#222',
  },
  vsOrgLabel: {
    fontSize: 13,
    color: '#888',
  },
  vsOrgValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  statsCard: {
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 16,
  },
  statsRow: {
    flexDirection: 'row',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  statItemBorder: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#222',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  statLabel: {
    fontSize: 11,
    color: '#888',
    marginTop: 4,
    textAlign: 'center',
  },
  statsDivider: {
    height: 1,
    backgroundColor: '#222',
    marginVertical: 16,
  },
  leaderboardCard: {
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 12,
  },
  leaderboardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  leaderboardRank: {
    width: 28,
    fontSize: 16,
    fontWeight: '700',
  },
  leaderboardAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: ORACLE_COLORS.observe + '33',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  leaderboardAvatarText: {
    fontSize: 12,
    fontWeight: '600',
    color: ORACLE_COLORS.observe,
  },
  leaderboardInfo: {
    flex: 1,
  },
  leaderboardEmail: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
  },
  leaderboardValue: {
    fontSize: 16,
    fontWeight: '700',
    color: ORACLE_COLORS.observe,
  },
  collabCard: {
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 16,
  },
  collabRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  collabItem: {
    alignItems: 'center',
  },
  collabValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginTop: 8,
  },
  collabLabel: {
    fontSize: 11,
    color: '#888',
    marginTop: 4,
  },
});

export default TeamAnalytics;
