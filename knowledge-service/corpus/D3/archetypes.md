---
id: d3-archetypes
domain: D3
mcd_id: null
state_codes: []
timeframe: null
version: 1.0.0
related:
  - d3-synthesis-rules.the-rows-of-the-draft-1-rules-table
  - d1-channels-and-corridors.inside-outside-and-a-sustained-break
  - d1-mcd-architecture.mcd1-the-m15-primary-structure
  - d1-mcd-architecture.mcd2-the-m5-corridor-deviation
---

# The four archetypes

## The four archetypes A, B, C and D

An archetype is the name of the kind of setup a rule found. The four letters come from the earlier trading system and were rewritten on sensors that exist today. Archetype A is trend continuation: the timeframes agree and the trend is going on. Archetype B is exhaustion and snapback: price is stretched beyond a corridor and the bias is against the spike. Archetype C is the macro counter-trend move: the M15 channel has been broken against its own slope and the M5 channel follows the break. Archetype D is the range: a flat channel, with a side named only at its edges.

The letters map to rules. A is R3_TREND_CONTINUATION for a Day Trader and R3S_TREND_CONTINUATION_M5 for a Scalper. B is R2_EXHAUSTION_SNAPBACK. C is R1_MACRO_COUNTER_TREND_RALLY. D is R4_RANGE. A stand-aside from rows 0 and 5 has no archetype. An archetype is a description of structure and not a grade: B or C is not weaker than A, and none of them states what price will do next.

## In which order the archetypes are tested

The rows run in a fixed order for each trader type. A Day Trader is tested on R0, R1, R2, R3, R4, R5, so the order is the data check, then C, B, A, D and the unresolved conflict. A Scalper is tested on R0, R2, R3S, R4, R5. R1 and R3 apply to a Day Trader only, and R3S to a Scalper only.

The order is deliberate. C comes before A, so a sustained counter-trend break of the M15 corridor is not read as continuation. B comes before A, so a climax is not read as continuation. The first branch that holds ends the search. Because Day Trader and Scalper have different rows, the same cycle can give different archetypes. When the M15 channel is broken upward against a falling slope and the M5 trend is up, the Day Trader reading is archetype C and the Scalper reading is archetype A, and both are LONG.

## Archetype A for a Day Trader, trend continuation (R3_TREND_CONTINUATION)

Archetype A is the clean alignment case: the M15 structure and the M5 timing channel slope the same way. For a Day Trader the rule R3_TREND_CONTINUATION needs four things at once. MCD1 has the regime word TREND_ALIGNED_CONTINUATION. MCD1's trend is up or down. MCD2's trend is the same. And MCD2's regime word is TREND_ALIGNED_CONTINUATION, or, in an uptrend, UPTREND_DIP_BELOW_CORRIDOR, or, in a downtrend, DOWNTREND_RALLY_ABOVE_CORRIDOR.

The branch TREND_UP gives the bias LONG, with the reasons M15 uptrend continuing and M5 uptrend in line with M15, and the summary line Trend continuation, LONG. The branch TREND_DOWN gives SHORT, with the reasons M15 downtrend continuing and M5 downtrend in line with M15, and the summary line Trend continuation, SHORT. In both the bias follows the M15 trend and the trend relation is WITH_TREND. A dip below the M5 corridor in an M15 uptrend counts as alignment and not as a conflict: the M15 trend is intact and the M5 reading shows price pulled back past its lower line.

This is the case with the fewest moving parts, and the one where MCD3 most often confirms. Alignment is a description of structure. It does not say how long the trend will last.

## Archetype A for a Scalper, M5 trend continuation (R3S_TREND_CONTINUATION_M5)

A Scalper's primary sensor is MCD2, so the M5 channel alone decides. The rule R3S_TREND_CONTINUATION_M5, row 3s of the table, needs MCD2's trend to be up or down and its regime word to be TREND_ALIGNED_CONTINUATION or the matching dip or rally: UPTREND_DIP_BELOW_CORRIDOR in an uptrend, DOWNTREND_RALLY_ABOVE_CORRIDOR in a downtrend.

The branch TREND_UP gives LONG, with the reason M5 uptrend continuing and the summary line M5 trend continuation, LONG. The branch TREND_DOWN gives SHORT, with the reason M5 downtrend continuing and the summary line M5 trend continuation, SHORT. The trend relation is WITH_TREND, measured against the M5 trend. The rule reads MCD2 only. It does not look at the M15 channel, so a cautioned MCD1 does not change this reading, although MCD3 can still add a note or a caution. The M15 channel can matter only to the earlier row 2, when MCD1 shows a same-slope breakout.

Because MCD2 states are covered by rows 2, 3s and 4, a Scalper with a usable MCD2 always gets a result from the table: a spike gives B, a trend gives A and a sideways channel gives D.

## Archetype B, exhaustion and snapback (R2_EXHAUSTION_SNAPBACK)

Archetype B reads a spike: price has stretched beyond a corridor, and the rule takes the side against the spike. R2_EXHAUSTION_SNAPBACK has four branches, tried primary sensor first.

