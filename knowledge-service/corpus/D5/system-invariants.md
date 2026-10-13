---
id: d5-system-invariants
domain: D5
mcd_id: null
state_codes: []
timeframe: null
version: 1.0.0
related:
  - d1-closed-bar-rule.what-a-closed-bar-is
  - d1-data-statuses.what-each-data-status-allows
  - d3-synthesis-rules.rules-decide-and-the-model-explains
---

# The invariants of Stack D

## Two clocks and one snapshot per cycle

Stack D runs on two clocks. On the market clock, every five minutes and whether or not anyone is asking, it takes in the closed bars, runs the sensors, runs the synthesis, builds the entry zones and writes one stamped snapshot for that slot. On the question clock, when a trader asks something, it reads the latest complete snapshot and never runs a sensor again.

Three things follow. The same data always gives the same answer. The time to answer does not depend on how long a sensor takes. And any answer can be replayed from its cycle, because the cycle is stored and nothing in it changes afterwards.

A cycle is keyed by its slot, a five-minute mark in UTC, and the M15 part of it refreshes on the quarter hours. A question can never change a reading. Every stored reading is appended and none is edited, so what a trader was shown at a given time can be reconstructed from the record.

## Closed bars only: the bar still forming is never used

A bar is closed when its open time plus its period is at or before the slot. The sensors and the one-day windows use closed bars only. The bar that is still forming is shown once, as a labelled last price, and the chart draws it hollow. Nothing in a reading, a zone or a size is computed from it.

This is pure closed-bar evaluation. The inputs of a reading are fixed once the slot has passed, so a later bar cannot repaint an earlier reading, and a stored cycle gives the same result when it is run again. The reference price used for entry zones is the close of the last closed M5 bar, not the live price. The consequence a trader can see is that a reading is always stamped with the time its data is as of.

The rule does not make every figure fixed. The indicator's own channel fit reaches the bar that is still forming, so a statistic can move between cycles, and how much it moves has not been measured. The system does not claim a stability that it has not measured.

## Rules decide the direction and the model only explains it

No language model chooses a direction, a zone, a stop or any number of Report 2. The direction is copied from the synthesis reading. The zone ids come from the entry-zone builder. Every number of Report 2 comes from Engine 4. The model's part is to explain these results in the trader's language, and it can neither flip a bias nor overrule a stand-aside.

Replies are checked before anyone sees them. Every number in a reply is matched against the context that the model was given, and a number that cannot be matched is shown as not verified. The wording is checked against phrase lists in the trader's language. A reply that fails a check is sent back to the model once. If it fails again, a short fixed answer built from the sensor board replaces it.

Only one step of the reply path calls a model. Everything before it and after it is ordinary code that gives the same output for the same input, which is what makes the answers testable against stored cycles.

## Fail closed

When the system cannot establish a fact, it withholds the answer and does not assume the comfortable one. The offer check for Report 2 is the clearest case. An unreadable synthesis, a live data status that was not supplied, a Tier-1 list or calendar that cannot answer, no usable zone, and broker figures that are missing or older than 7 days all mean not offered. None of them is read as permission.

The same habit runs through the other parts. Data that is STALE gives no direction. A sensor that is INVALID, STALE or absent is listed as unavailable and left out of the synthesis. A news calendar that is missing is said aloud and never read as no news. A chart from another cycle is dropped and the reply says the chart is missing. If the knowledge index cannot load, Report 1 is built from the sensor data and flagged, and Report 2 is unaffected.

The session gate checks in a fixed order, cheapest first, and every dependency it asks, such as the entitlement or the quota, refuses when it cannot answer.

## Nothing hidden, everything stored and replayable

Every stage records what it did. Each sensor writes one row per cycle, append-only, including the INVALID and STALE ones. The synthesis reading is stored with the rule id, the rules version and a checksum of the rules file, and each entry zone with the version of its parameters. Running a stored cycle again gives byte-identical readings.

The synthesis is a pure function. It reads nothing from the market, a clock or a database apart from the readings handed to it, and it keeps no memory of earlier cycles or earlier questions. A reading does not depend on who asks or on what was asked before. Engine 4 follows the same rule: the server recomputes a setup from the stored cycle, the chosen zone and the trader's inputs, and a figure sent from the browser changes nothing.

Because nothing is hidden, a disagreement can be settled from the record. The stored cycle, the rules version and the inputs reproduce the answer. Change is versioned in the same spirit. A change to the synthesis rules is a new rules file with a decision-log entry and never an edit of the file in use, and the sensors, the zones and Engine 4 carry version numbers that the stored rows name.

## What the trace records for every answer, and how long it is kept

Every answer leaves one trace row, filled in by the sections that handled the question. The request group holds the request id, the user, replaced by a hash after account deletion, the tier, the language and the intent. The data group holds the cycle slot, the data status, the sensor statuses and the rules version. The knowledge group holds the sensors that were read in full, the chunk ids and the index build id. The model group holds the model, the prompt version and the tokens. The checks group holds the answer gate, the number and wording results and any regeneration. The risk group holds the Engine 4 inputs and outputs, the validator results, the overrides and the consent action. The time group holds the duration of each stage.

By design the traces are kept for 90 days in the database and then archived with the consent records. Consent records and profile history are kept for 7 years. When an account is deleted the personal data goes and the audit rows keep a hash of the user id.
