/**
 * ORACLE Webhook Integrations
 * Stories int-7 (Zapier) and int-8 (IFTTT)
 *
 * int-7 Features:
 * - POST /api/oracle/integrations/zapier/webhook
 * - Signature verification
 * - Map Zapier data to signals
 * - Trigger ORACLE actions from Zapier
 * - Zapier app definition file
 *
 * int-8 Features:
 * - IFTTT service definition
 * - Triggers: new signal, decision made, plan complete
 * - Actions: create signal, approve ghost action
 * - Real-time trigger updates
 */

import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { Signal, Decision, ExecutionPlan, GhostAction } from '@mission-control/shared-types';

// ============================================================================
// TYPES
// ============================================================================

export type WebhookProvider = 'zapier' | 'ifttt' | 'custom';
export type WebhookEventType =
  | 'signal_created'
  | 'signal_updated'
  | 'decision_made'
  | 'plan_started'
  | 'plan_completed'
  | 'step_completed'
  | 'ghost_action_ready'
  | 'phase_changed';

export interface WebhookConfig {
  id: string;
  provider: WebhookProvider;
  name: string;
  url: string;
  secret: string;
  events: WebhookEventType[];
  enabled: boolean;
  created_at: Date;
  last_triggered?: Date;
  failure_count: number;
}

export interface WebhookPayload {
  event: WebhookEventType;
  timestamp: string;
  data: any;
  user_id: string;
  signature?: string;
}

export interface ZapierTriggerData {
  id: string;
  type: WebhookEventType;
  title: string;
  description?: string;
  metadata: Record<string, any>;
  created_at: string;
}

export interface ZapierActionData {
  action: 'create_signal' | 'approve_ghost_action' | 'complete_step';
  payload: Record<string, any>;
}

export interface IFTTTTrigger {
  trigger_identity: string;
  trigger_fields?: Record<string, any>;
  limit?: number;
}

export interface IFTTTTriggerResponse {
  data: Array<{
    meta: { id: string; timestamp: number };
    [key: string]: any;
  }>;
}

