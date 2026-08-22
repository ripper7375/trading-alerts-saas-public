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

- **Current:** Session 9-2 (`(marketing)` 12 + `(public)` 2, Phase 9, UI-BUILD), CONFIRMED, executed,
  **CLOSED SUCCESSFUL** 2026-08-22. Third session of Phase 9 — ships all 14 route-map rows (1-2,
  3-4, 52-54, 63-64, 66, 69-70, 84-85, 91): the 12 `(marketing)` pages + 2 `(public)` account-
  deletion pages, the only pages that render without a session. `app/(marketing)/layout.tsx` now
  renders `MarketingNavbar`/`MarketingFooter` (built 9-1) instead of inline "Trading Alerts" chrome
  — the one `layout.tsx` boundary this session moves.
  **CONFIRM found the by-now-familiar L3 pattern again** (21st+ recurrence): committed HEAD held
  only the bare PRE-DRAFT stub; working copy carried the full Advisor DRAFT→APPROVED upgrade.
  Davin confirmed live it was his authentic edit. Also confirmed, in scope: the route-map addendum
  for rows 3-4 (recording `app/(public)/settings/account/delete/{cancel,confirm}/page.tsx` as the
  canonical target, correcting the table's stale `app/account/deletion-*` citation).
  **Landing page (row 1) needed far more than a content swap, escalated live before touching any
  file:** seed-code's landing page is a 6-component composition with its OWN `LandingNavbar`/
  `LandingFooter` (distinct from the shared `MarketingNavbar`/`MarketingFooter` the other 11 pages
  use) — porting verbatim would have quadruple-stacked chrome, the exact bug Decision 3 exists to
  prevent, from the opposite direction. Escalated via `AskUserQuestion`; Davin chose "strip
  seed-code's own chrome, keep the real affiliate pricing." The current live landing page had real,
  `SystemConfig`-backed affiliate-discount pricing (`useAffiliateConfig()`, `?ref=CODE`-driven
  banner + discount + commission calc) that seed-code's replacement lacked entirely — grafted
  forward into the new `components/landing/landing-pricing.tsx` rather than dropped; live-verified
  via dev server (`/?ref=TESTCODE` shows the real 20%-off banner and correct $29.00→$23.20 price).
  **The same "seed-code page looks like a restyle but silently regresses or fabricates data"
  pattern recurred twice more, independently, at higher stakes each time:** `/status` bound to the
  real 4-component `getSystemStatus()` (API/Database/Realtime/Payment Gateways) instead of
  seed-code's 6 fabricated components with invented static latency/uptime figures — live-verified
  this dev environment correctly shows "Some Systems Are Degraded," not a fabricated "All Systems
  Operational." `/pricing` + `TierComparison` bound to `lib/tier-config.ts`'s real
  `PRO_MONTHLY_PRICE` (Davin's explicit instruction) instead of seed-code's hardcoded $39/$49, and
  its feature list replaced seed-code's fabricated Stack D/E claims (multi-model AI chat, quad-RAG,
  a live market-comments feed — Phase 12/13 work, not built) with the real V8 entitlements. Flagged
  as a candidate lesson for the Advisor's attention — `LESSONS-LEARNED.md` is at its 40-entry cap,
  needs a consolidation pass before a 41st entry can be added; full candidate text in the order's
  own Deviation 11.
  **`components/chat-widget/*`'s Phase-14 deferral (decided at 9-1) reached further than that
  order anticipated:** seed-code's `/help` page and `landing-hero.tsx` both call
  `useSupportChat()` with no provider in the tree — neither ported as-is; `/help` gets a second
  real `mailto:` channel instead, the landing hero drops its chat-wired "Support Centre" sandbox
  entirely.
  **Account-deletion pages restyled, safety-critical logic untouched:** both pages already
  correctly implemented Decision 5's human-in-the-loop requirement before this session (predates
  the order); seed-code's own confirm page auto-executes the deletion in a `useEffect` on mount
  with zero confirmation step — explicitly not ported. Live-verified: confirm page fires ZERO
  `deletion-confirm` calls until clicked.
  **A real, pre-existing a11y gap found and fixed while porting `/docs`:** seed-code's expand/
  collapse toggle was a bare `<div onClick>` with an icon-only nested `<button>` (invalid HTML,
  button-in-button) and no `aria-expanded` at all. Converted to a real `<button aria-expanded>`.
  **Route-manifest diff clean:** `git diff --stat` across every commit this session touches only
  the 14 rows' own page files plus their non-route component/asset dependencies — zero pages
  created or dropped outside scope.
  **A genuine test regression found and fixed at Step 6, not just discovered and left:**
  `__tests__/pages/marketing/public-pages.test.tsx` (Session 6-10, written against the old
  "Trading Alerts" copy) broke on every one of its 10 content-bearing assertions once this
  session's rebrand landed, plus two mocking gaps this session's own new code exposed
  (`MarketingNavbar` needs `usePathname`, `StatusRefreshButton` needs `useRouter`+`useLocale`/
  `LocaleProvider`) — rewritten in full per `LESSONS-LEARNED.md` L3's "test:ci must never go
  backwards" rule and 9-1's own identical precedent; same 13 tests, same file, all green.
  **All test baselines re-verified live, all green, exact match to 9-1's own close:** monolith
  `tsc` clean, `eslint` 0 errors/5 warnings (pre-existing, none in touched files), `test:ci`
  160/160 suites/2400/2400 tests; money-service 62/62 suites/526/526 tests (one known
  `prisma.shutdown.spec.ts` SIGTERM flake — same one documented at 9-0's own CONFIRM,
  money-service untouched this session, reproduced clean in isolation); operation-service 42/42
  suites/393/393 tests.
  **Live-verified via dev server, not just `tsc`/`test:ci`:** all 14 routes smoke-tested — single
  `<header>`/`<footer>` each, correct content, zero console errors; `/status`'s refresh button
  triggers a genuine `router.refresh()` server round-trip (`SELECT 1` re-ran); the account-deletion
  cancel page's real dual-mode auto-fire POSTs and fails gracefully to a styled error state only
  because `operation-service` isn't running in local dev (`ECONNREFUSED`, not a page defect).
  **Artifacts updated:** `9-2-marketing-public-pages.migration-order.md` (Status → CONFIRMED →
  CLOSED SUCCESSFUL, 11 Deviations + checked Done-when/entry-criteria boxes), `frontend-swap-
route-map.md` (§3 dated addendum for rows 3-4), `migration-stack-analysis.md` (Session 9-2 entry,
  7 new files/15 modified/1 deleted, all FRONTEND), `LESSONS-LEARNED.md` (L3 recurrence bump to
  21st+; candidate lesson flagged, not written — file at 40-entry cap), this file (Current/Previous
  rotation — Session 9-0 moved to `history/sessions-archive.md`). `migration-cutover-table.md`
  correctly needs no changes (Phase 9 is additive builds, no route/slice moved).
- **Previous:** Session 9-1 (Root Shell & Design System, Phase 9, UI-BUILD), CONFIRMED, executed,
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
