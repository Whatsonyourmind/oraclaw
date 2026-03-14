/**
 * ORACLE Collaboration Services
 *
 * Comprehensive team collaboration features for the ORACLE system
 * including task delegation, signal sharing, team workspaces,
 * comments, notifications, and activity tracking.
 */

// Task Delegation
export {
  taskDelegationService,
  default as TaskDelegationService,
} from './taskDelegation';
export type {
  TeamMember,
  Skill,
  AvailabilityStatus,
  ScheduleBlock,
  DelegationPreferences,
  DelegatedTask,
  DelegationStatus,
  DelegationContext,
  Attachment,
  DelegationHistoryEntry,
  DelegationAction,
  DelegationMetrics,
  DelegationRequest,
  DelegationSuggestion,
  LoadBalanceSuggestion,
  TeamLoadDistribution,
  MemberLoad,
  ReassignmentSuggestion,
  DelegationAnalytics,
  DelegatorStats,
  DelegateeStats,
  SkillUtilization,
  Bottleneck,
  DelegationTrend,
} from './taskDelegation';

// Shared Signals
export {
  sharedSignalsService,
  default as SharedSignalsService,
} from './sharedSignals';
export type {
  SharedSignal,
  SharedRecipient,
  PermissionLevel,
  SignalPermission,
  ShareMetadata,
  ShareRequest,
  SharedFeed,
  SharedSignalWithContext,
  FeedFilters,
  TriageStatus,
  TriageAction,
  CollaborativeTriage,
  TriageParticipant,
  TriageVote,
  TriageComment,
  SignalAssignment,
  AssignmentHistoryEntry,
  BulkShareResult,
} from './sharedSignals';

// Team Workspace
export {
  teamWorkspaceService,
  default as TeamWorkspaceService,
} from './teamWorkspace';
export type {
  Team,
  TeamRole,
  MemberStatus,
  CapacityInfo,
  TeamSettings,
  NotificationDefaults,
  WorkingHours,
  DaySchedule,
  TeamDashboard,
  TeamSummary,
  TeamHealthScore,
  HealthAlert,
  ActivityEntry,
  Deadline,
  Goal,
  GoalStatus,
  KeyResult,
  GoalMetrics,
  GoalUpdate,
  Announcement,
  Reaction,
  MemberHighlight,
  CapacityView,
  MemberCapacityDetail,
  TaskAllocation,
  AvailabilitySlot,
  CapacityProjection,
  CapacityRecommendation,
  AvailabilityCalendar,
  MemberAvailability,
  CalendarSlot,
  TimeOffEntry,
  TeamEvent,
  RecurrenceRule,
  Holiday,
  TeamMetrics,
  ProductivityMetrics,
  CollaborationMetrics,
  QualityMetrics,
  EngagementMetrics,
  MetricTrend,
} from './teamWorkspace';

// Comment System
export {
  commentSystemService,
  default as CommentSystemService,
} from './commentSystem';
export type {
  Comment,
  EntityType,
  Mention,
  CommentAttachment,
  ReactionUser,
  CommentStatus,
  EditEntry,
  CommentMetadata,
  CommentThread,
  ThreadParticipant,
  CreateCommentRequest,
  UpdateCommentRequest,
  CommentFilter,
  CommentFeed,
  MentionSuggestion,
  ActivityFeedEntry,
  ActivityType as CommentActivityType,
  CommentStats,
} from './commentSystem';

// Notification Hub
export {
  notificationHubService,
  default as NotificationHubService,
} from './notificationHub';
export type {
  Notification,
  NotificationType,
  NotificationCategory,
  NotificationPriority,
  DeliveryChannel,
  NotificationStatus,
  DeliveryStatus,
  NotificationAction,
  NotificationPreferences,
  QuietHours,
  ChannelPreference,
  CategoryPreference,
  DigestSettings,
  MuteSettings,
  PriorityOverride,
  SendNotificationRequest,
  BulkNotificationRequest,
  NotificationGroup,
  NotificationFeed,
  NotificationHistory,
  HistoryStats,
  DigestContent,
  DigestSummary,
  DigestSection,
  SnoozeRequest,
} from './notificationHub';

// Activity Stream
export {
  activityStreamService,
  default as ActivityStreamService,
} from './activityStream';
export type {
  Activity,
  ActivityType,
  ActivityCategory,
  ActorInfo,
  TargetInfo,
  ContextInfo,
  ChangeDetail,
  ActivityMetadata,
  GeoLocation,
  ActivityVisibility,
  ActivityFeed as StreamActivityFeed,
  FeedPagination,
  FeedSummary,
  AppliedFilters,
  ActivityFeedOptions,
  GroupedActivityFeed,
  ActivityGroup,
  PersonalActivityLog,
  PersonalStats,
  DailyContribution,
  SearchOptions,
  SearchResult,
  ActivitySearchHit,
  SearchFacets,
  ExportOptions,
  ExportResult,
  ActivitySubscription,
} from './activityStream';
