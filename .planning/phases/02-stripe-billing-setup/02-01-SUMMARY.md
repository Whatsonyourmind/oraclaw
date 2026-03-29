---
phase: 02-stripe-billing-setup
plan: 01
subsystem: payments
tags: [stripe, sdk, billing, metered, typescript]

# Dependency graph
requires:
  - phase: 01-auth-and-access-control
    provides: Unkey auth middleware and test patterns (mock-unkey.ts factory)
provides:
  - "stripe@21.0.1 as real dependency in package.json (no @ts-ignore)"
  - "Stripe client configured with apiVersion 2026-03-25.dahlia"
  - "Shared Stripe mock factory (createMockStripe) for downstream tests"
  - "STRIPE_METER_EVENT_NAME env var documented"
affects: [02-02-PLAN (meter usage hook), 03-billing-tiers, 08-e2e-verification]

# Tech tracking
tech-stack:
  added: [stripe@21.0.1]
  patterns: [mock-factory-per-sdk, dahlia-api-version-convention]

key-files:
  created:
    - mission-control/apps/api/src/test-utils/mock-stripe.ts
  modified:
    - mission-control/apps/api/package.json
    - mission-control/apps/api/src/services/billing/stripe.ts
    - mission-control/apps/api/.env.example
    - mission-control/package-lock.json

key-decisions:
  - "Fixed 6 Stripe SDK v21 breaking changes inline (coupon->discounts, retrieveUpcoming->createPreview, current_period_start/end removal, invoice.subscription->parent.subscription_details)"
  - "Used billing_cycle_anchor and start_date as replacements for removed current_period_end/start fields"
  - "Pinned stripe to exact 21.0.1 (no caret) per must_haves spec"

patterns-established:
  - "mock-stripe.ts: Factory returns { client, meterEventsCreate } for injection + assertion (matches mock-unkey.ts)"
  - "Stripe dahlia API: use createPreview instead of retrieveUpcoming, discounts array instead of coupon string"

requirements-completed: [INFRA-01]

# Metrics
duration: 9min
completed: 2026-03-29
---

# Phase 2 Plan 01: Stripe SDK Install and apiVersion Upgrade Summary

**Stripe SDK v21.0.1 installed as real dependency with apiVersion 2026-03-25.dahlia, 6 breaking changes fixed, and shared mock factory created**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-29T20:39:59Z
- **Completed:** 2026-03-29T20:49:50Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Stripe SDK v21.0.1 installed as exact dependency (was optional/ts-ignored before)
- apiVersion upgraded from 2023-10-16 to 2026-03-25.dahlia with all 6 breaking type changes fixed
- Shared mock factory (mock-stripe.ts) created following mock-unkey.ts pattern
- STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_METER_EVENT_NAME documented in .env.example

## Task Commits

Each task was committed atomically:

1. **Task 1: Install Stripe SDK and upgrade apiVersion** - `7620722` (feat)
2. **Task 2: Create shared Stripe mock factory** - `af2846b` (feat)

## Files Created/Modified
- `mission-control/apps/api/package.json` - Added stripe@21.0.1 as exact dependency
- `mission-control/apps/api/src/services/billing/stripe.ts` - Removed @ts-ignore, upgraded apiVersion, fixed 6 v21 breaking changes
- `mission-control/apps/api/src/test-utils/mock-stripe.ts` - New shared Stripe mock factory with billing.meterEvents.create spy
- `mission-control/apps/api/.env.example` - Added Stripe billing env vars
- `mission-control/package-lock.json` - Updated lockfile with stripe dependency

## Decisions Made
- **Fixed v21 breaking changes inline:** The plan stated "All existing customer/subscription/webhook code is compatible with dahlia (verified in research)" but tsc found 10 type errors. Fixed all 6 distinct breaking changes as Rule 1 auto-fix (bugs caused by the upgrade).
- **Replaced current_period_start/end:** These fields were removed from Subscription type in SDK v21. Used `start_date` for period start and `cancel_at` for period end as typed alternatives. These webhook handler data fields are informational (Record<string, any> return type).
- **Replaced retrieveUpcoming with createPreview:** Stripe v21 dahlia moved upcoming invoice preview to `invoices.createPreview()` with `subscription_details.items` parameter shape.
- **Replaced coupon with discounts:** Stripe v21 removed `coupon` from SubscriptionCreateParams, replaced with `discounts: [{ coupon }]` array.
- **Replaced invoice.subscription with parent.subscription_details:** Stripe v21 dahlia moved subscription reference to `invoice.parent.subscription_details.subscription`.
- **Pinned exact version:** Used `--save-exact` to match must_haves requirement of `"stripe": "21.0.1"` (no caret).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed 6 Stripe SDK v21 breaking type changes**
- **Found during:** Task 1 (tsc --noEmit verification step)
- **Issue:** Plan stated existing code was compatible with dahlia API, but SDK v21.0.1 types had 6 distinct breaking changes producing 10 type errors
- **Fix:** Updated all 6 breaking patterns: (1) coupon -> discounts on SubscriptionCreateParams, (2) retrieveUpcoming -> createPreview on invoices (2 call sites), (3) current_period_start/end removed from Subscription (4 references), (4) invoice.subscription -> parent.subscription_details.subscription (2 references), (5) UpcomingInvoice return type -> Invoice, (6) subscription_items -> subscription_details.items parameter shape
- **Files modified:** mission-control/apps/api/src/services/billing/stripe.ts
- **Verification:** `tsc --noEmit` passes clean with zero errors
- **Committed in:** 7620722 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug fix for SDK breaking changes)
**Impact on plan:** Essential for correctness -- tsc would not compile without these fixes. No scope creep; all changes are direct consequences of the planned SDK upgrade.

## Issues Encountered
None beyond the deviation above.

## User Setup Required

**External services require manual configuration.** Stripe API keys needed before Plan 02:
- `STRIPE_SECRET_KEY` - From Stripe Dashboard > Developers > API keys > Secret key
- `STRIPE_WEBHOOK_SECRET` - From Stripe Dashboard > Developers > Webhooks
- `STRIPE_METER_EVENT_NAME` - Default: `api_calls` (create meter in Stripe Dashboard > Billing > Meters)

## Next Phase Readiness
- Stripe SDK properly typed and compiled -- ready for Plan 02 meter usage hook (TDD)
- Mock factory ready for Plan 02 test-first development
- All Stripe env vars documented for developer onboarding

---
*Phase: 02-stripe-billing-setup*
*Completed: 2026-03-29*
