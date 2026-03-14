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
