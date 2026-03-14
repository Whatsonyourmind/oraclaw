/**
 * ORACLE Smart Scheduling Service
 * Story adv-15 - Intelligent time recommendations and calendar optimization
 *
 * Implements:
 * - findOptimalTime() - best time for task based on patterns
 * - predictAvailability() - forecast free slots
 * - suggestRescheduling() - proactive calendar optimization
 * - Integration with calendar data
 * - Energy level predictions (morning/afternoon person)
 */

import { oracleCacheService, cacheKey, hashObject } from './cache';
import { patternLearningService } from './patternLearning';

// ============================================================================
// Types
// ============================================================================

export type EnergyLevel = 'peak' | 'high' | 'moderate' | 'low' | 'rest';
export type TaskCategory = 'deep_work' | 'meetings' | 'admin' | 'creative' | 'exercise' | 'rest' | 'other';
export type DayPeriod = 'early_morning' | 'morning' | 'midday' | 'afternoon' | 'evening' | 'night';

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  is_all_day: boolean;
  category?: TaskCategory;
  location?: string;
  is_recurring?: boolean;
  attendees?: number;
  metadata?: Record<string, any>;
}

export interface TimeSlot {
  start: string;
  end: string;
  duration_minutes: number;
  energy_level: EnergyLevel;
  suitability_scores: Record<TaskCategory, number>;
  is_available: boolean;
  conflicts?: CalendarEvent[];
  reason?: string;
}

export interface EnergyProfile {
  user_id: string;
  chronotype: 'early_bird' | 'night_owl' | 'intermediate';
  peak_hours: number[]; // Hours when user is at peak energy
  low_hours: number[]; // Hours when user is at low energy
  day_preferences: Record<string, DayPeriod[]>; // Day -> preferred working periods
  energy_curve: Record<string, EnergyLevel>; // Hour -> typical energy level
  productivity_patterns: ProductivityPattern[];
  updated_at: string;
}

export interface ProductivityPattern {
  task_category: TaskCategory;
  preferred_hours: number[];
  preferred_days: number[];
  average_duration_minutes: number;
  success_rate: number;
}

export interface OptimalTimeResult {
  recommended_slot: TimeSlot;
  alternative_slots: TimeSlot[];
  reasoning: string;
  energy_at_slot: EnergyLevel;
  task_fit_score: number;
  calendar_conflicts: CalendarEvent[];
}

export interface AvailabilityForecast {
  date: string;
  available_slots: TimeSlot[];
  busy_slots: Array<{
    start: string;
    end: string;
    event?: CalendarEvent;
  }>;
  total_available_minutes: number;
  energy_distribution: Record<EnergyLevel, number>; // Level -> minutes
  recommendations: string[];
}

export interface ReschedulingSuggestion {
  original_event: CalendarEvent;
  suggested_slot: TimeSlot;
  reason: string;
  benefit_score: number;
  conflicts_resolved: number;
  energy_improvement: number;
}

export interface ScheduleOptimization {
  original_schedule: CalendarEvent[];
  optimized_schedule: CalendarEvent[];
  suggestions: ReschedulingSuggestion[];
  total_improvement_score: number;
  energy_balance_improved: boolean;
  conflicts_reduced: number;
}

// Cache TTLs
const SCHEDULING_CACHE_TTL = {
  energy_profile: 60 * 60 * 1000, // 1 hour
  availability: 15 * 60 * 1000, // 15 minutes
  optimal_time: 10 * 60 * 1000, // 10 minutes
};

// Default energy curves by chronotype
const CHRONOTYPE_ENERGY_CURVES: Record<string, Record<number, EnergyLevel>> = {
  early_bird: {
    5: 'moderate', 6: 'high', 7: 'peak', 8: 'peak', 9: 'peak',
    10: 'high', 11: 'high', 12: 'moderate', 13: 'moderate',
    14: 'low', 15: 'moderate', 16: 'moderate', 17: 'low',
    18: 'low', 19: 'rest', 20: 'rest', 21: 'rest',
  },
  night_owl: {
    8: 'low', 9: 'low', 10: 'moderate', 11: 'high',
    12: 'high', 13: 'high', 14: 'high', 15: 'peak',
    16: 'peak', 17: 'peak', 18: 'high', 19: 'high',
    20: 'high', 21: 'moderate', 22: 'moderate', 23: 'moderate',
  },
  intermediate: {
    7: 'low', 8: 'moderate', 9: 'high', 10: 'peak',
    11: 'peak', 12: 'high', 13: 'moderate', 14: 'moderate',
    15: 'high', 16: 'high', 17: 'moderate', 18: 'moderate',
    19: 'low', 20: 'low', 21: 'rest',
  },
};

