---
id: d4-caution-sizing
domain: D4
mcd_id: null
state_codes: []
timeframe: null
version: 1.0.0
related:
  - d3-synthesis-rules.why-a-reading-is-cautionary
  - d1-data-statuses.what-makes-a-reading-cautionary
  - d4-position-sizing.rounding-down-declared-risk-and-actual-risk
---

# Half the risk when the sensors are cautious

## Half the risk when the sensors are cautious

When the synthesis reading is CAUTIONARY, or the cycle is RETUNING, Engine 4 opens the trade setup with half of the trader's maximum risk per trade already chosen. The reason is shown beside the figure. A trader whose Max RPT is 1.50% therefore sees 0.75% pre-set. The lot is then worked out from that halved percentage, so the position is about half the size it would be at the full risk.

The rule exists because a caution means one of the readings behind the direction deserves care: a channel whose fit failed a quality test, or an indicator that was just re-tuned. The synthesis keeps its direction and says why it is cautious. Engine 4 turns that caution into a smaller starting size without asking the trader to read a code.

A CAUTIONARY reading is still offered. Only the starting risk changes. A synthesis that stands aside is a different case: nothing is sized, and the trade setup is not offered at all.

## The trader keeps the final say, up to Max RPT

The half risk is a pre-set and not a hard cap. The trader may choose any risk up to their own Max RPT, and the setup is then sized at the higher figure. A value above Max RPT is always refused. The earlier design considered a hard cap and did not choose it. The trader owns the risk decision, and the record shows it.

When the trader raises the risk above the pre-set, the override is recorded in the consent record together with the reason that was shown. An audit therefore shows what the system pre-set, what the trader chose, and what the trader had been told. Accepting the pre-set records no override. The pre-set is a starting position and a record, and not a judgement that the trader is wrong to want more. The system's part is to make the caution visible, to keep the limit the trader set, and to keep the evidence of what was shown and chosen.

The same holds when the setup is modified later. The risk the trader submits is validated against Max RPT, and the pre-set is recomputed from the cycle the setup is pinned to, never taken from what the browser sends.

## Which cautions halve the risk: MCD0 defects and retuning

The reasons are the reason codes of the synthesis reading when its status is CAUTIONARY. The usual ones are MCD0_DEFECT_M5 or MCD0_DEFECT_M15, which mean the quality gate found that the channel on that timeframe misses a fit criterion, and RETUNING, which means the active indicator is being promoted and the window is still being re-sent. A flagged channel and a promote in progress behave the same way.

A counter-trend setup is not a reason. A reading that goes against the larger trend stays VALID unless a sensor is cautioned. It gets a notice if the trader's style is trend following, and a cap on the target ratio, but not a halved risk. A data status of DELAYED is not a reason either: the delay is stated, and the sizing is unchanged.

A STALE or MARKET_CLOSED cycle, a Tier-1 news window, a missing broker figure or a synthesis that stands aside is not a half-risk case. The trade setup is not offered in those cases, so no starting risk figure is chosen.

## Half risk in numbers

Take a trader with $10,000.00 of equity and a Max RPT of 1.50%. At the full figure the declared risk is $150.00. On a CAUTIONARY reading the setup opens at 0.75%, so the declared risk is $75.00. The lot is sized to that figure, rounded down to the broker's lot step, and the actual risk is whatever that lot loses at the stop, which is at most $75.00.

The trader who raises the figure to 1.50% before accepting would see a declared risk of $150.00 and a larger lot, and the consent record would hold the override and the reasons. The halved figure is not a recommendation about how much to risk. It is a starting point set by the system, with its reason shown, that the trader can read, change or decline.

The other limits do not change. The lot is still held to the leverage limit, the stop to the minimum stop distance and the targets to the next opposing level. A halved risk can also meet a leverage limit that already sets the lot, and then the lot is the same whether the pre-set is half or full.
