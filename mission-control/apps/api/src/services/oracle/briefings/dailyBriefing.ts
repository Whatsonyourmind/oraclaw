/**
 * ORACLE Daily Briefing Generator Service
 * Morning and evening briefing generation with personalization
 *
 * Features:
 * - Morning briefing: today's priorities, meetings, deadlines, risks
 * - Evening briefing: accomplishments, pending items, tomorrow prep
 * - Key metrics summary
 * - Weather/traffic context integration
 * - Personalized recommendations
 */

import { oracleCacheService, cacheKey, hashObject } from '../cache';
import {
  briefingTemplatesService,
  BriefingTemplate,
  BriefingFormat,
  TemplateSection,
  RenderedBriefing,
} from './briefingTemplates';

// ============================================================================
// Types
// ============================================================================

export type DailyBriefingType = 'morning' | 'evening';

export interface TaskItem {
  id: string;
  title: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  due_date?: string;
  due_time?: string;
  project?: string;
  estimated_duration?: number;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
  tags?: string[];
}

export interface MeetingItem {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  location?: string;
  attendees?: string[];
  is_recurring?: boolean;
  meeting_url?: string;
  preparation_notes?: string;
}

export interface DeadlineItem {
  id: string;
  title: string;
  due_date: string;
  project?: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  days_remaining: number;
  progress?: number;
}

export interface RiskItem {
  id: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  probability: number;
  impact: string;
  mitigation?: string;
  related_to?: string;
}

export interface AccomplishmentItem {
  id: string;
  title: string;
  completed_at: string;
  project?: string;
  impact?: 'high' | 'medium' | 'low';
}

export interface MetricsSummary {
  tasks_completed_today: number;
  tasks_total_today: number;
  focus_time_minutes: number;
  meetings_attended: number;
  meetings_total: number;
  productivity_score: number;
  goals_progress: number;
  streak_days?: number;
}

export interface WeatherContext {
  location: string;
  temperature: number;
  condition: string;
  icon?: string;
  high: number;
  low: number;
  precipitation_chance: number;
  recommendation?: string;
}

export interface TrafficContext {
  commute_time_normal: number;
  commute_time_current: number;
  delay_minutes: number;
  route_status: 'clear' | 'light' | 'moderate' | 'heavy';
  incidents?: string[];
  recommendation?: string;
}

export interface Recommendation {
  id: string;
  type: 'schedule' | 'priority' | 'health' | 'focus' | 'meeting' | 'general';
  title: string;
  description: string;
  action?: string;
  priority: 'high' | 'medium' | 'low';
  reasoning?: string;
}

export interface DailyBriefingData {
  type: DailyBriefingType;
  date: string;
  user_id: string;
  user_name: string;
  priorities?: TaskItem[];
  meetings?: MeetingItem[];
  deadlines?: DeadlineItem[];
  risks?: RiskItem[];
  accomplishments?: AccomplishmentItem[];
  pending_items?: TaskItem[];
  tomorrow_preview?: TaskItem[];
  metrics?: MetricsSummary;
  weather?: WeatherContext;
  traffic?: TrafficContext;
  recommendations?: Recommendation[];
}

export interface DailyBriefingResult {
  briefing: RenderedBriefing;
  raw_data: DailyBriefingData;
  generated_at: string;
  audio_script?: string;
  slides?: Array<{ title: string; bullets: string[] }>;
}

// ============================================================================
// Cache TTLs
// ============================================================================

const BRIEFING_CACHE_TTL = {
  morning: 30 * 60 * 1000, // 30 minutes
  evening: 30 * 60 * 1000, // 30 minutes
  weather: 60 * 60 * 1000, // 1 hour
  traffic: 15 * 60 * 1000, // 15 minutes
};

// ============================================================================
// Daily Briefing Service
// ============================================================================

