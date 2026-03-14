/**
 * ORACLE Insights Engine
 * Automated insights generation from user behavior and data patterns
 */

import { EventEmitter } from 'events';

// Types
export interface Insight {
  id: string;
  type: InsightType;
  category: InsightCategory;
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'critical' | 'success';
  confidence: number; // 0-1
  actionable: boolean;
  actions?: InsightAction[];
  data: Record<string, any>;
  relatedMetrics: string[];
  createdAt: Date;
  expiresAt?: Date;
  dismissed: boolean;
  userId: string;
}

export type InsightType =
  | 'pattern'
  | 'anomaly'
  | 'opportunity'
  | 'risk'
  | 'trend'
  | 'comparison'
  | 'recommendation';

export type InsightCategory =
  | 'productivity'
  | 'health'
  | 'goals'
  | 'schedule'
  | 'habits'
  | 'focus'
  | 'workload';

export interface InsightAction {
  id: string;
  label: string;
  type: 'navigate' | 'quick_action' | 'dismiss' | 'remind_later';
  payload?: Record<string, any>;
}

export interface PatternDetectionConfig {
  minOccurrences: number;
  lookbackDays: number;
  confidenceThreshold: number;
}

export interface AnomalyDetectionConfig {
  sensitivityLevel: 'low' | 'medium' | 'high';
  baselineDays: number;
  standardDeviationThreshold: number;
}

export interface TrendAnalysisConfig {
  periods: number;
  periodType: 'day' | 'week' | 'month';
  significanceThreshold: number;
}

export interface UserBehaviorData {
  userId: string;
  timestamp: Date;
  eventType: string;
  metadata: Record<string, any>;
}

export interface MetricSnapshot {
  metricName: string;
  value: number;
  timestamp: Date;
  context?: Record<string, any>;
}

// Pattern Detection
export class PatternDetector {
  private config: PatternDetectionConfig;

  constructor(config: Partial<PatternDetectionConfig> = {}) {
    this.config = {
      minOccurrences: config.minOccurrences ?? 3,
      lookbackDays: config.lookbackDays ?? 30,
      confidenceThreshold: config.confidenceThreshold ?? 0.7,
    };
  }

  /**
   * Detect recurring patterns in user behavior
   */
  async detectPatterns(behaviorData: UserBehaviorData[]): Promise<Insight[]> {
    const insights: Insight[] = [];

    // Time-based patterns
    const timePatterns = this.findTimeBasedPatterns(behaviorData);
    insights.push(...timePatterns);

    // Sequence patterns
    const sequencePatterns = this.findSequencePatterns(behaviorData);
    insights.push(...sequencePatterns);

    // Correlation patterns
    const correlationPatterns = this.findCorrelationPatterns(behaviorData);
    insights.push(...correlationPatterns);

    return insights.filter(i => i.confidence >= this.config.confidenceThreshold);
  }

  private findTimeBasedPatterns(data: UserBehaviorData[]): Insight[] {
    const insights: Insight[] = [];
    const hourlyDistribution: Map<number, number> = new Map();
    const dayOfWeekDistribution: Map<number, number> = new Map();

    data.forEach(event => {
      const hour = event.timestamp.getHours();
      const dayOfWeek = event.timestamp.getDay();

      hourlyDistribution.set(hour, (hourlyDistribution.get(hour) ?? 0) + 1);
      dayOfWeekDistribution.set(dayOfWeek, (dayOfWeekDistribution.get(dayOfWeek) ?? 0) + 1);
    });

    // Find peak productivity hours
    const peakHour = this.findPeakFromDistribution(hourlyDistribution);
    if (peakHour !== null) {
      const hourLabel = this.formatHour(peakHour);
      insights.push({
        id: `pattern-peak-hour-${Date.now()}`,
        type: 'pattern',
        category: 'productivity',
        title: 'Peak Productivity Hour Detected',
        description: `You're most productive around ${hourLabel}. Consider scheduling important tasks during this time.`,
        severity: 'info',
        confidence: 0.85,
        actionable: true,
        actions: [
          {
            id: 'schedule-focus',
            label: 'Schedule Focus Time',
            type: 'quick_action',
            payload: { hour: peakHour },
          },
        ],
        data: { peakHour, distribution: Object.fromEntries(hourlyDistribution) },
        relatedMetrics: ['productivity_score', 'tasks_completed'],
        createdAt: new Date(),
        dismissed: false,
        userId: data[0]?.userId ?? '',
      });
    }

    // Find most productive day
    const peakDay = this.findPeakFromDistribution(dayOfWeekDistribution);
    if (peakDay !== null) {
      const dayLabel = this.getDayName(peakDay);
      insights.push({
        id: `pattern-peak-day-${Date.now()}`,
        type: 'pattern',
        category: 'productivity',
        title: 'Most Productive Day Identified',
        description: `${dayLabel} tends to be your most productive day. Plan challenging work for this day.`,
        severity: 'info',
        confidence: 0.8,
        actionable: true,
        data: { peakDay, distribution: Object.fromEntries(dayOfWeekDistribution) },
        relatedMetrics: ['weekly_productivity', 'task_completion_rate'],
        createdAt: new Date(),
        dismissed: false,
        userId: data[0]?.userId ?? '',
      });
    }

    return insights;
  }

