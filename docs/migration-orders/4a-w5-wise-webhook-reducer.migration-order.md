# Migration Order — PORT variant (4B-2 Worked Example Depth)

> For sessions that **move existing code or build backend services guided by a frozen contract**.
> Read `00-SKELETON-AND-RULES.md` first — §4 applies with the dial at **Low**: behavior preservation
> and exact state-machine conformance IS the deliverable. Ground truth for this session is
> `01-part-19.5-wise-disbursement-architecture-design.md` §5 (state mapping & reducer rules) and
> §8 (module layout & BullMQ queues).

**Session:** 4A-W5 · **Variant:** PORT · **Status:** CONFIRMED
**Generated:** 2026-07-26 (Advisor) · **Estimated time:** ~4h
**Phase / plan section:** Phase 4A — money-service · Part 19.5 (RiseWorks → Wise), session 5 of 9
**Flags touched:** **F40** (resolve — Wise webhook subscription level: `PROFILE` vs `APPLICATION`)
**Target service:** money-service (`src/wise/services/*`, `src/wise/controllers/*`, `src/wise/queue/*`)
**Contract:** `part19.5-wise-disbursement-openapi.yaml` (`POST /v1/webhooks/wise`), `01-part-19.5-wise-disbursement-architecture-design.md` §5 (state mapping table & reducer rules), §6 (replay verification), §8 (module layout & BullMQ policy)
**Verification method:** **REPLAY with valid RSA-signed sandbox test payloads** (using the RSA keypair from 4A-W3a) — NOT requiring live token funding

---

## Why this session, why now

4A-W4 (APPROVED / CONFIRMED, executed 2026-07-26) closed the plan §13 CC-C/CC-D money gate (`app.enableShutdownHooks()`, dLocal webhook `@Throttle()`, BullMQ job-ID policy, idempotency/dedupe audit) specifically so this session — `money-service`'s **first BullMQ queue consumer** — lands on solid ground. This session builds the Wise webhook receiver and state reducer, establishing the state machine that processes transfer events and executes commission payout completions.

---

## Hard Invariants for this Session

1. **Deduplicate on `X-Delivery-Id`**: Raw webhook payload envelope contains `X-Delivery-Id` (UUID). Store and deduplicate on `WiseWebhookEvent` (`@unique deliveryId`) so retried webhook attempts execute at-most-once.
2. **Order on `data.occurred_at`**: Events may arrive out of order over the wire. Check `lastEventOccurredAt` timestamp before applying state mutations. If `event.occurredAt <= lastEventOccurredAt`, skip state mutation (`skippedReason = 'stale-order'`).
3. **`@SkipThrottle()` on Webhook Controller**: Apply NestJS `@SkipThrottle()` to `POST /v1/webhooks/wise`. Wise retry bursts during high volume or network hiccups must NEVER be rate-limited or 429'd.
4. **REDUCER EXCLUSIVITY INVARIANT**: **ONLY this reducer may mark a Commission `PAID`** (`Commission.status = 'PAID'`) upon `outgoing_payment_sent` / `COMPLETED` state event! Payout creation (W6) drafts transfers but NEVER sets `Commission.status = PAID` or updates `AffiliateProfile.balance`.
5. **Adoption of CC-C Money Gate Requirements**: This session adopts 4A-8's CC-C exit criteria as its own (deterministic BullMQ `jobId = wise:event:<deliveryId>`, persistent dedupe table `WiseWebhookEvent`, `@SkipThrottle()`, bounded retries with dead-letter queue routing).

---

## Entry criteria

_(verified at CONFIRM time, not assumed — `EXECUTOR-PROTOCOL.md` §1.3)_

- [ ] **4A-W4 closed CONFIRMED** — re-verify `app.enableShutdownHooks()` is live in `main.ts` and the BullMQ job-ID policy (`jobId = wise:event:<deliveryId>`) is documented.
- [ ] `wise-signature.verifier.ts` exists and passes unit tests (`money-service/src/wise/wise-signature.verifier.ts`, 63 lines, built 4A-W3a).
- [ ] **F40 answered** by Davin before Step 4 (resolve webhook subscription scope: `PROFILE` vs `APPLICATION`).
- [ ] Codebase line counts verified against live tree before Step 1:
      `money-service/src/main.ts` (61 lines),
      `money-service/src/app.module.ts` (81 lines),
      `money-service/src/dlocal/dlocal-webhook.controller.ts` (425 lines),
      `money-service/src/wise/wise-signature.verifier.ts` (63 lines).
