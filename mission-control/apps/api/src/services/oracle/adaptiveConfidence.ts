/**
 * ORACLE Adaptive Confidence Service
 * Story adv-14 - Enhance probability engine with adaptive learning
 *
 * Implements:
 * - Per-user calibration profiles
 * - Category-specific priors
 * - Automatic prior adjustment based on outcomes
 * - Confidence boost for successful patterns
 * - Degradation for consistently wrong predictions
 */

import { oracleCacheService, cacheKey, hashObject } from './cache';
import { probabilityEngineService, BayesianPrior, CalibrationState } from './probability';
import { patternLearningService } from './patternLearning';
import type { PredictionAccuracyCategory } from '@mission-control/shared-types';

// ============================================================================
// Types
// ============================================================================

export interface UserCalibrationProfile {
  id: string;
  user_id: string;
  global_calibration: CalibrationState;
  category_calibrations: Record<PredictionAccuracyCategory, CalibrationState>;
  category_priors: Record<PredictionAccuracyCategory, BayesianPrior>;
  domain_priors: Record<string, BayesianPrior>;
  confidence_modifiers: ConfidenceModifiers;
  pattern_boosts: PatternBoostRecord[];
  degradation_records: DegradationRecord[];
  learning_rate: number;
  adjustment_sensitivity: number;
  last_updated: string;
  created_at: string;
}

export interface ConfidenceModifiers {
  global_adjustment: number; // -0.2 to +0.2
  overconfidence_correction: number; // 0.8 to 1.2
  underconfidence_correction: number; // 0.8 to 1.2
  time_of_day_modifiers: Record<string, number>; // hour -> modifier
  day_of_week_modifiers: Record<string, number>; // day -> modifier
  streak_bonus: number; // 0 to 0.1
  recent_accuracy_weight: number; // 0.1 to 0.5
}

export interface PatternBoostRecord {
  pattern_id: string;
  pattern_type: string;
  boost_amount: number; // 0 to 0.15
  success_rate: number;
  sample_size: number;
  last_applied: string;
}

export interface DegradationRecord {
  category: PredictionAccuracyCategory | 'global';
  degradation_amount: number; // 0 to -0.2
  consecutive_failures: number;
  recovery_progress: number; // 0 to 1
  last_updated: string;
}

export interface ConfidenceAdjustmentResult {
  original_confidence: number;
  adjusted_confidence: number;
  adjustments_applied: AdjustmentDetail[];
  final_prior: BayesianPrior;
  calibration_used: 'global' | 'category' | 'domain';
}

export interface AdjustmentDetail {
  type: string;
  source: string;
  amount: number;
  reason: string;
}

export interface OutcomeRecord {
  prediction_id?: string;
  category: PredictionAccuracyCategory;
  domain?: string;
  predicted_confidence: number;
  actual_outcome: boolean;
  context?: Record<string, any>;
  timestamp: string;
}

// Cache TTLs
const CONFIDENCE_CACHE_TTL = {
  profile: 15 * 60 * 1000, // 15 minutes
  adjustment: 5 * 60 * 1000, // 5 minutes
};

// Adjustment limits
const ADJUSTMENT_LIMITS = {
  max_boost: 0.15,
  max_degradation: -0.2,
  min_confidence: 0.01,
  max_confidence: 0.99,
  streak_threshold: 3,
  degradation_recovery_rate: 0.05,
  pattern_boost_decay: 0.01, // per day
};

// ============================================================================
// Adaptive Confidence Service
// ============================================================================

export class AdaptiveConfidenceService {
  // In-memory store for profiles (would use Supabase in production)
  private profiles: Map<string, UserCalibrationProfile> = new Map();
  private outcomeHistory: Map<string, OutcomeRecord[]> = new Map();

  // ============================================================================
  // Profile Management
  // ============================================================================

  /**
   * Get or create a user's calibration profile
   */
  async getUserProfile(userId: string): Promise<UserCalibrationProfile> {
    const cacheKeyStr = cacheKey('profile', userId);
    const cached = oracleCacheService.get<UserCalibrationProfile>(cacheKeyStr);
    if (cached) {
      return cached;
    }

    let profile = this.profiles.get(userId);

    if (!profile) {
      profile = this.createDefaultProfile(userId);
      this.profiles.set(userId, profile);
    }

    oracleCacheService.set(cacheKeyStr, profile, CONFIDENCE_CACHE_TTL.profile);
    return profile;
  }

