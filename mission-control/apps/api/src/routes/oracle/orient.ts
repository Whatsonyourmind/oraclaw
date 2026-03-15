import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getUserId } from '../../services/auth/authMiddleware.js';
import type {
  StrategicContext,
  StrategicHorizon,
  Correlation,
  RiskOpportunityAssessment,
  APIResponse,
  HorizonType,
  CorrelationType,
  AssessmentType,
  UrgencyLevel,
  ImpactLevel,
} from '@mission-control/shared-types';

// Types for request bodies
interface ContextGenerateBody {
  signal_ids?: string[];
  include_calendar?: boolean;
  include_tasks?: boolean;
  focus_areas?: string[];
  metadata?: Record<string, any>;
}

interface HorizonGenerateBody {
  context_id: string;
  horizon_type: HorizonType;
  constraints?: Record<string, any>;
  metadata?: Record<string, any>;
}

interface CorrelationDiscoverBody {
  entity_ids: string[];
  history_days?: number;
  min_strength?: number;
  metadata?: Record<string, any>;
}

interface AssessmentCreateBody {
  context_id?: string;
  assessment_type: AssessmentType;
  title: string;
  description?: string;
  impact_level: ImpactLevel;
  likelihood: number;
  urgency?: UrgencyLevel;
  related_signals?: string[];
  metadata?: Record<string, any>;
}

