/**
 * ORACLE Slack Integration
 * Story int-5 - Send ORACLE updates to Slack
 *
 * Features:
 * - OAuth2 flow for Slack
 * - Post high-priority signals to channel
 * - Decision summary notifications
 * - Slash command for ORACLE status
 * - Interactive messages for approvals
 */

import * as SecureStore from 'expo-secure-store';
import { Signal, Decision, GhostAction } from '@mission-control/shared-types';
import {
  IntegrationConfig,
  IntegrationStatus,
  SyncResult,
} from './googleCalendar';

// ============================================================================
// TYPES
// ============================================================================

export interface SlackChannel {
  id: string;
  name: string;
  is_channel: boolean;
  is_private: boolean;
  is_member: boolean;
  topic?: { value: string };
  purpose?: { value: string };
  num_members?: number;
}

export interface SlackUser {
  id: string;
  team_id: string;
  name: string;
  real_name: string;
  profile: {
    display_name: string;
    email?: string;
    image_48: string;
    image_72: string;
  };
  is_bot: boolean;
}

export interface SlackMessage {
  channel: string;
  text: string;
  blocks?: SlackBlock[];
  attachments?: SlackAttachment[];
  thread_ts?: string;
  reply_broadcast?: boolean;
  unfurl_links?: boolean;
  unfurl_media?: boolean;
  metadata?: {
    event_type: string;
    event_payload: Record<string, any>;
  };
}

export interface SlackBlock {
  type: 'section' | 'divider' | 'header' | 'context' | 'actions' | 'image';
  text?: SlackText;
  fields?: SlackText[];
  accessory?: SlackAccessory;
  elements?: (SlackButton | SlackText | SlackImage)[];
  block_id?: string;
}

export interface SlackText {
  type: 'plain_text' | 'mrkdwn';
  text: string;
  emoji?: boolean;
}

export interface SlackAccessory {
  type: 'button' | 'image' | 'overflow' | 'datepicker' | 'static_select';
  text?: SlackText;
  action_id?: string;
  value?: string;
  url?: string;
  image_url?: string;
  alt_text?: string;
}

export interface SlackButton {
  type: 'button';
  text: SlackText;
  action_id: string;
  value?: string;
  url?: string;
  style?: 'primary' | 'danger';
  confirm?: SlackConfirm;
}

export interface SlackImage {
  type: 'image';
  image_url: string;
  alt_text: string;
}

export interface SlackConfirm {
  title: SlackText;
  text: SlackText;
  confirm: SlackText;
  deny: SlackText;
  style?: 'primary' | 'danger';
}

export interface SlackAttachment {
  color?: string;
  fallback?: string;
  text?: string;
  fields?: { title: string; value: string; short?: boolean }[];
  footer?: string;
  footer_icon?: string;
  ts?: number;
}

export interface SlackInteractionPayload {
  type: 'block_actions' | 'shortcut' | 'message_action' | 'view_submission' | 'view_closed';
  user: { id: string; username: string; name: string };
  channel?: { id: string; name: string };
  team: { id: string; domain: string };
  trigger_id: string;
  response_url: string;
  actions?: {
    action_id: string;
    block_id: string;
    value: string;
    type: string;
  }[];
}

export interface SlackSyncConfig {
  enabled: boolean;
  teamId?: string;
  teamName?: string;
  defaultChannel?: string;
  signalChannels: Record<string, string>; // urgency -> channel_id
  decisionChannel?: string;
  notifyOnPhaseChange: boolean;
  notifyOnCriticalSignal: boolean;
  notifyOnGhostAction: boolean;
  botUserId?: string;
}

export type SlackMessageTemplate = 'signal' | 'decision_summary' | 'ghost_action' | 'status' | 'phase_change';

// ============================================================================
// CONFIGURATION
// ============================================================================

