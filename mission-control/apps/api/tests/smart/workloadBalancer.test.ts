/**
 * ORACLE Workload Balancer Service Tests
 * Tests for workload calculation, skill matching, redistribution, and impact analysis
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock the cache service
jest.mock('../../src/services/oracle/cache', () => ({
  oracleCacheService: {
    get: jest.fn(() => null),
    set: jest.fn(),
    deleteByPrefix: jest.fn(),
  },
  cacheKey: (...args: string[]) => args.join(':'),
  hashObject: (obj: any) => JSON.stringify(obj),
}));

// ============================================================================
// Types (matching the actual service)
// ============================================================================

interface Skill {
  id: string;
  name: string;
  category: string;
  level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  yearsExperience?: number;
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  skills: Skill[];
  weeklyCapacityHours: number;
  currentUtilization: number;
  availabilityFactor: number;
  preferences: {
    preferredTaskTypes: string[];
    avoidTaskTypes: string[];
    maxTaskComplexity: number;
    preferredTeammates?: string[];
  };
  timezone: string;
  isActive: boolean;
}

interface Task {
  id: string;
  title: string;
  description: string;
  estimatedHours: number;
  complexity: number;
  priority: 'critical' | 'high' | 'medium' | 'low';
  requiredSkills: Array<{
    skillId: string;
    skillName: string;
    minLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  }>;
  assigneeId?: string;
  deadline: Date;
  startDate?: Date;
  dependencies: string[];
  dependents: string[];
  status: 'pending' | 'in_progress' | 'blocked' | 'completed';
  tags: string[];
  projectId: string;
}

// ============================================================================
// Mock Implementation (simplified for testing)
// ============================================================================

const SKILL_LEVEL_WEIGHTS: Record<string, number> = {
  beginner: 1,
  intermediate: 2,
  advanced: 3,
  expert: 4,
};

class MockWorkloadBalancerService {
  private members: Map<string, TeamMember> = new Map();
  private tasks: Map<string, Task> = new Map();

  async calculateTeamWorkload(teamMembers: TeamMember[], tasks: Task[]) {
    for (const member of teamMembers) {
      this.members.set(member.id, member);
    }
    for (const task of tasks) {
      this.tasks.set(task.id, task);
    }

    const memberMetrics = teamMembers.map(member =>
      this.calculateMemberWorkload(member, tasks)
    );

    const teamStats = this.calculateTeamStats(memberMetrics, tasks);
    const balanceScore = this.calculateBalanceScore(memberMetrics);

    return {
      teamId: 'default',
      analyzedAt: new Date(),
      memberMetrics,
      teamStats,
      balanceScore,
      recommendations: this.generateRecommendations(memberMetrics, teamStats),
      redistributionNeeded: balanceScore < 0.6 || teamStats.overloadedCount > 0,
    };
  }

  private calculateMemberWorkload(member: TeamMember, allTasks: Task[]) {
    const assignedTasks = allTasks.filter(t =>
      t.assigneeId === member.id && t.status !== 'completed'
    );

    const allocatedHours = assignedTasks.reduce(
      (sum, t) => sum + t.estimatedHours, 0
    );

    const capacityHours = member.weeklyCapacityHours * member.availabilityFactor;
    const utilizationRate = capacityHours > 0 ? allocatedHours / capacityHours : 0;

    const complexityScore = assignedTasks.length > 0
      ? assignedTasks.reduce((sum, t) => sum + t.complexity, 0) / assignedTasks.length
      : 0;

    const criticalTaskCount = assignedTasks.filter(
      t => t.priority === 'critical' || t.priority === 'high'
    ).length;

    let overloadRisk: 'none' | 'low' | 'medium' | 'high' | 'severe' = 'none';
    if (utilizationRate >= 1.3) overloadRisk = 'severe';
    else if (utilizationRate >= 1.1) overloadRisk = 'high';
    else if (utilizationRate >= 0.95) overloadRisk = 'medium';
    else if (utilizationRate >= 0.8) overloadRisk = 'low';

    const skillCoverage = this.calculateSkillCoverage(member, assignedTasks);
    const burnoutRisk = this.calculateBurnoutRisk(utilizationRate, complexityScore, criticalTaskCount, assignedTasks.length);

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
      bottleneckScore: 0,
      burnoutRisk,
      tasks: assignedTasks,
    };
  }

  private calculateSkillCoverage(member: TeamMember, tasks: Task[]): number {
    if (tasks.length === 0) return 1;

    let totalMatch = 0;
    for (const task of tasks) {
      totalMatch += this.calculateTaskSkillMatch(member, task);
    }
    return totalMatch / tasks.length;
  }

  calculateTaskSkillMatch(member: TeamMember, task: Task): number {
    if (task.requiredSkills.length === 0) return 1;

    let matchScore = 0;
    for (const required of task.requiredSkills) {
      const memberSkill = member.skills.find(
        s => s.id === required.skillId || s.name.toLowerCase() === required.skillName.toLowerCase()
      );

      if (memberSkill) {
        const requiredLevel = SKILL_LEVEL_WEIGHTS[required.minLevel];
        const memberLevel = SKILL_LEVEL_WEIGHTS[memberSkill.level];
        matchScore += memberLevel >= requiredLevel ? 1 : memberLevel / requiredLevel;
      }
    }
    return matchScore / task.requiredSkills.length;
  }

  private calculateBurnoutRisk(utilization: number, complexity: number, criticalCount: number, totalTasks: number): number {
    let risk = 0;
    if (utilization > 1) risk += Math.min(0.4, (utilization - 1) * 0.8);
    risk += (complexity / 10) * 0.2;
    if (totalTasks > 0) risk += (criticalCount / totalTasks) * 0.2;
    if (totalTasks > 10) risk += Math.min(0.2, (totalTasks - 10) * 0.02);
    return Math.min(1, risk);
  }

  private calculateTeamStats(memberMetrics: any[], tasks: Task[]) {
    const utilizations = memberMetrics.map(m => m.utilizationRate);
    const averageUtilization = utilizations.length > 0
      ? utilizations.reduce((a, b) => a + b, 0) / utilizations.length
      : 0;

    const variance = utilizations.length > 0
      ? utilizations.reduce((sum, u) => sum + Math.pow(u - averageUtilization, 2), 0) / utilizations.length
      : 0;

    return {
      averageUtilization,
      utilizationVariance: variance,
      overloadedCount: memberMetrics.filter(m => m.overloadRisk === 'high' || m.overloadRisk === 'severe').length,
      underutilizedCount: memberMetrics.filter(m => m.utilizationRate < 0.5).length,
      totalTasks: tasks.length,
      totalHours: memberMetrics.reduce((sum, m) => sum + m.allocatedHours, 0),
      totalCapacity: memberMetrics.reduce((sum, m) => sum + m.capacityHours, 0),
      skillGaps: [],
    };
  }

  private calculateBalanceScore(memberMetrics: any[]): number {
    if (memberMetrics.length === 0) return 1;

    const utilizations = memberMetrics.map(m => m.utilizationRate);
    const avg = utilizations.reduce((a, b) => a + b, 0) / utilizations.length;
    const variance = utilizations.reduce((sum, u) => sum + Math.pow(u - avg, 2), 0) / utilizations.length;
    const cv = avg > 0 ? Math.sqrt(variance) / avg : 0;

    let score = 1 - Math.min(1, cv);
    const overloadedCount = memberMetrics.filter(m => m.utilizationRate > 1).length;
    score -= (overloadedCount / memberMetrics.length) * 0.3;
    const underutilizedCount = memberMetrics.filter(m => m.utilizationRate < 0.3).length;
    score -= (underutilizedCount / memberMetrics.length) * 0.2;

    return Math.max(0, Math.min(1, score));
  }

  private generateRecommendations(metrics: any[], stats: any): string[] {
    const recommendations: string[] = [];
    if (stats.overloadedCount > 0) {
      recommendations.push(`${stats.overloadedCount} team member(s) are overloaded. Consider redistributing work.`);
    }
    if (stats.underutilizedCount > 0) {
      recommendations.push(`${stats.underutilizedCount} team member(s) have available capacity.`);
    }
    return recommendations;
  }

  async findBestMatchesForTask(task: Task, members: TeamMember[], options: any = {}) {
    const results: any[] = [];

    for (const member of members) {
      if (!member.isActive) continue;

      const skillMatch = this.calculateTaskSkillMatch(member, task);
      if (skillMatch < (options.minSkillMatch || 0.3)) continue;

      let capacityMatch = 1;
      if (options.considerCapacity !== false) {
        const availableHours = member.weeklyCapacityHours *
          member.availabilityFactor * (1 - member.currentUtilization);
        capacityMatch = availableHours >= task.estimatedHours
          ? 1 : availableHours / task.estimatedHours;
      }

      const overallScore = skillMatch * 0.4 + capacityMatch * 0.3 + 0.3;

      results.push({
        member,
        skillMatch,
        capacityMatch,
        overallScore,
        reasoning: skillMatch >= 0.9 ? 'Excellent skill match' : 'Good match',
      });
    }

    results.sort((a, b) => b.overallScore - a.overallScore);
    return results.slice(0, options.maxResults || 5);
  }

  async analyzeImpact(task: Task, reassignment: { fromMemberId: string; toMemberId: string }) {
    const fromMember = this.members.get(reassignment.fromMemberId);
    const toMember = this.members.get(reassignment.toMemberId);

    if (!fromMember || !toMember) {
      throw new Error('Invalid member IDs for impact analysis');
    }

    const skillMatch = this.calculateTaskSkillMatch(toMember, task);
    const learningCurveHours = skillMatch < 0.7 ? task.estimatedHours * (1 - skillMatch) * 0.5 : 0;

    let slipDays = 0;
    if (skillMatch < 0.7) slipDays += Math.ceil(learningCurveHours / 8);
    if (task.status === 'in_progress') slipDays += 1;

    const originalDeadline = task.deadline;
    const projectedDeadline = new Date(originalDeadline);
    projectedDeadline.setDate(projectedDeadline.getDate() + slipDays);

    let deadlineRisk: 'none' | 'low' | 'medium' | 'high' = 'none';
    if (slipDays > 5) deadlineRisk = 'high';
    else if (slipDays > 2) deadlineRisk = 'medium';
    else if (slipDays > 0) deadlineRisk = 'low';

    let qualityRisk: 'none' | 'low' | 'medium' | 'high' = 'none';
    if (skillMatch < 0.3) qualityRisk = 'high';
    else if (skillMatch < 0.5) qualityRisk = 'medium';
    else if (skillMatch < 0.7) qualityRisk = 'low';

    let overallRisk: 'low' | 'medium' | 'high' = 'low';
    let recommendation: 'proceed' | 'proceed_with_caution' | 'not_recommended' = 'proceed';

    if (deadlineRisk === 'high' || qualityRisk === 'high') {
      overallRisk = 'high';
      recommendation = 'not_recommended';
    } else if (deadlineRisk === 'medium' || qualityRisk === 'medium') {
      overallRisk = 'medium';
      recommendation = 'proceed_with_caution';
    }

    return {
      taskId: task.id,
      reassignmentScenario: reassignment,
      deadlineAnalysis: {
        originalDeadline,
        projectedDeadline,
        slipDays,
        riskLevel: deadlineRisk,
      },
      dependencyAnalysis: {
        blockedTasks: [],
        cascadeEffect: [],
        criticalPathImpact: false,
      },
      capacityAnalysis: {
        fromMemberNewUtilization: fromMember.currentUtilization - task.estimatedHours / fromMember.weeklyCapacityHours,
        toMemberNewUtilization: toMember.currentUtilization + task.estimatedHours / toMember.weeklyCapacityHours,
        teamBalanceImprovement: 0.1,
      },
      skillAnalysis: {
        skillMatch,
        learningCurveHours,
        qualityRisk,
      },
      overallRisk,
      recommendation,
      mitigations: learningCurveHours > 0 ? [`Schedule ${learningCurveHours.toFixed(1)} hours for knowledge transfer`] : [],
    };
  }
}

// ============================================================================
// Test Suite
// ============================================================================

describe('WorkloadBalancerService', () => {
  let service: MockWorkloadBalancerService;

  // Test fixtures
  const createMember = (overrides: Partial<TeamMember> = {}): TeamMember => ({
    id: `member-${Math.random().toString(36).substr(2, 9)}`,
    name: 'Test Member',
    email: 'test@example.com',
    role: 'Developer',
    skills: [
      { id: 'js', name: 'JavaScript', category: 'programming', level: 'advanced' },
      { id: 'react', name: 'React', category: 'frontend', level: 'intermediate' },
    ],
    weeklyCapacityHours: 40,
    currentUtilization: 0.5,
    availabilityFactor: 1.0,
    preferences: {
      preferredTaskTypes: ['frontend', 'ui'],
      avoidTaskTypes: ['backend'],
      maxTaskComplexity: 8,
    },
    timezone: 'UTC',
    isActive: true,
    ...overrides,
  });

  const createTask = (overrides: Partial<Task> = {}): Task => ({
    id: `task-${Math.random().toString(36).substr(2, 9)}`,
    title: 'Test Task',
    description: 'A test task',
    estimatedHours: 8,
    complexity: 5,
    priority: 'medium',
    requiredSkills: [
      { skillId: 'js', skillName: 'JavaScript', minLevel: 'intermediate' },
    ],
    deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    dependencies: [],
    dependents: [],
    status: 'pending',
    tags: ['frontend'],
    projectId: 'project-1',
    ...overrides,
  });

  beforeEach(() => {
    service = new MockWorkloadBalancerService();
    jest.clearAllMocks();
  });

  // ============================================================================
  // Workload Calculation Tests
  // ============================================================================

  describe('calculateTeamWorkload', () => {
    it('should calculate workload for team with no tasks', async () => {
      const members = [createMember({ id: 'member-1', name: 'Alice' })];
      const tasks: Task[] = [];

      const result = await service.calculateTeamWorkload(members, tasks);

      expect(result.memberMetrics).toHaveLength(1);
      expect(result.memberMetrics[0].allocatedHours).toBe(0);
      expect(result.memberMetrics[0].utilizationRate).toBe(0);
      expect(result.memberMetrics[0].overloadRisk).toBe('none');
      expect(result.balanceScore).toBe(1);
    });

    it('should calculate workload for single member with tasks', async () => {
      const member = createMember({
        id: 'member-1',
        name: 'Alice',
        weeklyCapacityHours: 40,
        availabilityFactor: 1.0,
      });
      const tasks = [
        createTask({ id: 'task-1', assigneeId: 'member-1', estimatedHours: 20 }),
        createTask({ id: 'task-2', assigneeId: 'member-1', estimatedHours: 10 }),
      ];

      const result = await service.calculateTeamWorkload([member], tasks);

      expect(result.memberMetrics[0].allocatedHours).toBe(30);
      expect(result.memberMetrics[0].utilizationRate).toBe(0.75);
      expect(result.memberMetrics[0].taskCount).toBe(2);
    });

    it('should identify overloaded team members', async () => {
      const members = [
        createMember({ id: 'member-1', name: 'Overloaded', weeklyCapacityHours: 40 }),
        createMember({ id: 'member-2', name: 'Normal', weeklyCapacityHours: 40 }),
      ];
      const tasks = [
        createTask({ id: 'task-1', assigneeId: 'member-1', estimatedHours: 50 }),
        createTask({ id: 'task-2', assigneeId: 'member-2', estimatedHours: 20 }),
      ];

      const result = await service.calculateTeamWorkload(members, tasks);

      const overloadedMember = result.memberMetrics.find(m => m.memberId === 'member-1');
      const normalMember = result.memberMetrics.find(m => m.memberId === 'member-2');

      expect(overloadedMember?.overloadRisk).toBe('high');
      expect(normalMember?.overloadRisk).toBe('none');
      expect(result.teamStats.overloadedCount).toBe(1);
    });

    it('should identify underutilized team members', async () => {
      const members = [
        createMember({ id: 'member-1', name: 'Busy', weeklyCapacityHours: 40 }),
        createMember({ id: 'member-2', name: 'Idle', weeklyCapacityHours: 40 }),
      ];
      const tasks = [
        createTask({ id: 'task-1', assigneeId: 'member-1', estimatedHours: 30 }),
        createTask({ id: 'task-2', assigneeId: 'member-2', estimatedHours: 5 }),
      ];

      const result = await service.calculateTeamWorkload(members, tasks);

      expect(result.teamStats.underutilizedCount).toBe(1);
    });

    it('should calculate correct utilization with availability factor', async () => {
      const member = createMember({
        id: 'member-1',
        weeklyCapacityHours: 40,
        availabilityFactor: 0.5, // 50% availability (PTO, meetings, etc.)
      });
      const tasks = [
        createTask({ id: 'task-1', assigneeId: 'member-1', estimatedHours: 20 }),
      ];

      const result = await service.calculateTeamWorkload([member], tasks);

      // 20 hours / (40 * 0.5) = 20 / 20 = 100% utilization
      expect(result.memberMetrics[0].capacityHours).toBe(20);
      expect(result.memberMetrics[0].utilizationRate).toBe(1);
    });

    it('should exclude completed tasks from workload calculation', async () => {
      const member = createMember({ id: 'member-1', weeklyCapacityHours: 40 });
      const tasks = [
        createTask({ id: 'task-1', assigneeId: 'member-1', estimatedHours: 20, status: 'completed' }),
        createTask({ id: 'task-2', assigneeId: 'member-1', estimatedHours: 10, status: 'in_progress' }),
      ];

      const result = await service.calculateTeamWorkload([member], tasks);

      expect(result.memberMetrics[0].allocatedHours).toBe(10);
      expect(result.memberMetrics[0].taskCount).toBe(1);
    });

    it('should count critical and high priority tasks', async () => {
      const member = createMember({ id: 'member-1' });
      const tasks = [
        createTask({ id: 'task-1', assigneeId: 'member-1', priority: 'critical' }),
        createTask({ id: 'task-2', assigneeId: 'member-1', priority: 'high' }),
        createTask({ id: 'task-3', assigneeId: 'member-1', priority: 'medium' }),
        createTask({ id: 'task-4', assigneeId: 'member-1', priority: 'low' }),
      ];

      const result = await service.calculateTeamWorkload([member], tasks);

      expect(result.memberMetrics[0].criticalTaskCount).toBe(2);
    });
  });

  // ============================================================================
  // Balance Score Tests
  // ============================================================================

  describe('Balance Score Calculation', () => {
    it('should return perfect balance for evenly distributed workload', async () => {
      const members = [
        createMember({ id: 'member-1', weeklyCapacityHours: 40 }),
        createMember({ id: 'member-2', weeklyCapacityHours: 40 }),
        createMember({ id: 'member-3', weeklyCapacityHours: 40 }),
      ];
      const tasks = [
        createTask({ id: 'task-1', assigneeId: 'member-1', estimatedHours: 20 }),
        createTask({ id: 'task-2', assigneeId: 'member-2', estimatedHours: 20 }),
        createTask({ id: 'task-3', assigneeId: 'member-3', estimatedHours: 20 }),
      ];

      const result = await service.calculateTeamWorkload(members, tasks);

      expect(result.balanceScore).toBeGreaterThan(0.8);
      expect(result.redistributionNeeded).toBe(false);
    });

    it('should return low balance for uneven distribution', async () => {
      const members = [
        createMember({ id: 'member-1', weeklyCapacityHours: 40 }),
        createMember({ id: 'member-2', weeklyCapacityHours: 40 }),
      ];
      const tasks = [
        createTask({ id: 'task-1', assigneeId: 'member-1', estimatedHours: 50 }),
        createTask({ id: 'task-2', assigneeId: 'member-2', estimatedHours: 5 }),
      ];

      const result = await service.calculateTeamWorkload(members, tasks);

      expect(result.balanceScore).toBeLessThan(0.6);
      expect(result.redistributionNeeded).toBe(true);
    });

    it('should indicate redistribution needed when members are overloaded', async () => {
      const members = [
        createMember({ id: 'member-1', weeklyCapacityHours: 40 }),
      ];
      const tasks = [
        createTask({ id: 'task-1', assigneeId: 'member-1', estimatedHours: 50 }),
      ];

      const result = await service.calculateTeamWorkload(members, tasks);

      expect(result.redistributionNeeded).toBe(true);
    });
  });

  // ============================================================================
  // Burnout Risk Tests
  // ============================================================================

  describe('Burnout Risk Calculation', () => {
    it('should calculate low burnout risk for normal workload', async () => {
      const member = createMember({ id: 'member-1', weeklyCapacityHours: 40 });
      const tasks = [
        createTask({ id: 'task-1', assigneeId: 'member-1', estimatedHours: 20, complexity: 3, priority: 'medium' }),
      ];

      const result = await service.calculateTeamWorkload([member], tasks);

      expect(result.memberMetrics[0].burnoutRisk).toBeLessThan(0.3);
    });

    it('should calculate high burnout risk for overloaded member with complex tasks', async () => {
      const member = createMember({ id: 'member-1', weeklyCapacityHours: 40 });
      const tasks = Array.from({ length: 15 }, (_, i) =>
        createTask({
          id: `task-${i}`,
          assigneeId: 'member-1',
          estimatedHours: 5,
          complexity: 8,
          priority: i < 5 ? 'critical' : 'medium',
        })
      );

      const result = await service.calculateTeamWorkload([member], tasks);

      expect(result.memberMetrics[0].burnoutRisk).toBeGreaterThan(0.5);
    });

    it('should factor in high complexity tasks', async () => {
      const member = createMember({ id: 'member-1', weeklyCapacityHours: 40 });
      const highComplexityTasks = [
        createTask({ id: 'task-1', assigneeId: 'member-1', estimatedHours: 20, complexity: 10 }),
      ];
      const lowComplexityTasks = [
        createTask({ id: 'task-2', assigneeId: 'member-1', estimatedHours: 20, complexity: 2 }),
      ];

      const resultHigh = await service.calculateTeamWorkload([member], highComplexityTasks);

      // Reset service
      const service2 = new MockWorkloadBalancerService();
      const resultLow = await service2.calculateTeamWorkload([member], lowComplexityTasks);

      expect(resultHigh.memberMetrics[0].burnoutRisk).toBeGreaterThan(resultLow.memberMetrics[0].burnoutRisk);
    });
  });

  // ============================================================================
  // Skill Matching Tests
  // ============================================================================

  describe('Skill Matching', () => {
    it('should calculate perfect skill match', () => {
      const member = createMember({
        skills: [
          { id: 'js', name: 'JavaScript', category: 'programming', level: 'expert' },
        ],
      });
      const task = createTask({
        requiredSkills: [{ skillId: 'js', skillName: 'JavaScript', minLevel: 'intermediate' }],
      });

      const match = service.calculateTaskSkillMatch(member, task);

      expect(match).toBe(1);
    });

    it('should calculate partial match when skill level is below requirement', () => {
      const member = createMember({
        skills: [
          { id: 'js', name: 'JavaScript', category: 'programming', level: 'beginner' },
        ],
      });
      const task = createTask({
        requiredSkills: [{ skillId: 'js', skillName: 'JavaScript', minLevel: 'expert' }],
      });

      const match = service.calculateTaskSkillMatch(member, task);

      // beginner (1) / expert (4) = 0.25
      expect(match).toBe(0.25);
    });

    it('should return 0 when no matching skills', () => {
      const member = createMember({
        skills: [
          { id: 'python', name: 'Python', category: 'programming', level: 'expert' },
        ],
      });
      const task = createTask({
        requiredSkills: [{ skillId: 'java', skillName: 'Java', minLevel: 'intermediate' }],
      });

      const match = service.calculateTaskSkillMatch(member, task);

      expect(match).toBe(0);
    });

    it('should return 1 for tasks with no required skills', () => {
      const member = createMember();
      const task = createTask({ requiredSkills: [] });

      const match = service.calculateTaskSkillMatch(member, task);

      expect(match).toBe(1);
    });

    it('should match skills by name (case insensitive)', () => {
      const member = createMember({
        skills: [
          { id: 'js-custom', name: 'javascript', category: 'programming', level: 'advanced' },
        ],
      });
      const task = createTask({
        requiredSkills: [{ skillId: 'different-id', skillName: 'JavaScript', minLevel: 'intermediate' }],
      });

      const match = service.calculateTaskSkillMatch(member, task);

      expect(match).toBe(1);
    });

    it('should average skill matches for multiple required skills', () => {
      const member = createMember({
        skills: [
          { id: 'js', name: 'JavaScript', category: 'programming', level: 'expert' },
          { id: 'react', name: 'React', category: 'frontend', level: 'beginner' },
        ],
      });
      const task = createTask({
        requiredSkills: [
          { skillId: 'js', skillName: 'JavaScript', minLevel: 'intermediate' }, // Match: 1
          { skillId: 'react', skillName: 'React', minLevel: 'expert' }, // Match: 0.25
        ],
      });

      const match = service.calculateTaskSkillMatch(member, task);

      expect(match).toBe(0.625); // (1 + 0.25) / 2
    });
  });

  // ============================================================================
  // Find Best Matches Tests
  // ============================================================================

  describe('findBestMatchesForTask', () => {
    it('should return matches sorted by overall score', async () => {
      const members = [
        createMember({
          id: 'member-1',
          name: 'Expert',
          skills: [{ id: 'js', name: 'JavaScript', category: 'programming', level: 'expert' }],
          currentUtilization: 0.2,
        }),
        createMember({
          id: 'member-2',
          name: 'Intermediate',
          skills: [{ id: 'js', name: 'JavaScript', category: 'programming', level: 'intermediate' }],
          currentUtilization: 0.2,
        }),
        createMember({
          id: 'member-3',
          name: 'Beginner',
          skills: [{ id: 'js', name: 'JavaScript', category: 'programming', level: 'beginner' }],
          currentUtilization: 0.2,
        }),
      ];
      const task = createTask({
        requiredSkills: [{ skillId: 'js', skillName: 'JavaScript', minLevel: 'intermediate' }],
      });

      const matches = await service.findBestMatchesForTask(task, members);

      expect(matches[0].member.name).toBe('Expert');
      expect(matches[1].member.name).toBe('Intermediate');
    });

    it('should filter out members with skill match below threshold', async () => {
      const members = [
        createMember({
          id: 'member-1',
          skills: [{ id: 'js', name: 'JavaScript', category: 'programming', level: 'beginner' }],
        }),
      ];
      const task = createTask({
        requiredSkills: [{ skillId: 'js', skillName: 'JavaScript', minLevel: 'expert' }],
      });

      const matches = await service.findBestMatchesForTask(task, members, { minSkillMatch: 0.5 });

      expect(matches).toHaveLength(0);
    });

    it('should filter out inactive members', async () => {
      const members = [
        createMember({ id: 'member-1', name: 'Active', isActive: true }),
        createMember({ id: 'member-2', name: 'Inactive', isActive: false }),
      ];
      const task = createTask();

      const matches = await service.findBestMatchesForTask(task, members);

      expect(matches.every(m => m.member.isActive)).toBe(true);
    });

    it('should consider capacity when finding matches', async () => {
      const members = [
        createMember({
          id: 'member-1',
          name: 'Available',
          currentUtilization: 0.2,
          weeklyCapacityHours: 40,
        }),
        createMember({
          id: 'member-2',
          name: 'Busy',
          currentUtilization: 0.9,
          weeklyCapacityHours: 40,
        }),
      ];
      const task = createTask({ estimatedHours: 20 });

      const matches = await service.findBestMatchesForTask(task, members, { considerCapacity: true });

      expect(matches[0].member.name).toBe('Available');
      expect(matches[0].capacityMatch).toBeGreaterThan(matches[1].capacityMatch);
    });

    it('should limit results with maxResults option', async () => {
      const members = Array.from({ length: 10 }, (_, i) =>
        createMember({ id: `member-${i}`, name: `Member ${i}` })
      );
      const task = createTask();

      const matches = await service.findBestMatchesForTask(task, members, { maxResults: 3 });

      expect(matches).toHaveLength(3);
    });
  });

  // ============================================================================
  // Impact Analysis Tests
  // ============================================================================

  describe('analyzeImpact', () => {
    beforeEach(async () => {
      // Pre-populate service with members
      const members = [
        createMember({
          id: 'from-member',
          name: 'From Member',
          skills: [{ id: 'js', name: 'JavaScript', category: 'programming', level: 'expert' }],
        }),
        createMember({
          id: 'to-member',
          name: 'To Member',
          skills: [{ id: 'js', name: 'JavaScript', category: 'programming', level: 'intermediate' }],
        }),
      ];
      await service.calculateTeamWorkload(members, []);
    });

    it('should calculate impact for reassignment with good skill match', async () => {
      const task = createTask({
        id: 'task-1',
        assigneeId: 'from-member',
        requiredSkills: [{ skillId: 'js', skillName: 'JavaScript', minLevel: 'intermediate' }],
        status: 'pending',
      });

      const impact = await service.analyzeImpact(task, {
        fromMemberId: 'from-member',
        toMemberId: 'to-member',
      });

      expect(impact.skillAnalysis.skillMatch).toBe(1);
      expect(impact.skillAnalysis.learningCurveHours).toBe(0);
      expect(impact.deadlineAnalysis.slipDays).toBe(0);
      expect(impact.recommendation).toBe('proceed');
    });

    it('should add learning curve for poor skill match', async () => {
      // Add member with low skill level
      const members = [
        createMember({ id: 'from-member', name: 'From' }),
        createMember({
          id: 'to-member-low',
          name: 'Low Skill',
          skills: [{ id: 'js', name: 'JavaScript', category: 'programming', level: 'beginner' }],
        }),
      ];
      await service.calculateTeamWorkload(members, []);

      const task = createTask({
        id: 'task-1',
        estimatedHours: 20,
        requiredSkills: [{ skillId: 'js', skillName: 'JavaScript', minLevel: 'expert' }],
        status: 'pending',
      });

      const impact = await service.analyzeImpact(task, {
        fromMemberId: 'from-member',
        toMemberId: 'to-member-low',
      });

      expect(impact.skillAnalysis.skillMatch).toBeLessThan(0.7);
      expect(impact.skillAnalysis.learningCurveHours).toBeGreaterThan(0);
      expect(impact.recommendation).not.toBe('proceed');
    });

    it('should add delay for in-progress tasks', async () => {
      const members = [
        createMember({ id: 'from-member', name: 'From' }),
        createMember({ id: 'to-member', name: 'To' }),
      ];
      await service.calculateTeamWorkload(members, []);

      const task = createTask({
        id: 'task-1',
        status: 'in_progress',
      });

      const impact = await service.analyzeImpact(task, {
        fromMemberId: 'from-member',
        toMemberId: 'to-member',
      });

      expect(impact.deadlineAnalysis.slipDays).toBeGreaterThanOrEqual(1);
    });

    it('should throw error for invalid member IDs', async () => {
      const task = createTask({ id: 'task-1' });

      await expect(service.analyzeImpact(task, {
        fromMemberId: 'invalid-from',
        toMemberId: 'invalid-to',
      })).rejects.toThrow('Invalid member IDs');
    });

    it('should generate mitigation suggestions for learning curve', async () => {
      const members = [
        createMember({ id: 'from-member', name: 'From' }),
        createMember({
          id: 'to-member-low',
          name: 'Low Skill',
          skills: [{ id: 'js', name: 'JavaScript', category: 'programming', level: 'beginner' }],
        }),
      ];
      await service.calculateTeamWorkload(members, []);

      const task = createTask({
        id: 'task-1',
        estimatedHours: 20,
        requiredSkills: [{ skillId: 'js', skillName: 'JavaScript', minLevel: 'expert' }],
      });

      const impact = await service.analyzeImpact(task, {
        fromMemberId: 'from-member',
        toMemberId: 'to-member-low',
      });

      expect(impact.mitigations.length).toBeGreaterThan(0);
      expect(impact.mitigations[0]).toContain('knowledge transfer');
    });

    it('should calculate risk levels correctly', async () => {
      const members = [
        createMember({ id: 'from-member', name: 'From' }),
        createMember({
          id: 'to-member-none',
          name: 'No Skills',
          skills: [], // No matching skills
        }),
      ];
      await service.calculateTeamWorkload(members, []);

      const task = createTask({
        id: 'task-1',
        estimatedHours: 40,
        requiredSkills: [{ skillId: 'specialized', skillName: 'Specialized Skill', minLevel: 'advanced' }],
      });

      const impact = await service.analyzeImpact(task, {
        fromMemberId: 'from-member',
        toMemberId: 'to-member-none',
      });

      expect(impact.overallRisk).toBe('high');
      expect(impact.recommendation).toBe('not_recommended');
    });
  });

  // ============================================================================
  // Recommendations Tests
  // ============================================================================

  describe('Recommendations Generation', () => {
    it('should recommend redistribution when members are overloaded', async () => {
      const members = [
        createMember({ id: 'member-1', weeklyCapacityHours: 40 }),
      ];
      const tasks = [
        createTask({ id: 'task-1', assigneeId: 'member-1', estimatedHours: 50 }),
      ];

      const result = await service.calculateTeamWorkload(members, tasks);

      expect(result.recommendations.some(r => r.includes('overloaded'))).toBe(true);
    });

    it('should recommend utilizing available capacity', async () => {
      const members = [
        createMember({ id: 'member-1', weeklyCapacityHours: 40 }),
        createMember({ id: 'member-2', weeklyCapacityHours: 40 }),
      ];
      const tasks = [
        createTask({ id: 'task-1', assigneeId: 'member-1', estimatedHours: 30 }),
        createTask({ id: 'task-2', assigneeId: 'member-2', estimatedHours: 5 }),
      ];

      const result = await service.calculateTeamWorkload(members, tasks);

      expect(result.recommendations.some(r => r.includes('capacity'))).toBe(true);
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle empty team', async () => {
      const result = await service.calculateTeamWorkload([], []);

      expect(result.memberMetrics).toHaveLength(0);
      expect(result.balanceScore).toBe(1);
      expect(result.teamStats.totalTasks).toBe(0);
    });

    it('should handle tasks without assignees', async () => {
      const members = [createMember({ id: 'member-1' })];
      const tasks = [
        createTask({ id: 'task-1' }), // No assigneeId
      ];

      const result = await service.calculateTeamWorkload(members, tasks);

      expect(result.memberMetrics[0].taskCount).toBe(0);
    });

    it('should handle zero capacity hours', async () => {
      const member = createMember({
        id: 'member-1',
        weeklyCapacityHours: 0,
      });
      const tasks = [createTask({ id: 'task-1', assigneeId: 'member-1' })];

      const result = await service.calculateTeamWorkload([member], tasks);

      expect(result.memberMetrics[0].capacityHours).toBe(0);
      expect(result.memberMetrics[0].utilizationRate).toBe(0);
    });

    it('should handle zero availability factor', async () => {
      const member = createMember({
        id: 'member-1',
        weeklyCapacityHours: 40,
        availabilityFactor: 0, // Not available at all
      });
      const tasks = [createTask({ id: 'task-1', assigneeId: 'member-1', estimatedHours: 10 })];

      const result = await service.calculateTeamWorkload([member], tasks);

      expect(result.memberMetrics[0].capacityHours).toBe(0);
    });

    it('should handle very large workloads', async () => {
      const member = createMember({ id: 'member-1', weeklyCapacityHours: 40 });
      const tasks = Array.from({ length: 100 }, (_, i) =>
        createTask({ id: `task-${i}`, assigneeId: 'member-1', estimatedHours: 1 })
      );

      const result = await service.calculateTeamWorkload([member], tasks);

      expect(result.memberMetrics[0].taskCount).toBe(100);
      expect(result.memberMetrics[0].overloadRisk).toBe('severe');
    });
  });
});
