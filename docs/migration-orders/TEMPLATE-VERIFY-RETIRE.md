# Migration Order — VERIFY/RETIRE variant

> For **cutovers, deletions, and exit reviews**: every CUTOVER session, 8-1 deletion sweep,
> 8-5 close-out, phase-exit checks. Read `00-SKELETON-AND-RULES.md` first — §4 applies with
> the dial at **near zero**: checklists exist to be obeyed. Keep this order SHORT (~10
> lines for a cutover). If executing it uncovers real work, STOP — that work gets its own
> session with the right variant.

**Session:** <P-N> · **Variant:** VERIFY-RETIRE · **Status:** PRE-DRAFT | DRAFT | APPROVED | CONFIRMED (fast-path: PRE-DRAFT → APPROVED)
**Generated:** <date> · **Estimated time:** <usually <1h>

## Entry criteria

- [ ] The waiting period is actually over (48h shadow-run / 30-day window — check dates)
- [ ] Davin present/available — cutovers require his live approval

## Checklist

_(pick the block that applies; delete the other)_

**CUTOVER block**

1. Present the shadow-run/mirror diff summary. Every mismatch explained? If not → abort,
   schedule investigation session.
2. Davin approves. (No approval, no flip. His question ritual: "what's the rollback?")
3. Flip: <exact mechanism — env flag / webhook URL / scheduler>.
4. Monitor <error rate, latency, queue depth> for <duration>. Green?
5. Record: cutover table row, CLAUDE.md. Freeze stays until retire.

- **Rollback:** <exact reverse action — pre-verified in staging on <date>>

**RETIRE / EXIT-REVIEW block**

1. Confirm stability precondition met (<e.g. slice stable since <date>>).
2. Delete: <exact file list — nothing more>. Full test suite after.
3. Walk the phase-exit criteria from the plan, one by one, evidence per item.
4. Record: cutover table, CLAUDE.md, Decision Log; propose next phase's entry check.

- **Rollback:** git revert of the deletion commit (deletions are the easy rollback).

## Rules specific to this variant

- No new code, no fixes, no "while I'm here" — observation and execution only.
- Any red result = stop and document, never "probably fine".

## Deviations

_(should normally be empty; a deviation here is itself a warning sign)_

## Next-session handoff

_(DRAFT order for <next session>)_
