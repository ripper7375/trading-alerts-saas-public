# `mtf_render` — Modification Plan (v2.29 alignment + 3-panel → 2-panel)

**Status:** DRAFT rev. 3 — awaiting Davin's approval before any code is written.
**All decisions are now resolved (D1–D5). No blockers remain; W1 can start on approval.**
**Date:** 2026-09-10.

**Rev. 2 (same day):** D2 changed from "always overlay" to "follow the UI's PRO-gated
`M5 on M15` toggle" at Davin's direction — a change that reached §2, W1, W2, W3, W5, W6, W7 and
the Stack D fetch signature. Consequences collected in §1.1.

**Rev. 3 (same day):** Davin supplied the deployed FREE-tier workbench screenshot, which
**resolved D4** (lower panel keeps its own M15 channel — the FREE chart visibly has one) and
**resolved D5**, correcting a wrong assumption in rev. 2: `standard` is _not_ the FREE-tier image,
because FREE users receive no PNG at all. Also added **W8** (3-Panel → 2-Panel, ~30 sites already
live in the monolith) and **§0.7** (the download path is neither tier-gated nor wired to a real
file today).
**Scope:** `backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_multi-timeframe-visualisation/`
**Driver:** four upstream changes landed since this module was written (2026-06-14), plus a
requested layout change from three side-by-side panels to two stacked panels.

---

## 0. Findings — verified against live code before planning

These were checked directly, not taken from the change list. Two of them change the shape of
the work.

### 0.1 ⚠ The module is currently BROKEN against the live schema, not merely outdated

`data_source.py:21-28` declares `VARIANTS` containing **`best_fit`**. The 2026-09-03 split
renamed that column to `best_fit_a` / `best_fit_b` (blueprint §0.4). `_read_timeframe()` builds
its SQL by f-string interpolation:

```python
chan_cols = f"{variant}_uoedt, {variant}_base_fl, {variant}_loedt"
```

so against any real `xauusd.db` the default path now raises
`sqlite3.OperationalError: no such column: best_fit_uoedt`.

**Why this went unnoticed:** `fixture.py` fabricates its own table using the _old_ names, so the
test suite passes against a schema that no longer exists anywhere. The tests are green and the
module is broken — the fixture is validating itself, not the contract.

**Consequence for this plan:** W6 gains a regression test asserting the fixture's column names
match the live `sqlite_schema_v6_xauusd.sql`. That is the check that would have caught this.

### 0.2 ⚠ Stack D V2 hard-codes the 3-panel contract in three places

`davintrade-stack-d-and-e/STACK-D-CONVERSATIONAL-AI-CHART-ANALYSIS-ARCHITECTURE-V2.md`:

| Line           | Text                                                                                  | Breaks how                                              |
| -------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| 479 (§9)       | "`mtf_render/renderer.py` generates a **3-panel** comparison chart image"             | Names this exact file. Silently wrong after the change. |
| 113 (Pillar 6) | "the latest **3-panel** comparison chart image (`mtf_render_xauusd_{timeframe}.png`)" | Both the panel count **and** the filename pattern.      |
| 516 (§10)      | `chartPngBuffer, // Pillar 6: Cloudflare R2 3-Panel Vision PNG`                       | Code comment in the orchestrator.                       |

**The filename is the substantive problem, not the "3-panel" wording.**
`mtf_render_xauusd_{timeframe}.png` assumes _one file per timeframe_. The new design puts M5 and
M15 into a **single** image, so `{timeframe}` has no meaning and
`r2Storage.getLatestChartPng(symbol, timeframe)` (§10 line 524) would resolve to a file that
either does not exist or is not the one intended.

**Knock-on: render cadence collapses to one.** §9 line 479 currently says the render runs "on
every candle close (M5 every 5m, M15 every 15m)" — coherent only while the files are separate.
One combined image can only have one cadence. It must be **every 5 minutes**, driven by the
faster panel; the M15 panel simply shows its latest (possibly still-forming) bar.

W7 must update all three sites in lockstep with the code, or Stack D Session 12-2 builds against
a spec that no longer describes reality.

### 0.3 The Prisma change is **not** a dependency of this module

`ARCHITECTURE-SUMMARY-FOR-DECK.md` §8 records the Prisma work (87 columns, plus the new
`indicator_statistics` / `indicator_configs` models). None of it reaches this module: `mtf_render`
reads the **SQLite** `xauusd.db` on the Contabo VPS (`data_source.py:123`), never Postgres or
Prisma. Stack D §9 confirms generation is a VPS-side worker.

The only overlap is name-parity on `best_fit_a`/`best_fit_b` — which is the same rename as §0.1,
not separate work. **No Prisma-driven work items.** Recorded explicitly so a future reader does
not go looking for work that isn't there.

### 0.4 The timestamp fix _removes_ work — but only half of it

The module README's closing section, "Known limitation — MTF time alignment (carry-over)", says
`timestamp_adj` is a placeholder and that "the timestamp-conversion stack must be completed
first". Blueprint §7.1 resolved this at source on 2026-09-09: it was never a missing stack, it was
a one-line `TimeCurrent()` → `TimeTradeServer()` bug in all 13 indicators.

