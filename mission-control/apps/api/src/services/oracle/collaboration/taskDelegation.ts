/**
 * ORACLE Task Delegation Service
 *
 * Manages task delegation between team members with intelligent
 * load balancing, skill matching, and comprehensive tracking.
 */

import { EventEmitter } from 'events';

// Types
export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  skills: Skill[];
  currentLoad: number; // 0-100 percentage
  maxCapacity: number;
  availability: AvailabilityStatus;
  timezone: string;
  preferences: DelegationPreferences;
}

export interface Skill {
  id: string;
  name: string;
  category: string;
  proficiencyLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  verified: boolean;
  endorsements: number;
}

export interface AvailabilityStatus {
  status: 'available' | 'busy' | 'away' | 'offline' | 'dnd';
  until?: Date;
  message?: string;
  scheduledAvailability?: ScheduleBlock[];
}

export interface ScheduleBlock {
  dayOfWeek: number;
  startHour: number;
  endHour: number;
  timezone: string;
}

export interface DelegationPreferences {
  acceptAutoDelegation: boolean;
  preferredTaskTypes: string[];
  excludedTaskTypes: string[];
  maxConcurrentTasks: number;
  notifyOnDelegation: boolean;
  autoAcceptFromUsers: string[];
}

export interface DelegatedTask {
  id: string;
  originalTaskId: string;
  title: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  delegatedBy: string;
  delegatedTo: string;
  delegatedAt: Date;
  deadline?: Date;
  status: DelegationStatus;
  context: DelegationContext;
  history: DelegationHistoryEntry[];
  metrics: DelegationMetrics;
}

export type DelegationStatus =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'in_progress'
  | 'completed'
  | 'returned'
  | 'escalated'
  | 'cancelled';

export interface DelegationContext {
  notes: string;
  attachments: Attachment[];
  relatedSignals: string[];
  relatedDecisions: string[];
  previousOwners: string[];
  requiredSkills: string[];
  estimatedEffort: string;
  backgroundInfo: string;
}

export interface Attachment {
  id: string;
  name: string;
  type: string;
  url: string;
  size: number;
  uploadedAt: Date;
}

export interface DelegationHistoryEntry {
  id: string;
  action: DelegationAction;
  performedBy: string;
  performedAt: Date;
  notes?: string;
  previousState?: Partial<DelegatedTask>;
}

export type DelegationAction =
  | 'created'
  | 'accepted'
  | 'rejected'
  | 'started'
  | 'completed'
  | 'returned'
  | 'escalated'
  | 'reassigned'
  | 'deadline_extended'
  | 'context_added'
  | 'cancelled';

export interface DelegationMetrics {
  responseTime?: number; // ms to accept/reject
  completionTime?: number; // ms to complete
  qualityScore?: number; // 1-5
  feedbackNotes?: string;
}

export interface DelegationRequest {
  taskId: string;
  delegateTo: string;
  deadline?: Date;
  priority: 'critical' | 'high' | 'medium' | 'low';
  context: Partial<DelegationContext>;
  autoAccept?: boolean;
}

export interface DelegationSuggestion {
  memberId: string;
  memberName: string;
  score: number;
  reasons: string[];
  concerns: string[];
  currentLoad: number;
  estimatedCompletionTime: Date;
  skillMatch: number;
  availabilityMatch: number;
}

export interface LoadBalanceSuggestion {
  currentDistribution: TeamLoadDistribution;
  suggestedReassignments: ReassignmentSuggestion[];
  expectedImprovement: number;
  reasoning: string;
}

export interface TeamLoadDistribution {
  members: MemberLoad[];
  averageLoad: number;
  maxLoad: number;
  minLoad: number;
  standardDeviation: number;
}

export interface MemberLoad {
  memberId: string;
  memberName: string;
  currentLoad: number;
  taskCount: number;
  criticalTasks: number;
  upcomingDeadlines: number;
}

export interface ReassignmentSuggestion {
  taskId: string;
  taskTitle: string;
  fromMember: string;
  toMember: string;
  reason: string;
  loadImpact: {
    fromMemberNewLoad: number;
    toMemberNewLoad: number;
  };
}

