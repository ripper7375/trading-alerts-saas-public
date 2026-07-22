# Migration Order — VERIFY/RETIRE variant

> For **cutovers, deletions, and exit reviews**: every CUTOVER session, 8-1 deletion sweep,
> 8-5 close-out, phase-exit checks. Read `00-SKELETON-AND-RULES.md` first — §4 applies with
> the dial at **near zero**: checklists exist to be obeyed. Keep this order SHORT (~10
> lines for a cutover). If executing it uncovers real work, STOP — that work gets its own
> session with the right variant.

> **Status: CONFIRMED** — see Deviations for the CONFIRM trail. The header status field
> arrived self-contradicted (PRE-DRAFT note block vs. an uncommitted `APPROVED` edit on
> the metadata line, no Advisor-DRAFT/Davin-approval commit history) — the same pattern
> `LESSONS-LEARNED.md` L11 warns about. Cross-checked live with Davin in-session rather
> than trusted at face value; see Deviations for what was actually verified.

**Session:** 4A-3 · **Variant:** VERIFY-RETIRE · **Status:** CONFIRMED
**Generated:** 2026-07-21 · **Estimated time:** <1h (if entry criteria hold)
**Phase / plan section:** Phase 4A — money-service, blueprint §5.5 Slice 1 (of 5), CUTOVER half
**Target service:** money-service / `vercel.json`

## Why this session, why now

Session 4A-2 (this close) BUILT all 8 cron jobs into money-service's own
`@nestjs/schedule` scheduler and deployed it to Railway production — but gated fully
inert via a `CRON_ENABLED` env var (F35, DECISION-LOG.md), since `vercel.json`'s crons
are still the live, authoritative execution path and no staging environment exists
(CC-A/F34) to shadow-run a genuine parallel copy against. 4A-3 is the small, separate
cutover session that flips both switches — per the playbook, never combine BUILD and
CUTOVER work in one session, which is exactly why 4A-2 stopped short of this.

## Entry criteria

- [x] **`CRON_SECRET` is set on money-service's Railway production environment.** (Davin confirmed this was set at the end of 4A-2).
- [x] At least one manual-trigger cycle per job (`POST /v1/cron-trigger/<job>` for all 8) has been fired by hand, once, after `vercel.json`'s own cron completed that
      day, with results showing idempotent behavior (a second run against
      already-processed data does nothing further — no duplicate `PaymentBatch`/
      `DisbursementTransaction` rows, no duplicate `Notification`/`AffiliateCode`
      mutations). This is this slice's actual "shadow-run diff" per F35 — re-verify the
      evidence is real and logged somewhere durable (this order's own Deviations once
      DRAFTed, or a dated note), not just "it was probably fine."
- [x] Davin present/available — cutovers require his live approval (per this variant's
      own standing rule).
- [x] Money-service's production deploy is still the 4A-2 commit (or newer, but nothing
      that changed cron logic without its own port order) — `railway logs`/`git log`
      cross-check before flipping.

## Checklist

**CUTOVER block**

1. Present the manual-trigger verification history (not a shadow-run diff in the
   traditional sense — see Entry criteria) for all 8 jobs. Every job actually fired at
   least once, with idempotent results confirmed? If not → abort, this session cannot
   proceed; go back and exercise the manual triggers first (that's not itself a new
   session, just 4A-2's own unfinished verification step — see Waiting-on #29's
   blocker).
2. Davin approves. His question ritual: "what's the rollback?" — answer:
   `CRON_ENABLED=false` on Railway (one variable flip, no redeploy needed — the
   scheduler already reads it at call time, not at boot) instantly reverts to
   Vercel-only execution; re-adding `vercel.json`'s crons array (if step 3 already
   emptied it) is a one-line revert of that commit.
3. Flip, in this exact order (not simultaneously — confirm each lands before the next):
   a. `railway variables --service money-service --environment production --set
"CRON_ENABLED=true"` — money-service's own crons go live.
   b. Empty `vercel.json`'s `crons` array (commit + deploy) — Vercel's crons stop
   firing. Between (a) and (b) both systems run in parallel for however long the
   Vercel deploy takes to land; this is a known, brief, one-time overlap window,
   not the ongoing double-run risk 4A-2 avoided (that risk was indefinite parallel
   running with no plan to ever stop one side).
