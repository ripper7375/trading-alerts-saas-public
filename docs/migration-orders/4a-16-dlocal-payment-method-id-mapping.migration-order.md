# Migration Order — Session 4A-16 — dLocal Payment Method ID Mapping & Recutover

> For **cutovers, deletions, and exit reviews** combined with a small PORT-style fix: read
> `00-SKELETON-AND-RULES.md` first — §4 applies. This session mirrors the exact shape of Session
> 4A-14 (`4a-14-dlocal-write-api-group-b-cutover.migration-order.md`) — a small symmetrical PORT
> fix (dial **Low**) plus a CUTOVER block (dial **near zero**).
> **PRE-DRAFTed by the Executor post-10-3 (2026-08-24)**, upgraded to **DRAFT by the
> Advisor / Antigravity (2026-08-24)** per `MASTER-ROADMAP-PHASES-7-15.md` §3 (Phase 4X Gate) and `00-SKELETON-AND-RULES.md`.
> Closes `DECISION-LOG.md` **F76** (OPEN) and completes `migration-cutover-table.md` Slice 4 to
> 4/4 write-API groups — the final closing milestone of Phase 4X.

**Session:** 4A-16 (dLocal Payment Method ID Mapping & Recutover) · **Variant:** PORT + CUTOVER · **Status:** CLOSED SUCCESSFUL  
**Generated:** 2026-08-24 (Executor, PRE-DRAFT) · **Upgraded to DRAFT:** 2026-08-24 (Advisor / Antigravity) · **Approved:** 2026-08-24 (Davin) · **Confirmed:** 2026-08-24 (Executor — codebase/runtime re-verified fresh; Decisions 1 & 4 explicit live sign-off obtained in chat) · **Closed:** 2026-08-24 (Executor)  
**Flags touched:** F76 (OPEN → target RESOLVED), `MIGRATE_WRITE_APIS_MONEY_DLOCAL` (`false` → target `true`).  
**Estimated time:** ~2–3h (mapping implementation on monolith + money-service, real-fetch unit tests, Railway deploy, live test-mode payment verification, flag flip).  
**Target components:** `lib/dlocal/{payment-methods,dlocal-payment}.service.ts`, `money-service/src/dlocal/{payment-methods,dlocal-payment}.service.ts`, test suites on both sides.

---

## Decisions taken

> Four technical choices taken by the Advisor per `00-SKELETON-AND-RULES.md` §1.0 & `DECISION-LOG.md` PD1.
> Items touching real money movement and cutover flag flips carry **`⚠ NEEDS EXPLICIT SIGN-OFF`**.

1. **dLocal Payment Method Code Mapping Structure & Resolution `⚠ NEEDS EXPLICIT SIGN-OFF`**
   - **Chosen:** Implement an explicit country-aware mapping `DLOCAL_METHOD_CODE_MAP: Record<DLocalCountry, Record<string, string>>` and helper function `getDLocalMethodCode(country: DLocalCountry, displayName: string): string` in `payment-methods.service.ts` on both `money-service` and monolith. Map all 23 country/payment-method pairs (22 unique names) to dLocal's standard Payins API method codes:
     - **IN (India):** `UPI` → `'UP'`, `Paytm` → `'PAYTM'`, `PhonePe` → `'PHONEPE'`, `Net Banking` → `'NB'`
     - **TH (Thailand):** `TrueMoney` → `'TM'`, `Rabbit LINE Pay` → `'RLP'`, `Thai QR` → `'TH_QR'`
     - **VN (Vietnam):** `VNPay` → `'VNPAY'`, `MoMo` → `'MOMO'`, `ZaloPay` → `'ZALOPAY'`
     - **ID (Indonesia):** `GoPay` → `'GOPAY'`, `OVO` → `'OVO'`, `Dana` → `'DANA'`, `ShopeePay` → `'SHOPEEPAY'`
     - **NG (Nigeria):** `Bank Transfer` → `'BANK_TRANSFER'`, `USSD` → `'USSD'`, `Paystack` → `'PAYSTACK'`
     - **PK (Pakistan):** `JazzCash` → `'JAZZCASH'`, `Easypaisa` → `'EASYPAISA'`
     - **ZA (South Africa):** `Instant EFT` → `'INSTANT_EFT'`, `EFT` → `'EFT'`
     - **TR (Turkey):** `Bank Transfer` → `'BANK_TRANSFER'`, `Local Cards` → `'CARD'`
       Fail loud: if an unknown display name is supplied, throw a `BadRequestException` / Error immediately rather than sending unmapped display strings.
   - **Rejected:** Sending display strings as `payment_method_id` (causes `5010 Method not available`), or using fuzzy/lowercase string conversion.
   - **Why:** dLocal's Payins API strictly validates `payment_method_id` against its supported method code catalog for the specified country.
   - **How hard to undo:** Trivial — plain TypeScript lookup map.