  /**
   * Create a default calibration profile for a new user
   */
  private createDefaultProfile(userId: string): UserCalibrationProfile {
    const now = new Date().toISOString();
    const categories: PredictionAccuracyCategory[] = [
      'task_completion',
      'deadline_risk',
      'resource_availability',
      'outcome_likelihood',
      'duration_estimate',
      'custom',
    ];

    const categoryCalibrations: Record<PredictionAccuracyCategory, CalibrationState> = {} as any;
    const categoryPriors: Record<PredictionAccuracyCategory, BayesianPrior> = {} as any;

    for (const category of categories) {
      categoryCalibrations[category] = probabilityEngineService.initializeCalibration();
      categoryPriors[category] = { alpha: 1, beta: 1 }; // Uniform prior
    }

    return {
      id: crypto.randomUUID(),
      user_id: userId,
      global_calibration: probabilityEngineService.initializeCalibration(),
      category_calibrations: categoryCalibrations,
      category_priors: categoryPriors,
      domain_priors: {},
      confidence_modifiers: {
        global_adjustment: 0,
        overconfidence_correction: 1,
        underconfidence_correction: 1,
        time_of_day_modifiers: {},
        day_of_week_modifiers: {},
        streak_bonus: 0,
        recent_accuracy_weight: 0.3,
      },
      pattern_boosts: [],
      degradation_records: [],
      learning_rate: 0.1,
      adjustment_sensitivity: 0.5,
      last_updated: now,
      created_at: now,
    };
  }

  // ============================================================================
  // Confidence Adjustment
  // ============================================================================

  /**
   * Adjust confidence using adaptive learning
   * Main entry point for getting calibrated confidence scores
   */
  async adjustConfidence(
    userId: string,
    baseConfidence: number,
    category: PredictionAccuracyCategory,
    options: {
      domain?: string;
      context?: Record<string, any>;
      includePatternBoosts?: boolean;
      includeDegradation?: boolean;
    } = {}
  ): Promise<ConfidenceAdjustmentResult> {
    const profile = await this.getUserProfile(userId);
    const adjustments: AdjustmentDetail[] = [];
    let confidence = baseConfidence;
    let calibrationUsed: 'global' | 'category' | 'domain' = 'global';

    // 1. Apply global adjustment
    if (profile.confidence_modifiers.global_adjustment !== 0) {
      const amount = profile.confidence_modifiers.global_adjustment;
      confidence += amount;
      adjustments.push({
        type: 'global_adjustment',
        source: 'user_profile',
        amount,
        reason: 'Historical calibration correction',
      });
    }

    // 2. Apply category-specific calibration
    const categoryCalibration = profile.category_calibrations[category];
    if (categoryCalibration && categoryCalibration.resolvedPredictions >= 10) {
      const calibrationAdj = probabilityEngineService.getCalibrationAdjustment(
        categoryCalibration,
        confidence
      );

      if (calibrationAdj !== 1) {
        const amount = (calibrationAdj - 1) * 0.1; // Scale down the adjustment
        confidence *= (1 + amount);
        calibrationUsed = 'category';
        adjustments.push({
          type: 'category_calibration',
          source: category,
          amount,
          reason: `Category-specific accuracy: ${(categoryCalibration.brierScore * 100).toFixed(1)}% Brier`,
        });
      }
    }

    // 3. Apply overconfidence/underconfidence corrections
    if (confidence > 0.8 && profile.confidence_modifiers.overconfidence_correction !== 1) {
      const correction = profile.confidence_modifiers.overconfidence_correction;
      const originalConfidence = confidence;
      confidence = 0.5 + (confidence - 0.5) * correction;
      adjustments.push({
        type: 'overconfidence_correction',
        source: 'user_profile',
        amount: confidence - originalConfidence,
        reason: 'Historical overconfidence adjustment',
      });
    }

    if (confidence < 0.4 && profile.confidence_modifiers.underconfidence_correction !== 1) {
      const correction = profile.confidence_modifiers.underconfidence_correction;
      const originalConfidence = confidence;
      confidence = 0.5 - (0.5 - confidence) * correction;
      adjustments.push({
        type: 'underconfidence_correction',
        source: 'user_profile',
        amount: confidence - originalConfidence,
        reason: 'Historical underconfidence adjustment',
      });
    }

    // 4. Apply time-of-day modifier if applicable
    if (options.context) {
      const hour = options.context.hour || new Date().getHours();
      const hourKey = hour.toString();
      const timeModifier = profile.confidence_modifiers.time_of_day_modifiers[hourKey];

      if (timeModifier && timeModifier !== 0) {
        confidence += timeModifier;
        adjustments.push({
          type: 'time_of_day',
          source: `hour_${hour}`,
          amount: timeModifier,
          reason: `Historical accuracy at ${hour}:00`,
        });
      }
    }

    // 5. Apply day-of-week modifier
    if (options.context) {
      const day = options.context.day_of_week ?? new Date().getDay();
      const dayKey = day.toString();
      const dayModifier = profile.confidence_modifiers.day_of_week_modifiers[dayKey];

      if (dayModifier && dayModifier !== 0) {
        confidence += dayModifier;
        const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day];
        adjustments.push({
          type: 'day_of_week',
          source: dayName,
          amount: dayModifier,
          reason: `Historical accuracy on ${dayName}s`,
        });
      }
    }

