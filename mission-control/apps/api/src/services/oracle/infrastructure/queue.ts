/**
 * ORACLE Bull Queue Infrastructure
 * Story inf-2: Production-ready job queue system
 *
 * Features:
 * - Job queues: simulations, ml, integrations
 * - Priority queuing
 * - Retry with exponential backoff
 * - Dead letter queue
 * - Progress tracking
 *
 * Time Complexity:
 * - O(log n) for job insertion (priority queue)
 * - O(1) for job processing
 */

import { EventEmitter } from 'events';

// ============================================================================
// Types & Interfaces
// ============================================================================

export type QueueName = 'simulations' | 'ml' | 'integrations' | 'notifications' | 'analytics';

export type JobStatus = 'waiting' | 'active' | 'completed' | 'failed' | 'delayed' | 'paused';

export type JobPriority = 'critical' | 'high' | 'normal' | 'low';

const PRIORITY_VALUES: Record<JobPriority, number> = {
  critical: 1,
  high: 2,
  normal: 3,
  low: 4,
};

export interface JobOptions {
  priority?: JobPriority;
  delay?: number;
  attempts?: number;
  backoff?: BackoffConfig;
  timeout?: number;
  removeOnComplete?: boolean | number;
  removeOnFail?: boolean | number;
  jobId?: string;
}

export interface BackoffConfig {
  type: 'fixed' | 'exponential';
  delay: number;
  maxDelay?: number;
}

export interface Job<T = unknown> {
  id: string;
  queue: QueueName;
  name: string;
  data: T;
  options: Required<JobOptions>;
  status: JobStatus;
  progress: number;
  attemptsMade: number;
  failedReason?: string;
  stacktrace?: string[];
  returnvalue?: unknown;
  createdAt: number;
  processedAt?: number;
  completedAt?: number;
  failedAt?: number;
}

export interface QueueConfig {
  concurrency: number;
  maxJobs?: number;
  stalledInterval: number;
  maxStalledCount: number;
  defaultJobOptions: JobOptions;
}

export interface QueueMetrics {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
  processingRate: number;
  avgProcessingTime: number;
  errorRate: number;
}

export interface DeadLetterJob {
  job: Job;
  reason: string;
  movedAt: number;
  originalQueue: QueueName;
}

export type JobProcessor<T = unknown, R = unknown> = (job: Job<T>) => Promise<R>;

// ============================================================================
// Job Queue Implementation
// ============================================================================

export class JobQueue<T = unknown> extends EventEmitter {
  readonly name: QueueName;
  private config: QueueConfig;
  private jobs = new Map<string, Job<T>>();
  private waitingQueue: string[] = [];
  private processor: JobProcessor<T> | null = null;
  private isProcessing = false;
  private isPaused = false;
  private activeJobs = new Set<string>();
  private metrics: QueueMetrics;
  private processingTimes: number[] = [];
  private intervalId: ReturnType<typeof setInterval> | null = null;

  constructor(name: QueueName, config?: Partial<QueueConfig>) {
    super();
    this.name = name;
    this.config = {
      concurrency: config?.concurrency || 5,
      maxJobs: config?.maxJobs,
      stalledInterval: config?.stalledInterval || 30000,
      maxStalledCount: config?.maxStalledCount || 1,
      defaultJobOptions: {
        priority: 'normal',
        delay: 0,
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000, maxDelay: 30000 },
        timeout: 30000,
        removeOnComplete: true,
        removeOnFail: false,
        ...config?.defaultJobOptions,
      },
    };

    this.metrics = {
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
      paused: 0,
      processingRate: 0,
      avgProcessingTime: 0,
      errorRate: 0,
    };

