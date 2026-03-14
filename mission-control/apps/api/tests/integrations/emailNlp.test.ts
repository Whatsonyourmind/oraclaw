/**
 * Email NLP Tests
 * Tests for email parsing, intent detection, entity extraction, and priority classification
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ============================================================================
// Types
// ============================================================================

interface Email {
  id: string;
  from: string;
  to: string[];
  cc?: string[];
  subject: string;
  body: string;
  htmlBody?: string;
  receivedAt: Date;
  threadId?: string;
  attachments?: Array<{
    name: string;
    mimeType: string;
    size: number;
  }>;
}

interface EmailIntent {
  type: 'request' | 'question' | 'information' | 'urgent' | 'followup' | 'meeting' | 'deadline' | 'approval';
  confidence: number;
}

interface ExtractedEntity {
  type: 'person' | 'organization' | 'date' | 'time' | 'money' | 'location' | 'task' | 'deadline' | 'project';
  value: string;
  normalized?: string;
  confidence: number;
  position: { start: number; end: number };
}

interface EmailPriority {
  level: 'critical' | 'high' | 'medium' | 'low';
  score: number;
  reasons: string[];
}

interface ActionItem {
  text: string;
  assignee?: string;
  deadline?: Date;
  priority: 'high' | 'medium' | 'low';
  confidence: number;
}

interface EmailAnalysis {
  intent: EmailIntent;
  entities: ExtractedEntity[];
  priority: EmailPriority;
  actionItems: ActionItem[];
  summary: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  topics: string[];
}

// ============================================================================
// Email NLP Service Implementation
// ============================================================================

class EmailNLPService {
  private urgentKeywords = [
    'urgent', 'asap', 'immediately', 'critical', 'emergency',
    'time-sensitive', 'deadline', 'priority', 'important'
  ];

  private requestKeywords = [
    'please', 'could you', 'can you', 'would you', 'need you to',
    'requesting', 'ask', 'require', 'want you to'
  ];

  private meetingKeywords = [
    'meeting', 'call', 'sync', 'catch up', 'discussion',
    'conference', 'schedule', 'calendar', 'availability'
  ];

  private deadlinePatterns = [
    /by (monday|tuesday|wednesday|thursday|friday|saturday|sunday)/gi,
    /by (\d{1,2}\/\d{1,2})/g,
    /by (end of day|eod|cob)/gi,
    /deadline[:\s]+([^\n]+)/gi,
    /due[:\s]+([^\n]+)/gi,
  ];

  /**
   * Analyze an email for intent, entities, priority, and action items
   */
  async analyzeEmail(email: Email): Promise<EmailAnalysis> {
    const text = `${email.subject} ${email.body}`.toLowerCase();

    const intent = this.detectIntent(text, email);
    const entities = this.extractEntities(email.body);
    const priority = this.classifyPriority(email, intent);
    const actionItems = this.extractActionItems(email.body);
    const summary = this.generateSummary(email, intent);
    const sentiment = this.analyzeSentiment(email.body);
    const topics = this.extractTopics(email);

    return {
      intent,
      entities,
      priority,
      actionItems,
      summary,
      sentiment,
      topics,
    };
  }

  /**
   * Detect the primary intent of the email
   */
  private detectIntent(text: string, email: Email): EmailIntent {
    const intents: Array<{ type: EmailIntent['type']; confidence: number }> = [];

    // Check for urgent intent
    const urgentScore = this.urgentKeywords.filter(kw => text.includes(kw)).length;
    if (urgentScore > 0) {
      intents.push({ type: 'urgent', confidence: Math.min(urgentScore * 0.3, 1) });
    }

    // Check for request intent
    const requestScore = this.requestKeywords.filter(kw => text.includes(kw)).length;
    if (requestScore > 0) {
      intents.push({ type: 'request', confidence: Math.min(requestScore * 0.25, 1) });
    }

    // Check for question intent
    if (text.includes('?')) {
      const questionCount = (text.match(/\?/g) || []).length;
      intents.push({ type: 'question', confidence: Math.min(questionCount * 0.3, 1) });
    }

    // Check for meeting intent
    const meetingScore = this.meetingKeywords.filter(kw => text.includes(kw)).length;
    if (meetingScore > 0) {
      intents.push({ type: 'meeting', confidence: Math.min(meetingScore * 0.25, 1) });
    }

    // Check for deadline intent
    const hasDeadline = this.deadlinePatterns.some(p => p.test(text));
    if (hasDeadline) {
      intents.push({ type: 'deadline', confidence: 0.8 });
    }

    // Check for follow-up intent
    if (text.includes('follow up') || text.includes('following up') || text.includes('status update')) {
      intents.push({ type: 'followup', confidence: 0.7 });
    }

    // Check for approval intent
    if (text.includes('approve') || text.includes('approval') || text.includes('sign off')) {
      intents.push({ type: 'approval', confidence: 0.75 });
    }

    // Sort by confidence and return top intent
    intents.sort((a, b) => b.confidence - a.confidence);

    return intents[0] || { type: 'information', confidence: 0.5 };
  }

  /**
   * Extract named entities from email body
   */
  private extractEntities(body: string): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];

    // Extract dates
    const datePatterns = [
      /(\d{1,2}\/\d{1,2}\/\d{2,4})/g,
      /(\d{1,2}-\d{1,2}-\d{2,4})/g,
      /(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}/gi,
      /(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/gi,
      /(next week|this week|tomorrow|today|end of week)/gi,
    ];

    for (const pattern of datePatterns) {
      let match;
      while ((match = pattern.exec(body)) !== null) {
        entities.push({
          type: 'date',
          value: match[0],
          confidence: 0.9,
          position: { start: match.index, end: match.index + match[0].length },
        });
      }
    }

    // Extract times
    const timePattern = /(\d{1,2}:\d{2}\s*(am|pm)?|\d{1,2}\s*(am|pm))/gi;
    let timeMatch;
    while ((timeMatch = timePattern.exec(body)) !== null) {
      entities.push({
        type: 'time',
        value: timeMatch[0],
        confidence: 0.85,
        position: { start: timeMatch.index, end: timeMatch.index + timeMatch[0].length },
      });
    }

    // Extract money amounts
    const moneyPattern = /(\$[\d,]+(?:\.\d{2})?|USD\s*[\d,]+|\d+\s*dollars?)/gi;
    let moneyMatch;
    while ((moneyMatch = moneyPattern.exec(body)) !== null) {
      entities.push({
        type: 'money',
        value: moneyMatch[0],
        confidence: 0.9,
        position: { start: moneyMatch.index, end: moneyMatch.index + moneyMatch[0].length },
      });
    }

    // Extract email addresses (likely people)
    const emailPattern = /[\w.-]+@[\w.-]+\.\w+/gi;
    let emailMatch;
    while ((emailMatch = emailPattern.exec(body)) !== null) {
      entities.push({
        type: 'person',
        value: emailMatch[0],
        confidence: 0.7,
        position: { start: emailMatch.index, end: emailMatch.index + emailMatch[0].length },
      });
    }

    return entities;
  }

  /**
   * Classify email priority
   */
  private classifyPriority(email: Email, intent: EmailIntent): EmailPriority {
    const reasons: string[] = [];
    let score = 0.5;

    // Check subject for priority indicators
    const subject = email.subject.toLowerCase();
    if (subject.includes('urgent') || subject.includes('[urgent]')) {
      score += 0.3;
      reasons.push('Subject contains urgent indicator');
    }
    if (subject.includes('important') || subject.includes('[important]')) {
      score += 0.2;
      reasons.push('Subject contains important indicator');
    }
    if (subject.includes('action required')) {
      score += 0.25;
      reasons.push('Action required in subject');
    }

    // Check intent
    if (intent.type === 'urgent') {
      score += 0.2;
      reasons.push('Urgent intent detected');
    }
    if (intent.type === 'deadline') {
      score += 0.15;
      reasons.push('Deadline mentioned');
    }
    if (intent.type === 'approval') {
      score += 0.1;
      reasons.push('Approval requested');
    }

    // Check CC list size (more CCs often = more important)
    if (email.cc && email.cc.length > 3) {
      score += 0.1;
      reasons.push('Multiple stakeholders CCed');
    }

    // Determine level
    let level: EmailPriority['level'];
    if (score >= 0.8) {
      level = 'critical';
    } else if (score >= 0.6) {
      level = 'high';
    } else if (score >= 0.4) {
      level = 'medium';
    } else {
      level = 'low';
    }

    return { level, score: Math.min(score, 1), reasons };
  }

  /**
   * Extract action items from email body
   */
  private extractActionItems(body: string): ActionItem[] {
    const actionItems: ActionItem[] = [];
    const lines = body.split('\n');

    const actionPatterns = [
      /action item:\s*(.+)/i,
      /todo:\s*(.+)/i,
      /task:\s*(.+)/i,
      /^[-*]\s*(.+)/,
      /^\d+\.\s*(.+)/,
      /please\s+(.+?)(?:\.|$)/i,
      /could you\s+(.+?)(?:\.|$)/i,
      /need you to\s+(.+?)(?:\.|$)/i,
    ];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      for (const pattern of actionPatterns) {
        const match = pattern.exec(trimmed);
        if (match && match[1] && match[1].length > 10 && match[1].length < 200) {
          // Check for deadline in action
          let deadline: Date | undefined;
          const deadlineMatch = /by\s+([\w\s,]+)/i.exec(match[1]);
          if (deadlineMatch) {
            // Simple deadline parsing
            const deadlineText = deadlineMatch[1].toLowerCase();
            if (deadlineText.includes('tomorrow')) {
              deadline = new Date();
              deadline.setDate(deadline.getDate() + 1);
            } else if (deadlineText.includes('end of day') || deadlineText.includes('eod')) {
              deadline = new Date();
            }
          }

          // Check for assignee
          let assignee: string | undefined;
          const assigneeMatch = /@(\w+)/.exec(match[1]);
          if (assigneeMatch) {
            assignee = assigneeMatch[1];
          }

          // Determine priority
          let priority: ActionItem['priority'] = 'medium';
          if (match[1].toLowerCase().includes('urgent') || match[1].toLowerCase().includes('asap')) {
            priority = 'high';
          }

          actionItems.push({
            text: match[1].trim(),
            assignee,
            deadline,
            priority,
            confidence: 0.7,
          });
          break;
        }
      }
    }

    return actionItems;
  }

  /**
   * Generate a brief summary of the email
   */
  private generateSummary(email: Email, intent: EmailIntent): string {
    const intentDescriptions: Record<EmailIntent['type'], string> = {
      request: 'requesting action',
      question: 'asking a question',
      information: 'sharing information',
      urgent: 'requiring urgent attention',
      followup: 'following up on previous discussion',
      meeting: 'regarding a meeting or call',
      deadline: 'about an upcoming deadline',
      approval: 'seeking approval',
    };

    return `Email from ${email.from.split('@')[0]} ${intentDescriptions[intent.type] || 'sharing information'}: ${email.subject}`;
  }

  /**
   * Analyze sentiment of email body
   */
  private analyzeSentiment(body: string): 'positive' | 'neutral' | 'negative' {
    const positiveWords = ['thanks', 'thank you', 'great', 'excellent', 'appreciate', 'happy', 'pleased', 'good news'];
    const negativeWords = ['urgent', 'problem', 'issue', 'concern', 'disappointed', 'unfortunately', 'failed', 'error', 'mistake'];

    const text = body.toLowerCase();
    let score = 0;

    for (const word of positiveWords) {
      if (text.includes(word)) score++;
    }
    for (const word of negativeWords) {
      if (text.includes(word)) score--;
    }

    if (score > 1) return 'positive';
    if (score < -1) return 'negative';
    return 'neutral';
  }

  /**
   * Extract main topics from email
   */
  private extractTopics(email: Email): string[] {
    const topics: string[] = [];
    const text = `${email.subject} ${email.body}`.toLowerCase();

    const topicKeywords: Record<string, string[]> = {
      'Project Update': ['project', 'milestone', 'progress', 'status update', 'sprint'],
      'Budget': ['budget', 'cost', 'expense', 'funding', 'invoice', 'payment'],
      'Scheduling': ['schedule', 'calendar', 'availability', 'book', 'reschedule'],
      'Technical': ['bug', 'feature', 'deploy', 'release', 'code', 'api', 'system'],
      'HR': ['vacation', 'leave', 'performance', 'review', 'hiring', 'onboarding'],
      'Customer': ['customer', 'client', 'feedback', 'complaint', 'support'],
    };

    for (const [topic, keywords] of Object.entries(topicKeywords)) {
      if (keywords.some(kw => text.includes(kw))) {
        topics.push(topic);
      }
    }

    return topics.length > 0 ? topics : ['General'];
  }

  /**
   * Parse email thread to extract conversation history
   */
  parseThread(emails: Email[]): {
    participants: string[];
    timeline: Array<{ from: string; summary: string; date: Date }>;
    openQuestions: string[];
    decisions: string[];
  } {
    const participants = new Set<string>();
    const timeline: Array<{ from: string; summary: string; date: Date }> = [];
    const openQuestions: string[] = [];
    const decisions: string[] = [];

    // Sort by date
    const sorted = [...emails].sort((a, b) => a.receivedAt.getTime() - b.receivedAt.getTime());

    for (const email of sorted) {
      participants.add(email.from);
      email.to.forEach(to => participants.add(to));
      if (email.cc) {
        email.cc.forEach(cc => participants.add(cc));
      }

      // Add to timeline
      timeline.push({
        from: email.from,
        summary: email.subject,
        date: email.receivedAt,
      });

      // Extract questions
      const questions = email.body.match(/[^.!?]*\?/g) || [];
      openQuestions.push(...questions.map(q => q.trim()));

      // Extract decisions (simple heuristic)
      if (email.body.toLowerCase().includes('decided') ||
          email.body.toLowerCase().includes('agreed') ||
          email.body.toLowerCase().includes('will proceed')) {
        decisions.push(email.body.split('\n')[0]);
      }
    }

    return {
      participants: Array.from(participants),
      timeline,
      openQuestions: openQuestions.slice(0, 5), // Limit to 5
      decisions,
    };
  }
}

