-- MISSION CONTROL DATABASE SCHEMA
-- Supabase Free Tier Compatible (500MB limit)

-- Enable vector extension for semantic search
CREATE EXTENSION IF NOT EXISTS vector;

-- Users table
CREATE TABLE users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro')),
  last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Devices table for multi-device support
CREATE TABLE devices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  device_key TEXT UNIQUE NOT NULL,
  platform TEXT NOT NULL,
  last_sync TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Missions table
CREATE TABLE missions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT DEFAULT NOW()
);

-- Sources table (uploaded files)
CREATE TABLE sources (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mission_id UUID REFERENCES missions(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('image', 'pdf', 'audio', 'text')),
  file_path TEXT NOT NULL,
  file_size INTEGER,
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Extracts table (AI extraction results)
CREATE TABLE extracts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source_id UUID REFERENCES sources(id) ON DELETE CASCADE,
  data_type TEXT NOT NULL,
  confidence DECIMAL(3,2) CHECK (confidence >= 0 AND confidence <= 1),
  structured_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Actions table
CREATE TABLE actions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mission_id UUID REFERENCES missions(id) ON DELETE CASCADE,
  source_id UUID REFERENCES sources(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('task', 'event', 'draft', 'reminder')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  title TEXT NOT NULL,
  description TEXT,
  due_date TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Briefings table
CREATE TABLE briefings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  summary TEXT NOT NULL,
  priorities JSONB NOT NULL,
  time_windows JSONB DEFAULT '[]',
  recommended_actions JSONB DEFAULT '[]',
  delegation_opportunities JSONB DEFAULT '[]',
  confidence DECIMAL(3,2) DEFAULT 0.8,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Meetings table
CREATE TABLE meetings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title TEXT,
  audio_path TEXT,
  transcript TEXT,
  decisions JSONB DEFAULT '[]',
  risks JSONB DEFAULT '[]',
  follow_ups JSONB DEFAULT '[]',
  confidence DECIMAL(3,2) DEFAULT 0.8,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Redactions table
CREATE TABLE redactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source_id UUID REFERENCES sources(id) ON DELETE CASCADE,
  patterns JSONB NOT NULL,
  preview JSONB,
  applied BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Embeddings table for semantic search
CREATE TABLE embeddings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  content_type TEXT NOT NULL,
  content_id UUID NOT NULL,
  vector vector(1536), -- OpenAI ada-002 dimension (works with free alternatives too)
  model_version TEXT DEFAULT 'text-embedding-ada-002',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Analytics events table
CREATE TABLE events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  properties JSONB DEFAULT '{}',
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_missions_user_id ON missions(user_id);
CREATE INDEX idx_missions_status ON missions(status);
CREATE INDEX idx_sources_mission_id ON sources(mission_id);
CREATE INDEX idx_extracts_source_id ON extracts(source_id);
CREATE INDEX idx_actions_mission_id ON actions(mission_id);
CREATE INDEX idx_actions_status ON actions(status);
CREATE INDEX idx_briefings_user_id ON briefings(user_id);
CREATE INDEX idx_meetings_user_id ON meetings(user_id);
CREATE INDEX idx_events_user_id ON events(user_id);
CREATE INDEX idx_events_timestamp ON events(timestamp);

-- Vector similarity search index
CREATE INDEX idx_embeddings_vector ON embeddings USING ivfflat (vector vector_cosine_ops);

-- RLS (Row Level Security) Policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE extracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE briefings ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Users can only see their own data
CREATE POLICY "Users can view own data" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Missions belong to user" ON missions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Sources belong to mission" ON sources FOR ALL USING (EXISTS (
  SELECT 1 FROM missions WHERE missions.id = sources.mission_id AND missions.user_id = auth.uid()
));
CREATE POLICY "Extracts belong to source" ON extracts FOR ALL USING (EXISTS (
  SELECT 1 FROM sources JOIN missions ON sources.mission_id = missions.id 
  WHERE sources.id = extracts.source_id AND missions.user_id = auth.uid()
));
CREATE POLICY "Actions belong to mission" ON actions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Briefings belong to user" ON briefings FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Meetings belong to user" ON meetings FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Events belong to user" ON events FOR ALL USING (auth.uid() = user_id);

-- Functions for common operations
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to auto-update updated_at
CREATE TRIGGER update_missions_updated_at 
  BEFORE UPDATE ON missions 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to get user's active missions
CREATE OR REPLACE FUNCTION get_active_missions(user_uuid UUID)
RETURNS TABLE (
  id UUID,
  title TEXT,
  priority TEXT,
  status TEXT,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT m.id, m.title, m.priority, m.status, m.created_at
  FROM missions m
  WHERE m.user_id = user_uuid AND m.status = 'active'
  ORDER BY m.priority DESC, m.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Storage bucket for files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'mission-files',
  'mission-files',
  false,
  52428800, -- 50MB limit (free tier)
  ARRAY['image/*', 'application/pdf', 'audio/*', 'text/*']
) ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Users can upload their own files" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'mission-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own files" ON storage.objects
  FOR SELECT USING (bucket_id = 'mission-files' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ============================================================================
-- ORACLE AUTONOMOUS INTELLIGENCE LOOP SCHEMA
-- ============================================================================

-- ============================================================================
-- OBSERVE MODULE TABLES
-- ============================================================================

-- Data sources for signal detection (calendar, email, tasks, etc.)
CREATE TABLE oracle_data_sources (
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
CREATE TABLE oracle_signals (
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
CREATE TABLE oracle_signal_clusters (
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
CREATE TABLE oracle_signal_cluster_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_id UUID REFERENCES oracle_signal_clusters(id) ON DELETE CASCADE,
  signal_id UUID REFERENCES oracle_signals(id) ON DELETE CASCADE,
  relevance_score DECIMAL(3,2) DEFAULT 1.0 CHECK (relevance_score >= 0 AND relevance_score <= 1),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(cluster_id, signal_id)
);

-- Anomaly patterns for detection rules
CREATE TABLE oracle_anomaly_patterns (
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

-- Indexes for OBSERVE module
CREATE INDEX idx_oracle_data_sources_user_id ON oracle_data_sources(user_id);
CREATE INDEX idx_oracle_data_sources_type ON oracle_data_sources(source_type);
CREATE INDEX idx_oracle_signals_user_id ON oracle_signals(user_id);
CREATE INDEX idx_oracle_signals_status ON oracle_signals(status);
CREATE INDEX idx_oracle_signals_type ON oracle_signals(signal_type);
CREATE INDEX idx_oracle_signals_urgency ON oracle_signals(urgency);
CREATE INDEX idx_oracle_signals_created_at ON oracle_signals(created_at);
CREATE INDEX idx_oracle_signals_data_source_id ON oracle_signals(data_source_id);
CREATE INDEX idx_oracle_signal_clusters_user_id ON oracle_signal_clusters(user_id);
CREATE INDEX idx_oracle_signal_cluster_members_cluster_id ON oracle_signal_cluster_members(cluster_id);
CREATE INDEX idx_oracle_signal_cluster_members_signal_id ON oracle_signal_cluster_members(signal_id);
CREATE INDEX idx_oracle_anomaly_patterns_user_id ON oracle_anomaly_patterns(user_id);
CREATE INDEX idx_oracle_anomaly_patterns_type ON oracle_anomaly_patterns(pattern_type);

-- RLS for OBSERVE module
ALTER TABLE oracle_data_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_signal_clusters ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_signal_cluster_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_anomaly_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Data sources belong to user" ON oracle_data_sources FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Signals belong to user" ON oracle_signals FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Signal clusters belong to user" ON oracle_signal_clusters FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Signal cluster members belong to user" ON oracle_signal_cluster_members FOR ALL USING (EXISTS (
  SELECT 1 FROM oracle_signal_clusters WHERE oracle_signal_clusters.id = oracle_signal_cluster_members.cluster_id AND oracle_signal_clusters.user_id = auth.uid()
));
CREATE POLICY "Anomaly patterns belong to user" ON oracle_anomaly_patterns FOR ALL USING (auth.uid() = user_id);

-- Triggers for updated_at
CREATE TRIGGER update_oracle_data_sources_updated_at
  BEFORE UPDATE ON oracle_data_sources
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_oracle_signals_updated_at
  BEFORE UPDATE ON oracle_signals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_oracle_signal_clusters_updated_at
  BEFORE UPDATE ON oracle_signal_clusters
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_oracle_anomaly_patterns_updated_at
  BEFORE UPDATE ON oracle_anomaly_patterns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ORIENT MODULE TABLES
-- ============================================================================

-- Strategic contexts synthesized from signals
CREATE TABLE oracle_contexts (
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
CREATE TABLE oracle_horizons (
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
CREATE TABLE oracle_correlations (
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
CREATE TABLE oracle_assessments (
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

-- Indexes for ORIENT module
CREATE INDEX idx_oracle_contexts_user_id ON oracle_contexts(user_id);
CREATE INDEX idx_oracle_contexts_is_active ON oracle_contexts(is_active);
CREATE INDEX idx_oracle_contexts_created_at ON oracle_contexts(created_at);
CREATE INDEX idx_oracle_horizons_user_id ON oracle_horizons(user_id);
CREATE INDEX idx_oracle_horizons_context_id ON oracle_horizons(context_id);
CREATE INDEX idx_oracle_horizons_type ON oracle_horizons(horizon_type);
CREATE INDEX idx_oracle_correlations_user_id ON oracle_correlations(user_id);
CREATE INDEX idx_oracle_correlations_source ON oracle_correlations(source_entity_type, source_entity_id);
CREATE INDEX idx_oracle_correlations_target ON oracle_correlations(target_entity_type, target_entity_id);
CREATE INDEX idx_oracle_assessments_user_id ON oracle_assessments(user_id);
CREATE INDEX idx_oracle_assessments_context_id ON oracle_assessments(context_id);
CREATE INDEX idx_oracle_assessments_type ON oracle_assessments(assessment_type);
CREATE INDEX idx_oracle_assessments_status ON oracle_assessments(status);

-- RLS for ORIENT module
ALTER TABLE oracle_contexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_horizons ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_correlations ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Contexts belong to user" ON oracle_contexts FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Horizons belong to user" ON oracle_horizons FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Correlations belong to user" ON oracle_correlations FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Assessments belong to user" ON oracle_assessments FOR ALL USING (auth.uid() = user_id);

-- Triggers for updated_at
CREATE TRIGGER update_oracle_contexts_updated_at
  BEFORE UPDATE ON oracle_contexts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_oracle_horizons_updated_at
  BEFORE UPDATE ON oracle_horizons
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_oracle_correlations_updated_at
  BEFORE UPDATE ON oracle_correlations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_oracle_assessments_updated_at
  BEFORE UPDATE ON oracle_assessments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- DECIDE MODULE TABLES
-- ============================================================================

-- Decisions requiring analysis
CREATE TABLE oracle_decisions (
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
CREATE TABLE oracle_decision_options (
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

-- Add foreign key constraint after options table exists
ALTER TABLE oracle_decisions ADD CONSTRAINT fk_selected_option
  FOREIGN KEY (selected_option_id) REFERENCES oracle_decision_options(id) ON DELETE SET NULL;

-- Monte Carlo simulations
CREATE TABLE oracle_simulations (
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
CREATE TABLE oracle_stakeholder_inputs (
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
CREATE TABLE oracle_critical_paths (
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

-- Indexes for DECIDE module
CREATE INDEX idx_oracle_decisions_user_id ON oracle_decisions(user_id);
CREATE INDEX idx_oracle_decisions_context_id ON oracle_decisions(context_id);
CREATE INDEX idx_oracle_decisions_status ON oracle_decisions(status);
CREATE INDEX idx_oracle_decisions_created_at ON oracle_decisions(created_at);
CREATE INDEX idx_oracle_decision_options_decision_id ON oracle_decision_options(decision_id);
CREATE INDEX idx_oracle_simulations_option_id ON oracle_simulations(option_id);
CREATE INDEX idx_oracle_simulations_user_id ON oracle_simulations(user_id);
CREATE INDEX idx_oracle_stakeholder_inputs_decision_id ON oracle_stakeholder_inputs(decision_id);
CREATE INDEX idx_oracle_stakeholder_inputs_user_id ON oracle_stakeholder_inputs(user_id);
CREATE INDEX idx_oracle_critical_paths_decision_id ON oracle_critical_paths(decision_id);
CREATE INDEX idx_oracle_critical_paths_user_id ON oracle_critical_paths(user_id);

-- RLS for DECIDE module
ALTER TABLE oracle_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_decision_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_simulations ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_stakeholder_inputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_critical_paths ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Decisions belong to user" ON oracle_decisions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Decision options belong to user" ON oracle_decision_options FOR ALL USING (EXISTS (
  SELECT 1 FROM oracle_decisions WHERE oracle_decisions.id = oracle_decision_options.decision_id AND oracle_decisions.user_id = auth.uid()
));
CREATE POLICY "Simulations belong to user" ON oracle_simulations FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Stakeholder inputs belong to user" ON oracle_stakeholder_inputs FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Critical paths belong to user" ON oracle_critical_paths FOR ALL USING (auth.uid() = user_id);

-- Triggers for updated_at
CREATE TRIGGER update_oracle_decisions_updated_at
  BEFORE UPDATE ON oracle_decisions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_oracle_decision_options_updated_at
  BEFORE UPDATE ON oracle_decision_options
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_oracle_stakeholder_inputs_updated_at
  BEFORE UPDATE ON oracle_stakeholder_inputs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_oracle_critical_paths_updated_at
  BEFORE UPDATE ON oracle_critical_paths
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ACT MODULE TABLES
-- ============================================================================

-- Execution plans generated from decisions
CREATE TABLE oracle_execution_plans (
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
CREATE TABLE oracle_execution_steps (
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
CREATE TABLE oracle_progress_updates (
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
CREATE TABLE oracle_plan_adjustments (
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
CREATE TABLE oracle_execution_outcomes (
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
CREATE TABLE oracle_learnings (
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

-- Indexes for ACT module
CREATE INDEX idx_oracle_execution_plans_user_id ON oracle_execution_plans(user_id);
CREATE INDEX idx_oracle_execution_plans_decision_id ON oracle_execution_plans(decision_id);
CREATE INDEX idx_oracle_execution_plans_status ON oracle_execution_plans(status);
CREATE INDEX idx_oracle_execution_plans_created_at ON oracle_execution_plans(created_at);
CREATE INDEX idx_oracle_execution_steps_plan_id ON oracle_execution_steps(plan_id);
CREATE INDEX idx_oracle_execution_steps_status ON oracle_execution_steps(status);
CREATE INDEX idx_oracle_execution_steps_parent_id ON oracle_execution_steps(parent_step_id);
CREATE INDEX idx_oracle_progress_updates_plan_id ON oracle_progress_updates(plan_id);
CREATE INDEX idx_oracle_progress_updates_step_id ON oracle_progress_updates(step_id);
CREATE INDEX idx_oracle_progress_updates_user_id ON oracle_progress_updates(user_id);
CREATE INDEX idx_oracle_plan_adjustments_plan_id ON oracle_plan_adjustments(plan_id);
CREATE INDEX idx_oracle_plan_adjustments_user_id ON oracle_plan_adjustments(user_id);
CREATE INDEX idx_oracle_execution_outcomes_plan_id ON oracle_execution_outcomes(plan_id);
CREATE INDEX idx_oracle_execution_outcomes_user_id ON oracle_execution_outcomes(user_id);
CREATE INDEX idx_oracle_learnings_user_id ON oracle_learnings(user_id);
CREATE INDEX idx_oracle_learnings_outcome_id ON oracle_learnings(outcome_id);
CREATE INDEX idx_oracle_learnings_type ON oracle_learnings(learning_type);

-- RLS for ACT module
ALTER TABLE oracle_execution_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_execution_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_progress_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_plan_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_execution_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_learnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Execution plans belong to user" ON oracle_execution_plans FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Execution steps belong to user" ON oracle_execution_steps FOR ALL USING (EXISTS (
  SELECT 1 FROM oracle_execution_plans WHERE oracle_execution_plans.id = oracle_execution_steps.plan_id AND oracle_execution_plans.user_id = auth.uid()
));
CREATE POLICY "Progress updates belong to user" ON oracle_progress_updates FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Plan adjustments belong to user" ON oracle_plan_adjustments FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Execution outcomes belong to user" ON oracle_execution_outcomes FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Learnings belong to user" ON oracle_learnings FOR ALL USING (auth.uid() = user_id);

-- Triggers for updated_at
CREATE TRIGGER update_oracle_execution_plans_updated_at
  BEFORE UPDATE ON oracle_execution_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_oracle_execution_steps_updated_at
  BEFORE UPDATE ON oracle_execution_steps
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_oracle_learnings_updated_at
  BEFORE UPDATE ON oracle_learnings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- PROBABILITY ENGINE TABLES
-- ============================================================================

-- Predictions generated by the probability engine
CREATE TABLE oracle_predictions (
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
CREATE TABLE oracle_outcomes (
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
CREATE TABLE oracle_calibration (
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
CREATE TABLE oracle_user_patterns (
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

-- Indexes for PROBABILITY ENGINE module
CREATE INDEX idx_oracle_predictions_user_id ON oracle_predictions(user_id);
CREATE INDEX idx_oracle_predictions_type ON oracle_predictions(prediction_type);
CREATE INDEX idx_oracle_predictions_subject ON oracle_predictions(subject_type, subject_id);
CREATE INDEX idx_oracle_predictions_resolved ON oracle_predictions(is_resolved);
CREATE INDEX idx_oracle_predictions_created_at ON oracle_predictions(created_at);
CREATE INDEX idx_oracle_outcomes_prediction_id ON oracle_outcomes(prediction_id);
CREATE INDEX idx_oracle_outcomes_user_id ON oracle_outcomes(user_id);
CREATE INDEX idx_oracle_calibration_user_id ON oracle_calibration(user_id);
CREATE INDEX idx_oracle_calibration_type ON oracle_calibration(calibration_type);
CREATE INDEX idx_oracle_user_patterns_user_id ON oracle_user_patterns(user_id);
CREATE INDEX idx_oracle_user_patterns_type ON oracle_user_patterns(pattern_type);

-- RLS for PROBABILITY ENGINE module
ALTER TABLE oracle_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_calibration ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_user_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Predictions belong to user" ON oracle_predictions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Outcomes belong to user" ON oracle_outcomes FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Calibration belongs to user" ON oracle_calibration FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "User patterns belong to user" ON oracle_user_patterns FOR ALL USING (auth.uid() = user_id);

-- Triggers for updated_at
CREATE TRIGGER update_oracle_predictions_updated_at
  BEFORE UPDATE ON oracle_predictions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_oracle_calibration_updated_at
  BEFORE UPDATE ON oracle_calibration
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_oracle_user_patterns_updated_at
  BEFORE UPDATE ON oracle_user_patterns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ENVIRONMENT AWARENESS TABLES
-- ============================================================================

-- Environment snapshots (device state, location, time context)
CREATE TABLE oracle_environment_snapshots (
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
CREATE TABLE oracle_context_nodes (
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
CREATE TABLE oracle_context_edges (
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
CREATE TABLE oracle_ghost_actions (
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

-- Indexes for ENVIRONMENT AWARENESS module
CREATE INDEX idx_oracle_environment_snapshots_user_id ON oracle_environment_snapshots(user_id);
CREATE INDEX idx_oracle_environment_snapshots_created_at ON oracle_environment_snapshots(created_at);
CREATE INDEX idx_oracle_environment_snapshots_type ON oracle_environment_snapshots(snapshot_type);
CREATE INDEX idx_oracle_context_nodes_user_id ON oracle_context_nodes(user_id);
CREATE INDEX idx_oracle_context_nodes_type ON oracle_context_nodes(node_type);
CREATE INDEX idx_oracle_context_nodes_is_active ON oracle_context_nodes(is_active);
CREATE INDEX idx_oracle_context_edges_user_id ON oracle_context_edges(user_id);
CREATE INDEX idx_oracle_context_edges_source ON oracle_context_edges(source_node_id);
CREATE INDEX idx_oracle_context_edges_target ON oracle_context_edges(target_node_id);
CREATE INDEX idx_oracle_context_edges_type ON oracle_context_edges(edge_type);
CREATE INDEX idx_oracle_ghost_actions_user_id ON oracle_ghost_actions(user_id);
CREATE INDEX idx_oracle_ghost_actions_status ON oracle_ghost_actions(status);
CREATE INDEX idx_oracle_ghost_actions_created_at ON oracle_ghost_actions(created_at);

-- RLS for ENVIRONMENT AWARENESS module
ALTER TABLE oracle_environment_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_context_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_context_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_ghost_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Environment snapshots belong to user" ON oracle_environment_snapshots FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Context nodes belong to user" ON oracle_context_nodes FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Context edges belong to user" ON oracle_context_edges FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Ghost actions belong to user" ON oracle_ghost_actions FOR ALL USING (auth.uid() = user_id);

-- Triggers for updated_at
CREATE TRIGGER update_oracle_context_nodes_updated_at
  BEFORE UPDATE ON oracle_context_nodes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_oracle_context_edges_updated_at
  BEFORE UPDATE ON oracle_context_edges
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_oracle_ghost_actions_updated_at
  BEFORE UPDATE ON oracle_ghost_actions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ORACLE ANALYTICS TABLES (Phase 3)
-- ============================================================================

-- Analytics events - track all ORACLE interactions
CREATE TABLE oracle_analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'observe_scan', 'observe_signal_detected', 'observe_signal_dismissed',
    'orient_context_created', 'orient_assessment_generated', 'orient_correlation_found',
    'decide_decision_created', 'decide_option_added', 'decide_simulation_run', 'decide_decision_made',
    'act_plan_created', 'act_step_completed', 'act_plan_completed', 'act_learning_captured',
    'prediction_made', 'prediction_resolved', 'ghost_action_approved', 'ghost_action_rejected',
    'ui_interaction', 'api_call', 'error', 'custom'
  )),
  event_category TEXT NOT NULL CHECK (event_category IN ('observe', 'orient', 'decide', 'act', 'prediction', 'system', 'user')),
  payload JSONB DEFAULT '{}',
  entity_type TEXT,
  entity_id UUID,
  session_id TEXT,
  device_id UUID,
  ip_address TEXT,
  user_agent TEXT,
  duration_ms INTEGER,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Prediction accuracy - historical accuracy by category
CREATE TABLE oracle_prediction_accuracy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  prediction_id UUID REFERENCES oracle_predictions(id) ON DELETE SET NULL,
  category TEXT NOT NULL CHECK (category IN ('task_completion', 'deadline_risk', 'resource_availability', 'outcome_likelihood', 'duration_estimate', 'custom')),
  predicted_value DECIMAL(10,4),
  actual_value DECIMAL(10,4),
  delta DECIMAL(10,4),
  absolute_error DECIMAL(10,4),
  percentage_error DECIMAL(10,4),
  confidence_at_prediction DECIMAL(3,2) CHECK (confidence_at_prediction >= 0 AND confidence_at_prediction <= 1),
  time_horizon_hours INTEGER,
  factors_snapshot JSONB DEFAULT '{}',
  is_accurate BOOLEAN,
  accuracy_threshold DECIMAL(10,4) DEFAULT 0.1,
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User engagement - session metrics, feature usage
CREATE TABLE oracle_user_engagement (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  session_start TIMESTAMPTZ NOT NULL,
  session_end TIMESTAMPTZ,
  session_duration_seconds INTEGER,
  device_id UUID,
  platform TEXT,
  app_version TEXT,

  -- Feature usage counts
  observe_scans INTEGER DEFAULT 0,
  signals_viewed INTEGER DEFAULT 0,
  signals_acknowledged INTEGER DEFAULT 0,
  contexts_generated INTEGER DEFAULT 0,
  decisions_created INTEGER DEFAULT 0,
  decisions_completed INTEGER DEFAULT 0,
  simulations_run INTEGER DEFAULT 0,
  plans_created INTEGER DEFAULT 0,
  steps_completed INTEGER DEFAULT 0,
  predictions_viewed INTEGER DEFAULT 0,
  ghost_actions_reviewed INTEGER DEFAULT 0,

  -- Engagement metrics
  active_time_seconds INTEGER DEFAULT 0,
  screens_visited JSONB DEFAULT '[]',
  actions_taken INTEGER DEFAULT 0,
  api_calls_made INTEGER DEFAULT 0,
  errors_encountered INTEGER DEFAULT 0,

  -- Completion metrics
  tasks_completed INTEGER DEFAULT 0,
  decisions_finalized INTEGER DEFAULT 0,
  plans_executed INTEGER DEFAULT 0,

  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- System health - API response times, error rates
CREATE TABLE oracle_system_health (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_type TEXT NOT NULL CHECK (metric_type IN ('api_latency', 'error_rate', 'throughput', 'availability', 'queue_depth', 'memory_usage', 'cpu_usage', 'db_latency', 'ai_latency', 'custom')),
  endpoint TEXT,
  service TEXT DEFAULT 'oracle',

  -- Latency metrics (in milliseconds)
  latency_p50 DECIMAL(10,2),
  latency_p90 DECIMAL(10,2),
  latency_p95 DECIMAL(10,2),
  latency_p99 DECIMAL(10,2),
  latency_avg DECIMAL(10,2),
  latency_max DECIMAL(10,2),
  latency_min DECIMAL(10,2),

  -- Count metrics
  request_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  timeout_count INTEGER DEFAULT 0,
  rate_limit_count INTEGER DEFAULT 0,

  -- Rate metrics
  error_rate DECIMAL(5,4) CHECK (error_rate >= 0 AND error_rate <= 1),
  success_rate DECIMAL(5,4) CHECK (success_rate >= 0 AND success_rate <= 1),
  requests_per_second DECIMAL(10,4),

  -- Resource metrics
  memory_mb DECIMAL(10,2),
  cpu_percent DECIMAL(5,2),

  -- Time bucket
  bucket_start TIMESTAMPTZ NOT NULL,
  bucket_end TIMESTAMPTZ NOT NULL,
  bucket_duration_seconds INTEGER DEFAULT 60,

  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for ANALYTICS module (optimized for time-series queries)
CREATE INDEX idx_oracle_analytics_events_user_id ON oracle_analytics_events(user_id);
CREATE INDEX idx_oracle_analytics_events_type ON oracle_analytics_events(event_type);
CREATE INDEX idx_oracle_analytics_events_category ON oracle_analytics_events(event_category);
CREATE INDEX idx_oracle_analytics_events_created_at ON oracle_analytics_events(created_at);
CREATE INDEX idx_oracle_analytics_events_session ON oracle_analytics_events(session_id);
CREATE INDEX idx_oracle_analytics_events_entity ON oracle_analytics_events(entity_type, entity_id);
-- Composite index for time-series queries by user and time
CREATE INDEX idx_oracle_analytics_events_user_time ON oracle_analytics_events(user_id, created_at DESC);
-- Composite index for category analytics
CREATE INDEX idx_oracle_analytics_events_user_category_time ON oracle_analytics_events(user_id, event_category, created_at DESC);

CREATE INDEX idx_oracle_prediction_accuracy_user_id ON oracle_prediction_accuracy(user_id);
CREATE INDEX idx_oracle_prediction_accuracy_category ON oracle_prediction_accuracy(category);
CREATE INDEX idx_oracle_prediction_accuracy_created_at ON oracle_prediction_accuracy(created_at);
CREATE INDEX idx_oracle_prediction_accuracy_prediction_id ON oracle_prediction_accuracy(prediction_id);
-- Composite index for accuracy trends by category
CREATE INDEX idx_oracle_prediction_accuracy_user_category_time ON oracle_prediction_accuracy(user_id, category, created_at DESC);
-- Index for filtering accurate/inaccurate predictions
CREATE INDEX idx_oracle_prediction_accuracy_is_accurate ON oracle_prediction_accuracy(user_id, is_accurate, created_at DESC);

CREATE INDEX idx_oracle_user_engagement_user_id ON oracle_user_engagement(user_id);
CREATE INDEX idx_oracle_user_engagement_session_id ON oracle_user_engagement(session_id);
CREATE INDEX idx_oracle_user_engagement_session_start ON oracle_user_engagement(session_start);
-- Composite index for engagement trends
CREATE INDEX idx_oracle_user_engagement_user_time ON oracle_user_engagement(user_id, session_start DESC);
-- Index for platform analytics
CREATE INDEX idx_oracle_user_engagement_platform ON oracle_user_engagement(platform, session_start DESC);

CREATE INDEX idx_oracle_system_health_metric_type ON oracle_system_health(metric_type);
CREATE INDEX idx_oracle_system_health_endpoint ON oracle_system_health(endpoint);
CREATE INDEX idx_oracle_system_health_bucket_start ON oracle_system_health(bucket_start);
-- Composite index for health metrics by endpoint and time
CREATE INDEX idx_oracle_system_health_endpoint_time ON oracle_system_health(endpoint, bucket_start DESC);
-- Composite index for service-wide metrics
CREATE INDEX idx_oracle_system_health_service_type_time ON oracle_system_health(service, metric_type, bucket_start DESC);

-- RLS for ANALYTICS module
ALTER TABLE oracle_analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_prediction_accuracy ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_user_engagement ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_system_health ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Analytics events belong to user" ON oracle_analytics_events FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Prediction accuracy belongs to user" ON oracle_prediction_accuracy FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "User engagement belongs to user" ON oracle_user_engagement FOR ALL USING (auth.uid() = user_id);
-- System health is readable by all authenticated users (aggregate data)
CREATE POLICY "System health readable by authenticated users" ON oracle_system_health FOR SELECT USING (auth.uid() IS NOT NULL);

-- Triggers for updated_at
CREATE TRIGGER update_oracle_user_engagement_updated_at
  BEFORE UPDATE ON oracle_user_engagement
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ORACLE WEBHOOK SYSTEM TABLES (Phase 3)
-- ============================================================================

-- Webhook configurations
CREATE TABLE oracle_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  url TEXT NOT NULL,
  secret TEXT NOT NULL,
  events JSONB NOT NULL DEFAULT '[]',
  headers JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  retry_count INTEGER DEFAULT 3,
  retry_delay_seconds INTEGER DEFAULT 60,
  timeout_seconds INTEGER DEFAULT 30,
  last_triggered_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  last_failure_at TIMESTAMPTZ,
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Webhook delivery tracking
CREATE TABLE oracle_webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID REFERENCES oracle_webhooks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_id UUID,
  payload JSONB NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'sending', 'success', 'failed', 'retrying', 'abandoned')),

  -- Response details
  response_status_code INTEGER,
  response_body TEXT,
  response_headers JSONB,
  response_time_ms INTEGER,

  -- Retry tracking
  attempt_number INTEGER DEFAULT 1,
  max_attempts INTEGER DEFAULT 3,
  next_retry_at TIMESTAMPTZ,
  last_error TEXT,

  -- Signature verification
  signature TEXT,
  signature_algorithm TEXT DEFAULT 'sha256',

  -- Timestamps
  sent_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Webhook event types
CREATE TABLE oracle_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT UNIQUE NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('observe', 'orient', 'decide', 'act', 'prediction', 'system')),
  description TEXT,
  payload_schema JSONB,
  is_system BOOLEAN DEFAULT TRUE,
  is_active BOOLEAN DEFAULT TRUE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default webhook event types
INSERT INTO oracle_webhook_events (event_type, category, description, payload_schema) VALUES
  ('signal.detected', 'observe', 'A new signal was detected by the radar', '{"type": "object", "properties": {"signal_id": {"type": "string"}, "signal_type": {"type": "string"}, "urgency": {"type": "string"}, "impact": {"type": "string"}}}'),
  ('signal.critical', 'observe', 'A critical urgency signal was detected', '{"type": "object", "properties": {"signal_id": {"type": "string"}, "title": {"type": "string"}}}'),
  ('context.generated', 'orient', 'A new strategic context was generated', '{"type": "object", "properties": {"context_id": {"type": "string"}, "situation_summary": {"type": "string"}}}'),
  ('decision.created', 'decide', 'A new decision was created', '{"type": "object", "properties": {"decision_id": {"type": "string"}, "title": {"type": "string"}}}'),
  ('decision.made', 'decide', 'A decision was finalized', '{"type": "object", "properties": {"decision_id": {"type": "string"}, "selected_option_id": {"type": "string"}}}'),
  ('plan.started', 'act', 'An execution plan was started', '{"type": "object", "properties": {"plan_id": {"type": "string"}, "title": {"type": "string"}}}'),
  ('plan.completed', 'act', 'An execution plan was completed', '{"type": "object", "properties": {"plan_id": {"type": "string"}, "outcome": {"type": "string"}}}'),
  ('step.completed', 'act', 'An execution step was completed', '{"type": "object", "properties": {"plan_id": {"type": "string"}, "step_id": {"type": "string"}}}'),
  ('prediction.resolved', 'prediction', 'A prediction was resolved with actual outcome', '{"type": "object", "properties": {"prediction_id": {"type": "string"}, "accuracy": {"type": "number"}}}'),
  ('ghost_action.ready', 'system', 'A ghost action is ready for approval', '{"type": "object", "properties": {"action_id": {"type": "string"}, "action_type": {"type": "string"}}}'),
  ('system.error', 'system', 'A system error occurred', '{"type": "object", "properties": {"error_code": {"type": "string"}, "message": {"type": "string"}}}')
ON CONFLICT (event_type) DO NOTHING;

-- Indexes for WEBHOOK module
CREATE INDEX idx_oracle_webhooks_user_id ON oracle_webhooks(user_id);
CREATE INDEX idx_oracle_webhooks_is_active ON oracle_webhooks(is_active);
CREATE INDEX idx_oracle_webhooks_last_triggered ON oracle_webhooks(last_triggered_at);

CREATE INDEX idx_oracle_webhook_deliveries_webhook_id ON oracle_webhook_deliveries(webhook_id);
CREATE INDEX idx_oracle_webhook_deliveries_user_id ON oracle_webhook_deliveries(user_id);
CREATE INDEX idx_oracle_webhook_deliveries_status ON oracle_webhook_deliveries(status);
CREATE INDEX idx_oracle_webhook_deliveries_event_type ON oracle_webhook_deliveries(event_type);
CREATE INDEX idx_oracle_webhook_deliveries_created_at ON oracle_webhook_deliveries(created_at);
-- Composite index for retry queries
CREATE INDEX idx_oracle_webhook_deliveries_retry ON oracle_webhook_deliveries(status, next_retry_at) WHERE status = 'retrying';
-- Composite index for delivery history by webhook
CREATE INDEX idx_oracle_webhook_deliveries_webhook_time ON oracle_webhook_deliveries(webhook_id, created_at DESC);

CREATE INDEX idx_oracle_webhook_events_category ON oracle_webhook_events(category);
CREATE INDEX idx_oracle_webhook_events_is_active ON oracle_webhook_events(is_active);

-- RLS for WEBHOOK module
ALTER TABLE oracle_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_webhook_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Webhooks belong to user" ON oracle_webhooks FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Webhook deliveries belong to user" ON oracle_webhook_deliveries FOR ALL USING (auth.uid() = user_id);
-- Webhook events are readable by all authenticated users (system configuration)
CREATE POLICY "Webhook events readable by authenticated users" ON oracle_webhook_events FOR SELECT USING (auth.uid() IS NOT NULL);

-- Triggers for updated_at
CREATE TRIGGER update_oracle_webhooks_updated_at
  BEFORE UPDATE ON oracle_webhooks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ORACLE PATTERN LEARNING TABLES (Phase 3)
-- ============================================================================

-- Learned behavioral patterns
CREATE TABLE oracle_learned_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  pattern_type TEXT NOT NULL CHECK (pattern_type IN ('temporal', 'sequential', 'contextual', 'behavioral', 'correlation', 'preference', 'routine', 'custom')),
  name TEXT NOT NULL,
  description TEXT,

  -- Pattern definition
  pattern_signature JSONB NOT NULL DEFAULT '{}',
  trigger_conditions JSONB DEFAULT '{}',
  typical_context JSONB DEFAULT '{}',

  -- Temporal patterns
  time_of_day_distribution JSONB DEFAULT '{}',
  day_of_week_distribution JSONB DEFAULT '{}',
  recurrence_pattern TEXT,

  -- Statistical measures
  confidence DECIMAL(3,2) DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  support_count INTEGER DEFAULT 0,
  occurrence_rate DECIMAL(5,4),
  consistency_score DECIMAL(3,2) CHECK (consistency_score >= 0 AND consistency_score <= 1),

  -- Learning state
  is_active BOOLEAN DEFAULT TRUE,
  is_validated BOOLEAN DEFAULT FALSE,
  last_observed_at TIMESTAMPTZ,
  first_observed_at TIMESTAMPTZ,
  observation_count INTEGER DEFAULT 0,

  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pattern instances (occurrences)
CREATE TABLE oracle_pattern_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_id UUID REFERENCES oracle_learned_patterns(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,

  -- Instance details
  occurred_at TIMESTAMPTZ NOT NULL,
  context JSONB DEFAULT '{}',
  trigger_data JSONB DEFAULT '{}',
  outcome_data JSONB DEFAULT '{}',

  -- Match quality
  match_confidence DECIMAL(3,2) CHECK (match_confidence >= 0 AND match_confidence <= 1),
  deviation_from_pattern DECIMAL(5,2),

  -- Related entities
  related_signals JSONB DEFAULT '[]',
  related_decisions JSONB DEFAULT '[]',
  related_actions JSONB DEFAULT '[]',

  -- Temporal context
  time_of_day TIME,
  day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6),
  week_of_year INTEGER CHECK (week_of_year >= 1 AND week_of_year <= 53),

  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User feedback on patterns
CREATE TABLE oracle_pattern_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_id UUID REFERENCES oracle_learned_patterns(id) ON DELETE CASCADE,
  instance_id UUID REFERENCES oracle_pattern_instances(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,

  -- Feedback type and content
  feedback_type TEXT NOT NULL CHECK (feedback_type IN ('confirm', 'reject', 'modify', 'ignore', 'useful', 'not_useful', 'timing', 'accuracy')),
  sentiment TEXT CHECK (sentiment IN ('positive', 'negative', 'neutral')),
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,

  -- For modifications
  suggested_changes JSONB DEFAULT '{}',

  -- Context when feedback was given
  context_at_feedback JSONB DEFAULT '{}',

  -- Impact on learning
  was_applied BOOLEAN DEFAULT FALSE,
  impact_on_confidence DECIMAL(4,3),

  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Model versions for tracking improvements
CREATE TABLE oracle_model_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  model_type TEXT NOT NULL CHECK (model_type IN ('pattern_detector', 'confidence_calibrator', 'scheduler', 'recommender', 'predictor')),
  version_number INTEGER NOT NULL,
  version_tag TEXT,

  -- Model state
  model_parameters JSONB DEFAULT '{}',
  training_data_summary JSONB DEFAULT '{}',

  -- Performance metrics
  accuracy_score DECIMAL(5,4) CHECK (accuracy_score >= 0 AND accuracy_score <= 1),
  precision_score DECIMAL(5,4) CHECK (precision_score >= 0 AND precision_score <= 1),
  recall_score DECIMAL(5,4) CHECK (recall_score >= 0 AND recall_score <= 1),
  f1_score DECIMAL(5,4) CHECK (f1_score >= 0 AND f1_score <= 1),

  -- Training details
  training_samples INTEGER DEFAULT 0,
  validation_samples INTEGER DEFAULT 0,
  training_started_at TIMESTAMPTZ,
  training_completed_at TIMESTAMPTZ,

  -- Deployment
  is_active BOOLEAN DEFAULT FALSE,
  deployed_at TIMESTAMPTZ,
  deprecated_at TIMESTAMPTZ,
  deprecation_reason TEXT,

  -- Comparison to previous
  improvement_from_previous DECIMAL(5,4),
  previous_version_id UUID REFERENCES oracle_model_versions(id),

  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for PATTERN LEARNING module
CREATE INDEX idx_oracle_learned_patterns_user_id ON oracle_learned_patterns(user_id);
CREATE INDEX idx_oracle_learned_patterns_type ON oracle_learned_patterns(pattern_type);
CREATE INDEX idx_oracle_learned_patterns_is_active ON oracle_learned_patterns(is_active);
CREATE INDEX idx_oracle_learned_patterns_confidence ON oracle_learned_patterns(confidence);
CREATE INDEX idx_oracle_learned_patterns_last_observed ON oracle_learned_patterns(last_observed_at);

CREATE INDEX idx_oracle_pattern_instances_pattern_id ON oracle_pattern_instances(pattern_id);
CREATE INDEX idx_oracle_pattern_instances_user_id ON oracle_pattern_instances(user_id);
CREATE INDEX idx_oracle_pattern_instances_occurred_at ON oracle_pattern_instances(occurred_at);
CREATE INDEX idx_oracle_pattern_instances_time_of_day ON oracle_pattern_instances(time_of_day);
CREATE INDEX idx_oracle_pattern_instances_day_of_week ON oracle_pattern_instances(day_of_week);
-- Composite index for temporal queries
CREATE INDEX idx_oracle_pattern_instances_user_time ON oracle_pattern_instances(user_id, occurred_at DESC);

CREATE INDEX idx_oracle_pattern_feedback_pattern_id ON oracle_pattern_feedback(pattern_id);
CREATE INDEX idx_oracle_pattern_feedback_user_id ON oracle_pattern_feedback(user_id);
CREATE INDEX idx_oracle_pattern_feedback_type ON oracle_pattern_feedback(feedback_type);
CREATE INDEX idx_oracle_pattern_feedback_created_at ON oracle_pattern_feedback(created_at);

CREATE INDEX idx_oracle_model_versions_user_id ON oracle_model_versions(user_id);
CREATE INDEX idx_oracle_model_versions_type ON oracle_model_versions(model_type);
CREATE INDEX idx_oracle_model_versions_is_active ON oracle_model_versions(is_active);
-- Composite index for finding active model
CREATE INDEX idx_oracle_model_versions_user_type_active ON oracle_model_versions(user_id, model_type, is_active) WHERE is_active = TRUE;

-- RLS for PATTERN LEARNING module
ALTER TABLE oracle_learned_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_pattern_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_pattern_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_model_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Learned patterns belong to user" ON oracle_learned_patterns FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Pattern instances belong to user" ON oracle_pattern_instances FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Pattern feedback belongs to user" ON oracle_pattern_feedback FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Model versions belong to user" ON oracle_model_versions FOR ALL USING (auth.uid() = user_id);

-- Triggers for updated_at
CREATE TRIGGER update_oracle_learned_patterns_updated_at
  BEFORE UPDATE ON oracle_learned_patterns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_oracle_model_versions_updated_at
  BEFORE UPDATE ON oracle_model_versions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- ORACLE DECISION JOURNAL TABLES
-- Track and review past decisions with reflections
-- =====================================================

-- Main decision journal entries table
CREATE TABLE oracle_decision_journal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  decision_id UUID REFERENCES oracle_decisions(id) ON DELETE SET NULL,

  -- Journal entry content
  title TEXT NOT NULL,
  situation TEXT NOT NULL, -- What was the context/situation
  options_considered TEXT[], -- Options that were evaluated
  chosen_option TEXT, -- What was ultimately chosen
  reasoning TEXT, -- Why this option was chosen

  -- Outcome tracking
  outcome_status TEXT CHECK (outcome_status IN ('pending', 'success', 'partial', 'failure', 'cancelled', 'unknown')) DEFAULT 'pending',
  outcome_description TEXT, -- What actually happened
  outcome_date TIMESTAMPTZ, -- When the outcome was determined

  -- Reflection and learning
  reflection TEXT, -- User's reflection on the decision
  lessons_learned TEXT[], -- Key takeaways
  would_decide_differently BOOLEAN, -- Hindsight indicator
  alternative_considered TEXT, -- What they would do differently

  -- Categorization and organization
  tags TEXT[] DEFAULT '{}',
  category TEXT CHECK (category IN ('career', 'financial', 'health', 'relationship', 'project', 'personal', 'business', 'technical', 'other')) DEFAULT 'other',
  importance TEXT CHECK (importance IN ('trivial', 'minor', 'moderate', 'major', 'critical')) DEFAULT 'moderate',

  -- Emotional context
  emotional_state_before TEXT, -- How they felt before deciding
  emotional_state_after TEXT, -- How they felt after
  stress_level INTEGER CHECK (stress_level >= 1 AND stress_level <= 10), -- 1-10 scale
  confidence_in_decision DECIMAL(3,2) CHECK (confidence_in_decision >= 0 AND confidence_in_decision <= 1),

  -- Time tracking
  decision_date TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- When decision was made
  time_pressure TEXT CHECK (time_pressure IN ('none', 'low', 'moderate', 'high', 'urgent')),
  deliberation_time_hours DECIMAL(6,2), -- How long they deliberated

  -- Stakeholders
  stakeholders_involved TEXT[], -- Who was involved
  stakeholders_affected TEXT[], -- Who was affected

  -- Metadata
  metadata JSONB DEFAULT '{}',
  is_private BOOLEAN DEFAULT true, -- Privacy flag
  is_favorite BOOLEAN DEFAULT false, -- Starred for quick access

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Decision journal attachments (for supporting documents, screenshots, etc.)
CREATE TABLE oracle_journal_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_id UUID REFERENCES oracle_decision_journal(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,

  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL, -- image, document, link, note
  file_path TEXT, -- Storage path or URL
  description TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Decision journal follow-ups (reminders to review outcomes)
CREATE TABLE oracle_journal_followups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_id UUID REFERENCES oracle_decision_journal(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,

  followup_type TEXT CHECK (followup_type IN ('review_outcome', 'check_progress', 'reassess', 'celebrate', 'learn')) DEFAULT 'review_outcome',
  scheduled_date TIMESTAMPTZ NOT NULL,
  completed_date TIMESTAMPTZ,
  notes TEXT,

  is_completed BOOLEAN DEFAULT false,
  is_dismissed BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for decision journal
CREATE INDEX idx_oracle_decision_journal_user_id ON oracle_decision_journal(user_id);
CREATE INDEX idx_oracle_decision_journal_decision_id ON oracle_decision_journal(decision_id);
CREATE INDEX idx_oracle_decision_journal_decision_date ON oracle_decision_journal(decision_date DESC);
CREATE INDEX idx_oracle_decision_journal_category ON oracle_decision_journal(category);
CREATE INDEX idx_oracle_decision_journal_outcome_status ON oracle_decision_journal(outcome_status);
CREATE INDEX idx_oracle_decision_journal_tags ON oracle_decision_journal USING GIN(tags);
CREATE INDEX idx_oracle_decision_journal_is_favorite ON oracle_decision_journal(is_favorite) WHERE is_favorite = true;
-- Composite index for user timeline queries
CREATE INDEX idx_oracle_decision_journal_user_date ON oracle_decision_journal(user_id, decision_date DESC);

CREATE INDEX idx_oracle_journal_attachments_journal_id ON oracle_journal_attachments(journal_id);
CREATE INDEX idx_oracle_journal_attachments_user_id ON oracle_journal_attachments(user_id);

CREATE INDEX idx_oracle_journal_followups_journal_id ON oracle_journal_followups(journal_id);
CREATE INDEX idx_oracle_journal_followups_user_id ON oracle_journal_followups(user_id);
CREATE INDEX idx_oracle_journal_followups_scheduled ON oracle_journal_followups(scheduled_date) WHERE is_completed = false AND is_dismissed = false;

-- RLS for decision journal tables
ALTER TABLE oracle_decision_journal ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_journal_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_journal_followups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Decision journal belongs to user" ON oracle_decision_journal FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Journal attachments belong to user" ON oracle_journal_attachments FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Journal followups belong to user" ON oracle_journal_followups FOR ALL USING (auth.uid() = user_id);

-- Triggers for updated_at
CREATE TRIGGER update_oracle_decision_journal_updated_at
  BEFORE UPDATE ON oracle_decision_journal
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- ORACLE COLLABORATIVE DECISIONS TABLES
-- Multi-user decision support for teams
-- =====================================================

-- Decision collaborators table
CREATE TABLE oracle_decision_collaborators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id UUID REFERENCES oracle_decisions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,

  -- Collaborator details
  role TEXT CHECK (role IN ('owner', 'editor', 'voter', 'viewer')) DEFAULT 'voter',
  invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
  invited_email TEXT, -- For inviting users not yet in system

  -- Status tracking
  status TEXT CHECK (status IN ('pending', 'accepted', 'declined', 'removed')) DEFAULT 'pending',
  joined_at TIMESTAMPTZ, -- When they accepted invitation
  last_viewed_at TIMESTAMPTZ, -- Last time they viewed the decision

  -- Notifications
  notify_on_vote BOOLEAN DEFAULT true,
  notify_on_comment BOOLEAN DEFAULT true,
  notify_on_update BOOLEAN DEFAULT true,

  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure unique collaborator per decision
  UNIQUE(decision_id, user_id)
);

-- Decision votes table
CREATE TABLE oracle_decision_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id UUID REFERENCES oracle_decisions(id) ON DELETE CASCADE,
  option_id UUID REFERENCES oracle_decision_options(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,

  -- Vote details
  vote_type TEXT CHECK (vote_type IN ('approve', 'reject', 'abstain', 'preference')) DEFAULT 'approve',
  preference_rank INTEGER, -- For ranked choice voting (1 = top preference)
  weight DECIMAL(3,2) DEFAULT 1.0 CHECK (weight >= 0 AND weight <= 2), -- Weighted voting

  -- Rationale
  rationale TEXT, -- Why they voted this way
  confidence DECIMAL(3,2) CHECK (confidence >= 0 AND confidence <= 1), -- How confident in vote

  -- Vote status
  is_final BOOLEAN DEFAULT false, -- Can change vote until final
  finalized_at TIMESTAMPTZ,

  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure one vote per user per option (can have multiple options with preference_rank)
  UNIQUE(decision_id, option_id, user_id)
);

-- Decision comments table
CREATE TABLE oracle_decision_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id UUID REFERENCES oracle_decisions(id) ON DELETE CASCADE,
  option_id UUID REFERENCES oracle_decision_options(id) ON DELETE SET NULL, -- Can be option-specific or general
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES oracle_decision_comments(id) ON DELETE CASCADE, -- For threaded replies

  -- Comment content
  content TEXT NOT NULL,
  content_type TEXT CHECK (content_type IN ('text', 'markdown', 'rich')) DEFAULT 'text',

  -- Mentions and reactions
  mentions UUID[] DEFAULT '{}', -- Array of mentioned user IDs
  reactions JSONB DEFAULT '{}', -- { "emoji": [user_ids] }

  -- Status
  is_edited BOOLEAN DEFAULT false,
  edited_at TIMESTAMPTZ,
  is_deleted BOOLEAN DEFAULT false, -- Soft delete for thread preservation
  deleted_at TIMESTAMPTZ,

  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Decision share links table
CREATE TABLE oracle_decision_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id UUID REFERENCES oracle_decisions(id) ON DELETE CASCADE,
  created_by UUID REFERENCES users(id) ON DELETE CASCADE,

  -- Share link details
  share_token TEXT UNIQUE NOT NULL, -- Random token for URL
  share_type TEXT CHECK (share_type IN ('view', 'vote', 'comment', 'full')) DEFAULT 'view',

  -- Access control
  requires_auth BOOLEAN DEFAULT false, -- Whether link requires login
  allowed_domains TEXT[], -- Restrict to specific email domains
  max_uses INTEGER, -- Maximum number of uses
  use_count INTEGER DEFAULT 0, -- Current use count

  -- Expiration
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,

  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vote aggregation view (materialized for performance)
CREATE TABLE oracle_vote_aggregation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id UUID REFERENCES oracle_decisions(id) ON DELETE CASCADE,
  option_id UUID REFERENCES oracle_decision_options(id) ON DELETE CASCADE,

  -- Aggregate counts
  total_votes INTEGER DEFAULT 0,
  approve_count INTEGER DEFAULT 0,
  reject_count INTEGER DEFAULT 0,
  abstain_count INTEGER DEFAULT 0,

  -- Weighted totals
  weighted_approve DECIMAL(10,2) DEFAULT 0,
  weighted_reject DECIMAL(10,2) DEFAULT 0,
  net_score DECIMAL(10,2) DEFAULT 0, -- weighted_approve - weighted_reject

  -- Statistics
  avg_confidence DECIMAL(3,2),
  avg_preference_rank DECIMAL(5,2),

  -- Timestamps
  last_calculated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(decision_id, option_id)
);

-- Indexes for collaborative decisions
CREATE INDEX idx_oracle_decision_collaborators_decision_id ON oracle_decision_collaborators(decision_id);
CREATE INDEX idx_oracle_decision_collaborators_user_id ON oracle_decision_collaborators(user_id);
CREATE INDEX idx_oracle_decision_collaborators_status ON oracle_decision_collaborators(status);
-- Composite index for finding pending invitations
CREATE INDEX idx_oracle_decision_collaborators_pending ON oracle_decision_collaborators(user_id, status) WHERE status = 'pending';

CREATE INDEX idx_oracle_decision_votes_decision_id ON oracle_decision_votes(decision_id);
CREATE INDEX idx_oracle_decision_votes_option_id ON oracle_decision_votes(option_id);
CREATE INDEX idx_oracle_decision_votes_user_id ON oracle_decision_votes(user_id);
-- Composite index for vote counting
CREATE INDEX idx_oracle_decision_votes_count ON oracle_decision_votes(decision_id, option_id, vote_type);

CREATE INDEX idx_oracle_decision_comments_decision_id ON oracle_decision_comments(decision_id);
CREATE INDEX idx_oracle_decision_comments_option_id ON oracle_decision_comments(option_id);
CREATE INDEX idx_oracle_decision_comments_user_id ON oracle_decision_comments(user_id);
CREATE INDEX idx_oracle_decision_comments_parent_id ON oracle_decision_comments(parent_id);
-- Composite index for threaded comments
CREATE INDEX idx_oracle_decision_comments_thread ON oracle_decision_comments(decision_id, option_id, created_at) WHERE is_deleted = false;

CREATE INDEX idx_oracle_decision_shares_decision_id ON oracle_decision_shares(decision_id);
CREATE INDEX idx_oracle_decision_shares_token ON oracle_decision_shares(share_token) WHERE is_active = true;
CREATE INDEX idx_oracle_decision_shares_created_by ON oracle_decision_shares(created_by);

CREATE INDEX idx_oracle_vote_aggregation_decision_id ON oracle_vote_aggregation(decision_id);
CREATE INDEX idx_oracle_vote_aggregation_option_id ON oracle_vote_aggregation(option_id);

-- RLS for collaborative decisions tables
ALTER TABLE oracle_decision_collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_decision_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_decision_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_decision_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_vote_aggregation ENABLE ROW LEVEL SECURITY;

-- Collaborators policy: can see if you're a collaborator or the decision owner
CREATE POLICY "Collaborators visible to participants" ON oracle_decision_collaborators
  FOR SELECT USING (
    auth.uid() = user_id OR
    auth.uid() IN (SELECT user_id FROM oracle_decision_collaborators WHERE decision_id = oracle_decision_collaborators.decision_id)
  );

CREATE POLICY "Decision owners can manage collaborators" ON oracle_decision_collaborators
  FOR ALL USING (
    auth.uid() IN (SELECT user_id FROM oracle_decision_collaborators WHERE decision_id = oracle_decision_collaborators.decision_id AND role = 'owner')
  );

-- Votes policy: can see votes if you're a participant
CREATE POLICY "Votes visible to participants" ON oracle_decision_votes
  FOR SELECT USING (
    auth.uid() IN (SELECT user_id FROM oracle_decision_collaborators WHERE decision_id = oracle_decision_votes.decision_id)
  );

CREATE POLICY "Users can manage own votes" ON oracle_decision_votes
  FOR ALL USING (auth.uid() = user_id);

-- Comments policy: can see comments if you're a participant
CREATE POLICY "Comments visible to participants" ON oracle_decision_comments
  FOR SELECT USING (
    auth.uid() IN (SELECT user_id FROM oracle_decision_collaborators WHERE decision_id = oracle_decision_comments.decision_id)
  );

CREATE POLICY "Users can manage own comments" ON oracle_decision_comments
  FOR ALL USING (auth.uid() = user_id);

-- Shares policy: owner can manage shares
CREATE POLICY "Share links managed by creator" ON oracle_decision_shares
  FOR ALL USING (auth.uid() = created_by);

-- Aggregation policy: visible to participants
CREATE POLICY "Vote aggregation visible to participants" ON oracle_vote_aggregation
  FOR SELECT USING (
    auth.uid() IN (SELECT user_id FROM oracle_decision_collaborators WHERE decision_id = oracle_vote_aggregation.decision_id)
  );

-- Triggers for updated_at
CREATE TRIGGER update_oracle_decision_collaborators_updated_at
  BEFORE UPDATE ON oracle_decision_collaborators
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_oracle_decision_votes_updated_at
  BEFORE UPDATE ON oracle_decision_votes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_oracle_decision_comments_updated_at
  BEFORE UPDATE ON oracle_decision_comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_oracle_vote_aggregation_updated_at
  BEFORE UPDATE ON oracle_vote_aggregation
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===================================================
-- ORACLE SCENARIO PLANNING TABLES (Phase 3 - adv-26)
-- ===================================================

-- Main scenarios table
CREATE TABLE oracle_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  decision_id UUID REFERENCES oracle_decisions(id) ON DELETE SET NULL,

  -- Scenario identification
  name TEXT NOT NULL,
  description TEXT,
  scenario_type TEXT NOT NULL CHECK (scenario_type IN ('baseline', 'optimistic', 'pessimistic', 'alternative', 'stress_test', 'custom')),

  -- Status
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'analyzing', 'completed', 'archived')),
  is_baseline BOOLEAN DEFAULT FALSE,

  -- Results
  outcome_summary TEXT,
  overall_score DECIMAL(5,2), -- -100 to 100
  probability_of_success DECIMAL(3,2) CHECK (probability_of_success >= 0 AND probability_of_success <= 1),
  risk_level TEXT CHECK (risk_level IN ('very_low', 'low', 'medium', 'high', 'very_high')),

  -- Comparison
  compared_to_baseline JSONB DEFAULT '{}', -- { score_delta, risk_delta, key_differences }

  -- Metadata
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Scenario variables (adjustable factors)
CREATE TABLE oracle_scenario_variables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id UUID NOT NULL REFERENCES oracle_scenarios(id) ON DELETE CASCADE,

  -- Variable definition
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN ('economic', 'resource', 'timeline', 'market', 'technical', 'human', 'external', 'custom')),

  -- Value configuration
  variable_type TEXT NOT NULL CHECK (variable_type IN ('numeric', 'percentage', 'boolean', 'categorical', 'range')),
  current_value JSONB NOT NULL, -- { value, unit }
  baseline_value JSONB, -- Original value for comparison
  min_value JSONB, -- For sliders
  max_value JSONB, -- For sliders
  step_size JSONB, -- For slider increments
  options JSONB, -- For categorical: [{ value, label }]

  -- Sensitivity
  sensitivity_score DECIMAL(3,2), -- How much this variable affects outcomes (0-1)
  is_key_driver BOOLEAN DEFAULT FALSE,

  -- Constraints
  constraints JSONB DEFAULT '{}', -- { min, max, depends_on, mutually_exclusive_with }

  -- Metadata
  display_order INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Scenario outcomes (simulated results per variable combination)
CREATE TABLE oracle_scenario_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id UUID NOT NULL REFERENCES oracle_scenarios(id) ON DELETE CASCADE,

  -- Outcome identification
  outcome_type TEXT NOT NULL CHECK (outcome_type IN ('primary', 'secondary', 'side_effect', 'risk', 'opportunity')),
  name TEXT NOT NULL,
  description TEXT,

  -- Quantitative results
  probability DECIMAL(3,2) CHECK (probability >= 0 AND probability <= 1),
  impact_score DECIMAL(5,2), -- -100 to 100
  confidence DECIMAL(3,2) CHECK (confidence >= 0 AND confidence <= 1),

  -- Timeline
  time_to_outcome TEXT, -- 'immediate', '1_week', '1_month', '3_months', '6_months', '1_year', 'long_term'

  -- Dependencies
  depends_on_variables UUID[] DEFAULT '{}', -- Variable IDs that affect this outcome
  sensitivity_factors JSONB DEFAULT '{}', -- { variable_id: sensitivity_coefficient }

  -- Qualitative
  risk_factors TEXT[] DEFAULT '{}',
  success_factors TEXT[] DEFAULT '{}',
  assumptions TEXT[] DEFAULT '{}',

  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Scenario comparisons (side-by-side analysis)
CREATE TABLE oracle_scenario_comparisons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Comparison setup
  name TEXT NOT NULL,
  description TEXT,
  scenario_ids UUID[] NOT NULL, -- Array of scenario IDs to compare

  -- Results
  comparison_matrix JSONB DEFAULT '{}', -- { dimensions: [], scenarios: { id: scores } }
  winner_scenario_id UUID REFERENCES oracle_scenarios(id),
  winner_reasoning TEXT,

  -- Analysis
  key_differentiators JSONB DEFAULT '[]', -- [{ factor, scenario_id, advantage }]
  trade_offs JSONB DEFAULT '[]', -- [{ scenario_a, scenario_b, description }]
  recommendations TEXT,

  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sensitivity analysis results
CREATE TABLE oracle_sensitivity_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id UUID NOT NULL REFERENCES oracle_scenarios(id) ON DELETE CASCADE,

  -- Analysis type
  analysis_type TEXT NOT NULL CHECK (analysis_type IN ('tornado', 'spider', 'monte_carlo', 'one_way', 'two_way')),

  -- Results
  variable_impacts JSONB NOT NULL, -- [{ variable_id, name, low_impact, high_impact, swing }]
  most_sensitive_variable_id UUID REFERENCES oracle_scenario_variables(id),
  least_sensitive_variable_id UUID REFERENCES oracle_scenario_variables(id),

  -- For tornado charts
  tornado_data JSONB, -- Ordered by swing size

  -- For spider charts
  spider_data JSONB, -- Percentage changes and corresponding outcome changes

  -- Summary
  key_insights TEXT[] DEFAULT '{}',
  recommendations TEXT[] DEFAULT '{}',

  -- Metadata
  iterations INTEGER, -- For Monte Carlo
  confidence_interval DECIMAL(3,2), -- e.g., 0.95 for 95%
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for scenarios
CREATE INDEX idx_oracle_scenarios_user_id ON oracle_scenarios(user_id);
CREATE INDEX idx_oracle_scenarios_decision_id ON oracle_scenarios(decision_id);
CREATE INDEX idx_oracle_scenarios_status ON oracle_scenarios(status);
CREATE INDEX idx_oracle_scenarios_user_created ON oracle_scenarios(user_id, created_at DESC);

CREATE INDEX idx_oracle_scenario_variables_scenario_id ON oracle_scenario_variables(scenario_id);
CREATE INDEX idx_oracle_scenario_variables_category ON oracle_scenario_variables(category);
CREATE INDEX idx_oracle_scenario_variables_key_driver ON oracle_scenario_variables(scenario_id) WHERE is_key_driver = TRUE;

CREATE INDEX idx_oracle_scenario_outcomes_scenario_id ON oracle_scenario_outcomes(scenario_id);
CREATE INDEX idx_oracle_scenario_outcomes_type ON oracle_scenario_outcomes(outcome_type);

CREATE INDEX idx_oracle_scenario_comparisons_user_id ON oracle_scenario_comparisons(user_id);
CREATE INDEX idx_oracle_sensitivity_analysis_scenario_id ON oracle_sensitivity_analysis(scenario_id);

-- RLS for scenarios
ALTER TABLE oracle_scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_scenario_variables ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_scenario_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_scenario_comparisons ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_sensitivity_analysis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own scenarios" ON oracle_scenarios
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Variables via scenario ownership" ON oracle_scenario_variables
  FOR ALL USING (
    scenario_id IN (SELECT id FROM oracle_scenarios WHERE user_id = auth.uid())
  );

CREATE POLICY "Outcomes via scenario ownership" ON oracle_scenario_outcomes
  FOR ALL USING (
    scenario_id IN (SELECT id FROM oracle_scenarios WHERE user_id = auth.uid())
  );

CREATE POLICY "Users manage own comparisons" ON oracle_scenario_comparisons
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Sensitivity via scenario ownership" ON oracle_sensitivity_analysis
  FOR ALL USING (
    scenario_id IN (SELECT id FROM oracle_scenarios WHERE user_id = auth.uid())
  );

-- Triggers for updated_at
CREATE TRIGGER update_oracle_scenarios_updated_at
  BEFORE UPDATE ON oracle_scenarios
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_oracle_scenario_variables_updated_at
  BEFORE UPDATE ON oracle_scenario_variables
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_oracle_scenario_outcomes_updated_at
  BEFORE UPDATE ON oracle_scenario_outcomes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_oracle_scenario_comparisons_updated_at
  BEFORE UPDATE ON oracle_scenario_comparisons
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ORACLE INTEGRATIONS (Phase 4)
-- Story int-10: Integration database tables
-- ============================================================================

-- Integration configurations
CREATE TABLE oracle_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN (
    'google_calendar', 'apple_calendar', 'todoist', 'notion',
    'slack', 'gmail', 'outlook', 'zapier', 'ifttt'
  )),
  status TEXT DEFAULT 'disconnected' CHECK (status IN ('connected', 'disconnected', 'error', 'refreshing')),
  account_email TEXT,
  account_name TEXT,
  sync_enabled BOOLEAN DEFAULT true,
  sync_frequency_minutes INTEGER DEFAULT 15,
  last_sync_at TIMESTAMPTZ,
  last_sync_status TEXT CHECK (last_sync_status IN ('success', 'partial', 'failed')),
  last_sync_error TEXT,
  settings JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, provider)
);

-- Encrypted OAuth tokens (encrypted at application level before storage)
CREATE TABLE oracle_integration_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID REFERENCES oracle_integrations(id) ON DELETE CASCADE,
  token_type TEXT NOT NULL CHECK (token_type IN ('access', 'refresh', 'api_key')),
  encrypted_token TEXT NOT NULL,
  encryption_version INTEGER DEFAULT 1,
  expires_at TIMESTAMPTZ,
  scopes TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sync history and logs
CREATE TABLE oracle_integration_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID REFERENCES oracle_integrations(id) ON DELETE CASCADE,
  sync_type TEXT NOT NULL CHECK (sync_type IN ('full', 'incremental', 'manual', 'webhook')),
  status TEXT NOT NULL CHECK (status IN ('started', 'in_progress', 'success', 'partial', 'failed')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  items_fetched INTEGER DEFAULT 0,
  items_created INTEGER DEFAULT 0,
  items_updated INTEGER DEFAULT 0,
  items_deleted INTEGER DEFAULT 0,
  errors JSONB DEFAULT '[]',
  sync_cursor TEXT,
  duration_ms INTEGER,
  metadata JSONB DEFAULT '{}'
);

-- Webhook configurations for Zapier/IFTTT
CREATE TABLE oracle_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('zapier', 'ifttt', 'custom')),
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  secret_hash TEXT NOT NULL,
  events TEXT[] NOT NULL,
  enabled BOOLEAN DEFAULT true,
  failure_count INTEGER DEFAULT 0,
  last_triggered_at TIMESTAMPTZ,
  last_status TEXT CHECK (last_status IN ('success', 'failed', 'timeout')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Linked external items (Notion pages, Todoist tasks, etc.)
CREATE TABLE oracle_external_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  oracle_entity_type TEXT NOT NULL CHECK (oracle_entity_type IN ('signal', 'decision', 'step', 'plan', 'ghost_action')),
  oracle_entity_id UUID NOT NULL,
  external_provider TEXT NOT NULL,
  external_id TEXT NOT NULL,
  external_url TEXT,
  sync_direction TEXT DEFAULT 'bidirectional' CHECK (sync_direction IN ('import', 'export', 'bidirectional')),
  last_synced_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(oracle_entity_type, oracle_entity_id, external_provider, external_id)
);

-- Indexes for integrations
CREATE INDEX idx_oracle_integrations_user_id ON oracle_integrations(user_id);
CREATE INDEX idx_oracle_integrations_provider ON oracle_integrations(provider);
CREATE INDEX idx_oracle_integrations_status ON oracle_integrations(status);
CREATE INDEX idx_oracle_integration_tokens_integration_id ON oracle_integration_tokens(integration_id);
CREATE INDEX idx_oracle_integration_sync_logs_integration_id ON oracle_integration_sync_logs(integration_id);
CREATE INDEX idx_oracle_integration_sync_logs_started_at ON oracle_integration_sync_logs(started_at DESC);
CREATE INDEX idx_oracle_webhooks_user_id ON oracle_webhooks(user_id);
CREATE INDEX idx_oracle_webhooks_provider ON oracle_webhooks(provider);
CREATE INDEX idx_oracle_external_links_user_id ON oracle_external_links(user_id);
CREATE INDEX idx_oracle_external_links_entity ON oracle_external_links(oracle_entity_type, oracle_entity_id);
CREATE INDEX idx_oracle_external_links_external ON oracle_external_links(external_provider, external_id);

-- RLS for integrations
ALTER TABLE oracle_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_integration_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_integration_sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_external_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own integrations" ON oracle_integrations
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Tokens via integration ownership" ON oracle_integration_tokens
  FOR ALL USING (
    integration_id IN (SELECT id FROM oracle_integrations WHERE user_id = auth.uid())
  );

CREATE POLICY "Sync logs via integration ownership" ON oracle_integration_sync_logs
  FOR ALL USING (
    integration_id IN (SELECT id FROM oracle_integrations WHERE user_id = auth.uid())
  );

CREATE POLICY "Users manage own webhooks" ON oracle_webhooks
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users manage own external links" ON oracle_external_links
  FOR ALL USING (auth.uid() = user_id);

-- Triggers for updated_at
CREATE TRIGGER update_oracle_integrations_updated_at
  BEFORE UPDATE ON oracle_integrations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_oracle_integration_tokens_updated_at
  BEFORE UPDATE ON oracle_integration_tokens
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_oracle_webhooks_updated_at
  BEFORE UPDATE ON oracle_webhooks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SUPABASE REALTIME CONFIGURATION
-- ============================================================================
-- Enable realtime for core ORACLE tables to support live updates in the app.
-- This allows clients to subscribe to INSERT, UPDATE, DELETE events.
--
-- CHANNEL NAMING CONVENTION:
-- - oracle:signals:{user_id}     - User's signal changes
-- - oracle:decisions:{user_id}   - User's decision changes
-- - oracle:steps:{user_id}       - User's execution step changes
-- - oracle:ghost:{user_id}       - User's ghost action changes
-- - oracle:presence:{decision_id} - Presence for collaborative decisions
--
-- REPLICA IDENTITY FULL is required for UPDATE/DELETE events to include
-- the old row data in the payload.
-- ============================================================================

-- Enable REPLICA IDENTITY FULL for tracked tables
-- This ensures UPDATE and DELETE events include all column values
ALTER TABLE oracle_signals REPLICA IDENTITY FULL;
ALTER TABLE oracle_decisions REPLICA IDENTITY FULL;
ALTER TABLE oracle_execution_steps REPLICA IDENTITY FULL;
ALTER TABLE oracle_ghost_actions REPLICA IDENTITY FULL;

-- Create or update the supabase_realtime publication
-- This publication is used by Supabase Realtime to broadcast changes
DO $$
BEGIN
  -- Check if publication exists
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    -- Create the publication with ORACLE tables
    CREATE PUBLICATION supabase_realtime FOR TABLE
      oracle_signals,
      oracle_decisions,
      oracle_execution_steps,
      oracle_ghost_actions;
  ELSE
    -- Add tables to existing publication (idempotent - ignores if already added)
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE oracle_signals;
    EXCEPTION WHEN duplicate_object THEN
      -- Table already in publication, ignore
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE oracle_decisions;
    EXCEPTION WHEN duplicate_object THEN
      -- Table already in publication, ignore
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE oracle_execution_steps;
    EXCEPTION WHEN duplicate_object THEN
      -- Table already in publication, ignore
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE oracle_ghost_actions;
    EXCEPTION WHEN duplicate_object THEN
      -- Table already in publication, ignore
    END;
  END IF;
END $$;

-- ============================================================================
-- ORACLE PERFORMANCE MONITORING TABLES (Phase 4 - perf-1)
-- ============================================================================

-- Performance metrics - track all ORACLE operation timings
CREATE TABLE oracle_performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  metric_type TEXT NOT NULL CHECK (metric_type IN (
    'api_response', 'ai_inference', 'sync_duration', 'database_query',
    'cache_hit', 'cache_miss', 'integration_call', 'realtime_latency'
  )),
  operation TEXT NOT NULL,
  duration_ms DECIMAL(10,2) NOT NULL,
  success BOOLEAN DEFAULT TRUE,
  metadata JSONB DEFAULT '{}',
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Performance alerts - triggered when thresholds are exceeded
CREATE TABLE oracle_performance_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  metric_type TEXT NOT NULL,
  operation TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  message TEXT NOT NULL,
  threshold_value DECIMAL(10,2) NOT NULL,
  actual_value DECIMAL(10,2) NOT NULL,
  acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance monitoring
CREATE INDEX idx_oracle_performance_metrics_user_id ON oracle_performance_metrics(user_id);
CREATE INDEX idx_oracle_performance_metrics_type ON oracle_performance_metrics(metric_type);
CREATE INDEX idx_oracle_performance_metrics_timestamp ON oracle_performance_metrics(timestamp);
-- Composite index for dashboard queries
CREATE INDEX idx_oracle_performance_metrics_user_type_time ON oracle_performance_metrics(user_id, metric_type, timestamp DESC);

CREATE INDEX idx_oracle_performance_alerts_user_id ON oracle_performance_alerts(user_id);
CREATE INDEX idx_oracle_performance_alerts_severity ON oracle_performance_alerts(severity);
CREATE INDEX idx_oracle_performance_alerts_unacknowledged ON oracle_performance_alerts(user_id, acknowledged) WHERE acknowledged = FALSE;
CREATE INDEX idx_oracle_performance_alerts_created_at ON oracle_performance_alerts(created_at);

-- RLS for performance monitoring
ALTER TABLE oracle_performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_performance_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Performance metrics belong to user" ON oracle_performance_metrics
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Performance alerts belong to user" ON oracle_performance_alerts
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- ORACLE AUDIT LOGGING TABLES (Phase 4 - sec-2)
-- ============================================================================

-- Audit logs - comprehensive logging for compliance
CREATE TABLE oracle_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN (
    'create', 'read', 'update', 'delete',
    'bulk_create', 'bulk_update', 'bulk_delete',
    'ai_query', 'ai_response', 'export', 'import',
    'login', 'logout', 'password_change', 'settings_change', 'permission_change',
    'integration_connect', 'integration_disconnect', 'sync',
    'encrypt', 'decrypt', 'share', 'unshare', 'custom'
  )),
  category TEXT NOT NULL CHECK (category IN (
    'signal', 'context', 'decision', 'option', 'plan', 'step',
    'ghost_action', 'prediction', 'pattern', 'integration', 'ai', 'auth', 'settings', 'system'
  )),
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  entity_type TEXT NOT NULL,
  entity_id UUID,
  entity_name TEXT,
  old_value JSONB,
  new_value JSONB,
  metadata JSONB DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  session_id TEXT,
  request_id TEXT,
  success BOOLEAN DEFAULT TRUE,
  error_message TEXT,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Archived audit logs for retention policy
CREATE TABLE oracle_audit_logs_archive (
  id UUID PRIMARY KEY,
  user_id UUID,
  action TEXT NOT NULL,
  category TEXT NOT NULL,
  severity TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  entity_name TEXT,
  old_value JSONB,
  new_value JSONB,
  metadata JSONB DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  session_id TEXT,
  request_id TEXT,
  success BOOLEAN DEFAULT TRUE,
  error_message TEXT,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for audit logs
CREATE INDEX idx_oracle_audit_logs_user_id ON oracle_audit_logs(user_id);
CREATE INDEX idx_oracle_audit_logs_action ON oracle_audit_logs(action);
CREATE INDEX idx_oracle_audit_logs_category ON oracle_audit_logs(category);
CREATE INDEX idx_oracle_audit_logs_severity ON oracle_audit_logs(severity);
CREATE INDEX idx_oracle_audit_logs_entity ON oracle_audit_logs(entity_type, entity_id);
CREATE INDEX idx_oracle_audit_logs_created_at ON oracle_audit_logs(created_at);
-- Composite index for common queries
CREATE INDEX idx_oracle_audit_logs_user_time ON oracle_audit_logs(user_id, created_at DESC);
CREATE INDEX idx_oracle_audit_logs_user_action ON oracle_audit_logs(user_id, action, created_at DESC);
-- Index for security events
CREATE INDEX idx_oracle_audit_logs_security ON oracle_audit_logs(category, success) WHERE category = 'auth';

CREATE INDEX idx_oracle_audit_logs_archive_user_id ON oracle_audit_logs_archive(user_id);
CREATE INDEX idx_oracle_audit_logs_archive_created_at ON oracle_audit_logs_archive(created_at);

-- RLS for audit logs
ALTER TABLE oracle_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_audit_logs_archive ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Audit logs belong to user" ON oracle_audit_logs
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Archived audit logs belong to user" ON oracle_audit_logs_archive
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- ORACLE TEAM & ORGANIZATION TABLES (Phase 5 - team-1)
-- ============================================================================

-- Organizations - top-level container for teams
CREATE TABLE oracle_organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'business', 'enterprise')),
  logo_url TEXT,
  billing_email TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  trial_ends_at TIMESTAMPTZ,
  settings JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Teams within organizations
CREATE TABLE oracle_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES oracle_organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT FALSE,
  settings JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, name)
);

-- Team members - user-team relationships with roles
CREATE TABLE oracle_team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES oracle_teams(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  permissions JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, user_id)
);

-- Team invites - pending invitations
CREATE TABLE oracle_team_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES oracle_teams(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member', 'viewer')),
  invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
  token TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired', 'revoked')),
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  accepted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Organization-level ORACLE configuration
CREATE TABLE oracle_org_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES oracle_organizations(id) ON DELETE CASCADE UNIQUE,

  -- AI Configuration
  ai_enabled BOOLEAN DEFAULT TRUE,
  default_ai_personality TEXT,
  ai_usage_limit_daily INTEGER,

  -- Feature flags
  features_enabled JSONB DEFAULT '{"signals": true, "decisions": true, "plans": true, "predictions": true}',

  -- Sharing defaults
  default_decision_visibility TEXT DEFAULT 'private' CHECK (default_decision_visibility IN ('private', 'team', 'org')),
  default_plan_visibility TEXT DEFAULT 'private' CHECK (default_plan_visibility IN ('private', 'team', 'org')),

  -- Security settings
  require_2fa BOOLEAN DEFAULT FALSE,
  allowed_domains JSONB DEFAULT '[]',
  ip_whitelist JSONB DEFAULT '[]',

  -- Data retention
  retention_days INTEGER DEFAULT 365,
  auto_archive_enabled BOOLEAN DEFAULT TRUE,

  -- Notification preferences
  notification_settings JSONB DEFAULT '{}',

  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for TEAM & ORGANIZATION module
CREATE INDEX idx_oracle_organizations_owner_id ON oracle_organizations(owner_id);
CREATE INDEX idx_oracle_organizations_slug ON oracle_organizations(slug);
CREATE INDEX idx_oracle_organizations_plan ON oracle_organizations(plan);
CREATE INDEX idx_oracle_organizations_is_active ON oracle_organizations(is_active);

CREATE INDEX idx_oracle_teams_org_id ON oracle_teams(org_id);
CREATE INDEX idx_oracle_teams_is_default ON oracle_teams(is_default);

CREATE INDEX idx_oracle_team_members_team_id ON oracle_team_members(team_id);
CREATE INDEX idx_oracle_team_members_user_id ON oracle_team_members(user_id);
CREATE INDEX idx_oracle_team_members_role ON oracle_team_members(role);
-- Composite index for finding user's teams
CREATE INDEX idx_oracle_team_members_user_team ON oracle_team_members(user_id, team_id);

CREATE INDEX idx_oracle_team_invites_team_id ON oracle_team_invites(team_id);
CREATE INDEX idx_oracle_team_invites_email ON oracle_team_invites(email);
CREATE INDEX idx_oracle_team_invites_token ON oracle_team_invites(token);
CREATE INDEX idx_oracle_team_invites_status ON oracle_team_invites(status);
-- Composite index for pending invites lookup
CREATE INDEX idx_oracle_team_invites_email_status ON oracle_team_invites(email, status) WHERE status = 'pending';

CREATE INDEX idx_oracle_org_settings_org_id ON oracle_org_settings(org_id);

-- RLS for TEAM & ORGANIZATION module
ALTER TABLE oracle_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_team_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_org_settings ENABLE ROW LEVEL SECURITY;

-- Organizations: owner can do everything, members can view
CREATE POLICY "Org owner has full access" ON oracle_organizations
  FOR ALL USING (auth.uid() = owner_id);

CREATE POLICY "Org members can view org" ON oracle_organizations
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM oracle_team_members tm
    JOIN oracle_teams t ON t.id = tm.team_id
    WHERE t.org_id = oracle_organizations.id AND tm.user_id = auth.uid()
  ));

-- Teams: org owner and team admins can manage, members can view
CREATE POLICY "Team accessible by org owner" ON oracle_teams
  FOR ALL USING (EXISTS (
    SELECT 1 FROM oracle_organizations o
    WHERE o.id = oracle_teams.org_id AND o.owner_id = auth.uid()
  ));

CREATE POLICY "Team admin can manage team" ON oracle_teams
  FOR ALL USING (EXISTS (
    SELECT 1 FROM oracle_team_members tm
    WHERE tm.team_id = oracle_teams.id
    AND tm.user_id = auth.uid()
    AND tm.role IN ('owner', 'admin')
  ));

CREATE POLICY "Team members can view team" ON oracle_teams
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM oracle_team_members tm
    WHERE tm.team_id = oracle_teams.id AND tm.user_id = auth.uid()
  ));

-- Team members: visible to team members, manageable by admins
CREATE POLICY "Team members visible to team" ON oracle_team_members
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM oracle_team_members tm
    WHERE tm.team_id = oracle_team_members.team_id AND tm.user_id = auth.uid()
  ));

CREATE POLICY "Team admins can manage members" ON oracle_team_members
  FOR ALL USING (EXISTS (
    SELECT 1 FROM oracle_team_members tm
    WHERE tm.team_id = oracle_team_members.team_id
    AND tm.user_id = auth.uid()
    AND tm.role IN ('owner', 'admin')
  ));

CREATE POLICY "Org owner can manage all members" ON oracle_team_members
  FOR ALL USING (EXISTS (
    SELECT 1 FROM oracle_teams t
    JOIN oracle_organizations o ON o.id = t.org_id
    WHERE t.id = oracle_team_members.team_id AND o.owner_id = auth.uid()
  ));

-- Team invites: visible to team admins and the invited user
CREATE POLICY "Team admins can manage invites" ON oracle_team_invites
  FOR ALL USING (EXISTS (
    SELECT 1 FROM oracle_team_members tm
    WHERE tm.team_id = oracle_team_invites.team_id
    AND tm.user_id = auth.uid()
    AND tm.role IN ('owner', 'admin')
  ));

CREATE POLICY "Invited user can view and accept invite" ON oracle_team_invites
  FOR SELECT USING (
    oracle_team_invites.email = (SELECT email FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Invited user can update invite status" ON oracle_team_invites
  FOR UPDATE USING (
    oracle_team_invites.email = (SELECT email FROM users WHERE id = auth.uid())
  );

-- Org settings: accessible by org owner and admins
CREATE POLICY "Org owner can manage settings" ON oracle_org_settings
  FOR ALL USING (EXISTS (
    SELECT 1 FROM oracle_organizations o
    WHERE o.id = oracle_org_settings.org_id AND o.owner_id = auth.uid()
  ));

CREATE POLICY "Org admins can view settings" ON oracle_org_settings
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM oracle_team_members tm
    JOIN oracle_teams t ON t.id = tm.team_id
    WHERE t.org_id = oracle_org_settings.org_id
    AND tm.user_id = auth.uid()
    AND tm.role IN ('owner', 'admin')
  ));

-- Triggers for updated_at
CREATE TRIGGER update_oracle_organizations_updated_at
  BEFORE UPDATE ON oracle_organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_oracle_teams_updated_at
  BEFORE UPDATE ON oracle_teams
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_oracle_team_members_updated_at
  BEFORE UPDATE ON oracle_team_members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_oracle_team_invites_updated_at
  BEFORE UPDATE ON oracle_team_invites
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_oracle_org_settings_updated_at
  BEFORE UPDATE ON oracle_org_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to create default team when org is created
CREATE OR REPLACE FUNCTION create_default_team_for_org()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO oracle_teams (org_id, name, description, is_default)
  VALUES (NEW.id, 'Default Team', 'Default team for the organization', TRUE);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER create_org_default_team
  AFTER INSERT ON oracle_organizations
  FOR EACH ROW EXECUTE FUNCTION create_default_team_for_org();

-- Function to add org owner to default team
CREATE OR REPLACE FUNCTION add_owner_to_default_team()
RETURNS TRIGGER AS $$
DECLARE
  org_owner_id UUID;
BEGIN
  SELECT owner_id INTO org_owner_id FROM oracle_organizations WHERE id = NEW.org_id;
  IF NEW.is_default = TRUE THEN
    INSERT INTO oracle_team_members (team_id, user_id, role)
    VALUES (NEW.id, org_owner_id, 'owner')
    ON CONFLICT (team_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER add_owner_to_team
  AFTER INSERT ON oracle_teams
  FOR EACH ROW EXECUTE FUNCTION add_owner_to_default_team();

-- ============================================================================
-- ORACLE TEAM DATA SHARING TABLES (Phase 5 - team-5)
-- ============================================================================

-- Shared content - generic sharing for any ORACLE entity
CREATE TABLE oracle_shared_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
  team_id UUID REFERENCES oracle_teams(id) ON DELETE CASCADE,

  -- What is being shared
  entity_type TEXT NOT NULL CHECK (entity_type IN ('decision', 'plan', 'signal', 'context', 'learning')),
  entity_id UUID NOT NULL,

  -- Sharing settings
  visibility TEXT NOT NULL DEFAULT 'team' CHECK (visibility IN ('team', 'org')),
  permission_level TEXT NOT NULL DEFAULT 'view' CHECK (permission_level IN ('view', 'comment', 'edit')),

  -- Metadata
  shared_at TIMESTAMPTZ DEFAULT NOW(),
  shared_by UUID REFERENCES users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(team_id, entity_type, entity_id)
);

-- Comments on shared content
CREATE TABLE oracle_shared_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shared_content_id UUID REFERENCES oracle_shared_content(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  parent_comment_id UUID REFERENCES oracle_shared_comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_edited BOOLEAN DEFAULT FALSE,
  edited_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Team activity feed
CREATE TABLE oracle_team_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES oracle_teams(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL CHECK (activity_type IN (
    'decision_created', 'decision_made', 'plan_started', 'plan_completed',
    'signal_detected', 'signal_resolved', 'learning_captured',
    'comment_added', 'content_shared', 'member_joined', 'member_left'
  )),
  entity_type TEXT,
  entity_id UUID,
  title TEXT NOT NULL,
  description TEXT,
  is_public BOOLEAN DEFAULT TRUE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for TEAM DATA SHARING module
CREATE INDEX idx_oracle_shared_content_owner_id ON oracle_shared_content(owner_id);
CREATE INDEX idx_oracle_shared_content_team_id ON oracle_shared_content(team_id);
CREATE INDEX idx_oracle_shared_content_entity ON oracle_shared_content(entity_type, entity_id);
CREATE INDEX idx_oracle_shared_content_visibility ON oracle_shared_content(visibility);
CREATE INDEX idx_oracle_shared_content_active ON oracle_shared_content(is_active);

CREATE INDEX idx_oracle_shared_comments_content_id ON oracle_shared_comments(shared_content_id);
CREATE INDEX idx_oracle_shared_comments_user_id ON oracle_shared_comments(user_id);
CREATE INDEX idx_oracle_shared_comments_parent ON oracle_shared_comments(parent_comment_id);
CREATE INDEX idx_oracle_shared_comments_created_at ON oracle_shared_comments(created_at);

CREATE INDEX idx_oracle_team_activity_team_id ON oracle_team_activity(team_id);
CREATE INDEX idx_oracle_team_activity_user_id ON oracle_team_activity(user_id);
CREATE INDEX idx_oracle_team_activity_type ON oracle_team_activity(activity_type);
CREATE INDEX idx_oracle_team_activity_created_at ON oracle_team_activity(created_at);
-- Composite index for feed queries
CREATE INDEX idx_oracle_team_activity_team_time ON oracle_team_activity(team_id, created_at DESC);

-- RLS for TEAM DATA SHARING module
ALTER TABLE oracle_shared_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_shared_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_team_activity ENABLE ROW LEVEL SECURITY;

-- Shared content: visible to team members
CREATE POLICY "Shared content visible to team members" ON oracle_shared_content
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM oracle_team_members tm
    WHERE tm.team_id = oracle_shared_content.team_id AND tm.user_id = auth.uid()
  ));

CREATE POLICY "Shared content manageable by owner" ON oracle_shared_content
  FOR ALL USING (auth.uid() = owner_id);

CREATE POLICY "Shared content manageable by team admins" ON oracle_shared_content
  FOR ALL USING (EXISTS (
    SELECT 1 FROM oracle_team_members tm
    WHERE tm.team_id = oracle_shared_content.team_id
    AND tm.user_id = auth.uid()
    AND tm.role IN ('owner', 'admin')
  ));

-- Comments: visible to team members with comment permission
CREATE POLICY "Comments visible to team members" ON oracle_shared_comments
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM oracle_shared_content sc
    JOIN oracle_team_members tm ON tm.team_id = sc.team_id
    WHERE sc.id = oracle_shared_comments.shared_content_id AND tm.user_id = auth.uid()
  ));

CREATE POLICY "Users can manage own comments" ON oracle_shared_comments
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Comments creatable by team members with permission" ON oracle_shared_comments
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM oracle_shared_content sc
    JOIN oracle_team_members tm ON tm.team_id = sc.team_id
    WHERE sc.id = oracle_shared_comments.shared_content_id
    AND tm.user_id = auth.uid()
    AND sc.permission_level IN ('comment', 'edit')
  ));

-- Team activity: visible to team members
CREATE POLICY "Team activity visible to team members" ON oracle_team_activity
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM oracle_team_members tm
    WHERE tm.team_id = oracle_team_activity.team_id AND tm.user_id = auth.uid()
  ));

CREATE POLICY "Team activity creatable by team members" ON oracle_team_activity
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM oracle_team_members tm
    WHERE tm.team_id = oracle_team_activity.team_id AND tm.user_id = auth.uid()
  ));

-- Triggers for updated_at
CREATE TRIGGER update_oracle_shared_content_updated_at
  BEFORE UPDATE ON oracle_shared_content
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_oracle_shared_comments_updated_at
  BEFORE UPDATE ON oracle_shared_comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ORACLE TEAM ANALYTICS TABLES (Phase 5 - team-6)
-- ============================================================================

-- Team-wide prediction accuracy
CREATE TABLE oracle_team_prediction_accuracy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES oracle_teams(id) ON DELETE CASCADE,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,

  -- Aggregate metrics
  total_predictions INTEGER DEFAULT 0,
  resolved_predictions INTEGER DEFAULT 0,
  accurate_predictions INTEGER DEFAULT 0,
  accuracy_rate DECIMAL(5,4) CHECK (accuracy_rate >= 0 AND accuracy_rate <= 1),
  brier_score DECIMAL(6,4) CHECK (brier_score >= 0 AND brier_score <= 1),

  -- By category breakdown
  accuracy_by_category JSONB DEFAULT '{}',

  -- Comparison to org average
  vs_org_average DECIMAL(5,4),

  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Member activity comparison
CREATE TABLE oracle_team_member_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES oracle_teams(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,

  -- Activity counts
  decisions_created INTEGER DEFAULT 0,
  decisions_completed INTEGER DEFAULT 0,
  plans_created INTEGER DEFAULT 0,
  plans_completed INTEGER DEFAULT 0,
  signals_acknowledged INTEGER DEFAULT 0,
  comments_made INTEGER DEFAULT 0,
  shares_made INTEGER DEFAULT 0,

  -- Quality metrics
  prediction_accuracy DECIMAL(5,4) CHECK (prediction_accuracy >= 0 AND prediction_accuracy <= 1),
  avg_decision_time_hours DECIMAL(10,2),
  plan_completion_rate DECIMAL(5,4) CHECK (plan_completion_rate >= 0 AND plan_completion_rate <= 1),

  -- Engagement score
  engagement_score DECIMAL(5,2) CHECK (engagement_score >= 0 AND engagement_score <= 100),

  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(team_id, user_id, period_start, period_end)
);

-- Team productivity metrics
CREATE TABLE oracle_team_productivity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES oracle_teams(id) ON DELETE CASCADE,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,

  -- Decision metrics
  total_decisions INTEGER DEFAULT 0,
  decisions_pending INTEGER DEFAULT 0,
  decisions_completed INTEGER DEFAULT 0,
  avg_decision_time_hours DECIMAL(10,2),

  -- Execution metrics
  total_plans INTEGER DEFAULT 0,
  plans_completed INTEGER DEFAULT 0,
  plans_on_track INTEGER DEFAULT 0,
  plans_at_risk INTEGER DEFAULT 0,
  avg_plan_duration_days DECIMAL(10,2),

  -- Signal metrics
  signals_detected INTEGER DEFAULT 0,
  signals_acknowledged INTEGER DEFAULT 0,
  critical_signals INTEGER DEFAULT 0,

  -- Collaboration metrics
  shared_decisions INTEGER DEFAULT 0,
  comments_total INTEGER DEFAULT 0,
  active_contributors INTEGER DEFAULT 0,

  -- Overall health score
  productivity_score DECIMAL(5,2) CHECK (productivity_score >= 0 AND productivity_score <= 100),
  health_status TEXT DEFAULT 'healthy' CHECK (health_status IN ('healthy', 'at_risk', 'critical')),

  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for TEAM ANALYTICS module
CREATE INDEX idx_oracle_team_prediction_accuracy_team_id ON oracle_team_prediction_accuracy(team_id);
CREATE INDEX idx_oracle_team_prediction_accuracy_period ON oracle_team_prediction_accuracy(period_start, period_end);

CREATE INDEX idx_oracle_team_member_activity_team_id ON oracle_team_member_activity(team_id);
CREATE INDEX idx_oracle_team_member_activity_user_id ON oracle_team_member_activity(user_id);
CREATE INDEX idx_oracle_team_member_activity_period ON oracle_team_member_activity(period_start, period_end);
-- Composite for leaderboards
CREATE INDEX idx_oracle_team_member_activity_team_engagement ON oracle_team_member_activity(team_id, engagement_score DESC);

CREATE INDEX idx_oracle_team_productivity_team_id ON oracle_team_productivity(team_id);
CREATE INDEX idx_oracle_team_productivity_period ON oracle_team_productivity(period_start, period_end);
CREATE INDEX idx_oracle_team_productivity_health ON oracle_team_productivity(health_status);

-- RLS for TEAM ANALYTICS module
ALTER TABLE oracle_team_prediction_accuracy ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_team_member_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_team_productivity ENABLE ROW LEVEL SECURITY;

-- Team analytics: visible to team members with analytics permission
CREATE POLICY "Team prediction accuracy visible to team members" ON oracle_team_prediction_accuracy
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM oracle_team_members tm
    WHERE tm.team_id = oracle_team_prediction_accuracy.team_id
    AND tm.user_id = auth.uid()
    AND tm.role != 'viewer'
  ));