4. Monitor for at least one full cycle of the shortest-interval job (`0 0 * * *`,
   `0 1 * * *`, `0 2 * * *`, `0 3 * * *`, `0 4 * * *` — all daily) before considering
   this stable: Railway logs for money-service (no errors from any `scheduledX()`
   wrapper), and a spot-check that no duplicate `PaymentBatch`/`DisbursementTransaction`
   rows appeared from the brief overlap window in step 3.
5. Record: `migration-cutover-table.md` (Slice 1 row → SHADOW-RUNNING then CUT-OVER),
   CLAUDE.md, DECISION-LOG.md (close the loop on F35). Freeze (CC-F on the 8
   `app/api/cron/*/route.ts` files + their `lib/cron/*`/`lib/disbursement/*` logic)
   stays until the RETIRE session (a later, separate session — deleting the monolith's
   own copies is explicitly NOT this session's job, per the order's own "Retire (after
   cutover proves stable)" section).

- **Rollback:** `CRON_ENABLED=false` (Railway variable flip, instant, no redeploy) +
  re-add `vercel.json`'s crons array (git revert of the cutover commit) if step 3(b)
  already shipped. Not pre-verified in a staging environment (none exists, CC-A/F34) —
  this is a real gap Davin should be aware of before approving: the rollback mechanism
  itself is only reasoned-about, not rehearsed, same caveat as F35's own note on the
  brief overlap window.

## Rules specific to this variant

- No new code, no fixes, no "while I'm here" — observation and execution only. If
  the manual-trigger verification history reveals a genuine bug (non-idempotent
  behavior, wrong output), STOP — that's a real finding, gets its own BUILD-variant
  fix session, not a patch bolted onto this cutover.
- Any red result = stop and document, never "probably fine".

## Deviations

- **CONFIRM found the same self-contradiction pattern as Session 4A-6 (`LESSONS-LEARNED.md`
  L11).** Header note block said PRE-DRAFT/needs-Advisor-DRAFT/needs-Davin-approval; the
  metadata status line said APPROVED; `git diff` showed that APPROVED edit was uncommitted
  (only committed value was DRAFT, from commit `1b7d8def`). No Advisor DRAFT step or
  recorded Davin-approval commit exists for this order. Per L11, did not trust the header —
  cross-checked all 4 entry criteria live with Davin instead of proceeding.
  - Entry criterion 2 (manual-trigger idempotency, all 8 jobs): the paired evidence file
    (`prompt-to-claude-code/manually test_for_4A-3_idempotency_shadow_run_guide.md`) showed
    0/8 boxes checked at CONFIRM time. Asked Davin directly rather than accepting the
    unchecked-but-claimed-done state; Davin confirmed live in-session that the manual
    verification was actually performed for all 8 jobs and all 8 came back idempotent
    (success response, 0 items reprocessed, no duplicate `PaymentBatch`/
    `DisbursementTransaction`/`Notification`/`AffiliateCode` rows, including the
    ⚠️-flagged `process-pending-disbursements` job) — just not checked off in the guide
    file itself.
  - Entry criterion 3 (Davin present/available): confirmed — live in this session.
  - Entry criterion 4 (deploy still 4A-2 or newer, no unreviewed cron-logic changes):
    verified via `git log -- money-service/src/crons/` — last commit touching that path is
    `a8ae3586` ("add CRON_ENABLED safety gate before deploy"), which predates and is part
    of 4A-2's own close (`1b7d8def`). No cron-logic commits since 4A-2 closed.
  - Ran the order's own required approval ritual (Checklist step 2) explicitly: asked
    Davin "what's the rollback?" and restated the answer (`CRON_ENABLED=false` instant
    Railway flip + git revert of the `vercel.json` commit if step 3b already shipped)
    before he approved. Live go-ahead received in-session.

## Next-session handoff

\_(DRAFT order for the RETIRE session — delete the 8 monolith route files + their
`lib/cron/*`/`lib/disbursement/*` source once this slice has been stable in
production for a Davin-agreed duration; update `migration-stack-analysis.md`'s
money-service file inventory accordingly. Not yet scheduled — depends on this
session's own stability window.)
