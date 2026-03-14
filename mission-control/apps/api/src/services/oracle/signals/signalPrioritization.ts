/**
 * Signal Prioritization Service
 * Advanced prioritization algorithms and frameworks
 */

import type {
  Signal,
  UrgencyLevel,
  ImpactLevel,
} from '@mission-control/shared-types';

// ============================================================================
// TYPES
// ============================================================================

export type EisenhowerQuadrant = 'do_first' | 'schedule' | 'delegate' | 'eliminate';

export type MoSCoWCategory = 'must_have' | 'should_have' | 'could_have' | 'wont_have';

export interface EisenhowerPlacement {
  signalId: string;
  quadrant: EisenhowerQuadrant;
  urgencyScore: number;
  importanceScore: number;
  recommendation: string;
}

export interface MoSCoWPlacement {
  signalId: string;
  category: MoSCoWCategory;
  score: number;
  rationale: string;
  dependencies: string[];
}

export interface WSJFScore {
  signalId: string;
  businessValue: number;
  timeCriticality: number;
  riskReduction: number;
  opportunityEnablement: number;
  jobSize: number;
  wsjfScore: number;
  rank: number;
}

export interface CustomPriorityFormula {
  id: string;
  name: string;
  description: string;
  formula: string; // Expression like "urgency * 2 + impact * 1.5 + confidence"
  weights: Record<string, number>;
  createdAt: string;
}

export interface PrioritizedSignal {
  signal: Signal;
  eisenhower: EisenhowerPlacement;
  moscow: MoSCoWPlacement;
  wsjf: WSJFScore;
  customScores: Record<string, number>;
  overallPriority: number;
  rank: number;
  actionRecommendation: string;
  estimatedTimeToAddress: string;
}

export interface PrioritizationContext {
  userId: string;
  goals?: Array<{ id: string; priority: number; description: string }>;
  resources?: { available: number; capacity: number };
  deadlines?: Array<{ id: string; date: string; importance: number }>;
  constraints?: string[];
  preferences?: {
    urgencyWeight?: number;
    impactWeight?: number;
    confidenceWeight?: number;
    customWeights?: Record<string, number>;
  };
}

export interface RePrioritizationResult {
  previousRanking: PrioritizedSignal[];
  newRanking: PrioritizedSignal[];
  changes: Array<{
    signalId: string;
    previousRank: number;
    newRank: number;
    changeReason: string;
  }>;
  contextChanges: string[];
  timestamp: string;
}

// ============================================================================
// SIGNAL PRIORITIZATION SERVICE
// ============================================================================

export class SignalPrioritizationService {
  private customFormulas: Map<string, CustomPriorityFormula> = new Map();
  private previousRankings: Map<string, PrioritizedSignal[]> = new Map();

  /**
   * Perform comprehensive prioritization of signals
   */
  async prioritizeSignals(
    signals: Signal[],
    context: PrioritizationContext
  ): Promise<PrioritizedSignal[]> {
    const prioritized: PrioritizedSignal[] = [];

    for (const signal of signals) {
      // Calculate all priority frameworks
      const eisenhower = this.calculateEisenhowerPlacement(signal, context);
      const moscow = this.calculateMoSCoWPlacement(signal, context);
      const wsjf = this.calculateWSJFScore(signal, context);
      const customScores = this.calculateCustomScores(signal, context);

      // Calculate overall priority
      const overallPriority = this.calculateOverallPriority(
        eisenhower,
        moscow,
        wsjf,
        customScores,
        context
      );

      prioritized.push({
        signal,
        eisenhower,
        moscow,
        wsjf,
        customScores,
        overallPriority,
        rank: 0, // Will be set after sorting
        actionRecommendation: this.getActionRecommendation(signal, eisenhower, moscow),
        estimatedTimeToAddress: this.estimateTimeToAddress(signal, wsjf),
      });
    }

    // Sort by overall priority and assign ranks
    prioritized.sort((a, b) => b.overallPriority - a.overallPriority);
    prioritized.forEach((p, idx) => {
      p.rank = idx + 1;
      p.wsjf.rank = idx + 1;
    });

    // Store for re-prioritization tracking
    this.previousRankings.set(context.userId, prioritized);

    return prioritized;
  }

