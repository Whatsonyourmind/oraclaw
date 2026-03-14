/**
 * ORACLE Report Generator
 * Custom report creation, scheduling, and export
 */

import { EventEmitter } from 'events';

// Types
export interface Report {
  id: string;
  name: string;
  description: string;
  template: ReportTemplate;
  dateRange: DateRange;
  metrics: ReportMetric[];
  sections: ReportSection[];
  generatedAt: Date;
  generatedBy: string;
  status: 'generating' | 'ready' | 'failed' | 'expired';
  format: ExportFormat;
  shareLink?: string;
  expiresAt?: Date;
}

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  sections: TemplateSectionConfig[];
  defaultMetrics: string[];
  defaultDateRange: DateRangePreset;
  customizable: boolean;
  icon: string;
}

export type TemplateCategory =
  | 'productivity'
  | 'goals'
  | 'habits'
  | 'wellness'
  | 'summary'
  | 'custom';

export interface TemplateSectionConfig {
  id: string;
  title: string;
  type: SectionType;
  required: boolean;
  order: number;
  config?: Record<string, any>;
}

export type SectionType =
  | 'summary_stats'
  | 'chart'
  | 'table'
  | 'timeline'
  | 'comparison'
  | 'insights'
  | 'text';

export interface DateRange {
  start: Date;
  end: Date;
  preset?: DateRangePreset;
}

export type DateRangePreset =
  | 'today'
  | 'yesterday'
  | 'this_week'
  | 'last_week'
  | 'this_month'
  | 'last_month'
  | 'this_quarter'
  | 'last_quarter'
  | 'this_year'
  | 'last_year'
  | 'last_7_days'
  | 'last_30_days'
  | 'last_90_days'
  | 'custom';

export interface ReportMetric {
  id: string;
  name: string;
  value: number | string;
  previousValue?: number | string;
  change?: number;
  changeDirection?: 'up' | 'down' | 'stable';
  unit?: string;
  format?: 'number' | 'percentage' | 'duration' | 'currency';
}

export interface ReportSection {
  id: string;
  title: string;
  type: SectionType;
  content: SectionContent;
  order: number;
}

export type SectionContent =
  | SummaryStatsContent
  | ChartContent
  | TableContent
  | TimelineContent
  | ComparisonContent
  | InsightsContent
  | TextContent;

export interface SummaryStatsContent {
  type: 'summary_stats';
  stats: StatItem[];
}

export interface StatItem {
  label: string;
  value: number | string;
  change?: number;
  icon?: string;
  color?: string;
}

export interface ChartContent {
  type: 'chart';
  chartType: 'line' | 'bar' | 'pie' | 'area' | 'donut';
  data: ChartData;
  options: ChartOptions;
}

export interface ChartData {
  labels: string[];
  datasets: ChartDataset[];
}

export interface ChartDataset {
  label: string;
  data: number[];
  color?: string;
  backgroundColor?: string;
}

export interface ChartOptions {
  title?: string;
  showLegend?: boolean;
  showGrid?: boolean;
  stacked?: boolean;
  aspectRatio?: number;
}

export interface TableContent {
  type: 'table';
  headers: TableHeader[];
  rows: TableRow[];
  sortable?: boolean;
  pagination?: boolean;
}

export interface TableHeader {
  key: string;
  label: string;
  align?: 'left' | 'center' | 'right';
  width?: string;
}

export interface TableRow {
  [key: string]: string | number | boolean;
}

export interface TimelineContent {
  type: 'timeline';
  events: TimelineEvent[];
}

export interface TimelineEvent {
  date: Date;
  title: string;
  description?: string;
  category?: string;
  icon?: string;
}

export interface ComparisonContent {
  type: 'comparison';
  periods: ComparisonPeriod[];
  metrics: ComparisonMetric[];
}

export interface ComparisonPeriod {
  label: string;
  dateRange: DateRange;
}

export interface ComparisonMetric {
  name: string;
  values: number[];
  unit?: string;
  betterDirection?: 'higher' | 'lower';
}

export interface InsightsContent {
  type: 'insights';
  insights: InsightItem[];
}

