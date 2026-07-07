# Part 9: Charts & Visualization - List of files completion

## App Routes (3 files)

**File 1/11:** ✅ `app/(dashboard)/charts/page.tsx`

**File 2/11:** ✅ `app/(dashboard)/charts/[symbol]/[timeframe]/page.tsx`

- Enforces tier access control (symbol + timeframe) before rendering
- Passes `tier` to `ChartControls` and upgrade UI — does NOT pass `tier` to
  `TradingChartClient` (tier no longer needed there after WebSocket migration)

**File 3/11:** ✅ `app/(dashboard)/charts/[symbol]/[timeframe]/trading-chart-client.tsx`

- Dynamic-imports `TradingChart` (ssr: false) to avoid SSR canvas issues
- Props: `symbol`, `timeframe` only — `tier` prop removed (2026-03-05)

## Components (3 files)

**File 4/8:** ✅ `components/charts/trading-chart.tsx`

- Renders TradingView-style candlestick chart via `lightweight-charts`
- **Rewritten (2026-03-05):** replaces HTTP polling (`fetch` + `setInterval`) with
  `useOhlcvSocket(symbol, timeframe)` hook for real-time Socket.IO data
- `tier` prop removed — no longer needed for refresh-interval logic
- Header shows live green/red connection status dot instead of "Last updated" timestamp
- Chart data updates whenever the WebSocket hook delivers new OHLCV bars

**File 5/8:** ✅ `components/charts/chart-controls.tsx`
**File 6/8:** ✅ `components/charts/timeframe-selector.tsx`

~~**File 7/8:** `components/charts/pro-indicator-overlay.tsx`~~ — **DELETED 2026-07-08** (dead
code: never rendered by any page; modeled the decommissioned 63-column `MarketData` schema)
~~**File 8/8:** `components/charts/indicator-toggles.tsx`~~ — **DELETED 2026-07-08** (same reason)

## Hooks (2 files)

**File 7/8:** ✅ `hooks/use-ohlcv-socket.ts` _(added 2026-03-05)_

- Wraps `socket.io-client` for real-time OHLCV streaming from Flask MT5 service
- Connects to `NEXT_PUBLIC_MT5_WS_URL` (default `http://localhost:5001`)
- Lifecycle: emits `subscribe {symbol, timeframe}` on connect; emits `unsubscribe`
  and disconnects on cleanup
- Handles events: `initial_data`, `ohlcv_update`, `connect_error`, `error`
- Returns `{ data: OhlcvSocketData | null, isConnected, isLoading, error }`
- Reconnects automatically (up to 5 attempts, 2s base delay)
- Both FREE and PRO tiers use this hook — no tier-based polling difference

**File 8/8:** ✅ `hooks/use-auth.ts`

~~`hooks/use-indicators.ts`~~ — **DELETED 2026-07-08** (dead code: exported `useIndicators()` was
never called anywhere; HTTP-polling hook for the decommissioned 63-column indicator schema)

## Multi-Timeframe (MTF) Overlay — PRO-only, V8 (3 files, added 2026-07-07)

**File 9/11:** ✅ `app/api/market-data/channel/route.ts`

- `GET /api/market-data/channel?timeframe=M5&variant=best_fit&limit=300`
- PRO-exclusive (403 for FREE): returns the M5 equal-distance-channel points
  (`{variant}_uoedt`/`_base_fl`/`_loedt`) from `market_data_v6` for a centroid-regression variant
- Backs the "overlay M5 structure on the M15 chart" feature (mirrors the backend-stack-c v2.29
  `mtf_render` design — see `v2_29_multi-timeframe-visualisation-files-completion.md`)

**File 10/11:** ✅ `components/charts/mtf/useMtfOverlay.ts`

- `.ts` hook (backend-tracked per the `.ts`=backend/`.tsx`=frontend convention): fetches the
  channel above and renders 3 `lightweight-charts` line series (upper/mid/lower) on the host chart
- Inert while `enabled=false` — FREE users never fetch