  private findSequencePatterns(data: UserBehaviorData[]): Insight[] {
    const insights: Insight[] = [];
    const sequences: Map<string, number> = new Map();

    // Build sequence pairs
    for (let i = 0; i < data.length - 1; i++) {
      const current = data[i];
      const next = data[i + 1];

      // Check if events are within a reasonable time window (30 minutes)
      const timeDiff = next.timestamp.getTime() - current.timestamp.getTime();
      if (timeDiff > 0 && timeDiff < 30 * 60 * 1000) {
        const sequenceKey = `${current.eventType}->${next.eventType}`;
        sequences.set(sequenceKey, (sequences.get(sequenceKey) ?? 0) + 1);
      }
    }

    // Find significant sequences
    const significantSequences = Array.from(sequences.entries())
      .filter(([_, count]) => count >= this.config.minOccurrences)
      .sort((a, b) => b[1] - a[1]);

    if (significantSequences.length > 0) {
      const [topSequence, count] = significantSequences[0];
      const [first, second] = topSequence.split('->');

      insights.push({
        id: `pattern-sequence-${Date.now()}`,
        type: 'pattern',
        category: 'habits',
        title: 'Workflow Pattern Detected',
        description: `You often follow "${first}" with "${second}" (${count} times). This could be automated or optimized.`,
        severity: 'info',
        confidence: Math.min(0.6 + (count / 20), 0.95),
        actionable: true,
        actions: [
          {
            id: 'create-automation',
            label: 'Create Automation',
            type: 'quick_action',
            payload: { sequence: [first, second] },
          },
        ],
        data: { sequence: topSequence, occurrences: count, allSequences: significantSequences.slice(0, 5) },
        relatedMetrics: ['automation_potential', 'workflow_efficiency'],
        createdAt: new Date(),
        dismissed: false,
        userId: data[0]?.userId ?? '',
      });
    }

    return insights;
  }

  private findCorrelationPatterns(data: UserBehaviorData[]): Insight[] {
    const insights: Insight[] = [];

    // Group events by day
    const dailyGroups: Map<string, UserBehaviorData[]> = new Map();
    data.forEach(event => {
      const dateKey = event.timestamp.toISOString().split('T')[0];
      if (!dailyGroups.has(dateKey)) {
        dailyGroups.set(dateKey, []);
      }
      dailyGroups.get(dateKey)!.push(event);
    });

    // Analyze correlations between event types
    const eventCounts: Map<string, Map<string, number[]>> = new Map();

    dailyGroups.forEach((events, date) => {
      const typeCounts: Map<string, number> = new Map();
      events.forEach(e => {
        typeCounts.set(e.eventType, (typeCounts.get(e.eventType) ?? 0) + 1);
      });

      typeCounts.forEach((count, type) => {
        if (!eventCounts.has(type)) {
          eventCounts.set(type, new Map());
        }
        typeCounts.forEach((otherCount, otherType) => {
          if (type !== otherType) {
            if (!eventCounts.get(type)!.has(otherType)) {
              eventCounts.get(type)!.set(otherType, []);
            }
            eventCounts.get(type)!.get(otherType)!.push(count * otherCount);
          }
        });
      });
    });

    // Find strong correlations
    eventCounts.forEach((correlations, eventType) => {
      correlations.forEach((products, correlatedType) => {
        if (products.length >= 5) {
          const avgProduct = products.reduce((a, b) => a + b, 0) / products.length;
          if (avgProduct > 2) {
            insights.push({
              id: `pattern-correlation-${eventType}-${correlatedType}-${Date.now()}`,
              type: 'pattern',
              category: 'habits',
              title: 'Activity Correlation Found',
              description: `"${eventType}" and "${correlatedType}" activities tend to occur together. Consider bundling these activities.`,
              severity: 'info',
              confidence: 0.75,
              actionable: false,
              data: { eventType, correlatedType, strength: avgProduct },
              relatedMetrics: ['activity_correlation'],
              createdAt: new Date(),
              dismissed: false,
              userId: data[0]?.userId ?? '',
            });
          }
        }
      });
    });

    return insights;
  }

  private findPeakFromDistribution(distribution: Map<number, number>): number | null {
    let maxCount = 0;
    let peakValue: number | null = null;

    distribution.forEach((count, value) => {
      if (count > maxCount) {
        maxCount = count;
        peakValue = value;
      }
    });

    return peakValue;
  }

