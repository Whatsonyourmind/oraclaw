/**
 * ORACLE Team Workspace Service
 *
 * Provides team-level features including dashboards, goals,
 * capacity management, and team coordination tools.
 */

import { EventEmitter } from 'events';

// Types
export interface Team {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  members: TeamMember[];
  settings: TeamSettings;
  createdAt: Date;
  updatedAt: Date;
}

export interface TeamMember {
  userId: string;
  name: string;
  email: string;
  avatar?: string;
  role: TeamRole;
  joinedAt: Date;
  status: MemberStatus;
  capacity: CapacityInfo;
  skills: string[];
}

export type TeamRole = 'owner' | 'admin' | 'member' | 'guest';

export interface MemberStatus {
  availability: 'available' | 'busy' | 'away' | 'offline' | 'dnd';
  statusMessage?: string;
  statusEmoji?: string;
  statusUntil?: Date;
  lastActive?: Date;
}

export interface CapacityInfo {
  maxCapacity: number;
  currentLoad: number;
  allocatedHours: number;
  availableHours: number;
  upcomingCommitments: number;
}

export interface TeamSettings {
  defaultPermissions: TeamRole;
  allowGuestAccess: boolean;
  requireApprovalToJoin: boolean;
  notificationDefaults: NotificationDefaults;
  workingHours: WorkingHours;
  timezone: string;
}

export interface NotificationDefaults {
  announcements: boolean;
  goalUpdates: boolean;
  capacityAlerts: boolean;
  memberChanges: boolean;
}

export interface WorkingHours {
  enabled: boolean;
  schedule: DaySchedule[];
}

export interface DaySchedule {
  day: number; // 0-6, Sunday-Saturday
  enabled: boolean;
  startHour: number;
  endHour: number;
}

export interface TeamDashboard {
  team: Team;
  summary: TeamSummary;
  healthScore: TeamHealthScore;
  recentActivity: ActivityEntry[];
  upcomingDeadlines: Deadline[];
  activeGoals: Goal[];
  announcements: Announcement[];
  memberHighlights: MemberHighlight[];
}

export interface TeamSummary {
  memberCount: number;
  activeMembers: number;
  totalCapacity: number;
  utilizedCapacity: number;
  openTasks: number;
  completedTasksThisWeek: number;
  pendingDecisions: number;
  activeSignals: number;
}

export interface TeamHealthScore {
  overall: number; // 0-100
  components: {
    workloadBalance: number;
    goalProgress: number;
    collaboration: number;
    responsiveness: number;
    morale: number;
  };
  trend: 'improving' | 'stable' | 'declining';
  alerts: HealthAlert[];
}

export interface HealthAlert {
  type: 'warning' | 'critical';
  category: string;
  message: string;
  affectedMembers?: string[];
  suggestedAction?: string;
}

