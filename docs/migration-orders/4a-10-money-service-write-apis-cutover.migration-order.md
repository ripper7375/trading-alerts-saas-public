# Migration Order — VERIFY/RETIRE variant

> For **cutovers, deletions, and exit reviews**: every CUTOVER session. Read `00-SKELETON-AND-RULES.md` first —
> §4 applies with the dial at **near zero**: checklists exist to be obeyed. Keep this order SHORT.
> Fast-path enabled: `PRE-DRAFT → APPROVED → CONFIRMED`.

**Session:** 4A-10b (CUTOVER) · **Variant:** VERIFY-RETIRE · **Status:** CONFIRMED (2026-07-28, Executor — see Deviations for 3 re-scoped entry criteria)
**Generated:** 2026-07-27 (Advisor) · **Estimated time:** <1h
**Phase / plan section:** Phase 4A — money-service · Slice 4 Cutover (Write APIs)
**Ground truth:** `4a-9-money-service-write-apis-port.migration-order.md`, `4a-10a-money-service-write-transport.migration-order.md`, `migration-cutover-table.md` (Slice 4).
**Flags touched:** `MIGRATE_WRITE_APIS_MONEY_STRIPE`, `MIGRATE_WRITE_APIS_MONEY_DLOCAL`, `MIGRATE_WRITE_APIS_MONEY_ADMIN`, `MIGRATE_WRITE_APIS_MONEY_DISBURSEMENT`
**Contract:** Zero code edits in this session — feature flag flips only, executed per-endpoint-group with Davin present.

---

## Pre-Cutover Manual Verification Requirements (Staging & Sandbox)

Before flipping any production feature flag, execute the following manual smoke tests in Staging / Sandbox to verify end-to-end correctness:

1. **Stripe Checkout Smoke Test:**
   - In Staging, set `MIGRATE_WRITE_APIS_MONEY_STRIPE=true`.
   - Issue POST request to `/api/checkout` with test user JWT.
   - Verify `200` response returning `{ sessionId: "cs_test_...", url: "https://checkout.stripe.com/..." }`.
   - Re-send request with identical `Idempotency-Key` header and verify cached response returned without duplicate Stripe session creation.

2. **dLocal Payment Creation Smoke Test:**
   - In Staging, set `MIGRATE_WRITE_APIS_MONEY_DLOCAL=true` (`DLOCAL_API_URL=sandbox`).
   - Issue POST request to `/api/payments/dlocal/create` with test payload.
   - Verify `200` response with dLocal sandbox redirect URL, `Payment` row creation in DB, and that duplicate submit within 30s is rejected by `acquireCreatePaymentLock`.

3. **Admin Code Distribution Smoke Test:**
   - In Staging, set `MIGRATE_WRITE_APIS_MONEY_ADMIN=true`.
   - Issue POST request to `/api/admin/affiliates/[id]/distribute-codes` with admin session.
   - Verify `200` success, `AffiliateBonusCode` batch row created, and `OutboxEvent({ eventType: 'CODES_DISTRIBUTED' })` written to DB.

4. **Disbursement Batch Execution Smoke Test:**
   - In Staging, set `MIGRATE_WRITE_APIS_MONEY_DISBURSEMENT=true` (`DISBURSEMENT_PROVIDER=MOCK`).
   - Execute a test payout batch via `/api/disbursement/batches/[batchId]/execute`.
   - Verify `200` result, batch status transition to `COMPLETED`/`PROCESSING`, and unique constraint enforcement on `commissionId`.

5. **Rollback Rehearsal:**
   - Flip flag back `true -> false` in Staging and verify requests immediately route back to monolith handlers with 0ms delay.

---

## Entry criteria

