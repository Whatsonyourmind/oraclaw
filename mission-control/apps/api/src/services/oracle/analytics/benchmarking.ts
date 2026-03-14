/**
 * ORACLE Benchmarking System
 * Performance benchmarks, personal bests, and comparisons
 */

// Types
export interface Benchmark {
  id: string;
  metricId: string;
  metricName: string;
  category: BenchmarkCategory;
  currentValue: number;
  benchmarks: BenchmarkComparison[];
  trend: TrendInfo;
  rank?: RankInfo;
  lastUpdated: Date;
}

export type BenchmarkCategory =
  | 'productivity'
  | 'focus'
  | 'goals'
  | 'habits'
  | 'efficiency'
  | 'wellness';

export interface BenchmarkComparison {
  type: BenchmarkType;
  label: string;
  value: number;
  difference: number;
  differencePercent: number;
  status: 'above' | 'at' | 'below';
}

export type BenchmarkType =
  | 'personal_best'
  | 'personal_average'
  | 'goal_target'
  | 'previous_period'
  | 'industry_average'
  | 'team_average'
  | 'top_performers';

export interface TrendInfo {
  direction: 'improving' | 'stable' | 'declining';
  changePercent: number;
  periods: number;
}

export interface RankInfo {
  position: number;
  total: number;
  percentile: number;
  tier: 'top_10' | 'top_25' | 'top_50' | 'bottom_50';
}

export interface PersonalBest {
  id: string;
  userId: string;
  metricId: string;
  metricName: string;
  category: BenchmarkCategory;
  value: number;
  achievedAt: Date;
  previousBest?: number;
  improvementPercent?: number;
  context?: Record<string, any>;
  celebrated: boolean;
}

export interface GoalComparison {
  goalId: string;
  goalName: string;
  targetValue: number;
  actualValue: number;
  variance: number;
  variancePercent: number;
  status: 'exceeded' | 'met' | 'missed';
  timeline: ComparisonPoint[];
}

export interface ComparisonPoint {
  date: Date;
  target: number;
  actual: number;
  variance: number;
}

export interface IndustryBenchmark {
  metricId: string;
  metricName: string;
  industry: string;
  role?: string;
  sampleSize: number;
  percentiles: {
    p10: number;
    p25: number;
    p50: number;
    p75: number;
    p90: number;
  };
  lastUpdated: Date;
  source: string;
}

export interface TeamComparison {
  metricId: string;
  metricName: string;
  teamId: string;
  teamName: string;
  userValue: number;
  teamAverage: number;
  teamMedian: number;
  teamMin: number;
  teamMax: number;
  userRank: number;
  teamSize: number;
  anonymized: boolean;
}

export interface ImprovementSuggestion {
  id: string;
  metricId: string;
  metricName: string;
  currentValue: number;
  targetValue: number;
  gapPercent: number;
  suggestions: Suggestion[];
  estimatedTimeToAchieve: number; // Days
  difficulty: 'easy' | 'moderate' | 'challenging';
  priority: 'high' | 'medium' | 'low';
}

export interface Suggestion {
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  effort: 'low' | 'medium' | 'high';
  actionType: 'habit' | 'schedule' | 'tool' | 'mindset';
  resources?: string[];
}

// Historical metric data
export interface MetricHistory {
  metricId: string;
  userId: string;
  values: HistoricalValue[];
}

export interface HistoricalValue {
  date: Date;
  value: number;
  context?: Record<string, any>;
}

// Benchmarking Service
export class BenchmarkingService {
  private personalBests: Map<string, PersonalBest[]> = new Map();
  private industryBenchmarks: Map<string, IndustryBenchmark> = new Map();

  constructor() {
    // Initialize with sample industry benchmarks
    this.initializeIndustryBenchmarks();
  }

