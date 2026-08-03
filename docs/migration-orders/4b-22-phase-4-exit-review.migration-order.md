# Migration Order — Session 4B-22 — Phase 4 Exit Review

> Read `00-SKELETON-AND-RULES.md` first — §4's dial: this is an AUDIT/REVIEW session, not a build.
> No code should need to change; if the audit finds something that genuinely must be fixed to
> exit Phase 4 honestly, that becomes its own follow-up session, not a same-session fix bolted on
> here. PRE-DRAFTed by the Executor at Session 4B-21's close, per that order's own Next-session
> handoff ("the last session in Phase 4B... walking the phase-exit criteria from the plan one by
> one... no further PRE-DRAFT beyond 4B-22 is implied").

**Session:** 4B-22 (Phase 4 Exit Review) · **Variant:** VERIFY-RETIRE / AUDIT (near-zero dial,
same as Session 5-4's own Phase 5 exit review) · **Status:** CONFIRMED, executed, **CLOSED —
Phase 4 declared CLOSED-WITH-NAMED-EXCEPTIONS** (2026-08-04)
**Generated:** 2026-08-04 (Executor, at Session 4B-21's close); Approved by Antigravity Advisor
2026-08-04 with Criterion 3 wording reconciled per F56; CONFIRMED by Executor 2026-08-04 after
re-verifying Session 4B-21's close (git log, order status, `DECISION-LOG.md` F56/57/58) with zero
drift found.
**Estimated time:** genuinely unclear until the audit runs — likely 2-4h given the number of
things to walk one by one, per the plan's own Phase 4 exit criteria plus this migration's own
accumulated Waiting-on backlog.
**Target service:** none directly — this session reads and reconciles documentation/state, it
does not port or cut over code (unless the audit itself surfaces a hard blocker requiring its own
follow-up session, per this order's own Rules).

---

## Why this session exists

Session 4B-21 (Auth Cutover) closed the last named domain slice in the Phase 4B session
playbook — drawings, notifications, tier, user/2FA/sessions, market-data channel proxy, alert
engine, realtime, email rendering, and now auth are all either cut over or (for OAuth,
deliberately) staying on the monolith by design. Per `monolith-to-microservices-migration-
implementation-plan.md`'s own Phase 4 section, this is the point to formally check the phase's
own stated exit criteria against live reality, not assume they're satisfied because the session
playbook ran out of named slices.

## The plan's own literal Phase 4 exit criteria (§6, "Exit criteria")

1. "All 143 BACKEND files retired from the Next.js monolith; both services live on Railway with
   the §5.6-style stability window met."
2. "Monolith's `app/api/**` reduced to only routes that intentionally remain (if any — e.g.
   cookie-set helper from Phase 3)."
3. "NextAuth fully retired; JWT auth is the only auth system."

**A real, known conflict, flagged here rather than silently glossed over:** criterion 3, read
literally, is **false** as of Session 4B-21's own close — `DECISION-LOG.md` F56 (Davin, Session
4B-20, executed 4B-21) deliberately keeps a narrow OAuth-only `[...nextauth]` / `auth-options.ts`
shim alive **indefinitely** for Google/Twitter/LinkedIn sign-in, specifically because
operation-service has no OAuth support and building it (Option A) or dropping OAuth login
entirely (Option C) were both explicitly rejected. This is a deliberate, Davin-approved
architectural decision made mid-phase, not an oversight — but it means the plan's own written
exit gate, as literally worded, cannot be checked off as-is. **This session's own first job is to
reconcile this explicitly** (most likely: amend criterion 3's wording in the plan doc itself,
with Davin's sign-off, to "credentials/2FA/registration/sessions on JWT via operation-service;
OAuth intentionally stays on NextAuth, scoped and documented per F56" — not silently marking the
box checked, and not treating this as a new blocking defect either).

Criterion 1 and 2 have not been independently re-audited against live `app/api/**` and
`migration-stack-analysis.md` since Session 4A-1 wrote the last real file-inventory entry for
several of the later slices (per `CLAUDE.md`'s own repeatedly-flagged Waiting-on #35/#93 —
`migration-stack-analysis.md` backfill gaps noted at Sessions 4B-11 and 4B-12's own close-outs and
never actually closed). This session needs a genuine, fresh count — not a re-assertion of the
143-file target from memory.

## Entry criteria

- [x] Session 4B-21 (Auth Cutover) confirmed CONFIRMED/CLOSED SUCCESSFUL in `CLAUDE.md` —
      re-verified live: `git log` (`2105d1fd`), the order file's own Status line, `DECISION-LOG.md`
      F56/F57/F58 all RESOLVED. Zero drift from this PRE-DRAFT's own framing.
- [x] A fresh `grep -r` census of `app/api/**/route.ts` in the monolith (all 122 files), cross-
      referenced against `migration-stack-analysis.md` and the cutover table. Found: the "143
      BACKEND files" is a `lib/*` census, NOT a route census (re-read the plan's own text directly
      to confirm this) — criterion 1 and criterion 2 are about two different file sets. Full
      per-bucket breakdown recorded in `migration-stack-analysis.md`'s new Session 4B-22 section
      and `CLAUDE.md`'s Current entry.
- [x] `DECISION-LOG.md` reviewed for every OPEN flag that could plausibly block a Phase 4 exit
      declaration. F21/F47 confirmed non-Phase-4-specific (would exist regardless of phase
      boundary). F49 (dLocal) and F50 (`COMMISSION_CREDITED`) confirmed Phase-4-slice-specific,
      named as the two exceptions under criterion 1. One NEW flag found and registered this
      session: F60 (Stripe webhook never migrated, OPEN). Register-table hygiene gap found and
      fixed (F48-F52 existed only in the archive, never added to the main table).
- [x] `CLAUDE.md`'s own Waiting-on backlog reviewed. The large majority carries forward regardless
      of the Phase 4 boundary (secret rotations, market-data ingestion questions, this file's own
      session-history rotation backlog #102, `LESSONS-ARCHIVE.md` encoding corruption). The
      genuinely Phase-4-scoped open monitoring items (#38, #40, #78) all carry forward unchanged —
      already honestly recorded as open by their own originating sessions, none newly discovered.

## Checklist

1. **Re-verify Session 4B-21's own close-out is real**, not just trusted from this PRE-DRAFT's
   own header — check `git log`, the order file's Status line, and `DECISION-LOG.md` F56.
2. **Walk exit criterion 1** ("143 BACKEND files retired"): fresh census of `app/api/**` +
   `operation-service/src/**` + `money-service/src/**`, reconciled against
   `migration-stack-analysis.md`. Update that file's own known-stale sections while here (per its
   own repeatedly-flagged backfill gap) rather than deferring again.
3. **Walk exit criterion 2** ("`app/api/**` reduced to only routes that intentionally remain"):
   enumerate which monolith route files are (a) genuinely deleted, (b) flag-gated forwarding
   shims kept deliberately (CC-F frozen, cite the session that froze each), (c) still fully
   monolith-native and NOT yet migrated at all — if any of (c) exist and were never named as an
   intentional exception, that's a real gap this session must surface to Davin, not silently
   wave through.
4. **Walk exit criterion 3** ("NextAuth fully retired"): present the F56 conflict above to Davin
   directly; get his explicit sign-off on how to record it (amend the plan doc's own wording vs.
   leave the conflict noted-but-unresolved vs. some third framing) — do not resolve this
   unilaterally.
5. **Review the accumulated flag/Waiting-on backlog** per Entry Criteria above; produce a short,
   explicit list for Davin of what's genuinely blocking vs. what carries forward regardless.
6. **Verify the full regression baseline one more time** as the phase's own closing gate: `tsc
--noEmit`, `eslint app components lib hooks --max-warnings 0`, full monolith `test:ci`,
   `operation-service`'s own suite, `money-service`'s own suite — all green, matching the same
   "zero metric regression" rule Session 5-4 used for its own Phase 5 exit.
7. **Record the outcome**: `CLAUDE.md` (declare Phase 4 CLOSED or explicitly NOT-YET-CLOSED with
   the specific remaining blockers named), `migration-stack-analysis.md` (backfilled per Step 2),
   `DECISION-LOG.md` (record Davin's F56-vs-exit-criterion-3 reconciliation as its own entry if it
   isn't already fully covered by F56's own resolution).

## Rules specific to this variant

- This is an audit, not a build — do not fix code as a drive-by discovery. If the audit finds a
  genuine gap requiring code changes (e.g., a monolith route nobody ever migrated and nobody
  named as an intentional exception), stop, report it to Davin, and PRE-DRAFT a dedicated
  follow-up session for it rather than folding a fix into this session's own diff.
- Criterion 3's F56 conflict is Davin's call to resolve, not the Executor's — present it, don't
  silently amend the plan document unilaterally.
- Zero metric regression: the closing regression suite (Step 6) must match or exceed every prior
  session's own green baseline.

## Done when

- [x] Exit criteria 1-3 each explicitly walked and recorded as MET, MET-WITH-NOTED-EXCEPTION, or
      NOT MET (with the specific remaining gap named) — not silently assumed. **All 3 recorded
      MET-WITH-NOTED-EXCEPTION** (see `CLAUDE.md` Current entry for full detail): Criterion 1 —
      every planned domain module built/cut over, but the literal "143 files retired" doesn't
      hold (CC-F-frozen `lib/*` files deliberately kept, real RETIRE pass never scheduled).
      Criterion 2 — one real, previously-undiscovered gap found (Stripe webhook, `DECISION-LOG.md`
      F60, OPEN), everything else accounted for across 8 clean buckets. Criterion 3 — F56 conflict
      presented and resolved via F59, plan doc §6 amended.
- [x] The F56-vs-criterion-3 conflict has Davin's explicit, recorded resolution. `DECISION-LOG.md`
      F59 (RESOLVED) — reconciled wording applied to the plan doc's own §6, Davin's resolution via
      Antigravity Advisor approval (this order's own header) recorded rather than treated as
      license to skip a DECISION-LOG entry.
- [x] `migration-stack-analysis.md`'s known backfill gaps (Waiting-on #35/#93) are closed. 4
      stale entries found and fixed (`railway-worker.json`, `lib/websocket/server.ts` — both
      deleted 4B-17; `emails/*` + `lib/email/templates/affiliate/*`, 10 files — deleted 4B-19).
      New Session 4B-22 route-census section added. Full exhaustive re-audit of all 143 named
      files was judged disproportionate to this session's own scope — a targeted check confirmed
      no further staleness beyond these 4 entries across a representative sample of every
      cutover-touched domain.
- [x] Full regression suite (monolith + both NestJS services) green. Monolith: `tsc --noEmit`
      clean, `eslint --max-warnings 0` clean, `test:ci` 129/129 suites/2191/2191 tests.
      `operation-service`: `tsc --noEmit` clean, 42/42 suites/385/385 tests. `money-service`:
      `tsc --noEmit` clean, 62/62 suites/522/522 tests (one flaky SIGTERM-timing test on the
      first concurrent run, reproduced clean in isolation and on a second full-suite solo run —
      not a real regression, matches `LESSONS-LEARNED.md` L25's own documented sensitivity).
- [x] `CLAUDE.md` declares Phase 4's real status (closed, or closed-with-named-exceptions) and
      points at Phase 5/6/7/8's own next real session per the plan's own dependency ordering.
      **Declared CLOSED-WITH-NAMED-EXCEPTIONS.** Phase 5 confirmed still closed (5-4, unaffected).
      Phase 6's `6-1-gap-matrix-f11.migration-order.md` checked live (not assumed) — still
      genuinely `PRE-DRAFT`, dormant since 2026-07-23, its own entry criteria cite a stale test
      count (2082 vs. this session's real 2191) that whoever picks it up next should refresh
      before treating it as ready.

## Rollback

None — this session makes no code changes by design (see Rules). If Step 2/3's audit finds a
real gap requiring code, that becomes a new, separately-scoped session with its own rollback
plan, not something rolled back here.

## Deviations

0. **`LESSONS-LEARNED.md` L11 check performed at CONFIRM, per standing discipline**: this order
   file and `CLAUDE.md` were both found modified-but-uncommitted, `Status: PRE-DRAFT` (committed
   `HEAD`) → `Status: APPROVED` (working copy), with the Criterion-3/F56 reconciliation note added.
   Judged benign, not a stop-and-ask trigger, for two independent reasons: (a) this order's own
   VERIFY-RETIRE variant is explicitly fast-path eligible per `EXECUTOR-PROTOCOL.md` §4
   (`PRE-DRAFT → APPROVED → CONFIRMED`, no DRAFT stage required) — unlike Session 4B-20's own
   recurrence, nothing was silently dropped from a "not fast-path eligible" framing; (b) Davin's
   own chat message opening this session directly stated the APPROVED status and quoted the exact
   reconciled wording, which is the live confirmation this check exists to obtain. Recorded in
   `LESSONS-LEARNED.md` L11's own recurrence tally rather than treated as a fresh finding.
1. **Clarified what "143 BACKEND files" actually means before walking criterion 1** — re-reading
   the plan's own §6/Migration-Readiness-Notes text directly (not from memory) showed the 143-file
   census is a `lib/*` service-layer inventory (`migration-stack-analysis.md`'s own appendix), NOT
   an `app/api/**` route census — routes are tracked separately, under `FRONTEND (320 files)` and
   the cutover table, per the doc's own explicit wording. This reframed the whole audit: criterion
   1 is about lib-file retirement, criterion 2 is about route-file status.
2. **Did not attempt a full file-by-file reconciliation of all 143 named CORE/BUSINESS-FUNCTION
   files** — spot-checked a representative sample per cutover-touched domain (alert-engine,
   websocket, email, cron, disbursement, dlocal, stripe, tier, drawing, validations, auth) rather
   than verifying all 143 individually, judged proportionate to an AUDIT-variant session. Found 4
   stale entries this way (see Done-when); a full re-audit might find more but wasn't attempted.
3. **Found and fixed migration-stack-analysis.md staleness as part of Step 2**, per the order's own
   explicit instruction, not treated as out-of-scope drive-by: `railway-worker.json` and
   `lib/websocket/server.ts` (both deleted 4B-17) and 10 email files (deleted 4B-19) were still
   listed as present. Fixed with strikethrough + explanatory notes, matching the doc's own existing
   convention for prior retirements (e.g. the alert-engine section).
4. **Found a real, unambiguous, previously-undiscovered gap against the plan's own literal Slice 4
   scope: the Stripe webhook was never migrated**, despite money-service having a fully-built,
   deployed `StripeWebhookController`/`StripeWebhookService` since Session 4A-9 (2026-07-27) —
   confirmed via (a) the plan's own §6 text explicitly naming "Write APIs **+ Stripe webhook**" as
   Slice 4's scope, (b) zero Stripe-webhook flag reader anywhere in `lib/money-service/flags.ts`,
   (c) zero mention anywhere in `CLAUDE.md`'s session history of repointing Stripe's dashboard
   webhook URL (unlike dLocal's explicit repoint, Session 4A-5). Per this order's own Rules
   ("do not fix code as a drive-by discovery... stop, report it, PRE-DRAFT a dedicated follow-up"),
   registered as `DECISION-LOG.md` F60 (OPEN) rather than fixed here.
5. **Also found, not fixed, genuinely dead/orphaned code with zero UI consumers**:
   `app/api/auth/token-2fa-{backup-codes,disable,setup,status,verify-setup,verify}/route.ts` (6
   files) — a bridge-prototype path from an earlier session, superseded by the different,
   already-live `/api/user/2fa/*` cutover (Session 4B-11), never wired to any UI. Harmless (zero
   traffic), recorded in `migration-stack-analysis.md`'s new census section as a minor future
   cleanup item, not treated as a Phase-4-exit blocker.
6. **DECISION-LOG.md register-table hygiene gap found and fixed**: F48-F52 existed only in
   `history/decisions-archive.md`, never added to the main register table — against that file's
   own hygiene rule that OPEN flags stay in the main body. Backfilled all 5 rows (F48/F51/F52
   RESOLVED, F49/F50 still OPEN) so a future session reviewing "every OPEN flag" doesn't miss them
   the way this session almost did (only found them by directly grepping the archive file after
   the register table came up empty).
7. **Did not attempt the larger `CLAUDE.md` session-history rotation backlog** (Waiting-on #102 —
   several `Previous:`-labeled entries between 4B-20 and 4B-18 lack the `_(superseded-by-above)_`
   marker and were never moved to `history/sessions-archive.md`). Judged this a separate, large,
   mechanical, error-prone cleanup disproportionate to an audit session's own scope — did correctly
   rotate this session's own Current/Previous pair, did not add to the existing backlog.
8. **Did not attempt to fix `migration-cutover-table.md`'s Slice 7/8/9 row corruption** (Waiting-on
   #90/#91, pre-existing, flagged by two prior sessions already) — out of this session's own scope,
   no new information found about it this session.
9. **Lessons harvested, per `EXECUTOR-PROTOCOL.md` §3 (missed on first pass through the close-out,
   caught when Davin asked directly)**: `LESSONS-LEARNED.md` **L54** (the 143-BACKEND-files-is-a-
   lib-census-not-a-route-census distinction — Deviation 1 above, generalized into a reusable rule)
   and **L55** (archiving a batch of flags to `history/decisions-archive.md` can silently carry
   still-OPEN ones out of the main register table too — Deviation 6 above, generalized). Both
   genuinely new failure/confusion classes from this session, not recurrences of an existing entry.
   L11 got a recurrence-tally addition instead of a new entry (Deviation 0), correctly per that
   lesson's own "5+ recurrences → count line" rule.

## Next-session handoff

Two independent tracks, neither blocking the other:

1. **Phase 6, Session 6-1** (`6-1-gap-matrix-f11.migration-order.md`) — still genuinely PRE-DRAFT,
   dormant since 2026-07-23. Before Advisor DRAFT/Davin APPROVED: refresh its Entry Criteria's
   stale test-count citation (2082 → this session's real 2191) and re-verify its other citations
   against live code, since ~11 sessions' worth of Phase 4B work landed since it was drafted.
2. **A dedicated Stripe-webhook cutover session** — PRE-DRAFTed this session as
   `4a-13-stripe-webhook-cutover.migration-order.md` (VERIFY-RETIRE/CUTOVER block, since
   money-service's side is already fully built; mirrors the dLocal/4A-5 dashboard-repoint
   precedent) to close `DECISION-LOG.md` F60: verify `StripeWebhookController` still matches
   Stripe's real event shape after ~8+ days of drift, repoint Stripe's dashboard webhook
   subscription, prove it live with Davin present, then decide whether to retire the monolith's
   `app/api/webhooks/stripe/route.ts` or keep it dormant as documented rollback capability
   (Davin's call, matching the dLocal pattern). Independent of Phase 6 — either can run first.
3. Both F49 (dLocal `payment_method_flow`) and F21 (GDPR account-deletion) remain open, scoped,
   dedicated-future-session items, unchanged by this audit — not re-scoped or re-prioritized here.
