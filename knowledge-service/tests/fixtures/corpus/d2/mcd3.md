---
id: t.d2.mcd3
domain: D2
mcd_id: MCD3
state_codes:
  - MCD3_NON_CONSOLIDATED_TREND_CONFLICT
  - MCD3_BULL_VALUE
version: 1.0.0
related:
  - t.d3.synthesis.when-the-synthesis-stands-aside
---

# TEST ONLY: playbook for the position sensor

## Trend conflict between the two timeframes

TEST ONLY. The position sensor compares where price sits in the fifteen minute and the five minute channels. Its trend conflict state means that the two channels disagree about the trend: one is rising and the other falling. The playbook for this state is short on purpose. It says that the sensor stands aside on its own, which means it reports no direction at all, and that this is a complete answer and not a missing one. A reader who sees this state should not search the other sensors for a tie-breaker, because the synthesis already decides how the disagreement is carried forward. The playbook adds that the state can last for many cycles in a fixture world and that it clears when either channel changes its trend word. It never clears because price moved a certain distance. The distinction matters because a reader might otherwise treat the state as a countdown, and it is not one. It is a description of two channels pointing different ways. A reader looking at the fixture may also wonder what the sensor says when only one channel has data: in that case it reports its own status and no state, and the playbook for the state does not apply at all.

## Bullish value position

TEST ONLY. In the bullish value state both channels rise and price sits in the lower part of the combined range, which the fixture text calls the value area. The playbook explains the word value without attaching a price to it: the area is simply the region of the combined range nearest its lower edge. The sensor reports this state as a position, not as an instruction, and the playbook warns the reader against turning a position word into a promise. A bullish value reading says where price is relative to two rising channels. It says nothing about how long price will remain there. If either channel flattens, the sensor moves on to another state and the playbook for that state applies. This fixture section is deliberately plain so that tests can recognise it by its words, such as value area, combined range and lower edge. The section closes by saying that the combined range is recalculated every cycle from the two channels, and that the value area therefore moves whenever either channel moves its bands.
