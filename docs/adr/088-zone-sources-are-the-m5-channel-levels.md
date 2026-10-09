# ADR-088: Zone sources are the M5 channel levels

- **Status:** Settled (approved by Davin, 2026-10-04, decision D6 of the build step 4 plan; written down in part 7)
- **Date:** 2026-10-04
- **Section:** 3 · Synthesis & entry zones
- **Architecture:** [STACK-D-ARCHITECTURE.md](../STACK-D-ARCHITECTURE.md) §3.6, §3.7

## Decision

Zones are made from the M5 channel levels (UOEDT, baseline, LOEDT) of a channel that has a width, strictly on the bias side of the reference price. The M15 channel levels are structure, like the support and resistance levels (ADR-087), for both trader types.

## Alternative not chosen

Every channel level of the sensors the rule read, on the bias side, ranked and cut at five.

## Why

It matches the worked example of §3.7, which makes zones from the M5 levels for both profiles and uses the M15 levels as structure.

Consequence, shown by the golden scenarios: the reversion rules fire when the price is outside the M5 channel on the side opposite to the bias (a snapback after a spike, a range edge). A LONG after a spike down has no M5 level below the price, a SHORT after a spike up none above it, so those readings have no zones (`NO_ZONE_SOURCES`; golden scenarios 2, 8, 10 and 11, and the Scalper of 7). Whether supports below the price (M15 or `sr_*`) should be sources for such a reading is open (waiting-on); it would be a new zones version.

## Changing this decision

Record a new decision that names this one; set this file's status to "Superseded by ADR-nnn"; a change to which levels make zones is a new zones version (`zones-2`, keeping `zone_params.zones-1.yaml`) and a replay of the golden scenarios; update STACK-D-ARCHITECTURE.md in the same change.
