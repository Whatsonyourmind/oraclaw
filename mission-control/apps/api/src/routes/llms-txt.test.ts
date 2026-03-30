/**
 * llms-txt.test.ts
 *
 * Tests for DX-03: llms.txt AI discovery route.
 *   - GET /llms.txt returns 200 with text/plain
 *   - Body follows llms.txt spec: H1, blockquote, sections
 *   - Includes endpoint categories, auth info, docs links
 *
 * Uses Fastify inject pattern.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { llmsTxtRoute } from './llms-txt';

describe('GET /llms.txt', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();
    await app.register(llmsTxtRoute);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  // Test 1: Returns 200 with text/plain content-type
  it('returns 200 with content-type text/plain', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/llms.txt',
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/plain');
  });

  // Test 2: Body starts with "# OraClaw"
  it('starts with H1 title "# OraClaw"', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/llms.txt',
    });

    expect(response.body.startsWith('# OraClaw')).toBe(true);
  });

  // Test 3: Contains a blockquote line
  it('contains a blockquote line starting with ">"', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/llms.txt',
    });

    const lines = response.body.split('\n');
    const hasBlockquote = lines.some((line: string) => line.startsWith('>'));
    expect(hasBlockquote).toBe(true);
  });

  // Test 4: Contains "## Endpoints" section
  it('contains "## Endpoints" section', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/llms.txt',
    });

    expect(response.body).toContain('## Endpoints');
  });

  // Test 5: Contains "## Authentication" section
  it('contains "## Authentication" section', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/llms.txt',
    });

    expect(response.body).toContain('## Authentication');
  });

  // Test 6: Mentions free tier "100 calls/day"
  it('mentions "100 calls/day" free tier info', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/llms.txt',
    });

    expect(response.body).toContain('100 calls/day');
  });

  // Test 7: Contains "/docs" reference
  it('contains "/docs" reference pointing to playground', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/llms.txt',
    });

    expect(response.body).toContain('/docs');
  });
});
