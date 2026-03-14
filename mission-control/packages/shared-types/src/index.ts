export interface User {
  id: string;
  email: string;
  created_at: string;
  subscription_tier: 'free' | 'pro';
}

export interface Mission {
  id: string;
  user_id: string;
  title: string;
  priority: 'low' | 'medium' | 'high';
  status: 'active' | 'completed' | 'archived';
  created_at: string;
  updated_at: string;
  metadata: Record<string, any>;
}

export interface Source {
  id: string;
  mission_id: string;
  type: 'image' | 'pdf' | 'audio' | 'text';
  file_path: string;
  processed_at?: string;
  created_at: string;
}

export interface Extract {
  id: string;
  source_id: string;
  data_type: 'fields' | 'entities' | 'risks' | 'translation';
  confidence: number;
  structured_data: Record<string, any>;
  created_at: string;
}

export interface Action {
  id: string;
  mission_id: string;
  source_id?: string;
  type: 'task' | 'event' | 'draft' | 'reminder';
  status: 'pending' | 'completed' | 'cancelled';
  title: string;
  description?: string;
  due_date?: string;
  metadata: Record<string, any>;
  created_at: string;
}

export interface Briefing {
  id: string;
  user_id: string;
  date: string;
  summary: string;
  priorities: Array<{
    title: string;
    urgency: 'high' | 'medium' | 'low';
    confidence: number;
  }>;
  time_windows: Array<{
    start: string;
    end: string;
    purpose: string;
  }>;
  recommended_actions: Array<{
    description: string;
    effort: 'low' | 'medium' | 'high';
    confidence: number;
  }>;
  created_at: string;
}

export interface Meeting {
  id: string;
  user_id: string;
  title?: string;
  audio_path?: string;
  transcript?: string;
  decisions: Array<{
    description: string;
    owner?: string;
    deadline?: string;
    confidence: number;
  }>;
  follow_ups: Array<{
    type: 'email' | 'task' | 'reminder';
    recipient?: string;
    content: string;
    confidence: number;
  }>;
  created_at: string;
}

export interface OverlayField {
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  confidence: number;
  type: 'field' | 'risk' | 'entity';
}

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  needs_user_confirmation?: boolean;
  confidence?: number;
}

// ============================================================================
// ORACLE AUTONOMOUS INTELLIGENCE LOOP TYPES
// ============================================================================

// ============================================================================
// OBSERVE MODULE INTERFACES
// ============================================================================

export type SignalType = 'deadline' | 'conflict' | 'opportunity' | 'risk' | 'anomaly' | 'pattern' | 'dependency' | 'resource';
export type UrgencyLevel = 'critical' | 'high' | 'medium' | 'low';
export type ImpactLevel = 'critical' | 'high' | 'medium' | 'low';
export type SignalStatus = 'active' | 'acknowledged' | 'dismissed' | 'resolved';

