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

- **Current:** Session 9-10 (Phase 9 Exit, VERIFY-RETIRE + Deviation 1 admin-layout retirement),
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
- **Previous:** Session 9-9 (`app/(dashboard)/admin/disbursement/*`, Phase 9, UI-BUILD), APPROVED,
  CONFIRMED, executed, **CLOSED SUCCESSFUL** 2026-08-23. Twelfth session of Phase 9 — ships the
  disbursement nested layout and all 10 of its rows: 22 (`/admin/disbursement`), 13 (`/accounts`,
  confirmed redirect to `/recipients`), 15 (`/affiliates`), 14 (`/affiliates/[affiliateId]`), 16
  (`/audit`), 18 (`/batches`), 17 (`/batches/[batchId]`), 19 (`/config`), 20 (`/recipients`), 21
  (`/transactions`) — completing all 29 `app/(dashboard)/admin/*` rows repo-wide.
  **CONFIRM found the by-now-familiar L3 pattern again** (committed HEAD held the bare PRE-DRAFT
  with 5 open questions; the corrected, 5-decision, `Status: APPROVED` version existed only as an
  uncommitted working-copy edit) and **three genuine order-vs-live-code conflicts, all resolved by
  Davin live in the same message as "go" (the seventh time this loop has visibly closed the
  Advisor↔Executor gap PD1 exists to bridge, after 9-5, 9-6, 9-7a, 9-7b, 9-8a, 9-8b):** (1) Row
  19's `PATCH /api/disbursement/config` is a self-documented no-op placeholder (validates, logs,
  persists nothing) while the order's own Verify line implied a real write — kept the placeholder,
  tightened the page's own doc comment/success message/banner to disclose plainly that nothing
  persists (not just the provider), wrapped Save in an `<AlertDialog>` restating that. (2)
  `POST /api/disbursement/pay` (Quick Payment, Row 15) was a real batch-create-and-execute action
  not named in the order's Feeds-on list or its AlertDialog enforcement list — folded into
  Decision 4's scope, wrapped in `<AlertDialog>` showing affiliate + amount (low real-money risk
  as wired: the UI never sends a `provider` param, and `RISE` — the only other value the route
  accepts — is deactivated per F42). (3) `DECISION-LOG.md`'s 51,947-byte size-gate overage checked
  and found not actionable — all resolved-flag narratives already archived by prior sessions; the
  overage is inherent to F80's still-OPEN entry, which must stay inline.
  **A fourth, genuinely new conflict found mid-execution, escalated separately (not part of
  CONFIRM):** Row 20's planned Wise-recipient-revalidate `<AlertDialog>` (Decision 4) targets
  `POST /api/wise/recipients/[id]/revalidate`, which reading the route found is
  `requireAffiliate()`-guarded and self-service-only — it derives the target recipient from the
  caller's own token, using `:id` only for an ownership check, not a lookup key. Wiring it into
  the admin page as-is would 403 for a non-affiliate admin or silently revalidate the admin's own
  recipient instead of the target affiliate's — an auth-semantics conflict, stopped and asked
  Davin live per `EXECUTOR-PROTOCOL.md` §7 rather than build a new admin-scoped backend route (out
  of this UI-BUILD session's dial) or wire the mismatch anyway. Davin: drop it from this session.
  Registered `DECISION-LOG.md` **F81**; Row 20 ships restyled but stays read-only for Wise
  recipients, matching its pre-session behavior.
  **Money Safety Protocol live-verified for real, not just rendered:** seeded two throwaway
  `PaymentBatch` fixtures (provider `MOCK`, zero external calls) to exercise the Execute and
  Delete `<AlertDialog>`s end-to-end — both dialogs render the real batch number/payment
  count/amount/provider, Cancel closes without firing, and the real confirm action round-trips
  through the actual API (Execute: batch status PENDING→COMPLETED via `PaymentOrchestrator`;
  Delete: real DB delete + `router.push` redirect, confirmed via the batches list going back to
  0). Both fixtures cleaned up after. `money-service`'s Wise integration confirmed genuinely
  sandboxed (`WISE_ENVIRONMENT=sandbox`, Test profile `29617748`) before any of this, so a real
  WISE-provider execute — not exercised this session, no real batches existed to test with — would
  also have been safe.
  **Two more findings surfaced by that same real click-through, both pre-existing, fixed inline:**
  (1) `GET /api/disbursement/batches/[batchId]` returns `transactions`/`auditLogs` as siblings of
  `batch`, not nested inside it — Row 17's `fetchBatch()` did `setBatch(data.batch)` alone, so
  `batch.transactions` was `undefined` for every batch, not just empty ones, crashing the page
  (`Cannot read properties of undefined (reading 'filter')`) the instant it was pointed at real
  data. Never caught before because `PaymentBatch` had zero rows in this DB until this session's
  own seeded fixtures — registered as a recurrence of `LESSONS-LEARNED.md` L15 ("never-exercised
  code carries a latent bug"), not a new lesson (file is at its 40-entry cap). (2) three `Badge`
  instances picked up `bg-muted` from the session's own bulk sed pass but no matching text-color
  override, leaving them on the Badge default variant's `text-primary-foreground` — a real
  contrast bug on a muted background; added `text-muted-foreground`, verified both light/dark
  `--muted`/`--muted-foreground` CSS variable pairs have solid built-in contrast.
  **A dev-environment blocker, not a code defect:** port 3000 was held by a stale, orphaned
  `node.exe` from a prior session (same environment-gap class as `LESSONS-LEARNED.md` L42, not
  itself a new recurrence worth logging there) — Davin confirmed it was safe to kill, freeing the
  port for this session's own live verification against the real `NEXTAUTH_URL` origin.
  **All test baselines re-verified live, all green, exact match to entry-criterion baseline:**
  monolith `tsc` clean, `eslint` 0 errors/2 warnings (down from 3 — this session's
  `window.location.href`→`router.push()` fix on Row 17's delete handler closed one pre-existing
  warning), `test:ci` 160/160 suites/2400/2400 tests (unchanged — no test files touched, only
  production code); money-service 62/62 suites/526/526 tests and operation-service 42/42
  suites/393/393 tests (both re-verified fresh at CONFIRM, unaffected by this session's
  frontend-only changes).
  **Route-manifest diff clean:** `git diff --stat` against the session's own start commit
  (`2c728ba4`) confirms exactly the 10 rows' pages restyled + 1 modified layout — zero unrelated
  route changes, zero new/deleted files (all 10 pages already existed on disk per Decision 3).
  **`migration-stack-analysis.md` correctly needs no changes** (no files created/moved/deleted —
  pure restyle-in-place). `migration-cutover-table.md` correctly needs no changes (Phase 9 is
  additive builds, no route/slice moved).
  **Artifacts updated:** `9-9-admin-disbursement.migration-order.md` (Status → CONFIRMED → CLOSED
  SUCCESSFUL, 2 Deviations + checked Done-when/entry-criteria boxes), `DECISION-LOG.md` (F81
  registered, OPEN), `LESSONS-LEARNED.md` (recurrence note on L15, no new lesson — stayed at the
  cap), this file (Current/Previous rotation — Session 9-8a moved to
  `history/sessions-archive.md`). Session 9-10's order (Phase 9 exit, VERIFY-RETIRE) PRE-DRAFTed
  per this session's own obligation.

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
