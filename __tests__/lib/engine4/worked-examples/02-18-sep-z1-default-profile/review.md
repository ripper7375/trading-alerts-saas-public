# Worked example 02-18-sep-z1-default-profile

**18 Sep, zone Z1, the default profile ($5,000, 1:1.5, 1.50%)**

The stored 18 Sep 20:55 cycle (a counter-trend rally, CAUTIONARY) at the profile's own figures. Plan finding F6: at a gold price of 4,367 the leverage limit (1:1.5), not the risk limit, sets the lot, so a declared $75.00 of risk becomes an actual $16.82 at the stored $16.78 stop. The report must say so plainly (decision D17 (a)). Sized at the profile's Max RPT of 1.50%; on this CAUTIONARY cycle the modal would open at half of it (example 07). No scenario fits before the next level, M15 sr_1 4369.57, which is 2.37 away: no badge, and that level is named (architecture 6.5 and 6.14 are corrected to this).

## 1. What goes in

| Input | Value |
| --- | --- |
| Side | BUY |
| Entry (chart / bid price) | 4367.20 |
| Stop distance (SLD) | $16.78 |
| Equity | $5,000 |
| Risk chosen | 1.50% |
| Max leverage | 1:1.5 |
| Commission, round trip per lot | $4 |
| Contract size, lot min / step / max | 100, 0.01 / 0.01 / 100 |
| Typical spread (points x point) | 0 x 0.01 = 0 |
| Target RRR of the profile | 1.75x |
| Max RPT, Min SLD | 1.5%, $13 |
| The setup is | counter-trend (cap 2.50x) |

The entry, the levels and the readings come from the stored, signed-off cycle `01-real-18-sep-counter-trend-rally` (DAY_TRADER reading, zone Z1); `check` fails if any of them stops matching it.

## 2. Structural stop options (6.5): each $0.50 beyond its level, at least Min SLD from the entry

| Behind | Level | Stop price | Stop distance |
| --- | --- | --- | --- |
| M15 sr_2 | 4350.92 | 4350.42 | $16.78 |
| M5 LOEDT | 4350.16 | 4349.66 | $17.54 |
| M15 sr_3 | 4334.56 | 4334.06 | $33.14 |
| M15 UOEDT | 4279.46 | 4278.96 | $88.24 |
| M15 baseline | 4214.17 | 4213.67 | $153.53 |
| M15 LOEDT | 4126.24 | 4125.74 | $241.46 |

## 3. The ten steps (6.7), as the oracle worked them

| Step | Value | How |
| --- | --- | --- |
| Derived: fill price, loss per ounce, loss per lot | 4367.2, 16.78, 1682 | a BUY fills at entry + spread, a SELL at the entry; loss per lot = loss per ounce x contract + commission |
| 1 Max lot from leverage | 0.0172 | max leverage x equity / (fill price x contract) = 7500/436720 |
| 2 Lot at the stop | 0.0446 | risk as a share of equity x equity / (100 x loss per lot) = 7500/168200 |
| 3 Effective lot | 0.01 | the smallest of the two and the broker maximum (LEVERAGE), rounded DOWN to the lot step |
| 4 Leverage used | 0.873x | lot x contract x fill price / equity = 4367.2/5000 |
| 5 Declared risk | $75.00 | risk % x equity |
| 6 Actual risk | $16.82 (0.34% of equity) | lot x loss per lot |
| 7 Stop price (trigger / chart level) | 4,350.42 / 4,350.42 | BUY: entry - SLD |

## 4. The scenarios (6.7, plan D5): Normal 1.75x

| Scenario | RRR | Target distance | Target price | Chart level | Net profit |
| --- | --- | --- | --- | --- | --- |
| CONSERVATIVE | 1.5x | 25.27 | 4392.47 | 4392.47 | $25.23 |
| NORMAL | 1.75x | 29.48 | 4396.68 | 4396.68 | $29.44 |
| AGGRESSIVE | 2x | 33.68 | 4400.88 | 4400.88 | $33.64 |

## 5. Room to the next opposing level (6.5)

Next level: **M15 sr_1 at 4369.57**, $2.37 from the entry. A target at or past it is never recommended (D8: strictly before).

## 6. The badge (6.5, ADR-063)

| Table row | Highest badge | Targets strictly before the level | Badge |
| --- | --- | --- | --- |
| COUNTER_TREND | CONSERVATIVE | none | **no badge** (NO_SCENARIO_FITS) |

## To approve

Read the tables above against the architecture (6.4 to 6.9). If every figure is right, edit `approval.json` yourself: set `status` to `APPROVED`, `approved_by` to your name and `approved_on` to the date (YYYY-MM-DD). Leave the two hashes as they are: they pin the exact `scenario.json` and `expected.json` you read. `record` never writes APPROVED, and puts this example back to PENDING if either file changes.
