# Migration Order — VERIFY-RETIRE variant (CUTOVER Block + Provider Factory Wiring)

> For **cutovers, deletions, and exit reviews**. Read `00-SKELETON-AND-RULES.md` first — §4
> applies with the dial at **near zero**: checklists exist to be obeyed.
>
> **⚠️ REAL MONEY CUTOVER. Money-audit prompt first (`EXECUTOR-PROTOCOL.md` §7). Davin must be present for every step.**

**Session:** 4A-W7 · **Variant:** VERIFY-RETIRE (CUTOVER block) · **Status:** CONFIRMED
**Generated:** 2026-07-26 (Advisor) · **Estimated time:** ~1–2h
**Phase / plan section:** Phase 4A — money-service · Part 19.5 (RiseWorks → Wise), session 7 of 9
**Target service:** money-service (`src/disbursement/providers/provider-factory.ts`, `src/disbursement/disbursement.constants.ts`, Railway environment configuration)
**Contract:** `04-rise-to-wise-migration-plan.md` §4 "4A-W7" and `03-riseworks-archive-and-restore-runbook.md` (Archive switches A1–A3)

---

## Why this session, why now

Session 4A-W6 built, tested, and verified the Wise payout engine in sandbox (all 44 test suites green). This session executes the live production cutover: wiring `WisePaymentProvider` into `provider-factory.ts` so `DISBURSEMENT_PROVIDER=WISE` constructs the real provider, subscribing production webhooks, flipping `DISBURSEMENT_PROVIDER=MOCK → WISE` in production, executing a single small smoke payout, and applying archive switches A1–A3 for RiseWorks.

---

## Scope Discipline & Grounded Line Counts

- **Pre-Cutover Provider Wiring (File Step)**: Wire `case 'WISE':` into `provider-factory.ts` and `disbursement.constants.ts` before flipping env var to ensure `getDefaultProvider()` constructs `WisePaymentProvider` cleanly.
- **Line Counts Verified Against Live Tree**:
  - `money-service/src/disbursement/providers/provider-factory.ts`: **105 lines**
  - `money-service/src/disbursement/disbursement.constants.ts`: **162 lines**
  - `money-service/src/main.ts`: **61 lines**

---

## Entry criteria

_(verified at CONFIRM time, not assumed — `EXECUTOR-PROTOCOL.md` §1.3)_

- [ ] **4A-W6 closed CONFIRMED** — verified 44/44 test suites green, payout engine & reconciliation cron live.
- [ ] `WISE_*` production environment variables set on Railway (value-blind verified per L17) and `WISE_ENV=production`.
- [ ] `WISE_API_TOKEN` promoted to **full production access** (production API token).
- [ ] **At least one real affiliate has an `ACTIVE` Wise recipient** (ideally one Davin controls) for the smoke payout.
- [ ] Production Wise account balance funded with at least the smoke amount (Davin funds manually in Wise app — F36/F37 Model A).
- [ ] **Business Payment Approvals confirmed absent** on the production Wise account (third and final check).
- [ ] `RESEND_API_KEY` + `WISE_FUNDING_ALERT_EMAIL` set on `money-service` (F43 funding-SLA alarm delivery channel).
- [ ] **Davin present live for every step** (`EXECUTOR-PROTOCOL.md` §7). Rollback ritual answered before Step 3.

**A failed entry criterion means do not start** — propose the fix or the session swap.

---

## Integration points

- **In:** Railway environment configuration (`DISBURSEMENT_PROVIDER=WISE`)
- **Out:** Live Wise Production API (`https://api.wise.com`) + Production Webhook Subscriptions (`https://money-service-production.up.railway.app/v1/webhooks/wise`)
- **Owns:** Production disbursement provider selection and live webhook subscription

---

## Ordered Steps

### Step 1 — Wire `WisePaymentProvider` into Provider Factory (Code Edit)

- **TARGET:** `money-service/src/disbursement/disbursement.constants.ts` (162 lines) & `money-service/src/disbursement/providers/provider-factory.ts` (105 lines)
- **Kind:** Provider Wiring (Resolves Entry Criterion 0)
- **Changes:**
  1. In `disbursement.constants.ts`: Add `'WISE'` to `SUPPORTED_PROVIDERS` array and handle `envProvider === 'WISE'` in `getDefaultProvider()`.
  2. In `provider-factory.ts`: Add `case 'WISE':` to `createPaymentProvider()` returning `WisePaymentProvider` instance.
- **Verification:** Unit test asserting `createPaymentProvider('WISE')` returns `WisePaymentProvider` instance.
- **Commit:** `build(wise): wire WisePaymentProvider into provider factory and constants`

### Step 2 — Verify Sandbox Evidence & Davin Approval (Checklist Step 1–2)

- Present 4A-W6 sandbox test evidence (44/44 green) and state-mapping table.
- Davin confirms live approval to proceed with production cutover.

### Step 3 — Subscribe Production Webhooks (Checklist Step 3)

