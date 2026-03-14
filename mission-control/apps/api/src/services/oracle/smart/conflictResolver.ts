/**
 * ORACLE Priority Conflict Resolver Service
 * Story smart-6 - Automated conflict resolution
 *
 * Implements:
 * - Multi-criteria decision analysis (AHP - Analytic Hierarchy Process)
 * - Stakeholder preference weighting
 * - Trade-off analysis and visualization data
 * - Compromise suggestion generation
 * - Decision rationale documentation
 *
 * Time Complexity:
 * - AHP calculation: O(n^2 * c) where n=options, c=criteria
 * - Stakeholder weighting: O(s * c) where s=stakeholders
 * - Trade-off analysis: O(n^2 * c)
 * - Compromise generation: O(n * c)
 */

import { oracleCacheService, cacheKey, hashObject } from '../cache';

// ============================================================================
// Types
// ============================================================================

/**
 * Priority criteria for decision making
 */
export interface PriorityCriterion {
  id: string;
  name: string;
  description: string;
  category: 'business' | 'technical' | 'resource' | 'time' | 'risk' | 'quality';
  weight: number; // 0-1, determined by AHP
  direction: 'maximize' | 'minimize';
}

/**
 * Conflicting item (task, project, request, etc.)
 */
export interface ConflictingItem {
  id: string;
  title: string;
  description: string;
  type: 'task' | 'project' | 'request' | 'feature' | 'resource';
  requesterId: string;
  requesterName: string;
  stakeholders: string[];
  criteriaScores: Record<string, number>; // Criterion ID -> Score (0-10)
  metadata: Record<string, any>;
  constraints?: Array<{
    type: 'deadline' | 'dependency' | 'resource' | 'budget';
    description: string;
    flexibility: 'none' | 'low' | 'medium' | 'high';
  }>;
}

/**
 * Stakeholder with preferences
 */
export interface Stakeholder {
  id: string;
  name: string;
  role: string;
  department: string;
  influenceWeight: number; // 0-1, based on role/authority
  preferredCriteria: Array<{
    criterionId: string;
    importance: number; // 1-9 (AHP scale)
  }>;
  preferredItems: string[]; // Item IDs in order of preference
}

/**
 * Pairwise comparison for AHP
 */
export interface PairwiseComparison {
  criterionA: string;
  criterionB: string;
  preference: number; // 1/9 to 9 (AHP scale)
  stakeholderId?: string;
}

/**
 * AHP result
 */
export interface AHPResult {
  weights: Record<string, number>; // Criterion ID -> Weight
  consistencyRatio: number;
  isConsistent: boolean; // CR < 0.1 is consistent
  eigenvalue: number;
}

/**
 * Priority score for an item
 */
export interface PriorityScore {
  itemId: string;
  totalScore: number;
  normalizedScore: number; // 0-1
  rank: number;
  criteriaContributions: Record<string, number>;
  stakeholderSupport: number; // 0-1
  confidenceLevel: number; // 0-1
}

/**
 * Trade-off between two items
 */
export interface TradeOff {
  itemAId: string;
  itemBId: string;
  comparison: {
    criterionId: string;
    criterionName: string;
    itemAScore: number;
    itemBScore: number;
    winner: 'A' | 'B' | 'tie';
    significance: 'low' | 'medium' | 'high';
  }[];
  overallWinner: 'A' | 'B' | 'tie';
  tradeOffSeverity: 'none' | 'low' | 'medium' | 'high';
  recommendation: string;
}

/**
 * Compromise suggestion
 */
export interface CompromiseSuggestion {
  id: string;
  type: 'partial_delivery' | 'phased_approach' | 'resource_sharing' |
        'deadline_adjustment' | 'scope_reduction' | 'parallel_execution';
  title: string;
  description: string;
  affectedItems: string[];
  adjustments: Array<{
    itemId: string;
    adjustment: string;
    impact: 'positive' | 'neutral' | 'negative';
  }>;
  benefitScore: number; // 0-1
  feasibilityScore: number; // 0-1
  stakeholderSatisfaction: Record<string, number>; // Stakeholder ID -> 0-1
  overallSatisfaction: number; // 0-1
  implementationComplexity: 'low' | 'medium' | 'high';
  risks: string[];
}

/**
 * Conflict resolution result
 */
export interface ConflictResolution {
  id: string;
  createdAt: Date;
  conflictId: string;
  items: ConflictingItem[];
  stakeholders: Stakeholder[];
  criteria: PriorityCriterion[];
  ahpResult: AHPResult;
  priorityScores: PriorityScore[];
  tradeOffs: TradeOff[];
  compromises: CompromiseSuggestion[];
  recommendation: {
    approach: 'prioritize_single' | 'compromise' | 'parallel' | 'defer';
    primaryItem?: string;
    rationale: string;
    confidenceLevel: number;
  };
  decisionRationale: DecisionRationale;
}

/**
 * Decision rationale documentation
 */
export interface DecisionRationale {
  summary: string;
  methodology: string;
  keyFactors: Array<{
    factor: string;
    weight: number;
    impact: string;
  }>;
  stakeholderConsiderations: Array<{
    stakeholderName: string;
    preferenceHonored: boolean;
    explanation: string;
  }>;
  tradeOffDecisions: Array<{
    tradeOff: string;
    decision: string;
    justification: string;
  }>;
  alternativesConsidered: Array<{
    alternative: string;
    whyNotChosen: string;
  }>;
  uncertainties: string[];
  recommendedFollowUp: string[];
}

