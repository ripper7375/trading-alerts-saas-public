# Worked example 01-doc-6-7-table

**The corrected table of architecture 6.7**

File G's inputs (equity $10,000, BUY 2,545.00, risk 1.00%, stop $15.00, commission $4 a lot, leverage up to 1:5) worked out from the formulas of 6.7 with no help from the engine. The document calls this table a unit-test fixture and says it is corrected: lot 0.06, actual risk $90.24 (0.90%), leverage used 1.527x, targets 2,567.60 / 2,571.36 / 2,575.12 and net profits $135.36 / $157.92 / $180.48. A spread of zero keeps it equal to the printed table.

## 1. What goes in

| Input | Value |
| --- | --- |
| Side | BUY |
| Entry (chart / bid price) | 2545.00 |
| Stop distance (SLD) | $15.00 |
| Equity | $10,000 |
| Risk chosen | 1.00% |
| Max leverage | 1:5 |
| Commission, round trip per lot | $4 |
| Contract size, lot min / step / max | 100, 0.01 / 0.01 / 100 |
| Typical spread (points x point) | 0 x 0.01 = 0 |
| Target RRR of the profile | 1.75x |
| Max RPT, Min SLD | 2%, $13 |
| The setup is | with the trend |

## 2. The ten steps (6.7), as the oracle worked them

| Step | Value | How |
| --- | --- | --- |
| Derived: fill price, loss per ounce, loss per lot | 2545, 15, 1504 | a BUY fills at entry + spread, a SELL at the entry; loss per lot = loss per ounce x contract + commission |
| 1 Max lot from leverage | 0.1965 | max leverage x equity / (fill price x contract) = 50000/254500 |
| 2 Lot at the stop | 0.0665 | risk as a share of equity x equity / (100 x loss per lot) = 10000/150400 |
| 3 Effective lot | 0.06 | the smallest of the two and the broker maximum (RISK), rounded DOWN to the lot step |
| 4 Leverage used | 1.527x | lot x contract x fill price / equity = 15270/10000 |
| 5 Declared risk | $100.00 | risk % x equity |
| 6 Actual risk | $90.24 (0.90% of equity) | lot x loss per lot |
| 7 Stop price (trigger / chart level) | 2,530.00 / 2,530.00 | BUY: entry - SLD |

## 3. The scenarios (6.7, plan D5): Normal 1.75x

| Scenario | RRR | Target distance | Target price | Chart level | Net profit |
| --- | --- | --- | --- | --- | --- |
| CONSERVATIVE | 1.5x | 22.60 | 2567.60 | 2567.60 | $135.36 |
| NORMAL | 1.75x | 26.36 | 2571.36 | 2571.36 | $157.92 |
| AGGRESSIVE | 2x | 30.12 | 2575.12 | 2575.12 | $180.48 |

## To approve

Read the tables above against the architecture (6.4 to 6.9). If every figure is right, edit `approval.json` yourself: set `status` to `APPROVED`, `approved_by` to your name and `approved_on` to the date (YYYY-MM-DD). Leave the two hashes as they are: they pin the exact `scenario.json` and `expected.json` you read. `record` never writes APPROVED, and puts this example back to PENDING if either file changes.
