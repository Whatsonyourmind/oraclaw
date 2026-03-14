/**
 * ORACLE Time Tracker Service
 * Comprehensive time tracking for projects, tasks, and billing
 *
 * Features:
 * - Manual and automatic time entries
 * - Project/task time allocation
 * - Time estimates vs actuals
 * - Billable/non-billable tracking
 * - Time reports and exports
 * - Idle detection
 * - Calendar integration for auto-tracking
 */

import { oracleCacheService, cacheKey, hashObject } from '../cache';

// ============================================================================
// Types
// ============================================================================

export type TimeEntryStatus = 'running' | 'paused' | 'stopped';
export type BillableStatus = 'billable' | 'non_billable' | 'internal' | 'overhead';
export type IdleStatus = 'active' | 'idle' | 'away' | 'offline';

export interface TimeEntry {
  id: string;
  user_id: string;
  project_id?: string;
  project_name?: string;
  task_id?: string;
  task_name?: string;
  description?: string;
  status: TimeEntryStatus;
  billable_status: BillableStatus;
  hourly_rate?: number;
  start_time: string;
  end_time?: string;
  pause_time?: string;
  duration_seconds: number;
  paused_duration_seconds: number;
  idle_duration_seconds: number;
  tags: string[];
  source: 'manual' | 'timer' | 'auto' | 'calendar';
  calendar_event_id?: string;
  notes?: string;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface TimeEstimate {
  id: string;
  user_id: string;
  task_id: string;
  task_name: string;
  project_id?: string;
  estimated_hours: number;
  actual_hours: number;
  variance_hours: number;
  variance_percentage: number;
  confidence: number; // 0-1, how confident the estimate was
  completed: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  user_id: string;
  name: string;
  client_name?: string;
  color?: string;
  hourly_rate?: number;
  budget_hours?: number;
  budget_amount?: number;
  is_billable: boolean;
  is_active: boolean;
  total_tracked_hours: number;
  total_billed_amount: number;
  created_at: string;
  updated_at: string;
}

export interface IdleEvent {
  id: string;
  user_id: string;
  entry_id: string;
  start_time: string;
  end_time: string;
  duration_seconds: number;
  status: IdleStatus;
  action_taken: 'kept' | 'discarded' | 'split' | 'pending';
  created_at: string;
}

export interface TimeReport {
  period: {
    start_date: string;
    end_date: string;
  };
  summary: {
    total_hours: number;
    billable_hours: number;
    non_billable_hours: number;
    billable_amount: number;
    total_entries: number;
    unique_projects: number;
    unique_tasks: number;
    average_entry_duration: number;
    most_productive_day: string;
    most_productive_hour: number;
  };
  by_project: Array<{
    project_id: string;
    project_name: string;
    hours: number;
    percentage: number;
    billable_amount: number;
    entries_count: number;
  }>;
  by_day: Array<{
    date: string;
    hours: number;
    entries_count: number;
    projects: string[];
  }>;
  by_tag: Array<{
    tag: string;
    hours: number;
    percentage: number;
  }>;
  estimates: {
    total_estimated_hours: number;
    total_actual_hours: number;
    accuracy_percentage: number;
    overrun_count: number;
    underrun_count: number;
  };
}

export interface TimeTrackerSettings {
  user_id: string;
  default_billable_status: BillableStatus;
  default_hourly_rate?: number;
  auto_track_calendar: boolean;
  idle_detection_enabled: boolean;
  idle_threshold_minutes: number;
  idle_action: 'pause' | 'prompt' | 'keep';
  round_to_nearest_minutes: number;
  minimum_entry_minutes: number;
  auto_stop_timer_at_day_end: boolean;
  day_end_time: string; // HH:mm
  reminder_enabled: boolean;
  reminder_interval_minutes: number;
  weekly_hour_goal: number;
  updated_at: string;
}

export interface CalendarSync {
  user_id: string;
  calendar_provider: 'google' | 'outlook' | 'apple';
  calendar_ids: string[];
  sync_enabled: boolean;
  auto_create_entries: boolean;
  exclude_patterns: string[];
  default_billable: boolean;
  last_sync_at?: string;
}

// Cache TTLs
const TIME_CACHE_TTL = {
  entry: 30 * 1000, // 30 seconds
  report: 5 * 60 * 1000, // 5 minutes
  project: 2 * 60 * 1000, // 2 minutes
  settings: 10 * 60 * 1000, // 10 minutes
};

// ============================================================================
// Time Tracker Service
// ============================================================================

export class TimeTrackerService {
  // In-memory stores
  private entries: Map<string, TimeEntry> = new Map();
  private estimates: Map<string, TimeEstimate[]> = new Map();
  private projects: Map<string, Project[]> = new Map();
  private idleEvents: Map<string, IdleEvent[]> = new Map();
  private settings: Map<string, TimeTrackerSettings> = new Map();
  private calendarSyncs: Map<string, CalendarSync> = new Map();