  private formatHour(hour: number): string {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:00 ${period}`;
  }

  private getDayName(day: number): string {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[day];
  }
}

// Anomaly Detection
export class AnomalyDetector {
  private config: AnomalyDetectionConfig;

  constructor(config: Partial<AnomalyDetectionConfig> = {}) {
    this.config = {
      sensitivityLevel: config.sensitivityLevel ?? 'medium',
      baselineDays: config.baselineDays ?? 14,
      standardDeviationThreshold: config.standardDeviationThreshold ?? 2,
    };
  }

  /**
   * Detect anomalies in metric values
   */
  async detectAnomalies(snapshots: MetricSnapshot[]): Promise<Insight[]> {
    const insights: Insight[] = [];

    // Group by metric name
    const metricGroups: Map<string, MetricSnapshot[]> = new Map();
    snapshots.forEach(s => {
      if (!metricGroups.has(s.metricName)) {
        metricGroups.set(s.metricName, []);
      }
      metricGroups.get(s.metricName)!.push(s);
    });

    // Analyze each metric
    metricGroups.forEach((values, metricName) => {
      const anomalies = this.findStatisticalAnomalies(values);
      if (anomalies.length > 0) {
        const latestAnomaly = anomalies[anomalies.length - 1];
        const direction = latestAnomaly.value > latestAnomaly.baseline ? 'above' : 'below';
        const severity = this.determineSeverity(latestAnomaly.deviation);

        insights.push({
          id: `anomaly-${metricName}-${Date.now()}`,
          type: 'anomaly',
          category: this.categorizeMetric(metricName),
          title: `Unusual ${this.formatMetricName(metricName)} Detected`,
          description: `Your ${this.formatMetricName(metricName)} is ${Math.abs(latestAnomaly.deviation).toFixed(1)} standard deviations ${direction} your baseline.`,
          severity,
          confidence: Math.min(0.7 + (Math.abs(latestAnomaly.deviation) / 10), 0.95),
          actionable: severity !== 'info',
          actions: severity !== 'info' ? [
            {
              id: 'investigate',
              label: 'Investigate',
              type: 'navigate',
              payload: { screen: 'MetricDetail', metric: metricName },
            },
          ] : undefined,
          data: {
            currentValue: latestAnomaly.value,
            baseline: latestAnomaly.baseline,
            deviation: latestAnomaly.deviation,
            history: anomalies,
          },
          relatedMetrics: [metricName],
          createdAt: new Date(),
          dismissed: false,
          userId: values[0]?.context?.userId ?? '',
        });
      }
    });

    return insights;
  }

  private findStatisticalAnomalies(snapshots: MetricSnapshot[]): Array<{
    value: number;
    baseline: number;
    deviation: number;
    timestamp: Date;
  }> {
    if (snapshots.length < 7) return [];

    const sorted = [...snapshots].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    const values = sorted.map(s => s.value);

    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) return [];

    const threshold = this.getThresholdMultiplier() * stdDev;
    const anomalies: Array<{
      value: number;
      baseline: number;
      deviation: number;
      timestamp: Date;
    }> = [];

    sorted.forEach(snapshot => {
      const deviation = (snapshot.value - mean) / stdDev;
      if (Math.abs(deviation) > this.config.standardDeviationThreshold) {
        anomalies.push({
          value: snapshot.value,
          baseline: mean,
          deviation,
          timestamp: snapshot.timestamp,
        });
      }
    });

    return anomalies;
  }

  private getThresholdMultiplier(): number {
    switch (this.config.sensitivityLevel) {
      case 'low': return 3;
      case 'medium': return 2;
      case 'high': return 1.5;
      default: return 2;
    }
  }

  private determineSeverity(deviation: number): Insight['severity'] {
    const absDeviation = Math.abs(deviation);
    if (absDeviation > 4) return 'critical';
    if (absDeviation > 3) return 'warning';
    if (deviation > 2) return 'success'; // Positive anomaly
    return 'info';
  }

  private categorizeMetric(metricName: string): InsightCategory {
    const categories: Record<string, InsightCategory> = {
      productivity: 'productivity',
      tasks: 'productivity',
      focus: 'focus',
      meeting: 'schedule',
      goal: 'goals',
      habit: 'habits',
      health: 'health',
      workload: 'workload',
    };

    for (const [key, category] of Object.entries(categories)) {
      if (metricName.toLowerCase().includes(key)) {
        return category;
      }
    }
    return 'productivity';
  }

  private formatMetricName(name: string): string {
    return name
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .trim()
      .toLowerCase();
  }
}

// Trend Analysis
export class TrendAnalyzer {
  private config: TrendAnalysisConfig;

  constructor(config: Partial<TrendAnalysisConfig> = {}) {
    this.config = {
      periods: config.periods ?? 4,
      periodType: config.periodType ?? 'week',
      significanceThreshold: config.significanceThreshold ?? 0.1,
    };
  }

  /**
   * Analyze trends in metrics over time
   */
  async analyzeTrends(snapshots: MetricSnapshot[]): Promise<Insight[]> {
    const insights: Insight[] = [];

    // Group by metric
    const metricGroups: Map<string, MetricSnapshot[]> = new Map();
    snapshots.forEach(s => {
      if (!metricGroups.has(s.metricName)) {
        metricGroups.set(s.metricName, []);
      }
      metricGroups.get(s.metricName)!.push(s);
    });

    metricGroups.forEach((values, metricName) => {
      const trend = this.calculateTrend(values);
      if (trend && Math.abs(trend.changePercent) >= this.config.significanceThreshold * 100) {
        const direction = trend.changePercent > 0 ? 'up' : 'down';
        const isPositive = this.isTrendPositive(metricName, trend.changePercent);

        insights.push({
          id: `trend-${metricName}-${Date.now()}`,
          type: 'trend',
          category: this.categorizeMetric(metricName),
          title: `${this.formatMetricName(metricName)} Trending ${direction === 'up' ? 'Up' : 'Down'}`,
          description: `Your ${this.formatMetricName(metricName)} has ${direction === 'up' ? 'increased' : 'decreased'} by ${Math.abs(trend.changePercent).toFixed(1)}% over the last ${this.config.periods} ${this.config.periodType}s.`,
          severity: isPositive ? 'success' : 'warning',
          confidence: trend.confidence,
          actionable: !isPositive,
          actions: !isPositive ? [
            {
              id: 'view-details',
              label: 'View Trends',
              type: 'navigate',
              payload: { screen: 'TrendAnalysis', metric: metricName },
            },
          ] : undefined,
          data: {
            changePercent: trend.changePercent,
            startValue: trend.startValue,
            endValue: trend.endValue,
            slope: trend.slope,
            periods: trend.periodValues,
          },
          relatedMetrics: [metricName],
          createdAt: new Date(),
          dismissed: false,
          userId: values[0]?.context?.userId ?? '',
        });
      }
    });

    return insights;
  }

  /**
   * Compare current period with previous period
   */
  async compareperiods(
    currentSnapshots: MetricSnapshot[],
    previousSnapshots: MetricSnapshot[]
  ): Promise<Insight[]> {
    const insights: Insight[] = [];

    // Group by metric
    const currentByMetric = this.groupByMetric(currentSnapshots);
    const previousByMetric = this.groupByMetric(previousSnapshots);

    currentByMetric.forEach((currentValues, metricName) => {
      const previousValues = previousByMetric.get(metricName);
      if (previousValues && previousValues.length > 0) {
        const currentAvg = this.average(currentValues.map(v => v.value));
        const previousAvg = this.average(previousValues.map(v => v.value));
        const changePercent = ((currentAvg - previousAvg) / previousAvg) * 100;

        if (Math.abs(changePercent) >= this.config.significanceThreshold * 100) {
          const isPositive = this.isTrendPositive(metricName, changePercent);

          insights.push({
            id: `comparison-${metricName}-${Date.now()}`,
            type: 'comparison',
            category: this.categorizeMetric(metricName),
            title: `Week-over-Week ${this.formatMetricName(metricName)} Change`,
            description: `Your ${this.formatMetricName(metricName)} is ${changePercent > 0 ? 'up' : 'down'} ${Math.abs(changePercent).toFixed(1)}% compared to last week.`,
            severity: isPositive ? 'success' : 'warning',
            confidence: 0.9,
            actionable: !isPositive,
            data: {
              currentAverage: currentAvg,
              previousAverage: previousAvg,
              changePercent,
              currentPeriod: 'this_week',
              previousPeriod: 'last_week',
            },
            relatedMetrics: [metricName],
            createdAt: new Date(),
            dismissed: false,
            userId: currentValues[0]?.context?.userId ?? '',
          });
        }
      }
    });

    return insights;
  }

  private calculateTrend(snapshots: MetricSnapshot[]): {
    changePercent: number;
    startValue: number;
    endValue: number;
    slope: number;
    confidence: number;
    periodValues: number[];
  } | null {
    if (snapshots.length < 2) return null;

    const sorted = [...snapshots].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    const periodValues = this.aggregateByPeriod(sorted);

    if (periodValues.length < 2) return null;

    const startValue = periodValues[0];
    const endValue = periodValues[periodValues.length - 1];

    // Calculate linear regression
    const n = periodValues.length;
    const xMean = (n - 1) / 2;
    const yMean = this.average(periodValues);

    let numerator = 0;
    let denominator = 0;

    for (let i = 0; i < n; i++) {
      numerator += (i - xMean) * (periodValues[i] - yMean);
      denominator += Math.pow(i - xMean, 2);
    }

    const slope = denominator !== 0 ? numerator / denominator : 0;
    const changePercent = startValue !== 0 ? ((endValue - startValue) / startValue) * 100 : 0;

    // Calculate R-squared for confidence
    let ssRes = 0;
    let ssTot = 0;
    for (let i = 0; i < n; i++) {
      const predicted = yMean + slope * (i - xMean);
      ssRes += Math.pow(periodValues[i] - predicted, 2);
      ssTot += Math.pow(periodValues[i] - yMean, 2);
    }
    const rSquared = ssTot !== 0 ? 1 - (ssRes / ssTot) : 0;

    return {
      changePercent,
      startValue,
      endValue,
      slope,
      confidence: Math.max(0.5, Math.min(0.95, rSquared)),
      periodValues,
    };
  }

  private aggregateByPeriod(snapshots: MetricSnapshot[]): number[] {
    const periodMap: Map<string, number[]> = new Map();

    snapshots.forEach(s => {
      const periodKey = this.getPeriodKey(s.timestamp);
      if (!periodMap.has(periodKey)) {
        periodMap.set(periodKey, []);
      }
      periodMap.get(periodKey)!.push(s.value);
    });

    return Array.from(periodMap.values())
      .map(values => this.average(values))
      .slice(-this.config.periods);
  }

  private getPeriodKey(date: Date): string {
    const d = new Date(date);
    switch (this.config.periodType) {
      case 'day':
        return d.toISOString().split('T')[0];
      case 'week':
        const weekStart = new Date(d);
        weekStart.setDate(d.getDate() - d.getDay());
        return weekStart.toISOString().split('T')[0];
      case 'month':
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      default:
        return d.toISOString().split('T')[0];
    }
  }

  private groupByMetric(snapshots: MetricSnapshot[]): Map<string, MetricSnapshot[]> {
    const groups: Map<string, MetricSnapshot[]> = new Map();
    snapshots.forEach(s => {
      if (!groups.has(s.metricName)) {
        groups.set(s.metricName, []);
      }
      groups.get(s.metricName)!.push(s);
    });
    return groups;
  }

  private average(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  private categorizeMetric(metricName: string): InsightCategory {
    const categories: Record<string, InsightCategory> = {
      productivity: 'productivity',
      tasks: 'productivity',
      focus: 'focus',
      meeting: 'schedule',
      goal: 'goals',
      habit: 'habits',
      health: 'health',
      workload: 'workload',
    };

    for (const [key, category] of Object.entries(categories)) {
      if (metricName.toLowerCase().includes(key)) {
        return category;
      }
    }
    return 'productivity';
  }

  private formatMetricName(name: string): string {
    return name
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .trim()
      .toLowerCase();
  }

  private isTrendPositive(metricName: string, changePercent: number): boolean {
    // Metrics where decrease is positive
    const negativeMetrics = ['meeting_load', 'context_switches', 'overdue_tasks', 'stress_level'];
    const isNegativeMetric = negativeMetrics.some(m => metricName.toLowerCase().includes(m));

    return isNegativeMetric ? changePercent < 0 : changePercent > 0;
  }
}

// Opportunity Identifier
export class OpportunityIdentifier {
  /**
   * Identify opportunities for improvement
   */
  async identifyOpportunities(
    behaviorData: UserBehaviorData[],
    metrics: MetricSnapshot[]
  ): Promise<Insight[]> {
    const insights: Insight[] = [];

    // Time optimization opportunities
    const timeOpportunities = this.findTimeOptimizations(behaviorData);
    insights.push(...timeOpportunities);

    // Automation opportunities
    const automationOpportunities = this.findAutomationOpportunities(behaviorData);
    insights.push(...automationOpportunities);

    // Goal acceleration opportunities
    const goalOpportunities = this.findGoalAccelerationOpportunities(metrics);
    insights.push(...goalOpportunities);

    return insights;
  }

  private findTimeOptimizations(data: UserBehaviorData[]): Insight[] {
    const insights: Insight[] = [];

    // Analyze meeting patterns
    const meetingEvents = data.filter(e => e.eventType.includes('meeting'));
    if (meetingEvents.length > 10) {
      const avgMeetingDuration = meetingEvents.reduce(
        (sum, e) => sum + (e.metadata.duration ?? 30),
        0
      ) / meetingEvents.length;

      if (avgMeetingDuration > 45) {
        insights.push({
          id: `opportunity-meeting-length-${Date.now()}`,
          type: 'opportunity',
          category: 'schedule',
          title: 'Meeting Duration Optimization',
          description: `Your average meeting is ${Math.round(avgMeetingDuration)} minutes. Consider 25 or 50-minute meetings to allow buffer time.`,
          severity: 'info',
          confidence: 0.8,
          actionable: true,
          actions: [
            {
              id: 'set-default',
              label: 'Set 25-min Default',
              type: 'quick_action',
              payload: { defaultMeetingLength: 25 },
            },
          ],
          data: { avgMeetingDuration, meetingCount: meetingEvents.length },
          relatedMetrics: ['meeting_time', 'buffer_time'],
          createdAt: new Date(),
          dismissed: false,
          userId: data[0]?.userId ?? '',
        });
      }
    }

    // Analyze task batching opportunities
    const taskEvents = data.filter(e => e.eventType.includes('task'));
    const taskCategories: Map<string, number> = new Map();

    taskEvents.forEach(e => {
      const category = e.metadata.category ?? 'general';
      taskCategories.set(category, (taskCategories.get(category) ?? 0) + 1);
    });

    const fragmentedCategories = Array.from(taskCategories.entries())
      .filter(([_, count]) => count >= 5);

    if (fragmentedCategories.length > 3) {
      insights.push({
        id: `opportunity-task-batching-${Date.now()}`,
        type: 'opportunity',
        category: 'productivity',
        title: 'Task Batching Opportunity',
        description: `You frequently switch between ${fragmentedCategories.length} task categories. Batching similar tasks could save context-switching time.`,
        severity: 'info',
        confidence: 0.75,
        actionable: true,
        actions: [
          {
            id: 'view-batching',
            label: 'View Batching Suggestions',
            type: 'navigate',
            payload: { screen: 'TaskBatching' },
          },
        ],
        data: { categories: Object.fromEntries(fragmentedCategories) },
        relatedMetrics: ['context_switches', 'productivity_score'],
        createdAt: new Date(),
        dismissed: false,
        userId: data[0]?.userId ?? '',
      });
    }

    return insights;
  }

  private findAutomationOpportunities(data: UserBehaviorData[]): Insight[] {
    const insights: Insight[] = [];

    // Find repetitive actions
    const actionCounts: Map<string, number> = new Map();
    data.forEach(e => {
      actionCounts.set(e.eventType, (actionCounts.get(e.eventType) ?? 0) + 1);
    });

    const repetitiveActions = Array.from(actionCounts.entries())
      .filter(([_, count]) => count >= 20)
      .sort((a, b) => b[1] - a[1]);

    if (repetitiveActions.length > 0) {
      const [action, count] = repetitiveActions[0];
      insights.push({
        id: `opportunity-automation-${Date.now()}`,
        type: 'opportunity',
        category: 'productivity',
        title: 'Automation Opportunity Detected',
        description: `You've performed "${action}" ${count} times. This could be a candidate for automation.`,
        severity: 'info',
        confidence: 0.85,
        actionable: true,
        actions: [
          {
            id: 'explore-automation',
            label: 'Explore Automation',
            type: 'navigate',
            payload: { screen: 'AutomationBuilder', action },
          },
        ],
        data: { action, occurrences: count, topActions: repetitiveActions.slice(0, 5) },
        relatedMetrics: ['automation_potential', 'time_saved'],
        createdAt: new Date(),
        dismissed: false,
        userId: data[0]?.userId ?? '',
      });
    }

    return insights;
  }

  private findGoalAccelerationOpportunities(metrics: MetricSnapshot[]): Insight[] {
    const insights: Insight[] = [];

    // Find goals that could be accelerated
    const goalMetrics = metrics.filter(m => m.metricName.includes('goal_progress'));

    goalMetrics.forEach(metric => {
      const progress = metric.value;
      const daysRemaining = metric.context?.daysRemaining ?? 30;
      const requiredDailyProgress = (100 - progress) / daysRemaining;
      const currentDailyProgress = metric.context?.dailyProgress ?? 0;

      if (currentDailyProgress > requiredDailyProgress * 1.5 && progress < 80) {
        insights.push({
          id: `opportunity-goal-acceleration-${metric.context?.goalId}-${Date.now()}`,
          type: 'opportunity',
          category: 'goals',
          title: 'Goal Ahead of Schedule',
          description: `You're progressing 50% faster than needed. Consider stretching this goal or allocating time to other priorities.`,
          severity: 'success',
          confidence: 0.85,
          actionable: true,
          actions: [
            {
              id: 'stretch-goal',
              label: 'Set Stretch Target',
              type: 'quick_action',
              payload: { goalId: metric.context?.goalId, action: 'stretch' },
            },
          ],
          data: {
            currentProgress: progress,
            dailyProgress: currentDailyProgress,
            requiredProgress: requiredDailyProgress,
            goalId: metric.context?.goalId,
          },
          relatedMetrics: ['goal_progress', 'goal_velocity'],
          createdAt: new Date(),
          dismissed: false,
          userId: metric.context?.userId ?? '',
        });
      }
    });

    return insights;
  }
}

