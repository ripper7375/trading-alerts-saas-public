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

- [x] Reusable NestJS `IdempotencyInterceptor` built and monolith Stripe/dLocal write endpoints hardened.
- [x] Transactional Outbox (`OutboxEvent`) implemented and unit tested for F14.
- [x] `OutboxPublisherCron` delivering events with retry/backoff — **gated OFF by default** (Davin's call, see Deviations; real delivery to `operation-service` is Slice 5 / 4A-11-12's job, not this session's).
- [x] Rate limits (`@Throttle`) verified on all public controllers.
- [x] Full `money-service` test suite 100% green (49/49 suites, 400/400 tests).
- [x] `DECISION-LOG.md` F14 marked `RESOLVED`.
- [x] `CLAUDE.md` and `migration-cutover-table.md` updated.

---

## Deviations

_(recorded as made, per `EXECUTOR-PROTOCOL.md` §2 — not reconstructed from memory at close)_

1. **Step 1 re-scoped before execution (ground-truth mismatch, CONFIRM-time):** the original DRAFT's Step 1 targeted `money-service/src/stripe/stripe-checkout.controller.ts` and `money-service/src/dlocal/dlocal-payment.controller.ts` — neither exists. `migration-cutover-table.md`'s own Slice 4 row confirms Stripe checkout / dLocal create / admin code-dist / batch-execute all stay on **monolith** Next.js routes until 4A-9; money-service has no write endpoints of its own yet. Davin + Advisor re-scoped Step 1 live (before CONFIRM) to hit the real files (`app/api/checkout/route.ts`, `app/api/payments/dlocal/create/route.ts`, `app/api/admin/affiliates/[id]/distribute-codes/route.ts`), matching 4A-W4's own audit citations, and to build the NestJS interceptor as forward-looking infrastructure for 4A-9 rather than attaching it to anything live now. `POST /api/subscription/cancel` correctly excluded (4A-W4: idempotent by construction).
2. **A second, new-to-this-session ground-truth gap found mid-Step-1:** `app/api/payments/dlocal/create/route.ts` created its `Payment` row with `providerPaymentId: ''` — but that column is `@unique` **across the whole table**, not per-user, so a bare `''` risked a genuine cross-user collision (a second user's concurrent pending payment would fail to insert). Fixed as part of the same line touched for the idempotency guard (random UUID placeholder instead of `''`) rather than left as a drive-by-adjacent bug; not a scope violation since it's the exact line Step 1 required editing anyway.
3. **F14's own field list implied `money-service/prisma/schema.prisma` was the only schema to touch — it wasn't.** `OutboxEvent` is a genuinely new money-service-owned table (no FK to anything), so per L1 (money-service has no migration authority of its own), it needed the SAME two-schema treatment as 4A-W2's Wise models: mirrored into `prisma/non-market-data/schema.prisma`, a zero-DB-connection `prisma migrate diff --script` generated and committed, then applied to production via `prisma migrate deploy` — none of which the order's own Files-touched list mentioned. Escalated to Davin before touching production (EXECUTOR-PROTOCOL §7); he approved applying it live. Also repeated 4A-W2's own Step 6 (grant check): `money_svc` had zero grants on the new table immediately after the migration — granted `SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER, TRUNCATE`, verified via a real INSERT/SELECT/UPDATE/DELETE cycle as `money_svc` (rolled back, zero residue), same method as 4A-W2.
4. **Step 3's own literal delivery target ("to `operation-service`") doesn't exist.** operation-service has no tier/billing module or endpoint at all (auth/email/security/2FA only), and `04-rise-to-wise-migration-plan.md`'s own roadmap assigns the real consumer side ("Slice 5, tier-update event path") to a later, separate session pair (**4A-11/12**), not 4A-8. Escalated to Davin rather than either scope-creeping into building that endpoint or shipping a cron that fails every 5s tick forever in production. His call: build the full polling/claim/retry/dead-letter mechanics now (unit-tested against a mocked HTTP target), gated OFF by default via `OUTBOX_PUBLISHER_ENABLED` (unset/not `'true'` → the scheduled tick no-ops) — same "build now, cut over later" shape as every other piece of infra this migration has built ahead of its own cutover session. `publishPendingEvents()` itself is ungated, ready for 4A-11/12 (or a manual trigger) to call once `OUTBOX_PUBLISHER_TARGET_URL` is configured.
5. **`crons/subscription.service.ts`'s `downgradeExpiredSubscriptions()` was not previously transactional** (`user.update` + `subscription.update` + `notification.create` ran as 3 separate calls, unlike `dlocal-webhook.controller.ts`'s already-transactional tier-upgrade path). Wrapping it in `$transaction` for the atomic outbox write was necessary for F14 to actually hold on this call site, not optional — recorded here since it changes this file's prior "byte-identical to 4A-2's ported source" invariant (documented in that file's own header comment), a deliberate, in-scope behavior change for this session, not drift.
6. **Step 4 audit found one real gap beyond what verification alone would have caught:** `RiseworksWebhookController` had no route-level `@Throttle()` override, unlike dLocal's and Wise's webhook controllers — the same 429-storm-on-legitimate-retry-burst risk 4A-W4 fixed for dLocal, which explicitly established "all future payment-provider webhooks get an explicit override" as standing policy. Fixed to match (`ttl: 60_000, limit: 300`). Zero live-traffic risk (RiseWorks route is archived/dormant per F42, dashboard still points at the monolith). All other controllers' reliance on the bare global default (100/60s) is correct as-is — that policy is scoped to payment-provider webhooks, not general dashboard/admin API traffic. BullMQ audit: the only producer/consumer pair (`wise-webhook.processor.ts`) already uses a deterministic `jobId` (`wise:event:<deliveryId>`) plus a DB-unique-constraint catch before enqueueing, and its worker already drains on `onModuleDestroy` (L25) — no further gap found.
7. **`prisma:generate` re-run on both monolith schemas** (market-data unaffected, non-market-data picks up `OutboxEvent`) as part of `type-check`, confirming `tsc --noEmit` stays clean with the new model present but unused anywhere in monolith code (money-service is the only reader/writer).

---

## Next-session handoff

PRE-DRAFT Session 4A-9 (Slice 4 Write APIs Cutover) upon 4A-8 closeout — carries forward the now-real `OutboxEvent` table and the gated `OutboxPublisherCron`, plus a new explicit note that Slice 5 (4A-11/12) still needs to define `OUTBOX_PUBLISHER_TARGET_URL`'s real receiving endpoint on operation-service before that cron can ever be turned on.
