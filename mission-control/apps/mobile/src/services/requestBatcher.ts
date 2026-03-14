/**
 * ORACLE Request Batcher for Mobile
 * Story perf-3 - Client-side request batching
 *
 * Features:
 * - Automatic request batching
 * - Configurable batch window (50-200ms)
 * - Error handling per operation
 * - Retry logic with exponential backoff
 */

// ============================================================================
// TYPES
// ============================================================================

export type BatchOperationType =
  | 'signals.list'
  | 'signals.get'
  | 'signals.create'
  | 'signals.update'
  | 'signals.delete'
  | 'contexts.list'
  | 'contexts.get'
  | 'contexts.create'
  | 'decisions.list'
  | 'decisions.get'
  | 'decisions.create'
  | 'decisions.update'
  | 'plans.list'
  | 'plans.get'
  | 'plans.create'
  | 'steps.list'
  | 'steps.update'
  | 'ghost_actions.list'
  | 'ghost_actions.get'
  | 'ghost_actions.approve'
  | 'ghost_actions.reject'
  | 'analytics.record'
  | 'custom';

export interface BatchRequest {
  id: string;
  operation: BatchOperationType;
  path?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  params?: Record<string, any>;
  body?: any;
}

export interface BatchResponse {
  id: string;
  operation: BatchOperationType;
  success: boolean;
  data?: any;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  duration_ms: number;
}

export interface BatchResult {
  request_id: string;
  responses: BatchResponse[];
  total_duration_ms: number;
  processed_at: string;
}

interface PendingRequest {
  request: BatchRequest;
  resolve: (data: any) => void;
  reject: (error: Error) => void;
  timestamp: number;
}

export interface BatcherConfig {
  batchWindowMs: number;
  maxBatchSize: number;
  maxRetries: number;
  baseRetryDelayMs: number;
  apiBaseUrl: string;
  getAuthToken: () => Promise<string>;
  onBatchStart?: (requestCount: number) => void;
  onBatchComplete?: (result: BatchResult) => void;
  onBatchError?: (error: Error) => void;
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG: Partial<BatcherConfig> = {
  batchWindowMs: 100,
  maxBatchSize: 50,
  maxRetries: 3,
  baseRetryDelayMs: 1000,
};

// ============================================================================
// REQUEST BATCHER CLASS
// ============================================================================

export class RequestBatcher {
  private config: BatcherConfig;
  private pendingRequests: PendingRequest[] = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private isProcessing = false;
  private requestIdCounter = 0;

