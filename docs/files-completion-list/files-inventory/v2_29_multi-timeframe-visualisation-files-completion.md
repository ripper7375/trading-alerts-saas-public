# Backend Stack C — v2.29 Multi-Timeframe Visualisation - List of files completion

**Location:** `backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_multi-timeframe-visualisation/`
**Status:** Backend rendering complete (`mtf_render` package + smoke tests + synthetic fixture).
**Scope:** Backend Python rendering only — this package **reads** already-computed channel
columns from `market_data` and plots them; it does **not** recompute any indicators and it
builds **no UI** (the DavinTrade "Copy M5 EDT" / "Paste to Chart B/C" buttons and live canvases
are a separate frontend stack, out of scope here).

This is a companion stack to `v2_29_data_pipeline_architecture-files-completion.md` — same
`backend-stack-c` VPS deployment, not part of the Part-numbered Next.js SaaS build.

## `mtf_render` Package (5 files)

**File 1/12:** ✅ `mtf_render/__init__.py` - Package init: exports `Channel`, `ChartData`, `VARIANTS`, `load_market_data`, `render_combined`
**File 2/12:** ✅ `mtf_render/data_source.py` - Data access layer: reads the wide `market_data` table into pandas DataFrames (sqlite, variant-aware); SELECT-only, never recomputes indicators
**File 3/12:** ✅ `mtf_render/fixture.py` - Synthetic golden fixture: fabricates a self-consistent `xauusd.db` (M5+M15 candles + populated equal-distance channel) for dev/demo when the shipped sample has no usable rows
**File 4/12:** ✅ `mtf_render/renderer.py` - Matplotlib renderer: hand-drawn candles on a real (unix-time) x-axis + channel overlay → combined 3-panel PNG
**File 5/12:** ✅ `mtf_render/__main__.py` - CLI entry point (`python -m mtf_render`): `--db`, `--variant`, `--limit`, `--out` flags

## Tests, Config & Docs (7 files)

**File 6/12:** ✅ `test_mtf_render.py` - Smoke tests: fixture build → `load_market_data` → `render_combined` round-trip
**File 7/12:** ✅ `requirements.txt` - `matplotlib>=3.7`, `pandas>=2.0`, `numpy>=1.24`
**File 8/12:** ✅ `Multi-Timeframe-Visualisation-Architecture-Design.md` - Architecture doc: what it renders, usage, layout, known MTF time-alignment limitation
**File 9/12:** ✅ `src/VISUALISATION_TASK_HANDOFF.md` - Original task brief for the build (three-canvas chart layout, in/out-of-scope boundaries)
**File 10/12:** ✅ `src/cover-prompt.md` - The original build-kickoff prompt (attached files, backend-only scope statement)
**File 11/12:** ✅ `src/multi-timeframe-visualisation.jpg` - Visual target image (the spec for Chart A/B/C layout)
**File 12/12:** ✅ `src/mtf_demo.png` - Rendered demo output from the synthetic fixture

## Status Summary

- **Completed:** 12/12 files (100%)
- **Missing:** None
- **What it renders:** one combined PNG, three panels —
  - **Panel A:** XAUUSD M5 candles + the M5 equal-distance channel
  - **Panel B:** XAUUSD M15 candles + the **same M5** channel overlaid
  - **Panel C:** XAUUSD M15 candles + the **same M5** channel overlaid (second comparison canvas)
- **Channel definition:** three parallel lines per centroid variant — `{variant}_uoedt` (upper),
  `{variant}_base_fl` (mid, dashed), `{variant}_loedt` (lower). Six selectable variants:
  `best_fit` (default), `cherry_a`, `cherry_b`, `most_recent`, `non_a`, `non_b`.
- **M5-computed, M15-reused:** the M5 channel is computed once and reused on both M15 panels
  (never recomputed on M15), mirroring the "Copy M5 EDT → Paste to Chart B/C" manual workflow.
  Overlay alignment is by price **and** time (real unix-time x-axis on both panels).
- **Known limitation (carry-over from the data pipeline):** live M5→M15 overlay fidelity depends
  on `timestamp_adj` normalization, which is currently a placeholder in the collector (see
  `v2_29_data_pipeline_architecture-files-completion.md`, open item #1). Golden/sample data
  overlays exactly; live data needs the timestamp-conversion stack completed first. Noted, not
  blocking for a first render.

## Directory Structure

```
v2_29_multi-timeframe-visualisation/
├── Multi-Timeframe-Visualisation-Architecture-Design.md
├── requirements.txt
├── test_mtf_render.py
├── mtf_render/
│   ├── __init__.py
│   ├── __main__.py       # CLI
│   ├── data_source.py    # market_data -> A/B/C panels
│   ├── fixture.py        # synthetic golden xauusd.db
│   └── renderer.py       # matplotlib candles + channel -> PNG
└── src/
    ├── VISUALISATION_TASK_HANDOFF.md
    ├── cover-prompt.md
    ├── mtf_demo.png
    └── multi-timeframe-visualisation.jpg
```

## Usage

```bash
pip install -r requirements.txt

# Demo against a synthetic golden fixture (no database needed):
python -m mtf_render --out chart.png

# Render from a real database:
python -m mtf_render --db /path/to/xauusd.db --variant cherry_a --limit 200 --out chart.png
```

## Testing Checklist

| Test                          | Command                              | Expected Result                         |
| ------------------------------ | ------------------------------------- | ---------------------------------------- |
| Smoke test suite               | `python -m pytest test_mtf_render.py` | Fixture build + render round-trip passes |
| Demo render (no DB)            | `python -m mtf_render --out chart.png` | Produces a 3-panel PNG from the fixture |
| Real-DB render                 | `python -m mtf_render --db xauusd.db --out chart.png` | Reads real `market_data`, same layout |

## Dependencies

### Upstream
- `market_data` table (`v2_29_data_pipeline_architecture/sqlite_schema_v6_xauusd.sql`) — the
  source of the OHLCV + per-variant channel columns this package reads
- `sqlite_schema_v6_xauusd_preview.txt` — sample rows used to develop against

### External (Python)
- matplotlib >= 3.7 (headless `Agg` backend)
- pandas >= 2.0
- numpy >= 1.24

## Notes

### Why a synthetic fixture

The shipped `market_data` sample has only 3 M5 bars, no M15 rows, and all channel columns `NULL`
(warm-up by design), so it cannot exercise the renderer. `fixture.py` fabricates a self-consistent
`xauusd.db` purely for development/demo; the renderer reads a real DB identically when given
`--db`.

### Out of scope (explicitly, per the task brief)

The DavinTrade three-canvas **UI** — "Copy M5 EDT" / "Paste to Chart B/C" buttons, live
interactive canvases — is a separate frontend stack to be built later. This package only produces
the backend PNG rendering from already-computed data.

---

## Update 2026-07-05

Initial inventory entry — this stack existed on disk prior to this date but had never been added
to the project's files-completion tracking system. All 12 files confirmed present and complete.
Companion stack: `v2_29_data_pipeline_architecture-files-completion.md`.

### Addendum — 2026-07-05 cross-stack system audit

No flaws found in this stack. `data_source.py`'s column contract (`{variant}_uoedt` /
`_base_fl` / `_loedt`, OHLCV spine, `symbol`/`timeframe`/`timestamp` filters) verified against
`sqlite_schema_v6_xauusd.sql`'s 79-column `market_data`. Smoke suite re-run in this audit:
`test_mtf_render.py` 3/3 passing (fixture build → load → render round-trip). The
`timestamp_adj` carry-over limitation (open item #1 in the companion stack) remains the only
known caveat for live-data overlays.
