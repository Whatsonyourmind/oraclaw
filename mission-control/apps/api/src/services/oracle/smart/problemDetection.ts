/**
 * ORACLE Problem Detection Service
 * Story smart-1 - Automatic Problem Detection Engine
 *
 * Implements:
 * - Isolation Forest for anomaly detection
 * - Pattern recognition for recurring issues
 * - Early warning threshold system
 * - Problem severity classifier (critical, high, medium, low)
 * - Explanation generation
 *
 * Time Complexity:
 * - Isolation Forest: O(n * t * log(s)) where n=samples, t=trees, s=subsample size
 * - Pattern recognition: O(n * p) where p=patterns
 */

import { oracleCacheService, cacheKey, hashObject } from '../cache';

// ============================================================================
// Types
// ============================================================================

export type ProblemType =
  | 'schedule_overrun'
  | 'resource_conflict'
  | 'communication_gap'
  | 'workload_imbalance'
  | 'deadline_risk'
  | 'budget_anomaly'
  | 'quality_degradation'
  | 'dependency_block';

export type ProblemSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface DetectedProblem {
  id: string;
  type: ProblemType;
  severity: ProblemSeverity;
  confidence: number;
  description: string;
  affectedEntities: string[];
  suggestedActions: string[];
  detectedAt: Date;
  anomalyScore?: number;
  patternMatch?: string;
  earlyWarning?: boolean;
  explanation: string;
  metadata: Record<string, any>;
}

export interface DataPoint {
  id: string;
  timestamp: Date;
  features: number[];
  labels: Record<string, any>;
  entityId?: string;
  entityType?: string;
}

export interface IsolationForestConfig {
  numTrees: number;
  sampleSize: number;
  maxDepth?: number;
  contamination?: number;
}

export interface ProblemPattern {
  id: string;
  name: string;
  type: ProblemType;
  featureRanges: Array<{
    featureIndex: number;
    min: number;
    max: number;
  }>;
  frequencyThreshold: number;
  timeWindowHours: number;
  severity: ProblemSeverity;
  description: string;
  suggestedActions: string[];
}

export interface ThresholdConfig {
  metric: string;
  warningLevel: number;
  criticalLevel: number;
  direction: 'above' | 'below' | 'deviation';
}

export interface DetectionResult {
  problems: DetectedProblem[];
  anomalyScores: Map<string, number>;
  patternMatches: Array<{
    patternId: string;
    matchCount: number;
    instances: DataPoint[];
  }>;
  thresholdBreaches: Array<{
    metric: string;
    value: number;
    threshold: number;
    level: 'warning' | 'critical';
  }>;
  scanDuration: number;
}

// Cache TTLs
const CACHE_TTL = {
  detection: 5 * 60 * 1000, // 5 minutes
  patterns: 30 * 60 * 1000, // 30 minutes
  forest: 60 * 60 * 1000, // 1 hour
};

// ============================================================================
// Isolation Forest Implementation
// ============================================================================

/**
 * Isolation Tree Node
 */
interface IsolationTreeNode {
  isLeaf: boolean;
  depth: number;
  splitFeature?: number;
  splitValue?: number;
  left?: IsolationTreeNode;
  right?: IsolationTreeNode;
  size?: number;
}

/**
 * Isolation Forest for Anomaly Detection
 * O(n * t * log(s)) construction, O(t * log(s)) prediction
 */
class IsolationForest {
  private trees: IsolationTreeNode[] = [];
  private config: IsolationForestConfig;
  private numFeatures: number = 0;

  constructor(config: Partial<IsolationForestConfig> = {}) {
    this.config = {
      numTrees: config.numTrees || 100,
      sampleSize: config.sampleSize || 256,
      maxDepth: config.maxDepth,
      contamination: config.contamination || 0.1,
    };
  }

  /**
   * Fit the Isolation Forest to data
   * O(n * t * log(s)) where n=samples, t=trees, s=subsample size
   */
  fit(data: number[][]): void {
    if (data.length === 0) return;

    this.numFeatures = data[0].length;
    this.trees = [];

    const maxDepth = this.config.maxDepth || Math.ceil(Math.log2(this.config.sampleSize));

    for (let i = 0; i < this.config.numTrees; i++) {
      // Subsample without replacement
      const subsample = this.subsample(data, Math.min(this.config.sampleSize, data.length));
      const tree = this.buildTree(subsample, 0, maxDepth);
      this.trees.push(tree);
    }
  }

