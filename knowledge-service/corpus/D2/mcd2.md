---
id: d2-mcd2-playbook
domain: D2
mcd_id: MCD2
state_codes:
  - MCD2_UP_IN_CORRIDOR
  - MCD2_UP_UPPER_BREAKOUT
  - MCD2_UP_LOWER_BREAKDOWN
  - MCD2_DOWN_IN_CORRIDOR
  - MCD2_DOWN_LOWER_BREAKDOWN
  - MCD2_DOWN_UPPER_BREAKOUT
  - MCD2_SIDEWAYS_IN_CORRIDOR
  - MCD2_SIDEWAYS_UPPER_BREAKOUT
  - MCD2_SIDEWAYS_LOWER_BREAKDOWN
timeframe: M5
version: 1.0.0
related:
  - d1-channels-and-corridors.terms-the-sensors-use
  - d1-channels-and-corridors.the-corridor-uoedt-baseline-and-loedt
  - d1-channels-and-corridors.what-a-channel-is
  - d1-mcd-architecture.mcd2-the-m5-corridor-deviation
  - d1-closed-bar-rule.what-a-closed-bar-is
---

# MCD2 playbook: the M5 trend and corridor deviation

## What MCD2 measures

MCD2 is the M5 sensor. It asks which way the active M5 channel slopes, and where the channel's smoothed SSA line sits against the M5 corridor on the latest closed M5 bar. For the fractal channel, which has no SSA line, it uses the close instead. The SSA line is a trendline drawn from Singular Spectrum Analysis, so it moves with less noise than the close.

The answer is one of nine states, three trends crossed with three positions. The trend is up, down or sideways, set by the regression angle against the plus and minus five degree band. The position is inside the corridor, above UOEDT or below LOEDT. The bias follows the trend alone: an uptrend is LONG, a downtrend is SHORT and a sideways channel is NEUTRAL, wherever the SSA sits. MCD2 has no STAND_ASIDE state.

Each state carries a regime word and the three M5 levels, UOEDT, the baseline and LOEDT. For a Scalper MCD2 is the primary structure. For a Day Trader it is the timing channel under the M15 structure.

MCD2 describes position and deviation. It describes where the smoothed line is now. It does not say what comes next, and it gives no entry. The synthesis decides the direction of the cycle, and MCD2 is one of its inputs.

## The corridor test and the outside-corridor flag

The test uses one bar only, the latest closed M5 bar. Its channel position CP is the SSA minus LOEDT, divided by the corridor width. The SSA is inside the corridor when it lies between LOEDT and UOEDT, edges included, so CP is from 0 to 1. Above UOEDT the CP is over 1 and the state is an upper breakout. Below LOEDT the CP is under 0 and the state is a lower breakdown.

There is no sustained-break rule here. A single closed bar decides the position, so MCD2 reacts faster than MCD1, and a state outside the corridor can last one cycle. That is what the sensor is for: it shows short-horizon deviation, read next to the M15 structure.

In the six states outside the corridor a neutral flag, reversion_setup, is raised. It marks the position. It is not a measurement: how often price returns toward the baseline after such a position has not been measured, and no number is given until the state statistics have enough readings. The regime names that contain the words overextension, reversion, dip or rally are location words in the same way.

The statistics behind the corridor use up to 24 hours of closed M5 bars, and the channel must hold at least 48 closed bars, or the reading is INVALID with the reason INSUFFICIENT_BARS.

## M5 uptrend, SSA inside the corridor

**State code:** `MCD2_UP_IN_CORRIDOR`. Regime word TREND_ALIGNED_CONTINUATION. The sensor's own bias is LONG.

**What it says.** The M5 channel slopes up by more than five degrees and the SSA of the latest closed M5 bar lies inside the corridor, between LOEDT and UOEDT. The channel position is between 0 and 1. The regime word names a position within a rising channel.

**What it does not say.** It does not say that the rise will go on, that the SSA is heading for UOEDT, or that this is the moment to enter. An inside position is the ordinary condition and carries little timing information on its own.

**With the other sensors.** MCD1 reads the M15 trend. An M15 channel that also slopes up agrees. An M15 channel that slopes down is a trend conflict, and MCD3 stands aside. A CAUTIONARY status, for example from an MCD0 defect on M5, means the M5 fit deserves care.

**What to watch next.** Whether the channel position drifts toward 1 or toward 0, whether the next closed bar leaves the corridor on either side, and whether the slope approaches the five degree band.

