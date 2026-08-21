# Migration Order — Session 4A-15 — Wise + Outbox Defect Sweep

> For sessions that **move existing code between stacks** / fix defects in already-ported code:
> read `00-SKELETON-AND-RULES.md` first — §4 applies with the dial at **Low**. Behavior
> preservation is the deliverable for the Wise quote-correctness half (F47); the outbox half
> (F50) is a genuine bug fix / recipient identity resolution.
> PRE-DRAFTed by the Executor at Session 4A-14's close (2026-08-21), upgraded to DRAFT by the
> Advisor (2026-08-21).
> Closes `DECISION-LOG.md` **F47** (OPEN, found 4A-W7) and **F50** (OPEN, found 4A-11), completing
> Phase 4X's originally-scoped Wise/outbox work.

**Session:** 4A-15 (Wise + Outbox Defect Sweep) · **Variant:** PORT · **Status:** CLOSED SUCCESSFUL (Executor, 2026-08-21)
**Generated:** 2026-08-21 (Executor, PRE-DRAFT) · **Upgraded to DRAFT:** 2026-08-21 (Advisor) · **Approved:** 2026-08-21 (Davin) · **Confirmed:** 2026-08-21 (Executor) · **Closed:** 2026-08-21 (Executor)
**Flags touched:** F47 (OPEN → RESOLVED), F50 (OPEN → RESOLVED)
**Target services:** `money-service` (both defects) + `operation-service` (outbox consumer dispatch)
**Estimated time:** ~1–2h (low dial, Wise is in MANUAL disbursement mode, Outbox publisher is live `true`)
**Contract:** No new HTTP endpoints. F47 corrects quote calculation parameters; F50 corrects outbox event `aggregateId` and wires consumer dispatch to existing `sendAffiliateCommissionEmail()`.

---

## Decisions taken

> Technical choices made by the Advisor per `00-SKELETON-AND-RULES.md` §1.0 / `DECISION-LOG.md` PD1.
> Items touching financial calculations and outbox event routing carry **`⚠ NEEDS EXPLICIT SIGN-OFF`**.

1. **F47 Fix Shape: `sourceAmount` vs `targetAmount` in Wise Quotes `⚠ NEEDS EXPLICIT SIGN-OFF`**
   - **Chosen:** Update `CreateQuoteInput` in `money-service/src/wise/services/wise-quote.service.ts` to support either `sourceAmount` or `targetAmount`. In `wise-payment.provider.ts`:
     - When `sourceCurrency === targetCurrency` (USD -> USD payout): request quote by `targetAmount: item.amount` (affiliate receives exact USD earned, platform absorbs fee per F38).
     - When `sourceCurrency !== targetCurrency` (USD -> non-USD payout, e.g. USD -> THB/EUR/GBP): request quote by `sourceAmount: item.amount` (so Wise converts the exact $item.amount USD of earned commission at current exchange rate into recipient target currency, with platform bearing source fee).
   - **Rejected:** Passing raw USD into `targetAmount` for non-USD currencies (which was causing 50 USD to be quoted as 50 THB).
   - **Why:** `Commission.commissionAmount` is always stored in USD. Passing USD amount into `targetAmount` of a foreign currency severely shorts (e.g. THB) or inflates (e.g. GBP) payouts.
   - **How hard to undo:** Trivial — isolated to Wise quote service and provider.

2. **F50 Producer Fix Shape: Affiliate `userId` as `aggregateId` `⚠ NEEDS EXPLICIT SIGN-OFF`**
   - **Chosen:** In `money-service`:
     - In `ConversionProcessorService.processAffiliateConversion()`: return `affiliateUserId: affiliateCode.affiliateProfile.userId`, `code: affiliateCode.code`, and `totalEarnings`.
     - In `stripe-webhook.service.ts`: emit `COMMISSION_CREDITED` with `aggregateId: conversion.affiliateUserId` (the affiliate who earned the commission, NOT the buyer), and payload containing `{ commissionId, commissionAmount, totalEarnings, code, provider: 'STRIPE' }`.
   - **Rejected:** Leaving `aggregateId` as the buyer's `userId` or adding complex cross-service queries in `operation-service`.
   - **Why:** `aggregateId` in Outbox architecture represents the target entity whose state changed and who receives the notification. The affiliate's `User.id` allows `operation-service` to resolve email/name directly from its own `User` table subset.
   - **How hard to undo:** Trivial.