  /**
   * Predict anomaly scores for data points
   * Score closer to 1 = more anomalous
   * O(n * t * log(s))
   */
  predict(data: number[][]): number[] {
    if (this.trees.length === 0) {
      return data.map(() => 0.5);
    }

    const avgPathLength = this.averagePathLength(this.config.sampleSize);

    return data.map((point) => {
      const pathLengths = this.trees.map((tree) => this.pathLength(point, tree, 0));
      const avgPath = pathLengths.reduce((a, b) => a + b, 0) / pathLengths.length;

      // Anomaly score formula: s = 2^(-E(h(x))/c(n))
      const score = Math.pow(2, -avgPath / avgPathLength);
      return score;
    });
  }

  /**
   * Get anomaly decision based on contamination threshold
   */
  predictAnomalies(data: number[][], threshold?: number): boolean[] {
    const scores = this.predict(data);
    const thresh = threshold || this.calculateThreshold(scores);
    return scores.map((score) => score > thresh);
  }

  /**
   * Build an isolation tree recursively
   * O(n * log(n)) for a single tree
   */
  private buildTree(data: number[][], depth: number, maxDepth: number): IsolationTreeNode {
    if (depth >= maxDepth || data.length <= 1) {
      return {
        isLeaf: true,
        depth,
        size: data.length,
      };
    }

    // Random feature selection
    const splitFeature = Math.floor(Math.random() * this.numFeatures);

    // Get min/max for selected feature
    const featureValues = data.map((point) => point[splitFeature]);
    const minVal = Math.min(...featureValues);
    const maxVal = Math.max(...featureValues);

    if (minVal === maxVal) {
      return {
        isLeaf: true,
        depth,
        size: data.length,
      };
    }

    // Random split value between min and max
    const splitValue = minVal + Math.random() * (maxVal - minVal);

    // Partition data
    const leftData = data.filter((point) => point[splitFeature] < splitValue);
    const rightData = data.filter((point) => point[splitFeature] >= splitValue);

    return {
      isLeaf: false,
      depth,
      splitFeature,
      splitValue,
      left: this.buildTree(leftData, depth + 1, maxDepth),
      right: this.buildTree(rightData, depth + 1, maxDepth),
    };
  }

  /**
   * Calculate path length for a point in a tree
   * O(log(n))
   */
  private pathLength(point: number[], node: IsolationTreeNode, currentDepth: number): number {
    if (node.isLeaf) {
      return currentDepth + this.averagePathLength(node.size || 1);
    }

    if (point[node.splitFeature!] < node.splitValue!) {
      return this.pathLength(point, node.left!, currentDepth + 1);
    } else {
      return this.pathLength(point, node.right!, currentDepth + 1);
    }
  }

  /**
   * Calculate average path length for n samples (adjustment for BST)
   * c(n) = 2H(n-1) - 2(n-1)/n where H is harmonic number
   */
  private averagePathLength(n: number): number {
    if (n <= 1) return 0;
    if (n === 2) return 1;

    // H(n) approximation using Euler-Mascheroni constant
    const H = Math.log(n - 1) + 0.5772156649;
    return 2 * H - (2 * (n - 1)) / n;
  }

  /**
   * Random subsample without replacement
   * O(min(k, n)) using Fisher-Yates partial shuffle
   */
  private subsample(data: number[][], k: number): number[][] {
    const n = data.length;
    if (k >= n) return [...data];

    const result: number[][] = [];
    const indices = Array.from({ length: n }, (_, i) => i);

    for (let i = 0; i < k; i++) {
      const j = i + Math.floor(Math.random() * (n - i));
      [indices[i], indices[j]] = [indices[j], indices[i]];
      result.push(data[indices[i]]);
    }

    return result;
  }

