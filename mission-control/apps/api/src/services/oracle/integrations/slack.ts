/**
 * Slack Bot Integration Service for ORACLE v2.0
 *
 * Provides Slack app OAuth, slash commands, interactive components,
 * Block Kit message building, and DM notifications.
 *
 * @module services/oracle/integrations/slack
 */

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Slack OAuth tokens
 */
export interface SlackOAuthTokens {
  access_token: string;
  token_type: string;
  scope: string;
  bot_user_id: string;
  app_id: string;
  team: {
    id: string;
    name: string;
  };
  authed_user: {
    id: string;
    scope: string;
    access_token: string;
  };
}

/**
 * Slack slash command payload
 */
export interface SlashCommandPayload {
  token: string;
  team_id: string;
  team_domain: string;
  channel_id: string;
  channel_name: string;
  user_id: string;
  user_name: string;
  command: string;
  text: string;
  response_url: string;
  trigger_id: string;
  api_app_id: string;
}

/**
 * Slack interaction payload
 */
export interface InteractionPayload {
  type: 'block_actions' | 'view_submission' | 'view_closed' | 'shortcut' | 'message_action';
  token: string;
  team: { id: string; domain: string };
  user: { id: string; username: string; name: string; team_id: string };
  channel?: { id: string; name: string };
  message?: {
    type: string;
    ts: string;
    text: string;
    blocks?: Block[];
  };
  trigger_id: string;
  response_url?: string;
  actions?: Array<{
    action_id: string;
    block_id: string;
    type: string;
    value?: string;
    selected_option?: { value: string };
  }>;
  view?: {
    id: string;
    type: string;
    callback_id: string;
    state?: {
      values: Record<string, Record<string, { type: string; value?: string; selected_option?: { value: string } }>>;
    };
  };
}

/**
 * Slack event payload
 */
export interface EventPayload {
  token: string;
  team_id: string;
  api_app_id: string;
  event: {
    type: string;
    user?: string;
    channel?: string;
    text?: string;
    ts?: string;
    event_ts?: string;
    channel_type?: string;
  };
  type: string;
  authed_users?: string[];
  event_id: string;
  event_time: number;
  challenge?: string;
}

/**
 * Block Kit block types
 */
export type Block =
  | SectionBlock
  | DividerBlock
  | ActionsBlock
  | ContextBlock
  | HeaderBlock
  | InputBlock;

export interface SectionBlock {
  type: 'section';
  block_id?: string;
  text?: {
    type: 'plain_text' | 'mrkdwn';
    text: string;
    emoji?: boolean;
  };
  fields?: Array<{
    type: 'plain_text' | 'mrkdwn';
    text: string;
  }>;
  accessory?: BlockElement;
}

export interface DividerBlock {
  type: 'divider';
}

export interface ActionsBlock {
  type: 'actions';
  block_id?: string;
  elements: BlockElement[];
}

export interface ContextBlock {
  type: 'context';
  block_id?: string;
  elements: Array<{
    type: 'plain_text' | 'mrkdwn' | 'image';
    text?: string;
    image_url?: string;
    alt_text?: string;
  }>;
}

export interface HeaderBlock {
  type: 'header';
  block_id?: string;
  text: {
    type: 'plain_text';
    text: string;
    emoji?: boolean;
  };
}

export interface InputBlock {
  type: 'input';
  block_id?: string;
  label: {
    type: 'plain_text';
    text: string;
  };
  element: BlockElement;
  optional?: boolean;
}

export type BlockElement =
  | ButtonElement
  | SelectElement
  | OverflowElement
  | DatePickerElement
  | TextInputElement;

export interface ButtonElement {
  type: 'button';
  text: {
    type: 'plain_text';
    text: string;
    emoji?: boolean;
  };
  action_id: string;
  value?: string;
  url?: string;
  style?: 'primary' | 'danger';
  confirm?: ConfirmDialog;
}

export interface SelectElement {
  type: 'static_select';
  action_id: string;
  placeholder?: {
    type: 'plain_text';
    text: string;
  };
  options: Array<{
    text: { type: 'plain_text'; text: string };
    value: string;
  }>;
  initial_option?: {
    text: { type: 'plain_text'; text: string };
    value: string;
  };
}

