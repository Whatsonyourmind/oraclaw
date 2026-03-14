/**
 * ORACLE Workload Balancing Service
 * Story smart-4 - Detect and fix team overload
 *
 * Implements:
 * - Per-person workload calculation (hours, complexity)
 * - Skill-based task matching
 * - Redistribution algorithm minimizing disruption
 * - Impact analysis (deadline shifts, dependencies)
 * - Team approval workflow integration
 *
 * Time Complexity:
 * - Workload calculation: O(t * m) where t=tasks, m=team members
 * - Skill matching: O(t * m * s) where s=skills per person
 * - Redistribution: O(t * m^2) using Hungarian algorithm variant
 * - Impact analysis: O(t * d) where d=average dependencies
 */

import { oracleCacheService, cacheKey, hashObject } from '../cache';

// ============================================================================
// Types
// ============================================================================

/**
 * Skill definition
 */
export interface Skill {
  id: string;
  name: string;
  category: string;
  level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  yearsExperience?: number;
}

/**
 * Team member with capacity and skills
 */
export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  skills: Skill[];
  weeklyCapacityHours: number;
  currentUtilization: number; // 0-1
  availabilityFactor: number; // 0-1, accounts for PTO, meetings, etc.
  preferences: {
    preferredTaskTypes: string[];
    avoidTaskTypes: string[];
    maxTaskComplexity: number;
    preferredTeammates?: string[];
  };
  timezone: string;
  isActive: boolean;
}

/**
 * Task definition
 */
export interface Task {
  id: string;
  title: string;
  description: string;
  estimatedHours: number;
  complexity: number; // 1-10
  priority: 'critical' | 'high' | 'medium' | 'low';
  requiredSkills: Array<{
    skillId: string;
    skillName: string;
    minLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  }>;
  assigneeId?: string;
  deadline: Date;
  startDate?: Date;
  dependencies: string[]; // Task IDs
  dependents: string[]; // Tasks that depend on this one
  status: 'pending' | 'in_progress' | 'blocked' | 'completed';
  tags: string[];
  projectId: string;
}

/**
 * Workload metrics for a team member
 */
export interface WorkloadMetrics {
  memberId: string;
  memberName: string;
  allocatedHours: number;
  capacityHours: number;
  utilizationRate: number; // 0-1+
  complexityScore: number; // Average complexity of assigned tasks
  taskCount: number;
  criticalTaskCount: number;
  overloadRisk: 'none' | 'low' | 'medium' | 'high' | 'severe';
  availableHours: number;
  skillCoverage: number; // 0-1, how well tasks match skills
  bottleneckScore: number; // How much this person blocks others
  burnoutRisk: number; // 0-1
  tasks: Task[];
}

/**
 * Redistribution suggestion
 */
export interface RedistributionSuggestion {
  taskId: string;
  taskTitle: string;
  currentAssigneeId: string;
  currentAssigneeName: string;
  suggestedAssigneeId: string;
  suggestedAssigneeName: string;
  reason: string;
  skillMatchScore: number;
  capacityImprovementScore: number;
  disruptionScore: number; // Lower is better
  deadlineImpact: number; // Days shifted (negative = earlier, positive = later)
  overallScore: number;
  dependencies: {
    blockedTasks: string[];
    dependencyShifts: Array<{
      taskId: string;
      newDeadline: Date;
      shiftDays: number;
    }>;
  };
}

/**
 * Redistribution plan
 */
export interface RedistributionPlan {
  id: string;
  createdAt: Date;
  suggestions: RedistributionSuggestion[];
  totalImprovementScore: number;
  workloadBalanceImprovement: number; // 0-1
  capacityOptimization: number; // 0-1
  disruptionLevel: 'minimal' | 'moderate' | 'significant';
  affectedMembers: string[];
  affectedTasks: string[];
  estimatedTimeToComplete: number; // Hours to implement the changes
  risks: string[];
  approvalStatus: 'pending' | 'approved' | 'rejected' | 'partial';
  approvals: Array<{
    memberId: string;
    approved: boolean;
    comments?: string;
    timestamp: Date;
  }>;
}

/**
 * Impact analysis result
 */
export interface ImpactAnalysis {
  taskId: string;
  reassignmentScenario: {
    fromMemberId: string;
    toMemberId: string;
  };
  deadlineAnalysis: {
    originalDeadline: Date;
    projectedDeadline: Date;
    slipDays: number;
    riskLevel: 'none' | 'low' | 'medium' | 'high';
  };
  dependencyAnalysis: {
    blockedTasks: Task[];
    cascadeEffect: Array<{
      taskId: string;
      newDeadline: Date;
      shiftDays: number;
    }>;
    criticalPathImpact: boolean;
  };
  capacityAnalysis: {
    fromMemberNewUtilization: number;
    toMemberNewUtilization: number;
    teamBalanceImprovement: number;
  };
  skillAnalysis: {
    skillMatch: number;
    learningCurveHours: number;
    qualityRisk: 'none' | 'low' | 'medium' | 'high';
  };
  overallRisk: 'low' | 'medium' | 'high';
  recommendation: 'proceed' | 'proceed_with_caution' | 'not_recommended';
  mitigations: string[];
}

