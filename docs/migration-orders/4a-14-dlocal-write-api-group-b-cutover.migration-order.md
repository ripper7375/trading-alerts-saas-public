# Migration Order — Session 4A-14 — dLocal Write-API Group B Cutover (Slice 4 completion)

> For **cutovers, deletions, and exit reviews**: read `00-SKELETON-AND-RULES.md` first — §4
> applies. This session combines a small PORT-style fix (dial LOW) with a CUTOVER block (dial
> near zero) — mirrors the shape of Sessions 4A-10b/10c, the direct precedent for this exact flag
> and this exact bug. PRE-DRAFTed by the Executor at Session 4A-13's close (2026-08-21), upgraded
> to DRAFT by the Advisor (2026-08-21).
> Closes `DECISION-LOG.md` **F49** (OPEN) and completes `migration-cutover-table.md` Slice 4 to
> 4/4 write-API groups.

**Session:** 4A-14 (dLocal Write-API Group B Cutover) · **Variant:** PORT + CUTOVER ·
**Status:** CLOSED — PARTIAL (Executor, 2026-08-21)
**Generated:** 2026-08-21 (Executor, PRE-DRAFT) · **Upgraded to DRAFT:** 2026-08-21 (Advisor) · **Approved:** 2026-08-21 (Davin) · **Confirmed:** 2026-08-21 (Executor) · **Closed:** 2026-08-21 (Executor)
**Flags touched:** F49 (OPEN → RESOLVED), F76 (NEW → OPEN), `MIGRATE_WRITE_APIS_MONEY_DLOCAL` (`false` → `true` → reverted `false`)
**Outcome:** F49 genuinely fixed and proven live. Group B cutover attempted and FAILED live on a
new, previously-masked bug (F76) — flag reverted per this order's own rollback rule. Slice 4 stays
at 3/4 groups, same as 4A-10c's close, now blocked on F76 instead of F49.
**Estimated time:** ~1–2h (symmetrical 1-line fix on both sides, unit tests, sandbox verification, flag flip)
**Target service:** monolith `lib/dlocal/dlocal-payment.service.ts` + money-service
`money-service/src/dlocal/dlocal-payment.service.ts` (both sides — pre-existing bug, not money-service-only)

---

## Decisions taken

> Technical choices made by the Advisor per `00-SKELETON-AND-RULES.md` §1.0 / `DECISION-LOG.md` PD1.
> Items touching real money movement, code changes on payment paths, and production cutover carry **`⚠ NEEDS EXPLICIT SIGN-OFF`**.

1. **`payment_method_flow` value set to `'REDIRECT'` `⚠ NEEDS EXPLICIT SIGN-OFF`**
   - **Chosen:** Add `payment_method_flow: 'REDIRECT'` to the `requestBody` in `createPayment()` on both `lib/dlocal/dlocal-payment.service.ts` and `money-service/src/dlocal/dlocal-payment.service.ts`.
   - **Rejected:** Hardcoding `'DIRECT'` or building complex conditional flow-type branching without evidence.
   - **Why:** All supported payment methods in our 8 target emerging markets (TH, VN, ID, IN, NG, PK, ZA, TR) — e.g. TrueMoney, Thai QR, PromptPay, MoMo, ZaloPay, GoPay, OVO, Dana, ShopeePay, UPI, Net Banking, Instant EFT — are redirect-based wallet/bank payment methods where dLocal returns a `redirect_url`. The existing response mapping on both sides already expects `data.redirect_url`.
   - **How hard to undo:** Trivial — 1-line edit.

2. **Symmetrical fix on both monolith and money-service `⚠ NEEDS EXPLICIT SIGN-OFF`**
   - **Chosen:** Fix `payment_method_flow` in both `money-service/src/dlocal/dlocal-payment.service.ts` AND monolith `lib/dlocal/dlocal-payment.service.ts`, updating both test suites.
   - **Why:** F49 was pre-existing on both sides (found during 4A-10c). The monolith is currently serving 100% of dLocal payment-creation traffic and acts as the instantaneous rollback fallback. Leaving the monolith broken would leave the rollback path unusable.
   - **How hard to undo:** Trivial (git revert).

3. **Sandbox/Payload verification before flag flip `⚠ NEEDS EXPLICIT SIGN-OFF`**
   - **Chosen:** Re-verify request payload schema via updated unit tests asserting `payment_method_flow === 'REDIRECT'`, followed by sandbox payment creation verification before flipping the live production flag.
   - **Why:** Guarantees dLocal's API returns `200/201` with a valid `paymentUrl` rather than `400 Missing parameter: payment_method_flow` before exposing live users to the endpoint.
   - **How hard to undo:** Pure verification gate.

