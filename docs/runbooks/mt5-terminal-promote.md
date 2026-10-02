# Runbook — Promoting the Standby MT5 Terminal

**Scope:** switching the v6 collector from the active MT5 terminal to the hot standby,
after an administrator has retuned EDT indicator configurations on the standby.
**Written:** 2026-09-12, from the architecture design in
`backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_data_pipeline_architecture/ACTIVE-STANDBY-TERMINAL-ARCHITECTURE.md`.
Read that document first if you have not — this runbook is the procedure, not the reasoning.
**Time:** ~10 minutes, most of it waiting for verification.
**Outage:** none. Collector restart is seconds; the push worker is untouched and keeps
draining throughout.

> **Not yet rehearsed against a real second terminal.** At the time of writing, terminals
> A / B / S had not been built. The first promote should be performed during a market
> close, with §5 confirmed before it is needed in anger.

---

## 0. Know what you are touching

Three MT5 terminals, and only two of them alternate:

| Terminal       | Carries                                                            | Alternates? |
| -------------- | ------------------------------------------------------------------ | ----------- |
| **A** (EDT)    | 26 EDT indicator attachments + calendar and symbol-specs exporters | Yes         |
| **B** (EDT)    | 26 EDT indicator attachments + calendar and symbol-specs exporters | Yes         |
| **S** (static) | 8 × `OHLCV_{SYMBOL}_M5.txt` exporters                              | **Never**   |

**The export directory is a shared bus.** Five independent lanes read from an MT5
terminal's `MQL5\Files` folder — price, fit statistics, the economic calendar, the broker's
symbol specs, and the currency & gold index engine. This promote moves the first four (they
are all read by `MT5Collector` from one `--export-dir`). It must **not** move the fifth.

`DavinTradeCurrencyIndexEngine` reads `CGI_EXPORT_DIR`, a separate variable on a separate
service. **It points at terminal S permanently and is never changed by a promote.** If
you ever find it pointing at A or B, that is a misconfiguration — fix it before promoting.

Unaffected and requiring no thought here: `MT5PushWorker` and `MT5Renderer`. Neither reads
the export directory (the renderer reads the database via `MTF_DB_PATH`).

---

## 1. Preconditions — all four, before touching anything

Do not skip 4. It is the one that matters when the promote goes wrong.

1. **The standby terminal is running**, charts attached, indicators drawing. Not merely
   installed — _running_. A shut-down standby is the principal failure mode of this design.
2. **Its exports are fresh.** Check the newest bar in any indicator `.txt` in its
   `MQL5\Files` — it should be within one bar period of now. The collector now enforces
   this itself (§3), but catching it here saves a failed cycle.
3. **The new configuration has been visually confirmed** on the standby's own charts in
   MetaTrader. This is where the judgement happens; the database is not involved.
4. **The currently active terminal is healthy.** After the promote it becomes your only
   rollback. If it is already broken, fix it first — otherwise you are promoting without
   a net.

Record which terminal is currently active before you change it:

```bash
nssm get MT5Collector AppParameters
```

---

## 2. The switch

Two commands. Substitute the standby's own `MQL5\Files` path.

```bash
nssm set MT5Collector AppParameters "C:\Scripts\collector\export_collector_validator_v2.py --export-dir C:\MT5-B\MQL5\Files --db C:\Scripts\database\xauusd.db --timeframes M5,M15"
```

```bash
nssm restart MT5Collector
```

`AppParameters` is replaced **wholesale** — every argument must be present in the new
string, not just the one you are changing. Copy the output of the `nssm get` from §1 and
edit only the `--export-dir` value.

Nothing else changes: same database, same push worker, same gateway, same schema. No
migration, no application deployment.

> **Do not run `install_services.bat` to apply this.** Batch files do not stop on error,
> so re-running it also re-executes the `nssm set ... AppEnvironmentExtra` lines and would
> overwrite the live services' real credentials with the file's placeholder values —
> breaking ingestion at the next restart. Set the individual property as above.

---

## 3. Verify

**First, that the collector is reading the terminal you intended.** Its startup line names
the directory:

```bash
Get-Content C:\Scripts\logs\collector.log -Tail 20
```

Look for `Export collector v2 (v6 pipeline) — db=... exports=<dir> tfs=M5,M15`. The
`exports=` value must be the standby's path.

**Then, that cycles are validating.** Within ~5 minutes you should see a `📥 Cycle`
line followed by a successful promotion, not a rejection.

**Then, with the Step 2 gateway deployed, that the gateway noticed.** The first manifest
from the new terminal produces a `PROMOTE` row in `cycle_events` (its `terminal_id` is the
folder name of the terminal you promoted to) and the cycle is RETUNING (§4 has the queries).
No `PROMOTE` row after two or three slots means either the Step 2 sender files are not
on the VPS or the manifest is not reaching the gateway: check `MT5PushWorker`'s log for
`manifest` lines.

**The failure you are watching for** is a standby that was not actually running. Since
2026-09-12 the collector rejects this rather than accepting it silently — the log shows:

```
newest bar <ts> is <n>s behind cycle slot <ts> (max 600s) — stale export directory
⛔ Cycle slot <ts> (M5) gave up after 3 attempts
```

