/**
 * Signal Timeline Service
 * Temporal analysis and trend detection for signals
 */

import type {
  Signal,
  UrgencyLevel,
  ImpactLevel,
} from '@mission-control/shared-types';

// ============================================================================
// TYPES
// ============================================================================

export interface SignalSnapshot {
  signalId: string;
  timestamp: string;
  urgency: UrgencyLevel;
  impact: ImpactLevel;
  confidence: number;
  status: string;
  metadata: Record<string, any>;
}

export interface SignalEvolution {
  signalId: string;
  signalTitle: string;
  createdAt: string;
  snapshots: SignalSnapshot[];
  currentState: Signal;
  changes: Array<{
    timestamp: string;
    field: string;
    previousValue: any;
    newValue: any;
    changeType: 'escalation' | 'de-escalation' | 'update' | 'resolution';
  }>;
  evolutionPattern: 'escalating' | 'stable' | 'de-escalating' | 'volatile' | 'resolved';
  averageTimeToChange: number; // milliseconds
  totalChanges: number;
}

export interface DeadlineAlert {
  signalId: string;
  signalTitle: string;
  deadline: string;
  proximity: 'overdue' | 'critical' | 'warning' | 'upcoming' | 'distant';
  hoursRemaining: number;
  daysRemaining: number;
  urgencyLevel: UrgencyLevel;
  impactIfMissed: ImpactLevel;
  recommendedAction: string;
  relatedSignals: string[];
}

export interface HistoricalPattern {
  id: string;
  name: string;
  description: string;
  signalTypes: string[];
  frequency: 'daily' | 'weekly' | 'monthly' | 'irregular';
  averageOccurrence: number;
  lastOccurrence: string;
  predictedNextOccurrence?: string;
  confidence: number;
  signals: string[];
  triggers: string[];
}

export interface UrgencyTrend {
  signalId: string;
  signalTitle: string;
  trend: 'increasing' | 'stable' | 'decreasing';
  trendStrength: number; // 0-1
  currentUrgency: UrgencyLevel;
  predictedUrgency: UrgencyLevel;
  timeToEscalation?: string;
  historicalUrgencies: Array<{ timestamp: string; urgency: UrgencyLevel }>;
  recommendation: string;
}

export interface PredictedSignal {
  id: string;
  predictedType: string;
  predictedTitle: string;
  predictedUrgency: UrgencyLevel;
  predictedImpact: ImpactLevel;
  probability: number;
  expectedDate: string;
  basedOnPatterns: string[];
  triggerConditions: string[];
  preventiveActions: string[];
  confidence: number;
}

export interface TimelineView {
  startDate: string;
  endDate: string;
  signals: Array<{
    signal: Signal;
    position: number; // 0-100 representing position on timeline
    duration?: number; // For signals with expiration
    isActive: boolean;
    isCritical: boolean;
  }>;
  milestones: Array<{
    id: string;
    name: string;
    date: string;
    position: number;
    relatedSignals: string[];
  }>;
  deadlineMarkers: DeadlineAlert[];
  densityMap: Array<{
    periodStart: string;
    periodEnd: string;
    signalCount: number;
    density: 'low' | 'medium' | 'high' | 'critical';
  }>;
}

export interface TimelineAnalysisResult {
  evolutions: SignalEvolution[];
  deadlineAlerts: DeadlineAlert[];
  patterns: HistoricalPattern[];
  trends: UrgencyTrend[];
  predictions: PredictedSignal[];
  timeline: TimelineView;
  statistics: {
    totalSignals: number;
    activeSignals: number;
    resolvedSignals: number;
    averageLifespan: number; // hours
    escalationRate: number; // percentage
    resolutionRate: number; // percentage
    peakActivityPeriod: string;
  };
  analyzedAt: string;
}

// ============================================================================
// SIGNAL TIMELINE SERVICE
// ============================================================================

