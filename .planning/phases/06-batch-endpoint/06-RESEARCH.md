# Phase 6: Batch Endpoint - Research

**Researched:** 2026-03-30
**Domain:** Fastify batch API endpoint, Stripe metered billing, parallel algorithm dispatch
**Confidence:** HIGH

## Summary

Phase 6 implements a single POST endpoint (`/api/v1/batch`) that accepts an array of algorithm call objects, dispatches them to existing algorithm handler logic, returns ordered results with per-call success/error status, and meters the batch at a 50% discount via Stripe Billing Meters.

The codebase is well-structured for this. All 14+ algorithm handlers live in `api-public.ts` as inline route handler functions. The batch endpoint needs a dispatch map that routes algorithm names to the same logic those handlers use. Existing patterns for hooks (meter-usage, x402-payment, x402-settle), mock factories (mock-stripe, mock-unkey, mock-x402), and RFC 9457 error formatting (sendProblem + ProblemTypes) provide all building blocks.

**CRITICAL FINDING:** Stripe Billing Meters only accept **whole number** values in meter event payloads. The CONTEXT.md decision to use `value: '0.5'` per call will not work as written. The correct approach is to emit a meter event with `value: N` (number of calls in batch) to a **separate meter event name** (e.g., `api_calls_batch`) that is configured in Stripe with a unit price at 50% of the standard per-call rate. This achieves the same 50% discount without fractional values.

**Primary recommendation:** Build a lookup table mapping algorithm names to async handler functions extracted from api-public.ts, execute calls via `Promise.allSettled` for partial-failure handling, and meter using a separate Stripe meter event name for batch discount pricing.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Single POST route at `/api/v1/batch` accepting an array of algorithm call objects
- Each call object specifies: `algorithm` (matching existing endpoint names like "optimize/bandit"), `params` (the request body for that algorithm)
- Response is an array of results in the same order as the request, each with `status`, `data` (on success), or `error` (on failure in RFC 9457 format)
- Maximum batch size: 20 calls per request (prevents abuse, keeps response time reasonable)
- Each algorithm call in the batch is executed independently -- one failure does not abort others
- Failed calls return their RFC 9457 error inline (using sendProblem pattern adapted for batch response)
- The HTTP response status is 200 even if some calls fail (the per-call status is in the response body)
- If ALL calls fail, still return 200 with all errors -- the batch endpoint itself succeeded
- Batch calls metered at 50% rate: emit Stripe meter event with `value: '0.5'` per call instead of `'1'` (**NOTE: Stripe only accepts whole numbers; see research for corrected approach**)
- Metering fires once per batch with total value (e.g., 5 calls = value `'2.5'`) (**NOTE: corrected to whole number approach**)
- x402 machine payments: batch pricing is 50% of per-call USDC price
- Free tier: batch calls count against the 100 calls/day limit (each call in batch counts as 1)
- Batch endpoint uses the same auth middleware as individual endpoints (Unkey API key or x402)
- Free tier can use batch (counts against daily limit)
- Rate limiting applies to the batch request itself (1 request), not per-call within the batch
- Reuse existing algorithm functions from api-public.ts -- import the same service functions
- Each batch call is dispatched to the corresponding algorithm function internally (no HTTP round-trips)
- Algorithm name maps to the endpoint path: `"optimize/bandit"` -> same handler logic as POST `/api/v1/optimize/bandit`

### Claude's Discretion
- Internal dispatch mechanism (lookup table vs dynamic routing)
- Concurrency strategy (parallel vs sequential execution of calls within a batch)
- Request/response schema validation approach (Zod schemas vs inline checks)
- Whether to add batch-specific OpenAPI schema annotations

