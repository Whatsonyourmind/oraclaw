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

    // Fire-and-forget: emit analytics event without blocking the response.
    // The .catch() ensures errors are logged but never bubble up.
    db.query(
      `INSERT INTO oracle_analytics_events (event_type, event_category, entity_id, ip_address, user_agent, duration_ms, payload, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        'api_request',
        request.method,
        request.url,
        request.ip,
        request.headers['user-agent'] || 'unknown',
        duration,
        JSON.stringify({ statusCode: reply.statusCode }),
        JSON.stringify({
          tier: (request as any).tier || 'free',
          billingPath: (request as any).billingPath || 'free',
          keyId: (request as any).keyId || null,
        }),
      ],
    ).catch((err) => {
      request.log.warn({ err }, 'analytics insert failed');
    });
  };
}