  /**
   * Calculate threshold based on contamination rate
   */
  private calculateThreshold(scores: number[]): number {
    const sorted = [...scores].sort((a, b) => b - a);
    const index = Math.floor(scores.length * this.config.contamination!);
    return sorted[Math.min(index, sorted.length - 1)];
  }
}

// ============================================================================
// Problem Detection Service
// ============================================================================

export class ProblemDetectionService {
  private isolationForest: IsolationForest | null = null;
  private patterns: ProblemPattern[] = [];
  private thresholds: ThresholdConfig[] = [];
  private historicalData: DataPoint[] = [];
  private detectedProblems: Map<string, DetectedProblem> = new Map();

  // Default problem patterns
  private defaultPatterns: ProblemPattern[] = [
    {
      id: 'schedule-overrun-pattern',
      name: 'Schedule Overrun',
      type: 'schedule_overrun',
      featureRanges: [
        { featureIndex: 0, min: 1.2, max: Infinity }, // completionRatio > 1.2
      ],
      frequencyThreshold: 3,
      timeWindowHours: 168, // 1 week
      severity: 'high',
      description: 'Tasks are consistently taking longer than estimated',
      suggestedActions: [
        'Review estimation accuracy',
        'Identify bottlenecks in workflow',
        'Consider breaking down large tasks',
      ],
    },
    {
      id: 'resource-conflict-pattern',
      name: 'Resource Conflict',
      type: 'resource_conflict',
      featureRanges: [
        { featureIndex: 1, min: 0.9, max: Infinity }, // utilizationRate > 0.9
        { featureIndex: 2, min: 2, max: Infinity }, // concurrentTasks > 2
      ],
      frequencyThreshold: 2,
      timeWindowHours: 24,
      severity: 'critical',
      description: 'Resources are over-allocated with conflicting assignments',
      suggestedActions: [
        'Redistribute tasks among team members',
        'Defer non-critical tasks',
        'Request additional resources',
      ],
    },
    {
      id: 'communication-gap-pattern',
      name: 'Communication Gap',
      type: 'communication_gap',
      featureRanges: [
        { featureIndex: 3, min: -Infinity, max: 0.3 }, // communicationScore < 0.3
      ],
      frequencyThreshold: 5,
      timeWindowHours: 168,
      severity: 'medium',
      description: 'Low team communication detected',
      suggestedActions: [
        'Schedule sync meetings',
        'Implement daily standups',
        'Set up async communication channels',
      ],
    },
    {
      id: 'workload-imbalance-pattern',
      name: 'Workload Imbalance',
      type: 'workload_imbalance',
      featureRanges: [
        { featureIndex: 4, min: 2.0, max: Infinity }, // workloadVariance > 2.0
      ],
      frequencyThreshold: 3,
      timeWindowHours: 168,
      severity: 'high',
      description: 'Significant workload disparity among team members',
      suggestedActions: [
        'Redistribute tasks more evenly',
        'Identify and address skill gaps',
        'Consider workload limits per person',
      ],
    },
  ];

  // Default thresholds
  private defaultThresholds: ThresholdConfig[] = [
    { metric: 'taskCompletionRate', warningLevel: 0.7, criticalLevel: 0.5, direction: 'below' },
    { metric: 'bugRate', warningLevel: 0.1, criticalLevel: 0.2, direction: 'above' },
    { metric: 'teamVelocity', warningLevel: 0.8, criticalLevel: 0.6, direction: 'below' },
    { metric: 'meetingOverhead', warningLevel: 0.3, criticalLevel: 0.5, direction: 'above' },
    { metric: 'estimationAccuracy', warningLevel: 0.7, criticalLevel: 0.5, direction: 'below' },
  ];

  constructor() {
    this.patterns = [...this.defaultPatterns];
    this.thresholds = [...this.defaultThresholds];
  }

  // ============================================================================
  // Main Detection API
  // ============================================================================

