# Phase 1 — Drawing Engine Clean-Room Spec

**Status:** Implementation-ready spec
**Last updated:** 2026-06-18
**Parent doc:** `docs/DRAWING-ENGINE-AND-LINE-ALERTS-ARCHITECTURE.md` (§7 Phase 1, §5 geometry)
**Scope:** DavinTrade's own drawing engine on **Lightweight Charts v5**, 6 tools, built from a
blank file. candleview is referenced for _behavior/algorithms only_ — **no source is copied**.

---

## 0. Clean-room boundary (read first)

- This document describes **what to build and how it should behave**, expressed as DavinTrade's own
  interfaces. It deliberately does **not** reproduce candleview source.
- ✅ You may consult candleview to understand _approach_ (Mark+Manager split, anchor-based geometry,
  handle dragging, fib math) and the retrofit docs
  `seed-code/candleview/TRADINGVIEW-LIGHTWEIGHT-CHARTS-RETROFITS/02,03`.
- ❌ Do not paste candleview `.ts`, do not keep its `any`/`_internal__*`/empty-`catch` patterns.
- All code here must pass `npm run validate` (strict TS, no `any`, real error handling).

---

## 1. Module layout

```
components/charts/drawing/
├── index.ts                       # public API: <DrawingLayer/> + types
├── DrawingLayer.tsx               # React component; owns engine lifecycle, binds to chart+series
├── engine/
│   ├── DrawingEngine.ts           # orchestrator: active tool, pointer routing, mark registry
│   ├── PointerController.ts       # DOM pointer events → engine state machine
│   ├── Selection.ts               # selection + hit-testing across marks
│   └── coords.ts                  # v5 coordinate helpers (price/time ↔ pixel)
├── marks/
│   ├── BaseMark.ts                # implements ISeriesPrimitive; shared render/handle helpers
│   ├── TrendlineMark.ts
│   ├── HorizontalLineMark.ts
│   ├── ChannelMark.ts             # equidistant / parallel
│   ├── FibRetracementMark.ts
│   ├── FibExtensionMark.ts
│   └── TextMark.ts
├── tools/
│   ├── ToolController.ts          # interface for create→preview→finalize→edit
│   └── <one controller per mark> # e.g. TrendlineTool.ts ...
├── geometry/                      # PURE module, shared with Phase 4 worker (no chart imports)
│   ├── types.ts                   # Anchor, AlertLevel, DrawingType
│   ├── trendline.ts horizontal.ts channel.ts fib.ts
│   └── index.ts
├── state/
│   └── useDrawingStore.ts         # tool state (zustand, optional)
├── serialization/
│   └── schema.ts                  # Zod schemas ↔ Drawing.anchors/style (Phase 2)
└── Toolbar.tsx                    # left tool palette (re: retrofit doc 02)
```

**Hard rule:** `geometry/` imports **nothing** from `lightweight-charts` or React. It is plain math
so the Phase 4 server worker can `import` it unchanged.

---

## 2. Lightweight Charts v5 public API we build on

Only public, typed API — no internals.

**Attach/detach a drawing to a series:**

- `series.attachPrimitive(primitive: ISeriesPrimitive)` / `series.detachPrimitive(primitive)`

**`ISeriesPrimitive` members we implement (in `BaseMark`):**

- `paneViews(): readonly IPrimitivePaneView[]`
- `updateAllViews(): void`
- `attached(param: SeriesAttachedParameter): void` / `detached(): void`
- `autoscaleInfo?(start, end): AutoscaleInfo | null` (so marks can extend the price scale)
- `hitTest?(x, y): PrimitiveHoveredItem | null` (hover/cursor only; dragging uses our PointerController)

**Pane view → renderer:**

- `IPrimitivePaneView.renderer(): IPrimitivePaneRenderer | null`, optional `zOrder()`
- `IPrimitivePaneRenderer.draw(target: CanvasRenderingTarget2D)`

**Canvas drawing (DPR-correct):**

- `target.useBitmapCoordinateSpace((scope) => { scope.context; scope.horizontalPixelRatio; ... })`
  for crisp lines/handles. Use `useMediaCoordinateSpace` only for text if simpler.

**Coordinate conversion (centralized in `engine/coords.ts`):**

- price → y: `series.priceToCoordinate(price)` | y → price: `series.coordinateToPrice(y)`
- time → x: `chart.timeScale().timeToCoordinate(time)` | x → time: `coordinateToTime(x)`
- For x **beyond data range** (ray extension / future projection), `timeToCoordinate` may return
  `null`; fall back to logical mapping: `logicalToCoordinate` / `coordinateToLogical` + bar spacing.
  `coords.ts` exposes `timeToX(time): number | null` and `xToTime(x): Time | null` that handle this.