const SLACK_CONFIG: IntegrationConfig = {
  provider: 'slack',
  name: 'Slack',
  description: 'Send ORACLE updates to Slack',
  icon: 'message',
  scopes: [
    'channels:read',
    'channels:join',
    'chat:write',
    'chat:write.public',
    'commands',
    'users:read',
    'team:read',
  ],
  authUrl: 'https://slack.com/oauth/v2/authorize',
  tokenUrl: 'https://slack.com/api/oauth.v2.access',
  revokeUrl: 'https://slack.com/api/auth.revoke',
};

const STORAGE_KEYS = {
  ACCESS_TOKEN: 'oracle_slack_access_token',
  BOT_TOKEN: 'oracle_slack_bot_token',
  TEAM_ID: 'oracle_slack_team_id',
  LAST_SYNC: 'oracle_slack_last_sync',
  SYNC_CONFIG: 'oracle_slack_sync_config',
} as const;

const SLACK_API = 'https://slack.com/api';

// OODA phase colors for Slack
const PHASE_COLORS: Record<string, string> = {
  observe: '#00BFFF',
  orient: '#FFD700',
  decide: '#FF6B6B',
  act: '#00FF88',
  idle: '#808080',
};

const URGENCY_COLORS: Record<string, string> = {
  critical: '#FF0000',
  high: '#FF6B6B',
  medium: '#FFD700',
  low: '#00FF88',
};

// ============================================================================
// SLACK SERVICE
// ============================================================================

class SlackService {
  private accessToken: string | null = null;
  private botToken: string | null = null;
  private status: IntegrationStatus = 'disconnected';
  private channels: SlackChannel[] = [];
  private syncConfig: SlackSyncConfig;
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;

  constructor() {
    this.clientId = process.env.SLACK_CLIENT_ID || '';
    this.clientSecret = process.env.SLACK_CLIENT_SECRET || '';
    this.redirectUri = process.env.SLACK_REDIRECT_URI || 'com.missioncontrol.oracle:/oauth2callback/slack';

    this.syncConfig = {
      enabled: true,
      signalChannels: {},
      notifyOnPhaseChange: true,
      notifyOnCriticalSignal: true,
      notifyOnGhostAction: true,
    };

    this.loadConfig();
  }

  // --------------------------------------------------------------------------
  // Configuration
  // --------------------------------------------------------------------------

  private async loadConfig(): Promise<void> {
    try {
      const token = await SecureStore.getItemAsync(STORAGE_KEYS.ACCESS_TOKEN);
      const botToken = await SecureStore.getItemAsync(STORAGE_KEYS.BOT_TOKEN);

      if (token && botToken) {
        this.accessToken = token;
        this.botToken = botToken;
        this.status = 'connected';
      }

      const config = await SecureStore.getItemAsync(STORAGE_KEYS.SYNC_CONFIG);
      if (config) {
        this.syncConfig = { ...this.syncConfig, ...JSON.parse(config) };
      }
    } catch (error) {
      console.warn('[Slack] Failed to load config:', error);
    }
  }

  private async saveConfig(): Promise<void> {
    try {
      await SecureStore.setItemAsync(
        STORAGE_KEYS.SYNC_CONFIG,
        JSON.stringify(this.syncConfig)
      );
    } catch (error) {
      console.warn('[Slack] Failed to save config:', error);
    }
  }

  // --------------------------------------------------------------------------
  // OAuth2 Flow
  // --------------------------------------------------------------------------

