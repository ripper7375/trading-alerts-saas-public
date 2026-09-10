# Dual-Stacked Chart Layout — Plan

**Status:** APPROVED and **EXECUTED**, 2026-09-10. Retained as the design record.
Outcome and deviations: `MTF-DUAL-STACKED-LAYOUT-MANIFEST-WORK-COMPLETION.md`.
**Date:** 2026-09-10.
**Scope:** bring the monolith's terminal and FREE workspaces to the two-stacked-chart
layout (XAUUSD M5 upper, M15 lower) shown in the seed UI and in the rendered PNG.
**Closes:** `MTF-RENDER-DELIVERY-MANIFEST-WORK-COMPLETION.md` §7.6.

**Why this exists.** The rendered PNG that PRO users download, and that the LLM
will eventually read, is two stacked panels. The on-screen terminal is one chart
with a timeframe selector. Both express the same data and the same entitlement,
but they do not look alike — so a trader comparing the download against their
screen sees two different things.

---

## 0. Findings — verified against live code before planning

### 0.1 The seed's approach is the wrong shape for this codebase

The obvious reading of "port the dual layout" is to bring across the seed's
`components/trading-chart.tsx` — 856 lines that own two chart instances, two
containers, a view-mode switch, a drawing toolbar and mock data generators.

**Do not.** The monolith's `components/charts/trading-chart.tsx` (349 lines) is
already fully self-contained and parameterized by `timeframe`, with its own
socket, drawing layer, alert markers and appearance wiring. Two stacked charts is
therefore **composition of two existing instances**, not a rewrite.

That distinction matters because the monolith's version carries three things the
seed's does not, all of which a wholesale port would regress:

| In the monolith, absent from the seed                                                | Where                               |
| ------------------------------------------------------------------------------------ | ----------------------------------- |
| Reactive `applyOptions()` theme/candle-color updates (the 2026-09-04 Theme Mode fix) | `trading-chart.tsx:200-237`         |
| Real live socket data                                                                | `useOhlcvSocket(symbol, timeframe)` |
| `DrawingLayer` + `useFiredAlertMarkers`                                              | lines 92, 324-331                   |

The seed also reads theme via next-themes' `useTheme()`, which per `CLAUDE.md`'s
2026-09-04 entry **is no longer kept in sync** with this app's actual theme —
`AppearanceProvider` owns the DOM class now. Porting the seed's theming would
silently reintroduce a bug this repo already fixed once.

### 0.2 ✅ The MTF toggle needs no change whatsoever

`trading-chart.tsx:99` — `const mtfAvailable = timeframe.toUpperCase() === 'M15'`.

In a stacked layout the lower instance _is_ M15, so the toggle renders on the
lower chart and nowhere else — exactly the desired behaviour, for free. The
existing gate (`isPro && mtfAvailable && mtfEnabled`) and `MtfToggle`'s own
PRO/FREE branch both work unmodified.

This is the strongest argument for composition over rewrite: the feature this
whole layout exists to showcase already lands in the right place.

### 0.3 The two instances isolate cleanly — verified, not assumed

| Subsystem              | Scoping                                                              | Verdict                              |
| ---------------------- | -------------------------------------------------------------------- | ------------------------------------ |
| `DrawingLayer`         | `createDrawingPersistence(symbol, timeframe)` (line 93)              | Per-timeframe drawings, no collision |
| `useFiredAlertMarkers` | takes `(series, symbol, timeframe)`; own `FiredMarkerStore` per hook | Isolated                             |
| `useOhlcvSocket`       | effect keyed `[symbol, timeframe]`                                   | Independent subscriptions            |
| `useMtfOverlay`        | attaches to the `chartApi` passed in                                 | Only the M15 instance enables it     |

Nothing is shared mutable state between instances.

### 0.4 ⚠ Two instances mean two WebSocket connections