export interface DelegationAnalytics {
  period: { start: Date; end: Date };
  totalDelegations: number;
  acceptanceRate: number;
  averageResponseTime: number;
  averageCompletionTime: number;
  onTimeCompletionRate: number;
  averageQualityScore: number;
  topDelegators: DelegatorStats[];
  topDelegatees: DelegateeStats[];
  skillUtilization: SkillUtilization[];
  bottlenecks: Bottleneck[];
  trends: DelegationTrend[];
}

export interface DelegatorStats {
  memberId: string;
  memberName: string;
  delegationCount: number;
  avgResponseTime: number;
  successRate: number;
}

export interface DelegateeStats {
  memberId: string;
  memberName: string;
  tasksReceived: number;
  tasksCompleted: number;
  avgCompletionTime: number;
  qualityScore: number;
}

export interface SkillUtilization {
  skillId: string;
  skillName: string;
  demandCount: number;
  availableMembers: number;
  utilizationRate: number;
}

export interface Bottleneck {
  type: 'skill_gap' | 'overload' | 'availability' | 'response_time';
  description: string;
  impact: 'high' | 'medium' | 'low';
  affectedMembers: string[];
  suggestedActions: string[];
}

export interface DelegationTrend {
  date: Date;
  delegations: number;
  acceptances: number;
  completions: number;
  avgResponseTime: number;
}

// Service Implementation
class TaskDelegationService extends EventEmitter {
  private delegations: Map<string, DelegatedTask> = new Map();
  private teamMembers: Map<string, TeamMember> = new Map();

  constructor() {
    super();
  }

  /**
   * Delegate a task to a team member
   */
  async delegateTask(
    delegatorId: string,
    request: DelegationRequest
  ): Promise<DelegatedTask> {
    const delegatee = this.teamMembers.get(request.delegateTo);
    if (!delegatee) {
      throw new Error('Delegatee not found');
    }

    // Check if delegatee can accept more tasks
    if (delegatee.currentLoad >= delegatee.maxCapacity) {
      throw new Error('Delegatee is at maximum capacity');
    }

    const delegation: DelegatedTask = {
      id: this.generateId(),
      originalTaskId: request.taskId,
      title: `Delegated Task ${request.taskId}`,
      description: '',
      priority: request.priority,
      delegatedBy: delegatorId,
      delegatedTo: request.delegateTo,
      delegatedAt: new Date(),
      deadline: request.deadline,
      status: request.autoAccept ? 'accepted' : 'pending',
      context: {
        notes: request.context.notes || '',
        attachments: request.context.attachments || [],
        relatedSignals: request.context.relatedSignals || [],
        relatedDecisions: request.context.relatedDecisions || [],
        previousOwners: [delegatorId],
        requiredSkills: request.context.requiredSkills || [],
        estimatedEffort: request.context.estimatedEffort || '',
        backgroundInfo: request.context.backgroundInfo || '',
      },
      history: [
        {
          id: this.generateId(),
          action: 'created',
          performedBy: delegatorId,
          performedAt: new Date(),
          notes: 'Task delegated',
        },
      ],
      metrics: {},
    };

    if (request.autoAccept) {
      delegation.history.push({
        id: this.generateId(),
        action: 'accepted',
        performedBy: request.delegateTo,
        performedAt: new Date(),
        notes: 'Auto-accepted based on preferences',
      });
    }

    this.delegations.set(delegation.id, delegation);

    this.emit('delegation:created', {
      delegation,
      delegator: delegatorId,
      delegatee: request.delegateTo,
    });

    // Notify delegatee
    this.emit('notification:send', {
      userId: request.delegateTo,
      type: 'task_delegated',
      title: 'New Task Delegated',
      message: `You have been assigned a new task: ${delegation.title}`,
      data: { delegationId: delegation.id },
    });

    return delegation;
  }

