# Migration Order — PORT variant

> For sessions that **build backend services guided by a frozen contract**. Read
> `00-SKELETON-AND-RULES.md` first — §4 applies with the dial at **Low**: behavior preservation
> and exact conformance to the frozen contract IS the deliverable. Ground truth for this session
> is `01-part-19.5-wise-disbursement-architecture-design.md` §3 (provider capability interfaces,
> orchestrator branch, PaymentProvider mapping), §3.5 (known bugs to fix while porting), §6.2–6.5
> (batch payout flow, reconciliation), and `04-rise-to-wise-migration-plan.md` §4 "4A-W6" — NOT
> this order's own prose (see `LESSONS-LEARNED.md` L27: 4A-W5's own order text disagreed with its
> cited ground truth in four separate places; re-read the actual cited sections before writing
> each file, don't implement from this order's paraphrase alone).

**Session:** 4A-W6 · **Variant:** PORT · **Status:** PRE-DRAFT
**Generated:** 2026-07-26 (Executor, at 4A-W5's close) · **Estimated time:** ~4h (plan's own
estimate — this is flagged in the plan itself as the **highest-risk BUILD in Part 19.5**, budget
accordingly)
**Phase / plan section:** Phase 4A — money-service · Part 19.5 (RiseWorks → Wise), session 6 of 9
**Flags touched:** confirms F37 (`WISE_FUNDING_MODE=MANUAL`) in code — no new flag to resolve
**Target service:** money-service (`src/wise/services/*`, `src/wise/providers/*`,
`src/wise/controllers/*`, `src/crons/*`, plus 3 shared-orchestrator files also used by
Rise/Mock)
**Contract:** `part19.5-wise-disbursement-openapi.yaml` (`/wise/batches/*`), design §3
(provider capability interfaces & orchestrator branch), §3.5 (silent empty-string bug), §6.2–6.5
(batch payout flow + reconciliation cron)
**Verification method:** Sandbox E2E (GBP/USD/EUR — THB not exercisable in sandbox, `02-…` §10)
plus unit tests for the funding-gate guards. **This is the session that promotes `WISE_API_TOKEN`
to full access** — the first session in Part 19.5 that can actually create a real (sandbox)
transfer.

---

## Why this session, why now