`hooks/use-ohlcv-socket.ts:78` calls `io(wsUrl, …)` **inside the effect**, so
each hook instance opens its own Socket.IO connection and its own
`subscribe`/`unsubscribe` pair (lines 89, 119-121).

The hook's own header notes the backend is "a single Flask instance (eventlet
mode)" with "No Redis required". Eventlet is green-threaded and handles many
concurrent connections cheaply, so this is very likely fine at current scale —
but it is a genuine **doubling of connections per terminal user**, and it should
be a deliberate choice rather than a side effect. See D8.

### 0.5 Three things block composition today

The component is nearly composable but not quite:

| Blocker                                         | Line    | Effect if unaddressed                         |
| ----------------------------------------------- | ------- | --------------------------------------------- |
| `height: 600` hardcoded                         | 123     | Two charts = 1200 px inside a resizable panel |
| Header (`symbol/timeframe` + Live/Disconnected) | 268-292 | Renders twice; two connection indicators      |
| Footer info paragraphs                          | 336-346 | "Displaying live OHLCV data…" twice           |

All three are additive prop changes with defaults, so the existing single-chart
callers and the existing test file keep working untouched.

### 0.6 The timeframe selector lives in the workspaces, not the chart

`app/terminal/terminal-workspace.tsx:140-155` and `app/free/free-workspace.tsx:145`
each render their own `TIMEFRAMES.map(...)` button row and hold
`const [timeframe, setTimeframe] = useState<Timeframe>('M5')`.

So removing it (D9) is a workspace change; the chart component never knew about
it.

### 0.7 The existing test renders the component directly, many times

`__tests__/components/charts/trading-chart.test.tsx` calls
`render(<TradingChart symbol="XAUUSD" timeframe="H1" />)` across many cases, and
already mocks `MtfToggle` to `null` (to avoid needing App Router context).
Prop additions with defaults keep every one of those green.

---

## 1. Decisions taken

Confirmed by Davin in chat, 2026-09-10, before drafting.

| #   | Decision                | Chosen                                   | Rationale                                                                                                                                                                                                                                        |
| --- | ----------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D7  | Composition vs. rewrite | **Compose two `TradingChart` instances** | §0.1 — a rewrite would regress the theme fix, drawing layer and socket wiring, and §0.2 shows the toggle already lands correctly under composition. Recommended in the plan; not a question put to Davin, because the evidence is one-sided.     |
| D8  | Socket strategy         | **Two connections, accept it**           | Simplest, touches no existing consumer. The doubling is acknowledged rather than discovered later.                                                                                                                                               |
| D9  | Timeframe selector      | **Remove it**                            | Both timeframes are always visible, so it has nothing to select. Matches the seed and the screenshot, neither of which shows timeframe buttons.                                                                                                  |
| D10 | FREE workspace          | **Same dual layout**                     | FREE already receives the same real data and the same component; the overlay toggle stays PRO-gated on the lower chart, so the entitlement boundary is unchanged and the locked toggle becomes a clearer upsell than hiding the layout entirely. |

**A consequence of D8 worth stating plainly:** with D10, _every_ terminal and
`/free` user now holds two WebSocket connections instead of one. That is the
change most likely to matter operationally, and it is entirely a scale question,
not a correctness one.

---

## 2. Target layout

```
┌─ panel-c-chart ─────────────────────────────────┐
│  XAUUSD                              ● Live     │  ← one shared header
├─────────────────────────────────────────────────┤
│  Chart 1 — M5                                   │
│    candles + drawing layer + alert markers      │
├─────────────────────────────────────────────────┤
│  Chart 2 — M15                    [M5 Overlay]  │  ← toggle, PRO-gated,
│    candles + drawing layer + alert markers      │    appears here only
│    + M5 channel when enabled                    │    (mtfAvailable, unchanged)
└─────────────────────────────────────────────────┘
```

Mirrors the rendered PNG's arrangement (M5 above, M15 below), so the download and
the screen finally agree.

