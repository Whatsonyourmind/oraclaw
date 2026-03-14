/**
 * Signal Aggregation Service
 * Smart grouping, rollups, and cross-group analysis
 */

import type {
  Signal,
  SignalCluster,
  UrgencyLevel,
  ImpactLevel,
} from '@mission-control/shared-types';

// ============================================================================
// TYPES
// ============================================================================

export type GroupingDimension = 'project' | 'goal' | 'person' | 'type' | 'urgency' | 'impact' | 'source' | 'date' | 'custom';

export interface SignalGroup {
  id: string;
  dimension: GroupingDimension;
  key: string;
  label: string;
  description?: string;
  signals: Signal[];
  count: number;
  healthScore: number;
  urgencyDistribution: Record<UrgencyLevel, number>;
  impactDistribution: Record<ImpactLevel, number>;
  typeDistribution: Record<string, number>;
  averageConfidence: number;
  oldestSignal: string;
  newestSignal: string;
  metadata: Record<string, any>;
}

export interface RollupSummary {
  groupId: string;
  groupLabel: string;
  totalSignals: number;
  activeSignals: number;
  resolvedSignals: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  healthScore: number;
  trend: 'improving' | 'stable' | 'declining';
  topIssues: Array<{
    signalId: string;
    title: string;
    urgency: UrgencyLevel;
    impact: ImpactLevel;
  }>;
  actionItems: string[];
  lastUpdated: string;
}

export interface GroupHealthScore {
  groupId: string;
  score: number; // 0-100
  components: {
    urgencyScore: number;
    resolutionRate: number;
    ageScore: number;
    trendScore: number;
    confidenceScore: number;
  };
  status: 'healthy' | 'warning' | 'critical';
  recommendations: string[];
}

export interface CrossGroupDependency {
  sourceGroupId: string;
  targetGroupId: string;
  dependencyType: 'blocking' | 'related' | 'causal' | 'temporal';
  strength: number; // 0-1
  sharedSignals: string[];
  description: string;
}

export interface AggregationResult {
  groups: SignalGroup[];
  rollups: RollupSummary[];
  healthScores: GroupHealthScore[];
  crossGroupDependencies: CrossGroupDependency[];
  globalSummary: {
    totalGroups: number;
    totalSignals: number;
    overallHealth: number;
    criticalGroups: number;
    warningGroups: number;
    healthyGroups: number;
  };
  aggregatedAt: string;
}

export interface GroupingConfig {
  dimension: GroupingDimension;
  customKey?: (signal: Signal) => string;
  customLabel?: (key: string) => string;
  includeEmpty?: boolean;
  maxGroups?: number;
  minSignalsPerGroup?: number;
}

export interface MultiDimensionGroup {
  dimensions: Record<GroupingDimension, string>;
  signals: Signal[];
  count: number;
  healthScore: number;
}

// ============================================================================
// SIGNAL AGGREGATION SERVICE
// ============================================================================

export class SignalAggregationService {
  private groupCache: Map<string, SignalGroup[]> = new Map();
  private healthHistory: Map<string, Array<{ timestamp: string; score: number }>> = new Map();

  /**
   * Aggregate signals by multiple dimensions
   */
  async aggregateSignals(
    signals: Signal[],
    configs: GroupingConfig[]
  ): Promise<AggregationResult> {
    const allGroups: SignalGroup[] = [];

    // Create groups for each dimension
    for (const config of configs) {
      const groups = this.groupByDimension(signals, config);
      allGroups.push(...groups);
    }

    // Cache groups
    const cacheKey = configs.map((c) => c.dimension).join('-');
    this.groupCache.set(cacheKey, allGroups);

    // Generate rollup summaries
    const rollups = this.generateRollups(allGroups);

    // Calculate health scores
    const healthScores = this.calculateHealthScores(allGroups);

    // Find cross-group dependencies
    const crossGroupDependencies = this.findCrossGroupDependencies(allGroups, signals);

    // Calculate global summary
    const globalSummary = this.calculateGlobalSummary(allGroups, healthScores);

    return {
      groups: allGroups,
      rollups,
      healthScores,
      crossGroupDependencies,
      globalSummary,
      aggregatedAt: new Date().toISOString(),
    };
  }