// Task category to energy level preferences
const TASK_ENERGY_REQUIREMENTS: Record<TaskCategory, EnergyLevel[]> = {
  deep_work: ['peak', 'high'],
  meetings: ['high', 'moderate', 'peak'],
  admin: ['moderate', 'low'],
  creative: ['peak', 'high'],
  exercise: ['moderate', 'high'],
  rest: ['low', 'rest'],
  other: ['moderate', 'high', 'low'],
};

// ============================================================================
// Smart Scheduling Service
// ============================================================================

export class SmartSchedulingService {
  // In-memory stores (would use database in production)
  private energyProfiles: Map<string, EnergyProfile> = new Map();
  private calendarCache: Map<string, CalendarEvent[]> = new Map();
  private completedTasks: Map<string, Array<{
    category: TaskCategory;
    start_hour: number;
    day_of_week: number;
    duration_minutes: number;
    success: boolean;
  }>> = new Map();

  // ============================================================================
  // Optimal Time Finding
  // ============================================================================

  /**
   * Find the optimal time for a task based on patterns and energy levels
   */
  async findOptimalTime(
    userId: string,
    options: {
      task_category: TaskCategory;
      duration_minutes: number;
      earliest_start?: string;
      latest_end?: string;
      prefer_morning?: boolean;
      prefer_afternoon?: boolean;
      avoid_conflicts?: boolean;
      min_energy_level?: EnergyLevel;
    }
  ): Promise<OptimalTimeResult> {
    const cacheKeyStr = cacheKey('optimal', userId, hashObject(options));
    const cached = oracleCacheService.get<OptimalTimeResult>(cacheKeyStr);
    if (cached) {
      return cached;
    }

    const energyProfile = await this.getEnergyProfile(userId);
    const availability = await this.predictAvailability(userId, {
      start_date: options.earliest_start || new Date().toISOString(),
      end_date: options.latest_end || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      include_energy: true,
    });

    // Get all available slots that can fit the task
    const candidateSlots: TimeSlot[] = [];

    for (const dayForecast of [availability]) {
      for (const slot of dayForecast.available_slots) {
        if (slot.duration_minutes >= options.duration_minutes) {
          candidateSlots.push(slot);
        }
      }
    }

    // Score each slot
    const scoredSlots = candidateSlots.map((slot) => {
      let score = 0;

      // Energy level match (0-40 points)
      const energyScore = this.calculateEnergyScore(
        slot.energy_level,
        options.task_category,
        options.min_energy_level
      );
      score += energyScore * 40;

      // Task category suitability (0-30 points)
      const suitability = slot.suitability_scores[options.task_category] || 0.5;
      score += suitability * 30;

      // Time preference (0-15 points)
      const hour = new Date(slot.start).getHours();
      if (options.prefer_morning && hour >= 6 && hour <= 12) {
        score += 15;
      } else if (options.prefer_afternoon && hour >= 12 && hour <= 18) {
        score += 15;
      } else {
        score += 5;
      }

      // Availability (0-15 points)
      if (slot.is_available) {
        score += 15;
      } else if (slot.conflicts && slot.conflicts.length === 1) {
        score += 5;
      }

      return { slot, score };
    });

    // Sort by score descending
    scoredSlots.sort((a, b) => b.score - a.score);

    if (scoredSlots.length === 0) {
      // No suitable slots found - create a fallback
      const fallbackSlot = this.createFallbackSlot(options);
      return {
        recommended_slot: fallbackSlot,
        alternative_slots: [],
        reasoning: 'No available slots found in the specified time range. Suggested slot is based on typical patterns.',
        energy_at_slot: fallbackSlot.energy_level,
        task_fit_score: 0.5,
        calendar_conflicts: [],
      };
    }

    const best = scoredSlots[0];
    const alternatives = scoredSlots.slice(1, 4).map((s) => s.slot);

    const result: OptimalTimeResult = {
      recommended_slot: best.slot,
      alternative_slots: alternatives,
      reasoning: this.generateReasoningText(
        best.slot,
        options.task_category,
        energyProfile
      ),
      energy_at_slot: best.slot.energy_level,
      task_fit_score: best.score / 100,
      calendar_conflicts: best.slot.conflicts || [],
    };

    oracleCacheService.set(cacheKeyStr, result, SCHEDULING_CACHE_TTL.optimal_time);
    return result;
  }

