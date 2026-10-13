---
id: d2-mcd1-playbook
domain: D2
mcd_id: MCD1
state_codes:
  - MCD1_UP_IN_CORRIDOR
  - MCD1_UP_UPPER_BREAKOUT
  - MCD1_UP_LOWER_BREAKDOWN
  - MCD1_DOWN_IN_CORRIDOR
  - MCD1_DOWN_LOWER_BREAKDOWN
  - MCD1_DOWN_UPPER_BREAKOUT
  - MCD1_SIDEWAYS_IN_CORRIDOR
  - MCD1_SIDEWAYS_UPPER_BREAKOUT
  - MCD1_SIDEWAYS_LOWER_BREAKDOWN
timeframe: M15
version: 1.0.0
related:
  - d1-channels-and-corridors.terms-the-sensors-use
  - d1-channels-and-corridors.the-corridor-uoedt-baseline-and-loedt
  - d1-channels-and-corridors.inside-outside-and-a-sustained-break
  - d1-mcd-architecture.mcd1-the-m15-primary-structure
  - d1-closed-bar-rule.what-a-closed-bar-is
---

# MCD1 playbook: the M15 primary trend

## What MCD1 measures

MCD1 is the M15 sensor. It asks two things of the active M15 channel. Which way does the channel slope, and what did the latest closed M15 bars do against its corridor, the band between LOEDT and UOEDT: stay inside it, break out in the direction of the slope, or break out against the slope?

The answer is one of nine states, three trends crossed with three positions. The trend is up, down or sideways, set by the regression angle against the plus and minus five degree band. The position is inside the corridor, an upper breakout above UOEDT, or a lower breakdown below LOEDT. MCD1 measures with the close of each closed M15 bar. The bar still forming is never read.

Each state carries a regime word, a bias and the three M15 levels, UOEDT, the baseline and LOEDT. The bias follows one rule. While price is inside the corridor, the bias follows the trend: up is LONG, down is SHORT and sideways is NEUTRAL. When price is outside, the bias follows the direction of the break: above UOEDT is LONG and below LOEDT is SHORT. No MCD1 state is STAND_ASIDE.

For a Day Trader MCD1 is the primary structure. For a Scalper it is the timing channel behind the M5 structure. MCD1 describes where price closed. The direction of a cycle is decided later, by the synthesis, and MCD1 is one of its inputs.

## The micro window and the sustained break

MCD1 judges the recent behaviour over a micro window of closed M15 bars. The window is the larger of 96 bars and 5% of the channel length. Ninety-six M15 bars are one full trading day, long enough that two or three hours of news cannot decide a state. The channel must hold the whole window in closed bars, or the reading is INVALID with the reason INSUFFICIENT_BARS.

A bar is above when its close is higher than UOEDT, below when its close is lower than LOEDT, and inside otherwise. A side counts as sustained when at least 80% of the window closed on that side. For a window of 96 bars that is 77 bars, and 76 bars is not enough.

The two kinds of break are treated differently on purpose. A break in the direction of the slope is read from the latest bar alone: if the latest closed bar is beyond the corridor on the slope's side, the state shows it at once. A break against the slope, and any break of a flat channel, needs the sustained rule as well as the latest bar. A latest close that is outside on the counter side without the sustained rule met still reads as inside the corridor. That filters out a false break, such as a spike during news that closes back within hours.

The rule shapes how to read a state. A same-slope breakout can be a single bar. A counter-trend or sideways breakout is a state that has already lasted most of a day.

## M15 uptrend, price inside the corridor

**State code:** `MCD1_UP_IN_CORRIDOR`. Regime word TREND_ALIGNED_CONTINUATION. The sensor's own bias is LONG.

**What it says.** The M15 channel slopes up by more than five degrees, and the latest closed M15 bar closed inside the corridor between LOEDT and UOEDT. The state also covers a latest close below LOEDT that has not met the sustained rule, because one stray close below the lower edge is treated as a possible false break. The regime word names the setting, price behaving within a rising channel. It does not name an outcome.

**What it does not say.** It does not say that the rise will continue, that price will move toward UOEDT, or that this is a moment to enter. Being inside the corridor is the ordinary condition of a channel and carries no timing information by itself.

**With the other sensors.** An M5 channel that also slopes up agrees with this reading. An M5 channel that slopes down is a timeframe conflict, and MCD3 reports it as a trend conflict and stands aside. A CAUTIONARY status, for example from an MCD0 defect on M15, means the fit behind the corridor deserves care.

