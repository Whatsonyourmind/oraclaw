# Phase 4: Developer Experience - Research

**Researched:** 2026-03-30
**Domain:** OpenAPI documentation, error standardization, AI discovery
**Confidence:** HIGH

## Summary

Phase 4 requires three distinct capabilities: (1) replacing the existing Swagger UI docs with a Scalar interactive playground serving an OpenAPI 3.1 spec, (2) standardizing all error responses to RFC 9457 problem details format, and (3) serving an llms.txt file for AI assistant discovery.

The project already has `@fastify/swagger` v9.7.0 installed and a `swagger.ts` plugin generating OpenAPI 3.0.3. The upgrade path is straightforward: change the version string to `3.1.0`, replace `@fastify/swagger-ui` with `@scalar/fastify-api-reference`, and the Scalar plugin auto-detects `@fastify/swagger`. For RFC 9457, the billing routes (subscribe.ts, portal.ts), auth middleware, and free-tier rate limiter already use problem details format. The remaining gap is the global error handler in index.ts (12 occurrences of `{ error: "..." }` format) and old oracle routes (79 error responses in integrations/github.ts and integrations/google.ts). The public API routes in api-public.ts do not have explicit error handling -- they let exceptions propagate to the global error handler, so fixing the global handler covers them.

**Primary recommendation:** Replace Swagger UI with Scalar (swap one package), upgrade OpenAPI to 3.1, centralize RFC 9457 error formatting in the global error handler and a shared helper, and add a static /llms.txt route.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DX-01 | OpenAPI 3.1 spec generated from routes with Scalar interactive playground | Existing @fastify/swagger v9.7.0 supports OpenAPI 3.1.0; @scalar/fastify-api-reference auto-detects it. Replace @fastify/swagger-ui with Scalar plugin. |
| DX-02 | All error responses follow RFC 9457 problem details format | 4 files already use RFC 9457 (9 occurrences). Global error handler + index.ts inline errors + old oracle integration routes need conversion. Shared `createProblemDetail()` helper + global `setErrorHandler` with `application/problem+json` content-type. |
| DX-03 | llms.txt file served at /llms.txt for AI assistant discovery | Static route returning markdown-formatted llms.txt. Spec: H1 title, blockquote summary, H2 sections for endpoints/auth/pricing. No external dependencies. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @fastify/swagger | ^9.7.0 | OpenAPI spec generation from route schemas | Already installed, native Fastify integration, supports 3.1.0 |
| @scalar/fastify-api-reference | latest (1.43+) | Interactive API playground replacing Swagger UI | Modern alternative to swagger-ui, auto-detects @fastify/swagger, beautiful UI, try-it-out built-in |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @fastify/swagger-ui | 5.2.5 | REMOVE -- replaced by Scalar | Currently installed, will be uninstalled |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Scalar | @fastify/swagger-ui (current) | Swagger UI works but Scalar is more modern, better DX, requirement specifies Scalar |
| Scalar | Redocly | Redocly is read-only, no try-it-out playground |

**Installation:**
```bash
npm install @scalar/fastify-api-reference
npm uninstall @fastify/swagger-ui
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── plugins/
│   └── swagger.ts           # MODIFY: OpenAPI 3.1 + Scalar (replace swagger-ui)
├── utils/
│   └── problem-details.ts   # NEW: RFC 9457 helper + error type registry
├── routes/
│   └── llms-txt.ts          # NEW: GET /llms.txt static route
└── index.ts                 # MODIFY: global setErrorHandler uses problem-details
```

### Pattern 1: Scalar with @fastify/swagger (DX-01)
**What:** Register Scalar as a replacement for Swagger UI; it auto-detects @fastify/swagger.
**When to use:** Always -- single registration replaces swagger-ui.
**Example:**
```typescript
// Source: https://scalar.com/products/api-references/integrations/fastify
import { registerSwagger } from './plugins/swagger';

// In swagger.ts plugin:
import fastifySwagger from '@fastify/swagger';

export async function registerSwagger(fastify: FastifyInstance): Promise<void> {
  await fastify.register(fastifySwagger, {
    openapi: {
      openapi: '3.1.0',  // Upgraded from 3.0.3
      info: {
        title: 'OraClaw Decision Intelligence API',
        description: '...',
        version: '2.3.0',
      },
      components: {
        securitySchemes: {
          apiKey: {
            type: 'apiKey',
            name: 'Authorization',
            in: 'header',
            description: 'Bearer <your-api-key>',
          },
        },
      },
    },
  });

  // Scalar replaces @fastify/swagger-ui
  await fastify.register(import('@scalar/fastify-api-reference'), {
    routePrefix: '/docs',
    configuration: {
      title: 'OraClaw API',
      // Scalar auto-detects @fastify/swagger -- no url needed
    },
  });
}
```

