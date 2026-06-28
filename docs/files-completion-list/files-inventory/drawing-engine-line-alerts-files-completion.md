# Drawing Engine & Line-Touch Alerts - List of files completion

**Source stack:** `davintrade-draw-engine-and-line-alerts-stack/`
**Source directory listing:** `davintrade-draw-engine-and-line-alerts-stack/implementation-progress/implementation-progress-files-and-folder-directory.txt`
**Scope:** Clean-room drawing engine on TradingView Lightweight Charts v5 (6 tools) plus the
client-side scaffolding for line-touch alerts.

---

## Phase 1 — Geometry primitives (8 files)

Pure geometry/math modules (no rendering). Categorized as backend (`.ts` logic).

**File 1/8:** ✅ `components/charts/drawing/geometry/types.ts` _(NEW)_
**File 2/8:** ✅ `components/charts/drawing/geometry/trendline.ts` _(NEW)_
**File 3/8:** ✅ `components/charts/drawing/geometry/horizontal.ts` _(NEW)_
**File 4/8:** ✅ `components/charts/drawing/geometry/channel.ts` _(NEW)_
**File 5/8:** ✅ `components/charts/drawing/geometry/fib.ts` _(NEW)_
**File 6/8:** ✅ `components/charts/drawing/geometry/levels.ts` _(NEW; later MODIFIED in Phase 4)_
**File 7/8:** ✅ `components/charts/drawing/geometry/index.ts` _(NEW)_
**File 8/8:** ✅ `__tests__/drawing/geometry/geometry.test.ts` _(NEW; test)_

## Phase 2 — Engine core & first marks (9 files)

**File 1/9:** ✏️ `package.json` _(MODIFIED; one-line: `lightweight-charts` `^4.1.1` → `^5.2.0`)_
**File 2/9:** ✏️ `components/charts/trading-chart.tsx` _(MODIFIED — already inventoried, frontend UI)_
**File 3/9:** ✏️ `components/charts/pro-indicator-overlay.tsx` _(MODIFIED — already inventoried, frontend UI)_
**File 4/9:** ✅ `components/charts/drawing/types.ts` _(NEW)_
**File 5/9:** ✅ `components/charts/drawing/engine/coords.ts` _(NEW)_
**File 6/9:** ✅ `components/charts/drawing/engine/pixelMath.ts` _(NEW)_
**File 7/9:** ✅ `components/charts/drawing/marks/BaseMark.ts` _(NEW)_
**File 8/9:** ✅ `components/charts/drawing/marks/HorizontalLineMark.ts` _(NEW)_
**File 9/9:** ✅ `components/charts/drawing/marks/TrendlineMark.ts` _(NEW)_

Plus test: ✅ `__tests__/drawing/engine/pixelMath.test.ts` _(NEW; test)_

## Phase 3 — Drawing engine, toolbar & layer (6 files)

**File 1/6:** ✏️ `components/charts/trading-chart.tsx` _(MODIFIED — already inventoried, frontend UI)_
**File 2/6:** ✅ `components/charts/drawing/Toolbar.tsx` _(NEW; frontend UI)_
**File 3/6:** ✅ `components/charts/drawing/DrawingLayer.tsx` _(NEW; frontend UI)_
**File 4/6:** ✅ `components/charts/drawing/tools/index.ts` _(NEW; later MODIFIED in Phase 4)_
**File 5/6:** ✅ `components/charts/drawing/engine/DrawingEngine.ts` _(NEW)_
**File 6/6:** ✅ `components/charts/drawing/engine/PointerController.ts` _(NEW)_

Plus test: ✅ `__tests__/drawing/engine/DrawingEngine.test.ts` _(NEW; test)_

## Phase 4 — Remaining marks (channel, fib, text) (5 files)

**File 1/5:** ✅ `components/charts/drawing/marks/ChannelMark.ts` _(NEW)_
**File 2/5:** ✅ `components/charts/drawing/marks/FibRetracementMark.ts` _(NEW)_
**File 3/5:** ✅ `components/charts/drawing/marks/FibExtensionMark.ts` _(NEW)_
**File 4/5:** ✅ `components/charts/drawing/marks/TextMark.ts` _(NEW)_
**File 5/5:** ✏️ `components/charts/drawing/geometry/levels.ts` _(MODIFIED)_

Also modified in Phase 4: `components/charts/drawing/tools/index.ts`, `components/charts/drawing/Toolbar.tsx`

Plus test: ✅ `__tests__/drawing/marks/newMarks.test.ts` _(NEW; test)_

## Status Summary

- **New backend (`.ts`) files:** 20 (geometry 6 + types 1, engine 4, marks 7, drawing/types 1, tools/index 1)
- **New backend test files:** 4
- **New frontend UI (`.tsx`) files:** 2 (`Toolbar.tsx`, `DrawingLayer.tsx`)
- **Modified existing files:** `package.json`, `components/charts/trading-chart.tsx`, `components/charts/pro-indicator-overlay.tsx`