**File 11/11:** ✅ `components/charts/mtf/MtfToggle.tsx` _(frontend UI — tracked in
`frontend-ui-file-inventory.md`, not counted in this Part's backend total below)_

- PRO-gated toggle button rendered on the M15 chart header (`components/charts/trading-chart.tsx`);
  FREE users see a locked control that routes to `/pricing`

## Status Summary

- **Completed:** 10/10 backend files (100%) — 8 original + 2 MTF backend files
  (`app/api/market-data/channel/route.ts`, `components/charts/mtf/useMtfOverlay.ts`)
- **Frontend UI:** `components/charts/mtf/MtfToggle.tsx` tracked separately in
  `frontend-ui-file-inventory.md`
- **Deleted 2026-07-08 (dead code):** `components/charts/pro-indicator-overlay.tsx`,
  `components/charts/indicator-toggles.tsx`, `hooks/use-indicators.ts` — see the Notes section
- **Missing:** None

## Notes

- **Updated (2026-07-08):** Removed 3 dead-code files traced during the V8 cleanup pass —
  `components/charts/pro-indicator-overlay.tsx`, `components/charts/indicator-toggles.tsx`, and
  `hooks/use-indicators.ts`. All three modeled the decommissioned 63-column `MarketData` schema
  and were confirmed unreachable from any live page or called hook. Verified with a clean
  `tsc --noEmit` and full Jest run (111 suites, 2046 tests) after removal. Full detail in
  `backend-file-inventory.md`'s and `frontend-ui-file-inventory.md`'s 2026-07-08 reconciliation
  notes.
- **Updated (2026-07-07):** V8 single-symbol architecture (`change-to-new-design.md`) — added
  the PRO-only multi-timeframe (MTF) overlay: `app/api/market-data/channel/route.ts`,
  `components/charts/mtf/{useMtfOverlay.ts,MtfToggle.tsx}`. `components/charts/trading-chart.tsx`
  wires the toggle in on the M15 chart only (overlaying M5 on its own chart is a no-op).
  `components/charts/chart-controls.tsx` PRO-upsell copy updated (symbols/timeframes counts
  replaced with alerts/line-alerts/MTV feature list, since chart access itself is no longer
  tier-gated).
- File inventory updated on 2026-01-24
- Removed: `components/charts/indicator-overlay.tsx` (does not exist in codebase)
- Added: `app/(dashboard)/charts/[symbol]/[timeframe]/trading-chart-client.tsx` (client component for chart rendering)
- **Updated (2026-03-05):** WebSocket migration
  - Added `hooks/use-ohlcv-socket.ts` — Socket.IO client hook for live OHLCV
  - Rewrote `components/charts/trading-chart.tsx` — HTTP polling removed, WebSocket consumed
  - Removed `tier` prop from `TradingChart` and `TradingChartClient` (was only used for polling interval)
  - `trading-chart-client.tsx` and `page.tsx` updated to match new prop contract
  - Both FREE and PRO tiers receive real-time chart updates with no polling interval

## OHLCV Update Behaviour (Post-WebSocket Migration)

```
Browser tab opens /charts/EURUSD/H1
    ↓
useOhlcvSocket('EURUSD', 'H1') connects to Flask Socket.IO
    ↓
Flask: emits initial_data (full 1000-bar history) immediately
    ↓
Flask background loop (0.25s): fetches MT5 data for EURUSD_H1 room
    ├─ New H1 bar opened?   → emit ohlcv_update
    ├─ Current bar close changed (tick)? → emit ohlcv_update
    └─ No change?           → no push, no bandwidth
    ↓
Browser receives ohlcv_update → lightweight-charts re-renders live candle
```

| Scenario | Push rate |
|---|---|
| Active liquid pair, trading hours | Multiple pushes/second |
| Quiet pair or off-hours | Sparse, possibly minutes apart |
| Market closed | Zero pushes |
| No browser tab on that chart | Zero fetches (room does not exist) |
