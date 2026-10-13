---
id: d3-synthesis-rules
domain: D3
mcd_id: null
state_codes: []
timeframe: null
version: 1.0.0
related:
  - d1-mcd-architecture.how-the-sensors-run-and-what-a-bias-is
  - d1-data-statuses.what-makes-a-reading-cautionary
  - d1-data-statuses.sensor-statuses-on-the-board
---

# How the synthesis rules decide

## Rules decide and the model explains

The direction of a cycle is never chosen by a language model and never by an average of the sensors. A fixed table, the synthesis rules, turns the sensor readings of one cycle into a bias, an archetype, a few reasons and a status. The assistant then explains that result in words. It can neither flip the bias nor overrule a stand-aside.

Two readings are made on every cycle. A Day Trader reading uses the M15 structure, with the M5 channel for timing. A Scalper reading uses the M5 channel for both. A question is answered from the reading that matches the trader's profile. The reading does not depend on who asks, so two traders of the same type see the same bias on the same cycle. A trader's own style, risk limit and stop limit are applied later, by Engine 4.

Each reading is stored with the name of the rule that decided it, the rules version and a checksum of the rules file, so a stored cycle can be replayed and gives the same result. Every direction comes with its reasons, in fixed English sentences, and never with a score or a percentage. The current rules version is draft-1. The table describes market structure and is not a trading recommendation.

## Ordered rules, the first match wins

The rules are an ordered list in a versioned file. For one trader type the rows run from top to bottom, and the first branch whose conditions all hold decides the reading. Later rows are not looked at. Because the first match wins, the order is part of the rules version: moving a row would change what a cycle means.

A row has one or more branches. A branch names the sensors it reads, the facts it needs from each, such as a status, a state code, a regime word, a trend or the side of a breach, and the values those facts may take. All conditions of a branch must hold. When a row is marked primary first, the branches of the trader type's primary sensor are tried before the others, which settles the case where MCD1 and MCD2 would each match with a different bias.

Some rows come before others on purpose. The counter-trend rally row is tested before trend continuation so that a sustained counter-trend break is not read as continuation. The exhaustion row is tested before it too, so that a climax is not read as continuation. A change to any row, text or the order is a new file, draft-2, with a decision-log entry. A file in use is never edited, and every stored reading names the version it was made with.

## The rows of the draft-1 rules table

Each row has a rule id, and the readings store it.

- R0_DATA_CHECK: both trader types. The primary sensor has no usable reading. The result is a stand-aside.
- R1_MACRO_COUNTER_TREND_RALLY: Day Trader only. MCD1 shows a counter-trend expansion and MCD2 trends in the direction of the break. Archetype C, against the M15 trend.
- R2_EXHAUSTION_SNAPBACK: both. A spike beyond a corridor. Archetype B, a bias against the spike.
- R3_TREND_CONTINUATION: Day Trader. The M15 and M5 trends agree. Archetype A, with the trend.
- R3S_TREND_CONTINUATION_M5 (row 3s): Scalper. The M5 trend alone. Archetype A, with the trend.
- R4_RANGE: both. A ranging channel. Archetype D: a side at an M5 range edge, otherwise a stand-aside.
- R5_UNRESOLVED_CONFLICT: both. MCD3 is non-consolidated and no earlier row matched. A stand-aside with no archetype.
- NO_MATCH: nothing matched. The result is NEUTRAL and is logged.

The MCD3 modifiers are not rows. They sit after the table and adjust a result that already has a direction.

Each branch also carries fixed English texts: one or two reasons and a summary line of at most 80 characters with no price. The summary line is what the top of the sensor board shows for the synthesis, for example Counter-trend rally, LONG.

## Row 0, the data check (R0_DATA_CHECK)

Row 0 runs first for both trader types and asks one thing: can the primary sensor be used? The primary sensor is MCD1 for a Day Trader and MCD2 for a Scalper. It is usable when its status is VALID or CAUTIONARY. When the status is INVALID, STALE, or ABSENT because the sensor did not run or has no row for the cycle, the branch PRIMARY_UNAVAILABLE fires.

The result is a data stand-aside. The flag data_stand_aside is true, the bias is STAND_ASIDE, there is no archetype and no trend relation, and the reason is The primary sensor has no usable reading this cycle. The summary line is Stand aside, primary sensor unavailable. The reading itself then has the status STALE when the sensor is STALE, and INVALID otherwise, with the reason UPSTREAM_STALE or UPSTREAM_UNAVAILABLE naming the sensor. No zones are built.