CREATE POLICY "Team member activity visible to admins" ON oracle_team_member_activity
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM oracle_team_members tm
    WHERE tm.team_id = oracle_team_member_activity.team_id
    AND tm.user_id = auth.uid()
    AND tm.role IN ('owner', 'admin')
  ));

-- Users can see their own activity
CREATE POLICY "Users can view own activity" ON oracle_team_member_activity
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Team productivity visible to team members" ON oracle_team_productivity
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM oracle_team_members tm
    WHERE tm.team_id = oracle_team_productivity.team_id
    AND tm.user_id = auth.uid()
    AND tm.role != 'viewer'
  ));

-- Triggers for updated_at
CREATE TRIGGER update_oracle_team_prediction_accuracy_updated_at
  BEFORE UPDATE ON oracle_team_prediction_accuracy
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_oracle_team_member_activity_updated_at
  BEFORE UPDATE ON oracle_team_member_activity
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_oracle_team_productivity_updated_at
  BEFORE UPDATE ON oracle_team_productivity
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ORACLE AI FINE-TUNING TABLES (Phase 5 - ai-tune-1, ai-tune-2, ai-tune-4)
-- ============================================================================

-- Training examples collected from user interactions
CREATE TABLE oracle_training_examples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  org_id UUID REFERENCES oracle_organizations(id) ON DELETE SET NULL,

  -- Example type
  example_type TEXT NOT NULL CHECK (example_type IN ('positive', 'negative', 'correction')),
  category TEXT NOT NULL CHECK (category IN ('prediction', 'decision', 'recommendation', 'analysis', 'summary', 'custom')),

  -- Input/output pairs
  input_prompt TEXT NOT NULL,
  model_output TEXT NOT NULL,
  corrected_output TEXT,
  expected_output TEXT,

  -- Context
  context_data JSONB DEFAULT '{}',
  source_entity_type TEXT,
  source_entity_id UUID,

  -- Quality metrics
  accuracy_score DECIMAL(3,2) CHECK (accuracy_score >= 0 AND accuracy_score <= 1),
  user_rating INTEGER CHECK (user_rating >= 1 AND user_rating <= 5),
  user_feedback TEXT,

  -- Consent and privacy
  consent_given BOOLEAN DEFAULT FALSE,
  consent_timestamp TIMESTAMPTZ,
  is_anonymized BOOLEAN DEFAULT FALSE,
  anonymized_at TIMESTAMPTZ,

  -- Usage tracking
  times_used_in_training INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,

  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Custom prompt templates