// Risk Early Warning System
export class RiskWarningSystem {
  /**
   * Generate early warnings for potential risks
   */
  async generateWarnings(
    metrics: MetricSnapshot[],
    behaviorData: UserBehaviorData[]
  ): Promise<Insight[]> {
    const insights: Insight[] = [];

    // Deadline risks
    const deadlineRisks = this.assessDeadlineRisks(metrics);
    insights.push(...deadlineRisks);

    // Burnout risks
    const burnoutRisks = this.assessBurnoutRisks(metrics, behaviorData);
    insights.push(...burnoutRisks);

    // Workload risks
    const workloadRisks = this.assessWorkloadRisks(metrics);
    insights.push(...workloadRisks);

    return insights;
  }

  private assessDeadlineRisks(metrics: MetricSnapshot[]): Insight[] {
    const insights: Insight[] = [];

    const taskMetrics = metrics.filter(m => m.metricName.includes('task') && m.context?.deadline);

    taskMetrics.forEach(metric => {
      const deadline = new Date(metric.context!.deadline);
      const now = new Date();
      const daysRemaining = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const progress = metric.value;
      const requiredDailyProgress = (100 - progress) / daysRemaining;

      if (requiredDailyProgress > 15 && daysRemaining <= 7) {
        insights.push({
          id: `risk-deadline-${metric.context?.taskId}-${Date.now()}`,
          type: 'risk',
          category: 'productivity',
          title: 'Deadline at Risk',
          description: `Task "${metric.context?.taskName}" requires ${requiredDailyProgress.toFixed(0)}% daily progress to meet deadline in ${daysRemaining} days.`,
          severity: daysRemaining <= 2 ? 'critical' : 'warning',
          confidence: 0.9,
          actionable: true,
          actions: [
            {
              id: 'prioritize',
              label: 'Prioritize Task',
              type: 'quick_action',
              payload: { taskId: metric.context?.taskId, action: 'prioritize' },
            },
            {
              id: 'extend',
              label: 'Request Extension',
              type: 'quick_action',
              payload: { taskId: metric.context?.taskId, action: 'extend' },
            },
          ],
          data: {
            taskId: metric.context?.taskId,
            taskName: metric.context?.taskName,
            progress,
            daysRemaining,
            requiredDailyProgress,
          },
          relatedMetrics: ['task_progress', 'deadline_risk'],
          createdAt: new Date(),
          expiresAt: deadline,
          dismissed: false,
          userId: metric.context?.userId ?? '',
        });
      }
    });

    return insights;
  }

