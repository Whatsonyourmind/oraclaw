/**
 * ORACLE Pattern Learning Service
 * Story adv-13 - Behavioral pattern detection and learning
 *
 * Implements:
 * - detectPatterns() - find recurring behaviors
 * - scorePattern() - confidence scoring for patterns
 * - recordFeedback() - learn from user feedback
 * - getRecommendations() - pattern-based suggestions
 * - Time-of-day, day-of-week, sequence detection
 */

import { oracleCacheService, cacheKey, hashObject } from './cache';

// ============================================================================
// Types
// ============================================================================

export type PatternType =
  | 'temporal'
  | 'sequential'
  | 'contextual'
  | 'behavioral'
  | 'correlation'
  | 'preference'
  | 'routine'
  | 'custom';

export type FeedbackType =
  | 'confirm'
  | 'reject'
  | 'modify'
  | 'ignore'
  | 'useful'
  | 'not_useful'
  | 'timing'
  | 'accuracy';

export type FeedbackSentiment = 'positive' | 'negative' | 'neutral';

export interface LearnedPattern {
  id: string;
  user_id: string;
  pattern_type: PatternType;
  name: string;
  description?: string;
  pattern_signature: PatternSignature;
  trigger_conditions: Record<string, any>;
  typical_context: Record<string, any>;
  time_of_day_distribution: TimeDistribution;
  day_of_week_distribution: DayDistribution;
  recurrence_pattern?: string;
  confidence: number;
  support_count: number;
  occurrence_rate?: number;
  consistency_score?: number;
  is_active: boolean;
  is_validated: boolean;
  last_observed_at?: string;
  first_observed_at?: string;
  observation_count: number;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface PatternInstance {
  id: string;
  pattern_id: string;
  user_id: string;
  occurred_at: string;
  context: Record<string, any>;
  trigger_data: Record<string, any>;
  outcome_data: Record<string, any>;
  match_confidence: number;
  deviation_from_pattern?: number;
  related_signals: string[];
  related_decisions: string[];
  related_actions: string[];
  time_of_day: string;
  day_of_week: number;
  week_of_year: number;
  metadata: Record<string, any>;
  created_at: string;
}

export interface PatternFeedback {
  id: string;
  pattern_id: string;
  instance_id?: string;
  user_id: string;
  feedback_type: FeedbackType;
  sentiment?: FeedbackSentiment;
  rating?: number;
  comment?: string;
  suggested_changes: Record<string, any>;
  context_at_feedback: Record<string, any>;
  was_applied: boolean;
  impact_on_confidence?: number;
  metadata: Record<string, any>;
  created_at: string;
}

export interface PatternSignature {
  action_sequence?: string[];
  entity_types?: string[];
  event_types?: string[];
  duration_range?: { min: number; max: number };
  frequency?: { count: number; window_hours: number };
  time_pattern?: TimePattern;
  context_requirements?: Record<string, any>;
  correlation_factors?: CorrelationFactor[];
}

export interface TimePattern {
  hour_ranges?: Array<{ start: number; end: number }>;
  days_of_week?: number[];
  weeks_of_month?: number[];
  time_zone?: string;
}

export interface CorrelationFactor {
  factor: string;
  correlation_strength: number;
  direction: 'positive' | 'negative';
}

export interface TimeDistribution {
  [hour: string]: number; // 0-23 mapped to frequency
}

export interface DayDistribution {
  [day: string]: number; // 0-6 (Sun-Sat) mapped to frequency
}

export interface PatternRecommendation {
  pattern_id: string;
  pattern_name: string;
  recommendation_type: 'action' | 'timing' | 'context' | 'warning';
  content: string;
  confidence: number;
  trigger_reason: string;
  suggested_action?: Record<string, any>;
  optimal_time?: string;
  context_match: number;
  priority: 'high' | 'medium' | 'low';
}

export interface BehavioralEvent {
  event_type: string;
  entity_type?: string;
  entity_id?: string;
  timestamp: string;
  context: Record<string, any>;
  outcome?: Record<string, any>;
  duration_ms?: number;
  metadata?: Record<string, any>;
}

export interface DetectedPattern {
  pattern_type: PatternType;
  name: string;
  description: string;
  signature: PatternSignature;
  confidence: number;
  support_count: number;
  instances: BehavioralEvent[];
  time_distribution: TimeDistribution;
  day_distribution: DayDistribution;
}

// Cache TTLs
const PATTERN_CACHE_TTL = {
  patterns: 10 * 60 * 1000, // 10 minutes
  recommendations: 5 * 60 * 1000, // 5 minutes
  detection: 15 * 60 * 1000, // 15 minutes
};

// Minimum thresholds for pattern detection
const DETECTION_THRESHOLDS = {
  min_occurrences: 3, // Minimum times a pattern must occur
  min_confidence: 0.5, // Minimum confidence score
  max_deviation_percent: 30, // Maximum deviation from average for consistency
  sequence_similarity_threshold: 0.7, // Minimum similarity for sequence matching
  time_window_hours: 168, // 1 week lookback for initial detection
};

// ============================================================================
// Pattern Learning Service
// ============================================================================

export class PatternLearningService {
  // In-memory stores for demo (would use Supabase in production)
  private patterns: LearnedPattern[] = [];
  private instances: PatternInstance[] = [];
  private feedbacks: PatternFeedback[] = [];
  private behavioralEvents: Map<string, BehavioralEvent[]> = new Map();

  // ============================================================================
  // Pattern Detection
  // ============================================================================