export class DailyBriefingService {
  // Mock data stores (would connect to actual services in production)
  private taskStore: Map<string, TaskItem[]> = new Map();
  private meetingStore: Map<string, MeetingItem[]> = new Map();
  private metricsStore: Map<string, MetricsSummary> = new Map();

  /**
   * Generate a morning briefing
   */
  async generateMorningBriefing(
    userId: string,
    userName: string,
    options: {
      template_id?: string;
      format?: BriefingFormat;
      include_weather?: boolean;
      include_traffic?: boolean;
    } = {}
  ): Promise<DailyBriefingResult> {
    const cacheKeyStr = cacheKey('briefing_morning', userId, new Date().toDateString());
    const cached = oracleCacheService.get<DailyBriefingResult>(cacheKeyStr);
    if (cached) return cached;

    // Get template
    const template = options.template_id
      ? await briefingTemplatesService.getTemplate(options.template_id, userId)
      : await briefingTemplatesService.getDefaultTemplate(userId, 'morning');

    if (!template) {
      throw new Error('No morning briefing template found');
    }

    // Gather data
    const data = await this.gatherMorningData(userId, userName, {
      include_weather: options.include_weather ?? true,
      include_traffic: options.include_traffic ?? true,
    });

    // Generate briefing
    const briefing = this.renderBriefing(template, data, options.format || template.default_format);

    const result: DailyBriefingResult = {
      briefing,
      raw_data: data,
      generated_at: new Date().toISOString(),
    };

    // Generate audio script if requested
    if (options.format === 'audio_script' || template.output_formats.includes('audio_script')) {
      result.audio_script = this.generateAudioScript(briefing, template);
    }

    // Generate slides if requested
    if (options.format === 'slides' || template.output_formats.includes('slides')) {
      result.slides = briefingTemplatesService.formatForSlides(briefing.sections, template.slide_settings);
    }

    oracleCacheService.set(cacheKeyStr, result, BRIEFING_CACHE_TTL.morning);
    return result;
  }

  /**
   * Generate an evening briefing
   */
  async generateEveningBriefing(
    userId: string,
    userName: string,
    options: {
      template_id?: string;
      format?: BriefingFormat;
    } = {}
  ): Promise<DailyBriefingResult> {
    const cacheKeyStr = cacheKey('briefing_evening', userId, new Date().toDateString());
    const cached = oracleCacheService.get<DailyBriefingResult>(cacheKeyStr);
    if (cached) return cached;

    // Get template
    const template = options.template_id
      ? await briefingTemplatesService.getTemplate(options.template_id, userId)
      : await briefingTemplatesService.getDefaultTemplate(userId, 'evening');

    if (!template) {
      throw new Error('No evening briefing template found');
    }

    // Gather data
    const data = await this.gatherEveningData(userId, userName);

    // Generate briefing
    const briefing = this.renderBriefing(template, data, options.format || template.default_format);

    const result: DailyBriefingResult = {
      briefing,
      raw_data: data,
      generated_at: new Date().toISOString(),
    };

    if (options.format === 'audio_script') {
      result.audio_script = this.generateAudioScript(briefing, template);
    }

    oracleCacheService.set(cacheKeyStr, result, BRIEFING_CACHE_TTL.evening);
    return result;
  }

  /**
   * Gather data for morning briefing
   */
  private async gatherMorningData(
    userId: string,
    userName: string,
    options: { include_weather?: boolean; include_traffic?: boolean }
  ): Promise<DailyBriefingData> {
    const today = new Date().toISOString().split('T')[0];

    // Get priorities (high/critical tasks due today or overdue)
    const priorities = await this.getTodaysPriorities(userId);

    // Get meetings
    const meetings = await this.getTodaysMeetings(userId);

    // Get approaching deadlines
    const deadlines = await this.getApproachingDeadlines(userId);

    // Get risks
    const risks = await this.getActiveRisks(userId);

    // Get metrics
    const metrics = await this.getMetricsSummary(userId);

    // Get weather and traffic if requested
    let weather: WeatherContext | undefined;
    let traffic: TrafficContext | undefined;

    if (options.include_weather) {
      weather = await this.getWeatherContext(userId);
    }

    if (options.include_traffic) {
      traffic = await this.getTrafficContext(userId);
    }

    // Generate recommendations
    const recommendations = this.generateMorningRecommendations(priorities, meetings, deadlines, risks, weather, traffic);

    return {
      type: 'morning',
      date: today,
      user_id: userId,
      user_name: userName,
      priorities,
      meetings,
      deadlines,
      risks,
      metrics,
      weather,
      traffic,
      recommendations,
    };
  }

