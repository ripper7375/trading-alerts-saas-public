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

- **Current:** Session 9-7a (`app/affiliate/*` public onboarding, Phase 9, UI-BUILD), CONFIRMED,
  executed, **CLOSED SUCCESSFUL** 2026-08-22. Eighth session of Phase 9 — ships route-map rows 48
  (`/affiliate`), 43 (`/affiliate/join`), 44 (`/affiliate/register`), plus retirement of row 47
  (`/affiliate/verify`).
  **CONFIRM found the by-now-familiar L3 pattern one more time** (28th+ recurrence): committed
  HEAD held the bare PRE-DRAFT with three open questions; the Advisor's corrected-and-approved
  DRAFT (5 numbered decisions) arrived only as an uncommitted working-copy edit. CONFIRM also
  found and reported a genuine conflict the Advisor could not have seen from documents alone:
  `frontend-swap-route-map.md`'s own Session column and its own §7 sizing table both assigned
  **6** rows to 9-7a (43, 44, 45, 46, 47, 48), not the order's own 4 — the order's Decision 1
  silently reassigned rows 45/46 to 9-7b without acknowledging it was overriding the map's own
  literal text. Separately, live code contradicted the order's "public/pre-affiliate,
  NON-LOGIN" framing for row 44: `POST /api/affiliate/auth/register` calls `requireAuth()` and
  401s an anonymous caller — this is an already-logged-in customer applying to become a partner,
  not a pre-signup form — and `/affiliate/join`'s own Decision 3 described "a bare redirect" as a
  rejected alternative when that is literally the current live page (a stale citation, L27's
  class). Reported all three; Davin resolved them live in chat (rows 45/46 stay 9-7b, register
  maps 1:1 to the real `affiliateRegistrationSchema` with an explicit
  `/login?callbackUrl=/affiliate/register` redirect, join gets real ported content) before
  authorizing — the third time this loop has visibly closed the Advisor↔Executor gap PD1 exists
  to bridge (after 9-5 and 9-6).
  **A live, reproducible bug found during the order's own required Step 5 click-through, registered
  as `DECISION-LOG.md` F79 (OPEN), not silently patched or silently ignored:** the real
  `POST /api/affiliate/auth/register` correctly created a genuine affiliate profile (201,
  real `profileId`) for the real test account `free-test@trading-alerts.test`, and the register
  page correctly called `router.push('/affiliate/dashboard')` — but `affiliate/dashboard/
layout.tsx` (Session 9-7b's file, not this session's) reads `session.user.isAffiliate` from the
  stale JWT and redirect-trapped the freshly-registered affiliate straight back to
  `/affiliate/register`. Same staleness class as F78 (a passive DB write with no session-refresh
  call site), different, more disruptive surface (an inescapable loop, not a cosmetic badge). A
  working fix already exists in the codebase (`requireAffiliate()` in `lib/auth/session.ts`
  re-checks the DB directly) for 9-7b to reuse. Useful side effect, not a defect: the test account
  is now a real, DB-registered affiliate — exactly the fixture 9-7b's own authenticated-portal
  pages need and previously had none of.
  **A live schema-vs-chat-shorthand mismatch reconciled per PD1, not re-escalated:** Davin's own
  approval message described the register form's social-field mapping as
  `{ website, twitter, youtube, instagram, tiktok }`, but the live `affiliateRegistrationSchema`
  has no `website` field — it has `facebookUrl` instead, exactly matching the pre-restyle live
  page. Mapped to the real schema (swapped seed-code's "website" input for Facebook) rather than
  re-asking over a one-field, non-money, non-auth mechanical correction.
  **Two real gaps found and fixed in the test/tooling environment, not worked around:** jsdom has
  no `ResizeObserver`, and this session's new `components/ui/slider.tsx` (a port of an existing
  seed-code primitive — `@radix-ui/react-slider` was already a dependency, just never wrapped)
  calls it on mount — added a global stub to `jest.setup.js` rather than a per-file workaround,
  since any future test rendering `Slider` would hit the same gap. Two pre-existing tests in
  `__tests__/pages/marketing/public-pages.test.tsx` asserted content/behavior this session's own
  approved decisions intentionally retired (the old "Become a Trading Alerts Affiliate" copy, and
  `/affiliate/join`'s own redirect) — re-derived both from the real ported content per
  `LESSONS-LEARNED.md` L3, not patched to merely pass.
  **All test baselines re-verified live, all green, exact match to entry-criterion baseline**
  (running `operation-service` immediately after the other two suites hit the exact
  worker-OOM/SIGTERM false-negative pattern `LESSONS-LEARNED.md` L24 already documents — this
  time as a hard V8 crash with no test output at all, and a `git commit` in between briefly failed
  on the same machine-wide memory pressure — both resolved cleanly on an isolated `--maxWorkers=1`
  re-run): monolith `tsc` clean, `eslint` 0 errors/5 warnings (pre-existing, none in touched
  files), `test:ci` 160/160 suites/2400/2400 tests; money-service 62/62 suites/526/526 tests;
  operation-service 42/42 suites/393/393 tests.
  **Route-manifest diff clean:** `git diff --stat` against the session's own start commit confirms
  exactly 3 pages restyled, 1 new supporting component (`components/ui/slider.tsx`), and 1 file
  deleted (`app/affiliate/verify/layout.tsx` — the directory held only a passthrough layout, no
  `page.tsx`, so the route was already non-functional before this session touched it) — zero
  unrelated route changes. One commit-hygiene deviation: the `verify` deletion rode along with the
  Step-1 commit rather than getting its own, since a broad staged deletion commits with whatever's
  next regardless of a narrower `git add`.
  **Artifacts updated:** `9-7a-affiliate-public.migration-order.md` (Status → CONFIRMED → CLOSED
  SUCCESSFUL, 8 Deviations + checked Done-when/entry-criteria boxes), `DECISION-LOG.md` (F79
  registered OPEN), `history/decisions-archive.md` (F79 full narrative appended),
  `migration-stack-analysis.md` (Session 9-7a entry, 1 new/3 modified/1 deleted, all FRONTEND),
  `9-7b-affiliate-portal.migration-order.md` (new, PRE-DRAFT — the authenticated partner-portal
  cluster, 10 rows per Decision 1 rather than the 9-0 map's own uncorrected 8, both known backend
  gaps and F79 carried forward as open questions for the Advisor), this file (Current/Previous
  rotation — Session 9-5 moved to `history/sessions-archive.md`). `migration-cutover-table.md`
  correctly needs no changes (Phase 9 is additive builds, no route/slice moved).
- **Previous:** Session 9-6 (Payments flow, cross-boundary, Phase 9, UI-BUILD + PORT), CONFIRMED,
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
