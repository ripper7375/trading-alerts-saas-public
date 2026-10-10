# Worked example 07-cautionary-half-risk

**18 Sep, zone Z1, a CAUTIONARY cycle: the modal opens at half the risk**

MCD0 flags both timeframes, so the Day Trader reading is CAUTIONARY (ADR-061): the modal pre-sets 0.75%, half of Max RPT 1.50%, with the reasons beside it; the trader may enter up to 1.50% and the override is recorded. Equity $10,000 at 1:5 with the TEST broker row's 25-point spread: the BUY fills at the ask, 4,367.45, so the loss per ounce is $17.03 and the leverage used is worked out at the fill price (decision D3). Lot 0.04, declared $75.00, actual $68.28; the three scenarios give $102.42, $119.49 and $136.56. These are the figures the part 7 preview shows.

## 1. What goes in

| Input | Value |
| --- | --- |
| Side | BUY |
| Entry (chart / bid price) | 4367.20 |
| Stop distance (SLD) | $16.78 |
| Equity | $10,000 |
| Risk chosen | 0.75% |
| Max leverage | 1:5 |
| Commission, round trip per lot | $4 |
| Contract size, lot min / step / max | 100, 0.01 / 0.01 / 100 |
| Typical spread (points x point) | 25 x 0.01 = 0.25 |
| Target RRR of the profile | 1.75x |
| Max RPT, Min SLD | 1.5%, $13 |
| The setup is | counter-trend (cap 2.50x) |

The entry, the levels and the readings come from the stored, signed-off cycle `01-real-18-sep-counter-trend-rally` (DAY_TRADER reading, zone Z1); `check` fails if any of them stops matching it.

## 2. The risk the modal opens on (6.4 row 3, 6.6)

| Max RPT | Pre-set | Halved? | Why |
| --- | --- | --- | --- |
| 1.5% | 0.75% | yes | MCD0_DEFECT_M15, MCD0_DEFECT_M5 |

The trader may enter any value up to Max RPT; the override and the reason shown are kept in the consent record.

## 3. Structural stop options (6.5): each $0.50 beyond its level, at least Min SLD from the entry

| Behind | Level | Stop price | Stop distance |
| --- | --- | --- | --- |
| M15 sr_2 | 4350.92 | 4350.42 | $16.78 |
| M5 LOEDT | 4350.16 | 4349.66 | $17.54 |
| M15 sr_3 | 4334.56 | 4334.06 | $33.14 |
| M15 UOEDT | 4279.46 | 4278.96 | $88.24 |
| M15 baseline | 4214.17 | 4213.67 | $153.53 |
| M15 LOEDT | 4126.24 | 4125.74 | $241.46 |

## 4. The ten steps (6.7), as the oracle worked them

| Step | Value | How |
| --- | --- | --- |
| Derived: fill price, loss per ounce, loss per lot | 4367.45, 17.03, 1707 | a BUY fills at entry + spread, a SELL at the entry; loss per lot = loss per ounce x contract + commission |
| 1 Max lot from leverage | 0.1145 | max leverage x equity / (fill price x contract) = 50000/436745 |
| 2 Lot at the stop | 0.0439 | risk as a share of equity x equity / (100 x loss per lot) = 7500/170700 |
| 3 Effective lot | 0.04 | the smallest of the two and the broker maximum (RISK), rounded DOWN to the lot step |
| 4 Leverage used | 1.747x | lot x contract x fill price / equity = 17469.8/10000 |
| 5 Declared risk | $75.00 | risk % x equity |
| 6 Actual risk | $68.28 (0.68% of equity) | lot x loss per lot |
| 7 Stop price (trigger / chart level) | 4,350.42 / 4,350.42 | BUY: entry - SLD |

## 5. The scenarios (6.7, plan D5): Normal 1.75x

| Scenario | RRR | Target distance | Target price | Chart level | Net profit |
| --- | --- | --- | --- | --- | --- |
| CONSERVATIVE | 1.5x | 25.90 | 4393.10 | 4393.10 | $102.42 |
| NORMAL | 1.75x | 30.16 | 4397.36 | 4397.36 | $119.49 |
| AGGRESSIVE | 2x | 34.43 | 4401.63 | 4401.63 | $136.56 |

## 6. Room to the next opposing level (6.5)

Next level: **M15 sr_1 at 4369.57**, $2.37 from the entry. A target at or past it is never recommended (D8: strictly before).

## 7. The badge (6.5, ADR-063)

| Table row | Highest badge | Targets strictly before the level | Badge |
| --- | --- | --- | --- |
| COUNTER_TREND | CONSERVATIVE | none | **no badge** (NO_SCENARIO_FITS) |

## To approve

Read the tables above against the architecture (6.4 to 6.9). If every figure is right, edit `approval.json` yourself: set `status` to `APPROVED`, `approved_by` to your name and `approved_on` to the date (YYYY-MM-DD). Leave the two hashes as they are: they pin the exact `scenario.json` and `expected.json` you read. `record` never writes APPROVED, and puts this example back to PENDING if either file changes.
