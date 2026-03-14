/**
 * ORACLE Demo Data Seeder
 * Story post-16 - Populate sample ORACLE data for testing
 *
 * Usage: npx tsx src/scripts/seed-oracle-demo.ts
 */

import type {
  Signal,
  SignalCluster,
  StrategicContext,
  StrategicHorizon,
  Decision,
  DecisionOption,
  SimulationResult,
  ExecutionPlan,
  ExecutionStep,
  Prediction,
  GhostAction,
} from '@mission-control/shared-types';

// Demo user ID
const DEMO_USER_ID = 'demo-user-001';

// ==========================================
// Sample Signals
// ==========================================

export function createSampleSignals(): Partial<Signal>[] {
  const now = new Date();

  return [
    {
      id: 'signal-001',
      user_id: DEMO_USER_ID,
      signal_type: 'deadline',
      title: 'Project Alpha Milestone Due',
      description: 'Critical milestone for Project Alpha is due in 2 days. Current progress at 75%.',
      urgency: 'high',
      impact: 'high',
      confidence: 0.92,
      status: 'active',
      source_data: { project: 'Alpha', milestone: 'MVP Release' },
      expires_at: new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString(),
      created_at: now.toISOString(),
      metadata: { category: 'work', priority_score: 0.88 },
    },
    {
      id: 'signal-002',
      user_id: DEMO_USER_ID,
      signal_type: 'conflict',
      title: 'Meeting Overlap Detected',
      description: 'Design review and stakeholder call scheduled for same time slot tomorrow.',
      urgency: 'medium',
      impact: 'medium',
      confidence: 1.0,
      status: 'active',
      source_data: { meeting1: 'Design Review', meeting2: 'Stakeholder Call' },
      created_at: now.toISOString(),
      metadata: { requires_action: true },
    },
    {
      id: 'signal-003',
      user_id: DEMO_USER_ID,
      signal_type: 'opportunity',
      title: 'Potential Partnership Discussion',
      description: 'Email from TechCorp expressing interest in collaboration opportunity.',
      urgency: 'medium',
      impact: 'high',
      confidence: 0.78,
      status: 'active',
      source_data: { sender: 'partnerships@techcorp.com', subject: 'Collaboration Interest' },
      created_at: now.toISOString(),
      metadata: { follow_up_needed: true },
    },
    {
      id: 'signal-004',
      user_id: DEMO_USER_ID,
      signal_type: 'risk',
      title: 'Budget Variance Alert',
      description: 'Q1 spending 15% over projected budget in marketing category.',
      urgency: 'high',
      impact: 'high',
      confidence: 0.95,
      status: 'active',
      source_data: { category: 'marketing', variance_pct: 15 },
      created_at: now.toISOString(),
      metadata: { threshold_exceeded: true },
    },
    {
      id: 'signal-005',
      user_id: DEMO_USER_ID,
      signal_type: 'anomaly',
      title: 'Unusual Traffic Pattern',
      description: 'Website traffic 40% higher than typical Tuesday average.',
      urgency: 'low',
      impact: 'medium',
      confidence: 0.85,
      status: 'active',
      source_data: { increase_pct: 40, baseline: 'tuesday_avg' },
      created_at: now.toISOString(),
      metadata: { investigation_needed: true },
    },
    {
      id: 'signal-006',
      user_id: DEMO_USER_ID,
      signal_type: 'pattern',
      title: 'Weekly Review Due',
      description: 'Based on your pattern, weekly review typically done on Fridays.',
      urgency: 'low',
      impact: 'low',
      confidence: 0.88,
      status: 'active',
      source_data: { pattern_type: 'weekly_review', day: 'Friday' },
      created_at: now.toISOString(),
      metadata: { auto_generated: true },
    },
  ];
}

// ==========================================
// Sample Signal Clusters
// ==========================================

