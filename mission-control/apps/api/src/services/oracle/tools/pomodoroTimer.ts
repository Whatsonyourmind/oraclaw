/**
 * ORACLE Pomodoro Timer Service
 * Implements the Pomodoro Technique for focused work sessions
 *
 * Features:
 * - Configurable work/break durations
 * - Session tracking
 * - Daily/weekly Pomodoro stats
 * - Integration with tasks (link Pomodoros to tasks)
 * - Smart break suggestions
 * - Focus chain tracking (streaks)
 */

import { oracleCacheService, cacheKey, hashObject } from '../cache';

// ============================================================================
// Types
// ============================================================================

export type PomodoroStatus = 'idle' | 'working' | 'short_break' | 'long_break' | 'paused' | 'completed';
export type PomodoroPhase = 'work' | 'short_break' | 'long_break';

export interface PomodoroSession {
  id: string;
  user_id: string;
  task_id?: string;
  task_title?: string;
  status: PomodoroStatus;
  phase: PomodoroPhase;
  current_pomodoro: number; // Which pomodoro in the set (1-4 typically)
  total_pomodoros_target: number;
  work_duration_minutes: number;
  short_break_duration_minutes: number;
  long_break_duration_minutes: number;
  start_time: string;
  phase_start_time: string;
  phase_end_time?: string;
  pause_time?: string;
  paused_duration_seconds: number;
  completed_pomodoros: number;
  interruptions: PomodoroInterruption[];
  notes?: string;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface PomodoroInterruption {
  id: string;
  pomodoro_number: number;
  timestamp: string;
  type: 'internal' | 'external';
  description?: string;
  handled: 'paused' | 'ignored' | 'addressed';
}

export interface PomodoroRecord {
  id: string;
  user_id: string;
  session_id: string;
  task_id?: string;
  task_title?: string;
  pomodoro_number: number;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  was_completed: boolean;
  interruptions_count: number;
  notes?: string;
  created_at: string;
}

export interface PomodoroStats {
  total_pomodoros: number;
  completed_pomodoros: number;
  completion_rate: number;
  total_focus_minutes: number;
  average_pomodoros_per_day: number;
  longest_chain: number;
  current_chain: number;
  total_interruptions: number;
  most_productive_day: string;
  most_productive_hour: number;
  weekly_pomodoros: number[];
  tasks_with_most_pomodoros: Array<{
    task_id: string;
    task_title: string;
    pomodoro_count: number;
  }>;
}

export interface DailyPomodoroSummary {
  date: string;
  total_pomodoros: number;
  completed_pomodoros: number;
  total_focus_minutes: number;
  tasks_worked_on: Array<{
    task_id?: string;
    task_title?: string;
    pomodoros: number;
  }>;
  chain_length: number;
  interruptions: number;
}

export interface PomodoroSettings {
  user_id: string;
  work_duration_minutes: number;
  short_break_duration_minutes: number;
  long_break_duration_minutes: number;
  pomodoros_before_long_break: number;
  auto_start_break: boolean;
  auto_start_work: boolean;
  sound_enabled: boolean;
  vibration_enabled: boolean;
  notification_before_end_seconds: number;
  daily_goal: number;
  updated_at: string;
}

export interface SmartBreakSuggestion {
  activity: string;
  duration_minutes: number;
  category: 'physical' | 'mental' | 'social' | 'rest';
  energy_impact: 'energizing' | 'calming' | 'neutral';
  reason: string;
}

// Cache TTLs
const POMODORO_CACHE_TTL = {
  session: 30 * 1000, // 30 seconds
  stats: 5 * 60 * 1000, // 5 minutes
  settings: 10 * 60 * 1000, // 10 minutes
  daily: 2 * 60 * 1000, // 2 minutes
};

// Break suggestions by type
const BREAK_SUGGESTIONS: Record<string, SmartBreakSuggestion[]> = {
  short: [
    { activity: 'Stand and stretch your body', duration_minutes: 5, category: 'physical', energy_impact: 'energizing', reason: 'Sitting for extended periods can cause muscle tension' },
    { activity: 'Walk to get some water', duration_minutes: 5, category: 'physical', energy_impact: 'energizing', reason: 'Staying hydrated improves cognitive function' },
    { activity: 'Look out a window at distant objects', duration_minutes: 5, category: 'rest', energy_impact: 'calming', reason: 'Gives your eyes a break from the screen' },
    { activity: 'Do 10 deep breaths', duration_minutes: 3, category: 'mental', energy_impact: 'calming', reason: 'Deep breathing reduces stress hormones' },
    { activity: 'Tidy your immediate workspace', duration_minutes: 5, category: 'mental', energy_impact: 'neutral', reason: 'A clean workspace reduces mental clutter' },
  ],
  long: [
    { activity: 'Take a walk outside', duration_minutes: 15, category: 'physical', energy_impact: 'energizing', reason: 'Sunlight and movement boost energy and mood' },
    { activity: 'Have a healthy snack', duration_minutes: 10, category: 'rest', energy_impact: 'energizing', reason: 'Fuel your brain for the next session' },
    { activity: 'Do a quick workout or yoga', duration_minutes: 15, category: 'physical', energy_impact: 'energizing', reason: 'Exercise increases blood flow and mental clarity' },
    { activity: 'Call a friend or family member', duration_minutes: 10, category: 'social', energy_impact: 'neutral', reason: 'Social connection reduces work stress' },
    { activity: 'Practice a short meditation', duration_minutes: 10, category: 'mental', energy_impact: 'calming', reason: 'Meditation restores focus and reduces fatigue' },
    { activity: 'Take a power nap', duration_minutes: 15, category: 'rest', energy_impact: 'energizing', reason: 'Short naps improve alertness and memory' },
  ],
};

// ============================================================================
// Pomodoro Timer Service
// ============================================================================

export class PomodoroTimerService {
  // In-memory stores (would use database in production)
  private sessions: Map<string, PomodoroSession> = new Map();
  private records: Map<string, PomodoroRecord[]> = new Map();
  private settings: Map<string, PomodoroSettings> = new Map();
  private chains: Map<string, { date: string; count: number }[]> = new Map();

