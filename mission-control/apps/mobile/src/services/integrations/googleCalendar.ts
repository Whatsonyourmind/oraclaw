/**
 * ORACLE Google Calendar Integration
 * Story int-1 - Sync with Google Calendar for scheduling intelligence
 *
 * Features:
 * - OAuth2 flow for Google Calendar
 * - Read calendar events
 * - Create events from execution plans
 * - Detect scheduling conflicts
 * - Store tokens securely
 */

import * as SecureStore from 'expo-secure-store';
import { ExecutionPlan, ExecutionStep } from '@mission-control/shared-types';

// ============================================================================
// TYPES
// ============================================================================

export type IntegrationProvider = 'google_calendar' | 'apple_calendar' | 'todoist' | 'notion' | 'slack' | 'gmail' | 'outlook' | 'zapier' | 'ifttt';
export type IntegrationStatus = 'connected' | 'disconnected' | 'error' | 'refreshing';
export type TokenType = 'access' | 'refresh';

export interface IntegrationConfig {
  provider: IntegrationProvider;
  name: string;
  description: string;
  icon: string;
  scopes: string[];
  authUrl: string;
  tokenUrl: string;
  revokeUrl?: string;
}

export interface OAuthTokens {
  access_token: string;
  refresh_token?: string;
  expires_at: number;
  token_type: string;
  scope: string;
}

export interface CalendarEvent {
  id: string;
  calendar_id: string;
  title: string;
  description?: string;
  start: Date;
  end: Date;
  location?: string;
  attendees?: CalendarAttendee[];
  is_all_day: boolean;
  recurrence?: string[];
  status: 'confirmed' | 'tentative' | 'cancelled';
  visibility: 'public' | 'private' | 'default';
  source?: 'google' | 'apple' | 'oracle';
  oracle_step_id?: string;
  metadata?: Record<string, any>;
}

export interface CalendarAttendee {
  email: string;
  name?: string;
  response_status: 'needsAction' | 'declined' | 'tentative' | 'accepted';
  is_organizer: boolean;
}

export interface Calendar {
  id: string;
  name: string;
  description?: string;
  color: string;
  is_primary: boolean;
  is_selected: boolean;
  access_role: 'owner' | 'writer' | 'reader' | 'freeBusyReader';
}

export interface SchedulingConflict {
  id: string;
  event_a: CalendarEvent;
  event_b: CalendarEvent;
  overlap_start: Date;
  overlap_end: Date;
  overlap_minutes: number;
  severity: 'low' | 'medium' | 'high';
  suggestions: string[];
}

export interface CreateEventParams {
  title: string;
  description?: string;
  start: Date;
  end: Date;
  calendar_id?: string;
  location?: string;
  attendees?: string[];
  oracle_step_id?: string;
  reminders?: { method: 'email' | 'popup'; minutes: number }[];
}

export interface SyncResult {
  success: boolean;
  events_fetched: number;
  events_created: number;
  conflicts_detected: number;
  last_sync: Date;
  error?: string;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const GOOGLE_CALENDAR_CONFIG: IntegrationConfig = {
  provider: 'google_calendar',
  name: 'Google Calendar',
  description: 'Sync with Google Calendar for scheduling intelligence',
  icon: 'calendar',
  scopes: [
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/calendar.events',
  ],
  authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenUrl: 'https://oauth2.googleapis.com/token',
  revokeUrl: 'https://oauth2.googleapis.com/revoke',
};

// Secure storage keys
const STORAGE_KEYS = {
  ACCESS_TOKEN: 'oracle_gcal_access_token',
  REFRESH_TOKEN: 'oracle_gcal_refresh_token',
  TOKEN_EXPIRES: 'oracle_gcal_token_expires',
  LAST_SYNC: 'oracle_gcal_last_sync',
  SELECTED_CALENDARS: 'oracle_gcal_selected_calendars',
} as const;

// API endpoints
const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

// ============================================================================
// SECURE TOKEN STORAGE
// ============================================================================

class SecureTokenStorage {
  async storeTokens(tokens: OAuthTokens): Promise<void> {
    try {
      await SecureStore.setItemAsync(
        STORAGE_KEYS.ACCESS_TOKEN,
        tokens.access_token
      );

      if (tokens.refresh_token) {
        await SecureStore.setItemAsync(
          STORAGE_KEYS.REFRESH_TOKEN,
          tokens.refresh_token
        );
      }

      await SecureStore.setItemAsync(
        STORAGE_KEYS.TOKEN_EXPIRES,
        tokens.expires_at.toString()
      );

      console.log('[GoogleCalendar] Tokens stored securely');
    } catch (error) {
      console.error('[GoogleCalendar] Failed to store tokens:', error);
      throw new Error('Failed to store tokens securely');
    }
  }

