/**
 * ORACLE Prometheus Metrics Infrastructure
 * Story inf-6: Production-ready monitoring and observability
 *
 * Features:
 * - Prometheus client setup
 * - Custom metrics: predictions, simulations, latency
 * - Health check endpoints
 * - Grafana dashboard configuration
 *
 * Time Complexity:
 * - O(1) for metric recording
 * - O(1) for metric retrieval
 */

import { EventEmitter } from 'events';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface MetricsConfig {
  prefix: string;
  defaultLabels: Record<string, string>;
  collectDefaultMetrics: boolean;
  defaultMetricsInterval: number;
  histogramBuckets: number[];
  summaryPercentiles: number[];
}

export type MetricType = 'counter' | 'gauge' | 'histogram' | 'summary';

export interface MetricDefinition {
  name: string;
  help: string;
  type: MetricType;
  labelNames?: string[];
  buckets?: number[];
  percentiles?: number[];
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: number;
  uptime: number;
  version: string;
  checks: HealthCheck[];
}

export interface HealthCheck {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  message?: string;
  duration?: number;
  lastCheck: number;
}

export interface MetricSample {
  name: string;
  value: number;
  labels: Record<string, string>;
  timestamp: number;
}

// ============================================================================
// Mock Prometheus Client (for development without prom-client)
// ============================================================================

abstract class MockMetric {
  readonly name: string;
  readonly help: string;
  readonly labelNames: string[];
  protected samples = new Map<string, MetricSample>();

  constructor(name: string, help: string, labelNames: string[] = []) {
    this.name = name;
    this.help = help;
    this.labelNames = labelNames;
  }

  protected getLabelKey(labels: Record<string, string>): string {
    return JSON.stringify(labels);
  }

  abstract collect(): string;
}

class MockCounter extends MockMetric {
  private values = new Map<string, number>();

  /**
   * Increment counter
   * O(1)
   */
  inc(labelsOrValue?: Record<string, string> | number, value?: number): void {
    let labels: Record<string, string> = {};
    let incValue = 1;

    if (typeof labelsOrValue === 'number') {
      incValue = labelsOrValue;
    } else if (labelsOrValue) {
      labels = labelsOrValue;
      incValue = value ?? 1;
    }

    const key = this.getLabelKey(labels);
    const current = this.values.get(key) || 0;
    this.values.set(key, current + incValue);
  }

  /**
   * Get current value
   * O(1)
   */
  get(labels: Record<string, string> = {}): number {
    return this.values.get(this.getLabelKey(labels)) || 0;
  }

  /**
   * Reset counter
   * O(1)
   */
  reset(labels?: Record<string, string>): void {
    if (labels) {
      this.values.delete(this.getLabelKey(labels));
    } else {
      this.values.clear();
    }
  }

  collect(): string {
    let output = `# HELP ${this.name} ${this.help}\n`;
    output += `# TYPE ${this.name} counter\n`;

    for (const [key, value] of this.values.entries()) {
      const labels = JSON.parse(key);
      const labelStr = Object.entries(labels)
        .map(([k, v]) => `${k}="${v}"`)
        .join(',');
      output += `${this.name}${labelStr ? `{${labelStr}}` : ''} ${value}\n`;
    }

    return output;
  }
}

class MockGauge extends MockMetric {
  private values = new Map<string, number>();

  /**
   * Set gauge value
   * O(1)
   */
  set(labelsOrValue: Record<string, string> | number, value?: number): void {
    let labels: Record<string, string> = {};
    let setValue: number;

    if (typeof labelsOrValue === 'number') {
      setValue = labelsOrValue;
    } else {
      labels = labelsOrValue;
      setValue = value ?? 0;
    }

    this.values.set(this.getLabelKey(labels), setValue);
  }

  /**
   * Increment gauge
   * O(1)
   */
  inc(labelsOrValue?: Record<string, string> | number, value?: number): void {
    let labels: Record<string, string> = {};
    let incValue = 1;

    if (typeof labelsOrValue === 'number') {
      incValue = labelsOrValue;
    } else if (labelsOrValue) {
      labels = labelsOrValue;
      incValue = value ?? 1;
    }

    const key = this.getLabelKey(labels);
    const current = this.values.get(key) || 0;
    this.values.set(key, current + incValue);
  }