  /**
   * Calculate energy score for a slot/task combination
   */
  private calculateEnergyScore(
    slotEnergy: EnergyLevel,
    taskCategory: TaskCategory,
    minEnergy?: EnergyLevel
  ): number {
    const energyOrder: EnergyLevel[] = ['rest', 'low', 'moderate', 'high', 'peak'];
    const slotEnergyIndex = energyOrder.indexOf(slotEnergy);

    // Check minimum energy requirement
    if (minEnergy) {
      const minIndex = energyOrder.indexOf(minEnergy);
      if (slotEnergyIndex < minIndex) {
        return 0;
      }
    }

    // Check if energy level matches task requirements
    const requiredLevels = TASK_ENERGY_REQUIREMENTS[taskCategory];
    if (requiredLevels.includes(slotEnergy)) {
      // Perfect match
      const matchIndex = requiredLevels.indexOf(slotEnergy);
      return 1 - matchIndex * 0.2; // First preference = 1, second = 0.8, etc.
    }

    // Partial match based on energy proximity
    const closestRequired = requiredLevels[0];
    const requiredIndex = energyOrder.indexOf(closestRequired);
    const distance = Math.abs(slotEnergyIndex - requiredIndex);

    return Math.max(0, 1 - distance * 0.25);
  }

  /**
   * Generate reasoning text for the recommendation
   */
  private generateReasoningText(
    slot: TimeSlot,
    category: TaskCategory,
    profile: EnergyProfile
  ): string {
    const parts: string[] = [];

    const slotDate = new Date(slot.start);
    const hour = slotDate.getHours();
    const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][slotDate.getDay()];

    // Energy level reasoning
    if (slot.energy_level === 'peak') {
      parts.push(`This is your peak energy time${profile.chronotype === 'early_bird' ? ' (early bird pattern)' : profile.chronotype === 'night_owl' ? ' (night owl pattern)' : ''}.`);
    } else if (slot.energy_level === 'high') {
      parts.push('Your energy is typically high at this time.');
    }

    // Task-specific reasoning
    const taskNames: Record<TaskCategory, string> = {
      deep_work: 'deep focus work',
      meetings: 'meetings',
      admin: 'administrative tasks',
      creative: 'creative work',
      exercise: 'exercise',
      rest: 'rest breaks',
      other: 'this task',
    };

    if (TASK_ENERGY_REQUIREMENTS[category].includes(slot.energy_level)) {
      parts.push(`${slot.energy_level.charAt(0).toUpperCase() + slot.energy_level.slice(1)} energy is ideal for ${taskNames[category]}.`);
    }

    // Pattern-based reasoning
    const productivity = profile.productivity_patterns.find((p) => p.task_category === category);
    if (productivity && productivity.preferred_hours.includes(hour)) {
      parts.push(`You've been successful with ${taskNames[category]} around ${hour}:00 before (${(productivity.success_rate * 100).toFixed(0)}% success rate).`);
    }

    // Availability reasoning
    if (slot.is_available) {
      parts.push(`Your calendar is clear on ${dayName} at this time.`);
    }

