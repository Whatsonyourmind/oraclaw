/**
 * ORACLE Energy Tracker Service
 * Track energy levels and mood to optimize productivity and prevent burnout
 *
 * Features:
 * - Energy level logging (1-10)
 * - Mood tracking
 * - Correlation with productivity
 * - Optimal scheduling suggestions
 * - Burnout early warning
 * - Recovery recommendations
 */

import { oracleCacheService, cacheKey, hashObject } from '../cache';

// ============================================================================
// Types
// ============================================================================

export type MoodType =
  | 'energized' | 'focused' | 'calm' | 'happy' | 'motivated'
  | 'neutral' | 'tired' | 'stressed' | 'anxious' | 'frustrated'
  | 'sad' | 'overwhelmed' | 'burned_out';

export type EnergyTrend = 'rising' | 'stable' | 'declining' | 'volatile';
export type BurnoutRisk = 'none' | 'low' | 'moderate' | 'high' | 'critical';
export type TimeOfDay = 'early_morning' | 'morning' | 'midday' | 'afternoon' | 'evening' | 'night';

export interface EnergyEntry {
  id: string;
  user_id: string;
  energy_level: number; // 1-10
  mood: MoodType;
  physical_energy: number; // 1-10
  mental_energy: number; // 1-10
  emotional_state: number; // 1-10
  notes?: string;
  factors: EnergyFactor[];
  activities_before: string[];
  sleep_quality?: number; // 1-10
  sleep_hours?: number;
  caffeine_intake?: number; // cups
  exercise_done?: boolean;
  meals_eaten?: number;
  hydration_level?: number; // 1-10
  time_of_day: TimeOfDay;
  timestamp: string;
  metadata: Record<string, any>;
  created_at: string;
}

export interface EnergyFactor {
  type: 'positive' | 'negative';
  category: 'sleep' | 'nutrition' | 'exercise' | 'stress' | 'social' | 'work' | 'health' | 'environment' | 'other';
  description: string;
  impact: number; // -5 to +5
}

export interface MoodEntry {
  id: string;
  user_id: string;
  mood: MoodType;
  intensity: number; // 1-10
  triggers?: string[];
  notes?: string;
  associated_energy_id?: string;
  timestamp: string;
  created_at: string;
}

export interface EnergyPattern {
  user_id: string;
  time_of_day: TimeOfDay;
  day_of_week: number;
  average_energy: number;
  average_mood_score: number;
  sample_count: number;
  common_moods: MoodType[];
  productivity_correlation: number; // -1 to 1
  updated_at: string;
}

export interface EnergyStats {
  period_start: string;
  period_end: string;
  average_energy: number;
  average_mood_score: number;
  energy_trend: EnergyTrend;
  entries_count: number;
  highest_energy_day: string;
  lowest_energy_day: string;
  most_common_mood: MoodType;
  mood_distribution: Record<MoodType, number>;
  energy_by_time_of_day: Record<TimeOfDay, number>;
  energy_by_day_of_week: Record<string, number>;
  top_positive_factors: Array<{ factor: string; frequency: number }>;
  top_negative_factors: Array<{ factor: string; frequency: number }>;
  burnout_risk: BurnoutRisk;
  sleep_correlation: number;
  exercise_correlation: number;
}

export interface BurnoutIndicator {
  indicator: string;
  severity: 'mild' | 'moderate' | 'severe';
  frequency: number; // How often in past 2 weeks
  first_noticed: string;
  trend: 'improving' | 'stable' | 'worsening';
}

export interface BurnoutAssessment {
  user_id: string;
  risk_level: BurnoutRisk;
  risk_score: number; // 0-100
  indicators: BurnoutIndicator[];
  contributing_factors: string[];
  days_at_risk: number;
  trend: EnergyTrend;
  recommendations: RecoveryRecommendation[];
  assessment_date: string;
}

export interface RecoveryRecommendation {
  category: 'sleep' | 'exercise' | 'nutrition' | 'work' | 'social' | 'mindfulness' | 'boundaries';
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  duration_minutes?: number;
  frequency: 'daily' | 'weekly' | 'as_needed';
  expected_impact: string;
}

export interface OptimalScheduleSuggestion {
  time_of_day: TimeOfDay;
  task_type: 'deep_work' | 'meetings' | 'admin' | 'creative' | 'rest';
  predicted_energy: number;
  predicted_productivity: number;
  reason: string;
  confidence: number;
}