**But it is not fully closed, and the README must not claim it is.** Both the blueprint (§7.1) and
the deck (§11, action item 1) carry the same warning: the fixes are **inert until the `.ex5` are
recompiled and redeployed**, and 10 of the 13 binaries on disk are currently a build behind.

So W7 rewrites this caveat rather than deleting it: _the mechanism is fixed at source; live
overlay fidelity is gated on the VPS redeploy._

### 0.5 The requested layout already matches the shipped UI

This is the strongest argument for the change, and it is verifiable rather than aesthetic —
`seed-code/trading-conversational-ai-ui-pages-increment/`:

| Element                    | Location                               | Behaviour                                                                      |
| -------------------------- | -------------------------------------- | ------------------------------------------------------------------------------ |
| Stacked M5-over-M15 layout | `app/terminal/page.tsx:177`            | "Part-C: Dual Stacked MTF Lightweight Charts"                                  |
| `M5 on M15` toggle         | `components/trading-chart.tsx:84-85`   | "Part 24 Engine 2 MTF Overlay Toggle"                                          |
| PRO gating                 | `components/trading-chart.tsx:173-181` | FREE tier → upgrade modal, no toggle. **This is what D2 now mirrors.**         |
| M15's **own** channel      | `components/trading-chart.tsx:326-343` | Indigo SSA + two amber EDT lines, drawn **unconditionally**                    |
| M5 overlay drawing         | `components/trading-chart.tsx:352-367` | Cyan **dashed** lines, layered on top, only when `isM5OnM15 && tier === 'PRO'` |

The last two rows are the evidence behind D4 (§1.1d): on screen the M15 panel is **never** empty —
it always carries its own channel, and the M5 overlay is an additional layer, not a replacement.

The 2-panel PNG therefore reproduces what the user already sees on screen. The current 3-panel
A/B/C output (with two _identical_ M15 panels) corresponds to nothing in the shipped product.

### 0.6 ⚠ Column naming is irregular and must not be normalised

Blueprint §3.1 states the header naming "is **not** uniform and must not be 'tidied'". Two traps
for the 11-indicator work:

1. **Fractal's mid line is `fractal_best_fl`, not `fractal_base_fl`** — it does not follow the
   centroids' `{variant}_base_fl` pattern (`sqlite_schema_v6_xauusd.sql:523-525`).
2. **Resistance and support are single lines** (`best_resistance`, `best_support`), not 3-line
   channels — no upper/lower to draw.

Therefore the overlay registry (W1) must be an **explicit column map**, never f-string
interpolation. The current f-string approach is precisely what produced §0.1.

### 0.7 ⚠ The PNG download path is NOT tier-gated in code, and points at a file that does not exist

Found while confirming D5. The screenshot annotates "Image Download is for PRO User" as though it
were enforced. In the **main repo** it is not:

```typescript
// components/chat-sidebar.tsx:108-115  — no tier check anywhere
const handleDownloadPng = () => {
  const link = document.createElement('a');
  link.href = '/mtf_render_xauusd_sample.png';
  link.download = 'XAUUSD_Matplotlib_3Panel_Vision_Render.png';
  ...
};
```

Three separate problems, all pre-existing and none caused by this plan:

1. **No entitlement check.** `currentTier` is in scope and used for other gates in the very same
   file (lines 132, 133, 140, 386) — the download button simply does not consult it. **This
   undermines D2's entire rationale:** gating the overlay inside the _image_ accomplishes nothing
   if a FREE user can click Download and receive whichever image the app hands them.
2. **The target file does not exist.** `public/mtf_render_xauusd_sample.png` is absent from the
   repo — verified. The button currently downloads a 404.
3. **It is a static placeholder, not wired to this pipeline at all.** A hardcoded `public/` path,
   not an R2 URL and not a per-user fetch — so nothing in the current UI consumes the real render.

**Not fixed by this plan — out of scope (a monolith UI/entitlement change, not a renderer
change), but flagged rather than left silent**, because items 1 and 3 are what will actually
deliver D2 in production. The renderer can emit two correctly-gated variants and it will change
nothing user-visible until the download path is wired to R2 _and_ gated on tier. Recommend a
separate session; noted in §6 and §7.4.

---

## 1. Decisions taken

Confirmed by Davin in chat, 2026-09-10, before drafting.

