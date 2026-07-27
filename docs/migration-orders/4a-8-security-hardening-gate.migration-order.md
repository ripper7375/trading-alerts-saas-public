# Migration Order — Standard Loop variant (B)

> Read `00-SKELETON-AND-RULES.md` first — standard loop rules apply. This session is the **CC-C hardening gate**
> for non-Wise money surfaces (Stripe/dLocal write paths + F14 Outbox pattern) before Slice 4 (Write APIs cutover).

**Session:** 4A-8 · **Variant:** Standard Loop (B) · **Status:** DRAFT
**Generated:** 2026-07-27 (Advisor) · **Estimated time:** ~2–3h
**Phase / plan section:** Phase 4A — money-service · Slice 4 Gate (Security & Idempotency Hardening)
**Ground truth:** `04-rise-to-wise-migration-plan.md` §4 "4A-8", `4a-w4-wise-hardening-gate.migration-order.md` (Audit findings), `DECISION-LOG.md` (F14).
**Contract:** Implement Stripe/dLocal write-path idempotency keys, resolve F14 (Transactional Outbox for tier updates), and verify CC-C/CC-D hardening compliance.

---

## Why this session, why now

Session 4A-W4 performed the audit of all money write endpoints and wired CC-C hardening for the Wise payout surface.
Session 4A-8 is the explicit **Slice 4 Hardening Gate**: it completes idempotency key handling on all remaining Stripe and dLocal write paths, resolves **F14** (Transactional Outbox pattern for inter-service communication), and verifies rate limits (`@Throttle`) and webhook deduplication across the entire `money-service`.

Completing 4A-8 is required before Slice 4 (Write APIs cutover) can proceed.

---

## Scope Discipline & Grounded Line Counts

- **Files touched / created:**
  - `money-service/src/common/idempotency/idempotency.interceptor.ts` (or equivalent middleware)
  - `money-service/src/stripe/stripe-checkout.controller.ts`
  - `money-service/src/dlocal/dlocal-payment.controller.ts`
  - `money-service/src/outbox/outbox.service.ts` [NEW]
  - `money-service/src/outbox/outbox-publisher.cron.ts` [NEW]
  - `money-service/prisma/schema.prisma` (OutboxEvent model)
- **Governing decisions:**
  - **F14 (RESOLVED, 4A-8):** Transactional Outbox pattern for tier-update and billing state changes from `money-service` to `operation-service`.
  - **Audit Matrix Alignment:** Fix Stripe/dLocal write paths identified in 4A-W4 audit without mutating existing API contracts.

---

## Entry criteria

_(verified at CONFIRM time, not assumed — `EXECUTOR-PROTOCOL.md` §1.3)_

- [ ] `money-service` test suite green (372/372 tests passing).
- [ ] `git status` clean / all predecessor commits pushed to `origin/main`.
- [ ] `DECISION-LOG.md` F14 reviewed and ready for implementation.
- [ ] Davin present for session authorization.

---

## Integration points

- **In:** Stripe checkout / subscription webhooks and dLocal payment requests.
- **Out:** `OutboxEvent` table publishing reliable tier-update events to `operation-service`.
- **Owns:** Idempotency interceptor, Transactional Outbox publisher, Stripe/dLocal write-path idempotency.

---

## Ordered Steps

### Step 1 — Idempotency Key Middleware / Interceptor on Stripe & dLocal Write Endpoints

- Implement/wire `IdempotencyInterceptor` for `POST /v1/stripe/checkout`, `POST /v1/stripe/subscriptions/cancel`, and `POST /v1/payments/dlocal`.
- Store idempotency keys with standard TTL (24h) and return cached responses on duplicate requests.
- **Verification:** Unit tests verifying duplicate header calls return cached response without duplicate side effects.

### Step 2 — Resolve F14: Implement Transactional Outbox Pattern (`OutboxEvent`)

- Add `OutboxEvent` model to `money-service/prisma/schema.prisma` (`id`, `aggregateType`, `aggregateId`, `eventType`, `payload`, `status`, `createdAt`, `processedAt`).
- Wrap payment tier updates and billing status changes in a Prisma transaction that writes both domain state and `OutboxEvent` atomically.
- **Verification:** `npx prisma validate` + transaction unit tests asserting atomic write.

### Step 3 — Build Outbox Publisher Cron & Inter-Service Delivery

- Build `OutboxPublisherCron` (`outbox-publisher.cron.ts`) to poll unprocessed `OutboxEvent` rows every 5 seconds.
- Publish events to `operation-service` with exponential backoff retries and dead-letter handling.
- **Verification:** Cron unit tests verifying at-least-once delivery and error recovery.

### Step 4 — Verify Rate Limits (`@Throttle`) & Webhook Deduplication (CC-C / CC-D Compliance)

- Verify `@Throttle()` rate limit guards on all public endpoints.
- Confirm deterministic job IDs and deduplication on all BullMQ background processors.
- **Verification:** Execute full `money-service` test suite + rate-limiting specs.

---

## Done when

- [ ] All Stripe and dLocal write endpoints enforce idempotency keys.
- [ ] Transactional Outbox (`OutboxEvent`) implemented and unit tested for F14.
- [ ] `OutboxPublisherCron` delivering events with retry/backoff.
- [ ] Rate limits (`@Throttle`) verified on all public controllers.
- [ ] Full `money-service` test suite 100% green.
- [ ] `DECISION-LOG.md` F14 marked `RESOLVED`.
- [ ] `CLAUDE.md` and `migration-cutover-table.md` updated.

---

## Next-session handoff

PRE-DRAFT Session 4A-9 (Slice 4 Write APIs Cutover) upon 4A-8 closeout.
