/**
 * ORACLE Apple Calendar Integration
 * Story int-2 - Sync with iOS Calendar using EventKit
 *
 * Features:
 * - Request calendar permissions
 * - Read events from all calendars
 * - Create events from execution plans
 * - Calendar selection preference
 * - Background refresh
 */

import { Platform, NativeModules, NativeEventEmitter } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { ExecutionPlan, ExecutionStep } from '@mission-control/shared-types';
import {
  CalendarEvent,
  Calendar,
  SchedulingConflict,
  CreateEventParams,
  SyncResult,
  IntegrationStatus,
  IntegrationConfig,
} from './googleCalendar';

// ============================================================================
// TYPES
// ============================================================================

export type CalendarPermissionStatus = 'authorized' | 'denied' | 'restricted' | 'notDetermined';

export interface AppleCalendarEvent extends CalendarEvent {
  eventIdentifier?: string;
  calendarItemIdentifier?: string;
  hasAlarms: boolean;
  hasRecurrenceRules: boolean;
  isDetached: boolean;
  notes?: string;
  url?: string;
  availability: 'busy' | 'free' | 'tentative' | 'unavailable';
  organizer?: {
    name: string;
    isCurrentUser: boolean;
  };
}

export interface AppleCalendar extends Calendar {
  type: 'local' | 'calDAV' | 'exchange' | 'subscription' | 'birthday';
  allowsContentModifications: boolean;
  isSubscribed: boolean;
  isImmutable: boolean;
  cgColor?: { red: number; green: number; blue: number; alpha: number };
  source?: {
    sourceIdentifier: string;
    sourceType: string;
    title: string;
  };
}

export interface CalendarPreferences {
  selectedCalendarIds: string[];
  defaultCalendarId?: string;
  syncEnabled: boolean;
  backgroundRefreshEnabled: boolean;
  syncRangeMonths: number;
  showDeclinedEvents: boolean;
}

export interface BackgroundRefreshConfig {
  enabled: boolean;
  intervalMinutes: number;
  lastRefresh?: Date;
  nextScheduledRefresh?: Date;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const APPLE_CALENDAR_CONFIG: IntegrationConfig = {
  provider: 'apple_calendar',
  name: 'Apple Calendar',
  description: 'Sync with iOS Calendar using EventKit',
  icon: 'calendar.badge.clock',
  scopes: ['calendar.read', 'calendar.write', 'reminders.read'],
  authUrl: '', // Not applicable for native integration
  tokenUrl: '',
};

const STORAGE_KEYS = {
  PREFERENCES: 'oracle_apple_calendar_preferences',
  LAST_SYNC: 'oracle_apple_calendar_last_sync',
  SELECTED_CALENDARS: 'oracle_apple_calendar_selected',
  BACKGROUND_CONFIG: 'oracle_apple_calendar_background',
} as const;

// ============================================================================
// NATIVE MODULE INTERFACE
// ============================================================================

interface EventKitBridgeModule {
  // Permissions
  requestCalendarAccess(): Promise<CalendarPermissionStatus>;
  getCalendarPermissionStatus(): Promise<CalendarPermissionStatus>;

  // Calendars
  getCalendars(): Promise<AppleCalendar[]>;
  getDefaultCalendar(): Promise<AppleCalendar | null>;

  // Events
  getEvents(
    startDate: string,
    endDate: string,
    calendarIds?: string[]
  ): Promise<AppleCalendarEvent[]>;
  getEvent(eventIdentifier: string): Promise<AppleCalendarEvent | null>;
  createEvent(event: CreateEventParams & { calendarId: string }): Promise<string>;
  updateEvent(eventIdentifier: string, updates: Partial<CreateEventParams>): Promise<boolean>;
  deleteEvent(eventIdentifier: string): Promise<boolean>;