  // ============================================================================
  // Time Entry Management
  // ============================================================================

  /**
   * Start a new time entry
   */
  async startEntry(
    userId: string,
    options: {
      project_id?: string;
      project_name?: string;
      task_id?: string;
      task_name?: string;
      description?: string;
      billable_status?: BillableStatus;
      hourly_rate?: number;
      tags?: string[];
    } = {}
  ): Promise<TimeEntry> {
    // Check for running entry
    const runningEntry = await this.getRunningEntry(userId);
    if (runningEntry) {
      // Stop the existing entry first
      await this.stopEntry(userId);
    }

    const userSettings = await this.getSettings(userId);
    const now = new Date().toISOString();

    const entry: TimeEntry = {
      id: crypto.randomUUID(),
      user_id: userId,
      project_id: options.project_id,
      project_name: options.project_name,
      task_id: options.task_id,
      task_name: options.task_name,
      description: options.description,
      status: 'running',
      billable_status: options.billable_status || userSettings.default_billable_status,
      hourly_rate: options.hourly_rate || userSettings.default_hourly_rate,
      start_time: now,
      duration_seconds: 0,
      paused_duration_seconds: 0,
      idle_duration_seconds: 0,
      tags: options.tags || [],
      source: 'timer',
      metadata: {},
      created_at: now,
      updated_at: now,
    };

    this.entries.set(entry.id, entry);
    oracleCacheService.deleteByPrefix(`time:${userId}`);

    return entry;
  }

  /**
   * Get the currently running time entry
   */
  async getRunningEntry(userId: string): Promise<TimeEntry | null> {
    const cacheKeyStr = cacheKey('time_running', userId);

    const cached = oracleCacheService.get<TimeEntry>(cacheKeyStr);
    if (cached) {
      // Update duration
      if (cached.status === 'running') {
        const now = new Date();
        const start = new Date(cached.start_time);
        cached.duration_seconds = Math.floor((now.getTime() - start.getTime()) / 1000) - cached.paused_duration_seconds;
      }
      return cached;
    }

    for (const entry of this.entries.values()) {
      if (entry.user_id === userId && entry.status === 'running') {
        // Update duration
        const now = new Date();
        const start = new Date(entry.start_time);
        entry.duration_seconds = Math.floor((now.getTime() - start.getTime()) / 1000) - entry.paused_duration_seconds;

        oracleCacheService.set(cacheKeyStr, entry, TIME_CACHE_TTL.entry);
        return entry;
      }
    }

    return null;
  }

  /**
   * Pause the running entry
   */
  async pauseEntry(userId: string): Promise<TimeEntry | null> {
    const entry = await this.getRunningEntry(userId);
    if (!entry || entry.status !== 'running') {
      return null;
    }

    entry.status = 'paused';
    entry.pause_time = new Date().toISOString();
    entry.updated_at = new Date().toISOString();

    this.entries.set(entry.id, entry);
    oracleCacheService.delete(cacheKey('time_running', userId));

    return entry;
  }

  /**
   * Resume a paused entry
   */
  async resumeEntry(userId: string): Promise<TimeEntry | null> {
    let pausedEntry: TimeEntry | null = null;

    for (const entry of this.entries.values()) {
      if (entry.user_id === userId && entry.status === 'paused') {
        pausedEntry = entry;
        break;
      }
    }

    if (!pausedEntry) {
      return null;
    }

    // Calculate paused duration
    if (pausedEntry.pause_time) {
      const pauseStart = new Date(pausedEntry.pause_time);
      const now = new Date();
      const pausedSeconds = Math.floor((now.getTime() - pauseStart.getTime()) / 1000);
      pausedEntry.paused_duration_seconds += pausedSeconds;
    }

    pausedEntry.status = 'running';
    pausedEntry.pause_time = undefined;
    pausedEntry.updated_at = new Date().toISOString();

    this.entries.set(pausedEntry.id, pausedEntry);
    oracleCacheService.delete(cacheKey('time_running', userId));

    return pausedEntry;
  }

