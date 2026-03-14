/**
 * ORACLE Mission Briefing Orchestrator
 * Comprehensive briefing system for mission-critical intelligence
 *
 * Features:
 * - Generate briefings on demand or scheduled
 * - Support different briefing types (morning, evening, weekly, emergency)
 * - Personalization based on user role and preferences
 */

import { oracleCacheService, cacheKey, hashObject } from '../cache';
import {
  briefingTemplatesService,
  BriefingTemplate,
  BriefingType,
  BriefingFormat,
  RenderedBriefing,
} from './briefingTemplates';
import { dailyBriefingService, DailyBriefingResult } from './dailyBriefing';
import { weeklyBriefingService, WeeklyBriefingResult } from './weeklyBriefing';
import { situationReportService, SitrepResult } from './situationReport';
import { executiveSummaryService, ExecutiveSummaryResult } from './executiveSummary';

// Re-export all services and types
export * from './briefingTemplates';
export * from './dailyBriefing';
export * from './weeklyBriefing';
export * from './situationReport';
export * from './executiveSummary';

// ============================================================================
// Types
// ============================================================================

export type UserRole = 'executive' | 'manager' | 'team_lead' | 'individual_contributor' | 'stakeholder';

export interface UserPreferences {
  preferred_briefing_time_morning?: string;
  preferred_briefing_time_evening?: string;
  preferred_format: BriefingFormat;
  verbosity_level: 'concise' | 'standard' | 'detailed';
  include_weather: boolean;
  include_traffic: boolean;
  include_quotes: boolean;
  notification_channel: 'push' | 'email' | 'slack' | 'none';
  timezone: string;
  role: UserRole;
  focus_areas?: string[];
  muted_categories?: string[];
}

export interface BriefingRequest {
  user_id: string;
  user_name: string;
  briefing_type: BriefingType;
  template_id?: string;
  format?: BriefingFormat;
  options?: Record<string, any>;
}

export interface ScheduledBriefing {
  id: string;
  user_id: string;
  briefing_type: BriefingType;
  template_id?: string;
  schedule: {
    time: string;
    days: number[];
    timezone: string;
  };
  enabled: boolean;
  last_generated?: string;
  next_scheduled?: string;
  delivery_channel: 'push' | 'email' | 'slack';
}

export interface BriefingHistory {
  id: string;
  user_id: string;
  briefing_type: BriefingType;
  generated_at: string;
  format: BriefingFormat;
  template_id?: string;
  delivery_status: 'generated' | 'delivered' | 'read' | 'failed';
  read_at?: string;
  feedback?: {
    rating?: number;
    helpful?: boolean;
    comments?: string;
  };
}

export type BriefingResult = DailyBriefingResult | WeeklyBriefingResult | SitrepResult | ExecutiveSummaryResult;

// ============================================================================
// Cache TTLs
// ============================================================================

const ORCHESTRATOR_CACHE_TTL = {
  preferences: 60 * 60 * 1000, // 1 hour
  schedules: 30 * 60 * 1000, // 30 minutes
  history: 5 * 60 * 1000, // 5 minutes
};

// ============================================================================
// Briefing Orchestrator Service
// ============================================================================

export class BriefingOrchestratorService {
  // In-memory stores (would use database in production)
  private userPreferences: Map<string, UserPreferences> = new Map();
  private scheduledBriefings: Map<string, ScheduledBriefing[]> = new Map();
  private briefingHistory: Map<string, BriefingHistory[]> = new Map();
  private activeSchedulers: Map<string, NodeJS.Timeout> = new Map();

  // ============================================================================
  // On-Demand Briefing Generation
  // ============================================================================

  /**
   * Generate a briefing on demand
   */
  async generateBriefing(request: BriefingRequest): Promise<BriefingResult> {
    const { user_id, user_name, briefing_type, template_id, format, options } = request;

    // Get user preferences for personalization
    const preferences = await this.getUserPreferences(user_id);

    // Generate the appropriate briefing type
    let result: BriefingResult;

    switch (briefing_type) {
      case 'morning':
        result = await dailyBriefingService.generateMorningBriefing(user_id, user_name, {
          template_id,
          format: format || preferences.preferred_format,
          include_weather: options?.include_weather ?? preferences.include_weather,
          include_traffic: options?.include_traffic ?? preferences.include_traffic,
        });
        break;

      case 'evening':
        result = await dailyBriefingService.generateEveningBriefing(user_id, user_name, {
          template_id,
          format: format || preferences.preferred_format,
        });
        break;

      case 'weekly':
        result = await weeklyBriefingService.generateWeeklyBriefing(user_id, user_name, {
          template_id,
          format: format || preferences.preferred_format,
          include_team_health: options?.include_team_health ?? this.shouldIncludeTeamHealth(preferences.role),
        });
        break;

      case 'sitrep':
        result = await situationReportService.generateSitrep(user_id, {
          template_id,
          format: format || preferences.preferred_format,
          include_all_resources: options?.include_all_resources,
          scope: options?.scope,
        });
        break;

      case 'emergency':
        if (!options?.trigger_event) {
          throw new Error('Emergency briefings require a trigger_event');
        }
        result = await situationReportService.generateEmergencySitrep(user_id, options.trigger_event);
        break;

      case 'executive':
        result = await executiveSummaryService.generateExecutiveSummary(user_id, {
          template_id,
          format: format || preferences.preferred_format,
          period_type: options?.period_type || 'weekly',
          include_stakeholders: options?.include_stakeholders ?? true,
          include_resources: options?.include_resources ?? true,
        });
        break;

      default:
        throw new Error(`Unknown briefing type: ${briefing_type}`);
    }

    // Record in history
    await this.recordBriefingGeneration(user_id, briefing_type, result, template_id);

    return result;
  }