CREATE TABLE oracle_prompt_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  org_id UUID REFERENCES oracle_organizations(id) ON DELETE SET NULL,

  -- Template info
  name TEXT NOT NULL,
  description TEXT,
  operation_type TEXT NOT NULL CHECK (operation_type IN (
    'radar_scan', 'signal_analysis', 'context_synthesis', 'decision_analysis',
    'option_evaluation', 'simulation', 'plan_generation', 'step_suggestion',
    'prediction', 'learning_extraction', 'summary', 'custom'
  )),

  -- Template content
  template_content TEXT NOT NULL,
  variables JSONB DEFAULT '[]',
  output_format TEXT,

  -- Versioning
  version INTEGER DEFAULT 1,
  is_latest BOOLEAN DEFAULT TRUE,
  parent_version_id UUID REFERENCES oracle_prompt_templates(id) ON DELETE SET NULL,

  -- Visibility and sharing
  is_default BOOLEAN DEFAULT FALSE,
  is_public BOOLEAN DEFAULT FALSE,
  is_system BOOLEAN DEFAULT FALSE,

  -- Usage tracking
  usage_count INTEGER DEFAULT 0,
  avg_rating DECIMAL(3,2),
  rating_count INTEGER DEFAULT 0,

  is_active BOOLEAN DEFAULT TRUE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI personality profiles