3. **F50 Consumer Fix Shape: Wire `sendAffiliateCommissionEmail` in `operation-service` `⚠ NEEDS EXPLICIT SIGN-OFF`**
   - **Chosen:** In `operation-service/src/outbox/outbox-consumer.service.ts`:
     - Remove the `if (event.eventType === 'COMMISSION_CREDITED')` skip block.
     - Add `case 'COMMISSION_CREDITED':` in `dispatch()`, calling the pre-existing `sendAffiliateCommissionEmail(email, name, code, commissionAmount, totalEarnings)` from `subscription-email.util.ts`.
   - **Rejected:** Leaving the skip branch active or deleting the event handler.
   - **Why:** `sendAffiliateCommissionEmail()` is already fully implemented in `subscription-email.util.ts` (ported in Session 4A-11). With `aggregateId` pointing to the affiliate, the email is sent to the correct recipient.
   - **How hard to undo:** Trivial.

4. **Pre-existing `operation-service` test compile fix & Outbox Live State `⚠ NEEDS EXPLICIT SIGN-OFF`**
   - **Chosen:**
     - Remove erroneous `this.prisma.affiliateProfile` seed call from `operation-service/src/auth/auth.service.ts` (unblock compilation for 3 pre-existing broken test suites).
     - Acknowledge `OUTBOX_PUBLISHER_ENABLED=true` is active in production, meaning fixing F50 will make subsequent real affiliate conversions send real emails.
   - **Why:** `operation-service` intentionally does not model `AffiliateProfile`. Fixing the compile error restores `operation-service` test baseline to 42/42 clean.
   - **How hard to undo:** Trivial.

---

## Why this session exists

Two independent, non-blocking defects were found during Phase 4/4X development:

- **F47 (Wise quote currency correctness):** Found in Session 4A-W7 during initial non-USD recipient smoke tests. `wise-quote.service.ts` passed raw USD amounts into `targetAmount` for all currencies, causing severe calculation errors for non-USD payouts.
- **F50 (`COMMISSION_CREDITED` recipient resolution):** Found in Session 4A-11 during outbox consumer build. `COMMISSION_CREDITED` outbox events were emitted with `aggregateId` set to the paying customer instead of the affiliate, forcing `OutboxConsumerService` to skip processing to avoid sending emails to the wrong user.

Closing F47 and F50 resolves the remaining Wise and Outbox defects, completing the core goals of Phase 4X.

---

## Integration points

- **F47 (`wise-quote.service.ts` & `wise-payment.provider.ts`):**
  In — called by `WisePaymentProvider.prepareBatch()` when building quotes for batch disbursement.
  Out — Wise API `/v3/profiles/{profileId}/quotes`.
- **F50 Producer (`stripe-webhook.service.ts` & `conversion-processor.service.ts`):**
  In — Stripe webhook conversion processing.
  Out — `OutboxEvent` table (`aggregateId = affiliate.userId`, `eventType = 'COMMISSION_CREDITED'`).
- **F50 Consumer (`outbox-consumer.service.ts`):**
  In — `OutboxPublisherCron` in `money-service` calls `POST /v1/outbox/consume` in `operation-service`.
  Out — `sendAffiliateCommissionEmail()` sends email notification to affiliate via Resend.

---

## Entry criteria

- [x] `DECISION-LOG.md` **F47** and **F50** reviewed directly — confirm both OPEN, scope unchanged.
      Confirmed at CONFIRM: both OPEN, scope matched their register rows and (for F50) the
      archived 4A-11 write-up.
- [x] **Git drift check re-measured live**:
      `git log --oneline 94e46f7d..HEAD -- money-service/src/wise/ money-service/src/stripe/stripe-webhook.service.ts operation-service/src/outbox/`
      Confirm zero drift since Session 4A-14 close (`94e46f7d`). Zero commits returned — PASS.
- [x] **Codebase test baselines re-measured at CONFIRM**: - Monolith: `tsc --noEmit` clean; `eslint app components lib hooks --max-warnings 0` (0 errors, max 5 warnings); `pnpm test:ci` (160/160 suites, 2400/2400 tests). PASS, exact match. - `money-service`: `pnpm --filter money-service test` (62/62 suites, 523/523 tests). PASS, exact match. - `operation-service`: FAILED at first CONFIRM read (39/42 suites, 365/393 tests — pre-existing
      `auth.service.ts` compile break, see Deviation 1). Fixed by Step 0, then PASS: 42/42 suites,
      393/393 tests.
