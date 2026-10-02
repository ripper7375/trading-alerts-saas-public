# ADR-015: Retuning during a promote

- **Status:** Settled (confirmed by Davin, 2026-10-01; proposed 2026-09-29). The definition of "window complete" was amended on 2026-10-02 (Option A, see the Amendment below).
- **Date:** 2026-10-01
- **Section:** 1 · Market data & chart (deck decision 1.8: Promote / retune (new))
- **Architecture:** [STACK-D-ARCHITECTURE.md](../STACK-D-ARCHITECTURE.md) §1.6

## Decision

Cycles RETUNING until the re-pushed window completes; sensors report CAUTIONARY.

"The re-pushed window is complete" means (as amended 2026-10-02): the gateway counts no row of the 3,000-bar M5 window (`market_data_v6`, open time from `slot - 3000 × 300` to the slot) whose `cycle_id` is older than the promote cycle's collection cycle id, and the manifest that counts it is verified (market_cycles state READY).

As first settled on 2026-10-01 it read: the cycle manifest reports 0 re-push rows still unsent, followed by one verified manifest. That wording is superseded by the Amendment; it is kept here because the earlier hand-offs refer to it.

## Alternative not chosen

Treat a promote like any other cycle.

## Why

A promote re-pushes about 6,000 rows over 5–6 minutes, oldest first, so the window mixes old and new tuning; readings in that period should say so. Proposed from the active-standby and frozen-baseline manifests.

## Amendment (2026-10-02): the gateway counts the window (Option A)

**Why it changed.** Build step 2 part 9 built the rule as first settled and found it cannot work on the real collector: `promote_cycle()` rewrites every bar of the window with `INSERT OR REPLACE` each cycle, which clears `synced_at` on all of them, and the manifest is built right after the cycle's newest bars are sent. At that moment the unsent rows older than `slot - 300` are the rest of the window (about 2,700 M5 rows at least), never 0, promote or not. RETUNING would have started at a real promote and never ended. The sender test `test_the_collectors_full_requeue_leaves_the_whole_window_unsent_at_manifest_time` pins the fact and fails the day the collector changes.

**Decided.** Davin chose Option A (part 9 hand-off, decision 1) in the order for build step 2 part 10 on 2026-10-02: the gateway measures it.

**How.** Every cycle rewrites its whole window under its own collector cycle id, so a row's `cycle_id` says which cycle's tuning it was last pushed under. While a symbol is RETUNING, the gateway counts, for each manifest, the M5 rows with an open time from `slot - 3000 × 300` to the slot and a `cycle_id` below the promote cycle's `m5_collection_cycle_id` (the cycle of the latest `PROMOTE` event at or before the slot). When the count is 0 and that manifest is verified, the cycle is not RETUNING and a `RETUNE_COMPLETE` event is written, naming the promote it ends and the window it counted. The sender's `repush_rows_unsent` stays in the manifest and on the `market_cycles` row as an operational diagnostic; the gateway does not read it.

**What this means in practice** (all in `railway-gateway/src/cycle/retuning.ts`, header):

- The window is a time window, one bar wider than the collector's 3,000 bars when the newest row is the new-bar stub, and shorter than them across a weekend. It never counts a row the collector has stopped re-pushing, which would hold RETUNING on for ever. A row that has just scrolled out of the window can hold it for one more cycle, no longer. The oldest bars of a window with a gap go unchecked; the worker re-pushes those first.
- M15 rows are not counted.
- How long RETUNING lasts is now what it honestly is: the time the push worker takes to re-send the whole window. The worker re-sends the oldest rows first every slot, so a worker slower than the window leaves the middle of it old until it ages into the oldest part. That can take hours and says the window really is mixed. Push-worker throughput is unmeasured (ADR-013); the measurement kit reports each episode's length.
- A count that cannot be made (no promote event, or its cycle has no collection cycle id) never ends a RETUNING.
- Collector cycle ids are assumed to only grow. Recreating `xauusd.db` restarts them at 1 and would misread every row as new.

**Reading to confirm (Davin).** "Followed by one verified manifest" is read as: the manifest that counts 0 must itself be verified (READY) before it ends RETUNING, so the count and the verification are of the same manifest. The first reading had the zero reported by one manifest and a later one verifying it. The ADR does not record why; the likely reason is that the sender's zero described its outbox, not what had landed, and a verified manifest confirmed the landing. The gateway's count is of landed rows, so the extra manifest would add little, and it would cost a place to keep the zero from one cycle to the next (a new column, which means a change to the part 2 migration). If you want the extra manifest, say so; it is that column plus one condition.

**Consequences for the other parts of the design.** None for the contract: the field stays optional. A promote between the gateway deploy and the VPS file deploy is harmless now (an old sender never sent the count, and the gateway no longer needs it).

## Note

Confirmed as written by Davin on 2026-10-01, with the definition of "window complete" above. Build step 2 builds items 1 to 3 of [§1.6](../STACK-D-ARCHITECTURE.md) (the promote event, RETUNING, one switch). Items 4 (frozen fit as a quality signal) and 5 (watchdog alerts stored as events) are not part of step 2.

## Changing this decision

Record a new decision that names this one; set this file's status to "Superseded by ADR-nnn"; update STACK-D-ARCHITECTURE.md in the same change. The Amendment above refines how "complete" is measured and leaves the decision (RETUNING until the window is re-pushed, sensors CAUTIONARY) as it was; a different decision would need the new entry.
