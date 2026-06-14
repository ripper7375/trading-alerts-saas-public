# Multi-Timeframe Visualisation (`mtf_render`)

Backend Python rendering for the DavinTrade three-canvas chart layout. It
**reads** the already-computed channel columns from `market_data` and plots
them — it does **not** recompute any indicators, and it builds **no UI**
(buttons / copy-paste / live canvases are a separate frontend stack).

See `VISUALISATION_TASK_HANDOFF.md` for the full task brief and
`multi-timeframe-visualisation.jpg` for the visual target.

## What it renders

A single combined PNG with three panels (matching the target image):

| Panel | Candles        | Channel drawn                     |
| ----- | -------------- | --------------------------------- |
| **A** | XAUUSD **M5**  | the **M5** equal-distance channel |
| **B** | XAUUSD **M15** | the **same M5** channel, overlaid |
| **C** | XAUUSD **M15** | the **same M5** channel, overlaid |

The equal-distance channel = three parallel blue lines per centroid variant:
`{variant}_uoedt` (upper), `{variant}_base_fl` (mid, dashed), `{variant}_loedt`
(lower). One of six variants is selectable: `best_fit` (default), `cherry_a`,
`cherry_b`, `most_recent`, `non_a`, `non_b`.

**The M5 channel is computed once and reused on the M15 panels** (never
recomputed on M15) — this mirrors the "Copy M5 EDT → Paste to Chart B/C"
workflow. Overlay alignment is by **price + time**: candles and channel are both
drawn on a real (unix-time) x-axis, so the M5 lines land at the correct
price/time over the M15 candles.

## Usage

```bash
pip install -r requirements.txt

# Demo against a synthetic golden fixture (no database needed):
python -m mtf_render --out chart.png

# Render from a real database:
python -m mtf_render --db /path/to/xauusd.db --variant cherry_a --limit 200 --out chart.png
```

CLI flags: `--db` (omit to auto-generate the fixture), `--variant`, `--limit`
(most-recent bars per timeframe), `--out`.

## Layout

```
mtf_render/
  data_source.py  # read market_data -> A/B/C panels (sqlite, variant-aware)
  fixture.py      # synthetic golden xauusd.db (M5+M15 + populated channel)
  renderer.py     # matplotlib candles + channel -> combined 3-panel PNG
  __main__.py     # CLI
test_mtf_render.py
```

## Why a synthetic fixture?

The shipped `market_data` sample has only 3 M5 bars, no M15 rows, and all
channel columns NULL (warm-up by design), so it cannot exercise the renderer.
`fixture.py` fabricates a self-consistent `xauusd.db` (realistic M5 + M15
candles over one window, with a populated straight equal-distance channel per
variant) purely for development/demo. The renderer reads a real DB identically
when given `--db`.

## Known limitation — MTF time alignment (carry-over)

Live M5→M15 overlay fidelity depends on M5↔M15 timestamp normalisation. In the
pipeline, `timestamp_adj` is currently a placeholder (per-source timestamp
phases not yet normalised — pipeline blueprint §7). For golden/sample data the
overlay is exact; for live data the timestamp-conversion stack must be completed
first. Noted, not blocking for a first render.
