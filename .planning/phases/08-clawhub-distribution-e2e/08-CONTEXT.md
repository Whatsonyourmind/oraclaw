# Phase 08: ClawHub Distribution + E2E Verification

## Context

Phase 8 is the final phase of the v21.0 milestone. It covers two requirements:

- **DIST-03**: 14 ClawHub skills published with USDC pricing ($0.01-$0.15/call)
- **INFRA-03**: End-to-end billing verification (free -> paid -> metered -> invoice -> x402)

## What Exists

- 14 ClawHub SKILL.md manifests already written in `packages/clawhub-skills/oraclaw-*/SKILL.md`
- `scripts/publish-all-clawhub.sh` exists (basic script using `clawhub publish`)
- `scripts/test-all-endpoints.ts` exists (basic Fastify inject test for 13 endpoints, no billing verification)
- All 17 API endpoints operational in `routes/oracle/api-public.ts`
- Batch endpoint at `routes/oracle/api-batch.ts`
- Three billing paths wired: free-tier (IP rate limit), Stripe metered (API key), x402 USDC (payment header)
- Mock factories exist: `test-utils/mock-stripe.ts`, `test-utils/mock-unkey.ts`, `test-utils/mock-x402.ts`

## What Needs to Be Done

### Plan 01: ClawHub Skill Package Infrastructure
- Add `package.json` to each of the 14 ClawHub skill directories (for `clawhub publish` compatibility)
- Enhance SKILL.md files with full API endpoint documentation and curl examples
- Update `publish-all-clawhub.sh` with skip/retry logic (matching `publish-all.sh` pattern)
- Create GitHub Actions workflow for ClawHub publishing

### Plan 02: E2E Billing Verification Tests
- Create comprehensive E2E test file verifying all three billing paths using Fastify inject
- Test free-tier: unauthenticated call -> result -> no meter event
- Test Stripe-tier: API key call -> result -> meter event emitted
- Test x402-tier: USDC payment header -> result -> settlement called
- Test batch billing: batch call -> 50% metered discount
- Verify all 17 endpoints return valid responses

### Plan 03: Demo & Distribution Documentation
- Create demo script with curl examples for all endpoints
- Create quickstart guide (README-API.md) with setup instructions
- Create `.env.example` with all required environment variables
