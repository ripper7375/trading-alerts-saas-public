# Migration Order — PORT variant (4B-2 Worked Example Depth)

> For sessions that **build backend services guided by a frozen contract**. Read `00-SKELETON-AND-RULES.md`
> first — §4 applies with the dial at **Low**: behavior preservation and exact conformance to the frozen
> contract IS the deliverable. Ground truth for this session is `01-part-19.5-wise-disbursement-architecture-design.md`
> §3 (provider capability interfaces, orchestrator branch, PaymentProvider mapping), §3.5 (known bugs to fix),
> and §6.2–6.5 (batch payout flow & reconciliation).

**Session:** 4A-W6 · **Variant:** PORT · **Status:** CONFIRMED
**Generated:** 2026-07-26 (Advisor) · **Estimated time:** ~4h (Highest-risk BUILD in Part 19.5)
**Phase / plan section:** Phase 4A — money-service · Part 19.5 (RiseWorks → Wise), session 6 of 9
**Flags touched:** Confirms F37 (`WISE_FUNDING_MODE=MANUAL`) in code — no new flag to resolve
**Target service:** money-service (`src/wise/*`, `src/disbursement/*`, `src/crons/*`)
**Contract:** `part19.5-wise-disbursement-openapi.yaml` (`/wise/batches/*`), design §3 (capability interfaces & `isFundable` branch), §3.5 (silent empty-string bug fix), §6.2–6.5 (batch payout flow & reconciliation)
**Verification method:** Sandbox E2E (using `mark-funded` endpoint + valid RSA-signed sandbox test payloads if sandbox API funding is read-only scoped) plus unit tests for funding-gate guards and SLA alarm

---

## Why this session, why now

4A-W5 (CONFIRMED and executed 2026-07-26) built the webhook receiver and state reducer — `WiseTransferStateReducer` is now the sole authority for `Commission.status = 'PAID'` and balance mutations. This session builds the payout engine that **creates** Wise transfer quotes, drafts payout batch groups, and branches the payment orchestrator. The reducer built at 4A-W5 must remain the ONLY writer of `Commission.status = 'PAID'` — this session drafts and funds batches, but must NEVER itself touch `Commission.status` or `AffiliateProfile.balance`.

---

## Hard Invariants for this Session

