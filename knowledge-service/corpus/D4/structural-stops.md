---
id: d4-structural-stops
domain: D4
mcd_id: null
state_codes: []
timeframe: null
version: 1.0.0
related:
  - d3-zones-and-runway.structural-invalidation-why-the-stop-sits-behind-structur
  - d3-zones-and-runway.runway-the-room-to-the-next-opposing-level
  - d4-position-sizing.rounding-down-declared-risk-and-actual-risk
---

# Stops behind structure

## Stops sit behind structure, not at a fixed distance

A stop in Engine 4 is placed behind a structural level and not at a fixed number of dollars. A level is where the premise of the setup stops being true, and a distance chosen in dollars knows nothing about where the levels are. The earlier design offered fixed stop pills of $13 to $21. They were removed because they ignored structure.

Engine 4 builds the stop options from the stored cycle. Every structure level on the stop side of the entry is a candidate: the M5 and M15 channel levels UOEDT, baseline and LOEDT, and the support and resistance levels. The stop is placed $0.50 beyond the level, below it for a buy and above it for a sell. An option is offered only if its stop is at least the trader's minimum stop distance from the entry, which is $13.00 by default. A level closer than that is skipped, because a stop that near cannot be used.

The buffer of $0.50 is the same one the entry zones use for their invalidation price. The stop options are the same idea carried to the trader's actual entry, with the trader's own minimum.

## How the stop options are listed

The options run from the nearest level outward. Each option is named by the level it sits behind, for example behind an M15 support level, behind the M5 LOEDT or behind the M15 UOEDT, and levels at exactly the same price are named together. The trade setup shows the nearest three options, with the rest under a heading for more levels. A custom stop is always possible as well. Levels are named by timeframe and kind, so the trader reads a stop behind the M15 UOEDT and not a bare price.

One option is pre-selected. It is the zone's own stored invalidation when that is at least the minimum stop distance from the entry, and otherwise the nearest option. An invalidation that is only the minimum distance, or has no level behind it, is pre-selected as the minimum stop distance and is never presented as a structural level.

If the levels cannot be read, because the stored cycle or its readings are missing, expired or do not match their hashes, only the zone's own invalidation is offered and the report says why. Engine 4 never guesses a level.

## A farther stop means a smaller lot

For the same risk percentage, a stop farther from the entry gives a smaller lot. Each lot loses more at a farther stop, so fewer lots fit inside the same risk amount, and doubling the stop distance roughly halves the lot. The lot and the actual risk are recomputed for the stop that the trader selects, so each option shows its own figures. A stop far from the entry can leave a lot too small to place. If the lot falls below the broker's smallest lot the setup is an underflow, which the section on lots below the minimum explains. In the setup form the trader can compare the options, because each one shows its stop distance, its lot and its actual risk.

A farther stop is not better or worse in itself. It sits behind a deeper level of the structure and costs lot size. A nearer stop sits behind a closer level and keeps the lot larger. Engine 4 shows the options and their figures and does not rank them. The choice stays with the trader, within the minimum stop distance of the profile.

## The minimum stop distance and a custom stop

The minimum stop distance, Min SLD, is metric 7 of the profile and defaults to $13.00. It is a floor on every stop, whether the stop is structural or typed by the trader. A stop nearer than the floor is refused by the validator, and a structural option nearer than the floor is not listed.

A custom stop is a distance in dollars that the trader types. It is held to the same floor and to the same sizing rules. The report marks it as custom, because it is not tied to any level that the system can name. A trader who types a custom stop takes on the judgement that the structure was meant to supply.

The floor guards two things. A very small stop distance would make the lot very large for the same risk. The commission, a fixed amount per lot, would also take a larger share of the risk. The floor keeps both in check. It is the trader's own figure, set in the profile, and it applies to every setup of that trader.

## Room to the next opposing level

Engine 4 measures the room between the entry and the next opposing level, which is the nearest structure level beyond the entry on the side of the target. A target is never shown at or past that level. It must sit strictly before it, and the report names the level so that the trader sees what blocks the way.

Each of the three scenarios is tested against the level. If even the Conservative target lies at or past it, no scenario fits before the level, no badge is given, and the report names the blocking level in place of a badge. The setup itself is still sized, so the lot, the stop and the risk are shown.

The same check runs again when the trader submits the setup, against the cycle the setup is pinned to. If a newer cycle has changed the synthesis, the report offers a refresh. It does not silently use the new levels.

The room is a statement about structure and not a promise about price. The rule only keeps a target from being offered into a level that the cycle's own structure has already marked as an obstacle.
