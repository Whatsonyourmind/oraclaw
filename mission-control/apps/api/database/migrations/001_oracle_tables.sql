-- ORACLE Autonomous Intelligence Loop Migration
-- Migration: 001_oracle_tables
-- Created: 2026-01-31
-- Description: Creates all ORACLE module tables for the OODA loop system
--
-- Run with: psql -d your_database -f 001_oracle_tables.sql
-- Or via Supabase Dashboard SQL Editor

-- ============================================================================
-- OBSERVE MODULE TABLES
-- ============================================================================

-- Data sources for signal detection (calendar, email, tasks, etc.)
CREATE TABLE IF NOT EXISTS oracle_data_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('calendar', 'email', 'tasks', 'notes', 'meetings', 'manual', 'integration')),
  name TEXT NOT NULL,
  config JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  last_scanned_at TIMESTAMPTZ,
  scan_frequency_minutes INTEGER DEFAULT 60,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Signals detected during radar scans
CREATE TABLE IF NOT EXISTS oracle_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  data_source_id UUID REFERENCES oracle_data_sources(id) ON DELETE SET NULL,
  signal_type TEXT NOT NULL CHECK (signal_type IN ('deadline', 'conflict', 'opportunity', 'risk', 'anomaly', 'pattern', 'dependency', 'resource')),
  title TEXT NOT NULL,
  description TEXT,
  urgency TEXT NOT NULL CHECK (urgency IN ('critical', 'high', 'medium', 'low')),
  impact TEXT NOT NULL CHECK (impact IN ('critical', 'high', 'medium', 'low')),
  confidence DECIMAL(3,2) DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'dismissed', 'resolved')),
  source_data JSONB DEFAULT '{}',
  related_entity_type TEXT,
  related_entity_id UUID,
  expires_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Signal clusters (groups of related signals)
CREATE TABLE IF NOT EXISTS oracle_signal_clusters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  summary TEXT,
  signal_count INTEGER DEFAULT 0,
  combined_urgency TEXT CHECK (combined_urgency IN ('critical', 'high', 'medium', 'low')),
  combined_impact TEXT CHECK (combined_impact IN ('critical', 'high', 'medium', 'low')),
  confidence DECIMAL(3,2) DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Junction table for signals in clusters
CREATE TABLE IF NOT EXISTS oracle_signal_cluster_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_id UUID REFERENCES oracle_signal_clusters(id) ON DELETE CASCADE,
  signal_id UUID REFERENCES oracle_signals(id) ON DELETE CASCADE,
  relevance_score DECIMAL(3,2) DEFAULT 1.0 CHECK (relevance_score >= 0 AND relevance_score <= 1),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(cluster_id, signal_id)
);

-- Anomaly patterns for detection rules
CREATE TABLE IF NOT EXISTS oracle_anomaly_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  pattern_type TEXT NOT NULL CHECK (pattern_type IN ('deviation', 'spike', 'trend', 'absence', 'correlation', 'custom')),
  detection_rules JSONB NOT NULL DEFAULT '{}',
  baseline_data JSONB DEFAULT '{}',
  threshold DECIMAL(5,2) DEFAULT 2.0,
  sensitivity TEXT DEFAULT 'medium' CHECK (sensitivity IN ('low', 'medium', 'high')),
  is_active BOOLEAN DEFAULT TRUE,
  last_triggered_at TIMESTAMPTZ,
  trigger_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- ORIENT MODULE TABLES
-- ============================================================================

-- Strategic contexts synthesized from signals
CREATE TABLE IF NOT EXISTS oracle_contexts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  situation_summary TEXT NOT NULL,
  key_factors JSONB DEFAULT '[]',
  recommendations JSONB DEFAULT '[]',
  constraints JSONB DEFAULT '[]',
  assumptions JSONB DEFAULT '[]',
  confidence DECIMAL(3,2) DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  is_active BOOLEAN DEFAULT TRUE,
  valid_until TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Strategic horizons (multi-timeframe planning)
CREATE TABLE IF NOT EXISTS oracle_horizons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  context_id UUID REFERENCES oracle_contexts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  horizon_type TEXT NOT NULL CHECK (horizon_type IN ('immediate', 'today', 'week', 'month')),
  goals JSONB DEFAULT '[]',
  actions JSONB DEFAULT '[]',
  dependencies JSONB DEFAULT '[]',
  risks JSONB DEFAULT '[]',
  opportunities JSONB DEFAULT '[]',
  priority_score DECIMAL(3,2) DEFAULT 0.5 CHECK (priority_score >= 0 AND priority_score <= 1),
  confidence DECIMAL(3,2) DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Correlations between entities
CREATE TABLE IF NOT EXISTS oracle_correlations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  source_entity_type TEXT NOT NULL,
  source_entity_id UUID NOT NULL,
  target_entity_type TEXT NOT NULL,
  target_entity_id UUID NOT NULL,
  correlation_type TEXT NOT NULL CHECK (correlation_type IN ('causal', 'temporal', 'semantic', 'dependency', 'conflict', 'synergy')),
  strength DECIMAL(3,2) NOT NULL CHECK (strength >= -1 AND strength <= 1),
  direction TEXT DEFAULT 'bidirectional' CHECK (direction IN ('forward', 'backward', 'bidirectional')),
  description TEXT,
  evidence JSONB DEFAULT '[]',
  confidence DECIMAL(3,2) DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Risk/opportunity assessments
