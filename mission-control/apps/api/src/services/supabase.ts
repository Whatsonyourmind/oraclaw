import { createClient, SupabaseClient } from '@supabase/supabase-js';

// FREE TIER: Supabase
// Limits: 500MB database, 50MB storage, 2GB bandwidth/month
export class SupabaseService {
  private supabase: SupabaseClient;
  private supabaseAdmin: SupabaseClient;

  constructor() {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
      throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY required');
    }

    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      this.supabaseAdmin = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );
    } else {
      this.supabaseAdmin = this.supabase;
    }
  }

  // User management
  async createUser(userData: { email: string }) {
    const { data, error } = await this.supabaseAdmin
      .from('users')
      .insert([{ ...userData, subscription_tier: 'free' }])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getUser(userId: string) {
    const { data, error } = await this.supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) throw error;
    return data;
  }

  // Missions
  async createMission(missionData: {
    user_id: string;
    title: string;
    priority: 'low' | 'medium' | 'high';
    metadata?: Record<string, any>;
  }) {
    const { data, error } = await this.supabase
      .from('missions')
      .insert([missionData])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getMissions(userId: string, status?: string) {
    let query = this.supabase
      .from('missions')
      .select('*')
      .eq('user_id', userId);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  }

  // Sources (files)
  async createSource(sourceData: {
    mission_id: string;
    type: 'image' | 'pdf' | 'audio' | 'text';
    file_path: string;
  }) {
    const { data, error } = await this.supabase
      .from('sources')
      .insert([sourceData])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getSource(sourceId: string) {
    const { data, error } = await this.supabase
      .from('sources')
      .select('*')
      .eq('id', sourceId)
      .single();

    if (error) throw error;
    return data;
  }

  // Extracts (AI results)
  async createExtract(extractData: {
    source_id: string;
    data_type: string;
    confidence: number;
    structured_data: Record<string, any>;
  }) {
    const { data, error } = await this.supabase
      .from('extracts')
      .insert([extractData])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getExtracts(sourceId: string) {
    const { data, error } = await this.supabase
      .from('extracts')
      .select('*')
      .eq('source_id', sourceId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  // Actions
  async createActions(actionData: {
    mission_id: string;
    source_id?: string;
    type: string;
    title: string;
    description?: string;
    due_date?: string;
    metadata?: Record<string, any>;
  }[]) {
    const { data, error } = await this.supabase
      .from('actions')
      .insert(actionData)
      .select();

    if (error) throw error;
    return data;
  }

  async getActions(missionId: string, status?: string) {
    let query = this.supabase
      .from('actions')
      .select('*')
      .eq('mission_id', missionId);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  }

  // Briefings
  async saveBriefing(briefingData: {
    user_id: string;
    date: string;
    summary: string;
    priorities: any[];
    time_windows: any[];
    recommended_actions: any[];
  }) {
    const { data, error } = await this.supabase
      .from('briefings')
      .insert([briefingData])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getBriefings(userId: string, limit: number = 7) {
    const { data, error } = await this.supabase
      .from('briefings')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data;
  }

  // Meetings
  async saveMeeting(meetingData: {
    user_id: string;
    title?: string;
    transcript?: string;
    decisions: any[];
    follow_ups: any[];
  }) {
    const { data, error } = await this.supabase
      .from('meetings')
      .insert([meetingData])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // File storage (50MB free tier limit)
  async uploadFile(userId: string, file: Buffer, fileName: string) {
    const filePath = `${userId}/${Date.now()}-${fileName}`;
    
    const { data, error } = await this.supabaseAdmin.storage
      .from('mission-files')
      .upload(filePath, file, {
        contentType: 'application/octet-stream',
        upsert: false
      });

    if (error) throw error;
    return data;
  }

  async getFileUrl(filePath: string) {
    const { data } = this.supabaseAdmin.storage
      .from('mission-files')
      .getPublicUrl(filePath);

    return data.publicUrl;
  }

  // Analytics tracking (free tier friendly)
  async trackEvent(userId: string, eventType: string, properties: Record<string, any>) {
    const { error } = await this.supabase
      .from('events')
      .insert([{
        user_id: userId,
        event_type: eventType,
        properties,
        timestamp: new Date().toISOString()
      }]);

    if (error) console.error('Failed to track event:', error);
  }

  get client() {
    return this.supabase;
  }

  get admin() {
    return this.supabaseAdmin;
  }

  // ==========================================
  // ORACLE - Signal CRUD Methods (Story 8.1)
  // ==========================================

  async createSignal(signalData: {
    user_id: string;
    signal_type: string;
    source?: string;
    title: string;
    description?: string;
    urgency: 'low' | 'medium' | 'high' | 'critical';
    impact: 'low' | 'medium' | 'high';
    confidence: number;
    metadata?: Record<string, any>;
  }) {
    const { data, error } = await this.supabase
      .from('oracle_signals')
      .insert([signalData])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getSignals(userId: string, filters?: {
    status?: string;
    signal_type?: string;
    urgency?: string;
    limit?: number;
  }) {
    let query = this.supabase
      .from('oracle_signals')
      .select('*')
      .eq('user_id', userId);

    if (filters?.status) query = query.eq('status', filters.status);
    if (filters?.signal_type) query = query.eq('signal_type', filters.signal_type);
    if (filters?.urgency) query = query.eq('urgency', filters.urgency);

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(filters?.limit || 50);

    if (error) throw error;
    return data;
  }

  async updateSignal(signalId: string, updates: {
    status?: string;
    urgency?: string;
    impact?: string;
    metadata?: Record<string, any>;
  }) {
    const { data, error } = await this.supabase
      .from('oracle_signals')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', signalId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteSignal(signalId: string) {
    const { error } = await this.supabase
      .from('oracle_signals')
      .delete()
      .eq('id', signalId);

    if (error) throw error;
  }

  // ==========================================
  // ORACLE - Context CRUD Methods (Story post-6)
  // ==========================================

  async createContext(contextData: {
    user_id: string;
    situation_summary: string;
    key_factors?: any[];
    recommendations?: any[];
    constraints?: any[];
    assumptions?: any[];
    confidence?: number;
    valid_until?: string;
    metadata?: Record<string, any>;
  }) {
    const { data, error } = await this.supabase
      .from('oracle_contexts')
      .insert([{ ...contextData, is_active: true }])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getContexts(userId: string, filters?: {
    is_active?: boolean;
    limit?: number;
  }) {
    let query = this.supabase
      .from('oracle_contexts')
      .select('*')
      .eq('user_id', userId);

    if (filters?.is_active !== undefined) query = query.eq('is_active', filters.is_active);

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(filters?.limit || 20);

    if (error) throw error;
    return data;
  }

  async getActiveContext(userId: string) {
    const { data, error } = await this.supabase
      .from('oracle_contexts')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
    return data;
  }

  async updateContext(contextId: string, updates: {
    situation_summary?: string;
    key_factors?: any[];
    recommendations?: any[];
    is_active?: boolean;
    confidence?: number;
    metadata?: Record<string, any>;
  }) {
    const { data, error } = await this.supabase
      .from('oracle_contexts')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', contextId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // ==========================================
  // ORACLE - Decision CRUD Methods (Story 8.1)
  // ==========================================

  async createDecision(decisionData: {
    user_id: string;
    context_id?: string;
    title: string;
    description?: string;
    context?: string;
    deadline?: string;
    metadata?: Record<string, any>;
  }) {
    const { data, error } = await this.supabase
      .from('oracle_decisions')
      .insert([{ ...decisionData, status: 'pending' }])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getDecisions(userId: string, filters?: {
    status?: string;
    limit?: number;
  }) {
    let query = this.supabase
      .from('oracle_decisions')
      .select('*')
      .eq('user_id', userId);

    if (filters?.status) query = query.eq('status', filters.status);

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(filters?.limit || 20);

    if (error) throw error;
    return data;
  }

  async updateDecision(decisionId: string, updates: {
    status?: string;
    selected_option_id?: string;
    rationale?: string;
    metadata?: Record<string, any>;
  }) {
    const { data, error } = await this.supabase
      .from('oracle_decisions')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', decisionId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getDecisionOptions(decisionId: string) {
    const { data, error } = await this.supabase
      .from('oracle_decision_options')
      .select('*')
      .eq('decision_id', decisionId)
      .order('score', { ascending: false });

    if (error) throw error;
    return data;
  }

  // ==========================================
  // ORACLE - Execution Plan CRUD (Story 8.1)
  // ==========================================

  async createExecutionPlan(planData: {
    user_id: string;
    decision_id?: string;
    title: string;
    description?: string;
    steps?: any[];
    metadata?: Record<string, any>;
  }) {
    const { data, error } = await this.supabase
      .from('oracle_execution_plans')
      .insert([{ ...planData, status: 'draft' }])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getExecutionPlans(userId: string, filters?: {
    status?: string;
    limit?: number;
  }) {
    let query = this.supabase
      .from('oracle_execution_plans')
      .select('*')
      .eq('user_id', userId);

    if (filters?.status) query = query.eq('status', filters.status);

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(filters?.limit || 10);

    if (error) throw error;
    return data;
  }

  async getExecutionSteps(planId: string) {
    const { data, error } = await this.supabase
      .from('oracle_execution_steps')
      .select('*')
      .eq('plan_id', planId)
      .order('order_index', { ascending: true });

    if (error) throw error;
    return data;
  }

  async updateExecutionStep(stepId: string, updates: {
    status?: string;
    actual_duration?: string;
    blocker_description?: string;
    metadata?: Record<string, any>;
  }) {
    const { data, error } = await this.supabase
      .from('oracle_execution_steps')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', stepId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // ==========================================
  // ORACLE - Prediction & Outcome (Story 8.1)
  // ==========================================

  async createPrediction(predictionData: {
    user_id: string;
    subject_type: string;
    subject_id: string;
    prediction_type: string;
    predicted_outcome: any;
    confidence: number;
    factors?: any;
    decay_rate?: number;
    metadata?: Record<string, any>;
  }) {
    const { data, error } = await this.supabase
      .from('oracle_predictions')
      .insert([predictionData])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getPredictions(userId: string, filters?: {
    subject_type?: string;
    subject_id?: string;
    limit?: number;
  }) {
    let query = this.supabase
      .from('oracle_predictions')
      .select('*')
      .eq('user_id', userId);

    if (filters?.subject_type) query = query.eq('subject_type', filters.subject_type);
    if (filters?.subject_id) query = query.eq('subject_id', filters.subject_id);

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(filters?.limit || 50);

    if (error) throw error;
    return data;
  }

  async recordOutcome(outcomeData: {
    prediction_id: string;
    actual_outcome: any;
    was_correct: boolean;
    accuracy_score?: number;
    metadata?: Record<string, any>;
  }) {
    const { data, error } = await this.supabase
      .from('oracle_outcomes')
      .insert([outcomeData])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getCalibration(userId: string) {
    const { data, error } = await this.supabase
      .from('oracle_calibration')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
    return data;
  }

  // ==========================================
  // ORACLE - Context Graph Methods (Story 8.1)
  // ==========================================

  async getContextNodes(userId: string, filters?: {
    node_type?: string;
    limit?: number;
  }) {
    let query = this.supabase
      .from('oracle_context_nodes')
      .select('*')
      .eq('user_id', userId);

    if (filters?.node_type) query = query.eq('node_type', filters.node_type);

    const { data, error } = await query
      .order('access_count', { ascending: false })
      .limit(filters?.limit || 100);

    if (error) throw error;
    return data;
  }

  async getContextEdges(userId: string, nodeId?: string) {
    let query = this.supabase
      .from('oracle_context_edges')
      .select('*')
      .eq('user_id', userId);

    if (nodeId) {
      query = query.or(`source_node_id.eq.${nodeId},target_node_id.eq.${nodeId}`);
    }

    const { data, error } = await query.order('strength', { ascending: false });

    if (error) throw error;
    return data;
  }

  async createContextNode(nodeData: {
    user_id: string;
    node_type: string;
    entity_id?: string;
    name: string;
    properties?: Record<string, any>;
  }) {
    const { data, error } = await this.supabase
      .from('oracle_context_nodes')
      .insert([nodeData])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async createContextEdge(edgeData: {
    user_id: string;
    source_node_id: string;
    target_node_id: string;
    edge_type: string;
    strength: number;
    direction?: string;
    evidence?: string[];
  }) {
    const { data, error } = await this.supabase
      .from('oracle_context_edges')
      .insert([edgeData])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // ==========================================
  // ORACLE - Ghost Actions (Story 8.1)
  // ==========================================

  async getGhostActions(userId: string, filters?: {
    status?: string;
    action_type?: string;
    limit?: number;
  }) {
    let query = this.supabase
      .from('oracle_ghost_actions')
      .select('*')
      .eq('user_id', userId);

    if (filters?.status) query = query.eq('status', filters.status);
    if (filters?.action_type) query = query.eq('action_type', filters.action_type);

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(filters?.limit || 20);

    if (error) throw error;
    return data;
  }

  async updateGhostAction(actionId: string, updates: {
    status?: string;
    approved_at?: string;
    executed_at?: string;
    metadata?: Record<string, any>;
  }) {
    const { data, error } = await this.supabase
      .from('oracle_ghost_actions')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', actionId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async createGhostAction(actionData: {
    user_id: string;
    action_type: string;
    title: string;
    description?: string;
    draft_action: Record<string, any>;
    trigger_conditions?: Record<string, any>;
    auto_trigger_enabled?: boolean;
    auto_trigger_at?: string;
    confidence?: number;
    rationale?: string;
    expires_at?: string;
    related_signals?: any[];
    metadata?: Record<string, any>;
  }) {
    const { data, error } = await this.supabase
      .from('oracle_ghost_actions')
      .insert([{ ...actionData, status: 'pending' }])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async approveGhostAction(actionId: string, userId: string) {
    const { data, error } = await this.supabase
      .from('oracle_ghost_actions')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', actionId)
      .eq('user_id', userId)
      .eq('status', 'pending')
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // ==========================================
  // ORACLE - Plan Step Update (Story post-6)
  // ==========================================

  async updatePlanStep(planId: string, stepId: string, updates: {
    status?: string;
    notes?: string;
    blockers?: any[];
    actual_duration_minutes?: number;
    completed_at?: string;
    started_at?: string;
    metadata?: Record<string, any>;
  }) {
    const { data, error } = await this.supabase
      .from('oracle_execution_steps')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', stepId)
      .eq('plan_id', planId)
      .select()
      .single();

    if (error) throw error;

    // Update plan progress
    await this.recalculatePlanProgress(planId);

    return data;
  }

  async recalculatePlanProgress(planId: string) {
    const steps = await this.getExecutionSteps(planId);
    const totalSteps = steps.length;
    const completedSteps = steps.filter((s: any) => s.status === 'completed').length;
    const blockedSteps = steps.filter((s: any) => s.status === 'blocked').length;
    const progressPercentage = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

    const healthScore = Math.max(0, 1 - (blockedSteps / totalSteps) * 0.5);

    await this.supabase
      .from('oracle_execution_plans')
      .update({
        total_steps: totalSteps,
        completed_steps: completedSteps,
        blocked_steps: blockedSteps,
        progress_percentage: progressPercentage,
        health_score: healthScore,
        updated_at: new Date().toISOString()
      })
      .eq('id', planId);
  }
}

export const supabaseService = new SupabaseService();