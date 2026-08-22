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

- **Current:** Session 9-0 (Frontend Swap Contract & Decisions, Phase 9, CONTRACT, no code),
  CONFIRMED, executed, **CLOSED SUCCESSFUL** 2026-08-22. First session of Phase 9 — resolves
  `DECISION-LOG.md` **F65** (BFF boundary, ⚠ NEEDS EXPLICIT SIGN-OFF) and **F66** (swap mechanism
  - brand scope, ⚠ NEEDS EXPLICIT SIGN-OFF on live Stripe catalog).
    **CONFIRM found the by-now-familiar L3 pattern again** (19th+ recurrence): committed HEAD held
    only the bare PRE-DRAFT stub; working copy carried the full Advisor DRAFT→APPROVED upgrade plus
    4 consistent companion-doc edits (`MASTER-ROADMAP-PHASES-7-15.md` adding 4A-16/F76,
    `SESSION-PROMPT-SCRIPT.md`, the session playbook, the antigravity `.xlsx` handbook). Davin
    confirmed live it was his authentic edit before any of it was trusted.
    **CONFIRM surfaced two items needing Davin's live word before execution, both resolved same
    session:** (1) Waiting-on #117 (no test credentials) — Davin scoped 9-0 to proceed as a design
    contract across all 5 roles + NON-LOGIN, with live authenticated click-through becoming an
    active requirement starting Session 9-3, not 9-0. (2) `seed-code/` drift beyond the order's own
    claim (`payouts/page.tsx` + `statements/page.tsx` carry a CSV-download DOM refactor and rebrand
    copy beyond the claimed F38 fee-bearer-only scope) — Davin confirmed both are his own intentional
    in-progress edits; kept as-is, `seed-code/**` treated as settled source of truth.
    **All three test baselines re-verified live, all green, exact match to 4A-15's own closing
    numbers:** monolith `tsc` clean; `eslint` (run directly, see finding below) 0 errors/5 warnings;
    `test:ci` 160/160 suites/2400/2400 tests. money-service 62/62 suites/526/526 tests (one transient
    timeout on the `prisma.shutdown.spec.ts` SIGTERM test on the first full run — reproduced clean
    in isolation and on a fresh full re-run; resource-contention flake, not a regression). operation-
    service 42/42 suites/393/393 tests.
    **Two real environment findings, neither pre-existing-knowledge, both disclosed rather than
    silently worked around:** `npm run eslint` doesn't exist in `package.json` (only `lint`/
    `lint:fix`) — order-text bug, worked around with `npx eslint` directly. More seriously,
    **`next lint` has been removed entirely from this Next.js version's CLI** (`next --help` lists
    no `lint` subcommand), so `npm run lint`/`next lint` both fail outright — new
    `LESSONS-LEARNED.md` **L38**; `package.json`'s `lint`/`lint:fix` scripts need fixing in a future
    session, not this one (out of a CONTRACT/no-code session's scope).
    **Execution produced `docs/migration-orders/frontend-swap-route-map.md`** — all 97 census rows
    mapped in both directions (zero unmapped), each naming its target layout boundary, session
    owner, real backing endpoint (or an explicit GAP where none exists yet), auth gate, tier gate,
    and S/M/L effort. **Two real backend gaps found and disclosed, not fabricated around:**
    `/affiliate/dashboard/payouts` and `/statements` (9-7b) have no self-service backing endpoint at
    all — only admin-side `/api/disbursement/*` exists; `/admin/system/jobs` and `/admin/system/
outbox` (9-8a) have no list/GET route, only `/[jobId]/trigger` and `/retry` action sub-routes.
    Both flagged in the route-map's own gap inventory as work Sessions 9-7b/9-8a must build, not
    just bind. **One inherited-claim correction:** `middleware.ts` is NOT a no-op as the roadmap's
    Batch-0 findings describe it — live read shows real country-prefix URL-rewrite + locale-cookie
    logic; what it genuinely lacks is auth/session gating only. **One stale-citation correction:**
    the census's row 26 (`admin/login`) and row 86 (`test-api`) both cite codebase-1 source paths
    that no longer exist on disk (`app/admin` is fully gone per F62's Session 6-2 merge, not just
    `admin/login`; `test-api` confirmed deleted at Session 6-12) — dispositions unchanged (retire
    both), just corrected the evidence trail. Session-sizing table confirms the roadmap's own flags
    that 9-4, 9-7b and 9-8 are likely over the ~4h split threshold, and adds the concrete reason for
    9-7b/9-8a specifically (a real backend gap to build, not just page count).
    **Docs-reorg residual (Step 6) was already resolved before this session touched anything** —
    `git status docs/` showed zero untracked files/deletions; the roadmap §5-cited items no longer
    exist in the working tree.
    **Artifacts updated:** `9-0-frontend-swap-contract-decisions.migration-order.md` (Status →
    CONFIRMED, executed — Deviations to be filled at formal CLOSE), `DECISION-LOG.md` (F65 RESOLVED,
    F66 RESOLVED, both full detail inline — register table + dedicated entries), `frontend-swap-
route-map.md` (new — the phase's binding contract), `LESSONS-LEARNED.md` (L38), this file
    (Current/Previous rotation — Session 4A-14 moved to `history/sessions-archive.md`).
    `migration-cutover-table.md` and `migration-stack-analysis.md` were reviewed and correctly
    need no changes (no route/slice moved, no files created/moved/deleted — only doc files were
    added under `docs/migration-orders/`, which isn't a stack-analysis entry).
    **Session-close pass (same day, 2026-08-22): `9-1-root-shell-design-system.migration-
order.md` PRE-DRAFTed.** Grounded in `frontend-swap-route-map.md` plus a full read of
    `codebase-2-parity-audit/batch-0-shared-shell.md` (not just its citation) — surfaced two real
    corrections to this session's own route map, amended directly rather than left stranded in
    9-1's order alone: **(1)** a "6 Protected pages" constraint (`/`, `/terminal`, `/free`,
    `/dashboard`, `/settings/appearance`, `/settings/help` — Davin, live, 2026-08-17) that nothing
    in Phase 9 planning had surfaced before now, since every one of them renders through
    `AppHeader`/`ChatSidebar`, which 9-1 is about to build; **(2)** the route map's own gap-6e
    entry ("distributed — each session fixes its own files") was wrong — the 38-file
    hardcoded-dark-mode bug's root files render on 5 of the 6 Protected pages, so no downstream
    session can fix "its own files" in isolation; 9-1 owns it. **A third, independent finding**:
    the monolith is pinned to `tailwindcss@^3.3.0` (classic config file) while codebase 2 is on
    `tailwindcss@^4.1.9` (CSS-first, no config file) — a real version decision nothing in Phase 9
    planning names. All three carried into 9-1's PRE-DRAFT as Open Questions 1-3 (left for the
    Advisor/Davin, per PD1 — not decided by the Executor at PRE-DRAFT) and amended into
    `frontend-swap-route-map.md` §3/§5 with dated addenda. New `LESSONS-LEARNED.md` **L39** on the
    underlying pattern (citing a source secondhand vs. reading it in full).
    **Artifacts updated (this pass):** `frontend-swap-route-map.md` (§3 items 6-8, §5 gap-6e/gap-10
    correction), `9-0-…migration-order.md` (Deviation 10), `LESSONS-LEARNED.md` (L39),
    `9-1-root-shell-design-system.migration-order.md` (new, Status: PRE-DRAFT).
    **Committed and pushed to `origin/main`** at Davin's explicit request — see git log for exact
    commit(s).
- **Previous:** Session 4A-15 (Wise + Outbox Defect Sweep, Phase 4X, PORT, dial LOW), CONFIRMED,
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