### Deferred Ideas (OUT OF SCOPE)
- Batch-specific analytics (most common algorithm combinations) -- future enhancement
- Async batch processing with webhook callback -- v2 consideration
- Batch result caching -- future optimization
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DX-04 | Batch endpoint accepts multiple algorithm calls in one request at 50% discount | Dispatch map from algorithm names to handler functions, `Promise.allSettled` for partial failures, separate Stripe meter event for 50% discount, x402 pricing at half rate |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Fastify | 5.8.4 | HTTP framework, route registration, hooks | Already in project |
| Stripe | 21.0.1 | Billing Meters API for usage metering | Already in project (pinned exact) |
| TypeScript | 5.3.3 | Type-safe implementation | Already in project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | (project version) | TDD test framework | All tests |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Lookup table dispatch | `app.inject()` internal HTTP | Lookup is faster (no HTTP overhead), cleaner, and what CONTEXT.md specifies |
| `Promise.allSettled` | Sequential `for...of` | allSettled is faster for independent calls; sequential simpler but slower |
| Separate batch meter event | Fractional values | Stripe does NOT support fractional values; separate meter is the only correct approach |

**Installation:**
No new packages needed. All dependencies already installed.

## Architecture Patterns

### Recommended Project Structure
```
src/
  routes/
    oracle/
      api-public.ts          # Existing: 14+ algorithm route handlers
      api-batch.ts            # NEW: Batch endpoint route + dispatch map
  hooks/
    meter-usage.ts            # Existing: Stripe metering hook (value: '1')
    meter-usage-batch.ts      # NEW: Batch metering variant (separate event name, value: N)
  test-utils/
    mock-stripe.ts            # Existing: reuse for batch tests
    mock-unkey.ts             # Existing: reuse for batch tests
```

### Pattern 1: Algorithm Dispatch Map
**What:** A `Record<string, (params: unknown) => Promise<unknown>>` that maps algorithm path names to handler functions.
**When to use:** When the batch endpoint needs to dispatch each call to the correct algorithm.
**Example:**
```typescript
// Source: Derived from api-public.ts route handler patterns
import { createBandit } from '../../services/oracle/algorithms/multiArmedBandit';
// ... other algorithm imports

type AlgorithmHandler = (params: unknown) => Promise<unknown>;

export const ALGORITHM_DISPATCH: Record<string, AlgorithmHandler> = {
  'optimize/bandit': async (params) => {
    const body = params as { arms: ...; algorithm?: ...; config?: ... };
    // Same logic as the route handler in api-public.ts
    const bandit = createBandit(body.config);
    // ...
    return result;
  },
  'optimize/contextual-bandit': async (params) => { /* ... */ },
  'solve/constraints': async (params) => { /* ... */ },
  // ... all 14+ algorithms
};
```

### Pattern 2: Parallel Execution with `Promise.allSettled`
**What:** Execute all algorithm calls in parallel, collecting both successes and failures.
**When to use:** For the batch endpoint to handle partial failures gracefully.
**Example:**
```typescript
// Source: Standard JavaScript pattern for partial failure handling
const results = await Promise.allSettled(
  calls.map((call, index) => {
    const handler = ALGORITHM_DISPATCH[call.algorithm];
    if (!handler) {
      return Promise.reject(new Error(`Unknown algorithm: ${call.algorithm}`));
    }
    return handler(call.params);
  }),
);

// Map to batch response format
const response = results.map((result, index) => {
  if (result.status === 'fulfilled') {
    return { status: 'success' as const, data: result.value };
  }
  return {
    status: 'error' as const,
    error: {
      type: ProblemTypes.VALIDATION,
      title: 'Algorithm call failed',
      status: 400,
      detail: result.reason?.message || 'Unknown error',
    },
  };
});
```

### Pattern 3: Batch Metering (Corrected for Whole Numbers)
**What:** Emit a single Stripe meter event with `value: N` (total calls in batch) to a batch-specific meter.
**When to use:** After the batch request completes successfully.
**Example:**
```typescript
// Source: Derived from meter-usage.ts pattern + Stripe docs
export function createBatchMeterHook(stripe: Stripe, batchEventName: string) {
  return async function batchMeterHook(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    if (request.billingPath !== 'stripe' || !request.stripeCustomerId || reply.statusCode >= 400) {
      return;
    }

    const batchSize = request.batchSize; // Set by batch route handler
    if (!batchSize || batchSize <= 0) return;

    // Fire-and-forget: emit ONE meter event with value = total calls
    // The Stripe meter price is configured at 50% of per-call rate
    stripe.billing.meterEvents
      .create({
        event_name: batchEventName,
        payload: {
          stripe_customer_id: request.stripeCustomerId,
          value: String(batchSize),  // Whole number, not fractional
        },
        identifier: `${request.id}-batch-${Date.now()}`,
      })
      .catch((err) => {
        request.log.error({ err }, 'Stripe batch meter event failed');
      });
  };
}
```

