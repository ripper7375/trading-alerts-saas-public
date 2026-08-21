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

- **Current:** Session 4A-13 (Stripe Webhook Cutover, Phase 4X gate 2/3, VERIFY-RETIRE/CUTOVER,
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
- **Previous:** Session 7-3 (API Client Contract Tests, Documentation & stackA/stackB Retirement,
  PORT/CONTRACT hybrid exit-review, dial LOW), CONFIRMED, executed, CLOSED SUCCESSFUL 2026-08-20.
  Third and final session of Phase 7 — **Phase 7 (API Client Rewrite) is now CLOSED.**
  **CONFIRM found the L3/L11 pattern again**: the order on disk carried the full Advisor
  DRAFT→APPROVED upgrade (`Decisions taken`, 5 Ordered Steps, entry criteria, done-when) while
  committed HEAD (from Session 7-2's close commit) was still the bare `PRE-DRAFT` stub with no
  steps at all. Reported in full before proceeding; Davin confirmed live the APPROVED batch is
  his authentic edit. All 4 entry criteria re-verified live and held (zero `stackA`/`stackB`
  consumers; `tsc`/`eslint`/`test:ci` baseline exact match to the order's claim —
  163/163 suites, 2412/2412 tests, 0 errors/5 warnings).
  **Built all 4 Ordered Steps, one commit each, plus a Step 0 CONFIRM housekeeping commit:**
  Step 0 — recorded the CONFIRM findings and the order's own citation-drift (Step 1's verification
  text predicted "-37 tests" for the 3 files being deleted; the real static count is **44**, no
  `.each()` blocks to explain the gap — corrected the expected post-Step-1 baseline before
  executing, then confirmed it live). Step 1 — deleted `stackA`, `stackB`, the `api` export,
  `apiCall`/`BASE_URL`, and the 6 unused legacy interfaces from `lib/api/index.ts` (module now
  strictly re-exports the generated-client surface); deleted the 3 test files that exclusively
  exercised the retired exports. `test:ci` **160/160 suites, 2368/2368 tests** (2412 − 44, zero
  regressions) — exact match to the corrected prediction. Step 2 — expanded
  `__tests__/lib/api/generated-clients.test.ts` from 12 to 43 tests: full domain coverage for
  `operationApi` (alerts, auth, user preferences/profile, drawings, notifications) and `moneyApi`
  (affiliates incl. the L32 `pathWithQuery`/`buildQuery` cast pattern, admin, wise disbursement,
  cron trigger, health), plus a dedicated 400/401/403/404/500 error-mapping block, every route
  re-verified directly against the generated `schema.ts` files rather than the order's prose
  (`LESSONS-LEARNED.md` L22). **Found a second order/ground-truth mismatch**: the order's Surface
  line names a templated `POST /v1/cron-trigger/{jobId}` money-service route that doesn't exist —
  the real schema emits 8 separate literal-named job routes instead; tested against the real
  `/v1/cron-trigger/daily-maintenance`. Also caught a genuine client-contract detail while writing
  the DELETE-204 test: `unwrapOperationApi`/`unwrapMoneyApi` return `undefined` on a 204, not
  `{}` — fixed the test's own first-draft assertion, not a flaky test. `test:ci`
  **160/160 suites, 2399/2399 tests** (2368 + 31 new, zero regressions). Step 3 — prepended a
  `HISTORICAL/SUPERSEDED` notice to the 5 legacy design docs in `backend-stack-a/api-client-
between-frontend-and-stack-b/` (kept for audit trail, not deleted); authored
  `docs/architecture/api-client-architecture.md` as the new canonical reference (client overview,
  codegen chain, server-only constraint + error-unwrap conventions, the ESLint direct-fetch ban,
  and the `/v1` prefix + L32 workaround with a worked example). Step 4 — full exit-review sweep:
  `tsc --noEmit` clean, `eslint` clean (0 errors, same 5 pre-existing warnings), `test:ci`
  **160/160 suites, 2399/2399 tests**. Repo-wide `stackA`/`stackB` grep swept 77 files but the
  only live-surface hit (`app/`, `components/`, `lib/`, `hooks/`, `__tests__/`) is `lib/api/
index.ts`'s own intentional retirement note — the rest are an unrelated third-party "Stack Auth"
  library in `seed-code/` (read-only, out of scope), the `frontend/` SEPARATE_STACK mirror (never
  in scope), and this session's own docs. Zero live code references to the retired exports remain.
  **No flag flipped, no cutover-table row** — pure test/doc/retirement cleanup, `migration-
cutover-table.md` unchanged. `migration-stack-analysis.md` updated (files deleted/created this
  session). No new `LESSONS-LEARNED.md` entry — both recurring patterns hit this session (L3's
  uncommitted-order pattern, L22's order-vs-ground-truth drift) already have active rules; see
  L3's own recurrence note for this session.
  **Artifacts updated:** `7-3-api-client-contract-tests-and-retirement.migration-order.md`
  (Status → CONFIRMED → CLOSED SUCCESSFUL; entry criteria all checked with CONFIRM-time findings;
  Done-when all checked; Deviations filled — 5 entries, 0–4), `migration-stack-analysis.md`, this
  file (Current/Previous rotation — Session 7-1 moved to `history/sessions-archive.md`),
  `LESSONS-LEARNED.md` (L3 recurrence note only, no new entry). **Next session is `4A-13`
  (Stripe Webhook Cutover, Phase 4X — `MASTER-ROADMAP-PHASES-7-15.md` §0 Gate 2, run immediately
  after 7-3, NOT Session 8-1** — 8-1's own deletion sweep is gated on all of 4A-13/4A-14/4A-15
  CLOSED first). **Its order (`4a-13-stripe-webhook-cutover.migration-order.md`) already exists**
  as `PRE-DRAFT`, generated 2026-08-04 at Session 4B-22's close — **not rewritten this session**;
  it needs a full fresh re-verification at its own CONFIRM, not a rewrite now. What's concretely
  stale about it, checked live at this session's close rather than assumed from its age:
  - **17 days old** (generated 2026-08-04, today 2026-08-21); its own Entry Criterion 2 says
    "8+ days have passed since the port" (Session 4A-9, 2026-07-27) — that framing is itself
    stale, the real gap is now **25 days**.
  - **Code-drift check (good news, but must be re-run live, not trusted from this note):**
    `git log --oneline -- lib/stripe/ app/api/webhooks/stripe/ money-service/src/stripe/` shows
    zero commits since `37700b51` (the Session 4A-9 port itself) — the only later Stripe-adjacent
    commit is `86ef2299` (Session 6-8, a frontend upgrade-success page, unrelated to webhook
    logic). No monolith-side or money-service-side webhook code has changed since the port, as of
    this check.
  - **`DECISION-LOG.md` F60 re-checked: still OPEN**, register text unchanged since Session 4B-22.
  - **Entry Criterion 1's own phrasing is now inaccurate and needs correcting at CONFIRM**: it
    says "no session between 4B-22 and this one's own CONFIRM has touched Stripe webhook code" —
    three sessions have in fact run since 4B-22 (7-1, 7-2, 7-3, all Phase 7 API-client work);
    none touched Stripe/webhook code (confirmed above), but the criterion's own wording assumed
    zero intervening sessions, not zero intervening _relevant_ sessions.
  - **What code-drift-checking cannot cover — genuinely needs live re-verification at CONFIRM,
    not assumable from git history:** whether production Stripe events are still reaching the
    monolith today (Entry Criterion 3), whether `STRIPE_WEBHOOK_SECRET`/money-service's real
    Railway env is still correctly set (Entry Criterion 5, value-blind per L17), and Davin's live
    availability for the webhook-URL repoint approval (Entry Criterion 4) — none of these are
    derivable from the repo alone.

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