export function createSampleClusters(): Partial<SignalCluster>[] {
  return [
    {
      id: 'cluster-001',
      user_id: DEMO_USER_ID,
      label: 'Project Alpha Pressure',
      summary: 'Related signals concerning Project Alpha deadline and resource allocation.',
      combined_urgency: 'high',
      combined_impact: 'high',
      confidence: 0.9,
      signal_count: 2,
      created_at: new Date().toISOString(),
      metadata: { dominant_theme: 'deadline_pressure' },
    },
    {
      id: 'cluster-002',
      user_id: DEMO_USER_ID,
      label: 'External Opportunities',
      summary: 'Inbound opportunities requiring strategic decision.',
      combined_urgency: 'medium',
      combined_impact: 'high',
      confidence: 0.78,
      signal_count: 1,
      created_at: new Date().toISOString(),
      metadata: { requires_decision: true },
    },
  ];
}

// ==========================================
// Sample Strategic Context
// ==========================================

export function createSampleContext(): Partial<StrategicContext> {
  return {
    id: 'context-001',
    user_id: DEMO_USER_ID,
    situation_summary: 'High-pressure week with Project Alpha milestone approaching. Multiple competing priorities including partnership opportunity and budget concerns. Calendar conflicts need resolution.',
    key_factors: [
      { factor: 'Project Alpha Deadline', importance: 0.95, trend: 'declining' },
      { factor: 'Budget Overrun', importance: 0.8, trend: 'stable' },
      { factor: 'Partnership Opportunity', importance: 0.6, trend: 'improving' },
      { factor: 'Team Capacity', importance: 0.7, trend: 'stable' },
    ],
    recommendations: [
      { action: 'Prioritize Project Alpha tasks for next 48 hours', priority: 'critical', rationale: 'Imminent deadline with incomplete deliverables' },
      { action: 'Schedule budget review meeting this week', priority: 'high', rationale: 'Budget variance exceeds threshold' },
      { action: 'Delegate partnership follow-up to business development', priority: 'medium', rationale: 'Opportunity requires timely response but is not urgent' },
      { action: 'Resolve calendar conflicts before tomorrow', priority: 'high', rationale: 'Overlapping meetings need immediate resolution' },
    ],
    constraints: [
      { description: 'Fixed deadline for Project Alpha milestone', type: 'time' },
      { description: 'Q1 budget ceiling cannot be exceeded', type: 'resource' },
      { description: 'Key team members on PTO next week', type: 'resource' },
    ],
    confidence: 0.85,
    valid_until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date().toISOString(),
    metadata: { source_signal_count: 6 },
  };
}

// ==========================================
// Sample Horizons
// ==========================================

export function createSampleHorizons(): Partial<StrategicHorizon>[] {
  const contextId = 'context-001';

  return [
    {
      id: 'horizon-001',
      user_id: DEMO_USER_ID,
      context_id: contextId,
      horizon_type: 'immediate',
      goals: [
        { description: 'Complete design review', priority: 1, measurable_outcome: 'Design approved by stakeholders' },
        { description: 'Resolve calendar conflict', priority: 2, measurable_outcome: 'No overlapping meetings remain' },
        { description: 'Send partnership acknowledgment', priority: 3, measurable_outcome: 'Response email sent' },
      ],
      actions: [
        { description: 'Reschedule stakeholder call', priority: 'high', estimated_effort: '5 min', assignee: 'self' },
        { description: 'Review design mockups', priority: 'high', estimated_effort: '30 min', assignee: 'self' },
        { description: 'Draft partnership response email', priority: 'medium', estimated_effort: '15 min', assignee: 'self' },
      ],
      dependencies: [
        { description: 'Access to design files', blocking: true },
        { description: 'Stakeholder availability', blocking: false, resolution_strategy: 'Check calendar for open slots' },
      ],
      risks: [
        { description: 'Stakeholder unavailable for reschedule', likelihood: 0.3, impact: 'medium' },
      ],
      confidence: 0.9,
      created_at: new Date().toISOString(),
    },
    {
      id: 'horizon-002',
      user_id: DEMO_USER_ID,
      context_id: contextId,
      horizon_type: 'today',
      goals: [
        { description: 'Make significant progress on Project Alpha', priority: 1, measurable_outcome: '3 features completed' },
        { description: 'Address budget variance', priority: 2, measurable_outcome: 'Budget analysis document created' },
        { description: 'Clear inbox', priority: 3, measurable_outcome: 'Priority emails processed' },
      ],
      actions: [
        { description: 'Complete 3 remaining Alpha features', priority: 'critical', estimated_effort: '4 hours', assignee: 'self' },
        { description: 'Analyze marketing spend breakdown', priority: 'high', estimated_effort: '1 hour', assignee: 'self' },
        { description: 'Process priority emails', priority: 'medium', estimated_effort: '30 min', assignee: 'self' },
      ],
      dependencies: [
        { description: 'No unexpected meetings', blocking: false },
        { description: 'Design team availability', blocking: true, resolution_strategy: 'Ping design lead in Slack' },
      ],
      risks: [
        { description: 'Unexpected urgent issues', likelihood: 0.4, impact: 'high' },
        { description: 'Technical blockers', likelihood: 0.3, impact: 'high' },
      ],
      confidence: 0.75,
      created_at: new Date().toISOString(),
    },
    {
      id: 'horizon-003',
      user_id: DEMO_USER_ID,
      context_id: contextId,
      horizon_type: 'week',
      goals: [
        { description: 'Deliver Project Alpha milestone', priority: 1, measurable_outcome: 'MVP deployed and approved' },
        { description: 'Implement budget controls', priority: 2, measurable_outcome: 'Spending guardrails in place' },
        { description: 'Advance partnership discussion', priority: 3, measurable_outcome: 'Discovery call scheduled' },
      ],
      actions: [
        { description: 'Complete Alpha MVP', priority: 'critical', estimated_effort: '2 days', assignee: 'self' },
        { description: 'Budget review with finance', priority: 'high', estimated_effort: '1 hour', assignee: 'self' },
        { description: 'Partnership discovery call', priority: 'medium', estimated_effort: '30 min', assignee: 'self' },
      ],
      dependencies: [
        { description: 'QA resources', blocking: true },
        { description: 'Finance team availability', blocking: false, resolution_strategy: 'Book through EA' },
      ],
      risks: [
        { description: 'Sprint incomplete due to capacity', likelihood: 0.5, impact: 'high' },
        { description: 'Budget request rejected', likelihood: 0.2, impact: 'medium' },
      ],
      confidence: 0.7,
      created_at: new Date().toISOString(),
    },
  ];
}

