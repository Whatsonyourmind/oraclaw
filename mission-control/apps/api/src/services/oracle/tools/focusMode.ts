/**
 * ORACLE Focus Mode Service
 * Deep work assistant for achieving flow state and maximizing productivity
 *
 * Features:
 * - Focus session management
 * - Distraction blocking rules
 * - Notification batching during focus
 * - Focus music/ambient sound triggers
 * - Break reminders (Pomodoro compatible)
 * - Focus score tracking
 * - Optimal focus time suggestions
 */

import { oracleCacheService, cacheKey, hashObject } from '../cache';

// ============================================================================
// Types
// ============================================================================

export type FocusSessionStatus = 'idle' | 'focusing' | 'break' | 'paused' | 'completed';
export type DistractionLevel = 'none' | 'low' | 'medium' | 'high' | 'critical';
export type SoundType = 'none' | 'white_noise' | 'brown_noise' | 'rain' | 'forest' | 'cafe' | 'ocean' | 'focus_music' | 'binaural';
export type BreakType = 'micro' | 'short' | 'long' | 'custom';

export interface FocusSession {
  id: string;
  user_id: string;
  task_id?: string;
  task_title?: string;
  status: FocusSessionStatus;
  target_duration_minutes: number;
  actual_duration_minutes: number;
  start_time: string;
  end_time?: string;
  pause_time?: string;
  paused_duration_minutes: number;
  interruptions: FocusInterruption[];
  focus_score: number;
  distraction_level: DistractionLevel;
  sound_type: SoundType;
  notes?: string;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface FocusInterruption {
  id: string;
  timestamp: string;
  type: 'notification' | 'break' | 'external' | 'self_distracted' | 'urgent';
  source?: string;
  duration_seconds: number;
  was_necessary: boolean;
  notes?: string;
}

export interface DistractionRule {
  id: string;
  user_id: string;
  name: string;
  type: 'block_app' | 'block_website' | 'mute_notification' | 'delay_notification';
  target: string; // app name, website domain, or notification source
  is_active: boolean;
  schedule?: {
    days: number[]; // 0-6, Sunday-Saturday
    start_time?: string; // HH:mm
    end_time?: string; // HH:mm
  };
  created_at: string;
}

export interface NotificationBatch {
  id: string;
  user_id: string;
  session_id: string;
  notifications: BatchedNotification[];
  delivery_time?: string;
  is_delivered: boolean;
  created_at: string;
}

export interface BatchedNotification {
  id: string;
  source: string;
  title: string;
  body: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  received_at: string;
  metadata?: Record<string, any>;
}

export interface BreakReminder {
  id: string;
  session_id: string;
  break_type: BreakType;
  duration_minutes: number;
  scheduled_time: string;
  is_taken: boolean;
  actual_duration_minutes?: number;
  activity_suggestion?: string;
}

export interface FocusScore {
  user_id: string;
  date: string;
  daily_score: number;
  total_focus_minutes: number;
  total_sessions: number;
  completed_sessions: number;
  average_session_length: number;
  interruption_count: number;
  deepest_focus_session_id?: string;
  best_focus_time_of_day?: string;
  streak_days: number;
}

export interface FocusStats {
  total_focus_time_minutes: number;
  average_session_length: number;
  total_sessions: number;
  completed_sessions: number;
  completion_rate: number;
  average_focus_score: number;
  total_interruptions: number;
  most_productive_day: string;
  most_productive_time: string;
  current_streak: number;
  longest_streak: number;
  preferred_sound: SoundType;
  weekly_trend: number; // percentage change
}

export interface OptimalFocusTime {
  time_of_day: string;
  day_of_week: number;
  predicted_focus_score: number;
  reason: string;
  energy_level: string;
  suggested_duration_minutes: number;
}

export interface FocusSettings {
  user_id: string;
  default_session_duration: number;
  short_break_duration: number;
  long_break_duration: number;
  sessions_before_long_break: number;
  auto_start_breaks: boolean;
  auto_start_next_session: boolean;
  default_sound: SoundType;
  enable_dnd: boolean;
  block_notifications: boolean;
  show_timer_overlay: boolean;
  vibrate_on_complete: boolean;
  notification_batching: boolean;
  break_activity_suggestions: boolean;
  updated_at: string;
}

// Cache TTLs
const FOCUS_CACHE_TTL = {
  session: 30 * 1000, // 30 seconds
  stats: 5 * 60 * 1000, // 5 minutes
  score: 60 * 1000, // 1 minute
  settings: 10 * 60 * 1000, // 10 minutes
};

// Break activity suggestions
const BREAK_ACTIVITIES: Record<BreakType, string[]> = {
  micro: [
    'Stand up and stretch',
    'Take 5 deep breaths',
    'Look at something 20 feet away for 20 seconds',
    'Roll your shoulders',
    'Close your eyes and relax',
  ],
  short: [
    'Walk around the room',
    'Get some water',
    'Do a quick stretching routine',
    'Step outside for fresh air',
    'Practice mindful breathing',
    'Make a healthy snack',
  ],
  long: [
    'Take a walk outside',
    'Have a proper meal',
    'Do a 10-minute meditation',
    'Call a friend or family member',
    'Do some light exercise',
    'Read something enjoyable',
    'Take a power nap (15-20 min)',
  ],
  custom: [
    'Take a break and do something you enjoy',
    'Stretch and move around',
    'Hydrate and rest your eyes',
  ],
};

// ============================================================================
// Focus Mode Service
// ============================================================================

export class FocusModeService {
  // In-memory stores (would use database in production)
  private sessions: Map<string, FocusSession> = new Map();
  private rules: Map<string, DistractionRule[]> = new Map();
  private batches: Map<string, NotificationBatch[]> = new Map();
  private scores: Map<string, FocusScore[]> = new Map();
  private settings: Map<string, FocusSettings> = new Map();