  // ============================================================================
  // Session Management
  // ============================================================================

  /**
   * Start a new Pomodoro session
   */
  async startSession(
    userId: string,
    options: {
      task_id?: string;
      task_title?: string;
      target_pomodoros?: number;
      work_duration?: number;
      short_break?: number;
      long_break?: number;
    } = {}
  ): Promise<PomodoroSession> {
    // Check for active session
    const activeSession = await this.getActiveSession(userId);
    if (activeSession) {
      throw new Error('You already have an active Pomodoro session. Please end it first.');
    }

    const userSettings = await this.getSettings(userId);
    const now = new Date().toISOString();

    const session: PomodoroSession = {
      id: crypto.randomUUID(),
      user_id: userId,
      task_id: options.task_id,
      task_title: options.task_title,
      status: 'working',
      phase: 'work',
      current_pomodoro: 1,
      total_pomodoros_target: options.target_pomodoros || 4,
      work_duration_minutes: options.work_duration || userSettings.work_duration_minutes,
      short_break_duration_minutes: options.short_break || userSettings.short_break_duration_minutes,
      long_break_duration_minutes: options.long_break || userSettings.long_break_duration_minutes,
      start_time: now,
      phase_start_time: now,
      paused_duration_seconds: 0,
      completed_pomodoros: 0,
      interruptions: [],
      metadata: {},
      created_at: now,
      updated_at: now,
    };

    this.sessions.set(session.id, session);
    oracleCacheService.deleteByPrefix(`pomodoro:${userId}`);

    return session;
  }