export interface OverflowElement {
  type: 'overflow';
  action_id: string;
  options: Array<{
    text: { type: 'plain_text'; text: string };
    value: string;
  }>;
}

export interface DatePickerElement {
  type: 'datepicker';
  action_id: string;
  initial_date?: string;
  placeholder?: {
    type: 'plain_text';
    text: string;
  };
}

export interface TextInputElement {
  type: 'plain_text_input';
  action_id: string;
  placeholder?: {
    type: 'plain_text';
    text: string;
  };
  initial_value?: string;
  multiline?: boolean;
}

export interface ConfirmDialog {
  title: { type: 'plain_text'; text: string };
  text: { type: 'plain_text' | 'mrkdwn'; text: string };
  confirm: { type: 'plain_text'; text: string };
  deny: { type: 'plain_text'; text: string };
  style?: 'primary' | 'danger';
}

/**
 * Slack message structure
 */
export interface SlackMessage {
  channel: string;
  text?: string;
  blocks?: Block[];
  thread_ts?: string;
  reply_broadcast?: boolean;
  unfurl_links?: boolean;
  unfurl_media?: boolean;
  metadata?: {
    event_type: string;
    event_payload: Record<string, any>;
  };
}

// ============================================================================
// Slack Service Class
// ============================================================================

/**
 * SlackService - Full integration with Slack API
 *
 * Features:
 * - Slack app OAuth
 * - Slash commands: /oracle status, /oracle decide
 * - Interactive message components
 * - Block Kit message building
 * - DM notifications
 *
 * Time Complexity:
 * - Most operations: O(1) API calls
 * - Message building: O(n) where n = number of blocks
 */
export class SlackService {
  private botToken: string;
  private signingSecret: string;
  private clientId: string;
  private clientSecret: string;
  private baseUrl = 'https://slack.com/api';

  /**
   * Initialize Slack service
   *
   * @param botToken - Bot OAuth token
   * @param signingSecret - App signing secret
   * @param clientId - OAuth client ID
   * @param clientSecret - OAuth client secret
   */
  constructor(
    botToken: string,
    signingSecret: string,
    clientId: string,
    clientSecret: string
  ) {
    this.botToken = botToken;
    this.signingSecret = signingSecret;
    this.clientId = clientId;
    this.clientSecret = clientSecret;
  }

  // ==========================================================================
  // OAuth Methods
  // ==========================================================================

  /**
   * Generate OAuth authorization URL
   *
   * @param redirectUri - OAuth redirect URI
   * @param state - State parameter for CSRF protection
   * @returns Authorization URL
   */
  generateAuthUrl(redirectUri: string, state: string): string {
    const scopes = [
      'chat:write',
      'commands',
      'im:write',
      'im:read',
      'users:read',
      'channels:read',
      'groups:read',
      'app_mentions:read',
    ].join(',');

    const userScopes = ['identify'].join(',');

    const params = new URLSearchParams({
      client_id: this.clientId,
      scope: scopes,
      user_scope: userScopes,
      redirect_uri: redirectUri,
      state,
    });

    return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   *
   * @param code - Authorization code
   * @param redirectUri - OAuth redirect URI
   * @returns OAuth tokens
   */
  async exchangeCodeForTokens(code: string, redirectUri: string): Promise<SlackOAuthTokens> {
    const response = await fetch(`${this.baseUrl}/oauth.v2.access`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });

    const data: any = await response.json();

    if (!data.ok) {
      throw new Error(`Slack OAuth error: ${data.error}`);
    }

    return {
      access_token: data.access_token,
      token_type: data.token_type,
      scope: data.scope,
      bot_user_id: data.bot_user_id,
      app_id: data.app_id,
      team: data.team,
      authed_user: data.authed_user,
    };
  }