    return parts.join(' ') || 'This slot matches your typical patterns.';
  }

  /**
   * Create a fallback slot when no ideal slots are found
   */
  private createFallbackSlot(options: {
    task_category: TaskCategory;
    duration_minutes: number;
    earliest_start?: string;
    prefer_morning?: boolean;
  }): TimeSlot {
    const startDate = options.earliest_start
      ? new Date(options.earliest_start)
      : new Date();

    // Round to next hour
    startDate.setMinutes(0, 0, 0);
    if (new Date() > startDate) {
      startDate.setHours(startDate.getHours() + 1);
    }

    // Adjust for preference
    const hour = startDate.getHours();
    if (options.prefer_morning && hour > 12) {
      startDate.setDate(startDate.getDate() + 1);
      startDate.setHours(9);
    }

    const endDate = new Date(startDate.getTime() + options.duration_minutes * 60 * 1000);

    return {
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      duration_minutes: options.duration_minutes,
      energy_level: 'moderate',
      suitability_scores: { [options.task_category]: 0.5 } as Record<TaskCategory, number>,
      is_available: true,
      reason: 'Fallback slot',
    };
  }

  // ============================================================================
  // Availability Prediction
  // ============================================================================

  /**
   * Predict availability for a given time range
   */
  async predictAvailability(
    userId: string,
    options: {
      start_date: string;
      end_date: string;
      include_energy?: boolean;
      slot_duration_minutes?: number;
    }
  ): Promise<AvailabilityForecast> {
    const cacheKeyStr = cacheKey('availability', userId, hashObject(options));
    const cached = oracleCacheService.get<AvailabilityForecast>(cacheKeyStr);
    if (cached) {
      return cached;
    }

    const energyProfile = await this.getEnergyProfile(userId);
    const calendar = await this.getCalendarEvents(userId, options.start_date, options.end_date);
    const slotDuration = options.slot_duration_minutes || 30;

    const startDate = new Date(options.start_date);
    const endDate = new Date(options.end_date);

    const availableSlots: TimeSlot[] = [];
    const busySlots: Array<{ start: string; end: string; event?: CalendarEvent }> = [];

    // Generate time slots
    let currentTime = new Date(startDate);
    currentTime.setMinutes(0, 0, 0);

    // Typical working hours
    const workStartHour = 8;
    const workEndHour = 18;

    while (currentTime < endDate) {
      const hour = currentTime.getHours();
      const dayOfWeek = currentTime.getDay();

      // Skip nights and weekends (configurable)
      if (hour >= workStartHour && hour < workEndHour && dayOfWeek >= 1 && dayOfWeek <= 5) {
        const slotStart = new Date(currentTime);
        const slotEnd = new Date(currentTime.getTime() + slotDuration * 60 * 1000);

        // Check for conflicts
        const conflicts = calendar.filter((event) => {
          const eventStart = new Date(event.start);
          const eventEnd = new Date(event.end);
          return slotStart < eventEnd && slotEnd > eventStart;
        });

        const isAvailable = conflicts.length === 0;
        const energyLevel = options.include_energy !== false
          ? this.getEnergyLevelAtTime(energyProfile, hour)
          : 'moderate';

        const suitabilityScores = this.calculateSuitabilityScores(energyLevel, hour, dayOfWeek);

        if (isAvailable) {
          availableSlots.push({
            start: slotStart.toISOString(),
            end: slotEnd.toISOString(),
            duration_minutes: slotDuration,
            energy_level: energyLevel,
            suitability_scores: suitabilityScores,
            is_available: true,
          });
        } else {
          busySlots.push({
            start: slotStart.toISOString(),
            end: slotEnd.toISOString(),
            event: conflicts[0],
          });
        }
      }

      currentTime.setMinutes(currentTime.getMinutes() + slotDuration);
    }

    // Merge adjacent available slots
    const mergedSlots = this.mergeAdjacentSlots(availableSlots);

    // Calculate energy distribution
    const energyDistribution: Record<EnergyLevel, number> = {
      peak: 0,
      high: 0,
      moderate: 0,
      low: 0,
      rest: 0,
    };

    for (const slot of mergedSlots) {
      energyDistribution[slot.energy_level] += slot.duration_minutes;
    }

    // Generate recommendations
    const recommendations = this.generateAvailabilityRecommendations(
      mergedSlots,
      busySlots,
      energyProfile
    );

    const forecast: AvailabilityForecast = {
      date: options.start_date.split('T')[0],
      available_slots: mergedSlots,
      busy_slots: busySlots,
      total_available_minutes: mergedSlots.reduce((sum, s) => sum + s.duration_minutes, 0),
      energy_distribution: energyDistribution,
      recommendations,
    };

    oracleCacheService.set(cacheKeyStr, forecast, SCHEDULING_CACHE_TTL.availability);
    return forecast;
  }

  /**
   * Calculate suitability scores for each task category
   */
  private calculateSuitabilityScores(
    energy: EnergyLevel,
    hour: number,
    dayOfWeek: number
  ): Record<TaskCategory, number> {
    const categories: TaskCategory[] = ['deep_work', 'meetings', 'admin', 'creative', 'exercise', 'rest', 'other'];
    const scores: Record<TaskCategory, number> = {} as any;

    for (const category of categories) {
      let score = 0.5;

      // Energy match
      const requiredEnergy = TASK_ENERGY_REQUIREMENTS[category];
      if (requiredEnergy.includes(energy)) {
        score += 0.3;
      } else {
        score -= 0.1;
      }

      // Time of day preferences
      if (category === 'deep_work' && (hour >= 9 && hour <= 11)) {
        score += 0.15;
      }
      if (category === 'meetings' && (hour >= 10 && hour <= 16)) {
        score += 0.1;
      }
      if (category === 'admin' && (hour >= 14 && hour <= 17)) {
        score += 0.1;
      }
      if (category === 'exercise' && (hour >= 6 && hour <= 8 || hour >= 17 && hour <= 19)) {
        score += 0.2;
      }

      scores[category] = Math.max(0, Math.min(1, score));
    }

    return scores;
  }

  /**
   * Merge adjacent available slots
   */
  private mergeAdjacentSlots(slots: TimeSlot[]): TimeSlot[] {
    if (slots.length === 0) return [];

    const sorted = [...slots].sort(
      (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
    );

    const merged: TimeSlot[] = [];
    let current = { ...sorted[0] };

    for (let i = 1; i < sorted.length; i++) {
      const next = sorted[i];

      // Check if adjacent (within 1 minute)
      const currentEnd = new Date(current.end).getTime();
      const nextStart = new Date(next.start).getTime();

      if (nextStart - currentEnd <= 60000 && current.energy_level === next.energy_level) {
        // Merge
        current.end = next.end;
        current.duration_minutes += next.duration_minutes;
      } else {
        merged.push(current);
        current = { ...next };
      }
    }

    merged.push(current);
    return merged;
  }

  /**
   * Generate availability recommendations
   */
  private generateAvailabilityRecommendations(
    available: TimeSlot[],
    busy: Array<{ start: string; end: string; event?: CalendarEvent }>,
    profile: EnergyProfile
  ): string[] {
    const recommendations: string[] = [];

    // Check for peak energy during busy times
    const peakSlots = available.filter((s) => s.energy_level === 'peak');
    if (peakSlots.length === 0 && profile.peak_hours.length > 0) {
      recommendations.push('Your peak energy hours are fully booked. Consider protecting some time for deep work.');
    }

    // Check total available time
    const totalAvailable = available.reduce((sum, s) => sum + s.duration_minutes, 0);
    if (totalAvailable < 120) {
      recommendations.push('Limited availability today. Prioritize essential tasks.');
    }

    // Check for long uninterrupted blocks
    const longBlocks = available.filter((s) => s.duration_minutes >= 90);
    if (longBlocks.length > 0) {
      const block = longBlocks[0];
      const time = new Date(block.start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      recommendations.push(`You have a ${block.duration_minutes}-minute uninterrupted block at ${time}. Great for deep work!`);
    }

    // Check for back-to-back meetings
    const meetingsCount = busy.filter((b) => b.event?.category === 'meetings' || b.event?.attendees).length;
    if (meetingsCount >= 4) {
      recommendations.push('Heavy meeting load today. Schedule buffer time between meetings if possible.');
    }

    return recommendations;
  }

  // ============================================================================
  // Rescheduling Suggestions
  // ============================================================================

  /**
   * Suggest rescheduling for calendar optimization
   */
  async suggestRescheduling(
    userId: string,
    options: {
      start_date?: string;
      end_date?: string;
      optimize_for?: 'energy' | 'productivity' | 'focus_time';
      max_suggestions?: number;
    } = {}
  ): Promise<ScheduleOptimization> {
    const energyProfile = await this.getEnergyProfile(userId);
    const calendar = await this.getCalendarEvents(
      userId,
      options.start_date || new Date().toISOString(),
      options.end_date || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    );

    const suggestions: ReschedulingSuggestion[] = [];
    const optimizeFor = options.optimize_for || 'energy';

    for (const event of calendar) {
      // Skip all-day events and recurring events
      if (event.is_all_day || event.is_recurring) continue;

      const eventStart = new Date(event.start);
      const eventHour = eventStart.getHours();
      const eventEnergy = this.getEnergyLevelAtTime(energyProfile, eventHour);

      // Determine if event is misaligned
      const category = event.category || this.inferCategory(event);
      const requiredEnergy = TASK_ENERGY_REQUIREMENTS[category];
      const isAligned = requiredEnergy.includes(eventEnergy);

      if (!isAligned) {
        // Find better slot
        const optimalResult = await this.findOptimalTime(userId, {
          task_category: category,
          duration_minutes: this.calculateDuration(event.start, event.end),
          earliest_start: options.start_date,
          latest_end: options.end_date,
          avoid_conflicts: true,
        });

        if (optimalResult.task_fit_score > 0.6) {
          const energyImprovement = this.calculateEnergyImprovement(
            eventEnergy,
            optimalResult.energy_at_slot
          );

          suggestions.push({
            original_event: event,
            suggested_slot: optimalResult.recommended_slot,
            reason: `Move to ${optimalResult.energy_at_slot} energy time for better ${category} performance.`,
            benefit_score: optimalResult.task_fit_score,
            conflicts_resolved: optimalResult.calendar_conflicts.length,
            energy_improvement: energyImprovement,
          });
        }
      }
    }

    // Sort by benefit and limit
    suggestions.sort((a, b) => b.benefit_score - a.benefit_score);
    const limitedSuggestions = suggestions.slice(0, options.max_suggestions || 5);

    // Calculate overall improvement
    const totalImprovement = limitedSuggestions.reduce(
      (sum, s) => sum + s.benefit_score,
      0
    ) / Math.max(1, limitedSuggestions.length);

    return {
      original_schedule: calendar,
      optimized_schedule: this.applyOptimizations(calendar, limitedSuggestions),
      suggestions: limitedSuggestions,
      total_improvement_score: totalImprovement,
      energy_balance_improved: limitedSuggestions.some((s) => s.energy_improvement > 0),
      conflicts_reduced: limitedSuggestions.reduce((sum, s) => sum + s.conflicts_resolved, 0),
    };
  }

  /**
   * Calculate energy improvement between two levels
   */
  private calculateEnergyImprovement(from: EnergyLevel, to: EnergyLevel): number {
    const levels: EnergyLevel[] = ['rest', 'low', 'moderate', 'high', 'peak'];
    const fromIndex = levels.indexOf(from);
    const toIndex = levels.indexOf(to);
    return (toIndex - fromIndex) / levels.length;
  }

  /**
   * Infer task category from event properties
   */
  private inferCategory(event: CalendarEvent): TaskCategory {
    const title = event.title.toLowerCase();

    if (event.attendees && event.attendees > 1) {
      return 'meetings';
    }
    if (title.includes('focus') || title.includes('deep') || title.includes('work')) {
      return 'deep_work';
    }
    if (title.includes('admin') || title.includes('email') || title.includes('report')) {
      return 'admin';
    }
    if (title.includes('creative') || title.includes('design') || title.includes('brainstorm')) {
      return 'creative';
    }
    if (title.includes('gym') || title.includes('workout') || title.includes('exercise') || title.includes('run')) {
      return 'exercise';
    }
    if (title.includes('lunch') || title.includes('break') || title.includes('rest')) {
      return 'rest';
    }

    return 'other';
  }

  /**
   * Calculate duration in minutes
   */
  private calculateDuration(start: string, end: string): number {
    return (new Date(end).getTime() - new Date(start).getTime()) / (60 * 1000);
  }

  /**
   * Apply optimizations to create new schedule
   */
  private applyOptimizations(
    original: CalendarEvent[],
    suggestions: ReschedulingSuggestion[]
  ): CalendarEvent[] {
    const optimized = [...original];

    for (const suggestion of suggestions) {
      const eventIndex = optimized.findIndex((e) => e.id === suggestion.original_event.id);
      if (eventIndex !== -1) {
        const duration = this.calculateDuration(
          optimized[eventIndex].start,
          optimized[eventIndex].end
        );

        optimized[eventIndex] = {
          ...optimized[eventIndex],
          start: suggestion.suggested_slot.start,
          end: new Date(
            new Date(suggestion.suggested_slot.start).getTime() + duration * 60 * 1000
          ).toISOString(),
        };
      }
    }

    return optimized;
  }

  // ============================================================================
  // Energy Profile Management
  // ============================================================================

  /**
   * Get or create energy profile for a user
   */
  async getEnergyProfile(userId: string): Promise<EnergyProfile> {
    const cacheKeyStr = cacheKey('energy', userId);
    const cached = oracleCacheService.get<EnergyProfile>(cacheKeyStr);
    if (cached) {
      return cached;
    }

    let profile = this.energyProfiles.get(userId);

    if (!profile) {
      profile = await this.inferEnergyProfile(userId);
      this.energyProfiles.set(userId, profile);
    }

    oracleCacheService.set(cacheKeyStr, profile, SCHEDULING_CACHE_TTL.energy_profile);
    return profile;
  }

  /**
   * Infer energy profile from user patterns
   */
  private async inferEnergyProfile(userId: string): Promise<EnergyProfile> {
    const now = new Date().toISOString();

    // Get completed tasks for pattern analysis
    const completedTasks = this.completedTasks.get(userId) || [];

    // Determine chronotype based on completion patterns
    let chronotype: 'early_bird' | 'night_owl' | 'intermediate' = 'intermediate';
    const morningTasks = completedTasks.filter((t) => t.start_hour >= 6 && t.start_hour <= 10);
    const eveningTasks = completedTasks.filter((t) => t.start_hour >= 16 && t.start_hour <= 22);

    if (morningTasks.length > eveningTasks.length * 1.5) {
      chronotype = 'early_bird';
    } else if (eveningTasks.length > morningTasks.length * 1.5) {
      chronotype = 'night_owl';
    }

    // Build energy curve
    const baseCurve = CHRONOTYPE_ENERGY_CURVES[chronotype];
    const energyCurve: Record<string, EnergyLevel> = {};

    for (let hour = 0; hour < 24; hour++) {
      energyCurve[hour.toString()] = baseCurve[hour] || 'rest';
    }

    // Calculate peak and low hours
    const peakHours = Object.entries(energyCurve)
      .filter(([_, level]) => level === 'peak')
      .map(([hour, _]) => parseInt(hour, 10));

    const lowHours = Object.entries(energyCurve)
      .filter(([_, level]) => level === 'low' || level === 'rest')
      .map(([hour, _]) => parseInt(hour, 10));

    // Build productivity patterns from task history
    const productivityPatterns: ProductivityPattern[] = [];
    const categoryStats = new Map<TaskCategory, {
      hours: number[];
      days: number[];
      durations: number[];
      successes: number;
      total: number;
    }>();

    for (const task of completedTasks) {
      if (!categoryStats.has(task.category)) {
        categoryStats.set(task.category, {
          hours: [],
          days: [],
          durations: [],
          successes: 0,
          total: 0,
        });
      }

      const stats = categoryStats.get(task.category)!;
      stats.hours.push(task.start_hour);
      stats.days.push(task.day_of_week);
      stats.durations.push(task.duration_minutes);
      stats.total++;
      if (task.success) {
        stats.successes++;
      }
    }

    for (const [category, stats] of categoryStats.entries()) {
      if (stats.total >= 3) {
        productivityPatterns.push({
          task_category: category,
          preferred_hours: [...new Set(stats.hours)].sort((a, b) => a - b),
          preferred_days: [...new Set(stats.days)].sort((a, b) => a - b),
          average_duration_minutes:
            stats.durations.reduce((a, b) => a + b, 0) / stats.durations.length,
          success_rate: stats.successes / stats.total,
        });
      }
    }

    return {
      user_id: userId,
      chronotype,
      peak_hours: peakHours,
      low_hours: lowHours,
      day_preferences: {},
      energy_curve: energyCurve,
      productivity_patterns: productivityPatterns,
      updated_at: now,
    };
  }

  /**
   * Get energy level at a specific hour
   */
  private getEnergyLevelAtTime(profile: EnergyProfile, hour: number): EnergyLevel {
    return profile.energy_curve[hour.toString()] || 'moderate';
  }

  /**
   * Update energy profile based on task completion
   */
  async recordTaskCompletion(
    userId: string,
    task: {
      category: TaskCategory;
      start_time: string;
      duration_minutes: number;
      success: boolean;
    }
  ): Promise<void> {
    if (!this.completedTasks.has(userId)) {
      this.completedTasks.set(userId, []);
    }

    const startDate = new Date(task.start_time);
    this.completedTasks.get(userId)!.push({
      category: task.category,
      start_hour: startDate.getHours(),
      day_of_week: startDate.getDay(),
      duration_minutes: task.duration_minutes,
      success: task.success,
    });

    // Invalidate cache
    oracleCacheService.deleteByPrefix(`energy:${userId}`);
  }

  // ============================================================================
  // Calendar Integration
  // ============================================================================

  /**
   * Get calendar events (mock implementation)
   */
  private async getCalendarEvents(
    userId: string,
    startDate: string,
    endDate: string
  ): Promise<CalendarEvent[]> {
    // In production, this would integrate with actual calendar APIs
    // For now, return cached events or mock data

    const cachedKey = `${userId}:${startDate}:${endDate}`;
    let events = this.calendarCache.get(cachedKey);

    if (!events) {
      // Generate some sample events
      events = this.generateMockCalendarEvents(startDate, endDate);
      this.calendarCache.set(cachedKey, events);
    }

    return events;
  }

  /**
   * Add calendar events (for integration)
   */
  async setCalendarEvents(
    userId: string,
    events: CalendarEvent[],
    startDate: string,
    endDate: string
  ): Promise<void> {
    const cachedKey = `${userId}:${startDate}:${endDate}`;
    this.calendarCache.set(cachedKey, events);
    oracleCacheService.deleteByPrefix(`availability:${userId}`);
    oracleCacheService.deleteByPrefix(`optimal:${userId}`);
  }

  /**
   * Generate mock calendar events for demo
   */
  private generateMockCalendarEvents(startDate: string, endDate: string): CalendarEvent[] {
    const events: CalendarEvent[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Generate a few typical events
    const current = new Date(start);

    while (current < end) {
      const dayOfWeek = current.getDay();

      // Skip weekends
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        // Morning standup
        if (Math.random() > 0.3) {
          const standupStart = new Date(current);
          standupStart.setHours(9, 0, 0, 0);
          events.push({
            id: crypto.randomUUID(),
            title: 'Daily Standup',
            start: standupStart.toISOString(),
            end: new Date(standupStart.getTime() + 15 * 60000).toISOString(),
            is_all_day: false,
            category: 'meetings',
            attendees: 5,
          });
        }

        // Random meeting
        if (Math.random() > 0.5) {
          const meetingHour = 10 + Math.floor(Math.random() * 6);
          const meetingStart = new Date(current);
          meetingStart.setHours(meetingHour, 0, 0, 0);
          events.push({
            id: crypto.randomUUID(),
            title: 'Team Meeting',
            start: meetingStart.toISOString(),
            end: new Date(meetingStart.getTime() + 60 * 60000).toISOString(),
            is_all_day: false,
            category: 'meetings',
            attendees: 3,
          });
        }

        // Lunch break
        const lunchStart = new Date(current);
        lunchStart.setHours(12, 30, 0, 0);
        events.push({
          id: crypto.randomUUID(),
          title: 'Lunch',
          start: lunchStart.toISOString(),
          end: new Date(lunchStart.getTime() + 30 * 60000).toISOString(),
          is_all_day: false,
          category: 'rest',
        });
      }

      current.setDate(current.getDate() + 1);
    }

    return events;
  }
}

// Singleton instance
export const smartSchedulingService = new SmartSchedulingService();
