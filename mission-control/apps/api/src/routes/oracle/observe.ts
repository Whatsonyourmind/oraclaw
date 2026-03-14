import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type {
  Signal,
  SignalCluster,
  AnomalyPattern,
  DataSource,
  RadarScanResult,
  APIResponse,
  SignalStatus,
  SignalType,
  UrgencyLevel,
} from '@mission-control/shared-types';

// Types for request bodies and params
interface SignalCreateBody {
  data_source_id?: string;
  signal_type: SignalType;
  title: string;
  description?: string;
  urgency: UrgencyLevel;
  impact: UrgencyLevel;
  confidence?: number;
  source_data?: Record<string, any>;
  related_entity_type?: string;
  related_entity_id?: string;
  expires_at?: string;
  metadata?: Record<string, any>;
}

interface SignalUpdateBody {
  status?: SignalStatus;
  urgency?: UrgencyLevel;
  impact?: UrgencyLevel;
  confidence?: number;
  metadata?: Record<string, any>;
}

interface SignalFilters {
  status?: SignalStatus;
  signal_type?: SignalType;
  urgency?: UrgencyLevel;
  limit?: number;
  offset?: number;
}

interface AnomalyPatternCreateBody {
  name: string;
  description?: string;
  pattern_type: 'deviation' | 'spike' | 'trend' | 'absence' | 'correlation' | 'custom';
  detection_rules: Record<string, any>;
  baseline_data?: Record<string, any>;
  threshold?: number;
  sensitivity?: 'low' | 'medium' | 'high';
  metadata?: Record<string, any>;
}

interface DataSourceCreateBody {
  source_type: 'calendar' | 'email' | 'tasks' | 'notes' | 'meetings' | 'manual' | 'integration';
  name: string;
  config?: Record<string, any>;
  scan_frequency_minutes?: number;
  metadata?: Record<string, any>;
}

// Mock user ID for now (would come from auth in production)
const getMockUserId = () => 'mock-user-id';