  /**
   * Decrement gauge
   * O(1)
   */
  dec(labelsOrValue?: Record<string, string> | number, value?: number): void {
    let labels: Record<string, string> = {};
    let decValue = 1;

    if (typeof labelsOrValue === 'number') {
      decValue = labelsOrValue;
    } else if (labelsOrValue) {
      labels = labelsOrValue;
      decValue = value ?? 1;
    }

    const key = this.getLabelKey(labels);
    const current = this.values.get(key) || 0;
    this.values.set(key, current - decValue);
  }

  /**
   * Get current value
   * O(1)
   */
  get(labels: Record<string, string> = {}): number {
    return this.values.get(this.getLabelKey(labels)) || 0;
  }

  collect(): string {
    let output = `# HELP ${this.name} ${this.help}\n`;
    output += `# TYPE ${this.name} gauge\n`;

    for (const [key, value] of this.values.entries()) {
      const labels = JSON.parse(key);
      const labelStr = Object.entries(labels)
        .map(([k, v]) => `${k}="${v}"`)
        .join(',');
      output += `${this.name}${labelStr ? `{${labelStr}}` : ''} ${value}\n`;
    }

    return output;
  }
}

class MockHistogram extends MockMetric {
  private buckets: number[];
  private observations = new Map<string, { buckets: Map<number, number>; sum: number; count: number }>();

  constructor(name: string, help: string, labelNames: string[] = [], buckets?: number[]) {
    super(name, help, labelNames);
    this.buckets = buckets || [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];
  }

  /**
   * Observe a value
   * O(buckets)
   */
  observe(labelsOrValue: Record<string, string> | number, value?: number): void {
    let labels: Record<string, string> = {};
    let observeValue: number;

    if (typeof labelsOrValue === 'number') {
      observeValue = labelsOrValue;
    } else {
      labels = labelsOrValue;
      observeValue = value ?? 0;
    }

    const key = this.getLabelKey(labels);
    let data = this.observations.get(key);

    if (!data) {
      data = {
        buckets: new Map(this.buckets.map(b => [b, 0])),
        sum: 0,
        count: 0,
      };
      this.observations.set(key, data);
    }

    // Update buckets
    for (const bucket of this.buckets) {
      if (observeValue <= bucket) {
        data.buckets.set(bucket, (data.buckets.get(bucket) || 0) + 1);
      }
    }

    data.sum += observeValue;
    data.count++;
  }

  /**
   * Start a timer
   * O(1)
   */
  startTimer(labels: Record<string, string> = {}): () => number {
    const start = process.hrtime.bigint();
    return () => {
      const end = process.hrtime.bigint();
      const duration = Number(end - start) / 1e9; // Convert to seconds
      this.observe(labels, duration);
      return duration;
    };
  }

  collect(): string {
    let output = `# HELP ${this.name} ${this.help}\n`;
    output += `# TYPE ${this.name} histogram\n`;

    for (const [key, data] of this.observations.entries()) {
      const labels = JSON.parse(key);
      const labelStr = Object.entries(labels)
        .map(([k, v]) => `${k}="${v}"`)
        .join(',');
      const prefix = labelStr ? `{${labelStr},` : '{';

      for (const [bucket, count] of data.buckets.entries()) {
        output += `${this.name}_bucket${prefix}le="${bucket}"} ${count}\n`;
      }
      output += `${this.name}_bucket${prefix}le="+Inf"} ${data.count}\n`;
      output += `${this.name}_sum${labelStr ? `{${labelStr}}` : ''} ${data.sum}\n`;
      output += `${this.name}_count${labelStr ? `{${labelStr}}` : ''} ${data.count}\n`;
    }

    return output;
  }
}

class MockSummary extends MockMetric {
  private percentiles: number[];
  private observations = new Map<string, number[]>();
  private maxObservations = 1000;

  constructor(name: string, help: string, labelNames: string[] = [], percentiles?: number[]) {
    super(name, help, labelNames);
    this.percentiles = percentiles || [0.5, 0.9, 0.95, 0.99];
  }