  /**
   * Delegate with comprehensive context transfer
   */
  async delegateWithContext(
    delegatorId: string,
    taskId: string,
    delegateTo: string,
    context: DelegationContext,
    options: {
      deadline?: Date;
      priority?: 'critical' | 'high' | 'medium' | 'low';
      notifyVia?: ('push' | 'email' | 'in_app')[];
      requireAcknowledgment?: boolean;
    } = {}
  ): Promise<DelegatedTask> {
    const delegation = await this.delegateTask(delegatorId, {
      taskId,
      delegateTo,
      deadline: options.deadline,
      priority: options.priority || 'medium',
      context,
    });

    // Add comprehensive context
    delegation.context = context;

    // Track context transfer quality
    const contextScore = this.calculateContextCompleteness(context);

    this.emit('delegation:context_transferred', {
      delegationId: delegation.id,
      contextScore,
      hasAttachments: context.attachments.length > 0,
      hasRelatedSignals: context.relatedSignals.length > 0,
    });

    return delegation;
  }

  /**
   * Accept a delegated task
   */
  async acceptDelegation(
    delegationId: string,
    userId: string,
    notes?: string
  ): Promise<DelegatedTask> {
    const delegation = this.delegations.get(delegationId);
    if (!delegation) {
      throw new Error('Delegation not found');
    }

    if (delegation.delegatedTo !== userId) {
      throw new Error('Not authorized to accept this delegation');
    }

    if (delegation.status !== 'pending') {
      throw new Error('Delegation is not in pending status');
    }

    const responseTime = Date.now() - delegation.delegatedAt.getTime();

    delegation.status = 'accepted';
    delegation.metrics.responseTime = responseTime;
    delegation.history.push({
      id: this.generateId(),
      action: 'accepted',
      performedBy: userId,
      performedAt: new Date(),
      notes,
    });

    this.emit('delegation:accepted', {
      delegationId,
      acceptedBy: userId,
      responseTime,
    });

    // Notify delegator
    this.emit('notification:send', {
      userId: delegation.delegatedBy,
      type: 'delegation_accepted',
      title: 'Delegation Accepted',
      message: `Your delegated task has been accepted`,
      data: { delegationId },
    });

    return delegation;
  }

  /**
   * Reject a delegated task
   */
  async rejectDelegation(
    delegationId: string,
    userId: string,
    reason: string
  ): Promise<DelegatedTask> {
    const delegation = this.delegations.get(delegationId);
    if (!delegation) {
      throw new Error('Delegation not found');
    }

    if (delegation.delegatedTo !== userId) {
      throw new Error('Not authorized to reject this delegation');
    }

    if (delegation.status !== 'pending') {
      throw new Error('Delegation is not in pending status');
    }

    const responseTime = Date.now() - delegation.delegatedAt.getTime();

    delegation.status = 'rejected';
    delegation.metrics.responseTime = responseTime;
    delegation.history.push({
      id: this.generateId(),
      action: 'rejected',
      performedBy: userId,
      performedAt: new Date(),
      notes: reason,
    });

    this.emit('delegation:rejected', {
      delegationId,
      rejectedBy: userId,
      reason,
      responseTime,
    });

    // Notify delegator
    this.emit('notification:send', {
      userId: delegation.delegatedBy,
      type: 'delegation_rejected',
      title: 'Delegation Rejected',
      message: `Your delegated task was rejected: ${reason}`,
      data: { delegationId, reason },
    });

    return delegation;
  }

  /**
   * Track delegation progress
   */
  async trackDelegation(delegationId: string): Promise<{
    delegation: DelegatedTask;
    progress: number;
    estimatedCompletion?: Date;
    blockers: string[];
  }> {
    const delegation = this.delegations.get(delegationId);
    if (!delegation) {
      throw new Error('Delegation not found');
    }

    // Calculate progress based on status
    const progressMap: Record<DelegationStatus, number> = {
      pending: 0,
      accepted: 10,
      rejected: 0,
      in_progress: 50,
      completed: 100,
      returned: 0,
      escalated: 25,
      cancelled: 0,
    };

    const progress = progressMap[delegation.status];

    // Estimate completion based on similar tasks
    const estimatedCompletion = delegation.deadline ||
      new Date(Date.now() + 24 * 60 * 60 * 1000);

    return {
      delegation,
      progress,
      estimatedCompletion,
      blockers: [],
    };
  }

