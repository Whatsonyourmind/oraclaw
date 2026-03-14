/**
 * ORACLE Performance Monitor
 * Story perf-1 - Application Performance Monitoring for ORACLE operations
 *
 * Features:
 * - Track API response times
 * - Track AI inference times
 * - Track sync duration
 * - Alerting on degradation
 * - Performance dashboard data
 */

import { createClient } from '@supabase/supabase-js';

// ============================================================================
// TYPES
// ============================================================================

export type MetricType =
  | 'api_response'
  | 'ai_inference'
  | 'sync_duration'
  | 'database_query'
  | 'cache_hit'
  | 'cache_miss'
  | 'integration_call'
  | 'realtime_latency';

export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface PerformanceMetric {
  id: string;
  user_id: string;
  metric_type: MetricType;
  operation: string;
  duration_ms: number;
  success: boolean;
  metadata: Record<string, any>;
  timestamp: Date;
}

export interface PerformanceAlert {
  id: string;
  user_id: string;
  metric_type: MetricType;
  operation: string;
  severity: AlertSeverity;
  message: string;
  threshold_value: number;
  actual_value: number;
  acknowledged: boolean;
  created_at: Date;
}

export interface PerformanceThresholds {
  api_response: { warning: number; critical: number };
  ai_inference: { warning: number; critical: number };
  sync_duration: { warning: number; critical: number };
  database_query: { warning: number; critical: number };
  integration_call: { warning: number; critical: number };
  realtime_latency: { warning: number; critical: number };
}

export interface PerformanceSummary {
  metric_type: MetricType;
  avg_duration_ms: number;
  min_duration_ms: number;
  max_duration_ms: number;
  p50_duration_ms: number;
  p95_duration_ms: number;
  p99_duration_ms: number;
  success_rate: number;
  total_count: number;
  period_start: Date;
  period_end: Date;
}

export interface DashboardData {
  summaries: PerformanceSummary[];
  recent_alerts: PerformanceAlert[];
  trends: TrendData[];
  health_score: number;
  last_updated: Date;
}

export interface TrendData {
  metric_type: MetricType;
  timestamp: Date;
  avg_duration_ms: number;
  count: number;
}

export interface TimerHandle {
  stop: () => number;
}

// ============================================================================
// DEFAULT THRESHOLDS
// ============================================================================

const DEFAULT_THRESHOLDS: PerformanceThresholds = {
  api_response: { warning: 1000, critical: 3000 }, // 1s warning, 3s critical
  ai_inference: { warning: 5000, critical: 15000 }, // 5s warning, 15s critical
  sync_duration: { warning: 10000, critical: 30000 }, // 10s warning, 30s critical
  database_query: { warning: 500, critical: 2000 }, // 500ms warning, 2s critical
  integration_call: { warning: 3000, critical: 10000 }, // 3s warning, 10s critical
  realtime_latency: { warning: 200, critical: 1000 }, // 200ms warning, 1s critical
};

// ============================================================================
// IN-MEMORY METRICS BUFFER
// ============================================================================

interface MetricsBuffer {
  metrics: PerformanceMetric[];
  maxSize: number;
  flushInterval: number;
}

// ============================================================================
// PERFORMANCE MONITOR CLASS
// ============================================================================

export class PerformanceMonitor {
  private supabase: ReturnType<typeof createClient> | null = null;
  private userId: string | null = null;
  private thresholds: PerformanceThresholds = DEFAULT_THRESHOLDS;
  private buffer: MetricsBuffer = {
    metrics: [],
    maxSize: 100,
    flushInterval: 30000, // 30 seconds
  };
  private flushTimer: NodeJS.Timeout | null = null;
  private enabled: boolean = true;
  private alertCallbacks: ((alert: PerformanceAlert) => void)[] = [];

  // --------------------------------------------------------------------------
  // Initialization
  // --------------------------------------------------------------------------

  async initialize(supabaseUrl: string, supabaseKey: string, userId: string): Promise<void> {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.userId = userId;
    await this.loadThresholds();
    this.startFlushTimer();
  }

