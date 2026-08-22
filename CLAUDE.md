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

- **Current:** Session 9-1 (Root Shell & Design System, Phase 9, UI-BUILD), CONFIRMED, executed,
  **CLOSED SUCCESSFUL** 2026-08-22. Second session of Phase 9 — every subsequent Phase 9 session
  (9-2…9-9) renders inside the root shell, design tokens, headers, sidebars, and providers landed
  here. Closes rows 92/93 of `frontend-swap-route-map.md` plus gap-inventory items 1, 2, 5, 6a-6e,
  10; fixes all 5 Batch-0 shared-shell findings.
  **CONFIRM found the by-now-familiar L3 pattern again** (20th+ recurrence): committed HEAD held
  only the bare PRE-DRAFT stub; working copy carried the full Advisor DRAFT→APPROVED upgrade.
  Davin confirmed live it was his authentic edit. **All test baselines re-verified live at CONFIRM,
  all green, exact match to 9-0's own close:** monolith `tsc` clean, `eslint` 0 errors/5 warnings,
  `test:ci` 160/160 suites/2400/2400 tests; money-service 62/62 suites/526/526 tests;
  operation-service 42/42 suites/393/393 tests. `seed-code/` found fully clean (better than the
  entry criterion's own "except 2 files" expectation — those 2 files were already committed by
  9-0's own close). Batch-0's two root-boundary fixes re-diffed byte-for-byte, still intact.
  **CONFIRM surfaced 6 corrections, all approved live by Davin before execution** (full detail in
  the order's own CONFIRM note): `lib/i18n/locale-resolver.ts` needed porting, not just citing
  (only existed in `seed-code/`); `--chart*` tokens stay runtime-dynamic, not static `globals.css`
  rules; `app/providers.tsx`'s `SessionProvider` was already live, to be preserved not rebuilt;
  the main repo's own `middleware.ts` already had the real auth gate (codebase 2's had the
  locale-rewrite half) — merge direction confirmed; gap-6e's residual (`chat-panel.tsx`,
  `market-comments-panel.tsx`, `settings/layout.tsx`) explicitly handed to Sessions 9-4/9-5, not
  silently dropped; `components/layout/header.tsx` (live, 9-4's to retire) is distinct from the
  dead `components/header.tsx` this session's Decision 5 deletes.
  **Mid-execution, a 7th finding not in any prior document, escalated to Davin rather than decided
  unilaterally:** wiring `ClientProviders` as literally described would have mounted seed-code's
  support-chat widget — its socket client points at an unset `NEXT_PUBLIC_SOCKET_CHAT_URL` (Phase
  14, unbuilt) and falls back to a hardcoded canned-response generator presented as a live "AI
  Support Specialist." Davin's live call: defer the whole widget to Phase 14, ship
  `ClientProviders` with only `LocaleProvider`+`AppearanceProvider` for now.
  **Execution found the main repo's own `components/providers/appearance-provider.tsx` already
  exists and is MORE complete than seed-code's version** (it additionally syncs `next-themes`'
  `setTheme()`) — preserved as-is rather than overwritten, which would have been a regression.
  Also found its sibling `components/providers/theme-provider.tsx` (hand-rolled) is dead code,
  zero importers — flagged, not deleted (only `components/header.tsx`'s deletion carried explicit
  go-ahead this session).
  **Real, disclosed architecture change:** `app/layout.tsx` now calls `cookies()`/`headers()` on
  every request — the whole app is dynamically rendered as of this session (previously the root
  layout was static-compatible). Direct, unavoidable cost of porting codebase 2's unified
  root-layout design; not re-optimized back to static this session, flagged for later if TTFB/
  build-time on marketing routes becomes a concern.
  **`AppHeader`/`ChatSidebar` rewritten from seed-code's hardcoded `slate-N`/`dark:bg-[hex]`
  classes onto semantic design tokens** — the actual Batch-0 "Light Clean Mode" fix for the two
  files the parity audit named; extended the identical treatment to `marketing-navbar.tsx`/
  `marketing-footer.tsx` (not in Batch-0's named list, but same defect pattern, same session's own
  Surface) so 9-2 doesn't rediscover it. Fixed the missing sidebar Help item directly inside this
  rewrite. Found and fixed a middleware-merge bug before commit (two early-return branches skipped
  the locale rewrite) via code-path tracing, not live testing. Found and fixed a CSP gap
  (`ipapi.co` blocked, breaking the newly-ported geo-detection) and a stale globals.css comment.
  **Regressed then fixed 3 test assertions** in `__tests__/pages/phase-6-exit.test.tsx` (intentional
  rebrand changed rendered copy — `test:ci` must never go backwards) and a latent test-infra gap
  (`LocaleProvider`'s real, un-mocked geo-IP `fetch` crashing the Jest worker on teardown) — new
  `LESSONS-LEARNED.md` **L40**, plus a recurrence note on **L22**.
  **Live-verified via dev server, not just `tsc`/`test:ci`:** all 4 currently-existing Protected
  pages (`/`, `/dashboard`, `/settings/appearance`, `/settings/help`, the last 3 via a real login
  using the login page's own test-credential autofill) render correctly under the new shell;
  `/terminal`/`/free` don't exist yet (Session 9-4's own new pages, confirmed via `ls`, nothing to
  verify there this session); all 3 middleware auth×locale interaction cases verified live; the 4
  new shared-chrome components smoke-tested together via a throwaway route, deleted before commit.
  **Also found and fixed, unrelated to this session's own scope but caught mid-close:**
  `DECISION-LOG.md` had drifted to 53,361 bytes, over its ~50KB size-gate target (should have been
  caught at this session's own OPEN) — ran the archival pass, moved F47/F65/F66's full entries to
  `history/decisions-archive.md`, and fixed F47's own detail-entry status header (stale at "OPEN"
  since 4A-W7 even though the register table and CLAUDE.md both already said RESOLVED — Session
  4A-15). Back to 48,988 bytes.
  **Artifacts updated:** `9-1-root-shell-design-system.migration-order.md` (Status → CONFIRMED →
  CLOSED SUCCESSFUL, CONFIRM note + 16 Deviations + checked Done-when/entry-criteria boxes),
  `DECISION-LOG.md` (size-gate archival pass), `history/decisions-archive.md` (F47/F65/F66 full
  entries), `migration-stack-analysis.md` (Session 9-1 entry, 15 new files/8 modified, all
  FRONTEND), `LESSONS-LEARNED.md` (L40, L22 recurrence — now at the 40-lesson cap, next lesson
  needs a consolidation pass first), this file (Current/Previous rotation — Session 4A-15 moved to
  `history/sessions-archive.md`). `migration-cutover-table.md` correctly needs no changes (Phase 9
  is additive builds, no route/slice moved).
- **Previous:** Session 9-0 (Frontend Swap Contract & Decisions, Phase 9, CONTRACT, no code),
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
