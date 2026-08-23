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

- **Current:** Session 10-1 (Drawing Engine & Line-Alert Live Smoke Test, Phase 10, INFRA/VERIFY),
  APPROVED, CONFIRMED, executed, **CLOSED SUCCESSFUL** 2026-08-23. Resolves **F67** (smoke-test
  execution environment) — Phase 10's own "one remaining unverified link": a real, live,
  cross-process round trip from a price-cross through the alert worker to a real DB write,
  realtime relay, and browser delivery.
  **Both `⚠ NEEDS EXPLICIT SIGN-OFF` decisions confirmed separately by Davin, live in chat, distinct
  from the order's general approval** (per `EXECUTOR-PROTOCOL.md` §0): Option B (local
  `operation-service` HTTP+worker against the already-reachable dev Redis/Postgres, not Contabo VPS
  or Railway scratch) as the primary environment, and a deterministic synthetic Redis price
  publisher (not passive live MT5 ticks) as the crossing-trigger mechanism.
  **L3 pattern again, benign:** committed HEAD held the bare `Status: PRE-DRAFT` order (no
  `Decisions taken` section); the corrected `Status: APPROVED` version (4 Decisions, Davin's
  approval line) existed only as an uncommitted working-copy edit — confirmed authentic by Davin
  live, committed at session open.
  **Two real defects found and fixed live, both disclosed, neither a drive-by:**
  **1) `nest-cli.json`'s `deleteOutDir: true` races `start:dev` watch mode against
  `start:worker`'s static `node dist/main-worker`.** Booting per the order's literal `npm run
start:dev` crashed the worker (watch-mode rebuild wiped `dist/` mid-require of
  `./alert-engine/alert-cron.scheduler`). Fixed by running one clean `npm run build` then booting
  BOTH processes statically (`node dist/main` + `node dist/main-worker` — the order's own text
  already sanctions this as equivalent). **2) CSP `connect-src` never allowed the local
  `operation-service` origin, only its production Railway one** (same bug class as F54, just for
  localhost) — browser WS connections to `ws://localhost:3001` were blocked before the handshake
  could start. Minimal fix (`next.config.js`, added `http://localhost:3001`/`ws://localhost:3001`),
  restarted, re-verified: `RealtimeGateway` logs `Client <id> authenticated as user <userId>`.
  **All 4 Invariant Proofs verified live:** (1) worker log `dispatching fire`/`fire dispatched`
  with correct correlationId; (2) Postgres `Notification` row created
  (`"Price 2005 touched line @ 2000"`) + `Alert.triggerCount` incremented; (3) `RealtimeGateway`
  relayed with zero malformed-payload rejection; (4) browser confirmed connected+authenticated in
  the right room and `GET /api/notifications` matched the fired row — **the chart-canvas marker's
  visual rendering could not be confirmed**, because `/terminal`'s separate OHLCV candlestick feed
  (`mt5-service`'s own Flask-SocketIO server, `ws://localhost:5001`) was never in this session's
  scope/running (no candle data loaded at all, independent of alerts). Escalated live per
  `EXECUTOR-PROTOCOL.md` §7; **Davin approved accepting the confirmed WS-delivery evidence as
  sufficient**, registering the visual check as a follow-up rather than a session blocker.
  **Cooldown and one-shot both verified live, DB- and Redis-state-confirmed:** cooldown —
  `triggerCount` held at 1 across an immediate re-cross 2.5s later, `alert:cd:<id>:line` confirmed
  present in Redis with active TTL; one-shot — fired once (`triggerCount: 1`, `isActive: false`),
  a second crossing well past its own 5s cooldown produced zero further fire
  (`alert:fired:<id>` guard).
  **One incidental, real Prisma `P2028`** ("Unable to start a transaction in the given time") on
  the first fire-dispatch attempt, root-caused to this session's own concurrent load (monolith dev
  server + both operation-service processes + several ad-hoc diagnostic scripts against the same
  shared pooled dev Postgres) — reproduced standalone, confirmed slow-but-working (3.5s) with an
  extended timeout, resolved by reducing concurrent load and retrying; no production code touched.
  Registered as a recurrence on `LESSONS-LEARNED.md` L24 (stayed at the 40-entry cap).
  **One new, real, disclosed data-hygiene defect found during test-fixture cleanup, registered as
  `DECISION-LOG.md` F82** (not fixed here — out of this INFRA/VERIFY session's scope, doesn't
  block the smoke test): `DELETE /api/drawings/:id` cascades `Drawing → DrawingAlert` but never
  touches the `Alert` row itself — every deleted line-alert-bearing drawing leaves a permanently
  orphaned `PRICE_TOUCH_LINE` `Alert` row. Reproduced 4/4 times cleaning up this session's own
  fixtures; cleaned up manually. Flagged for Session 10-2 (API coverage for `/api/drawings`) to
  catch with a real assertion.
  **All test fixtures cleaned up, DB and Redis left clean:** 4 test drawings deleted via the real
  API (cascading their `DrawingAlert` rows), the 4 resulting orphaned `Alert` rows deleted manually
  (F82 above), all test `Notification` rows deleted, Redis state keys for all 4 test alertIds
  cleared, worker confirmed back to `watches loaded: 0 rows`. Both `operation-service` processes
  and the monolith dev server stopped cleanly at close — no stray background processes left
  running.
  **All baselines re-verified fresh, post-session, zero regressions from this session's own
  `next.config.js` CSP change:** monolith `test:ci` 153/153 suites/2198/2198 tests;
  `operation-service` 42/42 suites/393/393 tests; money-service 62/62 suites/526/526 tests
  (untouched, unaffected).
  **`migration-cutover-table.md` and `migration-stack-analysis.md` correctly need no changes**
  (no route/slice moved, no files created/moved/deleted — `next.config.js` was modified in place;
  Slice 6's own cutover-table row already correctly notes `MIGRATE_ALERT_ENGINE` has no reader,
  independently re-confirmed this session).
  **Artifacts updated:** `10-1-drawing-alert-smoke.migration-order.md` (Status → CONFIRMED →
  CLOSED SUCCESSFUL, 6 Deviations + checked Done-when/entry-criteria boxes), `DECISION-LOG.md`
  (F67 resolved, F82 registered OPEN), `LESSONS-LEARNED.md` (recurrence note on L24, no new lesson
  — stayed at the cap), this file (Current/Previous rotation — Session 9-9 moved to
  `history/sessions-archive.md`). Session 10-2's order PRE-DRAFTed per this session's own
  obligation (`10-2-e2e-api-coverage.migration-order.md`) — 4 open questions flagged for the
  Advisor at DRAFT, most load-bearing: the chart-marker visual gap (`mt5-service`'s OHLCV socket
  server, out of scope in 10-1) directly blocks 10-2's own stated e2e success criterion and needs
  a real resolution, not another reduced-evidence acceptance, since a Playwright assertion needs a
  concrete checkable condition.