### Pattern 2: RFC 9457 Problem Details Helper (DX-02)
**What:** Centralized factory function for RFC 9457 responses with content-type header.
**When to use:** Every error response in the application.
**Example:**
```typescript
// Source: RFC 9457 https://www.rfc-editor.org/rfc/rfc9457.html

/** RFC 9457 Problem Details object */
export interface ProblemDetail {
  type: string;       // URI reference identifying the problem type
  title: string;      // Short human-readable summary
  status: number;     // HTTP status code
  detail: string;     // Human-readable explanation of this occurrence
  instance?: string;  // URI reference for this specific occurrence
  [key: string]: unknown; // Extension fields (e.g., retry-after)
}

/** Create a problem detail and send it with correct content-type */
export function sendProblemDetail(
  reply: FastifyReply,
  status: number,
  opts: Omit<ProblemDetail, 'status'>,
): FastifyReply {
  return reply
    .code(status)
    .type('application/problem+json')
    .send({ ...opts, status });
}

// Pre-defined error types for consistency:
export const ProblemTypes = {
  VALIDATION: 'https://oraclaw.dev/errors/validation',
  NOT_FOUND: 'https://oraclaw.dev/errors/not-found',
  RATE_LIMITED: 'https://oraclaw.dev/errors/rate-limited',
  UNAUTHORIZED: 'https://oraclaw.dev/errors/unauthorized',
  INTERNAL: 'https://oraclaw.dev/errors/internal-server-error',
  SERVICE_UNAVAILABLE: 'https://oraclaw.dev/errors/service-unavailable',
  CHECKOUT_FAILED: 'https://oraclaw.dev/errors/checkout-failed',
  // ... more as needed
} as const;
```

### Pattern 3: Global Error Handler with RFC 9457 (DX-02)
**What:** Fastify's `setErrorHandler` catches all unhandled errors and formats them as problem details.
**When to use:** Replaces the existing global error handler in index.ts.
**Example:**
```typescript
// In index.ts, replace existing setErrorHandler:
server.setErrorHandler((error, request, reply) => {
  server.log.error(error);

  const status = error.statusCode ?? 500;

  reply
    .code(status)
    .type('application/problem+json')
    .send({
      type: status === 429
        ? 'https://oraclaw.dev/errors/rate-limited'
        : status === 400
          ? 'https://oraclaw.dev/errors/validation'
          : 'https://oraclaw.dev/errors/internal-server-error',
      title: error.message || 'Internal Server Error',
      status,
      detail: status === 500
        ? 'An unexpected error occurred. Please try again.'
        : error.message,
    });
});
```

### Pattern 4: llms.txt Static Route (DX-03)
**What:** A GET route at /llms.txt returning markdown-formatted content per the llms.txt spec.
**When to use:** Single static route, no dependencies.
**Example:**
```typescript
// Source: https://llmstxt.org
fastify.get('/llms.txt', async (_request, reply) => {
  reply.type('text/plain').send(`# OraClaw

> Decision intelligence API with 19 ML algorithms. No LLM cost -- pure math.

OraClaw implements the OODA loop (Observe, Orient, Decide, Act) as HTTP endpoints.
All algorithms run in <25ms. Pay per call via API key (Stripe) or USDC (x402).

## Endpoints

- [Multi-Armed Bandit](/api/v1/optimize/bandit): UCB1, Thompson Sampling, epsilon-Greedy
- [Contextual Bandit](/api/v1/optimize/contextual-bandit): LinUCB with feature context
...

## Authentication

- Free tier: 100 calls/day, no API key required
- Paid tiers: API key via Authorization header
- Machine payments: x402 USDC on Base

## Docs

- [Interactive Playground](/docs): Try any endpoint
- [OpenAPI Spec](/docs/json): Machine-readable API specification
- [Pricing](/api/v1/pricing): Tier and per-call pricing
`);
});
```