  /**
   * Run comprehensive problem detection
   * Combines Isolation Forest, pattern matching, and threshold checks
   */
  async detectProblems(
    userId: string,
    data: DataPoint[],
    options: {
      useCache?: boolean;
      includeAnomalyDetection?: boolean;
      includePatternMatching?: boolean;
      includeThresholdChecks?: boolean;
      customPatterns?: ProblemPattern[];
      customThresholds?: ThresholdConfig[];
    } = {}
  ): Promise<DetectionResult> {
    const startTime = Date.now();

    // Check cache
    if (options.useCache !== false) {
      const cacheKeyStr = cacheKey('detection', userId, hashObject({ dataHash: data.length }));
      const cached = oracleCacheService.get<DetectionResult>(cacheKeyStr);
      if (cached) {
        return cached;
      }
    }

    const problems: DetectedProblem[] = [];
    const anomalyScores = new Map<string, number>();
    const patternMatches: Array<{
      patternId: string;
      matchCount: number;
      instances: DataPoint[];
    }> = [];
    const thresholdBreaches: Array<{
      metric: string;
      value: number;
      threshold: number;
      level: 'warning' | 'critical';
    }> = [];

    // Store historical data for pattern learning
    this.historicalData = [...this.historicalData, ...data].slice(-10000);

    // 1. Isolation Forest Anomaly Detection
    if (options.includeAnomalyDetection !== false && data.length > 0) {
      const anomalyResults = await this.runAnomalyDetection(data);
      anomalyResults.forEach((result) => {
        anomalyScores.set(result.id, result.score);
        if (result.isAnomaly) {
          problems.push(this.createAnomalyProblem(result.dataPoint, result.score));
        }
      });
    }

    // 2. Pattern Matching
    if (options.includePatternMatching !== false) {
      const patterns = options.customPatterns || this.patterns;
      const matches = this.matchPatterns(data, patterns);
      patternMatches.push(...matches);

      matches.forEach((match) => {
        if (match.matchCount >= this.getPatternThreshold(match.patternId)) {
          const pattern = patterns.find((p) => p.id === match.patternId);
          if (pattern) {
            problems.push(this.createPatternProblem(pattern, match));
          }
        }
      });
    }

    // 3. Threshold Checks
    if (options.includeThresholdChecks !== false) {
      const thresholds = options.customThresholds || this.thresholds;
      const metrics = this.extractMetrics(data);
      const breaches = this.checkThresholds(metrics, thresholds);
      thresholdBreaches.push(...breaches);

      breaches.forEach((breach) => {
        problems.push(this.createThresholdProblem(breach));
      });
    }

    // Deduplicate and rank problems
    const uniqueProblems = this.deduplicateProblems(problems);
    const rankedProblems = this.rankProblems(uniqueProblems);

    const result: DetectionResult = {
      problems: rankedProblems,
      anomalyScores,
      patternMatches,
      thresholdBreaches,
      scanDuration: Date.now() - startTime,
    };

    // Cache result
    const cacheKeyStr = cacheKey('detection', userId, hashObject({ dataHash: data.length }));
    oracleCacheService.set(cacheKeyStr, result, CACHE_TTL.detection);

    return result;
  }

  // ============================================================================
  // Anomaly Detection
  // ============================================================================

  /**
   * Run Isolation Forest anomaly detection
   */
  private async runAnomalyDetection(
    data: DataPoint[]
  ): Promise<Array<{
    id: string;
    score: number;
    isAnomaly: boolean;
    dataPoint: DataPoint;
  }>> {
    if (data.length < 10) {
      // Not enough data for meaningful anomaly detection
      return [];
    }

    // Extract feature matrix
    const featureMatrix = data.map((dp) => dp.features);

    // Train or use existing forest
    if (!this.isolationForest || this.historicalData.length % 1000 === 0) {
      this.isolationForest = new IsolationForest({
        numTrees: 100,
        sampleSize: Math.min(256, data.length),
        contamination: 0.1,
      });
      this.isolationForest.fit(featureMatrix);
    }

    // Predict anomaly scores
    const scores = this.isolationForest.predict(featureMatrix);
    const anomalies = this.isolationForest.predictAnomalies(featureMatrix);

    return data.map((dp, i) => ({
      id: dp.id,
      score: scores[i],
      isAnomaly: anomalies[i],
      dataPoint: dp,
    }));
  }