export class SignalTimelineService {
  private signalHistory: Map<string, SignalSnapshot[]> = new Map();
  private patterns: Map<string, HistoricalPattern> = new Map();

  /**
   * Perform comprehensive timeline analysis
   */
  async analyzeTimeline(
    signals: Signal[],
    timeRangeHours: number = 168 // Default 1 week
  ): Promise<TimelineAnalysisResult> {
    const now = new Date();
    const startDate = new Date(now.getTime() - timeRangeHours * 60 * 60 * 1000);
    const endDate = now;

    // Track signal evolutions
    const evolutions = this.trackEvolutions(signals);

    // Generate deadline alerts
    const deadlineAlerts = this.generateDeadlineAlerts(signals);

    // Match historical patterns
    const patterns = await this.matchHistoricalPatterns(signals);

    // Detect urgency trends
    const trends = this.detectTrends(signals);

    // Predict future signals
    const predictions = await this.predictFutureSignals(signals, patterns);

    // Build timeline view
    const timeline = this.buildTimelineView(signals, startDate, endDate, deadlineAlerts);

    // Calculate statistics
    const statistics = this.calculateStatistics(signals, evolutions);

    return {
      evolutions,
      deadlineAlerts,
      patterns,
      trends,
      predictions,
      timeline,
      statistics,
      analyzedAt: now.toISOString(),
    };
  }

  /**
   * Track signal evolution over time
   */
  trackEvolutions(signals: Signal[]): SignalEvolution[] {
    return signals.map((signal) => {
      const history = this.signalHistory.get(signal.id) || [];

      // Record current snapshot
      const currentSnapshot: SignalSnapshot = {
        signalId: signal.id,
        timestamp: new Date().toISOString(),
        urgency: signal.urgency,
        impact: signal.impact,
        confidence: signal.confidence,
        status: signal.status,
        metadata: signal.metadata,
      };

      // Store snapshot
      if (!this.signalHistory.has(signal.id)) {
        this.signalHistory.set(signal.id, []);
      }
      this.signalHistory.get(signal.id)!.push(currentSnapshot);

      // Analyze changes
      const changes = this.analyzeChanges(history, currentSnapshot);

      // Determine evolution pattern
      const evolutionPattern = this.determineEvolutionPattern(history, currentSnapshot);

      // Calculate average time to change
      const averageTimeToChange = this.calculateAverageTimeToChange(history);

      return {
        signalId: signal.id,
        signalTitle: signal.title,
        createdAt: signal.created_at,
        snapshots: [...history, currentSnapshot],
        currentState: signal,
        changes,
        evolutionPattern,
        averageTimeToChange,
        totalChanges: changes.length,
      };
    });
  }

  /**
   * Analyze changes between snapshots
   */
  private analyzeChanges(
    history: SignalSnapshot[],
    current: SignalSnapshot
  ): SignalEvolution['changes'] {
    const changes: SignalEvolution['changes'] = [];

    if (history.length === 0) return changes;

    const previous = history[history.length - 1];

    // Check urgency changes
    if (previous.urgency !== current.urgency) {
      const urgencyOrder = ['low', 'medium', 'high', 'critical'];
      const prevIdx = urgencyOrder.indexOf(previous.urgency);
      const currIdx = urgencyOrder.indexOf(current.urgency);

      changes.push({
        timestamp: current.timestamp,
        field: 'urgency',
        previousValue: previous.urgency,
        newValue: current.urgency,
        changeType: currIdx > prevIdx ? 'escalation' : 'de-escalation',
      });
    }

    // Check impact changes
    if (previous.impact !== current.impact) {
      changes.push({
        timestamp: current.timestamp,
        field: 'impact',
        previousValue: previous.impact,
        newValue: current.impact,
        changeType: 'update',
      });
    }

    // Check status changes
    if (previous.status !== current.status) {
      changes.push({
        timestamp: current.timestamp,
        field: 'status',
        previousValue: previous.status,
        newValue: current.status,
        changeType: current.status === 'resolved' ? 'resolution' : 'update',
      });
    }

    // Check confidence changes
    if (Math.abs(previous.confidence - current.confidence) > 0.1) {
      changes.push({
        timestamp: current.timestamp,
        field: 'confidence',
        previousValue: previous.confidence,
        newValue: current.confidence,
        changeType: 'update',
      });
    }

    return changes;
  }

