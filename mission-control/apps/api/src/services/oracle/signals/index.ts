/**
 * Signal Navigation and Impact Analysis Services
 * Central export for all signal-related analysis capabilities
 */

// Signal Graph - Relationship mapping and dependency analysis
export {
  signalGraphService,
  SignalGraphService,
  type SignalNode,
  type SignalEdge,
  type CausalChain,
  type SignalClusterResult,
  type TimelineCorrelation,
  type SignalGraphResult,
} from './signalGraph';

// Impact Analysis - Multi-dimensional impact breakdown
export {
  impactAnalysisService,
  ImpactAnalysisService,
  type ImpactDimension,
  type DimensionalScore,
  type RippleEffect,
  type StakeholderImpact,
  type ResourceImpact,
  type ConfidenceInterval,
  type ScenarioOutcome,
  type ImpactAnalysisResult,
  type DimensionWeights,
  type ImpactContext,
} from './impactAnalysis';

// Signal Prioritization - Advanced prioritization algorithms
export {
  signalPrioritizationService,
  SignalPrioritizationService,
  type EisenhowerQuadrant,
  type MoSCoWCategory,
  type EisenhowerPlacement,
  type MoSCoWPlacement,
  type WSJFScore,
  type CustomPriorityFormula,
  type PrioritizedSignal,
  type PrioritizationContext,
  type RePrioritizationResult,
} from './signalPrioritization';

// Signal Timeline - Temporal analysis and trend detection
export {
  signalTimelineService,
  SignalTimelineService,
  type SignalSnapshot,
  type SignalEvolution,
  type DeadlineAlert,
  type HistoricalPattern,
  type UrgencyTrend,
  type PredictedSignal,
  type TimelineView,
  type TimelineAnalysisResult,
} from './signalTimeline';

// Signal Aggregation - Smart grouping and rollups
export {
  signalAggregationService,
  SignalAggregationService,
  type GroupingDimension,
  type SignalGroup,
  type RollupSummary,
  type GroupHealthScore,
  type CrossGroupDependency,
  type AggregationResult,
  type GroupingConfig,
  type MultiDimensionGroup,
} from './signalAggregation';