export interface EnergyTrackerSettings {
  user_id: string;
  reminder_enabled: boolean;
  reminder_times: string[]; // HH:mm format
  track_sleep: boolean;
  track_nutrition: boolean;
  track_exercise: boolean;
  burnout_warnings_enabled: boolean;
  burnout_threshold: number; // 0-100
  share_with_manager: boolean;
  updated_at: string;
}

// Constants
const MOOD_SCORES: Record<MoodType, number> = {
  energized: 9,
  focused: 8,
  calm: 7,
  happy: 8,
  motivated: 9,
  neutral: 5,
  tired: 3,
  stressed: 3,
  anxious: 2,
  frustrated: 2,
  sad: 2,
  overwhelmed: 1,
  burned_out: 0,
};

const TIME_OF_DAY_HOURS: Record<TimeOfDay, number[]> = {
  early_morning: [5, 6, 7],
  morning: [8, 9, 10, 11],
  midday: [12, 13],
  afternoon: [14, 15, 16, 17],
  evening: [18, 19, 20, 21],
  night: [22, 23, 0, 1, 2, 3, 4],
};

const CACHE_TTL = {
  entry: 30 * 1000,
  stats: 5 * 60 * 1000,
  patterns: 10 * 60 * 1000,
  burnout: 2 * 60 * 1000,
  settings: 10 * 60 * 1000,
};

// Recovery recommendations library
const RECOVERY_RECOMMENDATIONS: RecoveryRecommendation[] = [
  {
    category: 'sleep',
    title: 'Improve Sleep Hygiene',
    description: 'Aim for 7-8 hours of sleep. Avoid screens 1 hour before bed and keep a consistent sleep schedule.',
    priority: 'high',
    frequency: 'daily',
    expected_impact: 'Better morning energy and mental clarity',
  },
  {
    category: 'exercise',
    title: 'Daily Movement Break',
    description: 'Take a 15-20 minute walk outside, preferably in natural light.',
    priority: 'medium',
    duration_minutes: 20,
    frequency: 'daily',
    expected_impact: 'Improved energy and reduced stress hormones',
  },
  {
    category: 'boundaries',
    title: 'Set Work Boundaries',
    description: 'Define clear start and end times for work. Avoid checking work messages outside these hours.',
    priority: 'high',
    frequency: 'daily',
    expected_impact: 'Better work-life balance and mental recovery',
  },
  {
    category: 'mindfulness',
    title: 'Practice Breathing Exercises',
    description: 'Take 5 minutes for deep breathing or meditation when feeling overwhelmed.',
    priority: 'medium',
    duration_minutes: 5,
    frequency: 'as_needed',
    expected_impact: 'Reduced anxiety and improved focus',
  },
  {
    category: 'social',
    title: 'Connect with Others',
    description: 'Schedule regular time with friends or family. Social connection is essential for mental health.',
    priority: 'medium',
    frequency: 'weekly',
    expected_impact: 'Improved mood and sense of support',
  },
  {
    category: 'nutrition',
    title: 'Regular Meals & Hydration',
    description: 'Eat balanced meals at regular intervals and drink at least 8 glasses of water daily.',
    priority: 'medium',
    frequency: 'daily',
    expected_impact: 'Stable energy levels throughout the day',
  },
  {
    category: 'work',
    title: 'Take Real Breaks',
    description: 'Step away from work completely during breaks. Go outside or do something unrelated to work.',
    priority: 'high',
    duration_minutes: 15,
    frequency: 'daily',
    expected_impact: 'Improved focus and reduced mental fatigue',
  },
];

// ============================================================================
// Energy Tracker Service
// ============================================================================

export class EnergyTrackerService {
  // In-memory stores
  private entries: Map<string, EnergyEntry[]> = new Map();
  private moods: Map<string, MoodEntry[]> = new Map();
  private patterns: Map<string, EnergyPattern[]> = new Map();
  private settings: Map<string, EnergyTrackerSettings> = new Map();

  // ============================================================================
  // Energy Logging
  // ============================================================================

