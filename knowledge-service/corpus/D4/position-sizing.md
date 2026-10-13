---
id: d4-position-sizing
domain: D4
mcd_id: null
state_codes: []
timeframe: null
version: 1.0.0
related:
  - d4-caution-sizing.half-the-risk-when-the-sensors-are-cautious
  - d4-structural-stops.stops-sit-behind-structure-not-at-a-fixed-distance
  - d4-profile-and-underflow.the-eight-profile-metrics-first-four
---

# How Engine 4 sizes a position

## The gold contract in plain numbers

Gold is quoted in dollars per troy ounce, and in these calculations one standard lot is 100 ounces. A lot of 1.00 controls 100 ounces, 0.10 controls 10 ounces and 0.01 controls 1 ounce. From that follows the point value, which does not change with the gold price: a move of $0.01 on one lot is worth $1.00, a move of $0.10 is worth $10.00, and a move of $1.00 is worth $100.00. The price level changes the total value of the position, never the value of a cent.

Profit or loss is the lot size times 100 ounces times the price change in dollars. For example 0.10 lot and a $5.00 move is 0.10 x 100 x $5.00 = $50.00.

Engine 4 reads the contract size, the smallest and largest lot, the lot step and the typical spread from the broker figures stored for the symbol. A different contract size or lot step changes the lot with no change of code. The formulas below use 100 ounces for readability. All money figures are computed in exact fractions, never in floating point, and shown to two decimals, so the same inputs always give the same lot.

## The lot size formula in words

The lot size answers one question: how big may the position be so that, if price reaches the stop, the loss is the amount the trader chose to risk. In words:

lot size = the risk amount in dollars, divided by (the stop distance in dollars times 100 ounces, plus the round-trip commission per lot).

The risk amount is the risk percentage times the account equity. The stop distance is the dollars per ounce between the entry and the stop. The commission is what the broker charges to open and close one lot. If there is no separate commission the last term is zero.

Worked example, the corrected table of the architecture: equity $10,000.00 and risk 1.00%, so a risk amount of $100.00. A buy at 2,545.00 with a stop $15.00 away and a commission of $4 a lot. One lot loses $15.00 x 100 + $4 = $1,504 at the stop. $100.00 divided by $1,504 is 0.0665 lot before rounding. The stop price of a buy is the entry minus the stop distance, so 2,545.00 - $15.00 = 2,530.00.

## Rounding down, declared risk and actual risk

The calculated lot is rounded down to the broker's lot step and never up, because rounding up would risk more than the trader chose. In the example 0.0665 lot becomes 0.06 lot. The risk the trader chose, $100.00, is the declared risk. What 0.06 lot loses at the stop is the actual risk: 0.06 x $1,504 = $90.24, which is 0.90% of the equity. After rounding down the actual risk is never above the declared risk. The same rounded lot is used for every figure that depends on it: the leverage used, the actual risk and the net profit at each target are computed from the lot after rounding and not from the lot before it.

Report 2 shows declared and actual risk side by side so that the gap does not look like an error. The report also names the limit that set the lot: the risk limit, the leverage limit or the broker's largest lot. The lot is the smallest of the lot allowed by the risk, the lot allowed by leverage and the broker maximum, rounded down to the lot step.

## Exposure and leverage

Exposure is the dollar value of the gold a position controls: lot size x 100 ounces x price. For 0.06 lot at 2,545.00 that is 0.06 x 100 x 2,545.00 = $15,270.00. Effective leverage is the exposure divided by the equity: $15,270.00 divided by $10,000.00 is 1.527. The profile's Max leverage limits this figure, from 1:1.0 up to a ceiling of 1:5.0, and the leverage used must never be above it.

The limit also sets a largest lot: Max leverage x equity, divided by (entry x 100). With 1:5 on $10,000.00 at 2,545.00 that is $50,000.00 / $254,500.00, about 0.196 lot, well above the 0.0665 the risk allows, so here the risk limit sets the lot. When the leverage lot is the smaller one, leverage sets the lot and part of the declared risk stays unused. The report then says that the leverage limit set the lot and not the risk limit.

## Targets, scenarios and net profit

The reward-to-risk ratio, RRR, is the net profit divided by the actual loss, both after commission and rounding. For a ratio R the target distance in dollars per ounce is R x the stop distance + commission x (R + 1) / 100. Net profit at the target is the lot x 100 x that distance, less the commission for the lot, which equals R times the actual risk.

Three scenarios share one lot and one stop and differ only in the target. Normal is the profile's target RRR, Conservative is one step of 0.25 below it and Aggressive one step above, with Aggressive capped at 2.50x on a counter-trend setup. In the example, with a Normal ratio of 1.75x:

- Conservative 1.50x: distance $22.60, target 2,567.60, net profit $135.36.
- Normal 1.75x: distance $26.36, target 2,571.36, net profit $157.92.
- Aggressive 2.00x: distance $30.12, target 2,575.12, net profit $180.48.

A target is never shown past the next opposing structure level. The spread of the broker, when it is above zero, moves the fill price and widens the loss per ounce, and every figure above is exact only for a spread of zero.

## The broker figures and the spread

Chart prices are bid prices. A buy fills at the ask, which is the entry plus the typical spread, so the loss per ounce at the stop is the stop distance plus the spread, and the leverage steps use the fill price. A sell fills on the bid, and its stop and target trigger on the ask. The report shows the spread it used.

The broker figures are the contract size, the smallest lot, the lot step, the largest lot and the typical spread. They are exported from the broker's own terminal once a day and whenever a value changes. The commission is the trader's own input, because the terminal does not expose it per symbol. Figures older than 7 days are not used: Report 2 is not offered until they refresh.

The figures are dated and versioned. Engine 4 records the version of the broker figures it used in the consent record, so a later audit can see which contract size, lot step and spread produced the lot. When no usable figures exist, for example because the export has not yet run, the trade setup is not offered. It is never sized on a guess, and the report says that the broker figures are missing or too old.