  /**
   * Stop the running entry
   */
  async stopEntry(
    userId: string,
    options: {
      description?: string;
      notes?: string;
    } = {}
  ): Promise<TimeEntry | null> {
    const entry = await this.getRunningEntry(userId);
    if (!entry) {
      // Check for paused entry
      for (const e of this.entries.values()) {
        if (e.user_id === userId && e.status === 'paused') {
          return this.stopEntryById(e.id, options);
        }
      }
      return null;
    }

    return this.stopEntryById(entry.id, options);
  }

  /**
   * Stop entry by ID
   */
  private async stopEntryById(
    entryId: string,
    options: { description?: string; notes?: string } = {}
  ): Promise<TimeEntry | null> {
    const entry = this.entries.get(entryId);
    if (!entry) {
      return null;
    }

    const now = new Date();
    const start = new Date(entry.start_time);

    // Calculate final duration
    if (entry.status === 'paused' && entry.pause_time) {
      const pauseStart = new Date(entry.pause_time);
      entry.paused_duration_seconds += Math.floor((now.getTime() - pauseStart.getTime()) / 1000);
    }

    entry.duration_seconds = Math.floor((now.getTime() - start.getTime()) / 1000) - entry.paused_duration_seconds;
    entry.status = 'stopped';
    entry.end_time = now.toISOString();
    if (options.description) {
      entry.description = options.description;
    }
    if (options.notes) {
      entry.notes = options.notes;
    }
    entry.updated_at = now.toISOString();

    // Apply rounding
    const settings = await this.getSettings(entry.user_id);
    if (settings.round_to_nearest_minutes > 0) {
      const roundSeconds = settings.round_to_nearest_minutes * 60;
      entry.duration_seconds = Math.round(entry.duration_seconds / roundSeconds) * roundSeconds;
    }

    // Apply minimum
    if (settings.minimum_entry_minutes > 0) {
      const minSeconds = settings.minimum_entry_minutes * 60;
      if (entry.duration_seconds < minSeconds && entry.duration_seconds > 0) {
        entry.duration_seconds = minSeconds;
      }
    }

    this.entries.set(entry.id, entry);

    // Update project totals
    if (entry.project_id) {
      await this.updateProjectTotals(entry.user_id, entry.project_id);
    }

    // Update estimate actuals
    if (entry.task_id) {
      await this.updateEstimateActuals(entry.user_id, entry.task_id, entry.duration_seconds / 3600);
    }

    oracleCacheService.deleteByPrefix(`time:${entry.user_id}`);

    return entry;
  }

  /**
   * Create a manual time entry
   */
  async createManualEntry(
    userId: string,
    options: {
      project_id?: string;
      project_name?: string;
      task_id?: string;
      task_name?: string;
      description?: string;
      billable_status?: BillableStatus;
      hourly_rate?: number;
      start_time: string;
      end_time: string;
      tags?: string[];
      notes?: string;
    }
  ): Promise<TimeEntry> {
    const userSettings = await this.getSettings(userId);
    const start = new Date(options.start_time);
    const end = new Date(options.end_time);
    const durationSeconds = Math.floor((end.getTime() - start.getTime()) / 1000);
    const now = new Date().toISOString();

    const entry: TimeEntry = {
      id: crypto.randomUUID(),
      user_id: userId,
      project_id: options.project_id,
      project_name: options.project_name,
      task_id: options.task_id,
      task_name: options.task_name,
      description: options.description,
      status: 'stopped',
      billable_status: options.billable_status || userSettings.default_billable_status,
      hourly_rate: options.hourly_rate || userSettings.default_hourly_rate,
      start_time: options.start_time,
      end_time: options.end_time,
      duration_seconds: durationSeconds,
      paused_duration_seconds: 0,
      idle_duration_seconds: 0,
      tags: options.tags || [],
      source: 'manual',
      notes: options.notes,
      metadata: {},
      created_at: now,
      updated_at: now,
    };

    this.entries.set(entry.id, entry);

    // Update project totals
    if (entry.project_id) {
      await this.updateProjectTotals(userId, entry.project_id);
    }

    oracleCacheService.deleteByPrefix(`time:${userId}`);

    return entry;
  }