  /**
   * Get load balancing suggestions
   */
  async getLoadBalanceSuggestions(teamId: string): Promise<LoadBalanceSuggestion> {
    const members = Array.from(this.teamMembers.values());
    const delegations = Array.from(this.delegations.values());

    // Calculate current distribution
    const memberLoads: MemberLoad[] = members.map(member => {
      const memberDelegations = delegations.filter(
        d => d.delegatedTo === member.id &&
        ['pending', 'accepted', 'in_progress'].includes(d.status)
      );

      return {
        memberId: member.id,
        memberName: member.name,
        currentLoad: member.currentLoad,
        taskCount: memberDelegations.length,
        criticalTasks: memberDelegations.filter(d => d.priority === 'critical').length,
        upcomingDeadlines: memberDelegations.filter(
          d => d.deadline && d.deadline.getTime() - Date.now() < 24 * 60 * 60 * 1000
        ).length,
      };
    });

    const loads = memberLoads.map(m => m.currentLoad);
    const averageLoad = loads.reduce((a, b) => a + b, 0) / loads.length || 0;
    const maxLoad = Math.max(...loads, 0);
    const minLoad = Math.min(...loads, 100);
    const variance = loads.reduce((acc, load) =>
      acc + Math.pow(load - averageLoad, 2), 0) / loads.length;
    const standardDeviation = Math.sqrt(variance);

    const currentDistribution: TeamLoadDistribution = {
      members: memberLoads,
      averageLoad,
      maxLoad,
      minLoad,
      standardDeviation,
    };

    // Generate reassignment suggestions
    const suggestedReassignments: ReassignmentSuggestion[] = [];

    // Find overloaded members
    const overloaded = memberLoads.filter(m => m.currentLoad > averageLoad + 20);
    const underloaded = memberLoads.filter(m => m.currentLoad < averageLoad - 20);

    for (const overMember of overloaded) {
      for (const underMember of underloaded) {
        // Find a task to reassign
        const tasksToReassign = delegations.filter(
          d => d.delegatedTo === overMember.memberId &&
          d.status === 'pending' &&
          d.priority !== 'critical'
        );

        if (tasksToReassign.length > 0) {
          const task = tasksToReassign[0];
          suggestedReassignments.push({
            taskId: task.id,
            taskTitle: task.title,
            fromMember: overMember.memberId,
            toMember: underMember.memberId,
            reason: `${overMember.memberName} is overloaded (${overMember.currentLoad}%), ${underMember.memberName} has capacity (${underMember.currentLoad}%)`,
            loadImpact: {
              fromMemberNewLoad: overMember.currentLoad - 10,
              toMemberNewLoad: underMember.currentLoad + 10,
            },
          });
        }
      }
    }

    const expectedImprovement = suggestedReassignments.length > 0
      ? (standardDeviation - (standardDeviation * 0.7)) / standardDeviation * 100
      : 0;

    return {
      currentDistribution,
      suggestedReassignments,
      expectedImprovement,
      reasoning: standardDeviation > 15
        ? 'Significant load imbalance detected. Reassignments recommended.'
        : 'Load distribution is relatively balanced.',
    };
  }

  /**
   * Get skill-based delegation suggestions
   */
  async getSkillBasedSuggestions(
    taskId: string,
    requiredSkills: string[]
  ): Promise<DelegationSuggestion[]> {
    const members = Array.from(this.teamMembers.values());
    const suggestions: DelegationSuggestion[] = [];

    for (const member of members) {
      if (member.availability.status === 'offline' ||
          member.availability.status === 'dnd') {
        continue;
      }

      // Calculate skill match
      const memberSkillIds = member.skills.map(s => s.id);
      const matchedSkills = requiredSkills.filter(s => memberSkillIds.includes(s));
      const skillMatch = requiredSkills.length > 0
        ? (matchedSkills.length / requiredSkills.length) * 100
        : 50;

      // Calculate availability match
      const availabilityMatch = member.availability.status === 'available' ? 100 :
        member.availability.status === 'busy' ? 50 : 25;

      // Calculate overall score
      const loadFactor = (100 - member.currentLoad) / 100;
      const score = (skillMatch * 0.4 + availabilityMatch * 0.3 + loadFactor * 100 * 0.3);

      const reasons: string[] = [];
      const concerns: string[] = [];

      if (skillMatch >= 80) {
        reasons.push(`Strong skill match (${skillMatch.toFixed(0)}%)`);
      } else if (skillMatch >= 50) {
        reasons.push(`Moderate skill match (${skillMatch.toFixed(0)}%)`);
      } else {
        concerns.push(`Limited skill match (${skillMatch.toFixed(0)}%)`);
      }

      if (member.currentLoad < 50) {
        reasons.push('Has capacity for new tasks');
      } else if (member.currentLoad > 80) {
        concerns.push('Currently at high capacity');
      }

      if (member.availability.status === 'available') {
        reasons.push('Currently available');
      } else {
        concerns.push(`Status: ${member.availability.status}`);
      }

      // Estimate completion time
      const estimatedHours = 8; // Default estimate
      const estimatedCompletionTime = new Date(
        Date.now() + estimatedHours * 60 * 60 * 1000
      );

      suggestions.push({
        memberId: member.id,
        memberName: member.name,
        score,
        reasons,
        concerns,
        currentLoad: member.currentLoad,
        estimatedCompletionTime,
        skillMatch,
        availabilityMatch,
      });
    }

    // Sort by score descending
    return suggestions.sort((a, b) => b.score - a.score);
  }

