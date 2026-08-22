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

- **Current:** Session 9-7b (`app/affiliate/dashboard/*` authenticated partner portal, Phase 9,
  UI-BUILD), CONFIRMED, executed, **CLOSED SUCCESSFUL** 2026-08-23. Ninth session of Phase 9 —
  ships route-map rows 35–42 (all 8 `app/affiliate/dashboard/*` subroutes), 45
  (`/affiliate/dashboard/resources`), 46 (`/affiliate/settings/payout`); confirms row 39
  (`/affiliate/dashboard/profile/payment`) as an already-correct no-op redirect. Closes **F79**.
  **CONFIRM found the by-now-familiar L3 pattern one more time** (29th+ recurrence): committed
  HEAD held the bare PRE-DRAFT with four open questions; the Advisor's corrected-and-approved
  DRAFT (5 numbered decisions) arrived only as an uncommitted working-copy edit. CONFIRM also
  found and reported **two genuine order-vs-live-code conflicts** the Advisor could not have
  caught from documents alone, both originating in the 9-0 route map itself: Row 45's own citation
  named `app/affiliate/resources/page.tsx` — a pre-existing (2026-08-15), public, non-auth-gated
  marketing splash page with zero API binding — when the map's own destination/retires columns,
  and live code, both agree the real target is `app/affiliate/dashboard/resources/page.tsx` (the
  actual endpoint-bound resource center). Row 39/46's "Feeds on" citation bound both to
  `GET/PATCH /api/affiliate/profile/payment` — an orphaned endpoint with zero live consumers —
  when Row 39 is already a retired redirect (Session 6-7) and Row 46 actually calls
  `GET /api/wise/recipients/me` / `POST /api/wise/recipients/[id]/revalidate` via
  `WiseRecipientForm` (Session 4A-W3b). Reported both before executing; Davin/Antigravity
  corrected the order's own text to match live code in the same message that authorized
  execution — the fourth time this loop has visibly closed the Advisor↔Executor gap PD1 exists to
  bridge (after 9-5, 9-6, 9-7a). Separately confirmed the PRE-DRAFT's own Open Question 3 (rows
  38/41 allegedly having "no self-service endpoint") was itself stale: both pages were already
  real, working, DB-bound implementations since Session 6-7 (a Server Component direct Prisma
  read, and client-side `commission-report` aggregation respectively) — the 9-0 map's "GAP" note
  was narrowly true (no REST route) but not "unbound," and the Advisor's own Decision 3 had
  already correctly resolved this without a fresh escalation.
  **F79 resolved as designed:** `app/affiliate/dashboard/layout.tsx` and `app/affiliate/settings/
layout.tsx` (a second, independent route tree hitting the identical JWT-staleness race, per F39's
  recorded URL) both now call `requireAffiliate()`'s DB fallback instead of trusting
  `session.user.isAffiliate` from the JWT. Live-verified against `free-test@trading-alerts.test`
  with its session JWT still stale (`isAffiliate: false`) and the DB correctly `true`: both
  layouts let the request through with zero redirect loop, confirmed via
  `window.location.href` post-navigation, not just rendered text.
  **A live, reproducible bug found during the order's own required Step 5 click-through, registered
  as `DECISION-LOG.md` F80 (OPEN), not silently patched or worked around in app code:**
  `lib/auth/auth-options.ts`'s `FIXED_TEST_ACCOUNTS` credentials-`authorize()` path
  unconditionally `upsert`s a hardcoded `isAffiliate` value on **every** login — this silently
  reset `free-test@trading-alerts.test`'s real, Session-9-7a-earned `isAffiliate: true` straight
  back to `false` the moment the session's own login step ran, confirmed via `User.updatedAt`
  moving to the exact login timestamp. Restored the DB value directly (disclosed as a workaround,
  not a fix) to complete verification without a second, re-triggering login. A second, related gap
  surfaced downstream of the same staleness: money-service's own `AffiliateGuard` (backing Row
  46's live Wise endpoints) trusts the forwarded JWT's `isAffiliate` claim directly, with no
  DB-fallback equivalent to F79's fix — confirmed Row 46's own restyled UI is correct by
  re-verifying against a fresh, non-stale JWT (`affiliate-test@trading-alerts.test`), which
  rendered `WiseRecipientForm` exactly as built. Neither is a 9-7b file; both left for
  Davin/Antigravity to scope as their own auth-semantics session, per `EXECUTOR-PROTOCOL.md` §7.
  **Two local-environment gaps found and bridged during live verification, neither an app
  defect (same class as 9-6's disclosed Stripe/money-service gap, `LESSONS-LEARNED.md` L42):**
  (1) port 3000 was held by an unresponsive `node` process (started ~6h earlier, pre-dating this
  session) that accepted TCP connections but never answered them — killed and restarted cleanly
  via the project's own `nextdev` launch config; (2) `GET /api/wise/recipients/me` 500'd because
  `money-service` wasn't running locally — started via the existing `moneyservice` launch config
  (Session 9-6 precedent).
  **A browser-automation tooling gap found and worked around, registered as an addendum to
  `LESSONS-LEARNED.md` L43 rather than a new lesson:** the `computer` tool's `left_click`/
  `screenshot` actions fail with "the Browser pane is not displayed" whenever the pane isn't
  actually visible on-screen, even though the tab is live and loaded — `read_page`/
  `get_page_text`/`javascript_tool`/`form_input`/`navigate` all work fine in that state. Drove the
  remaining live verification with those instead once identified.
  **Two Jest assertions needed re-deriving, not reverting, per `LESSONS-LEARNED.md` L3/L18:**
  `commission-table.test.tsx`/`code-table.test.tsx` checked for legacy hardcoded color-class names
  (yellow/blue/gray) this session's own Decision 5 intentionally replaced with semantic DavinTrade
  tokens (amber/muted) — updated to match the real, intentional new classes. A pre-existing
  unused-param lint error in `code-table.test.tsx`'s `date-fns` mock (surfaced only once the file
  was re-staged) was fixed alongside. **A lint-staged hook failure left a transient, self-corrected
  git-index/working-tree mismatch on these same two files** (`LESSONS-LEARNED.md` L36's exact
  pattern, one level worse — the hook's own revert-on-failure step also failed on an unrelated,
  already-modified binary file) — no data lost, the correct fix survived in the git index,
  `git checkout -- <file>` resynced the working tree before re-committing.
  **All test baselines re-verified live, all green, exact match to entry-criterion baseline:**
  monolith `tsc` clean, `eslint` 0 errors/4 warnings (pre-existing, none in touched files),
  `test:ci` 160/160 suites/2400/2400 tests; money-service 62/62 suites/526/526 tests;
  operation-service 42/42 suites/393/393 tests.
  **Route-manifest diff clean:** `git diff --stat` against the session's own start commit confirms
  exactly the 13 authenticated-portal files restyled + 1 new component (`affiliate-nav.tsx`) + 2
  test fixes — zero unrelated route changes. Row 39's file correctly absent from the diff (no-op).
  **Artifacts updated:** `9-7b-affiliate-portal.migration-order.md` (Status → CONFIRMED → CLOSED
  SUCCESSFUL, 6 Deviations + checked Done-when/entry-criteria boxes), `DECISION-LOG.md` (F79 →
  RESOLVED, F80 registered OPEN), `history/decisions-archive.md` (F79/F80 full narrative
  appended), `migration-stack-analysis.md` (Session 9-7b entry, 1 new/16 modified, all FRONTEND),
  `LESSONS-LEARNED.md` (L26 merged into L23, L44 added, L43 addendum), this file (Current/Previous
  rotation — Session 9-6 moved to `history/sessions-archive.md`). `migration-cutover-table.md`
  correctly needs no changes (Phase 9 is additive builds, no route/slice moved). Session 9-8a's
  order PRE-DRAFTed (`9-8a-admin-core.migration-order.md`) per this session's own obligation.