- Subscribe production webhooks on Wise Developer Dashboard (`transfers#state-change`, `transfers#payout-failure`, `balances#update`, schema `4.0.0`, profile-level per F40) pointing to `https://money-service-production.up.railway.app/v1/webhooks/wise`.
- Confirm auto-sent test notification event arrives in Railway logs and returns HTTP 200 (`X-Test-Notification: true`).

### Step 4 — Environment Flip to Production Wise (Checklist Step 4)

- Flip `DISBURSEMENT_PROVIDER=MOCK → WISE` in Railway production environment variables.
- Deploy / trigger Railway build.
- Verify `getDefaultProvider()` returns `'WISE'` and `WisePaymentProvider` is constructed on startup.

### Step 5 — Smoke Payout (ONE Affiliate, Smallest Viable Amount) (Checklist Step 5)

- Prepare payout batch for ONE affiliate with smallest viable amount (e.g. $5.00 / $50.00).
- Complete batch → read pay-in details → Davin funds manually in Wise app.
- Observe `transfers#state-change` webhook land in Railway logs.
- Confirm `Commission.status = PAID` and affiliate balance updated **exactly once**.
- ⚠️ **Do not batch multiple affiliates on the first run.**

### Step 6 — Verify Provider Switch A3 (Checklist Step 6)

- Confirm `DISBURSEMENT_PROVIDER=WISE` is active.
- Verify `POST /v1/webhooks/riseworks` returns HTTP 404 or inactive provider response.
- Archive switches A1 and A2 (unregistering `RiseworksModule` & `ALLOW_ARCHIVED_PROVIDERS` code changes) stay reserved for **Session 4A-W8** per Runbook Rev 2.
- Commit: `docs(cutover): confirm wise cutover provider switch A3 active`

### Step 7 — Funding Cycle Monitoring & Documentation (Checklist Step 7–8)

- Monitor error rate, webhook backlog, and verify zero duplicate `Commission.paidAt` writes.
- Record cutover entry in `docs/migration-orders/replace-rise-with-wise/migration-cutover-table.md` (new Slice 2W row).
- Update `CLAUDE.md`, `DECISION-LOG.md`, `migration-stack-analysis.md`.
- PRE-DRAFT Session `4A-W8` (`4a-w8-riseworks-archive.migration-order.md`).

---

## Rules specific to this variant

- **Checklist Invariant**: Checklists exist to be obeyed verbatim. Any red result = stop and document immediately.
- **Single Smoke Payout**: Never batch multiple affiliates on the initial smoke payout run.

---

## Done when

- [ ] `provider-factory.ts` wired for `WISE` and unit tested.
- [ ] Production Wise webhooks subscribed; test notification returns 200.
- [ ] `DISBURSEMENT_PROVIDER=WISE` set on Railway production.
- [ ] Single affiliate smoke payout succeeds: `Commission=PAID`, balance updated exactly once.
- [ ] RiseWorks provider switch A3 verified active; `POST /v1/webhooks/riseworks` returns 404 (A1/A2 in W8).
- [ ] Zero duplicate `Commission.paidAt` writes observed during monitoring window.
- [ ] Cutover table updated (`migration-cutover-table.md`).
- [ ] `CLAUDE.md`, `DECISION-LOG.md`, `migration-stack-analysis.md` updated.
- [ ] Session `4A-W8` order exists at status `PRE-DRAFT`.

---

## Rollback

- `DISBURSEMENT_PROVIDER=WISE → MOCK` on Railway + redeploy (stops new sends immediately).
- Delete production Wise webhook subscriptions.
- In-flight webhooks/transfers are handled by reconciliation cron once resubscribed.
- **Already-sent money cannot be recalled** (which is why Step 5 is one small payout).
- Re-register `RiseworksModule` per `03-riseworks-archive-and-restore-runbook.md` §4 if needed.

---

## Deviations

_(filled DURING execution — what / why / impact.)_

- **Pre-Step-1 CONFIRM finding:** production money-service was `Crashed` (`railway status`) —
  `WISE_WEBHOOK_QUEUE = 'money:wise-webhook'` (wired 4A-W5) crash-loops BullMQ, which rejects colons
  in queue names. Unrelated to this order but silently breaking the already-cut-over dLocal
  webhooks/Slice 1 crons/Slice 3 reads since 2026-07-26 21:06. Davin fixed the name
  (`money-wise-webhook`); Executor committed/pushed `243887a3`, verified clean boot before
  proceeding. Impact: none on this order's own scope, real production impact avoided by catching it
  before CONFIRM passed.
- **Order rewrite provenance (L11-class):** the order arrived rewritten (uncommitted, no
  Advisor-DRAFT/Davin-approval trail), folding Entry Criterion 0 into an in-session "Step 1" and
  pulling RiseWorks switches A1/A2 forward against the runbook's own Rev 2. Confirmed live as
  Davin's authentic edit; Step 1 approach agreed live (DI via `WiseModule` import, not a hand-wired
  factory); Step 6 corrected back to A3-only.
- **Entry criteria: three of Davin's "confirmed" claims initially failed live re-verification** —
  `RESEND_API_KEY`/`WISE_FUNDING_ALERT_EMAIL` absent, `WISE_ENVIRONMENT=sandbox` not `production`,
  `WISE_API_TOKEN` `401`s against both hosts. All three genuinely fixed and re-verified before
  proceeding (not re-trusted on the second pass either).