  /**
   * Observe a value
   * O(1) amortized
   */
  observe(labelsOrValue: Record<string, string> | number, value?: number): void {
    let labels: Record<string, string> = {};
    let observeValue: number;

    if (typeof labelsOrValue === 'number') {
      observeValue = labelsOrValue;
    } else {
      labels = labelsOrValue;
      observeValue = value ?? 0;
    }

    const key = this.getLabelKey(labels);
    let values = this.observations.get(key);

    if (!values) {
      values = [];
      this.observations.set(key, values);
    }

    values.push(observeValue);

    // Keep only recent observations
    if (values.length > this.maxObservations) {
      values.shift();
    }
  }

  /**
   * Start a timer
   * O(1)
   */
  startTimer(labels: Record<string, string> = {}): () => number {
    const start = process.hrtime.bigint();
    return () => {
      const end = process.hrtime.bigint();
      const duration = Number(end - start) / 1e9;
      this.observe(labels, duration);
      return duration;
    };
  }

  collect(): string {
    let output = `# HELP ${this.name} ${this.help}\n`;
    output += `# TYPE ${this.name} summary\n`;

    for (const [key, values] of this.observations.entries()) {
      const labels = JSON.parse(key);
      const labelStr = Object.entries(labels)
        .map(([k, v]) => `${k}="${v}"`)
        .join(',');
      const prefix = labelStr ? `{${labelStr},` : '{';

      const sorted = [...values].sort((a, b) => a - b);
      const sum = sorted.reduce((a, b) => a + b, 0);

      for (const p of this.percentiles) {
        const index = Math.ceil(sorted.length * p) - 1;
        const value = sorted[Math.max(0, index)] || 0;
        output += `${this.name}${prefix}quantile="${p}"} ${value}\n`;
      }

      output += `${this.name}_sum${labelStr ? `{${labelStr}}` : ''} ${sum}\n`;
      output += `${this.name}_count${labelStr ? `{${labelStr}}` : ''} ${sorted.length}\n`;
    }

    return output;
  }
}

// ============================================================================
// ORACLE Metrics Service
// ============================================================================

export class OracleMetrics extends EventEmitter {
  private config: MetricsConfig;
  private counters = new Map<string, MockCounter>();
  private gauges = new Map<string, MockGauge>();
  private histograms = new Map<string, MockHistogram>();
  private summaries = new Map<string, MockSummary>();
  private startTime: number;
  private healthChecks: HealthCheck[] = [];
  private intervalId: ReturnType<typeof setInterval> | null = null;

  // Pre-defined ORACLE metrics
  readonly predictionCounter: MockCounter;
  readonly simulationDurationHistogram: MockHistogram;
  readonly apiLatencyHistogram: MockHistogram;
  readonly signalCounter: MockCounter;
  readonly decisionCounter: MockCounter;
  readonly activeUsersGauge: MockGauge;
  readonly queueSizeGauge: MockGauge;
  readonly cacheHitRatioGauge: MockGauge;
  readonly errorCounter: MockCounter;
  readonly httpRequestsCounter: MockCounter;
  readonly httpRequestDurationHistogram: MockHistogram;
  readonly websocketConnectionsGauge: MockGauge;
  readonly databaseQueryDurationHistogram: MockHistogram;