  /**
   * Determine evolution pattern from history
   */
  private determineEvolutionPattern(
    history: SignalSnapshot[],
    current: SignalSnapshot
  ): SignalEvolution['evolutionPattern'] {
    if (current.status === 'resolved') return 'resolved';
    if (history.length < 2) return 'stable';

    const urgencyOrder: Record<UrgencyLevel, number> = { low: 1, medium: 2, high: 3, critical: 4 };
    const recentHistory = history.slice(-5);

    let escalations = 0;
    let deEscalations = 0;

    for (let i = 1; i < recentHistory.length; i++) {
      const prevLevel = urgencyOrder[recentHistory[i - 1].urgency];
      const currLevel = urgencyOrder[recentHistory[i].urgency];

      if (currLevel > prevLevel) escalations++;
      if (currLevel < prevLevel) deEscalations++;
    }

    // Compare to current
    if (recentHistory.length > 0) {
      const lastLevel = urgencyOrder[recentHistory[recentHistory.length - 1].urgency];
      const currLevel = urgencyOrder[current.urgency];

      if (currLevel > lastLevel) escalations++;
      if (currLevel < lastLevel) deEscalations++;
    }

    if (escalations > deEscalations + 1) return 'escalating';
    if (deEscalations > escalations + 1) return 'de-escalating';
    if (escalations > 0 && deEscalations > 0) return 'volatile';
    return 'stable';
  }

  /**
   * Calculate average time between changes
   */
  private calculateAverageTimeToChange(history: SignalSnapshot[]): number {
    if (history.length < 2) return 0;

    let totalTime = 0;
    let changeCount = 0;

    for (let i = 1; i < history.length; i++) {
      const prevTime = new Date(history[i - 1].timestamp).getTime();
      const currTime = new Date(history[i].timestamp).getTime();

      if (
        history[i].urgency !== history[i - 1].urgency ||
        history[i].status !== history[i - 1].status
      ) {
        totalTime += currTime - prevTime;
        changeCount++;
      }
    }

    return changeCount > 0 ? totalTime / changeCount : 0;
  }

