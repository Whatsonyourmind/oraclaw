/**
 * Request Analytics Middleware
 *
 * Tracks API request metrics to oracle_analytics_events for monitoring
 * and usage analysis.
 *
 * Two hooks:
 *   - onRequest: stamps startTime on the request for duration calculation
 *   - onResponse: inserts analytics event (fire-and-forget, never throws)
 *
 * Only tracks /api/v1/ routes, skips health checks.
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../services/database/client.js';

// ── Timer Hook (onRequest) ──────────────────────────────────

/**
 * Factory that creates an async Fastify onRequest hook to record request start time.
 *
 * @returns Async onRequest hook function
 */
export function createAnalyticsTimerHook() {
  return async function timerHook(request: FastifyRequest): Promise<void> {
    (request as any).startTime = Date.now();
  };
}

// ── Analytics Hook (onResponse) ─────────────────────────────

/**
 * Factory that creates an async Fastify onResponse hook for analytics event tracking.
 *
 * Inserts a row into oracle_analytics_events for every /api/v1/ request
 * (excluding health checks). Fire-and-forget: DB insert does NOT block
 * the response. Failures are logged but never thrown.
 *
 * @returns Async onResponse hook function
 */
export function createAnalyticsHook() {
  return async function analyticsHook(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    // Only track /api/v1/ routes
    if (!request.url.startsWith('/api/v1/')) return;
    // Skip health checks
    if (request.url.includes('/health')) return;

    const duration = Date.now() - ((request as any).startTime || Date.now());

    const event = {
      method: request.method,
      url: request.url,
      status: reply.statusCode,
      duration_ms: duration,
      tier: (request as any).tier || 'free',
      billingPath: (request as any).billingPath || 'free',
      keyId: (request as any).keyId || null,
      ip: request.ip,
      ua: (request.headers['user-agent'] || 'unknown').slice(0, 120),
    };

    // Always log to stdout (captured by Render/Docker logs)
    request.log.info({ analytics: event }, 'api_request');

    // Also persist to DB if connected (fire-and-forget)
    if (db.isConnected()) {
      db.query(
        `INSERT INTO oracle_analytics_events (event_type, event_category, entity_id, ip_address, user_agent, duration_ms, payload, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          'api_request',
          event.method,
          event.url,
          event.ip,
          event.ua,
          event.duration_ms,
          JSON.stringify({ statusCode: event.status }),
          JSON.stringify({ tier: event.tier, billingPath: event.billingPath, keyId: event.keyId }),
        ],
      ).catch((err) => {
        request.log.warn({ err }, 'analytics db insert failed');
      });
    }
  };
}
