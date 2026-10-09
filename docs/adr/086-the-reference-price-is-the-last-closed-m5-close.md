# ADR-086: The reference price is the close of the last closed M5 bar

- **Status:** Settled (approved by Davin, 2026-10-04, decision D4 of the build step 4 plan; written down in part 7)
- **Date:** 2026-10-04
- **Section:** 3 · Synthesis & entry zones
- **Architecture:** [STACK-D-ARCHITECTURE.md](../STACK-D-ARCHITECTURE.md) §3.6, §2.8

## Decision

"The price" that decides which side of it a level lies on, and from which the runway is measured, is the close of the last closed M5 bar of the cycle's bundle (4378.31 on 18 Sep). The labelled last price (4377.99 on 18 Sep) stays with Section 5.

## Alternative not chosen

The labelled last price. It is the close of the M5 bar still forming at the slot, which the bundle leaves out (ADR-011), and whether the pipeline can supply it at the slot is still the open newest-row question.

## Why

The stored bundle is what a replay reads (R4), so the price must be in it. It is also the price §2.8 uses for forward moves, so the zones and the statistics agree. Every synthetic golden scenario carries a bar still forming with another close, to show it is ignored.

## Changing this decision

Record a new decision that names this one; set this file's status to "Superseded by ADR-nnn"; a new price needs a new bundle field (a kit change) and a new zones version; update STACK-D-ARCHITECTURE.md in the same change.
