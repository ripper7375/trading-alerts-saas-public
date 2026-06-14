I'm building the **multi-timeframe visualisation** task for the DavinTrade trading pipeline. I'm attaching 4 files:

1. `VISUALISATION_TASK_HANDOFF.md` — the task brief; **read this first**, then follow its instructions.
2. `sqlite_schema_v6_xauusd.sql` — the `market_data` schema (the columns you'll plot).
3. `sqlite_schema_v6_xauusd_preview.txt` — real sample rows to develop against.
4. `multi-timeframe-visualisation.jpg` — the visual target.

**Scope — backend only.** This task is a **backend stack** that produces the chart visualisation from `market_data` (e.g. a Python rendering module). The **UI is explicitly out of scope** — the DavinTrade app UI (the buttons like "Copy M5 EDT" / "Paste to Chart B/C", the live 3-canvas display) is a **separate frontend stack built later**. Treat the buttons/UI in the image only as context for _what data must be rendered and how the M5 channel maps onto the M15 charts_ — do not build any UI.

The data and computed channel already exist in `market_data` (per-bar `*_uoedt / *_base_fl / *_loedt` + OHLCV) — your job is to read and render them, **not** to recompute indicators.

Please read `VISUALISATION_TASK_HANDOFF.md`, then **propose a plan before writing any code**, and ask me anything ambiguous first.
