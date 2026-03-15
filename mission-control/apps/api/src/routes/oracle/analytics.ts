import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getUserId } from '../../services/auth/authMiddleware.js';
import type {
  AnalyticsEvent,
  AnalyticsEventType,
  AnalyticsEventCategory,
  PredictionAccuracyRecord,
  EngagementMetrics,
  SystemHealthMetrics,
  AnalyticsDashboardData,
  AnalyticsQueryParams,
  APIResponse,
} from '@mission-control/shared-types';

// Types for request bodies and params
interface TrackEventBody {
  event_type: AnalyticsEventType;
  event_category: AnalyticsEventCategory;
  payload?: Record<string, any>;
  entity_type?: string;
  entity_id?: string;
  session_id?: string;
  duration_ms?: number;
  metadata?: Record<string, any>;
}

interface DashboardQuery {
  start_date?: string;
  end_date?: string;
  granularity?: 'hour' | 'day' | 'week' | 'month';
}

interface PredictionAccuracyQuery {
  category?: string;
  start_date?: string;
  end_date?: string;
  limit?: number;
  offset?: number;
}

interface EngagementQuery {
  start_date?: string;
  end_date?: string;
  platform?: string;
  limit?: number;
  offset?: number;
}

interface SystemHealthQuery {
  metric_type?: string;
  endpoint?: string;
  start_date?: string;
  end_date?: string;
  limit?: number;
}


// Mock device info (would come from request headers in production)
const getDeviceInfo = (request: FastifyRequest) => ({
  device_id: request.headers['x-device-id'] as string | undefined,
  ip_address: request.ip,
  user_agent: request.headers['user-agent'],
});