  /**
   * Gather data for evening briefing
   */
  private async gatherEveningData(userId: string, userName: string): Promise<DailyBriefingData> {
    const today = new Date().toISOString().split('T')[0];

    // Get accomplishments
    const accomplishments = await this.getTodaysAccomplishments(userId);

    // Get pending items
    const pendingItems = await this.getPendingItems(userId);

    // Get tomorrow's preview
    const tomorrowPreview = await this.getTomorrowPreview(userId);

    // Get metrics
    const metrics = await this.getMetricsSummary(userId);

    // Generate recommendations for tomorrow
    const recommendations = this.generateEveningRecommendations(accomplishments, pendingItems, tomorrowPreview, metrics);

    return {
      type: 'evening',
      date: today,
      user_id: userId,
      user_name: userName,
      accomplishments,
      pending_items: pendingItems,
      tomorrow_preview: tomorrowPreview,
      metrics,
      recommendations,
    };
  }

  /**
   * Render briefing from template and data
   */
  private renderBriefing(
    template: BriefingTemplate,
    data: DailyBriefingData,
    format: BriefingFormat
  ): RenderedBriefing {
    const sections: TemplateSection[] = [];
    const enabledSections = briefingTemplatesService.getEnabledSections(template);

    for (const sectionConfig of enabledSections) {
      const section = this.renderSection(sectionConfig.type, data, sectionConfig, template);
      if (section) {
        sections.push(section);
      }
    }

    const greeting = briefingTemplatesService.generateGreeting(template, data.user_name);
    const signOff = briefingTemplatesService.generateSignOff(template);
    const quote = briefingTemplatesService.generateQuote(template);

    return {
      template_id: template.id,
      briefing_type: template.briefing_type,
      format,
      title: `${template.briefing_type.charAt(0).toUpperCase() + template.briefing_type.slice(1)} Briefing - ${new Date().toLocaleDateString()}`,
      greeting,
      sections,
      sign_off: signOff,
      quote,
      generated_at: new Date().toISOString(),
      metadata: {
        user_id: data.user_id,
        template_name: template.name,
        tone: template.tone,
        verbosity: template.verbosity,
      },
    };
  }

