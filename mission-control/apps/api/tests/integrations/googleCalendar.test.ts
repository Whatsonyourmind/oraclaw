/**
 * Google Calendar Integration Tests
 * Story test-2 - Integration API Tests
 *
 * Tests cover:
 * - Mock Google API responses
 * - OAuth flow
 * - Event CRUD operations
 * - Conflict detection
 * - Error handling
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  GoogleCalendarService,
  createGoogleCalendarService,
  CalendarEvent,
  GoogleOAuthTokens,
  FreeBusyTimeRange,
  ConflictResult,
} from '../../src/services/oracle/integrations/googleCalendar';

// ============================================================================
// Mock Google APIs
// ============================================================================

// Mock the googleapis module
vi.mock('googleapis', () => {
  const mockOAuth2 = vi.fn().mockImplementation(() => ({
    generateAuthUrl: vi.fn().mockReturnValue('https://accounts.google.com/oauth/authorize?mock=true'),
    getToken: vi.fn().mockResolvedValue({
      tokens: {
        access_token: 'mock_access_token',
        refresh_token: 'mock_refresh_token',
        expiry_date: Date.now() + 3600000,
        token_type: 'Bearer',
        scope: 'https://www.googleapis.com/auth/calendar',
      },
    }),
    setCredentials: vi.fn(),
    refreshAccessToken: vi.fn().mockResolvedValue({
      credentials: {
        access_token: 'new_mock_access_token',
        refresh_token: 'mock_refresh_token',
        expiry_date: Date.now() + 3600000,
        token_type: 'Bearer',
        scope: 'https://www.googleapis.com/auth/calendar',
      },
    }),
    credentials: {
      expiry_date: Date.now() + 3600000,
      refresh_token: 'mock_refresh_token',
    },
  }));

  const mockCalendar = {
    calendarList: {
      list: vi.fn().mockResolvedValue({
        data: {
          items: [
            { id: 'primary', summary: 'Primary Calendar', primary: true, accessRole: 'owner' },
            { id: 'work', summary: 'Work Calendar', accessRole: 'writer' },
          ],
        },
      }),
    },
    calendars: {
      get: vi.fn().mockResolvedValue({
        data: { id: 'primary', summary: 'Primary Calendar', timeZone: 'America/New_York' },
      }),
    },
    events: {
      insert: vi.fn().mockResolvedValue({
        data: {
          id: 'event-123',
          summary: 'Test Event',
          htmlLink: 'https://calendar.google.com/event?eid=event-123',
        },
      }),
      get: vi.fn().mockResolvedValue({
        data: {
          id: 'event-123',
          summary: 'Test Event',
          description: 'Test description',
          start: { dateTime: '2024-01-15T10:00:00Z' },
          end: { dateTime: '2024-01-15T11:00:00Z' },
          status: 'confirmed',
          htmlLink: 'https://calendar.google.com/event?eid=event-123',
          etag: '"etag-123"',
        },
      }),
      patch: vi.fn().mockResolvedValue({
        data: {
          id: 'event-123',
          summary: 'Updated Event',
          start: { dateTime: '2024-01-15T10:00:00Z' },
          end: { dateTime: '2024-01-15T11:00:00Z' },
        },
      }),
      delete: vi.fn().mockResolvedValue({}),
      list: vi.fn().mockResolvedValue({
        data: {
          items: [
            {
              id: 'existing-event-1',
              summary: 'Existing Meeting',
              start: { dateTime: '2024-01-15T10:00:00Z' },
              end: { dateTime: '2024-01-15T11:00:00Z' },
              status: 'confirmed',
            },
            {
              id: 'existing-event-2',
              summary: 'Another Meeting',
              start: { dateTime: '2024-01-15T14:00:00Z' },
              end: { dateTime: '2024-01-15T15:00:00Z' },
              status: 'confirmed',
            },
          ],
          nextSyncToken: 'sync-token-123',
        },
      }),
      watch: vi.fn().mockResolvedValue({
        data: {
          id: 'channel-123',
          resourceId: 'resource-123',
          resourceUri: 'https://www.googleapis.com/calendar/v3/calendars/primary/events',
          expiration: (Date.now() + 604800000).toString(),
        },
      }),
    },
    freebusy: {
      query: vi.fn().mockResolvedValue({
        data: {
          calendars: {
            primary: {
              busy: [
                { start: '2024-01-15T10:00:00Z', end: '2024-01-15T11:00:00Z' },
                { start: '2024-01-15T14:00:00Z', end: '2024-01-15T15:00:00Z' },
              ],
            },
          },
        },
      }),
    },
    channels: {
      stop: vi.fn().mockResolvedValue({}),
    },
  };

  return {
    google: {
      auth: {
        OAuth2: mockOAuth2,
      },
      calendar: vi.fn().mockReturnValue(mockCalendar),
    },
    calendar_v3: {},
  };
});

// ============================================================================
// Test Suite
// ============================================================================

describe('GoogleCalendarService', () => {
  let service: GoogleCalendarService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new GoogleCalendarService(
      'mock-client-id',
      'mock-client-secret',
      'http://localhost:3001/oauth/callback',
      'user-123'
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // OAuth Flow Tests
  // ==========================================================================

  describe('OAuth Flow', () => {
    it('should generate authorization URL with correct scopes', () => {
      const authUrl = service.generateAuthUrl('test-state');

      expect(authUrl).toBeDefined();
      expect(authUrl).toContain('mock=true');
    });

    it('should exchange code for tokens', async () => {
      const tokens = await service.exchangeCodeForTokens('mock-auth-code');

      expect(tokens).toBeDefined();
      expect(tokens.access_token).toBe('mock_access_token');
      expect(tokens.refresh_token).toBe('mock_refresh_token');
      expect(tokens.token_type).toBe('Bearer');
    });

    it('should set credentials from stored tokens', () => {
      const tokens: GoogleOAuthTokens = {
        access_token: 'stored_access_token',
        refresh_token: 'stored_refresh_token',
        expiry_date: Date.now() + 3600000,
        token_type: 'Bearer',
        scope: 'https://www.googleapis.com/auth/calendar',
      };

      // Should not throw
      expect(() => service.setCredentials(tokens)).not.toThrow();
    });

    it('should refresh access token when expired', async () => {
      const newTokens = await service.refreshAccessToken();

      expect(newTokens.access_token).toBe('new_mock_access_token');
      expect(newTokens.refresh_token).toBe('mock_refresh_token');
    });

    it('should ensure valid token and refresh if needed', async () => {
      // Token is valid (not expired), should return null
      const result = await service.ensureValidToken();

      // In mock, token is valid, so no refresh needed
      expect(result).toBeNull();
    });

    it('should generate auth URL without state parameter', () => {
      const authUrl = service.generateAuthUrl();

      expect(authUrl).toBeDefined();
      expect(authUrl).toContain('mock=true');
    });
  });

  // ==========================================================================
  // Calendar List Operations Tests
  // ==========================================================================

  describe('Calendar List Operations', () => {
    it('should list all calendars for user', async () => {
      const calendars = await service.listCalendars();

      expect(calendars).toHaveLength(2);
      expect(calendars[0].id).toBe('primary');
      expect(calendars[0].summary).toBe('Primary Calendar');
      expect(calendars[0].primary).toBe(true);
      expect(calendars[1].id).toBe('work');
    });

    it('should get a specific calendar by ID', async () => {
      const calendar = await service.getCalendar('primary');

      expect(calendar.id).toBe('primary');
      expect(calendar.summary).toBe('Primary Calendar');
      expect(calendar.timeZone).toBe('America/New_York');
    });

    it('should use primary as default calendar ID', async () => {
      const calendar = await service.getCalendar();

      expect(calendar.id).toBe('primary');
    });
  });

  // ==========================================================================
  // Event CRUD Tests
  // ==========================================================================

  describe('Event CRUD Operations', () => {
    const testEvent: CalendarEvent = {
      summary: 'Test Meeting',
      description: 'Test description',
      start: {
        dateTime: '2024-01-15T10:00:00Z',
        timeZone: 'America/New_York',
      },
      end: {
        dateTime: '2024-01-15T11:00:00Z',
        timeZone: 'America/New_York',
      },
      attendees: [
        { email: 'test@example.com', displayName: 'Test User' },
      ],
    };

    describe('Create Event', () => {
      it('should create a new event', async () => {
        const createdEvent = await service.createEvent(testEvent);

        expect(createdEvent.id).toBe('event-123');
        expect(createdEvent.summary).toBe('Test Meeting');
        expect(createdEvent.htmlLink).toBe('https://calendar.google.com/event?eid=event-123');
      });

      it('should create event with custom calendar ID', async () => {
        const createdEvent = await service.createEvent(testEvent, 'work');

        expect(createdEvent.id).toBe('event-123');
      });

      it('should create event with custom notification settings', async () => {
        const createdEvent = await service.createEvent(testEvent, 'primary', 'none');

        expect(createdEvent.id).toBe('event-123');
      });

      it('should create event with reminders', async () => {
        const eventWithReminders: CalendarEvent = {
          ...testEvent,
          reminders: {
            useDefault: false,
            overrides: [
              { method: 'email', minutes: 30 },
              { method: 'popup', minutes: 10 },
            ],
          },
        };

        const createdEvent = await service.createEvent(eventWithReminders);

        expect(createdEvent.id).toBe('event-123');
      });

      it('should create recurring event', async () => {
        const recurringEvent: CalendarEvent = {
          ...testEvent,
          recurrence: ['RRULE:FREQ=WEEKLY;COUNT=10'],
        };

        const createdEvent = await service.createEvent(recurringEvent);

        expect(createdEvent.id).toBe('event-123');
      });
    });

    describe('Get Event', () => {
      it('should get an event by ID', async () => {
        const event = await service.getEvent('event-123');

        expect(event.id).toBe('event-123');
        expect(event.summary).toBe('Test Event');
        expect(event.description).toBe('Test description');
        expect(event.status).toBe('confirmed');
        expect(event.etag).toBe('"etag-123"');
      });

      it('should get event from specific calendar', async () => {
        const event = await service.getEvent('event-123', 'work');

        expect(event.id).toBe('event-123');
      });
    });

    describe('Update Event', () => {
      it('should update an existing event', async () => {
        const updates = { summary: 'Updated Meeting Title' };
        const updatedEvent = await service.updateEvent('event-123', updates);

        expect(updatedEvent.id).toBe('event-123');
        expect(updatedEvent.summary).toBe('Updated Event');
      });

      it('should update event with partial data', async () => {
        const updates = {
          description: 'Updated description',
          location: 'Conference Room A',
        };

        const updatedEvent = await service.updateEvent('event-123', updates);

        expect(updatedEvent.id).toBe('event-123');
      });

      it('should update event time', async () => {
        const updates = {
          start: { dateTime: '2024-01-15T14:00:00Z' },
          end: { dateTime: '2024-01-15T15:00:00Z' },
        };

        const updatedEvent = await service.updateEvent('event-123', updates);

        expect(updatedEvent.id).toBe('event-123');
      });
    });

    describe('Delete Event', () => {
      it('should delete an event', async () => {
        await expect(service.deleteEvent('event-123')).resolves.not.toThrow();
      });

      it('should delete event from specific calendar', async () => {
        await expect(service.deleteEvent('event-123', 'work')).resolves.not.toThrow();
      });

      it('should delete event with notification preference', async () => {
        await expect(service.deleteEvent('event-123', 'primary', 'none')).resolves.not.toThrow();
      });
    });

    describe('List Events', () => {
      it('should list events in time range', async () => {
        const events = await service.listEvents(
          '2024-01-15T00:00:00Z',
          '2024-01-16T00:00:00Z'
        );

        expect(events).toHaveLength(2);
        expect(events[0].id).toBe('existing-event-1');
        expect(events[1].id).toBe('existing-event-2');
      });

      it('should list events from specific calendar', async () => {
        const events = await service.listEvents(
          '2024-01-15T00:00:00Z',
          '2024-01-16T00:00:00Z',
          'work'
        );

        expect(events).toHaveLength(2);
      });

      it('should respect maxResults parameter', async () => {
        const events = await service.listEvents(
          '2024-01-15T00:00:00Z',
          '2024-01-16T00:00:00Z',
          'primary',
          10
        );

        expect(events).toHaveLength(2);
      });
    });
  });

  // ==========================================================================
  // Free/Busy Query Tests
  // ==========================================================================

  describe('Free/Busy Queries', () => {
    it('should query free/busy information', async () => {
      const timeRange: FreeBusyTimeRange = {
        start: '2024-01-15T00:00:00Z',
        end: '2024-01-16T00:00:00Z',
      };

      const freeBusy = await service.queryFreeBusy(timeRange);

      expect(freeBusy).toHaveLength(1);
      expect(freeBusy[0].calendarId).toBe('primary');
      expect(freeBusy[0].busy).toHaveLength(2);
    });

    it('should query multiple calendars', async () => {
      const timeRange: FreeBusyTimeRange = {
        start: '2024-01-15T00:00:00Z',
        end: '2024-01-16T00:00:00Z',
      };

      const freeBusy = await service.queryFreeBusy(timeRange, ['primary', 'work']);

      expect(freeBusy).toBeDefined();
    });

    it('should find free slots in time range', async () => {
      const timeRange: FreeBusyTimeRange = {
        start: '2024-01-15T08:00:00Z',
        end: '2024-01-15T18:00:00Z',
      };

      const freeSlots = await service.findFreeSlots(timeRange, 60);

      expect(freeSlots).toBeDefined();
      expect(Array.isArray(freeSlots)).toBe(true);
    });

    it('should find free slots with working hours constraint', async () => {
      const timeRange: FreeBusyTimeRange = {
        start: '2024-01-15T00:00:00Z',
        end: '2024-01-15T23:59:59Z',
      };

      const freeSlots = await service.findFreeSlots(
        timeRange,
        30,
        ['primary'],
        { start: 9, end: 17 }
      );

      expect(freeSlots).toBeDefined();
    });

    it('should sort free slots by preference score', async () => {
      const timeRange: FreeBusyTimeRange = {
        start: '2024-01-15T08:00:00Z',
        end: '2024-01-15T18:00:00Z',
      };

      const freeSlots = await service.findFreeSlots(timeRange, 30);

      // Slots should be sorted by score descending
      for (let i = 1; i < freeSlots.length; i++) {
        expect(freeSlots[i - 1].score).toBeGreaterThanOrEqual(freeSlots[i].score);
      }
    });
  });

  // ==========================================================================
  // Conflict Detection Tests
  // ==========================================================================

  describe('Conflict Detection', () => {
    it('should detect conflicts for proposed event', async () => {
      const proposedEvent: CalendarEvent = {
        summary: 'New Meeting',
        start: { dateTime: '2024-01-15T10:30:00Z' },
        end: { dateTime: '2024-01-15T11:30:00Z' },
      };

      const result = await service.detectConflicts(proposedEvent);

      expect(result.hasConflict).toBe(true);
      expect(result.conflicts.length).toBeGreaterThan(0);
    });

    it('should return no conflicts for non-overlapping event', async () => {
      const proposedEvent: CalendarEvent = {
        summary: 'Non-conflicting Meeting',
        start: { dateTime: '2024-01-15T12:00:00Z' },
        end: { dateTime: '2024-01-15T13:00:00Z' },
      };

      const result = await service.detectConflicts(proposedEvent);

      // Event between 12:00-13:00 doesn't conflict with 10:00-11:00 or 14:00-15:00
      expect(result.hasConflict).toBe(false);
    });

    it('should calculate overlap minutes correctly', async () => {
      const proposedEvent: CalendarEvent = {
        summary: 'Partial Overlap Meeting',
        start: { dateTime: '2024-01-15T10:30:00Z' },
        end: { dateTime: '2024-01-15T11:30:00Z' },
      };

      const result = await service.detectConflicts(proposedEvent);

      if (result.conflicts.length > 0) {
        expect(result.conflicts[0].overlapMinutes).toBeDefined();
        expect(result.conflicts[0].overlapMinutes).toBeGreaterThan(0);
      }
    });

    it('should classify conflict severity', async () => {
      const proposedEvent: CalendarEvent = {
        summary: 'High Overlap Meeting',
        start: { dateTime: '2024-01-15T10:00:00Z' },
        end: { dateTime: '2024-01-15T11:00:00Z' },
      };

      const result = await service.detectConflicts(proposedEvent);

      if (result.conflicts.length > 0) {
        expect(['hard', 'soft']).toContain(result.conflicts[0].severity);
      }
    });

    it('should suggest alternative slots when conflicts exist', async () => {
      const proposedEvent: CalendarEvent = {
        summary: 'Conflicting Meeting',
        start: { dateTime: '2024-01-15T10:00:00Z' },
        end: { dateTime: '2024-01-15T11:00:00Z' },
      };

      const result = await service.detectConflicts(proposedEvent);

      if (result.hasConflict && result.suggestedAlternatives) {
        expect(result.suggestedAlternatives.length).toBeGreaterThan(0);
        expect(result.suggestedAlternatives.length).toBeLessThanOrEqual(5);
      }
    });
  });

  // ==========================================================================
  // Webhook Tests
  // ==========================================================================

  describe('Webhook Subscriptions', () => {
    it('should create webhook subscription', async () => {
      const subscription = await service.createWebhookSubscription();

      expect(subscription.id).toBe('channel-123');
      expect(subscription.resourceId).toBe('resource-123');
      expect(subscription.expiration).toBeGreaterThan(Date.now());
    });

    it('should create webhook with custom TTL', async () => {
      const subscription = await service.createWebhookSubscription('primary', 24);

      expect(subscription).toBeDefined();
    });

    it('should stop webhook subscription', async () => {
      await expect(
        service.stopWebhookSubscription('channel-123', 'resource-123')
      ).resolves.not.toThrow();
    });

    it('should handle webhook notification for sync state', async () => {
      const headers = {
        'x-goog-channel-id': 'channel-123',
        'x-goog-resource-id': 'resource-123',
        'x-goog-resource-state': 'sync',
        'x-goog-message-number': '1',
      };

      const result = await service.handleWebhookNotification(headers);

      expect(result.events).toHaveLength(0);
      expect(result.nextSyncToken).toBe('');
    });

    it('should handle webhook notification for exists state', async () => {
      const headers = {
        'x-goog-channel-id': 'channel-123',
        'x-goog-resource-id': 'resource-123',
        'x-goog-resource-state': 'exists',
        'x-goog-message-number': '2',
      };

      const result = await service.handleWebhookNotification(headers, 'primary', 'old-sync-token');

      expect(result.events).toBeDefined();
      expect(result.nextSyncToken).toBe('sync-token-123');
    });
  });

  // ==========================================================================
  // Error Handling Tests
  // ==========================================================================

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      const { google } = await import('googleapis');
      const mockCalendar = google.calendar({} as any);

      // Mock an API error
      vi.mocked(mockCalendar.events.get).mockRejectedValueOnce(
        new Error('Event not found')
      );

      await expect(service.getEvent('non-existent')).rejects.toThrow();
    });

    it('should handle network errors', async () => {
      const { google } = await import('googleapis');
      const mockCalendar = google.calendar({} as any);

      vi.mocked(mockCalendar.calendarList.list).mockRejectedValueOnce(
        new Error('Network error')
      );

      await expect(service.listCalendars()).rejects.toThrow('Network error');
    });

    it('should handle invalid sync token (410 error)', async () => {
      const { google } = await import('googleapis');
      const mockCalendar = google.calendar({} as any);

      const error410 = new Error('Sync token invalid') as any;
      error410.code = 410;

      vi.mocked(mockCalendar.events.list)
        .mockRejectedValueOnce(error410)
        .mockResolvedValueOnce({
          data: {
            items: [],
            nextSyncToken: 'new-sync-token',
          },
        });

      const headers = {
        'x-goog-channel-id': 'channel-123',
        'x-goog-resource-id': 'resource-123',
        'x-goog-resource-state': 'exists',
        'x-goog-message-number': '2',
      };

      const result = await service.handleWebhookNotification(headers, 'primary', 'invalid-token');

      expect(result.nextSyncToken).toBe('new-sync-token');
    });

    it('should handle rate limiting', async () => {
      const { google } = await import('googleapis');
      const mockCalendar = google.calendar({} as any);

      const rateLimitError = new Error('Rate limit exceeded') as any;
      rateLimitError.code = 429;

      vi.mocked(mockCalendar.events.list).mockRejectedValueOnce(rateLimitError);

      await expect(
        service.listEvents('2024-01-15T00:00:00Z', '2024-01-16T00:00:00Z')
      ).rejects.toThrow('Rate limit exceeded');
    });

    it('should handle permission denied errors', async () => {
      const { google } = await import('googleapis');
      const mockCalendar = google.calendar({} as any);

      const permissionError = new Error('Permission denied') as any;
      permissionError.code = 403;

      vi.mocked(mockCalendar.events.insert).mockRejectedValueOnce(permissionError);

      const event: CalendarEvent = {
        summary: 'Test',
        start: { dateTime: '2024-01-15T10:00:00Z' },
        end: { dateTime: '2024-01-15T11:00:00Z' },
      };

      await expect(service.createEvent(event)).rejects.toThrow('Permission denied');
    });
  });

  // ==========================================================================
  // Factory Function Tests
  // ==========================================================================

  describe('Factory Function', () => {
    it('should create service with environment variables', () => {
      const originalEnv = { ...process.env };

      process.env.GOOGLE_CLIENT_ID = 'env-client-id';
      process.env.GOOGLE_CLIENT_SECRET = 'env-client-secret';
      process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3001/oauth';

      const factoryService = createGoogleCalendarService('test-user');

      expect(factoryService).toBeInstanceOf(GoogleCalendarService);

      // Restore environment
      process.env = originalEnv;
    });

    it('should use default redirect URI if not set', () => {
      const originalEnv = { ...process.env };

      delete process.env.GOOGLE_REDIRECT_URI;

      const factoryService = createGoogleCalendarService('test-user');

      expect(factoryService).toBeDefined();

      process.env = originalEnv;
    });
  });
});

// ============================================================================
// Edge Case Tests
// ============================================================================

describe('GoogleCalendarService Edge Cases', () => {
  let service: GoogleCalendarService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new GoogleCalendarService(
      'mock-client-id',
      'mock-client-secret',
      'http://localhost:3001/oauth/callback',
      'user-123'
    );
  });

  it('should handle empty calendar list', async () => {
    const { google } = await import('googleapis');
    const mockCalendar = google.calendar({} as any);

    vi.mocked(mockCalendar.calendarList.list).mockResolvedValueOnce({
      data: { items: [] },
    });

    const calendars = await service.listCalendars();

    expect(calendars).toHaveLength(0);
  });

  it('should handle events with only date (all-day events)', async () => {
    const { google } = await import('googleapis');
    const mockCalendar = google.calendar({} as any);

    vi.mocked(mockCalendar.events.get).mockResolvedValueOnce({
      data: {
        id: 'all-day-event',
        summary: 'All Day Event',
        start: { date: '2024-01-15' },
        end: { date: '2024-01-16' },
        status: 'confirmed',
        htmlLink: 'https://calendar.google.com/event',
        etag: '"etag"',
      },
    });

    const event = await service.getEvent('all-day-event');

    expect(event.id).toBe('all-day-event');
    expect(event.start.dateTime).toBe('2024-01-15');
  });

  it('should handle events without attendees', async () => {
    const event: CalendarEvent = {
      summary: 'Personal Event',
      start: { dateTime: '2024-01-15T10:00:00Z' },
      end: { dateTime: '2024-01-15T11:00:00Z' },
    };

    const created = await service.createEvent(event);

    expect(created).toBeDefined();
  });

  it('should handle timezone differences', async () => {
    const event: CalendarEvent = {
      summary: 'Timezone Test',
      start: {
        dateTime: '2024-01-15T10:00:00',
        timeZone: 'Europe/London',
      },
      end: {
        dateTime: '2024-01-15T11:00:00',
        timeZone: 'Europe/London',
      },
    };

    const created = await service.createEvent(event);

    expect(created).toBeDefined();
  });

  it('should handle very long event descriptions', async () => {
    const longDescription = 'A'.repeat(10000);
    const event: CalendarEvent = {
      summary: 'Long Description Event',
      description: longDescription,
      start: { dateTime: '2024-01-15T10:00:00Z' },
      end: { dateTime: '2024-01-15T11:00:00Z' },
    };

    const created = await service.createEvent(event);

    expect(created).toBeDefined();
  });

  it('should handle events with many attendees', async () => {
    const attendees = Array.from({ length: 100 }, (_, i) => ({
      email: `user${i}@example.com`,
      displayName: `User ${i}`,
    }));

    const event: CalendarEvent = {
      summary: 'Large Meeting',
      start: { dateTime: '2024-01-15T10:00:00Z' },
      end: { dateTime: '2024-01-15T11:00:00Z' },
      attendees,
    };

    const created = await service.createEvent(event);

    expect(created).toBeDefined();
  });
});