  /**
   * Log current energy level
   */
  async logEnergy(
    userId: string,
    data: {
      energy_level: number;
      mood: MoodType;
      physical_energy?: number;
      mental_energy?: number;
      emotional_state?: number;
      notes?: string;
      factors?: EnergyFactor[];
      activities_before?: string[];
      sleep_quality?: number;
      sleep_hours?: number;
      caffeine_intake?: number;
      exercise_done?: boolean;
      meals_eaten?: number;
      hydration_level?: number;
    }
  ): Promise<EnergyEntry> {
    const now = new Date();
    const timeOfDay = this.getTimeOfDay(now.getHours());

    const entry: EnergyEntry = {
      id: crypto.randomUUID(),
      user_id: userId,
      energy_level: Math.max(1, Math.min(10, data.energy_level)),
      mood: data.mood,
      physical_energy: data.physical_energy || data.energy_level,
      mental_energy: data.mental_energy || data.energy_level,
      emotional_state: data.emotional_state || MOOD_SCORES[data.mood],
      notes: data.notes,
      factors: data.factors || [],
      activities_before: data.activities_before || [],
      sleep_quality: data.sleep_quality,
      sleep_hours: data.sleep_hours,
      caffeine_intake: data.caffeine_intake,
      exercise_done: data.exercise_done,
      meals_eaten: data.meals_eaten,
      hydration_level: data.hydration_level,
      time_of_day: timeOfDay,
      timestamp: now.toISOString(),
      metadata: {},
      created_at: now.toISOString(),
    };

    const userEntries = this.entries.get(userId) || [];
    userEntries.push(entry);
    this.entries.set(userId, userEntries);

    // Also log mood
    await this.logMood(userId, {
      mood: data.mood,
      intensity: Math.round((data.emotional_state || MOOD_SCORES[data.mood]) * 10) / 10,
      notes: data.notes,
      associated_energy_id: entry.id,
    });

    // Update patterns
    await this.updatePatterns(userId, entry);

    // Check burnout risk
    await this.checkBurnoutRisk(userId);

    oracleCacheService.deleteByPrefix(`energy:${userId}`);

    return entry;
  }

  /**
   * Quick energy log (minimal data)
   */
  async quickLog(
    userId: string,
    energyLevel: number,
    mood: MoodType
  ): Promise<EnergyEntry> {
    return this.logEnergy(userId, { energy_level: energyLevel, mood });
  }

