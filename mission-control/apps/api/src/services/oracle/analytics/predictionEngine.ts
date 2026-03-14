/**
 * ORACLE Prediction Engine
 * Predictive analytics for tasks, workload, and performance
 */

// Types
export interface Prediction {
  id: string;
  type: PredictionType;
  subject: string;
  probability: number; // 0-1
  confidence: number; // 0-1
  prediction: string;
  factors: PredictionFactor[];
  recommendations: string[];
  timeline?: PredictionTimeline;
  createdAt: Date;
  expiresAt?: Date;
  userId: string;
}

export type PredictionType =
  | 'task_completion'
  | 'workload_forecast'
  | 'deadline_risk'
  | 'resource_bottleneck'
  | 'burnout_risk'
  | 'goal_success';

export interface PredictionFactor {
  name: string;
  impact: 'positive' | 'negative' | 'neutral';
  weight: number; // 0-1
  value: number | string;
  description: string;
}

export interface PredictionTimeline {
  startDate: Date;
  endDate: Date;
  milestones: TimelineMilestone[];
  criticalPath?: CriticalPathItem[];
}

export interface TimelineMilestone {
  date: Date;
  label: string;
  probability: number;
  status: 'on_track' | 'at_risk' | 'delayed' | 'completed';
}

export interface CriticalPathItem {
  taskId: string;
  taskName: string;
  startDate: Date;
  endDate: Date;
  slack: number; // Days of buffer
  isCritical: boolean;
}

export interface WorkloadForecast {
  date: Date;
  predictedLoad: number; // 0-100
  capacity: number;
  breakdown: WorkloadBreakdown;
  confidence: number;
}

export interface WorkloadBreakdown {
  meetings: number;
  tasks: number;
  deepWork: number;
  buffer: number;
}

export interface BurnoutRiskScore {
  score: number; // 0-100
  level: 'low' | 'moderate' | 'high' | 'critical';
  factors: BurnoutFactor[];
  trend: 'improving' | 'stable' | 'worsening';
  recommendations: string[];
  predictedRecoveryDays?: number;
}

export interface BurnoutFactor {
  category: string;
  contribution: number;
  description: string;
  actionable: boolean;
}

export interface GoalSuccessPrediction {
  goalId: string;
  goalName: string;
  probability: number;
  confidenceInterval: { lower: number; upper: number };
  projectedCompletionDate: Date;
  requiredDailyProgress: number;
  currentVelocity: number;
  riskFactors: string[];
  accelerators: string[];
}

// Input data types
export interface TaskHistoryData {
  taskId: string;
  category?: string;
  priority: string;
  estimatedMinutes: number;
  actualMinutes?: number;
  createdAt: Date;
  completedAt?: Date;
  dueDate?: Date;
  complexity: 'low' | 'medium' | 'high';
  dependencies: string[];
  blockedBy: string[];
}

export interface UserHistoricalMetrics {
  averageTaskCompletionTime: number;
  onTimeCompletionRate: number;
  estimationAccuracy: number;
  productivityByHour: Map<number, number>;
  productivityByDayOfWeek: Map<number, number>;
  averageDeepWorkHours: number;
  averageMeetingHours: number;
  historicalBurnoutIndicators: number[];
}

export interface ScheduledEvent {
  id: string;
  type: 'meeting' | 'task' | 'block' | 'event';
  startTime: Date;
  endTime: Date;
  priority?: number;
}

export interface GoalData {
  id: string;
  name: string;
  targetValue: number;
  currentValue: number;
  startDate: Date;
  deadline: Date;
  milestones: GoalMilestone[];
  historicalProgress: ProgressPoint[];
}

export interface GoalMilestone {
  value: number;
  targetDate: Date;
  completed: boolean;
}

export interface ProgressPoint {
  date: Date;
  value: number;
}

// Prediction Engine
export class PredictionEngine {
  private readonly CONFIDENCE_THRESHOLD = 0.6;