  /**
   * Get active Pomodoro session
   */
  async getActiveSession(userId: string): Promise<PomodoroSession | null> {
    const cacheKeyStr = cacheKey('pomodoro_active', userId);

    const cached = oracleCacheService.get<PomodoroSession>(cacheKeyStr);
    if (cached) {
      return cached;
    }

    for (const session of this.sessions.values()) {
      if (
        session.user_id === userId &&
        ['working', 'short_break', 'long_break', 'paused'].includes(session.status)
      ) {
        oracleCacheService.set(cacheKeyStr, session, POMODORO_CACHE_TTL.session);
        return session;
      }
    }

    return null;
  }

  /**
   * Get remaining time in current phase (in seconds)
   */
  async getRemainingTime(userId: string): Promise<{ minutes: number; seconds: number; phase: PomodoroPhase } | null> {
    const session = await this.getActiveSession(userId);
    if (!session || session.status === 'paused') {
      return null;
    }

    const phaseDuration =
      session.phase === 'work' ? session.work_duration_minutes :
      session.phase === 'short_break' ? session.short_break_duration_minutes :
      session.long_break_duration_minutes;

    const phaseStart = new Date(session.phase_start_time);
    const now = new Date();
    const elapsedSeconds = Math.floor((now.getTime() - phaseStart.getTime()) / 1000) - session.paused_duration_seconds;
    const totalSeconds = phaseDuration * 60;
    const remainingSeconds = Math.max(0, totalSeconds - elapsedSeconds);

    return {
      minutes: Math.floor(remainingSeconds / 60),
      seconds: remainingSeconds % 60,
      phase: session.phase,
    };
  }

  /**
   * Pause the current session
   */
  async pauseSession(userId: string): Promise<PomodoroSession | null> {
    const session = await this.getActiveSession(userId);
    if (!session || !['working', 'short_break', 'long_break'].includes(session.status)) {
      return null;
    }

    session.status = 'paused';
    session.pause_time = new Date().toISOString();
    session.updated_at = new Date().toISOString();

    this.sessions.set(session.id, session);
    oracleCacheService.delete(cacheKey('pomodoro_active', userId));

    return session;
  }

  /**
   * Resume a paused session
   */
  async resumeSession(userId: string): Promise<PomodoroSession | null> {
    const session = await this.getActiveSession(userId);
    if (!session || session.status !== 'paused') {
      return null;
    }

    // Calculate paused duration
    if (session.pause_time) {
      const pauseStart = new Date(session.pause_time);
      const now = new Date();
      const pausedSeconds = Math.floor((now.getTime() - pauseStart.getTime()) / 1000);
      session.paused_duration_seconds += pausedSeconds;
    }

    // Resume to previous phase
    session.status = session.phase === 'work' ? 'working' : session.phase === 'short_break' ? 'short_break' : 'long_break';
    session.pause_time = undefined;
    session.updated_at = new Date().toISOString();

    this.sessions.set(session.id, session);
    oracleCacheService.delete(cacheKey('pomodoro_active', userId));

    return session;
  }