  /**
   * Verify request signature from Slack
   *
   * @param signature - X-Slack-Signature header
   * @param timestamp - X-Slack-Request-Timestamp header
   * @param body - Raw request body
   * @returns Whether signature is valid
   */
  verifySignature(signature: string, timestamp: string, body: string): boolean {
    const crypto = require('crypto');

    // Check timestamp is within 5 minutes
    const currentTime = Math.floor(Date.now() / 1000);
    if (Math.abs(currentTime - parseInt(timestamp, 10)) > 300) {
      return false;
    }

    // Calculate expected signature
    const sigBaseString = `v0:${timestamp}:${body}`;
    const expectedSignature = 'v0=' +
      crypto.createHmac('sha256', this.signingSecret)
        .update(sigBaseString)
        .digest('hex');

    // Compare signatures using timing-safe comparison
    try {
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch {
      return false;
    }
  }

  // ==========================================================================
  // Messaging Methods
  // ==========================================================================

  /**
   * Post a message to a channel
   *
   * @param message - Message to post
   * @returns Message response
   */
  async postMessage(message: SlackMessage): Promise<{ ok: boolean; ts: string; channel: string }> {
    const response = await fetch(`${this.baseUrl}/chat.postMessage`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const data: any = await response.json();

    if (!data.ok) {
      throw new Error(`Slack API error: ${data.error}`);
    }

    return {
      ok: data.ok,
      ts: data.ts,
      channel: data.channel,
    };
  }

  /**
   * Update an existing message
   *
   * @param channel - Channel ID
   * @param ts - Message timestamp
   * @param message - Updated message content
   */
  async updateMessage(
    channel: string,
    ts: string,
    message: Omit<SlackMessage, 'channel'>
  ): Promise<void> {
    const response = await fetch(`${this.baseUrl}/chat.update`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel,
        ts,
        ...message,
      }),
    });

    const data: any = await response.json();

