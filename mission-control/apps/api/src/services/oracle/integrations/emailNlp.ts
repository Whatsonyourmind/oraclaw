/**
 * Email NLP Integration Service for ORACLE v2.0
 *
 * Provides email parsing and extraction, intent classification, entity extraction,
 * sentiment analysis, action item detection, priority inference, thread summarization,
 * auto-response suggestions, and integration hooks for creating tasks from emails.
 *
 * @module services/oracle/integrations/emailNlp
 */

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Email intent classification types
 */
export type EmailIntent =
  | 'request'
  | 'question'
  | 'update'
  | 'urgent'
  | 'informational'
  | 'followup'
  | 'approval_request'
  | 'meeting_request'
  | 'feedback'
  | 'complaint'
  | 'thank_you'
  | 'introduction'
  | 'unknown';

/**
 * Sentiment analysis result
 */
export type Sentiment = 'positive' | 'negative' | 'neutral' | 'mixed';

/**
 * Email priority levels
 */
export type EmailPriority = 'critical' | 'high' | 'medium' | 'low';

/**
 * Parsed email structure
 */
export interface ParsedEmail {
  id: string;
  messageId: string;
  threadId?: string;
  from: EmailAddress;
  to: EmailAddress[];
  cc?: EmailAddress[];
  bcc?: EmailAddress[];
  replyTo?: EmailAddress;
  subject: string;
  body: {
    text: string;
    html?: string;
  };
  date: Date;
  headers: Record<string, string>;
  attachments?: EmailAttachment[];
  inReplyTo?: string;
  references?: string[];
}

/**
 * Email address with optional name
 */
export interface EmailAddress {
  email: string;
  name?: string;
}

/**
 * Email attachment metadata
 */
export interface EmailAttachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  contentId?: string;
}

/**
 * Email analysis result
 */
export interface EmailAnalysis {
  email: ParsedEmail;
  intent: IntentClassification;
  entities: ExtractedEntities;
  sentiment: SentimentAnalysis;
  actionItems: ActionItem[];
  priority: PriorityInference;
  summary: string;
  suggestedResponses: SuggestedResponse[];
  metadata: AnalysisMetadata;
}

/**
 * Intent classification result
 */
export interface IntentClassification {
  primary: EmailIntent;
  secondary?: EmailIntent;
  confidence: number;
  indicators: string[];
}

/**
 * Extracted entities from email
 */
export interface ExtractedEntities {
  people: PersonEntity[];
  dates: DateEntity[];
  projects: ProjectEntity[];
  deadlines: DeadlineEntity[];
  organizations: OrganizationEntity[];
  locations: LocationEntity[];
  amounts: AmountEntity[];
  urls: UrlEntity[];
  phoneNumbers: PhoneEntity[];
  references: ReferenceEntity[];
}

/**
 * Person entity
 */
export interface PersonEntity {
  name: string;
  email?: string;
  role?: string;
  mentions: number;
  context: string;
}

/**
 * Date entity
 */
export interface DateEntity {
  text: string;
  parsed: Date | null;
  type: 'absolute' | 'relative' | 'recurring';
  context: string;
  isDeadline: boolean;
}

/**
 * Project entity
 */
export interface ProjectEntity {
  name: string;
  identifier?: string;
  confidence: number;
  context: string;
}

/**
 * Deadline entity
 */
export interface DeadlineEntity {
  text: string;
  date: Date | null;
  urgency: 'critical' | 'high' | 'medium' | 'low';
  task: string;
  context: string;
}

/**
 * Organization entity
 */
export interface OrganizationEntity {
  name: string;
  type?: 'company' | 'department' | 'team' | 'other';
  confidence: number;
}

/**
 * Location entity
 */
export interface LocationEntity {
  text: string;
  type: 'address' | 'city' | 'country' | 'venue' | 'virtual';
}

/**
 * Amount entity (monetary or numeric)
 */
export interface AmountEntity {
  text: string;
  value: number;
  currency?: string;
  type: 'monetary' | 'quantity' | 'percentage' | 'duration';
}

/**
 * URL entity
 */
export interface UrlEntity {
  url: string;
  text?: string;
  type: 'link' | 'document' | 'image' | 'video' | 'other';
}

/**
 * Phone entity
 */
export interface PhoneEntity {
  number: string;
  formatted: string;
  type?: 'mobile' | 'office' | 'fax' | 'other';
}

/**
 * Reference entity (ticket numbers, IDs, etc.)
 */
export interface ReferenceEntity {
  text: string;
  type: 'ticket' | 'invoice' | 'order' | 'case' | 'other';
  identifier: string;
}

/**
 * Sentiment analysis result
 */
export interface SentimentAnalysis {
  overall: Sentiment;
  score: number; // -1 to 1
  confidence: number;
  aspects: Array<{
    aspect: string;
    sentiment: Sentiment;
    score: number;
  }>;
  emotions: Array<{
    emotion: string;
    intensity: number;
  }>;
}

/**
 * Action item detected in email
 */
export interface ActionItem {
  id: string;
  text: string;
  type: 'task' | 'request' | 'decision' | 'followup' | 'question';
  assignee?: string;
  dueDate?: Date;
  priority: EmailPriority;
  confidence: number;
  context: string;
  sourceSpan: {
    start: number;
    end: number;
  };
}

/**
 * Priority inference result
 */
export interface PriorityInference {
  level: EmailPriority;
  confidence: number;
  factors: PriorityFactor[];
  explanation: string;
}

/**
 * Factor contributing to priority
 */
export interface PriorityFactor {
  factor: string;
  weight: number;
  value: any;
  impact: 'increase' | 'decrease' | 'neutral';
}

/**
 * Suggested response
 */
export interface SuggestedResponse {
  id: string;
  type: 'acknowledge' | 'accept' | 'decline' | 'delegate' | 'request_info' | 'custom';
  subject?: string;
  body: string;
  tone: 'formal' | 'casual' | 'neutral';
  confidence: number;
  actionItems?: string[];
}

/**
 * Analysis metadata
 */
export interface AnalysisMetadata {
  analyzedAt: Date;
  processingTimeMs: number;
  modelVersion: string;
  warnings?: string[];
}

/**
 * Thread summary
 */
export interface ThreadSummary {
  threadId: string;
  subject: string;
  participants: EmailAddress[];
  emailCount: number;
  dateRange: {
    start: Date;
    end: Date;
  };
  summary: string;
  keyPoints: string[];
  decisions: string[];
  openItems: ActionItem[];
  sentiment: {
    trend: 'improving' | 'declining' | 'stable';
    overall: Sentiment;
  };
  topics: Array<{
    topic: string;
    relevance: number;
  }>;
}

/**
 * ORACLE task creation from email
 */
export interface EmailToTaskMapping {
  emailId: string;
  threadId?: string;
  oracleTaskId: string;
  createdAt: Date;
  actionItemIds: string[];
  syncStatus: 'synced' | 'pending' | 'error';
}

/**
 * ORACLE task input derived from email
 */
export interface EmailDerivedTask {
  title: string;
  description: string;
  priority: EmailPriority;
  dueDate?: Date;
  source: {
    type: 'email';
    emailId: string;
    threadId?: string;
    from: EmailAddress;
    subject: string;
  };
  actionItems: ActionItem[];
  relatedPeople: PersonEntity[];
  relatedProjects: ProjectEntity[];
}

/**
 * NLP configuration
 */
export interface NlpConfig {
  intentThreshold: number;
  entityConfidenceThreshold: number;
  actionItemConfidenceThreshold: number;
  maxSuggestedResponses: number;
  enableSentimentAnalysis: boolean;
  enableEntityExtraction: boolean;
  customPatterns?: CustomPattern[];
  projectKeywords?: string[];
  organizationKeywords?: string[];
}

/**
 * Custom pattern for entity extraction
 */