  /**
   * Complete current work phase (Pomodoro)
   */
  async completePomodoro(userId: string, notes?: string): Promise<{
    session: PomodoroSession;
    completed: boolean;
    next_phase: PomodoroPhase;
    break_suggestion?: SmartBreakSuggestion;
  }> {
    const session = await this.getActiveSession(userId);
    if (!session || session.phase !== 'work') {
      throw new Error('No active work phase to complete');
    }

    const now = new Date();

    // Record the completed pomodoro
    const record: PomodoroRecord = {
      id: crypto.randomUUID(),
      user_id: userId,
      session_id: session.id,
      task_id: session.task_id,
      task_title: session.task_title,
      pomodoro_number: session.current_pomodoro,
      start_time: session.phase_start_time,
      end_time: now.toISOString(),
      duration_minutes: session.work_duration_minutes,
      was_completed: true,
      interruptions_count: session.interruptions.filter((i) => i.pomodoro_number === session.current_pomodoro).length,
      notes,
      created_at: now.toISOString(),
    };

    const userRecords = this.records.get(userId) || [];
    userRecords.push(record);
    this.records.set(userId, userRecords);

    // Update session
    session.completed_pomodoros += 1;
    session.phase_end_time = now.toISOString();

    // Determine next phase
    const settings = await this.getSettings(userId);
    let nextPhase: PomodoroPhase;
    let breakSuggestion: SmartBreakSuggestion | undefined;

    if (session.completed_pomodoros >= session.total_pomodoros_target) {
      // Session complete
      session.status = 'completed';
      nextPhase = 'long_break';
      await this.updateChain(userId, session.completed_pomodoros);
    } else if (session.completed_pomodoros % settings.pomodoros_before_long_break === 0) {
      // Long break
      session.phase = 'long_break';
      session.status = 'long_break';
      nextPhase = 'long_break';
      breakSuggestion = this.getSmartBreakSuggestion('long', session);
    } else {
      // Short break
      session.phase = 'short_break';
      session.status = 'short_break';
      nextPhase = 'short_break';
      breakSuggestion = this.getSmartBreakSuggestion('short', session);
    }

    session.phase_start_time = now.toISOString();
    session.paused_duration_seconds = 0;
    session.updated_at = now.toISOString();

    this.sessions.set(session.id, session);
    oracleCacheService.deleteByPrefix(`pomodoro:${userId}`);

    return {
      session,
      completed: session.status === 'completed',
      next_phase: nextPhase,
      break_suggestion: breakSuggestion,
    };
  }

  /**
   * Complete current break phase
   */
  async completeBreak(userId: string): Promise<PomodoroSession> {
    const session = await this.getActiveSession(userId);
    if (!session || !['short_break', 'long_break'].includes(session.phase)) {
      throw new Error('No active break to complete');
    }

    const now = new Date();

    session.phase = 'work';
    session.status = 'working';
    session.current_pomodoro += 1;
    session.phase_start_time = now.toISOString();
    session.phase_end_time = undefined;
    session.paused_duration_seconds = 0;
    session.updated_at = now.toISOString();

    this.sessions.set(session.id, session);
    oracleCacheService.delete(cacheKey('pomodoro_active', userId));

    return session;
  }

  /**
   * Skip current break
   */
  async skipBreak(userId: string): Promise<PomodoroSession> {
    return this.completeBreak(userId);
  }

  /**
   * End session early
   */
  async endSession(userId: string): Promise<PomodoroSession | null> {
    const session = await this.getActiveSession(userId);
    if (!session) {
      return null;
    }

    session.status = 'completed';
    session.phase_end_time = new Date().toISOString();
    session.updated_at = new Date().toISOString();

    this.sessions.set(session.id, session);

    // Update chain if any pomodoros were completed
    if (session.completed_pomodoros > 0) {
      await this.updateChain(userId, session.completed_pomodoros);
    }

    oracleCacheService.deleteByPrefix(`pomodoro:${userId}`);

    return session;
  }

  /**
   * Record an interruption
   */
  async recordInterruption(
    userId: string,
    interruption: Omit<PomodoroInterruption, 'id' | 'timestamp' | 'pomodoro_number'>
  ): Promise<PomodoroSession | null> {
    const session = await this.getActiveSession(userId);
    if (!session) {
      return null;
    }

    session.interruptions.push({
      id: crypto.randomUUID(),
      pomodoro_number: session.current_pomodoro,
      timestamp: new Date().toISOString(),
      ...interruption,
    });
    session.updated_at = new Date().toISOString();

    this.sessions.set(session.id, session);
    oracleCacheService.delete(cacheKey('pomodoro_active', userId));

    return session;
  }