| #   | Decision                             | Chosen                                                                  | Rationale                                                                                                                                                                                                                                                                                                                                   |
| --- | ------------------------------------ | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Time windowing across the two panels | **Match time span**                                                     | The lower M15 panel covers the _same clock window_ as the upper M5 panel (≈⅓ the bar count). The M5 overlay then spans the full width of both panels and the two panels align vertically — the least ambiguous arrangement for a vision model comparing them.                                                                               |
| D2  | Overlay behaviour of the lower panel | **Follow the UI's PRO-gated `M5 on M15` toggle** _(revised 2026-09-10)_ | M5-on-M15 is a PRO entitlement (`trading-chart.tsx:173-181` — FREE tier gets the upgrade modal, not the overlay). A render that always overlays would hand a FREE user, and the LLM answering that user, a capability they have not paid for. The render therefore produces **two variants** and the caller selects by tier + toggle state. |
| D3  | Default overlay set                  | **One centroid variant only** (3 lines)                                 | Cleanest image; unchanged from today's default density. All 10 overlays remain _selectable_ via `--overlays`, so the 11-indicator support is built but not switched on by default.                                                                                                                                                          |

### 1.1 Consequences of the D2 revision — read before approving

D2 was originally "always overlay", and three parts of this plan were written on that assumption.
Changing it has knock-ons that are **not** confined to the renderer.

**a. The render must stay cron-driven — do NOT make it per-request.**
The tempting reading of "follow the toggle" is _render on demand with the user's flag_. That would
be an architectural regression: Stack D §2 budgets the whole 7-pillar retrieval at **< 120 ms**,
and a matplotlib render is orders of magnitude slower than that. It would also defeat R2 caching
and the 48-hour retention window in §9.

**The design that satisfies D2 without breaking any of that:** the VPS cron renders **both
variants every cycle** and uploads both. The app then _selects_ the already-rendered file by
tier + toggle. Still a simple fetch, still cached, still no user state inside the renderer — the
per-user decision moves to the fetch, where it is free.

Cost of the second variant: one extra matplotlib render per 5 minutes and ~300–500 KB more R2
storage per cycle, pruned at 48 h. Negligible against the alternative.

**b. Stack D's fetch signature changes — in the opposite direction from §0.2's recommendation.**
§0.2 recommended _dropping_ the `timeframe` argument from
`r2Storage.getLatestChartPng(symbol, timeframe)`. That still holds, but D2 now requires a
_different_ argument in its place: which variant to fetch. See W7.

**c. The LLM can now receive two structurally different images.** This is in direct tension with
the stated goal of the whole change ("less ambiguity for AI"). It is manageable, but only if the
image is self-describing: the lower panel's title must state the overlay's presence **or absence**
explicitly, so a vision model never reasons about an M5 channel that was never drawn. Encoded in
§2 and W3.

**d. ⚠ It forces a companion decision that did not exist under "always overlay" — see D4.**

| #   | Decision                                                                                 | Status                        | Detail                                                                                          |
| --- | ---------------------------------------------------------------------------------------- | ----------------------------- | ----------------------------------------------------------------------------------------------- |
| D4  | Does the lower panel draw the **M15's own** channel, in addition to the overlaid M5 one? | **RESOLVED 2026-09-10 — YES** | Davin supplied the FREE-tier workbench screenshot (`/free`, deployed). See D4 resolution below. |
| D5  | Which tier/toggle states map to which rendered variant?                                  | **RESOLVED 2026-09-10**       | Same evidence. Corrects a wrong assumption in the D2 revision — see below.                      |

**Why D4 only appears now.** Under "always overlay", the lower panel always had the M5 channel on
it, so whether it _also_ drew M15's own channel was a density preference. Under D2-revised, the
toggle-off variant has **no M5 channel at all** — and since the current module draws _only_ the M5
channel on that panel (`data_source.py:153-158`), the FREE/toggle-off image would be **M15 candles
with nothing plotted on them**. That is not a defensible artifact to hand either a paying-tier
boundary or a vision model.

**The live UI has already answered this**, which is the strongest evidence available:
`trading-chart.tsx:326-343` draws the M15 chart's own SSA line plus its own upper/lower EDT
channel **unconditionally**, and the M5 overlay at lines 352-367 is layered _on top_ only when
`isM5OnM15 && tier === 'PRO'`. So on screen the M15 panel is never empty.

**D4 RESOLVED — YES, the lower panel always draws the M15's own channel.** Davin supplied the
deployed FREE-tier workbench (`trading-conversational-ai-ui-pages.vercel.app/free`). In it the
lower M15 chart plainly carries its own amber EDT channel and indigo SSA line while the
`M5 on M15` toggle sits **locked and off** — so the M15 panel is populated even with no M5
overlay present. The concern behind D4 (an empty lower panel) cannot arise. This confirms what
`trading-chart.tsx:326-343` already implied and makes §2 and W1–W3 correct as written.

**D5 RESOLVED — and it corrects a wrong assumption I carried into the D2 revision.**
§1.1 was written as though `standard` were "the FREE-tier image". The screenshot shows that is
wrong, because **both consumers of the rendered PNG are themselves PRO-gated**:

| Consumer                                         | Gate (per the screenshot)                                              |
| ------------------------------------------------ | ---------------------------------------------------------------------- |
| `PNG Download` button                            | "Image Download is for PRO User"                                       |
| Conversational AI (the LLM that ingests the PNG) | "Conversational AI is for PRO user Only" — FREE gets read-only history |
| `M5 on M15` toggle                               | "M5 on M15 is for PRO User Only" — padlocked                           |