export interface CustomPattern {
  name: string;
  pattern: RegExp;
  type: 'project' | 'reference' | 'organization' | 'custom';
  transform?: (match: RegExpMatchArray) => any;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: NlpConfig = {
  intentThreshold: 0.6,
  entityConfidenceThreshold: 0.7,
  actionItemConfidenceThreshold: 0.65,
  maxSuggestedResponses: 3,
  enableSentimentAnalysis: true,
  enableEntityExtraction: true,
  projectKeywords: [],
  organizationKeywords: [],
};

// ============================================================================
// Intent Patterns
// ============================================================================

const INTENT_PATTERNS: Record<EmailIntent, RegExp[]> = {
  request: [
    /\b(can you|could you|please|would you|need you to|requesting|request for)\b/i,
    /\b(I('d| would) like|we('d| would) need)\b/i,
  ],
  question: [
    /\?$/m,
    /\b(what|when|where|who|why|how|which|can|could|would|is|are|do|does)\b.*\?/i,
    /\b(wondering|curious|question about)\b/i,
  ],
  update: [
    /\b(update|progress|status|fyi|for your information|heads up|letting you know)\b/i,
    /\b(wanted to (let you know|inform|update))\b/i,
  ],
  urgent: [
    /\b(urgent|asap|immediately|critical|emergency|time[- ]sensitive|high priority)\b/i,
    /\b(need(ed)? (right away|by eod|today|now))\b/i,
  ],
  informational: [
    /\b(please (note|see|find)|attached|enclosed|fyi)\b/i,
    /\b(for your (reference|records|review))\b/i,
  ],
  followup: [
    /\b(follow(ing)?[- ]up|checking in|circling back|touching base|reminder)\b/i,
    /\b(haven't heard|no response|still waiting)\b/i,
  ],
  approval_request: [
    /\b(approve|approval|sign[- ]off|authorize|authorization|permission)\b/i,
    /\b(need(s)? your (approval|sign[- ]off|ok|okay))\b/i,
  ],
  meeting_request: [
    /\b(meeting|call|sync|catch[- ]up|discussion|calendar|schedule)\b/i,
    /\b(available|free|open) (for|to)\b/i,
  ],
  feedback: [
    /\b(feedback|thoughts|opinion|review|input|suggestions)\b/i,
    /\b(what do you think|your take on|your perspective)\b/i,
  ],
  complaint: [
    /\b(disappointed|frustrated|unacceptable|complaint|issue with|problem with)\b/i,
    /\b(not (happy|satisfied|acceptable))\b/i,
  ],
  thank_you: [
    /\b(thank(s| you)|appreciate|grateful|gratitude)\b/i,
  ],
  introduction: [
    /\b(introduction|introducing|meet|pleased to introduce)\b/i,
    /\b(I('m| am)|my name is|this is)\b/i,
  ],
  unknown: [],
};

// ============================================================================
// Sentiment Patterns
// ============================================================================

const POSITIVE_PATTERNS = [
  /\b(great|excellent|amazing|wonderful|fantastic|perfect|love|happy|pleased|delighted|excited|appreciate|thank|grateful)\b/i,
  /\b(well done|good job|nice work|impressive|outstanding)\b/i,
];

const NEGATIVE_PATTERNS = [
  /\b(bad|terrible|awful|horrible|poor|disappointed|frustrated|angry|upset|concerned|worried|problem|issue|fail|wrong)\b/i,
  /\b(not (good|acceptable|happy|satisfied|working))\b/i,
];

// ============================================================================
// Action Item Patterns
// ============================================================================

const ACTION_ITEM_PATTERNS = [
  { pattern: /\b(please|kindly)\s+([\w\s]+?)(by|before|until|within|\.|$)/gi, type: 'request' as const },
  { pattern: /\b(can you|could you|would you)\s+([\w\s]+?)(\?|\.|$)/gi, type: 'request' as const },
  { pattern: /\b(need(s)? to|must|have to|should)\s+([\w\s]+?)(\.|$)/gi, type: 'task' as const },
  { pattern: /\b(action (item|required)|todo|to[- ]do)\s*:?\s*([\w\s]+?)(\.|$)/gi, type: 'task' as const },
  { pattern: /\b(decide|decision|approval)\s+(on|about|regarding)\s+([\w\s]+?)(\.|$)/gi, type: 'decision' as const },
  { pattern: /\b(follow[- ]up|check (back|in)|circle back)\s+(on|with|about)\s+([\w\s]+?)(\.|$)/gi, type: 'followup' as const },
];

// ============================================================================
// Email NLP Service Class
// ============================================================================

/**
 * EmailNlpService - Natural Language Processing for Email Analysis
 *
 * Features:
 * - Email parsing and extraction
 * - Intent classification (request, question, update, urgent)
 * - Entity extraction (dates, people, projects, deadlines)
 * - Sentiment analysis
 * - Action item detection
 * - Priority inference
 * - Thread summarization
 * - Auto-response suggestions
 * - Integration hooks for creating tasks from emails
 *
 * Time Complexity:
 * - Single email analysis: O(n) where n = email length
 * - Thread summarization: O(m * n) where m = emails, n = avg length
 * - Entity extraction: O(n * p) where p = pattern count
 */
export class EmailNlpService {
  private config: NlpConfig;
  private modelVersion: string = '1.0.0';

  /**
   * Initialize the Email NLP service
   *
   * @param config - NLP configuration
   */
  constructor(config?: Partial<NlpConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ==========================================================================
  // Email Parsing
  // ==========================================================================

  /**
   * Parse raw email content into structured format
   *
   * @param rawEmail - Raw email content or structured input
   * @returns Parsed email
   */
  parseEmail(rawEmail: string | Record<string, any>): ParsedEmail {
    if (typeof rawEmail === 'string') {
      return this.parseRawEmail(rawEmail);
    }

    return this.normalizeEmailObject(rawEmail);
  }

  /**
   * Parse raw email string (RFC 2822 format)
   */
  private parseRawEmail(raw: string): ParsedEmail {
    const lines = raw.split(/\r?\n/);
    const headers: Record<string, string> = {};
    let bodyStart = 0;

    // Parse headers
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line === '') {
        bodyStart = i + 1;
        break;
      }

      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const key = line.substring(0, colonIndex).toLowerCase().trim();
        const value = line.substring(colonIndex + 1).trim();
        headers[key] = value;
      }
    }

    const body = lines.slice(bodyStart).join('\n');

    return {
      id: headers['message-id'] || `email-${Date.now()}`,
      messageId: headers['message-id'] || '',
      threadId: headers['thread-id'],
      from: this.parseEmailAddress(headers['from'] || ''),
      to: this.parseEmailAddressList(headers['to'] || ''),
      cc: headers['cc'] ? this.parseEmailAddressList(headers['cc']) : undefined,
      subject: headers['subject'] || '',
      body: {
        text: body,
      },
      date: new Date(headers['date'] || Date.now()),
      headers,
      inReplyTo: headers['in-reply-to'],
      references: headers['references']?.split(/\s+/),
    };
  }

  /**
   * Normalize email object from various sources (Gmail, Outlook, etc.)
   */
  private normalizeEmailObject(email: Record<string, any>): ParsedEmail {
    return {
      id: email.id || email.messageId || `email-${Date.now()}`,
      messageId: email.messageId || email.id || '',
      threadId: email.threadId,
      from: this.parseEmailAddress(email.from),
      to: this.parseEmailAddressList(email.to),
      cc: email.cc ? this.parseEmailAddressList(email.cc) : undefined,
      bcc: email.bcc ? this.parseEmailAddressList(email.bcc) : undefined,
      replyTo: email.replyTo ? this.parseEmailAddress(email.replyTo) : undefined,
      subject: email.subject || '',
      body: {
        text: email.body?.text || email.text || email.body || '',
        html: email.body?.html || email.html,
      },
      date: new Date(email.date || email.receivedAt || Date.now()),
      headers: email.headers || {},
      attachments: email.attachments?.map((a: any) => ({
        id: a.id || a.attachmentId,
        filename: a.filename || a.name,
        mimeType: a.mimeType || a.contentType,
        size: a.size,
        contentId: a.contentId,
      })),
      inReplyTo: email.inReplyTo,
      references: email.references,
    };
  }

  /**
   * Parse email address string
   */
  private parseEmailAddress(input: string | EmailAddress): EmailAddress {
    if (typeof input === 'object') {
      return input;
    }

    const match = input.match(/^(?:"?([^"]*)"?\s)?<?([^>]+)>?$/);
    if (match) {
      return {
        name: match[1]?.trim(),
        email: match[2].trim(),
      };
    }

    return { email: input.trim() };
  }

  /**
   * Parse list of email addresses
   */
  private parseEmailAddressList(input: string | EmailAddress[] | string[]): EmailAddress[] {
    if (Array.isArray(input)) {
      return input.map(addr => this.parseEmailAddress(addr as string | EmailAddress));
    }

    return input.split(',').map(addr => this.parseEmailAddress(addr));
  }

  // ==========================================================================
  // Full Email Analysis
  // ==========================================================================

  /**
   * Perform complete analysis on an email
   *
   * @param email - Email to analyze (raw or parsed)
   * @returns Complete analysis result
   */
  async analyzeEmail(email: string | Record<string, any> | ParsedEmail): Promise<EmailAnalysis> {
    const startTime = Date.now();

    // Parse email if needed
    const parsed = this.isParseEmail(email) ? email : this.parseEmail(email);
    const text = parsed.body.text;

    // Run all analyses
    const [intent, entities, sentiment, actionItems, priority] = await Promise.all([
      this.classifyIntent(text, parsed.subject),
      this.config.enableEntityExtraction
        ? this.extractEntities(text, parsed)
        : this.emptyEntities(),
      this.config.enableSentimentAnalysis
        ? this.analyzeSentiment(text)
        : this.neutralSentiment(),
      this.detectActionItems(text),
      this.inferPriority(text, parsed),
    ]);

    // Generate summary and responses
    const summary = this.generateSummary(parsed, intent, actionItems);
    const suggestedResponses = this.generateSuggestedResponses(
      parsed,
      intent,
      actionItems,
      sentiment
    );

    const processingTimeMs = Date.now() - startTime;

    return {
      email: parsed,
      intent,
      entities,
      sentiment,
      actionItems,
      priority,
      summary,
      suggestedResponses,
      metadata: {
        analyzedAt: new Date(),
        processingTimeMs,
        modelVersion: this.modelVersion,
      },
    };
  }

  private isParseEmail(email: any): email is ParsedEmail {
    return email && typeof email === 'object' && 'messageId' in email && 'body' in email;
  }

  // ==========================================================================
  // Intent Classification
  // ==========================================================================

  /**
   * Classify the intent of an email
   *
   * @param text - Email body text
   * @param subject - Email subject
   * @returns Intent classification result
   */
  async classifyIntent(text: string, subject?: string): Promise<IntentClassification> {
    const combinedText = `${subject || ''} ${text}`.toLowerCase();
    const scores: Record<EmailIntent, { score: number; indicators: string[] }> = {} as any;

    // Calculate scores for each intent
    for (const [intent, patterns] of Object.entries(INTENT_PATTERNS)) {
      let score = 0;
      const indicators: string[] = [];

      for (const pattern of patterns) {
        const matches = combinedText.match(pattern);
        if (matches) {
          score += 1;
          indicators.push(matches[0]);
        }
      }

      // Subject line matches get extra weight
      if (subject) {
        for (const pattern of patterns) {
          if (pattern.test(subject)) {
            score += 0.5;
          }
        }
      }

      scores[intent as EmailIntent] = { score, indicators };
    }

    // Find primary and secondary intents
    const sortedIntents = Object.entries(scores)
      .filter(([intent]) => intent !== 'unknown')
      .sort((a, b) => b[1].score - a[1].score);

    const primary = sortedIntents[0]?.[1].score > 0
      ? sortedIntents[0][0] as EmailIntent
      : 'unknown';

    const secondary = sortedIntents[1]?.[1].score > 0
      ? sortedIntents[1][0] as EmailIntent
      : undefined;

    // Calculate confidence
    const maxScore = Math.max(...Object.values(scores).map(s => s.score));
    const totalScore = Object.values(scores).reduce((sum, s) => sum + s.score, 0);
    const confidence = totalScore > 0 ? maxScore / totalScore : 0;

    return {
      primary,
      secondary,
      confidence: Math.min(confidence, 1),
      indicators: scores[primary]?.indicators || [],
    };
  }

  // ==========================================================================
  // Entity Extraction
  // ==========================================================================

  /**
   * Extract entities from email text
   *
   * @param text - Email body text
   * @param email - Full parsed email for context
   * @returns Extracted entities
   */
  async extractEntities(text: string, email?: ParsedEmail): Promise<ExtractedEntities> {
    const [
      people,
      dates,
      projects,
      deadlines,
      organizations,
      locations,
      amounts,
      urls,
      phoneNumbers,
      references,
    ] = await Promise.all([
      this.extractPeople(text, email),
      this.extractDates(text),
      this.extractProjects(text),
      this.extractDeadlines(text),
      this.extractOrganizations(text),
      this.extractLocations(text),
      this.extractAmounts(text),
      this.extractUrls(text),
      this.extractPhoneNumbers(text),
      this.extractReferences(text),
    ]);

    return {
      people,
      dates,
      projects,
      deadlines,
      organizations,
      locations,
      amounts,
      urls,
      phoneNumbers,
      references,
    };
  }

  private emptyEntities(): ExtractedEntities {
    return {
      people: [],
      dates: [],
      projects: [],
      deadlines: [],
      organizations: [],
      locations: [],
      amounts: [],
      urls: [],
      phoneNumbers: [],
      references: [],
    };
  }

  /**
   * Extract person entities
   */
  private async extractPeople(text: string, email?: ParsedEmail): Promise<PersonEntity[]> {
    const people: Map<string, PersonEntity> = new Map();

    // Add email participants
    if (email) {
      this.addPerson(people, email.from.name || email.from.email, email.from.email, 'sender');

      for (const to of email.to) {
        this.addPerson(people, to.name || to.email, to.email, 'recipient');
      }

      if (email.cc) {
        for (const cc of email.cc) {
          this.addPerson(people, cc.name || cc.email, cc.email, 'cc');
        }
      }
    }

    // Extract names from text (simple patterns)
    const namePatterns = [
      /\b([A-Z][a-z]+\s+[A-Z][a-z]+)\b/g, // "John Smith"
      /\b(Mr\.|Mrs\.|Ms\.|Dr\.)\s+([A-Z][a-z]+(\s+[A-Z][a-z]+)?)/g, // "Mr. Smith"
      /@(\w+)/g, // "@username" mentions
    ];

    for (const pattern of namePatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const name = match[1] || match[2] || match[0];
        if (name.length > 2 && !this.isCommonWord(name)) {
          const existing = people.get(name.toLowerCase());
          if (existing) {
            existing.mentions++;
          } else {
            people.set(name.toLowerCase(), {
              name,
              mentions: 1,
              context: this.getContext(text, match.index),
            });
          }
        }
      }
    }

    return Array.from(people.values());
  }

  private addPerson(
    map: Map<string, PersonEntity>,
    name: string,
    email?: string,
    role?: string
  ): void {
    const key = (email || name).toLowerCase();
    const existing = map.get(key);

    if (existing) {
      existing.mentions++;
    } else {
      map.set(key, {
        name,
        email,
        role,
        mentions: 1,
        context: role || '',
      });
    }
  }

  /**
   * Extract date entities
   */
  private async extractDates(text: string): Promise<DateEntity[]> {
    const dates: DateEntity[] = [];

    // Absolute date patterns
    const absolutePatterns = [
      /\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\b/g, // MM/DD/YYYY
      /\b(\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})\b/g, // YYYY-MM-DD
      /\b((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2}(?:st|nd|rd|th)?,?\s*\d{0,4})\b/gi,
      /\b(\d{1,2}(?:st|nd|rd|th)?\s+(?:of\s+)?(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s*,?\s*\d{0,4})\b/gi,
    ];

    // Relative date patterns
    const relativePatterns = [
      { pattern: /\b(today)\b/gi, type: 'relative' as const },
      { pattern: /\b(tomorrow)\b/gi, type: 'relative' as const },
      { pattern: /\b(next\s+(?:week|month|monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b/gi, type: 'relative' as const },
      { pattern: /\b(in\s+\d+\s+(?:day|days|week|weeks|month|months))\b/gi, type: 'relative' as const },
      { pattern: /\b(this\s+(?:week|month|friday|monday))\b/gi, type: 'relative' as const },
      { pattern: /\b(end\s+of\s+(?:day|week|month|quarter|year)|eod|eow|eom)\b/gi, type: 'relative' as const },
    ];

    // Extract absolute dates
    for (const pattern of absolutePatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const dateText = match[1];
        const parsed = this.parseDate(dateText);
        const context = this.getContext(text, match.index);
        const isDeadline = /\b(by|before|until|due|deadline)\b/i.test(context);

        dates.push({
          text: dateText,
          parsed,
          type: 'absolute',
          context,
          isDeadline,
        });
      }
    }

    // Extract relative dates
    for (const { pattern, type } of relativePatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const dateText = match[1];
        const parsed = this.parseRelativeDate(dateText);
        const context = this.getContext(text, match.index);
        const isDeadline = /\b(by|before|until|due|deadline)\b/i.test(context);

        dates.push({
          text: dateText,
          parsed,
          type,
          context,
          isDeadline,
        });
      }
    }

    return dates;
  }

  private parseDate(text: string): Date | null {
    try {
      const date = new Date(text);
      return isNaN(date.getTime()) ? null : date;
    } catch {
      return null;
    }
  }

  private parseRelativeDate(text: string): Date | null {
    const now = new Date();
    const lower = text.toLowerCase();

    if (lower === 'today') return now;
    if (lower === 'tomorrow') {
      const d = new Date(now);
      d.setDate(d.getDate() + 1);
      return d;
    }
    if (lower.includes('eod') || lower.includes('end of day')) {
      const d = new Date(now);
      d.setHours(23, 59, 59, 999);
      return d;
    }

    const inMatch = lower.match(/in\s+(\d+)\s+(day|week|month)s?/);
    if (inMatch) {
      const d = new Date(now);
      const amount = parseInt(inMatch[1], 10);
      const unit = inMatch[2];

      if (unit === 'day') d.setDate(d.getDate() + amount);
      else if (unit === 'week') d.setDate(d.getDate() + amount * 7);
      else if (unit === 'month') d.setMonth(d.getMonth() + amount);

      return d;
    }

    return null;
  }

  /**
   * Extract project references
   */
  private async extractProjects(text: string): Promise<ProjectEntity[]> {
    const projects: ProjectEntity[] = [];

    // Project patterns
    const patterns = [
      /\b(project\s*:?\s*["\']?([^"\',.]+)["\']?)/gi,
      /\b([A-Z]{2,}-\d+)\b/g, // JIRA-style: ABC-123
      /\b(#\w+)\b/g, // Hashtag style
    ];

    // Custom project keywords
    for (const keyword of this.config.projectKeywords || []) {
      const regex = new RegExp(`\\b(${keyword})\\b`, 'gi');
      let match;
      while ((match = regex.exec(text)) !== null) {
        projects.push({
          name: match[1],
          confidence: 0.9,
          context: this.getContext(text, match.index),
        });
      }
    }

    // Standard patterns
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const name = match[2] || match[1];
        projects.push({
          name: name.trim(),
          identifier: match[1].includes('-') ? match[1] : undefined,
          confidence: 0.7,
          context: this.getContext(text, match.index),
        });
      }
    }

    // Custom patterns from config
    for (const customPattern of this.config.customPatterns || []) {
      if (customPattern.type === 'project') {
        let match;
        while ((match = customPattern.pattern.exec(text)) !== null) {
          const result = customPattern.transform?.(match) || { name: match[1] };
          projects.push({
            ...result,
            confidence: 0.85,
            context: this.getContext(text, match.index),
          });
        }
      }
    }

    return this.deduplicateByField(projects, 'name');
  }

  /**
   * Extract deadline entities
   */
  private async extractDeadlines(text: string): Promise<DeadlineEntity[]> {
    const deadlines: DeadlineEntity[] = [];

    const patterns = [
      /\b(due\s+(?:by|on|date)?:?\s*)([^,.]+)/gi,
      /\b(deadline:?\s*)([^,.]+)/gi,
      /\b(must\s+(?:be\s+)?(?:completed?|done|finished|submitted)\s+(?:by|before)\s*)([^,.]+)/gi,
      /\b(need(?:ed)?\s+by\s*)([^,.]+)/gi,
      /\b(by\s+)((?:end\s+of\s+)?(?:today|tomorrow|eod|eow|eom|next\s+\w+|\w+\s+\d{1,2}))/gi,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const dateText = match[2].trim();
        const parsed = this.parseDate(dateText) || this.parseRelativeDate(dateText);
        const context = this.getContext(text, match.index);
        const urgency = this.determineDeadlineUrgency(parsed, text);

        deadlines.push({
          text: dateText,
          date: parsed,
          urgency,
          task: this.extractTaskFromContext(context),
          context,
        });
      }
    }

    return deadlines;
  }

  private determineDeadlineUrgency(date: Date | null, text: string): DeadlineEntity['urgency'] {
    if (/\b(urgent|asap|critical|immediately)\b/i.test(text)) {
      return 'critical';
    }

    if (!date) return 'medium';

    const now = new Date();
    const diffDays = (date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

    if (diffDays < 0) return 'critical'; // Overdue
    if (diffDays < 1) return 'critical'; // Today
    if (diffDays < 3) return 'high';
    if (diffDays < 7) return 'medium';
    return 'low';
  }

  private extractTaskFromContext(context: string): string {
    // Extract the task description from the context
    const match = context.match(/(?:please|need to|must)\s+(.+?)(?:by|before|until|\.)/i);
    return match?.[1]?.trim() || context.substring(0, 50).trim();
  }

  /**
   * Extract organization entities
   */
  private async extractOrganizations(text: string): Promise<OrganizationEntity[]> {
    const organizations: OrganizationEntity[] = [];

    // Common organization patterns
    const patterns = [
      /\b(\w+(?:\s+\w+)*\s+(?:Inc\.|Corp\.|LLC|Ltd\.|Company|Group|Team|Department))\b/gi,
      /\b(the\s+(\w+(?:\s+\w+)*)\s+(?:team|department|division|group))\b/gi,
    ];

    // Custom organization keywords
    for (const keyword of this.config.organizationKeywords || []) {
      const regex = new RegExp(`\\b(${keyword})\\b`, 'gi');
      let match;
      while ((match = regex.exec(text)) !== null) {
        organizations.push({
          name: match[1],
          type: 'company',
          confidence: 0.9,
        });
      }
    }

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const name = match[2] || match[1];
        const type = this.classifyOrgType(match[0]);

        organizations.push({
          name: name.trim(),
          type,
          confidence: 0.7,
        });
      }
    }

    return this.deduplicateByField(organizations, 'name');
  }