- [ ] Re-verify live: `app.module.ts` still has zero `registerQueue()`/`@Processor()` calls — this session adds the first queue (`money:wise-webhook`).

**A failed entry criterion means do not start** — propose the fix or the session swap.

---

## Integration points

- **In:** Wise webhooks → `POST /v1/webhooks/wise` (`WiseWebhookController`, `@SkipThrottle()`, RSA-SHA256 signature verified)
- **Out:** BullMQ queue `money:wise-webhook` (`WiseWebhookProcessor`)
- **Owns:** `WiseWebhookEvent` (`@unique deliveryId`), `WiseTransfer`, `Commission` (`status = PAID`), `AffiliateProfile` (`balance`)

---

## Ordered File Breakdown (4B-2 Worked Example Depth)

Dependency order: pure state mapping → state reducer logic → queue processor → webhook controller & module wiring → failure & funding handlers → test suites.

### File 1/8 — Wise State Mapper

- **TARGET:** `money-service/src/wise/services/wise-state.mapper.ts`
- **Kind:** Pure State Mapper (Low dial — strict contract)
- **Description:** Maps Wise transfer events to system transfer states and action signals per design §5.2.
  - Wise `processing` / `incoming_payment_waiting` → State: `PROCESSING`, Action: `NO_ACTION`
  - Wise `funds_converted` → State: `FUNDS_CONVERTED`, Action: `NO_ACTION`
  - Wise `outgoing_payment_sent` → State: `COMPLETED`, Action: `COMMISSION_PAID`
  - Wise `bounced_back` → State: `BOUNCED_BACK`, Action: `NO_ACTION`
  - Wise `funds_refunded` → State: `REFUNDED`, Action: `BALANCE_REVERTED`
  - Wise `cancelled` → State: `CANCELLED`, Action: `NO_ACTION`
  - Wise `transfers#payout-failure` → State: `FAILED`, Action: `TRANSFER_FAILED`
  - **Invariant:** Unmapped / unknown state logs warning + alerts, **never throws** (a thrown exception would return HTTP 500 to Wise, causing endless retries).
- **Verification:** Unit test enumerating every design §5.2 state mapping plus unknown fallback.
- **Commit:** `build(wise): add wise-state.mapper.ts for transfer state mapping`

### File 2/8 — Transfer State Reducer (Exclusive `Commission.PAID` Writer)

- **TARGET:** `money-service/src/wise/services/wise-transfer-state.reducer.ts`
- **Kind:** Domain State Reducer (Low dial — strict financial at-most-once rules)
- **Description:** State machine reducer executing atomic state transitions and balance mutations.
  - Injects `PrismaService` and `WiseStateMapper`.
  - `reduceTransferEvent(payload: WiseWebhookPayload)`:
    1. **Staleness Guard**: Compares `payload.data.occurred_at` against `WiseTransfer.lastEventOccurredAt`. If `payload.data.occurred_at <= lastEventOccurredAt`, logs stale order warning and skips state mutation (`skippedReason = 'stale-order'`).
    2. **Atomic Balance Lock**: Uses Prisma `updateMany` with `where: { id: transferId, balanceAppliedAt: null }` when handling `COMMISSION_PAID` event (`outgoing_payment_sent`). Stamps `balanceAppliedAt = new Date()`, updates `Commission.status = 'PAID'`, `Commission.paidAt = new Date()`, and decrements `AffiliateProfile.balance` by `amount`.
    3. **Atomic Reversal Lock**: Uses Prisma `updateMany` with `where: { id: transferId, balanceRevertedAt: null }` when handling `BALANCE_REVERTED` event (`funds_refunded`). Stamps `balanceRevertedAt = new Date()`, updates `Commission.status = 'FAILED'`, and restores `AffiliateProfile.balance`.
    4. **REDUCER EXCLUSIVITY INVARIANT**: This reducer is the **ONLY** service in the codebase authorized to update `Commission.status = 'PAID'`!