  /**
   * Generate a quick briefing based on user role
   */
  async generateQuickBriefing(userId: string, userName: string): Promise<BriefingResult> {
    const preferences = await this.getUserPreferences(userId);
    const hour = new Date().getHours();

    // Determine appropriate briefing type based on time and role
    let briefingType: BriefingType;

    if (hour >= 5 && hour < 12) {
      briefingType = 'morning';
    } else if (hour >= 17 && hour < 22) {
      briefingType = 'evening';
    } else if (preferences.role === 'executive' || preferences.role === 'manager') {
      briefingType = 'executive';
    } else {
      briefingType = 'sitrep';
    }

    return this.generateBriefing({
      user_id: userId,
      user_name: userName,
      briefing_type: briefingType,
    });
  }

  // ============================================================================
  // Scheduled Briefings
  // ============================================================================

  /**
   * Schedule a recurring briefing
   */
  async scheduleBriefing(
    userId: string,
    config: {
      briefing_type: BriefingType;
      template_id?: string;
      time: string;
      days: number[];
      timezone: string;
      delivery_channel: 'push' | 'email' | 'slack';
    }
  ): Promise<ScheduledBriefing> {
    const scheduled: ScheduledBriefing = {
      id: crypto.randomUUID(),
      user_id: userId,
      briefing_type: config.briefing_type,
      template_id: config.template_id,
      schedule: {
        time: config.time,
        days: config.days,
        timezone: config.timezone,
      },
      enabled: true,
      delivery_channel: config.delivery_channel,
      next_scheduled: this.calculateNextScheduledTime(config.time, config.days, config.timezone),
    };

    // Store schedule
    const userSchedules = this.scheduledBriefings.get(userId) || [];
    userSchedules.push(scheduled);
    this.scheduledBriefings.set(userId, userSchedules);

    // Set up scheduler
    this.setupScheduler(scheduled);

    return scheduled;
  }

  /**
   * Update a scheduled briefing
   */
  async updateScheduledBriefing(
    userId: string,
    scheduleId: string,
    updates: Partial<Pick<ScheduledBriefing, 'schedule' | 'enabled' | 'template_id' | 'delivery_channel'>>
  ): Promise<ScheduledBriefing | null> {
    const userSchedules = this.scheduledBriefings.get(userId);
    if (!userSchedules) return null;

    const index = userSchedules.findIndex((s) => s.id === scheduleId);
    if (index === -1) return null;

    const updated = {
      ...userSchedules[index],
      ...updates,
    };

    if (updates.schedule) {
      updated.next_scheduled = this.calculateNextScheduledTime(
        updates.schedule.time || updated.schedule.time,
        updates.schedule.days || updated.schedule.days,
        updates.schedule.timezone || updated.schedule.timezone
      );
    }

    userSchedules[index] = updated;

    // Update scheduler
    this.clearScheduler(scheduleId);
    if (updated.enabled) {
      this.setupScheduler(updated);
    }

    return updated;
  }

  /**
   * Delete a scheduled briefing
   */
  async deleteScheduledBriefing(userId: string, scheduleId: string): Promise<boolean> {
    const userSchedules = this.scheduledBriefings.get(userId);
    if (!userSchedules) return false;

    const index = userSchedules.findIndex((s) => s.id === scheduleId);
    if (index === -1) return false;

    userSchedules.splice(index, 1);
    this.clearScheduler(scheduleId);

    return true;
  }

  /**
   * Get all scheduled briefings for a user
   */
  async getScheduledBriefings(userId: string): Promise<ScheduledBriefing[]> {
    return this.scheduledBriefings.get(userId) || [];
  }