  /**
   * Render a single section
   */
  private renderSection(
    type: string,
    data: DailyBriefingData,
    config: any,
    template: BriefingTemplate
  ): TemplateSection | null {
    switch (type) {
      case 'priorities':
        if (!data.priorities?.length) return null;
        return {
          type: 'priorities',
          content: data.priorities.slice(0, config.max_items || 5).map(
            (p) => `[${p.priority.toUpperCase()}] ${p.title}${p.due_time ? ` (due ${p.due_time})` : ''}`
          ),
          data: data.priorities.slice(0, config.max_items || 5),
          metadata: { count: data.priorities.length, priority: 'high' },
        };

      case 'meetings':
        if (!data.meetings?.length) return null;
        return {
          type: 'meetings',
          content: data.meetings.slice(0, config.max_items || 10).map(
            (m) => `${this.formatTime(m.start_time)} - ${m.title}${m.location ? ` @ ${m.location}` : ''}`
          ),
          data: data.meetings.slice(0, config.max_items || 10),
          metadata: { count: data.meetings.length },
        };

      case 'deadlines':
        if (!data.deadlines?.length) return null;
        return {
          type: 'deadlines',
          content: data.deadlines.slice(0, config.max_items || 5).map(
            (d) => `${d.title} - ${d.days_remaining === 0 ? 'TODAY' : `${d.days_remaining} days`}`
          ),
          data: data.deadlines.slice(0, config.max_items || 5),
          metadata: { count: data.deadlines.length },
        };

      case 'risks':
        if (!data.risks?.length) return null;
        return {
          type: 'risks',
          content: data.risks.slice(0, config.max_items || 3).map(
            (r) => `[${r.severity.toUpperCase()}] ${r.title}`
          ),
          data: data.risks.slice(0, config.max_items || 3),
          metadata: { count: data.risks.length },
        };

      case 'accomplishments':
        if (!data.accomplishments?.length) return null;
        return {
          type: 'accomplishments',
          content: data.accomplishments.slice(0, config.max_items || 10).map(
            (a) => `${a.title}${a.project ? ` (${a.project})` : ''}`
          ),
          data: data.accomplishments.slice(0, config.max_items || 10),
          metadata: { count: data.accomplishments.length },
        };

      case 'pending':
        if (!data.pending_items?.length) return null;
        return {
          type: 'pending',
          content: data.pending_items.slice(0, config.max_items || 5).map(
            (p) => `${p.title}${p.status === 'blocked' ? ' [BLOCKED]' : ''}`
          ),
          data: data.pending_items.slice(0, config.max_items || 5),
          metadata: { count: data.pending_items.length },
        };

      case 'metrics':
        if (!data.metrics) return null;
        const m = data.metrics;
        return {
          type: 'metrics',
          content: [
            `Tasks: ${m.tasks_completed_today}/${m.tasks_total_today} completed`,
            `Focus Time: ${Math.round(m.focus_time_minutes / 60)}h ${m.focus_time_minutes % 60}m`,
            `Meetings: ${m.meetings_attended}/${m.meetings_total}`,
            `Productivity Score: ${Math.round(m.productivity_score * 100)}%`,
            m.streak_days ? `Streak: ${m.streak_days} days` : null,
          ].filter(Boolean) as string[],
          data: data.metrics,
        };

      case 'weather':
        if (!data.weather) return null;
        const w = data.weather;
        return {
          type: 'weather',
          content: `${w.location}: ${w.condition}, ${w.temperature}F (High: ${w.high}F, Low: ${w.low}F). ${w.recommendation || ''}`,
          data: data.weather,
        };

      case 'traffic':
        if (!data.traffic) return null;
        const t = data.traffic;
        const status = t.delay_minutes > 0 ? ` (+${t.delay_minutes}min delay)` : '';
        return {
          type: 'traffic',
          content: `Commute: ${t.commute_time_current}min${status}. Traffic is ${t.route_status}. ${t.recommendation || ''}`,
          data: data.traffic,
        };

      case 'recommendations':
        if (!data.recommendations?.length) return null;
        return {
          type: 'recommendations',
          content: data.recommendations.slice(0, config.max_items || 3).map(
            (r) => `${r.title}: ${r.description}`
          ),
          data: data.recommendations.slice(0, config.max_items || 3),
          metadata: { count: data.recommendations.length },
        };

      default:
        return null;
    }
  }

  /**
   * Generate audio script
   */
  private generateAudioScript(briefing: RenderedBriefing, template: BriefingTemplate): string {
    let script = '';

    if (briefing.greeting) {
      script += briefing.greeting + '\n\n';
    }

    script += `Here is your ${briefing.briefing_type} briefing for ${new Date().toLocaleDateString()}.\n\n`;

    for (const section of briefing.sections) {
      script += `${section.type.replace(/_/g, ' ').toUpperCase()}:\n`;
      if (Array.isArray(section.content)) {
        section.content.forEach((item, idx) => {
          script += `${idx + 1}. ${item}\n`;
        });
      } else {
        script += section.content + '\n';
      }
      script += '\n';
    }

    if (briefing.sign_off) {
      script += briefing.sign_off + '\n';
    }

    if (briefing.quote) {
      script += `\n${briefing.quote}\n`;
    }

    return briefingTemplatesService.formatForAudio(script, template.audio_settings);
  }

