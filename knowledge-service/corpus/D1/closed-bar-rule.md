---
id: d1-closed-bar-rule
domain: D1
mcd_id: null
state_codes: []
timeframe: null
version: 1.0.0
related:
  - d1-channels-and-corridors.width-containment-and-refits
  - d1-data-statuses.data-statuses-of-a-cycle
---

# The closed-bar rule

## What a closed bar is

A bar is closed when its open time plus its period is at or before the slot. A slot is the five-minute moment that keys one cycle, written in UTC. At every slot the M5 bar that opened five minutes earlier has just closed, and the M5 bar that opens at the slot has started to form. M15 bars close on the quarter hours, at :00, :15, :30 and :45. At a slot that is not on a quarter hour the last closed M15 bar is older than the slot, and an unchanged M15 reading is correct.

The close of a closed bar can no longer change. The close of the bar still forming changes with every tick until the bar ends. Stack D keeps this difference sharp: sensors and the one-day price windows use closed bars only, and the bar still forming is shown once, as a labelled last price with its time, never as a close.

One day of price data means the last 288 closed M5 bars and the last 96 closed M15 bars, counted over trading bars. The gaps when the market is closed are skipped, not filled.

## Why the sensors read closed bars only

The collector reads the data a few seconds after a boundary, so the newest row is the bar that has just begun: a stub of a candle that will change before it closes. A sensor must not fire on a candle that is going to change. Four reasons follow from that.

Intrabar repainting: a state computed from a forming bar can appear and vanish within the same bar, and the reading would describe a moment that never became a close.

Whipsaw: a forming bar can cross a line and come back before it ends. Reading closes only filters that excursion out, because only a bar that ended outside counts as having been outside.

Repeatable readings: every cycle reads fixed inputs, so a stored cycle can be replayed later and gives the same reading byte for byte.

Comparable states: each state is defined on a closed bar, so a state seen now and a state counted in history mean the same thing.

The cost of the rule is a small delay. A reading is never newer than the last close, so it can trail a fast move by up to one bar: five minutes on M5 and up to fifteen minutes on M15. The project accepts that on purpose, and prefers a reading of what has closed to an early reading of a candle that has not ended.

## The reference price P_ref

P_ref is the close of the last closed M5 bar at the slot. It is the reference price of the cycle's synthesis reading, and it is labelled with the bar it came from. The forward moves that the project measures for each state start from P_ref too, so that every measurement has the same origin.

The last traded price is different. It belongs to the bar still forming and is shown once, as a last price at a stated time. It is not P_ref, it is not a close, and it can change a second later. When a question asks where price is, the answer names which of the two is meant.

Because P_ref is a close, it is a price the market actually settled at for that bar, and every stored reading names it. The data line of an answer shows P_ref together with the time of its bar, so the reader can see which close it is. Comparing a reading with a screen is therefore a comparison of P_ref and its bar time with the screen at that moment, and a difference between the two is expected whenever the forming bar has moved since the close.

Distances in an answer, such as how far a level is from price, are measured from P_ref unless the answer says otherwise.

## What the rule covers and what it does not

The rule governs the bars a sensor reads: the closes, the SSA and the corridor lines on closed bars. It does not turn the chart indicator into a closed-bar indicator. The indicator fits its channel over a window whose last element is the bar still forming, and the statistics it exports, such as the regression angle and the containment rate, come from that fit. The sensors take those statistics from the row captured at the slot and keep them, so within one cycle they do not move. How much the forming bar changes a statistic from one cycle to the next is recorded as unmeasured.

Three consequences matter when reading a state. First, a channel that exists on a given number of rows holds one fewer closed bar, because its last row is the forming bar. Second, a state describes the closed bars up to P_ref, and the next cycle can describe a refitted channel. Third, the chart draws the forming bar hollow while the sensors ignore it, so the chart can show price beyond a line while the reading still says inside. Both are correct: the chart shows the present moment and the reading describes the last close.
