# Migration Order — VERIFY/RETIRE variant

> For **cutovers, deletions, and exit reviews**. Read `00-SKELETON-AND-RULES.md` first — §4 applies
> with the dial at **near zero**: checklists exist to be obeyed. Keep this order SHORT (~10 lines for
> a cutover). **If executing it uncovers real work, STOP** — that work gets its own session with the
> right variant.

**Session:** 4A-7b · **Variant:** VERIFY-RETIRE · **Status:** PRE-DRAFT (fast-path candidate)
**Generated:** 2026-07-25 (Advisor) · **Estimated time:** <1h
**Phase / plan section:** Phase 4A — money-service, blueprint §5.5 **Slice 3 (of 5)**, CUTOVER half
**Supersedes:** `4a-7-money-service-read-apis-cutover.migration-order.md` (together with `4a-7a-…`)
**Flags:** none — F44/F45 were resolved in 4A-7a

---

## Entry criteria

- [ ] **4A-7a closed all-green**, and its browser end-to-end evidence is in its Deviations: one real
      signed-in call served by money-service, plus observed 401 (signed out) and 403 (wrong role).
- [ ] **`MIGRATE_READ_APIS_MONEY` exists and is currently OFF in production** — verified value-blind.
- [ ] **The F44 evidence is in hand**, whichever form Davin chose: - dual-call diff → the 48h clock has genuinely elapsed (**check the dates in CLAUDE.md, not
      your memory**) and the diff summary is explained-clean; - progressive-cutover substitute → nothing to wait for; state that explicitly so nobody later
      assumes a shadow-run happened.
- [ ] **Davin present** — cutovers require his live approval.

---

## Checklist

**CUTOVER block**

1. Present the F44 evidence. **Every mismatch explained?** If not → abort and schedule an
   investigation session.
2. Davin approves. His ritual question — _"what's the rollback?"_ — answer below.
3. **Flip, one route group at a time**, confirming each is clean before the next:
   **(a)** affiliate dashboard reads → **(b)** admin affiliate lists/reports → **(c)** admin
   analytics. Lowest blast radius first; money reports last.
4. Monitor error rate and p95 for each group before proceeding to the next. Green?
5. If F44 = dual-call: **remove the temporary diff path** now. It is the one deletion this session
   owns, and leaving it is a silent cost on every read.
6. Record: `migration-cutover-table.md` (Slice 3 → `CUT-OVER`, with the F44 substitution named in
   Notes), CLAUDE.md, DECISION-LOG. CC-F freeze on `app/api/affiliate/dashboard/*`,
   `app/api/admin/{affiliates,analytics}/*` and their `lib/` logic **stays until the RETIRE session**
   — deleting the monolith's copies is explicitly NOT this session's job.

- **Rollback:** set `MIGRATE_READ_APIS_MONEY=false` (or the specific group's flag) → traffic returns
  to the monolith's own `/api/*` routes immediately, no redeploy needed if the flag is read at
  request time. **Not rehearsed in staging** — none exists (CC-A/**F34**) — so this is
  reasoned-about only, the same caveat carried by Slices 1 and 2. Davin should know that before
  approving.

---

## Rules specific to this variant

- No new code, no fixes, no "while I'm here". The only permitted deletion is the F44 dual-call diff
  path (step 5), because 4A-7a created it expressly for this session to remove.
- Any red result = stop and document, never "probably fine".
- If flipping a group reveals that the transport needs a change, **that is 4A-7a's work reopening** —
  stop, flip back, and give it its own session. This split exists precisely so that cannot be
  improvised.

---

## Deviations

_(should normally be empty; a deviation here is itself a warning sign)_

---

## Next-session handoff

_(PRE-DRAFT `4a-w1-…` is already DRAFTed and awaiting Davin's approval — Part 19.5 begins after this
session. Also note for a future RETIRE session: `app/api/affiliate/dashboard/*`,
`app/api/admin/{affiliates,analytics}/*` and the now-orphaned
`lib/affiliate/report-builder.ts` / `lib/affiliate/validators.ts` / `lib/admin/pnl-calculator.ts` /
`lib/admin/affiliate-management.ts` become deletable once this slice has been stable for a
Davin-agreed duration. Not yet scheduled.)_
