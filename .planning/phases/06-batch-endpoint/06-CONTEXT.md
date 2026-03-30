# Phase 6: Batch Endpoint - Context

**Gathered:** 2026-03-30
**Status:** Ready for planning
**Source:** Auto-advance (decisions derived from codebase patterns, requirements, and API structure)

<domain>
## Phase Boundary

A single POST endpoint that accepts multiple algorithm calls in one request and returns all results in one response. Partial failures are handled gracefully (successful results returned alongside error details). Batch calls are metered at 50% of the per-call Stripe rate. This is the public API batch endpoint (DX-04), not the legacy mobile CRUD batch (routes/oracle/batch.ts).

</domain>

<decisions>
## Implementation Decisions

### Endpoint design
- Single POST route at `/api/v1/batch` accepting an array of algorithm call objects
- Each call object specifies: `algorithm` (matching existing endpoint names like "optimize/bandit"), `params` (the request body for that algorithm)
- Response is an array of results in the same order as the request, each with `status`, `data` (on success), or `error` (on failure in RFC 9457 format)
- Maximum batch size: 20 calls per request (prevents abuse, keeps response time reasonable)

### Partial failure handling
- Each algorithm call in the batch is executed independently — one failure does not abort others
- Failed calls return their RFC 9457 error inline (using sendProblem pattern adapted for batch response)
- The HTTP response status is 200 even if some calls fail (the per-call status is in the response body)
- If ALL calls fail, still return 200 with all errors — the batch endpoint itself succeeded

### Billing and metering
- Batch calls metered at 50% rate: emit Stripe meter event with `value: '0.5'` per call instead of `'1'`
- Metering fires once per batch with total value (e.g., 5 calls = value `'2.5'`)
- x402 machine payments: batch pricing is 50% of per-call USDC price
- Free tier: batch calls count against the 100 calls/day limit (each call in batch counts as 1)

### Auth and middleware
- Batch endpoint uses the same auth middleware as individual endpoints (Unkey API key or x402)
- Free tier can use batch (counts against daily limit)
- Rate limiting applies to the batch request itself (1 request), not per-call within the batch

### Algorithm dispatch
- Reuse existing algorithm functions from api-public.ts — import the same service functions
- Each batch call is dispatched to the corresponding algorithm function internally (no HTTP round-trips)
- Algorithm name maps to the endpoint path: `"optimize/bandit"` → same handler logic as POST `/api/v1/optimize/bandit`

### Claude's Discretion
- Internal dispatch mechanism (lookup table vs dynamic routing)
- Concurrency strategy (parallel vs sequential execution of calls within a batch)
- Request/response schema validation approach (Zod schemas vs inline checks)
- Whether to add batch-specific OpenAPI schema annotations

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/routes/oracle/api-public.ts`: All 14 algorithm route handlers — the batch endpoint dispatches to the same underlying service functions
- `src/hooks/meter-usage.ts`: createMeterUsageHook — needs adaptation for batch metering with `value: '0.5'` per call
- `src/utils/problem-details.ts`: sendProblem + ProblemTypes — use for per-call error responses within batch
- `src/middleware/auth.ts`: Unkey auth middleware — batch endpoint uses same auth flow
- `src/hooks/x402-payment.ts`: x402 hook — batch endpoint supports x402 at 50% rate

### Established Patterns
- Algorithm handlers in api-public.ts parse `request.body`, call service function, return result — same pattern used for batch dispatch
- `request.billingPath` determines metering behavior — batch hook checks this
- RFC 9457 error format for all errors
- Fastify plugin encapsulation for route registration

### Integration Points
- `src/index.ts`: Register batch route alongside publicApiRoutes
- `src/hooks/meter-usage.ts`: May need batch-aware variant or the batch route handles metering itself
- OpenAPI schema in swagger.ts: Batch endpoint needs schema for Scalar docs

</code_context>

<specifics>
## Specific Ideas

- The batch endpoint is primarily for AI agents and power users who need multiple algorithm results in a coordinated way (e.g., run bandit + montecarlo + ensemble for a decision)
- 50% discount incentivizes batch usage, reducing API call overhead for both client and server
- The existing legacy batch.ts (CRUD operations for mobile) is completely separate and should not be modified

</specifics>

<deferred>
## Deferred Ideas

- Batch-specific analytics (most common algorithm combinations) — future enhancement
- Async batch processing with webhook callback — v2 consideration
- Batch result caching — future optimization

</deferred>

---

*Phase: 06-batch-endpoint*
*Context gathered: 2026-03-30*
