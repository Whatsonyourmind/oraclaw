/**
 * ORACLE Analytics Services
 * Comprehensive analytics and insights for productivity optimization
 */

// Insights Engine
export {
  InsightsEngine,
  insightsEngine,
  PatternDetector,
  AnomalyDetector,
  TrendAnalyzer,
  OpportunityIdentifier,
  RiskWarningSystem,
  RecommendationEngine,
} from './insightsEngine';

export type {
  Insight,
  InsightType,
  InsightCategory,
  InsightAction,
  PatternDetectionConfig,
  AnomalyDetectionConfig,
  TrendAnalysisConfig,
  UserBehaviorData,
  MetricSnapshot,
} from './insightsEngine';

// Productivity Analytics
export {
  ProductivityAnalytics,
  productivityAnalytics,
} from './productivityAnalytics';

export type {
  ProductivityMetrics,
  DateRange,
  TaskCompletionMetrics,
  CompletionTimeMetrics,
  DeliveryRateMetrics,
  FocusMetrics,
  MeetingLoadMetrics,
  ContextSwitchMetrics,
  DeepWorkMetrics,
  TaskData,
  FocusSession,
  Meeting,
  ActivityEvent,
} from './productivityAnalytics';

// Prediction Engine
export {
  PredictionEngine,
  predictionEngine,
} from './predictionEngine';

export type {
  Prediction,
  PredictionType,
  PredictionFactor,
  PredictionTimeline,
  TimelineMilestone,
  WorkloadForecast,
  BurnoutRiskScore,
  GoalSuccessPrediction,
  TaskHistoryData,
  UserHistoricalMetrics,
  ScheduledEvent,
  GoalData,
} from './predictionEngine';

// Report Generator
export {
  ReportGenerator,
  reportGenerator,
  DEFAULT_TEMPLATES,
} from './reportGenerator';

export type {
  Report,
  ReportTemplate,
  ReportSection,
  ReportMetric,
  ReportConfig,
  ReportData,
  ReportSchedule,
  ScheduledReport,
  ShareableReport,
  ExportFormat,
  ExportResult,
  DateRangePreset,
} from './reportGenerator';

// Benchmarking
export {
  BenchmarkingService,
  benchmarkingService,
} from './benchmarking';

export type {
  Benchmark,
  BenchmarkCategory,
  BenchmarkComparison,
  BenchmarkType,
  PersonalBest,
  GoalComparison,
  IndustryBenchmark,
  TeamComparison,
  ImprovementSuggestion,
  MetricHistory,
} from './benchmarking';

// Data Visualization
export {
  DataVisualization,
  dataVisualization,
  COLOR_PALETTES,
} from './dataVisualization';

export type {
  ChartConfig,
  ChartType,
  ChartData,
  Dataset,
  DataPoint,
  ChartOptions,
  HeatmapCell,
  SankeyNode,
  SankeyLink,
  GaugeConfig,
  GaugeThreshold,
} from './dataVisualization';