  // ============================================================================
  // Session Management
  // ============================================================================

  /**
   * Start a new focus session
   */
  async startSession(
    userId: string,
    options: {
      duration_minutes?: number;
      task_id?: string;
      task_title?: string;
      sound_type?: SoundType;
      enable_dnd?: boolean;
    } = {}
  ): Promise<FocusSession> {
    // Check if there's an active session
    const activeSession = await this.getActiveSession(userId);
    if (activeSession) {
      throw new Error('You already have an active focus session. Please end it first.');
    }

    const userSettings = await this.getSettings(userId);
    const now = new Date().toISOString();

    const session: FocusSession = {
      id: crypto.randomUUID(),
      user_id: userId,
      task_id: options.task_id,
      task_title: options.task_title,
      status: 'focusing',
      target_duration_minutes: options.duration_minutes || userSettings.default_session_duration,
      actual_duration_minutes: 0,
      start_time: now,
      paused_duration_minutes: 0,
      interruptions: [],
      focus_score: 100, // Start with perfect score
      distraction_level: 'none',
      sound_type: options.sound_type || userSettings.default_sound,
      metadata: {},
      created_at: now,
      updated_at: now,
    };

    this.sessions.set(session.id, session);

    // Initialize notification batch for this session
    if (userSettings.notification_batching) {
      await this.initializeNotificationBatch(userId, session.id);
    }

    // Invalidate caches
    oracleCacheService.deleteByPrefix(`focus:${userId}`);

    return session;
  }

  /**
   * Get the currently active focus session
   */
  async getActiveSession(userId: string): Promise<FocusSession | null> {
    const cacheKeyStr = cacheKey('focus_active', userId);
    const cached = oracleCacheService.get<FocusSession>(cacheKeyStr);
    if (cached) {
      return cached;
    }

    for (const session of this.sessions.values()) {
      if (
        session.user_id === userId &&
        (session.status === 'focusing' || session.status === 'paused' || session.status === 'break')
      ) {
        // Update actual duration
        const now = new Date();
        const start = new Date(session.start_time);
        const elapsed = Math.floor((now.getTime() - start.getTime()) / 60000);
        session.actual_duration_minutes = elapsed - session.paused_duration_minutes;

        oracleCacheService.set(cacheKeyStr, session, FOCUS_CACHE_TTL.session);
        return session;
      }
    }

    return null;
  }

