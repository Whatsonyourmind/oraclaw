/**
 * ORACLE Habit Tracker Service
 * Build and maintain positive habits with tracking, streaks, and suggestions
 *
 * Features:
 * - Habit definitions with triggers
 * - Streak tracking
 * - Habit stacking suggestions
 * - Completion reminders
 * - Progress visualization
 * - Habit score calculation
 */

import { oracleCacheService, cacheKey, hashObject } from '../cache';

// ============================================================================
// Types
// ============================================================================

export type HabitFrequency = 'daily' | 'weekdays' | 'weekends' | 'weekly' | 'custom';
export type HabitCategory = 'health' | 'productivity' | 'learning' | 'mindfulness' | 'social' | 'creativity' | 'finance' | 'other';
export type HabitDifficulty = 'easy' | 'medium' | 'hard';
export type HabitStatus = 'active' | 'paused' | 'archived' | 'completed';
export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'anytime';

export interface Habit {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  category: HabitCategory;
  difficulty: HabitDifficulty;
  frequency: HabitFrequency;
  custom_days?: number[]; // For custom frequency: 0-6 (Sunday-Saturday)
  target_count?: number; // For habits that need quantity (e.g., drink 8 glasses of water)
  unit?: string; // Unit for target (e.g., "glasses", "pages", "minutes")
  time_of_day: TimeOfDay;
  reminder_time?: string; // HH:mm format
  trigger?: string; // Cue or trigger for the habit
  reward?: string; // Reward after completing
  stacked_after?: string; // ID of habit this is stacked after
  color?: string;
  icon?: string;
  status: HabitStatus;
  start_date: string;
  end_date?: string; // For time-limited habits
  current_streak: number;
  longest_streak: number;
  total_completions: number;
  habit_score: number; // 0-100
  created_at: string;
  updated_at: string;
}

export interface HabitCompletion {
  id: string;
  habit_id: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  completed: boolean;
  value?: number; // For quantifiable habits
  notes?: string;
  mood_after?: 'great' | 'good' | 'neutral' | 'bad';
  difficulty_felt?: 'easy' | 'normal' | 'hard';
  skipped_reason?: string;
  completed_at?: string;
  created_at: string;
}

export interface StreakInfo {
  habit_id: string;
  current_streak: number;
  longest_streak: number;
  streak_start_date?: string;
  last_completion_date?: string;
  at_risk: boolean; // True if today not yet completed
  days_until_break: number; // Days remaining to complete today
}

export interface HabitStats {
  habit_id: string;
  period_start: string;
  period_end: string;
  total_days: number;
  completed_days: number;
  completion_rate: number;
  current_streak: number;
  longest_streak: number;
  average_streak: number;
  total_value?: number; // For quantifiable habits
  best_day_of_week: string;
  worst_day_of_week: string;
  habit_score: number;
  trend: 'improving' | 'stable' | 'declining';
  consistency_score: number; // How consistent (0-100)
}

export interface DailyHabitSummary {
  date: string;
  total_habits: number;
  completed_habits: number;
  pending_habits: Habit[];
  completed_list: Array<{
    habit: Habit;
    completion: HabitCompletion;
  }>;
  overall_score: number;
  streaks_at_risk: Habit[];
}

export interface HabitStackSuggestion {
  new_habit: string;
  stack_after: Habit;
  reason: string;
  example: string;
  success_rate: number; // Based on research
}

export interface HabitInsight {
  type: 'achievement' | 'warning' | 'suggestion' | 'milestone';
  title: string;
  description: string;
  habit_id?: string;
  action?: string;
  timestamp: string;
}

export interface HabitTrackerSettings {
  user_id: string;
  morning_reminder_time: string;
  evening_reminder_time: string;
  reminder_enabled: boolean;
  streak_notifications: boolean;
  weekly_summary_enabled: boolean;
  weekly_summary_day: number; // 0-6
  gamification_enabled: boolean;
  show_motivational_quotes: boolean;
  updated_at: string;
}

// Constants
const CATEGORY_ICONS: Record<HabitCategory, string> = {
  health: 'heart',
  productivity: 'rocket',
  learning: 'book',
  mindfulness: 'leaf',
  social: 'people',
  creativity: 'color-palette',
  finance: 'cash',
  other: 'ellipsis-horizontal',
};