  /**
   * Detect patterns from behavioral events
   * Analyzes user behavior to find recurring patterns
   */
  async detectPatterns(
    userId: string,
    options: {
      lookback_hours?: number;
      pattern_types?: PatternType[];
      min_occurrences?: number;
      min_confidence?: number;
    } = {}
  ): Promise<DetectedPattern[]> {
    const lookbackHours = options.lookback_hours || DETECTION_THRESHOLDS.time_window_hours;
    const minOccurrences = options.min_occurrences || DETECTION_THRESHOLDS.min_occurrences;
    const minConfidence = options.min_confidence || DETECTION_THRESHOLDS.min_confidence;
    const patternTypes = options.pattern_types || ['temporal', 'sequential', 'behavioral'];

    const cacheKeyStr = cacheKey('patterns', userId, hashObject(options));
    const cached = oracleCacheService.get<DetectedPattern[]>(cacheKeyStr);
    if (cached) {
      return cached;
    }

    // Get user's behavioral events within lookback window
    const events = this.getUserEvents(userId, lookbackHours);
    const detectedPatterns: DetectedPattern[] = [];

    // Detect temporal patterns (time-of-day, day-of-week)
    if (patternTypes.includes('temporal')) {
      const temporalPatterns = this.detectTemporalPatterns(events, minOccurrences, minConfidence);
      detectedPatterns.push(...temporalPatterns);
    }

    // Detect sequential patterns (action sequences)
    if (patternTypes.includes('sequential')) {
      const sequentialPatterns = this.detectSequentialPatterns(events, minOccurrences, minConfidence);
      detectedPatterns.push(...sequentialPatterns);
    }

    // Detect behavioral patterns (context-based habits)
    if (patternTypes.includes('behavioral')) {
      const behavioralPatterns = this.detectBehavioralPatterns(events, minOccurrences, minConfidence);
      detectedPatterns.push(...behavioralPatterns);
    }

    // Detect routine patterns (regular recurring activities)
    if (patternTypes.includes('routine')) {
      const routinePatterns = this.detectRoutinePatterns(events, minOccurrences, minConfidence);
      detectedPatterns.push(...routinePatterns);
    }

    // Detect correlation patterns (co-occurring events)
    if (patternTypes.includes('correlation')) {
      const correlationPatterns = this.detectCorrelationPatterns(events, minOccurrences, minConfidence);
      detectedPatterns.push(...correlationPatterns);
    }

    oracleCacheService.set(cacheKeyStr, detectedPatterns, PATTERN_CACHE_TTL.detection);

    return detectedPatterns;
  }

  /**
   * Detect temporal patterns (when activities typically occur)
   */
  private detectTemporalPatterns(
    events: BehavioralEvent[],
    minOccurrences: number,
    minConfidence: number
  ): DetectedPattern[] {
    const patterns: DetectedPattern[] = [];

    // Group events by type
    const eventsByType = this.groupEventsByType(events);

    for (const [eventType, typeEvents] of Object.entries(eventsByType)) {
      if (typeEvents.length < minOccurrences) continue;

      // Analyze time-of-day distribution
      const timeDistribution = this.calculateTimeDistribution(typeEvents);
      const dayDistribution = this.calculateDayDistribution(typeEvents);

      // Find peak hours (hours with significantly above-average activity)
      const peakHours = this.findPeakPeriods(timeDistribution, 'hour');
      const peakDays = this.findPeakPeriods(dayDistribution, 'day');

      if (peakHours.length > 0 || peakDays.length > 0) {
        const confidence = this.calculateTemporalConfidence(
          timeDistribution,
          dayDistribution,
          typeEvents.length
        );

        if (confidence >= minConfidence) {
          patterns.push({
            pattern_type: 'temporal',
            name: `${eventType} timing pattern`,
            description: this.generateTemporalDescription(eventType, peakHours, peakDays),
            signature: {
              event_types: [eventType],
              time_pattern: {
                hour_ranges: peakHours.map((h) => ({ start: h, end: h })),
                days_of_week: peakDays,
              },
            },
            confidence,
            support_count: typeEvents.length,
            instances: typeEvents,
            time_distribution: timeDistribution,
            day_distribution: dayDistribution,
          });
        }
      }
    }

    return patterns;
  }

  /**
   * Detect sequential patterns (action sequences)
   */
  private detectSequentialPatterns(
    events: BehavioralEvent[],
    minOccurrences: number,
    minConfidence: number
  ): DetectedPattern[] {
    const patterns: DetectedPattern[] = [];

    // Sort events by timestamp
    const sortedEvents = [...events].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // Extract sequences using sliding window
    const windowSizeMinutes = 30; // Group events within 30 minutes
    const sequences = this.extractSequences(sortedEvents, windowSizeMinutes);

    // Find frequent sequences
    const sequenceCounts = new Map<string, { count: number; instances: BehavioralEvent[][] }>();

    for (const sequence of sequences) {
      if (sequence.length < 2) continue;

      const sequenceKey = sequence.map((e) => e.event_type).join(' -> ');

      if (!sequenceCounts.has(sequenceKey)) {
        sequenceCounts.set(sequenceKey, { count: 0, instances: [] });
      }

      const entry = sequenceCounts.get(sequenceKey)!;
      entry.count++;
      entry.instances.push(sequence);
    }

    // Filter to patterns meeting threshold
    for (const [sequenceKey, data] of sequenceCounts.entries()) {
      if (data.count < minOccurrences) continue;

      const eventTypes = sequenceKey.split(' -> ');
      const confidence = this.calculateSequenceConfidence(data.count, sequences.length);

      if (confidence >= minConfidence) {
        const flatInstances = data.instances.flat();
        const timeDistribution = this.calculateTimeDistribution(flatInstances);
        const dayDistribution = this.calculateDayDistribution(flatInstances);

        patterns.push({
          pattern_type: 'sequential',
          name: `Sequence: ${sequenceKey}`,
          description: `User frequently performs: ${sequenceKey}`,
          signature: {
            action_sequence: eventTypes,
          },
          confidence,
          support_count: data.count,
          instances: flatInstances,
          time_distribution: timeDistribution,
          day_distribution: dayDistribution,
        });
      }
    }

    return patterns;
  }

