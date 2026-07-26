# Migration Order — CONTRACT variant (+ small INFRA edits)

> For sessions that **research, specify, audit or gap-analyse**, with a small amount of
> narrowly-scoped code. Read `00-SKELETON-AND-RULES.md` first — §4 applies with the dial at
> **Medium** for the audit, **Low** for the two INFRA fixes (single-line, well-understood
> changes to already-live code).

**Session:** 4A-W4 · **Variant:** CONTRACT + small INFRA · **Status:** CONFIRMED
**Generated:** 2026-07-26 (Advisor) · **Estimated time:** ~2–3h
**Phase / plan section:** Phase 4A — money-service · Part 19.5 (RiseWorks → Wise), session 4 of 9 (rev 2 — inserted per Davin's sequencing call; closes the plan §13 money gate before any Wise session writes money state)
**Flags touched:** None resolved this session; **F43** (funding-SLA alert delivery channel) registered `OPEN`, owner Davin, due 4A-W6
**Target service:** money-service (`src/main.ts`, `src/app.module.ts`, `src/dlocal/dlocal-webhook.controller.ts`) — no Wise-specific code
**Contract:** Plan §13 (CC-C idempotency & CC-D rate limits) + `07-migration-process-change-proposal.md` P1/P2/P3
**Seeded from:** `docs/migration-orders/replace-rise-with-wise/04-rise-to-wise-migration-plan.md` §3.1–3.2, §4 "4A-W4", and §13

---

## Why this session, why now

Both W3 sessions are closed (4A-W3a backend, 4A-W3b frontend, both executed 2026-07-26). Before 4A-W5 gives `money-service` its **first BullMQ consumer** and 4A-W6 writes the **first real money state** (`Commission → PAID`), the plan's own CC-C (idempotency) / CC-D (rate limiting) money gate needs to close — otherwise the first thing that can go wrong about money ships with the gate still open.

Two pre-existing live defects on **already-cut-over** code were identified and are folded into this session:

1. **Graceful shutdown is absent** — `money-service/src/main.ts` (51 lines) never calls `app.enableShutdownHooks()`, so `PrismaService.onModuleDestroy()` has never fired on a Railway redeploy. In-flight database queries or webhook requests are abruptly severed on redeploys.
2. **The live dLocal webhook has no explicit rate limit** — `money-service/src/dlocal/dlocal-webhook.controller.ts` (415 lines) inherits the app-wide `ThrottlerGuard` default (`{ ttl: 60000, limit: 100 }`) with no per-route override, so a legitimate dLocal webhook retry burst can be 429'd and read by dLocal as a permanent delivery failure.

---

## Strict Scope Discipline

- **AUDIT ONLY for Stripe/dLocal write paths**: This session audits idempotency keys across all existing money write endpoints and produces a clean audit matrix. It does **NOT** add or fix idempotency keys on Stripe/dLocal write paths — that stays **4A-8's** job, along with F14/outbox.
- **FIX 2 LIVE DEFECTS ONLY**: This session touches code ONLY to add `app.enableShutdownHooks()` in `main.ts` and `@Throttle()` on `dlocal-webhook.controller.ts`.
- **DAVIN PRESENT GATE**: Touching the live `/v1/webhooks/dlocal` route modifies already-cut-over money code. `EXECUTOR-PROTOCOL.md` §7 requires Davin present with explicit approval before Step 4 starts.

---

## Entry criteria

_(verified at CONFIRM time, not assumed — `EXECUTOR-PROTOCOL.md` §1.3)_

- [ ] **4A-W3a and 4A-W3b both closed CONFIRMED** (both executed 2026-07-26).
- [ ] **Davin available** and explicitly approves touching the live `/v1/webhooks/dlocal` route before Step 4 starts (`EXECUTOR-PROTOCOL.md` §7).
- [ ] Read plan §13 (CC-C / CC-D) in full before starting — it, not this order text, is the standard being applied.
- [ ] Codebase line counts verified against live tree before Step 1:
      `money-service/src/main.ts` (51 lines),
      `money-service/src/app.module.ts` (81 lines),
      `money-service/src/dlocal/dlocal-webhook.controller.ts` (415 lines).
- [ ] Re-verify live: `money-service/src/main.ts` still lacks `enableShutdownHooks()`, and `/v1/webhooks/dlocal` still lacks a route-level `@Throttle()` override.

**A failed entry criterion means do not start** — propose the fix or the session swap.

---

## Integration points

- **In:** Live dLocal webhooks → `/v1/webhooks/dlocal` (`dlocal-webhook.controller.ts`)
- **Out:** Railway process signals (SIGTERM / SIGINT) → NestJS application lifecycle
- **Owns:** Money-service process bootstrap & rate-limiting policies

---

## Ordered steps

### 1. Money Write Endpoint Idempotency Audit (CONTRACT — AUDIT ONLY)

Audit every existing money write endpoint in the repository against CC-C standards.
Endpoints to audit:

1. Stripe Checkout session creation (`POST /api/stripe/checkout`)
2. Subscription cancellation (`POST /api/subscriptions/cancel`)
3. Invoice retrieval/generation (`GET/POST /api/invoices/*`)
4. dLocal payment creation (`POST /v1/dlocal/payments` or equivalent)
5. Access code distribution (`POST /api/codes/distribute` or equivalent)
6. Payment batch execution (`POST /v1/batches/[batchId]/execute` or equivalent)

Produce an audit table in this order file's Deviations section with columns:
`| Endpoint | Path | Has Idempotency Key? | Key Location / Header | Mechanism | Audit Verdict |`

_Scope Rule:_ Record verdicts (`has key` / `no key` / `n/a`) — **no "TBD" rows**. Do **NOT** add or fix idempotency keys on Stripe/dLocal write paths in this session; that remains 4A-8's job.

### 2. Webhook Dedupe Audit & Verification (CONTRACT)

Audit webhook dedupe mechanisms against Plan §13 standard (where `RiseWorksWebhookEvent` is template):

- Check dLocal webhook dedupe in `money-service/src/dlocal/dlocal-webhook.controller.ts` — verify whether `DlocalWebhookEvent` (or equivalent) deduplicates on webhook ID / signature.
- Check Stripe webhook dedupe in monolith `app/api/webhooks/stripe/route.ts`.
- Record live status in the audit table.

_Verification:_ Cite exact code line numbers and database table definitions that perform deduplication for live money webhooks.

### 3. Graceful Shutdown Fix (INFRA — Defect 1)

In `money-service/src/main.ts` (51 lines):

- Add `app.enableShutdownHooks()` before `await app.listen(...)`.
- Add a shutdown listener test/logging verification to prove `PrismaService.onModuleDestroy()` and Redis providers disconnect cleanly on `SIGTERM`.
- Document the BullMQ worker connection drain policy that Session 4A-W5's queue will inherit (`worker.close()` on shutdown).

_Verify:_ Run `money-service` build (`npm run build`); send synthetic SIGTERM in test/local context and observe `PrismaService` cleanup log line.
_Rollback:_ Remove `app.enableShutdownHooks()`; redeploy.

### 4. Live Webhook Throttling Fix (INFRA — Defect 2 — Davin Present per §7)

In `money-service/src/dlocal/dlocal-webhook.controller.ts` (415 lines):

- Add `@Throttle({ default: { ttl: 60_000, limit: 300 } })` decorator to the `handleWebhook` method (or controller level).
- This replaces the tight global default (`limit: 100`) with a generous route-level limit (`limit: 300` per 60s window) suitable for provider webhook retry bursts.
- Document this as the standing rate-limit policy for all payment provider webhooks (Stripe, dLocal, Wise).

_Verify:_ Replay a recorded signed dLocal webhook payload **before and after** applying the `@Throttle()` decorator to prove zero regression on live money traffic.
_Rollback:_ Remove the `@Throttle()` decorator from `dlocal-webhook.controller.ts`; redeploy.

### 5. BullMQ Job-ID Derivation Policy (CONTRACT — POLICY)

Define the explicit BullMQ job-ID derivation policy before 4A-W5 creates the first queue (`op.wise.webhooks`):

- Policy: `jobId` MUST be derived deterministically from business event keys.
  - Webhook processing jobs: `jobId = wise:event:<deliveryId>` (using `X-Delivery-Id` header).
  - Transfer execution jobs: `jobId = wise:transfer:<customerTransactionId>`.
- Deterministic job IDs ensure BullMQ automatically deduplicates repeated enqueues at the Redis queue level (CC-C idempotency).

_Verify:_ Document policy in `01-part-19.5-wise-disbursement-architecture-design.md` §8 and this order's Deviations so 4A-W5 inherits it ready-made.

### 6. Register Flag F43 in DECISION-LOG.md (CONTRACT)

Register **F43** (Funding-SLA alert delivery channel — money-service has no email capability) in `DECISION-LOG.md`:

- Status: `OPEN`
- Owner: Davin
- Due Session: `4A-W6`
- Context: When a Wise batch group remains unfunded near the 14-day Wise expiration window, how should the alert be delivered (Slack webhook, Discord webhook, or monolith email proxy)?

### 7. Suite Verification, Artefact Updates, PRE-DRAFT 4A-W5

- Run `npm run test` in `money-service` (all unit/integration tests green).
- Run monolith `npx tsc --noEmit` (clean).
- Update `CLAUDE.md`, `DECISION-LOG.md` (F43), `migration-stack-analysis.md`.
- PRE-DRAFT Session `4A-W5` (`4a-w5-wise-webhook-reducer.migration-order.md`).

---

## Rules specific to this variant

- **Ground truth priority**: Live code > live runtime state > recent docs > old build-orders.
- **Audit vs Fix Scope Boundary**: Audit ONLY for Stripe/dLocal write paths (idempotency fix stays 4A-8's). Fix ONLY the 2 live defects (shutdown hooks & dLocal webhook throttling).
- **Step 4 Davin Gate**: Davin MUST be present and explicitly approve before Step 4 touches `dlocal-webhook.controller.ts`.

---

## Done when

- [x] Idempotency audit matrix committed in order Deviations (one row per money write endpoint, no "TBD" verdicts).
- [x] dLocal webhook dedupe mechanism evidenced with exact code line citations.
- [x] `app.enableShutdownHooks()` added to `money-service/src/main.ts`; `PrismaService.onModuleDestroy` observed firing.
- [x] Explicit `@Throttle({ default: { ttl: 60_000, limit: 300 } })` added to `dlocal-webhook.controller.ts`; replayed dLocal webhook payload processes identically before and after.
- [ ] BullMQ job-ID policy (`jobId = wise:event:<deliveryId>`) documented in design §8 and order Deviations.
- [ ] Flag **F43** registered OPEN in `DECISION-LOG.md` (owner Davin, due 4A-W6).
- [ ] Full `money-service` test suite green; monolith `tsc --noEmit` clean.
- [ ] `CLAUDE.md`, `DECISION-LOG.md`, `migration-stack-analysis.md` updated.
- [ ] `4a-w5-wise-webhook-reducer.migration-order.md` exists at status `PRE-DRAFT`.

---

## Rollback

Both code edits (`enableShutdownHooks` and `@Throttle`) are single-line changes — git revert + redeploy. No database schema changes, no money moved, no provider dashboard changes.

---

## Deviations

_(filled DURING execution — what / why / impact.)_

### Idempotency Audit Matrix (Step 1)

| Endpoint                         | Path                                                                                                              | Has Idempotency Key? | Key Location / Header                                                                                                                                             | Mechanism                                                                                                                                                                                                                                                                                                                                                                   | Audit Verdict                                             |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Stripe Checkout session creation | `POST /api/checkout` (`app/api/checkout/route.ts:40`)                                                             | No                   | —                                                                                                                                                                 | None. `createCheckoutSession()` (`lib/stripe/stripe.ts`) never passes an `idempotencyKey` request option to Stripe's SDK; a double form-submit creates two separate Checkout Sessions (low-risk — only one gets paid, but not clean).                                                                                                                                       | no key                                                    |
| Subscription cancellation        | `POST /api/subscription/cancel` (`app/api/subscription/cancel/route.ts:44`)                                       | No (not needed)      | —                                                                                                                                                                 | Naturally idempotent without a key: re-running sets `tier: 'FREE'` / `status: 'CANCELED'` again (no-op on repeat), and the Stripe cancel call is wrapped in try/catch so a second call's Stripe-side 400 ("already canceled") doesn't block the local write.                                                                                                                | n/a — idempotent by construction                          |
| Invoice retrieval/generation     | `GET /api/invoices` (`app/api/invoices/route.ts:71`)                                                              | n/a                  | —                                                                                                                                                                 | Read-only. No `POST`/write handler exists anywhere under `app/api/invoices/*` — the order's own `GET/POST` framing was cautious, live tree confirms GET-only.                                                                                                                                                                                                               | n/a — not a write endpoint                                |
| dLocal payment creation          | `POST /api/payments/dlocal/create` (`app/api/payments/dlocal/create/route.ts:43`)                                 | No                   | —                                                                                                                                                                 | No idempotency key sent to dLocal's `createPayment()` (`lib/dlocal/dlocal-payment.service.ts`), and the local `Payment` row is a plain `.create()` (line 180) with no dedupe guard — a double-submit creates two `Payment` rows and two dLocal payment attempts.                                                                                                            | no key                                                    |
| Access code distribution         | `POST /api/admin/affiliates/[id]/distribute-codes` (`app/api/admin/affiliates/[id]/distribute-codes/route.ts:53`) | No                   | —                                                                                                                                                                 | `distributeCodesAdmin()` (`lib/admin/code-distribution.ts:44`) takes no idempotency key; a retried request distributes another `count` codes with no duplicate-detection. Admin-only (`requireAdmin()`), lower blast radius than a customer-facing endpoint, but still a genuine gap.                                                                                       | no key                                                    |
| Payment batch execution          | `POST /api/disbursement/batches/[batchId]/execute` (`app/api/disbursement/batches/[batchId]/execute/route.ts:37`) | Yes (indirect)       | `PaymentBatch.status` state machine, `DisbursementTransaction.commissionId`/`.transactionId` (both `@unique`, `prisma/non-market-data/schema.prisma:744,789,793`) | `executeBatch()` (`lib/disbursement/services/payment-orchestrator.ts:55,62`) rejects with 400 once `batch.status` has moved past `PENDING`/`QUEUED`, and each transaction is keyed to a `@unique commissionId` — a retry can't create a second `DisbursementTransaction` for the same commission. Not a request-level idempotency-key header, but a real DB-enforced guard. | has key (state-machine + unique constraint, not a header) |

### Webhook Dedupe Audit (Step 2)

- **dLocal** (`money-service/src/dlocal/dlocal-webhook.controller.ts`): **no dedicated dedupe table** — grepped both Prisma schemas, no `DlocalWebhookEvent` model exists anywhere. Dedup is achieved entirely via business-state gating: `alreadyCompleted = payment.status === 'COMPLETED'` (line 173) skips the one-time side effects (3-day-plan mark, affiliate conversion, "Welcome to PRO!" notification — lines 266-330) on replay. The core `Payment`/`Subscription`/`User` writes (lines 197-264) are unconditional idempotent upserts, safe to repeat regardless. This is the same fix landed at Session 4A-5 (`1cc31b24`) for the notification-duplication bug.
- **Stripe** (`app/api/webhooks/stripe/route.ts` + `lib/stripe/webhook-handlers.ts`): same shape as dLocal — **no event-ID dedupe table**, Stripe's own `event.id` is never persisted or checked anywhere. `handleCheckoutCompleted`'s subscription write is a `prisma.subscription.upsert()` (line 99, idempotent by `userId`); the affiliate-commission side effect (`processAffiliateCommission`, line 493) is gated by `affiliateCode.status !== 'ACTIVE'` (line 511) — once the code flips to `USED` (line 539) a webhook retry finds it inactive and skips creating a second `Commission` row. No double-commission bug found on inspection.
- **Plan §13's own "template" doesn't hold up under inspection**: `RiseWorksWebhookEvent` (`prisma/non-market-data/schema.prisma:837-867`, mirrored `money-service/prisma/schema.prisma:550-568`) is cited by Plan §13 as the dedupe template, but its `hash`/`signature` fields carry **no unique constraint** — only non-unique `@@index([transactionId|eventType|processed|receivedAt])`. RiseWorks's actual dedup (`lib/disbursement/webhook/event-processor.ts:100`) is the same business-state-check shape as dLocal/Stripe (`transaction.status === 'COMPLETED'` short-circuits), not a lookup against `RiseWorksWebhookEvent` by hash. The one model in either schema with a real DB-enforced dedupe key is `WiseWebhookEvent.deliveryId String @unique` (`prisma/non-market-data/schema.prisma:1053`) — built at 4A-W2, not yet wired to a live webhook receiver (that's 4A-W5's job). Worth 4A-W5 inheriting `WiseWebhookEvent`'s `@unique` pattern rather than `RiseWorksWebhookEvent`'s, since the latter's own field never actually enforced dedup.

**Audit conclusion:** every live money webhook (dLocal, Stripe, RiseWorks) dedupes via downstream business-state checks (a status field that only transitions once), not via a webhook-delivery-ID table. This has worked so far with zero known duplicate-processing incidents, but it is a weaker guarantee than `WiseWebhookEvent`'s unique-key design — the business-state check only protects the specific side effects the code author remembered to gate (as the L-series 4A-5 notification bug proved once already). No fix applied here — this is an audit-only step; flagging the pattern gap for whoever owns 4A-8's outbox/idempotency work and confirming 4A-W5 should use `WiseWebhookEvent`'s stronger design for the new Wise receiver.

### Graceful Shutdown Fix (Step 3)

- Added `app.enableShutdownHooks()` to `money-service/src/main.ts` (before `app.listen()`), with a comment documenting the drain policy 4A-W5's BullMQ worker must follow (below).
- Added an observable log line to `PrismaService.onModuleDestroy()` (`money-service/src/prisma/prisma.service.ts`) — previously silent, so the fix would have been unverifiable even once wired up.
- **Verification (new test, not just reasoning):** `money-service/src/prisma/prisma.shutdown.spec.ts` boots a real `NestApplication` containing `PrismaService` (with only `$connect`/`$disconnect` stubbed — no live DB touched), calls the real `app.enableShutdownHooks()`, and delivers a synthetic in-process `SIGTERM` (`process.emit`, not a real OS signal — safe under Jest, and confirmed _not_ safe to skip this stubbing: an unstubbed first run genuinely killed the Jest worker mid-test, because Nest's `listenToShutdownSignals()` re-sends the OS signal via `process.kill(process.pid, signal)` after cleanup finishes — confirmed by reading `node_modules/@nestjs/core/nest-application-context.js:214-220`). Stubbed `process.kill`/`process.exit` to observe the hook without dying; test asserts `$disconnect` was called, the new log line fired, and `process.kill` was actually invoked with `(pid, 'SIGTERM')` — proving Nest's real end-to-end shutdown path ran, not a hand-called `onModuleDestroy()`.
- `npm run build` clean; full `money-service` suite 28/28 suites, 286/286 tests (was 27/285 at 4A-W3a's close — +1 suite/+1 test, this new spec).
- **BullMQ worker drain policy for 4A-W5** (documented per Step 3's own ask, so the next session inherits it ready-made): any `@Processor()` class 4A-W5 registers must implement `onModuleDestroy()` (or `onApplicationShutdown()`) calling `await this.worker.close()` — BullMQ's own `Worker.close()` waits for the currently-processing job to finish before returning, so it composes correctly with `enableShutdownHooks()`'s `await this.callDestroyHook()` step (all providers' destroy hooks are awaited in sequence before the process exits). No queue consumer exists yet in `app.module.ts` (confirmed: only `BullModule.forRoot`, no `registerQueue()`/`@Processor()` — this order's own Entry Criteria claim, re-verified), so this is a policy for 4A-W5 to follow, not code to write now.

### Live Webhook Throttling Fix (Step 4 — Davin present, live approval given)

- Added `@Throttle({ default: { ttl: 60_000, limit: 300 } })` to `DlocalWebhookController.handleWebhook` (`money-service/src/dlocal/dlocal-webhook.controller.ts`), with a comment recording this as the standing rate-limit policy for all payment-provider webhooks (Stripe, dLocal, Wise) — explicit route-level `@Throttle()`, never the bare global default.
- **Regression proof, existing behavioral suite:** re-ran `dlocal-webhook.controller.spec.ts` (12 tests covering signature rejection, malformed JSON, payment-not-found, MONTHLY/THREE_DAY completion, affiliate conversion + its failure path, FAILED/CANCELLED statuses, and the two replay-idempotency tests) unchanged after the edit — 12/12 pass identically, as expected since `@Throttle()` is metadata-only and never touches the handler body.
- **Regression + effect proof, new test:** `money-service/src/dlocal/dlocal-webhook.throttle.spec.ts` boots a real `NestApplication` with the real `ThrottlerGuard` as `APP_GUARD` and the same global default as production (`app.module.ts`'s `{ ttl: 60000, limit: 100 }`), then sends a 150-request sequential burst of a signed dLocal payload through `/webhooks/dlocal` — **zero 429s, all 150 return 200** (the payment-not-found fast path, signature mocked true). A control test in the same file — an undecorated sibling route on the identical global default — confirms the 150-burst genuinely _does_ 429 past 100 in this test environment, proving the "zero 429s" result on the dLocal route isn't just throttling being silently inert. (First attempt used `Promise.all` for concurrency and hit spurious `ECONNRESET` from the ephemeral test server's socket pool, unrelated to throttling — switched to a sequential loop, which is also the more faithful model of how dLocal's own retry bursts actually arrive.)
- Did **not** replay an actual recorded production signature (no real `DLOCAL_WEBHOOK_SECRET` value was available or appropriate to bring into this session, L17) — `verifyWebhookSignature` is mocked exactly as the existing `dlocal-webhook.controller.spec.ts` already does, isolating the throttling behavior from signature verification, which is separately and already covered.
- `npm run build` clean; full `money-service` suite 29/29 suites, 288/288 tests (was 28/286 after Step 3 — +1 suite/+2 tests, this new spec).

---

## Known wrinkles / do-not-touch

- **`lib/api/index.ts`** — known-broken by design until Phase 7. Do not touch.
- **RiseWorks source, schema, and rows** — Archived (F42), never deleted, never renamed.
- **Stripe / dLocal write path fixes stay 4A-8's** — do NOT add idempotency keys to Stripe/dLocal write paths in this session.
- **Step 4 touches live money code** — Davin must be present for Step 4 (`EXECUTOR-PROTOCOL.md` §7).

---

## Next-session handoff

_(PRE-DRAFT `4a-w5-wise-webhook-reducer.migration-order.md` at this session's close — variant `PORT`, seeded from `04-rise-to-wise-migration-plan.md` §4 "4A-W5":_

- _Builds the Wise webhook receiver (`/v1/webhooks/wise`) + state reducer in `money-service`._
- _Verified via REPLAY with recorded signed payloads from Wise sandbox Simulation API._
- _Deduplicates on `X-Delivery-Id`, orders on `data.occurred_at`._
- _Resolves **F40** (webhook subscription level: profile vs application)._
- _Inherits 4A-W4's BullMQ job-ID policy (`jobId = wise:event:<deliveryId>`) and `@Throttle()` rate limit standard.)_
