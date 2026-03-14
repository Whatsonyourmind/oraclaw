/**
 * ORACLE Batch API Endpoint
 * Story perf-3 - Request batching for mobile
 *
 * Features:
 * - POST /api/oracle/batch endpoint
 * - Client-side request batcher integration
 * - Configurable batch window (50-200ms)
 * - Error handling per operation
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createClient } from '@supabase/supabase-js';
import { performanceMonitor } from '../../services/oracle/performanceMonitor';

// ============================================================================
// TYPES
// ============================================================================

export type BatchOperationType =
  | 'signals.list'
  | 'signals.get'
  | 'signals.create'
  | 'signals.update'
  | 'signals.delete'
  | 'contexts.list'
  | 'contexts.get'
  | 'contexts.create'
  | 'decisions.list'
  | 'decisions.get'
  | 'decisions.create'
  | 'decisions.update'
  | 'plans.list'
  | 'plans.get'
  | 'plans.create'
  | 'steps.list'
  | 'steps.update'
  | 'ghost_actions.list'
  | 'ghost_actions.get'
  | 'ghost_actions.approve'
  | 'ghost_actions.reject'
  | 'analytics.record'
  | 'custom';

export interface BatchRequest {
  id: string;
  operation: BatchOperationType;
  path?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  params?: Record<string, any>;
  body?: any;
}

export interface BatchResponse {
  id: string;
  operation: BatchOperationType;
  success: boolean;
  data?: any;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  duration_ms: number;
}

export interface BatchResult {
  request_id: string;
  responses: BatchResponse[];
  total_duration_ms: number;
  processed_at: string;
}

// Request body type for batch endpoint
interface BatchRequestBody {
  operations: BatchRequest[];
}

// ============================================================================
// BATCH ROUTES
// ============================================================================

export async function batchRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/oracle/batch
   * Execute multiple operations in a single request
   */
  fastify.post('/api/oracle/batch', async (request: FastifyRequest<{ Body: BatchRequestBody }>, reply: FastifyReply) => {
    const startTime = performance.now();
    const requestId = (request.headers['x-request-id'] as string) || crypto.randomUUID();

    try {
      const { operations } = request.body;
      const userId = (request as any).userId; // From auth middleware
      const supabaseUrl = process.env.SUPABASE_URL!;
      const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;

      if (!operations || !Array.isArray(operations)) {
        reply.code(400);
        return {
          error: {
            code: 'INVALID_REQUEST',
            message: 'Operations array is required',
          },
        };
      }

      if (operations.length > 50) {
        reply.code(400);
        return {
          error: {
            code: 'TOO_MANY_OPERATIONS',
            message: 'Maximum 50 operations per batch request',
          },
        };
      }

      const supabase = createClient(supabaseUrl, supabaseKey);
      const responses: BatchResponse[] = [];

      // Process operations
      for (const op of operations) {
        const opStartTime = performance.now();
        let response: BatchResponse;

        try {
          const result = await executeOperation(supabase, userId, op);
          response = {
            id: op.id,
            operation: op.operation,
            success: true,
            data: result,
            duration_ms: performance.now() - opStartTime,
          };
        } catch (error) {
          response = {
            id: op.id,
            operation: op.operation,
            success: false,
            error: {
              code: error instanceof Error ? error.name : 'UNKNOWN_ERROR',
              message: error instanceof Error ? error.message : 'Unknown error occurred',
            },
            duration_ms: performance.now() - opStartTime,
          };
        }

        responses.push(response);
      }

      const totalDuration = performance.now() - startTime;

      // Track batch performance
      await performanceMonitor.recordMetric(
        'api_response',
        'batch_request',
        totalDuration,
        responses.every(r => r.success),
        {
          operation_count: operations.length,
          success_count: responses.filter(r => r.success).length,
          error_count: responses.filter(r => !r.success).length,
        }
      );

      const result: BatchResult = {
        request_id: requestId,
        responses,
        total_duration_ms: totalDuration,
        processed_at: new Date().toISOString(),
      };

      return result;
    } catch (error) {
      fastify.log.error(error, 'Batch request error');

      reply.code(500);
      return {
        error: {
          code: 'BATCH_ERROR',
          message: error instanceof Error ? error.message : 'Batch request failed',
        },
      };
    }
  });
}