  /**
   * Create a problem from an anomaly detection
   */
  private createAnomalyProblem(dataPoint: DataPoint, score: number): DetectedProblem {
    const severity = this.scoreToseverity(score);
    const type = this.inferProblemType(dataPoint);

    return {
      id: `anomaly-${dataPoint.id}-${Date.now()}`,
      type,
      severity,
      confidence: score,
      description: this.generateAnomalyDescription(dataPoint, type),
      affectedEntities: dataPoint.entityId ? [dataPoint.entityId] : [],
      suggestedActions: this.getSuggestedActions(type),
      detectedAt: new Date(),
      anomalyScore: score,
      earlyWarning: score > 0.6 && score < 0.8,
      explanation: this.generateAnomalyExplanation(dataPoint, score),
      metadata: {
        features: dataPoint.features,
        labels: dataPoint.labels,
      },
    };
  }

  // ============================================================================
  // Pattern Matching
  // ============================================================================

  /**
   * Match data points against problem patterns
   * O(n * p) where n=data points, p=patterns
   */
  private matchPatterns(
    data: DataPoint[],
    patterns: ProblemPattern[]
  ): Array<{
    patternId: string;
    matchCount: number;
    instances: DataPoint[];
  }> {
    const results: Array<{
      patternId: string;
      matchCount: number;
      instances: DataPoint[];
    }> = [];

    for (const pattern of patterns) {
      const cutoffTime = new Date(
        Date.now() - pattern.timeWindowHours * 60 * 60 * 1000
      );

      const matchingInstances = data.filter((dp) => {
        // Check time window
        if (dp.timestamp < cutoffTime) return false;

        // Check all feature ranges
        return pattern.featureRanges.every((range) => {
          const featureValue = dp.features[range.featureIndex];
          return featureValue >= range.min && featureValue <= range.max;
        });
      });

      if (matchingInstances.length > 0) {
        results.push({
          patternId: pattern.id,
          matchCount: matchingInstances.length,
          instances: matchingInstances,
        });
      }
    }

    return results;
  }

  /**
   * Create a problem from a pattern match
   */
  private createPatternProblem(
    pattern: ProblemPattern,
    match: { patternId: string; matchCount: number; instances: DataPoint[] }
  ): DetectedProblem {
    const affectedEntities = [
      ...new Set(
        match.instances
          .filter((dp) => dp.entityId)
          .map((dp) => dp.entityId!)
      ),
    ];

    return {
      id: `pattern-${pattern.id}-${Date.now()}`,
      type: pattern.type,
      severity: pattern.severity,
      confidence: Math.min(1, match.matchCount / (pattern.frequencyThreshold * 2)),
      description: pattern.description,
      affectedEntities,
      suggestedActions: pattern.suggestedActions,
      detectedAt: new Date(),
      patternMatch: pattern.name,
      earlyWarning: match.matchCount >= pattern.frequencyThreshold * 0.7,
      explanation: this.generatePatternExplanation(pattern, match),
      metadata: {
        matchCount: match.matchCount,
        threshold: pattern.frequencyThreshold,
        timeWindow: pattern.timeWindowHours,
      },
    };
  }

  private getPatternThreshold(patternId: string): number {
    const pattern = this.patterns.find((p) => p.id === patternId);
    return pattern?.frequencyThreshold || 3;
  }

  // ============================================================================
  // Threshold Checks
  // ============================================================================

  /**
   * Extract metrics from data points
   */
  private extractMetrics(data: DataPoint[]): Record<string, number> {
    if (data.length === 0) return {};

    const metrics: Record<string, number[]> = {};

    // Aggregate metrics from labels
    data.forEach((dp) => {
      Object.entries(dp.labels).forEach(([key, value]) => {
        if (typeof value === 'number') {
          if (!metrics[key]) metrics[key] = [];
          metrics[key].push(value);
        }
      });
    });

    // Calculate averages
    const result: Record<string, number> = {};
    Object.entries(metrics).forEach(([key, values]) => {
      result[key] = values.reduce((a, b) => a + b, 0) / values.length;
    });

    return result;
  }