  /**
   * Calculate Eisenhower Matrix placement
   */
  calculateEisenhowerPlacement(
    signal: Signal,
    context: PrioritizationContext
  ): EisenhowerPlacement {
    // Calculate urgency score (0-100)
    let urgencyScore = this.getUrgencyScore(signal.urgency);

    // Adjust for deadlines
    if (context.deadlines?.length) {
      const relatedDeadline = context.deadlines.find(
        (d) => signal.related_entity_id === d.id
      );
      if (relatedDeadline) {
        const daysToDeadline = Math.floor(
          (new Date(relatedDeadline.date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );
        if (daysToDeadline < 3) urgencyScore = Math.min(100, urgencyScore + 30);
        else if (daysToDeadline < 7) urgencyScore = Math.min(100, urgencyScore + 15);
      }
    }

    // Calculate importance score (0-100)
    let importanceScore = this.getImpactScore(signal.impact);

    // Adjust for goals alignment
    if (context.goals?.length) {
      const goalAlignment = this.calculateGoalAlignment(signal, context.goals);
      importanceScore = Math.min(100, importanceScore + goalAlignment * 20);
    }

    // Determine quadrant
    let quadrant: EisenhowerQuadrant;
    let recommendation: string;

    if (urgencyScore >= 60 && importanceScore >= 60) {
      quadrant = 'do_first';
      recommendation = 'Address immediately - this is critical and time-sensitive';
    } else if (urgencyScore < 60 && importanceScore >= 60) {
      quadrant = 'schedule';
      recommendation = 'Schedule dedicated time - important but not urgent';
    } else if (urgencyScore >= 60 && importanceScore < 60) {
      quadrant = 'delegate';
      recommendation = 'Delegate if possible - urgent but less important';
    } else {
      quadrant = 'eliminate';
      recommendation = 'Consider deprioritizing or dismissing';
    }

    return {
      signalId: signal.id,
      quadrant,
      urgencyScore,
      importanceScore,
      recommendation,
    };
  }

  /**
   * Calculate MoSCoW categorization
   */
  calculateMoSCoWPlacement(
    signal: Signal,
    context: PrioritizationContext
  ): MoSCoWPlacement {
    let score = 0;
    let rationale = '';
    const dependencies: string[] = [];

    // Calculate base score from urgency and impact
    score += this.getUrgencyScore(signal.urgency) * 0.4;
    score += this.getImpactScore(signal.impact) * 0.4;
    score += signal.confidence * 20;

    // Adjust for signal type
    const criticalTypes = ['deadline', 'risk', 'dependency'];
    if (criticalTypes.includes(signal.signal_type)) {
      score += 15;
    }

    // Check for blocking dependencies
    if (signal.signal_type === 'dependency') {
      dependencies.push('Blocks other work');
      score += 10;
    }

    // Determine category
    let category: MoSCoWCategory;

    if (score >= 75) {
      category = 'must_have';
      rationale = 'Critical for project success - cannot proceed without addressing';
    } else if (score >= 55) {
      category = 'should_have';
      rationale = 'Important for full functionality - should be addressed if possible';
    } else if (score >= 35) {
      category = 'could_have';
      rationale = 'Desirable but not essential - address if resources allow';
    } else {
      category = 'wont_have';
      rationale = 'Low priority for current iteration - defer or dismiss';
    }

    return {
      signalId: signal.id,
      category,
      score,
      rationale,
      dependencies,
    };
  }

  /**
   * Calculate WSJF (Weighted Shortest Job First) score
   */
  calculateWSJFScore(
    signal: Signal,
    context: PrioritizationContext
  ): WSJFScore {
    // Business Value (1-10)
    let businessValue = this.getImpactScore(signal.impact) / 10;
    if (signal.signal_type === 'opportunity') businessValue = Math.min(10, businessValue + 2);

    // Time Criticality (1-10)
    let timeCriticality = this.getUrgencyScore(signal.urgency) / 10;
    if (signal.expires_at) {
      const hoursToExpiry = (new Date(signal.expires_at).getTime() - Date.now()) / (1000 * 60 * 60);
      if (hoursToExpiry < 24) timeCriticality = Math.min(10, timeCriticality + 3);
      else if (hoursToExpiry < 72) timeCriticality = Math.min(10, timeCriticality + 1);
    }

    // Risk Reduction / Opportunity Enablement (1-10)
    let riskReduction = 5;
    let opportunityEnablement = 5;

    if (signal.signal_type === 'risk') riskReduction = Math.min(10, 6 + this.getImpactScore(signal.impact) / 25);
    if (signal.signal_type === 'opportunity') opportunityEnablement = Math.min(10, 6 + this.getImpactScore(signal.impact) / 25);
    if (signal.signal_type === 'dependency') riskReduction = Math.min(10, riskReduction + 2);

    // Job Size (1-10) - smaller is better for WSJF
    let jobSize = 5; // Default medium
    if (signal.metadata?.estimated_effort) {
      const effort = signal.metadata.estimated_effort as string;
      if (effort === 'low') jobSize = 2;
      else if (effort === 'medium') jobSize = 5;
      else if (effort === 'high') jobSize = 8;
    } else {
      // Estimate based on signal type
      if (signal.signal_type === 'anomaly') jobSize = 3;
      if (signal.signal_type === 'pattern') jobSize = 4;
      if (signal.signal_type === 'conflict') jobSize = 6;
      if (signal.signal_type === 'dependency') jobSize = 7;
    }

    // Calculate WSJF score
    const costOfDelay = businessValue + timeCriticality + riskReduction + opportunityEnablement;
    const wsjfScore = jobSize > 0 ? costOfDelay / jobSize : costOfDelay;

    return {
      signalId: signal.id,
      businessValue,
      timeCriticality,
      riskReduction,
      opportunityEnablement,
      jobSize,
      wsjfScore,
      rank: 0, // Will be set after sorting
    };
  }

  /**
   * Calculate custom priority scores
   */
  private calculateCustomScores(
    signal: Signal,
    context: PrioritizationContext
  ): Record<string, number> {
    const scores: Record<string, number> = {};

    // Default priority score
    scores['default'] = this.calculateDefaultPriority(signal, context);

    // Apply any custom formulas
    this.customFormulas.forEach((formula, id) => {
      scores[id] = this.evaluateFormula(formula, signal, context);
    });

    // Apply user preference weights if provided
    if (context.preferences?.customWeights) {
      Object.entries(context.preferences.customWeights).forEach(([key, weight]) => {
        if (scores[key] !== undefined) {
          scores[key] *= weight;
        }
      });
    }

    return scores;
  }

  /**
   * Calculate default priority score
   */
  private calculateDefaultPriority(
    signal: Signal,
    context: PrioritizationContext
  ): number {
    const urgencyWeight = context.preferences?.urgencyWeight || 1;
    const impactWeight = context.preferences?.impactWeight || 1;
    const confidenceWeight = context.preferences?.confidenceWeight || 0.5;

    const urgencyScore = this.getUrgencyScore(signal.urgency);
    const impactScore = this.getImpactScore(signal.impact);
    const confidenceScore = signal.confidence * 100;

    return (
      (urgencyScore * urgencyWeight +
        impactScore * impactWeight +
        confidenceScore * confidenceWeight) /
      (urgencyWeight + impactWeight + confidenceWeight)
    );
  }

  /**
   * Evaluate a custom formula
   */
  private evaluateFormula(
    formula: CustomPriorityFormula,
    signal: Signal,
    context: PrioritizationContext
  ): number {
    const variables: Record<string, number> = {
      urgency: this.getUrgencyScore(signal.urgency),
      impact: this.getImpactScore(signal.impact),
      confidence: signal.confidence * 100,
      ...formula.weights,
    };

    try {
      // Simple expression evaluation (in production, use a proper expression parser)
      let expression = formula.formula;
      Object.entries(variables).forEach(([key, value]) => {
        expression = expression.replace(new RegExp(key, 'g'), value.toString());
      });

      // Basic math operations only
      const result = this.safeEval(expression);
      return Math.max(0, Math.min(100, result));
    } catch (error) {
      console.error(`Error evaluating formula ${formula.id}:`, error);
      return 50;
    }
  }

  /**
   * Safe evaluation of simple math expressions
   */
  private safeEval(expression: string): number {
    // Only allow numbers, operators, and parentheses
    const sanitized = expression.replace(/[^0-9+\-*/().]/g, '');
    if (!sanitized) return 0;

    try {
      // Use Function constructor for safer evaluation than eval
      return new Function(`return ${sanitized}`)();
    } catch {
      return 0;
    }
  }

  /**
   * Calculate overall priority from all frameworks
   */
  private calculateOverallPriority(
    eisenhower: EisenhowerPlacement,
    moscow: MoSCoWPlacement,
    wsjf: WSJFScore,
    customScores: Record<string, number>,
    context: PrioritizationContext
  ): number {
    // Weight each framework
    const eisenhowerScore =
      ((eisenhower.urgencyScore + eisenhower.importanceScore) / 2) *
      (eisenhower.quadrant === 'do_first'
        ? 1.2
        : eisenhower.quadrant === 'schedule'
        ? 1.0
        : eisenhower.quadrant === 'delegate'
        ? 0.8
        : 0.5);

    const moscowScore = moscow.score;

    // Normalize WSJF to 0-100
    const wsjfNormalized = Math.min(100, wsjf.wsjfScore * 10);

    // Custom score (use default if available)
    const customScore = customScores['default'] || 50;

    // Weighted average
    const weights = {
      eisenhower: 0.25,
      moscow: 0.25,
      wsjf: 0.30,
      custom: 0.20,
    };

    return (
      eisenhowerScore * weights.eisenhower +
      moscowScore * weights.moscow +
      wsjfNormalized * weights.wsjf +
      customScore * weights.custom
    );
  }

  /**
   * Get action recommendation based on analysis
   */
  private getActionRecommendation(
    signal: Signal,
    eisenhower: EisenhowerPlacement,
    moscow: MoSCoWPlacement
  ): string {
    if (eisenhower.quadrant === 'do_first' && moscow.category === 'must_have') {
      return `CRITICAL: ${signal.title} requires immediate attention. Block time now to address.`;
    }

    if (eisenhower.quadrant === 'do_first') {
      return `URGENT: Address ${signal.signal_type} signal within the next few hours.`;
    }

    if (moscow.category === 'must_have') {
      return `IMPORTANT: Schedule time this week to address ${signal.title}.`;
    }

    if (eisenhower.quadrant === 'schedule') {
      return `PLAN: Add to weekly planning - ${signal.description || signal.title}`;
    }

    if (eisenhower.quadrant === 'delegate') {
      return `DELEGATE: Consider assigning to team member or automating response.`;
    }

    return `REVIEW: Evaluate if this signal requires action or can be dismissed.`;
  }

  /**
   * Estimate time to address based on WSJF
   */
  private estimateTimeToAddress(signal: Signal, wsjf: WSJFScore): string {
    const jobSize = wsjf.jobSize;

    if (jobSize <= 2) return '15-30 minutes';
    if (jobSize <= 4) return '1-2 hours';
    if (jobSize <= 6) return '2-4 hours';
    if (jobSize <= 8) return '4-8 hours';
    return '1-2 days';
  }

  /**
   * Dynamic re-prioritization on context change
   */
  async rePrioritize(
    signals: Signal[],
    newContext: PrioritizationContext,
    contextChanges: string[]
  ): Promise<RePrioritizationResult> {
    const previousRanking = this.previousRankings.get(newContext.userId) || [];

    // Calculate new priorities
    const newRanking = await this.prioritizeSignals(signals, newContext);

    // Track changes
    const changes: RePrioritizationResult['changes'] = [];

    newRanking.forEach((newItem) => {
      const previousItem = previousRanking.find((p) => p.signal.id === newItem.signal.id);

      if (previousItem) {
        const rankChange = previousItem.rank - newItem.rank;
        if (rankChange !== 0) {
          changes.push({
            signalId: newItem.signal.id,
            previousRank: previousItem.rank,
            newRank: newItem.rank,
            changeReason: this.explainRankChange(previousItem, newItem, contextChanges),
          });
        }
      } else {
        changes.push({
          signalId: newItem.signal.id,
          previousRank: -1,
          newRank: newItem.rank,
          changeReason: 'New signal added',
        });
      }
    });

    return {
      previousRanking,
      newRanking,
      changes,
      contextChanges,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Explain why a signal's rank changed
   */
  private explainRankChange(
    previous: PrioritizedSignal,
    current: PrioritizedSignal,
    contextChanges: string[]
  ): string {
    const reasons: string[] = [];

    // Check Eisenhower changes
    if (previous.eisenhower.quadrant !== current.eisenhower.quadrant) {
      reasons.push(`Moved from ${previous.eisenhower.quadrant} to ${current.eisenhower.quadrant}`);
    }

    // Check MoSCoW changes
    if (previous.moscow.category !== current.moscow.category) {
      reasons.push(`Category changed from ${previous.moscow.category} to ${current.moscow.category}`);
    }

    // Check WSJF score changes
    const wsjfChange = current.wsjf.wsjfScore - previous.wsjf.wsjfScore;
    if (Math.abs(wsjfChange) > 1) {
      reasons.push(`WSJF score ${wsjfChange > 0 ? 'increased' : 'decreased'} by ${Math.abs(wsjfChange).toFixed(1)}`);
    }

    // Include context changes if relevant
    if (contextChanges.length > 0) {
      reasons.push(`Context changed: ${contextChanges.join(', ')}`);
    }

    return reasons.length > 0 ? reasons.join('; ') : 'Minor priority adjustment';
  }

  /**
   * Add a custom priority formula
   */
  addCustomFormula(formula: Omit<CustomPriorityFormula, 'id' | 'createdAt'>): CustomPriorityFormula {
    const customFormula: CustomPriorityFormula = {
      ...formula,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };

    this.customFormulas.set(customFormula.id, customFormula);
    return customFormula;
  }

  /**
   * Remove a custom formula
   */
  removeCustomFormula(formulaId: string): boolean {
    return this.customFormulas.delete(formulaId);
  }

  /**
   * Get all custom formulas
   */
  getCustomFormulas(): CustomPriorityFormula[] {
    return Array.from(this.customFormulas.values());
  }

  /**
   * Get signals by Eisenhower quadrant
   */
  getSignalsByQuadrant(
    prioritized: PrioritizedSignal[],
    quadrant: EisenhowerQuadrant
  ): PrioritizedSignal[] {
    return prioritized.filter((p) => p.eisenhower.quadrant === quadrant);
  }

  /**
   * Get signals by MoSCoW category
   */
  getSignalsByCategory(
    prioritized: PrioritizedSignal[],
    category: MoSCoWCategory
  ): PrioritizedSignal[] {
    return prioritized.filter((p) => p.moscow.category === category);
  }

  /**
   * Get top N signals by WSJF
   */
  getTopByWSJF(prioritized: PrioritizedSignal[], count: number): PrioritizedSignal[] {
    return [...prioritized]
      .sort((a, b) => b.wsjf.wsjfScore - a.wsjf.wsjfScore)
      .slice(0, count);
  }

  // Utility methods

  private getUrgencyScore(urgency: UrgencyLevel): number {
    const scores: Record<UrgencyLevel, number> = {
      critical: 100,
      high: 75,
      medium: 50,
      low: 25,
    };
    return scores[urgency] || 50;
  }

  private getImpactScore(impact: ImpactLevel): number {
    const scores: Record<ImpactLevel, number> = {
      critical: 100,
      high: 75,
      medium: 50,
      low: 25,
    };
    return scores[impact] || 50;
  }

  private calculateGoalAlignment(
    signal: Signal,
    goals: Array<{ id: string; priority: number; description: string }>
  ): number {
    // Check if signal relates to any goals
    const relatedGoal = goals.find(
      (g) => signal.related_entity_id === g.id || signal.metadata?.goal_id === g.id
    );

    if (relatedGoal) {
      return relatedGoal.priority;
    }

    // Check for keyword matches in descriptions
    const signalKeywords = (signal.title + ' ' + (signal.description || '')).toLowerCase();
    let maxAlignment = 0;

    goals.forEach((goal) => {
      const goalKeywords = goal.description.toLowerCase().split(' ');
      let matches = 0;
      goalKeywords.forEach((keyword) => {
        if (keyword.length > 3 && signalKeywords.includes(keyword)) {
          matches++;
        }
      });
      const alignment = (matches / goalKeywords.length) * goal.priority;
      maxAlignment = Math.max(maxAlignment, alignment);
    });

    return maxAlignment;
  }
}

// Singleton instance
export const signalPrioritizationService = new SignalPrioritizationService();
