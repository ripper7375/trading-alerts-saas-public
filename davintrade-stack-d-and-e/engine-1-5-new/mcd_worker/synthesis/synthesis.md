# Synthesis: specification of rules version `draft-1` and entry zones `zones-1` (build step 4, parts 1 and 2)

Architecture chapter 3 owns the rules; this file says how `draft-1` reads them and what the code does with them. It is written for
Davin, who owns the content of the table (ADR-026), and for whoever builds on it. If this file and architecture chapter 3 disagree, chapter 3
wins and this file is a bug.

|                       |                                                                                                                                                                                          |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**            | Parts 1 and 2 built: rules file, loader, engine, reading; entry-zone builder, parameters, pills. Not called by the runner (part 3), no database (parts 4 and 5).                         |
| **Rules version**     | `draft-1`, approved by Davin on 2026-10-04 (architecture 3.4 as it stands, plus the readings of decision D1 (a) to (e) of the step 4 plan below).                                        |
| **Decisions applied** | ADR-025 rules decide direction · ADR-026 ordered versioned file, first match, no match is NEUTRAL and recorded · ADR-028 two readings per cycle · ADR-029 precedence · ADR-035 no grades |
| **Step 4 plan**       | `docs/handoffs/2026-10-04-0110-step4-plan.md` (approved with D1 to D13 and A1 to A4 as recommended)                                                                                      |
| **Files**             | Part 1: `rules/draft-1.yaml`, `rules.py`, `facts.py`, `engine.py`, `reading.py`, `syn-output-1.schema.json`. Part 2: `zone_params.yaml`, `zones.py`, `pills.py`                          |

## 1. What it does

For one cycle and one trader type, `decide` takes the final readings of MCD1, MCD2 and MCD3 (after MCD0 inheritance) and returns one decision:
a rule, a bias, a reason and a status. `synthesize_cycle` does it for the Day Trader and for the Scalper and builds the `syn-output/1`
readings. It is a pure function: the same readings and the same rules give the same bytes, and nothing is read from the market, a clock or a
database. A sensor's reading is never changed.

## 2. The table (architecture 3.4 as `draft-1`)

Rows run top to bottom for the trader type they name. The first branch whose conditions all hold decides. "Primary" is MCD1 for the Day Trader and
MCD2 for the Scalper. Texts are the fixed English reasons of the file.

| #   | Rule id                        | Applies to | When (all must hold)                                                                                                              | Result                                                                       |
| --- | ------------------------------ | ---------- | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 0   | `R0_DATA_CHECK`                | Both       | The primary sensor is INVALID, STALE or absent                                                                                    | STAND_ASIDE; the reading is INVALID or STALE (section 5)                     |
| 1   | `R1_MACRO_COUNTER_TREND_RALLY` | Day Trader | MCD1 is `COUNTER_TREND_EXPANSION` with a breach up (down) and MCD2's trend is up (down)                                           | LONG (SHORT), archetype C, COUNTER_TREND                                     |
| 2   | `R2_EXHAUSTION_SNAPBACK`       | Both       | MCD1 is `BREAKOUT_SAME_SLOPE`, or MCD2 is `UPPER_` or `LOWER_OVEREXTENSION_REVERSION`. The primary sensor's branch is tried first | Against the spike: breach up gives SHORT, breach down gives LONG; B, COUNTER |
| 3   | `R3_TREND_CONTINUATION`        | Day Trader | MCD1 is `TREND_ALIGNED_CONTINUATION` in trend up (down) and MCD2 is in the same trend, in the corridor or on the dip (the rally)  | LONG (SHORT), archetype A, WITH_TREND                                        |
| 3s  | `R3S_TREND_CONTINUATION_M5`    | Scalper    | MCD2 is in trend up (down), in the corridor or on the dip (the rally)                                                             | LONG (SHORT), archetype A, WITH_TREND                                        |
| 4   | `R4_RANGE`                     | Both       | MCD1 is `CONSOLIDATION` or `RANGE_EXPANSION`, or MCD2 is a `MCD2_SIDEWAYS_*` state. The primary sensor's branch is tried first    | An M5 edge: above SHORT, below LONG (D, COUNTER). Otherwise STAND_ASIDE (D)  |
| 5   | `R5_UNRESOLVED_CONFLICT`       | Both       | MCD3 is `MCD3_NON_CONSOLIDATED_*` (any of the three) and nothing above matched                                                    | STAND_ASIDE, no archetype                                                    |
| –   | `NO_MATCH`                     | Both       | Nothing above                                                                                                                     | NEUTRAL, logged: every sensor's state is in `inputs`                         |

