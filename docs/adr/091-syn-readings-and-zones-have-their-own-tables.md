# ADR-091: SYN readings and entry zones have their own tables

- **Status:** Settled (approved by Davin, 2026-10-04, decision D9 of the build step 4 plan and the part 4 and 5 decisions that followed; written down in part 7). Amends the wording of §0.6 and §3.2.
- **Date:** 2026-10-04
- **Section:** 3 · Synthesis & entry zones
- **Architecture:** [STACK-D-ARCHITECTURE.md](../STACK-D-ARCHITECTURE.md) §0.6, §3.2, §3.6

## Decision

The SYN readings are stored in `synthesis_readings` and the zones in `entry_zones`, not as rows of `mcd_outputs` with `mcd_id = "SYN"`. Both are append-only by key, keep the canonical text and its SHA-256 (the database re-derives both), and are written in the same transaction as the cycle's `mcd_outputs` rows. The gateway checks every SYN row in TypeScript before that transaction (a twin of the 25 CHECKs of the migration, held to the database by a corpus), so a reading the database would refuse is left out whole and logged instead of undoing the sensor rows. The reading itself still carries `"mcd_id": "SYN"`.

## Alternative not chosen

Rows in `mcd_outputs` with `mcd_id = "SYN"`, a profile column and a new key.

## Why

`mcd_outputs` is keyed by (symbol, cycle slot, MCD) and SYN has two readings per slot, one per trader type. Its columns are MCD-shaped (evaluator version, inherited reasons, evaluator envelope hash) and its validator is `mcd-output/1`, while SYN is `syn-output/1`. The words "stored like a sensor" in §0.6 and §3.2 are replaced by this.

## Changing this decision

Record a new decision that names this one; set this file's status to "Superseded by ADR-nnn"; the migration `20261004000000_add_synthesis_tables` is applied by Davin (build step 3's B0) and later changes are new migrations; update STACK-D-ARCHITECTURE.md in the same change.