  // Background
  scheduleBackgroundRefresh(intervalMinutes: number): Promise<boolean>;
  cancelBackgroundRefresh(): Promise<void>;
}

// Mock module for development/Android
const MockEventKitBridge: EventKitBridgeModule = {
  requestCalendarAccess: async () => 'authorized',
  getCalendarPermissionStatus: async () => 'authorized',
  getCalendars: async () => [],
  getDefaultCalendar: async () => null,
  getEvents: async () => [],
  getEvent: async () => null,
  createEvent: async () => 'mock_event_id',
  updateEvent: async () => true,
  deleteEvent: async () => true,
  scheduleBackgroundRefresh: async () => true,
  cancelBackgroundRefresh: async () => {},
};

const EventKitBridge: EventKitBridgeModule =
  Platform.OS === 'ios' && NativeModules.EventKitBridge
    ? NativeModules.EventKitBridge
    : MockEventKitBridge;

// ============================================================================
// APPLE CALENDAR SERVICE
// ============================================================================

class AppleCalendarService {
  private status: IntegrationStatus = 'disconnected';
  private permissionStatus: CalendarPermissionStatus = 'notDetermined';
  private calendars: AppleCalendar[] = [];
  private events: AppleCalendarEvent[] = [];
  private preferences: CalendarPreferences;
  private backgroundConfig: BackgroundRefreshConfig;
  private syncInProgress = false;
  private eventEmitter?: NativeEventEmitter;

  constructor() {
    this.preferences = {
      selectedCalendarIds: [],
      syncEnabled: true,
      backgroundRefreshEnabled: true,
      syncRangeMonths: 1,
      showDeclinedEvents: false,
    };

    this.backgroundConfig = {
      enabled: false,
      intervalMinutes: 15,
    };

    this.loadPreferences();
    this.setupEventListeners();
  }

  // --------------------------------------------------------------------------
  // Initialization
  // --------------------------------------------------------------------------

  private async loadPreferences(): Promise<void> {
    try {
      const stored = await SecureStore.getItemAsync(STORAGE_KEYS.PREFERENCES);
      if (stored) {
        this.preferences = { ...this.preferences, ...JSON.parse(stored) };
      }

      const bgConfig = await SecureStore.getItemAsync(STORAGE_KEYS.BACKGROUND_CONFIG);
      if (bgConfig) {
        this.backgroundConfig = { ...this.backgroundConfig, ...JSON.parse(bgConfig) };
      }
    } catch (error) {
      console.warn('[AppleCalendar] Failed to load preferences:', error);
    }
  }

  private async savePreferences(): Promise<void> {
    try {
      await SecureStore.setItemAsync(
        STORAGE_KEYS.PREFERENCES,
        JSON.stringify(this.preferences)
      );
    } catch (error) {
      console.warn('[AppleCalendar] Failed to save preferences:', error);
    }
  }

  private setupEventListeners(): void {
    if (Platform.OS !== 'ios' || !NativeModules.EventKitBridge) return;

    try {
      this.eventEmitter = new NativeEventEmitter(NativeModules.EventKitBridge);

      // Listen for calendar changes
      this.eventEmitter.addListener('calendarChanged', () => {
        console.log('[AppleCalendar] Calendar changed, refreshing...');
        this.sync();
      });

      // Listen for background refresh completion
      this.eventEmitter.addListener('backgroundRefreshComplete', (data) => {
        console.log('[AppleCalendar] Background refresh complete:', data);
        this.backgroundConfig.lastRefresh = new Date();
      });
    } catch (error) {
      console.warn('[AppleCalendar] Failed to setup event listeners:', error);
    }
  }

  // --------------------------------------------------------------------------
  // Permissions
  // --------------------------------------------------------------------------

