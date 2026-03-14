/**
 * ORACLE Deadline Risk Predictor Service
 * Story smart-5 - Predict deadline misses early
 *
 * Implements:
 * - Progress velocity tracking (burndown rate)
 * - External factor consideration (holidays, dependencies)
 * - Risk probability using Monte Carlo simulation
 * - Early warning alert thresholds
 * - Mitigation suggestions generation
 *
 * Time Complexity:
 * - Velocity tracking: O(h) where h=history length
 * - Risk calculation: O(i * f) where i=iterations, f=factors
 * - Mitigation generation: O(r) where r=number of risks
 */

import { oracleCacheService, cacheKey, hashObject } from '../cache';
import { monteCarloService, SimulationFactor, SimulationOutput } from '../monteCarlo';

// ============================================================================
// Types
// ============================================================================

/**
 * Task progress data point
 */
export interface ProgressDataPoint {
  timestamp: Date;
  completedPercentage: number;
  hoursWorked: number;
  hoursRemaining: number;
  blockerCount: number;
  notes?: string;
}

/**
 * Velocity metrics
 */
export interface VelocityMetrics {
  currentVelocity: number; // Percentage points per day
  averageVelocity: number;
  velocityTrend: 'accelerating' | 'steady' | 'decelerating' | 'stalled';
  velocityVariance: number;
  projectedCompletionDate: Date;
  daysAhead: number; // Negative if behind schedule
  burndownRate: number; // Hours completed per day
  burndownEfficiency: number; // Actual vs planned burndown
}

/**
 * External factor that may affect deadline
 */
export interface ExternalFactor {
  id: string;
  type: 'holiday' | 'dependency' | 'resource_absence' | 'scope_change' | 'risk_event' | 'other';
  name: string;
  description: string;
  startDate: Date;
  endDate?: Date;
  impactLevel: 'none' | 'low' | 'medium' | 'high' | 'critical';
  impactDays: number; // Estimated days of delay
  probability: number; // 0-1 for uncertain factors
  affectedTasks: string[];
  mitigationPossible: boolean;
}

/**
 * Deadline risk assessment
 */
export interface DeadlineRisk {
  taskId: string;
  taskTitle: string;
  originalDeadline: Date;
  currentDeadline: Date;
  probabilityOfMiss: number; // 0-1
  riskLevel: 'none' | 'low' | 'medium' | 'high' | 'critical';
  confidenceInterval: {
    optimistic: Date; // P10
    mostLikely: Date; // P50
    pessimistic: Date; // P90
  };
  contributingFactors: Array<{
    factor: string;
    contribution: number; // 0-1
    description: string;
  }>;
  velocityMetrics: VelocityMetrics;
  externalFactors: ExternalFactor[];
  lastUpdated: Date;
}

/**
 * Risk alert
 */
export interface RiskAlert {
  id: string;
  taskId: string;
  alertType: 'warning' | 'critical' | 'imminent';
  title: string;
  message: string;
  triggeredAt: Date;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  suggestedActions: string[];
  expiresAt?: Date;
}

/**
 * Mitigation suggestion
 */
export interface MitigationSuggestion {
  id: string;
  taskId: string;
  type: 'scope_reduction' | 'resource_addition' | 'deadline_extension' | 'parallel_work' |
        'dependency_resolution' | 'risk_mitigation' | 'process_improvement';
  title: string;
  description: string;
  expectedImpact: {
    daysRecovered: number;
    riskReduction: number; // 0-1
    costImpact: 'none' | 'low' | 'medium' | 'high';
    qualityImpact: 'none' | 'low' | 'medium' | 'high';
  };
  effort: 'low' | 'medium' | 'high';
  urgency: 'low' | 'medium' | 'high' | 'immediate';
  prerequisites: string[];
  tradeoffs: string[];
  implementationSteps: string[];
}

/**
 * Risk prediction result
 */
export interface RiskPredictionResult {
  taskId: string;
  risk: DeadlineRisk;
  alerts: RiskAlert[];
  mitigations: MitigationSuggestion[];
  simulation: SimulationOutput;
  recommendation: {
    action: 'continue' | 'monitor' | 'intervene' | 'escalate';
    reason: string;
    priority: number;
  };
}

/**
 * Project-level risk summary
 */