### Pattern 4: Batch Response Format (RFC 9457 Inline Errors)
**What:** Each result in the response array contains either `data` or an `error` in RFC 9457 format.
**Example:**
```typescript
// Source: Derived from problem-details.ts pattern
interface BatchCallResult {
  algorithm: string;
  status: 'success' | 'error';
  data?: unknown;
  error?: {
    type: string;
    title: string;
    status: number;
    detail: string;
  };
}

interface BatchResponse {
  results: BatchCallResult[];
  meta: {
    total: number;
    succeeded: number;
    failed: number;
  };
}
```

### Anti-Patterns to Avoid
- **Using `app.inject()` for internal dispatch:** Adds HTTP overhead (serialization, parsing, hook re-execution) for each call in the batch. Direct function dispatch is faster and avoids re-triggering auth/metering hooks.
- **Sending fractional meter values to Stripe:** Stripe Billing Meters only accept whole numbers. Sending `'0.5'` will cause the API call to fail or round unexpectedly.
- **Using `Promise.all` instead of `Promise.allSettled`:** `Promise.all` rejects on the first failure, losing results from other calls. `Promise.allSettled` always returns all results.
- **Re-triggering metering for individual calls:** The batch endpoint should meter ONCE for the entire batch, not per call. Individual calls dispatched within the batch should NOT trigger the normal `meter-usage` onResponse hook.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Error formatting | Custom error objects | `ProblemTypes` + RFC 9457 format from problem-details.ts | Consistency with all other endpoints |
| Auth verification | Custom auth check | Existing hook chain (x402 -> Unkey) already registered globally | Auth hooks fire before the batch route handler |
| Stripe metering | Custom Stripe API wrapper | `createMeterUsageHook` pattern (factory + fire-and-forget) | Proven pattern, fire-and-forget, error isolation |
| Algorithm execution | New algorithm wrappers | Same service functions imported in api-public.ts | DRY, same behavior as individual endpoints |

**Key insight:** The batch endpoint is fundamentally a thin dispatch layer over existing infrastructure. Auth, rate limiting, and x402 already work via global hooks. The only new logic is: (1) dispatch map, (2) `Promise.allSettled` aggregation, (3) batch-specific metering.

## Common Pitfalls

### Pitfall 1: Fractional Stripe Meter Values
**What goes wrong:** Sending `value: '0.5'` or `value: '2.5'` to Stripe `billing.meterEvents.create()` fails or produces unexpected results.
**Why it happens:** Stripe Billing Meters only accept whole number integer values.
**How to avoid:** Use a **separate meter event name** (e.g., `api_calls_batch`) configured in Stripe with a unit price at 50% of the standard per-call rate. Send `value: String(batchSize)` (whole number = count of calls).
**Warning signs:** Stripe API errors in logs, incorrect billing amounts.

### Pitfall 2: Double Metering
**What goes wrong:** The global `meterUsage` onResponse hook (already registered in index.ts) fires for the batch request too, metering it as 1 normal call on TOP of the batch-specific meter event.
**Why it happens:** The existing meter hook fires on ALL `/api/v1/*` responses with `billingPath === 'stripe'`.
**How to avoid:** Either (a) have the batch route set a flag (e.g., `request.isBatchRequest = true`) and check it in the existing meter hook to skip, or (b) handle batch metering entirely inside the batch route handler and skip the global hook.
**Warning signs:** Customers billed for N batch calls + 1 extra normal call per batch request.