  /**
   * Generate deadline proximity alerts
   */
  generateDeadlineAlerts(signals: Signal[]): DeadlineAlert[] {
    const alerts: DeadlineAlert[] = [];
    const now = Date.now();

    signals.forEach((signal) => {
      // Check signal expiration
      if (signal.expires_at) {
        const deadline = new Date(signal.expires_at).getTime();
        const hoursRemaining = (deadline - now) / (1000 * 60 * 60);
        const daysRemaining = hoursRemaining / 24;

        let proximity: DeadlineAlert['proximity'];
        let recommendedAction: string;

        if (hoursRemaining < 0) {
          proximity = 'overdue';
          recommendedAction = 'IMMEDIATE ACTION REQUIRED: Signal has passed its deadline';
        } else if (hoursRemaining < 4) {
          proximity = 'critical';
          recommendedAction = 'CRITICAL: Address within the next few hours';
        } else if (hoursRemaining < 24) {
          proximity = 'warning';
          recommendedAction = 'WARNING: Schedule time today to address this signal';
        } else if (daysRemaining < 7) {
          proximity = 'upcoming';
          recommendedAction = 'UPCOMING: Plan to address this week';
        } else {
          proximity = 'distant';
          recommendedAction = 'SCHEDULED: Monitor and plan accordingly';
        }

        alerts.push({
          signalId: signal.id,
          signalTitle: signal.title,
          deadline: signal.expires_at,
          proximity,
          hoursRemaining: Math.max(0, hoursRemaining),
          daysRemaining: Math.max(0, daysRemaining),
          urgencyLevel: signal.urgency,
          impactIfMissed: signal.impact,
          recommendedAction,
          relatedSignals: this.findRelatedSignals(signal, signals),
        });
      }

      // Check for deadline-type signals
      if (signal.signal_type === 'deadline' && signal.metadata?.deadline) {
        const deadline = new Date(signal.metadata.deadline as string).getTime();
        const hoursRemaining = (deadline - now) / (1000 * 60 * 60);
        const daysRemaining = hoursRemaining / 24;

        let proximity: DeadlineAlert['proximity'];
        let recommendedAction: string;

        if (hoursRemaining < 0) {
          proximity = 'overdue';
          recommendedAction = 'OVERDUE: Escalate and take immediate action';
        } else if (hoursRemaining < 8) {
          proximity = 'critical';
          recommendedAction = 'CRITICAL: Must be completed today';
        } else if (hoursRemaining < 48) {
          proximity = 'warning';
          recommendedAction = 'WARNING: High priority - schedule immediately';
        } else if (daysRemaining < 7) {
          proximity = 'upcoming';
          recommendedAction = 'UPCOMING: Include in weekly planning';
        } else {
          proximity = 'distant';
          recommendedAction = 'SCHEDULED: Keep on radar';
        }

        alerts.push({
          signalId: signal.id,
          signalTitle: signal.title,
          deadline: signal.metadata.deadline as string,
          proximity,
          hoursRemaining: Math.max(0, hoursRemaining),
          daysRemaining: Math.max(0, daysRemaining),
          urgencyLevel: signal.urgency,
          impactIfMissed: signal.impact,
          recommendedAction,
          relatedSignals: this.findRelatedSignals(signal, signals),
        });
      }
    });

    // Sort by proximity (most urgent first)
    const proximityOrder = ['overdue', 'critical', 'warning', 'upcoming', 'distant'];
    return alerts.sort(
      (a, b) => proximityOrder.indexOf(a.proximity) - proximityOrder.indexOf(b.proximity)
    );
  }

  /**
   * Find signals related to a given signal
   */
  private findRelatedSignals(signal: Signal, allSignals: Signal[]): string[] {
    return allSignals
      .filter(
        (s) =>
          s.id !== signal.id &&
          (s.related_entity_id === signal.related_entity_id ||
            s.signal_type === signal.signal_type)
      )
      .map((s) => s.id)
      .slice(0, 5);
  }

  /**
   * Match historical patterns
   */
  async matchHistoricalPatterns(signals: Signal[]): Promise<HistoricalPattern[]> {
    const detectedPatterns: HistoricalPattern[] = [];

    // Analyze signal type frequencies
    const typeFrequencies = this.analyzeTypeFrequencies(signals);

    // Detect recurring patterns
    Object.entries(typeFrequencies).forEach(([type, data]) => {
      if (data.occurrences.length >= 3) {
        const frequency = this.determineFrequency(data.intervals);
        const avgOccurrence = data.intervals.length > 0
          ? data.intervals.reduce((a, b) => a + b, 0) / data.intervals.length
          : 0;

        const pattern: HistoricalPattern = {
          id: `pattern-${type}`,
          name: `Recurring ${type} signals`,
          description: `Pattern detected for ${type} signals occurring ${frequency}`,
          signalTypes: [type],
          frequency,
          averageOccurrence: avgOccurrence,
          lastOccurrence: data.occurrences[data.occurrences.length - 1],
          predictedNextOccurrence: this.predictNextOccurrence(data.occurrences, avgOccurrence),
          confidence: Math.min(0.95, 0.5 + data.occurrences.length * 0.1),
          signals: signals.filter((s) => s.signal_type === type).map((s) => s.id),
          triggers: this.identifyTriggers(signals.filter((s) => s.signal_type === type)),
        };

        detectedPatterns.push(pattern);
        this.patterns.set(pattern.id, pattern);
      }
    });

    // Return stored patterns
    return Array.from(this.patterns.values());
  }