The words are those of the sensors' registers: MCD1's regime words `COUNTER_TREND_EXPANSION`, `BREAKOUT_SAME_SLOPE`, `TREND_ALIGNED_CONTINUATION`,
`CONSOLIDATION`, `RANGE_EXPANSION`; MCD2's `TREND_ALIGNED_CONTINUATION`, `UPTREND_DIP_BELOW_CORRIDOR`, `DOWNTREND_RALLY_ABOVE_CORRIDOR`,
`UPPER_OVEREXTENSION_REVERSION`, `LOWER_OVEREXTENSION_REVERSION`; MCD3's three `NON_CONSOLIDATED` states. The loader refuses a word that is not in
the register of its sensor.

## 3. How `draft-1` reads the table where 3.4 is silent (decision D1, approved)

- **(a) Row 0.** The primary sensor must be VALID or CAUTIONARY, else STAND_ASIDE with a data reason (3.3 mechanic 1). The loader requires the data
  check to be the first row of each trader type.
- **(b) An unavailable sensor cannot match.** A branch that names an INVALID, STALE or absent sensor does not hold; the next branch or row is tried.
  The no-match record lists the unavailable sensors (their status is in `inputs`).
- **(c) Rows 1 and 2.** The breach direction is MCD1's side of the corridor (`UPPER_BREAKOUT` up, `LOWER_BREAKDOWN` down); "MCD2 trending in that
  direction" is MCD2's channel trend, at any position in the corridor. "Against the spike" is the opposite of the breach. When MCD1 and MCD2 both
  match row 2 with different biases, the trader type's primary sensor decides. Rows that say Both and name MCD1 apply to Scalpers as written.
- **(d) Row 4.** Only `MCD2_SIDEWAYS_UPPER_BREAKOUT` (SHORT) and `MCD2_SIDEWAYS_LOWER_BREAKDOWN` (LONG) are edges; their trend relation is
  COUNTER_TREND. `MCD2_SIDEWAYS_IN_CORRIDOR`, MCD1 `CONSOLIDATION` and MCD1 `RANGE_EXPANSION` are STAND_ASIDE: 3.4 gives no edge rule for them.
- **(e) MCD3 as modifier** (never a vote, ADR-029). Consulted only for a LONG or SHORT result; the first entry that holds applies:

| Entry                                             | When                                             | Effect                                     | Text                                                               |
| ------------------------------------------------- | ------------------------------------------------ | ------------------------------------------ | ------------------------------------------------------------------ |
| `M3_CONFLICT_EXPECTED_UNDER_R1`                   | Row 1 and `MCD3_NON_CONSOLIDATED_TREND_CONFLICT` | note                                       | M15 and M5 slopes differ, expected while the M15 slope lags        |
| `M3_TREND_CONFLICT` / `M3_OVERFLOW` / `M3_ESCAPE` | The matching `NON_CONSOLIDATED` state            | **caution**: the result becomes CAUTIONARY | one fixed text each                                                |
| `M3_CONFIRMS_UP` / `M3_CONFIRMS_DOWN`             | Consolidated in the direction of the result      | confirm: one reason                        | M15 and M5 are consolidated in an uptrend (downtrend)              |
| `M3_AGAINST_UP` / `M3_AGAINST_DOWN`               | Consolidated against the result                  | note: one reason                           | ... consolidated in an uptrend (downtrend), against this direction |

A flat consolidation (`MCD3_SIDEWAYS_EQUILIBRIUM`) has no entry and no effect. A note, a confirmation or a caution never changes the rule or the direction.

## 4. Caution is inherited (3.3 mechanic 4, decision D3)

