// Mock ORACLE Gemini Service for testing without API
// Provides realistic mock responses with configurable delays

import {
  Signal,
  StrategicContext,
  StrategicHorizon,
  DecisionOption,
  ExecutionStep,
  CopilotSuggestion,
  Lesson,
} from '@mission-control/shared-types';

// Helper to create realistic delays (1-2 seconds as specified)
const delay = (ms: number = 1500): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms));

// Helper to generate UUIDs
const uuid = (): string => crypto.randomUUID?.() ||
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });

// Helper to generate confidence in realistic ranges
const confidence = (min: number = 0.6, max: number = 0.95): number =>
  Math.round((min + Math.random() * (max - min)) * 100) / 100;

export class MockOracleGeminiService {
  // ==========================================
  // OBSERVE - Radar Scan
  // ==========================================

  async radarScan(input: {
    calendar?: any[];
    tasks?: any[];
    emails?: any[];
    patterns?: any[];
  }): Promise<{
    signals: Signal[];
    clusters: Array<{ id: string; label: string; signal_ids: string[] }>;
  }> {
    await delay(1800);

    const now = new Date();
    const signals: Signal[] = [
      {
        id: uuid(),
        user_id: '',
        signal_type: 'deadline',
        title: 'Project Alpha deadline approaching',
        description: 'Project Alpha milestone due in 2 days. 3 tasks still pending.',
        urgency: 'high',
        impact: 'high',
        confidence: confidence(0.85, 0.95),
        status: 'active',
        source_data: { project: 'alpha', pending_tasks: 3 },
        expires_at: new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString(),
        metadata: {},
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      },
      {
        id: uuid(),
        user_id: '',
        signal_type: 'conflict',
        title: 'Meeting schedule conflict detected',
        description: 'Two meetings overlap on Friday 2-3pm: Client call and Team sync.',
        urgency: 'medium',
        impact: 'medium',
        confidence: confidence(0.9, 0.98),
        status: 'active',
        source_data: { meeting1: 'Client call', meeting2: 'Team sync', date: 'Friday' },
        metadata: {},
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      },
      {
        id: uuid(),
        user_id: '',
        signal_type: 'opportunity',
        title: 'Q2 budget review window',
        description: 'Budget reallocation window opens next week. Opportunity to request additional resources.',
        urgency: 'medium',
        impact: 'high',
        confidence: confidence(0.7, 0.85),
        status: 'active',
        source_data: { budget_cycle: 'Q2', window_start: 'next_week' },
        metadata: {},
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      },
      {
        id: uuid(),
        user_id: '',
        signal_type: 'risk',
        title: 'Team capacity risk',
        description: 'Two team members on PTO next week. Current sprint may be at risk.',
        urgency: 'high',
        impact: 'medium',
        confidence: confidence(0.75, 0.88),
        status: 'active',
        source_data: { pto_count: 2, sprint: 'current' },
        metadata: {},
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      },
      {
        id: uuid(),
        user_id: '',
        signal_type: 'anomaly',
        title: 'Unusual email volume detected',
        description: '150% increase in emails from legal team over last 24 hours.',
        urgency: 'low',
        impact: 'medium',
        confidence: confidence(0.65, 0.8),
        status: 'active',
        source_data: { source: 'legal', increase: 1.5 },
        metadata: {},
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      },
    ];

    const clusters = [
      {
        id: uuid(),
        label: 'Project Alpha Pressure',
        signal_ids: [signals[0].id, signals[3].id],
      },
      {
        id: uuid(),
        label: 'Scheduling Issues',
        signal_ids: [signals[1].id],
      },
    ];

    return { signals, clusters };
  }

  // ==========================================
  // OBSERVE - Detect Anomalies
  // ==========================================