  async getAccessToken(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(STORAGE_KEYS.ACCESS_TOKEN);
    } catch (error) {
      console.error('[GoogleCalendar] Failed to get access token:', error);
      return null;
    }
  }

  async getRefreshToken(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(STORAGE_KEYS.REFRESH_TOKEN);
    } catch (error) {
      console.error('[GoogleCalendar] Failed to get refresh token:', error);
      return null;
    }
  }

  async getTokenExpiry(): Promise<number | null> {
    try {
      const expires = await SecureStore.getItemAsync(STORAGE_KEYS.TOKEN_EXPIRES);
      return expires ? parseInt(expires, 10) : null;
    } catch (error) {
      console.error('[GoogleCalendar] Failed to get token expiry:', error);
      return null;
    }
  }

  async isTokenExpired(): Promise<boolean> {
    const expiresAt = await this.getTokenExpiry();
    if (!expiresAt) return true;
    // Consider expired if less than 5 minutes remaining
    return Date.now() > expiresAt - 5 * 60 * 1000;
  }

  async clearTokens(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(STORAGE_KEYS.ACCESS_TOKEN);
      await SecureStore.deleteItemAsync(STORAGE_KEYS.REFRESH_TOKEN);
      await SecureStore.deleteItemAsync(STORAGE_KEYS.TOKEN_EXPIRES);
      await SecureStore.deleteItemAsync(STORAGE_KEYS.LAST_SYNC);
      console.log('[GoogleCalendar] Tokens cleared');
    } catch (error) {
      console.error('[GoogleCalendar] Failed to clear tokens:', error);
    }
  }
}

// ============================================================================
// GOOGLE CALENDAR SERVICE
// ============================================================================

class GoogleCalendarService {
  private tokenStorage = new SecureTokenStorage();
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;
  private status: IntegrationStatus = 'disconnected';
  private calendars: Calendar[] = [];
  private events: CalendarEvent[] = [];
  private syncInProgress = false;

  constructor() {
    // These should be loaded from environment/config
    this.clientId = process.env.GOOGLE_CLIENT_ID || '';
    this.clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
    this.redirectUri = process.env.GOOGLE_REDIRECT_URI || 'com.missioncontrol.oracle:/oauth2callback';
  }

  // --------------------------------------------------------------------------
  // OAuth2 Flow
  // --------------------------------------------------------------------------

