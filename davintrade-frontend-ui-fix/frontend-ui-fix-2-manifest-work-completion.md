# Frontend UI Fix 2 — Work Completion Report

**Date:** 2026-09-16 (one session, two rounds)
**Status:** Code complete, verified, committed and pushed to `origin/main` (§5), in two rounds:

- **Round 1** (§1): the `/terminal` and `/free` chart panel. The divider between the M5 and M15 charts
  is now draggable, and both charts follow it.
- **Round 2** (§2): three polish items on the result — one correct grip per divider (two of Davin's
  three items turned out to be a single bug), and no crosshair flashing at the drawing toolbar.

Browser-side only: no API, schema, migration or VPS change, so everything ships with the monolith
deploy. Final full suite: **220/220 suites, 2881/2881 tests**, from a 218/2850 baseline — which is
exactly where Frontend UI Fix 1 closed. Open items: §4.

**Type:** Ad-hoc UI fix session, requested directly in chat with annotated screenshots (shared in chat,
not saved to the repo). Outside the phase/session numbering, per
`docs/migration-orders/EXECUTOR-PROTOCOL.md` §6.

> **Scope:** the chart panel of the PRO and FREE workbench (`/terminal`, `/free`) and the resize
> handles shared across it. Every visual claim below was checked on a local `next dev` through a
> throwaway unauthenticated preview route, deleted before each commit; none was checked signed in on
> `davintrade.app` (§4).

---

## 1. Round 1 — drag-resizable divider between the M5 and M15 charts

### 1.1 What was asked

Two screenshots, side by side:

| Screenshot                                                     | What it showed                                                          |
| -------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Seed, `trading-conversational-ai-ui-pages.vercel.app/terminal` | The band between the two stacked charts drags, marked "user could drag" |
| Production, `davintrade.app/terminal`                          | The same band, marked "User could not drag"                             |

> "I would like to add feature that allow user to adjust height of top and bottom window in the third
> panel (chart panels)."

### 1.2 Root cause, read before changing anything

The seed's `components/trading-chart.tsx` wraps its two canvases in a vertical `ResizablePanelGroup`
(50/50, `minSize` 20) with a `withHandle` divider. The real codebase's
`components/charts/mtf-stacked-charts.tsx` was a `flex-col gap-2` computing
`perChart = available / 2 − CHROME_PER_CHART` — so the band between the charts was inert **by
construction**, not by a broken handler.

`components/ui/resizable.tsx` already supported `direction="vertical"` with `cursor-row-resize`, so no
new primitive was needed. The work was the height maths, because `lightweight-charts` needs an explicit
pixel height rather than a flexible one: the split cannot be CSS alone.

**Two pre-existing bugs surfaced while measuring the live layout to get that maths right.** Neither was
asked about, and neither throws:

| #   | Bug                                                                                                                                                             | Evidence                                                                               |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 1   | The M15 label strip carries `MtfToggle` and the M5 strip does not, so the two charts had genuinely different chrome while the code subtracted a single constant | Measured **65.6px** (M5) vs **83.2px** (M15)                                           |
| 2   | That constant was **44px** against an actual **~66px**                                                                                                          | The M15 chart's root measured **477.2px** inside a **459px** pane — **18.2px clipped** |

Bug 2 is visible in Davin's own production screenshot: the M15 drawing toolbar runs off the bottom of
the viewport. The box is clipped, so an underestimate never overflows visibly — it silently cuts the
bottom off the lower chart.

### 1.3 What was built

- **`components/charts/mtf-stacked-charts.tsx`:** the flex column becomes a vertical
  `ResizablePanelGroup` with a labelled `withHandle` divider between M5 and M15.
  - **`onLayout` feeds the divider position back into both canvas heights**, so the charts follow the
    drag rather than staying at their mount-time height — the same failure class Fix 1 §1.2 records for
    the horizontal panels, where collapsing changed what a panel rendered but never its size.
  - No-op layout reports are ignored (`SPLIT_EPSILON`), so dragging along a panel's minimum does not
    re-render two charts for nothing.
  - The handle's `my-1` margin is dropped, so the divider's real footprint is the 10px the maths
    reserves rather than 18px.
