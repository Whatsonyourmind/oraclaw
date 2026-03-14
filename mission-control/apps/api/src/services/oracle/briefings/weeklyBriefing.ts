/**
 * ORACLE Weekly Briefing Generator Service
 * Comprehensive weekly reviews and upcoming week planning
 *
 * Features:
 * - Week-in-review: completed vs planned
 * - Upcoming week preview
 * - Trend analysis (productivity, focus areas)
 * - Goal progress tracking
 * - Team/project health scores
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

export interface WeeklyStats {
  tasks_planned: number;
  tasks_completed: number;
  tasks_added_mid_week: number;
  tasks_rolled_over: number;
  completion_rate: number;
  focus_time_hours: number;
  meeting_hours: number;
  decisions_made: number;
  goals_achieved: number;
}

export interface ProductivityTrend {
  metric: string;
  current_week: number;
  previous_week: number;
  change_percent: number;
  trend: 'up' | 'down' | 'stable';
  insight?: string;
}

export interface FocusAreaAnalysis {
  area: string;
  time_spent_hours: number;
  percentage_of_total: number;
  tasks_completed: number;
  effectiveness_score: number;
  trend: 'up' | 'down' | 'stable';
}

export interface GoalProgress {
  id: string;
  title: string;
  target: number;
  current: number;
  progress_percent: number;
  due_date?: string;
  status: 'on_track' | 'at_risk' | 'behind' | 'completed' | 'exceeded';
  milestones_completed: number;
  milestones_total: number;
  notes?: string;
}

export interface ProjectHealth {
  id: string;
  name: string;
  health_score: number; // 0-100
  status: 'healthy' | 'attention' | 'critical';
  metrics: {
    tasks_completed: number;
    tasks_remaining: number;
    blockers: number;
    team_velocity: number;
    budget_used_percent?: number;
    timeline_status: 'on_track' | 'delayed' | 'ahead';
  };
  risks: string[];
  highlights: string[];
}

export interface TeamHealth {
  id: string;
  name: string;
  health_score: number;
  members_count: number;
  metrics: {
    productivity_index: number;
    collaboration_score: number;
    workload_balance: number;
    response_time_avg_hours: number;
  };
  concerns?: string[];
  achievements?: string[];
}

export interface WeeklyAccomplishment {
  id: string;
  title: string;
  date: string;
  category: string;
  impact: 'high' | 'medium' | 'low';
  project?: string;
  stakeholders?: string[];
}

export interface UpcomingWeekItem {
  id: string;
  title: string;
  date: string;
  type: 'task' | 'meeting' | 'deadline' | 'milestone' | 'event';
  priority: 'critical' | 'high' | 'medium' | 'low';
  project?: string;
  notes?: string;
}

export interface WeeklyRecommendation {
  id: string;
  type: 'productivity' | 'focus' | 'balance' | 'goal' | 'project' | 'team' | 'strategic';
  title: string;
  description: string;
  action_items?: string[];
  priority: 'high' | 'medium' | 'low';
  data_driven: boolean;
  supporting_data?: string;
}

export interface WeeklyBriefingData {
  user_id: string;
  user_name: string;
  week_start: string;
  week_end: string;
  stats: WeeklyStats;
  accomplishments: WeeklyAccomplishment[];
  productivity_trends: ProductivityTrend[];
  focus_areas: FocusAreaAnalysis[];
  goal_progress: GoalProgress[];
  project_health: ProjectHealth[];
  team_health?: TeamHealth[];
  upcoming_week: UpcomingWeekItem[];
  recommendations: WeeklyRecommendation[];
}

export interface WeeklyBriefingResult {
  briefing: RenderedBriefing;
  raw_data: WeeklyBriefingData;
  generated_at: string;
  audio_script?: string;
  slides?: Array<{ title: string; bullets: string[]; hasChart?: boolean }>;
  charts_data?: {
    productivity_chart: any;
    focus_distribution: any;
    goal_progress_chart: any;
  };
}

// ============================================================================
// Cache TTLs
// ============================================================================

const WEEKLY_CACHE_TTL = {
  briefing: 4 * 60 * 60 * 1000, // 4 hours
  trends: 60 * 60 * 1000, // 1 hour
  health: 30 * 60 * 1000, // 30 minutes
};

// ============================================================================
// Weekly Briefing Service
// ============================================================================

export class WeeklyBriefingService {
  /**
   * Generate a weekly briefing
   */
  async generateWeeklyBriefing(
    userId: string,
    userName: string,
    options: {
      template_id?: string;
      format?: BriefingFormat;
      week_start?: string;
      include_team_health?: boolean;
    } = {}
  ): Promise<WeeklyBriefingResult> {
    const weekStart = options.week_start || this.getWeekStart();
    const cacheKeyStr = cacheKey('briefing_weekly', userId, weekStart);

    const cached = oracleCacheService.get<WeeklyBriefingResult>(cacheKeyStr);
    if (cached) return cached;

    // Get template
    const template = options.template_id
      ? await briefingTemplatesService.getTemplate(options.template_id, userId)
      : await briefingTemplatesService.getDefaultTemplate(userId, 'weekly');

    if (!template) {
      throw new Error('No weekly briefing template found');
    }

    // Gather data
    const data = await this.gatherWeeklyData(userId, userName, {
      week_start: weekStart,
      include_team_health: options.include_team_health ?? false,
    });

    // Generate briefing
    const briefing = this.renderBriefing(template, data, options.format || template.default_format);

    const result: WeeklyBriefingResult = {
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
      result.slides = this.generateSlides(briefing, data, template);
    }

    // Generate chart data for visualizations
    result.charts_data = this.generateChartsData(data);

    oracleCacheService.set(cacheKeyStr, result, WEEKLY_CACHE_TTL.briefing);
    return result;
  }

  /**
   * Gather all weekly data
   */
  private async gatherWeeklyData(
    userId: string,
    userName: string,
    options: { week_start: string; include_team_health: boolean }
  ): Promise<WeeklyBriefingData> {
    const weekStart = new Date(options.week_start);
    const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);

    // Gather all data in parallel
    const [
      stats,
      accomplishments,
      productivityTrends,
      focusAreas,
      goalProgress,
      projectHealth,
      teamHealth,
      upcomingWeek,
    ] = await Promise.all([
      this.getWeeklyStats(userId, options.week_start),
      this.getWeeklyAccomplishments(userId, options.week_start),
      this.getProductivityTrends(userId),
      this.getFocusAreaAnalysis(userId, options.week_start),
      this.getGoalProgress(userId),
      this.getProjectHealth(userId),
      options.include_team_health ? this.getTeamHealth(userId) : Promise.resolve(undefined),
      this.getUpcomingWeek(userId),
    ]);

    // Generate recommendations based on data
    const recommendations = this.generateRecommendations(
      stats,
      productivityTrends,
      focusAreas,
      goalProgress,
      projectHealth,
      teamHealth
    );

    return {
      user_id: userId,
      user_name: userName,
      week_start: weekStart.toISOString().split('T')[0],
      week_end: weekEnd.toISOString().split('T')[0],
      stats,
      accomplishments,
      productivity_trends: productivityTrends,
      focus_areas: focusAreas,
      goal_progress: goalProgress,
      project_health: projectHealth,
      team_health: teamHealth,
      upcoming_week: upcomingWeek,
      recommendations,
    };
  }

  /**
   * Render briefing from template and data
   */
  private renderBriefing(
    template: BriefingTemplate,
    data: WeeklyBriefingData,
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
      briefing_type: 'weekly',
      format,
      title: `Weekly Briefing - Week of ${new Date(data.week_start).toLocaleDateString()}`,
      greeting,
      sections,
      sign_off: signOff,
      quote,
      generated_at: new Date().toISOString(),
      metadata: {
        user_id: data.user_id,
        week_start: data.week_start,
        week_end: data.week_end,
      },
    };
  }

  /**
   * Render a single section
   */
  private renderSection(
    type: string,
    data: WeeklyBriefingData,
    config: any,
    template: BriefingTemplate
  ): TemplateSection | null {
    switch (type) {
      case 'accomplishments':
        if (!data.accomplishments?.length) return null;
        return {
          type: 'accomplishments',
          content: data.accomplishments.slice(0, config.max_items || 15).map(
            (a) => `[${a.impact.toUpperCase()}] ${a.title}${a.project ? ` (${a.project})` : ''}`
          ),
          data: data.accomplishments,
          metadata: {
            count: data.accomplishments.length,
            timestamp: data.week_start,
          },
        };

      case 'goals':
        if (!data.goal_progress?.length) return null;
        return {
          type: 'goals',
          content: data.goal_progress.map((g) => {
            const statusEmoji = this.getGoalStatusIndicator(g.status);
            return `${statusEmoji} ${g.title}: ${g.progress_percent}% (${g.status.replace('_', ' ')})`;
          }),
          data: data.goal_progress,
          metadata: { count: data.goal_progress.length },
        };

      case 'trends':
        if (!data.productivity_trends?.length) return null;
        return {
          type: 'trends',
          content: data.productivity_trends.map((t) => {
            const arrow = t.trend === 'up' ? 'UP' : t.trend === 'down' ? 'DOWN' : '-';
            return `${t.metric}: ${t.current_week} (${arrow} ${Math.abs(t.change_percent).toFixed(1)}%)`;
          }),
          data: data.productivity_trends,
        };

      case 'health_scores':
        if (!data.project_health?.length) return null;
        return {
          type: 'health_scores',
          content: data.project_health.map((p) => {
            const status = this.getHealthIndicator(p.health_score);
            return `${status} ${p.name}: ${p.health_score}/100 - ${p.status}`;
          }),
          data: data.project_health,
          metadata: { count: data.project_health.length },
        };

      case 'priorities':
        // Upcoming week preview
        if (!data.upcoming_week?.length) return null;
        const critical = data.upcoming_week.filter((u) => u.priority === 'critical' || u.priority === 'high');
        return {
          type: 'priorities',
          content: critical.slice(0, config.max_items || 10).map(
            (u) => `[${u.type.toUpperCase()}] ${u.title} - ${new Date(u.date).toLocaleDateString()}`
          ),
          data: critical,
          metadata: { count: data.upcoming_week.length },
        };

      case 'recommendations':
        if (!data.recommendations?.length) return null;
        return {
          type: 'recommendations',
          content: data.recommendations.slice(0, config.max_items || 5).map(
            (r) => `[${r.type.toUpperCase()}] ${r.title}: ${r.description}`
          ),
          data: data.recommendations,
          metadata: { count: data.recommendations.length },
        };

      case 'metrics':
        return {
          type: 'metrics',
          content: [
            `Tasks: ${data.stats.tasks_completed}/${data.stats.tasks_planned} completed (${(data.stats.completion_rate * 100).toFixed(0)}%)`,
            `Focus Time: ${data.stats.focus_time_hours.toFixed(1)} hours`,
            `Meeting Time: ${data.stats.meeting_hours.toFixed(1)} hours`,
            `Decisions Made: ${data.stats.decisions_made}`,
            `Goals Achieved: ${data.stats.goals_achieved}`,
            data.stats.tasks_rolled_over > 0 ? `Rolled Over: ${data.stats.tasks_rolled_over} tasks` : null,
          ].filter(Boolean) as string[],
          data: data.stats,
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

    script += `Here is your weekly briefing for the week of ${briefing.title.split(' - ')[1]}.\n\n`;

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
   * Generate slides with charts
   */
  private generateSlides(
    briefing: RenderedBriefing,
    data: WeeklyBriefingData,
    template: BriefingTemplate
  ): Array<{ title: string; bullets: string[]; hasChart?: boolean }> {
    const slides: Array<{ title: string; bullets: string[]; hasChart?: boolean }> = [];

    // Title slide
    slides.push({
      title: `Weekly Briefing - ${data.user_name}`,
      bullets: [
        `Week of ${new Date(data.week_start).toLocaleDateString()}`,
        `Completion Rate: ${(data.stats.completion_rate * 100).toFixed(0)}%`,
        `${data.stats.tasks_completed} tasks completed`,
      ],
    });

    // Stats overview
    slides.push({
      title: 'Week at a Glance',
      bullets: [
        `Tasks: ${data.stats.tasks_completed}/${data.stats.tasks_planned}`,
        `Focus Time: ${data.stats.focus_time_hours.toFixed(1)}h`,
        `Meetings: ${data.stats.meeting_hours.toFixed(1)}h`,
        `Decisions: ${data.stats.decisions_made}`,
      ],
      hasChart: true,
    });

    // Goal Progress
    if (data.goal_progress.length > 0) {
      slides.push({
        title: 'Goal Progress',
        bullets: data.goal_progress.slice(0, 5).map(
          (g) => `${g.title}: ${g.progress_percent}%`
        ),
        hasChart: true,
      });
    }

    // Project Health
    if (data.project_health.length > 0) {
      slides.push({
        title: 'Project Health',
        bullets: data.project_health.slice(0, 5).map(
          (p) => `${p.name}: ${p.health_score}/100`
        ),
      });
    }

    // Productivity Trends
    if (data.productivity_trends.length > 0) {
      slides.push({
        title: 'Productivity Trends',
        bullets: data.productivity_trends.map(
          (t) => `${t.metric}: ${t.change_percent > 0 ? '+' : ''}${t.change_percent.toFixed(1)}%`
        ),
        hasChart: true,
      });
    }

    // Upcoming Week
    if (data.upcoming_week.length > 0) {
      const critical = data.upcoming_week.filter((u) => u.priority === 'critical' || u.priority === 'high');
      slides.push({
        title: 'Next Week Preview',
        bullets: critical.slice(0, 5).map(
          (u) => `${u.title} (${new Date(u.date).toLocaleDateString()})`
        ),
      });
    }

    // Recommendations
    if (data.recommendations.length > 0) {
      slides.push({
        title: 'Recommendations',
        bullets: data.recommendations.slice(0, 4).map((r) => r.title),
      });
    }

    return slides;
  }

  /**
   * Generate chart data for visualizations
   */
  private generateChartsData(data: WeeklyBriefingData): any {
    return {
      productivity_chart: {
        type: 'bar',
        labels: data.productivity_trends.map((t) => t.metric),
        datasets: [
          {
            label: 'This Week',
            data: data.productivity_trends.map((t) => t.current_week),
          },
          {
            label: 'Last Week',
            data: data.productivity_trends.map((t) => t.previous_week),
          },
        ],
      },
      focus_distribution: {
        type: 'pie',
        labels: data.focus_areas.map((f) => f.area),
        data: data.focus_areas.map((f) => f.time_spent_hours),
      },
      goal_progress_chart: {
        type: 'horizontalBar',
        labels: data.goal_progress.map((g) => g.title),
        data: data.goal_progress.map((g) => g.progress_percent),
      },
    };
  }

  /**
   * Generate recommendations based on data analysis
   */
  private generateRecommendations(
    stats: WeeklyStats,
    trends: ProductivityTrend[],
    focusAreas: FocusAreaAnalysis[],
    goals: GoalProgress[],
    projects: ProjectHealth[],
    teams?: TeamHealth[]
  ): WeeklyRecommendation[] {
    const recommendations: WeeklyRecommendation[] = [];

    // Low completion rate
    if (stats.completion_rate < 0.6) {
      recommendations.push({
        id: crypto.randomUUID(),
        type: 'productivity',
        title: 'Improve Task Completion',
        description: `Completion rate was ${(stats.completion_rate * 100).toFixed(0)}% this week. Consider breaking large tasks into smaller ones.`,
        action_items: [
          'Review task estimation accuracy',
          'Break down complex tasks',
          'Identify and remove blockers',
        ],
        priority: 'high',
        data_driven: true,
        supporting_data: `${stats.tasks_completed}/${stats.tasks_planned} tasks completed`,
      });
    }

    // Too many rolled over tasks
    if (stats.tasks_rolled_over > 3) {
      recommendations.push({
        id: crypto.randomUUID(),
        type: 'focus',
        title: 'Address Carried-Over Tasks',
        description: `${stats.tasks_rolled_over} tasks rolled over from last week. Prioritize or reschedule these.`,
        priority: 'medium',
        data_driven: true,
      });
    }

    // Meeting time vs focus time balance
    if (stats.meeting_hours > stats.focus_time_hours * 1.5) {
      recommendations.push({
        id: crypto.randomUUID(),
        type: 'balance',
        title: 'Rebalance Meeting Time',
        description: `Meeting time (${stats.meeting_hours.toFixed(1)}h) significantly exceeds focus time (${stats.focus_time_hours.toFixed(1)}h).`,
        action_items: [
          'Audit meeting necessity',
          'Block focus time on calendar',
          'Consider async alternatives',
        ],
        priority: 'high',
        data_driven: true,
      });
    }

    // Goals at risk
    const atRiskGoals = goals.filter((g) => g.status === 'at_risk' || g.status === 'behind');
    if (atRiskGoals.length > 0) {
      recommendations.push({
        id: crypto.randomUUID(),
        type: 'goal',
        title: 'Goals Need Attention',
        description: `${atRiskGoals.length} goal(s) are at risk or behind schedule.`,
        action_items: atRiskGoals.slice(0, 3).map((g) => `Review "${g.title}" progress`),
        priority: 'high',
        data_driven: true,
      });
    }

    // Projects in critical state
    const criticalProjects = projects.filter((p) => p.status === 'critical');
    if (criticalProjects.length > 0) {
      recommendations.push({
        id: crypto.randomUUID(),
        type: 'project',
        title: 'Critical Project Alert',
        description: `${criticalProjects.length} project(s) need immediate attention.`,
        action_items: criticalProjects.map((p) => `Address ${p.name}: ${p.risks[0] || 'review status'}`),
        priority: 'high',
        data_driven: true,
      });
    }

    // Declining productivity trends
    const decliningTrends = trends.filter((t) => t.trend === 'down' && t.change_percent < -10);
    if (decliningTrends.length > 0) {
      recommendations.push({
        id: crypto.randomUUID(),
        type: 'productivity',
        title: 'Declining Metrics',
        description: `${decliningTrends.map((t) => t.metric).join(', ')} showed decline this week.`,
        action_items: decliningTrends.map((t) => `Investigate ${t.metric} drop: ${t.insight || 'review factors'}`),
        priority: 'medium',
        data_driven: true,
      });
    }

    // Focus area imbalance
    const dominantArea = focusAreas.find((f) => f.percentage_of_total > 60);
    if (dominantArea) {
      recommendations.push({
        id: crypto.randomUUID(),
        type: 'balance',
        title: 'Focus Area Imbalance',
        description: `${dominantArea.area} consumed ${dominantArea.percentage_of_total.toFixed(0)}% of your time.`,
        priority: 'low',
        data_driven: true,
        supporting_data: `${dominantArea.time_spent_hours.toFixed(1)} hours in ${dominantArea.area}`,
      });
    }

    // Team health concerns
    if (teams) {
      const concernedTeams = teams.filter((t) => t.health_score < 60);
      if (concernedTeams.length > 0) {
        recommendations.push({
          id: crypto.randomUUID(),
          type: 'team',
          title: 'Team Health Concerns',
          description: `${concernedTeams.length} team(s) may need support.`,
          action_items: concernedTeams.map((t) => `Check in with ${t.name} team`),
          priority: 'medium',
          data_driven: true,
        });
      }
    }

    // Sort by priority
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return recommendations;
  }

  // ============================================================================
  // Data Fetching Methods (Mock implementations)
  // ============================================================================

  private async getWeeklyStats(userId: string, weekStart: string): Promise<WeeklyStats> {
    return {
      tasks_planned: 25,
      tasks_completed: 18,
      tasks_added_mid_week: 5,
      tasks_rolled_over: 3,
      completion_rate: 0.72,
      focus_time_hours: 22.5,
      meeting_hours: 15,
      decisions_made: 8,
      goals_achieved: 2,
    };
  }

  private async getWeeklyAccomplishments(userId: string, weekStart: string): Promise<WeeklyAccomplishment[]> {
    return [
      {
        id: 'a1',
        title: 'Launched new feature X',
        date: weekStart,
        category: 'Development',
        impact: 'high',
        project: 'Project Alpha',
        stakeholders: ['Product Team', 'Engineering'],
      },
      {
        id: 'a2',
        title: 'Completed quarterly planning',
        date: weekStart,
        category: 'Planning',
        impact: 'high',
        stakeholders: ['Leadership'],
      },
      {
        id: 'a3',
        title: 'Resolved 15 support tickets',
        date: weekStart,
        category: 'Support',
        impact: 'medium',
      },
      {
        id: 'a4',
        title: 'Onboarded 2 new team members',
        date: weekStart,
        category: 'Team',
        impact: 'medium',
      },
    ];
  }

  private async getProductivityTrends(userId: string): Promise<ProductivityTrend[]> {
    return [
      {
        metric: 'Task Completion',
        current_week: 18,
        previous_week: 15,
        change_percent: 20,
        trend: 'up',
        insight: 'Improved focus time contributed to higher completion',
      },
      {
        metric: 'Focus Time (hours)',
        current_week: 22.5,
        previous_week: 18,
        change_percent: 25,
        trend: 'up',
        insight: 'Calendar blocking strategy working well',
      },
      {
        metric: 'Meeting Time (hours)',
        current_week: 15,
        previous_week: 20,
        change_percent: -25,
        trend: 'down',
        insight: 'Successfully reduced unnecessary meetings',
      },
      {
        metric: 'Response Time (hours)',
        current_week: 2.5,
        previous_week: 2.8,
        change_percent: -10.7,
        trend: 'down',
        insight: 'Improved communication efficiency',
      },
    ];
  }

  private async getFocusAreaAnalysis(userId: string, weekStart: string): Promise<FocusAreaAnalysis[]> {
    return [
      {
        area: 'Development',
        time_spent_hours: 15,
        percentage_of_total: 40,
        tasks_completed: 8,
        effectiveness_score: 0.85,
        trend: 'up',
      },
      {
        area: 'Meetings',
        time_spent_hours: 10,
        percentage_of_total: 27,
        tasks_completed: 0,
        effectiveness_score: 0.7,
        trend: 'stable',
      },
      {
        area: 'Planning',
        time_spent_hours: 6,
        percentage_of_total: 16,
        tasks_completed: 4,
        effectiveness_score: 0.9,
        trend: 'up',
      },
      {
        area: 'Communication',
        time_spent_hours: 4,
        percentage_of_total: 11,
        tasks_completed: 6,
        effectiveness_score: 0.75,
        trend: 'stable',
      },
      {
        area: 'Admin',
        time_spent_hours: 2.5,
        percentage_of_total: 6,
        tasks_completed: 2,
        effectiveness_score: 0.6,
        trend: 'down',
      },
    ];
  }

  private async getGoalProgress(userId: string): Promise<GoalProgress[]> {
    return [
      {
        id: 'g1',
        title: 'Launch Product v2.0',
        target: 100,
        current: 75,
        progress_percent: 75,
        due_date: '2024-03-31',
        status: 'on_track',
        milestones_completed: 6,
        milestones_total: 8,
      },
      {
        id: 'g2',
        title: 'Reduce Technical Debt',
        target: 50,
        current: 35,
        progress_percent: 70,
        status: 'at_risk',
        milestones_completed: 7,
        milestones_total: 10,
        notes: 'Need to allocate more time next week',
      },
      {
        id: 'g3',
        title: 'Team Growth - 5 New Hires',
        target: 5,
        current: 3,
        progress_percent: 60,
        due_date: '2024-06-30',
        status: 'on_track',
        milestones_completed: 3,
        milestones_total: 5,
      },
    ];
  }

  private async getProjectHealth(userId: string): Promise<ProjectHealth[]> {
    return [
      {
        id: 'p1',
        name: 'Project Alpha',
        health_score: 85,
        status: 'healthy',
        metrics: {
          tasks_completed: 45,
          tasks_remaining: 15,
          blockers: 1,
          team_velocity: 28,
          budget_used_percent: 60,
          timeline_status: 'on_track',
        },
        risks: ['Dependency on external API'],
        highlights: ['Ahead of schedule', 'Under budget'],
      },
      {
        id: 'p2',
        name: 'Project Beta',
        health_score: 65,
        status: 'attention',
        metrics: {
          tasks_completed: 30,
          tasks_remaining: 40,
          blockers: 3,
          team_velocity: 18,
          budget_used_percent: 75,
          timeline_status: 'delayed',
        },
        risks: ['Resource constraints', 'Scope creep'],
        highlights: ['Key feature completed'],
      },
      {
        id: 'p3',
        name: 'Infrastructure Upgrade',
        health_score: 90,
        status: 'healthy',
        metrics: {
          tasks_completed: 12,
          tasks_remaining: 3,
          blockers: 0,
          team_velocity: 15,
          timeline_status: 'ahead',
        },
        risks: [],
        highlights: ['Nearly complete', 'Zero incidents'],
      },
    ];
  }

  private async getTeamHealth(userId: string): Promise<TeamHealth[]> {
    return [
      {
        id: 't1',
        name: 'Engineering',
        health_score: 82,
        members_count: 8,
        metrics: {
          productivity_index: 0.85,
          collaboration_score: 0.9,
          workload_balance: 0.75,
          response_time_avg_hours: 2,
        },
        achievements: ['Shipped 3 features', 'Reduced bug backlog by 40%'],
      },
      {
        id: 't2',
        name: 'Design',
        health_score: 78,
        members_count: 3,
        metrics: {
          productivity_index: 0.8,
          collaboration_score: 0.85,
          workload_balance: 0.65,
          response_time_avg_hours: 4,
        },
        concerns: ['Workload imbalance detected'],
      },
    ];
  }

  private async getUpcomingWeek(userId: string): Promise<UpcomingWeekItem[]> {
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    return [
      {
        id: 'u1',
        title: 'Q1 Review Meeting',
        date: nextWeek.toISOString(),
        type: 'meeting',
        priority: 'critical',
        notes: 'Prepare quarterly metrics',
      },
      {
        id: 'u2',
        title: 'Product Demo',
        date: new Date(nextWeek.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        type: 'meeting',
        priority: 'high',
        project: 'Project Alpha',
      },
      {
        id: 'u3',
        title: 'Budget Submission Deadline',
        date: new Date(nextWeek.getTime() + 4 * 24 * 60 * 60 * 1000).toISOString(),
        type: 'deadline',
        priority: 'critical',
      },
      {
        id: 'u4',
        title: 'Sprint Planning',
        date: new Date(nextWeek.getTime() + 1 * 24 * 60 * 60 * 1000).toISOString(),
        type: 'meeting',
        priority: 'medium',
      },
    ];
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private getWeekStart(): string {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(now.setDate(diff));
    return monday.toISOString().split('T')[0];
  }

  private getGoalStatusIndicator(status: string): string {
    const indicators: Record<string, string> = {
      on_track: '[OK]',
      at_risk: '[!]',
      behind: '[!!]',
      completed: '[DONE]',
      exceeded: '[++]',
    };
    return indicators[status] || '[-]';
  }

  private getHealthIndicator(score: number): string {
    if (score >= 80) return '[HEALTHY]';
    if (score >= 60) return '[ATTENTION]';
    return '[CRITICAL]';
  }

  /**
   * Invalidate cache for user
   */
  async invalidateCache(userId: string, weekStart?: string): Promise<void> {
    const start = weekStart || this.getWeekStart();
    oracleCacheService.delete(cacheKey('briefing_weekly', userId, start));
  }
}

// Singleton export
export const weeklyBriefingService = new WeeklyBriefingService();
