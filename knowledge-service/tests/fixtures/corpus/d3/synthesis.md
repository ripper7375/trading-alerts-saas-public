---
id: t.d3.synthesis
domain: D3
state_codes:
  - MCD3_NON_CONSOLIDATED_TREND_CONFLICT
version: 1.0.0
related:
  - t.d2.mcd3.trend-conflict-between-the-two-timeframes
  - t.d1.channel.what-a-channel-is
---

# TEST ONLY: synthesis

## Counter-trend rally

TEST ONLY. The synthesis combines the sensors into one reading with a bias, a rule and a trader type. A counter-trend rally is the fixture name for a reading in which the longer channel falls while the shorter channel rises. The rule that matches it gives the bias of the shorter channel and marks the reading as counter-trend, so the trader knows the bias runs against the larger picture. The synthesis explains the marking rather than hiding it: a counter-trend bias is described as a bias inside a larger move that points the other way, with the invalidation placed where the rally would be over. The text for this section stays with words a reader can check against the reading itself, such as the rule name, the bias and the invalidation. It does not rank the rally against other readings, give it a grade or attach a probability, because the synthesis has no measured basis for any of those and says so plainly in every language it speaks. The fixture adds that the rule name is stored with the reading, so any answer can quote the rule that matched and a reader can check it against the table of rules.

## When the synthesis stands aside

TEST ONLY. The synthesis stands aside when the sensors disagree in a way that no rule resolves, or when the position sensor alone reports a trend conflict and nothing else gives a direction. Standing aside is a complete reading. It carries no bias, no entry zone and no invalidation, and the answer built from it says so first. The fixture text stresses that a stand aside reading is delivered in full to everyone who asks, and that the sensor which stands aside keeps its whole reading in the answer even when the other sensors agree with each other. The reason is simple: a warning that is dropped when it is inconvenient is not a warning. A reader who wants to know what would end the state should look at which channel would have to change its trend word, because the synthesis follows the sensors and does not move first. The section ends with the observation that stand aside is the only reading in which the sensors are allowed to outvote the rules table, and that this is written down as an invariant.
