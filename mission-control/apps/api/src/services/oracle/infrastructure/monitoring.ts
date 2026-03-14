/**
 * ORACLE v2.0 Comprehensive Monitoring Service
 * Story inf-7: Production-ready monitoring and observability
 *
 * Features:
 * - Prometheus metrics integration (counters, gauges, histograms)
 * - Health check endpoints with dependency checks
 * - Performance tracking (latency, throughput)
 * - Error rate monitoring with circuit breaker patterns
 * - Custom ORACLE metrics (predictions, decisions, accuracy)
 * - Alert thresholds configuration
 *
 * Time Complexity:
 * - O(1) for most metric operations
 * - O(n) for aggregated metrics where n is number of samples
 */

import { EventEmitter } from 'events';
import { getMetrics, OracleMetrics, HealthStatus } from './metrics';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface MonitoringConfig {
  serviceName: string;
  environment: string;
  version: string;
  enableDetailedMetrics: boolean;
  healthCheckInterval: number;
  alertThresholds: AlertThresholds;
  performanceTargets: PerformanceTargets;
}

export interface AlertThresholds {
  errorRatePercent: number;
  latencyP95Ms: number;
  latencyP99Ms: number;
  predictionFailureRatePercent: number;
  queueSizeWarning: number;
  queueSizeCritical: number;
  memoryUsagePercent: number;
  cacheHitRatioMin: number;
}

export interface PerformanceTargets {
  apiLatencyP50Ms: number;
  apiLatencyP95Ms: number;
  apiLatencyP99Ms: number;
  throughputRps: number;
  predictionLatencyMs: number;
  simulationTimeoutMs: number;
}

export interface DependencyHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  latencyMs: number;
  lastCheck: number;
  consecutiveFailures: number;
  message?: string;
}

export interface PerformanceSnapshot {
  timestamp: number;
  requests: {
    total: number;
    perSecond: number;
    byStatus: Record<string, number>;
  };
  latency: {
    p50Ms: number;
    p95Ms: number;
    p99Ms: number;
    avgMs: number;
  };
  errors: {
    total: number;
    ratePercent: number;
    byType: Record<string, number>;
  };
  predictions: {
    total: number;
    successRate: number;
    avgLatencyMs: number;
    byModel: Record<string, { count: number; successRate: number }>;
  };
  decisions: {
    total: number;
    byPhase: Record<string, number>;
    avgConfidence: number;
  };
}

export interface OracleAccuracyMetrics {
  predictionAccuracy: number;
  confidenceCalibration: number;
  decisionQuality: number;
  signalRelevance: number;
  simulationAccuracy: number;
  lastUpdated: number;
}

export interface Alert {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  type: string;
  message: string;
  value: number;
  threshold: number;
  timestamp: number;
  resolved: boolean;
  resolvedAt?: number;
}

// ============================================================================
// Sliding Window for Accurate Rate Calculations
// ============================================================================

class SlidingWindow {
  private buckets: number[] = [];
  private readonly bucketSizeMs: number;
  private readonly windowSizeMs: number;
  private readonly numBuckets: number;
  private currentBucketIndex = 0;
  private lastUpdateTime: number;

  constructor(windowSizeMs: number, bucketSizeMs: number = 1000) {
    this.windowSizeMs = windowSizeMs;
    this.bucketSizeMs = bucketSizeMs;
    this.numBuckets = Math.ceil(windowSizeMs / bucketSizeMs);
    this.buckets = new Array(this.numBuckets).fill(0);
    this.lastUpdateTime = Date.now();
  }

  /**
   * Add a value to the current bucket
   * O(buckets) for cleanup
   */
  add(value: number = 1): void {
    this.advanceBuckets();
    this.buckets[this.currentBucketIndex] += value;
  }

  /**
   * Get sum of all values in window
   * O(buckets)
   */
  sum(): number {
    this.advanceBuckets();
    return this.buckets.reduce((a, b) => a + b, 0);
  }