The data check comes first because every later row stands on the primary sensor. Rules that read a structure which is missing cannot give a direction worth explaining, so the system says plainly that the data is the problem and does not guess from the secondary sensors. A data stand-aside is about the reading, not about the market. It says nothing about where price may go.

## The primary sensor and the precedence ladder

The rules follow a precedence ladder, and a lower rung can never override a higher one. First comes the structure of the primary timeframe: MCD1 for a Day Trader, MCD2 for a Scalper. Second come the support and resistance levels, which give context to zones. Third come the trendlines and channels of the other timeframe. Fourth come oscillators, such as the EDT stochastic that MCD3 reads.

The ladder explains three behaviours. When the two channel sensors disagree, the primary sensor's branches are tried first. A ranging M15 channel makes a Day Trader stand aside even when the M5 channel shows an edge, while a Scalper in the same cycle reads that M5 edge. And MCD3, which sits on the oscillator rung, modifies a result and never starts one: a derived sensor adds confirmation or caution to what the structure already says. MCD0 stands below the ladder as a gate. It gives no direction. It adds a caution to the channel sensors that read a timeframe whose fit failed its quality test.

## Stand aside, neutral and a direction

A reading ends in one of three kinds of answer. A direction is LONG or SHORT. It always has an archetype and a trend relation, either WITH_TREND or COUNTER_TREND, and entry zones may be built for it. STAND_ASIDE means the rules looked at the structure and found that it does not support a side. The flag stand_aside is true exactly when the bias is STAND_ASIDE, and then there are no zones and no trade setup. NEUTRAL means no rule matched. It is logged as a gap in the table, it has no archetype, and it is not a stand-aside.

A stand-aside has three causes. Row 0 gives a data stand-aside. Row 4 gives a range stand-aside, when MCD1 shows a ranging M15 channel or MCD2 shows price in the middle of a sideways corridor. Row 5 gives an unresolved-conflict stand-aside. Each reading says which, in one fixed sentence.

Stand aside is an answer and not a failure. It does not say that price will stay still or that it will move. It says that the sensors do not support naming a side this cycle.

## When no rule matches

Every branch of every row can fail to hold, and then nothing decides the reading. The result is NEUTRAL with the rule name NO_MATCH and no branch. The reason is No rule matched this combination of sensor states, and the summary line is No rule matched, NEUTRAL. It is recorded in full: the state of every sensor goes into the reading, so a gap in the table can be found in the data and a later rules version can close it. The reply describes the sensors one by one.

A branch that names an unusable sensor cannot hold. If a sensor is INVALID, STALE or absent, any branch that needs a fact from it is skipped and the next branch or row is tried. That is why a missing MCD3 does not stop a result: MCD3 only modifies. A missing primary sensor is different, because row 0 has already stopped the reading.

A Scalper with a usable MCD2 never reaches NO_MATCH, because rows 2, 3s and 4 together cover every MCD2 state. A Day Trader can, for example when the M15 trend is up inside its corridor, the M5 trend is down inside its corridor and MCD3 is not available.

## Why a reading is CAUTIONARY

A reading that has a direction can still carry a caution. The status of a synthesis reading is CAUTIONARY when any sensor that the matched branch read is CAUTIONARY, or when an MCD3 modifier added caution. When all of those sensors are VALID the reading is VALID and has no reasons. The status is not a score. It tells the reader that something deserves care, and it names what.

Caution is inherited, which means the reading copies the reason codes of the cautioned sensors, sensor by sensor in number order, with MODIFIER_CAUTION and the MCD3 state last when MCD3 made it cautionary. The usual reasons are MCD0_DEFECT_M5 or MCD0_DEFECT_M15, where the channel fit failed a quality test, RETUNING, where the indicator was just re-tuned, and DETECTION_MISMATCH. Only the sensors a branch actually read count. A Scalper's trend continuation row reads MCD2 only, so a cautioned MCD1 does not make that reading cautionary. A cycle with no match counts every available sensor.

A CAUTIONARY reading keeps its direction. Engine 4 pre-sets half the risk for it, and the reply states the reason.