  /**
   * Pause the current focus session
   */
  async pauseSession(userId: string): Promise<FocusSession | null> {
    const session = await this.getActiveSession(userId);
    if (!session || session.status !== 'focusing') {
      return null;
    }

    session.status = 'paused';
    session.pause_time = new Date().toISOString();
    session.updated_at = new Date().toISOString();

    this.sessions.set(session.id, session);
    oracleCacheService.delete(cacheKey('focus_active', userId));

    return session;
  }

  /**
   * Resume a paused focus session
   */
  async resumeSession(userId: string): Promise<FocusSession | null> {
    const session = await this.getActiveSession(userId);
    if (!session || session.status !== 'paused') {
      return null;
    }

    // Calculate paused duration
    if (session.pause_time) {
      const pauseStart = new Date(session.pause_time);
      const now = new Date();
      const pausedMinutes = Math.floor((now.getTime() - pauseStart.getTime()) / 60000);
      session.paused_duration_minutes += pausedMinutes;
    }

    session.status = 'focusing';
    session.pause_time = undefined;
    session.updated_at = new Date().toISOString();

    this.sessions.set(session.id, session);
    oracleCacheService.delete(cacheKey('focus_active', userId));

    return session;
  }

  /**
   * End the current focus session
   */
  async endSession(
    userId: string,
    options: {
      notes?: string;
      was_successful?: boolean;
    } = {}
  ): Promise<FocusSession | null> {
    const session = await this.getActiveSession(userId);
    if (!session) {
      return null;
    }

    const now = new Date();
    const start = new Date(session.start_time);
    const totalMinutes = Math.floor((now.getTime() - start.getTime()) / 60000);

    session.status = 'completed';
    session.end_time = now.toISOString();
    session.actual_duration_minutes = totalMinutes - session.paused_duration_minutes;
    session.notes = options.notes;
    session.updated_at = now.toISOString();

    // Calculate final focus score
    session.focus_score = this.calculateFocusScore(session);

    this.sessions.set(session.id, session);

    // Update daily score
    await this.updateDailyScore(userId, session);

    // Deliver batched notifications
    await this.deliverBatchedNotifications(userId, session.id);

    // Invalidate caches
    oracleCacheService.deleteByPrefix(`focus:${userId}`);

    return session;
  }

  /**
   * Start a break
   */
  async startBreak(
    userId: string,
    breakType: BreakType = 'short'
  ): Promise<{ session: FocusSession; break_reminder: BreakReminder }> {
    const session = await this.getActiveSession(userId);
    if (!session) {
      throw new Error('No active session to take a break from');
    }

    const settings = await this.getSettings(userId);
    const breakDuration =
      breakType === 'micro' ? 1 :
      breakType === 'short' ? settings.short_break_duration :
      breakType === 'long' ? settings.long_break_duration : 5;

    session.status = 'break';
    session.updated_at = new Date().toISOString();

    const breakReminder: BreakReminder = {
      id: crypto.randomUUID(),
      session_id: session.id,
      break_type: breakType,
      duration_minutes: breakDuration,
      scheduled_time: new Date(Date.now() + breakDuration * 60000).toISOString(),
      is_taken: true,
      activity_suggestion: this.getBreakActivitySuggestion(breakType),
    };

    this.sessions.set(session.id, session);
    oracleCacheService.delete(cacheKey('focus_active', userId));

    return { session, break_reminder: breakReminder };
  }

  /**
   * Record an interruption during focus
   */
  async recordInterruption(
    userId: string,
    interruption: Omit<FocusInterruption, 'id' | 'timestamp'>
  ): Promise<FocusSession | null> {
    const session = await this.getActiveSession(userId);
    if (!session) {
      return null;
    }

    const newInterruption: FocusInterruption = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      ...interruption,
    };

    session.interruptions.push(newInterruption);

    // Update distraction level and focus score
    const interruptionCount = session.interruptions.length;
    if (interruptionCount >= 5) {
      session.distraction_level = 'high';
    } else if (interruptionCount >= 3) {
      session.distraction_level = 'medium';
    } else if (interruptionCount >= 1) {
      session.distraction_level = 'low';
    }

    // Reduce focus score based on interruption
    const scorePenalty = interruption.was_necessary ? 2 : 5;
    session.focus_score = Math.max(0, session.focus_score - scorePenalty);

