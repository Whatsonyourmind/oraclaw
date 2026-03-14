/**
 * Impact Analysis Service
 * Multi-dimensional impact breakdown and analysis engine
 */

import type {
  Signal,
  UrgencyLevel,
  ImpactLevel,
} from '@mission-control/shared-types';

// ============================================================================
// TYPES
// ============================================================================

export type ImpactDimension = 'time' | 'cost' | 'quality' | 'scope' | 'team';

export interface DimensionalScore {
  dimension: ImpactDimension;
  score: number; // 0-100
  weight: number; // 0-1
  confidence: number; // 0-1
  trend: 'increasing' | 'stable' | 'decreasing';
  factors: Array<{
    name: string;
    contribution: number;
    description: string;
  }>;
}

export interface RippleEffect {
  id: string;
  sourceSignalId: string;
  affectedEntityType: 'project' | 'task' | 'milestone' | 'team' | 'budget' | 'stakeholder';
  affectedEntityId: string;
  affectedEntityName: string;
  impactType: 'direct' | 'indirect';
  impactLevel: ImpactLevel;
  propagationDepth: number;
  probability: number;
  delayDays?: number;
  costImpact?: number;
  description: string;
}

export interface StakeholderImpact {
  stakeholderId: string;
  stakeholderName: string;
  role: string;
  impactLevel: ImpactLevel;
  impactTypes: Array<'workload' | 'deadline' | 'budget' | 'scope' | 'quality' | 'communication'>;
  sentimentImpact: 'positive' | 'negative' | 'neutral';
  actionRequired: boolean;
  recommendedAction?: string;
  notificationPriority: 'immediate' | 'high' | 'normal' | 'low';
}

export interface ResourceImpact {
  resourceType: 'human' | 'financial' | 'equipment' | 'time' | 'external';
  resourceId?: string;
  resourceName: string;
  currentAllocation: number; // percentage
  requiredAllocation: number; // percentage
  gap: number; // percentage
  availability: 'available' | 'constrained' | 'unavailable';
  alternativeOptions: string[];
  costImplication: number;
}

export interface ConfidenceInterval {
  lower: number;
  expected: number;
  upper: number;
  confidenceLevel: number; // e.g., 0.95 for 95%
}

export interface ScenarioOutcome {
  name: string;
  description: string;
  probability: number;
  dimensions: Record<ImpactDimension, number>;
  totalImpact: number;
  timeToRealization: string;
  keyRisks: string[];
  keyBenefits: string[];
}

export interface ImpactAnalysisResult {
  signalId: string;
  signalTitle: string;
  overallImpact: {
    score: number;
    level: ImpactLevel;
    confidence: number;
    trend: 'increasing' | 'stable' | 'decreasing';
  };
  dimensions: DimensionalScore[];
  rippleEffects: RippleEffect[];
  stakeholderImpacts: StakeholderImpact[];
  resourceImpacts: ResourceImpact[];
  confidenceIntervals: {
    impact: ConfidenceInterval;
    timeline: ConfidenceInterval;
    cost: ConfidenceInterval;
  };
  scenarios: {
    bestCase: ScenarioOutcome;
    expectedCase: ScenarioOutcome;
    worstCase: ScenarioOutcome;
  };
  recommendations: Array<{
    priority: number;
    action: string;
    expectedImpactReduction: number;
    effort: 'low' | 'medium' | 'high';
    timeframe: string;
  }>;
  analyzedAt: string;
}

export interface DimensionWeights {
  time: number;
  cost: number;
  quality: number;
  scope: number;
  team: number;
}

export interface ImpactContext {
  projectId?: string;
  projectBudget?: number;
  projectDeadline?: string;
  teamSize?: number;
  stakeholders?: Array<{ id: string; name: string; role: string }>;
  currentResources?: ResourceImpact[];
}

// ============================================================================
// IMPACT ANALYSIS SERVICE
// ============================================================================

export class ImpactAnalysisService {
  private defaultWeights: DimensionWeights = {
    time: 0.25,
    cost: 0.20,
    quality: 0.20,
    scope: 0.20,
    team: 0.15,
  };