### Pitfall 3: Hook Re-Execution on Internal Dispatch
**What goes wrong:** If using `app.inject()` for dispatch, auth hooks, rate limiters, and metering fire again for EACH internal sub-request.
**Why it happens:** `app.inject()` runs the full Fastify lifecycle including all registered hooks.
**How to avoid:** Use direct function dispatch (lookup table), not `app.inject()`. This is already the locked decision.
**Warning signs:** Auth errors on sub-requests, Unkey rate limit exceeded, multiple meter events per batch.

### Pitfall 4: Missing Algorithm Name Validation
**What goes wrong:** Unknown algorithm names cause unhandled errors or confusing responses.
**Why it happens:** No validation of the `algorithm` field against the dispatch map before execution.
**How to avoid:** Check `algorithm in ALGORITHM_DISPATCH` before dispatching. Return a clear RFC 9457 error for unknown algorithms.
**Warning signs:** Vague "Cannot read property of undefined" errors in batch responses.

### Pitfall 5: x402 Batch Pricing Miscalculation
**What goes wrong:** x402 machine payments charge the full per-call price instead of 50%.
**Why it happens:** The global x402 hook uses a fixed `pricePerCall` from env vars. Batch needs to calculate total at 50% rate.
**How to avoid:** The batch endpoint should modify the x402 pricing context (e.g., set a batch-adjusted price) or handle x402 batch payment verification with a halved total price.
**Warning signs:** Agents overpaying for batch calls via x402.

### Pitfall 6: Free-Tier Rate Limit Counting
**What goes wrong:** A batch of 20 calls only counts as 1 against the free tier's 100 calls/day limit.
**Why it happens:** The `@fastify/rate-limit` plugin counts the HTTP request, not the internal algorithm calls.
**How to avoid:** For free-tier batch requests, manually check remaining daily quota against batch size before executing. If `remainingQuota < batchSize`, reject with 429.
**Warning signs:** Free tier users circumventing limits by batching 20 calls per request.

## Code Examples

Verified patterns from the existing codebase:

### Batch Route Registration (follows api-public.ts pattern)
```typescript
// Source: Derived from api-public.ts and routes/billing/subscribe.ts patterns
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

interface BatchCall {
  algorithm: string;
  params: unknown;
}

interface BatchRequestBody {
  calls: BatchCall[];
}

export default async function batchRoute(fastify: FastifyInstance) {
  fastify.post('/api/v1/batch', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as BatchRequestBody;

    // Validate batch size
    if (!body.calls || !Array.isArray(body.calls) || body.calls.length === 0) {
      return sendProblem(reply, 400, ProblemTypes.VALIDATION, 'Validation Error', 'calls array is required and must not be empty');
    }
    if (body.calls.length > 20) {
      return sendProblem(reply, 400, ProblemTypes.VALIDATION, 'Validation Error', 'Maximum 20 calls per batch request');
    }

    // Dispatch all calls in parallel
    const settled = await Promise.allSettled(
      body.calls.map(call => dispatchAlgorithm(call.algorithm, call.params)),
    );

    // Build ordered response
    const results = settled.map((result, i) => {
      if (result.status === 'fulfilled') {
        return { algorithm: body.calls[i].algorithm, status: 'success' as const, data: result.value };
      }
      return {
        algorithm: body.calls[i].algorithm,
        status: 'error' as const,
        error: {
          type: ProblemTypes.INTERNAL,
          title: 'Algorithm call failed',
          status: 500,
          detail: result.reason?.message || 'Unknown error',
        },
      };
    });

    // Set batch size for metering hook
    (request as any).batchSize = body.calls.length;

    return {
      results,
      meta: {
        total: results.length,
        succeeded: results.filter(r => r.status === 'success').length,
        failed: results.filter(r => r.status === 'error').length,
      },
    };
  });
}
```

### Mock Stripe Factory Extension for Batch Metering
```typescript
// Source: Derived from test-utils/mock-stripe.ts pattern
// The existing createMockStripe() already returns meterEventsCreate spy
// Tests can assert batch metering calls with:
expect(meterEventsCreate).toHaveBeenCalledWith(
  expect.objectContaining({
    event_name: 'api_calls_batch',
    payload: {
      stripe_customer_id: 'cus_test123',
      value: '5',  // Whole number = batch size
    },
  }),
);
```