- **Step 1 scope wider than the order's own 2-file description:** `disbursement.types.ts`'s
  `DisbursementProvider` union still `'RISE' | 'MOCK'` (widened); `WisePaymentProvider`'s 8 DI
  collaborators needed real module wiring (`CronsModule` imports `WiseModule`), not a bare `new`;
  `disbursement-processor.service.ts` still called the bare `getAllPayableAffiliates()` instead of
  4A-W6's own provider-aware method — fixed. All three necessary for `DISBURSEMENT_PROVIDER=WISE`
  to actually function, not just compile. Committed `7d1e5044` — initially not pushed, caught before
  Step 4 (would have silently no-op'd to `MOCK`).
- **Step 3 endpoint correction:** `02-…reference.md`'s cited profile-level subscription path
  (`POST /v1/profiles/{id}/subscriptions`) 404s live; real path is `POST /v3/profiles/{id}/subscriptions`.
  All 3 events subscribed and verified via direct `WiseWebhookEvent` rows (`processed: true`,
  `signatureVerified: true`), not log absence — the controller's success path is silent by design.
- **Step 5 required real production data that didn't exist:** zero `AffiliateWiseRecipient` and
  zero `Commission` rows existed anywhere in production. Reused the existing
  `affiliate-test@trading-alerts.test` fixture (real, 2026-07-25, the only `AffiliateProfile` row in
  production — no new user fabricated). A synthetic $50.00 `APPROVED` `Commission` was inserted,
  tagged `paymentReference: '4A-W7-SMOKE-TEST'`, self-referential (`userId` = same test user).
  Declined to enter the recipient's bank account number/bank code myself (hard-prohibited
  regardless of authorization); Davin created the recipient live via the production API
  (`1513584827`), independently verified by the Executor (`GET /v1/accounts/1513584827` → `200`,
  every field matched) before linking (`accountTail`/`detailsFingerprint` only, per F41).
- **`main.ts` incident (self-corrected by Davin):** the first recipient-link attempt edited
  `bootstrap()` to run an `AffiliateWiseRecipient.upsert()` on every future application startup,
  silently swallowing errors — flagged as a permanent hardcoded-PII-adjacent data-corruption risk
  (any future legitimate recipient update would be silently stomped on the next restart). Davin
  reverted it (`94fbd7fc`) once its one-time job was done.
- **F47 found (`DECISION-LOG.md`, OPEN):** `wise-payment.provider.ts`'s own `prepareBatch` call
  live-422'd (real quote + real batch group created, transfer rejected). Investigating surfaced a
  real currency-unit bug in `wise-quote.service.ts` — the USD commission amount passed straight
  through as `targetAmount` in the recipient's local currency (a `$50` commission requested `50
THB`, not $50-worth). Not fixed here (near-zero-dial VERIFY-RETIRE) — documented in full, scoped
  as its own PORT session.
- **The transfer that actually completed (`a2528bbb-.../2272181669`) was created out-of-band**, not
  through the app's own (buggy) code path — $50 USD pay-in, 1,394.22 THB payout, reference
  `B2812234`. Reconciling its numbers surfaced a second, independent gap: it used `sourceAmount`-
  fixed ($50 total including fees), so the recipient receives THB worth only ~$41.51, not $50 —
  which does not satisfy F38's own resolved "platform absorbs the fee" intent either (also recorded
  under F47). The local DB (`PaymentBatch`/`WiseBatchGroup`/placeholder-`WiseTransfer` from the
  app's own failed attempt) was corrected in place to point at the real Wise resources, using values
  pulled directly from Wise's API — independently re-verified after Davin reported it complete, per
  this session's own practice of checking every claim against live state.
- **Funding initiated, not yet confirmed landed (2026-07-27):** Davin executed the $50.00 USD pay-in
  via SCB (SCB ref `20260727wkK6eGFri18MYKdZ`, Wise ref `B2812234`). Re-checked Wise's batch-group
  API immediately after — no state change yet, consistent with the quote's own ~11-hour bank-transfer
  verification estimate, not a red flag. `Commission.status` remains `APPROVED`; the real
  `transfers#state-change` webhook confirming `PAID` has not fired yet. This is the one item still
  blocking 4A-W7's true close (Waiting-on #58).

---

## Known wrinkles / do-not-touch

- **`lib/api/index.ts`** — known-broken by design until Phase 7. Do not touch.
- **RiseWorks source, schema, and rows** — Archived (F42), never deleted, never renamed.
- **Already-sent money cannot be recalled** — verify pay-in details before funding.

---

## Next-session handoff

_(PRE-DRAFTed: `4a-w8-riseworks-archival.migration-order.md` — variant `VERIFY-RETIRE` (ARCHIVE not RETIRE, nothing deleted) per `04-rise-to-wise-migration-plan.md` §4 "4A-W8": applies A1/A2/A4/A5 per `03-…` §2.1–2.5, runs dormancy verification, entry-gated on 4A-W7 actually finishing — not just executing. Currently under Davin's review.)_
