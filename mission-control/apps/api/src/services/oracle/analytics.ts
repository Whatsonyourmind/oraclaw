/**
 * ORACLE Analytics Service
 * Story adv-4 - Metrics aggregation and analytics tracking
 */

import type {
  AnalyticsEvent,
  AnalyticsEventType,
  AnalyticsEventCategory,
  PredictionAccuracyRecord,
  EngagementMetrics,
  SystemHealthMetrics,
  AnalyticsDashboardData,
  PredictionAccuracyCategory,
} from '@mission-control/shared-types';
import { oracleCacheService, cacheKey, hashObject } from './cache';

// Cache TTLs for analytics
const ANALYTICS_CACHE_TTL = {
  dashboard: 5 * 60 * 1000, // 5 minutes
  predictions: 10 * 60 * 1000, // 10 minutes
  engagement: 5 * 60 * 1000, // 5 minutes
  health: 1 * 60 * 1000, // 1 minute
};

interface TrackEventParams {
  user_id: string;
  event_type: AnalyticsEventType;
  event_category: AnalyticsEventCategory;
  payload?: Record<string, any>;
  entity_type?: string;
  entity_id?: string;
  session_id?: string;
  device_id?: string;
  duration_ms?: number;
  metadata?: Record<string, any>;
}

interface DashboardQueryParams {
  user_id: string;
  start_date: string;
  end_date: string;
  granularity?: 'hour' | 'day' | 'week' | 'month';
}

interface AccuracyQueryParams {
  user_id: string;
  category?: PredictionAccuracyCategory;
  start_date?: string;
  end_date?: string;
  limit?: number;
  offset?: number;
}

interface EngagementQueryParams {
  user_id: string;
  start_date?: string;
  end_date?: string;
  platform?: string;
  limit?: number;
  offset?: number;
}

interface HealthQueryParams {
  metric_type?: string;
  endpoint?: string;
  start_date?: string;
  end_date?: string;
  limit?: number;
}

export class OracleAnalyticsService {
  // In-memory store for demo (would use Supabase in production)
  private events: AnalyticsEvent[] = [];
  private accuracyRecords: PredictionAccuracyRecord[] = [];
  private engagementSessions: EngagementMetrics[] = [];
  private healthMetrics: SystemHealthMetrics[] = [];

  /**
   * Track an analytics event
   */
  async trackEvent(params: TrackEventParams): Promise<AnalyticsEvent> {
    const event: AnalyticsEvent = {
      id: crypto.randomUUID(),
      user_id: params.user_id,
      event_type: params.event_type,
      event_category: params.event_category,
      payload: params.payload || {},
      entity_type: params.entity_type,
      entity_id: params.entity_id,
      session_id: params.session_id,
      device_id: params.device_id,
      duration_ms: params.duration_ms,
      metadata: params.metadata || {},
      created_at: new Date().toISOString(),
    };

    // In production: await supabase.from('oracle_analytics_events').insert(event);
    this.events.push(event);

    // Invalidate dashboard cache for this user
    this.invalidateDashboardCache(params.user_id);

    return event;
  }

  /**
   * Track multiple events at once
   */
  async trackEvents(events: TrackEventParams[]): Promise<AnalyticsEvent[]> {
    const trackedEvents = await Promise.all(events.map((e) => this.trackEvent(e)));
    return trackedEvents;
  }

  /**
   * Record prediction accuracy
   */
  async recordPredictionAccuracy(params: {
    user_id: string;
    prediction_id?: string;
    category: PredictionAccuracyCategory;
    predicted_value?: number;
    actual_value?: number;
    confidence_at_prediction: number;
    time_horizon_hours?: number;
    factors_snapshot?: Record<string, any>;
  }): Promise<PredictionAccuracyRecord> {
    const delta = params.predicted_value !== undefined && params.actual_value !== undefined
      ? params.actual_value - params.predicted_value
      : undefined;

    const absoluteError = delta !== undefined ? Math.abs(delta) : undefined;
    const percentageError = params.predicted_value && absoluteError !== undefined
      ? (absoluteError / params.predicted_value) * 100
      : undefined;

    const accuracyThreshold = 0.1; // 10% default threshold
    const isAccurate = percentageError !== undefined
      ? percentageError <= accuracyThreshold * 100
      : undefined;

    const record: PredictionAccuracyRecord = {
      id: crypto.randomUUID(),
      user_id: params.user_id,
      prediction_id: params.prediction_id,
      category: params.category,
      predicted_value: params.predicted_value,
      actual_value: params.actual_value,
      delta,
      absolute_error: absoluteError,
      percentage_error: percentageError,
      confidence_at_prediction: params.confidence_at_prediction,
      time_horizon_hours: params.time_horizon_hours,
      factors_snapshot: params.factors_snapshot || {},
      is_accurate: isAccurate,
      accuracy_threshold: accuracyThreshold,
      metadata: {},
      created_at: new Date().toISOString(),
    };

    // In production: await supabase.from('oracle_prediction_accuracy').insert(record);
    this.accuracyRecords.push(record);

    return record;
  }

