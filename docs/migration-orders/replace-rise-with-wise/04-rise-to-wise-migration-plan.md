# Rise → Wise Migration Plan (sessions 4A-W1 … 4A-W8)

**Status:** PLAN — a roadmap, **not** a set of orders. Only `4a-w1-…migration-order.md` exists as a
DRAFT order. Every later session is PRE-DRAFTed by the Executor at the close of its predecessor
(`00-SKELETON-AND-RULES.md` §1.5 — chain length is exactly one).
**Author:** Advisor · **Date:** 2026-07-25 · **Revised:** 2026-07-25 (rev 2, per
`07-migration-process-change-proposal.md` P1/P4/P6 — session `4A-W4` inserted, W-series renumbered)

---

## 1. Where this sits in the playbook

```
… 4A-6  BUILD slice 3 (read APIs)            ✅ done  2026-07-22
   4A-7  CUTOVER slice 3                     ← DRAFT, unblocked, runs first
 ┌──────────────────────────────────────────────────────────────────┐
 │  4A-W1  Wise contracts & decisions            CONTRACT   ~2–3h   │
 │  4A-W2  Additive schema migration             INFRA+PORT ~2h     │  ← Part 19.5
 │  4A-W3  BUILD recipient onboarding            PORT+UI    ~4h     │     inserted here
 │  4A-W4  CC-C/CC-D hardening (money surface)   CONTRACT+INFRA ~2–3h│    (Davin's call,
 │         ↑ NEW rev 2 — closes the plan §13 money gate             │     2026-07-25)
 │  4A-W5  BUILD Wise webhook + reducer          PORT       ~4h     │
 │  4A-W6  BUILD payout engine + funding gate    PORT       ~4h     │
 │  4A-W7  CUTOVER to Wise  ⚠ REAL MONEY         VERIFY-RETIRE ~1–2h│
 │  4A-W8  Archive RiseWorks + artefacts         VERIFY-RETIRE ~1h  │
 └──────────────────────────────────────────────────────────────────┘
   4A-8  CC-C hardening gate  (unchanged: F14 outbox + Stripe/dLocal write paths)
   4A-9/10  Slice 4 (write APIs + Stripe webhook)  ⚠ REAL MONEY
   4A-11/12 Slice 5 (tier-update event path)
```

**Numbering:** `4A-W*` is a suffix insertion — **no session outside the W series is renumbered**
(`00-SKELETON-AND-RULES.md` §5). `4A-8` keeps its number, its slot and its scope.
Rev 2 renumbered **only within the W series** (old W4→W5, W5→W6, W6→W7, W7→W8) to make room for the
new `4A-W4`; that is legal because no W session has been executed or approved and the sole existing
W artifact (`4a-w1-…`) keeps its number. Renumbering after W3 has run would **not** be legal.
Davin's shorthand "4A-5W" maps to this series.
**Revoked:** `4A-5-RW` (RiseWorks webhook cutover) will never run.

---

## 2. Why this order and not another

| Ordering choice                            | Reason                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contracts before code (W1)                 | Two commercial flags (F36 funding model, F37 region) change the _shape_ of W6. Writing W6's code before they resolve guarantees rework. W1 also catches the two silent killers: Business Payment Approvals, and whether a Wise sandbox account even exists.                                                                               |
| Schema before services (W2)                | Every later session writes to the 5 new tables. Doing the additive migration alone, in its own session, keeps the highest-consequence step (a Prisma migration against the shared production DB) isolated and independently revertable.                                                                                                   |
| Recipients before payouts (W3 → W6)        | Wise cannot create a transfer without a `targetAccount`. No recipients ⇒ nothing to test W6 against. W3 is also the only session with genuinely new UI, so it is the one most likely to overrun — better early than adjacent to the money cutover.                                                                                        |
| **Hardening before money state (W4 → W5)** | **Rev 2.** W5 is where money _state_ is first written (`Commission → PAID`, affiliate balance moved) and where money-service gets its **first BullMQ consumer**. Both are CC-C surface. Closing the gate here closes it before the first thing that can be wrong about money — see §3.                                                    |
| Webhook before payout engine (W5 → W6)     | The webhook reducer is the **only** thing allowed to mark money as paid (§3.4 of the design). Building the payer before the confirmer would mean money in flight with no listener. Also, W5's replay fixtures are what let W6's E2E assert correctly.                                                                                     |
| Funding gate inside W6, not W7             | The human funding gate is _product behaviour_ (an admin screen + an SLA alarm), not a cutover mechanic. Cutover sessions must stay ~10 lines (`TEMPLATE-VERIFY-RETIRE.md`).                                                                                                                                                               |
| Archive after cutover (W8)                 | Deactivating RiseWorks before Wise is proven would leave zero disbursement providers. **Rev 2:** only **A3** (the `DISBURSEMENT_PROVIDER` env flip — which _is_ the cutover mechanism) happens in W7; **A1/A2 are code changes and move to W8**, because `TEMPLATE-VERIFY-RETIRE.md` forbids code in a cutover session at dial near-zero. |

---

## 3. CC-C / CC-D compliance — where the money gate actually closes