2. **Flow Parameter Integrity (`payment_method_flow: 'REDIRECT'`)**
   - **Chosen:** Retain `payment_method_flow: 'REDIRECT'` (fixed in Session 4A-14, F49) across all mapped redirect/wallet/bank payment methods.
   - **Rejected:** Introducing card-capture DIRECT flows or complex multi-flow branching.
   - **Why:** All 8 supported countries in this integration utilize hosted redirect/checkout flows where dLocal returns a `redirect_url` for the user to complete payment.
   - **How hard to undo:** Non-destructive parameter preservation.

3. **Real-Fetch-Path Unit Test Verification Standard**
   - **Chosen:** Enforce real-fetch-path test assertions in `money-service/src/dlocal/dlocal-payment.service.spec.ts` and `__tests__/lib/dlocal/dlocal-payment.test.ts`. Use `jest.resetModules()` + env override (per 4A-14 precedent) to force execution past the `NODE_ENV === 'test'` mock branch and assert the exact JSON payload sent to `fetch()` contains the mapped `payment_method_id`.
   - **Rejected:** Relying on shallow mock tests that never assert outbound request serialization.
   - **Why:** Guarantees zero regression on request body formatting without requiring active cloud credentials during unit test execution.
   - **How hard to undo:** Non-destructive test harness.

4. **Production Cutover Protocol (`MIGRATE_WRITE_APIS_MONEY_DLOCAL`) `⚠ NEEDS EXPLICIT SIGN-OFF`**
   - **Chosen:** Execute a strict, phased cutover sequence:
     1. Deploy `money-service` to Railway and verify `Online` via `GET /health`.
     2. Verify monolith forwards `/api/payments/dlocal/create` to `money-service` when flag is true.
     3. Davin provides explicit live authorization (`EXECUTOR-PROTOCOL.md` §7) to flip `MIGRATE_WRITE_APIS_MONEY_DLOCAL=true` on Vercel production.
     4. Davin executes a live test-mode checkout for TH/TrueMoney (the case that failed at 4A-14) to confirm `201 Created` with valid `paymentUrl` and `Payment(PENDING)` record.
     5. If any error or `5010` occurs, immediately revert flag to `false` (0ms rollback).
   - **Rejected:** Flipping flag without live smoke confirmation, or proceeding without explicit Authorizer sign-off.
   - **Why:** Real money write path. Protects payment processing continuity with immediate rollback capability.
   - **How hard to undo:** 0ms flag flip in Vercel environment variables.

---

## Why this session exists

Slice 4 (Write APIs) of `migration-cutover-table.md` has stood at 3/4 groups since Session 4A-10b/10c (Stripe, Admin, and Disbursement are live; dLocal Group B is pending):

- **F48** (dLocal outbound signing) — RESOLVED in Session 4A-10c.
- **F49** (missing `payment_method_flow`) — RESOLVED in Session 4A-14.
- **F76** (dLocal `payment_method_id` display-name bug) — Unmasked during 4A-14 live smoke test: `400 {"code":5010,"message":"Method not available"}` on TH/TrueMoney. `createPayment()` sends `payment_method_id: request.paymentMethod` verbatim (display name `'TrueMoney'`), which dLocal rejects because it expects internal code `'TM'`.

Fixing F76 resolves the pre-existing bug on both monolith and `money-service`, allows flipping `MIGRATE_WRITE_APIS_MONEY_DLOCAL=true`, completes Slice 4 to **4/4 groups**, and satisfies the mandatory Phase 4X gate required before Phase 8A (Session 8-1 Deletion Sweep) can open.