/**
 * Team workload summary
 */
export interface TeamWorkloadSummary {
  teamId: string;
  analyzedAt: Date;
  memberMetrics: WorkloadMetrics[];
  teamStats: {
    averageUtilization: number;
    utilizationVariance: number;
    overloadedCount: number;
    underutilizedCount: number;
    totalTasks: number;
    totalHours: number;
    totalCapacity: number;
    skillGaps: Array<{
      skill: string;
      demandHours: number;
      supplyHours: number;
      gapSeverity: 'none' | 'low' | 'medium' | 'high';
    }>;
  };
  balanceScore: number; // 0-1, 1 = perfectly balanced
  recommendations: string[];
  redistributionNeeded: boolean;
}

// Cache TTLs
const CACHE_TTL = {
  workload: 10 * 60 * 1000, // 10 minutes
  redistribution: 30 * 60 * 1000, // 30 minutes
  impact: 15 * 60 * 1000, // 15 minutes
};

// Skill level weights
const SKILL_LEVEL_WEIGHTS: Record<string, number> = {
  beginner: 1,
  intermediate: 2,
  advanced: 3,
  expert: 4,
};

// ============================================================================
// Workload Balancer Service
// ============================================================================

export class WorkloadBalancerService {
  private members: Map<string, TeamMember> = new Map();
  private tasks: Map<string, Task> = new Map();
  private redistributionPlans: Map<string, RedistributionPlan> = new Map();

  // ============================================================================
  // Workload Calculation
  // ============================================================================

  /**
   * Calculate workload metrics for all team members
   * O(t * m) where t=tasks, m=team members
   */
  async calculateTeamWorkload(
    teamMembers: TeamMember[],
    tasks: Task[]
  ): Promise<TeamWorkloadSummary> {
    const cacheKeyStr = cacheKey('workload', hashObject({
      members: teamMembers.map(m => m.id),
      tasks: tasks.map(t => t.id),
    }));

    const cached = oracleCacheService.get<TeamWorkloadSummary>(cacheKeyStr);
    if (cached) return cached;

    // Store for later use
    for (const member of teamMembers) {
      this.members.set(member.id, member);
    }
    for (const task of tasks) {
      this.tasks.set(task.id, task);
    }

    // Calculate per-member metrics
    const memberMetrics: WorkloadMetrics[] = [];

    for (const member of teamMembers) {
      const metrics = this.calculateMemberWorkload(member, tasks);
      memberMetrics.push(metrics);
    }

    // Calculate team stats
    const teamStats = this.calculateTeamStats(memberMetrics, tasks);

    // Calculate balance score
    const balanceScore = this.calculateBalanceScore(memberMetrics);

    // Generate recommendations
    const recommendations = this.generateWorkloadRecommendations(
      memberMetrics,
      teamStats
    );

    const summary: TeamWorkloadSummary = {
      teamId: 'default',
      analyzedAt: new Date(),
      memberMetrics,
      teamStats,
      balanceScore,
      recommendations,
      redistributionNeeded: balanceScore < 0.6 || teamStats.overloadedCount > 0,
    };

    oracleCacheService.set(cacheKeyStr, summary, CACHE_TTL.workload);
    return summary;
  }

  /**
   * Calculate workload for a single member
   * O(t) where t=tasks
   */
  private calculateMemberWorkload(
    member: TeamMember,
    allTasks: Task[]
  ): WorkloadMetrics {
    const assignedTasks = allTasks.filter(t =>
      t.assigneeId === member.id && t.status !== 'completed'
    );

    const allocatedHours = assignedTasks.reduce(
      (sum, t) => sum + t.estimatedHours,
      0
    );

    const capacityHours = member.weeklyCapacityHours * member.availabilityFactor;
    const utilizationRate = capacityHours > 0 ? allocatedHours / capacityHours : 0;

    const complexityScore = assignedTasks.length > 0
      ? assignedTasks.reduce((sum, t) => sum + t.complexity, 0) / assignedTasks.length
      : 0;

    const criticalTaskCount = assignedTasks.filter(
      t => t.priority === 'critical' || t.priority === 'high'
    ).length;

    // Calculate skill coverage
    const skillCoverage = this.calculateSkillCoverage(member, assignedTasks);

    // Calculate bottleneck score
    const bottleneckScore = this.calculateBottleneckScore(member, assignedTasks, allTasks);

    // Calculate burnout risk
    const burnoutRisk = this.calculateBurnoutRisk(
      utilizationRate,
      complexityScore,
      criticalTaskCount,
      assignedTasks.length
    );

    // Determine overload risk
    let overloadRisk: WorkloadMetrics['overloadRisk'] = 'none';
    if (utilizationRate >= 1.3) {
      overloadRisk = 'severe';
    } else if (utilizationRate >= 1.1) {
      overloadRisk = 'high';
    } else if (utilizationRate >= 0.95) {
      overloadRisk = 'medium';
    } else if (utilizationRate >= 0.8) {
      overloadRisk = 'low';
    }

    return {
      memberId: member.id,
      memberName: member.name,
      allocatedHours,
      capacityHours,
      utilizationRate,
      complexityScore,
      taskCount: assignedTasks.length,
      criticalTaskCount,
      overloadRisk,
      availableHours: Math.max(0, capacityHours - allocatedHours),
      skillCoverage,
      bottleneckScore,
      burnoutRisk,
      tasks: assignedTasks,
    };
  }