A FREE user therefore **never receives a rendered PNG at all** — not through download, and not
through the chat. So the correct mapping is:

| Tier | `M5 on M15`  | Variant served              |
| ---- | ------------ | --------------------------- |
| PRO  | ON           | `overlay`                   |
| PRO  | OFF          | `standard`                  |
| FREE | (locked off) | **none — no PNG is served** |

**`standard` is a PRO-user-with-the-toggle-off artifact, not a FREE-tier artifact.** Both variants
exist solely to serve PRO users, which is a materially different thing from what §1.1 first said.

Two consequences worth stating, since they cut in opposite directions:

- **Simpler than feared.** The renderer never has to consider a FREE audience, and the "what does
  a FREE user see?" question dissolves.
- **But the entitlement gate is not actually closed today — see §0.7.** The screenshot documents
  the _intended_ gating; the code does not yet implement it on the download path.

---

## 2. Target output specification

**Two PNGs per render cycle** (D2), each two panels stacked vertically sharing one x-axis. They
differ by exactly one element: the presence of the M5 channel on the lower panel.

### 2.1 Variant `overlay` — PRO tier, toggle ON

```
┌──────────────────────────────────────────────────────────┐
│ DavinTrade — XAUUSD  ·  overlay: best_fit_a  ·  <UTC ts> │
├──────────────────────────────────────────────────────────┤
│ Panel 1 (upper) — XAUUSD M5                              │
│   M5 candles                                             │
│   + M5 equal-distance channel (uoedt / base_fl / loedt)  │
├──────────────────────────────────────────────────────────┤
│ Panel 2 (lower) — XAUUSD M15 · M5 channel OVERLAID       │
│   M15 candles                                            │
│   + M15's own equal-distance channel          (per D4)   │
│   + the SAME M5 channel, layered on top                  │
│     (never recomputed on M15)                            │
└──────────────────────────────────────────────────────────┘
        shared time axis — identical range on both panels (D1)
```

### 2.2 Variant `standard` — FREE tier, or toggle OFF

```
┌──────────────────────────────────────────────────────────┐
│ DavinTrade — XAUUSD  ·  overlay: best_fit_a  ·  <UTC ts> │
├──────────────────────────────────────────────────────────┤
│ Panel 1 (upper) — XAUUSD M5                              │
│   M5 candles                                             │
│   + M5 equal-distance channel (uoedt / base_fl / loedt)  │
├──────────────────────────────────────────────────────────┤
│ Panel 2 (lower) — XAUUSD M15 · M5 overlay OFF            │
│   M15 candles                                            │
│   + M15's own equal-distance channel ONLY     (per D4)   │
└──────────────────────────────────────────────────────────┘
```

The upper panel is **byte-identical in intent** across both variants — M5-on-M5 is not a PRO
feature. Only the lower panel differs.

**Ambiguity-reduction rules** (the stated purpose of the change — these are the parts that
actually deliver it, not the panel count on its own):

1. Panel titles state the channel's **source timeframe explicitly** — the lower panel reads
   "M15 candles · **M5** channel overlaid", so a vision model cannot mistake the overlay for an
   M15-derived channel.
2. **The `standard` variant states the absence explicitly** ("M5 overlay OFF"), rather than simply
   omitting the lines. Silence is what lets a model hallucinate a channel it was not shown; this
   is the single most important consequence of the D2 revision (§1.1c).
3. Legend entries are prefixed with their origin timeframe (`M5 UOEDT (best_fit_a)` vs
   `M15 UOEDT (best_fit_a)`), carrying forward the existing `renderer.py:68-74` behaviour. With
   both channels on one panel (D4), this prefix is what distinguishes them.
4. The M5 overlay is drawn in a visually distinct style from the M15 channel — mirroring the UI,
   where the M5 overlay is cyan dashed (`trading-chart.tsx:354-366`) against the M15 channel's
   amber (lines 333-343).
5. Both panels share one x-axis range (D1), so a vertical line at any x is the same instant on
   both.
6. The still-forming newest bar is handled explicitly — see §7.1.

---

## 3. Work items

### W1 — `overlays.py` _(new)_

An explicit registry, per §0.6. Shape:

```python
@dataclass(frozen=True)
class OverlaySpec:
    key: str                  # CLI name
    label: str                # legend/title text
    columns: tuple[str, ...]  # REAL column names, explicit — never interpolated
    kind: Literal["channel", "line"]
```

Registry contents — all 10 drawable overlays (the 11th "indicator", OHLCV, is the candles
themselves, not an overlay):