export interface InsightItem {
  title: string;
  description: string;
  severity: 'info' | 'success' | 'warning' | 'critical';
  actionable: boolean;
}

export interface TextContent {
  type: 'text';
  content: string;
  format?: 'plain' | 'markdown' | 'html';
}

export type ExportFormat = 'pdf' | 'csv' | 'json' | 'html';

export interface ScheduledReport {
  id: string;
  reportConfig: ReportConfig;
  schedule: ReportSchedule;
  recipients: ReportRecipient[];
  enabled: boolean;
  lastRun?: Date;
  nextRun: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReportConfig {
  templateId: string;
  name: string;
  description?: string;
  dateRangePreset: DateRangePreset;
  metrics: string[];
  format: ExportFormat;
}

export interface ReportSchedule {
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly';
  dayOfWeek?: number; // 0-6 for weekly
  dayOfMonth?: number; // 1-31 for monthly
  time: string; // HH:mm format
  timezone: string;
}

export interface ReportRecipient {
  type: 'email' | 'webhook' | 'storage';
  destination: string;
  format?: ExportFormat;
}

export interface ShareableReport {
  id: string;
  reportId: string;
  shareToken: string;
  accessCount: number;
  maxAccess?: number;
  expiresAt: Date;
  password?: string;
  createdAt: Date;
}

// Report Templates
export const DEFAULT_TEMPLATES: ReportTemplate[] = [
  {
    id: 'weekly-summary',
    name: 'Weekly Summary',
    description: 'Comprehensive overview of your week',
    category: 'summary',
    icon: 'calendar-week',
    customizable: true,
    defaultDateRange: 'last_week',
    defaultMetrics: ['tasks_completed', 'focus_hours', 'meeting_hours', 'productivity_score'],
    sections: [
      { id: 'overview', title: 'Week at a Glance', type: 'summary_stats', required: true, order: 1 },
      { id: 'productivity-trend', title: 'Productivity Trend', type: 'chart', required: true, order: 2, config: { chartType: 'line' } },
      { id: 'task-breakdown', title: 'Task Breakdown', type: 'chart', required: false, order: 3, config: { chartType: 'pie' } },
      { id: 'top-achievements', title: 'Top Achievements', type: 'timeline', required: false, order: 4 },
      { id: 'insights', title: 'Key Insights', type: 'insights', required: true, order: 5 },
    ],
  },
  {
    id: 'productivity-report',
    name: 'Productivity Report',
    description: 'Detailed productivity metrics and analysis',
    category: 'productivity',
    icon: 'chart-line',
    customizable: true,
    defaultDateRange: 'last_30_days',
    defaultMetrics: ['tasks_completed', 'avg_completion_time', 'focus_hours', 'deep_work_hours', 'context_switches'],
    sections: [
      { id: 'key-metrics', title: 'Key Metrics', type: 'summary_stats', required: true, order: 1 },
      { id: 'daily-productivity', title: 'Daily Productivity', type: 'chart', required: true, order: 2, config: { chartType: 'bar' } },
      { id: 'focus-analysis', title: 'Focus Time Analysis', type: 'chart', required: true, order: 3, config: { chartType: 'area' } },
      { id: 'comparison', title: 'Period Comparison', type: 'comparison', required: false, order: 4 },
      { id: 'task-details', title: 'Task Details', type: 'table', required: false, order: 5 },
    ],
  },
  {
    id: 'goal-progress',
    name: 'Goal Progress Report',
    description: 'Track progress towards your goals',
    category: 'goals',
    icon: 'target',
    customizable: true,
    defaultDateRange: 'this_month',
    defaultMetrics: ['goals_on_track', 'goals_completed', 'goal_progress_avg'],
    sections: [
      { id: 'goal-summary', title: 'Goal Summary', type: 'summary_stats', required: true, order: 1 },
      { id: 'progress-chart', title: 'Progress Over Time', type: 'chart', required: true, order: 2, config: { chartType: 'line' } },
      { id: 'goal-breakdown', title: 'Goals by Status', type: 'chart', required: false, order: 3, config: { chartType: 'donut' } },
      { id: 'milestone-timeline', title: 'Milestone Timeline', type: 'timeline', required: false, order: 4 },
      { id: 'goal-table', title: 'All Goals', type: 'table', required: true, order: 5 },
    ],
  },
  {
    id: 'habit-tracker',
    name: 'Habit Tracker Report',
    description: 'Review your habit streaks and consistency',
    category: 'habits',
    icon: 'repeat',
    customizable: true,
    defaultDateRange: 'this_month',
    defaultMetrics: ['habit_completion_rate', 'longest_streak', 'habits_maintained'],
    sections: [
      { id: 'habit-overview', title: 'Habit Overview', type: 'summary_stats', required: true, order: 1 },
      { id: 'streak-chart', title: 'Streak Progress', type: 'chart', required: true, order: 2, config: { chartType: 'bar' } },
      { id: 'completion-heatmap', title: 'Completion Patterns', type: 'chart', required: false, order: 3 },
      { id: 'habit-table', title: 'Habit Details', type: 'table', required: true, order: 4 },
      { id: 'recommendations', title: 'Recommendations', type: 'insights', required: false, order: 5 },
    ],
  },
  {
    id: 'wellness-check',
    name: 'Wellness Check',
    description: 'Monitor work-life balance and burnout indicators',
    category: 'wellness',
    icon: 'heart',
    customizable: true,
    defaultDateRange: 'last_30_days',
    defaultMetrics: ['work_hours', 'break_time', 'burnout_risk', 'work_life_balance'],
    sections: [
      { id: 'wellness-score', title: 'Wellness Score', type: 'summary_stats', required: true, order: 1 },
      { id: 'work-hours-trend', title: 'Work Hours Trend', type: 'chart', required: true, order: 2, config: { chartType: 'line' } },
      { id: 'balance-chart', title: 'Work-Life Balance', type: 'chart', required: true, order: 3, config: { chartType: 'pie' } },
      { id: 'burnout-indicators', title: 'Burnout Indicators', type: 'insights', required: true, order: 4 },
      { id: 'recommendations', title: 'Self-Care Recommendations', type: 'text', required: false, order: 5 },
    ],
  },
];

// Report Generator Class
export class ReportGenerator extends EventEmitter {
  private templates: Map<string, ReportTemplate> = new Map();
  private reports: Map<string, Report> = new Map();
  private scheduledReports: Map<string, ScheduledReport> = new Map();
  private shareableReports: Map<string, ShareableReport> = new Map();