CREATE TABLE IF NOT EXISTS oracle_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  context_id UUID REFERENCES oracle_contexts(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  assessment_type TEXT NOT NULL CHECK (assessment_type IN ('risk', 'opportunity')),
  title TEXT NOT NULL,
  description TEXT,
  impact_level TEXT NOT NULL CHECK (impact_level IN ('critical', 'high', 'medium', 'low')),
  likelihood DECIMAL(3,2) NOT NULL CHECK (likelihood >= 0 AND likelihood <= 1),
  urgency TEXT DEFAULT 'medium' CHECK (urgency IN ('critical', 'high', 'medium', 'low')),
  mitigations JSONB DEFAULT '[]',
  related_signals JSONB DEFAULT '[]',
  status TEXT DEFAULT 'identified' CHECK (status IN ('identified', 'analyzing', 'mitigating', 'accepted', 'resolved')),
  confidence DECIMAL(3,2) DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- DECIDE MODULE TABLES
-- ============================================================================

-- Decisions requiring analysis
CREATE TABLE IF NOT EXISTS oracle_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  context_id UUID REFERENCES oracle_contexts(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  decision_type TEXT DEFAULT 'general' CHECK (decision_type IN ('strategic', 'tactical', 'operational', 'general')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'analyzing', 'decided', 'executed', 'cancelled')),
  urgency TEXT DEFAULT 'medium' CHECK (urgency IN ('critical', 'high', 'medium', 'low')),
  deadline TIMESTAMPTZ,
  selected_option_id UUID,
  decision_rationale TEXT,
  confidence DECIMAL(3,2) DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  constraints JSONB DEFAULT '[]',
  criteria JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  decided_at TIMESTAMPTZ
);