  /**
   * Generate morning recommendations
   */
  private generateMorningRecommendations(
    priorities: TaskItem[],
    meetings: MeetingItem[],
    deadlines: DeadlineItem[],
    risks: RiskItem[],
    weather?: WeatherContext,
    traffic?: TrafficContext
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];

    // Check for meeting conflicts with deep work
    if (meetings.length >= 4) {
      recommendations.push({
        id: crypto.randomUUID(),
        type: 'schedule',
        title: 'Heavy Meeting Day',
        description: 'Consider blocking focus time between meetings for deep work.',
        priority: 'medium',
        reasoning: `You have ${meetings.length} meetings scheduled today.`,
      });
    }

    // Check for critical deadlines
    const criticalDeadlines = deadlines.filter((d) => d.days_remaining <= 1 && d.priority === 'critical');
    if (criticalDeadlines.length > 0) {
      recommendations.push({
        id: crypto.randomUUID(),
        type: 'priority',
        title: 'Critical Deadlines Today',
        description: `Focus on ${criticalDeadlines[0].title} first - it's due ${criticalDeadlines[0].days_remaining === 0 ? 'today' : 'tomorrow'}.`,
        priority: 'high',
        action: 'Review and prioritize critical tasks',
      });
    }

    // Weather-based recommendations
    if (weather && weather.precipitation_chance > 50) {
      recommendations.push({
        id: crypto.randomUUID(),
        type: 'general',
        title: 'Weather Alert',
        description: `${weather.precipitation_chance}% chance of precipitation. Plan accordingly.`,
        priority: 'low',
      });
    }

    // Traffic-based recommendations
    if (traffic && traffic.delay_minutes > 15) {
      recommendations.push({
        id: crypto.randomUUID(),
        type: 'schedule',
        title: 'Traffic Delay',
        description: `Consider leaving ${traffic.delay_minutes} minutes earlier or starting remotely.`,
        priority: 'medium',
        reasoning: `Current commute time is ${traffic.commute_time_current} minutes vs normal ${traffic.commute_time_normal} minutes.`,
      });
    }

    // High risk items
    const highRisks = risks.filter((r) => r.severity === 'critical' || r.severity === 'high');
    if (highRisks.length > 0) {
      recommendations.push({
        id: crypto.randomUUID(),
        type: 'priority',
        title: 'Monitor Risks',
        description: `Keep an eye on: ${highRisks[0].title}`,
        priority: 'high',
        reasoning: highRisks[0].impact,
      });
    }

    // Start day with high-energy task
    const highPriorityTasks = priorities.filter((p) => p.priority === 'high' || p.priority === 'critical');
    if (highPriorityTasks.length > 0 && meetings.length > 0) {
      const firstMeeting = meetings[0];
      const meetingTime = new Date(firstMeeting.start_time).getHours();
      if (meetingTime >= 10) {
        recommendations.push({
          id: crypto.randomUUID(),
          type: 'focus',
          title: 'Morning Deep Work',
          description: `You have time before your first meeting at ${this.formatTime(firstMeeting.start_time)}. Start with "${highPriorityTasks[0].title}".`,
          priority: 'medium',
        });
      }
    }