  /**
   * Group signals by a single dimension
   */
  groupByDimension(signals: Signal[], config: GroupingConfig): SignalGroup[] {
    const groupMap = new Map<string, Signal[]>();

    signals.forEach((signal) => {
      const key = this.getGroupKey(signal, config);
      if (!groupMap.has(key)) {
        groupMap.set(key, []);
      }
      groupMap.get(key)!.push(signal);
    });

    // Convert to SignalGroup objects
    const groups: SignalGroup[] = [];

    groupMap.forEach((groupSignals, key) => {
      // Skip if below minimum threshold
      if (config.minSignalsPerGroup && groupSignals.length < config.minSignalsPerGroup) {
        return;
      }

      const label = config.customLabel ? config.customLabel(key) : this.getDefaultLabel(key, config.dimension);

      groups.push({
        id: `${config.dimension}-${key}`,
        dimension: config.dimension,
        key,
        label,
        signals: groupSignals,
        count: groupSignals.length,
        healthScore: this.calculateGroupHealth(groupSignals),
        urgencyDistribution: this.getUrgencyDistribution(groupSignals),
        impactDistribution: this.getImpactDistribution(groupSignals),
        typeDistribution: this.getTypeDistribution(groupSignals),
        averageConfidence: this.getAverageConfidence(groupSignals),
        oldestSignal: this.getOldestSignal(groupSignals),
        newestSignal: this.getNewestSignal(groupSignals),
        metadata: {},
      });
    });

    // Sort by count or urgency
    groups.sort((a, b) => {
      const aCritical = a.urgencyDistribution.critical || 0;
      const bCritical = b.urgencyDistribution.critical || 0;
      if (aCritical !== bCritical) return bCritical - aCritical;
      return b.count - a.count;
    });

    // Limit number of groups if specified
    if (config.maxGroups && groups.length > config.maxGroups) {
      return groups.slice(0, config.maxGroups);
    }

    return groups;
  }

  /**
   * Get the grouping key for a signal
   */
  private getGroupKey(signal: Signal, config: GroupingConfig): string {
    if (config.customKey) {
      return config.customKey(signal);
    }

    switch (config.dimension) {
      case 'project':
        return signal.metadata?.project_id || signal.related_entity_id || 'unassigned';
      case 'goal':
        return signal.metadata?.goal_id || 'no-goal';
      case 'person':
        return signal.metadata?.assignee_id || signal.user_id;
      case 'type':
        return signal.signal_type;
      case 'urgency':
        return signal.urgency;
      case 'impact':
        return signal.impact;
      case 'source':
        return signal.source_data?.source || signal.metadata?.source || 'unknown';
      case 'date':
        return new Date(signal.created_at).toISOString().slice(0, 10);
      default:
        return 'default';
    }
  }