  /**
   * Setup scheduler for a briefing
   */
  private setupScheduler(schedule: ScheduledBriefing): void {
    // In production, this would use a proper job scheduler like Bull or Agenda
    // For now, we'll use a simple interval check
    const checkInterval = setInterval(async () => {
      if (!schedule.enabled) return;

      const now = new Date();
      const nextScheduled = new Date(schedule.next_scheduled || '');

      if (now >= nextScheduled) {
        try {
          // Generate and deliver briefing
          await this.executeScheduledBriefing(schedule);

          // Update last generated and next scheduled
          schedule.last_generated = now.toISOString();
          schedule.next_scheduled = this.calculateNextScheduledTime(
            schedule.schedule.time,
            schedule.schedule.days,
            schedule.schedule.timezone
          );
        } catch (error) {
          console.error(`Failed to generate scheduled briefing ${schedule.id}:`, error);
        }
      }
    }, 60000); // Check every minute

    this.activeSchedulers.set(schedule.id, checkInterval);
  }

  /**
   * Clear a scheduler
   */
  private clearScheduler(scheduleId: string): void {
    const interval = this.activeSchedulers.get(scheduleId);
    if (interval) {
      clearInterval(interval);
      this.activeSchedulers.delete(scheduleId);
    }
  }

  /**
   * Execute a scheduled briefing
   */
  private async executeScheduledBriefing(schedule: ScheduledBriefing): Promise<void> {
    const preferences = await this.getUserPreferences(schedule.user_id);

    const result = await this.generateBriefing({
      user_id: schedule.user_id,
      user_name: 'User', // Would fetch from user service
      briefing_type: schedule.briefing_type,
      template_id: schedule.template_id,
    });

    // Deliver briefing
    await this.deliverBriefing(schedule.user_id, result, schedule.delivery_channel);
  }

  /**
   * Deliver a briefing through the specified channel
   */
  private async deliverBriefing(
    userId: string,
    result: BriefingResult,
    channel: 'push' | 'email' | 'slack'
  ): Promise<void> {
    // In production, this would integrate with notification services
    console.log(`Delivering briefing to ${userId} via ${channel}`);

    // Update delivery status in history
    const history = this.briefingHistory.get(userId);
    if (history && history.length > 0) {
      const latest = history[history.length - 1];
      latest.delivery_status = 'delivered';
    }
  }

  /**
   * Calculate next scheduled time
   */
  private calculateNextScheduledTime(time: string, days: number[], timezone: string): string {
    const [hours, minutes] = time.split(':').map(Number);
    const now = new Date();

    // Find the next matching day
    for (let i = 0; i < 8; i++) {
      const checkDate = new Date(now);
      checkDate.setDate(checkDate.getDate() + i);
      checkDate.setHours(hours, minutes, 0, 0);

      const dayOfWeek = checkDate.getDay();
      if (days.includes(dayOfWeek) && checkDate > now) {
        return checkDate.toISOString();
      }
    }

    // Fallback to next week
    const nextWeek = new Date(now);
    nextWeek.setDate(nextWeek.getDate() + 7);
    nextWeek.setHours(hours, minutes, 0, 0);
    return nextWeek.toISOString();
  }

  // ============================================================================
  // User Preferences
  // ============================================================================

  /**
   * Get user preferences with defaults
   */
  async getUserPreferences(userId: string): Promise<UserPreferences> {
    const cacheKeyStr = cacheKey('briefing_prefs', userId);
    const cached = oracleCacheService.get<UserPreferences>(cacheKeyStr);
    if (cached) return cached;

    let preferences = this.userPreferences.get(userId);

    if (!preferences) {
      // Return default preferences
      preferences = this.getDefaultPreferences();
    }

    oracleCacheService.set(cacheKeyStr, preferences, ORCHESTRATOR_CACHE_TTL.preferences);
    return preferences;
  }

  /**
   * Update user preferences
   */
  async updateUserPreferences(
    userId: string,
    updates: Partial<UserPreferences>
  ): Promise<UserPreferences> {
    const current = await this.getUserPreferences(userId);
    const updated = { ...current, ...updates };

    this.userPreferences.set(userId, updated);
    oracleCacheService.delete(cacheKey('briefing_prefs', userId));

    return updated;
  }

  /**
   * Get default preferences
   */
  private getDefaultPreferences(): UserPreferences {
    return {
      preferred_format: 'text',
      verbosity_level: 'standard',
      include_weather: true,
      include_traffic: true,
      include_quotes: true,
      notification_channel: 'push',
      timezone: 'America/New_York',
      role: 'individual_contributor',
    };
  }

  /**
   * Determine if team health should be included based on role
   */
  private shouldIncludeTeamHealth(role: UserRole): boolean {
    return role === 'executive' || role === 'manager' || role === 'team_lead';
  }

  // ============================================================================
  // Briefing History
  // ============================================================================

