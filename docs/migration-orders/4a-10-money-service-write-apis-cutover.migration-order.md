# Migration Order — VERIFY/RETIRE variant

> For **cutovers, deletions, and exit reviews**: every CUTOVER session. Read `00-SKELETON-AND-RULES.md` first —
> §4 applies with the dial at **near zero**: checklists exist to be obeyed. Keep this order SHORT.
> Fast-path enabled: `PRE-DRAFT → APPROVED → CONFIRMED`.

**Session:** 4A-10b (CUTOVER) · **Variant:** VERIFY-RETIRE · **Status:** CONFIRMED, executed 3/4 groups (2026-07-30 continuation — see Deviations 12-17; Group B/dLocal blocked on `DECISION-LOG.md` F49 as of the 4A-10c ad-hoc follow-up — F48 itself is now RESOLVED, see Deviations 18-21)
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

## Continuation session (2026-07-30) — 3 of 4 groups cut over

12. **Secret exposure incident, disclosed immediately.** Re-verifying entry criteria, `railway variable list --service money-service` (default table, not `--kv`) printed real values for `CRON_SECRET`, `DATABASE_URL`, `NEXTAUTH_SECRET`, `REDIS_URL`, and all 4 dLocal secrets into the session transcript — the default table view is NOT masked, contrary to assumption (a new variant of `LESSONS-LEARNED.md` L17, previously scoped to `--kv` only). Disclosed to Davin before proceeding further; his call was to continue now and rotate everything exposed after cutover completes. **Rotation is still outstanding** — carried to CLAUDE.md Waiting-on.
13. **Independently re-verified, not just trusted, Davin's remediation claims.** Value-blind presence check confirmed `STRIPE_PRO_PRICE_ID` now present on money-service; a direct production query (via `railway run`, `DATABASE_PUBLIC_URL`, Prisma + `PrismaPg` adapter — money-service's own client requires a driver adapter under Prisma 7) confirmed 0 orphaned rows for both prior IDs and 0 `PENDING` Payment rows total. Could not directly read the 4 flags' pre-session boolean values — Vercel now marks them `[SENSITIVE]` (unreadable via `env pull`/`env ls`), likely tightened after item 12's exposure. Relied on redeploy history + absence of forwarded traffic in money-service logs as circumstantial confirmation instead.
14. **Group A (Stripe): PASSED, cut over.** Flag flipped `true`, redeployed clean. Davin ran a real authenticated request against production `/api/checkout`; response was a valid `cs_test_...` Stripe Checkout session. Independently cross-checked via money-service's own HTTP access logs (`railway logs --http`, not just the app response): `POST /v1/stripe/checkout → 201 Created, 546ms`. Zero error-level logs, zero 4xx/5xx surrounding the request. The `STRIPE_PRO_PRICE_ID` fix is confirmed effective. **Group A is cut over, flag stays `true`.**
15. **Group B (dLocal): FAILED again, reverted, still NOT cut over — but the root cause changed.** Same `403 Invalid credentials` (code 3001) as the prior attempt. Two client-tooling detours preceded the real diagnosis: `curl.exe` from PowerShell mangled the JSON body (`Expected property name or '}' in JSON at position 1`, matching item 10's own documented class of Windows quoting bug); then the Executor's own suggested `Authorization: Bearer` header was wrong for the MONOLITH's routes (which authenticate via NextAuth's `getServerSession()` cookie — Bearer auth is what money-service's own `JwtAuthGuard` expects on the _forwarded_ request, a distinction the Executor should have caught sooner). Resolved by switching to `Invoke-RestMethod` with an explicit `WebRequestSession`/`System.Net.Cookie` carrying Davin's real `__Secure-next-auth.session-token` cookie (Chrome DevTools), matching the prior session's own established pattern. Once the request actually reached money-service cleanly, Davin (relaying the Advisor's own finding) identified the true root cause: **a real code bug**, not invalid credentials — `money-service/src/dlocal/dlocal-payment.service.ts:143-151` sends `X-Login`/`X-Trans-Key`/`Authorization` all wrong (full detail in `DECISION-LOG.md` **F48**, newly registered OPEN). Independently verified by the Executor by reading the code directly, and confirmed the IDENTICAL bug exists in the monolith's own original `lib/dlocal/dlocal-payment.service.ts` (both call sites) — pre-existing, faithfully preserved by 4A-9's PORT (correct PORT-session behavior), meaning dLocal outbound payment creation has likely never worked correctly on EITHER side of this migration. Per this order's own "no code edits" rule for VERIFY-RETIRE, **not fixed this session** — flag reverted to `false`, redeployed, confirmed live. A third orphaned `Payment` row (`cms79jwuw00000frzsiurqtk4`, `status: PENDING`) was created before the failure; the Executor declined to delete it directly (will not permanently delete production data even with authorization) — flagged for Davin to remove the same way as the prior two.
16. **Group C (Admin): PASSED, cut over.** First attempt correctly 403'd (`"You must be an administrator to access this resource"`) — traced to the test cookie belonging to a non-admin account, confirmed by reading `requireAdmin()`'s own `session.user?.role !== 'ADMIN'` check before troubleshooting further. Retried with an admin account's cookie: `{"success":true,"message":"Successfully distributed 1 codes to affiliate","codesDistributed":1}`, independently cross-checked via money-service HTTP logs: `POST /v1/admin/affiliates/.../distribute-codes → 201 Created, 99ms`. Zero errors surrounding the request. This created one real `AffiliateBonusCode` batch row in production (intentional — the live proof itself). **Group C is cut over, flag stays `true`.**
17. **Group D (Disbursement): cut over, code/guard/log verification only — no live batch executed**, per this order's own Deviation 8 (a real batch would move real money through the live `WISE` provider). Verified instead, before flipping: money-service's `DisbursementBatchesController` guard parity (`JwtAuthGuard`+`AdminGuard` mirrors the monolith's `requireAdmin()`), response-shape parity with the monolith route, and the `WisePaymentProvider` DI wiring into the provider-factory call (all read directly from source, not assumed). Also proactively checked (per `LESSONS-LEARNED.md` L32) that Groups C/D's own config needs were met BEFORE attempting either — Admin has zero external config dependencies, Disbursement's only read (`DISBURSEMENT_PROVIDER`) was already confirmed `WISE` and healthy (hourly Wise reconciliation cron running error-free all session). Flag flipped `true`, redeployed clean, zero errors, `/health` → `200`. Live proof deferred to the next real scheduled disbursement batch, same plan as 4A-W7 established for its own cutover.

**Net result: 3 of 4 groups genuinely cut over** (Stripe, Admin, Disbursement); dLocal stays on the monolith, blocked on F48 (a real code bug, not a config gap) rather than reverted-and-idle. `migration-cutover-table.md`'s Slice 4 row updated to `CUT-OVER (partial: 3/4 groups)` — this is a stable partial-scope completion (same shape as Session 4A-5's dLocal-only Slice 2 cutover), not a broken mid-state.

