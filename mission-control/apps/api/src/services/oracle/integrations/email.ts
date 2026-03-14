/**
 * Email NLP Processing Service for ORACLE v2.0
 *
 * Provides Gmail API OAuth or IMAP connection, NLP action item extraction
 * using patterns and keywords, deadline detection, sentiment analysis,
 * auto-categorization, and signal creation from important emails.
 *
 * @module services/oracle/integrations/email
 */

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * OAuth tokens for Gmail API
 */
export interface GmailOAuthTokens {
  access_token: string;
  refresh_token: string;
  expiry_date: number;
  token_type: string;
  scope: string;
}

/**
 * IMAP connection configuration
 */
export interface IMAPConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
}

/**
 * Raw email message
 */
export interface RawEmail {
  id: string;
  threadId: string;
  from: string;
  to: string[];
  cc?: string[];
  subject: string;
  body: string;
  bodyHtml?: string;
  date: Date;
  labels?: string[];
  attachments?: Array<{
    filename: string;
    mimeType: string;
    size: number;
  }>;
  inReplyTo?: string;
  references?: string[];
}

/**
 * Parsed email with NLP analysis
 */
export interface ParsedEmail {
  id: string;
  threadId: string;
  from: EmailContact;
  to: EmailContact[];
  cc: EmailContact[];
  subject: string;
  body: string;
  date: Date;
  category: EmailCategory;
  sentiment: SentimentResult;
  actionItems: ActionItem[];
  deadlines: DetectedDeadline[];
  importance: 'high' | 'medium' | 'low';
  requiresResponse: boolean;
  suggestedLabels: string[];
}

/**
 * Email contact
 */
export interface EmailContact {
  name: string | null;
  email: string;
}

/**
 * Email category
 */
export type EmailCategory =
  | 'meeting_request'
  | 'action_item'
  | 'fyi'
  | 'question'
  | 'update'
  | 'approval_request'
  | 'feedback_request'
  | 'urgent'
  | 'newsletter'
  | 'automated'
  | 'personal'
  | 'unknown';

/**
 * Sentiment analysis result
 */
export interface SentimentResult {
  score: number; // -1 to 1
  label: 'positive' | 'negative' | 'neutral';
  confidence: number; // 0 to 1
  keywords: {
    positive: string[];
    negative: string[];
  };
}

/**
 * Detected action item from email
 */
export interface ActionItem {
  id: string;
  text: string;
  type: 'task' | 'decision' | 'follow_up' | 'review' | 'respond' | 'schedule';
  confidence: number; // 0 to 1
  owner: string | null; // Detected assignee
  deadline: DetectedDeadline | null;
  priority: 'high' | 'medium' | 'low';
  source: {
    email_id: string;
    offset: number;
    length: number;
  };
}

/**
 * Detected deadline
 */
export interface DetectedDeadline {
  text: string;
  date: Date | null;
  isRelative: boolean;
  urgency: 'asap' | 'today' | 'this_week' | 'next_week' | 'this_month' | 'future';
  confidence: number;
}

/**
 * ORACLE signal from email
 */
export interface EmailSignal {
  id: string;
  source: 'email';
  type: 'action_item' | 'meeting_request' | 'deadline' | 'decision' | 'urgent';
  urgency: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  metadata: {
    email_id: string;
    thread_id: string;
    from: string;
    subject: string;
    date: string;
    category: EmailCategory;
    sentiment: 'positive' | 'negative' | 'neutral';
    action_items_count: number;
    deadlines: string[];
    requires_response: boolean;
  };
}

// ============================================================================
// NLP Pattern Definitions
// ============================================================================

/**
 * Action item detection patterns
 */