const CATEGORY_COLORS: Record<HabitCategory, string> = {
  health: '#E91E63',
  productivity: '#2196F3',
  learning: '#9C27B0',
  mindfulness: '#4CAF50',
  social: '#FF9800',
  creativity: '#00BCD4',
  finance: '#8BC34A',
  other: '#607D8B',
};

const CACHE_TTL = {
  habit: 30 * 1000,
  stats: 5 * 60 * 1000,
  daily: 2 * 60 * 1000,
  settings: 10 * 60 * 1000,
};

// Habit stacking templates
const HABIT_STACK_TEMPLATES: Array<{
  trigger_category: HabitCategory;
  new_habit: string;
  category: HabitCategory;
  example: string;
  success_rate: number;
}> = [
  { trigger_category: 'health', new_habit: 'Take vitamins', category: 'health', example: 'After drinking morning water, take vitamins', success_rate: 0.85 },
  { trigger_category: 'mindfulness', new_habit: 'Gratitude journaling', category: 'mindfulness', example: 'After morning meditation, write 3 things you\'re grateful for', success_rate: 0.78 },
  { trigger_category: 'productivity', new_habit: 'Plan your day', category: 'productivity', example: 'After morning coffee, spend 5 minutes planning your top 3 tasks', success_rate: 0.82 },
  { trigger_category: 'learning', new_habit: 'Read for 10 minutes', category: 'learning', example: 'After lunch, read for 10 minutes', success_rate: 0.75 },
  { trigger_category: 'health', new_habit: 'Stretch for 5 minutes', category: 'health', example: 'After waking up, do a 5-minute stretch routine', success_rate: 0.88 },
];

// ============================================================================
// Habit Tracker Service
// ============================================================================

export class HabitTrackerService {
  // In-memory stores
  private habits: Map<string, Habit[]> = new Map();
  private completions: Map<string, HabitCompletion[]> = new Map();
  private settings: Map<string, HabitTrackerSettings> = new Map();

  // ============================================================================
  // Habit Management
  // ============================================================================

  /**
   * Create a new habit
   */
  async createHabit(
    userId: string,
    habit: Omit<Habit, 'id' | 'user_id' | 'status' | 'current_streak' | 'longest_streak' | 'total_completions' | 'habit_score' | 'created_at' | 'updated_at'>
  ): Promise<Habit> {
    const now = new Date().toISOString();

    const newHabit: Habit = {
      id: crypto.randomUUID(),
      user_id: userId,
      ...habit,
      color: habit.color || CATEGORY_COLORS[habit.category],
      icon: habit.icon || CATEGORY_ICONS[habit.category],
      status: 'active',
      current_streak: 0,
      longest_streak: 0,
      total_completions: 0,
      habit_score: 0,
      created_at: now,
      updated_at: now,
    };

    const userHabits = this.habits.get(userId) || [];
    userHabits.push(newHabit);
    this.habits.set(userId, userHabits);

    oracleCacheService.deleteByPrefix(`habit:${userId}`);

    return newHabit;
  }

  /**
   * Get all habits for a user
   */
  async getHabits(
    userId: string,
    options: {
      status?: HabitStatus;
      category?: HabitCategory;
      includeArchived?: boolean;
    } = {}
  ): Promise<Habit[]> {
    let habits = this.habits.get(userId) || [];

    if (options.status) {
      habits = habits.filter((h) => h.status === options.status);
    } else if (!options.includeArchived) {
      habits = habits.filter((h) => h.status !== 'archived');
    }

    if (options.category) {
      habits = habits.filter((h) => h.category === options.category);
    }

    return habits;
  }

  /**
   * Get a single habit
   */
  async getHabit(userId: string, habitId: string): Promise<Habit | null> {
    const habits = this.habits.get(userId) || [];
    return habits.find((h) => h.id === habitId) || null;
  }

  /**
   * Update a habit
   */
  async updateHabit(
    userId: string,
    habitId: string,
    updates: Partial<Omit<Habit, 'id' | 'user_id' | 'created_at'>>
  ): Promise<Habit | null> {
    const userHabits = this.habits.get(userId) || [];
    const habitIndex = userHabits.findIndex((h) => h.id === habitId);

    if (habitIndex === -1) {
      return null;
    }

    const updatedHabit = {
      ...userHabits[habitIndex],
      ...updates,
      updated_at: new Date().toISOString(),
    };

    userHabits[habitIndex] = updatedHabit;
    this.habits.set(userId, userHabits);

    oracleCacheService.deleteByPrefix(`habit:${userId}`);

    return updatedHabit;
  }

