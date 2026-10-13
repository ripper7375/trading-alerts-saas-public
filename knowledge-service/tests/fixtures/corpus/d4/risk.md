---
id: t.d4.risk
domain: D4
timeframe: M15
version: 1.0.0
---

# TEST ONLY: risk

## Half risk sizing in a cautionary reading

TEST ONLY. When the synthesis marks a reading as cautionary, the risk engine starts the position size from half of the risk per trade that the trader set in their profile. The halving is applied before any other step, so the later steps work from the smaller figure. The trader may raise the figure again up to the maximum risk per trade in their profile, and when they do the engine records the override and the reason. This fixture section explains the rule in words and leaves the arithmetic to the engine, whose figures are checked elsewhere. A reader asking why the suggested size is small in a counter-trend reading should be told that the size follows the marking, that the marking comes from the synthesis, and that the trader keeps the last word within their own limits. Nothing here describes the profit that might follow, because the sizing rule works only with the loss the trader accepts. The fixture also states that the half is taken of the figure in the profile at the time of the setup, so a later change to the profile does not alter a setup that was already made.

## The stop sits behind structure

TEST ONLY. A stop is placed behind a structure level, not at a round distance. The engine offers the structure levels from the stored zones, ordered by how close they are to the entry, and the trader chooses one. The fixture explanation is deliberately plain: a level behind which the picture would be wrong is a better home for a stop than a number picked because it is tidy. The engine also keeps a minimum distance, so that a stop is never so tight that ordinary noise reaches it. When the structure level is closer than the minimum, the engine says so and offers the next level instead. The section ends by pointing out that the size of the position follows from the distance to the stop and the risk the trader accepted, and that a wider stop therefore means a smaller position, not a larger loss. The explanation ends by noting that the engine shows the trader the distance in price units next to each level, so the reasoning behind a choice can be checked by anyone who looks.