  /**
   * Perform comprehensive impact analysis on a signal
   */
  async analyzeImpact(
    signal: Signal,
    context: ImpactContext = {},
    customWeights?: Partial<DimensionWeights>
  ): Promise<ImpactAnalysisResult> {
    const weights = { ...this.defaultWeights, ...customWeights };

    // Calculate dimensional scores
    const dimensions = await this.calculateDimensionalScores(signal, context, weights);

    // Calculate overall impact
    const overallImpact = this.calculateOverallImpact(dimensions, signal);

    // Calculate ripple effects
    const rippleEffects = await this.calculateRippleEffects(signal, context);

    // Calculate stakeholder impacts
    const stakeholderImpacts = await this.calculateStakeholderImpacts(signal, context);

    // Calculate resource impacts
    const resourceImpacts = await this.calculateResourceImpacts(signal, context);

    // Calculate confidence intervals
    const confidenceIntervals = this.calculateConfidenceIntervals(signal, dimensions);

    // Generate scenarios
    const scenarios = await this.generateScenarios(signal, dimensions, context);

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      signal,
      dimensions,
      rippleEffects,
      stakeholderImpacts
    );

    return {
      signalId: signal.id,
      signalTitle: signal.title,
      overallImpact,
      dimensions,
      rippleEffects,
      stakeholderImpacts,
      resourceImpacts,
      confidenceIntervals,
      scenarios,
      recommendations,
      analyzedAt: new Date().toISOString(),
    };
  }

  /**
   * Calculate multi-dimensional impact scores
   */
  private async calculateDimensionalScores(
    signal: Signal,
    context: ImpactContext,
    weights: DimensionWeights
  ): Promise<DimensionalScore[]> {
    const baseImpactScore = this.getBaseImpactScore(signal.impact);

    return [
      this.calculateTimeImpact(signal, context, weights.time, baseImpactScore),
      this.calculateCostImpact(signal, context, weights.cost, baseImpactScore),
      this.calculateQualityImpact(signal, context, weights.quality, baseImpactScore),
      this.calculateScopeImpact(signal, context, weights.scope, baseImpactScore),
      this.calculateTeamImpact(signal, context, weights.team, baseImpactScore),
    ];
  }

  /**
   * Get base impact score from impact level
   */
  private getBaseImpactScore(impact: ImpactLevel): number {
    const scores: Record<ImpactLevel, number> = {
      critical: 90,
      high: 70,
      medium: 45,
      low: 20,
    };
    return scores[impact] || 50;
  }

  /**
   * Calculate time dimension impact
   */
  private calculateTimeImpact(
    signal: Signal,
    context: ImpactContext,
    weight: number,
    baseScore: number
  ): DimensionalScore {
    const factors: DimensionalScore['factors'] = [];
    let score = baseScore;

    // Signal type factor
    if (signal.signal_type === 'deadline') {
      score += 20;
      factors.push({ name: 'Deadline Signal', contribution: 20, description: 'Direct deadline impact' });
    }

    // Urgency factor
    const urgencyBonus: Record<UrgencyLevel, number> = { critical: 25, high: 15, medium: 5, low: 0 };
    const urgencyContrib = urgencyBonus[signal.urgency] || 0;
    if (urgencyContrib > 0) {
      score += urgencyContrib;
      factors.push({ name: 'Urgency Level', contribution: urgencyContrib, description: `${signal.urgency} urgency` });
    }

    // Project deadline proximity
    if (context.projectDeadline) {
      const daysToDeadline = Math.floor(
        (new Date(context.projectDeadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      if (daysToDeadline < 7) {
        const proximity = Math.min(20, Math.max(0, 20 - daysToDeadline * 2));
        score += proximity;
        factors.push({ name: 'Deadline Proximity', contribution: proximity, description: `${daysToDeadline} days to deadline` });
      }
    }

    // Determine trend based on signal metadata
    const trend = this.determineTrend(signal.metadata?.time_trend);

    return {
      dimension: 'time',
      score: Math.min(100, Math.max(0, score)),
      weight,
      confidence: signal.confidence * 0.9,
      trend,
      factors,
    };
  }

  /**
   * Calculate cost dimension impact
   */
  private calculateCostImpact(
    signal: Signal,
    context: ImpactContext,
    weight: number,
    baseScore: number
  ): DimensionalScore {
    const factors: DimensionalScore['factors'] = [];
    let score = baseScore;

    // Resource signal factor
    if (signal.signal_type === 'resource') {
      score += 15;
      factors.push({ name: 'Resource Signal', contribution: 15, description: 'Resource-related cost impact' });
    }

    // Budget context
    if (context.projectBudget) {
      const estimatedCost = signal.metadata?.estimated_cost || 0;
      const budgetRatio = estimatedCost / context.projectBudget;
      if (budgetRatio > 0.1) {
        const costContrib = Math.min(30, budgetRatio * 100);
        score += costContrib;
        factors.push({ name: 'Budget Impact', contribution: costContrib, description: `${(budgetRatio * 100).toFixed(1)}% of budget` });
      }
    }

    // Opportunity cost for delayed signals
    if (signal.urgency === 'critical' || signal.urgency === 'high') {
      const opportunityFactor = signal.urgency === 'critical' ? 15 : 8;
      score += opportunityFactor;
      factors.push({ name: 'Opportunity Cost', contribution: opportunityFactor, description: 'Delayed action penalty' });
    }

    const trend = this.determineTrend(signal.metadata?.cost_trend);

    return {
      dimension: 'cost',
      score: Math.min(100, Math.max(0, score)),
      weight,
      confidence: signal.confidence * 0.85,
      trend,
      factors,
    };
  }

  /**
   * Calculate quality dimension impact
   */
  private calculateQualityImpact(
    signal: Signal,
    context: ImpactContext,
    weight: number,
    baseScore: number
  ): DimensionalScore {
    const factors: DimensionalScore['factors'] = [];
    let score = baseScore;

    // Risk and anomaly signals affect quality
    if (signal.signal_type === 'risk' || signal.signal_type === 'anomaly') {
      score += 20;
      factors.push({ name: 'Quality Risk', contribution: 20, description: 'Quality-affecting signal type' });
    }

    // Pattern signals may indicate quality trends
    if (signal.signal_type === 'pattern') {
      score += 10;
      factors.push({ name: 'Pattern Detected', contribution: 10, description: 'Quality pattern identified' });
    }

    // Low confidence signals require more review
    if (signal.confidence < 0.7) {
      const reviewFactor = (0.7 - signal.confidence) * 30;
      score += reviewFactor;
      factors.push({ name: 'Review Required', contribution: reviewFactor, description: 'Low confidence requires validation' });
    }

    const trend = this.determineTrend(signal.metadata?.quality_trend);

    return {
      dimension: 'quality',
      score: Math.min(100, Math.max(0, score)),
      weight,
      confidence: signal.confidence * 0.8,
      trend,
      factors,
    };
  }

  /**
   * Calculate scope dimension impact
   */
  private calculateScopeImpact(
    signal: Signal,
    context: ImpactContext,
    weight: number,
    baseScore: number
  ): DimensionalScore {
    const factors: DimensionalScore['factors'] = [];
    let score = baseScore;

    // Dependency signals affect scope
    if (signal.signal_type === 'dependency') {
      score += 25;
      factors.push({ name: 'Dependency Impact', contribution: 25, description: 'Scope affected by dependencies' });
    }

    // Opportunity signals may expand scope
    if (signal.signal_type === 'opportunity') {
      score += 15;
      factors.push({ name: 'Opportunity Expansion', contribution: 15, description: 'Potential scope expansion' });
    }

    // Conflict signals indicate scope issues
    if (signal.signal_type === 'conflict') {
      score += 20;
      factors.push({ name: 'Scope Conflict', contribution: 20, description: 'Conflicting scope elements' });
    }

    const trend = this.determineTrend(signal.metadata?.scope_trend);

    return {
      dimension: 'scope',
      score: Math.min(100, Math.max(0, score)),
      weight,
      confidence: signal.confidence * 0.85,
      trend,
      factors,
    };
  }

  /**
   * Calculate team dimension impact
   */
  private calculateTeamImpact(
    signal: Signal,
    context: ImpactContext,
    weight: number,
    baseScore: number
  ): DimensionalScore {
    const factors: DimensionalScore['factors'] = [];
    let score = baseScore;

    // Resource signals directly affect team
    if (signal.signal_type === 'resource') {
      score += 25;
      factors.push({ name: 'Resource Impact', contribution: 25, description: 'Team resource affected' });
    }

    // Team size consideration
    if (context.teamSize) {
      if (context.teamSize < 5 && signal.urgency !== 'low') {
        score += 15;
        factors.push({ name: 'Small Team Risk', contribution: 15, description: 'Limited team bandwidth' });
      }
    }

    // Conflict and dependency affect team coordination
    if (signal.signal_type === 'conflict' || signal.signal_type === 'dependency') {
      score += 10;
      factors.push({ name: 'Coordination Overhead', contribution: 10, description: 'Additional team coordination needed' });
    }

    const trend = this.determineTrend(signal.metadata?.team_trend);

    return {
      dimension: 'team',
      score: Math.min(100, Math.max(0, score)),
      weight,
      confidence: signal.confidence * 0.8,
      trend,
      factors,
    };
  }

  /**
   * Determine trend from metadata
   */
  private determineTrend(trendValue?: string): 'increasing' | 'stable' | 'decreasing' {
    if (trendValue === 'increasing' || trendValue === 'up') return 'increasing';
    if (trendValue === 'decreasing' || trendValue === 'down') return 'decreasing';
    return 'stable';
  }

  /**
   * Calculate overall impact from dimensional scores
   */
  private calculateOverallImpact(
    dimensions: DimensionalScore[],
    signal: Signal
  ): ImpactAnalysisResult['overallImpact'] {
    const weightedSum = dimensions.reduce(
      (sum, d) => sum + d.score * d.weight,
      0
    );
    const totalWeight = dimensions.reduce((sum, d) => sum + d.weight, 0);
    const score = totalWeight > 0 ? weightedSum / totalWeight : 0;

    // Determine level
    let level: ImpactLevel = 'low';
    if (score >= 80) level = 'critical';
    else if (score >= 60) level = 'high';
    else if (score >= 40) level = 'medium';

    // Calculate confidence
    const avgConfidence =
      dimensions.reduce((sum, d) => sum + d.confidence, 0) / dimensions.length;

    // Determine overall trend
    const trendCounts = { increasing: 0, stable: 0, decreasing: 0 };
    dimensions.forEach((d) => trendCounts[d.trend]++);
    const trend = Object.entries(trendCounts).sort((a, b) => b[1] - a[1])[0][0] as 'increasing' | 'stable' | 'decreasing';

    return {
      score: Math.round(score),
      level,
      confidence: avgConfidence,
      trend,
    };
  }

  /**
   * Calculate ripple effects from signal
   */
  private async calculateRippleEffects(
    signal: Signal,
    context: ImpactContext
  ): Promise<RippleEffect[]> {
    const effects: RippleEffect[] = [];

    // Direct project effect
    if (context.projectId) {
      effects.push({
        id: crypto.randomUUID(),
        sourceSignalId: signal.id,
        affectedEntityType: 'project',
        affectedEntityId: context.projectId,
        affectedEntityName: 'Current Project',
        impactType: 'direct',
        impactLevel: signal.impact,
        propagationDepth: 0,
        probability: signal.confidence,
        description: `Direct impact from ${signal.signal_type} signal`,
      });
    }

    // Deadline effects
    if (signal.signal_type === 'deadline' || signal.signal_type === 'dependency') {
      effects.push({
        id: crypto.randomUUID(),
        sourceSignalId: signal.id,
        affectedEntityType: 'milestone',
        affectedEntityId: signal.related_entity_id || 'upcoming-milestone',
        affectedEntityName: 'Upcoming Milestones',
        impactType: 'direct',
        impactLevel: this.adjustImpactLevel(signal.impact, -1),
        propagationDepth: 1,
        probability: signal.confidence * 0.9,
        delayDays: this.estimateDelayDays(signal),
        description: 'Potential milestone impact due to signal',
      });
    }

    // Resource effects
    if (signal.signal_type === 'resource') {
      effects.push({
        id: crypto.randomUUID(),
        sourceSignalId: signal.id,
        affectedEntityType: 'team',
        affectedEntityId: 'team-capacity',
        affectedEntityName: 'Team Capacity',
        impactType: 'direct',
        impactLevel: signal.impact,
        propagationDepth: 1,
        probability: signal.confidence * 0.85,
        description: 'Team capacity affected by resource signal',
      });
    }

    // Budget effects for high-impact signals
    if (signal.impact === 'critical' || signal.impact === 'high') {
      effects.push({
        id: crypto.randomUUID(),
        sourceSignalId: signal.id,
        affectedEntityType: 'budget',
        affectedEntityId: 'project-budget',
        affectedEntityName: 'Project Budget',
        impactType: 'indirect',
        impactLevel: this.adjustImpactLevel(signal.impact, -1),
        propagationDepth: 2,
        probability: signal.confidence * 0.7,
        costImpact: this.estimateCostImpact(signal, context),
        description: 'Potential budget impact from high-priority signal',
      });
    }

    return effects;
  }

  /**
   * Calculate stakeholder impacts
   */
  private async calculateStakeholderImpacts(
    signal: Signal,
    context: ImpactContext
  ): Promise<StakeholderImpact[]> {
    const impacts: StakeholderImpact[] = [];

    // Use context stakeholders if available
    const stakeholders = context.stakeholders || [
      { id: 'owner', name: 'Project Owner', role: 'owner' },
      { id: 'lead', name: 'Team Lead', role: 'lead' },
      { id: 'member', name: 'Team Member', role: 'member' },
    ];

    stakeholders.forEach((stakeholder) => {
      const impactTypes: StakeholderImpact['impactTypes'] = [];
      let impactLevel = signal.impact;
      let actionRequired = false;

      // Owners are impacted by all high-priority signals
      if (stakeholder.role === 'owner') {
        if (signal.urgency === 'critical' || signal.urgency === 'high') {
          impactTypes.push('scope', 'budget');
          actionRequired = true;
        }
      }

      // Leads are impacted by deadline and resource signals
      if (stakeholder.role === 'lead') {
        if (signal.signal_type === 'deadline' || signal.signal_type === 'resource') {
          impactTypes.push('workload', 'deadline');
          actionRequired = signal.urgency !== 'low';
        }
      }

      // Members are impacted by workload and scope signals
      if (stakeholder.role === 'member') {
        impactTypes.push('workload');
        impactLevel = this.adjustImpactLevel(signal.impact, -1);
      }

      if (impactTypes.length > 0) {
        impacts.push({
          stakeholderId: stakeholder.id,
          stakeholderName: stakeholder.name,
          role: stakeholder.role,
          impactLevel,
          impactTypes,
          sentimentImpact: signal.signal_type === 'opportunity' ? 'positive' : 'negative',
          actionRequired,
          recommendedAction: actionRequired ? this.getRecommendedAction(signal, stakeholder.role) : undefined,
          notificationPriority: this.getNotificationPriority(signal.urgency, stakeholder.role),
        });
      }
    });

    return impacts;
  }

  /**
   * Calculate resource impacts
   */
  private async calculateResourceImpacts(
    signal: Signal,
    context: ImpactContext
  ): Promise<ResourceImpact[]> {
    const impacts: ResourceImpact[] = [];

    // Time resource
    impacts.push({
      resourceType: 'time',
      resourceName: 'Available Time',
      currentAllocation: 80, // Default assumption
      requiredAllocation: signal.urgency === 'critical' ? 100 : signal.urgency === 'high' ? 95 : 85,
      gap: signal.urgency === 'critical' ? 20 : signal.urgency === 'high' ? 15 : 5,
      availability: signal.urgency === 'critical' ? 'constrained' : 'available',
      alternativeOptions: ['Extend deadline', 'Reduce scope', 'Add resources'],
      costImplication: this.estimateTimeCostImplication(signal),
    });

    // Human resources for resource signals
    if (signal.signal_type === 'resource') {
      impacts.push({
        resourceType: 'human',
        resourceName: 'Team Capacity',
        currentAllocation: 75,
        requiredAllocation: 90,
        gap: 15,
        availability: 'constrained',
        alternativeOptions: ['Hire contractor', 'Reassign from other projects', 'Overtime'],
        costImplication: signal.metadata?.estimated_cost || 0,
      });
    }

    // Financial resources for high-impact signals
    if (signal.impact === 'critical' || signal.impact === 'high') {
      const costImpact = this.estimateCostImpact(signal, context);
      if (costImpact > 0) {
        impacts.push({
          resourceType: 'financial',
          resourceName: 'Budget Reserve',
          currentAllocation: 10,
          requiredAllocation: Math.min(30, costImpact / (context.projectBudget || 100000) * 100),
          gap: Math.max(0, (costImpact / (context.projectBudget || 100000) * 100) - 10),
          availability: 'available',
          alternativeOptions: ['Request additional budget', 'Reduce scope', 'Phase delivery'],
          costImplication: costImpact,
        });
      }
    }

    return impacts;
  }

  /**
   * Calculate confidence intervals for impact predictions
   */
  private calculateConfidenceIntervals(
    signal: Signal,
    dimensions: DimensionalScore[]
  ): ImpactAnalysisResult['confidenceIntervals'] {
    const avgScore = dimensions.reduce((sum, d) => sum + d.score, 0) / dimensions.length;
    const avgConfidence = dimensions.reduce((sum, d) => sum + d.confidence, 0) / dimensions.length;

    // Impact score interval
    const impactVariance = dimensions.reduce(
      (sum, d) => sum + Math.pow(d.score - avgScore, 2),
      0
    ) / dimensions.length;
    const impactStdDev = Math.sqrt(impactVariance);

    return {
      impact: {
        lower: Math.max(0, avgScore - 1.96 * impactStdDev),
        expected: avgScore,
        upper: Math.min(100, avgScore + 1.96 * impactStdDev),
        confidenceLevel: 0.95,
      },
      timeline: {
        lower: this.estimateDelayDays(signal) * 0.5,
        expected: this.estimateDelayDays(signal),
        upper: this.estimateDelayDays(signal) * 2,
        confidenceLevel: 0.90,
      },
      cost: {
        lower: signal.metadata?.estimated_cost ? signal.metadata.estimated_cost * 0.7 : 0,
        expected: signal.metadata?.estimated_cost || 0,
        upper: signal.metadata?.estimated_cost ? signal.metadata.estimated_cost * 1.5 : 0,
        confidenceLevel: 0.85,
      },
    };
  }

  /**
   * Generate best/worst/expected case scenarios
   */
  private async generateScenarios(
    signal: Signal,
    dimensions: DimensionalScore[],
    context: ImpactContext
  ): Promise<ImpactAnalysisResult['scenarios']> {
    const dimScores: Record<ImpactDimension, number> = {
      time: 0,
      cost: 0,
      quality: 0,
      scope: 0,
      team: 0,
    };

    dimensions.forEach((d) => {
      dimScores[d.dimension] = d.score;
    });

    // Best case: Signal is mitigated quickly
    const bestCase: ScenarioOutcome = {
      name: 'Best Case',
      description: 'Signal is addressed immediately with minimal disruption',
      probability: signal.confidence * 0.3,
      dimensions: {
        time: dimScores.time * 0.5,
        cost: dimScores.cost * 0.4,
        quality: dimScores.quality * 0.6,
        scope: dimScores.scope * 0.5,
        team: dimScores.team * 0.5,
      },
      totalImpact: Object.values(dimScores).reduce((a, b) => a + b, 0) * 0.3,
      timeToRealization: '1-2 days',
      keyRisks: [],
      keyBenefits: ['Minimal project disruption', 'Team morale maintained', 'Budget preserved'],
    };

    // Expected case: Normal mitigation
    const expectedCase: ScenarioOutcome = {
      name: 'Expected Case',
      description: 'Signal is addressed with standard mitigation efforts',
      probability: signal.confidence * 0.5,
      dimensions: dimScores,
      totalImpact: Object.values(dimScores).reduce((a, b) => a + b, 0) / 5,
      timeToRealization: '3-7 days',
      keyRisks: ['Some schedule slip possible', 'Minor budget impact'],
      keyBenefits: ['Controlled resolution', 'Lessons learned captured'],
    };

    // Worst case: Signal escalates
    const worstCase: ScenarioOutcome = {
      name: 'Worst Case',
      description: 'Signal is not addressed in time, leading to escalation',
      probability: signal.confidence * 0.2,
      dimensions: {
        time: Math.min(100, dimScores.time * 1.5),
        cost: Math.min(100, dimScores.cost * 1.8),
        quality: Math.min(100, dimScores.quality * 1.3),
        scope: Math.min(100, dimScores.scope * 1.4),
        team: Math.min(100, dimScores.team * 1.6),
      },
      totalImpact: Object.values(dimScores).reduce((a, b) => a + b, 0) * 1.5 / 5,
      timeToRealization: '2-4 weeks',
      keyRisks: [
        'Significant deadline miss',
        'Budget overrun',
        'Team burnout',
        'Stakeholder escalation',
      ],
      keyBenefits: [],
    };

    return { bestCase, expectedCase, worstCase };
  }

  /**
   * Generate recommendations based on analysis
   */
  private generateRecommendations(
    signal: Signal,
    dimensions: DimensionalScore[],
    rippleEffects: RippleEffect[],
    stakeholderImpacts: StakeholderImpact[]
  ): ImpactAnalysisResult['recommendations'] {
    const recommendations: ImpactAnalysisResult['recommendations'] = [];

    // High time impact
    const timeScore = dimensions.find((d) => d.dimension === 'time')?.score || 0;
    if (timeScore > 60) {
      recommendations.push({
        priority: 1,
        action: 'Review and adjust project timeline immediately',
        expectedImpactReduction: 25,
        effort: 'medium',
        timeframe: 'Within 24 hours',
      });
    }

    // High cost impact
    const costScore = dimensions.find((d) => d.dimension === 'cost')?.score || 0;
    if (costScore > 60) {
      recommendations.push({
        priority: 2,
        action: 'Conduct budget impact assessment and identify mitigation options',
        expectedImpactReduction: 20,
        effort: 'high',
        timeframe: 'Within 48 hours',
      });
    }

    // Multiple ripple effects
    if (rippleEffects.length > 3) {
      recommendations.push({
        priority: 3,
        action: 'Map all affected dependencies and communicate changes',
        expectedImpactReduction: 15,
        effort: 'medium',
        timeframe: 'Within 3 days',
      });
    }

    // Stakeholders requiring action
    const actionStakeholders = stakeholderImpacts.filter((s) => s.actionRequired);
    if (actionStakeholders.length > 0) {
      recommendations.push({
        priority: 4,
        action: `Notify and coordinate with ${actionStakeholders.length} stakeholder(s)`,
        expectedImpactReduction: 10,
        effort: 'low',
        timeframe: 'Immediately',
      });
    }

    // Resource signal specific
    if (signal.signal_type === 'resource') {
      recommendations.push({
        priority: 5,
        action: 'Evaluate resource reallocation or external support options',
        expectedImpactReduction: 20,
        effort: 'high',
        timeframe: 'Within 1 week',
      });
    }

    // Sort by priority
    return recommendations.sort((a, b) => a.priority - b.priority);
  }

  // Helper methods

  private adjustImpactLevel(level: ImpactLevel, adjustment: number): ImpactLevel {
    const levels: ImpactLevel[] = ['low', 'medium', 'high', 'critical'];
    const currentIndex = levels.indexOf(level);
    const newIndex = Math.max(0, Math.min(levels.length - 1, currentIndex + adjustment));
    return levels[newIndex];
  }

  private estimateDelayDays(signal: Signal): number {
    const baseDelay: Record<UrgencyLevel, number> = { critical: 14, high: 7, medium: 3, low: 1 };
    return signal.metadata?.estimated_delay_days || baseDelay[signal.urgency] || 3;
  }

  private estimateCostImpact(signal: Signal, context: ImpactContext): number {
    if (signal.metadata?.estimated_cost) return signal.metadata.estimated_cost;

    const baseCost: Record<ImpactLevel, number> = { critical: 50000, high: 20000, medium: 5000, low: 1000 };
    const budgetFactor = context.projectBudget ? context.projectBudget / 100000 : 1;

    return baseCost[signal.impact] * budgetFactor;
  }

  private estimateTimeCostImplication(signal: Signal): number {
    const delayDays = this.estimateDelayDays(signal);
    const dailyCost = 2000; // Default assumption
    return delayDays * dailyCost;
  }

  private getRecommendedAction(signal: Signal, role: string): string {
    if (role === 'owner') {
      return `Review ${signal.signal_type} impact and approve mitigation plan`;
    }
    if (role === 'lead') {
      return `Coordinate team response to ${signal.signal_type} signal`;
    }
    return `Adjust work priorities based on ${signal.signal_type} signal`;
  }

  private getNotificationPriority(
    urgency: UrgencyLevel,
    role: string
  ): StakeholderImpact['notificationPriority'] {
    if (urgency === 'critical') return 'immediate';
    if (urgency === 'high' && role === 'owner') return 'immediate';
    if (urgency === 'high') return 'high';
    if (urgency === 'medium') return 'normal';
    return 'low';
  }

  /**
   * Compare impacts between multiple signals
   */
  async compareImpacts(
    signals: Signal[],
    context: ImpactContext
  ): Promise<Array<{ signal: Signal; analysis: ImpactAnalysisResult }>> {
    const results = await Promise.all(
      signals.map(async (signal) => ({
        signal,
        analysis: await this.analyzeImpact(signal, context),
      }))
    );

    return results.sort((a, b) => b.analysis.overallImpact.score - a.analysis.overallImpact.score);
  }
}

// Singleton instance
export const impactAnalysisService = new ImpactAnalysisService();