// ==========================================
// Sample Decision with Options
// ==========================================

export function createSampleDecision(): Partial<Decision> {
  return {
    id: 'decision-001',
    user_id: DEMO_USER_ID,
    context_id: 'context-001',
    title: 'Project Alpha Resource Allocation',
    description: 'Decide how to allocate remaining development resources to meet the milestone deadline.',
    status: 'analyzing',
    deadline: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
    created_at: new Date().toISOString(),
    metadata: { urgency: 'high', impact_area: 'delivery' },
  };
}

export function createSampleOptions(): Partial<DecisionOption>[] {
  const decisionId = 'decision-001';

  return [
    {
      id: 'option-001',
      decision_id: decisionId,
      title: 'All-hands Sprint',
      description: 'Pull all available developers onto Project Alpha for 48-hour focused sprint.',
      pros: [
        { point: 'Maximizes chance of on-time delivery', weight: 0.9 },
        { point: 'Demonstrates team commitment', weight: 0.6 },
        { point: 'Creates focused momentum', weight: 0.7 },
      ],
      cons: [
        { point: 'Delays other projects', weight: 0.8 },
        { point: 'Risk of developer burnout', weight: 0.7 },
        { point: 'May impact code quality', weight: 0.6 },
      ],
      risks: [
        { description: 'Team fatigue', likelihood: 0.6, impact: 'high' },
        { description: 'Other project delays', likelihood: 0.8, impact: 'medium' },
        { description: 'Technical debt accumulation', likelihood: 0.5, impact: 'medium' },
      ],
      confidence: 0.78,
      score: 7.2,
      rank: 2,
      is_recommended: false,
    },
    {
      id: 'option-002',
      decision_id: decisionId,
      title: 'Scope Reduction',
      description: 'Reduce milestone scope by deferring non-critical features to next release.',
      pros: [
        { point: 'Reduces pressure on team', weight: 0.8 },
        { point: 'Maintains code quality', weight: 0.9 },
        { point: 'Keeps other projects on track', weight: 0.7 },
      ],
      cons: [
        { point: 'May disappoint stakeholders', weight: 0.6 },
        { point: 'Deferred features add to backlog', weight: 0.5 },
        { point: 'Perception of missing commitment', weight: 0.4 },
      ],
      risks: [
        { description: 'Stakeholder disappointment', likelihood: 0.4, impact: 'medium' },
        { description: 'Feature backlog growth', likelihood: 0.7, impact: 'low' },
      ],
      confidence: 0.82,
      score: 8.5,
      rank: 1,
      is_recommended: true,
    },
    {
      id: 'option-003',
      decision_id: decisionId,
      title: 'External Contractor Support',
      description: 'Bring in pre-vetted contractor to help with specific components.',
      pros: [
        { point: 'Additional capacity without burnout', weight: 0.8 },
        { point: 'Contractor has relevant experience', weight: 0.6 },
        { point: 'Team can focus on core features', weight: 0.7 },
      ],
      cons: [
        { point: 'Additional cost', weight: 0.7 },
        { point: 'Onboarding overhead', weight: 0.6 },
        { point: 'Quality control needed', weight: 0.5 },
      ],
      risks: [
        { description: 'Budget impact', likelihood: 0.9, impact: 'medium' },
        { description: 'Integration issues', likelihood: 0.4, impact: 'high' },
        { description: 'Onboarding time', likelihood: 0.6, impact: 'low' },
      ],
      confidence: 0.65,
      score: 6.8,
      rank: 3,
      is_recommended: false,
    },
  ];
}

