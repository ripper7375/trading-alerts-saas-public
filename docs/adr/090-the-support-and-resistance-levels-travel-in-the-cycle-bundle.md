# ADR-090: The support and resistance levels travel in the cycle bundle

- **Status:** Settled (approved by Davin, 2026-10-04, decision D8 of the build step 4 plan; written down in part 7)
- **Date:** 2026-10-04
- **Section:** 2 · Sensors (MCDs), used by 3 · Synthesis & entry zones
- **Architecture:** [STACK-D-ARCHITECTURE.md](../STACK-D-ARCHITECTURE.md) §2.2, §3.1; [MCD-DEVELOPMENT-STANDARD.md](../MCD-DEVELOPMENT-STANDARD.md) 1.0.6

## Decision

`CycleInputs` gets an optional `context_levels` section: the `sr_1` to `sr_16` columns of the last closed bar of each timeframe, as `market_data_v6` holds them (`null` for a slot that resolved no level). It is left out of the bundle's JSON form when empty, so a bundle without it has the canonical text and hash it had before. No evaluator reads it; synthesis does. The standard goes to 1.0.6.

## Alternative not chosen

`sr_*` keys on the last closed bar of `bars` (no kit change, but it mixes what the evaluators read with what only synthesis reads). Or not storing them, which would leave the zones unreplayable once the table is refit.

## Why

Replay (R4) means the stored bundle is enough to remake the zones. The three fixture bundles were rebuilt for it; their envelope hashes did not change because no evaluator reads the section.

## Changing this decision

Record a new decision that names this one; set this file's status to "Superseded by ADR-nnn"; a kit change follows the standard's own version rules (section 14); update STACK-D-ARCHITECTURE.md in the same change.
