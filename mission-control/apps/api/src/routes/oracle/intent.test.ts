/**
 * intent.test.ts
 *
 * Tests for POST /api/v1/intent — the solve() demand probe behind the /demo
 * widget. Locks in the 2026-05-29 persistence fix (solve_intents table +
 * guessed_class column) and the endpoint contract:
 *   - valid submit returns 200 with the waitlist confirmation
 *   - a present-but-invalid email is rejected with 400
 *   - a prompt over 2000 chars is rejected with 400
 *   - the persist path is fire-and-forget: even when the DB is connected and
 *     the INSERT throws (e.g. missing table), the request still returns 200
 *     (graceful degradation — intent is never lost, it is always logged).
 */

import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import publicApiRoutes, { guessIntentClass } from './api-public';
import { db } from '../../services/database/client';

let app: FastifyInstance;

beforeAll(async () => {
  app = Fastify({ logger: false });
  await app.register(publicApiRoutes);
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function postIntent(payload: Record<string, unknown>) {
  return app.inject({
    method: 'POST',
    url: '/api/v1/intent',
    payload,
  });
}

describe('POST /api/v1/intent — valid submit', () => {
  it('returns 200 with the waitlist confirmation for a valid prompt + email', async () => {
    const res = await postIntent({
      prompt: 'I need to allocate a $50k marketing budget across channels to maximize signups',
      email: 'founder@example.com',
      source: 'demo-page',
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.status).toBe('received');
    expect(body.message).toMatch(/waitlist/i);
  });

  it('returns 200 when email is omitted (email is optional)', async () => {
    const res = await postIntent({
      prompt: 'detect anomalies in my server response times',
      source: 'demo-page',
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.payload).status).toBe('received');
  });
});

describe('POST /api/v1/intent — invalid email rejected', () => {
  it('returns 400 when a non-empty email is malformed', async () => {
    const res = await postIntent({
      prompt: 'optimize my portfolio weights',
      email: 'not-an-email',
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.error).toMatch(/invalid email/i);
  });
});

describe('POST /api/v1/intent — prompt length validation', () => {
  it('returns 400 when prompt exceeds 2000 chars', async () => {
    const res = await postIntent({
      prompt: 'x'.repeat(2001),
      source: 'demo-page',
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.error).toMatch(/too long/i);
  });

  it('returns 400 when prompt is empty', async () => {
    const res = await postIntent({ prompt: '   ' });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.payload).error).toMatch(/prompt required/i);
  });
});

describe('POST /api/v1/intent — db-down path is graceful', () => {
  it('returns 200 when the DB is disconnected (in-memory fallback, no persist attempt)', async () => {
    // Default test environment: no DATABASE_URL → in-memory fallback →
    // db.isConnected() is false, so no INSERT is attempted.
    expect(db.isConnected()).toBe(false);
    const res = await postIntent({
      prompt: 'schedule 4 tasks into 3 time slots under capacity constraints',
      source: 'demo-page',
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.payload).status).toBe('received');
  });

  it('still returns 200 when the DB is connected but the INSERT throws (fire-and-forget)', async () => {
    vi.spyOn(db, 'isConnected').mockReturnValue(true);
    const querySpy = vi
      .spyOn(db, 'query')
      .mockRejectedValue(new Error('relation "solve_intents" does not exist'));

    const res = await postIntent({
      prompt: 'forecast next month revenue from the time series',
      email: 'lead@example.com',
      source: 'demo-page',
    });

    // The request must succeed even though the persist rejected.
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.payload).status).toBe('received');
    // And the handler did attempt the INSERT with the new column set.
    expect(querySpy).toHaveBeenCalledTimes(1);
    const [sql, params] = querySpy.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO solve_intents/);
    expect(sql).toMatch(/guessed_class/);
    // params: [prompt, email, source, guessed_class, ts]
    expect(params).toHaveLength(5);
    expect(params?.[1]).toBe('lead@example.com');
    expect(params?.[2]).toBe('demo-page');
  });
});

describe('guessIntentClass — server-side keyword classifier', () => {
  it('maps an A/B testing prompt to multi_armed_bandit', () => {
    expect(guessIntentClass('which landing page variant should get more traffic in my a/b test'))
      .toBe('multi_armed_bandit');
  });

  it('returns null for a prompt with no keyword overlap', () => {
    expect(guessIntentClass('hello there friend')).toBeNull();
  });

  it('returns null for a prompt that is too short', () => {
    expect(guessIntentClass('hi')).toBeNull();
  });
});