    return recommendations;
  }

  /**
   * Generate evening recommendations
   */
  private generateEveningRecommendations(
    accomplishments: AccomplishmentItem[],
    pendingItems: TaskItem[],
    tomorrowPreview: TaskItem[],
    metrics?: MetricsSummary
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];

    // Celebrate accomplishments
    if (accomplishments.length >= 5) {
      recommendations.push({
        id: crypto.randomUUID(),
        type: 'general',
        title: 'Great Progress Today',
        description: `You completed ${accomplishments.length} items. Well done!`,
        priority: 'low',
      });
    }

    // Blocked items warning
    const blockedItems = pendingItems.filter((p) => p.status === 'blocked');
    if (blockedItems.length > 0) {
      recommendations.push({
        id: crypto.randomUUID(),
        type: 'priority',
        title: 'Blocked Items',
        description: `${blockedItems.length} item(s) are blocked. Consider reaching out to unblock them tomorrow.`,
        priority: 'medium',
        action: 'Review blockers and plan outreach',
      });
    }

    // Tomorrow preparation
    const criticalTomorrow = tomorrowPreview.filter((t) => t.priority === 'critical');
    if (criticalTomorrow.length > 0) {
      recommendations.push({
        id: crypto.randomUUID(),
        type: 'priority',
        title: 'Tomorrow Critical',
        description: `"${criticalTomorrow[0].title}" is critical for tomorrow. Consider preparing tonight.`,
        priority: 'high',
      });
    }

    // Productivity feedback
    if (metrics) {
      if (metrics.productivity_score < 0.5) {
        recommendations.push({
          id: crypto.randomUUID(),
          type: 'health',
          title: 'Rest & Recharge',
          description: 'Consider winding down early tonight for a fresh start tomorrow.',
          priority: 'low',
        });
      } else if (metrics.productivity_score > 0.8) {
        recommendations.push({
          id: crypto.randomUUID(),
          type: 'health',
          title: 'Excellent Day',
          description: 'Great productivity! Make sure to take time to rest and maintain momentum.',
          priority: 'low',
        });
      }

      if (metrics.focus_time_minutes < 60) {
        recommendations.push({
          id: crypto.randomUUID(),
          type: 'focus',
          title: 'Increase Focus Time',
          description: 'Plan dedicated focus blocks for tomorrow to improve deep work.',
          priority: 'medium',
        });
      }
    }

    return recommendations;
  }

  // ============================================================================
  // Data Fetching Methods (Mock implementations)
  // ============================================================================

  private async getTodaysPriorities(userId: string): Promise<TaskItem[]> {
    // Mock implementation - would fetch from task service
    return [
      {
        id: '1',
        title: 'Complete Q4 report draft',
        priority: 'critical',
        due_date: new Date().toISOString().split('T')[0],
        due_time: '17:00',
        project: 'Q4 Planning',
        estimated_duration: 120,
        status: 'in_progress',
      },
      {
        id: '2',
        title: 'Review team proposals',
        priority: 'high',
        due_date: new Date().toISOString().split('T')[0],
        project: 'Team Management',
        estimated_duration: 60,
        status: 'pending',
      },
      {
        id: '3',
        title: 'Update project timeline',
        priority: 'medium',
        project: 'Project Alpha',
        status: 'pending',
      },
    ];
  }

  private async getTodaysMeetings(userId: string): Promise<MeetingItem[]> {
    const today = new Date();
    return [
      {
        id: 'm1',
        title: 'Daily Standup',
        start_time: new Date(today.setHours(9, 0, 0, 0)).toISOString(),
        end_time: new Date(today.setHours(9, 15, 0, 0)).toISOString(),
        attendees: ['Team'],
        is_recurring: true,
      },
      {
        id: 'm2',
        title: 'Project Review',
        start_time: new Date(today.setHours(14, 0, 0, 0)).toISOString(),
        end_time: new Date(today.setHours(15, 0, 0, 0)).toISOString(),
        location: 'Conference Room A',
        attendees: ['Stakeholders'],
        preparation_notes: 'Bring updated metrics',
      },
    ];
  }

  private async getApproachingDeadlines(userId: string): Promise<DeadlineItem[]> {
    return [
      {
        id: 'd1',
        title: 'Q4 Report Submission',
        due_date: new Date().toISOString().split('T')[0],
        project: 'Q4 Planning',
        priority: 'critical',
        days_remaining: 0,
        progress: 75,
      },
      {
        id: 'd2',
        title: 'Budget Approval',
        due_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        project: 'Finance',
        priority: 'high',
        days_remaining: 2,
        progress: 50,
      },
    ];
  }

  private async getActiveRisks(userId: string): Promise<RiskItem[]> {
    return [
      {
        id: 'r1',
        title: 'Resource availability for next sprint',
        severity: 'high',
        probability: 0.6,
        impact: 'May delay project timeline by 1-2 weeks',
        mitigation: 'Cross-train team members',
        related_to: 'Project Alpha',
      },
    ];
  }

  private async getTodaysAccomplishments(userId: string): Promise<AccomplishmentItem[]> {
    return [
      {
        id: 'a1',
        title: 'Completed sprint planning',
        completed_at: new Date().toISOString(),
        project: 'Project Alpha',
        impact: 'high',
      },
      {
        id: 'a2',
        title: 'Resolved 5 support tickets',
        completed_at: new Date().toISOString(),
        impact: 'medium',
      },
      {
        id: 'a3',
        title: 'Updated documentation',
        completed_at: new Date().toISOString(),
        project: 'Infrastructure',
        impact: 'low',
      },
    ];
  }

  private async getPendingItems(userId: string): Promise<TaskItem[]> {
    return [
      {
        id: 'p1',
        title: 'Finalize budget spreadsheet',
        priority: 'high',
        status: 'in_progress',
        project: 'Finance',
      },
      {
        id: 'p2',
        title: 'Code review for feature X',
        priority: 'medium',
        status: 'blocked',
        tags: ['waiting on: dev team'],
      },
    ];
  }

  private async getTomorrowPreview(userId: string): Promise<TaskItem[]> {
    return [
      {
        id: 't1',
        title: 'Client presentation',
        priority: 'critical',
        due_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        due_time: '10:00',
        project: 'Sales',
        status: 'pending',
      },
      {
        id: 't2',
        title: 'Team 1:1 meetings',
        priority: 'high',
        due_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'pending',
      },
    ];
  }

  private async getMetricsSummary(userId: string): Promise<MetricsSummary> {
    return {
      tasks_completed_today: 8,
      tasks_total_today: 12,
      focus_time_minutes: 180,
      meetings_attended: 3,
      meetings_total: 4,
      productivity_score: 0.72,
      goals_progress: 0.65,
      streak_days: 5,
    };
  }

  private async getWeatherContext(userId: string): Promise<WeatherContext> {
    // Mock implementation - would fetch from weather API
    return {
      location: 'New York, NY',
      temperature: 65,
      condition: 'Partly Cloudy',
      high: 72,
      low: 58,
      precipitation_chance: 20,
      recommendation: 'Great day for outdoor lunch!',
    };
  }

  private async getTrafficContext(userId: string): Promise<TrafficContext> {
    // Mock implementation - would fetch from traffic API
    return {
      commute_time_normal: 25,
      commute_time_current: 32,
      delay_minutes: 7,
      route_status: 'light',
      incidents: ['Minor delay on I-95 North'],
    };
  }

  /**
   * Helper to format time
   */
  private formatTime(isoString: string): string {
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }

  /**
   * Invalidate briefing cache for user
   */
  async invalidateCache(userId: string, type?: DailyBriefingType): Promise<void> {
    const today = new Date().toDateString();
    if (type) {
      oracleCacheService.delete(cacheKey(`briefing_${type}`, userId, today));
    } else {
      oracleCacheService.delete(cacheKey('briefing_morning', userId, today));
      oracleCacheService.delete(cacheKey('briefing_evening', userId, today));
    }
  }
}

// Singleton export
export const dailyBriefingService = new DailyBriefingService();