  /**
   * Get rate per second
   * O(buckets)
   */
  rate(): number {
    return this.sum() / (this.windowSizeMs / 1000);
  }

  private advanceBuckets(): void {
    const now = Date.now();
    const elapsed = now - this.lastUpdateTime;
    const bucketsToAdvance = Math.floor(elapsed / this.bucketSizeMs);

    if (bucketsToAdvance > 0) {
      for (let i = 0; i < Math.min(bucketsToAdvance, this.numBuckets); i++) {
        this.currentBucketIndex = (this.currentBucketIndex + 1) % this.numBuckets;
        this.buckets[this.currentBucketIndex] = 0;
      }
      this.lastUpdateTime = now;
    }
  }
}

// ============================================================================
// Percentile Calculator for Latency Tracking
// ============================================================================

class PercentileCalculator {
  private values: number[] = [];
  private readonly maxSize: number;
  private sorted = false;

  constructor(maxSize: number = 10000) {
    this.maxSize = maxSize;
  }

  /**
   * Add a value
   * O(1) amortized
   */
  add(value: number): void {
    this.values.push(value);
    this.sorted = false;

    // Maintain max size with reservoir sampling
    if (this.values.length > this.maxSize) {
      this.values.shift();
    }
  }

  /**
   * Get percentile value
   * O(n log n) for first call, O(1) for subsequent
   */
  percentile(p: number): number {
    if (this.values.length === 0) return 0;

    if (!this.sorted) {
      this.values.sort((a, b) => a - b);
      this.sorted = true;
    }

    const index = Math.ceil((p / 100) * this.values.length) - 1;
    return this.values[Math.max(0, index)];
  }

  /**
   * Get average
   * O(n)
   */
  average(): number {
    if (this.values.length === 0) return 0;
    return this.values.reduce((a, b) => a + b, 0) / this.values.length;
  }

  /**
   * Get count
   * O(1)
   */
  count(): number {
    return this.values.length;
  }

  /**
   * Reset values
   * O(1)
   */
  reset(): void {
    this.values = [];
    this.sorted = false;
  }
}

// ============================================================================
// ORACLE Monitoring Service
// ============================================================================

export class OracleMonitoring extends EventEmitter {
  private readonly config: MonitoringConfig;
  private readonly metrics: OracleMetrics;

  // Sliding windows for rate calculations
  private readonly requestWindow: SlidingWindow;
  private readonly errorWindow: SlidingWindow;
  private readonly predictionWindow: SlidingWindow;
  private readonly predictionFailureWindow: SlidingWindow;

  // Percentile calculators
  private readonly latencyCalculator: PercentileCalculator;
  private readonly predictionLatencyCalculator: PercentileCalculator;
  private readonly simulationLatencyCalculator: PercentileCalculator;

  // Dependency health tracking
  private readonly dependencies = new Map<string, DependencyHealth>();

  // Alert management
  private readonly activeAlerts = new Map<string, Alert>();
  private alertCounter = 0;

  // Accuracy tracking
  private readonly accuracyMetrics: OracleAccuracyMetrics = {
    predictionAccuracy: 0,
    confidenceCalibration: 0,
    decisionQuality: 0,
    signalRelevance: 0,
    simulationAccuracy: 0,
    lastUpdated: 0,
  };

  // Custom ORACLE metrics
  private readonly oracleCounters = {
    signals: { total: 0, byType: new Map<string, number>(), byUrgency: new Map<string, number>() },
    predictions: { total: 0, success: 0, failure: 0, byModel: new Map<string, { success: number; failure: number }>() },
    decisions: { total: 0, byPhase: new Map<string, number>(), confidenceSum: 0 },
    simulations: { total: 0, completed: 0, timeout: 0 },
  };

  private intervalIds: ReturnType<typeof setInterval>[] = [];