  constructor() {
    super();
    // Initialize default templates
    DEFAULT_TEMPLATES.forEach(template => {
      this.templates.set(template.id, template);
    });
  }

  /**
   * Get all available templates
   */
  getTemplates(): ReportTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Get a specific template
   */
  getTemplate(templateId: string): ReportTemplate | undefined {
    return this.templates.get(templateId);
  }

  /**
   * Create a custom template
   */
  createTemplate(template: Omit<ReportTemplate, 'id'>): ReportTemplate {
    const id = `custom-${Date.now()}`;
    const newTemplate: ReportTemplate = {
      ...template,
      id,
      category: 'custom',
    };
    this.templates.set(id, newTemplate);
    return newTemplate;
  }

  /**
   * Generate a report
   */
  async generateReport(
    userId: string,
    config: {
      templateId: string;
      name: string;
      description?: string;
      dateRange: DateRange;
      metrics: string[];
      format: ExportFormat;
    },
    data: ReportData
  ): Promise<Report> {
    const template = this.templates.get(config.templateId);
    if (!template) {
      throw new Error(`Template not found: ${config.templateId}`);
    }

    const reportId = `report-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Initialize report
    const report: Report = {
      id: reportId,
      name: config.name,
      description: config.description ?? template.description,
      template,
      dateRange: config.dateRange,
      metrics: [],
      sections: [],
      generatedAt: new Date(),
      generatedBy: userId,
      status: 'generating',
      format: config.format,
    };

    this.reports.set(reportId, report);
    this.emit('report-started', { reportId, userId });

    try {
      // Generate metrics
      report.metrics = this.generateMetrics(config.metrics, data);

      // Generate sections
      report.sections = await this.generateSections(template.sections, data, config.dateRange);

      // Mark as ready
      report.status = 'ready';
      this.emit('report-completed', { reportId, userId });

      return report;
    } catch (error) {
      report.status = 'failed';
      this.emit('report-failed', { reportId, userId, error });
      throw error;
    }
  }

  /**
   * Generate metrics for report
   */
  private generateMetrics(metricIds: string[], data: ReportData): ReportMetric[] {
    const metrics: ReportMetric[] = [];

    for (const metricId of metricIds) {
      const metricData = data.metrics[metricId];
      if (metricData) {
        const change = metricData.previousValue
          ? ((metricData.value as number) - (metricData.previousValue as number)) / (metricData.previousValue as number) * 100
          : undefined;

        metrics.push({
          id: metricId,
          name: metricData.name,
          value: metricData.value,
          previousValue: metricData.previousValue,
          change,
          changeDirection: change ? (change > 0 ? 'up' : change < 0 ? 'down' : 'stable') : undefined,
          unit: metricData.unit,
          format: metricData.format,
        });
      }
    }

    return metrics;
  }

  /**
   * Generate sections for report
   */
  private async generateSections(
    sectionConfigs: TemplateSectionConfig[],
    data: ReportData,
    dateRange: DateRange
  ): Promise<ReportSection[]> {
    const sections: ReportSection[] = [];

    for (const config of sectionConfigs.sort((a, b) => a.order - b.order)) {
      const content = await this.generateSectionContent(config, data, dateRange);
      if (content) {
        sections.push({
          id: config.id,
          title: config.title,
          type: config.type,
          content,
          order: config.order,
        });
      }
    }

    return sections;
  }

  /**
   * Generate content for a section
   */
  private async generateSectionContent(
    config: TemplateSectionConfig,
    data: ReportData,
    dateRange: DateRange
  ): Promise<SectionContent | null> {
    switch (config.type) {
      case 'summary_stats':
        return this.generateSummaryStats(data);

      case 'chart':
        return this.generateChartContent(config, data);

      case 'table':
        return this.generateTableContent(data);

      case 'timeline':
        return this.generateTimelineContent(data);

      case 'comparison':
        return this.generateComparisonContent(data, dateRange);

      case 'insights':
        return this.generateInsightsContent(data);

      case 'text':
        return this.generateTextContent(data);

      default:
        return null;
    }
  }

  private generateSummaryStats(data: ReportData): SummaryStatsContent {
    const stats: StatItem[] = Object.entries(data.metrics).slice(0, 6).map(([id, metric]) => ({
      label: metric.name,
      value: metric.value,
      change: metric.previousValue
        ? ((metric.value as number) - (metric.previousValue as number)) / (metric.previousValue as number) * 100
        : undefined,
    }));

    return { type: 'summary_stats', stats };
  }

  private generateChartContent(config: TemplateSectionConfig, data: ReportData): ChartContent {
    const chartType = config.config?.chartType ?? 'line';

    return {
      type: 'chart',
      chartType,
      data: data.chartData ?? { labels: [], datasets: [] },
      options: {
        title: config.title,
        showLegend: true,
        showGrid: true,
      },
    };
  }

  private generateTableContent(data: ReportData): TableContent {
    return {
      type: 'table',
      headers: data.tableHeaders ?? [],
      rows: data.tableRows ?? [],
      sortable: true,
      pagination: true,
    };
  }

  private generateTimelineContent(data: ReportData): TimelineContent {
    return {
      type: 'timeline',
      events: data.timelineEvents ?? [],
    };
  }

  private generateComparisonContent(data: ReportData, dateRange: DateRange): ComparisonContent {
    const previousStart = new Date(dateRange.start);
    const duration = dateRange.end.getTime() - dateRange.start.getTime();
    previousStart.setTime(previousStart.getTime() - duration);

    const previousEnd = new Date(dateRange.start);
    previousEnd.setTime(previousEnd.getTime() - 1);

    return {
      type: 'comparison',
      periods: [
        { label: 'Current Period', dateRange },
        { label: 'Previous Period', dateRange: { start: previousStart, end: previousEnd } },
      ],
      metrics: data.comparisonMetrics ?? [],
    };
  }

  private generateInsightsContent(data: ReportData): InsightsContent {
    return {
      type: 'insights',
      insights: data.insights ?? [],
    };
  }

  private generateTextContent(data: ReportData): TextContent {
    return {
      type: 'text',
      content: data.textContent ?? '',
      format: 'markdown',
    };
  }

  /**
   * Export report to specified format
   */
  async exportReport(reportId: string, format?: ExportFormat): Promise<ExportResult> {
    const report = this.reports.get(reportId);
    if (!report) {
      throw new Error(`Report not found: ${reportId}`);
    }

    const exportFormat = format ?? report.format;

    switch (exportFormat) {
      case 'pdf':
        return this.exportToPDF(report);
      case 'csv':
        return this.exportToCSV(report);
      case 'json':
        return this.exportToJSON(report);
      case 'html':
        return this.exportToHTML(report);
      default:
        throw new Error(`Unsupported format: ${exportFormat}`);
    }
  }

  private async exportToPDF(report: Report): Promise<ExportResult> {
    // Generate PDF content
    const pdfContent = this.generatePDFContent(report);

    return {
      format: 'pdf',
      mimeType: 'application/pdf',
      filename: `${this.sanitizeFilename(report.name)}-${this.formatDate(report.generatedAt)}.pdf`,
      content: pdfContent,
      size: pdfContent.length,
    };
  }

  private generatePDFContent(report: Report): string {
    // In a real implementation, this would use a PDF library
    // For now, return a placeholder that represents the PDF structure
    const sections = report.sections.map(s => {
      return `
## ${s.title}

${this.formatSectionContent(s.content)}
`;
    }).join('\n\n');

    return `
# ${report.name}

Generated: ${report.generatedAt.toISOString()}
Period: ${report.dateRange.start.toISOString()} - ${report.dateRange.end.toISOString()}

## Key Metrics

${report.metrics.map(m => `- ${m.name}: ${m.value}${m.change ? ` (${m.change > 0 ? '+' : ''}${m.change.toFixed(1)}%)` : ''}`).join('\n')}

${sections}
`;
  }

  private async exportToCSV(report: Report): Promise<ExportResult> {
    const lines: string[] = [];

    // Header
    lines.push('Section,Metric,Value,Change');

    // Metrics
    for (const metric of report.metrics) {
      lines.push(`Metrics,${metric.name},${metric.value},${metric.change ?? ''}`);
    }

    // Table sections
    for (const section of report.sections) {
      if (section.content.type === 'table') {
        const tableContent = section.content as TableContent;
        lines.push(''); // Empty line
        lines.push(tableContent.headers.map(h => h.label).join(','));
        for (const row of tableContent.rows) {
          lines.push(tableContent.headers.map(h => String(row[h.key] ?? '')).join(','));
        }
      }
    }

    const csvContent = lines.join('\n');

    return {
      format: 'csv',
      mimeType: 'text/csv',
      filename: `${this.sanitizeFilename(report.name)}-${this.formatDate(report.generatedAt)}.csv`,
      content: csvContent,
      size: csvContent.length,
    };
  }

  private async exportToJSON(report: Report): Promise<ExportResult> {
    const jsonContent = JSON.stringify(report, null, 2);

    return {
      format: 'json',
      mimeType: 'application/json',
      filename: `${this.sanitizeFilename(report.name)}-${this.formatDate(report.generatedAt)}.json`,
      content: jsonContent,
      size: jsonContent.length,
    };
  }

  private async exportToHTML(report: Report): Promise<ExportResult> {
    const htmlContent = this.generateHTMLContent(report);

    return {
      format: 'html',
      mimeType: 'text/html',
      filename: `${this.sanitizeFilename(report.name)}-${this.formatDate(report.generatedAt)}.html`,
      content: htmlContent,
      size: htmlContent.length,
    };
  }

  private generateHTMLContent(report: Report): string {
    const metricsHTML = report.metrics.map(m => `
      <div class="metric-card">
        <div class="metric-name">${m.name}</div>
        <div class="metric-value">${m.value}</div>
        ${m.change ? `<div class="metric-change ${m.changeDirection}">${m.change > 0 ? '+' : ''}${m.change.toFixed(1)}%</div>` : ''}
      </div>
    `).join('');

    const sectionsHTML = report.sections.map(s => `
      <section class="report-section">
        <h2>${s.title}</h2>
        <div class="section-content">
          ${this.formatSectionContentHTML(s.content)}
        </div>
      </section>
    `).join('');

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${report.name}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    h1 { margin: 0 0 10px; color: #1a1a1a; }
    .meta { color: #666; margin-bottom: 30px; }
    .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 40px; }
    .metric-card { background: #f8f9fa; padding: 20px; border-radius: 8px; }
    .metric-name { font-size: 14px; color: #666; margin-bottom: 5px; }
    .metric-value { font-size: 24px; font-weight: 600; color: #1a1a1a; }
    .metric-change { font-size: 14px; margin-top: 5px; }
    .metric-change.up { color: #22c55e; }
    .metric-change.down { color: #ef4444; }
    .metric-change.stable { color: #666; }
    .report-section { margin-bottom: 40px; }
    .report-section h2 { color: #1a1a1a; border-bottom: 2px solid #e5e5e5; padding-bottom: 10px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e5e5e5; }
    th { background: #f8f9fa; font-weight: 600; }
    .insight { padding: 15px; border-radius: 8px; margin-bottom: 10px; }
    .insight.info { background: #e0f2fe; }
    .insight.success { background: #dcfce7; }
    .insight.warning { background: #fef3c7; }
    .insight.critical { background: #fee2e2; }
  </style>
</head>
<body>
  <div class="container">
    <h1>${report.name}</h1>
    <div class="meta">
      Generated: ${report.generatedAt.toLocaleDateString()} |
      Period: ${report.dateRange.start.toLocaleDateString()} - ${report.dateRange.end.toLocaleDateString()}
    </div>

    <div class="metrics-grid">
      ${metricsHTML}
    </div>

    ${sectionsHTML}
  </div>
</body>
</html>
`;
  }