- **Previous:** Session 9-10 (Phase 9 Exit, VERIFY-RETIRE + Deviation 1 admin-layout retirement),
  APPROVED, CONFIRMED, executed, **CLOSED SUCCESSFUL** 2026-08-23. **Phase 9 (Frontend Stack
  Replacement) is now CLOSED** — all 10 build sessions (9-1 through 9-9) plus this exit review
  are complete; all 85 CB1 routes live on real data, zero mock data outstanding (2 disclosed
  exceptions, both pre-known and banner-flagged), Phase 10 (Drawing Engine & Line-Alert Closure)
  is next.
  **CONFIRM found a real, blocking defect before "go":** `/admin/**` (all 29 routes) rendered
  double chrome — the legacy codebase-1 `Header`/`Sidebar`/`Footer` (still "Trading Alerts"-
  branded, hardcoded `bg-white dark:bg-gray-800` footer) wrapping the DavinTrade `admin/
layout.tsx` shell 9-8a built. Live browser measurement, not inference: 2 `<header>`s at
  offsetTop 0/153, 1 legacy `<footer>` at offsetTop 1650 on a 1718px page, both fully visible
  (`display:block`, non-zero heights). Root cause: Session 9-4 reverted
  `app/(dashboard)/layout.tsx` to its legacy form specifically to keep serving `/admin/*` +
  `/charts` after the new-shell mount broke them live (9-4's own Deviation 13); Session 9-5 gave
  `/settings` the correct top-level-route fix, `/admin` never got the same — `migration-stack-
analysis.md`'s own 9-4 entry predicted exactly this, flagging the legacy shell as "fully
  orphaned... flagged for Session 9-10's own dead-code exit criterion." Davin approved (live in
  chat) folding the real fix in as a scoped Deviation rather than a separate session, plus 3
  further explicit decisions, all executed:
  **1) Admin layout retirement** — `app/(dashboard)/admin` → `app/admin`, `app/(dashboard)/
charts` → `app/charts` (git mv, zero relative imports broken in either subtree),
  `app/(dashboard)/layout.tsx` deleted, the route group retired entirely. `app/admin/layout.tsx`
  gained the same `AppearanceProvider`+`LoginTracker`+`TokenRefreshProvider` wrapper every other
  top-level protected layout uses (`app/dashboard`, `app/settings`, `app/terminal`, `app/free`),
  plus `aria-label` on its nav/aside landmarks. Live-reverified post-fix: `/admin`, `/admin/users`
  now render exactly 1 header/1 aside/1 main (was 2/2/2); `/admin/disbursement/*`'s own 2-level
  chrome (admin nav + disbursement sub-nav) confirmed as pre-existing Session 9-9 design, not a
  regression; `/charts` + `/charts/[symbol]/[timeframe]` still correctly redirect to `/terminal`;
  zero "Trading Alerts" text left anywhere in the admin render tree. 5 `__tests__/pages/admin/
*.test.tsx` import paths repointed from the retired `(dashboard)/admin` path.
  **2) Dead codebase-1 cleanup, two batches, both zero-importer-verified immediately before
  deletion (not solely trusting the CONFIRM-time audit):** batch 1 —
  `components/layout/{header,sidebar,footer,mobile-nav}.tsx` (the double-chrome culprit itself,
  genuinely orphaned once the shared layout was gone) + their 1 test file (33 tests). Batch 2 —
  `components/billing/subscription-card.tsx` (F64's known broken-Undo dead code),
  `components/alerts/{alert-card,alert-list}.tsx` (orphaned pair, superseded by `AlertsClient`
  pre-Phase-9), 12 legacy `components/admin/*.tsx` (superseded by 9-8b's inline builds) + 6
  orphaned test files, and `components/notifications/notification-bell.tsx` — Davin's explicit
  choice to retire (delete) rather than wire into `AppHeader`, a **disclosed functional
  regression** (real-time notification-bell UI has had no home since the chrome swap), not a
  silent removal. `components/admin/{FraudAlertCard,FraudPatternBadge}.tsx` (9-8b, live)
  explicitly not touched.
  **3) Route map + gap matrix docs:** `frontend-swap-route-map.md` rows 45/46 Session column
  corrected `9-7a`→`9-7b` (confirmed via `git log` commit `05c10b89`); rows
  49/50/51/57/58/59/62/68 (9-4's own rows) Main-Repo-Target/Layout-Boundary columns corrected to
  their real shipped top-level paths — both drifts existed before this session, from live
  reassignments/corrections that were never written back into the map. New addendum #9 documents
  this session's own admin+charts promotion; the ~40 admin/disbursement row citations were left
  as historical record per the map's own established convention rather than individually
  rewritten. `phase-6-frontend-gap-matrix.md` marked `SUPERSEDED-BY-PHASE-9`, historical content
  preserved intact.
  **4) Multi-theme sweep + final baseline:** every route in the order's own checklist item 4 spot-
  checked in dark AND light mode (light via direct `documentElement` class verification after
  confirming the per-user persisted `UserAppearance.theme` legitimately overrides a fresh
  client-side hint — not a bug) — zero regressions, zero new console errors (only pre-existing
  dev-only HMR/CSP-blocked-localhost-socket noise from `operation-service` not running locally).
  **Final baseline, fresh and full-scope, exact reconciliation of every count:** monolith `tsc`
  clean; `eslint` **0 errors/0 warnings** (down from the 2-warning entry baseline — both were in
  the now-deleted `header.tsx`, a genuine improvement); `test:ci` 160→159 (-1, header.test.tsx)
  →153 (-6, the 6 dead-component tests) suites, 2400→2367 (-33)→2198 (-169) tests, every drop
  fully explained by a real deletion, zero unexplained failures; money-service 62/62 suites/
  526/526 tests (unchanged); operation-service 42/42 suites/393/393 tests (unchanged).
  Route-manifest diff clean: 90 `page.tsx` files before and after (renames only), zero
  duplicate-URL collisions repo-wide.
  **One incidental finding, not fixed (unrelated file, out of scope):** `/terminal`'s `<title>`
  renders "Terminal | DavinTrade | DavinTrade" (double suffix — `app/terminal/page.tsx`'s own
  `metadata.title` already includes `| DavinTrade`, root layout's template appends a second one),
  pre-existing since Session 9-4 — a one-line fix for whichever session next touches that file.
  **A git-state note, not itself an issue (L3 pattern, benign):** committed HEAD held this
  session's own bare `Status: PRE-DRAFT` order; the corrected, upgraded `Status: APPROVED`
  version (with the fuller 9-item checklist) existed only as an uncommitted working-copy edit —
  confirmed authentic and committed at session open, per L3's own established resolution.
  **`DECISION-LOG.md` size-gate check (EXECUTOR-PROTOCOL.md §1 step 0): 63,589 bytes, over the
  ~50KB target — checked and found not actionable, same conclusion as 9-9's own check.** All
  RESOLVED flags already point to `history/decisions-archive.md`; the overage is inherent to F80
  and F81 both still being genuinely OPEN and needing to stay inline per the file's own hygiene
  rule. No archival performed. F65/F66 re-confirmed RESOLVED; F81 re-confirmed OPEN (unchanged,
  held for a future admin-scoped-endpoint session).
  **Artifacts updated:** `9-10-phase-9-exit.migration-order.md` (Status → CONFIRMED → CLOSED
  SUCCESSFUL, 4 Deviations + checked Done-when/entry-criteria boxes), `frontend-swap-route-map.md`
  (rows 45/46 + 9-4's rows corrected, addendum #9), `phase-6-frontend-gap-matrix.md` (superseded
  banner), `migration-stack-analysis.md` (Session 9-10 entry, 0 new/36 renamed+6 modified/22
  deleted, all FRONTEND — also backfills that Session 9-9 correctly needed no entry, pure
  restyle-in-place), this file (Current/Previous rotation — Session 9-8b moved to
  `history/sessions-archive.md`). Session 10-1's order PRE-DRAFTed
  (`10-1-drawing-alert-smoke.migration-order.md`) per this session's own obligation — INFRA/VERIFY,
  F67 (execution environment: Contabo VPS / local Docker / Railway scratch) posed as an open
  `⚠ NEEDS EXPLICIT SIGN-OFF` decision for the Advisor/Davin, not resolved here per
  `EXECUTOR-PROTOCOL.md` §7; the order also flags that `PHASE-4-SMOKE-TEST-RUNBOOK.md` is
  monolith-era and stale (alert-engine moved to `operation-service` at 4B-2/4B-3) and must be
  re-derived from live code, not followed literally.

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
