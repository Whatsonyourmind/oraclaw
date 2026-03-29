# Phase 1: Auth and Access Control - Research

**Researched:** 2026-03-28
**Domain:** API key authentication, distributed rate limiting, Fastify lifecycle hooks
**Confidence:** HIGH

## Summary

Phase 1 replaces the current in-memory prefix-based auth system in `api-public.ts` with Unkey-powered API key verification and distributed rate limiting. The existing code has two clear problems: (1) `checkApiKey()` uses string prefix matching (`ok_test_*` = starter, `ok_live_*` = growth) instead of real key validation, and (2) `checkRateLimit()` uses an in-memory `Map<string, {count, resetAt}>` that resets on every deploy and cold start.

The `@unkey/api@2.3.2` SDK is already installed in `node_modules` but has zero actual usage in the codebase -- only TODO comments. The SDK provides a class-based `Unkey` client with `keys.verifyKey()` that performs authentication AND rate limiting in a single API call. The response includes `ratelimits[].remaining`, `ratelimits[].limit`, and `ratelimits[].reset` fields that map directly to the required `X-RateLimit-*` response headers. Rate limits configured with `autoApply: true` at key creation time are enforced automatically during verification without needing to pass them in the request.

**Primary recommendation:** Use `Unkey` class instance with `keys.verifyKey()` in a Fastify `preHandler` hook, configure per-tier rate limits with `autoApply: true` at key creation time, and set rate limit headers from the verify response. No additional packages needed -- `@unkey/ratelimit` is NOT required for this phase.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AUTH-01 | API consumers can create and manage API keys via Unkey | Unkey SDK `keys.createKey()` with `apiId`, `prefix`, `meta`, `ratelimits`, `externalId`; `keys.deleteKey()` for revocation; `keys.updateKey()` for settings changes. Key metadata stores `{ tier, stripeCustomerId }`. |
| AUTH-02 | API keys can be rotated and revoked without downtime | Unkey SDK `keys.rerollKey()` with configurable `expiration` (overlap period in ms, 0 = immediate). `keys.deleteKey()` for permanent revocation. `keys.updateKey({ enabled: false })` for temporary disable. Changes propagate within 30 seconds. |
| AUTH-03 | Rate limits enforced per tier via Unkey (not in-memory), replacing prefix-based auth | Rate limits configured per-key at creation via `ratelimits: [{ name, limit, duration, autoApply: true }]`. Verified automatically during `keys.verifyKey()`. Response `code: "RATE_LIMITED"` when exceeded. Replaces `dailyCounts` Map and `checkRateLimit()`. |
| AUTH-04 | Every API response includes rate limit headers (X-RateLimit-Remaining, X-RateLimit-Limit, X-RateLimit-Reset) | `verifyKey` response includes `ratelimits[].remaining`, `ratelimits[].limit`, `ratelimits[].reset`. Map these to response headers in Fastify `onSend` hook. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@unkey/api` | 2.3.2 | API key verification + rate limiting | Already installed. Single `verifyKey()` call handles auth + rate limits + metadata in one round trip. Rebuilt in Go for 6x performance. Free tier covers 1,000 monthly active keys. |
| `fastify` | 5.8.4 | HTTP server, lifecycle hooks | Already deployed. `preHandler` hooks for auth, `onSend` hooks for headers. Native async support. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `vitest` | 1.2.0 | Test framework | Already installed. Used for unit + integration tests with `vi.fn()` mocking. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Unkey `verifyKey()` built-in rate limits | `@unkey/ratelimit` standalone package | Standalone is for non-key-based rate limiting (e.g., by IP). For key-based rate limiting, `verifyKey()` with `autoApply: true` is simpler and saves a network round trip. |
| Unkey cloud rate limiting | `@fastify/rate-limit` | Fastify rate limit is in-memory or Redis-backed. Unkey is edge-distributed with zero infrastructure. Same problem as current `dailyCounts` Map on Render free tier. |
| Unkey key metadata for tier | Database lookup per request | Metadata is returned with every `verifyKey()` call. Zero additional latency. No database dependency. |

**Installation:**
```bash
# Nothing to install -- @unkey/api@2.3.2 already in package.json
# Verify: cd mission-control/apps/api && npm ls @unkey/api
```

## Architecture Patterns

### Recommended Project Structure
```
apps/api/src/
  middleware/
    auth.ts              # NEW: Unkey auth preHandler hook
    rateLimit.ts         # NEW: Rate limit header injection (onSend hook)
  services/
    unkey.ts             # NEW: Unkey client singleton + tier config
  routes/oracle/
    api-public.ts        # MODIFIED: Remove checkApiKey, checkRateLimit, dailyCounts, logUsage stubs
