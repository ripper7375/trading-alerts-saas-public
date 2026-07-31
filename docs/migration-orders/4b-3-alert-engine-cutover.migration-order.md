# Migration Order — VERIFY/RETIRE variant

> For **cutovers, deletions, and exit reviews**. Read `00-SKELETON-AND-RULES.md` first —
> §4 applies with the dial at **near zero**: checklists exist to be obeyed. If executing
> this uncovers real work, STOP — that work gets its own session with the right variant.

**Session:** 4B-3 · **Variant:** VERIFY-RETIRE (CUTOVER block) · **Status:** PRE-DRAFT
**Generated:** 2026-07-31 (Executor, at 4B-2's close — fast-path eligible per
`EXECUTOR-PROTOCOL.md` §4, PRE-DRAFT → APPROVED, since this is VERIFY-RETIRE)
**Estimated time:** <1h for the checklist itself, but genuinely blocked on a 48h wait that has
**not started yet** — see Entry criteria.

**This PRE-DRAFT is written honestly against current state, not against an assumed future
state.** At 4B-2's close, no shadow/mirror-run is running: `main-worker.ts` (the code that would
actually run it) has never been deployed anywhere. There is no clock to report an end time for.
Do not treat this order as APPROVED-eligible until Entry criterion 1 below is genuinely met.

## Entry criteria

- [ ] **`operation-service`'s first-ever second process/service is live on Railway, running
      `main-worker.ts`.** NOT MET as of 4B-2's close — no deploy has happened. This needs Davin to
      decide the Railway topology (new service vs. a second process type on the existing
      `operation-service`) and actually run it; per `EXECUTOR-PROTOCOL.md` §7 ("first service
      deploys" always escalate), the Executor does not do this unilaterally. This is also the real
      test of the `packages/types` Railway-packaging risk (`DECISION-LOG.md` F9, `CLAUDE.md`
      Waiting-on #79/#80) — proven locally only so far.
- [ ] **The waiting period is actually over** (this order's own template wording) — **there is no
      waiting period running yet.** Once the deploy above lands and the worker starts subscribing
      with dispatch disabled/pointed at a shadow queue, a genuine 48h clock starts. Nothing before
      that point should be reported as a start or end time — see `CLAUDE.md` Waiting-on for the
      exact "what started / what to watch / what would end it early" framing once it's real.
- [ ] **Mirror diff clean** — no diff exists yet (nothing has run to diff). Once the 48h reference
      window completes, the worker's log-only fire decisions must be compared against the
      monolith's own real fires for the same window; every mismatch needs an explanation, not just
      a shrug, per this template's own Checklist step 1.
- [ ] Davin present/available — cutovers require his live approval; unrelated to the above, this
      gate is checked again at the moment of the actual flip regardless of when the wait ends.
- [ ] `MT5_API_URL` set on `operation-service`'s real Railway production — confirmed ABSENT at
      4B-2's close (`CLAUDE.md` Waiting-on #81). Needed before the deployed worker can resolve
      non-XAUUSD prices; XAUUSD itself is unaffected (gateway-pipeline path first).
- [ ] Session 4B-2 CONFIRMED and closed (it is, 2026-07-31 — re-verify at this order's own CONFIRM
      that nothing changed since, per the established pattern).

## Checklist

**CUTOVER block**

1. Present the shadow-run/mirror diff summary (once one exists — see Entry criteria). Every
   mismatch explained? If not → abort, schedule investigation session.
2. Davin approves. (No approval, no flip. His question ritual: "what's the rollback?")
3. Flip: stop the monolith worker container (`scripts/alert-worker.ts` / `lib/jobs/queue.ts`),
   enable dispatch in `operation-service`'s worker (`AlertWorkerService`/`AlertQueueService`,
   pointed at the real `op.alerts.fire` queue instead of the shadow queue / log-only mode). One
   worker consumes at a time — never both dispatching (double-fire risk; the deterministic jobId
   dedupe in `alert-queue.service.ts` is a backstop, not the plan).
4. Monitor fire rate, `Notification` row creation, and `alerts:fired` publish success for at least
   a few hours post-flip. Green?
5. Record: `migration-cutover-table.md` Slice 6 row → CUT-OVER, `CLAUDE.md` state block. CC-F
   freeze on the 4 SOURCE files (see below) stays in effect until Retire.

- **Rollback:** Re-start the monolith worker container, disable dispatch in `operation-service`'s
  worker (back to log-only/shadow-queue mode) — not yet verified in staging (no staging
  environment exists in this project, F34/CC-A; would need to be verified against a real
  pre-cutover state instead, per this repo's established substitute for staging).

## Rules specific to this variant

- No new code, no fixes, no "while I'm here" — observation and execution only.
- Any red result = stop and document, never "probably fine".
- Same double-fire caution as the Checklist's own step 3: never let the monolith worker and
  `operation-service`'s worker both hold live dispatch at once, even briefly during the flip.

## Deviations

_(should normally be empty; a deviation here is itself a warning sign)_

## Next-session handoff

_(DRAFT for the RETIRE step — deleting `lib/alert-engine/*` (9 files), `lib/jobs/alert-checker.ts`,
`lib/jobs/queue.ts`, `scripts/alert-worker.ts`, and `__tests__/alert-engine/*` from the monolith —
only after this cutover has proven stable for a further period Davin sets at that time. Do not
PRE-DRAFT that session's own order until this one is CONFIRMED and the flip is live.)_