  /**
   * Detect behavioral patterns (context-based habits)
   */
  private detectBehavioralPatterns(
    events: BehavioralEvent[],
    minOccurrences: number,
    minConfidence: number
  ): DetectedPattern[] {
    const patterns: DetectedPattern[] = [];

    // Group events by context similarity
    const contextClusters = this.clusterByContext(events);

    for (const cluster of contextClusters) {
      if (cluster.events.length < minOccurrences) continue;

      // Calculate pattern strength based on context consistency
      const confidence = this.calculateContextConfidence(cluster.events, cluster.commonContext);

      if (confidence >= minConfidence) {
        const timeDistribution = this.calculateTimeDistribution(cluster.events);
        const dayDistribution = this.calculateDayDistribution(cluster.events);

        const dominantEventType = this.findDominantEventType(cluster.events);

        patterns.push({
          pattern_type: 'behavioral',
          name: `${dominantEventType} in ${cluster.contextDescription}`,
          description: `User tends to ${dominantEventType} when ${cluster.contextDescription}`,
          signature: {
            event_types: [dominantEventType],
            context_requirements: cluster.commonContext,
          },
          confidence,
          support_count: cluster.events.length,
          instances: cluster.events,
          time_distribution: timeDistribution,
          day_distribution: dayDistribution,
        });
      }
    }

    return patterns;
  }

  /**
   * Detect routine patterns (regular recurring activities)
   */
  private detectRoutinePatterns(
    events: BehavioralEvent[],
    minOccurrences: number,
    minConfidence: number
  ): DetectedPattern[] {
    const patterns: DetectedPattern[] = [];

    // Group by event type and day
    const eventsByTypeAndDay = new Map<
      string,
      Map<number, BehavioralEvent[]>
    >();

    for (const event of events) {
      const date = new Date(event.timestamp);
      const dayOfWeek = date.getDay();
      const eventType = event.event_type;

      if (!eventsByTypeAndDay.has(eventType)) {
        eventsByTypeAndDay.set(eventType, new Map());
      }

      const dayMap = eventsByTypeAndDay.get(eventType)!;
      if (!dayMap.has(dayOfWeek)) {
        dayMap.set(dayOfWeek, []);
      }
      dayMap.get(dayOfWeek)!.push(event);
    }

    // Find routines (same event on same day at similar times)
    for (const [eventType, dayMap] of eventsByTypeAndDay.entries()) {
      for (const [dayOfWeek, dayEvents] of dayMap.entries()) {
        if (dayEvents.length < minOccurrences) continue;

        // Check if events occur at consistent times
        const hours = dayEvents.map((e) => new Date(e.timestamp).getHours());
        const avgHour = hours.reduce((a, b) => a + b, 0) / hours.length;
        const variance = hours.reduce((sum, h) => sum + Math.pow(h - avgHour, 2), 0) / hours.length;
        const stdDev = Math.sqrt(variance);

        // Low variance means consistent timing
        if (stdDev <= 2) {
          // Within 2 hours variance
          const confidence = Math.max(0, 1 - stdDev / 12); // Normalize to 0-1
          if (confidence >= minConfidence) {
            const timeDistribution = this.calculateTimeDistribution(dayEvents);
            const dayDistribution: DayDistribution = { [dayOfWeek]: dayEvents.length };
            const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek];

            patterns.push({
              pattern_type: 'routine',
              name: `${dayName} ${eventType} routine`,
              description: `User typically does ${eventType} on ${dayName}s around ${Math.round(avgHour)}:00`,
              signature: {
                event_types: [eventType],
                time_pattern: {
                  days_of_week: [dayOfWeek],
                  hour_ranges: [{ start: Math.floor(avgHour - 1), end: Math.ceil(avgHour + 1) }],
                },
              },
              confidence,
              support_count: dayEvents.length,
              instances: dayEvents,
              time_distribution: timeDistribution,
              day_distribution: dayDistribution,
            });
          }
        }
      }
    }

    return patterns;
  }

  /**
   * Detect correlation patterns (co-occurring events)
   */
  private detectCorrelationPatterns(
    events: BehavioralEvent[],
    minOccurrences: number,
    minConfidence: number
  ): DetectedPattern[] {
    const patterns: DetectedPattern[] = [];

    // Find events that frequently occur together within a time window
    const windowMinutes = 60; // 1 hour window
    const cooccurrences = new Map<string, { count: number; events: BehavioralEvent[] }>();

    // Sort events by time
    const sortedEvents = [...events].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    for (let i = 0; i < sortedEvents.length; i++) {
      const event1 = sortedEvents[i];
      const event1Time = new Date(event1.timestamp).getTime();

      for (let j = i + 1; j < sortedEvents.length; j++) {
        const event2 = sortedEvents[j];
        const event2Time = new Date(event2.timestamp).getTime();
        const diffMinutes = (event2Time - event1Time) / (1000 * 60);

        if (diffMinutes > windowMinutes) break;

        if (event1.event_type !== event2.event_type) {
          const pairKey = [event1.event_type, event2.event_type].sort().join(' + ');

          if (!cooccurrences.has(pairKey)) {
            cooccurrences.set(pairKey, { count: 0, events: [] });
          }

          const entry = cooccurrences.get(pairKey)!;
          entry.count++;
          entry.events.push(event1, event2);
        }
      }
    }

    // Create patterns from frequent co-occurrences
    for (const [pairKey, data] of cooccurrences.entries()) {
      if (data.count < minOccurrences) continue;

      const [type1, type2] = pairKey.split(' + ');
      const totalType1 = events.filter((e) => e.event_type === type1).length;
      const totalType2 = events.filter((e) => e.event_type === type2).length;

      // Calculate correlation strength
      const correlation = (data.count * 2) / (totalType1 + totalType2);
      const confidence = Math.min(1, correlation);

      if (confidence >= minConfidence) {
        const uniqueEvents = [...new Set(data.events)];
        const timeDistribution = this.calculateTimeDistribution(uniqueEvents);
        const dayDistribution = this.calculateDayDistribution(uniqueEvents);

        patterns.push({
          pattern_type: 'correlation',
          name: `${type1} correlates with ${type2}`,
          description: `${type1} and ${type2} often occur together`,
          signature: {
            event_types: [type1, type2],
            correlation_factors: [
              { factor: pairKey, correlation_strength: correlation, direction: 'positive' },
            ],
          },
          confidence,
          support_count: data.count,
          instances: uniqueEvents,
          time_distribution: timeDistribution,
          day_distribution: dayDistribution,
        });
      }
    }

    return patterns;
  }

  // ============================================================================
  // Pattern Scoring
  // ============================================================================