CREATE TABLE oracle_ai_personalities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  org_id UUID REFERENCES oracle_organizations(id) ON DELETE SET NULL,

  -- Personality info
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,

  -- Trait sliders (0-100)
  formality INTEGER DEFAULT 50 CHECK (formality >= 0 AND formality <= 100),
  detail_level INTEGER DEFAULT 50 CHECK (detail_level >= 0 AND detail_level <= 100),
  risk_tolerance INTEGER DEFAULT 50 CHECK (risk_tolerance >= 0 AND risk_tolerance <= 100),
  empathy INTEGER DEFAULT 50 CHECK (empathy >= 0 AND empathy <= 100),
  proactivity INTEGER DEFAULT 50 CHECK (proactivity >= 0 AND proactivity <= 100),

  -- Industry/domain presets
  industry TEXT,
  domain_keywords JSONB DEFAULT '[]',

  -- Custom instructions
  system_prompt_prefix TEXT,
  system_prompt_suffix TEXT,
  response_style_hints JSONB DEFAULT '{}',

  -- Sample responses for preview
  sample_responses JSONB DEFAULT '[]',

  -- A/B testing
  ab_test_group TEXT,
  ab_test_metrics JSONB DEFAULT '{}',

  -- Visibility
  is_default BOOLEAN DEFAULT FALSE,
  is_public BOOLEAN DEFAULT FALSE,
  is_system BOOLEAN DEFAULT FALSE,

  -- Usage
  usage_count INTEGER DEFAULT 0,
  avg_satisfaction DECIMAL(3,2),
  is_active BOOLEAN DEFAULT TRUE,

  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User AI preferences
