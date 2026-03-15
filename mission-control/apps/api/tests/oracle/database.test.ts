/**
 * Database Service Tests
 * Tests the database client with mocked queries and graceful fallback
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '../../src/services/database/client';

describe('Database Service', () => {
  describe('healthCheck', () => {
    it('should return fallback status when no DB is configured', async () => {
      const health = await db.healthCheck();

      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('latency_ms');
      expect(health).toHaveProperty('using_fallback');
      expect(typeof health.latency_ms).toBe('number');
    });

    it('should indicate fallback mode when not connected', async () => {
      const health = await db.healthCheck();
      // Without actual DB connection, should be in fallback
      expect(health.using_fallback).toBe(true);
      expect(health.status).toBe('fallback');
    });
  });

  describe('isConnected', () => {
    it('should return false when using in-memory fallback', () => {
      expect(db.isConnected()).toBe(false);
    });
  });

  describe('isUsingFallback', () => {
    it('should return true when no DB is configured', () => {
      expect(db.isUsingFallback()).toBe(true);
    });
  });

  describe('query', () => {
    it('should return empty results in fallback mode', async () => {
      const result = await db.query('SELECT 1');
      expect(result.rows).toEqual([]);
      expect(result.rowCount).toBe(0);
    });
  });

  describe('initialize', () => {
    it('should gracefully handle missing connection string', async () => {
      // Should not throw
      await expect(db.initialize()).resolves.not.toThrow();
      expect(db.isUsingFallback()).toBe(true);
    });
  });
});

describe('Signal Queries (with fallback)', () => {
  it('should return null for create in fallback mode', async () => {
    const { signalQueries } = await import('../../src/services/database/queries/signals');
    const result = await signalQueries.create('user-1', {
      signal_type: 'opportunity',
      title: 'Test Signal',
      urgency: 'medium',
      impact: 'medium',
    });
    expect(result).toBeNull();
  });

  it('should return empty array for list in fallback mode', async () => {
    const { signalQueries } = await import('../../src/services/database/queries/signals');
    const result = await signalQueries.list('user-1');
    expect(result).toEqual([]);
  });

  it('should return null for getById in fallback mode', async () => {
    const { signalQueries } = await import('../../src/services/database/queries/signals');
    const result = await signalQueries.getById('signal-1', 'user-1');
    expect(result).toBeNull();
  });
});

describe('Decision Queries (with fallback)', () => {
  it('should return empty results from query in fallback mode', async () => {
    const result = await db.query('SELECT * FROM oracle_decisions WHERE user_id = $1', ['user-1']);
    expect(result.rows).toEqual([]);
  });
});

describe('Briefing Queries (with fallback)', () => {
  it('should return null for create in fallback mode', async () => {
    const { briefingQueries } = await import('../../src/services/database/queries/briefings');
    const result = await briefingQueries.create('user-1', {
      date: '2026-03-15',
      summary: 'Test briefing',
      priorities: ['Priority 1'],
    });
    expect(result).toBeNull();
  });

  it('should return empty array for listRecent in fallback mode', async () => {
    const { briefingQueries } = await import('../../src/services/database/queries/briefings');
    const result = await briefingQueries.listRecent('user-1');
    expect(result).toEqual([]);
  });
});

describe('Action Queries (with fallback)', () => {
  it('should return empty plans list in fallback mode', async () => {
    const { actionQueries } = await import('../../src/services/database/queries/actions');
    const result = await actionQueries.listPlans('user-1');
    expect(result).toEqual([]);
  });
});