  /**
   * Request calendar permissions
   */
  async requestPermissions(): Promise<CalendarPermissionStatus> {
    console.log('[AppleCalendar] Requesting calendar permissions');

    try {
      this.permissionStatus = await EventKitBridge.requestCalendarAccess();

      if (this.permissionStatus === 'authorized') {
        this.status = 'connected';
        console.log('[AppleCalendar] Permission granted');
      } else {
        this.status = 'disconnected';
        console.log('[AppleCalendar] Permission denied:', this.permissionStatus);
      }

      return this.permissionStatus;
    } catch (error) {
      console.error('[AppleCalendar] Permission request failed:', error);
      this.status = 'error';
      throw error;
    }
  }

  /**
   * Get current permission status
   */
  async getPermissionStatus(): Promise<CalendarPermissionStatus> {
    try {
      this.permissionStatus = await EventKitBridge.getCalendarPermissionStatus();
      this.status = this.permissionStatus === 'authorized' ? 'connected' : 'disconnected';
      return this.permissionStatus;
    } catch (error) {
      console.error('[AppleCalendar] Failed to get permission status:', error);
      return 'notDetermined';
    }
  }

  // --------------------------------------------------------------------------
  // Calendar Operations
  // --------------------------------------------------------------------------

  /**
   * Fetch all calendars
   */
  async fetchCalendars(): Promise<AppleCalendar[]> {
    console.log('[AppleCalendar] Fetching calendars');

    try {
      this.calendars = await EventKitBridge.getCalendars();

      // Apply selection preferences
      this.calendars = this.calendars.map(cal => ({
        ...cal,
        is_selected: this.preferences.selectedCalendarIds.includes(cal.id) ||
          (this.preferences.selectedCalendarIds.length === 0 && cal.is_primary),
      }));

      console.log(`[AppleCalendar] Fetched ${this.calendars.length} calendars`);
      return this.calendars;
    } catch (error) {
      console.error('[AppleCalendar] Failed to fetch calendars:', error);
      throw error;
    }
  }

  /**
   * Get default calendar for new events
   */
  async getDefaultCalendar(): Promise<AppleCalendar | null> {
    if (this.preferences.defaultCalendarId) {
      const cal = this.calendars.find(c => c.id === this.preferences.defaultCalendarId);
      if (cal) return cal;
    }

    return EventKitBridge.getDefaultCalendar();
  }

  /**
   * Set calendar selection
   */
  async setSelectedCalendars(calendarIds: string[]): Promise<void> {
    this.preferences.selectedCalendarIds = calendarIds;

    this.calendars = this.calendars.map(cal => ({
      ...cal,
      is_selected: calendarIds.includes(cal.id),
    }));

    await this.savePreferences();
    console.log('[AppleCalendar] Selected calendars updated:', calendarIds);
  }

  /**
   * Set default calendar for new events
   */
  async setDefaultCalendar(calendarId: string): Promise<void> {
    this.preferences.defaultCalendarId = calendarId;
    await this.savePreferences();
    console.log('[AppleCalendar] Default calendar set:', calendarId);
  }

  // --------------------------------------------------------------------------
  // Event Operations
  // --------------------------------------------------------------------------

  /**
   * Fetch events from calendars
   */
  async fetchEvents(
    startDate?: Date,
    endDate?: Date,
    calendarIds?: string[]
  ): Promise<AppleCalendarEvent[]> {
    console.log('[AppleCalendar] Fetching events');

    const now = new Date();
    const start = startDate || now;
    const end = endDate || new Date(now.getTime() + this.preferences.syncRangeMonths * 30 * 24 * 60 * 60 * 1000);

    const calendarsToFetch = calendarIds ||
      this.calendars.filter(c => c.is_selected).map(c => c.id);

    try {
      this.events = await EventKitBridge.getEvents(
        start.toISOString(),
        end.toISOString(),
        calendarsToFetch.length > 0 ? calendarsToFetch : undefined
      );

      // Filter declined events if preference is set
      if (!this.preferences.showDeclinedEvents) {
        this.events = this.events.filter(e => e.status !== 'cancelled');
      }

      // Sort by start time
      this.events.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

      console.log(`[AppleCalendar] Fetched ${this.events.length} events`);
      return this.events;
    } catch (error) {
      console.error('[AppleCalendar] Failed to fetch events:', error);
      throw error;
    }
  }

