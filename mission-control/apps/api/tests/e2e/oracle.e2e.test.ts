/**
 * ORACLE v2.0 End-to-End Tests
 * Tests for the complete OODA loop: Signal -> Orient -> Decide -> Act
 * Includes multi-user scenarios and full workflow integration
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';

// Mock external dependencies
jest.mock('../../src/services/oracle/cache', () => ({
  oracleCacheService: {
    get: jest.fn(() => null),
    set: jest.fn(),
    delete: jest.fn(),
    deleteByPrefix: jest.fn(),
  },
  cacheKey: (...args: string[]) => args.join(':'),
  hashObject: (obj: any) => JSON.stringify(obj),
}));

// ============================================================================
// Types for E2E Testing
// ============================================================================

interface Signal {
  id: string;
  type: 'calendar' | 'slack' | 'github' | 'jira' | 'email' | 'manual';
  source: string;
  timestamp: Date;
  userId: string;
  payload: Record<string, any>;
  priority: 'low' | 'medium' | 'high' | 'critical';
  processed: boolean;
}

interface OrientResult {
  signalId: string;
  analysis: {
    category: string;
    intent: string;
    entities: Record<string, any>;
    sentiment: 'positive' | 'neutral' | 'negative';
    urgency: number;
  };
  context: {
    relatedSignals: string[];
    userContext: Record<string, any>;
    patterns: string[];
  };
  recommendations: string[];
}

interface Decision {
  id: string;
  signalId: string;
  orientResultId: string;
  actionType: string;
  parameters: Record<string, any>;
  confidence: number;
  alternatives: Array<{
    actionType: string;
    parameters: Record<string, any>;
    confidence: number;
    reason: string;
  }>;
  rationale: string;
  requiresApproval: boolean;
  approvalStatus: 'pending' | 'approved' | 'rejected' | 'auto_approved';
}

interface Action {
  id: string;
  decisionId: string;
  type: string;
  status: 'pending' | 'executing' | 'completed' | 'failed' | 'rolled_back';
  startedAt?: Date;
  completedAt?: Date;
  result?: any;
  error?: string;
  rollbackAvailable: boolean;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'developer' | 'viewer';
  preferences: {
    autoApproveThreshold: number;
    notificationChannels: string[];
    workingHours: { start: number; end: number };
  };
}

// ============================================================================
// Mock OODA Services
// ============================================================================

class MockObserveService {
  private signals: Map<string, Signal> = new Map();
  private signalQueue: Signal[] = [];

  async ingestSignal(signal: Omit<Signal, 'id' | 'processed'>): Promise<Signal> {
    const newSignal: Signal = {
      ...signal,
      id: `sig-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      processed: false,
    };
    this.signals.set(newSignal.id, newSignal);
    this.signalQueue.push(newSignal);
    return newSignal;
  }

  async getNextSignal(): Promise<Signal | null> {
    const signal = this.signalQueue.shift();
    return signal || null;
  }

  async getSignal(id: string): Promise<Signal | null> {
    return this.signals.get(id) || null;
  }

  async markProcessed(id: string): Promise<void> {
    const signal = this.signals.get(id);
    if (signal) {
      signal.processed = true;
    }
  }

  async getUnprocessedSignals(userId?: string): Promise<Signal[]> {
    return Array.from(this.signals.values())
      .filter(s => !s.processed && (!userId || s.userId === userId));
  }
}

class MockOrientService {
  async analyzeSignal(signal: Signal): Promise<OrientResult> {
    // Simulate NLP analysis and context enrichment
    const category = this.categorizeSignal(signal);
    const intent = this.detectIntent(signal);
    const urgency = this.calculateUrgency(signal);

    return {
      signalId: signal.id,
      analysis: {
        category,
        intent,
        entities: this.extractEntities(signal),
        sentiment: this.analyzeSentiment(signal),
        urgency,
      },
      context: {
        relatedSignals: [],
        userContext: {
          userId: signal.userId,
          recentActivity: 'active',
        },
        patterns: this.detectPatterns(signal),
      },
      recommendations: this.generateRecommendations(category, intent, urgency),
    };
  }

  private categorizeSignal(signal: Signal): string {
    const categories: Record<string, string> = {
      calendar: 'scheduling',
      slack: 'communication',
      github: 'development',
      jira: 'task_management',
      email: 'communication',
      manual: 'general',
    };
    return categories[signal.type] || 'unknown';
  }

  private detectIntent(signal: Signal): string {
    const payload = signal.payload;
    if (payload.action === 'meeting_request') return 'schedule_meeting';
    if (payload.action === 'task_created') return 'new_task';
    if (payload.action === 'pr_opened') return 'code_review_needed';
    if (payload.action === 'mention') return 'attention_needed';
    return 'information';
  }

  private calculateUrgency(signal: Signal): number {
    const priorityMap = { critical: 1.0, high: 0.75, medium: 0.5, low: 0.25 };
    return priorityMap[signal.priority];
  }

  private extractEntities(signal: Signal): Record<string, any> {
    const entities: Record<string, any> = {};
    const payload = signal.payload;

    if (payload.meetingTime) entities.datetime = payload.meetingTime;
    if (payload.participants) entities.people = payload.participants;
    if (payload.project) entities.project = payload.project;
    if (payload.deadline) entities.deadline = payload.deadline;

    return entities;
  }

  private analyzeSentiment(signal: Signal): 'positive' | 'neutral' | 'negative' {
    const payload = signal.payload;
    if (payload.sentiment) return payload.sentiment;
    if (payload.isUrgent || signal.priority === 'critical') return 'negative';
    return 'neutral';
  }

  private detectPatterns(signal: Signal): string[] {
    const patterns: string[] = [];
    if (signal.type === 'slack' && signal.payload.channel === 'alerts') {
      patterns.push('alert_channel');
    }
    if (signal.priority === 'critical') {
      patterns.push('critical_priority');
    }
    return patterns;
  }

  private generateRecommendations(category: string, intent: string, urgency: number): string[] {
    const recommendations: string[] = [];

    if (intent === 'schedule_meeting') {
      recommendations.push('Find optimal meeting time');
      recommendations.push('Check participant availability');
    }

    if (intent === 'code_review_needed') {
      recommendations.push('Assign appropriate reviewer');
      recommendations.push('Check reviewer workload');
    }

    if (urgency >= 0.75) {
      recommendations.push('Prioritize immediate action');
    }

    return recommendations;
  }
}

class MockDecideService {
  private decisions: Map<string, Decision> = new Map();

  async makeDecision(orientResult: OrientResult, user: User): Promise<Decision> {
    const actionType = this.selectActionType(orientResult);
    const parameters = this.buildParameters(orientResult);
    const confidence = this.calculateConfidence(orientResult);

    const requiresApproval = confidence < user.preferences.autoApproveThreshold;

    const decision: Decision = {
      id: `dec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      signalId: orientResult.signalId,
      orientResultId: orientResult.signalId,
      actionType,
      parameters,
      confidence,
      alternatives: this.generateAlternatives(orientResult),
      rationale: this.buildRationale(orientResult, actionType),
      requiresApproval,
      approvalStatus: requiresApproval ? 'pending' : 'auto_approved',
    };

    this.decisions.set(decision.id, decision);
    return decision;
  }

  async approveDecision(decisionId: string, userId: string): Promise<Decision> {
    const decision = this.decisions.get(decisionId);
    if (!decision) throw new Error('Decision not found');

    decision.approvalStatus = 'approved';
    return decision;
  }

  async rejectDecision(decisionId: string, userId: string, reason: string): Promise<Decision> {
    const decision = this.decisions.get(decisionId);
    if (!decision) throw new Error('Decision not found');

    decision.approvalStatus = 'rejected';
    decision.rationale += ` | Rejected: ${reason}`;
    return decision;
  }

  async getDecision(id: string): Promise<Decision | null> {
    return this.decisions.get(id) || null;
  }

  private selectActionType(orientResult: OrientResult): string {
    const intent = orientResult.analysis.intent;
    const actionMap: Record<string, string> = {
      schedule_meeting: 'create_calendar_event',
      new_task: 'assign_task',
      code_review_needed: 'assign_reviewer',
      attention_needed: 'send_notification',
      information: 'log_and_archive',
    };
    return actionMap[intent] || 'no_action';
  }

  private buildParameters(orientResult: OrientResult): Record<string, any> {
    return {
      entities: orientResult.analysis.entities,
      category: orientResult.analysis.category,
      urgency: orientResult.analysis.urgency,
    };
  }

  private calculateConfidence(orientResult: OrientResult): number {
    let confidence = 0.7;

    // Higher urgency = more confidence in taking action
    confidence += orientResult.analysis.urgency * 0.1;

    // Clear intent increases confidence
    if (orientResult.analysis.intent !== 'information') {
      confidence += 0.1;
    }

    // More entities = more context = more confidence
    const entityCount = Object.keys(orientResult.analysis.entities).length;
    confidence += Math.min(0.1, entityCount * 0.02);

    return Math.min(1, confidence);
  }

  private generateAlternatives(orientResult: OrientResult): Decision['alternatives'] {
    return [
      {
        actionType: 'defer',
        parameters: { delay: '1h' },
        confidence: 0.4,
        reason: 'Wait for more context',
      },
      {
        actionType: 'escalate',
        parameters: { escalateTo: 'manager' },
        confidence: 0.3,
        reason: 'Require human judgment',
      },
    ];
  }

  private buildRationale(orientResult: OrientResult, actionType: string): string {
    return `Based on ${orientResult.analysis.category} signal with ${orientResult.analysis.intent} intent ` +
      `(urgency: ${(orientResult.analysis.urgency * 100).toFixed(0)}%), ` +
      `recommended action: ${actionType}`;
  }
}

class MockActService {
  private actions: Map<string, Action> = new Map();

  async executeAction(decision: Decision): Promise<Action> {
    if (decision.approvalStatus !== 'approved' && decision.approvalStatus !== 'auto_approved') {
      throw new Error('Decision not approved');
    }

    const action: Action = {
      id: `act-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      decisionId: decision.id,
      type: decision.actionType,
      status: 'pending',
      rollbackAvailable: true,
    };

    this.actions.set(action.id, action);

    // Simulate execution
    action.status = 'executing';
    action.startedAt = new Date();

    try {
      const result = await this.performAction(decision.actionType, decision.parameters);
      action.status = 'completed';
      action.completedAt = new Date();
      action.result = result;
    } catch (error) {
      action.status = 'failed';
      action.error = error instanceof Error ? error.message : 'Unknown error';
    }

    return action;
  }

  async rollbackAction(actionId: string): Promise<Action> {
    const action = this.actions.get(actionId);
    if (!action) throw new Error('Action not found');

    if (!action.rollbackAvailable) {
      throw new Error('Rollback not available for this action');
    }

    action.status = 'rolled_back';
    return action;
  }

  async getAction(id: string): Promise<Action | null> {
    return this.actions.get(id) || null;
  }

  private async performAction(type: string, parameters: Record<string, any>): Promise<any> {
    // Simulate different action types
    switch (type) {
      case 'create_calendar_event':
        return { eventId: `event-${Date.now()}`, created: true };
      case 'assign_task':
        return { taskId: `task-${Date.now()}`, assigned: true };
      case 'assign_reviewer':
        return { reviewerId: 'reviewer-1', assigned: true };
      case 'send_notification':
        return { notificationId: `notif-${Date.now()}`, sent: true };
      case 'log_and_archive':
        return { archived: true };
      default:
        return { executed: true };
    }
  }
}

// ============================================================================
// OODA Loop Integration
// ============================================================================

class OODALoop {
  constructor(
    public observe: MockObserveService,
    public orient: MockOrientService,
    public decide: MockDecideService,
    public act: MockActService
  ) {}

  async processSignal(signal: Signal, user: User): Promise<{
    signal: Signal;
    orientation: OrientResult;
    decision: Decision;
    action: Action | null;
  }> {
    // Observe -> Orient -> Decide -> Act
    const orientation = await this.orient.analyzeSignal(signal);
    const decision = await this.decide.makeDecision(orientation, user);

    let action: Action | null = null;
    if (decision.approvalStatus === 'auto_approved' || decision.approvalStatus === 'approved') {
      action = await this.act.executeAction(decision);
    }

    await this.observe.markProcessed(signal.id);

    return { signal, orientation, decision, action };
  }

  async processAllPendingSignals(user: User): Promise<Array<{
    signal: Signal;
    orientation: OrientResult;
    decision: Decision;
    action: Action | null;
  }>> {
    const results: any[] = [];
    const pendingSignals = await this.observe.getUnprocessedSignals(user.id);

    for (const signal of pendingSignals) {
      const result = await this.processSignal(signal, user);
      results.push(result);
    }

    return results;
  }
}

// ============================================================================
// Test Suite
// ============================================================================

describe('ORACLE v2.0 E2E Tests', () => {
  let ooda: OODALoop;
  let observeService: MockObserveService;
  let orientService: MockOrientService;
  let decideService: MockDecideService;
  let actService: MockActService;

  // Test users
  const adminUser: User = {
    id: 'admin-1',
    name: 'Admin User',
    email: 'admin@example.com',
    role: 'admin',
    preferences: {
      autoApproveThreshold: 0.7,
      notificationChannels: ['email', 'slack'],
      workingHours: { start: 9, end: 17 },
    },
  };

  const developerUser: User = {
    id: 'dev-1',
    name: 'Developer User',
    email: 'dev@example.com',
    role: 'developer',
    preferences: {
      autoApproveThreshold: 0.9, // Higher threshold = more manual approvals
      notificationChannels: ['slack'],
      workingHours: { start: 10, end: 18 },
    },
  };

  beforeEach(() => {
    observeService = new MockObserveService();
    orientService = new MockOrientService();
    decideService = new MockDecideService();
    actService = new MockActService();
    ooda = new OODALoop(observeService, orientService, decideService, actService);
    jest.clearAllMocks();
  });

  // ============================================================================
  // Signal Ingestion Tests (Observe)
  // ============================================================================

  describe('Observe Phase - Signal Ingestion', () => {
    it('should ingest calendar signals', async () => {
      const signal = await observeService.ingestSignal({
        type: 'calendar',
        source: 'google-calendar',
        timestamp: new Date(),
        userId: adminUser.id,
        payload: {
          action: 'meeting_request',
          meetingTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
          participants: ['user1@example.com', 'user2@example.com'],
          title: 'Project Review',
        },
        priority: 'medium',
      });

      expect(signal.id).toBeDefined();
      expect(signal.processed).toBe(false);
      expect(signal.type).toBe('calendar');
    });

    it('should ingest Slack signals', async () => {
      const signal = await observeService.ingestSignal({
        type: 'slack',
        source: 'slack-api',
        timestamp: new Date(),
        userId: developerUser.id,
        payload: {
          action: 'mention',
          channel: 'engineering',
          message: 'Hey @dev, can you review this PR?',
          sender: 'colleague@example.com',
        },
        priority: 'high',
      });

      expect(signal.type).toBe('slack');
      expect(signal.priority).toBe('high');
    });

    it('should ingest GitHub signals', async () => {
      const signal = await observeService.ingestSignal({
        type: 'github',
        source: 'github-webhook',
        timestamp: new Date(),
        userId: developerUser.id,
        payload: {
          action: 'pr_opened',
          repository: 'org/project',
          prNumber: 123,
          title: 'Feature: Add new component',
          author: 'contributor@example.com',
        },
        priority: 'medium',
      });

      expect(signal.type).toBe('github');
      expect(signal.payload.prNumber).toBe(123);
    });

    it('should queue multiple signals', async () => {
      await observeService.ingestSignal({
        type: 'calendar',
        source: 'google',
        timestamp: new Date(),
        userId: adminUser.id,
        payload: { action: 'meeting_request' },
        priority: 'medium',
      });

      await observeService.ingestSignal({
        type: 'slack',
        source: 'slack',
        timestamp: new Date(),
        userId: adminUser.id,
        payload: { action: 'mention' },
        priority: 'high',
      });

      const unprocessed = await observeService.getUnprocessedSignals(adminUser.id);
      expect(unprocessed.length).toBe(2);
    });

    it('should retrieve signals by user', async () => {
      await observeService.ingestSignal({
        type: 'calendar',
        source: 'google',
        timestamp: new Date(),
        userId: adminUser.id,
        payload: {},
        priority: 'low',
      });

      await observeService.ingestSignal({
        type: 'slack',
        source: 'slack',
        timestamp: new Date(),
        userId: developerUser.id,
        payload: {},
        priority: 'low',
      });

      const adminSignals = await observeService.getUnprocessedSignals(adminUser.id);
      const devSignals = await observeService.getUnprocessedSignals(developerUser.id);

      expect(adminSignals.length).toBe(1);
      expect(devSignals.length).toBe(1);
    });
  });

  // ============================================================================
  // Signal Analysis Tests (Orient)
  // ============================================================================

  describe('Orient Phase - Signal Analysis', () => {
    it('should categorize calendar signals as scheduling', async () => {
      const signal = await observeService.ingestSignal({
        type: 'calendar',
        source: 'google',
        timestamp: new Date(),
        userId: adminUser.id,
        payload: { action: 'meeting_request' },
        priority: 'medium',
      });

      const result = await orientService.analyzeSignal(signal);

      expect(result.analysis.category).toBe('scheduling');
      expect(result.analysis.intent).toBe('schedule_meeting');
    });

    it('should detect code review intent from GitHub PRs', async () => {
      const signal = await observeService.ingestSignal({
        type: 'github',
        source: 'github-webhook',
        timestamp: new Date(),
        userId: developerUser.id,
        payload: { action: 'pr_opened' },
        priority: 'medium',
      });

      const result = await orientService.analyzeSignal(signal);

      expect(result.analysis.category).toBe('development');
      expect(result.analysis.intent).toBe('code_review_needed');
    });

    it('should extract entities from signal payload', async () => {
      const meetingTime = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const participants = ['user1@example.com', 'user2@example.com'];

      const signal = await observeService.ingestSignal({
        type: 'calendar',
        source: 'google',
        timestamp: new Date(),
        userId: adminUser.id,
        payload: {
          action: 'meeting_request',
          meetingTime,
          participants,
        },
        priority: 'medium',
      });

      const result = await orientService.analyzeSignal(signal);

      expect(result.analysis.entities.datetime).toEqual(meetingTime);
      expect(result.analysis.entities.people).toEqual(participants);
    });

    it('should calculate urgency based on priority', async () => {
      const criticalSignal = await observeService.ingestSignal({
        type: 'slack',
        source: 'slack',
        timestamp: new Date(),
        userId: adminUser.id,
        payload: { action: 'mention' },
        priority: 'critical',
      });

      const lowSignal = await observeService.ingestSignal({
        type: 'slack',
        source: 'slack',
        timestamp: new Date(),
        userId: adminUser.id,
        payload: { action: 'mention' },
        priority: 'low',
      });

      const criticalResult = await orientService.analyzeSignal(criticalSignal);
      const lowResult = await orientService.analyzeSignal(lowSignal);

      expect(criticalResult.analysis.urgency).toBe(1.0);
      expect(lowResult.analysis.urgency).toBe(0.25);
    });

    it('should generate recommendations based on analysis', async () => {
      const signal = await observeService.ingestSignal({
        type: 'calendar',
        source: 'google',
        timestamp: new Date(),
        userId: adminUser.id,
        payload: { action: 'meeting_request' },
        priority: 'medium',
      });

      const result = await orientService.analyzeSignal(signal);

      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(result.recommendations).toContain('Find optimal meeting time');
    });

    it('should detect patterns in signals', async () => {
      const signal = await observeService.ingestSignal({
        type: 'slack',
        source: 'slack',
        timestamp: new Date(),
        userId: adminUser.id,
        payload: { action: 'mention', channel: 'alerts' },
        priority: 'critical',
      });

      const result = await orientService.analyzeSignal(signal);

      expect(result.context.patterns).toContain('alert_channel');
      expect(result.context.patterns).toContain('critical_priority');
    });
  });

  // ============================================================================
  // Decision Making Tests (Decide)
  // ============================================================================

  describe('Decide Phase - Decision Making', () => {
    it('should auto-approve decisions with high confidence for admin', async () => {
      const signal = await observeService.ingestSignal({
        type: 'calendar',
        source: 'google',
        timestamp: new Date(),
        userId: adminUser.id,
        payload: { action: 'meeting_request', meetingTime: new Date(), participants: ['a', 'b'] },
        priority: 'high',
      });

      const orientation = await orientService.analyzeSignal(signal);
      const decision = await decideService.makeDecision(orientation, adminUser);

      // Admin has autoApproveThreshold of 0.7
      expect(decision.approvalStatus).toBe('auto_approved');
    });

    it('should require approval for lower confidence decisions', async () => {
      const signal = await observeService.ingestSignal({
        type: 'slack',
        source: 'slack',
        timestamp: new Date(),
        userId: developerUser.id,
        payload: { action: 'mention' },
        priority: 'low',
      });

      const orientation = await orientService.analyzeSignal(signal);
      const decision = await decideService.makeDecision(orientation, developerUser);

      // Developer has high autoApproveThreshold of 0.9
      expect(decision.approvalStatus).toBe('pending');
    });

    it('should select appropriate action type for meetings', async () => {
      const signal = await observeService.ingestSignal({
        type: 'calendar',
        source: 'google',
        timestamp: new Date(),
        userId: adminUser.id,
        payload: { action: 'meeting_request' },
        priority: 'medium',
      });

      const orientation = await orientService.analyzeSignal(signal);
      const decision = await decideService.makeDecision(orientation, adminUser);

      expect(decision.actionType).toBe('create_calendar_event');
    });

    it('should select appropriate action type for code review', async () => {
      const signal = await observeService.ingestSignal({
        type: 'github',
        source: 'github',
        timestamp: new Date(),
        userId: developerUser.id,
        payload: { action: 'pr_opened' },
        priority: 'medium',
      });

      const orientation = await orientService.analyzeSignal(signal);
      const decision = await decideService.makeDecision(orientation, developerUser);

      expect(decision.actionType).toBe('assign_reviewer');
    });

    it('should generate alternative decisions', async () => {
      const signal = await observeService.ingestSignal({
        type: 'calendar',
        source: 'google',
        timestamp: new Date(),
        userId: adminUser.id,
        payload: { action: 'meeting_request' },
        priority: 'medium',
      });

      const orientation = await orientService.analyzeSignal(signal);
      const decision = await decideService.makeDecision(orientation, adminUser);

      expect(decision.alternatives.length).toBeGreaterThan(0);
      expect(decision.alternatives[0]).toHaveProperty('actionType');
      expect(decision.alternatives[0]).toHaveProperty('confidence');
      expect(decision.alternatives[0]).toHaveProperty('reason');
    });

    it('should approve pending decisions', async () => {
      const signal = await observeService.ingestSignal({
        type: 'slack',
        source: 'slack',
        timestamp: new Date(),
        userId: developerUser.id,
        payload: { action: 'mention' },
        priority: 'low',
      });

      const orientation = await orientService.analyzeSignal(signal);
      const decision = await decideService.makeDecision(orientation, developerUser);

      expect(decision.approvalStatus).toBe('pending');

      const approved = await decideService.approveDecision(decision.id, adminUser.id);
      expect(approved.approvalStatus).toBe('approved');
    });

    it('should reject decisions with reason', async () => {
      const signal = await observeService.ingestSignal({
        type: 'slack',
        source: 'slack',
        timestamp: new Date(),
        userId: developerUser.id,
        payload: { action: 'mention' },
        priority: 'low',
      });

      const orientation = await orientService.analyzeSignal(signal);
      const decision = await decideService.makeDecision(orientation, developerUser);

      const rejected = await decideService.rejectDecision(decision.id, adminUser.id, 'Not appropriate');
      expect(rejected.approvalStatus).toBe('rejected');
      expect(rejected.rationale).toContain('Not appropriate');
    });
  });

  // ============================================================================
  // Action Execution Tests (Act)
  // ============================================================================

  describe('Act Phase - Action Execution', () => {
    it('should execute approved decisions', async () => {
      const signal = await observeService.ingestSignal({
        type: 'calendar',
        source: 'google',
        timestamp: new Date(),
        userId: adminUser.id,
        payload: { action: 'meeting_request', meetingTime: new Date() },
        priority: 'high',
      });

      const orientation = await orientService.analyzeSignal(signal);
      const decision = await decideService.makeDecision(orientation, adminUser);

      expect(decision.approvalStatus).toBe('auto_approved');

      const action = await actService.executeAction(decision);

      expect(action.status).toBe('completed');
      expect(action.result).toBeDefined();
    });

    it('should fail to execute unapproved decisions', async () => {
      const signal = await observeService.ingestSignal({
        type: 'slack',
        source: 'slack',
        timestamp: new Date(),
        userId: developerUser.id,
        payload: { action: 'mention' },
        priority: 'low',
      });

      const orientation = await orientService.analyzeSignal(signal);
      const decision = await decideService.makeDecision(orientation, developerUser);

      expect(decision.approvalStatus).toBe('pending');

      await expect(actService.executeAction(decision)).rejects.toThrow('Decision not approved');
    });

    it('should track action status through lifecycle', async () => {
      const signal = await observeService.ingestSignal({
        type: 'calendar',
        source: 'google',
        timestamp: new Date(),
        userId: adminUser.id,
        payload: { action: 'meeting_request' },
        priority: 'high',
      });

      const orientation = await orientService.analyzeSignal(signal);
      const decision = await decideService.makeDecision(orientation, adminUser);
      const action = await actService.executeAction(decision);

      expect(action.startedAt).toBeDefined();
      expect(action.completedAt).toBeDefined();
      expect(action.completedAt!.getTime()).toBeGreaterThanOrEqual(action.startedAt!.getTime());
    });

    it('should support action rollback', async () => {
      const signal = await observeService.ingestSignal({
        type: 'calendar',
        source: 'google',
        timestamp: new Date(),
        userId: adminUser.id,
        payload: { action: 'meeting_request' },
        priority: 'high',
      });

      const orientation = await orientService.analyzeSignal(signal);
      const decision = await decideService.makeDecision(orientation, adminUser);
      const action = await actService.executeAction(decision);

      expect(action.rollbackAvailable).toBe(true);

      const rolledBack = await actService.rollbackAction(action.id);
      expect(rolledBack.status).toBe('rolled_back');
    });

    it('should return appropriate results for different action types', async () => {
      // Calendar action
      const calendarSignal = await observeService.ingestSignal({
        type: 'calendar',
        source: 'google',
        timestamp: new Date(),
        userId: adminUser.id,
        payload: { action: 'meeting_request' },
        priority: 'high',
      });
      const calendarOrientation = await orientService.analyzeSignal(calendarSignal);
      const calendarDecision = await decideService.makeDecision(calendarOrientation, adminUser);
      const calendarAction = await actService.executeAction(calendarDecision);

      expect(calendarAction.result).toHaveProperty('eventId');
      expect(calendarAction.result.created).toBe(true);

      // GitHub action
      const githubSignal = await observeService.ingestSignal({
        type: 'github',
        source: 'github',
        timestamp: new Date(),
        userId: adminUser.id,
        payload: { action: 'pr_opened' },
        priority: 'high',
      });
      const githubOrientation = await orientService.analyzeSignal(githubSignal);
      const githubDecision = await decideService.makeDecision(githubOrientation, adminUser);
      const githubAction = await actService.executeAction(githubDecision);

      expect(githubAction.result).toHaveProperty('reviewerId');
      expect(githubAction.result.assigned).toBe(true);
    });
  });

  // ============================================================================
  // Full OODA Loop Tests
  // ============================================================================

  describe('Full OODA Loop Integration', () => {
    it('should process a signal through the complete OODA loop', async () => {
      const signal = await observeService.ingestSignal({
        type: 'calendar',
        source: 'google',
        timestamp: new Date(),
        userId: adminUser.id,
        payload: {
          action: 'meeting_request',
          meetingTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
          participants: ['user1@example.com'],
        },
        priority: 'high',
      });

      const result = await ooda.processSignal(signal, adminUser);

      // Verify all phases completed
      expect(result.signal).toBeDefined();
      expect(result.orientation).toBeDefined();
      expect(result.decision).toBeDefined();
      expect(result.action).toBeDefined();

      // Verify signal was marked as processed
      const processedSignal = await observeService.getSignal(signal.id);
      expect(processedSignal?.processed).toBe(true);

      // Verify action completed
      expect(result.action?.status).toBe('completed');
    });

    it('should handle pending approval flow', async () => {
      const signal = await observeService.ingestSignal({
        type: 'slack',
        source: 'slack',
        timestamp: new Date(),
        userId: developerUser.id,
        payload: { action: 'mention' },
        priority: 'low',
      });

      const result = await ooda.processSignal(signal, developerUser);

      // Decision should require approval
      expect(result.decision.approvalStatus).toBe('pending');
      expect(result.action).toBeNull();

      // Approve the decision
      await decideService.approveDecision(result.decision.id, adminUser.id);

      // Now execute the action
      const action = await actService.executeAction(result.decision);
      expect(action.status).toBe('completed');
    });

    it('should process all pending signals for a user', async () => {
      // Create multiple signals
      await observeService.ingestSignal({
        type: 'calendar',
        source: 'google',
        timestamp: new Date(),
        userId: adminUser.id,
        payload: { action: 'meeting_request' },
        priority: 'high',
      });

      await observeService.ingestSignal({
        type: 'github',
        source: 'github',
        timestamp: new Date(),
        userId: adminUser.id,
        payload: { action: 'pr_opened' },
        priority: 'high',
      });

      await observeService.ingestSignal({
        type: 'slack',
        source: 'slack',
        timestamp: new Date(),
        userId: adminUser.id,
        payload: { action: 'mention' },
        priority: 'high',
      });

      const results = await ooda.processAllPendingSignals(adminUser);

      expect(results.length).toBe(3);
      expect(results.every(r => r.action?.status === 'completed')).toBe(true);

      // All signals should be processed
      const unprocessed = await observeService.getUnprocessedSignals(adminUser.id);
      expect(unprocessed.length).toBe(0);
    });
  });

  // ============================================================================
  // Multi-User Scenario Tests
  // ============================================================================

  describe('Multi-User Scenarios', () => {
    it('should handle signals from multiple users independently', async () => {
      // Admin user signal
      await observeService.ingestSignal({
        type: 'calendar',
        source: 'google',
        timestamp: new Date(),
        userId: adminUser.id,
        payload: { action: 'meeting_request' },
        priority: 'high',
      });

      // Developer user signal
      await observeService.ingestSignal({
        type: 'github',
        source: 'github',
        timestamp: new Date(),
        userId: developerUser.id,
        payload: { action: 'pr_opened' },
        priority: 'medium',
      });

      // Process admin's signals
      const adminResults = await ooda.processAllPendingSignals(adminUser);
      expect(adminResults.length).toBe(1);
      expect(adminResults[0].action?.status).toBe('completed');

      // Developer's signal should still be pending
      const devUnprocessed = await observeService.getUnprocessedSignals(developerUser.id);
      expect(devUnprocessed.length).toBe(1);

      // Process developer's signals
      const devResults = await ooda.processAllPendingSignals(developerUser);
      expect(devResults.length).toBe(1);
    });

    it('should respect different user preferences', async () => {
      // Same type of signal for both users
      const adminSignal = await observeService.ingestSignal({
        type: 'slack',
        source: 'slack',
        timestamp: new Date(),
        userId: adminUser.id,
        payload: { action: 'mention' },
        priority: 'medium',
      });

      const devSignal = await observeService.ingestSignal({
        type: 'slack',
        source: 'slack',
        timestamp: new Date(),
        userId: developerUser.id,
        payload: { action: 'mention' },
        priority: 'medium',
      });

      const adminOrientation = await orientService.analyzeSignal(adminSignal);
      const adminDecision = await decideService.makeDecision(adminOrientation, adminUser);

      const devOrientation = await orientService.analyzeSignal(devSignal);
      const devDecision = await decideService.makeDecision(devOrientation, developerUser);

      // Admin has lower threshold (0.7), so might auto-approve
      // Developer has higher threshold (0.9), so should require approval
      expect(devDecision.requiresApproval).toBe(true);
    });

    it('should allow cross-user decision approval', async () => {
      // Developer creates a signal
      const signal = await observeService.ingestSignal({
        type: 'slack',
        source: 'slack',
        timestamp: new Date(),
        userId: developerUser.id,
        payload: { action: 'mention' },
        priority: 'low',
      });

      // Process as developer (requires approval)
      const result = await ooda.processSignal(signal, developerUser);
      expect(result.decision.approvalStatus).toBe('pending');

      // Admin approves developer's decision
      const approved = await decideService.approveDecision(result.decision.id, adminUser.id);
      expect(approved.approvalStatus).toBe('approved');

      // Execute the approved action
      const action = await actService.executeAction(approved);
      expect(action.status).toBe('completed');
    });

    it('should handle concurrent signal processing', async () => {
      // Create signals for multiple users
      const signals = await Promise.all([
        observeService.ingestSignal({
          type: 'calendar',
          source: 'google',
          timestamp: new Date(),
          userId: adminUser.id,
          payload: { action: 'meeting_request' },
          priority: 'high',
        }),
        observeService.ingestSignal({
          type: 'github',
          source: 'github',
          timestamp: new Date(),
          userId: developerUser.id,
          payload: { action: 'pr_opened' },
          priority: 'high',
        }),
        observeService.ingestSignal({
          type: 'slack',
          source: 'slack',
          timestamp: new Date(),
          userId: adminUser.id,
          payload: { action: 'mention' },
          priority: 'high',
        }),
      ]);

      expect(signals.length).toBe(3);

      // Process signals concurrently
      const [adminResults, devResults] = await Promise.all([
        ooda.processAllPendingSignals(adminUser),
        ooda.processAllPendingSignals(developerUser),
      ]);

      expect(adminResults.length).toBe(2);
      expect(devResults.length).toBe(1);
    });
  });

  // ============================================================================
  // Error Handling and Edge Cases
  // ============================================================================

  describe('Error Handling', () => {
    it('should handle signal with missing payload', async () => {
      const signal = await observeService.ingestSignal({
        type: 'manual',
        source: 'user-input',
        timestamp: new Date(),
        userId: adminUser.id,
        payload: {},
        priority: 'low',
      });

      const result = await ooda.processSignal(signal, adminUser);

      expect(result.orientation).toBeDefined();
      expect(result.decision).toBeDefined();
    });

    it('should handle unknown signal types', async () => {
      const signal = await observeService.ingestSignal({
        type: 'manual' as any,
        source: 'unknown',
        timestamp: new Date(),
        userId: adminUser.id,
        payload: { action: 'custom_action' },
        priority: 'medium',
      });

      const result = await ooda.processSignal(signal, adminUser);

      expect(result.orientation.analysis.category).toBe('general');
    });

    it('should handle decision retrieval for non-existent decision', async () => {
      const decision = await decideService.getDecision('non-existent-id');
      expect(decision).toBeNull();
    });

    it('should handle action retrieval for non-existent action', async () => {
      const action = await actService.getAction('non-existent-id');
      expect(action).toBeNull();
    });

    it('should handle rollback for non-existent action', async () => {
      await expect(actService.rollbackAction('non-existent-id')).rejects.toThrow('Action not found');
    });

    it('should handle approval for non-existent decision', async () => {
      await expect(decideService.approveDecision('non-existent-id', adminUser.id)).rejects.toThrow('Decision not found');
    });
  });

  // ============================================================================
  // Performance Tests
  // ============================================================================

  describe('Performance', () => {
    it('should process large batches of signals efficiently', async () => {
      // Create 100 signals
      const signalPromises = Array.from({ length: 100 }, (_, i) =>
        observeService.ingestSignal({
          type: 'calendar',
          source: 'google',
          timestamp: new Date(),
          userId: adminUser.id,
          payload: { action: 'meeting_request', index: i },
          priority: 'high',
        })
      );

      await Promise.all(signalPromises);

      const start = Date.now();
      const results = await ooda.processAllPendingSignals(adminUser);
      const duration = Date.now() - start;

      expect(results.length).toBe(100);
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
    });

    it('should handle rapid signal ingestion', async () => {
      const start = Date.now();

      // Rapidly ingest 50 signals
      for (let i = 0; i < 50; i++) {
        await observeService.ingestSignal({
          type: 'slack',
          source: 'slack',
          timestamp: new Date(),
          userId: adminUser.id,
          payload: { action: 'mention', index: i },
          priority: 'medium',
        });
      }

      const duration = Date.now() - start;

      const unprocessed = await observeService.getUnprocessedSignals(adminUser.id);
      expect(unprocessed.length).toBe(50);
      expect(duration).toBeLessThan(5000);
    });
  });

  // ============================================================================
  // Integration Validation
  // ============================================================================

  describe('Integration Validation', () => {
    it('should maintain data consistency across OODA phases', async () => {
      const signal = await observeService.ingestSignal({
        type: 'jira',
        source: 'jira-webhook',
        timestamp: new Date(),
        userId: adminUser.id,
        payload: {
          action: 'task_created',
          project: 'ORACLE',
          taskId: 'ORACLE-123',
          title: 'Implement feature',
          priority: 'high',
        },
        priority: 'high',
      });

      const result = await ooda.processSignal(signal, adminUser);

      // Verify signal ID flows through all phases
      expect(result.orientation.signalId).toBe(signal.id);
      expect(result.decision.signalId).toBe(signal.id);

      // Verify decision ID flows to action
      expect(result.action?.decisionId).toBe(result.decision.id);
    });

    it('should preserve payload data through analysis', async () => {
      const projectName = 'TestProject';
      const deadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      const signal = await observeService.ingestSignal({
        type: 'jira',
        source: 'jira',
        timestamp: new Date(),
        userId: adminUser.id,
        payload: {
          action: 'task_created',
          project: projectName,
          deadline,
        },
        priority: 'medium',
      });

      const orientation = await orientService.analyzeSignal(signal);

      expect(orientation.analysis.entities.project).toBe(projectName);
      expect(orientation.analysis.entities.deadline).toEqual(deadline);
    });

    it('should generate traceable audit trail', async () => {
      const signal = await observeService.ingestSignal({
        type: 'email',
        source: 'email-parser',
        timestamp: new Date(),
        userId: adminUser.id,
        payload: { action: 'meeting_request' },
        priority: 'high',
      });

      const result = await ooda.processSignal(signal, adminUser);

      // Collect audit trail
      const auditTrail = {
        signalId: signal.id,
        signalTimestamp: signal.timestamp,
        orientationCategory: result.orientation.analysis.category,
        decisionId: result.decision.id,
        decisionAction: result.decision.actionType,
        decisionApproval: result.decision.approvalStatus,
        actionId: result.action?.id,
        actionStatus: result.action?.status,
        actionCompletedAt: result.action?.completedAt,
      };

      expect(auditTrail.signalId).toBeDefined();
      expect(auditTrail.decisionId).toBeDefined();
      expect(auditTrail.actionId).toBeDefined();
      expect(auditTrail.actionStatus).toBe('completed');
    });
  });
});