  /**
   * Get delegation analytics
   */
  async getDelegationAnalytics(
    teamId: string,
    period: { start: Date; end: Date }
  ): Promise<DelegationAnalytics> {
    const delegations = Array.from(this.delegations.values()).filter(
      d => d.delegatedAt >= period.start && d.delegatedAt <= period.end
    );

    const accepted = delegations.filter(d =>
      ['accepted', 'in_progress', 'completed'].includes(d.status)
    );
    const completed = delegations.filter(d => d.status === 'completed');

    // Calculate metrics
    const acceptanceRate = delegations.length > 0
      ? (accepted.length / delegations.length) * 100
      : 0;

    const responseTimes = delegations
      .filter(d => d.metrics.responseTime)
      .map(d => d.metrics.responseTime!);
    const averageResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      : 0;

    const completionTimes = completed
      .filter(d => d.metrics.completionTime)
      .map(d => d.metrics.completionTime!);
    const averageCompletionTime = completionTimes.length > 0
      ? completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length
      : 0;

    const onTimeCompleted = completed.filter(
      d => !d.deadline || d.history.find(h => h.action === 'completed')!.performedAt <= d.deadline
    );
    const onTimeCompletionRate = completed.length > 0
      ? (onTimeCompleted.length / completed.length) * 100
      : 0;

    const qualityScores = completed
      .filter(d => d.metrics.qualityScore)
      .map(d => d.metrics.qualityScore!);
    const averageQualityScore = qualityScores.length > 0
      ? qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length
      : 0;

    // Top delegators
    const delegatorCounts = new Map<string, number>();
    delegations.forEach(d => {
      const count = delegatorCounts.get(d.delegatedBy) || 0;
      delegatorCounts.set(d.delegatedBy, count + 1);
    });

    const topDelegators: DelegatorStats[] = Array.from(delegatorCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([memberId, count]) => ({
        memberId,
        memberName: this.teamMembers.get(memberId)?.name || 'Unknown',
        delegationCount: count,
        avgResponseTime: 0,
        successRate: 0,
      }));

    // Top delegatees
    const delegateeCounts = new Map<string, number>();
    delegations.forEach(d => {
      const count = delegateeCounts.get(d.delegatedTo) || 0;
      delegateeCounts.set(d.delegatedTo, count + 1);
    });

    const topDelegatees: DelegateeStats[] = Array.from(delegateeCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([memberId, count]) => {
        const memberCompleted = completed.filter(d => d.delegatedTo === memberId);
        return {
          memberId,
          memberName: this.teamMembers.get(memberId)?.name || 'Unknown',
          tasksReceived: count,
          tasksCompleted: memberCompleted.length,
          avgCompletionTime: 0,
          qualityScore: 0,
        };
      });

    // Generate trends
    const trends: DelegationTrend[] = this.generateTrends(delegations, period);

    // Identify bottlenecks
    const bottlenecks: Bottleneck[] = this.identifyBottlenecks(delegations);

    return {
      period,
      totalDelegations: delegations.length,
      acceptanceRate,
      averageResponseTime,
      averageCompletionTime,
      onTimeCompletionRate,
      averageQualityScore,
      topDelegators,
      topDelegatees,
      skillUtilization: [],
      bottlenecks,
      trends,
    };
  }

