/**
 * ORACLE Mission Briefings - Mobile Components
 * Comprehensive briefing system for mission-critical intelligence
 */

// Main Screen
export { BriefingScreen, default as BriefingScreenDefault } from './BriefingScreen';
export type { BriefingType, ViewMode, BriefingData } from './BriefingScreen';

// Section Cards
export {
  BriefingCard,
  CompactBriefingCard,
  default as BriefingCardDefault,
} from './BriefingCard';
export type {
  BriefingSectionType,
  PriorityLevel,
  BriefingSectionData,
} from './BriefingCard';

// Timeline Components
export {
  BriefingTimeline,
  CompactTimeline,
  default as BriefingTimelineDefault,
} from './BriefingTimeline';
export type {
  TimelineItem,
  TimelineItemType,
  TimelineItemStatus,
} from './BriefingTimeline';

// Audio Components
export {
  BriefingAudio,
  CompactAudioPlayer,
  default as BriefingAudioDefault,
} from './BriefingAudio';
export type { AudioSegment, AudioPlaybackState } from './BriefingAudio';

// Settings Components
export { BriefingSettings, default as BriefingSettingsDefault } from './BriefingSettings';
export type {
  BriefingSchedule,
  BriefingPreferences,
  NotificationChannel,
  VerbosityLevel,
} from './BriefingSettings';