  /**
   * Create a new calendar event
   */
  async createEvent(params: CreateEventParams): Promise<AppleCalendarEvent> {
    console.log('[AppleCalendar] Creating event:', params.title);

    const calendarId = params.calendar_id || this.preferences.defaultCalendarId;
    if (!calendarId) {
      const defaultCal = await this.getDefaultCalendar();
      if (!defaultCal) {
        throw new Error('No calendar available for event creation');
      }
      params.calendar_id = defaultCal.id;
    }

    try {
      const eventId = await EventKitBridge.createEvent({
        ...params,
        calendarId: params.calendar_id!,
      });

      const newEvent = await EventKitBridge.getEvent(eventId);
      if (!newEvent) {
        throw new Error('Failed to retrieve created event');
      }

      this.events.push(newEvent);
      this.events.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

      console.log('[AppleCalendar] Event created:', eventId);
      return newEvent;
    } catch (error) {
      console.error('[AppleCalendar] Failed to create event:', error);
      throw error;
    }
  }

  /**
   * Create events from an execution plan
   */
  async createEventsFromPlan(
    plan: ExecutionPlan,
    steps: ExecutionStep[],
    calendarId?: string
  ): Promise<AppleCalendarEvent[]> {
    console.log('[AppleCalendar] Creating events from execution plan:', plan.id);

    const createdEvents: AppleCalendarEvent[] = [];
    const targetCalendar = calendarId || this.preferences.defaultCalendarId;

    for (const step of steps) {
      if (!step.scheduled_start) continue;

      const startTime = new Date(step.scheduled_start);
      const estimatedMinutes = step.estimated_minutes || 30;
      const endTime = new Date(startTime.getTime() + estimatedMinutes * 60 * 1000);

      try {
        const event = await this.createEvent({
          title: `[ORACLE] ${step.title}`,
          description: step.description || `Execution step from plan: ${plan.title || plan.id}`,
          start: startTime,
          end: endTime,
          calendar_id: targetCalendar,
          oracle_step_id: step.id,
          reminders: [{ method: 'popup', minutes: 10 }],
        });

        createdEvents.push(event);
      } catch (error) {
        console.warn(`[AppleCalendar] Failed to create event for step ${step.id}:`, error);
      }
    }

    console.log(`[AppleCalendar] Created ${createdEvents.length} events from plan`);
    return createdEvents;
  }

  // --------------------------------------------------------------------------
  // Conflict Detection
  // --------------------------------------------------------------------------

  /**
   * Detect scheduling conflicts
   */
  detectConflicts(events?: AppleCalendarEvent[]): SchedulingConflict[] {
    const eventsToCheck = events || this.events;
    const conflicts: SchedulingConflict[] = [];

    const sorted = [...eventsToCheck]
      .filter(e => !e.is_all_day && e.availability !== 'free')
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const eventA = sorted[i];
        const eventB = sorted[j];

        const startA = new Date(eventA.start);
        const endA = new Date(eventA.end);
        const startB = new Date(eventB.start);
        const endB = new Date(eventB.end);

        if (startB >= endA) break;

        const overlapStart = startB > startA ? startB : startA;
        const overlapEnd = endA < endB ? endA : endB;
        const overlapMinutes = Math.round((overlapEnd.getTime() - overlapStart.getTime()) / 60000);

        let severity: 'low' | 'medium' | 'high' = 'low';
        if (overlapMinutes >= 60) severity = 'high';
        else if (overlapMinutes >= 30) severity = 'medium';

        const suggestions: string[] = [];
        suggestions.push(`Reschedule "${eventB.title}" to start after ${endA.toLocaleTimeString()}`);
        suggestions.push(`Shorten "${eventA.title}" to end before ${startB.toLocaleTimeString()}`);

        conflicts.push({
          id: `conflict_${eventA.id}_${eventB.id}`,
          event_a: eventA,
          event_b: eventB,
          overlap_start: overlapStart,
          overlap_end: overlapEnd,
          overlap_minutes: overlapMinutes,
          severity,
          suggestions,
        });
      }
    }