    // 6. Apply pattern boosts if enabled
    if (options.includePatternBoosts !== false) {
      const patternBoost = await this.calculatePatternBoost(userId, category, options.context);
      if (patternBoost > 0) {
        confidence += patternBoost;
        adjustments.push({
          type: 'pattern_boost',
          source: 'learned_patterns',
          amount: patternBoost,
          reason: 'Successful pattern recognition bonus',
        });
      }
    }

    // 7. Apply degradation if enabled
    if (options.includeDegradation !== false) {
      const degradation = this.calculateDegradation(profile, category);
      if (degradation < 0) {
        confidence += degradation;
        adjustments.push({
          type: 'degradation',
          source: category,
          amount: degradation,
          reason: 'Recent prediction failures penalty',
        });
      }
    }

    // 8. Apply streak bonus
    if (profile.confidence_modifiers.streak_bonus > 0) {
      confidence += profile.confidence_modifiers.streak_bonus;
      adjustments.push({
        type: 'streak_bonus',
        source: 'recent_successes',
        amount: profile.confidence_modifiers.streak_bonus,
        reason: `${ADJUSTMENT_LIMITS.streak_threshold}+ correct predictions in a row`,
      });
    }

    // 9. Apply domain-specific prior if available
    let finalPrior = profile.category_priors[category];
    if (options.domain && profile.domain_priors[options.domain]) {
      finalPrior = profile.domain_priors[options.domain];
      calibrationUsed = 'domain';
    }

    // Clamp to valid range
    confidence = Math.max(ADJUSTMENT_LIMITS.min_confidence, Math.min(ADJUSTMENT_LIMITS.max_confidence, confidence));

