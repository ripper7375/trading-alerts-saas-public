# CLAUDE.md — Executor State & Standing Rules (Migration Mode)

> **This repo is in MIGRATION MODE.**
> **Role Distinction:**
>
> - **In Antigravity Chat UI:** You act as **Antigravity (Advisor & Architect)** — planning, drafting migration orders, reviewing codebase decisions, guiding Davin.
> - **In Terminal CLI:** You act as **Claude Code (Executor)** in the three-role Development Chain Protocol — running shell commands, executing code edits, running unit tests, git commits.
>   Full operating manual: `docs/migration-orders/EXECUTOR-PROTOCOL.md` — **read it at the start of every session before doing anything else.**
>   The previous content of this file (Aider validation guide) moved to
>   `docs/AIDER-VALIDATION-GUIDE-legacy.md`; its validation commands are still used (see manual).

---

## Current state _(update at the end of EVERY session)_

> **STANDING INSTRUCTION (Davin, 2026-07-22, NARROWED 2026-07-24 — still in force
> until Davin lifts it further):** chain-length-one originally read as "webhooks cut
> over FIRST (both providers), before 4A-7 or any Slice 4 work." **Davin confirmed
> live, 2026-07-24, that this narrows to dLocal-cutover-first**: with dLocal now
> CUT-OVER (Session 4A-5, see Current below), 4A-7/Slice 4 work is unblocked — it does
> NOT need to wait for RiseWorks. RiseWorks's own cutover (`4A-5-RW`) trails
> independently, gated on RiseWorks replying with webhook/API settings (see Waiting on).
> **Session 4A-3 (below) was an explicit, scoped exception Davin asked for directly in
> chat — Slice 1 (crons) cutover, independent of this question — not itself a lifting
> of the standing instruction.** With dLocal cut over too, Slice 3/4 BUILD work (4A-7
> onward) may now proceed; RiseWorks-specific work stays gated on `4A-5-RW`'s own entry
> criteria.