  private startFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    this.flushTimer = setInterval(() => {
      this.flushMetrics();
    }, this.buffer.flushInterval);
  }

  async shutdown(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    await this.flushMetrics();
  }

  // --------------------------------------------------------------------------
  // Configuration
  // --------------------------------------------------------------------------

  private async loadThresholds(): Promise<void> {
    if (!this.supabase || !this.userId) return;

    try {
      const { data } = await this.supabase
        .from('oracle_user_settings')
        .select('performance_thresholds')
        .eq('user_id', this.userId)
        .single();

      if (data?.performance_thresholds) {
        this.thresholds = { ...DEFAULT_THRESHOLDS, ...data.performance_thresholds };
      }
    } catch {
      // Use defaults if settings not found
    }
  }

  async updateThresholds(thresholds: Partial<PerformanceThresholds>): Promise<void> {
    this.thresholds = { ...this.thresholds, ...thresholds };

    if (this.supabase && this.userId) {
      await this.supabase
        .from('oracle_user_settings')
        .upsert({
          user_id: this.userId,
          performance_thresholds: this.thresholds,
          updated_at: new Date().toISOString(),
        });
    }
  }

  getThresholds(): PerformanceThresholds {
    return { ...this.thresholds };
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  // --------------------------------------------------------------------------
  // Metric Recording
  // --------------------------------------------------------------------------

  /**
   * Start a timer for measuring operation duration
   */
  startTimer(metricType: MetricType, operation: string): TimerHandle {
    const startTime = performance.now();

    return {
      stop: () => {
        const duration = performance.now() - startTime;
        return duration;
      },
    };
  }

  /**
   * Record a performance metric
   */
  async recordMetric(
    metricType: MetricType,
    operation: string,
    durationMs: number,
    success: boolean = true,
    metadata: Record<string, any> = {}
  ): Promise<void> {
    if (!this.enabled || !this.userId) return;

    const metric: PerformanceMetric = {
      id: crypto.randomUUID(),
      user_id: this.userId,
      metric_type: metricType,
      operation,
      duration_ms: Math.round(durationMs * 100) / 100,
      success,
      metadata,
      timestamp: new Date(),
    };

    // Add to buffer
    this.buffer.metrics.push(metric);

    // Check thresholds and generate alerts
    await this.checkThresholds(metric);

    // Flush if buffer is full
    if (this.buffer.metrics.length >= this.buffer.maxSize) {
      await this.flushMetrics();
    }
  }

  /**
   * Convenience method to time and record an async operation
   */
  async trackOperation<T>(
    metricType: MetricType,
    operation: string,
    fn: () => Promise<T>,
    metadata: Record<string, any> = {}
  ): Promise<T> {
    const startTime = performance.now();
    let success = true;

    try {
      return await fn();
    } catch (error) {
      success = false;
      metadata.error = error instanceof Error ? error.message : 'Unknown error';
      throw error;
    } finally {
      const duration = performance.now() - startTime;
      await this.recordMetric(metricType, operation, duration, success, metadata);
    }
  }

  // --------------------------------------------------------------------------
  // Threshold Checking & Alerts
  // --------------------------------------------------------------------------

  private async checkThresholds(metric: PerformanceMetric): Promise<void> {
    const thresholdConfig = this.thresholds[metric.metric_type as keyof PerformanceThresholds];
    if (!thresholdConfig) return;

    let severity: AlertSeverity | null = null;
    let thresholdValue = 0;

    if (metric.duration_ms >= thresholdConfig.critical) {
      severity = 'critical';
      thresholdValue = thresholdConfig.critical;
    } else if (metric.duration_ms >= thresholdConfig.warning) {
      severity = 'warning';
      thresholdValue = thresholdConfig.warning;
    }

    if (severity) {
      await this.createAlert(metric, severity, thresholdValue);
    }
  }

  private async createAlert(
    metric: PerformanceMetric,
    severity: AlertSeverity,
    thresholdValue: number
  ): Promise<void> {
    const alert: PerformanceAlert = {
      id: crypto.randomUUID(),
      user_id: metric.user_id,
      metric_type: metric.metric_type,
      operation: metric.operation,
      severity,
      message: `${metric.metric_type} for ${metric.operation} exceeded ${severity} threshold: ${metric.duration_ms.toFixed(0)}ms > ${thresholdValue}ms`,
      threshold_value: thresholdValue,
      actual_value: metric.duration_ms,
      acknowledged: false,
      created_at: new Date(),
    };

    // Notify callbacks
    this.alertCallbacks.forEach(callback => callback(alert));

    // Store alert
    if (this.supabase) {
      await this.supabase.from('oracle_performance_alerts').insert(alert);
    }
  }

  onAlert(callback: (alert: PerformanceAlert) => void): () => void {
    this.alertCallbacks.push(callback);
    return () => {
      const index = this.alertCallbacks.indexOf(callback);
      if (index > -1) {
        this.alertCallbacks.splice(index, 1);
      }
    };
  }

  async acknowledgeAlert(alertId: string): Promise<void> {
    if (!this.supabase) return;

    await this.supabase
      .from('oracle_performance_alerts')
      .update({ acknowledged: true })
      .eq('id', alertId);
  }

  // --------------------------------------------------------------------------
  // Metrics Flushing
  // --------------------------------------------------------------------------

  private async flushMetrics(): Promise<void> {
    if (this.buffer.metrics.length === 0 || !this.supabase) return;

    const metricsToFlush = [...this.buffer.metrics];
    this.buffer.metrics = [];

    try {
      await this.supabase.from('oracle_performance_metrics').insert(metricsToFlush);
    } catch (error) {
      // Re-add metrics on failure
      this.buffer.metrics = [...metricsToFlush, ...this.buffer.metrics];
      console.error('Failed to flush performance metrics:', error);
    }
  }

  // --------------------------------------------------------------------------
  // Dashboard Data
  // --------------------------------------------------------------------------

  async getDashboardData(periodHours: number = 24): Promise<DashboardData> {
    const summaries = await this.getPerformanceSummaries(periodHours);
    const recentAlerts = await this.getRecentAlerts(20);
    const trends = await this.getTrends(periodHours);
    const healthScore = this.calculateHealthScore(summaries, recentAlerts);

    return {
      summaries,
      recent_alerts: recentAlerts,
      trends,
      health_score: healthScore,
      last_updated: new Date(),
    };
  }

  async getPerformanceSummaries(periodHours: number = 24): Promise<PerformanceSummary[]> {
    if (!this.supabase || !this.userId) return [];

    const periodStart = new Date(Date.now() - periodHours * 60 * 60 * 1000);
    const periodEnd = new Date();

    const { data: metrics } = await this.supabase
      .from('oracle_performance_metrics')
      .select('*')
      .eq('user_id', this.userId)
      .gte('timestamp', periodStart.toISOString())
      .lte('timestamp', periodEnd.toISOString());

    if (!metrics || metrics.length === 0) return [];

    // Group by metric type
    const groupedMetrics = metrics.reduce((acc, metric) => {
      if (!acc[metric.metric_type]) {
        acc[metric.metric_type] = [];
      }
      acc[metric.metric_type].push(metric);
      return acc;
    }, {} as Record<MetricType, PerformanceMetric[]>);

    // Calculate summaries
    return Object.entries(groupedMetrics).map(([metricType, typeMetrics]) => {
      const durations = typeMetrics.map(m => m.duration_ms).sort((a, b) => a - b);
      const successCount = typeMetrics.filter(m => m.success).length;

      return {
        metric_type: metricType as MetricType,
        avg_duration_ms: durations.reduce((a, b) => a + b, 0) / durations.length,
        min_duration_ms: durations[0],
        max_duration_ms: durations[durations.length - 1],
        p50_duration_ms: this.percentile(durations, 50),
        p95_duration_ms: this.percentile(durations, 95),
        p99_duration_ms: this.percentile(durations, 99),
        success_rate: (successCount / typeMetrics.length) * 100,
        total_count: typeMetrics.length,
        period_start: periodStart,
        period_end: periodEnd,
      };
    });
  }

  private percentile(sortedArr: number[], p: number): number {
    if (sortedArr.length === 0) return 0;
    const index = Math.ceil((p / 100) * sortedArr.length) - 1;
    return sortedArr[Math.max(0, index)];
  }

  async getRecentAlerts(limit: number = 20): Promise<PerformanceAlert[]> {
    if (!this.supabase || !this.userId) return [];

    const { data } = await this.supabase
      .from('oracle_performance_alerts')
      .select('*')
      .eq('user_id', this.userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    return data || [];
  }

  async getTrends(periodHours: number = 24, bucketMinutes: number = 60): Promise<TrendData[]> {
    if (!this.supabase || !this.userId) return [];

    const periodStart = new Date(Date.now() - periodHours * 60 * 60 * 1000);

    const { data: metrics } = await this.supabase
      .from('oracle_performance_metrics')
      .select('*')
      .eq('user_id', this.userId)
      .gte('timestamp', periodStart.toISOString())
      .order('timestamp', { ascending: true });

    if (!metrics || metrics.length === 0) return [];

    // Bucket metrics by time and type
    const bucketMs = bucketMinutes * 60 * 1000;
    const buckets = new Map<string, { durations: number[]; type: MetricType; timestamp: Date }>();

    metrics.forEach(metric => {
      const bucketTime = new Date(
        Math.floor(new Date(metric.timestamp).getTime() / bucketMs) * bucketMs
      );
      const key = `${metric.metric_type}-${bucketTime.getTime()}`;

      if (!buckets.has(key)) {
        buckets.set(key, {
          durations: [],
          type: metric.metric_type,
          timestamp: bucketTime,
        });
      }
      buckets.get(key)!.durations.push(metric.duration_ms);
    });

    return Array.from(buckets.values()).map(bucket => ({
      metric_type: bucket.type,
      timestamp: bucket.timestamp,
      avg_duration_ms: bucket.durations.reduce((a, b) => a + b, 0) / bucket.durations.length,
      count: bucket.durations.length,
    }));
  }

  private calculateHealthScore(
    summaries: PerformanceSummary[],
    alerts: PerformanceAlert[]
  ): number {
    let score = 100;

    // Deduct for low success rates
    summaries.forEach(summary => {
      if (summary.success_rate < 99) {
        score -= (100 - summary.success_rate) * 0.5;
      }
    });

    // Deduct for recent unacknowledged alerts
    const unacknowledgedAlerts = alerts.filter(a => !a.acknowledged);
    const criticalCount = unacknowledgedAlerts.filter(a => a.severity === 'critical').length;
    const warningCount = unacknowledgedAlerts.filter(a => a.severity === 'warning').length;

    score -= criticalCount * 10;
    score -= warningCount * 3;

    // Deduct for high p95 latencies
    summaries.forEach(summary => {
      const threshold = this.thresholds[summary.metric_type as keyof PerformanceThresholds];
      if (threshold && summary.p95_duration_ms > threshold.warning) {
        score -= 5;
      }
    });

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  // --------------------------------------------------------------------------
  // API Response Time Tracking (Express Middleware)
  // --------------------------------------------------------------------------

  expressMiddleware() {
    return async (req: any, res: any, next: any) => {
      const startTime = performance.now();
      const originalEnd = res.end;

      res.end = async (...args: any[]) => {
        const duration = performance.now() - startTime;
        const operation = `${req.method} ${req.route?.path || req.path}`;

        await this.recordMetric('api_response', operation, duration, res.statusCode < 400, {
          method: req.method,
          path: req.path,
          status_code: res.statusCode,
          user_agent: req.get('user-agent'),
        });

        originalEnd.apply(res, args);
      };

      next();
    };
  }

  // --------------------------------------------------------------------------
  // Specific Metric Helpers
  // --------------------------------------------------------------------------

  async trackAIInference(
    provider: string,
    model: string,
    fn: () => Promise<any>
  ): Promise<any> {
    return this.trackOperation('ai_inference', `${provider}/${model}`, fn, {
      provider,
      model,
    });
  }

  async trackDatabaseQuery(
    operation: string,
    table: string,
    fn: () => Promise<any>
  ): Promise<any> {
    return this.trackOperation('database_query', `${operation}:${table}`, fn, {
      operation,
      table,
    });
  }

  async trackSync(syncType: string, fn: () => Promise<any>): Promise<any> {
    return this.trackOperation('sync_duration', syncType, fn, {
      sync_type: syncType,
    });
  }

  async trackIntegrationCall(
    integration: string,
    operation: string,
    fn: () => Promise<any>
  ): Promise<any> {
    return this.trackOperation('integration_call', `${integration}:${operation}`, fn, {
      integration,
      operation,
    });
  }

  recordCacheHit(cacheType: string): void {
    this.recordMetric('cache_hit', cacheType, 0, true, { cache_type: cacheType });
  }

  recordCacheMiss(cacheType: string): void {
    this.recordMetric('cache_miss', cacheType, 0, true, { cache_type: cacheType });
  }

  async trackRealtimeLatency(channel: string, latencyMs: number): Promise<void> {
    await this.recordMetric('realtime_latency', channel, latencyMs, true, {
      channel,
    });
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const performanceMonitor = new PerformanceMonitor();

// ============================================================================
// DECORATOR FOR TRACKING (Optional TypeScript decorator)
// ============================================================================

export function TrackPerformance(metricType: MetricType, operationName?: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const operation = operationName || `${target.constructor.name}.${propertyKey}`;
      return performanceMonitor.trackOperation(metricType, operation, () =>
        originalMethod.apply(this, args)
      );
    };

    return descriptor;
  };
}

export default performanceMonitor;