-- Decision options (alternatives)
CREATE TABLE IF NOT EXISTS oracle_decision_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id UUID REFERENCES oracle_decisions(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  pros JSONB DEFAULT '[]',
  cons JSONB DEFAULT '[]',
  estimated_outcomes JSONB DEFAULT '{}',
  resource_requirements JSONB DEFAULT '{}',
  risks JSONB DEFAULT '[]',
  confidence DECIMAL(3,2) DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  score DECIMAL(5,2),
  rank INTEGER,
  is_recommended BOOLEAN DEFAULT FALSE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add foreign key constraint for selected_option_id (done separately to avoid circular dependency)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_selected_option'
    AND table_name = 'oracle_decisions'
  ) THEN
    ALTER TABLE oracle_decisions ADD CONSTRAINT fk_selected_option
      FOREIGN KEY (selected_option_id) REFERENCES oracle_decision_options(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Monte Carlo simulations
CREATE TABLE IF NOT EXISTS oracle_simulations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  option_id UUID REFERENCES oracle_decision_options(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  simulation_type TEXT DEFAULT 'monte_carlo' CHECK (simulation_type IN ('monte_carlo', 'sensitivity', 'scenario')),
  iterations INTEGER DEFAULT 1000,
  results JSONB NOT NULL DEFAULT '{}',
  mean_outcome DECIMAL(10,4),
  std_deviation DECIMAL(10,4),
  percentiles JSONB DEFAULT '{}',
  distribution JSONB DEFAULT '[]',
  confidence_interval_low DECIMAL(10,4),
  confidence_interval_high DECIMAL(10,4),
  execution_time_ms INTEGER,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Stakeholder inputs for decisions
CREATE TABLE IF NOT EXISTS oracle_stakeholder_inputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id UUID REFERENCES oracle_decisions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  stakeholder_name TEXT NOT NULL,
  stakeholder_role TEXT,
  input_type TEXT DEFAULT 'opinion' CHECK (input_type IN ('approval', 'opinion', 'constraint', 'requirement', 'veto')),
  content TEXT NOT NULL,
  sentiment TEXT CHECK (sentiment IN ('positive', 'negative', 'neutral', 'mixed')),
  weight DECIMAL(3,2) DEFAULT 1.0 CHECK (weight >= 0 AND weight <= 1),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'acknowledged', 'incorporated', 'rejected')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Critical paths for decision execution
CREATE TABLE IF NOT EXISTS oracle_critical_paths (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id UUID REFERENCES oracle_decisions(id) ON DELETE CASCADE,
  option_id UUID REFERENCES oracle_decision_options(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  steps JSONB NOT NULL DEFAULT '[]',
  dependencies JSONB DEFAULT '[]',
  bottlenecks JSONB DEFAULT '[]',
  total_duration_hours DECIMAL(10,2),
  critical_sequence JSONB DEFAULT '[]',
  parallel_tracks JSONB DEFAULT '[]',
  risk_points JSONB DEFAULT '[]',
  confidence DECIMAL(3,2) DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- ACT MODULE TABLES
-- ============================================================================

-- Execution plans generated from decisions
CREATE TABLE IF NOT EXISTS oracle_execution_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id UUID REFERENCES oracle_decisions(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed', 'cancelled', 'failed')),
  health_score DECIMAL(3,2) DEFAULT 1.0 CHECK (health_score >= 0 AND health_score <= 1),
  progress_percentage DECIMAL(5,2) DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  total_steps INTEGER DEFAULT 0,
  completed_steps INTEGER DEFAULT 0,
  blocked_steps INTEGER DEFAULT 0,
  estimated_completion TIMESTAMPTZ,
  actual_completion TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Individual execution steps
CREATE TABLE IF NOT EXISTS oracle_execution_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID REFERENCES oracle_execution_plans(id) ON DELETE CASCADE,
  parent_step_id UUID REFERENCES oracle_execution_steps(id) ON DELETE SET NULL,
  step_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'blocked', 'skipped')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  completion_criteria JSONB DEFAULT '[]',
  blockers JSONB DEFAULT '[]',
  dependencies JSONB DEFAULT '[]',
  estimated_duration_minutes INTEGER,
  actual_duration_minutes INTEGER,
  assigned_to TEXT,
  due_date TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Progress updates during execution
CREATE TABLE IF NOT EXISTS oracle_progress_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID REFERENCES oracle_execution_plans(id) ON DELETE CASCADE,
  step_id UUID REFERENCES oracle_execution_steps(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  update_type TEXT NOT NULL CHECK (update_type IN ('status_change', 'note', 'blocker', 'milestone', 'adjustment', 'completion')),
  content TEXT NOT NULL,
  previous_status TEXT,
  new_status TEXT,
  progress_delta DECIMAL(5,2),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Plan adjustments (dynamic replanning)
CREATE TABLE IF NOT EXISTS oracle_plan_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID REFERENCES oracle_execution_plans(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  adjustment_type TEXT NOT NULL CHECK (adjustment_type IN ('reorder', 'add_step', 'remove_step', 'modify_step', 'reschedule', 'reassign')),
  reason TEXT NOT NULL,
  changes JSONB NOT NULL DEFAULT '{}',
  impact_assessment TEXT,
  applied BOOLEAN DEFAULT FALSE,
  applied_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Execution outcomes (final results)
CREATE TABLE IF NOT EXISTS oracle_execution_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID REFERENCES oracle_execution_plans(id) ON DELETE CASCADE,
  decision_id UUID REFERENCES oracle_decisions(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  outcome_type TEXT NOT NULL CHECK (outcome_type IN ('success', 'partial_success', 'failure', 'cancelled', 'pivoted')),
  summary TEXT NOT NULL,
  actual_results JSONB DEFAULT '{}',
  expected_results JSONB DEFAULT '{}',
  variance_analysis JSONB DEFAULT '{}',
  success_factors JSONB DEFAULT '[]',
  failure_factors JSONB DEFAULT '[]',
  recommendations JSONB DEFAULT '[]',
  confidence DECIMAL(3,2) DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Learnings captured from outcomes
CREATE TABLE IF NOT EXISTS oracle_learnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outcome_id UUID REFERENCES oracle_execution_outcomes(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  learning_type TEXT NOT NULL CHECK (learning_type IN ('pattern', 'anti_pattern', 'insight', 'best_practice', 'pitfall', 'heuristic')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  pattern JSONB DEFAULT '{}',
  context_tags JSONB DEFAULT '[]',
  applicability JSONB DEFAULT '{}',
  confidence DECIMAL(3,2) DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  times_applied INTEGER DEFAULT 0,
  success_rate DECIMAL(3,2),
  is_active BOOLEAN DEFAULT TRUE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- PROBABILITY ENGINE TABLES
-- ============================================================================

-- Predictions generated by the probability engine
CREATE TABLE IF NOT EXISTS oracle_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  prediction_type TEXT NOT NULL CHECK (prediction_type IN ('task_completion', 'deadline_risk', 'resource_availability', 'outcome_likelihood', 'duration_estimate', 'custom')),
  subject_type TEXT NOT NULL,
  subject_id UUID,
  description TEXT NOT NULL,
  predicted_value DECIMAL(10,4),
  predicted_outcome TEXT,
  confidence DECIMAL(3,2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  factors JSONB DEFAULT '[]',
  factor_weights JSONB DEFAULT '{}',
  decay_rate DECIMAL(6,4) DEFAULT 0.01,
  valid_from TIMESTAMPTZ DEFAULT NOW(),
  valid_until TIMESTAMPTZ,
  resolution_date TIMESTAMPTZ,
  is_resolved BOOLEAN DEFAULT FALSE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Actual outcomes to compare against predictions
CREATE TABLE IF NOT EXISTS oracle_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_id UUID REFERENCES oracle_predictions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  actual_value DECIMAL(10,4),
  actual_outcome TEXT,
  occurred_at TIMESTAMPTZ DEFAULT NOW(),
  accuracy_score DECIMAL(3,2) CHECK (accuracy_score >= 0 AND accuracy_score <= 1),
  variance DECIMAL(10,4),
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Calibration state for Brier score tracking
CREATE TABLE IF NOT EXISTS oracle_calibration (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  calibration_type TEXT NOT NULL CHECK (calibration_type IN ('global', 'by_type', 'by_domain')),
  domain TEXT,
  brier_score DECIMAL(6,4) CHECK (brier_score >= 0 AND brier_score <= 1),
  accuracy_by_bucket JSONB DEFAULT '{}',
  total_predictions INTEGER DEFAULT 0,
  resolved_predictions INTEGER DEFAULT 0,
  alpha DECIMAL(10,4) DEFAULT 1.0,
  beta DECIMAL(10,4) DEFAULT 1.0,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User behavioral patterns for prediction
CREATE TABLE IF NOT EXISTS oracle_user_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  pattern_type TEXT NOT NULL CHECK (pattern_type IN ('time_of_day', 'day_of_week', 'task_type', 'duration', 'completion_rate', 'procrastination', 'energy_level', 'context_switch', 'custom')),
  pattern_name TEXT NOT NULL,
  pattern_data JSONB NOT NULL DEFAULT '{}',
  confidence DECIMAL(3,2) DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  sample_size INTEGER DEFAULT 0,
  last_observed_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- ENVIRONMENT AWARENESS TABLES
-- ============================================================================

-- Environment snapshots (device state, location, time context)
CREATE TABLE IF NOT EXISTS oracle_environment_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  snapshot_type TEXT DEFAULT 'periodic' CHECK (snapshot_type IN ('periodic', 'triggered', 'manual', 'event')),
  location JSONB DEFAULT '{}',
  device_state JSONB DEFAULT '{}',
  network_state JSONB DEFAULT '{}',
  battery_level DECIMAL(5,2) CHECK (battery_level >= 0 AND battery_level <= 100),
  calendar_context JSONB DEFAULT '{}',
  time_context JSONB DEFAULT '{}',
  active_apps JSONB DEFAULT '[]',
  attention_score DECIMAL(3,2) CHECK (attention_score >= 0 AND attention_score <= 1),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Context graph nodes (entities in the user's context)
CREATE TABLE IF NOT EXISTS oracle_context_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  node_type TEXT NOT NULL CHECK (node_type IN ('person', 'project', 'task', 'event', 'location', 'resource', 'concept', 'goal')),
  name TEXT NOT NULL,
  description TEXT,
  properties JSONB DEFAULT '{}',
  importance DECIMAL(3,2) DEFAULT 0.5 CHECK (importance >= 0 AND importance <= 1),
  recency_score DECIMAL(3,2) DEFAULT 0.5 CHECK (recency_score >= 0 AND recency_score <= 1),
  last_accessed_at TIMESTAMPTZ,
  access_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Context graph edges (relationships between nodes)
CREATE TABLE IF NOT EXISTS oracle_context_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  source_node_id UUID REFERENCES oracle_context_nodes(id) ON DELETE CASCADE,
  target_node_id UUID REFERENCES oracle_context_nodes(id) ON DELETE CASCADE,
  edge_type TEXT NOT NULL CHECK (edge_type IN ('related_to', 'depends_on', 'owned_by', 'assigned_to', 'located_at', 'part_of', 'blocks', 'enables', 'conflicts_with')),
  strength DECIMAL(3,2) DEFAULT 0.5 CHECK (strength >= 0 AND strength <= 1),
  direction TEXT DEFAULT 'forward' CHECK (direction IN ('forward', 'backward', 'bidirectional')),
  properties JSONB DEFAULT '{}',
  last_reinforced_at TIMESTAMPTZ DEFAULT NOW(),
  reinforcement_count INTEGER DEFAULT 1,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source_node_id, target_node_id, edge_type)
);

-- Ghost actions (pre-prepared actions awaiting approval)
CREATE TABLE IF NOT EXISTS oracle_ghost_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK (action_type IN ('create_task', 'send_message', 'schedule_event', 'set_reminder', 'update_status', 'delegate', 'escalate', 'archive', 'custom')),
  title TEXT NOT NULL,
  description TEXT,
  draft_action JSONB NOT NULL DEFAULT '{}',
  trigger_conditions JSONB DEFAULT '{}',
  auto_trigger_enabled BOOLEAN DEFAULT FALSE,
  auto_trigger_at TIMESTAMPTZ,
  confidence DECIMAL(3,2) DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  rationale TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'executed', 'expired', 'cancelled')),
  approved_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  related_signals JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- OBSERVE module indexes
CREATE INDEX IF NOT EXISTS idx_oracle_data_sources_user_id ON oracle_data_sources(user_id);
CREATE INDEX IF NOT EXISTS idx_oracle_data_sources_type ON oracle_data_sources(source_type);
CREATE INDEX IF NOT EXISTS idx_oracle_signals_user_id ON oracle_signals(user_id);
CREATE INDEX IF NOT EXISTS idx_oracle_signals_status ON oracle_signals(status);
CREATE INDEX IF NOT EXISTS idx_oracle_signals_type ON oracle_signals(signal_type);
CREATE INDEX IF NOT EXISTS idx_oracle_signals_urgency ON oracle_signals(urgency);
CREATE INDEX IF NOT EXISTS idx_oracle_signals_created_at ON oracle_signals(created_at);
CREATE INDEX IF NOT EXISTS idx_oracle_signals_data_source_id ON oracle_signals(data_source_id);
CREATE INDEX IF NOT EXISTS idx_oracle_signal_clusters_user_id ON oracle_signal_clusters(user_id);
CREATE INDEX IF NOT EXISTS idx_oracle_signal_cluster_members_cluster_id ON oracle_signal_cluster_members(cluster_id);
CREATE INDEX IF NOT EXISTS idx_oracle_signal_cluster_members_signal_id ON oracle_signal_cluster_members(signal_id);
CREATE INDEX IF NOT EXISTS idx_oracle_anomaly_patterns_user_id ON oracle_anomaly_patterns(user_id);
CREATE INDEX IF NOT EXISTS idx_oracle_anomaly_patterns_type ON oracle_anomaly_patterns(pattern_type);

-- ORIENT module indexes
CREATE INDEX IF NOT EXISTS idx_oracle_contexts_user_id ON oracle_contexts(user_id);
CREATE INDEX IF NOT EXISTS idx_oracle_contexts_is_active ON oracle_contexts(is_active);
CREATE INDEX IF NOT EXISTS idx_oracle_contexts_created_at ON oracle_contexts(created_at);
CREATE INDEX IF NOT EXISTS idx_oracle_horizons_user_id ON oracle_horizons(user_id);
CREATE INDEX IF NOT EXISTS idx_oracle_horizons_context_id ON oracle_horizons(context_id);
CREATE INDEX IF NOT EXISTS idx_oracle_horizons_type ON oracle_horizons(horizon_type);
CREATE INDEX IF NOT EXISTS idx_oracle_correlations_user_id ON oracle_correlations(user_id);
CREATE INDEX IF NOT EXISTS idx_oracle_correlations_source ON oracle_correlations(source_entity_type, source_entity_id);
CREATE INDEX IF NOT EXISTS idx_oracle_correlations_target ON oracle_correlations(target_entity_type, target_entity_id);
CREATE INDEX IF NOT EXISTS idx_oracle_assessments_user_id ON oracle_assessments(user_id);
CREATE INDEX IF NOT EXISTS idx_oracle_assessments_context_id ON oracle_assessments(context_id);
CREATE INDEX IF NOT EXISTS idx_oracle_assessments_type ON oracle_assessments(assessment_type);
CREATE INDEX IF NOT EXISTS idx_oracle_assessments_status ON oracle_assessments(status);

-- DECIDE module indexes
CREATE INDEX IF NOT EXISTS idx_oracle_decisions_user_id ON oracle_decisions(user_id);
CREATE INDEX IF NOT EXISTS idx_oracle_decisions_context_id ON oracle_decisions(context_id);
CREATE INDEX IF NOT EXISTS idx_oracle_decisions_status ON oracle_decisions(status);
CREATE INDEX IF NOT EXISTS idx_oracle_decisions_created_at ON oracle_decisions(created_at);
CREATE INDEX IF NOT EXISTS idx_oracle_decision_options_decision_id ON oracle_decision_options(decision_id);
CREATE INDEX IF NOT EXISTS idx_oracle_simulations_option_id ON oracle_simulations(option_id);
CREATE INDEX IF NOT EXISTS idx_oracle_simulations_user_id ON oracle_simulations(user_id);
CREATE INDEX IF NOT EXISTS idx_oracle_stakeholder_inputs_decision_id ON oracle_stakeholder_inputs(decision_id);
CREATE INDEX IF NOT EXISTS idx_oracle_stakeholder_inputs_user_id ON oracle_stakeholder_inputs(user_id);
CREATE INDEX IF NOT EXISTS idx_oracle_critical_paths_decision_id ON oracle_critical_paths(decision_id);
CREATE INDEX IF NOT EXISTS idx_oracle_critical_paths_user_id ON oracle_critical_paths(user_id);

-- ACT module indexes
CREATE INDEX IF NOT EXISTS idx_oracle_execution_plans_user_id ON oracle_execution_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_oracle_execution_plans_decision_id ON oracle_execution_plans(decision_id);
CREATE INDEX IF NOT EXISTS idx_oracle_execution_plans_status ON oracle_execution_plans(status);
CREATE INDEX IF NOT EXISTS idx_oracle_execution_plans_created_at ON oracle_execution_plans(created_at);
CREATE INDEX IF NOT EXISTS idx_oracle_execution_steps_plan_id ON oracle_execution_steps(plan_id);
CREATE INDEX IF NOT EXISTS idx_oracle_execution_steps_status ON oracle_execution_steps(status);
CREATE INDEX IF NOT EXISTS idx_oracle_execution_steps_parent_id ON oracle_execution_steps(parent_step_id);
CREATE INDEX IF NOT EXISTS idx_oracle_progress_updates_plan_id ON oracle_progress_updates(plan_id);
CREATE INDEX IF NOT EXISTS idx_oracle_progress_updates_step_id ON oracle_progress_updates(step_id);
CREATE INDEX IF NOT EXISTS idx_oracle_progress_updates_user_id ON oracle_progress_updates(user_id);
CREATE INDEX IF NOT EXISTS idx_oracle_plan_adjustments_plan_id ON oracle_plan_adjustments(plan_id);
CREATE INDEX IF NOT EXISTS idx_oracle_plan_adjustments_user_id ON oracle_plan_adjustments(user_id);
CREATE INDEX IF NOT EXISTS idx_oracle_execution_outcomes_plan_id ON oracle_execution_outcomes(plan_id);
CREATE INDEX IF NOT EXISTS idx_oracle_execution_outcomes_user_id ON oracle_execution_outcomes(user_id);
CREATE INDEX IF NOT EXISTS idx_oracle_learnings_user_id ON oracle_learnings(user_id);
CREATE INDEX IF NOT EXISTS idx_oracle_learnings_outcome_id ON oracle_learnings(outcome_id);
CREATE INDEX IF NOT EXISTS idx_oracle_learnings_type ON oracle_learnings(learning_type);

-- PROBABILITY ENGINE module indexes
CREATE INDEX IF NOT EXISTS idx_oracle_predictions_user_id ON oracle_predictions(user_id);
CREATE INDEX IF NOT EXISTS idx_oracle_predictions_type ON oracle_predictions(prediction_type);
CREATE INDEX IF NOT EXISTS idx_oracle_predictions_subject ON oracle_predictions(subject_type, subject_id);
CREATE INDEX IF NOT EXISTS idx_oracle_predictions_resolved ON oracle_predictions(is_resolved);
CREATE INDEX IF NOT EXISTS idx_oracle_predictions_created_at ON oracle_predictions(created_at);
CREATE INDEX IF NOT EXISTS idx_oracle_outcomes_prediction_id ON oracle_outcomes(prediction_id);
CREATE INDEX IF NOT EXISTS idx_oracle_outcomes_user_id ON oracle_outcomes(user_id);
CREATE INDEX IF NOT EXISTS idx_oracle_calibration_user_id ON oracle_calibration(user_id);
CREATE INDEX IF NOT EXISTS idx_oracle_calibration_type ON oracle_calibration(calibration_type);
CREATE INDEX IF NOT EXISTS idx_oracle_user_patterns_user_id ON oracle_user_patterns(user_id);
CREATE INDEX IF NOT EXISTS idx_oracle_user_patterns_type ON oracle_user_patterns(pattern_type);

-- ENVIRONMENT AWARENESS module indexes
CREATE INDEX IF NOT EXISTS idx_oracle_environment_snapshots_user_id ON oracle_environment_snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_oracle_environment_snapshots_created_at ON oracle_environment_snapshots(created_at);
CREATE INDEX IF NOT EXISTS idx_oracle_environment_snapshots_type ON oracle_environment_snapshots(snapshot_type);
CREATE INDEX IF NOT EXISTS idx_oracle_context_nodes_user_id ON oracle_context_nodes(user_id);
CREATE INDEX IF NOT EXISTS idx_oracle_context_nodes_type ON oracle_context_nodes(node_type);
CREATE INDEX IF NOT EXISTS idx_oracle_context_nodes_is_active ON oracle_context_nodes(is_active);
CREATE INDEX IF NOT EXISTS idx_oracle_context_edges_user_id ON oracle_context_edges(user_id);
CREATE INDEX IF NOT EXISTS idx_oracle_context_edges_source ON oracle_context_edges(source_node_id);
CREATE INDEX IF NOT EXISTS idx_oracle_context_edges_target ON oracle_context_edges(target_node_id);
CREATE INDEX IF NOT EXISTS idx_oracle_context_edges_type ON oracle_context_edges(edge_type);
CREATE INDEX IF NOT EXISTS idx_oracle_ghost_actions_user_id ON oracle_ghost_actions(user_id);
CREATE INDEX IF NOT EXISTS idx_oracle_ghost_actions_status ON oracle_ghost_actions(status);
CREATE INDEX IF NOT EXISTS idx_oracle_ghost_actions_created_at ON oracle_ghost_actions(created_at);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all ORACLE tables
ALTER TABLE oracle_data_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_signal_clusters ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_signal_cluster_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_anomaly_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_contexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_horizons ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_correlations ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_decision_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_simulations ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_stakeholder_inputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_critical_paths ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_execution_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_execution_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_progress_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_plan_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_execution_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_learnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_calibration ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_user_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_environment_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_context_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_context_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_ghost_actions ENABLE ROW LEVEL SECURITY;

-- RLS Policies (using DROP POLICY IF EXISTS pattern for idempotency)

-- OBSERVE module policies
DROP POLICY IF EXISTS "Data sources belong to user" ON oracle_data_sources;
CREATE POLICY "Data sources belong to user" ON oracle_data_sources FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Signals belong to user" ON oracle_signals;
CREATE POLICY "Signals belong to user" ON oracle_signals FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Signal clusters belong to user" ON oracle_signal_clusters;
CREATE POLICY "Signal clusters belong to user" ON oracle_signal_clusters FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Signal cluster members belong to user" ON oracle_signal_cluster_members;
CREATE POLICY "Signal cluster members belong to user" ON oracle_signal_cluster_members FOR ALL USING (EXISTS (
  SELECT 1 FROM oracle_signal_clusters WHERE oracle_signal_clusters.id = oracle_signal_cluster_members.cluster_id AND oracle_signal_clusters.user_id = auth.uid()
));

DROP POLICY IF EXISTS "Anomaly patterns belong to user" ON oracle_anomaly_patterns;
CREATE POLICY "Anomaly patterns belong to user" ON oracle_anomaly_patterns FOR ALL USING (auth.uid() = user_id);

-- ORIENT module policies
DROP POLICY IF EXISTS "Contexts belong to user" ON oracle_contexts;
CREATE POLICY "Contexts belong to user" ON oracle_contexts FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Horizons belong to user" ON oracle_horizons;
CREATE POLICY "Horizons belong to user" ON oracle_horizons FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Correlations belong to user" ON oracle_correlations;
CREATE POLICY "Correlations belong to user" ON oracle_correlations FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Assessments belong to user" ON oracle_assessments;
CREATE POLICY "Assessments belong to user" ON oracle_assessments FOR ALL USING (auth.uid() = user_id);

-- DECIDE module policies
DROP POLICY IF EXISTS "Decisions belong to user" ON oracle_decisions;
CREATE POLICY "Decisions belong to user" ON oracle_decisions FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Decision options belong to user" ON oracle_decision_options;
CREATE POLICY "Decision options belong to user" ON oracle_decision_options FOR ALL USING (EXISTS (
  SELECT 1 FROM oracle_decisions WHERE oracle_decisions.id = oracle_decision_options.decision_id AND oracle_decisions.user_id = auth.uid()
));

DROP POLICY IF EXISTS "Simulations belong to user" ON oracle_simulations;
CREATE POLICY "Simulations belong to user" ON oracle_simulations FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Stakeholder inputs belong to user" ON oracle_stakeholder_inputs;
CREATE POLICY "Stakeholder inputs belong to user" ON oracle_stakeholder_inputs FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Critical paths belong to user" ON oracle_critical_paths;
CREATE POLICY "Critical paths belong to user" ON oracle_critical_paths FOR ALL USING (auth.uid() = user_id);

-- ACT module policies
DROP POLICY IF EXISTS "Execution plans belong to user" ON oracle_execution_plans;
CREATE POLICY "Execution plans belong to user" ON oracle_execution_plans FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Execution steps belong to user" ON oracle_execution_steps;
CREATE POLICY "Execution steps belong to user" ON oracle_execution_steps FOR ALL USING (EXISTS (
  SELECT 1 FROM oracle_execution_plans WHERE oracle_execution_plans.id = oracle_execution_steps.plan_id AND oracle_execution_plans.user_id = auth.uid()
));

DROP POLICY IF EXISTS "Progress updates belong to user" ON oracle_progress_updates;
CREATE POLICY "Progress updates belong to user" ON oracle_progress_updates FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Plan adjustments belong to user" ON oracle_plan_adjustments;
CREATE POLICY "Plan adjustments belong to user" ON oracle_plan_adjustments FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Execution outcomes belong to user" ON oracle_execution_outcomes;
CREATE POLICY "Execution outcomes belong to user" ON oracle_execution_outcomes FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Learnings belong to user" ON oracle_learnings;
CREATE POLICY "Learnings belong to user" ON oracle_learnings FOR ALL USING (auth.uid() = user_id);

-- PROBABILITY ENGINE module policies
DROP POLICY IF EXISTS "Predictions belong to user" ON oracle_predictions;
CREATE POLICY "Predictions belong to user" ON oracle_predictions FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Outcomes belong to user" ON oracle_outcomes;
CREATE POLICY "Outcomes belong to user" ON oracle_outcomes FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Calibration belongs to user" ON oracle_calibration;
CREATE POLICY "Calibration belongs to user" ON oracle_calibration FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "User patterns belong to user" ON oracle_user_patterns;
CREATE POLICY "User patterns belong to user" ON oracle_user_patterns FOR ALL USING (auth.uid() = user_id);

-- ENVIRONMENT AWARENESS module policies
DROP POLICY IF EXISTS "Environment snapshots belong to user" ON oracle_environment_snapshots;
CREATE POLICY "Environment snapshots belong to user" ON oracle_environment_snapshots FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Context nodes belong to user" ON oracle_context_nodes;
CREATE POLICY "Context nodes belong to user" ON oracle_context_nodes FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Context edges belong to user" ON oracle_context_edges;
CREATE POLICY "Context edges belong to user" ON oracle_context_edges FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Ghost actions belong to user" ON oracle_ghost_actions;
CREATE POLICY "Ghost actions belong to user" ON oracle_ghost_actions FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- TRIGGERS FOR updated_at
-- ============================================================================

-- Create or replace the update_updated_at_column function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- OBSERVE module triggers
DROP TRIGGER IF EXISTS update_oracle_data_sources_updated_at ON oracle_data_sources;
CREATE TRIGGER update_oracle_data_sources_updated_at
  BEFORE UPDATE ON oracle_data_sources
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_oracle_signals_updated_at ON oracle_signals;
CREATE TRIGGER update_oracle_signals_updated_at
  BEFORE UPDATE ON oracle_signals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_oracle_signal_clusters_updated_at ON oracle_signal_clusters;
CREATE TRIGGER update_oracle_signal_clusters_updated_at
  BEFORE UPDATE ON oracle_signal_clusters
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_oracle_anomaly_patterns_updated_at ON oracle_anomaly_patterns;
CREATE TRIGGER update_oracle_anomaly_patterns_updated_at
  BEFORE UPDATE ON oracle_anomaly_patterns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ORIENT module triggers
DROP TRIGGER IF EXISTS update_oracle_contexts_updated_at ON oracle_contexts;
CREATE TRIGGER update_oracle_contexts_updated_at
  BEFORE UPDATE ON oracle_contexts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_oracle_horizons_updated_at ON oracle_horizons;
CREATE TRIGGER update_oracle_horizons_updated_at
  BEFORE UPDATE ON oracle_horizons
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_oracle_correlations_updated_at ON oracle_correlations;
CREATE TRIGGER update_oracle_correlations_updated_at
  BEFORE UPDATE ON oracle_correlations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_oracle_assessments_updated_at ON oracle_assessments;
CREATE TRIGGER update_oracle_assessments_updated_at
  BEFORE UPDATE ON oracle_assessments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- DECIDE module triggers
DROP TRIGGER IF EXISTS update_oracle_decisions_updated_at ON oracle_decisions;
CREATE TRIGGER update_oracle_decisions_updated_at
  BEFORE UPDATE ON oracle_decisions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_oracle_decision_options_updated_at ON oracle_decision_options;
CREATE TRIGGER update_oracle_decision_options_updated_at
  BEFORE UPDATE ON oracle_decision_options
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_oracle_stakeholder_inputs_updated_at ON oracle_stakeholder_inputs;
CREATE TRIGGER update_oracle_stakeholder_inputs_updated_at
  BEFORE UPDATE ON oracle_stakeholder_inputs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_oracle_critical_paths_updated_at ON oracle_critical_paths;
CREATE TRIGGER update_oracle_critical_paths_updated_at
  BEFORE UPDATE ON oracle_critical_paths
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ACT module triggers
DROP TRIGGER IF EXISTS update_oracle_execution_plans_updated_at ON oracle_execution_plans;
CREATE TRIGGER update_oracle_execution_plans_updated_at
  BEFORE UPDATE ON oracle_execution_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_oracle_execution_steps_updated_at ON oracle_execution_steps;
CREATE TRIGGER update_oracle_execution_steps_updated_at
  BEFORE UPDATE ON oracle_execution_steps
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_oracle_learnings_updated_at ON oracle_learnings;
CREATE TRIGGER update_oracle_learnings_updated_at
  BEFORE UPDATE ON oracle_learnings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- PROBABILITY ENGINE module triggers
DROP TRIGGER IF EXISTS update_oracle_predictions_updated_at ON oracle_predictions;
CREATE TRIGGER update_oracle_predictions_updated_at
  BEFORE UPDATE ON oracle_predictions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_oracle_calibration_updated_at ON oracle_calibration;
CREATE TRIGGER update_oracle_calibration_updated_at
  BEFORE UPDATE ON oracle_calibration
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_oracle_user_patterns_updated_at ON oracle_user_patterns;
CREATE TRIGGER update_oracle_user_patterns_updated_at
  BEFORE UPDATE ON oracle_user_patterns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ENVIRONMENT AWARENESS module triggers
DROP TRIGGER IF EXISTS update_oracle_context_nodes_updated_at ON oracle_context_nodes;
CREATE TRIGGER update_oracle_context_nodes_updated_at
  BEFORE UPDATE ON oracle_context_nodes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_oracle_context_edges_updated_at ON oracle_context_edges;
CREATE TRIGGER update_oracle_context_edges_updated_at
  BEFORE UPDATE ON oracle_context_edges
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_oracle_ghost_actions_updated_at ON oracle_ghost_actions;
CREATE TRIGGER update_oracle_ghost_actions_updated_at
  BEFORE UPDATE ON oracle_ghost_actions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- This migration creates 28 ORACLE tables across 5 modules:
-- - OBSERVE: oracle_data_sources, oracle_signals, oracle_signal_clusters,
--            oracle_signal_cluster_members, oracle_anomaly_patterns
-- - ORIENT: oracle_contexts, oracle_horizons, oracle_correlations, oracle_assessments
-- - DECIDE: oracle_decisions, oracle_decision_options, oracle_simulations,
--           oracle_stakeholder_inputs, oracle_critical_paths
-- - ACT: oracle_execution_plans, oracle_execution_steps, oracle_progress_updates,
--        oracle_plan_adjustments, oracle_execution_outcomes, oracle_learnings
-- - PROBABILITY ENGINE: oracle_predictions, oracle_outcomes, oracle_calibration,
--                       oracle_user_patterns
-- - ENVIRONMENT AWARENESS: oracle_environment_snapshots, oracle_context_nodes,
--                          oracle_context_edges, oracle_ghost_actions
