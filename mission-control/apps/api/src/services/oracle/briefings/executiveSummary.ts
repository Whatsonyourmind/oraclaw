/**
 * ORACLE Executive Summary Generator Service
 * High-level summaries for executive briefings
 *
 * Features:
 * - One-page executive view
 * - KPI dashboard data
 * - Strategic alignment check
 * - Decision points requiring attention
 * - Stakeholder updates
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

export type KPIStatus = 'on_target' | 'above_target' | 'below_target' | 'at_risk' | 'critical';
export type StrategicAlignment = 'aligned' | 'partially_aligned' | 'misaligned' | 'under_review';
export type DecisionUrgency = 'immediate' | 'this_week' | 'this_month' | 'this_quarter';
export type StakeholderSentiment = 'positive' | 'neutral' | 'concerned' | 'negative';

export interface KPIData {
  id: string;
  name: string;
  category: string;
  current_value: number;
  target_value: number;
  previous_value?: number;
  unit: string;
  status: KPIStatus;
  trend: 'up' | 'down' | 'stable';
  trend_percentage?: number;
  forecast?: {
    value: number;
    confidence: number;
    date: string;
  };
  notes?: string;
}

export interface StrategicGoal {
  id: string;
  title: string;
  description: string;
  alignment: StrategicAlignment;
  progress_percent: number;
  status: 'on_track' | 'at_risk' | 'off_track' | 'completed';
  key_initiatives: {
    name: string;
    progress: number;
    status: string;
  }[];
  blockers?: string[];
  owner: string;
  due_date?: string;
}

export interface DecisionPoint {
  id: string;
  title: string;
  description: string;
  urgency: DecisionUrgency;
  impact: 'high' | 'medium' | 'low';
  category: string;
  options: {
    option: string;
    pros: string[];
    cons: string[];
    recommendation_score?: number;
  }[];
  recommendation?: string;
  stakeholders_affected: string[];
  deadline?: string;
  context?: string;
  data_supporting?: string[];
}

export interface StakeholderUpdate {
  id: string;
  stakeholder: string;
  role: string;
  department?: string;
  last_communication?: string;
  sentiment: StakeholderSentiment;
  key_concerns?: string[];
  recent_feedback?: string;
  action_required?: string;
  priority: 'high' | 'medium' | 'low';
}

export interface ExecutiveHighlight {
  type: 'achievement' | 'risk' | 'opportunity' | 'milestone' | 'alert';
  title: string;
  description: string;
  impact: string;
  date?: string;
}

export interface ResourceAllocation {
  category: string;
  allocated: number;
  utilized: number;
  utilization_percent: number;
  status: 'optimal' | 'underutilized' | 'overutilized' | 'critical';
  recommendations?: string;
}

export interface ExecutiveSummaryData {
  user_id: string;
  generated_at: string;
  period: {
    start: string;
    end: string;
    type: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  };
  executive_summary: string;
  highlights: ExecutiveHighlight[];
  kpis: KPIData[];
  strategic_goals: StrategicGoal[];
  decision_points: DecisionPoint[];
  stakeholder_updates: StakeholderUpdate[];
  resource_allocation?: ResourceAllocation[];
  upcoming_milestones?: {
    title: string;
    date: string;
    status: string;
    impact: string;
  }[];
  risks_summary?: {
    total: number;
    critical: number;
    high: number;
    trending_up: number;
    new_this_period: number;
  };
}

export interface ExecutiveSummaryResult {
  briefing: RenderedBriefing;
  raw_data: ExecutiveSummaryData;
  generated_at: string;
  one_pager: string;
  kpi_dashboard: {
    overall_health: number;
    categories: {
      name: string;
      score: number;
      trend: string;
    }[];
  };
  action_items: {
    immediate: number;
    this_week: number;
    total: number;
  };
  slides?: Array<{ title: string; bullets: string[]; hasChart?: boolean }>;
}

// ============================================================================
// Cache TTLs
// ============================================================================

const EXEC_CACHE_TTL = {
  daily: 2 * 60 * 60 * 1000, // 2 hours
  weekly: 4 * 60 * 60 * 1000, // 4 hours
  monthly: 12 * 60 * 60 * 1000, // 12 hours
  quarterly: 24 * 60 * 60 * 1000, // 24 hours
};

// ============================================================================
// Executive Summary Service
// ============================================================================

export class ExecutiveSummaryService {
  /**
   * Generate an executive summary
   */
  async generateExecutiveSummary(
    userId: string,
    options: {
      template_id?: string;
      format?: BriefingFormat;
      period_type?: 'daily' | 'weekly' | 'monthly' | 'quarterly';
      include_stakeholders?: boolean;
      include_resources?: boolean;
    } = {}
  ): Promise<ExecutiveSummaryResult> {
    const periodType = options.period_type || 'weekly';
    const cacheKeyStr = cacheKey('exec_summary', userId, periodType, hashObject(options));

    const cached = oracleCacheService.get<ExecutiveSummaryResult>(cacheKeyStr);
    if (cached) return cached;

    // Gather data
    const data = await this.gatherExecutiveData(userId, {
      period_type: periodType,
      include_stakeholders: options.include_stakeholders ?? true,
      include_resources: options.include_resources ?? true,
    });

    // Get template
    const template = options.template_id
      ? await briefingTemplatesService.getTemplate(options.template_id, userId)
      : await briefingTemplatesService.getDefaultTemplate(userId, 'executive');

    if (!template) {
      throw new Error('No executive summary template found');
    }

    // Generate briefing
    const briefing = this.renderExecutiveSummary(template, data, options.format || template.default_format);

    // Generate one-pager
    const onePager = this.generateOnePager(data);

    // Calculate KPI dashboard
    const kpiDashboard = this.calculateKPIDashboard(data.kpis);

    // Count action items
    const actionItems = this.countActionItems(data);

    const result: ExecutiveSummaryResult = {
      briefing,
      raw_data: data,
      generated_at: new Date().toISOString(),
      one_pager: onePager,
      kpi_dashboard: kpiDashboard,
      action_items: actionItems,
    };

    // Generate slides if requested
    if (options.format === 'slides' || template.output_formats.includes('slides')) {
      result.slides = this.generateSlides(data);
    }

    oracleCacheService.set(cacheKeyStr, result, EXEC_CACHE_TTL[periodType]);
    return result;
  }

  /**
   * Gather all executive data
   */
  private async gatherExecutiveData(
    userId: string,
    options: {
      period_type: 'daily' | 'weekly' | 'monthly' | 'quarterly';
      include_stakeholders: boolean;
      include_resources: boolean;
    }
  ): Promise<ExecutiveSummaryData> {
    const period = this.calculatePeriod(options.period_type);

    // Gather all data in parallel
    const [
      kpis,
      strategicGoals,
      decisionPoints,
      stakeholderUpdates,
      resourceAllocation,
    ] = await Promise.all([
      this.getKPIs(userId, options.period_type),
      this.getStrategicGoals(userId),
      this.getDecisionPoints(userId),
      options.include_stakeholders ? this.getStakeholderUpdates(userId) : Promise.resolve([]),
      options.include_resources ? this.getResourceAllocation(userId) : Promise.resolve(undefined),
    ]);

    // Generate highlights
    const highlights = this.generateHighlights(kpis, strategicGoals, decisionPoints);

    // Generate executive summary text
    const executiveSummary = this.generateSummaryText(kpis, strategicGoals, highlights);

    // Get upcoming milestones
    const upcomingMilestones = await this.getUpcomingMilestones(userId);

    // Calculate risks summary
    const risksSummary = await this.getRisksSummary(userId);

    return {
      user_id: userId,
      generated_at: new Date().toISOString(),
      period,
      executive_summary: executiveSummary,
      highlights,
      kpis,
      strategic_goals: strategicGoals,
      decision_points: decisionPoints,
      stakeholder_updates: stakeholderUpdates,
      resource_allocation: resourceAllocation,
      upcoming_milestones: upcomingMilestones,
      risks_summary: risksSummary,
    };
  }

  /**
   * Render executive summary from template and data
   */
  private renderExecutiveSummary(
    template: BriefingTemplate,
    data: ExecutiveSummaryData,
    format: BriefingFormat
  ): RenderedBriefing {
    const sections: TemplateSection[] = [];

    // Executive Summary Section
    sections.push({
      type: 'custom',
      content: data.executive_summary,
      metadata: { type: 'summary' },
    });

    // Highlights
    if (data.highlights.length > 0) {
      sections.push({
        type: 'custom',
        content: data.highlights.map((h) => {
          const icon = this.getHighlightIcon(h.type);
          return `${icon} [${h.type.toUpperCase()}] ${h.title}: ${h.description}`;
        }),
        data: data.highlights,
        metadata: { count: data.highlights.length },
      });
    }

    // KPIs
    sections.push({
      type: 'kpis',
      content: data.kpis.map((kpi) => {
        const status = this.getKPIStatusIcon(kpi.status);
        const trend = kpi.trend === 'up' ? 'UP' : kpi.trend === 'down' ? 'DOWN' : '-';
        const change = kpi.trend_percentage ? ` (${kpi.trend_percentage > 0 ? '+' : ''}${kpi.trend_percentage.toFixed(1)}%)` : '';
        return `${status} ${kpi.name}: ${kpi.current_value}${kpi.unit} (Target: ${kpi.target_value}${kpi.unit}) ${trend}${change}`;
      }),
      data: data.kpis,
      metadata: { count: data.kpis.length },
    });

    // Strategic Goals
    sections.push({
      type: 'goals',
      content: data.strategic_goals.map((goal) => {
        const alignment = this.getAlignmentIcon(goal.alignment);
        return `${alignment} ${goal.title}: ${goal.progress_percent}% complete - ${goal.status}`;
      }),
      data: data.strategic_goals,
      metadata: { count: data.strategic_goals.length },
    });

    // Decision Points
    const urgentDecisions = data.decision_points.filter(
      (d) => d.urgency === 'immediate' || d.urgency === 'this_week'
    );
    if (urgentDecisions.length > 0) {
      sections.push({
        type: 'decisions',
        content: urgentDecisions.map((d) => {
          return `[${d.urgency.toUpperCase()}] ${d.title} - Impact: ${d.impact}${d.recommendation ? ` - Rec: ${d.recommendation}` : ''}`;
        }),
        data: urgentDecisions,
        metadata: { count: urgentDecisions.length, total: data.decision_points.length },
      });
    }

    // Stakeholder Updates
    const concernedStakeholders = data.stakeholder_updates.filter(
      (s) => s.sentiment === 'concerned' || s.sentiment === 'negative' || s.priority === 'high'
    );
    if (concernedStakeholders.length > 0) {
      sections.push({
        type: 'stakeholders',
        content: concernedStakeholders.map((s) => {
          return `[${s.sentiment.toUpperCase()}] ${s.stakeholder} (${s.role}): ${s.recent_feedback || s.key_concerns?.join(', ') || 'Follow-up needed'}`;
        }),
        data: concernedStakeholders,
        metadata: { count: concernedStakeholders.length, total: data.stakeholder_updates.length },
      });
    }

    // Risks Summary
    if (data.risks_summary) {
      sections.push({
        type: 'risks',
        content: [
          `Total Active Risks: ${data.risks_summary.total}`,
          `Critical: ${data.risks_summary.critical}, High: ${data.risks_summary.high}`,
          `Trending Up: ${data.risks_summary.trending_up}`,
          `New This Period: ${data.risks_summary.new_this_period}`,
        ],
        data: data.risks_summary,
      });
    }

    // Upcoming Milestones
    if (data.upcoming_milestones && data.upcoming_milestones.length > 0) {
      sections.push({
        type: 'custom',
        content: data.upcoming_milestones.slice(0, 5).map((m) => {
          return `${new Date(m.date).toLocaleDateString()}: ${m.title} - ${m.status}`;
        }),
        data: data.upcoming_milestones,
        metadata: { count: data.upcoming_milestones.length },
      });
    }

    return {
      template_id: template.id,
      briefing_type: 'executive',
      format,
      title: `Executive Summary - ${this.formatPeriod(data.period)}`,
      sections,
      generated_at: new Date().toISOString(),
      metadata: {
        user_id: data.user_id,
        period: data.period,
      },
    };
  }

  /**
   * Generate one-page executive summary
   */
  private generateOnePager(data: ExecutiveSummaryData): string {
    let onePager = '';

    // Header
    onePager += `EXECUTIVE SUMMARY - ${this.formatPeriod(data.period).toUpperCase()}\n`;
    onePager += `${'='.repeat(60)}\n\n`;

    // Overview
    onePager += `OVERVIEW\n`;
    onePager += `${data.executive_summary}\n\n`;

    // Key Highlights
    onePager += `KEY HIGHLIGHTS\n`;
    data.highlights.slice(0, 4).forEach((h) => {
      onePager += `* [${h.type.toUpperCase()}] ${h.title}\n`;
    });
    onePager += '\n';

    // KPI Summary
    onePager += `KPI PERFORMANCE\n`;
    const onTarget = data.kpis.filter((k) => k.status === 'on_target' || k.status === 'above_target').length;
    const atRisk = data.kpis.filter((k) => k.status === 'at_risk' || k.status === 'critical').length;
    onePager += `* ${onTarget}/${data.kpis.length} KPIs on or above target\n`;
    onePager += `* ${atRisk} KPIs requiring attention\n\n`;

    // Strategic Alignment
    onePager += `STRATEGIC GOALS\n`;
    const onTrack = data.strategic_goals.filter((g) => g.status === 'on_track' || g.status === 'completed').length;
    onePager += `* ${onTrack}/${data.strategic_goals.length} goals on track\n`;
    data.strategic_goals.filter((g) => g.status !== 'on_track' && g.status !== 'completed').forEach((g) => {
      onePager += `* ${g.title}: ${g.status}\n`;
    });
    onePager += '\n';

    // Decisions Needed
    const urgentDecisions = data.decision_points.filter(
      (d) => d.urgency === 'immediate' || d.urgency === 'this_week'
    );
    if (urgentDecisions.length > 0) {
      onePager += `DECISIONS REQUIRED\n`;
      urgentDecisions.slice(0, 3).forEach((d) => {
        onePager += `* [${d.urgency.toUpperCase()}] ${d.title}\n`;
      });
      onePager += '\n';
    }

    // Risks
    if (data.risks_summary && data.risks_summary.critical > 0) {
      onePager += `CRITICAL RISKS: ${data.risks_summary.critical}\n\n`;
    }

    // Action Items
    onePager += `REQUIRED ACTIONS\n`;
    onePager += `* Immediate: ${urgentDecisions.filter((d) => d.urgency === 'immediate').length}\n`;
    onePager += `* This Week: ${urgentDecisions.filter((d) => d.urgency === 'this_week').length}\n`;

    onePager += `\n${'='.repeat(60)}\n`;
    onePager += `Generated: ${new Date().toLocaleString()}\n`;

    return onePager;
  }

  /**
   * Calculate KPI dashboard metrics
   */
  private calculateKPIDashboard(kpis: KPIData[]): {
    overall_health: number;
    categories: { name: string; score: number; trend: string }[];
  } {
    // Calculate overall health
    const scores = kpis.map((kpi) => {
      if (kpi.status === 'above_target') return 100;
      if (kpi.status === 'on_target') return 80;
      if (kpi.status === 'below_target') return 60;
      if (kpi.status === 'at_risk') return 40;
      return 20; // critical
    });
    const overallHealth = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

    // Group by category
    const categories = new Map<string, KPIData[]>();
    kpis.forEach((kpi) => {
      const cat = categories.get(kpi.category) || [];
      cat.push(kpi);
      categories.set(kpi.category, cat);
    });

    const categoryScores: { name: string; score: number; trend: string }[] = [];
    categories.forEach((catKpis, catName) => {
      const catScores = catKpis.map((kpi) => {
        if (kpi.status === 'above_target') return 100;
        if (kpi.status === 'on_target') return 80;
        if (kpi.status === 'below_target') return 60;
        if (kpi.status === 'at_risk') return 40;
        return 20;
      });
      const avgScore = catScores.reduce((a, b) => a + b, 0) / catScores.length;

      // Determine trend
      const upCount = catKpis.filter((k) => k.trend === 'up').length;
      const downCount = catKpis.filter((k) => k.trend === 'down').length;
      let trend = 'stable';
      if (upCount > downCount) trend = 'improving';
      if (downCount > upCount) trend = 'declining';

      categoryScores.push({ name: catName, score: Math.round(avgScore), trend });
    });

    return {
      overall_health: Math.round(overallHealth),
      categories: categoryScores,
    };
  }

  /**
   * Count action items by urgency
   */
  private countActionItems(data: ExecutiveSummaryData): { immediate: number; this_week: number; total: number } {
    const immediate = data.decision_points.filter((d) => d.urgency === 'immediate').length +
      data.stakeholder_updates.filter((s) => s.priority === 'high' && s.action_required).length;

    const thisWeek = data.decision_points.filter((d) => d.urgency === 'this_week').length;

    return {
      immediate,
      this_week: thisWeek,
      total: data.decision_points.length + data.stakeholder_updates.filter((s) => s.action_required).length,
    };
  }

  /**
   * Generate slides for presentation
   */
  private generateSlides(data: ExecutiveSummaryData): Array<{ title: string; bullets: string[]; hasChart?: boolean }> {
    const slides: Array<{ title: string; bullets: string[]; hasChart?: boolean }> = [];

    // Title slide
    slides.push({
      title: `Executive Summary`,
      bullets: [
        this.formatPeriod(data.period),
        `Generated: ${new Date().toLocaleDateString()}`,
      ],
    });

    // Overview slide
    slides.push({
      title: 'Overview',
      bullets: data.executive_summary.split('. ').slice(0, 4).map((s) => s.trim()).filter(Boolean),
    });

    // Highlights slide
    slides.push({
      title: 'Key Highlights',
      bullets: data.highlights.slice(0, 5).map((h) => `${h.type}: ${h.title}`),
    });

    // KPI Dashboard slide
    slides.push({
      title: 'KPI Performance',
      bullets: data.kpis.slice(0, 6).map((k) => `${k.name}: ${k.current_value}${k.unit} (${k.status})`),
      hasChart: true,
    });

    // Strategic Goals slide
    slides.push({
      title: 'Strategic Alignment',
      bullets: data.strategic_goals.map((g) => `${g.title}: ${g.progress_percent}%`),
      hasChart: true,
    });

    // Decisions slide
    const urgentDecisions = data.decision_points.filter((d) => d.urgency === 'immediate' || d.urgency === 'this_week');
    if (urgentDecisions.length > 0) {
      slides.push({
        title: 'Decisions Required',
        bullets: urgentDecisions.slice(0, 4).map((d) => d.title),
      });
    }

    // Next steps slide
    slides.push({
      title: 'Recommended Actions',
      bullets: [
        ...urgentDecisions.filter((d) => d.urgency === 'immediate').slice(0, 2).map((d) => `IMMEDIATE: ${d.title}`),
        ...data.stakeholder_updates.filter((s) => s.action_required).slice(0, 2).map((s) => `STAKEHOLDER: ${s.stakeholder}`),
      ],
    });

    return slides;
  }

  /**
   * Generate highlights from data
   */
  private generateHighlights(
    kpis: KPIData[],
    goals: StrategicGoal[],
    decisions: DecisionPoint[]
  ): ExecutiveHighlight[] {
    const highlights: ExecutiveHighlight[] = [];

    // KPI achievements
    const exceeding = kpis.filter((k) => k.status === 'above_target');
    if (exceeding.length > 0) {
      highlights.push({
        type: 'achievement',
        title: `${exceeding.length} KPIs Exceeding Target`,
        description: exceeding.map((k) => k.name).join(', '),
        impact: 'Positive performance indicators',
      });
    }

    // KPI risks
    const critical = kpis.filter((k) => k.status === 'critical');
    if (critical.length > 0) {
      highlights.push({
        type: 'risk',
        title: `${critical.length} KPIs Critical`,
        description: critical.map((k) => k.name).join(', '),
        impact: 'Requires immediate attention',
      });
    }

    // Completed goals
    const completed = goals.filter((g) => g.status === 'completed');
    if (completed.length > 0) {
      highlights.push({
        type: 'milestone',
        title: `${completed.length} Goals Completed`,
        description: completed.map((g) => g.title).join(', '),
        impact: 'Strategic progress achieved',
      });
    }

    // Goals at risk
    const atRisk = goals.filter((g) => g.status === 'at_risk' || g.status === 'off_track');
    if (atRisk.length > 0) {
      highlights.push({
        type: 'alert',
        title: `${atRisk.length} Goals Need Attention`,
        description: atRisk.map((g) => g.title).join(', '),
        impact: 'May impact strategic objectives',
      });
    }

    // Urgent decisions
    const urgent = decisions.filter((d) => d.urgency === 'immediate');
    if (urgent.length > 0) {
      highlights.push({
        type: 'alert',
        title: `${urgent.length} Immediate Decisions Required`,
        description: urgent.map((d) => d.title).join(', '),
        impact: 'Time-sensitive actions needed',
      });
    }

    return highlights;
  }

  /**
   * Generate summary text
   */
  private generateSummaryText(kpis: KPIData[], goals: StrategicGoal[], highlights: ExecutiveHighlight[]): string {
    const parts: string[] = [];

    // KPI summary
    const onTarget = kpis.filter((k) => k.status === 'on_target' || k.status === 'above_target').length;
    const total = kpis.length;
    parts.push(`Overall performance: ${onTarget} of ${total} KPIs are on or above target.`);

    // Goals summary
    const goalsOnTrack = goals.filter((g) => g.status === 'on_track' || g.status === 'completed').length;
    const avgProgress = goals.length > 0 ? goals.reduce((sum, g) => sum + g.progress_percent, 0) / goals.length : 0;
    parts.push(`Strategic goals: ${goalsOnTrack}/${goals.length} on track with ${avgProgress.toFixed(0)}% average progress.`);

    // Highlight key items
    const risks = highlights.filter((h) => h.type === 'risk' || h.type === 'alert');
    if (risks.length > 0) {
      parts.push(`Key concerns: ${risks.map((r) => r.title).join('; ')}.`);
    }

    const achievements = highlights.filter((h) => h.type === 'achievement' || h.type === 'milestone');
    if (achievements.length > 0) {
      parts.push(`Achievements: ${achievements.map((a) => a.title).join('; ')}.`);
    }

    return parts.join(' ');
  }

  // ============================================================================
  // Data Fetching Methods (Mock implementations)
  // ============================================================================

  private async getKPIs(userId: string, periodType: string): Promise<KPIData[]> {
    return [
      {
        id: 'kpi1',
        name: 'Revenue',
        category: 'Financial',
        current_value: 2.4,
        target_value: 2.5,
        previous_value: 2.2,
        unit: 'M',
        status: 'below_target',
        trend: 'up',
        trend_percentage: 9.1,
        forecast: { value: 2.6, confidence: 0.8, date: '2024-03-31' },
      },
      {
        id: 'kpi2',
        name: 'Customer Satisfaction',
        category: 'Customer',
        current_value: 4.2,
        target_value: 4.0,
        previous_value: 4.0,
        unit: '/5',
        status: 'above_target',
        trend: 'up',
        trend_percentage: 5.0,
      },
      {
        id: 'kpi3',
        name: 'Employee Engagement',
        category: 'People',
        current_value: 72,
        target_value: 75,
        previous_value: 70,
        unit: '%',
        status: 'below_target',
        trend: 'up',
        trend_percentage: 2.9,
        notes: 'Improving but still below target',
      },
      {
        id: 'kpi4',
        name: 'System Uptime',
        category: 'Operations',
        current_value: 99.9,
        target_value: 99.5,
        unit: '%',
        status: 'above_target',
        trend: 'stable',
      },
      {
        id: 'kpi5',
        name: 'Project Delivery',
        category: 'Operations',
        current_value: 78,
        target_value: 85,
        previous_value: 82,
        unit: '%',
        status: 'at_risk',
        trend: 'down',
        trend_percentage: -4.9,
        notes: 'Resource constraints impacting delivery',
      },
    ];
  }

  private async getStrategicGoals(userId: string): Promise<StrategicGoal[]> {
    return [
      {
        id: 'g1',
        title: 'Market Expansion',
        description: 'Expand into 3 new markets by Q4',
        alignment: 'aligned',
        progress_percent: 67,
        status: 'on_track',
        key_initiatives: [
          { name: 'Market Research', progress: 100, status: 'completed' },
          { name: 'Partnership Development', progress: 60, status: 'in_progress' },
          { name: 'Launch Preparation', progress: 40, status: 'in_progress' },
        ],
        owner: 'VP Sales',
        due_date: '2024-12-31',
      },
      {
        id: 'g2',
        title: 'Product Innovation',
        description: 'Launch 2 new product features per quarter',
        alignment: 'aligned',
        progress_percent: 80,
        status: 'on_track',
        key_initiatives: [
          { name: 'Feature A', progress: 100, status: 'completed' },
          { name: 'Feature B', progress: 60, status: 'in_progress' },
        ],
        owner: 'VP Product',
      },
      {
        id: 'g3',
        title: 'Operational Excellence',
        description: 'Reduce costs by 15% while maintaining quality',
        alignment: 'partially_aligned',
        progress_percent: 45,
        status: 'at_risk',
        key_initiatives: [
          { name: 'Process Automation', progress: 50, status: 'delayed' },
          { name: 'Vendor Optimization', progress: 40, status: 'in_progress' },
        ],
        blockers: ['Resource constraints', 'Technology limitations'],
        owner: 'COO',
      },
    ];
  }

  private async getDecisionPoints(userId: string): Promise<DecisionPoint[]> {
    return [
      {
        id: 'd1',
        title: 'Q2 Budget Allocation',
        description: 'Approve Q2 department budgets',
        urgency: 'this_week',
        impact: 'high',
        category: 'Financial',
        options: [
          {
            option: 'Maintain current allocation',
            pros: ['Stability', 'No disruption'],
            cons: ['May miss growth opportunities'],
            recommendation_score: 0.6,
          },
          {
            option: 'Increase R&D by 15%',
            pros: ['Accelerate innovation', 'Competitive advantage'],
            cons: ['Higher short-term costs'],
            recommendation_score: 0.8,
          },
        ],
        recommendation: 'Increase R&D allocation',
        stakeholders_affected: ['Engineering', 'Finance', 'Product'],
        deadline: '2024-02-15',
      },
      {
        id: 'd2',
        title: 'Partnership Opportunity',
        description: 'Evaluate strategic partnership with TechCorp',
        urgency: 'immediate',
        impact: 'high',
        category: 'Strategic',
        options: [
          {
            option: 'Proceed with partnership',
            pros: ['Market access', 'Technology synergies'],
            cons: ['Integration complexity', 'Revenue sharing'],
          },
          {
            option: 'Decline partnership',
            pros: ['Maintain independence'],
            cons: ['Miss market opportunity'],
          },
        ],
        stakeholders_affected: ['Executive Team', 'Legal', 'Sales'],
        deadline: '2024-02-10',
        context: 'TechCorp has market presence in target regions',
      },
    ];
  }

  private async getStakeholderUpdates(userId: string): Promise<StakeholderUpdate[]> {
    return [
      {
        id: 's1',
        stakeholder: 'Board of Directors',
        role: 'Governance',
        last_communication: '2024-01-25',
        sentiment: 'positive',
        recent_feedback: 'Pleased with Q4 results',
        priority: 'high',
      },
      {
        id: 's2',
        stakeholder: 'Key Customer - Acme Corp',
        role: 'Customer',
        department: 'Enterprise',
        last_communication: '2024-02-01',
        sentiment: 'concerned',
        key_concerns: ['Delivery timelines', 'Support response time'],
        action_required: 'Schedule executive review',
        priority: 'high',
      },
      {
        id: 's3',
        stakeholder: 'Engineering Team',
        role: 'Internal',
        sentiment: 'neutral',
        key_concerns: ['Workload balance', 'Technical debt'],
        priority: 'medium',
      },
    ];
  }

  private async getResourceAllocation(userId: string): Promise<ResourceAllocation[]> {
    return [
      {
        category: 'Engineering',
        allocated: 100,
        utilized: 95,
        utilization_percent: 95,
        status: 'overutilized',
        recommendations: 'Consider hiring or reducing scope',
      },
      {
        category: 'Sales',
        allocated: 50,
        utilized: 40,
        utilization_percent: 80,
        status: 'optimal',
      },
      {
        category: 'Marketing',
        allocated: 30,
        utilized: 25,
        utilization_percent: 83,
        status: 'optimal',
      },
    ];
  }

  private async getUpcomingMilestones(userId: string): Promise<{ title: string; date: string; status: string; impact: string }[]> {
    return [
      {
        title: 'Product v2.0 Launch',
        date: '2024-02-28',
        status: 'on_track',
        impact: 'Revenue growth opportunity',
      },
      {
        title: 'Q1 Board Meeting',
        date: '2024-03-15',
        status: 'scheduled',
        impact: 'Strategic alignment',
      },
      {
        title: 'Partnership Announcement',
        date: '2024-02-20',
        status: 'pending_decision',
        impact: 'Market expansion',
      },
    ];
  }

  private async getRisksSummary(userId: string): Promise<{ total: number; critical: number; high: number; trending_up: number; new_this_period: number }> {
    return {
      total: 12,
      critical: 1,
      high: 3,
      trending_up: 2,
      new_this_period: 2,
    };
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private calculatePeriod(type: 'daily' | 'weekly' | 'monthly' | 'quarterly'): {
    start: string;
    end: string;
    type: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  } {
    const now = new Date();
    let start: Date;
    let end: Date;

    switch (type) {
      case 'daily':
        start = new Date(now.setHours(0, 0, 0, 0));
        end = new Date(now.setHours(23, 59, 59, 999));
        break;
      case 'weekly':
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        start = new Date(now.setDate(diff));
        start.setHours(0, 0, 0, 0);
        end = new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000);
        end.setHours(23, 59, 59, 999);
        break;
      case 'monthly':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case 'quarterly':
        const quarter = Math.floor(now.getMonth() / 3);
        start = new Date(now.getFullYear(), quarter * 3, 1);
        end = new Date(now.getFullYear(), (quarter + 1) * 3, 0);
        break;
    }

    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
      type,
    };
  }

  private formatPeriod(period: { start: string; end: string; type: string }): string {
    const start = new Date(period.start);
    const end = new Date(period.end);

    switch (period.type) {
      case 'daily':
        return start.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
      case 'weekly':
        return `Week of ${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
      case 'monthly':
        return start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      case 'quarterly':
        const quarter = Math.floor(start.getMonth() / 3) + 1;
        return `Q${quarter} ${start.getFullYear()}`;
      default:
        return `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;
    }
  }

  private getHighlightIcon(type: string): string {
    const icons: Record<string, string> = {
      achievement: '[+]',
      risk: '[!]',
      opportunity: '[*]',
      milestone: '[M]',
      alert: '[!!]',
    };
    return icons[type] || '[-]';
  }

  private getKPIStatusIcon(status: KPIStatus): string {
    const icons: Record<KPIStatus, string> = {
      on_target: '[OK]',
      above_target: '[++]',
      below_target: '[--]',
      at_risk: '[!]',
      critical: '[!!]',
    };
    return icons[status] || '[-]';
  }

  private getAlignmentIcon(alignment: StrategicAlignment): string {
    const icons: Record<StrategicAlignment, string> = {
      aligned: '[A]',
      partially_aligned: '[P]',
      misaligned: '[X]',
      under_review: '[?]',
    };
    return icons[alignment] || '[-]';
  }

  /**
   * Invalidate cache for user
   */
  async invalidateCache(userId: string, periodType?: string): Promise<void> {
    if (periodType) {
      oracleCacheService.deleteByPrefix(`exec_summary:${userId}:${periodType}`);
    } else {
      oracleCacheService.deleteByPrefix(`exec_summary:${userId}`);
    }
  }
}

// Singleton export
export const executiveSummaryService = new ExecutiveSummaryService();