**Not mirrored, deliberately:** the PNG puts both panels on one shared time axis
(the renderer's D1). Two independent `lightweight-charts` instances each own their
own time scale, and syncing them is a separate, larger piece of work — see §7.1.

---

## 3. Work items

### W9 — Make `TradingChart` composable

Additive props only, all defaulted so existing callers are untouched:

```ts
interface TradingChartProps {
  symbol: string;
  timeframe: string;
  height?: number; // default 600 — preserves current behaviour
  showHeader?: boolean; // default true
  showFooter?: boolean; // default true
  label?: string; // optional per-chart caption, e.g. "M5"
}
```

- `height` replaces the hardcoded `600` at line 123.
- `showHeader` / `showFooter` gate the blocks at 268-292 and 336-346.
- **The MtfToggle stays inside the chart**, not lifted into the header. It is
  positioned by `mtfAvailable`, which is what puts it on the M15 chart (§0.2);
  moving it would break that for no gain.

### W10 — New `MtfStackedCharts` composite

`components/charts/mtf-stacked-charts.tsx`:

```tsx
<div className="flex h-full flex-col gap-2">
  <SharedHeader symbol={symbol} /> {/* one Live indicator */}
  <TradingChart
    symbol={symbol}
    timeframe="M5"
    height={h}
    showHeader={false}
    showFooter={false}
    label="M5"
  />
  <TradingChart
    symbol={symbol}
    timeframe="M15"
    height={h}
    showHeader={false}
    showFooter={false}
    label="M15"
  />
</div>
```

- Splits available height between the two panels.
- The shared header shows connection state. **Open question in §7.2:** each
  instance owns its own `isConnected`; the composite has no direct access to
  either. Simplest honest answer is to let each chart keep a small inline status
  chip via `label`, rather than inventing a lifted-state mechanism.

### W11 — Wire both workspaces

`app/terminal/terminal-workspace.tsx` and `app/free/free-workspace.tsx`:

- Replace `<TradingChart symbol="XAUUSD" timeframe={timeframe} />` with
  `<MtfStackedCharts symbol="XAUUSD" />`.
- **Delete** the `TIMEFRAMES.map(...)` button row and the `timeframe` /
  `setTimeframe` state (D9). Check whether `TIMEFRAMES` remains imported for any
  other purpose before removing the import.
- Keep everything else in the panel untouched.

### W12 — Tests

| Test                                                       | Asserts                                                         |
| ---------------------------------------------------------- | --------------------------------------------------------------- |
| _(existing)_ `trading-chart.test.tsx`                      | Must stay green **unchanged** — proves W9 is genuinely additive |
| **(new)** renders exactly two charts, M5 then M15          | The layout itself                                               |
| **(new)** `useOhlcvSocket` called with both `M5` and `M15` | Both subscriptions established                                  |
| **(new)** the M5 instance gets `showHeader={false}`        | Chrome is not duplicated                                        |
| **(new)** `MtfToggle` appears once, on the M15 instance    | §0.2's behaviour is pinned, not assumed                         |
| **(new)** FREE tier still renders both charts              | D10                                                             |

The fourth is the one worth writing carefully: it is the single assertion that
would catch someone later "tidying" `mtfAvailable` and silently moving the toggle
onto the M5 chart, where it would be meaningless.

### W13 — Docs

- `MTF-RENDER-DELIVERY-MANIFEST-WORK-COMPLETION.md` §7.6 — close it.
- Note in the module README that the on-screen layout and the rendered PNG now
  match in arrangement, **but not in time-axis behaviour** (§2 / §7.1).

---

## 4. Execution order

1. **W9** — props with defaults; run the existing test suite unchanged. If it
   goes red, W9 is not additive and the approach needs revisiting before
   anything else is built.
2. **W10** — the composite, in isolation.
3. **W12** — the new tests, against W10.
4. **W11** — wire the terminal workspace, then `/free`.
5. **W13** — docs.

Step 1's gate is the important one: the whole case for composition rests on
`TradingChart` not needing to change behaviourally.

---

## 5. Verification

| Check                  | How                                                                     |
| ---------------------- | ----------------------------------------------------------------------- |
| Type + lint            | `npx tsc --noEmit`, `npx eslint <changed>` (never `npm run lint` — L38) |
| Regression             | `npm run test:ci` — baseline **174/174 suites · 2433/2433 tests**       |
| Additivity             | The existing chart test passes **with no edits**                        |
| Live, `/terminal`      | Two charts render, M5 above M15, both receive socket data               |
| Live, toggle placement | `M5 Overlay` appears on the lower chart only                            |
| Live, `/free`          | Same layout; toggle renders **locked** and routes to `/pricing`         |
| Sockets                | Browser devtools: exactly **two** WS connections, not four or one       |

**Not verifiable here — flagged, not skipped:** both workspaces sit behind auth,
and the Executor does not enter credentials. The socket count, the live overlay
and the FREE-tier locked state all need Davin's own click-through. Whether the
Flask backend is even reachable from this environment is also unknown — the
earlier renderer session found `/terminal` showing `Disconnected`.

---

## 6. Out of scope

| Item                                                                           | Why                                                                                 |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| Synchronised time axes between the two charts                                  | §7.1 — larger, and not required for visual parity                                   |
| The seed's extra chart chrome (view-mode switch, drawing toolbar, price modes) | Not part of the dual-layout request; the monolith has its own drawing layer already |
| Shared-socket refactor                                                         | D8 chose two connections; §7.3 records the follow-up                                |
| Persisting `mtfEnabled`                                                        | Still the blocker for the download following the toggle — delivery manifest §7.5    |

---

## 7. Open items & risks

### 7.1 The PNG shares one time axis; the screen will not

The renderer's D1 puts both panels on an identical time range, which is what makes
them read as one comparison. Two independent `lightweight-charts` instances each
own a time scale and will pan/zoom independently.

`lightweight-charts` supports subscribing to another chart's
`timeScale().subscribeVisibleLogicalRangeChange()` to mirror ranges, but M5 and
M15 have different bar widths, so the mapping is not one-to-one and naive syncing
looks wrong. Deliberately excluded; recorded so the difference between download
and screen is a known, chosen gap rather than an oversight.

### 7.2 The shared header needs connection state it does not own

Each `TradingChart` computes its own `isConnected`. A single shared indicator
would require lifting that out of both instances. Recommended: keep a small
per-chart status chip instead of lifting state — less machinery, and arguably more
honest, since the two subscriptions genuinely can differ.

### 7.3 Two connections per user, now on every workspace

D8 + D10 together mean both `/terminal` and `/free` hold two WebSockets per
viewer. Worth measuring on the Flask box before user numbers grow; the
shared-socket refactor (one connection, two `subscribe` calls — the protocol
already supports it) is the known remedy.

### 7.4 Chart height inside a resizable panel

Both workspaces put the chart in a `ResizablePanel`. Splitting a dragged height
between two charts, given `lightweight-charts` needs an explicit pixel height,
may need a `ResizeObserver` rather than a fixed split. Likely small, but it is
the most probable source of layout fiddliness in this work.

---

## 8. Summary

|                          | Before                         | After                                |
| ------------------------ | ------------------------------ | ------------------------------------ |
| Terminal chart area      | One chart + M5/M15 selector    | Two stacked charts, no selector      |
| M5 overlay toggle        | On the chart when M15 selected | On the lower chart, always visible   |
| `/free`                  | One chart + selector           | Same dual layout, toggle locked      |
| WebSockets per viewer    | 1                              | **2**                                |
| `TradingChart`           | 349 lines, single-use          | Same behaviour + 4 optional props    |
| Matches the rendered PNG | No                             | Arrangement yes; time axis no (§7.1) |

**New files:** 1 (`mtf-stacked-charts.tsx`).
**Modified:** `trading-chart.tsx` (additive), both workspaces, tests, 2 docs.
**New dependencies:** none.
