import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type {
  EnvironmentState,
  ContextNode,
  ContextEdge,
  ContextGraph,
  GhostAction,
  APIResponse,
  ContextNodeType,
  ContextEdgeType,
  GhostActionType,
  GhostActionStatus,
} from '@mission-control/shared-types';

// Types for request bodies
interface SnapshotCreateBody {
  snapshot_type?: 'periodic' | 'triggered' | 'manual' | 'event';
  location?: {
    latitude?: number;
    longitude?: number;
    accuracy?: number;
    place_name?: string;
    place_type?: string;
  };
  device_state?: {
    platform?: string;
    is_foreground?: boolean;
    screen_on?: boolean;
    orientation?: string;
  };
  network_state?: {
    type?: 'wifi' | 'cellular' | 'offline';
    is_connected?: boolean;
    bandwidth_estimate?: number;
  };
  battery_level?: number;
  calendar_context?: {
    current_event?: string;
    next_event?: string;
    next_event_in_minutes?: number;
    free_until?: string;
  };
  active_apps?: string[];
  metadata?: Record<string, any>;
}

interface NodeCreateBody {
  node_type: ContextNodeType;
  name: string;
  description?: string;
  properties?: Record<string, any>;
  importance?: number;
  metadata?: Record<string, any>;
}

interface EdgeCreateBody {
  source_node_id: string;
  target_node_id: string;
  edge_type: ContextEdgeType;
  strength?: number;
  direction?: 'forward' | 'backward' | 'bidirectional';
  properties?: Record<string, any>;
  metadata?: Record<string, any>;
}

interface GhostActionCreateBody {
  action_type: GhostActionType;
  title: string;
  description?: string;
  draft_action: Record<string, any>;
  trigger_conditions?: {
    time_based?: string;
    location_based?: Record<string, any>;
    context_based?: Record<string, any>;
    signal_based?: string[];
  };
  auto_trigger_enabled?: boolean;
  auto_trigger_at?: string;
  rationale?: string;
  expires_at?: string;
  related_signals?: string[];
  metadata?: Record<string, any>;
}

// Mock user ID
const getMockUserId = () => 'mock-user-id';