**What to watch next.** Where later closes sit between LOEDT and UOEDT, whether they move toward the baseline or the lower edge, and whether a close appears above UOEDT, which makes the state an upper breakout. A slope that falls toward the five degree band would change the trend word to sideways.

## M15 uptrend, close above the corridor

**State code:** `MCD1_UP_UPPER_BREAKOUT`. Regime word BREAKOUT_SAME_SLOPE. The sensor's own bias is LONG.

**What it says.** The M15 channel slopes up and the latest closed M15 bar closed above UOEDT, beyond the corridor in the direction of the slope. This is judged on the latest bar alone. The channel position of that bar is above 1. The count of earlier bars above UOEDT is reported, and it may be small.

**What it does not say.** One close above UOEDT is not a confirmed breakout, not a sign that the trend is accelerating, and not a sign that it is exhausted. It says only where the last bar closed. The bias LONG follows the direction of the break, while the synthesis reads this regime word with care and can reach a different direction than the sensor's own bias.

**With the other sensors.** If the M5 sensor is also outside its own corridor on the upper side, both timeframes are stretched in the same direction. If the M5 corridor extends beyond the M15 corridor, MCD3 reports a non-consolidated escape and stands aside.

**What to watch next.** Whether the next closed bars return inside the corridor or add more closes above UOEDT, how many bars of the window are above it, and whether the slope stays above the five degree band.

## M15 uptrend, sustained close below the corridor

**State code:** `MCD1_UP_LOWER_BREAKDOWN`. Regime word COUNTER_TREND_EXPANSION. The sensor's own bias is SHORT.

**What it says.** The M15 channel still slopes up, the latest closed bar is below LOEDT, and at least 80% of the micro window closed below LOEDT. Price has spent most of a trading day under the lower edge of a channel that points up. The break is against the slope and has met the sustained rule.

**What it does not say.** It does not say that the uptrend has ended. The slope comes from a fit over a longer window and can lag price. The word expansion labels price moving outside the corridor. It forecasts no further fall and no return.

**With the other sensors.** The synthesis looks at whether the M5 trend runs in the direction of the break, which here is down. An M5 channel that slopes down while the M15 channel slopes up is a trend conflict, and MCD3 reports it and stands aside. A defect found by MCD0 on M15 makes this reading CAUTIONARY.

**What to watch next.** The containment rate: below 50% the channel is not counted as intact and MCD1 gives no state. Closes that return above LOEDT bring the share below 80% and the state back to inside the corridor. A later refit can change the slope itself.

## M15 downtrend, price inside the corridor

**State code:** `MCD1_DOWN_IN_CORRIDOR`. Regime word TREND_ALIGNED_CONTINUATION. The sensor's own bias is SHORT.

**What it says.** The M15 channel slopes down by more than five degrees, and the latest closed M15 bar closed inside the corridor, or above UOEDT without the sustained rule met. A single close above the upper edge in a falling channel is treated as a possible false break and still reads as inside.

**What it does not say.** It does not say that the fall will continue or that price is about to reach LOEDT. Inside the corridor, position carries little timing information.

**With the other sensors.** An M5 channel that also slopes down agrees. An M5 channel sloping up is a trend conflict for MCD3. An MCD0 defect on M15 makes this reading CAUTIONARY, with the reason shown.

**What to watch next.** Where closes sit relative to the baseline and the upper edge, a close below LOEDT, which makes the state a lower breakdown, and a slope that rises toward the five degree band, which would change the trend word to sideways.

## M15 downtrend, close below the corridor

**State code:** `MCD1_DOWN_LOWER_BREAKDOWN`. Regime word BREAKOUT_SAME_SLOPE. The sensor's own bias is SHORT.

**What it says.** The M15 channel slopes down and the latest closed M15 bar closed below LOEDT, beyond the corridor in the direction of the slope. Like the upward case, it is judged on the latest bar alone, and the channel position of that bar is below 0.

**What it does not say.** A single close below LOEDT does not confirm a lasting break or an accelerating fall, and it does not say the move is spent. The synthesis reads this regime word with care, so its direction can differ from the bias of the sensor.

**With the other sensors.** The M5 sensor outside its own corridor on the lower side means both timeframes are stretched downward. A non-consolidated escape from MCD3 means the M5 corridor lies beyond the M15 corridor.

**What to watch next.** Whether the next closes return inside the corridor or add further closes below LOEDT, how many bars of the window are below it, and whether the slope stays below minus five degrees.

## M15 downtrend, sustained close above the corridor

**State code:** `MCD1_DOWN_UPPER_BREAKOUT`. Regime word COUNTER_TREND_EXPANSION. The sensor's own bias is LONG.

