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

- **Current:** Session 9-6 (Payments flow, cross-boundary, Phase 9, UI-BUILD + PORT), CONFIRMED,
  executed, **CLOSED SUCCESSFUL** 2026-08-22. Seventh session of Phase 9 — ships route-map rows
  60 (`/checkout/return`), 61 (`/checkout`), 87 (`/upgrade/success`), plus a re-verification pass
  of rows 69 (`/pricing`, 9-2) and 75 (`/settings/billing`, 9-5) as one unified commerce journey.
  Closes **F64** (subscription cancel/re-subscribe lifecycle) in full.
  **CONFIRM found the by-now-familiar L3 pattern one more time** (27th+ recurrence): committed
  HEAD held the bare PRE-DRAFT with open questions; the Advisor's corrected-and-approved DRAFT
  (5 numbered decisions) arrived only as an uncommitted working-copy edit. CONFIRM also found and
  reported three real, verifiable defects in that DRAFT before executing — row 60/61 swapped
  relative to `frontend-swap-route-map.md`'s own numbering, "Row 87/92" citing Row 92
  (`app/global-error.tsx`, unrelated, Session 9-1) instead of Row 87 alone, and Step 2's status
  vocabulary ("PENDING, COMPLETED, FAILED, REJECTED") not matching the live `PaymentStatus` type
  (`PENDING | COMPLETED | FAILED | CANCELLED | REFUNDED` — no `REJECTED` exists). Davin (via
  Antigravity) corrected all three directly in response before authorizing — the second time this
  loop has visibly closed the Advisor↔Executor gap PD1 exists to bridge (the first was 9-5).
  **A protocol-level gate found failing independent of the order's own checklist:**
  `DECISION-LOG.md` was 169KB, 3× its ~50KB target — Session 9-5's own close had already flagged
  this as owed at 9-6's OPEN, but the Advisor's DRAFT upgrade dropped the PRE-DRAFT's own entry
  criterion for it. On inspection the size wasn't "Phase 1–6 decisions" bloat as assumed — nearly
  every flag through F66 already had a full write-up in `decisions-archive.md`; markdown-table
  column-padding meant three still-OPEN flags' (F21, F64, F77) oversized in-table narrative
  (F77 alone ~2100 combined characters) was forcing every other row in the ~68-row table to pad
  out to match it. Archived those three flags' full narrative (nothing lost, `decisions-archive.md`
  gained three new entries), trimmed ~25 other rows down to a pointer where an archive entry
  already existed. Result: 169015 → 20420 bytes (later 36801 after the pre-commit prettier pass
  re-aligned columns to the new, much smaller max width).
  **A live environment/flag discrepancy found and corrected before opening, money-adjacent —
  escalated per `EXECUTOR-PROTOCOL.md` §7 rather than silently touched:** `.env.local` had
  `MIGRATE_WRITE_APIS_MONEY_DLOCAL=true`, contradicting `DECISION-LOG.md` F76's own documented
  rollback (dLocal's real Payins method-ID bug, still OPEN, unfixed until 4A-16). Corrected to
  `false` per Davin's explicit instruction in the same message that authorized execution.
  **Two more local-environment gaps found and bridged during live verification, neither an app
  defect (same class as 9-5's disclosed 2FA/operation-service finding):** (1) a stale `.next`
  build cache from a prior Next.js version bump made every `/api/auth/*` route 404 — cleared and
  confirmed fine; (2) `POST /api/checkout` 500'd with `ECONNREFUSED` because
  `MIGRATE_WRITE_APIS_MONEY_STRIPE=true` forwards to money-service, which had no local `.env` and
  wasn't running — created `money-service/.env` (gitignored, reusing the same test-mode secrets
  already in root `.env.local`, per that service's own `.env.example` comments) and added a
  `moneyservice` entry to `.claude/launch.json` for future sessions. With no Stripe CLI/ngrok
  available locally to deliver Stripe's real webhook to `localhost`, bridged the gap using
  Stripe's own documented test-signing technique: fetched the real completed Checkout Session
  from Stripe's API after a genuine browser-driven Test Mode payment and re-delivered it as a
  `stripe.webhooks.generateTestHeaderString`-signed `checkout.session.completed` event to the
  monolith's own webhook route — the real Stripe object, just redelivered over a transport Stripe
  itself can't reach locally. Server logs confirm the real handler ran
  (`[Webhook] User cms07vwn300009ov21cx21szz upgraded to PRO (monthly billing)`).
  **A genuine safety-boundary pause, not a workaround:** entering Stripe's own dummy test card
  (`4242 4242 4242 4242`) into the hosted Test Mode checkout page sits on this environment's
  standing "never enter card numbers" instruction with no test-mode carve-out in its wording.
  Stopped and asked via `AskUserQuestion` rather than deciding unilaterally; Davin explicitly
  confirmed proceeding was fine for this authorized QA context before any field was filled.
  **Full lifecycle live-verified end-to-end in Stripe Test Mode**, as a genuine FREE test user:
  `/pricing` → "Upgrade to PRO Now" → `/checkout` → real Stripe Test Checkout (card `4242...`,
  7-day trial per `subscription_data.trial_period_days`) → webhook (bridged above) → tier flips
  to PRO in the DB for real → `/upgrade/success` polls `GET /api/subscription` and correctly shows
  "Welcome to PRO!" → `/settings/billing` shows real PRO status, a real Stripe-fetched $0.00
  trial-period invoice line, and the real card-on-file (`Visa ****4242`, matching what was
  entered) → "Cancel Plan" → real `POST /api/subscription/cancel` (immediate, full Stripe
  cancellation, no `cancelAtPeriodEnd`) → downgrades to FREE for real → "Upgrade to PRO" →
  correctly loops back to `/pricing`, closing the cycle.
  **Order text vs. live code, corrected per PD1 rather than silently patched over:** the order's
  Step 2/Step C assumed a "Launch PRO Terminal" button on `/upgrade/success` linking to
  `/terminal` — the real, live button reads "Go to Dashboard" and links to `/dashboard`. Left
  as-is (Decision 2 authorizes restyling, not changing a navigation target; no decision here
  authorized pointing users at `/terminal` instead) and reported the order's own text as wrong.
  **A new, real, live UX gap found during the click-through and registered as `DECISION-LOG.md`
  F78 (OPEN), not silently noted only in passing:** `AppHeader` (built Session 9-1) reads
  `session.user.tier` directly for its nav/badge gating, so the webhook-driven tier flip above
  left its "🔒 FREE" badge and `/pricing`/`/free` nav links stale until the NextAuth JWT next
  rotates — `/upgrade/success` and `/settings/billing` themselves are correct since both already
  re-fetch `GET /api/subscription` rather than trusting the session (the exact `F57`-class
  staleness, but on a passive server-side change with no user-initiated call site to refresh
  from). Not fixed here — out of a UI-BUILD+verification session's scope.
  **`LESSONS-LEARNED.md`'s own cap was already 1 over (41 active, cap 40) before this session,
  and its own header says the next new lesson must consolidate first** — done at Davin's explicit
  request rather than deferred a second time: merged L20/L21 into L19 and L34 into L13 (both were
  already-terse Railway-CLI one-liners on the same theme as their merge target, no content lost),
  then added **L42** (the local-webhook-delivery/stale-`.next`-cache lesson from this session's
  own live-verification gaps). Net 41 → 39, one slot of headroom left before the next
  consolidation is owed.
  **A second, pre-existing session-history hygiene gap found and fixed while doing this session's
  own Current/Previous rotation:** Session 9-5's own close claimed "Session 9-3 moved to
  `history/sessions-archive.md`" — true for the archive (9-3's entry was correctly appended
  there), but the corresponding removal from this file never happened, leaving 9-3's full entry
  live in CLAUDE.md as a second, stale `Previous` block for one extra session. Removed here (its
  content was already safely duplicated in the archive, so nothing was lost); Session 9-4 moved
  to the archive properly this time.
  **All test baselines re-verified live, all green, exact match to entry-criterion baseline**
  (first parallel run of all three hit two worker-OOM/SIGTERM false negatives from resource
  contention — `LESSONS-LEARNED.md` L24's exact pattern — resolved cleanly on isolated re-runs):
  monolith `tsc` clean, `eslint` 0 errors/5 warnings (pre-existing, none in touched files),
  `test:ci` 160/160 suites/2400/2400 tests; money-service 62/62 suites/526/526 tests;
  operation-service 42/42 suites/393/393 tests.
  **Route-manifest diff clean:** `git diff --stat` against the session's own start commit confirms
  exactly the 3 commerce pages' own files restyled — zero route additions, removals, or unrelated
  files touched.
  **Artifacts updated:** `9-6-payments-flow.migration-order.md` (Status → CONFIRMED → CLOSED
  SUCCESSFUL, CONFIRM note + Deviations 0/1 + checked Done-when/entry-criteria boxes),
  `DECISION-LOG.md` (F64 → RESOLVED, F78 registered OPEN, size-gate archival), `history/
decisions-archive.md` (F21/F64/F77 full narrative appended), `migration-stack-analysis.md`
  (Session 9-6 entry, 3 files modified, all FRONTEND), `.claude/launch.json` (`moneyservice`
  config added), this file (Current/Previous rotation — Session 9-4 moved to
  `history/sessions-archive.md`; the stale duplicate 9-3 entry found and removed, see above).
  `migration-cutover-table.md` correctly needs no changes (Phase 9 is additive builds, no
  route/slice moved). `LESSONS-LEARNED.md` (L20/L21 merged into L19, L34 merged into L13, L42
  added — see the note above).
- **Previous:** Session 9-5 (`settings/` 11, Phase 9, UI-BUILD), CONFIRMED, executed, **CLOSED
  SUCCESSFUL** 2026-08-22. Sixth session of Phase 9 — ships all 11 route-map rows (73–83): the
  `app/settings/layout.tsx` boundary (session's own one moved layout: auth gate, `AppearanceProvider`,
  `AppHeader`, shared sub-nav) plus `settings` (hub), `account`, `appearance` (Protected #5),
  `billing`, `help` (Protected #6), `language`, `privacy`, `profile`, `security`,
  `security/activity`, `terms`. Formally documents progress on **F21** (24h account-deletion) and
  **F64** (subscription cancel) in `DECISION-LOG.md`, both left OPEN per the corrected order's own
  scoping — see below.
  **CONFIRM found real, material problems in the order Davin hadn't yet seen, escalated rather than
  silently fixed or silently trusted:** the committed PRE-DRAFT's row-73–83 mapping didn't match
  `frontend-swap-route-map.md`'s real rows at all (scrambled numbers, a fabricated `settings/
notifications` page with zero route-map row/legacy source/seed-code source, and the real row 82
  `/settings/terms` dropped from the Ordered Steps entirely); `POST /api/subscription/resume` was
  required by the entry criteria and Decision 2 but does not exist anywhere in the repo; and
  `/api/subscription/cancel` (which Decision 2 assumed sets `cancelAtPeriodEnd`) actually performs
  an immediate, full Stripe cancellation — architecturally incompatible with the "Undo" flow the
  order described. Reported all three as failing entry criteria rather than starting; **Davin (via
  Antigravity) corrected the order directly in response** — resume dropped, F64 rescoped to
  cancel-only with reactivation deferred to Session 9-6, notifications swapped for terms across all
  11 rows — the first time this session-close/PRE-DRAFT loop has visibly closed the Advisor↔Executor
  gap PD1 exists to bridge.
  **CONFIRM found the by-now-familiar L3 pattern one more time** (26th+ recurrence, one commit total
  in the order file's own history): committed HEAD held the bare PRE-DRAFT; the corrected-and-
  approved text arrived as an uncommitted working-copy edit. Davin's own chat message directly
  restated the layout-boundary decision, the Protected Pages note, and the F21/F64 framing before
  authorizing execution — treated as live confirmation, matching the established pattern.
  **`LESSONS-LEARNED.md` L15's exact failure class recurred a second time, on the opposite side of
  the same bug:** the order's own Decision 2 named `components/billing/subscription-card.tsx` as
  what to wire for F64 — reading the REAL, live `app/(dashboard)/settings/billing/page.tsx` before
  porting it found it never imports that component at all. The real billing page has its own
  inline, confirm-before-cancel flow with no optimistic "Undo" step, so it never had F64's bug to
  begin with. Ported the real live flow unchanged; `subscription-card.tsx` stays unmounted dead
  code, unchanged, still carrying its original bug — Davin's own future call, not this session's.
  **F21's real backend state read directly from source before wiring the UI, not assumed from the
  order's framing:** `deletion-request`/`deletion-confirm` routes already implement a real, DB-
  backed 7-day link-expiry + 24h post-confirm grace period — but both still have live `// TODO`
  stubs (console.log only) for the confirmation/scheduling emails, and no cron/worker exists
  anywhere in the repo (grepped) to execute the actual deletion. Wired the UI to the real endpoint
  as the corrected order's own Decision 3 asks; the backend completion gap is disclosed in
  Deviations and `DECISION-LOG.md`, not silently fixed (real email/cron infra is well outside a
  UI-BUILD session) and not silently hidden.
  **Help page (Protected Page #6) needed two real-vs-mock swaps to satisfy both the 100%-fidelity
  invariant and the Zero-Mock-Data rule at once:** seed-code's version calls a chat widget deferred
  to Phase 14 (confirmed unmounted, per 9-1's own finding) and fakes its ticket-submit with a bare
  `setTimeout` (confirmed: no `/api/support`/`/api/contact`/`/api/ticket` route exists anywhere).
  Ported the real DavinTrade visual design, swapped the chat CTA for a real
  `mailto:support@davintrade.com` link (per the order's own Step 2) and the fake ticket-submit for
  a real pre-filled `mailto:` compose, rather than shipping a "ticket submitted" success state for
  a request nothing delivers.
  **A live, reproducible instance of `DECISION-LOG.md` F77's own defect class found on this
  session's own new page, root cause now identified:** confirmed via a real `next build && next
start` production server (not dev/HMR) that `/settings/appearance` carries a second, inert copy
  of its own content in `<div id="S:0" style="display:none">` alongside React/Next's own
  `$RC`/`$RT`/`$RV` Suspense-streaming "reveal" scripts — this route's own `app/settings/loading.tsx`
  creates the Suspense boundary. Confirmed benign (`display:none`, 0×0 rect, non-interactive, zero
  console/hydration errors) and confirmed present on the unrelated, pre-existing `/login` page too,
  ruling out this session's own code as the cause. Logged as an addendum to F77 (likely its real
  root cause) rather than a new flag or further open-ended chase, matching Davin's own 9-4 call on
  the same defect class.
  **Live 2FA click-through blocked by local environment, not app code, and disclosed as such:**
  `POST /api/user/2fa/setup` is cut over to `operation-service`, which wasn't running in this
  session's local preview (only the monolith was) — server logs show a genuine `ECONNREFUSED`, not
  an app error. `operation-service`'s own 42/42 test suites pass; login history and sessions (still
  monolith-routed) verified live with real data with no issue.
  **All test baselines re-verified live, all green, exact match to entry-criterion baseline:**
  monolith `tsc` clean, `eslint` 0 errors/5 warnings (pre-existing, none in touched files), `test:ci`
  160/160 suites/2400/2400 tests; money-service 62/62 suites/526/526 tests; operation-service 42/42
  suites/393/393 tests. A real production build (`next build`) also verified clean, used for the
  F77-addendum investigation above.
  **Route-manifest diff clean:** `git diff --stat` against the session's own start commit confirms
  `app/(dashboard)/layout.tsx` and `app/(dashboard)/admin/*` show zero diff; exactly the 11 rows'
  own files moved/rewritten (mostly detected as renames), the new layout + nav component, and 5
  pre-existing test files' import paths fixed (zero assertion changes needed).
  **A real hygiene gap found at close, not silently skipped:** `DECISION-LOG.md` is 101.5KB,
  roughly double its ~50KB target — this predates this session (this session's own edits added
  only ~3KB) and was missed at this session's own OPEN (the §1 step-0 size gate check was skipped).
  Not fixed this session — a full archival pass done quickly at session-close risked more harm than
  the oversized file itself — flagged explicitly as owed at Session 9-6's own OPEN step 0 instead of
  silently deferred again.
  **Artifacts updated:** `9-5-settings.migration-order.md` (Status → CONFIRMED → CLOSED SUCCESSFUL,
  7 Deviations + checked Done-when/entry-criteria boxes), `DECISION-LOG.md` (F21/F64 register rows
  updated with this session's evidence, both still OPEN; F77 addendum), `migration-stack-analysis.md`
  (Session 9-5 entry, 13 new files/13 deleted, all FRONTEND), `LESSONS-LEARNED.md` (L3 compressed
  per its own 5+-recurrences rule, long overdue; L41 added — the F77-addendum Suspense-streaming
  root-cause finding above), this file (Current/Previous rotation — Session 9-3 moved to
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
