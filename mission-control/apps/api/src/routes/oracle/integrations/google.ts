/**
 * Google Calendar Integration Routes for ORACLE v2.0
 *
 * Provides OAuth callback handling, calendar listing, event management,
 * and free/busy queries.
 *
 * @module routes/oracle/integrations/google
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  GoogleCalendarService,
  createGoogleCalendarService,
  CalendarEvent,
  GoogleOAuthTokens,
} from '../../../services/oracle/integrations/googleCalendar';

// ============================================================================
// Type Definitions
// ============================================================================

interface OAuthCallbackQuery {
  code: string;
  state?: string;
  error?: string;
}

interface CalendarsQuery {
  user_id: string;
}

interface CreateEventBody {
  calendar_id?: string;
  summary: string;
  description?: string;
  location?: string;
  start: string;
  end: string;
  time_zone?: string;
  attendees?: Array<{ email: string; displayName?: string }>;
  send_updates?: 'all' | 'externalOnly' | 'none';
}

interface UpdateEventBody {
  calendar_id?: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: string;
  end?: string;
  time_zone?: string;
  send_updates?: 'all' | 'externalOnly' | 'none';
}

interface FreeBusyBody {
  calendar_ids?: string[];
  start: string;
  end: string;
  find_slots?: boolean;
  slot_duration_minutes?: number;
  working_hours?: { start: number; end: number };
}

interface ConflictCheckBody {
  calendar_id?: string;
  summary: string;
  start: string;
  end: string;
}

interface WebhookHeaders {
  'x-goog-channel-id': string;
  'x-goog-resource-id': string;
  'x-goog-resource-state': string;
  'x-goog-message-number': string;
}

// ============================================================================
// Mock Storage (Replace with database in production)
// ============================================================================

const tokenStore = new Map<string, GoogleOAuthTokens>();
const webhookStore = new Map<string, { channelId: string; resourceId: string; syncToken?: string }>();

// Helper to get mock user ID
const getMockUserId = (request: FastifyRequest): string => {
  return (request.query as any).user_id || 'mock-user-id';
};

// Helper to get service with stored credentials
const getAuthenticatedService = async (userId: string): Promise<GoogleCalendarService | null> => {
  const tokens = tokenStore.get(userId);
  if (!tokens) {
    return null;
  }

  const service = createGoogleCalendarService(userId);
  service.setCredentials(tokens);

  // Check if token needs refresh
  const newTokens = await service.ensureValidToken();
  if (newTokens) {
    tokenStore.set(userId, newTokens);
  }

  return service;
};

// ============================================================================
// Route Definitions
// ============================================================================

export async function googleIntegrationRoutes(fastify: FastifyInstance) {
  // ==========================================================================
  // OAuth Routes
  // ==========================================================================

  /**
   * GET /oauth/google/connect - Initiate OAuth flow
   *
   * Generates authorization URL and redirects user to Google consent screen.
   */
  fastify.get('/oauth/google/connect', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = getMockUserId(request);
      const service = createGoogleCalendarService(userId);

      const authUrl = service.generateAuthUrl(userId);

      // Redirect to Google OAuth
      reply.redirect(authUrl);
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({
        success: false,
        error: 'Failed to initiate OAuth flow',
      });
    }
  });

  /**
   * GET /oauth/google/callback - OAuth callback handler
   *
   * Exchanges authorization code for tokens and stores them.
   */
  fastify.get('/oauth/google/callback', async (
    request: FastifyRequest<{ Querystring: OAuthCallbackQuery }>,
    reply: FastifyReply
  ) => {
    try {
      const { code, state, error } = request.query;

      if (error) {
        fastify.log.error(`OAuth error: ${error}`);
        reply.code(400).send({
          success: false,
          error: `OAuth authorization denied: ${error}`,
        });
        return;
      }

      if (!code) {
        reply.code(400).send({
          success: false,
          error: 'No authorization code provided',
        });
        return;
      }

      const userId = state || 'mock-user-id';
      const service = createGoogleCalendarService(userId);

      // Exchange code for tokens
      const tokens = await service.exchangeCodeForTokens(code);

      // Store tokens (in production, encrypt and store in database)
      tokenStore.set(userId, tokens);

      // Get user's primary calendar to verify connection
      service.setCredentials(tokens);
      const calendar = await service.getCalendar('primary');

      // Optionally set up webhook for push notifications
      try {
        const webhook = await service.createWebhookSubscription('primary', 168);
        webhookStore.set(userId, {
          channelId: webhook.channelId,
          resourceId: webhook.resourceId,
        });
      } catch (webhookError) {
        fastify.log.warn('Failed to set up webhook, continuing without push notifications');
      }

      // Return success page or redirect
      reply.code(200).send({
        success: true,
        data: {
          message: 'Google Calendar connected successfully',
          calendar: {
            id: calendar.id,
            summary: calendar.summary,
            timeZone: calendar.timeZone,
          },
        },
      });
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({
        success: false,
        error: 'Failed to complete OAuth flow',
      });
    }
  });

  /**
   * POST /oauth/google/disconnect - Disconnect Google Calendar
   *
   * Revokes tokens and cleans up webhooks.
   */
  fastify.post('/oauth/google/disconnect', async (
    request: FastifyRequest<{ Body: { user_id?: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const userId = request.body.user_id || getMockUserId(request);

      // Clean up webhook if exists
      const webhook = webhookStore.get(userId);
      if (webhook) {
        try {
          const service = await getAuthenticatedService(userId);
          if (service) {
            await service.stopWebhookSubscription(webhook.channelId, webhook.resourceId);
          }
        } catch (e) {
          fastify.log.warn('Failed to stop webhook during disconnect');
        }
        webhookStore.delete(userId);
      }

      // Remove tokens
      tokenStore.delete(userId);

      reply.code(200).send({
        success: true,
        data: { disconnected: true },
      });
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({
        success: false,
        error: 'Failed to disconnect Google Calendar',
      });
    }
  });

  // ==========================================================================
  // Calendar List Routes
  // ==========================================================================

  /**
   * GET /api/integrations/google/calendars - List all calendars
   */
  fastify.get('/api/integrations/google/calendars', async (
    request: FastifyRequest<{ Querystring: CalendarsQuery }>,
    reply: FastifyReply
  ) => {
    try {
      const userId = getMockUserId(request);
      const service = await getAuthenticatedService(userId);

      if (!service) {
        reply.code(401).send({
          success: false,
          error: 'Google Calendar not connected. Please connect your account first.',
        });
        return;
      }

      const calendars = await service.listCalendars();

      reply.code(200).send({
        success: true,
        data: {
          calendars,
          count: calendars.length,
        },
      });
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({
        success: false,
        error: 'Failed to list calendars',
      });
    }
  });

  // ==========================================================================
  // Event Routes
  // ==========================================================================

  /**
   * GET /api/integrations/google/events - List events in range
   */
  fastify.get('/api/integrations/google/events', async (
    request: FastifyRequest<{
      Querystring: {
        user_id?: string;
        calendar_id?: string;
        start: string;
        end: string;
        max_results?: number;
      };
    }>,
    reply: FastifyReply
  ) => {
    try {
      const userId = getMockUserId(request);
      const { calendar_id, start, end, max_results } = request.query;

      const service = await getAuthenticatedService(userId);
      if (!service) {
        reply.code(401).send({
          success: false,
          error: 'Google Calendar not connected',
        });
        return;
      }

      const events = await service.listEvents(
        start,
        end,
        calendar_id || 'primary',
        max_results || 250
      );

      reply.code(200).send({
        success: true,
        data: {
          events,
          count: events.length,
        },
      });
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({
        success: false,
        error: 'Failed to list events',
      });
    }
  });

  /**
   * POST /api/integrations/google/events - Create a new event
   */
  fastify.post('/api/integrations/google/events', async (
    request: FastifyRequest<{ Body: CreateEventBody }>,
    reply: FastifyReply
  ) => {
    try {
      const userId = getMockUserId(request);
      const {
        calendar_id,
        summary,
        description,
        location,
        start,
        end,
        time_zone,
        attendees,
        send_updates,
      } = request.body;

      const service = await getAuthenticatedService(userId);
      if (!service) {
        reply.code(401).send({
          success: false,
          error: 'Google Calendar not connected',
        });
        return;
      }

      const event: CalendarEvent = {
        summary,
        description,
        location,
        start: {
          dateTime: start,
          timeZone: time_zone,
        },
        end: {
          dateTime: end,
          timeZone: time_zone,
        },
        attendees,
      };

      // Check for conflicts first
      const conflicts = await service.detectConflicts(event, calendar_id || 'primary');

      if (conflicts.hasConflict) {
        reply.code(409).send({
          success: false,
          error: 'Event conflicts with existing events',
          data: {
            conflicts: conflicts.conflicts.map((c) => ({
              event_id: c.event.id,
              summary: c.event.summary,
              overlap_minutes: c.overlapMinutes,
              severity: c.severity,
            })),
            suggested_alternatives: conflicts.suggestedAlternatives,
          },
        });
        return;
      }

      const created = await service.createEvent(
        event,
        calendar_id || 'primary',
        send_updates || 'all'
      );

      reply.code(201).send({
        success: true,
        data: {
          event: created,
        },
      });
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({
        success: false,
        error: 'Failed to create event',
      });
    }
  });

  /**
   * PATCH /api/integrations/google/events/:event_id - Update an event
   */
  fastify.patch('/api/integrations/google/events/:event_id', async (
    request: FastifyRequest<{
      Params: { event_id: string };
      Body: UpdateEventBody;
    }>,
    reply: FastifyReply
  ) => {
    try {
      const userId = getMockUserId(request);
      const { event_id } = request.params;
      const {
        calendar_id,
        summary,
        description,
        location,
        start,
        end,
        time_zone,
        send_updates,
      } = request.body;

      const service = await getAuthenticatedService(userId);
      if (!service) {
        reply.code(401).send({
          success: false,
          error: 'Google Calendar not connected',
        });
        return;
      }

      const updates: Partial<CalendarEvent> = {};
      if (summary !== undefined) updates.summary = summary;
      if (description !== undefined) updates.description = description;
      if (location !== undefined) updates.location = location;
      if (start !== undefined) {
        updates.start = { dateTime: start, timeZone: time_zone };
      }
      if (end !== undefined) {
        updates.end = { dateTime: end, timeZone: time_zone };
      }

      const updated = await service.updateEvent(
        event_id,
        updates,
        calendar_id || 'primary',
        send_updates || 'all'
      );

      reply.code(200).send({
        success: true,
        data: { event: updated },
      });
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({
        success: false,
        error: 'Failed to update event',
      });
    }
  });

  /**
   * DELETE /api/integrations/google/events/:event_id - Delete an event
   */
  fastify.delete('/api/integrations/google/events/:event_id', async (
    request: FastifyRequest<{
      Params: { event_id: string };
      Querystring: { calendar_id?: string; send_updates?: string };
    }>,
    reply: FastifyReply
  ) => {
    try {
      const userId = getMockUserId(request);
      const { event_id } = request.params;
      const { calendar_id, send_updates } = request.query;

      const service = await getAuthenticatedService(userId);
      if (!service) {
        reply.code(401).send({
          success: false,
          error: 'Google Calendar not connected',
        });
        return;
      }

      await service.deleteEvent(
        event_id,
        calendar_id || 'primary',
        (send_updates as any) || 'all'
      );

      reply.code(200).send({
        success: true,
        data: { deleted: true, event_id },
      });
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({
        success: false,
        error: 'Failed to delete event',
      });
    }
  });

  // ==========================================================================
  // Free/Busy Routes
  // ==========================================================================

  /**
   * GET /api/integrations/google/freebusy - Query free/busy information
   */
  fastify.get('/api/integrations/google/freebusy', async (
    request: FastifyRequest<{
      Querystring: {
        user_id?: string;
        calendar_ids?: string;
        start: string;
        end: string;
      };
    }>,
    reply: FastifyReply
  ) => {
    try {
      const userId = getMockUserId(request);
      const { calendar_ids, start, end } = request.query;

      const service = await getAuthenticatedService(userId);
      if (!service) {
        reply.code(401).send({
          success: false,
          error: 'Google Calendar not connected',
        });
        return;
      }

      const calendarIdList = calendar_ids ? calendar_ids.split(',') : ['primary'];

      const freeBusy = await service.queryFreeBusy(
        { start, end },
        calendarIdList
      );

      reply.code(200).send({
        success: true,
        data: { calendars: freeBusy },
      });
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({
        success: false,
        error: 'Failed to query free/busy',
      });
    }
  });

  /**
   * POST /api/integrations/google/freebusy - Query with options
   */
  fastify.post('/api/integrations/google/freebusy', async (
    request: FastifyRequest<{ Body: FreeBusyBody }>,
    reply: FastifyReply
  ) => {
    try {
      const userId = getMockUserId(request);
      const {
        calendar_ids,
        start,
        end,
        find_slots,
        slot_duration_minutes,
        working_hours,
      } = request.body;

      const service = await getAuthenticatedService(userId);
      if (!service) {
        reply.code(401).send({
          success: false,
          error: 'Google Calendar not connected',
        });
        return;
      }

      const calendarIdList = calendar_ids || ['primary'];

      // Get free/busy info
      const freeBusy = await service.queryFreeBusy(
        { start, end },
        calendarIdList
      );

      let freeSlots = undefined;

      // Optionally find free slots
      if (find_slots && slot_duration_minutes) {
        freeSlots = await service.findFreeSlots(
          { start, end },
          slot_duration_minutes,
          calendarIdList,
          working_hours
        );
      }

      reply.code(200).send({
        success: true,
        data: {
          calendars: freeBusy,
          free_slots: freeSlots,
        },
      });
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({
        success: false,
        error: 'Failed to query free/busy',
      });
    }
  });

  // ==========================================================================
  // Conflict Detection Routes
  // ==========================================================================

  /**
   * POST /api/integrations/google/conflicts - Check for conflicts
   */
  fastify.post('/api/integrations/google/conflicts', async (
    request: FastifyRequest<{ Body: ConflictCheckBody }>,
    reply: FastifyReply
  ) => {
    try {
      const userId = getMockUserId(request);
      const { calendar_id, summary, start, end } = request.body;

      const service = await getAuthenticatedService(userId);
      if (!service) {
        reply.code(401).send({
          success: false,
          error: 'Google Calendar not connected',
        });
        return;
      }

      const event: CalendarEvent = {
        summary,
        start: { dateTime: start },
        end: { dateTime: end },
      };

      const conflicts = await service.detectConflicts(event, calendar_id || 'primary');

      reply.code(200).send({
        success: true,
        data: {
          has_conflict: conflicts.hasConflict,
          conflicts: conflicts.conflicts.map((c) => ({
            event_id: c.event.id,
            summary: c.event.summary,
            start: c.event.start.dateTime,
            end: c.event.end.dateTime,
            overlap_minutes: c.overlapMinutes,
            severity: c.severity,
          })),
          suggested_alternatives: conflicts.suggestedAlternatives,
        },
      });
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({
        success: false,
        error: 'Failed to check conflicts',
      });
    }
  });

  // ==========================================================================
  // Webhook Routes
  // ==========================================================================

  /**
   * POST /api/integrations/google/webhook - Handle push notifications
   */
  fastify.post('/api/integrations/google/webhook', async (
    request: FastifyRequest<{ Headers: WebhookHeaders }>,
    reply: FastifyReply
  ) => {
    try {
      const headers = request.headers as unknown as WebhookHeaders;

      const channelId = headers['x-goog-channel-id'];
      const resourceId = headers['x-goog-resource-id'];
      const resourceState = headers['x-goog-resource-state'];

      fastify.log.info(`Received webhook: channel=${channelId}, state=${resourceState}`);

      // Find user by channel ID
      let userId: string | null = null;
      let syncToken: string | undefined;

      for (const [uid, webhook] of webhookStore.entries()) {
        if (webhook.channelId === channelId) {
          userId = uid;
          syncToken = webhook.syncToken;
          break;
        }
      }

      if (!userId) {
        fastify.log.warn(`Unknown webhook channel: ${channelId}`);
        reply.code(200).send({ received: true });
        return;
      }

      const service = await getAuthenticatedService(userId);
      if (!service) {
        fastify.log.warn(`No service for user: ${userId}`);
        reply.code(200).send({ received: true });
        return;
      }

      // Process the notification
      const result = await service.handleWebhookNotification(
        {
          'x-goog-channel-id': channelId,
          'x-goog-resource-id': resourceId,
          'x-goog-resource-state': resourceState,
          'x-goog-message-number': headers['x-goog-message-number'],
        },
        'primary',
        syncToken
      );

      // Update sync token
      const webhook = webhookStore.get(userId);
      if (webhook && result.nextSyncToken) {
        webhookStore.set(userId, {
          ...webhook,
          syncToken: result.nextSyncToken,
        });
      }

      // Process changed events (in production, emit to event bus or queue)
      if (result.events.length > 0) {
        fastify.log.info(`Synced ${result.events.length} events for user ${userId}`);

        // Convert events to signals for ORACLE
        for (const event of result.events) {
          if (event.status === 'cancelled') {
            fastify.log.info(`Event deleted: ${event.id}`);
          } else {
            fastify.log.info(`Event synced: ${event.summary}`);
          }
        }
      }

      reply.code(200).send({ received: true, processed: result.events.length });
    } catch (error) {
      fastify.log.error(error);
      // Always return 200 to acknowledge receipt
      reply.code(200).send({ received: true, error: 'Processing failed' });
    }
  });

  /**
   * POST /api/integrations/google/webhook/subscribe - Create webhook subscription
   */
  fastify.post('/api/integrations/google/webhook/subscribe', async (
    request: FastifyRequest<{
      Body: { calendar_id?: string; ttl_hours?: number };
    }>,
    reply: FastifyReply
  ) => {
    try {
      const userId = getMockUserId(request);
      const { calendar_id, ttl_hours } = request.body;

      const service = await getAuthenticatedService(userId);
      if (!service) {
        reply.code(401).send({
          success: false,
          error: 'Google Calendar not connected',
        });
        return;
      }

      // Stop existing webhook if any
      const existingWebhook = webhookStore.get(userId);
      if (existingWebhook) {
        try {
          await service.stopWebhookSubscription(
            existingWebhook.channelId,
            existingWebhook.resourceId
          );
        } catch (e) {
          fastify.log.warn('Failed to stop existing webhook');
        }
      }

      // Create new subscription
      const subscription = await service.createWebhookSubscription(
        calendar_id || 'primary',
        ttl_hours || 168
      );

      webhookStore.set(userId, {
        channelId: subscription.channelId,
        resourceId: subscription.resourceId,
      });

      reply.code(201).send({
        success: true,
        data: {
          subscription_id: subscription.id,
          channel_id: subscription.channelId,
          expiration: new Date(subscription.expiration).toISOString(),
        },
      });
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({
        success: false,
        error: 'Failed to create webhook subscription',
      });
    }
  });

  /**
   * DELETE /api/integrations/google/webhook/unsubscribe - Remove webhook subscription
   */
  fastify.delete('/api/integrations/google/webhook/unsubscribe', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    try {
      const userId = getMockUserId(request);

      const webhook = webhookStore.get(userId);
      if (!webhook) {
        reply.code(404).send({
          success: false,
          error: 'No webhook subscription found',
        });
        return;
      }

      const service = await getAuthenticatedService(userId);
      if (service) {
        await service.stopWebhookSubscription(webhook.channelId, webhook.resourceId);
      }

      webhookStore.delete(userId);

      reply.code(200).send({
        success: true,
        data: { unsubscribed: true },
      });
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({
        success: false,
        error: 'Failed to remove webhook subscription',
      });
    }
  });
}

export default googleIntegrationRoutes;
