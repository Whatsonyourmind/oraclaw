import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getUserId } from '../../services/auth/authMiddleware.js';
import type {
  OracleState,
  OODALoopRecord,
  OracleConfig,
  APIResponse,
  OODAPhase,
  ORACLE_COLORS,
} from '@mission-control/shared-types';

import { observeRoutes } from './observe';
import { orientRoutes } from './orient';
import { decideRoutes } from './decide';
import { actRoutes } from './act';
import { probabilityRoutes } from './probability';
import { environmentRoutes } from './environment';
import { teamRoutes } from './teams';
import { collaborativeRoutes } from './collaborative';
import { analyticsRoutes } from './analytics';
import { journalRoutes } from './journal';
import { queryRoutes } from './query';
import { exportRoutes } from './export';
import { scenarioRoutes } from './scenarios';
import { webhookRoutes } from './webhooks';
import { batchRoutes } from './batch';
import { googleIntegrationRoutes } from './integrations/google';
import { githubIntegrationRoutes } from './integrations/github';
import publicApiRoutes from './api-public';

// In-memory state for demo (would be persisted in production)
const oracleStateStore = new Map<string, OracleState>();

// Helper to get or create oracle state
function getOracleState(userId: string): OracleState {
  if (!oracleStateStore.has(userId)) {
    oracleStateStore.set(userId, {
      current_phase: 'idle',
      active_signal_ids: [],
      loop_running: false,
      loop_paused: false,
      last_phase_transition: new Date().toISOString(),
      phase_durations: {
        observe: 0,
        orient: 0,
        decide: 0,
        act: 0,
        idle: 0,
      },
      system_confidence: 0.7,
      proactivity_level: 'medium',
      metadata: {},
    });
  }
  return oracleStateStore.get(userId)!;
}

