# Handoff Brief — Multi-Timeframe Visualisation (Chart A/B/C)

**For:** a fresh Claude Code session building the multi-timeframe chart
visualisation. **Read THIS file first**, then only the files in §4. Do not read
the rest of the repo unless a step here points you to it — it wastes context.

**Target image:** `../multi-timeframe-visualisation.jpg` (one folder up). View it
once; it is the spec.

---

## 1. What to build (from the target image)

A DavinTrade UI with **three chart canvases**:

- **Chart A — always XAUUSD M5.** Renders candles + the **M5 centroid-regression
  "equal-distance channel"**: the three parallel blue lines = `*_uoedt` (upper),
  `*_base_fl` (mid), `*_loedt` (lower). Recomputed/refreshed **every 5 minutes**.
- **Chart B — always XAUUSD M15.** Renders M15 candles, AND overlays the **M5
  channel copied from Chart A** (same price-time relationship), refreshed every
  5 min.
- **Chart C — always XAUUSD M15.** Same as B (a second M15 canvas so users can
  compare different overlays/strategies).

**User workflow shown in the image (UI — OUT OF SCOPE, context only; see §3):**

1. User creates UOEDT/LOEDT on the M5 chart (Chart A).
2. "Copy M5 EDT" button.
3. "Paste M5 EDT to Chart B" and/or "Paste M5 EDT to Chart C".
4. The M5 channel is plotted on B and/or C per the clicks.

This task does NOT build that UI — only the backend rendering of the charts
(§3). The workflow above just explains which channel ends up on which chart.

**Key property:** the SAME equal-distance channel (blue lines) appears on all
three charts — the M5-computed channel is reused on the M15 panels (not
recomputed on M15). Alignment is by price+time, so the channel's bar
coordinates must map M5→M15 correctly (see §3 caveat).

---

## 2. The data you plot (already exists — do NOT recompute)

Source: `market_data` table in `xauusd.db` (schema: `sqlite_schema_v6_xauusd.sql`).
Every bar already has the computed channel per centroid variant — the renderer
just READS columns; it does not run the calc stack.

Columns to plot, per bar (`timestamp`, `timeframe`):

- Candles: `open`, `high`, `low`, `close`, `volume`
- Channel (pick the variant the user selects; 6 available — `best_fit`,
  `cherry_a`, `cherry_b`, `most_recent`, `non_a`, `non_b`):
  `{variant}_uoedt`, `{variant}_base_fl`, `{variant}_loedt`
- (optional later overlays: `best_resistance`, `best_support`,
  `fractal_best_fl/uoedt/loedt`, `body_classification`, `zigzag_*`)

A ready sample of real `market_data` rows is in
`sqlite_schema_v6_xauusd_preview.txt` (tab-separated, open as text) — use it to
develop the renderer without standing up the DB.

---

## 3. Scope — BACKEND ONLY (decided; do not build UI)

This task is a **backend Python rendering stack**: read `market_data` and
produce the multi-timeframe chart visualisation (e.g. matplotlib / mplfinance
PNGs), fitting the `render_alternatives` component in the decision-layer
blueprint.

**The UI is explicitly OUT OF SCOPE — it is a separate frontend stack built
later.** The "DavinTrade App UI", the buttons ("Copy M5 EDT", "Paste M5 EDT to
Chart B/C"), and the live interactive 3-canvas display in the target image are
**context only** — they tell you _what data to render and how the M5 channel
maps onto the M15 charts_. Do **not** build any UI, buttons, API endpoints, or
web frontend in this task.

So: produce the three rendered charts (A = M5 with its channel; B & C = M15 with
the M5 channel overlaid) as a backend module/output. How a future UI triggers
copy/paste is not your concern here.

**MTF alignment caveat (carry-over dependency):** overlaying the M5 channel on
M15 needs M5↔M15 time alignment. The pipeline's `timestamp_adj` is currently a
placeholder (per-source timestamp phases not yet normalised — see the pipeline
blueprint §7). For rendering golden/sample data this is fine; for live overlay
fidelity the timestamp-conversion stack must be done. Note it; don't block on it
for a first render.

---

## 4. Minimal file set to read (in this folder unless noted)

**Read these:**

1. `../multi-timeframe-visualisation.jpg` — the spec (view once).
2. `sqlite_schema_v6_xauusd.sql` — `market_data` columns = what's available to
   plot. You mainly need the `market_data` CREATE TABLE block.
3. `sqlite_schema_v6_xauusd_preview.txt` — real sample rows to render against.

**Skim only if needed (don't deep-read):** 4. `DAVINTRADE_DECISION_LAYER_BLUEPRINT.md` §4 (analysis methodology) and the
`render_alternatives` component — frames where this viz fits. 5. `methodology-of-providing-trading-recommendation.jpg` — the analysis the
charts support (context, not required to render).

**Do NOT read (irrelevant to rendering; large):** the 12 `mq5/` indicators, the
EA, relay, collector, push worker, the 4 calc `.py` modules, certification/test
files, gateway contract, install/replay scripts, and the full pipeline blueprint
(840 lines — its data-contract facts are summarised in §2 above).

---

## 5. Suggested opening prompt for the new session

> "Build the multi-timeframe visualisation (BACKEND Python rendering only — UI
> is out of scope, a separate stack) in
> `backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_data_pipeline_architecture/`.
> Read `VISUALISATION_TASK_HANDOFF.md` first, then only the files it lists.
> Propose a plan before writing code, and ask me anything ambiguous first."