/**
 * Visualization data for trade-off analysis
 */
export interface TradeOffVisualization {
  type: 'radar' | 'heatmap' | 'bar' | 'scatter';
  data: Record<string, any>;
  labels: string[];
  title: string;
  description: string;
}

// Cache TTLs
const CACHE_TTL = {
  resolution: 30 * 60 * 1000, // 30 minutes
  ahp: 60 * 60 * 1000, // 1 hour
};

// AHP Random Consistency Index (RI) for matrix sizes
const AHP_RI: Record<number, number> = {
  1: 0, 2: 0, 3: 0.58, 4: 0.9, 5: 1.12,
  6: 1.24, 7: 1.32, 8: 1.41, 9: 1.45, 10: 1.49,
};

// ============================================================================
// Priority Conflict Resolver Service
// ============================================================================

export class PriorityConflictResolverService {
  private resolutions: Map<string, ConflictResolution> = new Map();

  // Default criteria
  private defaultCriteria: PriorityCriterion[] = [
    {
      id: 'business_value',
      name: 'Business Value',
      description: 'Revenue impact, strategic alignment, customer value',
      category: 'business',
      weight: 0.25,
      direction: 'maximize',
    },
    {
      id: 'urgency',
      name: 'Urgency',
      description: 'Time sensitivity and deadline pressure',
      category: 'time',
      weight: 0.20,
      direction: 'maximize',
    },
    {
      id: 'effort',
      name: 'Implementation Effort',
      description: 'Resources and time required',
      category: 'resource',
      weight: 0.15,
      direction: 'minimize',
    },
    {
      id: 'risk',
      name: 'Risk Level',
      description: 'Technical and business risk',
      category: 'risk',
      weight: 0.15,
      direction: 'minimize',
    },
    {
      id: 'dependencies',
      name: 'Dependency Impact',
      description: 'How many other items depend on this',
      category: 'technical',
      weight: 0.15,
      direction: 'maximize',
    },
    {
      id: 'stakeholder_priority',
      name: 'Stakeholder Priority',
      description: 'Importance to key stakeholders',
      category: 'business',
      weight: 0.10,
      direction: 'maximize',
    },
  ];

  // ============================================================================
  // Main Resolution API
  // ============================================================================

  /**
   * Resolve priority conflict between items
   * O(n^2 * c + s * c + n * c) where n=items, c=criteria, s=stakeholders
   */
  async resolveConflict(
    conflictId: string,
    items: ConflictingItem[],
    stakeholders: Stakeholder[],
    options: {
      customCriteria?: PriorityCriterion[];
      pairwiseComparisons?: PairwiseComparison[];
      generateCompromises?: boolean;
      maxCompromises?: number;
    } = {}
  ): Promise<ConflictResolution> {
    const cacheKeyStr = cacheKey('resolution', conflictId, hashObject({
      items: items.map(i => i.id),
      stakeholders: stakeholders.map(s => s.id),
    }));

    const cached = oracleCacheService.get<ConflictResolution>(cacheKeyStr);
    if (cached) return cached;

    // Use custom or default criteria
    const criteria = options.customCriteria || this.defaultCriteria;

    // Calculate AHP weights if pairwise comparisons provided
    const ahpResult = options.pairwiseComparisons
      ? this.calculateAHPWeights(criteria, options.pairwiseComparisons, stakeholders)
      : this.useDefaultWeights(criteria);

    // Update criteria weights from AHP
    const weightedCriteria = criteria.map(c => ({
      ...c,
      weight: ahpResult.weights[c.id] || c.weight,
    }));

    // Calculate priority scores
    const priorityScores = this.calculatePriorityScores(
      items,
      weightedCriteria,
      stakeholders
    );

    // Analyze trade-offs
    const tradeOffs = this.analyzeTradeOffs(items, weightedCriteria);

    // Generate compromise suggestions
    const compromises = options.generateCompromises !== false
      ? this.generateCompromises(items, weightedCriteria, stakeholders, options.maxCompromises || 5)
      : [];

    // Build recommendation
    const recommendation = this.buildRecommendation(
      priorityScores,
      tradeOffs,
      compromises,
      stakeholders
    );

    // Document rationale
    const decisionRationale = this.documentRationale(
      items,
      stakeholders,
      weightedCriteria,
      priorityScores,
      tradeOffs,
      recommendation
    );

    const resolution: ConflictResolution = {
      id: `res-${conflictId}-${Date.now()}`,
      createdAt: new Date(),
      conflictId,
      items,
      stakeholders,
      criteria: weightedCriteria,
      ahpResult,
      priorityScores,
      tradeOffs,
      compromises,
      recommendation,
      decisionRationale,
    };

    this.resolutions.set(resolution.id, resolution);
    oracleCacheService.set(cacheKeyStr, resolution, CACHE_TTL.resolution);

    return resolution;
  }

  // ============================================================================
  // AHP (Analytic Hierarchy Process)
  // ============================================================================

