---
phase: 03-billing-tiers-and-portal
plan: 02
subsystem: billing
tags: [fastify, stripe, checkout, portal, billing, rfc-9457, subscription]

# Dependency graph
requires:
  - phase: 03-billing-tiers-and-portal
    provides: "TIER_CONFIG with stripePriceId for all tiers"
  - phase: 02-stripe-billing-setup
    provides: "Stripe SDK singleton (stripe) and StripeService with createCheckoutSession()"
  - phase: 01-auth-and-access-control
    provides: "Unkey auth middleware setting request.stripeCustomerId and request.tier"
provides:
  - "POST /api/v1/billing/subscribe endpoint for Stripe Checkout Session creation"
  - "POST /api/v1/billing/portal-session endpoint for Stripe Customer Portal"
  - "subscribeRoutes and portalRoutes Fastify plugins"
  - "Updated mock-stripe.ts with checkout and portal mocks"
affects: [webhook-handling, usage-dashboard, billing-management]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Fastify plugin route pattern for billing endpoints", "RFC 9457 error responses on billing routes", "Raw stripe client for billingPortal (not StripeService)"]

key-files:
  created:
    - "mission-control/apps/api/src/routes/billing/subscribe.ts"
    - "mission-control/apps/api/src/routes/billing/subscribe.test.ts"
    - "mission-control/apps/api/src/routes/billing/portal.ts"
    - "mission-control/apps/api/src/routes/billing/portal.test.ts"
  modified:
    - "mission-control/apps/api/src/test-utils/mock-stripe.ts"
    - "mission-control/apps/api/src/index.ts"

key-decisions:
  - "Used raw stripe client for billingPortal.sessions.create since StripeService does not expose portal methods"
  - "Enterprise tier rejected at subscribe endpoint (contact sales flow, not self-service)"
  - "NON_SUBSCRIBABLE_TIERS Set for O(1) lookup of free and enterprise exclusions"

patterns-established:
  - "Billing route plugin pattern: async function registered with /api/v1/billing prefix"
  - "Auth guard pattern: check request.stripeCustomerId -> 403 if missing (free-tier users)"
  - "Mock Stripe factory extended with checkoutSessionsCreate and billingPortalSessionsCreate spies"

requirements-completed: [BILL-03, BILL-05]

# Metrics
duration: 4min
completed: 2026-03-29
---

# Phase 03 Plan 02: Subscription Checkout and Customer Portal Summary

**Stripe Checkout subscription flow for starter/growth/scale tiers and self-service billing portal with RFC 9457 error handling**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-29T21:34:22Z
- **Completed:** 2026-03-29T21:38:42Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- POST /api/v1/billing/subscribe creates Stripe Checkout Sessions for starter, growth, and scale tiers
- POST /api/v1/billing/portal-session returns Stripe Customer Portal URL for paying customers
- Both endpoints reject free-tier users with 403 (no stripeCustomerId)
- Subscribe endpoint rejects unknown tiers and free/enterprise with 400
- 8 new tests (5 subscribe + 3 portal) covering BILL-03b and BILL-05a/b
- Full test suite at 1042 tests with zero regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Create subscribe and portal routes with TDD tests** - `228d334` (feat, TDD)
2. **Task 2: Wire billing routes into Fastify server** - `530c182` (feat)

## Files Created/Modified
- `mission-control/apps/api/src/routes/billing/subscribe.ts` - POST /subscribe: validates tier, checks stripeCustomerId, creates Checkout Session
- `mission-control/apps/api/src/routes/billing/subscribe.test.ts` - 5 tests: valid tier, unknown tier, free tier, enterprise tier, no customerId
- `mission-control/apps/api/src/routes/billing/portal.ts` - POST /portal-session: creates Stripe billing portal session
- `mission-control/apps/api/src/routes/billing/portal.test.ts` - 3 tests: valid customer, free-tier 403, correct params
- `mission-control/apps/api/src/test-utils/mock-stripe.ts` - Added checkoutSessionsCreate and billingPortalSessionsCreate mocks
- `mission-control/apps/api/src/index.ts` - Import and register subscribeRoutes + portalRoutes under /api/v1/billing

## Decisions Made
- **Raw Stripe client for portal:** Used `stripe.billingPortal.sessions.create()` directly instead of StripeService because StripeService does not expose portal session methods. This follows the plan's guidance.
- **Enterprise rejected at subscribe:** Enterprise tier returns 400 with "contact sales" message -- it requires custom agreements, not self-service Checkout.
- **NON_SUBSCRIBABLE_TIERS as Set:** Used a Set(['free', 'enterprise']) for O(1) lookups when validating subscribable tiers.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - routes are functional with mock/test Stripe keys. For production use, see the plan's user_setup section for Stripe Dashboard configuration (Customer Portal, Billing Meter, Product/Price IDs).

## Next Phase Readiness
- All billing routes wired and tested
- Phase 03 complete: free-tier rate limiting (Plan 01) + subscription checkout + portal (Plan 02)
- Ready for Phase 04 (usage tracking/dashboard) or Phase 05 (x402 machine payments)
- Full test suite green at 1042 tests

## Self-Check: PASSED

All 6 created/modified source files verified on disk. Both task commits (228d334, 530c182) verified in git log.

---
*Phase: 03-billing-tiers-and-portal*
*Completed: 2026-03-29*
