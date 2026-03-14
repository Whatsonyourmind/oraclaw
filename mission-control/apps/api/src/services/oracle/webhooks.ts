/**
 * ORACLE Webhook Service
 * Story adv-9 - Webhook management and delivery with retry logic
 */

import * as crypto from 'crypto';
import type {
  Webhook,
  WebhookDelivery,
  WebhookEvent,
  WebhookPayload,
  WebhookEventType,
  WebhookDeliveryStatus,
  WebhookTestResult,
  WebhookStats,
} from '@mission-control/shared-types';

// Configuration
const WEBHOOK_CONFIG = {
  defaultRetryCount: 3,
  defaultRetryDelaySeconds: 60,
  defaultTimeoutSeconds: 30,
  maxRetryDelaySeconds: 3600, // 1 hour max
  signatureAlgorithm: 'sha256' as const,
  queueProcessInterval: 10000, // 10 seconds
};

// In-memory stores (would use database in production)
interface WebhookStore {
  webhooks: Map<string, Webhook>;
  deliveries: Map<string, WebhookDelivery>;
  events: Map<string, WebhookEvent>;
}

const store: WebhookStore = {
  webhooks: new Map(),
  deliveries: new Map(),
  events: new Map(),
};

// Delivery queue for async processing
interface QueuedDelivery {
  deliveryId: string;
  scheduledAt: number;
}

const deliveryQueue: QueuedDelivery[] = [];
let queueProcessorRunning = false;