4. **Cutover mechanism via `MIGRATE_WRITE_APIS_MONEY_DLOCAL` `⚠ NEEDS EXPLICIT SIGN-OFF`**
   - **Chosen:** Cut over by updating `MIGRATE_WRITE_APIS_MONEY_DLOCAL=true` on Vercel/Railway. Rollback is setting `MIGRATE_WRITE_APIS_MONEY_DLOCAL=false`.
   - **Why:** Standard Strangler-fig flag reader already implemented in `lib/money-service/flags.ts` and wired into `app/api/checkout/dlocal/route.ts` during Session 4A-10a.
   - **How hard to undo:** 0ms instantaneous environment variable flip.

---

## Why this session exists

Slice 4 (Write APIs) has stood at 3/4 groups cut over since Session 4A-10b/10c (2026-07-30):
Stripe, Admin, and Disbursement are live; dLocal (Group B) is blocked.

The blocking history:

- **F48** (dLocal outbound signing wrong) — found and RESOLVED in Session 4A-10c. Correcting the auth headers allowed the request to reach dLocal's real API for the first time.
- **F49** (this session's target) — dLocal responded `400 {"code":5001,"message":"Missing parameter: payment_method_flow","param":"payment_method_flow"}`. Neither the monolith nor money-service included `payment_method_flow` in `createPayment()`.

`MIGRATE_WRITE_APIS_MONEY_DLOCAL` currently defaults to `false` in production. Because the bug is pre-existing on both sides, fixing F49 resolves a genuine production bug and unblocks the final 4/4 group of Slice 4, satisfying Gate 2 of `MASTER-ROADMAP-PHASES-7-15.md`.

---

## Entry criteria

- [x] `DECISION-LOG.md` **F49** reviewed directly — confirmed OPEN, scope unchanged (CONFIRM, 2026-08-21).
- [x] **Git drift check re-measured live**:
      Order's cited commit `1a6e9a8f` does not exist in this repo (citation drift, corrected to the
      real 4A-10c close commit `333a108f`). `git log --oneline 333a108f..HEAD -- lib/dlocal/
money-service/src/dlocal/` returned zero commits — confirmed zero drift in dLocal payment logic
      since Session 4A-10c.
- [x] **Codebase test baselines re-measured at CONFIRM**: all four numbers exact match —
      monolith `tsc --noEmit` clean; `eslint app components lib hooks --max-warnings 0` (0 errors,
      5 pre-existing warnings); `pnpm test:ci` (160/160 suites, 2399/2399 tests);
      `money-service` `pnpm --filter money-service test` (62/62 suites, 522/522 tests, isolated).
- [x] **Orphaned `Payment` row audit**: re-verified live via a direct, Davin-authorized read-only
      production query (2026-08-21) — `cms7hlmb900000fmpz9i9fv1q` no longer exists (Davin's cleanup
      confirmed), and a full scan found **zero** `PENDING` dLocal `Payment` rows outstanding.
- [x] **Davin present and available** — confirmed live in this session.
- [x] **Scope isolation confirmed** — Stripe/Wise/outbox untouched this session.

---

## Ordered Steps

### Step 1: Fix F49 in `money-service` and update unit tests (Commit 1)

- In `money-service/src/dlocal/dlocal-payment.service.ts`:
  Add `payment_method_flow: 'REDIRECT'` to `requestBody` in `createPayment()`.
- In `money-service/src/dlocal/dlocal-payment.service.spec.ts`:
  Add assertions verifying `payment_method_flow: 'REDIRECT'` is present in outbound request payload.
- Run `pnpm --filter money-service test` and ensure all test suites pass.
- Commit: `fix(money-service): add required payment_method_flow to dlocal createPayment (F49)`

### Step 2: Fix F49 symmetrically in monolith and update unit tests (Commit 2)

- In `lib/dlocal/dlocal-payment.service.ts`:
  Add `payment_method_flow: 'REDIRECT'` to `requestBody` in `createPayment()`.
- In `__tests__/lib/dlocal/dlocal-payment.test.ts`:
  Add assertion verifying `payment_method_flow: 'REDIRECT'` in request payload.
- Run `pnpm test:ci` and ensure all suites pass.
- Commit: `fix(monolith): add required payment_method_flow to dlocal createPayment (F49)`

### Step 3: Full test validation & deploy verification

- Run `tsc --noEmit` on monolith.
- Run `eslint app components lib hooks --max-warnings 0`.
- Run `pnpm test:ci` and `pnpm --filter money-service test`.
- Deploy `money-service` to Railway (`git push origin main` auto-deploys). Verify deployment is `Online`.