  constructor(config: Partial<BatcherConfig> & Pick<BatcherConfig, 'apiBaseUrl' | 'getAuthToken'>) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    } as BatcherConfig;
  }

  // --------------------------------------------------------------------------
  // Configuration
  // --------------------------------------------------------------------------

  setBatchWindow(windowMs: number): void {
    this.config.batchWindowMs = Math.max(50, Math.min(200, windowMs));
  }

  setMaxBatchSize(size: number): void {
    this.config.maxBatchSize = Math.max(1, Math.min(100, size));
  }

  // --------------------------------------------------------------------------
  // Request Methods
  // --------------------------------------------------------------------------

  /**
   * Add a request to the batch queue
   */
  async request<T = any>(
    operation: BatchOperationType,
    params?: Record<string, any>,
    body?: any
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const request: BatchRequest = {
        id: this.generateRequestId(),
        operation,
        params,
        body,
      };

      this.pendingRequests.push({
        request,
        resolve,
        reject,
        timestamp: Date.now(),
      });

      this.scheduleBatchFlush();
    });
  }

  /**
   * Add a custom request to the batch queue
   */
  async customRequest<T = any>(
    path: string,
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    params?: Record<string, any>,
    body?: any
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const request: BatchRequest = {
        id: this.generateRequestId(),
        operation: 'custom',
        path,
        method,
        params,
        body,
      };

      this.pendingRequests.push({
        request,
        resolve,
        reject,
        timestamp: Date.now(),
      });

      this.scheduleBatchFlush();
    });
  }

  // --------------------------------------------------------------------------
  // Convenience Methods
  // --------------------------------------------------------------------------

  // Signals
  async getSignals(params?: { status?: string; urgency?: string; limit?: number }) {
    return this.request('signals.list', params);
  }

  async getSignal(id: string) {
    return this.request('signals.get', { id });
  }

  async createSignal(data: any) {
    return this.request('signals.create', undefined, data);
  }

  async updateSignal(id: string, data: any) {
    return this.request('signals.update', { id }, data);
  }

  async deleteSignal(id: string) {
    return this.request('signals.delete', { id });
  }

  // Contexts
  async getContexts(params?: { limit?: number }) {
    return this.request('contexts.list', params);
  }

  async getContext(id: string) {
    return this.request('contexts.get', { id });
  }

  async createContext(data: any) {
    return this.request('contexts.create', undefined, data);
  }

  // Decisions
  async getDecisions(params?: { status?: string; limit?: number }) {
    return this.request('decisions.list', params);
  }

  async getDecision(id: string) {
    return this.request('decisions.get', { id });
  }

  async createDecision(data: any) {
    return this.request('decisions.create', undefined, data);
  }

  async updateDecision(id: string, data: any) {
    return this.request('decisions.update', { id }, data);
  }

  // Plans
  async getPlans(params?: { status?: string; limit?: number }) {
    return this.request('plans.list', params);
  }

  async getPlan(id: string) {
    return this.request('plans.get', { id });
  }

  async createPlan(data: any) {
    return this.request('plans.create', undefined, data);
  }

  // Steps
  async getSteps(planId: string) {
    return this.request('steps.list', { plan_id: planId });
  }

  async updateStep(id: string, data: any) {
    return this.request('steps.update', { id }, data);
  }

  // Ghost Actions
  async getGhostActions(params?: { status?: string; limit?: number }) {
    return this.request('ghost_actions.list', params);
  }

  async getGhostAction(id: string) {
    return this.request('ghost_actions.get', { id });
  }

  async approveGhostAction(id: string) {
    return this.request('ghost_actions.approve', { id });
  }

  async rejectGhostAction(id: string) {
    return this.request('ghost_actions.reject', { id });
  }

  // Analytics
  async recordAnalytics(event: any) {
    return this.request('analytics.record', undefined, event);
  }

  // --------------------------------------------------------------------------
  // Batch Processing
  // --------------------------------------------------------------------------

  private generateRequestId(): string {
    return `req_${Date.now()}_${++this.requestIdCounter}`;
  }

  private scheduleBatchFlush(): void {
    // If we're at max batch size, flush immediately
    if (this.pendingRequests.length >= this.config.maxBatchSize) {
      this.flushBatch();
      return;
    }

    // Schedule flush after batch window
    if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => {
        this.batchTimer = null;
        this.flushBatch();
      }, this.config.batchWindowMs);
    }
  }

  private async flushBatch(): Promise<void> {
    if (this.isProcessing || this.pendingRequests.length === 0) {
      return;
    }

    this.isProcessing = true;

    // Get requests to process
    const toProcess = this.pendingRequests.splice(0, this.config.maxBatchSize);
    const requests = toProcess.map(p => p.request);

    this.config.onBatchStart?.(requests.length);

    try {
      const result = await this.sendBatch(requests);

      // Match responses to pending requests
      for (const pending of toProcess) {
        const response = result.responses.find(r => r.id === pending.request.id);
        if (response) {
          if (response.success) {
            pending.resolve(response.data);
          } else {
            pending.reject(new Error(response.error?.message || 'Request failed'));
          }
        } else {
          pending.reject(new Error('No response received for request'));
        }
      }

      this.config.onBatchComplete?.(result);
    } catch (error) {
      // Reject all pending requests on batch failure
      for (const pending of toProcess) {
        pending.reject(error instanceof Error ? error : new Error('Batch request failed'));
      }

      this.config.onBatchError?.(error instanceof Error ? error : new Error('Unknown error'));
    } finally {
      this.isProcessing = false;

      // If there are more pending requests, schedule another flush
      if (this.pendingRequests.length > 0) {
        this.scheduleBatchFlush();
      }
    }
  }

  private async sendBatch(requests: BatchRequest[], attempt = 1): Promise<BatchResult> {
    const token = await this.config.getAuthToken();

    const response = await fetch(`${this.config.apiBaseUrl}/api/oracle/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-Request-ID': `batch_${Date.now()}`,
      },
      body: JSON.stringify({ operations: requests }),
    });

    if (!response.ok) {
      if (response.status >= 500 && attempt < this.config.maxRetries) {
        // Retry with exponential backoff
        const delay = this.config.baseRetryDelayMs * Math.pow(2, attempt - 1);
        await this.delay(delay);
        return this.sendBatch(requests, attempt + 1);
      }

      throw new Error(`Batch request failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // --------------------------------------------------------------------------
  // Utility Methods
  // --------------------------------------------------------------------------

  /**
   * Force flush all pending requests immediately
   */
  async flush(): Promise<void> {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    await this.flushBatch();
  }

  /**
   * Cancel all pending requests
   */
  cancel(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    for (const pending of this.pendingRequests) {
      pending.reject(new Error('Request cancelled'));
    }
    this.pendingRequests = [];
  }

  /**
   * Get the number of pending requests
   */
  getPendingCount(): number {
    return this.pendingRequests.length;
  }

  /**
   * Check if there are pending requests
   */
  hasPending(): boolean {
    return this.pendingRequests.length > 0;
  }
}

// ============================================================================
// REACT HOOK
// ============================================================================

import { useRef, useEffect, useCallback } from 'react';

export function useRequestBatcher(
  config: Partial<BatcherConfig> & Pick<BatcherConfig, 'apiBaseUrl' | 'getAuthToken'>
): RequestBatcher {
  const batcherRef = useRef<RequestBatcher>();

  if (!batcherRef.current) {
    batcherRef.current = new RequestBatcher(config);
  }

  // Flush on unmount
  useEffect(() => {
    return () => {
      batcherRef.current?.flush();
    };
  }, []);

  return batcherRef.current;
}

// ============================================================================
// SINGLETON FACTORY
// ============================================================================

let defaultBatcher: RequestBatcher | null = null;

export function getRequestBatcher(
  config?: Partial<BatcherConfig> & Pick<BatcherConfig, 'apiBaseUrl' | 'getAuthToken'>
): RequestBatcher {
  if (!defaultBatcher && config) {
    defaultBatcher = new RequestBatcher(config);
  }
  if (!defaultBatcher) {
    throw new Error('RequestBatcher not initialized. Call with config first.');
  }
  return defaultBatcher;
}

export function initRequestBatcher(
  config: Partial<BatcherConfig> & Pick<BatcherConfig, 'apiBaseUrl' | 'getAuthToken'>
): RequestBatcher {
  defaultBatcher = new RequestBatcher(config);
  return defaultBatcher;
}

export default RequestBatcher;
