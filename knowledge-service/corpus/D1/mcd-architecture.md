---
id: d1-mcd-architecture
domain: D1
mcd_id: null
state_codes: []
timeframe: null
version: 1.0.0
related:
  - d1-channels-and-corridors.the-corridor-uoedt-baseline-and-loedt
  - d1-data-statuses.what-makes-a-reading-cautionary
---

# The MCD sensors

## One question per sensor

An MCD is a sensor. Each cycle it turns the same closed bars into one reading with a fixed shape: a status, a state code, a regime word, a bias, a few price levels, a one-line summary and a plain-English description. Every sensor answers one question about the market, and the answers are kept in one format so they can be compared and stored. The sensors are numbered MCD0 to MCD3.

They fall into four layers, from the foundation up. MCD0 is a gate that judges whether the channels can be trusted. MCD1 reads the M15 channel, the primary structure. MCD2 reads the M5 channel, the timing structure, and how far the M5 reading has moved out of its corridor. MCD3 is derived: it reads MCD1 and MCD2 and asks whether the two timeframes agree and nest.

Each layer sits on the one below it. A fit defect found by MCD0 cautions the channel sensors that read the same timeframe. MCD3 can only be as sound as the two readings it is built from.

All four describe market structure from closed bars. None of them predicts, and none of them issues an instruction. The final direction of a cycle is decided later, by rules, and the sensors supply the evidence for it.

## MCD0: the fit gate

MCD0 asks whether each timeframe's active channel is fitted well enough to trust the channel sensors. It judges the M5 channel and the M15 channel, and for each of them tests four pillars on each of two models, Model A, which uses the SSA crossings, and Model B, which uses the close price. The pillars are coverage, R-squared, the fit ratio and symmetry, which means the geo ratio and the skew.

A timeframe is either qualified or a defect. It is a defect when any applied pillar fails, and no pillar can make up for another. MCD0 has four states, the four combinations of the two verdicts. Its bias is always NEUTRAL, it gives no level and no direction, and it takes no part in a vote. Its effect is a caution: the channel sensors that read a defective timeframe report CAUTIONARY with the reason MCD0_DEFECT_M5 or MCD0_DEFECT_M15.

MCD0 is explained when a trader asks about the quality of a channel. It is not used to read direction or timing.

## MCD1: the M15 primary structure

MCD1 asks which way the active M15 channel slopes and what the latest closed M15 bars did against its corridor: stay inside it, break out in the direction of the slope, or break out against the slope. It is the primary structure for a Day Trader and the timing channel for a Scalper.

It reads the close of each closed M15 bar over a micro window of at least 96 bars. It has nine states: three trends, up, down and sideways, each with three positions, inside the corridor, an upper breakout and a lower breakdown. It gives the three M15 levels, UOEDT, the baseline and LOEDT, and one of five regime words. Its bias follows the trend while price is inside the corridor, and follows the direction of a break when price is outside.

A latest close outside the corridor on the counter side, without the sustained-break rule met, still reads as inside: a single stray close is treated as a possible false break. The forming M15 bar never enters the reading.

MCD1 supplies the M15 trend that MCD3 reads, and its levels help to form the entry zones.

## MCD2: the M5 corridor deviation

MCD2 asks which way the active M5 channel slopes and where the channel's smoothed SSA line, or the close for the fractal channel, sits against the M5 corridor on the latest closed M5 bar. It is the primary structure for a Scalper and the timing channel for a Day Trader.

It has nine states in the same pattern as MCD1: three trends, each inside the corridor, above it or below it. The test is a single latest closed bar, with no sustained-break rule. It gives the three M5 levels. Its bias is by trend: an uptrend is LONG, a downtrend is SHORT and a sideways channel is NEUTRAL, wherever the SSA sits. A reading outside the corridor also sets a neutral flag, reversion_setup, which describes the position and measures nothing yet.

Because the test is a single bar, an MCD2 state outside the corridor can appear and disappear from one cycle to the next. That is how the sensor is built: it shows a fast, short-horizon deviation, and it is read next to the M15 structure and not alone.

MCD2 supplies the M5 trend that MCD3 reads, and its levels also help to form the entry zones.

## MCD3: agreement and nesting of M15 and M5

MCD3 asks whether the M15 and M5 channels agree and nest, and, if they do, where the M15 SSA sits within the M15 corridor. It is derived: it declares MCD1 and MCD2 as inputs and reads their readings of the same cycle instead of recomputing them. It modifies and does not vote: a consolidated trend confirms the direction of the other two sensors, and a failure adds caution.

A consolidated trend needs three conditions. The two trends are the same. The M5 corridor lies inside the M15 corridor on at least three quarters of the bars of the window. And the latest M5 corridor lies inside the latest M15 corridor. When all three hold, the EDT stochastic places the M15 SSA in a lower, middle or upper zone, giving seven consolidated states. When a condition fails, the state is one of three non-consolidated ones, and its bias is STAND_ASIDE. MCD3 carries the levels of both timeframes: UOEDT, the baseline and LOEDT for M15 and for M5.

## How the sensors run and what a bias is

Each cycle the sensor worker runs MCD0 first, then the independent sensors, then the derived one. A sensor is never run for a question: the readings are made once per cycle and stored, and a stored cycle replayed gives the same readings again.

A sensor can fail to read. When its inputs are missing or unsound it reports INVALID or STALE with a reason code instead of a state, and a derived sensor reports the reason of the upstream reading it could not use. Every reading, including a failed one, is saved for the cycle, so the board always shows what each sensor said and why.

A bias is one of four words: LONG, SHORT, NEUTRAL or STAND_ASIDE. It is what that sensor alone suggests from its own state. It is not the cycle's direction. Direction comes from the synthesis, which applies a fixed order of precedence: the primary-timeframe structure first, then support and resistance, then the other timeframe's channel, then oscillators. MCD3 sits in the oscillator rung as a modifier. A sensor saying STAND_ASIDE is always shown in full, and a sensor that opposes the synthesis keeps its full reading as well.
