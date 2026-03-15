import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getUserId } from '../../services/auth/authMiddleware.js';
import type {
  ExecutionPlan,
  ExecutionStep,
  ProgressUpdate,
  CopilotState,
  CopilotSuggestion,
  ExecutionOutcome,
  Lesson,
  APIResponse,
  PlanStatus,
  StepStatus,
  UrgencyLevel,
  OutcomeType,
  LearningType,
} from '@mission-control/shared-types';

// Types for request bodies
interface PlanCreateBody {
  decision_id?: string;
  title: string;
  description?: string;
  metadata?: Record<string, any>;
}

interface StepUpdateBody {
  status?: StepStatus;
  notes?: string;
  actual_duration_minutes?: number;
  metadata?: Record<string, any>;
}

interface BlockerReportBody {
  step_id: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  resolution?: string;
}

interface PlanAdjustBody {
  adjustment_type: 'reorder' | 'add_step' | 'remove_step' | 'modify_step' | 'reschedule' | 'reassign';
  reason: string;
  changes: Record<string, any>;
}

interface OutcomeRecordBody {
  outcome_type: OutcomeType;
  summary: string;
  actual_results?: Record<string, any>;
  expected_results?: Record<string, any>;
  success_factors?: string[];
  failure_factors?: string[];
  recommendations?: string[];
  metadata?: Record<string, any>;
}