// ==========================================
// Sample Simulation Result
// ==========================================

export function createSampleSimulation(): Partial<SimulationResult> {
  return {
    id: 'simulation-001',
    option_id: 'option-002',
    iterations: 1000,
    mean_outcome: 38.5,
    std_deviation: 8.2,
    percentiles: {
      p5: 26,
      p25: 33,
      p50: 38,
      p75: 44,
      p95: 52,
    },
    distribution: [
      { bucket: 25, count: 45, percentage: 4.5 },
      { bucket: 30, count: 120, percentage: 12 },
      { bucket: 35, count: 235, percentage: 23.5 },
      { bucket: 40, count: 280, percentage: 28 },
      { bucket: 45, count: 195, percentage: 19.5 },
      { bucket: 50, count: 95, percentage: 9.5 },
      { bucket: 55, count: 30, percentage: 3 },
    ],
    created_at: new Date().toISOString(),
    metadata: { factors_count: 5, timeout_reached: false },
  };
}

// ==========================================
// Sample Execution Plan with Steps
// ==========================================

export function createSamplePlan(): Partial<ExecutionPlan> {
  return {
    id: 'plan-001',
    user_id: DEMO_USER_ID,
    decision_id: 'decision-001',
    title: 'Project Alpha Scope Reduction Plan',
    status: 'active',
    health_score: 0.85,
    progress_percentage: 0.35,
    total_steps: 5,
    completed_steps: 2,
    blocked_steps: 0,
    started_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    metadata: { estimated_completion: '36 hours' },
  };
}

export function createSampleSteps(): Partial<ExecutionStep>[] {
  const planId = 'plan-001';

  return [
    {
      id: 'step-001',
      plan_id: planId,
      step_number: 1,
      title: 'Identify deferrable features',
      description: 'Review feature list and identify non-critical items that can be deferred.',
      status: 'completed',
      estimated_duration_minutes: 30,
      actual_duration_minutes: 25,
      started_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
      completed_at: new Date(Date.now() - 3.5 * 60 * 60 * 1000).toISOString(),
      created_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
      metadata: { deferred_count: 3 },
    },
    {
      id: 'step-002',
      plan_id: planId,
      step_number: 2,
      title: 'Communicate changes to stakeholders',
      description: 'Send scope change notification to PM and key stakeholders.',
      status: 'completed',
      estimated_duration_minutes: 15,
      actual_duration_minutes: 20,
      started_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      completed_at: new Date(Date.now() - 2.5 * 60 * 60 * 1000).toISOString(),
      created_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
      metadata: { stakeholders_notified: 3 },
    },
    {
      id: 'step-003',
      plan_id: planId,
      step_number: 3,
      title: 'Update project board',
      description: 'Move deferred items to backlog, update sprint scope.',
      status: 'in_progress',
      estimated_duration_minutes: 20,
      started_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      created_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
      metadata: {},
    },
    {
      id: 'step-004',
      plan_id: planId,
      step_number: 4,
      title: 'Complete core features',
      description: 'Focus development effort on remaining core milestone features.',
      status: 'pending',
      estimated_duration_minutes: 480,
      created_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
      metadata: { features_remaining: 4 },
    },
    {
      id: 'step-005',
      plan_id: planId,
      step_number: 5,
      title: 'QA and milestone sign-off',
      description: 'Run QA tests and get milestone approval.',
      status: 'pending',
      estimated_duration_minutes: 120,
      created_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
      metadata: {},
    },
  ];
}

