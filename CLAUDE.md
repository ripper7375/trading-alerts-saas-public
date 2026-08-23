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

- **Current:** Session 9-9 (`app/(dashboard)/admin/disbursement/*`, Phase 9, UI-BUILD), APPROVED,
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
- **Previous:** Session 9-8b (`app/(dashboard)/admin/*` affiliates cluster, Phase 9, UI-BUILD),
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