- Redraw trigger: call `chart.timeScale().applyOptions({})` is **not** used; instead our marks return
  fresh views and we rely on `updateAllViews()` + the chart's own render loop, plus
  `chartApi`-driven repaint on data/viewport change (subscribe to `subscribeVisibleTimeRangeChange`).

---

## 3. Core interfaces (DavinTrade's own)

```ts
// geometry/types.ts
export type DrawingType =
  | 'TRENDLINE'
  | 'HLINE'
  | 'CHANNEL'
  | 'FIB_RETRACE'
  | 'FIB_EXT'
  | 'TEXT';

export interface Anchor {
  time: number;
  price: number;
} // chart space; NEVER pixels

export interface AlertLevel {
  id: string; // 'line' | 'channel_top' | 'fib_0.618' ...
  label: string;
  valueAt(time: number): number | null; // constant or linear-in-time
}

// marks + tools
export interface DrawingStyle {
  color: string;
  lineWidth: number;
  lineStyle: 'solid' | 'dashed' | 'dotted';
  // tool-specific extras live here too (fib levels, channel offset, text...)
  [k: string]: unknown;
}

export interface MarkSnapshot {
  // what gets persisted (Phase 2)
  id: string;
  type: DrawingType;
  anchors: Anchor[];
  style: DrawingStyle;
}

export interface DrawingMark {
  // our wrapper around ISeriesPrimitive
  readonly id: string;
  readonly type: DrawingType;
  getAnchors(): Anchor[];
  setAnchors(a: Anchor[]): void;
  getStyle(): DrawingStyle;
  setStyle(s: Partial<DrawingStyle>): void;
  hitHandle(x: number, y: number, tol?: number): string | null; // returns handle id or null
  hitBody(x: number, y: number, tol?: number): boolean;
  alertLevels(): AlertLevel[]; // [] for TEXT
  toSnapshot(): MarkSnapshot;
}

export interface ToolController {
  readonly type: DrawingType;
  readonly anchorCount: number; // clicks needed to finalize
  onPointerDown(p: Anchor): void; // engine feeds chart-space points
  onPointerMove(p: Anchor): void; // live preview
  onPointerUp(p: Anchor): void;
  isComplete(): boolean;
  takeMark(): DrawingMark; // hand finished mark to engine
  cancel(): void;
}
```

`BaseMark` implements `ISeriesPrimitive` + shared helpers: `drawSegment`, `drawHandle`,
`drawHorizontalLevel`, `distanceToSegment`, theme lookup. Each concrete mark implements only its
`paneViews()` renderer + `hitHandle/hitBody/alertLevels`.

---

## 4. Engine state machine (PointerController)

```
IDLE ──(select tool)──► ARMED ──(pointerdown)──► DRAWING ──(anchorCount reached)──► finalize ─► IDLE
  ▲                                                  │ (esc) cancel
  └──(pointerdown on existing mark)──► EDITING ◄─────┘
EDITING: drag handle → setAnchors; drag body → translate all anchors; (esc/click-away) ► IDLE
```

- Pointer events come from the chart **container DOM** (`pointerdown/move/up`, pointer capture).
- Convert every event to an `Anchor` via `coords.ts` before handing to the active `ToolController`
  (drawing) or `Selection`+mark (editing).
- Disable chart panning while DRAWING/EDITING (`chart.applyOptions({ handleScroll:false, handleScale:false })`),
  restore on return to IDLE.
- Snap rules (configurable): snap price to nearest tick; optional snap time to nearest bar.

---

## 5. Per-tool specifications

For each tool: **anchors**, **creation**, **rendering**, **hit-test/handles**, **geometry
`valueAt`**, **alert levels**, **snapshot**.

### 5.1 Trendline / line segment — `TRENDLINE`

- **Anchors:** 2 — `[{t1,p1},{t2,p2}]`.
- **Creation:** click start → preview to cursor → click end.
- **Rendering:** straight segment; option `extendRight` (ray) and `extendLeft`. Draw end handles
  (filled dots) + a midpoint move handle when selected.
- **Hit-test:** `distanceToSegment(x,y) ≤ tol` (px); handles within `tol` of each endpoint.
- **Geometry:** `valueAt(t) = p1 + (p2−p1)·(t−t1)/(t2−t1)`. If not `extend*`, return `null` outside
  `[t1,t2]` (segment-bounded alerts) — extent is a per-alert option (architecture §11.3).
- **Alert levels:** one — `{ id:'line', valueAt }`.
- **Snapshot:** `{type:'TRENDLINE', anchors:[a1,a2], style:{...,extendRight,extendLeft}}`.

### 5.2 Horizontal line — `HLINE`