export class OracleWebhookService {
  /**
   * Register a new webhook
   */
  async registerWebhook(params: {
    user_id: string;
    name: string;
    description?: string;
    url: string;
    events: WebhookEventType[];
    headers?: Record<string, string>;
    retry_count?: number;
    retry_delay_seconds?: number;
    timeout_seconds?: number;
    metadata?: Record<string, any>;
  }): Promise<Webhook> {
    // Generate a secure secret
    const secret = crypto.randomBytes(32).toString('hex');

    const webhook: Webhook = {
      id: crypto.randomUUID(),
      user_id: params.user_id,
      name: params.name,
      description: params.description,
      url: params.url,
      secret,
      events: params.events,
      headers: params.headers || {},
      is_active: true,
      retry_count: params.retry_count ?? WEBHOOK_CONFIG.defaultRetryCount,
      retry_delay_seconds: params.retry_delay_seconds ?? WEBHOOK_CONFIG.defaultRetryDelaySeconds,
      timeout_seconds: params.timeout_seconds ?? WEBHOOK_CONFIG.defaultTimeoutSeconds,
      success_count: 0,
      failure_count: 0,
      metadata: params.metadata || {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // In production: await supabase.from('oracle_webhooks').insert(webhook);
    store.webhooks.set(webhook.id, webhook);

    return webhook;
  }

  /**
   * Get webhook by ID
   */
  async getWebhook(webhookId: string, userId: string): Promise<Webhook | null> {
    const webhook = store.webhooks.get(webhookId);
    if (!webhook || webhook.user_id !== userId) return null;
    return webhook;
  }

  /**
   * Get all webhooks for a user
   */
  async getUserWebhooks(userId: string): Promise<Webhook[]> {
    return Array.from(store.webhooks.values()).filter((w) => w.user_id === userId);
  }

  /**
   * Update webhook
   */
  async updateWebhook(
    webhookId: string,
    userId: string,
    updates: Partial<Pick<Webhook, 'name' | 'description' | 'url' | 'events' | 'headers' | 'is_active' | 'retry_count' | 'retry_delay_seconds' | 'timeout_seconds'>>
  ): Promise<Webhook | null> {
    const webhook = await this.getWebhook(webhookId, userId);
    if (!webhook) return null;

    const updated = {
      ...webhook,
      ...updates,
      updated_at: new Date().toISOString(),
    };

    store.webhooks.set(webhookId, updated);
    return updated;
  }

  /**
   * Delete webhook
   */
  async deleteWebhook(webhookId: string, userId: string): Promise<boolean> {
    const webhook = await this.getWebhook(webhookId, userId);
    if (!webhook) return false;

    store.webhooks.delete(webhookId);
    return true;
  }

  /**
   * Regenerate webhook secret
   */
  async regenerateSecret(webhookId: string, userId: string): Promise<string | null> {
    const webhook = await this.getWebhook(webhookId, userId);
    if (!webhook) return null;

    const newSecret = crypto.randomBytes(32).toString('hex');
    webhook.secret = newSecret;
    webhook.updated_at = new Date().toISOString();

    store.webhooks.set(webhookId, webhook);
    return newSecret;
  }

  /**
   * Trigger webhook for an event
   */
  async triggerWebhook<T extends Record<string, any> = Record<string, any>>(params: {
    user_id: string;
    event_type: WebhookEventType;
    event_id?: string;
    data: T;
    metadata?: Record<string, any>;
  }): Promise<WebhookDelivery[]> {
    // Find all active webhooks subscribed to this event
    const webhooks = Array.from(store.webhooks.values()).filter(
      (w) => w.user_id === params.user_id && w.is_active && w.events.includes(params.event_type)
    );

    if (webhooks.length === 0) {
      return [];
    }

    const deliveries: WebhookDelivery[] = [];

    for (const webhook of webhooks) {
      const delivery = await this.createDelivery(webhook, params);
      deliveries.push(delivery);

      // Queue for async delivery
      this.queueDelivery(delivery.id);
    }

    // Start queue processor if not running
    this.startQueueProcessor();

    return deliveries;
  }

  /**
   * Create a delivery record
   */
  private async createDelivery<T extends Record<string, any>>(
    webhook: Webhook,
    params: {
      event_type: WebhookEventType;
      event_id?: string;
      data: T;
      metadata?: Record<string, any>;
    }
  ): Promise<WebhookDelivery> {
    const payload: WebhookPayload<Record<string, any>> = {
      id: crypto.randomUUID(),
      event_type: params.event_type,
      timestamp: new Date().toISOString(),
      user_id: webhook.user_id,
      data: params.data,
      metadata: {
        source: 'oracle',
        version: '1.0.0',
        ...(params.metadata || {}),
      },
    };

    const signature = this.generateSignature(payload, webhook.secret);

    const delivery: WebhookDelivery = {
      id: crypto.randomUUID(),
      webhook_id: webhook.id,
      user_id: webhook.user_id,
      event_type: params.event_type,
      event_id: params.event_id,
      payload,
      status: 'pending',
      attempt_number: 0,
      max_attempts: webhook.retry_count + 1, // Initial + retries
      signature,
      signature_algorithm: WEBHOOK_CONFIG.signatureAlgorithm,
      metadata: {},
      created_at: new Date().toISOString(),
    };

    store.deliveries.set(delivery.id, delivery);
    return delivery;
  }

  /**
   * Generate HMAC signature for webhook payload
   */
  generateSignature(payload: any, secret: string): string {
    const payloadString = JSON.stringify(payload);
    const hmac = crypto.createHmac(WEBHOOK_CONFIG.signatureAlgorithm, secret);
    hmac.update(payloadString);
    return hmac.digest('hex');
  }

  /**
   * Verify webhook signature
   */
  verifySignature(payload: any, signature: string, secret: string): boolean {
    const expectedSignature = this.generateSignature(payload, secret);
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  }

  /**
   * Queue a delivery for async processing
   */
  private queueDelivery(deliveryId: string, delayMs: number = 0): void {
    deliveryQueue.push({
      deliveryId,
      scheduledAt: Date.now() + delayMs,
    });

    // Sort by scheduled time
    deliveryQueue.sort((a, b) => a.scheduledAt - b.scheduledAt);
  }

  /**
   * Start the delivery queue processor
   */
  private startQueueProcessor(): void {
    if (queueProcessorRunning) return;

    queueProcessorRunning = true;
    this.processQueue();
  }

  /**
   * Process the delivery queue
   */
  private async processQueue(): Promise<void> {
    while (deliveryQueue.length > 0) {
      const now = Date.now();
      const ready = deliveryQueue.filter((d) => d.scheduledAt <= now);

      if (ready.length === 0) {
        // Wait for next item
        await this.sleep(WEBHOOK_CONFIG.queueProcessInterval);
        continue;
      }

      // Process ready deliveries
      for (const queued of ready) {
        const index = deliveryQueue.indexOf(queued);
        if (index > -1) {
          deliveryQueue.splice(index, 1);
        }

        await this.processDelivery(queued.deliveryId);
      }
    }

    queueProcessorRunning = false;
  }

  /**
   * Process a single delivery
   */
  private async processDelivery(deliveryId: string): Promise<void> {
    const delivery = store.deliveries.get(deliveryId);
    if (!delivery) return;

    const webhook = store.webhooks.get(delivery.webhook_id);
    if (!webhook || !webhook.is_active) {
      delivery.status = 'abandoned';
      delivery.last_error = 'Webhook not found or inactive';
      delivery.completed_at = new Date().toISOString();
      store.deliveries.set(deliveryId, delivery);
      return;
    }

    // Increment attempt
    delivery.attempt_number++;
    delivery.status = 'sending';
    delivery.sent_at = new Date().toISOString();
    store.deliveries.set(deliveryId, delivery);

    try {
      // Send the webhook
      const result = await this.sendWebhook(webhook, delivery);

      if (result.success) {
        delivery.status = 'success';
        delivery.response_status_code = result.statusCode;
        delivery.response_time_ms = result.responseTime;
        delivery.completed_at = new Date().toISOString();

        // Update webhook stats
        webhook.last_triggered_at = new Date().toISOString();
        webhook.last_success_at = new Date().toISOString();
        webhook.success_count++;
      } else {
        throw new Error(result.error || 'Unknown error');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      delivery.last_error = errorMessage;

      if (delivery.attempt_number >= delivery.max_attempts) {
        delivery.status = 'abandoned';
        delivery.completed_at = new Date().toISOString();

        // Update webhook stats
        webhook.last_failure_at = new Date().toISOString();
        webhook.failure_count++;
      } else {
        // Schedule retry with exponential backoff
        delivery.status = 'retrying';
        const backoffDelay = this.calculateBackoff(
          delivery.attempt_number,
          webhook.retry_delay_seconds
        );
        delivery.next_retry_at = new Date(Date.now() + backoffDelay).toISOString();

        // Requeue
        this.queueDelivery(deliveryId, backoffDelay);
      }
    }

    store.deliveries.set(deliveryId, delivery);
    store.webhooks.set(webhook.id, webhook);
  }

  /**
   * Send webhook HTTP request
   */
  private async sendWebhook(
    webhook: Webhook,
    delivery: WebhookDelivery
  ): Promise<{ success: boolean; statusCode?: number; responseTime?: number; error?: string }> {
    const startTime = Date.now();

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), webhook.timeout_seconds * 1000);

      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': delivery.signature,
          'X-Webhook-Timestamp': delivery.payload.timestamp,
          'X-Webhook-Event': delivery.event_type,
          'X-Webhook-Delivery-Id': delivery.id,
          ...webhook.headers,
        },
        body: JSON.stringify(delivery.payload),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      const responseTime = Date.now() - startTime;

      // Store response
      delivery.response_status_code = response.status;
      delivery.response_time_ms = responseTime;

      try {
        const responseBody = await response.text();
        delivery.response_body = responseBody.substring(0, 10000); // Limit stored response
      } catch {
        // Ignore response body errors
      }

      // Consider 2xx as success
      if (response.ok) {
        return { success: true, statusCode: response.status, responseTime };
      } else {
        return {
          success: false,
          statusCode: response.status,
          responseTime,
          error: `HTTP ${response.status}`,
        };
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      return {
        success: false,
        responseTime,
        error: errorMessage.includes('abort') ? 'Request timeout' : errorMessage,
      };
    }
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateBackoff(attempt: number, baseDelaySeconds: number): number {
    // Exponential backoff: base * 2^attempt with jitter
    const exponentialDelay = baseDelaySeconds * Math.pow(2, attempt - 1) * 1000;
    const jitter = Math.random() * 1000; // Up to 1 second jitter
    const delay = Math.min(exponentialDelay + jitter, WEBHOOK_CONFIG.maxRetryDelaySeconds * 1000);
    return Math.round(delay);
  }

  /**
   * Retry all failed deliveries
   */
  async retryFailedDeliveries(userId: string): Promise<number> {
    const failedDeliveries = Array.from(store.deliveries.values()).filter(
      (d) =>
        d.user_id === userId &&
        (d.status === 'failed' || d.status === 'abandoned') &&
        d.attempt_number < d.max_attempts
    );

    for (const delivery of failedDeliveries) {
      delivery.status = 'pending';
      delivery.attempt_number = 0;
      store.deliveries.set(delivery.id, delivery);
      this.queueDelivery(delivery.id);
    }

    if (failedDeliveries.length > 0) {
      this.startQueueProcessor();
    }

    return failedDeliveries.length;
  }

  /**
   * Get delivery history for a webhook
   */
  async getDeliveryHistory(
    webhookId: string,
    userId: string,
    limit: number = 50
  ): Promise<WebhookDelivery[]> {
    const deliveries = Array.from(store.deliveries.values())
      .filter((d) => d.webhook_id === webhookId && d.user_id === userId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, limit);

    return deliveries;
  }

  /**
   * Get webhook statistics
   */
  async getWebhookStats(webhookId: string, userId: string): Promise<WebhookStats | null> {
    const webhook = await this.getWebhook(webhookId, userId);
    if (!webhook) return null;

    const deliveries = Array.from(store.deliveries.values()).filter(
      (d) => d.webhook_id === webhookId
    );

    const successful = deliveries.filter((d) => d.status === 'success');
    const failed = deliveries.filter((d) => d.status === 'failed' || d.status === 'abandoned');

    const avgResponseTime =
      successful.length > 0
        ? successful.reduce((sum, d) => sum + (d.response_time_ms || 0), 0) / successful.length
        : 0;

    const last24h = Date.now() - 24 * 60 * 60 * 1000;
    const last24hDeliveries = deliveries.filter(
      (d) => new Date(d.created_at).getTime() > last24h
    );
    const last24hFailures = last24hDeliveries.filter(
      (d) => d.status === 'failed' || d.status === 'abandoned'
    );

    return {
      webhook_id: webhookId,
      total_deliveries: deliveries.length,
      successful_deliveries: successful.length,
      failed_deliveries: failed.length,
      avg_response_time_ms: Math.round(avgResponseTime),
      success_rate: deliveries.length > 0 ? successful.length / deliveries.length : 1,
      last_24h_deliveries: last24hDeliveries.length,
      last_24h_failures: last24hFailures.length,
    };
  }

  /**
   * Test a webhook by sending a test payload
   */
  async testWebhook(webhookId: string, userId: string): Promise<WebhookTestResult> {
    const webhook = await this.getWebhook(webhookId, userId);

    if (!webhook) {
      return {
        webhook_id: webhookId,
        success: false,
        error: 'Webhook not found',
        tested_at: new Date().toISOString(),
      };
    }

    const testPayload: WebhookPayload = {
      id: crypto.randomUUID(),
      event_type: 'custom',
      timestamp: new Date().toISOString(),
      user_id: userId,
      data: {
        test: true,
        message: 'This is a test webhook delivery from ORACLE',
      },
      metadata: {
        source: 'oracle',
        version: '1.0.0',
        environment: 'test',
      },
    };

    const signature = this.generateSignature(testPayload, webhook.secret);

    try {
      const startTime = Date.now();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), webhook.timeout_seconds * 1000);

      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Timestamp': testPayload.timestamp,
          'X-Webhook-Event': 'test',
          'X-Webhook-Test': 'true',
          ...webhook.headers,
        },
        body: JSON.stringify(testPayload),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      const responseTime = Date.now() - startTime;