```

### Pattern 1: Unkey Client Singleton
**What:** Instantiate `Unkey` class once at startup, reuse across all requests.
**When to use:** Always -- avoid creating SDK instances per request.
**Example:**
```typescript
// Source: @unkey/api v2.3.2 type definitions (verified from node_modules)
import { Unkey } from '@unkey/api';

const unkey = new Unkey({
  rootKey: process.env.UNKEY_ROOT_KEY,
});

// Single call: auth + rate limit + metadata
const { data, error } = await unkey.keys.verifyKey({
  key: apiKeyFromHeader,
  // No need to pass ratelimits when autoApply: true is configured on the key
});
```

### Pattern 2: verifyKey Response Mapping
**What:** Map Unkey verify response to request context and response headers.
**When to use:** Every authenticated request.
**Example:**
```typescript
// Source: @unkey/api v2.3.2 V2KeysVerifyKeyResponseData type definition
// Response data fields:
//   valid: boolean
//   code: 'VALID'|'NOT_FOUND'|'RATE_LIMITED'|'DISABLED'|'EXPIRED'|...
//   meta: { tier, stripeCustomerId } (custom metadata set at key creation)
//   ratelimits: Array<{ exceeded, name, limit, duration, reset, remaining, autoApply }>

if (!data.valid) {
  const statusMap: Record<string, number> = {
    'NOT_FOUND': 401,
    'RATE_LIMITED': 429,
    'DISABLED': 403,
    'EXPIRED': 401,
    'USAGE_EXCEEDED': 429,
    'FORBIDDEN': 403,
  };
  const status = statusMap[data.code] ?? 401;
  return reply.code(status).send({
    type: `https://oraclaw.dev/errors/${data.code.toLowerCase().replace('_', '-')}`,
    title: data.code === 'RATE_LIMITED' ? 'Rate limit exceeded' : 'Unauthorized',
    status,
    detail: data.code,
  });
}

// Attach to request for downstream use
request.tier = data.meta?.tier ?? 'free';
request.stripeCustomerId = data.meta?.stripeCustomerId;
request.keyId = data.keyId;

// Rate limit headers from first ratelimit entry
const rl = data.ratelimits?.[0];
if (rl) {
  request.rateLimitRemaining = rl.remaining;
  request.rateLimitLimit = rl.limit;
  request.rateLimitReset = rl.reset;
}
```

### Pattern 3: Rate Limit Headers via onSend Hook
**What:** Inject X-RateLimit-* headers on every response, not just auth failures.
**When to use:** Every API response under `/api/v1/`.
**Example:**
```typescript
// Source: Fastify Hooks docs (https://fastify.dev/docs/latest/Reference/Hooks/)
fastify.addHook('onSend', async (request, reply, payload) => {
  if (request.rateLimitRemaining !== undefined) {
    reply.header('X-RateLimit-Remaining', request.rateLimitRemaining);
    reply.header('X-RateLimit-Limit', request.rateLimitLimit);
    reply.header('X-RateLimit-Reset', request.rateLimitReset);
  }
  return payload;
});
```

### Pattern 4: Key Creation with Tier-Based Rate Limits
**What:** Create keys with `autoApply: true` rate limits matching the user's tier.
**When to use:** User signup, tier upgrade/downgrade.
**Example:**
```typescript
// Source: @unkey/api v2.3.2 V2KeysCreateKeyRequestBody type definition
const TIER_LIMITS = {
  starter:    { limit: 1667,    duration: 86400000 }, // ~50K/month as daily
  growth:     { limit: 16667,   duration: 86400000 }, // ~500K/month as daily
  scale:      { limit: 166667,  duration: 86400000 }, // ~5M/month as daily
  enterprise: { limit: 1000000, duration: 86400000 }, // effectively unlimited
};