  private assessBurnoutRisks(metrics: MetricSnapshot[], behaviorData: UserBehaviorData[]): Insight[] {
    const insights: Insight[] = [];

    // Check for extended work hours
    const recentBehavior = behaviorData.filter(b => {
      const dayAgo = new Date();
      dayAgo.setDate(dayAgo.getDate() - 7);
      return b.timestamp >= dayAgo;
    });

    const workHoursByDay: Map<string, { earliest: number; latest: number }> = new Map();
    recentBehavior.forEach(b => {
      const dateKey = b.timestamp.toISOString().split('T')[0];
      const hour = b.timestamp.getHours();

      if (!workHoursByDay.has(dateKey)) {
        workHoursByDay.set(dateKey, { earliest: hour, latest: hour });
      } else {
        const current = workHoursByDay.get(dateKey)!;
        workHoursByDay.set(dateKey, {
          earliest: Math.min(current.earliest, hour),
          latest: Math.max(current.latest, hour),
        });
      }
    });

    const avgWorkSpan = Array.from(workHoursByDay.values())
      .map(h => h.latest - h.earliest)
      .reduce((a, b) => a + b, 0) / workHoursByDay.size;

    if (avgWorkSpan > 10) {
      insights.push({
        id: `risk-burnout-hours-${Date.now()}`,
        type: 'risk',
        category: 'health',
        title: 'Extended Work Hours Detected',
        description: `Your average work span is ${avgWorkSpan.toFixed(1)} hours per day. Consider setting boundaries to prevent burnout.`,
        severity: avgWorkSpan > 12 ? 'critical' : 'warning',
        confidence: 0.85,
        actionable: true,
        actions: [
          {
            id: 'set-boundaries',
            label: 'Set Work Boundaries',
            type: 'navigate',
            payload: { screen: 'WorkBoundaries' },
          },
        ],
        data: { avgWorkSpan, dailyBreakdown: Object.fromEntries(workHoursByDay) },
        relatedMetrics: ['work_hours', 'burnout_risk'],
        createdAt: new Date(),
        dismissed: false,
        userId: recentBehavior[0]?.userId ?? '',
      });
    }

    // Check for lack of breaks
    const focusMetrics = metrics.filter(m => m.metricName.includes('focus_session'));
    const avgSessionLength = focusMetrics.length > 0
      ? focusMetrics.reduce((sum, m) => sum + m.value, 0) / focusMetrics.length
      : 0;

    if (avgSessionLength > 120) {
      insights.push({
        id: `risk-no-breaks-${Date.now()}`,
        type: 'risk',
        category: 'health',
        title: 'Insufficient Break Time',
        description: `Your average focus session is ${Math.round(avgSessionLength)} minutes. Taking regular breaks improves long-term productivity.`,
        severity: 'warning',
        confidence: 0.8,
        actionable: true,
        actions: [
          {
            id: 'enable-reminders',
            label: 'Enable Break Reminders',
            type: 'quick_action',
            payload: { action: 'enableBreakReminders' },
          },
        ],
        data: { avgSessionLength, sessionCount: focusMetrics.length },
        relatedMetrics: ['focus_duration', 'break_frequency'],
        createdAt: new Date(),
        dismissed: false,
        userId: focusMetrics[0]?.context?.userId ?? '',
      });
    }

    return insights;
  }