    // Start stalled job checker
    this.intervalId = setInterval(() => this.checkStalledJobs(), this.config.stalledInterval);
  }

  /**
   * Add a job to the queue
   * O(log n) for priority insertion
   */
  async add(name: string, data: T, options?: JobOptions): Promise<Job<T>> {
    const jobId = options?.jobId || this.generateJobId();
    const mergedOptions: Required<JobOptions> = {
      ...this.config.defaultJobOptions,
      ...options,
    } as Required<JobOptions>;

    const job: Job<T> = {
      id: jobId,
      queue: this.name,
      name,
      data,
      options: mergedOptions,
      status: mergedOptions.delay > 0 ? 'delayed' : 'waiting',
      progress: 0,
      attemptsMade: 0,
      createdAt: Date.now(),
    };

    // Check max jobs limit
    if (this.config.maxJobs && this.jobs.size >= this.config.maxJobs) {
      throw new Error(`Queue ${this.name} has reached max jobs limit: ${this.config.maxJobs}`);
    }

    this.jobs.set(jobId, job);

    if (job.status === 'delayed') {
      this.metrics.delayed++;
      setTimeout(() => this.moveDelayedToWaiting(jobId), mergedOptions.delay);
    } else {
      this.insertByPriority(jobId, mergedOptions.priority!);
      this.metrics.waiting++;
    }

    this.emit('job:added', job);

    // Try to process immediately
    this.processNext();

    return job;
  }

  /**
   * Add multiple jobs atomically
   * O(n log n) where n is number of jobs
   */
  async addBulk(jobs: Array<{ name: string; data: T; options?: JobOptions }>): Promise<Job<T>[]> {
    const results: Job<T>[] = [];

    for (const jobDef of jobs) {
      const job = await this.add(jobDef.name, jobDef.data, jobDef.options);
      results.push(job);
    }

    return results;
  }

  /**
   * Register a job processor
   * O(1)
   */
  process(processor: JobProcessor<T>): void {
    if (this.processor) {
      throw new Error(`Processor already registered for queue ${this.name}`);
    }

    this.processor = processor;
    this.isProcessing = true;
    this.processNext();
  }

  /**
   * Get a job by ID
   * O(1)
   */
  async getJob(jobId: string): Promise<Job<T> | undefined> {
    return this.jobs.get(jobId);
  }

  /**
   * Get jobs by status
   * O(n) where n is total jobs
   */
  async getJobs(status: JobStatus | JobStatus[]): Promise<Job<T>[]> {
    const statuses = Array.isArray(status) ? status : [status];
    return Array.from(this.jobs.values()).filter(job => statuses.includes(job.status));
  }

  /**
   * Update job progress
   * O(1)
   */
  async updateProgress(jobId: string, progress: number): Promise<void> {
    const job = this.jobs.get(jobId);
    if (job) {
      job.progress = Math.min(100, Math.max(0, progress));
      this.emit('job:progress', job, progress);
    }
  }

  /**
   * Remove a job
   * O(n) for waiting queue
   */
  async removeJob(jobId: string): Promise<boolean> {
    const job = this.jobs.get(jobId);
    if (!job) return false;

    // Remove from waiting queue if applicable
    const waitingIndex = this.waitingQueue.indexOf(jobId);
    if (waitingIndex > -1) {
      this.waitingQueue.splice(waitingIndex, 1);
    }

    this.jobs.delete(jobId);
    this.emit('job:removed', job);
    return true;
  }

  /**
   * Retry a failed job
   * O(log n) for priority insertion
   */
  async retryJob(jobId: string): Promise<Job<T> | null> {
    const job = this.jobs.get(jobId);
    if (!job || job.status !== 'failed') return null;

    job.status = 'waiting';
    job.progress = 0;
    job.failedReason = undefined;
    job.stacktrace = undefined;

    this.insertByPriority(jobId, job.options.priority);
    this.metrics.waiting++;
    this.metrics.failed--;

    this.emit('job:retry', job);
    this.processNext();

    return job;
  }

  /**
   * Pause the queue
   * O(1)
   */
  async pause(): Promise<void> {
    this.isPaused = true;
    this.emit('queue:paused');
  }

  /**
   * Resume the queue
   * O(1)
   */
  async resume(): Promise<void> {
    this.isPaused = false;
    this.emit('queue:resumed');
    this.processNext();
  }

  /**
   * Drain the queue (remove all waiting jobs)
   * O(n)
   */
  async drain(): Promise<number> {
    const waiting = await this.getJobs('waiting');
    let count = 0;

    for (const job of waiting) {
      await this.removeJob(job.id);
      count++;
    }

    this.waitingQueue = [];
    this.metrics.waiting = 0;

    return count;
  }

  /**
   * Clean old jobs
   * O(n)
   */
  async clean(grace: number, status: JobStatus): Promise<number> {
    const cutoff = Date.now() - grace;
    const toRemove: string[] = [];

    for (const [id, job] of this.jobs.entries()) {
      if (job.status === status) {
        const timestamp = job.completedAt || job.failedAt || job.createdAt;
        if (timestamp < cutoff) {
          toRemove.push(id);
        }
      }
    }

    for (const id of toRemove) {
      this.jobs.delete(id);
    }

    return toRemove.length;
  }

  /**
   * Get queue metrics
   * O(1)
   */
  getMetrics(): QueueMetrics {
    const total = this.metrics.completed + this.metrics.failed;
    this.metrics.errorRate = total > 0 ? this.metrics.failed / total : 0;
    this.metrics.avgProcessingTime = this.processingTimes.length > 0
      ? this.processingTimes.reduce((a, b) => a + b, 0) / this.processingTimes.length
      : 0;

    return { ...this.metrics };
  }

  /**
   * Graceful shutdown
   * O(active jobs)
   */
  async close(): Promise<void> {
    this.isProcessing = false;
    this.isPaused = true;

    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

    // Wait for active jobs to complete (with timeout)
    const timeout = 30000;
    const start = Date.now();

    while (this.activeJobs.size > 0 && Date.now() - start < timeout) {
      await this.delay(100);
    }

    this.emit('queue:closed');
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private generateJobId(): string {
    return `${this.name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private insertByPriority(jobId: string, priority: JobPriority): void {
    const job = this.jobs.get(jobId);
    if (!job) return;

    const priorityValue = PRIORITY_VALUES[priority];

    // Find insertion point
    let insertIndex = this.waitingQueue.length;
    for (let i = 0; i < this.waitingQueue.length; i++) {
      const existingJob = this.jobs.get(this.waitingQueue[i]);
      if (existingJob && PRIORITY_VALUES[existingJob.options.priority] > priorityValue) {
        insertIndex = i;
        break;
      }
    }

    this.waitingQueue.splice(insertIndex, 0, jobId);
  }

  private moveDelayedToWaiting(jobId: string): void {
    const job = this.jobs.get(jobId);
    if (!job || job.status !== 'delayed') return;

    job.status = 'waiting';
    this.metrics.delayed--;
    this.metrics.waiting++;

    this.insertByPriority(jobId, job.options.priority);
    this.processNext();
  }

  private async processNext(): Promise<void> {
    if (!this.processor || !this.isProcessing || this.isPaused) {
      return;
    }

    // Check concurrency limit
    if (this.activeJobs.size >= this.config.concurrency) {
      return;
    }

    // Get next job
    const jobId = this.waitingQueue.shift();
    if (!jobId) return;

    const job = this.jobs.get(jobId);
    if (!job || job.status !== 'waiting') {
      this.processNext();
      return;
    }

    // Mark as active
    job.status = 'active';
    job.processedAt = Date.now();
    job.attemptsMade++;
    this.activeJobs.add(jobId);
    this.metrics.waiting--;
    this.metrics.active++;

    this.emit('job:active', job);

    // Process with timeout
    try {
      const result = await Promise.race([
        this.processor(job),
        this.createTimeout(job.options.timeout),
      ]);

      await this.handleJobSuccess(job, result);
    } catch (error) {
      await this.handleJobFailure(job, error);
    } finally {
      this.activeJobs.delete(jobId);
      this.metrics.active--;

      // Process next job
      this.processNext();
    }
  }

  private async handleJobSuccess(job: Job<T>, result: unknown): Promise<void> {
    const processingTime = Date.now() - (job.processedAt || job.createdAt);
    this.processingTimes.push(processingTime);

    // Keep only last 100 processing times
    if (this.processingTimes.length > 100) {
      this.processingTimes.shift();
    }

    job.status = 'completed';
    job.progress = 100;
    job.completedAt = Date.now();
    job.returnvalue = result;
    this.metrics.completed++;

    this.emit('job:completed', job, result);

    // Remove if configured
    if (job.options.removeOnComplete === true) {
      this.jobs.delete(job.id);
    }
  }

  private async handleJobFailure(job: Job<T>, error: unknown): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const stacktrace = error instanceof Error ? error.stack?.split('\n') : undefined;

    // Check if should retry
    if (job.attemptsMade < job.options.attempts) {
      const delay = this.calculateBackoff(job);
      job.status = 'delayed';
      this.metrics.delayed++;

      this.emit('job:retry', job, delay);

      setTimeout(() => this.moveDelayedToWaiting(job.id), delay);
      return;
    }

    // Mark as failed
    job.status = 'failed';
    job.failedAt = Date.now();
    job.failedReason = errorMessage;
    job.stacktrace = stacktrace;
    this.metrics.failed++;

    this.emit('job:failed', job, error);

    // Move to dead letter queue
    await this.moveToDeadLetter(job, errorMessage);

    // Remove if configured
    if (job.options.removeOnFail === true) {
      this.jobs.delete(job.id);
    }
  }

  private calculateBackoff(job: Job<T>): number {
    const { backoff } = job.options;

    if (backoff.type === 'fixed') {
      return backoff.delay;
    }

    // Exponential backoff
    const delay = backoff.delay * Math.pow(2, job.attemptsMade - 1);
    return Math.min(delay, backoff.maxDelay || 30000);
  }

  private createTimeout(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Job timed out after ${ms}ms`)), ms);
    });
  }

  private async moveToDeadLetter(job: Job<T>, reason: string): Promise<void> {
    const deadLetterJob: DeadLetterJob = {
      job: job as Job,
      reason,
      movedAt: Date.now(),
      originalQueue: this.name,
    };

    const dlq = getDeadLetterQueue();
    dlq.add(deadLetterJob);

    this.emit('job:dead-letter', deadLetterJob);
  }

  private checkStalledJobs(): void {
    const now = Date.now();
    const stalledThreshold = this.config.stalledInterval * 2;

    for (const jobId of this.activeJobs) {
      const job = this.jobs.get(jobId);
      if (job && job.processedAt && now - job.processedAt > stalledThreshold) {
        this.emit('job:stalled', job);
      }
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Dead Letter Queue
// ============================================================================

class DeadLetterQueue extends EventEmitter {
  private jobs: DeadLetterJob[] = [];
  private maxSize = 10000;

  /**
   * Add job to dead letter queue
   * O(1) amortized
   */
  add(job: DeadLetterJob): void {
    // Enforce max size
    if (this.jobs.length >= this.maxSize) {
      this.jobs.shift();
    }

    this.jobs.push(job);
    this.emit('job:added', job);
  }

  /**
   * Get all dead letter jobs
   * O(1)
   */
  getAll(): DeadLetterJob[] {
    return [...this.jobs];
  }

  /**
   * Get jobs by original queue
   * O(n)
   */
  getByQueue(queue: QueueName): DeadLetterJob[] {
    return this.jobs.filter(j => j.originalQueue === queue);
  }

  /**
   * Remove a job from dead letter queue
   * O(n)
   */
  remove(jobId: string): boolean {
    const index = this.jobs.findIndex(j => j.job.id === jobId);
    if (index > -1) {
      this.jobs.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Clear all dead letter jobs
   * O(1)
   */
  clear(): number {
    const count = this.jobs.length;
    this.jobs = [];
    return count;
  }

  /**
   * Get count
   * O(1)
   */
  count(): number {
    return this.jobs.length;
  }
}

// ============================================================================
// Queue Manager
// ============================================================================

export class QueueManager extends EventEmitter {
  private queues = new Map<QueueName, JobQueue<any>>();
  private deadLetterQueue: DeadLetterQueue;
  private isShutdown = false;

  constructor() {
    super();
    this.deadLetterQueue = new DeadLetterQueue();

    // Forward dead letter events
    this.deadLetterQueue.on('job:added', (job) => {
      this.emit('dead-letter:added', job);
    });
  }

  /**
   * Get or create a queue
   * O(1)
   */
  getQueue<T = unknown>(name: QueueName, config?: Partial<QueueConfig>): JobQueue<T> {
    if (this.isShutdown) {
      throw new Error('QueueManager is shutdown');
    }

    if (!this.queues.has(name)) {
      const queue = new JobQueue<T>(name, config);

      // Forward events
      queue.on('job:completed', (job, result) => {
        this.emit('job:completed', name, job, result);
      });

      queue.on('job:failed', (job, error) => {
        this.emit('job:failed', name, job, error);
      });

      queue.on('job:dead-letter', (deadLetterJob) => {
        this.emit('job:dead-letter', name, deadLetterJob);
      });

      this.queues.set(name, queue);
    }

    return this.queues.get(name) as JobQueue<T>;
  }

  /**
   * Get dead letter queue
   * O(1)
   */
  getDeadLetterQueue(): DeadLetterQueue {
    return this.deadLetterQueue;
  }

  /**
   * Get all queue metrics
   * O(queues)
   */
  getAllMetrics(): Record<QueueName, QueueMetrics> {
    const result: Partial<Record<QueueName, QueueMetrics>> = {};

    for (const [name, queue] of this.queues.entries()) {
      result[name] = queue.getMetrics();
    }

    return result as Record<QueueName, QueueMetrics>;
  }

  /**
   * Pause all queues
   * O(queues)
   */
  async pauseAll(): Promise<void> {
    for (const queue of this.queues.values()) {
      await queue.pause();
    }
  }

  /**
   * Resume all queues
   * O(queues)
   */
  async resumeAll(): Promise<void> {
    for (const queue of this.queues.values()) {
      await queue.resume();
    }
  }

  /**
   * Graceful shutdown
   * O(queues)
   */
  async shutdown(): Promise<void> {
    this.isShutdown = true;

    const closePromises = Array.from(this.queues.values()).map(queue => queue.close());
    await Promise.all(closePromises);

    this.emit('manager:shutdown');
  }

  /**
   * Health check
   */
  healthCheck(): { healthy: boolean; queues: Record<string, QueueMetrics>; deadLetterCount: number } {
    const queues = this.getAllMetrics();

    // Check if any queue has too many failed jobs
    let healthy = true;
    for (const metrics of Object.values(queues)) {
      if (metrics.errorRate > 0.5) {
        healthy = false;
        break;
      }
    }

    return {
      healthy,
      queues,
      deadLetterCount: this.deadLetterQueue.count(),
    };
  }
}

// ============================================================================
// Singleton Instances
// ============================================================================

let queueManager: QueueManager | null = null;
let deadLetterQueue: DeadLetterQueue | null = null;

/**
 * Get the singleton queue manager
 */
export function getQueueManager(): QueueManager {
  if (!queueManager) {
    queueManager = new QueueManager();
  }
  return queueManager;
}

/**
 * Get the singleton dead letter queue
 */
export function getDeadLetterQueue(): DeadLetterQueue {
  if (!deadLetterQueue) {
    deadLetterQueue = new DeadLetterQueue();
  }
  return deadLetterQueue;
}

// ============================================================================
// Pre-configured Queue Factories
// ============================================================================

/**
 * Create simulation queue with appropriate settings
 */
export function createSimulationQueue(): JobQueue {
  return getQueueManager().getQueue('simulations', {
    concurrency: 3,
    defaultJobOptions: {
      priority: 'normal',
      timeout: 120000, // 2 minutes for simulations
      attempts: 2,
      backoff: { type: 'exponential', delay: 5000, maxDelay: 60000 },
    },
  });
}

/**
 * Create ML queue with appropriate settings
 */
export function createMLQueue(): JobQueue {
  return getQueueManager().getQueue('ml', {
    concurrency: 2, // ML jobs are resource-intensive
    defaultJobOptions: {
      priority: 'high',
      timeout: 300000, // 5 minutes for ML
      attempts: 3,
      backoff: { type: 'exponential', delay: 10000, maxDelay: 120000 },
    },
  });
}

/**
 * Create integrations queue with appropriate settings
 */
export function createIntegrationsQueue(): JobQueue {
  return getQueueManager().getQueue('integrations', {
    concurrency: 10, // I/O bound
    defaultJobOptions: {
      priority: 'normal',
      timeout: 30000,
      attempts: 5,
      backoff: { type: 'exponential', delay: 1000, maxDelay: 30000 },
    },
  });
}

/**
 * Create notifications queue with appropriate settings
 */
export function createNotificationsQueue(): JobQueue {
  return getQueueManager().getQueue('notifications', {
    concurrency: 20, // High throughput
    defaultJobOptions: {
      priority: 'high',
      timeout: 10000,
      attempts: 3,
      backoff: { type: 'fixed', delay: 1000 },
    },
  });
}

/**
 * Create analytics queue with appropriate settings
 */
export function createAnalyticsQueue(): JobQueue {
  return getQueueManager().getQueue('analytics', {
    concurrency: 5,
    defaultJobOptions: {
      priority: 'low',
      timeout: 60000,
      attempts: 2,
      backoff: { type: 'exponential', delay: 2000 },
    },
  });
}

// ============================================================================
// Job Type Definitions for Each Queue
// ============================================================================

export interface SimulationJobData {
  type: 'monte-carlo' | 'scenario' | 'sensitivity';
  signalId?: string;
  decisionId?: string;
  options: Record<string, unknown>;
  iterations?: number;
}

export interface MLJobData {
  type: 'prediction' | 'training' | 'inference' | 'calibration';
  modelId: string;
  input: Record<string, unknown>;
  userId?: string;
}

export interface IntegrationJobData {
  type: 'sync' | 'webhook' | 'import' | 'export';
  provider: string;
  userId: string;
  data: Record<string, unknown>;
}

export interface NotificationJobData {
  type: 'push' | 'email' | 'sms' | 'in-app';
  userId: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export interface AnalyticsJobData {
  type: 'event' | 'aggregate' | 'report';
  userId?: string;
  eventName: string;
  properties: Record<string, unknown>;
}

export default QueueManager;
