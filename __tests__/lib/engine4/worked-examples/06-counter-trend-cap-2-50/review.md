# Worked example 06-counter-trend-cap-2-50

**18 Sep, zone Z1, a counter-trend setup and a profile target of 3.00x**

The profile asks for 3.00x, which is allowed (1.50x to 3.50x) but not for a counter-trend SETUP (ADR-064): Normal is lowered to the 2.50x cap, Conservative is 2.25x, and the Aggressive 2.75x scenario is left out (ABOVE_COUNTER_TREND_CAP). Equity $10,000 at 1:5, risk 1.00%: lot 0.05, actual risk $84.10. The net profit of Conservative, $189.225, is exactly half a cent and is shown as $189.23 (half away from zero). Still no badge: every target lies past 4369.57.

## 1. What goes in

| Input | Value |
| --- | --- |
| Side | BUY |
| Entry (chart / bid price) | 4367.20 |
| Stop distance (SLD) | $16.78 |
| Equity | $10,000 |
| Risk chosen | 1.00% |
| Max leverage | 1:5 |
| Commission, round trip per lot | $4 |
| Contract size, lot min / step / max | 100, 0.01 / 0.01 / 100 |
| Typical spread (points x point) | 0 x 0.01 = 0 |
| Target RRR of the profile | 3.00x |
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
| 1 Max lot from leverage | 0.1145 | max leverage x equity / (fill price x contract) = 50000/436720 |
| 2 Lot at the stop | 0.0595 | risk as a share of equity x equity / (100 x loss per lot) = 10000/168200 |
| 3 Effective lot | 0.05 | the smallest of the two and the broker maximum (RISK), rounded DOWN to the lot step |
| 4 Leverage used | 2.184x | lot x contract x fill price / equity = 21836/10000 |
| 5 Declared risk | $100.00 | risk % x equity |
| 6 Actual risk | $84.10 (0.84% of equity) | lot x loss per lot |
| 7 Stop price (trigger / chart level) | 4,350.42 / 4,350.42 | BUY: entry - SLD |

## 4. The scenarios (6.7, plan D5): Normal 2.5x (capped from the profile's 3.00x)

| Scenario | RRR | Target distance | Target price | Chart level | Net profit |
| --- | --- | --- | --- | --- | --- |
| CONSERVATIVE | 2.25x | 37.89 | 4405.09 | 4405.09 | $189.23 |
| NORMAL | 2.5x | 42.09 | 4409.29 | 4409.29 | $210.25 |

Left out: AGGRESSIVE 2.75x (ABOVE_COUNTER_TREND_CAP).

## 5. Room to the next opposing level (6.5)

Next level: **M15 sr_1 at 4369.57**, $2.37 from the entry. A target at or past it is never recommended (D8: strictly before).

## 6. The badge (6.5, ADR-063)

| Table row | Highest badge | Targets strictly before the level | Badge |
| --- | --- | --- | --- |
| COUNTER_TREND | CONSERVATIVE | none | **no badge** (NO_SCENARIO_FITS) |

## To approve

Read the tables above against the architecture (6.4 to 6.9). If every figure is right, edit `approval.json` yourself: set `status` to `APPROVED`, `approved_by` to your name and `approved_on` to the date (YYYY-MM-DD). Leave the two hashes as they are: they pin the exact `scenario.json` and `expected.json` you read. `record` never writes APPROVED, and puts this example back to PENDING if either file changes.