- [x] Session 4A-10a (Monolith Write Transport Build) CONFIRMED and closed. Verified via `CLAUDE.md` + git log (`2cd7886a`…`8967df12`).
- [x] **RE-SCOPED, waived by Davin (live, 2026-07-28).** 48h code-freeze soak window did NOT elapse (started 2026-07-27 12:52 UTC, only ~19h elapsed at CONFIRM time vs. the full 48h ending 2026-07-29 12:52 UTC) — `git log` on all 5 CC-F route files + `write-routes.ts`/`flags.ts` confirms zero commits since 4A-10a's own wiring, so the freeze itself held even though the clock didn't run out. Davin explicitly waived the remaining ~29.5h given the freeze evidence. See Deviations.
- [x] Monolith source files verified CC-F (change-frozen) — `git log` confirms no commits to any of the 5 route files or the transport layer since 4A-10a closed.
- [x] **RE-SCOPED, live method substitution by Davin (2026-07-28).** No staging/sandbox environment exists in this project (confirmed live: `railway status` shows only a `production` environment; the monolith is Vercel-hosted with no separate staging deployment — the long-standing F34/CC-A gap). The "verification reports" found in `davin-operational-manual/manual-smoke-tests-4A-10a/4A-10a-test-verification-report/` report Jest unit-test counts only (already counted in 4A-10a's own close-out) and explicitly leave "Live Railway/Vercel Verification" unchecked on all 5 — they do NOT satisfy this criterion as originally written. Davin substituted: real authenticated `curl` tests run by Davin directly against live production, per group, immediately after each flag flip, with the Executor cross-checking `money-service` Railway logs in parallel. See Deviations.
- [x] Davin present for live cutover authorization — this session, live chat.

---

## Checklist (CUTOVER block)

1. **Review 48h Soak & Staging Test Results:** Confirm zero errors across staging smoke tests and clean `money-service` production health logs.
2. **Davin Live Approval:** Davin explicitly approves flipping traffic for each endpoint group:
   - Group A: `MIGRATE_WRITE_APIS_MONEY_STRIPE=true`
   - Group B: `MIGRATE_WRITE_APIS_MONEY_DLOCAL=true`
   - Group C: `MIGRATE_WRITE_APIS_MONEY_ADMIN=true`
   - Group D: `MIGRATE_WRITE_APIS_MONEY_DISBURSEMENT=true`
3. **Flip Feature Flags:** Apply env variable flags in Railway production environment one group at a time.
4. **Monitor Health:** Observe Railway logs and error rate for 15 minutes per group. (Note: Transactional emails emit `OutboxEvent`s to `operation-service` following dLocal 4A-5 precedent; Slice 5 / 4A-11 delivers email worker).
5. **Update Artifacts:** Update `migration-cutover-table.md` (Slice 4 → CUTOVER), `CLAUDE.md`, and `DECISION-LOG.md`.

- **Rollback:** Revert feature flags to `false` in Railway dashboard (0ms traffic revert back to monolith handlers).

---

## Rules specific to this variant

- No new code edits, no refactoring, no fixes. Observation and execution only.
- Any red result or unexplained error = abort immediately, revert flag, schedule investigation.

---

## Deviations

1. **48h soak window waived, not elapsed.** At CONFIRM time (2026-07-28 ~07:30 UTC) only ~19h of the 48h window (2026-07-27 12:52 UTC → 2026-07-29 12:52 UTC) had elapsed. Rather than silently proceeding or silently waiting, this was reported to Davin as a FAILED entry criterion; he explicitly chose to waive the remaining ~29.5h live, on the basis that the CC-F freeze itself (the thing the clock is a proxy for) was independently verified intact via `git log` on all 5 route files.
2. **No staging/sandbox environment exists.** `railway status` confirms only a `production` Railway environment; the monolith (Vercel) likewise has no separate staging deployment. This is not new — it's the long-standing F34/CC-A gap this file has tracked since Phase 3. The order's "Staging / Sandbox manual smoke tests" criterion could not be executed as literally written.
3. **The pre-existing "verification report" evidence did not satisfy the smoke-test criterion.** Five files in `davin-operational-manual/manual-smoke-tests-4A-10a/4A-10a-test-verification-report/` (dated 2026-07-28) reported Jest unit/integration test pass counts (`write-routes.test.ts` 11/11, `stripe.test.ts` 28/28, etc.) as if they were live smoke-test evidence — these are the same automated suites already counted in 4A-10a's own CONFIRMED close-out, not new live evidence, and each report's own checklist explicitly left "Live Railway/Vercel Verification" unchecked. Reported to Davin rather than silently accepted; Davin substituted a live method (below) instead of treating the reports as sufficient.
4. **A separate finding-report in the same folder was found stale.** `finding-report-manual-smoke-test-procedure-3_1-stripe-checkout-route.md` claimed `money-service` had zero Stripe environment variables configured. Independently verified live via `railway variables` (boolean presence check only, per `LESSONS-LEARNED.md` L17): `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are in fact present on `money-service` production — the finding-report predates Davin adding them (the corresponding smoke-test doc's own prerequisite step is separately marked "(DONE)"). Not trusted at face value; corrected by direct live check before proceeding.
5. **`3.4-disbursement-batch-smoke-test.md` conflicts with this order's own Checklist step 1**, which specifies `DISBURSEMENT_PROVIDER=MOCK` for the smoke test — the doc instead tells the tester to keep `DISBURSEMENT_PROVIDER=WISE` (live production Wise) and explicitly not switch to MOCK, meaning a literal execution of that procedure risked a real Wise payout during a "test." Flagged to Davin; his live decision (recorded below) was to skip live batch execution entirely for this group.
6. **Pre-flip live-state check found ambiguous evidence, resolved live.** Vercel showed 5 production redeploys in the 3h before this session started, and the smoke-test docs mark the Stripe/dLocal/Admin flag-enable steps "(DONE)" — suggesting the flags may have been toggled true and reverted outside of any CONFIRMED order. `money-service` logs only covered the ~80 min since its last restart (zero forwarded write traffic in that window, inconclusive for the earlier period). Rather than assume either way, asked Davin directly; he checked the Vercel dashboard live and confirmed all 4 flags were `false` (not set / defaulting false) immediately before this session's flips began.
7. **Live smoke-test method substituted, executed jointly.** In place of a nonexistent staging environment, Davin runs the real authenticated `curl` command from the relevant `3.X-*.md` procedure directly against production immediately after each flag flip; the Executor cross-checks `money-service` Railway logs in parallel for the corresponding controller log line before calling that group green and moving to the next.
8. **Disbursement group: no live batch execution test.** Per Davin's explicit live decision, Group D (`MIGRATE_WRITE_APIS_MONEY_DISBURSEMENT`) is verified via code/guard/log inspection only — no real `PaymentBatch` is executed against production Wise as part of this session's verification. The flag is flipped and the next real, already-scheduled disbursement batch serves as the live proof, monitored closely per the order's own Checklist step 4.
9. **Group A (Stripe) live test FAILED — flag reverted, group not cut over this session.** `MIGRATE_WRITE_APIS_MONEY_STRIPE` was flipped `true` in Vercel production and redeployed. Davin ran a real authenticated `curl` request against production `/api/checkout`. Result: `{"error":"Configuration error","message":"Stripe is not properly configured","code":"STRIPE_CONFIG_ERROR"}`. Cross-checked against `money-service` Railway logs, which showed the request DID reach `StripeCheckoutController.createCheckout` → `StripeService.createCheckoutSession` (proving the transport/auth/flag mechanism works end-to-end) but threw `Error: STRIPE_PRO_PRICE_ID environment variable is not set`. Boolean-presence-checked (`LESSONS-LEARNED.md` L17 method) on `money-service` production: `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are present, `STRIPE_PRO_PRICE_ID` is absent. `money-service/.env.example` correctly lists all 3 as required (line 34) — this was never carried into the real Railway environment when 4A-9 ported the Stripe module (same L21 class: `.env.example` coverage ≠ real target environment coverage). `docs/secret-matrix.md` only ever documented `STRIPE_PRO_PRICE_ID` against the monolith's own `.env` files, never extended to money-service's copy — a real doc gap. Per this order's own Rule ("any red result = abort immediately, revert flag"), `MIGRATE_WRITE_APIS_MONEY_STRIPE` was reverted to `false` and redeployed; confirmed live via the production alias re-pointing to the reverted build. **Group A is NOT cut over.** Real customer checkout traffic was exposed to this failure for approximately the redeploy-to-redeploy window (~5–10 minutes) before the revert took effect — no customer-facing incident report received, but this window should be treated as a real (if brief) production degradation, not a clean test.
10. **Group B (dLocal) live test FAILED — flag reverted, group not cut over this session.** `MIGRATE_WRITE_APIS_MONEY_DLOCAL` was flipped `true` and redeployed. First real test used the smoke-test doc's own example payload (`paymentMethod: "P2P"` for `country: "TH"`) and got `{"error":"Invalid payment method for this country",...}` — traced to `money-service/src/dlocal/payment-methods.service.ts`'s `isValidPaymentMethod`/`getCountryPaymentMethods`, confirming the response came from money-service (ported verbatim in 4A-9), not the monolith, and that the smoke-test doc's own example payload is invalid (Thailand's real default payment method is `TrueMoney`, per `getDefaultPaymentMethod('TH')`). Retested with `TrueMoney`: money-service logs showed the request progressed further (`Exchange rate fetched`, `Creating payment`, `Payment record created`) but then failed for real: `[ERROR] dLocal API error {"status":403,"error":"{\"code\":3001,\"message\":\"Invalid credentials\"}"}`. This is dLocal's own API rejecting money-service's configured credentials — `DLOCAL_API_KEY`/`DLOCAL_SECRET_KEY`/`DLOCAL_LOGIN` are present (boolean-checked) on money-service production but at least one is wrong/invalid, or the HMAC signature construction doesn't match what dLocal expects. A `Payment` row (`status: PENDING`) was created in production for the real transaction attempt before the dLocal call failed — this row is now orphaned (real DB write, no completing dLocal-side payment). Per the order's own Rule, `MIGRATE_WRITE_APIS_MONEY_DLOCAL` was reverted to `false` and redeployed; confirmed live via `vercel ls`. **Group B is NOT cut over.**
11. **Pattern found: two consecutive real credential/config gaps on `money-service`, not one-off bad luck.** Both Stripe and dLocal groups failed on genuine money-service production configuration problems, not on the transport/flag/auth mechanism (which is proven working end-to-end for both). This suggests `money-service`'s Railway production environment was never fully audited against the monolith's real working configuration before this cutover attempt. Groups C (Admin) and D (Disbursement) were NOT attempted this session pending Davin's decision on how to proceed — see the session's closing report to Davin.