const result = await unkey.keys.createKey({
  apiId: process.env.UNKEY_API_ID!,
  prefix: 'ok_live',
  name: `${userEmail} - ${tier}`,
  externalId: stripeCustomerId,  // links to Stripe customer
  meta: { tier, stripeCustomerId },
  ratelimits: [{
    name: 'api_calls',
    ...TIER_LIMITS[tier],
    autoApply: true,
  }],
  enabled: true,
});
// result.data.key = "ok_live_xxxxxxxxxx" -- return to user ONCE
```

### Pattern 5: Key Rotation with Overlap Period
**What:** Use `rerollKey()` to create new key while old key remains valid for a grace period.
**When to use:** User-initiated key rotation, compromised key response.
**Example:**
```typescript
// Source: @unkey/api v2.3.2 V2KeysRerollKeyRequestBody type definition
const result = await unkey.keys.rerollKey({
  keyId: existingKeyId,
  expiration: 3600000, // Old key valid for 1 more hour
  // expiration: 0    // Immediate revocation
});
// result.data.key = new key string
```

### Anti-Patterns to Avoid
- **In-memory rate counters for paid tiers:** The current `dailyCounts` Map resets on every deploy (every 15 minutes on Render free tier). Unkey is edge-distributed and persistent.
- **Prefix-based tier resolution:** `ok_test_*` = starter is easily forged. Unkey validates cryptographic keys and returns tier from stored metadata.
- **Per-handler auth calls:** Current code calls `checkApiKey(request)` inside each of 17 route handlers. Move to a single `preHandler` hook on the route prefix.
- **Synchronous auth in route body:** Current `const auth = checkApiKey(request)` at top of each handler blocks the route. With a `preHandler` hook, auth runs before the handler, and failed auth never enters the handler.
- **Rate limit check separate from auth:** Current code calls `checkRateLimit()` separately after `checkApiKey()`. Unkey does both in one `verifyKey()` call.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| API key generation | `crypto.randomBytes()` + prefix | Unkey `keys.createKey()` | Key storage, hashing, rotation, revocation, analytics all built in. Custom generation misses all of these. |
| Distributed rate limiting | Redis + Lua scripts or Map counter | Unkey key-level rate limits with `autoApply: true` | Edge-distributed, survives restarts, configurable per-key. Building this correctly requires sliding windows, distributed counters, and clock sync. |
| Key rotation | Custom key table + expiry column | Unkey `keys.rerollKey({ expiration })` | Grace period overlap built in. Custom solution needs to handle dual-key validation window, cleanup, and race conditions. |
| Tier-based rate limit config | Hardcoded `RATE_LIMITS` object | Unkey key metadata + rate limit config | Per-key configuration means tier changes take effect on next verify. No code deploy needed to change limits. |

**Key insight:** The current auth system is ~85 lines of code that handles creation, validation, tier resolution, and rate limiting -- all incorrectly (prefix matching, in-memory counters, no rotation). Unkey replaces all of it with a single `verifyKey()` call that does all four correctly.

## Common Pitfalls

### Pitfall 1: Forgetting autoApply on Rate Limits
**What goes wrong:** Rate limits configured on the key but not checked during verification because `autoApply` defaults to `false`.
**Why it happens:** The `RatelimitRequest.autoApply` field is optional and defaults to `false` if not specified.
**How to avoid:** Always set `autoApply: true` when creating keys with rate limits that should be enforced automatically.
**Warning signs:** `verifyKey()` returns `valid: true` even when the user should be rate limited. `ratelimits` array is empty in verify response.

### Pitfall 2: verifyKey Always Returns HTTP 200
**What goes wrong:** Treating HTTP 200 from Unkey as "key is valid" and not checking the `valid` field.
**Why it happens:** Unlike most APIs, Unkey returns 200 even for invalid keys. The verification result is in `data.valid` and `data.code`.
**How to avoid:** Always check `data.valid === true` before proceeding. Map `data.code` to appropriate HTTP status codes (401, 403, 429).
**Warning signs:** All keys appear to work, even revoked or expired ones.

### Pitfall 3: Missing Rate Limit Headers on Error Responses
**What goes wrong:** Rate limit headers only set on successful responses, missing on 401/429 errors.
**Why it happens:** Error responses returned early from `preHandler` bypass the `onSend` hook that sets headers (or the headers are set after the error reply).
**How to avoid:** Set rate limit headers directly in the `preHandler` when returning error responses, not just in `onSend`. Or use `onSend` which fires for ALL responses including errors.
**Warning signs:** Clients get 429 but no `X-RateLimit-Reset` to know when to retry.

### Pitfall 4: Free Tier Hitting Unkey on Every Request
**What goes wrong:** Anonymous requests (no API key) still call `verifyKey()`, wasting Unkey quota.
**Why it happens:** Auth middleware doesn't short-circuit for missing Authorization header.
**How to avoid:** Check for Authorization header first. No header = free tier, skip Unkey entirely. Use simple in-memory counter for free tier IP-based rate limiting (acceptable because free tier has no identity to persist).
**Warning signs:** Unkey monthly active key count spikes from anonymous traffic.

### Pitfall 5: Race Condition During Key Rotation
**What goes wrong:** Old key stops working before new key is distributed to the client.
**Why it happens:** `rerollKey()` with `expiration: 0` immediately revokes the old key.
**How to avoid:** Use a non-zero `expiration` (e.g., 3600000 = 1 hour) so both old and new keys work during the overlap period.
**Warning signs:** Users report "key stopped working" after rotation.

### Pitfall 6: Unkey SDK Error vs Verification Failure
**What goes wrong:** Network errors to Unkey treated as "invalid key" instead of "auth service unavailable".
**Why it happens:** Both `error` (SDK error) and `data.valid === false` (verification failure) cause failed auth, but they mean different things.
**How to avoid:** Check `error` first -- if present, it's a network/SDK issue, return 503. Only check `data` when `error` is null.
**Warning signs:** Unkey outage causes all keys to appear "invalid" (401) instead of "service unavailable" (503).

### Pitfall 7: Fastify Request Decoration Types
**What goes wrong:** TypeScript errors when accessing `request.tier`, `request.keyId`, etc. in route handlers.
**Why it happens:** Custom properties added in `preHandler` are not declared on Fastify's `FastifyRequest` type.
**How to avoid:** Use `fastify.decorateRequest()` to declare the properties, and extend the `FastifyRequest` interface via module augmentation.
**Warning signs:** `Property 'tier' does not exist on type 'FastifyRequest'` TypeScript errors.

## Code Examples

### Complete Auth Middleware (Verified Pattern)
```typescript
// Source: @unkey/api v2.3.2 SDK types + Fastify 5.8.4 hooks
import { Unkey } from '@unkey/api';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