  constructor(config?: Partial<MetricsConfig>) {
    super();
    this.startTime = Date.now();

    this.config = {
      prefix: process.env.METRICS_PREFIX || 'oracle_',
      defaultLabels: {
        service: 'oracle-api',
        environment: process.env.NODE_ENV || 'development',
      },
      collectDefaultMetrics: true,
      defaultMetricsInterval: 10000,
      histogramBuckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      summaryPercentiles: [0.5, 0.9, 0.95, 0.99],
      ...config,
    };

    // Initialize pre-defined metrics
    this.predictionCounter = this.createCounter(
      'predictions_total',
      'Total number of predictions made',
      ['type', 'status', 'model']
    );

    this.simulationDurationHistogram = this.createHistogram(
      'simulation_duration_seconds',
      'Duration of simulations in seconds',
      ['type', 'status'],
      [0.1, 0.5, 1, 2, 5, 10, 30, 60, 120]
    );

    this.apiLatencyHistogram = this.createHistogram(
      'api_latency_seconds',
      'API endpoint latency in seconds',
      ['method', 'route', 'status_code']
    );

    this.signalCounter = this.createCounter(
      'signals_total',
      'Total number of signals created',
      ['type', 'urgency', 'source']
    );

    this.decisionCounter = this.createCounter(
      'decisions_total',
      'Total number of decisions made',
      ['status', 'phase']
    );

    this.activeUsersGauge = this.createGauge(
      'active_users',
      'Number of currently active users',
      ['type']
    );

    this.queueSizeGauge = this.createGauge(
      'queue_size',
      'Current size of job queues',
      ['queue_name', 'status']
    );

    this.cacheHitRatioGauge = this.createGauge(
      'cache_hit_ratio',
      'Cache hit ratio',
      ['cache_name']
    );

    this.errorCounter = this.createCounter(
      'errors_total',
      'Total number of errors',
      ['type', 'code', 'source']
    );

    this.httpRequestsCounter = this.createCounter(
      'http_requests_total',
      'Total HTTP requests',
      ['method', 'route', 'status_code']
    );

    this.httpRequestDurationHistogram = this.createHistogram(
      'http_request_duration_seconds',
      'HTTP request duration in seconds',
      ['method', 'route']
    );

    this.websocketConnectionsGauge = this.createGauge(
      'websocket_connections',
      'Current WebSocket connections',
      ['room_type']
    );

    this.databaseQueryDurationHistogram = this.createHistogram(
      'database_query_duration_seconds',
      'Database query duration in seconds',
      ['operation', 'table']
    );

    // Start collecting default metrics if enabled
    if (this.config.collectDefaultMetrics) {
      this.startDefaultMetricsCollection();
    }
  }

  // ============================================================================
  // Metric Factory Methods
  // ============================================================================

  /**
   * Create a counter metric
   * O(1)
   */
  createCounter(name: string, help: string, labelNames: string[] = []): MockCounter {
    const fullName = this.config.prefix + name;
    if (this.counters.has(fullName)) {
      return this.counters.get(fullName)!;
    }

    const counter = new MockCounter(fullName, help, labelNames);
    this.counters.set(fullName, counter);
    return counter;
  }

  /**
   * Create a gauge metric
   * O(1)
   */
  createGauge(name: string, help: string, labelNames: string[] = []): MockGauge {
    const fullName = this.config.prefix + name;
    if (this.gauges.has(fullName)) {
      return this.gauges.get(fullName)!;
    }

    const gauge = new MockGauge(fullName, help, labelNames);
    this.gauges.set(fullName, gauge);
    return gauge;
  }

  /**
   * Create a histogram metric
   * O(1)
   */
  createHistogram(
    name: string,
    help: string,
    labelNames: string[] = [],
    buckets?: number[]
  ): MockHistogram {
    const fullName = this.config.prefix + name;
    if (this.histograms.has(fullName)) {
      return this.histograms.get(fullName)!;
    }

    const histogram = new MockHistogram(
      fullName,
      help,
      labelNames,
      buckets || this.config.histogramBuckets
    );
    this.histograms.set(fullName, histogram);
    return histogram;
  }

  /**
   * Create a summary metric
   * O(1)
   */
  createSummary(
    name: string,
    help: string,
    labelNames: string[] = [],
    percentiles?: number[]
  ): MockSummary {
    const fullName = this.config.prefix + name;
    if (this.summaries.has(fullName)) {
      return this.summaries.get(fullName)!;
    }

    const summary = new MockSummary(
      fullName,
      help,
      labelNames,
      percentiles || this.config.summaryPercentiles
    );
    this.summaries.set(fullName, summary);
    return summary;
  }

  // ============================================================================
  // Convenience Methods
  // ============================================================================

  /**
   * Record a prediction
   * O(1)
   */
  recordPrediction(type: string, status: 'success' | 'failure', model: string = 'default'): void {
    this.predictionCounter.inc({ type, status, model });
  }

  /**
   * Time a simulation
   * O(1)
   */
  timeSimulation(type: string): () => number {
    return this.simulationDurationHistogram.startTimer({ type, status: 'running' });
  }

  /**
   * Record API latency
   * O(1)
   */
  recordApiLatency(
    method: string,
    route: string,
    statusCode: number,
    durationSeconds: number
  ): void {
    this.apiLatencyHistogram.observe(
      { method, route, status_code: statusCode.toString() },
      durationSeconds
    );
    this.httpRequestsCounter.inc({
      method,
      route,
      status_code: statusCode.toString(),
    });
  }