    session.updated_at = new Date().toISOString();
    this.sessions.set(session.id, session);
    oracleCacheService.delete(cacheKey('focus_active', userId));

    return session;
  }

  /**
   * Calculate focus score for a session
   */
  private calculateFocusScore(session: FocusSession): number {
    let score = 100;

    // Duration completion factor (up to 30 points)
    const completionRatio = Math.min(
      session.actual_duration_minutes / session.target_duration_minutes,
      1.2
    );
    score -= Math.max(0, 30 - completionRatio * 30);

    // Interruption penalty (5 points each, max 40 points)
    const interruptionPenalty = Math.min(session.interruptions.length * 5, 40);
    score -= interruptionPenalty;

    // Unnecessary interruption extra penalty
    const unnecessaryCount = session.interruptions.filter((i) => !i.was_necessary).length;
    score -= unnecessaryCount * 3;

    // Pause penalty (2 points per pause minute, max 20 points)
    const pausePenalty = Math.min(session.paused_duration_minutes * 2, 20);
    score -= pausePenalty;

    return Math.max(0, Math.round(score));
  }

  /**
   * Get a break activity suggestion
   */
  private getBreakActivitySuggestion(breakType: BreakType): string {
    const activities = BREAK_ACTIVITIES[breakType] || BREAK_ACTIVITIES.short;
    return activities[Math.floor(Math.random() * activities.length)];
  }

  // ============================================================================
  // Distraction Blocking
  // ============================================================================

  /**
   * Add a distraction blocking rule
   */
  async addDistractionRule(
    userId: string,
    rule: Omit<DistractionRule, 'id' | 'user_id' | 'created_at'>
  ): Promise<DistractionRule> {
    const newRule: DistractionRule = {
      id: crypto.randomUUID(),
      user_id: userId,
      ...rule,
      created_at: new Date().toISOString(),
    };

    const userRules = this.rules.get(userId) || [];
    userRules.push(newRule);
    this.rules.set(userId, userRules);

    return newRule;
  }

  /**
   * Get distraction blocking rules
   */
  async getDistractionRules(userId: string): Promise<DistractionRule[]> {
    return this.rules.get(userId) || [];
  }

  /**
   * Toggle a distraction rule
   */
  async toggleDistractionRule(userId: string, ruleId: string): Promise<DistractionRule | null> {
    const userRules = this.rules.get(userId) || [];
    const rule = userRules.find((r) => r.id === ruleId);
    if (rule) {
      rule.is_active = !rule.is_active;
      this.rules.set(userId, userRules);
      return rule;
    }
    return null;
  }

  /**
   * Delete a distraction rule
   */
  async deleteDistractionRule(userId: string, ruleId: string): Promise<boolean> {
    const userRules = this.rules.get(userId) || [];
    const index = userRules.findIndex((r) => r.id === ruleId);
    if (index !== -1) {
      userRules.splice(index, 1);
      this.rules.set(userId, userRules);
      return true;
    }
    return false;
  }

  // ============================================================================
  // Notification Batching
  // ============================================================================

  /**
   * Initialize notification batch for a session
   */
  private async initializeNotificationBatch(userId: string, sessionId: string): Promise<void> {
    const batch: NotificationBatch = {
      id: crypto.randomUUID(),
      user_id: userId,
      session_id: sessionId,
      notifications: [],
      is_delivered: false,
      created_at: new Date().toISOString(),
    };

    const userBatches = this.batches.get(userId) || [];
    userBatches.push(batch);
    this.batches.set(userId, userBatches);
  }

  /**
   * Queue a notification for later delivery
   */
  async queueNotification(
    userId: string,
    sessionId: string,
    notification: Omit<BatchedNotification, 'id' | 'received_at'>
  ): Promise<boolean> {
    const userBatches = this.batches.get(userId) || [];
    const batch = userBatches.find((b) => b.session_id === sessionId && !b.is_delivered);

    if (!batch) {
      return false;
    }

    batch.notifications.push({
      id: crypto.randomUUID(),
      received_at: new Date().toISOString(),
      ...notification,
    });

    this.batches.set(userId, userBatches);
    return true;
  }

