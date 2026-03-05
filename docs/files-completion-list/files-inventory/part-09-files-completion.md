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

## Components (5 files)

**File 4/11:** ✅ `components/charts/trading-chart.tsx`

- Renders TradingView-style candlestick chart via `lightweight-charts`
- **Rewritten (2026-03-05):** replaces HTTP polling (`fetch` + `setInterval`) with
  `useOhlcvSocket(symbol, timeframe)` hook for real-time Socket.IO data
- `tier` prop removed — no longer needed for refresh-interval logic
- Header shows live green/red connection status dot instead of "Last updated" timestamp
- Chart data updates whenever the WebSocket hook delivers new OHLCV bars

**File 5/11:** ✅ `components/charts/pro-indicator-overlay.tsx`
**File 6/11:** ✅ `components/charts/indicator-toggles.tsx`
**File 7/11:** ✅ `components/charts/chart-controls.tsx`
**File 8/11:** ✅ `components/charts/timeframe-selector.tsx`

## Hooks (3 files)

**File 9/11:** ✅ `hooks/use-ohlcv-socket.ts` _(added 2026-03-05)_

- Wraps `socket.io-client` for real-time OHLCV streaming from Flask MT5 service
- Connects to `NEXT_PUBLIC_MT5_WS_URL` (default `http://localhost:5001`)
- Lifecycle: emits `subscribe {symbol, timeframe}` on connect; emits `unsubscribe`
  and disconnects on cleanup
- Handles events: `initial_data`, `ohlcv_update`, `connect_error`, `error`
- Returns `{ data: OhlcvSocketData | null, isConnected, isLoading, error }`
- Reconnects automatically (up to 5 attempts, 2s base delay)
- Both FREE and PRO tiers use this hook — no tier-based polling difference

**File 10/11:** ✅ `hooks/use-indicators.ts`

- HTTP-polling hook for full 63-column indicator schema (Part 20 / SQLite-Sync)
- **Not used by `trading-chart.tsx`** — chart OHLCV now comes from `use-ohlcv-socket.ts`
- Still available for future indicator overlay components that read from Part 20

**File 11/11:** ✅ `hooks/use-auth.ts`

## Status Summary

- **Completed:** 11/11 files (100%)
- **Missing:** None

## Notes

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