  /**
   * Generate OAuth2 authorization URL
   */
  getAuthorizationUrl(state?: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: GOOGLE_CALENDAR_CONFIG.scopes.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      ...(state && { state }),
    });

    return `${GOOGLE_CALENDAR_CONFIG.authUrl}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string): Promise<OAuthTokens> {
    console.log('[GoogleCalendar] Exchanging code for tokens');

    const response = await fetch(GOOGLE_CALENDAR_CONFIG.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: this.redirectUri,
      }).toString(),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('[GoogleCalendar] Token exchange failed:', error);
      throw new Error(`Token exchange failed: ${error.error_description || error.error}`);
    }

    const data = await response.json();
    const tokens: OAuthTokens = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Date.now() + data.expires_in * 1000,
      token_type: data.token_type,
      scope: data.scope,
    };

    await this.tokenStorage.storeTokens(tokens);
    this.status = 'connected';

    console.log('[GoogleCalendar] Successfully connected');
    return tokens;
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(): Promise<string> {
    console.log('[GoogleCalendar] Refreshing access token');
    this.status = 'refreshing';

    const refreshToken = await this.tokenStorage.getRefreshToken();
    if (!refreshToken) {
      this.status = 'disconnected';
      throw new Error('No refresh token available');
    }

    const response = await fetch(GOOGLE_CALENDAR_CONFIG.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }).toString(),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('[GoogleCalendar] Token refresh failed:', error);
      this.status = 'error';
      throw new Error(`Token refresh failed: ${error.error_description || error.error}`);
    }

    const data = await response.json();
    const tokens: OAuthTokens = {
      access_token: data.access_token,
      refresh_token: refreshToken, // Keep existing refresh token
      expires_at: Date.now() + data.expires_in * 1000,
      token_type: data.token_type,
      scope: data.scope,
    };

    await this.tokenStorage.storeTokens(tokens);
    this.status = 'connected';

    console.log('[GoogleCalendar] Token refreshed successfully');
    return tokens.access_token;
  }

  /**
   * Get valid access token, refreshing if necessary
   */
  async getValidAccessToken(): Promise<string> {
    const isExpired = await this.tokenStorage.isTokenExpired();

    if (isExpired) {
      return this.refreshAccessToken();
    }

    const token = await this.tokenStorage.getAccessToken();
    if (!token) {
      throw new Error('No access token available');
    }

    return token;
  }

  /**
   * Disconnect and revoke tokens
   */
  async disconnect(): Promise<void> {
    console.log('[GoogleCalendar] Disconnecting');

    const token = await this.tokenStorage.getAccessToken();
    if (token && GOOGLE_CALENDAR_CONFIG.revokeUrl) {
      try {
        await fetch(`${GOOGLE_CALENDAR_CONFIG.revokeUrl}?token=${token}`, {
          method: 'POST',
        });
      } catch (error) {
        console.warn('[GoogleCalendar] Token revocation failed:', error);
      }
    }

    await this.tokenStorage.clearTokens();
    this.status = 'disconnected';
    this.calendars = [];
    this.events = [];
  }

  // --------------------------------------------------------------------------
  // Calendar Operations
  // --------------------------------------------------------------------------

  /**
   * Fetch list of user's calendars
   */
  async fetchCalendars(): Promise<Calendar[]> {
    console.log('[GoogleCalendar] Fetching calendars');

    const token = await this.getValidAccessToken();
    const response = await fetch(`${GOOGLE_CALENDAR_API}/users/me/calendarList`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to fetch calendars: ${error.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    this.calendars = (data.items || []).map((cal: any) => ({
      id: cal.id,
      name: cal.summary,
      description: cal.description,
      color: cal.backgroundColor || '#4285f4',
      is_primary: cal.primary || false,
      is_selected: cal.selected || cal.primary || false,
      access_role: cal.accessRole,
    }));

    console.log(`[GoogleCalendar] Fetched ${this.calendars.length} calendars`);
    return this.calendars;
  }

  /**
   * Fetch events from specified calendars
   */
  async fetchEvents(
    calendarIds?: string[],
    timeMin?: Date,
    timeMax?: Date,
    maxResults = 250
  ): Promise<CalendarEvent[]> {
    console.log('[GoogleCalendar] Fetching events');

    const token = await this.getValidAccessToken();
    const calendarsToFetch = calendarIds || this.calendars.filter(c => c.is_selected).map(c => c.id);

    if (calendarsToFetch.length === 0) {
      calendarsToFetch.push('primary');
    }

    const now = new Date();
    const defaultTimeMin = timeMin || now;
    const defaultTimeMax = timeMax || new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

    const allEvents: CalendarEvent[] = [];

    for (const calendarId of calendarsToFetch) {
      try {
        const params = new URLSearchParams({
          timeMin: defaultTimeMin.toISOString(),
          timeMax: defaultTimeMax.toISOString(),
          maxResults: maxResults.toString(),
          singleEvents: 'true',
          orderBy: 'startTime',
        });

        const response = await fetch(
          `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) {
          console.warn(`[GoogleCalendar] Failed to fetch events from ${calendarId}`);
          continue;
        }

        const data = await response.json();
        const events = (data.items || []).map((event: any) => this.parseGoogleEvent(event, calendarId));
        allEvents.push(...events);
      } catch (error) {
        console.warn(`[GoogleCalendar] Error fetching events from ${calendarId}:`, error);
      }
    }

    this.events = allEvents.sort((a, b) => a.start.getTime() - b.start.getTime());
    console.log(`[GoogleCalendar] Fetched ${this.events.length} events`);

    return this.events;
  }

  /**
   * Parse Google Calendar event to our format
   */
  private parseGoogleEvent(event: any, calendarId: string): CalendarEvent {
    const isAllDay = !event.start.dateTime;
    const start = isAllDay
      ? new Date(event.start.date)
      : new Date(event.start.dateTime);
    const end = isAllDay
      ? new Date(event.end.date)
      : new Date(event.end.dateTime);

    return {
      id: event.id,
      calendar_id: calendarId,
      title: event.summary || '(No title)',
      description: event.description,
      start,
      end,
      location: event.location,
      attendees: (event.attendees || []).map((a: any) => ({
        email: a.email,
        name: a.displayName,
        response_status: a.responseStatus,
        is_organizer: a.organizer || false,
      })),
      is_all_day: isAllDay,
      recurrence: event.recurrence,
      status: event.status || 'confirmed',
      visibility: event.visibility || 'default',
      source: 'google',
      metadata: {
        google_event_id: event.id,
        google_calendar_id: calendarId,
        html_link: event.htmlLink,
        etag: event.etag,
      },
    };
  }

  /**
   * Create a new calendar event
   */
  async createEvent(params: CreateEventParams): Promise<CalendarEvent> {
    console.log('[GoogleCalendar] Creating event:', params.title);

    const token = await this.getValidAccessToken();
    const calendarId = params.calendar_id || 'primary';

    const eventBody: any = {
      summary: params.title,
      description: params.description,
      start: {
        dateTime: params.start.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      end: {
        dateTime: params.end.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      location: params.location,
    };

    if (params.attendees?.length) {
      eventBody.attendees = params.attendees.map(email => ({ email }));
    }

    if (params.reminders?.length) {
      eventBody.reminders = {
        useDefault: false,
        overrides: params.reminders,
      };
    }

    // Add ORACLE metadata to description
    if (params.oracle_step_id) {
      eventBody.description = `${params.description || ''}\n\n---\nOracle Step ID: ${params.oracle_step_id}`.trim();
      eventBody.extendedProperties = {
        private: {
          oracle_step_id: params.oracle_step_id,
        },
      };
    }

    const response = await fetch(
      `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventBody),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to create event: ${error.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    const newEvent = this.parseGoogleEvent(data, calendarId);

    this.events.push(newEvent);
    console.log('[GoogleCalendar] Event created:', newEvent.id);

    return newEvent;
  }

  /**
   * Create events from an execution plan
   */
  async createEventsFromPlan(
    plan: ExecutionPlan,
    steps: ExecutionStep[],
    calendarId?: string
  ): Promise<CalendarEvent[]> {
    console.log('[GoogleCalendar] Creating events from execution plan:', plan.id);

    const createdEvents: CalendarEvent[] = [];
    const targetCalendar = calendarId || 'primary';

    for (const step of steps) {
      // Skip steps that don't have timing info
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
          reminders: [
            { method: 'popup', minutes: 10 },
          ],
        });

        createdEvents.push(event);
      } catch (error) {
        console.warn(`[GoogleCalendar] Failed to create event for step ${step.id}:`, error);
      }
    }

    console.log(`[GoogleCalendar] Created ${createdEvents.length} events from plan`);
    return createdEvents;
  }

  // --------------------------------------------------------------------------
  // Conflict Detection
  // --------------------------------------------------------------------------

  /**
   * Detect scheduling conflicts in events
   */
  detectConflicts(events?: CalendarEvent[]): SchedulingConflict[] {
    const eventsToCheck = events || this.events;
    const conflicts: SchedulingConflict[] = [];

    // Sort events by start time
    const sorted = [...eventsToCheck]
      .filter(e => !e.is_all_day) // Exclude all-day events from conflict detection
      .sort((a, b) => a.start.getTime() - b.start.getTime());

    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const eventA = sorted[i];
        const eventB = sorted[j];

        // If event B starts after event A ends, no more conflicts possible
        if (eventB.start >= eventA.end) break;

        // We have an overlap
        const overlapStart = eventB.start > eventA.start ? eventB.start : eventA.start;
        const overlapEnd = eventA.end < eventB.end ? eventA.end : eventB.end;
        const overlapMinutes = Math.round((overlapEnd.getTime() - overlapStart.getTime()) / 60000);

        // Determine severity
        let severity: 'low' | 'medium' | 'high' = 'low';
        if (overlapMinutes >= 60) {
          severity = 'high';
        } else if (overlapMinutes >= 30) {
          severity = 'medium';
        }

        // Generate suggestions
        const suggestions: string[] = [];
        suggestions.push(`Reschedule "${eventB.title}" to start after ${eventA.end.toLocaleTimeString()}`);
        suggestions.push(`Shorten "${eventA.title}" to end before ${eventB.start.toLocaleTimeString()}`);
        if (eventA.attendees?.length || eventB.attendees?.length) {
          suggestions.push('Consider rescheduling the meeting with fewer attendees');
        }

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

    console.log(`[GoogleCalendar] Detected ${conflicts.length} scheduling conflicts`);
    return conflicts;
  }

  /**
   * Check if a proposed time slot has conflicts
   */
  checkTimeSlotConflicts(start: Date, end: Date, excludeEventId?: string): CalendarEvent[] {
    return this.events.filter(event => {
      if (excludeEventId && event.id === excludeEventId) return false;
      if (event.is_all_day) return false;

      // Check for overlap
      return event.start < end && event.end > start;
    });
  }

  /**
   * Find available time slots in a given range
   */
  findAvailableSlots(
    date: Date,
    durationMinutes: number,
    startHour = 9,
    endHour = 17
  ): { start: Date; end: Date }[] {
    const slots: { start: Date; end: Date }[] = [];

    // Get events for the day
    const dayStart = new Date(date);
    dayStart.setHours(startHour, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(endHour, 0, 0, 0);

    const dayEvents = this.events
      .filter(e => {
        if (e.is_all_day) return false;
        return e.start < dayEnd && e.end > dayStart;
      })
      .sort((a, b) => a.start.getTime() - b.start.getTime());

    // Find gaps between events
    let currentTime = dayStart;

    for (const event of dayEvents) {
      const eventStart = event.start > dayStart ? event.start : dayStart;
      const gapMinutes = (eventStart.getTime() - currentTime.getTime()) / 60000;

      if (gapMinutes >= durationMinutes) {
        slots.push({
          start: new Date(currentTime),
          end: new Date(currentTime.getTime() + durationMinutes * 60000),
        });
      }

      currentTime = event.end > currentTime ? event.end : currentTime;
    }

    // Check for slot at end of day
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
  // Sync Operations
  // --------------------------------------------------------------------------

  /**
   * Full sync with Google Calendar
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
    console.log('[GoogleCalendar] Starting sync');

    try {
      // Fetch calendars if not already loaded
      if (this.calendars.length === 0) {
        await this.fetchCalendars();
      }

      // Fetch events
      const events = await this.fetchEvents();

      // Detect conflicts
      const conflicts = this.detectConflicts(events);

      // Store last sync time
      await SecureStore.setItemAsync(
        STORAGE_KEYS.LAST_SYNC,
        new Date().toISOString()
      );

      const result: SyncResult = {
        success: true,
        events_fetched: events.length,
        events_created: 0,
        conflicts_detected: conflicts.length,
        last_sync: new Date(),
      };

      console.log('[GoogleCalendar] Sync completed:', result);
      return result;
    } catch (error) {
      console.error('[GoogleCalendar] Sync failed:', error);
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
  // Status and Getters
  // --------------------------------------------------------------------------

  getStatus(): IntegrationStatus {
    return this.status;
  }

  getCalendars(): Calendar[] {
    return this.calendars;
  }

  getEvents(): CalendarEvent[] {
    return this.events;
  }

  getConfig(): IntegrationConfig {
    return GOOGLE_CALENDAR_CONFIG;
  }

  async isConnected(): Promise<boolean> {
    const token = await this.tokenStorage.getAccessToken();
    return !!token && this.status !== 'disconnected';
  }

  async getLastSyncTime(): Promise<Date | null> {
    const lastSync = await SecureStore.getItemAsync(STORAGE_KEYS.LAST_SYNC);
    return lastSync ? new Date(lastSync) : null;
  }
}

// ============================================================================
// SINGLETON & EXPORTS
// ============================================================================

export const googleCalendarService = new GoogleCalendarService();

export {
  GoogleCalendarService,
  SecureTokenStorage,
  GOOGLE_CALENDAR_CONFIG,
  STORAGE_KEYS,
};

export default googleCalendarService;
