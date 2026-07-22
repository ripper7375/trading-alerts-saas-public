# Migration Order: Webhooks (Slice 2) → money-service

> For sessions that **move existing code between stacks** (Next.js lib/routes → NestJS; monolith rewiring). Read `00-SKELETON-AND-RULES.md` first — §4 applies with the dial at **Low**: behavioral parity is absolute.

**Session:** 4A-4 (BUILD) · **Variant:** PORT · **Status:** CONFIRMED
**Generated:** 2026-07-22 · **Estimated time:** ~3h
**Phase / plan section:** Phase 4A — money-service, blueprint §5.5 Slice 2 (of 5)
**Target service:** money-service
**Contract:** External Webhooks (`dLocal` + `RiseWorks`) + Prisma schema subset.

## Why this session, why now

Slice 1 (Crons) is currently BUILT and shadow-running in production. To continue the strangler migration without blocking, we are moving to Slice 2: Webhook receivers. `money-service` needs to natively receive and process payment and disbursement events from external providers (dLocal and RiseWorks).

## Entry criteria

- [x] Session 4A-1 (infrastructure) is complete and money-service is deployable.
- [x] Phase 4A blueprint is approved.
- [x] Davin approves this DRAFT.

## Context & Boundaries

- **In scope:** `app/api/webhooks/dlocal/route.ts` and `app/api/webhooks/riseworks/route.ts` and their direct downstream processing logic.
- **Out of scope:** `app/api/webhooks/stripe/route.ts` (this is explicitly mapped to Slice 4). Do not port Stripe webhooks yet.
- **Safety Gate:** The new webhook endpoints in NestJS will have unique paths (e.g. `/webhooks/dlocal` and `/webhooks/riseworks`). They will not receive live production traffic until Session 4A-5 (when we update the URLs in the respective provider dashboards).

## File port order

**File 1/4: Schema subset expansion**

- Check `packages/db/prisma/schema.prisma` inside `money-service`.
- Ensure all models required by the webhooks are present. From reading the NextJS webhook routes, this requires at minimum: `Payment`, `Subscription`, `RiseWorksWebhookEvent`, and anything accessed by `WebhookEventProcessor` and `dlocal-payment.service`.
- Do not migrate the entire schema, only what the compiler demands for these specific files.

**File 2/4: dLocal Webhook Logic**

- Port `lib/dlocal/dlocal-payment.service.ts`, `lib/dlocal/three-day-validator.service.ts`, and `lib/affiliate/conversion-processor.ts` (if not already ported).
- Map `app/api/webhooks/dlocal/route.ts` to a NestJS controller `dlocal-webhook.controller.ts`.
- Ensure HMAC signature verification remains strictly identical.

**File 3/4: RiseWorks Webhook Logic**

- Port `lib/disbursement/providers/rise/webhook-verifier.ts` and `lib/disbursement/webhook/event-processor.ts`.
- Map `app/api/webhooks/riseworks/route.ts` to a NestJS controller `riseworks-webhook.controller.ts`.
- Ensure idempotency logic (`riseWorksWebhookEvent.create`) remains intact.

**File 4/4: Tests**

- Re-wire all existing test suites for the above logic to run within the NestJS testing module.
- Keep all assertions exactly the same. No behavioral changes.

## Verification plan

### 1. Build & Typecheck

- `money-service` compiles without errors.

### 2. Test Parity

- The ported test suites for dLocal and RiseWorks webhooks must all pass locally within `money-service`.

### 3. Deploy

- Deploy `money-service` to Railway.
- Verify the new endpoints (`POST /webhooks/dlocal` and `POST /webhooks/riseworks`) return a `401 Unauthorized` or `400 Bad Request` when hit manually without valid signatures (proving the routes are registered and protected).

## Retire (after cutover proves stable)

_(Not this session. After 4A-5 cutover proves stable, we will delete the NextJS routes.)_

## Deviations

**CONFIRM-phase findings (2026-07-22), all fixed in place, order stayed CONFIRMED:**

1. **File 1/4 path correction**: the order says `packages/db/prisma/schema.prisma`
   inside money-service; the real (and only) schema path is
   `money-service/prisma/schema.prisma` (no `packages/db/` prefix — that directory
   doesn't exist in money-service). Unambiguous, proceeding against the real path.
2. **3 untraced transitive dependencies found** (same class as L37,
   `LESSONS-LEARNED.md`) — none named in the order's File 2/4 step, all required for
   the named files to compile:
   - `lib/dlocal/constants.ts` (163 lines) — `PRICING` is imported directly by
     `app/api/webhooks/dlocal/route.ts`.
   - `types/dlocal.ts` (150 lines) — type definitions imported by both
     `dlocal-payment.service.ts` and the dLocal webhook route
     (`DLocalWebhookPayload`, `DLocalPaymentRequest/Response`, `PaymentStatus`,
     etc.); `lib/dlocal/constants.ts` also imports from it.
   - `lib/affiliate/commission-calculator.ts` (253 lines) — `conversion-processor.ts`
     imports `calculateFullBreakdown` from it directly.
     All 3 added to File 2/4's scope; ported alongside the named files.
3. **File 1/4 schema field gap**: money-service's existing narrow `User` model
   (Session 4A-2) has only `id/email/name/tier` — missing `hasUsedThreeDayPlan`
   (Boolean) and `threeDayPlanUsedAt` (DateTime?), both read/written by
   `three-day-validator.service.ts`. Added to the User model.
4. **Zero existing test coverage for `WebhookEventProcessor`** (event-processor.ts)
   anywhere in the monolith — no `__tests__` file references it. New backfill tests
   added under File 4/4, same precedent as Session 4A-2's zero-coverage backfills.
5. **Stale entry-criteria checkbox**: "Davin approves this DRAFT" was still unchecked
   despite the header already reading `Status: APPROVED`. Resolved by Davin's direct
   instruction to execute this session; checkbox corrected.

**Execution-phase deviation:**

6. **File 1/4 relation gap found at `npm run build`**: Session 4A-2's schema deliberately
   omitted the `AffiliateCode.affiliateProfile` relation object (comment: "NOT traversed
   anywhere" in the crons-only scope). `conversion-processor.service.ts` (File 2/4) DOES
   traverse it (`include: { affiliateProfile: { select: { id, status } } }`) to check the
   affiliate's ACTIVE status — `tsc` caught the mismatch immediately (`Type ... is not
assignable to type 'never'`). Added `AffiliateCode.affiliateProfile` +
   `AffiliateProfile.affiliateCodes` back-relation to the schema, matching the source
   schema's own field names exactly. `AffiliateCode.commissions` back-relation still
   correctly omitted (nothing in scope traverses it). `npx prisma generate` +
   `npm run build` both clean after the fix.

_(Execution deviations recorded below as they occur.)_