// ==========================================
// Sample Predictions with Outcomes
// ==========================================

export function createSamplePredictions(): Array<{
  prediction: Partial<Prediction>;
  outcome?: { actual_outcome: boolean };
}> {
  return [
    {
      prediction: {
        id: 'prediction-001',
        user_id: DEMO_USER_ID,
        subject_type: 'milestone',
        subject_id: 'project-alpha-mvp',
        description: 'Project Alpha MVP will be delivered on time',
        confidence: 0.72,
        factors: [
          { name: 'team_velocity', value: 0.8, weight: 0.4, direction: 'positive' },
          { name: 'scope_clarity', value: 0.9, weight: 0.3, direction: 'positive' },
          { name: 'external_dependencies', value: 0.6, weight: 0.3, direction: 'negative' },
        ],
        decay_rate: 0.01,
        created_at: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(),
        metadata: {},
      },
      outcome: { actual_outcome: true },
    },
    {
      prediction: {
        id: 'prediction-002',
        user_id: DEMO_USER_ID,
        subject_type: 'meeting',
        subject_id: 'stakeholder-approval',
        description: 'Stakeholders will approve the scope reduction',
        confidence: 0.85,
        factors: [
          { name: 'previous_flexibility', value: 0.9, weight: 0.5, direction: 'positive' },
          { name: 'communication_quality', value: 0.8, weight: 0.3, direction: 'positive' },
          { name: 'deadline_pressure', value: 0.7, weight: 0.2, direction: 'positive' },
        ],
        decay_rate: 0.02,
        created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        metadata: {},
      },
      outcome: { actual_outcome: true },
    },
    {
      prediction: {
        id: 'prediction-003',
        user_id: DEMO_USER_ID,
        subject_type: 'budget',
        subject_id: 'q1-marketing',
        description: 'Marketing budget will stay within 10% variance',
        confidence: 0.55,
        factors: [
          { name: 'current_variance', value: 0.3, weight: 0.5, direction: 'negative' },
          { name: 'remaining_quarter', value: 0.8, weight: 0.3, direction: 'positive' },
          { name: 'pending_commitments', value: 0.6, weight: 0.2, direction: 'negative' },
        ],
        decay_rate: 0.001,
        created_at: new Date().toISOString(),
        metadata: {},
      },
      // No outcome yet - prediction is still open
    },
    {
      prediction: {
        id: 'prediction-004',
        user_id: DEMO_USER_ID,
        subject_type: 'opportunity',
        subject_id: 'techcorp-partnership',
        description: 'TechCorp partnership discussion will progress to next stage',
        confidence: 0.68,
        factors: [
          { name: 'initial_interest', value: 0.9, weight: 0.4, direction: 'positive' },
          { name: 'alignment_score', value: 0.7, weight: 0.4, direction: 'positive' },
          { name: 'timing_fit', value: 0.5, weight: 0.2, direction: 'neutral' },
        ],
        decay_rate: 0.005,
        created_at: new Date().toISOString(),
        metadata: {},
      },
      // No outcome yet
    },
  ];
}

// ==========================================
// Sample Ghost Actions
// ==========================================