  /**
   * Calculate benchmarks for a metric
   */
  async calculateBenchmarks(
    userId: string,
    metricId: string,
    currentValue: number,
    history: MetricHistory,
    options: {
      includeIndustry?: boolean;
      includeTeam?: boolean;
      goalTarget?: number;
    } = {}
  ): Promise<Benchmark> {
    const benchmarks: BenchmarkComparison[] = [];

    // Personal best comparison
    const personalBest = await this.getPersonalBest(userId, metricId);
    if (personalBest) {
      benchmarks.push(this.createComparison(
        'personal_best',
        'Personal Best',
        personalBest.value,
        currentValue
      ));
    }

    // Personal average comparison
    const personalAverage = this.calculateAverage(history.values);
    benchmarks.push(this.createComparison(
      'personal_average',
      'Your Average',
      personalAverage,
      currentValue
    ));

    // Previous period comparison
    const previousPeriodValue = this.getPreviousPeriodValue(history.values);
    if (previousPeriodValue !== null) {
      benchmarks.push(this.createComparison(
        'previous_period',
        'Previous Period',
        previousPeriodValue,
        currentValue
      ));
    }

    // Goal target comparison
    if (options.goalTarget !== undefined) {
      benchmarks.push(this.createComparison(
        'goal_target',
        'Goal Target',
        options.goalTarget,
        currentValue
      ));
    }

    // Industry benchmark comparison
    if (options.includeIndustry) {
      const industry = this.industryBenchmarks.get(metricId);
      if (industry) {
        benchmarks.push(this.createComparison(
          'industry_average',
          'Industry Median',
          industry.percentiles.p50,
          currentValue
        ));

        benchmarks.push(this.createComparison(
          'top_performers',
          'Top 10%',
          industry.percentiles.p90,
          currentValue
        ));
      }
    }

    // Calculate trend
    const trend = this.calculateTrend(history.values);

    // Calculate rank (if industry benchmarks available)
    let rank: RankInfo | undefined;
    if (options.includeIndustry) {
      rank = this.calculateRank(metricId, currentValue);
    }

    return {
      id: `benchmark-${metricId}-${Date.now()}`,
      metricId,
      metricName: this.getMetricName(metricId),
      category: this.getMetricCategory(metricId),
      currentValue,
      benchmarks,
      trend,
      rank,
      lastUpdated: new Date(),
    };
  }

  /**
   * Track and update personal bests
   */
  async trackPersonalBest(
    userId: string,
    metricId: string,
    value: number,
    context?: Record<string, any>
  ): Promise<PersonalBest | null> {
    const key = `${userId}-${metricId}`;
    const currentBests = this.personalBests.get(key) ?? [];
    const existingBest = currentBests.find(b => b.metricId === metricId);

    // Check if this is a new personal best
    const isHigherBetter = this.isHigherBetter(metricId);
    const isNewBest = !existingBest ||
      (isHigherBetter ? value > existingBest.value : value < existingBest.value);

    if (isNewBest) {
      const newBest: PersonalBest = {
        id: `pb-${metricId}-${Date.now()}`,
        userId,
        metricId,
        metricName: this.getMetricName(metricId),
        category: this.getMetricCategory(metricId),
        value,
        achievedAt: new Date(),
        previousBest: existingBest?.value,
        improvementPercent: existingBest
          ? Math.abs((value - existingBest.value) / existingBest.value) * 100
          : undefined,
        context,
        celebrated: false,
      };

      // Update storage
      if (existingBest) {
        const index = currentBests.findIndex(b => b.metricId === metricId);
        currentBests[index] = newBest;
      } else {
        currentBests.push(newBest);
      }
      this.personalBests.set(key, currentBests);

      return newBest;
    }

    return null;
  }

  /**
   * Get personal best for a metric
   */
  async getPersonalBest(userId: string, metricId: string): Promise<PersonalBest | null> {
    const key = `${userId}-${metricId}`;
    const bests = this.personalBests.get(key) ?? [];
    return bests.find(b => b.metricId === metricId) ?? null;
  }

  /**
   * Get all personal bests for a user
   */
  async getAllPersonalBests(userId: string): Promise<PersonalBest[]> {
    const allBests: PersonalBest[] = [];

    this.personalBests.forEach((bests, key) => {
      if (key.startsWith(userId)) {
        allBests.push(...bests);
      }
    });

    return allBests.sort((a, b) => b.achievedAt.getTime() - a.achievedAt.getTime());
  }

