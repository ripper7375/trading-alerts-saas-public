# Worked example 09-stale-symbol-specs

**A stale or future-dated symbol_specs row (architecture 6.9 and 7.6)**

Report 2 sizes with the broker's own figures, so a row older than 7 days means it is not offered until the figures refresh. The boundary second is still fresh; one second more is stale. A row dated more than 5 minutes ahead of our clock is refused as well, and so is a missing row. With the stored 18 Sep cycle otherwise fine, only the broker figures decide.

## 1. What goes in

Now is 2026-09-18T20:57:30Z. Every other row of the offer check passes (the stored 18 Sep cycle: LONG, FRESH, no release in the window, price inside the zone), so only the broker figures decide.

## 2. Probes: how old may the `symbol_specs` row be? (6.9, 7.6)

Older than 7 days is stale (the boundary second still counts as fresh). A row dated more than 5 minutes ahead of our clock is refused too, because its clock cannot be trusted and a far-future date would never go stale.

| Probe | Age | Figures | Report 2 | Reason shown |
| --- | --- | --- | --- | --- |
| one hour old (normal) | 3600 s | OK | OFFERED | - |
| 6 days 23 h 59 min 59 s old | 604799 s | OK | OFFERED | - |
| exactly 7 days old | 604800 s | OK | OFFERED | - |
| 7 days and 1 second old | 604801 s | SPECS_STALE | NOT_OFFERED | SPECS_STALE |
| dated 5 minutes ahead of our clock | 0 s | OK | OFFERED | - |
| dated 5 minutes and 1 second ahead | - | SPECS_FROM_THE_FUTURE | NOT_OFFERED | SPECS_FROM_THE_FUTURE |
| no row at all | - | NO_SPECS | NOT_OFFERED | SPECS_MISSING |

## To approve

Read the tables above against the architecture (6.4 to 6.9). If every figure is right, edit `approval.json` yourself: set `status` to `APPROVED`, `approved_by` to your name and `approved_on` to the date (YYYY-MM-DD). Leave the two hashes as they are: they pin the exact `scenario.json` and `expected.json` you read. `record` never writes APPROVED, and puts this example back to PENDING if either file changes.