  /**
   * Score a pattern's confidence based on various factors
   */
  async scorePattern(
    pattern: LearnedPattern,
    recentEvents?: BehavioralEvent[]
  ): Promise<{
    overall_score: number;
    components: {
      frequency_score: number;
      consistency_score: number;
      recency_score: number;
      feedback_score: number;
    };
    trend: 'strengthening' | 'weakening' | 'stable';
  }> {
    // Frequency score: based on occurrence rate
    const frequencyScore = Math.min(
      1,
      (pattern.support_count || 0) / (DETECTION_THRESHOLDS.min_occurrences * 3)
    );

    // Consistency score: how consistent is the pattern
    const consistencyScore = pattern.consistency_score || 0.5;

    // Recency score: decay based on time since last observation
    const lastObserved = pattern.last_observed_at
      ? new Date(pattern.last_observed_at).getTime()
      : Date.now() - 30 * 24 * 60 * 60 * 1000;
    const daysSinceObserved = (Date.now() - lastObserved) / (24 * 60 * 60 * 1000);
    const recencyScore = Math.max(0, 1 - daysSinceObserved / 30);

    // Feedback score: based on user feedback
    const patternFeedback = this.feedbacks.filter(
      (f) => f.pattern_id === pattern.id
    );
    let feedbackScore = 0.5; // Default neutral

    if (patternFeedback.length > 0) {
      const positiveCount = patternFeedback.filter(
        (f) => f.sentiment === 'positive' || f.feedback_type === 'confirm'
      ).length;
      const negativeCount = patternFeedback.filter(
        (f) => f.sentiment === 'negative' || f.feedback_type === 'reject'
      ).length;

      feedbackScore = (positiveCount + 1) / (positiveCount + negativeCount + 2); // Laplace smoothing
    }

    // Calculate overall score (weighted average)
    const weights = {
      frequency: 0.25,
      consistency: 0.3,
      recency: 0.25,
      feedback: 0.2,
    };

    const overallScore =
      weights.frequency * frequencyScore +
      weights.consistency * consistencyScore +
      weights.recency * recencyScore +
      weights.feedback * feedbackScore;

    // Determine trend by comparing recent vs historical instances
    let trend: 'strengthening' | 'weakening' | 'stable' = 'stable';
    if (recentEvents) {
      const recentMatches = recentEvents.filter((e) =>
        this.matchesPattern(e, pattern)
      ).length;
      const expectedRate = pattern.occurrence_rate || 0;
      const actualRate = recentMatches / Math.max(1, recentEvents.length);

      if (actualRate > expectedRate * 1.2) {
        trend = 'strengthening';
      } else if (actualRate < expectedRate * 0.8) {
        trend = 'weakening';
      }
    }

    return {
      overall_score: overallScore,
      components: {
        frequency_score: frequencyScore,
        consistency_score: consistencyScore,
        recency_score: recencyScore,
        feedback_score: feedbackScore,
      },
      trend,
    };
  }

  // ============================================================================
  // Feedback Recording
  // ============================================================================

  /**
   * Record user feedback on a pattern
   */
  async recordFeedback(params: {
    pattern_id: string;
    user_id: string;
    instance_id?: string;
    feedback_type: FeedbackType;
    sentiment?: FeedbackSentiment;
    rating?: number;
    comment?: string;
    suggested_changes?: Record<string, any>;
    context_at_feedback?: Record<string, any>;
  }): Promise<PatternFeedback> {
    const feedback: PatternFeedback = {
      id: crypto.randomUUID(),
      pattern_id: params.pattern_id,
      instance_id: params.instance_id,
      user_id: params.user_id,
      feedback_type: params.feedback_type,
      sentiment: params.sentiment,
      rating: params.rating,
      comment: params.comment,
      suggested_changes: params.suggested_changes || {},
      context_at_feedback: params.context_at_feedback || {},
      was_applied: false,
      metadata: {},
      created_at: new Date().toISOString(),
    };

    // Store feedback
    this.feedbacks.push(feedback);

    // Apply feedback to pattern
    const impactOnConfidence = await this.applyFeedback(feedback);
    feedback.impact_on_confidence = impactOnConfidence;
    feedback.was_applied = true;

    // Invalidate cache
    oracleCacheService.deleteByPrefix(`patterns:${params.user_id}`);
    oracleCacheService.deleteByPrefix(`recommendations:${params.user_id}`);

    return feedback;
  }

  /**
   * Apply feedback to update pattern confidence
   */
  private async applyFeedback(feedback: PatternFeedback): Promise<number> {
    const pattern = this.patterns.find((p) => p.id === feedback.pattern_id);
    if (!pattern) return 0;

    let confidenceChange = 0;

    switch (feedback.feedback_type) {
      case 'confirm':
      case 'useful':
        confidenceChange = 0.05; // Boost confidence
        break;
      case 'reject':
      case 'not_useful':
        confidenceChange = -0.1; // Reduce confidence
        break;
      case 'modify':
        // Apply suggested changes and slightly boost confidence
        if (feedback.suggested_changes) {
          Object.assign(pattern.pattern_signature, feedback.suggested_changes);
        }
        confidenceChange = 0.02;
        break;
      case 'ignore':
        confidenceChange = -0.02; // Slight reduction
        break;
      case 'timing':
        // Timing feedback - adjust time patterns
        confidenceChange = 0.01;
        break;
      case 'accuracy':
        // Accuracy feedback based on rating
        if (feedback.rating !== undefined) {
          confidenceChange = (feedback.rating - 3) * 0.02; // -0.04 to +0.04
        }
        break;
    }

    // Update pattern confidence with bounds
    pattern.confidence = Math.max(0, Math.min(1, pattern.confidence + confidenceChange));
    pattern.updated_at = new Date().toISOString();

    // Mark as validated if multiple positive feedbacks
    const positiveFeedbackCount = this.feedbacks.filter(
      (f) =>
        f.pattern_id === pattern.id &&
        (f.sentiment === 'positive' || f.feedback_type === 'confirm')
    ).length;

    if (positiveFeedbackCount >= 3 && !pattern.is_validated) {
      pattern.is_validated = true;
    }

    // Deactivate pattern if too much negative feedback
    const negativeFeedbackCount = this.feedbacks.filter(
      (f) =>
        f.pattern_id === pattern.id &&
        (f.sentiment === 'negative' || f.feedback_type === 'reject')
    ).length;

    if (negativeFeedbackCount >= 3 && pattern.confidence < 0.3) {
      pattern.is_active = false;
    }

    return confidenceChange;
  }

