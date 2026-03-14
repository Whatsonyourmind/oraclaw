/**
 * ORACLE Email Integration
 * Story int-6 - Scan emails for signals and context
 *
 * Features:
 * - OAuth2 for Gmail and Outlook
 * - Scan recent emails for signals
 * - Extract action items from emails
 * - Send decision summaries via email
 * - Email-to-signal conversion
 */

import * as SecureStore from 'expo-secure-store';
import { Signal, Decision } from '@mission-control/shared-types';
import {
  IntegrationConfig,
  IntegrationStatus,
  OAuthTokens,
  SyncResult,
} from './googleCalendar';

// ============================================================================
// TYPES
// ============================================================================

export type EmailProvider = 'gmail' | 'outlook';

export interface EmailAccount {
  provider: EmailProvider;
  email: string;
  name?: string;
  connected: boolean;
  lastSync?: Date;
}

export interface EmailMessage {
  id: string;
  thread_id: string;
  provider: EmailProvider;
  from: EmailAddress;
  to: EmailAddress[];
  cc?: EmailAddress[];
  bcc?: EmailAddress[];
  subject: string;
  snippet: string;
  body_text?: string;
  body_html?: string;
  date: Date;
  labels?: string[];
  is_read: boolean;
  is_starred: boolean;
  has_attachments: boolean;
  attachments?: EmailAttachment[];
  // Extracted data
  action_items?: ActionItem[];
  extracted_signals?: Partial<Signal>[];
}

export interface EmailAddress {
  email: string;
  name?: string;
}

export interface EmailAttachment {
  id: string;
  filename: string;
  mime_type: string;
  size: number;
}

export interface ActionItem {
  id: string;
  text: string;
  assignee?: string;
  due_date?: Date;
  priority: 'low' | 'medium' | 'high';
  source_email_id: string;
  confidence: number;
}

export interface EmailFilter {
  from?: string;
  to?: string;
  subject?: string;
  after?: Date;
  before?: Date;
  has_attachment?: boolean;
  is_unread?: boolean;
  labels?: string[];
  max_results?: number;
}

export interface SendEmailParams {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body_text?: string;
  body_html?: string;
  reply_to_message_id?: string;
}

export interface EmailSyncConfig {
  enabled: boolean;
  accounts: EmailAccount[];
  scanFrequencyMinutes: number;
  autoExtractActionItems: boolean;
  autoCreateSignals: boolean;
  signalKeywords: string[];
  excludeLabels: string[];
  lastScanCursor?: string;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const GMAIL_CONFIG: IntegrationConfig = {
  provider: 'gmail',
  name: 'Gmail',
  description: 'Scan Gmail for signals and send decision summaries',
  icon: 'envelope',
  scopes: [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.labels',
  ],
  authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenUrl: 'https://oauth2.googleapis.com/token',
  revokeUrl: 'https://oauth2.googleapis.com/revoke',
};

const OUTLOOK_CONFIG: IntegrationConfig = {
  provider: 'outlook',
  name: 'Outlook',
  description: 'Scan Outlook for signals and send decision summaries',
  icon: 'envelope.badge',
  scopes: [
    'Mail.Read',
    'Mail.Send',
    'User.Read',
  ],
  authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
  tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
};

const STORAGE_KEYS = {
  GMAIL_ACCESS_TOKEN: 'oracle_gmail_access_token',
  GMAIL_REFRESH_TOKEN: 'oracle_gmail_refresh_token',
  OUTLOOK_ACCESS_TOKEN: 'oracle_outlook_access_token',
  OUTLOOK_REFRESH_TOKEN: 'oracle_outlook_refresh_token',
  SYNC_CONFIG: 'oracle_email_sync_config',
  LAST_SYNC: 'oracle_email_last_sync',
} as const;

const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1';
const OUTLOOK_API = 'https://graph.microsoft.com/v1.0';

// Action item extraction patterns
const ACTION_PATTERNS = [
  /(?:please|could you|can you|would you|action required|todo|to-do|task|follow up|follow-up)[:.\s]+(.+?)(?:\.|$)/gi,
  /\[action\][:.\s]*(.+?)(?:\.|$)/gi,
  /(?:deadline|due|by)[:.\s]+(.+?)(?:\.|$)/gi,
  /(?:assigned to|owner)[:.\s]+(\w+)/gi,
];

// ============================================================================
// EMAIL SERVICE
// ============================================================================

class EmailService {
  private tokens: Map<EmailProvider, OAuthTokens> = new Map();
  private status: Map<EmailProvider, IntegrationStatus> = new Map();
  private emails: EmailMessage[] = [];
  private actionItems: ActionItem[] = [];
  private syncConfig: EmailSyncConfig;
  private syncInProgress = false;
  private clientIds: Map<EmailProvider, string> = new Map();
  private clientSecrets: Map<EmailProvider, string> = new Map();
  private redirectUri: string;