export interface ActivityEntry {
  id: string;
  type: string;
  actor: { id: string; name: string };
  action: string;
  target?: { type: string; id: string; name: string };
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface Deadline {
  id: string;
  title: string;
  dueDate: Date;
  type: 'task' | 'goal' | 'milestone';
  assignees: string[];
  priority: 'critical' | 'high' | 'medium' | 'low';
  progress: number;
}

export interface Goal {
  id: string;
  title: string;
  description: string;
  type: 'objective' | 'key_result' | 'initiative';
  parentId?: string;
  ownerId: string;
  ownerName: string;
  teamId: string;
  status: GoalStatus;
  progress: number;
  startDate: Date;
  targetDate: Date;
  keyResults?: KeyResult[];
  metrics: GoalMetrics;
  updates: GoalUpdate[];
  createdAt: Date;
  updatedAt: Date;
}

export type GoalStatus =
  | 'not_started'
  | 'on_track'
  | 'at_risk'
  | 'behind'
  | 'completed'
  | 'cancelled';

export interface KeyResult {
  id: string;
  title: string;
  targetValue: number;
  currentValue: number;
  unit: string;
  progress: number;
  status: GoalStatus;
}

export interface GoalMetrics {
  checkInFrequency: 'daily' | 'weekly' | 'biweekly' | 'monthly';
  lastCheckIn?: Date;
  checkInCount: number;
  averageProgress: number;
  velocityTrend: 'accelerating' | 'steady' | 'slowing';
}

export interface GoalUpdate {
  id: string;
  authorId: string;
  authorName: string;
  content: string;
  progressChange?: number;
  statusChange?: GoalStatus;
  createdAt: Date;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  authorId: string;
  authorName: string;
  priority: 'urgent' | 'important' | 'normal';
  pinned: boolean;
  reactions: Reaction[];
  acknowledgments: string[];
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Reaction {
  emoji: string;
  userIds: string[];
  count: number;
}

export interface MemberHighlight {
  memberId: string;
  memberName: string;
  type: 'achievement' | 'milestone' | 'recognition' | 'birthday' | 'anniversary';
  title: string;
  description?: string;
  date: Date;
}

export interface CapacityView {
  teamId: string;
  period: { start: Date; end: Date };
  totalCapacity: number;
  utilizedCapacity: number;
  utilizationRate: number;
  memberCapacity: MemberCapacityDetail[];
  projections: CapacityProjection[];
  recommendations: CapacityRecommendation[];
}

export interface MemberCapacityDetail {
  memberId: string;
  memberName: string;
  totalHours: number;
  allocatedHours: number;
  availableHours: number;
  utilizationRate: number;
  tasks: TaskAllocation[];
  availability: AvailabilitySlot[];
}

export interface TaskAllocation {
  taskId: string;
  taskTitle: string;
  allocatedHours: number;
  deadline?: Date;
  priority: string;
}

export interface AvailabilitySlot {
  date: Date;
  available: boolean;
  hours: number;
  note?: string;
}

export interface CapacityProjection {
  date: Date;
  projectedUtilization: number;
  projectedAvailability: number;
  confidence: number;
}

export interface CapacityRecommendation {
  type: 'redistribute' | 'hire' | 'defer' | 'outsource';
  description: string;
  impact: number;
  affectedMembers: string[];
}

export interface AvailabilityCalendar {
  teamId: string;
  period: { start: Date; end: Date };
  members: MemberAvailability[];
  teamEvents: TeamEvent[];
  holidays: Holiday[];
}

export interface MemberAvailability {
  memberId: string;
  memberName: string;
  slots: CalendarSlot[];
  timeOff: TimeOffEntry[];
}

export interface CalendarSlot {
  date: Date;
  hour: number;
  status: 'available' | 'busy' | 'tentative' | 'away';
}

export interface TimeOffEntry {
  id: string;
  type: 'vacation' | 'sick' | 'personal' | 'holiday';
  startDate: Date;
  endDate: Date;
  status: 'pending' | 'approved' | 'denied';
}

export interface TeamEvent {
  id: string;
  title: string;
  type: 'meeting' | 'deadline' | 'milestone' | 'social';
  startDate: Date;
  endDate?: Date;
  participants: string[];
  location?: string;
  virtual?: boolean;
  recurring?: RecurrenceRule;
}

export interface RecurrenceRule {
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly';
  interval: number;
  endDate?: Date;
  exceptions: Date[];
}

export interface Holiday {
  date: Date;
  name: string;
  type: 'national' | 'company' | 'optional';
}

export interface TeamMetrics {
  teamId: string;
  period: { start: Date; end: Date };
  productivity: ProductivityMetrics;
  collaboration: CollaborationMetrics;
  quality: QualityMetrics;
  engagement: EngagementMetrics;
  trends: MetricTrend[];
}

export interface ProductivityMetrics {
  tasksCompleted: number;
  tasksCreated: number;
  averageCompletionTime: number;
  throughput: number;
  velocity: number;
}

export interface CollaborationMetrics {
  commentsCount: number;
  mentionsCount: number;
  sharedSignals: number;
  delegations: number;
  averageResponseTime: number;
}

export interface QualityMetrics {
  reworkRate: number;
  firstTimeRight: number;
  feedbackScore: number;
  errorRate: number;
}

export interface EngagementMetrics {
  activeUsers: number;
  dailyActiveRate: number;
  averageSessionDuration: number;
  featureAdoption: Record<string, number>;
}

export interface MetricTrend {
  date: Date;
  metrics: {
    productivity: number;
    collaboration: number;
    quality: number;
    engagement: number;
  };
}

// Service Implementation
class TeamWorkspaceService extends EventEmitter {
  private teams: Map<string, Team> = new Map();
  private goals: Map<string, Goal> = new Map();
  private announcements: Map<string, Announcement> = new Map();
  private activities: ActivityEntry[] = [];