  /**
   * Calculate how well a member's skills match their assigned tasks
   * O(t * s) where t=tasks, s=skills
   */
  private calculateSkillCoverage(member: TeamMember, tasks: Task[]): number {
    if (tasks.length === 0) return 1;

    let totalMatch = 0;

    for (const task of tasks) {
      const taskMatch = this.calculateTaskSkillMatch(member, task);
      totalMatch += taskMatch;
    }

    return totalMatch / tasks.length;
  }

  /**
   * Calculate skill match between a member and a task
   * O(s1 * s2) where s1=required skills, s2=member skills
   */
  private calculateTaskSkillMatch(member: TeamMember, task: Task): number {
    if (task.requiredSkills.length === 0) return 1;

    let matchScore = 0;

    for (const required of task.requiredSkills) {
      const memberSkill = member.skills.find(
        s => s.id === required.skillId || s.name.toLowerCase() === required.skillName.toLowerCase()
      );

      if (memberSkill) {
        const requiredLevel = SKILL_LEVEL_WEIGHTS[required.minLevel];
        const memberLevel = SKILL_LEVEL_WEIGHTS[memberSkill.level];

        if (memberLevel >= requiredLevel) {
          matchScore += 1;
        } else {
          matchScore += memberLevel / requiredLevel;
        }
      }
    }

    return matchScore / task.requiredSkills.length;
  }

  /**
   * Calculate how much a member blocks other work
   * O(t * d) where t=tasks, d=dependencies
   */
  private calculateBottleneckScore(
    member: TeamMember,
    memberTasks: Task[],
    allTasks: Task[]
  ): number {
    let blockedCount = 0;

    for (const task of memberTasks) {
      // Count tasks that depend on this task
      const dependents = allTasks.filter(t => t.dependencies.includes(task.id));
      blockedCount += dependents.length;
    }

    // Normalize by total tasks
    return allTasks.length > 0 ? blockedCount / allTasks.length : 0;
  }

  /**
   * Calculate burnout risk score
   */
  private calculateBurnoutRisk(
    utilization: number,
    complexity: number,
    criticalCount: number,
    totalTasks: number
  ): number {
    let risk = 0;

    // High utilization contributes to burnout
    if (utilization > 1) {
      risk += Math.min(0.4, (utilization - 1) * 0.8);
    }

    // High complexity contributes
    risk += (complexity / 10) * 0.2;

    // High ratio of critical tasks contributes
    if (totalTasks > 0) {
      risk += (criticalCount / totalTasks) * 0.2;
    }

    // Many tasks regardless of hours
    if (totalTasks > 10) {
      risk += Math.min(0.2, (totalTasks - 10) * 0.02);
    }

    return Math.min(1, risk);
  }

  /**
   * Calculate team-level statistics
   */
  private calculateTeamStats(
    memberMetrics: WorkloadMetrics[],
    tasks: Task[]
  ): TeamWorkloadSummary['teamStats'] {
    const utilizations = memberMetrics.map(m => m.utilizationRate);
    const averageUtilization = utilizations.length > 0
      ? utilizations.reduce((a, b) => a + b, 0) / utilizations.length
      : 0;

    const variance = utilizations.length > 0
      ? utilizations.reduce((sum, u) => sum + Math.pow(u - averageUtilization, 2), 0) / utilizations.length
      : 0;

    const overloadedCount = memberMetrics.filter(
      m => m.overloadRisk === 'high' || m.overloadRisk === 'severe'
    ).length;

    const underutilizedCount = memberMetrics.filter(
      m => m.utilizationRate < 0.5
    ).length;

    const totalHours = memberMetrics.reduce((sum, m) => sum + m.allocatedHours, 0);
    const totalCapacity = memberMetrics.reduce((sum, m) => sum + m.capacityHours, 0);

    // Calculate skill gaps
    const skillGaps = this.calculateSkillGaps(memberMetrics, tasks);

    return {
      averageUtilization,
      utilizationVariance: variance,
      overloadedCount,
      underutilizedCount,
      totalTasks: tasks.length,
      totalHours,
      totalCapacity,
      skillGaps,
    };
  }