**What it says.** The M15 channel still slopes down, the latest closed bar is above UOEDT, and at least 80% of the micro window closed above UOEDT. Price has spent most of a trading day above the upper edge of a channel that points down. The break is against the slope and has met the sustained rule.

**What it does not say.** It does not say that the downtrend has ended or that a rally will follow. The slope can lag price because it is fitted over a longer window.

**With the other sensors.** The synthesis looks at whether the M5 trend runs in the direction of the break, which here is up. An M5 channel that slopes up while the M15 channel slopes down is a trend conflict, and MCD3 reports it and stands aside. An MCD0 defect on M15 makes the reading CAUTIONARY.

**What to watch next.** The containment rate, because under 50% the channel is no longer counted as intact. Closes that fall back below UOEDT lower the share under 80%. The next refit can change the channel's slope and its corridor.

## M15 sideways, price inside the corridor

**State code:** `MCD1_SIDEWAYS_IN_CORRIDOR`. Regime word CONSOLIDATION. The sensor's own bias is NEUTRAL.

**What it says.** The M15 channel is flat, within five degrees either way, and the latest closed bar closed inside the corridor, or outside it without the sustained rule met. This is the only NEUTRAL state of MCD1. Price is moving within a range and the sensor sees no net direction.

**What it does not say.** A flat reading is not a sign that a breakout is near, and a quiet range does not by itself point to a direction. The state says only that over the fitted window price has had no net slope.

**With the other sensors.** A sideways M15 channel with a sideways M5 channel gives MCD3 a consolidated sideways state when the corridors nest. An M5 channel with a slope against a flat M15 channel is a trend conflict.

**What to watch next.** Closes near the upper or lower edge, a sustained run of closes outside either edge, and any change of slope beyond the five degree band, which would turn the trend word to up or down.

## M15 sideways, sustained close above the corridor

**State code:** `MCD1_SIDEWAYS_UPPER_BREAKOUT`. Regime word RANGE_EXPANSION. The sensor's own bias is LONG.

**What it says.** The M15 channel is flat, the latest closed bar is above UOEDT, and at least 80% of the micro window closed above UOEDT. A flat range has been left through its upper edge, and the exit has lasted most of a trading day.

**What it does not say.** It does not say that a new uptrend has begun, and the flat slope has not been refitted yet. It does not say that the move will hold.

**With the other sensors.** The M5 channel's slope shows whether the shorter timeframe already points up. A sloping M5 channel against a flat M15 channel is a trend conflict for MCD3. An M5 corridor that lies inside the M15 corridor on enough of its bars is nested, while one that extends beyond it is a non-consolidated escape.

**What to watch next.** Whether closes stay above UOEDT or return inside, whether the refitted channel begins to slope up, and the containment rate of the channel.

## M15 sideways, sustained close below the corridor

**State code:** `MCD1_SIDEWAYS_LOWER_BREAKDOWN`. Regime word RANGE_EXPANSION. The sensor's own bias is SHORT.

**What it says.** The M15 channel is flat, the latest closed bar is below LOEDT, and at least 80% of the micro window closed below LOEDT. A flat range has been left through its lower edge, and the exit has lasted most of a trading day.

**What it does not say.** It does not say that a new downtrend has begun or that the move will hold, and the flat slope has not been refitted yet.

**With the other sensors.** The M5 channel's slope shows whether the shorter timeframe already points down. Nesting of the M5 corridor in the M15 corridor, or its failure, is reported by MCD3.

**What to watch next.** Whether closes stay below LOEDT or return inside, whether the refitted channel begins to slope down, and the containment rate.

## When MCD1 gives no state

MCD1 can fail to read, and then the board shows a status and a reason instead of a state. An unavailable reading says nothing about the market.

INVALID with INSUFFICIENT_BARS: the channel holds fewer closed bars than the micro window. INVALID with CONTAINMENT_LOW: fewer than 50% of the bars closed inside the corridor, so the channel is not counted as intact. INVALID with DISCONTINUITY: bars are missing or out of order. INVALID with NO_SETTING: no active indicator is set for M15. STALE with NO_STATS_AT_SLOT: the statistics row for the slot is missing. STALE with DATA_STALE: the cycle itself is stale.

CAUTIONARY is different: MCD1 still gives its state, with a reason attached. The reasons are MCD0_DEFECT_M15, RETUNING and DETECTION_MISMATCH. The reading is usable, and the reason says why to be careful with it.

For a Day Trader MCD1 is required. If it is neither VALID nor CAUTIONARY, the synthesis result for that trader type is STAND_ASIDE with a data reason, and the answer says that the data is missing. A state is never inferred from a neighbouring one.