- [x] **`OUTBOX_PUBLISHER_ENABLED` state re-confirmed**:
      `OUTBOX_PUBLISHER_ENABLED` is `true` in production on `money-service`. Confirmed live via
      `railway variables --service money-service --kv` (grep-filtered to this key only, L4) —
      `true`, has been since Session 4A-12 (2026-07-30). See Deviation 2.
- [x] **Scope isolation confirmed**:
      Do NOT touch dLocal (F76) or Stripe webhook routes. Held — no dLocal or Stripe-webhook-route
      files touched by any of Steps 0–3.

---

## Ordered Steps

### Step 0: Fix pre-existing `auth.service.ts` compilation in `operation-service`

- In `operation-service/src/auth/auth.service.ts`:
  Remove lines referencing non-existent `this.prisma.affiliateProfile` in test user seeding.
- Run `pnpm --filter operation-service test` to restore baseline to 42/42 suites passing.
- Commit: `fix(operation-service): remove invalid affiliateProfile call from auth test seeding`
- **DONE — commit `1f147116`.** operation-service 42/42 suites, 393/393 tests, exact baseline.

### Step 1: Fix F47 in `money-service` (Wise quote calculation)

- In `money-service/src/wise/services/wise-quote.service.ts`:
  - Update `CreateQuoteInput` to support `sourceAmount?: number` and `targetAmount?: number`.
  - In `createQuote()` request body: send `sourceAmount` when provided, or `targetAmount` when provided.
- In `money-service/src/wise/providers/wise-payment.provider.ts`:
  - When calling `wiseQuoteService.createQuote()`:
    - If `recipient.targetCurrency === input.sourceCurrency`: pass `targetAmount: item.amount`.
    - If `recipient.targetCurrency !== input.sourceCurrency`: pass `sourceAmount: item.amount`.
- In `money-service/src/wise/__tests__/wise-quote.service.spec.ts` & `wise-payment.provider.spec.ts`:
  - Update tests to verify both USD->USD (targetAmount) and USD->non-USD (sourceAmount) quote paths.
- Run `pnpm --filter money-service test`.
- Commit: `fix(money-service): correct wise quote amount parameter for non-USD payouts (F47)`
- **DONE — commit `4496abb2`.** money-service 62/62 suites, 526/526 tests (+3 new), zero
  regressions. Verification scoped to unit tests only per Decision 4 (see Deviation 4).

### Step 2: Fix F50 Producer in `money-service` (`COMMISSION_CREDITED` emission)

- In `money-service/src/affiliate/conversion-processor.service.ts`:
  - In `processAffiliateConversion()`: include `affiliateUserId: affiliateCode.affiliateProfile.userId`, `code: affiliateCode.code`, and `totalEarnings: Number(updatedProfile.totalEarnings)` in `ConversionResult`.
- In `money-service/src/stripe/stripe-webhook.service.ts`:
  - When emitting `COMMISSION_CREDITED`: pass `conversion.affiliateUserId` as `aggregateId`.
  - Pass `{ commissionId, commissionAmount, totalEarnings, code, provider: 'STRIPE' }` in payload.
- Update `stripe-webhook.service.spec.ts` and `conversion-processor.service.spec.ts`.
- Run `pnpm --filter money-service test`.
- Commit: `fix(money-service): emit COMMISSION_CREDITED with affiliate userId as aggregateId (F50)`
- **DONE — commit `ca27c04d`.** money-service 62/62 suites, 526/526 tests, zero regressions.

### Step 3: Fix F50 Consumer in `operation-service` (`OutboxConsumerService`)

- In `operation-service/src/outbox/outbox-consumer.service.ts`:
  - Remove the early `if (event.eventType === 'COMMISSION_CREDITED')` skip block.
  - In `dispatch()`: add `case 'COMMISSION_CREDITED':` calling `sendAffiliateCommissionEmail(email, name, code, commissionAmount, totalEarnings)`.
- In `operation-service/src/outbox/outbox-consumer.service.spec.ts`:
  - Add test asserting `COMMISSION_CREDITED` event successfully dispatches to `sendAffiliateCommissionEmail` with the affiliate's email and name.
- Run `pnpm --filter operation-service test`.
- Commit: `fix(operation-service): wire COMMISSION_CREDITED outbox dispatch to affiliate email (F50)`
- **DONE — commit `8810b260`.** operation-service 42/42 suites, 393/393 tests, zero regressions.