  async detectAnomalies(baseline: any, current: any): Promise<{
    anomalies: Array<{
      type: string;
      description: string;
      severity: 'low' | 'medium' | 'high';
      z_score: number;
      confidence: number;
    }>;
  }> {
    await delay(1200);

    return {
      anomalies: [
        {
          type: 'volume_spike',
          description: 'Email volume 2.3 standard deviations above normal',
          severity: 'medium',
          z_score: 2.3,
          confidence: confidence(0.78, 0.88),
        },
        {
          type: 'pattern_break',
          description: 'No calendar events scheduled for Wednesday - unusual for this day',
          severity: 'low',
          z_score: 1.8,
          confidence: confidence(0.65, 0.75),
        },
      ],
    };
  }

  // ==========================================
  // OBSERVE - Cluster Signals
  // ==========================================

  async clusterSignals(signals: Signal[]): Promise<{
    clusters: Array<{
      id: string;
      label: string;
      summary: string;
      signal_ids: string[];
      combined_urgency: 'low' | 'medium' | 'high' | 'critical';
      combined_impact: 'low' | 'medium' | 'high' | 'critical';
      confidence: number;
    }>;
  }> {
    await delay(1000);

    // Simple mock clustering by signal type
    const typeGroups = new Map<string, Signal[]>();
    signals.forEach(s => {
      const list = typeGroups.get(s.signal_type) || [];
      list.push(s);
      typeGroups.set(s.signal_type, list);
    });

    const clusters = Array.from(typeGroups.entries()).map(([type, sigs]) => ({
      id: uuid(),
      label: `${type.charAt(0).toUpperCase() + type.slice(1)} signals`,
      summary: `${sigs.length} ${type} signal(s) detected`,
      signal_ids: sigs.map(s => s.id),
      combined_urgency: 'high' as const,
      combined_impact: 'medium' as const,
      confidence: confidence(0.7, 0.85),
    }));

    return { clusters };
  }

  // ==========================================
  // ORIENT - Generate Orientation
  // ==========================================

  async generateOrientation(signals: Signal[], context?: any): Promise<{
    context: Partial<StrategicContext>;
    horizons: Partial<StrategicHorizon>[];
  }> {
    await delay(2000);

    const strategicContext: Partial<StrategicContext> = {
      id: uuid(),
      situation_summary: 'Multiple time-sensitive priorities require attention. Project Alpha deadline creates pressure, compounded by team capacity constraints. A scheduling conflict and budget opportunity require near-term decisions.',
      key_factors: [
        { factor: 'Project Alpha deadline in 2 days', importance: 0.9, trend: 'declining' },
        { factor: 'Team capacity reduced by 2 members', importance: 0.75, trend: 'declining' },
        { factor: 'Budget reallocation window opening', importance: 0.6, trend: 'improving' },
        { factor: 'Meeting conflict on Friday', importance: 0.5, trend: 'stable' },
      ],
      recommendations: [
        { action: 'Prioritize Project Alpha tasks and identify any that can be delegated', priority: 'critical', rationale: 'Deadline in 2 days with pending tasks' },
        { action: 'Resolve Friday meeting conflict by rescheduling the lower-priority meeting', priority: 'high', rationale: 'Schedule overlap needs resolution' },
        { action: 'Prepare budget request before window opens', priority: 'medium', rationale: 'Budget opportunity opening next week' },
        { action: 'Review sprint scope given capacity constraints', priority: 'medium', rationale: 'Team capacity is reduced' },
      ],
      constraints: [
        { description: '48 hours until Alpha milestone', type: 'time' },
        { description: 'Reduced team capacity next week', type: 'resource' },
      ],
      confidence: confidence(0.78, 0.88),
      is_active: true,
      created_at: new Date().toISOString(),
    };

    const horizons: Partial<StrategicHorizon>[] = [
      {
        id: uuid(),
        horizon_type: 'immediate',
        goals: [
          { description: 'Clear Alpha blockers', priority: 1 },
          { description: 'Resolve meeting conflict', priority: 2 },
        ],
        actions: [
          { description: 'Review Alpha pending tasks', priority: 'high', estimated_effort: '30 min', assignee: 'self' },
          { description: 'Reschedule Team sync meeting', priority: 'high', estimated_effort: '10 min', assignee: 'self' },
        ],
        dependencies: [],
        risks: [{ description: 'Alpha tasks more complex than estimated', likelihood: 0.4, impact: 'high' }],
        opportunities: [],
        priority_score: 0.95,
        confidence: confidence(0.8, 0.9),
      },
      {
        id: uuid(),
        horizon_type: 'today',
        goals: [
          { description: 'Complete 2 Alpha tasks', priority: 1 },
          { description: 'Draft budget request', priority: 2 },
        ],
        actions: [
          { description: 'Deep work session on Alpha', priority: 'critical', estimated_effort: '3 hours', assignee: 'self' },
          { description: 'Outline budget proposal', priority: 'medium', estimated_effort: '45 min', assignee: 'self' },
        ],
        dependencies: [{ description: 'Clear Alpha blockers', blocking: true }],
        risks: [{ description: 'Interruptions reduce focus time', likelihood: 0.5, impact: 'medium' }],
        opportunities: [{ description: 'Early budget submission shows initiative', potential_value: 'medium' }],
        priority_score: 0.85,
        confidence: confidence(0.75, 0.85),
      },
      {
        id: uuid(),
        horizon_type: 'week',
        goals: [
          { description: 'Deliver Alpha milestone', priority: 1 },
          { description: 'Submit budget request', priority: 2 },
          { description: 'Manage sprint with reduced capacity', priority: 3 },
        ],
        actions: [
          { description: 'Daily Alpha progress checks', priority: 'high', estimated_effort: '15 min', assignee: 'self' },
          { description: 'Finalize and submit budget request', priority: 'medium', estimated_effort: '60 min', assignee: 'self' },
          { description: 'Reassign sprint tasks as needed', priority: 'medium', estimated_effort: '30 min', assignee: 'self' },
        ],
        dependencies: [
          { description: 'Alpha tasks completed', blocking: true },
          { description: 'Budget window opens', blocking: false },
        ],
        risks: [
          { description: 'Sprint incomplete due to capacity', likelihood: 0.6, impact: 'high' },
          { description: 'Budget request rejected', likelihood: 0.3, impact: 'medium' },
        ],
        opportunities: [{ description: 'Demonstrate reliability on Alpha', potential_value: 'high' }],
        priority_score: 0.8,
        confidence: confidence(0.65, 0.78),
      },
    ];

    return { context: strategicContext, horizons };
  }