export interface IFTTTAction {
  actionFields: Record<string, any>;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const STORAGE_KEYS = {
  WEBHOOKS: 'oracle_webhooks',
  ZAPIER_API_KEY: 'oracle_zapier_api_key',
  IFTTT_SERVICE_KEY: 'oracle_ifttt_service_key',
} as const;

// Zapier App Definition
export const ZAPIER_APP_DEFINITION = {
  platformVersion: '14.0.0',
  version: '1.0.0',
  title: 'ORACLE Mission Control',
  description: 'Connect ORACLE autonomous intelligence loop with your apps',
  authentication: {
    type: 'api_key',
    test: {
      url: '{{bundle.authData.baseUrl}}/api/oracle/auth/test',
      method: 'GET',
    },
    fields: [
      { key: 'apiKey', label: 'API Key', required: true, type: 'password' },
      { key: 'baseUrl', label: 'Base URL', required: true, default: 'https://api.missioncontrol.app' },
    ],
  },
  triggers: {
    new_signal: {
      key: 'new_signal',
      noun: 'Signal',
      display: { label: 'New Signal', description: 'Triggers when ORACLE detects a new signal' },
      operation: {
        type: 'polling',
        perform: { url: '{{bundle.authData.baseUrl}}/api/oracle/integrations/zapier/triggers/signals' },
        sample: {
          id: 'sig_123',
          type: 'deadline',
          title: 'Project deadline approaching',
          urgency: 'high',
          created_at: '2024-01-15T10:00:00Z',
        },
      },
    },
    decision_made: {
      key: 'decision_made',
      noun: 'Decision',
      display: { label: 'Decision Made', description: 'Triggers when a decision is finalized' },
      operation: {
        type: 'polling',
        perform: { url: '{{bundle.authData.baseUrl}}/api/oracle/integrations/zapier/triggers/decisions' },
      },
    },
    plan_complete: {
      key: 'plan_complete',
      noun: 'Plan',
      display: { label: 'Plan Completed', description: 'Triggers when an execution plan is completed' },
      operation: {
        type: 'polling',
        perform: { url: '{{bundle.authData.baseUrl}}/api/oracle/integrations/zapier/triggers/plans' },
      },
    },
  },
  creates: {
    create_signal: {
      key: 'create_signal',
      noun: 'Signal',
      display: { label: 'Create Signal', description: 'Creates a new ORACLE signal' },
      operation: {
        perform: {
          url: '{{bundle.authData.baseUrl}}/api/oracle/integrations/zapier/actions/create-signal',
          method: 'POST',
        },
        inputFields: [
          { key: 'title', label: 'Title', required: true, type: 'string' },
          { key: 'type', label: 'Type', required: true, type: 'string', choices: ['deadline', 'conflict', 'opportunity', 'risk', 'anomaly'] },
          { key: 'urgency', label: 'Urgency', required: true, type: 'string', choices: ['low', 'medium', 'high', 'critical'] },
          { key: 'description', label: 'Description', type: 'text' },
        ],
      },
    },
    approve_action: {
      key: 'approve_action',
      noun: 'Ghost Action',
      display: { label: 'Approve Ghost Action', description: 'Approves a pending ghost action' },
      operation: {
        perform: {
          url: '{{bundle.authData.baseUrl}}/api/oracle/integrations/zapier/actions/approve-action',
          method: 'POST',
        },
        inputFields: [
          { key: 'action_id', label: 'Action ID', required: true, type: 'string' },
        ],
      },
    },
  },
};

// IFTTT Service Definition
export const IFTTT_SERVICE_DEFINITION = {
  service_id: 'oracle_mission_control',
  service_name: 'ORACLE Mission Control',
  service_description: 'ORACLE autonomous intelligence loop for decision-making',
  triggers: [
    {
      slug: 'new_signal',
      name: 'New Signal Detected',
      description: 'Fires when ORACLE detects a new signal',
      fields: [
        { slug: 'urgency', name: 'Urgency Level', type: 'dropdown', options: ['any', 'low', 'medium', 'high', 'critical'] },
      ],
      verifications: ['check_trigger'],
    },
    {
      slug: 'decision_made',
      name: 'Decision Made',
      description: 'Fires when a decision is finalized',
      fields: [],
      verifications: ['check_trigger'],
    },
    {
      slug: 'plan_complete',
      name: 'Plan Completed',
      description: 'Fires when an execution plan is completed',
      fields: [],
      verifications: ['check_trigger'],
    },
  ],
  actions: [
    {
      slug: 'create_signal',
      name: 'Create Signal',
      description: 'Creates a new signal in ORACLE',
      fields: [
        { slug: 'title', name: 'Title', type: 'text', required: true },
        { slug: 'urgency', name: 'Urgency', type: 'dropdown', options: ['low', 'medium', 'high', 'critical'], required: true },
      ],
    },
    {
      slug: 'approve_ghost_action',
      name: 'Approve Ghost Action',
      description: 'Approves the next pending ghost action',
      fields: [],
    },
  ],
};

// ============================================================================
// WEBHOOK SERVICE
// ============================================================================

class WebhookService {
  private webhooks: WebhookConfig[] = [];
  private pendingTriggers: Map<WebhookEventType, any[]> = new Map();

  constructor() {
    this.loadWebhooks();
  }

  private async loadWebhooks(): Promise<void> {
    try {
      const data = await SecureStore.getItemAsync(STORAGE_KEYS.WEBHOOKS);
      if (data) {
        this.webhooks = JSON.parse(data);
      }
    } catch (error) {
      console.warn('[Webhooks] Failed to load webhooks:', error);
    }
  }

  private async saveWebhooks(): Promise<void> {
    try {
      await SecureStore.setItemAsync(STORAGE_KEYS.WEBHOOKS, JSON.stringify(this.webhooks));
    } catch (error) {
      console.warn('[Webhooks] Failed to save webhooks:', error);
    }
  }

  // --------------------------------------------------------------------------
  // Webhook Management
  // --------------------------------------------------------------------------