  /**
   * Calculate skill gaps across the team
   */
  private calculateSkillGaps(
    memberMetrics: WorkloadMetrics[],
    tasks: Task[]
  ): TeamWorkloadSummary['teamStats']['skillGaps'] {
    const skillDemand = new Map<string, number>();
    const skillSupply = new Map<string, number>();

    // Calculate demand from tasks
    for (const task of tasks) {
      for (const required of task.requiredSkills) {
        const current = skillDemand.get(required.skillName) || 0;
        skillDemand.set(required.skillName, current + task.estimatedHours);
      }
    }

    // Calculate supply from team members
    for (const metrics of memberMetrics) {
      const member = this.members.get(metrics.memberId);
      if (!member) continue;

      for (const skill of member.skills) {
        const hours = metrics.availableHours * (SKILL_LEVEL_WEIGHTS[skill.level] / 4);
        const current = skillSupply.get(skill.name) || 0;
        skillSupply.set(skill.name, current + hours);
      }
    }

    // Compare demand vs supply
    const gaps: TeamWorkloadSummary['teamStats']['skillGaps'] = [];

    skillDemand.forEach((demand, skill) => {
      const supply = skillSupply.get(skill) || 0;
      const gapRatio = supply > 0 ? demand / supply : demand > 0 ? 10 : 0;

      let gapSeverity: 'none' | 'low' | 'medium' | 'high' = 'none';
      if (gapRatio > 2) {
        gapSeverity = 'high';
      } else if (gapRatio > 1.5) {
        gapSeverity = 'medium';
      } else if (gapRatio > 1) {
        gapSeverity = 'low';
      }

      gaps.push({
        skill,
        demandHours: demand,
        supplyHours: supply,
        gapSeverity,
      });
    });

    return gaps.filter(g => g.gapSeverity !== 'none');
  }

  /**
   * Calculate overall balance score
   */
  private calculateBalanceScore(memberMetrics: WorkloadMetrics[]): number {
    if (memberMetrics.length === 0) return 1;

    const utilizations = memberMetrics.map(m => m.utilizationRate);
    const avg = utilizations.reduce((a, b) => a + b, 0) / utilizations.length;

    // Calculate coefficient of variation (lower is better)
    const variance = utilizations.reduce(
      (sum, u) => sum + Math.pow(u - avg, 2),
      0
    ) / utilizations.length;
    const cv = avg > 0 ? Math.sqrt(variance) / avg : 0;

    // Perfect balance would have cv = 0
    // Terrible balance might have cv > 1
    let score = 1 - Math.min(1, cv);

    // Penalize for overloaded members
    const overloadedCount = memberMetrics.filter(m => m.utilizationRate > 1).length;
    score -= (overloadedCount / memberMetrics.length) * 0.3;

    // Penalize for underutilized members
    const underutilizedCount = memberMetrics.filter(m => m.utilizationRate < 0.3).length;
    score -= (underutilizedCount / memberMetrics.length) * 0.2;

    return Math.max(0, Math.min(1, score));
  }

  // ============================================================================
  // Skill-Based Task Matching
  // ============================================================================

  /**
   * Find best matching team members for a task
   * O(m * s) where m=members, s=skills
   */
  async findBestMatchesForTask(
    task: Task,
    members: TeamMember[],
    options: {
      considerCapacity?: boolean;
      minSkillMatch?: number;
      maxResults?: number;
    } = {}
  ): Promise<Array<{
    member: TeamMember;
    skillMatch: number;
    capacityMatch: number;
    overallScore: number;
    reasoning: string;
  }>> {
    const results: Array<{
      member: TeamMember;
      skillMatch: number;
      capacityMatch: number;
      overallScore: number;
      reasoning: string;
    }> = [];

    for (const member of members) {
      if (!member.isActive) continue;

      const skillMatch = this.calculateTaskSkillMatch(member, task);

      if (skillMatch < (options.minSkillMatch || 0.3)) continue;

      // Calculate capacity match
      let capacityMatch = 1;
      if (options.considerCapacity !== false) {
        const availableHours = member.weeklyCapacityHours *
          member.availabilityFactor *
          (1 - member.currentUtilization);
        capacityMatch = availableHours >= task.estimatedHours
          ? 1
          : availableHours / task.estimatedHours;
      }

      // Calculate preference match
      let preferenceBonus = 0;
      for (const tag of task.tags) {
        if (member.preferences.preferredTaskTypes.includes(tag)) {
          preferenceBonus += 0.1;
        }
        if (member.preferences.avoidTaskTypes.includes(tag)) {
          preferenceBonus -= 0.2;
        }
      }

      // Complexity match
      let complexityMatch = 1;
      if (task.complexity > member.preferences.maxTaskComplexity) {
        complexityMatch = member.preferences.maxTaskComplexity / task.complexity;
      }

      // Overall score
      const overallScore = (
        skillMatch * 0.4 +
        capacityMatch * 0.3 +
        complexityMatch * 0.2 +
        Math.max(0, Math.min(0.1, preferenceBonus))
      );

      // Generate reasoning
      const reasons: string[] = [];
      if (skillMatch >= 0.9) {
        reasons.push('Excellent skill match');
      } else if (skillMatch >= 0.7) {
        reasons.push('Good skill match');
      }
      if (capacityMatch >= 1) {
        reasons.push('Has available capacity');
      } else if (capacityMatch < 0.5) {
        reasons.push('Limited capacity');
      }
      if (preferenceBonus > 0) {
        reasons.push('Matches preferences');
      }

      results.push({
        member,
        skillMatch,
        capacityMatch,
        overallScore,
        reasoning: reasons.join('. ') || 'Suitable match',
      });
    }

    results.sort((a, b) => b.overallScore - a.overallScore);
    return results.slice(0, options.maxResults || 5);
  }