// ============================================================================
// OPERATION HANDLERS
// ============================================================================

async function executeOperation(
  supabase: any,
  userId: string,
  op: BatchRequest
): Promise<any> {
  const { operation, params, body } = op;

  switch (operation) {
    // Signals
    case 'signals.list':
      return handleSignalsList(supabase, userId, params);
    case 'signals.get':
      return handleSignalsGet(supabase, userId, params);
    case 'signals.create':
      return handleSignalsCreate(supabase, userId, body);
    case 'signals.update':
      return handleSignalsUpdate(supabase, userId, params, body);
    case 'signals.delete':
      return handleSignalsDelete(supabase, userId, params);

    // Contexts
    case 'contexts.list':
      return handleContextsList(supabase, userId, params);
    case 'contexts.get':
      return handleContextsGet(supabase, userId, params);
    case 'contexts.create':
      return handleContextsCreate(supabase, userId, body);

    // Decisions
    case 'decisions.list':
      return handleDecisionsList(supabase, userId, params);
    case 'decisions.get':
      return handleDecisionsGet(supabase, userId, params);
    case 'decisions.create':
      return handleDecisionsCreate(supabase, userId, body);
    case 'decisions.update':
      return handleDecisionsUpdate(supabase, userId, params, body);

    // Plans
    case 'plans.list':
      return handlePlansList(supabase, userId, params);
    case 'plans.get':
      return handlePlansGet(supabase, userId, params);
    case 'plans.create':
      return handlePlansCreate(supabase, userId, body);

    // Steps
    case 'steps.list':
      return handleStepsList(supabase, userId, params);
    case 'steps.update':
      return handleStepsUpdate(supabase, userId, params, body);

    // Ghost Actions
    case 'ghost_actions.list':
      return handleGhostActionsList(supabase, userId, params);
    case 'ghost_actions.get':
      return handleGhostActionsGet(supabase, userId, params);
    case 'ghost_actions.approve':
      return handleGhostActionsApprove(supabase, userId, params);
    case 'ghost_actions.reject':
      return handleGhostActionsReject(supabase, userId, params);

    // Analytics
    case 'analytics.record':
      return handleAnalyticsRecord(supabase, userId, body);

    // Custom/passthrough
    case 'custom':
      return handleCustomOperation(supabase, userId, op);

    default:
      throw new Error(`Unknown operation: ${operation}`);
  }
}

// ============================================================================
// SIGNAL HANDLERS
// ============================================================================