export interface Signal {
  id: string;
  user_id: string;
  data_source_id?: string;
  signal_type: SignalType;
  title: string;
  description?: string;
  urgency: UrgencyLevel;
  impact: ImpactLevel;
  confidence: number;
  status: SignalStatus;
  source_data: Record<string, any>;
  related_entity_type?: string;
  related_entity_id?: string;
  expires_at?: string;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface SignalCluster {
  id: string;
  user_id: string;
  label: string;
  summary?: string;
  signal_count: number;
  combined_urgency?: UrgencyLevel;
  combined_impact?: ImpactLevel;
  confidence: number;
  signals?: Signal[];
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export type AnomalyPatternType = 'deviation' | 'spike' | 'trend' | 'absence' | 'correlation' | 'custom';
export type SensitivityLevel = 'low' | 'medium' | 'high';

export interface AnomalyPattern {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  pattern_type: AnomalyPatternType;
  detection_rules: Record<string, any>;
  baseline_data: Record<string, any>;
  threshold: number;
  sensitivity: SensitivityLevel;
  is_active: boolean;
  last_triggered_at?: string;
  trigger_count: number;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export type DataSourceType = 'calendar' | 'email' | 'tasks' | 'notes' | 'meetings' | 'manual' | 'integration';

export interface DataSource {
  id: string;
  user_id: string;
  source_type: DataSourceType;
  name: string;
  config: Record<string, any>;
  is_active: boolean;
  last_scanned_at?: string;
  scan_frequency_minutes: number;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface RadarScanResult {
  scan_id: string;
  scanned_at: string;
  signals: Signal[];
  clusters: SignalCluster[];
  anomalies_detected: number;
  sources_scanned: string[];
  duration_ms: number;
  metadata: Record<string, any>;
}

// ============================================================================
// ORIENT MODULE INTERFACES
// ============================================================================

export interface StrategicContext {
  id: string;
  user_id: string;
  situation_summary: string;
  key_factors: Array<{
    factor: string;
    importance: number;
    trend?: 'improving' | 'stable' | 'declining';
  }>;
  recommendations: Array<{
    action: string;
    priority: UrgencyLevel;
    rationale: string;
  }>;
  constraints: Array<{
    description: string;
    type: 'time' | 'resource' | 'dependency' | 'policy' | 'other';
  }>;
  assumptions: Array<{
    description: string;
    confidence: number;
  }>;
  confidence: number;
  is_active: boolean;
  valid_until?: string;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export type HorizonType = 'immediate' | 'today' | 'week' | 'month';

export interface StrategicHorizon {
  id: string;
  context_id: string;
  user_id: string;
  horizon_type: HorizonType;
  goals: Array<{
    description: string;
    priority: number;
    measurable_outcome?: string;
  }>;
  actions: Array<{
    description: string;
    priority: UrgencyLevel;
    estimated_effort?: string;
    assignee?: string;
  }>;
  dependencies: Array<{
    description: string;
    blocking: boolean;
    resolution_strategy?: string;
  }>;
  risks: Array<{
    description: string;
    likelihood: number;
    impact: ImpactLevel;
  }>;
  opportunities: Array<{
    description: string;
    potential_value: ImpactLevel;
    time_sensitivity?: string;
  }>;
  priority_score: number;
  confidence: number;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export type CorrelationType = 'causal' | 'temporal' | 'semantic' | 'dependency' | 'conflict' | 'synergy';
export type CorrelationDirection = 'forward' | 'backward' | 'bidirectional';

export interface Correlation {
  id: string;
  user_id: string;
  source_entity_type: string;
  source_entity_id: string;
  target_entity_type: string;
  target_entity_id: string;
  correlation_type: CorrelationType;
  strength: number; // -1 to 1
  direction: CorrelationDirection;
  description?: string;
  evidence: Array<{
    description: string;
    source: string;
    weight: number;
  }>;
  confidence: number;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export type AssessmentType = 'risk' | 'opportunity';
export type AssessmentStatus = 'identified' | 'analyzing' | 'mitigating' | 'accepted' | 'resolved';

export interface RiskOpportunityAssessment {
  id: string;
  context_id?: string;
  user_id: string;
  assessment_type: AssessmentType;
  title: string;
  description?: string;
  impact_level: ImpactLevel;
  likelihood: number;
  urgency: UrgencyLevel;
  mitigations: Array<{
    action: string;
    effectiveness: number;
    cost: 'low' | 'medium' | 'high';
  }>;
  related_signals: string[];
  status: AssessmentStatus;
  confidence: number;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// DECIDE MODULE INTERFACES
// ============================================================================

export type DecisionType = 'strategic' | 'tactical' | 'operational' | 'general';
export type DecisionStatus = 'pending' | 'analyzing' | 'decided' | 'executed' | 'cancelled';

export interface Decision {
  id: string;
  context_id?: string;
  user_id: string;
  title: string;
  description?: string;
  decision_type: DecisionType;
  status: DecisionStatus;
  urgency: UrgencyLevel;
  deadline?: string;
  selected_option_id?: string;
  decision_rationale?: string;
  confidence: number;
  constraints: Array<{
    description: string;
    type: string;
    hard: boolean;
  }>;
  criteria: Array<{
    name: string;
    weight: number;
    description?: string;
  }>;
  options?: DecisionOption[];
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
  decided_at?: string;
}

export interface DecisionOption {
  id: string;
  decision_id: string;
  title: string;
  description?: string;
  pros: Array<{
    point: string;
    weight: number;
  }>;
  cons: Array<{
    point: string;
    weight: number;
  }>;
  estimated_outcomes: {
    best_case?: string;
    worst_case?: string;
    most_likely?: string;
    metrics?: Record<string, number>;
  };
  resource_requirements: {
    time?: string;
    cost?: number;
    people?: number;
    dependencies?: string[];
  };
  risks: Array<{
    description: string;
    likelihood: number;
    impact: ImpactLevel;
  }>;
  confidence: number;
  score?: number;
  rank?: number;
  is_recommended: boolean;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface SimulationResult {
  id: string;
  option_id: string;
  user_id: string;
  simulation_type: 'monte_carlo' | 'sensitivity' | 'scenario';
  iterations: number;
  results: Record<string, any>;
  mean_outcome: number;
  std_deviation: number;
  percentiles: {
    p5: number;
    p25: number;
    p50: number;
    p75: number;
    p95: number;
  };
  distribution: Array<{
    bucket: number;
    count: number;
    percentage: number;
  }>;
  confidence_interval_low: number;
  confidence_interval_high: number;
  execution_time_ms: number;
  metadata: Record<string, any>;
  created_at: string;
}

export interface CriticalPath {
  id: string;
  decision_id: string;
  option_id?: string;
  user_id: string;
  steps: Array<{
    id: string;
    name: string;
    duration_hours: number;
    dependencies: string[];
    resources: string[];
  }>;
  dependencies: Array<{
    from_step: string;
    to_step: string;
    type: 'finish_to_start' | 'start_to_start' | 'finish_to_finish';
  }>;
  bottlenecks: Array<{
    step_id: string;
    reason: string;
    severity: ImpactLevel;
  }>;
  total_duration_hours: number;
  critical_sequence: string[];
  parallel_tracks: Array<{
    track_id: string;
    steps: string[];
  }>;
  risk_points: Array<{
    step_id: string;
    risk: string;
    mitigation?: string;
  }>;
  confidence: number;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export type StakeholderInputType = 'approval' | 'opinion' | 'constraint' | 'requirement' | 'veto';
export type StakeholderSentiment = 'positive' | 'negative' | 'neutral' | 'mixed';

export interface StakeholderInput {
  id: string;
  decision_id: string;
  user_id: string;
  stakeholder_name: string;
  stakeholder_role?: string;
  input_type: StakeholderInputType;
  content: string;
  sentiment?: StakeholderSentiment;
  weight: number;
  status: 'pending' | 'acknowledged' | 'incorporated' | 'rejected';
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// ACT MODULE INTERFACES
// ============================================================================

export type PlanStatus = 'draft' | 'active' | 'paused' | 'completed' | 'cancelled' | 'failed';
export type StepStatus = 'pending' | 'in_progress' | 'completed' | 'blocked' | 'skipped';

export interface ExecutionPlan {
  id: string;
  decision_id?: string;
  user_id: string;
  title: string;
  description?: string;
  status: PlanStatus;
  health_score: number;
  progress_percentage: number;
  total_steps: number;
  completed_steps: number;
  blocked_steps: number;
  estimated_completion?: string;
  actual_completion?: string;
  started_at?: string;
  steps?: ExecutionStep[];
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface ExecutionStep {
  id: string;
  plan_id: string;
  parent_step_id?: string;
  step_number: number;
  title: string;
  description?: string;
  status: StepStatus;
  priority: UrgencyLevel;
  completion_criteria: Array<{
    description: string;
    met: boolean;
  }>;
  blockers: Array<{
    description: string;
    severity: ImpactLevel;
    resolution?: string;
  }>;
  dependencies: Array<{
    step_id: string;
    type: 'required' | 'optional';
  }>;
  estimated_duration_minutes?: number;
  actual_duration_minutes?: number;
  assigned_to?: string;
  due_date?: string;
  started_at?: string;
  completed_at?: string;
  notes?: string;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export type ProgressUpdateType = 'status_change' | 'note' | 'blocker' | 'milestone' | 'adjustment' | 'completion';

export interface ProgressUpdate {
  id: string;
  plan_id: string;
  step_id?: string;
  user_id: string;
  update_type: ProgressUpdateType;
  content: string;
  previous_status?: string;
  new_status?: string;
  progress_delta?: number;
  metadata: Record<string, any>;
  created_at: string;
}

export type CopilotSuggestionType = 'guidance' | 'warning' | 'optimization' | 'encouragement' | 'pivot' | 'escalation';

export interface CopilotSuggestion {
  type: CopilotSuggestionType;
  content: string;
  priority: UrgencyLevel;
  action_required: boolean;
  suggested_action?: string;
  rationale?: string;
  confidence: number;
}

export interface CopilotState {
  current_step_id?: string;
  suggestions: CopilotSuggestion[];
  health_assessment: {
    overall: 'healthy' | 'at_risk' | 'critical';
    issues: string[];
    positives: string[];
  };
  predictions: {
    completion_likelihood: number;
    estimated_delay_hours?: number;
    risk_factors: string[];
  };
  last_updated: string;
}

export type OutcomeType = 'success' | 'partial_success' | 'failure' | 'cancelled' | 'pivoted';

export interface ExecutionOutcome {
  id: string;
  plan_id: string;
  decision_id?: string;
  user_id: string;
  outcome_type: OutcomeType;
  summary: string;
  actual_results: Record<string, any>;
  expected_results: Record<string, any>;
  variance_analysis: {
    positive_variances?: Array<{ metric: string; expected: number; actual: number }>;
    negative_variances?: Array<{ metric: string; expected: number; actual: number }>;
  };
  success_factors: string[];
  failure_factors: string[];
  recommendations: string[];
  confidence: number;
  metadata: Record<string, any>;
  created_at: string;
}

export type LearningType = 'pattern' | 'anti_pattern' | 'insight' | 'best_practice' | 'pitfall' | 'heuristic';

export interface Lesson {
  id: string;
  outcome_id?: string;
  user_id: string;
  learning_type: LearningType;
  title: string;
  description: string;
  pattern: {
    trigger?: string;
    context?: string;
    action?: string;
    result?: string;
  };
  context_tags: string[];
  applicability: {
    domains?: string[];
    scenarios?: string[];
    constraints?: string[];
  };
  confidence: number;
  times_applied: number;
  success_rate?: number;
  is_active: boolean;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// PROBABILITY ENGINE INTERFACES
// ============================================================================

export type PredictionType = 'task_completion' | 'deadline_risk' | 'resource_availability' | 'outcome_likelihood' | 'duration_estimate' | 'custom';

export interface Prediction {
  id: string;
  user_id: string;
  prediction_type: PredictionType;
  subject_type: string;
  subject_id?: string;
  description: string;
  predicted_value?: number;
  predicted_outcome?: string;
  confidence: number;
  factors: Array<{
    name: string;
    value: number;
    weight: number;
    direction: 'positive' | 'negative' | 'neutral';
  }>;
  factor_weights: Record<string, number>;
  decay_rate: number;
  valid_from: string;
  valid_until?: string;
  resolution_date?: string;
  is_resolved: boolean;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface BayesianPrior {
  alpha: number;
  beta: number;
  mean: number;
  variance: number;
  sample_size: number;
}

export interface MonteCarloResult {
  iterations: number;
  mean: number;
  std_dev: number;
  percentiles: {
    p5: number;
    p10: number;
    p25: number;
    p50: number;
    p75: number;
    p90: number;
    p95: number;
  };
  distribution: Array<{
    value: number;
    frequency: number;
  }>;
  confidence_interval: {
    low: number;
    high: number;
    level: number;
  };
}

export interface CalibrationState {
  id: string;
  user_id: string;
  calibration_type: 'global' | 'by_type' | 'by_domain';
  domain?: string;
  brier_score: number;
  accuracy_by_bucket: {
    '0-10': { predictions: number; accuracy: number };
    '10-20': { predictions: number; accuracy: number };
    '20-30': { predictions: number; accuracy: number };
    '30-40': { predictions: number; accuracy: number };
    '40-50': { predictions: number; accuracy: number };
    '50-60': { predictions: number; accuracy: number };
    '60-70': { predictions: number; accuracy: number };
    '70-80': { predictions: number; accuracy: number };
    '80-90': { predictions: number; accuracy: number };
    '90-100': { predictions: number; accuracy: number };
  };
  total_predictions: number;
  resolved_predictions: number;
  alpha: number;
  beta: number;
  last_updated: string;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export type UserPatternType = 'time_of_day' | 'day_of_week' | 'task_type' | 'duration' | 'completion_rate' | 'procrastination' | 'energy_level' | 'context_switch' | 'custom';

export interface FactorScore {
  factor_id: string;
  name: string;
  raw_value: number;
  normalized_value: number;
  weight: number;
  contribution: number;
}

export interface UserPattern {
  id: string;
  user_id: string;
  pattern_type: UserPatternType;
  pattern_name: string;
  pattern_data: Record<string, any>;
  confidence: number;
  sample_size: number;
  last_observed_at?: string;
  is_active: boolean;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// ENVIRONMENT AWARENESS INTERFACES
// ============================================================================

export interface EnvironmentState {
  id: string;
  user_id: string;
  snapshot_type: 'periodic' | 'triggered' | 'manual' | 'event';
  location: {
    latitude?: number;
    longitude?: number;
    accuracy?: number;
    place_name?: string;
    place_type?: string;
  };
  device_state: {
    platform?: string;
    is_foreground?: boolean;
    screen_on?: boolean;
    orientation?: string;
  };
  network_state: {
    type?: 'wifi' | 'cellular' | 'offline';
    is_connected?: boolean;
    bandwidth_estimate?: number;
  };
  battery_level?: number;
  calendar_context: {
    current_event?: string;
    next_event?: string;
    next_event_in_minutes?: number;
    free_until?: string;
  };
  time_context: {
    local_time: string;
    day_of_week: string;
    is_work_hours?: boolean;
    time_zone?: string;
  };
  active_apps: string[];
  attention_score?: number;
  metadata: Record<string, any>;
  created_at: string;
}

export type ContextNodeType = 'person' | 'project' | 'task' | 'event' | 'location' | 'resource' | 'concept' | 'goal';

export interface ContextNode {
  id: string;
  user_id: string;
  node_type: ContextNodeType;
  name: string;
  description?: string;
  properties: Record<string, any>;
  importance: number;
  recency_score: number;
  last_accessed_at?: string;
  access_count: number;
  is_active: boolean;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export type ContextEdgeType = 'related_to' | 'depends_on' | 'owned_by' | 'assigned_to' | 'located_at' | 'part_of' | 'blocks' | 'enables' | 'conflicts_with';

export interface ContextEdge {
  id: string;
  user_id: string;
  source_node_id: string;
  target_node_id: string;
  edge_type: ContextEdgeType;
  strength: number;
  direction: 'forward' | 'backward' | 'bidirectional';
  properties: Record<string, any>;
  last_reinforced_at: string;
  reinforcement_count: number;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface ContextGraph {
  nodes: ContextNode[];
  edges: ContextEdge[];
  focal_node_id?: string;
  depth: number;
  generated_at: string;
}

export type GhostActionType = 'create_task' | 'send_message' | 'schedule_event' | 'set_reminder' | 'update_status' | 'delegate' | 'escalate' | 'archive' | 'custom';
export type GhostActionStatus = 'pending' | 'approved' | 'rejected' | 'executed' | 'expired' | 'cancelled';

export interface GhostAction {
  id: string;
  user_id: string;
  action_type: GhostActionType;
  title: string;
  description?: string;
  draft_action: Record<string, any>;
  trigger_conditions: {
    time_based?: string;
    location_based?: Record<string, any>;
    context_based?: Record<string, any>;
    signal_based?: string[];
  };
  auto_trigger_enabled: boolean;
  auto_trigger_at?: string;
  confidence: number;
  rationale?: string;
  status: GhostActionStatus;
  approved_at?: string;
  rejected_at?: string;
  executed_at?: string;
  expires_at?: string;
  related_signals: string[];
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface AttentionBudget {
  total_daily_budget: number;
  used_today: number;
  remaining: number;
  category_budgets: Record<string, { allocated: number; used: number }>;
  interruption_threshold: number;
  focus_mode_active: boolean;
  last_reset: string;
}

// ============================================================================
// ORACLE ORCHESTRATION INTERFACES
// ============================================================================

export type OODAPhase = 'observe' | 'orient' | 'decide' | 'act' | 'idle';

export interface OracleState {
  current_phase: OODAPhase;
  active_signal_ids: string[];
  active_context_id?: string;
  active_decision_id?: string;
  active_plan_id?: string;
  loop_running: boolean;
  loop_paused: boolean;
  last_phase_transition: string;
  phase_durations: Record<OODAPhase, number>;
  system_confidence: number;
  proactivity_level: 'low' | 'medium' | 'high';
  metadata: Record<string, any>;
}

export interface OODALoopRecord {
  id: string;
  user_id: string;
  started_at: string;
  ended_at?: string;
  phases_completed: OODAPhase[];
  signals_processed: number;
  decisions_made: number;
  actions_executed: number;
  outcome_summary?: string;
  confidence: number;
  metadata: Record<string, any>;
}

export interface OracleConfig {
  scan_interval_minutes: number;
  auto_orient_enabled: boolean;
  auto_decide_threshold: number;
  auto_execute_enabled: boolean;
  ghost_action_approval_mode: 'always_ask' | 'high_confidence_auto' | 'all_auto';
  proactivity_level: 'low' | 'medium' | 'high';
  attention_budget: AttentionBudget;
  notification_preferences: {
    critical_signals: boolean;
    decision_prompts: boolean;
    execution_updates: boolean;
    learning_summaries: boolean;
  };
}

export const ORACLE_COLORS = {
  observe: '#00BFFF',   // Electric blue - scanning
  orient: '#FFD700',    // Gold - thinking
  decide: '#FF6B6B',    // Coral - decision point
  act: '#00FF88',       // Matrix green - executing
} as const;

// ============================================================================
// ORACLE ANALYTICS INTERFACES (Phase 3)
// ============================================================================

export type AnalyticsEventType =
  | 'observe_scan' | 'observe_signal_detected' | 'observe_signal_dismissed'
  | 'orient_context_created' | 'orient_assessment_generated' | 'orient_correlation_found'
  | 'decide_decision_created' | 'decide_option_added' | 'decide_simulation_run' | 'decide_decision_made'
  | 'act_plan_created' | 'act_step_completed' | 'act_plan_completed' | 'act_learning_captured'
  | 'prediction_made' | 'prediction_resolved' | 'ghost_action_approved' | 'ghost_action_rejected'
  | 'ui_interaction' | 'api_call' | 'error' | 'custom';

export type AnalyticsEventCategory = 'observe' | 'orient' | 'decide' | 'act' | 'prediction' | 'system' | 'user';

export interface AnalyticsEvent {
  id: string;
  user_id: string;
  event_type: AnalyticsEventType;
  event_category: AnalyticsEventCategory;
  payload: Record<string, any>;
  entity_type?: string;
  entity_id?: string;
  session_id?: string;
  device_id?: string;
  ip_address?: string;
  user_agent?: string;
  duration_ms?: number;
  metadata: Record<string, any>;
  created_at: string;
}

export type PredictionAccuracyCategory = 'task_completion' | 'deadline_risk' | 'resource_availability' | 'outcome_likelihood' | 'duration_estimate' | 'custom';

export interface PredictionAccuracyRecord {
  id: string;
  user_id: string;
  prediction_id?: string;
  category: PredictionAccuracyCategory;
  predicted_value?: number;
  actual_value?: number;
  delta?: number;
  absolute_error?: number;
  percentage_error?: number;
  confidence_at_prediction: number;
  time_horizon_hours?: number;
  factors_snapshot: Record<string, any>;
  is_accurate?: boolean;
  accuracy_threshold: number;
  period_start?: string;
  period_end?: string;
  metadata: Record<string, any>;
  created_at: string;
}

export interface EngagementMetrics {
  id: string;
  user_id: string;
  session_id: string;
  session_start: string;
  session_end?: string;
  session_duration_seconds?: number;
  device_id?: string;
  platform?: string;
  app_version?: string;

  // Feature usage counts
  observe_scans: number;
  signals_viewed: number;
  signals_acknowledged: number;
  contexts_generated: number;
  decisions_created: number;
  decisions_completed: number;
  simulations_run: number;
  plans_created: number;
  steps_completed: number;
  predictions_viewed: number;
  ghost_actions_reviewed: number;

  // Engagement metrics
  active_time_seconds: number;
  screens_visited: string[];
  actions_taken: number;
  api_calls_made: number;
  errors_encountered: number;

  // Completion metrics
  tasks_completed: number;
  decisions_finalized: number;
  plans_executed: number;

  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export type SystemHealthMetricType = 'api_latency' | 'error_rate' | 'throughput' | 'availability' | 'queue_depth' | 'memory_usage' | 'cpu_usage' | 'db_latency' | 'ai_latency' | 'custom';

export interface SystemHealthMetrics {
  id: string;
  metric_type: SystemHealthMetricType;
  endpoint?: string;
  service: string;

  // Latency metrics (in milliseconds)
  latency_p50?: number;
  latency_p90?: number;
  latency_p95?: number;
  latency_p99?: number;
  latency_avg?: number;
  latency_max?: number;
  latency_min?: number;

  // Count metrics
  request_count: number;
  error_count: number;
  success_count: number;
  timeout_count: number;
  rate_limit_count: number;

  // Rate metrics
  error_rate?: number;
  success_rate?: number;
  requests_per_second?: number;

  // Resource metrics
  memory_mb?: number;
  cpu_percent?: number;

  // Time bucket
  bucket_start: string;
  bucket_end: string;
  bucket_duration_seconds: number;

  metadata: Record<string, any>;
  created_at: string;
}

// Aggregated analytics dashboard data
export interface AnalyticsDashboardData {
  // Summary metrics
  total_predictions: number;
  accuracy_rate: number;
  total_decisions_completed: number;
  active_sessions_today: number;

  // Trends
  prediction_accuracy_trend: Array<{
    date: string;
    accuracy: number;
    count: number;
  }>;

  // Feature usage breakdown
  feature_usage: {
    observe: number;
    orient: number;
    decide: number;
    act: number;
    probability: number;
  };

  // System health summary
  system_health: {
    status: 'healthy' | 'degraded' | 'critical';
    avg_latency_ms: number;
    error_rate: number;
    uptime_percentage: number;
  };

  // Top signals
  top_signal_types: Array<{
    type: string;
    count: number;
    percentage: number;
  }>;

  // Date range
  period_start: string;
  period_end: string;
}

// Analytics query parameters
export interface AnalyticsQueryParams {
  user_id?: string;
  start_date?: string;
  end_date?: string;
  event_types?: AnalyticsEventType[];
  categories?: AnalyticsEventCategory[];
  limit?: number;
  offset?: number;
  granularity?: 'hour' | 'day' | 'week' | 'month';
}

// ============================================================================
// ORACLE WEBHOOK INTERFACES (Phase 3)
// ============================================================================

export type WebhookEventType =
  | 'signal.detected' | 'signal.critical'
  | 'context.generated'
  | 'decision.created' | 'decision.made'
  | 'plan.started' | 'plan.completed' | 'step.completed'
  | 'prediction.resolved'
  | 'ghost_action.ready'
  | 'system.error'
  | 'custom';

export type WebhookEventCategory = 'observe' | 'orient' | 'decide' | 'act' | 'prediction' | 'system';

export type WebhookDeliveryStatus = 'pending' | 'sending' | 'success' | 'failed' | 'retrying' | 'abandoned';

export interface Webhook {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  url: string;
  secret: string;
  events: WebhookEventType[];
  headers: Record<string, string>;
  is_active: boolean;
  retry_count: number;
  retry_delay_seconds: number;
  timeout_seconds: number;
  last_triggered_at?: string;
  last_success_at?: string;
  last_failure_at?: string;
  success_count: number;
  failure_count: number;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface WebhookDelivery {
  id: string;
  webhook_id: string;
  user_id: string;
  event_type: WebhookEventType;
  event_id?: string;
  payload: WebhookPayload;
  status: WebhookDeliveryStatus;

  // Response details
  response_status_code?: number;
  response_body?: string;
  response_headers?: Record<string, string>;
  response_time_ms?: number;

  // Retry tracking
  attempt_number: number;
  max_attempts: number;
  next_retry_at?: string;
  last_error?: string;

  // Signature
  signature: string;
  signature_algorithm: string;

  // Timestamps
  sent_at?: string;
  completed_at?: string;
  metadata: Record<string, any>;
  created_at: string;
}

export interface WebhookEvent {
  id: string;
  event_type: WebhookEventType;
  category: WebhookEventCategory;
  description?: string;
  payload_schema?: Record<string, any>;
  is_system: boolean;
  is_active: boolean;
  metadata: Record<string, any>;
  created_at: string;
}

export interface WebhookPayload<T = Record<string, any>> {
  id: string;
  event_type: WebhookEventType;
  timestamp: string;
  user_id: string;
  data: T;
  metadata: {
    source: string;
    version: string;
    environment?: string;
  };
}

// Webhook signature
export interface WebhookSignature {
  algorithm: 'sha256' | 'sha512';
  signature: string;
  timestamp: number;
}

// Webhook test result
export interface WebhookTestResult {
  webhook_id: string;
  success: boolean;
  status_code?: number;
  response_time_ms?: number;
  error?: string;
  tested_at: string;
}

// Webhook statistics
export interface WebhookStats {
  webhook_id: string;
  total_deliveries: number;
  successful_deliveries: number;
  failed_deliveries: number;
  avg_response_time_ms: number;
  success_rate: number;
  last_24h_deliveries: number;
  last_24h_failures: number;
}

// ============================================================================
// ORACLE PATTERN LEARNING INTERFACES (Phase 3)
// ============================================================================

export type PatternType =
  | 'temporal'
  | 'sequential'
  | 'contextual'
  | 'behavioral'
  | 'correlation'
  | 'preference'
  | 'routine'
  | 'custom';

export type PatternFeedbackType =
  | 'confirm'
  | 'reject'
  | 'modify'
  | 'ignore'
  | 'useful'
  | 'not_useful'
  | 'timing'
  | 'accuracy';

export type PatternFeedbackSentiment = 'positive' | 'negative' | 'neutral';

export interface PatternSignature {
  action_sequence?: string[];
  entity_types?: string[];
  event_types?: string[];
  duration_range?: { min: number; max: number };
  frequency?: { count: number; window_hours: number };
  time_pattern?: {
    hour_ranges?: Array<{ start: number; end: number }>;
    days_of_week?: number[];
    weeks_of_month?: number[];
    time_zone?: string;
  };
  context_requirements?: Record<string, any>;
  correlation_factors?: Array<{
    factor: string;
    correlation_strength: number;
    direction: 'positive' | 'negative';
  }>;
}

export interface TimeDistribution {
  [hour: string]: number; // 0-23 mapped to frequency
}

export interface DayDistribution {
  [day: string]: number; // 0-6 (Sun-Sat) mapped to frequency
}

export interface LearnedPattern {
  id: string;
  user_id: string;
  pattern_type: PatternType;
  name: string;
  description?: string;
  pattern_signature: PatternSignature;
  trigger_conditions: Record<string, any>;
  typical_context: Record<string, any>;
  time_of_day_distribution: TimeDistribution;
  day_of_week_distribution: DayDistribution;
  recurrence_pattern?: string;
  confidence: number;
  support_count: number;
  occurrence_rate?: number;
  consistency_score?: number;
  is_active: boolean;
  is_validated: boolean;
  last_observed_at?: string;
  first_observed_at?: string;
  observation_count: number;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface PatternInstance {
  id: string;
  pattern_id: string;
  user_id: string;
  occurred_at: string;
  context: Record<string, any>;
  trigger_data: Record<string, any>;
  outcome_data: Record<string, any>;
  match_confidence: number;
  deviation_from_pattern?: number;
  related_signals: string[];
  related_decisions: string[];
  related_actions: string[];
  time_of_day: string;
  day_of_week: number;
  week_of_year: number;
  metadata: Record<string, any>;
  created_at: string;
}

export interface PatternFeedback {
  id: string;
  pattern_id: string;
  instance_id?: string;
  user_id: string;
  feedback_type: PatternFeedbackType;
  sentiment?: PatternFeedbackSentiment;
  rating?: number;
  comment?: string;
  suggested_changes: Record<string, any>;
  context_at_feedback: Record<string, any>;
  was_applied: boolean;
  impact_on_confidence?: number;
  metadata: Record<string, any>;
  created_at: string;
}

export interface PatternRecommendation {
  pattern_id: string;
  pattern_name: string;
  recommendation_type: 'action' | 'timing' | 'context' | 'warning';
  content: string;
  confidence: number;
  trigger_reason: string;
  suggested_action?: Record<string, any>;
  optimal_time?: string;
  context_match: number;
  priority: 'high' | 'medium' | 'low';
}

export interface BehavioralEvent {
  event_type: string;
  entity_type?: string;
  entity_id?: string;
  timestamp: string;
  context: Record<string, any>;
  outcome?: Record<string, any>;
  duration_ms?: number;
  metadata?: Record<string, any>;
}

export interface DetectedPattern {
  pattern_type: PatternType;
  name: string;
  description: string;
  signature: PatternSignature;
  confidence: number;
  support_count: number;
  instances: BehavioralEvent[];
  time_distribution: TimeDistribution;
  day_distribution: DayDistribution;
}

export interface PatternScore {
  overall_score: number;
  components: {
    frequency_score: number;
    consistency_score: number;
    recency_score: number;
    feedback_score: number;
  };
  trend: 'strengthening' | 'weakening' | 'stable';
}

export interface ModelVersion {
  id: string;
  user_id: string;
  model_type: 'pattern_detector' | 'confidence_calibrator' | 'scheduler' | 'recommender' | 'predictor';
  version_number: number;
  version_tag?: string;
  model_parameters: Record<string, any>;
  training_data_summary: Record<string, any>;
  accuracy_score?: number;
  precision_score?: number;
  recall_score?: number;
  f1_score?: number;
  training_samples: number;
  validation_samples: number;
  training_started_at?: string;
  training_completed_at?: string;
  is_active: boolean;
  deployed_at?: string;
  deprecated_at?: string;
  deprecation_reason?: string;
  improvement_from_previous?: number;
  previous_version_id?: string;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

// =====================================================
// ORACLE DECISION JOURNAL
// Track and review past decisions with reflections
// =====================================================

export type JournalOutcomeStatus = 'pending' | 'success' | 'partial' | 'failure' | 'cancelled' | 'unknown';
export type JournalCategory = 'career' | 'financial' | 'health' | 'relationship' | 'project' | 'personal' | 'business' | 'technical' | 'other';
export type JournalImportance = 'trivial' | 'minor' | 'moderate' | 'major' | 'critical';
export type JournalTimePressure = 'none' | 'low' | 'moderate' | 'high' | 'urgent';
export type JournalFollowupType = 'review_outcome' | 'check_progress' | 'reassess' | 'celebrate' | 'learn';

export interface DecisionJournalEntry {
  id: string;
  user_id: string;
  decision_id?: string;

  // Journal entry content
  title: string;
  situation: string;
  options_considered?: string[];
  chosen_option?: string;
  reasoning?: string;

  // Outcome tracking
  outcome_status: JournalOutcomeStatus;
  outcome_description?: string;
  outcome_date?: string;

  // Reflection and learning
  reflection?: string;
  lessons_learned?: string[];
  would_decide_differently?: boolean;
  alternative_considered?: string;

  // Categorization
  tags: string[];
  category: JournalCategory;
  importance: JournalImportance;

  // Emotional context
  emotional_state_before?: string;
  emotional_state_after?: string;
  stress_level?: number;
  confidence_in_decision?: number;

  // Time tracking
  decision_date: string;
  time_pressure?: JournalTimePressure;
  deliberation_time_hours?: number;

  // Stakeholders
  stakeholders_involved?: string[];
  stakeholders_affected?: string[];

  // Metadata
  metadata: Record<string, any>;
  is_private: boolean;
  is_favorite: boolean;

  created_at: string;
  updated_at: string;
}

export interface JournalAttachment {
  id: string;
  journal_id: string;
  user_id: string;
  file_name: string;
  file_type: 'image' | 'document' | 'link' | 'note';
  file_path?: string;
  description?: string;
  created_at: string;
}

export interface JournalFollowup {
  id: string;
  journal_id: string;
  user_id: string;
  followup_type: JournalFollowupType;
  scheduled_date: string;
  completed_date?: string;
  notes?: string;
  is_completed: boolean;
  is_dismissed: boolean;
  created_at: string;
}

export interface JournalSearchFilters {
  query?: string;
  categories?: JournalCategory[];
  tags?: string[];
  outcome_status?: JournalOutcomeStatus[];
  importance?: JournalImportance[];
  date_from?: string;
  date_to?: string;
  favorites_only?: boolean;
  has_reflection?: boolean;
  has_outcome?: boolean;
}

export interface JournalStats {
  total_entries: number;
  entries_by_category: Record<JournalCategory, number>;
  entries_by_outcome: Record<JournalOutcomeStatus, number>;
  success_rate: number;
  average_confidence: number;
  decisions_reviewed: number;
  lessons_captured: number;
  most_common_tags: Array<{ tag: string; count: number }>;
}

export interface JournalExport {
  entries: DecisionJournalEntry[];
  attachments: JournalAttachment[];
  stats: JournalStats;
  exported_at: string;
  format: 'json' | 'csv' | 'markdown' | 'pdf';
}

// =====================================================
// ORACLE COLLABORATIVE DECISIONS
// Multi-user decision support for teams
// =====================================================

export type CollaboratorRole = 'owner' | 'editor' | 'voter' | 'viewer';
export type CollaboratorStatus = 'pending' | 'accepted' | 'declined' | 'removed';
export type VoteType = 'approve' | 'reject' | 'abstain' | 'preference';
export type ShareType = 'view' | 'vote' | 'comment' | 'full';
export type CommentContentType = 'text' | 'markdown' | 'rich';

export interface DecisionCollaborator {
  id: string;
  decision_id: string;
  user_id: string;
  role: CollaboratorRole;
  invited_by?: string;
  invited_email?: string;
  status: CollaboratorStatus;
  joined_at?: string;
  last_viewed_at?: string;
  notify_on_vote: boolean;
  notify_on_comment: boolean;
  notify_on_update: boolean;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;

  // Joined user data (populated on queries)
  user?: {
    id: string;
    email: string;
    display_name?: string;
    avatar_url?: string;
  };
}

export interface DecisionVote {
  id: string;
  decision_id: string;
  option_id: string;
  user_id: string;
  vote_type: VoteType;
  preference_rank?: number;
  weight: number;
  rationale?: string;
  confidence?: number;
  is_final: boolean;
  finalized_at?: string;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;

  // Joined user data
  user?: {
    id: string;
    email: string;
    display_name?: string;
    avatar_url?: string;
  };
}

export interface DecisionComment {
  id: string;
  decision_id: string;
  option_id?: string;
  user_id: string;
  parent_id?: string;
  content: string;
  content_type: CommentContentType;
  mentions: string[];
  reactions: Record<string, string[]>; // emoji -> user_ids
  is_edited: boolean;
  edited_at?: string;
  is_deleted: boolean;
  deleted_at?: string;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;

  // Joined data
  user?: {
    id: string;
    email: string;
    display_name?: string;
    avatar_url?: string;
  };
  replies?: DecisionComment[];
}

export interface DecisionShare {
  id: string;
  decision_id: string;
  created_by: string;
  share_token: string;
  share_type: ShareType;
  requires_auth: boolean;
  allowed_domains?: string[];
  max_uses?: number;
  use_count: number;
  expires_at?: string;
  is_active: boolean;
  metadata: Record<string, any>;
  created_at: string;

  // Generated
  share_url?: string;
}

export interface VoteAggregation {
  id: string;
  decision_id: string;
  option_id: string;
  total_votes: number;
  approve_count: number;
  reject_count: number;
  abstain_count: number;
  weighted_approve: number;
  weighted_reject: number;
  net_score: number;
  avg_confidence?: number;
  avg_preference_rank?: number;
  last_calculated_at: string;
  created_at: string;
  updated_at: string;
}

export interface CollaborativeDecisionState {
  decision_id: string;
  collaborators: DecisionCollaborator[];
  votes: DecisionVote[];
  comments: DecisionComment[];
  aggregation: VoteAggregation[];
  shares: DecisionShare[];
  current_user_role?: CollaboratorRole;
  has_voted: boolean;
  can_edit: boolean;
  can_vote: boolean;
  can_comment: boolean;
}

export interface InviteCollaboratorParams {
  decision_id: string;
  email: string;
  role: CollaboratorRole;
  message?: string;
}

export interface CastVoteParams {
  decision_id: string;
  option_id: string;
  vote_type: VoteType;
  preference_rank?: number;
  rationale?: string;
  confidence?: number;
  is_final?: boolean;
}

export interface AddCommentParams {
  decision_id: string;
  option_id?: string;
  parent_id?: string;
  content: string;
  content_type?: CommentContentType;
  mentions?: string[];
}

export interface CreateShareLinkParams {
  decision_id: string;
  share_type: ShareType;
  requires_auth?: boolean;
  allowed_domains?: string[];
  max_uses?: number;
  expires_at?: string;
}

// ==============================================
// ORACLE Scenario Planning Types (Phase 3 - adv-26)
// ==============================================

export type ScenarioType = 'baseline' | 'optimistic' | 'pessimistic' | 'alternative' | 'stress_test' | 'custom';
export type ScenarioStatus = 'draft' | 'analyzing' | 'completed' | 'archived';
export type VariableCategory = 'economic' | 'resource' | 'timeline' | 'market' | 'technical' | 'human' | 'external' | 'custom';
export type VariableType = 'numeric' | 'percentage' | 'boolean' | 'categorical' | 'range';
export type ScenarioOutcomeType = 'primary' | 'secondary' | 'side_effect' | 'risk' | 'opportunity';
export type RiskLevel = 'very_low' | 'low' | 'medium' | 'high' | 'very_high';
export type TimeToOutcome = 'immediate' | '1_week' | '1_month' | '3_months' | '6_months' | '1_year' | 'long_term';
export type SensitivityAnalysisType = 'tornado' | 'spider' | 'monte_carlo' | 'one_way' | 'two_way';

export interface Scenario {
  id: string;
  user_id: string;
  decision_id?: string;
  name: string;
  description?: string;
  scenario_type: ScenarioType;
  status: ScenarioStatus;
  is_baseline: boolean;
  outcome_summary?: string;
  overall_score?: number;
  probability_of_success?: number;
  risk_level?: RiskLevel;
  compared_to_baseline?: {
    score_delta?: number;
    risk_delta?: number;
    key_differences?: string[];
  };
  tags: string[];
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface VariableValue {
  value: number | string | boolean;
  unit?: string;
}

export interface VariableOption {
  value: string | number;
  label: string;
}

export interface ScenarioVariable {
  id: string;
  scenario_id: string;
  name: string;
  description?: string;
  category: VariableCategory;
  variable_type: VariableType;
  current_value: VariableValue;
  baseline_value?: VariableValue;
  min_value?: VariableValue;
  max_value?: VariableValue;
  step_size?: VariableValue;
  options?: VariableOption[];
  sensitivity_score?: number;
  is_key_driver: boolean;
  constraints?: {
    min?: number;
    max?: number;
    depends_on?: string;
    mutually_exclusive_with?: string[];
  };
  display_order: number;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface ScenarioOutcome {
  id: string;
  scenario_id: string;
  outcome_type: ScenarioOutcomeType;
  name: string;
  description?: string;
  probability?: number;
  impact_score?: number;
  confidence?: number;
  time_to_outcome?: TimeToOutcome;
  depends_on_variables: string[];
  sensitivity_factors: Record<string, number>;
  risk_factors: string[];
  success_factors: string[];
  assumptions: string[];
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface ScenarioComparison {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  scenario_ids: string[];
  comparison_matrix: {
    dimensions: string[];
    scenarios: Record<string, Record<string, number>>;
  };
  winner_scenario_id?: string;
  winner_reasoning?: string;
  key_differentiators: Array<{
    factor: string;
    scenario_id: string;
    advantage: string;
  }>;
  trade_offs: Array<{
    scenario_a: string;
    scenario_b: string;
    description: string;
  }>;
  recommendations?: string;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface SensitivityAnalysis {
  id: string;
  scenario_id: string;
  analysis_type: SensitivityAnalysisType;
  variable_impacts: Array<{
    variable_id: string;
    name: string;
    low_impact: number;
    high_impact: number;
    swing: number;
  }>;
  most_sensitive_variable_id?: string;
  least_sensitive_variable_id?: string;
  tornado_data?: Array<{
    variable_id: string;
    name: string;
    low_value: number;
    high_value: number;
    base_outcome: number;
    low_outcome: number;
    high_outcome: number;
  }>;
  spider_data?: Array<{
    variable_id: string;
    name: string;
    percentage_changes: number[];
    outcome_changes: number[];
  }>;
  key_insights: string[];
  recommendations: string[];
  iterations?: number;
  confidence_interval?: number;
  metadata: Record<string, any>;
  created_at: string;
}

// Scenario Planning State
export interface ScenarioPlannerState {
  scenarios: Scenario[];
  active_scenario?: Scenario;
  variables: ScenarioVariable[];
  outcomes: ScenarioOutcome[];
  comparisons: ScenarioComparison[];
  sensitivity_results?: SensitivityAnalysis;
}

// Scenario Creation Params
export interface CreateScenarioParams {
  name: string;
  description?: string;
  scenario_type: ScenarioType;
  decision_id?: string;
  is_baseline?: boolean;
  tags?: string[];
  copy_from_scenario_id?: string;
}

export interface UpdateVariableParams {
  variable_id: string;
  current_value: VariableValue;
}

export interface RunSensitivityParams {
  scenario_id: string;
  analysis_type: SensitivityAnalysisType;
  iterations?: number;
  confidence_interval?: number;
}

export interface CompareScenarioParams {
  name: string;
  description?: string;
  scenario_ids: string[];
  dimensions?: string[];
}

// ============================================================================
// ORACLE TEAM & ORGANIZATION TYPES (Phase 5)
// ============================================================================

export type OrgPlan = 'free' | 'pro' | 'business' | 'enterprise';
export type TeamMemberRole = 'owner' | 'admin' | 'member' | 'viewer';
export type TeamInviteStatus = 'pending' | 'accepted' | 'declined' | 'expired' | 'revoked';
export type ContentVisibility = 'private' | 'team' | 'org';

// Organization
export interface Organization {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  plan: OrgPlan;
  logo_url?: string;
  billing_email?: string;
  is_active: boolean;
  trial_ends_at?: string;
  settings: OrgSettings;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

// Organization settings embedded in Organization
export interface OrgSettings {
  timezone?: string;
  locale?: string;
  default_currency?: string;
  branding?: {
    primary_color?: string;
    secondary_color?: string;
    logo_url?: string;
  };
}

// Team within an organization
export interface Team {
  id: string;
  org_id: string;
  name: string;
  description?: string;
  is_default: boolean;
  settings: TeamSettings;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
  // Populated fields
  organization?: Organization;
  members?: TeamMember[];
  member_count?: number;
}

// Team settings embedded in Team
export interface TeamSettings {
  default_decision_visibility?: ContentVisibility;
  default_plan_visibility?: ContentVisibility;
  notifications_enabled?: boolean;
  features?: Record<string, boolean>;
}

// Team member - user-team relationship
export interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  role: TeamMemberRole;
  invited_by?: string;
  joined_at: string;
  permissions: TeamMemberPermissions;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
  // Populated fields
  user?: User;
  team?: Team;
}

// Granular permissions for team members
export interface TeamMemberPermissions {
  can_invite?: boolean;
  can_manage_members?: boolean;
  can_edit_settings?: boolean;
  can_delete_team?: boolean;
  can_view_analytics?: boolean;
  can_export_data?: boolean;
  custom?: Record<string, boolean>;
}

// Team invite - pending invitation
export interface TeamInvite {
  id: string;
  team_id: string;
  email: string;
  role: Exclude<TeamMemberRole, 'owner'>; // Can't invite as owner
  invited_by?: string;
  token: string;
  status: TeamInviteStatus;
  expires_at: string;
  accepted_at?: string;
  accepted_by?: string;
  message?: string;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
  // Populated fields
  team?: Team;
  inviter?: User;
}

// Organization-level ORACLE configuration
export interface OrgOracleSettings {
  id: string;
  org_id: string;
  // AI Configuration
  ai_enabled: boolean;
  default_ai_personality?: string;
  ai_usage_limit_daily?: number;
  // Feature flags
  features_enabled: {
    signals: boolean;
    decisions: boolean;
    plans: boolean;
    predictions: boolean;
    [key: string]: boolean;
  };
  // Sharing defaults
  default_decision_visibility: ContentVisibility;
  default_plan_visibility: ContentVisibility;
  // Security settings
  require_2fa: boolean;
  allowed_domains: string[];
  ip_whitelist: string[];
  // Data retention
  retention_days: number;
  auto_archive_enabled: boolean;
  // Notification preferences
  notification_settings: NotificationSettings;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

// Notification settings for organizations
export interface NotificationSettings {
  email_enabled?: boolean;
  push_enabled?: boolean;
  slack_enabled?: boolean;
  digest_frequency?: 'realtime' | 'hourly' | 'daily' | 'weekly';
  quiet_hours?: {
    enabled: boolean;
    start_time?: string; // HH:mm format
    end_time?: string;
    timezone?: string;
  };
}

// API request/response types for team operations

export interface CreateOrganizationRequest {
  name: string;
  slug?: string; // Auto-generated if not provided
  plan?: OrgPlan;
  billing_email?: string;
  settings?: Partial<OrgSettings>;
}

export interface CreateTeamRequest {
  org_id: string;
  name: string;
  description?: string;
  settings?: Partial<TeamSettings>;
}

export interface InviteTeamMemberRequest {
  team_id: string;
  email: string;
  role: Exclude<TeamMemberRole, 'owner'>;
  message?: string;
}

export interface UpdateTeamMemberRequest {
  role?: TeamMemberRole;
  permissions?: Partial<TeamMemberPermissions>;
}

export interface AcceptInviteRequest {
  token: string;
}

export interface UpdateOrgSettingsRequest {
  org_id: string;
  settings: Partial<OrgOracleSettings>;
}

// Team-related response types

export interface TeamWithMembers extends Team {
  members: TeamMember[];
  member_count: number;
}

export interface OrganizationWithTeams extends Organization {
  teams: Team[];
  team_count: number;
  owner?: User;
}

export interface UserTeamMembership {
  user_id: string;
  organizations: Array<{
    organization: Organization;
    teams: Array<{
      team: Team;
      role: TeamMemberRole;
      permissions: TeamMemberPermissions;
    }>;
  }>;
}

// Permission check helpers
export interface TeamPermissionCheck {
  team_id: string;
  user_id: string;
  action: 'view' | 'edit' | 'delete' | 'invite' | 'manage_members' | 'manage_settings';
}

export interface TeamPermissionResult {
  allowed: boolean;
  reason?: string;
  role?: TeamMemberRole;
}

// ============================================================================
// ORACLE TEAM DATA SHARING TYPES (Phase 5 - team-5)
// ============================================================================

export type ShareableEntityType = 'decision' | 'plan' | 'signal' | 'context' | 'learning';
export type SharePermissionLevel = 'view' | 'comment' | 'edit';
export type TeamActivityType =
  | 'decision_created' | 'decision_made' | 'plan_started' | 'plan_completed'
  | 'signal_detected' | 'signal_resolved' | 'learning_captured'
  | 'comment_added' | 'content_shared' | 'member_joined' | 'member_left';

// Shared content
export interface SharedContent {
  id: string;
  owner_id: string;
  team_id: string;
  entity_type: ShareableEntityType;
  entity_id: string;
  visibility: ContentVisibility;
  permission_level: SharePermissionLevel;
  shared_at: string;
  shared_by?: string;
  expires_at?: string;
  is_active: boolean;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
  // Populated fields
  team?: Team;
  owner?: User;
  entity?: Record<string, any>; // The actual shared entity
}

// Comment on shared content
export interface SharedComment {
  id: string;
  shared_content_id: string;
  user_id: string;
  parent_comment_id?: string;
  content: string;
  is_edited: boolean;
  edited_at?: string;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
  // Populated fields
  user?: User;
  replies?: SharedComment[];
}

// Team activity feed item
export interface TeamActivity {
  id: string;
  team_id: string;
  user_id: string;
  activity_type: TeamActivityType;
  entity_type?: string;
  entity_id?: string;
  title: string;
  description?: string;
  is_public: boolean;
  metadata: Record<string, any>;
  created_at: string;
  // Populated fields
  user?: User;
}

// Share content request
export interface ShareContentRequest {
  team_id: string;
  entity_type: ShareableEntityType;
  entity_id: string;
  permission_level?: SharePermissionLevel;
  expires_at?: string;
}

// Add comment request
export interface AddCommentRequest {
  shared_content_id: string;
  content: string;
  parent_comment_id?: string;
}

// Activity feed response
export interface TeamActivityFeed {
  activities: TeamActivity[];
  has_more: boolean;
  next_cursor?: string;
}

// ============================================================================
// ORACLE TEAM ANALYTICS TYPES (Phase 5 - team-6)
// ============================================================================

// Team prediction accuracy
export interface TeamPredictionAccuracy {
  id: string;
  team_id: string;
  period_start: string;
  period_end: string;
  total_predictions: number;
  resolved_predictions: number;
  accurate_predictions: number;
  accuracy_rate: number;
  brier_score: number;
  accuracy_by_category: Record<string, number>;
  vs_org_average: number;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

// Member activity comparison
export interface TeamMemberActivity {
  id: string;
  team_id: string;
  user_id: string;
  period_start: string;
  period_end: string;
  decisions_created: number;
  decisions_completed: number;
  plans_created: number;
  plans_completed: number;
  signals_acknowledged: number;
  comments_made: number;
  shares_made: number;
  prediction_accuracy: number;
  avg_decision_time_hours: number;
  plan_completion_rate: number;
  engagement_score: number;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
  // Populated fields
  user?: User;
}

// Team productivity metrics
export interface TeamProductivity {
  id: string;
  team_id: string;
  period_start: string;
  period_end: string;
  total_decisions: number;
  decisions_pending: number;
  decisions_completed: number;
  avg_decision_time_hours: number;
  total_plans: number;
  plans_completed: number;
  plans_on_track: number;
  plans_at_risk: number;
  avg_plan_duration_days: number;
  signals_detected: number;
  signals_acknowledged: number;
  critical_signals: number;
  shared_decisions: number;
  comments_total: number;
  active_contributors: number;
  productivity_score: number;
  health_status: 'healthy' | 'at_risk' | 'critical';
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

// Team analytics dashboard data
export interface TeamAnalyticsDashboard {
  team_id: string;
  period: {
    start: string;
    end: string;
    label: string;
  };
  prediction_accuracy: TeamPredictionAccuracy;
  productivity: TeamProductivity;
  member_activity: TeamMemberActivity[];
  trends: {
    accuracy_trend: number; // percentage change
    productivity_trend: number;
    engagement_trend: number;
  };
  top_performers: Array<{
    user: User;
    metric: string;
    value: number;
  }>;
}

// Export team report request
export interface ExportTeamReportRequest {
  team_id: string;
  period_start: string;
  period_end: string;
  format: 'pdf' | 'csv' | 'json';
  include_sections: Array<'accuracy' | 'productivity' | 'members' | 'activity'>;
}

// Export team report response
export interface ExportTeamReportResponse {
  report_id: string;
  download_url: string;
  expires_at: string;
  size_bytes: number;
}

// ============================================================================
// ORACLE AI FINE-TUNING TYPES (Phase 5 - ai-tune-1 to ai-tune-5)
// ============================================================================

export type TrainingExampleType = 'positive' | 'negative' | 'correction';
export type TrainingCategory = 'prediction' | 'decision' | 'recommendation' | 'analysis' | 'summary' | 'custom';
export type PromptOperationType =
  | 'radar_scan' | 'signal_analysis' | 'context_synthesis' | 'decision_analysis'
  | 'option_evaluation' | 'simulation' | 'plan_generation' | 'step_suggestion'
  | 'prediction' | 'learning_extraction' | 'summary' | 'custom';
export type AIIndustry = 'general' | 'legal' | 'medical' | 'tech' | 'finance' | 'education' | 'custom';

// Training example from user interaction
export interface TrainingExample {
  id: string;
  user_id: string;
  org_id?: string;
  example_type: TrainingExampleType;
  category: TrainingCategory;
  input_prompt: string;
  model_output: string;
  corrected_output?: string;
  expected_output?: string;
  context_data: Record<string, any>;
  source_entity_type?: string;
  source_entity_id?: string;
  accuracy_score?: number;
  user_rating?: number;
  user_feedback?: string;
  consent_given: boolean;
  consent_timestamp?: string;
  is_anonymized: boolean;
  anonymized_at?: string;
  times_used_in_training: number;
  last_used_at?: string;
  is_active: boolean;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

// Template variable definition
export interface TemplateVariable {
  name: string;
  description?: string;
  required: boolean;
  default_value?: string;
  type?: 'string' | 'number' | 'boolean' | 'json';
}

// Custom prompt template
export interface PromptTemplate {
  id: string;
  user_id: string;
  org_id?: string;
  name: string;
  description?: string;
  operation_type: PromptOperationType;
  template_content: string;
  variables: TemplateVariable[];
  output_format?: string;
  version: number;
  is_latest: boolean;
  parent_version_id?: string;
  is_default: boolean;
  is_public: boolean;
  is_system: boolean;
  usage_count: number;
  avg_rating?: number;
  rating_count: number;
  is_active: boolean;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

// AI personality profile
export interface AIPersonality {
  id: string;
  user_id: string;
  org_id?: string;
  name: string;
  description?: string;
  icon?: string;
  // Trait sliders (0-100)
  formality: number;
  detail_level: number;
  risk_tolerance: number;
  empathy: number;
  proactivity: number;
  // Industry/domain
  industry?: AIIndustry;
  domain_keywords: string[];
  // Custom instructions
  system_prompt_prefix?: string;
  system_prompt_suffix?: string;
  response_style_hints: Record<string, any>;
  // Sample responses for preview
  sample_responses: Array<{ prompt: string; response: string }>;
  // A/B testing
  ab_test_group?: string;
  ab_test_metrics: Record<string, any>;
  // Visibility
  is_default: boolean;
  is_public: boolean;
  is_system: boolean;
  // Usage
  usage_count: number;
  avg_satisfaction?: number;
  is_active: boolean;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

// User AI preferences
export interface UserAIPreferences {
  id: string;
  user_id: string;
  personality_id?: string;
  allow_training_data: boolean;
  anonymize_training_data: boolean;
  training_categories: TrainingCategory[];
  preferred_language: string;
  max_response_length?: number;
  include_confidence: boolean;
  include_alternatives: boolean;
  operation_preferences: Record<PromptOperationType, Partial<AIPersonality>>;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
  // Populated fields
  personality?: AIPersonality;
}

// Request types

export interface SubmitTrainingExampleRequest {
  example_type: TrainingExampleType;
  category: TrainingCategory;
  input_prompt: string;
  model_output: string;
  corrected_output?: string;
  user_rating?: number;
  user_feedback?: string;
  source_entity_type?: string;
  source_entity_id?: string;
  context_data?: Record<string, any>;
}

export interface CreatePromptTemplateRequest {
  name: string;
  description?: string;
  operation_type: PromptOperationType;
  template_content: string;
  variables?: TemplateVariable[];
  output_format?: string;
  is_public?: boolean;
}

export interface UpdatePromptTemplateRequest {
  name?: string;
  description?: string;
  template_content?: string;
  variables?: TemplateVariable[];
  output_format?: string;
  is_public?: boolean;
  create_new_version?: boolean; // If true, creates new version instead of updating
}

export interface CreateAIPersonalityRequest {
  name: string;
  description?: string;
  icon?: string;
  formality?: number;
  detail_level?: number;
  risk_tolerance?: number;
  empathy?: number;
  proactivity?: number;
  industry?: AIIndustry;
  domain_keywords?: string[];
  system_prompt_prefix?: string;
  system_prompt_suffix?: string;
  is_public?: boolean;
}

export interface UpdateAIPreferencesRequest {
  personality_id?: string;
  allow_training_data?: boolean;
  anonymize_training_data?: boolean;
  training_categories?: TrainingCategory[];
  preferred_language?: string;
  max_response_length?: number;
  include_confidence?: boolean;
  include_alternatives?: boolean;
}

// Preview/test types

export interface TemplatePreviewRequest {
  template_id?: string;
  template_content?: string;
  variables: Record<string, any>;
  personality_id?: string;
}

export interface TemplatePreviewResponse {
  rendered_prompt: string;
  estimated_tokens: number;
  warnings: string[];
}

export interface PersonalityPreviewRequest {
  personality_id?: string;
  traits?: Partial<Pick<AIPersonality, 'formality' | 'detail_level' | 'risk_tolerance' | 'empathy' | 'proactivity'>>;
  sample_prompt: string;
}

export interface PersonalityPreviewResponse {
  sample_response: string;
  trait_effects: Record<string, string>; // Explanation of how each trait affected the response
}

// Training data consent
export interface TrainingDataConsent {
  categories: TrainingCategory[];
  consent_given: boolean;
  consent_timestamp?: string;
  anonymize: boolean;
}

// =====================================================
// WHITE-LABEL CONFIGURATION
// Phase 5: wl-1 through wl-5
// =====================================================

export type ThemeMode = 'light' | 'dark' | 'system';
export type ThemeVariantType = 'light' | 'dark' | 'high_contrast' | 'colorblind' | 'custom';
export type EmailTemplateType = 'invite' | 'welcome' | 'password_reset' | 'notification' | 'report' | 'digest' | 'alert' | 'reminder' | 'confirmation';
export type EmailContentType = 'mjml' | 'html' | 'text';
export type StyleType = 'css_variables' | 'style_object' | 'stylesheet';

// Main white-label configuration
export interface WhiteLabelConfig {
  id: string;
  org_id: string;

  // Brand identity
  brand_name: string;
  brand_tagline?: string;
  logo_url?: string;
  logo_dark_url?: string;
  favicon_url?: string;
  splash_screen_url?: string;

  // Custom domain
  custom_domain?: string;
  domain_verified: boolean;
  domain_verification_token?: string;
  domain_verified_at?: string;

  // Primary colors
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  success_color: string;
  warning_color: string;
  error_color: string;

  // OODA phase colors
  observe_color: string;
  orient_color: string;
  decide_color: string;
  act_color: string;

  // Typography
  font_family: string;
  heading_font_family?: string;
  font_scale: number;

  // Theme variants
  light_theme: Record<string, any>;
  dark_theme: Record<string, any>;
  default_theme: ThemeMode;

  // Feature toggles
  features_enabled: WhiteLabelFeatures;

  // Email configuration
  email_templates: Record<EmailTemplateType, string>; // template_id mapping
  email_from_name?: string;
  email_from_address?: string;

  // Legal/compliance
  terms_url?: string;
  privacy_url?: string;
  support_email?: string;
  support_url?: string;

  // Metadata
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface WhiteLabelFeatures {
  oracle: boolean;
  teams: boolean;
  analytics: boolean;
  ai_tuning: boolean;
  voice: boolean;
  widgets: boolean;
  export: boolean;
  [key: string]: boolean;
}

// Theme variant for granular theming
export interface ThemeVariant {
  id: string;
  config_id: string;
  name: string;
  description?: string;
  variant_type: ThemeVariantType;

  // Color palette
  background_primary: string;
  background_secondary: string;
  background_tertiary?: string;

  surface_primary: string;
  surface_secondary?: string;
  surface_elevated?: string;

  text_primary: string;
  text_secondary: string;
  text_muted?: string;
  text_inverse?: string;

  border_primary?: string;
  border_secondary?: string;

  // Accent colors
  accent_primary?: string;
  accent_secondary?: string;

  // Status colors
  status_success?: string;
  status_warning?: string;
  status_error?: string;
  status_info?: string;

  // OODA phase colors for this variant
  phase_observe?: string;
  phase_orient?: string;
  phase_decide?: string;
  phase_act?: string;

  // Component-specific overrides
  button_styles: Record<string, any>;
  card_styles: Record<string, any>;
  input_styles: Record<string, any>;
  modal_styles: Record<string, any>;

  // Accessibility
  min_contrast_ratio: number;
  is_accessible: boolean;

  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Email template for white-label branding
export interface WhiteLabelEmailTemplate {
  id: string;
  config_id: string;
  template_type: EmailTemplateType;
  name: string;
  subject: string;
  content_type: EmailContentType;
  body_template: string;
  available_variables: string[];
  preview_data: Record<string, any>;
  is_default: boolean;
  is_active: boolean;
  version: number;
  created_at: string;
  updated_at: string;
}

// Custom styles
export interface WhiteLabelCustomStyles {
  id: string;
  config_id: string;
  name: string;
  description?: string;
  style_type: StyleType;
  styles: Record<string, any>;
  target_components: string[];
  target_screens: string[];
  priority: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Combined theme data for runtime
export interface ResolvedTheme {
  // Colors
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    success: string;
    warning: string;
    error: string;
    background: {
      primary: string;
      secondary: string;
      tertiary: string;
    };
    surface: {
      primary: string;
      secondary: string;
      elevated: string;
    };
    text: {
      primary: string;
      secondary: string;
      muted: string;
      inverse: string;
    };
    border: {
      primary: string;
      secondary: string;
    };
    ooda: {
      observe: string;
      orient: string;
      decide: string;
      act: string;
    };
  };

  // Typography
  typography: {
    fontFamily: string;
    headingFontFamily: string;
    fontScale: number;
  };

  // Brand
  brand: {
    name: string;
    tagline?: string;
    logoUrl?: string;
    logoDarkUrl?: string;
    faviconUrl?: string;
  };

  // Component styles
  components: {
    button: Record<string, any>;
    card: Record<string, any>;
    input: Record<string, any>;
    modal: Record<string, any>;
  };

  // Meta
  mode: ThemeMode;
  variantType: ThemeVariantType;
  isAccessible: boolean;
}

// API Request/Response types

export interface CreateWhiteLabelConfigRequest {
  org_id: string;
  brand_name: string;
  brand_tagline?: string;
  logo_url?: string;
  primary_color?: string;
  secondary_color?: string;
  accent_color?: string;
  font_family?: string;
  default_theme?: ThemeMode;
  features_enabled?: Partial<WhiteLabelFeatures>;
}

export interface UpdateWhiteLabelConfigRequest {
  brand_name?: string;
  brand_tagline?: string;
  logo_url?: string;
  logo_dark_url?: string;
  favicon_url?: string;
  splash_screen_url?: string;
  primary_color?: string;
  secondary_color?: string;
  accent_color?: string;
  success_color?: string;
  warning_color?: string;
  error_color?: string;
  observe_color?: string;
  orient_color?: string;
  decide_color?: string;
  act_color?: string;
  font_family?: string;
  heading_font_family?: string;
  font_scale?: number;
  default_theme?: ThemeMode;
  features_enabled?: Partial<WhiteLabelFeatures>;
  email_from_name?: string;
  email_from_address?: string;
  terms_url?: string;
  privacy_url?: string;
  support_email?: string;
  support_url?: string;
}

export interface SetCustomDomainRequest {
  custom_domain: string;
}

export interface VerifyDomainResponse {
  verified: boolean;
  verification_token: string;
  dns_instructions: {
    type: string;
    name: string;
    value: string;
  }[];
}

export interface CreateThemeVariantRequest {
  name: string;
  description?: string;
  variant_type: ThemeVariantType;
  background_primary: string;
  background_secondary: string;
  surface_primary: string;
  text_primary: string;
  text_secondary: string;
  // Optional colors
  background_tertiary?: string;
  surface_secondary?: string;
  surface_elevated?: string;
  text_muted?: string;
  text_inverse?: string;
  border_primary?: string;
  border_secondary?: string;
  accent_primary?: string;
  accent_secondary?: string;
  status_success?: string;
  status_warning?: string;
  status_error?: string;
  status_info?: string;
  phase_observe?: string;
  phase_orient?: string;
  phase_decide?: string;
  phase_act?: string;
  is_default?: boolean;
}

export interface CreateEmailTemplateRequest {
  template_type: EmailTemplateType;
  name: string;
  subject: string;
  content_type?: EmailContentType;
  body_template: string;
  available_variables?: string[];
  preview_data?: Record<string, any>;
  is_default?: boolean;
}

export interface PreviewEmailRequest {
  template_id?: string;
  body_template?: string;
  subject?: string;
  variables: Record<string, any>;
}

export interface PreviewEmailResponse {
  html: string;
  text: string;
  subject: string;
}

export interface CreateCustomStylesRequest {
  name: string;
  description?: string;
  style_type: StyleType;
  styles: Record<string, any>;
  target_components?: string[];
  target_screens?: string[];
  priority?: number;
}

// Loaded brand config for mobile/web runtime
export interface BrandConfig {
  config: WhiteLabelConfig;
  activeTheme: ThemeVariant | null;
  resolvedTheme: ResolvedTheme;
  emailTemplates: WhiteLabelEmailTemplate[];
  customStyles: WhiteLabelCustomStyles[];
  lastUpdated: string;
}

// Dynamic branding context
export interface BrandingContext {
  config: WhiteLabelConfig | null;
  theme: ResolvedTheme;
  isLoading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

// =====================================================
// SUBSCRIPTION & BILLING
// Phase 5: sub-1 through sub-5
// =====================================================

export type PlanTier = 'free' | 'basic' | 'pro' | 'business' | 'enterprise';
export type BillingCycle = 'monthly' | 'yearly';
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid' | 'paused' | 'incomplete';
export type InvoiceStatus = 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';
export type PaymentMethodType = 'card' | 'bank_account' | 'paypal';
export type FeatureCategory = 'ai' | 'storage' | 'api' | 'integration' | 'team' | 'export' | 'analytics';
export type UsageAlertType = 'approaching_limit' | 'limit_reached' | 'limit_exceeded' | 'trial_ending' | 'payment_failed';

// Subscription plan definition
export interface SubscriptionPlan {
  id: string;
  name: string;
  slug: string;
  description?: string;
  plan_tier: PlanTier;

  // Pricing
  price_monthly: number;
  price_yearly: number;
  currency: string;
  stripe_price_id_monthly?: string;
  stripe_price_id_yearly?: string;

  // Limits (-1 means unlimited)
  max_users: number;
  max_teams: number;
  max_signals_per_day: number;
  max_decisions_per_month: number;
  max_ai_requests_per_day: number;
  max_storage_mb: number;
  max_integrations: number;

  // Features
  features_included: PlanFeatures;

  // Display
  is_active: boolean;
  is_featured: boolean;
  display_order: number;
  badge_text?: string;

  // Trial
  trial_days: number;

  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface PlanFeatures {
  oracle: boolean;
  analytics: boolean;
  ai_tuning: boolean;
  voice: boolean;
  widgets: boolean;
  export: boolean;
  api_access: boolean;
  sso: boolean;
  audit_logs: boolean;
  priority_support: boolean;
  [key: string]: boolean;
}

// User subscription
export interface Subscription {
  id: string;
  user_id: string;
  org_id?: string;
  plan_id: string;
  plan?: SubscriptionPlan;

  // Stripe
  stripe_customer_id?: string;
  stripe_subscription_id?: string;

  // Status
  status: SubscriptionStatus;
  billing_cycle: BillingCycle;
  current_period_start?: string;
  current_period_end?: string;

  // Trial
  trial_start?: string;
  trial_end?: string;

  // Cancellation
  cancel_at_period_end: boolean;
  canceled_at?: string;
  cancellation_reason?: string;

  usage_reset_at: string;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

// Usage tracking
export interface UsageTracking {
  id: string;
  subscription_id: string;
  user_id: string;
  period_start: string;
  period_end: string;

  // Usage counts
  signals_count: number;
  decisions_count: number;
  ai_requests_count: number;
  storage_used_mb: number;
  team_members_count: number;
  api_calls_count: number;

  // Limits
  signals_limit: number;
  decisions_limit: number;
  ai_requests_limit: number;
  storage_limit_mb: number;

  // Percentages
  signals_usage_percent: number;

  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

// Invoice
export interface Invoice {
  id: string;
  subscription_id: string;
  user_id: string;

  // Stripe
  stripe_invoice_id?: string;
  stripe_payment_intent_id?: string;

  // Details
  invoice_number: string;
  status: InvoiceStatus;

  // Amounts
  subtotal: number;
  tax: number;
  total: number;
  amount_paid: number;
  amount_due: number;
  currency: string;

  // Dates
  invoice_date: string;
  due_date?: string;
  paid_at?: string;

  // Billing info
  billing_name?: string;
  billing_email?: string;
  billing_address?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
  };

  // Line items
  line_items: InvoiceLineItem[];

  // PDF
  pdf_url?: string;
  hosted_invoice_url?: string;

  metadata: Record<string, any>;
  created_at: string;
}

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unit_amount: number;
  amount: number;
  period?: {
    start: string;
    end: string;
  };
}

// Payment method
export interface PaymentMethod {
  id: string;
  user_id: string;
  stripe_payment_method_id: string;
  type: PaymentMethodType;

  // Card info
  card_brand?: string;
  card_last_four?: string;
  card_exp_month?: number;
  card_exp_year?: number;

  // Bank
  bank_name?: string;
  bank_last_four?: string;

  is_default: boolean;
  is_valid: boolean;
  billing_address?: Record<string, any>;

  created_at: string;
  updated_at: string;
}

// Feature usage
export interface FeatureUsage {
  id: string;
  user_id: string;
  subscription_id?: string;
  feature_key: string;
  feature_category: FeatureCategory;
  usage_count: number;
  usage_unit: string;
  usage_timestamp: string;
  context: Record<string, any>;
  created_at: string;
}

// Usage alert
export interface UsageAlert {
  id: string;
  subscription_id: string;
  user_id: string;
  alert_type: UsageAlertType;
  feature_key?: string;
  threshold_percent?: number;
  current_usage?: number;
  limit_value?: number;
  status: 'active' | 'dismissed' | 'resolved';
  dismissed_at?: string;
  notification_sent: boolean;
  notification_sent_at?: string;
  message?: string;
  action_url?: string;
  created_at: string;
}

// API Request/Response types

export interface CreateSubscriptionRequest {
  plan_id: string;
  billing_cycle: BillingCycle;
  payment_method_id?: string;
  coupon_code?: string;
}

export interface UpdateSubscriptionRequest {
  plan_id?: string;
  billing_cycle?: BillingCycle;
  cancel_at_period_end?: boolean;
}

export interface CancelSubscriptionRequest {
  reason?: string;
  feedback?: string;
  cancel_immediately?: boolean;
}

export interface AddPaymentMethodRequest {
  stripe_payment_method_id: string;
  set_as_default?: boolean;
}

export interface UsageSummary {
  subscription: Subscription;
  current_usage: UsageTracking;
  alerts: UsageAlert[];
  days_remaining: number;
  is_trial: boolean;
  trial_days_remaining?: number;
}

export interface PlanComparison {
  plans: SubscriptionPlan[];
  current_plan_id?: string;
  recommended_plan_id?: string;
}

export interface BillingHistory {
  invoices: Invoice[];
  total_count: number;
  has_more: boolean;
}

export interface SubscriptionCheckout {
  checkout_url: string;
  session_id: string;
  expires_at: string;
}

export interface UpgradePreview {
  current_plan: SubscriptionPlan;
  new_plan: SubscriptionPlan;
  prorated_amount: number;
  amount_due: number;
  billing_date: string;
  new_features: string[];
}