  /**
   * Record a signal
   * O(1)
   */
  recordSignal(type: string, urgency: string, source: string = 'manual'): void {
    this.signalCounter.inc({ type, urgency, source });
  }

  /**
   * Record a decision
   * O(1)
   */
  recordDecision(status: string, phase: string): void {
    this.decisionCounter.inc({ status, phase });
  }

  /**
   * Update active users count
   * O(1)
   */
  setActiveUsers(count: number, type: string = 'total'): void {
    this.activeUsersGauge.set({ type }, count);
  }

  /**
   * Update queue size
   * O(1)
   */
  setQueueSize(queueName: string, size: number, status: string = 'waiting'): void {
    this.queueSizeGauge.set({ queue_name: queueName, status }, size);
  }

  /**
   * Update cache hit ratio
   * O(1)
   */
  setCacheHitRatio(cacheName: string, ratio: number): void {
    this.cacheHitRatioGauge.set({ cache_name: cacheName }, ratio);
  }

  /**
   * Record an error
   * O(1)
   */
  recordError(type: string, code: string, source: string = 'unknown'): void {
    this.errorCounter.inc({ type, code, source });
  }

  /**
   * Update WebSocket connections
   * O(1)
   */
  setWebSocketConnections(roomType: string, count: number): void {
    this.websocketConnectionsGauge.set({ room_type: roomType }, count);
  }

  /**
   * Time a database query
   * O(1)
   */
  timeDatabaseQuery(operation: string, table: string): () => number {
    return this.databaseQueryDurationHistogram.startTimer({ operation, table });
  }

  // ============================================================================
  // Metrics Collection
  // ============================================================================

  /**
   * Collect all metrics in Prometheus format
   * O(n) where n is total metric samples
   */
  async collect(): Promise<string> {
    const parts: string[] = [];

    // Add default metrics
    parts.push(this.collectDefaultMetrics());

    // Collect all registered metrics
    for (const counter of this.counters.values()) {
      parts.push(counter.collect());
    }

    for (const gauge of this.gauges.values()) {
      parts.push(gauge.collect());
    }

    for (const histogram of this.histograms.values()) {
      parts.push(histogram.collect());
    }

    for (const summary of this.summaries.values()) {
      parts.push(summary.collect());
    }

    return parts.filter(p => p.trim()).join('\n');
  }

  /**
   * Get metrics content type
   */
  getContentType(): string {
    return 'text/plain; version=0.0.4; charset=utf-8';
  }

  // ============================================================================
  // Health Checks
  // ============================================================================

  /**
   * Register a health check
   * O(1)
   */
  registerHealthCheck(
    name: string,
    check: () => Promise<{ status: 'pass' | 'warn' | 'fail'; message?: string }>
  ): void {
    const healthCheck: HealthCheck = {
      name,
      status: 'pass',
      lastCheck: 0,
    };

    this.healthChecks.push(healthCheck);

    // Run check periodically
    setInterval(async () => {
      const start = Date.now();
      try {
        const result = await check();
        healthCheck.status = result.status;
        healthCheck.message = result.message;
        healthCheck.duration = Date.now() - start;
      } catch (error) {
        healthCheck.status = 'fail';
        healthCheck.message = error instanceof Error ? error.message : 'Unknown error';
        healthCheck.duration = Date.now() - start;
      }
      healthCheck.lastCheck = Date.now();
    }, 30000);
  }

  /**
   * Get health status
   * O(checks)
   */
  async getHealthStatus(): Promise<HealthStatus> {
    const uptimeMs = Date.now() - this.startTime;
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    // Run all checks
    const checks = await Promise.all(
      this.healthChecks.map(async (check) => {
        return { ...check };
      })
    );

    // Determine overall status
    const hasFailures = checks.some(c => c.status === 'fail');
    const hasWarnings = checks.some(c => c.status === 'warn');

    if (hasFailures) {
      overallStatus = 'unhealthy';
    } else if (hasWarnings) {
      overallStatus = 'degraded';
    }

    return {
      status: overallStatus,
      timestamp: Date.now(),
      uptime: uptimeMs,
      version: process.env.npm_package_version || '1.0.0',
      checks,
    };
  }