// Module augmentation for custom request properties
declare module 'fastify' {
  interface FastifyRequest {
    tier: string;
    keyId?: string;
    stripeCustomerId?: string;
    rateLimitRemaining?: number;
    rateLimitLimit?: number;
    rateLimitReset?: number;
    billingPath: 'stripe' | 'free';
  }
}

export function createAuthMiddleware(unkey: Unkey) {
  return async function authMiddleware(request: FastifyRequest, reply: FastifyReply) {
    const authHeader = request.headers.authorization;

    // No auth header = free tier (skip Unkey entirely)
    if (!authHeader) {
      request.tier = 'free';
      request.billingPath = 'free';
      return; // Free tier rate limiting handled separately
    }

    const key = authHeader.replace('Bearer ', '');

    const { data, error } = await unkey.keys.verifyKey({ key });

    // SDK/network error = service unavailable
    if (error) {
      request.log.error({ error }, 'Unkey verification failed');
      return reply.code(503).send({
        type: 'https://oraclaw.dev/errors/service-unavailable',
        title: 'Authentication service unavailable',
        status: 503,
        detail: 'Unable to verify API key. Please retry.',
      });
    }

    // Set rate limit headers from verify response (even on failure)
    const rl = data.ratelimits?.[0];
    if (rl) {
      reply.header('X-RateLimit-Remaining', rl.remaining);
      reply.header('X-RateLimit-Limit', rl.limit);
      reply.header('X-RateLimit-Reset', rl.reset);
      request.rateLimitRemaining = rl.remaining;
      request.rateLimitLimit = rl.limit;
      request.rateLimitReset = rl.reset;
    }

    // Key verification failed
    if (!data.valid) {
      const statusMap: Record<string, number> = {
        'NOT_FOUND': 401,
        'RATE_LIMITED': 429,
        'DISABLED': 403,
        'EXPIRED': 401,
        'USAGE_EXCEEDED': 429,
        'FORBIDDEN': 403,
        'INSUFFICIENT_PERMISSIONS': 403,
      };
      const status = statusMap[data.code] ?? 401;
      return reply.code(status).send({
        type: `https://oraclaw.dev/errors/${data.code.toLowerCase().replaceAll('_', '-')}`,
        title: data.code === 'RATE_LIMITED' ? 'Rate limit exceeded' : 'Unauthorized',
        status,
        detail: `Key verification failed: ${data.code}`,
      });
    }

    // Valid key -- attach context
    request.tier = (data.meta?.tier as string) ?? 'starter';
    request.keyId = data.keyId;
    request.stripeCustomerId = data.meta?.stripeCustomerId as string | undefined;
    request.billingPath = 'stripe';
  };
}
```

### Unkey Client Setup
```typescript
// Source: @unkey/api v2.3.2 SDKOptions type definition
import { Unkey } from '@unkey/api';