  /**
   * Analyze signal type frequencies
   */
  private analyzeTypeFrequencies(signals: Signal[]): Record<
    string,
    { occurrences: string[]; intervals: number[] }
  > {
    const frequencies: Record<string, { occurrences: string[]; intervals: number[] }> = {};

    // Group by type
    signals.forEach((signal) => {
      const type = signal.signal_type;
      if (!frequencies[type]) {
        frequencies[type] = { occurrences: [], intervals: [] };
      }
      frequencies[type].occurrences.push(signal.created_at);
    });

    // Calculate intervals
    Object.values(frequencies).forEach((data) => {
      data.occurrences.sort();
      for (let i = 1; i < data.occurrences.length; i++) {
        const interval =
          new Date(data.occurrences[i]).getTime() -
          new Date(data.occurrences[i - 1]).getTime();
        data.intervals.push(interval / (1000 * 60 * 60)); // Convert to hours
      }
    });

    return frequencies;
  }

  /**
   * Determine frequency pattern from intervals
   */
  private determineFrequency(intervals: number[]): HistoricalPattern['frequency'] {
    if (intervals.length === 0) return 'irregular';

    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;

    if (avgInterval < 36) return 'daily';
    if (avgInterval < 200) return 'weekly';
    if (avgInterval < 800) return 'monthly';
    return 'irregular';
  }

  /**
   * Predict next occurrence based on pattern
   */
  private predictNextOccurrence(occurrences: string[], avgInterval: number): string | undefined {
    if (occurrences.length === 0 || avgInterval === 0) return undefined;

    const lastOccurrence = new Date(occurrences[occurrences.length - 1]).getTime();
    const predictedTime = lastOccurrence + avgInterval * 60 * 60 * 1000;

    return new Date(predictedTime).toISOString();
  }

  /**
   * Identify common triggers for a set of signals
   */
  private identifyTriggers(signals: Signal[]): string[] {
    const triggers: string[] = [];

    // Analyze sources
    const sources = signals.map((s) => s.source_data?.source).filter(Boolean);
    const uniqueSources = [...new Set(sources)];
    if (uniqueSources.length > 0) {
      triggers.push(`Source: ${uniqueSources.join(', ')}`);
    }

    // Analyze time patterns
    const hours = signals.map((s) => new Date(s.created_at).getHours());
    const peakHour = this.findPeakValue(hours);
    if (peakHour !== undefined) {
      triggers.push(`Often occurs around ${peakHour}:00`);
    }

    // Analyze day of week patterns
    const days = signals.map((s) => new Date(s.created_at).getDay());
    const peakDay = this.findPeakValue(days);
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    if (peakDay !== undefined) {
      triggers.push(`Most common on ${dayNames[peakDay]}`);
    }

    return triggers;
  }

  /**
   * Find the most common value in an array
   */
  private findPeakValue(values: number[]): number | undefined {
    if (values.length === 0) return undefined;

    const counts: Record<number, number> = {};
    values.forEach((v) => {
      counts[v] = (counts[v] || 0) + 1;
    });

    let maxCount = 0;
    let peakValue: number | undefined;

    Object.entries(counts).forEach(([value, count]) => {
      if (count > maxCount) {
        maxCount = count;
        peakValue = parseInt(value);
      }
    });

    return peakValue;
  }