  /**
   * Update an existing entry
   */
  async updateEntry(
    userId: string,
    entryId: string,
    updates: Partial<Omit<TimeEntry, 'id' | 'user_id' | 'created_at'>>
  ): Promise<TimeEntry | null> {
    const entry = this.entries.get(entryId);
    if (!entry || entry.user_id !== userId) {
      return null;
    }

    // Recalculate duration if times changed
    if (updates.start_time || updates.end_time) {
      const start = new Date(updates.start_time || entry.start_time);
      const end = new Date(updates.end_time || entry.end_time || new Date());
      updates.duration_seconds = Math.floor((end.getTime() - start.getTime()) / 1000) - entry.paused_duration_seconds;
    }

    const updatedEntry = {
      ...entry,
      ...updates,
      updated_at: new Date().toISOString(),
    };

    this.entries.set(entryId, updatedEntry);
    oracleCacheService.deleteByPrefix(`time:${userId}`);

    return updatedEntry;
  }

  /**
   * Delete an entry
   */
  async deleteEntry(userId: string, entryId: string): Promise<boolean> {
    const entry = this.entries.get(entryId);
    if (!entry || entry.user_id !== userId) {
      return false;
    }

    this.entries.delete(entryId);
    oracleCacheService.deleteByPrefix(`time:${userId}`);

    return true;
  }