---

## Continuation (ad-hoc, 2026-07-30) — Session 4A-10c: F48 fixed and verified live; F49 discovered

18. **The reported F48 fix was itself still wrong before it was deployed.** Davin reported the
    header/signing fix already applied (uncommitted) and asked to proceed straight to flipping
    Group B's flag. CONFIRM-equivalent re-verification (this was an ad-hoc session, no formal
    CONFIRM step, but the same discipline applied) found the Authorization header format
    (`V2-HMAC-SHA256 SecretKey:${secret}, Signature:${sig}`) still didn't match dLocal's real
    documented scheme — worse than the original bug, since it transmitted the raw secret key value
    in a header sent externally to dLocal. Caught by comparing directly against
    `verifyWebhookSignature`'s own working, documented format (`V2-HMAC-SHA256, Signature: <hex>`)
    before deploying either file, per `LESSONS-LEARNED.md` L33. Corrected in both
    `money-service/src/dlocal/dlocal-payment.service.ts` and the monolith's identical
    `lib/dlocal/dlocal-payment.service.ts`; removed the now-dead `generateSignature` helper both
    fixes had left orphaned.
19. **Re-verified everything independently rather than trusting "27/27 green."** Those tests
    short-circuit in test mode before ever reaching the changed `fetch()` call (the exact L2 gap) —
    the real proof was always the live sandbox call, not the suite. Ran anyway, as a floor: money-
    service 7/7 suites (100/100 tests), monolith 5/5 suites (107/107 tests), `tsc --noEmit` clean
    both sides, `eslint --max-warnings 0` clean, `nest build` clean. Independently re-verified the
    3rd orphaned `Payment` row's deletion via a direct production DB query (`railway run --service