  /**
   * Generate OAuth2 authorization URL
   */
  getAuthorizationUrl(state?: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      scope: SLACK_CONFIG.scopes.join(','),
      redirect_uri: this.redirectUri,
      state: state || Math.random().toString(36).substring(2, 15),
    });

    return `${SLACK_CONFIG.authUrl}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string): Promise<string> {
    console.log('[Slack] Exchanging code for token');

    const response = await fetch(SLACK_CONFIG.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
        redirect_uri: this.redirectUri,
      }).toString(),
    });

    const data = await response.json();

    if (!data.ok) {
      throw new Error(`Token exchange failed: ${data.error}`);
    }

    this.accessToken = data.access_token;
    this.botToken = data.access_token; // Bot token is the same for new Slack apps

    await SecureStore.setItemAsync(STORAGE_KEYS.ACCESS_TOKEN, this.accessToken);
    await SecureStore.setItemAsync(STORAGE_KEYS.BOT_TOKEN, this.botToken);

    // Store team info
    if (data.team) {
      this.syncConfig.teamId = data.team.id;
      this.syncConfig.teamName = data.team.name;
      await SecureStore.setItemAsync(STORAGE_KEYS.TEAM_ID, data.team.id);
    }

    if (data.bot_user_id) {
      this.syncConfig.botUserId = data.bot_user_id;
    }

    await this.saveConfig();

    this.status = 'connected';
    console.log('[Slack] Successfully connected to workspace:', this.syncConfig.teamName);

    return this.accessToken;
  }

  /**
   * Disconnect and revoke token
   */
  async disconnect(): Promise<void> {
    console.log('[Slack] Disconnecting');

    if (this.botToken && SLACK_CONFIG.revokeUrl) {
      try {
        await fetch(SLACK_CONFIG.revokeUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.botToken}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        });
      } catch (error) {
        console.warn('[Slack] Token revocation failed:', error);
      }
    }

    await SecureStore.deleteItemAsync(STORAGE_KEYS.ACCESS_TOKEN);
    await SecureStore.deleteItemAsync(STORAGE_KEYS.BOT_TOKEN);
    await SecureStore.deleteItemAsync(STORAGE_KEYS.TEAM_ID);
    await SecureStore.deleteItemAsync(STORAGE_KEYS.LAST_SYNC);

    this.accessToken = null;
    this.botToken = null;
    this.status = 'disconnected';
    this.channels = [];
  }

  // --------------------------------------------------------------------------
  // API Helpers
  // --------------------------------------------------------------------------

  private async apiRequest<T>(
    method: string,
    body?: any,
    useAccessToken = false
  ): Promise<T> {
    const token = useAccessToken ? this.accessToken : this.botToken;
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${SLACK_API}/${method}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json();

    if (!data.ok) {
      throw new Error(`Slack API error: ${data.error}`);
    }

    return data;
  }

  // --------------------------------------------------------------------------
  // Channel Operations
  // --------------------------------------------------------------------------

  /**
   * Fetch accessible channels
   */
  async fetchChannels(): Promise<SlackChannel[]> {
    console.log('[Slack] Fetching channels');

    const data = await this.apiRequest<{ channels: SlackChannel[] }>(
      'conversations.list',
      { types: 'public_channel,private_channel', limit: 200 }
    );

    this.channels = data.channels;
    console.log(`[Slack] Fetched ${this.channels.length} channels`);

    return this.channels;
  }

  /**
   * Join a channel
   */
  async joinChannel(channelId: string): Promise<void> {
    console.log('[Slack] Joining channel:', channelId);
    await this.apiRequest('conversations.join', { channel: channelId });
  }

  /**
   * Set default notification channel
   */
  async setDefaultChannel(channelId: string): Promise<void> {
    this.syncConfig.defaultChannel = channelId;
    await this.saveConfig();
    console.log('[Slack] Default channel set:', channelId);
  }

  /**
   * Set channel for specific signal urgency
   */
  async setSignalChannel(urgency: string, channelId: string): Promise<void> {
    this.syncConfig.signalChannels[urgency] = channelId;
    await this.saveConfig();
  }

  // --------------------------------------------------------------------------
  // Message Building
  // --------------------------------------------------------------------------

  /**
   * Build signal notification message
   */
  buildSignalMessage(signal: Signal): SlackMessage {
    const color = URGENCY_COLORS[signal.urgency] || '#808080';
    const emoji = signal.urgency === 'critical' ? '🚨' : signal.urgency === 'high' ? '⚠️' : 'ℹ️';

    const channel = this.syncConfig.signalChannels[signal.urgency] ||
      this.syncConfig.defaultChannel || '';

    return {
      channel,
      text: `${emoji} ${signal.urgency.toUpperCase()} Signal: ${signal.title}`,
      blocks: [
        {
          type: 'header',
          text: { type: 'plain_text', text: `${emoji} ORACLE Signal Detected`, emoji: true },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*${signal.title}*\n${signal.summary || 'No summary available'}`,
          },
          accessory: {
            type: 'button',
            text: { type: 'plain_text', text: 'View Details', emoji: true },
            action_id: 'view_signal',
            value: signal.id,
          },
        },
        {
          type: 'context',
          elements: [
            { type: 'mrkdwn', text: `*Urgency:* ${signal.urgency}` },
            { type: 'mrkdwn', text: `*Type:* ${signal.type}` },
            { type: 'mrkdwn', text: `*Detected:* <!date^${Math.floor(new Date(signal.detected_at).getTime() / 1000)}^{date_short_pretty} at {time}|${signal.detected_at}>` },
          ],
        },
      ],
      attachments: [{ color }],
    };
  }

  /**
   * Build decision summary message
   */
  buildDecisionMessage(decision: Decision): SlackMessage {
    const channel = this.syncConfig.decisionChannel ||
      this.syncConfig.defaultChannel || '';

    const statusEmoji: Record<string, string> = {
      pending: '⏳',
      analyzing: '🔍',
      decided: '✅',
      executed: '🚀',
      cancelled: '❌',
    };

    return {
      channel,
      text: `🎯 Decision Update: ${decision.title}`,
      blocks: [
        {
          type: 'header',
          text: { type: 'plain_text', text: '🎯 ORACLE Decision', emoji: true },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*${decision.title}*\n${decision.description || ''}`,
          },
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Status:*\n${statusEmoji[decision.status] || ''} ${decision.status}` },
            { type: 'mrkdwn', text: `*Created:*\n<!date^${Math.floor(new Date(decision.created_at).getTime() / 1000)}^{date_short}|${decision.created_at}>` },
          ],
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: { type: 'plain_text', text: 'View in ORACLE', emoji: true },
              action_id: 'view_decision',
              value: decision.id,
            },
          ],
        },
      ],
    };
  }

  /**
   * Build ghost action approval message
   */
  buildGhostActionMessage(action: GhostAction): SlackMessage {
    const channel = this.syncConfig.defaultChannel || '';

    return {
      channel,
      text: `👻 Ghost Action Ready: ${action.title}`,
      blocks: [
        {
          type: 'header',
          text: { type: 'plain_text', text: '👻 Ghost Action Ready for Approval', emoji: true },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*${action.title}*\n${action.description || 'AI-suggested action ready for your approval'}`,
          },
        },
        {
          type: 'context',
          elements: [
            { type: 'mrkdwn', text: `*Type:* ${action.action_type}` },
            { type: 'mrkdwn', text: `*Confidence:* ${Math.round((action.confidence || 0) * 100)}%` },
          ],
        },
        {
          type: 'actions',
          block_id: `ghost_action_${action.id}`,
          elements: [
            {
              type: 'button',
              text: { type: 'plain_text', text: '✅ Approve', emoji: true },
              action_id: 'approve_ghost_action',
              value: action.id,
              style: 'primary',
            },
            {
              type: 'button',
              text: { type: 'plain_text', text: '❌ Reject', emoji: true },
              action_id: 'reject_ghost_action',
              value: action.id,
              style: 'danger',
              confirm: {
                title: { type: 'plain_text', text: 'Reject Ghost Action?' },
                text: { type: 'mrkdwn', text: 'Are you sure you want to reject this action?' },
                confirm: { type: 'plain_text', text: 'Reject' },
                deny: { type: 'plain_text', text: 'Cancel' },
                style: 'danger',
              },
            },
          ],
        },
      ],
    };
  }

  /**
   * Build ORACLE status message
   */
  buildStatusMessage(
    phase: string,
    signalCount: number,
    decisionCount: number,
    planProgress?: number
  ): SlackMessage {
    const channel = this.syncConfig.defaultChannel || '';
    const color = PHASE_COLORS[phase] || '#808080';
    const phaseEmoji: Record<string, string> = {
      observe: '👁️',
      orient: '🧭',
      decide: '⚖️',
      act: '🚀',
      idle: '💤',
    };

    return {
      channel,
      text: `ORACLE Status: ${phase.toUpperCase()}`,
      blocks: [
        {
          type: 'header',
          text: { type: 'plain_text', text: '📊 ORACLE Status', emoji: true },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Current Phase:* ${phaseEmoji[phase] || ''} ${phase.toUpperCase()}`,
          },
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Active Signals:*\n${signalCount}` },
            { type: 'mrkdwn', text: `*Pending Decisions:*\n${decisionCount}` },
          ],
        },
        ...(planProgress !== undefined ? [{
          type: 'section' as const,
          text: {
            type: 'mrkdwn' as const,
            text: `*Plan Progress:* ${Math.round(planProgress)}%`,
          },
        }] : []),
      ],
      attachments: [{ color }],
    };
  }

  // --------------------------------------------------------------------------
  // Posting Messages
  // --------------------------------------------------------------------------

  /**
   * Post a message to Slack
   */
  async postMessage(message: SlackMessage): Promise<{ ts: string; channel: string }> {
    console.log('[Slack] Posting message to:', message.channel);

    const response = await this.apiRequest<{ ts: string; channel: string }>(
      'chat.postMessage',
      message
    );

    console.log('[Slack] Message posted:', response.ts);
    return response;
  }

  /**
   * Update an existing message
   */
  async updateMessage(
    channel: string,
    ts: string,
    message: Partial<SlackMessage>
  ): Promise<void> {
    await this.apiRequest('chat.update', { channel, ts, ...message });
  }

  /**
   * Post high-priority signal notification
   */
  async notifySignal(signal: Signal): Promise<{ ts: string; channel: string } | null> {
    if (!this.syncConfig.notifyOnCriticalSignal) return null;
    if (signal.urgency !== 'critical' && signal.urgency !== 'high') return null;

    const message = this.buildSignalMessage(signal);
    if (!message.channel) {
      console.warn('[Slack] No channel configured for signal notifications');
      return null;
    }

    return this.postMessage(message);
  }

  /**
   * Post decision summary
   */
  async notifyDecision(decision: Decision): Promise<{ ts: string; channel: string } | null> {
    const message = this.buildDecisionMessage(decision);
    if (!message.channel) {
      console.warn('[Slack] No channel configured for decision notifications');
      return null;
    }

    return this.postMessage(message);
  }

  /**
   * Post ghost action for approval
   */
  async notifyGhostAction(action: GhostAction): Promise<{ ts: string; channel: string } | null> {
    if (!this.syncConfig.notifyOnGhostAction) return null;

    const message = this.buildGhostActionMessage(action);
    if (!message.channel) {
      console.warn('[Slack] No channel configured for ghost action notifications');
      return null;
    }

    return this.postMessage(message);
  }

  /**
   * Post phase change notification
   */
  async notifyPhaseChange(newPhase: string, previousPhase?: string): Promise<void> {
    if (!this.syncConfig.notifyOnPhaseChange) return;
    if (!this.syncConfig.defaultChannel) return;

    const emoji: Record<string, string> = {
      observe: '👁️',
      orient: '🧭',
      decide: '⚖️',
      act: '🚀',
      idle: '💤',
    };

    await this.postMessage({
      channel: this.syncConfig.defaultChannel,
      text: `ORACLE phase changed to ${newPhase}`,
      blocks: [
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `${emoji[newPhase] || '🔄'} ORACLE transitioned${previousPhase ? ` from *${previousPhase}*` : ''} to *${newPhase.toUpperCase()}*`,
            },
          ],
        },
      ],
    });
  }

  // --------------------------------------------------------------------------
  // Slash Command Handler
  // --------------------------------------------------------------------------

  /**
   * Handle /oracle slash command (server-side integration point)
   */
  buildSlashCommandResponse(
    command: string,
    phase: string,
    signalCount: number,
    decisionCount: number
  ): SlackMessage {
    // Parse sub-command
    const subCommand = command.trim().toLowerCase();

    if (subCommand === 'status' || subCommand === '') {
      return this.buildStatusMessage(phase, signalCount, decisionCount);
    }

    // Default response for unknown commands
    return {
      channel: '',
      text: 'ORACLE Commands',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*Available ORACLE Commands:*\n• `/oracle status` - Show current ORACLE status\n• `/oracle signals` - List active signals\n• `/oracle decisions` - List pending decisions',
          },
        },
      ],
    };
  }

  // --------------------------------------------------------------------------
  // Interactive Message Handler
  // --------------------------------------------------------------------------

  /**
   * Handle interactive message actions (server-side integration point)
   */
  async handleInteraction(payload: SlackInteractionPayload): Promise<{
    action: 'approve_ghost' | 'reject_ghost' | 'view_signal' | 'view_decision' | 'unknown';
    entityId?: string;
    userId: string;
  }> {
    const action = payload.actions?.[0];
    if (!action) {
      return { action: 'unknown', userId: payload.user.id };
    }

    switch (action.action_id) {
      case 'approve_ghost_action':
        return { action: 'approve_ghost', entityId: action.value, userId: payload.user.id };
      case 'reject_ghost_action':
        return { action: 'reject_ghost', entityId: action.value, userId: payload.user.id };
      case 'view_signal':
        return { action: 'view_signal', entityId: action.value, userId: payload.user.id };
      case 'view_decision':
        return { action: 'view_decision', entityId: action.value, userId: payload.user.id };
      default:
        return { action: 'unknown', userId: payload.user.id };
    }
  }

  // --------------------------------------------------------------------------
  // Sync Operations
  // --------------------------------------------------------------------------

  /**
   * Sync with Slack
   */
  async sync(): Promise<SyncResult> {
    console.log('[Slack] Starting sync');

    try {
      // Fetch channels
      await this.fetchChannels();

      // Store last sync time
      await SecureStore.setItemAsync(STORAGE_KEYS.LAST_SYNC, new Date().toISOString());

      return {
        success: true,
        events_fetched: this.channels.length,
        events_created: 0,
        conflicts_detected: 0,
        last_sync: new Date(),
      };
    } catch (error) {
      console.error('[Slack] Sync failed:', error);
      return {
        success: false,
        events_fetched: 0,
        events_created: 0,
        conflicts_detected: 0,
        last_sync: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // --------------------------------------------------------------------------
  // Getters
  // --------------------------------------------------------------------------

  getStatus(): IntegrationStatus {
    return this.status;
  }

  getChannels(): SlackChannel[] {
    return this.channels;
  }

  getSyncConfig(): SlackSyncConfig {
    return this.syncConfig;
  }

  getConfig(): IntegrationConfig {
    return SLACK_CONFIG;
  }

  getTeamInfo(): { id: string | undefined; name: string | undefined } {
    return { id: this.syncConfig.teamId, name: this.syncConfig.teamName };
  }

  isConnected(): boolean {
    return !!this.botToken && this.status === 'connected';
  }

  async getLastSyncTime(): Promise<Date | null> {
    const lastSync = await SecureStore.getItemAsync(STORAGE_KEYS.LAST_SYNC);
    return lastSync ? new Date(lastSync) : null;
  }
}

// ============================================================================
// SINGLETON & EXPORTS
// ============================================================================

export const slackService = new SlackService();

export {
  SlackService,
  SLACK_CONFIG,
  STORAGE_KEYS as SLACK_STORAGE_KEYS,
  PHASE_COLORS as SLACK_PHASE_COLORS,
  URGENCY_COLORS as SLACK_URGENCY_COLORS,
};

export default slackService;