### Anti-Patterns to Avoid
- **Mixing error formats:** Some routes use `{ error: "..." }`, others use RFC 9457. The global error handler MUST catch everything, and routes that send explicit errors should use the shared helper.
- **Forgetting content-type:** RFC 9457 requires `application/problem+json` media type. Without `reply.type('application/problem+json')`, the response is technically non-compliant.
- **Over-engineering llms.txt:** It is a static text file. Do not fetch it from a database or generate it dynamically. Hardcode it as a string literal in the route handler.
- **Registering Scalar AND Swagger UI:** They serve the same purpose. Uninstall `@fastify/swagger-ui` to avoid route conflicts.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OpenAPI spec generation | Manual JSON spec file | @fastify/swagger dynamic mode | Route schemas auto-generate the spec; manual files drift |
| Interactive API docs | Custom HTML playground | @scalar/fastify-api-reference | Scalar handles auth, try-it-out, themes, and updates |
| Error format validation | Custom test assertions | Check `type`, `title`, `status`, `detail` fields in tests | RFC 9457 has exactly 4 required fields; simple assertion |

**Key insight:** The biggest risk is incomplete RFC 9457 adoption. The global error handler handles uncaught errors, but routes that explicitly call `reply.code(N).send({...})` bypass it. Both the global handler AND explicit route errors need the problem-details format.

## Common Pitfalls

### Pitfall 1: Scalar Route Conflicts with Swagger UI
**What goes wrong:** Both Scalar and Swagger UI try to serve at /docs, causing a route conflict crash.
**Why it happens:** Forgetting to uninstall @fastify/swagger-ui before adding Scalar.
**How to avoid:** `npm uninstall @fastify/swagger-ui` before adding Scalar. Remove all swagger-ui imports.
**Warning signs:** Fastify startup error about duplicate routes.

### Pitfall 2: OpenAPI 3.1 vs 3.0.3 Schema Differences
**What goes wrong:** Some schema keywords valid in 3.0.3 are deprecated/changed in 3.1 (e.g., `nullable` replaced with `type: ["string", "null"]`).
**Why it happens:** OpenAPI 3.1 aligns with JSON Schema 2020-12, changing some keywords.
**How to avoid:** The existing swagger.ts uses simple types that work in both versions. The `openapi: '3.1.0'` string change is sufficient. No schema keyword migration needed for the current codebase.
**Warning signs:** Scalar rendering warnings about schema validation.

### Pitfall 3: Inconsistent Error Response Content-Type
**What goes wrong:** Error responses return `application/json` instead of `application/problem+json`.
**Why it happens:** Fastify defaults to `application/json`. Must explicitly call `reply.type('application/problem+json')`.
**How to avoid:** Use the shared `sendProblemDetail()` helper which always sets the content-type. In the global error handler, always set `.type('application/problem+json')`.
**Warning signs:** Tests checking content-type header fail.

### Pitfall 4: Scalar Dynamic Import Syntax
**What goes wrong:** TypeScript strict mode may complain about `import('@scalar/fastify-api-reference')`.
**Why it happens:** Dynamic imports return `Promise<typeof import(...)>` which may need `.default` access.
**How to avoid:** Use the pattern: `await fastify.register(import('@scalar/fastify-api-reference'), { ... })` -- Fastify handles the promise resolution. If that fails, use: `const scalar = await import('@scalar/fastify-api-reference'); await fastify.register(scalar.default, { ... })`.
**Warning signs:** TypeScript compilation errors about module type.

### Pitfall 5: Oracle Integration Routes (github.ts, google.ts)
**What goes wrong:** 79 error responses in oracle integration routes still use `{ error: "..." }` format.
**Why it happens:** These are legacy internal routes behind JWT auth, not the public API.
**How to avoid:** The requirement says "all error responses across every endpoint." These routes ARE registered on the server and reachable. The global error handler catches unhandled errors, but explicit `reply.code(N).send({...})` calls bypass it. Decision needed: either update all 79 occurrences (high effort, low value for internal routes) or ensure the global error handler wraps them via an onSend hook that normalizes non-RFC-9457 responses.
**Warning signs:** Integration tests expecting old format break.

## Code Examples

Verified patterns from official sources:

### Swagger Plugin Upgrade (swagger.ts)
```typescript
// Current: OpenAPI 3.0.3 + Swagger UI
// Target: OpenAPI 3.1.0 + Scalar

import { FastifyInstance } from 'fastify';
import fastifySwagger from '@fastify/swagger';

export async function registerSwagger(fastify: FastifyInstance): Promise<void> {
  await fastify.register(fastifySwagger, {
    openapi: {
      openapi: '3.1.0',
      info: {
        title: 'OraClaw Decision Intelligence API',
        description: 'Decision intelligence via OODA loop. 19 algorithms, all <25ms.',
        version: '2.3.0',
        contact: {
          name: 'OraClaw',
          url: 'https://github.com/Whatsonyourmind/oracle',
        },
        license: { name: 'MIT' },
      },
      servers: [
        { url: 'http://localhost:3001', description: 'Development' },
        { url: 'https://oraclaw.dev', description: 'Production' },
      ],
      tags: [
        { name: 'Optimize', description: 'Bandit, Genetic, CMA-ES optimization' },
        { name: 'Simulate', description: 'Monte Carlo, Scenario planning' },
        { name: 'Solve', description: 'LP/MIP constraints, scheduling' },
        { name: 'Analyze', description: 'Graph analysis, portfolio risk' },
        { name: 'Predict', description: 'Bayesian, ensemble, forecasting' },
        { name: 'Detect', description: 'Anomaly detection' },
        { name: 'Score', description: 'Convergence, calibration scoring' },
        { name: 'Plan', description: 'A* pathfinding' },
        { name: 'Billing', description: 'Subscription and portal' },
        { name: 'Health', description: 'System health checks' },
      ],
      components: {
        securitySchemes: {
          apiKey: {
            type: 'apiKey',
            name: 'Authorization',
            in: 'header',
            description: 'Bearer <your-api-key> from Unkey',
          },
        },
      },
    },
  });

  // Scalar interactive playground (replaces swagger-ui)
  await fastify.register(import('@scalar/fastify-api-reference'), {
    routePrefix: '/docs',
  });
}
```

### RFC 9457 Problem Details Utility
```typescript
// src/utils/problem-details.ts
import type { FastifyReply } from 'fastify';

export interface ProblemDetail {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance?: string;
  [key: string]: unknown;
}

export function sendProblem(
  reply: FastifyReply,
  status: number,
  type: string,
  title: string,
  detail: string,
  extra?: Record<string, unknown>,
): FastifyReply {
  return reply
    .code(status)
    .type('application/problem+json')
    .send({ type, title, status, detail, ...extra });
}
```