  constructor() {
    this.clientIds.set('gmail', process.env.GOOGLE_CLIENT_ID || '');
    this.clientIds.set('outlook', process.env.OUTLOOK_CLIENT_ID || '');
    this.clientSecrets.set('gmail', process.env.GOOGLE_CLIENT_SECRET || '');
    this.clientSecrets.set('outlook', process.env.OUTLOOK_CLIENT_SECRET || '');
    this.redirectUri = 'com.missioncontrol.oracle:/oauth2callback/email';

    this.status.set('gmail', 'disconnected');
    this.status.set('outlook', 'disconnected');

    this.syncConfig = {
      enabled: true,
      accounts: [],
      scanFrequencyMinutes: 15,
      autoExtractActionItems: true,
      autoCreateSignals: true,
      signalKeywords: ['urgent', 'deadline', 'asap', 'important', 'action required', 'blocking'],
      excludeLabels: ['SPAM', 'TRASH', 'PROMOTIONS'],
    };

    this.loadConfig();
  }

  // --------------------------------------------------------------------------
  // Configuration
  // --------------------------------------------------------------------------

  private async loadConfig(): Promise<void> {
    try {
      // Load Gmail tokens
      const gmailToken = await SecureStore.getItemAsync(STORAGE_KEYS.GMAIL_ACCESS_TOKEN);
      const gmailRefresh = await SecureStore.getItemAsync(STORAGE_KEYS.GMAIL_REFRESH_TOKEN);
      if (gmailToken && gmailRefresh) {
        this.tokens.set('gmail', {
          access_token: gmailToken,
          refresh_token: gmailRefresh,
          expires_at: 0, // Will refresh on first use
          token_type: 'Bearer',
          scope: GMAIL_CONFIG.scopes.join(' '),
        });
        this.status.set('gmail', 'connected');
      }

      // Load Outlook tokens
      const outlookToken = await SecureStore.getItemAsync(STORAGE_KEYS.OUTLOOK_ACCESS_TOKEN);
      const outlookRefresh = await SecureStore.getItemAsync(STORAGE_KEYS.OUTLOOK_REFRESH_TOKEN);
      if (outlookToken && outlookRefresh) {
        this.tokens.set('outlook', {
          access_token: outlookToken,
          refresh_token: outlookRefresh,
          expires_at: 0,
          token_type: 'Bearer',
          scope: OUTLOOK_CONFIG.scopes.join(' '),
        });
        this.status.set('outlook', 'connected');
      }

      // Load sync config
      const config = await SecureStore.getItemAsync(STORAGE_KEYS.SYNC_CONFIG);
      if (config) {
        this.syncConfig = { ...this.syncConfig, ...JSON.parse(config) };
      }
    } catch (error) {
      console.warn('[Email] Failed to load config:', error);
    }
  }

  private async saveConfig(): Promise<void> {
    try {
      await SecureStore.setItemAsync(
        STORAGE_KEYS.SYNC_CONFIG,
        JSON.stringify(this.syncConfig)
      );
    } catch (error) {
      console.warn('[Email] Failed to save config:', error);
    }
  }