export const unkey = new Unkey({
  rootKey: process.env.UNKEY_ROOT_KEY!,
  // Defaults: serverURL https://api.unkey.com, retries enabled
});
```

### Key Creation with Tiered Rate Limits
```typescript
// Source: @unkey/api v2.3.2 V2KeysCreateKeyRequestBody type
const TIER_RATE_LIMITS: Record<string, { limit: number; duration: number }> = {
  starter:    { limit: 1667,    duration: 86400000 },  // ~50K/month
  growth:     { limit: 16667,   duration: 86400000 },  // ~500K/month
  scale:      { limit: 166667,  duration: 86400000 },  // ~5M/month
  enterprise: { limit: 1000000, duration: 86400000 },  // effectively unlimited
};

export async function createApiKey(
  tier: string,
  stripeCustomerId: string,
  userEmail: string,
) {
  const limits = TIER_RATE_LIMITS[tier] ?? TIER_RATE_LIMITS.starter;

  const { data, error } = await unkey.keys.createKey({
    apiId: process.env.UNKEY_API_ID!,
    prefix: 'ok_live',
    name: `${userEmail} - ${tier}`,
    externalId: stripeCustomerId,
    meta: { tier, stripeCustomerId },
    ratelimits: [{
      name: 'api_calls',
      limit: limits.limit,
      duration: limits.duration,
      autoApply: true,
    }],
    enabled: true,
  });

  if (error) throw new Error(`Failed to create key: ${error.message}`);
  return data; // { key: "ok_live_xxx", keyId: "key_xxx" }
}
```

### Removing Old Auth Code (What to Delete)
```typescript
// DELETE from api-public.ts:
// Lines 28-112: ApiKeyPayload interface, RATE_LIMITS object, dailyCounts Map,
//   setInterval cleanup, checkApiKey(), checkRateLimit(), UsageEvent, usageLog, logUsage()
//
// REPLACE in each route handler:
//   const auth = checkApiKey(request);
//   if (!checkRateLimit("bandit-" + auth.tier, auth.tier)) { ... }
//   logUsage("bandit", auth.tier, start);
// WITH: nothing -- auth is handled by preHandler hook, usage logging moves to onResponse hook
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@unkey/api` v1.x functional API (`verifyKey()` standalone function) | v2.x class-based SDK (`new Unkey().keys.verifyKey()`) | 2025 | SDK restructured. Old `import { verifyKey } from '@unkey/api'` pattern no longer works. Must instantiate `Unkey` class. |
| Rate limits passed per-request in `verifyKey()` | `autoApply: true` on key creation | 2025-2026 | Rate limits configured once at key creation, enforced automatically. No need to pass `ratelimits` array on every verify call. |
| `@unkey/api` v1 simple response `{ valid, code, meta }` | v2 structured response `{ meta: { requestId }, data: { valid, code, ratelimits[], ... } }` | 2025 | Response wrapped in `{ meta, data }` envelope. Must access `data.valid` not `result.valid`. |

**Deprecated/outdated:**
- The STACK.md code example shows `import { verifyKey } from '@unkey/api'` -- this is the v1 API. The installed v2.3.2 uses class-based `new Unkey({ rootKey }).keys.verifyKey()`. The functional import pattern no longer exists.
- The STACK.md suggests installing `@unkey/ratelimit` -- this is NOT needed for key-based rate limiting. The `autoApply` feature on key rate limits makes `verifyKey()` handle everything.

## Open Questions

1. **Unkey Dashboard Setup Required**
   - What we know: The SDK requires `UNKEY_ROOT_KEY` and `UNKEY_API_ID` environment variables. Keys are created under an API namespace.
   - What's unclear: Whether the Unkey account/API namespace has been created yet.
   - Recommendation: Phase 1 Wave 0 should include Unkey Dashboard setup (create account, create API namespace, generate root key). Can be done with test mode keys for development.

2. **Free Tier Rate Limiting Strategy**
   - What we know: Anonymous requests (no API key) get free tier. Cannot use Unkey for these since there is no key.
   - What's unclear: Whether a simple in-memory IP counter is acceptable long-term for free tier.
   - Recommendation: Use in-memory IP counter for free tier (100 calls/day). This is acceptable because: free tier has no identity to persist, and the worst case on reset is free users get extra free calls.

3. **Existing 945 Tests**
   - What we know: 945 tests pass across 24 files. Tests use `app.inject()` to test routes.
   - What's unclear: How many tests directly hit `api-public.ts` routes and will need auth header mocking.
   - Recommendation: Mock the Unkey SDK in tests (mock `keys.verifyKey()` to return valid/invalid responses). Do NOT call real Unkey API in tests.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 1.2.0 |
| Config file | `mission-control/apps/api/vitest.config.ts` |
| Quick run command | `cd mission-control/apps/api && npx vitest run --reporter=verbose` |
| Full suite command | `cd mission-control && npm run test` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01 | Key creation via Unkey SDK, key verification, tier metadata | unit | `cd mission-control/apps/api && npx vitest run src/middleware/auth.test.ts -x` | No -- Wave 0 |
| AUTH-02 | Key rotation with overlap, key revocation stops access | unit | `cd mission-control/apps/api && npx vitest run src/services/unkey.test.ts -x` | No -- Wave 0 |
| AUTH-03 | Rate limits enforced per tier, 429 on exceed, Unkey replaces in-memory | unit + integration | `cd mission-control/apps/api && npx vitest run src/middleware/auth.test.ts -x` | No -- Wave 0 |
| AUTH-04 | X-RateLimit-Remaining, X-RateLimit-Limit, X-RateLimit-Reset on every response | integration | `cd mission-control/apps/api && npx vitest run src/routes/oracle/api-public.test.ts -x` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `cd mission-control/apps/api && npx vitest run --reporter=verbose`
- **Per wave merge:** `cd mission-control && npm run test` (full 945+ tests)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/middleware/auth.test.ts` -- covers AUTH-01, AUTH-03, AUTH-04 (mock Unkey SDK, test preHandler behavior)
- [ ] `src/services/unkey.test.ts` -- covers AUTH-01, AUTH-02 (key creation, rotation, revocation via mocked SDK)
- [ ] `src/routes/oracle/api-public.test.ts` -- covers AUTH-04 integration (verify rate limit headers on real route responses)
- [ ] Unkey SDK mock utility (`src/test-utils/mock-unkey.ts`) -- shared mock for `Unkey` class returning configurable responses