## M5 uptrend, SSA above the corridor

**State code:** `MCD2_UP_UPPER_BREAKOUT`. Regime word UPPER_OVEREXTENSION_REVERSION. The sensor's own bias is LONG.

**What it says.** The M5 channel slopes up and the SSA of the latest closed M5 bar is above UOEDT, beyond the corridor in the direction of the slope. The channel position is over 1 and the flag reversion_setup is raised. It is a single-bar reading.

**What it does not say.** It does not say that the move has gone too far, that it will reverse, or that it will continue. The word overextension names the position. The bias LONG follows the trend, and the synthesis can read this regime word as a stretched move and reach a direction different from the bias of the sensor.

**With the other sensors.** MCD3 compares the two corridors, not where the SSA sits, so it can report nested corridors while MCD2 is outside its own. An M15 reading inside its corridor shows that the larger structure is not stretched at the same time.

**What to watch next.** Whether the next closed bar returns inside the corridor or stays above UOEDT, and where the position of the M15 reading sits at the same time.

## M5 uptrend, dip below the corridor

**State code:** `MCD2_UP_LOWER_BREAKDOWN`. Regime word UPTREND_DIP_BELOW_CORRIDOR. The sensor's own bias is LONG.

**What it says.** The M5 channel slopes up and the SSA of the latest closed M5 bar is below LOEDT, beyond the corridor against the direction of the slope. The channel position is under 0 and reversion_setup is raised. The regime word is a location: the SSA is below the lower edge of a rising channel.

**What it does not say.** The bias LONG follows the trend of the channel. It does not say that the dip is over or that price will rise. A position below LOEDT can also be the first sign that the channel is failing or that it will be refitted, and one closed bar cannot tell these apart.

**With the other sensors.** An M15 reading that is inside its corridor on an uptrend puts the dip inside a larger structure. A sustained close of M15 below its corridor means both timeframes are under their lower edges. An MCD0 defect on M5 makes the reading CAUTIONARY.

**What to watch next.** Whether the position returns to 0 or above, whether further closed bars stay below LOEDT, and whether the slope turns toward the five degree band.

## M5 downtrend, SSA inside the corridor

**State code:** `MCD2_DOWN_IN_CORRIDOR`. Regime word TREND_ALIGNED_CONTINUATION. The sensor's own bias is SHORT.

**What it says.** The M5 channel slopes down by more than five degrees and the SSA of the latest closed M5 bar lies inside the corridor. The channel position is between 0 and 1. The regime word names a position within a falling channel.

**What it does not say.** It does not say that the fall will go on, that the SSA is heading for LOEDT, or that this is the moment to enter. Inside the corridor the reading carries little timing information.

**With the other sensors.** An M15 channel that also slopes down agrees. An M15 channel that slopes up is a trend conflict for MCD3. An MCD0 defect on M5 makes the reading CAUTIONARY.

**What to watch next.** Whether the position moves toward 0 or toward 1, whether the next closed bar leaves the corridor, and whether the slope rises toward the five degree band.

## M5 downtrend, SSA below the corridor

**State code:** `MCD2_DOWN_LOWER_BREAKDOWN`. Regime word LOWER_OVEREXTENSION_REVERSION. The sensor's own bias is SHORT.

**What it says.** The M5 channel slopes down and the SSA of the latest closed M5 bar is below LOEDT, beyond the corridor in the direction of the slope. The channel position is under 0 and reversion_setup is raised. It is a single-bar reading.

**What it does not say.** It does not say that the fall is spent, that it will reverse, or that it will continue. The bias SHORT follows the trend, and the synthesis can read this regime word as a stretched move and reach a direction different from the bias of the sensor.

**With the other sensors.** MCD3 compares the corridors, so it can report them nested while MCD2 is outside its own. The M15 reading shows whether the larger structure is also stretched.

**What to watch next.** Whether the next closed bar returns inside the corridor or stays below LOEDT, and what the M15 position is at the same time.

## M5 downtrend, rally above the corridor

**State code:** `MCD2_DOWN_UPPER_BREAKOUT`. Regime word DOWNTREND_RALLY_ABOVE_CORRIDOR. The sensor's own bias is SHORT.

**What it says.** The M5 channel slopes down and the SSA of the latest closed M5 bar is above UOEDT, beyond the corridor against the direction of the slope. The channel position is over 1 and reversion_setup is raised. The regime word is a location: the SSA is above the upper edge of a falling channel.