const ACTION_PATTERNS: Array<{
  pattern: RegExp;
  type: ActionItem['type'];
  priority: ActionItem['priority'];
}> = [
  // Direct requests
  { pattern: /please\s+(.*?)(?:[.!?\n]|$)/gi, type: 'task', priority: 'medium' },
  { pattern: /can you\s+(.*?)(?:[.!?\n]|$)/gi, type: 'task', priority: 'medium' },
  { pattern: /could you\s+(.*?)(?:[.!?\n]|$)/gi, type: 'task', priority: 'medium' },
  { pattern: /would you\s+(.*?)(?:[.!?\n]|$)/gi, type: 'task', priority: 'low' },
  { pattern: /I need you to\s+(.*?)(?:[.!?\n]|$)/gi, type: 'task', priority: 'high' },
  { pattern: /you need to\s+(.*?)(?:[.!?\n]|$)/gi, type: 'task', priority: 'high' },
  { pattern: /make sure (?:to\s+)?(.*?)(?:[.!?\n]|$)/gi, type: 'task', priority: 'high' },

  // Review/feedback requests
  { pattern: /please review\s+(.*?)(?:[.!?\n]|$)/gi, type: 'review', priority: 'medium' },
  { pattern: /review (?:the |this )?(.*?)(?:[.!?\n]|$)/gi, type: 'review', priority: 'medium' },
  { pattern: /take a look at\s+(.*?)(?:[.!?\n]|$)/gi, type: 'review', priority: 'low' },
  { pattern: /feedback (?:on|for)\s+(.*?)(?:[.!?\n]|$)/gi, type: 'review', priority: 'medium' },

  // Decision requests
  { pattern: /decide (?:on|if|whether)\s+(.*?)(?:[.!?\n]|$)/gi, type: 'decision', priority: 'high' },
  { pattern: /need (?:your |a )?decision (?:on|about|regarding)\s+(.*?)(?:[.!?\n]|$)/gi, type: 'decision', priority: 'high' },
  { pattern: /approve\s+(.*?)(?:[.!?\n]|$)/gi, type: 'decision', priority: 'high' },

  // Response requests
  { pattern: /let me know\s+(.*?)(?:[.!?\n]|$)/gi, type: 'respond', priority: 'medium' },
  { pattern: /get back to (?:me|us)\s+(.*?)(?:[.!?\n]|$)/gi, type: 'respond', priority: 'medium' },
  { pattern: /respond (?:to|with)\s+(.*?)(?:[.!?\n]|$)/gi, type: 'respond', priority: 'medium' },
  { pattern: /reply (?:to |with )?(.*?)(?:[.!?\n]|$)/gi, type: 'respond', priority: 'medium' },

  // Follow-up
  { pattern: /follow(?:-|\s)?up (?:on|with|about)\s+(.*?)(?:[.!?\n]|$)/gi, type: 'follow_up', priority: 'medium' },
  { pattern: /circle back (?:on|to)\s+(.*?)(?:[.!?\n]|$)/gi, type: 'follow_up', priority: 'low' },

  // Scheduling
  { pattern: /schedule\s+(.*?)(?:[.!?\n]|$)/gi, type: 'schedule', priority: 'medium' },
  { pattern: /set up (?:a |the )?(meeting|call|sync)\s*(.*?)(?:[.!?\n]|$)/gi, type: 'schedule', priority: 'medium' },
  { pattern: /book\s+(.*?)(?:[.!?\n]|$)/gi, type: 'schedule', priority: 'medium' },
];

/**
 * Deadline detection patterns
 */
const DEADLINE_PATTERNS: Array<{
  pattern: RegExp;
  urgency: DetectedDeadline['urgency'];
  extractDate: (match: RegExpMatchArray) => Date | null;
}> = [
  // ASAP patterns
  {
    pattern: /\b(asap|as soon as possible|immediately|right away|urgent(?:ly)?)\b/gi,
    urgency: 'asap',
    extractDate: () => new Date(),
  },
  // Today patterns
  {
    pattern: /\b(today|by (?:end of|eod|close of business))\b/gi,
    urgency: 'today',
    extractDate: () => {
      const today = new Date();
      today.setHours(17, 0, 0, 0);
      return today;
    },
  },
  // Tomorrow patterns
  {
    pattern: /\b(tomorrow|by tomorrow)\b/gi,
    urgency: 'this_week',
    extractDate: () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(17, 0, 0, 0);
      return tomorrow;
    },
  },
  // This week patterns
  {
    pattern: /\b(this week|by (?:end of |eow|friday))\b/gi,
    urgency: 'this_week',
    extractDate: () => {
      const friday = new Date();
      const daysUntilFriday = (5 - friday.getDay() + 7) % 7 || 7;
      friday.setDate(friday.getDate() + daysUntilFriday);
      friday.setHours(17, 0, 0, 0);
      return friday;
    },
  },
  // Next week patterns
  {
    pattern: /\b(next week|by next (?:monday|tuesday|wednesday|thursday|friday))\b/gi,
    urgency: 'next_week',
    extractDate: (match) => {
      const dayMap: Record<string, number> = {
        monday: 1,
        tuesday: 2,
        wednesday: 3,
        thursday: 4,
        friday: 5,
      };
      const text = match[0].toLowerCase();
      const dayMatch = text.match(/(monday|tuesday|wednesday|thursday|friday)/);
      const targetDay = dayMatch ? dayMap[dayMatch[1]] : 1;

      const nextWeek = new Date();
      const currentDay = nextWeek.getDay();
      const daysUntilTarget = ((targetDay - currentDay + 7) % 7) + 7;
      nextWeek.setDate(nextWeek.getDate() + daysUntilTarget);
      nextWeek.setHours(17, 0, 0, 0);
      return nextWeek;
    },
  },
  // Specific day patterns
  {
    pattern: /\bby (monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi,
    urgency: 'this_week',
    extractDate: (match) => {
      const dayMap: Record<string, number> = {
        sunday: 0,
        monday: 1,
        tuesday: 2,
        wednesday: 3,
        thursday: 4,
        friday: 5,
        saturday: 6,
      };
      const targetDay = dayMap[match[1].toLowerCase()];
      const date = new Date();
      const currentDay = date.getDay();
      let daysUntil = targetDay - currentDay;
      if (daysUntil <= 0) daysUntil += 7;
      date.setDate(date.getDate() + daysUntil);
      date.setHours(17, 0, 0, 0);
      return date;
    },
  },
  // Specific date patterns (MM/DD, MM-DD, Month DD)
  {
    pattern: /\bby\s+(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/gi,
    urgency: 'future',
    extractDate: (match) => {
      const month = parseInt(match[1], 10) - 1;
      const day = parseInt(match[2], 10);
      const year = match[3] ? parseInt(match[3], 10) : new Date().getFullYear();
      const fullYear = year < 100 ? 2000 + year : year;
      return new Date(fullYear, month, day, 17, 0, 0);
    },
  },
  // Month name patterns
  {
    pattern: /\bby\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(\d{4}))?\b/gi,
    urgency: 'future',
    extractDate: (match) => {
      const monthMap: Record<string, number> = {
        january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
        july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
      };
      const month = monthMap[match[1].toLowerCase()];
      const day = parseInt(match[2], 10);
      const year = match[3] ? parseInt(match[3], 10) : new Date().getFullYear();
      return new Date(year, month, day, 17, 0, 0);
    },
  },
];