    return {
      original_confidence: baseConfidence,
      adjusted_confidence: confidence,
      adjustments_applied: adjustments,
      final_prior: finalPrior,
      calibration_used: calibrationUsed,
    };
  }

  /**
   * Calculate pattern-based confidence boost
   */
  private async calculatePatternBoost(
    userId: string,
    category: PredictionAccuracyCategory,
    context?: Record<string, any>
  ): Promise<number> {
    const profile = this.profiles.get(userId);
    if (!profile) return 0;

    let totalBoost = 0;

    // Check for matching pattern boosts
    for (const boost of profile.pattern_boosts) {
      if (boost.sample_size >= 5 && boost.success_rate >= 0.7) {
        // Decay boost based on time since last applied
        const daysSinceApplied =
          (Date.now() - new Date(boost.last_applied).getTime()) / (24 * 60 * 60 * 1000);
        const decayedBoost = boost.boost_amount * Math.exp(-ADJUSTMENT_LIMITS.pattern_boost_decay * daysSinceApplied);

        if (decayedBoost > 0.01) {
          totalBoost += decayedBoost;
        }
      }
    }

    // Cap total boost
    return Math.min(totalBoost, ADJUSTMENT_LIMITS.max_boost);
  }

  /**
   * Calculate degradation penalty for a category
   */
  private calculateDegradation(
    profile: UserCalibrationProfile,
    category: PredictionAccuracyCategory
  ): number {
    const record = profile.degradation_records.find((r) => r.category === category);

    if (!record) return 0;

    // Apply degradation adjusted by recovery progress
    return record.degradation_amount * (1 - record.recovery_progress);
  }

  // ============================================================================
  // Outcome Recording and Learning
  // ============================================================================

  /**
   * Record a prediction outcome and update calibration
   */
  async recordOutcome(userId: string, outcome: OutcomeRecord): Promise<void> {
    const profile = await this.getUserProfile(userId);

    // Store outcome in history
    if (!this.outcomeHistory.has(userId)) {
      this.outcomeHistory.set(userId, []);
    }
    const history = this.outcomeHistory.get(userId)!;
    history.push(outcome);

    // Keep last 1000 outcomes
    if (history.length > 1000) {
      history.shift();
    }

    // Update global calibration
    profile.global_calibration = probabilityEngineService.updateCalibration(
      profile.global_calibration,
      { forecast: outcome.predicted_confidence, outcome: outcome.actual_outcome }
    );

    // Update category-specific calibration
    profile.category_calibrations[outcome.category] = probabilityEngineService.updateCalibration(
      profile.category_calibrations[outcome.category],
      { forecast: outcome.predicted_confidence, outcome: outcome.actual_outcome }
    );

    // Update category prior
    profile.category_priors[outcome.category] = probabilityEngineService.bayesianUpdate(
      profile.category_priors[outcome.category],
      outcome.actual_outcome
    );

    // Update domain prior if applicable
    if (outcome.domain) {
      if (!profile.domain_priors[outcome.domain]) {
        profile.domain_priors[outcome.domain] = { alpha: 1, beta: 1 };
      }
      profile.domain_priors[outcome.domain] = probabilityEngineService.bayesianUpdate(
        profile.domain_priors[outcome.domain],
        outcome.actual_outcome
      );
    }

    // Update confidence modifiers
    await this.updateConfidenceModifiers(profile, outcome);

    // Update streak bonus
    this.updateStreakBonus(profile, outcome.actual_outcome);

    // Update degradation records
    this.updateDegradation(profile, outcome);

    // Update pattern boosts if outcome was successful
    if (outcome.actual_outcome && outcome.context) {
      await this.updatePatternBoosts(userId, profile, outcome);
    }

    profile.last_updated = new Date().toISOString();

    // Invalidate cache
    oracleCacheService.deleteByPrefix(`profile:${userId}`);
    oracleCacheService.deleteByPrefix(`adjustment:${userId}`);
  }

  /**
   * Update confidence modifiers based on outcome patterns
   */
  private async updateConfidenceModifiers(
    profile: UserCalibrationProfile,
    outcome: OutcomeRecord
  ): Promise<void> {
    const learningRate = profile.learning_rate;
    const history = this.outcomeHistory.get(profile.user_id) || [];

    // Get recent outcomes for analysis
    const recentOutcomes = history.slice(-50);
    if (recentOutcomes.length < 10) return;

    // Calculate overall accuracy
    const overallAccuracy = recentOutcomes.filter((o) => o.actual_outcome).length / recentOutcomes.length;

    // Adjust global adjustment based on accuracy trend
    const expectedAccuracy = recentOutcomes.reduce((sum, o) => sum + o.predicted_confidence, 0) / recentOutcomes.length;
    const calibrationError = overallAccuracy - expectedAccuracy;

    // Slowly adjust global modifier
    profile.confidence_modifiers.global_adjustment =
      profile.confidence_modifiers.global_adjustment * (1 - learningRate) +
      (calibrationError * 0.1) * learningRate;

    // Clamp global adjustment
    profile.confidence_modifiers.global_adjustment = Math.max(
      -0.2,
      Math.min(0.2, profile.confidence_modifiers.global_adjustment)
    );

    // Check for overconfidence (high predictions with low accuracy)
    const highConfidenceOutcomes = recentOutcomes.filter((o) => o.predicted_confidence > 0.8);
    if (highConfidenceOutcomes.length >= 5) {
      const highConfAccuracy = highConfidenceOutcomes.filter((o) => o.actual_outcome).length / highConfidenceOutcomes.length;
      if (highConfAccuracy < 0.7) {
        profile.confidence_modifiers.overconfidence_correction =
          profile.confidence_modifiers.overconfidence_correction * (1 - learningRate) +
          0.9 * learningRate;
      } else if (highConfAccuracy > 0.85) {
        profile.confidence_modifiers.overconfidence_correction =
          profile.confidence_modifiers.overconfidence_correction * (1 - learningRate) +
          1.05 * learningRate;
      }
    }

    // Check for underconfidence (low predictions with high accuracy)
    const lowConfidenceOutcomes = recentOutcomes.filter((o) => o.predicted_confidence < 0.4);
    if (lowConfidenceOutcomes.length >= 5) {
      const lowConfAccuracy = lowConfidenceOutcomes.filter((o) => o.actual_outcome).length / lowConfidenceOutcomes.length;
      if (lowConfAccuracy > 0.5) {
        profile.confidence_modifiers.underconfidence_correction =
          profile.confidence_modifiers.underconfidence_correction * (1 - learningRate) +
          0.9 * learningRate;
      } else if (lowConfAccuracy < 0.3) {
        profile.confidence_modifiers.underconfidence_correction =
          profile.confidence_modifiers.underconfidence_correction * (1 - learningRate) +
          1.05 * learningRate;
      }
    }

    // Clamp corrections
    profile.confidence_modifiers.overconfidence_correction = Math.max(
      0.8,
      Math.min(1.2, profile.confidence_modifiers.overconfidence_correction)
    );
    profile.confidence_modifiers.underconfidence_correction = Math.max(
      0.8,
      Math.min(1.2, profile.confidence_modifiers.underconfidence_correction)
    );

    // Update time-of-day modifiers
    await this.updateTimeModifiers(profile, history);

    // Update day-of-week modifiers
    await this.updateDayModifiers(profile, history);
  }

  /**
   * Update time-of-day accuracy modifiers
   */
  private async updateTimeModifiers(
    profile: UserCalibrationProfile,
    history: OutcomeRecord[]
  ): Promise<void> {
    const hourAccuracy: Record<string, { correct: number; total: number }> = {};

    for (const outcome of history) {
      const hour = new Date(outcome.timestamp).getHours();
      const hourKey = hour.toString();

      if (!hourAccuracy[hourKey]) {
        hourAccuracy[hourKey] = { correct: 0, total: 0 };
      }

      hourAccuracy[hourKey].total++;
      if (outcome.actual_outcome) {
        hourAccuracy[hourKey].correct++;
      }
    }

    const overallAccuracy = history.filter((o) => o.actual_outcome).length / history.length;

    for (const [hour, stats] of Object.entries(hourAccuracy)) {
      if (stats.total >= 5) {
        const hourAccuracyRate = stats.correct / stats.total;
        const modifier = (hourAccuracyRate - overallAccuracy) * 0.1;
        profile.confidence_modifiers.time_of_day_modifiers[hour] = modifier;
      }
    }
  }

  /**
   * Update day-of-week accuracy modifiers
   */
  private async updateDayModifiers(
    profile: UserCalibrationProfile,
    history: OutcomeRecord[]
  ): Promise<void> {
    const dayAccuracy: Record<string, { correct: number; total: number }> = {};

    for (const outcome of history) {
      const day = new Date(outcome.timestamp).getDay();
      const dayKey = day.toString();

      if (!dayAccuracy[dayKey]) {
        dayAccuracy[dayKey] = { correct: 0, total: 0 };
      }

      dayAccuracy[dayKey].total++;
      if (outcome.actual_outcome) {
        dayAccuracy[dayKey].correct++;
      }
    }

    const overallAccuracy = history.filter((o) => o.actual_outcome).length / history.length;

    for (const [day, stats] of Object.entries(dayAccuracy)) {
      if (stats.total >= 5) {
        const dayAccuracyRate = stats.correct / stats.total;
        const modifier = (dayAccuracyRate - overallAccuracy) * 0.1;
        profile.confidence_modifiers.day_of_week_modifiers[day] = modifier;
      }
    }
  }

  /**
   * Update streak bonus based on consecutive correct predictions
   */
  private updateStreakBonus(profile: UserCalibrationProfile, wasCorrect: boolean): void {
    const history = this.outcomeHistory.get(profile.user_id) || [];
    const recentOutcomes = history.slice(-10);

    let streak = 0;
    for (let i = recentOutcomes.length - 1; i >= 0; i--) {
      if (recentOutcomes[i].actual_outcome) {
        streak++;
      } else {
        break;
      }
    }

    if (streak >= ADJUSTMENT_LIMITS.streak_threshold) {
      profile.confidence_modifiers.streak_bonus = Math.min(
        0.1,
        (streak - ADJUSTMENT_LIMITS.streak_threshold + 1) * 0.02
      );
    } else {
      profile.confidence_modifiers.streak_bonus = 0;
    }
  }

  /**
   * Update degradation records based on failures
   */
  private updateDegradation(profile: UserCalibrationProfile, outcome: OutcomeRecord): void {
    const existingRecord = profile.degradation_records.find(
      (r) => r.category === outcome.category
    );

    if (outcome.actual_outcome) {
      // Successful outcome - recover from degradation
      if (existingRecord) {
        existingRecord.recovery_progress = Math.min(
          1,
          existingRecord.recovery_progress + ADJUSTMENT_LIMITS.degradation_recovery_rate
        );

        if (existingRecord.recovery_progress >= 1) {
          // Fully recovered - remove record
          profile.degradation_records = profile.degradation_records.filter(
            (r) => r.category !== outcome.category
          );
        } else {
          existingRecord.consecutive_failures = 0;
          existingRecord.last_updated = new Date().toISOString();
        }
      }
    } else {
      // Failed outcome - increase degradation
      if (existingRecord) {
        existingRecord.consecutive_failures++;
        existingRecord.recovery_progress = 0;
        existingRecord.degradation_amount = Math.max(
          ADJUSTMENT_LIMITS.max_degradation,
          -0.02 * existingRecord.consecutive_failures
        );
        existingRecord.last_updated = new Date().toISOString();
      } else {
        // Create new degradation record
        profile.degradation_records.push({
          category: outcome.category,
          degradation_amount: -0.02,
          consecutive_failures: 1,
          recovery_progress: 0,
          last_updated: new Date().toISOString(),
        });
      }
    }
  }

  /**
   * Update pattern boost records
   */
  private async updatePatternBoosts(
    userId: string,
    profile: UserCalibrationProfile,
    outcome: OutcomeRecord
  ): Promise<void> {
    try {
      // Get user's active patterns
      const patterns = await patternLearningService.getUserPatterns(userId, {
        active_only: true,
        min_confidence: 0.5,
        limit: 10,
      });

      for (const pattern of patterns) {
        // Check if this pattern was involved in the prediction
        const existingBoost = profile.pattern_boosts.find(
          (b) => b.pattern_id === pattern.id
        );

        if (existingBoost) {
          // Update existing boost
          const newTotal = existingBoost.sample_size + 1;
          const newSuccesses = existingBoost.success_rate * existingBoost.sample_size + (outcome.actual_outcome ? 1 : 0);
          existingBoost.success_rate = newSuccesses / newTotal;
          existingBoost.sample_size = newTotal;
          existingBoost.boost_amount = Math.min(
            ADJUSTMENT_LIMITS.max_boost,
            (existingBoost.success_rate - 0.5) * 0.2
          );
          existingBoost.last_applied = new Date().toISOString();
        } else if (pattern.confidence >= 0.7) {
          // Create new boost record for high-confidence pattern
          profile.pattern_boosts.push({
            pattern_id: pattern.id,
            pattern_type: pattern.pattern_type,
            boost_amount: 0.01,
            success_rate: outcome.actual_outcome ? 1 : 0,
            sample_size: 1,
            last_applied: new Date().toISOString(),
          });
        }
      }

      // Remove ineffective boosts
      profile.pattern_boosts = profile.pattern_boosts.filter(
        (b) => b.sample_size < 5 || b.success_rate >= 0.5
      );
    } catch (error) {
      // Pattern learning service may not have data yet
      console.error('Error updating pattern boosts:', error);
    }
  }

  // ============================================================================
  // Analytics and Reporting
  // ============================================================================

  /**
   * Get calibration report for a user
   */
  async getCalibrationReport(userId: string): Promise<{
    global_brier_score: number;
    is_well_calibrated: boolean;
    category_scores: Record<PredictionAccuracyCategory, { brier_score: number; total_predictions: number }>;
    strongest_category: PredictionAccuracyCategory | null;
    weakest_category: PredictionAccuracyCategory | null;
    improvement_suggestions: string[];
    confidence_adjustment_summary: {
      average_adjustment: number;
      most_common_adjustment: string;
    };
  }> {
    const profile = await this.getUserProfile(userId);
    const categories: PredictionAccuracyCategory[] = [
      'task_completion',
      'deadline_risk',
      'resource_availability',
      'outcome_likelihood',
      'duration_estimate',
      'custom',
    ];

    const categoryScores: Record<PredictionAccuracyCategory, { brier_score: number; total_predictions: number }> = {} as any;
    let strongestCategory: PredictionAccuracyCategory | null = null;
    let weakestCategory: PredictionAccuracyCategory | null = null;
    let bestScore = 1;
    let worstScore = 0;

    for (const category of categories) {
      const calibration = profile.category_calibrations[category];
      categoryScores[category] = {
        brier_score: calibration.brierScore,
        total_predictions: calibration.resolvedPredictions,
      };

      if (calibration.resolvedPredictions >= 5) {
        if (calibration.brierScore < bestScore) {
          bestScore = calibration.brierScore;
          strongestCategory = category;
        }
        if (calibration.brierScore > worstScore) {
          worstScore = calibration.brierScore;
          weakestCategory = category;
        }
      }
    }

    const suggestions: string[] = [];

    // Generate improvement suggestions
    if (profile.confidence_modifiers.overconfidence_correction < 0.95) {
      suggestions.push('You tend to be overconfident in high-probability predictions. Consider being more conservative.');
    }
    if (profile.confidence_modifiers.underconfidence_correction < 0.95) {
      suggestions.push('You tend to underestimate low-probability outcomes. Consider increasing confidence in these cases.');
    }
    if (profile.degradation_records.length > 0) {
      const categories = profile.degradation_records.map((r) => r.category).join(', ');
      suggestions.push(`Recent accuracy issues in: ${categories}. Focus on improving these areas.`);
    }
    if (weakestCategory && categoryScores[weakestCategory].brier_score > 0.3) {
      suggestions.push(`"${weakestCategory}" has the highest error rate. Review your prediction methodology for this category.`);
    }

    return {
      global_brier_score: profile.global_calibration.brierScore,
      is_well_calibrated: probabilityEngineService.isWellCalibrated(profile.global_calibration),
      category_scores: categoryScores,
      strongest_category: strongestCategory,
      weakest_category: weakestCategory,
      improvement_suggestions: suggestions,
      confidence_adjustment_summary: {
        average_adjustment: profile.confidence_modifiers.global_adjustment,
        most_common_adjustment:
          profile.confidence_modifiers.global_adjustment > 0 ? 'boost' : profile.confidence_modifiers.global_adjustment < 0 ? 'reduction' : 'none',
      },
    };
  }

  /**
   * Reset a user's calibration profile
   */
  async resetProfile(userId: string): Promise<void> {
    const profile = this.createDefaultProfile(userId);
    profile.id = this.profiles.get(userId)?.id || crypto.randomUUID();
    this.profiles.set(userId, profile);
    this.outcomeHistory.delete(userId);
    oracleCacheService.deleteByPrefix(`profile:${userId}`);
    oracleCacheService.deleteByPrefix(`adjustment:${userId}`);
  }

  /**
   * Get prior for a specific category and domain
   */
  async getPrior(
    userId: string,
    category: PredictionAccuracyCategory,
    domain?: string
  ): Promise<BayesianPrior> {
    const profile = await this.getUserProfile(userId);

    if (domain && profile.domain_priors[domain]) {
      return profile.domain_priors[domain];
    }

    return profile.category_priors[category];
  }

  /**
   * Manually set a prior for a category or domain
   */
  async setPrior(
    userId: string,
    prior: BayesianPrior,
    options: { category?: PredictionAccuracyCategory; domain?: string }
  ): Promise<void> {
    const profile = await this.getUserProfile(userId);

    if (options.domain) {
      profile.domain_priors[options.domain] = prior;
    } else if (options.category) {
      profile.category_priors[options.category] = prior;
    }

    profile.last_updated = new Date().toISOString();
    oracleCacheService.deleteByPrefix(`profile:${userId}`);
  }
}

// Singleton instance
export const adaptiveConfidenceService = new AdaptiveConfidenceService();