export async function observeRoutes(fastify: FastifyInstance) {
  // POST /api/oracle/observe/scan - Trigger radar scan
  fastify.post('/api/oracle/observe/scan', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = getMockUserId();

      // In production, this would:
      // 1. Get active data sources for user
      // 2. Scan each source using geminiService.radarScan()
      // 3. Detect anomalies using geminiService.detectAnomalies()
      // 4. Cluster signals using geminiService.clusterSignals()
      // 5. Save results to database

      const result: RadarScanResult = {
        scan_id: crypto.randomUUID(),
        scanned_at: new Date().toISOString(),
        signals: [],
        clusters: [],
        anomalies_detected: 0,
        sources_scanned: [],
        duration_ms: 0,
        metadata: {},
      };

      const response: APIResponse<RadarScanResult> = {
        success: true,
        data: result,
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to run radar scan' };
    }
  });

  // GET /api/oracle/observe/signals - List signals with filters
  fastify.get('/api/oracle/observe/signals', async (request: FastifyRequest<{ Querystring: SignalFilters }>, reply: FastifyReply) => {
    try {
      const userId = getMockUserId();
      const { status, signal_type, urgency, limit = 50, offset = 0 } = request.query;

      // In production, query supabase with filters
      const signals: Signal[] = [];

      const response: APIResponse<Signal[]> = {
        success: true,
        data: signals,
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to get signals' };
    }
  });

  // POST /api/oracle/observe/signals - Create signal
  fastify.post('/api/oracle/observe/signals', async (request: FastifyRequest<{ Body: SignalCreateBody }>, reply: FastifyReply) => {
    try {
      const userId = getMockUserId();
      const body = request.body;

      const signal: Signal = {
        id: crypto.randomUUID(),
        user_id: userId,
        data_source_id: body.data_source_id,
        signal_type: body.signal_type,
        title: body.title,
        description: body.description,
        urgency: body.urgency,
        impact: body.impact,
        confidence: body.confidence || 0.5,
        status: 'active',
        source_data: body.source_data || {},
        related_entity_type: body.related_entity_type,
        related_entity_id: body.related_entity_id,
        expires_at: body.expires_at,
        metadata: body.metadata || {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // In production, save to supabase

      const response: APIResponse<Signal> = {
        success: true,
        data: signal,
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to create signal' };
    }
  });

  // GET /api/oracle/observe/signals/:id - Get single signal
  fastify.get('/api/oracle/observe/signals/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const userId = getMockUserId();

      // In production, get from supabase
      const signal: Signal | null = null;

      if (!signal) {
        reply.code(404);
        return { success: false, error: 'Signal not found' };
      }

      const response: APIResponse<Signal> = {
        success: true,
        data: signal,
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to get signal' };
    }
  });

  // PATCH /api/oracle/observe/signals/:id - Update/dismiss signal
  fastify.patch('/api/oracle/observe/signals/:id', async (request: FastifyRequest<{ Params: { id: string }; Body: SignalUpdateBody }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const body = request.body;
      const userId = getMockUserId();

      // In production, update in supabase
      const updatedSignal: Signal = {
        id,
        user_id: userId,
        signal_type: 'opportunity',
        title: 'Updated Signal',
        urgency: body.urgency || 'medium',
        impact: body.impact || 'medium',
        confidence: body.confidence || 0.5,
        status: body.status || 'active',
        source_data: {},
        metadata: body.metadata || {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const response: APIResponse<Signal> = {
        success: true,
        data: updatedSignal,
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to update signal' };
    }
  });

  // DELETE /api/oracle/observe/signals/:id - Delete signal
  fastify.delete('/api/oracle/observe/signals/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const userId = getMockUserId();

      // In production, delete from supabase

      return { success: true };
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to delete signal' };
    }
  });

  // GET /api/oracle/observe/clusters - Get signal clusters
  fastify.get('/api/oracle/observe/clusters', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = getMockUserId();

      // In production, get clusters from supabase with their signals
      const clusters: SignalCluster[] = [];

      const response: APIResponse<SignalCluster[]> = {
        success: true,
        data: clusters,
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to get clusters' };
    }
  });

  // POST /api/oracle/observe/clusters/generate - Generate clusters from signals
  fastify.post('/api/oracle/observe/clusters/generate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = getMockUserId();

      // In production:
      // 1. Get active signals
      // 2. Use geminiService.clusterSignals()
      // 3. Save clusters to database

      const clusters: SignalCluster[] = [];

      const response: APIResponse<SignalCluster[]> = {
        success: true,
        data: clusters,
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to generate clusters' };
    }
  });

  // GET /api/oracle/observe/anomalies - Get anomaly patterns
  fastify.get('/api/oracle/observe/anomalies', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = getMockUserId();

      // In production, get from supabase
      const patterns: AnomalyPattern[] = [];

      const response: APIResponse<AnomalyPattern[]> = {
        success: true,
        data: patterns,
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to get anomaly patterns' };
    }
  });

  // POST /api/oracle/observe/anomalies - Create anomaly pattern
  fastify.post('/api/oracle/observe/anomalies', async (request: FastifyRequest<{ Body: AnomalyPatternCreateBody }>, reply: FastifyReply) => {
    try {
      const userId = getMockUserId();
      const body = request.body;

      const pattern: AnomalyPattern = {
        id: crypto.randomUUID(),
        user_id: userId,
        name: body.name,
        description: body.description,
        pattern_type: body.pattern_type,
        detection_rules: body.detection_rules,
        baseline_data: body.baseline_data || {},
        threshold: body.threshold || 2.0,
        sensitivity: body.sensitivity || 'medium',
        is_active: true,
        trigger_count: 0,
        metadata: body.metadata || {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // In production, save to supabase

      const response: APIResponse<AnomalyPattern> = {
        success: true,
        data: pattern,
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to create anomaly pattern' };
    }
  });

  // GET /api/oracle/observe/data-sources - Get data sources
  fastify.get('/api/oracle/observe/data-sources', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = getMockUserId();

      // In production, get from supabase
      const sources: DataSource[] = [];

      const response: APIResponse<DataSource[]> = {
        success: true,
        data: sources,
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to get data sources' };
    }
  });

  // POST /api/oracle/observe/data-sources - Create data source
  fastify.post('/api/oracle/observe/data-sources', async (request: FastifyRequest<{ Body: DataSourceCreateBody }>, reply: FastifyReply) => {
    try {
      const userId = getMockUserId();
      const body = request.body;

      const source: DataSource = {
        id: crypto.randomUUID(),
        user_id: userId,
        source_type: body.source_type,
        name: body.name,
        config: body.config || {},
        is_active: true,
        scan_frequency_minutes: body.scan_frequency_minutes || 60,
        metadata: body.metadata || {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // In production, save to supabase

      const response: APIResponse<DataSource> = {
        success: true,
        data: source,
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to create data source' };
    }
  });
}

export default observeRoutes;