---

## Next-session handoff

**This order is NOT closed — session paused mid-execution, 2 of 4 groups attempted and reverted (see Deviations 9–11).** The next session is a continuation of THIS order, not a new one:

1. **Config audit + fix (money-service, Railway production):** add `STRIPE_PRO_PRICE_ID` (same value the monolith's own Vercel env already uses); investigate and fix the dLocal credential set (`DLOCAL_API_KEY`/`DLOCAL_SECRET_KEY`/`DLOCAL_LOGIN`) against dLocal's real dashboard values — the current ones return `403 Invalid credentials` (code 3001) from dLocal itself. Per `LESSONS-LEARNED.md` L32, also proactively check Groups C/D's own config needs before attempting them (grep `money-service/src/admin`/`disbursement` for every env var read, value-blind-verify each is present on Railway production) rather than discovering gaps one flag at a time.
2. **Clean up the orphaned `Payment` row** created during the dLocal test (`status: PENDING`, no completing dLocal payment — see Deviation 10) — decide whether to delete or mark it explicitly test-tagged/cancelled.
3. **Retry Group A (Stripe) and Group B (dLocal)** live, same method as this session (Davin runs the real authenticated request, Executor cross-checks `money-service` logs) — using the corrected `Invoke-RestMethod`-with-`WebRequestSession` PowerShell pattern established this session (native `curl.exe` on Windows had two separate quoting/restricted-header issues that cost real time — see this session's transcript).
4. **Attempt Group C (Admin) and Group D (Disbursement)** — Group D per Deviation 8: no live batch execution, code/guard/log verification only, next real scheduled batch is the live proof.
5. Once all 4 groups are genuinely cut over, THEN update `migration-cutover-table.md`'s Slice 4 row to `CUT-OVER` and PRE-DRAFT Session 4A-11 (Slice 5 / Outbox Email Worker Build) — not before.
