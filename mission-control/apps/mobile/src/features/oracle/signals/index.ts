/**
 * Signal Navigation and Impact Analysis Components
 * React Native UI components for ORACLE signal management
 */

// Signal Navigator - Main navigation hub with filtering and views
export { SignalNavigator } from './SignalNavigator';
export type {
  SignalNavigatorProps,
  ViewMode,
  SortOption,
  SortDirection,
  SignalFilter,
} from './SignalNavigator';

// Signal Graph - Interactive visual relationship graph
export { SignalGraph } from './SignalGraph';
export type {
  SignalGraphProps,
  GraphNode,
  GraphEdge,
  GraphCluster,
} from './SignalGraph';

// Impact Breakdown - Multi-dimensional impact visualization
export { ImpactBreakdown } from './ImpactBreakdown';
export type {
  ImpactBreakdownProps,
  ImpactAnalysis,
  DimensionalScore,
  RippleEffect,
  StakeholderImpact,
  ScenarioOutcome,
} from './ImpactBreakdown';

// Signal Timeline - Horizontal timeline visualization
export { SignalTimeline } from './SignalTimeline';
export type {
  SignalTimelineProps,
  TimelineSignal,
  TimelineMilestone,
  DeadlineMarker,
  DensityPeriod,
} from './SignalTimeline';

// Signal Details - Comprehensive signal information view
export { SignalDetails } from './SignalDetails';
export type {
  SignalDetailsProps,
  SignalAction,
  SignalNote,
  RelatedSignal,
  ImpactSummary,
} from './SignalDetails';

// Signal Filters - Advanced filtering with presets
export { SignalFilters } from './SignalFilters';
export type {
  SignalFiltersProps,
  FilterPreset,
  SignalFilterCriteria,
  CustomFilterRule,
  ParsedNLQuery,
} from './SignalFilters';
