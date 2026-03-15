import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getUserId } from '../../services/auth/authMiddleware.js';
import type {
  Decision,
  DecisionOption,
  SimulationResult,
  CriticalPath,
  StakeholderInput,
  APIResponse,
  DecisionStatus,
  DecisionType,
  UrgencyLevel,
  StakeholderInputType,
} from '@mission-control/shared-types';

// Types for request bodies
interface DecisionCreateBody {
  context_id?: string;
  title: string;
  description?: string;
  decision_type?: DecisionType;
  urgency?: UrgencyLevel;
  deadline?: string;
  constraints?: Array<{ description: string; type: string; hard: boolean }>;
  criteria?: Array<{ name: string; weight: number; description?: string }>;
  metadata?: Record<string, any>;
}

interface OptionGenerateBody {
  context?: string;
  constraints?: Record<string, any>;
  num_options?: number;
}

interface SimulationRunBody {
  iterations?: number;
  scenarios?: Record<string, any>;
  timeout_ms?: number;
}

interface StakeholderInputBody {
  stakeholder_name: string;
  stakeholder_role?: string;
  input_type: StakeholderInputType;
  content: string;
  weight?: number;
  metadata?: Record<string, any>;
}

interface SelectOptionBody {
  option_id: string;
  rationale?: string;
}