### Integration Test Pattern (follows x402-payment.test.ts style)
```typescript
// Source: Derived from hooks/x402-payment.test.ts integration test pattern
describe('batch endpoint integration', () => {
  let app: FastifyInstance;
  let stripeMock: ReturnType<typeof createMockStripe>;
  let unkeyMock: ReturnType<typeof createMockUnkey>;

  beforeAll(async () => {
    stripeMock = createMockStripe();
    unkeyMock = createMockUnkey();
    app = Fastify({ logger: false });

    // Register hooks in same order as index.ts
    // ... auth hooks, meter hooks ...

    // Register batch route
    await app.register(batchRoute);

    await app.ready();
  });

  it('returns partial results when one call fails', async () => {
    unkeyMock.keys.verifyKey.mockResolvedValueOnce(mockVerifyValid({ tier: 'starter', stripeCustomerId: 'cus_test' }));

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/batch',
      headers: { authorization: 'Bearer test-key' },
      payload: {
        calls: [
          { algorithm: 'optimize/bandit', params: { arms: [{ id: '1', name: 'A' }] } },
          { algorithm: 'nonexistent/algo', params: {} },
        ],
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.results[0].status).toBe('success');
    expect(body.results[1].status).toBe('error');
    expect(body.meta.succeeded).toBe(1);
    expect(body.meta.failed).toBe(1);
  });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `stripe.subscriptionItems.createUsageRecord()` | `stripe.billing.meterEvents.create()` | 2024 (Stripe Billing Meters GA) | New metering API; usage_records deprecated |
| Fractional meter values | Whole numbers only | Always (Stripe constraint) | Must use separate meter for discount pricing |
| `Promise.all` for batch | `Promise.allSettled` | ES2020+ | Graceful partial failure handling |
| `app.inject()` internal dispatch | Direct function dispatch | Fastify best practice | Avoids hook re-execution, faster |

**Deprecated/outdated:**
- `stripe.subscriptionItems.createUsageRecord()`: Replaced by Billing Meters. This project already uses the new API.
- Using `app.inject()` for batch sub-requests: Considered anti-pattern due to hook re-execution.

## Open Questions

1. **Stripe Meter Configuration for Batch Discount**
   - What we know: Stripe meter events require whole number values. A separate meter event name (`api_calls_batch`) with 50% unit pricing achieves the discount.
   - What's unclear: Whether the Stripe meter is already configured in the Dashboard, or needs to be created as part of this phase.
   - Recommendation: Use env var `STRIPE_BATCH_METER_EVENT_NAME` (default `api_calls_batch`). Document that the Stripe Dashboard meter must be created with 50% pricing. This is an infrastructure/config task, not a code task.

2. **Free-Tier Batch Quota Enforcement**
   - What we know: `@fastify/rate-limit` counts HTTP requests (1 per batch). Each call in the batch should count as 1 against the daily limit.
   - What's unclear: How to enforce batch-size-aware quota for free tier without access to the rate limiter's internal state.
   - Recommendation: For free tier, validate batch size against a reasonable sub-limit (e.g., max 5 calls per batch for free tier) rather than tracking internal state. Or, count free-tier batch calls by tracking via a lightweight counter (but this adds complexity for v1).

3. **Algorithm Handler Extraction Strategy**
   - What we know: Algorithm logic is currently inline in route handlers in api-public.ts.
   - What's unclear: Whether to extract handler logic into separate functions in a new file, or to import the service functions directly.
   - Recommendation: Build the dispatch map by importing the same service-layer functions (e.g., `createBandit`, `computeConvergence`, `solve`) and replicating the body-parsing + return-value-shaping logic from api-public.ts. This keeps api-public.ts untouched.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (project version) |
| Config file | `mission-control/apps/api/vitest.config.ts` |
| Quick run command | `cd mission-control/apps/api && npx vitest run src/routes/oracle/api-batch.test.ts` |
| Full suite command | `cd mission-control && npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DX-04a | Batch endpoint accepts array of algorithm calls | unit | `npx vitest run src/routes/oracle/api-batch.test.ts -t "accepts batch"` | No - Wave 0 |
| DX-04b | Returns results in same order as request | unit | `npx vitest run src/routes/oracle/api-batch.test.ts -t "same order"` | No - Wave 0 |
| DX-04c | Partial failures handled -- success + error inline | unit | `npx vitest run src/routes/oracle/api-batch.test.ts -t "partial failure"` | No - Wave 0 |
| DX-04d | HTTP 200 even when all calls fail | unit | `npx vitest run src/routes/oracle/api-batch.test.ts -t "all fail"` | No - Wave 0 |
| DX-04e | Max 20 calls enforced with 400 error | unit | `npx vitest run src/routes/oracle/api-batch.test.ts -t "max 20"` | No - Wave 0 |
| DX-04f | Stripe metering at 50% rate (whole number value, batch meter) | unit | `npx vitest run src/routes/oracle/api-batch.test.ts -t "meter"` | No - Wave 0 |
| DX-04g | x402 batch pricing at 50% of per-call | unit | `npx vitest run src/routes/oracle/api-batch.test.ts -t "x402"` | No - Wave 0 |
| DX-04h | Free tier batch counts against daily limit | unit | `npx vitest run src/routes/oracle/api-batch.test.ts -t "free tier"` | No - Wave 0 |
| DX-04i | Unknown algorithm returns error in results array | unit | `npx vitest run src/routes/oracle/api-batch.test.ts -t "unknown algorithm"` | No - Wave 0 |
| DX-04j | Empty/invalid calls array returns 400 | unit | `npx vitest run src/routes/oracle/api-batch.test.ts -t "validation"` | No - Wave 0 |