  /**
   * Get smart break suggestion
   */
  private getSmartBreakSuggestion(breakType: 'short' | 'long', session: PomodoroSession): SmartBreakSuggestion {
    const suggestions = BREAK_SUGGESTIONS[breakType];

    // Consider session context for smarter suggestion
    const interruptionCount = session.interruptions.length;

    if (interruptionCount > 3) {
      // High interruptions - suggest calming activities
      const calmingSuggestions = suggestions.filter((s) => s.energy_impact === 'calming');
      return calmingSuggestions[Math.floor(Math.random() * calmingSuggestions.length)] || suggestions[0];
    }

    // Random suggestion otherwise
    return suggestions[Math.floor(Math.random() * suggestions.length)];
  }

  // ============================================================================
  // Chain (Streak) Tracking
  // ============================================================================

  /**
   * Update focus chain
   */
  private async updateChain(userId: string, pomodorosCompleted: number): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    const userChains = this.chains.get(userId) || [];

    const todayChain = userChains.find((c) => c.date === today);
    if (todayChain) {
      todayChain.count += pomodorosCompleted;
    } else {
      userChains.push({ date: today, count: pomodorosCompleted });
    }

    this.chains.set(userId, userChains);
  }

  /**
   * Get current chain length (consecutive days with pomodoros)
   */
  async getCurrentChain(userId: string): Promise<number> {
    const userChains = this.chains.get(userId) || [];
    if (userChains.length === 0) {
      return 0;
    }

    // Sort by date descending
    const sorted = [...userChains].sort((a, b) => b.date.localeCompare(a.date));

    let chain = 0;
    const today = new Date();

    for (let i = 0; i < sorted.length; i++) {
      const expectedDate = new Date(today);
      expectedDate.setDate(today.getDate() - i);
      const expectedDateStr = expectedDate.toISOString().split('T')[0];

      if (sorted[i].date === expectedDateStr && sorted[i].count > 0) {
        chain++;
      } else if (i === 0 && sorted[i].date !== expectedDateStr) {
        // Today has no pomodoros, but check yesterday
        expectedDate.setDate(today.getDate() - 1);
        const yesterdayStr = expectedDate.toISOString().split('T')[0];
        if (sorted[i].date === yesterdayStr) {
          chain++;
        } else {
          break;
        }
      } else {
        break;
      }
    }

    return chain;
  }

  /**
   * Get longest chain
   */
  async getLongestChain(userId: string): Promise<number> {
    const userChains = this.chains.get(userId) || [];
    if (userChains.length === 0) {
      return 0;
    }

    const sorted = [...userChains].sort((a, b) => a.date.localeCompare(b.date));

    let longest = 0;
    let current = 0;
    let prevDate: Date | null = null;

    for (const chain of sorted) {
      if (chain.count === 0) {
        current = 0;
        prevDate = null;
        continue;
      }

      const currentDate = new Date(chain.date);
      if (prevDate) {
        const diffDays = Math.floor((currentDate.getTime() - prevDate.getTime()) / (24 * 60 * 60 * 1000));
        if (diffDays === 1) {
          current++;
        } else {
          current = 1;
        }
      } else {
        current = 1;
      }

      longest = Math.max(longest, current);
      prevDate = currentDate;
    }

    return longest;
  }

  // ============================================================================
  // Statistics
  // ============================================================================