  /**
   * Get all delegations for a user
   */
  async getUserDelegations(
    userId: string,
    options: {
      asDelegate?: boolean;
      asDelegator?: boolean;
      status?: DelegationStatus[];
    } = {}
  ): Promise<DelegatedTask[]> {
    return Array.from(this.delegations.values()).filter(d => {
      const matchesUser =
        (options.asDelegate !== false && d.delegatedTo === userId) ||
        (options.asDelegator !== false && d.delegatedBy === userId);

      const matchesStatus = !options.status ||
        options.status.includes(d.status);

      return matchesUser && matchesStatus;
    });
  }

  /**
   * Mark delegation as complete
   */
  async completeDelegation(
    delegationId: string,
    userId: string,
    feedback?: { qualityScore: number; notes: string }
  ): Promise<DelegatedTask> {
    const delegation = this.delegations.get(delegationId);
    if (!delegation) {
      throw new Error('Delegation not found');
    }

    const startTime = delegation.history.find(h => h.action === 'started')?.performedAt ||
      delegation.history.find(h => h.action === 'accepted')?.performedAt ||
      delegation.delegatedAt;

    delegation.status = 'completed';
    delegation.metrics.completionTime = Date.now() - startTime.getTime();

    if (feedback) {
      delegation.metrics.qualityScore = feedback.qualityScore;
      delegation.metrics.feedbackNotes = feedback.notes;
    }

    delegation.history.push({
      id: this.generateId(),
      action: 'completed',
      performedBy: userId,
      performedAt: new Date(),
    });

    this.emit('delegation:completed', {
      delegationId,
      completedBy: userId,
      metrics: delegation.metrics,
    });

    return delegation;
  }

  // Helper methods
  private generateId(): string {
    return `del_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private calculateContextCompleteness(context: DelegationContext): number {
    let score = 0;
    if (context.notes && context.notes.length > 50) score += 20;
    if (context.attachments.length > 0) score += 20;
    if (context.relatedSignals.length > 0) score += 15;
    if (context.requiredSkills.length > 0) score += 15;
    if (context.estimatedEffort) score += 15;
    if (context.backgroundInfo && context.backgroundInfo.length > 50) score += 15;
    return score;
  }

  private generateTrends(
    delegations: DelegatedTask[],
    period: { start: Date; end: Date }
  ): DelegationTrend[] {
    const trends: DelegationTrend[] = [];
    const dayMs = 24 * 60 * 60 * 1000;

    for (let date = new Date(period.start); date <= period.end; date = new Date(date.getTime() + dayMs)) {
      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(date);
      dayEnd.setHours(23, 59, 59, 999);

      const dayDelegations = delegations.filter(
        d => d.delegatedAt >= dayStart && d.delegatedAt <= dayEnd
      );

      trends.push({
        date: dayStart,
        delegations: dayDelegations.length,
        acceptances: dayDelegations.filter(d =>
          ['accepted', 'in_progress', 'completed'].includes(d.status)
        ).length,
        completions: dayDelegations.filter(d => d.status === 'completed').length,
        avgResponseTime: 0,
      });
    }

    return trends;
  }

  private identifyBottlenecks(delegations: DelegatedTask[]): Bottleneck[] {
    const bottlenecks: Bottleneck[] = [];

    // Check for slow response times
    const pendingDelegations = delegations.filter(d => d.status === 'pending');
    const oldPending = pendingDelegations.filter(
      d => Date.now() - d.delegatedAt.getTime() > 24 * 60 * 60 * 1000
    );

    if (oldPending.length > 0) {
      bottlenecks.push({
        type: 'response_time',
        description: `${oldPending.length} delegations pending for more than 24 hours`,
        impact: 'high',
        affectedMembers: [...new Set(oldPending.map(d => d.delegatedTo))],
        suggestedActions: [
          'Send reminders to pending assignees',
          'Consider reassigning stale delegations',
        ],
      });
    }

    return bottlenecks;
  }
}

export const taskDelegationService = new TaskDelegationService();
export default taskDelegationService;
