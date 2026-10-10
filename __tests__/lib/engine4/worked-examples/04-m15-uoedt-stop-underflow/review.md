# Worked example 04-m15-uoedt-stop-underflow

**18 Sep, zone Z1, a stop behind M15 UOEDT ($88.24): a lot below the broker minimum**

The fourth of the six structural stops of the stored cycle. The risk limit allows only 0.0085 lot, which rounds down to 0.00: nothing is sized (6.8). The help stays inside the trader's limits: raising the risk to the 1.77% a minimum lot needs is NOT offered (it is above Max RPT 1.50%), the nearer structural stops are, and the equity a minimum lot needs is a fact, never a button.

## 1. What goes in

| Input | Value |
| --- | --- |
| Side | BUY |
| Entry (chart / bid price) | 4367.20 |
| Stop distance (SLD) | $88.24 |
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
| Derived: fill price, loss per ounce, loss per lot | 4367.2, 88.24, 8828 | a BUY fills at entry + spread, a SELL at the entry; loss per lot = loss per ounce x contract + commission |
| 1 Max lot from leverage | 0.0172 | max leverage x equity / (fill price x contract) = 7500/436720 |
| 2 Lot at the stop | 0.0085 | risk as a share of equity x equity / (100 x loss per lot) = 7500/882800 |
| 3 Effective lot | none | rounds down to less than the broker minimum: underflow (RISK) |
| 4 Leverage used | none | no lot |
| 5 Declared risk | $75.00 | risk % x equity |
| 6 Actual risk | none | lot x loss per lot |
| 7 Stop price (trigger / chart level) | 4,278.96 / 4,278.96 | BUY: entry - SLD |

## 4. The scenarios (6.7, plan D5): Normal 1.75x

| Scenario | RRR | Target distance | Target price | Chart level | Net profit |
| --- | --- | --- | --- | --- | --- |
| CONSERVATIVE | 1.5x | 132.46 | 4499.66 | 4499.66 | n/a |
| NORMAL | 1.75x | 154.53 | 4521.73 | 4521.73 | n/a |
| AGGRESSIVE | 2x | 176.60 | 4543.80 | 4543.80 | n/a |

## 5. A lot below the broker minimum (6.8)

Causes: **RISK**. One minimum lot would lose $88.28 at the stop, which is 1.7656% of equity.

| Option | What it gives |
| --- | --- |
| A nearer structural stop | $16.78: lot 0.01, actual risk $16.82 |
| A nearer structural stop | $17.54: lot 0.01, actual risk $17.58 |
| A nearer structural stop | $33.14: lot 0.01, actual risk $33.18 |
| Decline | - |

- Fact (never a button): this setup needs at least $5,885.34 of equity at 1.5% risk.

## 6. Room to the next opposing level (6.5)

Next level: **M15 sr_1 at 4369.57**, $2.37 from the entry. A target at or past it is never recommended (D8: strictly before).

## To approve

Read the tables above against the architecture (6.4 to 6.9). If every figure is right, edit `approval.json` yourself: set `status` to `APPROVED`, `approved_by` to your name and `approved_on` to the date (YYYY-MM-DD). Leave the two hashes as they are: they pin the exact `scenario.json` and `expected.json` you read. `record` never writes APPROVED, and puts this example back to PENDING if either file changes.