  /**
   * Calculate criteria weights using AHP method
   * O(c^2 * s) where c=criteria, s=stakeholders
   */
  private calculateAHPWeights(
    criteria: PriorityCriterion[],
    comparisons: PairwiseComparison[],
    stakeholders: Stakeholder[]
  ): AHPResult {
    const n = criteria.length;

    // Initialize comparison matrix
    const matrix: number[][] = Array(n).fill(null).map(() => Array(n).fill(1));

    // Fill matrix from pairwise comparisons
    for (const comparison of comparisons) {
      const iA = criteria.findIndex(c => c.id === comparison.criterionA);
      const iB = criteria.findIndex(c => c.id === comparison.criterionB);

      if (iA >= 0 && iB >= 0) {
        // Weight by stakeholder influence if applicable
        let weight = 1;
        if (comparison.stakeholderId) {
          const stakeholder = stakeholders.find(s => s.id === comparison.stakeholderId);
          weight = stakeholder?.influenceWeight || 1;
        }

        // Aggregate comparisons (geometric mean for multiple stakeholders)
        const currentValue = matrix[iA][iB];
        if (currentValue === 1) {
          matrix[iA][iB] = comparison.preference * weight;
          matrix[iB][iA] = (1 / comparison.preference) * weight;
        } else {
          matrix[iA][iB] = Math.sqrt(currentValue * comparison.preference * weight);
          matrix[iB][iA] = 1 / matrix[iA][iB];
        }
      }
    }

    // Calculate eigenvector (priority weights)
    const weights = this.calculateEigenvector(matrix, n);

    // Normalize weights
    const sumWeights = weights.reduce((a, b) => a + b, 0);
    const normalizedWeights = weights.map(w => w / sumWeights);

    // Calculate consistency ratio
    const { eigenvalue, consistencyRatio } = this.calculateConsistency(matrix, normalizedWeights, n);

    // Build result
    const weightsMap: Record<string, number> = {};
    criteria.forEach((c, i) => {
      weightsMap[c.id] = normalizedWeights[i];
    });

    return {
      weights: weightsMap,
      consistencyRatio,
      isConsistent: consistencyRatio < 0.1,
      eigenvalue,
    };
  }

  /**
   * Calculate eigenvector using power iteration
   * O(n^2 * i) where n=matrix size, i=iterations
   */
  private calculateEigenvector(matrix: number[][], n: number, iterations: number = 100): number[] {
    // Initialize vector
    let vector = Array(n).fill(1 / n);

    for (let iter = 0; iter < iterations; iter++) {
      // Multiply matrix by vector
      const newVector = Array(n).fill(0);
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          newVector[i] += matrix[i][j] * vector[j];
        }
      }