### Sampling Rate
- **Per task commit:** `cd mission-control/apps/api && npx vitest run src/routes/oracle/api-batch.test.ts`
- **Per wave merge:** `cd mission-control && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/routes/oracle/api-batch.test.ts` -- all DX-04 test cases
- [ ] `src/routes/oracle/api-batch.ts` -- batch route + dispatch map
- [ ] `src/hooks/meter-usage-batch.ts` -- batch-specific metering hook (or inline in batch route)
- [ ] Augment `FastifyRequest` with `batchSize?: number` and `isBatchRequest?: boolean` in middleware/auth.ts

## Sources

### Primary (HIGH confidence)
- **Existing codebase** (`api-public.ts`, `meter-usage.ts`, `x402-payment.ts`, `problem-details.ts`, `auth.ts`, `index.ts`) -- all handler patterns, hook patterns, error formatting, auth flow verified by reading source
- **Stripe Official Docs** ([Meter Events API](https://docs.stripe.com/api/billing/meter-event/create), [Recording Usage](https://docs.stripe.com/billing/subscriptions/usage-based/recording-usage-api)) -- confirmed whole number requirement for meter event values

### Secondary (MEDIUM confidence)
- **Stripe Billing Meters Configuration** ([Configure Meters](https://docs.stripe.com/billing/subscriptions/usage-based/meters/configure)) -- meter event names and pricing configuration
- **Fastify TypeScript Docs** ([TypeScript Reference](https://fastify.dev/docs/latest/Reference/TypeScript/)) -- type augmentation patterns

### Tertiary (LOW confidence)
- Batch endpoint parallelism patterns from community sources -- standard `Promise.allSettled` pattern, well-established

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in project, no new dependencies
- Architecture: HIGH - Dispatch map + Promise.allSettled is straightforward; existing patterns provide all building blocks
- Pitfalls: HIGH - Stripe whole-number constraint verified via official docs; double-metering risk identified from index.ts hook analysis
- Metering: HIGH - Separate batch meter event name is the correct approach for 50% discount with whole numbers

**Research date:** 2026-03-30
**Valid until:** 2026-04-30 (stable domain, no fast-moving dependencies)