  /**
   * Check metrics against thresholds
   */
  private checkThresholds(
    metrics: Record<string, number>,
    thresholds: ThresholdConfig[]
  ): Array<{
    metric: string;
    value: number;
    threshold: number;
    level: 'warning' | 'critical';
  }> {
    const breaches: Array<{
      metric: string;
      value: number;
      threshold: number;
      level: 'warning' | 'critical';
    }> = [];

    for (const threshold of thresholds) {
      const value = metrics[threshold.metric];
      if (value === undefined) continue;

      let breached = false;
      let level: 'warning' | 'critical' = 'warning';
      let thresholdValue = threshold.warningLevel;

      switch (threshold.direction) {
        case 'above':
          if (value >= threshold.criticalLevel) {
            breached = true;
            level = 'critical';
            thresholdValue = threshold.criticalLevel;
          } else if (value >= threshold.warningLevel) {
            breached = true;
            level = 'warning';
            thresholdValue = threshold.warningLevel;
          }
          break;

        case 'below':
          if (value <= threshold.criticalLevel) {
            breached = true;
            level = 'critical';
            thresholdValue = threshold.criticalLevel;
          } else if (value <= threshold.warningLevel) {
            breached = true;
            level = 'warning';
            thresholdValue = threshold.warningLevel;
          }
          break;

        case 'deviation':
          // For deviation, levels are absolute differences from 1.0 (normal)
          const deviation = Math.abs(value - 1.0);
          if (deviation >= threshold.criticalLevel) {
            breached = true;
            level = 'critical';
            thresholdValue = threshold.criticalLevel;
          } else if (deviation >= threshold.warningLevel) {
            breached = true;
            level = 'warning';
            thresholdValue = threshold.warningLevel;
          }
          break;
      }

      if (breached) {
        breaches.push({
          metric: threshold.metric,
          value,
          threshold: thresholdValue,
          level,
        });
      }
    }

    return breaches;
  }

  /**
   * Create a problem from a threshold breach
   */
  private createThresholdProblem(breach: {
    metric: string;
    value: number;
    threshold: number;
    level: 'warning' | 'critical';
  }): DetectedProblem {
    const type = this.metricToProblemType(breach.metric);
    const severity = breach.level === 'critical' ? 'critical' : 'high';

    return {
      id: `threshold-${breach.metric}-${Date.now()}`,
      type,
      severity,
      confidence: breach.level === 'critical' ? 0.95 : 0.75,
      description: `${breach.metric} has ${breach.level === 'critical' ? 'critically' : ''} exceeded threshold`,
      affectedEntities: [],
      suggestedActions: this.getSuggestedActions(type),
      detectedAt: new Date(),
      earlyWarning: breach.level === 'warning',
      explanation: this.generateThresholdExplanation(breach),
      metadata: {
        metric: breach.metric,
        value: breach.value,
        threshold: breach.threshold,
        level: breach.level,
      },
    };
  }

  // ============================================================================
  // Explanation Generation
  // ============================================================================

  /**
   * Generate explanation for an anomaly
   */
  private generateAnomalyExplanation(dataPoint: DataPoint, score: number): string {
    const parts: string[] = [];

    parts.push(
      `This data point scored ${(score * 100).toFixed(1)}% on the anomaly scale.`
    );

    // Analyze which features contributed most to anomaly
    const avgFeatures = this.calculateAverageFeatures();
    if (avgFeatures.length > 0) {
      const deviations = dataPoint.features.map((f, i) => ({
        index: i,
        deviation: Math.abs(f - avgFeatures[i]) / (avgFeatures[i] || 1),
      }));

      deviations.sort((a, b) => b.deviation - a.deviation);

      if (deviations[0].deviation > 0.5) {
        parts.push(
          `Feature ${deviations[0].index} shows ${(deviations[0].deviation * 100).toFixed(0)}% deviation from normal.`
        );
      }
    }

    if (score > 0.8) {
      parts.push('This is a significant anomaly requiring immediate attention.');
    } else if (score > 0.6) {
      parts.push('This is a moderate anomaly that should be investigated.');
    }

    return parts.join(' ');
  }

