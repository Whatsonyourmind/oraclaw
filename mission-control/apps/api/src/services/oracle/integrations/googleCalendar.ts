/**
 * Google Calendar Integration Service for ORACLE v2.0
 *
 * Provides OAuth2 authentication, event CRUD operations, free/busy queries,
 * conflict detection, and webhook push notifications.
 *
 * @module services/oracle/integrations/googleCalendar
 */

// @ts-ignore - googleapis is an optional dependency
import { google, calendar_v3 } from 'googleapis';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * OAuth2 token data structure
 */
export interface GoogleOAuthTokens {
  access_token: string;
  refresh_token: string;
  expiry_date: number;
  token_type: string;
  scope: string;
}

/**
 * Calendar event structure
 */
export interface CalendarEvent {
  id?: string;
  summary: string;
  description?: string;
  location?: string;
  start: {
    dateTime: string;
    timeZone?: string;
  };
  end: {
    dateTime: string;
    timeZone?: string;
  };
  attendees?: Array<{
    email: string;
    displayName?: string;
    responseStatus?: 'needsAction' | 'declined' | 'tentative' | 'accepted';
    optional?: boolean;
  }>;
  reminders?: {
    useDefault: boolean;
    overrides?: Array<{
      method: 'email' | 'popup';
      minutes: number;
    }>;
  };
  recurrence?: string[];
  colorId?: string;
  status?: 'confirmed' | 'tentative' | 'cancelled';
}

/**
 * Free/busy query time range
 */
export interface FreeBusyTimeRange {
  start: string;
  end: string;
}

/**
 * Free/busy response for a single calendar
 */
export interface FreeBusyCalendar {
  calendarId: string;
  busy: Array<{
    start: string;
    end: string;
  }>;
  errors?: Array<{
    domain: string;
    reason: string;
  }>;
}

/**
 * Conflict detection result
 */
export interface ConflictResult {
  hasConflict: boolean;
  conflicts: Array<{
    event: CalendarEvent;
    overlapMinutes: number;
    severity: 'hard' | 'soft';
  }>;
  suggestedAlternatives?: Array<{
    start: string;
    end: string;
    score: number;
  }>;
}

/**
 * Webhook subscription data
 */
export interface WebhookSubscription {
  id: string;
  resourceId: string;
  resourceUri: string;
  channelId: string;
  expiration: number;
}

// ============================================================================
// Google Calendar Service Class
// ============================================================================

/**
 * GoogleCalendarService - Full integration with Google Calendar API
 *
 * Features:
 * - OAuth2 flow with automatic token refresh
 * - Event CRUD operations
 * - Free/busy queries
 * - Conflict detection with scoring algorithm
 * - Push notification webhooks
 *
 * Time Complexity:
 * - Most operations: O(1) API calls
 * - Conflict detection: O(n) where n = number of events in range
 * - Free slot finding: O(n * m) where n = busy periods, m = duration slots
 */
export class GoogleCalendarService {
  private oauth2Client: any;
  private calendar: calendar_v3.Calendar;
  private webhookBaseUrl: string;
  private userId: string;

  /**
   * Initialize the Google Calendar service
   *
   * @param clientId - Google OAuth client ID
   * @param clientSecret - Google OAuth client secret
   * @param redirectUri - OAuth redirect URI
   * @param userId - User ID for tracking
   */
  constructor(
    clientId: string,
    clientSecret: string,
    redirectUri: string,
    userId: string
  ) {
    this.oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    this.calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
    this.webhookBaseUrl = process.env.WEBHOOK_BASE_URL || 'https://api.example.com';
    this.userId = userId;
  }

  // ==========================================================================
  // OAuth2 Flow Methods
  // ==========================================================================