  /**
   * Delete a habit (soft delete - archive)
   */
  async archiveHabit(userId: string, habitId: string): Promise<boolean> {
    const result = await this.updateHabit(userId, habitId, { status: 'archived' });
    return result !== null;
  }

  /**
   * Pause a habit
   */
  async pauseHabit(userId: string, habitId: string): Promise<Habit | null> {
    return this.updateHabit(userId, habitId, { status: 'paused' });
  }

  /**
   * Resume a paused habit
   */
  async resumeHabit(userId: string, habitId: string): Promise<Habit | null> {
    return this.updateHabit(userId, habitId, { status: 'active' });
  }

  // ============================================================================
  // Completion Tracking
  // ============================================================================

  /**
   * Mark habit as completed for today
   */
  async completeHabit(
    userId: string,
    habitId: string,
    options: {
      value?: number;
      notes?: string;
      mood_after?: 'great' | 'good' | 'neutral' | 'bad';
      difficulty_felt?: 'easy' | 'normal' | 'hard';
    } = {}
  ): Promise<{ completion: HabitCompletion; streak_info: StreakInfo }> {
    const habit = await this.getHabit(userId, habitId);
    if (!habit) {
      throw new Error('Habit not found');
    }

    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toISOString();

    // Check if already completed today
    const existingCompletion = await this.getCompletionForDate(userId, habitId, today);
    if (existingCompletion?.completed) {
      throw new Error('Habit already completed for today');
    }

    const completion: HabitCompletion = {
      id: existingCompletion?.id || crypto.randomUUID(),
      habit_id: habitId,
      user_id: userId,
      date: today,
      completed: true,
      value: options.value,
      notes: options.notes,
      mood_after: options.mood_after,
      difficulty_felt: options.difficulty_felt,
      completed_at: now,
      created_at: existingCompletion?.created_at || now,
    };

    // Update or add completion
    const userCompletions = this.completions.get(userId) || [];
    if (existingCompletion) {
      const index = userCompletions.findIndex((c) => c.id === existingCompletion.id);
      userCompletions[index] = completion;
    } else {
      userCompletions.push(completion);
    }
    this.completions.set(userId, userCompletions);

    // Update streak
    await this.updateStreak(userId, habitId);

    // Update habit stats
    habit.total_completions += 1;
    await this.updateHabit(userId, habitId, {
      total_completions: habit.total_completions,
      habit_score: await this.calculateHabitScore(userId, habitId),
    });

    const streakInfo = await this.getStreakInfo(userId, habitId);

    oracleCacheService.deleteByPrefix(`habit:${userId}`);

    return { completion, streak_info: streakInfo };
  }

  /**
   * Skip a habit for today
   */
  async skipHabit(
    userId: string,
    habitId: string,
    reason?: string
  ): Promise<HabitCompletion> {
    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toISOString();

    const completion: HabitCompletion = {
      id: crypto.randomUUID(),
      habit_id: habitId,
      user_id: userId,
      date: today,
      completed: false,
      skipped_reason: reason,
      created_at: now,
    };

    const userCompletions = this.completions.get(userId) || [];
    userCompletions.push(completion);
    this.completions.set(userId, userCompletions);

    // This breaks the streak
    await this.updateStreak(userId, habitId);

    oracleCacheService.deleteByPrefix(`habit:${userId}`);

    return completion;
  }

  /**
   * Get completion for a specific date
   */
  async getCompletionForDate(
    userId: string,
    habitId: string,
    date: string
  ): Promise<HabitCompletion | null> {
    const completions = this.completions.get(userId) || [];
    return completions.find((c) => c.habit_id === habitId && c.date === date) || null;
  }