  /**
   * Record a briefing generation
   */
  private async recordBriefingGeneration(
    userId: string,
    briefingType: BriefingType,
    result: BriefingResult,
    templateId?: string
  ): Promise<void> {
    const historyEntry: BriefingHistory = {
      id: crypto.randomUUID(),
      user_id: userId,
      briefing_type: briefingType,
      generated_at: result.generated_at,
      format: result.briefing.format,
      template_id: templateId,
      delivery_status: 'generated',
    };

    const userHistory = this.briefingHistory.get(userId) || [];
    userHistory.push(historyEntry);

    // Keep last 100 entries
    if (userHistory.length > 100) {
      userHistory.shift();
    }

    this.briefingHistory.set(userId, userHistory);
  }

  /**
   * Get briefing history for a user
   */
  async getBriefingHistory(
    userId: string,
    options: {
      limit?: number;
      briefing_type?: BriefingType;
      from_date?: string;
      to_date?: string;
    } = {}
  ): Promise<BriefingHistory[]> {
    let history = this.briefingHistory.get(userId) || [];

    // Filter by type
    if (options.briefing_type) {
      history = history.filter((h) => h.briefing_type === options.briefing_type);
    }

    // Filter by date range
    if (options.from_date) {
      history = history.filter((h) => h.generated_at >= options.from_date!);
    }
    if (options.to_date) {
      history = history.filter((h) => h.generated_at <= options.to_date!);
    }

    // Sort by most recent first
    history.sort((a, b) => b.generated_at.localeCompare(a.generated_at));

    // Limit results
    if (options.limit) {
      history = history.slice(0, options.limit);
    }

    return history;
  }

  /**
   * Mark a briefing as read
   */
  async markBriefingAsRead(userId: string, briefingId: string): Promise<boolean> {
    const history = this.briefingHistory.get(userId);
    if (!history) return false;

    const entry = history.find((h) => h.id === briefingId);
    if (!entry) return false;

    entry.delivery_status = 'read';
    entry.read_at = new Date().toISOString();

    return true;
  }

  /**
   * Submit feedback for a briefing
   */
  async submitBriefingFeedback(
    userId: string,
    briefingId: string,
    feedback: { rating?: number; helpful?: boolean; comments?: string }
  ): Promise<boolean> {
    const history = this.briefingHistory.get(userId);
    if (!history) return false;

    const entry = history.find((h) => h.id === briefingId);
    if (!entry) return false;

    entry.feedback = feedback;

    return true;
  }

  // ============================================================================
  // Template Management
  // ============================================================================

  /**
   * Get available templates for a user
   */
  async getAvailableTemplates(userId: string): Promise<BriefingTemplate[]> {
    return briefingTemplatesService.listTemplates(userId);
  }

  /**
   * Get the default template for a briefing type
   */
  async getDefaultTemplate(userId: string, briefingType: BriefingType): Promise<BriefingTemplate | null> {
    return briefingTemplatesService.getDefaultTemplate(userId, briefingType);
  }

  /**
   * Create a custom template
   */
  async createTemplate(
    userId: string,
    params: Parameters<typeof briefingTemplatesService.createTemplate>[1]
  ): Promise<BriefingTemplate> {
    return briefingTemplatesService.createTemplate(userId, params);
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Get recommended briefing type based on context
   */
  async getRecommendedBriefingType(
    userId: string,
    context?: { has_urgent_issues?: boolean; is_start_of_week?: boolean }
  ): Promise<BriefingType> {
    const preferences = await this.getUserPreferences(userId);
    const hour = new Date().getHours();
    const dayOfWeek = new Date().getDay();

    // Emergency situations
    if (context?.has_urgent_issues) {
      return 'sitrep';
    }

    // Start of week for managers
    if (dayOfWeek === 1 && context?.is_start_of_week) {
      return 'weekly';
    }

    // Time-based defaults
    if (hour >= 5 && hour < 12) {
      return 'morning';
    } else if (hour >= 17 && hour < 22) {
      return 'evening';
    }

    // Role-based defaults
    if (preferences.role === 'executive') {
      return 'executive';
    }

    return 'sitrep';
  }

  /**
   * Invalidate all caches for a user
   */
  async invalidateUserCaches(userId: string): Promise<void> {
    oracleCacheService.deleteByPrefix(`briefing_prefs:${userId}`);
    await dailyBriefingService.invalidateCache(userId);
    await weeklyBriefingService.invalidateCache(userId);
    await situationReportService.invalidateCache(userId);
    await executiveSummaryService.invalidateCache(userId);
  }

  /**
   * Clean up schedulers on shutdown
   */
  async shutdown(): Promise<void> {
    for (const [id, interval] of this.activeSchedulers.entries()) {
      clearInterval(interval);
    }
    this.activeSchedulers.clear();
  }
}

// Singleton export
export const briefingOrchestratorService = new BriefingOrchestratorService();
