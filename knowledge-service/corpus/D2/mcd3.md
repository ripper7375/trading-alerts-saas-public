---
id: d2-mcd3-playbook
domain: D2
mcd_id: MCD3
state_codes:
  - MCD3_BULL_VALUE
  - MCD3_BULL_MID
  - MCD3_BULL_TOP
  - MCD3_BEAR_PREMIUM
  - MCD3_BEAR_MID
  - MCD3_BEAR_BOTTOM
  - MCD3_SIDEWAYS_EQUILIBRIUM
  - MCD3_NON_CONSOLIDATED_TREND_CONFLICT
  - MCD3_NON_CONSOLIDATED_OVERFLOW
  - MCD3_NON_CONSOLIDATED_ESCAPE
timeframe: null
version: 1.0.0
related:
  - d1-channels-and-corridors.terms-the-sensors-use
  - d1-channels-and-corridors.the-corridor-uoedt-baseline-and-loedt
  - d1-channels-and-corridors.the-slope-and-the-five-degree-trend-band
  - d1-mcd-architecture.mcd3-agreement-and-nesting-of-m15-and-m5
  - d1-data-statuses.what-makes-a-reading-cautionary
---

# MCD3 playbook: consolidated trend and the EDT stochastic

## What MCD3 measures

MCD3 is the sensor that looks at both timeframes together. It asks whether the active M15 channel and the active M5 channel agree in direction, whether the M5 corridor lies inside the M15 corridor, and, if they do agree and nest, where the M15 SSA sits within the M15 corridor. A trend that passes all three tests is called a consolidated trend.

MCD3 is derived. It names MCD1 and MCD2 as its inputs and reads their readings of the same cycle, so it takes its two trend words from them and does not recompute them. It modifies and does not vote. A consolidated trend confirms the direction that the two channel sensors give, and a failed test adds caution. In the order of precedence it stands in the oscillator rung for both trader types.

There are ten states: seven consolidated and three non-consolidated. Each carries a regime word, a bias and six levels: UOEDT, the baseline and LOEDT for M15 and for M5. The three non-consolidated states have the bias STAND_ASIDE. A reading that stands aside always reaches the model in full. MCD3 describes agreement and position. It does not say what comes next, and it gives no entry.

## The three conditions and the nesting test

Condition 1 is trend alignment. The M15 trend word from MCD1 and the M5 trend word from MCD2 must be the same: both up, both down or both sideways. A flat channel against a sloping one is a difference.

Condition 2 is nesting over the window. For each closed M5 bar of the window, MCD3 takes the closed M15 bar that was current at that time, and asks whether the M5 corridor lies inside the M15 corridor, with the edges counting as inside. The window is the whole length of the M5 channel in closed bars. Condition 2 holds when at least 75% of those bars are nested. An M5 bar with no M15 band yet counts as not nested.

Condition 3 is the current bar. On the latest closed bars, the M5 LOEDT must not be lower than the M15 LOEDT and the M5 UOEDT must not be higher than the M15 UOEDT.

All three are evaluated and reported. When one fails, the state names the first failure in the order 1, 2, 3. The statuses of the upstream sensors matter: MCD3 can only be as sound as MCD1 and MCD2, and a caution in either is passed on with its reason.

## The EDT stochastic and the three zones

When the trend is consolidated, MCD3 places the M15 SSA within the M15 corridor on a scale from 0 at LOEDT to 100 at UOEDT. That scale is the EDT stochastic. The number is not clipped: it is below 0 when the SSA is under LOEDT and above 100 when it is over UOEDT.

Three zones are cut from the scale. The lower zone is 20 or less. The upper zone is 80 or more. The middle zone lies between. The values 20 and 80 belong to the lower and the upper zone. The zone is decided on the unrounded number. A sideways consolidated trend has a single state, whatever the number.

When the trend is not consolidated, no stochastic is given at all.

The zones are positions. They are not buy or sell signals, and an unclipped value outside the scale means only that the SSA is outside the M15 corridor. The regime words that sound like valuations, such as value, premium, overbought and oversold, describe where the SSA sits in the corridor. They do not describe how price will behave. The project has not yet measured what follows each zone, and gives no number for it.

## Consolidated uptrend, lower zone of the M15 corridor

**State code:** `MCD3_BULL_VALUE`. Regime word BULLISH_CONSOLIDATED_VALUE_ZONE. The sensor's own bias is LONG.

**What it says.** Both channels slope up and are nested, and the M15 SSA is in the lower zone of the M15 corridor, at 20 or below on the scale. The lower zone includes values under 0, where the SSA is below LOEDT.

**What it does not say.** The word value is a location. It does not say that price is cheap, that a rise is due, or that this is a good place to enter. The bias LONG follows the consolidated uptrend.