> **Rev 2 supersedes this section's earlier framing.** It previously said W5/W6 _"borrow 4A-8's
> requirements"_, which wrongly implied a backwards dependency on a session that hasn't run.
> Corrected below.

**The requirements are not 4A-8's to give.** They are written in the migration plan §13 as
**CC-C** (_"design: Phase 0 · **enforced: throughout Phase 4**"_) and **CC-D** (_"decide: Phase 0 ·
**applied: Phase 4 onward**"_) — readable since Phase 0. **4A-8 is the session that audits and
completes them across the money surface and implements F14's outbox — not their author.** So a
session running before 4A-8 is not reaching forward in time; it is complying with a standing
standard, in its own scope.

Nothing 4A-8 _emits_ is consumed by the Wise sessions:

| CC-C / CC-D requirement              | Needs 4A-8 to have run?                      | Where Part 19.5 satisfies it                                                                                                                                           |
| ------------------------------------ | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Idempotency key on every money write | **No** — Wise _mandates_ it                  | `WiseTransfer.customerTransactionId @unique` (Wise's own idempotency contract); `WiseBatchGroup.wiseBatchGroupId @unique`; `mark-funded` guarded by `fundedAt IS NULL` |
| Dedupe table per webhook processor   | **No** — separate objects                    | `WiseWebhookEvent.deliveryId @unique` + a test asserting a replayed `X-Delivery-Id` produces one row and one side effect (W5)                                          |
| BullMQ job IDs from business keys    | **No** — own namespace                       | policy written in **W4**, applied by W5's `money:wise-webhook` queue (money-service has **no queue consumer at all** today — verified 2026-07-25)                      |
| Rate limits on money routes          | **No** — `ThrottlerModule` global since 4A-1 | explicit generous per-route `@Throttle()` set in **W4** — see §3.1                                                                                                     |
| Graceful shutdown                    | **No**                                       | **W4** — see §3.2. This is a **pre-existing defect**, not a Wise concern.                                                                                              |
| Retry/back-off on outbound           | **No**                                       | `wise-api.client.ts` honours `429` + `Retry-After`, exponential back-off, hard cap (W3)                                                                                |
| Reconciliation                       | **No**                                       | `wise-reconciliation` cron (W6) — webhook delivery is best-effort by Wise's own admission                                                                              |
| **F14 transactional outbox**         | **N/A**                                      | Slice 5's money→core tier path. **Wise never touches it. Stays 4A-8's.**                                                                                               |

### 3.1 Why the gate still needed its own session (the real problem)

Plan §13's gate table says:

| Phase gate                                    | Must be live first                                                              |
| --------------------------------------------- | ------------------------------------------------------------------------------- |
| **First Phase 4 write-API cutover (slice 4)** | **CC-C idempotency + outbox decision (F14); CC-D rate limits on new endpoints** |

**The Wise cutover (W7) _is_ a Phase 4 write-API cutover that moves real money** — it simply isn't
labelled "slice 4". Under rev 1's ordering that gate was formally still open at the first real
payout. Rev 2's `4A-W4` closes it. See `07-migration-process-change-proposal.md` P1.

### 3.2 Two pre-existing defects W4 must fix (found 2026-07-25, both on already-live code)

1. **Graceful shutdown is absent.** `money-service/src/main.ts` (51 lines) never calls
   `app.enableShutdownHooks()`. Nest only runs lifecycle hooks on SIGTERM when they are enabled, so
   `PrismaService.onModuleDestroy()` (`money-service/src/prisma/prisma.service.ts:36`) **is dead
   code today** — it has never executed. Plan §13 CC-C names the consequence exactly: _"Railway
   redeploys will otherwise sever in-flight batch payouts."_ This affects the crons and the dLocal
   webhook that are **already cut over**, not just Wise.
2. **The live dLocal webhook is throttled.** `ThrottlerGuard` is `APP_GUARD` in
   `money-service/src/app.module.ts:70` at `{ ttl: 60000, limit: 100 }` and **no controller opts
   out** (verified 2026-07-25). `/v1/webhooks/dlocal` — cut over, taking real payment traffic — can
   be 429'd by a retry burst, which dLocal reads as delivery failure.
   **The design's original `@SkipThrottle()` for Wise was also wrong**: it trades a throttling fault
   for a flooding fault. W4 sets one policy for all provider webhooks — an explicit generous limit
   (start at `{ ttl: 60_000, limit: 300 }`), applied to dLocal **and** inherited by Wise's route.
   ⚠️ Touching the live dLocal route is a change to already-cut-over money code and needs Davin's
   explicit approval (`EXECUTOR-PROTOCOL.md` §7).

**When 4A-8 later runs it verifies rather than re-implements**, using W4's audit findings, and does
the work that remains genuinely its own: F14's outbox and the Stripe/dLocal write-path fixes. Note
this in W8's handoff.

---

## 4. Session roadmap

Each entry: variant · purpose · entry criteria · steps · done-when · rollback · Davin's involvement.
These are **inputs to a PRE-DRAFT**, not orders.

---

### 4A-W1 — Wise contracts & decisions

**Variant:** `TEMPLATE-CONTRACT.md` (medium creativity) · **Est:** 2–3h · **Code written:** none
**Flags:** F36, F37 (resolve) · F38, F39, F40, F41 (register) · F42 (record as RESOLVED)

**Entry criteria**

- [ ] 4A-7 (Slice 3 cutover) is CUT-OVER or explicitly deferred by Davin.
- [ ] A Wise **business account** exists and Davin can log into it.
- [ ] A Wise **sandbox** account exists (`https://wise-sandbox.com`) with a sandbox token.
- [ ] Davin available for F36/F37.

**Steps**

1. Read `01-…architecture-design.md` and `02-…integration-reference.md` end to end.
2. **Check the Wise UI for Business Payment Approval rules.** If any exist, they must be removed
   before W6 or every API transfer fails. Record the finding either way.
3. Resolve **F36** (integration model) and **F37** (funding mode, given Thailand) with Davin;
   write both Decision-Log entries.
4. Bootstrap identity: `GET /v1/profiles` with the sandbox token → record `WISE_PROFILE_ID`
   (sandbox) and the profile type. Read-only, no money.
5. Confirm the source-currency balance question: which currency the platform funds from
   (`WISE_SOURCE_CURRENCY`) and whether that balance exists.
6. Register F38/F39/F40/F41 in the Decision Log as OPEN with owners and due sessions.
7. Freeze the two contracts: `part19.5-wise-disbursement-openapi.yaml` (review, correct against the
   live codebase, mark it the governing spec) and the **§5.2 state-mapping table** (declare it
   invariant).
8. Add `WISE_*` to the Session 0-4 secret matrix; decide read-only-vs-full token promotion
   (recommendation: read-only for W3/W5, full only from W6).
9. Update artefacts per `05-…` and PRE-DRAFT 4A-W2.

**Done when**

- [ ] F36 + F37 have Decision-Log entries with Davin's words quoted.
- [ ] Payment-approval status is recorded (present/absent).
- [ ] `WISE_PROFILE_ID` (sandbox) captured; `GET /v1/profiles` succeeded.
- [ ] OpenAPI spec + state table marked as contract law.
- [ ] F38–F41 registered; F42 recorded RESOLVED; `4A-5-RW` marked REVOKED.

**Rollback:** none needed — read-only session, no code, no money.
**Davin:** F36, F37, payment-approval check, secret-matrix approval.

---

### 4A-W2 — Additive schema migration

**Variant:** `TEMPLATE-INFRA.md` + PORT rules · **Est:** ~2h · **Flags:** F38 (resolve — the fee
bearer determines whether `feeBearer`/`feeAmount` semantics are per-transfer or global)

**Entry criteria**

- [ ] W1 closed; F36/F37 resolved.
- [ ] A fresh production DB backup exists / Railway backup cadence confirmed (F18's known gap —
      state it, don't fix it).
- [ ] `prisma migrate status` against the shared DB is clean (run **from the monolith**, never from
      money-service — **L1**).

**Steps**

1. Author the 5 new models + `WISE` enum value + 3 back-relations in
   **`prisma/non-market-data/schema.prisma`** (1023 lines). Nothing else changes.
2. `prisma migrate dev --create-only` → **read the generated SQL by eye.** It must contain only
   `CREATE TABLE` ×5, `CREATE INDEX` ×n, `ALTER TYPE "DisbursementProvider" ADD VALUE 'WISE'`.
   Any `DROP`, `ALTER COLUMN`, or `RENAME` = abort and investigate.
3. Apply to production with Davin present (`EXECUTOR-PROTOCOL.md` §7 — schema + money).
4. Hand-mirror the subset into `money-service/prisma/schema.prisma` (583 lines) following that
   file's own documented conventions (narrow relations, only what code traverses), then
   **`prisma generate` only** — L1.
5. Grant check: confirm the `money_svc` role has the right privileges on the 5 new tables (blueprint
   §5.1). New tables do **not** inherit grants automatically unless default privileges are set —
   **verify, don't assume.** This is the most likely silent failure of the session.
6. Audit `amountRiseUnits`/`payeeRiseId` readers for null-tolerance (`report-builder.service.ts`,
   `admin-affiliate-reports.controller.ts`, the admin transaction pages).
7. Add the archived-block schema comments from `03-…` §2.3 (comment-only, no migration).
8. Full suite both sides; update artefacts; PRE-DRAFT W3.

**Done when**

- [ ] Migration applied; `prisma migrate status` clean; 5 tables + enum value exist in production.
- [ ] `money_svc` can `SELECT`/`INSERT`/`UPDATE` all 5 new tables (proved by a query, not by grant listing alone).
- [ ] `money-service` builds; `prisma generate` output includes the new models.
- [ ] Rise tables' row counts unchanged (recorded in Deviations).
- [ ] Monolith `npm run validate` + money-service suite green.

**Rollback:** revert the migration (drop the 5 tables). ⚠️ Postgres cannot drop an enum value once
used — if any row has `provider='WISE'`, leave the value; it is inert.
**Davin:** production migration approval.

---

### 4A-W3 — BUILD recipient onboarding

**Variant:** `TEMPLATE-PORT.md` (low) for the backend + `TEMPLATE-UI-BUILD.md` (high) for the form ·
**Est:** ~4h — **split into W3a (backend) / W3b (UI) if it exceeds 4h** (`00-SKELETON-AND-RULES.md` §3)
**Flags:** F39 (resolve — who fills the form), F41 (resolve — PII retention)

**Entry criteria**

- [ ] W2 closed; new tables live and writable by `money_svc`.
- [ ] Sandbox token works; F39 answered (guard choice depends on it).
- [ ] `WISE_API_TOKEN` (read-only is sufficient for this session) set on money-service.

**Steps**

1. `wise.config.ts`, `wise.constants.ts`, `wise.types.ts`.
2. `wise-api.client.ts` — `fetch`-based (no new dependency; Node ≥20), `X-External-Correlation-Id`
   on every call, `429`/`Retry-After` handling, exponential back-off, **explicit body redaction for
   `POST /v1/accounts`** (never log `details`).
3. `wise-signature.constants.ts` (both published PEMs) + `wise-signature.verifier.ts` with unit
   tests — built here so W5 inherits it ready-made.
4. `wise-recipient.service.ts`: `getAccountRequirements` (quote-scoped, `Accept-Minor-Version: 1`,
   **including the `refreshRequirementsOnChange` POST round-trip**), `createRecipient`, `getRecipient`,
   `deactivateRecipient`.
5. `wise-recipients.controller.ts` → `GET /v1/wise/recipients/requirements`,
   `POST /v1/wise/recipients`, `GET /v1/wise/recipients`, `GET /v1/wise/recipients/me`,
   `POST /v1/wise/recipients/{id}/revalidate`. Guards per F39.
6. **Fetch and commit the real THB requirement schema from production** (read-only call) as a
   fixture — sandbox cannot produce it (`02-…` §10).
7. Frontend: schema-driven form (affiliate self-service or admin, per F39) +
   `/admin/disbursement/recipients` list.
8. Tests: verifier unit tests; requirements-schema normalisation; recipient create/read; a sandbox
   integration test creating a **GBP** recipient (sandbox-supported currency).
9. Deploy to Railway at unique paths — **no live traffic**, no subscription yet (Safety Gate,
   same pattern as 4A-4/4A-6).

**Done when**

- [ ] A real sandbox recipient is created end-to-end from the UI and stored with `status=ACTIVE`.
- [ ] No raw bank details appear anywhere in the DB or in logs (grep the log output; assert in test).
- [ ] `refreshRequirementsOnChange` proven: a country change reveals additional fields.
- [ ] Signature verifier: valid / tampered / wrong-key / malformed-base64 / empty-body all covered.
- [ ] THB requirement fixture committed.
- [ ] Suites green; deployed; `/v1/wise/recipients` returns 401 unauthenticated.

**Rollback:** revert the commit + redeploy. No money, no provider dashboard change.
**Davin:** F39, F41; whether the read-only token is sufficient (it is, for this session).

---

### 4A-W4 — CC-C/CC-D hardening gate for the money surface 🆕 rev 2

**Variant:** `TEMPLATE-CONTRACT.md` (audit is the deliverable) + small INFRA edits · **Est:** 2–3h
**Flags:** none resolved; **F43 registered** (see W6) · **Why it exists:** §3.1 — the plan's own
money gate would otherwise still be open at the first real payout

**Entry criteria**

- [ ] W3 closed.
- [ ] Davin available — this session changes **already-cut-over money code** (the live dLocal
      webhook route), which is an `EXECUTOR-PROTOCOL.md` §7 escalation.
- [ ] Read plan §13 CC-C and CC-D in full before starting. They, not this document, are the
      standard being applied.

**Steps**

1. **Audit — do not fix.** For every money write endpoint that exists today, record whether it has
   an idempotency key and what the key is: Stripe checkout, subscription cancel, invoices, dLocal
   create, code distribution, `batches/[batchId]/execute`. Produce a table with one row per
   endpoint and a verdict (`has key` / `no key` / `n/a`). **Fixing the Stripe/dLocal write paths
   stays 4A-8's job** — otherwise 4A-8 becomes an empty session and the Slice 4 gate loses meaning.
2. **Verify webhook dedupe tables.** Plan §13 names `RiseWorksWebhookEvent` as the template.
   Confirm dLocal has an equivalent — **this is the highest-value check in the session, because
   dLocal is live** — and record Stripe's status. Add what is missing **for live paths only**.
3. **Graceful shutdown (§3.2 defect 1).** Add `app.enableShutdownHooks()` to
   `money-service/src/main.ts`; prove `PrismaService.onModuleDestroy()` now actually fires on
   SIGTERM (it never has); write the BullMQ drain policy for the queue W5 is about to create.
4. **Webhook throttling (§3.2 defect 2).** Replace the implicit global limit on `/v1/webhooks/dlocal`
   with an explicit generous per-route `@Throttle({ default: { ttl: 60_000, limit: 300 } })`, and
   record it as the standing policy every future provider webhook inherits. **Verify with a replayed
   dLocal payload before and after** — reasoning is not evidence on a live money path.
5. **BullMQ job-ID policy.** Write the rule before the first queue exists: job IDs derive from
   business keys so a retry can never double-fire a payout. money-service today has
   `BullModule.forRoot` (4A-1) but **no `registerQueue` and no `@Processor`** — verified 2026-07-25.
6. **Register F43** (funding-SLA alert delivery channel) as OPEN, owner Davin, due W6 — see the
   options table in `07-migration-process-change-proposal.md` P5.
7. **Out of scope, explicitly:** F14/outbox, Stripe/dLocal write-path _fixes_, Slice 5 mechanics,
   anything Wise-specific. This session hardens the _existing_ surface so the Wise sessions land on
   solid ground.

**Done when**

- [ ] Idempotency audit table committed, one row per money write endpoint, no "TBD" verdicts.
- [ ] dLocal's webhook dedupe status **evidenced** (a query or a code citation, not an assertion).
- [ ] `enableShutdownHooks()` in place and `PrismaService.onModuleDestroy` **observed** firing on a
      SIGTERM (log line captured).
- [ ] Explicit `@Throttle()` on `/v1/webhooks/dlocal`; a replayed dLocal payload still verifies and
      processes identically to before the change.
- [ ] BullMQ job-ID policy written into the order's Deviations _and_ into `01-…design.md` §8 so W5
      inherits it.
- [ ] F43 registered.
- [ ] Full money-service suite green; monolith `npm run validate` green.

**Rollback:** `enableShutdownHooks()` and the `@Throttle()` decorator are both single-line, revert +
redeploy. No schema change, no money moved, no provider flip.
**Davin:** approval to touch the live dLocal route; F43 registration.

---

### 4A-W5 — BUILD Wise webhook + reducer

**Variant:** `TEMPLATE-PORT.md` (low) · **Est:** ~4h · **Flags:** F40 (resolve — subscription level)
**Verification method:** **replay with recorded signed payloads** (plan §6 — not a 48h shadow-run)

**Entry criteria**

- [ ] W3 closed; signature verifier exists and is tested.
- [ ] A sandbox transfer can be created and funded (needed to drive the Simulation API — Wise
      requires the transfer be funded before state simulation). If sandbox funding is unavailable,
      **stop and re-plan**: without it there are no real signed fixtures.
- [ ] CC-C borrow acknowledged (§3 above) as this session's own criteria.

**Steps**

1. `wise-webhook.controller.ts` → `POST /v1/webhooks/wise`. Order: rawBody → **verify signature** →
   handle `X-Test-Notification` → persist `WiseWebhookEvent` (unique `deliveryId`) → enqueue →
   `200 {"status":"ok"}`. **`@SkipThrottle()`** (else Wise's retry storm gets rate-limited).
2. `wise-state.mapper.ts` — the §5.2 table as code, with an `unknown-state` fallthrough that logs
   and alerts instead of throwing.
3. `wise-transfer-state.reducer.ts` — `updateMany`-as-lock on `balanceAppliedAt` /
   `balanceRevertedAt`; `lastEventOccurredAt` staleness guard; `stateHistory` append.
4. `wise-webhook.processor.ts` — BullMQ worker on `money:wise-webhook`, bounded retries,
   dead-letter surfaced on the admin health page.
5. Separate handler for `transfers#payout-failure` that writes failure fields **only** — never
   `Commission.status`, never the balance.
6. `balances#update` handler → best-effort funding detection (`MANUAL_DETECTED`).
7. **Capture fixtures:** drive the sandbox Simulation API through
   `processing → funds_converted → outgoing_payment_sent`, then a second transfer through
   `bounced_back → funds_refunded`, ≥5s apart, and commit the **real signed** payloads + headers.
8. Replay tests against the fixtures, byte-for-byte, asserting the §5.2 table and the at-most-once
   guards.
9. Subscribe **sandbox** webhooks (level per F40) pointing at the sandbox/production URL as
   appropriate; record rows in `WiseWebhookSubscription`. **No production subscription yet.**
10. Deploy. Route live but production-unsubscribed ⇒ zero real traffic (Safety Gate).

**Done when**

- [ ] Real Wise-signed sandbox payload verifies and processes; a tampered copy returns 401 **and**
      is persisted with `signatureVerified=false`.
- [ ] Duplicate `X-Delivery-Id` → one row, one side effect (test).
- [ ] Out-of-order replay (`processing` after `outgoing_payment_sent`) → `skippedReason='stale-order'`,
      no regression (test).
- [ ] Happy path drives `Commission → PAID` and moves the balance **exactly once**; replaying it
      changes nothing (test).
- [ ] Unhappy path (`funds_refunded`) reverts **exactly once**; replaying it changes nothing (test).
- [ ] `transfers#payout-failure` writes failure fields and leaves `Commission.status` untouched (test).
- [ ] `unknown-state` payload → persisted, skipped, alerted, no throw (test).
- [ ] Controller p95 < 500ms (Wise's budget is 5s).
- [ ] Production URL still unsubscribed; verified.

**Rollback:** delete the sandbox subscription; revert + redeploy. Nothing in production is listening.
**Davin:** F40; sandbox funding availability.

---

### 4A-W6 — BUILD payout engine + funding gate

**Variant:** `TEMPLATE-PORT.md` (low) · **Est:** ~4h · **Highest-risk BUILD in Part 19.5**
**Flags:** confirms F37 (funding mode) in code

**Entry criteria**

- [ ] W5 closed; reducer proven by replay.
- [ ] **`WISE_API_TOKEN` promoted to full access** (this is the session that can create transfers).
- [ ] **Business Payment Approvals confirmed absent** (W1 finding still true — re-check).
- [ ] Sandbox balance funded sufficiently for the E2E.
- [ ] Davin available — this session writes code that will move real money once cut over.

**Steps**

1. `provider-capabilities.ts` — `FundableProvider`, `RecipientAwareProvider`, `isFundable`,
   `CapabilityUnavailableError`.
2. `wise-quote.service.ts` (F38's `sourceAmount`-vs-`targetAmount` decision applied),
   `wise-transfer.service.ts` (UUID v4 `customerTransactionId` **persisted before the call**,
   resumable retry), `wise-batch-group.service.ts` (create/add/complete/cancel + funding gate).
3. `wise-payment.provider.ts` — `PaymentProvider` members mapped per design §3.3, plus the two
   capability interfaces. `fundBatchFromBalance` throws `CapabilityUnavailableError` when
   `WISE_FUNDING_MODE=MANUAL`.
4. **`payment-orchestrator.service.ts` (333 lines): the `isFundable` branch (design §3.4).** Wise
   batches write `PENDING`/`PROCESSING` and **never** touch `Commission.status` or the balance.
   ⚠️ Every existing orchestrator test must still pass on the non-fundable branch — that is the
   parity oracle. A changed assertion needs a written justification (`LESSONS-LEARNED.md` L3).
5. `commission-aggregator.service.ts` (294 lines): provider-branched eligibility —
   `AffiliateWiseRecipient.status='ACTIVE'` for WISE, the existing `AffiliateRiseAccount` KYC path
   preserved for RISE.
   5b. **Fix design §3.5(a) — the silent empty-string bug.** `transaction.service.ts` (310 lines,
   ≈line 80) populates the payee reference from `commission.affiliateProfile?.riseAccount?.*`, and
   `payment-orchestrator.service.ts` (≈line 117) then does
   `affiliateId: txn.affiliateRiseAccount?.affiliateProfileId || ''`. A Wise transaction has no
   Rise account, so **both `affiliateId` and `riseId` silently become `''`**. Resolve the affiliate
   from `Commission.affiliateProfileId` instead (always present, required FK). Behaviour-preserving
   for Rise/Mock — the existing tests must still pass unmodified.
   ⚠️ Leave `amountRiseUnits` alone: it is already correctly branched on `provider === 'RISE'`.
6. `wise-batches.controller.ts` — admin: prepare, complete, get pay-in details,
   `POST /v1/wise/batches/{id}/mark-funded`, `POST …/fund` (API mode only), cancel.
7. `wise-reconciliation.service.ts` + hourly cron: poll non-terminal transfers through the **same
   reducer**; alert on `AWAITING_MANUAL_FUNDING` older than `WISE_FUNDING_SLA_HOURS` (**the human
   gate's dead-man switch — required, not optional**); surface stuck webhook events.
8. Admin UI: funding queue card, batch pay-in panel, `Mark funded` with evidence capture,
   per-transfer Wise state + failure code.
9. **Sandbox E2E (GBP/USD/EUR — not THB, see `02-…` §10):** recipient → batch of ≥2 → complete →
   read `payInDetails` → fund in sandbox → simulate states → assert `Commission=PAID` and the
   balance moved exactly once. Then a bounce case → assert the revert.
10. Deploy. `DISBURSEMENT_PROVIDER` **stays `MOCK`** — no real batch can be created yet (Safety Gate).

**Done when**

- [ ] Sandbox E2E happy path green, asserted at the DB level.
- [ ] Sandbox E2E bounce path green; recipient → `INVALID`; revert exactly once.
- [ ] `prepareBatch` interrupted mid-way and retried creates **no duplicate** Wise transfers
      (proved by `customerTransactionId` reuse).
- [ ] `fundBatchFromBalance` throws `CapabilityUnavailableError` under `MANUAL` (test).
- [ ] `mark-funded` is idempotent (second call is a no-op) (test).
- [ ] SLA alarm fires for a stale `AWAITING_MANUAL_FUNDING` batch (test with an injected clock).
- [ ] Reconciliation of an already-webhook-processed transfer changes nothing (test).
- [ ] A Wise batch's payment requests carry a **non-empty** `affiliateId` (design §3.5(a) fixed) —
      asserted by a test, because this failure mode is silent.
- [ ] All pre-existing orchestrator/aggregator/transaction-service tests still pass, unmodified.
- [ ] `DISBURSEMENT_PROVIDER` still `MOCK` in production; verified value-blind.

**Rollback:** revert + redeploy; provider was never flipped. Any sandbox artefacts are disposable.
**Davin:** full-token promotion; a pre-cutover review of the money paths
(`SESSION-WALKTHROUGHS.md` Walkthrough F money-audit prompt applies here even though this is a BUILD).

---

### 4A-W7 — CUTOVER to Wise ⚠️ REAL MONEY

**Variant:** `TEMPLATE-VERIFY-RETIRE.md` (near-zero creativity — keep it ~10 lines)
**Est:** 1–2h · **Davin must be present for every step**

**Entry criteria**

- [ ] W6 closed, all-green, sandbox E2E evidence presented.
- [ ] `WISE_*` production env vars set (value-blind verified) and `WISE_ENV=production`.
- [ ] **At least one real affiliate has an `ACTIVE` Wise recipient** — ideally one Davin controls.
- [ ] Production Wise balance funded with at least the smoke amount.
- [ ] Business Payment Approvals absent (third and final check).
- [ ] Davin present. His ritual question — _"what's the rollback?"_ — answered below.

**Checklist (CUTOVER block)**

1. Present W6's sandbox evidence and the state-mapping table. Any unexplained mismatch → **abort**.
2. Davin approves.
3. **Subscribe production webhooks** (`transfers#state-change` + `transfers#payout-failure`
   - `balances#update`, schema `4.0.0`, level per F40) → `https://money-service-production.up.railway.app/v1/webhooks/wise`.
     Confirm the auto-sent **test event** arrives and returns 200 (`X-Test-Notification: true`).
4. **Flip:** `DISBURSEMENT_PROVIDER=MOCK → WISE`. Redeploy.
5. **Smoke payout — ONE affiliate, smallest viable amount:** prepare → complete → present pay-in
   details → Davin funds in the Wise app → observe `transfers#state-change` land in Railway logs →
   confirm `Commission=PAID` and the affiliate balance moved once.
   ⚠️ **Do not batch multiple affiliates on the first run.**
6. Apply archive switches **A1–A3** (`03-…` §1): unregister `RiseworksModule`, provider-factory gate,
   env already flipped. Redeploy; confirm `POST /v1/webhooks/riseworks` → **404**.
7. Monitor for a full funding cycle: error rate, webhook backlog, no duplicate `Commission.paidAt`
   writes. Green?
8. Record: `migration-cutover-table.md` (**new Slice 2W row**), `CLAUDE.md`, `DECISION-LOG.md`.

**Rollback (state it before flipping, per the ritual)**

- `DISBURSEMENT_PROVIDER=WISE → MOCK` + redeploy. Stops all new sends immediately.
- Delete the production webhook subscriptions. In-flight events are still delivered but not sent;
  the reconciliation cron backfills once resubscribed ⇒ no event loss.
- **Already-sent money cannot be recalled.** That is precisely why step 5 is one small payout.
- Re-register `RiseworksModule` per `03-…` §4 if a provider is needed at all — but note Rise cannot
  actually send payments (`03-…` §4.1.3).

**Deviations:** should be empty. A deviation in a money cutover is a stop signal.

---

### 4A-W8 — Archive RiseWorks + artefacts

**Variant:** `TEMPLATE-VERIFY-RETIRE.md` — **ARCHIVE, not RETIRE. Nothing is deleted.**
**Est:** ~1h

**Entry criteria**

- [ ] Wise stable since W7 for a Davin-agreed duration (recommend ≥1 successful funding cycle
      **and** ≥7 days).
- [ ] A1–A3 already applied in W7 and verified.

**Checklist**

1. Apply A4–A5 and every §2.1–2.5 item of `03-…` (banners, flag-gated UI, cron short-circuit,
   schema comments, `riseworks/ARCHIVED.md`, inventory notes, `4A-5-RW` → REVOKED).
2. Run the **dormancy verification** (`03-…` §3) and record every piece of evidence, including the
   before/after row counts for `AffiliateRiseAccount` and `RiseWorksWebhookEvent`.
3. **Dry-run the restore procedure** (`03-…` §4) on a local/branch checkout — do not apply it to
   production. Prove the ≤30-minute claim, or correct it.
4. Convert `06-part-19.5-file-inventory-PLANNED.md` to the real inventory and file it under
   `docs/files-completion-list/files-inventory/part19.5-files-completion.md`.
5. Update `migration-stack-analysis.md`: Rise entries → `ARCHIVED (Part 19.5)`, `src/wise/**` added.
6. Record: cutover table, CLAUDE.md, DECISION-LOG (F42 evidence). Harvest lessons.
7. PRE-DRAFT **4A-8** (CC-C hardening gate) noting which CC-C requirements Part 19.5 already
   satisfied (§3) so 4A-8 verifies rather than rebuilds.

**Rollback:** git revert of the archival commit (this is the easy rollback — it is all comments,
flags and one import line).

---

## 5. Cross-session risk register

| Risk                                                                                                  | Likelihood                 | Impact                                                                  | Mitigation                                                                           | Owned by |
| ----------------------------------------------------------------------------------------------------- | -------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | -------- |
| Business Payment Approval rule blocks every API transfer                                              | medium                     | W6 dead in the water                                                    | checked in W1, re-checked in W6 and W7                                               | W1       |
| Thailand region gate makes funding manual forever                                                     | **certain** on Model A     | payouts need a human every cycle                                        | designed for it; SLA alarm prevents silent stalls; F36 offers Model B as the exit    | W1       |
| THB route untestable in sandbox                                                                       | **certain**                | account-requirements shape unverified until production                  | fetch the real THB schema read-only in W3; W7 smoke is the real proof                | W3       |
| Orchestrator branch (design §3.4) missed → premature `PAID`                                           | medium                     | **accounting corruption**                                               | explicit invariant; W6 test asserts Wise batches never write `Commission.status`     | W6       |
| **Rise-coupled payee derivation leaves `affiliateId`/`riseId` as `''` for Wise (design §3.5(a))**     | **certain if unfixed**     | batch drafted with blank payee identity, **fails silently**             | resolve the affiliate from `Commission.affiliateProfileId`; W6 asserts non-empty     | W6       |
| Balance double-apply on Wise rollback transitions                                                     | medium                     | wrong affiliate balances                                                | `balanceAppliedAt`/`balanceRevertedAt` row locks + replay tests                      | W5       |
| **Live dLocal webhook throttled by the global `ThrottlerGuard`** (pre-existing, **already cut over**) | medium                     | **dropped dLocal webhooks read as delivery failure → missing payments** | explicit generous per-route `@Throttle()` in **W4**, verified by replay before/after | **W4**   |
| **`enableShutdownHooks()` absent ⇒ `PrismaService.onModuleDestroy` is dead code** (pre-existing)      | **certain, happening now** | severed connections + in-flight batch payouts on **every** redeploy     | added and observed firing in **W4**                                                  | **W4**   |
| Money gate (plan §13) still open at the first real payout                                             | **was certain in rev 1**   | first payout ships without CC-C/CC-D closed                             | **rev 2 inserts `4A-W4` before W5**                                                  | W4       |
| Funding-SLA alarm has no delivery channel (money-service has no email)                                | **certain if unresolved**  | unfunded batch silently auto-cancelled by Wise after ~14 days           | **F43** registered in W4, decided in W6                                              | W6       |
| 4A-8 becomes an empty session because W4 did its work                                                 | low                        | the Slice 4 gate loses meaning                                          | W4 **audits, does not fix** Stripe/dLocal write paths; F14/outbox stays 4A-8's       | W4       |
| `money_svc` lacks grants on the 5 new tables                                                          | medium                     | runtime failures only in production                                     | explicit grant verification in W2, proved by query                                   | W2       |
| Wise adds a transfer state                                                                            | low                        | unhandled event                                                         | `String` column + `unknown-state` fallthrough + alert                                | W5       |
| Full-access token leaked                                                                              | low                        | **real money loss**                                                     | read-only until W6; value-blind env checks only; never `railway variables --kv`      | all      |
| Slice 4 (4A-9/10) and W6 both change `batches/[batchId]/execute`                                      | medium                     | merge conflict / lost behaviour                                         | flagged in W6's handoff; whoever runs second re-reads the other's Deviations         | W6       |
| Prisma migration touches Rise tables                                                                  | low                        | **F42 violation**                                                       | W2 step 2: read the generated SQL by eye; any DROP/RENAME aborts                     | W2       |
| `prisma db push` run from money-service                                                               | low                        | **catastrophic** (drops core tables)                                    | `LESSONS-LEARNED.md` L1; W2 says `prisma generate` only                              | W2       |

---

## 6. Aggregate estimate

| Session      | Est.           | Cumulative |
| ------------ | -------------- | ---------- |
| 4A-W1        | 2–3h           | 3h         |
| 4A-W2        | 2h             | 5h         |
| 4A-W3        | 4h (may split) | 9h         |
| **4A-W4** 🆕 | **2–3h**       | **12h**    |
| 4A-W5        | 4h             | 16h        |
| 4A-W6        | 4h             | 20h        |
| 4A-W7        | 1–2h           | 22h        |
| 4A-W8        | 1h             | **~23h**   |

Rev 2 added ~3h (the `4A-W4` hardening session). Rev 1 was 7 sessions / ~20h.

Plus Davin's own time: F36–F41 + **F43** decisions, one production migration approval, approval to
touch the live dLocal route (W4), the W7 cutover, and **one manual funding action per payout cycle,
indefinitely, under Model A**. That last line is the real cost of the Thailand region gate and
should be visible when F36 is decided.

---

## 7. Playbook & prompt-script amendments

Per `00-SKELETON-AND-RULES.md` §5, a playbook amendment ships **in the same DRAFT** as the order it
affects, and `prompt-to-claude-code/SESSION-PROMPT-SCRIPT.md` must never disagree with the playbook.
Both amendments are drafted, paste-ready, in `05-artifact-amendments.md` §4 and §5, and are approved
by Davin's approval of the 4A-W1 order.