export async function decideRoutes(fastify: FastifyInstance) {
  // POST /api/oracle/decide/decisions - Create decision
  fastify.post('/api/oracle/decide/decisions', async (request: FastifyRequest<{ Body: DecisionCreateBody }>, reply: FastifyReply) => {
    try {
      const userId = getUserId(request);
      const body = request.body;

      const decision: Decision = {
        id: crypto.randomUUID(),
        context_id: body.context_id,
        user_id: userId,
        title: body.title,
        description: body.description,
        decision_type: body.decision_type || 'general',
        status: 'pending',
        urgency: body.urgency || 'medium',
        deadline: body.deadline,
        confidence: 0.5,
        constraints: body.constraints || [],
        criteria: body.criteria || [],
        metadata: body.metadata || {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // In production, save to supabase

      const response: APIResponse<Decision> = {
        success: true,
        data: decision,
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to create decision' };
    }
  });

  // GET /api/oracle/decide/decisions - List decisions
  fastify.get('/api/oracle/decide/decisions', async (request: FastifyRequest<{ Querystring: { status?: DecisionStatus; limit?: number } }>, reply: FastifyReply) => {
    try {
      const userId = getUserId(request);
      const { status, limit = 50 } = request.query;

      // In production, get from supabase with filters
      const decisions: Decision[] = [];

      const response: APIResponse<Decision[]> = {
        success: true,
        data: decisions,
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to get decisions' };
    }
  });

  // GET /api/oracle/decide/decisions/:id - Get single decision with options
  fastify.get('/api/oracle/decide/decisions/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const userId = getUserId(request);

      // In production, get decision with options from supabase
      const decision: Decision | null = null;

      if (!decision) {
        reply.code(404);
        return { success: false, error: 'Decision not found' };
      }

      const response: APIResponse<Decision> = {
        success: true,
        data: decision,
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to get decision' };
    }
  });

  // PATCH /api/oracle/decide/decisions/:id - Update decision
  fastify.patch('/api/oracle/decide/decisions/:id', async (request: FastifyRequest<{ Params: { id: string }; Body: Partial<DecisionCreateBody> & { status?: DecisionStatus } }>, reply: FastifyReply) => {
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
      return { success: false, error: 'Failed to update decision' };
    }
  });

  // POST /api/oracle/decide/decisions/:id/options - Generate options for decision
  fastify.post('/api/oracle/decide/decisions/:id/options', async (request: FastifyRequest<{ Params: { id: string }; Body: OptionGenerateBody }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const body = request.body;
      const userId = getUserId(request);

      // In production:
      // 1. Get decision
      // 2. Use geminiService.generateDecisionOptions()
      // 3. Save options to database

      const options: DecisionOption[] = [];

      // Generate 3-5 mock options
      const numOptions = body.num_options || 3;
      for (let i = 0; i < numOptions; i++) {
        options.push({
          id: crypto.randomUUID(),
          decision_id: id,
          title: `Option ${i + 1}`,
          description: `Description for option ${i + 1}`,
          pros: [],
          cons: [],
          estimated_outcomes: {},
          resource_requirements: {},
          risks: [],
          confidence: 0.6 + Math.random() * 0.3,
          rank: i + 1,
          is_recommended: i === 0,
          metadata: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }

      const response: APIResponse<DecisionOption[]> = {
        success: true,
        data: options,
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to generate options' };
    }
  });

  // GET /api/oracle/decide/decisions/:id/options - Get options for decision
  fastify.get('/api/oracle/decide/decisions/:id/options', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const userId = getUserId(request);

      // In production, get from supabase
      const options: DecisionOption[] = [];

      const response: APIResponse<DecisionOption[]> = {
        success: true,
        data: options,
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to get options' };
    }
  });

  // POST /api/oracle/decide/decisions/:id/options/:optionId/simulate - Run Monte Carlo simulation
  fastify.post('/api/oracle/decide/decisions/:id/options/:optionId/simulate', async (request: FastifyRequest<{ Params: { id: string; optionId: string }; Body: SimulationRunBody }>, reply: FastifyReply) => {
    try {
      const { id, optionId } = request.params;
      const body = request.body;
      const userId = getUserId(request);

      const iterations = Math.min(body.iterations || 1000, 2000); // Cap at 2000
      const startTime = Date.now();

      // In production:
      // 1. Get option
      // 2. Use monte carlo service
      // 3. Save simulation results

      const result: SimulationResult = {
        id: crypto.randomUUID(),
        option_id: optionId,
        user_id: userId,
        simulation_type: 'monte_carlo',
        iterations,
        results: {},
        mean_outcome: 0.65,
        std_deviation: 0.15,
        percentiles: {
          p5: 0.35,
          p25: 0.55,
          p50: 0.65,
          p75: 0.75,
          p95: 0.90,
        },
        distribution: [],
        confidence_interval_low: 0.50,
        confidence_interval_high: 0.80,
        execution_time_ms: Date.now() - startTime,
        metadata: {},
        created_at: new Date().toISOString(),
      };

      const response: APIResponse<SimulationResult> = {
        success: true,
        data: result,
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to run simulation' };
    }
  });

  // GET /api/oracle/decide/decisions/:id/simulations - Get all simulations for decision
  fastify.get('/api/oracle/decide/decisions/:id/simulations', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const userId = getUserId(request);

      // In production, get simulations for all options of this decision
      const simulations: SimulationResult[] = [];

      const response: APIResponse<SimulationResult[]> = {
        success: true,
        data: simulations,
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to get simulations' };
    }
  });

  // GET /api/oracle/decide/decisions/:id/critical-path - Get critical path analysis
  fastify.get('/api/oracle/decide/decisions/:id/critical-path', async (request: FastifyRequest<{ Params: { id: string }; Querystring: { option_id?: string } }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const { option_id } = request.query;
      const userId = getUserId(request);

      // In production, get or generate critical path
      const criticalPath: CriticalPath | null = null;

      if (!criticalPath) {
        // Generate critical path if not exists
        // In production: use geminiService.analyzeCriticalPath()
      }

      const response: APIResponse<CriticalPath | null> = {
        success: true,
        data: criticalPath,
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to get critical path' };
    }
  });

  // POST /api/oracle/decide/decisions/:id/critical-path - Generate critical path
  fastify.post('/api/oracle/decide/decisions/:id/critical-path', async (request: FastifyRequest<{ Params: { id: string }; Body: { option_id?: string } }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const { option_id } = request.body;
      const userId = getUserId(request);

      // In production:
      // 1. Get decision and option
      // 2. Use geminiService.analyzeCriticalPath()
      // 3. Save critical path

      const criticalPath: CriticalPath = {
        id: crypto.randomUUID(),
        decision_id: id,
        option_id,
        user_id: userId,
        steps: [],
        dependencies: [],
        bottlenecks: [],
        total_duration_hours: 0,
        critical_sequence: [],
        parallel_tracks: [],
        risk_points: [],
        confidence: 0.7,
        metadata: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const response: APIResponse<CriticalPath> = {
        success: true,
        data: criticalPath,
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to generate critical path' };
    }
  });

  // POST /api/oracle/decide/decisions/:id/stakeholders - Add stakeholder input
  fastify.post('/api/oracle/decide/decisions/:id/stakeholders', async (request: FastifyRequest<{ Params: { id: string }; Body: StakeholderInputBody }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const body = request.body;
      const userId = getUserId(request);

      const input: StakeholderInput = {
        id: crypto.randomUUID(),
        decision_id: id,
        user_id: userId,
        stakeholder_name: body.stakeholder_name,
        stakeholder_role: body.stakeholder_role,
        input_type: body.input_type,
        content: body.content,
        weight: body.weight || 1.0,
        status: 'pending',
        metadata: body.metadata || {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // In production, save to supabase

      const response: APIResponse<StakeholderInput> = {
        success: true,
        data: input,
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to add stakeholder input' };
    }
  });

  // GET /api/oracle/decide/decisions/:id/stakeholders - Get stakeholder inputs
  fastify.get('/api/oracle/decide/decisions/:id/stakeholders', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const userId = getUserId(request);

      // In production, get from supabase
      const inputs: StakeholderInput[] = [];

      const response: APIResponse<StakeholderInput[]> = {
        success: true,
        data: inputs,
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to get stakeholder inputs' };
    }
  });

  // PATCH /api/oracle/decide/decisions/:id/select - Select option
  fastify.patch('/api/oracle/decide/decisions/:id/select', async (request: FastifyRequest<{ Params: { id: string }; Body: SelectOptionBody }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const { option_id, rationale } = request.body;
      const userId = getUserId(request);

      // In production:
      // 1. Verify option belongs to decision
      // 2. Update decision with selected_option_id, rationale, decided_at
      // 3. Update status to 'decided'

      const response: APIResponse<{ decision_id: string; selected_option_id: string; decided_at: string }> = {
        success: true,
        data: {
          decision_id: id,
          selected_option_id: option_id,
          decided_at: new Date().toISOString(),
        },
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to select option' };
    }
  });

  // POST /api/oracle/decide/decisions/:id/compare - Compare options
  fastify.post('/api/oracle/decide/decisions/:id/compare', async (request: FastifyRequest<{ Params: { id: string }; Body: { option_ids: string[] } }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const { option_ids } = request.body;
      const userId = getUserId(request);

      // In production, get options and their simulations for comparison

      const comparison = {
        decision_id: id,
        options: option_ids.map(optId => ({
          option_id: optId,
          simulation: null as SimulationResult | null,
          scores: {} as Record<string, number>,
        })),
        recommendation: option_ids[0],
        confidence: 0.7,
      };

      const response: APIResponse<typeof comparison> = {
        success: true,
        data: comparison,
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to compare options' };
    }
  });
}

export default decideRoutes;