  // ============================================================================
  // Recommendations
  // ============================================================================

  /**
   * Get pattern-based recommendations for the user
   */
  async getRecommendations(
    userId: string,
    options: {
      context?: Record<string, any>;
      limit?: number;
      include_timing?: boolean;
      min_confidence?: number;
    } = {}
  ): Promise<PatternRecommendation[]> {
    const limit = options.limit || 5;
    const minConfidence = options.min_confidence || 0.5;
    const includeTiming = options.include_timing !== false;

    const cacheKeyStr = cacheKey('recommendations', userId, hashObject(options));
    const cached = oracleCacheService.get<PatternRecommendation[]>(cacheKeyStr);
    if (cached) {
      return cached;
    }

    const recommendations: PatternRecommendation[] = [];

    // Get active patterns for user
    const userPatterns = this.patterns.filter(
      (p) => p.user_id === userId && p.is_active && p.confidence >= minConfidence
    );

    const now = new Date();
    const currentHour = now.getHours();
    const currentDay = now.getDay();

    for (const pattern of userPatterns) {
      // Check if current time matches pattern timing
      let contextMatch = 0;
      let triggerReason = '';

      // Time-based matching
      if (pattern.time_of_day_distribution) {
        const hourKey = currentHour.toString();
        const hourFrequency = pattern.time_of_day_distribution[hourKey] || 0;
        const maxFrequency = Math.max(...Object.values(pattern.time_of_day_distribution), 1);
        const timeMatch = hourFrequency / maxFrequency;

        if (timeMatch > 0.5) {
          contextMatch += timeMatch * 0.4;
          triggerReason = `You often do this around ${currentHour}:00`;
        }
      }

      // Day-based matching
      if (pattern.day_of_week_distribution) {
        const dayKey = currentDay.toString();
        const dayFrequency = pattern.day_of_week_distribution[dayKey] || 0;
        const maxFrequency = Math.max(...Object.values(pattern.day_of_week_distribution), 1);
        const dayMatch = dayFrequency / maxFrequency;

        if (dayMatch > 0.5) {
          contextMatch += dayMatch * 0.3;
          const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][currentDay];
          triggerReason += triggerReason ? ` on ${dayName}s` : `You often do this on ${dayName}s`;
        }
      }

      // Context matching
      if (options.context && pattern.typical_context) {
        const contextSimilarity = this.calculateContextSimilarity(
          options.context,
          pattern.typical_context
        );
        contextMatch += contextSimilarity * 0.3;

        if (contextSimilarity > 0.5) {
          triggerReason += triggerReason
            ? ' in similar situations'
            : 'Based on your current context';
        }
      }

      if (contextMatch > 0.3 && triggerReason) {
        // Generate recommendation based on pattern type
        const recommendation = this.generateRecommendation(
          pattern,
          contextMatch,
          triggerReason,
          currentHour,
          currentDay,
          includeTiming
        );

        if (recommendation) {
          recommendations.push(recommendation);
        }
      }
    }

    // Sort by confidence * context match and limit
    const sortedRecommendations = recommendations
      .sort((a, b) => b.confidence * b.context_match - a.confidence * a.context_match)
      .slice(0, limit);

    oracleCacheService.set(cacheKeyStr, sortedRecommendations, PATTERN_CACHE_TTL.recommendations);