4A-W5 (CONFIRMED and executed 2026-07-26) built the webhook receiver and state reducer —
`WiseTransferStateReducer` is now the sole authority for `Commission.status = 'PAID'` and balance
mutations, proven by hand-constructed RSA-signed replay tests (real Wise Simulation API capture
still blocked on token scope, see Waiting-on #47). This session builds the OTHER half: the code
that actually **creates** Wise transfers and drafts a payout batch. The reducer built at 4A-W5
must stay the only writer of `Commission.status = 'PAID'` — this session drafts and funds
batches, it must never itself touch `Commission.status` or `AffiliateProfile.balance` (the
REDUCER EXCLUSIVITY INVARIANT from 4A-W5 applies here in reverse: this session is the one thing
that invariant exists to constrain).

---

## Hard Invariants for this Session

1. **`isFundable` branch never writes money state directly.** Wise batches write
   `PENDING`/`PROCESSING` `DisbursementTransaction` rows and **NEVER** set
   `Commission.status = 'PAID'` or touch `AffiliateProfile.balance` — that stays 4A-W5's
   reducer's exclusive job, even after a real transfer is created here.
2. **`customerTransactionId` persisted BEFORE the Wise API call**, not after — an interrupted
   `prepareBatch` retried from the top must reuse the same ID and create **zero** duplicate Wise
   transfers (design's own resumability requirement, `WiseTransfer.customerTransactionId
@unique`).
3. **`fundBatchFromBalance` throws `CapabilityUnavailableError` when `WISE_FUNDING_MODE=MANUAL`**
   — F37 stays `MANUAL` (Thailand region gate); this session must not silently attempt an API
   funding call that Wise will reject.
4. **Every pre-existing orchestrator/aggregator/transaction-service test must still pass
   UNMODIFIED** on the non-Wise (Rise/Mock) branch — that is the parity oracle for this session's
   only genuinely risky edit (adding a branch to already-live shared files). A changed assertion
   needs a written justification (`LESSONS-LEARNED.md` L3), not a silent edit.
5. **`DISBURSEMENT_PROVIDER` stays `MOCK` in production** — this session writes code that CAN
   move real money once cut over, but does not cut over. No real batch is created against
   production this session.

---

## Entry criteria

_(verified at CONFIRM time, not assumed — `EXECUTOR-PROTOCOL.md` §1.3)_

- [ ] **4A-W5 closed CONFIRMED** — re-verify `WiseTransferStateReducer.reduceTransferEvent` is
      live and its atomic `balanceAppliedAt`/`balanceRevertedAt` guards are unchanged.
- [ ] **`WISE_API_TOKEN` promoted to full access** (still sandbox — this is the session that can
      create transfers; verify presence value-blind per L17, never `railway variables --kv`).
- [ ] **Business Payment Approvals confirmed absent** (re-check — 4A-W1's finding, could have
      changed since).
- [ ] **Sandbox balance funded sufficiently for the E2E** — if unavailable, stop and re-plan
      (same class of gate 4A-W5's PRE-DRAFT had and lost at CONFIRM; don't let it drop silently
      again, see `LESSONS-LEARNED.md` L27 and Waiting-on #53).
- [ ] Davin available for the full session — this session writes code that will move real money
      once cut over (`EXECUTOR-PROTOCOL.md` §7: money/payments changes escalate).
- [ ] File inventory below re-verified against live codebase (paths + line counts), INCLUDING the
      three shared files this session edits (`payment-orchestrator.service.ts`,
      `commission-aggregator.service.ts`, `transaction.service.ts`) — these are live,
      already-shipped Rise/Mock code, not new Wise-only files.

**A failed entry criterion means do not start** — propose the fix or the session swap.

---

## Integration points

- **In:** `process-pending-disbursements` cron (already cut over, Slice 1) → orchestrator →
  `isFundable` branch → this session's new Wise services
- **Out:** Wise Platform API (`POST /v3/.../batch-groups`, `/quotes`, `/batch-groups/{id}/transfers`,
  `PATCH .../batch-groups/{id}`)
- **Owns:** `WiseTransfer` (creates, PENDING), `WiseBatchGroup` (creates through
  `AWAITING_MANUAL_FUNDING`/`FUNDED`), admin funding-queue UI. Does **NOT** own
  `Commission.status`/`AffiliateProfile.balance` — that's 4A-W5's reducer, unconditionally.

---

## File Port Order

_(dependency order per the plan's own §4 "4A-W6" step list — pure capability interfaces →
domain services → provider → shared orchestrator branch → aggregator/transaction fix → admin
controller → reconciliation → UI → E2E)_

### File 1 — Provider capability interfaces

- **TARGET:** `money-service/src/wise/providers/provider-capabilities.ts`
- **Kind:** new glue (pure interfaces/types, no I/O)
- **Content:** `FundableProvider`, `RecipientAwareProvider`, `isFundable(provider): provider is
FundableProvider`, `CapabilityUnavailableError`.
- **Invariants:** none behavioral — this is a type-level seam the orchestrator branches on.
- **Parity proof:** unit test asserting `isFundable` narrows correctly for Wise vs Mock vs Rise.

### File 2 — Quote, transfer, and batch-group services

- **TARGET:** `money-service/src/wise/services/wise-quote.service.ts`,
  `wise-transfer.service.ts`, `wise-batch-group.service.ts`
- **Kind:** new glue, guided by the frozen OpenAPI + design §3.2/§6.2
- **Invariants:** `wise-quote.service.ts` applies F38's resolved `sourceAmount`-direction
  decision (platform bears the fee). `wise-transfer.service.ts` persists
  `customerTransactionId` (UUID v4) to `WiseTransfer` **before** calling Wise (Hard Invariant #2)
  — a retry after a mid-call crash must reuse the same row, not create a second one.
  `wise-batch-group.service.ts` implements create/add/complete/cancel plus the funding gate
  (`AWAITING_MANUAL_FUNDING` → `FUNDED`, both the admin-confirm and best-effort-detected paths
  from 4A-W5's `WiseEventHandlers.handleBalanceUpdate` — that handler only ever SET
  `fundingSource`, this session is what's actually allowed to also flip `status`).
- **Parity proof:** unit tests per service; `customerTransactionId` reuse-on-retry test is
  non-negotiable (design's own resumability requirement).

### File 3 — `wise-payment.provider.ts`

- **TARGET:** `money-service/src/wise/providers/wise-payment.provider.ts`
- **Kind:** port + adapt — implements the existing `PaymentProvider` interface (mirrors
  Rise/Mock's own shape) plus `FundableProvider`/`RecipientAwareProvider` from File 1.
- **Invariants:** `fundBatchFromBalance` throws `CapabilityUnavailableError` when
  `WISE_FUNDING_MODE=MANUAL` (Hard Invariant #3) — never silently attempts the API call.
- **Parity proof:** unit test asserting the `CapabilityUnavailableError` throw under `MANUAL`.

### File 4 — `payment-orchestrator.service.ts` — the `isFundable` branch

- **TARGET:** `payment-orchestrator.service.ts` (333 lines at last count, 4A-W1 — RE-VERIFY, this
  file may have drifted; it's shared, live, Rise/Mock-serving code)
- **Kind:** port + adapt (adds a branch to an existing, already-shipped file)
- **Port steps:** add the `isFundable` branch per design §3.4. Wise batches write
  `PENDING`/`PROCESSING` and never touch `Commission.status` or the balance (Hard Invariant #1).
- **Invariants:** **every existing orchestrator test must still pass on the non-fundable branch**
  — that is the parity oracle (Hard Invariant #4). A changed assertion needs a written
  justification (`LESSONS-LEARNED.md` L3) in Deviations, not a silent edit.
- **Parity proof:** full existing orchestrator test suite unmodified + new Wise-branch tests.

### File 5 — `commission-aggregator.service.ts` + the silent empty-string bug fix

- **TARGET:** `commission-aggregator.service.ts` (294 lines at last count — RE-VERIFY),
  `transaction.service.ts` (310 lines at last count — RE-VERIFY)
- **Kind:** port + adapt, plus a real bug fix design §3.5(a) already identified
- **Port steps:** branch eligibility on provider — `AffiliateWiseRecipient.status='ACTIVE'` for
  WISE, existing `AffiliateRiseAccount` KYC path preserved unchanged for RISE. **Fix**:
  `transaction.service.ts` (≈line 80) populates the payee reference from
  `commission.affiliateProfile?.riseAccount?.*`, and `payment-orchestrator.service.ts` (≈line 117) does `affiliateId: txn.affiliateRiseAccount?.affiliateProfileId || ''` — a Wise
  transaction has no Rise account, so both `affiliateId` and `riseId` silently become `''`.
  Resolve the affiliate from `Commission.affiliateProfileId` instead (always present, required
  FK) — behavior-preserving for Rise/Mock, existing tests must still pass unmodified.
- **Invariants:** leave `amountRiseUnits` alone — it is already correctly branched on
  `provider === 'RISE'` (do not touch working code while fixing an adjacent bug).
- **Parity proof:** test asserting a Wise batch's payment requests carry a **non-empty**
  `affiliateId` (this failure mode is silent without the test — design's own words).

### File 6 — `wise-batches.controller.ts`

- **TARGET:** `money-service/src/wise/controllers/wise-batches.controller.ts`
- **Kind:** new glue, per the frozen OpenAPI (`/wise/batches/*`, `AdminGuard`)
- **Content:** prepare, complete, get pay-in details, `POST /v1/wise/batches/{id}/mark-funded`,
  `POST …/fund` (API mode only — will throw `CapabilityUnavailableError` under `MANUAL`), cancel.
- **Invariants:** `mark-funded` is idempotent — a second call is a no-op, not a double-fund.
- **Parity proof:** unit test asserting idempotent `mark-funded`.

### File 7 — Reconciliation cron

- **TARGET:** `money-service/src/crons/wise-reconciliation.service.ts` + cron registration
- **Kind:** new glue, design §6.5
- **Content:** hourly poll of non-terminal `WiseTransfer` rows through the **SAME reducer** built
  at 4A-W5 (as a synthetic event, `deliveryId = "recon:<transferId>:<status>:<isoHour>"` so it
  dedupes naturally); alert when a `AWAITING_MANUAL_FUNDING` batch exceeds
  `WISE_FUNDING_SLA_HOURS` (**the human gate's dead-man switch — required, not optional**, per
  the design doc's own words); surface stuck `WiseWebhookEvent` rows
  (`processed=false AND attemptCount >= max`, 4A-W5's dead-letter surface).
- **Invariants:** same reducer, same guards ⇒ reconciliation can never double-apply a balance —
  this is the whole point of the guards living on the row, not the handler (design §6.5).
- **Parity proof:** test asserting reconciliation of an already-webhook-processed transfer
  changes nothing.

### File 8 — Admin UI

- **TARGET:** monolith admin surface (funding queue card, batch pay-in panel, "Mark funded" with
  evidence capture, per-transfer Wise state + failure code) — exact routes TBD at DRAFT, likely
  mirrors `4A-W3b`'s server-side-proxy pattern.
- **Kind:** UI-BUILD-flavored addition inside an otherwise PORT session — Advisor to confirm at
  DRAFT whether this needs its own follow-up UI-BUILD session instead of folding into 4A-W6.

### File 9 — Sandbox E2E

- **TARGET:** `money-service/src/wise/__tests__/wise-payout.e2e.spec.ts` (or similar — Advisor to
  confirm naming at DRAFT)
- **Content:** recipient → batch of ≥2 → complete → read `payInDetails` → fund in sandbox →
  simulate states → assert `Commission=PAID` and the balance moved exactly once. Then a bounce
  case → assert the revert. **GBP/USD/EUR only** — THB not exercisable in sandbox (`02-…` §10);
  the THB route stays verified only by 4A-W7's real smoke payout.

---

## Rules specific to this variant

- **PORT Dial (Low):** the existing `PaymentProvider` interface, the frozen OpenAPI, and design
  §3/§6 are ground truth — not this order's own paraphrase of them (see the header note and
  `LESSONS-LEARNED.md` L27: re-read the actual cited sections before writing each file).
- Changing a ported test's assertion (Files 4/5's shared orchestrator/aggregator files)
  requires a written justification in Deviations (`LESSONS-LEARNED.md` L3).
- This session ends with `DISBURSEMENT_PROVIDER` still `MOCK` — cutover is 4A-W7's job, not
  this one's.

---

## Done when

- [ ] Sandbox E2E happy path green, asserted at the DB level.
- [ ] Sandbox E2E bounce path green; recipient → `INVALID`; revert exactly once.
- [ ] `prepareBatch` interrupted mid-way and retried creates **no duplicate** Wise transfers
      (proved by `customerTransactionId` reuse).
- [ ] `fundBatchFromBalance` throws `CapabilityUnavailableError` under `MANUAL` (test).
- [ ] `mark-funded` is idempotent (second call is a no-op) (test).
- [ ] SLA alarm fires for a stale `AWAITING_MANUAL_FUNDING` batch (test with an injected clock).
- [ ] Reconciliation of an already-webhook-processed transfer changes nothing (test).
- [ ] A Wise batch's payment requests carry a **non-empty** `affiliateId` (design §3.5(a) fixed)
      — asserted by a test, because this failure mode is silent.
- [ ] All pre-existing orchestrator/aggregator/transaction-service tests still pass, unmodified.
- [ ] `DISBURSEMENT_PROVIDER` still `MOCK` in production; verified value-blind.
- [ ] Full `money-service` test suite green; monolith `tsc --noEmit` clean.
- [ ] `CLAUDE.md`, `DECISION-LOG.md`, `migration-stack-analysis.md` updated.
- [ ] Session `4A-W7` (CUTOVER, real money) order exists at status `PRE-DRAFT`.

---

## Rollback

- Revert + redeploy; provider was never flipped (`DISBURSEMENT_PROVIDER` stays `MOCK`). Any
  sandbox artefacts (batches, transfers) are disposable — no production data touched.

---

## Deviations

_(filled DURING execution — what / why / impact.)_

---

## Known wrinkles / do-not-touch

- **`lib/api/index.ts`** — known-broken by design until Phase 7. Do not touch.
- **RiseWorks source, schema, and rows** — Archived (F42), never deleted, never renamed.
- **`DISBURSEMENT_PROVIDER` stays `MOCK` in production** — this is the highest-risk BUILD in Part
  19.5 (full-access token, real transfer-creation code) but still zero traffic cut over.
- **Files 4/5 are shared, live, already-shipped Rise/Mock code** — this is not new Wise-only
  territory. The parity oracle (existing tests, unmodified) is the safety net; treat any test
  that "needs" its assertion changed as a finding, not a fix (L3).
- **`LESSONS-LEARNED.md` L27** — this order's own text is a paraphrase of the plan's §4 "4A-W6"
  section and design §3/§6; re-read those sections directly before writing each file rather than
  trusting this order's summary alone, per 4A-W5's own experience.

---

## Next-session handoff

_(PRE-DRAFT `4a-w7-wise-cutover.migration-order.md` at this session's close — variant likely
`VERIFY-RETIRE`/CUTOVER hybrid, seeded from `04-rise-to-wise-migration-plan.md` §4 "4A-W7":_

- _**REAL MONEY.** Money-audit prompt first (`SESSION-WALKTHROUGHS.md` Walkthrough F)._
- _Walks through the Wise Developer Hub subscription clicks (production, profile-level per F40),
  then flips `DISBURSEMENT_PROVIDER=WISE`._
- _ONE real payout, smallest amount, to a recipient Davin controls — Davin funds it in the Wise
  app while the Executor watches the logs._
- _Rollback: `DISBURSEMENT_PROVIDER=MOCK` + delete the production webhook subscription._
- _First real proof of the THB route end-to-end (not exercisable in sandbox, `02-…` §10)._)\_