CREATE TABLE oracle_user_ai_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,

  -- Selected personality
  personality_id UUID REFERENCES oracle_ai_personalities(id) ON DELETE SET NULL,

  -- Training data preferences
  allow_training_data BOOLEAN DEFAULT FALSE,
  anonymize_training_data BOOLEAN DEFAULT TRUE,
  training_categories JSONB DEFAULT '[]',

  -- Response preferences
  preferred_language TEXT DEFAULT 'en',
  max_response_length INTEGER,
  include_confidence BOOLEAN DEFAULT TRUE,
  include_alternatives BOOLEAN DEFAULT TRUE,

  -- Custom overrides per operation type
  operation_preferences JSONB DEFAULT '{}',

  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for AI FINE-TUNING module
CREATE INDEX idx_oracle_training_examples_user_id ON oracle_training_examples(user_id);
CREATE INDEX idx_oracle_training_examples_org_id ON oracle_training_examples(org_id);
CREATE INDEX idx_oracle_training_examples_type ON oracle_training_examples(example_type);
CREATE INDEX idx_oracle_training_examples_category ON oracle_training_examples(category);
CREATE INDEX idx_oracle_training_examples_consent ON oracle_training_examples(consent_given);
CREATE INDEX idx_oracle_training_examples_active ON oracle_training_examples(is_active);