## Categorization Notes

Per the repo convention used by `backend-file-inventory.md` and `frontend-ui-file-inventory.md`:

- **Frontend UI inventory** holds `.tsx` files that render app UI / allow user interaction
  (pages, components, layouts). Here: `Toolbar.tsx`, `DrawingLayer.tsx`.
- **Backend inventory** holds everything else, including `.ts` logic modules (geometry math,
  engine, marks renderers), type definitions, and `__tests__/**`. The drawing `marks/*.ts`
  paint onto a canvas but are `.ts` logic modules with no JSX, so they follow the same
  convention as hooks (`.ts`) and are inventoried as backend.

---

## Root ↔ frontend/ Parity Note (2026-06-27)

Verified that the drawing-engine code is **in sync** between the root monolith and the
transitional `frontend/` clone: all 22 `components/charts/drawing/*` files are byte-identical, as
are the modified `components/charts/trading-chart.tsx` and `components/charts/pro-indicator-overlay.tsx`.

One related dependency was reconciled separately: the WebSocket-migrated `trading-chart.tsx`
imports `@/hooks/use-ohlcv-socket`, which was missing from `frontend/` and has now been added
there (tracked in `backend-file-inventory.md`, row 89). No drawing-engine file needed changes.

---

## Phase 5 — Drawing persistence + Line-touch alerts (2026-06-28)

Pushed to `main`. Backend stays in root and is reached from `frontend/` via api-client; the
client-side files were mirrored into `frontend/`.

### Persistence layer

- **Backend:** ✅ `prisma/schema.prisma` _(MODIFIED — Drawing + DrawingAlert models, relations)_,
  ✅ `types/prisma-stubs.d.ts` _(MODIFIED)_, ✅ `lib/drawing/schema.ts` _(NEW — shared Zod + tier
  limits)_, ✅ `lib/drawing/invalidate.ts` _(NEW — `alerts:changed` publisher)_,
  ✅ `app/api/drawings/route.ts` + `app/api/drawings/[id]/route.ts` _(NEW)_.
- **Frontend (`.ts`/`.tsx`):** ✅ `components/charts/drawing/persistence.ts` _(NEW)_,
  ✅ `DrawingLayer.tsx` + `components/charts/trading-chart.tsx` _(MODIFIED)_.

### Alert dialog & style/alerts panel (UI)

- ✅ `components/charts/drawing/AlertDialog.tsx`, `AlertsPanel.tsx`, `StyleEditor.tsx` _(NEW `.tsx`
  UI → frontend-ui inventory rows 155–157)_; `alertsApi.ts`, `tierUsage.ts` _(NEW `.ts` → backend)_;
  `Toolbar.tsx`, `DrawingLayer.tsx`, `engine/DrawingEngine.ts` _(MODIFIED)_.

### Alert engine (backend) & realtime delivery

- ✅ `lib/alert-engine/*` — `types.ts`, `detect.ts`, `state.ts`, `watches.ts`, `evaluator.ts`,
  `dispatcher.ts`, `worker.ts`, `notify-bridge.ts`, `queue.ts` _(NEW)_;
  ✅ `scripts/alert-worker.ts` _(NEW standalone entrypoint)_;
  ✅ `lib/websocket/server.ts`, `hooks/use-websocket.ts` _(MODIFIED)_;
  ✅ `components/charts/drawing/firedMarkers.ts`, `useFiredAlertMarkers.ts` _(NEW frontend)_;
  ✅ `mt5-service/REDIS-PUBLISH-SNIPPET.md` _(NEW)_.
- **Deps:** `package.json` adds `bullmq` + `@socket.io/redis-adapter` (backend worker/scaling).
- **Specs:** `docs/PHASE-5-DELIVERY-AND-REALTIME-SPEC.md`, `docs/SCALING-BULLMQ-AND-SOCKET-ADAPTER.md`.

### Tests

- ✅ `__tests__/drawing/{persistence,alertsApi,tierUsage,firedMarkers}.test.ts` _(NEW)_,
  `marks/newMarks.test.ts` _(MODIFIED)_.
- ✅ `__tests__/alert-engine/{detect,evaluator,watches,notify-bridge}.test.ts` _(NEW)_.

### Inventory impact

- **frontend-ui-file-inventory.md:** +3 UI rows (AlertDialog, AlertsPanel, StyleEditor) → 157.
- **backend-file-inventory.md:** +32 rows (501–532) under Parts "Drawing Engine" and "Line Alerts".
- **Root ↔ frontend/ parity re-verified** for the whole `components/charts/drawing/` folder,
  `trading-chart.tsx`, `hooks/use-websocket.ts`, and `lib/drawing/schema.ts` (all byte-identical;
  import closure in `frontend/` resolves with 0 missing).

---

**Compiled:** 2026-06-28
**Status:** Complete ✅
