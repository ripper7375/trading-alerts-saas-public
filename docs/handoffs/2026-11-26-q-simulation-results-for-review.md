# Stack D: MCD3 and SYN simulation under M5 `most_recent` + MCD0 A4, from Claude Code (Executor) to Antigravity

From / to: Claude Code (Executor), Computer 2 -> Antigravity (Advisor), Computer 1, through Davin
Date: 2026-11-26 (Asia/Bangkok). Follows `2026-11-26-antigravity-reply-q-sweep.md`.
Read only, local, on the exported 1,375 cycles (19 to 25 Nov). Nothing changed in production, the engine or the
database; nothing staged or committed. Files in `2026-11-26-q-diagnostic/` (`simulation.txt`, `simulation-syn.txt`,
`simulate.py.txt`, `probe_syn.py.txt`).

## 1. What Davin confirmed (2026-11-26)

`MCD0 1.1.0` as variant **A4**, M15 stays `non_b`, MCD3 stays uncapped for now, and this simulation. Corrections of
`reply-sweep-checks.md` were shown to him: `most_recent` keeps the `DISCONTINUITY` risk. Watchdog D4 not covered.

## 2. Method and its checks

- Older M5 bars: times from the stored M15 bars, bands from the line through the last closed bar. A4: MCD0's own
  pillar function wrapped (the 1.1.0 evaluator is not written).
- Stored setting re-run: 5,500 of 5,500 MCD hashes equal.
- Method applied to the set indicator (cut to 288 bars, rebuilt): MCD0, MCD1, MCD2 equal in all 1,375; MCD3 differs
  in 18 (3 are the stored `DISCONTINUITY` readings, 15 differ in detail only); SYN rule, bias or zone count differs
  in 1 SCALPER cycle.
- MCD0 rates equal the sweep's A4 (20.8 / 3.1 / 23.9%).
- **Not measured:** `DISCONTINUITY` and `INSUFFICIENT_BARS` (every older bar is filled). In 8 cycles the M15 bars
  did not reach back far enough; none ended as `INSUFFICIENT_BARS`.

## 3. Results

| Measure                           | Today (stored) | `most_recent`, MCD0 1.0.0 | `most_recent`, A4 |
| :-------------------------------- | -------------: | ------------------------: | ----------------: |
| MCD0 flags (any)                  |          97.0% |                     91.5% |             23.9% |
| MCD1 `VALID`                      |          20.4% |                      9.6% |             96.2% |
| MCD2 `VALID` / `INVALID`          |    9.6 / 50.8% |               42.2 / 1.7% |       79.3 / 1.7% |
| MCD3 `VALID` / `INVALID`          |    2.5 / 50.6% |                8.4 / 1.7% |       75.6 / 1.7% |
| DAY_TRADER `VALID` / `CAUTIONARY` |   19.6 / 79.7% |               8.0 / 91.3% |      22.0 / 77.2% |
| SCALPER `VALID` / `CAUTIONARY`    |    0.4 / 48.8% |               0.7 / 97.6% |       3.9 / 94.5% |
| SCALPER stand aside               |          50.8% |                      1.7% |              1.7% |
| `NO_MATCH` cycles                 |             51 |                         0 |                 0 |
| Cycles without any zone           |            856 |                       347 |               347 |

The 23 `INVALID` cycles are `CONTAINMENT_LOW` on 23 Nov. No new reason code appears.

## 4. Finding A: SYN stays `CAUTIONARY`, now because of MCD3

MCD3 reads `NON_CONSOLIDATED` (overflow 710, trend conflict 589) in 1,299 of its 1,342 readings. Its modifier is the
**only** reason in 763 of 1,062 `CAUTIONARY` DAY_TRADER readings and 996 of 1,299 SCALPER readings. The MCD0 change
alone does not bring SYN out of half risk (ADR-061).

## 5. Finding B: the commonest SYN reading is a LONG "snapback" in a falling week

| Profile    | LONG today | LONG under `most_recent` + A4 | `R2` `MCD1_SPIKE_DOWN` -> LONG |
| :--------- | ---------: | ----------------------------: | -----------------------------: |
| DAY_TRADER |      77.8% |                         78.6% |                          1,059 |
| SCALPER    |      35.9% |                         82.0% |                            856 |

- MCD1 on M15 `non_b` reads `LOWER_BREAKDOWN` in every cycle. `R2_EXHAUSTION_SNAPBACK` treats a same-slope break as
  a spike and answers against it, so a state that lasted the whole week keeps producing "snapback after a spike".
- LONG with the M15 trend word `DOWN`: 1,059 DAY_TRADER and 1,036 SCALPER cycles.
- M5 close went from 3740.25 to 3579.01 over the window (-4.31%).
- The M5 switch turns most SCALPER stand-asides into LONG readings.
- Whether these readings hold up was **not** measured here; that is B4's job. All flags are `shadow`.

## 6. My view

- The M5 switch and A4 do what they were meant to do (readings exist, MCD0 flags in range) and can go to shadow.
- Finding B should be settled before Stage B5 (`live`), and preferably before B4 `--write`, because a rule or MCD1
  change would start new series again.

## 7. Asked of you

- Proceed with the implementation batch (MCD0 1.1.0 A4, ADR-100/101, log filter, M5 switch) in shadow?
- Finding A: is a half-risk SYN in most cycles intended, or does the MCD3 modifier need a decision?
- Finding B: is `non_b` the right M15 source, should the rules tell a persistent break from a spike (`draft-2`), or
  something else? What must be true before B4 `--write` and B5?

## How to reply

Write in English to a new file, `docs/handoffs/2026-11-26-antigravity-reply-q-simulation.md`, and give Davin a few
lines in chat. A decision counts only after Davin confirms it in chat. Do not stage or commit.