  /**
   * Get entries for a date range
   */
  async getEntries(
    userId: string,
    options: {
      start_date?: string;
      end_date?: string;
      project_id?: string;
      task_id?: string;
      billable_only?: boolean;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<TimeEntry[]> {
    let entries = Array.from(this.entries.values())
      .filter((e) => e.user_id === userId && e.status === 'stopped');

    if (options.start_date) {
      entries = entries.filter((e) => e.start_time >= options.start_date!);
    }
    if (options.end_date) {
      entries = entries.filter((e) => e.start_time <= options.end_date!);
    }
    if (options.project_id) {
      entries = entries.filter((e) => e.project_id === options.project_id);
    }
    if (options.task_id) {
      entries = entries.filter((e) => e.task_id === options.task_id);
    }
    if (options.billable_only) {
      entries = entries.filter((e) => e.billable_status === 'billable');
    }

    // Sort by start time descending
    entries.sort((a, b) => b.start_time.localeCompare(a.start_time));

    const offset = options.offset || 0;
    const limit = options.limit || 50;

    return entries.slice(offset, offset + limit);
  }

  // ============================================================================
  // Project Management
  // ============================================================================

  /**
   * Create a project
   */
  async createProject(
    userId: string,
    project: Omit<Project, 'id' | 'user_id' | 'total_tracked_hours' | 'total_billed_amount' | 'created_at' | 'updated_at'>
  ): Promise<Project> {
    const now = new Date().toISOString();

    const newProject: Project = {
      id: crypto.randomUUID(),
      user_id: userId,
      ...project,
      total_tracked_hours: 0,
      total_billed_amount: 0,
      created_at: now,
      updated_at: now,
    };

    const userProjects = this.projects.get(userId) || [];
    userProjects.push(newProject);
    this.projects.set(userId, userProjects);

    return newProject;
  }

  /**
   * Get user projects
   */
  async getProjects(userId: string, activeOnly = true): Promise<Project[]> {
    const cacheKeyStr = cacheKey('time_projects', userId, activeOnly.toString());

    const cached = oracleCacheService.get<Project[]>(cacheKeyStr);
    if (cached) {
      return cached;
    }

    let projects = this.projects.get(userId) || [];
    if (activeOnly) {
      projects = projects.filter((p) => p.is_active);
    }

    oracleCacheService.set(cacheKeyStr, projects, TIME_CACHE_TTL.project);
    return projects;
  }

  /**
   * Update project totals
   */
  private async updateProjectTotals(userId: string, projectId: string): Promise<void> {
    const userProjects = this.projects.get(userId) || [];
    const project = userProjects.find((p) => p.id === projectId);
    if (!project) return;

    const entries = Array.from(this.entries.values())
      .filter((e) => e.user_id === userId && e.project_id === projectId && e.status === 'stopped');

    project.total_tracked_hours = entries.reduce((sum, e) => sum + e.duration_seconds / 3600, 0);
    project.total_billed_amount = entries
      .filter((e) => e.billable_status === 'billable')
      .reduce((sum, e) => sum + (e.duration_seconds / 3600) * (e.hourly_rate || project.hourly_rate || 0), 0);
    project.updated_at = new Date().toISOString();

    this.projects.set(userId, userProjects);
  }

  // ============================================================================
  // Time Estimates
  // ============================================================================

  /**
   * Create or update a time estimate
   */
  async setEstimate(
    userId: string,
    options: {
      task_id: string;
      task_name: string;
      project_id?: string;
      estimated_hours: number;
      confidence?: number;
      notes?: string;
    }
  ): Promise<TimeEstimate> {
    const userEstimates = this.estimates.get(userId) || [];
    const existingIndex = userEstimates.findIndex((e) => e.task_id === options.task_id);
    const now = new Date().toISOString();

    // Calculate actual hours from entries
    const entries = Array.from(this.entries.values())
      .filter((e) => e.user_id === userId && e.task_id === options.task_id && e.status === 'stopped');
    const actualHours = entries.reduce((sum, e) => sum + e.duration_seconds / 3600, 0);

    const estimate: TimeEstimate = {
      id: existingIndex >= 0 ? userEstimates[existingIndex].id : crypto.randomUUID(),
      user_id: userId,
      task_id: options.task_id,
      task_name: options.task_name,
      project_id: options.project_id,
      estimated_hours: options.estimated_hours,
      actual_hours: actualHours,
      variance_hours: actualHours - options.estimated_hours,
      variance_percentage: options.estimated_hours > 0
        ? ((actualHours - options.estimated_hours) / options.estimated_hours) * 100
        : 0,
      confidence: options.confidence || 0.7,
      completed: false,
      notes: options.notes,
      created_at: existingIndex >= 0 ? userEstimates[existingIndex].created_at : now,
      updated_at: now,
    };

    if (existingIndex >= 0) {
      userEstimates[existingIndex] = estimate;
    } else {
      userEstimates.push(estimate);
    }

    this.estimates.set(userId, userEstimates);

    return estimate;
  }

  /**
   * Update estimate actuals
   */
  private async updateEstimateActuals(userId: string, taskId: string, additionalHours: number): Promise<void> {
    const userEstimates = this.estimates.get(userId) || [];
    const estimate = userEstimates.find((e) => e.task_id === taskId);
    if (!estimate) return;

    estimate.actual_hours += additionalHours;
    estimate.variance_hours = estimate.actual_hours - estimate.estimated_hours;
    estimate.variance_percentage = estimate.estimated_hours > 0
      ? ((estimate.actual_hours - estimate.estimated_hours) / estimate.estimated_hours) * 100
      : 0;
    estimate.updated_at = new Date().toISOString();

    this.estimates.set(userId, userEstimates);
  }

  /**
   * Get estimates
   */
  async getEstimates(
    userId: string,
    options: {
      project_id?: string;
      include_completed?: boolean;
    } = {}
  ): Promise<TimeEstimate[]> {
    let estimates = this.estimates.get(userId) || [];

    if (options.project_id) {
      estimates = estimates.filter((e) => e.project_id === options.project_id);
    }
    if (!options.include_completed) {
      estimates = estimates.filter((e) => !e.completed);
    }

    return estimates;
  }

  /**
   * Mark estimate as complete
   */
  async completeEstimate(userId: string, taskId: string): Promise<TimeEstimate | null> {
    const userEstimates = this.estimates.get(userId) || [];
    const estimate = userEstimates.find((e) => e.task_id === taskId);
    if (!estimate) return null;

    estimate.completed = true;
    estimate.updated_at = new Date().toISOString();

    this.estimates.set(userId, userEstimates);

    return estimate;
  }

  // ============================================================================
  // Idle Detection
  // ============================================================================

  /**
   * Record an idle event
   */
  async recordIdleEvent(
    userId: string,
    entryId: string,
    event: {
      start_time: string;
      end_time: string;
      status: IdleStatus;
    }
  ): Promise<IdleEvent> {
    const start = new Date(event.start_time);
    const end = new Date(event.end_time);
    const durationSeconds = Math.floor((end.getTime() - start.getTime()) / 1000);

    const idleEvent: IdleEvent = {
      id: crypto.randomUUID(),
      user_id: userId,
      entry_id: entryId,
      start_time: event.start_time,
      end_time: event.end_time,
      duration_seconds: durationSeconds,
      status: event.status,
      action_taken: 'pending',
      created_at: new Date().toISOString(),
    };

    const userEvents = this.idleEvents.get(userId) || [];
    userEvents.push(idleEvent);
    this.idleEvents.set(userId, userEvents);

    return idleEvent;
  }

  /**
   * Handle idle time
   */
  async handleIdleTime(
    userId: string,
    eventId: string,
    action: 'kept' | 'discarded' | 'split',
    splitTime?: string
  ): Promise<{ event: IdleEvent; entry?: TimeEntry }> {
    const userEvents = this.idleEvents.get(userId) || [];
    const event = userEvents.find((e) => e.id === eventId);
    if (!event) {
      throw new Error('Idle event not found');
    }

    event.action_taken = action;

    if (action === 'discarded') {
      // Subtract idle time from entry
      const entry = this.entries.get(event.entry_id);
      if (entry) {
        entry.idle_duration_seconds += event.duration_seconds;
        entry.duration_seconds = Math.max(0, entry.duration_seconds - event.duration_seconds);
        entry.updated_at = new Date().toISOString();
        this.entries.set(entry.id, entry);
      }
    } else if (action === 'split' && splitTime) {
      // Split the entry at the idle time
      const entry = this.entries.get(event.entry_id);
      if (entry) {
        // Stop original entry at split time
        await this.updateEntry(userId, entry.id, {
          end_time: splitTime,
          status: 'stopped',
        });

        // Create new entry from after idle
        await this.createManualEntry(userId, {
          project_id: entry.project_id,
          project_name: entry.project_name,
          task_id: entry.task_id,
          task_name: entry.task_name,
          description: entry.description,
          billable_status: entry.billable_status,
          hourly_rate: entry.hourly_rate,
          start_time: event.end_time,
          end_time: new Date().toISOString(),
          tags: entry.tags,
        });
      }
    }

    this.idleEvents.set(userId, userEvents);

    return { event, entry: this.entries.get(event.entry_id) || undefined };
  }

  // ============================================================================
  // Reports
  // ============================================================================

  /**
   * Generate a time report
   */
  async generateReport(
    userId: string,
    options: {
      start_date: string;
      end_date: string;
      project_id?: string;
    }
  ): Promise<TimeReport> {
    const cacheKeyStr = cacheKey('time_report', userId, hashObject(options));

    const cached = oracleCacheService.get<TimeReport>(cacheKeyStr);
    if (cached) {
      return cached;
    }

    let entries = Array.from(this.entries.values())
      .filter((e) =>
        e.user_id === userId &&
        e.status === 'stopped' &&
        e.start_time >= options.start_date &&
        e.start_time <= options.end_date
      );

    if (options.project_id) {
      entries = entries.filter((e) => e.project_id === options.project_id);
    }

    // Summary calculations
    const totalHours = entries.reduce((sum, e) => sum + e.duration_seconds / 3600, 0);
    const billableEntries = entries.filter((e) => e.billable_status === 'billable');
    const billableHours = billableEntries.reduce((sum, e) => sum + e.duration_seconds / 3600, 0);
    const nonBillableHours = totalHours - billableHours;
    const billableAmount = billableEntries.reduce(
      (sum, e) => sum + (e.duration_seconds / 3600) * (e.hourly_rate || 0),
      0
    );

    // Unique counts
    const uniqueProjects = new Set(entries.map((e) => e.project_id).filter(Boolean));
    const uniqueTasks = new Set(entries.map((e) => e.task_id).filter(Boolean));

    // Day/hour stats
    const dayStats = new Map<number, number>();
    const hourStats = new Map<number, number>();
    const dailyStats = new Map<string, { hours: number; entries: number; projects: Set<string> }>();
    const projectStats = new Map<string, { name: string; hours: number; amount: number; entries: number }>();
    const tagStats = new Map<string, number>();

    entries.forEach((entry) => {
      const date = new Date(entry.start_time);
      const day = date.getDay();
      const hour = date.getHours();
      const dateStr = entry.start_time.split('T')[0];
      const hours = entry.duration_seconds / 3600;

      dayStats.set(day, (dayStats.get(day) || 0) + hours);
      hourStats.set(hour, (hourStats.get(hour) || 0) + hours);

      // Daily
      const daily = dailyStats.get(dateStr) || { hours: 0, entries: 0, projects: new Set() };
      daily.hours += hours;
      daily.entries += 1;
      if (entry.project_name) {
        daily.projects.add(entry.project_name);
      }
      dailyStats.set(dateStr, daily);

      // Project
      if (entry.project_id) {
        const proj = projectStats.get(entry.project_id) || { name: entry.project_name || '', hours: 0, amount: 0, entries: 0 };
        proj.hours += hours;
        proj.entries += 1;
        if (entry.billable_status === 'billable') {
          proj.amount += hours * (entry.hourly_rate || 0);
        }
        projectStats.set(entry.project_id, proj);
      }

      // Tags
      entry.tags.forEach((tag) => {
        tagStats.set(tag, (tagStats.get(tag) || 0) + hours);
      });
    });

    // Find most productive day and hour
    let mostProductiveDay = 0;
    let mostProductiveHour = 9;
    let maxDayHours = 0;
    let maxHourHours = 0;

    dayStats.forEach((hours, day) => {
      if (hours > maxDayHours) {
        maxDayHours = hours;
        mostProductiveDay = day;
      }
    });

    hourStats.forEach((hours, hour) => {
      if (hours > maxHourHours) {
        maxHourHours = hours;
        mostProductiveHour = hour;
      }
    });

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    // Estimate accuracy
    const userEstimates = this.estimates.get(userId) || [];
    const relevantEstimates = userEstimates.filter((e) =>
      entries.some((entry) => entry.task_id === e.task_id)
    );
    const totalEstimated = relevantEstimates.reduce((sum, e) => sum + e.estimated_hours, 0);
    const totalActual = relevantEstimates.reduce((sum, e) => sum + e.actual_hours, 0);

    const report: TimeReport = {
      period: {
        start_date: options.start_date,
        end_date: options.end_date,
      },
      summary: {
        total_hours: Math.round(totalHours * 100) / 100,
        billable_hours: Math.round(billableHours * 100) / 100,
        non_billable_hours: Math.round(nonBillableHours * 100) / 100,
        billable_amount: Math.round(billableAmount * 100) / 100,
        total_entries: entries.length,
        unique_projects: uniqueProjects.size,
        unique_tasks: uniqueTasks.size,
        average_entry_duration: entries.length > 0 ? Math.round((totalHours / entries.length) * 60) : 0,
        most_productive_day: dayNames[mostProductiveDay],
        most_productive_hour: mostProductiveHour,
      },
      by_project: Array.from(projectStats.entries()).map(([id, data]) => ({
        project_id: id,
        project_name: data.name,
        hours: Math.round(data.hours * 100) / 100,
        percentage: totalHours > 0 ? Math.round((data.hours / totalHours) * 100) : 0,
        billable_amount: Math.round(data.amount * 100) / 100,
        entries_count: data.entries,
      })).sort((a, b) => b.hours - a.hours),
      by_day: Array.from(dailyStats.entries()).map(([date, data]) => ({
        date,
        hours: Math.round(data.hours * 100) / 100,
        entries_count: data.entries,
        projects: Array.from(data.projects),
      })).sort((a, b) => a.date.localeCompare(b.date)),
      by_tag: Array.from(tagStats.entries()).map(([tag, hours]) => ({
        tag,
        hours: Math.round(hours * 100) / 100,
        percentage: totalHours > 0 ? Math.round((hours / totalHours) * 100) : 0,
      })).sort((a, b) => b.hours - a.hours),
      estimates: {
        total_estimated_hours: Math.round(totalEstimated * 100) / 100,
        total_actual_hours: Math.round(totalActual * 100) / 100,
        accuracy_percentage: totalEstimated > 0
          ? Math.round((1 - Math.abs(totalActual - totalEstimated) / totalEstimated) * 100)
          : 100,
        overrun_count: relevantEstimates.filter((e) => e.variance_hours > 0).length,
        underrun_count: relevantEstimates.filter((e) => e.variance_hours < 0).length,
      },
    };

    oracleCacheService.set(cacheKeyStr, report, TIME_CACHE_TTL.report);
    return report;
  }

  /**
   * Export time entries
   */
  async exportEntries(
    userId: string,
    options: {
      start_date: string;
      end_date: string;
      format: 'csv' | 'json';
      project_id?: string;
    }
  ): Promise<string> {
    const entries = await this.getEntries(userId, {
      start_date: options.start_date,
      end_date: options.end_date,
      project_id: options.project_id,
      limit: 10000,
    });

    if (options.format === 'json') {
      return JSON.stringify(entries, null, 2);
    }

    // CSV format
    const headers = [
      'Date',
      'Start Time',
      'End Time',
      'Duration (hours)',
      'Project',
      'Task',
      'Description',
      'Billable',
      'Hourly Rate',
      'Amount',
      'Tags',
    ];

    const rows = entries.map((e) => {
      const hours = e.duration_seconds / 3600;
      const amount = e.billable_status === 'billable' ? hours * (e.hourly_rate || 0) : 0;
      return [
        e.start_time.split('T')[0],
        new Date(e.start_time).toLocaleTimeString(),
        e.end_time ? new Date(e.end_time).toLocaleTimeString() : '',
        hours.toFixed(2),
        e.project_name || '',
        e.task_name || '',
        e.description || '',
        e.billable_status,
        e.hourly_rate?.toString() || '',
        amount.toFixed(2),
        e.tags.join('; '),
      ];
    });

    return [headers.join(','), ...rows.map((r) => r.map((c) => `"${c}"`).join(','))].join('\n');
  }

  // ============================================================================
  // Settings
  // ============================================================================

  /**
   * Get user settings
   */
  async getSettings(userId: string): Promise<TimeTrackerSettings> {
    const cacheKeyStr = cacheKey('time_settings', userId);

    const cached = oracleCacheService.get<TimeTrackerSettings>(cacheKeyStr);
    if (cached) {
      return cached;
    }

    let settings = this.settings.get(userId);

    if (!settings) {
      settings = {
        user_id: userId,
        default_billable_status: 'billable',
        auto_track_calendar: false,
        idle_detection_enabled: true,
        idle_threshold_minutes: 5,
        idle_action: 'prompt',
        round_to_nearest_minutes: 0,
        minimum_entry_minutes: 1,
        auto_stop_timer_at_day_end: false,
        day_end_time: '18:00',
        reminder_enabled: false,
        reminder_interval_minutes: 30,
        weekly_hour_goal: 40,
        updated_at: new Date().toISOString(),
      };
      this.settings.set(userId, settings);
    }

    oracleCacheService.set(cacheKeyStr, settings, TIME_CACHE_TTL.settings);
    return settings;
  }

  /**
   * Update settings
   */
  async updateSettings(
    userId: string,
    updates: Partial<Omit<TimeTrackerSettings, 'user_id' | 'updated_at'>>
  ): Promise<TimeTrackerSettings> {
    const settings = await this.getSettings(userId);

    const updatedSettings = {
      ...settings,
      ...updates,
      updated_at: new Date().toISOString(),
    };

    this.settings.set(userId, updatedSettings);
    oracleCacheService.delete(cacheKey('time_settings', userId));

    return updatedSettings;
  }

  // ============================================================================
  // Calendar Integration
  // ============================================================================

  /**
   * Configure calendar sync
   */
  async configureCalendarSync(
    userId: string,
    config: Omit<CalendarSync, 'user_id' | 'last_sync_at'>
  ): Promise<CalendarSync> {
    const sync: CalendarSync = {
      user_id: userId,
      ...config,
    };

    this.calendarSyncs.set(userId, sync);

    return sync;
  }

  /**
   * Create entries from calendar events
   */
  async createEntriesFromCalendar(
    userId: string,
    events: Array<{
      id: string;
      title: string;
      start_time: string;
      end_time: string;
      project_hint?: string;
    }>
  ): Promise<TimeEntry[]> {
    const createdEntries: TimeEntry[] = [];
    const sync = this.calendarSyncs.get(userId);

    for (const event of events) {
      // Check exclude patterns
      if (sync?.exclude_patterns.some((pattern) => event.title.toLowerCase().includes(pattern.toLowerCase()))) {
        continue;
      }

      const entry = await this.createManualEntry(userId, {
        description: event.title,
        start_time: event.start_time,
        end_time: event.end_time,
        billable_status: sync?.default_billable ? 'billable' : 'non_billable',
      });

      entry.source = 'calendar';
      entry.calendar_event_id = event.id;

      this.entries.set(entry.id, entry);
      createdEntries.push(entry);
    }

    if (sync) {
      sync.last_sync_at = new Date().toISOString();
      this.calendarSyncs.set(userId, sync);
    }

    return createdEntries;
  }
}

// Singleton instance
export const timeTrackerService = new TimeTrackerService();
