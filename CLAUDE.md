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

- **Current:** Session 4A-15 (Wise + Outbox Defect Sweep, Phase 4X, PORT, dial LOW), CONFIRMED,
  executed, **CLOSED SUCCESSFUL** 2026-08-21. Third and final session of Phase 4X's originally-
  scoped Wise/outbox work — closes `DECISION-LOG.md` **F47** (Wise quote currency correctness,
  OPEN since 4A-W7) and **F50** (`COMMISSION_CREDITED` recipient resolution, OPEN since 4A-11).
  **CONFIRM found the by-now-familiar L3/L11 pattern again** (18+ recurrences, `LESSONS-LEARNED.md`
  L3 bumped): committed HEAD had only the bare PRE-DRAFT stub; working copy carried the full
  DRAFT→APPROVED upgrade. Davin confirmed live it was his authentic edit.
  **CONFIRM found two entry criteria genuinely failing, both pre-dating this order and unrelated
  to F47/F50:** (1) operation-service's claimed 42/42-suite baseline was false — 3 suites failed
  to compile on `this.prisma.affiliateProfile` in `auth.service.ts` (operation-service's schema
  has no such model by design), a pre-existing defect from commit `70299f13` (2026-08-15), a full
  week before this order's own PRE-DRAFT ancestor session. (2) The order's "Outbox publisher is
  currently disabled, zero production risk" framing was wrong — `OUTBOX_PUBLISHER_ENABLED` has
  been `true` in production since **Session 4A-12 (2026-07-30)**, which `migration-cutover-
table.md`'s own Slice 5 row already recorded correctly; the order's narrative simply never
  cross-checked it. New `LESSONS-LEARNED.md` **L37**. Both reported to Davin before any execution;
  he live-authorized a new Step 0 (remove the invalid seed call) and updated the order's own text
  (risk framing, entry criteria, a new `Decisions taken` #4) before saying go.
  **Steps 0–3 executed clean, one commit each, full suite green after every step:**
  Step 0 (`1f147116`) removed the dead `if (fixed.isAffiliate) {...}` affiliate-seed block from
  `auth.service.ts` — operation-service back to 42/42 suites, 393/393 tests. Step 1 (`4496abb2`,
  F47) widened `CreateQuoteInput` to accept `sourceAmount`/`targetAmount` and branched
  `wise-payment.provider.ts`'s quote call on currency match (targetAmount for USD->USD per F38,
  sourceAmount for USD->non-USD) — 3 new tests, money-service 62/62 suites, 526/526 tests.
  **Verified via unit tests only, not live Wise sandbox** — `WISE_PROFILE_ID`/`WISE_API_TOKEN`
  were found undocumented in `.env.example` and unset locally; Davin approved the scope reduction
  live (order `Decisions taken` #4), disclosed as residual risk in `DECISION-LOG.md`'s F47 entry
  and `migration-cutover-table.md`'s Slice 2W row — the first real non-USD payout after this fix
  is still the first live proof point. Step 2 (`ca27c04d`, F50 producer) widened
  `ConversionProcessorService`'s Prisma `select` to include `affiliateProfile.userId`, captured
  the previously-discarded `affiliateProfile.update()` result to read `totalEarnings`, and changed
  `stripe-webhook.service.ts`'s `emitOutboxEvent` call to pass the affiliate's `userId` (not the
  buyer's) as `aggregateId` — money-service 62/62 suites, 526/526 tests. Step 3 (`8810b260`, F50
  consumer) removed `OutboxConsumerService`'s `COMMISSION_CREDITED` skip block and wired
  `dispatch()` to the pre-existing (4A-11) `sendAffiliateCommissionEmail()` — operation-service
  42/42 suites, 393/393 tests. **Because the publisher is genuinely live**, this fix has no
  separate flag-flip gate the way 4A-13/4A-14's cutovers did — the next real affiliate conversion
  (Stripe now, dLocal once F76 closes) will trigger a real email send on its own next natural
  trigger; no real/synthetic event was sent this session (PORT variant, zero live traffic risk in
  scope), first-real-delivery stays a monitoring item.
  **Step 4 (full validation) needed a re-run**: launching monolith `tsc`+`eslint`+`test:ci` and
  both services' full suites in parallel (5 concurrent heavy processes) crashed 4 money-service +
  3 operation-service Jest workers on OOM — false failures, not real ones (`tsc`/`eslint` in the
  same batch passed clean). Re-run sequentially per `LESSONS-LEARNED.md` L24: monolith `tsc` clean,
  `eslint` 0 errors/5 warnings, `test:ci` 160/160 suites/2400/2400 tests; money-service 62/62
  suites/526/526 tests; operation-service 42/42 suites/393/393 tests. All green.
  **Two more incidental findings, neither blocking:** the pre-commit hook's stash-backup/restore
  mechanism twice left a purely-cosmetic (whitespace-only) working-tree/index diff after a commit
  had already succeeded — verified via diff, reset via `git checkout HEAD -- <file>`, new
  `LESSONS-LEARNED.md` **L36**. An unrelated, uncommitted edit to 2 `seed-code/**` files
  (`app/affiliate/dashboard/payouts/page.tsx` and `.../statements/page.tsx`) was observed
  mid-session, matching F38's fee-framing — not present at session start, not touched or
  committed by this session (`seed-code/**` is read-only, CLAUDE.md §5); flagged for Davin.
  **Artifacts updated:** `4a-15-wise-outbox-defect-sweep.migration-order.md` (Status → CONFIRMED →
  CLOSED SUCCESSFUL; entry criteria and slice-level verification all checked with CONFIRM/CLOSE-
  time evidence; Deviations filled — 9 entries), `DECISION-LOG.md` (F47 RESOLVED, F50 RESOLVED,
  both full detail in `history/decisions-archive.md`), `migration-cutover-table.md` (Slice 2W row
  updated for F47, Slice 5 row updated for F50), `LESSONS-LEARNED.md` (L3 recurrence bump, L36,
  L37), this file (Current/Previous rotation — Session 4A-13 moved to
  `history/sessions-archive.md`). **`9-0-frontend-swap-contract-decisions.migration-order.md`
  PRE-DRAFTed and `HANDOVER-PROMPT-phase-9.md` authored** per this order's own Step 5 and the
  master roadmap's own per-phase trigger table ("4A-15 writes phase-9's"). **Open item for the
  Advisor/Davin, not blocking 9-0:** dLocal Group B (F76) still needs its own dedicated
  fix-and-recutover session (working title `4A-16`) before Phase 4X's own gate for Session 8-1
  ("all of 4A-13/14/15 CLOSED") is genuinely satisfied — with 4A-15 now closed, that gate's only
  remaining blocker is F76/4A-16.
- **Previous:** Session 4A-14 (dLocal Write-API Group B Cutover, Phase 4X, PORT + CUTOVER,
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