  /**
   * Predict task completion probability and timeline
   */
  async predictTaskCompletion(
    task: TaskHistoryData,
    userMetrics: UserHistoricalMetrics,
    similarTasks: TaskHistoryData[]
  ): Promise<Prediction> {
    const factors: PredictionFactor[] = [];

    // Factor 1: Historical completion rate
    const completionRateFactor = this.calculateCompletionRateFactor(userMetrics);
    factors.push(completionRateFactor);

    // Factor 2: Estimation accuracy
    const estimationFactor = this.calculateEstimationFactor(task, userMetrics);
    factors.push(estimationFactor);

    // Factor 3: Similar task performance
    const similarTaskFactor = this.calculateSimilarTaskFactor(task, similarTasks);
    factors.push(similarTaskFactor);

    // Factor 4: Complexity
    const complexityFactor = this.calculateComplexityFactor(task);
    factors.push(complexityFactor);

    // Factor 5: Dependencies
    const dependencyFactor = this.calculateDependencyFactor(task);
    factors.push(dependencyFactor);

    // Calculate probability
    const probability = this.calculateWeightedProbability(factors);
    const confidence = this.calculateConfidence(factors, similarTasks.length);

    // Predict completion time
    const predictedMinutes = this.predictCompletionTime(task, userMetrics, similarTasks);
    const predictedDate = this.calculatePredictedCompletionDate(task, predictedMinutes, userMetrics);

    // Generate recommendations
    const recommendations = this.generateTaskRecommendations(factors, probability);

    return {
      id: `pred-task-${task.taskId}-${Date.now()}`,
      type: 'task_completion',
      subject: task.taskId,
      probability,
      confidence,
      prediction: probability >= 0.7
        ? `Task likely to be completed on time with ${Math.round(probability * 100)}% probability`
        : `Task at risk - ${Math.round((1 - probability) * 100)}% chance of delay`,
      factors,
      recommendations,
      timeline: this.buildTaskTimeline(task, predictedDate, probability),
      createdAt: new Date(),
      expiresAt: task.dueDate,
      userId: '',
    };
  }

  /**
   * Forecast workload for upcoming period
   */
  async forecastWorkload(
    userId: string,
    scheduledEvents: ScheduledEvent[],
    pendingTasks: TaskHistoryData[],
    userMetrics: UserHistoricalMetrics,
    daysAhead: number = 14
  ): Promise<WorkloadForecast[]> {
    const forecasts: WorkloadForecast[] = [];
    const now = new Date();

    for (let i = 0; i < daysAhead; i++) {
      const targetDate = new Date(now);
      targetDate.setDate(targetDate.getDate() + i);
      targetDate.setHours(0, 0, 0, 0);

      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);

      // Get events for this day
      const dayEvents = scheduledEvents.filter(e =>
        e.startTime >= targetDate && e.startTime <= endOfDay
      );

      // Calculate meeting time
      const meetingMinutes = dayEvents
        .filter(e => e.type === 'meeting')
        .reduce((sum, e) => sum + (e.endTime.getTime() - e.startTime.getTime()) / 60000, 0);

      // Estimate task time needed
      const tasksDueToday = pendingTasks.filter(t =>
        t.dueDate && t.dueDate >= targetDate && t.dueDate <= endOfDay
      );
      const taskMinutes = tasksDueToday.reduce((sum, t) => {
        const adjustedEstimate = t.estimatedMinutes / userMetrics.estimationAccuracy;
        return sum + adjustedEstimate;
      }, 0);

      // Calculate deep work needs
      const deepWorkNeeded = this.estimateDeepWorkNeeded(tasksDueToday, userMetrics);

      // Total capacity (8 hours = 480 minutes)
      const capacity = 480;
      const totalMinutes = meetingMinutes + taskMinutes + deepWorkNeeded;
      const predictedLoad = Math.min(100, (totalMinutes / capacity) * 100);

      // Calculate buffer
      const buffer = Math.max(0, capacity - totalMinutes);

      forecasts.push({
        date: targetDate,
        predictedLoad,
        capacity,
        breakdown: {
          meetings: meetingMinutes,
          tasks: taskMinutes,
          deepWork: deepWorkNeeded,
          buffer,
        },
        confidence: this.calculateWorkloadConfidence(i, dayEvents.length),
      });
    }