/**
 * Email category patterns
 */
const CATEGORY_PATTERNS: Array<{
  pattern: RegExp;
  category: EmailCategory;
  weight: number;
}> = [
  // Meeting requests
  { pattern: /meeting (?:request|invite|invitation)/gi, category: 'meeting_request', weight: 1.0 },
  { pattern: /invite you to/gi, category: 'meeting_request', weight: 0.8 },
  { pattern: /schedule (?:a |the )?(?:meeting|call|sync)/gi, category: 'meeting_request', weight: 0.9 },
  { pattern: /calendar invite/gi, category: 'meeting_request', weight: 1.0 },

  // Approval requests
  { pattern: /need(?:s)? (?:your )?approval/gi, category: 'approval_request', weight: 1.0 },
  { pattern: /please approve/gi, category: 'approval_request', weight: 1.0 },
  { pattern: /awaiting (?:your )?approval/gi, category: 'approval_request', weight: 0.9 },
  { pattern: /sign off on/gi, category: 'approval_request', weight: 0.8 },

  // Action items
  { pattern: /action (?:item|required)/gi, category: 'action_item', weight: 1.0 },
  { pattern: /todo|to-do|to do/gi, category: 'action_item', weight: 0.8 },
  { pattern: /task(?:s)? for you/gi, category: 'action_item', weight: 0.9 },

  // Questions
  { pattern: /\?{1,}/g, category: 'question', weight: 0.5 },
  { pattern: /what do you think/gi, category: 'question', weight: 0.8 },
  { pattern: /your (?:thoughts|opinion|input)/gi, category: 'question', weight: 0.7 },

  // Updates/FYI
  { pattern: /\bfyi\b/gi, category: 'fyi', weight: 1.0 },
  { pattern: /for your (?:information|reference|records)/gi, category: 'fyi', weight: 1.0 },
  { pattern: /just (?:a )?(?:quick )?update/gi, category: 'update', weight: 0.9 },
  { pattern: /status update/gi, category: 'update', weight: 1.0 },
  { pattern: /progress report/gi, category: 'update', weight: 0.9 },

  // Feedback requests
  { pattern: /feedback (?:on|for|about)/gi, category: 'feedback_request', weight: 0.9 },
  { pattern: /please review/gi, category: 'feedback_request', weight: 0.8 },
  { pattern: /your review/gi, category: 'feedback_request', weight: 0.7 },

  // Urgent
  { pattern: /\burgent\b/gi, category: 'urgent', weight: 1.0 },
  { pattern: /\basap\b/gi, category: 'urgent', weight: 0.9 },
  { pattern: /immediately/gi, category: 'urgent', weight: 0.8 },
  { pattern: /time[- ]sensitive/gi, category: 'urgent', weight: 0.9 },

  // Newsletters
  { pattern: /unsubscribe/gi, category: 'newsletter', weight: 1.0 },
  { pattern: /newsletter/gi, category: 'newsletter', weight: 1.0 },
  { pattern: /weekly (?:digest|roundup)/gi, category: 'newsletter', weight: 0.9 },

  // Automated
  { pattern: /do[- ]not[- ]reply/gi, category: 'automated', weight: 1.0 },
  { pattern: /automated (?:message|notification)/gi, category: 'automated', weight: 1.0 },
  { pattern: /noreply/gi, category: 'automated', weight: 1.0 },
];

