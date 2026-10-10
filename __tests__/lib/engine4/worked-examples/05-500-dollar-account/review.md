# Worked example 05-500-dollar-account

**File G's $500 account (architecture 6.8)**

$500 of equity, 0.50% risk ($2.50), a $15.00 stop, $4 commission, BUY 2,545.00, leverage at the 1:5 ceiling, Max RPT 2.00%. The document counts this as a risk shortfall only. The oracle finds a second cause: even at 1:5 a minimum lot (0.01 x 100 x 2,545 = $2,545 of notional) needs $509.00 of equity, so the leverage limit also stops it. Both are stated as facts ($3,008.00 for the risk, $509.00 for the leverage); raising the risk to 3.01% would be above Max RPT and would not fix the leverage, so only Decline is offered. Architecture 6.8 is rewritten to say this.

## 1. What goes in

| Input | Value |
| --- | --- |
| Side | BUY |
| Entry (chart / bid price) | 2545.00 |
| Stop distance (SLD) | $15.00 |
| Equity | $500 |
| Risk chosen | 0.50% |
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
| 1 Max lot from leverage | 0.0098 | max leverage x equity / (fill price x contract) = 2500/254500 |
| 2 Lot at the stop | 0.0017 | risk as a share of equity x equity / (100 x loss per lot) = 250/150400 |
| 3 Effective lot | none | rounds down to less than the broker minimum: underflow (RISK + LEVERAGE) |
| 4 Leverage used | none | no lot |
| 5 Declared risk | $2.50 | risk % x equity |
| 6 Actual risk | none | lot x loss per lot |
| 7 Stop price (trigger / chart level) | 2,530.00 / 2,530.00 | BUY: entry - SLD |

## 3. The scenarios (6.7, plan D5): Normal 1.75x

| Scenario | RRR | Target distance | Target price | Chart level | Net profit |
| --- | --- | --- | --- | --- | --- |
| CONSERVATIVE | 1.5x | 22.60 | 2567.60 | 2567.60 | n/a |
| NORMAL | 1.75x | 26.36 | 2571.36 | 2571.36 | n/a |
| AGGRESSIVE | 2x | 30.12 | 2575.12 | 2575.12 | n/a |

## 4. A lot below the broker minimum (6.8)

Causes: **RISK + LEVERAGE**. One minimum lot would lose $15.04 at the stop, which is 3.0080% of equity.

| Option | What it gives |
| --- | --- |
| Decline | - |

- Fact (never a button): this setup needs at least $3,008.00 of equity at 0.5% risk.
- Fact (never a button): this setup needs at least $509.00 of equity at 1:5 leverage.

## To approve

Read the tables above against the architecture (6.4 to 6.9). If every figure is right, edit `approval.json` yourself: set `status` to `APPROVED`, `approved_by` to your name and `approved_on` to the date (YYYY-MM-DD). Leave the two hashes as they are: they pin the exact `scenario.json` and `expected.json` you read. `record` never writes APPROVED, and puts this example back to PENDING if either file changes.