  private assessWorkloadRisks(metrics: MetricSnapshot[]): Insight[] {
    const insights: Insight[] = [];

    const workloadMetrics = metrics.filter(m => m.metricName.includes('workload'));

    if (workloadMetrics.length > 0) {
      const recentWorkload = workloadMetrics[workloadMetrics.length - 1];

      if (recentWorkload.value > 80) {
        insights.push({
          id: `risk-workload-${Date.now()}`,
          type: 'risk',
          category: 'workload',
          title: 'High Workload Detected',
          description: `Your workload capacity is at ${recentWorkload.value}%. Consider delegating or deferring non-critical tasks.`,
          severity: recentWorkload.value > 95 ? 'critical' : 'warning',
          confidence: 0.9,
          actionable: true,
          actions: [
            {
              id: 'review-tasks',
              label: 'Review Task Priority',
              type: 'navigate',
              payload: { screen: 'TaskPrioritization' },
            },
            {
              id: 'delegate',
              label: 'Delegate Tasks',
              type: 'navigate',
              payload: { screen: 'TaskDelegation' },
            },
          ],
          data: { workloadPercent: recentWorkload.value },
          relatedMetrics: ['workload_capacity', 'task_count'],
          createdAt: new Date(),
          dismissed: false,
          userId: recentWorkload.context?.userId ?? '',
        });
      }
    }

    return insights;
  }
}

