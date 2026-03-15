import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getUserId } from '../../services/auth/authMiddleware.js';
import type {
  Webhook,
  WebhookDelivery,
  WebhookEvent,
  WebhookEventType,
  WebhookTestResult,
  WebhookStats,
  APIResponse,
} from '@mission-control/shared-types';
import { oracleWebhookService } from '../../services/oracle/webhooks';

// Types for request bodies and params
interface WebhookCreateBody {
  name: string;
  description?: string;
  url: string;
  events: WebhookEventType[];
  headers?: Record<string, string>;
  retry_count?: number;
  retry_delay_seconds?: number;
  timeout_seconds?: number;
  metadata?: Record<string, any>;
}

interface WebhookUpdateBody {
  name?: string;
  description?: string;
  url?: string;
  events?: WebhookEventType[];
  headers?: Record<string, string>;
  is_active?: boolean;
  retry_count?: number;
  retry_delay_seconds?: number;
  timeout_seconds?: number;
}

interface DeliveryQuery {
  limit?: number;
  offset?: number;
}



export async function webhookRoutes(fastify: FastifyInstance) {
  // POST /api/oracle/webhooks - Register a new webhook
  fastify.post('/api/oracle/webhooks', async (request: FastifyRequest<{ Body: WebhookCreateBody }>, reply: FastifyReply) => {
    try {
      const userId = getUserId(request);
      const body = request.body;

      // Validate URL
      try {
        new URL(body.url);
      } catch {
        reply.code(400);
        return { success: false, error: 'Invalid webhook URL' };
      }

      // Validate events
      if (!body.events || body.events.length === 0) {
        reply.code(400);
        return { success: false, error: 'At least one event type is required' };
      }

      const webhook = await oracleWebhookService.registerWebhook({
        user_id: userId,
        name: body.name,
        description: body.description,
        url: body.url,
        events: body.events,
        headers: body.headers,
        retry_count: body.retry_count,
        retry_delay_seconds: body.retry_delay_seconds,
        timeout_seconds: body.timeout_seconds,
        metadata: body.metadata,
      });

      const response: APIResponse<Webhook> = {
        success: true,
        data: webhook,
      };

      reply.code(201);
      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to register webhook' };
    }
  });

  // GET /api/oracle/webhooks - List all webhooks
  fastify.get('/api/oracle/webhooks', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = getUserId(request);

      const webhooks = await oracleWebhookService.getUserWebhooks(userId);

      // Mask secrets in response
      const maskedWebhooks = webhooks.map((w) => ({
        ...w,
        secret: w.secret.substring(0, 8) + '...' + w.secret.substring(w.secret.length - 4),
      }));

      const response: APIResponse<Webhook[]> = {
        success: true,
        data: maskedWebhooks,
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to get webhooks' };
    }
  });

  // GET /api/oracle/webhooks/:id - Get single webhook
  fastify.get('/api/oracle/webhooks/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const userId = getUserId(request);
      const { id } = request.params;

      const webhook = await oracleWebhookService.getWebhook(id, userId);

      if (!webhook) {
        reply.code(404);
        return { success: false, error: 'Webhook not found' };
      }

      // Mask secret
      const maskedWebhook = {
        ...webhook,
        secret: webhook.secret.substring(0, 8) + '...' + webhook.secret.substring(webhook.secret.length - 4),
      };

      const response: APIResponse<Webhook> = {
        success: true,
        data: maskedWebhook,
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to get webhook' };
    }
  });

  // PATCH /api/oracle/webhooks/:id - Update webhook
  fastify.patch('/api/oracle/webhooks/:id', async (request: FastifyRequest<{ Params: { id: string }; Body: WebhookUpdateBody }>, reply: FastifyReply) => {
    try {
      const userId = getUserId(request);
      const { id } = request.params;
      const body = request.body;

      // Validate URL if provided
      if (body.url) {
        try {
          new URL(body.url);
        } catch {
          reply.code(400);
          return { success: false, error: 'Invalid webhook URL' };
        }
      }

      const webhook = await oracleWebhookService.updateWebhook(id, userId, body);

      if (!webhook) {
        reply.code(404);
        return { success: false, error: 'Webhook not found' };
      }

      const response: APIResponse<Webhook> = {
        success: true,
        data: webhook,
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to update webhook' };
    }
  });

  // DELETE /api/oracle/webhooks/:id - Delete webhook
  fastify.delete('/api/oracle/webhooks/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const userId = getUserId(request);
      const { id } = request.params;

      const deleted = await oracleWebhookService.deleteWebhook(id, userId);

      if (!deleted) {
        reply.code(404);
        return { success: false, error: 'Webhook not found' };
      }

      return { success: true };
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to delete webhook' };
    }
  });

  // POST /api/oracle/webhooks/:id/regenerate-secret - Regenerate webhook secret
  fastify.post('/api/oracle/webhooks/:id/regenerate-secret', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const userId = getUserId(request);
      const { id } = request.params;

      const newSecret = await oracleWebhookService.regenerateSecret(id, userId);

      if (!newSecret) {
        reply.code(404);
        return { success: false, error: 'Webhook not found' };
      }

      const response: APIResponse<{ secret: string }> = {
        success: true,
        data: { secret: newSecret },
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to regenerate secret' };
    }
  });

  // GET /api/oracle/webhooks/:id/deliveries - Get delivery history
  fastify.get('/api/oracle/webhooks/:id/deliveries', async (request: FastifyRequest<{ Params: { id: string }; Querystring: DeliveryQuery }>, reply: FastifyReply) => {
    try {
      const userId = getUserId(request);
      const { id } = request.params;
      const { limit = 50 } = request.query;

      const deliveries = await oracleWebhookService.getDeliveryHistory(id, userId, limit);

      const response: APIResponse<WebhookDelivery[]> = {
        success: true,
        data: deliveries,
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to get deliveries' };
    }
  });

  // GET /api/oracle/webhooks/:id/stats - Get webhook statistics
  fastify.get('/api/oracle/webhooks/:id/stats', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const userId = getUserId(request);
      const { id } = request.params;

      const stats = await oracleWebhookService.getWebhookStats(id, userId);

      if (!stats) {
        reply.code(404);
        return { success: false, error: 'Webhook not found' };
      }

      const response: APIResponse<WebhookStats> = {
        success: true,
        data: stats,
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to get webhook stats' };
    }
  });

  // POST /api/oracle/webhooks/:id/test - Test webhook
  fastify.post('/api/oracle/webhooks/:id/test', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const userId = getUserId(request);
      const { id } = request.params;

      const result = await oracleWebhookService.testWebhook(id, userId);

      const response: APIResponse<WebhookTestResult> = {
        success: true,
        data: result,
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to test webhook' };
    }
  });

  // POST /api/oracle/webhooks/retry-failed - Retry all failed deliveries
  fastify.post('/api/oracle/webhooks/retry-failed', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = getUserId(request);

      const count = await oracleWebhookService.retryFailedDeliveries(userId);

      const response: APIResponse<{ retried: number }> = {
        success: true,
        data: { retried: count },
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to retry deliveries' };
    }
  });

  // GET /api/oracle/webhooks/events - Get available event types
  fastify.get('/api/oracle/webhooks/events', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const events = await oracleWebhookService.getEventTypes();

      const response: APIResponse<WebhookEvent[]> = {
        success: true,
        data: events,
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to get event types' };
    }
  });
}

export default webhookRoutes;
