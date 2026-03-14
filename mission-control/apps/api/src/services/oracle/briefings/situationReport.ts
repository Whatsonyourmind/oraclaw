/**
 * ORACLE Situation Report (SITREP) Generator Service
 * Real-time situation assessment and critical issue reporting
 *
 * Features:
 * - Real-time situation assessment
 * - Critical issues summary
 * - Resource status
 * - Risk matrix
 * - Recommended actions
 * - Escalation requirements
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

export type SeverityLevel = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type TrendDirection = 'improving' | 'stable' | 'degrading' | 'volatile';
export type EscalationLevel = 'none' | 'team_lead' | 'manager' | 'director' | 'executive' | 'external';

export interface SituationOverview {
  status: 'normal' | 'elevated' | 'alert' | 'critical';
  summary: string;
  last_updated: string;
  trend: TrendDirection;
  confidence: number;
  key_metrics: {
    name: string;
    value: number | string;
    status: SeverityLevel;
    change?: number;
  }[];
}

export interface CriticalIssue {
  id: string;
  title: string;
  severity: SeverityLevel;
  category: string;
  description: string;
  impact: string;
  affected_areas: string[];
  started_at: string;
  duration_hours: number;
  trend: TrendDirection;
  owner?: string;
  status: 'new' | 'investigating' | 'mitigating' | 'resolved' | 'monitoring';
  actions_taken?: string[];
  next_update?: string;
}

export interface ResourceStatus {
  id: string;
  name: string;
  type: 'human' | 'infrastructure' | 'financial' | 'equipment' | 'vendor';
  status: 'available' | 'limited' | 'constrained' | 'unavailable';
  utilization_percent?: number;
  capacity?: number;
  current_usage?: number;
  alerts?: string[];
  forecast?: {
    trend: TrendDirection;
    prediction: string;
  };
}

export interface RiskMatrixItem {
  id: string;
  title: string;
  description: string;
  probability: number; // 0-1
  impact: number; // 1-5
  risk_score: number; // probability * impact
  severity: SeverityLevel;
  category: string;
  triggers?: string[];
  mitigations?: string[];
  owner?: string;
  contingency?: string;
  last_assessed: string;
}

export interface RecommendedAction {
  id: string;
  priority: 'immediate' | 'urgent' | 'standard' | 'optional';
  action: string;
  description: string;
  rationale: string;
  assigned_to?: string;
  due_by?: string;
  dependencies?: string[];
  estimated_effort?: string;
  expected_outcome: string;
  risk_if_delayed?: string;
}

export interface EscalationRequirement {
  id: string;
  level: EscalationLevel;
  issue_id: string;
  reason: string;
  urgency: 'immediate' | 'within_hour' | 'within_day' | 'scheduled';
  contacts: {
    name: string;
    role: string;
    channel: string;
  }[];
  escalated: boolean;
  escalated_at?: string;
  response?: string;
}

export interface SitrepSection {
  title: string;
  status: SeverityLevel;
  highlights: string[];
  data?: any;
}

export interface SitrepData {
  user_id: string;
  generated_at: string;
  situation_overview: SituationOverview;
  critical_issues: CriticalIssue[];
  resource_status: ResourceStatus[];
  risk_matrix: RiskMatrixItem[];
  recommended_actions: RecommendedAction[];
  escalation_requirements: EscalationRequirement[];
  additional_sections?: SitrepSection[];
}

export interface SitrepResult {
  briefing: RenderedBriefing;
  raw_data: SitrepData;
  generated_at: string;
  severity_summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  requires_immediate_action: boolean;
  escalation_needed: boolean;
  audio_script?: string;
}

// ============================================================================
// Cache TTLs
// ============================================================================

const SITREP_CACHE_TTL = {
  normal: 15 * 60 * 1000, // 15 minutes for normal situations
  elevated: 5 * 60 * 1000, // 5 minutes for elevated
  alert: 2 * 60 * 1000, // 2 minutes for alert
  critical: 30 * 1000, // 30 seconds for critical
};

// ============================================================================
// Situation Report Service
// ============================================================================

export class SituationReportService {
  /**
   * Generate a situation report
   */
  async generateSitrep(
    userId: string,
    options: {
      template_id?: string;
      format?: BriefingFormat;
      include_all_resources?: boolean;
      scope?: string[];
    } = {}
  ): Promise<SitrepResult> {
    // Gather current situation data
    const data = await this.gatherSitrepData(userId, options);

    // Determine cache TTL based on situation severity
    const cacheTTL = SITREP_CACHE_TTL[data.situation_overview.status];
    const cacheKeyStr = cacheKey('sitrep', userId, hashObject(options));

    const cached = oracleCacheService.get<SitrepResult>(cacheKeyStr);
    if (cached) return cached;

    // Get template
    const template = options.template_id
      ? await briefingTemplatesService.getTemplate(options.template_id, userId)
      : await briefingTemplatesService.getDefaultTemplate(userId, 'sitrep');

    if (!template) {
      throw new Error('No SITREP template found');
    }

    // Generate briefing
    const briefing = this.renderSitrep(template, data, options.format || template.default_format);

    // Calculate severity summary
    const severitySummary = this.calculateSeveritySummary(data);

    // Determine if immediate action needed
    const requiresImmediateAction = data.recommended_actions.some((a) => a.priority === 'immediate') ||
      data.critical_issues.some((i) => i.severity === 'critical' && i.status !== 'resolved');

    // Determine if escalation needed
    const escalationNeeded = data.escalation_requirements.some((e) => !e.escalated);

    const result: SitrepResult = {
      briefing,
      raw_data: data,
      generated_at: new Date().toISOString(),
      severity_summary: severitySummary,
      requires_immediate_action: requiresImmediateAction,
      escalation_needed: escalationNeeded,
    };

    // Generate audio script if requested
    if (options.format === 'audio_script' || template.output_formats.includes('audio_script')) {
      result.audio_script = this.generateAudioScript(briefing, data);
    }

    oracleCacheService.set(cacheKeyStr, result, cacheTTL);
    return result;
  }

  /**
   * Generate an emergency SITREP (bypasses cache)
   */
  async generateEmergencySitrep(
    userId: string,
    triggerEvent: {
      type: string;
      description: string;
      severity: SeverityLevel;
    }
  ): Promise<SitrepResult> {
    // Clear any existing cache
    oracleCacheService.deleteByPrefix(`sitrep:${userId}`);

    const data = await this.gatherSitrepData(userId, {});

    // Add the trigger event as a critical issue if not already present
    const existingIssue = data.critical_issues.find((i) =>
      i.title.toLowerCase().includes(triggerEvent.type.toLowerCase())
    );

    if (!existingIssue) {
      data.critical_issues.unshift({
        id: crypto.randomUUID(),
        title: `EMERGENCY: ${triggerEvent.type}`,
        severity: triggerEvent.severity,
        category: 'Emergency',
        description: triggerEvent.description,
        impact: 'Under assessment',
        affected_areas: ['To be determined'],
        started_at: new Date().toISOString(),
        duration_hours: 0,
        trend: 'volatile',
        status: 'new',
      });
    }

    // Update situation overview
    data.situation_overview.status = 'critical';
    data.situation_overview.summary = `EMERGENCY: ${triggerEvent.description}`;

    // Generate with emergency template adjustments
    const template = await briefingTemplatesService.getDefaultTemplate(userId, 'emergency');

    const briefing = this.renderSitrep(template!, data, 'text');
    const severitySummary = this.calculateSeveritySummary(data);

    return {
      briefing,
      raw_data: data,
      generated_at: new Date().toISOString(),
      severity_summary: severitySummary,
      requires_immediate_action: true,
      escalation_needed: true,
      audio_script: this.generateEmergencyAudioScript(data, triggerEvent),
    };
  }

  /**
   * Gather all SITREP data
   */
  private async gatherSitrepData(
    userId: string,
    options: { include_all_resources?: boolean; scope?: string[] }
  ): Promise<SitrepData> {
    // Gather all data in parallel
    const [
      situationOverview,
      criticalIssues,
      resourceStatus,
      riskMatrix,
    ] = await Promise.all([
      this.assessSituation(userId),
      this.getCriticalIssues(userId),
      this.getResourceStatus(userId, options.include_all_resources),
      this.getRiskMatrix(userId),
    ]);

    // Generate recommended actions based on issues and risks
    const recommendedActions = this.generateRecommendedActions(criticalIssues, riskMatrix, resourceStatus);

    // Determine escalation requirements
    const escalationRequirements = this.determineEscalations(criticalIssues, riskMatrix);

    return {
      user_id: userId,
      generated_at: new Date().toISOString(),
      situation_overview: situationOverview,
      critical_issues: criticalIssues,
      resource_status: resourceStatus,
      risk_matrix: riskMatrix,
      recommended_actions: recommendedActions,
      escalation_requirements: escalationRequirements,
    };
  }

  /**
   * Render SITREP from template and data
   */
  private renderSitrep(
    template: BriefingTemplate,
    data: SitrepData,
    format: BriefingFormat
  ): RenderedBriefing {
    const sections: TemplateSection[] = [];

    // Situation Overview (always first)
    sections.push({
      type: 'custom',
      content: [
        `STATUS: ${data.situation_overview.status.toUpperCase()}`,
        `Summary: ${data.situation_overview.summary}`,
        `Trend: ${data.situation_overview.trend}`,
        `Confidence: ${(data.situation_overview.confidence * 100).toFixed(0)}%`,
        '',
        'Key Metrics:',
        ...data.situation_overview.key_metrics.map(
          (m) => `  ${m.name}: ${m.value} [${m.status.toUpperCase()}]${m.change ? ` (${m.change > 0 ? '+' : ''}${m.change}%)` : ''}`
        ),
      ],
      data: data.situation_overview,
      metadata: { priority: data.situation_overview.status },
    });

    // Critical Issues
    if (data.critical_issues.length > 0) {
      sections.push({
        type: 'critical_issues',
        content: data.critical_issues.map((issue) => {
          const statusIndicator = this.getStatusIndicator(issue.severity);
          return `${statusIndicator} [${issue.severity.toUpperCase()}] ${issue.title} - ${issue.status} (${issue.duration_hours}h)`;
        }),
        data: data.critical_issues,
        metadata: { count: data.critical_issues.length },
      });
    }

    // Resource Status
    const constrainedResources = data.resource_status.filter(
      (r) => r.status === 'constrained' || r.status === 'unavailable'
    );
    if (constrainedResources.length > 0 || format !== 'audio_script') {
      sections.push({
        type: 'resources',
        content: data.resource_status.map((r) => {
          const utilization = r.utilization_percent !== undefined ? ` (${r.utilization_percent}% utilized)` : '';
          return `[${r.status.toUpperCase()}] ${r.name}${utilization}`;
        }),
        data: data.resource_status,
        metadata: { count: data.resource_status.length },
      });
    }

    // Risk Matrix (top risks)
    const topRisks = data.risk_matrix
      .filter((r) => r.severity === 'critical' || r.severity === 'high')
      .slice(0, 5);
    if (topRisks.length > 0) {
      sections.push({
        type: 'risks',
        content: topRisks.map((r) => {
          const score = `P:${(r.probability * 100).toFixed(0)}% I:${r.impact}/5`;
          return `[${r.severity.toUpperCase()}] ${r.title} (${score})`;
        }),
        data: topRisks,
        metadata: { count: data.risk_matrix.length },
      });
    }

    // Recommended Actions
    if (data.recommended_actions.length > 0) {
      sections.push({
        type: 'recommendations',
        content: data.recommended_actions.map((a) => {
          const dueBy = a.due_by ? ` (by ${new Date(a.due_by).toLocaleString()})` : '';
          return `[${a.priority.toUpperCase()}] ${a.action}${dueBy}`;
        }),
        data: data.recommended_actions,
        metadata: { count: data.recommended_actions.length },
      });
    }

    // Escalation Requirements
    const pendingEscalations = data.escalation_requirements.filter((e) => !e.escalated);
    if (pendingEscalations.length > 0) {
      sections.push({
        type: 'escalations',
        content: pendingEscalations.map((e) => {
          return `[${e.urgency.toUpperCase()}] Escalate to ${e.level}: ${e.reason}`;
        }),
        data: pendingEscalations,
        metadata: { count: pendingEscalations.length },
      });
    }

    return {
      template_id: template.id,
      briefing_type: 'sitrep',
      format,
      title: `SITREP - ${new Date().toLocaleString()}`,
      sections,
      generated_at: new Date().toISOString(),
      metadata: {
        user_id: data.user_id,
        situation_status: data.situation_overview.status,
        critical_count: data.critical_issues.filter((i) => i.severity === 'critical').length,
        high_count: data.critical_issues.filter((i) => i.severity === 'high').length,
      },
    };
  }

  /**
   * Generate audio script for SITREP
   */
  private generateAudioScript(briefing: RenderedBriefing, data: SitrepData): string {
    let script = `SITUATION REPORT. Generated at ${new Date().toLocaleTimeString()}.\n\n`;

    // Status
    script += `CURRENT STATUS: ${data.situation_overview.status.toUpperCase()}.\n`;
    script += `${data.situation_overview.summary}\n\n`;

    // Critical Issues
    if (data.critical_issues.length > 0) {
      script += `CRITICAL ISSUES: ${data.critical_issues.length} active.\n`;
      data.critical_issues.slice(0, 3).forEach((issue, idx) => {
        script += `${idx + 1}. ${issue.severity.toUpperCase()} severity: ${issue.title}. Status: ${issue.status}.\n`;
      });
      script += '\n';
    }

    // Top Risks
    const topRisks = data.risk_matrix.filter((r) => r.severity === 'critical' || r.severity === 'high');
    if (topRisks.length > 0) {
      script += `TOP RISKS: ${topRisks.length} identified.\n`;
      topRisks.slice(0, 3).forEach((risk, idx) => {
        script += `${idx + 1}. ${risk.title}.\n`;
      });
      script += '\n';
    }

    // Immediate Actions
    const immediateActions = data.recommended_actions.filter((a) => a.priority === 'immediate');
    if (immediateActions.length > 0) {
      script += `IMMEDIATE ACTIONS REQUIRED:\n`;
      immediateActions.forEach((action, idx) => {
        script += `${idx + 1}. ${action.action}.\n`;
      });
      script += '\n';
    }

    // Escalations
    const pendingEscalations = data.escalation_requirements.filter((e) => !e.escalated);
    if (pendingEscalations.length > 0) {
      script += `PENDING ESCALATIONS: ${pendingEscalations.length}.\n`;
    }

    script += `END OF SITREP.`;

    return briefingTemplatesService.formatForAudio(script, { voice: 'default', speed: 1.0, include_pauses: true, music_intro: false });
  }

  /**
   * Generate emergency audio script
   */
  private generateEmergencyAudioScript(data: SitrepData, trigger: { type: string; description: string }): string {
    let script = `EMERGENCY SITUATION REPORT.\n\n`;
    script += `ALERT: ${trigger.type}.\n`;
    script += `${trigger.description}\n\n`;
    script += `This is a critical situation requiring immediate attention.\n\n`;

    // Critical issues
    script += `Active critical issues: ${data.critical_issues.filter((i) => i.severity === 'critical').length}.\n`;

    // Immediate actions
    const immediateActions = data.recommended_actions.filter((a) => a.priority === 'immediate');
    if (immediateActions.length > 0) {
      script += `\nIMMEDIATE ACTIONS:\n`;
      immediateActions.forEach((action, idx) => {
        script += `${idx + 1}. ${action.action}.\n`;
      });
    }

    script += `\nStand by for further updates. END EMERGENCY SITREP.`;

    return script;
  }

  /**
   * Calculate severity summary
   */
  private calculateSeveritySummary(data: SitrepData): { critical: number; high: number; medium: number; low: number } {
    const allItems = [
      ...data.critical_issues.map((i) => i.severity),
      ...data.risk_matrix.map((r) => r.severity),
    ];

    return {
      critical: allItems.filter((s) => s === 'critical').length,
      high: allItems.filter((s) => s === 'high').length,
      medium: allItems.filter((s) => s === 'medium').length,
      low: allItems.filter((s) => s === 'low').length,
    };
  }

  /**
   * Generate recommended actions based on issues and risks
   */
  private generateRecommendedActions(
    issues: CriticalIssue[],
    risks: RiskMatrixItem[],
    resources: ResourceStatus[]
  ): RecommendedAction[] {
    const actions: RecommendedAction[] = [];

    // Actions from critical issues
    issues.filter((i) => i.status !== 'resolved').forEach((issue) => {
      const priority = issue.severity === 'critical' ? 'immediate' : issue.severity === 'high' ? 'urgent' : 'standard';

      actions.push({
        id: crypto.randomUUID(),
        priority,
        action: `Address: ${issue.title}`,
        description: issue.description,
        rationale: `${issue.severity} severity issue affecting ${issue.affected_areas.join(', ')}`,
        expected_outcome: 'Issue resolved or mitigated',
        risk_if_delayed: issue.impact,
      });
    });

    // Actions from high-risk items
    risks.filter((r) => r.severity === 'critical' || r.severity === 'high').forEach((risk) => {
      if (risk.mitigations && risk.mitigations.length > 0) {
        actions.push({
          id: crypto.randomUUID(),
          priority: risk.severity === 'critical' ? 'urgent' : 'standard',
          action: `Mitigate risk: ${risk.title}`,
          description: risk.mitigations[0],
          rationale: `Risk score: ${risk.risk_score.toFixed(1)} (P:${(risk.probability * 100).toFixed(0)}% I:${risk.impact}/5)`,
          expected_outcome: 'Risk likelihood or impact reduced',
        });
      }
    });

    // Actions from constrained resources
    resources.filter((r) => r.status === 'constrained' || r.status === 'unavailable').forEach((resource) => {
      actions.push({
        id: crypto.randomUUID(),
        priority: resource.status === 'unavailable' ? 'urgent' : 'standard',
        action: `Address ${resource.name} constraint`,
        description: `${resource.type} resource at ${resource.utilization_percent || 100}% utilization`,
        rationale: resource.alerts?.join('; ') || 'Resource availability issue',
        expected_outcome: 'Resource availability improved',
      });
    });

    // Sort by priority
    const priorityOrder = { immediate: 0, urgent: 1, standard: 2, optional: 3 };
    actions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return actions;
  }

  /**
   * Determine escalation requirements
   */
  private determineEscalations(issues: CriticalIssue[], risks: RiskMatrixItem[]): EscalationRequirement[] {
    const escalations: EscalationRequirement[] = [];

    // Critical issues that need escalation
    issues.filter((i) => i.severity === 'critical' && i.status !== 'resolved').forEach((issue) => {
      escalations.push({
        id: crypto.randomUUID(),
        level: issue.duration_hours > 2 ? 'director' : issue.duration_hours > 1 ? 'manager' : 'team_lead',
        issue_id: issue.id,
        reason: `Critical issue ongoing for ${issue.duration_hours} hours: ${issue.title}`,
        urgency: issue.duration_hours > 4 ? 'immediate' : 'within_hour',
        contacts: this.getEscalationContacts(issue.severity),
        escalated: false,
      });
    });

    // High-risk items that need attention
    risks.filter((r) => r.risk_score > 4 && r.severity === 'critical').forEach((risk) => {
      escalations.push({
        id: crypto.randomUUID(),
        level: 'manager',
        issue_id: risk.id,
        reason: `Critical risk identified: ${risk.title}`,
        urgency: 'within_day',
        contacts: this.getEscalationContacts('high'),
        escalated: false,
      });
    });

    return escalations;
  }

  /**
   * Get escalation contacts based on severity
   */
  private getEscalationContacts(severity: SeverityLevel): { name: string; role: string; channel: string }[] {
    // Mock implementation - would fetch from user's escalation matrix
    const contacts: Record<SeverityLevel, { name: string; role: string; channel: string }[]> = {
      critical: [
        { name: 'Emergency Response', role: 'On-Call Lead', channel: 'phone' },
        { name: 'VP Engineering', role: 'Executive', channel: 'slack' },
      ],
      high: [
        { name: 'Team Lead', role: 'Manager', channel: 'slack' },
        { name: 'Engineering Manager', role: 'Director', channel: 'email' },
      ],
      medium: [
        { name: 'Team Lead', role: 'Manager', channel: 'slack' },
      ],
      low: [],
      info: [],
    };
    return contacts[severity] || [];
  }

  // ============================================================================
  // Data Fetching Methods (Mock implementations)
  // ============================================================================

  private async assessSituation(userId: string): Promise<SituationOverview> {
    return {
      status: 'elevated',
      summary: 'One high-priority incident in progress. Resources operating within normal parameters.',
      last_updated: new Date().toISOString(),
      trend: 'stable',
      confidence: 0.85,
      key_metrics: [
        { name: 'Active Incidents', value: 1, status: 'high' },
        { name: 'System Uptime', value: '99.9%', status: 'low', change: 0 },
        { name: 'Open Blockers', value: 2, status: 'medium', change: -1 },
        { name: 'Team Availability', value: '85%', status: 'low' },
        { name: 'SLA Compliance', value: '98%', status: 'low', change: 2 },
      ],
    };
  }

  private async getCriticalIssues(userId: string): Promise<CriticalIssue[]> {
    return [
      {
        id: 'issue1',
        title: 'Payment Processing Delay',
        severity: 'high',
        category: 'Infrastructure',
        description: 'Payment gateway experiencing intermittent timeouts',
        impact: 'Approximately 5% of transactions affected',
        affected_areas: ['Checkout', 'Subscriptions'],
        started_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        duration_hours: 2,
        trend: 'stable',
        owner: 'Infrastructure Team',
        status: 'mitigating',
        actions_taken: ['Enabled fallback payment provider', 'Increased timeout thresholds'],
        next_update: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      },
      {
        id: 'issue2',
        title: 'Elevated Error Rate - API',
        severity: 'medium',
        category: 'Application',
        description: 'API error rate slightly elevated on /search endpoint',
        impact: 'Minor user experience degradation',
        affected_areas: ['Search', 'Mobile App'],
        started_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
        duration_hours: 1,
        trend: 'improving',
        owner: 'Backend Team',
        status: 'investigating',
      },
    ];
  }

  private async getResourceStatus(userId: string, includeAll?: boolean): Promise<ResourceStatus[]> {
    return [
      {
        id: 'r1',
        name: 'Engineering Team',
        type: 'human',
        status: 'limited',
        utilization_percent: 95,
        capacity: 10,
        current_usage: 9.5,
        alerts: ['2 team members on PTO this week'],
        forecast: { trend: 'stable', prediction: 'Normal capacity next week' },
      },
      {
        id: 'r2',
        name: 'Production Servers',
        type: 'infrastructure',
        status: 'available',
        utilization_percent: 68,
        capacity: 100,
        current_usage: 68,
        forecast: { trend: 'stable', prediction: 'Utilization expected to remain stable' },
      },
      {
        id: 'r3',
        name: 'Database Cluster',
        type: 'infrastructure',
        status: 'constrained',
        utilization_percent: 88,
        capacity: 100,
        current_usage: 88,
        alerts: ['Approaching capacity threshold', 'Scale-up recommended'],
        forecast: { trend: 'degrading', prediction: 'May reach capacity in 2 weeks' },
      },
      {
        id: 'r4',
        name: 'Monthly Cloud Budget',
        type: 'financial',
        status: 'limited',
        utilization_percent: 78,
        alerts: ['Tracking slightly over budget'],
      },
    ];
  }

  private async getRiskMatrix(userId: string): Promise<RiskMatrixItem[]> {
    return [
      {
        id: 'risk1',
        title: 'Database Capacity Exhaustion',
        description: 'Primary database cluster approaching capacity limits',
        probability: 0.6,
        impact: 4,
        risk_score: 2.4,
        severity: 'high',
        category: 'Infrastructure',
        triggers: ['Traffic spike', 'Data growth exceeds projections'],
        mitigations: ['Initiate database scale-up', 'Implement data archival'],
        owner: 'Infrastructure Team',
        contingency: 'Enable read replicas for failover',
        last_assessed: new Date().toISOString(),
      },
      {
        id: 'risk2',
        title: 'Key Personnel Unavailability',
        description: 'Single points of failure in critical systems knowledge',
        probability: 0.4,
        impact: 4,
        risk_score: 1.6,
        severity: 'medium',
        category: 'Human Resources',
        triggers: ['Unexpected leave', 'Resignation'],
        mitigations: ['Cross-training program', 'Documentation initiative'],
        owner: 'Engineering Manager',
        last_assessed: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'risk3',
        title: 'Third-Party API Dependency',
        description: 'Critical dependency on payment provider API',
        probability: 0.3,
        impact: 5,
        risk_score: 1.5,
        severity: 'medium',
        category: 'External',
        triggers: ['Provider outage', 'API changes'],
        mitigations: ['Implement fallback provider', 'Monitor provider status'],
        contingency: 'Enable backup payment processing',
        last_assessed: new Date().toISOString(),
      },
    ];
  }

  /**
   * Get status indicator for severity
   */
  private getStatusIndicator(severity: SeverityLevel): string {
    const indicators: Record<SeverityLevel, string> = {
      critical: '[!!!]',
      high: '[!!]',
      medium: '[!]',
      low: '[.]',
      info: '[i]',
    };
    return indicators[severity] || '[-]';
  }

  /**
   * Invalidate SITREP cache for user
   */
  async invalidateCache(userId: string): Promise<void> {
    oracleCacheService.deleteByPrefix(`sitrep:${userId}`);
  }
}

// Singleton export
export const situationReportService = new SituationReportService();
