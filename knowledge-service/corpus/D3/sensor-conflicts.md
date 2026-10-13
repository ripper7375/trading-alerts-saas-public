---
id: d3-sensor-conflicts
domain: D3
mcd_id: null
state_codes: []
timeframe: null
version: 1.0.0
related:
  - d3-synthesis-rules.ordered-rules-the-first-match-wins
  - d3-archetypes.in-which-order-the-archetypes-are-tested
  - d1-mcd-architecture.mcd3-agreement-and-nesting-of-m15-and-m5
  - d1-data-statuses.what-makes-a-reading-cautionary
---

# When the sensors disagree

## When the M15 and M5 sensors disagree

MCD1 reports the M15 timeframe and MCD2 reports the M5 timeframe, and they can disagree: an M15 downtrend under an M5 uptrend, or a spike on one channel and a trend on the other. The rules do not average the two and do not count votes. The precedence ladder settles it, and the primary sensor of the trader type decides.

In the rows marked primary first, the exhaustion row R2 and the range row R4, the branches of the primary sensor are tried before the other sensor's. If both sensors would match with different biases, the branch tried first is the one that decides, so a Day Trader follows MCD1 and a Scalper follows MCD2. Rows 1 and 3 are written so that the sensors agree by construction: R1 needs MCD2's trend in the direction of the MCD1 breach, and R3 needs both trends to be equal. A cycle that cannot meet them falls to a later row.

Two trader types can therefore read one cycle differently. An M15 range makes the Day Trader stand aside while the Scalper reads the M5 edge. Both readings are stored, and the one that matches the trader's profile is used.

## Unresolved conflict (R5_UNRESOLVED_CONFLICT)

R5_UNRESOLVED_CONFLICT is the last row of the table. It has one branch, MCD3_NOT_CONSOLIDATED. It holds when MCD3 is in one of its three non-consolidated states, MCD3_NON_CONSOLIDATED_TREND_CONFLICT, MCD3_NON_CONSOLIDATED_OVERFLOW or MCD3_NON_CONSOLIDATED_ESCAPE, and no earlier row matched. The result is STAND_ASIDE with no archetype, no trend relation and no zones. The reason is M15 and M5 channels do not form a consolidated trend, and no earlier rule matched, and the summary line is Unresolved conflict, stand aside.

It is last on purpose. MCD3 modifies and never votes. While an earlier row gives a direction, a non-consolidated MCD3 adds a note or a caution to that direction. Row 5 acts only when nothing above produced a direction, so the disagreement is not resolved by any rule and the system says so.

For a Day Trader this happens, for example, when the M15 trend is up inside its corridor and the M5 trend is down inside its corridor. For a Scalper the row can never fire with a usable MCD2, because rows 2, 3s and 4 already cover every MCD2 state.

## MCD3 modifies a direction and never votes for one

MCD3 looks at both timeframes and asks whether they agree and nest. In the synthesis it is a modifier. After a row has produced LONG or SHORT the modifiers are consulted, and the first entry whose conditions hold applies. For any other result, a stand-aside or NEUTRAL, no modifier applies.

There are three effects. A confirmation adds a reason that M15 and M5 are consolidated in the direction of the result. A note adds a reason and changes nothing else. A caution makes the result CAUTIONARY and adds a reason. Whatever the effect, the rule, the direction, the archetype and the zones stay as the row gave them. MCD3 cannot flip a side or start one.

A flat consolidation, MCD3_SIDEWAYS_EQUILIBRIUM, has no modifier entry and no effect. MCD3_BULL_TOP and MCD3_BEAR_BOTTOM confirm like the other consolidated states, because they are consolidated in a direction. When MCD3 is not usable, no modifier applies and the result is given without one.

## Consolidated agreement confirms the direction

The entries M3_CONFIRMS_UP and M3_CONFIRMS_DOWN handle agreement. When MCD3 reports the M15 and M5 channels consolidated in an uptrend, a LONG result gets the reason M15 and M5 are consolidated in an uptrend. When MCD3 reports a consolidated downtrend, a SHORT result gets the reason M15 and M5 are consolidated in a downtrend. A confirmation adds a reason and no score. It means the slopes agree, the M5 corridor nests in the M15 corridor over the window, and the latest corridors nest too, so the direction has structure behind it on both timeframes.

The mirror case is a note. M3_AGAINST_UP applies to a SHORT result while MCD3 is consolidated in an uptrend, and adds the reason M15 and M5 are consolidated in an uptrend, against this direction. M3_AGAINST_DOWN applies to a LONG result while it is consolidated in a downtrend, with the reason M15 and M5 are consolidated in a downtrend, against this direction. A note changes neither the direction nor the status. It tells the reader that the larger structure runs the other way, which is normal for the counter-trend archetypes B and C and for a range edge.

## A trend conflict is a note under R1 and a caution elsewhere

MCD3_NON_CONSOLIDATED_TREND_CONFLICT means the M15 and M5 slopes differ. It has two modifier entries. Under the counter-trend rally row, R1_MACRO_COUNTER_TREND_RALLY, the entry M3_CONFLICT_EXPECTED_UNDER_R1 applies. A conflict is expected there, because the M15 slope lags the move that the M5 trend already shows. Its effect is a note, with the text that the M15 and M5 slopes differ, expected while the M15 slope lags, and it does not change the status.

Under every other row the entry M3_TREND_CONFLICT applies, and the same state is a caution. The text is that the M15 and M5 slopes differ. The result becomes CAUTIONARY, with the reason MODIFIER_CAUTION naming the MCD3 state.

The difference follows from what archetype C is. It is a break of the M15 corridor against its slope, so slopes that differ are its starting condition and not a surprise. In a trend continuation the slopes should agree, so a difference deserves care.

## Overflow and escape make the result CAUTIONARY

M3_OVERFLOW applies to MCD3_NON_CONSOLIDATED_OVERFLOW. The channels slope the same way, but the M5 corridor lies inside the M15 corridor on fewer than three quarters of the bars of the window. The text is that the M5 corridor sits inside the M15 corridor on too few bars. M3_ESCAPE applies to MCD3_NON_CONSOLIDATED_ESCAPE. The nesting holds over the window, but on the latest closed bars the M5 corridor extends beyond the M15 corridor. The text is that the latest M5 corridor extends beyond the M15 corridor.

Both entries are cautions under every row, row 1 included. The result keeps its direction, becomes CAUTIONARY and carries MODIFIER_CAUTION with the MCD3 state as its reason. Engine 4 then pre-sets half the risk. MCD3 reports the first failed condition in the order trend alignment, nesting over the window, current bar, so only one non-consolidated state is present at a time and only one of the three cautions can apply to a reading.