**With the other sensors.** MCD1 and MCD2 both say up, by construction. An MCD1 or MCD2 caution is passed on as UPSTREAM_CAUTIONARY and makes this reading CAUTIONARY. A defect found by MCD0 on either timeframe does the same.

**What to watch next.** Whether the stochastic climbs toward the middle zone, whether it keeps falling below 0, and whether the nesting or the trend agreement fails, which would move the state to a non-consolidated one.

## Consolidated uptrend, middle zone of the M15 corridor

**State code:** `MCD3_BULL_MID`. Regime word BULLISH_CONSOLIDATED_EQUILIBRIUM. The sensor's own bias is LONG.

**What it says.** Both channels slope up and are nested, and the M15 SSA is in the middle zone, above 20 and below 80 on the scale. The two timeframes agree and the SSA is away from both edges.

**What it does not say.** Equilibrium here is a position between the zones. It does not say that price is fairly valued or that it will stay in the middle.

**With the other sensors.** MCD3 confirms the direction of MCD1 and MCD2 and adds no caution of its own. Their cautions still pass on, and an MCD1 or MCD2 state outside its own corridor stays visible beside this one.

**What to watch next.** Whether the stochastic moves into the upper zone or the lower zone, and whether the nested share of the window holds.

## Consolidated uptrend, upper zone of the M15 corridor

**State code:** `MCD3_BULL_TOP`. Regime word BULLISH_CONSOLIDATED_OVERBOUGHT. The sensor's own bias is NEUTRAL.

**What it says.** Both channels slope up and are nested, and the M15 SSA is in the upper zone, at 80 or above on the scale. The upper zone includes values over 100, where the SSA is above UOEDT. The sensor's own bias is NEUTRAL, not LONG: in the upper zone MCD3 alone suggests no side.

**What it does not say.** The word overbought is a location. It does not say that a pullback is due, that the rise is over, or that it will continue. The NEUTRAL bias is not a bearish bias.

**With the other sensors.** MCD1 and MCD2 may still carry a LONG bias in the same cycle. The synthesis weighs the three readings, and the upper-zone position is shown beside the LONG bias of the other two.

**What to watch next.** Whether the stochastic falls back to the middle zone, whether it passes 100, and whether the nesting of the corridors holds.

## Consolidated downtrend, upper zone of the M15 corridor

**State code:** `MCD3_BEAR_PREMIUM`. Regime word BEARISH_CONSOLIDATED_PREMIUM_ZONE. The sensor's own bias is SHORT.

**What it says.** Both channels slope down and are nested, and the M15 SSA is in the upper zone of the M15 corridor, at 80 or above on the scale. The upper zone includes values over 100.

**What it does not say.** The word premium is a location. It does not say that price is expensive or that a fall is due. The bias SHORT follows the consolidated downtrend.

**With the other sensors.** MCD1 and MCD2 both say down, by construction. Cautions in either, or an MCD0 defect on M5 or M15, pass on to this reading as CAUTIONARY with the reason.

**What to watch next.** Whether the stochastic falls toward the middle zone, whether it passes 100, and whether trend agreement or nesting fails.

## Consolidated downtrend, middle zone of the M15 corridor

**State code:** `MCD3_BEAR_MID`. Regime word BEARISH_CONSOLIDATED_EQUILIBRIUM. The sensor's own bias is SHORT.

**What it says.** Both channels slope down and are nested, and the M15 SSA is in the middle zone, above 20 and below 80 on the scale. The two timeframes agree on the direction and the SSA is away from both edges of the M15 corridor.

**What it does not say.** The middle zone is a position, not a verdict on value, and it does not say that price will stay there or that the fall will go on. The bias SHORT follows the consolidated downtrend.

**With the other sensors.** MCD3 confirms the direction of MCD1 and MCD2 and adds no caution of its own. Cautions in either still pass on with their reasons, and an MCD1 or MCD2 state outside its own corridor stays visible beside this one.

**What to watch next.** Whether the stochastic moves toward the upper zone or the lower zone, whether the nested share of the window holds, and whether either slope approaches the five degree band, which would end the agreement.

## Consolidated downtrend, lower zone of the M15 corridor

**State code:** `MCD3_BEAR_BOTTOM`. Regime word BEARISH_CONSOLIDATED_OVERSOLD. The sensor's own bias is NEUTRAL.

**What it says.** Both channels slope down and are nested, and the M15 SSA is in the lower zone, at 20 or below on the scale. The lower zone includes values under 0. The sensor's own bias is NEUTRAL, not SHORT: in the lower zone MCD3 alone suggests no side.

**What it does not say.** The word oversold is a location. It does not say that a bounce is due or that the fall is over, and NEUTRAL is not a bullish bias.

**With the other sensors.** MCD1 and MCD2 may still carry a SHORT bias in the same cycle. The synthesis weighs the three readings, and the lower-zone position is shown beside the SHORT bias of the other two.