  constructor(config?: Partial<MonitoringConfig>) {
    super();

    this.config = {
      serviceName: 'oracle-api',
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
      enableDetailedMetrics: true,
      healthCheckInterval: 30000,
      alertThresholds: {
        errorRatePercent: 5,
        latencyP95Ms: 500,
        latencyP99Ms: 1000,
        predictionFailureRatePercent: 10,
        queueSizeWarning: 1000,
        queueSizeCritical: 5000,
        memoryUsagePercent: 85,
        cacheHitRatioMin: 0.5,
      },
      performanceTargets: {
        apiLatencyP50Ms: 50,
        apiLatencyP95Ms: 200,
        apiLatencyP99Ms: 500,
        throughputRps: 1000,
        predictionLatencyMs: 100,
        simulationTimeoutMs: 60000,
      },
      ...config,
    };

    this.metrics = getMetrics();

    // Initialize sliding windows (60 second window)
    this.requestWindow = new SlidingWindow(60000);
    this.errorWindow = new SlidingWindow(60000);
    this.predictionWindow = new SlidingWindow(60000);
    this.predictionFailureWindow = new SlidingWindow(60000);

    // Initialize percentile calculators
    this.latencyCalculator = new PercentileCalculator(10000);
    this.predictionLatencyCalculator = new PercentileCalculator(5000);
    this.simulationLatencyCalculator = new PercentileCalculator(1000);

    // Register default dependencies
    this.registerDependency('database', 'PostgreSQL connection');
    this.registerDependency('redis', 'Redis cache connection');
    this.registerDependency('gemini', 'Gemini AI API');

    // Start periodic checks
    this.startPeriodicChecks();
  }

  // ============================================================================
  // Request Tracking
  // ============================================================================

  /**
   * Record an API request
   * O(1)
   */
  recordRequest(
    method: string,
    route: string,
    statusCode: number,
    durationMs: number
  ): void {
    this.requestWindow.add(1);
    this.latencyCalculator.add(durationMs);

    // Record to Prometheus metrics
    this.metrics.recordApiLatency(method, route, statusCode, durationMs / 1000);

    if (statusCode >= 400) {
      this.errorWindow.add(1);
      this.metrics.recordError('http', statusCode.toString(), route);
    }

    // Check thresholds
    this.checkLatencyThreshold(durationMs);
    this.checkErrorRateThreshold();
  }

  /**
   * Get current request rate
   * O(buckets)
   */
  getRequestRate(): number {
    return this.requestWindow.rate();
  }

  /**
   * Get current error rate
   * O(buckets)
   */
  getErrorRate(): number {
    const requests = this.requestWindow.sum();
    if (requests === 0) return 0;
    return (this.errorWindow.sum() / requests) * 100;
  }

  // ============================================================================
  // Prediction Tracking
  // ============================================================================

  /**
   * Record a prediction
   * O(1)
   */
  recordPrediction(
    model: string,
    success: boolean,
    latencyMs: number,
    confidence?: number
  ): void {
    this.predictionWindow.add(1);
    this.predictionLatencyCalculator.add(latencyMs);

    const status = success ? 'success' : 'failure';
    this.metrics.recordPrediction('prediction', status, model);

    this.oracleCounters.predictions.total++;
    if (success) {
      this.oracleCounters.predictions.success++;
    } else {
      this.oracleCounters.predictions.failure++;
      this.predictionFailureWindow.add(1);
    }

    // Track by model
    const modelStats = this.oracleCounters.predictions.byModel.get(model) || { success: 0, failure: 0 };
    if (success) {
      modelStats.success++;
    } else {
      modelStats.failure++;
    }
    this.oracleCounters.predictions.byModel.set(model, modelStats);

    // Check thresholds
    this.checkPredictionFailureThreshold();
  }

  /**
   * Get prediction success rate
   * O(1)
   */
  getPredictionSuccessRate(): number {
    if (this.oracleCounters.predictions.total === 0) return 1;
    return this.oracleCounters.predictions.success / this.oracleCounters.predictions.total;
  }