    return forecasts;
  }

  /**
   * Predict deadline risk for tasks
   */
  async predictDeadlineRisk(
    tasks: TaskHistoryData[],
    userMetrics: UserHistoricalMetrics,
    scheduledEvents: ScheduledEvent[]
  ): Promise<Prediction[]> {
    const predictions: Prediction[] = [];

    for (const task of tasks) {
      if (!task.dueDate) continue;

      const factors: PredictionFactor[] = [];
      const now = new Date();
      const daysRemaining = Math.ceil(
        (task.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysRemaining <= 0) continue; // Already overdue

      // Factor 1: Time remaining vs estimated work
      const timeRatioFactor = this.calculateTimeRatioFactor(task, daysRemaining, userMetrics);
      factors.push(timeRatioFactor);

      // Factor 2: Available capacity
      const capacityFactor = this.calculateCapacityFactor(task.dueDate, scheduledEvents, now);
      factors.push(capacityFactor);

      // Factor 3: Historical on-time rate
      const historicalFactor: PredictionFactor = {
        name: 'Historical On-Time Rate',
        impact: userMetrics.onTimeCompletionRate >= 0.8 ? 'positive' : 'negative',
        weight: 0.2,
        value: userMetrics.onTimeCompletionRate,
        description: `${Math.round(userMetrics.onTimeCompletionRate * 100)}% on-time completion historically`,
      };
      factors.push(historicalFactor);

      // Factor 4: Dependencies
      const depBlockers = task.blockedBy.length;
      const dependencyFactor: PredictionFactor = {
        name: 'Dependencies',
        impact: depBlockers > 0 ? 'negative' : 'positive',
        weight: 0.15,
        value: depBlockers,
        description: depBlockers > 0 ? `Blocked by ${depBlockers} tasks` : 'No blockers',
      };
      factors.push(dependencyFactor);

      // Factor 5: Priority
      const priorityFactor = this.calculatePriorityFactor(task);
      factors.push(priorityFactor);

      // Calculate risk probability (inverted - higher = more risky)
      const riskProbability = 1 - this.calculateWeightedProbability(factors);
      const confidence = this.calculateConfidence(factors, 5);

      predictions.push({
        id: `pred-deadline-${task.taskId}-${Date.now()}`,
        type: 'deadline_risk',
        subject: task.taskId,
        probability: riskProbability,
        confidence,
        prediction: riskProbability >= 0.5
          ? `High risk of missing deadline (${Math.round(riskProbability * 100)}%)`
          : `On track for deadline (${Math.round((1 - riskProbability) * 100)}% success probability)`,
        factors,
        recommendations: this.generateDeadlineRecommendations(riskProbability, factors),
        timeline: this.buildDeadlineTimeline(task, riskProbability),
        createdAt: new Date(),
        expiresAt: task.dueDate,
        userId: '',
      });
    }

    return predictions.sort((a, b) => b.probability - a.probability);
  }

  /**
   * Predict resource bottlenecks
   */
  async predictResourceBottlenecks(
    userId: string,
    workloadForecasts: WorkloadForecast[],
    scheduledEvents: ScheduledEvent[]
  ): Promise<Prediction[]> {
    const predictions: Prediction[] = [];

    // Identify overloaded days
    const overloadedDays = workloadForecasts.filter(f => f.predictedLoad > 90);

    for (const day of overloadedDays) {
      const factors: PredictionFactor[] = [];

      // Meeting load factor
      const meetingPercentage = (day.breakdown.meetings / day.capacity) * 100;
      factors.push({
        name: 'Meeting Load',
        impact: meetingPercentage > 40 ? 'negative' : 'neutral',
        weight: 0.3,
        value: meetingPercentage,
        description: `${Math.round(meetingPercentage)}% of day in meetings`,
      });

      // Task load factor
      const taskPercentage = (day.breakdown.tasks / day.capacity) * 100;
      factors.push({
        name: 'Task Load',
        impact: taskPercentage > 50 ? 'negative' : 'neutral',
        weight: 0.3,
        value: taskPercentage,
        description: `${Math.round(taskPercentage)}% of day for tasks`,
      });

      // Buffer factor
      const bufferPercentage = (day.breakdown.buffer / day.capacity) * 100;
      factors.push({
        name: 'Available Buffer',
        impact: bufferPercentage < 10 ? 'negative' : 'positive',
        weight: 0.2,
        value: bufferPercentage,
        description: bufferPercentage < 10 ? 'Minimal buffer time' : 'Adequate buffer time',
      });

      // Overload severity
      const overloadSeverity = (day.predictedLoad - 100) / 50; // How much over 100%
      factors.push({
        name: 'Overload Severity',
        impact: 'negative',
        weight: 0.2,
        value: day.predictedLoad,
        description: `${Math.round(day.predictedLoad)}% capacity utilization`,
      });

      predictions.push({
        id: `pred-bottleneck-${day.date.toISOString()}-${Date.now()}`,
        type: 'resource_bottleneck',
        subject: day.date.toISOString().split('T')[0],
        probability: Math.min(1, overloadSeverity),
        confidence: day.confidence,
        prediction: `Resource bottleneck predicted for ${this.formatDate(day.date)}`,
        factors,
        recommendations: this.generateBottleneckRecommendations(day),
        createdAt: new Date(),
        expiresAt: day.date,
        userId,
      });
    }

    return predictions;
  }

  /**
   * Calculate burnout risk score
   */
  async calculateBurnoutRisk(
    userId: string,
    recentMetrics: {
      avgWorkHours: number;
      avgDeepWorkHours: number;
      avgMeetingHours: number;
      weekendWorkHours: number;
      afterHoursWorkEvents: number;
      streakWithoutBreak: number;
      vacationDaysUsed: number;
      vacationDaysAvailable: number;
    },
    historicalScores: number[]
  ): Promise<BurnoutRiskScore> {
    const factors: BurnoutFactor[] = [];
    let totalScore = 0;

    // Factor 1: Work hours (ideal: 40-45)
    const workHoursContribution = this.calculateWorkHoursContribution(recentMetrics.avgWorkHours);
    factors.push({
      category: 'Work Hours',
      contribution: workHoursContribution,
      description: `Averaging ${recentMetrics.avgWorkHours.toFixed(1)} hours/week`,
      actionable: workHoursContribution > 15,
    });
    totalScore += workHoursContribution;

    // Factor 2: Meeting load (ideal: < 25% of work time)
    const meetingRatio = recentMetrics.avgMeetingHours / recentMetrics.avgWorkHours;
    const meetingContribution = meetingRatio > 0.4 ? 20 : meetingRatio > 0.25 ? 10 : 0;
    factors.push({
      category: 'Meeting Load',
      contribution: meetingContribution,
      description: `${Math.round(meetingRatio * 100)}% of time in meetings`,
      actionable: meetingContribution > 10,
    });
    totalScore += meetingContribution;

    // Factor 3: Weekend work
    const weekendContribution = recentMetrics.weekendWorkHours > 4 ? 15 :
      recentMetrics.weekendWorkHours > 1 ? 8 : 0;
    factors.push({
      category: 'Weekend Work',
      contribution: weekendContribution,
      description: `${recentMetrics.weekendWorkHours.toFixed(1)} hours worked on weekends`,
      actionable: weekendContribution > 8,
    });
    totalScore += weekendContribution;

    // Factor 4: After-hours work
    const afterHoursContribution = Math.min(20, recentMetrics.afterHoursWorkEvents * 2);
    factors.push({
      category: 'After-Hours Work',
      contribution: afterHoursContribution,
      description: `${recentMetrics.afterHoursWorkEvents} after-hours work events`,
      actionable: afterHoursContribution > 10,
    });
    totalScore += afterHoursContribution;

    // Factor 5: Continuous work streak
    const streakContribution = recentMetrics.streakWithoutBreak > 14 ? 15 :
      recentMetrics.streakWithoutBreak > 7 ? 8 : 0;
    factors.push({
      category: 'Work Streak',
      contribution: streakContribution,
      description: `${recentMetrics.streakWithoutBreak} days without break`,
      actionable: streakContribution > 8,
    });
    totalScore += streakContribution;

    // Factor 6: Vacation usage
    const vacationRatio = recentMetrics.vacationDaysUsed / recentMetrics.vacationDaysAvailable;
    const vacationContribution = vacationRatio < 0.3 ? 15 : vacationRatio < 0.5 ? 8 : 0;
    factors.push({
      category: 'Vacation Usage',
      contribution: vacationContribution,
      description: `${recentMetrics.vacationDaysUsed}/${recentMetrics.vacationDaysAvailable} vacation days used`,
      actionable: vacationContribution > 8,
    });
    totalScore += vacationContribution;

    // Calculate trend
    const trend = this.calculateBurnoutTrend(historicalScores, totalScore);

    // Determine level
    const level: BurnoutRiskScore['level'] = totalScore >= 70 ? 'critical' :
      totalScore >= 50 ? 'high' :
      totalScore >= 30 ? 'moderate' : 'low';

    // Generate recommendations
    const recommendations = this.generateBurnoutRecommendations(factors, level);

    // Estimate recovery time
    const predictedRecoveryDays = level === 'critical' ? 14 :
      level === 'high' ? 7 :
      level === 'moderate' ? 3 : undefined;

    return {
      score: Math.min(100, totalScore),
      level,
      factors,
      trend,
      recommendations,
      predictedRecoveryDays,
    };
  }

  /**
   * Predict goal success probability
   */
  async predictGoalSuccess(
    goal: GoalData,
    userMetrics: UserHistoricalMetrics
  ): Promise<GoalSuccessPrediction> {
    const now = new Date();
    const totalDuration = goal.deadline.getTime() - goal.startDate.getTime();
    const elapsedDuration = now.getTime() - goal.startDate.getTime();
    const remainingDuration = goal.deadline.getTime() - now.getTime();

    const daysElapsed = elapsedDuration / (1000 * 60 * 60 * 24);
    const daysRemaining = remainingDuration / (1000 * 60 * 60 * 24);

    // Calculate current velocity
    const progressMade = goal.currentValue - (goal.historicalProgress[0]?.value ?? 0);
    const currentVelocity = daysElapsed > 0 ? progressMade / daysElapsed : 0;

    // Calculate required velocity
    const remainingProgress = goal.targetValue - goal.currentValue;
    const requiredDailyProgress = daysRemaining > 0 ? remainingProgress / daysRemaining : remainingProgress;

    // Calculate probability based on velocity ratio
    const velocityRatio = currentVelocity / requiredDailyProgress;
    let baseProbability = Math.min(1, Math.max(0, velocityRatio));

    // Adjust for historical goal completion rate
    const historicalAdjustment = userMetrics.onTimeCompletionRate * 0.2;
    const adjustedProbability = (baseProbability * 0.8) + historicalAdjustment;

    // Calculate confidence interval
    const variance = this.calculateProgressVariance(goal.historicalProgress);
    const stdDev = Math.sqrt(variance);
    const confidenceInterval = {
      lower: Math.max(0, adjustedProbability - stdDev),
      upper: Math.min(1, adjustedProbability + stdDev),
    };

    // Project completion date
    const projectedCompletionDate = currentVelocity > 0
      ? new Date(now.getTime() + (remainingProgress / currentVelocity) * (1000 * 60 * 60 * 24))
      : goal.deadline;

    // Identify risk factors
    const riskFactors: string[] = [];
    if (velocityRatio < 0.8) {
      riskFactors.push('Current progress rate is below required pace');
    }
    if (variance > 0.1) {
      riskFactors.push('High variability in daily progress');
    }
    if (daysRemaining < 7 && remainingProgress > goal.targetValue * 0.3) {
      riskFactors.push('Significant progress needed in short timeframe');
    }

    // Identify accelerators
    const accelerators: string[] = [];
    if (velocityRatio > 1.2) {
      accelerators.push('Progress rate exceeds requirements');
    }
    if (goal.milestones.filter(m => m.completed).length > goal.milestones.length / 2) {
      accelerators.push('More than half of milestones completed');
    }

    return {
      goalId: goal.id,
      goalName: goal.name,
      probability: adjustedProbability,
      confidenceInterval,
      projectedCompletionDate,
      requiredDailyProgress,
      currentVelocity,
      riskFactors,
      accelerators,
    };
  }

  // Helper methods
  private calculateCompletionRateFactor(metrics: UserHistoricalMetrics): PredictionFactor {
    return {
      name: 'Historical Completion Rate',
      impact: metrics.onTimeCompletionRate >= 0.8 ? 'positive' : 'negative',
      weight: 0.25,
      value: metrics.onTimeCompletionRate,
      description: `${Math.round(metrics.onTimeCompletionRate * 100)}% tasks completed on time`,
    };
  }

  private calculateEstimationFactor(
    task: TaskHistoryData,
    metrics: UserHistoricalMetrics
  ): PredictionFactor {
    const accuracy = metrics.estimationAccuracy;
    return {
      name: 'Estimation Accuracy',
      impact: accuracy >= 0.8 && accuracy <= 1.2 ? 'positive' : 'negative',
      weight: 0.2,
      value: accuracy,
      description: accuracy >= 0.8 && accuracy <= 1.2
        ? 'Estimates are generally accurate'
        : accuracy < 0.8
          ? 'Tasks often take longer than estimated'
          : 'Tasks often completed faster than estimated',
    };
  }

  private calculateSimilarTaskFactor(
    task: TaskHistoryData,
    similarTasks: TaskHistoryData[]
  ): PredictionFactor {
    if (similarTasks.length === 0) {
      return {
        name: 'Similar Task History',
        impact: 'neutral',
        weight: 0.15,
        value: 0,
        description: 'No similar tasks found for comparison',
      };
    }

    const completedSimilar = similarTasks.filter(t => t.completedAt);
    const completionRate = completedSimilar.length / similarTasks.length;

    return {
      name: 'Similar Task History',
      impact: completionRate >= 0.8 ? 'positive' : 'negative',
      weight: 0.15,
      value: completionRate,
      description: `${Math.round(completionRate * 100)}% of similar tasks completed`,
    };
  }

  private calculateComplexityFactor(task: TaskHistoryData): PredictionFactor {
    const complexityScores = { low: 1, medium: 0.7, high: 0.5 };
    const score = complexityScores[task.complexity];

    return {
      name: 'Task Complexity',
      impact: task.complexity === 'low' ? 'positive' : task.complexity === 'high' ? 'negative' : 'neutral',
      weight: 0.15,
      value: task.complexity,
      description: `${task.complexity.charAt(0).toUpperCase() + task.complexity.slice(1)} complexity task`,
    };
  }

  private calculateDependencyFactor(task: TaskHistoryData): PredictionFactor {
    const blockerCount = task.blockedBy.length;
    const dependencyCount = task.dependencies.length;

    return {
      name: 'Dependencies',
      impact: blockerCount > 0 ? 'negative' : 'positive',
      weight: 0.1,
      value: blockerCount,
      description: blockerCount > 0
        ? `Blocked by ${blockerCount} tasks`
        : dependencyCount > 0
          ? `${dependencyCount} dependent tasks`
          : 'No dependencies',
    };
  }

  private calculateWeightedProbability(factors: PredictionFactor[]): number {
    let weightedSum = 0;
    let totalWeight = 0;

    for (const factor of factors) {
      let factorValue: number;

      if (typeof factor.value === 'number') {
        factorValue = factor.value;
      } else {
        // Convert string values to numeric scores
        factorValue = factor.impact === 'positive' ? 0.8 : factor.impact === 'negative' ? 0.3 : 0.5;
      }

      // Normalize to 0-1 if needed
      if (factorValue > 1) {
        factorValue = Math.min(1, factorValue / 100);
      }

      // Apply impact direction
      if (factor.impact === 'negative') {
        factorValue = 1 - factorValue;
      }

      weightedSum += factorValue * factor.weight;
      totalWeight += factor.weight;
    }

    return totalWeight > 0 ? weightedSum / totalWeight : 0.5;
  }

  private calculateConfidence(factors: PredictionFactor[], dataPoints: number): number {
    // Base confidence on number of factors and data points
    const factorConfidence = Math.min(1, factors.length / 5);
    const dataConfidence = Math.min(1, dataPoints / 10);

    return (factorConfidence * 0.4) + (dataConfidence * 0.6);
  }

  private predictCompletionTime(
    task: TaskHistoryData,
    metrics: UserHistoricalMetrics,
    similarTasks: TaskHistoryData[]
  ): number {
    // Start with estimated time adjusted for accuracy
    let predictedMinutes = task.estimatedMinutes / metrics.estimationAccuracy;

    // Adjust based on similar tasks
    if (similarTasks.length > 0) {
      const similarAvg = similarTasks
        .filter(t => t.actualMinutes)
        .reduce((sum, t) => sum + (t.actualMinutes ?? 0), 0) / similarTasks.length;

      if (similarAvg > 0) {
        predictedMinutes = (predictedMinutes * 0.6) + (similarAvg * 0.4);
      }
    }

    // Adjust for complexity
    const complexityMultiplier = { low: 0.8, medium: 1, high: 1.3 };
    predictedMinutes *= complexityMultiplier[task.complexity];

    return Math.round(predictedMinutes);
  }

  private calculatePredictedCompletionDate(
    task: TaskHistoryData,
    predictedMinutes: number,
    metrics: UserHistoricalMetrics
  ): Date {
    const now = new Date();
    const workMinutesPerDay = 6 * 60; // 6 hours of productive work
    const daysNeeded = predictedMinutes / workMinutesPerDay;

    const completionDate = new Date(now);
    completionDate.setDate(completionDate.getDate() + Math.ceil(daysNeeded));

    return completionDate;
  }

  private generateTaskRecommendations(factors: PredictionFactor[], probability: number): string[] {
    const recommendations: string[] = [];

    if (probability < 0.5) {
      recommendations.push('Consider breaking this task into smaller subtasks');
      recommendations.push('Allocate dedicated focus time for this task');
    }

    const dependencyFactor = factors.find(f => f.name === 'Dependencies');
    if (dependencyFactor && (dependencyFactor.value as number) > 0) {
      recommendations.push('Prioritize completing blocking tasks first');
    }

    const complexityFactor = factors.find(f => f.name === 'Task Complexity');
    if (complexityFactor && complexityFactor.value === 'high') {
      recommendations.push('Schedule this task during your peak productivity hours');
    }

    return recommendations;
  }

  private buildTaskTimeline(
    task: TaskHistoryData,
    predictedDate: Date,
    probability: number
  ): PredictionTimeline {
    const milestones: TimelineMilestone[] = [];

    // Start milestone
    milestones.push({
      date: task.createdAt,
      label: 'Task Created',
      probability: 1,
      status: 'completed',
    });

    // Current status
    milestones.push({
      date: new Date(),
      label: 'Current',
      probability,
      status: probability >= 0.7 ? 'on_track' : 'at_risk',
    });

    // Predicted completion
    milestones.push({
      date: predictedDate,
      label: 'Predicted Completion',
      probability,
      status: predictedDate <= (task.dueDate ?? new Date()) ? 'on_track' : 'delayed',
    });

    // Deadline
    if (task.dueDate) {
      milestones.push({
        date: task.dueDate,
        label: 'Deadline',
        probability: probability,
        status: probability >= 0.7 ? 'on_track' : 'at_risk',
      });
    }

    return {
      startDate: task.createdAt,
      endDate: task.dueDate ?? predictedDate,
      milestones,
    };
  }

  private estimateDeepWorkNeeded(tasks: TaskHistoryData[], metrics: UserHistoricalMetrics): number {
    // Estimate deep work based on task complexity
    return tasks.reduce((sum, task) => {
      const complexityMultiplier = { low: 0.3, medium: 0.5, high: 0.8 };
      return sum + (task.estimatedMinutes * complexityMultiplier[task.complexity]);
    }, 0);
  }

  private calculateWorkloadConfidence(daysAhead: number, eventCount: number): number {
    // Confidence decreases with days ahead, increases with more scheduled events
    const dayFactor = Math.max(0.5, 1 - (daysAhead * 0.05));
    const eventFactor = Math.min(1, 0.5 + (eventCount * 0.1));
    return dayFactor * eventFactor;
  }

  private calculateTimeRatioFactor(
    task: TaskHistoryData,
    daysRemaining: number,
    metrics: UserHistoricalMetrics
  ): PredictionFactor {
    const adjustedEstimate = task.estimatedMinutes / metrics.estimationAccuracy;
    const availableMinutes = daysRemaining * 6 * 60; // 6 productive hours per day
    const ratio = adjustedEstimate / availableMinutes;

    return {
      name: 'Time Availability',
      impact: ratio <= 0.3 ? 'positive' : ratio <= 0.6 ? 'neutral' : 'negative',
      weight: 0.3,
      value: ratio,
      description: ratio <= 0.3
        ? 'Ample time available'
        : ratio <= 0.6
          ? 'Adequate time if focused'
          : 'Limited time remaining',
    };
  }

  private calculateCapacityFactor(
    deadline: Date,
    events: ScheduledEvent[],
    now: Date
  ): PredictionFactor {
    const eventsBeforeDeadline = events.filter(e =>
      e.startTime >= now && e.startTime <= deadline
    );

    const scheduledMinutes = eventsBeforeDeadline.reduce((sum, e) =>
      sum + (e.endTime.getTime() - e.startTime.getTime()) / 60000, 0
    );

    const totalMinutesAvailable = (deadline.getTime() - now.getTime()) / 60000;
    const utilization = scheduledMinutes / totalMinutesAvailable;

    return {
      name: 'Schedule Capacity',
      impact: utilization <= 0.5 ? 'positive' : utilization <= 0.7 ? 'neutral' : 'negative',
      weight: 0.2,
      value: 1 - utilization,
      description: `${Math.round((1 - utilization) * 100)}% of time available`,
    };
  }

  private calculatePriorityFactor(task: TaskHistoryData): PredictionFactor {
    const priorityScores: Record<string, number> = {
      critical: 0.9,
      high: 0.7,
      medium: 0.5,
      low: 0.3,
    };

    return {
      name: 'Priority',
      impact: task.priority === 'critical' || task.priority === 'high' ? 'positive' : 'neutral',
      weight: 0.15,
      value: task.priority,
      description: `${task.priority.charAt(0).toUpperCase() + task.priority.slice(1)} priority task`,
    };
  }

  private generateDeadlineRecommendations(risk: number, factors: PredictionFactor[]): string[] {
    const recommendations: string[] = [];

    if (risk >= 0.7) {
      recommendations.push('Request deadline extension or additional resources');
      recommendations.push('Break down task into smaller deliverables');
    } else if (risk >= 0.4) {
      recommendations.push('Block dedicated focus time for this task');
      recommendations.push('Reduce other commitments if possible');
    }

    const capacityFactor = factors.find(f => f.name === 'Schedule Capacity');
    if (capacityFactor && (capacityFactor.value as number) < 0.3) {
      recommendations.push('Consider declining or rescheduling meetings');
    }

    return recommendations;
  }

  private buildDeadlineTimeline(task: TaskHistoryData, risk: number): PredictionTimeline {
    const milestones: TimelineMilestone[] = [];
    const now = new Date();

    milestones.push({
      date: now,
      label: 'Today',
      probability: 1 - risk,
      status: risk < 0.3 ? 'on_track' : risk < 0.6 ? 'at_risk' : 'delayed',
    });

    if (task.dueDate) {
      milestones.push({
        date: task.dueDate,
        label: 'Deadline',
        probability: 1 - risk,
        status: risk < 0.3 ? 'on_track' : risk < 0.6 ? 'at_risk' : 'delayed',
      });
    }

    return {
      startDate: now,
      endDate: task.dueDate ?? now,
      milestones,
    };
  }

  private generateBottleneckRecommendations(forecast: WorkloadForecast): string[] {
    const recommendations: string[] = [];

    if (forecast.breakdown.meetings > 180) {
      recommendations.push('Reschedule or decline non-essential meetings');
    }

    if (forecast.breakdown.buffer < 30) {
      recommendations.push('Build in buffer time for unexpected tasks');
    }

    if (forecast.predictedLoad > 120) {
      recommendations.push('Delegate some tasks to reduce workload');
      recommendations.push('Consider moving flexible deadlines');
    }

    return recommendations;
  }

  private calculateWorkHoursContribution(avgHours: number): number {
    if (avgHours <= 40) return 0;
    if (avgHours <= 45) return 10;
    if (avgHours <= 50) return 20;
    if (avgHours <= 55) return 35;
    return 50;
  }

  private calculateBurnoutTrend(historicalScores: number[], currentScore: number): BurnoutRiskScore['trend'] {
    if (historicalScores.length < 2) return 'stable';

    const recentAvg = historicalScores.slice(-3).reduce((a, b) => a + b, 0) / 3;

    if (currentScore < recentAvg - 5) return 'improving';
    if (currentScore > recentAvg + 5) return 'worsening';
    return 'stable';
  }

  private generateBurnoutRecommendations(factors: BurnoutFactor[], level: string): string[] {
    const recommendations: string[] = [];

    const actionableFactors = factors.filter(f => f.actionable);

    for (const factor of actionableFactors) {
      switch (factor.category) {
        case 'Work Hours':
          recommendations.push('Set a firm end-of-day time and stick to it');
          break;
        case 'Meeting Load':
          recommendations.push('Block no-meeting days on your calendar');
          break;
        case 'Weekend Work':
          recommendations.push('Create a clear boundary between work and personal time');
          break;
        case 'After-Hours Work':
          recommendations.push('Disable work notifications after hours');
          break;
        case 'Work Streak':
          recommendations.push('Schedule regular breaks and short vacations');
          break;
        case 'Vacation Usage':
          recommendations.push('Plan and use your remaining vacation days');
          break;
      }
    }

    if (level === 'critical') {
      recommendations.unshift('Consider taking immediate time off to recover');
    }

    return recommendations.slice(0, 5);
  }

  private calculateProgressVariance(progress: ProgressPoint[]): number {
    if (progress.length < 2) return 0;

    const deltas: number[] = [];
    for (let i = 1; i < progress.length; i++) {
      deltas.push(progress[i].value - progress[i - 1].value);
    }

    const mean = deltas.reduce((a, b) => a + b, 0) / deltas.length;
    const squaredDiffs = deltas.map(d => Math.pow(d - mean, 2));
    return squaredDiffs.reduce((a, b) => a + b, 0) / squaredDiffs.length;
  }

  private formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  }
}

// Export singleton instance
export const predictionEngine = new PredictionEngine();

export default PredictionEngine;
