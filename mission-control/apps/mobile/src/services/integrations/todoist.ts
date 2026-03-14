/**
 * ORACLE Todoist Integration
 * Story int-3 - Sync tasks with Todoist
 *
 * Features:
 * - OAuth2 flow for Todoist
 * - Import tasks as signals
 * - Export execution steps as tasks
 * - Two-way sync of completion status
 * - Project mapping
 */

import * as SecureStore from 'expo-secure-store';
import { Signal, ExecutionStep, ExecutionPlan } from '@mission-control/shared-types';
import {
  IntegrationConfig,
  IntegrationStatus,
  OAuthTokens,
  SyncResult,
} from './googleCalendar';

// ============================================================================
// TYPES
// ============================================================================

export interface TodoistTask {
  id: string;
  project_id: string;
  section_id?: string;
  content: string;
  description: string;
  is_completed: boolean;
  labels: string[];
  priority: 1 | 2 | 3 | 4; // 1 = normal, 4 = urgent
  due?: {
    date: string;
    string: string;
    datetime?: string;
    timezone?: string;
    is_recurring: boolean;
  };
  parent_id?: string;
  order: number;
  url: string;
  comment_count: number;
  created_at: string;
  creator_id: string;
  assignee_id?: string;
  assigner_id?: string;
  duration?: {
    amount: number;
    unit: 'minute' | 'day';
  };
  // ORACLE metadata
  oracle_step_id?: string;
  oracle_signal_id?: string;
}

export interface TodoistProject {
  id: string;
  name: string;
  color: string;
  parent_id?: string;
  order: number;
  comment_count: number;
  is_shared: boolean;
  is_favorite: boolean;
  is_inbox_project: boolean;
  is_team_inbox: boolean;
  view_style: 'list' | 'board';
  url: string;
}

export interface TodoistSection {
  id: string;
  project_id: string;
  name: string;
  order: number;
}

export interface TodoistLabel {
  id: string;
  name: string;
  color: string;
  order: number;
  is_favorite: boolean;
}

export interface ProjectMapping {
  todoist_project_id: string;
  oracle_category: string;
  sync_direction: 'import' | 'export' | 'bidirectional';
  auto_create_signals: boolean;
  auto_export_steps: boolean;
}

export interface TodoistSyncConfig {
  enabled: boolean;
  projectMappings: ProjectMapping[];
  defaultImportProject?: string;
  defaultExportProject?: string;
  syncCompletionStatus: boolean;
  labelForOracleItems: string;
  lastSyncToken?: string;
}

export interface CreateTaskParams {
  content: string;
  description?: string;
  project_id?: string;
  section_id?: string;
  parent_id?: string;
  labels?: string[];
  priority?: 1 | 2 | 3 | 4;
  due_string?: string;
  due_date?: string;
  due_datetime?: string;
  duration?: number;
  duration_unit?: 'minute' | 'day';
  oracle_step_id?: string;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const TODOIST_CONFIG: IntegrationConfig = {
  provider: 'todoist',
  name: 'Todoist',
  description: 'Sync tasks with Todoist',
  icon: 'checkmark.circle',
  scopes: ['data:read_write', 'data:delete', 'project:delete'],
  authUrl: 'https://todoist.com/oauth/authorize',
  tokenUrl: 'https://todoist.com/oauth/access_token',
  revokeUrl: 'https://todoist.com/api/access_tokens/revoke',
};

const STORAGE_KEYS = {
  ACCESS_TOKEN: 'oracle_todoist_access_token',
  LAST_SYNC: 'oracle_todoist_last_sync',
  SYNC_CONFIG: 'oracle_todoist_sync_config',
  PROJECT_MAPPINGS: 'oracle_todoist_project_mappings',
} as const;

const TODOIST_API = 'https://api.todoist.com/rest/v2';
const TODOIST_SYNC_API = 'https://api.todoist.com/sync/v9';

// Priority mapping: Todoist uses 1-4 (1=normal, 4=urgent), ORACLE uses urgency levels
const PRIORITY_TO_URGENCY: Record<number, 'low' | 'medium' | 'high' | 'critical'> = {
  1: 'low',
  2: 'medium',
  3: 'high',
  4: 'critical',
};

const URGENCY_TO_PRIORITY: Record<string, 1 | 2 | 3 | 4> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

// ============================================================================
// TODOIST SERVICE
// ============================================================================

class TodoistService {
  private accessToken: string | null = null;
  private status: IntegrationStatus = 'disconnected';
  private projects: TodoistProject[] = [];
  private sections: TodoistSection[] = [];
  private labels: TodoistLabel[] = [];
  private tasks: TodoistTask[] = [];
  private syncConfig: TodoistSyncConfig;
  private syncInProgress = false;
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;