  /**
   * Get Pomodoro statistics
   */
  async getStats(
    userId: string,
    options: {
      start_date?: string;
      end_date?: string;
    } = {}
  ): Promise<PomodoroStats> {
    const cacheKeyStr = cacheKey('pomodoro_stats', userId, hashObject(options));

    const cached = oracleCacheService.get<PomodoroStats>(cacheKeyStr);
    if (cached) {
      return cached;
    }

    const startDate = options.start_date || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const endDate = options.end_date || new Date().toISOString();

    const userRecords = (this.records.get(userId) || []).filter(
      (r) => r.created_at >= startDate && r.created_at <= endDate
    );

    // Calculate stats
    const totalPomodoros = userRecords.length;
    const completedPomodoros = userRecords.filter((r) => r.was_completed).length;
    const totalFocusMinutes = userRecords.reduce((sum, r) => sum + r.duration_minutes, 0);
    const totalInterruptions = userRecords.reduce((sum, r) => sum + r.interruptions_count, 0);

    // Day stats
    const dayStats = new Map<number, number>();
    const hourStats = new Map<number, number>();
    const taskStats = new Map<string, { title: string; count: number }>();

    userRecords.forEach((record) => {
      const date = new Date(record.start_time);
      const day = date.getDay();
      const hour = date.getHours();

      dayStats.set(day, (dayStats.get(day) || 0) + 1);
      hourStats.set(hour, (hourStats.get(hour) || 0) + 1);

      if (record.task_id) {
        const current = taskStats.get(record.task_id) || { title: record.task_title || 'Unknown', count: 0 };
        taskStats.set(record.task_id, { title: current.title, count: current.count + 1 });
      }
    });

    let mostProductiveDay = 0;
    let mostProductiveHour = 9;
    let maxDayCount = 0;
    let maxHourCount = 0;

    dayStats.forEach((count, day) => {
      if (count > maxDayCount) {
        maxDayCount = count;
        mostProductiveDay = day;
      }
    });

    hourStats.forEach((count, hour) => {
      if (count > maxHourCount) {
        maxHourCount = count;
        mostProductiveHour = hour;
      }
    });

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    // Weekly pomodoros
    const weeklyPomodoros: number[] = [0, 0, 0, 0, 0, 0, 0];
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    userRecords
      .filter((r) => new Date(r.created_at) >= oneWeekAgo)
      .forEach((record) => {
        const dayOfWeek = new Date(record.start_time).getDay();
        weeklyPomodoros[dayOfWeek]++;
      });

    // Top tasks
    const tasksWithMostPomodoros = Array.from(taskStats.entries())
      .map(([id, data]) => ({ task_id: id, task_title: data.title, pomodoro_count: data.count }))
      .sort((a, b) => b.pomodoro_count - a.pomodoro_count)
      .slice(0, 5);

    // Calculate days in range for average
    const daysDiff = Math.max(1, Math.ceil(
      (new Date(endDate).getTime() - new Date(startDate).getTime()) / (24 * 60 * 60 * 1000)
    ));

    const stats: PomodoroStats = {
      total_pomodoros: totalPomodoros,
      completed_pomodoros: completedPomodoros,
      completion_rate: totalPomodoros > 0 ? Math.round((completedPomodoros / totalPomodoros) * 100) / 100 : 0,
      total_focus_minutes: totalFocusMinutes,
      average_pomodoros_per_day: Math.round((totalPomodoros / daysDiff) * 10) / 10,
      longest_chain: await this.getLongestChain(userId),
      current_chain: await this.getCurrentChain(userId),
      total_interruptions: totalInterruptions,
      most_productive_day: dayNames[mostProductiveDay],
      most_productive_hour: mostProductiveHour,
      weekly_pomodoros: weeklyPomodoros,
      tasks_with_most_pomodoros: tasksWithMostPomodoros,
    };

    oracleCacheService.set(cacheKeyStr, stats, POMODORO_CACHE_TTL.stats);
    return stats;
  }