### Step 4: Full Test Suite Validation

- Monolith: `tsc --noEmit`, `eslint app components lib hooks --max-warnings 0`, `pnpm test:ci`.
- `money-service`: `pnpm --filter money-service test`.
- `operation-service`: `pnpm --filter operation-service test`.
- **DONE.** First run (all 5 checks launched in parallel) gave false failures on 4 money-service
  and 3 operation-service suites — "Jest worker ran out of memory and crashed" from resource
  contention, not real failures (see Deviation 8). Re-run sequentially, nothing else in flight:
  - Monolith: `tsc --noEmit` clean; `eslint` 0 errors, 5 warnings (exact baseline); `test:ci`
    **160/160 suites, 2400/2400 tests.**
  - `money-service` (`npm test`, not a pnpm-workspace member — F9): **62/62 suites, 526/526
    tests** (523 baseline + 3 new F47 tests).
  - `operation-service` (`npm test`): **42/42 suites, 393/393 tests**, exact baseline.
    All green — session done per `EXECUTOR-PROTOCOL.md` §3 step 1.

### Step 5: Session Close-out & Governance (Executor at CLOSE)

- Record `DECISION-LOG.md` **F47** and **F50** as `RESOLVED`.
- Update `CLAUDE.md` state block per `EXECUTOR-PROTOCOL.md` §3.
- Harvest any lessons into `LESSONS-LEARNED.md`.
- PRE-DRAFT Session 9-0 (`9-0-frontend-swap-contract-decisions.migration-order.md`) and author `HANDOVER-PROMPT-phase-9.md`.

---

## Slice-level verification (done when)

- [x] F47: Corrected quote-amount logic, unit test suite green with new tests for both `sourceAmount` and `targetAmount`. Live/sandbox proof NOT obtained — Wise sandbox credentials unset locally, scope reduction Davin-approved (Deviation 4); disclosed as residual risk in `DECISION-LOG.md`.
- [x] F50 Producer: `COMMISSION_CREDITED` emits with `aggregateId = affiliate.userId`, payload containing code, commissionAmount, totalEarnings.
- [x] F50 Consumer: `OutboxConsumerService` handles `COMMISSION_CREDITED` by sending email to affiliate via `sendAffiliateCommissionEmail()`.
- [x] `DECISION-LOG.md` F47 and F50 both marked `RESOLVED`.
- [x] Full test baselines green across all 3 services (monolith `test:ci` 160/160·2400/2400, `money-service` 62/62·526/526, `operation-service` 42/42·393/393).

---

## Rollback

- Both fixes are pure code changes covered by automated unit tests.
- Rollback: `git revert` the respective commit(s) from Steps 0, 1, 2, or 3.

---

## Rules specific to this variant

- **No behavior change to the other 5 outbox eventTypes:** All other outbox events (`TIER_UPGRADED`, `SUBSCRIPTION_CANCELLED`, `PAYMENT_FAILED`, `PAYMENT_SUCCEEDED`, `TIER_DOWNGRADED`) must continue passing their tests unmodified.
- **Maintain F38 invariant (platform absorbs fee):** `feeBearer: 'PLATFORM'` remains strictly enforced on Wise quotes.
- **Explicit Railway CLI flag:** Pass `--service <exact-name>` on any Railway query (Lesson L34).
- **Sanity check DB queries:** Confirm DB target before verifying row counts (Lesson L35).

---

## Deviations

1. **Step 0 added mid-session, not present in the order at CONFIRM.** CONFIRM found
   operation-service's claimed test baseline (42/42 suites, 393/393 tests) was already false: 3
   suites failed to compile on `this.prisma.affiliateProfile` in `auth.service.ts:252,261` — a
   genuine, pre-existing, unrelated defect (operation-service's Prisma schema has no
   `AffiliateProfile` model by design) introduced commit `70299f13` (2026-08-15), a full week
   before this order's own PRE-DRAFT ancestor session (4A-14). Davin authorized removing the
   invalid `if (fixed.isAffiliate) {...}` seed block live and updated the order on disk to
   formalize Step 0 before execution. Verified no test referenced `affiliateProfile` before
   removing it (safe, zero assertions depended on it).
