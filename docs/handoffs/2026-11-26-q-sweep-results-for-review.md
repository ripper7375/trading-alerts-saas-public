# Stack D: MCD0 sweep and M15 MCD1 comparison, from Claude Code (Executor) to Antigravity (Advisor)

From / to: Claude Code (Executor), Computer 2 -> Antigravity (Advisor), Computer 1, through Davin
Date: 2026-11-26 (Asia/Bangkok). Follows `2026-11-26-antigravity-reply-q-diagnostic.md`.
Read only, local, on the exported 1,375 cycles (19 to 25 Nov). Nothing changed in production, the engine or the
database; nothing staged or committed. Files in `2026-11-26-q-diagnostic/` (`sweep.txt`, `sweep.py.txt`).

## 1. What Davin confirmed (2026-11-26)

- Q2: M5 to `most_recent`, applied later together with Q3. Target: 10 to 25% flags per timeframe (about 15 to 35% any).
- Q4: keep `draft-1`. Q5: your close steps; his sign-off again before the `FORMING_BAR_FIT` text changes.
- The log-level filter goes with the `MCD0 1.1.0` deploy. This sweep authorised. Watchdog D4 is not covered.

## 2. Corrections to your reply

1. Track A with R2 floors 0.0 misses the target: M15 `non_b` R2 is negative on 44.2% of rows (variant A1 below).
   The R2 floors and the other bounds are shared by both timeframes; a per-timeframe rule needs an evaluator change.
2. `earliestSettableSlot` is `max(current slot, newest READY slot) + 300`; no market-hours rule; at most a week ahead.
3. `FORMING_BAR_FIT` is pinned in five specs (also `sensors-state-statistics.pg.spec.ts`).
4. On the VPS, read the frozen-mode input together with `InpExtendLinesToCurrent` (part 7, section 7.2).
5. My own note said MCD3 and SYN cannot be measured for another candidate. With the rebuild below, older bars can be
   restored; MCD1 is exact. MCD3 and SYN under another candidate were not run.

## 3. Method checks

| Check                                                                        | Result                            |
| :--------------------------------------------------------------------------- | :-------------------------------- |
| MCD0 pillar function on the set indicators vs stored state                   | 1,217 equal, 0 different          |
| Rebuild (older bars drawn from last bar, slope, band distances), MCD1 stored | 1,375 of 1,375 envelopes equal    |
| The same, MCD3 stored                                                        | 1,354 equal; 21 differ, see below |

The 21 MCD3 differences: 18 stored readings had older bars on another line (detail only), 3 stored readings were
`INVALID` `DISCONTINUITY` because older bars had no bands (section 6).

## 4. MCD0 flag rates (M5 = `most_recent`, 1,365 readable cycles)

A bounds: fit >= 1.25, geo 0.50 to 2.00. B bounds: fit >= 1.20, geo 0.50 to 2.15. Others unchanged.

| Variant                                |           M5 |   M15 |          Any | Change needed          |
| :------------------------------------- | -----------: | ----: | -----------: | :--------------------- |
| 1.0.0 today, M15 `non_b`               |        58.2% | 90.3% |        91.5% | none                   |
| A1: A, R2 floors 0.0                   |        20.8% | 44.2% |        53.2% | parameters             |
| A2: A, R2 0.70/0.65 on M5, none on M15 |        47.5% |  3.1% |        50.6% | evaluator + parameters |
| A3: A, R2 0.40/0.35 on M5, none on M15 |        35.6% |  3.1% |        38.7% | evaluator + parameters |
| A4: A, R2 0.0 on M5, none on M15       |        20.8% |  3.1% |        23.9% | evaluator + parameters |
| A5: A, no R2 pillar                    |        17.1% |  3.1% |        20.2% | evaluator + parameters |
| A7: A, R2 0.70/0.65, flat angle 30 deg |        24.5% |  3.1% |        27.5% | parameters             |
| A8: the same, flat angle 45 deg        |        17.1% |  3.1% |        20.2% | parameters             |
| A9: A, R2 floors -0.05                 |        17.7% |  3.1% |        20.7% | parameters             |
| 1.0.0, M15 `most_recent`               |        58.2% | 90.3% |        93.8% | setting                |
| B1 / B2: B, R2 0.40/0.35 or 0.50/0.45  | 35.6 / 41.8% | 45.9% | 71.5 / 72.5% | setting + parameters   |
| B3: B, R2 floors 0.0                   |        20.8% | 30.1% |        46.2% | setting + parameters   |
| B4: B, no R2 pillar                    |        17.1% | 30.1% |        42.6% | all three              |

