/**
 * ORACLE Natural Language Query Service
 * Story adv-24 - Natural language query understanding
 */

import { oracleCacheService, cacheKey, hashObject } from './cache';

// Query types
export type QueryType = 'status' | 'predictions' | 'recommendations' | 'history' | 'analytics' | 'decisions' | 'signals' | 'unknown';

// Query intent
export interface QueryIntent {
  type: QueryType;
  confidence: number;
  entities: Record<string, string>;
  timeRange?: { start: string; end: string };
  filters?: Record<string, any>;
}

// Query result
export interface QueryResult {
  intent: QueryIntent;
  answer: string;
  data?: any;
  suggestions?: string[];
  confidence: number;
  sources?: Array<{ type: string; id: string; relevance: number }>;
}

// Conversation context
export interface ConversationContext {
  id: string;
  user_id: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
    query_result?: QueryResult;
  }>;
  entities: Record<string, string>; // Accumulated entities from conversation
  last_intent?: QueryIntent;
  created_at: string;
  updated_at: string;
}

// Query patterns for intent classification
const INTENT_PATTERNS: Array<{ patterns: RegExp[]; type: QueryType }> = [
  {
    type: 'status',
    patterns: [
      /\b(status|current state|what's happening|overview|dashboard)\b/i,
      /\bwhat is the (current|latest) (status|state|situation)\b/i,
      /\bhow('s| is) (it going|everything|the system)\b/i,
    ],
  },
  {
    type: 'predictions',
    patterns: [
      /\b(predict|forecast|what will|likelihood|probability|chance)\b/i,
      /\bwhat are the (chances|odds|predictions)\b/i,
      /\b(will|should) .+ (happen|succeed|fail|work)\b/i,
    ],
  },
  {
    type: 'recommendations',
    patterns: [
      /\b(recommend|suggest|advise|should I|what should)\b/i,
      /\bwhat (do you|would you) (recommend|suggest)\b/i,
      /\bbest (option|approach|way|course of action)\b/i,
    ],
  },
  {
    type: 'history',
    patterns: [
      /\b(history|past|previous|yesterday|last week|earlier|before)\b/i,
      /\bwhat (happened|occurred|did I do)\b/i,
      /\bshow me (the|my) (history|past|previous)\b/i,
    ],
  },
  {
    type: 'analytics',
    patterns: [
      /\b(analytics|metrics|statistics|numbers|performance)\b/i,
      /\bhow (many|much|well|often)\b/i,
      /\b(average|total|count|percentage|rate)\b/i,
    ],
  },
  {
    type: 'decisions',
    patterns: [
      /\b(decision|decide|choice|option|alternative)\b/i,
      /\bwhat are my (options|choices|decisions)\b/i,
      /\bhelp me (decide|choose|pick)\b/i,
    ],
  },
  {
    type: 'signals',
    patterns: [
      /\b(signal|alert|warning|notification|urgent)\b/i,
      /\b(deadlines?|risks?|opportunities?|conflicts?)\b/i,
      /\bwhat (needs attention|is urgent|should I focus on)\b/i,
    ],
  },
];

// Entity extraction patterns
const ENTITY_PATTERNS: Array<{ name: string; pattern: RegExp; extract: (match: RegExpMatchArray) => string }> = [
  {
    name: 'time_period',
    pattern: /\b(today|yesterday|this week|last week|this month|last month|past (\d+) (days?|weeks?|months?))\b/i,
    extract: (m) => m[0].toLowerCase(),
  },
  {
    name: 'category',
    pattern: /\b(deadline|risk|opportunity|conflict|anomaly|signal|decision|prediction)\b/i,
    extract: (m) => m[1].toLowerCase(),
  },
  {
    name: 'urgency',
    pattern: /\b(critical|high|medium|low) (priority|urgency)?\b/i,
    extract: (m) => m[1].toLowerCase(),
  },
  {
    name: 'phase',
    pattern: /\b(observe|orient|decide|act) phase\b/i,
    extract: (m) => m[1].toLowerCase(),
  },
  {
    name: 'number',
    pattern: /\b(\d+)\b/,
    extract: (m) => m[1],
  },
];

// Cache TTLs
const NL_CACHE_TTL = {
  query: 60 * 1000, // 1 minute
  context: 30 * 60 * 1000, // 30 minutes
};

class NaturalLanguageService {
  // In-memory conversation contexts
  private contexts: Map<string, ConversationContext> = new Map();

  /**
   * Process a natural language query
   */
  async processQuery(
    userId: string,
    query: string,
    conversationId?: string
  ): Promise<QueryResult> {
    // Get or create conversation context
    const context = conversationId
      ? this.getContext(conversationId)
      : this.createContext(userId);

    // Add user message to context
    this.addMessage(context, 'user', query);

    // Parse intent
    const intent = this.parseIntent(query, context);

    // Generate response based on intent
    const result = await this.generateResponse(intent, context, userId);

    // Add assistant response to context
    this.addMessage(context, 'assistant', result.answer, result);

    // Update context entities
    Object.assign(context.entities, intent.entities);
    context.last_intent = intent;
    context.updated_at = new Date().toISOString();

    return result;
  }

  /**
   * Parse query intent
   */
  private parseIntent(query: string, context: ConversationContext): QueryIntent {
    // Check for intent patterns
    let bestMatch: { type: QueryType; confidence: number } = { type: 'unknown', confidence: 0 };

    for (const { patterns, type } of INTENT_PATTERNS) {
      for (const pattern of patterns) {
        if (pattern.test(query)) {
          const confidence = this.calculatePatternConfidence(query, pattern);
          if (confidence > bestMatch.confidence) {
            bestMatch = { type, confidence };
          }
        }
      }
    }

    // Extract entities
    const entities = this.extractEntities(query);

    // Extract time range
    const timeRange = this.parseTimeRange(query, entities);

    // Consider context for follow-up questions
    if (bestMatch.type === 'unknown' && context.last_intent) {
      // Might be a follow-up question
      if (this.isFollowUp(query)) {
        bestMatch = {
          type: context.last_intent.type,
          confidence: 0.6,
        };
        // Inherit entities from context
        Object.assign(entities, context.entities);
      }
    }

    return {
      type: bestMatch.type,
      confidence: bestMatch.confidence,
      entities,
      timeRange,
    };
  }

  /**
   * Calculate confidence score for a pattern match
   */
  private calculatePatternConfidence(query: string, pattern: RegExp): number {
    const match = query.match(pattern);
    if (!match) return 0;

    // Higher confidence for longer matches
    const matchLength = match[0].length;
    const queryLength = query.length;
    const lengthRatio = matchLength / queryLength;

    // Base confidence of 0.7, increased by match coverage
    return Math.min(0.95, 0.7 + lengthRatio * 0.2);
  }

  /**
   * Extract entities from query
   */
  private extractEntities(query: string): Record<string, string> {
    const entities: Record<string, string> = {};

    for (const { name, pattern, extract } of ENTITY_PATTERNS) {
      const match = query.match(pattern);
      if (match) {
        entities[name] = extract(match);
      }
    }

    return entities;
  }

  /**
   * Parse time range from query
   */
  private parseTimeRange(
    query: string,
    entities: Record<string, string>
  ): { start: string; end: string } | undefined {
    const now = new Date();
    const timePeriod = entities.time_period;

    if (!timePeriod) return undefined;

    let start: Date;
    const end = now;

    if (timePeriod === 'today') {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (timePeriod === 'yesterday') {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      end.setDate(end.getDate() - 1);
    } else if (timePeriod === 'this week') {
      const dayOfWeek = now.getDay();
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek);
    } else if (timePeriod === 'last week') {
      const dayOfWeek = now.getDay();
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek - 7);
      end.setDate(end.getDate() - dayOfWeek);
    } else if (timePeriod === 'this month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (timePeriod === 'last month') {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end.setDate(0); // Last day of previous month
    } else {
      // "past X days/weeks/months"
      const match = timePeriod.match(/past (\d+) (days?|weeks?|months?)/i);
      if (match) {
        const num = parseInt(match[1], 10);
        const unit = match[2].toLowerCase();
        start = new Date(now);
        if (unit.startsWith('day')) {
          start.setDate(start.getDate() - num);
        } else if (unit.startsWith('week')) {
          start.setDate(start.getDate() - num * 7);
        } else if (unit.startsWith('month')) {
          start.setMonth(start.getMonth() - num);
        }
      } else {
        return undefined;
      }
    }

    return {
      start: start.toISOString(),
      end: end.toISOString(),
    };
  }

  /**
   * Check if query is a follow-up question
   */
  private isFollowUp(query: string): boolean {
    const followUpPatterns = [
      /^(and|also|what about|how about|tell me more|more details|explain)\b/i,
      /^(why|how|when|where|who|which)\s+/i,
      /\bmore\b/i,
      /^(yes|no|ok|sure|please)\b/i,
    ];

    return followUpPatterns.some((p) => p.test(query));
  }

  /**
   * Generate response based on intent
   */
  private async generateResponse(
    intent: QueryIntent,
    context: ConversationContext,
    userId: string
  ): Promise<QueryResult> {
    // In production, this would call the Gemini API for sophisticated responses
    // For now, we'll generate template-based responses

    let answer: string;
    let data: any;
    let suggestions: string[] = [];

    switch (intent.type) {
      case 'status':
        answer = this.generateStatusResponse(intent);
        data = {
          phase: 'observe',
          signalCount: 5,
          criticalSignals: 1,
          systemHealth: 'healthy',
        };
        suggestions = [
          'What signals need attention?',
          'Show me recent activity',
          'What decisions are pending?',
        ];
        break;

      case 'predictions':
        answer = this.generatePredictionsResponse(intent);
        data = {
          predictions: [
            { subject: 'Project deadline', probability: 0.75, trend: 'stable' },
            { subject: 'Resource availability', probability: 0.60, trend: 'declining' },
          ],
        };
        suggestions = [
          'What factors affect this prediction?',
          'How can I improve outcomes?',
          'Show historical accuracy',
        ];
        break;

      case 'recommendations':
        answer = this.generateRecommendationsResponse(intent);
        data = {
          recommendations: [
            { action: 'Address critical deadline', priority: 'high', impact: 0.8 },
            { action: 'Review team capacity', priority: 'medium', impact: 0.6 },
          ],
        };
        suggestions = [
          'Why this recommendation?',
          'What are the alternatives?',
          'What are the risks?',
        ];
        break;

      case 'history':
        answer = this.generateHistoryResponse(intent);
        data = {
          events: [
            { type: 'decision', description: 'Selected Option A', timestamp: '2h ago' },
            { type: 'signal', description: 'New deadline detected', timestamp: '4h ago' },
          ],
        };
        suggestions = [
          'Show more history',
          'Filter by type',
          'Export history',
        ];
        break;

      case 'analytics':
        answer = this.generateAnalyticsResponse(intent);
        data = {
          metrics: {
            signalsProcessed: 45,
            decisionsCompleted: 12,
            predictionAccuracy: 0.73,
            avgResponseTime: 2.3,
          },
        };
        suggestions = [
          'Show trend over time',
          'Compare to last week',
          'Breakdown by category',
        ];
        break;

      case 'decisions':
        answer = this.generateDecisionsResponse(intent);
        data = {
          pendingDecisions: 3,
          decisions: [
            { title: 'Q2 Strategy', status: 'analyzing', options: 3 },
            { title: 'Team Allocation', status: 'pending', options: 2 },
          ],
        };
        suggestions = [
          'Help me decide on Q2 Strategy',
          'What are my options?',
          'Show decision history',
        ];
        break;

      case 'signals':
        answer = this.generateSignalsResponse(intent);
        data = {
          totalSignals: 8,
          byUrgency: { critical: 1, high: 2, medium: 3, low: 2 },
          signals: [
            { title: 'Deadline approaching', urgency: 'critical', type: 'deadline' },
            { title: 'New opportunity', urgency: 'high', type: 'opportunity' },
          ],
        };
        suggestions = [
          'Show critical signals only',
          'Dismiss low priority signals',
          'What should I focus on?',
        ];
        break;

      default:
        answer = "I'm not sure I understand. Could you rephrase that? You can ask about status, predictions, recommendations, history, analytics, decisions, or signals.";
        suggestions = [
          "What's my current status?",
          'What are my pending decisions?',
          'Show me recent signals',
        ];
    }

    return {
      intent,
      answer,
      data,
      suggestions,
      confidence: intent.confidence,
      sources: [],
    };
  }

  // Response generators for each intent type
  private generateStatusResponse(intent: QueryIntent): string {
    return `Currently in the Observe phase. There are 5 active signals, including 1 critical signal that needs attention. System health is good with all services operating normally.`;
  }

  private generatePredictionsResponse(intent: QueryIntent): string {
    const category = intent.entities.category;
    if (category) {
      return `Based on current patterns, predictions for ${category} show a 75% likelihood of successful completion. This is slightly above your historical average.`;
    }
    return `Your current predictions show an overall 73% accuracy rate. Top prediction: Project deadline has 75% chance of on-time delivery.`;
  }

  private generateRecommendationsResponse(intent: QueryIntent): string {
    return `Based on your current situation, I recommend addressing the critical deadline first. This has the highest impact on your overall goals. Would you like me to create an action plan?`;
  }

  private generateHistoryResponse(intent: QueryIntent): string {
    const period = intent.entities.time_period || 'today';
    return `Here's your activity history for ${period}: 2 decisions completed, 4 signals processed, and 3 predictions verified. Your decision success rate was 100%.`;
  }

  private generateAnalyticsResponse(intent: QueryIntent): string {
    return `Your analytics show: 45 signals processed this week, 12 decisions completed with 83% success rate, and 73% prediction accuracy. This is 5% better than last week.`;
  }

  private generateDecisionsResponse(intent: QueryIntent): string {
    return `You have 3 pending decisions. The most urgent is "Q2 Strategy" which is currently being analyzed with 3 options. Would you like to review it?`;
  }

  private generateSignalsResponse(intent: QueryIntent): string {
    const urgency = intent.entities.urgency;
    if (urgency) {
      return `You have signals with ${urgency} urgency that need attention. The top one is a deadline approaching in 2 days.`;
    }
    return `There are 8 active signals: 1 critical, 2 high, 3 medium, and 2 low priority. The critical signal is about an upcoming deadline.`;
  }

  // Conversation context management
  private createContext(userId: string): ConversationContext {
    const context: ConversationContext = {
      id: crypto.randomUUID(),
      user_id: userId,
      messages: [],
      entities: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.contexts.set(context.id, context);
    return context;
  }

  private getContext(conversationId: string): ConversationContext {
    const context = this.contexts.get(conversationId);
    if (!context) {
      throw new Error('Conversation not found');
    }
    return context;
  }

  private addMessage(
    context: ConversationContext,
    role: 'user' | 'assistant',
    content: string,
    queryResult?: QueryResult
  ): void {
    context.messages.push({
      role,
      content,
      timestamp: new Date().toISOString(),
      query_result: queryResult,
    });

    // Keep only last 20 messages
    if (context.messages.length > 20) {
      context.messages = context.messages.slice(-20);
    }
  }

  /**
   * Get conversation history
   */
  getConversation(conversationId: string): ConversationContext | null {
    return this.contexts.get(conversationId) || null;
  }

  /**
   * Clear conversation
   */
  clearConversation(conversationId: string): boolean {
    return this.contexts.delete(conversationId);
  }

  /**
   * Get all conversations for user
   */
  getUserConversations(userId: string): ConversationContext[] {
    return Array.from(this.contexts.values()).filter((c) => c.user_id === userId);
  }
}

// Export singleton
export const naturalLanguageService = new NaturalLanguageService();