**What it does not say.** The bias SHORT follows the trend of the channel. It does not say that the rally is finished or that price will fall. A position above UOEDT can also be an early sign that the channel is failing or will be refitted.

**With the other sensors.** An M15 reading inside its corridor on a downtrend puts the rally inside a larger structure. A sustained close of M15 above its corridor means both timeframes are above their upper edges. An MCD0 defect on M5 makes the reading CAUTIONARY.

**What to watch next.** Whether the position falls back to 1 or below, whether further closed bars stay above UOEDT, and whether the slope turns toward the five degree band.

## M5 sideways, SSA inside the corridor

**State code:** `MCD2_SIDEWAYS_IN_CORRIDOR`. Regime word RANGE_EQUILIBRIUM. The sensor's own bias is NEUTRAL.

**What it says.** The M5 channel is flat, within five degrees either way, and the SSA of the latest closed M5 bar lies inside the corridor. Price is moving within a range and the sensor sees no net direction on M5. It is the only NEUTRAL state of MCD2 that sits inside the corridor.

**What it does not say.** It does not say that a breakout is coming, and the word equilibrium does not mean the middle: the SSA can be anywhere between LOEDT and UOEDT. A flat reading is not a sign that the range will hold.

**With the other sensors.** A flat M15 channel with nested corridors gives MCD3 a consolidated sideways state. A sloping M15 channel against a flat M5 channel is a trend conflict.

**What to watch next.** Where the position moves between 0 and 1, closes outside either edge, and any slope beyond the five degree band.

## M5 sideways, SSA above the corridor

**State code:** `MCD2_SIDEWAYS_UPPER_BREAKOUT`. Regime word RANGE_RESISTANCE_REVERSION. The sensor's own bias is NEUTRAL.

**What it says.** The M5 channel is flat and the SSA of the latest closed M5 bar is above UOEDT. The position is over 1 and reversion_setup is raised. The regime word is a location: the smoothed line is above the upper edge of a range.

**What it does not say.** One closed bar outside a flat corridor does not say that the range has ended. MCD2 has no sustained-break rule, so it neither confirms a breakout nor rejects one. The bias is NEUTRAL because a flat channel has no trend.

**With the other sensors.** MCD1 can describe the same flat range on M15 with its own sustained rule. MCD3 reports whether the M5 corridor still nests within the M15 corridor.

**What to watch next.** Whether the next closed bar returns inside the corridor or stays above UOEDT, and whether the slope leaves the five degree band.

## M5 sideways, SSA below the corridor

**State code:** `MCD2_SIDEWAYS_LOWER_BREAKDOWN`. Regime word RANGE_SUPPORT_REVERSION. The sensor's own bias is NEUTRAL.

**What it says.** The M5 channel is flat and the SSA of the latest closed M5 bar is below LOEDT. The position is under 0 and reversion_setup is raised. The regime word is a location: the smoothed line is below the lower edge of a range.

**What it does not say.** One closed bar outside a flat corridor does not say that the range has ended. MCD2 has no sustained-break rule and no direction for a flat channel, so the bias is NEUTRAL here as in every sideways state.

**With the other sensors.** MCD1 describes the M15 channel with its own sustained rule, and MCD3 reports whether the corridors still nest.

**What to watch next.** Whether the next closed bar returns inside the corridor or stays below LOEDT, and whether the slope leaves the five degree band.

## When MCD2 gives no state

MCD2 can fail to read, and then the board shows a status and a reason instead of a state. An unavailable reading says nothing about the market.

INVALID with INSUFFICIENT_BARS: the channel holds fewer than 48 closed M5 bars. INVALID with CONTAINMENT_LOW: fewer than 50% of the bars closed inside the corridor. INVALID with DISCONTINUITY: bars are missing or out of order. INVALID with NO_SETTING: no active indicator is set for M5. STALE with NO_STATS_AT_SLOT or DATA_STALE: the statistics row or the cycle is not current.

CAUTIONARY is different: MCD2 still gives its state, with a reason attached. The reasons are MCD0_DEFECT_M5, RETUNING and DETECTION_MISMATCH.

For a Scalper MCD2 is required. If it is neither VALID nor CAUTIONARY, the synthesis result for that trader type is STAND_ASIDE with a data reason. An MCD2 reading that is unavailable also leaves MCD3 without an input, and MCD3 then reports the upstream reason.