export async function analyticsRoutes(fastify: FastifyInstance) {
  // POST /api/oracle/analytics/event - Track analytics event
  fastify.post('/api/oracle/analytics/event', async (request: FastifyRequest<{ Body: TrackEventBody }>, reply: FastifyReply) => {
    try {
      const userId = getUserId(request);
      const body = request.body;
      const deviceInfo = getDeviceInfo(request);

      const event: AnalyticsEvent = {
        id: crypto.randomUUID(),
        user_id: userId,
        event_type: body.event_type,
        event_category: body.event_category,
        payload: body.payload || {},
        entity_type: body.entity_type,
        entity_id: body.entity_id,
        session_id: body.session_id,
        device_id: deviceInfo.device_id,
        ip_address: deviceInfo.ip_address,
        user_agent: deviceInfo.user_agent,
        duration_ms: body.duration_ms,
        metadata: body.metadata || {},
        created_at: new Date().toISOString(),
      };

      // In production, save to oracle_analytics_events table
      // await supabase.from('oracle_analytics_events').insert(event);

      const response: APIResponse<AnalyticsEvent> = {
        success: true,
        data: event,
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to track event' };
    }
  });

  // GET /api/oracle/analytics/dashboard - Get aggregated metrics
  fastify.get('/api/oracle/analytics/dashboard', async (request: FastifyRequest<{ Querystring: DashboardQuery }>, reply: FastifyReply) => {
    try {
      const userId = getUserId(request);
      const { start_date, end_date, granularity = 'day' } = request.query;

      // Default to last 30 days if no dates provided
      const periodEnd = end_date || new Date().toISOString();
      const periodStart = start_date || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      // In production, this would aggregate data from:
      // - oracle_analytics_events
      // - oracle_prediction_accuracy
      // - oracle_user_engagement
      // - oracle_system_health

      const dashboardData: AnalyticsDashboardData = {
        total_predictions: 0,
        accuracy_rate: 0,
        total_decisions_completed: 0,
        active_sessions_today: 0,
        prediction_accuracy_trend: [],
        feature_usage: {
          observe: 0,
          orient: 0,
          decide: 0,
          act: 0,
          probability: 0,
        },
        system_health: {
          status: 'healthy',
          avg_latency_ms: 0,
          error_rate: 0,
          uptime_percentage: 100,
        },
        top_signal_types: [],
        period_start: periodStart,
        period_end: periodEnd,
      };

      const response: APIResponse<AnalyticsDashboardData> = {
        success: true,
        data: dashboardData,
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to get dashboard metrics' };
    }
  });

  // GET /api/oracle/analytics/predictions - Get prediction accuracy over time
  fastify.get('/api/oracle/analytics/predictions', async (request: FastifyRequest<{ Querystring: PredictionAccuracyQuery }>, reply: FastifyReply) => {
    try {
      const userId = getUserId(request);
      const { category, start_date, end_date, limit = 100, offset = 0 } = request.query;

      // In production, query oracle_prediction_accuracy table
      // with filters for user_id, category, date range, etc.
      const accuracyRecords: PredictionAccuracyRecord[] = [];

      // Also compute aggregate statistics
      const aggregateStats = {
        total_predictions: 0,
        accurate_predictions: 0,
        accuracy_rate: 0,
        avg_confidence: 0,
        avg_absolute_error: 0,
        by_category: {} as Record<string, { count: number; accuracy: number }>,
      };

      const response: APIResponse<{
        records: PredictionAccuracyRecord[];
        aggregate: typeof aggregateStats;
      }> = {
        success: true,
        data: {
          records: accuracyRecords,
          aggregate: aggregateStats,
        },
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to get prediction accuracy' };
    }
  });

  // GET /api/oracle/analytics/engagement - Get user engagement stats
  fastify.get('/api/oracle/analytics/engagement', async (request: FastifyRequest<{ Querystring: EngagementQuery }>, reply: FastifyReply) => {
    try {
      const userId = getUserId(request);
      const { start_date, end_date, platform, limit = 50, offset = 0 } = request.query;

      // In production, query oracle_user_engagement table
      const engagementSessions: EngagementMetrics[] = [];

      // Also compute aggregate engagement stats
      const aggregateStats = {
        total_sessions: 0,
        avg_session_duration_seconds: 0,
        total_active_time_seconds: 0,
        feature_usage_totals: {
          observe_scans: 0,
          signals_viewed: 0,
          decisions_created: 0,
          decisions_completed: 0,
          simulations_run: 0,
          plans_created: 0,
          steps_completed: 0,
        },
        completion_rates: {
          decisions: 0,
          plans: 0,
          tasks: 0,
        },
        most_visited_screens: [] as Array<{ screen: string; count: number }>,
        platform_breakdown: {} as Record<string, number>,
      };

      const response: APIResponse<{
        sessions: EngagementMetrics[];
        aggregate: typeof aggregateStats;
      }> = {
        success: true,
        data: {
          sessions: engagementSessions,
          aggregate: aggregateStats,
        },
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to get engagement stats' };
    }
  });

  // GET /api/oracle/analytics/health - Get system health metrics
  fastify.get('/api/oracle/analytics/health', async (request: FastifyRequest<{ Querystring: SystemHealthQuery }>, reply: FastifyReply) => {
    try {
      const { metric_type, endpoint, start_date, end_date, limit = 100 } = request.query;

      // Default to last 24 hours
      const periodEnd = end_date || new Date().toISOString();
      const periodStart = start_date || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      // In production, query oracle_system_health table
      const healthMetrics: SystemHealthMetrics[] = [];

      // Compute current health status
      const currentHealth = {
        status: 'healthy' as 'healthy' | 'degraded' | 'critical',
        services: {
          oracle: { status: 'healthy', latency_p50: 0 },
          database: { status: 'healthy', latency_p50: 0 },
          ai: { status: 'healthy', latency_p50: 0 },
        },
        overall_error_rate: 0,
        overall_success_rate: 1,
        avg_response_time_ms: 0,
        requests_last_hour: 0,
      };

      const response: APIResponse<{
        metrics: SystemHealthMetrics[];
        current: typeof currentHealth;
        period_start: string;
        period_end: string;
      }> = {
        success: true,
        data: {
          metrics: healthMetrics,
          current: currentHealth,
          period_start: periodStart,
          period_end: periodEnd,
        },
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to get health metrics' };
    }
  });

  // POST /api/oracle/analytics/event/batch - Track multiple events at once
  fastify.post('/api/oracle/analytics/event/batch', async (request: FastifyRequest<{ Body: { events: TrackEventBody[] } }>, reply: FastifyReply) => {
    try {
      const userId = getUserId(request);
      const { events } = request.body;
      const deviceInfo = getDeviceInfo(request);

      const trackedEvents: AnalyticsEvent[] = events.map((eventData) => ({
        id: crypto.randomUUID(),
        user_id: userId,
        event_type: eventData.event_type,
        event_category: eventData.event_category,
        payload: eventData.payload || {},
        entity_type: eventData.entity_type,
        entity_id: eventData.entity_id,
        session_id: eventData.session_id,
        device_id: deviceInfo.device_id,
        ip_address: deviceInfo.ip_address,
        user_agent: deviceInfo.user_agent,
        duration_ms: eventData.duration_ms,
        metadata: eventData.metadata || {},
        created_at: new Date().toISOString(),
      }));

      // In production, batch insert to oracle_analytics_events
      // await supabase.from('oracle_analytics_events').insert(trackedEvents);

      const response: APIResponse<{ tracked: number; events: AnalyticsEvent[] }> = {
        success: true,
        data: {
          tracked: trackedEvents.length,
          events: trackedEvents,
        },
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to track events' };
    }
  });

  // GET /api/oracle/analytics/events - Query analytics events
  fastify.get('/api/oracle/analytics/events', async (request: FastifyRequest<{ Querystring: AnalyticsQueryParams }>, reply: FastifyReply) => {
    try {
      const userId = getUserId(request);
      const {
        start_date,
        end_date,
        event_types,
        categories,
        limit = 100,
        offset = 0,
      } = request.query;

      // In production, query oracle_analytics_events with filters
      const events: AnalyticsEvent[] = [];

      const response: APIResponse<{
        events: AnalyticsEvent[];
        total: number;
        limit: number;
        offset: number;
      }> = {
        success: true,
        data: {
          events,
          total: 0,
          limit,
          offset,
        },
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to query events' };
    }
  });

  // POST /api/oracle/analytics/session/start - Start engagement session
  fastify.post('/api/oracle/analytics/session/start', async (request: FastifyRequest<{ Body: { platform?: string; app_version?: string } }>, reply: FastifyReply) => {
    try {
      const userId = getUserId(request);
      const { platform, app_version } = request.body;
      const deviceInfo = getDeviceInfo(request);

      const sessionId = crypto.randomUUID();
      const session: EngagementMetrics = {
        id: crypto.randomUUID(),
        user_id: userId,
        session_id: sessionId,
        session_start: new Date().toISOString(),
        device_id: deviceInfo.device_id,
        platform,
        app_version,
        observe_scans: 0,
        signals_viewed: 0,
        signals_acknowledged: 0,
        contexts_generated: 0,
        decisions_created: 0,
        decisions_completed: 0,
        simulations_run: 0,
        plans_created: 0,
        steps_completed: 0,
        predictions_viewed: 0,
        ghost_actions_reviewed: 0,
        active_time_seconds: 0,
        screens_visited: [],
        actions_taken: 0,
        api_calls_made: 0,
        errors_encountered: 0,
        tasks_completed: 0,
        decisions_finalized: 0,
        plans_executed: 0,
        metadata: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // In production, save to oracle_user_engagement
      // await supabase.from('oracle_user_engagement').insert(session);

      const response: APIResponse<{ session_id: string; session: EngagementMetrics }> = {
        success: true,
        data: {
          session_id: sessionId,
          session,
        },
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to start session' };
    }
  });

  // POST /api/oracle/analytics/session/:sessionId/end - End engagement session
  fastify.post('/api/oracle/analytics/session/:sessionId/end', async (request: FastifyRequest<{ Params: { sessionId: string }; Body: Partial<EngagementMetrics> }>, reply: FastifyReply) => {
    try {
      const { sessionId } = request.params;
      const updates = request.body;
      const userId = getUserId(request);

      const sessionEnd = new Date().toISOString();

      // In production:
      // 1. Get session from oracle_user_engagement
      // 2. Calculate session_duration_seconds
      // 3. Update with final metrics
      // await supabase
      //   .from('oracle_user_engagement')
      //   .update({ ...updates, session_end: sessionEnd, session_duration_seconds: ... })
      //   .eq('session_id', sessionId)
      //   .eq('user_id', userId);

      const response: APIResponse<{ session_id: string; ended_at: string }> = {
        success: true,
        data: {
          session_id: sessionId,
          ended_at: sessionEnd,
        },
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to end session' };
    }
  });

  // PATCH /api/oracle/analytics/session/:sessionId - Update session metrics
  fastify.patch('/api/oracle/analytics/session/:sessionId', async (request: FastifyRequest<{ Params: { sessionId: string }; Body: Partial<EngagementMetrics> }>, reply: FastifyReply) => {
    try {
      const { sessionId } = request.params;
      const updates = request.body;
      const userId = getUserId(request);

      // In production, update oracle_user_engagement
      // await supabase
      //   .from('oracle_user_engagement')
      //   .update({ ...updates, updated_at: new Date().toISOString() })
      //   .eq('session_id', sessionId)
      //   .eq('user_id', userId);

      const response: APIResponse<{ session_id: string; updated: boolean }> = {
        success: true,
        data: {
          session_id: sessionId,
          updated: true,
        },
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to update session' };
    }
  });
}

export default analyticsRoutes;