  private async saveTokens(provider: EmailProvider, tokens: OAuthTokens): Promise<void> {
    const prefix = provider === 'gmail' ? 'GMAIL' : 'OUTLOOK';
    await SecureStore.setItemAsync(
      STORAGE_KEYS[`${prefix}_ACCESS_TOKEN` as keyof typeof STORAGE_KEYS],
      tokens.access_token
    );
    if (tokens.refresh_token) {
      await SecureStore.setItemAsync(
        STORAGE_KEYS[`${prefix}_REFRESH_TOKEN` as keyof typeof STORAGE_KEYS],
        tokens.refresh_token
      );
    }
  }

  // --------------------------------------------------------------------------
  // OAuth2 Flow
  // --------------------------------------------------------------------------

  /**
   * Get authorization URL for a provider
   */
  getAuthorizationUrl(provider: EmailProvider, state?: string): string {
    const config = provider === 'gmail' ? GMAIL_CONFIG : OUTLOOK_CONFIG;
    const clientId = this.clientIds.get(provider) || '';

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: `${this.redirectUri}/${provider}`,
      response_type: 'code',
      scope: config.scopes.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      state: state || Math.random().toString(36).substring(2, 15),
    });

    return `${config.authUrl}?${params.toString()}`;
  }

  /**
   * Exchange code for tokens
   */
  async exchangeCodeForTokens(provider: EmailProvider, code: string): Promise<OAuthTokens> {
    console.log(`[Email] Exchanging code for ${provider} tokens`);

    const config = provider === 'gmail' ? GMAIL_CONFIG : OUTLOOK_CONFIG;
    const clientId = this.clientIds.get(provider) || '';
    const clientSecret = this.clientSecrets.get(provider) || '';

    const response = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: `${this.redirectUri}/${provider}`,
      }).toString(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Token exchange failed: ${error.error_description || error.error}`);
    }

    const data = await response.json();
    const tokens: OAuthTokens = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Date.now() + data.expires_in * 1000,
      token_type: data.token_type,
      scope: config.scopes.join(' '),
    };

    this.tokens.set(provider, tokens);
    await this.saveTokens(provider, tokens);
    this.status.set(provider, 'connected');

    // Add account to sync config
    const userInfo = await this.fetchUserInfo(provider);
    this.syncConfig.accounts.push({
      provider,
      email: userInfo.email,
      name: userInfo.name,
      connected: true,
      lastSync: undefined,
    });
    await this.saveConfig();

    console.log(`[Email] ${provider} connected:`, userInfo.email);
    return tokens;
  }

  /**
   * Refresh access token
   */
  async refreshToken(provider: EmailProvider): Promise<string> {
    const tokens = this.tokens.get(provider);
    if (!tokens?.refresh_token) {
      throw new Error(`No refresh token for ${provider}`);
    }

    const config = provider === 'gmail' ? GMAIL_CONFIG : OUTLOOK_CONFIG;
    const clientId = this.clientIds.get(provider) || '';
    const clientSecret = this.clientSecrets.get(provider) || '';

    const response = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: tokens.refresh_token,
        grant_type: 'refresh_token',
      }).toString(),
    });

    if (!response.ok) {
      this.status.set(provider, 'error');
      throw new Error('Token refresh failed');
    }

    const data = await response.json();
    const newTokens: OAuthTokens = {
      ...tokens,
      access_token: data.access_token,
      expires_at: Date.now() + data.expires_in * 1000,
    };

    this.tokens.set(provider, newTokens);
    await this.saveTokens(provider, newTokens);

    return newTokens.access_token;
  }

  /**
   * Get valid access token
   */
  async getValidToken(provider: EmailProvider): Promise<string> {
    const tokens = this.tokens.get(provider);
    if (!tokens) throw new Error(`Not connected to ${provider}`);

    if (Date.now() > tokens.expires_at - 5 * 60 * 1000) {
      return this.refreshToken(provider);
    }

    return tokens.access_token;
  }

  /**
   * Disconnect a provider
   */
  async disconnect(provider: EmailProvider): Promise<void> {
    console.log(`[Email] Disconnecting ${provider}`);

    const prefix = provider === 'gmail' ? 'GMAIL' : 'OUTLOOK';
    await SecureStore.deleteItemAsync(STORAGE_KEYS[`${prefix}_ACCESS_TOKEN` as keyof typeof STORAGE_KEYS]);
    await SecureStore.deleteItemAsync(STORAGE_KEYS[`${prefix}_REFRESH_TOKEN` as keyof typeof STORAGE_KEYS]);

    this.tokens.delete(provider);
    this.status.set(provider, 'disconnected');

    this.syncConfig.accounts = this.syncConfig.accounts.filter(a => a.provider !== provider);
    await this.saveConfig();
  }

  // --------------------------------------------------------------------------
  // User Info
  // --------------------------------------------------------------------------

  private async fetchUserInfo(provider: EmailProvider): Promise<{ email: string; name?: string }> {
    const token = await this.getValidToken(provider);

    if (provider === 'gmail') {
      const response = await fetch(`${GMAIL_API}/users/me/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      return { email: data.emailAddress };
    } else {
      const response = await fetch(`${OUTLOOK_API}/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      return { email: data.mail || data.userPrincipalName, name: data.displayName };
    }
  }

  // --------------------------------------------------------------------------
  // Email Fetching
  // --------------------------------------------------------------------------

  /**
   * Fetch emails from a provider
   */
  async fetchEmails(provider: EmailProvider, filter: EmailFilter = {}): Promise<EmailMessage[]> {
    console.log(`[Email] Fetching emails from ${provider}`);

    const token = await this.getValidToken(provider);
    const maxResults = filter.max_results || 50;

    if (provider === 'gmail') {
      return this.fetchGmailMessages(token, filter, maxResults);
    } else {
      return this.fetchOutlookMessages(token, filter, maxResults);
    }
  }

  private async fetchGmailMessages(
    token: string,
    filter: EmailFilter,
    maxResults: number
  ): Promise<EmailMessage[]> {
    // Build Gmail query
    const queryParts: string[] = [];
    if (filter.from) queryParts.push(`from:${filter.from}`);
    if (filter.to) queryParts.push(`to:${filter.to}`);
    if (filter.subject) queryParts.push(`subject:${filter.subject}`);
    if (filter.after) queryParts.push(`after:${Math.floor(filter.after.getTime() / 1000)}`);
    if (filter.before) queryParts.push(`before:${Math.floor(filter.before.getTime() / 1000)}`);
    if (filter.has_attachment) queryParts.push('has:attachment');
    if (filter.is_unread) queryParts.push('is:unread');

    const params = new URLSearchParams({
      maxResults: maxResults.toString(),
      q: queryParts.join(' '),
    });

    const listResponse = await fetch(`${GMAIL_API}/users/me/messages?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const listData = await listResponse.json();

    if (!listData.messages) return [];

    // Fetch message details
    const messages: EmailMessage[] = [];
    for (const msg of listData.messages.slice(0, maxResults)) {
      const detailResponse = await fetch(`${GMAIL_API}/users/me/messages/${msg.id}?format=full`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const detail = await detailResponse.json();
      messages.push(this.parseGmailMessage(detail));
    }

    return messages;
  }

  private parseGmailMessage(data: any): EmailMessage {
    const headers = data.payload.headers;
    const getHeader = (name: string) => headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

    const parseAddress = (str: string): EmailAddress => {
      const match = str.match(/(.+?)\s*<(.+?)>/);
      return match ? { name: match[1].trim(), email: match[2] } : { email: str };
    };

    let bodyText = '';
    let bodyHtml = '';

    const extractBody = (part: any) => {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        bodyText = Buffer.from(part.body.data, 'base64').toString();
      }
      if (part.mimeType === 'text/html' && part.body?.data) {
        bodyHtml = Buffer.from(part.body.data, 'base64').toString();
      }
      if (part.parts) {
        part.parts.forEach(extractBody);
      }
    };
    extractBody(data.payload);

    return {
      id: data.id,
      thread_id: data.threadId,
      provider: 'gmail',
      from: parseAddress(getHeader('From')),
      to: getHeader('To').split(',').map(parseAddress),
      cc: getHeader('Cc') ? getHeader('Cc').split(',').map(parseAddress) : undefined,
      subject: getHeader('Subject'),
      snippet: data.snippet,
      body_text: bodyText,
      body_html: bodyHtml,
      date: new Date(parseInt(data.internalDate)),
      labels: data.labelIds,
      is_read: !data.labelIds?.includes('UNREAD'),
      is_starred: data.labelIds?.includes('STARRED'),
      has_attachments: data.payload.parts?.some((p: any) => p.filename) || false,
    };
  }

  private async fetchOutlookMessages(
    token: string,
    filter: EmailFilter,
    maxResults: number
  ): Promise<EmailMessage[]> {
    const params = new URLSearchParams({
      $top: maxResults.toString(),
      $orderby: 'receivedDateTime desc',
      $select: 'id,conversationId,from,toRecipients,ccRecipients,subject,bodyPreview,body,receivedDateTime,isRead,flag,hasAttachments',
    });

    // Build filter
    const filters: string[] = [];
    if (filter.after) filters.push(`receivedDateTime ge ${filter.after.toISOString()}`);
    if (filter.before) filters.push(`receivedDateTime le ${filter.before.toISOString()}`);
    if (filter.is_unread) filters.push('isRead eq false');
    if (filter.has_attachment) filters.push('hasAttachments eq true');
    if (filters.length) params.append('$filter', filters.join(' and '));

    const response = await fetch(`${OUTLOOK_API}/me/messages?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();

    return (data.value || []).map((msg: any) => this.parseOutlookMessage(msg));
  }

  private parseOutlookMessage(data: any): EmailMessage {
    return {
      id: data.id,
      thread_id: data.conversationId,
      provider: 'outlook',
      from: {
        email: data.from?.emailAddress?.address || '',
        name: data.from?.emailAddress?.name,
      },
      to: (data.toRecipients || []).map((r: any) => ({
        email: r.emailAddress.address,
        name: r.emailAddress.name,
      })),
      cc: data.ccRecipients?.map((r: any) => ({
        email: r.emailAddress.address,
        name: r.emailAddress.name,
      })),
      subject: data.subject,
      snippet: data.bodyPreview,
      body_text: data.body?.contentType === 'text' ? data.body.content : undefined,
      body_html: data.body?.contentType === 'html' ? data.body.content : undefined,
      date: new Date(data.receivedDateTime),
      is_read: data.isRead,
      is_starred: data.flag?.flagStatus === 'flagged',
      has_attachments: data.hasAttachments,
    };
  }

  // --------------------------------------------------------------------------
  // Action Item Extraction
  // --------------------------------------------------------------------------

  /**
   * Extract action items from email
   */
  extractActionItems(email: EmailMessage): ActionItem[] {
    const text = email.body_text || email.snippet || '';
    const items: ActionItem[] = [];

    for (const pattern of ACTION_PATTERNS) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        items.push({
          id: `action_${email.id}_${items.length}`,
          text: match[1].trim(),
          source_email_id: email.id,
          priority: this.detectPriority(match[1]),
          confidence: 0.7,
        });
      }
    }

    return items;
  }

  private detectPriority(text: string): 'low' | 'medium' | 'high' {
    const lowerText = text.toLowerCase();
    if (lowerText.includes('urgent') || lowerText.includes('asap') || lowerText.includes('immediately')) {
      return 'high';
    }
    if (lowerText.includes('soon') || lowerText.includes('this week')) {
      return 'medium';
    }
    return 'low';
  }

  // --------------------------------------------------------------------------
  // Signal Extraction
  // --------------------------------------------------------------------------

  /**
   * Convert email to signal
   */
  emailToSignal(email: EmailMessage): Partial<Signal> {
    // Determine urgency based on keywords
    const text = `${email.subject} ${email.snippet}`.toLowerCase();
    let urgency: 'low' | 'medium' | 'high' | 'critical' = 'low';

    for (const keyword of this.syncConfig.signalKeywords) {
      if (text.includes(keyword.toLowerCase())) {
        if (keyword.match(/urgent|critical|emergency/i)) {
          urgency = 'critical';
          break;
        } else if (keyword.match(/important|deadline|asap/i)) {
          urgency = 'high';
        } else if (urgency === 'low') {
          urgency = 'medium';
        }
      }
    }

    return {
      type: 'email',
      title: email.subject,
      summary: email.snippet,
      urgency,
      status: 'active',
      source: email.provider,
      detected_at: email.date.toISOString(),
      metadata: {
        email_id: email.id,
        email_provider: email.provider,
        from_email: email.from.email,
        from_name: email.from.name,
        thread_id: email.thread_id,
      },
    };
  }

  /**
   * Scan emails for signals
   */
  async scanForSignals(filter?: EmailFilter): Promise<Partial<Signal>[]> {
    console.log('[Email] Scanning for signals');

    const signals: Partial<Signal>[] = [];

    for (const account of this.syncConfig.accounts) {
      if (!account.connected) continue;

      const emails = await this.fetchEmails(account.provider, {
        ...filter,
        after: filter?.after || new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        max_results: 100,
      });

      for (const email of emails) {
        // Check if email matches signal keywords
        const text = `${email.subject} ${email.snippet}`.toLowerCase();
        const hasKeyword = this.syncConfig.signalKeywords.some(k =>
          text.includes(k.toLowerCase())
        );

        if (hasKeyword) {
          signals.push(this.emailToSignal(email));

          // Extract action items
          if (this.syncConfig.autoExtractActionItems) {
            email.action_items = this.extractActionItems(email);
            this.actionItems.push(...email.action_items);
          }
        }
      }
    }

    console.log(`[Email] Found ${signals.length} potential signals`);
    return signals;
  }

  // --------------------------------------------------------------------------
  // Send Email
  // --------------------------------------------------------------------------

  /**
   * Send decision summary email
   */
  async sendDecisionSummary(
    provider: EmailProvider,
    decision: Decision,
    recipients: string[]
  ): Promise<void> {
    console.log(`[Email] Sending decision summary via ${provider}`);

    const subject = `[ORACLE] Decision Summary: ${decision.title}`;
    const body = this.buildDecisionEmailBody(decision);

    await this.sendEmail(provider, {
      to: recipients,
      subject,
      body_html: body,
    });
  }

  private buildDecisionEmailBody(decision: Decision): string {
    const statusEmoji: Record<string, string> = {
      pending: '⏳',
      analyzing: '🔍',
      decided: '✅',
      executed: '🚀',
      cancelled: '❌',
    };

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; }
          .status { display: inline-block; padding: 4px 12px; border-radius: 12px; background: #f3f4f6; margin: 8px 0; }
          .section { margin: 20px 0; padding: 16px; background: #f9fafb; border-radius: 8px; }
          .footer { color: #6b7280; font-size: 12px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎯 ORACLE Decision</h1>
          </div>
          <h2>${decision.title}</h2>
          <p class="status">${statusEmoji[decision.status] || ''} ${decision.status.toUpperCase()}</p>
          <div class="section">
            <h3>Description</h3>
            <p>${decision.description || 'No description provided.'}</p>
          </div>
          <div class="footer">
            <p>This email was sent by ORACLE - Mission Control</p>
            <p>Decision ID: ${decision.id}</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Send email via provider
   */
  async sendEmail(provider: EmailProvider, params: SendEmailParams): Promise<void> {
    const token = await this.getValidToken(provider);

    if (provider === 'gmail') {
      await this.sendGmailMessage(token, params);
    } else {
      await this.sendOutlookMessage(token, params);
    }
  }

  private async sendGmailMessage(token: string, params: SendEmailParams): Promise<void> {
    const message = [
      `To: ${params.to.join(', ')}`,
      params.cc ? `Cc: ${params.cc.join(', ')}` : '',
      `Subject: ${params.subject}`,
      'Content-Type: text/html; charset=utf-8',
      '',
      params.body_html || params.body_text || '',
    ].filter(Boolean).join('\r\n');

    const encoded = Buffer.from(message).toString('base64url');

    await fetch(`${GMAIL_API}/users/me/messages/send`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw: encoded }),
    });
  }

  private async sendOutlookMessage(token: string, params: SendEmailParams): Promise<void> {
    await fetch(`${OUTLOOK_API}/me/sendMail`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          subject: params.subject,
          body: {
            contentType: params.body_html ? 'html' : 'text',
            content: params.body_html || params.body_text,
          },
          toRecipients: params.to.map(email => ({ emailAddress: { address: email } })),
          ccRecipients: params.cc?.map(email => ({ emailAddress: { address: email } })),
        },
      }),
    });
  }

  // --------------------------------------------------------------------------
  // Sync
  // --------------------------------------------------------------------------

  /**
   * Full sync with email providers
   */
  async sync(): Promise<SyncResult> {
    if (this.syncInProgress) {
      return {
        success: false,
        events_fetched: 0,
        events_created: 0,
        conflicts_detected: 0,
        last_sync: new Date(),
        error: 'Sync already in progress',
      };
    }

    this.syncInProgress = true;
    console.log('[Email] Starting sync');

    try {
      let totalEmails = 0;
      let totalSignals = 0;

      for (const account of this.syncConfig.accounts) {
        if (!account.connected) continue;

        const emails = await this.fetchEmails(account.provider, {
          after: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
        });
        totalEmails += emails.length;
        this.emails.push(...emails);

        if (this.syncConfig.autoCreateSignals) {
          const signals = emails
            .filter(e => this.syncConfig.signalKeywords.some(k =>
              `${e.subject} ${e.snippet}`.toLowerCase().includes(k.toLowerCase())
            ))
            .map(e => this.emailToSignal(e));
          totalSignals += signals.length;
        }

        // Update account last sync
        account.lastSync = new Date();
      }

      await SecureStore.setItemAsync(STORAGE_KEYS.LAST_SYNC, new Date().toISOString());
      await this.saveConfig();

      return {
        success: true,
        events_fetched: totalEmails,
        events_created: totalSignals,
        conflicts_detected: 0,
        last_sync: new Date(),
      };
    } catch (error) {
      console.error('[Email] Sync failed:', error);
      return {
        success: false,
        events_fetched: 0,
        events_created: 0,
        conflicts_detected: 0,
        last_sync: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    } finally {
      this.syncInProgress = false;
    }
  }

  // --------------------------------------------------------------------------
  // Getters
  // --------------------------------------------------------------------------

  getStatus(provider: EmailProvider): IntegrationStatus {
    return this.status.get(provider) || 'disconnected';
  }

  getAccounts(): EmailAccount[] {
    return this.syncConfig.accounts;
  }

  getEmails(): EmailMessage[] {
    return this.emails;
  }

  getActionItems(): ActionItem[] {
    return this.actionItems;
  }

  getSyncConfig(): EmailSyncConfig {
    return this.syncConfig;
  }

  getConfig(provider: EmailProvider): IntegrationConfig {
    return provider === 'gmail' ? GMAIL_CONFIG : OUTLOOK_CONFIG;
  }

  isConnected(provider: EmailProvider): boolean {
    return this.status.get(provider) === 'connected';
  }

  async getLastSyncTime(): Promise<Date | null> {
    const lastSync = await SecureStore.getItemAsync(STORAGE_KEYS.LAST_SYNC);
    return lastSync ? new Date(lastSync) : null;
  }
}

// ============================================================================
// SINGLETON & EXPORTS
// ============================================================================

export const emailService = new EmailService();

export {
  EmailService,
  GMAIL_CONFIG,
  OUTLOOK_CONFIG,
  STORAGE_KEYS as EMAIL_STORAGE_KEYS,
};

export default emailService;