CREATE INDEX idx_oracle_prompt_templates_user_id ON oracle_prompt_templates(user_id);
CREATE INDEX idx_oracle_prompt_templates_org_id ON oracle_prompt_templates(org_id);
CREATE INDEX idx_oracle_prompt_templates_operation ON oracle_prompt_templates(operation_type);
CREATE INDEX idx_oracle_prompt_templates_default ON oracle_prompt_templates(is_default);
CREATE INDEX idx_oracle_prompt_templates_public ON oracle_prompt_templates(is_public);
CREATE INDEX idx_oracle_prompt_templates_active ON oracle_prompt_templates(is_active, is_latest);

CREATE INDEX idx_oracle_ai_personalities_user_id ON oracle_ai_personalities(user_id);
CREATE INDEX idx_oracle_ai_personalities_org_id ON oracle_ai_personalities(org_id);
CREATE INDEX idx_oracle_ai_personalities_industry ON oracle_ai_personalities(industry);
CREATE INDEX idx_oracle_ai_personalities_default ON oracle_ai_personalities(is_default);
CREATE INDEX idx_oracle_ai_personalities_public ON oracle_ai_personalities(is_public);

CREATE INDEX idx_oracle_user_ai_preferences_user_id ON oracle_user_ai_preferences(user_id);
CREATE INDEX idx_oracle_user_ai_preferences_personality ON oracle_user_ai_preferences(personality_id);

-- RLS for AI FINE-TUNING module
ALTER TABLE oracle_training_examples ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_prompt_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_ai_personalities ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_user_ai_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Training examples belong to user" ON oracle_training_examples
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "User owns their templates" ON oracle_prompt_templates
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Public templates are viewable" ON oracle_prompt_templates
  FOR SELECT USING (is_public = TRUE OR is_system = TRUE);

CREATE POLICY "User owns their personalities" ON oracle_ai_personalities
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Public personalities are viewable" ON oracle_ai_personalities
  FOR SELECT USING (is_public = TRUE OR is_system = TRUE);

CREATE POLICY "User owns their AI preferences" ON oracle_user_ai_preferences
  FOR ALL USING (auth.uid() = user_id);

-- Triggers for updated_at
CREATE TRIGGER update_oracle_training_examples_updated_at
  BEFORE UPDATE ON oracle_training_examples
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_oracle_prompt_templates_updated_at
  BEFORE UPDATE ON oracle_prompt_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_oracle_ai_personalities_updated_at
  BEFORE UPDATE ON oracle_ai_personalities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_oracle_user_ai_preferences_updated_at
  BEFORE UPDATE ON oracle_user_ai_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- ORACLE PHASE 5: WHITE-LABEL CONFIGURATION
-- Stories wl-1 through wl-5
-- =====================================================