    console.log(`[AppleCalendar] Detected ${conflicts.length} conflicts`);
    return conflicts;
  }

  /**
   * Check if a time slot has conflicts
   */
  checkTimeSlotConflicts(start: Date, end: Date, excludeEventId?: string): AppleCalendarEvent[] {
    return this.events.filter(event => {
      if (excludeEventId && event.id === excludeEventId) return false;
      if (event.is_all_day) return false;
      if (event.availability === 'free') return false;

      const eventStart = new Date(event.start);
      const eventEnd = new Date(event.end);
      return eventStart < end && eventEnd > start;
    });
  }

  /**
   * Find available time slots
   */
  findAvailableSlots(
    date: Date,
    durationMinutes: number,
    startHour = 9,
    endHour = 17
  ): { start: Date; end: Date }[] {
    const slots: { start: Date; end: Date }[] = [];

    const dayStart = new Date(date);
    dayStart.setHours(startHour, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(endHour, 0, 0, 0);

    const dayEvents = this.events
      .filter(e => {
        if (e.is_all_day || e.availability === 'free') return false;
        const start = new Date(e.start);
        const end = new Date(e.end);
        return start < dayEnd && end > dayStart;
      })
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

    let currentTime = dayStart;

    for (const event of dayEvents) {
      const eventStart = new Date(event.start);
      const actualStart = eventStart > dayStart ? eventStart : dayStart;
      const gapMinutes = (actualStart.getTime() - currentTime.getTime()) / 60000;

      if (gapMinutes >= durationMinutes) {
        slots.push({
          start: new Date(currentTime),
          end: new Date(currentTime.getTime() + durationMinutes * 60000),
        });
      }

      const eventEnd = new Date(event.end);
      currentTime = eventEnd > currentTime ? eventEnd : currentTime;
    }

    const remainingMinutes = (dayEnd.getTime() - currentTime.getTime()) / 60000;
    if (remainingMinutes >= durationMinutes) {
      slots.push({
        start: new Date(currentTime),
        end: new Date(currentTime.getTime() + durationMinutes * 60000),
      });
    }

    return slots;
  }

  // --------------------------------------------------------------------------
  // Background Refresh
  // --------------------------------------------------------------------------

  /**
   * Enable background refresh
   */
  async enableBackgroundRefresh(intervalMinutes = 15): Promise<void> {
    console.log('[AppleCalendar] Enabling background refresh:', intervalMinutes, 'min');

    try {
      const success = await EventKitBridge.scheduleBackgroundRefresh(intervalMinutes);

      if (success) {
        this.backgroundConfig = {
          enabled: true,
          intervalMinutes,
          nextScheduledRefresh: new Date(Date.now() + intervalMinutes * 60 * 1000),
        };

        await SecureStore.setItemAsync(
          STORAGE_KEYS.BACKGROUND_CONFIG,
          JSON.stringify(this.backgroundConfig)
        );

        console.log('[AppleCalendar] Background refresh enabled');
      }
    } catch (error) {
      console.error('[AppleCalendar] Failed to enable background refresh:', error);
      throw error;
    }
  }

  /**
   * Disable background refresh
   */
  async disableBackgroundRefresh(): Promise<void> {
    console.log('[AppleCalendar] Disabling background refresh');

    try {
      await EventKitBridge.cancelBackgroundRefresh();

      this.backgroundConfig = {
        enabled: false,
        intervalMinutes: this.backgroundConfig.intervalMinutes,
      };

      await SecureStore.setItemAsync(
        STORAGE_KEYS.BACKGROUND_CONFIG,
        JSON.stringify(this.backgroundConfig)
      );

      console.log('[AppleCalendar] Background refresh disabled');
    } catch (error) {
      console.error('[AppleCalendar] Failed to disable background refresh:', error);
    }
  }

  // --------------------------------------------------------------------------
  // Sync Operations
  // --------------------------------------------------------------------------

  /**
   * Full sync with Apple Calendar
   */
  async sync(): Promise<SyncResult> {
    if (this.syncInProgress) {
      return {
        success: false,
        events_fetched: 0,
        events_created: 0,
        conflicts_detected: 0,
        last_sync: new Date(),
        error: 'Sync already in progress',
      };
    }

    this.syncInProgress = true;
    console.log('[AppleCalendar] Starting sync');

    try {
      // Check permissions
      const permStatus = await this.getPermissionStatus();
      if (permStatus !== 'authorized') {
        throw new Error('Calendar permission not granted');
      }

      // Fetch calendars if needed
      if (this.calendars.length === 0) {
        await this.fetchCalendars();
      }

      // Fetch events
      const events = await this.fetchEvents();

      // Detect conflicts
      const conflicts = this.detectConflicts(events);

      // Store last sync time
      await SecureStore.setItemAsync(STORAGE_KEYS.LAST_SYNC, new Date().toISOString());

      const result: SyncResult = {
        success: true,
        events_fetched: events.length,
        events_created: 0,
        conflicts_detected: conflicts.length,
        last_sync: new Date(),
      };

      console.log('[AppleCalendar] Sync completed:', result);
      return result;
    } catch (error) {
      console.error('[AppleCalendar] Sync failed:', error);
      return {
        success: false,
        events_fetched: 0,
        events_created: 0,
        conflicts_detected: 0,
        last_sync: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    } finally {
      this.syncInProgress = false;
    }
  }

  // --------------------------------------------------------------------------
  // Disconnect
  // --------------------------------------------------------------------------

  /**
   * Disconnect (clear preferences and cached data)
   */
  async disconnect(): Promise<void> {
    console.log('[AppleCalendar] Disconnecting');

    await this.disableBackgroundRefresh();

    await SecureStore.deleteItemAsync(STORAGE_KEYS.PREFERENCES);
    await SecureStore.deleteItemAsync(STORAGE_KEYS.LAST_SYNC);
    await SecureStore.deleteItemAsync(STORAGE_KEYS.BACKGROUND_CONFIG);

    this.status = 'disconnected';
    this.calendars = [];
    this.events = [];
    this.preferences = {
      selectedCalendarIds: [],
      syncEnabled: true,
      backgroundRefreshEnabled: true,
      syncRangeMonths: 1,
      showDeclinedEvents: false,
    };
  }

  // --------------------------------------------------------------------------
  // Getters
  // --------------------------------------------------------------------------

  getStatus(): IntegrationStatus {
    return this.status;
  }

  getCalendars(): AppleCalendar[] {
    return this.calendars;
  }

  getEvents(): AppleCalendarEvent[] {
    return this.events;
  }

  getPreferences(): CalendarPreferences {
    return this.preferences;
  }

  getBackgroundConfig(): BackgroundRefreshConfig {
    return this.backgroundConfig;
  }

  getConfig(): IntegrationConfig {
    return APPLE_CALENDAR_CONFIG;
  }

  isConnected(): boolean {
    return this.status === 'connected' && this.permissionStatus === 'authorized';
  }

  async getLastSyncTime(): Promise<Date | null> {
    const lastSync = await SecureStore.getItemAsync(STORAGE_KEYS.LAST_SYNC);
    return lastSync ? new Date(lastSync) : null;
  }
}

// ============================================================================
// SINGLETON & EXPORTS
// ============================================================================

export const appleCalendarService = new AppleCalendarService();

export {
  AppleCalendarService,
  APPLE_CALENDAR_CONFIG,
  STORAGE_KEYS as APPLE_CALENDAR_STORAGE_KEYS,
};

export default appleCalendarService;
