/**
 * ORACLE Data Export Service
 * Story adv-28 - Comprehensive data export capability
 */

// Export types
export type ExportFormat = 'json' | 'csv' | 'pdf';
export type ExportType = 'decisions' | 'predictions' | 'analytics' | 'journal' | 'signals' | 'scenarios' | 'all';

export interface ExportRequest {
  type: ExportType;
  format: ExportFormat;
  user_id: string;
  date_range?: {
    start: string;
    end: string;
  };
  include_metadata?: boolean;
  anonymize?: boolean;
}

export interface ExportResult {
  filename: string;
  content: string | Buffer;
  content_type: string;
  size: number;
  record_count: number;
  generated_at: string;
}

// In-memory data stores (mock data for demo)
const mockDecisions = [
  {
    id: 'd1',
    title: 'Quarterly Budget Allocation',
    status: 'decided',
    selected_option: 'Balanced Approach',
    confidence: 0.85,
    outcome: 'success',
    created_at: '2026-01-15T10:00:00Z',
    decided_at: '2026-01-16T14:00:00Z',
  },
  {
    id: 'd2',
    title: 'Team Expansion Decision',
    status: 'pending',
    options: ['Hire 2 FTE', 'Use Contractors', 'Defer'],
    confidence: 0.72,
    created_at: '2026-01-28T09:00:00Z',
  },
];

const mockPredictions = [
  {
    id: 'p1',
    subject: 'Q1 Revenue Target',
    predicted_probability: 0.78,
    actual_outcome: true,
    is_accurate: true,
    category: 'financial',
    created_at: '2026-01-10T08:00:00Z',
  },
  {
    id: 'p2',
    subject: 'Project Deadline',
    predicted_probability: 0.65,
    actual_outcome: false,
    is_accurate: false,
    category: 'project',
    created_at: '2026-01-20T11:00:00Z',
  },
];

const mockAnalytics = {
  summary: {
    total_decisions: 15,
    total_predictions: 42,
    accuracy_rate: 0.76,
    sessions: 28,
  },
  daily_activity: [
    { date: '2026-01-25', decisions: 2, predictions: 5, signals: 8 },
    { date: '2026-01-26', decisions: 1, predictions: 3, signals: 12 },
    { date: '2026-01-27', decisions: 3, predictions: 6, signals: 5 },
  ],
  feature_usage: {
    radar_scans: 45,
    simulations: 23,
    ghost_actions: 12,
  },
};

const mockJournal = [
  {
    id: 'j1',
    title: 'Marketing Strategy Decision',
    decision_date: '2026-01-12',
    outcome_status: 'success',
    lessons_learned: ['Early testing validated approach', 'Team buy-in was crucial'],
    tags: ['marketing', 'strategy'],
  },
];

const mockSignals = [
  {
    id: 's1',
    title: 'Budget Deadline Approaching',
    type: 'deadline',
    urgency: 'high',
    status: 'acknowledged',
    created_at: '2026-01-28T08:00:00Z',
  },
  {
    id: 's2',
    title: 'New Partnership Opportunity',
    type: 'opportunity',
    urgency: 'medium',
    status: 'investigating',
    created_at: '2026-01-27T14:00:00Z',
  },
];

class DataExportService {
  /**
   * Export data based on request parameters
   */
  async exportData(request: ExportRequest): Promise<ExportResult> {
    const data = await this.gatherData(request);
    const filteredData = this.filterByDateRange(data, request.date_range);
    const processedData = request.anonymize ? this.anonymizeData(filteredData) : filteredData;

    switch (request.format) {
      case 'json':
        return this.exportAsJson(processedData, request);
      case 'csv':
        return this.exportAsCsv(processedData, request);
      case 'pdf':
        return this.exportAsPdf(processedData, request);
      default:
        throw new Error(`Unsupported format: ${request.format}`);
    }
  }

  /**
   * Gather data based on export type
   */
  private async gatherData(request: ExportRequest): Promise<any> {
    switch (request.type) {
      case 'decisions':
        return { decisions: mockDecisions };
      case 'predictions':
        return { predictions: mockPredictions };
      case 'analytics':
        return { analytics: mockAnalytics };
      case 'journal':
        return { journal: mockJournal };
      case 'signals':
        return { signals: mockSignals };
      case 'scenarios':
        return { scenarios: [] }; // Would fetch from scenarioPlanningService
      case 'all':
        return {
          decisions: mockDecisions,
          predictions: mockPredictions,
          analytics: mockAnalytics,
          journal: mockJournal,
          signals: mockSignals,
        };
      default:
        throw new Error(`Unknown export type: ${request.type}`);
    }
  }

  /**
   * Filter data by date range
   */
  private filterByDateRange(data: any, dateRange?: { start: string; end: string }): any {
    if (!dateRange) return data;

    const start = new Date(dateRange.start);
    const end = new Date(dateRange.end);

    const filterArray = (arr: any[]) => {
      return arr.filter(item => {
        const date = new Date(item.created_at || item.decision_date || item.date);
        return date >= start && date <= end;
      });
    };

    const filtered: any = {};
    for (const [key, value] of Object.entries(data)) {
      if (Array.isArray(value)) {
        filtered[key] = filterArray(value);
      } else {
        filtered[key] = value;
      }
    }

    return filtered;
  }

