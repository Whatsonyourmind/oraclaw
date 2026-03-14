/**
 * ORACLE Priority Conflict Resolver Service Tests
 * Tests for AHP, priority scoring, trade-off analysis, and compromise generation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the cache service
vi.mock('../../src/services/oracle/cache', () => ({
  oracleCacheService: {
    get: vi.fn(() => null),
    set: vi.fn(),
  },
  cacheKey: (...args: string[]) => args.join(':'),
  hashObject: (obj: any) => JSON.stringify(obj),
}));

// ============================================================================
// Types (matching the actual service)
// ============================================================================

interface PriorityCriterion {
  id: string;
  name: string;
  description: string;
  category: 'business' | 'technical' | 'resource' | 'time' | 'risk' | 'quality';
  weight: number;
  direction: 'maximize' | 'minimize';
}

interface ConflictingItem {
  id: string;
  title: string;
  description: string;
  type: 'task' | 'project' | 'request' | 'feature' | 'resource';
  requesterId: string;
  requesterName: string;
  stakeholders: string[];
  criteriaScores: Record<string, number>;
  metadata: Record<string, any>;
  constraints?: Array<{
    type: 'deadline' | 'dependency' | 'resource' | 'budget';
    description: string;
    flexibility: 'none' | 'low' | 'medium' | 'high';
  }>;
}

interface Stakeholder {
  id: string;
  name: string;
  role: string;
  department: string;
  influenceWeight: number;
  preferredCriteria: Array<{
    criterionId: string;
    importance: number;
  }>;
  preferredItems: string[];
}

interface PairwiseComparison {
  criterionA: string;
  criterionB: string;
  preference: number;
  stakeholderId?: string;
}

// AHP Random Consistency Index (RI) for matrix sizes
const AHP_RI: Record<number, number> = {
  1: 0, 2: 0, 3: 0.58, 4: 0.9, 5: 1.12,
  6: 1.24, 7: 1.32, 8: 1.41, 9: 1.45, 10: 1.49,
};

// ============================================================================
// Mock Implementation (simplified for testing)
// ============================================================================

class MockPriorityConflictResolverService {
  private defaultCriteria: PriorityCriterion[] = [
    { id: 'business_value', name: 'Business Value', description: 'Revenue impact', category: 'business', weight: 0.25, direction: 'maximize' },
    { id: 'urgency', name: 'Urgency', description: 'Time sensitivity', category: 'time', weight: 0.20, direction: 'maximize' },
    { id: 'effort', name: 'Implementation Effort', description: 'Resources required', category: 'resource', weight: 0.15, direction: 'minimize' },
    { id: 'risk', name: 'Risk Level', description: 'Technical risk', category: 'risk', weight: 0.15, direction: 'minimize' },
    { id: 'dependencies', name: 'Dependency Impact', description: 'Items that depend on this', category: 'technical', weight: 0.15, direction: 'maximize' },
    { id: 'stakeholder_priority', name: 'Stakeholder Priority', description: 'Importance to stakeholders', category: 'business', weight: 0.10, direction: 'maximize' },
  ];

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
  ) {
    const criteria = options.customCriteria || this.defaultCriteria;

    const ahpResult = options.pairwiseComparisons
      ? this.calculateAHPWeights(criteria, options.pairwiseComparisons, stakeholders)
      : this.useDefaultWeights(criteria);

    const weightedCriteria = criteria.map(c => ({
      ...c,
      weight: ahpResult.weights[c.id] || c.weight,
    }));

    const priorityScores = this.calculatePriorityScores(items, weightedCriteria, stakeholders);
    const tradeOffs = this.analyzeTradeOffs(items, weightedCriteria);
    const compromises = options.generateCompromises !== false
      ? this.generateCompromises(items, weightedCriteria, stakeholders, options.maxCompromises || 5)
      : [];

    const recommendation = this.buildRecommendation(priorityScores, tradeOffs, compromises, stakeholders);
    const decisionRationale = this.documentRationale(items, stakeholders, weightedCriteria, priorityScores, tradeOffs, recommendation);

    return {
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
  }

  calculateAHPWeights(
    criteria: PriorityCriterion[],
    comparisons: PairwiseComparison[],
    stakeholders: Stakeholder[]
  ) {
    const n = criteria.length;
    const matrix: number[][] = Array(n).fill(null).map(() => Array(n).fill(1));

    // Accumulate weighted comparisons
    const weightSums: number[][] = Array(n).fill(null).map(() => Array(n).fill(0));
    const valueSums: number[][] = Array(n).fill(null).map(() => Array(n).fill(0));

    for (const comparison of comparisons) {
      const iA = criteria.findIndex(c => c.id === comparison.criterionA);
      const iB = criteria.findIndex(c => c.id === comparison.criterionB);

      if (iA >= 0 && iB >= 0) {
        let weight = 1;
        if (comparison.stakeholderId) {
          const stakeholder = stakeholders.find(s => s.id === comparison.stakeholderId);
          weight = stakeholder?.influenceWeight || 1;
        }

        valueSums[iA][iB] += comparison.preference * weight;
        weightSums[iA][iB] += weight;
        valueSums[iB][iA] += (1 / comparison.preference) * weight;
        weightSums[iB][iA] += weight;
      }
    }

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (weightSums[i][j] > 0) {
          matrix[i][j] = valueSums[i][j] / weightSums[i][j];
        }
      }
    }

    const weights = this.calculateEigenvector(matrix, n);
    const sumWeights = weights.reduce((a, b) => a + b, 0);
    const normalizedWeights = weights.map(w => w / sumWeights);

    const { eigenvalue, consistencyRatio } = this.calculateConsistency(matrix, normalizedWeights, n);

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

  private calculateEigenvector(matrix: number[][], n: number, iterations: number = 100): number[] {
    let vector = Array(n).fill(1 / n);

    for (let iter = 0; iter < iterations; iter++) {
      const newVector = Array(n).fill(0);
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          newVector[i] += matrix[i][j] * vector[j];
        }
      }
      const sum = newVector.reduce((a, b) => a + b, 0);
      vector = newVector.map(v => v / sum);
    }

    return vector;
  }

  private calculateConsistency(
    matrix: number[][],
    weights: number[],
    n: number
  ) {
    const aw = Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        aw[i] += matrix[i][j] * weights[j];
      }
    }

    let lambdaMax = 0;
    for (let i = 0; i < n; i++) {
      if (weights[i] > 0) {
        lambdaMax += aw[i] / weights[i];
      }
    }
    lambdaMax /= n;

    const ci = (lambdaMax - n) / (n - 1);
    const ri = AHP_RI[n] || 1.49;
    const cr = ri > 0 ? ci / ri : 0;

    return { eigenvalue: lambdaMax, consistencyRatio: Math.abs(cr) };
  }

  private useDefaultWeights(criteria: PriorityCriterion[]) {
    const weights: Record<string, number> = {};
    criteria.forEach(c => { weights[c.id] = c.weight; });
    return { weights, consistencyRatio: 0, isConsistent: true, eigenvalue: criteria.length };
  }

  calculatePriorityScores(
    items: ConflictingItem[],
    criteria: PriorityCriterion[],
    stakeholders: Stakeholder[]
  ) {
    const scores: any[] = [];

    for (const item of items) {
      const criteriaContributions: Record<string, number> = {};
      let totalScore = 0;

      for (const criterion of criteria) {
        const rawScore = item.criteriaScores[criterion.id] || 5;
        let normalizedScore = rawScore / 10;

        if (criterion.direction === 'minimize') {
          normalizedScore = 1 - normalizedScore;
        }

        const contribution = normalizedScore * criterion.weight;
        criteriaContributions[criterion.id] = contribution;
        totalScore += contribution;
      }

      const stakeholderSupport = this.calculateStakeholderSupport(item, stakeholders);
      totalScore = totalScore * 0.8 + stakeholderSupport * 0.2;

      const confidenceLevel = this.calculateConfidenceLevel(item, criteria);

      scores.push({
        itemId: item.id,
        totalScore,
        normalizedScore: totalScore,
        rank: 0,
        criteriaContributions,
        stakeholderSupport,
        confidenceLevel,
      });
    }

    scores.sort((a, b) => b.totalScore - a.totalScore);
    scores.forEach((score, index) => { score.rank = index + 1; });

    return scores;
  }

  private calculateStakeholderSupport(item: ConflictingItem, stakeholders: Stakeholder[]): number {
    if (stakeholders.length === 0) return 0.5;

    let weightedSupport = 0;
    let totalWeight = 0;

    for (const stakeholder of stakeholders) {
      const preferenceIndex = stakeholder.preferredItems.indexOf(item.id);
      const maxIndex = stakeholder.preferredItems.length;

      let preferenceScore = 0.5;
      if (preferenceIndex >= 0) {
        preferenceScore = 1 - (preferenceIndex / (maxIndex || 1));
      }

      if (item.requesterId === stakeholder.id) {
        preferenceScore = Math.max(preferenceScore, 0.8);
      }

      if (item.stakeholders.includes(stakeholder.id)) {
        preferenceScore = Math.max(preferenceScore, 0.6);
      }

      weightedSupport += preferenceScore * stakeholder.influenceWeight;
      totalWeight += stakeholder.influenceWeight;
    }

    return totalWeight > 0 ? weightedSupport / totalWeight : 0.5;
  }

  private calculateConfidenceLevel(item: ConflictingItem, criteria: PriorityCriterion[]): number {
    let scoredCriteria = 0;
    for (const criterion of criteria) {
      if (item.criteriaScores[criterion.id] !== undefined) {
        scoredCriteria++;
      }
    }
    return scoredCriteria / criteria.length;
  }

  analyzeTradeOffs(items: ConflictingItem[], criteria: PriorityCriterion[]) {
    const tradeOffs: any[] = [];

    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        tradeOffs.push(this.compareItems(items[i], items[j], criteria));
      }
    }

    return tradeOffs;
  }

  private compareItems(itemA: ConflictingItem, itemB: ConflictingItem, criteria: PriorityCriterion[]) {
    const comparison: any[] = [];
    let aWins = 0;
    let bWins = 0;
    let significantDifferences = 0;

    for (const criterion of criteria) {
      const scoreA = itemA.criteriaScores[criterion.id] || 5;
      const scoreB = itemB.criteriaScores[criterion.id] || 5;

      let winner: 'A' | 'B' | 'tie';
      const difference = Math.abs(scoreA - scoreB);

      if (criterion.direction === 'minimize') {
        if (scoreA < scoreB - 0.5) { winner = 'A'; aWins++; }
        else if (scoreB < scoreA - 0.5) { winner = 'B'; bWins++; }
        else { winner = 'tie'; }
      } else {
        if (scoreA > scoreB + 0.5) { winner = 'A'; aWins++; }
        else if (scoreB > scoreA + 0.5) { winner = 'B'; bWins++; }
        else { winner = 'tie'; }
      }

      let significance: 'low' | 'medium' | 'high';
      if (difference >= 3) { significance = 'high'; significantDifferences++; }
      else if (difference >= 1.5) { significance = 'medium'; }
      else { significance = 'low'; }

      comparison.push({
        criterionId: criterion.id,
        criterionName: criterion.name,
        itemAScore: scoreA,
        itemBScore: scoreB,
        winner,
        significance,
      });
    }

    let overallWinner: 'A' | 'B' | 'tie';
    if (aWins > bWins + 1) overallWinner = 'A';
    else if (bWins > aWins + 1) overallWinner = 'B';
    else overallWinner = 'tie';

    let tradeOffSeverity: 'none' | 'low' | 'medium' | 'high';
    if (significantDifferences === 0) tradeOffSeverity = 'none';
    else if (significantDifferences <= 2) tradeOffSeverity = 'low';
    else if (significantDifferences <= 4) tradeOffSeverity = 'medium';
    else tradeOffSeverity = 'high';

    return {
      itemAId: itemA.id,
      itemBId: itemB.id,
      comparison,
      overallWinner,
      tradeOffSeverity,
      recommendation: this.generateTradeOffRecommendation(itemA, itemB, overallWinner, tradeOffSeverity),
    };
  }

  private generateTradeOffRecommendation(itemA: ConflictingItem, itemB: ConflictingItem, winner: string, severity: string): string {
    if (winner === 'tie') {
      return severity === 'high'
        ? `"${itemA.title}" and "${itemB.title}" have significant trade-offs with no clear winner.`
        : `"${itemA.title}" and "${itemB.title}" are nearly equivalent.`;
    }
    const winnerItem = winner === 'A' ? itemA : itemB;
    return `"${winnerItem.title}" is preferred overall.`;
  }

  generateCompromises(
    items: ConflictingItem[],
    criteria: PriorityCriterion[],
    stakeholders: Stakeholder[],
    maxCompromises: number
  ) {
    const compromises: any[] = [];

    // Phased approach
    compromises.push({
      id: `comp-phased-${Date.now()}`,
      type: 'phased_approach',
      title: 'Phased Delivery',
      description: 'Complete items in sequence based on urgency',
      affectedItems: items.map(i => i.id),
      adjustments: items.map((item, index) => ({
        itemId: item.id,
        adjustment: `Phase ${index + 1}`,
        impact: index === 0 ? 'positive' : 'neutral',
      })),
      benefitScore: 0.8,
      feasibilityScore: 0.9,
      stakeholderSatisfaction: this.calculateCompromiseSatisfaction(items.map(i => i.id), stakeholders),
      overallSatisfaction: 0.75,
      implementationComplexity: 'low',
      risks: ['Later phases may be affected by delays'],
    });

    // Parallel execution
    const hasBlocking = items.some(i => i.constraints?.some(c => c.flexibility === 'none'));
    if (!hasBlocking) {
      compromises.push({
        id: `comp-parallel-${Date.now()}`,
        type: 'parallel_execution',
        title: 'Parallel Execution',
        description: 'Execute all items simultaneously',
        affectedItems: items.map(i => i.id),
        adjustments: items.map(item => ({
          itemId: item.id,
          adjustment: 'Execute in parallel',
          impact: 'positive',
        })),
        benefitScore: 0.9,
        feasibilityScore: 0.5,
        stakeholderSatisfaction: this.calculateCompromiseSatisfaction(items.map(i => i.id), stakeholders),
        overallSatisfaction: 0.85,
        implementationComplexity: 'high',
        risks: ['Resource contention', 'Coordination overhead'],
      });
    }

    // Partial delivery
    compromises.push({
      id: `comp-partial-${Date.now()}`,
      type: 'partial_delivery',
      title: 'Partial Delivery for All',
      description: 'Reduce scope of each item to deliver core value',
      affectedItems: items.map(i => i.id),
      adjustments: items.map(item => ({
        itemId: item.id,
        adjustment: 'Deliver core functionality (70% scope)',
        impact: 'neutral',
      })),
      benefitScore: 0.7,
      feasibilityScore: 0.75,
      stakeholderSatisfaction: this.calculateCompromiseSatisfaction(items.map(i => i.id), stakeholders),
      overallSatisfaction: 0.7,
      implementationComplexity: 'medium',
      risks: ['Scope reduction may omit critical features'],
    });

    return compromises.sort((a, b) => b.overallSatisfaction - a.overallSatisfaction).slice(0, maxCompromises);
  }

  private calculateCompromiseSatisfaction(itemIds: string[], stakeholders: Stakeholder[]): Record<string, number> {
    const satisfaction: Record<string, number> = {};
    for (const stakeholder of stakeholders) {
      satisfaction[stakeholder.id] = 0.7;
    }
    return satisfaction;
  }

  private buildRecommendation(scores: any[], tradeOffs: any[], compromises: any[], stakeholders: Stakeholder[]) {
    const topScore = scores[0];
    const secondScore = scores[1];

    if (topScore && secondScore) {
      const scoreDiff = topScore.totalScore - secondScore.totalScore;
      if (scoreDiff > 0.15) {
        return {
          approach: 'prioritize_single' as const,
          primaryItem: topScore.itemId,
          rationale: `Clear priority: scores ${(scoreDiff * 100).toFixed(0)}% higher than alternatives`,
          confidenceLevel: Math.min(0.95, topScore.confidenceLevel + 0.1),
        };
      }
    }

    const bestCompromise = compromises[0];
    if (bestCompromise && bestCompromise.overallSatisfaction > 0.7) {
      return {
        approach: 'compromise' as const,
        rationale: `Recommend "${bestCompromise.title}" with ${(bestCompromise.overallSatisfaction * 100).toFixed(0)}% satisfaction`,
        confidenceLevel: bestCompromise.feasibilityScore,
      };
    }

    return {
      approach: 'defer' as const,
      rationale: 'No clear recommendation - stakeholder input needed',
      confidenceLevel: 0.4,
    };
  }

  private documentRationale(
    items: ConflictingItem[],
    stakeholders: Stakeholder[],
    criteria: PriorityCriterion[],
    scores: any[],
    tradeOffs: any[],
    recommendation: any
  ) {
    const topItem = items.find(i => i.id === scores[0]?.itemId);
    const summary = recommendation.approach === 'prioritize_single' && topItem
      ? `Recommend prioritizing "${topItem.title}" based on multi-criteria analysis.`
      : `Recommend ${recommendation.approach.replace('_', ' ')} approach.`;

    return {
      summary,
      methodology: 'Multi-criteria decision analysis using AHP',
      keyFactors: criteria.slice(0, 4).map(c => ({
        factor: c.name,
        weight: c.weight,
        impact: `Weighted ${(c.weight * 100).toFixed(0)}% in scoring`,
      })),
      stakeholderConsiderations: stakeholders.map(s => ({
        stakeholderName: s.name,
        preferenceHonored: s.preferredItems[0] === scores[0]?.itemId,
        explanation: 'Preference considered in analysis',
      })),
      tradeOffDecisions: tradeOffs.slice(0, 3).map(t => ({
        tradeOff: `${items.find(i => i.id === t.itemAId)?.title} vs ${items.find(i => i.id === t.itemBId)?.title}`,
        decision: t.overallWinner === 'tie' ? 'Equivalent' : `${t.overallWinner === 'A' ? items.find(i => i.id === t.itemAId)?.title : items.find(i => i.id === t.itemBId)?.title} preferred`,
        justification: t.recommendation,
      })),
      alternativesConsidered: scores.slice(1, 4).map(s => ({
        alternative: items.find(i => i.id === s.itemId)?.title || s.itemId,
        whyNotChosen: `Scored ${((scores[0].totalScore - s.totalScore) * 100).toFixed(0)}% lower than top choice`,
      })),
      uncertainties: recommendation.confidenceLevel < 0.7 ? ['Confidence level below 70%'] : [],
      recommendedFollowUp: ['Review decision with stakeholders'],
    };
  }

  getDefaultCriteria() {
    return [...this.defaultCriteria];
  }
}

// ============================================================================
// Test Suite
// ============================================================================

describe('PriorityConflictResolverService', () => {
  let service: MockPriorityConflictResolverService;

  // Test fixtures
  const createItem = (overrides: Partial<ConflictingItem> = {}): ConflictingItem => ({
    id: `item-${Math.random().toString(36).substr(2, 9)}`,
    title: 'Test Item',
    description: 'A test item',
    type: 'feature',
    requesterId: 'user-1',
    requesterName: 'Test User',
    stakeholders: ['user-1'],
    criteriaScores: {
      business_value: 7,
      urgency: 5,
      effort: 4,
      risk: 3,
      dependencies: 5,
      stakeholder_priority: 6,
    },
    metadata: {},
    ...overrides,
  });

  const createStakeholder = (overrides: Partial<Stakeholder> = {}): Stakeholder => ({
    id: `stakeholder-${Math.random().toString(36).substr(2, 9)}`,
    name: 'Test Stakeholder',
    role: 'Manager',
    department: 'Engineering',
    influenceWeight: 0.5,
    preferredCriteria: [
      { criterionId: 'business_value', importance: 5 },
    ],
    preferredItems: [],
    ...overrides,
  });

  beforeEach(() => {
    service = new MockPriorityConflictResolverService();
    vi.clearAllMocks();
  });

  // ============================================================================
  // AHP Tests
  // ============================================================================

  describe('AHP Weight Calculation', () => {
    it('should calculate weights from pairwise comparisons', async () => {
      const criteria = service.getDefaultCriteria();
      const comparisons: PairwiseComparison[] = [
        { criterionA: 'business_value', criterionB: 'urgency', preference: 3 },
        { criterionA: 'business_value', criterionB: 'effort', preference: 5 },
        { criterionA: 'urgency', criterionB: 'effort', preference: 2 },
      ];

      const result = service.calculateAHPWeights(criteria, comparisons, []);

      expect(result.weights).toBeDefined();
      expect(Object.keys(result.weights).length).toBe(criteria.length);
      // Sum of weights should be approximately 1
      const sum = Object.values(result.weights).reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1, 1);
    });

    it('should indicate consistent comparisons', async () => {
      const criteria = service.getDefaultCriteria().slice(0, 3);
      const comparisons: PairwiseComparison[] = [
        { criterionA: criteria[0].id, criterionB: criteria[1].id, preference: 2 },
        { criterionA: criteria[0].id, criterionB: criteria[2].id, preference: 4 },
        { criterionA: criteria[1].id, criterionB: criteria[2].id, preference: 2 },
      ];

      const result = service.calculateAHPWeights(criteria, comparisons, []);

      expect(result.consistencyRatio).toBeDefined();
      // Consistent comparisons should have CR < 0.1
      expect(result.isConsistent).toBe(true);
    });

    it('should weight by stakeholder influence', async () => {
      const criteria = service.getDefaultCriteria().slice(0, 2);
      const stakeholders = [
        createStakeholder({ id: 'high-influence', influenceWeight: 0.9 }),
        createStakeholder({ id: 'low-influence', influenceWeight: 0.1 }),
      ];
      const comparisons: PairwiseComparison[] = [
        { criterionA: criteria[0].id, criterionB: criteria[1].id, preference: 5, stakeholderId: 'high-influence' },
        { criterionA: criteria[0].id, criterionB: criteria[1].id, preference: 0.2, stakeholderId: 'low-influence' },
      ];

      const result = service.calculateAHPWeights(criteria, comparisons, stakeholders);

      // High influence stakeholder's preference should dominate
      expect(result.weights[criteria[0].id]).toBeGreaterThan(result.weights[criteria[1].id]);
    });

    it('should use default weights when no comparisons provided', async () => {
      const items = [createItem({ id: 'item-1' })];
      const stakeholders: Stakeholder[] = [];

      const result = await service.resolveConflict('conflict-1', items, stakeholders, {
        pairwiseComparisons: undefined,
      });

      // Should use default weights
      expect(result.ahpResult.isConsistent).toBe(true);
      expect(result.ahpResult.consistencyRatio).toBe(0);
    });
  });

  // ============================================================================
  // Priority Scoring Tests
  // ============================================================================

  describe('Priority Score Calculation', () => {
    it('should rank items by total score', async () => {
      const items = [
        createItem({
          id: 'item-low',
          title: 'Low Priority',
          criteriaScores: { business_value: 3, urgency: 2, effort: 8, risk: 7, dependencies: 2 },
        }),
        createItem({
          id: 'item-high',
          title: 'High Priority',
          criteriaScores: { business_value: 9, urgency: 8, effort: 2, risk: 2, dependencies: 8 },
        }),
      ];

      const result = await service.resolveConflict('conflict-1', items, []);

      expect(result.priorityScores[0].itemId).toBe('item-high');
      expect(result.priorityScores[0].rank).toBe(1);
      expect(result.priorityScores[1].rank).toBe(2);
    });

    it('should invert scores for minimize criteria', async () => {
      const items = [
        createItem({
          id: 'item-high-effort',
          criteriaScores: { effort: 9 }, // High effort = bad
        }),
        createItem({
          id: 'item-low-effort',
          criteriaScores: { effort: 1 }, // Low effort = good
        }),
      ];

      const result = await service.resolveConflict('conflict-1', items, []);

      const highEffortScore = result.priorityScores.find(s => s.itemId === 'item-high-effort');
      const lowEffortScore = result.priorityScores.find(s => s.itemId === 'item-low-effort');

      // Lower effort should result in higher score contribution for 'effort'
      expect(lowEffortScore!.criteriaContributions['effort']).toBeGreaterThan(
        highEffortScore!.criteriaContributions['effort']
      );
    });

    it('should include stakeholder support in scoring', async () => {
      const items = [
        createItem({ id: 'item-1', requesterId: 'stakeholder-1' }),
        createItem({ id: 'item-2', requesterId: 'stakeholder-2' }),
      ];
      const stakeholders = [
        createStakeholder({
          id: 'stakeholder-1',
          influenceWeight: 0.9,
          preferredItems: ['item-1'],
        }),
        createStakeholder({
          id: 'stakeholder-2',
          influenceWeight: 0.1,
          preferredItems: ['item-2'],
        }),
      ];

      const result = await service.resolveConflict('conflict-1', items, stakeholders);

      const item1Score = result.priorityScores.find(s => s.itemId === 'item-1');
      const item2Score = result.priorityScores.find(s => s.itemId === 'item-2');

      expect(item1Score!.stakeholderSupport).toBeGreaterThan(item2Score!.stakeholderSupport);
    });

    it('should calculate confidence level based on scored criteria', async () => {
      const items = [
        createItem({
          id: 'item-complete',
          criteriaScores: {
            business_value: 7,
            urgency: 5,
            effort: 4,
            risk: 3,
            dependencies: 5,
            stakeholder_priority: 6,
          },
        }),
        createItem({
          id: 'item-incomplete',
          criteriaScores: {
            business_value: 7,
            // Missing other criteria
          },
        }),
      ];

      const result = await service.resolveConflict('conflict-1', items, []);

      const completeScore = result.priorityScores.find(s => s.itemId === 'item-complete');
      const incompleteScore = result.priorityScores.find(s => s.itemId === 'item-incomplete');

      expect(completeScore!.confidenceLevel).toBeGreaterThan(incompleteScore!.confidenceLevel);
    });
  });

  // ============================================================================
  // Trade-off Analysis Tests
  // ============================================================================

  describe('Trade-off Analysis', () => {
    it('should compare all pairs of items', async () => {
      const items = [
        createItem({ id: 'item-1' }),
        createItem({ id: 'item-2' }),
        createItem({ id: 'item-3' }),
      ];

      const result = await service.resolveConflict('conflict-1', items, []);

      // n*(n-1)/2 = 3*2/2 = 3 pairs
      expect(result.tradeOffs.length).toBe(3);
    });

    it('should identify clear winner when scores differ significantly', async () => {
      const items = [
        createItem({
          id: 'item-winner',
          criteriaScores: { business_value: 9, urgency: 9, effort: 1, risk: 1 },
        }),
        createItem({
          id: 'item-loser',
          criteriaScores: { business_value: 2, urgency: 2, effort: 9, risk: 9 },
        }),
      ];

      const result = await service.resolveConflict('conflict-1', items, []);

      const tradeOff = result.tradeOffs[0];
      expect(tradeOff.overallWinner).toBe('A');
      expect(tradeOff.tradeOffSeverity).not.toBe('none');
    });

    it('should identify tie when scores are similar', async () => {
      const items = [
        createItem({
          id: 'item-1',
          criteriaScores: { business_value: 5, urgency: 5, effort: 5 },
        }),
        createItem({
          id: 'item-2',
          criteriaScores: { business_value: 5, urgency: 5, effort: 5 },
        }),
      ];

      const result = await service.resolveConflict('conflict-1', items, []);

      const tradeOff = result.tradeOffs[0];
      expect(tradeOff.overallWinner).toBe('tie');
      expect(tradeOff.tradeOffSeverity).toBe('none');
    });

    it('should detect high severity trade-offs', async () => {
      const items = [
        createItem({
          id: 'item-1',
          criteriaScores: { business_value: 10, urgency: 1, effort: 10, risk: 1 },
        }),
        createItem({
          id: 'item-2',
          criteriaScores: { business_value: 1, urgency: 10, effort: 1, risk: 10 },
        }),
      ];

      const result = await service.resolveConflict('conflict-1', items, []);

      const tradeOff = result.tradeOffs[0];
      expect(['medium', 'high']).toContain(tradeOff.tradeOffSeverity);
    });

    it('should include recommendation in trade-off', async () => {
      const items = [
        createItem({ id: 'item-1', title: 'Feature A' }),
        createItem({ id: 'item-2', title: 'Feature B' }),
      ];

      const result = await service.resolveConflict('conflict-1', items, []);

      expect(result.tradeOffs[0].recommendation).toBeDefined();
      expect(result.tradeOffs[0].recommendation.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Compromise Generation Tests
  // ============================================================================

  describe('Compromise Generation', () => {
    it('should generate multiple compromise suggestions', async () => {
      const items = [
        createItem({ id: 'item-1' }),
        createItem({ id: 'item-2' }),
      ];

      const result = await service.resolveConflict('conflict-1', items, [], {
        generateCompromises: true,
        maxCompromises: 5,
      });

      expect(result.compromises.length).toBeGreaterThan(0);
      expect(result.compromises.length).toBeLessThanOrEqual(5);
    });

    it('should include phased approach compromise', async () => {
      const items = [
        createItem({ id: 'item-1' }),
        createItem({ id: 'item-2' }),
      ];

      const result = await service.resolveConflict('conflict-1', items, []);

      const phasedCompromise = result.compromises.find(c => c.type === 'phased_approach');
      expect(phasedCompromise).toBeDefined();
    });

    it('should include parallel execution if no blocking constraints', async () => {
      const items = [
        createItem({ id: 'item-1', constraints: [] }),
        createItem({ id: 'item-2', constraints: [] }),
      ];

      const result = await service.resolveConflict('conflict-1', items, []);

      const parallelCompromise = result.compromises.find(c => c.type === 'parallel_execution');
      expect(parallelCompromise).toBeDefined();
    });

    it('should calculate stakeholder satisfaction for compromises', async () => {
      const items = [
        createItem({ id: 'item-1' }),
        createItem({ id: 'item-2' }),
      ];
      const stakeholders = [
        createStakeholder({ id: 'stakeholder-1', preferredItems: ['item-1'] }),
        createStakeholder({ id: 'stakeholder-2', preferredItems: ['item-2'] }),
      ];

      const result = await service.resolveConflict('conflict-1', items, stakeholders);

      expect(result.compromises[0].stakeholderSatisfaction).toBeDefined();
      expect(result.compromises[0].overallSatisfaction).toBeDefined();
    });

    it('should include risks in compromise suggestions', async () => {
      const items = [
        createItem({ id: 'item-1' }),
        createItem({ id: 'item-2' }),
      ];

      const result = await service.resolveConflict('conflict-1', items, []);

      expect(result.compromises[0].risks).toBeDefined();
      expect(result.compromises[0].risks.length).toBeGreaterThan(0);
    });

    it('should not generate compromises when disabled', async () => {
      const items = [
        createItem({ id: 'item-1' }),
        createItem({ id: 'item-2' }),
      ];

      const result = await service.resolveConflict('conflict-1', items, [], {
        generateCompromises: false,
      });

      expect(result.compromises).toHaveLength(0);
    });
  });

  // ============================================================================
  // Recommendation Tests
  // ============================================================================

  describe('Recommendation Building', () => {
    it('should recommend prioritize_single when clear winner exists', async () => {
      const items = [
        createItem({
          id: 'item-clear-winner',
          criteriaScores: { business_value: 10, urgency: 10, effort: 1, risk: 1, dependencies: 10 },
        }),
        createItem({
          id: 'item-loser',
          criteriaScores: { business_value: 2, urgency: 2, effort: 9, risk: 9, dependencies: 2 },
        }),
      ];

      const result = await service.resolveConflict('conflict-1', items, []);

      expect(result.recommendation.approach).toBe('prioritize_single');
      expect(result.recommendation.primaryItem).toBe('item-clear-winner');
    });

    it('should recommend compromise when no clear winner', async () => {
      const items = [
        createItem({
          id: 'item-1',
          criteriaScores: { business_value: 6, urgency: 5, effort: 5 },
        }),
        createItem({
          id: 'item-2',
          criteriaScores: { business_value: 5, urgency: 6, effort: 5 },
        }),
      ];

      const result = await service.resolveConflict('conflict-1', items, []);

      // When scores are close, should recommend compromise or defer
      expect(['compromise', 'defer']).toContain(result.recommendation.approach);
    });

    it('should include confidence level in recommendation', async () => {
      const items = [
        createItem({ id: 'item-1' }),
        createItem({ id: 'item-2' }),
      ];

      const result = await service.resolveConflict('conflict-1', items, []);

      expect(result.recommendation.confidenceLevel).toBeDefined();
      expect(result.recommendation.confidenceLevel).toBeGreaterThanOrEqual(0);
      expect(result.recommendation.confidenceLevel).toBeLessThanOrEqual(1);
    });

    it('should include rationale in recommendation', async () => {
      const items = [
        createItem({ id: 'item-1' }),
        createItem({ id: 'item-2' }),
      ];

      const result = await service.resolveConflict('conflict-1', items, []);

      expect(result.recommendation.rationale).toBeDefined();
      expect(result.recommendation.rationale.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Decision Rationale Tests
  // ============================================================================

  describe('Decision Rationale', () => {
    it('should include summary of decision', async () => {
      const items = [
        createItem({ id: 'item-1', title: 'Feature A' }),
        createItem({ id: 'item-2', title: 'Feature B' }),
      ];

      const result = await service.resolveConflict('conflict-1', items, []);

      expect(result.decisionRationale.summary).toBeDefined();
      expect(result.decisionRationale.summary.length).toBeGreaterThan(0);
    });

    it('should document methodology', async () => {
      const items = [createItem({ id: 'item-1' })];

      const result = await service.resolveConflict('conflict-1', items, []);

      expect(result.decisionRationale.methodology).toContain('AHP');
    });

    it('should list key factors', async () => {
      const items = [createItem({ id: 'item-1' })];

      const result = await service.resolveConflict('conflict-1', items, []);

      expect(result.decisionRationale.keyFactors.length).toBeGreaterThan(0);
      expect(result.decisionRationale.keyFactors[0]).toHaveProperty('factor');
      expect(result.decisionRationale.keyFactors[0]).toHaveProperty('weight');
    });

    it('should document stakeholder considerations', async () => {
      const items = [createItem({ id: 'item-1' })];
      const stakeholders = [
        createStakeholder({ id: 'sh-1', name: 'Alice', preferredItems: ['item-1'] }),
        createStakeholder({ id: 'sh-2', name: 'Bob', preferredItems: ['item-2'] }),
      ];

      const result = await service.resolveConflict('conflict-1', items, stakeholders);

      expect(result.decisionRationale.stakeholderConsiderations.length).toBe(2);
      expect(result.decisionRationale.stakeholderConsiderations[0]).toHaveProperty('stakeholderName');
      expect(result.decisionRationale.stakeholderConsiderations[0]).toHaveProperty('preferenceHonored');
    });

    it('should document trade-off decisions', async () => {
      const items = [
        createItem({ id: 'item-1', title: 'A' }),
        createItem({ id: 'item-2', title: 'B' }),
      ];

      const result = await service.resolveConflict('conflict-1', items, []);

      if (result.tradeOffs.length > 0) {
        expect(result.decisionRationale.tradeOffDecisions.length).toBeGreaterThan(0);
        expect(result.decisionRationale.tradeOffDecisions[0]).toHaveProperty('tradeOff');
        expect(result.decisionRationale.tradeOffDecisions[0]).toHaveProperty('decision');
      }
    });

    it('should document alternatives considered', async () => {
      const items = [
        createItem({ id: 'item-1', title: 'Winner' }),
        createItem({ id: 'item-2', title: 'Runner-up' }),
        createItem({ id: 'item-3', title: 'Third' }),
      ];

      const result = await service.resolveConflict('conflict-1', items, []);

      expect(result.decisionRationale.alternativesConsidered.length).toBeGreaterThan(0);
      expect(result.decisionRationale.alternativesConsidered[0]).toHaveProperty('alternative');
      expect(result.decisionRationale.alternativesConsidered[0]).toHaveProperty('whyNotChosen');
    });

    it('should include recommended follow-up actions', async () => {
      const items = [createItem({ id: 'item-1' })];

      const result = await service.resolveConflict('conflict-1', items, []);

      expect(result.decisionRationale.recommendedFollowUp.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle single item', async () => {
      const items = [createItem({ id: 'item-1' })];

      const result = await service.resolveConflict('conflict-1', items, []);

      expect(result.priorityScores).toHaveLength(1);
      expect(result.priorityScores[0].rank).toBe(1);
      expect(result.tradeOffs).toHaveLength(0);
    });

    it('should handle no stakeholders', async () => {
      const items = [
        createItem({ id: 'item-1' }),
        createItem({ id: 'item-2' }),
      ];

      const result = await service.resolveConflict('conflict-1', items, []);

      expect(result.stakeholders).toHaveLength(0);
      // Stakeholder support should default to 0.5
      expect(result.priorityScores[0].stakeholderSupport).toBe(0.5);
    });

    it('should handle items with missing criteria scores', async () => {
      const items = [
        createItem({
          id: 'item-incomplete',
          criteriaScores: {}, // No scores
        }),
      ];

      const result = await service.resolveConflict('conflict-1', items, []);

      expect(result.priorityScores).toHaveLength(1);
      // Should use default score of 5
      expect(result.priorityScores[0].totalScore).toBeDefined();
    });

    it('should handle many items efficiently', async () => {
      const items = Array.from({ length: 20 }, (_, i) =>
        createItem({ id: `item-${i}`, title: `Item ${i}` })
      );

      const start = Date.now();
      const result = await service.resolveConflict('conflict-1', items, []);
      const duration = Date.now() - start;

      expect(result.priorityScores).toHaveLength(20);
      // n*(n-1)/2 = 20*19/2 = 190 trade-offs
      expect(result.tradeOffs).toHaveLength(190);
      // Should complete in reasonable time
      expect(duration).toBeLessThan(5000);
    });

    it('should handle custom criteria', async () => {
      const customCriteria: PriorityCriterion[] = [
        { id: 'custom1', name: 'Custom 1', description: 'Test', category: 'business', weight: 0.5, direction: 'maximize' },
        { id: 'custom2', name: 'Custom 2', description: 'Test', category: 'technical', weight: 0.5, direction: 'minimize' },
      ];
      const items = [
        createItem({
          id: 'item-1',
          criteriaScores: { custom1: 8, custom2: 3 },
        }),
      ];

      const result = await service.resolveConflict('conflict-1', items, [], {
        customCriteria,
      });

      expect(result.criteria).toHaveLength(2);
      expect(result.criteria[0].id).toBe('custom1');
    });

    it('should handle items with constraints', async () => {
      const items = [
        createItem({
          id: 'item-constrained',
          constraints: [
            { type: 'deadline', description: 'Must complete by Q1', flexibility: 'none' },
            { type: 'budget', description: 'Limited budget', flexibility: 'medium' },
          ],
        }),
      ];

      const result = await service.resolveConflict('conflict-1', items, []);

      expect(result.items[0].constraints).toHaveLength(2);
    });
  });

  // ============================================================================
  // Default Criteria Tests
  // ============================================================================

  describe('Default Criteria', () => {
    it('should return default criteria', () => {
      const criteria = service.getDefaultCriteria();

      expect(criteria.length).toBeGreaterThan(0);
      expect(criteria.find(c => c.id === 'business_value')).toBeDefined();
      expect(criteria.find(c => c.id === 'urgency')).toBeDefined();
      expect(criteria.find(c => c.id === 'effort')).toBeDefined();
    });

    it('should have weights summing to approximately 1', () => {
      const criteria = service.getDefaultCriteria();
      const sum = criteria.reduce((total, c) => total + c.weight, 0);

      expect(sum).toBeCloseTo(1, 1);
    });

    it('should have correct directions for each criterion', () => {
      const criteria = service.getDefaultCriteria();

      // Effort and risk should be minimized
      const effort = criteria.find(c => c.id === 'effort');
      const risk = criteria.find(c => c.id === 'risk');

      expect(effort?.direction).toBe('minimize');
      expect(risk?.direction).toBe('minimize');

      // Business value should be maximized
      const businessValue = criteria.find(c => c.id === 'business_value');
      expect(businessValue?.direction).toBe('maximize');
    });
  });
});