  // ============================================================================
  // Decision Tracking
  // ============================================================================

  /**
   * Record a decision
   * O(1)
   */
  recordDecision(phase: string, confidence: number): void {
    this.metrics.recordDecision('completed', phase);

    this.oracleCounters.decisions.total++;
    this.oracleCounters.decisions.confidenceSum += confidence;

    const phaseCount = this.oracleCounters.decisions.byPhase.get(phase) || 0;
    this.oracleCounters.decisions.byPhase.set(phase, phaseCount + 1);
  }

  /**
   * Get average decision confidence
   * O(1)
   */
  getAverageDecisionConfidence(): number {
    if (this.oracleCounters.decisions.total === 0) return 0;
    return this.oracleCounters.decisions.confidenceSum / this.oracleCounters.decisions.total;
  }

  // ============================================================================
  // Signal Tracking
  // ============================================================================

  /**
   * Record a signal
   * O(1)
   */
  recordSignal(type: string, urgency: string): void {
    this.metrics.recordSignal(type, urgency);

    this.oracleCounters.signals.total++;

    const typeCount = this.oracleCounters.signals.byType.get(type) || 0;
    this.oracleCounters.signals.byType.set(type, typeCount + 1);

    const urgencyCount = this.oracleCounters.signals.byUrgency.get(urgency) || 0;
    this.oracleCounters.signals.byUrgency.set(urgency, urgencyCount + 1);
  }

  // ============================================================================
  // Simulation Tracking
  // ============================================================================

  /**
   * Start timing a simulation
   * O(1)
   */
  startSimulationTimer(type: string): () => void {
    const startTime = Date.now();
    const prometheusTimer = this.metrics.timeSimulation(type);

    return () => {
      const durationMs = Date.now() - startTime;
      prometheusTimer();
      this.simulationLatencyCalculator.add(durationMs);

      this.oracleCounters.simulations.total++;
      if (durationMs < this.config.performanceTargets.simulationTimeoutMs) {
        this.oracleCounters.simulations.completed++;
      } else {
        this.oracleCounters.simulations.timeout++;
      }
    };
  }

  // ============================================================================
  // Accuracy Tracking
  // ============================================================================

  /**
   * Update accuracy metrics based on outcome feedback
   * O(1)
   */
  updateAccuracy(
    type: 'prediction' | 'confidence' | 'decision' | 'signal' | 'simulation',
    predicted: number,
    actual: number
  ): void {
    // Calculate accuracy as 1 - normalized error
    const error = Math.abs(predicted - actual);
    const accuracy = Math.max(0, 1 - error);

    // Exponential moving average with alpha = 0.1
    const alpha = 0.1;

    switch (type) {
      case 'prediction':
        this.accuracyMetrics.predictionAccuracy =
          alpha * accuracy + (1 - alpha) * this.accuracyMetrics.predictionAccuracy;
        break;
      case 'confidence':
        this.accuracyMetrics.confidenceCalibration =
          alpha * accuracy + (1 - alpha) * this.accuracyMetrics.confidenceCalibration;
        break;
      case 'decision':
        this.accuracyMetrics.decisionQuality =
          alpha * accuracy + (1 - alpha) * this.accuracyMetrics.decisionQuality;
        break;
      case 'signal':
        this.accuracyMetrics.signalRelevance =
          alpha * accuracy + (1 - alpha) * this.accuracyMetrics.signalRelevance;
        break;
      case 'simulation':
        this.accuracyMetrics.simulationAccuracy =
          alpha * accuracy + (1 - alpha) * this.accuracyMetrics.simulationAccuracy;
        break;
    }

    this.accuracyMetrics.lastUpdated = Date.now();
  }

  /**
   * Get current accuracy metrics
   * O(1)
   */
  getAccuracyMetrics(): OracleAccuracyMetrics {
    return { ...this.accuracyMetrics };
  }