// Recommendation Engine
export class RecommendationEngine {
  /**
   * Generate personalized recommendations
   */
  async generateRecommendations(
    insights: Insight[],
    userPreferences: Record<string, any>,
    historicalPerformance: MetricSnapshot[]
  ): Promise<Insight[]> {
    const recommendations: Insight[] = [];

    // Schedule optimization recommendations
    const scheduleRecs = this.generateScheduleRecommendations(insights, userPreferences);
    recommendations.push(...scheduleRecs);

    // Habit formation recommendations
    const habitRecs = this.generateHabitRecommendations(historicalPerformance);
    recommendations.push(...habitRecs);

    // Goal achievement recommendations
    const goalRecs = this.generateGoalRecommendations(insights);
    recommendations.push(...goalRecs);

    return recommendations;
  }

  private generateScheduleRecommendations(
    insights: Insight[],
    preferences: Record<string, any>
  ): Insight[] {
    const recommendations: Insight[] = [];

    // Find peak productivity patterns
    const productivityPatterns = insights.filter(
      i => i.type === 'pattern' && i.category === 'productivity'
    );

    if (productivityPatterns.length > 0) {
      const peakHourInsight = productivityPatterns.find(
        i => i.data.peakHour !== undefined
      );

      if (peakHourInsight) {
        const peakHour = peakHourInsight.data.peakHour;
        recommendations.push({
          id: `rec-schedule-peak-${Date.now()}`,
          type: 'recommendation',
          category: 'schedule',
          title: 'Optimize Your Schedule',
          description: `Block ${this.formatHour(peakHour)} - ${this.formatHour(peakHour + 2)} for your most important tasks. Your data shows this is when you're most productive.`,
          severity: 'info',
          confidence: 0.85,
          actionable: true,
          actions: [
            {
              id: 'block-time',
              label: 'Block This Time',
              type: 'quick_action',
              payload: { startHour: peakHour, duration: 2 },
            },
          ],
          data: { peakHour, suggestedDuration: 2 },
          relatedMetrics: ['productivity_score', 'focus_time'],
          createdAt: new Date(),
          dismissed: false,
          userId: peakHourInsight.userId,
        });
      }
    }

    // Meeting-free day recommendation
    const meetingInsights = insights.filter(i => i.data.meetingCount > 15);
    if (meetingInsights.length > 0) {
      recommendations.push({
        id: `rec-meeting-free-${Date.now()}`,
        type: 'recommendation',
        category: 'schedule',
        title: 'Consider a Meeting-Free Day',
        description: 'Your meeting load is high. Designating one day per week as meeting-free could boost deep work time by 20%.',
        severity: 'info',
        confidence: 0.8,
        actionable: true,
        actions: [
          {
            id: 'set-meeting-free',
            label: 'Set Meeting-Free Day',
            type: 'navigate',
            payload: { screen: 'CalendarSettings' },
          },
        ],
        data: { currentMeetingLoad: meetingInsights[0].data.meetingCount },
        relatedMetrics: ['meeting_time', 'deep_work_hours'],
        createdAt: new Date(),
        dismissed: false,
        userId: meetingInsights[0].userId,
      });
    }

    return recommendations;
  }

  private generateHabitRecommendations(metrics: MetricSnapshot[]): Insight[] {
    const recommendations: Insight[] = [];

    // Identify habits with declining streaks
    const habitMetrics = metrics.filter(m => m.metricName.includes('habit_streak'));

    habitMetrics.forEach(metric => {
      if (metric.value > 7 && metric.context?.previousStreak && metric.value < metric.context.previousStreak * 0.5) {
        recommendations.push({
          id: `rec-habit-recovery-${metric.context.habitId}-${Date.now()}`,
          type: 'recommendation',
          category: 'habits',
          title: 'Rebuild Your Habit Streak',
          description: `Your "${metric.context.habitName}" streak dropped. Start with smaller commitments to rebuild momentum.`,
          severity: 'info',
          confidence: 0.75,
          actionable: true,
          actions: [
            {
              id: 'reduce-target',
              label: 'Set Easier Target',
              type: 'quick_action',
              payload: { habitId: metric.context.habitId, action: 'reduce' },
            },
          ],
          data: {
            currentStreak: metric.value,
            previousStreak: metric.context.previousStreak,
            habitName: metric.context.habitName,
          },
          relatedMetrics: ['habit_streak', 'habit_completion'],
          createdAt: new Date(),
          dismissed: false,
          userId: metric.context?.userId ?? '',
        });
      }
    });

    return recommendations;
  }