  /**
   * Detect urgency trends
   */
  detectTrends(signals: Signal[]): UrgencyTrend[] {
    return signals.map((signal) => {
      const history = this.signalHistory.get(signal.id) || [];
      const historicalUrgencies = history.map((h) => ({
        timestamp: h.timestamp,
        urgency: h.urgency,
      }));

      // Add current state
      historicalUrgencies.push({
        timestamp: new Date().toISOString(),
        urgency: signal.urgency,
      });

      const { trend, strength, predicted } = this.analyzeTrend(historicalUrgencies);

      let recommendation: string;
      let timeToEscalation: string | undefined;

      if (trend === 'increasing') {
        recommendation = 'Urgency is increasing - consider proactive action';
        timeToEscalation = this.estimateTimeToEscalation(signal, historicalUrgencies);
      } else if (trend === 'decreasing') {
        recommendation = 'Urgency is decreasing - continue current approach';
      } else {
        recommendation = 'Urgency is stable - maintain monitoring';
      }

      return {
        signalId: signal.id,
        signalTitle: signal.title,
        trend,
        trendStrength: strength,
        currentUrgency: signal.urgency,
        predictedUrgency: predicted,
        timeToEscalation,
        historicalUrgencies,
        recommendation,
      };
    });
  }

  /**
   * Analyze trend from historical urgencies
   */
  private analyzeTrend(
    historicalUrgencies: Array<{ timestamp: string; urgency: UrgencyLevel }>
  ): { trend: UrgencyTrend['trend']; strength: number; predicted: UrgencyLevel } {
    if (historicalUrgencies.length < 2) {
      return {
        trend: 'stable',
        strength: 0,
        predicted: historicalUrgencies[0]?.urgency || 'low',
      };
    }

    const urgencyOrder: Record<UrgencyLevel, number> = { low: 1, medium: 2, high: 3, critical: 4 };
    const urgencyReverse = ['low', 'medium', 'high', 'critical'] as UrgencyLevel[];

    // Calculate trend using linear regression
    const values = historicalUrgencies.map((h) => urgencyOrder[h.urgency]);
    const n = values.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = values.reduce((sum, y, x) => sum + x * y, 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const strength = Math.min(1, Math.abs(slope));

    let trend: UrgencyTrend['trend'] = 'stable';
    if (slope > 0.1) trend = 'increasing';
    if (slope < -0.1) trend = 'decreasing';

    // Predict next urgency level
    const currentValue = values[values.length - 1];
    const predictedValue = Math.round(Math.max(1, Math.min(4, currentValue + slope)));
    const predicted = urgencyReverse[predictedValue - 1];

    return { trend, strength, predicted };
  }

  /**
   * Estimate time to escalation
   */
  private estimateTimeToEscalation(
    signal: Signal,
    historicalUrgencies: Array<{ timestamp: string; urgency: UrgencyLevel }>
  ): string | undefined {
    if (signal.urgency === 'critical') return undefined;

    const urgencyOrder: Record<UrgencyLevel, number> = { low: 1, medium: 2, high: 3, critical: 4 };
    const currentLevel = urgencyOrder[signal.urgency];
    const nextLevel = currentLevel + 1;

    // Calculate average time between escalations
    let totalTime = 0;
    let escalationCount = 0;

    for (let i = 1; i < historicalUrgencies.length; i++) {
      const prevLevel = urgencyOrder[historicalUrgencies[i - 1].urgency];
      const currLevel = urgencyOrder[historicalUrgencies[i].urgency];

      if (currLevel > prevLevel) {
        const time =
          new Date(historicalUrgencies[i].timestamp).getTime() -
          new Date(historicalUrgencies[i - 1].timestamp).getTime();
        totalTime += time;
        escalationCount++;
      }
    }

    if (escalationCount === 0) return undefined;

    const avgTimeToEscalation = totalTime / escalationCount;
    const hours = Math.round(avgTimeToEscalation / (1000 * 60 * 60));

    if (hours < 1) return 'Less than 1 hour';
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''}`;
    const days = Math.round(hours / 24);
    return `${days} day${days > 1 ? 's' : ''}`;
  }

  /**
   * Predict future signals based on patterns
   */
  async predictFutureSignals(
    signals: Signal[],
    patterns: HistoricalPattern[]
  ): Promise<PredictedSignal[]> {
    const predictions: PredictedSignal[] = [];

    patterns.forEach((pattern) => {
      if (pattern.predictedNextOccurrence && pattern.confidence > 0.6) {
        const predictedDate = new Date(pattern.predictedNextOccurrence);

        // Only predict if within next 7 days
        if (predictedDate.getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000) {
          // Analyze typical characteristics of this pattern's signals
          const patternSignals = signals.filter((s) => pattern.signals.includes(s.id));
          const avgUrgency = this.getAverageUrgency(patternSignals);
          const avgImpact = this.getAverageImpact(patternSignals);

          predictions.push({
            id: `prediction-${pattern.id}`,
            predictedType: pattern.signalTypes[0],
            predictedTitle: `Predicted ${pattern.signalTypes[0]} signal`,
            predictedUrgency: avgUrgency,
            predictedImpact: avgImpact,
            probability: pattern.confidence * 0.8,
            expectedDate: pattern.predictedNextOccurrence,
            basedOnPatterns: [pattern.id],
            triggerConditions: pattern.triggers,
            preventiveActions: this.getSuggestedPreventiveActions(pattern.signalTypes[0]),
            confidence: pattern.confidence * 0.7,
          });
        }
      }
    });

    return predictions.sort((a, b) => b.probability - a.probability);
  }

  /**
   * Get average urgency from signals
   */
  private getAverageUrgency(signals: Signal[]): UrgencyLevel {
    const urgencyOrder: Record<UrgencyLevel, number> = { low: 1, medium: 2, high: 3, critical: 4 };
    const urgencyReverse = ['low', 'medium', 'high', 'critical'] as UrgencyLevel[];

    if (signals.length === 0) return 'medium';

    const avg =
      signals.reduce((sum, s) => sum + urgencyOrder[s.urgency], 0) / signals.length;
    return urgencyReverse[Math.round(avg) - 1];
  }

  /**
   * Get average impact from signals
   */
  private getAverageImpact(signals: Signal[]): ImpactLevel {
    const impactOrder: Record<ImpactLevel, number> = { low: 1, medium: 2, high: 3, critical: 4 };
    const impactReverse = ['low', 'medium', 'high', 'critical'] as ImpactLevel[];

    if (signals.length === 0) return 'medium';

    const avg =
      signals.reduce((sum, s) => sum + impactOrder[s.impact], 0) / signals.length;
    return impactReverse[Math.round(avg) - 1];
  }

  /**
   * Get suggested preventive actions for signal type
   */
  private getSuggestedPreventiveActions(signalType: string): string[] {
    const actions: Record<string, string[]> = {
      deadline: [
        'Review upcoming deadlines and dependencies',
        'Allocate buffer time for completion',
        'Communicate early if delays expected',
      ],
      conflict: [
        'Review scheduled commitments',
        'Proactively reschedule if needed',
        'Identify priority items',
      ],
      risk: [
        'Review risk mitigation plans',
        'Update contingency resources',
        'Monitor early warning indicators',
      ],
      resource: [
        'Review resource allocation',
        'Identify backup resources',
        'Plan for capacity adjustments',
      ],
      dependency: [
        'Check dependency status',
        'Communicate with dependent parties',
        'Prepare alternative paths',
      ],
      opportunity: [
        'Stay alert for opportunity windows',
        'Prepare resources to act quickly',
        'Set up monitoring alerts',
      ],
      anomaly: [
        'Monitor system metrics',
        'Review recent changes',
        'Prepare investigation procedures',
      ],
      pattern: [
        'Analyze historical data',
        'Set up automated detection',
        'Document response procedures',
      ],
    };

    return actions[signalType] || ['Monitor and assess when signal appears'];
  }

  /**
   * Build timeline view for visualization
   */
  buildTimelineView(
    signals: Signal[],
    startDate: Date,
    endDate: Date,
    deadlineAlerts: DeadlineAlert[]
  ): TimelineView {
    const totalDuration = endDate.getTime() - startDate.getTime();

    // Map signals to timeline positions
    const timelineSignals = signals.map((signal) => {
      const signalTime = new Date(signal.created_at).getTime();
      let position = ((signalTime - startDate.getTime()) / totalDuration) * 100;
      position = Math.max(0, Math.min(100, position));

      let duration: number | undefined;
      if (signal.expires_at) {
        const expiryTime = new Date(signal.expires_at).getTime();
        duration = ((expiryTime - signalTime) / totalDuration) * 100;
      }

      return {
        signal,
        position,
        duration,
        isActive: signal.status === 'active',
        isCritical: signal.urgency === 'critical' || signal.urgency === 'high',
      };
    });

    // Add deadline markers
    const deadlineMarkers = deadlineAlerts.filter((alert) => {
      const deadlineTime = new Date(alert.deadline).getTime();
      return deadlineTime >= startDate.getTime() && deadlineTime <= endDate.getTime();
    });

    // Calculate density map (divide timeline into 24 periods)
    const periodCount = 24;
    const periodDuration = totalDuration / periodCount;
    const densityMap: TimelineView['densityMap'] = [];

    for (let i = 0; i < periodCount; i++) {
      const periodStart = new Date(startDate.getTime() + i * periodDuration);
      const periodEnd = new Date(startDate.getTime() + (i + 1) * periodDuration);

      const signalCount = signals.filter((s) => {
        const time = new Date(s.created_at).getTime();
        return time >= periodStart.getTime() && time < periodEnd.getTime();
      }).length;

      let density: 'low' | 'medium' | 'high' | 'critical';
      if (signalCount <= 1) density = 'low';
      else if (signalCount <= 3) density = 'medium';
      else if (signalCount <= 5) density = 'high';
      else density = 'critical';

      densityMap.push({
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
        signalCount,
        density,
      });
    }

    return {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      signals: timelineSignals,
      milestones: [], // Could be populated from context
      deadlineMarkers,
      densityMap,
    };
  }

  /**
   * Calculate timeline statistics
   */
  private calculateStatistics(
    signals: Signal[],
    evolutions: SignalEvolution[]
  ): TimelineAnalysisResult['statistics'] {
    const totalSignals = signals.length;
    const activeSignals = signals.filter((s) => s.status === 'active').length;
    const resolvedSignals = signals.filter((s) => s.status === 'resolved').length;

    // Calculate average lifespan
    const lifespans = signals
      .filter((s) => s.updated_at)
      .map((s) => {
        const created = new Date(s.created_at).getTime();
        const updated = new Date(s.updated_at).getTime();
        return (updated - created) / (1000 * 60 * 60); // hours
      });
    const averageLifespan =
      lifespans.length > 0
        ? lifespans.reduce((a, b) => a + b, 0) / lifespans.length
        : 0;

    // Calculate escalation rate
    const escalatingSignals = evolutions.filter(
      (e) => e.evolutionPattern === 'escalating'
    ).length;
    const escalationRate = totalSignals > 0 ? (escalatingSignals / totalSignals) * 100 : 0;

    // Calculate resolution rate
    const resolutionRate = totalSignals > 0 ? (resolvedSignals / totalSignals) * 100 : 0;

    // Find peak activity period
    const hours = signals.map((s) => new Date(s.created_at).getHours());
    const peakHour = this.findPeakValue(hours) || 12;
    const peakActivityPeriod = `${peakHour}:00 - ${peakHour + 1}:00`;

    return {
      totalSignals,
      activeSignals,
      resolvedSignals,
      averageLifespan,
      escalationRate,
      resolutionRate,
      peakActivityPeriod,
    };
  }
}

// Singleton instance
export const signalTimelineService = new SignalTimelineService();