export interface ProjectRiskSummary {
  projectId: string;
  analyzedAt: Date;
  overallRiskLevel: 'none' | 'low' | 'medium' | 'high' | 'critical';
  overallProbabilityOfDelay: number;
  taskRisks: DeadlineRisk[];
  criticalPathTasks: string[];
  topRisks: Array<{
    taskId: string;
    taskTitle: string;
    probability: number;
    impact: number;
    riskScore: number;
  }>;
  externalFactorsSummary: {
    totalFactors: number;
    highImpactFactors: number;
    upcomingHolidays: ExternalFactor[];
    blockedDependencies: ExternalFactor[];
  };
  alertsSummary: {
    critical: number;
    warning: number;
    total: number;
  };
  recommendedActions: MitigationSuggestion[];
}

/**
 * Task with deadline info
 */
export interface TaskWithDeadline {
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

// Cache TTLs
const CACHE_TTL = {
  risk: 15 * 60 * 1000, // 15 minutes
  velocity: 30 * 60 * 1000, // 30 minutes
  simulation: 60 * 60 * 1000, // 1 hour
};

// Alert thresholds
const ALERT_THRESHOLDS = {
  warning: 0.3, // 30% probability of miss
  critical: 0.6, // 60% probability of miss
  imminent: 0.85, // 85% probability of miss
};

// ============================================================================
// Deadline Risk Predictor Service
// ============================================================================

export class DeadlineRiskPredictorService {
  private tasks: Map<string, TaskWithDeadline> = new Map();
  private externalFactors: Map<string, ExternalFactor[]> = new Map();
  private alerts: Map<string, RiskAlert[]> = new Map();

  // ============================================================================
  // Velocity Tracking
  // ============================================================================

  /**
   * Calculate velocity metrics from progress history
   * O(h) where h=history length
   */
  calculateVelocity(task: TaskWithDeadline): VelocityMetrics {
    const cacheKeyStr = cacheKey('velocity', task.id, task.progressHistory.length.toString());
    const cached = oracleCacheService.get<VelocityMetrics>(cacheKeyStr);
    if (cached) return cached;

    const history = task.progressHistory;

    if (history.length < 2) {
      // Not enough data - use estimates
      const daysRemaining = Math.max(1,
        (task.deadline.getTime() - Date.now()) / (24 * 60 * 60 * 1000)
      );
      const requiredVelocity = (100 - task.completedPercentage) / daysRemaining;

      return {
        currentVelocity: requiredVelocity,
        averageVelocity: requiredVelocity,
        velocityTrend: 'steady',
        velocityVariance: 0.3, // Assume high variance with no data
        projectedCompletionDate: task.deadline,
        daysAhead: 0,
        burndownRate: task.estimatedHours / daysRemaining,
        burndownEfficiency: 1,
      };
    }

    // Sort history by timestamp
    const sorted = [...history].sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    );

    // Calculate daily velocities
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

    // Calculate current velocity (weighted average of recent data)
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

    // Average velocity
    const averageVelocity = dailyVelocities.length > 0
      ? dailyVelocities.reduce((a, b) => a + b, 0) / dailyVelocities.length
      : 0;

    // Velocity variance
    const velocityVariance = dailyVelocities.length > 1
      ? dailyVelocities.reduce(
          (sum, v) => sum + Math.pow(v - averageVelocity, 2),
          0
        ) / dailyVelocities.length
      : 0.2;

    // Velocity trend
    let velocityTrend: VelocityMetrics['velocityTrend'] = 'steady';
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

    // Project completion date
    const remaining = 100 - task.completedPercentage;
    const daysToComplete = currentVelocity > 0 ? remaining / currentVelocity : Infinity;
    const projectedCompletionDate = new Date(
      Date.now() + daysToComplete * 24 * 60 * 60 * 1000
    );

    // Days ahead/behind
    const daysAhead = (task.deadline.getTime() - projectedCompletionDate.getTime()) /
      (24 * 60 * 60 * 1000);

    // Burndown metrics
    const burndownRate = dailyBurndown.length > 0
      ? dailyBurndown.reduce((a, b) => a + b, 0) / dailyBurndown.length
      : 0;

    const plannedBurndown = task.estimatedHours /
      Math.max(1, (task.deadline.getTime() - task.startDate.getTime()) / (24 * 60 * 60 * 1000));
    const burndownEfficiency = plannedBurndown > 0 ? burndownRate / plannedBurndown : 1;

    const metrics: VelocityMetrics = {
      currentVelocity,
      averageVelocity,
      velocityTrend,
      velocityVariance,
      projectedCompletionDate,
      daysAhead,
      burndownRate,
      burndownEfficiency,
    };