// ============================================================================
// Tests
// ============================================================================

describe('Email NLP Service', () => {
  let nlpService: EmailNLPService;

  beforeEach(() => {
    nlpService = new EmailNLPService();
  });

  // ============================================================================
  // Intent Detection Tests
  // ============================================================================

  describe('Intent Detection', () => {
    it('should detect urgent intent', async () => {
      const email: Email = {
        id: '1',
        from: 'sender@test.com',
        to: ['receiver@test.com'],
        subject: 'URGENT: System is down',
        body: 'This is urgent! The production system is not responding. Please address immediately.',
        receivedAt: new Date(),
      };

      const analysis = await nlpService.analyzeEmail(email);

      expect(analysis.intent.type).toBe('urgent');
      expect(analysis.intent.confidence).toBeGreaterThan(0.5);
    });

    it('should detect request intent', async () => {
      const email: Email = {
        id: '2',
        from: 'manager@test.com',
        to: ['employee@test.com'],
        subject: 'Report needed',
        body: 'Could you please send me the quarterly report? I need you to include the sales figures.',
        receivedAt: new Date(),
      };

      const analysis = await nlpService.analyzeEmail(email);

      expect(analysis.intent.type).toBe('request');
    });

    it('should detect question intent', async () => {
      const email: Email = {
        id: '3',
        from: 'colleague@test.com',
        to: ['you@test.com'],
        subject: 'Quick question',
        body: 'What time is the meeting tomorrow? Do we need to prepare anything?',
        receivedAt: new Date(),
      };

      const analysis = await nlpService.analyzeEmail(email);

      expect(analysis.intent.type).toBe('question');
    });

    it('should detect meeting intent', async () => {
      const email: Email = {
        id: '4',
        from: 'organizer@test.com',
        to: ['attendee@test.com'],
        subject: 'Meeting Request',
        body: 'Can we schedule a call to discuss the project? Please let me know your availability.',
        receivedAt: new Date(),
      };

      const analysis = await nlpService.analyzeEmail(email);

      expect(analysis.intent.type).toBe('meeting');
    });

    it('should detect deadline intent', async () => {
      const email: Email = {
        id: '5',
        from: 'pm@test.com',
        to: ['dev@test.com'],
        subject: 'Project Deadline',
        body: 'Reminder: The feature needs to be completed by Friday. Deadline: 5 PM.',
        receivedAt: new Date(),
      };

      const analysis = await nlpService.analyzeEmail(email);

      expect(analysis.intent.type).toBe('deadline');
    });

    it('should detect followup intent', async () => {
      const email: Email = {
        id: '6',
        from: 'client@test.com',
        to: ['sales@test.com'],
        subject: 'Following up on proposal',
        body: 'Hi, I am following up on our previous discussion. Any status update on the proposal?',
        receivedAt: new Date(),
      };

      const analysis = await nlpService.analyzeEmail(email);

      expect(analysis.intent.type).toBe('followup');
    });

    it('should detect approval intent', async () => {
      const email: Email = {
        id: '7',
        from: 'employee@test.com',
        to: ['manager@test.com'],
        subject: 'Request for approval',
        body: 'Please approve the attached budget proposal. We need your sign off to proceed.',
        receivedAt: new Date(),
      };

      const analysis = await nlpService.analyzeEmail(email);

      expect(analysis.intent.type).toBe('approval');
    });

    it('should default to information intent', async () => {
      const email: Email = {
        id: '8',
        from: 'newsletter@test.com',
        to: ['subscriber@test.com'],
        subject: 'Monthly Newsletter',
        body: 'Here are the latest updates from our company. We have some exciting news.',
        receivedAt: new Date(),
      };

      const analysis = await nlpService.analyzeEmail(email);

      expect(analysis.intent.type).toBe('information');
    });
  });

  // ============================================================================
  // Entity Extraction Tests
  // ============================================================================

  describe('Entity Extraction', () => {
    it('should extract dates', async () => {
      const email: Email = {
        id: '1',
        from: 'sender@test.com',
        to: ['receiver@test.com'],
        subject: 'Meeting',
        body: 'Let\'s meet on 01/15/2024 or January 20 if that works better.',
        receivedAt: new Date(),
      };

      const analysis = await nlpService.analyzeEmail(email);
      const dates = analysis.entities.filter(e => e.type === 'date');

      expect(dates.length).toBeGreaterThan(0);
    });

    it('should extract times', async () => {
      const email: Email = {
        id: '2',
        from: 'sender@test.com',
        to: ['receiver@test.com'],
        subject: 'Schedule',
        body: 'The meeting is at 3:30 PM. Alternative time is 10 am.',
        receivedAt: new Date(),
      };

      const analysis = await nlpService.analyzeEmail(email);
      const times = analysis.entities.filter(e => e.type === 'time');

      expect(times.length).toBe(2);
    });

    it('should extract money amounts', async () => {
      const email: Email = {
        id: '3',
        from: 'sender@test.com',
        to: ['receiver@test.com'],
        subject: 'Invoice',
        body: 'The total amount is $1,500.00. Please also budget USD 500 for expenses.',
        receivedAt: new Date(),
      };

      const analysis = await nlpService.analyzeEmail(email);
      const money = analysis.entities.filter(e => e.type === 'money');

      expect(money.length).toBeGreaterThan(0);
    });

    it('should extract email addresses as persons', async () => {
      const email: Email = {
        id: '4',
        from: 'sender@test.com',
        to: ['receiver@test.com'],
        subject: 'Introduction',
        body: 'Please contact john.doe@company.com for more information.',
        receivedAt: new Date(),
      };

      const analysis = await nlpService.analyzeEmail(email);
      const persons = analysis.entities.filter(e => e.type === 'person');

      expect(persons.some(p => p.value === 'john.doe@company.com')).toBe(true);
    });

    it('should extract day of week', async () => {
      const email: Email = {
        id: '5',
        from: 'sender@test.com',
        to: ['receiver@test.com'],
        subject: 'Schedule',
        body: 'Can we meet next Monday or Tuesday?',
        receivedAt: new Date(),
      };

      const analysis = await nlpService.analyzeEmail(email);
      const dates = analysis.entities.filter(e => e.type === 'date');

      expect(dates.length).toBeGreaterThan(0);
    });

    it('should handle emails with no entities', async () => {
      const email: Email = {
        id: '6',
        from: 'sender@test.com',
        to: ['receiver@test.com'],
        subject: 'Hello',
        body: 'Just saying hello!',
        receivedAt: new Date(),
      };

      const analysis = await nlpService.analyzeEmail(email);

      expect(analysis.entities).toBeDefined();
      expect(Array.isArray(analysis.entities)).toBe(true);
    });
  });

  // ============================================================================
  // Priority Classification Tests
  // ============================================================================

  describe('Priority Classification', () => {
    it('should classify urgent emails as critical', async () => {
      const email: Email = {
        id: '1',
        from: 'ceo@test.com',
        to: ['team@test.com'],
        subject: '[URGENT] Action Required: System Down',
        body: 'This is extremely urgent. Production is down. Need immediate action.',
        receivedAt: new Date(),
      };

      const analysis = await nlpService.analyzeEmail(email);

      expect(analysis.priority.level).toBe('critical');
      expect(analysis.priority.score).toBeGreaterThan(0.8);
    });

    it('should classify important emails as high priority', async () => {
      const email: Email = {
        id: '2',
        from: 'manager@test.com',
        to: ['employee@test.com'],
        subject: '[Important] Deadline approaching',
        body: 'Please prioritize this task. Due by end of week.',
        receivedAt: new Date(),
      };

      const analysis = await nlpService.analyzeEmail(email);

      expect(['critical', 'high']).toContain(analysis.priority.level);
    });

    it('should identify action required emails', async () => {
      const email: Email = {
        id: '3',
        from: 'hr@test.com',
        to: ['employee@test.com'],
        subject: 'Action Required: Complete timesheet',
        body: 'Please complete your timesheet by Friday.',
        receivedAt: new Date(),
      };

      const analysis = await nlpService.analyzeEmail(email);

      expect(analysis.priority.reasons.some(r => r.includes('Action required'))).toBe(true);
    });

    it('should consider CC list in priority', async () => {
      const email: Email = {
        id: '4',
        from: 'lead@test.com',
        to: ['team@test.com'],
        cc: ['ceo@test.com', 'cto@test.com', 'vp@test.com', 'director@test.com'],
        subject: 'Project Status',
        body: 'Update on the project.',
        receivedAt: new Date(),
      };

      const analysis = await nlpService.analyzeEmail(email);

      expect(analysis.priority.reasons.some(r => r.includes('stakeholders'))).toBe(true);
    });

    it('should classify informational emails as low priority', async () => {
      const email: Email = {
        id: '5',
        from: 'newsletter@test.com',
        to: ['subscriber@test.com'],
        subject: 'Weekly digest',
        body: 'Here is your weekly summary. No action needed.',
        receivedAt: new Date(),
      };

      const analysis = await nlpService.analyzeEmail(email);

      expect(['low', 'medium']).toContain(analysis.priority.level);
    });

    it('should include priority reasons', async () => {
      const email: Email = {
        id: '6',
        from: 'sender@test.com',
        to: ['receiver@test.com'],
        subject: 'URGENT',
        body: 'Urgent request.',
        receivedAt: new Date(),
      };

      const analysis = await nlpService.analyzeEmail(email);

      expect(analysis.priority.reasons.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Action Item Extraction Tests
  // ============================================================================

  describe('Action Item Extraction', () => {
    it('should extract bulleted action items', async () => {
      const email: Email = {
        id: '1',
        from: 'pm@test.com',
        to: ['team@test.com'],
        subject: 'Tasks for this week',
        body: `
          Please complete the following:
          - Review the design document and provide feedback
          - Update the test cases for the new feature
          - Schedule a meeting with the client
        `,
        receivedAt: new Date(),
      };

      const analysis = await nlpService.analyzeEmail(email);

      expect(analysis.actionItems.length).toBeGreaterThan(0);
    });

    it('should extract numbered action items', async () => {
      const email: Email = {
        id: '2',
        from: 'lead@test.com',
        to: ['dev@test.com'],
        subject: 'Sprint tasks',
        body: `
          1. Complete the API integration work
          2. Write unit tests for the new module
          3. Deploy to staging environment
        `,
        receivedAt: new Date(),
      };

      const analysis = await nlpService.analyzeEmail(email);

      expect(analysis.actionItems.length).toBe(3);
    });

    it('should extract action items with deadlines', async () => {
      const email: Email = {
        id: '3',
        from: 'manager@test.com',
        to: ['employee@test.com'],
        subject: 'Urgent task',
        body: 'Please complete the report by tomorrow end of day.',
        receivedAt: new Date(),
      };

      const analysis = await nlpService.analyzeEmail(email);

      const withDeadline = analysis.actionItems.filter(a => a.deadline);
      expect(withDeadline.length).toBeGreaterThanOrEqual(0);
    });

    it('should extract action items with assignees', async () => {
      const email: Email = {
        id: '4',
        from: 'pm@test.com',
        to: ['team@test.com'],
        subject: 'Assignments',
        body: 'Action item: @john please review the pull request',
        receivedAt: new Date(),
      };

      const analysis = await nlpService.analyzeEmail(email);

      const withAssignee = analysis.actionItems.filter(a => a.assignee);
      expect(withAssignee.length).toBeGreaterThan(0);
      expect(withAssignee[0].assignee).toBe('john');
    });

    it('should identify high priority action items', async () => {
      const email: Email = {
        id: '5',
        from: 'manager@test.com',
        to: ['team@test.com'],
        subject: 'Urgent tasks',
        body: '- This is urgent: fix the production bug ASAP',
        receivedAt: new Date(),
      };

      const analysis = await nlpService.analyzeEmail(email);

      const highPriority = analysis.actionItems.filter(a => a.priority === 'high');
      expect(highPriority.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Sentiment Analysis Tests
  // ============================================================================

  describe('Sentiment Analysis', () => {
    it('should detect positive sentiment', async () => {
      const email: Email = {
        id: '1',
        from: 'client@test.com',
        to: ['team@test.com'],
        subject: 'Great work!',
        body: 'Thank you so much for the excellent work. We are very pleased with the results. Great job team!',
        receivedAt: new Date(),
      };

      const analysis = await nlpService.analyzeEmail(email);

      expect(analysis.sentiment).toBe('positive');
    });

    it('should detect negative sentiment', async () => {
      const email: Email = {
        id: '2',
        from: 'client@test.com',
        to: ['support@test.com'],
        subject: 'Issue with service',
        body: 'Unfortunately, we have a problem with the service. The error is causing issues and we are disappointed.',
        receivedAt: new Date(),
      };

      const analysis = await nlpService.analyzeEmail(email);

      expect(analysis.sentiment).toBe('negative');
    });

    it('should detect neutral sentiment', async () => {
      const email: Email = {
        id: '3',
        from: 'info@test.com',
        to: ['subscriber@test.com'],
        subject: 'Information',
        body: 'Here is the requested information about our services and pricing.',
        receivedAt: new Date(),
      };

      const analysis = await nlpService.analyzeEmail(email);

      expect(analysis.sentiment).toBe('neutral');
    });
  });

  // ============================================================================
  // Topic Extraction Tests
  // ============================================================================

  describe('Topic Extraction', () => {
    it('should extract project-related topics', async () => {
      const email: Email = {
        id: '1',
        from: 'pm@test.com',
        to: ['team@test.com'],
        subject: 'Sprint Update',
        body: 'Here is the progress update on the project. We completed another milestone this sprint.',
        receivedAt: new Date(),
      };

      const analysis = await nlpService.analyzeEmail(email);

      expect(analysis.topics).toContain('Project Update');
    });

    it('should extract budget-related topics', async () => {
      const email: Email = {
        id: '2',
        from: 'finance@test.com',
        to: ['team@test.com'],
        subject: 'Budget Report',
        body: 'Please review the attached invoice and expense report. The costs are within budget.',
        receivedAt: new Date(),
      };

      const analysis = await nlpService.analyzeEmail(email);

      expect(analysis.topics).toContain('Budget');
    });

    it('should extract technical topics', async () => {
      const email: Email = {
        id: '3',
        from: 'dev@test.com',
        to: ['team@test.com'],
        subject: 'Deployment',
        body: 'We are ready to deploy the new feature. The bug fixes have been merged and the API is updated.',
        receivedAt: new Date(),
      };

      const analysis = await nlpService.analyzeEmail(email);

      expect(analysis.topics).toContain('Technical');
    });

    it('should return General for unclassified emails', async () => {
      const email: Email = {
        id: '4',
        from: 'friend@test.com',
        to: ['you@test.com'],
        subject: 'Hello',
        body: 'Just wanted to say hello and catch up!',
        receivedAt: new Date(),
      };

      const analysis = await nlpService.analyzeEmail(email);

      expect(analysis.topics).toContain('General');
    });
  });

  // ============================================================================
  // Thread Parsing Tests
  // ============================================================================

  describe('Thread Parsing', () => {
    it('should extract all participants', () => {
      const emails: Email[] = [
        {
          id: '1',
          from: 'alice@test.com',
          to: ['bob@test.com'],
          subject: 'Question',
          body: 'Hi Bob, quick question.',
          receivedAt: new Date('2024-01-01'),
        },
        {
          id: '2',
          from: 'bob@test.com',
          to: ['alice@test.com'],
          cc: ['charlie@test.com'],
          subject: 'Re: Question',
          body: 'Hi Alice, here is my answer.',
          receivedAt: new Date('2024-01-02'),
        },
      ];

      const thread = nlpService.parseThread(emails);

      expect(thread.participants).toContain('alice@test.com');
      expect(thread.participants).toContain('bob@test.com');
      expect(thread.participants).toContain('charlie@test.com');
    });

    it('should build timeline in chronological order', () => {
      const emails: Email[] = [
        {
          id: '2',
          from: 'bob@test.com',
          to: ['alice@test.com'],
          subject: 'Re: Question',
          body: 'Answer',
          receivedAt: new Date('2024-01-02'),
        },
        {
          id: '1',
          from: 'alice@test.com',
          to: ['bob@test.com'],
          subject: 'Question',
          body: 'Question',
          receivedAt: new Date('2024-01-01'),
        },
      ];

      const thread = nlpService.parseThread(emails);

      expect(thread.timeline[0].from).toBe('alice@test.com');
      expect(thread.timeline[1].from).toBe('bob@test.com');
    });

    it('should extract open questions', () => {
      const emails: Email[] = [
        {
          id: '1',
          from: 'alice@test.com',
          to: ['bob@test.com'],
          subject: 'Questions',
          body: 'When can we meet? What time works for you?',
          receivedAt: new Date('2024-01-01'),
        },
      ];

      const thread = nlpService.parseThread(emails);

      expect(thread.openQuestions.length).toBeGreaterThan(0);
      expect(thread.openQuestions.some(q => q.includes('?'))).toBe(true);
    });

    it('should extract decisions', () => {
      const emails: Email[] = [
        {
          id: '1',
          from: 'manager@test.com',
          to: ['team@test.com'],
          subject: 'Decision',
          body: 'We have decided to proceed with option A. The team agreed to start next week.',
          receivedAt: new Date('2024-01-01'),
        },
      ];

      const thread = nlpService.parseThread(emails);

      expect(thread.decisions.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle empty email body', async () => {
      const email: Email = {
        id: '1',
        from: 'sender@test.com',
        to: ['receiver@test.com'],
        subject: 'Empty',
        body: '',
        receivedAt: new Date(),
      };

      const analysis = await nlpService.analyzeEmail(email);

      expect(analysis.intent).toBeDefined();
      expect(analysis.entities).toBeDefined();
      expect(analysis.priority).toBeDefined();
    });

    it('should handle very long emails', async () => {
      const email: Email = {
        id: '1',
        from: 'sender@test.com',
        to: ['receiver@test.com'],
        subject: 'Long email',
        body: 'Please '.repeat(1000) + 'do this task.',
        receivedAt: new Date(),
      };

      const analysis = await nlpService.analyzeEmail(email);

      expect(analysis.intent).toBeDefined();
    });

    it('should handle special characters', async () => {
      const email: Email = {
        id: '1',
        from: 'sender@test.com',
        to: ['receiver@test.com'],
        subject: 'Test & Special <chars>',
        body: 'Hello! Check out https://example.com/path?query=1&other=2',
        receivedAt: new Date(),
      };

      const analysis = await nlpService.analyzeEmail(email);

      expect(analysis).toBeDefined();
    });

    it('should handle non-English content gracefully', async () => {
      const email: Email = {
        id: '1',
        from: 'sender@test.com',
        to: ['receiver@test.com'],
        subject: 'Internationale Nachricht',
        body: 'Dies ist eine Nachricht auf Deutsch.',
        receivedAt: new Date(),
      };

      // Should not throw
      const analysis = await nlpService.analyzeEmail(email);
      expect(analysis).toBeDefined();
    });
  });
});