  /**
   * Get daily summary
   */
  async getDailySummary(userId: string, date?: string): Promise<DailyPomodoroSummary> {
    const targetDate = date || new Date().toISOString().split('T')[0];
    const cacheKeyStr = cacheKey('pomodoro_daily', userId, targetDate);

    const cached = oracleCacheService.get<DailyPomodoroSummary>(cacheKeyStr);
    if (cached) {
      return cached;
    }

    const userRecords = (this.records.get(userId) || []).filter(
      (r) => r.created_at.startsWith(targetDate)
    );

    // Group by task
    const taskGroups = new Map<string, { title?: string; count: number }>();
    userRecords.forEach((record) => {
      const key = record.task_id || 'no-task';
      const current = taskGroups.get(key) || { title: record.task_title, count: 0 };
      taskGroups.set(key, { title: current.title, count: current.count + 1 });
    });

    const summary: DailyPomodoroSummary = {
      date: targetDate,
      total_pomodoros: userRecords.length,
      completed_pomodoros: userRecords.filter((r) => r.was_completed).length,
      total_focus_minutes: userRecords.reduce((sum, r) => sum + r.duration_minutes, 0),
      tasks_worked_on: Array.from(taskGroups.entries()).map(([id, data]) => ({
        task_id: id === 'no-task' ? undefined : id,
        task_title: data.title,
        pomodoros: data.count,
      })),
      chain_length: await this.getCurrentChain(userId),
      interruptions: userRecords.reduce((sum, r) => sum + r.interruptions_count, 0),
    };

    oracleCacheService.set(cacheKeyStr, summary, POMODORO_CACHE_TTL.daily);
    return summary;
  }

  // ============================================================================
  // Settings
  // ============================================================================

  /**
   * Get user settings
   */
  async getSettings(userId: string): Promise<PomodoroSettings> {
    const cacheKeyStr = cacheKey('pomodoro_settings', userId);

    const cached = oracleCacheService.get<PomodoroSettings>(cacheKeyStr);
    if (cached) {
      return cached;
    }

    let settings = this.settings.get(userId);

    if (!settings) {
      settings = {
        user_id: userId,
        work_duration_minutes: 25,
        short_break_duration_minutes: 5,
        long_break_duration_minutes: 15,
        pomodoros_before_long_break: 4,
        auto_start_break: false,
        auto_start_work: false,
        sound_enabled: true,
        vibration_enabled: true,
        notification_before_end_seconds: 30,
        daily_goal: 8,
        updated_at: new Date().toISOString(),
      };
      this.settings.set(userId, settings);
    }

    oracleCacheService.set(cacheKeyStr, settings, POMODORO_CACHE_TTL.settings);
    return settings;
  }

  /**
   * Update settings
   */
  async updateSettings(
    userId: string,
    updates: Partial<Omit<PomodoroSettings, 'user_id' | 'updated_at'>>
  ): Promise<PomodoroSettings> {
    const settings = await this.getSettings(userId);

    const updatedSettings: PomodoroSettings = {
      ...settings,
      ...updates,
      updated_at: new Date().toISOString(),
    };

    this.settings.set(userId, updatedSettings);
    oracleCacheService.delete(cacheKey('pomodoro_settings', userId));

    return updatedSettings;
  }

  // ============================================================================
  // Task Integration
  // ============================================================================

  /**
   * Get pomodoros for a specific task
   */
  async getPomodorosForTask(userId: string, taskId: string): Promise<PomodoroRecord[]> {
    const userRecords = this.records.get(userId) || [];
    return userRecords.filter((r) => r.task_id === taskId);
  }

  /**
   * Get total time spent on a task
   */
  async getTaskTimeSpent(userId: string, taskId: string): Promise<number> {
    const records = await this.getPomodorosForTask(userId, taskId);
    return records.reduce((sum, r) => sum + r.duration_minutes, 0);
  }

  /**
   * Link current session to a task
   */
  async linkSessionToTask(userId: string, taskId: string, taskTitle: string): Promise<PomodoroSession | null> {
    const session = await this.getActiveSession(userId);
    if (!session) {
      return null;
    }

    session.task_id = taskId;
    session.task_title = taskTitle;
    session.updated_at = new Date().toISOString();

    this.sessions.set(session.id, session);
    oracleCacheService.delete(cacheKey('pomodoro_active', userId));

    return session;
  }
}

// Singleton instance
export const pomodoroTimerService = new PomodoroTimerService();
