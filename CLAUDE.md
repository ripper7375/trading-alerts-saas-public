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

- **Current:** Session 9-8b (`app/(dashboard)/admin/*` affiliates cluster, Phase 9, UI-BUILD),
  CONFIRMED, executed, **CLOSED SUCCESSFUL** 2026-08-23. Eleventh session of Phase 9 — ships
  route-map rows 11 (`/admin/affiliates`), 5 (`/admin/affiliates/[id]`), 6–10 (the 5 affiliate
  reports: code-flows, code-inventory, commission-owings, profit-loss, sales-performance), 25
  (`/admin/fraud-alerts`), 24 (`/admin/fraud-alerts/[id]`), 27 (`/admin/settings/affiliate`), 96
  (`/admin/resources`, new). Davin authorized execution live in chat after CONFIRM, resolving all
  3 CONFIRM findings in the same message as "go" (the sixth time this loop has visibly closed the
  Advisor↔Executor gap PD1 exists to bridge, after 9-5, 9-6, 9-7a, 9-7b, 9-8a).
  **CONFIRM found the by-now-familiar L3 pattern again** (committed HEAD held the bare PRE-DRAFT
  with 5 open questions; the corrected, 5-decision, `Status: APPROVED` version existed only as an
  uncommitted working-copy edit) and **three genuine order-vs-live-code conflicts, all resolved by
  Davin before execution:** (1) the order's own `admin/resources/[id]` citation claimed
  `PATCH/DELETE`, but live code (route + the `lib/marketing-resources/service.ts` service layer)
  only ever supported `GET/POST` + `DELETE` — no update capability exists anywhere in the stack;
  corrected the citation rather than inventing a fake edit feature. (2) `app/api/admin/
fraud-alerts/route.ts` and `.../[id]/route.ts` (this session's own Rows 24/25) still used the
  pre-9-8a inline `session.user.role !== 'ADMIN'` JWT check, bypassing 9-8a's own `requireAdmin()`
  DB-fallback fix — untouched since Session 2-4, predating that fix entirely; modernized both to
  `requireAdmin()` in the same pass. (3) zero seeded `FraudAlert` rows existed in the DB, so
  Row 24/25's own required live click-through couldn't exercise the real `PATCH` review actions —
  seeded one test fixture (`MULTIPLE_FAILED_PAYMENTS`, tied to `free-test@trading-alerts.test`)
  before verification.
  **Live-verification finding, not caught at CONFIRM:** the first real click on `POST
  .../distribute-codes` 500'd (`ECONNREFUSED` in `lib/money-service/client.ts`) —
  `money-service` wasn't running locally, the third recurrence of `LESSONS-LEARNED.md` L42's
  environment-gap class (after 9-6, 9-8a); started via the existing `moneyservice` launch config,
  identical action succeeded (200 OK) on retry, confirmed via the affiliate's own codes count
  moving 15 → 25 in the live DB.
  **A second live-verification finding, fixed inline:** `PATCH /api/admin/fraud-alerts/[id]`'s
  `updatedAlertUser` Prisma select omitted `tier` (GET's own select includes it) — pre-existing
  since the route was written, untouched by this session's own auth-modernization change to the
  same file. Surfaced live: the Tier field flipped to "Unknown" after clicking Mark Reviewed.
  One-line fix.
  **A pre-existing action found mid-restyle, not in the order's own Feeds-on list:**
  `commission-owings`'s "Pay Commissions" button (native `prompt()`-based) calls a real, working
  `POST /api/admin/commissions/pay` — read the route before touching it: pure DB bookkeeping
  (marks existing `Commission` rows `PAID` with an admin-entered method/reference inside a
  transaction), no payment-provider call, no real fund movement, so no §7 escalation triggered.
  Restyled and moved to `<AlertDialog>` with real validation, consistent with the session's own
  established pattern.
  **`<AlertDialog>` (`components/ui/alert-dialog.tsx`, the same primitive 9-8a used for jobs/
  outbox) replaces native `confirm()`/`prompt()` across every consequential write action this
  session touched:** affiliate suspend (with reason)/reactivate/distribute-codes (with count +
  reason), fraud-alert Block User (the one action of the three — alongside Mark Reviewed/Dismiss
  — that performs a real account mutation, `blockUserFromFraudAlert()` sets `isActive: false`),
  code-inventory's cancel-code, commission-owings' pay-commissions, and the new resources page's
  delete-asset. All live-verified round-tripping for real except Block User itself, deliberately
  not confirmed on the seeded fixture (would deactivate `free-test@trading-alerts.test`, a shared
  account reused across many prior sessions' own fixtures, incl. F79/F80's own test subject) —
  the identical dialog pattern was already proven three times over elsewhere in the same session
  (Suspend, Distribute, Cancel-code), so Block User's dialog copy/mechanics were verified without
  confirming it.
  **`admin/resources` (Row 96, new) ported with real Vercel Blob-backed CRUD, not mock state:**
  list/filter/search bound to `GET /api/admin/resources`, upload via a real multipart `Dialog`
  form to `POST /api/admin/resources`, delete via `AlertDialog` to `DELETE .../[id]`. Seed-code's
  own `AppHeader`/`AdminNav` dropped (the admin layout already provides that chrome) and its
  fabricated "CDN Delivery Status: Edge Optimized" stat card not ported (Zero Mock Data) — 3 real
  stat cards instead of 4. A self-caught bug in the copy-link handler (mishandled already-absolute
  Vercel Blob URLs) was found and fixed before live verification touched that path, same fix shape
  as `LESSONS-LEARNED.md` L30.
  **A fourth browser-automation tooling gotcha found, registered as an addendum to
  `LESSONS-LEARNED.md` L43 rather than a new lesson** (file is at its 40-lesson cap): `computer`
  `left_click` on a `ref` silently failed to register a real click several times (no error, no
  effect) even with the pane displayed and a fresh `read_page` immediately beforehand, while other
  `computer` clicks in the same session worked fine — no reliable trigger found.
  `element.click()` via `javascript_tool` never failed as the workaround.
  **Two Jest assertions needed re-deriving, not reverting, per `LESSONS-LEARNED.md` L3/L18:**
  `fraud-pattern-badge.test.tsx`/`fraud-alert-card.test.tsx` checked for the legacy hardcoded
  `bg-*-100`/`text-*-800`/`text-*-600` classes this session's own Decision 5 intentionally
  replaced with theme-reactive `bg-*-500/10`/`text-*-500`/`text-muted-foreground` tokens —
  updated to match the real, intentional new classes.
  **All test baselines re-verified live, all green, exact match to entry-criterion baseline:**
  monolith `tsc` clean, `eslint` 0 errors/3 warnings (unchanged), `test:ci` 160/160 suites/
  2400/2400 tests (re-run twice — the 9 failures from the badge/card token change resolved by the
  test fixes above, confirmed clean on the second pass); money-service 62/62 suites/526/526
  tests; operation-service 42/42 suites/393/393 tests.
  **Route-manifest diff clean:** `git diff --stat` against the session's own start commit
  (`086a69c6`) confirms exactly the 10 rows' pages restyled + 1 new page (`admin/resources`) + 1
  modified layout (nav item) + 2 modified API routes (fraud-alerts auth + tier fix) + 2 modified
  shared components (`FraudAlertCard`, `FraudPatternBadge`) + 2 test files — zero unrelated route
  changes.
  **Live side effects deliberately left in place, not reverted** (the real round-trips Step 6
  requires): `free-test@trading-alerts.test`'s affiliate profile now has 25 codes (15 → 25 via
  distribute, one cancelled, net status `ACTIVE` after a suspend→reactivate round-trip — matching
  its state before this session); one seeded `FraudAlert` fixture transitioned `PENDING` →
  `REVIEWED`.
  **`DECISION-LOG.md` needed no changes** — no registered flag was touched or resolved this
  session (all 3 CONFIRM findings and both live findings were resolved inline within scope, not
  flag-worthy). `migration-cutover-table.md` correctly needs no changes (Phase 9 is additive
  builds, no route/slice moved).
  **Artifacts updated:** `9-8b-admin-affiliates.migration-order.md` (Status → CONFIRMED → CLOSED
  SUCCESSFUL, 8 Deviations + checked Done-when/entry-criteria boxes), `migration-stack-analysis.md`
  (Session 9-8b entry, 1 new/15 modified, all FRONTEND), `LESSONS-LEARNED.md` (recurrence notes on
  L42 and L43, no new lesson — stayed at the cap), this file (Current/Previous rotation — Sessions
  9-7b and the stale duplicate 9-7a entry moved to `history/sessions-archive.md`; 9-7b was never
  actually archived at 9-8a's own close despite that session's close note claiming otherwise — a
  hygiene miss now corrected). Session 9-9's order PRE-DRAFTed (`9-9-admin-disbursement.migration-
order.md`) per this session's own obligation — 10 rows (`admin/disbursement/*`, one nested
  layout), 5 open questions carried for the Advisor, most notably: Row 13 (`accounts`) is already
  a Session-6-6 redirect with a stale 9-0-map citation, and Row 17's batch `execute` action is
  real fund disbursement needing its own explicit money-escalation sign-off distinct from 9-8b's
  own non-money confirmation-guard pattern.
- **Previous:** Session 9-8a (`app/(dashboard)/admin/*` core cluster, Phase 9, UI-BUILD),
  CONFIRMED, executed, **CLOSED SUCCESSFUL** 2026-08-23. Tenth session of Phase 9 — ships
  route-map rows 34 (`/admin`), 33 (`/admin/users`), 32 (`/admin/users/[id]`), 12
  (`/admin/api-usage`), 23 (`/admin/errors`), 28 (`/admin/system/config-history`), 29
  (`/admin/system/jobs`), 30 (`/admin/system/outbox`), 31 (`/admin/system/terminals`), 94
  (`/admin/notifications/broadcast`, new). Ordered by Davin directly in chat (no separate
  Antigravity DRAFT/APPROVED round — Davin resolved the CONFIRM findings live and said "go").
  **CONFIRM found the by-now-familiar L3 pattern again** (committed HEAD held the bare PRE-DRAFT
  with open questions; the corrected, 5-decision, `Status: APPROVED` version existed only as an
  uncommitted working-copy edit) and **two genuine order-vs-live-code conflicts neither the 9-0
  route map nor the order's own Decisions had caught:** (1) rows 12/23's backing endpoints
  (`GET /api/admin/api-usage`, `GET /api/admin/error-logs`) are self-documented mock-data stubs
  dating to the original Dec 2025 release — the 9-0 map listed them as plain `GET` endpoints with
  no gap flag; (2) `requireAdmin()` (`lib/auth/session.ts`) had no DB-fallback for JWT staleness,
  unlike its sibling `requireAffiliate()` — Decision 3 only fixed the admin layout's own inline
  check, but 18 admin API routes (including this session's own job-trigger/outbox-retry actions)
  call `requireAdmin()` directly, so a freshly-promoted admin would pass the restyled layout but
  403 on this session's own Row 29/30 actions. Reported both before executing; Davin resolved both
  live (accept rows 12/23's endpoints as disclosed pre-existing debt with an in-UI disclosure
  banner; extend Decision 3's DB-fallback to `requireAdmin()` too) in the same message as "go" —
  the fifth time this loop has visibly closed the Advisor↔Executor gap PD1 exists to bridge (after
  9-5, 9-6, 9-7a, 9-7b). Also found, at CONFIRM: two of the 9-0 map's own flagged "endpoint gaps"
  for rows 28/29/30 (`/admin/system/{config-history,jobs,outbox}`) were already fully resolved at
  Session 6-11 via direct Server-Component Prisma reads / a lib-sourced job list — the 9-0 map only
  grepped `app/api/**` for REST routes and missed that pattern, so the roadmap's own "9-8a likely
  over threshold" sizing concern (`frontend-swap-route-map.md` §7) did not materialize; real scope
  was a straightforward 10-page token restyle, not new backend-building.
  **`requireAdmin()` DB-fallback shipped**, mirroring `requireAffiliate()`'s existing pattern
  (`lib/auth/session.ts`, four lines apart) in both the shared helper and `app/(dashboard)/admin/
layout.tsx`'s own inline check — closes the gap before it could recur as a fresh F79/F80-class
  finding for a future session.
  **Broadcast composer (Row 94, new) does not port codebase 2's fake success toast:** codebase 2's
  own `handleBroadcast` fakes a "Global system broadcast successfully delivered!" message via
  `setTimeout` with zero real dispatch; per Davin's live resolution, the submit action instead
  shows a neutral "Preview only — dispatch is disabled... No broadcast was sent" note, verified
  live via a real form fill + submit round-trip.
  **Two local-environment gaps found and disclosed, neither an app defect (same class as 9-6/9-7b's
  own disclosed gaps, `LESSONS-LEARNED.md` L42, recurrence noted there):** (1) a stale `.next`
  build cache left over from a prior session's dev server made every non-root route 404 —
  `rm -rf .next` + restart fixed it, confirmed via a clean `GET /login 200`; (2) live-testing the
  Row 29 "Run Now" trigger surfaced `Server configuration error: CRON_SECRET not set` even though
  `CRON_SECRET` is present with a real value in both `.env.local` and `.env` — pre-existing route
  code (Session 6-11/7-2) correctly showing its own honest config-presence check rather than
  crashing; root cause not chased further since the restyled UI's own error-handling path (a red
  error badge, not a crash) is what needed verifying, and it verified correctly.
  **A third browser-automation timing gotcha found, registered as an addendum to
  `LESSONS-LEARNED.md` L43 rather than a new lesson** (file is at its 40-lesson cap): reading the
  DOM synchronously in the same `javascript_tool` call right after a synthetic `el.click()` can
  race React's batched re-render, making a working `onClick` handler look like it silently did
  nothing — a short `await new Promise(r => setTimeout(r, 300))` before reading resolved it.
  **All test baselines re-verified live, all green, exact match to entry-criterion baseline:**
  monolith `tsc` clean, `eslint` 0 errors/3 warnings (down from 4 — this session's `<a>`→`<Link>`
  fix in `admin/page.tsx` closed one pre-existing warning), `test:ci` 160/160 suites/2400/2400
  tests; money-service 62/62 suites/526/526 tests; operation-service 42/42 suites/393/393 tests
  (all re-verified fresh at CONFIRM, before code changes; monolith suite re-run again after, still
  green).
  **Route-manifest diff clean:** `git diff --stat` against the session's own start commit
  (`f828967d`) confirms exactly the 10 rows' pages restyled + 1 new page (`admin/notifications/
broadcast`) + 1 new supporting component (`components/ui/textarea.tsx`) + 1 modified supporting
  component (`retry-failed-events-button.tsx`) + `lib/auth/session.ts` — zero unrelated route
  changes.
  **`DECISION-LOG.md` size-gate archival done at CONFIRM (protocol §1 step 0):** F79's resolved
  entry moved to `history/decisions-archive.md` (52.4KB → 51.9KB); remaining overage is OPEN flags
  F77/F80, which the hygiene rule keeps inline until resolved.
  **Artifacts updated:** `9-8a-admin-core.migration-order.md` (Status → CONFIRMED → CLOSED
  SUCCESSFUL, 7 Deviations + checked Done-when/entry-criteria boxes), `DECISION-LOG.md` (F79
  archived), `history/decisions-archive.md` (F79 full narrative appended),
  `migration-stack-analysis.md` (Session 9-8a entry, 2 new/12 modified, all FRONTEND),
  `LESSONS-LEARNED.md` (recurrence notes on L42 and L43, no new lesson — stayed at the cap), this
  file (Current/Previous rotation — Session 9-7a moved to `history/sessions-archive.md`).
  `migration-cutover-table.md` correctly needs no changes (Phase 9 is additive builds, no
  route/slice moved). Session 9-8b's order PRE-DRAFTed (`9-8b-admin-affiliates.migration-
order.md`) per this session's own obligation — 11 rows (affiliates + 5 reports +
  settings/affiliate + fraud-alerts + the new `admin/resources`), 5 open questions carried for the
  Advisor (action-route enumeration for fraud-alerts/affiliate suspend-reactivate, confirmation-
  dialog pattern, Zero-Mock-Data re-verification given 9-8a's own 2-row miss).

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