- **Previous:** Session 9-7a (`app/affiliate/*` public onboarding, Phase 9, UI-BUILD), CONFIRMED,
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
  **`LESSONS-LEARNED.md` L43 harvested, file now at the 40-lesson cap:** the browser-automation
  `form_input`-on-checkbox gotcha found mid-verification (sets the DOM `checked` property without
  firing React's `onChange`, silently leaving a `disabled={!checked}` submit button disabled) is a
  reusable reflex for any future session's own live click-through — the other two findings this
  session surfaced (the route-map/Decision-1 scope conflict, F79's redirect loop) are one-off
  narratives already fully captured in `DECISION-LOG.md`/above, not generalizable reflexes, so
  neither became a lesson.
  **Artifacts updated:** `9-7a-affiliate-public.migration-order.md` (Status → CONFIRMED → CLOSED
  SUCCESSFUL, 9 Deviations + checked Done-when/entry-criteria boxes), `DECISION-LOG.md` (F79
  registered OPEN), `history/decisions-archive.md` (F79 full narrative appended),
  `migration-stack-analysis.md` (Session 9-7a entry, 1 new/3 modified/1 deleted, all FRONTEND),
  `9-7b-affiliate-portal.migration-order.md` (new, PRE-DRAFT — the authenticated partner-portal
  cluster, 10 rows per Decision 1 rather than the 9-0 map's own uncorrected 8, both known backend
  gaps and F79 carried forward as open questions for the Advisor), `LESSONS-LEARNED.md` (L43
  added, cap note updated), this file (Current/Previous rotation — Session 9-5 moved to
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
