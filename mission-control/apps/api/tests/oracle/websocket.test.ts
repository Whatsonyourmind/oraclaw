/**
 * WebSocket Service Tests
 * Tests the event bus, real-time events, and OODA phase transitions
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getOracleEventBus } from '../../src/routes/ws';
import {
  OracleWebSocketServer,
  createWebSocketServer,
  getWebSocketServer,
  getEventEmitter,
} from '../../src/services/oracle/infrastructure/websocket';

describe('WebSocket Server', () => {
  let wsServer: OracleWebSocketServer;

  beforeEach(() => {
    wsServer = createWebSocketServer({
      authentication: {
        enabled: false,
        tokenHeader: 'Authorization',
        validateToken: async () => ({ valid: true, userId: 'test-user' }),
      },
    });
  });

  describe('Connection handling', () => {
    it('should handle new connections', async () => {
      await wsServer.start();
      const socket = await wsServer.handleConnection('socket-1');

      expect(socket).toBeTruthy();
      expect(socket?.id).toBe('socket-1');
    });

    it('should track metrics on connection', async () => {
      await wsServer.start();
      await wsServer.handleConnection('socket-1');
      await wsServer.handleConnection('socket-2');

      const metrics = wsServer.getMetrics();
      expect(metrics.connections).toBe(2);
      expect(metrics.currentConnections).toBe(2);
    });

    it('should handle disconnection', async () => {
      await wsServer.start();
      await wsServer.handleConnection('socket-1');
      await wsServer.handleDisconnection('socket-1', 'test');

      const metrics = wsServer.getMetrics();
      expect(metrics.disconnections).toBe(1);
      expect(metrics.currentConnections).toBe(0);
    });
  });

  describe('Room management', () => {
    it('should join rooms', async () => {
      await wsServer.start();
      await wsServer.handleConnection('socket-1');
      const joined = await wsServer.joinRoom('socket-1', 'test-room', 'user');

      expect(joined).toBe(true);
      const room = wsServer.getRoom('test-room');
      expect(room).toBeTruthy();
      expect(room?.members.has('socket-1')).toBe(true);
    });

    it('should leave rooms', async () => {
      await wsServer.start();
      await wsServer.handleConnection('socket-1');
      await wsServer.joinRoom('socket-1', 'test-room', 'user');
      const left = await wsServer.leaveRoom('socket-1', 'test-room');

      expect(left).toBe(true);
    });

    it('should return false when joining with invalid socket', async () => {
      await wsServer.start();
      const joined = await wsServer.joinRoom('nonexistent', 'test-room', 'user');
      expect(joined).toBe(false);
    });
  });

  describe('Broadcasting', () => {
    it('should emit to specific socket', async () => {
      await wsServer.start();
      const socket = await wsServer.handleConnection('socket-1');
      expect(socket).toBeTruthy();

      const sent = wsServer.emitTo('socket-1', 'notification:new', {
        id: 'notif-1',
        type: 'info',
        title: 'Test',
        body: 'Test message',
        createdAt: Date.now(),
      });
      expect(sent).toBe(true);
    });

    it('should broadcast to all', async () => {
      await wsServer.start();
      await wsServer.handleConnection('socket-1');
      await wsServer.handleConnection('socket-2');

      const count = wsServer.broadcast('notification:new', {
        id: 'notif-1',
        type: 'info',
        title: 'Broadcast',
        body: 'To all',
        createdAt: Date.now(),
      });
      expect(count).toBe(2);
    });

    it('should emit to room members', async () => {
      await wsServer.start();
      await wsServer.handleConnection('socket-1');
      await wsServer.handleConnection('socket-2');
      await wsServer.joinRoom('socket-1', 'my-room', 'user');

      const count = wsServer.emitToRoom('my-room', 'notification:new', {
        id: 'notif-1',
        type: 'info',
        title: 'Room message',
        body: 'To room only',
        createdAt: Date.now(),
      });
      expect(count).toBe(1);
    });
  });

  describe('Health check', () => {
    it('should report healthy when running', async () => {
      await wsServer.start();
      const health = wsServer.healthCheck();

      expect(health.healthy).toBe(true);
      expect(health.details.running).toBe(true);
    });

    it('should report unhealthy when not started', () => {
      const health = wsServer.healthCheck();
      expect(health.healthy).toBe(false);
    });
  });

  describe('Shutdown', () => {
    it('should gracefully shutdown', async () => {
      await wsServer.start();
      await wsServer.handleConnection('socket-1');
      await wsServer.handleConnection('socket-2');

      await wsServer.shutdown();

      const metrics = wsServer.getMetrics();
      expect(metrics.currentConnections).toBe(0);
    });
  });
});

describe('Oracle Event Bus', () => {
  it('should create event bus singleton', () => {
    const bus = getOracleEventBus();
    expect(bus).toBeTruthy();
  });

  it('should emit phase transition without error', () => {
    const bus = getOracleEventBus();
    expect(() => {
      bus.emitPhaseTransition('user-1', {
        previousPhase: 'observe',
        currentPhase: 'orient',
        userId: 'user-1',
        timestamp: new Date().toISOString(),
      });
    }).not.toThrow();
  });

  it('should emit decision update without error', () => {
    const bus = getOracleEventBus();
    expect(() => {
      bus.emitDecisionUpdate('user-1', {
        id: 'decision-1',
        status: 'decided',
        title: 'Test Decision',
        confidence: 0.85,
      });
    }).not.toThrow();
  });

  it('should emit signal alert without error', () => {
    const bus = getOracleEventBus();
    expect(() => {
      bus.emitSignalAlert('user-1', {
        id: 'signal-1',
        userId: 'user-1',
        signalType: 'anomaly',
        title: 'Anomaly Detected',
        urgency: 'high',
        timestamp: new Date().toISOString(),
      });
    }).not.toThrow();
  });

  it('should emit briefing notification without error', () => {
    const bus = getOracleEventBus();
    expect(() => {
      bus.emitBriefingNotification('user-1', {
        id: 'briefing-1',
        userId: 'user-1',
        date: '2026-03-15',
        summary: 'Daily briefing summary',
        timestamp: new Date().toISOString(),
      });
    }).not.toThrow();
  });

  it('should provide server health check', () => {
    const bus = getOracleEventBus();
    const health = bus.getServer().healthCheck();
    expect(health).toHaveProperty('healthy');
    expect(health).toHaveProperty('details');
  });
});

describe('Event Emitter Helpers', () => {
  it('should get singleton WebSocket server', () => {
    const server = getWebSocketServer();
    expect(server).toBeTruthy();
    expect(server).toBeInstanceOf(OracleWebSocketServer);
  });

  it('should get singleton event emitter', () => {
    const emitter = getEventEmitter();
    expect(emitter).toBeTruthy();
  });
});