export async function actRoutes(fastify: FastifyInstance) {
  // POST /api/oracle/act/plans - Generate execution plan
  fastify.post('/api/oracle/act/plans', async (request: FastifyRequest<{ Body: PlanCreateBody }>, reply: FastifyReply) => {
    try {
      const userId = getUserId(request);
      const body = request.body;

      // In production:
      // 1. Get decision and selected option
      // 2. Use geminiService.generateExecutionPlan()
      // 3. Save plan and steps to database

      const plan: ExecutionPlan = {
        id: crypto.randomUUID(),
        decision_id: body.decision_id,
        user_id: userId,
        title: body.title,
        description: body.description,
        status: 'draft',
        health_score: 1.0,
        progress_percentage: 0,
        total_steps: 0,
        completed_steps: 0,
        blocked_steps: 0,
        metadata: body.metadata || {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const response: APIResponse<ExecutionPlan> = {
        success: true,
        data: plan,
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to create plan' };
    }
  });

  // GET /api/oracle/act/plans - List plans
  fastify.get('/api/oracle/act/plans', async (request: FastifyRequest<{ Querystring: { status?: PlanStatus; limit?: number } }>, reply: FastifyReply) => {
    try {
      const userId = getUserId(request);
      const { status, limit = 50 } = request.query;

      // In production, get from supabase with filters
      const plans: ExecutionPlan[] = [];

      const response: APIResponse<ExecutionPlan[]> = {
        success: true,
        data: plans,
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to get plans' };
    }
  });

  // GET /api/oracle/act/plans/:id - Get plan with steps
  fastify.get('/api/oracle/act/plans/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const userId = getUserId(request);

      // In production, get plan with steps from supabase
      const plan: ExecutionPlan | null = null;

      if (!plan) {
        reply.code(404);
        return { success: false, error: 'Plan not found' };
      }

      const response: APIResponse<ExecutionPlan> = {
        success: true,
        data: plan,
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to get plan' };
    }
  });

  // PATCH /api/oracle/act/plans/:id - Update plan status
  fastify.patch('/api/oracle/act/plans/:id', async (request: FastifyRequest<{ Params: { id: string }; Body: { status?: PlanStatus } }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const { status } = request.body;
      const userId = getUserId(request);

      // In production, update in supabase
      // If status changes to 'active', set started_at

      const response: APIResponse<{ id: string; updated: boolean }> = {
        success: true,
        data: { id, updated: true },
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to update plan' };
    }
  });

  // GET /api/oracle/act/plans/:id/steps - Get steps for plan
  fastify.get('/api/oracle/act/plans/:id/steps', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const userId = getUserId(request);

      // In production, get steps from supabase
      const steps: ExecutionStep[] = [];

      const response: APIResponse<ExecutionStep[]> = {
        success: true,
        data: steps,
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to get steps' };
    }
  });

  // POST /api/oracle/act/plans/:id/steps - Add step to plan
  fastify.post('/api/oracle/act/plans/:id/steps', async (request: FastifyRequest<{ Params: { id: string }; Body: Partial<ExecutionStep> }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const body = request.body;

      const step: ExecutionStep = {
        id: crypto.randomUUID(),
        plan_id: id,
        parent_step_id: body.parent_step_id,
        step_number: body.step_number || 1,
        title: body.title || 'New Step',
        description: body.description,
        status: 'pending',
        priority: body.priority || 'medium',
        completion_criteria: body.completion_criteria || [],
        blockers: [],
        dependencies: body.dependencies || [],
        estimated_duration_minutes: body.estimated_duration_minutes,
        assigned_to: body.assigned_to,
        due_date: body.due_date,
        metadata: body.metadata || {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // In production, save to supabase and update plan step count

      const response: APIResponse<ExecutionStep> = {
        success: true,
        data: step,
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to add step' };
    }
  });

  // PATCH /api/oracle/act/plans/:id/steps/:stepId - Update step status
  fastify.patch('/api/oracle/act/plans/:id/steps/:stepId', async (request: FastifyRequest<{ Params: { id: string; stepId: string }; Body: StepUpdateBody }>, reply: FastifyReply) => {
    try {
      const { id, stepId } = request.params;
      const body = request.body;
      const userId = getUserId(request);

      // In production:
      // 1. Update step in supabase
      // 2. If status changed to 'completed', update plan completed_steps
      // 3. If status changed to 'blocked', update plan blocked_steps
      // 4. Recalculate plan progress_percentage and health_score
      // 5. Create progress update record

      const response: APIResponse<{ step_id: string; updated: boolean }> = {
        success: true,
        data: { step_id: stepId, updated: true },
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to update step' };
    }
  });

  // POST /api/oracle/act/plans/:id/copilot - Get copilot guidance
  fastify.post('/api/oracle/act/plans/:id/copilot', async (request: FastifyRequest<{ Params: { id: string }; Body: { current_step_id?: string } }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const { current_step_id } = request.body;
      const userId = getUserId(request);

      // In production:
      // 1. Get plan and steps
      // 2. Use geminiService.getCopilotGuidance()
      // 3. Return suggestions and health assessment

      const copilotState: CopilotState = {
        current_step_id,
        suggestions: [
          {
            type: 'guidance',
            content: 'Focus on completing the current step before moving to the next.',
            priority: 'medium',
            action_required: false,
            confidence: 0.8,
          },
        ],
        health_assessment: {
          overall: 'healthy',
          issues: [],
          positives: ['On track', 'Good progress'],
        },
        predictions: {
          completion_likelihood: 0.85,
          risk_factors: [],
        },
        last_updated: new Date().toISOString(),
      };

      const response: APIResponse<CopilotState> = {
        success: true,
        data: copilotState,
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to get copilot guidance' };
    }
  });

  // POST /api/oracle/act/plans/:id/blockers - Report blocker
  fastify.post('/api/oracle/act/plans/:id/blockers', async (request: FastifyRequest<{ Params: { id: string }; Body: BlockerReportBody }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const body = request.body;
      const userId = getUserId(request);

      // In production:
      // 1. Update step with blocker
      // 2. Update step status to 'blocked'
      // 3. Update plan blocked_steps count
      // 4. Create progress update record
      // 5. Maybe generate copilot suggestion for resolution

      const response: APIResponse<{ reported: boolean; step_id: string }> = {
        success: true,
        data: { reported: true, step_id: body.step_id },
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to report blocker' };
    }
  });

  // POST /api/oracle/act/plans/:id/adjust - Adjust plan dynamically
  fastify.post('/api/oracle/act/plans/:id/adjust', async (request: FastifyRequest<{ Params: { id: string }; Body: PlanAdjustBody }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const body = request.body;
      const userId = getUserId(request);

      // In production:
      // 1. Validate adjustment
      // 2. Apply changes to plan/steps
      // 3. Save adjustment record
      // 4. Recalculate plan metrics

      const response: APIResponse<{ adjusted: boolean; adjustment_id: string }> = {
        success: true,
        data: {
          adjusted: true,
          adjustment_id: crypto.randomUUID(),
        },
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to adjust plan' };
    }
  });

  // GET /api/oracle/act/plans/:id/progress - Get progress history
  fastify.get('/api/oracle/act/plans/:id/progress', async (request: FastifyRequest<{ Params: { id: string }; Querystring: { limit?: number } }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const { limit = 50 } = request.query;
      const userId = getUserId(request);

      // In production, get progress updates from supabase
      const updates: ProgressUpdate[] = [];

      const response: APIResponse<ProgressUpdate[]> = {
        success: true,
        data: updates,
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to get progress' };
    }
  });

  // POST /api/oracle/act/plans/:id/outcome - Record outcome
  fastify.post('/api/oracle/act/plans/:id/outcome', async (request: FastifyRequest<{ Params: { id: string }; Body: OutcomeRecordBody }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const body = request.body;
      const userId = getUserId(request);

      // In production:
      // 1. Create outcome record
      // 2. Update plan status to 'completed' or 'failed'
      // 3. Use geminiService.captureLearning() to extract lessons
      // 4. Save lessons to database

      const outcome: ExecutionOutcome = {
        id: crypto.randomUUID(),
        plan_id: id,
        user_id: userId,
        outcome_type: body.outcome_type,
        summary: body.summary,
        actual_results: body.actual_results || {},
        expected_results: body.expected_results || {},
        variance_analysis: {},
        success_factors: body.success_factors || [],
        failure_factors: body.failure_factors || [],
        recommendations: body.recommendations || [],
        confidence: 0.8,
        metadata: body.metadata || {},
        created_at: new Date().toISOString(),
      };

      const response: APIResponse<ExecutionOutcome> = {
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

  // GET /api/oracle/act/outcomes - Get outcomes
  fastify.get('/api/oracle/act/outcomes', async (request: FastifyRequest<{ Querystring: { plan_id?: string; outcome_type?: OutcomeType; limit?: number } }>, reply: FastifyReply) => {
    try {
      const userId = getUserId(request);
      const { plan_id, outcome_type, limit = 50 } = request.query;

      // In production, get from supabase with filters
      const outcomes: ExecutionOutcome[] = [];

      const response: APIResponse<ExecutionOutcome[]> = {
        success: true,
        data: outcomes,
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to get outcomes' };
    }
  });

  // GET /api/oracle/act/learnings - Get captured learnings
  fastify.get('/api/oracle/act/learnings', async (request: FastifyRequest<{ Querystring: { learning_type?: LearningType; context_tag?: string; limit?: number } }>, reply: FastifyReply) => {
    try {
      const userId = getUserId(request);
      const { learning_type, context_tag, limit = 50 } = request.query;

      // In production, get from supabase with filters
      const learnings: Lesson[] = [];

      const response: APIResponse<Lesson[]> = {
        success: true,
        data: learnings,
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to get learnings' };
    }
  });

  // POST /api/oracle/act/learnings - Manually add learning
  fastify.post('/api/oracle/act/learnings', async (request: FastifyRequest<{ Body: Partial<Lesson> }>, reply: FastifyReply) => {
    try {
      const userId = getUserId(request);
      const body = request.body;

      const lesson: Lesson = {
        id: crypto.randomUUID(),
        outcome_id: body.outcome_id,
        user_id: userId,
        learning_type: body.learning_type || 'insight',
        title: body.title || 'New Learning',
        description: body.description || '',
        pattern: body.pattern || {},
        context_tags: body.context_tags || [],
        applicability: body.applicability || {},
        confidence: body.confidence || 0.7,
        times_applied: 0,
        is_active: true,
        metadata: body.metadata || {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // In production, save to supabase

      const response: APIResponse<Lesson> = {
        success: true,
        data: lesson,
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to add learning' };
    }
  });
}

export default actRoutes;
