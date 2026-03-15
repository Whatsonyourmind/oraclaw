import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getUserId } from '../../services/auth/authMiddleware.js';
import type {
  Prediction,
  CalibrationState,
  UserPattern,
  APIResponse,
  PredictionType,
  UserPatternType,
} from '@mission-control/shared-types';

// Types for request bodies
interface PredictionCreateBody {
  prediction_type: PredictionType;
  subject_type: string;
  subject_id?: string;
  description: string;
  predicted_value?: number;
  predicted_outcome?: string;
  confidence: number;
  factors?: Array<{
    name: string;
    value: number;
    weight: number;
    direction: 'positive' | 'negative' | 'neutral';
  }>;
  valid_until?: string;
  metadata?: Record<string, any>;
}

interface OutcomeRecordBody {
  actual_value?: number;
  actual_outcome?: string;
  notes?: string;
  metadata?: Record<string, any>;
}

interface PatternCreateBody {
  pattern_type: UserPatternType;
  pattern_name: string;
  pattern_data: Record<string, any>;
  confidence?: number;
  metadata?: Record<string, any>;
}

export async function probabilityRoutes(fastify: FastifyInstance) {
  // POST /api/oracle/probability/predict - Generate prediction
  fastify.post('/api/oracle/probability/predict', async (request: FastifyRequest<{ Body: PredictionCreateBody }>, reply: FastifyReply) => {
    try {
      const userId = getUserId(request);
      const body = request.body;

      // In production:
      // 1. Get user patterns and calibration
      // 2. Use probability service to generate prediction
      // 3. Apply time-based decay
      // 4. Save prediction to database

      const prediction: Prediction = {
        id: crypto.randomUUID(),
        user_id: userId,
        prediction_type: body.prediction_type,
        subject_type: body.subject_type,
        subject_id: body.subject_id,
        description: body.description,
        predicted_value: body.predicted_value,
        predicted_outcome: body.predicted_outcome,
        confidence: body.confidence,
        factors: body.factors || [],
        factor_weights: {},
        decay_rate: 0.01,
        valid_from: new Date().toISOString(),
        valid_until: body.valid_until,
        is_resolved: false,
        metadata: body.metadata || {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const response: APIResponse<Prediction> = {
        success: true,
        data: prediction,
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to create prediction' };
    }
  });

  // GET /api/oracle/probability/predictions - List predictions
  fastify.get('/api/oracle/probability/predictions', async (request: FastifyRequest<{ Querystring: { prediction_type?: PredictionType; resolved?: boolean; limit?: number } }>, reply: FastifyReply) => {
    try {
      const userId = getUserId(request);
      const { prediction_type, resolved, limit = 50 } = request.query;

      // In production, get from supabase with filters
      const predictions: Prediction[] = [];

      const response: APIResponse<Prediction[]> = {
        success: true,
        data: predictions,
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to get predictions' };
    }
  });

  // GET /api/oracle/probability/predictions/:id - Get single prediction
  fastify.get('/api/oracle/probability/predictions/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const userId = getUserId(request);

      // In production, get from supabase
      const prediction: Prediction | null = null;

      if (!prediction) {
        reply.code(404);
        return { success: false, error: 'Prediction not found' };
      }

      const response: APIResponse<Prediction> = {
        success: true,
        data: prediction,
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to get prediction' };
    }
  });

  // POST /api/oracle/probability/predictions/:id/outcome - Record actual outcome
  fastify.post('/api/oracle/probability/predictions/:id/outcome', async (request: FastifyRequest<{ Params: { id: string }; Body: OutcomeRecordBody }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const body = request.body;
      const userId = getUserId(request);

      // In production:
      // 1. Get prediction
      // 2. Calculate accuracy score
      // 3. Save outcome
      // 4. Update prediction as resolved
      // 5. Update calibration state with Bayesian update:
      //    P(H|E) = P(E|H) * P(H) / P(E)
      //    For Beta distribution: Beta(α, β) → Beta(α + successes, β + failures)

      const accuracyScore = 0.75; // Would be calculated based on actual vs predicted

      const outcome = {
        id: crypto.randomUUID(),
        prediction_id: id,
        user_id: userId,
        actual_value: body.actual_value,
        actual_outcome: body.actual_outcome,
        occurred_at: new Date().toISOString(),
        accuracy_score: accuracyScore,
        variance: body.actual_value && 0, // Would calculate variance
        notes: body.notes,
        metadata: body.metadata || {},
        created_at: new Date().toISOString(),
      };

      const response: APIResponse<typeof outcome> = {
        success: true,
        data: outcome,
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to record outcome' };
    }
  });

  // GET /api/oracle/probability/calibration - Get calibration state
  fastify.get('/api/oracle/probability/calibration', async (request: FastifyRequest<{ Querystring: { calibration_type?: string; domain?: string } }>, reply: FastifyReply) => {
    try {
      const userId = getUserId(request);
      const { calibration_type = 'global', domain } = request.query;

      // In production, get or create calibration state
      const calibration: CalibrationState = {
        id: crypto.randomUUID(),
        user_id: userId,
        calibration_type: calibration_type as 'global' | 'by_type' | 'by_domain',
        domain,
        brier_score: 0.15, // Lower is better (0 = perfect)
        accuracy_by_bucket: {
          '0-10': { predictions: 0, accuracy: 0 },
          '10-20': { predictions: 0, accuracy: 0 },
          '20-30': { predictions: 0, accuracy: 0 },
          '30-40': { predictions: 0, accuracy: 0 },
          '40-50': { predictions: 0, accuracy: 0 },
          '50-60': { predictions: 0, accuracy: 0 },
          '60-70': { predictions: 0, accuracy: 0 },
          '70-80': { predictions: 0, accuracy: 0 },
          '80-90': { predictions: 0, accuracy: 0 },
          '90-100': { predictions: 0, accuracy: 0 },
        },
        total_predictions: 0,
        resolved_predictions: 0,
        alpha: 1.0,
        beta: 1.0,
        last_updated: new Date().toISOString(),
        metadata: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const response: APIResponse<CalibrationState> = {
        success: true,
        data: calibration,
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to get calibration' };
    }
  });

  // GET /api/oracle/probability/calibration/history - Get calibration history
  fastify.get('/api/oracle/probability/calibration/history', async (request: FastifyRequest<{ Querystring: { days?: number } }>, reply: FastifyReply) => {
    try {
      const userId = getUserId(request);
      const { days = 30 } = request.query;

      // In production, get historical calibration snapshots
      const history: Array<{ date: string; brier_score: number; predictions: number }> = [];

      const response: APIResponse<typeof history> = {
        success: true,
        data: history,
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to get calibration history' };
    }
  });

  // GET /api/oracle/probability/patterns - Get user patterns
  fastify.get('/api/oracle/probability/patterns', async (request: FastifyRequest<{ Querystring: { pattern_type?: UserPatternType; active_only?: boolean } }>, reply: FastifyReply) => {
    try {
      const userId = getUserId(request);
      const { pattern_type, active_only = true } = request.query;

      // In production, get from supabase with filters
      const patterns: UserPattern[] = [];

      const response: APIResponse<UserPattern[]> = {
        success: true,
        data: patterns,
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to get patterns' };
    }
  });

  // POST /api/oracle/probability/patterns - Create/update pattern
  fastify.post('/api/oracle/probability/patterns', async (request: FastifyRequest<{ Body: PatternCreateBody }>, reply: FastifyReply) => {
    try {
      const userId = getUserId(request);
      const body = request.body;

      const pattern: UserPattern = {
        id: crypto.randomUUID(),
        user_id: userId,
        pattern_type: body.pattern_type,
        pattern_name: body.pattern_name,
        pattern_data: body.pattern_data,
        confidence: body.confidence || 0.5,
        sample_size: 1,
        last_observed_at: new Date().toISOString(),
        is_active: true,
        metadata: body.metadata || {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // In production, upsert to supabase (merge with existing pattern data)

      const response: APIResponse<UserPattern> = {
        success: true,
        data: pattern,
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to create pattern' };
    }
  });

  // POST /api/oracle/probability/patterns/analyze - Analyze patterns from history
  fastify.post('/api/oracle/probability/patterns/analyze', async (request: FastifyRequest<{ Body: { days?: number; types?: UserPatternType[] } }>, reply: FastifyReply) => {
    try {
      const userId = getUserId(request);
      const { days = 30, types } = request.body;

      // In production:
      // 1. Get user's tasks, events, completions for past N days
      // 2. Analyze patterns (time_of_day, day_of_week, etc.)
      // 3. Update or create pattern records

      const analyzedPatterns: UserPattern[] = [];

      const response: APIResponse<UserPattern[]> = {
        success: true,
        data: analyzedPatterns,
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to analyze patterns' };
    }
  });

  // GET /api/oracle/probability/factors/:subjectType/:subjectId - Get factor scores for subject
  fastify.get('/api/oracle/probability/factors/:subjectType/:subjectId', async (request: FastifyRequest<{ Params: { subjectType: string; subjectId: string } }>, reply: FastifyReply) => {
    try {
      const { subjectType, subjectId } = request.params;
      const userId = getUserId(request);

      // In production, calculate factor scores for the subject
      const factors = {
        subject_type: subjectType,
        subject_id: subjectId,
        scores: [] as Array<{
          factor_id: string;
          name: string;
          raw_value: number;
          normalized_value: number;
          weight: number;
          contribution: number;
        }>,
        combined_score: 0,
        confidence: 0.7,
      };

      const response: APIResponse<typeof factors> = {
        success: true,
        data: factors,
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to get factors' };
    }
  });
}

export default probabilityRoutes;
