# Worked example 10-leverage-underflow-twin

**18 Sep, zone Z1, a $2,800 account: the leverage twin of 6.8**

At 4,367.20 and 1:1.5 a minimum lot needs $4,367.20 x 100 x 0.01 / 1.5 = $2,911.47 of equity. With $2,800 the risk limit would allow about 0.025 lot but the leverage limit allows only 0.0096, which rounds down to nothing. This is the leverage-caused shortfall that 6.8 did not cover (plan finding F7, decision D4): it is shown as a fact, with Decline; raising the risk or choosing a nearer stop cannot help, and the report never suggests more leverage or another equity.

## 1. What goes in

| Input | Value |
| --- | --- |
| Side | BUY |
| Entry (chart / bid price) | 4367.20 |
| Stop distance (SLD) | $16.78 |
| Equity | $2,800 |
| Risk chosen | 1.50% |
| Max leverage | 1:1.5 |
| Commission, round trip per lot | $4 |
| Contract size, lot min / step / max | 100, 0.01 / 0.01 / 100 |
| Typical spread (points x point) | 0 x 0.01 = 0 |
| Target RRR of the profile | 1.75x |
| Max RPT, Min SLD | 1.5%, $13 |
| The setup is | counter-trend (cap 2.50x) |

The entry, the levels and the readings come from the stored, signed-off cycle `01-real-18-sep-counter-trend-rally` (DAY_TRADER reading, zone Z1); `check` fails if any of them stops matching it.

## 2. The ten steps (6.7), as the oracle worked them

| Step | Value | How |
| --- | --- | --- |
| Derived: fill price, loss per ounce, loss per lot | 4367.2, 16.78, 1682 | a BUY fills at entry + spread, a SELL at the entry; loss per lot = loss per ounce x contract + commission |
| 1 Max lot from leverage | 0.0096 | max leverage x equity / (fill price x contract) = 4200/436720 |
| 2 Lot at the stop | 0.0250 | risk as a share of equity x equity / (100 x loss per lot) = 4200/168200 |
| 3 Effective lot | none | rounds down to less than the broker minimum: underflow (LEVERAGE) |
| 4 Leverage used | none | no lot |
| 5 Declared risk | $42.00 | risk % x equity |
| 6 Actual risk | none | lot x loss per lot |
| 7 Stop price (trigger / chart level) | 4,350.42 / 4,350.42 | BUY: entry - SLD |

## 3. The scenarios (6.7, plan D5): Normal 1.75x

| Scenario | RRR | Target distance | Target price | Chart level | Net profit |
| --- | --- | --- | --- | --- | --- |
| CONSERVATIVE | 1.5x | 25.27 | 4392.47 | 4392.47 | n/a |
| NORMAL | 1.75x | 29.48 | 4396.68 | 4396.68 | n/a |
| AGGRESSIVE | 2x | 33.68 | 4400.88 | 4400.88 | n/a |

## 4. A lot below the broker minimum (6.8)

Causes: **LEVERAGE**. One minimum lot would lose $16.82 at the stop, which is 0.6007% of equity.

| Option | What it gives |
| --- | --- |
| Decline | - |

- Fact (never a button): this setup needs at least $2,911.47 of equity at 1:1.5 leverage.

## To approve

Read the tables above against the architecture (6.4 to 6.9). If every figure is right, edit `approval.json` yourself: set `status` to `APPROVED`, `approved_by` to your name and `approved_on` to the date (YYYY-MM-DD). Leave the two hashes as they are: they pin the exact `scenario.json` and `expected.json` you read. `record` never writes APPROVED, and puts this example back to PENDING if either file changes.