---

## Entry criteria (re-verify all at CONFIRM)

- [x] `DECISION-LOG.md` **F76** reviewed — confirmed OPEN, scope unchanged.
- [x] **Method code mapping table verified** — 23 country/method pairs (22 unique display names — corrected from the order's own "18") mapped to dLocal API method codes in Decisions taken §1, supplied by Davin live in chat, not the roadmap's placeholder examples.
- [x] **Baseline test suites 100% green**:
  - Monolith `test:ci`: 153/153 suites, 2198/2198 tests.
  - `operation-service`: 42/42 suites, 395/395 tests.
  - `money-service`: 62/62 suites, 526/526 tests.
- [x] **Railway money-service reachable**: `GET https://money-service-production.up.railway.app/health` returns `200 OK`.
- [x] **Davin present and available** — live sign-off required for Step 5 cutover flag flip (`EXECUTOR-PROTOCOL.md` §7).

---

## Ordered Steps

_(each step = change → immediate verification → rollback note)_

### Step 1: Implement Method Code Mapping in `money-service`

- **Action:**
  1. In `money-service/src/dlocal/payment-methods.service.ts`:
     - Add `DLOCAL_METHOD_CODE_MAP` and export `getDLocalMethodCode(country: DLocalCountry, displayName: string): string`.
  2. In `money-service/src/dlocal/dlocal-payment.service.ts`:
     - Update `createPayment()` to resolve `payment_method_id`:
       `payment_method_id: getDLocalMethodCode(request.country, request.paymentMethod)`
  3. In `money-service/src/dlocal/dlocal-payment.service.spec.ts` & `payment-methods.service.spec.ts`:
     - Add unit tests verifying `getDLocalMethodCode` maps all 18 methods correctly.
     - Add real-fetch-path test using `jest.resetModules()` asserting outbound `payment_method_id` is mapped (e.g. `'TM'` for `'TrueMoney'`).
- **Verify:** Run `pnpm --filter money-service test` (62/62 suites pass, test count +2).
- **Rollback:** `git checkout -- money-service/src/dlocal/`.

### Step 2: Symmetrical Fix in Monolith

- **Action:**
  1. In `lib/dlocal/payment-methods.service.ts`:
     - Add identical `DLOCAL_METHOD_CODE_MAP` and export `getDLocalMethodCode(country: DLocalCountry, displayName: string): string`.
  2. In `lib/dlocal/dlocal-payment.service.ts`:
     - Update `createPayment()` to resolve `payment_method_id`:
       `payment_method_id: getDLocalMethodCode(request.country, request.paymentMethod)`
  3. In `__tests__/lib/dlocal/dlocal-payment.test.ts`:
     - Add real-fetch-path test asserting `payment_method_id: 'TM'` when `paymentMethod: 'TrueMoney'`.
- **Verify:** Run `npm run test:ci` (153/153 suites pass).
- **Rollback:** `git checkout -- lib/dlocal/ __tests__/lib/dlocal/`.

### Step 3: Type Check, Lint & Deploy `money-service`

- **Action:**
  - Run `npm run validate:types` and `npx eslint app components lib hooks --max-warnings 0`.
  - Deploy updated `money-service` to Railway.
  - Verify deployment status `Online` via `GET /health`.
- **Verify:** `money-service` `/health` returns 200 `status: 'ok'`.
- **Rollback:** Revert Railway deployment to previous release if health check fails.

### Step 4: Cutover Flag Flip `⚠ NEEDS EXPLICIT SIGN-OFF`

- **Action:**
  - Davin authorizes flag flip (`EXECUTOR-PROTOCOL.md` §7).
  - Set `MIGRATE_WRITE_APIS_MONEY_DLOCAL=true` on Vercel production environment variables.
  - Trigger Vercel production redeploy so function instances pick up the new flag value.
- **Verify:** Confirm live Vercel environment variable `MIGRATE_WRITE_APIS_MONEY_DLOCAL=true`.
- **Rollback:** Set `MIGRATE_WRITE_APIS_MONEY_DLOCAL=false` on Vercel and redeploy immediately.

### Step 5: Live Smoke Test

- **Action:**
  - Execute a live test-mode checkout request through `POST /api/payments/dlocal/create` with `country: 'TH'`, `paymentMethod: 'TrueMoney'`, `amount: 29.0`, `currency: 'THB'`, `planType: 'MONTHLY'`.
  - Inspect `money-service` HTTP logs and response.
- **Verify:**
  - Request routes to `money-service` (`DlocalPaymentController.createPayment`).
  - Response is `201 Created` with valid `paymentId` and `paymentUrl`.
  - **Zero** `5010 Method not available` errors.
  - Postgres `Payment` record created with `status: PENDING`, `provider: DLOCAL`, `country: TH`.
- **Rollback:** Revert `MIGRATE_WRITE_APIS_MONEY_DLOCAL=false` if smoke test encounters any error.

### Step 6: Session Close-Out & Phase 4X Formal Closure

- **Action:**
  - Update `docs/migration-orders/migration-cutover-table.md`: Slice 4 → **CUT-OVER (4/4 groups)**.
  - Update `docs/migration-orders/DECISION-LOG.md`: Mark **F76** as **`RESOLVED`**.
  - Update `CLAUDE.md`: Current entry Session 4A-16 CLOSED SUCCESSFUL, Phase 4X **CLOSED SUCCESSFUL**.
  - Re-verify `docs/migration-orders/8-1-deletion-sweep.migration-order.md` entry criteria ("Phase 4X CLOSED" is now true).
- **Verify:** Full test baselines green across all three suites.
- **Rollback:** None.

---

## Rules specific to this variant

- **Real money escalation rule:** Any unexpected error during Step 5 triggers immediate rollback to `MIGRATE_WRITE_APIS_MONEY_DLOCAL=false`.
- **Preserve idempotency locks:** Do not modify `acquireCreatePaymentLock`'s 30s Redis dedupe logic.
- **No unmapped display strings:** Throw descriptive `BadRequestException` if a payment method display name has no mapped code.

---

## Done when

- [x] `DLOCAL_METHOD_CODE_MAP` implemented and unit-tested in both `money-service` and monolith.
- [x] `money-service` deployed to Railway with `/health` returning 200.
- [x] `MIGRATE_WRITE_APIS_MONEY_DLOCAL=true` flipped on Vercel production.
- [x] Live TH/TrueMoney test-mode payment succeeds without `5010 Method not available`.
- [x] Slice 4 in `migration-cutover-table.md` updated to **CUT-OVER (4/4 groups)**.
- [x] **F76** marked **RESOLVED** in `DECISION-LOG.md`.
- [x] Phase 4X declared **CLOSED SUCCESSFUL**.
- [x] Baseline test suites 100% green.

---

## Rollback

- **0ms Primary Rollback:** Set `MIGRATE_WRITE_APIS_MONEY_DLOCAL=false` on Vercel production and redeploy.
- **Code Rollback:** `git revert` Step 1 & Step 2 commits.

---

## Deviations

1. **Order approval status was self-contradictory across two CONFIRM passes in the same session.**
   First read showed `Status: DRAFT`, no Davin approval line, uncommitted working copy. A re-read
   minutes later (same session, requested again by Davin) showed `Status: APPROVED` with an
   approval stamp that appeared with no corroborating record anywhere (`DECISION-LOG.md`, this
   file, git history). Treated per `LESSONS-LEARNED.md` L3 — not silently trusted, asked Davin
   directly and named the specific concern (Decision 1's codes matched the roadmap's own
   explicitly-labeled unconfirmed placeholders with no new verification cited). Davin confirmed
   authenticity live and gave separate explicit sign-off on both `⚠ NEEDS EXPLICIT SIGN-OFF` items.
2. **Method-code count corrected: "18" → 23 pairs (22 unique names).** The order's own Entry
   Criteria and Step 1 text said "18 display names"; the live `PAYMENT_METHODS` table in
   `lib/dlocal/constants.ts` and the Decisions-taken table itself both actually total 23
   country/method pairs across 8 countries (22 unique names, `Bank Transfer` shared by NG/TR).
   Implemented and tested against the real count, not the order's stated one.
3. **Test file path corrected.** Step 2's action item 3 named
   `__tests__/lib/dlocal/dlocal-payment.service.test.ts`, which does not exist. The real file is
   `__tests__/lib/dlocal/dlocal-payment.test.ts` (no `.service` in the name) — used the real path.
4. **Real, pre-existing repo bug found and fixed while executing Step 3 (deploy).** `railway up`
   failed the build with `TS2307: Cannot find module './dlocal/dlocal.module'` (and the same for
   `riseworks`). Root cause: root `.railwayignore`'s unanchored `dlocal`/`riseworks` patterns
   (intended only for the two top-level reference folders of the same name) were also matching
   `money-service/src/dlocal/` and `money-service/src/riseworks/`, silently stripping both modules
   from every CLI-driven upload. Not introduced this session — pre-existing, apparently never
   exercised via `railway up` before in this migration's history (prior money-service deploys were
   presumably git-push-triggered). Fixed by anchoring both patterns with a leading `/` (root-only),
   in scope because it directly blocked this session's own explicit deliverable, not drive-by
   scope creep. Redeployed clean, confirmed via a direct `/health` check showing a fresh `uptime`
   (18.8s) rather than trusting `railway status`/`railway logs` alone (`LESSONS-LEARNED.md` L13 —
   the first `railway logs --build` check, without `--latest`, showed the _previous_ successful
   build and masked the real failure until `--latest` was used).