- **Verification:** Unit tests verifying atomic `balanceAppliedAt` lock, atomic `balanceRevertedAt` lock, out-of-order event rejection, and duplicate delivery idempotency.
- **Commit:** `build(wise): add wise-transfer-state.reducer.ts for at-most-once balance transitions`

### File 3/8 — Webhook Queue Processor (BullMQ `@Processor`)

- **TARGET:** `money-service/src/wise/queue/wise-webhook.processor.ts`
- **Kind:** BullMQ Queue Processor (Low dial — money-service's first `@Processor`)
- **Description:** BullMQ processor consuming jobs from `money:wise-webhook` queue.
  - `@Processor('money:wise-webhook')`
  - Injects `WiseTransferStateReducer` and `PrismaService`.
  - Process method: Calls `reducer.reduceTransferEvent(job.data)`.
  - **Graceful Shutdown**: Implements NestJS `OnModuleDestroy` interface and calls `await worker.close()` in `onModuleDestroy()` so SIGTERM drains in-flight jobs without severing connections (`4A-W4` drain policy).
  - Job ID derivation: `jobId = wise:event:<deliveryId>`.
  - Bounded retries: 3 attempts with exponential back-off; routes permanently failed jobs to dead-letter storage.
- **Verification:** Unit tests asserting `jobId` derivation, `onModuleDestroy` worker drain call, and dead-letter routing.
- **Commit:** `build(wise): add wise-webhook.processor.ts BullMQ consumer with shutdown drain`

### File 4/8 — Webhook Receiver Controller (`@SkipThrottle()`)

- **TARGET:** `money-service/src/wise/controllers/wise-webhook.controller.ts`
- **Kind:** REST Controller (`POST /v1/webhooks/wise`, Low dial)
- **Description:** Webhook receiver endpoint accepting inbound Wise HTTP POST notifications.
  - Route: `@Controller('webhooks/wise')` -> `POST /v1/webhooks/wise`
  - Decorator: **`@SkipThrottle()`** (Wise retry bursts must never be rate-limited).
  - Signature Check: Verifies `X-Signature-SHA256` header against raw body using `WiseSignatureVerifier`.
    - If signature invalid: Persists `WiseWebhookEvent` with `signatureVerified = false` (audit log) and throws `UnauthorizedException` (HTTP 401).
  - Test Notification Ping: Detects `X-Test-Notification: true` header -> returns `200 { status: 'ok' }` immediately without database or queue write.
  - Persistence & Dedupe: Upserts `WiseWebhookEvent` by `@unique deliveryId` (`X-Delivery-Id` header). If `deliveryId` already exists, returns `200 { status: 'ok', duplicated: true }` without re-queuing.
  - Queue Enqueue: Enqueues job onto `money:wise-webhook` BullMQ queue with `jobId = wise:event:<deliveryId>`. Returns `200 { status: 'ok' }`.
- **Verification:** Unit tests verifying signature check, `@SkipThrottle()` application, `X-Test-Notification` handling, and `@unique deliveryId` deduplication.
- **Commit:** `build(wise): add wise-webhook.controller.ts with SkipThrottle and RSA verification`

### File 5/8 — Failure & Funding Auxiliary Handlers

- **TARGET:** `money-service/src/wise/services/wise-event-handlers.ts`
- **Kind:** Auxiliary Event Handlers
- **Description:** Specialized handlers for non-transfer webhook events.
  - `handlePayoutFailure(event: WiseWebhookPayload)`: Handles `transfers#payout-failure`. Updates `WiseTransfer.failureReason` and logs alert. **NEVER touches `Commission.status` or `AffiliateProfile.balance`**.
  - `handleBalanceUpdate(event: WiseWebhookPayload)`: Handles `balances#update`. Updates `WiseBatchGroup.fundingDetected = 'MANUAL_DETECTED'`. Best-effort detection only (F37: funding stays `MANUAL`).
- **Verification:** Unit tests asserting zero side effects on commission or balance fields.
- **Commit:** `build(wise): add wise-event-handlers.ts for payout failure and balance updates`

### File 6/8 — Module & App Queue Wiring

- **TARGET:** `money-service/src/wise/wise.module.ts` & `money-service/src/app.module.ts`
- **Kind:** NestJS Module Wiring
- **Description:** Register BullMQ queue and export services.
  - `WiseModule`: Registers `BullModule.registerQueue({ name: 'money:wise-webhook' })`, providers (`WiseStateMapper`, `WiseTransferStateReducer`, `WiseWebhookProcessor`, `WiseEventHandlers`), and controller (`WiseWebhookController`).
  - `app.module.ts` (81 lines -> 82 lines): Import `WiseModule`.
- **Verification:** `npm run build` in `money-service`; `app.module.ts` compiles cleanly with `registerQueue`.
- **Commit:** `build(wise): wire money:wise-webhook BullMQ queue into WiseModule and app.module`

### File 7/8 — State Mapper & Reducer Unit Test Suite

- **TARGET:** `money-service/src/wise/__tests__/wise-state.reducer.spec.ts`
- **Kind:** Unit Test Suite
- **Description:** Complete unit test suite for state mapping and reducer transitions.
  - Test Cases:
    1. `WiseStateMapper` maps all 8 Wise states correctly.
    2. Unknown Wise event state logs warning and returns `NO_ACTION` without throwing.
    3. `outgoing_payment_sent` stamps `balanceAppliedAt`, sets `Commission.status = 'PAID'`, and updates balance.
    4. Duplicate `outgoing_payment_sent` event hits atomic `balanceAppliedAt` lock and executes zero additional balance changes.
    5. Out-of-order event (`processing` with timestamp < `outgoing_payment_sent` timestamp) is skipped with `stale-order` reason.
    6. `funds_refunded` stamps `balanceRevertedAt`, sets `Commission.status = 'FAILED'`, and restores balance.
- **Verification:** `npx jest wise-state.reducer.spec.ts` passes 100%.
- **Commit:** `test(wise): add state mapper and reducer unit test suite`

### File 8/8 — Webhook Replay Test Suite (Sandbox Simulation Payloads)

- **TARGET:** `money-service/src/wise/__tests__/wise-webhook.replay.spec.ts`
- **Kind:** Integration Replay Test Suite
- **Description:** End-to-end replay test suite using real/mocked Wise-signed payloads captured from Wise Sandbox Simulation API.
  - Test Cases:
    1. Valid RSA-signed `processing -> outgoing_payment_sent` payload sequence verifies, enqueues, and reduces correctly.
    2. Tampered signature payload returns HTTP 401 and records `WiseWebhookEvent` with `signatureVerified = false`.
    3. Replayed duplicate `X-Delivery-Id` returns HTTP 200 without duplicate queue job or balance change.
    4. `X-Test-Notification: true` ping returns HTTP 200 without DB write.
- **Verification:** `npx jest wise-webhook.replay.spec.ts` passes 100%.
- **Commit:** `test(wise): add webhook replay test suite with signed sandbox payloads`

---

## Rules specific to this variant

- **PORT Dial (Low)**: Behavior preservation and exact state-machine conformance IS the deliverable. Follow `01-part-19.5-wise-disbursement-architecture-design.md` §5 state table exactly.
- **Verification by REPLAY**: Verification MUST use byte-for-byte replay of real/mocked Wise-signed payloads (not a 48h shadow-run).
- **@SkipThrottle() Decorator**: The webhook controller MUST use `@SkipThrottle()` so Wise webhook retry bursts are never rate-limited.
- **Reducer Exclusivity**: ONLY `wise-transfer-state.reducer.ts` may update `Commission.status = 'PAID'`.

---

## Done when

- [x] Valid RSA-signed sandbox test payload verifies and processes; tampered payload returns 401 and records `signatureVerified=false`. (Hand-constructed RSA keypair per Option 2, not captured from Wise's real Simulation API — see Deviations.)
- [x] Duplicate `X-Delivery-Id` -> 1 row in `WiseWebhookEvent`, 1 queue job, 1 balance mutation.
- [x] Out-of-order replay (`processing` after `outgoing_payment_sent`) -> `skippedReason='stale-order'`, 0 balance regression.
- [x] Happy path (`outgoing_payment_sent`) sets `Commission.status = PAID` and updates balance **exactly once**; replay changes nothing.
- [x] Unhappy path (`funds_refunded`) reverts balance **exactly once**; replay changes nothing. (Reverts to `APPROVED`, not `FAILED` — see Deviations, no such `CommissionStatus` value exists.)
- [x] `transfers#payout-failure` writes failure details and leaves `Commission.status` untouched.
- [x] Unknown event state -> persisted, logged, skipped, 0 throw (returns 200 to Wise).
- [x] `WiseWebhookController` uses an explicit `@Throttle({ default: { ttl: 60_000, limit: 300 } })` (NOT `@SkipThrottle()` — see Deviations); `WiseWebhookProcessor` implements `onModuleDestroy` -> `worker.close()`.
- [x] BullMQ job IDs follow `jobId = wise:event:<deliveryId>`.
- [x] **F40** resolved and recorded in `DECISION-LOG.md` (`WISE_WEBHOOK_SCOPE = 'PROFILE'`).
- [x] Full `money-service` test suite green (`npm run test`) — 33/33 suites, 326/326 tests (was 29/29, 288/288 at 4A-W4's close). Monolith `npx tsc --noEmit` clean (unaffected — no monolith code changed this session).
- [x] `CLAUDE.md`, `DECISION-LOG.md`, `migration-stack-analysis.md` updated.
- [x] Session `4A-W6` order exists at status `PRE-DRAFT`.

---

## Rollback

- Delete sandbox webhook subscription.
- Revert git commits and redeploy `money-service`. No production Wise webhooks are subscribed yet (Safety Gate), so rollback has zero live traffic impact.

---

## Deviations

_(filled DURING execution — what / why / impact.)_

**CONFIRM-time scope change (Davin, live):** the sandbox-funding entry criterion present in the
committed PRE-DRAFT ("a sandbox transfer can be created and funded... if unavailable, stop and
re-plan") was dropped from this APPROVED rewrite. CONFIRM re-raised it because Wise's Simulation
API requires a **funded** transfer before state simulation, and Waiting-on #47 (still OPEN) shows
the current sandbox `WISE_API_TOKEN` is read-only (`POST /v1/accounts` 403s), which likely also
blocks transfer creation/funding. Davin confirmed funding availability is genuinely unknown and
chose **Option 2**: verification downgraded from "real payloads captured from Wise's Simulation
API" to "valid RSA-signed sandbox test payloads, hand-constructed using the same RSA keypair
pattern `wise-signature.verifier.spec.ts` already uses (`generateKeyPairSync` + `jest.mock` the
public-key constants, sign with the matching private key)" — proves the signature-verification
and dedupe/replay code paths genuinely, but does NOT prove Wise's real Simulation API produces
these exact payload shapes. **Impact:** File 8/8's replay suite (below) is a hand-constructed
payload replay test, not a captured-from-Wise-sandbox one. Carrying forward: closing the real gap
(driving Wise's actual Simulation API) needs a write-scoped sandbox token, same ask as #47.

**Throttle correction (mapper/controller fidelity to ground truth, not the order's own prose):**
Hard Invariant #3, "Rules specific to this variant," and "Known wrinkles" all say to use
`@SkipThrottle()` on the webhook route. The design doc's own §7.5 was **corrected 2026-07-25
(rev 2)**, after this order's Hard Invariants were drafted: `@SkipThrottle()` removes the rate
limit ceiling entirely, trading a throttling fault for a flooding fault. The corrected, currently
governing policy (also codified as `LESSONS-LEARNED.md` L26, established one session earlier at
4A-W4) is an explicit generous per-route `@Throttle({ default: { ttl: 60_000, limit: 300 } })`,
identical to `/v1/webhooks/dlocal`'s. Built File 4/8 with `@Throttle()`, not `@SkipThrottle()`,
per the order's own instruction that §5/§8 (and by extension the doc's other still-current
sections) are ground truth over this order's own copy.

**State-mapping table fidelity (File 1/8, File 2/8):** the order's own File 1/8 prose is a
paraphrase of design §5.2 that diverges from the frozen table in several places: (a) `bounced_back`
does not get its own terminal-looking state — per §5.2 it stays `DisbursementTransaction.status =
PROCESSING` with `WiseTransfer.hasActiveIssues = true` and an admin alert, Commission is **left
`PAID`, not reverted** (reverting here would flap the affiliate's balance for a transfer Wise says
may still deliver); (b) `cancelled` is not a pure no-op — §5.2 requires reverting Commission/balance
**if it was already `PAID`**; (c) `charged_back` is entirely absent from the order's File 1 list
despite being a real §5.2 row that "can follow any state"; (d) `incoming_payment_initiated` and the
initial unfunded state are also absent. Built the mapper against the full, real §5.2 table (10
states + unrecognised-fallback), per the order's own "ground truth is §5, not this order's own
prose" framing. The `cancelled`/`charged_back`/`funds_refunded` revert path shares one guarded
reducer method keyed on `WiseTransfer.balanceAppliedAt IS NOT NULL AND balanceRevertedAt IS NULL` —
this is what makes "revert if it was PAID" correct by construction rather than requiring the
mapper to know the transfer's current DB state.

**Schema-fidelity fix (File 2/8):** the order's own File 2/8 text (and File 7/8's test-case #6)
says the reversal path sets `Commission.status = 'FAILED'`. `CommissionStatus` has no `FAILED`
member (`PENDING` / `APPROVED` / `PAID` / `CANCELLED` only — verified against
`money-service/prisma/schema.prisma`); this would have been a Prisma type error. Design §5.2's own
table says the correct target is `revert PAID → APPROVED, clear paidAt` — built against that,
not the order's literal (invalid) text.

**Field-name fix (File 5/8):** the order's own File 5/8 text says `handleBalanceUpdate` updates
`WiseBatchGroup.fundingDetected`. No such field exists — the schema field is `fundingSource`
(enum `WiseFundingSource`, value `MANUAL_DETECTED`). Built against the real field name. Also scoped
`handleBalanceUpdate` to setting `fundingSource` only, **not** transitioning `WiseBatchGroup.status`
to `FUNDED` — design §6.2 step 6 describes both admin-confirm and webhook-detection paths as able
to reach `FUNDED`, but the batch-group/funding-gate services that would make that transition safe
(`BatchManagerService`, `mark-funded` endpoint) are explicitly 4A-W6 scope and don't exist yet in
money-service. Recording a best-effort signal now without an actor able to safely act on it is
correct; flipping a money-workflow gate from this session would be scope creep into 4A-W6's own
job.

**Admin alerting (design §5.2's "alert" requirement for `bounced_back`/`unknown`/unrecognised
states):** money-service has no notification-delivery channel of its own yet — F43 (funding-SLA
alert delivery channel) is still OPEN, due 4A-W6. Implemented "alert" as `logger.error()` (visible
in Railway logs, the interim channel every other anomaly in this codebase already uses) rather than
inventing a new delivery mechanism F43 is explicitly reserved to decide.

---

## Known wrinkles / do-not-touch

- **`lib/api/index.ts`** — known-broken by design until Phase 7. Do not touch.
- **RiseWorks source, schema, and rows** — Archived (F42), never deleted, never renamed.
- **`DISBURSEMENT_PROVIDER` stays `MOCK` in production** — this session builds the webhook receiver, it does not flip the active provider or move money.
- **No production Wise webhook subscription this session** — Safety Gate; a later session (4A-W7) cuts over production webhooks.
- **Use `@SkipThrottle()` on Wise webhook route** — do NOT apply dLocal rate-limiting; Wise retry bursts must pass through without 429 throttling.

---

## Next-session handoff

_(PRE-DRAFT `4a-w6-wise-payout-engine.migration-order.md` at this session's close — variant `PORT`, seeded from `04-rise-to-wise-migration-plan.md` §4 "4A-W6":_

- _Builds the Wise payout engine (quote, transfer, batch-group services) and `isFundable` orchestrator branch in `money-service`._
- _Promotes `WISE_API_TOKEN` to full access._
- _Asserts drafted Wise batches NEVER set `Commission.status = PAID` (reserved for 4A-W5's reducer)._
- _Re-confirms Wise Business Payment Approvals absent._
- _Requires Davin present for payout path code review.)_