  /**
   * Mark personal best as celebrated
   */
  async celebratePersonalBest(userId: string, bestId: string): Promise<void> {
    this.personalBests.forEach((bests, key) => {
      if (key.startsWith(userId)) {
        const best = bests.find(b => b.id === bestId);
        if (best) {
          best.celebrated = true;
        }
      }
    });
  }

  /**
   * Compare goals vs actual performance
   */
  async compareGoalVsActual(
    goalId: string,
    goalName: string,
    targetValue: number,
    actualValues: HistoricalValue[]
  ): Promise<GoalComparison> {
    const currentActual = actualValues.length > 0
      ? actualValues[actualValues.length - 1].value
      : 0;

    const variance = currentActual - targetValue;
    const variancePercent = targetValue !== 0
      ? (variance / targetValue) * 100
      : 0;

    const status: GoalComparison['status'] = variance > 0
      ? 'exceeded'
      : variance === 0
        ? 'met'
        : 'missed';

    // Build timeline
    const timeline: ComparisonPoint[] = actualValues.map((v, index) => {
      // Linear interpolation of target
      const progress = (index + 1) / actualValues.length;
      const targetAtPoint = targetValue * progress;

      return {
        date: v.date,
        target: targetAtPoint,
        actual: v.value,
        variance: v.value - targetAtPoint,
      };
    });

    return {
      goalId,
      goalName,
      targetValue,
      actualValue: currentActual,
      variance,
      variancePercent,
      status,
      timeline,
    };
  }

  /**
   * Get industry benchmarks for a metric
   */
  getIndustryBenchmark(metricId: string): IndustryBenchmark | null {
    return this.industryBenchmarks.get(metricId) ?? null;
  }

  /**
   * Compare user against team
   */
  async compareWithTeam(
    userId: string,
    metricId: string,
    userValue: number,
    teamValues: { userId: string; value: number }[]
  ): Promise<TeamComparison> {
    const values = teamValues.map(t => t.value);
    const sortedValues = [...values].sort((a, b) => b - a);

    const teamAverage = values.reduce((a, b) => a + b, 0) / values.length;
    const teamMedian = sortedValues[Math.floor(values.length / 2)];
    const teamMin = Math.min(...values);
    const teamMax = Math.max(...values);

    // Calculate user rank (1-indexed, higher is better by default)
    const isHigherBetter = this.isHigherBetter(metricId);
    const userRank = isHigherBetter
      ? sortedValues.findIndex(v => v <= userValue) + 1
      : sortedValues.reverse().findIndex(v => v >= userValue) + 1;

    return {
      metricId,
      metricName: this.getMetricName(metricId),
      teamId: 'team-1', // Would come from actual team data
      teamName: 'Your Team',
      userValue,
      teamAverage,
      teamMedian,
      teamMin,
      teamMax,
      userRank: userRank || values.length,
      teamSize: values.length,
      anonymized: true,
    };
  }

