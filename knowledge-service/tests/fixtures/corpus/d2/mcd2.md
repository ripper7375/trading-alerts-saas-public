---
id: t.d2.mcd2
domain: D2
mcd_id: MCD2
state_codes:
  - MCD2_UP_UPPER_BREAKOUT
  - MCD2_SIDEWAYS_IN_CORRIDOR
timeframe: M5
version: 1.0.0
---

# TEST ONLY: playbook for the second channel sensor

## Five minute breakout above the upper band

TEST ONLY. The second channel sensor reads the five minute bars, so its breakout above the upper band is a faster and shorter event than the first sensor's. The playbook for this state says that a breakout on this timeframe is common and often short, and that a trader who reads it should first check whether the fifteen minute sensor describes the same direction. The fixture playbook lists what the reading contains: the state word, the distance from the upper band, and the count of closed bars spent outside the corridor. It then lists what the reading leaves out: any prediction of the next move and any size for the trade. The reader is reminded that the sensor works from closed bars only, so the breakout the sensor reports is already some minutes old when it is read. A scalper may find this state useful as context, and the playbook is careful to say that context is all it is. The playbook finishes by telling the reader to look at the state word first, the distance second and the bar count third, in that order, every time the fixture state appears.

## Five minute corridor with no clear trend

TEST ONLY. When the five minute channel is sideways inside its corridor, the lines are nearly flat and price moves between them without a lasting direction. The playbook calls this the quiet state of the second sensor and explains that it carries little information about what comes next. The useful thing it does carry is the width of the corridor, because a narrow corridor and a wide corridor ask different questions of a trader. The fixture text adds that a sideways reading on the short timeframe sitting inside a trending reading on the longer timeframe is a normal pairing, and that the two sensors are not in conflict when they describe different scales. If the two sensors do conflict, the synthesis explains how the conflict is handled, and this playbook does not repeat that explanation. It also notes that the corridor of this sensor is narrower than the corridor of the fifteen minute sensor, so a distance that looks large here can look small there.