### Global Error Handler
```typescript
// In index.ts -- replaces existing setErrorHandler
server.setErrorHandler((error, request, reply) => {
  server.log.error(error);
  const status = error.statusCode ?? 500;

  // Map Fastify validation errors to RFC 9457
  const type = error.validation
    ? 'https://oraclaw.dev/errors/validation'
    : status === 429
      ? 'https://oraclaw.dev/errors/rate-limited'
      : status === 404
        ? 'https://oraclaw.dev/errors/not-found'
        : 'https://oraclaw.dev/errors/internal-server-error';

  const title = error.validation
    ? 'Validation Error'
    : status === 429
      ? 'Rate Limit Exceeded'
      : status === 404
        ? 'Not Found'
        : 'Internal Server Error';

  reply
    .code(status)
    .type('application/problem+json')
    .send({
      type,
      title,
      status,
      detail: status >= 500
        ? 'An unexpected error occurred. Please try again.'
        : error.message,
    });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Swagger UI (@fastify/swagger-ui) | Scalar (@scalar/fastify-api-reference) | 2024-2025 | Better UX, modern UI, built-in try-it-out |
| OpenAPI 3.0.x | OpenAPI 3.1.0 | 2023+ | Aligns with JSON Schema 2020-12 |
| RFC 7807 | RFC 9457 | June 2023 | Obsoletes 7807, same format, updated guidance |
| Custom error shapes | RFC 9457 problem details | Ongoing adoption | Machine-readable, standardized, tool-friendly |
| robots.txt for AI | llms.txt | September 2024 proposal | AI-optimized discovery, markdown format |

**Deprecated/outdated:**
- `@fastify/swagger-ui`: Still maintained but Scalar is the modern choice with better features
- RFC 7807: Officially obsoleted by RFC 9457 (same format, the project already uses the correct URL pattern)
- OpenAPI 3.0.3: Still valid but 3.1.0 is current and aligns with JSON Schema 2020-12

## Open Questions

1. **Oracle integration routes (github.ts, google.ts) -- 79 error responses**
   - What we know: These are old internal routes behind JWT auth, not the public API. They use `{ error: "..." }` format.
   - What's unclear: Whether "all error responses across every endpoint" includes these internal routes or just the public API (/api/v1/*).
   - Recommendation: Focus on the global error handler (catches uncaught exceptions for all routes) and the public API routes. The internal oracle routes can be left as-is since they will eventually be deprecated in favor of the /api/v1/* endpoints, or converted opportunistically. The global error handler conversion ensures any uncaught error from these routes also gets RFC 9457 format.

2. **Scalar version pinning**
   - What we know: @scalar/fastify-api-reference is actively developed (latest 1.43+).
   - What's unclear: Exact latest version at time of execution.
   - Recommendation: Install latest (`npm install @scalar/fastify-api-reference`) without pinning. The plugin is additive and backwards-compatible.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 1.2.0 |
| Config file | `mission-control/apps/api/vitest.config.ts` |
| Quick run command | `cd mission-control/apps/api && npx vitest run` |
| Full suite command | `cd mission-control && npm run test` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DX-01 | Scalar playground serves at /docs, OpenAPI 3.1 spec available | integration | `cd mission-control/apps/api && npx vitest run src/plugins/swagger.test.ts -x` | No -- Wave 0 |
| DX-02 | Global error handler returns RFC 9457 format with application/problem+json | unit | `cd mission-control/apps/api && npx vitest run src/utils/problem-details.test.ts -x` | No -- Wave 0 |
| DX-02 | Existing route errors (subscribe, portal, auth) still pass with RFC 9457 format | integration | `cd mission-control/apps/api && npx vitest run src/routes/billing/subscribe.test.ts src/routes/billing/portal.test.ts src/middleware/auth.test.ts -x` | Yes |
| DX-03 | GET /llms.txt returns valid llms.txt content | unit | `cd mission-control/apps/api && npx vitest run src/routes/llms-txt.test.ts -x` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `cd mission-control/apps/api && npx vitest run`
- **Per wave merge:** `cd mission-control && npm run test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/plugins/swagger.test.ts` -- covers DX-01 (Scalar serves, OpenAPI 3.1 version check)
- [ ] `src/utils/problem-details.test.ts` -- covers DX-02 (helper function, content-type)
- [ ] `src/routes/llms-txt.test.ts` -- covers DX-03 (route exists, returns valid content)
- [ ] Framework install: `npm install @scalar/fastify-api-reference` -- replaces swagger-ui

## Sources

### Primary (HIGH confidence)
- @fastify/swagger v9.7.0 -- already installed, inspected source config in `src/plugins/swagger.ts`
- @fastify/swagger-ui v5.2.5 -- already installed, to be replaced
- Existing codebase -- 9 occurrences already using RFC 9457 format across 4 files (subscribe.ts, portal.ts, auth.ts, free-tier-rate-limit.ts)
- [RFC 9457 specification](https://www.rfc-editor.org/rfc/rfc9457.html) -- defines type, title, status, detail, instance fields

### Secondary (MEDIUM confidence)
- [Scalar Fastify integration](https://scalar.com/products/api-references/integrations/fastify) -- official docs confirm auto-detection of @fastify/swagger, routePrefix config
- [llms.txt specification](https://llmstxt.org) -- H1 title, blockquote summary, H2 sections, markdown list format
- [@fastify/swagger GitHub](https://github.com/fastify/fastify-swagger) -- v9.x requires Fastify ^5.x, supports OpenAPI 3.1.0 via `openapi: '3.1.0'` string

### Tertiary (LOW confidence)
- @scalar/fastify-api-reference exact latest version (1.43+) -- npm was inaccessible, version from web search

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - @fastify/swagger already installed, Scalar well-documented
- Architecture: HIGH - existing codebase patterns are clear, 4 files already use RFC 9457
- Pitfalls: HIGH - inspected all error response patterns in codebase, counted occurrences

**Research date:** 2026-03-30
**Valid until:** 2026-04-30 (stable libraries, well-defined specs)