  constructor() {
    this.clientId = process.env.TODOIST_CLIENT_ID || '';
    this.clientSecret = process.env.TODOIST_CLIENT_SECRET || '';
    this.redirectUri = process.env.TODOIST_REDIRECT_URI || 'com.missioncontrol.oracle:/oauth2callback/todoist';

    this.syncConfig = {
      enabled: true,
      projectMappings: [],
      syncCompletionStatus: true,
      labelForOracleItems: 'oracle',
    };

    this.loadConfig();
  }

  // --------------------------------------------------------------------------
  // Configuration
  // --------------------------------------------------------------------------

  private async loadConfig(): Promise<void> {
    try {
      const token = await SecureStore.getItemAsync(STORAGE_KEYS.ACCESS_TOKEN);
      if (token) {
        this.accessToken = token;
        this.status = 'connected';
      }

      const config = await SecureStore.getItemAsync(STORAGE_KEYS.SYNC_CONFIG);
      if (config) {
        this.syncConfig = { ...this.syncConfig, ...JSON.parse(config) };
      }
    } catch (error) {
      console.warn('[Todoist] Failed to load config:', error);
    }
  }

  private async saveConfig(): Promise<void> {
    try {
      await SecureStore.setItemAsync(
        STORAGE_KEYS.SYNC_CONFIG,
        JSON.stringify(this.syncConfig)
      );
    } catch (error) {
      console.warn('[Todoist] Failed to save config:', error);
    }
  }

  // --------------------------------------------------------------------------
  // OAuth2 Flow
  // --------------------------------------------------------------------------

  /**
   * Generate OAuth2 authorization URL
   */
  getAuthorizationUrl(state?: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      scope: TODOIST_CONFIG.scopes.join(','),
      state: state || Math.random().toString(36).substring(2, 15),
    });