  /**
   * Get pending notifications for a session
   */
  async getPendingNotifications(userId: string, sessionId: string): Promise<BatchedNotification[]> {
    const userBatches = this.batches.get(userId) || [];
    const batch = userBatches.find((b) => b.session_id === sessionId && !b.is_delivered);
    return batch?.notifications || [];
  }

  /**
   * Deliver batched notifications
   */
  private async deliverBatchedNotifications(userId: string, sessionId: string): Promise<void> {
    const userBatches = this.batches.get(userId) || [];
    const batch = userBatches.find((b) => b.session_id === sessionId);

    if (batch) {
      batch.is_delivered = true;
      batch.delivery_time = new Date().toISOString();
      this.batches.set(userId, userBatches);
    }
  }

  // ============================================================================
  // Focus Scores and Stats
  // ============================================================================

  /**
   * Update daily focus score
   */
  private async updateDailyScore(userId: string, session: FocusSession): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    const userScores = this.scores.get(userId) || [];

    let todayScore = userScores.find((s) => s.date === today);

    if (!todayScore) {
      // Calculate streak
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const yesterdayScore = userScores.find((s) => s.date === yesterday);
      const streak = yesterdayScore ? yesterdayScore.streak_days + 1 : 1;

      todayScore = {
        user_id: userId,
        date: today,
        daily_score: 0,
        total_focus_minutes: 0,
        total_sessions: 0,
        completed_sessions: 0,
        average_session_length: 0,
        interruption_count: 0,
        streak_days: streak,
      };
      userScores.push(todayScore);
    }

    // Update metrics
    todayScore.total_focus_minutes += session.actual_duration_minutes;
    todayScore.total_sessions += 1;
    if (session.status === 'completed') {
      todayScore.completed_sessions += 1;
    }
    todayScore.interruption_count += session.interruptions.length;
    todayScore.average_session_length = todayScore.total_focus_minutes / todayScore.total_sessions;

    // Update daily score (average of all sessions)
    const sessions = Array.from(this.sessions.values()).filter(
      (s) => s.user_id === userId && s.created_at.startsWith(today)
    );
    todayScore.daily_score = sessions.length > 0
      ? Math.round(sessions.reduce((sum, s) => sum + s.focus_score, 0) / sessions.length)
      : 0;

    // Track best session
    if (!todayScore.deepest_focus_session_id || session.focus_score >
        (sessions.find((s) => s.id === todayScore!.deepest_focus_session_id)?.focus_score || 0)) {
      todayScore.deepest_focus_session_id = session.id;
    }