- **`components/charts/mtf-split-layout.ts` (new):** the height maths as pure functions.

  | Constant                   | Value | Where it comes from                                     |
  | -------------------------- | ----- | ------------------------------------------------------- |
  | `CHROME_PER_CHART`         | 86    | strip `h-9` 36 + `space-y-4` 16 + card `p-4`/borders 34 |
  | `MIN_CHART_HEIGHT`         | 160   | below this a canvas is unreadable                       |
  | `MIN_PANE_PX`              | 246   | `MIN_CHART_HEIGHT` + chrome                             |
  | `SPLIT_HANDLE_PX`          | 10    | `h-2.5` on a vertical `ResizableHandle`                 |
  | `FALLBACK_TOTAL_HEIGHT_PX` | 640   | until the group is measured (first paint, jsdom)        |

  `CHROME_PER_CHART` is **measured, not estimated, and rounded up** for the reason in §1.2.
  `minPanePercent()` is **capped at 50**, because both panes carry the same minimum: a larger value
  could never be satisfied by both at once, and the library would clamp it anyway. On a viewport short
  enough to hit that cap the divider simply stops moving, which is the honest outcome — there is no
  space left to reallocate.

- **`components/charts/trading-chart.tsx`:** the stacked-mode label strip becomes fixed-height (`h-9`).
  This is the fix for bug 1, and it is the robust form: the chrome becomes **one number for the layout**
  rather than one per timeframe, so it does not break the moment the toggle moves. It also stops the M15
  label row jumping when the toggle's loading state changes.
- **Dictionaries:** one identity key, `"Drag to resize the upper and lower charts"`, in `en-US` and
  `en-GB` — the divider's accessible name.

### 1.4 Verification

| Check                                  | Result                                                                                                                                                         |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tsc --noEmit`, ESLint, Prettier       | Clean; both dictionaries still valid JSON                                                                                                                      |
| New `mtf-split-layout.test.ts`         | **15/15**: even split, dragged split, the box-fits invariant at four sizes, the short-viewport clamp, the minimum's 50% cap, and `minSize ≤ defaultSize`       |
| `mtf-stacked-charts.test.tsx` (+6)     | Vertical group; a labelled divider between the right two panes; even start; the split moves when driven; **both canvases follow it**; both charts stay mounted |
| Mutation (restored byte-exact, sha256) | Ignore `onLayout`: **1 fail**. Divider removed: **6**. Chrome underestimated: **2**. 50% cap dropped: **2**. Divider footprint not reserved: **7**             |
| Full monolith `npm run test:ci`        | **219/219 suites, 2871/2871 tests**: the 218/2850 baseline plus exactly 1 suite / 21 tests                                                                     |
| Live, 936px box                        | Divider 10px, panes **463/463**, roots **461.6/461.6** (identical — bug 1 fixed), canvases **376/376**, both **1.4px inside** their panes                      |
| Live, drag down                        | Grow **64.6/35.4**, panes 448.3/245.7, canvases **360/160**, overflow −2.7 / −0.1                                                                              |
| Live, drag up                          | The mirror: 35.4/64.6, panes 245.7/448.3, canvases 160/360                                                                                                     |
| Live, both stops                       | Clamps at the **246px** minimum pane; neither chart overflows in either direction                                                                              |
| Live, window 1400×1000 → 1024×620      | Container 556, panes 272.5/273.5, canvases **376 → 186**, split preserved at 49.9/50.1                                                                         |
| Live, other behaviour across a resize  | The M5 Overlay toggle stays on M15 only; the drawing toolbar's own `toolbarLayout()` re-flows correctly at the new heights                                     |
| Console                                | No panel-library warnings; no chart or panel errors                                                                                                            |

**Not verified:** signed-in click-through on `davintrade.app` (§4).

---

## 2. Round 2 — one grip per divider, and no crosshair at the toolbar

### 2.1 What was asked

One annotated screenshot of the deployed `/terminal`, three numbered items:

| #   | Davin's note                                                                     | Where                                    |
| --- | -------------------------------------------------------------------------------- | ---------------------------------------- |
| 1   | "It has a vertical dashline exist when I hover mouse close to drawing tools bar" | The M5 chart, beside the drawing toolbar |
| 2   | "Change double pads to 2 double vertical pads style"                             | The three column dividers                |
| 3   | "Change double pads to 2 horizontal pads style"                                  | The new M5/M15 row divider               |

### 2.2 Root cause

**Items 2 and 3 are one bug, silently live since the handle was written.** `react-resizable-panels`
puts `data-panel-group-direction` on the **handle**, so the six direction-conditional Tailwind classes
on the grip in `components/ui/resizable.tsx` — written as plain `data-[…]` variants on **child**
elements — matched nothing:

- the grip box's four size classes never applied, so it had **no size at all** and was sized by content;
- both icons' `hidden` classes never applied, so **both grips drew**.

That doubled-up pad is what Davin marked on all four dividers. The authors' intent was already correct
(hide the horizontal grip on a horizontal group, and the vertical grip on a vertical one); only the
scope was wrong.

**Item 1 is the chart's own crosshair**, established by **elimination rather than reproduction**:

- `trading-chart.tsx` sets `crosshair.vertLine.style: 3` — `LargeDashed` — in `#758696` (dark) /
  `#94a3b8` (light);