  // ==========================================
  // DECIDE - Generate Decision Options
  // ==========================================

  async generateDecisionOptions(context: {
    decision_title: string;
    decision_description?: string;
    constraints?: any[];
    criteria?: any[];
  }): Promise<{
    options: Partial<DecisionOption>[];
  }> {
    await delay(1800);

    const options: Partial<DecisionOption>[] = [
      {
        id: uuid(),
        title: 'Aggressive Approach',
        description: 'Focus all resources on immediate delivery, accepting higher risk of quality issues.',
        pros: [
          { point: 'Fastest time to completion', weight: 0.9 },
          { point: 'Demonstrates urgency and commitment', weight: 0.7 },
          { point: 'Creates momentum for team', weight: 0.6 },
        ],
        cons: [
          { point: 'Higher risk of bugs or rework', weight: 0.8 },
          { point: 'Team burnout potential', weight: 0.7 },
          { point: 'May cut corners on documentation', weight: 0.5 },
        ],
        estimated_outcomes: {
          best_case: 'Delivered on time with minor issues',
          worst_case: 'Delivered on time but significant rework needed',
          most_likely: 'Delivered on time with some quality issues',
          metrics: { completion_probability: 0.85, quality_score: 0.7, team_satisfaction: 0.5 },
        },
        resource_requirements: { time: '40 hours', cost: 0, people: 5 },
        risks: [{ description: 'Quality issues post-delivery', likelihood: 0.4, impact: 'high' }],
        confidence: confidence(0.7, 0.82),
        score: 7.2,
        rank: 2,
        is_recommended: false,
      },
      {
        id: uuid(),
        title: 'Balanced Approach',
        description: 'Prioritize critical features, defer non-essential items, maintain quality standards.',
        pros: [
          { point: 'Good balance of speed and quality', weight: 0.85 },
          { point: 'Sustainable team pace', weight: 0.8 },
          { point: 'Clear prioritization logic', weight: 0.7 },
        ],
        cons: [
          { point: 'Some features deferred', weight: 0.6 },
          { point: 'Requires scope negotiation', weight: 0.5 },
          { point: 'Slightly longer timeline', weight: 0.4 },
        ],
        estimated_outcomes: {
          best_case: 'Core features delivered with high quality',
          worst_case: 'Scope reduction disappoints stakeholders',
          most_likely: 'Successful delivery of prioritized features',
          metrics: { completion_probability: 0.95, quality_score: 0.85, team_satisfaction: 0.8 },
        },
        resource_requirements: { time: '35 hours', cost: 0, people: 4 },
        risks: [{ description: 'Stakeholder pushback on deferrals', likelihood: 0.3, impact: 'medium' }],
        confidence: confidence(0.8, 0.9),
        score: 8.5,
        rank: 1,
        is_recommended: true,
      },
      {
        id: uuid(),
        title: 'External Support',
        description: 'Bring in contractor support to maintain timeline without overworking team.',
        pros: [
          { point: 'Maintains timeline without burnout', weight: 0.8 },
          { point: 'Fresh perspective on problems', weight: 0.5 },
          { point: 'Team learns from contractor', weight: 0.4 },
        ],
        cons: [
          { point: 'Budget impact', weight: 0.7 },
          { point: 'Onboarding time required', weight: 0.6 },
          { point: 'Coordination overhead', weight: 0.5 },
        ],
        estimated_outcomes: {
          best_case: 'Full delivery with fresh perspectives',
          worst_case: 'Contractor integration issues slow things down',
          most_likely: 'Partial acceleration with some coordination overhead',
          metrics: { completion_probability: 0.9, quality_score: 0.8, team_satisfaction: 0.75 },
        },
        resource_requirements: { time: '25 hours', cost: 5000, people: 4 },
        risks: [{ description: 'Contractor availability issues', likelihood: 0.25, impact: 'medium' }],
        confidence: confidence(0.65, 0.78),
        score: 7.8,
        rank: 3,
        is_recommended: false,
      },
    ];

    return { options };
  }

