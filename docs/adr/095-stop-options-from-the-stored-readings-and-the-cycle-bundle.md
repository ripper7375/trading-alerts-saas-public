# ADR-095: Stop options come from the stored readings and the cycle bundle

- **Status:** Settled (approved by Davin, 2026-10-09: decisions D6, D7 and D8 of the build step 5 plan and the readings of the part 2 hand-off; written down in part 8)
- **Date:** 2026-10-09
- **Section:** 6 · Engine 4 & Report 2
- **Architecture:** [STACK-D-ARCHITECTURE.md](../STACK-D-ARCHITECTURE.md) §6.5, §3.6; refines [ADR-062](062-structural-stop-options.md) and [ADR-063](063-badge-from-synthesis-and-room.md); uses [ADR-090](090-the-support-and-resistance-levels-travel-in-the-cycle-bundle.md)

## Decision

A zone row stores one invalidation level and one next opposing level, but the stop options of §6.5 need every structural level on the stop side. Engine 4 rebuilds them from the two places they are stored: the `levels` of the MCD1, MCD2 and MCD3 readings of the zone's cycle in `mcd_outputs` (a sensor that is VALID or CAUTIONARY gives levels; INVALID or STALE gives none; MCD3 repeats the others and is de-duplicated), and the support and resistance levels `sr_1` to `sr_16` in the `context_levels` of the cycle bundle in `market_cycle_inputs`. This is a TypeScript twin of the zone builder's own level assembly, held to the Python by a corpus: the 31 golden zones and 494 zones of 160 random worlds made by the real builder give no difference. The raw channel columns of the bundle's bars are NOT a source (they would offer a stop behind a level of a sensor that was unusable in that cycle).

The reading is checked, not trusted: the SHA-256 of each reading equals its stored hash and its `inputs_sha256` equals the zone reading's, the bundle's hash and byte count match, and the stored zone must be reproducible from the levels read (`ZONE_DISAGREES_WITH_LEVELS`). If a reading or the bundle is missing, expired or fails a check, Engine 4 offers only the zone's own stored invalidation and says that the other levels could not be read. It never guesses a level.

The options: every level strictly on the stop side of the entry the trader chose whose stop, **$0.50 beyond the level, is at least the trader's Min SLD from the entry** (measured on the stop: a level 12.50 away qualifies at Min SLD $13), nearest first, each named, plus "custom". Levels at one price give one option. The modal shows the nearest three and the rest under "more levels". The pre-selected option is the zone's stored invalidation when it is at least Min SLD from the entry, otherwise the nearest option. An invalidation of the `MINIMUM_STOP` or `NO_LEVEL` kind is pre-selected as "minimum stop distance, no structure behind it" and is never listed as a structural level. A badge goes to a scenario whose target sits **strictly** before the next opposing level (a target exactly at the level is not before it), and the comparison uses the target's chart (bid) level.

On the stored 18 Sep cycle (zone Z1, entry 4367.20, Min SLD $13) this gives six options ($16.78, $17.54, $33.14, $88.24, $153.53, $241.46), the next opposing level M15 `sr_1` 4369.57, 2.37 away, **no badge, and 4369.57 named**.

## Alternative not chosen

(b) The raw channel columns of the bundle's bars, which bypass the sensors' availability rule. (c) Store every structural level on each zone at synthesis time (a `zones-2` and a new approval of the 16 golden scenarios), which reopens build step 4. A fixed set of $13 to $21 pills, which §6.5 removes.

## Why

The zone builder takes channel levels only from sensors that are usable, so the stop options must too. The levels already exist in rows that are kept (the readings without limit, the bundle for 90 days; a setup is long void by then), so no table changes and step 4 stays closed. A twin held to the Python by a corpus proves the levels are the zone's levels, and the hash checks prove they are the cycle's.

## Changing this decision

Record a new decision that names this one; set this file's status to "Superseded by ADR-nnn"; a change to which levels count is a new zones version and a rebuild of the corpus (`python scripts/engine4/structure_worlds.py --check`); update `levels.ts`, the worked examples and STACK-D-ARCHITECTURE.md §6.5 in the same change.