  private formatSectionContent(content: SectionContent): string {
    switch (content.type) {
      case 'summary_stats':
        return (content as SummaryStatsContent).stats
          .map(s => `- ${s.label}: ${s.value}`)
          .join('\n');

      case 'table':
        const table = content as TableContent;
        const headerRow = table.headers.map(h => h.label).join(' | ');
        const divider = table.headers.map(() => '---').join(' | ');
        const rows = table.rows.map(r =>
          table.headers.map(h => String(r[h.key] ?? '')).join(' | ')
        ).join('\n');
        return `${headerRow}\n${divider}\n${rows}`;

      case 'insights':
        return (content as InsightsContent).insights
          .map(i => `[${i.severity.toUpperCase()}] ${i.title}: ${i.description}`)
          .join('\n\n');

      case 'text':
        return (content as TextContent).content;

      default:
        return '[Chart or visual content - see HTML/PDF export]';
    }
  }

  private formatSectionContentHTML(content: SectionContent): string {
    switch (content.type) {
      case 'summary_stats':
        return `<div class="metrics-grid">${(content as SummaryStatsContent).stats
          .map(s => `<div class="metric-card"><div class="metric-name">${s.label}</div><div class="metric-value">${s.value}</div></div>`)
          .join('')}</div>`;

      case 'table':
        const table = content as TableContent;
        return `
          <table>
            <thead><tr>${table.headers.map(h => `<th>${h.label}</th>`).join('')}</tr></thead>
            <tbody>${table.rows.map(r =>
              `<tr>${table.headers.map(h => `<td>${r[h.key] ?? ''}</td>`).join('')}</tr>`
            ).join('')}</tbody>
          </table>
        `;

      case 'insights':
        return (content as InsightsContent).insights
          .map(i => `<div class="insight ${i.severity}"><strong>${i.title}</strong><p>${i.description}</p></div>`)
          .join('');

      case 'text':
        return `<div class="text-content">${(content as TextContent).content}</div>`;

      default:
        return '<p>[Chart visualization would appear here]</p>';
    }
  }