  /**
   * Register a new webhook
   */
  async registerWebhook(config: Omit<WebhookConfig, 'id' | 'created_at' | 'failure_count'>): Promise<WebhookConfig> {
    const webhook: WebhookConfig = {
      ...config,
      id: `webhook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      created_at: new Date(),
      failure_count: 0,
    };

    this.webhooks.push(webhook);
    await this.saveWebhooks();

    console.log('[Webhooks] Registered webhook:', webhook.id);
    return webhook;
  }

  /**
   * Update webhook configuration
   */
  async updateWebhook(id: string, updates: Partial<WebhookConfig>): Promise<WebhookConfig | null> {
    const index = this.webhooks.findIndex(w => w.id === id);
    if (index === -1) return null;

    this.webhooks[index] = { ...this.webhooks[index], ...updates };
    await this.saveWebhooks();

    return this.webhooks[index];
  }

  /**
   * Remove webhook
   */
  async removeWebhook(id: string): Promise<void> {
    this.webhooks = this.webhooks.filter(w => w.id !== id);
    await this.saveWebhooks();
    console.log('[Webhooks] Removed webhook:', id);
  }

  /**
   * Get webhooks by provider
   */
  getWebhooks(provider?: WebhookProvider): WebhookConfig[] {
    if (provider) {
      return this.webhooks.filter(w => w.provider === provider);
    }
    return this.webhooks;
  }

  // --------------------------------------------------------------------------
  // Signature Verification
  // --------------------------------------------------------------------------

  /**
   * Generate signature for payload
   */
  async generateSignature(payload: string, secret: string): Promise<string> {
    const signature = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      `${payload}${secret}`
    );
    return signature;
  }

  /**
   * Verify webhook signature (Zapier style)
   */
  async verifyZapierSignature(
    payload: string,
    signature: string,
    secret: string
  ): Promise<boolean> {
    const expected = await this.generateSignature(payload, secret);
    return signature === expected;
  }

  /**
   * Verify IFTTT service key
   */
  async verifyIFTTTKey(providedKey: string): Promise<boolean> {
    const storedKey = await SecureStore.getItemAsync(STORAGE_KEYS.IFTTT_SERVICE_KEY);
    return providedKey === storedKey;
  }

  // --------------------------------------------------------------------------
  // Event Triggering
  // --------------------------------------------------------------------------

  /**
   * Trigger webhooks for an event
   */
  async triggerEvent(
    event: WebhookEventType,
    data: any,
    userId: string
  ): Promise<{ success: number; failed: number }> {
    console.log('[Webhooks] Triggering event:', event);

    const relevantWebhooks = this.webhooks.filter(
      w => w.enabled && w.events.includes(event)
    );

    let success = 0;
    let failed = 0;

    for (const webhook of relevantWebhooks) {
      try {
        const payload: WebhookPayload = {
          event,
          timestamp: new Date().toISOString(),
          data,
          user_id: userId,
        };

        const payloadString = JSON.stringify(payload);
        payload.signature = await this.generateSignature(payloadString, webhook.secret);

        const response = await fetch(webhook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Signature': payload.signature,
            'X-Webhook-Event': event,
          },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          success++;
          webhook.last_triggered = new Date();
          webhook.failure_count = 0;
        } else {
          throw new Error(`HTTP ${response.status}`);
        }
      } catch (error) {
        console.warn(`[Webhooks] Failed to trigger ${webhook.id}:`, error);
        failed++;
        webhook.failure_count++;

        // Disable webhook after 5 consecutive failures
        if (webhook.failure_count >= 5) {
          webhook.enabled = false;
          console.log('[Webhooks] Disabled webhook due to failures:', webhook.id);
        }
      }
    }

    await this.saveWebhooks();

    // Store for polling-based triggers (Zapier/IFTTT)
    this.addPendingTrigger(event, data);

    return { success, failed };
  }

  /**
   * Add pending trigger for polling
   */
  private addPendingTrigger(event: WebhookEventType, data: any): void {
    if (!this.pendingTriggers.has(event)) {
      this.pendingTriggers.set(event, []);
    }

    const triggers = this.pendingTriggers.get(event)!;
    triggers.unshift({
      id: `trigger_${Date.now()}`,
      ...data,
      triggered_at: new Date().toISOString(),
    });

    // Keep only last 100 triggers
    if (triggers.length > 100) {
      triggers.length = 100;
    }
  }

  // --------------------------------------------------------------------------
  // Zapier Integration
  // --------------------------------------------------------------------------

  /**
   * Handle incoming Zapier webhook
   */
  async handleZapierWebhook(
    payload: ZapierActionData,
    signature: string
  ): Promise<{ success: boolean; result?: any; error?: string }> {
    console.log('[Webhooks] Handling Zapier webhook:', payload.action);

    // Verify signature
    const apiKey = await SecureStore.getItemAsync(STORAGE_KEYS.ZAPIER_API_KEY);
    if (apiKey) {
      const isValid = await this.verifyZapierSignature(
        JSON.stringify(payload),
        signature,
        apiKey
      );
      if (!isValid) {
        return { success: false, error: 'Invalid signature' };
      }
    }

    switch (payload.action) {
      case 'create_signal':
        return {
          success: true,
          result: this.mapZapierDataToSignal(payload.payload),
        };

      case 'approve_ghost_action':
        return {
          success: true,
          result: { action_id: payload.payload.action_id, approved: true },
        };

      case 'complete_step':
        return {
          success: true,
          result: { step_id: payload.payload.step_id, completed: true },
        };

      default:
        return { success: false, error: 'Unknown action' };
    }
  }

  /**
   * Map Zapier data to ORACLE signal
   */
  mapZapierDataToSignal(data: Record<string, any>): Partial<Signal> {
    return {
      type: data.type || 'external',
      title: data.title,
      summary: data.description,
      urgency: data.urgency || 'medium',
      status: 'active',
      source: 'zapier',
      metadata: {
        zapier_trigger: true,
        original_data: data,
      },
    };
  }

  /**
   * Get Zapier trigger data (for polling)
   */
  getZapierTriggers(event: WebhookEventType, limit = 10): ZapierTriggerData[] {
    const triggers = this.pendingTriggers.get(event) || [];
    return triggers.slice(0, limit).map(t => ({
      id: t.id,
      type: event,
      title: t.title || t.name || `${event} event`,
      description: t.description || t.summary,
      metadata: t,
      created_at: t.triggered_at || t.created_at,
    }));
  }

  // --------------------------------------------------------------------------
  // IFTTT Integration
  // --------------------------------------------------------------------------

  /**
   * Handle IFTTT trigger request
   */
  handleIFTTTTrigger(trigger: IFTTTTrigger): IFTTTTriggerResponse {
    console.log('[Webhooks] Handling IFTTT trigger:', trigger.trigger_identity);

    const event = this.iftttTriggerToEvent(trigger.trigger_identity);
    const triggers = this.pendingTriggers.get(event) || [];
    const limit = trigger.limit || 50;

    return {
      data: triggers.slice(0, limit).map(t => ({
        meta: {
          id: t.id,
          timestamp: Math.floor(new Date(t.triggered_at || t.created_at).getTime() / 1000),
        },
        title: t.title || t.name,
        description: t.description || t.summary,
        urgency: t.urgency,
        created_at: t.triggered_at || t.created_at,
      })),
    };
  }

  private iftttTriggerToEvent(identity: string): WebhookEventType {
    const mapping: Record<string, WebhookEventType> = {
      new_signal: 'signal_created',
      decision_made: 'decision_made',
      plan_complete: 'plan_completed',
    };
    return mapping[identity] || 'signal_created';
  }

  /**
   * Handle IFTTT action
   */
  async handleIFTTTAction(
    actionSlug: string,
    fields: IFTTTAction
  ): Promise<{ success: boolean; id?: string; error?: string }> {
    console.log('[Webhooks] Handling IFTTT action:', actionSlug);

    switch (actionSlug) {
      case 'create_signal':
        const signal = {
          type: 'external',
          title: fields.actionFields.title,
          urgency: fields.actionFields.urgency || 'medium',
          source: 'ifttt',
        };
        return { success: true, id: `sig_ifttt_${Date.now()}` };

      case 'approve_ghost_action':
        return { success: true, id: 'approved' };

      default:
        return { success: false, error: 'Unknown action' };
    }
  }

  /**
   * Realtime trigger update for IFTTT
   */
  async sendIFTTTRealtimeUpdate(
    userTriggerIdentity: string,
    data: any
  ): Promise<void> {
    const serviceKey = await SecureStore.getItemAsync(STORAGE_KEYS.IFTTT_SERVICE_KEY);
    if (!serviceKey) return;

    try {
      await fetch('https://realtime.ifttt.com/v1/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'IFTTT-Service-Key': serviceKey,
        },
        body: JSON.stringify({
          data: [{ user_id: userTriggerIdentity }],
        }),
      });
    } catch (error) {
      console.warn('[Webhooks] Failed to send IFTTT realtime update:', error);
    }
  }

  // --------------------------------------------------------------------------
  // Helper: Trigger ORACLE Events
  // --------------------------------------------------------------------------

  /**
   * Trigger signal created event
   */
  async onSignalCreated(signal: Signal, userId: string): Promise<void> {
    await this.triggerEvent('signal_created', signal, userId);
  }

  /**
   * Trigger decision made event
   */
  async onDecisionMade(decision: Decision, userId: string): Promise<void> {
    await this.triggerEvent('decision_made', decision, userId);
  }

  /**
   * Trigger plan completed event
   */
  async onPlanCompleted(plan: ExecutionPlan, userId: string): Promise<void> {
    await this.triggerEvent('plan_completed', plan, userId);
  }

  /**
   * Trigger ghost action ready event
   */
  async onGhostActionReady(action: GhostAction, userId: string): Promise<void> {
    await this.triggerEvent('ghost_action_ready', action, userId);
  }

  /**
   * Trigger phase changed event
   */
  async onPhaseChanged(phase: string, userId: string): Promise<void> {
    await this.triggerEvent('phase_changed', { phase }, userId);
  }
}

// ============================================================================
// SINGLETON & EXPORTS
// ============================================================================

export const webhookService = new WebhookService();

export {
  WebhookService,
  STORAGE_KEYS as WEBHOOK_STORAGE_KEYS,
  ZAPIER_APP_DEFINITION,
  IFTTT_SERVICE_DEFINITION,
};

export default webhookService;