  // ==========================================
  // ACT - Generate Execution Plan
  // ==========================================

  async generateExecutionPlan(decision: {
    title: string;
    selected_option: Partial<DecisionOption>;
  }): Promise<{
    title: string;
    description: string;
    steps: Partial<ExecutionStep>[];
    estimated_duration_hours: number;
  }> {
    await delay(1600);

    const steps: Partial<ExecutionStep>[] = [
      {
        id: uuid(),
        step_number: 1,
        title: 'Scope review and finalization',
        description: 'Review current scope, identify must-have vs nice-to-have features',
        status: 'pending',
        priority: 'high',
        completion_criteria: [
          { description: 'Scope document updated', met: false },
          { description: 'Stakeholder sign-off received', met: false },
        ],
        dependencies: [],
        estimated_duration_minutes: 60,
        assigned_to: 'Project Lead',
      },
      {
        id: uuid(),
        step_number: 2,
        title: 'Task prioritization and assignment',
        description: 'Assign tasks based on priority and team expertise',
        status: 'pending',
        priority: 'high',
        completion_criteria: [
          { description: 'All critical tasks assigned', met: false },
          { description: 'Team capacity confirmed', met: false },
        ],
        dependencies: [{ step_id: 'step-1', type: 'required' }],
        estimated_duration_minutes: 45,
        assigned_to: 'Project Lead',
      },
      {
        id: uuid(),
        step_number: 3,
        title: 'Execute critical path tasks',
        description: 'Focus on highest-priority deliverables',
        status: 'pending',
        priority: 'critical',
        completion_criteria: [
          { description: 'Core features complete', met: false },
          { description: 'Initial testing passed', met: false },
        ],
        dependencies: [{ step_id: 'step-2', type: 'required' }],
        estimated_duration_minutes: 480,
        assigned_to: 'Development Team',
      },
      {
        id: uuid(),
        step_number: 4,
        title: 'Quality verification',
        description: 'Run test suite and review output quality',
        status: 'pending',
        priority: 'high',
        completion_criteria: [
          { description: 'Test pass rate > 95%', met: false },
          { description: 'No critical bugs', met: false },
        ],
        dependencies: [{ step_id: 'step-3', type: 'required' }],
        estimated_duration_minutes: 120,
        assigned_to: 'QA Lead',
      },
      {
        id: uuid(),
        step_number: 5,
        title: 'Stakeholder review and delivery',
        description: 'Present deliverables and get final approval',
        status: 'pending',
        priority: 'medium',
        completion_criteria: [
          { description: 'Stakeholder approval', met: false },
          { description: 'Delivery confirmed', met: false },
        ],
        dependencies: [{ step_id: 'step-4', type: 'required' }],
        estimated_duration_minutes: 60,
        assigned_to: 'Project Lead',
      },
    ];

    return {
      title: `Execution Plan: ${decision.title}`,
      description: `Plan to execute "${decision.selected_option.title}" approach`,
      steps,
      estimated_duration_hours: 12.75,
    };
  }

