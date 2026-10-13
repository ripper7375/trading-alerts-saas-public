---
id: t.d2.mcd1
domain: D2
mcd_id: MCD1
state_codes:
  - MCD1_UP_UPPER_BREAKOUT
  - MCD1_DOWN_IN_CORRIDOR
timeframe: M15
version: 1.0.0
related:
  - t.d1.channel.what-a-channel-is
---

# TEST ONLY: playbook for the first channel sensor

## Sustained breach above the upper band

TEST ONLY. When the first channel sensor reports a sustained breach above the upper band, the closed bars have stayed beyond the upper line for several cycles in a row. The playbook for this state starts by saying what it does not claim: a breach is not a promise that price continues, and it is not a signal to act. It says that the corridor the trader used to rely on has been left, and that the sensor now describes price outside it. The trader should look at the middle line and at how far price sits from the upper band, because a small distance after a long wait reads differently from a large distance after a quick move. The playbook also reminds the reader that a breakout above the upper band can fail, and that the failure shows as price returning inside the corridor on closed bars. Where the second channel sensor agrees, the picture is consistent. Where it disagrees, the disagreement is the thing to read first. In a fixture world the same words would be repeated for every cycle in which the state holds, which is why a reader should look at how many cycles it has lasted before treating it as new.

## Downtrend inside the corridor

TEST ONLY. In a downtrend inside the corridor the lines fall together and price stays between them. This is the ordinary state of a falling channel and it does not by itself say anything unusual. The playbook explains what to watch next: whether price approaches the lower band, whether the middle line is respected, and whether the slope is steepening or flattening from one cycle to the next. A flattening slope inside a falling corridor often precedes the sensor changing its trend word to sideways, and the playbook says so without attaching any probability to it. What the sensor will never do is predict the next bar. It reports the corridor as measured, the position of price within it, and the trend word, and it leaves the decision with the trader. If the status says stale, nothing in this paragraph should be read as current. A final fixture sentence adds that the playbook speaks of the corridor as measured and never as expected, and that a reader should use the same distinction in their own words.