- MCD1_SPIKE_UP: MCD1 with the regime word BREAKOUT_SAME_SLOPE and a breach up. It gives SHORT, with the reason M15 closed above its corridor, in line with the channel slope.
- MCD1_SPIKE_DOWN: the same regime with a breach down. It gives LONG, with the reason M15 closed below its corridor, in line with the channel slope.
- MCD2_SPIKE_UP: MCD2 with UPPER_OVEREXTENSION_REVERSION. It gives SHORT, with the reason M5 uptrend stretched above its corridor.
- MCD2_SPIKE_DOWN: MCD2 with LOWER_OVEREXTENSION_REVERSION. It gives LONG, with the reason M5 downtrend stretched below its corridor.

Every branch adds the reason Bias is against the spike. The summary line is Snapback after a spike up, SHORT, or Snapback after a spike down, LONG. The trend relation is COUNTER_TREND.

BREAKOUT_SAME_SLOPE means the M15 price closed outside its corridor in the direction of the channel slope. The rules do not follow that break. They treat a stretched same-slope break as a possible climax and take the opposite side. This describes stretch and does not forecast a snapback. When MCD1 and MCD2 both match with different biases, the primary sensor of the trader type decides.

## Archetype C, macro counter-trend rally or decline (R1_MACRO_COUNTER_TREND_RALLY)

Archetype C belongs to a Day Trader only. R1_MACRO_COUNTER_TREND_RALLY needs MCD1 in the regime COUNTER_TREND_EXPANSION, which means the M15 price broke out of its corridor against the channel slope and kept outside for most of the micro window, and it needs MCD2's trend to run in the direction of the break.

The branch BREACH_UP needs a breach up and an M5 uptrend, and gives LONG. Its reasons are M15 breach up against a falling channel and M5 uptrend, and its summary line is Counter-trend rally, LONG. The branch BREACH_DOWN needs a breach down and an M5 downtrend, and gives SHORT. Its reasons are M15 breach down against a rising channel and M5 downtrend, and its summary line is Counter-trend decline, SHORT. The trend relation is COUNTER_TREND, because the bias runs against the slope of the M15 channel. The M5 trend is the second condition because a long M15 break that the M5 channel does not follow is a different picture, which the later rows read.

The row is tested first among the directional rows so that a sustained counter-trend break is not read as continuation. Archetype C is not an instruction to join a rally. It records that the M15 break and the M5 trend point the same way against the older slope.

## Archetype D, range and its edges (R4_RANGE)

Archetype D is the range. R4_RANGE has four branches, tried primary sensor first.

- MCD1_RANGE: the MCD1 regime word CONSOLIDATION or RANGE_EXPANSION, a flat M15 channel. It gives STAND_ASIDE, because the table names no edge rule for an M15 range. The reason is M15 is ranging and no edge rule applies, and the summary line is Range, stand aside.
- MCD2_EDGE_UP: the state MCD2_SIDEWAYS_UPPER_BREAKOUT, a flat M5 channel with price above its corridor. It gives SHORT, with the reason M5 range, price above the corridor edge, and the summary line Range edge, SHORT.
- MCD2_EDGE_DOWN: MCD2_SIDEWAYS_LOWER_BREAKDOWN, price below a flat corridor. It gives LONG, with the reason M5 range, price below the corridor edge, and the summary line Range edge, LONG.
- MCD2_MIDDLE: MCD2_SIDEWAYS_IN_CORRIDOR. It gives STAND_ASIDE, because the structure names no side in the middle of a range. The reason is M5 range, price inside the corridor, and the summary line is Range middle, stand aside.

An edge is the only place the range rule names a side, and the side is against the move out of the corridor. The trend relation of an edge is always COUNTER_TREND, even if the edge direction agrees with MCD1's trend. A Day Trader whose M15 channel is ranging stands aside whatever MCD2 shows, because MCD1's branch is tried first. A Scalper in the same cycle reads the M5 edge.

## Trend relation: with the trend or against it

Every directional reading carries a trend relation, WITH_TREND or COUNTER_TREND. Archetype A is WITH_TREND, measured against the M15 trend for a Day Trader and the M5 trend for a Scalper. Archetypes B and C and the edges of D are COUNTER_TREND. A stand-aside or a NEUTRAL result has none.

The relation matters later. Engine 4 compares it with the trader's trading style: a counter-trend setup shown to a trend-following trader carries a notice, and the target reward-to-risk ratio of a counter-trend setup is capped at 2.50x. The relation is not a quality mark. A counter-trend reading stays VALID unless a sensor is cautioned, and it is not weaker for being counter-trend. It tells the reader which way the setup runs against the larger structure.

The cap follows the setup and not only the profile. Whatever the trader's style, a counter-trend setup has its target ratio capped at 2.50x and a with-trend setup does not. A trader whose style is Trend Following also sees the notice when the setup is counter-trend, and Engine 4 offers the setup anyway.