- `EventVerticalLine` (the high-impact news marker) is a **solid** amber `fillRect`;
- every other vertical line in the drawing engine is solid, and a dashed user-drawn mark has to be
  drawn first.

Nothing else in the repo draws a dashed vertical line on hover. It would **not** reproduce locally: the
crosshair needs series data, and the dev CSP blocks the `ws://localhost:5001` feed, so the local chart
is empty.

**Four handlings were genuinely different work, so the choice went to Davin** (`AskUserQuestion`)
rather than being guessed at: suppress it around the toolbar; drop the vertical line only; keep it but
make it subtler; or remove the crosshair entirely. He took the recommendation — **suppress it around
the toolbar**, keeping the crosshair everywhere else. Removing it outright would have been a
regression: the seed prototype has one too.

### 2.3 What was built

- **`components/ui/resizable.tsx`:** the handle gains `group`, and all six variants become
  `group-data-[panel-group-direction=…]`. Exactly one grip now renders per divider:

  | Divider                                        | Group direction | Grip            | Box       |
  | ---------------------------------------------- | --------------- | --------------- | --------- |
  | Sidebar / AI Analyst / chart / Market Comments | `horizontal`    | vertical only   | 13.6 × 20 |
  | M5 / M15                                       | `vertical`      | horizontal only | 24 × 14   |

- **`components/charts/drawing/Toolbar.tsx`:** the toolbar floats over the chart as a **sibling** of
  the chart element, so hovering a tool button already cleared the crosshair — it was the **gutter**
  around it that was still live chart surface, which is why reaching for a tool flashed a full-height
  dashed line up the toolbar's own column. All three layout branches (`stacked` / `split` / `grid`) now
  sit inside one transparent padded wrapper, `absolute left-0 top-0 z-10 pl-2 pt-2 pr-4 pb-4`.
  **Padding is inside an element's hit area**, so that gutter stops being chart and the chart receives
  the `mouseleave` that `lightweight-charts` clears the crosshair on.
  - **The toolbar does not move.** The buffer carries the `left-2 top-2` offset the frame used to apply
    itself, and the frame is de-positioned — verified at exactly 8,8 from the chart in all three
    layouts.
  - `data-layout` stays on the frame, so the existing layout tests keep their query.

### 2.4 Verification