  private classifyOrgType(text: string): OrganizationEntity['type'] {
    const lower = text.toLowerCase();
    if (/\b(inc|corp|llc|ltd|company)\b/.test(lower)) return 'company';
    if (/\b(department|division)\b/.test(lower)) return 'department';
    if (/\b(team|group)\b/.test(lower)) return 'team';
    return 'other';
  }

  /**
   * Extract location entities
   */
  private async extractLocations(text: string): Promise<LocationEntity[]> {
    const locations: LocationEntity[] = [];

    // Location patterns
    const patterns = [
      { pattern: /\b(https?:\/\/[^\s]+(?:zoom|meet|teams)[^\s]*)\b/gi, type: 'virtual' as const },
      { pattern: /\b(conference\s+room\s+\w+)\b/gi, type: 'venue' as const },
      { pattern: /\b(room\s+\d+[A-Z]?)\b/gi, type: 'venue' as const },
      { pattern: /\b(\d+\s+\w+\s+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd)[^,]*(?:,\s*[^,]+)?)\b/gi, type: 'address' as const },
    ];

    for (const { pattern, type } of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        locations.push({
          text: match[1].trim(),
          type,
        });
      }
    }

    return locations;
  }

  /**
   * Extract amount entities
   */
  private async extractAmounts(text: string): Promise<AmountEntity[]> {
    const amounts: AmountEntity[] = [];

    const patterns = [
      { pattern: /(\$|USD|EUR|GBP|£|€)\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/gi, type: 'monetary' as const },
      { pattern: /(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(dollars?|euros?|pounds?)/gi, type: 'monetary' as const },
      { pattern: /(\d+(?:\.\d+)?)\s*%/g, type: 'percentage' as const },
      { pattern: /(\d+)\s+(hours?|days?|weeks?|months?)/gi, type: 'duration' as const },
      { pattern: /(\d+(?:,\d{3})*)\s+(units?|items?|pieces?)/gi, type: 'quantity' as const },
    ];

    for (const { pattern, type } of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const value = parseFloat(match[type === 'monetary' ? 2 : 1].replace(/,/g, ''));
        let currency: string | undefined;

        if (type === 'monetary') {
          const currencyMatch = match[1];
          currency = currencyMatch.includes('$') || currencyMatch.includes('USD') ? 'USD' :
                     currencyMatch.includes('€') || currencyMatch.includes('EUR') ? 'EUR' :
                     currencyMatch.includes('£') || currencyMatch.includes('GBP') ? 'GBP' : undefined;
        }

        amounts.push({
          text: match[0],
          value,
          currency,
          type,
        });
      }
    }

    return amounts;
  }

  /**
   * Extract URL entities
   */
  private async extractUrls(text: string): Promise<UrlEntity[]> {
    const urls: UrlEntity[] = [];

    const urlPattern = /https?:\/\/[^\s<>"\]]+/gi;
    let match;

    while ((match = urlPattern.exec(text)) !== null) {
      const url = match[0];
      const type = this.classifyUrlType(url);

      urls.push({
        url,
        type,
      });
    }

    return urls;
  }

  private classifyUrlType(url: string): UrlEntity['type'] {
    const lower = url.toLowerCase();
    if (/\.(pdf|doc|docx|xls|xlsx|ppt|pptx)($|\?)/.test(lower)) return 'document';
    if (/\.(jpg|jpeg|png|gif|svg|webp)($|\?)/.test(lower)) return 'image';
    if (/\.(mp4|avi|mov|webm)($|\?)/.test(lower)) return 'video';
    return 'link';
  }

  /**
   * Extract phone number entities
   */
  private async extractPhoneNumbers(text: string): Promise<PhoneEntity[]> {
    const phones: PhoneEntity[] = [];

    const patterns = [
      /\b(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
      /\b\d{3}[-.\s]\d{4}\b/g,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const number = match[0].replace(/[-.\s()]/g, '');
        if (number.length >= 7 && number.length <= 15) {
          phones.push({
            number,
            formatted: match[0],
            type: this.classifyPhoneType(text, match.index),
          });
        }
      }
    }

    return phones;
  }

  private classifyPhoneType(text: string, index: number): PhoneEntity['type'] {
    const context = this.getContext(text, index).toLowerCase();
    if (/\b(mobile|cell)\b/.test(context)) return 'mobile';
    if (/\b(office|work)\b/.test(context)) return 'office';
    if (/\bfax\b/.test(context)) return 'fax';
    return 'other';
  }

  /**
   * Extract reference entities (ticket numbers, IDs, etc.)
   */
  private async extractReferences(text: string): Promise<ReferenceEntity[]> {
    const references: ReferenceEntity[] = [];

    const patterns = [
      { pattern: /\b(ticket|case|issue)\s*#?\s*(\d+)\b/gi, type: 'ticket' as const },
      { pattern: /\b(invoice)\s*#?\s*([A-Z0-9-]+)\b/gi, type: 'invoice' as const },
      { pattern: /\b(order)\s*#?\s*([A-Z0-9-]+)\b/gi, type: 'order' as const },
      { pattern: /\b(case)\s*#?\s*([A-Z0-9-]+)\b/gi, type: 'case' as const },
      { pattern: /\b([A-Z]{2,}-\d+)\b/g, type: 'ticket' as const }, // JIRA-style
    ];

    for (const { pattern, type } of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        references.push({
          text: match[0],
          type,
          identifier: match[2] || match[1],
        });
      }
    }

    // Custom patterns
    for (const customPattern of this.config.customPatterns || []) {
      if (customPattern.type === 'reference') {
        let match;
        while ((match = customPattern.pattern.exec(text)) !== null) {
          const result = customPattern.transform?.(match) || {
            identifier: match[1],
          };
          references.push({
            text: match[0],
            type: 'other',
            ...result,
          });
        }
      }
    }

    return this.deduplicateByField(references, 'identifier');
  }

  // ==========================================================================
  // Sentiment Analysis
  // ==========================================================================

  /**
   * Analyze sentiment of email text
   *
   * @param text - Email body text
   * @returns Sentiment analysis result
   */
  async analyzeSentiment(text: string): Promise<SentimentAnalysis> {
    let positiveScore = 0;
    let negativeScore = 0;

    // Count positive matches
    for (const pattern of POSITIVE_PATTERNS) {
      const matches = text.match(pattern);
      if (matches) {
        positiveScore += matches.length;
      }
    }

    // Count negative matches
    for (const pattern of NEGATIVE_PATTERNS) {
      const matches = text.match(pattern);
      if (matches) {
        negativeScore += matches.length;
      }
    }

    // Calculate overall score (-1 to 1)
    const total = positiveScore + negativeScore;
    const score = total > 0 ? (positiveScore - negativeScore) / total : 0;

    // Determine overall sentiment
    let overall: Sentiment;
    if (positiveScore > 0 && negativeScore > 0) {
      overall = 'mixed';
    } else if (score > 0.2) {
      overall = 'positive';
    } else if (score < -0.2) {
      overall = 'negative';
    } else {
      overall = 'neutral';
    }

    // Calculate confidence
    const confidence = total > 0 ? Math.min(total / 10, 1) : 0.5;

    // Detect emotions
    const emotions = this.detectEmotions(text);

    return {
      overall,
      score,
      confidence,
      aspects: [],
      emotions,
    };
  }

  private neutralSentiment(): SentimentAnalysis {
    return {
      overall: 'neutral',
      score: 0,
      confidence: 0.5,
      aspects: [],
      emotions: [],
    };
  }

  private detectEmotions(text: string): SentimentAnalysis['emotions'] {
    const emotions: Array<{ emotion: string; intensity: number }> = [];

    const emotionPatterns: Array<{ emotion: string; patterns: RegExp[] }> = [
      {
        emotion: 'urgency',
        patterns: [/\b(urgent|asap|immediately|critical)\b/gi],
      },
      {
        emotion: 'frustration',
        patterns: [/\b(frustrated|annoyed|disappointed)\b/gi],
      },
      {
        emotion: 'gratitude',
        patterns: [/\b(thank|appreciate|grateful)\b/gi],
      },
      {
        emotion: 'excitement',
        patterns: [/\b(excited|thrilled|eager|looking forward)\b/gi],
      },
      {
        emotion: 'concern',
        patterns: [/\b(worried|concerned|anxious|nervous)\b/gi],
      },
    ];

    for (const { emotion, patterns } of emotionPatterns) {
      let count = 0;
      for (const pattern of patterns) {
        const matches = text.match(pattern);
        if (matches) count += matches.length;
      }

      if (count > 0) {
        emotions.push({
          emotion,
          intensity: Math.min(count / 3, 1),
        });
      }
    }

    return emotions.sort((a, b) => b.intensity - a.intensity);
  }

  // ==========================================================================
  // Action Item Detection
  // ==========================================================================

  /**
   * Detect action items in email text
   *
   * @param text - Email body text
   * @returns Array of detected action items
   */
  async detectActionItems(text: string): Promise<ActionItem[]> {
    const actionItems: ActionItem[] = [];
    let idCounter = 0;

    for (const { pattern, type } of ACTION_ITEM_PATTERNS) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const actionText = (match[2] || match[3] || match[0]).trim();

        // Filter out too short or common phrases
        if (actionText.length < 5 || this.isCommonPhrase(actionText)) {
          continue;
        }

        const context = this.getContext(text, match.index);
        const priority = this.inferActionPriority(context, text);
        const dueDate = this.extractDueDateFromContext(context);
        const assignee = this.extractAssigneeFromContext(context);

        actionItems.push({
          id: `action-${++idCounter}`,
          text: this.cleanActionText(actionText),
          type,
          assignee,
          dueDate,
          priority,
          confidence: this.calculateActionConfidence(match, context),
          context,
          sourceSpan: {
            start: match.index,
            end: match.index + match[0].length,
          },
        });
      }
    }

    return this.deduplicateActionItems(actionItems);
  }

  private cleanActionText(text: string): string {
    return text
      .replace(/^\s*(please|kindly)\s*/i, '')
      .replace(/\s*[.!?]\s*$/, '')
      .trim();
  }

  private isCommonPhrase(text: string): boolean {
    const commonPhrases = [
      'let me know',
      'feel free',
      'don\'t hesitate',
      'if you have any questions',
      'if you need anything',
    ];
    return commonPhrases.some(phrase => text.toLowerCase().includes(phrase));
  }

  private inferActionPriority(context: string, fullText: string): EmailPriority {
    const urgentPatterns = /\b(urgent|asap|critical|immediately|high priority)\b/i;
    const highPatterns = /\b(important|soon|quickly|priority)\b/i;
    const lowPatterns = /\b(when you (have time|can|get a chance)|no rush|whenever)\b/i;

    if (urgentPatterns.test(context) || urgentPatterns.test(fullText)) return 'critical';
    if (highPatterns.test(context)) return 'high';
    if (lowPatterns.test(context)) return 'low';
    return 'medium';
  }

  private extractDueDateFromContext(context: string): Date | undefined {
    const datePatterns = [
      /\b(by|before|until)\s+(\w+\s+\d{1,2}(?:st|nd|rd|th)?)/i,
      /\b(by|before|until)\s+(today|tomorrow|eod|end of day|next \w+)/i,
    ];

    for (const pattern of datePatterns) {
      const match = context.match(pattern);
      if (match) {
        return this.parseDate(match[2]) || this.parseRelativeDate(match[2]) || undefined;
      }
    }

    return undefined;
  }

  private extractAssigneeFromContext(context: string): string | undefined {
    const assigneePattern = /\b(?:@(\w+)|(\w+(?:\s+\w+)?),?\s+(?:please|can you|could you))/i;
    const match = context.match(assigneePattern);
    return match?.[1] || match?.[2];
  }

  private calculateActionConfidence(match: RegExpMatchArray, context: string): number {
    let confidence = 0.6;

    // Increase confidence for explicit action words
    if (/\b(please|kindly|need|must|should)\b/i.test(context)) {
      confidence += 0.1;
    }

    // Increase for deadline presence
    if (/\b(by|before|until|deadline)\b/i.test(context)) {
      confidence += 0.1;
    }

    // Increase for clear action verbs
    if (/\b(send|create|update|review|check|confirm|schedule)\b/i.test(match[0])) {
      confidence += 0.15;
    }

    return Math.min(confidence, 1);
  }

  private deduplicateActionItems(items: ActionItem[]): ActionItem[] {
    const unique: ActionItem[] = [];
    const seen = new Set<string>();

    for (const item of items) {
      const key = item.text.toLowerCase().substring(0, 30);
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(item);
      }
    }

    return unique.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  // ==========================================================================
  // Priority Inference
  // ==========================================================================

  /**
   * Infer priority of an email
   *
   * @param text - Email body text
   * @param email - Parsed email for additional context
   * @returns Priority inference result
   */
  async inferPriority(text: string, email?: ParsedEmail): Promise<PriorityInference> {
    const factors: PriorityFactor[] = [];
    let score = 0;

    // Factor: Urgent keywords
    const urgentKeywords = (text.match(/\b(urgent|asap|critical|emergency|immediately)\b/gi) || []).length;
    if (urgentKeywords > 0) {
      factors.push({
        factor: 'Urgent keywords',
        weight: 0.3,
        value: urgentKeywords,
        impact: 'increase',
      });
      score += urgentKeywords * 0.3;
    }

    // Factor: Deadline proximity
    const deadlines = await this.extractDeadlines(text);
    const nearDeadlines = deadlines.filter(d => {
      if (!d.date) return false;
      const daysUntil = (d.date.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      return daysUntil >= 0 && daysUntil <= 2;
    });
    if (nearDeadlines.length > 0) {
      factors.push({
        factor: 'Near deadlines',
        weight: 0.25,
        value: nearDeadlines.length,
        impact: 'increase',
      });
      score += 0.25;
    }

    // Factor: Question marks (questions need answers)
    const questions = (text.match(/\?/g) || []).length;
    if (questions > 0) {
      factors.push({
        factor: 'Questions asked',
        weight: 0.1,
        value: questions,
        impact: 'increase',
      });
      score += Math.min(questions * 0.05, 0.15);
    }

    // Factor: Subject line markers
    if (email?.subject) {
      const subjectUpper = email.subject.toUpperCase();
      if (subjectUpper.includes('URGENT') || subjectUpper.includes('CRITICAL')) {
        factors.push({
          factor: 'Subject urgency marker',
          weight: 0.3,
          value: email.subject,
          impact: 'increase',
        });
        score += 0.3;
      }
      if (subjectUpper.includes('FYI') || subjectUpper.includes('INFO')) {
        factors.push({
          factor: 'Informational marker',
          weight: 0.15,
          value: email.subject,
          impact: 'decrease',
        });
        score -= 0.15;
      }
    }

    // Factor: Reply/forward (follow-up context)
    if (email?.inReplyTo || email?.subject?.toLowerCase().startsWith('re:')) {
      factors.push({
        factor: 'Reply context',
        weight: 0.05,
        value: true,
        impact: 'increase',
      });
      score += 0.05;
    }

    // Calculate final level
    let level: EmailPriority;
    if (score >= 0.5) level = 'critical';
    else if (score >= 0.3) level = 'high';
    else if (score >= 0.1) level = 'medium';
    else level = 'low';

    // Build explanation
    const increasingFactors = factors.filter(f => f.impact === 'increase');
    const decreasingFactors = factors.filter(f => f.impact === 'decrease');

    let explanation = `Priority: ${level}.`;
    if (increasingFactors.length > 0) {
      explanation += ` Key factors: ${increasingFactors.map(f => f.factor).join(', ')}.`;
    }
    if (decreasingFactors.length > 0) {
      explanation += ` Mitigating: ${decreasingFactors.map(f => f.factor).join(', ')}.`;
    }

    return {
      level,
      confidence: Math.min(0.5 + score, 1),
      factors,
      explanation,
    };
  }

  // ==========================================================================
  // Summary Generation
  // ==========================================================================

  /**
   * Generate a summary of the email
   *
   * @param email - Parsed email
   * @param intent - Intent classification
   * @param actionItems - Detected action items
   * @returns Summary string
   */
  generateSummary(
    email: ParsedEmail,
    intent: IntentClassification,
    actionItems: ActionItem[]
  ): string {
    const parts: string[] = [];

    // Intent description
    const intentDescriptions: Record<EmailIntent, string> = {
      request: 'requests action',
      question: 'asks a question',
      update: 'provides an update',
      urgent: 'requires urgent attention',
      informational: 'shares information',
      followup: 'follows up on previous communication',
      approval_request: 'requests approval',
      meeting_request: 'proposes a meeting',
      feedback: 'requests feedback',
      complaint: 'raises a concern',
      thank_you: 'expresses gratitude',
      introduction: 'makes an introduction',
      unknown: 'contains general communication',
    };

    parts.push(`${email.from.name || email.from.email} ${intentDescriptions[intent.primary]}`);

    // Subject summary
    if (email.subject) {
      parts.push(`regarding "${email.subject}"`);
    }

    // Action items summary
    if (actionItems.length > 0) {
      const criticalItems = actionItems.filter(a => a.priority === 'critical' || a.priority === 'high');
      if (criticalItems.length > 0) {
        parts.push(`with ${criticalItems.length} high-priority action item(s)`);
      } else {
        parts.push(`with ${actionItems.length} action item(s)`);
      }
    }

    return parts.join(' ') + '.';
  }

  // ==========================================================================
  // Thread Summarization
  // ==========================================================================

  /**
   * Summarize an email thread
   *
   * @param emails - Array of emails in the thread
   * @returns Thread summary
   */
  async summarizeThread(emails: Array<string | Record<string, any> | ParsedEmail>): Promise<ThreadSummary> {
    // Parse all emails
    const parsedEmails = emails.map(e =>
      this.isParseEmail(e) ? e : this.parseEmail(e)
    );

    // Sort by date
    parsedEmails.sort((a, b) => a.date.getTime() - b.date.getTime());

    // Analyze all emails
    const analyses = await Promise.all(
      parsedEmails.map(email => this.analyzeEmail(email))
    );

    // Collect unique participants
    const participantsMap = new Map<string, EmailAddress>();
    for (const email of parsedEmails) {
      participantsMap.set(email.from.email, email.from);
      for (const to of email.to) {
        participantsMap.set(to.email, to);
      }
    }

    // Aggregate action items (only open ones)
    const allActionItems = analyses.flatMap(a => a.actionItems);
    const openItems = this.filterOpenActionItems(allActionItems);

    // Detect decisions (based on approval/confirmation language)
    const decisions = this.extractDecisions(parsedEmails);

    // Calculate sentiment trend
    const sentiments = analyses.map(a => a.sentiment.score);
    const sentimentTrend = this.calculateSentimentTrend(sentiments);

    // Extract key points
    const keyPoints = this.extractKeyPoints(parsedEmails, analyses);

    // Identify topics
    const topics = this.identifyTopics(parsedEmails);

    // Generate summary
    const summary = this.generateThreadSummary(parsedEmails, analyses, decisions, openItems);

    return {
      threadId: parsedEmails[0].threadId || parsedEmails[0].messageId,
      subject: parsedEmails[0].subject,
      participants: Array.from(participantsMap.values()),
      emailCount: parsedEmails.length,
      dateRange: {
        start: parsedEmails[0].date,
        end: parsedEmails[parsedEmails.length - 1].date,
      },
      summary,
      keyPoints,
      decisions,
      openItems,
      sentiment: {
        trend: sentimentTrend,
        overall: this.averageSentiment(analyses.map(a => a.sentiment)),
      },
      topics,
    };
  }

  private filterOpenActionItems(items: ActionItem[]): ActionItem[] {
    // In a real implementation, this would check against task status
    // For now, return high-priority items from recent emails
    return items
      .filter(item => item.priority === 'critical' || item.priority === 'high')
      .slice(0, 5);
  }

  private extractDecisions(emails: ParsedEmail[]): string[] {
    const decisions: string[] = [];
    const decisionPatterns = [
      /\b(decided|agreed|confirmed|approved|will proceed with)\s+(.+?)(?:\.|\n)/gi,
      /\b(decision|conclusion|agreement)\s*:\s*(.+?)(?:\.|\n)/gi,
    ];

    for (const email of emails) {
      for (const pattern of decisionPatterns) {
        let match;
        while ((match = pattern.exec(email.body.text)) !== null) {
          decisions.push(match[2].trim());
        }
      }
    }

    return [...new Set(decisions)].slice(0, 5);
  }

  private calculateSentimentTrend(scores: number[]): 'improving' | 'declining' | 'stable' {
    if (scores.length < 2) return 'stable';

    const firstHalf = scores.slice(0, Math.floor(scores.length / 2));
    const secondHalf = scores.slice(Math.floor(scores.length / 2));

    const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    const diff = avgSecond - avgFirst;

    if (diff > 0.2) return 'improving';
    if (diff < -0.2) return 'declining';
    return 'stable';
  }

  private averageSentiment(sentiments: SentimentAnalysis[]): Sentiment {
    const avgScore = sentiments.reduce((sum, s) => sum + s.score, 0) / sentiments.length;

    if (avgScore > 0.2) return 'positive';
    if (avgScore < -0.2) return 'negative';
    return 'neutral';
  }

  private extractKeyPoints(emails: ParsedEmail[], analyses: EmailAnalysis[]): string[] {
    const keyPoints: string[] = [];

    for (let i = 0; i < emails.length; i++) {
      const analysis = analyses[i];

      // Add high-confidence action items
      for (const item of analysis.actionItems) {
        if (item.confidence > 0.8) {
          keyPoints.push(`Action required: ${item.text}`);
        }
      }

      // Add decisions found
      const decisions = this.extractDecisions([emails[i]]);
      for (const decision of decisions) {
        keyPoints.push(`Decision: ${decision}`);
      }
    }

    return [...new Set(keyPoints)].slice(0, 10);
  }

  private identifyTopics(emails: ParsedEmail[]): Array<{ topic: string; relevance: number }> {
    const wordFreq = new Map<string, number>();
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been', 'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his', 'its', 'our', 'their', 'please', 'thanks', 'thank', 'hi', 'hello', 'regards', 'best']);

    for (const email of emails) {
      const words = email.body.text
        .toLowerCase()
        .split(/\s+/)
        .filter(w => w.length > 3 && !stopWords.has(w) && /^[a-z]+$/.test(w));

      for (const word of words) {
        wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
      }
    }

    const sortedWords = Array.from(wordFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    const maxFreq = sortedWords[0]?.[1] || 1;

    return sortedWords.map(([topic, freq]) => ({
      topic,
      relevance: freq / maxFreq,
    }));
  }

  private generateThreadSummary(
    emails: ParsedEmail[],
    analyses: EmailAnalysis[],
    decisions: string[],
    openItems: ActionItem[]
  ): string {
    const parts: string[] = [];

    // Thread basics
    parts.push(`Thread with ${emails.length} emails`);

    // Duration
    const duration = emails[emails.length - 1].date.getTime() - emails[0].date.getTime();
    const days = Math.floor(duration / (1000 * 60 * 60 * 24));
    if (days > 0) {
      parts.push(`spanning ${days} day(s)`);
    }

    // Key outcomes
    if (decisions.length > 0) {
      parts.push(`with ${decisions.length} decision(s) made`);
    }

    if (openItems.length > 0) {
      parts.push(`and ${openItems.length} open action item(s)`);
    }

    return parts.join(' ') + '.';
  }

  // ==========================================================================
  // Suggested Response Generation
  // ==========================================================================

  /**
   * Generate suggested responses
   *
   * @param email - Parsed email
   * @param intent - Intent classification
   * @param actionItems - Detected action items
   * @param sentiment - Sentiment analysis
   * @returns Array of suggested responses
   */
  generateSuggestedResponses(
    email: ParsedEmail,
    intent: IntentClassification,
    actionItems: ActionItem[],
    sentiment: SentimentAnalysis
  ): SuggestedResponse[] {
    const responses: SuggestedResponse[] = [];
    const senderName = email.from.name?.split(' ')[0] || 'there';

    // Determine tone based on context
    const tone: SuggestedResponse['tone'] = sentiment.overall === 'negative' ? 'formal' : 'neutral';

    // Acknowledgment response
    responses.push({
      id: 'response-ack',
      type: 'acknowledge',
      body: this.generateAcknowledgmentResponse(senderName, intent.primary, tone),
      tone,
      confidence: 0.9,
    });

    // Intent-specific responses
    switch (intent.primary) {
      case 'request':
        responses.push({
          id: 'response-accept',
          type: 'accept',
          body: this.generateAcceptResponse(senderName, actionItems, tone),
          tone,
          confidence: 0.8,
          actionItems: actionItems.map(a => a.text),
        });
        responses.push({
          id: 'response-decline',
          type: 'decline',
          body: this.generateDeclineResponse(senderName, tone),
          tone: 'formal',
          confidence: 0.7,
        });
        break;

      case 'question':
        responses.push({
          id: 'response-info',
          type: 'request_info',
          body: this.generateNeedMoreInfoResponse(senderName, tone),
          tone,
          confidence: 0.75,
        });
        break;

      case 'meeting_request':
        responses.push({
          id: 'response-meeting-accept',
          type: 'accept',
          body: this.generateMeetingAcceptResponse(senderName, tone),
          tone,
          confidence: 0.8,
        });
        responses.push({
          id: 'response-meeting-alt',
          type: 'custom',
          body: this.generateMeetingAlternativeResponse(senderName, tone),
          tone,
          confidence: 0.7,
        });
        break;

      case 'approval_request':
        responses.push({
          id: 'response-approve',
          type: 'accept',
          body: this.generateApprovalResponse(senderName, tone),
          tone,
          confidence: 0.8,
        });
        break;

      case 'followup':
        responses.push({
          id: 'response-update',
          type: 'custom',
          body: this.generateFollowupResponse(senderName, tone),
          tone,
          confidence: 0.8,
        });
        break;
    }

    // Delegate option for requests
    if (actionItems.length > 0) {
      responses.push({
        id: 'response-delegate',
        type: 'delegate',
        body: this.generateDelegateResponse(senderName, tone),
        tone,
        confidence: 0.6,
      });
    }

    return responses
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, this.config.maxSuggestedResponses);
  }

  private generateAcknowledgmentResponse(name: string, intent: EmailIntent, tone: SuggestedResponse['tone']): string {
    const greetings = tone === 'formal' ? `Dear ${name}` : `Hi ${name}`;

    const acknowledgments: Partial<Record<EmailIntent, string>> = {
      request: 'Thank you for your request. I have received it and will get back to you shortly.',
      question: 'Thank you for reaching out. I will look into this and respond as soon as possible.',
      update: 'Thank you for the update. I have noted the information.',
      urgent: 'Thank you for flagging this as urgent. I am reviewing it now and will respond promptly.',
      approval_request: 'Thank you for submitting this for approval. I will review it and get back to you.',
      meeting_request: 'Thank you for the meeting request. I will check my availability and confirm.',
    };

    const body = acknowledgments[intent] || 'Thank you for your email. I will review and respond accordingly.';

    return `${greetings},\n\n${body}\n\nBest regards`;
  }

  private generateAcceptResponse(name: string, actionItems: ActionItem[], tone: SuggestedResponse['tone']): string {
    const greeting = tone === 'formal' ? `Dear ${name}` : `Hi ${name}`;

    let body = 'I can help with this. ';

    if (actionItems.length > 0) {
      body += 'I will:\n';
      for (const item of actionItems.slice(0, 3)) {
        body += `- ${item.text}\n`;
      }
    }

    body += '\nI will keep you updated on the progress.';

    return `${greeting},\n\n${body}\n\nBest regards`;
  }

  private generateDeclineResponse(name: string, tone: SuggestedResponse['tone']): string {
    const greeting = tone === 'formal' ? `Dear ${name}` : `Hi ${name}`;

    return `${greeting},\n\nThank you for thinking of me for this. Unfortunately, I am unable to take this on at the moment due to current commitments.\n\nI would suggest reaching out to [alternative contact] who may be able to assist.\n\nBest regards`;
  }

  private generateNeedMoreInfoResponse(name: string, tone: SuggestedResponse['tone']): string {
    const greeting = tone === 'formal' ? `Dear ${name}` : `Hi ${name}`;

    return `${greeting},\n\nThank you for your question. To provide you with an accurate response, I need some additional information:\n\n- [Question 1]\n- [Question 2]\n\nOnce I have these details, I will be able to assist you further.\n\nBest regards`;
  }

  private generateMeetingAcceptResponse(name: string, tone: SuggestedResponse['tone']): string {
    const greeting = tone === 'formal' ? `Dear ${name}` : `Hi ${name}`;

    return `${greeting},\n\nThank you for the meeting invitation. The proposed time works for me. I have added it to my calendar and look forward to our discussion.\n\nBest regards`;
  }

  private generateMeetingAlternativeResponse(name: string, tone: SuggestedResponse['tone']): string {
    const greeting = tone === 'formal' ? `Dear ${name}` : `Hi ${name}`;

    return `${greeting},\n\nThank you for the meeting request. Unfortunately, the proposed time doesn't work for me. Would any of the following times work for you instead?\n\n- [Alternative 1]\n- [Alternative 2]\n\nPlease let me know what works best.\n\nBest regards`;
  }

  private generateApprovalResponse(name: string, tone: SuggestedResponse['tone']): string {
    const greeting = tone === 'formal' ? `Dear ${name}` : `Hi ${name}`;

    return `${greeting},\n\nI have reviewed the request and I am happy to approve it. Please proceed as planned.\n\nBest regards`;
  }

  private generateFollowupResponse(name: string, tone: SuggestedResponse['tone']): string {
    const greeting = tone === 'formal' ? `Dear ${name}` : `Hi ${name}`;

    return `${greeting},\n\nThank you for following up. Here is the current status:\n\n[Status update]\n\nI expect to have more updates by [date]. Please let me know if you need any additional information in the meantime.\n\nBest regards`;
  }

  private generateDelegateResponse(name: string, tone: SuggestedResponse['tone']): string {
    const greeting = tone === 'formal' ? `Dear ${name}` : `Hi ${name}`;

    return `${greeting},\n\nThank you for your email. I am forwarding this to [colleague name] who is better positioned to assist with this request. They will be in touch with you shortly.\n\nBest regards`;
  }

  // ==========================================================================
  // ORACLE Task Integration
  // ==========================================================================

  /**
   * Create ORACLE task from email analysis
   *
   * @param analysis - Email analysis result
   * @returns Task data for ORACLE
   */
  createTaskFromEmail(analysis: EmailAnalysis): EmailDerivedTask {
    const { email, intent, entities, actionItems, priority } = analysis;

    // Generate task title
    let title = email.subject;
    if (actionItems.length > 0 && actionItems[0].confidence > 0.7) {
      title = actionItems[0].text;
    }

    // Generate description
    const description = this.generateTaskDescription(analysis);

    // Find due date from deadlines
    const dueDate = entities.deadlines[0]?.date ||
                    actionItems.find(a => a.dueDate)?.dueDate;

    return {
      title,
      description,
      priority: priority.level,
      dueDate: dueDate || undefined,
      source: {
        type: 'email',
        emailId: email.id,
        threadId: email.threadId,
        from: email.from,
        subject: email.subject,
      },
      actionItems,
      relatedPeople: entities.people,
      relatedProjects: entities.projects,
    };
  }

  private generateTaskDescription(analysis: EmailAnalysis): string {
    const parts: string[] = [];

    // Summary
    parts.push(`**Summary:** ${analysis.summary}`);
    parts.push('');

    // From
    const from = analysis.email.from;
    parts.push(`**From:** ${from.name || ''} <${from.email}>`);
    parts.push(`**Date:** ${analysis.email.date.toISOString()}`);
    parts.push('');

    // Action items
    if (analysis.actionItems.length > 0) {
      parts.push('**Action Items:**');
      for (const item of analysis.actionItems) {
        const due = item.dueDate ? ` (Due: ${item.dueDate.toDateString()})` : '';
        parts.push(`- [ ] ${item.text}${due}`);
      }
      parts.push('');
    }

    // Key entities
    if (analysis.entities.deadlines.length > 0) {
      parts.push('**Deadlines:**');
      for (const deadline of analysis.entities.deadlines) {
        parts.push(`- ${deadline.task}: ${deadline.text}`);
      }
      parts.push('');
    }

    // Original email excerpt
    const excerpt = analysis.email.body.text.substring(0, 500);
    parts.push('**Email Excerpt:**');
    parts.push(`> ${excerpt}${analysis.email.body.text.length > 500 ? '...' : ''}`);

    return parts.join('\n');
  }

  /**
   * Create task mapping between email and ORACLE task
   *
   * @param emailId - Email ID
   * @param oracleTaskId - ORACLE task ID
   * @param actionItemIds - Associated action item IDs
   * @param threadId - Optional thread ID
   * @returns Task mapping
   */
  createTaskMapping(
    emailId: string,
    oracleTaskId: string,
    actionItemIds: string[],
    threadId?: string
  ): EmailToTaskMapping {
    return {
      emailId,
      threadId,
      oracleTaskId,
      createdAt: new Date(),
      actionItemIds,
      syncStatus: 'synced',
    };
  }

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  private getContext(text: string, index: number, windowSize: number = 100): string {
    const start = Math.max(0, index - windowSize);
    const end = Math.min(text.length, index + windowSize);
    return text.substring(start, end);
  }

  private isCommonWord(word: string): boolean {
    const common = new Set(['the', 'and', 'for', 'with', 'this', 'that', 'from', 'have', 'been', 'will', 'would', 'could', 'should', 'about', 'which', 'their', 'there', 'where', 'when', 'what', 'your', 'please', 'thanks', 'thank', 'best', 'regards']);
    return common.has(word.toLowerCase());
  }

  private deduplicateByField<T extends Record<string, any>>(items: T[], field: keyof T): T[] {
    const seen = new Set<string>();
    return items.filter(item => {
      const value = String(item[field]).toLowerCase();
      if (seen.has(value)) return false;
      seen.add(value);
      return true;
    });
  }

  /**
   * Update configuration
   *
   * @param config - Partial configuration to merge
   */
  updateConfig(config: Partial<NlpConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): NlpConfig {
    return { ...this.config };
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create an EmailNlpService instance
 *
 * @param config - Optional NLP configuration
 * @returns Configured service instance
 */
export function createEmailNlpService(config?: Partial<NlpConfig>): EmailNlpService {
  return new EmailNlpService(config);
}

export default EmailNlpService;
