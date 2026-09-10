# Multi-Timeframe Visualisation (`mtf_render`)

Backend Python rendering for the DavinTrade two-canvas chart layout. It **reads**
the already-computed indicator columns from `market_data` and plots them — it
does **not** recompute any indicators, and it builds **no UI** (buttons,
copy-paste, live canvases and R2 upload are separate stacks).

See `MTF-RENDER-MODIFICATION-PLAN.md` for the design decisions behind the current
shape, and `src/VISUALISATION_TASK_HANDOFF.md` for the original task brief.

## What it renders

**Two PNGs per cycle**, each with two panels stacked vertically on one shared
time axis. They differ by exactly one element: whether the M5 channel is drawn on
the lower panel.

| Panel         | Candles        | Overlays drawn                                        |
| ------------- | -------------- | ----------------------------------------------------- |
| **1** (upper) | XAUUSD **M5**  | the M5 overlay set                                    |
| **2** (lower) | XAUUSD **M15** | the M15 overlay set, **plus** the M5 set in `overlay` |

| Variant    | Lower panel                               | Served to                           |
| ---------- | ----------------------------------------- | ----------------------------------- |
| `overlay`  | M15 overlays + **M5 overlays layered on** | PRO user with `M5 on M15` toggle ON |
| `standard` | M15 overlays only                         | PRO user with the toggle OFF        |

The `M5 on M15` overlay is a **PRO entitlement** in the product, which is why two
variants exist rather than one. The renderer itself knows nothing about tiers —
it emits both files and the caller picks. FREE users receive no PNG at all: both
consumers of the image (the download button and the conversational AI) are
themselves PRO-gated.

**The M5 overlays are computed once and reused on the M15 panel** — never
recomputed on M15 — mirroring the "Copy M5 EDT → Paste to Chart B/C" workflow.
Alignment is by **price + time**: candles and overlays are both drawn on a real
(unix-time) x-axis, so the M5 lines land at the correct price/time over the M15
candles. A categorical bar index would misalign them, which is why candles are
drawn by hand rather than via mplfinance.

### Relationship to the on-screen terminal

As of 2026-09-10 the app's own terminal uses the same arrangement — two stacked
charts, M5 above M15, with the PRO overlay toggle on the lower one
(`components/charts/mtf-stacked-charts.tsx`, used by `/terminal` and `/free`).
So a trader comparing a downloaded PNG against their screen sees the same shape.

**One difference is deliberate and worth knowing.** This renderer puts both
panels on a **shared time axis** (see `--limit` below): the M15 panel is clipped
to exactly the M5 panel's clock window, which is what makes the two read as a
single comparison. The on-screen charts are two independent
`lightweight-charts` instances, each owning its own time scale, and they pan and
zoom independently. Syncing them is not trivial — M5 and M15 bars do not map
one-to-one — so it was excluded. Arrangement matches; axis behaviour does not.

### Why the lower panel keeps its own channel

Because the shipped UI does. `components/trading-chart.tsx` draws the M15 chart's
own SSA + EDT channel unconditionally and layers the M5 overlay on top only when
the toggle is on. If the lower panel carried only the M5 overlay, the `standard`
variant would be M15 candles with nothing plotted on them.

### Ambiguity rules (the image is read by a vision model, not only a human)

1. Every legend entry is prefixed with the timeframe its values were computed on
   (`M5 Best Fit A UOEDT` vs `M15 Best Fit A UOEDT`) — the lower panel can carry
   both at once.
2. The M5 overlay is drawn **cyan dashed** against the panel's own solid lines,
   matching the UI's own visual split.
3. The `standard` variant **states** that the overlay is off in the panel title.
   Conveying its absence by silently omitting the lines is what would let a model
   reason about a channel it was never shown.
4. Both panels share one x-axis range, so a vertical line at any x is the same
   instant on both.

## Available overlays

Ten drawable overlays, from the 11 indicators that produce price levels. OHLCV is
the candles themselves; ZigZag (sparse pivot events) and Z-Score (a body
classification) are not price-level lines and are not overlays.