    oracleCacheService.set(cacheKeyStr, metrics, CACHE_TTL.velocity);
    return metrics;
  }

  // ============================================================================
  // Risk Probability Calculation
  // ============================================================================

  /**
   * Calculate deadline risk using Monte Carlo simulation
   * O(i * f) where i=iterations, f=factors
   */
  async predictDeadlineRisk(
    task: TaskWithDeadline,
    externalFactors: ExternalFactor[] = []
  ): Promise<RiskPredictionResult> {
    const cacheKeyStr = cacheKey('risk', task.id, hashObject({
      progress: task.completedPercentage,
      factors: externalFactors.length,
    }));

    const cached = oracleCacheService.get<RiskPredictionResult>(cacheKeyStr);
    if (cached) return cached;

    // Store task
    this.tasks.set(task.id, task);
    this.externalFactors.set(task.id, externalFactors);

    // Calculate velocity
    const velocity = this.calculateVelocity(task);

    // Build simulation factors
    const simulationFactors = this.buildSimulationFactors(task, velocity, externalFactors);

    // Run Monte Carlo simulation
    const simulation = await monteCarloService.runSimulation(
      simulationFactors,
      (samples) => this.calculateCompletionDays(samples, task),
      { iterations: 1000 }
    );

    // Calculate probability of missing deadline
    const deadlineDays = Math.max(0,
      (task.deadline.getTime() - Date.now()) / (24 * 60 * 60 * 1000)
    );

    const probabilityOfMiss = this.calculateMissProbability(simulation, deadlineDays);

    // Determine risk level
    const riskLevel = this.determineRiskLevel(probabilityOfMiss, velocity, externalFactors);

    // Build confidence intervals
    const confidenceInterval = this.buildConfidenceInterval(simulation);

    // Identify contributing factors
    const contributingFactors = this.identifyContributingFactors(
      task,
      velocity,
      externalFactors,
      simulation
    );

    // Build risk assessment
    const risk: DeadlineRisk = {
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
    const recommendation = this.buildRecommendation(risk, alerts);

    const result: RiskPredictionResult = {
      taskId: task.id,
      risk,
      alerts,
      mitigations,
      simulation,
      recommendation,
    };

    oracleCacheService.set(cacheKeyStr, result, CACHE_TTL.risk);
    return result;
  }

  /**
   * Build simulation factors for Monte Carlo
   */
  private buildSimulationFactors(
    task: TaskWithDeadline,
    velocity: VelocityMetrics,
    externalFactors: ExternalFactor[]
  ): SimulationFactor[] {
    const factors: SimulationFactor[] = [];

    // Base velocity factor - use log-normal for realistic variation
    const velocityMean = Math.max(0.1, velocity.currentVelocity);
    const velocityStd = Math.max(0.1, Math.sqrt(velocity.velocityVariance));

    factors.push({
      name: 'velocity',
      distribution: {
        type: 'lognormal',
        params: [Math.log(velocityMean), velocityStd / velocityMean],
      },
    });

    // Remaining work factor - triangular distribution
    const remainingPercent = 100 - task.completedPercentage;
    const remainingUncertainty = remainingPercent * 0.2; // 20% uncertainty

    factors.push({
      name: 'remainingWork',
      distribution: {
        type: 'triangular',
        params: [
          Math.max(0, remainingPercent - remainingUncertainty),
          remainingPercent,
          remainingPercent + remainingUncertainty,
        ],
      },
    });

    // External factors - each adds potential delay
    for (const factor of externalFactors) {
      if (factor.probability > 0) {
        // Beta distribution for probability-weighted impact
        const alpha = factor.probability * 2 + 0.5;
        const beta = (1 - factor.probability) * 2 + 0.5;

        factors.push({
          name: `external_${factor.id}`,
          distribution: {
            type: 'beta',
            params: [alpha, beta],
          },
        });
      }
    }

    // Scope creep factor - exponential distribution
    factors.push({
      name: 'scopeCreep',
      distribution: {
        type: 'exponential',
        params: [5], // 20% chance of scope creep adding 20%+ time
      },
    });

    return factors;
  }

  /**
   * Calculate completion days from simulation samples
   */
  private calculateCompletionDays(
    samples: Record<string, number>,
    task: TaskWithDeadline
  ): number {
    const velocity = Math.max(0.1, samples.velocity);
    const remaining = samples.remainingWork;

    // Base days to complete
    let days = remaining / velocity;

    // Add external factor delays
    const externalFactors = this.externalFactors.get(task.id) || [];
    for (const factor of externalFactors) {
      const sampleKey = `external_${factor.id}`;
      if (samples[sampleKey] !== undefined) {
        // Impact scales with the sampled probability
        days += factor.impactDays * samples[sampleKey];
      }
    }

    // Add scope creep (capped at 50%)
    const scopeCreep = Math.min(0.5, samples.scopeCreep / 10);
    days *= (1 + scopeCreep);

    return days;
  }

  /**
   * Calculate probability of missing deadline from simulation
   */
  private calculateMissProbability(
    simulation: SimulationOutput,
    deadlineDays: number
  ): number {
    // Count samples that exceed deadline
    // Using percentiles as approximation
    if (deadlineDays >= simulation.percentiles.p95) {
      return 0.05;
    } else if (deadlineDays >= simulation.percentiles.p90) {
      return 0.10;
    } else if (deadlineDays >= simulation.percentiles.p75) {
      return 0.25;
    } else if (deadlineDays >= simulation.percentiles.p50) {
      return 0.50;
    } else if (deadlineDays >= simulation.percentiles.p25) {
      return 0.75;
    } else if (deadlineDays >= simulation.percentiles.p10) {
      return 0.90;
    } else {
      return 0.95;
    }
  }

  /**
   * Determine risk level from probability and other factors
   */
  private determineRiskLevel(
    probability: number,
    velocity: VelocityMetrics,
    externalFactors: ExternalFactor[]
  ): DeadlineRisk['riskLevel'] {
    // Base level from probability
    let level: DeadlineRisk['riskLevel'] = 'none';

    if (probability >= 0.8) {
      level = 'critical';
    } else if (probability >= 0.5) {
      level = 'high';
    } else if (probability >= 0.3) {
      level = 'medium';
    } else if (probability >= 0.1) {
      level = 'low';
    }

    // Escalate if velocity is stalled
    if (velocity.velocityTrend === 'stalled' && level !== 'critical') {
      const levels: DeadlineRisk['riskLevel'][] = ['none', 'low', 'medium', 'high', 'critical'];
      const currentIndex = levels.indexOf(level);
      level = levels[Math.min(currentIndex + 1, levels.length - 1)];
    }

    // Escalate if critical external factors
    const criticalFactors = externalFactors.filter(
      f => f.impactLevel === 'critical' || f.impactLevel === 'high'
    );
    if (criticalFactors.length > 0 && level !== 'critical') {
      const levels: DeadlineRisk['riskLevel'][] = ['none', 'low', 'medium', 'high', 'critical'];
      const currentIndex = levels.indexOf(level);
      level = levels[Math.min(currentIndex + 1, levels.length - 1)];
    }

    return level;
  }

  /**
   * Build confidence interval dates from simulation
   */
  private buildConfidenceInterval(
    simulation: SimulationOutput
  ): DeadlineRisk['confidenceInterval'] {
    const now = Date.now();

    return {
      optimistic: new Date(now + simulation.percentiles.p10 * 24 * 60 * 60 * 1000),
      mostLikely: new Date(now + simulation.percentiles.p50 * 24 * 60 * 60 * 1000),
      pessimistic: new Date(now + simulation.percentiles.p90 * 24 * 60 * 60 * 1000),
    };
  }

  /**
   * Identify factors contributing to risk
   */
  private identifyContributingFactors(
    task: TaskWithDeadline,
    velocity: VelocityMetrics,
    externalFactors: ExternalFactor[],
    simulation: SimulationOutput
  ): DeadlineRisk['contributingFactors'] {
    const factors: DeadlineRisk['contributingFactors'] = [];

    // Velocity contribution
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

    // Burndown efficiency
    if (velocity.burndownEfficiency < 0.7) {
      factors.push({
        factor: 'Below Plan Burndown',
        contribution: 0.2,
        description: `Completing work at ${(velocity.burndownEfficiency * 100).toFixed(0)}% of planned rate`,
      });
    }

    // High variance
    if (velocity.velocityVariance > 0.5) {
      factors.push({
        factor: 'Inconsistent Progress',
        contribution: 0.15,
        description: 'High day-to-day variation in progress rate',
      });
    }

    // External factors
    for (const factor of externalFactors) {
      if (factor.impactLevel === 'critical' || factor.impactLevel === 'high') {
        factors.push({
          factor: factor.name,
          contribution: factor.impactDays / simulation.mean * factor.probability,
          description: factor.description,
        });
      }
    }

    // Dependencies
    const blockedDeps = externalFactors.filter(f => f.type === 'dependency');
    if (blockedDeps.length > 0) {
      factors.push({
        factor: 'Blocked Dependencies',
        contribution: blockedDeps.length * 0.1,
        description: `${blockedDeps.length} dependencies are not yet resolved`,
      });
    }

    // Low completion percentage late in timeline
    const timeElapsed = (Date.now() - task.startDate.getTime()) /
      (task.deadline.getTime() - task.startDate.getTime());
    if (timeElapsed > task.completedPercentage / 100) {
      factors.push({
        factor: 'Behind Schedule',
        contribution: Math.min(0.3, timeElapsed - task.completedPercentage / 100),
        description: `${(timeElapsed * 100).toFixed(0)}% of time elapsed but only ${task.completedPercentage}% complete`,
      });
    }

    // Sort by contribution
    factors.sort((a, b) => b.contribution - a.contribution);
    return factors.slice(0, 5);
  }

  // ============================================================================
  // Alert Generation
  // ============================================================================

  /**
   * Generate risk alerts based on thresholds
   */
  private generateAlerts(risk: DeadlineRisk): RiskAlert[] {
    const alerts: RiskAlert[] = [];
    const existingAlerts = this.alerts.get(risk.taskId) || [];

    // Determine alert type based on probability
    let alertType: RiskAlert['alertType'] | null = null;

    if (risk.probabilityOfMiss >= ALERT_THRESHOLDS.imminent) {
      alertType = 'imminent';
    } else if (risk.probabilityOfMiss >= ALERT_THRESHOLDS.critical) {
      alertType = 'critical';
    } else if (risk.probabilityOfMiss >= ALERT_THRESHOLDS.warning) {
      alertType = 'warning';
    }

    if (alertType) {
      // Check if we already have an unacknowledged alert of this type
      const hasExisting = existingAlerts.some(
        a => a.alertType === alertType && !a.acknowledged
      );

      if (!hasExisting) {
        const alert: RiskAlert = {
          id: `alert-${risk.taskId}-${Date.now()}`,
          taskId: risk.taskId,
          alertType,
          title: this.getAlertTitle(alertType, risk),
          message: this.getAlertMessage(risk),
          triggeredAt: new Date(),
          acknowledged: false,
          suggestedActions: this.getSuggestedAlertActions(risk, alertType),
        };

        alerts.push(alert);
        existingAlerts.push(alert);
        this.alerts.set(risk.taskId, existingAlerts);
      }
    }

    return alerts;
  }

  /**
   * Get alert title based on type
   */
  private getAlertTitle(type: RiskAlert['alertType'], risk: DeadlineRisk): string {
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

  /**
   * Get alert message
   */
  private getAlertMessage(risk: DeadlineRisk): string {
    const parts: string[] = [];

    parts.push(
      `${(risk.probabilityOfMiss * 100).toFixed(0)}% probability of missing ` +
      `deadline on ${risk.currentDeadline.toLocaleDateString()}.`
    );

    if (risk.velocityMetrics.daysAhead < 0) {
      parts.push(
        `Currently ${Math.abs(risk.velocityMetrics.daysAhead).toFixed(1)} days behind schedule.`
      );
    }

    if (risk.contributingFactors.length > 0) {
      parts.push(`Top factor: ${risk.contributingFactors[0].factor}.`);
    }

    return parts.join(' ');
  }

  /**
   * Get suggested actions for alert
   */
  private getSuggestedAlertActions(
    risk: DeadlineRisk,
    type: RiskAlert['alertType']
  ): string[] {
    const actions: string[] = [];

    switch (type) {
      case 'imminent':
        actions.push('Immediately escalate to stakeholders');
        actions.push('Consider scope reduction or deadline extension');
        actions.push('Add resources if possible');
        break;
      case 'critical':
        actions.push('Review scope and prioritize critical features');
        actions.push('Identify and remove blockers');
        actions.push('Schedule stakeholder meeting');
        break;
      case 'warning':
        actions.push('Monitor progress closely');
        actions.push('Identify potential blockers early');
        actions.push('Review resource allocation');
        break;
    }

    // Add factor-specific actions
    for (const factor of risk.contributingFactors.slice(0, 2)) {
      if (factor.factor === 'Blocked Dependencies') {
        actions.push('Resolve dependency blockers');
      } else if (factor.factor === 'Stalled Progress') {
        actions.push('Investigate cause of stalled progress');
      }
    }

    return actions;
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(taskId: string, alertId: string, userId: string): RiskAlert | null {
    const taskAlerts = this.alerts.get(taskId);
    if (!taskAlerts) return null;

    const alert = taskAlerts.find(a => a.id === alertId);
    if (!alert) return null;

    alert.acknowledged = true;
    alert.acknowledgedBy = userId;
    alert.acknowledgedAt = new Date();

    return alert;
  }

  // ============================================================================
  // Mitigation Suggestions
  // ============================================================================

  /**
   * Generate mitigation suggestions based on risk
   */
  private generateMitigations(
    risk: DeadlineRisk,
    task: TaskWithDeadline,
    velocity: VelocityMetrics
  ): MitigationSuggestion[] {
    const mitigations: MitigationSuggestion[] = [];

    // Suggest based on contributing factors
    for (const factor of risk.contributingFactors) {
      if (factor.factor === 'Stalled Progress') {
        mitigations.push(this.createMitigation(task, 'process_improvement', {
          title: 'Unblock Stalled Work',
          description: 'Investigate and remove blockers causing stalled progress',
          daysRecovered: velocity.daysAhead < 0 ? Math.abs(velocity.daysAhead) * 0.5 : 2,
          effort: 'medium',
          urgency: 'immediate',
          steps: [
            'Conduct blockers analysis meeting',
            'Identify root cause of stall',
            'Create action plan for each blocker',
            'Assign owners to resolution tasks',
            'Set up daily check-ins until resolved',
          ],
        }));
      }

      if (factor.factor === 'Behind Schedule') {
        mitigations.push(this.createMitigation(task, 'resource_addition', {
          title: 'Add Resources',
          description: 'Assign additional team members to accelerate progress',
          daysRecovered: Math.abs(velocity.daysAhead) * 0.3,
          effort: 'high',
          urgency: 'high',
          steps: [
            'Identify tasks suitable for parallel work',
            'Find team members with matching skills',
            'Conduct knowledge transfer session',
            'Divide work and set up coordination',
            'Monitor for increased velocity',
          ],
        }));
      }

      if (factor.factor === 'Blocked Dependencies') {
        mitigations.push(this.createMitigation(task, 'dependency_resolution', {
          title: 'Resolve Dependencies',
          description: 'Fast-track resolution of blocking dependencies',
          daysRecovered: risk.externalFactors
            .filter(f => f.type === 'dependency')
            .reduce((sum, f) => sum + f.impactDays, 0) * 0.5,
          effort: 'medium',
          urgency: 'high',
          steps: [
            'List all blocking dependencies',
            'Contact dependency owners',
            'Negotiate expedited delivery',
            'Create interim workarounds if possible',
            'Track dependency status daily',
          ],
        }));
      }
    }

    // Always suggest scope reduction for high risk
    if (risk.riskLevel === 'high' || risk.riskLevel === 'critical') {
      mitigations.push(this.createMitigation(task, 'scope_reduction', {
        title: 'Reduce Scope',
        description: 'Identify and defer non-critical features to meet deadline',
        daysRecovered: Math.abs(velocity.daysAhead) * 0.4,
        effort: 'low',
        urgency: 'high',
        steps: [
          'Review requirements with stakeholders',
          'Identify must-have vs nice-to-have features',
          'Create proposal for scope reduction',
          'Get stakeholder approval',
          'Update task scope and estimates',
        ],
      }));

      mitigations.push(this.createMitigation(task, 'deadline_extension', {
        title: 'Request Deadline Extension',
        description: 'Negotiate additional time to complete work with full scope',
        daysRecovered: Math.abs(velocity.daysAhead),
        effort: 'low',
        urgency: 'medium',
        steps: [
          'Prepare risk analysis summary',
          'Calculate minimum needed extension',
          'Schedule stakeholder meeting',
          'Present options and tradeoffs',
          'Update timeline if approved',
        ],
      }));
    }

    // Suggest parallel work for large remaining work
    const remainingPercent = 100 - task.completedPercentage;
    if (remainingPercent > 50 && velocity.velocityTrend !== 'accelerating') {
      mitigations.push(this.createMitigation(task, 'parallel_work', {
        title: 'Enable Parallel Work',
        description: 'Restructure work to allow concurrent execution',
        daysRecovered: Math.abs(velocity.daysAhead) * 0.25,
        effort: 'medium',
        urgency: 'medium',
        steps: [
          'Analyze work breakdown for parallelization',
          'Identify independent work streams',
          'Assign work streams to different resources',
          'Set up coordination checkpoints',
          'Integrate work at defined merge points',
        ],
      }));
    }

    // Sort by urgency and impact
    const urgencyOrder = { immediate: 0, high: 1, medium: 2, low: 3 };
    mitigations.sort((a, b) => {
      const urgencyDiff = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
      if (urgencyDiff !== 0) return urgencyDiff;
      return b.expectedImpact.daysRecovered - a.expectedImpact.daysRecovered;
    });

    return mitigations.slice(0, 5);
  }

  /**
   * Create a mitigation suggestion
   */
  private createMitigation(
    task: TaskWithDeadline,
    type: MitigationSuggestion['type'],
    options: {
      title: string;
      description: string;
      daysRecovered: number;
      effort: MitigationSuggestion['effort'];
      urgency: MitigationSuggestion['urgency'];
      steps: string[];
    }
  ): MitigationSuggestion {
    const daysRecovered = Math.max(0, Math.round(options.daysRecovered * 10) / 10);

    return {
      id: `mit-${task.id}-${type}-${Date.now()}`,
      taskId: task.id,
      type,
      title: options.title,
      description: options.description,
      expectedImpact: {
        daysRecovered,
        riskReduction: Math.min(0.5, daysRecovered / 10),
        costImpact: type === 'resource_addition' ? 'high' : 'low',
        qualityImpact: type === 'scope_reduction' ? 'medium' : 'none',
      },
      effort: options.effort,
      urgency: options.urgency,
      prerequisites: this.getMitigationPrerequisites(type),
      tradeoffs: this.getMitigationTradeoffs(type),
      implementationSteps: options.steps,
    };
  }

  /**
   * Get prerequisites for mitigation type
   */
  private getMitigationPrerequisites(type: MitigationSuggestion['type']): string[] {
    const prereqs: Record<MitigationSuggestion['type'], string[]> = {
      scope_reduction: ['Stakeholder approval', 'Clear prioritization criteria'],
      resource_addition: ['Available resources with matching skills', 'Budget approval'],
      deadline_extension: ['Stakeholder flexibility', 'Impact assessment on dependent projects'],
      parallel_work: ['Work breakdown analysis', 'Available resources'],
      dependency_resolution: ['Access to dependency owners', 'Escalation authority'],
      risk_mitigation: ['Risk assessment', 'Mitigation plan'],
      process_improvement: ['Process analysis', 'Team buy-in'],
    };

    return prereqs[type] || [];
  }

  /**
   * Get tradeoffs for mitigation type
   */
  private getMitigationTradeoffs(type: MitigationSuggestion['type']): string[] {
    const tradeoffs: Record<MitigationSuggestion['type'], string[]> = {
      scope_reduction: ['Reduced functionality', 'May require follow-up release'],
      resource_addition: ['Increased cost', 'Context-switching overhead', 'Coordination overhead'],
      deadline_extension: ['Delayed delivery', 'Impact on dependent projects'],
      parallel_work: ['Increased coordination complexity', 'Potential integration issues'],
      dependency_resolution: ['May require negotiations', 'Could impact dependency owners'],
      risk_mitigation: ['Resource allocation', 'May slow current progress'],
      process_improvement: ['Short-term disruption', 'Learning curve'],
    };

    return tradeoffs[type] || [];
  }

  // ============================================================================
  // Recommendation
  // ============================================================================

  /**
   * Build action recommendation
   */
  private buildRecommendation(
    risk: DeadlineRisk,
    alerts: RiskAlert[]
  ): RiskPredictionResult['recommendation'] {
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

    // Escalate if velocity is stalled
    if (risk.velocityMetrics.velocityTrend === 'stalled' && action !== 'escalate') {
      action = 'intervene';
      reason = 'Progress has stalled - immediate attention needed';
      priority = Math.min(priority, 2);
    }

    return { action, reason, priority };
  }

  // ============================================================================
  // Project-Level Analysis
  // ============================================================================

  /**
   * Analyze all tasks in a project
   */
  async analyzeProjectRisk(
    projectId: string,
    tasks: TaskWithDeadline[],
    externalFactors: ExternalFactor[] = []
  ): Promise<ProjectRiskSummary> {
    const taskRisks: DeadlineRisk[] = [];
    const allAlerts: RiskAlert[] = [];
    const allMitigations: MitigationSuggestion[] = [];

    // Analyze each task
    for (const task of tasks) {
      const taskFactors = externalFactors.filter(
        f => f.affectedTasks.includes(task.id) || f.affectedTasks.length === 0
      );

      const result = await this.predictDeadlineRisk(task, taskFactors);
      taskRisks.push(result.risk);
      allAlerts.push(...result.alerts);
      allMitigations.push(...result.mitigations);
    }

    // Identify critical path (simplified - tasks with dependents)
    const criticalPathTasks = tasks
      .filter(t => t.dependents.length > 0)
      .sort((a, b) => b.dependents.length - a.dependents.length)
      .map(t => t.id);

    // Top risks
    const topRisks = taskRisks
      .map(r => ({
        taskId: r.taskId,
        taskTitle: r.taskTitle,
        probability: r.probabilityOfMiss,
        impact: this.calculateImpact(r, tasks),
        riskScore: r.probabilityOfMiss * this.calculateImpact(r, tasks),
      }))
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, 5);

    // Overall risk level
    const maxRisk = Math.max(...taskRisks.map(r => r.probabilityOfMiss));
    const avgRisk = taskRisks.reduce((sum, r) => sum + r.probabilityOfMiss, 0) / taskRisks.length;
    const overallProbability = (maxRisk + avgRisk) / 2;

    let overallRiskLevel: ProjectRiskSummary['overallRiskLevel'] = 'none';
    if (overallProbability >= 0.7) {
      overallRiskLevel = 'critical';
    } else if (overallProbability >= 0.5) {
      overallRiskLevel = 'high';
    } else if (overallProbability >= 0.3) {
      overallRiskLevel = 'medium';
    } else if (overallProbability >= 0.1) {
      overallRiskLevel = 'low';
    }

    // External factors summary
    const upcomingHolidays = externalFactors.filter(
      f => f.type === 'holiday' && f.startDate > new Date()
    );
    const blockedDependencies = externalFactors.filter(
      f => f.type === 'dependency' && f.impactLevel !== 'none'
    );

    // Top recommended actions
    const recommendedActions = allMitigations
      .filter(m => m.urgency === 'immediate' || m.urgency === 'high')
      .slice(0, 5);

    return {
      projectId,
      analyzedAt: new Date(),
      overallRiskLevel,
      overallProbabilityOfDelay: overallProbability,
      taskRisks,
      criticalPathTasks,
      topRisks,
      externalFactorsSummary: {
        totalFactors: externalFactors.length,
        highImpactFactors: externalFactors.filter(
          f => f.impactLevel === 'high' || f.impactLevel === 'critical'
        ).length,
        upcomingHolidays,
        blockedDependencies,
      },
      alertsSummary: {
        critical: allAlerts.filter(a => a.alertType === 'critical' || a.alertType === 'imminent').length,
        warning: allAlerts.filter(a => a.alertType === 'warning').length,
        total: allAlerts.length,
      },
      recommendedActions,
    };
  }

  /**
   * Calculate impact of a risk (based on dependents)
   */
  private calculateImpact(risk: DeadlineRisk, tasks: TaskWithDeadline[]): number {
    const task = tasks.find(t => t.id === risk.taskId);
    if (!task) return 0.5;

    // Impact based on number of dependents
    const directDependents = task.dependents.length;

    // Calculate indirect dependents
    let indirectCount = 0;
    const visited = new Set<string>();
    const queue = [...task.dependents];

    while (queue.length > 0) {
      const depId = queue.shift()!;
      if (visited.has(depId)) continue;
      visited.add(depId);

      const depTask = tasks.find(t => t.id === depId);
      if (depTask) {
        indirectCount++;
        queue.push(...depTask.dependents);
      }
    }

    // Impact score 0-1
    const totalDependents = directDependents + indirectCount * 0.5;
    const priorityMultiplier = task.priority === 'critical' ? 1.5 :
      task.priority === 'high' ? 1.2 : 1;

    return Math.min(1, (totalDependents / tasks.length) * priorityMultiplier + 0.3);
  }
}

// Singleton instance
export const deadlineRiskPredictorService = new DeadlineRiskPredictorService();
