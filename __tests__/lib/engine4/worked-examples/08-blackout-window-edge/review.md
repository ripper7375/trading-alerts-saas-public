# Worked example 08-blackout-window-edge

**The Tier-1 blackout at its edges (architecture 6.6)**

A Tier-1 release blocks Report 2 from 15 minutes before to 15 minutes after, with both edges inclusive: -15:00 and +15:00 block, -15:01 and +15:01 do not (6.14: releases at -16, -14, +14 and +16 give allowed, blocked, blocked, allowed). A release whose time is only approximate blocks for 60 minutes either side. A HIGH-impact USD release inside the holding window (12 h Day Trader, 2 h Scalper) is a warning, not a block. A calendar not exported for more than 45 minutes still blocks, and its age is shown. The times are UTC, as the exporter stores them; the ids are TEST ids.

## 1. What goes in

| Release | Event id | Time (UTC) | Time mode | Impact | Tier-1? |
| --- | --- | --- | --- | --- | --- |
| TEST US CPI (exact time) | 900000001 | 2026-09-17T12:30:00Z | exact | USD HIGH | yes |
| TEST HIGH-impact USD release, not Tier-1 | 900000099 | 2026-09-17T15:30:00Z | exact | USD HIGH | no |
| TEST US NFP (approximate time) | 900000004 | 2026-09-19T12:30:00Z | approximate | USD HIGH | yes |

The event ids are TEST ids (900000001 to 900000004 and 900000099), not MT5 calendar ids: the real list is Davin's decision D13.

## 2. Probes: is a Tier-1 release within the window? (6.6)

Blocked from 15 minutes before to 15 minutes after an exact Tier-1 release (60 minutes when the time is approximate); both edges are inclusive. A calendar not exported for more than 45 minutes still blocks, and its age is shown.

| Probe | Trader | Now (UTC) | Result | Window | Warnings (holding window) | Calendar age |
| --- | --- | --- | --- | --- | --- | --- |
| CPI -16:01 | DAY_TRADER | 2026-09-17T12:13:59Z | CLEAR | - | TEST-CPI in 961s (Tier-1), TEST-HIGH in 11761s | 600s |
| CPI -15:01 | DAY_TRADER | 2026-09-17T12:14:59Z | CLEAR | - | TEST-CPI in 901s (Tier-1), TEST-HIGH in 11701s | 600s |
| CPI -15:00 (window opens) | DAY_TRADER | 2026-09-17T12:15:00Z | BLOCKED | 2026-09-17T12:15:00Z to 2026-09-17T12:45:00Z | TEST-HIGH in 11700s | 600s |
| CPI -14:59 | DAY_TRADER | 2026-09-17T12:15:01Z | BLOCKED | 2026-09-17T12:15:00Z to 2026-09-17T12:45:00Z | TEST-HIGH in 11699s | 600s |
| CPI 0:00 | DAY_TRADER | 2026-09-17T12:30:00Z | BLOCKED | 2026-09-17T12:15:00Z to 2026-09-17T12:45:00Z | TEST-HIGH in 10800s | 600s |
| CPI +14:59 | DAY_TRADER | 2026-09-17T12:44:59Z | BLOCKED | 2026-09-17T12:15:00Z to 2026-09-17T12:45:00Z | TEST-HIGH in 9901s | 600s |
| CPI +15:00 (window closes) | DAY_TRADER | 2026-09-17T12:45:00Z | BLOCKED | 2026-09-17T12:15:00Z to 2026-09-17T12:45:00Z | TEST-HIGH in 9900s | 600s |
| CPI +15:01 | DAY_TRADER | 2026-09-17T12:45:01Z | CLEAR | - | TEST-HIGH in 9899s | 600s |
| CPI +16:00 | DAY_TRADER | 2026-09-17T12:46:00Z | CLEAR | - | TEST-HIGH in 9840s | 600s |
| NFP approximate -60:01 | DAY_TRADER | 2026-09-19T11:29:59Z | CLEAR | - | TEST-NFP in 3601s (Tier-1) | 600s |
| NFP approximate -60:00 | DAY_TRADER | 2026-09-19T11:30:00Z | BLOCKED | 2026-09-19T11:30:00Z to 2026-09-19T13:30:00Z | - | 600s |
| NFP approximate +60:00 | DAY_TRADER | 2026-09-19T13:30:00Z | BLOCKED | 2026-09-19T11:30:00Z to 2026-09-19T13:30:00Z | - | 600s |
| NFP approximate +60:01 | DAY_TRADER | 2026-09-19T13:30:01Z | CLEAR | - | - | 600s |
| Scalper, CPI -15:01 (the other release is outside 2 h) | SCALPER | 2026-09-17T12:14:59Z | CLEAR | - | TEST-CPI in 901s (Tier-1) | 600s |
| calendar 45:00 old, CPI -14:59 (still blocks) | DAY_TRADER | 2026-09-17T12:15:01Z | BLOCKED | 2026-09-17T12:15:00Z to 2026-09-17T12:45:00Z | TEST-HIGH in 11699s | 2700s |
| calendar 45:01 old, CPI -14:59 (still blocks, late) | DAY_TRADER | 2026-09-17T12:15:01Z | BLOCKED | 2026-09-17T12:15:00Z to 2026-09-17T12:45:00Z | TEST-HIGH in 11699s | 2701s (late) |

## To approve

Read the tables above against the architecture (6.4 to 6.9). If every figure is right, edit `approval.json` yourself: set `status` to `APPROVED`, `approved_by` to your name and `approved_on` to the date (YYYY-MM-DD). Leave the two hashes as they are: they pin the exact `scenario.json` and `expected.json` you read. `record` never writes APPROVED, and puts this example back to PENDING if either file changes.