    this.scores.set(userId, userScores);
    oracleCacheService.delete(cacheKey('focus_score', userId, today));
  }

  /**
   * Get today's focus score
   */
  async getTodayScore(userId: string): Promise<FocusScore | null> {
    const today = new Date().toISOString().split('T')[0];
    const cacheKeyStr = cacheKey('focus_score', userId, today);

    const cached = oracleCacheService.get<FocusScore>(cacheKeyStr);
    if (cached) {
      return cached;
    }

    const userScores = this.scores.get(userId) || [];
    const score = userScores.find((s) => s.date === today);

    if (score) {
      oracleCacheService.set(cacheKeyStr, score, FOCUS_CACHE_TTL.score);
    }

    return score || null;
  }

  /**
   * Get focus statistics
   */
  async getStats(
    userId: string,
    options: {
      start_date?: string;
      end_date?: string;
    } = {}
  ): Promise<FocusStats> {
    const cacheKeyStr = cacheKey('focus_stats', userId, hashObject(options));

    const cached = oracleCacheService.get<FocusStats>(cacheKeyStr);
    if (cached) {
      return cached;
    }

    const startDate = options.start_date || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const endDate = options.end_date || new Date().toISOString();

    const sessions = Array.from(this.sessions.values()).filter(
      (s) => s.user_id === userId && s.created_at >= startDate && s.created_at <= endDate
    );

    const userScores = this.scores.get(userId) || [];
    const relevantScores = userScores.filter(
      (s) => s.date >= startDate.split('T')[0] && s.date <= endDate.split('T')[0]
    );

    // Calculate stats
    const totalMinutes = sessions.reduce((sum, s) => sum + s.actual_duration_minutes, 0);
    const completedSessions = sessions.filter((s) => s.status === 'completed').length;
    const totalInterruptions = sessions.reduce((sum, s) => sum + s.interruptions.length, 0);

    // Find most productive day and time
    const dayStats = new Map<number, number>();
    const hourStats = new Map<number, number>();
    sessions.forEach((s) => {
      const date = new Date(s.start_time);
      const day = date.getDay();
      const hour = date.getHours();
      dayStats.set(day, (dayStats.get(day) || 0) + s.actual_duration_minutes);
      hourStats.set(hour, (hourStats.get(hour) || 0) + s.actual_duration_minutes);
    });

    let mostProductiveDay = 0;
    let mostProductiveTime = 9;
    let maxDayMinutes = 0;
    let maxHourMinutes = 0;

    dayStats.forEach((minutes, day) => {
      if (minutes > maxDayMinutes) {
        maxDayMinutes = minutes;
        mostProductiveDay = day;
      }
    });

    hourStats.forEach((minutes, hour) => {
      if (minutes > maxHourMinutes) {
        maxHourMinutes = minutes;
        mostProductiveTime = hour;
      }
    });

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    // Calculate current and longest streak
    let currentStreak = 0;
    let longestStreak = 0;
    relevantScores.sort((a, b) => b.date.localeCompare(a.date));

    for (const score of relevantScores) {
      if (score.streak_days > longestStreak) {
        longestStreak = score.streak_days;
      }
    }

    if (relevantScores.length > 0) {
      currentStreak = relevantScores[0].streak_days;
    }

    // Find preferred sound
    const soundCounts = new Map<SoundType, number>();
    sessions.forEach((s) => {
      soundCounts.set(s.sound_type, (soundCounts.get(s.sound_type) || 0) + 1);
    });
    let preferredSound: SoundType = 'none';
    let maxSoundCount = 0;
    soundCounts.forEach((count, sound) => {
      if (count > maxSoundCount) {
        maxSoundCount = count;
        preferredSound = sound;
      }
    });

    // Calculate weekly trend
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

    const thisWeekMinutes = sessions
      .filter((s) => new Date(s.start_time) >= oneWeekAgo)
      .reduce((sum, s) => sum + s.actual_duration_minutes, 0);

    const lastWeekMinutes = sessions
      .filter((s) => new Date(s.start_time) >= twoWeeksAgo && new Date(s.start_time) < oneWeekAgo)
      .reduce((sum, s) => sum + s.actual_duration_minutes, 0);

    const weeklyTrend = lastWeekMinutes > 0
      ? Math.round(((thisWeekMinutes - lastWeekMinutes) / lastWeekMinutes) * 100)
      : 0;

    const stats: FocusStats = {
      total_focus_time_minutes: totalMinutes,
      average_session_length: sessions.length > 0 ? Math.round(totalMinutes / sessions.length) : 0,
      total_sessions: sessions.length,
      completed_sessions: completedSessions,
      completion_rate: sessions.length > 0 ? Math.round((completedSessions / sessions.length) * 100) / 100 : 0,
      average_focus_score: sessions.length > 0
        ? Math.round(sessions.reduce((sum, s) => sum + s.focus_score, 0) / sessions.length)
        : 0,
      total_interruptions: totalInterruptions,
      most_productive_day: dayNames[mostProductiveDay],
      most_productive_time: `${mostProductiveTime}:00`,
      current_streak: currentStreak,
      longest_streak: longestStreak,
      preferred_sound: preferredSound,
      weekly_trend: weeklyTrend,
    };

    oracleCacheService.set(cacheKeyStr, stats, FOCUS_CACHE_TTL.stats);
    return stats;
  }

  // ============================================================================
  // Optimal Focus Time Suggestions
  // ============================================================================

  /**
   * Get optimal focus times based on historical data
   */
  async getOptimalFocusTimes(userId: string): Promise<OptimalFocusTime[]> {
    const sessions = Array.from(this.sessions.values()).filter(
      (s) => s.user_id === userId && s.status === 'completed'
    );

    // Group sessions by day and hour
    const timeScores = new Map<string, { total: number; count: number }>();

    sessions.forEach((session) => {
      const date = new Date(session.start_time);
      const key = `${date.getDay()}-${date.getHours()}`;
      const current = timeScores.get(key) || { total: 0, count: 0 };
      timeScores.set(key, {
        total: current.total + session.focus_score,
        count: current.count + 1,
      });
    });

    // Find top 5 optimal times
    const optimalTimes: OptimalFocusTime[] = [];
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const energyLevels: Record<number, string> = {
      6: 'moderate', 7: 'moderate', 8: 'high', 9: 'peak', 10: 'peak',
      11: 'high', 12: 'moderate', 13: 'low', 14: 'moderate',
      15: 'high', 16: 'high', 17: 'moderate', 18: 'moderate',
    };

    timeScores.forEach((data, key) => {
      if (data.count >= 2) { // Only suggest times with enough data
        const [day, hour] = key.split('-').map(Number);
        const avgScore = Math.round(data.total / data.count);

        optimalTimes.push({
          time_of_day: `${hour}:00`,
          day_of_week: day,
          predicted_focus_score: avgScore,
          reason: `Based on ${data.count} successful sessions on ${dayNames[day]} at ${hour}:00`,
          energy_level: energyLevels[hour] || 'moderate',
          suggested_duration_minutes: avgScore > 80 ? 50 : avgScore > 60 ? 25 : 15,
        });
      }
    });

    // Sort by score and return top 5
    return optimalTimes
      .sort((a, b) => b.predicted_focus_score - a.predicted_focus_score)
      .slice(0, 5);
  }

  // ============================================================================
  // Settings Management
  // ============================================================================

  /**
   * Get user settings
   */
  async getSettings(userId: string): Promise<FocusSettings> {
    const cacheKeyStr = cacheKey('focus_settings', userId);

    const cached = oracleCacheService.get<FocusSettings>(cacheKeyStr);
    if (cached) {
      return cached;
    }

    let settings = this.settings.get(userId);

    if (!settings) {
      // Create default settings
      settings = {
        user_id: userId,
        default_session_duration: 25,
        short_break_duration: 5,
        long_break_duration: 15,
        sessions_before_long_break: 4,
        auto_start_breaks: false,
        auto_start_next_session: false,
        default_sound: 'none',
        enable_dnd: true,
        block_notifications: true,
        show_timer_overlay: true,
        vibrate_on_complete: true,
        notification_batching: true,
        break_activity_suggestions: true,
        updated_at: new Date().toISOString(),
      };
      this.settings.set(userId, settings);
    }

    oracleCacheService.set(cacheKeyStr, settings, FOCUS_CACHE_TTL.settings);
    return settings;
  }

  /**
   * Update user settings
   */
  async updateSettings(
    userId: string,
    updates: Partial<Omit<FocusSettings, 'user_id' | 'updated_at'>>
  ): Promise<FocusSettings> {
    const settings = await this.getSettings(userId);

    const updatedSettings: FocusSettings = {
      ...settings,
      ...updates,
      updated_at: new Date().toISOString(),
    };

    this.settings.set(userId, updatedSettings);
    oracleCacheService.delete(cacheKey('focus_settings', userId));

    return updatedSettings;
  }

  // ============================================================================
  // Session History
  // ============================================================================

  /**
   * Get session history
   */
  async getSessionHistory(
    userId: string,
    options: {
      limit?: number;
      offset?: number;
      start_date?: string;
      end_date?: string;
    } = {}
  ): Promise<FocusSession[]> {
    const { limit = 50, offset = 0, start_date, end_date } = options;

    let sessions = Array.from(this.sessions.values())
      .filter((s) => s.user_id === userId && s.status === 'completed');

    if (start_date) {
      sessions = sessions.filter((s) => s.created_at >= start_date);
    }
    if (end_date) {
      sessions = sessions.filter((s) => s.created_at <= end_date);
    }

    return sessions
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(offset, offset + limit);
  }

  /**
   * Get a specific session
   */
  async getSession(sessionId: string): Promise<FocusSession | null> {
    return this.sessions.get(sessionId) || null;
  }
}

// Singleton instance
export const focusModeService = new FocusModeService();
