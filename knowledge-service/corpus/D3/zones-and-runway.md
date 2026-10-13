---
id: d3-zones-and-runway
domain: D3
mcd_id: null
state_codes: []
timeframe: null
version: 1.0.0
related:
  - d3-synthesis-rules.stand-aside-neutral-and-a-direction
  - d3-archetypes.trend-relation-with-the-trend-or-against-it
  - d1-closed-bar-rule.the-reference-price-p-ref
  - d1-channels-and-corridors.the-corridor-uoedt-baseline-and-loedt
---

# Entry zones, invalidation and runway

## What an entry zone is

An entry zone is a band of price near a level of the M5 channel where the synthesis sees a place to enter in the direction of its bias, measured from structure the sensors already drew. Zones are built only for LONG and SHORT. A stand-aside or a NEUTRAL result builds none, and the reply says why there are none.

The construction is a pullback construction. The price it is measured from is the reference price P_ref, the close of the last closed M5 bar. The bar still forming is not used. For a LONG the zones are made from channel levels below P_ref, since a LONG waits for a pullback down to support, and for a SHORT from channel levels above it, since a SHORT waits for a rally up to resistance. A level exactly equal to P_ref is on neither side.

When the Day Trader and the Scalper readings have the same bias they have the same zones, since both are made from the M5 channel levels. A zone is a band and not a single price: it has a low, a high and one reference price inside it, which is the price the trade setup uses.

## Where the zone levels come from

A zone is built around a level of the M5 channel: UOEDT, the baseline or LOEDT. The levels come from the channel of any sensor that has one, and the same level reported by two sensors counts once. A level can be a source only if it lies strictly on the bias side of P_ref and its channel has a width, meaning UOEDT lies above LOEDT.

The M15 channel levels and the support and resistance levels sr_1 to sr_16 are never sources. They are structure. A structure level that falls inside a zone counts as confluence, the nearest structure level past a zone is the level the invalidation sits behind, and the nearest structure level beyond the entry is the opposing level that the runway runs to. These levels are used in those three ways and make no zone of their own, because a support or resistance level has no channel and so no width to scale a zone by.

A consequence: a snapback after a spike up gives a SHORT while price is already above the whole M5 channel, so no M5 level lies above it. The same holds for a LONG after a spike down. A range edge is the same case. Such a reading has a direction and no zones.

## How a zone is drawn

Each source level is widened into a band by a half-width of 10% of the width of its own channel, on both sides. A wide channel therefore gets wide zones and a narrow channel narrow ones. The half-width is rounded half up to the cent. Zones that overlap or touch merge into one band, and the range of a merged zone is the union of its members.

The reference price of a zone is the member level nearest the price: the highest member for a LONG and the lowest for a SHORT. Confluence is the number of distinct structure levels that fall inside the band, its edges included. A zone with the M5 baseline and an M15 support level inside it has a confluence of two. Overlapping zones show the same price area marked by more than one level, which is why merging counts as agreement and not as duplication. The stop distance and the runway of a zone are measured from its reference price, not from the edge of the band.

All prices are kept in cents and computed in exact decimals, so the same levels always give the same zones to the cent on replay.

## Structural invalidation: why the stop sits behind structure

Every zone carries an invalidation price. It is placed $0.50 beyond the nearest structure level that lies strictly past the zone: below that level for a LONG, above it for a SHORT. The idea behind it is that the structure which made the zone matters. If price closes beyond the next structural level past the zone, the setup no longer rests on that structure. A distance chosen in pips or dollars has no such meaning, so fixed dollar stops were not used.

There is a floor. The stop distance, measured from the zone's reference price, is never less than $13, which is Engine 4's minimum stop. If the nearest level gives a shorter distance, or if there is no level past the zone, the invalidation is exactly $13 from the reference price. It is not moved to the next level. The zone records which case applied: LEVEL, MINIMUM_STOP or NO_LEVEL.

Invalidation is a price where the zone's premise fails. Reaching it is not a forecast of loss, and staying clear of it is not a promise of anything. Engine 4 turns the invalidation into stop options for the trader.

## Runway: the room to the next opposing level

The runway is the distance in dollars from the zone's reference price to the nearest structure level strictly beyond it, on the far side from the entry. For a LONG that is the first resistance above the reference price, and for a SHORT the first support below it. The runway ratio is the runway divided by the stop distance, rounded to two decimals, so it says how much room there is compared with the risk taken.

A level between the reference price and the zone's far edge counts twice. It is confluence, because it is inside the band, and it is the opposing level, because it lies beyond the reference price. This is deliberate: a resistance just above the entry is an obstacle for a LONG even though it also marks the zone.

When no structure level lies beyond the entry, the runway and the ratio are empty, and the zone ranks first on that key. Engine 4 reads the runway to decide how far a target can go before it meets the next level. A target is never offered past that level, and the level is named.

## How zones are ranked and become price pills

The zones are ranked by three keys in order. First comes confluence, the more structure levels in the band the better. Second comes the runway ratio, the larger the better, with an empty ratio first. Third comes the distance of the reference price from the price, the nearer the better. At most five zones are kept, and the ids Z1 to Z5 are given in rank order, so Z1 is the best. The order is total: zones of one bias lie on the same side of the price and have different reference prices, so no tie is left after the third key.

The trade setup shows one price pill per zone, at the zone's reference price, best first. If fewer than five zones qualify, fewer pills appear. No filler price and no evenly spaced ladder is added.

A trader may type an entry of their own. It is accepted within the range of the last day widened by half its height, and a filter of plus or minus 5% of the live price stays only to catch typing errors. A custom entry is not a zone: it has no confluence, runway or ranking of its own, and Engine 4 checks it against the same rules.