    return `${TODOIST_CONFIG.authUrl}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string): Promise<string> {
    console.log('[Todoist] Exchanging code for token');

    const response = await fetch(TODOIST_CONFIG.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
      }).toString(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Token exchange failed: ${error.error || 'Unknown error'}`);
    }

    const data = await response.json();
    this.accessToken = data.access_token;

    await SecureStore.setItemAsync(STORAGE_KEYS.ACCESS_TOKEN, this.accessToken);
    this.status = 'connected';

    console.log('[Todoist] Successfully connected');
    return this.accessToken;
  }

  /**
   * Disconnect and revoke token
   */
  async disconnect(): Promise<void> {
    console.log('[Todoist] Disconnecting');

    if (this.accessToken && TODOIST_CONFIG.revokeUrl) {
      try {
        await fetch(TODOIST_CONFIG.revokeUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            client_id: this.clientId,
            client_secret: this.clientSecret,
            access_token: this.accessToken,
          }).toString(),
        });
      } catch (error) {
        console.warn('[Todoist] Token revocation failed:', error);
      }
    }

    await SecureStore.deleteItemAsync(STORAGE_KEYS.ACCESS_TOKEN);
    await SecureStore.deleteItemAsync(STORAGE_KEYS.LAST_SYNC);

    this.accessToken = null;
    this.status = 'disconnected';
    this.projects = [];
    this.tasks = [];
  }

  // --------------------------------------------------------------------------
  // API Helpers
  // --------------------------------------------------------------------------

  private async apiRequest<T>(
    endpoint: string,
    method: 'GET' | 'POST' | 'DELETE' = 'GET',
    body?: any
  ): Promise<T> {
    if (!this.accessToken) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${TODOIST_API}${endpoint}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(`API request failed: ${error.error || response.statusText}`);
    }

    if (response.status === 204) {
      return {} as T;
    }

    return response.json();
  }

  // --------------------------------------------------------------------------
  // Projects & Labels
  // --------------------------------------------------------------------------

  /**
   * Fetch all projects
   */
  async fetchProjects(): Promise<TodoistProject[]> {
    console.log('[Todoist] Fetching projects');
    this.projects = await this.apiRequest<TodoistProject[]>('/projects');
    console.log(`[Todoist] Fetched ${this.projects.length} projects`);
    return this.projects;
  }

  /**
   * Fetch all sections
   */
  async fetchSections(projectId?: string): Promise<TodoistSection[]> {
    const endpoint = projectId ? `/sections?project_id=${projectId}` : '/sections';
    this.sections = await this.apiRequest<TodoistSection[]>(endpoint);
    return this.sections;
  }

  /**
   * Fetch all labels
   */
  async fetchLabels(): Promise<TodoistLabel[]> {
    this.labels = await this.apiRequest<TodoistLabel[]>('/labels');
    return this.labels;
  }

  /**
   * Create ORACLE label if it doesn't exist
   */
  async ensureOracleLabel(): Promise<TodoistLabel> {
    await this.fetchLabels();
    let oracleLabel = this.labels.find(l => l.name === this.syncConfig.labelForOracleItems);

    if (!oracleLabel) {
      oracleLabel = await this.apiRequest<TodoistLabel>('/labels', 'POST', {
        name: this.syncConfig.labelForOracleItems,
        color: 'blue',
      });
      this.labels.push(oracleLabel);
    }

    return oracleLabel;
  }

  // --------------------------------------------------------------------------
  // Task Operations
  // --------------------------------------------------------------------------

  /**
   * Fetch tasks (optionally filtered)
   */
  async fetchTasks(projectId?: string, filter?: string): Promise<TodoistTask[]> {
    console.log('[Todoist] Fetching tasks');

    let endpoint = '/tasks';
    const params = new URLSearchParams();

    if (projectId) params.append('project_id', projectId);
    if (filter) params.append('filter', filter);

    if (params.toString()) {
      endpoint += `?${params.toString()}`;
    }

    this.tasks = await this.apiRequest<TodoistTask[]>(endpoint);
    console.log(`[Todoist] Fetched ${this.tasks.length} tasks`);
    return this.tasks;
  }

  /**
   * Create a new task
   */
  async createTask(params: CreateTaskParams): Promise<TodoistTask> {
    console.log('[Todoist] Creating task:', params.content);

    // Ensure ORACLE label exists and add it
    const oracleLabel = await this.ensureOracleLabel();
    const labels = [...(params.labels || []), oracleLabel.name];

    const body: any = {
      content: params.content,
      description: params.description,
      project_id: params.project_id || this.syncConfig.defaultExportProject,
      section_id: params.section_id,
      parent_id: params.parent_id,
      labels,
      priority: params.priority || 1,
    };

    if (params.due_string) body.due_string = params.due_string;
    if (params.due_date) body.due_date = params.due_date;
    if (params.due_datetime) body.due_datetime = params.due_datetime;
    if (params.duration) {
      body.duration = params.duration;
      body.duration_unit = params.duration_unit || 'minute';
    }

    // Add ORACLE metadata to description
    if (params.oracle_step_id) {
      body.description = `${body.description || ''}\n\n---\nOracle Step ID: ${params.oracle_step_id}`.trim();
    }

    const task = await this.apiRequest<TodoistTask>('/tasks', 'POST', body);
    task.oracle_step_id = params.oracle_step_id;
    this.tasks.push(task);

    console.log('[Todoist] Task created:', task.id);
    return task;
  }

  /**
   * Complete a task
   */
  async completeTask(taskId: string): Promise<void> {
    console.log('[Todoist] Completing task:', taskId);
    await this.apiRequest(`/tasks/${taskId}/close`, 'POST');

    const task = this.tasks.find(t => t.id === taskId);
    if (task) task.is_completed = true;
  }

  /**
   * Reopen a task
   */
  async reopenTask(taskId: string): Promise<void> {
    console.log('[Todoist] Reopening task:', taskId);
    await this.apiRequest(`/tasks/${taskId}/reopen`, 'POST');

    const task = this.tasks.find(t => t.id === taskId);
    if (task) task.is_completed = false;
  }

  /**
   * Delete a task
   */
  async deleteTask(taskId: string): Promise<void> {
    console.log('[Todoist] Deleting task:', taskId);
    await this.apiRequest(`/tasks/${taskId}`, 'DELETE');
    this.tasks = this.tasks.filter(t => t.id !== taskId);
  }

  // --------------------------------------------------------------------------
  // Signal Import
  // --------------------------------------------------------------------------

  /**
   * Convert Todoist task to ORACLE signal
   */
  taskToSignal(task: TodoistTask): Partial<Signal> {
    return {
      type: 'task',
      title: task.content,
      summary: task.description,
      urgency: PRIORITY_TO_URGENCY[task.priority] || 'medium',
      status: task.is_completed ? 'processed' : 'active',
      detected_at: task.created_at,
      source: 'todoist',
      metadata: {
        todoist_task_id: task.id,
        todoist_project_id: task.project_id,
        todoist_url: task.url,
        labels: task.labels,
        due: task.due,
      },
    };
  }

  /**
   * Import tasks from Todoist as signals
   */
  async importTasksAsSignals(projectId?: string): Promise<Partial<Signal>[]> {
    console.log('[Todoist] Importing tasks as signals');

    const targetProject = projectId || this.syncConfig.defaultImportProject;
    await this.fetchTasks(targetProject);

    const signals = this.tasks
      .filter(t => !t.is_completed) // Only import active tasks
      .map(task => this.taskToSignal(task));

    console.log(`[Todoist] Imported ${signals.length} signals`);
    return signals;
  }

  // --------------------------------------------------------------------------
  // Step Export
  // --------------------------------------------------------------------------

  /**
   * Export execution steps to Todoist
   */
  async exportStepsToTasks(
    plan: ExecutionPlan,
    steps: ExecutionStep[],
    projectId?: string
  ): Promise<TodoistTask[]> {
    console.log('[Todoist] Exporting steps to Todoist');

    const targetProject = projectId || this.syncConfig.defaultExportProject;
    const createdTasks: TodoistTask[] = [];

    for (const step of steps) {
      // Skip completed steps
      if (step.status === 'completed' || step.status === 'skipped') continue;

      try {
        const task = await this.createTask({
          content: step.title,
          description: step.description || `Step from ORACLE plan: ${plan.title || plan.id}`,
          project_id: targetProject,
          priority: step.priority === 'high' ? 3 : step.priority === 'low' ? 1 : 2,
          due_datetime: step.scheduled_start,
          duration: step.estimated_minutes,
          duration_unit: 'minute',
          oracle_step_id: step.id,
        });

        createdTasks.push(task);
      } catch (error) {
        console.warn(`[Todoist] Failed to export step ${step.id}:`, error);
      }
    }

    console.log(`[Todoist] Exported ${createdTasks.length} tasks`);
    return createdTasks;
  }

  // --------------------------------------------------------------------------
  // Two-Way Sync
  // --------------------------------------------------------------------------

  /**
   * Sync completion status between ORACLE and Todoist
   */
  async syncCompletionStatus(
    stepId: string,
    todoistTaskId: string,
    oracleCompleted: boolean
  ): Promise<void> {
    if (!this.syncConfig.syncCompletionStatus) return;

    const task = this.tasks.find(t => t.id === todoistTaskId);
    if (!task) {
      await this.fetchTasks();
    }

    const currentTask = this.tasks.find(t => t.id === todoistTaskId);
    if (!currentTask) {
      console.warn(`[Todoist] Task ${todoistTaskId} not found`);
      return;
    }

    if (oracleCompleted && !currentTask.is_completed) {
      await this.completeTask(todoistTaskId);
      console.log('[Todoist] Synced completion: ORACLE -> Todoist');
    } else if (!oracleCompleted && currentTask.is_completed) {
      await this.reopenTask(todoistTaskId);
      console.log('[Todoist] Synced completion: Reopened in Todoist');
    }
  }

  /**
   * Get tasks that were completed in Todoist but not in ORACLE
   */
  getCompletedTaskIds(): string[] {
    return this.tasks
      .filter(t => t.is_completed && t.oracle_step_id)
      .map(t => t.oracle_step_id!);
  }

  // --------------------------------------------------------------------------
  // Project Mapping
  // --------------------------------------------------------------------------

  /**
   * Set project mapping for sync
   */
  async setProjectMapping(mapping: ProjectMapping): Promise<void> {
    const existingIndex = this.syncConfig.projectMappings.findIndex(
      m => m.todoist_project_id === mapping.todoist_project_id
    );

    if (existingIndex >= 0) {
      this.syncConfig.projectMappings[existingIndex] = mapping;
    } else {
      this.syncConfig.projectMappings.push(mapping);
    }

    await this.saveConfig();
    console.log('[Todoist] Project mapping updated:', mapping);
  }

  /**
   * Remove project mapping
   */
  async removeProjectMapping(todoistProjectId: string): Promise<void> {
    this.syncConfig.projectMappings = this.syncConfig.projectMappings.filter(
      m => m.todoist_project_id !== todoistProjectId
    );
    await this.saveConfig();
  }

  /**
   * Set default projects
   */
  async setDefaultProjects(importProject?: string, exportProject?: string): Promise<void> {
    if (importProject) this.syncConfig.defaultImportProject = importProject;
    if (exportProject) this.syncConfig.defaultExportProject = exportProject;
    await this.saveConfig();
  }

  // --------------------------------------------------------------------------
  // Sync Operations
  // --------------------------------------------------------------------------

  /**
   * Full sync with Todoist
   */
  async sync(): Promise<SyncResult> {
    if (this.syncInProgress) {
      return {
        success: false,
        events_fetched: 0,
        events_created: 0,
        conflicts_detected: 0,
        last_sync: new Date(),
        error: 'Sync already in progress',
      };
    }

    this.syncInProgress = true;
    console.log('[Todoist] Starting sync');

    try {
      // Fetch all data
      await this.fetchProjects();
      await this.fetchLabels();
      await this.fetchTasks();

      // Store last sync time
      await SecureStore.setItemAsync(STORAGE_KEYS.LAST_SYNC, new Date().toISOString());

      const result: SyncResult = {
        success: true,
        events_fetched: this.tasks.length,
        events_created: 0,
        conflicts_detected: 0,
        last_sync: new Date(),
      };

      console.log('[Todoist] Sync completed:', result);
      return result;
    } catch (error) {
      console.error('[Todoist] Sync failed:', error);
      return {
        success: false,
        events_fetched: 0,
        events_created: 0,
        conflicts_detected: 0,
        last_sync: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    } finally {
      this.syncInProgress = false;
    }
  }

  // --------------------------------------------------------------------------
  // Getters
  // --------------------------------------------------------------------------

  getStatus(): IntegrationStatus {
    return this.status;
  }

  getProjects(): TodoistProject[] {
    return this.projects;
  }

  getSections(): TodoistSection[] {
    return this.sections;
  }

  getLabels(): TodoistLabel[] {
    return this.labels;
  }

  getTasks(): TodoistTask[] {
    return this.tasks;
  }

  getSyncConfig(): TodoistSyncConfig {
    return this.syncConfig;
  }

  getConfig(): IntegrationConfig {
    return TODOIST_CONFIG;
  }

  isConnected(): boolean {
    return !!this.accessToken && this.status === 'connected';
  }

  async getLastSyncTime(): Promise<Date | null> {
    const lastSync = await SecureStore.getItemAsync(STORAGE_KEYS.LAST_SYNC);
    return lastSync ? new Date(lastSync) : null;
  }
}

// ============================================================================
// SINGLETON & EXPORTS
// ============================================================================

export const todoistService = new TodoistService();

export {
  TodoistService,
  TODOIST_CONFIG,
  STORAGE_KEYS as TODOIST_STORAGE_KEYS,
  PRIORITY_TO_URGENCY,
  URGENCY_TO_PRIORITY,
};

export default todoistService;