  /**
   * Generate explanation for a pattern match
   */
  private generatePatternExplanation(
    pattern: ProblemPattern,
    match: { matchCount: number; instances: DataPoint[] }
  ): string {
    const parts: string[] = [];

    parts.push(
      `The "${pattern.name}" pattern has been detected ${match.matchCount} times ` +
      `in the last ${pattern.timeWindowHours} hours.`
    );

    if (match.matchCount >= pattern.frequencyThreshold * 2) {
      parts.push('This is significantly above the threshold and indicates a recurring issue.');
    }

    // Add temporal analysis
    if (match.instances.length > 1) {
      const timestamps = match.instances.map((i) => i.timestamp.getTime());
      const avgInterval =
        (Math.max(...timestamps) - Math.min(...timestamps)) /
        (timestamps.length - 1);
      const avgIntervalHours = avgInterval / (1000 * 60 * 60);

      if (avgIntervalHours < 24) {
        parts.push(`Occurrences are approximately ${avgIntervalHours.toFixed(1)} hours apart.`);
      }
    }

    return parts.join(' ');
  }

  /**
   * Generate explanation for a threshold breach
   */
  private generateThresholdExplanation(breach: {
    metric: string;
    value: number;
    threshold: number;
    level: 'warning' | 'critical';
  }): string {
    const deviation = ((breach.value - breach.threshold) / breach.threshold) * 100;
    const direction = deviation > 0 ? 'above' : 'below';

    return (
      `${breach.metric} is currently at ${breach.value.toFixed(2)}, which is ` +
      `${Math.abs(deviation).toFixed(1)}% ${direction} the ${breach.level} threshold ` +
      `of ${breach.threshold.toFixed(2)}. ${breach.level === 'critical'
        ? 'Immediate action is recommended.'
        : 'This should be monitored closely.'
      }`
    );
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Convert anomaly score to severity
   */
  private scoreToseverity(score: number): ProblemSeverity {
    if (score >= 0.9) return 'critical';
    if (score >= 0.75) return 'high';
    if (score >= 0.6) return 'medium';
    return 'low';
  }

  /**
   * Infer problem type from data point
   */
  private inferProblemType(dataPoint: DataPoint): ProblemType {
    const labels = dataPoint.labels;

    if (labels.taskDelay || labels.scheduleSlip) return 'schedule_overrun';
    if (labels.resourceConflict || labels.overallocation) return 'resource_conflict';
    if (labels.communicationScore !== undefined && labels.communicationScore < 0.5)
      return 'communication_gap';
    if (labels.workloadVariance) return 'workload_imbalance';
    if (labels.deadlineRisk) return 'deadline_risk';
    if (labels.budgetVariance) return 'budget_anomaly';
    if (labels.qualityScore !== undefined && labels.qualityScore < 0.5)
      return 'quality_degradation';
    if (labels.blockedBy) return 'dependency_block';

    return 'schedule_overrun'; // default
  }

  /**
   * Convert metric name to problem type
   */
  private metricToProblemType(metric: string): ProblemType {
    const mapping: Record<string, ProblemType> = {
      taskCompletionRate: 'schedule_overrun',
      bugRate: 'quality_degradation',
      teamVelocity: 'workload_imbalance',
      meetingOverhead: 'communication_gap',
      estimationAccuracy: 'schedule_overrun',
      resourceUtilization: 'resource_conflict',
      budgetVariance: 'budget_anomaly',
    };

    return mapping[metric] || 'schedule_overrun';
  }

  /**
   * Generate description for anomaly
   */
  private generateAnomalyDescription(dataPoint: DataPoint, type: ProblemType): string {
    const descriptions: Record<ProblemType, string> = {
      schedule_overrun: 'Anomalous schedule behavior detected - tasks may be overrunning',
      resource_conflict: 'Unusual resource utilization pattern detected',
      communication_gap: 'Communication pattern anomaly detected',
      workload_imbalance: 'Abnormal workload distribution detected',
      deadline_risk: 'Deadline risk pattern anomaly detected',
      budget_anomaly: 'Budget-related anomaly detected',
      quality_degradation: 'Quality metrics showing anomalous behavior',
      dependency_block: 'Dependency blocking pattern detected',
    };

    return descriptions[type] || 'Anomalous behavior detected';
  }

  /**
   * Get suggested actions for a problem type
   */
  private getSuggestedActions(type: ProblemType): string[] {
    const actions: Record<ProblemType, string[]> = {
      schedule_overrun: [
        'Review current task estimates',
        'Identify blockers causing delays',
        'Consider reprioritizing tasks',
        'Allocate additional resources if available',
      ],
      resource_conflict: [
        'Review resource assignments',
        'Resolve scheduling conflicts',
        'Consider task redistribution',
        'Set up resource booking system',
      ],
      communication_gap: [
        'Schedule team sync meeting',
        'Set up regular check-ins',
        'Review communication channels',
        'Implement status updates',
      ],
      workload_imbalance: [
        'Audit workload distribution',
        'Redistribute tasks evenly',
        'Consider capacity limits',
        'Review skill matching',
      ],
      deadline_risk: [
        'Assess deadline feasibility',
        'Identify critical path items',
        'Consider scope adjustment',
        'Communicate risks to stakeholders',
      ],
      budget_anomaly: [
        'Review budget allocation',
        'Identify cost overruns',
        'Implement cost controls',
        'Report to stakeholders',
      ],
      quality_degradation: [
        'Review quality metrics',
        'Implement code reviews',
        'Add automated testing',
        'Schedule technical debt review',
      ],
      dependency_block: [
        'Identify blocking dependencies',
        'Communicate with dependency owners',
        'Consider parallel work streams',
        'Escalate critical blockers',
      ],
    };

    return actions[type] || ['Review the situation', 'Consult with team'];
  }

  /**
   * Calculate average features from historical data
   */
  private calculateAverageFeatures(): number[] {
    if (this.historicalData.length === 0) return [];

    const numFeatures = this.historicalData[0]?.features.length || 0;
    const sums = new Array(numFeatures).fill(0);

    this.historicalData.forEach((dp) => {
      dp.features.forEach((f, i) => {
        sums[i] += f;
      });
    });

    return sums.map((sum) => sum / this.historicalData.length);
  }

  /**
   * Deduplicate problems by type and affected entities
   */
  private deduplicateProblems(problems: DetectedProblem[]): DetectedProblem[] {
    const seen = new Map<string, DetectedProblem>();

    problems.forEach((problem) => {
      const key = `${problem.type}-${problem.affectedEntities.sort().join(',')}`;

      if (!seen.has(key) || seen.get(key)!.confidence < problem.confidence) {
        seen.set(key, problem);
      }
    });

    return Array.from(seen.values());
  }

  /**
   * Rank problems by severity and confidence
   */
  private rankProblems(problems: DetectedProblem[]): DetectedProblem[] {
    const severityOrder: Record<ProblemSeverity, number> = {
      critical: 4,
      high: 3,
      medium: 2,
      low: 1,
    };

    return problems.sort((a, b) => {
      const severityDiff = severityOrder[b.severity] - severityOrder[a.severity];
      if (severityDiff !== 0) return severityDiff;
      return b.confidence - a.confidence;
    });
  }

  // ============================================================================
  // Configuration API
  // ============================================================================

  /**
   * Add a custom pattern
   */
  addPattern(pattern: ProblemPattern): void {
    this.patterns.push(pattern);
    oracleCacheService.deleteByPrefix('patterns:');
  }

  /**
   * Add a custom threshold
   */
  addThreshold(threshold: ThresholdConfig): void {
    this.thresholds.push(threshold);
  }

  /**
   * Get all registered patterns
   */
  getPatterns(): ProblemPattern[] {
    return [...this.patterns];
  }

  /**
   * Get all registered thresholds
   */
  getThresholds(): ThresholdConfig[] {
    return [...this.thresholds];
  }

  /**
   * Get a specific detected problem by ID
   */
  getProblem(id: string): DetectedProblem | undefined {
    return this.detectedProblems.get(id);
  }

  /**
   * Clear historical data
   */
  clearHistory(): void {
    this.historicalData = [];
    this.isolationForest = null;
    oracleCacheService.deleteByPrefix('detection:');
  }
}

// Singleton instance
export const problemDetectionService = new ProblemDetectionService();