| Key           | Kind    | Upper column        | Mid column               | Lower column        |
| ------------- | ------- | ------------------- | ------------------------ | ------------------- |
| `best_fit_a`  | channel | `best_fit_a_uoedt`  | `best_fit_a_base_fl`     | `best_fit_a_loedt`  |
| `best_fit_b`  | channel | `best_fit_b_uoedt`  | `best_fit_b_base_fl`     | `best_fit_b_loedt`  |
| `cherry_a`    | channel | `cherry_a_uoedt`    | `cherry_a_base_fl`       | `cherry_a_loedt`    |
| `cherry_b`    | channel | `cherry_b_uoedt`    | `cherry_b_base_fl`       | `cherry_b_loedt`    |
| `most_recent` | channel | `most_recent_uoedt` | `most_recent_base_fl`    | `most_recent_loedt` |
| `non_a`       | channel | `non_a_uoedt`       | `non_a_base_fl`          | `non_a_loedt`       |
| `non_b`       | channel | `non_b_uoedt`       | `non_b_base_fl`          | `non_b_loedt`       |
| `fractal_edt` | channel | `fractal_uoedt`     | **`fractal_best_fl`** ⚠ | `fractal_loedt`     |
| `resistance`  | line    | —                   | `best_resistance`        | —                   |
| `support`     | line    | —                   | `best_support`           | —                   |

Maps 1:1 onto the 11 indicators named in blueprint §0.4 that produce drawable price levels
(ZigZag and Z-Score are excluded: ZigZag is sparse pivot events, Z-Score is a body classification
— neither is a price-level line. Adding them is a separate, later task; see §6).

**D2/D4 addition — the registry is timeframe-agnostic, and that is the point.** The same
`OverlaySpec` resolves against M5 rows or M15 rows; only the row set differs. That is what lets
the lower panel carry _both_ its own M15 channel and the layered M5 one (D4) from a single
registry entry, with no duplicated column definitions — and therefore no second place for the
§0.1 drift to recur.

### W2 — `data_source.py`

1. Delete `VARIANTS`; import from `overlays.py`.
2. `Channel` → `Overlay`, supporting both 1-line and 3-line forms (`kind` from the spec). The
   `has_data` property generalises to "any selected column has a non-NULL value".
3. `ChartData.channel: Channel` → **two** fields, required by D4:
   - `own_overlays: list[Overlay]` — computed on this panel's own timeframe
   - `m5_overlays: list[Overlay]` — the M5 channel layered on top; **empty for the `standard`
     variant**, and always empty on the upper panel (where "own" already means M5)
4. `_read_timeframe()` selects the union of the requested specs' real columns — no interpolation.
5. **`build_panels()` returns 2 panels, not 3.** Keys `"M5"` and `"M15"`, replacing `"A"/"B"/"C"`.
   The M5 overlay objects are passed by reference into the M15 panel's `m5_overlays`, preserving
   the existing "computed once, reused" guarantee (and the identity assertion in W6).
6. **New — D1 windowing.** `--limit` continues to select the N most recent **M5** bars; the M15
   rows are then filtered to `[min(m5.timestamp), max(m5.timestamp)]` rather than taking N M15
   bars. M15 bar count becomes ≈ N/3, by design.
7. **New — D2 variant.** `build_panels(..., m5_overlay: bool)`. When `False`, `m5_overlays` is left
   empty and the M15 panel carries only its own channel. This is the _only_ structural difference
   between the two variants — deliberately, so the diff a vision model must describe is minimal.

### W3 — `renderer.py`

1. `plt.subplots(1, 3, figsize=(21, 7))` → `plt.subplots(2, 1, figsize=(14, 10), sharex=True)`.
   `sharex=True` is now genuinely correct rather than cosmetic, because D1 makes the ranges equal.
2. `_draw_channel()` → `_draw_overlays()`, handling `kind="line"` (draw one solid line) and
   `kind="channel"` (upper/lower solid, mid dashed — current behaviour at `renderer.py:69-74`).
3. Distinct colours per overlay so multiple selections stay legible; the single-overlay default
   (D3) keeps today's channel blue `#1f6fe0` for the panel's **own** channel.
4. **New — the M5 overlay gets its own style** (§2 rule 4), so the two channels on the lower panel
   are visually separable: solid for own, dashed + distinct hue for the layered M5 set, mirroring
   the UI's amber-vs-cyan-dashed split.
5. **New — variant-aware titles.** The lower panel's title is driven by whether `m5_overlays` is
   populated, and states the absence explicitly when it is not (§2 rule 2). A missing overlay must
   never be conveyed by omission alone.
6. Panel titles per §2. Suptitle carries symbol, overlay set, and the render's UTC timestamp — the
   timestamp matters because the artifact is consumed asynchronously by an LLM.
7. `_draw_candles()` is unchanged apart from receiving the shared axis. The hand-rolled real-time
   x-axis (`renderer.py:1-7`) stays — it is precisely what makes the M5-on-M15 overlay correct.

### W4 — `fixture.py`

Regenerate against the live schema shape: 7 real variant names, plus `fractal_*`,
`best_resistance`, `best_support`. Two properties the current fixture must keep:

- M5 and M15 share one price/time frame, so the overlay is exact in golden data.
- The M15 series is aggregated from the M5 walk, so the panels look like the same market.

Add: M15 must span the **same window** as M5 (already true) so D1 windowing is exercised.

### W5 — `__main__.py`

