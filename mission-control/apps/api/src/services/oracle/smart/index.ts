/**
 * ORACLE Smart Features Module
 *
 * This module exports all smart feature services for the ORACLE system.
 *
 * Features:
 * - Problem Detection (smart-1): ML-based anomaly detection with Isolation Forest
 * - Root Cause Analysis (smart-2): Bayesian network inference for cause tracing
 * - Meeting Scheduler (smart-3): AI-powered optimal meeting scheduling
 * - Workload Balancer (smart-4): Team workload optimization and redistribution
 * - Deadline Risk (smart-5): Monte Carlo-based deadline prediction
 * - Conflict Resolver (smart-6): AHP-based priority conflict resolution
 */

// Problem Detection Service (smart-1)
export {
  ProblemDetectionService,
  problemDetectionService,
  type ProblemType,
  type ProblemSeverity,
  type DetectedProblem,
  type DataPoint,
  type IsolationForestConfig,
  type ProblemPattern,
  type ThresholdConfig,
  type DetectionResult,
} from './problemDetection';

// Root Cause Analysis Service (smart-2)
export {
  RootCauseAnalysisService,
  rootCauseAnalysisService,
  type CausalNode,
  type CausalEdge,
  type CausalGraph,
  type ContributingFactor,
  type FixSuggestion,
  type RootCauseAnalysis,
  type HistoricalEvent,
  type BayesianNode,
  type VerificationResult,
} from './rootCauseAnalysis';

// Smart Meeting Scheduler Service (smart-3)
export {
  SmartMeetingSchedulerService,
  smartMeetingSchedulerService,
  type TimeZoneInfo,
  type MeetingParticipant,
  type BusySlot,
  type FatigueMetrics,
  type MeetingPreferences,
  type ScoredMeetingSlot,
  type MeetingRequest,
  type SchedulingResult,
  type BookingConfirmation,
  type CalendarProvider,
} from './meetingScheduler';

// Workload Balancer Service (smart-4)
export {
  WorkloadBalancerService,
  workloadBalancerService,
  type Skill,
  type TeamMember,
  type Task,
  type WorkloadMetrics,
  type RedistributionSuggestion,
  type RedistributionPlan,
  type ImpactAnalysis,
  type TeamWorkloadSummary,
} from './workloadBalancer';

// Deadline Risk Predictor Service (smart-5)
export {
  DeadlineRiskPredictorService,
  deadlineRiskPredictorService,
  type ProgressDataPoint,
  type VelocityMetrics,
  type ExternalFactor,
  type DeadlineRisk,
  type RiskAlert,
  type MitigationSuggestion,
  type RiskPredictionResult,
  type ProjectRiskSummary,
  type TaskWithDeadline,
} from './deadlineRisk';

// Priority Conflict Resolver Service (smart-6)
export {
  PriorityConflictResolverService,
  priorityConflictResolverService,
  type PriorityCriterion,
  type ConflictingItem,
  type Stakeholder,
  type PairwiseComparison,
  type AHPResult,
  type PriorityScore,
  type TradeOff,
  type CompromiseSuggestion,
  type ConflictResolution,
  type DecisionRationale,
  type TradeOffVisualization,
} from './conflictResolver';