  /**
   * Anonymize sensitive data
   */
  private anonymizeData(data: any): any {
    const anonymize = (obj: any): any => {
      if (Array.isArray(obj)) {
        return obj.map(anonymize);
      }
      if (obj && typeof obj === 'object') {
        const result: any = {};
        for (const [key, value] of Object.entries(obj)) {
          // Remove or anonymize sensitive fields
          if (['user_id', 'email', 'name', 'phone'].includes(key)) {
            result[key] = '[REDACTED]';
          } else if (key === 'id') {
            result[key] = this.hashId(value as string);
          } else {
            result[key] = anonymize(value);
          }
        }
        return result;
      }
      return obj;
    };

    return anonymize(data);
  }

  /**
   * Hash ID for anonymization
   */
  private hashId(id: string): string {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      const char = id.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `anon-${Math.abs(hash).toString(16)}`;
  }

  /**
   * Export as JSON
   */
  private exportAsJson(data: any, request: ExportRequest): ExportResult {
    const exportData = {
      export_info: {
        type: request.type,
        generated_at: new Date().toISOString(),
        date_range: request.date_range || 'all_time',
        anonymized: request.anonymize || false,
      },
      data,
    };

    const content = JSON.stringify(exportData, null, 2);

    return {
      filename: `oracle_${request.type}_${Date.now()}.json`,
      content,
      content_type: 'application/json',
      size: Buffer.byteLength(content, 'utf-8'),
      record_count: this.countRecords(data),
      generated_at: new Date().toISOString(),
    };
  }

  /**
   * Export as CSV
   */
  private exportAsCsv(data: any, request: ExportRequest): ExportResult {
    const lines: string[] = [];
    let recordCount = 0;

    for (const [type, records] of Object.entries(data)) {
      if (Array.isArray(records) && records.length > 0) {
        // Add section header
        lines.push(`\n# ${type.toUpperCase()}`);

        // Get all unique keys from all records
        const allKeys = new Set<string>();
        records.forEach((record: any) => {
          Object.keys(record).forEach(key => allKeys.add(key));
        });
        const headers = Array.from(allKeys);

        // Add headers
        lines.push(headers.join(','));

        // Add data rows
        records.forEach((record: any) => {
          const values = headers.map(header => {
            const value = record[header];
            if (value === undefined || value === null) return '';
            if (Array.isArray(value)) return `"${value.join('; ')}"`;
            if (typeof value === 'object') return `"${JSON.stringify(value)}"`;
            if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
              return `"${value.replace(/"/g, '""')}"`;
            }
            return String(value);
          });
          lines.push(values.join(','));
          recordCount++;
        });
      }
    }

    const content = lines.join('\n');