      // Normalize
      const sum = newVector.reduce((a, b) => a + b, 0);
      vector = newVector.map(v => v / sum);
    }

    return vector;
  }

  /**
   * Calculate consistency ratio for AHP
   * O(n^2)
   */
  private calculateConsistency(
    matrix: number[][],
    weights: number[],
    n: number
  ): { eigenvalue: number; consistencyRatio: number } {
    // Calculate Aw (matrix * weights)
    const aw = Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        aw[i] += matrix[i][j] * weights[j];
      }
    }

    // Calculate lambda_max (maximum eigenvalue)
    let lambdaMax = 0;
    for (let i = 0; i < n; i++) {
      if (weights[i] > 0) {
        lambdaMax += aw[i] / weights[i];
      }
    }
    lambdaMax /= n;

    // Calculate Consistency Index (CI)
    const ci = (lambdaMax - n) / (n - 1);

    // Get Random Consistency Index (RI)
    const ri = AHP_RI[n] || 1.49;

    // Calculate Consistency Ratio (CR)
    const cr = ri > 0 ? ci / ri : 0;

    return {
      eigenvalue: lambdaMax,
      consistencyRatio: Math.abs(cr),
    };
  }

  /**
   * Use default weights when no pairwise comparisons provided
   */
  private useDefaultWeights(criteria: PriorityCriterion[]): AHPResult {
    const weights: Record<string, number> = {};
    criteria.forEach(c => {
      weights[c.id] = c.weight;
    });

    return {
      weights,
      consistencyRatio: 0,
      isConsistent: true,
      eigenvalue: criteria.length,
    };
  }

  // ============================================================================
  // Priority Scoring
  // ============================================================================

  /**
   * Calculate priority scores for all items
   * O(n * c + n * s) where n=items, c=criteria, s=stakeholders
   */
  private calculatePriorityScores(
    items: ConflictingItem[],
    criteria: PriorityCriterion[],
    stakeholders: Stakeholder[]
  ): PriorityScore[] {
    const scores: PriorityScore[] = [];

    for (const item of items) {
      const criteriaContributions: Record<string, number> = {};
      let totalScore = 0;

      // Calculate weighted score from each criterion
      for (const criterion of criteria) {
        const rawScore = item.criteriaScores[criterion.id] || 5;

        // Normalize to 0-1 (assuming 0-10 scale)
        let normalizedScore = rawScore / 10;

        // Invert if minimizing
        if (criterion.direction === 'minimize') {
          normalizedScore = 1 - normalizedScore;
        }

        const contribution = normalizedScore * criterion.weight;
        criteriaContributions[criterion.id] = contribution;
        totalScore += contribution;
      }

      // Calculate stakeholder support
      const stakeholderSupport = this.calculateStakeholderSupport(item, stakeholders);

      // Adjust total score by stakeholder support (20% influence)
      totalScore = totalScore * 0.8 + stakeholderSupport * 0.2;

      // Calculate confidence level
      const confidenceLevel = this.calculateConfidenceLevel(item, criteria);

      scores.push({
        itemId: item.id,
        totalScore,
        normalizedScore: totalScore, // Already 0-1
        rank: 0, // Will be set after sorting
        criteriaContributions,
        stakeholderSupport,
        confidenceLevel,
      });
    }

    // Sort and assign ranks
    scores.sort((a, b) => b.totalScore - a.totalScore);
    scores.forEach((score, index) => {
      score.rank = index + 1;
    });

    return scores;
  }

  /**
   * Calculate stakeholder support for an item
   * O(s) where s=stakeholders
   */
  private calculateStakeholderSupport(
    item: ConflictingItem,
    stakeholders: Stakeholder[]
  ): number {
    if (stakeholders.length === 0) return 0.5;

    let weightedSupport = 0;
    let totalWeight = 0;

    for (const stakeholder of stakeholders) {
      const preferenceIndex = stakeholder.preferredItems.indexOf(item.id);
      const maxIndex = stakeholder.preferredItems.length;

      // Calculate preference score (1.0 for first choice, decreasing for others)
      let preferenceScore = 0.5; // Default neutral
      if (preferenceIndex >= 0) {
        preferenceScore = 1 - (preferenceIndex / (maxIndex || 1));
      }

      // Check if item requester is this stakeholder
      if (item.requesterId === stakeholder.id) {
        preferenceScore = Math.max(preferenceScore, 0.8);
      }

      // Check if stakeholder is in item's stakeholders list
      if (item.stakeholders.includes(stakeholder.id)) {
        preferenceScore = Math.max(preferenceScore, 0.6);
      }

      weightedSupport += preferenceScore * stakeholder.influenceWeight;
      totalWeight += stakeholder.influenceWeight;
    }

    return totalWeight > 0 ? weightedSupport / totalWeight : 0.5;
  }

  /**
   * Calculate confidence level for a score
   */
  private calculateConfidenceLevel(
    item: ConflictingItem,
    criteria: PriorityCriterion[]
  ): number {
    // Confidence decreases if criteria scores are missing
    let scoredCriteria = 0;
    for (const criterion of criteria) {
      if (item.criteriaScores[criterion.id] !== undefined) {
        scoredCriteria++;
      }
    }

    const completeness = scoredCriteria / criteria.length;

    // Confidence also affected by score extremity (extreme scores = higher confidence)
    const scores = Object.values(item.criteriaScores);
    const avgScore = scores.reduce((a, b) => a + b, 0) / (scores.length || 1);
    const variance = scores.reduce((sum, s) => sum + Math.pow(s - avgScore, 2), 0) / (scores.length || 1);

    // Higher variance = more distinct = more confident
    const distinctiveness = Math.min(1, Math.sqrt(variance) / 3);

    return completeness * 0.6 + distinctiveness * 0.4;
  }

  // ============================================================================
  // Trade-Off Analysis
  // ============================================================================

  /**
   * Analyze trade-offs between all pairs of items
   * O(n^2 * c) where n=items, c=criteria
   */
  private analyzeTradeOffs(
    items: ConflictingItem[],
    criteria: PriorityCriterion[]
  ): TradeOff[] {
    const tradeOffs: TradeOff[] = [];

    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const tradeOff = this.compareItems(items[i], items[j], criteria);
        tradeOffs.push(tradeOff);
      }
    }

    return tradeOffs;
  }

  /**
   * Compare two items across all criteria
   * O(c) where c=criteria
   */
  private compareItems(
    itemA: ConflictingItem,
    itemB: ConflictingItem,
    criteria: PriorityCriterion[]
  ): TradeOff {
    const comparison: TradeOff['comparison'] = [];
    let aWins = 0;
    let bWins = 0;
    let ties = 0;
    let significantDifferences = 0;

    for (const criterion of criteria) {
      const scoreA = itemA.criteriaScores[criterion.id] || 5;
      const scoreB = itemB.criteriaScores[criterion.id] || 5;

      let winner: 'A' | 'B' | 'tie';
      const difference = Math.abs(scoreA - scoreB);

      if (criterion.direction === 'minimize') {
        // Lower is better
        if (scoreA < scoreB - 0.5) {
          winner = 'A';
          aWins++;
        } else if (scoreB < scoreA - 0.5) {
          winner = 'B';
          bWins++;
        } else {
          winner = 'tie';
          ties++;
        }
      } else {
        // Higher is better
        if (scoreA > scoreB + 0.5) {
          winner = 'A';
          aWins++;
        } else if (scoreB > scoreA + 0.5) {
          winner = 'B';
          bWins++;
        } else {
          winner = 'tie';
          ties++;
        }
      }

      let significance: 'low' | 'medium' | 'high';
      if (difference >= 3) {
        significance = 'high';
        significantDifferences++;
      } else if (difference >= 1.5) {
        significance = 'medium';
      } else {
        significance = 'low';
      }

      comparison.push({
        criterionId: criterion.id,
        criterionName: criterion.name,
        itemAScore: scoreA,
        itemBScore: scoreB,
        winner,
        significance,
      });
    }

    // Determine overall winner
    let overallWinner: 'A' | 'B' | 'tie';
    if (aWins > bWins + 1) {
      overallWinner = 'A';
    } else if (bWins > aWins + 1) {
      overallWinner = 'B';
    } else {
      overallWinner = 'tie';
    }

    // Determine trade-off severity
    let tradeOffSeverity: 'none' | 'low' | 'medium' | 'high';
    if (significantDifferences === 0) {
      tradeOffSeverity = 'none';
    } else if (significantDifferences <= 2) {
      tradeOffSeverity = 'low';
    } else if (significantDifferences <= 4) {
      tradeOffSeverity = 'medium';
    } else {
      tradeOffSeverity = 'high';
    }

    // Generate recommendation
    const recommendation = this.generateTradeOffRecommendation(
      itemA,
      itemB,
      comparison,
      overallWinner,
      tradeOffSeverity
    );

    return {
      itemAId: itemA.id,
      itemBId: itemB.id,
      comparison,
      overallWinner,
      tradeOffSeverity,
      recommendation,
    };
  }

  /**
   * Generate recommendation for a trade-off
   */
  private generateTradeOffRecommendation(
    itemA: ConflictingItem,
    itemB: ConflictingItem,
    comparison: TradeOff['comparison'],
    winner: 'A' | 'B' | 'tie',
    severity: 'none' | 'low' | 'medium' | 'high'
  ): string {
    if (winner === 'tie') {
      if (severity === 'none' || severity === 'low') {
        return `"${itemA.title}" and "${itemB.title}" are nearly equivalent. Decision can be based on secondary factors.`;
      } else {
        return `"${itemA.title}" and "${itemB.title}" have significant trade-offs with no clear winner. Consider compromise or stakeholder input.`;
      }
    }

    const winnerItem = winner === 'A' ? itemA : itemB;
    const loserItem = winner === 'A' ? itemB : itemA;

    // Find key differentiators
    const keyWins = comparison
      .filter(c => c.winner === winner && c.significance !== 'low')
      .map(c => c.criterionName);

    if (keyWins.length > 0) {
      return `"${winnerItem.title}" is preferred, particularly in ${keyWins.join(', ')}. Consider "${loserItem.title}" for next priority.`;
    }

    return `"${winnerItem.title}" edges out "${itemB.title}" overall, though differences are modest.`;
  }

  /**
   * Generate visualization data for trade-offs
   */
  generateVisualizationData(resolution: ConflictResolution): TradeOffVisualization[] {
    const visualizations: TradeOffVisualization[] = [];

    // Radar chart data for top items
    const topItems = resolution.priorityScores.slice(0, 5);
    const radarData: Record<string, any> = {
      labels: resolution.criteria.map(c => c.name),
      datasets: topItems.map((score, index) => {
        const item = resolution.items.find(i => i.id === score.itemId);
        return {
          label: item?.title || score.itemId,
          data: resolution.criteria.map(c => score.criteriaContributions[c.id] * 100),
          backgroundColor: `hsla(${index * 72}, 70%, 50%, 0.2)`,
          borderColor: `hsl(${index * 72}, 70%, 50%)`,
        };
      }),
    };

    visualizations.push({
      type: 'radar',
      data: radarData,
      labels: resolution.criteria.map(c => c.name),
      title: 'Criteria Comparison Radar',
      description: 'Comparison of top items across all priority criteria',
    });

    // Heatmap for trade-off severity
    const heatmapData: number[][] = [];
    const itemLabels = resolution.items.map(i => i.title);

    for (let i = 0; i < resolution.items.length; i++) {
      heatmapData.push([]);
      for (let j = 0; j < resolution.items.length; j++) {
        if (i === j) {
          heatmapData[i].push(0);
        } else {
          const tradeOff = resolution.tradeOffs.find(
            t => (t.itemAId === resolution.items[i].id && t.itemBId === resolution.items[j].id) ||
                 (t.itemAId === resolution.items[j].id && t.itemBId === resolution.items[i].id)
          );
          const severityMap = { none: 0, low: 1, medium: 2, high: 3 };
          heatmapData[i].push(severityMap[tradeOff?.tradeOffSeverity || 'none']);
        }
      }
    }

    visualizations.push({
      type: 'heatmap',
      data: { matrix: heatmapData, xLabels: itemLabels, yLabels: itemLabels },
      labels: itemLabels,
      title: 'Trade-Off Severity Matrix',
      description: 'Shows severity of trade-offs between each pair of items (0=none, 3=high)',
    });

    // Bar chart for priority scores
    visualizations.push({
      type: 'bar',
      data: {
        labels: resolution.priorityScores.map(s => {
          const item = resolution.items.find(i => i.id === s.itemId);
          return item?.title || s.itemId;
        }),
        values: resolution.priorityScores.map(s => s.totalScore * 100),
        stakeholderSupport: resolution.priorityScores.map(s => s.stakeholderSupport * 100),
      },
      labels: resolution.priorityScores.map(s => s.itemId),
      title: 'Priority Scores',
      description: 'Overall priority scores with stakeholder support overlay',
    });

    return visualizations;
  }

  // ============================================================================
  // Compromise Generation
  // ============================================================================

  /**
   * Generate compromise suggestions
   * O(n * c) where n=items, c=criteria
   */
  private generateCompromises(
    items: ConflictingItem[],
    criteria: PriorityCriterion[],
    stakeholders: Stakeholder[],
    maxCompromises: number
  ): CompromiseSuggestion[] {
    const compromises: CompromiseSuggestion[] = [];

    // 1. Phased approach - sequence items
    const phasedCompromise = this.generatePhasedCompromise(items, criteria, stakeholders);
    if (phasedCompromise) compromises.push(phasedCompromise);

    // 2. Parallel execution - if resources allow
    const parallelCompromise = this.generateParallelCompromise(items, stakeholders);
    if (parallelCompromise) compromises.push(parallelCompromise);

    // 3. Partial delivery - reduce scope of multiple items
    const partialCompromise = this.generatePartialDeliveryCompromise(items, stakeholders);
    if (partialCompromise) compromises.push(partialCompromise);

    // 4. Resource sharing - alternate allocation
    const sharingCompromise = this.generateResourceSharingCompromise(items, stakeholders);
    if (sharingCompromise) compromises.push(sharingCompromise);

    // 5. Deadline adjustment
    const deadlineCompromise = this.generateDeadlineCompromise(items, stakeholders);
    if (deadlineCompromise) compromises.push(deadlineCompromise);

    // Sort by overall satisfaction
    compromises.sort((a, b) => b.overallSatisfaction - a.overallSatisfaction);

    return compromises.slice(0, maxCompromises);
  }

  /**
   * Generate phased approach compromise
   */
  private generatePhasedCompromise(
    items: ConflictingItem[],
    criteria: PriorityCriterion[],
    stakeholders: Stakeholder[]
  ): CompromiseSuggestion | null {
    if (items.length < 2) return null;

    // Order items by urgency and dependencies
    const ordered = [...items].sort((a, b) => {
      const urgencyA = a.criteriaScores['urgency'] || 5;
      const urgencyB = b.criteriaScores['urgency'] || 5;
      return urgencyB - urgencyA;
    });

    const adjustments = ordered.map((item, index) => ({
      itemId: item.id,
      adjustment: `Phase ${index + 1}: Complete by week ${(index + 1) * 2}`,
      impact: index === 0 ? 'positive' as const : 'neutral' as const,
    }));

    const satisfaction = this.calculateCompromiseSatisfaction(
      ordered.map(o => o.id),
      stakeholders,
      (itemId, stakeholder) => {
        const order = ordered.findIndex(i => i.id === itemId);
        const prefOrder = stakeholder.preferredItems.indexOf(itemId);
        if (prefOrder === order) return 1;
        return Math.max(0, 1 - Math.abs(prefOrder - order) * 0.2);
      }
    );

    return {
      id: `comp-phased-${Date.now()}`,
      type: 'phased_approach',
      title: 'Phased Delivery',
      description: 'Complete items in sequence based on urgency, delivering value incrementally',
      affectedItems: items.map(i => i.id),
      adjustments,
      benefitScore: 0.8,
      feasibilityScore: 0.9,
      stakeholderSatisfaction: satisfaction.individual,
      overallSatisfaction: satisfaction.overall,
      implementationComplexity: 'low',
      risks: ['Later phases may be affected by earlier delays', 'Stakeholder expectations need management'],
    };
  }

  /**
   * Generate parallel execution compromise
   */
  private generateParallelCompromise(
    items: ConflictingItem[],
    stakeholders: Stakeholder[]
  ): CompromiseSuggestion | null {
    if (items.length < 2) return null;

    // Check if any items have blocking constraints
    const hasBlocking = items.some(i =>
      i.constraints?.some(c => c.flexibility === 'none')
    );

    if (hasBlocking) return null;

    const adjustments = items.map(item => ({
      itemId: item.id,
      adjustment: 'Execute in parallel with dedicated resources',
      impact: 'positive' as const,
    }));

    const satisfaction = this.calculateCompromiseSatisfaction(
      items.map(i => i.id),
      stakeholders,
      () => 0.9 // Everyone gets their item worked on
    );

    return {
      id: `comp-parallel-${Date.now()}`,
      type: 'parallel_execution',
      title: 'Parallel Execution',
      description: 'Execute all items simultaneously with separate resource allocation',
      affectedItems: items.map(i => i.id),
      adjustments,
      benefitScore: 0.9,
      feasibilityScore: 0.5, // Resource-intensive
      stakeholderSatisfaction: satisfaction.individual,
      overallSatisfaction: satisfaction.overall,
      implementationComplexity: 'high',
      risks: ['Resource contention', 'Coordination overhead', 'Quality may suffer'],
    };
  }

  /**
   * Generate partial delivery compromise
   */
  private generatePartialDeliveryCompromise(
    items: ConflictingItem[],
    stakeholders: Stakeholder[]
  ): CompromiseSuggestion | null {
    if (items.length < 2) return null;

    const adjustments = items.map(item => ({
      itemId: item.id,
      adjustment: 'Deliver core functionality (70% scope)',
      impact: 'neutral' as const,
    }));

    const satisfaction = this.calculateCompromiseSatisfaction(
      items.map(i => i.id),
      stakeholders,
      () => 0.7 // Partial satisfaction
    );

    return {
      id: `comp-partial-${Date.now()}`,
      type: 'partial_delivery',
      title: 'Partial Delivery for All',
      description: 'Reduce scope of each item to deliver core value for all stakeholders',
      affectedItems: items.map(i => i.id),
      adjustments,
      benefitScore: 0.7,
      feasibilityScore: 0.75,
      stakeholderSatisfaction: satisfaction.individual,
      overallSatisfaction: satisfaction.overall,
      implementationComplexity: 'medium',
      risks: ['Scope reduction may omit critical features', 'Follow-up work needed'],
    };
  }

  /**
   * Generate resource sharing compromise
   */
  private generateResourceSharingCompromise(
    items: ConflictingItem[],
    stakeholders: Stakeholder[]
  ): CompromiseSuggestion | null {
    if (items.length < 2) return null;

    const adjustments = items.map((item, index) => ({
      itemId: item.id,
      adjustment: `Allocated ${Math.round(100 / items.length)}% of shared resources`,
      impact: 'neutral' as const,
    }));

    const satisfaction = this.calculateCompromiseSatisfaction(
      items.map(i => i.id),
      stakeholders,
      () => 0.6
    );

    return {
      id: `comp-sharing-${Date.now()}`,
      type: 'resource_sharing',
      title: 'Resource Sharing',
      description: 'Split available resources equally across all competing items',
      affectedItems: items.map(i => i.id),
      adjustments,
      benefitScore: 0.6,
      feasibilityScore: 0.8,
      stakeholderSatisfaction: satisfaction.individual,
      overallSatisfaction: satisfaction.overall,
      implementationComplexity: 'medium',
      risks: ['Slower progress on all items', 'Context switching overhead'],
    };
  }

  /**
   * Generate deadline adjustment compromise
   */
  private generateDeadlineCompromise(
    items: ConflictingItem[],
    stakeholders: Stakeholder[]
  ): CompromiseSuggestion | null {
    // Check deadline flexibility
    const flexibleItems = items.filter(i =>
      !i.constraints?.some(c => c.type === 'deadline' && c.flexibility === 'none')
    );

    if (flexibleItems.length < items.length / 2) return null;

    const adjustments = items.map(item => {
      const isFlexible = flexibleItems.includes(item);
      return {
        itemId: item.id,
        adjustment: isFlexible ? 'Deadline extended by 2 weeks' : 'Original deadline maintained',
        impact: isFlexible ? 'neutral' as const : 'positive' as const,
      };
    });

    const satisfaction = this.calculateCompromiseSatisfaction(
      items.map(i => i.id),
      stakeholders,
      (itemId) => flexibleItems.some(i => i.id === itemId) ? 0.7 : 1
    );

    return {
      id: `comp-deadline-${Date.now()}`,
      type: 'deadline_adjustment',
      title: 'Deadline Adjustment',
      description: 'Extend deadlines for flexible items to accommodate parallel execution',
      affectedItems: items.map(i => i.id),
      adjustments,
      benefitScore: 0.75,
      feasibilityScore: 0.7,
      stakeholderSatisfaction: satisfaction.individual,
      overallSatisfaction: satisfaction.overall,
      implementationComplexity: 'low',
      risks: ['Stakeholder expectations for extended items', 'May impact downstream projects'],
    };
  }

  /**
   * Calculate stakeholder satisfaction for a compromise
   */
  private calculateCompromiseSatisfaction(
    itemIds: string[],
    stakeholders: Stakeholder[],
    satisfactionFn: (itemId: string, stakeholder: Stakeholder) => number
  ): { individual: Record<string, number>; overall: number } {
    const individual: Record<string, number> = {};
    let weightedTotal = 0;
    let totalWeight = 0;

    for (const stakeholder of stakeholders) {
      let satisfaction = 0;

      for (const itemId of itemIds) {
        if (stakeholder.preferredItems.includes(itemId)) {
          satisfaction += satisfactionFn(itemId, stakeholder);
        }
      }

      // Normalize by number of preferred items
      const normalizedSatisfaction = stakeholder.preferredItems.length > 0
        ? satisfaction / stakeholder.preferredItems.length
        : 0.5;

      individual[stakeholder.id] = normalizedSatisfaction;
      weightedTotal += normalizedSatisfaction * stakeholder.influenceWeight;
      totalWeight += stakeholder.influenceWeight;
    }

    return {
      individual,
      overall: totalWeight > 0 ? weightedTotal / totalWeight : 0.5,
    };
  }

  // ============================================================================
  // Recommendation & Rationale
  // ============================================================================

  /**
   * Build final recommendation
   */
  private buildRecommendation(
    scores: PriorityScore[],
    tradeOffs: TradeOff[],
    compromises: CompromiseSuggestion[],
    stakeholders: Stakeholder[]
  ): ConflictResolution['recommendation'] {
    const topScore = scores[0];
    const secondScore = scores[1];

    // Check if clear winner
    if (topScore && secondScore) {
      const scoreDiff = topScore.totalScore - secondScore.totalScore;

      if (scoreDiff > 0.15) {
        return {
          approach: 'prioritize_single',
          primaryItem: topScore.itemId,
          rationale: `Clear priority: "${topScore.itemId}" scores ${(scoreDiff * 100).toFixed(0)}% higher than alternatives`,
          confidenceLevel: Math.min(0.95, topScore.confidenceLevel + 0.1),
        };
      }
    }

    // Check if compromise is viable
    const bestCompromise = compromises[0];
    if (bestCompromise && bestCompromise.overallSatisfaction > 0.7) {
      return {
        approach: 'compromise',
        rationale: `Recommend "${bestCompromise.title}" with ${(bestCompromise.overallSatisfaction * 100).toFixed(0)}% stakeholder satisfaction`,
        confidenceLevel: bestCompromise.feasibilityScore,
      };
    }

    // Check for parallel possibility
    const parallelCompromise = compromises.find(c => c.type === 'parallel_execution');
    if (parallelCompromise && parallelCompromise.feasibilityScore > 0.6) {
      return {
        approach: 'parallel',
        rationale: 'Items can be executed in parallel with separate resource allocation',
        confidenceLevel: parallelCompromise.feasibilityScore,
      };
    }

    // Default: defer to stakeholder decision
    return {
      approach: 'defer',
      rationale: 'No clear recommendation - stakeholder input needed for final decision',
      confidenceLevel: 0.4,
    };
  }

  /**
   * Document decision rationale
   */
  private documentRationale(
    items: ConflictingItem[],
    stakeholders: Stakeholder[],
    criteria: PriorityCriterion[],
    scores: PriorityScore[],
    tradeOffs: TradeOff[],
    recommendation: ConflictResolution['recommendation']
  ): DecisionRationale {
    // Summary
    const topItem = items.find(i => i.id === scores[0]?.itemId);
    const summary = recommendation.approach === 'prioritize_single' && topItem
      ? `Recommend prioritizing "${topItem.title}" based on multi-criteria analysis with ${(recommendation.confidenceLevel * 100).toFixed(0)}% confidence.`
      : `Recommend ${recommendation.approach.replace('_', ' ')} approach. ${recommendation.rationale}`;

    // Key factors
    const keyFactors = criteria
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 4)
      .map(c => ({
        factor: c.name,
        weight: c.weight,
        impact: `Weighted ${(c.weight * 100).toFixed(0)}% in scoring`,
      }));

    // Stakeholder considerations
    const stakeholderConsiderations = stakeholders.map(s => {
      const topPreference = s.preferredItems[0];
      const honored = topPreference === scores[0]?.itemId;

      return {
        stakeholderName: s.name,
        preferenceHonored: honored,
        explanation: honored
          ? 'Top preference aligned with recommendation'
          : `Top preference was "${items.find(i => i.id === topPreference)?.title || topPreference}", ranked ${scores.find(sc => sc.itemId === topPreference)?.rank || 'N/A'}`,
      };
    });

    // Trade-off decisions
    const tradeOffDecisions = tradeOffs
      .filter(t => t.tradeOffSeverity !== 'none')
      .slice(0, 3)
      .map(t => {
        const itemA = items.find(i => i.id === t.itemAId);
        const itemB = items.find(i => i.id === t.itemBId);
        return {
          tradeOff: `${itemA?.title} vs ${itemB?.title}`,
          decision: t.overallWinner === 'tie' ? 'Both considered equivalent' : `${t.overallWinner === 'A' ? itemA?.title : itemB?.title} preferred`,
          justification: t.recommendation,
        };
      });

    // Alternatives considered
    const alternativesConsidered = scores.slice(1, 4).map(s => {
      const item = items.find(i => i.id === s.itemId);
      const scoreDiff = scores[0].totalScore - s.totalScore;
      return {
        alternative: item?.title || s.itemId,
        whyNotChosen: `Scored ${(scoreDiff * 100).toFixed(0)}% lower than top choice${s.rank > 1 ? '. Key gaps: ' + this.identifyGaps(s, criteria) : ''}`,
      };
    });

    // Uncertainties
    const uncertainties: string[] = [];
    if (recommendation.confidenceLevel < 0.7) {
      uncertainties.push('Confidence level below 70% - additional validation recommended');
    }
    const inconsistentComparisons = tradeOffs.filter(t => t.tradeOffSeverity === 'high');
    if (inconsistentComparisons.length > 0) {
      uncertainties.push(`${inconsistentComparisons.length} item pairs show significant trade-offs`);
    }

    // Follow-up recommendations
    const recommendedFollowUp = [
      'Review decision with key stakeholders before implementation',
      'Document any assumptions made in scoring',
    ];

    if (recommendation.approach !== 'prioritize_single') {
      recommendedFollowUp.push('Schedule follow-up to re-evaluate in 2 weeks');
    }

    return {
      summary,
      methodology: 'Multi-criteria decision analysis using Analytic Hierarchy Process (AHP) for weight derivation and weighted scoring for prioritization',
      keyFactors,
      stakeholderConsiderations,
      tradeOffDecisions,
      alternativesConsidered,
      uncertainties,
      recommendedFollowUp,
    };
  }

  /**
   * Identify scoring gaps for an item
   */
  private identifyGaps(score: PriorityScore, criteria: PriorityCriterion[]): string {
    const lowContributions = criteria
      .filter(c => (score.criteriaContributions[c.id] || 0) < c.weight * 0.5)
      .map(c => c.name);

    return lowContributions.slice(0, 2).join(', ') || 'no significant gaps';
  }

  // ============================================================================
  // Retrieval
  // ============================================================================

  /**
   * Get a resolution by ID
   */
  getResolution(id: string): ConflictResolution | undefined {
    return this.resolutions.get(id);
  }

  /**
   * Get default criteria
   */
  getDefaultCriteria(): PriorityCriterion[] {
    return [...this.defaultCriteria];
  }
}

// Singleton instance
export const priorityConflictResolverService = new PriorityConflictResolverService();