    if (!data.ok) {
      throw new Error(`Slack API error: ${data.error}`);
    }
  }

  /**
   * Send a direct message to a user
   *
   * @param userId - Slack user ID
   * @param message - Message content
   * @returns Message response
   */
  async sendDirectMessage(
    userId: string,
    message: Omit<SlackMessage, 'channel'>
  ): Promise<{ ok: boolean; ts: string; channel: string }> {
    // Open a DM channel with the user
    const imResponse = await fetch(`${this.baseUrl}/conversations.open`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ users: userId }),
    });

    const imData: any = await imResponse.json();

    if (!imData.ok) {
      throw new Error(`Failed to open DM: ${imData.error}`);
    }

    // Send the message
    return this.postMessage({
      channel: imData.channel.id,
      ...message,
    });
  }

  /**
   * Respond to an interaction (via response_url)
   *
   * @param responseUrl - Response URL from interaction
   * @param message - Response message
   * @param replaceOriginal - Whether to replace original message
   */
  async respondToInteraction(
    responseUrl: string,
    message: Omit<SlackMessage, 'channel'>,
    replaceOriginal: boolean = false
  ): Promise<void> {
    await fetch(responseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...message,
        replace_original: replaceOriginal,
      }),
    });
  }

  // ==========================================================================
  // Slash Command Handlers
  // ==========================================================================

  /**
   * Handle /oracle slash command
   *
   * @param payload - Slash command payload
   * @returns Response message
   */
  async handleOracleCommand(payload: SlashCommandPayload): Promise<{
    response_type: 'ephemeral' | 'in_channel';
    blocks: Block[];
    text: string;
  }> {
    const subcommand = payload.text.split(' ')[0].toLowerCase();
    const args = payload.text.split(' ').slice(1).join(' ');

    switch (subcommand) {
      case 'status':
        return this.handleStatusCommand(payload);

      case 'decide':
        return this.handleDecideCommand(payload, args);

      case 'signals':
        return this.handleSignalsCommand(payload);

      case 'help':
      default:
        return this.handleHelpCommand();
    }
  }

  /**
   * Handle /oracle status command
   */
  private async handleStatusCommand(payload: SlashCommandPayload): Promise<{
    response_type: 'ephemeral' | 'in_channel';
    blocks: Block[];
    text: string;
  }> {
    // In production, fetch actual ORACLE status
    const status = {
      phase: 'observe',
      loop_running: true,
      active_signals: 5,
      pending_decisions: 2,
      system_confidence: 0.85,
    };

    const phaseEmoji: Record<string, string> = {
      observe: ':eye:',
      orient: ':compass:',
      decide: ':thinking_face:',
      act: ':rocket:',
      idle: ':zzz:',
    };

    const blocks = BlockKitBuilder.buildStatusMessage(status);

    return {
      response_type: 'ephemeral',
      blocks,
      text: `ORACLE Status: ${status.phase} phase, ${status.active_signals} active signals`,
    };
  }

  /**
   * Handle /oracle decide command
   */
  private async handleDecideCommand(
    payload: SlashCommandPayload,
    topic: string
  ): Promise<{
    response_type: 'ephemeral' | 'in_channel';
    blocks: Block[];
    text: string;
  }> {
    if (!topic) {
      return {
        response_type: 'ephemeral',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: ':warning: Please provide a decision topic. Usage: `/oracle decide <topic>`',
            },
          },
        ],
        text: 'Please provide a decision topic',
      };
    }

    // In production, create a new decision in ORACLE
    const decision = {
      id: 'dec-' + Date.now(),
      title: topic,
      status: 'pending',
      options: [
        { id: 'opt-1', title: 'Option A', score: 0.75 },
        { id: 'opt-2', title: 'Option B', score: 0.65 },
        { id: 'opt-3', title: 'Option C', score: 0.55 },
      ],
    };

    const blocks = BlockKitBuilder.buildDecisionMessage(decision);

    return {
      response_type: 'in_channel',
      blocks,
      text: `New decision: ${topic}`,
    };
  }

  /**
   * Handle /oracle signals command
   */
  private async handleSignalsCommand(payload: SlashCommandPayload): Promise<{
    response_type: 'ephemeral' | 'in_channel';
    blocks: Block[];
    text: string;
  }> {
    // In production, fetch actual signals
    const signals = [
      { id: 's1', title: 'Deadline approaching', urgency: 'high', type: 'deadline' },
      { id: 's2', title: 'Schedule conflict detected', urgency: 'medium', type: 'conflict' },
      { id: 's3', title: 'New opportunity identified', urgency: 'low', type: 'opportunity' },
    ];

    const blocks = BlockKitBuilder.buildSignalsMessage(signals);

    return {
      response_type: 'ephemeral',
      blocks,
      text: `${signals.length} active signals`,
    };
  }

  /**
   * Handle /oracle help command
   */
  private handleHelpCommand(): {
    response_type: 'ephemeral' | 'in_channel';
    blocks: Block[];
    text: string;
  } {
    const blocks: Block[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: ':crystal_ball: ORACLE Commands',
          emoji: true,
        },
      },
      { type: 'divider' },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Available commands:*\n\n' +
            '`/oracle status` - View current ORACLE status and phase\n' +
            '`/oracle decide <topic>` - Start a new decision analysis\n' +
            '`/oracle signals` - View active signals and alerts\n' +
            '`/oracle help` - Show this help message',
        },
      },
      { type: 'divider' },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: ':bulb: *Tip:* Use buttons in ORACLE messages to take quick actions!',
          },
        ],
      },
    ];

    return {
      response_type: 'ephemeral',
      blocks,
      text: 'ORACLE Commands Help',
    };
  }

  // ==========================================================================
  // Interaction Handlers
  // ==========================================================================

  /**
   * Handle button click interactions
   *
   * @param payload - Interaction payload
   * @returns Response action
   */
  async handleBlockAction(payload: InteractionPayload): Promise<{
    action: string;
    data: any;
    response?: Omit<SlackMessage, 'channel'>;
  }> {
    const action = payload.actions?.[0];

    if (!action) {
      return { action: 'none', data: null };
    }

    switch (action.action_id) {
      case 'approve_decision':
        return this.handleApproveDecision(payload, action.value || '');

      case 'defer_decision':
        return this.handleDeferDecision(payload, action.value || '');

      case 'view_details':
        return this.handleViewDetails(payload, action.value || '');

      case 'select_option':
        return this.handleSelectOption(payload, action.selected_option?.value || '');

      case 'acknowledge_signal':
        return this.handleAcknowledgeSignal(payload, action.value || '');

      case 'dismiss_signal':
        return this.handleDismissSignal(payload, action.value || '');

      default:
        return {
          action: 'unknown',
          data: { action_id: action.action_id },
        };
    }
  }

  private async handleApproveDecision(
    payload: InteractionPayload,
    decisionId: string
  ): Promise<{ action: string; data: any; response?: Omit<SlackMessage, 'channel'> }> {
    // In production, update decision status in ORACLE
    return {
      action: 'approve_decision',
      data: { decision_id: decisionId },
      response: {
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `:white_check_mark: Decision approved by <@${payload.user.id}>`,
            },
          },
        ],
      },
    };
  }

  private async handleDeferDecision(
    payload: InteractionPayload,
    decisionId: string
  ): Promise<{ action: string; data: any; response?: Omit<SlackMessage, 'channel'> }> {
    return {
      action: 'defer_decision',
      data: { decision_id: decisionId },
      response: {
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `:clock3: Decision deferred by <@${payload.user.id}>`,
            },
          },
        ],
      },
    };
  }

  private async handleViewDetails(
    payload: InteractionPayload,
    entityId: string
  ): Promise<{ action: string; data: any; response?: Omit<SlackMessage, 'channel'> }> {
    return {
      action: 'view_details',
      data: { entity_id: entityId },
    };
  }

  private async handleSelectOption(
    payload: InteractionPayload,
    optionId: string
  ): Promise<{ action: string; data: any; response?: Omit<SlackMessage, 'channel'> }> {
    return {
      action: 'select_option',
      data: { option_id: optionId },
      response: {
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `:ballot_box_with_check: Option selected: ${optionId}`,
            },
          },
        ],
      },
    };
  }

  private async handleAcknowledgeSignal(
    payload: InteractionPayload,
    signalId: string
  ): Promise<{ action: string; data: any; response?: Omit<SlackMessage, 'channel'> }> {
    return {
      action: 'acknowledge_signal',
      data: { signal_id: signalId },
      response: {
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `:eyes: Signal acknowledged by <@${payload.user.id}>`,
            },
          },
        ],
      },
    };
  }

  private async handleDismissSignal(
    payload: InteractionPayload,
    signalId: string
  ): Promise<{ action: string; data: any; response?: Omit<SlackMessage, 'channel'> }> {
    return {
      action: 'dismiss_signal',
      data: { signal_id: signalId },
      response: {
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `:no_bell: Signal dismissed by <@${payload.user.id}>`,
            },
          },
        ],
      },
    };
  }

  // ==========================================================================
  // Notification Methods
  // ==========================================================================

  /**
   * Send an urgent signal notification
   *
   * @param userId - Slack user ID
   * @param signal - Signal data
   */
  async notifyUrgentSignal(
    userId: string,
    signal: {
      id: string;
      title: string;
      description?: string;
      urgency: 'critical' | 'high' | 'medium' | 'low';
      type: string;
    }
  ): Promise<void> {
    const urgencyEmoji: Record<string, string> = {
      critical: ':rotating_light:',
      high: ':warning:',
      medium: ':bell:',
      low: ':information_source:',
    };

    const blocks = BlockKitBuilder.buildSignalNotification(signal);

    await this.sendDirectMessage(userId, {
      text: `${urgencyEmoji[signal.urgency]} ${signal.urgency.toUpperCase()}: ${signal.title}`,
      blocks,
    });
  }

  /**
   * Send a decision prompt notification
   *
   * @param userId - Slack user ID
   * @param decision - Decision data
   */
  async notifyDecisionNeeded(
    userId: string,
    decision: {
      id: string;
      title: string;
      description?: string;
      deadline?: string;
      options: Array<{ id: string; title: string; score: number }>;
    }
  ): Promise<void> {
    const blocks = BlockKitBuilder.buildDecisionNotification(decision);

    await this.sendDirectMessage(userId, {
      text: `:thinking_face: Decision needed: ${decision.title}`,
      blocks,
    });
  }

  /**
   * Send an execution update notification
   *
   * @param userId - Slack user ID
   * @param update - Execution update data
   */
  async notifyExecutionUpdate(
    userId: string,
    update: {
      plan_id: string;
      plan_title: string;
      status: string;
      progress: number;
      next_step?: string;
    }
  ): Promise<void> {
    const blocks = BlockKitBuilder.buildExecutionUpdate(update);

    await this.sendDirectMessage(userId, {
      text: `:rocket: Execution update: ${update.plan_title} - ${update.progress}% complete`,
      blocks,
    });
  }
}

