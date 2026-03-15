/**
 * WebSocket Route
 * Provides real-time event streaming with JWT authentication
 * Wires into the OODA loop orchestrator for phase transition events
 */

import { FastifyInstance, FastifyRequest } from 'fastify';
import { verifyAccessToken } from '../services/auth/jwt.js';
import {
  getWebSocketServer,
  getEventEmitter,
  OracleWebSocketServer,
  OracleEventEmitter,
} from '../services/oracle/infrastructure/websocket.js';
import type { JWTPayload } from '../services/auth/jwt.js';

// OODA phase transition event types
export interface PhaseTransitionEvent {
  previousPhase: string;
  currentPhase: string;
  userId: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface BriefingNotification {
  id: string;
  userId: string;
  date: string;
  summary: string;
  timestamp: string;
}

export interface SignalAlert {
  id: string;
  userId: string;
  signalType: string;
  title: string;
  urgency: string;
  timestamp: string;
}

// WebSocket event bus - singleton for emitting events from route handlers
class OracleEventBus {
  private wsServer: OracleWebSocketServer;
  private eventEmitter: OracleEventEmitter;

  constructor() {
    this.wsServer = getWebSocketServer({
      authentication: {
        enabled: true,
        tokenHeader: 'Authorization',
        validateToken: async (token: string) => {
          try {
            const payload = verifyAccessToken(token);
            return {
              valid: true,
              userId: payload.userId,
              permissions: [payload.tier],
            };
          } catch {
            return { valid: false, error: 'Invalid token' };
          }
        },
      },
    });
    this.eventEmitter = getEventEmitter();
  }

  /** Emit decision update to a user */
  emitDecisionUpdate(userId: string, decision: {
    id: string;
    status: string;
    title: string;
    confidence: number;
  }): void {
    this.eventEmitter.emitDecisionToUser(userId, 'decision:updated', {
      id: decision.id,
      signalId: '',
      status: decision.status as any,
      recommendation: decision.title,
      confidence: decision.confidence,
      userId,
    });
  }

  /** Emit signal alert when anomaly detected */
  emitSignalAlert(userId: string, signal: SignalAlert): void {
    this.eventEmitter.emitSignalToUser(userId, 'signal:urgent', {
      id: signal.id,
      type: signal.signalType,
      urgency: signal.urgency as any,
      title: signal.title,
      description: '',
      createdAt: Date.now(),
      userId,
    });
  }

  /** Emit briefing notification */
  emitBriefingNotification(userId: string, briefing: BriefingNotification): void {
    this.eventEmitter.emitNotification(userId, {
      id: briefing.id,
      type: 'info',
      title: 'New Briefing Available',
      body: briefing.summary,
      createdAt: Date.now(),
      data: { date: briefing.date },
    });
  }

  /** Emit OODA phase transition */
  emitPhaseTransition(userId: string, transition: PhaseTransitionEvent): void {
    this.wsServer.emitToUser(userId, 'notification:new', {
      id: `phase-${Date.now()}`,
      type: 'info',
      title: `OODA Phase: ${transition.currentPhase}`,
      body: `Transitioned from ${transition.previousPhase} to ${transition.currentPhase}`,
      createdAt: Date.now(),
      data: transition,
    });
  }

  /** Get server instance for health checks */
  getServer(): OracleWebSocketServer {
    return this.wsServer;
  }
}

// Singleton event bus
let eventBusInstance: OracleEventBus | null = null;

export function getOracleEventBus(): OracleEventBus {
  if (!eventBusInstance) {
    eventBusInstance = new OracleEventBus();
  }
  return eventBusInstance;
}

/**
 * WebSocket routes registration
 * Provides /ws endpoint info and health check
 */
export async function wsRoutes(fastify: FastifyInstance) {
  const eventBus = getOracleEventBus();

  // GET /api/ws/info - WebSocket connection information
  fastify.get('/api/ws/info', async () => {
    return {
      success: true,
      data: {
        endpoint: '/ws',
        protocol: 'websocket',
        auth: 'JWT Bearer token required in connection query',
        events: {
          server_to_client: [
            'signal:created', 'signal:updated', 'signal:deleted', 'signal:urgent',
            'decision:created', 'decision:updated', 'decision:completed',
            'prediction:new', 'prediction:updated',
            'simulation:started', 'simulation:progress', 'simulation:completed',
            'notification:new', 'notification:dismissed',
            'system:maintenance', 'system:reconnect',
          ],
          client_to_server: [
            'subscribe:signals', 'unsubscribe:signals',
            'subscribe:decision', 'unsubscribe:decision',
            'subscribe:simulation', 'unsubscribe:simulation',
            'presence:active', 'presence:away',
            'ping',
          ],
        },
        rooms: [
          'user:{userId}', 'signals:{userId}',
          'decision:{decisionId}', 'simulation:{simulationId}',
          'mission:{missionId}', 'team:{teamId}',
        ],
      },
    };
  });

  // GET /api/ws/health - WebSocket server health
  fastify.get('/api/ws/health', async () => {
    const health = eventBus.getServer().healthCheck();
    return {
      success: true,
      data: health,
    };
  });

  // GET /api/ws/metrics - WebSocket metrics
  fastify.get('/api/ws/metrics', async () => {
    const metrics = eventBus.getServer().getMetrics();
    return {
      success: true,
      data: metrics,
    };
  });
}

export default wsRoutes;
