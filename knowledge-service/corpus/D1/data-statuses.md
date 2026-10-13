---
id: d1-data-statuses
domain: D1
mcd_id: null
state_codes: []
timeframe: null
version: 1.0.0
related:
  - d1-closed-bar-rule.what-a-closed-bar-is
  - d1-mcd-architecture.how-the-sensors-run-and-what-a-bias-is
---

# Data statuses and sensor statuses

## Data statuses of a cycle

Every cycle carries a data status that says how far the data can be trusted right now. The gateway works it out on every read, from the clock and from the newest cycle that was declared ready.

FRESH: the cycle was ready within its deadline, normally two minutes after its slot and four minutes when the collector had to retry. Everything built on it is current.

DELAYED: the cycle was ready, but after its deadline, or the current cycle is not ready yet and the newest one is the previous slot's. Either way the data is complete as of a stated slot, and anything said about it states the delay, for example "data as of hh:mm UTC".

STALE: no cycle has been ready for about ten minutes, or the newest cycle cannot be used. The feed has stopped or fallen behind. The data describes the past, not the market now.

MARKET_CLOSED: the market-hours gate is closed, for example at the weekend. The newest cycle is last session's picture. This is not a fault, and it differs from STALE: a feed that stopped while the market is open is STALE, a closed weekend market is MARKET_CLOSED.

The deadlines and the ten minutes are starting values that are confirmed on real cycles.

## When the status is UNKNOWN or RETUNING

UNKNOWN is not a fifth freshness level. It means the gateway could not be asked, so the system cannot say how fresh the data is. The packet then carries the flag GATEWAY_UNREACHABLE, the newest ready cycle is still used so the sensor board can be shown, and nothing is claimed about freshness. For direction it is handled like STALE: a status that cannot be shown to be good gives no direction.

RETUNING is a condition that sits beside the status, not instead of it. When the active indicator is promoted to new settings, the channel is re-pushed and the cycles are RETUNING until the re-pushed window is complete. The cycle still has a freshness, FRESH or DELAYED, and every sensor reports CAUTIONARY for the time being. A reading made while the channel is being re-fitted is usable but carries that caution, with the reason RETUNING.

A missing news calendar is a related case. It is said out loud as unavailable and never read as "no news".

## What each data status allows

FRESH: direction and entry zones are given; every other question is answered; the chart goes to the model if it belongs to the same cycle; Report 2, the trade setup, is allowed.

DELAYED: the same, with the delay stated in the answer.

STALE: no direction and no zones. The answer says that data stopped at a stated time. Only explaining a term or a concept and general questions are answered. The chart is not used and Report 2 is blocked.

MARKET_CLOSED: the answer shows last session's picture, labelled as such. Other questions are answered. Report 2 is blocked.

RETUNING: direction and zones are given and the sensors are CAUTIONARY. A trade setup pre-sets half the risk.

UNKNOWN: handled like STALE for direction and zones, and the answer says that freshness could not be checked.

Every answer is stamped with the time the data is as of, in UTC. A chart that belongs to another cycle than the data is left out and the answer says the chart is missing. Nothing in this list is a judgement about the market. It says only how much of the market picture can be shown with the data in hand.

## Sensor statuses on the board

Each sensor reading carries one status for the cycle, beside its state.

VALID: the reading is used as normal.

CAUTIONARY: the reading is used and its reason is shown. It is a usable reading with something to be careful about.

INVALID: the reading could not be made, for a reason such as a channel that is too short, a gap in the bars or a missing setting. It is left out of synthesis and listed on the board as unavailable.

STALE: the sensor's data is old or the statistics row for the slot is missing. It is left out and flagged as a data problem, not as a market reading.

ABSENT: a sensor that is live has no row at all for the slot. The board shows it as absent. A sensor on the board is never silently dropped.

A sensor that is INVALID, STALE or ABSENT says nothing about the market. Silence from it is a gap in the information, not a signal.

The statuses do not say whether the market is rising or falling. VALID means only that the reading was made cleanly from sound inputs. It does not mean that the reading is favourable, and a VALID reading can be a counter-trend or a stand-aside state.

## What makes a reading CAUTIONARY

A CAUTIONARY reading is made, and then a specific reason is attached. The reasons are fixed codes.

MCD0_DEFECT_M5 or MCD0_DEFECT_M15: the quality gate found that the active channel on that timeframe misses a fit criterion. Every channel sensor that reads that timeframe becomes CAUTIONARY.

RETUNING: the channel is being promoted and re-pushed, so every sensor is CAUTIONARY until the window is complete.

DETECTION_MISMATCH: the indicator named by the setting has no value on the last closed bar while another candidate indicator does. The setting may be wrong, and the checks that follow usually end the reading as STALE or INVALID.

UPSTREAM_CAUTIONARY: a derived sensor, which is MCD3, inherits the caution of MCD1 or MCD2.

The synthesis inherits any caution from its inputs and shows the reason. A reading that goes against the larger trend is not CAUTIONARY for that alone. Its state and its regime word say that it is counter-trend, and it stays VALID unless one of the reasons above applies.

## Why a STALE status withholds direction

A direction is a statement about the market now. The sensors read closed bars up to a slot, the entry zones are measured from the price of that slot, and a reading is only as current as the cycle behind it. When the status is STALE the newest cycle is already old, so a direction from it would describe a market that has moved on, and the zones would sit around a price that may no longer be there.

For that reason the answer gate stops at the data. It says that data stopped at a stated time, which is true and useful, and it gives no direction, no zones and no trade setup. It keeps answering what does not depend on the market now: what a term means, how a sensor works, how a channel is read. Fresh data makes the direction available again with no other change.

A stale state also carries the risk of a wrong picture rather than no picture: a corridor that has since been left, or a break that has since reversed. Stopping at the data keeps an answer from speaking firmly about a moment that has passed. The same reasoning covers an UNKNOWN status, where freshness cannot be shown, and the trade setup, which is blocked for STALE and for MARKET_CLOSED.