  /**
   * Generate improvement suggestions
   */
  async generateImprovementSuggestions(
    userId: string,
    benchmarks: Benchmark[]
  ): Promise<ImprovementSuggestion[]> {
    const suggestions: ImprovementSuggestion[] = [];

    for (const benchmark of benchmarks) {
      // Find gaps to close
      const gaps = benchmark.benchmarks.filter(b =>
        b.status === 'below' && ['personal_best', 'goal_target', 'industry_average'].includes(b.type)
      );

      if (gaps.length === 0) continue;

      // Prioritize by gap size
      const primaryGap = gaps.sort((a, b) => Math.abs(b.differencePercent) - Math.abs(a.differencePercent))[0];

      const metricSuggestions = this.getSuggestionsForMetric(
        benchmark.metricId,
        benchmark.currentValue,
        primaryGap.value
      );

      suggestions.push({
        id: `suggestion-${benchmark.metricId}-${Date.now()}`,
        metricId: benchmark.metricId,
        metricName: benchmark.metricName,
        currentValue: benchmark.currentValue,
        targetValue: primaryGap.value,
        gapPercent: Math.abs(primaryGap.differencePercent),
        suggestions: metricSuggestions,
        estimatedTimeToAchieve: this.estimateTimeToAchieve(
          benchmark.currentValue,
          primaryGap.value,
          benchmark.trend
        ),
        difficulty: this.assessDifficulty(primaryGap.differencePercent),
        priority: this.assessPriority(benchmark.category, primaryGap.differencePercent),
      });
    }

    return suggestions.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  /**
   * Get progress towards beating personal best
   */
  async getProgressToBest(
    userId: string,
    metricId: string,
    currentValue: number
  ): Promise<{
    personalBest: PersonalBest | null;
    progressPercent: number;
    remaining: number;
    onTrack: boolean;
    estimatedAchievement?: Date;
  }> {
    const personalBest = await this.getPersonalBest(userId, metricId);

    if (!personalBest) {
      return {
        personalBest: null,
        progressPercent: 100, // Current value IS the best
        remaining: 0,
        onTrack: true,
      };
    }

    const isHigherBetter = this.isHigherBetter(metricId);
    const gap = isHigherBetter
      ? personalBest.value - currentValue
      : currentValue - personalBest.value;

    const progressPercent = Math.max(0, Math.min(100,
      isHigherBetter
        ? (currentValue / personalBest.value) * 100
        : (personalBest.value / currentValue) * 100
    ));

    const onTrack = progressPercent >= 90;

    return {
      personalBest,
      progressPercent,
      remaining: Math.max(0, gap),
      onTrack,
      estimatedAchievement: onTrack ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : undefined,
    };
  }

  // Helper methods
  private createComparison(
    type: BenchmarkType,
    label: string,
    benchmarkValue: number,
    currentValue: number
  ): BenchmarkComparison {
    const difference = currentValue - benchmarkValue;
    const differencePercent = benchmarkValue !== 0
      ? (difference / benchmarkValue) * 100
      : 0;

    const isHigherBetter = true; // Simplified - would depend on metric
    const status: BenchmarkComparison['status'] = difference > 0
      ? (isHigherBetter ? 'above' : 'below')
      : difference < 0
        ? (isHigherBetter ? 'below' : 'above')
        : 'at';

    return {
      type,
      label,
      value: benchmarkValue,
      difference,
      differencePercent,
      status,
    };
  }

  private calculateAverage(values: HistoricalValue[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, v) => sum + v.value, 0) / values.length;
  }

  private getPreviousPeriodValue(values: HistoricalValue[]): number | null {
    if (values.length < 2) return null;

    // Get value from same period last week/month
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const previousValue = values.find(v => {
      const vDate = new Date(v.date);
      return vDate >= oneWeekAgo && vDate < now;
    });

    return previousValue?.value ?? values[values.length - 2]?.value ?? null;
  }

  private calculateTrend(values: HistoricalValue[]): TrendInfo {
    if (values.length < 2) {
      return { direction: 'stable', changePercent: 0, periods: 0 };
    }

    // Compare last 3 periods
    const recentValues = values.slice(-3);
    const oldValue = recentValues[0].value;
    const newValue = recentValues[recentValues.length - 1].value;

    const changePercent = oldValue !== 0
      ? ((newValue - oldValue) / oldValue) * 100
      : 0;

    let direction: TrendInfo['direction'] = 'stable';
    if (changePercent > 5) direction = 'improving';
    else if (changePercent < -5) direction = 'declining';

    return {
      direction,
      changePercent,
      periods: recentValues.length,
    };
  }

  private calculateRank(metricId: string, value: number): RankInfo | undefined {
    const industry = this.industryBenchmarks.get(metricId);
    if (!industry) return undefined;

    const { p10, p25, p50, p75, p90 } = industry.percentiles;

    let percentile: number;
    if (value >= p90) percentile = 95;
    else if (value >= p75) percentile = 75 + ((value - p75) / (p90 - p75)) * 15;
    else if (value >= p50) percentile = 50 + ((value - p50) / (p75 - p50)) * 25;
    else if (value >= p25) percentile = 25 + ((value - p25) / (p50 - p25)) * 25;
    else if (value >= p10) percentile = 10 + ((value - p10) / (p25 - p10)) * 15;
    else percentile = (value / p10) * 10;

    const tier: RankInfo['tier'] = percentile >= 90 ? 'top_10' :
      percentile >= 75 ? 'top_25' :
      percentile >= 50 ? 'top_50' : 'bottom_50';

    return {
      position: Math.round(industry.sampleSize * (1 - percentile / 100)),
      total: industry.sampleSize,
      percentile: Math.round(percentile),
      tier,
    };
  }

