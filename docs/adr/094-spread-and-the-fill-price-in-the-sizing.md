# ADR-094: The spread and the fill price in the sizing

- **Status:** Settled (approved by Davin, 2026-10-09: decision D3 of the build step 5 plan and reading 1 of the part 1 hand-off; written down in part 8)
- **Date:** 2026-10-09
- **Section:** 6 · Engine 4 & Report 2
- **Architecture:** [STACK-D-ARCHITECTURE.md](../STACK-D-ARCHITECTURE.md) §6.7, §6.9; refines [ADR-066](066-broker-figures-from-mt5.md)

## Decision

The typical spread is a price, S = `typical_spread` × `point`. Chart prices are bid prices. A **BUY** fills at the ask (the chart entry plus S) and exits on the bid, so its loss per ounce is SLD + S, its target distance from the chart entry is the gain per ounce plus S, and its stop and target trigger at their chart levels. A **SELL** fills on the bid; its stop and target trigger on the ask, so its loss and gain per ounce are SLD and the target distance, and the chart (bid) levels where they trigger are S below their trigger prices. The leverage steps use the price the order really fills at: step 1 (the lot the leverage limit allows), step 4 (the leverage used) and the equity fact of §6.8 all use the fill price, so "leverage used is never above the limit" holds for the order as it is opened. Room to the next level and the badge compare the target's chart (bid) level with the level. Report 2 shows S and, for each stop and target, both the chart level and the trigger level.

With S = 0 every formula is the printed one: the corrected table of §6.7 (lot 0.06, actual risk $90.24, targets 2,567.60 / 2,571.36 / 2,575.12) is the unit-test fixture of that case and the first worked example.

## Alternative not chosen

Ignoring the spread in the maths and only printing it (a literal reading of the table in §6.7); a flat spread cost taken off the profit; valuing the position for leverage at the chart entry, which can put a BUY's real leverage a hair over the limit (about 0.01% on gold).

## Why

§6.9 and ADR-066 say the spread is "applied where each price triggers", which is not a formula. A trader who is long pays the spread the moment the order fills, and a short whose stop triggers on the ask loses more than the chart suggests. Putting the spread in the loss, the gain and the leverage keeps RRR equal to net profit divided by actual loss (ADR-065) for the order that is really placed. Worked example 07 (the 18 Sep zone Z1 with the 25-point test spread) shows the effect: loss per ounce $17.03 against a $16.78 stop, actual risk $68.28.

## Changing this decision

Record a new decision that names this one; set this file's status to "Superseded by ADR-nnn"; change `sizing.ts`, the oracle and the worked examples together and update STACK-D-ARCHITECTURE.md §6.7 and §6.9 in the same change.