| Flag                               | Change                                                                                                                                                                                                                                              |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--variant`                        | **Replaced** by `--overlays` (comma-separated keys, default `best_fit_a`)                                                                                                                                                                           |
| `--m5-overlay` / `--no-m5-overlay` | **New (D2)** — selects the variant. Default `--m5-overlay`.                                                                                                                                                                                         |
| `--both-variants`                  | **New (D2)** — renders both in one invocation, deriving the two output paths from `--out`. This is what the VPS cron calls (§1.1a), so the two files are guaranteed to come from the _same_ data snapshot rather than two reads five minutes apart. |
| `--db`                             | Unchanged                                                                                                                                                                                                                                           |
| `--limit`                          | Unchanged flag, redefined semantics (M5 bars drive the window — W2.6)                                                                                                                                                                               |
| `--out`                            | Unchanged for a single variant; used as the stem under `--both-variants`                                                                                                                                                                            |

`--variant` is removed rather than aliased: its only valid old default (`best_fit`) no longer
exists, so silently accepting it would reintroduce §0.1. Note the name is also now actively
misleading — under D2, "variant" refers to the overlay/standard pair, not the centroid choice.

### W6 — `test_mtf_render.py`

| Test                                                                   | Purpose                                                                                                                                                                          |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| _(updated)_ `test_panels_have_expected_timeframes_and_shared_overlays` | 2 panels; the M15 panel's `m5_overlays` are the **same objects** as the M5 panel's own (`is` identity), preserving today's assertion                                             |
| _(updated)_ `test_all_overlays_load`                                   | Loops all 10 registry keys, not 6 variants                                                                                                                                       |
| _(updated)_ `test_render_writes_png`                                   | Renders **both** D2 variants                                                                                                                                                     |
| **(new)** `test_fixture_columns_match_live_schema`                     | Parses `sqlite_schema_v6_xauusd.sql`, asserts every registry column exists in the real `market_data` DDL. **The test that would have caught §0.1.**                              |
| **(new)** `test_m15_window_matches_m5_window`                          | Asserts D1: the M15 panel's time range sits within the M5 panel's                                                                                                                |
| **(new, D2)** `test_standard_variant_has_no_m5_overlay`                | `m5_overlays` is empty when `m5_overlay=False`, and the M15 panel still has a **non-empty** `own_overlays` — the assertion that prevents the empty-lower-panel failure in §1.1d  |
| **(new, D2)** `test_variants_differ_only_in_m5_overlay`                | The two variants' upper panels and the M15 panel's `own_overlays` are identical; only `m5_overlays` differs. Guards the §2 promise that the images differ by exactly one element |

### W7 — Documentation

| File                                                   | Change                                                                                                                                  |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| `Multi-Timeframe-Visualisation-Architecture-Design.md` | 3-panel table → 2-panel; variant list → 10 overlays; usage/CLI; **rewrite** the timestamp caveat per §0.4; document the two D2 variants |
| `STACK-D-...-V2.md` §9 line 479                        | "3-panel" → "2-panel stacked"; cadence → every 5 min (§0.2); **renders two variants per cycle** (§1.1a)                                 |
| `STACK-D-...-V2.md` §9 lines 480, 483                  | VPS path + CDN URL — both encode the old single-file naming                                                                             |
| `STACK-D-...-V2.md` Pillar 6 line 113                  | Panel count **and** filename pattern (§0.2)                                                                                             |
| `STACK-D-...-V2.md` §10 lines 516, 524                 | Comment text **and** the `getLatestChartPng` call — see below                                                                           |
| `DATA_COLLECTION_PIPELINE_BLUEPRINT_v2_29.md`          | Only if it references the renderer — to confirm during execution, not assumed                                                           |

**Recommended filenames**, replacing `mtf_render_xauusd_{timeframe}.png`:

```
mtf_render_xauusd_m5_m15_overlay.png     # PRO  + toggle ON
mtf_render_xauusd_m5_m15_standard.png    # FREE or toggle OFF
```

The `{timeframe}` parameter still goes away (§0.2 — one image now holds both timeframes), but D2
replaces it with a variant selector rather than nothing:

```typescript
r2Storage.getLatestChartPng(symbol, timeframe); // before
r2Storage.getLatestChartPng(symbol, 'overlay' | 'standard'); // after
```

⚠ **This is an interface change to a Stack D function signature, and it now also puts a tier
check on the call path — flagged for explicit sign-off rather than assumed.** Session 12-2 has not
been built yet, so the call site is cheaper to change now than later.

**Where the tier check belongs — worth deciding deliberately.** The renderer must not know about
tiers (§1.1a keeps it a dumb cron artifact). So the `'overlay' | 'standard'` argument has to be
resolved by the caller, from the user's tier plus their toggle state, inside
`execute7PillarRetrieval()` (§10). That function currently receives `userId` and already fetches
`getUserTradePreferences(userId)` for Pillar 7 — so the entitlement data is **already in scope**
at exactly the right point. Recommend resolving it there rather than threading a new parameter
down from the route.

### W8 — "3-Panel" → "2-Panel" across the product surface _(new, Davin 2026-09-10)_

The panel count is not confined to this module — it is **already ported into the main monolith**
and translated. Verified counts:

| Site                                         | Where                                        | Note                                   |
| -------------------------------------------- | -------------------------------------------- | -------------------------------------- |
| `Matplotlib 3-Panel Vision Render`           | `components/chat-sidebar.tsx:414`            | The download button's subtitle         |
| `3-Panel Read-Only Terminal`                 | `components/landing/landing-pricing.tsx:104` | ⚠ **Public pricing page** — see below |
| `Matplotlib 3-Panel Vision Render`           | **12** of 17 `lib/i18n/dictionaries/*.json`  | Literal-English-as-key convention      |
| `3-Panel Read-Only Terminal`                 | **16** of 17 dictionaries                    | Widest reach of any string here        |
| `XAUUSD_Matplotlib_3Panel_Vision_Render.png` | `components/chat-sidebar.tsx:111`            | Hardcoded download filename            |

≈30 sites. Because this codebase uses the literal English string **as the dictionary key**,
renaming is not a value edit — the key itself changes in every dictionary that carries it, or the
lookup silently falls through to the raw key.

⚠ **`3-Panel Read-Only Terminal` needs Davin's explicit sign-off — it is a customer-facing tier
claim on the public pricing page**, not internal copy. Changing "3-Panel" to "2-Panel" there
alters an advertised product feature. Recommend it changes to match reality, but it is a marketing
decision, not an engineering one.

**Also note the seed copy is deliberately excluded.** `seed-code/trading-conversational-ai-ui-pages-increment/`
carries the same strings (`components/chat-sidebar.tsx:380`, `landing-pricing.tsx:63`) but is
read-only per `CLAUDE.md` non-negotiable #4/#5. It will drift from the monolith by this rename —
expected and correct, not an oversight.

---

## 4. Execution order

Each step ends green before the next begins; one commit per step (`EXECUTOR-PROTOCOL.md` §2).

1. **W1** registry — pure addition, nothing else imports it yet.
2. **W4** fixture — so the new-shape tests have something to run against.
3. **W6** new schema-parity test — should **fail** against the old fixture and pass after W4.
   Running it in this order proves it detects the real bug rather than merely passing.
4. **W2** data layer.
5. **W3** renderer.
6. **W5** CLI.
7. **W6** remaining test updates.
8. **W7** docs.
9. **W8** the 3-Panel → 2-Panel rename — **last, and as its own commit.** It touches the monolith
   and 16 dictionaries, so keeping it separate means a `test:ci` failure there is unambiguously
   attributable to the rename rather than to the renderer work. Gate it on the monolith's own full
   suite, not just this module's pytest.

---

## 5. Verification

| Check                   | Command / criterion                                                                                                                                                                                                                                     |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Compile                 | `python -m py_compile mtf_render/*.py`                                                                                                                                                                                                                  |
| Unit                    | `python -m pytest test_mtf_render.py` — all green, incl. 4 new tests                                                                                                                                                                                    |
| Schema parity           | New W6 test passes against the **real** `sqlite_schema_v6_xauusd.sql`                                                                                                                                                                                   |
| Demo render             | `python -m mtf_render --out chart.png` — 2 stacked panels, aligned axes                                                                                                                                                                                 |
| **D2 both variants**    | `python -m mtf_render --both-variants --out chart.png` — two files written from one snapshot                                                                                                                                                            |
| **D2 standard variant** | `--no-m5-overlay` — lower panel has M15's own channel and **is not empty** (§1.1d), and its title states the overlay is off                                                                                                                             |
| Multi-overlay           | `python -m mtf_render --overlays best_fit_a,resistance,support --out multi.png`                                                                                                                                                                         |
| Irregular naming        | `--overlays fractal_edt` renders (proves `fractal_best_fl` is mapped, §0.6)                                                                                                                                                                             |
| Regression              | Every one of the 10 registry keys renders without a SQL error                                                                                                                                                                                           |
| Visual                  | **All three** PNGs inspected directly — panel alignment, legend legibility, and whether the two D2 variants are distinguishable at a glance. None of this is expressible as an assertion, and the last one is the actual deliverable of the D2 revision |

**Not verifiable here, flagged rather than skipped:** a render against a **real** `xauusd.db` with
live values. No such database exists in this environment, and per deck §11 the VPS pipeline has
not yet run a green cycle with the recompiled `.ex5`. Everything above runs against the fixture.
The schema-parity test (W6) is the strongest available proxy — it checks the real DDL, but cannot
prove the real data renders sensibly.

---

## 6. Out of scope

| Item                                           | Why                                                                                                                                                                                      |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ZigZag / Z-Score overlays                      | Not price-level lines (sparse pivot events; body classification). Would need their own mark design. Registry is extensible for a later task.                                             |
| R2 upload / cron wiring                        | Stack D §9 Engine 3 work, not this module. Renderer's job ends at writing the PNG.                                                                                                       |
| **Tier-gating the PNG download** (§0.7 item 1) | A monolith entitlement change. **But it is what actually delivers D2 in production** — the renderer's variants are inert until the download path checks tier. Recommend its own session. |
| **Wiring the download to R2** (§0.7 items 2–3) | Same session as the above. Today it points at a static `public/` file that does not exist.                                                                                               |
| `seed-code/**` copies of the renamed strings   | Read-only per `CLAUDE.md` rule 5 — W8 covers the monolith only; the seed will drift, correctly.                                                                                          |
| Prisma / gateway / `operation-service`         | §0.3 — not a dependency.                                                                                                                                                                 |
| MQL5 `.ex5` recompile                          | Deck §11 action item 1, Davin's task; blocks live fidelity, not this work.                                                                                                               |
| Postgres as a data source                      | Renderer is VPS-side against SQLite by design.                                                                                                                                           |

---

## 7. Open items

### 7.1 ✅ RESOLVED — the newest bar is marked, not dropped

Deck §10 records that "the export includes the still-forming bar, so the newest row in
`market_data_v6` is always an incomplete candle until the next cycle overwrites it."

**This section originally recommended dropping it. That recommendation was reversed on review,
2026-09-10, and the reversal is the interesting part.**

Dropping the bar would make the render up to one bar-period stale — five minutes on M5, fifteen on
M15. The trader's screen would then show a candle the downloaded PNG does not, which is precisely
the screen-vs-download divergence the dual-stacked layout work existed to close. Trading one
ambiguity for a different inconsistency is not a fix.

**Built instead:** the newest candle on each panel is drawn **hollow with a dashed outline and a
"forming" caption**, and the suptitle states it in words. That keeps parity with the screen _and_
removes the ambiguity, because the image now describes its own caveat rather than relying on the
reader knowing. It is the same principle already chosen for the `standard` variant, which names
its missing overlay rather than just omitting the lines: **state it, do not imply it by absence.**

**The residual risk, stated plainly:** a mark is weaker than an absence. A careless reader can
still take the partial bar at face value. If Pillar 6's pattern-verification job ever makes that
unacceptable, dropping the bar becomes defensible — but the reason would be "a wrong read is worse
than a stale one", not "the staleness is harmless".

`_draw_candles(..., mark_forming=False)` disables it, and both behaviours are covered by tests.

### 7.2 Look-ahead bias is inherited and unfixable here

`HISTORICAL-VALUES-LOOK-AHEAD-BIAS-OPEN-ISSUE.md` / deck §10b: the centroid/SSA fitting window
re-anchors to the live bar, so historical channel values were refitted with data from up to ~2
weeks after the bar. **Harmless for this renderer** — a live chart _wants_ the newest fit, which
is exactly what the trader sees on screen. Recorded only so nobody later mistakes the rendered
history for a point-in-time backtest input.

### 7.3 The `.ex5` gap makes live overlay fidelity untestable for now

Until the 10 statistic-emitting indicators are recompiled (deck §11 action item 1), live exports
still carry the per-source timestamp phase (§0.4). The renderer will _work_, but M5→M15 overlay
alignment against live data cannot be validated until then. Fixture rendering is unaffected.

---

## 8. Summary

|                   | Before                                                  | After                                                 |
| ----------------- | ------------------------------------------------------- | ----------------------------------------------------- |
| Panels            | 3 side-by-side (A=M5, B=M15, C=M15 — B and C identical) | 2 stacked (upper M5, lower M15)                       |
| Overlays          | 6 variants, incl. **non-existent** `best_fit`           | 10 overlays across 7 centroids + fractal + S/R        |
| Against a real DB | **Raises `no such column`**                             | Renders                                               |
| Time axes         | Independent, equal bar counts                           | Shared, equal time span (D1)                          |
| Files per cycle   | 1                                                       | **2 — `overlay` and `standard`** (D2)                 |
| M5-on-M15         | Always drawn                                            | **PRO + toggle only** (D2), absence stated explicitly |
| Tier awareness    | None                                                    | In the **fetch**, never in the renderer (§1.1a)       |
| Timestamp caveat  | "conversion stack must be completed first"              | Fixed at source; gated on VPS redeploy                |
| Stack D contract  | 3-panel, per-timeframe filename                         | 2-panel, per-**variant** filename, 5-min cadence      |

| UI copy | "3-Panel" across ~30 live sites | "2-Panel" (W8) |

**Files touched:** 6 in this module (1 new), 1 in `davintrade-stack-d-and-e/` (6 sites),
2 monolith components + 16 dictionaries (W8).
**Not touched:** Prisma, gateway, `operation-service`, `seed-code/`, MQL5.

**Blockers:** none. D1–D5 all resolved.
**Needs sign-off before W8 lands:** the public pricing-page string "3-Panel Read-Only Terminal"
(§W8) — a customer-facing tier claim.
**Known not to be delivered by this plan:** production D2 enforcement, which depends on the
download path being tier-gated and R2-wired (§0.7, §6).