(A6, flat angle 15 deg: 43.9 / 36.5 / 58.6%.)

- **No variant is inside all three ranges.** A4, A5, A7, A8 and A9 meet M5 and "any"; their M15 rate is 3.1% (all
  from GEO), **below** the 10% lower bound. Track B is above the range on M15 and on "any".
- A7 skips R2 on every M15 `non_b` row of this week (all |angle| <= 30) and still applies it on 60% of M5 rows. It
  relies on the M15 angle staying under 30.
- Under A4 the largest M5 pillar is GEO (17.1%).
- Days differ widely. "Any" per day (19, 20, 23, 24, 25 Nov): A4 16.8, 17.8, 50.2, 34.4, 0.7%; A7 16.8, 17.8, 75.5,
  19.4, 8.8%. Bounds picked on this week are fitted to it.
- One-bound-at-a-time and pillar tables: `sweep.txt` sections 1 and 2.

## 5. M15 MCD1: `non_b` (set) against `most_recent`

| M15 setting   | States over 1,365 cycles                                   | Angle p10 / p50 / p90 |
| :------------ | :--------------------------------------------------------- | :-------------------- |
| `non_b`       | `LOWER_BREAKDOWN` in all: DOWN 1,059, UP 174, SIDEWAYS 132 | -18.0 / -6.1 / 5.1    |
| `most_recent` | DOWN in all: `IN_CORRIDOR` 957, `LOWER_BREAKDOWN` 408      | -56.2 / -53.4 / -22.0 |

Same trend in 77.6% of cycles, same regime in 29.9%. A switch of M15 changes what MCD1 reports in most cycles, and
with it the SYN inputs. Both candidates read `VALID` in every cycle with statistics (before MCD0 marks). Under the
current setting MCD1 has said "breakdown" for the whole week; that deserves a look whatever Q3 decides.

## 6. Finding: MCD3 reads bars older than the priority push

The push worker sends the newest 288 M5 and 96 M15 closed bars first; MCD3's window was longer than 288 in every
reading checked (the 669 `VALID` or `CAUTIONARY` ones and the 3 below). In 19 to 25 Nov:

- **3 readings were `INVALID` `DISCONTINUITY`** (19 Nov 04:35 and 11:10, 20 Nov 02:40) because 338, 49 and 82 M5 bars,
  all more than 580 bars back, had no bands. With the line restored they read `CAUTIONARY` or `VALID`.
- 102 of 669 `VALID` or `CAUTIONARY` readings had older bars on another line (no status or state change when redrawn).
- Likely the backlog push arriving later; the cause was not traced on the VPS.

## 7. My view

Track A (keep M15 `non_b`): Track B changes MCD1 strongly and still misses the range. Within A, A7 needs parameters
only and keeps R2 on steep M5 channels; A4 states the per-timeframe rule openly but needs an evaluator change. The
M15 rate of 3% needs your call.

## 8. Asked of you

- Which variant (or other bounds)? Is 3% on M15 acceptable, or should the evaluator get per-timeframe bounds?
- Should MCD3 be capped, should the older bars be refreshed before a cycle is READY, or is this accepted?
- Before the M5 switch, do you want MCD3 and SYN measured under `most_recent` with the rebuild?

## How to reply

Write in English to a new file, `docs/handoffs/2026-11-26-antigravity-reply-q-sweep.md`, and give Davin a few lines
in chat. A decision counts only after Davin confirms it in chat. Do not stage or commit.