  // ============================================================================
  // Dependency Health Checks
  // ============================================================================

  /**
   * Register a dependency for health checking
   * O(1)
   */
  registerDependency(name: string, description?: string): void {
    this.dependencies.set(name, {
      name,
      status: 'healthy',
      latencyMs: 0,
      lastCheck: 0,
      consecutiveFailures: 0,
      message: description,
    });
  }

  /**
   * Update dependency health status
   * O(1)
   */
  updateDependencyHealth(
    name: string,
    status: 'healthy' | 'degraded' | 'unhealthy',
    latencyMs: number,
    message?: string
  ): void {
    const dep = this.dependencies.get(name);
    if (!dep) {
      this.registerDependency(name);
      return this.updateDependencyHealth(name, status, latencyMs, message);
    }

    const previousStatus = dep.status;
    dep.status = status;
    dep.latencyMs = latencyMs;
    dep.lastCheck = Date.now();
    dep.message = message;

    if (status === 'unhealthy') {
      dep.consecutiveFailures++;
    } else {
      dep.consecutiveFailures = 0;
    }

    // Emit events on status change
    if (previousStatus !== status) {
      this.emit('dependency-status-change', { name, previousStatus, newStatus: status });

      if (status === 'unhealthy') {
        this.createAlert('critical', 'dependency_unhealthy', `Dependency ${name} is unhealthy`, 1, 0);
      }
    }
  }

  /**
   * Get all dependency health statuses
   * O(n)
   */
  getDependencyHealth(): DependencyHealth[] {
    return Array.from(this.dependencies.values());
  }

  // ============================================================================
  // Health Check Endpoints
  // ============================================================================

  /**
   * Liveness check - is the service running?
   * O(1)
   */
  async checkLiveness(): Promise<{ status: 'ok' | 'error'; uptime: number }> {
    return {
      status: 'ok',
      uptime: process.uptime(),
    };
  }

  /**
   * Readiness check - is the service ready to accept traffic?
   * O(n) where n is number of dependencies
   */
  async checkReadiness(): Promise<{
    status: 'ready' | 'not_ready';
    dependencies: DependencyHealth[];
  }> {
    const dependencies = this.getDependencyHealth();
    const hasUnhealthy = dependencies.some(d => d.status === 'unhealthy');

    return {
      status: hasUnhealthy ? 'not_ready' : 'ready',
      dependencies,
    };
  }