-- White-label configurations for organizations
CREATE TABLE oracle_white_label_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES oracle_organizations(id) ON DELETE CASCADE,

  -- Brand identity
  brand_name TEXT NOT NULL,
  brand_tagline TEXT,
  logo_url TEXT,
  logo_dark_url TEXT,
  favicon_url TEXT,
  splash_screen_url TEXT,

  -- Custom domain
  custom_domain TEXT UNIQUE,
  domain_verified BOOLEAN DEFAULT FALSE,
  domain_verification_token TEXT,
  domain_verified_at TIMESTAMPTZ,

  -- Primary colors
  primary_color TEXT DEFAULT '#00BFFF',
  secondary_color TEXT DEFAULT '#FFD700',
  accent_color TEXT DEFAULT '#FF6B6B',
  success_color TEXT DEFAULT '#00FF88',
  warning_color TEXT DEFAULT '#FFA500',
  error_color TEXT DEFAULT '#FF4444',

  -- OODA phase colors (can override defaults)
  observe_color TEXT DEFAULT '#00BFFF',
  orient_color TEXT DEFAULT '#FFD700',
  decide_color TEXT DEFAULT '#FF6B6B',
  act_color TEXT DEFAULT '#00FF88',

  -- Typography
  font_family TEXT DEFAULT 'Inter',
  heading_font_family TEXT,
  font_scale DECIMAL(3,2) DEFAULT 1.0 CHECK (font_scale >= 0.8 AND font_scale <= 1.5),

  -- Theme variants
  light_theme JSONB DEFAULT '{}',
  dark_theme JSONB DEFAULT '{}',
  default_theme TEXT DEFAULT 'dark' CHECK (default_theme IN ('light', 'dark', 'system')),

  -- Feature toggles
  features_enabled JSONB DEFAULT '{
    "oracle": true,
    "teams": true,
    "analytics": true,
    "ai_tuning": true,
    "voice": true,
    "widgets": true,
    "export": true
  }',

  -- Email templates
  email_templates JSONB DEFAULT '{}',
  email_from_name TEXT,
  email_from_address TEXT,

  -- Legal/compliance
  terms_url TEXT,
  privacy_url TEXT,
  support_email TEXT,
  support_url TEXT,

  -- Metadata
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id),

  UNIQUE(org_id)
);

-- Theme variants for more granular theming
CREATE TABLE oracle_theme_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES oracle_white_label_configs(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  description TEXT,
  variant_type TEXT NOT NULL CHECK (variant_type IN ('light', 'dark', 'high_contrast', 'colorblind', 'custom')),

  -- Color palette
  background_primary TEXT NOT NULL,
  background_secondary TEXT NOT NULL,
  background_tertiary TEXT,

  surface_primary TEXT NOT NULL,
  surface_secondary TEXT,
  surface_elevated TEXT,

  text_primary TEXT NOT NULL,
  text_secondary TEXT NOT NULL,
  text_muted TEXT,
  text_inverse TEXT,

  border_primary TEXT,
  border_secondary TEXT,

  -- Accent colors
  accent_primary TEXT,
  accent_secondary TEXT,

  -- Status colors
  status_success TEXT,
  status_warning TEXT,
  status_error TEXT,
  status_info TEXT,

  -- OODA phase colors for this variant
  phase_observe TEXT,
  phase_orient TEXT,
  phase_decide TEXT,
  phase_act TEXT,

  -- Component-specific overrides
  button_styles JSONB DEFAULT '{}',
  card_styles JSONB DEFAULT '{}',
  input_styles JSONB DEFAULT '{}',
  modal_styles JSONB DEFAULT '{}',

  -- Accessibility
  min_contrast_ratio DECIMAL(3,1) DEFAULT 4.5,
  is_accessible BOOLEAN DEFAULT TRUE,

  is_default BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(config_id, name)
);

-- Email templates for white-label branding
CREATE TABLE oracle_email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES oracle_white_label_configs(id) ON DELETE CASCADE,

  template_type TEXT NOT NULL CHECK (template_type IN (
    'invite', 'welcome', 'password_reset', 'notification',
    'report', 'digest', 'alert', 'reminder', 'confirmation'
  )),

  name TEXT NOT NULL,
  subject TEXT NOT NULL,

  -- MJML or HTML content
  content_type TEXT DEFAULT 'mjml' CHECK (content_type IN ('mjml', 'html', 'text')),
  body_template TEXT NOT NULL,

  -- Variables available in template
  available_variables TEXT[] DEFAULT ARRAY['user_name', 'brand_name', 'action_url'],

  -- Preview/test
  preview_data JSONB DEFAULT '{}',

  is_default BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(config_id, template_type, name)
);

-- Custom CSS/styling overrides
CREATE TABLE oracle_custom_styles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES oracle_white_label_configs(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  description TEXT,

  -- CSS variables or style object
  style_type TEXT NOT NULL CHECK (style_type IN ('css_variables', 'style_object', 'stylesheet')),
  styles JSONB NOT NULL,

  -- Component targeting
  target_components TEXT[] DEFAULT ARRAY[]::TEXT[],
  target_screens TEXT[] DEFAULT ARRAY[]::TEXT[],

  -- Priority for cascading
  priority INTEGER DEFAULT 0,

  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for WHITE-LABEL module
CREATE INDEX idx_oracle_white_label_configs_org_id ON oracle_white_label_configs(org_id);
CREATE INDEX idx_oracle_white_label_configs_domain ON oracle_white_label_configs(custom_domain) WHERE custom_domain IS NOT NULL;
CREATE INDEX idx_oracle_white_label_configs_active ON oracle_white_label_configs(is_active);

CREATE INDEX idx_oracle_theme_variants_config_id ON oracle_theme_variants(config_id);
CREATE INDEX idx_oracle_theme_variants_type ON oracle_theme_variants(variant_type);
CREATE INDEX idx_oracle_theme_variants_default ON oracle_theme_variants(config_id, is_default) WHERE is_default = TRUE;

CREATE INDEX idx_oracle_email_templates_config_id ON oracle_email_templates(config_id);
CREATE INDEX idx_oracle_email_templates_type ON oracle_email_templates(config_id, template_type);

CREATE INDEX idx_oracle_custom_styles_config_id ON oracle_custom_styles(config_id);
CREATE INDEX idx_oracle_custom_styles_priority ON oracle_custom_styles(config_id, priority DESC);

-- RLS for WHITE-LABEL module
ALTER TABLE oracle_white_label_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_theme_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_custom_styles ENABLE ROW LEVEL SECURITY;

-- Org owners/admins can manage white-label config
CREATE POLICY "Org admins manage white-label config" ON oracle_white_label_configs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM oracle_team_members tm
      JOIN oracle_teams t ON tm.team_id = t.id
      WHERE t.org_id = oracle_white_label_configs.org_id
        AND tm.user_id = auth.uid()
        AND tm.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Org admins manage theme variants" ON oracle_theme_variants
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM oracle_white_label_configs wlc
      JOIN oracle_team_members tm ON TRUE
      JOIN oracle_teams t ON tm.team_id = t.id
      WHERE wlc.id = oracle_theme_variants.config_id
        AND t.org_id = wlc.org_id
        AND tm.user_id = auth.uid()
        AND tm.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Org admins manage email templates" ON oracle_email_templates
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM oracle_white_label_configs wlc
      JOIN oracle_team_members tm ON TRUE
      JOIN oracle_teams t ON tm.team_id = t.id
      WHERE wlc.id = oracle_email_templates.config_id
        AND t.org_id = wlc.org_id
        AND tm.user_id = auth.uid()
        AND tm.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Org admins manage custom styles" ON oracle_custom_styles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM oracle_white_label_configs wlc
      JOIN oracle_team_members tm ON TRUE
      JOIN oracle_teams t ON tm.team_id = t.id
      WHERE wlc.id = oracle_custom_styles.config_id
        AND t.org_id = wlc.org_id
        AND tm.user_id = auth.uid()
        AND tm.role IN ('owner', 'admin')
    )
  );

-- Triggers for updated_at
CREATE TRIGGER update_oracle_white_label_configs_updated_at
  BEFORE UPDATE ON oracle_white_label_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_oracle_theme_variants_updated_at
  BEFORE UPDATE ON oracle_theme_variants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_oracle_email_templates_updated_at
  BEFORE UPDATE ON oracle_email_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- ORACLE PHASE 5: SUBSCRIPTION & BILLING
-- Stories sub-1 through sub-5
-- =====================================================

-- Subscription plans definition
CREATE TABLE oracle_subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Plan identity
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  plan_tier TEXT NOT NULL CHECK (plan_tier IN ('free', 'basic', 'pro', 'business', 'enterprise')),

  -- Pricing
  price_monthly DECIMAL(10,2) DEFAULT 0,
  price_yearly DECIMAL(10,2) DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  stripe_price_id_monthly TEXT,
  stripe_price_id_yearly TEXT,

  -- Limits
  max_users INTEGER DEFAULT 1,
  max_teams INTEGER DEFAULT 1,
  max_signals_per_day INTEGER DEFAULT 100,
  max_decisions_per_month INTEGER DEFAULT 50,
  max_ai_requests_per_day INTEGER DEFAULT 100,
  max_storage_mb INTEGER DEFAULT 500,
  max_integrations INTEGER DEFAULT 3,

  -- Features
  features_included JSONB DEFAULT '{
    "oracle": true,
    "analytics": false,
    "ai_tuning": false,
    "voice": false,
    "widgets": false,
    "export": false,
    "api_access": false,
    "sso": false,
    "audit_logs": false,
    "priority_support": false
  }',

  -- Display
  is_active BOOLEAN DEFAULT TRUE,
  is_featured BOOLEAN DEFAULT FALSE,
  display_order INTEGER DEFAULT 0,
  badge_text TEXT,

  -- Trial
  trial_days INTEGER DEFAULT 0,

  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User subscriptions
CREATE TABLE oracle_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id UUID REFERENCES oracle_organizations(id) ON DELETE SET NULL,
  plan_id UUID NOT NULL REFERENCES oracle_subscription_plans(id),

  -- Stripe integration
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT UNIQUE,

  -- Status
  status TEXT NOT NULL DEFAULT 'trialing' CHECK (status IN (
    'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused', 'incomplete'
  )),

  -- Billing cycle
  billing_cycle TEXT DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'yearly')),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,

  -- Trial
  trial_start TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,

  -- Cancellation
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  canceled_at TIMESTAMPTZ,
  cancellation_reason TEXT,

  -- Usage tracking
  usage_reset_at TIMESTAMPTZ DEFAULT NOW(),

  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Usage tracking
CREATE TABLE oracle_usage_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES oracle_subscriptions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Period
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,

  -- Usage metrics
  signals_count INTEGER DEFAULT 0,
  decisions_count INTEGER DEFAULT 0,
  ai_requests_count INTEGER DEFAULT 0,
  storage_used_mb DECIMAL(10,2) DEFAULT 0,
  team_members_count INTEGER DEFAULT 0,
  api_calls_count INTEGER DEFAULT 0,

  -- Derived metrics
  signals_limit INTEGER,
  decisions_limit INTEGER,
  ai_requests_limit INTEGER,
  storage_limit_mb INTEGER,

  -- Usage percentages
  signals_usage_percent DECIMAL(5,2) GENERATED ALWAYS AS (
    CASE WHEN signals_limit > 0 THEN (signals_count::DECIMAL / signals_limit * 100) ELSE 0 END
  ) STORED,

  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(subscription_id, period_start)
);

-- Invoices
CREATE TABLE oracle_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES oracle_subscriptions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Stripe
  stripe_invoice_id TEXT UNIQUE,
  stripe_payment_intent_id TEXT,

  -- Invoice details
  invoice_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'open', 'paid', 'void', 'uncollectible'
  )),

  -- Amounts
  subtotal DECIMAL(10,2) NOT NULL,
  tax DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) NOT NULL,
  amount_paid DECIMAL(10,2) DEFAULT 0,
  amount_due DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD',

  -- Dates
  invoice_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  due_date TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,

  -- Billing info
  billing_name TEXT,
  billing_email TEXT,
  billing_address JSONB,

  -- Line items
  line_items JSONB DEFAULT '[]',

  -- PDF
  pdf_url TEXT,
  hosted_invoice_url TEXT,

  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payment methods (tokenized)
CREATE TABLE oracle_payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Stripe
  stripe_payment_method_id TEXT UNIQUE NOT NULL,

  -- Card info (non-sensitive)
  type TEXT NOT NULL DEFAULT 'card' CHECK (type IN ('card', 'bank_account', 'paypal')),
  card_brand TEXT,
  card_last_four TEXT,
  card_exp_month INTEGER,
  card_exp_year INTEGER,

  -- Bank (if applicable)
  bank_name TEXT,
  bank_last_four TEXT,

  -- Status
  is_default BOOLEAN DEFAULT FALSE,
  is_valid BOOLEAN DEFAULT TRUE,

  billing_address JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Feature usage for metering
CREATE TABLE oracle_feature_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES oracle_subscriptions(id) ON DELETE SET NULL,

  -- Feature identification
  feature_key TEXT NOT NULL,
  feature_category TEXT NOT NULL CHECK (feature_category IN (
    'ai', 'storage', 'api', 'integration', 'team', 'export', 'analytics'
  )),

  -- Usage
  usage_count INTEGER DEFAULT 1,
  usage_unit TEXT DEFAULT 'count',
  usage_timestamp TIMESTAMPTZ DEFAULT NOW(),

  -- Context
  context JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Usage alerts
CREATE TABLE oracle_usage_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES oracle_subscriptions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Alert details
  alert_type TEXT NOT NULL CHECK (alert_type IN (
    'approaching_limit', 'limit_reached', 'limit_exceeded', 'trial_ending', 'payment_failed'
  )),
  feature_key TEXT,
  threshold_percent INTEGER,
  current_usage INTEGER,
  limit_value INTEGER,

  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'dismissed', 'resolved')),
  dismissed_at TIMESTAMPTZ,

  -- Notification
  notification_sent BOOLEAN DEFAULT FALSE,
  notification_sent_at TIMESTAMPTZ,

  message TEXT,
  action_url TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for SUBSCRIPTION module
CREATE INDEX idx_oracle_subscription_plans_tier ON oracle_subscription_plans(plan_tier);
CREATE INDEX idx_oracle_subscription_plans_active ON oracle_subscription_plans(is_active);
CREATE INDEX idx_oracle_subscription_plans_slug ON oracle_subscription_plans(slug);

CREATE INDEX idx_oracle_subscriptions_user_id ON oracle_subscriptions(user_id);
CREATE INDEX idx_oracle_subscriptions_org_id ON oracle_subscriptions(org_id);
CREATE INDEX idx_oracle_subscriptions_status ON oracle_subscriptions(status);
CREATE INDEX idx_oracle_subscriptions_stripe_id ON oracle_subscriptions(stripe_subscription_id);
CREATE INDEX idx_oracle_subscriptions_period_end ON oracle_subscriptions(current_period_end);

CREATE INDEX idx_oracle_usage_tracking_subscription ON oracle_usage_tracking(subscription_id);
CREATE INDEX idx_oracle_usage_tracking_period ON oracle_usage_tracking(period_start, period_end);

CREATE INDEX idx_oracle_invoices_subscription ON oracle_invoices(subscription_id);
CREATE INDEX idx_oracle_invoices_user ON oracle_invoices(user_id);
CREATE INDEX idx_oracle_invoices_status ON oracle_invoices(status);
CREATE INDEX idx_oracle_invoices_stripe ON oracle_invoices(stripe_invoice_id);

CREATE INDEX idx_oracle_payment_methods_user ON oracle_payment_methods(user_id);
CREATE INDEX idx_oracle_payment_methods_default ON oracle_payment_methods(user_id, is_default) WHERE is_default = TRUE;

CREATE INDEX idx_oracle_feature_usage_user ON oracle_feature_usage(user_id);
CREATE INDEX idx_oracle_feature_usage_subscription ON oracle_feature_usage(subscription_id);
CREATE INDEX idx_oracle_feature_usage_timestamp ON oracle_feature_usage(usage_timestamp DESC);
CREATE INDEX idx_oracle_feature_usage_key ON oracle_feature_usage(feature_key, usage_timestamp DESC);

CREATE INDEX idx_oracle_usage_alerts_subscription ON oracle_usage_alerts(subscription_id);
CREATE INDEX idx_oracle_usage_alerts_status ON oracle_usage_alerts(status) WHERE status = 'active';

-- RLS for SUBSCRIPTION module
ALTER TABLE oracle_subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_usage_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_feature_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_usage_alerts ENABLE ROW LEVEL SECURITY;

-- Plans are publicly readable
CREATE POLICY "Plans are publicly readable" ON oracle_subscription_plans
  FOR SELECT USING (is_active = TRUE);

CREATE POLICY "User owns their subscription" ON oracle_subscriptions
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "User sees their usage" ON oracle_usage_tracking
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "User sees their invoices" ON oracle_invoices
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "User manages their payment methods" ON oracle_payment_methods
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "User sees their feature usage" ON oracle_feature_usage
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "User sees their usage alerts" ON oracle_usage_alerts
  FOR ALL USING (auth.uid() = user_id);

-- Triggers for updated_at
CREATE TRIGGER update_oracle_subscription_plans_updated_at
  BEFORE UPDATE ON oracle_subscription_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_oracle_subscriptions_updated_at
  BEFORE UPDATE ON oracle_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_oracle_usage_tracking_updated_at
  BEFORE UPDATE ON oracle_usage_tracking
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_oracle_payment_methods_updated_at
  BEFORE UPDATE ON oracle_payment_methods
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default subscription plans
INSERT INTO oracle_subscription_plans (name, slug, plan_tier, price_monthly, price_yearly, description, max_users, max_teams, max_signals_per_day, max_decisions_per_month, max_ai_requests_per_day, max_storage_mb, trial_days, features_included, is_featured, display_order)
VALUES
  ('Free', 'free', 'free', 0, 0, 'Get started with ORACLE basics', 1, 1, 50, 20, 50, 100, 0,
   '{"oracle": true, "analytics": false, "ai_tuning": false, "voice": false, "widgets": false, "export": false, "api_access": false, "sso": false, "audit_logs": false, "priority_support": false}'::jsonb,
   false, 1),
  ('Pro', 'pro', 'pro', 19.99, 199.99, 'For individuals who need more power', 1, 3, 500, 100, 500, 5000, 14,
   '{"oracle": true, "analytics": true, "ai_tuning": true, "voice": true, "widgets": true, "export": true, "api_access": false, "sso": false, "audit_logs": false, "priority_support": false}'::jsonb,
   true, 2),
  ('Business', 'business', 'business', 49.99, 499.99, 'For teams and organizations', 10, 10, 2000, 500, 2000, 50000, 14,
   '{"oracle": true, "analytics": true, "ai_tuning": true, "voice": true, "widgets": true, "export": true, "api_access": true, "sso": false, "audit_logs": true, "priority_support": true}'::jsonb,
   false, 3),
  ('Enterprise', 'enterprise', 'enterprise', 199.99, 1999.99, 'For large organizations with advanced needs', -1, -1, -1, -1, -1, -1, 30,
   '{"oracle": true, "analytics": true, "ai_tuning": true, "voice": true, "widgets": true, "export": true, "api_access": true, "sso": true, "audit_logs": true, "priority_support": true}'::jsonb,
   false, 4)