  /**
   * Basic health check endpoint response
   * O(1)
   */
  async basicHealthCheck(): Promise<{ status: string; uptime: number }> {
    return {
      status: 'ok',
      uptime: Date.now() - this.startTime,
    };
  }

  /**
   * Detailed health check endpoint response
   * O(checks)
   */
  async detailedHealthCheck(): Promise<HealthStatus> {
    return this.getHealthStatus();
  }

  // ============================================================================
  // Default Metrics
  // ============================================================================

  private startDefaultMetricsCollection(): void {
    // Create default gauges
    const processMemoryGauge = this.createGauge(
      'process_memory_bytes',
      'Process memory usage in bytes',
      ['type']
    );

    const processUptimeGauge = this.createGauge(
      'process_uptime_seconds',
      'Process uptime in seconds'
    );

    const nodeVersionGauge = this.createGauge(
      'nodejs_version_info',
      'Node.js version info',
      ['version']
    );

    // Collect default metrics periodically
    this.intervalId = setInterval(() => {
      const memory = process.memoryUsage();
      processMemoryGauge.set({ type: 'heapTotal' }, memory.heapTotal);
      processMemoryGauge.set({ type: 'heapUsed' }, memory.heapUsed);
      processMemoryGauge.set({ type: 'external' }, memory.external);
      processMemoryGauge.set({ type: 'rss' }, memory.rss);

      processUptimeGauge.set(process.uptime());
      nodeVersionGauge.set({ version: process.version }, 1);
    }, this.config.defaultMetricsInterval);
  }

  private collectDefaultMetrics(): string {
    const uptime = (Date.now() - this.startTime) / 1000;
    const memory = process.memoryUsage();

    return `# HELP ${this.config.prefix}process_start_time_seconds Start time of the process
# TYPE ${this.config.prefix}process_start_time_seconds gauge
${this.config.prefix}process_start_time_seconds ${this.startTime / 1000}
`;
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  /**
   * Shutdown metrics collection
   * O(1)
   */
  async shutdown(): Promise<void> {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.emit('shutdown');
  }
}

// ============================================================================
// Singleton & Factory
// ============================================================================

let metricsInstance: OracleMetrics | null = null;

/**
 * Get the singleton metrics instance
 */
export function getMetrics(config?: Partial<MetricsConfig>): OracleMetrics {
  if (!metricsInstance) {
    metricsInstance = new OracleMetrics(config);
  }
  return metricsInstance;
}

/**
 * Create a new metrics instance (for testing)
 */
export function createMetrics(config?: Partial<MetricsConfig>): OracleMetrics {
  return new OracleMetrics(config);
}

// ============================================================================
// Fastify Plugin
// ============================================================================

/**
 * Fastify plugin for metrics middleware
 */
export function metricsPlugin(fastify: any, _options: unknown, done: () => void): void {
  const metrics = getMetrics();

  // Add request timing
  fastify.addHook('onRequest', async (request: any) => {
    request.metricsStartTime = process.hrtime.bigint();
  });

  fastify.addHook('onResponse', async (request: any, reply: any) => {
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - request.metricsStartTime) / 1e9;

    metrics.recordApiLatency(
      request.method,
      request.routerPath || request.url,
      reply.statusCode,
      duration
    );
  });

  // Health check endpoints
  fastify.get('/health', async () => {
    return metrics.basicHealthCheck();
  });

  fastify.get('/health/live', async () => {
    return { status: 'ok' };
  });

  fastify.get('/health/ready', async () => {
    const health = await metrics.getHealthStatus();
    return {
      status: health.status === 'healthy' ? 'ok' : 'not ready',
      checks: health.checks,
    };
  });

  // Metrics endpoint
  fastify.get('/metrics', async (_request: any, reply: any) => {
    reply.type(metrics.getContentType());
    return metrics.collect();
  });

  done();
}

// ============================================================================
// Grafana Dashboard Configuration
// ============================================================================

/**
 * Export Grafana dashboard JSON configuration
 */