  // ==========================================
  // ACT - Get Copilot Guidance
  // ==========================================

  async getCopilotGuidance(status: {
    current_step: Partial<ExecutionStep>;
    plan_health: number;
    blockers?: string[];
  }): Promise<{
    suggestions: Partial<CopilotSuggestion>[];
    health_assessment: {
      score: number;
      on_track: boolean;
      issues: string[];
      predictions: Array<{ prediction: string; confidence: number }>;
    };
  }> {
    await delay(1200);

    const suggestions: Partial<CopilotSuggestion>[] = [
      {
        type: 'guidance',
        content: 'Consider breaking this step into smaller sub-tasks for better tracking',
        priority: 'high',
        confidence: confidence(0.75, 0.85),
      },
      {
        type: 'warning',
        content: 'Current pace suggests step may take 20% longer than estimated',
        priority: 'medium',
        confidence: confidence(0.65, 0.78),
      },
      {
        type: 'optimization',
        content: 'Similar past tasks completed faster when done before noon',
        priority: 'low',
        confidence: confidence(0.6, 0.72),
      },
    ];

    const health_assessment = {
      score: status.plan_health || 0.8,
      on_track: (status.plan_health || 0.8) >= 0.7,
      issues: status.blockers || [],
      predictions: [
        { prediction: 'Plan completion by deadline: likely', confidence: confidence(0.7, 0.85) },
        { prediction: 'No additional blockers expected', confidence: confidence(0.6, 0.75) },
      ],
    };

    return { suggestions, health_assessment };
  }

  // ==========================================
  // ACT - Capture Learning
  // ==========================================

  async captureLearning(plan: any, outcome: any): Promise<{
    lessons: Partial<Lesson>[];
  }> {
    await delay(1400);

    const lessons: Partial<Lesson>[] = [
      {
        id: uuid(),
        learning_type: 'pattern',
        title: 'Scope negotiation reduces delivery risk',
        description: 'When facing tight deadlines, early scope discussion with stakeholders led to better outcomes than attempting to deliver everything.',
        pattern: { trigger: 'tight_deadline', action: 'scope_negotiation', result: 'improved_delivery' },
        context_tags: ['deadline', 'stakeholder', 'scope'],
        confidence: confidence(0.75, 0.88),
        is_active: true,
      },
      {
        id: uuid(),
        learning_type: 'best_practice',
        title: 'Daily progress checks improve visibility',
        description: 'Brief daily check-ins helped identify blockers earlier and improved team coordination.',
        pattern: { trigger: 'multi_day_task', action: 'daily_checkin', result: 'early_blocker_detection' },
        context_tags: ['tracking', 'communication', 'blockers'],
        confidence: confidence(0.7, 0.82),
        is_active: true,
      },
    ];

    return { lessons };
  }
}

// Export singleton instance
export const mockOracleGeminiService = new MockOracleGeminiService();