The reading is CAUTIONARY when any sensor the matched branch **read**, or MCD3 when a modifier applied, is CAUTIONARY, and then carries those sensors'
reason codes: sensor by sensor in number order, each sensor's own order, no repeats, and `MODIFIER_CAUTION:<MCD3 state>` last when MCD3 made it
cautionary. A branch reads the sensors its conditions name; a Scalper's row 3s reads MCD2 only, so a CAUTIONARY MCD1 does not matter to it. A cycle
with no match counts every available sensor as read. All sensors VALID gives VALID with no reasons.

**The echoes are left out** (Davin, 2026-10-04). MCD3 lists `UPSTREAM_CAUTIONARY:MCD1` and `:MCD2` for each sensor it read that was CAUTIONARY. Those
codes only repeat what the upstream sensor says in its own codes, so they are not carried. The one exception: a CAUTIONARY reading must always say why
(the schema requires it), so when nothing else explains the caution (no code of any other kind, and no modifier caution) the echoes stay, in order and once each.

## 5. The SYN reading (`syn-output/1`)

Canonical JSON: compact, ASCII, fixed key order (the schema's `required` list). The hash is the SHA-256 of that text. One reading per trader type per cycle.

| Field                           | Meaning                                                                                                                                                                            |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `schema_version`, `mcd_id`      | `syn-output/1`, `SYN`                                                                                                                                                              |
| `profile`, `cycle_slot`         | `DAY_TRADER` or `SCALPER`; the cycle (ISO 8601 UTC, 5-minute slot)                                                                                                                 |
| `rules_version`, `rules_sha256` | The rules file the reading was made with. The checksum is taken over the parsed document, so line endings and comments cannot change it                                            |
| `rule_id`, `branch_id`          | The row and the branch that decided; `NO_MATCH` and `null` when none did                                                                                                           |
| `status`, `status_reasons`      | VALID, CAUTIONARY, INVALID or STALE, and why (reason codes of standard Appendix D, plus `MODIFIER_CAUTION:<state of MCD3>`)                                                        |
| `data_status`                   | The cycle's data status, recorded as given (FRESH, DELAYED, STALE, MARKET_CLOSED). Synthesis does not act on DELAYED or MARKET_CLOSED: the answer gate of 5.3 does (assumption A1) |
| `archetype`, `bias`             | A, B, C, D or `null`; LONG, SHORT, NEUTRAL or STAND_ASIDE                                                                                                                          |
| `trend_relation`, `stand_aside` | WITH_TREND, COUNTER_TREND or `null` (for the style notice and the 2.50 cap of Section 6); `stand_aside` is true exactly when the bias is STAND_ASIDE                               |
| `inputs`                        | For MCD1 to MCD3: `status`, `state_code`, `regime_status`, `bias` and `envelope_sha256` (the hash that `mcd_outputs` stores for that sensor's row)                                 |
| `reasons`, `summary_line`       | Fixed English texts: the branch's reasons, then the modifier's; one line of at most 80 characters, no prices                                                                       |
| `zones`                         | Zone ids (`Z1` to `Z5`) in rank order, from the entry-zone builder (section 8; the runner passes them in part 3). Empty whenever the reading stands aside (the schema enforces it) |

**Differences from the example in 3.5**, to be written into 3.5 in part 7: `inputs` carries an object per sensor (the example shows one word, and not
the same kind of word for each); `status_reasons`, `data_status`, `rules_sha256` and `branch_id` are added; the status of the 18 Sep reading is
CAUTIONARY, not VALID, because MCD0 flags both timeframes on every real cycle (the sensors are CAUTIONARY, so the reading inherits it).

**A stand-aside because the primary sensor has no usable reading** is the one reading that is not VALID or CAUTIONARY: it is STALE (reason
`UPSTREAM_STALE:<sensor>`) when the sensor is STALE and INVALID (`UPSTREAM_UNAVAILABLE:<sensor>`) otherwise, and it still says STAND_ASIDE with no
archetype, no trend relation and no zones. A consumer that only needs to know whether a direction exists reads `stand_aside`.

**No match** is NEUTRAL with `rule_id` `NO_MATCH`, status VALID (or CAUTIONARY when an available sensor is), `stand_aside` false, and every sensor's
state in `inputs`. Gaps in the table show up in the data this way (3.3 mechanic 5, ADR-026); the measurement kit will list them (part 6).

## 6. Guards (what may be saved)

A reading is refused, with its problems listed and never raised, when: it breaks the schema (which states the invariants: stand-aside means no zones
and no other direction; INVALID and STALE readings stand aside; VALID has no reasons, anything else has; a direction has an archetype and a trend
relation; `NO_MATCH` is NEUTRAL); a status reason is not a code of Appendix D or `MODIFIER_CAUTION:<MCD3 state>`, or does not explain the status; the
rules version, checksum, rule or branch is not the rules'; or a text contains a banned word, a percent sign or the word percent (R9; ADR-035 no
grades). The loader applies the same wording check, and the advice-word check of the kit, to every text in the rules file.

## 7. Things to know about `draft-1` (found while building, no action taken)

- **Row 5 can never fire for a Scalper.** Rows 2, 3s and 4 together cover every state of MCD2, and row 0 covers an unusable MCD2. For the Day Trader
  it fires only when no row above matched (for example M15 up in the corridor against an M5 down in the corridor, with MCD3 not consolidated). A test
  pins both facts.
- **The Scalper never gets `NO_MATCH` with a usable MCD2**, for the same reason.
- **MCD3's other reason codes are carried whole.** When MCD3 applied, its own codes (`MCD0_DEFECT_M5`, `MCD0_DEFECT_M15`, ...) come along even where
  the branch did not read MCD1 (a Scalper's row 3s): they are MCD3's reasons. Only the `UPSTREAM_CAUTIONARY` echoes are dropped (section 4).
- **A Day Trader with a ranging M15 stands aside whatever MCD2 says**, because the primary sensor's branch of row 4 comes first. A Scalper in the
  same cycle trades the M5 edge.
- **MCD3 `BULL_TOP` and `BEAR_BOTTOM` confirm like the other consolidated states.** They are consolidated in a direction; the table does not single them out.
- **The first row for each trader type must be the data check.** The loader enforces what 3.3 mechanic 1 says, so a rules file cannot reorder it.

## 8. Entry zones (architecture 3.6, ADR-030 to ADR-034; decisions D4 to D7, approved)

`zones.build_entry_zones(bias, levels, reference_price, params)` makes the zones a trader may enter in, for a LONG or SHORT bias; every other bias
(STAND_ASIDE, NEUTRAL, none) builds none. Prices are exact decimals in cents; a zone is written with floats. The parameters are in `zone_params.yaml`
(`zones-1`: value, unit, boundary and why for each; the checksum is pinned like the rules').

| Step                | What it does                                                                                                                                                                                                                                                                                                                       |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reference price     | **D4:** the close of the last closed M5 bar (`reference_close`), as 2.8 uses it. Not the labelled last price (the bar still forming): it is not in the bundle. On 18 Sep that is 4378.31, not 4377.99                                                                                                                              |
| Levels              | The channel levels (UOEDT, baseline, LOEDT, M5 and M15) of every available sensor, each once (MCD3 repeats them), and `sr_1` to `sr_16` from the bundle's `context_levels`. Prices are taken to cents                                                                                                                              |
| Zone sources        | **D6:** the M5 channel levels strictly on the bias side of the price (**D7 d:** a level equal to the price is on neither side), of a channel that has a width (UOEDT above LOEDT). M15 and `sr_*` levels are never sources                                                                                                         |
| Structure           | **D5:** every level there is. It is the "next structural level" the invalidation sits behind, the "opposing level" the runway runs to, and confluence when inside a zone. It makes no zone of its own. M15 levels follow the same rules as `sr_*`                                                                                  |
| Zone                | Each source level plus and minus **10%** of its own channel's width, rounded half up to cents (3.406 gives 3.41). Zones that overlap or touch merge; the range is the union                                                                                                                                                        |
| Reference of a zone | **D7 b:** the member level nearest the price: the highest for a LONG, the lowest for a SHORT                                                                                                                                                                                                                                       |
| Confluence          | The number of distinct structure levels inside the range, edges included (the members among them)                                                                                                                                                                                                                                  |
| Invalidation        | **D7 a, ADR-032:** $0.50 beyond the nearest structure level strictly past the zone. The stop distance is measured from the zone's reference price and is never under **$13**: if the nearest level gives less, or there is none, it is exactly $13 (not the next level). The basis says which: `LEVEL`, `MINIMUM_STOP`, `NO_LEVEL` |
| Runway              | **D7 e:** the distance from the reference price to the nearest structure level strictly beyond it on the far side from the entry; the ratio is that over the stop distance, to two decimals. No such level: runway and ratio are empty                                                                                             |
| Rank                | Confluence, then the runway ratio as stored (none ranks first: the most room), then the distance of the reference price from the price. At most five are kept; `Z1` is the best                                                                                                                                                    |
| Pills               | **ADR-033:** the reference prices in rank order, one per zone, none when there are no zones. No filler price, no ladder. The modal is Section 6 (step 5); `pills.py` is the data it reads                                                                                                                                          |

Each zone carries the row of 3.6 (id, range, reference price, source sensors, confluence count, invalidation price, stop distance, next opposing level,
runway, runway ratio, rank) and, so that it can be audited and replayed: the levels it was made from, the levels inside it, the invalidation basis and the
level it sits behind. A stored row also names the slot, the trader type, and the version and checksum of the parameters. `zone_problems` is the guard that
refuses a zone that is not consistent with itself and with the parameters; the runner will put it between the builder and the database.

**Worked example.** Architecture 3.7 on its own numbers (price 4377.99, M5 UOEDT 4384.28, baseline 4367.25, LOEDT 4350.22, M15 UOEDT 4279.21): Z1 is
4363.84 to 4370.66, reference 4367.25, invalidation 4349.72 (stop 17.53), runway 17.03, ratio 0.97; Z2 is 4346.81 to 4353.63, reference 4350.22, invalidation
4278.71 (stop 71.51), runway 17.03, ratio 0.24. A test pins every figure. With the 18 Sep fixture's own levels and its `sr_*` the figures differ (section below).

### Things to know about the zones (found while building)

- **A level between the reference price and the zone's far edge is both confluence and the opposing level** (D7 e says "beyond the reference price"). The
  conservative reading: a resistance just above the entry is an obstacle even though it also marks the zone. On 18 Sep `sr_1` (4369.57) sits inside the
  baseline zone and 2.37 above its reference: confluence 2, runway 2.37. The alternative is to run the runway from the zone's far edge; say if you prefer it.
- **With `sr_*` the 18 Sep ranking differs from 3.7's.** The two M5 zones each gain a confluence level (`sr_1`, `sr_2`), the invalidations move behind `sr_2`
  and `sr_3`, and the runways shrink to 2.37 and 0.76 (ratios 0.14 and 0.05). The baseline zone is still first. The numbers of 3.7 are reproduced only without `sr_*`.
- **D7 f's last tie-break, "then the lower price", can never apply.** Every zone of one bias is on the same side of the price and no two zones share a
  reference price (they would have merged), so their distances from the price differ: the order is total after three keys. It is not in the code.
- **A LONG with the price below the whole M5 channel has no zones.** On 28 Sep 14:15 the readings are LONG (the snapback of row 2) but the price is
  4138.78, below every M5 level: there is no level on the bias side to make a zone from, so the reading has no zones (`NO_ZONE_SOURCES`). That is D6 as
  approved; supports from `sr_*` or the M15 channel are structure, not sources.
- **The stop distance is measured from the reference price, not from the zone's edge**, as 3.7 does (4367.25 - 4349.72 = 17.53).
- **Two sensors with different channels** each give their own zones from their own width (MCD2 and MCD3 normally give the same levels, which are one).

## 9. Changing the rules and the zone parameters

A change to any row, text or the order of the rules is a new file (`rules/draft-2.yaml`, its `rules_version` the same as its name), a decision-log entry and a
replay of the stored cycles and the golden scenarios (walkthrough task P8). The checksum of `draft-1` is pinned in `tests/test_synthesis_rules.py`;
the six readings of the real cycles are pinned in `tests/test_synthesis_fixtures.py`. Neither constant is changed to make a test pass.

A change to a zone parameter is a new `zones_version` (`zones-2`) and a decision-log entry; keep `zone_params.yaml` of the old version as
`zone_params.zones-1.yaml` so stored zones can be replayed. The checksum of `zones-1` is pinned in `tests/test_zones_params.py`.