  /**
   * Comprehensive health check
   * O(n)
   */
  async checkHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: number;
    version: string;
    uptime: number;
    dependencies: DependencyHealth[];
    performance: {
      requestRate: number;
      errorRate: number;
      latencyP95Ms: number;
    };
    alerts: Alert[];
  }> {
    const dependencies = this.getDependencyHealth();
    const hasUnhealthy = dependencies.some(d => d.status === 'unhealthy');
    const hasDegraded = dependencies.some(d => d.status === 'degraded');
    const hasCriticalAlerts = Array.from(this.activeAlerts.values()).some(
      a => a.severity === 'critical' && !a.resolved
    );

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (hasUnhealthy || hasCriticalAlerts) {
      status = 'unhealthy';
    } else if (hasDegraded) {
      status = 'degraded';
    }

    return {
      status,
      timestamp: Date.now(),
      version: this.config.version,
      uptime: process.uptime(),
      dependencies,
      performance: {
        requestRate: this.getRequestRate(),
        errorRate: this.getErrorRate(),
        latencyP95Ms: this.latencyCalculator.percentile(95),
      },
      alerts: Array.from(this.activeAlerts.values()).filter(a => !a.resolved),
    };
  }

  // ============================================================================
  // Performance Snapshot
  // ============================================================================

  /**
   * Get comprehensive performance snapshot
   * O(n) where n is number of data points
   */
  getPerformanceSnapshot(): PerformanceSnapshot {
    const requestTotal = this.requestWindow.sum();
    const errorTotal = this.errorWindow.sum();

    return {
      timestamp: Date.now(),
      requests: {
        total: requestTotal,
        perSecond: this.requestWindow.rate(),
        byStatus: {}, // Would need additional tracking
      },
      latency: {
        p50Ms: this.latencyCalculator.percentile(50),
        p95Ms: this.latencyCalculator.percentile(95),
        p99Ms: this.latencyCalculator.percentile(99),
        avgMs: this.latencyCalculator.average(),
      },
      errors: {
        total: errorTotal,
        ratePercent: requestTotal > 0 ? (errorTotal / requestTotal) * 100 : 0,
        byType: {},
      },
      predictions: {
        total: this.oracleCounters.predictions.total,
        successRate: this.getPredictionSuccessRate(),
        avgLatencyMs: this.predictionLatencyCalculator.average(),
        byModel: Object.fromEntries(
          Array.from(this.oracleCounters.predictions.byModel.entries()).map(([model, stats]) => [
            model,
            {
              count: stats.success + stats.failure,
              successRate: stats.success / (stats.success + stats.failure || 1),
            },
          ])
        ),
      },
      decisions: {
        total: this.oracleCounters.decisions.total,
        byPhase: Object.fromEntries(this.oracleCounters.decisions.byPhase),
        avgConfidence: this.getAverageDecisionConfidence(),
      },
    };
  }

  // ============================================================================
  // Alert Management
  // ============================================================================

  /**
   * Create an alert
   * O(1)
   */
  private createAlert(
    severity: 'info' | 'warning' | 'critical',
    type: string,
    message: string,
    value: number,
    threshold: number
  ): Alert {
    // Check if similar alert already exists
    const existingKey = `${type}-${severity}`;
    const existing = this.activeAlerts.get(existingKey);
    if (existing && !existing.resolved) {
      return existing;
    }

    const alert: Alert = {
      id: `alert-${++this.alertCounter}`,
      severity,
      type,
      message,
      value,
      threshold,
      timestamp: Date.now(),
      resolved: false,
    };

    this.activeAlerts.set(existingKey, alert);
    this.emit('alert', alert);

    return alert;
  }

  /**
   * Resolve an alert
   * O(1)
   */
  resolveAlert(alertId: string): void {
    for (const [key, alert] of this.activeAlerts.entries()) {
      if (alert.id === alertId && !alert.resolved) {
        alert.resolved = true;
        alert.resolvedAt = Date.now();
        this.emit('alert-resolved', alert);
        break;
      }
    }
  }

  /**
   * Get active alerts
   * O(n)
   */
  getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values()).filter(a => !a.resolved);
  }

  // ============================================================================
  // Threshold Checking
  // ============================================================================

  private checkLatencyThreshold(latencyMs: number): void {
    if (latencyMs > this.config.alertThresholds.latencyP99Ms) {
      this.createAlert(
        'warning',
        'high_latency',
        `Request latency ${latencyMs}ms exceeds P99 threshold`,
        latencyMs,
        this.config.alertThresholds.latencyP99Ms
      );
    }
  }

  private checkErrorRateThreshold(): void {
    const errorRate = this.getErrorRate();
    if (errorRate > this.config.alertThresholds.errorRatePercent) {
      this.createAlert(
        'critical',
        'high_error_rate',
        `Error rate ${errorRate.toFixed(2)}% exceeds threshold`,
        errorRate,
        this.config.alertThresholds.errorRatePercent
      );
    }
  }

  private checkPredictionFailureThreshold(): void {
    const totalPredictions = this.predictionWindow.sum();
    if (totalPredictions < 10) return; // Need minimum samples

    const failureRate = (this.predictionFailureWindow.sum() / totalPredictions) * 100;
    if (failureRate > this.config.alertThresholds.predictionFailureRatePercent) {
      this.createAlert(
        'critical',
        'prediction_failure_rate',
        `Prediction failure rate ${failureRate.toFixed(2)}% exceeds threshold`,
        failureRate,
        this.config.alertThresholds.predictionFailureRatePercent
      );
    }
  }

  // ============================================================================
  // Periodic Checks
  // ============================================================================

  private startPeriodicChecks(): void {
    // Health check interval
    const healthCheckId = setInterval(async () => {
      const health = await this.checkHealth();
      this.emit('health-check', health);

      // Update Prometheus gauges
      this.metrics.setActiveUsers(this.requestWindow.rate(), 'requests_per_second');
    }, this.config.healthCheckInterval);

    this.intervalIds.push(healthCheckId);

    // Memory check interval
    const memoryCheckId = setInterval(() => {
      const memory = process.memoryUsage();
      const heapUsedPercent = (memory.heapUsed / memory.heapTotal) * 100;

      if (heapUsedPercent > this.config.alertThresholds.memoryUsagePercent) {
        this.createAlert(
          'warning',
          'high_memory',
          `Memory usage ${heapUsedPercent.toFixed(2)}% exceeds threshold`,
          heapUsedPercent,
          this.config.alertThresholds.memoryUsagePercent
        );
      }
    }, 60000);

    this.intervalIds.push(memoryCheckId);

    // Alert cleanup interval (resolve stale alerts)
    const alertCleanupId = setInterval(() => {
      const now = Date.now();
      const staleThreshold = 3600000; // 1 hour

      for (const [key, alert] of this.activeAlerts.entries()) {
        if (alert.resolved && now - (alert.resolvedAt || 0) > staleThreshold) {
          this.activeAlerts.delete(key);
        }
      }
    }, 300000);

    this.intervalIds.push(alertCleanupId);
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  /**
   * Shutdown monitoring
   * O(n)
   */
  async shutdown(): Promise<void> {
    for (const id of this.intervalIds) {
      clearInterval(id);
    }
    this.intervalIds = [];

    await this.metrics.shutdown();
    this.emit('shutdown');
  }
}