ON CONFLICT (slug) DO NOTHING;

-- =====================================================
-- ORACLE PHASE 5: ENTERPRISE FEATURES
-- Stories ent-1 through ent-6
-- =====================================================

-- SSO/SAML Configuration per organization
CREATE TABLE oracle_sso_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES oracle_organizations(id) ON DELETE CASCADE,

  -- SSO Type
  provider_type TEXT NOT NULL CHECK (provider_type IN ('saml', 'oidc', 'google', 'microsoft', 'okta')),
  is_enabled BOOLEAN DEFAULT FALSE,

  -- SAML Configuration
  saml_entity_id TEXT,
  saml_sso_url TEXT,
  saml_slo_url TEXT,
  saml_certificate TEXT,
  saml_private_key TEXT,
  saml_metadata_url TEXT,

  -- OIDC Configuration
  oidc_client_id TEXT,
  oidc_client_secret TEXT,
  oidc_issuer_url TEXT,
  oidc_authorization_url TEXT,
  oidc_token_url TEXT,
  oidc_userinfo_url TEXT,
  oidc_scopes TEXT[] DEFAULT ARRAY['openid', 'profile', 'email'],

  -- User provisioning
  jit_provisioning_enabled BOOLEAN DEFAULT TRUE,
  default_role TEXT DEFAULT 'member',
  auto_create_team BOOLEAN DEFAULT FALSE,

  -- Enforcement
  sso_only_mode BOOLEAN DEFAULT FALSE,
  allowed_domains TEXT[] DEFAULT ARRAY[]::TEXT[],

  -- SCIM
  scim_enabled BOOLEAN DEFAULT FALSE,
  scim_token TEXT,
  scim_base_url TEXT,

  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(org_id)
);

-- API Keys for enterprise integrations
CREATE TABLE oracle_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES oracle_organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Key info
  name TEXT NOT NULL,
  description TEXT,
  key_prefix TEXT NOT NULL, -- First 8 chars for identification
  key_hash TEXT NOT NULL, -- Hashed key for verification

  -- Scopes
  scopes TEXT[] NOT NULL DEFAULT ARRAY['read'],
  allowed_endpoints TEXT[] DEFAULT ARRAY[]::TEXT[],

  -- Rate limiting
  rate_limit_per_minute INTEGER DEFAULT 60,
  rate_limit_per_day INTEGER DEFAULT 10000,

  -- Tracking
  last_used_at TIMESTAMPTZ,
  usage_count INTEGER DEFAULT 0,
  last_ip_address TEXT,

  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES users(id),
  revoke_reason TEXT,

  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- API Key usage tracking
CREATE TABLE oracle_api_key_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID NOT NULL REFERENCES oracle_api_keys(id) ON DELETE CASCADE,

  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INTEGER,
  response_time_ms INTEGER,
  ip_address TEXT,
  user_agent TEXT,

  request_size_bytes INTEGER,
  response_size_bytes INTEGER,

  error_message TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Data retention policies
CREATE TABLE oracle_retention_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES oracle_organizations(id) ON DELETE CASCADE,

  -- Data type
  data_type TEXT NOT NULL CHECK (data_type IN (
    'signals', 'decisions', 'predictions', 'analytics', 'audit_logs',
    'chat_history', 'documents', 'exports', 'all'
  )),

  -- Retention
  retention_days INTEGER NOT NULL DEFAULT 365,
  archive_before_delete BOOLEAN DEFAULT TRUE,
  archive_location TEXT,

  -- Legal hold
  legal_hold_enabled BOOLEAN DEFAULT FALSE,
  legal_hold_reason TEXT,
  legal_hold_until TIMESTAMPTZ,

  -- Export
  export_before_delete BOOLEAN DEFAULT FALSE,
  export_format TEXT DEFAULT 'json',
  notify_before_deletion_days INTEGER DEFAULT 7,

  is_active BOOLEAN DEFAULT TRUE,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(org_id, data_type)
);

-- Archived data references
CREATE TABLE oracle_archived_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES oracle_organizations(id) ON DELETE CASCADE,
  policy_id UUID REFERENCES oracle_retention_policies(id) ON DELETE SET NULL,

  data_type TEXT NOT NULL,
  original_table TEXT NOT NULL,
  record_count INTEGER NOT NULL,
  date_range_start TIMESTAMPTZ NOT NULL,
  date_range_end TIMESTAMPTZ NOT NULL,

  archive_url TEXT NOT NULL,
  archive_size_bytes BIGINT,
  checksum TEXT,

  restored_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Compliance reports
CREATE TABLE oracle_compliance_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES oracle_organizations(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES users(id),

  -- Report type
  report_type TEXT NOT NULL CHECK (report_type IN (
    'soc2_readiness', 'gdpr_inventory', 'access_audit', 'data_processing',
    'security_assessment', 'user_activity', 'data_export'
  )),

  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'generating', 'completed', 'failed'
  )),

  -- Configuration
  date_range_start TIMESTAMPTZ,
  date_range_end TIMESTAMPTZ,
  include_sections TEXT[] DEFAULT ARRAY[]::TEXT[],
  filters JSONB DEFAULT '{}',

  -- Output
  report_url TEXT,
  report_size_bytes BIGINT,
  generated_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,

  -- Scheduling
  is_scheduled BOOLEAN DEFAULT FALSE,
  schedule_cron TEXT,
  next_scheduled_at TIMESTAMPTZ,

  error_message TEXT,
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- ORACLE PHASE 5: ADVANCED AI FEATURES
-- Stories adv-ai-1 through adv-ai-6
-- =====================================================

-- Knowledge base collections
CREATE TABLE oracle_knowledge_bases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES oracle_organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  description TEXT,

  -- Configuration
  embedding_model TEXT DEFAULT 'text-embedding-3-small',
  chunk_size INTEGER DEFAULT 512,
  chunk_overlap INTEGER DEFAULT 50,

  -- Stats
  document_count INTEGER DEFAULT 0,
  total_chunks INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,

  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Knowledge documents
CREATE TABLE oracle_knowledge_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_base_id UUID NOT NULL REFERENCES oracle_knowledge_bases(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Document info
  title TEXT NOT NULL,
  file_name TEXT,
  file_type TEXT CHECK (file_type IN ('pdf', 'docx', 'txt', 'md', 'html', 'url')),
  file_size_bytes INTEGER,
  file_url TEXT,

  -- Source
  source_url TEXT,
  source_type TEXT DEFAULT 'upload' CHECK (source_type IN ('upload', 'url', 'api', 'integration')),

  -- Processing
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'processing', 'completed', 'failed'
  )),
  processing_started_at TIMESTAMPTZ,
  processing_completed_at TIMESTAMPTZ,
  error_message TEXT,

  -- Stats
  chunk_count INTEGER DEFAULT 0,
  token_count INTEGER DEFAULT 0,

  -- Content
  raw_content TEXT,
  extracted_metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Document chunks with embeddings
CREATE TABLE oracle_knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES oracle_knowledge_documents(id) ON DELETE CASCADE,
  knowledge_base_id UUID NOT NULL REFERENCES oracle_knowledge_bases(id) ON DELETE CASCADE,

  -- Chunk content
  content TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  token_count INTEGER,

  -- Position in original document
  start_char INTEGER,
  end_char INTEGER,
  page_number INTEGER,

  -- Embedding (using pgvector)
  embedding vector(1536),

  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI Agents
CREATE TABLE oracle_ai_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES oracle_organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Agent info
  name TEXT NOT NULL,
  description TEXT,
  agent_type TEXT NOT NULL CHECK (agent_type IN (
    'scheduler', 'researcher', 'communicator', 'analyst', 'custom'
  )),

  -- Configuration
  system_prompt TEXT,
  tools TEXT[] DEFAULT ARRAY[]::TEXT[],
  model TEXT DEFAULT 'gemini-pro',
  temperature DECIMAL(2,1) DEFAULT 0.7,
  max_tokens INTEGER DEFAULT 2048,

  -- Knowledge base integration
  knowledge_base_ids UUID[] DEFAULT ARRAY[]::UUID[],

  -- Capabilities
  can_access_calendar BOOLEAN DEFAULT FALSE,
  can_send_emails BOOLEAN DEFAULT FALSE,
  can_web_search BOOLEAN DEFAULT FALSE,
  can_execute_code BOOLEAN DEFAULT FALSE,

  -- Limits
  max_iterations INTEGER DEFAULT 10,
  timeout_seconds INTEGER DEFAULT 300,

  -- Stats
  execution_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  avg_execution_time_ms INTEGER,

  is_public BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent execution runs
CREATE TABLE oracle_agent_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES oracle_ai_agents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Input
  input_prompt TEXT NOT NULL,
  input_context JSONB DEFAULT '{}',

  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'running', 'completed', 'failed', 'cancelled', 'timeout'
  )),

  -- Output
  output_result JSONB,
  output_text TEXT,

  -- Execution details
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  execution_time_ms INTEGER,
  iterations_used INTEGER,
  tokens_used INTEGER,

  -- Steps
  execution_steps JSONB DEFAULT '[]',

  -- Errors
  error_message TEXT,
  error_code TEXT,

  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent pipelines for orchestration
CREATE TABLE oracle_agent_pipelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES oracle_organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  description TEXT,

  -- Pipeline definition
  stages JSONB NOT NULL DEFAULT '[]', -- Array of stage definitions
  execution_mode TEXT DEFAULT 'sequential' CHECK (execution_mode IN ('sequential', 'parallel', 'conditional')),

  -- Inter-agent communication
  shared_context_enabled BOOLEAN DEFAULT TRUE,
  result_aggregation TEXT DEFAULT 'merge' CHECK (result_aggregation IN ('merge', 'last', 'all', 'custom')),

  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for ENTERPRISE module
CREATE INDEX idx_oracle_sso_configs_org_id ON oracle_sso_configs(org_id);
CREATE INDEX idx_oracle_api_keys_org_id ON oracle_api_keys(org_id);
CREATE INDEX idx_oracle_api_keys_user_id ON oracle_api_keys(user_id);
CREATE INDEX idx_oracle_api_keys_prefix ON oracle_api_keys(key_prefix);
CREATE INDEX idx_oracle_api_keys_active ON oracle_api_keys(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_oracle_api_key_usage_key ON oracle_api_key_usage(api_key_id, created_at DESC);

CREATE INDEX idx_oracle_retention_policies_org ON oracle_retention_policies(org_id);
CREATE INDEX idx_oracle_archived_data_org ON oracle_archived_data(org_id);
CREATE INDEX idx_oracle_compliance_reports_org ON oracle_compliance_reports(org_id);
CREATE INDEX idx_oracle_compliance_reports_status ON oracle_compliance_reports(status);

-- Indexes for ADVANCED AI module
CREATE INDEX idx_oracle_knowledge_bases_org ON oracle_knowledge_bases(org_id);
CREATE INDEX idx_oracle_knowledge_bases_user ON oracle_knowledge_bases(user_id);
CREATE INDEX idx_oracle_knowledge_documents_kb ON oracle_knowledge_documents(knowledge_base_id);
CREATE INDEX idx_oracle_knowledge_documents_status ON oracle_knowledge_documents(status);
CREATE INDEX idx_oracle_knowledge_chunks_doc ON oracle_knowledge_chunks(document_id);
CREATE INDEX idx_oracle_knowledge_chunks_kb ON oracle_knowledge_chunks(knowledge_base_id);

-- Vector similarity search index (requires pgvector)
-- CREATE INDEX idx_oracle_knowledge_chunks_embedding ON oracle_knowledge_chunks USING ivfflat (embedding vector_cosine_ops);

CREATE INDEX idx_oracle_ai_agents_org ON oracle_ai_agents(org_id);
CREATE INDEX idx_oracle_ai_agents_user ON oracle_ai_agents(user_id);
CREATE INDEX idx_oracle_ai_agents_type ON oracle_ai_agents(agent_type);
CREATE INDEX idx_oracle_agent_executions_agent ON oracle_agent_executions(agent_id);
CREATE INDEX idx_oracle_agent_executions_user ON oracle_agent_executions(user_id);
CREATE INDEX idx_oracle_agent_executions_status ON oracle_agent_executions(status);
CREATE INDEX idx_oracle_agent_pipelines_org ON oracle_agent_pipelines(org_id);

-- RLS for ENTERPRISE and ADVANCED AI modules
ALTER TABLE oracle_sso_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_api_key_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_retention_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_archived_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_compliance_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_knowledge_bases ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_knowledge_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_knowledge_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_ai_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_agent_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE oracle_agent_pipelines ENABLE ROW LEVEL SECURITY;

-- Policies for enterprise features (org admins only)
CREATE POLICY "Org admins manage SSO" ON oracle_sso_configs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM oracle_team_members tm
      JOIN oracle_teams t ON tm.team_id = t.id
      WHERE t.org_id = oracle_sso_configs.org_id
        AND tm.user_id = auth.uid()
        AND tm.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "User manages their API keys" ON oracle_api_keys
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "User sees their API usage" ON oracle_api_key_usage
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM oracle_api_keys k
      WHERE k.id = oracle_api_key_usage.api_key_id
        AND k.user_id = auth.uid()
    )
  );

CREATE POLICY "Org admins manage retention" ON oracle_retention_policies
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM oracle_team_members tm
      JOIN oracle_teams t ON tm.team_id = t.id
      WHERE t.org_id = oracle_retention_policies.org_id
        AND tm.user_id = auth.uid()
        AND tm.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "User manages knowledge bases" ON oracle_knowledge_bases
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "User manages knowledge docs" ON oracle_knowledge_documents
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "User sees knowledge chunks" ON oracle_knowledge_chunks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM oracle_knowledge_documents d
      WHERE d.id = oracle_knowledge_chunks.document_id
        AND d.user_id = auth.uid()
    )
  );

CREATE POLICY "User manages AI agents" ON oracle_ai_agents
  FOR ALL USING (auth.uid() = user_id OR is_public = TRUE);

CREATE POLICY "User sees agent executions" ON oracle_agent_executions
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "User manages agent pipelines" ON oracle_agent_pipelines
  FOR ALL USING (auth.uid() = user_id);

-- Triggers for updated_at
CREATE TRIGGER update_oracle_sso_configs_updated_at
  BEFORE UPDATE ON oracle_sso_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_oracle_api_keys_updated_at
  BEFORE UPDATE ON oracle_api_keys
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_oracle_retention_policies_updated_at
  BEFORE UPDATE ON oracle_retention_policies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_oracle_compliance_reports_updated_at
  BEFORE UPDATE ON oracle_compliance_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_oracle_knowledge_bases_updated_at
  BEFORE UPDATE ON oracle_knowledge_bases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_oracle_knowledge_documents_updated_at
  BEFORE UPDATE ON oracle_knowledge_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_oracle_ai_agents_updated_at
  BEFORE UPDATE ON oracle_ai_agents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_oracle_agent_pipelines_updated_at
  BEFORE UPDATE ON oracle_agent_pipelines
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- PERFORMANCE OPTIMIZATION INDEXES (Added for efficiency)
-- =====================================================

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_oracle_signals_user_urgency_created
ON oracle_signals(user_id, urgency DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_oracle_signals_user_confidence
ON oracle_signals(user_id, confidence DESC);

CREATE INDEX IF NOT EXISTS idx_oracle_execution_plans_user_status_created
ON oracle_execution_plans(user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_oracle_predictions_user_valid_until
ON oracle_predictions(user_id, valid_until);

CREATE INDEX IF NOT EXISTS idx_oracle_decisions_user_status_created
ON oracle_decisions(user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_oracle_decision_votes_decision_user
ON oracle_decision_votes(decision_id, user_id);

CREATE INDEX IF NOT EXISTS idx_oracle_webhook_deliveries_status_created
ON oracle_webhook_deliveries(status, created_at);

CREATE INDEX IF NOT EXISTS idx_oracle_user_engagement_session
ON oracle_user_engagement(session_id, user_id);

-- JSONB GIN indexes for filtered queries
CREATE INDEX IF NOT EXISTS idx_oracle_anomaly_patterns_rules_gin
ON oracle_anomaly_patterns USING GIN(detection_rules);

CREATE INDEX IF NOT EXISTS idx_oracle_ghost_actions_conditions_gin
ON oracle_ghost_actions USING GIN(trigger_conditions);

CREATE INDEX IF NOT EXISTS idx_oracle_context_nodes_properties_gin
ON oracle_context_nodes USING GIN(properties);

-- Partial indexes for active records
CREATE INDEX IF NOT EXISTS idx_oracle_signals_active
ON oracle_signals(user_id, created_at DESC)
WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_oracle_decisions_pending
ON oracle_decisions(user_id, created_at DESC)
WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_oracle_execution_plans_active
ON oracle_execution_plans(user_id, created_at DESC)
WHERE status = 'active';