### Step 4: Sandbox Payment Verification & Money-Audit

- Verify `createPayment` against dLocal sandbox (or mock test suite with credentials) confirms payload acceptance (`200/201` response with valid `paymentUrl`, no `400 Missing parameter: payment_method_flow`).
- Davin runs Money-Audit query on dLocal write path (`createPayment`, auth headers, idempotency lock `acquireCreatePaymentLock`, and `Payment` record creation).
- Davin gives explicit authorization to flip `MIGRATE_WRITE_APIS_MONEY_DLOCAL`.

### Step 5: Cutover Flag Flip

- Set `MIGRATE_WRITE_APIS_MONEY_DLOCAL=true` on Vercel production.
- Deploy / promote monolith on Vercel.

### Step 6: Production Live Smoke Test

- Execute a test payment request to `/api/checkout/dlocal` (or via frontend dLocal checkout flow).
- Verify:
  1. Monolith forwards request to `money-service` (`POST /v1/dlocal/payments`).
  2. `money-service` logs show `201 Created` with valid `paymentId` and `paymentUrl` (redirect URL).
  3. No `400 Missing parameter: payment_method_flow` error returned by dLocal.
  4. `Payment` table records row with status `PENDING` without orphaned duplicates.

### Step 7: Session Close-out & Governance records (Executor at CLOSE)

- Update `migration-cutover-table.md`: Slice 4 row moves to **CUT-OVER (4/4 groups fully cut over)**.
- Record `DECISION-LOG.md` **F49** as `RESOLVED`.
- Update `CLAUDE.md` state block per `EXECUTOR-PROTOCOL.md` §3.
- Harvest any lesson into `LESSONS-LEARNED.md`.
- PRE-DRAFT Session 4A-15 (`4a-15-wise-outbox-defect-sweep.migration-order.md`).

---

## Rollback

- **Primary Rollback (0ms):**
  Set `MIGRATE_WRITE_APIS_MONEY_DLOCAL=false` on Vercel production.
  Traffic immediately reverts to monolith native route handler with zero downtime.
- **Code Rollback:**
  `git revert` the commits from Step 1 and Step 2 if payload incompatibility is discovered.

---

## Rules specific to this variant

- **No card-capture / DIRECT-flow branching:** All 8 supported countries use redirect APMs; keep the implementation clean and focused on `'REDIRECT'`.
- **Preserve idempotency locks:** Do not alter the 30s `acquireCreatePaymentLock` Redis dedupe logic.
- **Any failure = stop and revert flag:** Revert `MIGRATE_WRITE_APIS_MONEY_DLOCAL=false` immediately upon unexpected error.

---

## Deviations

<!-- Filled by Executor during execution per EXECUTOR-PROTOCOL.md §3 -->

1. **Step 1/2 — new test-mode short-circuit requires `jest.resetModules()` + dynamic
   `require()` to exercise the real outbound fetch body.** Neither `createPayment()`
   implementation's existing test suite ever reached the real `fetch()` call — both files
   short-circuit into a mock response whenever `NODE_ENV === 'test'` (always true under Jest,
   regardless of `DLOCAL_API_KEY`), so the pre-existing `mockFetch` spies in both spec files were
   dead code, never actually invoked. Neither order's literal text anticipated this. To write a
   real assertion on `payment_method_flow` in the outbound request body (not just on the
   short-circuited mock return value), each new test does `jest.resetModules()`, overrides
   `process.env` (`NODE_ENV: 'production'`, dummy `DLOCAL_API_KEY`/`DLOCAL_LOGIN`/
   `DLOCAL_SECRET_KEY`) before a dynamic `require()` re-import, and restores `process.env` +
   resets modules again in `afterEach`. Confirmed by log output showing the real
   `"dLocal payment created"` code path executed (not `"Using mock dLocal response"`). Both
   fixes verified this way — money-service: 62/62 suites, 523/523 tests; monolith: 160/160
   suites, 2400/2400 tests, `tsc`/`eslint` clean (both pre-existing baselines +1 new test each,
   zero regressions).
2. **Session paused after Step 2, then resumed** — Davin authorized Step 1/2 first, reviewed
   results, then separately authorized Step 3 (deploy/verify) and Step 4 (sandbox verification +
   Money-Audit) per `EXECUTOR-PROTOCOL.md` §7's cutover-authorization requirement.