// ============================================================================
// Block Kit Builder Utility
// ============================================================================

/**
 * BlockKitBuilder - Utility class for building Slack Block Kit messages
 *
 * Provides static methods for creating common ORACLE message types
 * following Slack's Block Kit specification.
 */
export class BlockKitBuilder {
  /**
   * Build ORACLE status message
   */
  static buildStatusMessage(status: {
    phase: string;
    loop_running: boolean;
    active_signals: number;
    pending_decisions: number;
    system_confidence: number;
  }): Block[] {
    const phaseEmoji: Record<string, string> = {
      observe: ':eye:',
      orient: ':compass:',
      decide: ':thinking_face:',
      act: ':rocket:',
      idle: ':zzz:',
    };

    const phaseColors: Record<string, string> = {
      observe: '#00BFFF',
      orient: '#FFD700',
      decide: '#FF6B6B',
      act: '#00FF88',
      idle: '#808080',
    };

    return [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: ':crystal_ball: ORACLE Status',
          emoji: true,
        },
      },
      { type: 'divider' },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Current Phase:*\n${phaseEmoji[status.phase]} ${status.phase.toUpperCase()}`,
          },
          {
            type: 'mrkdwn',
            text: `*Loop Status:*\n${status.loop_running ? ':green_circle: Running' : ':red_circle: Stopped'}`,
          },
          {
            type: 'mrkdwn',
            text: `*Active Signals:*\n:signal_strength: ${status.active_signals}`,
          },
          {
            type: 'mrkdwn',
            text: `*Pending Decisions:*\n:clipboard: ${status.pending_decisions}`,
          },
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*System Confidence:* ${Math.round(status.system_confidence * 100)}%`,
        },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'View Dashboard',
              emoji: true,
            },
            action_id: 'view_dashboard',
            url: process.env.ORACLE_DASHBOARD_URL || 'https://oracle.example.com',
          },
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'Refresh',
              emoji: true,
            },
            action_id: 'refresh_status',
          },
        ],
      },
    ];
  }

  /**
   * Build decision message with options
   */
  static buildDecisionMessage(decision: {
    id: string;
    title: string;
    description?: string;
    options: Array<{ id: string; title: string; score: number }>;
  }): Block[] {
    const blocks: Block[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: ':thinking_face: New Decision',
          emoji: true,
        },
      },
      { type: 'divider' },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${decision.title}*${decision.description ? '\n' + decision.description : ''}`,
        },
      },
    ];

    // Add options as selection
    if (decision.options.length > 0) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Options:*',
        },
      });

      for (const option of decision.options) {
        const scoreBar = ':green_square:'.repeat(Math.round(option.score * 5)) +
          ':white_square:'.repeat(5 - Math.round(option.score * 5));

        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `${option.title}\n${scoreBar} ${Math.round(option.score * 100)}%`,
          },
          accessory: {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'Select',
              emoji: true,
            },
            action_id: 'select_option',
            value: option.id,
          },
        });
      }
    }

    blocks.push({ type: 'divider' });
    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: ':white_check_mark: Approve Top Choice',
            emoji: true,
          },
          action_id: 'approve_decision',
          value: decision.id,
          style: 'primary',
        },
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: ':clock3: Defer',
            emoji: true,
          },
          action_id: 'defer_decision',
          value: decision.id,
        },
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: ':mag: View Details',
            emoji: true,
          },
          action_id: 'view_details',
          value: decision.id,
        },
      ],
    });

    return blocks;
  }

  /**
   * Build signals list message
   */
  static buildSignalsMessage(signals: Array<{
    id: string;
    title: string;
    urgency: string;
    type: string;
  }>): Block[] {
    const urgencyEmoji: Record<string, string> = {
      critical: ':rotating_light:',
      high: ':warning:',
      medium: ':bell:',
      low: ':information_source:',
    };

    const blocks: Block[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: ':signal_strength: Active Signals',
          emoji: true,
        },
      },
      { type: 'divider' },
    ];

    if (signals.length === 0) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: ':white_check_mark: No active signals - all clear!',
        },
      });
    } else {
      for (const signal of signals) {
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `${urgencyEmoji[signal.urgency]} *${signal.title}*\n_Type: ${signal.type} | Urgency: ${signal.urgency}_`,
          },
          accessory: {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'Acknowledge',
              emoji: true,
            },
            action_id: 'acknowledge_signal',
            value: signal.id,
          },
        });
      }
    }

    return blocks;
  }

  /**
   * Build signal notification for DM
   */
  static buildSignalNotification(signal: {
    id: string;
    title: string;
    description?: string;
    urgency: string;
    type: string;
  }): Block[] {
    const urgencyEmoji: Record<string, string> = {
      critical: ':rotating_light:',
      high: ':warning:',
      medium: ':bell:',
      low: ':information_source:',
    };

    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${urgencyEmoji[signal.urgency]} *${signal.urgency.toUpperCase()} SIGNAL*\n\n*${signal.title}*${signal.description ? '\n' + signal.description : ''}`,
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Type: ${signal.type} | ID: ${signal.id}`,
          },
        ],
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: ':eyes: Acknowledge',
              emoji: true,
            },
            action_id: 'acknowledge_signal',
            value: signal.id,
            style: 'primary',
          },
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: ':no_bell: Dismiss',
              emoji: true,
            },
            action_id: 'dismiss_signal',
            value: signal.id,
          },
        ],
      },
    ];
  }

  /**
   * Build decision notification for DM
   */
  static buildDecisionNotification(decision: {
    id: string;
    title: string;
    description?: string;
    deadline?: string;
    options: Array<{ id: string; title: string; score: number }>;
  }): Block[] {
    const blocks: Block[] = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `:thinking_face: *Decision Required*\n\n*${decision.title}*${decision.description ? '\n' + decision.description : ''}`,
        },
      },
    ];

    if (decision.deadline) {
      blocks.push({
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `:clock3: Deadline: ${decision.deadline}`,
          },
        ],
      });
    }

    // Show top recommendation
    if (decision.options.length > 0) {
      const topOption = decision.options.reduce((a, b) => a.score > b.score ? a : b);

      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Recommended:* ${topOption.title} (${Math.round(topOption.score * 100)}% confidence)`,
        },
      });
    }

    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: ':white_check_mark: Approve',
            emoji: true,
          },
          action_id: 'approve_decision',
          value: decision.id,
          style: 'primary',
        },
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: ':mag: View Options',
            emoji: true,
          },
          action_id: 'view_details',
          value: decision.id,
        },
      ],
    });

    return blocks;
  }

  /**
   * Build execution update notification
   */
  static buildExecutionUpdate(update: {
    plan_id: string;
    plan_title: string;
    status: string;
    progress: number;
    next_step?: string;
  }): Block[] {
    const statusEmoji: Record<string, string> = {
      active: ':arrow_forward:',
      completed: ':white_check_mark:',
      blocked: ':no_entry:',
      paused: ':pause_button:',
    };

    const progressBar = ':green_square:'.repeat(Math.round(update.progress / 10)) +
      ':white_square:'.repeat(10 - Math.round(update.progress / 10));

    const blocks: Block[] = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `:rocket: *Execution Update*\n\n*${update.plan_title}*`,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Status:*\n${statusEmoji[update.status] || ':question:'} ${update.status}`,
          },
          {
            type: 'mrkdwn',
            text: `*Progress:*\n${progressBar} ${update.progress}%`,
          },
        ],
      },
    ];

    if (update.next_step) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Next Step:* ${update.next_step}`,
        },
      });
    }

    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: ':clipboard: View Plan',
            emoji: true,
          },
          action_id: 'view_details',
          value: update.plan_id,
        },
      ],
    });

    return blocks;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a SlackService instance
 *
 * @returns Configured service instance
 */
export function createSlackService(): SlackService {
  const botToken = process.env.SLACK_BOT_TOKEN || '';
  const signingSecret = process.env.SLACK_SIGNING_SECRET || '';
  const clientId = process.env.SLACK_CLIENT_ID || '';
  const clientSecret = process.env.SLACK_CLIENT_SECRET || '';

  return new SlackService(botToken, signingSecret, clientId, clientSecret);
}

export default SlackService;