    return {
      filename: `oracle_${request.type}_${Date.now()}.csv`,
      content,
      content_type: 'text/csv',
      size: Buffer.byteLength(content, 'utf-8'),
      record_count: recordCount,
      generated_at: new Date().toISOString(),
    };
  }

  /**
   * Export as PDF (generates markdown that could be converted to PDF)
   */
  private exportAsPdf(data: any, request: ExportRequest): ExportResult {
    const lines: string[] = [];

    // Header
    lines.push('# ORACLE Data Export Report');
    lines.push('');
    lines.push(`**Export Type:** ${request.type}`);
    lines.push(`**Generated:** ${new Date().toISOString()}`);
    if (request.date_range) {
      lines.push(`**Date Range:** ${request.date_range.start} to ${request.date_range.end}`);
    }
    lines.push('');
    lines.push('---');
    lines.push('');

    let recordCount = 0;

    // Decisions
    if (data.decisions) {
      lines.push('## Decisions');
      lines.push('');
      data.decisions.forEach((d: any) => {
        lines.push(`### ${d.title}`);
        lines.push(`- **Status:** ${d.status}`);
        lines.push(`- **Confidence:** ${Math.round((d.confidence || 0) * 100)}%`);
        if (d.selected_option) lines.push(`- **Selected Option:** ${d.selected_option}`);
        if (d.outcome) lines.push(`- **Outcome:** ${d.outcome}`);
        lines.push(`- **Created:** ${d.created_at}`);
        lines.push('');
        recordCount++;
      });
    }

    // Predictions
    if (data.predictions) {
      lines.push('## Predictions');
      lines.push('');
      lines.push('| Subject | Probability | Outcome | Accurate | Category |');
      lines.push('|---------|-------------|---------|----------|----------|');
      data.predictions.forEach((p: any) => {
        const prob = Math.round((p.predicted_probability || 0) * 100);
        const outcome = p.actual_outcome !== undefined ? (p.actual_outcome ? 'Yes' : 'No') : '-';
        const accurate = p.is_accurate !== undefined ? (p.is_accurate ? 'Yes' : 'No') : '-';
        lines.push(`| ${p.subject} | ${prob}% | ${outcome} | ${accurate} | ${p.category} |`);
        recordCount++;
      });
      lines.push('');
    }

    // Analytics
    if (data.analytics) {
      lines.push('## Analytics Summary');
      lines.push('');
      const summary = data.analytics.summary;
      lines.push(`- **Total Decisions:** ${summary.total_decisions}`);
      lines.push(`- **Total Predictions:** ${summary.total_predictions}`);
      lines.push(`- **Accuracy Rate:** ${Math.round(summary.accuracy_rate * 100)}%`);
      lines.push(`- **Sessions:** ${summary.sessions}`);
      lines.push('');

      if (data.analytics.feature_usage) {
        lines.push('### Feature Usage');
        const usage = data.analytics.feature_usage;
        lines.push(`- Radar Scans: ${usage.radar_scans}`);
        lines.push(`- Simulations: ${usage.simulations}`);
        lines.push(`- Ghost Actions: ${usage.ghost_actions}`);
        lines.push('');
      }
    }

    // Journal
    if (data.journal) {
      lines.push('## Decision Journal');
      lines.push('');
      data.journal.forEach((j: any) => {
        lines.push(`### ${j.title}`);
        lines.push(`- **Date:** ${j.decision_date}`);
        lines.push(`- **Outcome:** ${j.outcome_status}`);
        if (j.lessons_learned && j.lessons_learned.length > 0) {
          lines.push('- **Lessons Learned:**');
          j.lessons_learned.forEach((lesson: string) => {
            lines.push(`  - ${lesson}`);
          });
        }
        if (j.tags && j.tags.length > 0) {
          lines.push(`- **Tags:** ${j.tags.join(', ')}`);
        }
        lines.push('');
        recordCount++;
      });
    }

    // Signals
    if (data.signals) {
      lines.push('## Signals');
      lines.push('');
      lines.push('| Title | Type | Urgency | Status |');
      lines.push('|-------|------|---------|--------|');
      data.signals.forEach((s: any) => {
        lines.push(`| ${s.title} | ${s.type} | ${s.urgency} | ${s.status} |`);
        recordCount++;
      });
      lines.push('');
    }

    // Footer
    lines.push('---');
    lines.push('');
    lines.push(`*Generated by ORACLE Data Export Service*`);
    lines.push(`*Total Records: ${recordCount}*`);

    const content = lines.join('\n');

    return {
      filename: `oracle_${request.type}_${Date.now()}.md`,
      content,
      content_type: 'text/markdown', // In production, would convert to PDF
      size: Buffer.byteLength(content, 'utf-8'),
      record_count: recordCount,
      generated_at: new Date().toISOString(),
    };
  }

  /**
   * Count total records in data
   */
  private countRecords(data: any): number {
    let count = 0;
    for (const value of Object.values(data)) {
      if (Array.isArray(value)) {
        count += value.length;
      } else if (value && typeof value === 'object') {
        count++;
      }
    }
    return count;
  }

  /**
   * Get available export types
   */
  getExportTypes(): Array<{ type: ExportType; label: string; description: string }> {
    return [
      { type: 'decisions', label: 'Decisions', description: 'All ORACLE decisions with options and outcomes' },
      { type: 'predictions', label: 'Predictions', description: 'Prediction history with accuracy tracking' },
      { type: 'analytics', label: 'Analytics', description: 'Usage metrics and performance data' },
      { type: 'journal', label: 'Journal', description: 'Decision journal entries and reflections' },
      { type: 'signals', label: 'Signals', description: 'Detected signals and their status' },
      { type: 'scenarios', label: 'Scenarios', description: 'What-if scenarios and analysis' },
      { type: 'all', label: 'Complete Export', description: 'All ORACLE data in one export' },
    ];
  }

  /**
   * Get available export formats
   */
  getExportFormats(): Array<{ format: ExportFormat; label: string; description: string }> {
    return [
      { format: 'json', label: 'JSON', description: 'Structured data format, best for backups and imports' },
      { format: 'csv', label: 'CSV', description: 'Spreadsheet compatible, best for analysis in Excel' },
      { format: 'pdf', label: 'PDF Report', description: 'Formatted report, best for sharing and printing' },
    ];
  }

  /**
   * Estimate export size
   */
  async estimateExportSize(request: ExportRequest): Promise<{ estimated_records: number; estimated_size_kb: number }> {
    const data = await this.gatherData(request);
    const filteredData = this.filterByDateRange(data, request.date_range);
    const recordCount = this.countRecords(filteredData);

    // Rough estimates based on format
    let sizePerRecord = 200; // bytes
    if (request.format === 'json') sizePerRecord = 400;
    if (request.format === 'pdf') sizePerRecord = 300;

    return {
      estimated_records: recordCount,
      estimated_size_kb: Math.ceil((recordCount * sizePerRecord) / 1024),
    };
  }
}

export const dataExportService = new DataExportService();