Postgres` + `PrismaPg` adapter) rather than trusting the claim — confirmed gone, 0 `PENDING` rows.
20. **Executed and got genuine positive proof F48 is fixed.** Committed (`ad7e57d1`), pushed
    (pre-push hook ran the full monolith suite, 122/122 suites, 2138/2138 tests). money-service
    redeployed clean (`Nest application successfully started`, zero DI errors). Flipped
    `MIGRATE_WRITE_APIS_MONEY_DLOCAL=true`, redeployed Vercel
    (`dpl_NUkyUTHXPoFDGoJoGVFYkxtpGci1`). Davin ran a real authenticated request; the HTTP response
    was `{"error":"Failed to create payment"}`, but money-service's logs showed
    `dLocal API error {"status":400,"error":"Missing parameter: payment_method_flow"}` — a `400`
    from dLocal's OWN payload-validation layer, which only runs AFTER credentials are accepted. This
    is direct, positive proof the signing/auth fix works — the prior failure mode was always `403`
    (credential rejection), never a `400`. **F48 is genuinely RESOLVED.**
21. **The `400` is a new bug, registered as F49, not F48 recurring.** `payment_method_flow` is a
    dLocal-required field the outbound request body has never included, on either side of the
    migration (grepped both `lib/dlocal/` and `money-service/src/dlocal/`: no code anywhere computes
    or references it). Per the standing "any red result = abort, revert" rule, reverted
    `MIGRATE_WRITE_APIS_MONEY_DLOCAL` to `false` and redeployed clean
    (`dpl_5qWfmQ7syPpFdb5LVAiMgPV91t6K`) immediately once this was confirmed live in the logs. The
    live test created a 4th orphaned `Payment` row (`cms7hlmb900000fmpz9i9fv1q`, status `PENDING`,
    independently confirmed via direct DB query — 0 other `PENDING` rows) — not deleted by the
    Executor (will not permanently delete production data even with authorization), flagged for
    Davin. New `LESSONS-LEARNED.md` **L35**: fixing the first bug in a request's path can unmask a
    second, previously-invisible bug in the same path — a live-fixed error changing SHAPE (403→400,
    dLocal code 3001→5001) is itself strong positive evidence, not a reason to treat the attempt as
    a failure.

**Net result of the continuation: still 3 of 4 groups cut over, unchanged in shape** —
`migration-cutover-table.md`'s Slice 4 row stays `CUT-OVER (partial: 3/4 groups)`. What changed is
the diagnosis: Group B is no longer blocked on F48 (that's closed), it's blocked on the
newly-discovered F49.

---

## Next-session handoff

**This order is effectively closed for Groups A/C/D (all cut over and stable).** Group B (dLocal) needs its own dedicated fix session, tracked via `DECISION-LOG.md` F49 (NOT F48 — F48 is RESOLVED, see Deviations 18-21), not a continuation of this VERIFY-RETIRE order:

1. **Fix F49** (dedicated PORT-shaped session, low scope): map each supported dLocal payment method
   (buckets already exist in `lib/dlocal/payment-methods.service.ts`'s `getPaymentMethodType` —
   wallet/bank/qr/card) to dLocal's real `payment_method_flow` value (typically `"REDIRECT"` for
   wallet/bank-redirect methods, `"DIRECT"` for card-capture), add it to the outbound request body
   in both `money-service/src/dlocal/dlocal-payment.service.ts` and the monolith's
   `lib/dlocal/dlocal-payment.service.ts`. Verify against dLocal's real sandbox API with a live call
   for at least one method per bucket before considering it fixed — same L2 blind spot as F48 had.
2. **Retry Group B** once F49 is fixed and verified, using the established live-test method (Davin
   runs the authenticated request via `Invoke-RestMethod`+`WebRequestSession`+cookie, Executor
   cross-checks money-service logs).
3. **Clean up the 4th orphaned `Payment` row** (`cms7hlmb900000fmpz9i9fv1q`) — Davin's own action,
   same as the prior three (including the 3rd, `cms79jwuw00000frzsiurqtk4`, already deleted and
   re-verified gone before this continuation started).
4. **Rotate the secrets exposed in item 12** (`CRON_SECRET`, `DATABASE_URL`, `NEXTAUTH_SECRET`, `REDIS_URL`, all 4 dLocal secrets) — still outstanding, Davin's own action on Railway.
5. Once Group B is genuinely cut over too, update `migration-cutover-table.md`'s Slice 4 row from partial to full `CUT-OVER`. **Session 4A-11 (Slice 5 / Outbox Email Worker BUILD) has already been PRE-DRAFTed in parallel** (`4a-11-outbox-email-worker.migration-order.md`, ad-hoc, 2026-07-30) — confirmed independent of Group B/dLocal specifically, per this item's own original allowance.