  // ============================================================================
  // Redistribution Algorithm
  // ============================================================================

  /**
   * Generate redistribution plan to balance workload
   * O(t * m^2) using greedy assignment with optimization
   */
  async generateRedistributionPlan(
    summary: TeamWorkloadSummary,
    options: {
      maxTasksToMove?: number;
      minimizeDisruption?: boolean;
      respectDeadlines?: boolean;
      requireApproval?: boolean;
    } = {}
  ): Promise<RedistributionPlan> {
    const cacheKeyStr = cacheKey('redistribution', summary.teamId, hashObject(options));
    const cached = oracleCacheService.get<RedistributionPlan>(cacheKeyStr);
    if (cached && cached.approvalStatus === 'pending') return cached;

    const suggestions: RedistributionSuggestion[] = [];

    // Find overloaded and underutilized members
    const overloaded = summary.memberMetrics.filter(
      m => m.overloadRisk === 'high' || m.overloadRisk === 'severe'
    );
    const available = summary.memberMetrics.filter(
      m => m.utilizationRate < 0.8 && m.availableHours > 0
    );

    if (overloaded.length === 0 || available.length === 0) {
      return this.createEmptyPlan(summary.teamId);
    }

    // For each overloaded member, find tasks to redistribute
    for (const overloadedMember of overloaded) {
      const tasksToMove = this.selectTasksToMove(
        overloadedMember,
        options.maxTasksToMove || 3,
        options.respectDeadlines !== false
      );

      for (const task of tasksToMove) {
        const member = this.members.get(overloadedMember.memberId);
        if (!member) continue;

        // Find best available member for this task
        const candidates = await this.findBestMatchesForTask(
          task,
          available.map(m => this.members.get(m.memberId)!).filter(Boolean),
          { considerCapacity: true }
        );

        if (candidates.length === 0) continue;

        const bestCandidate = candidates[0];

        // Analyze impact
        const impact = await this.analyzeImpact(task, {
          fromMemberId: overloadedMember.memberId,
          toMemberId: bestCandidate.member.id,
        });

        // Calculate disruption score
        const disruptionScore = options.minimizeDisruption
          ? this.calculateDisruptionScore(task, impact)
          : 0.5;

        // Skip if disruption is too high
        if (options.minimizeDisruption && disruptionScore > 0.7) continue;

        suggestions.push({
          taskId: task.id,
          taskTitle: task.title,
          currentAssigneeId: overloadedMember.memberId,
          currentAssigneeName: overloadedMember.memberName,
          suggestedAssigneeId: bestCandidate.member.id,
          suggestedAssigneeName: bestCandidate.member.name,
          reason: `Reduce overload (${(overloadedMember.utilizationRate * 100).toFixed(0)}% utilized). ${bestCandidate.reasoning}`,
          skillMatchScore: bestCandidate.skillMatch,
          capacityImprovementScore: bestCandidate.capacityMatch,
          disruptionScore,
          deadlineImpact: impact.deadlineAnalysis.slipDays,
          overallScore: bestCandidate.overallScore * (1 - disruptionScore * 0.3),
          dependencies: {
            blockedTasks: impact.dependencyAnalysis.blockedTasks.map(t => t.id),
            dependencyShifts: impact.dependencyAnalysis.cascadeEffect,
          },
        });
      }
    }

    // Sort by overall score
    suggestions.sort((a, b) => b.overallScore - a.overallScore);

    // Calculate improvement metrics
    const workloadBalanceImprovement = this.estimateBalanceImprovement(
      summary,
      suggestions
    );

    // Create plan
    const plan: RedistributionPlan = {
      id: `plan-${Date.now()}`,
      createdAt: new Date(),
      suggestions: suggestions.slice(0, options.maxTasksToMove || 10),
      totalImprovementScore: suggestions.reduce((sum, s) => sum + s.overallScore, 0) / suggestions.length,
      workloadBalanceImprovement,
      capacityOptimization: this.estimateCapacityOptimization(summary, suggestions),
      disruptionLevel: this.calculateOverallDisruptionLevel(suggestions),
      affectedMembers: [...new Set(suggestions.flatMap(s => [s.currentAssigneeId, s.suggestedAssigneeId]))],
      affectedTasks: suggestions.map(s => s.taskId),
      estimatedTimeToComplete: suggestions.length * 0.5, // 30 min per reassignment
      risks: this.identifyRisks(suggestions),
      approvalStatus: options.requireApproval ? 'pending' : 'approved',
      approvals: [],
    };

    this.redistributionPlans.set(plan.id, plan);
    oracleCacheService.set(cacheKeyStr, plan, CACHE_TTL.redistribution);

    return plan;
  }

