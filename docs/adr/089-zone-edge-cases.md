# ADR-089: Zone edge cases

- **Status:** Settled (approved by Davin, 2026-10-04, decision D7 of the build step 4 plan and the six small readings of the part 2 hand-off; written down in part 7). Refines [ADR-031](031-zone-half-width.md) and [ADR-032](032-invalidation-price.md).
- **Date:** 2026-10-04
- **Section:** 3 · Synthesis & entry zones
- **Architecture:** [STACK-D-ARCHITECTURE.md](../STACK-D-ARCHITECTURE.md) §3.6; `engine-1-5-new/mcd_worker/synthesis/synthesis.md` §8

## Decision

- **(a) Stop.** The stop distance is measured from the zone's reference price. When the nearest structure level past the zone gives less than $13, the invalidation is exactly $13 from the reference price, not the next level; with no level past the zone it is $13. The zone says which (`LEVEL`, `MINIMUM_STOP`, `NO_LEVEL`).
- **(b) Merged zones.** A merged zone's reference price is the member level nearest the price (the highest for a LONG, the lowest for a SHORT); its range is the union.
- **(c) Cents.** Prices are in cents; the half-width is rounded half up (3.406 gives 3.41); arithmetic is in exact decimals.
- **(d) Equal to the price.** A level equal to the reference price is on neither side.
- **(e) Runway.** It runs from the zone's reference price to the nearest structure level strictly beyond it on the far side from the entry. A level between the reference price and the zone's far edge is therefore both confluence and the opposing level (a resistance just above the entry is an obstacle). With no such level the runway and ratio are empty and the zone ranks first on that key.
- **(f) Rank.** Confluence, then the runway ratio as stored, then the distance of the reference price from the price; at most five are kept. The last tie-break of the plan, "then the lower price", can never apply: zones of one bias lie on the same side of the price with distinct reference prices.

## Alternative not chosen

None was put forward for (a) to (f); each fills a silence in §3.6. For (e) the part 2 hand-off named one: run the runway from the zone's far edge, which would let a resistance inside the zone go unnoticed. Davin approved the literal reading.

## Why

The builder must give the same zones to the cent for the same levels (R4), so every case needs a rule. The $13 floor is Engine 4's minimum stop (ADR-032).

## Changing this decision

Record a new decision that names this one; set this file's status to "Superseded by ADR-nnn"; a change is a new zones version (`zones-2`) and a replay of the golden scenarios; update STACK-D-ARCHITECTURE.md in the same change.