If you see that, the standby's terminal is not exporting. **Roll back (§5), then fix the
terminal.** Do not wait for it to resolve itself; every cycle will keep failing.

Before this guard existed, that same situation validated clean and the newest bar silently
stopped advancing while alerts kept evaluating a frozen bar. If you are ever working on a
collector build older than 2026-09-12, check freshness by hand.

---

## 4. What users see

Not instantaneous. Set expectations accordingly.

On the next cycle, `promote_cycle`'s `INSERT OR REPLACE` resets `synced_at` on all ~6,000
in-window rows, so the entire window re-pushes at 500 rows per 30-second cycle —
**roughly 5–6 minutes**.

Row selection used to be **oldest-first**, so the chart repainted **left to right** with
**the newest bars at the right-hand edge changing last**. With the build step 2 push worker
deployed (part 3, `backfill_worker_api_gateway_v5.py`) each cycle sends its newest 288 M5
and 96 M15 closed bars, and each timeframe's newest row, **first**, then the cycle manifest,
and only then the rest of the window oldest-first. After a promote the bars the sensors
read therefore change first, and the older bars repaint behind them. No blank chart, no
error state, no interruption either way.

### What the gateway records (build step 2 parts 9 and 10; built, not deployed)

The first manifest after a promote names a different terminal or different `config_hash`es.
The gateway then:

- writes one `PROMOTE` row to `cycle_events`: the effective slot (the slot of that manifest),
  the terminal, the hashes and projection modes, and what they were before;
- marks the cycle **RETUNING** (`market_cycles.retuning`, and the same flag on the
  `cycle-ready` job), which Section 2 reads as CAUTIONARY;