export function createSampleGhostActions(): Partial<GhostAction>[] {
  return [
    {
      id: 'ghost-001',
      user_id: DEMO_USER_ID,
      action_type: 'send_message',
      title: 'Send partnership follow-up email',
      description: 'Acknowledge TechCorp partnership inquiry with next steps.',
      draft_action: {
        recipient: 'partnerships@techcorp.com',
        subject: 'Re: Collaboration Interest - Next Steps',
        body: 'Thank you for reaching out about collaboration opportunities. We would love to schedule a discovery call to explore how we might work together. Would next Tuesday or Wednesday work for a 30-minute call?',
      },
      trigger_conditions: {
        signal_based: ['signal-003'],
        time_based: '24h',
      },
      confidence: 0.88,
      status: 'pending',
      created_at: new Date().toISOString(),
      metadata: { auto_generated: true },
    },
    {
      id: 'ghost-002',
      user_id: DEMO_USER_ID,
      action_type: 'schedule_event',
      title: 'Schedule budget review',
      description: 'Set up meeting with finance team to review Q1 marketing spend.',
      draft_action: {
        title: 'Q1 Marketing Budget Review',
        attendees: ['finance@company.com', 'marketing-lead@company.com'],
        duration_minutes: 30,
        suggested_times: ['Tomorrow 2pm', 'Friday 10am'],
      },
      trigger_conditions: {
        signal_based: ['signal-004'],
      },
      confidence: 0.92,
      status: 'pending',
      created_at: new Date().toISOString(),
      metadata: { priority: 'high' },
    },
    {
      id: 'ghost-003',
      user_id: DEMO_USER_ID,
      action_type: 'create_task',
      title: 'Add traffic analysis to todo',
      description: 'Investigate unusual traffic spike on website.',
      draft_action: {
        title: 'Investigate Tuesday traffic spike',
        description: 'Traffic was 40% higher than normal. Check referrers, campaigns, and organic sources.',
        priority: 'low',
        due_date: 'end_of_week',
      },
      trigger_conditions: {
        signal_based: ['signal-005'],
      },
      confidence: 0.75,
      status: 'pending',
      created_at: new Date().toISOString(),
      metadata: {},
    },
  ];
}

// ==========================================
// Main Seeder Function
// ==========================================

export interface SeedResult {
  signals: Partial<Signal>[];
  clusters: Partial<SignalCluster>[];
  context: Partial<StrategicContext>;
  horizons: Partial<StrategicHorizon>[];
  decision: Partial<Decision>;
  options: Partial<DecisionOption>[];
  simulation: Partial<SimulationResult>;
  plan: Partial<ExecutionPlan>;
  steps: Partial<ExecutionStep>[];
  predictions: Array<{ prediction: Partial<Prediction>; outcome?: { actual_outcome: boolean } }>;
  ghostActions: Partial<GhostAction>[];
}

export function generateAllDemoData(): SeedResult {
  return {
    signals: createSampleSignals(),
    clusters: createSampleClusters(),
    context: createSampleContext(),
    horizons: createSampleHorizons(),
    decision: createSampleDecision(),
    options: createSampleOptions(),
    simulation: createSampleSimulation(),
    plan: createSamplePlan(),
    steps: createSampleSteps(),
    predictions: createSamplePredictions(),
    ghostActions: createSampleGhostActions(),
  };
}

// ==========================================
// CLI Entry Point
// ==========================================

async function main() {
  console.log('ORACLE Demo Data Seeder');
  console.log('========================\n');

  const data = generateAllDemoData();

  console.log('Generated demo data:');
  console.log(`  Signals: ${data.signals.length}`);
  console.log(`  Clusters: ${data.clusters.length}`);
  console.log(`  Context: 1`);
  console.log(`  Horizons: ${data.horizons.length}`);
  console.log(`  Decision: 1`);
  console.log(`  Options: ${data.options.length}`);
  console.log(`  Simulation: 1`);
  console.log(`  Plan: 1`);
  console.log(`  Steps: ${data.steps.length}`);
  console.log(`  Predictions: ${data.predictions.length}`);
  console.log(`  Ghost Actions: ${data.ghostActions.length}`);

  console.log('\n--- Sample Signal ---');
  console.log(JSON.stringify(data.signals[0], null, 2));

  console.log('\n--- Sample Context ---');
  console.log(JSON.stringify(data.context, null, 2));

  console.log('\n--- Sample Decision ---');
  console.log(JSON.stringify(data.decision, null, 2));

  console.log('\n--- Sample Option ---');
  console.log(JSON.stringify(data.options[0], null, 2));

  console.log('\n--- Sample Ghost Action ---');
  console.log(JSON.stringify(data.ghostActions[0], null, 2));

  console.log('\nDemo data generated successfully!');
  console.log('\nTo use in production, import and call generateAllDemoData()');
  console.log('Then insert the returned objects into your Supabase tables.');
}

// Run if called directly
main().catch(console.error);