  private getSuggestionsForMetric(
    metricId: string,
    currentValue: number,
    targetValue: number
  ): Suggestion[] {
    const suggestions: Suggestion[] = [];

    // Generic suggestions based on metric type
    const metricSuggestions: Record<string, Suggestion[]> = {
      tasks_completed: [
        {
          title: 'Break down large tasks',
          description: 'Splitting complex tasks into smaller, actionable items can increase completion rates.',
          impact: 'high',
          effort: 'low',
          actionType: 'habit',
        },
        {
          title: 'Time block for deep work',
          description: 'Schedule 2-hour blocks for focused task completion.',
          impact: 'high',
          effort: 'medium',
          actionType: 'schedule',
        },
      ],
      focus_hours: [
        {
          title: 'Enable Do Not Disturb',
          description: 'Use scheduled DND modes during your peak productivity hours.',
          impact: 'high',
          effort: 'low',
          actionType: 'tool',
        },
        {
          title: 'Try the Pomodoro Technique',
          description: '25-minute focused sessions with 5-minute breaks can boost concentration.',
          impact: 'medium',
          effort: 'low',
          actionType: 'habit',
        },
      ],
      productivity_score: [
        {
          title: 'Identify your peak hours',
          description: 'Schedule important tasks during your most productive times.',
          impact: 'high',
          effort: 'medium',
          actionType: 'schedule',
        },
        {
          title: 'Reduce meeting overhead',
          description: 'Batch meetings together to preserve focus time blocks.',
          impact: 'medium',
          effort: 'medium',
          actionType: 'schedule',
        },
      ],
      deep_work_hours: [
        {
          title: 'Create a deep work ritual',
          description: 'Establish a pre-work routine to signal focus time to your brain.',
          impact: 'high',
          effort: 'medium',
          actionType: 'habit',
        },
        {
          title: 'Work in a dedicated space',
          description: 'Associate a specific location with focused work.',
          impact: 'medium',
          effort: 'low',
          actionType: 'mindset',
        },
      ],
    };

    const defaultSuggestions: Suggestion[] = [
      {
        title: 'Set specific improvement goals',
        description: 'Define clear, measurable targets for this metric.',
        impact: 'medium',
        effort: 'low',
        actionType: 'mindset',
      },
      {
        title: 'Track daily progress',
        description: 'Regular monitoring helps identify patterns and opportunities.',
        impact: 'medium',
        effort: 'low',
        actionType: 'habit',
      },
    ];

    return metricSuggestions[metricId] ?? defaultSuggestions;
  }

  private estimateTimeToAchieve(
    currentValue: number,
    targetValue: number,
    trend: TrendInfo
  ): number {
    if (trend.direction !== 'improving') {
      return 30; // Default 30 days if not improving
    }

    const gap = Math.abs(targetValue - currentValue);
    const dailyImprovement = Math.abs(trend.changePercent) / trend.periods / 7;

    if (dailyImprovement <= 0) return 30;

    return Math.ceil(gap / (currentValue * dailyImprovement / 100));
  }

  private assessDifficulty(gapPercent: number): ImprovementSuggestion['difficulty'] {
    const absGap = Math.abs(gapPercent);
    if (absGap <= 10) return 'easy';
    if (absGap <= 30) return 'moderate';
    return 'challenging';
  }

  private assessPriority(
    category: BenchmarkCategory,
    gapPercent: number
  ): ImprovementSuggestion['priority'] {
    const highPriorityCategories: BenchmarkCategory[] = ['productivity', 'goals', 'wellness'];

    if (highPriorityCategories.includes(category) && Math.abs(gapPercent) > 20) {
      return 'high';
    }
    if (Math.abs(gapPercent) > 30) {
      return 'high';
    }
    if (Math.abs(gapPercent) > 15) {
      return 'medium';
    }
    return 'low';
  }

