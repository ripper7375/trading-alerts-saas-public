# Migration Order — Session 4B-22 — Phase 4 Exit Review

> Read `00-SKELETON-AND-RULES.md` first — §4's dial: this is an AUDIT/REVIEW session, not a build.
> No code should need to change; if the audit finds something that genuinely must be fixed to
> exit Phase 4 honestly, that becomes its own follow-up session, not a same-session fix bolted on
> here. PRE-DRAFTed by the Executor at Session 4B-21's close, per that order's own Next-session
> handoff ("the last session in Phase 4B... walking the phase-exit criteria from the plan one by
> one... no further PRE-DRAFT beyond 4B-22 is implied").

**Session:** 4B-22 (Phase 4 Exit Review) · **Variant:** VERIFY-RETIRE / AUDIT (near-zero dial,
same as Session 5-4's own Phase 5 exit review) · **Status:** PRE-DRAFT
**Generated:** 2026-08-04 (Executor, at Session 4B-21's close)
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

- [ ] Session 4B-21 (Auth Cutover) confirmed CONFIRMED/CLOSED SUCCESSFUL in `CLAUDE.md` — re-verify
      live (`git log`, the order file's own Status line), don't trust this PRE-DRAFT's own framing.
- [ ] A fresh `grep -r` census of `app/api/**/route.ts` in the monolith, cross-referenced against
      `migration-stack-analysis.md` and the cutover table, to determine how many of the "143
      BACKEND files" are genuinely retired vs. still-monolith-native vs. flag-gated-forwarding
      (a forwarding shim is not "retired" in the plan's own sense — it's still monolith code that
      must exist, even post-cutover, until a future RETIRE pass deletes it; several slices'
      CC-F-frozen monolith-side logic has been explicitly left in place per their own close-outs,
      e.g. Slice 3/8's "CC-F freeze... deleting those copies was explicitly not this session's
      job").
- [ ] `DECISION-LOG.md` reviewed for every OPEN flag that could plausibly block a Phase 4 exit
      declaration (at minimum: F21 GDPR account-deletion gap, F47 Wise non-USD quote bug, F49
      dLocal `payment_method_flow` gap — none of these are strictly Phase-4-exit blockers on their
      own literal criteria, but Davin should see them named explicitly in the exit review rather
      than have Phase 4 declared closed silently around them).
- [ ] `CLAUDE.md`'s own Waiting-on backlog reviewed in full (it is long and has not had a
      dedicated consolidation pass — see the file's own flagged hygiene backlog, Waiting-on #102)
      to separate "must resolve before Phase 4 can honestly be called exited" from "carries
      forward into Phase 5/6/7/8 regardless, unrelated to this phase boundary."

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

- [ ] Exit criteria 1-3 each explicitly walked and recorded as MET, MET-WITH-NOTED-EXCEPTION, or
      NOT MET (with the specific remaining gap named) — not silently assumed.
- [ ] The F56-vs-criterion-3 conflict has Davin's explicit, recorded resolution.
- [ ] `migration-stack-analysis.md`'s known backfill gaps (Waiting-on #35/#93) are closed.
- [ ] Full regression suite (monolith + both NestJS services) green.
- [ ] `CLAUDE.md` declares Phase 4's real status (closed, or closed-with-named-exceptions) and
      points at Phase 5/6/7/8's own next real session per the plan's own dependency ordering
      (recall: Phase 5 already closed at Session 5-4; Phase 6 was PRE-DRAFTed as Session 6-1 and
      its own status needs re-checking here too, since it may have been sitting dormant while
      Phase 4B ran its full course).

## Rollback

None — this session makes no code changes by design (see Rules). If Step 2/3's audit finds a
real gap requiring code, that becomes a new, separately-scoped session with its own rollback
plan, not something rolled back here.

## Deviations

_(filled at session close)_

## Next-session handoff

_(filled at session close — depends entirely on what this audit finds: either Phase 6's own
Session 6-1 order gets picked back up, or a dedicated gap-closing session gets PRE-DRAFTed first)_
