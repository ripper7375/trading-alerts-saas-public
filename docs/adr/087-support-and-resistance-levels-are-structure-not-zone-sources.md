# ADR-087: Support and resistance levels are structure, not zone sources

- **Status:** Settled (approved by Davin, 2026-10-04, decision D5 of the build step 4 plan; written down in part 7). Refines [ADR-030](030-support-and-resistance-as-context-levels.md).
- **Date:** 2026-10-04
- **Section:** 3 · Synthesis & entry zones
- **Architecture:** [STACK-D-ARCHITECTURE.md](../STACK-D-ARCHITECTURE.md) §3.6

## Decision

`sr_1` to `sr_16` count as the "next structural level" the invalidation sits behind, as the "opposing level" the runway runs to, and as confluence when one falls inside a zone. They make no zones of their own.

## Alternative not chosen

(B) Their own zones with a half-width Davin chooses (the indicator has an `sr_optimal_step`). (C) Not in version 1.

## Why

ADR-031 takes 10% of the source channel's width, and a support or resistance level has no channel, hence no width. With this reading the 18 Sep figures differ from the earlier draft of §3.7: each M5 zone gains a confluence level, the invalidations move behind `sr_2` and `sr_3`, and the runways shrink. Golden scenario 5 pins a level just above the entry.

## Changing this decision

Record a new decision that names this one; set this file's status to "Superseded by ADR-nnn"; a change to which levels make zones is a new zones version (`zones-2`) and a replay of the golden scenarios; update STACK-D-ARCHITECTURE.md in the same change.