  /**
   * Schedule a recurring report
   */
  scheduleReport(userId: string, config: {
    reportConfig: ReportConfig;
    schedule: ReportSchedule;
    recipients: ReportRecipient[];
  }): ScheduledReport {
    const id = `scheduled-${Date.now()}`;
    const nextRun = this.calculateNextRun(config.schedule);

    const scheduled: ScheduledReport = {
      id,
      reportConfig: config.reportConfig,
      schedule: config.schedule,
      recipients: config.recipients,
      enabled: true,
      nextRun,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.scheduledReports.set(id, scheduled);
    this.emit('report-scheduled', { id, userId });

    return scheduled;
  }

  /**
   * Update scheduled report
   */
  updateScheduledReport(id: string, updates: Partial<ScheduledReport>): ScheduledReport {
    const scheduled = this.scheduledReports.get(id);
    if (!scheduled) {
      throw new Error(`Scheduled report not found: ${id}`);
    }

    const updated: ScheduledReport = {
      ...scheduled,
      ...updates,
      updatedAt: new Date(),
    };

    if (updates.schedule) {
      updated.nextRun = this.calculateNextRun(updates.schedule);
    }

    this.scheduledReports.set(id, updated);
    return updated;
  }

  /**
   * Delete scheduled report
   */
  deleteScheduledReport(id: string): void {
    this.scheduledReports.delete(id);
    this.emit('report-unscheduled', { id });
  }

  /**
   * Get scheduled reports for a user
   */
  getScheduledReports(): ScheduledReport[] {
    return Array.from(this.scheduledReports.values());
  }

  /**
   * Create a shareable link for a report
   */
  createShareLink(reportId: string, options: {
    expiresIn?: number; // Hours
    maxAccess?: number;
    password?: string;
  } = {}): ShareableReport {
    const report = this.reports.get(reportId);
    if (!report) {
      throw new Error(`Report not found: ${reportId}`);
    }

    const shareToken = this.generateShareToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + (options.expiresIn ?? 168)); // Default 7 days

    const shareable: ShareableReport = {
      id: `share-${Date.now()}`,
      reportId,
      shareToken,
      accessCount: 0,
      maxAccess: options.maxAccess,
      expiresAt,
      password: options.password,
      createdAt: new Date(),
    };

    this.shareableReports.set(shareToken, shareable);

    // Update report with share link
    report.shareLink = `/reports/shared/${shareToken}`;
    report.expiresAt = expiresAt;

    return shareable;
  }

