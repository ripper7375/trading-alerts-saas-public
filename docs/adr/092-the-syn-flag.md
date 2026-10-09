# ADR-092: The SYN flag

- **Status:** Settled (approved by Davin, 2026-10-04, decision D10 of the build step 4 plan; written down in part 7)
- **Date:** 2026-10-04
- **Section:** 3 · Synthesis & entry zones
- **Architecture:** [STACK-D-ARCHITECTURE.md](../STACK-D-ARCHITECTURE.md) §3.1, §7.10; [ADR-027](027-synthesis-runs-in-the-sensor-worker.md)

## Decision

Synthesis has a flag of its own in `worker_config.yaml`: `off`, `shadow` or `live`, pinned by a test like the MCD flags. It is `off` in the committed configuration. `shadow` reads the sensors that are `shadow` or `live`; `live` reads the `live` ones only. `SYN` may not be higher than MCD1 or MCD2, which every reading needs. Nothing reads SYN until build steps 4 to 7 consume it.

## Alternative not chosen

No flag, SYN following the sensors. The header of `worker_config.yaml` says a `shadow` MCD is "not in synthesis", and MCDs go live only after build step 6, so synthesis would see no sensor at all until then and its rules could not be exercised.

## Why

`shadow` lets the rules run on shadow sensors, to be measured (B1 to B3), before any sensor is live. Rollback is the committed flag.

## Changing this decision

Record a new decision that names this one; set this file's status to "Superseded by ADR-nnn"; update the checklist rules (`flags.synthesis_flag_problems`) and STACK-D-ARCHITECTURE.md in the same change.
