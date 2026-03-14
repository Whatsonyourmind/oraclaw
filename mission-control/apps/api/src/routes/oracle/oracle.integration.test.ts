/**
 * ORACLE API Routes Integration Tests
 * Story post-15 - Integration tests for full OODA loop flow
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { oracleRoutes } from './index';

describe('ORACLE API Routes Integration Tests', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    await app.register(oracleRoutes);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  // ==========================================
  // Loop Control Tests
  // ==========================================

  describe('Loop Control', () => {
    beforeEach(async () => {
      // Reset loop state before each test
      await app.inject({
        method: 'POST',
        url: '/api/oracle/loop/stop',
      });
    });

    it('should get initial status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/oracle/status',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.current_phase).toBe('idle');
      expect(body.data.loop_running).toBe(false);
    });

    it('should start the OODA loop', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/oracle/loop/start',
        payload: {},
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.started).toBe(true);
      expect(body.data.state.loop_running).toBe(true);
      expect(body.data.state.current_phase).toBe('observe');
    });

    it('should not start loop if already running', async () => {
      // Start loop first
      await app.inject({
        method: 'POST',
        url: '/api/oracle/loop/start',
        payload: {},
      });

      // Try to start again
      const response = await app.inject({
        method: 'POST',
        url: '/api/oracle/loop/start',
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(false);
      expect(body.error).toContain('already running');
    });

    it('should pause a running loop', async () => {
      // Start loop first
      await app.inject({
        method: 'POST',
        url: '/api/oracle/loop/start',
        payload: {},
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/oracle/loop/pause',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.paused).toBe(true);
      expect(body.data.state.loop_paused).toBe(true);
    });

    it('should not pause if loop is not running', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/oracle/loop/pause',
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(false);
    });

    it('should resume a paused loop', async () => {
      // Start and pause loop
      await app.inject({
        method: 'POST',
        url: '/api/oracle/loop/start',
        payload: {},
      });
      await app.inject({
        method: 'POST',
        url: '/api/oracle/loop/pause',
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/oracle/loop/resume',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.resumed).toBe(true);
      expect(body.data.state.loop_paused).toBe(false);
    });

    it('should stop a running loop', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/oracle/loop/start',
        payload: {},
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/oracle/loop/stop',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.stopped).toBe(true);
      expect(body.data.state.loop_running).toBe(false);
      expect(body.data.state.current_phase).toBe('idle');
    });
  });

  // ==========================================
  // Phase Transition Tests
  // ==========================================

  describe('Phase Transitions', () => {
    it('should transition to specific phase', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/oracle/phase/transition',
        payload: { target_phase: 'orient' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.current_phase).toBe('orient');
    });

    it('should trigger specific phase via trigger endpoint', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/oracle/trigger/decide',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.triggered).toBe('decide');
      expect(body.data.state.current_phase).toBe('decide');
    });

    it('should reject invalid phase', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/oracle/trigger/invalid',
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(false);
      expect(body.error).toContain('Invalid phase');
    });

    it('should track phase transition time', async () => {
      const before = new Date().toISOString();

      await app.inject({
        method: 'POST',
        url: '/api/oracle/phase/transition',
        payload: { target_phase: 'act' },
      });

      const statusResponse = await app.inject({
        method: 'GET',
        url: '/api/oracle/status',
      });

      const body = JSON.parse(statusResponse.payload);
      expect(body.data.last_phase_transition).toBeDefined();
      expect(new Date(body.data.last_phase_transition).getTime()).toBeGreaterThanOrEqual(
        new Date(before).getTime()
      );
    });
  });

  // ==========================================
  // Dashboard Tests
  // ==========================================

  describe('Dashboard', () => {
    it('should return dashboard data', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/oracle/dashboard',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('state');
      expect(body.data).toHaveProperty('summary');
      expect(body.data).toHaveProperty('recent_activity');
      expect(body.data).toHaveProperty('health');
      expect(body.data).toHaveProperty('phase_colors');
    });

    it('should include phase colors in dashboard', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/oracle/dashboard',
      });

      const body = JSON.parse(response.payload);
      expect(body.data.phase_colors.observe).toBe('#00BFFF');
      expect(body.data.phase_colors.orient).toBe('#FFD700');
      expect(body.data.phase_colors.decide).toBe('#FF6B6B');
      expect(body.data.phase_colors.act).toBe('#00FF88');
    });
  });

  // ==========================================
  // Configuration Tests
  // ==========================================

  describe('Configuration', () => {
    it('should get current configuration', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/oracle/config',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('scan_interval_minutes');
      expect(body.data).toHaveProperty('auto_orient_enabled');
      expect(body.data).toHaveProperty('auto_execute_enabled');
      expect(body.data).toHaveProperty('ghost_action_approval_mode');
      expect(body.data).toHaveProperty('attention_budget');
    });

    it('should update configuration', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/oracle/config',
        payload: {
          scan_interval_minutes: 30,
          auto_execute_enabled: true,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.updated).toBe(true);
    });
  });

  // ==========================================
  // History Tests
  // ==========================================

  describe('History', () => {
    it('should return loop history', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/oracle/history',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
    });

    it('should accept limit parameter', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/oracle/history?limit=10',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
    });
  });

  // ==========================================
  // Full OODA Loop Flow Test
  // ==========================================

  describe('Full OODA Loop Flow', () => {
    it('should complete observe → orient → decide → act cycle', async () => {
      // Start in idle state
      await app.inject({
        method: 'POST',
        url: '/api/oracle/loop/stop',
      });

      // 1. OBSERVE Phase
      const observeResponse = await app.inject({
        method: 'POST',
        url: '/api/oracle/trigger/observe',
      });
      expect(observeResponse.statusCode).toBe(200);
      let status = JSON.parse(observeResponse.payload);
      expect(status.data.state.current_phase).toBe('observe');

      // 2. ORIENT Phase
      const orientResponse = await app.inject({
        method: 'POST',
        url: '/api/oracle/trigger/orient',
      });
      expect(orientResponse.statusCode).toBe(200);
      status = JSON.parse(orientResponse.payload);
      expect(status.data.state.current_phase).toBe('orient');

      // 3. DECIDE Phase
      const decideResponse = await app.inject({
        method: 'POST',
        url: '/api/oracle/trigger/decide',
      });
      expect(decideResponse.statusCode).toBe(200);
      status = JSON.parse(decideResponse.payload);
      expect(status.data.state.current_phase).toBe('decide');

      // 4. ACT Phase
      const actResponse = await app.inject({
        method: 'POST',
        url: '/api/oracle/trigger/act',
      });
      expect(actResponse.statusCode).toBe(200);
      status = JSON.parse(actResponse.payload);
      expect(status.data.state.current_phase).toBe('act');

      // Verify full cycle completed
      const finalStatus = await app.inject({
        method: 'GET',
        url: '/api/oracle/status',
      });
      const finalBody = JSON.parse(finalStatus.payload);
      expect(finalBody.data.current_phase).toBe('act');
    });

    it('should allow starting loop and transitioning through phases', async () => {
      // Start the loop
      const startResponse = await app.inject({
        method: 'POST',
        url: '/api/oracle/loop/start',
        payload: {},
      });
      expect(startResponse.statusCode).toBe(200);

      // Loop should start in observe phase
      let status = JSON.parse(startResponse.payload);
      expect(status.data.state.current_phase).toBe('observe');
      expect(status.data.state.loop_running).toBe(true);

      // Transition through phases
      await app.inject({
        method: 'POST',
        url: '/api/oracle/phase/transition',
        payload: { target_phase: 'orient' },
      });

      await app.inject({
        method: 'POST',
        url: '/api/oracle/phase/transition',
        payload: { target_phase: 'decide' },
      });

      await app.inject({
        method: 'POST',
        url: '/api/oracle/phase/transition',
        payload: { target_phase: 'act' },
      });

      // Back to observe for next cycle
      const cycleResponse = await app.inject({
        method: 'POST',
        url: '/api/oracle/phase/transition',
        payload: { target_phase: 'observe' },
      });

      status = JSON.parse(cycleResponse.payload);
      expect(status.data.current_phase).toBe('observe');
    });
  });

  // ==========================================
  // Error Handling Tests
  // ==========================================

  describe('Error Handling', () => {
    it('should handle malformed requests gracefully', async () => {
      // Note: Fastify handles JSON parsing errors, this tests route-level error handling
      const response = await app.inject({
        method: 'POST',
        url: '/api/oracle/phase/transition',
        payload: {}, // Missing target_phase
      });

      // Should handle missing field without crashing
      expect(response.statusCode).toBeLessThan(500);
    });

    it('should return proper error structure', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/oracle/trigger/invalid_phase',
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body).toHaveProperty('success', false);
      expect(body).toHaveProperty('error');
    });
  });
});
