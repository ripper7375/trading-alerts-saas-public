# Migration Order — Standard Loop variant (B)

> Read `00-SKELETON-AND-RULES.md` first — standard loop rules apply. This session is the **CC-C hardening gate**
> for non-Wise money surfaces (Stripe/dLocal write paths + F14 Outbox pattern) before Slice 4 (Write APIs cutover).

**Session:** 4A-8 · **Variant:** Standard Loop (B) · **Status:** CONFIRMED
**Generated:** 2026-07-27 (Advisor) · **Revised:** 2026-07-27 (Advisor/Davin Ground-Truth Re-alignment) · **Estimated time:** ~2–3h
**Phase / plan section:** Phase 4A — money-service · Slice 4 Gate (Security & Idempotency Hardening)
**Ground truth:** `04-rise-to-wise-migration-plan.md` §4 "4A-8", `4a-w4-wise-hardening-gate.migration-order.md` (Audit findings), `DECISION-LOG.md` (F14).
**Contract:** Build reusable `IdempotencyInterceptor` in `money-service`, harden monolith Stripe/dLocal write endpoints per 4A-W4 audit matrix, resolve F14 (Transactional Outbox for tier updates), and verify CC-C/CC-D hardening compliance.

---

## Why this session, why now

Session 4A-W4 performed the audit of all money write endpoints and wired CC-C hardening for the Wise payout surface.
Session 4A-8 is the explicit **Slice 4 Hardening Gate**: it completes idempotency key handling on remaining Stripe and dLocal write paths (currently on monolith routes prior to 4A-9 porting) and builds the NestJS `IdempotencyInterceptor`, resolves **F14** (Transactional Outbox pattern for inter-service communication from `money-service` to `operation-service`), and verifies rate limits (`@Throttle`) and webhook deduplication across `money-service`.

Completing 4A-8 is required before Slice 4 (Write APIs cutover in Session 4A-9) can proceed.

---

## Scope Discipline & Grounded Line Counts

- **Files touched / created:**
  - `money-service/src/common/idempotency/idempotency.interceptor.ts` [NEW]
  - `lib/stripe/stripe.ts` & `app/api/checkout/route.ts` (Stripe Checkout idempotency key option)
  - `lib/dlocal/dlocal-payment.service.ts` & `app/api/payments/dlocal/create/route.ts` (dLocal payment creation dedupe guard)
  - `app/api/admin/affiliates/[id]/distribute-codes/route.ts` (Code distribution dedupe guard)
  - `money-service/src/outbox/outbox.service.ts` [NEW]
  - `money-service/src/outbox/outbox-publisher.cron.ts` [NEW]
  - `money-service/prisma/schema.prisma` (`OutboxEvent` model)
- **Governing decisions:**
  - **F14 (RESOLVED, 4A-8):** Transactional Outbox pattern for tier-update and billing state changes from `money-service` to `operation-service`.
  - **Audit Matrix Alignment:** Fix Stripe/dLocal write paths identified in 4A-W4 audit without mutating existing API contracts. (`POST /api/subscription/cancel` is skipped — audited in 4A-W4 as idempotent by construction).

---

## Entry criteria

_(verified at CONFIRM time, not assumed — `EXECUTOR-PROTOCOL.md` §1.3)_

- [x] `money-service` test suite green (372/372 tests passing).
- [x] `git status` clean / all predecessor commits pushed to `origin/main`.
- [x] `DECISION-LOG.md` F14 reviewed and ready for implementation.
- [x] Davin present for session authorization.

---

## Integration points

- **In:** Stripe checkout / subscription webhooks and dLocal payment requests.
- **Out:** `OutboxEvent` table publishing reliable tier-update events to `operation-service`.
- **Owns:** Idempotency interceptor, Transactional Outbox publisher, Stripe/dLocal write-path idempotency.

---

## Ordered Steps

### Step 1 — Reusable Idempotency Interceptor (money-service) & Monolith Write Path Hardening

- Implement `IdempotencyInterceptor` in `money-service/src/common/idempotency/idempotency.interceptor.ts` with 24h TTL cache (`Idempotency-Key` header).
- In monolith write paths audited in 4A-W4:
  - Wire Stripe SDK `idempotencyKey` option into `lib/stripe/stripe.ts` (`createCheckoutSession()`) used by `app/api/checkout/route.ts`.
  - Add dedupe guard to `app/api/payments/dlocal/create/route.ts` / `lib/dlocal/dlocal-payment.service.ts`.
  - Add dedupe guard to `app/api/admin/affiliates/[id]/distribute-codes/route.ts`.
- Note: `POST /api/subscription/cancel` is skipped per 4A-W4 audit (idempotent by construction).
- **Verification:** Unit tests verifying duplicate requests return cached response without duplicate side effects or duplicate DB writes.

### Step 2 — Resolve F14: Implement Transactional Outbox Pattern (`OutboxEvent`)

- Add `OutboxEvent` model to `money-service/prisma/schema.prisma` (`id`, `aggregateType`, `aggregateId`, `eventType`, `payload`, `status`, `createdAt`, `processedAt`).
- Implement `OutboxService` in `money-service/src/outbox/outbox.service.ts` wrapping payment tier updates and billing status changes in a Prisma transaction that writes domain state and `OutboxEvent` atomically.
- **Verification:** `npx prisma validate` + transaction unit tests asserting atomic write.

### Step 3 — Build Outbox Publisher Cron & Inter-Service Delivery

- Build `OutboxPublisherCron` (`outbox-publisher.cron.ts`) to poll unprocessed `OutboxEvent` rows every 5 seconds.
- Deliver events to `operation-service` via HTTP client with exponential backoff retries and dead-letter handling.
- **Verification:** Cron unit tests verifying at-least-once delivery and error recovery.

### Step 4 — Verify Rate Limits (`@Throttle`) & Webhook Deduplication (CC-C / CC-D Compliance)

- Verify `@Throttle()` rate limit guards on all public endpoints across `money-service`.
- Confirm deterministic job IDs (`wise:event:<deliveryId>`, `wise:transfer:<customerTransactionId>`) and deduplication on all BullMQ background processors.
- **Verification:** Execute full `money-service` test suite + rate-limiting specs.

---

## Done when

- [ ] Reusable NestJS `IdempotencyInterceptor` built and monolith Stripe/dLocal write endpoints hardened.
- [ ] Transactional Outbox (`OutboxEvent`) implemented and unit tested for F14.
- [ ] `OutboxPublisherCron` delivering events with retry/backoff to `operation-service`.
- [ ] Rate limits (`@Throttle`) verified on all public controllers.
- [ ] Full `money-service` test suite 100% green.
- [ ] `DECISION-LOG.md` F14 marked `RESOLVED`.
- [ ] `CLAUDE.md` and `migration-cutover-table.md` updated.

---

## Next-session handoff

PRE-DRAFT Session 4A-9 (Slice 4 Write APIs Cutover) upon 4A-8 closeout.
