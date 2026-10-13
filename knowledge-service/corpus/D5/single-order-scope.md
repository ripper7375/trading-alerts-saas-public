---
id: d5-single-order-scope
domain: D5
mcd_id: null
state_codes: []
timeframe: null
version: 1.0.0
related:
  - d4-profile-and-underflow.declared-risk-actual-risk-and-the-notices-of-report
  - d3-synthesis-rules.rules-decide-and-the-model-explains
  - d5-decision-support-role.the-trader-owns-every-trade-decision
---

# The scope of a trade setup

## One setup and one order at a time

A trade setup, Report 2, covers a single order. It takes one direction, one entry price, one stop and one position size, and it works out the lot for that order alone. Every report carries the notice that it covers a single order only and does not manage the account or any open positions.

The sizing therefore treats each setup on its own. The risk percentage is a share of the equity for this one order, and the leverage limit is checked for this one position. The system does not see the positions that a trader already holds at the broker. It does not add the risk of an earlier order to the risk of a new one, and it does not know what the account is carrying. The trader who holds other positions has to weigh them, because the report cannot.

The three target scenarios of a setup, Conservative, Normal and Aggressive, are three possible targets for the same order. They share one lot and one stop and differ only in where the target lies. They are not three separate orders.

## One setup per cycle and trader type

The synthesis makes one reading per trader type on each cycle, and a question is answered from the reading that matches the trader's profile. The reading names one direction, or says to stand aside, and builds at most five entry zones around that direction. Report 2 takes one of them.

The trade setup is pinned to the cycle that Report 1 used. The cycle is the same from the first question to the submission, so the numbers on the screen are the numbers that are validated. If a newer cycle has changed the synthesis, the report offers a refresh and does not silently swap the setup. If the price has already passed the invalidation price of the zone, the setup is no longer valid and is not offered.

A stand-aside offers nothing to size. There is then no direction, no zone and no setup, and the reply states the reason from the synthesis.

At most five zones are built for a reading, but Report 2 never combines them. The trader picks one zone price, and the setup is sized for that price alone. The Day Trader reading and the Scalper reading are two different readings of the same cycle, and the report uses the one that matches the trader's profile, never both.

## Gold on M5 and M15 only

The system covers one instrument, gold quoted against the US dollar, and two timeframes, M5 and M15. Every sensor, rule, zone and calculation is built for them. A question about another symbol, such as a currency pair, or another timeframe, such as H1 or daily, gets a fixed reply in the trader's language that says what the assistant covers. Nothing else runs for it, and no model is asked about it.

The scope check is deterministic and strict. It reads the question as typed, the English text and the symbols and timeframes that the understanding step found, and anything it cannot read as gold on M5 or M15 is out of scope. A question that names gold and another symbol, or M5 against H1, is out of scope as a whole. A bare mention of the dollar is not a second symbol. A question in any of the 19 languages is held to the same scope. A question that names no symbol and no timeframe is in scope and is read as being about gold on the timeframes the sensors cover.

The limit is deliberate. The sensors, the corridors and the thresholds are specified for these two timeframes of this instrument, and the system makes no claim about anything it was not built and tested on.

## What the system does not model

Because a setup is one order, the system does not build or manage a ladder of orders. A grid of orders at fixed spacing is not modelled, and the entry prices of a setup are real structure levels and not an evenly spaced ladder. Adding to a position as it moves in favour, which is pyramiding, is not modelled either, since each setup is sized from the equity and the risk limit as a new, separate order.

Doubling the size after a loss, the martingale, is not modelled. Nothing in the sizing carries information from an earlier order or an earlier loss. The risk is the same share of the equity whatever the previous result, and an increase above the pre-set is the trader's choice, up to the personal Max RPT, and is recorded as such.

The assistant does not manage positions, move stops, close trades or hedge. It does not combine several orders into one margin calculation. If a trader asks for any of this, the answer is that the scope of the tool is a single order, and what the tool can do is explain the sensors, the structure and the figures of a setup.