  /**
   * Access a shared report
   */
  accessSharedReport(shareToken: string, password?: string): Report {
    const shareable = this.shareableReports.get(shareToken);
    if (!shareable) {
      throw new Error('Invalid share link');
    }

    if (new Date() > shareable.expiresAt) {
      throw new Error('Share link has expired');
    }

    if (shareable.maxAccess && shareable.accessCount >= shareable.maxAccess) {
      throw new Error('Maximum access limit reached');
    }

    if (shareable.password && shareable.password !== password) {
      throw new Error('Invalid password');
    }

    const report = this.reports.get(shareable.reportId);
    if (!report) {
      throw new Error('Report no longer exists');
    }

    // Increment access count
    shareable.accessCount++;

    return report;
  }

  /**
   * Revoke a share link
   */
  revokeShareLink(shareToken: string): void {
    this.shareableReports.delete(shareToken);
  }

  // Helper methods
  private calculateNextRun(schedule: ReportSchedule): Date {
    const now = new Date();
    const [hours, minutes] = schedule.time.split(':').map(Number);

    const next = new Date(now);
    next.setHours(hours, minutes, 0, 0);

    if (next <= now) {
      // Move to next occurrence
      switch (schedule.frequency) {
        case 'daily':
          next.setDate(next.getDate() + 1);
          break;
        case 'weekly':
          const daysUntilNext = ((schedule.dayOfWeek ?? 1) - now.getDay() + 7) % 7 || 7;
          next.setDate(next.getDate() + daysUntilNext);
          break;
        case 'biweekly':
          const daysUntilBiweekly = ((schedule.dayOfWeek ?? 1) - now.getDay() + 14) % 14 || 14;
          next.setDate(next.getDate() + daysUntilBiweekly);
          break;
        case 'monthly':
          next.setMonth(next.getMonth() + 1);
          next.setDate(schedule.dayOfMonth ?? 1);
          break;
        case 'quarterly':
          next.setMonth(next.getMonth() + 3);
          next.setDate(schedule.dayOfMonth ?? 1);
          break;
      }
    }

    return next;
  }