5. **Steps 4 and 5 executed by Davin directly, not the Executor.** This environment has no Vercel
   CLI/credentials — the Executor cannot flip a Vercel production environment variable or run a
   checkout as a live user. This matches the order's own Decision 4/Step 5 design, which already
   assigns the flag-flip authorization and the live checkout to Davin personally, not the Executor.
   Davin reported: monolith forwarded correctly, dLocal accepted `payment_method_id: 'TM'` with
   zero `5010` errors, real redirect URL returned and followed. Independently cross-checked against
   money-service's own first-party structured logs (not just the report): `Creating payment`
   (country=TH, paymentMethod=TrueMoney) → `Payment record created`
   (`paymentId: cmt6fo3ty00000fnwahf0e8v8`) → `Creating dLocal payment` → `dLocal payment created`
   (`paymentId: R-1804074-g1l8n07m-oumvi7djjl1gpc-2o922ds992v0`, matching Davin's reported redirect
   URL exactly), zero error-level log lines. `provider: 'DLOCAL'`/`status: 'PENDING'` confirmed
   hardcoded (not response-derived) by reading `dlocal-payment.controller.ts`'s
   `prisma.payment.create()` call directly.
6. **A direct Postgres row read was attempted for full verification and had no path from this
   environment.** `pgbouncer.railway.internal` is unreachable from a local shell, including via
   `railway run` (which injects env vars locally but doesn't proxy onto Railway's private network);
   `railway ssh` requires an SSH key not present in this environment, and one was not generated for
   a one-off read. Disclosed rather than silently skipped — logs plus the deterministic code path
   (Deviation 5) are the verification of record, not a raw DB read.
7. **Both prior orphaned `Payment` rows remain outstanding, unchanged, flagged again for Davin:**
   `cms7hlmb900000fmpz9i9fv1q` (4A-10c) and `cmt2yflxe00000fnw8gy7jm53` (4A-14). Not this session's
   job to clean up per standing practice; not touched.
8. **Candidate lesson, not promoted** (`LESSONS-LEARNED.md` stays at its 40-entry cap): Deviation 4
   is a genuinely new failure class — a repo-root ignore-file pattern colliding with a nested
   service's own source directory of the same name, silently dropping modules from a CLI-driven
   deploy with no error until the build fails downstream. Added as a new sub-rule under the
   existing L19 (Railway deployment/networking/config-presence gotchas) rather than a new numbered
   entry, consistent with that lesson's own established multi-rule format.

---

## Next-session handoff

- **Next session:** `8-1` — Deletion sweep (Phase 8A — Decommission, part 1).
- **Status:** Already PRE-DRAFTed (`8-1-deletion-sweep.migration-order.md`). With Phase 4X closed, its Phase 4X entry criterion is satisfied.
- **Prerequisite:** Session 4A-16 CLOSED SUCCESSFUL.