export async function oracleRoutes(fastify: FastifyInstance) {
  // Register all sub-routes
  await observeRoutes(fastify);
  await orientRoutes(fastify);
  await decideRoutes(fastify);
  await actRoutes(fastify);
  await probabilityRoutes(fastify);
  await environmentRoutes(fastify);
  await teamRoutes(fastify);
  await collaborativeRoutes(fastify);
  await analyticsRoutes(fastify);
  await journalRoutes(fastify);
  await queryRoutes(fastify);
  await exportRoutes(fastify);
  await scenarioRoutes(fastify);
  await webhookRoutes(fastify);
  await batchRoutes(fastify);
  await googleIntegrationRoutes(fastify);
  await githubIntegrationRoutes(fastify);
  await publicApiRoutes(fastify);

  // ==========================================
  // ORACLE ORCHESTRATION ROUTES
  // ==========================================

  // GET /api/oracle/status - Get current OODA phase and state
  fastify.get('/api/oracle/status', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = getUserId(request);
      const state = getOracleState(userId);

      const response: APIResponse<OracleState> = {
        success: true,
        data: state,
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to get oracle status' };
    }
  });

  // POST /api/oracle/loop/start - Start autonomous loop
  fastify.post('/api/oracle/loop/start', async (request: FastifyRequest<{ Body: { config?: Partial<OracleConfig> } }>, reply: FastifyReply) => {
    try {
      const userId = getUserId(request);
      const { config } = request.body;
      const state = getOracleState(userId);

      if (state.loop_running && !state.loop_paused) {
        reply.code(400);
        return { success: false, error: 'Loop is already running' };
      }

      state.loop_running = true;
      state.loop_paused = false;
      state.current_phase = 'observe';
      state.last_phase_transition = new Date().toISOString();

      // In production:
      // 1. Start background job/interval for loop execution
      // 2. Apply config settings
      // 3. Trigger initial observe phase

      const response: APIResponse<{ started: boolean; state: OracleState }> = {
        success: true,
        data: {
          started: true,
          state,
        },
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to start loop' };
    }
  });

  // POST /api/oracle/loop/pause - Pause loop
  fastify.post('/api/oracle/loop/pause', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = getUserId(request);
      const state = getOracleState(userId);

      if (!state.loop_running) {
        reply.code(400);
        return { success: false, error: 'Loop is not running' };
      }

      state.loop_paused = true;

      // In production, pause background job

      const response: APIResponse<{ paused: boolean; state: OracleState }> = {
        success: true,
        data: {
          paused: true,
          state,
        },
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to pause loop' };
    }
  });

  // POST /api/oracle/loop/resume - Resume paused loop
  fastify.post('/api/oracle/loop/resume', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = getUserId(request);
      const state = getOracleState(userId);

      if (!state.loop_running) {
        reply.code(400);
        return { success: false, error: 'Loop is not running' };
      }

      if (!state.loop_paused) {
        reply.code(400);
        return { success: false, error: 'Loop is not paused' };
      }

      state.loop_paused = false;

      // In production, resume background job

      const response: APIResponse<{ resumed: boolean; state: OracleState }> = {
        success: true,
        data: {
          resumed: true,
          state,
        },
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to resume loop' };
    }
  });

  // POST /api/oracle/loop/stop - Stop loop completely
  fastify.post('/api/oracle/loop/stop', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = getUserId(request);
      const state = getOracleState(userId);

      state.loop_running = false;
      state.loop_paused = false;
      state.current_phase = 'idle';
      state.last_phase_transition = new Date().toISOString();

      // In production, stop background job

      const response: APIResponse<{ stopped: boolean; state: OracleState }> = {
        success: true,
        data: {
          stopped: true,
          state,
        },
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to stop loop' };
    }
  });

  // POST /api/oracle/phase/transition - Manually transition to specific phase
  fastify.post('/api/oracle/phase/transition', async (request: FastifyRequest<{ Body: { target_phase: OODAPhase } }>, reply: FastifyReply) => {
    try {
      const userId = getUserId(request);
      const { target_phase } = request.body;
      const state = getOracleState(userId);

      const previousPhase = state.current_phase;
      state.current_phase = target_phase;
      state.last_phase_transition = new Date().toISOString();

      // In production:
      // 1. Record phase duration for previous phase
      // 2. Trigger appropriate actions for new phase

      const response: APIResponse<{ previous_phase: OODAPhase; current_phase: OODAPhase; transitioned_at: string }> = {
        success: true,
        data: {
          previous_phase: previousPhase,
          current_phase: target_phase,
          transitioned_at: state.last_phase_transition,
        },
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to transition phase' };
    }
  });

  // GET /api/oracle/dashboard - Get unified dashboard data
  fastify.get('/api/oracle/dashboard', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = getUserId(request);
      const state = getOracleState(userId);

      // In production, aggregate data from all modules
      const dashboard = {
        state,
        summary: {
          active_signals: 0,
          pending_decisions: 0,
          active_plans: 0,
          pending_ghost_actions: 0,
          calibration_score: 0.85,
        },
        recent_activity: [] as Array<{
          type: string;
          description: string;
          timestamp: string;
          phase: OODAPhase;
        }>,
        health: {
          overall: 'healthy' as 'healthy' | 'at_risk' | 'critical',
          issues: [] as string[],
          recommendations: [] as string[],
        },
        phase_colors: {
          observe: '#00BFFF',
          orient: '#FFD700',
          decide: '#FF6B6B',
          act: '#00FF88',
          idle: '#808080',
        },
      };

      const response: APIResponse<typeof dashboard> = {
        success: true,
        data: dashboard,
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to get dashboard' };
    }
  });

  // GET /api/oracle/history - Get OODA loop history
  fastify.get('/api/oracle/history', async (request: FastifyRequest<{ Querystring: { limit?: number; since?: string } }>, reply: FastifyReply) => {
    try {
      const userId = getUserId(request);
      const { limit = 20, since } = request.query;

      // In production, get from database
      const history: OODALoopRecord[] = [];

      const response: APIResponse<OODALoopRecord[]> = {
        success: true,
        data: history,
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to get history' };
    }
  });

  // GET /api/oracle/config - Get current configuration
  fastify.get('/api/oracle/config', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = getUserId(request);

      // In production, get from user settings
      const config: OracleConfig = {
        scan_interval_minutes: 15,
        auto_orient_enabled: true,
        auto_decide_threshold: 0.8,
        auto_execute_enabled: false,
        ghost_action_approval_mode: 'always_ask',
        proactivity_level: 'medium',
        attention_budget: {
          total_daily_budget: 100,
          used_today: 0,
          remaining: 100,
          category_budgets: {},
          interruption_threshold: 0.7,
          focus_mode_active: false,
          last_reset: new Date().toISOString(),
        },
        notification_preferences: {
          critical_signals: true,
          decision_prompts: true,
          execution_updates: true,
          learning_summaries: false,
        },
      };

      const response: APIResponse<OracleConfig> = {
        success: true,
        data: config,
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to get config' };
    }
  });

  // PATCH /api/oracle/config - Update configuration
  fastify.patch('/api/oracle/config', async (request: FastifyRequest<{ Body: Partial<OracleConfig> }>, reply: FastifyReply) => {
    try {
      const userId = getUserId(request);
      const updates = request.body;

      // In production, update user settings

      const response: APIResponse<{ updated: boolean }> = {
        success: true,
        data: { updated: true },
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to update config' };
    }
  });

  // POST /api/oracle/trigger/:phase - Manually trigger a specific phase
  fastify.post('/api/oracle/trigger/:phase', async (request: FastifyRequest<{ Params: { phase: OODAPhase } }>, reply: FastifyReply) => {
    try {
      const { phase } = request.params;
      const userId = getUserId(request);
      const state = getOracleState(userId);

      // Validate phase
      const validPhases: OODAPhase[] = ['observe', 'orient', 'decide', 'act'];
      if (!validPhases.includes(phase)) {
        reply.code(400);
        return { success: false, error: 'Invalid phase' };
      }

      // In production:
      // 1. Execute the appropriate phase logic
      // 2. Update state
      // 3. Return results

      state.current_phase = phase;
      state.last_phase_transition = new Date().toISOString();

      const response: APIResponse<{ triggered: OODAPhase; state: OracleState }> = {
        success: true,
        data: {
          triggered: phase,
          state,
        },
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to trigger phase' };
    }
  });
}

export default oracleRoutes;