- **Anchors:** 1 — `[{t:any, price:p}]` (time ignored).
- **Creation:** single click (or drag to position); spans full pane width.
- **Rendering:** full-width horizontal line + optional right-edge price label; one move handle.
- **Hit-test:** `|y − priceToCoordinate(p)| ≤ tol`.
- **Geometry:** `valueAt(_) = p` (constant).
- **Alert levels:** one — `{ id:'line', valueAt:()=>p }`.
- **Snapshot:** `{type:'HLINE', anchors:[{time,price}], style}`.

### 5.3 Equidistant / parallel channel — `CHANNEL`

- **Anchors:** 3 — base line `[{t1,p1},{t2,p2}]` + a 3rd point defining the parallel **offset**
  (store offset as the price distance at `t1`, or as the 3rd anchor and derive).
- **Creation:** click p1 → click p2 (base line preview) → move to set channel width → click.
- **Rendering:** two parallel segments (top/bottom) + optional median; optional fill between.
  Handles on both base endpoints + one width handle.
- **Hit-test:** near either edge segment or median.
- **Geometry:** `base(t) = p1 + slope·(t−t1)`; `top(t)=base(t)+offset`, `bottom(t)=base(t)` (or ±).
- **Alert levels:** `[{id:'channel_top',valueAt:top},{id:'channel_bottom',valueAt:bottom},
{id:'channel_median',valueAt:median}]` — user picks which in Phase 3.
- **Snapshot:** `{type:'CHANNEL', anchors:[a1,a2], style:{...,offset}}`.

### 5.4 Fibonacci retracement — `FIB_RETRACE`

- **Anchors:** 2 — define the price range `[pA (t1), pB (t2)]`.
- **Creation:** click A → drag → click B.
- **Rendering:** horizontal level lines across the span at ratios
  `{0, .236, .382, .5, .618, .786, 1}` (configurable set), each labeled with ratio + price;
  optional band fills. Handles on A and B.
- **Geometry:** `level(r) = pB + (pA − pB)·r` → each level is a **constant** price line (recomputed
  whenever A/B change). `valueAt(_) = level(r)`.
- **Alert levels:** one per enabled ratio — `{ id:'fib_0.618', valueAt:()=>level(0.618) }`, etc.
- **Snapshot:** `{type:'FIB_RETRACE', anchors:[a1,a2], style:{...,levels:number[]}}`.

### 5.5 Fibonacci extension by price — `FIB_EXT`

- **Anchors:** 3 — points P0, P1, P2 (price swing + retrace base).
- **Creation:** three clicks (P0→P1→P2) with preview.
- **Rendering:** projected horizontal levels at ratios `{0, .618, 1.0, 1.272, 1.618, 2.0, 2.618}`
  (configurable), labeled; handles on P0/P1/P2.
- **Geometry:** `projected(r) = P2.price + (P1.price − P0.price)·r` (standard price-extension
  formula) → constant price per level.
- **Alert levels:** one per enabled ratio (e.g. `fib_ext_1.618`).
- **Snapshot:** `{type:'FIB_EXT', anchors:[a0,a1,a2], style:{...,levels:number[]}}`.

### 5.6 Text / annotation — `TEXT`

- **Anchors:** 1 — `{t, price}` anchor point.
- **Creation:** click → inline text input (Radix popover / contentEditable).
- **Rendering:** text box at anchor (background, padding, font from theme); move handle.
- **Hit-test:** point in text bounding box.
- **Geometry / alerts:** **none** — `alertLevels(): []`. Excluded from Phase 3.
- **Snapshot:** `{type:'TEXT', anchors:[a], style:{...,text,fontSize,bg}}`.

---

## 6. Geometry module (pure, shared with Phase 4)

```ts
// geometry/index.ts — no chart/React imports
export function trendlineValueAt(
  a1: Anchor,
  a2: Anchor,
  t: number,
  opts?: {
    extendLeft?: boolean;
    extendRight?: boolean;
  }
): number | null;
export function horizontalValue(price: number): number;
export function channelLevels(
  a1: Anchor,
  a2: Anchor,
  offset: number
): {
  top(t: number): number;
  bottom(t: number): number;
  median(t: number): number;
};
export function fibRetracementLevels(
  a1: Anchor,
  a2: Anchor,
  ratios: number[]
): Record<string, number>;
export function fibExtensionLevels(
  a0: Anchor,
  a1: Anchor,
  a2: Anchor,
  ratios: number[]
): Record<string, number>;
export function levelsForMark(snap: MarkSnapshot): AlertLevel[]; // dispatch by type
```

`levelsForMark` is the single function the Phase 4 worker calls to turn a persisted `Drawing` row
into watchable `AlertLevel[]`. This guarantees client and server compute identical prices.

---

## 7. Serialization (bridge to Phase 2)

`serialization/schema.ts` — **Zod** schemas, the contract for `Drawing.anchors`/`Drawing.style`:

