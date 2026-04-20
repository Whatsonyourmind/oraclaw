/**
 * bandit-validation.test.ts
 *
 * Locks in the 2026-04-20 fix that added Zod validation to the bandit endpoints.
 * Before the fix, /optimize/bandit and /optimize/contextual-bandit would crash
 * with "Arm 'undefined' already exists" (500) when callers sent bare strings
 * or omitted required fields. After the fix, callers get a 400 with a helpful
 * message.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import publicApiRoutes from './api-public';

let app: FastifyInstance;

beforeAll(async () => {
  app = Fastify({ logger: false });
  await app.register(publicApiRoutes);
  await app.ready();
});

describe('/api/v1/optimize/bandit — input validation', () => {
  it('returns 400 when arms is an array of bare strings', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/optimize/bandit',
      payload: { arms: ['A', 'B'], algorithm: 'ucb1' },
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.error).toContain('bandit input');
    expect(JSON.stringify(body.details)).toMatch(/Expected object, received string/);
  });

  it('returns 400 when fewer than 2 arms are provided', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/optimize/bandit',
      payload: { arms: [{ id: 'only', name: 'Only' }] },
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(JSON.stringify(body.details)).toMatch(/At least 2 arms/);
  });

  it('returns 200 on valid input', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/optimize/bandit',
      payload: {
        arms: [
          { id: 'a', name: 'A', pulls: 10, totalReward: 4 },
          { id: 'b', name: 'B', pulls: 10, totalReward: 6 },
        ],
        algorithm: 'ucb1',
      },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.selected).toBeDefined();
    expect(['a', 'b']).toContain(body.selected.id);
  });
});

describe('/api/v1/optimize/contextual-bandit — input validation', () => {
  it('returns 400 when arms is an array of bare strings (the reproducer)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/optimize/contextual-bandit',
      payload: { arms: ['A', 'B', 'C'], context: [0.3, 0.8, 0.1], history: [] },
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.error).toContain('contextual-bandit input');
    expect(JSON.stringify(body.details)).toMatch(/Expected object, received string/);
  });

  it('returns 400 when context is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/optimize/contextual-bandit',
      payload: { arms: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }] },
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(JSON.stringify(body.details)).toMatch(/context/i);
  });

  it('returns 400 when history.context length mismatches top-level context', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/optimize/contextual-bandit',
      payload: {
        arms: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }],
        context: [0.3, 0.8],
        history: [{ armId: 'a', reward: 1, context: [0.1] }],
      },
    });
    expect(res.statusCode).toBe(400);
    expect(JSON.stringify(JSON.parse(res.payload).details)).toMatch(/history\[\]\.context length must match/);
  });

  it('returns 400 when history references an unknown armId', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/optimize/contextual-bandit',
      payload: {
        arms: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }],
        context: [0.3, 0.8],
        history: [{ armId: 'ghost', reward: 1, context: [0.1, 0.2] }],
      },
    });
    expect(res.statusCode).toBe(400);
    expect(JSON.stringify(JSON.parse(res.payload).details)).toMatch(/ghost.* is not in arms/);
  });

  it('returns 200 on valid input', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/optimize/contextual-bandit',
      payload: {
        arms: [{ id: 'x', name: 'X' }, { id: 'y', name: 'Y' }],
        context: [0.5, 0.5],
      },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.selected).toBeDefined();
    expect(body.algorithm).toBe('linucb');
  });
});