  /**
   * Generate OAuth2 authorization URL
   *
   * @param state - State parameter for CSRF protection
   * @returns Authorization URL
   */
  generateAuthUrl(state?: string): string {
    const scopes = [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/calendar.readonly',
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent',
      state: state || this.userId,
    });
  }

  /**
   * Exchange authorization code for tokens
   *
   * @param code - Authorization code from OAuth callback
   * @returns OAuth tokens
   */
  async exchangeCodeForTokens(code: string): Promise<GoogleOAuthTokens> {
    const { tokens } = await this.oauth2Client.getToken(code);
    this.oauth2Client.setCredentials(tokens);

    return {
      access_token: tokens.access_token!,
      refresh_token: tokens.refresh_token!,
      expiry_date: tokens.expiry_date!,
      token_type: tokens.token_type!,
      scope: tokens.scope!,
    };
  }

  /**
   * Set credentials from stored tokens
   *
   * @param tokens - Previously stored OAuth tokens
   */
  setCredentials(tokens: GoogleOAuthTokens): void {
    this.oauth2Client.setCredentials({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry_date: tokens.expiry_date,
    });
  }

  /**
   * Refresh access token using refresh token
   *
   * @returns New OAuth tokens
   */
  async refreshAccessToken(): Promise<GoogleOAuthTokens> {
    const { credentials } = await this.oauth2Client.refreshAccessToken();

    return {
      access_token: credentials.access_token!,
      refresh_token: credentials.refresh_token || this.oauth2Client.credentials.refresh_token,
      expiry_date: credentials.expiry_date!,
      token_type: credentials.token_type!,
      scope: credentials.scope!,
    };
  }

  /**
   * Check if tokens are expired and refresh if needed
   *
   * @returns Updated tokens if refreshed, null otherwise
   */
  async ensureValidToken(): Promise<GoogleOAuthTokens | null> {
    const expiry = this.oauth2Client.credentials.expiry_date;
    const now = Date.now();

    // Refresh if token expires in less than 5 minutes
    if (expiry && expiry - now < 5 * 60 * 1000) {
      return this.refreshAccessToken();
    }

    return null;
  }

  // ==========================================================================
  // Calendar List Operations
  // ==========================================================================

  /**
   * List all calendars for the user
   *
   * @returns Array of calendar metadata
   */
  async listCalendars(): Promise<Array<{
    id: string;
    summary: string;
    description?: string;
    primary?: boolean;
    accessRole: string;
    backgroundColor?: string;
    timeZone?: string;
  }>> {
    await this.ensureValidToken();

    const response = await this.calendar.calendarList.list();
    const calendars = response.data.items || [];

    return calendars.map((cal: any) => ({
      id: cal.id!,
      summary: cal.summary!,
      description: cal.description || undefined,
      primary: cal.primary || false,
      accessRole: cal.accessRole!,
      backgroundColor: cal.backgroundColor || undefined,
      timeZone: cal.timeZone || undefined,
    }));
  }

  /**
   * Get a specific calendar by ID
   *
   * @param calendarId - Calendar ID
   * @returns Calendar metadata
   */
  async getCalendar(calendarId: string = 'primary'): Promise<{
    id: string;
    summary: string;
    description?: string;
    timeZone: string;
  }> {
    await this.ensureValidToken();

    const response = await this.calendar.calendars.get({ calendarId });

    return {
      id: response.data.id!,
      summary: response.data.summary!,
      description: response.data.description || undefined,
      timeZone: response.data.timeZone!,
    };
  }

  // ==========================================================================
  // Event CRUD Operations
  // ==========================================================================

  /**
   * Create a new calendar event
   *
   * @param event - Event data
   * @param calendarId - Target calendar ID
   * @param sendUpdates - Notification preference
   * @returns Created event
   */
  async createEvent(
    event: CalendarEvent,
    calendarId: string = 'primary',
    sendUpdates: 'all' | 'externalOnly' | 'none' = 'all'
  ): Promise<CalendarEvent & { id: string; htmlLink: string }> {
    await this.ensureValidToken();

    const response = await this.calendar.events.insert({
      calendarId,
      sendUpdates,
      requestBody: {
        summary: event.summary,
        description: event.description,
        location: event.location,
        start: event.start,
        end: event.end,
        attendees: event.attendees,
        reminders: event.reminders,
        recurrence: event.recurrence,
        colorId: event.colorId,
        status: event.status,
      },
    });

    return {
      ...event,
      id: response.data.id!,
      htmlLink: response.data.htmlLink!,
    };
  }

  /**
   * Get a specific event by ID
   *
   * @param eventId - Event ID
   * @param calendarId - Calendar ID
   * @returns Event data
   */
  async getEvent(
    eventId: string,
    calendarId: string = 'primary'
  ): Promise<CalendarEvent & { id: string; htmlLink: string; etag: string }> {
    await this.ensureValidToken();

    const response = await this.calendar.events.get({
      calendarId,
      eventId,
    });

    const event = response.data;

    return {
      id: event.id!,
      summary: event.summary!,
      description: event.description || undefined,
      location: event.location || undefined,
      start: {
        dateTime: event.start?.dateTime || event.start?.date!,
        timeZone: event.start?.timeZone,
      },
      end: {
        dateTime: event.end?.dateTime || event.end?.date!,
        timeZone: event.end?.timeZone,
      },
      attendees: event.attendees?.map((a: any) => ({
        email: a.email!,
        displayName: a.displayName,
        responseStatus: a.responseStatus as any,
        optional: a.optional,
      })),
      status: event.status as any,
      htmlLink: event.htmlLink!,
      etag: event.etag!,
    };
  }

  /**
   * Update an existing event
   *
   * @param eventId - Event ID to update
   * @param updates - Partial event updates
   * @param calendarId - Calendar ID
   * @param sendUpdates - Notification preference
   * @returns Updated event
   */
  async updateEvent(
    eventId: string,
    updates: Partial<CalendarEvent>,
    calendarId: string = 'primary',
    sendUpdates: 'all' | 'externalOnly' | 'none' = 'all'
  ): Promise<CalendarEvent & { id: string }> {
    await this.ensureValidToken();

    // First get the existing event
    const existing = await this.getEvent(eventId, calendarId);

    const response = await this.calendar.events.patch({
      calendarId,
      eventId,
      sendUpdates,
      requestBody: {
        summary: updates.summary ?? existing.summary,
        description: updates.description ?? existing.description,
        location: updates.location ?? existing.location,
        start: updates.start ?? existing.start,
        end: updates.end ?? existing.end,
        attendees: updates.attendees ?? existing.attendees,
        reminders: updates.reminders,
        colorId: updates.colorId,
        status: updates.status,
      },
    });

    return {
      id: response.data.id!,
      summary: response.data.summary!,
      description: response.data.description || undefined,
      location: response.data.location || undefined,
      start: {
        dateTime: response.data.start?.dateTime || response.data.start?.date!,
        timeZone: response.data.start?.timeZone,
      },
      end: {
        dateTime: response.data.end?.dateTime || response.data.end?.date!,
        timeZone: response.data.end?.timeZone,
      },
    };
  }

  /**
   * Delete an event
   *
   * @param eventId - Event ID to delete
   * @param calendarId - Calendar ID
   * @param sendUpdates - Notification preference
   */
  async deleteEvent(
    eventId: string,
    calendarId: string = 'primary',
    sendUpdates: 'all' | 'externalOnly' | 'none' = 'all'
  ): Promise<void> {
    await this.ensureValidToken();

    await this.calendar.events.delete({
      calendarId,
      eventId,
      sendUpdates,
    });
  }

  /**
   * List events in a time range
   *
   * @param timeMin - Start of range (ISO string)
   * @param timeMax - End of range (ISO string)
   * @param calendarId - Calendar ID
   * @param maxResults - Maximum events to return
   * @returns Array of events
   */
  async listEvents(
    timeMin: string,
    timeMax: string,
    calendarId: string = 'primary',
    maxResults: number = 250
  ): Promise<Array<CalendarEvent & { id: string }>> {
    await this.ensureValidToken();

    const response = await this.calendar.events.list({
      calendarId,
      timeMin,
      timeMax,
      maxResults,
      singleEvents: true,
      orderBy: 'startTime',
    });

    const events = response.data.items || [];

    return events.map((event: any) => ({
      id: event.id!,
      summary: event.summary!,
      description: event.description || undefined,
      location: event.location || undefined,
      start: {
        dateTime: event.start?.dateTime || event.start?.date!,
        timeZone: event.start?.timeZone,
      },
      end: {
        dateTime: event.end?.dateTime || event.end?.date!,
        timeZone: event.end?.timeZone,
      },
      attendees: event.attendees?.map((a: any) => ({
        email: a.email!,
        displayName: a.displayName,
        responseStatus: a.responseStatus as any,
        optional: a.optional,
      })),
      status: event.status as any,
    }));
  }

  // ==========================================================================
  // Free/Busy Queries
  // ==========================================================================

  /**
   * Query free/busy information for one or more calendars
   *
   * @param timeRange - Time range to query
   * @param calendarIds - Calendar IDs to check
   * @returns Free/busy information per calendar
   */
  async queryFreeBusy(
    timeRange: FreeBusyTimeRange,
    calendarIds: string[] = ['primary']
  ): Promise<FreeBusyCalendar[]> {
    await this.ensureValidToken();

    const response = await this.calendar.freebusy.query({
      requestBody: {
        timeMin: timeRange.start,
        timeMax: timeRange.end,
        items: calendarIds.map((id) => ({ id })),
      },
    });

    const calendars = response.data.calendars || {};

    return Object.entries(calendars).map(([id, data]: [string, any]) => ({
      calendarId: id,
      busy: (data.busy || []).map((b: any) => ({
        start: b.start!,
        end: b.end!,
      })),
      errors: data.errors?.map((e: any) => ({
        domain: e.domain!,
        reason: e.reason!,
      })),
    }));
  }

  /**
   * Find free time slots in a given range
   *
   * @param timeRange - Time range to search
   * @param durationMinutes - Desired slot duration
   * @param calendarIds - Calendars to check
   * @param workingHours - Working hours constraint
   * @returns Available time slots sorted by preference
   *
   * Time Complexity: O(n * m) where n = busy periods, m = potential slots
   */
  async findFreeSlots(
    timeRange: FreeBusyTimeRange,
    durationMinutes: number,
    calendarIds: string[] = ['primary'],
    workingHours?: { start: number; end: number }
  ): Promise<Array<{ start: string; end: string; score: number }>> {
    const freeBusy = await this.queryFreeBusy(timeRange, calendarIds);

    // Merge all busy periods
    const allBusy: Array<{ start: Date; end: Date }> = [];
    for (const cal of freeBusy) {
      for (const busy of cal.busy) {
        allBusy.push({
          start: new Date(busy.start),
          end: new Date(busy.end),
        });
      }
    }

    // Sort and merge overlapping busy periods
    allBusy.sort((a, b) => a.start.getTime() - b.start.getTime());
    const mergedBusy: Array<{ start: Date; end: Date }> = [];

    for (const period of allBusy) {
      if (mergedBusy.length === 0) {
        mergedBusy.push(period);
      } else {
        const last = mergedBusy[mergedBusy.length - 1];
        if (period.start <= last.end) {
          last.end = new Date(Math.max(last.end.getTime(), period.end.getTime()));
        } else {
          mergedBusy.push(period);
        }
      }
    }

    // Find free slots between busy periods
    const slots: Array<{ start: string; end: string; score: number }> = [];
    const rangeStart = new Date(timeRange.start);
    const rangeEnd = new Date(timeRange.end);
    const durationMs = durationMinutes * 60 * 1000;

    let currentStart = rangeStart;

    for (const busy of mergedBusy) {
      // Check if there's a gap before this busy period
      const gapEnd = busy.start;
      const gapDuration = gapEnd.getTime() - currentStart.getTime();

      if (gapDuration >= durationMs) {
        // Add slots within this gap
        let slotStart = currentStart;
        while (slotStart.getTime() + durationMs <= gapEnd.getTime()) {
          const slotEnd = new Date(slotStart.getTime() + durationMs);

          // Check working hours if specified
          const hour = slotStart.getHours();
          const inWorkingHours = !workingHours ||
            (hour >= workingHours.start && hour < workingHours.end);

          if (inWorkingHours) {
            // Score based on time of day preference (morning higher)
            const score = this.calculateSlotScore(slotStart, slotEnd);
            slots.push({
              start: slotStart.toISOString(),
              end: slotEnd.toISOString(),
              score,
            });
          }

          // Move to next potential slot (30-minute increments)
          slotStart = new Date(slotStart.getTime() + 30 * 60 * 1000);
        }
      }

      currentStart = busy.end;
    }

    // Check gap after last busy period
    const finalGap = rangeEnd.getTime() - currentStart.getTime();
    if (finalGap >= durationMs) {
      let slotStart = currentStart;
      while (slotStart.getTime() + durationMs <= rangeEnd.getTime()) {
        const slotEnd = new Date(slotStart.getTime() + durationMs);

        const hour = slotStart.getHours();
        const inWorkingHours = !workingHours ||
          (hour >= workingHours.start && hour < workingHours.end);

        if (inWorkingHours) {
          const score = this.calculateSlotScore(slotStart, slotEnd);
          slots.push({
            start: slotStart.toISOString(),
            end: slotEnd.toISOString(),
            score,
          });
        }

        slotStart = new Date(slotStart.getTime() + 30 * 60 * 1000);
      }
    }

    // Sort by score (highest first)
    slots.sort((a, b) => b.score - a.score);

    return slots;
  }

  /**
   * Calculate preference score for a time slot
   *
   * @param start - Slot start time
   * @param end - Slot end time
   * @returns Score between 0 and 1
   */
  private calculateSlotScore(start: Date, end: Date): number {
    let score = 0.5;

    const hour = start.getHours();
    const dayOfWeek = start.getDay();

    // Prefer mid-morning (10-12) - highest productivity
    if (hour >= 10 && hour < 12) {
      score += 0.3;
    }
    // Early afternoon (14-16) - second best
    else if (hour >= 14 && hour < 16) {
      score += 0.2;
    }
    // Early morning (8-10) - good
    else if (hour >= 8 && hour < 10) {
      score += 0.1;
    }
    // Late afternoon (16-18) - less ideal
    else if (hour >= 16 && hour < 18) {
      score -= 0.1;
    }
    // Evening (18+) - least preferred
    else if (hour >= 18) {
      score -= 0.2;
    }

    // Prefer weekdays over weekends
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      score -= 0.2;
    }

    // Prefer Tuesday-Thursday (most productive)
    if (dayOfWeek >= 2 && dayOfWeek <= 4) {
      score += 0.1;
    }

    return Math.max(0, Math.min(1, score));
  }

  // ==========================================================================
  // Conflict Detection
  // ==========================================================================

  /**
   * Detect conflicts for a proposed event
   *
   * @param event - Proposed event
   * @param calendarId - Calendar to check
   * @returns Conflict analysis with suggestions
   *
   * Time Complexity: O(n) where n = events in range
   */
  async detectConflicts(
    event: CalendarEvent,
    calendarId: string = 'primary'
  ): Promise<ConflictResult> {
    await this.ensureValidToken();

    const proposedStart = new Date(event.start.dateTime);
    const proposedEnd = new Date(event.end.dateTime);

    // Query events in the same time range
    const existingEvents = await this.listEvents(
      event.start.dateTime,
      event.end.dateTime,
      calendarId
    );

    const conflicts: ConflictResult['conflicts'] = [];

    for (const existing of existingEvents) {
      const existingStart = new Date(existing.start.dateTime);
      const existingEnd = new Date(existing.end.dateTime);

      // Check for overlap
      const overlapStart = Math.max(proposedStart.getTime(), existingStart.getTime());
      const overlapEnd = Math.min(proposedEnd.getTime(), existingEnd.getTime());

      if (overlapStart < overlapEnd) {
        const overlapMinutes = (overlapEnd - overlapStart) / (60 * 1000);

        // Determine severity based on overlap percentage
        const proposedDuration = (proposedEnd.getTime() - proposedStart.getTime()) / (60 * 1000);
        const overlapPercentage = overlapMinutes / proposedDuration;

        conflicts.push({
          event: existing,
          overlapMinutes,
          severity: overlapPercentage > 0.5 ? 'hard' : 'soft',
        });
      }
    }

    // If conflicts exist, find alternative slots
    let suggestedAlternatives: ConflictResult['suggestedAlternatives'] = undefined;

    if (conflicts.length > 0) {
      const durationMinutes = (proposedEnd.getTime() - proposedStart.getTime()) / (60 * 1000);

      // Look for alternatives in the next 7 days
      const searchEnd = new Date(proposedStart);
      searchEnd.setDate(searchEnd.getDate() + 7);

      suggestedAlternatives = await this.findFreeSlots(
        {
          start: proposedStart.toISOString(),
          end: searchEnd.toISOString(),
        },
        durationMinutes,
        [calendarId],
        { start: 9, end: 18 }
      );

      // Return top 5 alternatives
      suggestedAlternatives = suggestedAlternatives.slice(0, 5);
    }

    return {
      hasConflict: conflicts.length > 0,
      conflicts,
      suggestedAlternatives,
    };
  }

  // ==========================================================================
  // Webhook Push Notifications
  // ==========================================================================

  /**
   * Create a webhook subscription for calendar changes
   *
   * @param calendarId - Calendar to watch
   * @param ttlHours - Subscription duration in hours
   * @returns Subscription details
   */
  async createWebhookSubscription(
    calendarId: string = 'primary',
    ttlHours: number = 168 // 1 week
  ): Promise<WebhookSubscription> {
    await this.ensureValidToken();

    const channelId = `oracle-${this.userId}-${Date.now()}`;
    const expiration = Date.now() + ttlHours * 60 * 60 * 1000;

    const response = await this.calendar.events.watch({
      calendarId,
      requestBody: {
        id: channelId,
        type: 'web_hook',
        address: `${this.webhookBaseUrl}/api/integrations/google/webhook`,
        expiration: expiration.toString(),
        params: {
          ttl: (ttlHours * 60 * 60).toString(),
        },
      },
    });

    return {
      id: response.data.id!,
      resourceId: response.data.resourceId!,
      resourceUri: response.data.resourceUri!,
      channelId,
      expiration: Number(response.data.expiration),
    };
  }

  /**
   * Stop a webhook subscription
   *
   * @param channelId - Channel ID to stop
   * @param resourceId - Resource ID to stop
   */
  async stopWebhookSubscription(
    channelId: string,
    resourceId: string
  ): Promise<void> {
    await this.ensureValidToken();

    await this.calendar.channels.stop({
      requestBody: {
        id: channelId,
        resourceId,
      },
    });
  }

  /**
   * Handle incoming webhook notification
   *
   * @param headers - Request headers from Google
   * @param calendarId - Calendar to sync
   * @returns Sync token and changed events
   */
  async handleWebhookNotification(
    headers: {
      'x-goog-channel-id': string;
      'x-goog-resource-id': string;
      'x-goog-resource-state': string;
      'x-goog-message-number': string;
    },
    calendarId: string = 'primary',
    syncToken?: string
  ): Promise<{
    events: Array<CalendarEvent & { id: string; status: string }>;
    nextSyncToken: string;
  }> {
    await this.ensureValidToken();

    const state = headers['x-goog-resource-state'];

    // Initial sync notification
    if (state === 'sync') {
      return {
        events: [],
        nextSyncToken: '',
      };
    }

    // Incremental sync
    const params: any = {
      calendarId,
      maxResults: 2500,
      singleEvents: true,
    };

    if (syncToken) {
      params.syncToken = syncToken;
    } else {
      // Full sync - get events from last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      params.timeMin = thirtyDaysAgo.toISOString();
    }

    try {
      const response = await this.calendar.events.list(params);

      const events = (response.data.items || []).map((event: any) => ({
        id: event.id!,
        summary: event.summary || '',
        description: event.description || undefined,
        location: event.location || undefined,
        start: {
          dateTime: event.start?.dateTime || event.start?.date!,
          timeZone: event.start?.timeZone,
        },
        end: {
          dateTime: event.end?.dateTime || event.end?.date!,
          timeZone: event.end?.timeZone,
        },
        status: event.status || 'confirmed',
      }));

      return {
        events,
        nextSyncToken: response.data.nextSyncToken || '',
      };
    } catch (error: any) {
      // If sync token is invalid, do full sync
      if (error.code === 410) {
        return this.handleWebhookNotification(headers, calendarId, undefined);
      }
      throw error;
    }
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a GoogleCalendarService instance
 *
 * @param userId - User ID
 * @returns Configured service instance
 */
export function createGoogleCalendarService(userId: string): GoogleCalendarService {
  const clientId = process.env.GOOGLE_CLIENT_ID || '';
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/oauth/google/callback';

  return new GoogleCalendarService(clientId, clientSecret, redirectUri, userId);
}

export default GoogleCalendarService;