```ts
const AnchorZ = z.object({ time: z.number(), price: z.number().finite() });
const StyleZ = z
  .object({
    color: z.string(),
    lineWidth: z.number().int().min(1).max(10),
    lineStyle: z.enum(['solid', 'dashed', 'dotted']),
  })
  .passthrough(); // tool-specific extras allowed
const SnapshotZ = z.object({
  type: z.enum([
    'TRENDLINE',
    'HLINE',
    'CHANNEL',
    'FIB_RETRACE',
    'FIB_EXT',
    'TEXT',
  ]),
  anchors: z.array(AnchorZ).min(1).max(3),
  style: StyleZ,
});
```

`mark.toSnapshot()` ↔ `SnapshotZ`. Phase 2's API validates with the same schema (server-side reuse).

---

## 8. Styling, theming, rendering conventions

- Pull colors from the existing chart theme (`trading-chart.tsx` palette: bg `#1e222d`, text
  `#d1d4dc`, grid `#2a2e39`, up `#26a69a`, down `#ef5350`); default line color `#2962FF`.
- Always draw in `useBitmapCoordinateSpace`, multiply coords by `horizontalPixelRatio`/
  `verticalPixelRatio` for crispness; reset `setLineDash([])` after dashed strokes.
- Selected marks draw handles (filled dot + white inner) at every anchor; hovered marks show a
  subtle highlight; `zOrder('top')` for the active/selected mark.
- All numeric inputs guarded (`Number.isFinite`); no throws inside `draw()` — fail soft to "skip
  this frame" with a typed early return (not an empty `catch`).

---

## 9. Tool state (state/useDrawingStore.ts)

Minimal **zustand** store (optional but recommended): `{ activeTool, isDrawing, selectedId,
defaultStyle, setTool, select, clear }`. Keeps `DrawingLayer`/`Toolbar` decoupled. Persistence of
the _marks_ is Phase 2; this store is in-memory UI state only.

---

## 10. Integration with the existing chart

- New `<DrawingLayer chart={chartApi} series={candleSeries} symbol timeframe />` mounted by
  `components/charts/trading-chart.tsx` after `chartRef`/`candleSeriesRef` are ready (it already
  holds both refs).
- `DrawingLayer` attaches an absolutely-positioned transparent pointer surface over the chart
  container for event capture; rendering itself is done by attached primitives (no extra canvas).
- `<Toolbar/>` integrates into `components/charts/chart-controls.tsx`.
- On v5 upgrade (Phase 0), `addCandlestickSeries()` → `addSeries(CandlestickSeries, {...})`; the
  series ref type stays `ISeriesApi<'Candlestick'>`.

---

## 11. Testing plan (Phase 1)

- **Unit (Jest)** — `geometry/*` pure functions: trendline interpolation (incl. extend flags &
  out-of-range null), channel offset, fib retracement/extension level math, `levelsForMark`
  dispatch. Highest ROI; also de-risks Phase 4.
- **Unit** — `coords.ts` with a mocked chart/series (priceToCoordinate/timeToCoordinate stubs),
  including the out-of-range `timeToX` fallback.
- **Component (Testing Library)** — tool selection arms the engine; pointer sequence creates a mark;
  esc cancels; drag handle mutates anchors.
- **E2E (Playwright)** — draw each of the 6 tools on a live chart, move/restyle/delete; visual
  snapshot of renders.
- Gate: `npm run validate` (tsc + ESLint + policy + Jest) green.

---

## 12. Definition of done (Phase 1)

1. User can select and draw all 6 tools on the live chart; preview while drawing; finalize on the
   required click count; cancel with Esc.
2. Marks can be selected, moved, handle-edited, restyled (color/width/dash), and deleted.
3. Each mark exposes `toSnapshot()` (anchors in price/time) and `alertLevels()` (empty for TEXT).
4. `geometry/` is pure, fully unit-tested, and importable with no chart/React deps.
5. Marks render crisply at any DPR/zoom and stay anchored on pan/zoom.
6. No `any`, no `_internal__*`, no empty `catch`; `npm run validate` passes.
7. CI license scan passes; zero candleview source present (clean-room).

---

## 13. Clean-room compliance checklist (per mark)

- [ ] Written from this spec, not from candleview files open side-by-side for copy.
- [ ] Public Lightweight Charts v5 API only (no `_internal__*`, no `target._context`).
- [ ] Fully typed; geometry has no framework imports.
- [ ] Behavior verified against acceptance criteria, not against candleview line-by-line.

---

## 14. Open items carried from architecture §11

- Line extent for alerts (ray vs segment) — surfaces here as `extendLeft/extendRight` + per-alert
  option in Phase 3.
- Snap-to-bar vs free time positioning — `PointerController` config flag.
- Whether to add `zustand` (recommended) or use React context for tool state.
