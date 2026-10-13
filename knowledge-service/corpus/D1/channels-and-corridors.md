---
id: d1-channels-and-corridors
domain: D1
mcd_id: null
state_codes: []
timeframe: null
version: 1.0.0
related:
  - d1-closed-bar-rule.what-a-closed-bar-is
  - d1-mcd-architecture.one-question-per-sensor
---

# Channels and corridors

## Terms the sensors use

UOEDT is the Upper Outermost Equidistant Trendline: the upper edge of the corridor.

LOEDT is the Lower Outermost Equidistant Trendline: the lower edge of the corridor.

The baseline is the fitted line in the middle of the channel. UOEDT and LOEDT run parallel to it.

The corridor is the band between LOEDT and UOEDT. The channel is the baseline together with its corridor, drawn by the chart indicator for one timeframe.

Channel position, CP, says where a value sits in the corridor: 0 on LOEDT and 1 on UOEDT.

SSA is the smoothed trendline that the indicator draws from Singular Spectrum Analysis. It moves with less noise than the close.

The regression angle is the slope of the baseline in degrees. The trend band is plus and minus 5 degrees around flat.

T_EDT is the number of rows on which the channel exists. The containment rate is the share of the channel's bars that closed inside the corridor.

The micro window is the run of closed M15 bars that MCD1 judges, at least 96 bars. The EDT stochastic is the position of the M15 SSA in the M15 corridor on a scale from 0 to 100.

## What a channel is

A channel is the sloping band that the chart indicator draws around price. Stack D reads one channel per timeframe: the active indicator for M15 and the active indicator for M5, each named by an admin setting that holds from a stated slot. Most active indicators are centroid regressions. The indicator finds the points where a smoothed price line crosses its signal line, groups those points into clusters called centroids, and fits a straight regression line through them. The fractal variant fits a best flip line through fractal highs and lows instead.

The fitted line is the baseline. Two more lines run parallel to it at fixed distances: UOEDT above it and LOEDT below it. The names stand for the Upper and the Lower Outermost Equidistant Trendline, and they are never translated. The band between LOEDT and UOEDT is the corridor. Every Stack D sensor describes where price sits relative to some corridor, and every entry zone is built from the three lines UOEDT, baseline and LOEDT.

A channel describes the recent past by a fixed rule. It is not a forecast, and its lines are not orders from the market.

## The slope and the five-degree trend band

The slope of the baseline is reported as a regression angle in degrees: positive when the line rises from left to right, negative when it falls. The sensors turn the angle into a trend word with one band. An angle above +5 degrees is an uptrend. An angle below -5 degrees is a downtrend. An angle from -5 to +5 degrees, both ends included, is sideways. MCD0, MCD1 and MCD2 use this same band. MCD3 does not apply it a second time: it reads the trend words that MCD1 and MCD2 have already produced.

The angle belongs to one fit, so two channels on the same chart can have different angles. The M15 channel and the M5 channel are separate fits with separate slopes. When they point in different directions the two timeframes disagree, and MCD3 reports a trend conflict.

A flat channel is not a broken channel. A sideways reading says that over the fitted window price moved without a net direction. Because a flat line explains almost none of the price movement through its slope, the quality gate MCD0 does not apply its R-squared test to a flat channel.

## The corridor: UOEDT, baseline and LOEDT

UOEDT is the upper edge of the corridor, LOEDT is its lower edge, and the baseline is the fitted line between them. Over the channel's window the baseline is a straight line, baseline(t) = a + b*t, where b is the slope per bar. UOEDT and LOEDT are that line moved up and down by two fixed offsets: UOEDT(t) = baseline(t) + u and LOEDT(t) = baseline(t) - d, with u and d above zero. The offsets do not change from bar to bar, so the three lines are parallel and the corridor has the same width on every bar of one fit: width = UOEDT - LOEDT = u + d.

The channel position of a value p on a bar is CP = (p - LOEDT) / (UOEDT - LOEDT), with the lines taken on that bar. CP is 0 on LOEDT and 1 on UOEDT. Below 0 the value is under the corridor and above 1 it is over it. The baseline sits at CP = d / (u + d), which is one half only when the corridor is symmetric, that is when u equals d. The geo ratio of MCD0, u divided by d, measures that symmetry.

The sensors lay different values against the same corridor. MCD1 uses the close of a bar. MCD2 uses the channel's own smoothed line, called SSA after the Singular Spectrum Analysis that draws it, and uses the close only for the fractal channel. MCD3 uses the M15 SSA. The corridor is the ruler; each sensor decides what to lay against it.

## Inside, outside and a sustained break

A value is inside the corridor when it lies between LOEDT and UOEDT, the edges included. An inside reading is the ordinary one. A value above UOEDT is above the corridor and a value below LOEDT is below it. The outermost lines are the envelope of normal movement: anything beyond them is an excursion, and the sensors treat an excursion with different strictness.

MCD2 looks at one thing, the latest closed M5 bar. If its SSA is outside the corridor, the state says so at once. MCD1 separates a passing excursion from a sustained one. A close beyond the corridor in the direction of the slope counts on the latest bar alone. A close beyond the corridor against the slope, or beyond a flat corridor, counts only when at least 80% of the bars in the micro window closed on that side. The micro window is the larger of 96 closed M15 bars and 5% of the channel length, so a few hours of news do not turn a state.

These rules describe where price closed. A close outside the corridor is not a prediction that price will go further or come back, and a close inside is not a promise that it will stay there.

## Width, containment and refits

Within one fit the width is constant. From one cycle to the next the indicator can refit: the slope, the baseline and the width can all change as new bars arrive. The lines drawn behind the latest bar are today's fit projected back over the window, not what the chart showed at the time. A state measured on re-fitted history would look better than it was, which is why the project keeps a separate point-in-time history for certification.

A wider corridor needs a larger move to leave it and a narrower one is left more easily. Channel position removes that scale, so one number compares a bar against corridors of different widths.

The containment rate is the share of the bars in the channel's window that closed inside the corridor. A channel with containment below 50% is not counted as intact: the channel sensors do not read it and the reading is INVALID with the reason CONTAINMENT_LOW. The channel length T_EDT counts the rows on which the channel exists, and the last of those rows is the bar still forming, so on closed bars the channel holds T_EDT minus one bars.