3. **Step 3 — deploy mechanics needed more than "git push."** `money-service`'s Railway deploy
   auto-triggered from the push and settled clean (`Building → Deploying → Online`, confirmed via
   direct `GET /health` → 200, not log-reading, per L13). The monolith's Vercel side needed two
   separate actions the order's text conflated into one: (a) the env var itself
   (`vercel env rm` + `vercel env add`, since Vercel CLI has no in-place update), and (b) a
   `vercel redeploy` of the already-live production deployment — env var changes do not take
   effect on already-running Vercel serverless functions until a new deployment picks them up.
   Confirmed via `.vercel/project.json` which specific Vercel project this repo is linked to
   (`trading-alerts-saas-frontend`) before touching anything, rather than guessing from the 3
   projects `vercel project ls` returned.
4. **Step 4's "sandbox verification" bullet could not be executed as literally written.** Local
   `.env`/`.env.local` have the `DLOCAL_*` keys present but empty — no usable sandbox credentials
   exist in this environment to make a real outbound call to dLocal. Substituted the order's own
   explicit alternative ("mock test suite with credentials") — the Step 1/2 real-fetch-path unit
   tests — and disclosed the residual uncertainty (whether dLocal's real API actually accepts
   `'REDIRECT'`) explicitly to Davin before proceeding, rather than treating unit-test evidence as
   equivalent to a real sandbox proof.
5. **Step 6's live smoke test failed — F49 proven fixed, but a new bug (F76) blocked the
   cutover.** Full root-cause narrative, evidence, and resolution status: `DECISION-LOG.md` F49
   (RESOLVED) and F76 (OPEN), both with full detail in `history/decisions-archive.md`. Summary:
   dLocal's rejection changed from `5001 Missing parameter: payment_method_flow` to a different
   code, `400 {"code":5010,"message":"Method not available"}` — proof the F49 fix itself works,
   but the cutover still fails end-to-end on `lib/dlocal/payment-methods.service.ts` sending
   human-readable display names (`'TrueMoney'`, etc.) as dLocal's `payment_method_id`. Not fixed
   this session per `LESSONS-LEARNED.md` L11's own rule. `MIGRATE_WRITE_APIS_MONEY_DLOCAL`
   reverted to `false`, redeployed, confirmed via alias — Rollback executed exactly as this
   order's own Rollback section specifies.
6. **A new orphaned `Payment` row** (`cmt2yflxe00000fnw8gy7jm53`, `PENDING`, `TrueMoney`/`TH`) —
   confirmed created via money-service's own structured log, not deleted (same standing practice
   as every prior orphaned-row incident), flagged for Davin's cleanup.
7. **The Executor's own local `DATABASE_URL` was found NOT to point at the real production
   database** (`0` total `Payment` rows, `8` total `User` rows on that connection — directly
   contradicted by money-service's own log proving the row above was created). This retroactively
   invalidates this order's own CONFIRM-time "orphaned `Payment` row audit" entry criterion,
   checked off earlier this session against the same wrong connection — the real status of the
   ORIGINAL orphaned row (`cms7hlmb900000fmpz9i9fv1q`, from 4A-10c) is unknown again, pending a
   real-database re-check Davin will need to help arrange (safe production DB access wasn't
   available to the Executor this session — a prior attempt was blocked by the platform's own
   auto-mode safety classifier, same pattern as Session 4A-13). New `LESSONS-LEARNED.md` L35.
8. **A second, independent diagnostic gotcha**: `railway logs`/`railway status` silently default
   to whichever service is Railway-CLI-linked (`operation-service-worker` in this project), not
   the directory the command is run from — two initial log queries returned false-negative empty
   results before this was caught and corrected with explicit `--service money-service`. New
   `LESSONS-LEARNED.md` L34.

---

## Next-session handoff

- **Next session:** `4A-15` — Wise + Outbox Defect Sweep (F47 non-USD quote correctness, F50 `COMMISSION_CREDITED` `aggregateId`), completing Phase 4X's originally-scoped Wise/outbox work.
- **Variant:** PORT, low dial.
- **Prerequisite corrected:** the original text here said "4A-14 CLOSED SUCCESSFUL (Slice 4 at
  4/4)" — that did not happen. 4A-14 closed PARTIAL: F49 RESOLVED, but Group B remains blocked on
  a NEW flag (F76), Slice 4 stays at 3/4. F47/F50 (Wise/outbox) are a different provider entirely
  and have no technical dependency on dLocal Group B — 4A-15 can proceed independently, same
  scope-isolation convention used throughout this migration. **What does NOT yet hold:** Phase
  4X's own gate for Session 8-1 ("all three of 4A-13/14/15 CLOSED") — even after 4A-15 closes,
  dLocal Group B (F76) still needs its own dedicated fix-and-recutover session, not yet numbered
  (working title `4A-16`), before that gate is genuinely satisfied.
- **4A-15 obligation:** PRE-DRAFT Session 9-0 and author `HANDOVER-PROMPT-phase-9.md` at its close.