  private generateShareToken(): string {
    return Array.from({ length: 32 }, () =>
      Math.random().toString(36).charAt(2)
    ).join('');
  }

  private sanitizeFilename(name: string): string {
    return name.replace(/[^a-z0-9]/gi, '-').toLowerCase();
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  /**
   * Get date range from preset
   */
  getDateRangeFromPreset(preset: DateRangePreset): DateRange {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (preset) {
      case 'today':
        return { start: today, end: now, preset };

      case 'yesterday':
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        return { start: yesterday, end: today, preset };

      case 'this_week':
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay());
        return { start: weekStart, end: now, preset };

      case 'last_week':
        const lastWeekEnd = new Date(today);
        lastWeekEnd.setDate(today.getDate() - today.getDay());
        const lastWeekStart = new Date(lastWeekEnd);
        lastWeekStart.setDate(lastWeekStart.getDate() - 7);
        return { start: lastWeekStart, end: lastWeekEnd, preset };

      case 'this_month':
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        return { start: monthStart, end: now, preset };

      case 'last_month':
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        return { start: lastMonthStart, end: lastMonthEnd, preset };

      case 'this_quarter':
        const quarterMonth = Math.floor(now.getMonth() / 3) * 3;
        const quarterStart = new Date(now.getFullYear(), quarterMonth, 1);
        return { start: quarterStart, end: now, preset };

      case 'last_quarter':
        const lastQuarterMonth = Math.floor(now.getMonth() / 3) * 3 - 3;
        const lastQuarterStart = new Date(now.getFullYear(), lastQuarterMonth, 1);
        const lastQuarterEnd = new Date(now.getFullYear(), lastQuarterMonth + 3, 1);
        return { start: lastQuarterStart, end: lastQuarterEnd, preset };

      case 'this_year':
        const yearStart = new Date(now.getFullYear(), 0, 1);
        return { start: yearStart, end: now, preset };

      case 'last_year':
        const lastYearStart = new Date(now.getFullYear() - 1, 0, 1);
        const lastYearEnd = new Date(now.getFullYear(), 0, 1);
        return { start: lastYearStart, end: lastYearEnd, preset };

      case 'last_7_days':
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        return { start: sevenDaysAgo, end: now, preset };

      case 'last_30_days':
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        return { start: thirtyDaysAgo, end: now, preset };

      case 'last_90_days':
        const ninetyDaysAgo = new Date(today);
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        return { start: ninetyDaysAgo, end: now, preset };

      default:
        return { start: today, end: now, preset: 'custom' };
    }
  }
}

// Additional types
export interface ReportData {
  metrics: Record<string, {
    name: string;
    value: number | string;
    previousValue?: number | string;
    unit?: string;
    format?: 'number' | 'percentage' | 'duration' | 'currency';
  }>;
  chartData?: ChartData;
  tableHeaders?: TableHeader[];
  tableRows?: TableRow[];
  timelineEvents?: TimelineEvent[];
  comparisonMetrics?: ComparisonMetric[];
  insights?: InsightItem[];
  textContent?: string;
}

export interface ExportResult {
  format: ExportFormat;
  mimeType: string;
  filename: string;
  content: string;
  size: number;
}

// Export singleton instance
export const reportGenerator = new ReportGenerator();

export default ReportGenerator;
