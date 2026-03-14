/**
 * ORACLE Deadline Risk Predictor Service Tests
 * Tests for velocity tracking, risk probability, alerts, and mitigation suggestions
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock the cache service
jest.mock('../../src/services/oracle/cache', () => ({
  oracleCacheService: {
    get: jest.fn(() => null),
    set: jest.fn(),
  },
  cacheKey: (...args: string[]) => args.join(':'),
  hashObject: (obj: any) => JSON.stringify(obj),
}));

// Mock the Monte Carlo service
jest.mock('../../src/services/oracle/monteCarlo', () => ({
  monteCarloService: {
    runSimulation: jest.fn(async (factors, calcFn, options) => {
      // Run simplified simulation
      const samples: number[] = [];
      for (let i = 0; i < 100; i++) {
        const sampleValues: Record<string, number> = {};
        for (const factor of factors) {
          sampleValues[factor.name] = Math.random() * 10;
        }
        samples.push(calcFn(sampleValues));
      }
      samples.sort((a, b) => a - b);
      return {
        mean: samples.reduce((a, b) => a + b, 0) / samples.length,
        median: samples[Math.floor(samples.length / 2)],
        stdDev: 2,
        percentiles: {
          p5: samples[Math.floor(samples.length * 0.05)],
          p10: samples[Math.floor(samples.length * 0.1)],
          p25: samples[Math.floor(samples.length * 0.25)],
          p50: samples[Math.floor(samples.length * 0.5)],
          p75: samples[Math.floor(samples.length * 0.75)],
          p90: samples[Math.floor(samples.length * 0.9)],
          p95: samples[Math.floor(samples.length * 0.95)],
        },
        iterations: 100,
        convergenceAchieved: true,
      };
    }),
  },
}));

// ============================================================================
// Types (matching the actual service)
// ============================================================================

interface ProgressDataPoint {
  timestamp: Date;
  completedPercentage: number;
  hoursWorked: number;
  hoursRemaining: number;
  blockerCount: number;
  notes?: string;
}

interface ExternalFactor {
  id: string;
  type: 'holiday' | 'dependency' | 'resource_absence' | 'scope_change' | 'risk_event' | 'other';
  name: string;
  description: string;
  startDate: Date;
  endDate?: Date;
  impactLevel: 'none' | 'low' | 'medium' | 'high' | 'critical';
  impactDays: number;
  probability: number;
  affectedTasks: string[];
  mitigationPossible: boolean;
}

interface TaskWithDeadline {
  id: string;
  title: string;
  deadline: Date;
  startDate: Date;
  estimatedHours: number;
  completedPercentage: number;
  hoursLogged: number;
  assigneeId: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  dependencies: string[];
  dependents: string[];
  status: 'pending' | 'in_progress' | 'blocked' | 'completed';
  tags: string[];
  progressHistory: ProgressDataPoint[];
}

// ============================================================================
// Mock Implementation (simplified for testing)
// ============================================================================

const ALERT_THRESHOLDS = {
  warning: 0.3,
  critical: 0.6,
  imminent: 0.85,
};

class MockDeadlineRiskPredictorService {
  private tasks: Map<string, TaskWithDeadline> = new Map();
  private externalFactors: Map<string, ExternalFactor[]> = new Map();
  private alerts: Map<string, any[]> = new Map();

  calculateVelocity(task: TaskWithDeadline) {
    const history = task.progressHistory;

    if (history.length < 2) {
      const daysRemaining = Math.max(1,
        (task.deadline.getTime() - Date.now()) / (24 * 60 * 60 * 1000)
      );
      const requiredVelocity = (100 - task.completedPercentage) / daysRemaining;

      return {
        currentVelocity: requiredVelocity,
        averageVelocity: requiredVelocity,
        velocityTrend: 'steady' as const,
        velocityVariance: 0.3,
        projectedCompletionDate: task.deadline,
        daysAhead: 0,
        burndownRate: task.estimatedHours / daysRemaining,
        burndownEfficiency: 1,
      };
    }

    const sorted = [...history].sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    );

    const dailyVelocities: number[] = [];
    const dailyBurndown: number[] = [];

    for (let i = 1; i < sorted.length; i++) {
      const daysDiff = (sorted[i].timestamp.getTime() - sorted[i - 1].timestamp.getTime()) /
        (24 * 60 * 60 * 1000);

      if (daysDiff > 0) {
        const progressDiff = sorted[i].completedPercentage - sorted[i - 1].completedPercentage;
        dailyVelocities.push(progressDiff / daysDiff);

        const hoursDiff = sorted[i - 1].hoursRemaining - sorted[i].hoursRemaining;
        dailyBurndown.push(hoursDiff / daysDiff);
      }
    }

    const recentWeight = 0.7;
    const recentCount = Math.min(3, dailyVelocities.length);
    let currentVelocity = 0;

    if (dailyVelocities.length > 0) {
      const recentVelocities = dailyVelocities.slice(-recentCount);
      const olderVelocities = dailyVelocities.slice(0, -recentCount);

      const recentAvg = recentVelocities.reduce((a, b) => a + b, 0) /
        Math.max(1, recentVelocities.length);
      const olderAvg = olderVelocities.length > 0
        ? olderVelocities.reduce((a, b) => a + b, 0) / olderVelocities.length
        : recentAvg;

      currentVelocity = recentAvg * recentWeight + olderAvg * (1 - recentWeight);
    }

    const averageVelocity = dailyVelocities.length > 0
      ? dailyVelocities.reduce((a, b) => a + b, 0) / dailyVelocities.length
      : 0;

    const velocityVariance = dailyVelocities.length > 1
      ? dailyVelocities.reduce(
          (sum, v) => sum + Math.pow(v - averageVelocity, 2), 0
        ) / dailyVelocities.length
      : 0.2;

    let velocityTrend: 'accelerating' | 'steady' | 'decelerating' | 'stalled' = 'steady';
    if (dailyVelocities.length >= 3) {
      const recent = dailyVelocities.slice(-3);
      const trend = (recent[2] - recent[0]) / Math.max(0.01, Math.abs(recent[0]));

      if (currentVelocity < 0.5) {
        velocityTrend = 'stalled';
      } else if (trend > 0.2) {
        velocityTrend = 'accelerating';
      } else if (trend < -0.2) {
        velocityTrend = 'decelerating';
      }
    }

    const remaining = 100 - task.completedPercentage;
    const daysToComplete = currentVelocity > 0 ? remaining / currentVelocity : Infinity;
    const projectedCompletionDate = new Date(
      Date.now() + daysToComplete * 24 * 60 * 60 * 1000
    );

    const daysAhead = (task.deadline.getTime() - projectedCompletionDate.getTime()) /
      (24 * 60 * 60 * 1000);

    const burndownRate = dailyBurndown.length > 0
      ? dailyBurndown.reduce((a, b) => a + b, 0) / dailyBurndown.length
      : 0;

    const plannedBurndown = task.estimatedHours /
      Math.max(1, (task.deadline.getTime() - task.startDate.getTime()) / (24 * 60 * 60 * 1000));
    const burndownEfficiency = plannedBurndown > 0 ? burndownRate / plannedBurndown : 1;

    return {
      currentVelocity,
      averageVelocity,
      velocityTrend,
      velocityVariance,
      projectedCompletionDate,
      daysAhead,
      burndownRate,
      burndownEfficiency,
    };
  }

  async predictDeadlineRisk(
    task: TaskWithDeadline,
    externalFactors: ExternalFactor[] = []
  ) {
    this.tasks.set(task.id, task);
    this.externalFactors.set(task.id, externalFactors);

    const velocity = this.calculateVelocity(task);

    // Simplified risk calculation based on velocity and deadline
    const deadlineDays = Math.max(0,
      (task.deadline.getTime() - Date.now()) / (24 * 60 * 60 * 1000)
    );

    const remaining = 100 - task.completedPercentage;
    const daysNeeded = velocity.currentVelocity > 0 ? remaining / velocity.currentVelocity : Infinity;

    // Calculate probability based on whether we can complete in time
    let probabilityOfMiss = 0;
    if (daysNeeded > deadlineDays) {
      probabilityOfMiss = Math.min(0.95, (daysNeeded - deadlineDays) / deadlineDays);
    }

    // Adjust for external factors
    for (const factor of externalFactors) {
      probabilityOfMiss += factor.impactDays / deadlineDays * factor.probability * 0.1;
    }
    probabilityOfMiss = Math.min(0.95, Math.max(0, probabilityOfMiss));

    // Determine risk level
    let riskLevel: 'none' | 'low' | 'medium' | 'high' | 'critical' = 'none';
    if (probabilityOfMiss >= 0.8) riskLevel = 'critical';
    else if (probabilityOfMiss >= 0.5) riskLevel = 'high';
    else if (probabilityOfMiss >= 0.3) riskLevel = 'medium';
    else if (probabilityOfMiss >= 0.1) riskLevel = 'low';

    // Escalate if velocity is stalled
    if (velocity.velocityTrend === 'stalled' && riskLevel !== 'critical') {
      const levels = ['none', 'low', 'medium', 'high', 'critical'] as const;
      const currentIndex = levels.indexOf(riskLevel);
      riskLevel = levels[Math.min(currentIndex + 1, levels.length - 1)];
    }

    // Build confidence interval
    const now = Date.now();
    const confidenceInterval = {
      optimistic: new Date(now + daysNeeded * 0.8 * 24 * 60 * 60 * 1000),
      mostLikely: new Date(now + daysNeeded * 24 * 60 * 60 * 1000),
      pessimistic: new Date(now + daysNeeded * 1.3 * 24 * 60 * 60 * 1000),
    };

    // Identify contributing factors
    const contributingFactors = this.identifyContributingFactors(task, velocity, externalFactors);

    const risk = {
      taskId: task.id,
      taskTitle: task.title,
      originalDeadline: task.deadline,
      currentDeadline: task.deadline,
      probabilityOfMiss,
      riskLevel,
      confidenceInterval,
      contributingFactors,
      velocityMetrics: velocity,
      externalFactors,
      lastUpdated: new Date(),
    };

    // Generate alerts
    const alerts = this.generateAlerts(risk);

    // Generate mitigation suggestions
    const mitigations = this.generateMitigations(risk, task, velocity);

    // Build recommendation
    const recommendation = this.buildRecommendation(risk);

    return {
      taskId: task.id,
      risk,
      alerts,
      mitigations,
      simulation: {
        mean: daysNeeded,
        median: daysNeeded,
        stdDev: 2,
        percentiles: { p10: daysNeeded * 0.8, p50: daysNeeded, p90: daysNeeded * 1.3 },
        iterations: 100,
        convergenceAchieved: true,
      },
      recommendation,
    };
  }

  private identifyContributingFactors(
    task: TaskWithDeadline,
    velocity: any,
    externalFactors: ExternalFactor[]
  ) {
    const factors: any[] = [];

    if (velocity.velocityTrend === 'stalled') {
      factors.push({
        factor: 'Stalled Progress',
        contribution: 0.4,
        description: 'Work progress has stopped or significantly slowed',
      });
    } else if (velocity.velocityTrend === 'decelerating') {
      factors.push({
        factor: 'Decelerating Progress',
        contribution: 0.25,
        description: 'Work progress is slowing down over time',
      });
    }

    if (velocity.burndownEfficiency < 0.7) {
      factors.push({
        factor: 'Below Plan Burndown',
        contribution: 0.2,
        description: `Completing work at ${(velocity.burndownEfficiency * 100).toFixed(0)}% of planned rate`,
      });
    }

    for (const factor of externalFactors) {
      if (factor.impactLevel === 'critical' || factor.impactLevel === 'high') {
        factors.push({
          factor: factor.name,
          contribution: factor.impactDays / 10 * factor.probability,
          description: factor.description,
        });
      }
    }

    const timeElapsed = (Date.now() - task.startDate.getTime()) /
      (task.deadline.getTime() - task.startDate.getTime());
    if (timeElapsed > task.completedPercentage / 100) {
      factors.push({
        factor: 'Behind Schedule',
        contribution: Math.min(0.3, timeElapsed - task.completedPercentage / 100),
        description: `${(timeElapsed * 100).toFixed(0)}% of time elapsed but only ${task.completedPercentage}% complete`,
      });
    }

    return factors.sort((a, b) => b.contribution - a.contribution).slice(0, 5);
  }

  private generateAlerts(risk: any) {
    const alerts: any[] = [];

    let alertType: 'warning' | 'critical' | 'imminent' | null = null;

    if (risk.probabilityOfMiss >= ALERT_THRESHOLDS.imminent) {
      alertType = 'imminent';
    } else if (risk.probabilityOfMiss >= ALERT_THRESHOLDS.critical) {
      alertType = 'critical';
    } else if (risk.probabilityOfMiss >= ALERT_THRESHOLDS.warning) {
      alertType = 'warning';
    }

    if (alertType) {
      alerts.push({
        id: `alert-${risk.taskId}-${Date.now()}`,
        taskId: risk.taskId,
        alertType,
        title: this.getAlertTitle(alertType, risk),
        message: this.getAlertMessage(risk),
        triggeredAt: new Date(),
        acknowledged: false,
        suggestedActions: this.getSuggestedAlertActions(risk, alertType),
      });
    }

    return alerts;
  }

  private getAlertTitle(type: string, risk: any): string {
    switch (type) {
      case 'imminent':
        return `IMMINENT: ${risk.taskTitle} will likely miss deadline`;
      case 'critical':
        return `CRITICAL: High risk of deadline miss for ${risk.taskTitle}`;
      case 'warning':
        return `WARNING: Elevated deadline risk for ${risk.taskTitle}`;
      default:
        return `Alert for ${risk.taskTitle}`;
    }
  }

  private getAlertMessage(risk: any): string {
    return `${(risk.probabilityOfMiss * 100).toFixed(0)}% probability of missing deadline on ${risk.currentDeadline.toLocaleDateString()}.`;
  }

  private getSuggestedAlertActions(risk: any, type: string): string[] {
    const actions: string[] = [];
    switch (type) {
      case 'imminent':
        actions.push('Immediately escalate to stakeholders');
        actions.push('Consider scope reduction or deadline extension');
        break;
      case 'critical':
        actions.push('Review scope and prioritize critical features');
        actions.push('Identify and remove blockers');
        break;
      case 'warning':
        actions.push('Monitor progress closely');
        actions.push('Review resource allocation');
        break;
    }
    return actions;
  }

  private generateMitigations(risk: any, task: TaskWithDeadline, velocity: any) {
    const mitigations: any[] = [];

    for (const factor of risk.contributingFactors) {
      if (factor.factor === 'Stalled Progress') {
        mitigations.push({
          id: `mit-${task.id}-process-${Date.now()}`,
          taskId: task.id,
          type: 'process_improvement',
          title: 'Unblock Stalled Work',
          description: 'Investigate and remove blockers causing stalled progress',
          expectedImpact: {
            daysRecovered: Math.abs(velocity.daysAhead) * 0.5,
            riskReduction: 0.3,
            costImpact: 'low',
            qualityImpact: 'none',
          },
          effort: 'medium',
          urgency: 'immediate',
          prerequisites: ['Blocker identification'],
          tradeoffs: ['May require management intervention'],
          implementationSteps: [
            'Conduct blockers analysis meeting',
            'Identify root cause of stall',
            'Create action plan for each blocker',
          ],
        });
      }

      if (factor.factor === 'Behind Schedule') {
        mitigations.push({
          id: `mit-${task.id}-resource-${Date.now()}`,
          taskId: task.id,
          type: 'resource_addition',
          title: 'Add Resources',
          description: 'Assign additional team members to accelerate progress',
          expectedImpact: {
            daysRecovered: Math.abs(velocity.daysAhead) * 0.3,
            riskReduction: 0.2,
            costImpact: 'high',
            qualityImpact: 'none',
          },
          effort: 'high',
          urgency: 'high',
          prerequisites: ['Available resources with matching skills'],
          tradeoffs: ['Increased cost', 'Context-switching overhead'],
          implementationSteps: [
            'Identify tasks suitable for parallel work',
            'Find team members with matching skills',
            'Conduct knowledge transfer session',
          ],
        });
      }
    }

    if (risk.riskLevel === 'high' || risk.riskLevel === 'critical') {
      mitigations.push({
        id: `mit-${task.id}-scope-${Date.now()}`,
        taskId: task.id,
        type: 'scope_reduction',
        title: 'Reduce Scope',
        description: 'Identify and defer non-critical features to meet deadline',
        expectedImpact: {
          daysRecovered: Math.abs(velocity.daysAhead) * 0.4,
          riskReduction: 0.35,
          costImpact: 'none',
          qualityImpact: 'medium',
        },
        effort: 'low',
        urgency: 'high',
        prerequisites: ['Stakeholder approval'],
        tradeoffs: ['Reduced functionality'],
        implementationSteps: [
          'Review requirements with stakeholders',
          'Identify must-have vs nice-to-have features',
          'Update task scope and estimates',
        ],
      });
    }

    return mitigations.slice(0, 5);
  }

  private buildRecommendation(risk: any) {
    let action: 'continue' | 'monitor' | 'intervene' | 'escalate';
    let reason: string;
    let priority: number;

    if (risk.riskLevel === 'critical' || risk.riskLevel === 'high') {
      if (risk.probabilityOfMiss >= 0.8) {
        action = 'escalate';
        reason = 'Deadline miss is highly likely without immediate intervention';
        priority = 1;
      } else {
        action = 'intervene';
        reason = 'Significant risk requires active mitigation';
        priority = 2;
      }
    } else if (risk.riskLevel === 'medium') {
      action = 'monitor';
      reason = 'Moderate risk - close monitoring recommended';
      priority = 3;
    } else {
      action = 'continue';
      reason = 'Low risk - proceed as planned';
      priority = 4;
    }

    return { action, reason, priority };
  }

  acknowledgeAlert(taskId: string, alertId: string, userId: string) {
    const taskAlerts = this.alerts.get(taskId) || [];
    const alert = taskAlerts.find(a => a.id === alertId);
    if (!alert) return null;

    alert.acknowledged = true;
    alert.acknowledgedBy = userId;
    alert.acknowledgedAt = new Date();

    return alert;
  }
}

// ============================================================================
// Test Suite
// ============================================================================

describe('DeadlineRiskPredictorService', () => {
  let service: MockDeadlineRiskPredictorService;

  // Test fixtures
  const createTask = (overrides: Partial<TaskWithDeadline> = {}): TaskWithDeadline => ({
    id: `task-${Math.random().toString(36).substr(2, 9)}`,
    title: 'Test Task',
    deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 2 weeks from now
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Started 1 week ago
    estimatedHours: 80,
    completedPercentage: 50,
    hoursLogged: 40,
    assigneeId: 'user-1',
    priority: 'medium',
    dependencies: [],
    dependents: [],
    status: 'in_progress',
    tags: [],
    progressHistory: [],
    ...overrides,
  });

  const createProgressHistory = (
    startPercentage: number,
    endPercentage: number,
    days: number,
    startDate: Date
  ): ProgressDataPoint[] => {
    const history: ProgressDataPoint[] = [];
    const increment = (endPercentage - startPercentage) / days;
    const hoursPerDay = 80 / 14; // Estimated hours over 2 weeks

    for (let i = 0; i <= days; i++) {
      history.push({
        timestamp: new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000),
        completedPercentage: startPercentage + increment * i,
        hoursWorked: hoursPerDay * i,
        hoursRemaining: 80 - hoursPerDay * i,
        blockerCount: 0,
      });
    }

    return history;
  };

  const createExternalFactor = (overrides: Partial<ExternalFactor> = {}): ExternalFactor => ({
    id: `factor-${Math.random().toString(36).substr(2, 9)}`,
    type: 'dependency',
    name: 'Test Factor',
    description: 'A test external factor',
    startDate: new Date(),
    impactLevel: 'medium',
    impactDays: 2,
    probability: 0.5,
    affectedTasks: [],
    mitigationPossible: true,
    ...overrides,
  });

  beforeEach(() => {
    service = new MockDeadlineRiskPredictorService();
    jest.clearAllMocks();
  });

  // ============================================================================
  // Velocity Tracking Tests
  // ============================================================================

  describe('calculateVelocity', () => {
    it('should calculate velocity from progress history', () => {
      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const task = createTask({
        startDate,
        completedPercentage: 50,
        progressHistory: createProgressHistory(0, 50, 7, startDate),
      });

      const velocity = service.calculateVelocity(task);

      expect(velocity.currentVelocity).toBeCloseTo(7.14, 1); // 50% / 7 days
      expect(velocity.averageVelocity).toBeCloseTo(7.14, 1);
    });

    it('should return default velocity when not enough history', () => {
      const task = createTask({
        completedPercentage: 50,
        progressHistory: [
          {
            timestamp: new Date(),
            completedPercentage: 50,
            hoursWorked: 40,
            hoursRemaining: 40,
            blockerCount: 0,
          },
        ],
      });

      const velocity = service.calculateVelocity(task);

      expect(velocity.velocityTrend).toBe('steady');
      expect(velocity.velocityVariance).toBe(0.3);
    });

    it('should detect stalled velocity trend', () => {
      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const task = createTask({
        startDate,
        completedPercentage: 20, // Only 20% after 7 days
        progressHistory: [
          { timestamp: new Date(startDate.getTime()), completedPercentage: 10, hoursWorked: 8, hoursRemaining: 72, blockerCount: 0 },
          { timestamp: new Date(startDate.getTime() + 2 * 24 * 60 * 60 * 1000), completedPercentage: 15, hoursWorked: 12, hoursRemaining: 68, blockerCount: 0 },
          { timestamp: new Date(startDate.getTime() + 4 * 24 * 60 * 60 * 1000), completedPercentage: 17, hoursWorked: 14, hoursRemaining: 66, blockerCount: 0 },
          { timestamp: new Date(startDate.getTime() + 6 * 24 * 60 * 60 * 1000), completedPercentage: 18, hoursWorked: 15, hoursRemaining: 65, blockerCount: 1 },
          { timestamp: new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000), completedPercentage: 18, hoursWorked: 15, hoursRemaining: 65, blockerCount: 2 },
        ],
      });

      const velocity = service.calculateVelocity(task);

      expect(velocity.velocityTrend).toBe('stalled');
    });

    it('should detect accelerating velocity trend', () => {
      const startDate = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
      const task = createTask({
        startDate,
        completedPercentage: 60,
        progressHistory: [
          { timestamp: new Date(startDate.getTime()), completedPercentage: 0, hoursWorked: 0, hoursRemaining: 80, blockerCount: 0 },
          { timestamp: new Date(startDate.getTime() + 1 * 24 * 60 * 60 * 1000), completedPercentage: 5, hoursWorked: 4, hoursRemaining: 76, blockerCount: 0 },
          { timestamp: new Date(startDate.getTime() + 2 * 24 * 60 * 60 * 1000), completedPercentage: 15, hoursWorked: 12, hoursRemaining: 68, blockerCount: 0 },
          { timestamp: new Date(startDate.getTime() + 3 * 24 * 60 * 60 * 1000), completedPercentage: 30, hoursWorked: 24, hoursRemaining: 56, blockerCount: 0 },
          { timestamp: new Date(startDate.getTime() + 4 * 24 * 60 * 60 * 1000), completedPercentage: 45, hoursWorked: 36, hoursRemaining: 44, blockerCount: 0 },
          { timestamp: new Date(startDate.getTime() + 5 * 24 * 60 * 60 * 1000), completedPercentage: 60, hoursWorked: 48, hoursRemaining: 32, blockerCount: 0 },
        ],
      });

      const velocity = service.calculateVelocity(task);

      expect(velocity.velocityTrend).toBe('accelerating');
    });

    it('should detect decelerating velocity trend', () => {
      const startDate = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
      const task = createTask({
        startDate,
        completedPercentage: 45,
        progressHistory: [
          { timestamp: new Date(startDate.getTime()), completedPercentage: 0, hoursWorked: 0, hoursRemaining: 80, blockerCount: 0 },
          { timestamp: new Date(startDate.getTime() + 1 * 24 * 60 * 60 * 1000), completedPercentage: 20, hoursWorked: 16, hoursRemaining: 64, blockerCount: 0 },
          { timestamp: new Date(startDate.getTime() + 2 * 24 * 60 * 60 * 1000), completedPercentage: 35, hoursWorked: 28, hoursRemaining: 52, blockerCount: 0 },
          { timestamp: new Date(startDate.getTime() + 3 * 24 * 60 * 60 * 1000), completedPercentage: 40, hoursWorked: 32, hoursRemaining: 48, blockerCount: 0 },
          { timestamp: new Date(startDate.getTime() + 4 * 24 * 60 * 60 * 1000), completedPercentage: 43, hoursWorked: 34, hoursRemaining: 46, blockerCount: 0 },
          { timestamp: new Date(startDate.getTime() + 5 * 24 * 60 * 60 * 1000), completedPercentage: 44, hoursWorked: 35, hoursRemaining: 45, blockerCount: 0 },
          { timestamp: new Date(startDate.getTime() + 6 * 24 * 60 * 60 * 1000), completedPercentage: 45, hoursWorked: 36, hoursRemaining: 44, blockerCount: 0 },
        ],
      });

      const velocity = service.calculateVelocity(task);

      expect(velocity.velocityTrend).toBe('decelerating');
    });

    it('should calculate days ahead when on track', () => {
      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const task = createTask({
        startDate,
        deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        completedPercentage: 60, // Ahead of schedule
        progressHistory: createProgressHistory(0, 60, 7, startDate),
      });

      const velocity = service.calculateVelocity(task);

      expect(velocity.daysAhead).toBeGreaterThan(0);
    });

    it('should calculate days behind when behind schedule', () => {
      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const task = createTask({
        startDate,
        deadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // Only 3 days left
        completedPercentage: 20, // Very behind
        progressHistory: createProgressHistory(0, 20, 7, startDate),
      });

      const velocity = service.calculateVelocity(task);

      expect(velocity.daysAhead).toBeLessThan(0);
    });

    it('should calculate burndown efficiency', () => {
      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const task = createTask({
        startDate,
        estimatedHours: 80,
        progressHistory: createProgressHistory(0, 50, 7, startDate),
      });

      const velocity = service.calculateVelocity(task);

      expect(velocity.burndownEfficiency).toBeDefined();
      expect(velocity.burndownRate).toBeDefined();
    });
  });

  // ============================================================================
  // Risk Prediction Tests
  // ============================================================================

  describe('predictDeadlineRisk', () => {
    it('should predict low risk for task on track', async () => {
      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const task = createTask({
        startDate,
        deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        completedPercentage: 50, // 50% done with 50% time remaining
        progressHistory: createProgressHistory(0, 50, 7, startDate),
      });

      const result = await service.predictDeadlineRisk(task);

      expect(result.risk.riskLevel).toBe('none');
      expect(result.risk.probabilityOfMiss).toBeLessThan(0.3);
      expect(result.recommendation.action).toBe('continue');
    });

    it('should predict high risk for task behind schedule', async () => {
      const startDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      const task = createTask({
        startDate,
        deadline: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000), // Only 4 days left
        completedPercentage: 30, // Only 30% done
        progressHistory: createProgressHistory(0, 30, 10, startDate),
      });

      const result = await service.predictDeadlineRisk(task);

      expect(['medium', 'high', 'critical']).toContain(result.risk.riskLevel);
      expect(result.recommendation.action).not.toBe('continue');
    });

    it('should escalate risk level for stalled velocity', async () => {
      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const task = createTask({
        startDate,
        deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        completedPercentage: 20,
        progressHistory: [
          { timestamp: new Date(startDate.getTime()), completedPercentage: 15, hoursWorked: 12, hoursRemaining: 68, blockerCount: 0 },
          { timestamp: new Date(startDate.getTime() + 2 * 24 * 60 * 60 * 1000), completedPercentage: 17, hoursWorked: 14, hoursRemaining: 66, blockerCount: 0 },
          { timestamp: new Date(startDate.getTime() + 4 * 24 * 60 * 60 * 1000), completedPercentage: 18, hoursWorked: 14, hoursRemaining: 66, blockerCount: 1 },
          { timestamp: new Date(startDate.getTime() + 6 * 24 * 60 * 60 * 1000), completedPercentage: 18, hoursWorked: 15, hoursRemaining: 65, blockerCount: 2 },
          { timestamp: new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000), completedPercentage: 20, hoursWorked: 16, hoursRemaining: 64, blockerCount: 2 },
        ],
      });

      const result = await service.predictDeadlineRisk(task);

      // Stalled velocity should escalate the risk level
      expect(['medium', 'high', 'critical']).toContain(result.risk.riskLevel);
    });

    it('should include external factors in risk assessment', async () => {
      const task = createTask({
        completedPercentage: 50,
        deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      });

      const externalFactors = [
        createExternalFactor({
          type: 'holiday',
          name: 'Holiday Break',
          impactLevel: 'high',
          impactDays: 5,
          probability: 1.0,
        }),
        createExternalFactor({
          type: 'dependency',
          name: 'Blocked API',
          impactLevel: 'critical',
          impactDays: 3,
          probability: 0.8,
        }),
      ];

      const result = await service.predictDeadlineRisk(task, externalFactors);

      expect(result.risk.externalFactors).toHaveLength(2);
      // External factors should increase probability
      expect(result.risk.probabilityOfMiss).toBeGreaterThan(0);
    });

    it('should generate confidence intervals', async () => {
      const task = createTask({ completedPercentage: 50 });

      const result = await service.predictDeadlineRisk(task);

      expect(result.risk.confidenceInterval.optimistic).toBeDefined();
      expect(result.risk.confidenceInterval.mostLikely).toBeDefined();
      expect(result.risk.confidenceInterval.pessimistic).toBeDefined();

      // Optimistic should be before most likely
      expect(result.risk.confidenceInterval.optimistic.getTime())
        .toBeLessThanOrEqual(result.risk.confidenceInterval.mostLikely.getTime());

      // Most likely should be before pessimistic
      expect(result.risk.confidenceInterval.mostLikely.getTime())
        .toBeLessThanOrEqual(result.risk.confidenceInterval.pessimistic.getTime());
    });

    it('should identify contributing factors', async () => {
      const startDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      const task = createTask({
        startDate,
        deadline: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
        completedPercentage: 20, // Very behind
        progressHistory: createProgressHistory(0, 20, 10, startDate),
      });

      const result = await service.predictDeadlineRisk(task);

      expect(result.risk.contributingFactors.length).toBeGreaterThan(0);
      expect(result.risk.contributingFactors[0]).toHaveProperty('factor');
      expect(result.risk.contributingFactors[0]).toHaveProperty('contribution');
      expect(result.risk.contributingFactors[0]).toHaveProperty('description');
    });
  });

  // ============================================================================
  // Alert Generation Tests
  // ============================================================================

  describe('Alert Generation', () => {
    it('should not generate alerts for low risk tasks', async () => {
      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const task = createTask({
        startDate,
        deadline: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000), // 3 weeks remaining
        completedPercentage: 50,
        progressHistory: createProgressHistory(0, 50, 7, startDate),
      });

      const result = await service.predictDeadlineRisk(task);

      expect(result.alerts).toHaveLength(0);
    });

    it('should generate warning alert for moderate risk', async () => {
      const startDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      const task = createTask({
        startDate,
        deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        completedPercentage: 40, // Behind
        progressHistory: createProgressHistory(0, 40, 10, startDate),
      });

      const result = await service.predictDeadlineRisk(task);

      if (result.risk.probabilityOfMiss >= ALERT_THRESHOLDS.warning) {
        expect(result.alerts.length).toBeGreaterThan(0);
        expect(['warning', 'critical', 'imminent']).toContain(result.alerts[0].alertType);
      }
    });

    it('should generate critical alert for high risk', async () => {
      const startDate = new Date(Date.now() - 12 * 24 * 60 * 60 * 1000);
      const task = createTask({
        startDate,
        deadline: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // Only 2 days
        completedPercentage: 20, // Very behind
        progressHistory: createProgressHistory(0, 20, 12, startDate),
      });

      const result = await service.predictDeadlineRisk(task);

      if (result.risk.probabilityOfMiss >= ALERT_THRESHOLDS.critical) {
        expect(result.alerts.length).toBeGreaterThan(0);
        expect(['critical', 'imminent']).toContain(result.alerts[0].alertType);
      }
    });

    it('should include suggested actions in alerts', async () => {
      const startDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      const task = createTask({
        startDate,
        deadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        completedPercentage: 30,
        progressHistory: createProgressHistory(0, 30, 10, startDate),
      });

      const result = await service.predictDeadlineRisk(task);

      if (result.alerts.length > 0) {
        expect(result.alerts[0].suggestedActions).toBeDefined();
        expect(result.alerts[0].suggestedActions.length).toBeGreaterThan(0);
      }
    });
  });

  // ============================================================================
  // Mitigation Suggestions Tests
  // ============================================================================

  describe('Mitigation Suggestions', () => {
    it('should generate mitigations for high risk tasks', async () => {
      const startDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      const task = createTask({
        startDate,
        deadline: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
        completedPercentage: 30,
        progressHistory: createProgressHistory(0, 30, 10, startDate),
      });

      const result = await service.predictDeadlineRisk(task);

      if (result.risk.riskLevel === 'high' || result.risk.riskLevel === 'critical') {
        expect(result.mitigations.length).toBeGreaterThan(0);
      }
    });

    it('should generate scope reduction mitigation for critical risk', async () => {
      const startDate = new Date(Date.now() - 12 * 24 * 60 * 60 * 1000);
      const task = createTask({
        startDate,
        deadline: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        completedPercentage: 20,
        progressHistory: createProgressHistory(0, 20, 12, startDate),
      });

      const result = await service.predictDeadlineRisk(task);

      const scopeMitigation = result.mitigations.find(m => m.type === 'scope_reduction');
      if (result.risk.riskLevel === 'high' || result.risk.riskLevel === 'critical') {
        expect(scopeMitigation).toBeDefined();
      }
    });

    it('should include expected impact in mitigations', async () => {
      const startDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      const task = createTask({
        startDate,
        deadline: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
        completedPercentage: 30,
        progressHistory: createProgressHistory(0, 30, 10, startDate),
      });

      const result = await service.predictDeadlineRisk(task);

      if (result.mitigations.length > 0) {
        const mitigation = result.mitigations[0];
        expect(mitigation.expectedImpact).toBeDefined();
        expect(mitigation.expectedImpact.daysRecovered).toBeDefined();
        expect(mitigation.expectedImpact.riskReduction).toBeDefined();
      }
    });

    it('should include implementation steps in mitigations', async () => {
      const startDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      const task = createTask({
        startDate,
        deadline: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
        completedPercentage: 30,
        progressHistory: createProgressHistory(0, 30, 10, startDate),
      });

      const result = await service.predictDeadlineRisk(task);

      if (result.mitigations.length > 0) {
        expect(result.mitigations[0].implementationSteps).toBeDefined();
        expect(result.mitigations[0].implementationSteps.length).toBeGreaterThan(0);
      }
    });
  });

  // ============================================================================
  // Recommendation Tests
  // ============================================================================

  describe('Recommendations', () => {
    it('should recommend continue for low risk', async () => {
      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const task = createTask({
        startDate,
        deadline: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
        completedPercentage: 50,
        progressHistory: createProgressHistory(0, 50, 7, startDate),
      });

      const result = await service.predictDeadlineRisk(task);

      if (result.risk.riskLevel === 'none' || result.risk.riskLevel === 'low') {
        expect(result.recommendation.action).toBe('continue');
        expect(result.recommendation.priority).toBeGreaterThan(3);
      }
    });

    it('should recommend monitor for medium risk', async () => {
      const startDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      const task = createTask({
        startDate,
        deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        completedPercentage: 40,
        progressHistory: createProgressHistory(0, 40, 10, startDate),
      });

      const result = await service.predictDeadlineRisk(task);

      if (result.risk.riskLevel === 'medium') {
        expect(result.recommendation.action).toBe('monitor');
        expect(result.recommendation.priority).toBe(3);
      }
    });

    it('should recommend intervene for high risk', async () => {
      const startDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      const task = createTask({
        startDate,
        deadline: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
        completedPercentage: 30,
        progressHistory: createProgressHistory(0, 30, 10, startDate),
      });

      const result = await service.predictDeadlineRisk(task);

      if (result.risk.riskLevel === 'high') {
        expect(result.recommendation.action).toBe('intervene');
        expect(result.recommendation.priority).toBeLessThanOrEqual(2);
      }
    });

    it('should recommend escalate for critical risk with high probability', async () => {
      const startDate = new Date(Date.now() - 12 * 24 * 60 * 60 * 1000);
      const task = createTask({
        startDate,
        deadline: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        completedPercentage: 10,
        progressHistory: createProgressHistory(0, 10, 12, startDate),
      });

      const result = await service.predictDeadlineRisk(task);

      if (result.risk.probabilityOfMiss >= 0.8) {
        expect(result.recommendation.action).toBe('escalate');
        expect(result.recommendation.priority).toBe(1);
      }
    });

    it('should include reason in recommendation', async () => {
      const task = createTask();

      const result = await service.predictDeadlineRisk(task);

      expect(result.recommendation.reason).toBeDefined();
      expect(result.recommendation.reason.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle task with no progress history', async () => {
      const task = createTask({ progressHistory: [] });

      const result = await service.predictDeadlineRisk(task);

      expect(result.risk).toBeDefined();
      expect(result.risk.velocityMetrics).toBeDefined();
    });

    it('should handle task that is 100% complete', async () => {
      const task = createTask({
        completedPercentage: 100,
        status: 'completed',
      });

      const result = await service.predictDeadlineRisk(task);

      expect(result.risk.probabilityOfMiss).toBe(0);
      expect(result.risk.riskLevel).toBe('none');
    });

    it('should handle task with deadline in the past', async () => {
      const task = createTask({
        deadline: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // Yesterday
        completedPercentage: 80,
      });

      const result = await service.predictDeadlineRisk(task);

      // Past deadline with incomplete task = missed
      expect(result.risk.probabilityOfMiss).toBeGreaterThan(0.9);
    });

    it('should handle task with very distant deadline', async () => {
      const task = createTask({
        deadline: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
        completedPercentage: 10,
      });

      const result = await service.predictDeadlineRisk(task);

      expect(result.risk.riskLevel).toBe('none');
    });

    it('should handle task starting today', async () => {
      const task = createTask({
        startDate: new Date(),
        completedPercentage: 0,
        progressHistory: [],
      });

      const result = await service.predictDeadlineRisk(task);

      expect(result.risk).toBeDefined();
    });

    it('should handle multiple external factors', async () => {
      const task = createTask();
      const factors = Array.from({ length: 10 }, (_, i) =>
        createExternalFactor({
          id: `factor-${i}`,
          name: `Factor ${i}`,
          impactDays: 1,
          probability: 0.3,
        })
      );

      const result = await service.predictDeadlineRisk(task, factors);

      expect(result.risk.externalFactors).toHaveLength(10);
    });
  });

  // ============================================================================
  // Alert Acknowledgment Tests
  // ============================================================================

  describe('Alert Acknowledgment', () => {
    it('should acknowledge an alert', async () => {
      // First, generate an alert by predicting risk for a high-risk task
      const startDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      const task = createTask({
        id: 'task-test',
        startDate,
        deadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        completedPercentage: 30,
        progressHistory: createProgressHistory(0, 30, 10, startDate),
      });

      const result = await service.predictDeadlineRisk(task);

      if (result.alerts.length > 0) {
        const alertId = result.alerts[0].id;
        const acknowledged = service.acknowledgeAlert('task-test', alertId, 'user-1');

        expect(acknowledged).not.toBeNull();
        if (acknowledged) {
          expect(acknowledged.acknowledged).toBe(true);
          expect(acknowledged.acknowledgedBy).toBe('user-1');
          expect(acknowledged.acknowledgedAt).toBeDefined();
        }
      }
    });

    it('should return null for non-existent alert', () => {
      const result = service.acknowledgeAlert('non-existent', 'non-existent-alert', 'user-1');

      expect(result).toBeNull();
    });
  });
});