  /**
   * Get aggregated dashboard metrics
   */
  async getDashboardMetrics(params: DashboardQueryParams): Promise<AnalyticsDashboardData> {
    const cacheKeyStr = cacheKey('dashboard', params.user_id, hashObject(params));

    // Check cache first
    const cached = oracleCacheService.get<AnalyticsDashboardData>(cacheKeyStr);
    if (cached) {
      return cached;
    }

    // Filter events by user and date range
    const userEvents = this.events.filter(
      (e) =>
        e.user_id === params.user_id &&
        e.created_at >= params.start_date &&
        e.created_at <= params.end_date
    );

    // Calculate feature usage by category
    const featureUsage = {
      observe: userEvents.filter((e) => e.event_category === 'observe').length,
      orient: userEvents.filter((e) => e.event_category === 'orient').length,
      decide: userEvents.filter((e) => e.event_category === 'decide').length,
      act: userEvents.filter((e) => e.event_category === 'act').length,
      probability: userEvents.filter((e) => e.event_category === 'prediction').length,
    };

    // Calculate accuracy metrics
    const userAccuracyRecords = this.accuracyRecords.filter(
      (r) =>
        r.user_id === params.user_id &&
        r.created_at >= params.start_date &&
        r.created_at <= params.end_date
    );

    const totalPredictions = userAccuracyRecords.length;
    const accuratePredictions = userAccuracyRecords.filter((r) => r.is_accurate).length;
    const accuracyRate = totalPredictions > 0 ? accuratePredictions / totalPredictions : 0;

    // Calculate decisions completed
    const decisionsCompleted = userEvents.filter(
      (e) => e.event_type === 'decide_decision_made'
    ).length;

    // Calculate sessions today
    const today = new Date().toISOString().split('T')[0];
    const sessionsToday = this.engagementSessions.filter(
      (s) => s.user_id === params.user_id && s.session_start.startsWith(today)
    ).length;

    // Generate accuracy trend by granularity
    const accuracyTrend = this.calculateAccuracyTrend(
      userAccuracyRecords,
      params.granularity || 'day'
    );

    // Calculate top signal types
    const signalEvents = userEvents.filter((e) => e.event_type === 'observe_signal_detected');
    const signalTypeCounts: Record<string, number> = {};
    signalEvents.forEach((e) => {
      const signalType = e.payload?.signal_type || 'unknown';
      signalTypeCounts[signalType] = (signalTypeCounts[signalType] || 0) + 1;
    });

    const totalSignals = signalEvents.length;
    const topSignalTypes = Object.entries(signalTypeCounts)
      .map(([type, count]) => ({
        type,
        count,
        percentage: totalSignals > 0 ? (count / totalSignals) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Get system health summary
    const healthSummary = await this.getSystemHealthSummary();

    const dashboard: AnalyticsDashboardData = {
      total_predictions: totalPredictions,
      accuracy_rate: accuracyRate,
      total_decisions_completed: decisionsCompleted,
      active_sessions_today: sessionsToday,
      prediction_accuracy_trend: accuracyTrend,
      feature_usage: featureUsage,
      system_health: healthSummary,
      top_signal_types: topSignalTypes,
      period_start: params.start_date,
      period_end: params.end_date,
    };

    // Cache the result
    oracleCacheService.set(cacheKeyStr, dashboard, ANALYTICS_CACHE_TTL.dashboard);

    return dashboard;
  }

  /**
   * Get prediction accuracy records with aggregated stats
   */
  async getPredictionAccuracy(params: AccuracyQueryParams): Promise<{
    records: PredictionAccuracyRecord[];
    aggregate: {
      total_predictions: number;
      accurate_predictions: number;
      accuracy_rate: number;
      avg_confidence: number;
      avg_absolute_error: number;
      by_category: Record<string, { count: number; accuracy: number }>;
    };
  }> {
    const cacheKeyStr = cacheKey('accuracy', params.user_id, hashObject(params));

    const cached = oracleCacheService.get<ReturnType<typeof this.getPredictionAccuracy>>(cacheKeyStr);
    if (cached) {
      return cached as any;
    }

    // Filter records
    let records = this.accuracyRecords.filter((r) => r.user_id === params.user_id);

    if (params.category) {
      records = records.filter((r) => r.category === params.category);
    }
    if (params.start_date) {
      records = records.filter((r) => r.created_at >= params.start_date!);
    }
    if (params.end_date) {
      records = records.filter((r) => r.created_at <= params.end_date!);
    }

    // Sort by created_at descending
    records.sort((a, b) => b.created_at.localeCompare(a.created_at));

    // Apply pagination
    const offset = params.offset || 0;
    const limit = params.limit || 100;
    const paginatedRecords = records.slice(offset, offset + limit);

    // Calculate aggregate stats
    const totalPredictions = records.length;
    const accuratePredictions = records.filter((r) => r.is_accurate).length;
    const accuracyRate = totalPredictions > 0 ? accuratePredictions / totalPredictions : 0;

    const confidenceSum = records.reduce((sum, r) => sum + r.confidence_at_prediction, 0);
    const avgConfidence = totalPredictions > 0 ? confidenceSum / totalPredictions : 0;

    const errorsWithValues = records.filter((r) => r.absolute_error !== undefined);
    const errorSum = errorsWithValues.reduce((sum, r) => sum + (r.absolute_error || 0), 0);
    const avgAbsoluteError = errorsWithValues.length > 0 ? errorSum / errorsWithValues.length : 0;

    // Calculate by category
    const byCategory: Record<string, { count: number; accuracy: number }> = {};
    const categories: PredictionAccuracyCategory[] = [
      'task_completion',
      'deadline_risk',
      'resource_availability',
      'outcome_likelihood',
      'duration_estimate',
      'custom',
    ];

    for (const cat of categories) {
      const catRecords = records.filter((r) => r.category === cat);
      const catAccurate = catRecords.filter((r) => r.is_accurate).length;
      byCategory[cat] = {
        count: catRecords.length,
        accuracy: catRecords.length > 0 ? catAccurate / catRecords.length : 0,
      };
    }

    const result = {
      records: paginatedRecords,
      aggregate: {
        total_predictions: totalPredictions,
        accurate_predictions: accuratePredictions,
        accuracy_rate: accuracyRate,
        avg_confidence: avgConfidence,
        avg_absolute_error: avgAbsoluteError,
        by_category: byCategory,
      },
    };

    oracleCacheService.set(cacheKeyStr, result, ANALYTICS_CACHE_TTL.predictions);

    return result;
  }

  /**
   * Get user engagement metrics
   */
  async getEngagementMetrics(params: EngagementQueryParams): Promise<{
    sessions: EngagementMetrics[];
    aggregate: {
      total_sessions: number;
      avg_session_duration_seconds: number;
      total_active_time_seconds: number;
      feature_usage_totals: Record<string, number>;
      completion_rates: Record<string, number>;
      most_visited_screens: Array<{ screen: string; count: number }>;
      platform_breakdown: Record<string, number>;
    };
  }> {
    const cacheKeyStr = cacheKey('engagement', params.user_id, hashObject(params));

    const cached = oracleCacheService.get<ReturnType<typeof this.getEngagementMetrics>>(cacheKeyStr);
    if (cached) {
      return cached as any;
    }

    // Filter sessions
    let sessions = this.engagementSessions.filter((s) => s.user_id === params.user_id);

    if (params.start_date) {
      sessions = sessions.filter((s) => s.session_start >= params.start_date!);
    }
    if (params.end_date) {
      sessions = sessions.filter((s) => s.session_start <= params.end_date!);
    }
    if (params.platform) {
      sessions = sessions.filter((s) => s.platform === params.platform);
    }

    // Sort by session_start descending
    sessions.sort((a, b) => b.session_start.localeCompare(a.session_start));

    // Apply pagination
    const offset = params.offset || 0;
    const limit = params.limit || 50;
    const paginatedSessions = sessions.slice(offset, offset + limit);

    // Calculate aggregates
    const totalSessions = sessions.length;
    const totalDuration = sessions.reduce(
      (sum, s) => sum + (s.session_duration_seconds || 0),
      0
    );
    const avgSessionDuration = totalSessions > 0 ? totalDuration / totalSessions : 0;
    const totalActiveTime = sessions.reduce((sum, s) => sum + s.active_time_seconds, 0);

    // Feature usage totals
    const featureUsageTotals = {
      observe_scans: sessions.reduce((sum, s) => sum + s.observe_scans, 0),
      signals_viewed: sessions.reduce((sum, s) => sum + s.signals_viewed, 0),
      decisions_created: sessions.reduce((sum, s) => sum + s.decisions_created, 0),
      decisions_completed: sessions.reduce((sum, s) => sum + s.decisions_completed, 0),
      simulations_run: sessions.reduce((sum, s) => sum + s.simulations_run, 0),
      plans_created: sessions.reduce((sum, s) => sum + s.plans_created, 0),
      steps_completed: sessions.reduce((sum, s) => sum + s.steps_completed, 0),
    };

    // Completion rates
    const totalDecisionsCreated = featureUsageTotals.decisions_created;
    const totalDecisionsCompleted = featureUsageTotals.decisions_completed;
    const totalPlansCreated = featureUsageTotals.plans_created;
    const plansExecuted = sessions.reduce((sum, s) => sum + s.plans_executed, 0);
    const tasksCompleted = sessions.reduce((sum, s) => sum + s.tasks_completed, 0);

    const completionRates = {
      decisions:
        totalDecisionsCreated > 0 ? totalDecisionsCompleted / totalDecisionsCreated : 0,
      plans: totalPlansCreated > 0 ? plansExecuted / totalPlansCreated : 0,
      tasks: tasksCompleted, // Absolute number since we don't track tasks created
    };

    // Most visited screens
    const screenCounts: Record<string, number> = {};
    sessions.forEach((s) => {
      s.screens_visited.forEach((screen) => {
        screenCounts[screen] = (screenCounts[screen] || 0) + 1;
      });
    });
    const mostVisitedScreens = Object.entries(screenCounts)
      .map(([screen, count]) => ({ screen, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Platform breakdown
    const platformBreakdown: Record<string, number> = {};
    sessions.forEach((s) => {
      const platform = s.platform || 'unknown';
      platformBreakdown[platform] = (platformBreakdown[platform] || 0) + 1;
    });

    const result = {
      sessions: paginatedSessions,
      aggregate: {
        total_sessions: totalSessions,
        avg_session_duration_seconds: avgSessionDuration,
        total_active_time_seconds: totalActiveTime,
        feature_usage_totals: featureUsageTotals,
        completion_rates: completionRates,
        most_visited_screens: mostVisitedScreens,
        platform_breakdown: platformBreakdown,
      },
    };

    oracleCacheService.set(cacheKeyStr, result, ANALYTICS_CACHE_TTL.engagement);

    return result;
  }

  /**
   * Record system health metrics
   */
  async recordHealthMetrics(params: Omit<SystemHealthMetrics, 'id' | 'created_at'>): Promise<SystemHealthMetrics> {
    const metrics: SystemHealthMetrics = {
      id: crypto.randomUUID(),
      ...params,
      created_at: new Date().toISOString(),
    };

    // In production: await supabase.from('oracle_system_health').insert(metrics);
    this.healthMetrics.push(metrics);

    return metrics;
  }

  /**
   * Get system health metrics
   */
  async getSystemHealthMetrics(params: HealthQueryParams): Promise<{
    metrics: SystemHealthMetrics[];
    current: {
      status: 'healthy' | 'degraded' | 'critical';
      services: Record<string, { status: string; latency_p50: number }>;
      overall_error_rate: number;
      overall_success_rate: number;
      avg_response_time_ms: number;
      requests_last_hour: number;
    };
  }> {
    const cacheKeyStr = cacheKey('health', hashObject(params));

    const cached = oracleCacheService.get<ReturnType<typeof this.getSystemHealthMetrics>>(cacheKeyStr);
    if (cached) {
      return cached as any;
    }

    // Filter metrics
    let metrics = [...this.healthMetrics];

    if (params.metric_type) {
      metrics = metrics.filter((m) => m.metric_type === params.metric_type);
    }
    if (params.endpoint) {
      metrics = metrics.filter((m) => m.endpoint === params.endpoint);
    }
    if (params.start_date) {
      metrics = metrics.filter((m) => m.bucket_start >= params.start_date!);
    }
    if (params.end_date) {
      metrics = metrics.filter((m) => m.bucket_end <= params.end_date!);
    }

    // Sort by bucket_start descending
    metrics.sort((a, b) => b.bucket_start.localeCompare(a.bucket_start));

    // Apply limit
    const limit = params.limit || 100;
    const limitedMetrics = metrics.slice(0, limit);

    // Calculate current health status
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const recentMetrics = this.healthMetrics.filter((m) => m.bucket_start >= oneHourAgo);

    const totalRequests = recentMetrics.reduce((sum, m) => sum + m.request_count, 0);
    const totalErrors = recentMetrics.reduce((sum, m) => sum + m.error_count, 0);
    const totalSuccess = recentMetrics.reduce((sum, m) => sum + m.success_count, 0);

    const overallErrorRate = totalRequests > 0 ? totalErrors / totalRequests : 0;
    const overallSuccessRate = totalRequests > 0 ? totalSuccess / totalRequests : 1;

    const latencies = recentMetrics
      .filter((m) => m.latency_avg !== undefined)
      .map((m) => m.latency_avg!);
    const avgResponseTime =
      latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;

    // Determine overall status
    let status: 'healthy' | 'degraded' | 'critical' = 'healthy';
    if (overallErrorRate > 0.1) {
      status = 'critical';
    } else if (overallErrorRate > 0.05 || avgResponseTime > 1000) {
      status = 'degraded';
    }

    // Calculate per-service status
    const serviceMetrics: Record<string, SystemHealthMetrics[]> = {};
    recentMetrics.forEach((m) => {
      const service = m.service;
      if (!serviceMetrics[service]) {
        serviceMetrics[service] = [];
      }
      serviceMetrics[service].push(m);
    });

    const services: Record<string, { status: string; latency_p50: number }> = {};
    for (const [service, sMetrics] of Object.entries(serviceMetrics)) {
      const p50s = sMetrics.filter((m) => m.latency_p50).map((m) => m.latency_p50!);
      const avgP50 = p50s.length > 0 ? p50s.reduce((a, b) => a + b, 0) / p50s.length : 0;
      const sErrors = sMetrics.reduce((sum, m) => sum + m.error_count, 0);
      const sTotal = sMetrics.reduce((sum, m) => sum + m.request_count, 0);
      const sErrorRate = sTotal > 0 ? sErrors / sTotal : 0;

      let sStatus = 'healthy';
      if (sErrorRate > 0.1) sStatus = 'critical';
      else if (sErrorRate > 0.05) sStatus = 'degraded';

      services[service] = { status: sStatus, latency_p50: avgP50 };
    }

    const result = {
      metrics: limitedMetrics,
      current: {
        status,
        services,
        overall_error_rate: overallErrorRate,
        overall_success_rate: overallSuccessRate,
        avg_response_time_ms: avgResponseTime,
        requests_last_hour: totalRequests,
      },
    };

    oracleCacheService.set(cacheKeyStr, result, ANALYTICS_CACHE_TTL.health);

    return result;
  }

  /**
   * Start a new engagement session
   */
  async startSession(params: {
    user_id: string;
    session_id?: string;
    device_id?: string;
    platform?: string;
    app_version?: string;
  }): Promise<EngagementMetrics> {
    const session: EngagementMetrics = {
      id: crypto.randomUUID(),
      user_id: params.user_id,
      session_id: params.session_id || crypto.randomUUID(),
      session_start: new Date().toISOString(),
      device_id: params.device_id,
      platform: params.platform,
      app_version: params.app_version,
      observe_scans: 0,
      signals_viewed: 0,
      signals_acknowledged: 0,
      contexts_generated: 0,
      decisions_created: 0,
      decisions_completed: 0,
      simulations_run: 0,
      plans_created: 0,
      steps_completed: 0,
      predictions_viewed: 0,
      ghost_actions_reviewed: 0,
      active_time_seconds: 0,
      screens_visited: [],
      actions_taken: 0,
      api_calls_made: 0,
      errors_encountered: 0,
      tasks_completed: 0,
      decisions_finalized: 0,
      plans_executed: 0,
      metadata: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // In production: await supabase.from('oracle_user_engagement').insert(session);
    this.engagementSessions.push(session);

    return session;
  }

  /**
   * Update an engagement session
   */
  async updateSession(
    sessionId: string,
    updates: Partial<EngagementMetrics>
  ): Promise<EngagementMetrics | null> {
    const index = this.engagementSessions.findIndex((s) => s.session_id === sessionId);
    if (index === -1) return null;

    const session = this.engagementSessions[index];
    const updated = {
      ...session,
      ...updates,
      updated_at: new Date().toISOString(),
    };

    this.engagementSessions[index] = updated;

    // Invalidate engagement cache
    oracleCacheService.deleteByPrefix(`engagement:${session.user_id}`);

    return updated;
  }

  /**
   * End an engagement session
   */
  async endSession(sessionId: string): Promise<EngagementMetrics | null> {
    const index = this.engagementSessions.findIndex((s) => s.session_id === sessionId);
    if (index === -1) return null;

    const session = this.engagementSessions[index];
    const sessionEnd = new Date().toISOString();
    const sessionStart = new Date(session.session_start);
    const durationSeconds = Math.floor(
      (new Date(sessionEnd).getTime() - sessionStart.getTime()) / 1000
    );

    const updated = {
      ...session,
      session_end: sessionEnd,
      session_duration_seconds: durationSeconds,
      updated_at: sessionEnd,
    };

    this.engagementSessions[index] = updated;

    return updated;
  }

  // Private helper methods

  private invalidateDashboardCache(userId: string): void {
    oracleCacheService.deleteByPrefix(`dashboard:${userId}`);
  }

  private calculateAccuracyTrend(
    records: PredictionAccuracyRecord[],
    granularity: 'hour' | 'day' | 'week' | 'month'
  ): Array<{ date: string; accuracy: number; count: number }> {
    const buckets: Record<string, { accurate: number; total: number }> = {};

    records.forEach((record) => {
      const date = new Date(record.created_at);
      let bucketKey: string;

      switch (granularity) {
        case 'hour':
          bucketKey = `${date.toISOString().slice(0, 13)}:00:00`;
          break;
        case 'day':
          bucketKey = date.toISOString().slice(0, 10);
          break;
        case 'week':
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          bucketKey = weekStart.toISOString().slice(0, 10);
          break;
        case 'month':
          bucketKey = date.toISOString().slice(0, 7);
          break;
      }

      if (!buckets[bucketKey]) {
        buckets[bucketKey] = { accurate: 0, total: 0 };
      }

      buckets[bucketKey].total++;
      if (record.is_accurate) {
        buckets[bucketKey].accurate++;
      }
    });

    return Object.entries(buckets)
      .map(([date, { accurate, total }]) => ({
        date,
        accuracy: total > 0 ? accurate / total : 0,
        count: total,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  private async getSystemHealthSummary(): Promise<{
    status: 'healthy' | 'degraded' | 'critical';
    avg_latency_ms: number;
    error_rate: number;
    uptime_percentage: number;
  }> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const recentMetrics = this.healthMetrics.filter((m) => m.bucket_start >= oneHourAgo);

    if (recentMetrics.length === 0) {
      return {
        status: 'healthy',
        avg_latency_ms: 0,
        error_rate: 0,
        uptime_percentage: 100,
      };
    }

    const totalRequests = recentMetrics.reduce((sum, m) => sum + m.request_count, 0);
    const totalErrors = recentMetrics.reduce((sum, m) => sum + m.error_count, 0);
    const errorRate = totalRequests > 0 ? totalErrors / totalRequests : 0;

    const latencies = recentMetrics
      .filter((m) => m.latency_avg !== undefined)
      .map((m) => m.latency_avg!);
    const avgLatency =
      latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;

    let status: 'healthy' | 'degraded' | 'critical' = 'healthy';
    if (errorRate > 0.1) {
      status = 'critical';
    } else if (errorRate > 0.05 || avgLatency > 1000) {
      status = 'degraded';
    }

    // Calculate uptime (simplified: based on error rate)
    const uptimePercentage = (1 - errorRate) * 100;

    return {
      status,
      avg_latency_ms: avgLatency,
      error_rate: errorRate,
      uptime_percentage: Math.max(0, Math.min(100, uptimePercentage)),
    };
  }
}

// Singleton instance
export const oracleAnalyticsService = new OracleAnalyticsService();