export async function orientRoutes(fastify: FastifyInstance) {
  // POST /api/oracle/orient/generate - Generate strategic context
  fastify.post('/api/oracle/orient/generate', async (request: FastifyRequest<{ Body: ContextGenerateBody }>, reply: FastifyReply) => {
    try {
      const userId = getUserId(request);
      const body = request.body;

      // In production:
      // 1. Get signals by IDs or recent active signals
      // 2. Use geminiService.generateOrientation()
      // 3. Save context to database

      const context: StrategicContext = {
        id: crypto.randomUUID(),
        user_id: userId,
        situation_summary: 'Generated strategic context summary',
        key_factors: [],
        recommendations: [],
        constraints: [],
        assumptions: [],
        confidence: 0.7,
        is_active: true,
        metadata: body.metadata || {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const response: APIResponse<StrategicContext> = {
        success: true,
        data: context,
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to generate context' };
    }
  });

  // GET /api/oracle/orient/contexts - List contexts
  fastify.get('/api/oracle/orient/contexts', async (request: FastifyRequest<{ Querystring: { active_only?: boolean; limit?: number } }>, reply: FastifyReply) => {
    try {
      const userId = getUserId(request);
      const { active_only = true, limit = 10 } = request.query;

      // In production, get from supabase with filters
      const contexts: StrategicContext[] = [];

      const response: APIResponse<StrategicContext[]> = {
        success: true,
        data: contexts,
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to get contexts' };
    }
  });

  // GET /api/oracle/orient/contexts/:id - Get single context
  fastify.get('/api/oracle/orient/contexts/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const userId = getUserId(request);

      // In production, get from supabase
      const context: StrategicContext | null = null;

      if (!context) {
        reply.code(404);
        return { success: false, error: 'Context not found' };
      }

      const response: APIResponse<StrategicContext> = {
        success: true,
        data: context,
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to get context' };
    }
  });

  // GET /api/oracle/orient/horizons - Get multi-horizon plans
  fastify.get('/api/oracle/orient/horizons', async (request: FastifyRequest<{ Querystring: { context_id?: string; horizon_type?: HorizonType } }>, reply: FastifyReply) => {
    try {
      const userId = getUserId(request);
      const { context_id, horizon_type } = request.query;

      // In production, get from supabase with filters
      const horizons: StrategicHorizon[] = [];

      const response: APIResponse<StrategicHorizon[]> = {
        success: true,
        data: horizons,
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to get horizons' };
    }
  });

  // POST /api/oracle/orient/horizons - Generate horizon plan
  fastify.post('/api/oracle/orient/horizons', async (request: FastifyRequest<{ Body: HorizonGenerateBody }>, reply: FastifyReply) => {
    try {
      const userId = getUserId(request);
      const body = request.body;

      // In production:
      // 1. Get context by ID
      // 2. Use geminiService.planHorizons()
      // 3. Save horizon to database

      const horizon: StrategicHorizon = {
        id: crypto.randomUUID(),
        context_id: body.context_id,
        user_id: userId,
        horizon_type: body.horizon_type,
        goals: [],
        actions: [],
        dependencies: [],
        risks: [],
        opportunities: [],
        priority_score: 0.5,
        confidence: 0.7,
        metadata: body.metadata || {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const response: APIResponse<StrategicHorizon> = {
        success: true,
        data: horizon,
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to generate horizon' };
    }
  });

  // POST /api/oracle/orient/horizons/all - Generate all horizons for context
  fastify.post('/api/oracle/orient/horizons/all', async (request: FastifyRequest<{ Body: { context_id: string } }>, reply: FastifyReply) => {
    try {
      const userId = getUserId(request);
      const { context_id } = request.body;

      // In production:
      // 1. Get context
      // 2. Generate horizons for immediate, today, week, month
      // 3. Save all horizons

      const horizons: Record<HorizonType, StrategicHorizon> = {
        immediate: {
          id: crypto.randomUUID(),
          context_id,
          user_id: userId,
          horizon_type: 'immediate',
          goals: [],
          actions: [],
          dependencies: [],
          risks: [],
          opportunities: [],
          priority_score: 0.9,
          confidence: 0.8,
          metadata: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        today: {
          id: crypto.randomUUID(),
          context_id,
          user_id: userId,
          horizon_type: 'today',
          goals: [],
          actions: [],
          dependencies: [],
          risks: [],
          opportunities: [],
          priority_score: 0.7,
          confidence: 0.75,
          metadata: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        week: {
          id: crypto.randomUUID(),
          context_id,
          user_id: userId,
          horizon_type: 'week',
          goals: [],
          actions: [],
          dependencies: [],
          risks: [],
          opportunities: [],
          priority_score: 0.5,
          confidence: 0.6,
          metadata: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        month: {
          id: crypto.randomUUID(),
          context_id,
          user_id: userId,
          horizon_type: 'month',
          goals: [],
          actions: [],
          dependencies: [],
          risks: [],
          opportunities: [],
          priority_score: 0.3,
          confidence: 0.5,
          metadata: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      };

      const response: APIResponse<Record<HorizonType, StrategicHorizon>> = {
        success: true,
        data: horizons,
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to generate horizons' };
    }
  });

  // POST /api/oracle/orient/correlations - Discover correlations
  fastify.post('/api/oracle/orient/correlations', async (request: FastifyRequest<{ Body: CorrelationDiscoverBody }>, reply: FastifyReply) => {
    try {
      const userId = getUserId(request);
      const body = request.body;

      // In production:
      // 1. Get entities and their history
      // 2. Use geminiService.discoverCorrelations()
      // 3. Save correlations to database

      const correlations: Correlation[] = [];

      const response: APIResponse<Correlation[]> = {
        success: true,
        data: correlations,
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to discover correlations' };
    }
  });

  // GET /api/oracle/orient/correlations - List correlations
  fastify.get('/api/oracle/orient/correlations', async (request: FastifyRequest<{ Querystring: { entity_type?: string; entity_id?: string; min_strength?: number } }>, reply: FastifyReply) => {
    try {
      const userId = getUserId(request);
      const { entity_type, entity_id, min_strength } = request.query;

      // In production, get from supabase with filters
      const correlations: Correlation[] = [];

      const response: APIResponse<Correlation[]> = {
        success: true,
        data: correlations,
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to get correlations' };
    }
  });

  // GET /api/oracle/orient/assessments - Get risk/opportunity assessments
  fastify.get('/api/oracle/orient/assessments', async (request: FastifyRequest<{ Querystring: { context_id?: string; assessment_type?: AssessmentType; status?: string } }>, reply: FastifyReply) => {
    try {
      const userId = getUserId(request);
      const { context_id, assessment_type, status } = request.query;

      // In production, get from supabase with filters
      const assessments: RiskOpportunityAssessment[] = [];

      const response: APIResponse<RiskOpportunityAssessment[]> = {
        success: true,
        data: assessments,
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to get assessments' };
    }
  });

  // POST /api/oracle/orient/assessments - Create assessment
  fastify.post('/api/oracle/orient/assessments', async (request: FastifyRequest<{ Body: AssessmentCreateBody }>, reply: FastifyReply) => {
    try {
      const userId = getUserId(request);
      const body = request.body;

      const assessment: RiskOpportunityAssessment = {
        id: crypto.randomUUID(),
        context_id: body.context_id,
        user_id: userId,
        assessment_type: body.assessment_type,
        title: body.title,
        description: body.description,
        impact_level: body.impact_level,
        likelihood: body.likelihood,
        urgency: body.urgency || 'medium',
        mitigations: [],
        related_signals: body.related_signals || [],
        status: 'identified',
        confidence: 0.7,
        metadata: body.metadata || {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // In production, save to supabase

      const response: APIResponse<RiskOpportunityAssessment> = {
        success: true,
        data: assessment,
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to create assessment' };
    }
  });

  // PATCH /api/oracle/orient/assessments/:id - Update assessment
  fastify.patch('/api/oracle/orient/assessments/:id', async (request: FastifyRequest<{ Params: { id: string }; Body: Partial<AssessmentCreateBody> & { status?: string } }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const body = request.body;
      const userId = getUserId(request);

      // In production, update in supabase

      const response: APIResponse<{ id: string; updated: boolean }> = {
        success: true,
        data: { id, updated: true },
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to update assessment' };
    }
  });
}

export default orientRoutes;