- **ends it by counting the window itself** (ADR-015, Option A, chosen 2026-10-02): at every
  cycle while RETUNING, it counts the M5 rows of the 3,000-bar window whose `cycle_id` is
  older than the promote cycle's `m5_collection_cycle_id`. Every cycle rewrites its whole
  window under its own cycle id, so a row older than the promote cycle still holds a
  pre-promote value. When the count is 0 and that manifest passes the landed-row check
  (state READY), the cycle is not RETUNING and a `RETUNE_COMPLETE` event is written (it names
  the promote's slot and cycle id, the window it counted and the verified slot).

The window is `slot - 3000 × 300` seconds up to the slot (M5 only). That is a time window, one
bar wider than the collector's 3,000 bars when the newest row is the new-bar stub, and shorter
than them across a weekend: it never counts a row the collector has stopped re-pushing, at the
price of leaving the oldest bars of a window with a gap unchecked (the worker re-pushes those
first). A row that has just scrolled out of the window can hold RETUNING for one more cycle,
never longer. M15 rows are not counted.

`repush_rows_unsent`, which the sender still puts in every manifest, is **a diagnostic only**:
the collector re-queues the whole window every cycle, so it is thousands in every manifest and
never 0. Do not alarm on it, and do not use it to judge a promote.

**What the first minutes look like, in order (Step 2 pipeline):**

1. `nssm set` / `nssm restart MT5Collector` (§2). The collector reads terminal B.
2. The next cycle validates and `promote_cycle` rewrites every bar of the window under the new
   collector cycle id and re-queues all of them (`synced_at` cleared).
3. The push worker sends the **priority set** first (the newest 288 M5 bars, 96 M15 bars and
   each timeframe's newest row), then the manifest: it names terminal B and the new hashes.
4. The gateway sees the change: `PROMOTE` row, cycle RETUNING. The bars the sensors read
   (the newest 288 M5 and 96 M15 closed bars) and the statistics at the slot are already
   new-tuning at this point.
5. The worker drains the older part of the window, oldest first. Each cycle the gateway
   counts what is left; the cycle that finds none and verifies ends RETUNING.

**How long that takes is not known.** It depends on how many rows per slot the worker really
re-sends (`PUSH-WORKER-THROUGHPUT-OPEN-ISSUE.md`: demand about 800 rows/min against a capacity of
375 to 600, unmeasured). The worker re-sends the OLDEST rows first every slot; if its
capacity per slot is below the window, the middle of the window is re-sent only as it ages into
the oldest part, and RETUNING can last hours instead of minutes. That is the honest answer: the
window really is mixed in the meantime. The measurement kit (`docs/runbooks/deploy-stack-d-step2.md`,
section 6) reports how long each RETUNING episode lasted.

To see it, read-only:

```sql
-- the cycles, and the promote
SELECT slot, retuning, terminal_id, repush_rows_unsent FROM market_cycles ORDER BY slot DESC LIMIT 20;
SELECT event_type, effective_slot, terminal_id, detail FROM cycle_events ORDER BY effective_slot DESC;

-- the promote cycle's id, then how many window rows still hold pre-promote values
SELECT c.slot, c.m5_collection_cycle_id
FROM cycle_events e JOIN market_cycles c ON c.symbol = e.symbol AND c.slot = e.effective_slot
WHERE e.event_type = 'PROMOTE' ORDER BY e.effective_slot DESC LIMIT 1;

SELECT count(*) FROM market_data_v6
WHERE symbol = 'XAUUSD' AND timeframe = 'M5'
  AND "timestamp" BETWEEN <slot> - 900000 AND <slot>      -- <slot>: the newest READY cycle's slot
  AND cycle_id < <m5_collection_cycle_id of the promote>;
```

The gateway log says the same once per READY cycle while RETUNING: `Cycle XAUUSD <slot> READY
(..., RETUNING, N pre-promote M5 bars left in the window)`.

**If RETUNING does not end**, read the count over several cycles. Falling: the worker is
slower than the window (see above), nothing is broken. Constant above 0 for hours: rows the
collector no longer re-pushes sit inside the window. Look at those rows' `timestamp` and
`cycle_id` against `xauusd.db`. Two assumptions Option A makes: collector cycle ids only grow
(recreating `xauusd.db` restarts them at 1, which would misread every row as new), and the
gateway is reached by the worker (a quarantined row, a 400, keeps its old `cycle_id`).

**A promote and the deploy order.** The count needs nothing from the sender, so a promote
between the gateway deploy and the VPS file deploy is harmless (it was not with the sender's
count, which an old sender never sent). The `cycle_events` table must exist before the gateway
is deployed, or the first `PROMOTE` write fails and the cycle stays PENDING (apply the
`20261002000000_add_cycle_pipeline_tables` migration first; `deploy-stack-d-step2.md`).

**Not detected:** a reconfiguration of the M15 indicators alone, with the terminal and the M5
indicators untouched. M15 is collected only on :00 :15 :30 :45, so the cycle before a refresh
slot never carries it and the gateway has nothing to compare it with. Every promote switches
the terminal, so a real promote is never missed.

---

## 5. Rollback

Re-run §2 pointing back at the previous terminal, which is still running with its old
configuration and current exports, so it resumes immediately.

**Understand what this is: another forward switch, not a restore.** The history rows are
overwritten a second time with the old configuration's values. The effect is reversed; the
intermediate values are not retained anywhere. There is no way to recover what the chart
showed between the two switches.

---

## 6. After the promote — the standby discipline rule

**Do not begin tuning the newly demoted terminal until the newly promoted one is confirmed
good in production.** Between the promote and that confirmation, the demoted terminal is
the only rollback that exists. Touching it destroys your net.

Once the new active is confirmed, the demoted terminal is released and becomes the next
tuning target:

```
  A active, B standby
        |
        | admin tunes B, confirms visually in MetaTrader
        v
     PROMOTE  ->  B active, A standby   (A frozen as last-known-good)
        |
        | confirm B good in production
        v
   A released for tuning  ->  admin tunes A  ->  PROMOTE  ->  A active, B standby
        |
        v
      (repeat)
```

---

## Gotchas

- **`AppParameters` is replaced wholesale.** Omit `--db` or `--timeframes` and the
  collector silently falls back to its defaults (`C:/Scripts/database/xauusd.db`,
  `M5,M15`). Those defaults happen to be correct today, which is worse than if they were
  wrong — the mistake would not surface until someone changes the real paths.
- **"Standby" means hot, not installed.** A terminal that is closed exports nothing and
  its files freeze. This is the single most likely way to break a promote.
- **Each terminal needs its own installation / data folder.** If A and B share one, their
  `MQL5\Files` paths are the same directory and the entire design collapses into the
  current situation, silently.
- **The calendar exporter belongs on both A and B.** It is parameterless, so both produce
  identical output and it rides along harmlessly. Omit it from one terminal and promoting
  to that terminal stops economic-calendar capture with **no error** —
  `stage_economic_events()` returns `(0, 0)` when the file is absent, by design, so that a
  calendar failure can never reject a price row.
- **The symbol-specs exporter belongs on both A and B, on an XAUUSD chart** (build step 2
  part 8; `mq5/SymbolSpecsExport_v2_29.mq5`). Same silent failure: `stage_symbol_specs()`
  returns `'NO_FILE'` when `SymbolSpecs_XAUUSD.txt` is absent, by design, so promoting to a
  terminal without it just stops the broker figures refreshing, with no error, until the
  newest row is a week old and Report 2 is no longer offered. It also warms up for about 30
  minutes after being attached (it needs 30 spread samples taken while quotes are live), so
  attach it to the standby well before a promote, not at the moment of one. If A and B are
  on different broker accounts, their figures can differ: the collector records the
  terminal's folder name in `terminal_id`, and a changed contract figure after a promote is
  appended as news.
- **`CGI_EXPORT_DIR` is not part of the promote.** It points at terminal S. If the
  currency-index widget goes blank after a promote, someone pointed it at an alternating
  terminal.
- **Do not run two collectors against the same `xauusd.db`.** The single `--export-dir`
  makes it structurally impossible for one collector to read two terminals, which is the
  guarantee the whole design rests on. Two collectors would break it.
- **Retuning rewrites history, not just the future.** The centroid/SSA fitting window
  re-anchors to the live bar each pass, so a configuration change recomputes ~3,000 bars
  (~2.2 weeks of M5). That is why the promoted change is visible across the whole chart
  rather than only at the right edge.