export async function environmentRoutes(fastify: FastifyInstance) {
  // POST /api/oracle/environment/snapshot - Capture environment state
  fastify.post('/api/oracle/environment/snapshot', async (request: FastifyRequest<{ Body: SnapshotCreateBody }>, reply: FastifyReply) => {
    try {
      const userId = getMockUserId();
      const body = request.body;

      const now = new Date();
      const snapshot: EnvironmentState = {
        id: crypto.randomUUID(),
        user_id: userId,
        snapshot_type: body.snapshot_type || 'manual',
        location: body.location || {},
        device_state: body.device_state || {},
        network_state: body.network_state || {},
        battery_level: body.battery_level,
        calendar_context: body.calendar_context || {},
        time_context: {
          local_time: now.toISOString(),
          day_of_week: now.toLocaleDateString('en-US', { weekday: 'long' }),
          is_work_hours: now.getHours() >= 9 && now.getHours() < 17,
          time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        active_apps: body.active_apps || [],
        metadata: body.metadata || {},
        created_at: now.toISOString(),
      };

      // In production, save to supabase

      const response: APIResponse<EnvironmentState> = {
        success: true,
        data: snapshot,
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to capture snapshot' };
    }
  });

  // GET /api/oracle/environment/snapshot/latest - Get latest snapshot
  fastify.get('/api/oracle/environment/snapshot/latest', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = getMockUserId();

      // In production, get latest from supabase
      const snapshot: EnvironmentState | null = null;

      const response: APIResponse<EnvironmentState | null> = {
        success: true,
        data: snapshot,
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to get snapshot' };
    }
  });

  // GET /api/oracle/environment/snapshots - Get snapshot history
  fastify.get('/api/oracle/environment/snapshots', async (request: FastifyRequest<{ Querystring: { limit?: number; since?: string } }>, reply: FastifyReply) => {
    try {
      const userId = getMockUserId();
      const { limit = 50, since } = request.query;

      // In production, get from supabase with filters
      const snapshots: EnvironmentState[] = [];

      const response: APIResponse<EnvironmentState[]> = {
        success: true,
        data: snapshots,
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to get snapshots' };
    }
  });

  // GET /api/oracle/environment/graph - Get context graph
  fastify.get('/api/oracle/environment/graph', async (request: FastifyRequest<{ Querystring: { focal_node_id?: string; depth?: number } }>, reply: FastifyReply) => {
    try {
      const userId = getMockUserId();
      const { focal_node_id, depth = 2 } = request.query;

      // In production:
      // 1. Get nodes (optionally starting from focal node)
      // 2. Get edges between nodes
      // 3. Limit to specified depth

      const graph: ContextGraph = {
        nodes: [],
        edges: [],
        focal_node_id,
        depth,
        generated_at: new Date().toISOString(),
      };

      const response: APIResponse<ContextGraph> = {
        success: true,
        data: graph,
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to get graph' };
    }
  });

  // GET /api/oracle/environment/graph/nodes - List nodes
  fastify.get('/api/oracle/environment/graph/nodes', async (request: FastifyRequest<{ Querystring: { node_type?: ContextNodeType; active_only?: boolean } }>, reply: FastifyReply) => {
    try {
      const userId = getMockUserId();
      const { node_type, active_only = true } = request.query;

      // In production, get from supabase with filters
      const nodes: ContextNode[] = [];

      const response: APIResponse<ContextNode[]> = {
        success: true,
        data: nodes,
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to get nodes' };
    }
  });

  // POST /api/oracle/environment/graph/nodes - Add context node
  fastify.post('/api/oracle/environment/graph/nodes', async (request: FastifyRequest<{ Body: NodeCreateBody }>, reply: FastifyReply) => {
    try {
      const userId = getMockUserId();
      const body = request.body;

      const node: ContextNode = {
        id: crypto.randomUUID(),
        user_id: userId,
        node_type: body.node_type,
        name: body.name,
        description: body.description,
        properties: body.properties || {},
        importance: body.importance || 0.5,
        recency_score: 1.0,
        last_accessed_at: new Date().toISOString(),
        access_count: 1,
        is_active: true,
        metadata: body.metadata || {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // In production, save to supabase

      const response: APIResponse<ContextNode> = {
        success: true,
        data: node,
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to create node' };
    }
  });

  // PATCH /api/oracle/environment/graph/nodes/:id - Update node
  fastify.patch('/api/oracle/environment/graph/nodes/:id', async (request: FastifyRequest<{ Params: { id: string }; Body: Partial<NodeCreateBody> }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const body = request.body;
      const userId = getMockUserId();

      // In production, update in supabase

      const response: APIResponse<{ id: string; updated: boolean }> = {
        success: true,
        data: { id, updated: true },
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to update node' };
    }
  });

  // POST /api/oracle/environment/graph/nodes/:id/access - Record node access
  fastify.post('/api/oracle/environment/graph/nodes/:id/access', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const userId = getMockUserId();

      // In production:
      // 1. Update last_accessed_at
      // 2. Increment access_count
      // 3. Recalculate recency_score

      const response: APIResponse<{ id: string; accessed: boolean }> = {
        success: true,
        data: { id, accessed: true },
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to record access' };
    }
  });

  // POST /api/oracle/environment/graph/edges - Add context edge
  fastify.post('/api/oracle/environment/graph/edges', async (request: FastifyRequest<{ Body: EdgeCreateBody }>, reply: FastifyReply) => {
    try {
      const userId = getMockUserId();
      const body = request.body;

      const edge: ContextEdge = {
        id: crypto.randomUUID(),
        user_id: userId,
        source_node_id: body.source_node_id,
        target_node_id: body.target_node_id,
        edge_type: body.edge_type,
        strength: body.strength || 0.5,
        direction: body.direction || 'forward',
        properties: body.properties || {},
        last_reinforced_at: new Date().toISOString(),
        reinforcement_count: 1,
        metadata: body.metadata || {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // In production, save to supabase (upsert based on unique constraint)

      const response: APIResponse<ContextEdge> = {
        success: true,
        data: edge,
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to create edge' };
    }
  });

  // POST /api/oracle/environment/graph/edges/:id/reinforce - Reinforce edge
  fastify.post('/api/oracle/environment/graph/edges/:id/reinforce', async (request: FastifyRequest<{ Params: { id: string }; Body: { strength_delta?: number } }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const { strength_delta = 0.1 } = request.body;
      const userId = getMockUserId();

      // In production:
      // 1. Update strength (capped at 1.0)
      // 2. Update last_reinforced_at
      // 3. Increment reinforcement_count

      const response: APIResponse<{ id: string; reinforced: boolean }> = {
        success: true,
        data: { id, reinforced: true },
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to reinforce edge' };
    }
  });

  // GET /api/oracle/environment/ghost-actions - List ghost actions
  fastify.get('/api/oracle/environment/ghost-actions', async (request: FastifyRequest<{ Querystring: { status?: GhostActionStatus; action_type?: GhostActionType } }>, reply: FastifyReply) => {
    try {
      const userId = getMockUserId();
      const { status, action_type } = request.query;

      // In production, get from supabase with filters
      const ghostActions: GhostAction[] = [];

      const response: APIResponse<GhostAction[]> = {
        success: true,
        data: ghostActions,
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to get ghost actions' };
    }
  });

  // POST /api/oracle/environment/ghost-actions - Create ghost action
  fastify.post('/api/oracle/environment/ghost-actions', async (request: FastifyRequest<{ Body: GhostActionCreateBody }>, reply: FastifyReply) => {
    try {
      const userId = getMockUserId();
      const body = request.body;

      const ghostAction: GhostAction = {
        id: crypto.randomUUID(),
        user_id: userId,
        action_type: body.action_type,
        title: body.title,
        description: body.description,
        draft_action: body.draft_action,
        trigger_conditions: body.trigger_conditions || {},
        auto_trigger_enabled: body.auto_trigger_enabled || false,
        auto_trigger_at: body.auto_trigger_at,
        confidence: 0.7,
        rationale: body.rationale,
        status: 'pending',
        expires_at: body.expires_at,
        related_signals: body.related_signals || [],
        metadata: body.metadata || {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // In production, save to supabase

      const response: APIResponse<GhostAction> = {
        success: true,
        data: ghostAction,
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to create ghost action' };
    }
  });

  // GET /api/oracle/environment/ghost-actions/:id - Get ghost action
  fastify.get('/api/oracle/environment/ghost-actions/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const userId = getMockUserId();

      // In production, get from supabase
      const ghostAction: GhostAction | null = null;

      if (!ghostAction) {
        reply.code(404);
        return { success: false, error: 'Ghost action not found' };
      }

      const response: APIResponse<GhostAction> = {
        success: true,
        data: ghostAction,
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to get ghost action' };
    }
  });

  // PATCH /api/oracle/environment/ghost-actions/:id - Approve/reject ghost action
  fastify.patch('/api/oracle/environment/ghost-actions/:id', async (request: FastifyRequest<{ Params: { id: string }; Body: { action: 'approve' | 'reject' | 'cancel' } }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const { action } = request.body;
      const userId = getMockUserId();

      let newStatus: GhostActionStatus;
      let timestamp: string = new Date().toISOString();

      switch (action) {
        case 'approve':
          newStatus = 'approved';
          // In production, would set approved_at
          break;
        case 'reject':
          newStatus = 'rejected';
          // In production, would set rejected_at
          break;
        case 'cancel':
          newStatus = 'cancelled';
          break;
        default:
          reply.code(400);
          return { success: false, error: 'Invalid action' };
      }

      // In production, update in supabase

      const response: APIResponse<{ id: string; status: GhostActionStatus; updated_at: string }> = {
        success: true,
        data: { id, status: newStatus, updated_at: timestamp },
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to update ghost action' };
    }
  });

  // POST /api/oracle/environment/ghost-actions/:id/execute - Execute approved ghost action
  fastify.post('/api/oracle/environment/ghost-actions/:id/execute', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const userId = getMockUserId();

      // In production:
      // 1. Verify ghost action is approved
      // 2. Execute the draft_action based on action_type
      // 3. Update status to 'executed'
      // 4. Set executed_at

      const response: APIResponse<{ id: string; executed: boolean; executed_at: string }> = {
        success: true,
        data: {
          id,
          executed: true,
          executed_at: new Date().toISOString(),
        },
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { success: false, error: 'Failed to execute ghost action' };
    }
  });
}

export default environmentRoutes;