**What to watch next.** Whether the stochastic rises toward the middle zone, whether it stays under 0, and whether the nesting holds.

## Consolidated sideways, M5 corridor inside the M15 corridor

**State code:** `MCD3_SIDEWAYS_EQUILIBRIUM`. Regime word SIDEWAYS_CONSOLIDATED_EQUILIBRIUM. The sensor's own bias is NEUTRAL.

**What it says.** Both channels are flat, within five degrees either way, and nested. The stochastic is given, but it has no zones in this state: one state covers every position of the SSA.

**What it does not say.** It does not say that a breakout is near or that the range will hold. The agreement of two flat channels says that over both fitted windows price has had no net direction.

**With the other sensors.** MCD1 and MCD2 each say sideways, by construction. Their positions against the corridors, inside or outside, are reported separately.

**What to watch next.** The stochastic position within the range, a slope that leaves the five degree band on either timeframe, and the nested share of the window.

## Trend conflict between the two timeframes

**State code:** `MCD3_NON_CONSOLIDATED_TREND_CONFLICT`. Regime word TREND_MISALIGNMENT. The sensor's own bias is STAND_ASIDE.

**What it says.** The M15 and M5 channels slope in different directions, or one is flat and the other slopes, so condition 1 fails. There is no consolidated trend and no stochastic.

**What it does not say.** STAND_ASIDE is the sensor's own position, that the readings do not support one direction. It is not a prediction about price. Either timeframe may be right about its own channel.

**With the other sensors.** MCD1 and MCD2 each remain valid readings of their own timeframes, and they are the two that disagree. An example is an M15 channel sloping down while the M5 channel slopes up, or the reverse.

**What to watch next.** Whether the M5 slope aligns with the M15 slope after a refit, or the M15 slope changes. The conflict ends only when the two trend words are the same.

## Overflow: the M5 corridor is often outside M15

**State code:** `MCD3_NON_CONSOLIDATED_OVERFLOW`. Regime word INSUFFICIENT_CORRIDOR_NESTING. The sensor's own bias is STAND_ASIDE.

**What it says.** The channels slope the same way, but the M5 corridor lies inside the M15 corridor on fewer than three quarters of the bars of the window. Condition 1 holds and condition 2 fails. No stochastic is given.

**What it does not say.** The agreement of the slopes is real. The state says that the two corridors do not fit together over the window, not that either one is wrong.

**With the other sensors.** MCD1 and MCD2 can both be clean readings in the same direction while MCD3 stands aside. The synthesis can still use their agreement, with this noted.

**What to watch next.** Whether the nested share rises as older bars leave the window, whether a refit of the M5 channel narrows its corridor, or a refit of M15 widens its own.

## Escape: the latest M5 corridor extends beyond M15

**State code:** `MCD3_NON_CONSOLIDATED_ESCAPE`. Regime word CURRENT_CORRIDOR_ESCAPE. The sensor's own bias is STAND_ASIDE.

**What it says.** The channels slope the same way and enough bars of the window are nested, but on the latest closed bars the M5 corridor extends beyond the M15 corridor, above its UOEDT or below its LOEDT. Conditions 1 and 2 hold and condition 3 fails.

**What it does not say.** It does not say that the earlier nesting was wrong, and it does not say that price is breaking out. The state compares the corridor lines of the two channels, not where price sits.

**With the other sensors.** MCD1 and MCD2 may agree and be inside their corridors. The synthesis notes the stand-aside reading beside them.

**What to watch next.** Whether the next fit of the M5 corridor falls back inside the M15 corridor, or the M15 corridor is refitted wider. The state clears when the latest M5 corridor is inside again.

## When MCD3 gives no state

MCD3 fails to read when its own inputs are unsound or an upstream reading is unusable. The board then shows a status and a reason instead of a state, and the reading says nothing about the market.

The reasons are INSUFFICIENT_BARS for a channel with too little history, CONTAINMENT_LOW when either channel holds fewer than 50% of its bars, DISCONTINUITY, NO_SETTING, STALE data, and, from the inputs it reads, UPSTREAM_UNAVAILABLE or UPSTREAM_STALE with the sensor named. An upstream caution gives UPSTREAM_CAUTIONARY and a state with the reading CAUTIONARY.

MCD3 runs its own checks before it looks at the upstream readings, so a shared problem such as a missing statistics row is reported with MCD3's own reason, the same as MCD1 or MCD2 would give. The UPSTREAM reasons appear when MCD3's own inputs are sound and an upstream reading is not.

A non-consolidated state is not a failure. It is a reading, and a valid one. A failure is a status, not a state. MCD3 is not required: if it is neither VALID nor CAUTIONARY it is left out and shown as unavailable.