  /**
   * Get default label for a group key
   */
  private getDefaultLabel(key: string, dimension: GroupingDimension): string {
    switch (dimension) {
      case 'project':
        return key === 'unassigned' ? 'Unassigned Signals' : `Project: ${key}`;
      case 'goal':
        return key === 'no-goal' ? 'No Goal Assigned' : `Goal: ${key}`;
      case 'person':
        return `Assigned to: ${key}`;
      case 'type':
        return key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
      case 'urgency':
        return `${key.charAt(0).toUpperCase() + key.slice(1)} Urgency`;
      case 'impact':
        return `${key.charAt(0).toUpperCase() + key.slice(1)} Impact`;
      case 'source':
        return key === 'unknown' ? 'Unknown Source' : `Source: ${key}`;
      case 'date':
        return new Date(key).toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        });
      default:
        return key;
    }
  }

  /**
   * Calculate health score for a group of signals
   */
  private calculateGroupHealth(signals: Signal[]): number {
    if (signals.length === 0) return 100;

    let score = 100;

    // Deduct for critical/high urgency signals
    const criticalCount = signals.filter((s) => s.urgency === 'critical').length;
    const highCount = signals.filter((s) => s.urgency === 'high').length;
    score -= criticalCount * 15;
    score -= highCount * 8;

    // Deduct for unresolved signals
    const unresolvedCount = signals.filter((s) => s.status === 'active').length;
    const unresolvedRatio = unresolvedCount / signals.length;
    score -= unresolvedRatio * 20;

    // Deduct for old signals
    const now = Date.now();
    signals.forEach((signal) => {
      const ageHours = (now - new Date(signal.created_at).getTime()) / (1000 * 60 * 60);
      if (ageHours > 168) score -= 5; // > 1 week
      else if (ageHours > 72) score -= 2; // > 3 days
    });

    // Boost for high confidence
    const avgConfidence = this.getAverageConfidence(signals);
    score += avgConfidence * 10;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Get urgency distribution for signals
   */
  private getUrgencyDistribution(signals: Signal[]): Record<UrgencyLevel, number> {
    const distribution: Record<UrgencyLevel, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };

    signals.forEach((s) => {
      distribution[s.urgency]++;
    });

    return distribution;
  }

  /**
   * Get impact distribution for signals
   */
  private getImpactDistribution(signals: Signal[]): Record<ImpactLevel, number> {
    const distribution: Record<ImpactLevel, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };

    signals.forEach((s) => {
      distribution[s.impact]++;
    });

    return distribution;
  }

  /**
   * Get type distribution for signals
   */
  private getTypeDistribution(signals: Signal[]): Record<string, number> {
    const distribution: Record<string, number> = {};

    signals.forEach((s) => {
      distribution[s.signal_type] = (distribution[s.signal_type] || 0) + 1;
    });

    return distribution;
  }

  /**
   * Get average confidence for signals
   */
  private getAverageConfidence(signals: Signal[]): number {
    if (signals.length === 0) return 0;
    return signals.reduce((sum, s) => sum + s.confidence, 0) / signals.length;
  }

  /**
   * Get oldest signal timestamp
   */
  private getOldestSignal(signals: Signal[]): string {
    if (signals.length === 0) return '';
    return signals.reduce((oldest, s) =>
      new Date(s.created_at) < new Date(oldest.created_at) ? s : oldest
    ).created_at;
  }

  /**
   * Get newest signal timestamp
   */
  private getNewestSignal(signals: Signal[]): string {
    if (signals.length === 0) return '';
    return signals.reduce((newest, s) =>
      new Date(s.created_at) > new Date(newest.created_at) ? s : newest
    ).created_at;
  }

  /**
   * Generate rollup summaries for groups
   */
  generateRollups(groups: SignalGroup[]): RollupSummary[] {
    return groups.map((group) => {
      const activeSignals = group.signals.filter((s) => s.status === 'active').length;
      const resolvedSignals = group.signals.filter((s) => s.status === 'resolved').length;

      // Determine trend based on health history
      const trend = this.determineTrend(group.id);

      // Get top issues
      const topIssues = group.signals
        .filter((s) => s.status === 'active')
        .sort((a, b) => {
          const urgencyOrder = { critical: 4, high: 3, medium: 2, low: 1 };
          return urgencyOrder[b.urgency] - urgencyOrder[a.urgency];
        })
        .slice(0, 3)
        .map((s) => ({
          signalId: s.id,
          title: s.title,
          urgency: s.urgency,
          impact: s.impact,
        }));

      // Generate action items
      const actionItems = this.generateActionItems(group);

      return {
        groupId: group.id,
        groupLabel: group.label,
        totalSignals: group.count,
        activeSignals,
        resolvedSignals,
        criticalCount: group.urgencyDistribution.critical,
        highCount: group.urgencyDistribution.high,
        mediumCount: group.urgencyDistribution.medium,
        lowCount: group.urgencyDistribution.low,
        healthScore: group.healthScore,
        trend,
        topIssues,
        actionItems,
        lastUpdated: group.newestSignal,
      };
    });
  }

  /**
   * Determine trend for a group
   */
  private determineTrend(groupId: string): 'improving' | 'stable' | 'declining' {
    const history = this.healthHistory.get(groupId) || [];

    if (history.length < 2) return 'stable';

    const recent = history.slice(-5);
    const avgRecent = recent.reduce((sum, h) => sum + h.score, 0) / recent.length;
    const avgOlder = history.slice(-10, -5).reduce((sum, h) => sum + h.score, 0) / Math.max(1, history.slice(-10, -5).length);

    if (avgRecent > avgOlder + 5) return 'improving';
    if (avgRecent < avgOlder - 5) return 'declining';
    return 'stable';
  }

  /**
   * Generate action items for a group
   */
  private generateActionItems(group: SignalGroup): string[] {
    const items: string[] = [];

    // Critical signals need immediate attention
    if (group.urgencyDistribution.critical > 0) {
      items.push(`Address ${group.urgencyDistribution.critical} critical signal(s) immediately`);
    }

    // High count of high urgency signals
    if (group.urgencyDistribution.high >= 3) {
      items.push(`Prioritize ${group.urgencyDistribution.high} high-urgency signals`);
    }

    // Low health score
    if (group.healthScore < 50) {
      items.push('Group health is low - consider resource reallocation');
    }

    // Many old signals
    const now = Date.now();
    const oldSignals = group.signals.filter((s) => {
      const ageHours = (now - new Date(s.created_at).getTime()) / (1000 * 60 * 60);
      return ageHours > 72 && s.status === 'active';
    }).length;
    if (oldSignals > 0) {
      items.push(`Review ${oldSignals} signal(s) older than 3 days`);
    }

    // Low confidence signals
    const lowConfidence = group.signals.filter((s) => s.confidence < 0.5).length;
    if (lowConfidence > 0) {
      items.push(`Verify ${lowConfidence} low-confidence signal(s)`);
    }

    return items.slice(0, 5);
  }

  /**
   * Calculate health scores for all groups
   */
  calculateHealthScores(groups: SignalGroup[]): GroupHealthScore[] {
    return groups.map((group) => {
      // Component scores
      const urgencyScore = this.calculateUrgencyComponent(group);
      const resolutionRate = this.calculateResolutionComponent(group);
      const ageScore = this.calculateAgeComponent(group);
      const trendScore = this.calculateTrendComponent(group.id);
      const confidenceScore = group.averageConfidence * 100;

      // Weighted overall score
      const score =
        urgencyScore * 0.3 +
        resolutionRate * 0.25 +
        ageScore * 0.2 +
        trendScore * 0.15 +
        confidenceScore * 0.1;

      // Determine status
      let status: GroupHealthScore['status'] = 'healthy';
      if (score < 40) status = 'critical';
      else if (score < 70) status = 'warning';

      // Generate recommendations
      const recommendations = this.generateHealthRecommendations(group, {
        urgencyScore,
        resolutionRate,
        ageScore,
        trendScore,
        confidenceScore,
      });

      // Store in history
      if (!this.healthHistory.has(group.id)) {
        this.healthHistory.set(group.id, []);
      }
      this.healthHistory.get(group.id)!.push({
        timestamp: new Date().toISOString(),
        score,
      });

      return {
        groupId: group.id,
        score,
        components: {
          urgencyScore,
          resolutionRate,
          ageScore,
          trendScore,
          confidenceScore,
        },
        status,
        recommendations,
      };
    });
  }

  /**
   * Calculate urgency component score
   */
  private calculateUrgencyComponent(group: SignalGroup): number {
    const total = group.count;
    if (total === 0) return 100;

    const weights = { critical: 0, high: 33, medium: 67, low: 100 };
    const weightedSum =
      group.urgencyDistribution.critical * weights.critical +
      group.urgencyDistribution.high * weights.high +
      group.urgencyDistribution.medium * weights.medium +
      group.urgencyDistribution.low * weights.low;

    return weightedSum / total;
  }

  /**
   * Calculate resolution component score
   */
  private calculateResolutionComponent(group: SignalGroup): number {
    const resolved = group.signals.filter((s) => s.status === 'resolved').length;
    return group.count > 0 ? (resolved / group.count) * 100 : 100;
  }

  /**
   * Calculate age component score
   */
  private calculateAgeComponent(group: SignalGroup): number {
    if (group.count === 0) return 100;

    const now = Date.now();
    let score = 100;

    group.signals.forEach((signal) => {
      if (signal.status !== 'active') return;

      const ageHours = (now - new Date(signal.created_at).getTime()) / (1000 * 60 * 60);
      if (ageHours > 168) score -= 10;
      else if (ageHours > 72) score -= 5;
      else if (ageHours > 24) score -= 2;
    });

    return Math.max(0, score);
  }

  /**
   * Calculate trend component score
   */
  private calculateTrendComponent(groupId: string): number {
    const history = this.healthHistory.get(groupId) || [];
    if (history.length < 2) return 50; // Neutral

    const recent = history.slice(-3);
    const older = history.slice(-6, -3);

    if (older.length === 0) return 50;

    const avgRecent = recent.reduce((sum, h) => sum + h.score, 0) / recent.length;
    const avgOlder = older.reduce((sum, h) => sum + h.score, 0) / older.length;

    // Map improvement to 0-100 scale
    const improvement = avgRecent - avgOlder;
    return Math.max(0, Math.min(100, 50 + improvement));
  }

  /**
   * Generate health recommendations
   */
  private generateHealthRecommendations(
    group: SignalGroup,
    components: GroupHealthScore['components']
  ): string[] {
    const recommendations: string[] = [];

    if (components.urgencyScore < 40) {
      recommendations.push('High concentration of critical/high urgency signals - prioritize resolution');
    }

    if (components.resolutionRate < 30) {
      recommendations.push('Low resolution rate - consider additional resources or process review');
    }

    if (components.ageScore < 50) {
      recommendations.push('Many signals are aging - review and address or close stale items');
    }

    if (components.trendScore < 40) {
      recommendations.push('Health trend is declining - investigate root causes');
    }

    if (components.confidenceScore < 50) {
      recommendations.push('Many low-confidence signals - verify data sources and detection accuracy');
    }

    return recommendations;
  }

  /**
   * Find cross-group dependencies
   */
  findCrossGroupDependencies(
    groups: SignalGroup[],
    signals: Signal[]
  ): CrossGroupDependency[] {
    const dependencies: CrossGroupDependency[] = [];
    const signalToGroups = new Map<string, string[]>();

    // Map signals to their groups
    groups.forEach((group) => {
      group.signals.forEach((signal) => {
        if (!signalToGroups.has(signal.id)) {
          signalToGroups.set(signal.id, []);
        }
        signalToGroups.get(signal.id)!.push(group.id);
      });
    });

    // Find groups that share signals with related entities
    for (let i = 0; i < groups.length; i++) {
      for (let j = i + 1; j < groups.length; j++) {
        const group1 = groups[i];
        const group2 = groups[j];

        // Find shared signal relationships
        const sharedSignals: string[] = [];
        let strength = 0;

        group1.signals.forEach((s1) => {
          group2.signals.forEach((s2) => {
            // Check for explicit relationships
            if (s1.related_entity_id === s2.id || s2.related_entity_id === s1.id) {
              sharedSignals.push(s1.id, s2.id);
              strength += 0.3;
            }

            // Check for same related entity
            if (s1.related_entity_id && s1.related_entity_id === s2.related_entity_id) {
              sharedSignals.push(s1.id, s2.id);
              strength += 0.2;
            }

            // Check for dependency signals
            if (s1.signal_type === 'dependency' && s2.signal_type === 'dependency') {
              sharedSignals.push(s1.id, s2.id);
              strength += 0.1;
            }
          });
        });

        if (sharedSignals.length > 0) {
          const uniqueShared = [...new Set(sharedSignals)];
          const dependencyType = this.determineDependencyType(
            group1.signals.filter((s) => uniqueShared.includes(s.id)),
            group2.signals.filter((s) => uniqueShared.includes(s.id))
          );

          dependencies.push({
            sourceGroupId: group1.id,
            targetGroupId: group2.id,
            dependencyType,
            strength: Math.min(1, strength),
            sharedSignals: uniqueShared,
            description: this.describeDependency(group1, group2, dependencyType),
          });
        }
      }
    }

    return dependencies.sort((a, b) => b.strength - a.strength);
  }

  /**
   * Determine type of dependency between groups
   */
  private determineDependencyType(
    signals1: Signal[],
    signals2: Signal[]
  ): CrossGroupDependency['dependencyType'] {
    const types1 = new Set(signals1.map((s) => s.signal_type));
    const types2 = new Set(signals2.map((s) => s.signal_type));

    if (types1.has('dependency') || types2.has('dependency')) {
      return 'blocking';
    }

    // Check temporal relationship
    const avgTime1 =
      signals1.reduce((sum, s) => sum + new Date(s.created_at).getTime(), 0) / signals1.length;
    const avgTime2 =
      signals2.reduce((sum, s) => sum + new Date(s.created_at).getTime(), 0) / signals2.length;

    if (Math.abs(avgTime1 - avgTime2) < 24 * 60 * 60 * 1000) {
      return 'temporal';
    }

    return 'related';
  }

  /**
   * Describe the dependency between groups
   */
  private describeDependency(
    group1: SignalGroup,
    group2: SignalGroup,
    type: CrossGroupDependency['dependencyType']
  ): string {
    switch (type) {
      case 'blocking':
        return `${group1.label} may block progress on ${group2.label}`;
      case 'temporal':
        return `${group1.label} and ${group2.label} have temporally related signals`;
      case 'causal':
        return `${group1.label} may cause signals in ${group2.label}`;
      default:
        return `${group1.label} is related to ${group2.label}`;
    }
  }

  /**
   * Calculate global summary
   */
  private calculateGlobalSummary(
    groups: SignalGroup[],
    healthScores: GroupHealthScore[]
  ): AggregationResult['globalSummary'] {
    const totalSignals = groups.reduce((sum, g) => sum + g.count, 0);
    const overallHealth =
      healthScores.length > 0
        ? healthScores.reduce((sum, h) => sum + h.score, 0) / healthScores.length
        : 100;

    const criticalGroups = healthScores.filter((h) => h.status === 'critical').length;
    const warningGroups = healthScores.filter((h) => h.status === 'warning').length;
    const healthyGroups = healthScores.filter((h) => h.status === 'healthy').length;

    return {
      totalGroups: groups.length,
      totalSignals,
      overallHealth,
      criticalGroups,
      warningGroups,
      healthyGroups,
    };
  }

  /**
   * Group signals by multiple dimensions
   */
  async multiDimensionGroup(
    signals: Signal[],
    dimensions: GroupingDimension[]
  ): Promise<MultiDimensionGroup[]> {
    const groupMap = new Map<string, Signal[]>();

    signals.forEach((signal) => {
      const keys: string[] = [];
      dimensions.forEach((dim) => {
        const config: GroupingConfig = { dimension: dim };
        keys.push(this.getGroupKey(signal, config));
      });

      const compositeKey = keys.join('|');
      if (!groupMap.has(compositeKey)) {
        groupMap.set(compositeKey, []);
      }
      groupMap.get(compositeKey)!.push(signal);
    });

    const groups: MultiDimensionGroup[] = [];

    groupMap.forEach((groupSignals, compositeKey) => {
      const keyParts = compositeKey.split('|');
      const dimensionMap: Record<GroupingDimension, string> = {} as Record<GroupingDimension, string>;

      dimensions.forEach((dim, idx) => {
        dimensionMap[dim] = keyParts[idx];
      });

      groups.push({
        dimensions: dimensionMap,
        signals: groupSignals,
        count: groupSignals.length,
        healthScore: this.calculateGroupHealth(groupSignals),
      });
    });

    return groups.sort((a, b) => b.count - a.count);
  }

  /**
   * Get summary for a specific group
   */
  getGroupSummary(groupId: string): RollupSummary | undefined {
    for (const groups of this.groupCache.values()) {
      const group = groups.find((g) => g.id === groupId);
      if (group) {
        return this.generateRollups([group])[0];
      }
    }
    return undefined;
  }

  /**
   * Get health trend for a group
   */
  getHealthTrend(groupId: string): Array<{ timestamp: string; score: number }> {
    return this.healthHistory.get(groupId) || [];
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.groupCache.clear();
  }
}

// Singleton instance
export const signalAggregationService = new SignalAggregationService();