      return {
        webhook_id: webhookId,
        success: response.ok,
        status_code: response.status,
        response_time_ms: responseTime,
        error: response.ok ? undefined : `HTTP ${response.status}`,
        tested_at: new Date().toISOString(),
      };
    } catch (error) {
      return {
        webhook_id: webhookId,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        tested_at: new Date().toISOString(),
      };
    }
  }

  /**
   * Get available webhook event types
   */
  async getEventTypes(): Promise<WebhookEvent[]> {
    // Return predefined events
    const events: WebhookEvent[] = [
      { id: '1', event_type: 'signal.detected', category: 'observe', description: 'A new signal was detected', is_system: true, is_active: true, metadata: {}, created_at: new Date().toISOString() },
      { id: '2', event_type: 'signal.critical', category: 'observe', description: 'A critical signal was detected', is_system: true, is_active: true, metadata: {}, created_at: new Date().toISOString() },
      { id: '3', event_type: 'context.generated', category: 'orient', description: 'A strategic context was generated', is_system: true, is_active: true, metadata: {}, created_at: new Date().toISOString() },
      { id: '4', event_type: 'decision.created', category: 'decide', description: 'A decision was created', is_system: true, is_active: true, metadata: {}, created_at: new Date().toISOString() },
      { id: '5', event_type: 'decision.made', category: 'decide', description: 'A decision was finalized', is_system: true, is_active: true, metadata: {}, created_at: new Date().toISOString() },
      { id: '6', event_type: 'plan.started', category: 'act', description: 'An execution plan was started', is_system: true, is_active: true, metadata: {}, created_at: new Date().toISOString() },
      { id: '7', event_type: 'plan.completed', category: 'act', description: 'An execution plan was completed', is_system: true, is_active: true, metadata: {}, created_at: new Date().toISOString() },
      { id: '8', event_type: 'step.completed', category: 'act', description: 'An execution step was completed', is_system: true, is_active: true, metadata: {}, created_at: new Date().toISOString() },
      { id: '9', event_type: 'prediction.resolved', category: 'prediction', description: 'A prediction was resolved', is_system: true, is_active: true, metadata: {}, created_at: new Date().toISOString() },
      { id: '10', event_type: 'ghost_action.ready', category: 'system', description: 'A ghost action is ready', is_system: true, is_active: true, metadata: {}, created_at: new Date().toISOString() },
      { id: '11', event_type: 'system.error', category: 'system', description: 'A system error occurred', is_system: true, is_active: true, metadata: {}, created_at: new Date().toISOString() },
    ];

    return events;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Singleton instance
export const oracleWebhookService = new OracleWebhookService();