- **Current:** Session 4A-11 (Slice 5 Outbox Email Worker BUILD, PORT variant), CONFIRMED and
  executed 2026-07-30 — zero traffic cut over, same BUILD/CUTOVER split as every prior write-path
  slice (4A-9/10, 4A-W6/W7). Davin approved the Advisor's DRAFT live in chat; CONFIRM re-verified
  the file inventory (all 7 cited SOURCE line counts exact matches), both services' full test-suite
  baselines (money-service 59/59/506/506, operation-service 7/7/56/56), and value-blind confirmed
  `OUTBOX_PUBLISHER_ENABLED`/`OUTBOX_PUBLISHER_TARGET_URL` still absent on money-service production
  — all 5 entry criteria passed.
  **Built (5 files, one commit each):** `operation-service/src/email/subscription-email.util.ts`
  (File 1 — ports 5 of `lib/email/subscription-emails.ts`'s 8 functions verbatim: cancellation,
  payment-failed, payment-receipt, subscription-canceled, affiliate-commission; drops the
  confirmed-dead-in-monolith upgrade template and the out-of-event-scope renewal reminder; no
  SOURCE spec existed, so this session also built the parity safety net per `LESSONS-LEARNED.md`
  L28), `operation-service/src/outbox/svc-token.guard.ts` (File 2 — mirrors money-service's
  `CronSecretGuard` shape, activates **F31** for real), `operation-service/src/outbox/*`
  consumer module (File 3 — `POST /outbox/events`, dispatches by `eventType`, unrecognized/
  user-not-found return a `'skipped'` 200 rather than retrying forever, a transient send failure
  5xxs so the cron retries), `money-service/src/outbox/outbox-publisher.cron.ts`'s `deliver()`
  (File 4 — now sends `Authorization: Bearer <SVC_TOKEN>`, all 8 existing test cases unchanged, one
  new assertion added), and both services' `.env.example` files (File 5 — documented
  `SVC_TOKEN`/`OUTBOX_PUBLISHER_ENABLED`/`OUTBOX_PUBLISHER_TARGET_URL`, doc-only).
  **Real gap found and NOT silently papered over, `DECISION-LOG.md` new **F50** (OPEN):** the
  order's own File 3 text treated "resolve the recipient via `aggregateId` -> `User.id`" as
  universal across all 6 `eventType`s. Reading `stripe-webhook.service.ts`'s actual
  `emitOutboxEvent(userId, 'COMMISSION_CREDITED', {...})` call site showed `userId` there is the
  PAYING SUBSCRIBER, not the affiliate who earned the commission — and operation-service's Prisma
  schema subset has no `Commission`/`AffiliateProfile` model to resolve the real recipient even if
  the payload carried enough to try. `OutboxConsumerService` special-cases this eventType to
  log-and-skip rather than email the wrong person. New `LESSONS-LEARNED.md` **L37** generalizes
  this: an event's `aggregateId` field name doesn't guarantee it's the right notification target
  for every `eventType` sharing that field — check each emission call site, not just the schema.
  **Two smaller findings, recorded as Deviations, not flags:** operation-service has no global
  `/v1` route prefix (unlike money-service) — the order's own `/v1/outbox/events` citation was
  corrected to the real `/outbox/events` (`LESSONS-LEARNED.md` L27 recurrence); dLocal's
  `TIER_UPGRADED` payload has no `billingPeriod` field (Stripe's does) — defaults to `'monthly'`,
  cosmetic only, zero production traffic reaches this code yet.
  **Two incidents this session, both disclosed immediately, neither repeated:** a prettier
  pre-commit pass turned a plain sentence in this order's own CONFIRM header edit into an
  unintended nested markdown list — caught and fixed in a follow-up commit before any code was
  touched. More seriously: a `head -c 300` sanity-check on raw Railway variable JSON (meant only to
  confirm `SVC_TOKEN`'s absence on operation-service) printed its real `DATABASE_URL` and
  `NEXTAUTH_SECRET` into the session transcript — disclosed to Davin the moment it happened, not
  reproduced again, every check for the rest of the session used grep-boolean-only output. Both
  values need rotation — added to the same outstanding list as Waiting-on #66's prior exposure.
  `LESSONS-LEARNED.md` L17 given a second recurrence note (the "safe" `--json`-plus-script method
  still has a hole if you ever peek at the raw file's own content while debugging the check).
  **Full verification:** `operation-service` 11/11 suites, 86/86 tests (was 7/7, 56/56 — +4 suites/
  +30 tests). `money-service` 59/59 suites, 507/507 tests (was 506/506 — net +1 test, zero new
  suites, matching the order's own prediction). `tsc --noEmit`/`nest build` clean both services.
  Value-blind re-confirmed at close: `OUTBOX_PUBLISHER_ENABLED`/`OUTBOX_PUBLISHER_TARGET_URL` still
  absent on money-service production — zero traffic cut over, by design. `SVC_TOKEN` confirmed
  absent on BOTH services' Railway production (not set this session — a live secrets action
  reserved for Davin per `EXECUTOR-PROTOCOL.md` §7, needed before 4A-12 has anything to test
  against).
  **Artifacts updated:** `4a-11-outbox-email-worker.migration-order.md` (Status → CONFIRMED,
  Deviations filled in full — 6 entries, Done-when checked except the outstanding `SVC_TOKEN`
  item), `DECISION-LOG.md` (F31 activation entry, new F50 OPEN),
  `migration-cutover-table.md` (Slice 5 row: MONOLITH → BUILT), `migration-stack-analysis.md` (new
  `operation-service`/`money-service` entry, 10 new files + 2 modified), `LESSONS-LEARNED.md` (L17
  recurrence, L27 recurrence, new L37), this file. New
  `4a-12-outbox-email-worker-cutover.migration-order.md` PRE-DRAFTed (VERIFY-RETIRE, fast-path
  eligible — PRE-DRAFT → APPROVED directly, per protocol's own VERIFY-RETIRE exception), carrying
  the `SVC_TOKEN`-not-yet-set and F50 items forward as explicit entry criteria / monitoring notes.
- _(superseded-by-above, retained for context)_ Session 4A-10c (ad-hoc, Slice 4 / Group B dLocal fix-and-retry attempt), executed
  2026-07-30 — same session/phase numbering family as 4A-10b, labeled per
  `EXECUTOR-PROTOCOL.md` §6's ad-hoc-session rule since no formal order file exists for it; Davin
  directed it live in chat, reporting the F48 header/signing fix already applied (uncommitted) and
  the 3rd orphaned `Payment` row already deleted, and asked to proceed straight to flipping
  `MIGRATE_WRITE_APIS_MONEY_DLOCAL=true` for the final Slice 4 group.
  **CONFIRM found the reported F48 fix was itself still wrong before it was ever deployed:** the
  Authorization header format (`V2-HMAC-SHA256 SecretKey:${secret}, Signature:${sig}`) didn't
  match dLocal's own documented scheme — worse than the original bug, since it embedded the raw
  secret key value in a header transmitted externally to dLocal. Caught by comparing directly
  against `verifyWebhookSignature`'s own working, documented format (`V2-HMAC-SHA256, Signature:
<hex>`) before deploying either file, per `LESSONS-LEARNED.md` L33's own guidance to check a
  known-working sibling rather than re-trust config. Corrected in both
  `money-service/src/dlocal/dlocal-payment.service.ts` and the monolith's identical
  `lib/dlocal/dlocal-payment.service.ts`, and removed the now-dead `generateSignature` helper both
  fixes had left orphaned. Re-ran the full verification chain independently rather than trusting
  "27/27 green" at face value (those tests short-circuit in test mode before ever reaching the
  changed code — the exact L2 gap): money-service 7/7 suites (100/100 tests), monolith 5/5 suites
  (107/107 tests), `tsc --noEmit` clean both sides, `eslint --max-warnings 0` clean, `nest build`
  clean. Independently re-verified the 3rd orphaned row's deletion via a direct production DB query
  (`railway run --service Postgres` + `PrismaPg` adapter) rather than trusting the claim — confirmed
  gone, 0 `PENDING` rows at that point.
  **Executed:** committed the corrected fix (`ad7e57d1`), pushed (pre-push hook ran the full
  monolith suite — 122/122 suites, 2138/2138 tests — before allowing the push). money-service
  redeployed clean via GitHub auto-deploy (`Nest application successfully started`, zero DI
  errors, all dLocal routes registered). Flipped `MIGRATE_WRITE_APIS_MONEY_DLOCAL=true` in Vercel
  production, redeployed clean (`dpl_NUkyUTHXPoFDGoJoGVFYkxtpGci1`). Davin ran a real authenticated
  request against production; the response was `{"error":"Failed to create payment"}`, but
  money-service's own logs told a very different story than 4A-10b's identical-looking prior
  failure: `dLocal API error {"status":400,"error":"Missing parameter: payment_method_flow"}` — a
  `400` from dLocal's payload-validation layer, not the previous `403 Invalid credentials`. A `400`
  only happens AFTER authentication succeeds — this is direct, positive proof **F48 is genuinely
  fixed** (dLocal's own API accepted the corrected credentials/signing for the first time in this
  codebase's history). The `400` itself is a new, previously-masked bug, registered as
  **F49** (`DECISION-LOG.md`): `payment_method_flow` is a dLocal-required field never implemented
  on either side of this migration — grepped both `lib/dlocal/` and `money-service/src/dlocal/`,
  confirmed no code anywhere computes or references it. Per the standing "any red result = abort,
  revert" rule, reverted `MIGRATE_WRITE_APIS_MONEY_DLOCAL` to `false` and redeployed clean
  (`dpl_5qWfmQ7syPpFdb5LVAiMgPV91t6K`) immediately once this was confirmed live in the logs — the
  request also created a 4th orphaned `Payment` row (`cms7hlmb900000fmpz9i9fv1q`, independently
  confirmed via direct DB query, 0 other `PENDING` rows), left for Davin to remove (the Executor
  will not permanently delete production data even with authorization).
  **Net result:** Slice 4 stays `CUT-OVER (partial: 3/4 groups)` — unchanged in shape from 4A-10b's
  close, but F48 is now genuinely closed and the real remaining blocker (F49) is correctly
  identified rather than re-attempting the same dead end. New `LESSONS-LEARNED.md` **L35**: fixing
  the first bug in a request's path can unmask a second, previously-invisible bug in the same path
  — a live-fixed error changing SHAPE (403→400, code 3001→5001) is itself strong positive evidence,
  not a reason to treat the attempt as a failure.
  **Wrap-up (same day, per `EXECUTOR-PROTOCOL.md` §3):** filled
  `4a-10-money-service-write-apis-cutover.migration-order.md`'s own Deviations (18-21) and
  Next-session handoff with this session's findings — it had been updated everywhere else but not
  in the order file itself. Added `LESSONS-LEARNED.md` **L36** (`vercel --prod` needs
  `--archive=tgz` on this monorepo — found triggering the flag-flip redeploys this session).
  PRE-DRAFTed **Session 4A-11** (`4a-11-outbox-email-worker.migration-order.md`, PORT variant,
  Slice 5 Outbox Email Worker BUILD) — confirmed independent of Group B/dLocal, per this session's
  own established parallel-work allowance; flags 3 real drifts from this file's own prior summary
  (a 6th `TIER_DOWNGRADED` eventType the 4A-9 close-out omitted, admin-code-distribution never
  actually emitting an outbox event despite a smoke-test doc claiming it does, and
  `SUBSCRIPTION_CANCELLED` having two incompatible payload shapes) plus an explicit flag for the
  Advisor on whether to split it (real scope is likely >4h).
  **Artifacts updated:** `DECISION-LOG.md` (F48 → RESOLVED with full verification evidence, new
  **F49** OPEN with full root-cause detail), `LESSONS-LEARNED.md` (new L35, L36),
  `migration-cutover-table.md` (Slice 4 row annotated, Session column extended to include 4A-10c),
  `4a-10-money-service-write-apis-cutover.migration-order.md` (Deviations 18-21, Next-session
  handoff corrected to point at F49), this file. New
  `4a-11-outbox-email-worker.migration-order.md` PRE-DRAFTed (see above) — the next dLocal attempt
  still needs its own scoped fix session against F49, mirroring how F48 itself was handled; that
  and 4A-11 are independent tracks Davin can order either way.
- _(superseded-by-above, retained for context)_ Session 4A-10b (Slice 4 Write-APIs CUTOVER) continuation, executed 2026-07-30 —
  **3 of 4 endpoint groups now genuinely cut over** (Stripe, Admin, Disbursement); dLocal stays
  blocked, but on a corrected root cause. Before this session, Davin completed Phase 1/2
  remediation: `STRIPE_PRO_PRICE_ID` added to money-service Railway production, dLocal sandbox
  credentials refreshed, and the 2 orphaned test `Payment` rows from 2026-07-28 deleted. The
  Executor independently re-verified all three (value-blind presence check for the Stripe var; a
  direct production DB query via `railway run` + `DATABASE_PUBLIC_URL` + Prisma's `PrismaPg`
  adapter — Prisma 7 requires an explicit driver adapter, money-service's own pattern — confirmed
  0 orphaned rows and 0 `PENDING` Payment rows anywhere) rather than trusting the claims at face
  value, per protocol.
  **Incident, disclosed immediately, not silently worked around:** re-verifying entry criteria,
  `railway variable list --service money-service` (default table, NOT `--kv`) printed real values
  for `CRON_SECRET`, `DATABASE_URL`, `NEXTAUTH_SECRET`, `REDIS_URL`, and all 4 dLocal secrets into
  the session transcript — the default table view turns out to be just as unmasked as `--kv`
  (`LESSONS-LEARNED.md` L17 recurrence). Reported to Davin before proceeding further; his call was
  to continue now and rotate everything exposed once the cutover finished. **That rotation is
  still outstanding** — see Waiting-on.
  **Group A (Stripe): PASSED, cut over.** Flag flipped `true`, redeployed clean. Davin ran a real
  authenticated request against production `/api/checkout`; got back a valid `cs_test_...` Stripe
  Checkout session. Independently cross-checked via money-service's own HTTP access logs (not just
  the response body, learning from 4A-7a's own L18): `POST /v1/stripe/checkout → 201 Created,
546ms`. Zero error-level logs, zero 4xx/5xx surrounding the request. `STRIPE_PRO_PRICE_ID`
  confirmed genuinely fixed.
  **Group B (dLocal): FAILED again, reverted, still NOT cut over — but the diagnosis changed.**
  Same `403 Invalid credentials` (dLocal code 3001) as 2026-07-28. Two client-tooling detours
  preceded the real test: `curl.exe` from PowerShell mangled the JSON body (matching the prior
  session's own documented quoting-bug class); then the Executor's own suggested
  `Authorization: Bearer` header was wrong for the MONOLITH's routes, which authenticate via
  NextAuth's `getServerSession()` session cookie, not a bearer header (Bearer is what money-
  service's OWN `JwtAuthGuard` expects on the request money-service receives FROM the monolith,
  not what the external caller sends TO the monolith — a real, if avoidable, confusion, now
  `LESSONS-LEARNED.md` L34). Resolved via `Invoke-RestMethod` + an explicit `WebRequestSession`/
  `System.Net.Cookie` carrying Davin's real `__Secure-next-auth.session-token` (Chrome DevTools),
  matching the prior session's established pattern. Once the request reached money-service
  cleanly, Davin (relaying the Advisor's own finding) identified the true root cause as a **real
  code bug**, not invalid credentials: `money-service/src/dlocal/dlocal-payment.service.ts:143-151`
  sends `X-Login`/`X-Trans-Key`/`Authorization` all to the wrong fields (full detail,
  `DECISION-LOG.md` **F48**, new, OPEN). The Executor independently verified this by reading the
  code directly, and — going further than the reported diagnosis — found the IDENTICAL bug exists
  in the monolith's own original `lib/dlocal/dlocal-payment.service.ts` (both call sites): this is
  a **pre-existing bug, not introduced by the migration**, faithfully preserved by 4A-9's PORT
  (correct PORT-session behavior — the bug predates it). This means dLocal outbound payment
  creation has likely never worked correctly on EITHER side of this migration; if any real
  customers pay via dLocal, this is a live, real-money-adjacent gap today, independent of cutover
  sequencing. Per this VERIFY-RETIRE order's own "no code edits" rule, **not fixed this session** —
  flag reverted to `false`, redeployed, confirmed live. A third orphaned `Payment` row
  (`cms79jwuw00000frzsiurqtk4`, `status: PENDING`) resulted; the Executor declined to delete it
  directly (will not permanently delete production data even with authorization) — flagged for
  Davin.
  **Group C (Admin): PASSED, cut over.** First attempt correctly 403'd
  (`"You must be an administrator to access this resource"`) — traced to a non-admin test cookie
  by reading `requireAdmin()`'s own role check before troubleshooting further, rather than
  guessing. Retried with an admin cookie: `{"success":true,...,"codesDistributed":1}`,
  independently cross-checked via logs: `POST /v1/admin/affiliates/.../distribute-codes → 201
Created, 99ms`. Zero errors surrounding the request. One real `AffiliateBonusCode` batch row
  created in production (intentional — the live proof itself).
  **Group D (Disbursement): cut over, code/guard/log verification only — no live batch executed**,
  per the prior session's own established Deviation 8 scope (a real batch would move real money
  through the live `WISE` provider). Verified first (per `LESSONS-LEARNED.md` L32 — proactively,
  not discovered live): money-service's `DisbursementBatchesController` guard parity
  (`JwtAuthGuard`+`AdminGuard` mirrors `requireAdmin()`), response-shape parity, `WisePaymentProvider`
  DI wiring into the provider-factory call, and that Admin/Disbursement's own config needs were
  already met (Admin has none; `DISBURSEMENT_PROVIDER=WISE` already confirmed healthy — the hourly
  Wise reconciliation cron ran error-free all session). Flag flipped `true`, redeployed clean, zero
  errors, `/health` → `200`. Live proof deferred to the next real scheduled disbursement batch,
  same plan 4A-W7 already established.
  **Net result:** `migration-cutover-table.md`'s Slice 4 row → `CUT-OVER (partial: 3/4 groups)` —
  a stable partial-scope completion (same shape as Session 4A-5's dLocal-only Slice 2 cutover), not
  a broken mid-state; the monolith continues serving 100% of dLocal payment-creation traffic
  unchanged, confirmed via a clean revert+redeploy.
  **Artifacts updated:** `4a-10-money-service-write-apis-cutover.migration-order.md` (Deviations
  12-17 added, Next-session handoff corrected — Groups A/C/D effectively closed, Group B needs its
  own dedicated fix session tracked via F48, not a continuation of this VERIFY-RETIRE order),
  `DECISION-LOG.md` (new **F48**, OPEN; full Session 4A-10b continuation findings entry),
  `migration-cutover-table.md` (Slice 4 row → partial CUT-OVER), `LESSONS-LEARNED.md` (L17
  recurrence — default `railway variable list` is also unmasked; new **L33** — an "invalid
  credentials" error can mean wrong request signing, not wrong secrets; new **L34** — monolith
  routes use session cookies, not Bearer headers), this file. No code files changed this session —
  flag flips + doc/order updates only, per the VERIFY-RETIRE variant's own rules.
- _(superseded-by-above, retained for context)_ Session 4A-10b (Slice 4 Write-APIs CUTOVER) CONFIRMED and executed **PARTIALLY** —
  2026-07-28, paused mid-session after 2 of 4 endpoint groups tested live and failed on real
  money-service production config gaps; 0 of 4 groups actually cut over.
  **CONFIRM found two of the order's own entry criteria genuinely FAILED against live state**,
  reported to Davin per protocol rather than silently proceeding or silently waiting: the 48h
  code-freeze soak window (started 2026-07-27 12:52 UTC) had only ~19h elapsed, not the full 48h;
  and the "Staging / Sandbox manual smoke tests" evidence on file
  (`davin-operational-manual/manual-smoke-tests-4A-10a/4A-10a-test-verification-report/*.md`)
  turned out to report Jest unit-test pass counts — the same suites already counted in 4A-10a's
  own close-out — as if they were live smoke-test evidence, with every report's own "Live
  Railway/Vercel Verification" checkbox left explicitly unchecked. A separate finding-report in
  the same folder claiming money-service had zero Stripe env vars was independently checked live
  and found stale (the vars are present — the report predates Davin adding them). Also found: no
  staging/sandbox environment exists anywhere in this project (`railway status` shows only
  `production`; the long-standing F34/CC-A gap) — the order's literal "staging" requirement
  cannot be executed as written. Davin, live, explicitly re-scoped all of this rather than having
  it silently reinterpreted: waived the remaining soak-window time (the CC-F freeze itself was
  independently verified intact via `git log` — zero commits to any of the 5 route files since
  4A-10a), and substituted a real live-testing method in place of nonexistent staging — Davin
  runs a real authenticated request against production immediately after each flag flip, the
  Executor cross-checks `money-service` Railway logs in parallel, per the order's own Rule ("any
  red result = abort immediately, revert flag"). Before any flip, a live-state ambiguity was
  found and resolved rather than assumed: Vercel showed 5 production redeploys in the 3h before
  the session, and the smoke-test docs marked 3 of the 4 flag-enable steps "(DONE)" — suggesting
  the flags may have already been toggled outside any CONFIRMed order. Davin checked the Vercel
  dashboard live and confirmed all 4 were `false` before this session's own flips began.
  **Group A (Stripe) executed and FAILED, reverted:** flag flipped `true`, redeployed, Davin ran
  a real authenticated request against production `/api/checkout`. Result:
  `STRIPE_CONFIG_ERROR`/"Stripe is not properly configured". Cross-checked against `money-service`
  logs: the request genuinely reached `StripeCheckoutController.createCheckout` →
  `StripeService.createCheckoutSession` (proving the 4A-9/4A-10a transport+auth+flag mechanism
  works end-to-end for real) but threw because `STRIPE_PRO_PRICE_ID` is absent from
  `money-service`'s Railway production — present in `money-service/.env.example` (line 34) and in
  `docs/secret-matrix.md`'s monolith-side entry, never carried into money-service's real
  environment when 4A-9 ported the Stripe module (an L21-class gap). Flag reverted to `false`,
  redeployed, confirmed live via the production alias. Real checkout traffic was exposed to this
  failure for roughly the redeploy-to-redeploy window (~5–10 min).
  **Group B (dLocal) executed and FAILED, reverted:** flag flipped `true`, redeployed. First
  attempt used the smoke-test doc's own example payload (`paymentMethod: "P2P"` for `country:
"TH"`) and got a real, correctly-formed rejection from `money-service/src/dlocal/payment-methods
.service.ts`'s ported `isValidPaymentMethod` (Thailand's real default method is `TrueMoney`, not
  `P2P` — the doc's own example was wrong, confirmed live via `money-service` logs that the
  response genuinely came from money-service). Retested with `TrueMoney`: `money-service` logs
  showed real progress (`Exchange rate fetched`, `Creating payment`, `Payment record created`)
  then a real failure — `dLocal API error {"status":403,"error":"{\"code\":3001,\"message\":
\"Invalid credentials\"}"}` — money-service's configured dLocal API credentials
  (`DLOCAL_API_KEY`/`DLOCAL_SECRET_KEY`/`DLOCAL_LOGIN`, all present per a boolean check) are
  genuinely wrong against dLocal's real API, not just untested. A real `Payment` row
  (`status: PENDING`) was created in production before the dLocal call failed — orphaned, needs
  cleanup. Flag reverted to `false`, redeployed, confirmed live.
  **Groups C (Admin) and D (Disbursement) NOT attempted** — given two-for-two real config
  failures on the first two groups (a pattern, not one-off bad luck — the transport/flag/auth
  mechanism is proven solid both times, only money-service's real Railway configuration was
  wrong), Davin's live call was to pause here rather than risk repeating the same live-production
  exposure window on two more groups blind. New `LESSONS-LEARNED.md` **L32**: a PORT session
  moving code that reads config does not move the config itself into the new service's real
  environment — verify every config value the ported code needs, value-blind, on the real target
  before any cutover attempt, not just presence in `.env.example`.
  Two client-tooling issues cost real time mid-session, also worth carrying forward: native
  Windows `curl.exe` mangles JSON `-d` bodies through PowerShell's quoting (switched to
  `Invoke-RestMethod` with a `ConvertTo-Json` body instead), and `Invoke-RestMethod`/
  `Invoke-WebRequest` silently drops a `Cookie` header passed via `-Headers` in Windows PowerShell
  5.1 (`Cookie` is a .NET "restricted header" — fixed via an explicit `WebRequestSession` +
  `System.Net.Cookie` object instead).
  **Artifacts updated:** `4a-10-money-service-write-apis-cutover.migration-order.md` (Status →
  CONFIRMED, entry criteria reconciled with 3 re-scoped items, Deviations filled in full — 11
  entries, Next-session handoff corrected to reflect this order's own unfinished state rather
  than jumping ahead to 4A-11), `migration-cutover-table.md` (Slice 4 row annotated, status stays
  BUILT), `LESSONS-LEARNED.md` (new L32), this file. No code files changed this session — flag
  flips + doc/order updates only.
- _(superseded-by-above, retained for context)_ Session 4A-10a (Slice 4 monolith Write Transport BUILD) CONFIRMED and executed —
  2026-07-27, all 4 Ordered Steps shipped, zero production traffic cut over (all 4 flags default
  `false`). Closes the hard-blocking gap 4A-10's own PRE-DRAFT found before it could even reach
  CONFIRM (Waiting-on #61, `LESSONS-LEARNED.md` L31): none of the 5 monolith write routes had any
  `MIGRATE_WRITE_APIS_MONEY_*` flag-check or forwarding call to money-service.
  **CONFIRM found this session's own order file (and its sibling
  `4a-10-money-service-write-apis-cutover.migration-order.md`, since renamed to 4A-10b) both
  uncommitted with `Status: APPROVED` and no Advisor-DRAFT/Davin-approval commit trail** — the
  by-now-familiar `LESSONS-LEARNED.md` L11 pattern, this time on a genuinely new file (no prior
  committed version to diff against) rather than an in-place edit. Confirmed live as Davin's own
  authentic Chat UI work before proceeding; both files' provenance and CONFIRMED status committed
  together (`8967df12`).
  **Built:** `lib/money-service/flags.ts` extended with 4 new `shouldUseMoneyServiceFor*Write()`
  readers (Stripe/dLocal/Admin/Disbursement, all default `false`); new
  `lib/money-service/write-routes.ts` (`forwardWriteRequestToMoneyService()`) — forwards a route's
  raw request body + `Idempotency-Key` header to money-service with the caller's session token as
  Bearer auth, reusing `routes.ts`'s `getMoneyServiceToken()` (the same F45 cookie-read bridge
  Slice 3's read transport already uses, not a new auth mechanism). All 5 monolith write routes
  (`checkout`, `subscription/cancel`, `payments/dlocal/create`,
  `admin/affiliates/[id]/distribute-codes`, `disbursement/batches/[batchId]/execute`) wired: each
  flag check sits immediately after that route's own existing auth check (unchanged), and on a
  flag-ON forward returns money-service's response directly rather than layering forwarding on top
  of the monolith's own (now-redundant) business logic — verified correct by reading all 5
  money-service controllers first and confirming each is already a full 4A-9 PORT (same auth,
  validation, provider calls) before writing any monolith-side branch, per `LESSONS-LEARNED.md`
  L27 discipline, not assumed from the order's prose.
  **Two safe signature widenings, recorded as Deviations:** `subscription/cancel/route.ts`'s
  `POST()` gained a `request: NextRequest` parameter (previously took none — needed for the
  forwarding helper); `disbursement`'s execute route's already-present but unused `_request`
  renamed to `request`. Both zero-risk (Next.js always passes the request object regardless of
  whether the handler declares a parameter for it) and covered by the existing
  `__tests__/api/disbursement/execute.test.ts` (5/5, unmodified, still green).
  **Full verification:** monolith `test:ci` 121/121 suites, 2133/2133 tests (was 120/120,
  2122/2122 at 4A-9's era close — +1 suite/+11 tests for the new `write-routes.test.ts`, zero
  regressions elsewhere). `tsc --noEmit` and `eslint app components lib hooks --max-warnings 0`
  both clean throughout (the real green bar per L20 — literal `validate:policies` re-confirmed
  mis-scoped into `node_modules`/`railway-gateway`, a pre-existing tooling gap unrelated to this
  session, not a new regression). `money-service` untouched — zero files changed, this was a
  monolith-only BUILD. 4 commits, one per Ordered Step, each with its own `tsc`/`eslint`/test
  pass — none batched.
  **Artifacts updated:** `4a-10a-money-service-write-transport.migration-order.md` (Status →
  CONFIRMED, entry criteria + Done-when all checked, Deviations filled in full — 5 entries),
  `4a-10-money-service-write-apis-cutover.migration-order.md` (now 4A-10b — its own Entry
  Criterion 1, "Session 4A-10a CONFIRMED and closed," is now genuinely satisfied; its remaining
  entry criteria — 48h soak window ending 2026-07-29 12:52 UTC, staging/sandbox smoke tests,
  Davin live per-group approval — are unaffected and still open), `migration-cutover-table.md`
  (Slice 4 row annotated), this file. 4A-10b was already APPROVED at this session's start (the
  Advisor's same-day split) — no new PRE-DRAFT needed; it is the literal next session.
- _(superseded-by-above, retained for context)_ Session 4A-9 (Slice 4 Write-APIs PORT) CONFIRMED and executed — 2026-07-27, all 10
  files/steps shipped, zero production traffic cut over (BUILD only).
  **CONFIRM found the by-now-familiar `LESSONS-LEARNED.md` L11 pattern again** (order file
  modified-but-uncommitted, `PRE-DRAFT → APPROVED` with a full content rewrite — rough 8-item
  Executor list → polished 10-file Advisor order — no Advisor-DRAFT/Davin-approval commit trail)
  — confirmed live as Davin's own authentic Chat UI edit before proceeding. Also found and the
  Advisor/Davin corrected before execution: a stale 4A-8 test-count citation (372/372 → the real
  49/49 suites, 400/400 tests), monolith test-path citations that didn't exist
  (`__tests__/stripe|payments|admin|disbursement` → the real `__tests__/lib/*` and
  `__tests__/api/disbursement/*` locations), a real route-level test-coverage gap (no test existed
  for the checkout/cancel/webhook routes, only their underlying `lib/` services — File 9/10
  re-scoped to author new controller specs, not just port existing ones), a fabricated
  `RolesGuard`/`@Roles('ADMIN')` mechanism (→ the real `AdminGuard`), `lib/admin/code-distribution.ts`'s
  stale line count (112 → 193, an 81-line outlier unlike every other file's harmless ±1 drift), and
  a missing Step 0 (stripe npm dependency). The correction pass itself then introduced one NEW
  wrong citation (`AdminGuard` at a path that doesn't exist) — found and fixed during this same
  CONFIRM pass.
  **A real architecture gap found mid-session, escalated and resolved live with Davin before
  writing code:** File 4/10's SOURCE list omitted `lib/stripe/webhook-handlers.ts` entirely (592
  lines) — the file holding ALL real tier/subscription/affiliate-commission logic and 5
  customer-facing email sends; the cited `route.ts` is a thin dispatcher. money-service has zero
  email-sending capability. Davin approved: reuse `ConversionProcessorService` (4A-4, already used
  by the live dLocal webhook) for commission crediting, and follow the established dLocal (Slice
  2, 4A-5) precedent for the email question — write domain state synchronously, emit `OutboxEvent`s
  (`TIER_UPGRADED`/`SUBSCRIPTION_CANCELLED`/`PAYMENT_FAILED`/`PAYMENT_SUCCEEDED`/
  `COMMISSION_CREDITED`) for `operation-service` to eventually consume (Slice 5 / 4A-11-12) instead
  of building a new direct-email capability. Not a new regression — once 4A-10 cuts this over,
  Stripe-originated emails go silent the exact same way dLocal's already are, pending Slice 5.
  **Two more direct-dependency omissions found the same way** (File 6/10):
  `lib/dlocal/currency-converter.service.ts` and `lib/dlocal/payment-methods.service.ts`, both
  directly imported by the dLocal create route and cited nowhere in the order — ported verbatim
  with their existing monolith test suites. `LESSONS-LEARNED.md` L27 recurrence.
  **Schema-subset gap found and fixed additively** (`prisma generate` only, zero migration, zero
  production DB touch — L1/L32): money-service's `User` model was missing
  `trialStatus`/`trialConvertedAt`/`trialCancelledAt`/`hasUsedFreeTrial` (+ `TrialStatus` enum),
  needed by Files 3/10 and 4/10 — all four already exist in the monolith's real schema and the
  shared Postgres table.
  **Dependency-version gap found and fixed:** Step 0's `npm install stripe` (unpinned) grabbed
  v22.3.2 instead of matching the monolith's pinned `^14.10.0` — an 8-major-version jump that
  changed real Stripe SDK TypeScript shapes, caught by a genuine compile error. Reinstalled at
  `^14.10.0`. New `LESSONS-LEARNED.md` **L30**.
  **File 7/10's own idempotency mechanism deliberately diverges from the SOURCE**, per the order's
  own explicit spec: the standard `IdempotencyInterceptor` (client `Idempotency-Key` header, 24h
  TTL) replaces `lib/admin/code-distribution.ts`'s internal 30s Redis lock +
  `DuplicateDistributionError` — a real difference in mechanism (client-header-based vs.
  server-side hash-based), not just a naming change.
  **All 10 files built and unit tested:** `money-service/src/stripe/*` (new module —
  `StripeService`, `StripeCheckoutController`, `StripeSubscriptionController`,
  `StripeWebhookController`+`StripeWebhookService`), `dlocal-payment.service.ts` extended
  (`acquireCreatePaymentLock`), `DlocalPaymentController` (+ its 2 omitted dependencies),
  `AdminCodeDistributionService` added to the already-live `AdminAffiliatesController`,
  `DisbursementBatchesController` (new `disbursement.module.ts`, mirrors `CronsModule`'s provider
  list + imports `WiseModule` for `WisePaymentProvider`), all 4 modules registered in `AppModule`.
  **Full verification:** `money-service` 59/59 suites, 506/506 tests (was 49/49, 400/400 at 4A-8's
  close — +10 suites, +106 tests). `nest build` clean throughout. Monolith untouched (zero files
  changed, confirmed via `git status`), `tsc --noEmit` clean. Zero flags flipped, zero URLs/
  dashboards changed — genuinely zero production traffic reaches any of the 4 new/extended
  modules this session.
  **Artifacts updated:** `4a-9-money-service-write-apis-port.migration-order.md` (Status →
  CONFIRMED, Deviations filled in full — 8 entries, Done-when all checked), `DECISION-LOG.md`
  (new Session 4A-9 findings entry), `LESSONS-LEARNED.md` (L27 recurrence, new **L30**),
  `migration-cutover-table.md` (Slice 4 row → BUILT), `migration-stack-analysis.md` (new
  money-service entry, 21 new files + 8 modified), this file.
  `4a-10-...migration-order.md` (Slice 4 cutover, TEMPLATE-VERIFY-RETIRE) generated by the
  Advisor and reviewed/finalized in the very next exchange, same day — see Waiting-on #61/#62:
  its Entry Criterion 1 was reframed from "48h mirror-run" to "48h code-freeze soak window"
  (no shadow-traffic mechanism exists for Slice 4 — Davin's live direction, matching Slice 3's
  F44 precedent), and a NEW hard-blocking Entry Criterion 0 was found and added: **none of the 5
  monolith write routes have any flag-check/forwarding code to money-service at all** — flipping
  any `MIGRATE_WRITE_APIS_MONEY_*` flag today would be a silent no-op, same shape as 4A-W6/W7's
  own Waiting-on #54. 4A-10 stays PRE-DRAFT, blocked, until a new BUILD session (mirroring
  4A-7a's own Slice-3 transport-layer scope) ships and is CONFIRMED.
- _(superseded-by-above, retained for context)_ Session 4A-8 (Slice 4 Security & Idempotency Hardening Gate) CONFIRMED and executed
  — 2026-07-27, run concurrently with the still-open Wise track below (Davin's explicit choice:
  the DRAFT was generated and approved the same day 4A-W7 was still mid-close, jumping ahead of
  `4A-W8` in the originally-intended `4A-7 → 4A-W1…W8 → 4A-8` sequence — not a violation, a
  deliberate reordering; 4A-W8 (RiseWorks archival) is still pending, unaffected by this session).
  **CONFIRM found the by-now-familiar `LESSONS-LEARNED.md` L11 pattern again** (order file
  modified-but-uncommitted, `DRAFT → APPROVED` with all 4 entry-criteria checkboxes flipped
  `[ ] → [x]`, no Advisor-DRAFT/Davin-approval commit trail) — asked Davin directly rather than
  trusting or silently correcting it; confirmed live as his own authentic Chat-UI edit, committed
  together with the CONFIRMED transition (`c7871fe3`).
  **CONFIRM also found the DRAFT's own Step 1 targeting money-service NestJS controllers that
  don't exist** (`money-service/src/stripe/stripe-checkout.controller.ts`,
  `.../dlocal/dlocal-payment.controller.ts`) — `migration-cutover-table.md`'s own Slice 4 row
  confirms Stripe checkout / dLocal create / admin code-dist / batch-execute all stay on
  **monolith** Next.js routes until 4A-9; money-service has no write endpoints of its own yet.
  The real audited gaps (4A-W4's own citations) are `app/api/checkout/route.ts`,
  `app/api/payments/dlocal/create/route.ts`, `app/api/admin/affiliates/[id]/distribute-codes/route.ts`.
  Reported in full before executing; Davin + the Advisor re-scoped Step 1 live to the real files
  and confirmed `POST /api/subscription/cancel` correctly stays excluded (4A-W4: idempotent by
  construction). Order re-CONFIRMED against the corrected file, executed.
  **Step 1 built:** `lib/idempotency/idempotency-guard.ts` (new, monolith-side — Redis
  SET-NX-EX lock, fail-open on Redis errors, mirrors `lib/rate-limit.ts`'s own convention) used by
  `app/api/payments/dlocal/create/route.ts` (also fixed `providerPaymentId`'s `''` placeholder to
  a random UUID — that column is `@unique` **table-wide, not per-user**, so a bare `''` risked a
  genuine cross-user insert collision; found while touching this exact line) and
  `lib/admin/code-distribution.ts`'s `distributeCodesAdmin` (`DuplicateDistributionError` → 409).
  `lib/stripe/stripe.ts`'s `createCheckoutSession` gained an optional Stripe SDK `idempotencyKey`
  (derived from a 60s window bucket in `app/api/checkout/route.ts`), omitted entirely — not just
  `undefined` — when absent, so every existing caller/test sees zero behavior change (24+28 stripe
  tests unchanged, 6 new ones added for the key path and a previously-untested coupon-creation
  branch found along the way). `money-service/src/common/idempotency/` (new,
  `IdempotencyStore` + `IdempotencyInterceptor`, 24h TTL response cache keyed on `Idempotency-Key`,
  `ConflictException` on a still-in-flight duplicate, fails open on Redis errors) built as
  forward-looking infrastructure for 4A-9 — not attached to any route yet.
  **Step 2 (F14, Transactional Outbox) found its own file-list gap mid-session:** the order named
  only `money-service/prisma/schema.prisma` for the new `OutboxEvent` model, but it's a genuinely
  new money-service-owned table (no FK to anything) — per L1 (money-service has no migration
  authority of its own), it needed the SAME two-schema treatment 4A-W2 used for the Wise models:
  mirrored into `prisma/non-market-data/schema.prisma`, a zero-DB-connection `prisma migrate diff
--script` generated and committed
  (`prisma/migrations/20260727000000_outbox_event_additive/`), then **applied to production**
  (Davin present, explicit live approval per `EXECUTOR-PROTOCOL.md` §7 before touching production
  schema — asked directly rather than assuming session-level "proceed" covered a DB migration).
  **`money_svc` had zero grants on the new table immediately after** — same predicted-and-confirmed
  gap class as 4A-W2's own Step 6 — granted `SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER,
TRUNCATE`, verified via a real INSERT/SELECT/UPDATE/DELETE cycle as `money_svc` (rolled back, zero
  residue), same method as 4A-W2. `OutboxService.recordInTransaction(tx, ...)` wired into both
  existing tier-write call sites: `dlocal-webhook.controller.ts`'s already-transactional
  `handlePaymentCompleted` (guarded by the existing `alreadyCompleted` replay flag so a webhook
  replay doesn't double-emit) and `crons/subscription.service.ts`'s `downgradeExpiredSubscriptions`
  — **this one was NOT previously transactional** (3 separate calls); now wrapped in
  `$transaction`, a deliberate in-scope behavior change (breaks that file's own header comment's
  prior "byte-identical to 4A-2's ported source" claim, recorded as such).
  **Step 3's own literal delivery target ("to `operation-service`") doesn't exist:**
  operation-service has no tier/billing module or endpoint at all (auth/email/security/2FA only),
  and `04-rise-to-wise-migration-plan.md`'s own roadmap assigns the real consumer side ("Slice 5,
  tier-update event path") to a later, separate session pair (**4A-11/12**), not 4A-8. Escalated
  to Davin rather than scope-creep into building that endpoint or ship a cron that fails every 5s
  tick forever in production; his call — build `OutboxPublisherCron` in full (poll every 5s,
  exponential backoff 1s/2s/4s within one delivery attempt, dead-letter to `status = FAILED` after
  5 attempts across ticks, atomic `updateMany WHERE status=PENDING` claim guards against
  double-processing across replicas) but **gate it OFF by default**
  (`OUTBOX_PUBLISHER_ENABLED` must be `'true'`) — same "build now, cut over later" shape as every
  other piece of infra this migration has built ahead of its own cutover session.
  `publishPendingEvents()` itself is ungated, ready for 4A-11/12 (or a manual trigger) to call once
  `OUTBOX_PUBLISHER_TARGET_URL` is configured.
  **Step 4 (CC-C/CC-D verify) found one real gap:** `RiseworksWebhookController` had no
  route-level `@Throttle()` override, unlike dLocal's and Wise's webhook controllers — the same
  429-storm-on-legitimate-retry-burst risk 4A-W4 fixed for dLocal, whose fix explicitly
  established "all future payment-provider webhooks get an explicit override" as standing policy.
  Fixed to match (`ttl: 60_000, limit: 300`); zero live-traffic risk (RiseWorks route is
  archived/dormant per F42, dashboard still points at the monolith). All other controllers'
  reliance on the bare global default (100/60s) confirmed correct as-is (policy is scoped to
  payment-provider webhooks, not general dashboard/admin API traffic). BullMQ audit: the only
  producer/consumer pair (`wise-webhook.processor.ts`) already uses a deterministic `jobId`
  (`wise:event:<deliveryId>`) plus a DB-unique-constraint catch before enqueueing, worker already
  drains on `onModuleDestroy` (L25) — no further gap found.
  **Full verification:** `money-service` 49/49 suites, 400/400 tests (was 45/372 at session
  start). `nest build` clean throughout. Monolith `tsc --noEmit` clean (both Prisma clients
  regenerated). 6 commits, one per step, each with its own test run — none batched.
  **Pushed and deployed** (Davin's explicit go, separate from the session-level "proceed" —
  production deploy touching already-live money routes is its own escalation point): the pre-push
  hook ran the FULL monolith suite as a final gate (120/120 suites, 2122/2122 tests) before
  `git push origin main` (`a1df0460..7eb22a41`) went through. money-service (Railway) redeployed
  clean — `Nest application successfully started`, every module (including the new
  `OutboxPublisherCron`/`OutboxService` providers and the `RiseworksModule` throttle fix)
  initialized with zero DI errors, `/health` → `200`. Monolith (Vercel) deployment recorded
  `state: success` via the GitHub deployments API, production URL responds `302` (normal
  unauthenticated redirect). Both confirmed live, not just pushed.
  **Artifacts updated:** `4a-8-security-hardening-gate.migration-order.md` (Status → CONFIRMED,
  Done-when all checked, Deviations filled in full — 7 entries), `DECISION-LOG.md` (F14 →
  RESOLVED, full findings entry), `LESSONS-LEARNED.md` (L27 recurrence — 2 more file-existence-
  level order/ground-truth mismatches in one session), `migration-cutover-table.md` (Slice 4 row
  annotated — still MONOLITH, gate closed), `migration-stack-analysis.md` (new entry, 8 new files
  - 12 modified), this file. `4a-9-...migration-order.md` PRE-DRAFTed (Standard Loop, ⚠ REAL
    MONEY per the plan's own roadmap — fast-path does NOT apply, needs full Advisor DRAFT → Davin
    APPROVED).
- _(concurrent Wise track, unaffected by 4A-8, retained for context)_ Session 4A-W7 CONFIRMED & executed (Wise cutover live, SCB THB payout funded & pending SWIFT settlement); Session 4A-W8 (`4a-w8-riseworks-archival.migration-order.md`) APPROVED — 2026-07-27.
  **CONFIRM found the order rewritten (uncommitted, no Advisor-DRAFT/Davin-approval commit trail —
  the by-now-usual `LESSONS-LEARNED.md` L11 pattern) folding the predecessor PRE-DRAFT's blocking
  Entry Criterion 0 into an in-session "Step 1" code edit, and pulling RiseWorks archive switches
  A1/A2 forward into this session against `03-riseworks-archive-and-restore-runbook.md`'s own Rev 2
  correction (which explicitly moved A1/A2 to 4A-W8 because `TEMPLATE-VERIFY-RETIRE.md` forbids code
  at dial-near-zero). Stopped and asked Davin directly per the established pattern rather than
  trusting or silently correcting; confirmed live as his own authentic edit — Step 1 DI approach
  agreed live (import `WiseModule` into `CronsModule`, let Nest construct `WisePaymentProvider`),
  Step 6 corrected back to A3-only (A1/A2 stay in W8, matching Rev 2).
  **Found and fixed a live, unrelated production incident before proceeding:** `railway status`
  showed money-service **Crashed** — `WISE_WEBHOOK_QUEUE = 'money:wise-webhook'` (wired 4A-W5)
  crash-loops BullMQ, which rejects colons in queue names, since no deploy had ever actually booted
  the real queue against real Redis (every prior session's tests mock it). This had been silently
  breaking the ALREADY-cut-over dLocal webhooks (Slice 2), Slice 1 crons, and Slice 3 read APIs
  since 2026-07-26 21:06 — discovered only because this CONFIRM checked runtime state directly
  rather than trusting 4A-W6's own "payout engine & reconciliation cron live" claim. Davin fixed the
  queue name (`money-wise-webhook`); Executor committed/pushed (`243887a3`), verified clean boot.
  **Entry criteria re-verification found THREE of Davin's "confirmed" claims did not hold against
  live state, checked twice each:** `RESEND_API_KEY`/`WISE_FUNDING_ALERT_EMAIL` absent (value-blind,
  confirmed absent twice before Davin actually set them); `WISE_ENVIRONMENT=sandbox` not
  `production`; `WISE_API_TOKEN` returned `401 invalid_token` against BOTH sandbox and production
  hosts. All three were then genuinely fixed by Davin and re-verified live (token now `200`s against
  `api.wise.com`, business profile `19918292` matches `WISE_PROFILE_ID` exactly) — not silently
  trusted the second time either, independently re-checked.
  **Step 1 build (DI wiring) surfaced three real gaps beyond the order's own 2-file description**
  (all fixed, `LESSONS-LEARNED.md` L27-class recurrence): `disbursement.types.ts`'s hand-written
  `DisbursementProvider` union was still `'RISE' | 'MOCK'` (Prisma's own generated enum has had
  `'WISE'` since 4A-W2) — widened; `WisePaymentProvider`'s 8 DI-injected collaborators can't be
  built by a plain non-DI factory function — `CronsModule` now imports `WiseModule` (already
  exports a fully-resolved `WisePaymentProvider`), `provider-factory.ts`'s new `'WISE'` case accepts
  it via `config.wiseProvider` rather than importing `wise/*` itself; `disbursement-processor
.service.ts`'s cron was still calling the bare `getAllPayableAffiliates()` unconditionally —
  4A-W6's own `getAllPayableAffiliatesForProvider('WISE')` existed but was never wired into the only
  call site that creates a `PaymentBatch` — fixed. `money-service` 45/45 suites, 372/372 tests (was
  44/44, 367/367). `tsc --noEmit`/`nest build` clean. Committed `7d1e5044` — initially NOT pushed
  (caught before Step 4's verification: `origin/main` was still at the crash-fix commit, meaning the
  env flip would have run against pre-Step-1 code and silently no-op'd to `MOCK` — exactly the
  failure mode Entry Criterion 0 existed to prevent). Pushed, redeployed, clean boot confirmed
  (`CronsModule`/`WiseModule` both initialize with zero DI errors).
  **Step 3 (webhook subscription) executed via scripted API call**, not the Developer Hub UI:
  `03-…reference.md`'s own cited path (`POST /v1/profiles/{id}/subscriptions`) is stale — 404'd even
  on a safe GET; the real path is `POST /v3/profiles/{id}/subscriptions`. All 3 events subscribed
  (`transfers#state-change`, `transfers#payout-failure`, `balances#update`, profile-level,
  `4.0.0`). **Verified via the `WiseWebhookEvent` table directly, not log absence** —
  `wise-webhook.controller.ts`'s test-notification success path is deliberately silent (no
  `logger.*` call), so `railway logs` showing nothing proved nothing; all 3 test events found
  `processed: true, signatureVerified: true` — first-ever real signature verification against
  Wise's actual production key, not a hand-signed fixture.
  **Step 5 (smoke payout) required real production data that didn't exist yet:** zero
  `AffiliateWiseRecipient` rows and zero `Commission` rows existed anywhere in production at
  session start. The existing `affiliate-test@trading-alerts.test` fixture (real, from 2026-07-25,
  the only `AffiliateProfile` row in production) was reused rather than fabricating a new user — no
  synthetic account created. A synthetic $50.00 `APPROVED` `Commission` was inserted (tagged
  `paymentReference: '4A-W7-SMOKE-TEST'` for traceability), self-referential (`userId` = the same
  test user) rather than inventing a second fake user. **Declined to submit the Wise recipient's
  bank account number/bank code myself** — entering bank/account numbers into any field is
  hard-prohibited regardless of authorization; Davin created the recipient live via the production
  API himself (`1513584827`), verified live by the Executor (`GET /v1/accounts/1513584827` → `200`,
  `active: true`, every field matched) before it was linked in the DB (`accountTail`/
  `detailsFingerprint` only, per F41 — no raw account number ever entered this session).
  **A genuine production-code incident found and self-corrected by Davin mid-session:** the first
  attempt to link the recipient edited `money-service/src/main.ts`'s `bootstrap()` to run an
  `AffiliateWiseRecipient.upsert()` on **every future application startup**, silently swallowing
  any error — flagged immediately as permanent hardcoded-PII-adjacent code with a real forward
  data-corruption risk (any future legitimate recipient update would be silently stomped back to
  today's values on the next restart). Davin reverted it (`94fbd7fc`) once its one-time job was
  done; the row itself was verified correct independent of the mechanism.
  **A real batch-draft attempt via the app's own code (`WisePaymentProvider.prepareBatch`) failed
  live with a genuine `422`** from Wise (real quote + real batch group created, transfer rejected) —
  investigating it surfaced **F47** (new, OPEN, see `DECISION-LOG.md`): `wise-quote.service.ts`
  passes the USD `commissionAmount` straight through as `targetAmount` in the recipient's LOCAL
  currency — for THB this meant a `$50` commission requested `50 THB` (≈$1.49), not $50-worth of
  THB. This is the first time any Wise payout code has run against a non-USD recipient; it would
  have silently shorted every non-USD affiliate to ~1–3% of their real commission. **The transfer
  that eventually did complete** (`a2528bbb-.../2272181669`, $50 USD pay-in → 1,394.22 THB) was
  created **out-of-band, not through this bug** — and reconciling its numbers surfaced a SECOND,
  independent gap: it used `sourceAmount`-fixed ($50 total including fees), meaning the recipient
  received THB worth only ~$41.51, not $50 — which does **not** actually satisfy F38's own resolved
  "platform absorbs the fee" design intent either. Neither problem was fixed in this session
  (near-zero-dial VERIFY-RETIRE, not the place for quote-logic redesign) — both fully documented in
  `DECISION-LOG.md` F47 and `LESSONS-LEARNED.md` L29, scoped as a dedicated future PORT session.
  **The local DB was synced to match the real, externally-created Wise resources** (not duplicated —
  the existing `PaymentBatch`/`WiseBatchGroup`/placeholder-`WiseTransfer` rows from the app's own
  failed attempt were corrected in place to point at the real `a2528bbb-…`/`2272181669`, using
  values pulled directly from Wise's API, not from chat-summarized numbers) — verified independently
  after Davin reported it complete, per this session's own established practice of checking every
  claim against live state before trusting it.
  **Not yet closed:** funding is in progress (Davin wiring $50 USD, reference `B2812234`) but not
  yet confirmed landed; `Commission.status` is still `APPROVED`, not `PAID` — the real
  `transfers#state-change` webhook proving the reducer's exactly-once path works end-to-end on a
  genuine (not hand-signed) production payload has not fired yet. RiseWorks archive switches A1/A2
  correctly deferred to 4A-W8 (PRE-DRAFTed this session's close, carrying F47 forward explicitly).
  **Full verification:** `money-service` 45/45 suites, 372/372 tests. `tsc --noEmit`/`nest build`
  clean. Production money-service confirmed `Online` with clean boot logs (zero DI errors) after
  every redeploy this session.
  **Artifacts updated:\*\* `4a-w7-wise-cutover.migration-order.md` (Status → CONFIRMED, Deviations to
  be filled at true close), `DECISION-LOG.md` (F47 registered + full entry, F43 update — alert
  channel now confirmed live), `LESSONS-LEARNED.md` (new L29), `migration-cutover-table.md` (new
  Slice 2W row, Slice 2's stale "zero Wise traffic" note corrected), this file.
  `4a-w8-riseworks-archival.migration-order.md` PRE-DRAFTed (VERIFY-RETIRE, ARCHIVE block),
  entry-gated on 4A-W7 actually finishing (funding confirmed, `Commission=PAID` observed, monitoring
  window clean) — not just executed.
- _(superseded-by-above, retained for context)_ Session 4A-W6 CLOSED, executed as PORT — Part 19.5 (Wise) payout engine (`isFundable`
  branch), zero traffic cut over — 2026-07-26.
  **CONFIRM found the by-now-familiar `LESSONS-LEARNED.md` L11 pattern again** (order file
  modified-but-uncommitted, `PRE-DRAFT → APPROVED`, no Advisor-DRAFT/Davin-approval commit trail,
  paired with a full content rewrite condensing the order's own prose) — asked Davin directly per
  the established pattern rather than trusting or silently correcting it; confirmed live as his own
  authentic edit, including the intentional drop of the original PRE-DRAFT's Admin UI file (deferred
  to a future UI-BUILD session). **Found and corrected FIVE ground-truth drifts before Step 1**
  (`LESSONS-LEARNED.md` L27, now a repeat-offender pattern — recorded in full in the order's own
  Deviations): `WISE_FUNDING_SLA_HOURS` default is 72h, not the 24h the order's Hard Invariant #6
  and Done-when cited (design §6.2/§7.2 and the frozen OpenAPI both say 72); File 1's own prose
  invented a `FundableProvider` shape (`isFundable: boolean` + `getPayInDetails()`/`markFunded()`)
  that doesn't match design §3.3's real interface (`fundingMode`/`prepareBatch`/`completeBatch`/
  `fundBatchFromBalance`/`cancelBatch`, structural type guard); `wise-quote.service.ts`'s quote
  direction followed F38's LATER, binding `DECISION-LOG.md` resolution (quote by `targetAmount`,
  platform absorbs the fee) rather than design §6.2's own now-superseded `sourceAmount` example — a
  new variant where ground truth itself is split across two documents that disagree by date; File
  6's admin controller was built against the frozen OpenAPI's real 7-endpoint surface, not the
  order's own undercounted 3; two files' TARGET paths (`wise/providers/` vs. `disbursement/
providers/`, `crons/` vs. `wise/services/`) diverge from design §8's suggested module layout —
  followed the order's own stated paths.
  **Resolved F43 live** (Davin, this session, due this session per its own registration at 4A-W4):
  Option (a) — Resend REST called directly from money-service (native `fetch`, no new npm
  dependency), not operation-service's own `resend` package.
  **Built all 8 files** (dependency order, committed per file):
  `wise/providers/provider-capabilities.ts` (File 1, `FundableProvider`/`isFundable()` per design
  §3.3 verbatim), `wise/services/{wise-quote,wise-transfer,wise-batch-group}.service.ts` (File 2 —
  the transfer service satisfies Hard Invariant #5's "persist `customerTransactionId` before the
  Wise call" against `WiseTransfer.wiseTransferId`'s real required-`@unique` schema constraint via
  a self-referential placeholder, overwritten once Wise responds), `wise/providers/wise-payment.provider.ts`
  (File 3, `WisePaymentProvider extends PaymentProvider implements FundableProvider`,
  `base-provider.ts` untouched), the `isFundable` branch in `payment-orchestrator.service.ts`
  (File 4, Hard Invariant #1 — a fundable provider never sets `Commission.status = 'PAID'` or
  touches the balance, that stays 4A-W5's reducer's job), `commission-aggregator.service.ts`'s new
  additive `getAllPayableAffiliatesForProvider()` + the `payment-orchestrator.service.ts`
  §3.5(a) `affiliateId` empty-string fix (File 5), `wise/controllers/wise-batches.controller.ts`
  (File 6, full 7-endpoint admin surface), `crons/wise-reconciliation.service.ts` (File 7, hourly,
  same reducer as 4A-W5 fed synthetic dedupe-safe events, REQUIRED funding-SLA alarm via Resend),
  and `wise-payout-engine.spec.ts` + `wise-payout.e2e.spec.ts` (File 8, composed integration
  through real DI-wired services plus an RSA-signed sandbox test payload for the mark-funded →
  reducer → `Commission=PAID` path, per Davin's live CONFIRM-time verification-method call — same
  Option-2 class as 4A-W5's own downgrade, live write-scope access still unresolved, #47).
  **A NEW class of gap found while building, not anticipated by the order or the design doc:** no
  test file existed anywhere in the tree for `payment-orchestrator.service.ts` OR
  `commission-aggregator.service.ts` before this session, despite Hard Invariant #4 and this
  order's own Rules assuming the former already existed as "the parity oracle for non-Wise
  branches." Built both this session (new `LESSONS-LEARNED.md` **L28**). **Writing the
  orchestrator's first-ever real `MockPaymentProvider` test surfaced a genuine pre-existing bug,
  deliberately NOT fixed** (out of scope for a Wise session, and possibly accidentally
  load-bearing): `MockPaymentProvider.sendPayment()` mints its own `transactionId` instead of
  echoing the caller's, so `executeBatch`'s existing result-matching never succeeds for `MOCK` —
  "successful" Mock payments are silently skipped, yet the batch still reports `success: true` and
  gets marked `COMPLETED`. Since `DISBURSEMENT_PROVIDER` stays `MOCK` in production throughout
  Part 19.5 specifically as a no-real-money safety rail, this may be accidentally desirable —
  flagged for Davin/Advisor rather than changed as a drive-by.
  **A second, more severe compound finding surfaced while PRE-DRAFTing 4A-W7 (see Waiting-on #54):**
  design §8.1's own file-inventory table names `disbursement.types.ts`/`disbursement.constants.ts`/
  `providers/provider-factory.ts` as needing a `'WISE'` case — none is in this order's own 8-file
  list, and none was touched (real DI-construction surgery, not an additive fix: `provider-factory.ts`'s
  plain function can't build a `WisePaymentProvider` with 7 injected collaborators). Combined with
  the `MockPaymentProvider` bug above, **4A-W7's own literal Checklist step 4 ("flip
  `DISBURSEMENT_PROVIDER=MOCK → WISE`, redeploy") would currently be a silent no-op** —
  `getDefaultProvider()` doesn't recognize `'WISE'` and would keep returning `'MOCK'`, and a smoke
  payout would silently process through Mock instead of reaching Wise, with the batch still
  reporting green. Recorded as 4A-W7's own new Entry criterion 0 — **that order must not proceed
  past it.**
  **Full verification:** `money-service` test suite 44/44 suites, 367/367 tests (was 33/33, 326/326
  at 4A-W5's close — +11 suites, +40 tests). `npm run build`/`tsc --noEmit` clean both sides.
  `base-provider.ts` verified untouched (0 line changes) via `git diff --stat` against the session's
  start commit. `DISBURSEMENT_PROVIDER` stays `MOCK` in production — this session builds the payout
  engine only, no provider flip, no money moved (and per the finding above, the flip mechanism
  itself isn't wired yet regardless).
  **Artifacts updated:** `4a-w6-wise-payout-engine.migration-order.md` (Status → CONFIRMED,
  Deviations filled in full, Done-when checked), `DECISION-LOG.md` (F43 resolution + full findings
  entry), `LESSONS-LEARNED.md` (L27 recurrence note, new **L28**), `migration-stack-analysis.md`
  (new money-service entries), this file. `4a-w7-wise-cutover.migration-order.md` PRE-DRAFTed
  (VERIFY-RETIRE, CUTOVER block — carries the new Entry criterion 0 blocker forward).
- _(superseded-by-above, retained for context)_ Session 4A-W5 CLOSED, executed as PORT — Part 19.5 (Wise) webhook receiver +
  state reducer, money-service's first BullMQ queue, zero traffic cut over — 2026-07-26.
  **CONFIRM found the by-now-familiar `LESSONS-LEARNED.md` L11 pattern again** (order file
  modified-but-uncommitted, `PRE-DRAFT → APPROVED`, no Advisor-DRAFT/Davin-approval commit
  trail) — 10th+ recurrence — but this time paired with a full content rewrite (5→8 files,
  "Ordered steps" replaced by "Ordered File Breakdown") and a real dropped safety gate: the
  committed PRE-DRAFT's sandbox-funding entry criterion ("if unavailable, stop and re-plan,"
  lifted verbatim from `04-rise-to-wise-migration-plan.md`'s own W5 entry criteria) was absent
  from the rewrite. Re-raised it at CONFIRM because Wise's Simulation API requires a **funded**
  transfer before state simulation, and Waiting-on #47 (still OPEN) already showed the sandbox
  `WISE_API_TOKEN` is read-only — likely blocking transfer creation/funding too. Stopped and
  asked Davin directly: confirmed the rewrite was his own edit, confirmed funding availability
  is genuinely unknown, and chose **Option 2** — verification downgraded from "real payloads
  captured from Wise's Simulation API" to "hand-constructed RSA-signed sandbox test payloads"
  (same keypair-substitution technique `wise-signature.verifier.spec.ts` already uses, 4A-W3a).
  F40 resolved `PROFILE`-level in the same rewrite (Davin, ahead of CONFIRM). All other entry
  criteria (4A-W4 shutdown-hooks/job-ID-policy re-verify, `wise-signature.verifier.ts`
  existence/tests, all 4 cited line counts, zero `registerQueue()`/`@Processor()` calls)
  verified live and passed — a first for this series, zero drift found on any of them. Order
  marked CONFIRMED, executed.
  **Four real order-text-vs-ground-truth mismatches found and corrected while building** (full
  detail in the order's own Deviations, also recorded as `LESSONS-LEARNED.md` **L27**): (1) Hard
  Invariant #3/Rules/Known-wrinkles all said `@SkipThrottle()` on the webhook route; design
  §7.5 was corrected 2026-07-25 (rev 2) — one session earlier — to the opposite (explicit
  generous `@Throttle()`, matching L26); built with the corrected throttle. (2) File 1/8's own
  state-mapping prose diverged from design §5.2's frozen table: `bounced_back` isn't a distinct
  terminal state (stays `PROCESSING` + `hasActiveIssues`, Commission left `PAID`, admin alert,
  not reverted — reverting would flap the balance for a transfer Wise says may still deliver);
  `cancelled` must revert if it was already `PAID` (order said pure no-op); `charged_back` was
  missing entirely despite being a real §5.2 row that can follow any state;
  `incoming_payment_initiated` was also missing. Built the mapper against the real, full table
  (10 states + unrecognised-fallback). (3) File 2/8's text (and File 7/8's own test-case
  description) said the reversal path sets `Commission.status = 'FAILED'` — no such enum member
  exists (`PENDING`/`APPROVED`/`PAID`/`CANCELLED` only, schema-verified); design §5.2's own
  table says `revert PAID → APPROVED`; built against that. (4) File 5/8's text said
  `handleBalanceUpdate` updates `WiseBatchGroup.fundingDetected` — no such field exists, the
  real field is `fundingSource` (enum `WiseFundingSource`); built against the real field, and
  scoped the handler to setting it only, never transitioning `status` to `FUNDED` (reserved for
  4A-W6's batch/funding-gate services, not built yet — flipping it here would be scope creep
  into that session's own job). Separately, File 8/8's own text and Done-when both said the
  `X-Test-Notification` ping should process "without DB write" — design §5.5 explicitly says
  the opposite ("persist, mark processed, 200, do nothing else"); built and tested against
  ground truth (persists).
  **Built all 8 files** (dependency order, committed per file): `wise-state.mapper.ts` (File 1,
  pure §5.2 table), `wise-transfer-state.reducer.ts` (File 2, staleness guard + atomic
  `balanceAppliedAt`/`balanceRevertedAt` locks, the ONLY writer of `Commission.status = 'PAID'`),
  `wise-event-handlers.ts` (File 5, built ahead of File 3 since the processor depends on it —
  `handlePayoutFailure`/`handleBalanceUpdate`, neither ever touches Commission or balance),
  `wise-webhook.processor.ts` (File 3, money-service's first `@Processor`/`WorkerHost`, routes
  by `eventType`, `onModuleDestroy` → `worker.close()`, `attemptCount`/`processed=false` on
  `WiseWebhookEvent` itself is the dead-letter surface — no new infrastructure), FILE 4
  (`wise-webhook.controller.ts`, `POST /v1/webhooks/wise`, store-then-process per §5.5), File 6
  (`wise.module.ts` — `BullModule.registerQueue`; `app.module.ts` needed no change, `WiseModule`
  was already imported since 4A-W3a, contrary to the order's own assumption), File 7
  (`wise-state.reducer.spec.ts`, mapper + reducer unit suite), File 8
  (`wise-webhook.replay.spec.ts`, RSA-signed replay suite) — plus two test files beyond the
  order's own 8-file count (`wise-webhook.processor.spec.ts`, `wise-event-handlers.spec.ts`) to
  actually fulfill Files 3/8 and 5/8's own per-file "Verification" promises, which the order's
  file count never allocated a home for.
  **Full verification:** `money-service` test suite 33/33 suites, 326/326 tests (was 29/29,
  288/288 at 4A-W4's close — +4 suites, +38 tests). `npm run build` clean. Monolith
  `tsc --noEmit` clean (unaffected — no monolith code changed this session). Schema fields
  verified directly against `money-service/prisma/schema.prisma` before writing the
  reducer/handlers, not assumed from the order's prose. `DISBURSEMENT_PROVIDER` stays `MOCK` in
  production — this session builds the webhook receiver only, no provider flip, no money moved,
  no production Wise webhook subscription (Safety Gate, 4A-W7 cuts over).
  **Not fully closed:** the replay suite proves the signature/dedupe/reduction pipeline against
  hand-constructed fixtures, not Wise's real Sandbox Simulation API — closing that gap needs a
  write-scoped sandbox `WISE_API_TOKEN` (same ask as Waiting-on #47).
  **Artifacts updated:** `4a-w5-wise-webhook-reducer.migration-order.md` (Status → CONFIRMED,
  Deviations filled in full, Done-when checked), `DECISION-LOG.md` (F40 resolution + full
  findings entry), `LESSONS-LEARNED.md` (new **L27** — order text can drift from its own cited
  ground truth, silently and more than once, within a single order), `migration-stack-analysis.md`
  (new `money-service/src/wise/*` webhook entries), this file.
  `4a-w6-wise-payout-engine.migration-order.md` PRE-DRAFTed (PORT).
- _(superseded-by-above, retained for context)_ Session 4A-W4 CLOSED, executed as CONTRACT + small INFRA — Part 19.5 (Wise)
  money-service CC-C/CC-D hardening gate, zero traffic cut over, no Wise-specific code —
  2026-07-26.
  **CONFIRM found the order file modified-but-uncommitted again** (header `PRE-DRAFT →
APPROVED`, no Advisor-DRAFT/Davin-approval commit trail) — the same `LESSONS-LEARNED.md` L11
  pattern, 9th recurrence (see L11's own recurrence log for the 8th, at 4A-W3b). Unlike the
  W1/W2 recurrences, none of the order's own cited line-count evidence had drifted this time
  (`main.ts` 51, `app.module.ts` 81, `dlocal-webhook.controller.ts` 415 — all exact live
  matches), and unlike 4A-W3b no open design question had been silently resolved in the
  rewrite — the one new substantive addition (a `Contract:` line citing
  `07-migration-process-change-proposal.md` P1/P2/P3) checked out against that doc's actual
  content (P1/P2/P3 are literally "insert this session" / "fix shutdown" / "fix throttling").
  Stopped and asked Davin directly per the established pattern; confirmed live as his own
  authentic edit. All other entry criteria (4A-W3a/b both CONFIRMED, both defects still live,
  Davin present and explicitly approving Step 4 before it started) verified live and passed.
  Order marked CONFIRMED, executed.
  **Step 1 (idempotency audit, no fixes):** audited all 6 cited money write endpoints. Verdicts:
  Stripe checkout (`app/api/checkout/route.ts`) — no key; subscription cancel — n/a, idempotent
  by construction; `GET /api/invoices` — n/a, read-only (no write path exists under
  `app/api/invoices/*`, correcting the order's own cautious `GET/POST` framing); dLocal payment
  creation (`app/api/payments/dlocal/create/route.ts`) — no key; admin code distribution
  (`app/api/admin/affiliates/[id]/distribute-codes/route.ts`) — no key; payment batch execution
  (`app/api/disbursement/batches/[batchId]/execute/route.ts`) — has an indirect guard
  (`PaymentBatch.status` state machine + `DisbursementTransaction.commissionId`/`.transactionId`
  both `@unique`), not a request-level key but a real DB-enforced one. No fixes applied — audit
  only, per this session's own scope rule; Stripe/dLocal write-path fixes stay 4A-8's.
  **Step 2 (webhook dedupe audit) found a real gap in Plan §13's own cited template:** dLocal
  and Stripe webhooks both dedupe via downstream business-state checks (a status field that
  transitions once), not a webhook-delivery-ID table — no `DlocalWebhookEvent` model exists at
  all, and Stripe's `event.id` is never persisted or checked. Plan §13 names
  `RiseWorksWebhookEvent` as the dedupe template, but that model's own `hash`/`signature`
  fields carry **no unique constraint** (only non-unique indexes) — RiseWorks's actual dedup is
  the same business-state-check shape, not a lookup by hash. The only model in either schema
  with a real DB-enforced dedupe key is `WiseWebhookEvent.deliveryId String @unique` (built
  4A-W2, not yet wired to a live receiver). Flagged for 4A-W5 to inherit `WiseWebhookEvent`'s
  pattern rather than `RiseWorksWebhookEvent`'s; flagged for 4A-8's outbox/idempotency work to
  see the broader gap (see Waiting-on #52).
  **Step 3 (graceful shutdown fix, Defect 1):** added `app.enableShutdownHooks()` to
  `money-service/src/main.ts`; added a previously-missing observable log line to
  `PrismaService.onModuleDestroy()`. Verified with a new test
  (`money-service/src/prisma/prisma.shutdown.spec.ts`) that boots a real `NestApplication`,
  calls the real `enableShutdownHooks()`, and delivers a synthetic in-process `SIGTERM` — the
  first unstubbed attempt genuinely killed the Jest worker mid-test, because Nest's own
  `listenToShutdownSignals()` re-sends the OS signal via `process.kill(process.pid, signal)`
  after cleanup finishes (confirmed by reading `@nestjs/core`'s own source); stubbed
  `process.kill`/`process.exit` to observe the hook firing without dying. Documented the BullMQ
  worker drain policy (`worker.close()` on shutdown) 4A-W5's first queue consumer must follow.
  **Step 4 (dLocal webhook throttling fix, Defect 2 — Davin present, live approval given per
  `EXECUTOR-PROTOCOL.md` §7 before touching this already-cut-over live money route):** added
  `@Throttle({ default: { ttl: 60_000, limit: 300 } })` to `handleWebhook`. Verified two ways:
  the existing 12-test behavioral suite passes unchanged (decorator is metadata-only); and a new
  real-`ThrottlerGuard` burst test (`dlocal-webhook.throttle.spec.ts`) proves the actual effect —
  150 sequential requests through the real guard hit zero 429s on this route, while a control
  route on the identical global default does 429 past 100 in the same run (proving throttling
  is genuinely active, not silently inert). First attempt used `Promise.all` and hit spurious
  `ECONNRESET` from the ephemeral test server's socket pool; switched to sequential requests,
  which also better mirrors how a real dLocal retry burst actually arrives.
  **Step 5:** documented the BullMQ job-ID derivation policy (`jobId = wise:event:<deliveryId>`,
  `jobId = wise:transfer:<customerTransactionId>`) in
  `01-part-19.5-wise-disbursement-architecture-design.md` §8.0 (which had already anticipated
  this session's two prerequisites in outline) and this order's Deviations.
  **Step 6:** registered **F43** (funding-SLA alert delivery channel) OPEN in
  `DECISION-LOG.md`, owner Davin, due 4A-W6.
  **Full verification:** `money-service` test suite 29/29 suites, 288/288 tests (was 27/285 at
  4A-W3a's close — +2 suites/+3 tests: the shutdown spec and the throttle spec). `npm run build`
  clean. Monolith `tsc --noEmit` clean (unaffected — no monolith code changed this session,
  audit-only reads). `DISBURSEMENT_PROVIDER` stays `MOCK` in production — this session hardened
  shared infrastructure only, no provider flip, no money moved.
  **Artifacts updated:** `4a-w4-wise-hardening-gate.migration-order.md` (Status → CONFIRMED,
  Deviations filled in full, Done-when checked), `DECISION-LOG.md` (F43 registered),
  `01-part-19.5-wise-disbursement-architecture-design.md` (§8.0 job-ID policy filled in),
  `migration-stack-analysis.md` (new money-service entry), `LESSONS-LEARNED.md` (new **L25**
  — `enableShutdownHooks()` not optional, new **L26** — global `APP_GUARD` throttler also
  throttles provider webhooks; both per `replace-rise-with-wise/05-artifact-amendments.md`
  §10's two pre-drafted entries, renumbered from that doc's stated L12/L13 to the live file's
  actual next numbers since 5 more sessions' lessons landed since either number was written —
  the doc's own text explicitly warns to re-check before trusting it), this file.
  `4a-w5-wise-webhook-reducer.migration-order.md` PRE-DRAFTed (PORT).
- _(superseded-by-above, retained for context)_ Session 4A-W3b CLOSED, executed as UI-BUILD — Part 19.5 (Wise) recipient
  form & admin UI (monolith `app/api/wise/recipients/*`, `app/affiliate/settings/payout`,
  `app/(dashboard)/admin/disbursement/recipients`), zero traffic cut over — 2026-07-26.
  **CONFIRM found the order file modified-but-uncommitted again** (header `PRE-DRAFT →
APPROVED`, no Advisor-DRAFT/Davin-approval commit trail, paired with a matching
  uncommitted edit to this file) — the same `LESSONS-LEARNED.md` L11 pattern, 8th+
  recurrence. Also found two open design questions the PRE-DRAFT had explicitly left for
  CONFIRM (File 1: flag vs flag-less; File 3: revalidate-button scope) silently resolved
  in the rewrite with no visible decision recorded. Stopped and asked Davin directly:
  status flip confirmed as his own edit, flag-less confirmed, revalidate-button scope
  confirmed (later superseded mid-build, see below). All 5 entry criteria (4A-W3a live
  401 check, F39/F41 resolved, 3 file line counts, `tsc --noEmit`) verified live and
  PASSED — a first for this series, zero drift found. Order marked CONFIRMED, executed.
  **Built (Files 1–4/5, dependency order, committed per step):** `lib/money-service/routes.ts`
  extended with 6 typed Wise recipient wrappers (+`lib/money-service/wise-types.ts`,
  frontend mirror of money-service's own `wise.types.ts`) and 5 new Next.js route
  handlers under `app/api/wise/recipients/*` (File 1); `components/affiliate/wise-recipient-form.tsx`
  (2-step schema-driven form: currency/country → dynamic fields from
  `AccountRequirementGroup[]`, client-side validation, graceful 403/500 handling) +
  `app/affiliate/settings/payout/page.tsx` (File 2); `app/(dashboard)/admin/disbursement/recipients/page.tsx`
  read-only paginated table (File 3); 17 route tests + 6 component tests, all passing
  (File 4).
  **Real auth-semantics mismatch found and escalated mid-build (File 1's last route):**
  the order's own text guarded `POST /api/wise/recipients/[id]/revalidate` with
  `requireAdmin()` and put a "Revalidate" button on the ADMIN page (File 3) — but the
  live `wise-recipients.controller.ts` (frozen at 4A-W3a) guards
  `POST /wise/recipients/:id/revalidate` with `AffiliateGuard` self-service only,
  deriving the recipient from the CALLER's own token (`:id` is only used for an
  ownership check, never to select the target). An admin-guarded proxy would either
  403 or silently revalidate the admin's OWN recipient instead of the target
  affiliate's — a real bug class, not a style choice. Escalated per
  `EXECUTOR-PROTOCOL.md` §5 rather than building it as specified; Davin's live call:
  move Revalidate to the affiliate's own payout settings page
  (`requireAffiliate()`-guarded, matching the backend); the admin page stays strictly
  view-only, no actions at all.
  **Order text vs. live tree drift found:** File 2's TARGET
  (`app/(dashboard)/affiliate/settings/payout`) doesn't exist — the live `(dashboard)`
  route group has no `affiliate/` subtree at all (affiliate pages live at
  `app/affiliate/*`, their own separate layout with its own auth-check). Built at
  `app/affiliate/settings/payout/page.tsx` instead, matching F39's actual recorded URL
  (`DECISION-LOG.md`, Session 4A-W3a) with its own thin layout mirroring
  `app/affiliate/dashboard/layout.tsx`'s auth pattern; added one nav-link entry to that
  layout so the new page is actually discoverable. Also added one nav-link entry to
  `app/(dashboard)/admin/disbursement/layout.tsx` for the new admin page.
  **File 1's own route list omitted `POST /wise/recipients/requirements/refresh`** even
  though the Contract section documents it and File 2's `refreshRequirementsOnChange`
  interaction needs it — added the wrapper + route as a deviation (already-frozen,
  already-documented endpoint, not scope creep). The interaction itself still can't be
  proven live (`GET requirements` still returns `quoteId: null`, 4A-W3a's known gap) —
  wired up but skips the network call when `quoteId` is null (guaranteed 400
  otherwise), tested against a mocked `quoteId` instead.
  **Full test suite:** `test:ci` 119/119 suites green (2105/2105 tests, +2 suites/+23
  tests over the 4A-W3a baseline). `tsc --noEmit` clean throughout. `DISBURSEMENT_PROVIDER`
  stays `MOCK` in production — this session shipped UI only, no provider flip, no money
  moved; the write path (`POST /wise/recipients`) still 403s in production on the
  read-only token, handled gracefully in the form's UI per 4A-W3a's carried-forward gap.
  **Artifacts updated:** `4a-w3b-wise-recipient-ui.migration-order.md` (Status →
  CONFIRMED, Deviations filled in full), `DECISION-LOG.md` (new Session 4A-W3b findings
  entry), `migration-stack-analysis.md` (new frontend-surface entry), this file.
  `4a-w4-wise-hardening-gate.migration-order.md` PRE-DRAFTed (CONTRACT + small INFRA).
- _(superseded-by-above, retained for context)_ Session 4A-W3a CLOSED, executed as PORT — Part 19.5 (Wise) recipient
  onboarding backend module (`money-service/src/wise/*`), zero traffic cut over — 2026-07-26.
  **CONFIRM (two passes):** first pass found 4/6 entry criteria FAILING against live state —
  F39/F41 still OPEN, `WISE_API_TOKEN` absent from Railway (value-blind check), and all
  three cited line counts stale by up to +212 lines (the order had been drafted from a
  mid-session snapshot before 4A-W2's own migration commit landed). Reported in full,
  execution declined. Second pass, after Davin resolved F39 (Option A — affiliate
  self-service, `/affiliate/settings/payout`) and F41 (Option A — Wise-managed PII, local
  `accountTail`/`detailsFingerprint` only), corrected the line counts, and confirmed the
  split/`APPROVED` status was his own intentional edit (no git commit trail existed for
  it — same `LESSONS-LEARNED.md` L11 shape as prior recurrences, resolved by asking
  directly): all 6 criteria re-verified live and passed, order marked CONFIRMED.
  **Built (Files 1–8/10, dependency order, committed per step):** `wise.config.ts`
  (`ConfigService`-backed typed settings), `wise.constants.ts`, `wise.types.ts`,
  `wise-api.client.ts` (native `fetch`, exponential back-off on 429/5xx, PII body
  redaction — 5 unit tests), `wise-signature.constants.ts` (Wise's real published
  sandbox/production RSA public keys, copied verbatim from the reference doc),
  `wise-signature.verifier.ts` (`crypto.verify('RSA-SHA256', ...)` — 6 unit tests, built
  ahead of 4A-W5), `wise-recipient.service.ts` (SHA-256 `detailsFingerprint` + last-4
  `accountTail` only, zero raw PII persisted — 14 unit tests),
  `wise-recipients.controller.ts` + `wise.module.ts` (`/v1/wise/recipients/*` per the
  frozen OpenAPI, F39 guards: `AffiliateGuard` on every affiliate route, `AdminGuard` only
  on the admin list, `:id`-scoped routes verify ownership explicitly), registered in
  `app.module.ts`.
  **Mid-build correction (`2d954e12`):** reading the frozen OpenAPI while building the
  controller found `CreateRecipientDto` (File 3/10, mirrors Wise's own `POST /v1/accounts`
  body) is a DIFFERENT shape than the OpenAPI's actual `POST /wise/recipients` request
  (`targetCurrency`/`recipientCountry`/`legalType`/`accountHolderName`/`requirementsType`/
  `details`) — `createRecipient` corrected to take `recipientCountry`/`legalType` as
  explicit caller-supplied fields instead of guessing from `details`; also added
  `revalidateRecipient` (required by the frozen `/revalidate` endpoint, absent from File
  7/10's own method list) and `DELETE /wise/recipients/{id}` (in the OpenAPI, missing from
  the order's own File 8/10 prose). **Unresolved, flagged for Davin/Advisor:** the OpenAPI
  says replacing a recipient should archive the old row; `AffiliateWiseRecipient
.affiliateProfileId` is `@unique` in the 4A-W2 schema (out of scope to change here), so
  this session upserts in place instead — needs a decision.
  **File 9 (THB production fixture) blocked, Davin deferred it:** tested the configured
  token against `api.wise.com` (`railway run`, token never exposed) → `401 invalid_token`
  — confirmed sandbox-only, not just labeled that way. Carried forward as Waiting-on.
  **Deploy blocked twice, then fixed:** `railway up` CLI failed both without
  `--path-as-root` (438MB upload, 413 — couldn't resolve `.gitignore` from the
  subdirectory) and with it ("Failed to read app source directory" — Root Directory
  mismatch). Found the working path: `git push origin main` (money-service has a connected
  GitHub source) — auto-deployed cleanly twice this session, confirmed live both times
  (all 6 new routes registered, unauthenticated `GET /v1/wise/recipients` and
  `/requirements` and `/me` all → 401). New `LESSONS-LEARNED.md` L23.
  **E2E testing against live production** (real minted NextAuth JWE for the existing
  `affiliate-test@trading-alerts.test` fixture, mirroring 4A-7a's precedent — no new
  production data written): found and fixed a real bug (`f100296a`) — the discouraged
  non-quote-scoped requirements fallback 422s without `sourceAmount`
  (`validation.failure.only.source.or.target.amount`), missed from the reference doc's own
  example on the first pass. Fixed, redeployed, re-verified: `GET requirements?
targetCurrency=GBP` → real `200`, 3 groups from Wise sandbox. **Full recipient-creation
  E2E NOT achieved:** `POST /v1/accounts` confirmed live `403 unauthorized` — isolated via
  a direct call to Wise sandbox, a genuine token read-only-scope limitation, not a code
  bug (the entry criterion "read-only is sufficient" holds for reads, not for recipient
  creation). Davin's call: accept as a confirmed external blocker rather than provide a
  write-scoped token this session — carried forward as Waiting-on.
  **Artifacts updated:** `4a-w3a-wise-recipient-backend.migration-order.md` (Status →
  CONFIRMED, Done-when checked/unchecked accurately, Deviations filled in full),
  `DECISION-LOG.md` (F39/F41 resolution entries + a full findings entry),
  `migration-stack-analysis.md` (new `money-service/src/wise/*` entry),
  `LESSONS-LEARNED.md` (new L23), this file.
  `4a-w3b-wise-recipient-ui.migration-order.md` already PRE-DRAFTed (from 4A-W2's close).
- _(superseded-by-above, retained for context)_ Session 4A-W2 CLOSED, executed as INFRA+PORT — Part 19.5 (Wise) additive
  production schema migration, zero traffic cut over — 2026-07-26.
  **CONFIRM found the order file itself mid-edit again:** `git status` showed
  `4a-w2-wise-additive-schema.migration-order.md` modified-but-uncommitted; `git diff` against
  the last commit showed `Status: PRE-DRAFT → APPROVED` with no Advisor-DRAFT/Davin-approval
  commit trail, and all four of the order's own line-count entry-criteria numbers had shifted
  `+1` away from both the committed version and the live codebase
  (`prisma/non-market-data/schema.prisma` 1023→1024, `money-service/prisma/schema.prisma`
  583→584) — the same `LESSONS-LEARNED.md` L11 pattern, 6th recurrence. Stopped and asked Davin
  live rather than trusting or silently correcting; Davin confirmed the edit was his own, kept
  `APPROVED`, and asked for the four numbers corrected back to the `wc -l` baseline (done).
  **Steps 1–2:** authored the 5 new models (`AffiliateWiseRecipient`, `WiseTransfer`,
  `WiseBatchGroup`, `WiseWebhookEvent`, `WiseWebhookSubscription`) + 3 new enums + `WISE` enum
  value + 3 back-relations verbatim from `01-…design.md` §4.1–4.2 in
  `prisma/non-market-data/schema.prisma`; `prisma validate` clean, diff additions-only.
  **Near-miss on SQL generation:** the order's literal `prisma migrate dev --create-only`
  command hit live drift detection against production (pre-existing untracked drift from past
  `db push` usage, unrelated to this session) and printed "We need to reset the 'public'
  schema... All data will be lost" — it only stopped short of the confirmation prompt because
  stdin wasn't a TTY (exit 130). Verified immediately via a real query against production: no
  data lost. Stopped, reported the near-miss in full, got Davin's explicit go before touching
  the DB connection again. **Fix:** generated the SQL via `prisma migrate diff --from-schema
<pre-edit snapshot> --to-schema prisma/non-market-data/schema.prisma --script` instead — pure
  datamodel diff, zero DB connection, can never propose a reset. Output verified clean (zero
  `DROP`/`ALTER COLUMN`/`RENAME`), written to
  `prisma/migrations/20260726000000_wise_disbursement_additive/migration.sql`.
  **DATABASE_URL vs DIRECT_URL confusion:** post-verification querying via `DATABASE_URL`
  (matching `lib/db/prisma.ts`'s runtime pattern) showed the new tables didn't exist — traced to
  `DATABASE_URL` (`turntable.proxy.rlwy.net`) and `DIRECT_URL` (`maglev.proxy.rlwy.net`) being
  genuinely different databases (different `User`/`Subscription` counts), not two proxy fronts
  to one instance. Stopped and asked Davin rather than guessing; confirmed live:
  `maglev`/`DIRECT_URL` is real production, `turntable`/`DATABASE_URL` is this checkout's
  staging target. New `LESSONS-LEARNED.md` L22 + a recurrence note on L19.
  **F38 resolved** (Davin, live): **Option A** — the platform bears the Wise fee
  (`feeBearer = 'PLATFORM'`), affiliates receive their exact earned commission with no fee
  deduction. Logged in full in `DECISION-LOG.md`.
  **Step 4 (apply to production, Davin present):** `prisma migrate deploy` against
  `DIRECT_URL`/production — clean, all 5 tables + `WISE` enum value confirmed via direct query,
  pre-existing table row counts confirmed unchanged (the applied SQL contains zero
  `UPDATE`/`DELETE`/`ALTER TABLE` statements capable of touching existing rows in the first
  place). Monolith's own Prisma client regenerated to match.
  **Step 5:** hand-mirrored the 5 models + 3 enums into `money-service/prisma/schema.prisma` as
  a subset — FKs to the 3 pre-existing shared models (`AffiliateProfile`, `PaymentBatch`,
  `DisbursementTransaction`) kept as bare scalars (no money-service code traverses them yet,
  same convention as `AffiliateCode<->Commission`); FKs _within_ the new Wise set kept as real
  relations. `prisma generate` only (never `db push`/`migrate deploy`, L1) — money-service
  builds clean, generated client confirmed to include all 5 models.
  **Step 6 (grant check):** proved via `SET ROLE money_svc` + a real
  INSERT/SELECT/UPDATE/DELETE cycle (rolled back, zero residue) against production — found
  `money_svc` had **zero** grants on all 5 new tables, exactly the risk register's predicted
  "most likely silent failure." Role-grant change → escalated to Davin per
  `EXECUTOR-PROTOCOL.md` §7 rather than just applying the order's own suggested fix; Davin
  approved. `GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER, TRUNCATE` applied,
  re-verified clean via the same real-query method (not a grant listing alone).
  **Step 7:** re-audited `amountRiseUnits`/`payeeRiseId` null-tolerance — the order's own text
  cited `report-builder.service.ts`/`admin-affiliate-reports.controller.ts`, but neither file
  references either field (checked); design §3.5(b) actually names 5 different files
  (`transaction.service.ts`, `payment-orchestrator.service.ts`, one API route, two admin
  pages) — verified all 5 against the live tree, all still null-safe exactly as the design doc
  claims, no reader needed editing.
  **Step 8:** added the archived-block banner (F42) to both schema files — comment-only, both
  re-validated clean.
  **Step 9:** fixed one real `tsc` error caused by the schema change (`types/disbursement.ts`'s
  hand-written `DisbursementProvider` union didn't include `'WISE'` — both dispatch functions in
  `lib/disbursement/providers/provider-factory.ts` already default to unavailable/throw for any
  unhandled provider, so this was a type-only, zero-behavior-change fix). `tsc --noEmit` clean;
  `eslint app components lib hooks --max-warnings 0` clean (0 errors, 0 warnings — a first,
  naive `eslint .` invocation wrongly scanned `e2e/archive/`, the separate
  `frontend-and-backend-python-stack/`, and `.next/` build output, producing 9534 unrelated
  problems; corrected to the project's own `validate:lint` scope); monolith `test:ci` 117/117
  suites, 2082/2082 tests (matches Session 5-4's baseline exactly); money-service has no `lint`
  script (order text inaccuracy) — `npm run test` 24/24 suites, 260/260 tests, `npm run build`
  clean.
  **Artifacts updated:** `4a-w2-wise-additive-schema.migration-order.md` (Status → CONFIRMED,
  line counts corrected, Deviations filled in full), `DECISION-LOG.md` (F38 register row +
  resolution entry), `LESSONS-LEARNED.md` (L19 recurrence, new L22),
  `migration-stack-analysis.md` (new schema/migration/type-fix entries), this file.
  `4a-w3-wise-recipient-onboarding.migration-order.md` PRE-DRAFTed (PORT + UI-BUILD).
- \_(superseded-by-above, retained for context) Session 4A-W1 CLOSED, executed as CONTRACT — Part 19.5 (Wise) contracts &
  decisions, no code, no schema, no money moved — 2026-07-26.
  **CONFIRM found the order file itself mid-edit:** `git status` showed
  `4a-w1-wise-contracts-and-decisions.migration-order.md` as modified-but-uncommitted;
  `git diff` against the last commit revealed the header had been flipped `DRAFT → APPROVED`
  with no Advisor/Davin approval commit trail, and — independently — all five of the order's
  own cited line-count entry-criteria numbers had each shifted by exactly `+1` away from both
  the committed version and the live codebase (`base-provider.ts` 174→175,
  `provider-factory.ts` 105→106, `payment-orchestrator.service.ts` 333→334, `app.module.ts`
  75→76, `non-market-data/schema.prisma` 1023→1024 — plus a sixth, non-entry-criterion number
  in the handoff section, `transaction.service.ts` 310→311). This is the same shape as
  `LESSONS-LEARNED.md` L11's four prior recurrences (self-contradicting/uncommitted order
  status) — stopped and reported to Davin rather than trusting or silently correcting either
  field. Davin confirmed live: the `DRAFT→APPROVED` edit was his own intentional approval, and
  he separately restored all five line-count numbers to the correct `wc -l` baseline before
  saying go. Re-verified live: paths exist, line counts hold exactly (174/105/333/75/1023),
  zero drift against the design doc. Order then marked CONFIRMED and executed.
  **Steps executed:** read the full docset (`00`→`07`, `01`, `02`, `04` in full per the
  order's own reading order; `03`/`05`/`06` read in full rather than skimmed, since `05`'s
  paste-ready blocks were needed verbatim and `02`/`03`/`06` fed the OpenAPI freeze/secret
  matrix directly). Business Payment Approval rules: **confirmed absent** on the Wise business
  account (Davin, live) — no action needed before 4A-W6. **F36 resolved: Model A** (Business +
  personal API token) — Davin's 2026-07-25 "design for both" superseded by an explicit live
  choice this session; funding stays `MANUAL` regardless (Thailand region gate), and F36 also
  fixes the webhook subscription level as profile-level for F40. **F37 resolved: `MANUAL`** —
  Thailand region re-confirmed live. Sandbox identity bootstrapped: `GET /v1/profiles`
  (Davin ran it himself, response body shared back, token never entered this session) →
  business `WISE_PROFILE_ID` = `29617748` (type `business`; a sibling personal profile
  `29617747` also exists and was **not** recorded as the business ID). `WISE_SOURCE_CURRENCY`
  = `USD`, balance confirmed to exist on the account (Davin). F38–F41 registered OPEN in
  `DECISION-LOG.md`'s flag register with owners/due sessions (F43 deliberately **not**
  registered — stays deferred to 4A-W4 per the order's own scope). F42 recorded RESOLVED
  (RiseWorks archive-not-delete) with the full entry from the docset template.
  `4a-5-rw-money-service-riseworks-webhook-cutover.migration-order.md` marked **REVOKED**
  (file retained). `part19.5-wise-disbursement-openapi.yaml` reviewed against live
  money-service code — guard names (`JwtAuthGuard`/`AdminGuard`/`AffiliateGuard`), the global
  `/v1` prefix excluding `health`/`health-auth` (`main.ts`, 51 lines), and a route-collision
  check against all 8 registered controllers: zero drift, zero collisions — `info.description`
  marked `Status: CONTRACT (frozen at 4A-W1)`. The §5.2 Wise-state mapping table in
  `01-…architecture-design.md` marked invariant. `docs/secret-matrix.md` extended with all
  `WISE_*` variables and the token promotion plan (read-only 4A-W1/W3/W5, full access only from
  4A-W6). THB-not-testable-in-sandbox limitation recorded in this order's Deviations and
  carried into the `4A-W2` PRE-DRAFT.
  **Artifacts updated:** `4a-w1-wise-contracts-and-decisions.migration-order.md` (Status →
  CONFIRMED, Deviations filled), `DECISION-LOG.md` (flag-register rows F36–F42 + full
  resolution entries for F36/F37/F42 + the payment-approval finding),
  `4a-5-rw-…migration-order.md` (REVOKED), `part19.5-wise-disbursement-openapi.yaml` (frozen),
  `01-…architecture-design.md` (§5.2 invariant marker), `docs/secret-matrix.md` (Wise section),
  `monolith-to-microservices-migration-session-playbook.md` (Part 19.5 session block + quick-
  reference rows), `SESSION-PROMPT-SCRIPT.md` (4A-W1…W8 rows), this file.
  `4a-w2-wise-additive-schema.migration-order.md` PRE-DRAFTed (INFRA+PORT).
- \_(superseded-by-above, retained for context) Session 4A-7b CLOSED, executed as VERIFY-RETIRE — money-service Slice 3
  read-API CUTOVER, both flag groups flipped ON in production — 2026-07-26.
  **CONFIRM found entry criterion #2 FAILED, not just unverified:** value-blind
  `vercel env ls` (all environments) showed `MONEY_SERVICE_URL`,
  `MIGRATE_READ_APIS_MONEY_AFFILIATE`, and `MIGRATE_READ_APIS_MONEY_ADMIN` did not exist
  anywhere in Vercel — 4A-7a's close-out claim of "added to `.env.example`" was accurate
  but never carried into the real environment. This was not benign: `MONEY_SERVICE_URL`
  absent means `lib/money-service/client.ts:15`'s `?? 'http://localhost:3002'` fallback
  would have hard-failed 100% of a flipped group's traffic against an unreachable local
  address, with no graceful degradation (the flag itself disables the monolith
  fallback). Stopped and reported to Davin rather than silently fixing or silently
  proceeding; Davin approved the fix live. **Fix executed:** added all 3 vars to Vercel
  production (`MONEY_SERVICE_URL` set to money-service's real Railway address, both
  flags `false`), redeployed to establish a genuine OFF baseline
  (`trading-alerts-saas-frontend-bt69dabys.vercel.app`), re-verified value-blind, then
  smoke-tested both route groups unauthenticated before touching the checklist.
  Order then marked CONFIRMED. **Cutover executed:** Group (a)
  `MIGRATE_READ_APIS_MONEY_AFFILIATE=true` + redeploy, confirmed clean, then Group (b)
  `MIGRATE_READ_APIS_MONEY_ADMIN=true` + redeploy, confirmed clean. Unauthenticated
  smoke test after each flip: all 4 affiliate routes → 500, confirmed as the
  pre-existing L12 bug (`error.message`-vs-`.code`, present identically in all 4 route
  files — the flag check runs after `requireAffiliate()`, so it can't be caused by the
  flip); all 8 admin routes → 401, guards correct, no L12-class bug on this group. No
  code changed anywhere this session — 3 env var writes + 3 redeploys only, per this
  VERIFY-RETIRE order's near-zero creativity dial. **Not fully closed:** no real
  authenticated request has yet been observed reaching money-service post-cutover in
  either group (see Waiting-on #40) — same open-monitoring-caveat class as Slices 1/2.
  **Artifacts updated:** `4a-7b-money-service-read-apis-cutover.migration-order.md`
  (Status → CONFIRMED, entry criteria checked, Deviations recorded in full),
  `DECISION-LOG.md` (new Session 4A-7b entry), `migration-cutover-table.md` (Slice 3 row
  → `CUT-OVER`), this file.
- \_(superseded-by-above, retained for context) Session 4A-7a CLOSED, executed as
  UI-BUILD (+CONTRACT) — money-service
  Slice 3 read-API transport BUILD, zero traffic cut over — 2026-07-25.
  **CONFIRM:** re-verified Blocker-1's httpOnly evidence live (all four points held
  exactly at their cited lines); re-verified Session 4A-6's 12 GET routes still 401
  unauthenticated (live spot-check); reviewed the parity baseline
  (`4a-6_test-results_ready_to_proceed_with_4a-7a.md`, 12/12 green). Audited Waiting-on
  #36/#38 against live Railway deployment history rather than trusting the existing
  CLAUDE.md claims: **#36 closed clean** (deployment `b401bc62`'s natural `[CRON]` ticks
  across the full 2026-07-23 UTC 00:00–04:00 window, `errorCount: 0`, zero duplicate
  rows). **#38 found NOT closed** — walked every deployment since the signature fix and
  found the "confirmed live — correct DB writes, second replay idempotent" language in
  this file and `migration-cutover-table.md` unsupported by the logs (the only two
  logged deliveries were pre-replay-guard-fix synthetic payloads that both 404'd on
  `Payment record not found`, zero DB writes). Raised this live with Davin rather than
  silently resolving either way; Davin's correction: that verification never actually
  happened against a live DB record, only unit/integration-tested in development — #38
  stays OPEN with this corrected context (see Waiting-on below), non-blocking for this
  BUILD-only session. Also found `npm run validate`'s `validate:format` step failing on
  287 files — traced to `core.autocrlf=true` on this Windows checkout (CRLF vs.
  prettier's LF default), a pre-existing environmental artifact, not a regression;
  Davin's live ruling: `tsc --noEmit` + `eslint --max-warnings 0` (both re-verified
  clean after every edit) is the code baseline for this repo on Windows, not the full
  `validate:format`/`validate:policies` chain — `prettier --write` across 287 files was
  explicitly declined as an out-of-scope drive-by.
  **F45 resolved** (Davin, live): Option (a) server-side proxy — Next.js route handlers
  read the httpOnly session cookie server-side and forward it as `Authorization: Bearer`
  to money-service, mirroring `lib/operation-service/client.ts`'s proven pattern.
  money-service's `ALLOWED_ORIGINS` CORS allowlist becomes dead config under this
  decision — do not widen it later "to fix CORS." **F44 resolved** (Davin, live):
  Option (a) manual parity verification (the 12/12-route parity check already on file)
  stands in for the 48h shadow-run, matching the F35 precedent. Both logged in full in
  `DECISION-LOG.md`.
  **Built:** `lib/money-service/client.ts` (mirrors operation-service's
  `MoneyServiceError`/error-mapping shape), `lib/money-service/routes.ts` (server-only
  cookie read + typed wrappers for all 12 Slice-3 routes), `lib/money-service/flags.ts`
  (`MIGRATE_READ_APIS_MONEY_AFFILIATE` / `_ADMIN`, both default OFF — split per-group so
  4A-7b's own per-group flip order and its "no code work" constraint both hold). Wired
  the flag check into all 12 existing Next.js API route handlers — the monolith's own
  `requireAffiliate()`/`requireAdmin()` check always runs first, unchanged; only on a
  pass does the flag gate a branch to money-service, falling through to the existing
  Prisma logic when OFF (the default in every environment, including production).
  `MONEY_SERVICE_URL` + both flags added to `.env.example`.
  **Step 5 (prove one signed-in call end-to-end):** per Davin's explicit direction, used
  a temporary scratch script minting a real NextAuth v4 session token (via
  `next-auth/jwt`'s own `encode()`, same `NEXTAUTH_SECRET`) for the project's canonical
  `affiliate-test@trading-alerts.test` / `free-test@trading-alerts.test` fixtures
  (seeded via the existing dev-only `/api/test/seed` endpoint — no real customer data
  touched), run against a local dev server with the affiliate flag on and
  `MONEY_SERVICE_URL` pointed at live production money-service. Confirmed in Railway's
  HTTP logs that the forwarded request genuinely reached money-service (not the
  monolith fallback); `JwtAuthGuard` correctly decoded the forwarded Bearer JWE and
  `AffiliateGuard` correctly authorized it. The response was a `404` rather than `200`
  — traced to local dev's `DATABASE_URL` (likely the F34 staging Postgres project)
  being a **different database** than money-service's production `DATABASE_URL`
  (confirmed by querying each directly) — the seeded test fixture genuinely doesn't
  exist in the DB money-service reads, so the 404 is money-service's Prisma layer
  working correctly against real data, not a transport failure. 403 negative case
  (non-affiliate token) verified correct. 401 negative case (no cookie) surfaced a
  **pre-existing, unrelated bug**: `LESSONS-LEARNED.md` L12 (the monolith's
  `stats/route.ts` catch block checks `error.message` for a marker `AuthError` only
  ever sets on `.code`) — falls through to a generic 500 instead of 401; untouched by
  this session's edits, out of scope to fix here. Davin's live call: this evidence is
  sufficient proof of the F45 transport/auth-bridge working end-to-end — did not write
  test data into production to force a literal 200. Scratch script + local dev server
  both cleaned up after use.
  **Artifacts updated:** `4a-7-money-service-read-apis-cutover.migration-order.md`
  (already SUPERSEDED by the Advisor when 4A-7a was drafted), `DECISION-LOG.md` (F44/F45
  full entries), `migration-cutover-table.md` (Slice 3 row), `migration-stack-analysis.md`
  (new `lib/money-service/*` files + 12 modified route handlers), this file.
  `4a-7b-money-service-read-apis-cutover.migration-order.md` PRE-DRAFTed (VERIFY-RETIRE).
- \_(superseded-by-above, retained for context) Session 4A-5 CLOSED, executed as
  money-service webhooks Slice 2 CUTOVER (dLocal-only, scope-amended 2026-07-24) —
  2026-07-24.
  **CONFIRM (two live passes this session):** first pass found the order's own header
  read `DRAFT (scope-amended, awaiting Davin's approval)` — not APPROVED, contrary to
  the initial framing — and found no evidence yet of Entry Criterion #2 (a real signed
  dLocal webhook verified against the new endpoint); stopped and asked Davin live
  rather than assume, per the order's own explicit gate. Second pass, after Davin's own
  shadow-run/debugging work landed: found two real bugs already fixed and recorded as
  Deviations, both explicit Davin-authorized scoped exceptions (EXECUTOR-PROTOCOL.md §7
  money/auth escalation) — `8e681297` (signature verification read a `x-signature`
  header dLocal never sends; real signature is `Authorization: V2-HMAC-SHA256,
Signature: <hex>` over `X-Login+X-Date+body`, not the raw body alone) and `1cc31b24`
  (webhook replay of an already-COMPLETED payment created a duplicate "Welcome to
  PRO!" `Notification` row — `Payment`/`Subscription`/`Commission` writes were already
  idempotent, only `notification.create()` lacked a guard). The order's own Deviations
  notes explicitly flagged that neither fix alone satisfied Entry Criterion #2 — asked
  Davin live whether the actual post-fix real-signed-payload replay had been verified;
  confirmed yes (correct `Payment`/`Subscription` DB writes, second replay idempotent).
  Also confirmed live: chain-length-one narrows to dLocal-cutover-first (see standing
  instruction above).
  **Flip executed** (order's Checklist step 3, dashboard-side, by Davin): dLocal
  Merchant Dashboard webhook URL updated to
  `https://money-service-production.up.railway.app/v1/webhooks/dlocal`. Railway logs
  checked immediately after: clean boot, no errors, but no real payment webhook had
  landed in that log window yet.
  **Monitoring caveat (order's Checklist step 4, not fully closed this session):** the
  first live post-flip delivery hasn't been directly observed — spot-check `railway
logs` for money-service on the next real dLocal payment (expect no errors, correct
  `Payment`/`Subscription` row updates) before treating dLocal as fully stable.
  Recorded in `migration-cutover-table.md`'s Slice 2 row.
  **Process note:** a `railway variables --kv` check (to confirm `DLOCAL_WEBHOOK_SECRET`
  was set) printed the actual secret value into the session transcript — should have
  been a value-blind existence check instead. Value not reproduced in any artifact;
  Davin may want to weigh rotation given it now sits in a transcript. New
  `LESSONS-LEARNED.md` entry recorded.
  **Artifacts updated:** `migration-cutover-table.md` (Slice 2 row →
  `CUT-OVER (dLocal only)`, RiseWorks portion noted separately), `CLAUDE.md` (this
  block, chain-length-one narrowing, Waiting-on). `DECISION-LOG.md` — no flag applies
  to this specific cutover mechanism, left unchanged.
- **Current order:** `docs/migration-orders/4a-11-outbox-email-worker.migration-order.md` (Slice 5
  Outbox Email Worker BUILD, PORT variant) — CONFIRMED and executed 2026-07-30, closed clean (see
  Current above and Order status below). Independent of the Slice 4/dLocal track (F49) — run in
  parallel per Davin's own established allowance from 4A-10c's close. New
  `4a-12-outbox-email-worker-cutover.migration-order.md` PRE-DRAFTed (VERIFY-RETIRE, fast-path
  eligible) is the literal next session on this track.
  No formal order file governs Session 4A-10c — ad-hoc per
  `EXECUTOR-PROTOCOL.md` §6 (Davin directed it live in chat; labeled clearly here, same
  phase/session numbering family as 4A-10b). Its predecessor,
  `docs/migration-orders/4a-10-money-service-write-apis-cutover.migration-order.md` (4A-10b,
  CUTOVER), stays CONFIRMED/executed, effectively closed for Groups A/C/D (Stripe, Admin,
  Disbursement all genuinely cut over). Group B (dLocal): 4A-10c fixed and live-verified the F48
  signing bug for real, but uncovered a second, previously-masked bug (`DECISION-LOG.md` F49,
  `payment_method_flow` missing from the outbound request) blocking it now instead — see Current
  above and Order status below. Group B needs its own dedicated fix session against F49, not a
  further continuation of the 4A-10b VERIFY-RETIRE order.
  Predecessor `4a-10a-money-service-write-transport.migration-order.md` stays CONFIRMED/executed,
  fully closed clean 2026-07-27 (see Order status below). Predecessor
  `4a-9-money-service-write-apis-port.migration-order.md` stays CONFIRMED/executed (see historical
  block below). Predecessor `4a-8-security-hardening-gate.migration-order.md` stays
  CONFIRMED/executed (see historical block below). Run concurrently with, not superseding, the
  still-open Wise track's own current order:
  `docs/migration-orders/4a-w7-wise-cutover.migration-order.md` (CONFIRMED and executed by Executor
  2026-07-27 — funding in progress, not yet fully closed; see Current above). Predecessor
  `4a-w6-wise-payout-engine.migration-order.md` stays CONFIRMED/executed (see historical block
  below). Predecessor `4a-w5-wise-webhook-reducer.migration-order.md` stays
  CONFIRMED/executed (see historical block below). Predecessor `4a-w4-wise-hardening-gate.migration-order.md` stays
  CONFIRMED/executed (see historical block below). Predecessor
  `4a-w3b-wise-recipient-ui.migration-order.md` stays
  CONFIRMED/executed (see historical block below). Predecessor
  `4a-w3a-wise-recipient-backend.migration-order.md` stays CONFIRMED/executed (see historical
  block below — split from the unsplit `4A-W3` PRE-DRAFT into `4A-W3a` backend + `4A-W3b` UI).
  The unsplit `4a-w3-wise-recipient-onboarding.migration-order.md` is now SUPERSEDED (stub
  pointing to the split files). Predecessor `4a-w2-wise-additive-schema.migration-order.md`
  stays CONFIRMED/executed (see historical block below). Predecessor
  `4a-w1-wise-contracts-and-decisions.migration-order.md` stays CONFIRMED/executed (see
  historical block below). Predecessor money-service order
  `4a-7b-money-service-read-apis-cutover.migration-order.md` stays CUT-OVER/closed, superseding
  `4a-7-…`/`4a-7a-…` (both SUPERSEDED, retained as audit trail).
  `4a-5-rw-money-service-riseworks-webhook-cutover.migration-order.md` stays **REVOKED**
  (2026-07-26, Session 4A-W1) — RiseWorks replaced by Wise per F42, file retained.
- **Order status (4A-10b):** CONFIRMED, executed — 3 of 4 groups genuinely CUT-OVER as of
  2026-07-30 (Stripe, Admin, Disbursement all flag `true` in production, confirmed via live
  requests + independent money-service log cross-checks). Group B (dLocal) flag stays `false`.
  Two orphaned `Payment` rows from 2026-07-28 were deleted by Davin and independently re-verified
  gone; a third (`cms79jwuw00000frzsiurqtk4`) was created during this session's dLocal retry and
  was deleted by Davin before 4A-10c (independently re-verified gone). Secrets exposed mid-session
  (`CRON_SECRET`/`DATABASE_URL`/`NEXTAUTH_SECRET`/`REDIS_URL`/4 dLocal vars, via
  `railway variable list`'s unmasked default view) still need rotation. See Current above and the
  order's own Deviations (17 entries) for full detail.
- **Order status (4A-11):** CONFIRMED, executed, fully closed — all Done-when items checked except
  one explicitly-outstanding item (`SVC_TOKEN` set to a real matching value on both services'
  Railway production — a live secrets action reserved for Davin, not the Executor). All 5 files
  shipped: subscription email templates ported to operation-service, `SvcTokenGuard` built
  (activates F31), the outbox-event consumer module built (`POST /outbox/events`), money-service's
  `OutboxPublisherCron` now sends the `SVC_TOKEN` Bearer header, both `.env.example` files
  documented. `operation-service` 11/11 suites/86/86 tests; `money-service` 59/59 suites/507/507
  tests; `tsc --noEmit`/`nest build` clean both services. Zero traffic cut over —
  `OUTBOX_PUBLISHER_ENABLED`/`OUTBOX_PUBLISHER_TARGET_URL` confirmed still absent on money-service
  production at close. New `DECISION-LOG.md` **F50** (OPEN) — `COMMISSION_CREDITED`'s recipient is
  unresolvable with the current payload/schema, deliberately skipped rather than sent to the wrong
  person; needs its own follow-up before 4A-12 can call that specific eventType done (the other 5
  eventTypes are unaffected and fully wired). See Current above for full detail.
- **Order status (4A-10c, ad-hoc):** F48 (`DECISION-LOG.md`, the dLocal outbound signing bug this
  order status block previously pointed to) is now RESOLVED — fixed for real and verified live
  (see Current above). Group B (dLocal) is still NOT cut over: fixing F48 uncovered a second,
  previously-masked bug, **F49** (`payment_method_flow` missing from the outbound request body,
  pre-existing on both monolith and money-service). `MIGRATE_WRITE_APIS_MONEY_DLOCAL` stays
  `false`, reverted and redeployed clean. A 4th orphaned `Payment` row
  (`cms7hlmb900000fmpz9i9fv1q`) needs Davin's cleanup, same as the prior three. No migration-order
  file was drafted for this session (ad-hoc); the next dLocal attempt needs its own scoped fix
  session against F49.
- **Order status (4A-10a):** CONFIRMED, executed, fully closed — all 4 "Done when" items checked.
  All 5 monolith write routes wired with `MIGRATE_WRITE_APIS_MONEY_*` flag checks + forwarding to
  their already-full-PORT money-service controllers (4A-9); new
  `lib/money-service/write-routes.ts` transport helper + 4 new flag readers in `flags.ts`. All 4
  flags default `false` — zero traffic cut over. Monolith `test:ci` 121/121 suites, 2133/2133
  tests; `tsc --noEmit`/`eslint` clean; `money-service` untouched. See Current above for full
  detail, including the two safe `POST()` signature widenings recorded as Deviations.
- **Order status (4A-9):** CONFIRMED, executed, fully closed — all 4 "Done when" items checked.
  All 10 files/10 steps shipped in `money-service`: Stripe checkout/subscription/webhook
  controllers + services (new `stripe.module.ts`), dLocal payment-creation controller (+ its 2
  previously-omitted service dependencies), admin code distribution (added to the already-live
  `AdminAffiliatesController`), disbursement batch-execution controller (new
  `disbursement.module.ts`). Zero traffic cut over — no flags flipped, no URLs/dashboards
  changed. `money-service` 59/59 suites, 506/506 tests; `nest build` clean; monolith untouched.
  See Current above for the full list of gaps found and corrected mid-session (missing
  webhook-handlers.ts SOURCE, two missing dLocal service dependencies, a schema-subset gap, a
  Stripe SDK version mismatch).
- **Order status (4A-8):** CONFIRMED, executed, fully closed — all 4 "Done when" items checked.
  Idempotency hardened on the 3 real live monolith write paths (Stripe checkout, dLocal create,
  admin code distribution); reusable `IdempotencyInterceptor` built in money-service, unattached,
  ready for 4A-9. F14 RESOLVED: `OutboxEvent` live in production with verified `money_svc` grants,
  `OutboxService` wired into both tier-write call sites, `OutboxPublisherCron` built but gated OFF
  (real consumer is Slice 5 / 4A-11-12, not built). CC-D gap fixed on RiseWorks's webhook
  throttle. `money-service` 49/49 suites, 400/400 tests; monolith `tsc --noEmit` clean. See
  Current above for full detail.
- **Order status (4A-W7):** production cutover executed, not yet fully closed — `DISBURSEMENT_PROVIDER
=WISE` live and DI-verified, all 3 production webhooks subscribed and signature-verified against
  Wise's real key, single-affiliate THB smoke payout drafted with funding in progress. Real
  production crash found and fixed ahead of the cutover (unrelated BullMQ queue-name bug, live
  since 4A-W5). Three of Davin's "confirmed" entry-criteria claims initially didn't hold against
  live state, then were genuinely fixed and re-verified. F47 (new, OPEN) found live — a real
  currency-unit bug in the Wise quote logic, first surfaced by this session's own THB payout being
  the first non-USD case ever run through it. See Current above for full detail.
- **Order status (4A-W6, historical):** payout engine (`isFundable` branch) built and verified clean — all 8
  files shipped plus 3 extra test files (11 total), `money-service` 44/44 suites, 367/367 tests
  (was 33/33, 326/326 at 4A-W5's close). Monolith `tsc --noEmit` clean. F43 RESOLVED (Resend REST
  direct). Five order-text-vs-ground-truth mismatches found and corrected (SLA default,
  `FundableProvider` shape, quote direction, endpoint count, file locations — see Current above,
  `LESSONS-LEARNED.md` L27 recurrence). New **L28**: two core files had no test suite at all before
  this session, contrary to what Hard Invariant #4 assumed — built both. Real
  `MockPaymentProvider` transactionId bug found, deliberately not fixed (out of scope, possibly
  load-bearing). **Critical carry-forward finding (Waiting-on #54): 4A-W7's own literal cutover
  step ("flip `DISBURSEMENT_PROVIDER=MOCK → WISE`") would currently be a silent no-op** —
  `provider-factory.ts`/`disbursement.constants.ts` were deliberately not touched this session
  (real DI-construction surgery, not additive), so `getDefaultProvider()` still can't return
  `'WISE'`. 4A-W7's own PRE-DRAFT carries a new Entry criterion 0 blocking on this. Standing note
  unchanged: `DISBURSEMENT_PROVIDER` stays `MOCK` in production — this session built the payout
  engine only, no provider flip, no money moved.
- **Order status (4A-W5, historical):** webhook receiver + state reducer built and verified clean — all 8
  files shipped plus 2 extra test files (10 total), `money-service` 33/33 suites, 326/326 tests
  (was 29/29, 288/288 at 4A-W4's close). Monolith `tsc --noEmit` clean (unaffected). F40
  RESOLVED (`PROFILE`-level). Four order-text-vs-ground-truth mismatches found and corrected
  (throttle, state table, `CommissionStatus` enum, `WiseBatchGroup` field name — see Current
  above, `LESSONS-LEARNED.md` L27). Verification method downgraded from real-Wise-Simulation-API
  capture to hand-constructed RSA-signed test payloads (Davin's Option 2 — sandbox funding
  availability unknown, same root cause as Waiting-on #47). Standing note unchanged:
  `DISBURSEMENT_PROVIDER` stays `MOCK` in production — this session built the webhook receiver
  only, no provider flip, no money moved, no production Wise webhook subscription.
- **Order status (4A-W4, historical):** CC-C/CC-D hardening gate closed clean — idempotency audit (6
  endpoints, no "TBD" verdicts) and webhook-dedupe audit (dLocal/Stripe/RiseWorks, real gap
  found in Plan §13's own template) both committed to the order's Deviations; both live defects
  fixed and verified (`enableShutdownHooks()` + a real end-to-end shutdown test;
  `@Throttle()` on the dLocal webhook + a real-guard burst test); BullMQ job-ID policy
  documented for 4A-W5; F43 registered OPEN. `money-service` 29/29 suites, 288/288 tests;
  monolith `tsc --noEmit` clean. Standing note unchanged: `DISBURSEMENT_PROVIDER` stays `MOCK`
  in production — this session hardened shared infrastructure only, no provider flip, no money
  moved.
- **Order status (4A-W3b, historical):** frontend surface built and verified clean — all 5 files shipped
  (server-side proxy layer, dynamic recipient form + affiliate payout page, admin read-only
  list page, 23 new tests, artefact updates). `tsc --noEmit` clean throughout; monolith
  `test:ci` 119/119 suites (2105/2105 tests). Ships flag-less (Davin, live). Real
  auth-semantics mismatch found and resolved mid-build (revalidate moved from the admin page
  to the affiliate's own payout page — see Current above and `DECISION-LOG.md`). Standing
  note unchanged: `DISBURSEMENT_PROVIDER` stays `MOCK` in production — this session shipped
  UI only, no provider flip, no money moved.
- **Order status (4A-W3a, historical):** backend module built and deployed clean — 8 of 10 files' worth
  of scope shipped (Files 1-8 built; File 9 deferred by Davin, File 10's full write-path E2E
  blocked by token scope, both carried forward). 27/27 money-service test suites green
  (285/285 tests), monolith `test:ci` re-verified 117/117 (2082/2082) via the pre-push hook.
  Live-verified in production: all 6 `/v1/wise/recipients/*` routes registered, unauthenticated
  requests → 401, `GET requirements` → real `200` with live Wise sandbox data. F39/F41
  RESOLVED. Standing note unchanged: `DISBURSEMENT_PROVIDER` stays `MOCK` in production —
  this session created recipient endpoints but did not flip the active provider or move any
  money; the one write-path call attempted (a test recipient creation) 403'd on token scope,
  never reached Wise as a successful write.
- **Order status (4A-W2, historical):** additive migration applied to production clean — 5 new tables +
  `WISE` enum value confirmed live via direct query, pre-existing table row counts unchanged,
  `money_svc` grant gap found and fixed (Davin-approved), money-service schema mirrored and
  builds clean, F38 RESOLVED (Option A — platform bears fee), full test suites green both
  sides. Standing note unchanged: `DISBURSEMENT_PROVIDER` stays `MOCK` in production until
  `4A-W7` cuts over — **no real affiliate payout goes out through money-service before then;
  any order that would create a real payment batch before 4A-W7 is out of order, stop and ask
  Davin.**
- **Order status (4A-W1, historical):** all-green — no code written, no schema changed, no money
  touched, `git diff --stat` shows documentation/order-file changes only. F36/F37 RESOLVED,
  F38–F41 registered OPEN (F38 now RESOLVED at 4A-W2, see above), F42 RESOLVED, Business Payment
  Approval confirmed absent, `WISE_PROFILE_ID` (sandbox business) captured, OpenAPI + state
  table frozen.
- **Order status (4A-7b, historical):** CUT-OVER — both `MIGRATE_READ_APIS_MONEY_AFFILIATE` and
  `MIGRATE_READ_APIS_MONEY_ADMIN` are `true` in Vercel production, redeployed and
  smoke-tested clean (see the 4A-7b historical block below for the CONFIRM-time gap
  found/fixed and the monitoring caveat carried to Waiting-on #40). CC-F freeze on the
  monolith's own affiliate/admin route + `lib/` logic stays until a future RETIRE session.
- **Order status (4A-7a, historical):** BUILT, zero traffic cut over — flags default
  OFF in every environment at the time. **What shipped:** transport module
  (`lib/money-service/client.ts`, `routes.ts`, `flags.ts`), flag wiring into all 12
  existing Slice-3 route handlers, F44/F45 resolved and logged, end-to-end
  proxy+auth-bridge proof. Superseded by 4A-7b's cutover above.
- **Prior order (4A-5, historical):** dLocal CUT-OVER, all-green (monitoring caveat
  above). RiseWorks portion not started. **What shipped (dLocal only):**
  - Two live-escalated bugfixes (full detail in Current above): dLocal webhook
    signature verification (`8e681297`) and a replay-guard on webhook completion side
    effects (`1cc31b24`). Both documented as Deviations in the order itself, both
    tested (34/34 then full-suite 260/260 pass, `tsc --noEmit` clean).
  - dLocal's provider-dashboard webhook URL repointed to money-service's
    `/v1/webhooks/dlocal` endpoint — the cutover moment itself, per this order's own
    framing (no code flag, no redeploy).
  - RiseWorks's route stays deployed-but-silent exactly as 4A-4 left it — untouched,
    unweakened, zero live traffic, dashboard still pointed at the monolith.
- **Last session did:** Session 5-4 ("Fonts, Streaming & Phase 5 Exit Review",
  `next@16.2.10`) — closed 2026-07-23. Phase 5 (Next.js 16 Optimization) fully closed &
  verified (F10 RESOLVED): Google `Inter` font loader with system-font fallbacks,
  React 19 `<Suspense>` streaming boundaries verified across dynamic routes,
  `vercel.json`/`next.config.js` deployment rules validated. Full exit suite green:
  `type-check` 0 errors, `validate:lint` 0 errors, `build` 127/127 routes (29.82 MB
  bundle vs <340MB ceiling), `test:ci` 117/117 suites, 2082/2082 tests. Live Vercel
  production deployment verified (commit `be62d87f`).
- **Waiting on:** all Session 4A-4 items unchanged except where noted below (renumbered
  continuation). (1)-(6), (11)-(12), (17)-(20), (23), (27)-(29) unchanged — see prior
  closes for full text. **(26, PARTIALLY RESOLVED Session 4A-5)** `DLOCAL_WEBHOOK_SECRET`
  now confirmed set on Railway production (this session) — `RISE_WEBHOOK_SECRET` still
  not set, moves to `4A-5-RW`'s own entry criteria; Stripe/Resend secrets status
  unchanged/unverified this session. **(31, RESOLVED Session 4A-5)** Session 4A-5's real
  signed-payload replay requirement — done: real dLocal webhook traffic verified against
  the fixed signature-verification code, correct `Payment`/`Subscription` writes,
  second replay confirmed idempotent (Davin, live). **(37, CLOSED BY REVOCATION, Session
  4A-W1)** `4A-5-RW` (RiseWorks webhook cutover) is now **REVOKED**, not merely still
  PRE-DRAFT — RiseWorks is being replaced by Wise (Part 19.5, F42 RESOLVED), so its blocking
  entry criterion (RiseWorks replying with webhook/API settings) is moot. Closed by
  revocation, not resolution — no reply from RiseWorks was ever received or needed.
  **(38, still OPEN, audited Session 4A-7a —
  narrowed and corrected)** dLocal's cutover flipped the dashboard URL, but the
  completion/replay-guard execution path against a live database record has still never
  been exercised by a real HTTP request in production. 4A-7a walked every Railway
  deployment from the signature fix (`8e681297`, live 2026-07-24 11:58 UTC) through the
  current deployment (HTTP edge logs + app stdout logs): the only two deliveries logged
  anywhere are `shadow-run-cash`-labeled synthetic payloads (12:02/12:23 UTC on
  deployment `ea69c732`) that both hit `Payment record not found for webhook`
  (zero DB writes) and both predate the replay-guard fix (`1cc31b24`, live 13:48 UTC) —
  every deployment since shows zero webhook activity of any kind. This corrects the
  "confirmed live by Davin — correct Payment/Subscription DB writes, second replay
  idempotent" language recorded under Session 4A-5 above and in
  `migration-cutover-table.md`'s Slice 2 row: **Davin's live clarification (4A-7a,
  2026-07-25) is that no such verification against a live DB record has actually
  happened yet — only unit/integration-tested during development.** Per Davin's call
  this is non-blocking for 4A-7a (BUILD-only, zero traffic cut over) and carries forward;
  it remains a real open item before dLocal Slice 2 can be called fully stable — spot-check
  `railway logs` on the next real (or deliberately-run realistic synthetic) dLocal
  payment. **(39, NEW)** `npm run validate`'s `validate:format` step (`prettier --check
.`) fails on 287 files repo-wide — traced this session to `core.autocrlf=true` on this
  Windows checkout (files carry CRLF line terminators, prettier's default expects LF),
  not a content/style regression. Davin's live ruling let 4A-7a proceed on
  `tsc --noEmit` + `eslint --max-warnings 0` alone, but the underlying gap (no
  `.gitattributes` line-ending normalization, `validate:format`/`validate:policies`
  effectively unenforceable on Windows) is still there — worth a future session's
  attention (likely a `.gitattributes` fix + one-time `prettier --write` pass on a
  dedicated branch, not a drive-by inside a feature session) before relying on
  `validate:format` again. **(30, unresolved, now 3
  sessions running)** `LESSONS-LEARNED.md` still at 40 active lessons (L1-L40) — AT the
  stated cap; this session found 2 more genuinely new lessons (recorded in the 4A-6
  order's own Deviations + LESSONS-LEARNED.md's header note instead of as new numbered
  entries, per the file's own "pause before adding another" instruction) without a
  consolidation pass happening. Flagged in Sessions 4A-2, 4A-4, and now 4A-6 — this is
  no longer a one-off, it needs the Advisor's attention before the next order that
  touches this file. **RESOLVED same-day by Davin**: the Advisor ran the consolidation
  pass 2026-07-22 — old lessons moved to `LESSONS-ARCHIVE.md`, active file is now clean
  (L1-L10), and L1 codifies item #32 below. **(32, CORRECTED — was wrongly framed as
  CRITICAL/actionable by this session, corrected same-day by Davin):** money-service does
  **NOT** have its own database — per blueprint §5.1 ("Phase 1: one instance, two
  roles/schemas"), it shares the MONOLITH's single Postgres instance via the `money_svc`
  role (L36) and only ever defines a schema SUBSET. Sessions 4A-2/4A-4/4A-6 running only
  `prisma generate` (never `db push`/`migrate deploy`) from money-service was therefore
  the CORRECT and ONLY safe behavior, not a gap — running either from money-service would
  risk dropping the monolith's own tables that aren't in money-service's subset. The
  monolith remains the sole owner of all schema migrations; money-service's schema.prisma
  subset just needs to keep matching whatever the monolith's migration history already
  established. New `LESSONS-LEARNED.md` L1 (Session 4A-6, Advisor review) makes this a
  hard rule — read it before ever considering a Prisma migration command from
  money-service again. **(33, RESOLVED same-day by Davin — chain-length-one invoked)**
  Session 4A-6's own predecessor order arrived APPROVED with an internally contradicted,
  untracked, no-git-history file while Session 4A-5 was still unresolved at DRAFT, so two
  cutover orders (4A-5, 4A-7) ended up pending simultaneously. Davin's ruling: invoke
  "chain-length-one" — **stop all BUILD work**; Davin is manually running 4A-5's
  shadow-run verification himself and webhooks (Slice 2) will cut over FIRST, before
  anything else (including 4A-7) proceeds. No further Slice 3/4 work until Davin says so.
  **(34, RESOLVED same-day by Davin)** 4A-7's browser-auth design question: blueprint
  §4.2 — "No cookie sharing across domains — the frontend sends `Authorization: Bearer`."
  The Next.js frontend will manually extract its JWT and attach it as a Bearer header
  when calling money-service's Read APIs. `JwtAuthGuard`/`AdminGuard`/`AffiliateGuard`
  (already built, Session 4A-6) need no changes — confirmed correct as-is by Davin. 4A-7's
  order updated to reflect this; still blocked on chain-length-one (#33) regardless.
  **(35, NEW)**
  `migration-stack-analysis.md`'s money-service section was never updated after Session
  4A-1 — Sessions 4A-2 and 4A-4's new files (crons/dlocal/riseworks/disbursement/
  affiliate-support modules) were never recorded there, a standing gap this session
  found and flagged but did not backfill (out of scope, full regen is an 8.6-only task
  per `00-SKELETON-AND-RULES.md` §5) — only this session's own additions were appended.
  **(29, RESOLVED Session 4A-3)** money-service's own unfinished manual-trigger
  verification step (4A-2's blocker for the crons cutover) — completed and confirmed
  live with Davin this session, all 8 jobs idempotent. **(36, RESOLVED Session 4A-7a)**
  Session 4A-3's cutover landed; this item tracked the scheduler's own natural tick
  (not the manual-trigger bypass) under the new live regime. Confirmed clean at 4A-7a
  CONFIRM: Railway deployment `b401bc62` ran continuously 2026-07-22 10:12 UTC →
  2026-07-24 05:34 UTC, spanning the natural 2026-07-23 UTC 00:00–04:00 window. All five
  hourly `[CRON]` ticks fired and completed with `errorCount: 0`, zero duplicate
  `PaymentBatch`/`DisbursementTransaction` rows. Slice 1 is fully stable. **(40, NEW)**
  Slice 3's read-API cutover (4A-7b, 2026-07-26) is live in production for both flag
  groups, but no real authenticated request has yet been directly observed reaching
  money-service through either group — this session's verification was build health,
  unauthenticated-guard smoke tests, and absence-of-errors in logs, not a live
  authenticated round trip (minting a production auth token was judged out of this
  VERIFY-RETIRE session's scope — touches secrets/auth semantics beyond the order's
  explicit steps). Same open-monitoring-caveat class as #36 (resolved) and #38 (still
  open) — spot-check Railway money-service logs + Vercel function logs the next time a
  real affiliate or admin actually loads their dashboard, before calling Slice 3 fully
  stable. **(41, NEW)** Part 19.5 (Wise) replaces RiseWorks as the disbursement provider —
  `docs/migration-orders/replace-rise-with-wise/` is the governing docset (`00`–`07` + the
  OpenAPI spec). Sessions `4A-W1…4A-W8` are inserted between 4A-7 and 4A-8 (Davin,
  2026-07-25); `4A-W1` executed 2026-07-26. **(42, NEW — commercial, shapes everything
  downstream)** The Wise business account is registered in **Thailand**, not on Wise's
  API-funding allowlist (US, CA, AU, NZ, SG, MY) for personal API tokens, and F36 resolved to
  **Model A** (personal token, not a Platform partnership) — so **every payout cycle needs
  one manual funding action by Davin in the Wise app**, indefinitely, unless F36 is revisited.
  The architecture handles this (funding is a batch _state_, not a method call) and a
  funding-SLA alarm (F43, registered at 4A-W4) prevents silent stalls. **(43, NEW)**
  `WISE_API_TOKEN` is a money-moving secret. Plan: **read-only** token for 4A-W1/W3/W5,
  promoted to **full access** only at 4A-W6. Verify presence **value-blind** — never
  `railway variables --kv` (L17). This session's own sandbox `GET /v1/profiles` call was run
  by Davin outside this chat; only the response body (profile IDs `29617747`
  personal/`29617748` business, types) was shared back — no token value entered this
  transcript. **(44, NEW)** THB cannot be exercised end-to-end in Wise's sandbox (UK-region,
  stable only for GBP/USD/EUR) — recorded in `4a-w1-…`'s Deviations, unchanged at 4A-W2 (no
  Wise API calls happen in a schema-only session). Consequence unchanged: `4A-W3` must fetch
  the real THB account-requirements schema from **production** (read-only, no money); `4A-W6`'s
  E2E runs on a sandbox-supported currency pair; `4A-W7`'s single smoke payout is the first
  real proof of the THB route. **(45, NEW)** `4a-w2-…`'s own order text contained two
  inaccuracies caught during execution, neither blocking: Step 7 cited
  `report-builder.service.ts`/`admin-affiliate-reports.controller.ts` as needing a
  null-tolerance re-check, but neither file references `amountRiseUnits`/`payeeRiseId` at all
  (checked) — design §3.5(b), the order's own cited source, actually names 5 different files,
  which were the ones actually re-audited. Step 9 said money-service has its own `lint` script;
  it doesn't (`npm run` lists `build`/`start*`/`test*`/`prisma:generate` only, no ESLint config
  exists in that package). Worth the Advisor's attention on how order text drifts from its own
  cited sources between drafting and execution — same general shape as L11 (self-contradicting
  order metadata), but on body content rather than the header status field.
  **(46, NEW)** THB production account-requirements fixture (File 9 of `4a-w3a-…`) still not
  fetched — the configured `WISE_API_TOKEN` confirmed sandbox-only (live `401 invalid_token`
  against `api.wise.com`), Davin deferred rather than provide a production-scoped token this
  session. Needed before `4A-W3a` can be called fully done; not currently blocking `4A-W3b`
  (UI work doesn't need the fixture) or `4A-W4`.
  **(47, NEW — revisits #43's own plan assumption)** The full sandbox GBP recipient-creation
  E2E proof (`4a-w3a-…`'s own Done-when item) is **not achieved** — confirmed live,
  `POST /v1/accounts` 403s "unauthorized" with the current read-only-scoped token, isolated via
  a direct call to Wise sandbox (not a code bug). **#43's plan ("read-only token sufficient for
  4A-W1/W3/W5") assumed recipient creation doesn't need write scope — this session found that
  assumption is wrong**: Wise's own permission model treats `POST /v1/accounts` as a write
  operation, distinct from reads (`GET /v1/profiles`, `GET /v1/account-requirements` both
  worked fine with the same token). Worth the Advisor rechecking whether `4A-W5` (webhook
  receiver — receive-only, likely still fine) is affected by the same assumption before it
  runs. Needs a write-scoped (still sandbox, zero real money) `WISE_API_TOKEN` to close.
  **(48, NEW)** `refreshRequirementsOnChange` (quote-scoped field-refresh) is built and unit
  tested but not proven against a real live quote — this session's `GET requirements` uses
  the discouraged non-quote-scoped Wise fallback (fixed this session, `f100296a`, now
  confirmed working live) specifically to avoid building quote-creation
  (`POST /v3/profiles/{id}/quotes`), which isn't in `4a-w3a-…`'s own 10-file scope. A future
  session (likely `4A-W3b` if the form needs live field-refresh, or `4A-W6`) needs to either
  build quote creation or confirm the non-quote-scoped path is good enough long-term.
  **(49, NEW — needs a decision)** `part19.5-wise-disbursement-openapi.yaml`'s `POST
/wise/recipients` description says replacing an existing recipient should archive the old
  row, not mutate it — `AffiliateWiseRecipient.affiliateProfileId` is `@unique` in the schema
  frozen at 4A-W2, so `4a-w3a-…`'s `createRecipient` upserts in place instead (schema change
  is out of scope for a PORT session). Needs Davin/Advisor to pick one: accept upsert
  semantics and fix the OpenAPI text, or schema-change to support archive-and-recreate.
  **(51, NEW)** `GET /v1/wise/recipients` (admin list)'s live response has no affiliate-name
  field at all — `wise-recipients.controller.ts`'s `list()` returns raw `AffiliateWiseRecipient`
  rows (not `toSummaryDto()`-mapped), and neither shape carries a joined affiliate display name.
  `4a-w3b-…`'s admin page renders `accountHolderName` (the bank recipient's own name) plus a
  truncated `affiliateProfileId` instead — not a security issue (no raw bank details either
  way, F41), just a UX gap. A future session could add a small enrichment join (money-service
  or the monolith's own Prisma) if admins need to search/identify by affiliate name specifically.
  **(50, NEW)** `railway up` CLI is unreliable for `money-service` from this checkout — 413
  payload-too-large without `--path-as-root` (can't resolve `.gitignore` from the
  subdirectory), "Failed to read app source directory" with it (likely a Root Directory
  dashboard-setting mismatch, not inspectable via this CLI version). Working path found and
  used this session: `git push origin main` (money-service has a connected GitHub source,
  auto-deploys cleanly). New `LESSONS-LEARNED.md` L23. Worth Davin checking the Railway
  dashboard's Root Directory setting for `money-service` directly if `railway up` is ever
  needed again (e.g. for a deploy that shouldn't go through a git push).
  **(52, NEW)** 4A-W4's idempotency audit (Step 1) found no idempotency key at all on 3
  customer/admin-facing money write endpoints: Stripe checkout session creation
  (`app/api/checkout/route.ts`), dLocal payment creation
  (`app/api/payments/dlocal/create/route.ts`), and admin code distribution
  (`app/api/admin/affiliates/[id]/distribute-codes/route.ts`) — a double form-submit or retry on
  any of these creates a duplicate row/session/code batch (full detail and exact line citations
  in `4a-w4-…`'s Deviations). Explicitly out of scope to fix this session (stays 4A-8's job per
  this order's own scope rule) — flagging so 4A-8 has the full list rather than re-discovering
  it. Separately, the same audit found Plan §13's own dedupe template
  (`RiseWorksWebhookEvent`) carries no unique constraint on its `hash`/`signature` fields — only
  `WiseWebhookEvent.deliveryId` does — so 4A-W5 should build the new Wise webhook receiver on
  `WiseWebhookEvent`'s pattern, not RiseWorks's (already reflected in
  `01-...architecture-design.md` §8.0 and `4a-w5-…`'s own PRE-DRAFT, this session's close).
  **(47, updated Session 4A-W5)** The write-scoped-sandbox-token gap now also blocks 4A-W5's own
  verification depth, not just 4A-W3a's recipient-creation E2E: Wise's Simulation API requires a
  **funded** transfer before state simulation, and a funded transfer needs a recipient
  (`POST /v1/accounts`, still 403-blocked on the read-only token per this item). 4A-W5 worked
  around this with hand-constructed RSA-signed test payloads (Davin's Option 2) rather than
  real Wise sandbox captures — genuinely proves the signature/dedupe/reduction code paths, but
  not that Wise's real Simulation API produces byte-identical payloads. Still needs a
  write-scoped (sandbox, zero real money) `WISE_API_TOKEN` to close for good. **(53, NEW)**
  4A-W5's own order text disagreed with its own cited ground truth in FOUR separate places
  within a single order (throttle decorator, state-mapping table completeness, a
  non-existent `CommissionStatus` enum value, a non-existent `WiseBatchGroup` field name) — a
  more severe recurrence of the class #45 first flagged (order text drifting from its own cited
  sources between drafting and execution). All four were caught by re-reading the actual design
  doc sections and Prisma schema before writing code, not by the order's own CONFIRM checklist.
  Recorded as `LESSONS-LEARNED.md` **L27**. Worth the Advisor's attention on whether order
  drafting should diff against the cited ground truth sections automatically, since this is now
  a repeat-offender pattern rather than a one-off. **(54, NEW — CRITICAL, blocks 4A-W7)**
  `DISBURSEMENT_PROVIDER=WISE` is not actually constructible yet. Verified live at 4A-W6's close:
  `money-service/src/disbursement/providers/provider-factory.ts` has no `case 'WISE'` (only
  `'MOCK'`, and a `throw` for `'RISE'`); `disbursement.constants.ts`'s `SUPPORTED_PROVIDERS` and
  `getDefaultProvider()` don't recognize `'WISE'` at all, so `getDefaultProvider()` would silently
  keep returning `'MOCK'` even with the env var set to `'WISE'`. Design §8.1's own file-inventory
  table names these two files (plus `disbursement.types.ts`) as needing a `'WISE'` entry; none is
  in 4A-W6's own 8-file order, and none was touched this session — wiring it properly needs real
  DI-construction surgery (`WisePaymentProvider` has 7 injected collaborators a bare `new` can't
  resolve), not an additive fix. Combined with item below, this means 4A-W7's own literal cutover
  checklist ("flip `DISBURSEMENT_PROVIDER=MOCK → WISE`, redeploy, smoke payout") would currently
  do nothing observable — no error, batch still reports green, zero real money moves. 4A-W7's own
  PRE-DRAFT carries this as a new, hard-blocking Entry criterion 0. **(55, NEW)** A genuine
  pre-existing bug, found (not fixed) while building 4A-W6's first-ever real test of the
  Mock-provider code path: `MockPaymentProvider.sendPayment()` mints its own random
  `transactionId` instead of echoing back the caller's `PaymentRequest.metadata.transactionId`, so
  `payment-orchestrator.service.ts`'s existing (unmodified) result-matching
  (`pendingTransactions.find(t => t.transactionId === paymentResult.transactionId)`) can never
  succeed for `MOCK` — every "successful" Mock payment is silently skipped (logged via
  `console.error`, not thrown), yet the batch still reports `success: true` and gets marked
  `COMPLETED`. Since `DISBURSEMENT_PROVIDER` stays `MOCK` in production throughout Part 19.5
  specifically as a no-real-money safety rail, this may be accidentally desirable behavior (a
  "fixed" matcher would start marking commissions `PAID` in production under a provider that sends
  nothing) — needs a deliberate Davin/Advisor decision, not a drive-by fix inside an unrelated
  session. Full detail on both in `4a-w6-…`'s own Deviations. **(56, NEW)** Added at session
  close, at Davin's explicit request: a bounce-path (unhappy) sandbox E2E test
  (`outgoing_payment_sent → bounced_back → funds_refunded`, revert exactly once, replay-safe) —
  design §10's own testing strategy named this scenario for W6 but neither this order's File 8
  test list nor its Done-when did (another L27-class gap). Writing it surfaced a real, unbuilt
  gap: design §10 also expects the recipient to move to `INVALID` on this path, but no code
  anywhere (`wise-transfer-state.reducer.ts`, `wise-event-handlers.ts`) ever touches
  `AffiliateWiseRecipient.status` on any transfer event — never built in 4A-W5 or 4A-W6. Needs a
  deliberate decision (auto-invalidate after 1 failure vs. N vs. admin-alert-only) before building
  it; not decided here. **(57, NEW)** Slice 4 overlap (design §14 point 6, its own instruction:
  "flag this in the handoff, not at merge time") — Sessions 4A-9/10 will move
  `app/api/disbursement/batches/[batchId]/execute` to money-service, the SAME code path 4A-W6's
  `isFundable` branch changed the behavior of (`payment-orchestrator.service.ts`'s `executeBatch`).
  Whichever of {4A-W7, 4A-9/10} runs second must re-read the other's Deviations first.
  **(58, NEW)** 4A-W7's smoke payout funding is in progress (Davin wiring $50 USD, reference
  `B2812234`) but not yet confirmed landed as of this session's close — `Commission.status` is
  still `APPROVED`, not `PAID`. Spot-check for the real `transfers#state-change` webhook landing
  (via `WiseWebhookEvent`, not log absence — the success path is silent by design) and confirm
  `Commission=PAID`/balance moved exactly once before treating 4A-W7 as fully closed or starting
  4A-W8. **(59, NEW)** `DECISION-LOG.md` **F47** (distinct from this list's own old item #47, which
  was a different, already-resolved sandbox-token gap — always cite `DECISION-LOG.md F47`
  explicitly to avoid confusion) — a real currency-unit bug in `wise-quote.service.ts`, found live
  during 4A-W7's own THB smoke payout: the USD commission amount is passed straight through as
  `targetAmount` in the recipient's local currency. First surfaced because this was the first-ever
  non-USD case run through this code. Not blocking 4A-W8 (RiseWorks archival), but must not be
  lost — needs its own dedicated PORT session before any further non-USD Wise payout.
  **(61, NEW — CRITICAL, blocks 4A-10)** 4A-10's PRE-DRAFT (Slice 4 cutover) was finalized this
  session and found to have a hard-blocking gap: **none of the 5 monolith write routes
  (`app/api/checkout/route.ts`, `app/api/payments/dlocal/create/route.ts`,
  `app/api/subscription/cancel/route.ts`,
  `app/api/admin/affiliates/[id]/distribute-codes/route.ts`,
  `app/api/disbursement/batches/[batchId]/execute/route.ts`) contain any flag check or
  forwarding call to money-service** — `lib/money-service/routes.ts`/`flags.ts` (built 4A-7a) only
  cover Slice 3's read APIs plus some Wise-track wrappers; a repo-wide grep for
  `MIGRATE_WRITE_APIS_MONEY` returns zero matches anywhere in code. Flipping any of the 4
  `MIGRATE_WRITE_APIS_MONEY_*` flags in Railway right now would do nothing — the monolith routes
  would keep running their existing Prisma logic 100% of the time regardless of flag state. Same
  failure shape as 4A-W6/W7's own Waiting-on #54 (`DISBURSEMENT_PROVIDER=WISE` not actually
  constructible). **4A-10 cannot execute until a new BUILD session ships the monolith-side
  transport + flag-check layer for these 5 routes** (mirroring 4A-7a's own Slice-3 scope) —
  recorded as 4A-10's own new Entry Criterion 0, hard-blocking.
  **RESOLVED (Session 4A-10a, 2026-07-27):** the transport + flag-check layer shipped and was
  CONFIRMED — see Current above and item #63 below. 4A-10 (now 4A-10b)'s Entry Criterion 0 no
  longer applies to a fresh CONFIRM of that order; its own remaining entry criteria (soak window,
  smoke tests, Davin approval) are unaffected and still gate its execution.
  **(62, NEW)** Slice 4's 48h clock: a **code-freeze SOAK window** (not a mirror-run/shadow-diff —
  see #61, no traffic mechanism exists to reach money-service's new controllers at all) —
  **Started:** 2026-07-27 12:52 UTC · **Ends:** 2026-07-29 12:52 UTC. **What holds during it:** the
  5 monolith write routes stay CC-F frozen (bugfixes only, mirrored to both implementations) and
  keep serving 100% of real Stripe/dLocal/admin/disbursement traffic exactly as before this whole
  migration — nothing about production behavior changes during this window. **What to watch:** (a)
  no incident on the monolith's live write paths (the only real traffic surface right now); (b)
  `money-service`'s full test suite (59/59 suites, 506/506 tests) + `nest build` stay green if
  anything in its dependency tree changes before 4A-10's own CONFIRM. **What ends the wait early:**
  a real incident on the monolith's live write paths (would indicate a pre-existing production
  issue needing its own response, since they're frozen), or the money-service test suite/build
  breaking. An HTTP 500 or DB-transaction failure specifically _on money-service's new write
  controllers_ cannot happen during this window and so cannot end it early — they receive zero
  traffic until 4A-10 actually flips a flag, which itself can't happen yet (see #61).
  **(60, NEW)** `money-service`'s `OutboxPublisherCron` (built 4A-8, F14) is gated OFF
  (`OUTBOX_PUBLISHER_ENABLED` unset) and has no real delivery target configured
  (`OUTBOX_PUBLISHER_TARGET_URL` unset) — by design, since operation-service has no tier/billing
  receiving endpoint yet. Whichever session builds Slice 5 (4A-11/12) needs to: (a) build that
  endpoint on operation-service, (b) set `OUTBOX_PUBLISHER_TARGET_URL` to point at it, (c) flip
  `OUTBOX_PUBLISHER_ENABLED=true`, (d) verify the first real tier-update event actually flows
  end-to-end before trusting it. Until then, `OutboxEvent` rows accumulate in production
  (`status = PENDING`) every time a real dLocal payment completes or a subscription expires —
  harmless (no consumer expected yet) but worth a periodic row-count sanity check so it isn't
  silently forgotten. **(63, NEW)** Session 4A-10a (monolith write-transport BUILD) CONFIRMED and
  closed 2026-07-27, resolving #61 (see above) — all 5 monolith write routes now have
  `MIGRATE_WRITE_APIS_MONEY_*` flag-check + forwarding wiring to their money-service PORTs, all 4
  flags still default `false`, zero traffic cut over. `4a-10-money-service-write-apis-cutover.migration-order.md`
  (now 4A-10b) is the literal next session — still gated on its OWN remaining, unaffected entry
  criteria: the 48h code-freeze soak window (ends 2026-07-29 12:52 UTC — not yet elapsed as of
  4A-10a's close), staging/sandbox manual smoke tests per its own checklist (not yet run), and
  Davin's live per-group approval. Do not treat 4A-10a's close as authorization to flip any of the
  4 flags — that is 4A-10b's own, separate act. **PARTIALLY SUPERSEDED (Session 4A-10b,
  2026-07-28):** the soak-window and staging-test criteria were live re-scoped by Davin and 2 of
  4 groups were actually attempted — see #64 below for what that attempt found.
  **(64, NEW — blocks 4A-10b's own completion)** Session 4A-10b (2026-07-28) flipped
  `MIGRATE_WRITE_APIS_MONEY_STRIPE` and `_DLOCAL` true in production, one at a time, each with a
  real live authenticated test immediately after. Both failed on real `money-service` production
  configuration gaps, not on the 4A-9/4A-10a transport/auth/flag mechanism (proven correct
  end-to-end both times via live `money-service` logs): (a) Stripe — `StripeCheckoutController`
  was reached correctly but threw because `STRIPE_PRO_PRICE_ID` is absent from money-service's
  real Railway environment (present in `.env.example` and `docs/secret-matrix.md`'s
  monolith-side entry, never carried into money-service's own config when 4A-9 ported the Stripe
  module). (b) dLocal — `DlocalPaymentController` was reached correctly, progressed through
  exchange-rate lookup and `Payment` row creation, then dLocal's own API rejected money-service's
  configured credentials with a real `403 Invalid credentials` (code 3001) —
  `DLOCAL_API_KEY`/`DLOCAL_SECRET_KEY`/`DLOCAL_LOGIN` are present but at least one is wrong. Both
  flags reverted to `false` and redeployed, confirmed live. A real `Payment` row
  (`status: PENDING`, no completing dLocal payment) was left behind in production from the
  dLocal test and needs cleanup (delete or explicitly tag as a test artifact). Groups C (Admin)
  and D (Disbursement) were not attempted — Davin's live call was to pause rather than risk the
  same live-production exposure window twice more blind, given this was 2-for-2 on real config
  gaps rather than one-off bad luck. New `LESSONS-LEARNED.md` **L32** generalizes the root cause:
  a PORT session moves code that reads config, not the config itself — the next session must
  value-blind-verify every config value Groups C/D's own code reads is present (and ideally
  correct) on money-service's real Railway environment BEFORE attempting either flag, not
  discover gaps one flip at a time. **(65, NEW)** Two Windows-PowerShell-specific client-tooling
  gotchas cost real diagnostic time during 4A-10b's live testing, worth any future session's
  awareness: native `curl.exe` invoked from PowerShell mangles a JSON `-d` body regardless of
  single- or double-quote/backslash escaping attempted (switch to `Invoke-RestMethod`/
  `Invoke-WebRequest` with a PowerShell hashtable piped through `ConvertTo-Json` instead); and
  `Invoke-RestMethod`/`Invoke-WebRequest` in Windows PowerShell 5.1 silently drops a `Cookie`
  header passed via the generic `-Headers` parameter (.NET's `HttpWebRequest` treats `Cookie` as
  a "restricted header") — the fix is an explicit
  `Microsoft.PowerShell.Commands.WebRequestSession` object with a `System.Net.Cookie` added to
  its `.Cookies` collection, passed via `-WebSession` instead of `-Headers`. Also: Windows
  PowerShell 5.1's `Invoke-RestMethod` throws a bare `WebException` on any non-2xx response and
  hides the actual response body by default — retrieve it via
  `$\_.Exception.Response.GetResponseStream()`wrapped in a`System.IO.StreamReader`inside a
 `try`/`catch`, not from the exception message alone. **(66, NEW)** A second secret-exposure
  incident, same session-class as item tracked under `LESSONS-LEARNED.md`L17:`railway variable
  list --service money-service`(default table, NOT`--kv`) printed real values for
  `CRON_SECRET`/`DATABASE_URL`/`NEXTAUTH_SECRET`/`REDIS_URL`/4 dLocal secrets into the 4A-10b
  continuation session's transcript on 2026-07-30. Disclosed to Davin immediately; his call was to
  continue the cutover and rotate afterward. **Rotation has not happened yet** — Davin should
  rotate all 8 values on Railway (money-service) once convenient; no artifact reproduces any value,
  only key names. **(67, RESOLVED Session 4A-10c)** `DECISION-LOG.md`**F48** — was OPEN (dLocal
  Group B's repeated`403 Invalid credentials`, a real CODE bug, not config —
  `money-service/src/dlocal/dlocal-payment.service.ts`'s outbound headers, identically wrong in
  the monolith's own original source). Fixed for real 2026-07-30 and verified live: a corrected
  Authorization header (matching dLocal's actual documented `V2-HMAC-SHA256, Signature: <hex>`  scheme) got a real`400`from dLocal instead of`403`— proof the credentials/signing are now
  accepted. Both`money-service/src/dlocal/dlocal-payment.service.ts`and
 `lib/dlocal/dlocal-payment.service.ts`fixed identically (commit`ad7e57d1`). **(68, RESOLVED)**
  The third orphaned `Payment` row (`cms79jwuw00000frzsiurqtk4`) was deleted by Davin before
  4A-10c and independently re-verified gone via direct production query. **(69, NEW — supersedes
  #67)** `DECISION-LOG.md`**F49** (OPEN): fixing F48 let a dLocal request reach payload validation
  for the first time ever, which immediately failed with`400 {"code":5001,"message":"Missing
  parameter: payment_method_flow"}`— the outbound request body has never included this
  dLocal-required field, on either side of the migration. dLocal outbound payment creation has
  still never actually worked in production, independent of migration sequencing — F48 was simply
  the first of (at least) two bugs blocking it. Needs its own dedicated fix session: map each
  payment-method type (buckets already exist in
 `lib/dlocal/payment-methods.service.ts`'s `getPaymentMethodType`) to dLocal's real
  `payment_method_flow`value, then verify against dLocal's real sandbox API with a live call
  before considering Group B cutover-ready again. **(70, NEW)** A 4th orphaned`Payment` row
  (`cms7hlmb900000fmpz9i9fv1q`, `status: PENDING`) was created during 4A-10c's live test, before
  F49 was diagnosed — needs Davin's cleanup, same as the prior three (the Executor will not delete
  production data directly even with authorization). **(71, NEW)** `SVC_TOKEN`needs a real,
  matching value set on BOTH money-service's and operation-service's Railway production before
 `4a-12-outbox-email-worker-cutover.migration-order.md`can test the delivery path — value-blind
  confirmed absent on both as of 4A-11's close. Setting it is Davin's own live secrets action, not
  something the Executor does. **(72, NEW)**`DECISION-LOG.md`**F50** (OPEN): the
 `COMMISSION_CREDITED` `OutboxEvent`'s `aggregateId`is the paying subscriber, not the affiliate
  who earned the commission — operation-service's`OutboxConsumerService`deliberately skips this
  eventType (logs, returns`'skipped'`) rather than emailing the wrong person, since neither the
  payload nor operation-service's Prisma schema subset can resolve the real recipient today. Needs
  its own dedicated fix (most likely: money-service pre-resolving the affiliate's email/name/code/
  totalEarnings into the payload at emission time, in `stripe-webhook.service.ts`) before this
  specific eventType can be considered done — the other 5 are unaffected. **(73, NEW)** Two more
  Railway secrets need rotation, on top of Waiting-on #66's still-outstanding set: 4A-11's own
  CONFIRM step accidentally printed operation-service's real `DATABASE_URL`and`NEXTAUTH_SECRET`  into the session transcript (a`head -c 300`sanity-check on raw variable JSON, not a`--kv`/
  default-table view this time — see `LESSONS-LEARNED.md`L17's new recurrence note). Disclosed
  immediately, not reproduced again. **(74, NEW)** `4a-12-outbox-email-worker-cutover.migration-order.md`   PRE-DRAFTed at 4A-11's close (VERIFY-RETIRE, fast-path eligible per
  `EXECUTOR-PROTOCOL.md` §4) — carries #71/#72 forward as explicit entry criteria / monitoring
  notes so neither gets rediscovered live during the cutover itself.
  **(75, NEW — the Slice 5 clock, resolved)** Asked directly at 4A-11's own close whether a
  shadow/mirror-run had started and the SOURCE files were CC-F frozen for a 48h window, the way
  Slice 4's did. **Neither is true and neither was fabricated to answer that question** — checked
  against 4A-11's own order text first (`SOURCE files become change-frozen... not applicable yet`),
  reported the mismatch, and asked Davin live rather than inventing a start/end timestamp. **What
  started:** nothing — no shadow-traffic mechanism exists for `OUTBOX_PUBLISHER_ENABLED` (a single
  on/off gate, no mirrored delivery path to diff against before flipping it), same root cause as
  Slice 3's F44. **Exact end date/time:** N/A, no clock running — Davin's live decision
  (`DECISION-LOG.md`**F51**, RESOLVED) was to skip a formal wait-clock entirely, same resolution as
  F44, rather than institute a 48h freeze like Slice 4's. **What to watch instead:** 4A-12's own
  real entry criteria —`SVC_TOKEN`set to a real matching value on both services (#71, still
  outstanding) and Davin's live presence for the flip itself; this session's 30 new tests (one per
 `eventType` + edge cases) stand in for a shadow-run's diff-review. **What would end an early
  wait:** N/A, since nothing is waiting on a clock — the equivalent trigger would be Davin deciding
  he wants a freeze/soak window after all (superseding F51), not a monitoring threshold.
- **Next session:** Two independent tracks are both open; Davin to decide relative ordering.
  **Slice 4 track (this file's own numbering):** `4a-9-money-service-write-apis-port.migration-order.md`
  is CONFIRMED, executed, and fully closed (see Order status above) — Slice 4's write APIs are
  BUILT in `money-service`. `4a-10a-money-service-write-transport.migration-order.md` (the
  monolith-side transport BUILD, mirroring 4A-7a's Slice-3 scope) is now ALSO CONFIRMED, executed,
  and fully closed (see Current/Order status above) — all 5 monolith write routes have
  `MIGRATE_WRITE_APIS_MONEY_*` flag-check + forwarding wiring, resolving Waiting-on #61. Session
  4A-10c (ad-hoc, 2026-07-30) fixed `DECISION-LOG.md` **F48** for real and verified it live — see
  Current/Order status above. **The real next session is now a fix session for `DECISION-LOG.md`
  F49** (`payment_method_flow` missing from the outbound dLocal request body — found live only
  because F48 no longer masks it), not a further continuation of
  `4a-10-money-service-write-apis-cutover.migration-order.md` (4A-10b), which stays effectively
  closed for 3 of 4 groups** — Stripe, Admin, and Disbursement all genuinely CUT-OVER as of the
  2026-07-30 continuation session (see Current/Order status above). Group B (dLocal) is blocked on
  F49: map each supported payment method (buckets already exist in
  `lib/dlocal/payment-methods.service.ts`'s `getPaymentMethodType`) to dLocal's real
  `payment_method_flow` value, add it to the request body in both
  `money-service/src/dlocal/dlocal-payment.service.ts` and the monolith's
  `lib/dlocal/dlocal-payment.service.ts`, then verify against dLocal's real sandbox API with a
  live call (not just a code read/`tsc` — this bug class is invisible to unit tests with mocked
  `fetch`, per `LESSONS-LEARNED.md` L2, same as F48 was) before retrying Group B using the same
  live-test method established across 4A-10b/4A-10c. Also still open, both Davin's own actions: a
  4th orphaned `Payment` row (`cms7hlmb900000fmpz9i9fv1q`) needs cleanup, and the secrets exposed
  during 4A-10b's continuation (`CRON_SECRET`/`DATABASE_URL`/`NEXTAUTH_SECRET`/`REDIS_URL`/4
  dLocal vars) still need rotation.
  `migration-cutover-table.md`'s Slice 4 row is now `CUT-OVER (partial: 3/4 groups)` — full
  `CUT-OVER` still waits on Group B/F49 specifically. **4A-11 (Slice 5 / Outbox Email Worker BUILD)
  is now CONFIRMED, executed, and fully closed** (`4a-11-outbox-email-worker.migration-order.md`,
  2026-07-30 — see Current/Order status above) — the receiving side is built in operation-service,
  zero traffic cut over. **4A-12 (Slice 5 CUTOVER) is PRE-DRAFTed**
  (`4a-12-outbox-email-worker-cutover.migration-order.md`, VERIFY-RETIRE, fast-path eligible),
  gated on Waiting-on #71 (`SVC_TOKEN` real value, both services) and Davin's live presence — still
  independent of the F49/dLocal track, either can run first.
  **That eventual full close-out must still explicitly carry forward the email-silence
  consequence 4A-9 flagged**: now that the Stripe flag is genuinely live, Stripe-originated
  tier-upgrade/cancellation/payment emails are STILL silent as of 2026-07-30 — 4A-11 built the
  receiving end but `OUTBOX_PUBLISHER_ENABLED` stays off until 4A-12 actually flips it, so nothing
  changes about this until then. Not a regression to discover later, already known and accepted,
  but worth confirming Davin still wants this given it's no longer hypothetical and now has a
  concrete next step (4A-12) rather than being blocked on Slice 5 not existing at all.
  4A-8's own Step 1 closed the 3-endpoint idempotency gap Waiting-on #52 flagged (Stripe checkout,
  dLocal create, admin code distribution all now have a guard) — **#52 is RESOLVED.**
  `RiseWorksWebhookEvent`'s own missing unique constraint (also flagged under #52) was NOT
  touched this session (out of 4A-8's re-scoped Step 1, which was specifically the 3 write-path
  idempotency keys, not webhook-dedupe schema work) — likely moot once 4A-W8 archives RiseWorks,
  otherwise still open. **Wise track (unaffected by 4A-8/4A-9):\*_
  `4a-w7-wise-cutover.migration-order.md` is CONFIRMED and executed
  — not yet fully closed (funding in progress, `Commission=PAID` not yet observed, see Current
  above). Once that lands, close 4A-W7 for real (Deviations, monitoring-window check) before
  starting `4a-w8-riseworks-archival.migration-order.md` (PRE-DRAFTed at 4A-W7's own close,
  VERIFY-RETIRE/ARCHIVE block, entry-gated on 4A-W7 actually finishing, carries `DECISION-LOG.md`
  F47 forward explicitly so it doesn't get lost). Carry forward from 4A-W3a/4A-W5: THB production fixture still needed (#46); the write-scoped sandbox
  `WISE_API_TOKEN` gap (#47) is unresolved — 4A-W6 worked around it (Option 2, RSA-signed test
  payloads) rather than closing it, so 4A-W7 needs a real production-scoped token regardless
  (different token, per §7.2's two-tokens-promoted-per-session plan); the OpenAPI's
  archive-vs-upsert conflict on recipient replacement needs a decision (#49); `railway up` stays
  unreliable for money-service, use `git push origin main` (#50, L23); the admin list's missing
  affiliate-name field is a minor UX gap, not blocking (#51). Separately, unchanged from prior
  sessions: a future RETIRE
  session can delete the monolith's now-orphaned `app/api/affiliate/dashboard/_`,
`app/api/admin/{affiliates,analytics}/_`routes and their`lib/`logic once Davin agrees
Slice 3 (4A-7b) has been stable long enough — not yet scheduled.`4A-5-RW`(RiseWorks) stays
REVOKED (Waiting-on #37), not pending.`Session 6-1`(Phase 6 Gap Matrix,`docs/migration-orders/6-1-gap-matrix-f11.migration-order.md`) was PRE-DRAFTed at 5-4's
close, a separate track — Davin to decide ordering against Slice 4 (4A-8), the
Slice-3-RETIRE session, and the now-active `4A-W_` series.
- **Open flags:** F1 fully RESOLVED (Session 0-3) · F2 RESOLVED (Session 0-1) · F3
  RESOLVED (Session 1-1: on Railway, different instance than `railway-gateway`) · F17
  RESOLVED (Session 0-5: synthetic seed only) · F18 RESOLVED (Session 1-1: RPO ≤ 24h,
  RTO ≤ 1h, with an unverified-backup-cadence gap — re-confirmed unchanged Session 1-4;
  this is the reason Phase 1 isn't marked exit-clean) · **F19 fully RESOLVED (Session
  2-1)** — audit + bump + codemods + production deploy, all verified · **F20 fully
  RESOLVED (Session 2-3)** — migration history baselined, `drop_watchlists`
  strip-and-orphaned per Davin, FK audit applied to production · **F4 fully
  RESOLVED (Session 2-2)** — model census, 1 market + 26 non-market + `RefreshToken`
  stub · **F5 fully RESOLVED (Session 2-4)** — split clients live in production code,
  every consumer repointed, old schema retired · **F21 OPEN** (24h Account-Deletion
  GDPR gap — requires Davin's product decision on hard-delete vs anonymize, scheduled
  for a future session) · **F22 fully RESOLVED (Session 2-4)** · **F6 fully
  RESOLVED (Session 3-1)** — bridge-first confirmed, the 3 "missing" reference docs
  found but explicitly disregarded (superseded OpenAuth seed material) · **F7 fully
  RESOLVED (Session 3-1)** — Path B (`JwtAuthGuard` decrypts NextAuth's JWE
  directly), proven via a real round-trip before the guard was built · **F23 fully
  RESOLVED (Session 3-2)** — `RefreshToken` hardened (hashed-at-rest via SHA-256,
  revocable, `userAgent`/`ipAddress`), applied to production as a pure `CREATE
TABLE` (the table never actually existed before) · **F24 fully RESOLVED (Session
  3-2)** — `/auth/login` issues NextAuth-compatible JWEs, same format `JwtAuthGuard`
  already verifies · **F25 fully RESOLVED (Session 3-3)** — test locally + deploy
  directly to production, Davin's call; a repeatable local-testing recipe now exists
  (L31/L32) · **F26 fully RESOLVED (Session 3-3)** — reuse NextAuth's exact cookie
  (corrected to the real per-environment name/attributes at CONFIRM, not the
  Decision Log's dev-mode shorthand) · **F27 fully RESOLVED (Session 3-3)** — defer
  `/auth/register` routing until email-sending is ported, unchanged from Davin's
  call · **F28 fully RESOLVED (Session 3-4)** — continue the F25 local-testing
  precedent, using real Resend API keys · **F29 fully RESOLVED (Session 3-4)** —
  port `lib/email/email.ts` in full into operation-service · **F30 fully RESOLVED
  (Session 3-4)** — CORS confirmed unnecessary, server-side proxying continues ·
  **F31 fully RESOLVED (Session 3-5, descoped; ACTIVATED FOR REAL Session 4A-11)** —
  SVC_TOKEN now a real shared secret guarding money-service's outbox delivery call
  into operation-service (`SvcTokenGuard`, `POST /outbox/events`); real value not yet
  set on either service's Railway production (needed before 4A-12) ·
  **F32 fully RESOLVED (Session 3-5)** — Davin set both
  missing Railway env vars, confirmed live at CONFIRM · **F33 fully RESOLVED
  (Session 3-5)** — production check completed same-session against the live
  Vercel URL, NextAuth confirmed unregressed, no outstanding items · **F15 fully
  RESOLVED (Session 4A-1, Davin)** — money-service reuses the existing shared
  Railway Redis instance, `op.*`/`money.*` namespaces, not a dedicated instance ·
  **F16 fully RESOLVED (Session 4A-1, Davin)** — public URL scheme
  `<api.domain/v1 + money.domain/v1>` · **F34 fully RESOLVED (Session 3-5, Davin)** —
  reuse the existing "postgre for staging" Railway project whenever CC-A's staging
  gap is actually addressed (base Postgres/Redis already provisioned there; nothing
  else built yet) · **F35 fully RESOLVED (Session 4A-2, Davin) — cutover EXECUTED
  Session 4A-3** — money-service crons Slice 1's shadow-run mechanism given F34/CC-A
  isn't ready: `CRON_ENABLED` gate + manual-trigger verification, not a literal parallel
  staging run; 4A-3 flipped the gate and emptied `vercel.json`'s crons, Slice 1 is now
  CUT-OVER (monitoring caveat, Waiting-on #36) ·
  **F36 fully RESOLVED (Session 4A-W1, Davin)** — Wise integration Model A (Business +
  personal API token); funding stays `MANUAL` regardless (Thailand region gate) ·
  **F37 fully RESOLVED (Session 4A-W1, Davin)** — `WISE_FUNDING_MODE=MANUAL`, Thailand not on
  Wise's API-funding allowlist ·
  **F38 fully RESOLVED (Session 4A-W2, Davin)** — Option A, platform bears the Wise fee
  (`feeBearer = 'PLATFORM'`), affiliates receive their exact earned commission ·
  **F39 fully RESOLVED (Session 4A-W3a, Davin)** — Option A, affiliate self-service form (`/affiliate/settings/payout`), admin views summary ·
  **F40 fully RESOLVED (Session 4A-W5, Davin)** — Profile-level subscription
  (`WISE_WEBHOOK_SCOPE = 'PROFILE'`), following Model A ·
  **F41 fully RESOLVED (Session 4A-W3a, Davin)** — Option A, Wise-managed PII; store only `accountTail` last 4 digits and `detailsFingerprint` SHA-256 hash ·
  **F42 fully RESOLVED (2026-07-25, Davin; recorded 4A-W1)** — RiseWorks archived, not
  deleted: dormant in repo AND database, restorable per `replace-rise-with-wise/03-…` ·
  **F43 fully RESOLVED (Session 4A-W6, Davin; delivery channel confirmed LIVE Session 4A-W7)** —
  Option (a), Resend REST called directly from money-service (native `fetch`, no new dependency);
  `RESEND_API_KEY` + `WISE_FUNDING_ALERT_EMAIL` confirmed present (value-blind) on money-service's
  Railway production as of 4A-W7 — the alert path actually delivers now ·
  **F47 OPEN (registered Session 4A-W7)** — `wise-quote.service.ts`'s `targetAmount` currency-unit
  bug, found live during the first-ever non-USD Wise payout; full detail in `DECISION-LOG.md` ·
  **F48 fully RESOLVED (Session 4A-10c, 2026-07-30)** — dLocal outbound payment creation was
  sending `X-Login`/`X-Trans-Key`/`Authorization` to the wrong fields in both
  `money-service/src/dlocal/dlocal-payment.service.ts` and the monolith's identical original
  source; corrected to dLocal's real `V2-HMAC-SHA256` scheme and verified live (dLocal returned a
  real `400` — payload validation — instead of the previous `403` credential rejection) ·
  **F49 OPEN (registered Session 4A-10c, 2026-07-30)** — fixing F48 uncovered that the outbound
  dLocal request body has never included the required `payment_method_flow` field, on either side
  of the migration; full detail in `DECISION-LOG.md` ·
  **F50 OPEN (registered Session 4A-11, 2026-07-30)** — `COMMISSION_CREDITED`'s `OutboxEvent`
  `aggregateId` resolves to the paying subscriber, not the affiliate who earned the commission;
  operation-service's schema subset has no `Commission`/`AffiliateProfile` model to resolve the
  real recipient either way — deliberately skipped rather than emailed to the wrong person; full
  detail in `DECISION-LOG.md` ·
  **F14 fully RESOLVED (Session 4A-8, Davin)** — Transactional Outbox pattern; `OutboxEvent` live
  in production with verified `money_svc` grants, `OutboxPublisherCron` built but gated OFF
  pending Slice 5's (4A-11/12) real operation-service consumer (Waiting-on #60) ·
  F8–F13 OPEN (register: plan §11 · resolutions: `docs/migration-orders/DECISION-LOG.md`)

## Key documents

| What                                 | Where                                                                                     |
| ------------------------------------ | ----------------------------------------------------------------------------------------- |
| Operating manual (YOUR rules)        | `docs/migration-orders/EXECUTOR-PROTOCOL.md`                                              |
| Migration plan (phases, flags)       | `docs/migration-orders/monolith-to-microservices-migration-implementation-plan.md` (v1.2) |
| Session playbook                     | `docs/migration-orders/monolith-to-microservices-migration-session-playbook.md`           |
| Order rules + templates              | `docs/migration-orders/00-SKELETON-AND-RULES.md` + `TEMPLATE-*.md`                        |
| Decision Log                         | `docs/migration-orders/DECISION-LOG.md`                                                   |
| Lessons learned (read at every OPEN) | `docs/migration-orders/LESSONS-LEARNED.md`                                                |
| Cutover table                        | `docs/migration-orders/migration-cutover-table.md`                                        |
| File inventory                       | `docs/migration-orders/migration-stack-analysis.md`                                       |

## Non-negotiables (short form — manual has details)

1. **Never execute an order that is not CONFIRMED.** Lifecycle: PRE-DRAFT → DRAFT →
   APPROVED (Davin) → CONFIRMED (you, after re-verifying code AND runtime state).
2. **One session = one verifiable unit of work.** Never end mid-cutover or half-deployed.
   Blocked? Document the blocker and stop — don't push into a broken state.
3. **Artifacts are the only channel.** Your session transcript dies with the session; the
   Deviations section, CLAUDE.md, Decision Log, cutover table, and file inventory are how
   the Advisor and Davin know what happened. Empty Deviations = starved next plan.
4. **Scope discipline.** No drive-by fixes to change-frozen (CC-F) or out-of-scope code.
   `lib/api/index.ts` is known-broken BY DESIGN — do not fix until Phase 7.
5. **Money and auth changes escalate.** Anything touching payments, grants, secrets, CORS,
   or auth semantics beyond the order's explicit steps → stop and ask Davin.
6. **Verification is never skipped, only strengthened.**

## Security Override Policy (retained from legacy guide — still binding)

Do **NOT** modify `overrides`/`pnpm.overrides` in `package.json` on feature branches, even
if `pnpm audit` complains. Security overrides are managed centrally on `main` via dedicated
PRs (`check-overrides.yml` enforces this; 7+ documented merge-conflict incidents caused the
rule — see `errors/continuous-pr-errors/`).