| Key           | Kind    | Columns                                                        |
| ------------- | ------- | -------------------------------------------------------------- |
| `best_fit_a`  | channel | `best_fit_a_uoedt` / `best_fit_a_base_fl` / `best_fit_a_loedt` |
| `best_fit_b`  | channel | `best_fit_b_*`                                                 |
| `cherry_a`    | channel | `cherry_a_*`                                                   |
| `cherry_b`    | channel | `cherry_b_*`                                                   |
| `most_recent` | channel | `most_recent_*`                                                |
| `non_a`       | channel | `non_a_*`                                                      |
| `non_b`       | channel | `non_b_*`                                                      |
| `fractal_edt` | channel | `fractal_uoedt` / **`fractal_best_fl`** / `fractal_loedt`      |
| `resistance`  | line    | `best_resistance`                                              |
| `support`     | line    | `best_support`                                                 |

Default is `best_fit_a` alone — the cleanest image. All ten are selectable.

**The column names are written out explicitly in `overlays.py`, never
interpolated.** Two shapes defeat any convention: `fractal_edt`'s middle line is
`fractal_best_fl` (not `*_base_fl`), and resistance/support are single lines with
no bands. Blueprint §3.1 states the exported naming is not uniform and must not
be tidied; this registry absorbs that once.

## Usage

```bash
pip install -r requirements.txt

# Demo against a synthetic golden fixture (no database needed):
python -m mtf_render --out chart.png

# Both variants from one snapshot — what the VPS cron should call:
python -m mtf_render --db /path/to/xauusd.db --both-variants

# A different overlay set, standard variant:
python -m mtf_render --overlays cherry_a,resistance,support --no-m5-overlay
```

| Flag                               | Meaning                                                          |
| ---------------------------------- | ---------------------------------------------------------------- |
| `--db`                             | Path to `xauusd.db`; omit to auto-generate the fixture           |
| `--overlays`                       | Comma-separated overlay keys (default `best_fit_a`)              |
| `--limit`                          | Max **M5** bars, most recent (default 200)                       |
| `--m5-overlay` / `--no-m5-overlay` | Select the variant (default: overlay)                            |
| `--both-variants`                  | Write `<out>_overlay.png` and `<out>_standard.png` from one read |
| `--out`                            | Output path / stem                                               |

`--limit` bounds the **M5** panel only. The M15 panel is then clipped to the same
clock window, so it holds roughly a third as many bars. Equal bar counts would
make the lower panel span ~3× longer, leaving the M5 overlay covering only its
right-hand third.

## Layout

```
mtf_render/
  overlays.py     # registry: overlay key -> real market_data columns
  data_source.py  # read market_data -> M5/M15 panels (sqlite, D1 window, D2 variant)
  fixture.py      # synthetic golden xauusd.db, built FROM the registry
  renderer.py     # matplotlib candles + overlays -> stacked 2-panel PNG
  __main__.py     # CLI
test_mtf_render.py
```

## Why a synthetic fixture?

The shipped `market_data` sample has only 3 M5 bars, no M15 rows and all channel
columns NULL (warm-up by design), so it cannot exercise the renderer.
`fixture.py` fabricates a self-consistent `xauusd.db` for development/demo. The
renderer reads a real DB identically when given `--db`.

**The fixture is built from the overlay registry, not a hand-written column
list.** The previous fixture declared its own `best_fit_*` columns and therefore
kept passing for months after the real schema renamed them to
`best_fit_a`/`best_fit_b` — it was validating itself rather than the contract, so
the module was broken against every real database while its tests stayed green.
`test_registry_columns_exist_in_live_schema` closes that loop by checking the
registry against the real `sqlite_schema_v6_xauusd.sql`.

## MTF time alignment — fixed at source, gated on redeploy

Earlier versions of this document listed M5↔M15 timestamp normalisation as an
open dependency needing "a dedicated raw→adjusted timestamp-conversion stack."
**It needed no such thing.** Blueprint §7.1 traced it on 2026-09-09 to a one-line
bug present identically in all 13 indicators: `TimeCurrent()` returns the last
tick's time rather than the clock, so `TimeCurrent() - TimeGMT()` silently
absorbed "seconds since the last tick" and stamped it on every row as a constant
sub-bar phase. It is fixed at source (`TimeTradeServer()`, rounded to the hour).

> ⚠ **Still inert until the `.ex5` are recompiled and redeployed to the VPS.**
> Ten of the thirteen compiled binaries are a build behind (deck §11, action
> item 1). Overlay fidelity against golden/fixture data is exact today; against
> **live** data it cannot be validated until that redeploy lands.
