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

| Terminal       | Carries                                          | Alternates? |
| -------------- | ------------------------------------------------ | ----------- |
| **A** (EDT)    | 26 EDT indicator attachments + calendar exporter | Yes         |
| **B** (EDT)    | 26 EDT indicator attachments + calendar exporter | Yes         |
| **S** (static) | 8 × `OHLCV_{SYMBOL}_M5.txt` exporters            | **Never**   |

**The export directory is a shared bus.** Four independent lanes read from an MT5
terminal's `MQL5\Files` folder — price, fit statistics, the economic calendar, and the
currency & gold index engine. This promote moves the first three (they are all read by
`MT5Collector` from one `--export-dir`). It must **not** move the fourth.

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

Row selection is **oldest-first**, so the chart repaints **left to right**: the oldest bars
update first and **the newest bars at the right-hand edge change last**. No blank chart, no
error state, no interruption — a progressive repaint that completes from the far edge
inward.

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
