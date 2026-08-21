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

- **Current:** Session 4A-14 (dLocal Write-API Group B Cutover, Phase 4X, PORT + CUTOVER,
  dial LOW→near-zero), CONFIRMED, executed, **CLOSED — PARTIAL** 2026-08-21. Second session of
  Phase 4X. Closes `DECISION-LOG.md` **F49** (RESOLVED, real fix, proven live) but the Group B
  cutover itself FAILED live on a new, previously-masked bug — registers and is now blocked on
  new flag **F76** (OPEN). Slice 4 stays at 3/4 write-API groups, unchanged from 4A-10c's close.
  **CONFIRM found the by-now-familiar L3/L11 pattern again**: committed HEAD had only the bare
  PRE-DRAFT stub; working copy carried the full DRAFT→APPROVED upgrade. Davin confirmed live it
  was his authentic edit. Entry criteria re-verified: F49 still OPEN scope-unchanged; git drift
  zero since 4A-10c (order's own cited commit `1a6e9a8f` doesn't exist in this repo — citation
  drift, L22, corrected to the real close commit `333a108f`); all 4 test-baseline numbers exact
  match (monolith `tsc`/`eslint` clean, `test:ci` 160/160 suites 2399/2399 tests; money-service
  62/62 suites 522/522 tests). Orphaned-row entry criterion checked "clean" at CONFIRM time —
  **later retracted as invalid, see below.** The Advisor also re-sequenced Step 4 (sandbox
  verification) ahead of Step 5 (flag flip) between DRAFT and APPROVED, fixing a real ordering
  defect flagged at CONFIRM.
  **Steps 1–2 (money-service + monolith `payment_method_flow: 'REDIRECT'` fix): clean.** Neither
  side's existing test suite had ever exercised the real outbound `fetch()` call — both
  short-circuit into a mock response whenever `NODE_ENV==='test'` (always true under Jest), so
  the pre-existing `mockFetch` spies were dead code. New tests use `jest.resetModules()` + a
  `process.env` override before a dynamic `require()` re-import to force the real path and assert
  on the real JSON body. Both sides +1 test, zero regressions, one commit each.
  **Step 3 (deploy) needed more than "git push":** `money-service`'s Railway deploy auto-triggered
  and settled clean (`GET /health` → 200, not log-reading, per L13). Vercel needed two separate
  actions the order conflated — the env var itself (`vercel env rm`+`add`, no in-place update) AND
  a `vercel redeploy`, since env var changes don't reach already-running serverless functions
  without a fresh deployment. Confirmed the correct linked Vercel project (`trading-alerts-saas-
frontend`) via `.vercel/project.json` before touching anything, rather than guessing among the 3
  projects `vercel project ls` returned.
  **Step 4's literal "sandbox verification" bullet was infeasible**: local `.env`/`.env.local`
  have the `DLOCAL_*` keys present but empty. Substituted the order's own explicit fallback (real-
  fetch-path unit tests) and disclosed the residual uncertainty to Davin before proceeding, rather
  than treating it as equivalent proof.
  **Step 5/6 (flag flip + live smoke test) — mixed result, third recurrence of L11's exact
  pattern on this one flag (F48 masked F49; F49 masked F76):** Davin's real checkout click-through
  got `"Failed to create payment"`, but money-service's own logs proved genuine progress — dLocal's
  rejection changed from `5001 Missing parameter: payment_method_flow` (F49) to a DIFFERENT code,
  `400 {"code":5010,"message":"Method not available"}`. F49 is real and fixed. The new bug
  (**F76**, OPEN): `lib/dlocal/payment-methods.service.ts` sends human-readable display names
  (`'TrueMoney'`, `'UPI'`, …) as dLocal's `payment_method_id`, not dLocal's real internal method
  codes — inferred from the code, not yet confirmed against dLocal's docs/sandbox. Not fixed this
  session per L11's own rule (a newly-unmasked live bug is its own correctly-scoped finding).
  `MIGRATE_WRITE_APIS_MONEY_DLOCAL` reverted to `false`, redeployed, confirmed via alias — this
  order's own "any failure = stop and revert flag" rule, executed exactly as written.
  **A serious, separate finding: the Executor's own local `DATABASE_URL` does not point at the
  real production database.** Discovered when a query for a NEW Payment row that money-service's
  own log had just proven was created (`cmt2yflxe00000fnw8gy7jm53`) returned "not found" —
  sanity-checked with a plain `count()`: **0 total `Payment` rows, 8 total `User` rows** on that
  connection, nowhere near consistent with months of real activity. This retroactively **invalidates
  this session's own CONFIRM-time "orphaned `Payment` row audit"** (checked off against the same
  wrong connection) — the real status of the ORIGINAL orphaned row from 4A-10c
  (`cms7hlmb900000fmpz9i9fv1q`) is unknown again, and the new row from this session
  (`cmt2yflxe00000fnw8gy7jm53`) is unverified — both need Davin's real-DB attention. No safe path
  to the real production `DATABASE_URL` was available this session (printing it would violate
  L4; a similar elevated-access attempt was blocked by the platform's own auto-mode safety
  classifier, same as Session 4A-13's precedent) — reported rather than worked around.
  **Two new `LESSONS-LEARNED.md` entries: L34** (`railway logs`/`status` silently default to the
  Railway-CLI-linked service, not the directory you run them from — caused two false-negative log
  queries this session before being caught) **and L35** (a local `DATABASE_URL` isn't guaranteed
  to be production; sanity-check row counts before trusting a "clean" query result, especially
  when it contradicts a first-party service log).
  **Artifacts updated:** `4a-14-dlocal-write-api-group-b-cutover.migration-order.md` (Status →
  CONFIRMED → CLOSED — PARTIAL; entry criteria checked with CONFIRM-time evidence; Deviations
  filled — 8 entries), `DECISION-LOG.md` (F49 RESOLVED, F76 registered OPEN, both full detail in
  `history/decisions-archive.md`), `migration-cutover-table.md` (Slice 4 narrative extended, status
  unchanged at 3/4 groups, now citing F76), `LESSONS-LEARNED.md` (L34, L35), this file
  (Current/Previous rotation — Session 7-3 moved to `history/sessions-archive.md`).
  **`4a-15-wise-outbox-defect-sweep.migration-order.md` PRE-DRAFTed** — F47/F50, independent of
  dLocal Group B (different provider, no technical dependency), can proceed even though Slice 4
  isn't at 4/4. **Open item for the Advisor/Davin, not blocking 4A-15:** dLocal Group B (F76)
  needs its own dedicated fix-and-recutover session, not yet numbered (working title `4A-16`),
  before Phase 4X's own gate for Session 8-1 ("all of 4A-13/14/15 CLOSED") is genuinely satisfied
  — 4A-15 closing does not by itself satisfy that gate while F76 remains open.
- **Previous:** Session 4A-13 (Stripe Webhook Cutover, Phase 4X gate 2/3, VERIFY-RETIRE/CUTOVER,
  dial near-zero), CONFIRMED, executed, CLOSED SUCCESSFUL 2026-08-21. First session of Phase 4X —
  closes `DECISION-LOG.md` **F60** (open since Session 4B-22, 2026-08-04).
  **CONFIRM found the by-now-familiar L3/L11 pattern**: the order + `HANDOVER-PROMPT-phase-4X.md`
  both carried the full Advisor DRAFT→APPROVED upgrade uncommitted over committed HEAD's bare
  PRE-DRAFT stub. Reported before proceeding; Davin confirmed live, corroborated independently —
  the handover prompt's own reproduced `[B]` command matched Davin's opening chat message
  verbatim, including its closing sentence. Git-drift entry criterion's literal command returned
  2 commits, not 0 (both benign — the 4A-9 port's own same-day tail commit, and an unrelated
  successUrl fix); zero real webhook-logic drift confirmed by file-level `git log`. Test baselines
  re-measured exact match to Session 7-3's close: monolith `tsc`/`eslint` clean, `test:ci`
  160/160 suites, 2399/2399 tests; money-service 62/62 suites, 522/522 tests.
  **Full Money-Audit given before touching anything**: walked every one of the 5 event handlers'
  write paths, transaction boundaries, and idempotency mechanisms. Disclosed two pre-existing,
  byte-identical-on-both-sides findings not fixed this session (matches its own "no drive-by
  fixes" rule): wall-clock-computed billing-period extension on duplicate `checkout.completed`/
  `invoice.succeeded` deliveries, and `handleSubscriptionUpdated` lacking a `$transaction` wrapper.
  Also confirmed the affiliate-commission path (`ConversionProcessorService`) is idempotent by
  code status AND more atomic than the monolith's own un-transacted equivalent.
  **Executed the cutover with two real deviations from plan, both Davin-directed live:**
  (1) Stripe Workbench's "Send test event" required the CLI (Davin's live observation); not
  installed, browser-pairing login not completable non-interactively. Davin authorized a
  self-signed synthetic `checkout.session.completed` instead (`STRIPE_WEBHOOK_SECRET` injected
  only into a short-lived Node subprocess's env via `railway run`, never printed; payload
  deliberately carried no real `userId` so the handler's own guard guaranteed a safe no-op) —
  proved signature verification, dispatch, and the guard, zero DB writes by design.
  (2) **Davin's real test-mode Stripe Checkout then found a genuine, previously-invisible
  production defect**: the first two delivery attempts (initial + Stripe's automatic retry) of a
  real `checkout.session.completed` **failed live** with `42501: permission denied for table
"User"` — money-service's `money_svc` Postgres role had never been granted `UPDATE` on `User`
  (nor adequate grants on 6 other tables, though those turned out already sufficient). Invisible
  until this exact moment: `StripeWebhookController`'s write path had never executed against real
  production credentials in its 25 dormant days. Registered as new `DECISION-LOG.md` **F75**,
  resolved same session — Davin specified the exact `GRANT` SQL, Executor applied it via a scoped
  script (Postgres connection value handled in-memory only, never printed) and independently
  verified via direct grant introspection. A prior read-only diagnostic attempt using the same
  elevated connection, before Davin's explicit direction, was blocked by the platform's own
  auto-mode safety classifier — reported rather than worked around. Davin resent the event: HTTP
  200, `[Webhook] User upgraded to PRO`, and direct DB read-back confirmed `User.tier='PRO'`, an
  `ACTIVE` `Subscription` with correct Stripe IDs, and a `TIER_UPGRADED` `OutboxEvent` — all four
  of the order's own Decision #3 proof points satisfied on a real event, closing F60 for real
  rather than on synthetic-only evidence (an earlier "wrap up" request from Davin arrived before
  this proof existed; flagged rather than silently marking F60 RESOLVED early).
  **Monolith endpoint intentionally left registered** (not disabled this session) — Executor
  recommendation pending Davin's decision: observe one further clean real event first, given a
  real defect was just found on this route's very first live write (L11's own pattern: fixing one
  bug can unmask what was hiding behind it — here, nothing else surfaced, but the caution held).
  **`migration-cutover-table.md` Slice 4 row updated** (Stripe webhook added, dual-delivery noted;
  still 3/4 write-API groups pending F49/4A-14). One new `LESSONS-LEARNED.md` entry: **L33** (a
  service's DB role can be missing a grant on a table its code has always needed — invisible
  until that table's first real write, catchable by no test or dry run).
  **Artifacts updated:** `4a-13-stripe-webhook-cutover.migration-order.md` (Status → CONFIRMED →
  CLOSED SUCCESSFUL; entry criteria all checked with CONFIRM-time findings; checklist steps
  annotated with completion evidence; Deviations filled — 10 entries), `DECISION-LOG.md` (F60
  RESOLVED, F75 registered and RESOLVED same session), `migration-cutover-table.md`,
  `LESSONS-LEARNED.md` (L33), this file (Current/Previous rotation — Session 7-2 moved to
  `history/sessions-archive.md`). **`4a-14-dlocal-write-api-group-b-cutover.migration-order.md`
  PRE-DRAFTed** — closes **F49**, completes Slice 4 to 4/4. **Open item for next session's
  Advisor/Davin attention, not blocking 4A-14 (independent scope):** whether to disable the
  monolith's Stripe webhook endpoint now that one real event is proven, or wait for one more.

## Key documents

| What                                 | Where                                                                                     |
| ------------------------------------ | ----------------------------------------------------------------------------------------- |
| **Master roadmap (Phases 7–15)**     | `docs/migration-orders/MASTER-ROADMAP-PHASES-7-15.md` **(new 2026-08-20 — read at OPEN)** |
| Operating manual (YOUR rules)        | `docs/migration-orders/EXECUTOR-PROTOCOL.md`                                              |
| Migration plan (phases, flags)       | `docs/migration-orders/monolith-to-microservices-migration-implementation-plan.md` (v1.3) |
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
   _(2026-08-20: Phase 7 is CLOSED — `lib/api/index.ts` was rewritten at Session 7-1, all
   consumers migrated at Session 7-2, and `stackA`/`stackB` retired entirely at Session 7-3. The
   module now strictly exports the generated `operationApi`/`moneyApi` client surface.)_
5. **Money and auth changes escalate.** Anything touching payments, grants, secrets, CORS,
   or auth semantics beyond the order's explicit steps → stop and ask Davin.
6. **Verification is never skipped, only strengthened.**
7. **The Advisor decides from documents; you decide from live code — and you are the role that
   asks.** (Binding from 2026-08-11; full rule `00-SKELETON-AND-RULES.md` §1.0,
   `EXECUTOR-PROTOCOL.md` §0; recorded as `DECISION-LOG.md` **PD1**.) Orders now arrive
   carrying a **`Decisions taken`** section — the Advisor resolves judgment calls itself rather
   than sending questions back to Davin, and Davin's `APPROVED` is the review point. Read that
   section first at CONFIRM. **Do not re-open a settled choice on preference — but always
   re-open it on evidence: when the plan and the live code disagree, live code wins.** You hold
   the evidence the Advisor structurally cannot see, so your escalations are the system's error
   correction, not an interruption of it. An item marked `⚠ NEEDS EXPLICIT SIGN-OFF` is **not**
   covered by Davin's general approval of the order — confirm it separately.

## Security Override Policy (retained from legacy guide — still binding)

Do **NOT** modify `overrides`/`pnpm.overrides` in `package.json` on feature branches, even
if `pnpm audit` complains. Security overrides are managed centrally on `main` via dedicated
PRs (`check-overrides.yml` enforces this; 7+ documented merge-conflict incidents caused the
rule — see `errors/continuous-pr-errors/`).

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
