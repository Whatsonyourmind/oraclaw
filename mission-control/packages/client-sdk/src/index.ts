// API Client for Mission Control Mobile App
// FREE TIER OPTIMIZED

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  needs_user_confirmation?: boolean;
  confidence?: number;
}

class MissionControlAPI {
  private baseURL: string;
  private retryCount: number = 3;
  private requestTimeout: number = 15000; // 15s timeout for free tier

  constructor() {
    this.baseURL = API_BASE_URL;
  }

  private async request<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<APIResponse<T>> {
    const url = `${this.baseURL}${endpoint}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.requestTimeout);

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 429) {
          // Rate limited - wait and retry
          await new Promise(resolve => setTimeout(resolve, 2000));
          return this.request(endpoint, options); // Retry once
        }
        
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          return { success: false, error: 'Request timeout - please try again' };
        }
        return { success: false, error: error.message };
      }
      
      return { success: false, error: 'Unknown error occurred' };
    }
  }

  // Upload file with progress tracking
  async uploadSource(
    file: {
      uri: string;
      name: string;
      type: string;
    },
    missionId: string
  ): Promise<APIResponse<{ source_id: string }>> {
    try {
      const formData = new FormData();
      
      // For Expo, we need to handle file differently
      formData.append('file', {
        uri: file.uri,
        name: file.name,
        type: file.type,
      } as any);
      
      formData.append('mission_id', missionId);
      formData.append('type', this.getFileType(file.type));

      const response = await fetch(`${this.baseURL}/api/sources`, {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Upload failed' 
      };
    }
  }

  // Extract intelligence from source
  async extractIntel(
    sourceId: string, 
    extractionTypes: string[] = ['fields', 'risks']
  ): Promise<APIResponse<{
    overlays: Array<{
      x: number;
      y: number;
      width: number;
      height: number;
      text: string;
      confidence: number;
      type: 'field' | 'risk' | 'entity';
    }>;
    structured: {
      fields: Record<string, any>;
      entities: Array<any>;
      risks: Array<any>;
    };
    actions: Array<{
      type: string;
      confidence: number;
      description: string;
    }>;
    confidence: number;
  }>> {
    return this.request(`/api/sources/${sourceId}/extract`, {
      method: 'POST',
      body: JSON.stringify({ extraction_types: extractionTypes }),
    });
  }

  // Create actions from extracted intel
  async createActions(
    missionId: string,
    sourceId: string,
    actions: Array<{
      type: string;
      title: string;
      description?: string;
      metadata?: Record<string, any>;
    }>
  ): Promise<APIResponse<Array<{ id: string; status: string }>>> {
    return this.request('/api/actions', {
      method: 'POST',
      body: JSON.stringify({
        mission_id: missionId,
        source_id: sourceId,
        actions,
      }),
    });
  }

  // Generate daily briefing
  async generateBriefing(
    priorities: string[] = ['urgent', 'important', 'meetings']
  ): Promise<APIResponse<{
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
    delegation_opportunities: Array<{
      task: string;
      to_who: string;
      confidence: number;
    }>;
  }>> {
    return this.request('/api/briefing', {
      method: 'POST',
      body: JSON.stringify({
        priorities,
        date_range: {
          start: new Date().toISOString(),
          end: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
        },
      }),
    });
  }

  // Analyze meeting transcript
  async analyzeMeeting(
    transcript: string,
    title?: string
  ): Promise<APIResponse<{
    summary: string;
    decisions: Array<{
      description: string;
      owner?: string;
      deadline?: string;
      confidence: number;
    }>;
    risks: Array<{
      description: string;
      mitigation: string;
      confidence: number;
    }>;
    follow_ups: Array<{
      type: 'email' | 'task' | 'reminder';
      recipient?: string;
      content: string;
      confidence: number;
    }>;
    confidence: number;
    meeting_id: string;
  }>> {
    return this.request('/api/meetings/analyze', {
      method: 'POST',
      body: JSON.stringify({ transcript, title }),
    });
  }

  // Get user's missions
  async getMissions(
    userId: string, 
    status?: string
  ): Promise<APIResponse<Array<{
    id: string;
    title: string;
    priority: 'low' | 'medium' | 'high';
    status: 'active' | 'completed' | 'archived';
    created_at: string;
    metadata: Record<string, any>;
  }>>> {
    const params = new URLSearchParams({ user_id: userId });
    if (status) params.append('status', status);
    
    return this.request(`/api/missions?${params}`);
  }

  // Get actions for mission
  async getActions(
    missionId: string,
    status?: string
  ): Promise<APIResponse<Array<{
    id: string;
    type: 'task' | 'event' | 'draft' | 'reminder';
    title: string;
    description?: string;
    due_date?: string;
    status: 'pending' | 'completed' | 'cancelled';
    created_at: string;
  }>>> {
    const params = new URLSearchParams({ mission_id: missionId });
    if (status) params.append('status', status);
    
    return this.request(`/api/actions?${params}`);
  }

  // Health check
  async healthCheck(): Promise<APIResponse<{ status: string; timestamp: string }>> {
    return this.request('/health');
  }

  // Utility methods
  private getFileType(mimeType: string): 'image' | 'pdf' | 'audio' | 'text' {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType === 'application/pdf') return 'pdf';
    if (mimeType.startsWith('audio/')) return 'audio';
    return 'text';
  }

  // FREE TIER FALLBACK: Offline mode indicators
  async checkConnection(): Promise<boolean> {
    try {
      const response = await this.healthCheck();
      return response.success;
    } catch {
      return false;
    }
  }

  // Rate limiting helper
  private lastRequestTime: Map<string, number> = new Map();

  private async checkRateLimit(endpoint: string, limitMs: number = 1000): Promise<void> {
    const lastTime = this.lastRequestTime.get(endpoint) || 0;
    const now = Date.now();

    if (now - lastTime < limitMs) {
      await new Promise(resolve => setTimeout(resolve, limitMs - (now - lastTime)));
    }

    this.lastRequestTime.set(endpoint, Date.now());
  }

  // ==========================================
  // ORACLE API Methods (Story 8.2, post-7)
  // ==========================================

  // OBSERVE - Radar scan
  async radarScan(dataTypes?: string[]): Promise<APIResponse<{
    signals: Array<{
      id: string;
      signal_type: string;
      title: string;
      urgency: 'low' | 'medium' | 'high' | 'critical';
      impact: 'low' | 'medium' | 'high';
      confidence: number;
    }>;
    clusters: Array<{
      id: string;
      theme: string;
      signal_count: number;
    }>;
  }>> {
    return this.request('/api/oracle/observe/scan', {
      method: 'POST',
      body: JSON.stringify({ data_types: dataTypes }),
    });
  }

  async getSignals(filters?: {
    status?: string;
    signal_type?: string;
    urgency?: string;
  }): Promise<APIResponse<Array<any>>> {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.signal_type) params.append('signal_type', filters.signal_type);
    if (filters?.urgency) params.append('urgency', filters.urgency);

    return this.request(`/api/oracle/observe/signals?${params}`);
  }

  async dismissSignal(signalId: string): Promise<APIResponse<void>> {
    return this.request(`/api/oracle/observe/signals/${signalId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'dismissed' }),
    });
  }

  // ORIENT - Strategic context
  async generateOrientation(signalIds: string[]): Promise<APIResponse<{
    context: {
      id: string;
      situation_summary: string;
      key_factors: string[];
      recommendations: string[];
    };
    horizons: Array<{
      horizon_type: 'immediate' | 'today' | 'week' | 'month';
      goals: string[];
      key_actions: string[];
    }>;
  }>> {
    return this.request('/api/oracle/orient/generate', {
      method: 'POST',
      body: JSON.stringify({ signal_ids: signalIds }),
    });
  }

  async getStrategicContext(contextId?: string): Promise<APIResponse<any>> {
    const endpoint = contextId
      ? `/api/oracle/orient/contexts/${contextId}`
      : '/api/oracle/orient/contexts';
    return this.request(endpoint);
  }

  async getHorizons(contextId: string): Promise<APIResponse<Array<{
    id: string;
    horizon_type: 'immediate' | 'today' | 'week' | 'month';
    goals: any[];
    actions: any[];
    dependencies: any[];
    risks: any[];
    opportunities: any[];
    priority_score: number;
    confidence: number;
  }>>> {
    return this.request(`/api/oracle/orient/horizons?context_id=${contextId}`);
  }

  async getAssessments(contextId: string): Promise<APIResponse<Array<{
    id: string;
    assessment_type: 'risk' | 'opportunity';
    title: string;
    impact_level: 'low' | 'medium' | 'high' | 'critical';
    likelihood: number;
  }>>> {
    return this.request(`/api/oracle/orient/assessments?context_id=${contextId}`);
  }

  // DECIDE - Decisions
  async createDecision(decisionData: {
    title: string;
    description?: string;
    context?: string;
    deadline?: string;
  }): Promise<APIResponse<{ id: string }>> {
    return this.request('/api/oracle/decide/decisions', {
      method: 'POST',
      body: JSON.stringify(decisionData),
    });
  }

  async getDecisions(status?: string): Promise<APIResponse<Array<any>>> {
    const params = status ? `?status=${status}` : '';
    return this.request(`/api/oracle/decide/decisions${params}`);
  }

  async generateOptions(decisionId: string): Promise<APIResponse<Array<{
    id: string;
    title: string;
    description: string;
    pros: string[];
    cons: string[];
    score: number;
  }>>> {
    return this.request(`/api/oracle/decide/decisions/${decisionId}/options`, {
      method: 'POST',
    });
  }

  async runSimulation(decisionId: string, optionId: string, config?: {
    iterations?: number;
    distribution?: string;
  }): Promise<APIResponse<{
    mean: number;
    std_deviation: number;
    percentiles: {
      p5: number;
      p25: number;
      p50: number;
      p75: number;
      p95: number;
    };
  }>> {
    return this.request(`/api/oracle/decide/decisions/${decisionId}/options/${optionId}/simulate`, {
      method: 'POST',
      body: JSON.stringify(config),
    });
  }

  async selectOption(decisionId: string, optionId: string, rationale?: string): Promise<APIResponse<void>> {
    return this.request(`/api/oracle/decide/decisions/${decisionId}/select`, {
      method: 'PATCH',
      body: JSON.stringify({ option_id: optionId, rationale }),
    });
  }

  // ACT - Execution
  async startPlan(decisionId: string): Promise<APIResponse<{
    id: string;
    title: string;
    steps: Array<{
      id: string;
      title: string;
      step_number: number;
      estimated_duration_minutes?: number;
    }>;
  }>> {
    return this.request('/api/oracle/act/plans', {
      method: 'POST',
      body: JSON.stringify({ decision_id: decisionId }),
    });
  }

  async getExecutionPlan(planId: string): Promise<APIResponse<any>> {
    return this.request(`/api/oracle/act/plans/${planId}`);
  }

  async updateStep(planId: string, stepId: string, updates: {
    status?: 'pending' | 'in_progress' | 'completed' | 'blocked' | 'skipped';
    notes?: string;
    blockers?: any[];
    actual_duration_minutes?: number;
  }): Promise<APIResponse<any>> {
    return this.request(`/api/oracle/act/plans/${planId}/steps/${stepId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async getCopilotGuidance(planId: string): Promise<APIResponse<{
    current_step: any;
    suggestions: Array<{
      type: string;
      content: string;
      priority: number;
    }>;
    health_assessment: {
      score: number;
      on_track: boolean;
      issues: string[];
    };
  }>> {
    return this.request(`/api/oracle/act/plans/${planId}/copilot`, {
      method: 'POST',
    });
  }

  async reportBlocker(planId: string, stepId: string, description: string): Promise<APIResponse<void>> {
    return this.request(`/api/oracle/act/plans/${planId}/blockers`, {
      method: 'POST',
      body: JSON.stringify({ step_id: stepId, description }),
    });
  }

  // PROBABILITY - Predictions
  async getPrediction(predictionId: string): Promise<APIResponse<any>> {
    return this.request(`/api/oracle/probability/predictions/${predictionId}`);
  }

  async createPrediction(predictionData: {
    subject_type: string;
    subject_id: string;
    prediction_type: string;
    predicted_outcome: any;
    confidence: number;
  }): Promise<APIResponse<{ id: string }>> {
    return this.request('/api/oracle/probability/predict', {
      method: 'POST',
      body: JSON.stringify(predictionData),
    });
  }

  async recordOutcome(predictionId: string, actualOutcome: any): Promise<APIResponse<{
    was_correct: boolean;
    accuracy_score: number;
    updated_calibration: {
      brier_score: number;
      total_predictions: number;
    };
  }>> {
    return this.request(`/api/oracle/probability/predictions/${predictionId}/outcome`, {
      method: 'POST',
      body: JSON.stringify({ actual_outcome: actualOutcome }),
    });
  }

  async getCalibration(): Promise<APIResponse<{
    brier_score: number;
    total_predictions: number;
    accuracy_by_bucket: number[];
  }>> {
    return this.request('/api/oracle/probability/calibration');
  }

  // ENVIRONMENT - Ghost Actions (Story post-7)
  async getGhostActions(filters?: {
    status?: string;
    action_type?: string;
  }): Promise<APIResponse<Array<{
    id: string;
    action_type: string;
    title: string;
    description?: string;
    draft_action: Record<string, any>;
    confidence: number;
    rationale?: string;
    status: 'pending' | 'approved' | 'rejected' | 'executed' | 'expired' | 'cancelled';
    expires_at?: string;
  }>>> {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.action_type) params.append('action_type', filters.action_type);
    return this.request(`/api/oracle/environment/ghost-actions?${params}`);
  }

  async approveGhostAction(actionId: string): Promise<APIResponse<{
    id: string;
    status: 'approved';
    approved_at: string;
  }>> {
    return this.request(`/api/oracle/environment/ghost-actions/${actionId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'approved', approved_at: new Date().toISOString() }),
    });
  }

  async rejectGhostAction(actionId: string, reason?: string): Promise<APIResponse<void>> {
    return this.request(`/api/oracle/environment/ghost-actions/${actionId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'rejected', rejected_at: new Date().toISOString(), metadata: { rejection_reason: reason } }),
    });
  }

  async executeGhostAction(actionId: string): Promise<APIResponse<{
    executed: boolean;
    result?: any;
  }>> {
    return this.request(`/api/oracle/environment/ghost-actions/${actionId}/execute`, {
      method: 'POST',
    });
  }

  // ORACLE - Loop control
  async getOracleStatus(): Promise<APIResponse<{
    current_phase: 'observe' | 'orient' | 'decide' | 'act' | 'idle';
    loop_running: boolean;
    loop_paused: boolean;
    system_confidence: number;
  }>> {
    return this.request('/api/oracle/status');
  }

  async startOracleLoop(): Promise<APIResponse<void>> {
    return this.request('/api/oracle/loop/start', { method: 'POST' });
  }

  async pauseOracleLoop(): Promise<APIResponse<void>> {
    return this.request('/api/oracle/loop/pause', { method: 'POST' });
  }

  async resumeOracleLoop(): Promise<APIResponse<void>> {
    return this.request('/api/oracle/loop/resume', { method: 'POST' });
  }

  async stopOracleLoop(): Promise<APIResponse<void>> {
    return this.request('/api/oracle/loop/stop', { method: 'POST' });
  }

  async getOracleDashboard(): Promise<APIResponse<{
    phase: string;
    signals_count: number;
    pending_decisions: number;
    active_plan_progress: number;
    recent_activity: Array<any>;
  }>> {
    return this.request('/api/oracle/dashboard');
  }

  // ORACLE Health Check
  async getOracleHealth(): Promise<APIResponse<{
    status: string;
    subsystems: Record<string, { status: string; description: string }>;
    capabilities: Record<string, boolean>;
  }>> {
    return this.request('/api/oracle/health');
  }
}

// Export singleton instance
export const missionControlAPI = new MissionControlAPI();

// Error types for better handling
export class MissionControlError extends Error {
  constructor(
    message: string,
    public code?: string,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = 'MissionControlError';
  }
}

// FREE TIER: Offline queue for actions when network is unavailable
export class OfflineQueue {
  private static instance: OfflineQueue;
  private queue: Array<{ endpoint: string; data: any; timestamp: number }> = [];

  static getInstance(): OfflineQueue {
    if (!OfflineQueue.instance) {
      OfflineQueue.instance = new OfflineQueue();
    }
    return OfflineQueue.instance;
  }

  async addToQueue(endpoint: string, data: any): Promise<void> {
    this.queue.push({
      endpoint,
      data,
      timestamp: Date.now(),
    });
    
    // Store in local storage for persistence
    try {
      // In real app, use MMKV or AsyncStorage
      console.log('Added to offline queue:', endpoint);
    } catch (error) {
      console.error('Failed to store offline data:', error);
    }
  }

  async processQueue(): Promise<void> {
    while (this.queue.length > 0) {
      const item = this.queue.shift();
      if (!item) break;

      try {
        await missionControlAPI.request(item.endpoint, {
          method: 'POST',
          body: JSON.stringify(item.data),
        });
      } catch (error) {
        console.error('Failed to process queued item:', error);
        // Re-add to end of queue
        this.queue.push(item);
        break; // Stop processing on first failure
      }
    }
  }

  getQueueLength(): number {
    return this.queue.length;
  }
}