  /**
   * Get recent energy entries
   */
  async getEntries(
    userId: string,
    options: {
      start_date?: string;
      end_date?: string;
      limit?: number;
    } = {}
  ): Promise<EnergyEntry[]> {
    let entries = this.entries.get(userId) || [];

    if (options.start_date) {
      entries = entries.filter((e) => e.timestamp >= options.start_date!);
    }
    if (options.end_date) {
      entries = entries.filter((e) => e.timestamp <= options.end_date!);
    }

    return entries
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, options.limit || 50);
  }

  /**
   * Get today's entries
   */
  async getTodayEntries(userId: string): Promise<EnergyEntry[]> {
    const today = new Date().toISOString().split('T')[0];
    return this.getEntries(userId, { start_date: today });
  }

  // ============================================================================
  // Mood Tracking
  // ============================================================================

  /**
   * Log mood
   */
  async logMood(
    userId: string,
    data: {
      mood: MoodType;
      intensity?: number;
      triggers?: string[];
      notes?: string;
      associated_energy_id?: string;
    }
  ): Promise<MoodEntry> {
    const now = new Date().toISOString();

    const entry: MoodEntry = {
      id: crypto.randomUUID(),
      user_id: userId,
      mood: data.mood,
      intensity: data.intensity || MOOD_SCORES[data.mood],
      triggers: data.triggers,
      notes: data.notes,
      associated_energy_id: data.associated_energy_id,
      timestamp: now,
      created_at: now,
    };

    const userMoods = this.moods.get(userId) || [];
    userMoods.push(entry);
    this.moods.set(userId, userMoods);

    return entry;
  }

  /**
   * Get mood history
   */
  async getMoodHistory(
    userId: string,
    options: {
      start_date?: string;
      end_date?: string;
      limit?: number;
    } = {}
  ): Promise<MoodEntry[]> {
    let moods = this.moods.get(userId) || [];

    if (options.start_date) {
      moods = moods.filter((m) => m.timestamp >= options.start_date!);
    }
    if (options.end_date) {
      moods = moods.filter((m) => m.timestamp <= options.end_date!);
    }

    return moods
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, options.limit || 50);
  }

  // ============================================================================
  // Pattern Analysis
  // ============================================================================

  /**
   * Update energy patterns
   */
  private async updatePatterns(userId: string, entry: EnergyEntry): Promise<void> {
    const date = new Date(entry.timestamp);
    const dayOfWeek = date.getDay();

    const userPatterns = this.patterns.get(userId) || [];
    const patternKey = `${entry.time_of_day}-${dayOfWeek}`;

    let pattern = userPatterns.find(
      (p) => p.time_of_day === entry.time_of_day && p.day_of_week === dayOfWeek
    );

    if (!pattern) {
      pattern = {
        user_id: userId,
        time_of_day: entry.time_of_day,
        day_of_week: dayOfWeek,
        average_energy: entry.energy_level,
        average_mood_score: MOOD_SCORES[entry.mood],
        sample_count: 1,
        common_moods: [entry.mood],
        productivity_correlation: 0,
        updated_at: new Date().toISOString(),
      };
      userPatterns.push(pattern);
    } else {
      // Update running average
      const n = pattern.sample_count;
      pattern.average_energy = (pattern.average_energy * n + entry.energy_level) / (n + 1);
      pattern.average_mood_score = (pattern.average_mood_score * n + MOOD_SCORES[entry.mood]) / (n + 1);
      pattern.sample_count = n + 1;

      // Update common moods
      if (!pattern.common_moods.includes(entry.mood)) {
        pattern.common_moods.push(entry.mood);
      }

      pattern.updated_at = new Date().toISOString();
    }

    this.patterns.set(userId, userPatterns);
  }

  /**
   * Get energy patterns
   */
  async getPatterns(userId: string): Promise<EnergyPattern[]> {
    const cacheKeyStr = cacheKey('energy_patterns', userId);

    const cached = oracleCacheService.get<EnergyPattern[]>(cacheKeyStr);
    if (cached) {
      return cached;
    }

    const patterns = this.patterns.get(userId) || [];

    oracleCacheService.set(cacheKeyStr, patterns, CACHE_TTL.patterns);
    return patterns;
  }

  /**
   * Get optimal schedule suggestions
   */
  async getOptimalSchedule(userId: string): Promise<OptimalScheduleSuggestion[]> {
    const patterns = await this.getPatterns(userId);

    if (patterns.length < 5) {
      // Not enough data
      return this.getDefaultScheduleSuggestions();
    }

    const suggestions: OptimalScheduleSuggestion[] = [];
    const timeSlots: TimeOfDay[] = ['early_morning', 'morning', 'midday', 'afternoon', 'evening'];

    for (const timeOfDay of timeSlots) {
      const relevantPatterns = patterns.filter((p) => p.time_of_day === timeOfDay);
      if (relevantPatterns.length === 0) continue;

      const avgEnergy = relevantPatterns.reduce((sum, p) => sum + p.average_energy, 0) / relevantPatterns.length;
      const avgMood = relevantPatterns.reduce((sum, p) => sum + p.average_mood_score, 0) / relevantPatterns.length;

      let taskType: OptimalScheduleSuggestion['task_type'];
      let reason: string;

      if (avgEnergy >= 7) {
        taskType = 'deep_work';
        reason = `Your energy is typically high (${avgEnergy.toFixed(1)}/10) during ${timeOfDay.replace('_', ' ')}`;
      } else if (avgEnergy >= 5) {
        taskType = avgMood >= 6 ? 'creative' : 'meetings';
        reason = `Moderate energy with ${avgMood >= 6 ? 'positive mood' : 'stable mood'} - good for ${taskType}`;
      } else if (avgEnergy >= 3) {
        taskType = 'admin';
        reason = 'Lower energy period - suitable for routine tasks';
      } else {
        taskType = 'rest';
        reason = 'Low energy period - consider taking a break or doing light activities';
      }

      suggestions.push({
        time_of_day: timeOfDay,
        task_type: taskType,
        predicted_energy: Math.round(avgEnergy * 10) / 10,
        predicted_productivity: Math.round(avgEnergy * avgMood / 10 * 10) / 10,
        reason,
        confidence: Math.min(1, relevantPatterns.length / 10),
      });
    }

    return suggestions;
  }

  /**
   * Get default schedule suggestions
   */
  private getDefaultScheduleSuggestions(): OptimalScheduleSuggestion[] {
    return [
      { time_of_day: 'early_morning', task_type: 'deep_work', predicted_energy: 7, predicted_productivity: 7, reason: 'Morning typically offers high focus potential', confidence: 0.3 },
      { time_of_day: 'morning', task_type: 'deep_work', predicted_energy: 8, predicted_productivity: 8, reason: 'Peak cognitive hours for most people', confidence: 0.3 },
      { time_of_day: 'midday', task_type: 'meetings', predicted_energy: 6, predicted_productivity: 6, reason: 'Good time for collaborative work', confidence: 0.3 },
      { time_of_day: 'afternoon', task_type: 'admin', predicted_energy: 5, predicted_productivity: 5, reason: 'Post-lunch dip - good for routine tasks', confidence: 0.3 },
      { time_of_day: 'evening', task_type: 'rest', predicted_energy: 4, predicted_productivity: 4, reason: 'Wind-down period', confidence: 0.3 },
    ];
  }

  // ============================================================================
  // Statistics
  // ============================================================================

  /**
   * Get energy statistics
   */
  async getStats(
    userId: string,
    options: {
      start_date?: string;
      end_date?: string;
    } = {}
  ): Promise<EnergyStats> {
    const cacheKeyStr = cacheKey('energy_stats', userId, hashObject(options));

    const cached = oracleCacheService.get<EnergyStats>(cacheKeyStr);
    if (cached) {
      return cached;
    }

    const startDate = options.start_date || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const endDate = options.end_date || new Date().toISOString();

    const entries = await this.getEntries(userId, { start_date: startDate, end_date: endDate, limit: 1000 });

    if (entries.length === 0) {
      return this.getEmptyStats(startDate, endDate);
    }

    // Calculate averages
    const avgEnergy = entries.reduce((sum, e) => sum + e.energy_level, 0) / entries.length;
    const avgMood = entries.reduce((sum, e) => sum + MOOD_SCORES[e.mood], 0) / entries.length;

    // Energy trend
    const recentEntries = entries.slice(0, Math.min(10, entries.length));
    const olderEntries = entries.slice(Math.min(10, entries.length), Math.min(20, entries.length));
    const recentAvg = recentEntries.reduce((sum, e) => sum + e.energy_level, 0) / recentEntries.length;
    const olderAvg = olderEntries.length > 0
      ? olderEntries.reduce((sum, e) => sum + e.energy_level, 0) / olderEntries.length
      : recentAvg;

    let energyTrend: EnergyTrend;
    const trendDiff = recentAvg - olderAvg;
    if (trendDiff > 1) {
      energyTrend = 'rising';
    } else if (trendDiff < -1) {
      energyTrend = 'declining';
    } else {
      const variance = entries.reduce((sum, e) => sum + Math.pow(e.energy_level - avgEnergy, 2), 0) / entries.length;
      energyTrend = variance > 4 ? 'volatile' : 'stable';
    }

    // Best/worst days
    const dailyEnergy = new Map<string, { total: number; count: number }>();
    entries.forEach((e) => {
      const date = e.timestamp.split('T')[0];
      const day = dailyEnergy.get(date) || { total: 0, count: 0 };
      dailyEnergy.set(date, { total: day.total + e.energy_level, count: day.count + 1 });
    });

    let highestDay = '';
    let lowestDay = '';
    let highestAvg = 0;
    let lowestAvg = 11;

    dailyEnergy.forEach((data, date) => {
      const avg = data.total / data.count;
      if (avg > highestAvg) {
        highestAvg = avg;
        highestDay = date;
      }
      if (avg < lowestAvg) {
        lowestAvg = avg;
        lowestDay = date;
      }
    });

    // Mood distribution
    const moodDist: Partial<Record<MoodType, number>> = {};
    entries.forEach((e) => {
      moodDist[e.mood] = (moodDist[e.mood] || 0) + 1;
    });

    // Most common mood
    let mostCommonMood: MoodType = 'neutral';
    let maxMoodCount = 0;
    Object.entries(moodDist).forEach(([mood, count]) => {
      if (count > maxMoodCount) {
        maxMoodCount = count;
        mostCommonMood = mood as MoodType;
      }
    });

    // Energy by time of day
    const energyByTime: Partial<Record<TimeOfDay, { total: number; count: number }>> = {};
    entries.forEach((e) => {
      const tod = energyByTime[e.time_of_day] || { total: 0, count: 0 };
      energyByTime[e.time_of_day] = { total: tod.total + e.energy_level, count: tod.count + 1 };
    });

    const energyByTimeResult: Record<TimeOfDay, number> = {
      early_morning: 0, morning: 0, midday: 0, afternoon: 0, evening: 0, night: 0,
    };
    Object.entries(energyByTime).forEach(([time, data]) => {
      energyByTimeResult[time as TimeOfDay] = Math.round((data.total / data.count) * 10) / 10;
    });

    // Energy by day of week
    const energyByDay: Record<string, { total: number; count: number }> = {};
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    entries.forEach((e) => {
      const dayOfWeek = dayNames[new Date(e.timestamp).getDay()];
      const day = energyByDay[dayOfWeek] || { total: 0, count: 0 };
      energyByDay[dayOfWeek] = { total: day.total + e.energy_level, count: day.count + 1 };
    });

    const energyByDayResult: Record<string, number> = {};
    Object.entries(energyByDay).forEach(([day, data]) => {
      energyByDayResult[day] = Math.round((data.total / data.count) * 10) / 10;
    });

    // Factors analysis
    const positiveFactors = new Map<string, number>();
    const negativeFactors = new Map<string, number>();

    entries.forEach((e) => {
      e.factors.forEach((f) => {
        if (f.type === 'positive') {
          positiveFactors.set(f.description, (positiveFactors.get(f.description) || 0) + 1);
        } else {
          negativeFactors.set(f.description, (negativeFactors.get(f.description) || 0) + 1);
        }
      });
    });

    // Correlations
    const entriesWithSleep = entries.filter((e) => e.sleep_hours !== undefined);
    const sleepCorrelation = this.calculateCorrelation(
      entriesWithSleep.map((e) => e.sleep_hours!),
      entriesWithSleep.map((e) => e.energy_level)
    );

    const entriesWithExercise = entries.filter((e) => e.exercise_done !== undefined);
    const exerciseCorrelation = entriesWithExercise.length > 5
      ? this.calculatePointBiserialCorrelation(
          entriesWithExercise.map((e) => e.exercise_done!),
          entriesWithExercise.map((e) => e.energy_level)
        )
      : 0;

    // Burnout risk
    const burnout = await this.assessBurnout(userId);

    const stats: EnergyStats = {
      period_start: startDate,
      period_end: endDate,
      average_energy: Math.round(avgEnergy * 10) / 10,
      average_mood_score: Math.round(avgMood * 10) / 10,
      energy_trend: energyTrend,
      entries_count: entries.length,
      highest_energy_day: highestDay,
      lowest_energy_day: lowestDay,
      most_common_mood: mostCommonMood,
      mood_distribution: moodDist as Record<MoodType, number>,
      energy_by_time_of_day: energyByTimeResult,
      energy_by_day_of_week: energyByDayResult,
      top_positive_factors: Array.from(positiveFactors.entries())
        .map(([factor, freq]) => ({ factor, frequency: freq }))
        .sort((a, b) => b.frequency - a.frequency)
        .slice(0, 5),
      top_negative_factors: Array.from(negativeFactors.entries())
        .map(([factor, freq]) => ({ factor, frequency: freq }))
        .sort((a, b) => b.frequency - a.frequency)
        .slice(0, 5),
      burnout_risk: burnout.risk_level,
      sleep_correlation: Math.round(sleepCorrelation * 100) / 100,
      exercise_correlation: Math.round(exerciseCorrelation * 100) / 100,
    };

    oracleCacheService.set(cacheKeyStr, stats, CACHE_TTL.stats);
    return stats;
  }

  /**
   * Get empty stats
   */
  private getEmptyStats(startDate: string, endDate: string): EnergyStats {
    return {
      period_start: startDate,
      period_end: endDate,
      average_energy: 0,
      average_mood_score: 0,
      energy_trend: 'stable',
      entries_count: 0,
      highest_energy_day: '',
      lowest_energy_day: '',
      most_common_mood: 'neutral',
      mood_distribution: {} as Record<MoodType, number>,
      energy_by_time_of_day: { early_morning: 0, morning: 0, midday: 0, afternoon: 0, evening: 0, night: 0 },
      energy_by_day_of_week: {},
      top_positive_factors: [],
      top_negative_factors: [],
      burnout_risk: 'none',
      sleep_correlation: 0,
      exercise_correlation: 0,
    };
  }

  // ============================================================================
  // Burnout Assessment
  // ============================================================================

  /**
   * Assess burnout risk
   */
  async assessBurnout(userId: string): Promise<BurnoutAssessment> {
    const cacheKeyStr = cacheKey('energy_burnout', userId);

    const cached = oracleCacheService.get<BurnoutAssessment>(cacheKeyStr);
    if (cached) {
      return cached;
    }

    const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const entries = await this.getEntries(userId, { start_date: twoWeeksAgo, limit: 100 });

    const indicators: BurnoutIndicator[] = [];
    let riskScore = 0;
    const contributingFactors: string[] = [];

    if (entries.length < 5) {
      return {
        user_id: userId,
        risk_level: 'none',
        risk_score: 0,
        indicators: [],
        contributing_factors: [],
        days_at_risk: 0,
        trend: 'stable',
        recommendations: [],
        assessment_date: new Date().toISOString(),
      };
    }

    // Check for persistent low energy
    const lowEnergyDays = entries.filter((e) => e.energy_level <= 3).length;
    if (lowEnergyDays > entries.length * 0.5) {
      indicators.push({
        indicator: 'Persistent low energy',
        severity: lowEnergyDays > entries.length * 0.7 ? 'severe' : 'moderate',
        frequency: lowEnergyDays,
        first_noticed: entries[entries.length - 1].timestamp,
        trend: 'stable',
      });
      riskScore += 25;
      contributingFactors.push('Low energy levels');
    }

    // Check for exhaustion
    const exhaustedMoods = ['burned_out', 'overwhelmed', 'tired'];
    const exhaustionCount = entries.filter((e) => exhaustedMoods.includes(e.mood)).length;
    if (exhaustionCount > 3) {
      indicators.push({
        indicator: 'Frequent exhaustion or overwhelm',
        severity: exhaustionCount > 6 ? 'severe' : 'moderate',
        frequency: exhaustionCount,
        first_noticed: entries.find((e) => exhaustedMoods.includes(e.mood))?.timestamp || '',
        trend: 'stable',
      });
      riskScore += 20;
      contributingFactors.push('Emotional exhaustion');
    }

    // Check for poor sleep
    const poorSleepEntries = entries.filter((e) => e.sleep_quality !== undefined && e.sleep_quality <= 3);
    if (poorSleepEntries.length > 3) {
      indicators.push({
        indicator: 'Poor sleep quality',
        severity: poorSleepEntries.length > 6 ? 'severe' : 'moderate',
        frequency: poorSleepEntries.length,
        first_noticed: poorSleepEntries[poorSleepEntries.length - 1]?.timestamp || '',
        trend: 'stable',
      });
      riskScore += 15;
      contributingFactors.push('Poor sleep');
    }

    // Check for declining trend
    const recentEntries = entries.slice(0, 5);
    const olderEntries = entries.slice(5, 10);
    const recentAvg = recentEntries.reduce((sum, e) => sum + e.energy_level, 0) / recentEntries.length;
    const olderAvg = olderEntries.length > 0
      ? olderEntries.reduce((sum, e) => sum + e.energy_level, 0) / olderEntries.length
      : recentAvg;

    let trend: EnergyTrend = 'stable';
    if (recentAvg < olderAvg - 1.5) {
      trend = 'declining';
      riskScore += 15;
      contributingFactors.push('Declining energy trend');
    }

    // Check for stress/anxiety
    const stressMoods = ['stressed', 'anxious', 'frustrated'];
    const stressCount = entries.filter((e) => stressMoods.includes(e.mood)).length;
    if (stressCount > 4) {
      indicators.push({
        indicator: 'High stress or anxiety',
        severity: stressCount > 7 ? 'severe' : 'moderate',
        frequency: stressCount,
        first_noticed: entries.find((e) => stressMoods.includes(e.mood))?.timestamp || '',
        trend: 'stable',
      });
      riskScore += 15;
      contributingFactors.push('Elevated stress levels');
    }

    // Determine risk level
    let riskLevel: BurnoutRisk;
    if (riskScore >= 60) {
      riskLevel = 'critical';
    } else if (riskScore >= 45) {
      riskLevel = 'high';
    } else if (riskScore >= 25) {
      riskLevel = 'moderate';
    } else if (riskScore >= 10) {
      riskLevel = 'low';
    } else {
      riskLevel = 'none';
    }

    // Generate recommendations
    const recommendations = this.getRecoveryRecommendations(riskLevel, contributingFactors);

    const assessment: BurnoutAssessment = {
      user_id: userId,
      risk_level: riskLevel,
      risk_score: Math.min(100, riskScore),
      indicators,
      contributing_factors: contributingFactors,
      days_at_risk: lowEnergyDays,
      trend,
      recommendations,
      assessment_date: new Date().toISOString(),
    };

    oracleCacheService.set(cacheKeyStr, assessment, CACHE_TTL.burnout);
    return assessment;
  }

  /**
   * Check burnout risk and trigger warning if needed
   */
  private async checkBurnoutRisk(userId: string): Promise<void> {
    const settings = await this.getSettings(userId);
    if (!settings.burnout_warnings_enabled) return;

    const assessment = await this.assessBurnout(userId);
    if (assessment.risk_score >= settings.burnout_threshold) {
      // In production, this would trigger a notification or alert
      console.warn(`Burnout warning for user ${userId}: ${assessment.risk_level} risk`);
    }
  }

  /**
   * Get recovery recommendations based on risk and factors
   */
  private getRecoveryRecommendations(
    riskLevel: BurnoutRisk,
    factors: string[]
  ): RecoveryRecommendation[] {
    const recommendations: RecoveryRecommendation[] = [];

    // Always include high-priority recommendations for high risk
    if (riskLevel === 'critical' || riskLevel === 'high') {
      recommendations.push(
        ...RECOVERY_RECOMMENDATIONS.filter((r) => r.priority === 'high')
      );
    }

    // Add factor-specific recommendations
    if (factors.includes('Poor sleep')) {
      recommendations.push(
        ...RECOVERY_RECOMMENDATIONS.filter((r) => r.category === 'sleep')
      );
    }

    if (factors.includes('Elevated stress levels')) {
      recommendations.push(
        ...RECOVERY_RECOMMENDATIONS.filter((r) => r.category === 'mindfulness')
      );
    }

    if (factors.includes('Low energy levels')) {
      recommendations.push(
        ...RECOVERY_RECOMMENDATIONS.filter((r) => r.category === 'exercise' || r.category === 'nutrition')
      );
    }

    // Remove duplicates
    const uniqueRecs = new Map<string, RecoveryRecommendation>();
    recommendations.forEach((r) => {
      if (!uniqueRecs.has(r.title)) {
        uniqueRecs.set(r.title, r);
      }
    });

    return Array.from(uniqueRecs.values()).slice(0, 5);
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Get time of day from hour
   */
  private getTimeOfDay(hour: number): TimeOfDay {
    for (const [timeOfDay, hours] of Object.entries(TIME_OF_DAY_HOURS)) {
      if (hours.includes(hour)) {
        return timeOfDay as TimeOfDay;
      }
    }
    return 'morning';
  }

  /**
   * Calculate Pearson correlation coefficient
   */
  private calculateCorrelation(x: number[], y: number[]): number {
    if (x.length !== y.length || x.length < 2) return 0;

    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((total, xi, i) => total + xi * y[i], 0);
    const sumX2 = x.reduce((total, xi) => total + xi * xi, 0);
    const sumY2 = y.reduce((total, yi) => total + yi * yi, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

    return denominator === 0 ? 0 : numerator / denominator;
  }

  /**
   * Calculate point-biserial correlation (for binary variable)
   */
  private calculatePointBiserialCorrelation(binary: boolean[], continuous: number[]): number {
    const group0 = continuous.filter((_, i) => !binary[i]);
    const group1 = continuous.filter((_, i) => binary[i]);

    if (group0.length === 0 || group1.length === 0) return 0;

    const mean0 = group0.reduce((a, b) => a + b, 0) / group0.length;
    const mean1 = group1.reduce((a, b) => a + b, 0) / group1.length;
    const overallMean = continuous.reduce((a, b) => a + b, 0) / continuous.length;
    const overallStd = Math.sqrt(
      continuous.reduce((sum, v) => sum + Math.pow(v - overallMean, 2), 0) / continuous.length
    );

    if (overallStd === 0) return 0;

    const p = group1.length / continuous.length;
    const q = 1 - p;

    return ((mean1 - mean0) / overallStd) * Math.sqrt(p * q);
  }

  // ============================================================================
  // Settings
  // ============================================================================

  /**
   * Get settings
   */
  async getSettings(userId: string): Promise<EnergyTrackerSettings> {
    const cacheKeyStr = cacheKey('energy_settings', userId);

    const cached = oracleCacheService.get<EnergyTrackerSettings>(cacheKeyStr);
    if (cached) {
      return cached;
    }

    let settings = this.settings.get(userId);

    if (!settings) {
      settings = {
        user_id: userId,
        reminder_enabled: true,
        reminder_times: ['09:00', '14:00', '18:00'],
        track_sleep: true,
        track_nutrition: false,
        track_exercise: true,
        burnout_warnings_enabled: true,
        burnout_threshold: 50,
        share_with_manager: false,
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
    updates: Partial<Omit<EnergyTrackerSettings, 'user_id' | 'updated_at'>>
  ): Promise<EnergyTrackerSettings> {
    const settings = await this.getSettings(userId);

    const updatedSettings = {
      ...settings,
      ...updates,
      updated_at: new Date().toISOString(),
    };

    this.settings.set(userId, updatedSettings);
    oracleCacheService.delete(cacheKey('energy_settings', userId));

    return updatedSettings;
  }
}

// Singleton instance
export const energyTrackerService = new EnergyTrackerService();