    return sortedRecommendations;
  }

  /**
   * Generate a recommendation from a pattern
   */
  private generateRecommendation(
    pattern: LearnedPattern,
    contextMatch: number,
    triggerReason: string,
    currentHour: number,
    currentDay: number,
    includeTiming: boolean
  ): PatternRecommendation | null {
    let content: string;
    let recommendationType: 'action' | 'timing' | 'context' | 'warning';
    let priority: 'high' | 'medium' | 'low';
    let optimalTime: string | undefined;

    switch (pattern.pattern_type) {
      case 'routine':
        recommendationType = 'timing';
        content = `Time for your ${pattern.name.toLowerCase()}`;
        priority = pattern.confidence > 0.8 ? 'high' : 'medium';
        break;

      case 'temporal':
        recommendationType = 'timing';
        content = `Based on your pattern: ${pattern.description}`;
        priority = 'medium';
        break;

      case 'sequential':
        recommendationType = 'action';
        const nextAction = this.predictNextAction(pattern);
        content = nextAction
          ? `Next step: ${nextAction}`
          : `Continue with: ${pattern.name}`;
        priority = 'medium';
        break;

      case 'behavioral':
        recommendationType = 'context';
        content = pattern.description || `Consider: ${pattern.name}`;
        priority = 'low';
        break;

      case 'correlation':
        recommendationType = 'context';
        content = `Related activity: ${pattern.description}`;
        priority = 'low';
        break;

      default:
        recommendationType = 'action';
        content = pattern.description || pattern.name;
        priority = 'low';
    }

    // Find optimal time if requested
    if (includeTiming && pattern.time_of_day_distribution) {
      const peakHour = this.findPeakHour(pattern.time_of_day_distribution);
      if (peakHour !== null && Math.abs(peakHour - currentHour) <= 2) {
        const hour12 = peakHour % 12 || 12;
        const ampm = peakHour < 12 ? 'AM' : 'PM';
        optimalTime = `${hour12}:00 ${ampm}`;
      }
    }

    return {
      pattern_id: pattern.id,
      pattern_name: pattern.name,
      recommendation_type: recommendationType,
      content,
      confidence: pattern.confidence,
      trigger_reason: triggerReason,
      optimal_time: optimalTime,
      context_match: contextMatch,
      priority,
    };
  }

  // ============================================================================
  // Event Recording
  // ============================================================================

  /**
   * Record a behavioral event for pattern learning
   */
  async recordEvent(userId: string, event: BehavioralEvent): Promise<void> {
    if (!this.behavioralEvents.has(userId)) {
      this.behavioralEvents.set(userId, []);
    }

    const userEvents = this.behavioralEvents.get(userId)!;
    userEvents.push(event);

    // Keep only recent events (last 30 days)
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const filteredEvents = userEvents.filter(
      (e) => new Date(e.timestamp).getTime() > cutoff
    );
    this.behavioralEvents.set(userId, filteredEvents);

    // Check if event matches existing patterns and record instance
    await this.matchAndRecordInstances(userId, event);

    // Invalidate caches
    oracleCacheService.deleteByPrefix(`patterns:${userId}`);
    oracleCacheService.deleteByPrefix(`recommendations:${userId}`);
  }

  /**
   * Match event against patterns and record instances
   */
  private async matchAndRecordInstances(
    userId: string,
    event: BehavioralEvent
  ): Promise<void> {
    const userPatterns = this.patterns.filter(
      (p) => p.user_id === userId && p.is_active
    );

    const date = new Date(event.timestamp);

    for (const pattern of userPatterns) {
      if (this.matchesPattern(event, pattern)) {
        const matchConfidence = this.calculateMatchConfidence(event, pattern);

        const instance: PatternInstance = {
          id: crypto.randomUUID(),
          pattern_id: pattern.id,
          user_id: userId,
          occurred_at: event.timestamp,
          context: event.context,
          trigger_data: { event_type: event.event_type },
          outcome_data: event.outcome || {},
          match_confidence: matchConfidence,
          related_signals: [],
          related_decisions: [],
          related_actions: [],
          time_of_day: `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`,
          day_of_week: date.getDay(),
          week_of_year: this.getWeekOfYear(date),
          metadata: {},
          created_at: new Date().toISOString(),
        };

        this.instances.push(instance);

        // Update pattern stats
        pattern.observation_count++;
        pattern.support_count++;
        pattern.last_observed_at = event.timestamp;
        pattern.updated_at = new Date().toISOString();
      }
    }
  }

  // ============================================================================
  // Pattern Management
  // ============================================================================

  /**
   * Save a detected pattern
   */
  async savePattern(
    userId: string,
    detected: DetectedPattern
  ): Promise<LearnedPattern> {
    const now = new Date().toISOString();
    const instances = detected.instances;
    const firstTimestamp = instances.length > 0 ? instances[0].timestamp : now;
    const lastTimestamp = instances.length > 0 ? instances[instances.length - 1].timestamp : now;

    const pattern: LearnedPattern = {
      id: crypto.randomUUID(),
      user_id: userId,
      pattern_type: detected.pattern_type,
      name: detected.name,
      description: detected.description,
      pattern_signature: detected.signature,
      trigger_conditions: {},
      typical_context: this.extractCommonContext(instances),
      time_of_day_distribution: detected.time_distribution,
      day_of_week_distribution: detected.day_distribution,
      confidence: detected.confidence,
      support_count: detected.support_count,
      occurrence_rate: this.calculateOccurrenceRate(instances),
      consistency_score: this.calculateConsistencyScore(instances),
      is_active: true,
      is_validated: false,
      first_observed_at: firstTimestamp,
      last_observed_at: lastTimestamp,
      observation_count: instances.length,
      metadata: {},
      created_at: now,
      updated_at: now,
    };

    this.patterns.push(pattern);

    return pattern;
  }

  /**
   * Get patterns for a user
   */
  async getUserPatterns(
    userId: string,
    options: {
      active_only?: boolean;
      validated_only?: boolean;
      pattern_type?: PatternType;
      min_confidence?: number;
      limit?: number;
    } = {}
  ): Promise<LearnedPattern[]> {
    let patterns = this.patterns.filter((p) => p.user_id === userId);

    if (options.active_only !== false) {
      patterns = patterns.filter((p) => p.is_active);
    }

    if (options.validated_only) {
      patterns = patterns.filter((p) => p.is_validated);
    }

    if (options.pattern_type) {
      patterns = patterns.filter((p) => p.pattern_type === options.pattern_type);
    }

    if (options.min_confidence !== undefined) {
      patterns = patterns.filter((p) => p.confidence >= options.min_confidence!);
    }

    // Sort by confidence descending
    patterns.sort((a, b) => b.confidence - a.confidence);

    if (options.limit) {
      patterns = patterns.slice(0, options.limit);
    }

    return patterns;
  }

  /**
   * Get pattern instances
   */
  async getPatternInstances(
    patternId: string,
    options: { limit?: number } = {}
  ): Promise<PatternInstance[]> {
    let instances = this.instances.filter((i) => i.pattern_id === patternId);

    // Sort by occurred_at descending
    instances.sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));

    if (options.limit) {
      instances = instances.slice(0, options.limit);
    }

    return instances;
  }

  /**
   * Deactivate a pattern
   */
  async deactivatePattern(patternId: string, userId: string): Promise<boolean> {
    const pattern = this.patterns.find(
      (p) => p.id === patternId && p.user_id === userId
    );

    if (!pattern) return false;

    pattern.is_active = false;
    pattern.updated_at = new Date().toISOString();

    return true;
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private getUserEvents(userId: string, lookbackHours: number): BehavioralEvent[] {
    const userEvents = this.behavioralEvents.get(userId) || [];
    const cutoff = Date.now() - lookbackHours * 60 * 60 * 1000;

    return userEvents.filter(
      (e) => new Date(e.timestamp).getTime() > cutoff
    );
  }

  private groupEventsByType(events: BehavioralEvent[]): Record<string, BehavioralEvent[]> {
    const groups: Record<string, BehavioralEvent[]> = {};

    for (const event of events) {
      if (!groups[event.event_type]) {
        groups[event.event_type] = [];
      }
      groups[event.event_type].push(event);
    }

    return groups;
  }

  private calculateTimeDistribution(events: BehavioralEvent[]): TimeDistribution {
    const distribution: TimeDistribution = {};

    for (let h = 0; h < 24; h++) {
      distribution[h.toString()] = 0;
    }

    for (const event of events) {
      const hour = new Date(event.timestamp).getHours();
      distribution[hour.toString()]++;
    }

    return distribution;
  }

  private calculateDayDistribution(events: BehavioralEvent[]): DayDistribution {
    const distribution: DayDistribution = {};

    for (let d = 0; d < 7; d++) {
      distribution[d.toString()] = 0;
    }

    for (const event of events) {
      const day = new Date(event.timestamp).getDay();
      distribution[day.toString()]++;
    }

    return distribution;
  }

  private findPeakPeriods(
    distribution: TimeDistribution | DayDistribution,
    type: 'hour' | 'day'
  ): number[] {
    const values = Object.values(distribution);
    const total = values.reduce((a, b) => a + b, 0);
    if (total === 0) return [];

    const average = total / values.length;
    const threshold = average * 1.5; // 50% above average

    return Object.entries(distribution)
      .filter(([_, count]) => count > threshold)
      .map(([period, _]) => parseInt(period, 10));
  }

  private calculateTemporalConfidence(
    timeDistribution: TimeDistribution,
    dayDistribution: DayDistribution,
    totalEvents: number
  ): number {
    // Higher confidence if events are concentrated in specific times/days
    const timeValues = Object.values(timeDistribution);
    const dayValues = Object.values(dayDistribution);

    const timeConcentration = this.calculateConcentration(timeValues);
    const dayConcentration = this.calculateConcentration(dayValues);

    // Boost for sample size
    const sampleBoost = Math.min(1, totalEvents / (DETECTION_THRESHOLDS.min_occurrences * 2));

    return (timeConcentration * 0.4 + dayConcentration * 0.4 + sampleBoost * 0.2);
  }

  private calculateConcentration(values: number[]): number {
    const total = values.reduce((a, b) => a + b, 0);
    if (total === 0) return 0;

    // Calculate Gini coefficient (0 = perfectly even, 1 = perfectly concentrated)
    const sorted = [...values].sort((a, b) => a - b);
    const n = sorted.length;
    let sum = 0;

    for (let i = 0; i < n; i++) {
      sum += (2 * (i + 1) - n - 1) * sorted[i];
    }

    const gini = sum / (n * total);
    return Math.max(0, Math.min(1, gini));
  }

  private generateTemporalDescription(
    eventType: string,
    peakHours: number[],
    peakDays: number[]
  ): string {
    const parts: string[] = [];

    if (peakHours.length > 0) {
      const hourRanges = this.compressToRanges(peakHours);
      const hourDesc = hourRanges.map((r) => {
        const start = r.start % 12 || 12;
        const end = r.end % 12 || 12;
        const startAmpm = r.start < 12 ? 'AM' : 'PM';
        const endAmpm = r.end < 12 ? 'AM' : 'PM';

        if (r.start === r.end) {
          return `${start}${startAmpm}`;
        }
        return `${start}${startAmpm}-${end}${endAmpm}`;
      });
      parts.push(`around ${hourDesc.join(', ')}`);
    }

    if (peakDays.length > 0) {
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const days = peakDays.map((d) => dayNames[d]).join(', ');
      parts.push(`on ${days}`);
    }

    return `${eventType} typically occurs ${parts.join(' ')}`;
  }

  private compressToRanges(numbers: number[]): Array<{ start: number; end: number }> {
    if (numbers.length === 0) return [];

    const sorted = [...numbers].sort((a, b) => a - b);
    const ranges: Array<{ start: number; end: number }> = [];

    let start = sorted[0];
    let end = sorted[0];

    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === end + 1) {
        end = sorted[i];
      } else {
        ranges.push({ start, end });
        start = sorted[i];
        end = sorted[i];
      }
    }

    ranges.push({ start, end });
    return ranges;
  }

  private extractSequences(events: BehavioralEvent[], windowMinutes: number): BehavioralEvent[][] {
    const sequences: BehavioralEvent[][] = [];
    let currentSequence: BehavioralEvent[] = [];

    for (const event of events) {
      if (currentSequence.length === 0) {
        currentSequence.push(event);
      } else {
        const lastEvent = currentSequence[currentSequence.length - 1];
        const timeDiff =
          (new Date(event.timestamp).getTime() - new Date(lastEvent.timestamp).getTime()) / (1000 * 60);

        if (timeDiff <= windowMinutes) {
          currentSequence.push(event);
        } else {
          if (currentSequence.length >= 2) {
            sequences.push([...currentSequence]);
          }
          currentSequence = [event];
        }
      }
    }

    if (currentSequence.length >= 2) {
      sequences.push(currentSequence);
    }

    return sequences;
  }

  private calculateSequenceConfidence(
    occurrences: number,
    totalSequences: number
  ): number {
    if (totalSequences === 0) return 0;

    const frequency = occurrences / totalSequences;
    const sampleBoost = Math.min(1, occurrences / (DETECTION_THRESHOLDS.min_occurrences * 2));

    return frequency * 0.7 + sampleBoost * 0.3;
  }

  private clusterByContext(events: BehavioralEvent[]): Array<{
    events: BehavioralEvent[];
    commonContext: Record<string, any>;
    contextDescription: string;
  }> {
    // Simple clustering by common context keys
    const clusters = new Map<string, BehavioralEvent[]>();

    for (const event of events) {
      const contextKey = this.getContextKey(event.context);
      if (!clusters.has(contextKey)) {
        clusters.set(contextKey, []);
      }
      clusters.get(contextKey)!.push(event);
    }

    return Array.from(clusters.entries()).map(([key, clusterEvents]) => ({
      events: clusterEvents,
      commonContext: this.extractCommonContext(clusterEvents),
      contextDescription: key || 'unspecified context',
    }));
  }

  private getContextKey(context: Record<string, any>): string {
    const significantKeys = ['location', 'device', 'app', 'category', 'type'];
    const parts: string[] = [];

    for (const key of significantKeys) {
      if (context[key]) {
        parts.push(`${key}:${context[key]}`);
      }
    }

    return parts.join(', ') || 'general';
  }

  private extractCommonContext(events: BehavioralEvent[]): Record<string, any> {
    if (events.length === 0) return {};

    const contextCounts = new Map<string, Map<any, number>>();

    for (const event of events) {
      for (const [key, value] of Object.entries(event.context)) {
        if (!contextCounts.has(key)) {
          contextCounts.set(key, new Map());
        }
        const valueMap = contextCounts.get(key)!;
        valueMap.set(value, (valueMap.get(value) || 0) + 1);
      }
    }

    const commonContext: Record<string, any> = {};
    const threshold = events.length * 0.5; // 50% of events must have the same value

    for (const [key, valueMap] of contextCounts.entries()) {
      for (const [value, count] of valueMap.entries()) {
        if (count >= threshold) {
          commonContext[key] = value;
          break;
        }
      }
    }

    return commonContext;
  }

  private calculateContextConfidence(
    events: BehavioralEvent[],
    commonContext: Record<string, any>
  ): number {
    if (events.length === 0) return 0;

    const contextKeys = Object.keys(commonContext);
    if (contextKeys.length === 0) return 0.3; // Low confidence if no common context

    let matchSum = 0;

    for (const event of events) {
      let matchCount = 0;
      for (const key of contextKeys) {
        if (event.context[key] === commonContext[key]) {
          matchCount++;
        }
      }
      matchSum += matchCount / contextKeys.length;
    }

    return matchSum / events.length;
  }

  private findDominantEventType(events: BehavioralEvent[]): string {
    const typeCounts = new Map<string, number>();

    for (const event of events) {
      typeCounts.set(event.event_type, (typeCounts.get(event.event_type) || 0) + 1);
    }

    let maxCount = 0;
    let dominantType = 'activity';

    for (const [type, count] of typeCounts.entries()) {
      if (count > maxCount) {
        maxCount = count;
        dominantType = type;
      }
    }

    return dominantType;
  }

  private matchesPattern(event: BehavioralEvent, pattern: LearnedPattern): boolean {
    const signature = pattern.pattern_signature;

    // Check event type match
    if (signature.event_types && signature.event_types.length > 0) {
      if (!signature.event_types.includes(event.event_type)) {
        return false;
      }
    }

    // Check time pattern match
    if (signature.time_pattern) {
      const eventDate = new Date(event.timestamp);
      const eventHour = eventDate.getHours();
      const eventDay = eventDate.getDay();

      if (signature.time_pattern.hour_ranges) {
        const inRange = signature.time_pattern.hour_ranges.some(
          (r) => eventHour >= r.start && eventHour <= r.end
        );
        if (!inRange) return false;
      }

      if (signature.time_pattern.days_of_week) {
        if (!signature.time_pattern.days_of_week.includes(eventDay)) {
          return false;
        }
      }
    }

    // Check context requirements
    if (signature.context_requirements) {
      for (const [key, value] of Object.entries(signature.context_requirements)) {
        if (event.context[key] !== value) {
          return false;
        }
      }
    }

    return true;
  }

  private calculateMatchConfidence(
    event: BehavioralEvent,
    pattern: LearnedPattern
  ): number {
    let matchScore = 0;
    let factors = 0;

    const eventDate = new Date(event.timestamp);
    const eventHour = eventDate.getHours();
    const eventDay = eventDate.getDay();

    // Time distribution match
    if (pattern.time_of_day_distribution) {
      const hourFreq = pattern.time_of_day_distribution[eventHour.toString()] || 0;
      const maxFreq = Math.max(...Object.values(pattern.time_of_day_distribution), 1);
      matchScore += hourFreq / maxFreq;
      factors++;
    }

    // Day distribution match
    if (pattern.day_of_week_distribution) {
      const dayFreq = pattern.day_of_week_distribution[eventDay.toString()] || 0;
      const maxFreq = Math.max(...Object.values(pattern.day_of_week_distribution), 1);
      matchScore += dayFreq / maxFreq;
      factors++;
    }

    // Context match
    if (pattern.typical_context && Object.keys(pattern.typical_context).length > 0) {
      const contextSim = this.calculateContextSimilarity(event.context, pattern.typical_context);
      matchScore += contextSim;
      factors++;
    }

    return factors > 0 ? matchScore / factors : 0.5;
  }

  private calculateContextSimilarity(
    context1: Record<string, any>,
    context2: Record<string, any>
  ): number {
    const keys1 = Object.keys(context1);
    const keys2 = Object.keys(context2);
    const allKeys = new Set([...keys1, ...keys2]);

    if (allKeys.size === 0) return 1;

    let matches = 0;

    for (const key of allKeys) {
      if (context1[key] === context2[key]) {
        matches++;
      }
    }

    return matches / allKeys.size;
  }

  private calculateOccurrenceRate(events: BehavioralEvent[]): number {
    if (events.length < 2) return 0;

    const timestamps = events.map((e) => new Date(e.timestamp).getTime()).sort((a, b) => a - b);
    const firstTime = timestamps[0];
    const lastTime = timestamps[timestamps.length - 1];
    const durationDays = (lastTime - firstTime) / (24 * 60 * 60 * 1000);

    return durationDays > 0 ? events.length / durationDays : 0;
  }

  private calculateConsistencyScore(events: BehavioralEvent[]): number {
    if (events.length < 3) return 0.5;

    // Calculate variance in timing
    const hours = events.map((e) => new Date(e.timestamp).getHours());
    const avgHour = hours.reduce((a, b) => a + b, 0) / hours.length;
    const variance = hours.reduce((sum, h) => sum + Math.pow(h - avgHour, 2), 0) / hours.length;
    const stdDev = Math.sqrt(variance);

    // Normalize: lower std dev = higher consistency
    return Math.max(0, Math.min(1, 1 - stdDev / 12));
  }

  private predictNextAction(pattern: LearnedPattern): string | null {
    const sequence = pattern.pattern_signature.action_sequence;
    if (!sequence || sequence.length < 2) return null;

    // For now, just return the last action in the sequence
    return sequence[sequence.length - 1];
  }

  private findPeakHour(distribution: TimeDistribution): number | null {
    let maxCount = 0;
    let peakHour: number | null = null;

    for (const [hour, count] of Object.entries(distribution)) {
      if (count > maxCount) {
        maxCount = count;
        peakHour = parseInt(hour, 10);
      }
    }

    return peakHour;
  }

  private getWeekOfYear(date: Date): number {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / (24 * 60 * 60 * 1000);
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  }
}

// Singleton instance
export const patternLearningService = new PatternLearningService();