/**
 * Sentiment keywords
 */
const SENTIMENT_KEYWORDS = {
  positive: [
    'thank', 'thanks', 'appreciate', 'grateful', 'great', 'excellent',
    'wonderful', 'fantastic', 'amazing', 'awesome', 'good', 'pleased',
    'happy', 'excited', 'looking forward', 'congratulations', 'well done',
    'perfect', 'love', 'brilliant', 'outstanding', 'impressive',
  ],
  negative: [
    'urgent', 'asap', 'immediately', 'disappointed', 'concerned', 'worried',
    'issue', 'problem', 'error', 'bug', 'broken', 'failed', 'missing',
    'overdue', 'late', 'delay', 'blocked', 'critical', 'severe',
    'unfortunately', 'sorry', 'apologies', 'regret', 'complaint',
  ],
};

// ============================================================================
// Email NLP Service Class
// ============================================================================

/**
 * EmailNLPService - Email processing with NLP analysis
 *
 * Features:
 * - Gmail API OAuth or IMAP connection
 * - NLP action item extraction using patterns and keywords
 * - Deadline detection (dates, "by Friday", "ASAP")
 * - Sentiment analysis (positive/negative/neutral)
 * - Auto-categorization (meeting request, action item, FYI)
 * - Signal creation from important emails
 *
 * Time Complexity:
 * - Email parsing: O(n) where n = email body length
 * - Action item detection: O(n * m) where m = pattern count
 * - Sentiment analysis: O(n * k) where k = keyword count
 */
export class EmailNLPService {
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;
  private tokens: GmailOAuthTokens | null = null;
  private imapConfig: IMAPConfig | null = null;
  private baseUrl = 'https://www.googleapis.com/gmail/v1';

