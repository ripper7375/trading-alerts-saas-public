# Migration Order — PORT variant

> For sessions that **move existing code between stacks**. Read `00-SKELETON-AND-RULES.md`
> first — §4 applies with the dial at **Low**: behavior preservation IS the deliverable. The
> `replace-rise-with-wise/01-...architecture-design.md` §5 state-machine table and
> `04-rise-to-wise-migration-plan.md` §4 "4A-W5" section are ground truth for this session, not
> this order's own prose.

**Session:** 4A-W5 · **Variant:** PORT · **Status:** PRE-DRAFT
**Generated:** 2026-07-26 (Executor, at 4A-W4's close) · **Estimated time:** ~4h
**Phase / plan section:** Phase 4A — money-service · Part 19.5 (RiseWorks → Wise), session 5 of 9
**Flags touched:** **F40** (Wise webhook subscription level: profile vs application) — resolve this session
**Target service:** money-service (`src/wise/` — first files in this directory)
**Contract:** `replace-rise-with-wise/part19.5-wise-disbursement-openapi.yaml` (`POST /v1/webhooks/wise`), `01-...architecture-design.md` §5 (state table), §6 (replay/idempotency), §8 (module layout + this session's own prerequisites)
**Verification method:** **replay with recorded signed sandbox payloads** (plan §6) — NOT a 48h shadow-run, per the plan's own explicit call for this session

---

## Why this session, why now

4A-W4 closed the plan §13 CC-C/CC-D money gate (graceful shutdown, dLocal webhook throttling,
BullMQ job-ID policy, idempotency/dedupe audit) specifically so this session — money-service's
**first BullMQ consumer** — lands on solid ground. This is also the first Wise-specific code in
money-service (4A-W1–W4 were contracts, schema, and recipient-onboarding backend/frontend only —
no webhook receiver, no transfer creation, no money moved).

---

## Entry criteria

_(verified at CONFIRM time, not assumed — `EXECUTOR-PROTOCOL.md` §1.3)_

- [ ] **4A-W4 closed CONFIRMED** — re-verify `app.enableShutdownHooks()` is live in `main.ts` and the BullMQ job-ID policy (`jobId = wise:event:<deliveryId>` / `jobId = wise:transfer:<customerTransactionId>`) is in `01-...architecture-design.md` §8.0.
- [ ] `wise-signature.verifier.ts` exists and is tested (built at 4A-W3a — re-verify still present, still passing).
- [ ] **A sandbox transfer can be created and funded** (needed to drive Wise's Simulation API — a transfer must be funded before state simulation works). **If sandbox funding is unavailable, stop and re-plan** — without it there are no real signed fixtures to replay, and this session's whole verification method depends on them.
- [ ] **F40 resolvable this session** — Davin available to decide webhook subscription level (profile vs application), which follows directly from F36 (Model A: Business + personal token, resolved 4A-W1).
- [ ] Re-verify live: `app.module.ts` still has zero `registerQueue()`/`@Processor()` calls (confirmed at 4A-W4 CONFIRM and again at its close) — this session adds the first one.

**A failed entry criterion means do not start** — propose the fix or the session swap.

---

## Integration points

- **In:** Wise webhooks → `POST /v1/webhooks/wise` (new controller, no guard — Wise's own signature verification is the auth, mirroring `dlocal-webhook.controller.ts`'s pattern but for RSA-SHA256 not HMAC)
- **Out:** BullMQ queue `money:wise-webhook` (new — money-service's first `registerQueue`/`@Processor`)
- **Owns:** `WiseWebhookEvent` (dedup on `deliveryId`, built 4A-W2), `WiseTransfer`/`Commission`/`AffiliateProfile` balance fields (state reducer writes)

---

## File Port Order

_(dependency order: pure/leaf modules → stateful adapters → orchestration → entrypoints → tests last)_

### File 1 — `wise-state.mapper.ts`

- **SOURCE:** `01-...architecture-design.md` §5.2 (the state-mapping table, frozen at 4A-W1) → **TARGET:** `money-service/src/wise/services/wise-state.mapper.ts`
- **Kind:** new glue — the design doc's table implemented as code, not a port of existing code (no prior implementation exists)
- **Invariants:** every state in §5.2 must map exactly; an unmapped/unknown state must log + alert, **never throw** (a thrown error would 500 the webhook, causing Wise to treat a successful-but-unrecognized event as a delivery failure and retry indefinitely)
- **Parity proof:** unit test enumerating every §5.2 row plus one deliberately-unknown state

### File 2 — `wise-transfer-state.reducer.ts`

- **SOURCE:** design §5.3–§5.4 (at-most-once semantics, staleness guard) → **TARGET:** `money-service/src/wise/services/wise-transfer-state.reducer.ts`
- **Kind:** new glue
- **Invariants:** `updateMany`-as-lock on `balanceAppliedAt`/`balanceRevertedAt` (a row already stamped never re-applies); `lastEventOccurredAt` staleness guard rejects out-of-order replay; `stateHistory` append-only
- **Parity proof:** replay tests — duplicate delivery, out-of-order delivery, happy-path exactly-once, unhappy-path exactly-once (see Done-when)

### File 3 — `wise-webhook.processor.ts`

- **SOURCE:** design §8 module layout → **TARGET:** `money-service/src/wise/queue/wise-webhook.processor.ts`
- **Kind:** new glue — BullMQ `@Processor('wise-webhook')`, money-service's first
- **Invariants:** job IDs per 4A-W4's policy (`jobId = wise:event:<deliveryId>`); bounded retries; dead-letter surfaced on the admin health page; **must implement `onModuleDestroy()` calling `worker.close()`** per 4A-W4's drain policy so `enableShutdownHooks()` actually drains an in-flight job instead of dropping it
- **Parity proof:** unit test asserting `jobId` derivation and dead-letter routing

### File 4 — `wise-webhook.controller.ts`

- **SOURCE:** `part19.5-wise-disbursement-openapi.yaml` (`POST /v1/webhooks/wise`) + `dlocal-webhook.controller.ts`'s own shape (mirrored, not copied — different signature scheme) → **TARGET:** `money-service/src/wise/controllers/wise-webhook.controller.ts`
- **Kind:** port + adapt — same request/response shape discipline as the dLocal controller (rawBody → verify → persist → enqueue → 200), adapted for RSA-SHA256 (`wise-signature.verifier.ts`, built 4A-W3a) instead of HMAC, and for BullMQ enqueue instead of inline processing
- **Port steps:** rawBody → `verifyWebhookSignature` (RSA) → handle `X-Test-Notification` specially (Wise's subscription-verification ping, must 200 without persisting) → persist `WiseWebhookEvent` (unique `deliveryId` — a duplicate delivery must not create a second row) → enqueue onto `money:wise-webhook` → `200 { status: 'ok' }`
- **Invariants:** **`@SkipThrottle()`**, not `@Throttle()` — Wise's own retry storm on a slow consumer would otherwise get rate-limited by the same `ThrottlerGuard` `APP_GUARD` that 4A-W4 just tuned for dLocal; a tampered signature returns 401 **and** is still persisted with `signatureVerified=false` (audit trail even for rejected deliveries)
- **Parity proof:** replay tests against real Wise sandbox signed fixtures (captured this session, see Steps below)

### File 5 — Failure-path handler (`transfers#payout-failure`)

- **SOURCE:** design §5.3's failure branch → **TARGET:** within `wise-transfer-state.reducer.ts` or a sibling handler (Advisor to decide exact file boundary)
- **Kind:** new glue
- **Invariants:** writes failure fields **only** — never touches `Commission.status`, never touches the balance (a payout failure is not a payout completion or reversal; those are separate event types with their own handlers)
- **Parity proof:** test asserting `Commission.status` and balance fields are byte-identical before/after a `payout-failure` event

### File 6 — Funding-detection handler (`balances#update`)

- **SOURCE:** design §5.3 best-effort funding detection → **TARGET:** within the reducer or a sibling handler
- **Kind:** new glue
- **Invariants:** best-effort only — sets `MANUAL_DETECTED`, does not gate or unblock a batch by itself (F37: funding stays `MANUAL`, Thailand region gate)
- **Parity proof:** test asserting the detection flag alone, no side effects on batch state

---

## Ordered steps (beyond the per-file ports above)

1. **F40 resolution** (Davin, live, this session's own entry criterion): decide webhook subscription level (profile vs application), following from F36 (Model A). Record in `DECISION-LOG.md`.
2. **Capture real fixtures.** Drive the Wise sandbox Simulation API through `processing → funds_converted → outgoing_payment_sent` for one transfer, and `bounced_back → funds_refunded` for a second, **≥5s apart** (design's own ordering-sensitivity note). Commit the real signed payloads + headers as test fixtures — never hand-construct a "plausible" signature.
3. **Replay tests** against the captured fixtures, byte-for-byte, asserting the §5.2 mapping table and the at-most-once guards (File 2's invariants).
4. **Subscribe sandbox webhooks only** (level per Step 1's F40 resolution), pointing at the sandbox/production URL as appropriate; record rows in `WiseWebhookSubscription`. **No production subscription this session** — Safety Gate, same convention as 4A-4's dLocal/RiseWorks webhook receivers (deployed live, zero real traffic until a later session explicitly flips the provider dashboard).
5. Deploy. Route live but production-unsubscribed ⇒ zero real traffic.

---

## Rules specific to this variant

- Changing a ported test's assertion requires a written justification in Deviations (`LESSONS-LEARNED.md` L3-class rule).
- The design doc's §5 state table and §6 replay/idempotency rules are the parity oracle — not this order's own paraphrase of them.
- This session ends with the webhook route **live but production-unsubscribed** — cutover (subscribing the real production Wise webhook) is a later session's job, not this one's.

---

## Done when

- [ ] Real Wise-signed sandbox payload verifies and processes; a tampered copy returns 401 **and** is persisted with `signatureVerified=false`.
- [ ] Duplicate `X-Delivery-Id` → one row, one side effect (test).
- [ ] Out-of-order replay (`processing` after `outgoing_payment_sent`) → `skippedReason='stale-order'`, no regression (test).
- [ ] Happy path drives `Commission → PAID` and moves the balance **exactly once**; replaying it changes nothing (test).
- [ ] Unhappy path (`funds_refunded`) reverts **exactly once**; replaying it changes nothing (test).
- [ ] `transfers#payout-failure` writes failure fields and leaves `Commission.status` untouched (test).
- [ ] `unknown-state` payload → persisted, skipped, alerted, no throw (test).
- [ ] Controller p95 < 500ms (Wise's own budget is 5s).
- [ ] Production URL still unsubscribed; verified.
- [ ] BullMQ job IDs follow 4A-W4's policy exactly; processor implements `onModuleDestroy()` → `worker.close()`.
- [ ] F40 resolved and logged in `DECISION-LOG.md`.
- [ ] Full `money-service` test suite green; monolith `tsc --noEmit` clean (unaffected, but re-verify).
- [ ] `CLAUDE.md`, `DECISION-LOG.md`, `migration-stack-analysis.md` updated.

---

## Cutover & rollback (next session's order — reference only)

- **Mechanism:** subscribing the real production Wise webhook URL (dashboard-side, like 4A-5's dLocal cutover) — a future session, not this one.
- **Rollback (this session):** delete the sandbox subscription; revert + redeploy. Nothing in production is listening, so rollback has zero traffic impact.

---

## Deviations

_(filled DURING execution — what / why / impact.)_

---

## Known wrinkles / do-not-touch

- **`lib/api/index.ts`** — known-broken by design until Phase 7. Do not touch.
- **RiseWorks source, schema, and rows** — Archived (F42), never deleted, never renamed.
- **`DISBURSEMENT_PROVIDER` stays `MOCK` in production** — this session builds the webhook receiver, it does not flip the active provider or move money.
- **No production Wise webhook subscription this session** — Safety Gate; a later session cuts over.
- **`@SkipThrottle()` on the Wise webhook route, not `@Throttle()`** — do not apply 4A-W4's dLocal throttling pattern here; Wise's retry behavior needs no rate limit on this route (see File 4's invariants).

---

## Next-session handoff

_(PRE-DRAFT the following session at this session's close, informed by this session's actual deviations — likely 4A-W6, "BUILD payout engine + funding gate," per `04-rise-to-wise-migration-plan.md` §4. That session is the highest-risk BUILD in Part 19.5 — it promotes `WISE_API_TOKEN` to full access and writes the code that will move real money once cut over. Its own entry criteria per the plan: W5 closed with the reducer proven by replay; token promoted; Business Payment Approvals re-confirmed absent; sandbox balance funded; Davin available.)_
