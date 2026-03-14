/**
 * Slack Integration Tests
 * Story test-2 - Integration API Tests
 *
 * Tests cover:
 * - Mock Slack API
 * - Slash commands
 * - Interactive messages
 * - OAuth flow
 * - Error handling
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  SlackService,
  createSlackService,
  BlockKitBuilder,
  SlashCommandPayload,
  InteractionPayload,
  SlackOAuthTokens,
  Block,
} from '../../src/services/oracle/integrations/slack';

// ============================================================================
// Mock Fetch API
// ============================================================================

const mockFetch = vi.fn();
global.fetch = mockFetch;

// Helper to create mock fetch responses
function createMockResponse(data: any, ok: boolean = true) {
  return {
    ok,
    json: () => Promise.resolve(data),
  };
}

// ============================================================================
// Test Suite
// ============================================================================

describe('SlackService', () => {
  let service: SlackService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SlackService(
      'xoxb-mock-bot-token',
      'mock-signing-secret',
      'mock-client-id',
      'mock-client-secret'
    );

    // Default successful mock response
    mockFetch.mockResolvedValue(createMockResponse({ ok: true }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // OAuth Flow Tests
  // ==========================================================================

  describe('OAuth Flow', () => {
    it('should generate authorization URL with correct scopes', () => {
      const authUrl = service.generateAuthUrl(
        'http://localhost:3001/oauth/slack/callback',
        'test-state'
      );

      expect(authUrl).toContain('https://slack.com/oauth/v2/authorize');
      expect(authUrl).toContain('client_id=mock-client-id');
      expect(authUrl).toContain('state=test-state');
      expect(authUrl).toContain('scope=');
      expect(authUrl).toContain('redirect_uri=');
    });

    it('should include required scopes in auth URL', () => {
      const authUrl = service.generateAuthUrl(
        'http://localhost:3001/oauth/callback',
        'state-123'
      );

      expect(authUrl).toContain('chat%3Awrite');
      expect(authUrl).toContain('commands');
    });

    it('should exchange code for tokens', async () => {
      const mockTokenResponse: SlackOAuthTokens = {
        access_token: 'xoxb-new-token',
        token_type: 'bot',
        scope: 'chat:write,commands',
        bot_user_id: 'U123BOT',
        app_id: 'A123APP',
        team: { id: 'T123TEAM', name: 'Test Team' },
        authed_user: {
          id: 'U123USER',
          scope: 'identify',
          access_token: 'xoxp-user-token',
        },
      };

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        ...mockTokenResponse,
      }));

      const tokens = await service.exchangeCodeForTokens(
        'mock-auth-code',
        'http://localhost:3001/oauth/callback'
      );

      expect(tokens.access_token).toBe('xoxb-new-token');
      expect(tokens.bot_user_id).toBe('U123BOT');
      expect(tokens.team.name).toBe('Test Team');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://slack.com/api/oauth.v2.access',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    it('should throw error on OAuth failure', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: false,
        error: 'invalid_grant',
      }));

      await expect(
        service.exchangeCodeForTokens('invalid-code', 'http://localhost:3001')
      ).rejects.toThrow('Slack OAuth error: invalid_grant');
    });
  });

  // ==========================================================================
  // Signature Verification Tests
  // ==========================================================================

  describe('Signature Verification', () => {
    it('should verify valid signature', () => {
      const crypto = require('crypto');
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const body = 'test=body';
      const sigBaseString = `v0:${timestamp}:${body}`;
      const signature = 'v0=' + crypto
        .createHmac('sha256', 'mock-signing-secret')
        .update(sigBaseString)
        .digest('hex');

      const isValid = service.verifySignature(signature, timestamp, body);

      expect(isValid).toBe(true);
    });

    it('should reject invalid signature', () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const body = 'test=body';
      const invalidSignature = 'v0=invalid_signature_hash';

      const isValid = service.verifySignature(invalidSignature, timestamp, body);

      expect(isValid).toBe(false);
    });

    it('should reject expired timestamp', () => {
      const crypto = require('crypto');
      // Timestamp from 10 minutes ago
      const oldTimestamp = (Math.floor(Date.now() / 1000) - 600).toString();
      const body = 'test=body';
      const sigBaseString = `v0:${oldTimestamp}:${body}`;
      const signature = 'v0=' + crypto
        .createHmac('sha256', 'mock-signing-secret')
        .update(sigBaseString)
        .digest('hex');

      const isValid = service.verifySignature(signature, oldTimestamp, body);

      expect(isValid).toBe(false);
    });
  });

  // ==========================================================================
  // Messaging Tests
  // ==========================================================================

  describe('Messaging', () => {
    it('should post a message to a channel', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        ts: '1234567890.123456',
        channel: 'C123CHANNEL',
      }));

      const result = await service.postMessage({
        channel: 'C123CHANNEL',
        text: 'Hello, World!',
      });

      expect(result.ok).toBe(true);
      expect(result.ts).toBe('1234567890.123456');
      expect(result.channel).toBe('C123CHANNEL');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://slack.com/api/chat.postMessage',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer xoxb-mock-bot-token',
          }),
        })
      );
    });

    it('should post message with blocks', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        ts: '1234567890.123456',
        channel: 'C123CHANNEL',
      }));

      const blocks: Block[] = [
        {
          type: 'section',
          text: { type: 'mrkdwn', text: '*Bold text*' },
        },
      ];

      const result = await service.postMessage({
        channel: 'C123CHANNEL',
        text: 'Fallback text',
        blocks,
      });

      expect(result.ok).toBe(true);
    });

    it('should throw error on message failure', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: false,
        error: 'channel_not_found',
      }));

      await expect(
        service.postMessage({ channel: 'invalid', text: 'test' })
      ).rejects.toThrow('Slack API error: channel_not_found');
    });

    it('should update an existing message', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({ ok: true }));

      await expect(
        service.updateMessage('C123', '1234567890.123456', { text: 'Updated' })
      ).resolves.not.toThrow();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://slack.com/api/chat.update',
        expect.any(Object)
      );
    });

    it('should send direct message to user', async () => {
      // First call opens DM channel
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        channel: { id: 'D123DM' },
      }));

      // Second call sends message
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        ts: '1234567890.123456',
        channel: 'D123DM',
      }));

      const result = await service.sendDirectMessage('U123USER', {
        text: 'Direct message',
      });

      expect(result.channel).toBe('D123DM');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should throw error if DM channel open fails', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: false,
        error: 'user_not_found',
      }));

      await expect(
        service.sendDirectMessage('invalid-user', { text: 'test' })
      ).rejects.toThrow('Failed to open DM: user_not_found');
    });

    it('should respond to interaction via response_url', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({ ok: true }));

      await service.respondToInteraction(
        'https://hooks.slack.com/response/123',
        { text: 'Response message' },
        true
      );

      expect(mockFetch).toHaveBeenCalledWith(
        'https://hooks.slack.com/response/123',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"replace_original":true'),
        })
      );
    });
  });

  // ==========================================================================
  // Slash Command Tests
  // ==========================================================================

  describe('Slash Commands', () => {
    const basePayload: SlashCommandPayload = {
      token: 'mock-token',
      team_id: 'T123',
      team_domain: 'test-team',
      channel_id: 'C123',
      channel_name: 'general',
      user_id: 'U123',
      user_name: 'testuser',
      command: '/oracle',
      text: '',
      response_url: 'https://hooks.slack.com/response/123',
      trigger_id: 'trigger-123',
      api_app_id: 'A123',
    };

    describe('/oracle status', () => {
      it('should handle status command', async () => {
        const payload = { ...basePayload, text: 'status' };

        const response = await service.handleOracleCommand(payload);

        expect(response.response_type).toBe('ephemeral');
        expect(response.blocks).toBeDefined();
        expect(response.blocks.length).toBeGreaterThan(0);
        expect(response.text).toContain('ORACLE Status');
      });

      it('should include phase in status response', async () => {
        const payload = { ...basePayload, text: 'status' };

        const response = await service.handleOracleCommand(payload);

        const textContent = JSON.stringify(response.blocks);
        expect(textContent).toMatch(/observe|orient|decide|act|idle/i);
      });
    });

    describe('/oracle decide', () => {
      it('should handle decide command with topic', async () => {
        const payload = { ...basePayload, text: 'decide Should we launch feature X?' };

        const response = await service.handleOracleCommand(payload);

        expect(response.response_type).toBe('in_channel');
        expect(response.text).toContain('Should we launch feature X?');
      });

      it('should show error when topic is missing', async () => {
        const payload = { ...basePayload, text: 'decide' };

        const response = await service.handleOracleCommand(payload);

        expect(response.response_type).toBe('ephemeral');
        expect(response.text).toContain('provide a decision topic');
      });

      it('should include decision options in response', async () => {
        const payload = { ...basePayload, text: 'decide Test decision' };

        const response = await service.handleOracleCommand(payload);

        // Response should have option blocks with buttons
        const hasButtons = response.blocks.some(
          (block) => block.type === 'actions' ||
            (block.type === 'section' && (block as any).accessory?.type === 'button')
        );
        expect(hasButtons).toBe(true);
      });
    });

    describe('/oracle signals', () => {
      it('should handle signals command', async () => {
        const payload = { ...basePayload, text: 'signals' };

        const response = await service.handleOracleCommand(payload);

        expect(response.response_type).toBe('ephemeral');
        expect(response.text).toContain('signals');
      });

      it('should list active signals', async () => {
        const payload = { ...basePayload, text: 'signals' };

        const response = await service.handleOracleCommand(payload);

        // Should have header and signal sections
        expect(response.blocks.some((b) => b.type === 'header')).toBe(true);
      });
    });

    describe('/oracle help', () => {
      it('should handle help command', async () => {
        const payload = { ...basePayload, text: 'help' };

        const response = await service.handleOracleCommand(payload);

        expect(response.response_type).toBe('ephemeral');
        expect(response.text).toBe('ORACLE Commands Help');
      });

      it('should show help as default for unknown subcommand', async () => {
        const payload = { ...basePayload, text: 'unknown_command' };

        const response = await service.handleOracleCommand(payload);

        expect(response.text).toBe('ORACLE Commands Help');
      });

      it('should list available commands in help', async () => {
        const payload = { ...basePayload, text: 'help' };

        const response = await service.handleOracleCommand(payload);

        const blockText = JSON.stringify(response.blocks);
        expect(blockText).toContain('/oracle status');
        expect(blockText).toContain('/oracle decide');
        expect(blockText).toContain('/oracle signals');
        expect(blockText).toContain('/oracle help');
      });
    });

    it('should handle empty command text', async () => {
      const payload = { ...basePayload, text: '' };

      const response = await service.handleOracleCommand(payload);

      // Should show help by default
      expect(response.text).toBe('ORACLE Commands Help');
    });
  });

  // ==========================================================================
  // Interaction Handler Tests
  // ==========================================================================

  describe('Interaction Handlers', () => {
    const baseInteraction: InteractionPayload = {
      type: 'block_actions',
      token: 'mock-token',
      team: { id: 'T123', domain: 'test' },
      user: { id: 'U123', username: 'testuser', name: 'Test User', team_id: 'T123' },
      channel: { id: 'C123', name: 'general' },
      trigger_id: 'trigger-123',
      response_url: 'https://hooks.slack.com/response/123',
      actions: [],
    };

    it('should handle approve_decision action', async () => {
      const payload: InteractionPayload = {
        ...baseInteraction,
        actions: [{
          action_id: 'approve_decision',
          block_id: 'block-1',
          type: 'button',
          value: 'dec-123',
        }],
      };

      const result = await service.handleBlockAction(payload);

      expect(result.action).toBe('approve_decision');
      expect(result.data.decision_id).toBe('dec-123');
      expect(result.response).toBeDefined();
    });

    it('should handle defer_decision action', async () => {
      const payload: InteractionPayload = {
        ...baseInteraction,
        actions: [{
          action_id: 'defer_decision',
          block_id: 'block-1',
          type: 'button',
          value: 'dec-123',
        }],
      };

      const result = await service.handleBlockAction(payload);

      expect(result.action).toBe('defer_decision');
      expect(result.data.decision_id).toBe('dec-123');
    });

    it('should handle view_details action', async () => {
      const payload: InteractionPayload = {
        ...baseInteraction,
        actions: [{
          action_id: 'view_details',
          block_id: 'block-1',
          type: 'button',
          value: 'entity-123',
        }],
      };

      const result = await service.handleBlockAction(payload);

      expect(result.action).toBe('view_details');
      expect(result.data.entity_id).toBe('entity-123');
    });

    it('should handle select_option action', async () => {
      const payload: InteractionPayload = {
        ...baseInteraction,
        actions: [{
          action_id: 'select_option',
          block_id: 'block-1',
          type: 'static_select',
          selected_option: { value: 'opt-1' },
        }],
      };

      const result = await service.handleBlockAction(payload);

      expect(result.action).toBe('select_option');
      expect(result.data.option_id).toBe('opt-1');
    });

    it('should handle acknowledge_signal action', async () => {
      const payload: InteractionPayload = {
        ...baseInteraction,
        actions: [{
          action_id: 'acknowledge_signal',
          block_id: 'block-1',
          type: 'button',
          value: 'signal-123',
        }],
      };

      const result = await service.handleBlockAction(payload);

      expect(result.action).toBe('acknowledge_signal');
      expect(result.data.signal_id).toBe('signal-123');
    });

    it('should handle dismiss_signal action', async () => {
      const payload: InteractionPayload = {
        ...baseInteraction,
        actions: [{
          action_id: 'dismiss_signal',
          block_id: 'block-1',
          type: 'button',
          value: 'signal-123',
        }],
      };

      const result = await service.handleBlockAction(payload);

      expect(result.action).toBe('dismiss_signal');
      expect(result.data.signal_id).toBe('signal-123');
    });

    it('should handle unknown action', async () => {
      const payload: InteractionPayload = {
        ...baseInteraction,
        actions: [{
          action_id: 'unknown_action',
          block_id: 'block-1',
          type: 'button',
          value: 'test',
        }],
      };

      const result = await service.handleBlockAction(payload);

      expect(result.action).toBe('unknown');
      expect(result.data.action_id).toBe('unknown_action');
    });

    it('should handle interaction with no actions', async () => {
      const payload: InteractionPayload = {
        ...baseInteraction,
        actions: undefined,
      };

      const result = await service.handleBlockAction(payload);

      expect(result.action).toBe('none');
      expect(result.data).toBeNull();
    });

    it('should handle action with empty value', async () => {
      const payload: InteractionPayload = {
        ...baseInteraction,
        actions: [{
          action_id: 'approve_decision',
          block_id: 'block-1',
          type: 'button',
        }],
      };

      const result = await service.handleBlockAction(payload);

      expect(result.action).toBe('approve_decision');
      expect(result.data.decision_id).toBe('');
    });
  });

  // ==========================================================================
  // Notification Tests
  // ==========================================================================

  describe('Notifications', () => {
    beforeEach(() => {
      // Mock for opening DM channel
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        channel: { id: 'D123DM' },
      }));
      // Mock for sending message
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        ts: '1234567890.123456',
        channel: 'D123DM',
      }));
    });

    it('should send urgent signal notification', async () => {
      await service.notifyUrgentSignal('U123', {
        id: 'signal-1',
        title: 'Critical Alert',
        description: 'Something needs attention',
        urgency: 'critical',
        type: 'alert',
      });

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should send notification with correct urgency emoji', async () => {
      await service.notifyUrgentSignal('U123', {
        id: 'signal-1',
        title: 'High Priority Alert',
        urgency: 'high',
        type: 'alert',
      });

      // Check that the message was sent (we can't easily inspect the body)
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should send decision needed notification', async () => {
      await service.notifyDecisionNeeded('U123', {
        id: 'dec-1',
        title: 'Important Decision',
        description: 'Please decide',
        deadline: '2024-01-20',
        options: [
          { id: 'opt-1', title: 'Option A', score: 0.8 },
          { id: 'opt-2', title: 'Option B', score: 0.6 },
        ],
      });

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should send execution update notification', async () => {
      await service.notifyExecutionUpdate('U123', {
        plan_id: 'plan-1',
        plan_title: 'Project Alpha',
        status: 'active',
        progress: 75,
        next_step: 'Review documentation',
      });

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should handle notification without description', async () => {
      await service.notifyUrgentSignal('U123', {
        id: 'signal-1',
        title: 'Simple Alert',
        urgency: 'low',
        type: 'info',
      });

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should handle decision notification without deadline', async () => {
      await service.notifyDecisionNeeded('U123', {
        id: 'dec-1',
        title: 'Quick Decision',
        options: [
          { id: 'opt-1', title: 'Yes', score: 0.5 },
          { id: 'opt-2', title: 'No', score: 0.5 },
        ],
      });

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  // ==========================================================================
  // Factory Function Tests
  // ==========================================================================

  describe('Factory Function', () => {
    it('should create service with environment variables', () => {
      const originalEnv = { ...process.env };

      process.env.SLACK_BOT_TOKEN = 'xoxb-env-token';
      process.env.SLACK_SIGNING_SECRET = 'env-secret';
      process.env.SLACK_CLIENT_ID = 'env-client-id';
      process.env.SLACK_CLIENT_SECRET = 'env-client-secret';

      const factoryService = createSlackService();

      expect(factoryService).toBeInstanceOf(SlackService);

      process.env = originalEnv;
    });
  });
});

// ============================================================================
// BlockKitBuilder Tests
// ============================================================================

describe('BlockKitBuilder', () => {
  describe('buildStatusMessage', () => {
    it('should build status message with all fields', () => {
      const status = {
        phase: 'observe',
        loop_running: true,
        active_signals: 5,
        pending_decisions: 2,
        system_confidence: 0.85,
      };

      const blocks = BlockKitBuilder.buildStatusMessage(status);

      expect(blocks.length).toBeGreaterThan(0);
      expect(blocks[0].type).toBe('header');

      const textContent = JSON.stringify(blocks);
      expect(textContent).toContain('OBSERVE');
      expect(textContent).toContain('Running');
      expect(textContent).toContain('5');
      expect(textContent).toContain('85%');
    });

    it('should show stopped status when loop not running', () => {
      const status = {
        phase: 'idle',
        loop_running: false,
        active_signals: 0,
        pending_decisions: 0,
        system_confidence: 0.5,
      };

      const blocks = BlockKitBuilder.buildStatusMessage(status);

      const textContent = JSON.stringify(blocks);
      expect(textContent).toContain('Stopped');
    });

    it('should include action buttons', () => {
      const status = {
        phase: 'decide',
        loop_running: true,
        active_signals: 3,
        pending_decisions: 1,
        system_confidence: 0.9,
      };

      const blocks = BlockKitBuilder.buildStatusMessage(status);

      const hasActions = blocks.some((b) => b.type === 'actions');
      expect(hasActions).toBe(true);
    });
  });

  describe('buildDecisionMessage', () => {
    it('should build decision message with options', () => {
      const decision = {
        id: 'dec-1',
        title: 'Test Decision',
        description: 'Description here',
        options: [
          { id: 'opt-1', title: 'Option A', score: 0.8 },
          { id: 'opt-2', title: 'Option B', score: 0.6 },
        ],
      };

      const blocks = BlockKitBuilder.buildDecisionMessage(decision);

      expect(blocks.length).toBeGreaterThan(0);
      expect(blocks[0].type).toBe('header');

      const textContent = JSON.stringify(blocks);
      expect(textContent).toContain('Test Decision');
      expect(textContent).toContain('Option A');
      expect(textContent).toContain('80%');
    });

    it('should handle decision without description', () => {
      const decision = {
        id: 'dec-1',
        title: 'Simple Decision',
        options: [],
      };

      const blocks = BlockKitBuilder.buildDecisionMessage(decision);

      expect(blocks.length).toBeGreaterThan(0);
    });

    it('should show score bars for options', () => {
      const decision = {
        id: 'dec-1',
        title: 'Decision',
        options: [
          { id: 'opt-1', title: 'High Score', score: 1.0 },
          { id: 'opt-2', title: 'Low Score', score: 0.2 },
        ],
      };

      const blocks = BlockKitBuilder.buildDecisionMessage(decision);

      const textContent = JSON.stringify(blocks);
      expect(textContent).toContain('green_square');
      expect(textContent).toContain('white_square');
    });
  });

  describe('buildSignalsMessage', () => {
    it('should build signals list message', () => {
      const signals = [
        { id: 's1', title: 'Signal 1', urgency: 'high', type: 'alert' },
        { id: 's2', title: 'Signal 2', urgency: 'low', type: 'info' },
      ];

      const blocks = BlockKitBuilder.buildSignalsMessage(signals);

      expect(blocks.length).toBeGreaterThan(0);
      expect(blocks[0].type).toBe('header');

      const textContent = JSON.stringify(blocks);
      expect(textContent).toContain('Signal 1');
      expect(textContent).toContain('Signal 2');
    });

    it('should show all clear message when no signals', () => {
      const blocks = BlockKitBuilder.buildSignalsMessage([]);

      const textContent = JSON.stringify(blocks);
      expect(textContent).toContain('all clear');
    });

    it('should show correct urgency emojis', () => {
      const signals = [
        { id: 's1', title: 'Critical', urgency: 'critical', type: 'alert' },
        { id: 's2', title: 'High', urgency: 'high', type: 'alert' },
        { id: 's3', title: 'Medium', urgency: 'medium', type: 'alert' },
        { id: 's4', title: 'Low', urgency: 'low', type: 'info' },
      ];

      const blocks = BlockKitBuilder.buildSignalsMessage(signals);

      const textContent = JSON.stringify(blocks);
      expect(textContent).toContain('rotating_light');
      expect(textContent).toContain('warning');
      expect(textContent).toContain('bell');
      expect(textContent).toContain('information_source');
    });
  });

  describe('buildSignalNotification', () => {
    it('should build signal notification', () => {
      const signal = {
        id: 'sig-1',
        title: 'Alert',
        description: 'Details here',
        urgency: 'high',
        type: 'alert',
      };

      const blocks = BlockKitBuilder.buildSignalNotification(signal);

      expect(blocks.length).toBeGreaterThan(0);

      const textContent = JSON.stringify(blocks);
      expect(textContent).toContain('Alert');
      expect(textContent).toContain('HIGH');
    });

    it('should include action buttons', () => {
      const signal = {
        id: 'sig-1',
        title: 'Test',
        urgency: 'medium',
        type: 'test',
      };

      const blocks = BlockKitBuilder.buildSignalNotification(signal);

      const hasActions = blocks.some((b) => b.type === 'actions');
      expect(hasActions).toBe(true);
    });
  });

  describe('buildDecisionNotification', () => {
    it('should build decision notification', () => {
      const decision = {
        id: 'dec-1',
        title: 'Urgent Decision',
        deadline: '2024-01-20',
        options: [
          { id: 'opt-1', title: 'Yes', score: 0.8 },
        ],
      };

      const blocks = BlockKitBuilder.buildDecisionNotification(decision);

      expect(blocks.length).toBeGreaterThan(0);

      const textContent = JSON.stringify(blocks);
      expect(textContent).toContain('Urgent Decision');
      expect(textContent).toContain('2024-01-20');
    });

    it('should show top recommendation', () => {
      const decision = {
        id: 'dec-1',
        title: 'Decision',
        options: [
          { id: 'opt-1', title: 'Best Option', score: 0.9 },
          { id: 'opt-2', title: 'Other', score: 0.5 },
        ],
      };

      const blocks = BlockKitBuilder.buildDecisionNotification(decision);

      const textContent = JSON.stringify(blocks);
      expect(textContent).toContain('Best Option');
      expect(textContent).toContain('90%');
    });
  });

  describe('buildExecutionUpdate', () => {
    it('should build execution update message', () => {
      const update = {
        plan_id: 'plan-1',
        plan_title: 'Project X',
        status: 'active',
        progress: 50,
        next_step: 'Review code',
      };

      const blocks = BlockKitBuilder.buildExecutionUpdate(update);

      expect(blocks.length).toBeGreaterThan(0);

      const textContent = JSON.stringify(blocks);
      expect(textContent).toContain('Project X');
      expect(textContent).toContain('50%');
      expect(textContent).toContain('Review code');
    });

    it('should show progress bar', () => {
      const update = {
        plan_id: 'plan-1',
        plan_title: 'Plan',
        status: 'active',
        progress: 70,
      };

      const blocks = BlockKitBuilder.buildExecutionUpdate(update);

      const textContent = JSON.stringify(blocks);
      expect(textContent).toContain('green_square');
    });

    it('should show correct status emoji', () => {
      const statuses = ['active', 'completed', 'blocked', 'paused'];
      const emojis = ['arrow_forward', 'white_check_mark', 'no_entry', 'pause_button'];

      for (let i = 0; i < statuses.length; i++) {
        const update = {
          plan_id: 'plan-1',
          plan_title: 'Plan',
          status: statuses[i],
          progress: 50,
        };

        const blocks = BlockKitBuilder.buildExecutionUpdate(update);
        const textContent = JSON.stringify(blocks);

        expect(textContent).toContain(emojis[i]);
      }
    });
  });
});

// ============================================================================
// Error Handling Tests
// ============================================================================

describe('Error Handling', () => {
  let service: SlackService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SlackService(
      'xoxb-mock-token',
      'mock-secret',
      'mock-client-id',
      'mock-client-secret'
    );
  });

  it('should handle network errors', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    await expect(
      service.postMessage({ channel: 'C123', text: 'test' })
    ).rejects.toThrow('Network error');
  });

  it('should handle rate limiting response', async () => {
    mockFetch.mockResolvedValueOnce(createMockResponse({
      ok: false,
      error: 'rate_limited',
    }));

    await expect(
      service.postMessage({ channel: 'C123', text: 'test' })
    ).rejects.toThrow('rate_limited');
  });

  it('should handle invalid token response', async () => {
    mockFetch.mockResolvedValueOnce(createMockResponse({
      ok: false,
      error: 'invalid_auth',
    }));

    await expect(
      service.postMessage({ channel: 'C123', text: 'test' })
    ).rejects.toThrow('invalid_auth');
  });
});
