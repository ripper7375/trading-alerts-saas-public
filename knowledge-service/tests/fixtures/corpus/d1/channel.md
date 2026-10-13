---
id: t.d1.channel
domain: D1
version: 1.0.0
related:
  - t.d3.synthesis.counter-trend-rally
---

# TEST ONLY: foundations, the channel

## What a channel is

TEST ONLY. A channel is a pair of lines fitted to recent closed bars, one above the price and one below, with a middle line between them. The upper band and the lower band are not forecasts. They describe where price has recently turned, measured from the bars that have already closed. When price moves between the two bands the channel is said to hold, and the reading names the corridor as the place price is in. The slope of the channel gives its trend: rising lines are an uptrend, falling lines a downtrend, and lines with almost no slope are sideways. A fixture reader should remember three plain facts. The bands come from closed bars only. The slope names the trend. The corridor is the space between the bands. Nothing in this paragraph is a trading statement, and every number a real reading carries comes from its own cycle, never from this text. The fixture adds that a reader who wants a second opinion on the word channel should compare it with the word corridor, which names only the space between the bands and not the lines themselves.

## The closed-bar rule

TEST ONLY. A bar that is still forming is not used to draw a channel. The reading waits for the bar to close and then includes it, so two readers who look at the same cycle always see the same bands. This rule has a cost that a reader should know about: the newest price can sit outside the bands for a short time before the next cycle shows it. The rule also removes a whole class of confusion, because a band can never move under a reader while they are looking at it. When the data is stale the reading says so in its status and the closed-bar rule still applies to whatever bars were last received. A reader asking why a band did not move after a spike should first check whether the bar that spiked has closed yet. If it has not, the band has not seen it, and that is the intended behaviour of the fixture channel. One more plain note belongs here: a reading that is flagged as delayed still follows this rule, and its closed bars simply end earlier than a fresh reading would.