2. **`OUTBOX_PUBLISHER_ENABLED` risk-framing corrected.** CONFIRM found the order's "zero
   production risk"/"currently disabled" framing was wrong: the flag has been `true` in
   money-service production since Session 4A-12 (2026-07-30) — `migration-cutover-table.md`'s own
   Slice 5 row already recorded this correctly at drafting time. Davin acknowledged live and
   updated the order's `Decisions taken`/entry criteria/estimated-time text before authorizing
   execution. Practical effect: Step 3's fix is not inert code-only prep — the next real affiliate
   conversion will trigger a genuine `sendAffiliateCommissionEmail()` send, with no separate
   flag-flip session gating it the way 4A-13/4A-14's cutovers were gated.
3. **F47 test coverage added as 3 new tests, not by editing the 2 existing ones.** The order's
   Step 1 said "update tests to verify both paths" — the 2 existing `wise-quote.service.spec.ts`
   tests already validly covered the `targetAmount` pass-through path and remained correct
   post-fix, so they were left unmodified; 1 new service-level `sourceAmount` test and 2 new
   provider-level branching tests (asserting the exact `createQuote` call args for both the
   currency-match and currency-mismatch cases) were added instead.
4. **F47 live/sandbox verification dropped, per Davin-approved `Decisions taken` #4.** The
   original PRE-DRAFT required live Wise sandbox proof for ≥1 non-USD currency, citing 4A-14's own
   F49→F76 precedent. At CONFIRM, `WISE_PROFILE_ID`/`WISE_API_TOKEN`/`WISE_ENVIRONMENT` were found
   undocumented in `money-service/.env.example` and unset locally — no safe local path to Wise's
   sandbox existed. Scoped down to unit-tests-only with Davin's explicit sign-off; disclosed as a
   residual risk in `DECISION-LOG.md`'s F47 entry rather than silently treated as fully proven.
5. **F50 producer fix required two implementation details the order named the target field for
   but didn't spell out:** (a) widening `affiliateCode.affiliateProfile`'s Prisma `select` to
   include `userId` (previously only `id`/`status`); (b) capturing the `tx.affiliateProfile.update()`
   result (previously fire-and-forget) into a named `updatedProfile` to read `totalEarnings`.
6. **Pre-commit hook (lint-staged) left a purely-cosmetic working-tree/index diff after 2 of the 4
   commits** (Steps 2 and 3) — its stash-backup/restore mechanism reintroduced pre-formatting file
   content on top of the already-committed, correctly-formatted `HEAD`. Verified via `git diff`
   as whitespace-only (zero logic change) both times, then reset via `git checkout HEAD -- <file>`
   rather than re-staged or folded into a later commit. New `LESSONS-LEARNED.md` **L36**.
7. **An unrelated, uncommitted change to 2 `seed-code/**` files was observed mid-session**
(`app/affiliate/dashboard/payouts/page.tsx`, `app/affiliate/dashboard/statements/page.tsx`) —
not present at session start, not made by any action this session took. Content matches F38's
"platform absorbs the fee" framing (a Phase 9 mockup edit, most likely Davin's own concurrent
work). Flagged to Davin, never touched, never staged — `seed-code/\*\*`is read-only per`CLAUDE.md` §5.
8. **Step 4's first run gave false failures from resource contention, not real test failures.**
   Launching monolith `tsc`+`eslint`+`test:ci` and both services' full suites in parallel (5
   concurrent heavy processes) produced "Jest worker ran out of memory and crashed" on 4
   money-service suites and 3 operation-service suites — `tsc`/`eslint` in the same batch passed
   clean, and 0 real assertions failed anywhere. Re-run sequentially with nothing else in flight
   per `LESSONS-LEARNED.md` L24; see Step 4 results below.
9. **Operation-service showed a failed deploy (~28 min old) at CONFIRM**, unrelated to this
   session's own scope — `railway status` reported "Deploy failed" while the currently-serving
   instance stayed healthy (`/health` → 200 throughout, verified before and after this session's
   own commits touched that service). Not investigated further (out of scope, zero session
   impact); flagged for Davin's awareness in case it recurs on operation-service's next real
   deploy.

---

## Next-session handoff

- **Next session:** `9-0` — Frontend Swap Contract & Decisions (Phase 9 initialization).
- **Variant:** CONTRACT (no code).
- **Prerequisite:** 4A-15 CLOSED SUCCESSFUL.
- **Note on F76:** dLocal Group B recutover (F76) will be scheduled as a dedicated fix session (`4A-16`) before Session 8-1 decommission.
- **4A-15 obligation:** PRE-DRAFT Session 9-0 and author `HANDOVER-PROMPT-phase-9.md` at close.