  private isHigherBetter(metricId: string): boolean {
    // Metrics where lower is better
    const lowerIsBetter = [
      'context_switches',
      'meeting_hours',
      'overdue_tasks',
      'burnout_risk',
      'avg_completion_time',
    ];

    return !lowerIsBetter.includes(metricId);
  }

  private getMetricName(metricId: string): string {
    const names: Record<string, string> = {
      tasks_completed: 'Tasks Completed',
      focus_hours: 'Focus Hours',
      deep_work_hours: 'Deep Work Hours',
      productivity_score: 'Productivity Score',
      meeting_hours: 'Meeting Hours',
      context_switches: 'Context Switches',
      goal_progress: 'Goal Progress',
      habit_streak: 'Habit Streak',
      on_time_rate: 'On-Time Delivery Rate',
      burnout_risk: 'Burnout Risk Score',
    };

    return names[metricId] ?? metricId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  private getMetricCategory(metricId: string): BenchmarkCategory {
    const categories: Record<string, BenchmarkCategory> = {
      tasks_completed: 'productivity',
      focus_hours: 'focus',
      deep_work_hours: 'focus',
      productivity_score: 'productivity',
      meeting_hours: 'efficiency',
      context_switches: 'efficiency',
      goal_progress: 'goals',
      habit_streak: 'habits',
      on_time_rate: 'productivity',
      burnout_risk: 'wellness',
    };

    return categories[metricId] ?? 'productivity';
  }

  private initializeIndustryBenchmarks(): void {
    // Sample industry benchmarks (would come from actual data source)
    const benchmarks: IndustryBenchmark[] = [
      {
        metricId: 'tasks_completed',
        metricName: 'Weekly Tasks Completed',
        industry: 'Technology',
        sampleSize: 10000,
        percentiles: { p10: 8, p25: 15, p50: 25, p75: 40, p90: 60 },
        lastUpdated: new Date(),
        source: 'Productivity Research 2024',
      },
      {
        metricId: 'focus_hours',
        metricName: 'Daily Focus Hours',
        industry: 'Technology',
        sampleSize: 10000,
        percentiles: { p10: 1, p25: 2, p50: 3.5, p75: 5, p90: 6.5 },
        lastUpdated: new Date(),
        source: 'Deep Work Study 2024',
      },
      {
        metricId: 'deep_work_hours',
        metricName: 'Weekly Deep Work Hours',
        industry: 'Technology',
        sampleSize: 10000,
        percentiles: { p10: 4, p25: 8, p50: 15, p75: 22, p90: 30 },
        lastUpdated: new Date(),
        source: 'Cal Newport Research',
      },
      {
        metricId: 'productivity_score',
        metricName: 'Productivity Score',
        industry: 'General',
        sampleSize: 50000,
        percentiles: { p10: 40, p25: 55, p50: 70, p75: 82, p90: 92 },
        lastUpdated: new Date(),
        source: 'Productivity Index 2024',
      },
      {
        metricId: 'meeting_hours',
        metricName: 'Weekly Meeting Hours',
        industry: 'Technology',
        sampleSize: 10000,
        percentiles: { p10: 2, p25: 5, p50: 10, p75: 18, p90: 25 },
        lastUpdated: new Date(),
        source: 'Work Patterns Study 2024',
      },
      {
        metricId: 'on_time_rate',
        metricName: 'On-Time Delivery Rate',
        industry: 'Technology',
        sampleSize: 10000,
        percentiles: { p10: 60, p25: 72, p50: 82, p75: 90, p90: 96 },
        lastUpdated: new Date(),
        source: 'Project Management Study 2024',
      },
    ];

    benchmarks.forEach(b => {
      this.industryBenchmarks.set(b.metricId, b);
    });
  }
}

// Export singleton instance
export const benchmarkingService = new BenchmarkingService();

export default BenchmarkingService;