*(Existing test infrastructure is vitest with `app.inject()` pattern. Framework config exists. Only new test files needed.)*

## Sources

### Primary (HIGH confidence)
- `@unkey/api@2.3.2` installed TypeScript type definitions -- `V2KeysVerifyKeyRequestBody`, `V2KeysVerifyKeyResponseData`, `VerifyKeyRatelimitData`, `V2KeysCreateKeyRequestBody`, `V2KeysRerollKeyRequestBody`, `RatelimitRequest`, `SDKOptions`, `Unkey` class structure. Verified directly from `node_modules/@unkey/api/dist/esm/`.
- [Unkey verifyKey API Reference](https://www.unkey.com/docs/api-reference/v2/keys/verify-api-key) -- HTTP 200 for all outcomes, `valid` field check, `code` enum values, rate limit response fields.
- [Unkey Key Rate Limits Overview](https://www.unkey.com/docs/apis/features/ratelimiting/overview) -- `autoApply: true` enforced automatically during verification, manual vs auto-apply distinction.
- Existing codebase: `api-public.ts` (lines 28-112: current auth, rate limit, usage logging stubs), `auth.ts` (JWT-based auth routes), `index.ts` (Fastify setup, preHandler hooks), `vitest.config.ts` (test configuration).

### Secondary (MEDIUM confidence)
- [Unkey Fastify Template](https://www.unkey.com/templates/fastify) -- Confirms Fastify integration pattern uses middleware/services/controllers structure. Rate limiting to 10 req/day demonstrated.
- `.planning/research/STACK.md` -- Unkey selection rationale, alternatives analysis. NOTE: Code examples use v1 API pattern which is outdated for v2.3.2.
- `.planning/research/ARCHITECTURE.md` -- Component boundaries, data flow diagrams, build order. NOTE: `verifyKey` import pattern is v1, not v2.

### Tertiary (LOW confidence)
- None. All findings verified from installed package types or official documentation.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- `@unkey/api@2.3.2` already installed, types verified from `node_modules`
- Architecture: HIGH -- Fastify preHandler/onSend hook pattern well-documented, existing codebase uses hooks pattern in `index.ts`
- Pitfalls: HIGH -- SDK response structure verified from type definitions, `autoApply` behavior confirmed from official docs
- API surface: HIGH -- All `verifyKey`, `createKey`, `rerollKey`, `deleteKey`, `updateKey` types inspected from installed package

**Research date:** 2026-03-28
**Valid until:** 2026-04-28 (30 days -- Unkey v2 API is stable)