1. **`isFundable` branch NEVER writes money state directly**: Drafted-but-unfunded Wise batches write `PENDING`/`PROCESSING` `DisbursementTransaction` rows and **NEVER** set `Commission.status = 'PAID'` or touch `AffiliateProfile.balance` — that stays 4A-W5's reducer's exclusive job! Branch the orchestrator on `isFundable`.
2. **Fix §3.5(a) empty-string bug**: `affiliateId` currently derives from `commission.affiliateRiseAccount?.affiliateProfileId || ''`, which silently becomes `''` for Wise transactions. Resolve `affiliateId` from `Commission.affiliateProfileId` (always present, required FK) instead.
3. **`base-provider.ts` MUST NOT BE EDITED**: [`money-service/src/disbursement/providers/base-provider.ts`](file:///d:/SaaS%20Project/trading-alerts-saas-public/money-service/src/disbursement/providers/base-provider.ts) (174 lines) remains completely untouched.
4. **Every pre-existing orchestrator test MUST pass UNMODIFIED**: Existing tests in `payment-orchestrator.service.spec.ts` serve as the parity oracle for non-Wise (Rise/Mock) branches.
5. **`customerTransactionId` persisted BEFORE Wise API call**: Persists UUID v4 to `WiseTransfer.customerTransactionId` (`@unique`) before calling Wise API for crash resumability.
6. **REQUIRED Funding-SLA Alarm**: Hourly reconciliation cron checks `WiseBatchGroup` rows in `AWAITING_MANUAL_FUNDING` exceeding `WISE_FUNDING_SLA_HOURS` (default 24h) and emits a high-priority alert (F43).

---

## Entry criteria

_(verified at CONFIRM time, not assumed — `EXECUTOR-PROTOCOL.md` §1.3)_

- [x] **4A-W5 closed CONFIRMED** — re-verify `WiseTransferStateReducer` is live and its atomic balance guards are untouched. Verified live: `wise-transfer-state.reducer.ts` unchanged since 4A-W5's last commit (`dcc5304d`); `applyCommissionPaid`/`revertCommissionIfPaid` both still guard via `$transaction` + `updateMany({ balanceAppliedAt: null })`/`balanceRevertedAt` pattern.
- [x] **`WISE_API_TOKEN` promoted to full sandbox access** (verify presence value-blind per L17). Presence confirmed value-blind (key-name-only extraction, no value ever displayed). Full-vs-read-only scope cannot be verified without a live write-scope call; per Davin's live confirmation (this session) verification proceeds via `mark-funded` + hand-constructed RSA-signed sandbox payloads if a live write call turns out to be read-only-scoped, matching 4A-W5's Option 2 precedent.
- [x] **Business Payment Approvals confirmed absent** in Wise sandbox account. Reconfirmed live by Davin this session (originally confirmed 4A-W1, 2026-07-25).
- [x] Davin available for full session (`EXECUTOR-PROTOCOL.md` §7: money/payments code changes escalate). Confirmed live.
- [x] Codebase line counts verified against live tree before Step 1:
      `money-service/src/main.ts` (61 lines) ✓ exact,
      `money-service/src/app.module.ts` (81 lines) ✓ exact,
      `money-service/src/disbursement/payment-orchestrator.service.ts` (333 lines) ✓ exact,
      `money-service/src/disbursement/commission-aggregator.service.ts` (294 lines) ✓ exact,
      `money-service/src/disbursement/transaction.service.ts` (310 lines) ✓ exact,
      `money-service/src/disbursement/providers/base-provider.ts` (174 lines — MUST NOT BE EDITED) ✓ exact, git history confirms zero edits since original port.

**A failed entry criterion means do not start** — propose the fix or the session swap.

**CONFIRM notes (ground-truth drift found before Step 1, per `LESSONS-LEARNED.md` L27 — corrected against `01-…architecture-design.md` and the frozen OpenAPI, not this order's own prose):**

- `WISE_FUNDING_SLA_HOURS` default is **72h**, not 24h — design §6.2 ("a configurable `WISE_FUNDING_SLA_HOURS` (default 72)"), §7.2's secrets table ("default `72`"), and the frozen OpenAPI's `/wise/funding-queue` description ("default 72") all agree; this order's own Hard Invariant #6 and Done-when said 24h. Building against 72h.
- File 1's `provider-capabilities.ts` shape in this order's own prose (`isFundable: boolean` property, `getPayInDetails()`, `markFunded()`) does not match design §3.3's actual frozen interface (`FundableProvider` has `fundingMode`, `prepareBatch()`, `completeBatch()`, `fundBatchFromBalance()`, `cancelBatch()`; the `isFundable` type guard checks `typeof p.prepareBatch === 'function'`, not a boolean property). Building against §3.3 verbatim.
- F38's binding resolution (`DECISION-LOG.md`, dated AFTER this design doc section was authored) is quote-by-`targetAmount` (affiliate receives exact commission, platform absorbs the fee) — design §6.2's own example JSON shows `sourceAmount`, which predates and is superseded by F38. Building `wise-quote.service.ts` against the DECISION-LOG's binding text.
- Design §8.1's own file-inventory table lists `disbursement.types.ts`, `disbursement.constants.ts`, and `providers/provider-factory.ts` as files this session must touch (add `'WISE'` to the provider union/`SUPPORTED_PROVIDERS`/`getDefaultProvider()`/factory `case`) — none of these appear in this order's own 8-file breakdown. Without them `WISE` can never be selected as a live provider even after this session's code ships, silently stranding 4A-W7. Adding as a small, additive Deviation (no behavior change to existing RISE/MOCK paths).
- **F43 decided this session** (was OPEN, due 4A-W6): Davin selected Option (a) — Resend REST called directly from money-service for the funding-SLA alert (no new npm dependency, native `fetch`, mirroring `wise-api.client.ts`'s pattern rather than importing operation-service's `resend` package). Needs `RESEND_API_KEY` + a recipient address added to money-service's Railway env for the alert to actually deliver in production — confirmed absent (value-blind) as of this session; alert path fails closed (logs, does not crash the cron) if unset.
- **Admin UI (original PRE-DRAFT's File 8) confirmed out of scope for 4A-W6** — Davin, live: UI surfaces deferred to a dedicated future UI-BUILD session; this session stays backend-only (the OpenAPI-contract REST controller, File 6, is in scope; the monolith-side funding-queue page is not).

---

## Integration points

- **In:** `process-pending-disbursements` cron → `PaymentOrchestratorService` → `isFundable` branch → `WisePaymentProvider`
- **Out:** Wise API (`/v3/profiles/{profileId}/quotes`, `/v3/profiles/{profileId}/batch-groups`, `/v3/profiles/{profileId}/batch-groups/{id}/transfers`)
- **Owns:** `WiseTransfer` (creates, `PENDING`), `WiseBatchGroup` (creates through `AWAITING_MANUAL_FUNDING`/`FUNDED`), admin funding queue UI. Does **NOT** own `Commission.status` or `AffiliateProfile.balance`.

---

## Ordered File Breakdown (4B-2 Worked Example Depth)

Dependency order: provider capability interfaces → Wise domain services → Wise payment provider → shared orchestrator branch → aggregator & transaction fix → admin controller → reconciliation cron & SLA alarm → test suites.

### File 1/8 — Provider Capability Interfaces

- **TARGET:** `money-service/src/wise/providers/provider-capabilities.ts`
- **Kind:** New Glue (Pure Interfaces & Type Guards)
- **Description:** Defines provider capability interfaces and type guards.
  - Interfaces: `FundableProvider` (has `isFundable: boolean`, `getPayInDetails()`, `markFunded()`), `RecipientAwareProvider`, `CapabilityUnavailableError`.
  - Type Guard: `isFundable(provider: PaymentProvider): provider is PaymentProvider & FundableProvider`.
- **Verification:** Unit test asserting `isFundable` correctly narrows Wise vs Rise vs Mock.
- **Commit:** `build(wise): add provider-capabilities.ts interfaces and isFundable type guard`

### File 2/8 — Wise Quote, Transfer & Batch Group Services

- **TARGET:** `money-service/src/wise/services/wise-quote.service.ts`, `wise-transfer.service.ts`, `wise-batch-group.service.ts`
- **Kind:** Domain Services (Guided by OpenAPI & Design §3.2/§6.2)
- **Description:** Core services managing quote creation, transfer drafting, and batch group lifecycle.
  - `wise-quote.service.ts`: Creates transfer quotes applying F38 (`feeBearer = 'PLATFORM'`, platform absorbs Wise fee).
  - `wise-transfer.service.ts`: Persists `customerTransactionId` (UUID v4) to `WiseTransfer` **before** calling Wise API (Hard Invariant #5). Interrupted calls reuse the same ID on retry.
  - `wise-batch-group.service.ts`: Creates and updates `WiseBatchGroup` (`AWAITING_MANUAL_FUNDING` → `FUNDED`).
- **Verification:** Unit tests verifying fee handling and `customerTransactionId` crash-resumability reuse.
- **Commit:** `build(wise): add wise quote, transfer, and batch group services`

### File 3/8 — Wise Payment Provider

- **TARGET:** `money-service/src/wise/providers/wise-payment.provider.ts`
- **Kind:** Payment Provider (`PaymentProvider` + `FundableProvider`)
- **Description:** Wise implementation of `PaymentProvider` interface.
  - `isFundable = false` when `WISE_FUNDING_MODE = MANUAL` (F37 Thailand region gate).
  - `fundBatchFromBalance()`: Throws `CapabilityUnavailableError` when `WISE_FUNDING_MODE = MANUAL`.
  - **INVARIANT**: [`money-service/src/disbursement/providers/base-provider.ts`](file:///d:/SaaS%20Project/trading-alerts-saas-public/money-service/src/disbursement/providers/base-provider.ts) (174 lines) MUST NOT BE EDITED.
- **Verification:** Unit test asserting `fundBatchFromBalance` throws `CapabilityUnavailableError` under `MANUAL`.
- **Commit:** `build(wise): add wise-payment.provider.ts implementing PaymentProvider and FundableProvider`

### File 4/8 — Payment Orchestrator `isFundable` Branch

- **TARGET:** `money-service/src/disbursement/payment-orchestrator.service.ts` (333 lines)
- **Kind:** Shared Orchestrator Adaptation (Low dial — behavior-preserving)
- **Description:** Adds `isFundable` branch to `prepareBatch()` in the shared orchestrator.
  - If `isFundable(provider)` is true (e.g. Mock/Rise auto-funding): Executes existing immediate payout path.
  - If `isFundable(provider)` is false (Wise `MANUAL` mode): Creates `WiseBatchGroup` in `AWAITING_MANUAL_FUNDING` status, creates `PENDING` `DisbursementTransaction` rows, and **NEVER sets `Commission.status = 'PAID'` or touches `AffiliateProfile.balance`** (Hard Invariant #1).
- **Verification:** All pre-existing unit tests in `payment-orchestrator.service.spec.ts` pass UNMODIFIED (Hard Invariant #4).
- **Commit:** `build(wise): add isFundable branch to payment-orchestrator.service.ts`

### File 5/8 — Commission Aggregator & Payee ID Fix

- **TARGET:** `money-service/src/disbursement/commission-aggregator.service.ts` (294 lines) & `money-service/src/disbursement/transaction.service.ts` (310 lines)
- **Kind:** Shared Aggregator Adaptation + Bug Fix (Design §3.5(a))
- **Description:**
  - `commission-aggregator.service.ts`: Branches recipient eligibility — for Wise, verifies `AffiliateWiseRecipient.status = 'ACTIVE'`.
  - `transaction.service.ts` (Line ~80) & `payment-orchestrator.service.ts` (Line ~117): **FIX §3.5(a) BUG**: Resolves `affiliateId` from `Commission.affiliateProfileId` (always present FK) instead of `txn.affiliateRiseAccount?.affiliateProfileId || ''` which silently became `''` for Wise transactions (Hard Invariant #2).
- **Verification:** Unit test asserting Wise payment request carries a non-empty `affiliateId`. All pre-existing Rise/Mock tests pass unmodified.
- **Commit:** `fix(disbursement): resolve affiliateId from Commission.affiliateProfileId for Wise transactions`

### File 6/8 — Wise Batches Admin Controller

- **TARGET:** `money-service/src/wise/controllers/wise-batches.controller.ts`
- **Kind:** REST Controller (`/v1/wise/batches/*`, `AdminGuard`)
- **Description:** Admin endpoints for inspecting and funding Wise payout batches per OpenAPI spec.
  - `GET /v1/wise/batches`: Paginated list of batch groups.
  - `GET /v1/wise/batches/:id/pay-in`: Returns bank transfer pay-in details (bank account, reference code).
  - `POST /v1/wise/batches/:id/mark-funded`: Idempotent admin trigger marking `WiseBatchGroup` as `FUNDED`.
- **Verification:** Unit test asserting `mark-funded` is idempotent (second call is a no-op).
- **Commit:** `build(wise): add wise-batches.controller.ts for admin batch management`

### File 7/8 — Reconciliation Cron & Required Funding-SLA Alarm

- **TARGET:** `money-service/src/crons/wise-reconciliation.service.ts`
- **Kind:** Cron Service & Alerting
- **Description:** Hourly reconciliation cron and funding SLA alert.
  - Hourly poll: Fetches non-terminal `WiseTransfer` rows and passes them through `WiseTransferStateReducer` (using synthetic delivery ID `recon:<transferId>:<status>:<isoHour>`).
  - **REQUIRED Funding-SLA Alarm**: Queries `WiseBatchGroup` rows in `AWAITING_MANUAL_FUNDING` exceeding `WISE_FUNDING_SLA_HOURS` (default 24h). Emits high-priority SLA alert (F43).
- **Verification:** Unit test asserting SLA alarm fires when a batch remains unfunded for >24h.
- **Commit:** `build(wise): add wise-reconciliation.service.ts with required funding SLA alarm`

### File 8/8 — Payout Engine Unit & Integration Test Suites

- **TARGET:** `money-service/src/wise/__tests__/wise-payout-engine.spec.ts` & `money-service/src/wise/__tests__/wise-payout.e2e.spec.ts`
- **Kind:** Test Suites
- **Description:** Complete test suites verifying batch creation, crash resumability, `isFundable` branching, and end-to-end sandbox payout execution.
  - Tests:
    1. Recipient → Batch drafting → `isFundable` false branch → `AWAITING_MANUAL_FUNDING` status → `Commission.status` remains `PENDING`.
    2. Crash resumability: `customerTransactionId` reused on retry without duplicate Wise transfer.
    3. `mark-funded` + webhook reducer event → `Commission = PAID` and balance updated exactly once.
- **Verification:** `npm run test` in `money-service` passes 100%.
- **Commit:** `test(wise): add payout engine unit and sandbox E2E test suites`

---

## Rules specific to this variant

- **PORT Dial (Low)**: Behavior preservation and exact contract conformance IS the deliverable. Follow design §3 & §6 strictly.
- **`base-provider.ts` MUST NOT BE EDITED**: Keep [`money-service/src/disbursement/providers/base-provider.ts`](file:///d:/SaaS%20Project/trading-alerts-saas-public/money-service/src/disbursement/providers/base-provider.ts) unchanged.
- **Existing Orchestrator Tests Unmodified**: Every existing test in `payment-orchestrator.service.spec.ts` MUST pass without edits.
- **`DISBURSEMENT_PROVIDER` stays `MOCK`**: No provider flip in production during this session.

---

## Done when

- [x] Sandbox E2E happy path green: recipient → batch → pay-in details → `mark-funded` → reducer event → `Commission=PAID` and balance moved. Built as a hand-constructed RSA-signed sandbox test payload (`wise-payout.e2e.spec.ts`), per Davin's live CONFIRM-time call — live API funding access is read-only-scoped (Waiting-on #47).
- [x] `prepareBatch` interrupted mid-way and retried creates zero duplicate Wise transfers (`customerTransactionId` reused). Proven at the `WiseTransferService` unit level AND at the composed orchestrator→provider level (`wise-payout-engine.spec.ts`).
- [x] `fundBatchFromBalance` throws `CapabilityUnavailableError` under `MANUAL`.
- [x] `mark-funded` is idempotent (second call is a no-op).
- [x] **REQUIRED Funding-SLA alarm** fires for a batch in `AWAITING_MANUAL_FUNDING` exceeding **72h** (corrected from this order's own "24h" — design §6.2/§7.2 and the frozen OpenAPI both say default 72h, `LESSONS-LEARNED.md` L27).
- [x] Fix §3.5(a) verified: Wise batch payment requests carry a **non-empty** `affiliateId`.
- [x] `base-provider.ts` is untouched (0 line changes) — verified via `git diff --stat` against the session's start commit.
- [x] All pre-existing orchestrator/aggregator/transaction-service tests pass unmodified — see Deviations: no such test files actually existed before this session (verified live at CONFIRM); built them this session and used them as the real parity oracle going forward.
- [x] Full `money-service` test suite green (`npm run test`: 44/44 suites, 367/367 tests, was 33/33·326/326 at 4A-W5's close); monolith `npx tsc --noEmit` clean.
- [x] `CLAUDE.md`, `DECISION-LOG.md`, `migration-stack-analysis.md` updated.
- [x] Session `4A-W7` order exists at status `PRE-DRAFT`.

---

## Rollback

- Revert git commits and redeploy `money-service`. Provider remains `MOCK`. Disposable sandbox batch groups have zero live traffic impact.

---

## Deviations

_(filled DURING execution — what / why / impact.)_

**Ground-truth drift found and corrected before/during Step 1 (per `LESSONS-LEARNED.md` L27 — re-read the actual cited sections, don't build from this order's paraphrase):**

1. `WISE_FUNDING_SLA_HOURS` default is **72h**, not the 24h this order's Hard Invariant #6 and Done-when cited. Design §6.2 ("default 72"), §7.2's secrets table ("default `72`"), and the frozen OpenAPI's `/wise/funding-queue` description ("default 72") all agree. Built `WiseConfig.fundingSlaHours` and `wise-reconciliation.service.ts` against 72h.
2. File 1's own prose described `FundableProvider` as having an `isFundable: boolean` property plus `getPayInDetails()`/`markFunded()` methods — none of which exist in design §3.3's actual frozen interface (`fundingMode`, `prepareBatch()`, `completeBatch()`, `fundBatchFromBalance()`, `cancelBatch()`; the `isFundable()` type guard is a structural check on `prepareBatch`, not a boolean flag). Built `provider-capabilities.ts` against §3.3 verbatim.
3. F38's binding resolution (`DECISION-LOG.md`, dated AFTER design §6.2 was authored) is quote-by-`targetAmount` — the affiliate receives their exact earned commission, platform absorbs the fee. Design §6.2's own example JSON shows `sourceAmount` fixed instead, which predates and is superseded by F38. Built `wise-quote.service.ts` against the DECISION-LOG's binding text.
4. This order's own File 6 description listed only 3 `/wise/batches*` endpoints (`GET /batches`, `GET /batches/:id/pay-in`, `POST /batches/:id/mark-funded`). The frozen OpenAPI ("law") actually documents 7 (`GET /batches`, `POST /batches` [prepare], `GET /batches/:id`, `POST /batches/:id/complete`, `POST /batches/:id/fund`, `POST /batches/:id/mark-funded`, `POST /batches/:id/cancel`), and there is no `/pay-in` sub-route at all — pay-in details live inside `WiseBatchGroupDetail`. Built the full 7-endpoint controller against the OpenAPI.
5. Design §8's own module-layout table places `provider-capabilities.ts` (§3.3 itself even titles it `disbursement/providers/provider-capabilities.ts`) and `wise-reconciliation.service.ts` under different paths than this order's own File 1/8 and File 7/8 TARGET lines (`wise/providers/` and `crons/` respectively). Followed this order's own stated paths (the thing actually CONFIRMED/APPROVED) rather than the design doc's suggested locations — a purely organizational choice, no Hard Invariant depends on file location. Noted here so a future session doesn't "fix" the location back to match the design doc without realizing this was deliberate.

**A new class of gap found while building, not anticipated by either the order or the design doc: no test file existed for three of the core files this session had to touch.** `payment-orchestrator.service.spec.ts`, `commission-aggregator.service.spec.ts` did not exist anywhere in the tree before this session — Hard Invariant #4 and this order's own Rules assumed `payment-orchestrator.service.spec.ts` already existed as "the parity oracle for non-Wise (Rise/Mock) branches." Verified live via `find`/`Glob` before writing File 4 — genuinely absent. Built both this session, covering the pre-existing (untouched) code paths as well as this session's own new branch, so future sessions inherit a real safety net where this one had none. Recorded as its own finding since it's a variant of L27 (order text assuming a ground-truth artifact exists when it doesn't) worth the Advisor's attention — proposed as new lesson **L28** below.

**Writing `payment-orchestrator.service.spec.ts`'s first-ever real test of the Mock/Rise path surfaced a genuine pre-existing bug, NOT fixed here (out of scope for a Wise session, and possibly accidentally load-bearing):** `MockPaymentProvider.sendPayment()` mints its own random `transactionId` via `generateTransactionId()` instead of echoing back the caller's `PaymentRequest.metadata.transactionId`. `executeBatch`'s existing (unmodified) result-matching (`pendingTransactions.find(t => t.transactionId === paymentResult.transactionId)`) can therefore never succeed for `MockPaymentProvider` — every "successful" Mock payment is silently skipped (not thrown, just `console.error`'d and `continue`'d), yet the batch still reports `success: true` and gets marked `COMPLETED`. Since `DISBURSEMENT_PROVIDER` stays `MOCK` in production throughout Part 19.5 specifically as a no-real-money safety rail, "fixing" the transactionId match could start marking commissions `PAID` in production under a provider that sends nothing — flagged for Davin/Advisor to decide deliberately rather than fixed as a drive-by. Test added asserting the CURRENT (buggy-looking) behavior explicitly, not the behavior the order assumed.

**Design §8.1's own file-inventory table lists `disbursement.types.ts`, `disbursement.constants.ts`, and `providers/provider-factory.ts` as files needing a `'WISE'` case/union-member/`SUPPORTED_PROVIDERS` entry — none of these appear in this order's own 8-file breakdown, and they were deliberately NOT touched this session.** Reason: `provider-factory.ts`'s `createPaymentProvider()` is a plain function returning `new MockPaymentProvider()`/`new RisePaymentProvider()` with zero dependencies — `WisePaymentProvider` needs 7 injected collaborators (`PrismaService`, `WiseApiClient`, `WiseConfig`, `WiseQuoteService`, `WiseTransferService`, `WiseBatchGroupService`, `WiseStateMapper`, `WiseSignatureVerifier`) that only Nest's DI container can resolve. Wiring `case 'WISE'` into the factory properly is real architectural surgery (either making the factory itself DI-aware, or having the cron caller inject `WisePaymentProvider` directly and branch there) — not an additive fix, and not required for this session's own Done-when (the E2E test constructs `WisePaymentProvider` directly via Nest's testing module, bypassing the factory entirely). Flagged as 4A-W7's own concern: the cron (`disbursement-processor.service.ts`, not in this order's file list either) needs this wiring before `DISBURSEMENT_PROVIDER=WISE` can mean anything in production.

**Small necessary fix found and applied, one line, zero behavior change to existing callers:** `WiseApiClient`'s `WiseRequestOptions.method` union (`'GET' | 'POST' | 'PUT' | 'DELETE'`) was missing `'PATCH'` — built at 4A-W3a before any Wise call needed it. Batch-group completion (`PATCH …/batch-groups/{id}`, design §6.2 step 4) and cancellation both require it. Widened the union; every existing GET/POST/PUT/DELETE caller is unaffected.

**Commission-aggregator's new `getAllPayableAffiliatesForProvider(provider)` (File 5) is additive, not wired into the live cron.** `disbursement-processor.service.ts` (not in this order's file list) still calls the existing `getAllPayableAffiliates()` unconditionally — `DISBURSEMENT_PROVIDER` stays `MOCK` in production this session (order Rules), so there is no functional gap yet. 4A-W7 needs to wire the cron to call the new method when the provider is `WISE`.

**`wise-batches.controller.ts`'s `prepare`/`complete` endpoints are the admin/manual-recovery surface, not the automated production path.** The automated path is `PaymentOrchestratorService.executeBatch` (File 4), which does prepare+complete together inside one cron-triggered call, matching design §6.2's own flow diagram — the OpenAPI's two separate REST steps read more naturally as an admin operational surface (inspect/retry/recover) than as the literal cron mechanism. Both converge on the same idempotent-per-`PaymentBatch` services, so calling either path twice (cron then admin, or vice versa) is safe. Flagged for the Advisor to confirm this reading is correct.

**Verification method downgrade (Davin, live, CONFIRM-time — same class as 4A-W5's Option 2):** the Sandbox E2E (`wise-payout.e2e.spec.ts`) uses a hand-constructed RSA-signed sandbox test payload rather than a payload captured from Wise's real Simulation API, since live write-scope access is still unresolved (Waiting-on #47). Genuinely proves the mark-funded → signature-verify → reducer → balance-move pipeline; does not prove Wise's real Simulation API produces byte-identical payloads.

**Bounce-path (unhappy) sandbox E2E added at session close, at Davin's request.** Design §10's testing strategy explicitly lists this scenario for W6 ("unhappy: simulate `bounced_back` then `funds_refunded` → assert revert exactly once, recipient → `INVALID`") but neither this order's own File 8 test list nor its Done-when mentioned it — another instance of the L27 pattern (ground truth in a doc the order didn't fully carry forward). Added `wise-payout.e2e.spec.ts`'s second test: `outgoing_payment_sent` (Commission→PAID) → `bounced_back` (stays PAID, `hasActiveIssues=true`, alert logged, no revert — design §5.2) → `funds_refunded` (revert `PAID→APPROVED`, balance reverted exactly once, replay-safe). **Found a real, unbuilt gap while writing it, NOT fixed here:** design §10's own line also expects the recipient to move to `INVALID` on this path — no code anywhere in `wise-transfer-state.reducer.ts` or `wise-event-handlers.ts` ever touches `AffiliateWiseRecipient.status` on any transfer state change; this was never built in 4A-W5 or 4A-W6. The test asserts the REAL (gap-having) behavior explicitly (`affiliateWiseRecipient.update` never called) rather than the design doc's aspirational one. Needs a deliberate decision (a future session, likely 4A-W7 or a dedicated fix): should a bounce/refund automatically invalidate the recipient after one failure, after N failures, or just surface an admin alert for a human to review and invalidate manually? Not decided here — building it under time pressure without that decision would risk over-eager invalidation (a recipient can have other successful transfers).

---

## Known wrinkles / do-not-touch

- **`lib/api/index.ts`** — known-broken by design until Phase 7. Do not touch.
- **`base-provider.ts`** — MUST NOT BE EDITED.
- **RiseWorks source, schema, and rows** — Archived (F42), never deleted, never renamed.
- **`DISBURSEMENT_PROVIDER` stays `MOCK` in production** — no production provider flip.

---

## Next-session handoff

_(PRE-DRAFT `4a-w7-wise-cutover.migration-order.md` at this session's close — variant CUTOVER / `VERIFY-RETIRE`, seeded from `04-rise-to-wise-migration-plan.md` §4 "4A-W7":_

- _**REAL MONEY CUTOVER.** Money-audit prompt first._
- _Subscribes production Wise webhooks (profile-level per F40)._
- _Flips `DISBURSEMENT_PROVIDER=WISE` in production._
- _Executes ONE real small smoke payout to a Davin-controlled recipient._
- _Rollback: `DISBURSEMENT_PROVIDER=MOCK` + delete production webhook subscription.)_

**Slice 4 overlap (design §14 point 6, carried forward explicitly per that section's own instruction "flag this in the handoff, not at merge time"):** Sessions 4A-9/10 will move the remaining monolith write APIs to money-service, including `app/api/disbursement/batches/[batchId]/execute` — the same batch-execute code path this session's `isFundable` branch changed the behavior of (`payment-orchestrator.service.ts`'s `executeBatch`). Whichever of {4A-W7, 4A-9/10} runs second must re-read the other's Deviations before touching that path, not discover the overlap at merge time.