  private generateGoalRecommendations(insights: Insight[]): Insight[] {
    const recommendations: Insight[] = [];

    // Find goals at risk
    const riskInsights = insights.filter(
      i => i.type === 'risk' && i.category === 'goals'
    );

    riskInsights.forEach(risk => {
      recommendations.push({
        id: `rec-goal-recovery-${risk.data.goalId}-${Date.now()}`,
        type: 'recommendation',
        category: 'goals',
        title: 'Goal Recovery Strategy',
        description: `Break down your goal into smaller daily milestones. Focus on the next 3 days to get back on track.`,
        severity: 'info',
        confidence: 0.8,
        actionable: true,
        actions: [
          {
            id: 'create-milestones',
            label: 'Create Daily Milestones',
            type: 'navigate',
            payload: { screen: 'GoalMilestones', goalId: risk.data.goalId },
          },
        ],
        data: { goalId: risk.data.goalId, currentProgress: risk.data.progress },
        relatedMetrics: ['goal_progress', 'daily_milestones'],
        createdAt: new Date(),
        dismissed: false,
        userId: risk.userId,
      });
    });

    return recommendations;
  }

  private formatHour(hour: number): string {
    const normalizedHour = hour % 24;
    const period = normalizedHour >= 12 ? 'PM' : 'AM';
    const displayHour = normalizedHour % 12 || 12;
    return `${displayHour}:00 ${period}`;
  }
}

// Main Insights Engine
export class InsightsEngine extends EventEmitter {
  private patternDetector: PatternDetector;
  private anomalyDetector: AnomalyDetector;
  private trendAnalyzer: TrendAnalyzer;
  private opportunityIdentifier: OpportunityIdentifier;
  private riskWarningSystem: RiskWarningSystem;
  private recommendationEngine: RecommendationEngine;
  private insightsCache: Map<string, Insight[]> = new Map();

  constructor(config: {
    patternDetection?: Partial<PatternDetectionConfig>;
    anomalyDetection?: Partial<AnomalyDetectionConfig>;
    trendAnalysis?: Partial<TrendAnalysisConfig>;
  } = {}) {
    super();
    this.patternDetector = new PatternDetector(config.patternDetection);
    this.anomalyDetector = new AnomalyDetector(config.anomalyDetection);
    this.trendAnalyzer = new TrendAnalyzer(config.trendAnalysis);
    this.opportunityIdentifier = new OpportunityIdentifier();
    this.riskWarningSystem = new RiskWarningSystem();
    this.recommendationEngine = new RecommendationEngine();
  }

  /**
   * Generate all insights for a user
   */
  async generateInsights(
    userId: string,
    behaviorData: UserBehaviorData[],
    metrics: MetricSnapshot[],
    userPreferences: Record<string, any> = {}
  ): Promise<Insight[]> {
    const allInsights: Insight[] = [];

    // Run all analysis in parallel
    const [
      patterns,
      anomalies,
      trends,
      opportunities,
      risks,
    ] = await Promise.all([
      this.patternDetector.detectPatterns(behaviorData),
      this.anomalyDetector.detectAnomalies(metrics),
      this.trendAnalyzer.analyzeTrends(metrics),
      this.opportunityIdentifier.identifyOpportunities(behaviorData, metrics),
      this.riskWarningSystem.generateWarnings(metrics, behaviorData),
    ]);

    allInsights.push(...patterns, ...anomalies, ...trends, ...opportunities, ...risks);

    // Generate recommendations based on other insights
    const recommendations = await this.recommendationEngine.generateRecommendations(
      allInsights,
      userPreferences,
      metrics
    );
    allInsights.push(...recommendations);

    // Sort by severity and confidence
    const sortedInsights = this.sortInsights(allInsights);

    // Cache insights
    this.insightsCache.set(userId, sortedInsights);

    // Emit event for real-time updates
    this.emit('insights-generated', { userId, insights: sortedInsights });

    return sortedInsights;
  }

  /**
   * Get cached insights for a user
   */
  getCachedInsights(userId: string): Insight[] {
    return this.insightsCache.get(userId) ?? [];
  }

  /**
   * Dismiss an insight
   */
  async dismissInsight(userId: string, insightId: string): Promise<void> {
    const insights = this.insightsCache.get(userId) ?? [];
    const insight = insights.find(i => i.id === insightId);

    if (insight) {
      insight.dismissed = true;
      this.emit('insight-dismissed', { userId, insightId });
    }
  }

  /**
   * Get insights by type
   */
  getInsightsByType(userId: string, type: InsightType): Insight[] {
    const insights = this.insightsCache.get(userId) ?? [];
    return insights.filter(i => i.type === type && !i.dismissed);
  }

  /**
   * Get insights by category
   */
  getInsightsByCategory(userId: string, category: InsightCategory): Insight[] {
    const insights = this.insightsCache.get(userId) ?? [];
    return insights.filter(i => i.category === category && !i.dismissed);
  }

  /**
   * Get actionable insights
   */
  getActionableInsights(userId: string): Insight[] {
    const insights = this.insightsCache.get(userId) ?? [];
    return insights.filter(i => i.actionable && !i.dismissed);
  }

  /**
   * Get high-priority insights (critical and warning severity)
   */
  getHighPriorityInsights(userId: string): Insight[] {
    const insights = this.insightsCache.get(userId) ?? [];
    return insights.filter(
      i => (i.severity === 'critical' || i.severity === 'warning') && !i.dismissed
    );
  }

  private sortInsights(insights: Insight[]): Insight[] {
    const severityOrder = { critical: 0, warning: 1, success: 2, info: 3 };

    return [...insights].sort((a, b) => {
      // First by severity
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (severityDiff !== 0) return severityDiff;

      // Then by confidence
      return b.confidence - a.confidence;
    });
  }
}

// Export singleton instance
export const insightsEngine = new InsightsEngine();

export default InsightsEngine;