  /**
   * Get completion history for a habit
   */
  async getCompletionHistory(
    userId: string,
    habitId: string,
    options: {
      start_date?: string;
      end_date?: string;
      limit?: number;
    } = {}
  ): Promise<HabitCompletion[]> {
    let completions = (this.completions.get(userId) || [])
      .filter((c) => c.habit_id === habitId);

    if (options.start_date) {
      completions = completions.filter((c) => c.date >= options.start_date!);
    }
    if (options.end_date) {
      completions = completions.filter((c) => c.date <= options.end_date!);
    }

    return completions
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, options.limit || 30);
  }

  // ============================================================================
  // Streak Management
  // ============================================================================

  /**
   * Update streak for a habit
   */
  private async updateStreak(userId: string, habitId: string): Promise<void> {
    const habit = await this.getHabit(userId, habitId);
    if (!habit) return;

    const completions = await this.getCompletionHistory(userId, habitId, { limit: 100 });
    const completedDates = new Set(
      completions.filter((c) => c.completed).map((c) => c.date)
    );

    // Calculate current streak
    let currentStreak = 0;
    const today = new Date();
    const checkDate = new Date(today);

    while (true) {
      const dateStr = checkDate.toISOString().split('T')[0];

      // Check if this date should be counted based on frequency
      if (this.shouldCountDate(habit, checkDate)) {
        if (completedDates.has(dateStr)) {
          currentStreak++;
        } else if (dateStr === today.toISOString().split('T')[0]) {
          // Today not yet completed - don't break streak yet
        } else {
          break;
        }
      }

      checkDate.setDate(checkDate.getDate() - 1);

      // Don't go back more than 365 days
      if (currentStreak > 365) break;
    }

    // Update longest streak
    const longestStreak = Math.max(habit.longest_streak, currentStreak);

    await this.updateHabit(userId, habitId, {
      current_streak: currentStreak,
      longest_streak: longestStreak,
    });
  }

  /**
   * Check if a date should count for habit frequency
   */
  private shouldCountDate(habit: Habit, date: Date): boolean {
    const dayOfWeek = date.getDay();

    switch (habit.frequency) {
      case 'daily':
        return true;
      case 'weekdays':
        return dayOfWeek >= 1 && dayOfWeek <= 5;
      case 'weekends':
        return dayOfWeek === 0 || dayOfWeek === 6;
      case 'weekly':
        // Check if any day this week is completed
        return true;
      case 'custom':
        return habit.custom_days?.includes(dayOfWeek) || false;
      default:
        return true;
    }
  }

  /**
   * Get streak information
   */
  async getStreakInfo(userId: string, habitId: string): Promise<StreakInfo> {
    const habit = await this.getHabit(userId, habitId);
    if (!habit) {
      throw new Error('Habit not found');
    }

    const today = new Date().toISOString().split('T')[0];
    const todayCompletion = await this.getCompletionForDate(userId, habitId, today);

    // Find streak start date
    let streakStartDate: string | undefined;
    if (habit.current_streak > 0) {
      const completions = await this.getCompletionHistory(userId, habitId, { limit: habit.current_streak + 1 });
      const sortedCompletions = completions
        .filter((c) => c.completed)
        .sort((a, b) => a.date.localeCompare(b.date));
      if (sortedCompletions.length > 0) {
        streakStartDate = sortedCompletions[0].date;
      }
    }

    // Get last completion date
    const completions = await this.getCompletionHistory(userId, habitId, { limit: 1 });
    const lastCompletion = completions.find((c) => c.completed);

    // Calculate time until day ends
    const now = new Date();
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);
    const hoursRemaining = Math.floor((endOfDay.getTime() - now.getTime()) / (1000 * 60 * 60));

    return {
      habit_id: habitId,
      current_streak: habit.current_streak,
      longest_streak: habit.longest_streak,
      streak_start_date: streakStartDate,
      last_completion_date: lastCompletion?.date,
      at_risk: !todayCompletion?.completed && this.shouldCountDate(habit, new Date()),
      days_until_break: todayCompletion?.completed ? 1 : 0,
    };
  }

  // ============================================================================
  // Daily Summary
  // ============================================================================

  /**
   * Get daily habit summary
   */
  async getDailySummary(userId: string, date?: string): Promise<DailyHabitSummary> {
    const targetDate = date || new Date().toISOString().split('T')[0];
    const cacheKeyStr = cacheKey('habit_daily', userId, targetDate);

    const cached = oracleCacheService.get<DailyHabitSummary>(cacheKeyStr);
    if (cached) {
      return cached;
    }

    const habits = await this.getHabits(userId, { status: 'active' });
    const dateObj = new Date(targetDate);

    // Filter habits that apply to this date
    const applicableHabits = habits.filter((h) => {
      if (h.start_date > targetDate) return false;
      if (h.end_date && h.end_date < targetDate) return false;
      return this.shouldCountDate(h, dateObj);
    });

    // Get completions for this date
    const completedList: Array<{ habit: Habit; completion: HabitCompletion }> = [];
    const pendingHabits: Habit[] = [];
    const streaksAtRisk: Habit[] = [];

    for (const habit of applicableHabits) {
      const completion = await this.getCompletionForDate(userId, habit.id, targetDate);

      if (completion?.completed) {
        completedList.push({ habit, completion });
      } else {
        pendingHabits.push(habit);
        if (habit.current_streak > 0) {
          streaksAtRisk.push(habit);
        }
      }
    }

    const summary: DailyHabitSummary = {
      date: targetDate,
      total_habits: applicableHabits.length,
      completed_habits: completedList.length,
      pending_habits: pendingHabits,
      completed_list: completedList,
      overall_score: applicableHabits.length > 0
        ? Math.round((completedList.length / applicableHabits.length) * 100)
        : 100,
      streaks_at_risk: streaksAtRisk,
    };

    oracleCacheService.set(cacheKeyStr, summary, CACHE_TTL.daily);
    return summary;
  }

  /**
   * Get habits due for today (ordered by time of day and priority)
   */
  async getTodayHabits(userId: string): Promise<Array<{
    habit: Habit;
    completed: boolean;
    streak_at_risk: boolean;
  }>> {
    const today = new Date().toISOString().split('T')[0];
    const habits = await this.getHabits(userId, { status: 'active' });

    const timeOfDayOrder: Record<TimeOfDay, number> = {
      morning: 1,
      afternoon: 2,
      evening: 3,
      anytime: 4,
    };

    const todayHabits = await Promise.all(
      habits
        .filter((h) => this.shouldCountDate(h, new Date()))
        .map(async (habit) => {
          const completion = await this.getCompletionForDate(userId, habit.id, today);
          return {
            habit,
            completed: completion?.completed || false,
            streak_at_risk: !completion?.completed && habit.current_streak > 0,
          };
        })
    );

    // Sort by: completed (pending first), time of day, streak (at risk first)
    return todayHabits.sort((a, b) => {
      if (a.completed !== b.completed) {
        return a.completed ? 1 : -1;
      }
      if (a.streak_at_risk !== b.streak_at_risk) {
        return a.streak_at_risk ? -1 : 1;
      }
      return timeOfDayOrder[a.habit.time_of_day] - timeOfDayOrder[b.habit.time_of_day];
    });
  }

  // ============================================================================
  // Statistics
  // ============================================================================

  /**
   * Get habit statistics
   */
  async getHabitStats(
    userId: string,
    habitId: string,
    options: {
      start_date?: string;
      end_date?: string;
    } = {}
  ): Promise<HabitStats> {
    const cacheKeyStr = cacheKey('habit_stats', userId, habitId, hashObject(options));

    const cached = oracleCacheService.get<HabitStats>(cacheKeyStr);
    if (cached) {
      return cached;
    }

    const habit = await this.getHabit(userId, habitId);
    if (!habit) {
      throw new Error('Habit not found');
    }

    const startDate = options.start_date || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endDate = options.end_date || new Date().toISOString().split('T')[0];

    const completions = await this.getCompletionHistory(userId, habitId, {
      start_date: startDate,
      end_date: endDate,
      limit: 365,
    });

    // Count applicable days and completions
    let totalDays = 0;
    let completedDays = 0;
    const dayOfWeekStats: Record<number, { completed: number; total: number }> = {};
    let totalValue = 0;

    const current = new Date(startDate);
    const end = new Date(endDate);

    while (current <= end) {
      if (this.shouldCountDate(habit, current)) {
        totalDays++;
        const dayOfWeek = current.getDay();
        if (!dayOfWeekStats[dayOfWeek]) {
          dayOfWeekStats[dayOfWeek] = { completed: 0, total: 0 };
        }
        dayOfWeekStats[dayOfWeek].total++;

        const dateStr = current.toISOString().split('T')[0];
        const completion = completions.find((c) => c.date === dateStr);
        if (completion?.completed) {
          completedDays++;
          dayOfWeekStats[dayOfWeek].completed++;
          if (completion.value) {
            totalValue += completion.value;
          }
        }
      }
      current.setDate(current.getDate() + 1);
    }

    // Find best/worst day
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    let bestDay = 'Monday';
    let worstDay = 'Monday';
    let bestRate = 0;
    let worstRate = 1;

    Object.entries(dayOfWeekStats).forEach(([day, stats]) => {
      const rate = stats.total > 0 ? stats.completed / stats.total : 0;
      if (rate > bestRate) {
        bestRate = rate;
        bestDay = dayNames[parseInt(day)];
      }
      if (rate < worstRate && stats.total > 0) {
        worstRate = rate;
        worstDay = dayNames[parseInt(day)];
      }
    });

    // Calculate trend
    const recentCompletions = completions.slice(0, 7);
    const olderCompletions = completions.slice(7, 14);
    const recentRate = recentCompletions.filter((c) => c.completed).length / Math.max(1, recentCompletions.length);
    const olderRate = olderCompletions.filter((c) => c.completed).length / Math.max(1, olderCompletions.length);

    let trend: 'improving' | 'stable' | 'declining';
    if (recentRate > olderRate + 0.1) {
      trend = 'improving';
    } else if (recentRate < olderRate - 0.1) {
      trend = 'declining';
    } else {
      trend = 'stable';
    }

    // Calculate consistency score
    const completionRate = totalDays > 0 ? completedDays / totalDays : 0;
    const consistencyScore = Math.round(completionRate * 100);

    const stats: HabitStats = {
      habit_id: habitId,
      period_start: startDate,
      period_end: endDate,
      total_days: totalDays,
      completed_days: completedDays,
      completion_rate: Math.round(completionRate * 100) / 100,
      current_streak: habit.current_streak,
      longest_streak: habit.longest_streak,
      average_streak: completedDays > 0 ? Math.round((habit.current_streak + habit.longest_streak) / 2) : 0,
      total_value: habit.target_count ? totalValue : undefined,
      best_day_of_week: bestDay,
      worst_day_of_week: worstDay,
      habit_score: habit.habit_score,
      trend,
      consistency_score: consistencyScore,
    };

    oracleCacheService.set(cacheKeyStr, stats, CACHE_TTL.stats);
    return stats;
  }

  /**
   * Calculate habit score
   */
  private async calculateHabitScore(userId: string, habitId: string): Promise<number> {
    const stats = await this.getHabitStats(userId, habitId);

    let score = 0;

    // Completion rate (up to 40 points)
    score += stats.completion_rate * 40;

    // Current streak bonus (up to 30 points)
    const streakBonus = Math.min(stats.current_streak / 30, 1) * 30;
    score += streakBonus;

    // Consistency (up to 20 points)
    score += stats.consistency_score * 0.2;

    // Trend bonus (up to 10 points)
    if (stats.trend === 'improving') {
      score += 10;
    } else if (stats.trend === 'stable') {
      score += 5;
    }

    return Math.round(Math.min(100, score));
  }

  // ============================================================================
  // Habit Stacking
  // ============================================================================

  /**
   * Get habit stacking suggestions
   */
  async getStackSuggestions(userId: string): Promise<HabitStackSuggestion[]> {
    const habits = await this.getHabits(userId, { status: 'active' });

    if (habits.length === 0) {
      return [];
    }

    const suggestions: HabitStackSuggestion[] = [];

    // Find habits that could be triggers
    const triggerHabits = habits.filter(
      (h) => h.current_streak >= 7 && h.time_of_day !== 'anytime'
    );

    for (const triggerHabit of triggerHabits) {
      // Find matching templates
      const templates = HABIT_STACK_TEMPLATES.filter(
        (t) => t.trigger_category === triggerHabit.category
      );

      for (const template of templates) {
        // Check if user already has this habit
        const exists = habits.some(
          (h) => h.name.toLowerCase().includes(template.new_habit.toLowerCase())
        );

        if (!exists) {
          suggestions.push({
            new_habit: template.new_habit,
            stack_after: triggerHabit,
            reason: `Your ${triggerHabit.name} habit has a ${triggerHabit.current_streak}-day streak. Stack a new habit after it!`,
            example: template.example.replace('morning', triggerHabit.name.toLowerCase()),
            success_rate: template.success_rate,
          });
        }
      }
    }

    // Sort by trigger habit streak and success rate
    return suggestions
      .sort((a, b) => {
        const streakDiff = b.stack_after.current_streak - a.stack_after.current_streak;
        if (streakDiff !== 0) return streakDiff;
        return b.success_rate - a.success_rate;
      })
      .slice(0, 5);
  }

  // ============================================================================
  // Insights
  // ============================================================================

  /**
   * Get habit insights
   */
  async getInsights(userId: string): Promise<HabitInsight[]> {
    const habits = await this.getHabits(userId, { status: 'active' });
    const insights: HabitInsight[] = [];
    const now = new Date().toISOString();

    for (const habit of habits) {
      // Milestone achievements
      if (habit.current_streak === 7) {
        insights.push({
          type: 'milestone',
          title: '1 Week Streak!',
          description: `You've completed ${habit.name} for 7 days in a row! Keep going!`,
          habit_id: habit.id,
          timestamp: now,
        });
      } else if (habit.current_streak === 30) {
        insights.push({
          type: 'achievement',
          title: '30 Day Champion!',
          description: `Amazing! A full month of ${habit.name}! You're building a lasting habit.`,
          habit_id: habit.id,
          timestamp: now,
        });
      }

      // Streak at risk warning
      const today = new Date().toISOString().split('T')[0];
      const completion = await this.getCompletionForDate(userId, habit.id, today);
      if (!completion?.completed && habit.current_streak >= 3) {
        insights.push({
          type: 'warning',
          title: 'Streak at Risk',
          description: `Don't lose your ${habit.current_streak}-day streak on ${habit.name}!`,
          habit_id: habit.id,
          action: 'Complete now',
          timestamp: now,
        });
      }

      // Declining trend suggestion
      const stats = await this.getHabitStats(userId, habit.id);
      if (stats.trend === 'declining' && stats.completion_rate < 0.5) {
        insights.push({
          type: 'suggestion',
          title: 'Consider Adjusting',
          description: `${habit.name} has been challenging lately. Would you like to make it easier or change the schedule?`,
          habit_id: habit.id,
          action: 'Adjust habit',
          timestamp: now,
        });
      }
    }

    // Sort by importance (warnings first, then milestones, etc.)
    const typeOrder: Record<string, number> = {
      warning: 1,
      milestone: 2,
      achievement: 3,
      suggestion: 4,
    };

    return insights.sort((a, b) => typeOrder[a.type] - typeOrder[b.type]);
  }

  // ============================================================================
  // Heatmap Data
  // ============================================================================

  /**
   * Get completion heatmap data for visualization
   */
  async getHeatmapData(
    userId: string,
    habitId: string,
    weeks: number = 12
  ): Promise<Array<{ date: string; value: number; completed: boolean }>> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - weeks * 7);

    const completions = await this.getCompletionHistory(userId, habitId, {
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0],
      limit: weeks * 7,
    });

    const completionMap = new Map(completions.map((c) => [c.date, c]));
    const data: Array<{ date: string; value: number; completed: boolean }> = [];

    const current = new Date(startDate);
    while (current <= endDate) {
      const dateStr = current.toISOString().split('T')[0];
      const completion = completionMap.get(dateStr);

      data.push({
        date: dateStr,
        value: completion?.completed ? (completion.value || 1) : 0,
        completed: completion?.completed || false,
      });

      current.setDate(current.getDate() + 1);
    }

    return data;
  }

  // ============================================================================
  // Settings
  // ============================================================================

  /**
   * Get settings
   */
  async getSettings(userId: string): Promise<HabitTrackerSettings> {
    const cacheKeyStr = cacheKey('habit_settings', userId);

    const cached = oracleCacheService.get<HabitTrackerSettings>(cacheKeyStr);
    if (cached) {
      return cached;
    }

    let settings = this.settings.get(userId);

    if (!settings) {
      settings = {
        user_id: userId,
        morning_reminder_time: '08:00',
        evening_reminder_time: '20:00',
        reminder_enabled: true,
        streak_notifications: true,
        weekly_summary_enabled: true,
        weekly_summary_day: 0, // Sunday
        gamification_enabled: true,
        show_motivational_quotes: true,
        updated_at: new Date().toISOString(),
      };
      this.settings.set(userId, settings);
    }

    oracleCacheService.set(cacheKeyStr, settings, CACHE_TTL.settings);
    return settings;
  }

  /**
   * Update settings
   */
  async updateSettings(
    userId: string,
    updates: Partial<Omit<HabitTrackerSettings, 'user_id' | 'updated_at'>>
  ): Promise<HabitTrackerSettings> {
    const settings = await this.getSettings(userId);

    const updatedSettings = {
      ...settings,
      ...updates,
      updated_at: new Date().toISOString(),
    };

    this.settings.set(userId, updatedSettings);
    oracleCacheService.delete(cacheKey('habit_settings', userId));

    return updatedSettings;
  }
}

// Singleton instance
export const habitTrackerService = new HabitTrackerService();