  /**
   * Select which tasks to move from an overloaded member
   */
  private selectTasksToMove(
    metrics: WorkloadMetrics,
    maxTasks: number,
    respectDeadlines: boolean
  ): Task[] {
    // Score each task for movability
    const scored = metrics.tasks.map(task => {
      let score = 0;

      // Prefer lower priority tasks
      const priorityScores = { low: 4, medium: 3, high: 2, critical: 1 };
      score += priorityScores[task.priority];

      // Prefer tasks not yet started
      if (task.status === 'pending') {
        score += 3;
      } else if (task.status === 'in_progress') {
        score += 1;
      }

      // Prefer tasks with more time to deadline
      const daysToDeadline = (task.deadline.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
      if (daysToDeadline > 7) {
        score += 2;
      } else if (daysToDeadline > 3) {
        score += 1;
      } else if (respectDeadlines) {
        score -= 5; // Penalize tight deadlines
      }

      // Prefer tasks with fewer dependencies
      score -= task.dependencies.length * 0.5;
      score -= task.dependents.length * 0.5;

      return { task, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, maxTasks).map(s => s.task);
  }

  /**
   * Calculate disruption score for moving a task
   */
  private calculateDisruptionScore(task: Task, impact: ImpactAnalysis): number {
    let score = 0;

    // In-progress tasks are more disruptive to move
    if (task.status === 'in_progress') {
      score += 0.3;
    }

    // Deadline impact
    if (impact.deadlineAnalysis.slipDays > 0) {
      score += Math.min(0.3, impact.deadlineAnalysis.slipDays * 0.05);
    }

    // Dependency cascade
    score += Math.min(0.2, impact.dependencyAnalysis.cascadeEffect.length * 0.05);

    // Critical path impact
    if (impact.dependencyAnalysis.criticalPathImpact) {
      score += 0.2;
    }

    // Skill gap learning curve
    score += impact.skillAnalysis.learningCurveHours * 0.01;

    return Math.min(1, score);
  }

  // ============================================================================
  // Impact Analysis
  // ============================================================================

  /**
   * Analyze impact of reassigning a task
   * O(d) where d=number of dependent tasks
   */
  async analyzeImpact(
    task: Task,
    reassignment: { fromMemberId: string; toMemberId: string }
  ): Promise<ImpactAnalysis> {
    const cacheKeyStr = cacheKey('impact', task.id, hashObject(reassignment));
    const cached = oracleCacheService.get<ImpactAnalysis>(cacheKeyStr);
    if (cached) return cached;

    const fromMember = this.members.get(reassignment.fromMemberId);
    const toMember = this.members.get(reassignment.toMemberId);

    if (!fromMember || !toMember) {
      throw new Error('Invalid member IDs for impact analysis');
    }

    // Calculate skill match
    const skillMatch = this.calculateTaskSkillMatch(toMember, task);
    const learningCurveHours = skillMatch < 0.7
      ? task.estimatedHours * (1 - skillMatch) * 0.5
      : 0;

    // Calculate deadline impact
    const originalDeadline = task.deadline;
    let slipDays = 0;

    // If skill match is low, add learning time
    if (skillMatch < 0.7) {
      slipDays += Math.ceil(learningCurveHours / 8);
    }

    // If task is in progress, add context-switching overhead
    if (task.status === 'in_progress') {
      slipDays += 1;
    }

    const projectedDeadline = new Date(originalDeadline);
    projectedDeadline.setDate(projectedDeadline.getDate() + slipDays);

    // Analyze dependency cascade
    const blockedTasks: Task[] = [];
    const cascadeEffect: ImpactAnalysis['dependencyAnalysis']['cascadeEffect'] = [];

    for (const dependentId of task.dependents) {
      const dependent = this.tasks.get(dependentId);
      if (dependent) {
        blockedTasks.push(dependent);
        if (slipDays > 0) {
          cascadeEffect.push({
            taskId: dependent.id,
            newDeadline: new Date(dependent.deadline.getTime() + slipDays * 24 * 60 * 60 * 1000),
            shiftDays: slipDays,
          });
        }
      }
    }

    // Check critical path impact
    const criticalPathImpact = blockedTasks.some(
      t => t.priority === 'critical' || t.priority === 'high'
    );

    // Calculate new utilization rates
    const taskHours = task.estimatedHours;
    const fromNewAllocation = this.calculateNewAllocation(
      fromMember,
      -taskHours
    );
    const toNewAllocation = this.calculateNewAllocation(
      toMember,
      taskHours + learningCurveHours
    );

    const fromNewUtilization = fromNewAllocation / fromMember.weeklyCapacityHours;
    const toNewUtilization = toNewAllocation / toMember.weeklyCapacityHours;

    // Calculate team balance improvement
    const currentVariance = Math.abs(fromMember.currentUtilization - toMember.currentUtilization);
    const newVariance = Math.abs(fromNewUtilization - toNewUtilization);
    const teamBalanceImprovement = (currentVariance - newVariance) / currentVariance;

    // Determine risk levels
    let deadlineRisk: 'none' | 'low' | 'medium' | 'high' = 'none';
    if (slipDays > 5) {
      deadlineRisk = 'high';
    } else if (slipDays > 2) {
      deadlineRisk = 'medium';
    } else if (slipDays > 0) {
      deadlineRisk = 'low';
    }

    let qualityRisk: 'none' | 'low' | 'medium' | 'high' = 'none';
    if (skillMatch < 0.3) {
      qualityRisk = 'high';
    } else if (skillMatch < 0.5) {
      qualityRisk = 'medium';
    } else if (skillMatch < 0.7) {
      qualityRisk = 'low';
    }

    // Overall risk and recommendation
    let overallRisk: 'low' | 'medium' | 'high' = 'low';
    let recommendation: 'proceed' | 'proceed_with_caution' | 'not_recommended' = 'proceed';

    if (deadlineRisk === 'high' || qualityRisk === 'high' || criticalPathImpact) {
      overallRisk = 'high';
      recommendation = 'not_recommended';
    } else if (deadlineRisk === 'medium' || qualityRisk === 'medium') {
      overallRisk = 'medium';
      recommendation = 'proceed_with_caution';
    }

    // Generate mitigations
    const mitigations: string[] = [];
    if (learningCurveHours > 0) {
      mitigations.push(`Schedule ${learningCurveHours.toFixed(1)} hours for knowledge transfer`);
    }
    if (task.status === 'in_progress') {
      mitigations.push('Conduct handoff meeting to transfer context');
    }
    if (cascadeEffect.length > 0) {
      mitigations.push('Notify stakeholders of dependent task impacts');
    }

    const analysis: ImpactAnalysis = {
      taskId: task.id,
      reassignmentScenario: reassignment,
      deadlineAnalysis: {
        originalDeadline,
        projectedDeadline,
        slipDays,
        riskLevel: deadlineRisk,
      },
      dependencyAnalysis: {
        blockedTasks,
        cascadeEffect,
        criticalPathImpact,
      },
      capacityAnalysis: {
        fromMemberNewUtilization: fromNewUtilization,
        toMemberNewUtilization: toNewUtilization,
        teamBalanceImprovement,
      },
      skillAnalysis: {
        skillMatch,
        learningCurveHours,
        qualityRisk,
      },
      overallRisk,
      recommendation,
      mitigations,
    };

    oracleCacheService.set(cacheKeyStr, analysis, CACHE_TTL.impact);
    return analysis;
  }

  /**
   * Calculate new allocation after change
   */
  private calculateNewAllocation(member: TeamMember, hoursChange: number): number {
    const currentAllocation = member.currentUtilization * member.weeklyCapacityHours;
    return Math.max(0, currentAllocation + hoursChange);
  }

  // ============================================================================
  // Team Approval Workflow
  // ============================================================================

  /**
   * Submit approval for a redistribution plan
   */
  async submitApproval(
    planId: string,
    memberId: string,
    approved: boolean,
    comments?: string
  ): Promise<RedistributionPlan> {
    const plan = this.redistributionPlans.get(planId);
    if (!plan) {
      throw new Error(`Redistribution plan ${planId} not found`);
    }

    // Add approval
    const existingIndex = plan.approvals.findIndex(a => a.memberId === memberId);
    const approval = {
      memberId,
      approved,
      comments,
      timestamp: new Date(),
    };

    if (existingIndex >= 0) {
      plan.approvals[existingIndex] = approval;
    } else {
      plan.approvals.push(approval);
    }

    // Check if all affected members have approved
    const allMembersApproved = plan.affectedMembers.every(memberId =>
      plan.approvals.some(a => a.memberId === memberId && a.approved)
    );

    const anyRejected = plan.approvals.some(a => !a.approved);

    if (allMembersApproved) {
      plan.approvalStatus = 'approved';
    } else if (anyRejected) {
      plan.approvalStatus = 'partial';
    }

    this.redistributionPlans.set(planId, plan);
    oracleCacheService.deleteByPrefix(`redistribution:${plan.id}`);

    return plan;
  }

  /**
   * Execute approved redistribution plan
   */
  async executePlan(planId: string): Promise<{
    success: boolean;
    executedSuggestions: string[];
    failedSuggestions: Array<{ id: string; error: string }>;
  }> {
    const plan = this.redistributionPlans.get(planId);
    if (!plan) {
      throw new Error(`Plan ${planId} not found`);
    }

    if (plan.approvalStatus !== 'approved') {
      throw new Error('Plan not approved');
    }

    const executedSuggestions: string[] = [];
    const failedSuggestions: Array<{ id: string; error: string }> = [];

    for (const suggestion of plan.suggestions) {
      try {
        // Update task assignment
        const task = this.tasks.get(suggestion.taskId);
        if (task) {
          task.assigneeId = suggestion.suggestedAssigneeId;
          this.tasks.set(task.id, task);
          executedSuggestions.push(suggestion.taskId);
        }
      } catch (error) {
        failedSuggestions.push({
          id: suggestion.taskId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return {
      success: failedSuggestions.length === 0,
      executedSuggestions,
      failedSuggestions,
    };
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Generate workload recommendations
   */
  private generateWorkloadRecommendations(
    metrics: WorkloadMetrics[],
    stats: TeamWorkloadSummary['teamStats']
  ): string[] {
    const recommendations: string[] = [];

    if (stats.overloadedCount > 0) {
      recommendations.push(
        `${stats.overloadedCount} team member(s) are overloaded. Consider redistributing work.`
      );
    }

    if (stats.underutilizedCount > 0) {
      recommendations.push(
        `${stats.underutilizedCount} team member(s) have available capacity. They can take on more work.`
      );
    }

    if (stats.utilizationVariance > 0.3) {
      recommendations.push(
        'High workload variance detected. Rebalancing is recommended for team health.'
      );
    }

    for (const gap of stats.skillGaps) {
      if (gap.gapSeverity === 'high') {
        recommendations.push(
          `Critical skill gap in "${gap.skill}": ${gap.demandHours.toFixed(0)}h demand vs ${gap.supplyHours.toFixed(0)}h supply.`
        );
      }
    }

    const highBurnout = metrics.filter(m => m.burnoutRisk > 0.6);
    if (highBurnout.length > 0) {
      recommendations.push(
        `${highBurnout.length} team member(s) showing burnout risk. Consider reducing their load.`
      );
    }

    return recommendations;
  }

  /**
   * Estimate balance improvement from suggestions
   */
  private estimateBalanceImprovement(
    summary: TeamWorkloadSummary,
    suggestions: RedistributionSuggestion[]
  ): number {
    if (suggestions.length === 0) return 0;

    // Estimate new utilization after applying suggestions
    const newMetrics = new Map<string, number>();

    for (const m of summary.memberMetrics) {
      newMetrics.set(m.memberId, m.utilizationRate);
    }

    for (const s of suggestions) {
      const task = this.tasks.get(s.taskId);
      if (!task) continue;

      const fromMember = this.members.get(s.currentAssigneeId);
      const toMember = this.members.get(s.suggestedAssigneeId);
      if (!fromMember || !toMember) continue;

      const hoursChange = task.estimatedHours / fromMember.weeklyCapacityHours;

      newMetrics.set(
        s.currentAssigneeId,
        (newMetrics.get(s.currentAssigneeId) || 0) - hoursChange
      );
      newMetrics.set(
        s.suggestedAssigneeId,
        (newMetrics.get(s.suggestedAssigneeId) || 0) + hoursChange
      );
    }

    // Calculate new variance
    const values = Array.from(newMetrics.values());
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const newVariance = values.reduce(
      (sum, v) => sum + Math.pow(v - avg, 2),
      0
    ) / values.length;

    const oldVariance = summary.teamStats.utilizationVariance;
    return oldVariance > 0 ? (oldVariance - newVariance) / oldVariance : 0;
  }

  /**
   * Estimate capacity optimization
   */
  private estimateCapacityOptimization(
    summary: TeamWorkloadSummary,
    suggestions: RedistributionSuggestion[]
  ): number {
    if (suggestions.length === 0) return 0;

    // Count how many overloaded members would be resolved
    const resolvedOverloads = new Set(
      suggestions.map(s => s.currentAssigneeId)
    ).size;

    return resolvedOverloads / Math.max(1, summary.teamStats.overloadedCount);
  }

  /**
   * Calculate overall disruption level
   */
  private calculateOverallDisruptionLevel(
    suggestions: RedistributionSuggestion[]
  ): 'minimal' | 'moderate' | 'significant' {
    if (suggestions.length === 0) return 'minimal';

    const avgDisruption = suggestions.reduce(
      (sum, s) => sum + s.disruptionScore,
      0
    ) / suggestions.length;

    if (avgDisruption > 0.6) return 'significant';
    if (avgDisruption > 0.3) return 'moderate';
    return 'minimal';
  }

  /**
   * Identify risks in redistribution plan
   */
  private identifyRisks(suggestions: RedistributionSuggestion[]): string[] {
    const risks: string[] = [];

    const highDeadlineImpact = suggestions.filter(s => s.deadlineImpact > 3);
    if (highDeadlineImpact.length > 0) {
      risks.push(`${highDeadlineImpact.length} task(s) may have significant deadline impact`);
    }

    const lowSkillMatch = suggestions.filter(s => s.skillMatchScore < 0.5);
    if (lowSkillMatch.length > 0) {
      risks.push(`${lowSkillMatch.length} reassignment(s) have suboptimal skill matches`);
    }

    const cascadeRisk = suggestions.filter(
      s => s.dependencies.dependencyShifts.length > 2
    );
    if (cascadeRisk.length > 0) {
      risks.push(`${cascadeRisk.length} task(s) may cause cascade effects on dependencies`);
    }

    return risks;
  }

  /**
   * Create empty redistribution plan
   */
  private createEmptyPlan(teamId: string): RedistributionPlan {
    return {
      id: `plan-${Date.now()}`,
      createdAt: new Date(),
      suggestions: [],
      totalImprovementScore: 0,
      workloadBalanceImprovement: 0,
      capacityOptimization: 0,
      disruptionLevel: 'minimal',
      affectedMembers: [],
      affectedTasks: [],
      estimatedTimeToComplete: 0,
      risks: [],
      approvalStatus: 'approved',
      approvals: [],
    };
  }
}

// Singleton instance
export const workloadBalancerService = new WorkloadBalancerService();
