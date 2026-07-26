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

- [ ] Idempotency audit matrix committed in order Deviations (one row per money write endpoint, no "TBD" verdicts).
- [ ] dLocal webhook dedupe mechanism evidenced with exact code line citations.
- [ ] `app.enableShutdownHooks()` added to `money-service/src/main.ts`; `PrismaService.onModuleDestroy` observed firing.
- [ ] Explicit `@Throttle({ default: { ttl: 60_000, limit: 300 } })` added to `dlocal-webhook.controller.ts`; replayed dLocal webhook payload processes identically before and after.
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

_(To be populated during Step 1 execution)_

| Endpoint | Path | Has Idempotency Key? | Key Location / Header | Mechanism | Audit Verdict |
| -------- | ---- | -------------------- | --------------------- | --------- | ------------- |

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