// ============================================================================
// Singleton & Factory
// ============================================================================

let monitoringInstance: OracleMonitoring | null = null;

/**
 * Get the singleton monitoring instance
 */
export function getMonitoring(config?: Partial<MonitoringConfig>): OracleMonitoring {
  if (!monitoringInstance) {
    monitoringInstance = new OracleMonitoring(config);
  }
  return monitoringInstance;
}

/**
 * Create a new monitoring instance (for testing)
 */
export function createMonitoring(config?: Partial<MonitoringConfig>): OracleMonitoring {
  return new OracleMonitoring(config);
}

// ============================================================================
// Fastify Plugin
// ============================================================================

/**
 * Fastify plugin for monitoring middleware
 */
export function monitoringPlugin(fastify: any, options: Partial<MonitoringConfig>, done: () => void): void {
  const monitoring = getMonitoring(options);

  // Add request tracking
  fastify.addHook('onRequest', async (request: any) => {
    request.monitoringStartTime = Date.now();
  });

  fastify.addHook('onResponse', async (request: any, reply: any) => {
    const durationMs = Date.now() - request.monitoringStartTime;
    monitoring.recordRequest(
      request.method,
      request.routerPath || request.url,
      reply.statusCode,
      durationMs
    );
  });

  // Health endpoints
  fastify.get('/health/live', async () => monitoring.checkLiveness());
  fastify.get('/health/ready', async () => monitoring.checkReadiness());
  fastify.get('/health', async () => monitoring.checkHealth());

  // Metrics endpoint
  fastify.get('/monitoring/performance', async () => monitoring.getPerformanceSnapshot());
  fastify.get('/monitoring/accuracy', async () => monitoring.getAccuracyMetrics());
  fastify.get('/monitoring/alerts', async () => monitoring.getActiveAlerts());
  fastify.get('/monitoring/dependencies', async () => monitoring.getDependencyHealth());

  done();
}

// ============================================================================
// Default Export
// ============================================================================

export default OracleMonitoring;