  constructor() {
    super();
  }

  /**
   * Get team dashboard
   */
  async getTeamDashboard(teamId: string, userId: string): Promise<TeamDashboard> {
    const team = this.teams.get(teamId);
    if (!team) {
      // Create a default team for demo
      const defaultTeam = this.createDefaultTeam(teamId);
      this.teams.set(teamId, defaultTeam);
    }

    const teamData = this.teams.get(teamId)!;

    const summary = this.calculateTeamSummary(teamData);
    const healthScore = this.calculateHealthScore(teamData);
    const recentActivity = this.getRecentActivity(teamId, 10);
    const upcomingDeadlines = this.getUpcomingDeadlines(teamId);
    const activeGoals = this.getTeamGoals(teamId).filter(
      g => g.status !== 'completed' && g.status !== 'cancelled'
    );
    const teamAnnouncements = this.getTeamAnnouncements(teamId);
    const memberHighlights = this.getMemberHighlights(teamData);

    return {
      team: teamData,
      summary,
      healthScore,
      recentActivity,
      upcomingDeadlines,
      activeGoals,
      announcements: teamAnnouncements,
      memberHighlights,
    };
  }

  /**
   * Create or update team goal/OKR
   */
  async upsertGoal(
    teamId: string,
    userId: string,
    goalData: Partial<Goal>
  ): Promise<Goal> {
    const existingGoal = goalData.id ? this.goals.get(goalData.id) : null;

    const goal: Goal = existingGoal ? {
      ...existingGoal,
      ...goalData,
      updatedAt: new Date(),
    } : {
      id: this.generateId(),
      title: goalData.title || 'Untitled Goal',
      description: goalData.description || '',
      type: goalData.type || 'objective',
      parentId: goalData.parentId,
      ownerId: userId,
      ownerName: `User ${userId}`,
      teamId,
      status: 'not_started',
      progress: 0,
      startDate: goalData.startDate || new Date(),
      targetDate: goalData.targetDate || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      keyResults: goalData.keyResults || [],
      metrics: {
        checkInFrequency: 'weekly',
        checkInCount: 0,
        averageProgress: 0,
        velocityTrend: 'steady',
      },
      updates: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.goals.set(goal.id, goal);

    this.recordActivity({
      type: existingGoal ? 'goal_updated' : 'goal_created',
      actor: { id: userId, name: `User ${userId}` },
      action: existingGoal ? 'updated goal' : 'created goal',
      target: { type: 'goal', id: goal.id, name: goal.title },
      teamId,
    });

    this.emit('goal:upserted', { goal, updatedBy: userId });

    return goal;
  }

  /**
   * Update goal progress
   */
  async updateGoalProgress(
    goalId: string,
    userId: string,
    update: {
      progress?: number;
      status?: GoalStatus;
      comment?: string;
      keyResultUpdates?: { id: string; currentValue: number }[];
    }
  ): Promise<Goal> {
    const goal = this.goals.get(goalId);
    if (!goal) {
      throw new Error('Goal not found');
    }

    const previousProgress = goal.progress;

    if (update.progress !== undefined) {
      goal.progress = update.progress;
    }

    if (update.status) {
      goal.status = update.status;
    }

    if (update.keyResultUpdates) {
      for (const krUpdate of update.keyResultUpdates) {
        const kr = goal.keyResults?.find(k => k.id === krUpdate.id);
        if (kr) {
          kr.currentValue = krUpdate.currentValue;
          kr.progress = (kr.currentValue / kr.targetValue) * 100;
          kr.status = this.calculateKRStatus(kr);
        }
      }

      // Recalculate overall progress from key results
      if (goal.keyResults && goal.keyResults.length > 0) {
        goal.progress = goal.keyResults.reduce((sum, kr) => sum + kr.progress, 0) /
          goal.keyResults.length;
      }
    }

    // Add update entry
    goal.updates.push({
      id: this.generateId(),
      authorId: userId,
      authorName: `User ${userId}`,
      content: update.comment || `Progress updated to ${goal.progress}%`,
      progressChange: goal.progress - previousProgress,
      statusChange: update.status,
      createdAt: new Date(),
    });

    goal.metrics.lastCheckIn = new Date();
    goal.metrics.checkInCount++;
    goal.updatedAt = new Date();

    this.emit('goal:progress_updated', { goal, updatedBy: userId });

    return goal;
  }

  /**
   * Get team capacity view
   */
  async getCapacityView(
    teamId: string,
    period: { start: Date; end: Date }
  ): Promise<CapacityView> {
    const team = this.teams.get(teamId);
    if (!team) {
      throw new Error('Team not found');
    }

    const memberCapacity: MemberCapacityDetail[] = team.members.map(member => ({
      memberId: member.userId,
      memberName: member.name,
      totalHours: 40, // Weekly hours
      allocatedHours: member.capacity.allocatedHours,
      availableHours: member.capacity.availableHours,
      utilizationRate: (member.capacity.allocatedHours / 40) * 100,
      tasks: [],
      availability: this.generateAvailabilitySlots(member, period),
    }));

    const totalCapacity = memberCapacity.reduce((sum, m) => sum + m.totalHours, 0);
    const utilizedCapacity = memberCapacity.reduce((sum, m) => sum + m.allocatedHours, 0);

    const projections = this.generateCapacityProjections(memberCapacity, period);
    const recommendations = this.generateCapacityRecommendations(memberCapacity);

    return {
      teamId,
      period,
      totalCapacity,
      utilizedCapacity,
      utilizationRate: totalCapacity > 0 ? (utilizedCapacity / totalCapacity) * 100 : 0,
      memberCapacity,
      projections,
      recommendations,
    };
  }

  /**
   * Get availability calendar
   */
  async getAvailabilityCalendar(
    teamId: string,
    period: { start: Date; end: Date }
  ): Promise<AvailabilityCalendar> {
    const team = this.teams.get(teamId);
    if (!team) {
      throw new Error('Team not found');
    }

    const members: MemberAvailability[] = team.members.map(member => ({
      memberId: member.userId,
      memberName: member.name,
      slots: this.generateCalendarSlots(member, period),
      timeOff: [],
    }));

    return {
      teamId,
      period,
      members,
      teamEvents: [],
      holidays: this.getHolidays(period),
    };
  }

  /**
   * Create team announcement
   */
  async createAnnouncement(
    teamId: string,
    userId: string,
    data: {
      title: string;
      content: string;
      priority?: 'urgent' | 'important' | 'normal';
      pinned?: boolean;
      expiresAt?: Date;
    }
  ): Promise<Announcement> {
    const announcement: Announcement = {
      id: this.generateId(),
      title: data.title,
      content: data.content,
      authorId: userId,
      authorName: `User ${userId}`,
      priority: data.priority || 'normal',
      pinned: data.pinned || false,
      reactions: [],
      acknowledgments: [],
      expiresAt: data.expiresAt,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.announcements.set(announcement.id, announcement);

    // Notify team members
    const team = this.teams.get(teamId);
    if (team) {
      for (const member of team.members) {
        if (member.userId !== userId) {
          this.emit('notification:send', {
            userId: member.userId,
            type: 'announcement',
            title: 'New Team Announcement',
            message: announcement.title,
            data: { announcementId: announcement.id },
          });
        }
      }
    }

    this.emit('announcement:created', { announcement, teamId });

    return announcement;
  }

  /**
   * React to announcement
   */
  async reactToAnnouncement(
    announcementId: string,
    userId: string,
    emoji: string
  ): Promise<Announcement> {
    const announcement = this.announcements.get(announcementId);
    if (!announcement) {
      throw new Error('Announcement not found');
    }

    let reaction = announcement.reactions.find(r => r.emoji === emoji);
    if (!reaction) {
      reaction = { emoji, userIds: [], count: 0 };
      announcement.reactions.push(reaction);
    }

    if (!reaction.userIds.includes(userId)) {
      reaction.userIds.push(userId);
      reaction.count++;
    }

    announcement.updatedAt = new Date();

    return announcement;
  }

  /**
   * Acknowledge announcement
   */
  async acknowledgeAnnouncement(
    announcementId: string,
    userId: string
  ): Promise<Announcement> {
    const announcement = this.announcements.get(announcementId);
    if (!announcement) {
      throw new Error('Announcement not found');
    }

    if (!announcement.acknowledgments.includes(userId)) {
      announcement.acknowledgments.push(userId);
    }

    announcement.updatedAt = new Date();

    return announcement;
  }

  /**
   * Get team metrics
   */
  async getTeamMetrics(
    teamId: string,
    period: { start: Date; end: Date }
  ): Promise<TeamMetrics> {
    return {
      teamId,
      period,
      productivity: {
        tasksCompleted: 45,
        tasksCreated: 52,
        averageCompletionTime: 2.5 * 24 * 60 * 60 * 1000, // 2.5 days
        throughput: 11.25, // tasks per week
        velocity: 85, // story points
      },
      collaboration: {
        commentsCount: 234,
        mentionsCount: 89,
        sharedSignals: 23,
        delegations: 15,
        averageResponseTime: 45 * 60 * 1000, // 45 minutes
      },
      quality: {
        reworkRate: 8.5,
        firstTimeRight: 91.5,
        feedbackScore: 4.2,
        errorRate: 2.3,
      },
      engagement: {
        activeUsers: 12,
        dailyActiveRate: 85,
        averageSessionDuration: 45 * 60 * 1000, // 45 minutes
        featureAdoption: {
          signals: 95,
          decisions: 78,
          delegation: 65,
          collaboration: 82,
        },
      },
      trends: this.generateMetricTrends(period),
    };
  }

  /**
   * Update member availability
   */
  async updateMemberAvailability(
    teamId: string,
    userId: string,
    availability: {
      status: 'available' | 'busy' | 'away' | 'offline' | 'dnd';
      message?: string;
      until?: Date;
    }
  ): Promise<TeamMember> {
    const team = this.teams.get(teamId);
    if (!team) {
      throw new Error('Team not found');
    }

    const member = team.members.find(m => m.userId === userId);
    if (!member) {
      throw new Error('Member not found');
    }

    member.status = {
      availability: availability.status,
      statusMessage: availability.message,
      statusUntil: availability.until,
      lastActive: new Date(),
    };

    this.emit('member:availability_updated', {
      teamId,
      memberId: userId,
      availability: member.status,
    });

    return member;
  }

  /**
   * Get team goals
   */
  getTeamGoals(teamId: string): Goal[] {
    return Array.from(this.goals.values()).filter(g => g.teamId === teamId);
  }

  // Helper methods
  private generateId(): string {
    return `team_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private createDefaultTeam(teamId: string): Team {
    return {
      id: teamId,
      name: 'Default Team',
      description: 'Team workspace',
      ownerId: 'owner',
      members: [
        {
          userId: 'member1',
          name: 'Alice Johnson',
          email: 'alice@example.com',
          role: 'admin',
          joinedAt: new Date(),
          status: { availability: 'available', lastActive: new Date() },
          capacity: { maxCapacity: 100, currentLoad: 65, allocatedHours: 26, availableHours: 14, upcomingCommitments: 3 },
          skills: ['strategy', 'analysis'],
        },
        {
          userId: 'member2',
          name: 'Bob Smith',
          email: 'bob@example.com',
          role: 'member',
          joinedAt: new Date(),
          status: { availability: 'busy', lastActive: new Date() },
          capacity: { maxCapacity: 100, currentLoad: 85, allocatedHours: 34, availableHours: 6, upcomingCommitments: 5 },
          skills: ['development', 'architecture'],
        },
        {
          userId: 'member3',
          name: 'Carol Davis',
          email: 'carol@example.com',
          role: 'member',
          joinedAt: new Date(),
          status: { availability: 'available', lastActive: new Date() },
          capacity: { maxCapacity: 100, currentLoad: 45, allocatedHours: 18, availableHours: 22, upcomingCommitments: 2 },
          skills: ['design', 'research'],
        },
      ],
      settings: {
        defaultPermissions: 'member',
        allowGuestAccess: false,
        requireApprovalToJoin: true,
        notificationDefaults: {
          announcements: true,
          goalUpdates: true,
          capacityAlerts: true,
          memberChanges: true,
        },
        workingHours: {
          enabled: true,
          schedule: [
            { day: 1, enabled: true, startHour: 9, endHour: 17 },
            { day: 2, enabled: true, startHour: 9, endHour: 17 },
            { day: 3, enabled: true, startHour: 9, endHour: 17 },
            { day: 4, enabled: true, startHour: 9, endHour: 17 },
            { day: 5, enabled: true, startHour: 9, endHour: 17 },
          ],
        },
        timezone: 'America/New_York',
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  private calculateTeamSummary(team: Team): TeamSummary {
    const activeMembers = team.members.filter(m =>
      m.status.availability !== 'offline'
    ).length;

    const totalCapacity = team.members.reduce((sum, m) => sum + m.capacity.maxCapacity, 0);
    const utilizedCapacity = team.members.reduce((sum, m) => sum + m.capacity.currentLoad, 0);

    return {
      memberCount: team.members.length,
      activeMembers,
      totalCapacity,
      utilizedCapacity,
      openTasks: 24,
      completedTasksThisWeek: 12,
      pendingDecisions: 5,
      activeSignals: 8,
    };
  }

  private calculateHealthScore(team: Team): TeamHealthScore {
    const workloadBalance = this.calculateWorkloadBalance(team);
    const goalProgress = 72;
    const collaboration = 85;
    const responsiveness = 78;
    const morale = 80;

    const overall = (workloadBalance + goalProgress + collaboration + responsiveness + morale) / 5;

    const alerts: HealthAlert[] = [];
    if (workloadBalance < 60) {
      alerts.push({
        type: 'warning',
        category: 'workload',
        message: 'Uneven workload distribution detected',
        affectedMembers: team.members.filter(m => m.capacity.currentLoad > 80).map(m => m.userId),
        suggestedAction: 'Consider redistributing tasks from overloaded members',
      });
    }

    return {
      overall,
      components: {
        workloadBalance,
        goalProgress,
        collaboration,
        responsiveness,
        morale,
      },
      trend: overall > 75 ? 'improving' : overall > 60 ? 'stable' : 'declining',
      alerts,
    };
  }

  private calculateWorkloadBalance(team: Team): number {
    const loads = team.members.map(m => m.capacity.currentLoad);
    const avg = loads.reduce((a, b) => a + b, 0) / loads.length;
    const variance = loads.reduce((acc, load) => acc + Math.pow(load - avg, 2), 0) / loads.length;
    const stdDev = Math.sqrt(variance);

    // Lower std deviation = better balance
    return Math.max(0, 100 - stdDev * 2);
  }

  private getRecentActivity(teamId: string, limit: number): ActivityEntry[] {
    return this.activities
      .filter(a => (a as any).teamId === teamId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  private getUpcomingDeadlines(teamId: string): Deadline[] {
    const goals = this.getTeamGoals(teamId);
    return goals
      .filter(g => g.targetDate > new Date())
      .map(g => ({
        id: g.id,
        title: g.title,
        dueDate: g.targetDate,
        type: 'goal' as const,
        assignees: [g.ownerId],
        priority: g.status === 'at_risk' ? 'high' as const : 'medium' as const,
        progress: g.progress,
      }))
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
      .slice(0, 5);
  }

  private getTeamAnnouncements(teamId: string): Announcement[] {
    return Array.from(this.announcements.values())
      .filter(a => !a.expiresAt || a.expiresAt > new Date())
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return b.createdAt.getTime() - a.createdAt.getTime();
      })
      .slice(0, 5);
  }

  private getMemberHighlights(team: Team): MemberHighlight[] {
    return team.members.slice(0, 3).map(member => ({
      memberId: member.userId,
      memberName: member.name,
      type: 'achievement' as const,
      title: 'Great work on recent tasks',
      date: new Date(),
    }));
  }

  private generateAvailabilitySlots(
    member: TeamMember,
    period: { start: Date; end: Date }
  ): AvailabilitySlot[] {
    const slots: AvailabilitySlot[] = [];
    const current = new Date(period.start);

    while (current <= period.end) {
      slots.push({
        date: new Date(current),
        available: member.status.availability === 'available',
        hours: 8,
      });
      current.setDate(current.getDate() + 1);
    }

    return slots;
  }

  private generateCalendarSlots(
    member: TeamMember,
    period: { start: Date; end: Date }
  ): CalendarSlot[] {
    const slots: CalendarSlot[] = [];
    const current = new Date(period.start);

    while (current <= period.end) {
      for (let hour = 9; hour < 17; hour++) {
        slots.push({
          date: new Date(current),
          hour,
          status: member.status.availability === 'available' ? 'available' : 'busy',
        });
      }
      current.setDate(current.getDate() + 1);
    }

    return slots;
  }

  private generateCapacityProjections(
    memberCapacity: MemberCapacityDetail[],
    period: { start: Date; end: Date }
  ): CapacityProjection[] {
    const projections: CapacityProjection[] = [];
    const current = new Date(period.start);

    while (current <= period.end) {
      projections.push({
        date: new Date(current),
        projectedUtilization: 70 + Math.random() * 20,
        projectedAvailability: 20 + Math.random() * 10,
        confidence: 80 - (current.getTime() - period.start.getTime()) / (24 * 60 * 60 * 1000) * 2,
      });
      current.setDate(current.getDate() + 7);
    }

    return projections;
  }

  private generateCapacityRecommendations(
    memberCapacity: MemberCapacityDetail[]
  ): CapacityRecommendation[] {
    const recommendations: CapacityRecommendation[] = [];

    const overloaded = memberCapacity.filter(m => m.utilizationRate > 85);
    const underutilized = memberCapacity.filter(m => m.utilizationRate < 50);

    if (overloaded.length > 0 && underutilized.length > 0) {
      recommendations.push({
        type: 'redistribute',
        description: `Redistribute tasks from ${overloaded[0].memberName} to ${underutilized[0].memberName}`,
        impact: 15,
        affectedMembers: [overloaded[0].memberId, underutilized[0].memberId],
      });
    }

    return recommendations;
  }

  private getHolidays(period: { start: Date; end: Date }): Holiday[] {
    return [];
  }

  private generateMetricTrends(period: { start: Date; end: Date }): MetricTrend[] {
    const trends: MetricTrend[] = [];
    const current = new Date(period.start);

    while (current <= period.end) {
      trends.push({
        date: new Date(current),
        metrics: {
          productivity: 70 + Math.random() * 20,
          collaboration: 75 + Math.random() * 15,
          quality: 85 + Math.random() * 10,
          engagement: 80 + Math.random() * 15,
        },
      });
      current.setDate(current.getDate() + 7);
    }

    return trends;
  }

  private calculateKRStatus(kr: KeyResult): GoalStatus {
    if (kr.progress >= 100) return 'completed';
    if (kr.progress >= 70) return 'on_track';
    if (kr.progress >= 50) return 'at_risk';
    return 'behind';
  }

  private recordActivity(activity: Omit<ActivityEntry, 'id' | 'timestamp'> & { teamId: string }) {
    this.activities.push({
      id: this.generateId(),
      ...activity,
      timestamp: new Date(),
    });
  }
}

export const teamWorkspaceService = new TeamWorkspaceService();
export default teamWorkspaceService;