async function handleSignalsList(
  supabase: any,
  userId: string,
  params?: Record<string, any>
): Promise<any> {
  let query = supabase
    .from('oracle_signals')
    .select('*')
    .eq('user_id', userId);

  if (params?.status) {
    query = query.eq('status', params.status);
  }
  if (params?.urgency) {
    query = query.eq('urgency', params.urgency);
  }
  if (params?.limit) {
    query = query.limit(params.limit);
  }
  query = query.order('created_at', { ascending: false });

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

async function handleSignalsGet(
  supabase: any,
  userId: string,
  params?: Record<string, any>
): Promise<any> {
  if (!params?.id) throw new Error('Signal ID required');

  const { data, error } = await supabase
    .from('oracle_signals')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', userId)
    .single();

  if (error) throw error;
  return data;
}

async function handleSignalsCreate(
  supabase: any,
  userId: string,
  body?: any
): Promise<any> {
  const { data, error } = await supabase
    .from('oracle_signals')
    .insert({ ...body, user_id: userId })
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function handleSignalsUpdate(
  supabase: any,
  userId: string,
  params?: Record<string, any>,
  body?: any
): Promise<any> {
  if (!params?.id) throw new Error('Signal ID required');

  const { data, error } = await supabase
    .from('oracle_signals')
    .update(body)
    .eq('id', params.id)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function handleSignalsDelete(
  supabase: any,
  userId: string,
  params?: Record<string, any>
): Promise<any> {
  if (!params?.id) throw new Error('Signal ID required');

  const { error } = await supabase
    .from('oracle_signals')
    .delete()
    .eq('id', params.id)
    .eq('user_id', userId);

  if (error) throw error;
  return { deleted: true };
}

// ============================================================================
// CONTEXT HANDLERS
// ============================================================================

async function handleContextsList(
  supabase: any,
  userId: string,
  params?: Record<string, any>
): Promise<any> {
  let query = supabase
    .from('oracle_strategic_contexts')
    .select('*')
    .eq('user_id', userId);

  if (params?.limit) {
    query = query.limit(params.limit);
  }
  query = query.order('created_at', { ascending: false });

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

async function handleContextsGet(
  supabase: any,
  userId: string,
  params?: Record<string, any>
): Promise<any> {
  if (!params?.id) throw new Error('Context ID required');

  const { data, error } = await supabase
    .from('oracle_strategic_contexts')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', userId)
    .single();

  if (error) throw error;
  return data;
}

async function handleContextsCreate(
  supabase: any,
  userId: string,
  body?: any
): Promise<any> {
  const { data, error } = await supabase
    .from('oracle_strategic_contexts')
    .insert({ ...body, user_id: userId })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ============================================================================
// DECISION HANDLERS
// ============================================================================

async function handleDecisionsList(
  supabase: any,
  userId: string,
  params?: Record<string, any>
): Promise<any> {
  let query = supabase
    .from('oracle_decisions')
    .select('*, oracle_decision_options(*)')
    .eq('user_id', userId);

  if (params?.status) {
    query = query.eq('status', params.status);
  }
  if (params?.limit) {
    query = query.limit(params.limit);
  }
  query = query.order('created_at', { ascending: false });

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

async function handleDecisionsGet(
  supabase: any,
  userId: string,
  params?: Record<string, any>
): Promise<any> {
  if (!params?.id) throw new Error('Decision ID required');

  const { data, error } = await supabase
    .from('oracle_decisions')
    .select('*, oracle_decision_options(*)')
    .eq('id', params.id)
    .eq('user_id', userId)
    .single();

  if (error) throw error;
  return data;
}

async function handleDecisionsCreate(
  supabase: any,
  userId: string,
  body?: any
): Promise<any> {
  const { data, error } = await supabase
    .from('oracle_decisions')
    .insert({ ...body, user_id: userId })
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function handleDecisionsUpdate(
  supabase: any,
  userId: string,
  params?: Record<string, any>,
  body?: any
): Promise<any> {
  if (!params?.id) throw new Error('Decision ID required');

  const { data, error } = await supabase
    .from('oracle_decisions')
    .update(body)
    .eq('id', params.id)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ============================================================================
// PLAN HANDLERS
// ============================================================================

async function handlePlansList(
  supabase: any,
  userId: string,
  params?: Record<string, any>
): Promise<any> {
  let query = supabase
    .from('oracle_execution_plans')
    .select('*')
    .eq('user_id', userId);

  if (params?.status) {
    query = query.eq('status', params.status);
  }
  if (params?.limit) {
    query = query.limit(params.limit);
  }
  query = query.order('created_at', { ascending: false });

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

async function handlePlansGet(
  supabase: any,
  userId: string,
  params?: Record<string, any>
): Promise<any> {
  if (!params?.id) throw new Error('Plan ID required');

  const { data, error } = await supabase
    .from('oracle_execution_plans')
    .select('*, oracle_execution_steps(*)')
    .eq('id', params.id)
    .eq('user_id', userId)
    .single();

  if (error) throw error;
  return data;
}

async function handlePlansCreate(
  supabase: any,
  userId: string,
  body?: any
): Promise<any> {
  const { data, error } = await supabase
    .from('oracle_execution_plans')
    .insert({ ...body, user_id: userId })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ============================================================================
// STEP HANDLERS
// ============================================================================

async function handleStepsList(
  supabase: any,
  userId: string,
  params?: Record<string, any>
): Promise<any> {
  if (!params?.plan_id) throw new Error('Plan ID required');

  const { data, error } = await supabase
    .from('oracle_execution_steps')
    .select('*')
    .eq('plan_id', params.plan_id)
    .eq('user_id', userId)
    .order('order_index', { ascending: true });

  if (error) throw error;
  return data;
}

async function handleStepsUpdate(
  supabase: any,
  userId: string,
  params?: Record<string, any>,
  body?: any
): Promise<any> {
  if (!params?.id) throw new Error('Step ID required');

  const { data, error } = await supabase
    .from('oracle_execution_steps')
    .update(body)
    .eq('id', params.id)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ============================================================================
// GHOST ACTION HANDLERS
// ============================================================================

async function handleGhostActionsList(
  supabase: any,
  userId: string,
  params?: Record<string, any>
): Promise<any> {
  let query = supabase
    .from('oracle_ghost_actions')
    .select('*')
    .eq('user_id', userId);

  if (params?.status) {
    query = query.eq('status', params.status);
  }
  if (params?.limit) {
    query = query.limit(params.limit);
  }
  query = query.order('created_at', { ascending: false });

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

async function handleGhostActionsGet(
  supabase: any,
  userId: string,
  params?: Record<string, any>
): Promise<any> {
  if (!params?.id) throw new Error('Ghost Action ID required');

  const { data, error } = await supabase
    .from('oracle_ghost_actions')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', userId)
    .single();

  if (error) throw error;
  return data;
}

async function handleGhostActionsApprove(
  supabase: any,
  userId: string,
  params?: Record<string, any>
): Promise<any> {
  if (!params?.id) throw new Error('Ghost Action ID required');

  const { data, error } = await supabase
    .from('oracle_ghost_actions')
    .update({
      status: 'approved',
      approved_at: new Date().toISOString(),
    })
    .eq('id', params.id)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function handleGhostActionsReject(
  supabase: any,
  userId: string,
  params?: Record<string, any>
): Promise<any> {
  if (!params?.id) throw new Error('Ghost Action ID required');

  const { data, error } = await supabase
    .from('oracle_ghost_actions')
    .update({
      status: 'rejected',
      rejected_at: new Date().toISOString(),
    })
    .eq('id', params.id)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ============================================================================
// ANALYTICS HANDLER
// ============================================================================

async function handleAnalyticsRecord(
  supabase: any,
  userId: string,
  body?: any
): Promise<any> {
  const { data, error } = await supabase
    .from('oracle_analytics_events')
    .insert({
      ...body,
      user_id: userId,
      timestamp: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ============================================================================
// CUSTOM OPERATION HANDLER
// ============================================================================

async function handleCustomOperation(
  supabase: any,
  userId: string,
  op: BatchRequest
): Promise<any> {
  // Custom operations use path/method for direct table access
  if (!op.path || !op.method) {
    throw new Error('Custom operations require path and method');
  }

  const tableName = op.path.replace(/^\//, '').split('/')[0];

  // Validate table is an ORACLE table
  if (!tableName.startsWith('oracle_')) {
    throw new Error('Custom operations only allowed on oracle_ tables');
  }

  let query;
  switch (op.method) {
    case 'GET':
      query = supabase.from(tableName).select('*').eq('user_id', userId);
      if (op.params?.id) {
        query = query.eq('id', op.params.id);
      }
      break;
    case 'POST':
      query = supabase.from(tableName).insert({ ...op.body, user_id: userId }).select();
      break;
    case 'PUT':
    case 'PATCH':
      if (!op.params?.id) throw new Error('ID required for update');
      query = supabase.from(tableName).update(op.body).eq('id', op.params.id).eq('user_id', userId).select();
      break;
    case 'DELETE':
      if (!op.params?.id) throw new Error('ID required for delete');
      query = supabase.from(tableName).delete().eq('id', op.params.id).eq('user_id', userId);
      return { deleted: true };
    default:
      throw new Error(`Unsupported method: ${op.method}`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export default batchRoutes;