  /**
   * Initialize Email NLP service
   *
   * @param clientId - OAuth client ID
   * @param clientSecret - OAuth client secret
   * @param redirectUri - OAuth redirect URI
   */
  constructor(
    clientId: string,
    clientSecret: string,
    redirectUri: string
  ) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.redirectUri = redirectUri;
  }

  // ==========================================================================
  // OAuth Methods
  // ==========================================================================

  /**
   * Generate OAuth authorization URL for Gmail
   *
   * @param state - State parameter for CSRF protection
   * @returns Authorization URL
   */
  generateAuthUrl(state: string): string {
    const scopes = [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/gmail.labels',
    ].join(' ');

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: scopes,
      access_type: 'offline',
      prompt: 'consent',
      state,
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   *
   * @param code - Authorization code
   * @returns OAuth tokens
   */
  async exchangeCodeForTokens(code: string): Promise<GmailOAuthTokens> {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: this.redirectUri,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OAuth token exchange failed: ${error}`);
    }

    const data: any = await response.json();

    const tokens: GmailOAuthTokens = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expiry_date: Date.now() + data.expires_in * 1000,
      token_type: data.token_type,
      scope: data.scope,
    };

    this.tokens = tokens;
    return tokens;
  }

  /**
   * Set tokens from stored data
   */
  setTokens(tokens: GmailOAuthTokens): void {
    this.tokens = tokens;
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(): Promise<GmailOAuthTokens> {
    if (!this.tokens?.refresh_token) {
      throw new Error('No refresh token available');
    }

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: this.tokens.refresh_token,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token refresh failed: ${error}`);
    }

    const data: any = await response.json();

    const tokens: GmailOAuthTokens = {
      access_token: data.access_token,
      refresh_token: this.tokens.refresh_token,
      expiry_date: Date.now() + data.expires_in * 1000,
      token_type: data.token_type,
      scope: data.scope,
    };

    this.tokens = tokens;
    return tokens;
  }

  /**
   * Ensure valid token
   */
  private async ensureValidToken(): Promise<void> {
    if (!this.tokens) {
      throw new Error('Not authenticated. Call setTokens() first.');
    }

    if (this.tokens.expiry_date - Date.now() < 5 * 60 * 1000) {
      await this.refreshAccessToken();
    }
  }

  // ==========================================================================
  // IMAP Configuration
  // ==========================================================================

  /**
   * Configure IMAP connection
   */
  setIMAPConfig(config: IMAPConfig): void {
    this.imapConfig = config;
  }

  // ==========================================================================
  // Gmail API Methods
  // ==========================================================================

  /**
   * Make Gmail API request
   */
  private async gmailRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    await this.ensureValidToken();

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.tokens!.access_token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gmail API error: ${response.status} - ${error}`);
    }

    return response.json() as Promise<T>;
  }

  /**
   * List messages from Gmail
   */
  async listMessages(options: {
    query?: string;
    labelIds?: string[];
    maxResults?: number;
    pageToken?: string;
  } = {}): Promise<{
    messages: Array<{ id: string; threadId: string }>;
    nextPageToken?: string;
    resultSizeEstimate: number;
  }> {
    const params = new URLSearchParams();

    if (options.query) params.set('q', options.query);
    if (options.labelIds?.length) params.set('labelIds', options.labelIds.join(','));
    if (options.maxResults) params.set('maxResults', options.maxResults.toString());
    if (options.pageToken) params.set('pageToken', options.pageToken);

    const queryString = params.toString();
    const endpoint = `/users/me/messages${queryString ? `?${queryString}` : ''}`;

    return this.gmailRequest(endpoint);
  }

  /**
   * Get a specific message
   */
  async getMessage(messageId: string, format: 'full' | 'metadata' | 'minimal' = 'full'): Promise<{
    id: string;
    threadId: string;
    labelIds: string[];
    snippet: string;
    payload: {
      headers: Array<{ name: string; value: string }>;
      body?: { data?: string };
      parts?: Array<{
        mimeType: string;
        body?: { data?: string };
        parts?: Array<{ mimeType: string; body?: { data?: string } }>;
      }>;
    };
    internalDate: string;
  }> {
    return this.gmailRequest(`/users/me/messages/${messageId}?format=${format}`);
  }

  /**
   * Parse Gmail message to RawEmail
   */
  parseGmailMessage(message: Awaited<ReturnType<typeof this.getMessage>>): RawEmail {
    const headers = message.payload.headers;
    const getHeader = (name: string): string => {
      const header = headers.find((h) => h.name.toLowerCase() === name.toLowerCase());
      return header?.value || '';
    };

    // Extract body
    let body = '';
    let bodyHtml = '';

    const extractBody = (payload: typeof message.payload): void => {
      if (payload.body?.data) {
        const decoded = Buffer.from(payload.body.data, 'base64').toString('utf-8');
        if (payload.parts?.some((p) => p.mimeType === 'text/html')) {
          bodyHtml = decoded;
        } else {
          body = decoded;
        }
      }

      if (payload.parts) {
        for (const part of payload.parts) {
          if (part.mimeType === 'text/plain' && part.body?.data) {
            body = Buffer.from(part.body.data, 'base64').toString('utf-8');
          }
          if (part.mimeType === 'text/html' && part.body?.data) {
            bodyHtml = Buffer.from(part.body.data, 'base64').toString('utf-8');
          }
          if (part.parts) {
            for (const subPart of part.parts) {
              if (subPart.mimeType === 'text/plain' && subPart.body?.data) {
                body = Buffer.from(subPart.body.data, 'base64').toString('utf-8');
              }
            }
          }
        }
      }
    };

    extractBody(message.payload);

    // Parse email addresses
    const parseAddresses = (value: string): string[] => {
      return value.split(',').map((addr) => addr.trim()).filter(Boolean);
    };

    return {
      id: message.id,
      threadId: message.threadId,
      from: getHeader('From'),
      to: parseAddresses(getHeader('To')),
      cc: parseAddresses(getHeader('Cc')) || undefined,
      subject: getHeader('Subject'),
      body: body || this.stripHtml(bodyHtml),
      bodyHtml: bodyHtml || undefined,
      date: new Date(parseInt(message.internalDate, 10)),
      labels: message.labelIds,
      inReplyTo: getHeader('In-Reply-To') || undefined,
      references: getHeader('References')?.split(' ').filter(Boolean) || undefined,
    };
  }

  /**
   * Strip HTML tags from text
   */
  private stripHtml(html: string): string {
    return html
      .replace(/<style[^>]*>.*?<\/style>/gis, '')
      .replace(/<script[^>]*>.*?<\/script>/gis, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // ==========================================================================
  // NLP Analysis Methods
  // ==========================================================================

  /**
   * Parse email contact from string
   */
  parseContact(contactString: string): EmailContact {
    // Match: "Name <email@example.com>" or just "email@example.com"
    const match = contactString.match(/(?:"?([^"<]+)"?\s*)?<?([^\s<>]+@[^\s<>]+)>?/);

    if (match) {
      return {
        name: match[1]?.trim() || null,
        email: match[2],
      };
    }

    return {
      name: null,
      email: contactString.trim(),
    };
  }

  /**
   * Detect action items in text
   *
   * Time Complexity: O(n * m) where n = text length, m = pattern count
   */
  detectActionItems(text: string, emailId: string): ActionItem[] {
    const actionItems: ActionItem[] = [];
    let itemId = 0;

    for (const { pattern, type, priority } of ACTION_PATTERNS) {
      let match: RegExpExecArray | null;
      pattern.lastIndex = 0;

      while ((match = pattern.exec(text)) !== null) {
        const actionText = match[1]?.trim() || match[0].trim();

        // Skip very short or very long matches
        if (actionText.length < 5 || actionText.length > 500) continue;

        // Check for duplicates
        const isDuplicate = actionItems.some(
          (item) => item.text.toLowerCase() === actionText.toLowerCase()
        );
        if (isDuplicate) continue;

        // Detect owner from context
        const owner = this.detectOwner(text, match.index);

        // Detect deadline from context
        const contextStart = Math.max(0, match.index - 100);
        const contextEnd = Math.min(text.length, match.index + match[0].length + 100);
        const context = text.substring(contextStart, contextEnd);
        const deadlines = this.detectDeadlines(context);
        const deadline = deadlines.length > 0 ? deadlines[0] : null;

        // Adjust priority based on deadline urgency
        let adjustedPriority = priority;
        if (deadline) {
          if (deadline.urgency === 'asap' || deadline.urgency === 'today') {
            adjustedPriority = 'high';
          }
        }

        actionItems.push({
          id: `action-${emailId}-${itemId++}`,
          text: actionText,
          type,
          confidence: 0.7,
          owner,
          deadline,
          priority: adjustedPriority,
          source: {
            email_id: emailId,
            offset: match.index,
            length: match[0].length,
          },
        });
      }
    }

    return actionItems;
  }

  /**
   * Detect owner from context
   */
  private detectOwner(text: string, matchIndex: number): string | null {
    // Look for names/mentions near the action
    const contextStart = Math.max(0, matchIndex - 50);
    const context = text.substring(contextStart, matchIndex);

    // Look for @mentions
    const mentionMatch = context.match(/@(\w+)/);
    if (mentionMatch) {
      return mentionMatch[1];
    }

    // Look for "you" which implies the recipient
    if (/\byou\b/i.test(context)) {
      return 'recipient';
    }

    return null;
  }

  /**
   * Detect deadlines in text
   *
   * Time Complexity: O(n * p) where n = text length, p = pattern count
   */
  detectDeadlines(text: string): DetectedDeadline[] {
    const deadlines: DetectedDeadline[] = [];

    for (const { pattern, urgency, extractDate } of DEADLINE_PATTERNS) {
      let match: RegExpExecArray | null;
      pattern.lastIndex = 0;

      while ((match = pattern.exec(text)) !== null) {
        const date = extractDate(match);

        deadlines.push({
          text: match[0],
          date,
          isRelative: urgency !== 'future',
          urgency,
          confidence: 0.8,
        });
      }
    }

    // Sort by urgency
    const urgencyOrder: Record<DetectedDeadline['urgency'], number> = {
      asap: 0,
      today: 1,
      this_week: 2,
      next_week: 3,
      this_month: 4,
      future: 5,
    };

    deadlines.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);

    return deadlines;
  }

  /**
   * Analyze sentiment of text
   *
   * Time Complexity: O(n * k) where n = words, k = keywords
   */
  analyzeSentiment(text: string): SentimentResult {
    const words = text.toLowerCase().split(/\s+/);
    const foundPositive: string[] = [];
    const foundNegative: string[] = [];

    for (const word of words) {
      for (const keyword of SENTIMENT_KEYWORDS.positive) {
        if (word.includes(keyword.toLowerCase())) {
          foundPositive.push(keyword);
        }
      }
      for (const keyword of SENTIMENT_KEYWORDS.negative) {
        if (word.includes(keyword.toLowerCase())) {
          foundNegative.push(keyword);
        }
      }
    }

    const positiveScore = foundPositive.length;
    const negativeScore = foundNegative.length * 1.5; // Weight negative higher
    const totalScore = positiveScore + negativeScore;

    let score = 0;
    let confidence = 0;

    if (totalScore > 0) {
      score = (positiveScore - negativeScore) / totalScore;
      confidence = Math.min(1, totalScore / 10);
    }

    let label: SentimentResult['label'];
    if (score > 0.2) {
      label = 'positive';
    } else if (score < -0.2) {
      label = 'negative';
    } else {
      label = 'neutral';
    }

    return {
      score,
      label,
      confidence,
      keywords: {
        positive: [...new Set(foundPositive)],
        negative: [...new Set(foundNegative)],
      },
    };
  }

  /**
   * Categorize email
   *
   * Time Complexity: O(n * p) where n = text length, p = pattern count
   */
  categorizeEmail(subject: string, body: string): EmailCategory {
    const text = `${subject}\n${body}`;
    const categoryScores = new Map<EmailCategory, number>();

    for (const { pattern, category, weight } of CATEGORY_PATTERNS) {
      let match: RegExpExecArray | null;
      pattern.lastIndex = 0;

      let matchCount = 0;
      while ((match = pattern.exec(text)) !== null) {
        matchCount++;
      }

      if (matchCount > 0) {
        const currentScore = categoryScores.get(category) || 0;
        categoryScores.set(category, currentScore + matchCount * weight);
      }
    }

    // Find highest scoring category
    let topCategory: EmailCategory = 'unknown';
    let topScore = 0;

    for (const [category, score] of categoryScores) {
      if (score > topScore) {
        topScore = score;
        topCategory = category;
      }
    }

    return topCategory;
  }

  /**
   * Determine if email requires a response
   */
  requiresResponse(text: string, category: EmailCategory): boolean {
    // Categories that typically require response
    const responseCategories: EmailCategory[] = [
      'question',
      'approval_request',
      'feedback_request',
      'meeting_request',
      'action_item',
      'urgent',
    ];

    if (responseCategories.includes(category)) {
      return true;
    }

    // Check for question marks
    const questionCount = (text.match(/\?/g) || []).length;
    if (questionCount >= 2) {
      return true;
    }

    // Check for response-requesting phrases
    const responsePatterns = [
      /let me know/gi,
      /get back to/gi,
      /your thoughts/gi,
      /your opinion/gi,
      /please (?:reply|respond)/gi,
      /awaiting your/gi,
    ];

    for (const pattern of responsePatterns) {
      if (pattern.test(text)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Determine email importance
   */
  determineImportance(
    email: RawEmail,
    category: EmailCategory,
    sentiment: SentimentResult,
    actionItems: ActionItem[],
    deadlines: DetectedDeadline[]
  ): 'high' | 'medium' | 'low' {
    let score = 0;

    // Category-based importance
    const categoryImportance: Record<EmailCategory, number> = {
      urgent: 10,
      approval_request: 8,
      action_item: 7,
      meeting_request: 6,
      question: 5,
      feedback_request: 5,
      update: 3,
      fyi: 2,
      personal: 4,
      newsletter: 1,
      automated: 1,
      unknown: 3,
    };
    score += categoryImportance[category];

    // Action items
    score += Math.min(actionItems.length * 2, 6);

    // Urgent deadlines
    for (const deadline of deadlines) {
      if (deadline.urgency === 'asap' || deadline.urgency === 'today') {
        score += 5;
      } else if (deadline.urgency === 'this_week') {
        score += 3;
      }
    }

    // Negative sentiment
    if (sentiment.label === 'negative') {
      score += 3;
    }

    // Direct recipient (not CC)
    if (email.to.length <= 2) {
      score += 2;
    }

    // Determine importance level
    if (score >= 15) return 'high';
    if (score >= 8) return 'medium';
    return 'low';
  }

  /**
   * Suggest labels for email
   */
  suggestLabels(
    category: EmailCategory,
    actionItems: ActionItem[],
    deadlines: DetectedDeadline[],
    sentiment: SentimentResult
  ): string[] {
    const labels: string[] = [];

    // Category label
    labels.push(`category/${category.replace('_', '-')}`);

    // Action required
    if (actionItems.length > 0) {
      labels.push('action-required');
    }

    // Urgent
    const hasUrgentDeadline = deadlines.some(
      (d) => d.urgency === 'asap' || d.urgency === 'today'
    );
    if (hasUrgentDeadline || category === 'urgent') {
      labels.push('urgent');
    }

    // Sentiment
    if (sentiment.label !== 'neutral' && sentiment.confidence > 0.5) {
      labels.push(`sentiment/${sentiment.label}`);
    }

    return labels;
  }

  // ==========================================================================
  // Full Email Processing
  // ==========================================================================

  /**
   * Fully parse and analyze an email
   */
  parseEmail(rawEmail: RawEmail): ParsedEmail {
    const text = `${rawEmail.subject}\n${rawEmail.body}`;

    // Parse contacts
    const from = this.parseContact(rawEmail.from);
    const to = rawEmail.to.map((addr) => this.parseContact(addr));
    const cc = rawEmail.cc?.map((addr) => this.parseContact(addr)) || [];

    // NLP analysis
    const category = this.categorizeEmail(rawEmail.subject, rawEmail.body);
    const sentiment = this.analyzeSentiment(text);
    const actionItems = this.detectActionItems(text, rawEmail.id);
    const deadlines = this.detectDeadlines(text);
    const importance = this.determineImportance(rawEmail, category, sentiment, actionItems, deadlines);
    const requiresResponse = this.requiresResponse(text, category);
    const suggestedLabels = this.suggestLabels(category, actionItems, deadlines, sentiment);

    return {
      id: rawEmail.id,
      threadId: rawEmail.threadId,
      from,
      to,
      cc,
      subject: rawEmail.subject,
      body: rawEmail.body,
      date: rawEmail.date,
      category,
      sentiment,
      actionItems,
      deadlines,
      importance,
      requiresResponse,
      suggestedLabels,
    };
  }

  // ==========================================================================
  // Signal Creation
  // ==========================================================================

  /**
   * Convert parsed email to ORACLE signals
   */
  emailToSignals(email: ParsedEmail): EmailSignal[] {
    const signals: EmailSignal[] = [];

    // Map importance to urgency
    const importanceToUrgency: Record<string, EmailSignal['urgency']> = {
      high: 'high',
      medium: 'medium',
      low: 'low',
    };

    // If email has urgent deadline, override urgency
    const hasAsapDeadline = email.deadlines.some((d) => d.urgency === 'asap');
    const hasTodayDeadline = email.deadlines.some((d) => d.urgency === 'today');

    let urgency = importanceToUrgency[email.importance];
    if (hasAsapDeadline) urgency = 'critical';
    else if (hasTodayDeadline) urgency = 'high';

    // Create main email signal
    if (email.importance !== 'low' || email.actionItems.length > 0) {
      let type: EmailSignal['type'] = 'action_item';

      if (email.category === 'meeting_request') {
        type = 'meeting_request';
      } else if (email.category === 'urgent') {
        type = 'urgent';
      } else if (email.category === 'approval_request') {
        type = 'decision';
      } else if (email.deadlines.length > 0) {
        type = 'deadline';
      }

      signals.push({
        id: `email-${email.id}`,
        source: 'email',
        type,
        urgency,
        title: email.subject,
        description: email.body.substring(0, 500) + (email.body.length > 500 ? '...' : ''),
        metadata: {
          email_id: email.id,
          thread_id: email.threadId,
          from: email.from.email,
          subject: email.subject,
          date: email.date.toISOString(),
          category: email.category,
          sentiment: email.sentiment.label,
          action_items_count: email.actionItems.length,
          deadlines: email.deadlines.map((d) => d.text),
          requires_response: email.requiresResponse,
        },
      });
    }

    // Create individual action item signals for high-priority items
    for (const item of email.actionItems.filter((i) => i.priority === 'high')) {
      signals.push({
        id: item.id,
        source: 'email',
        type: 'action_item',
        urgency: item.deadline?.urgency === 'asap' ? 'critical' : 'high',
        title: item.text,
        description: `From: ${email.from.email}\nSubject: ${email.subject}`,
        metadata: {
          email_id: email.id,
          thread_id: email.threadId,
          from: email.from.email,
          subject: email.subject,
          date: email.date.toISOString(),
          category: email.category,
          sentiment: email.sentiment.label,
          action_items_count: 1,
          deadlines: item.deadline ? [item.deadline.text] : [],
          requires_response: false,
        },
      });
    }

    return signals;
  }

  // ==========================================================================
  // High-Level Methods
  // ==========================================================================

  /**
   * Process new emails and create signals
   *
   * @param maxResults - Maximum emails to process
   * @param query - Gmail search query
   * @returns Created signals
   */
  async processNewEmails(
    maxResults: number = 20,
    query: string = 'is:unread -category:promotions -category:social'
  ): Promise<EmailSignal[]> {
    const messageList = await this.listMessages({ query, maxResults });

    const signals: EmailSignal[] = [];

    for (const msgRef of messageList.messages || []) {
      try {
        const message = await this.getMessage(msgRef.id);
        const rawEmail = this.parseGmailMessage(message);
        const parsedEmail = this.parseEmail(rawEmail);
        const emailSignals = this.emailToSignals(parsedEmail);
        signals.push(...emailSignals);
      } catch (error) {
        console.error(`Failed to process email ${msgRef.id}:`, error);
      }
    }

    return signals;
  }

  /**
   * Analyze a single email by ID
   */
  async analyzeEmail(messageId: string): Promise<ParsedEmail> {
    const message = await this.getMessage(messageId);
    const rawEmail = this.parseGmailMessage(message);
    return this.parseEmail(rawEmail);
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create an EmailNLPService instance
 *
 * @returns Configured service instance
 */
export function createEmailNLPService(): EmailNLPService {
  const clientId = process.env.GMAIL_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || '';
  const clientSecret = process.env.GMAIL_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || '';
  const redirectUri = process.env.GMAIL_REDIRECT_URI || 'http://localhost:3001/oauth/gmail/callback';

  return new EmailNLPService(clientId, clientSecret, redirectUri);
}

export default EmailNLPService;