export function getGrafanaDashboard(): object {
  return {
    dashboard: {
      id: null,
      uid: 'oracle-overview',
      title: 'ORACLE Overview',
      description: 'ORACLE v2.0 Production Monitoring Dashboard',
      tags: ['oracle', 'production', 'monitoring'],
      timezone: 'browser',
      schemaVersion: 38,
      version: 1,
      refresh: '30s',
      time: {
        from: 'now-1h',
        to: 'now',
      },
      panels: [
        // Row: Overview
        {
          id: 1,
          type: 'row',
          title: 'Overview',
          gridPos: { x: 0, y: 0, w: 24, h: 1 },
        },
        // Total Predictions
        {
          id: 2,
          type: 'stat',
          title: 'Total Predictions',
          gridPos: { x: 0, y: 1, w: 6, h: 4 },
          targets: [
            {
              expr: 'sum(oracle_predictions_total)',
              legendFormat: 'Total',
            },
          ],
          options: {
            colorMode: 'value',
            graphMode: 'area',
          },
        },
        // Success Rate
        {
          id: 3,
          type: 'gauge',
          title: 'Prediction Success Rate',
          gridPos: { x: 6, y: 1, w: 6, h: 4 },
          targets: [
            {
              expr: 'sum(oracle_predictions_total{status="success"}) / sum(oracle_predictions_total) * 100',
              legendFormat: 'Success Rate',
            },
          ],
          options: {
            showThresholdLabels: false,
            showThresholdMarkers: true,
          },
          fieldConfig: {
            defaults: {
              thresholds: {
                mode: 'absolute',
                steps: [
                  { color: 'red', value: 0 },
                  { color: 'yellow', value: 80 },
                  { color: 'green', value: 95 },
                ],
              },
              unit: 'percent',
              min: 0,
              max: 100,
            },
          },
        },
        // Active Users
        {
          id: 4,
          type: 'stat',
          title: 'Active Users',
          gridPos: { x: 12, y: 1, w: 6, h: 4 },
          targets: [
            {
              expr: 'oracle_active_users{type="total"}',
              legendFormat: 'Active',
            },
          ],
        },
        // API Request Rate
        {
          id: 5,
          type: 'stat',
          title: 'Request Rate',
          gridPos: { x: 18, y: 1, w: 6, h: 4 },
          targets: [
            {
              expr: 'rate(oracle_http_requests_total[5m])',
              legendFormat: 'req/s',
            },
          ],
          options: {
            colorMode: 'value',
          },
          fieldConfig: {
            defaults: {
              unit: 'reqps',
            },
          },
        },

        // Row: Performance
        {
          id: 10,
          type: 'row',
          title: 'Performance',
          gridPos: { x: 0, y: 5, w: 24, h: 1 },
        },
        // API Latency
        {
          id: 11,
          type: 'timeseries',
          title: 'API Latency (p95)',
          gridPos: { x: 0, y: 6, w: 12, h: 8 },
          targets: [
            {
              expr: 'histogram_quantile(0.95, rate(oracle_api_latency_seconds_bucket[5m]))',
              legendFormat: 'p95',
            },
            {
              expr: 'histogram_quantile(0.50, rate(oracle_api_latency_seconds_bucket[5m]))',
              legendFormat: 'p50',
            },
          ],
          fieldConfig: {
            defaults: {
              unit: 's',
            },
          },
        },
        // Simulation Duration
        {
          id: 12,
          type: 'timeseries',
          title: 'Simulation Duration',
          gridPos: { x: 12, y: 6, w: 12, h: 8 },
          targets: [
            {
              expr: 'histogram_quantile(0.95, rate(oracle_simulation_duration_seconds_bucket[5m]))',
              legendFormat: '{{type}} p95',
            },
          ],
          fieldConfig: {
            defaults: {
              unit: 's',
            },
          },
        },

        // Row: Queue Status
        {
          id: 20,
          type: 'row',
          title: 'Queue Status',
          gridPos: { x: 0, y: 14, w: 24, h: 1 },
        },
        // Queue Sizes
        {
          id: 21,
          type: 'timeseries',
          title: 'Queue Sizes',
          gridPos: { x: 0, y: 15, w: 12, h: 6 },
          targets: [
            {
              expr: 'oracle_queue_size',
              legendFormat: '{{queue_name}} - {{status}}',
            },
          ],
        },
        // Error Rate
        {
          id: 22,
          type: 'timeseries',
          title: 'Error Rate',
          gridPos: { x: 12, y: 15, w: 12, h: 6 },
          targets: [
            {
              expr: 'rate(oracle_errors_total[5m])',
              legendFormat: '{{type}} - {{source}}',
            },
          ],
          fieldConfig: {
            defaults: {
              unit: 'short',
              custom: {
                lineStyle: {
                  fill: 'solid',
                },
              },
            },
          },
        },

        // Row: Infrastructure
        {
          id: 30,
          type: 'row',
          title: 'Infrastructure',
          gridPos: { x: 0, y: 21, w: 24, h: 1 },
        },
        // Memory Usage
        {
          id: 31,
          type: 'timeseries',
          title: 'Memory Usage',
          gridPos: { x: 0, y: 22, w: 8, h: 6 },
          targets: [
            {
              expr: 'oracle_process_memory_bytes',
              legendFormat: '{{type}}',
            },
          ],
          fieldConfig: {
            defaults: {
              unit: 'bytes',
            },
          },
        },
        // WebSocket Connections
        {
          id: 32,
          type: 'timeseries',
          title: 'WebSocket Connections',
          gridPos: { x: 8, y: 22, w: 8, h: 6 },
          targets: [
            {
              expr: 'oracle_websocket_connections',
              legendFormat: '{{room_type}}',
            },
          ],
        },
        // Cache Hit Ratio
        {
          id: 33,
          type: 'gauge',
          title: 'Cache Hit Ratio',
          gridPos: { x: 16, y: 22, w: 8, h: 6 },
          targets: [
            {
              expr: 'oracle_cache_hit_ratio',
              legendFormat: '{{cache_name}}',
            },
          ],
          fieldConfig: {
            defaults: {
              unit: 'percentunit',
              min: 0,
              max: 1,
              thresholds: {
                mode: 'absolute',
                steps: [
                  { color: 'red', value: 0 },
                  { color: 'yellow', value: 0.7 },
                  { color: 'green', value: 0.9 },
                ],
              },
            },
          },
        },
      ],
      templating: {
        list: [
          {
            name: 'datasource',
            type: 'datasource',
            query: 'prometheus',
            current: { selected: true, text: 'Prometheus', value: 'Prometheus' },
          },
        ],
      },
      annotations: {
        list: [
          {
            name: 'Deployments',
            datasource: 'prometheus',
            enable: true,
            expr: 'changes(oracle_process_start_time_seconds[5m])',
            titleFormat: 'Deployment',
            tagKeys: 'service',
          },
        ],
      },
    },
    overwrite: true,
    inputs: [],
    folderId: 0,
  };
}

