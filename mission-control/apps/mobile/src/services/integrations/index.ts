/**
 * ORACLE Integrations Index
 * Phase 4 - Third-party integrations for scheduling, tasks, and communication
 */

// Google Calendar Integration (int-1)
export {
  googleCalendarService,
  GoogleCalendarService,
  SecureTokenStorage,
  GOOGLE_CALENDAR_CONFIG,
  STORAGE_KEYS as GOOGLE_CALENDAR_STORAGE_KEYS,
  type IntegrationProvider,
  type IntegrationStatus,
  type IntegrationConfig,
  type OAuthTokens,
  type CalendarEvent,
  type CalendarAttendee,
  type Calendar,
  type SchedulingConflict,
  type CreateEventParams,
  type SyncResult,
} from './googleCalendar';

// Apple Calendar Integration (int-2)
export {
  appleCalendarService,
  AppleCalendarService,
  APPLE_CALENDAR_CONFIG,
  APPLE_CALENDAR_STORAGE_KEYS,
  type AppleCalendarEvent,
  type AppleCalendar,
  type CalendarPermissionStatus,
  type CalendarPreferences,
  type BackgroundRefreshConfig,
} from './appleCalendar';

// Todoist Integration (int-3)
export {
  todoistService,
  TodoistService,
  TODOIST_CONFIG,
  TODOIST_STORAGE_KEYS,
  PRIORITY_TO_URGENCY,
  URGENCY_TO_PRIORITY,
  type TodoistTask,
  type TodoistProject,
  type TodoistSection,
  type TodoistLabel,
  type ProjectMapping,
  type TodoistSyncConfig,
  type CreateTaskParams,
} from './todoist';

// Notion Integration (int-4)
export {
  notionService,
  NotionService,
  NOTION_CONFIG,
  NOTION_STORAGE_KEYS,
  type NotionPage,
  type NotionDatabase,
  type NotionBlock,
  type NotionProperty,
  type NotionRichText,
  type NotionSearchResult,
  type DatabaseMapping,
  type NotionSyncConfig,
  type CreatePageParams,
} from './notion';

// Slack Integration (int-5)
export {
  slackService,
  SlackService,
  SLACK_CONFIG,
  SLACK_STORAGE_KEYS,
  SLACK_PHASE_COLORS,
  SLACK_URGENCY_COLORS,
  type SlackChannel,
  type SlackMessage,
  type SlackBlock,
  type SlackInteractionPayload,
  type SlackSyncConfig,
} from './slack';

// Re-export defaults
export { default as googleCalendar } from './googleCalendar';
export { default as appleCalendar } from './appleCalendar';
export { default as todoist } from './todoist';
export { default as notion } from './notion';
export { default as slack } from './slack';