| Check                                            | Result                                                                                                                                                   |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tsc --noEmit`, ESLint, Prettier                 | Clean                                                                                                                                                    |
| New `__tests__/components/ui/resizable.test.tsx` | **6/6**: the handle is marked `group`; the box's variants are group-scoped and **not** bare `data-`; the right grip is hidden on each direction          |
| `__tests__/drawing/toolbar.test.tsx` (+4)        | A padded, positioned buffer wraps all three layouts, with padding on every side; the frame stays unpositioned so the toolbar does not shift              |
| Mutation (restored byte-exact, sha256)           | Bare `data-` variants (the original bug): **4 fail**. `group` dropped: **2**. Buffer removed: **4**. Buffer's bottom/right padding dropped: **3**        |
| Full monolith `npm run test:ci`                  | **220/220 suites, 2881/2881 tests**: 219/2871 plus exactly 1 suite / 10 tests                                                                            |
| Live, grips                                      | Row divider: box **24 × 14**, only `grip-horizontal` (`grip-vertical` computed `display: none`). Column divider: box **13.6 × 20**, only `grip-vertical` |
| Live, toolbar position                           | Offset **exactly 8,8** from the chart in all three layouts; buffer padding computed `8px 16px 16px 8px`                                                  |
| Live, hit testing (`elementFromPoint`)           | The gutter **left of, below and right of** the toolbar resolves to the buffer; plain chart area still resolves to the chart                              |
| Live, the crosshair's own signal                 | Crossing from the chart into the buffer makes the chart element receive **`mouseleave`** — the exact event `lightweight-charts` clears the crosshair on  |
| Live, dark mode                                  | Both grips render correctly against the dark chrome                                                                                                      |

**Not verified:** the crosshair itself was never seen painting or clearing — it needs live candles
(§4). The mechanism is verified instead, and it is the same one the toolbar has always relied on.

---

## 3. Process issues found and handled

Recorded because each could have left the repo or this report wrong.

1. **`ResizeObserver` and `requestAnimationFrame` do not fire while the Browser pane is hidden**
   (`document.hidden === true`). The charts appeared frozen at a stale measurement, and a **freshly
   attached** observer never received even its mandatory initial callback — which looks exactly like an
   app bug and was briefly treated as one. Fronting the pane and forcing a paint with a screenshot
   resolved it. **A measurement taken through that pane is only trustworthy once `document.hidden` is
   `false`;** checking it is cheaper than re-deriving the bug.
2. **A test of a measured constant that proved nothing about it.** The first draft's box-fits
   assertions subtracted `CHROME_PER_CHART` from both sides, so a wrong value cancelled out and the
   mutation **survived** — the one mutant of five that initially did. Fixed by pinning a literal
   (`paneCanvasHeights(900, [50, 50])` is `[359, 359]`) and the constant's own decomposition, with a
   comment saying not to adjust it to whatever makes the suite pass.
3. **A dictionary key inserted wrongly, caught before it reached a commit.** A `sed` insert wrote a
   literal `$KEY` (the escape consumed the expansion) and into the wrong alphabetical slot. Caught by
   `JSON.parse` on both dictionaries, redone in Node against the real anchor line, and confirmed as
   exactly **one added line per file** with `git diff --stat`.
4. **Mutation runs** used scripts that restore the target unconditionally via `trap … EXIT` and verify
   the restore by **sha256 before and after**, so a crashed run cannot leave a mutated file behind.
5. **Commit messages were passed from files** (`git commit -F -`) throughout, avoiding the PowerShell
   quote mangling recorded in Fix 1 §4.3. This manifest itself had to be written with the file tool
   rather than a shell heredoc, for the same class of reason: its backticks and apostrophes broke the
   shell parse before anything was written.

---

## 4. Out of scope / still open

- **Signed-in click-through on `davintrade.app`** for both rounds. The Executor never enters
  credentials, so every live check ran on a local preview route. Two things specifically want a look
  once this deploys: that the divider drags on the real `/terminal`, and that the M15 chart is **no
  longer clipped** at the bottom (§1.2, bug 2, which is visible in Davin's own screenshot).
- **The crosshair was never seen painting or clearing** — it needs series data the local dev CSP blocks
  (§2.2). Only the mechanism is verified.
- **The split is not remembered across page loads** (no `autoSaveId`), deliberately matching the
  horizontal panel widths, which are not either (Fix 1 §5). One prop if wanted.
- **`space-y-4` (16px) of dead space** sits between each chart's label strip and its card in stacked
  mode, and the card's own `p-4` is generous. Both are counted correctly in `CHROME_PER_CHART`;
  tightening them would give each canvas roughly 40px more but is an unrequested visual change.
- **The buffer is a small dead zone**: the 8px gutter left/top of the toolbar and 16px right/bottom of
  it no longer pan or draw. Bounded, and in the corner the toolbar already occupies.
- **The production chart's "websocket error"** is the live price feed, unrelated to these changes —
  unchanged from Fix 1 §5.
- **Left uncommitted, not this session's:** `davintrade-stack-d-and-e/engine-1-5/engine-1-5-model.xlsx`
  was already modified in the working tree when the session started (7.60 → 7.67 MB, last committed by
  Davin in `aa0335ae`). Kept out of both commits so the diffs stayed honest to what was changed.

---

## 5. Git history

Committed per logical step and pushed to `origin/main`. Each push's pre-push hook ran the type check
and the full `test:ci`, which passed — an independent re-run of the numbers in §1.4 and §2.4.

| Commit     | Summary                                                                                   |
| ---------- | ----------------------------------------------------------------------------------------- |
| `89cdd10a` | `feat(charts): drag-resizable divider between the stacked M5 and M15 charts` (Round 1)    |
| `6aa3f5f4` | `docs: log the M5/M15 drag-resizable divider session`                                     |
| `24f67fc9` | `fix(charts): single correct grip per divider, and no crosshair at the toolbar` (Round 2) |
| `a218a159` | `docs: log the divider-grip and toolbar-crosshair polish session`                         |
| _this_     | `docs(ad-hoc): frontend UI fix 2 work completion manifest`                                |

### Files changed

| Round | Files                                                                                                                                                                                                                                                                                                   |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | New: `components/charts/mtf-split-layout.ts`, `__tests__/components/charts/mtf-split-layout.test.ts`. Changed: `components/charts/mtf-stacked-charts.tsx`, `components/charts/trading-chart.tsx`, `__tests__/components/charts/mtf-stacked-charts.test.tsx`, `lib/i18n/dictionaries/{en-US,en-GB}.json` |
| 2     | New: `__tests__/components/ui/resizable.test.tsx`. Changed: `components/ui/resizable.tsx`, `components/charts/drawing/Toolbar.tsx`, `__tests__/drawing/toolbar.test.tsx`                                                                                                                                |

Both rounds also added their own entry to `CLAUDE.md`, per that file's standing "update at the end of
EVERY session" rule.