/**
 * Export Prometheus alert rules
 */
export function getAlertRules(): object {
  return {
    groups: [
      {
        name: 'oracle-slo',
        rules: [
          {
            alert: 'HighErrorRate',
            expr: 'rate(oracle_errors_total[5m]) > 0.1',
            for: '5m',
            labels: { severity: 'warning' },
            annotations: {
              summary: 'High error rate detected',
              description: 'Error rate is {{ $value }} errors/second',
            },
          },
          {
            alert: 'HighLatency',
            expr: 'histogram_quantile(0.95, rate(oracle_api_latency_seconds_bucket[5m])) > 0.5',
            for: '5m',
            labels: { severity: 'warning' },
            annotations: {
              summary: 'High API latency detected',
              description: 'p95 latency is {{ $value }}s',
            },
          },
          {
            alert: 'LowCacheHitRatio',
            expr: 'oracle_cache_hit_ratio < 0.5',
            for: '10m',
            labels: { severity: 'warning' },
            annotations: {
              summary: 'Low cache hit ratio',
              description: 'Cache hit ratio is {{ $value }}',
            },
          },
          {
            alert: 'HighQueueSize',
            expr: 'oracle_queue_size{status="waiting"} > 1000',
            for: '5m',
            labels: { severity: 'warning' },
            annotations: {
              summary: 'High queue size detected',
              description: 'Queue {{ $labels.queue_name }} has {{ $value }} waiting jobs',
            },
          },
          {
            alert: 'PredictionFailureRate',
            expr: 'rate(oracle_predictions_total{status="failure"}[5m]) / rate(oracle_predictions_total[5m]) > 0.1',
            for: '5m',
            labels: { severity: 'critical' },
            annotations: {
              summary: 'High prediction failure rate',
              description: 'Prediction failure rate is {{ $value | humanizePercentage }}',
            },
          },
        ],
      },
    ],
  };
}

export default OracleMetrics;
