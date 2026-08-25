# Technical Specification: Chart Controls, EDT Configuration & Multi-Timeframe Visualization

**Target Milestone:** Post-Session 8-5 (UI Polish & Chart Enhancements Phase)  
**Execution Target:** Claude Code (Executor)  
**Seed Code Reference:** `D:\SaaS Project\trading-alerts-saas-public\seed-code\trading-conversational-ai-ui-pages-increment\`  
**Primary Target Files:** `components/charts/trading-chart.tsx`, `app/terminal/terminal-workspace.tsx`, `components/charts/mtf/*`

---

## 📌 1. Executive Summary & Purpose

This specification defines the exact, sequential implementation plan for porting the **Dual-Chart (2-Chart) Split Layout**, **Equal Distance Channel (EDT) Configuration Popover**, **Price Display Modes (Bar/Candle/Hide)**, and **Multi-Timeframe (MTF) Visualization Controls** from the reference seed codebase (`seed-code/trading-conversational-ai-ui-pages-increment`) into the active production trading terminal.

> [!IMPORTANT]
> **Strict Execution Order:**  
> The **Dual-Chart (2-Chart) Layout (Upper M5 + Lower M15)** must be refactored **FIRST** before adding the respective header controls and configuration popovers onto the individual chart windows.

---

## ⚙️ 2. Section 1: Backend EDT Architecture & Calculation Mechanism

### 2.1 Upstream Mathematical Calculation Pipeline

In the DavinTrade architecture, heavy quantitative calculations (including Equal Distance Channel regressions, SSA smoothing, and centroid touch-point optimizations) are **pre-calculated upstream** by the MT5 Terminal & Python pipeline on the Contabo Windows VPS and ingested via `railway-gateway` into PostgreSQL:

```
[ MT5 Terminals (XAUUSD M5/M15) ]
       │
       ▼ (Calculates 13 indicator lines & 6 Centroid Variants)
[ Contabo SQLite Buffer (Rolling 3,000 bars) ]
       │
       ▼ (Python Push Worker ➔ HTTPS)
[ railway-gateway (NestJS Ingestion Microservice) ]
       │
       ▼ (UPSERT into 79-column table)
[ PostgreSQL: market_data_v6 ]
```

### 2.2 The 6 Pre-Calculated Centroid-Regression Variants

The `market_data_v6` table stores all calculated bands across **6 distinct Centroid-Regression variants** (defined in `types/indicator.ts` and `prisma/market-data/schema.prisma`):

| Centroid Variant           | Upper Band Column   | Lower Band Column   | Base Line Column      | Mathematical Intent                                     |
| :------------------------- | :------------------ | :------------------ | :-------------------- | :------------------------------------------------------ |
| **`best_fit`** _(Default)_ | `best_fit_uoedt`    | `best_fit_loedt`    | `best_fit_base_fl`    | Global optimal fit across the lookback window           |
| **`cherry_a`**             | `cherry_a_uoedt`    | `cherry_a_loedt`    | `cherry_a_base_fl`    | Selective structural swing anchor variant A             |
| **`cherry_b`**             | `cherry_b_uoedt`    | `cherry_b_loedt`    | `cherry_b_base_fl`    | Selective structural swing anchor variant B             |
| **`most_recent`**          | `most_recent_uoedt` | `most_recent_loedt` | `most_recent_base_fl` | Highest weighting on the latest structural swing pivots |
| **`non_a`**                | `non_a_uoedt`       | `non_a_loedt`       | `non_a_base_fl`       | Non-standard centroid model variant A                   |
| **`non_b`**                | `non_b_uoedt`       | `non_b_loedt`       | `non_b_base_fl`       | Non-standard centroid model variant B                   |
| **`fractal`**              | `fractal_uoedt`     | `fractal_loedt`     | `fractal_best_fl`     | Multi-fractal dynamic envelope                          |

### 2.3 Scope & Role of the "EDT Configuration" UI Popover

The UI **`EDT Configuration`** button does **not** trigger real-time heavy server-side recalculation. Instead, it provides a high-performance **Model Selector and Visualization Filter**:

1. **Centroid Model Selection:** Switch between `best_fit`, `most_recent`, `cherry_a`, `cherry_b`, `non_a`, `non_b`.
2. **Channel Bands Visibility:** Toggle Upper EDT (`uoedt`), Lower EDT (`loedt`), and Base Fit Line (`base_fl`).
3. **Parameter Display:** Inspect channel width (in pips), SSA smoothing factor, and regression fit score ($R^2$).
4. **Color & Styling Customization:** Adjust band line width, opacity, and color palette via `useChartAppearance()`.

---

## 📊 3. Section 2: Multi-Timeframe (MTF) Visualization Stack on Railway

### 3.1 Backend Service Status: 100% Complete & Live

The Multi-Timeframe stack on Railway (`operation-service` and Next.js BFF proxy) is already built, tested, and verified under Slice 12:

- **Endpoint:** `GET /api/market-data/channel`
- **Query Parameters:**
  - `symbol`: e.g. `XAUUSD`
  - `timeframe`: Source timeframe for channel structure (e.g. `M5`)
  - `variant`: Selected centroid variant (default: `best_fit`)
  - `limit`: Number of bars (default: `300`)
- **Response Schema:**
  ```json
  {
    "success": true,
    "symbol": "XAUUSD",
    "timeframe": "M5",
    "variant": "best_fit",
    "points": [
      { "time": 1741234500, "upper": 2652.43, "mid": 2641.67, "lower": 2628.43 }
    ]
  }
  ```

### 3.2 Client Hook & Component Ready

- **Hook:** `components/charts/mtf/useMtfOverlay.ts` — Fetches the M5 channel and adds 3 line series (`upper`, `mid`, `lower`) to the target chart.
- **Component:** `components/charts/mtf/MtfToggle.tsx` — Pre-built toggle button with PRO-tier gating.

---

## 🎨 4. Section 3: Post-Session 8-5 UI Implementation Blueprint

> **Reference Source Code:**  
> Refer directly to `seed-code/trading-conversational-ai-ui-pages-increment/components/trading-chart.tsx` (Lines 470–800) and `seed-code/trading-conversational-ai-ui-pages-increment/app/terminal/page.tsx` for the exact reference implementation.

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                                 PANEL C: TRADING WORKBENCH                               │
│                                                                                          │
│  [ Top Global Banner Bar ] (Lines 470–500 in seed-code)                                  │
│    ├─ Symbol Badge: `XAUUSD`                                                             │
│    ├─ View Switch Tabs: `M5 SSA & EDT Chart` / `M15 ZigZag Chart`                        │
│    ├─ Multi-Timeframe Switch: `[Switch] M5 on M15` (PRO lock icon)                       │
│    └─ Action Button: `[Auto-Refresh]`                                                    │
│                                                                                          │
│  [ ResizablePanelGroup direction="vertical" ] (Lines 502–800 in seed-code)               │
│                                                                                          │
│  ┌────────────────────────────────────────────────────────────────────────────────────┐  │
│  │ 📈 UPPER CHART WINDOW: XAUUSD, M5 (Fixed M5)                                       │  │
│  │  ├─ Top-Left: Badge `🟢 XAUUSD,M5` + `M5 SSA & EDT Channel Canvas`                  │  │
│  │  ├─ Left: Vertical Drawing Tools Strip (6 Tools + Delete Mark)                     │  │
│  │  └─ Top-Right: [Bar | Candle | Hide] + [Sliders: EDT Configuration Popover]        │  │
│  └────────────────────────────────────────────────────────────────────────────────────┘  │
│  ═════════════════════════ [ Reciprocal Resizable Divider ] ══════════════════════════   │
│  ┌────────────────────────────────────────────────────────────────────────────────────┐  │
│  │ 📉 LOWER CHART WINDOW: XAUUSD, M15 (Fixed M15)                                     │  │
│  │  ├─ Top-Left: Badge `🟢 XAUUSD,M15` + `M15 ZigZag & Trend Canvas`                  │  │
│  │  ├─ Left: Vertical Drawing Tools Strip (6 Tools + Delete Mark)                     │  │
│  │  └─ Top-Right: [Bar | Candle | Hide] + [Sliders: EDT Configuration Popover]        │  │
│  └────────────────────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

### 4.1 Step 1 (Prerequisite): Refactor to Dual-Chart Layout

In `app/terminal/terminal-workspace.tsx` (or `components/charts/trading-chart.tsx`), replace the single-chart canvas with a vertical `ResizablePanelGroup` splitting M5 (Top) and M15 (Bottom):

```tsx
// Reference: seed-code/components/trading-chart.tsx (Lines 502–509 & 650–660)
<ResizablePanelGroup
  direction="vertical"
  className="flex-1 overflow-hidden bg-slate-100 p-1 dark:bg-black/80"
>
  {/* Upper Window: Fixed XAUUSD M5 */}
  <ResizablePanel defaultSize={50} minSize={20}>
    <div className="relative h-full w-full overflow-hidden rounded-lg border border-blue-900/40 shadow-lg">
      <ChartCanvas timeframe="M5" symbol="XAUUSD" />
      <DrawingToolbar />
      <ChartHeaderControls timeframe="M5" />
    </div>
  </ResizablePanel>

  <ResizableHandle withHandle />

  {/* Lower Window: Fixed XAUUSD M15 */}
  <ResizablePanel defaultSize={50} minSize={20}>
    <div className="relative h-full w-full overflow-hidden rounded-lg border border-blue-900/40 shadow-lg">
      <ChartCanvas timeframe="M15" symbol="XAUUSD" />
      <DrawingToolbar />
      <ChartHeaderControls timeframe="M15" />
    </div>
  </ResizablePanel>
</ResizablePanelGroup>
```

### 4.2 Step 2: Implement Top Global Banner Controls

In `components/charts/trading-chart.tsx` (mirroring lines 470–500 in seed-code):

```tsx
<div className="flex items-center gap-3">
  {/* Multi-Timeframe M5 on M15 Toggle */}
  <div className="flex items-center gap-2 rounded-lg border px-2.5 py-1">
    <Switch
      id="m5-on-m15-toggle"
      checked={isM5OnM15 && tier === 'PRO'}
      onCheckedChange={handleToggleM5OnM15}
      className="data-[state=checked]:bg-cyan-500"
    />
    <label
      htmlFor="m5-on-m15-toggle"
      className="flex items-center gap-1.5 text-xs font-bold"
    >
      <span>M5 on M15</span>
      {tier === 'FREE' && <Lock className="h-3 w-3 text-amber-400" />}
    </label>
  </div>

  {/* Auto-Refresh Button */}
  <Button variant="outline" size="sm" className="h-8 text-xs font-medium">
    <RefreshCw className="mr-1.5 h-3.5 w-3.5 text-emerald-400" />
    Auto-Refresh
  </Button>
</div>
```

### 4.3 Step 3: Implement Individual Chart Top-Right Controls

In each chart window (mirroring lines 540–620 in seed-code):

```tsx
<div className="absolute right-2.5 top-2.5 z-20 flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white/90 p-1 shadow-md backdrop-blur-md dark:border-slate-800 dark:bg-[#080b12]/90">
  {/* 3 Price View Modes: Bar / Candle / Hide */}
  <div className="flex items-center rounded border border-slate-200 bg-slate-100 p-0.5 dark:bg-black/40">
    <Button
      variant="ghost"
      size="icon"
      className={cn(
        'h-6 w-6',
        priceMode === 'BAR' && 'bg-blue-600/30 text-blue-700 dark:text-blue-300'
      )}
      onClick={() => setPriceMode('BAR')}
      title="Show Price Bar"
    >
      <BarChart2 className="h-3.5 w-3.5" />
    </Button>
    <Button
      variant="ghost"
      size="icon"
      className={cn(
        'h-6 w-6',
        priceMode === 'CANDLE' &&
          'bg-blue-600/30 text-blue-700 dark:text-blue-300'
      )}
      onClick={() => setPriceMode('CANDLE')}
      title="Show Price Candle"
    >
      <CandlestickChart className="h-3.5 w-3.5" />
    </Button>
    <Button
      variant="ghost"
      size="icon"
      className={cn(
        'h-6 w-6',
        priceMode === 'HIDE' && 'bg-rose-600/30 text-rose-300'
      )}
      onClick={() => setPriceMode('HIDE')}
      title="Hide Price (Indicators Only)"
    >
      <EyeOff className="h-3.5 w-3.5" />
    </Button>
  </div>

  {/* EDT Configuration Popover */}
  <Popover>
    <PopoverTrigger asChild>
      <Button
        size="sm"
        className="h-7 border border-slate-300 bg-slate-100 text-[11px] font-bold text-slate-800 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:bg-slate-700"
      >
        <Sliders className="mr-1 h-3 w-3 text-amber-400" />
        EDT Configuration
      </Button>
    </PopoverTrigger>
    <PopoverContent className="w-64 space-y-2 border-slate-200 bg-white p-3 text-xs text-slate-800 dark:bg-[#121622] dark:text-slate-200">
      <div className="border-b border-slate-200 pb-1 font-bold text-amber-600 dark:border-slate-800 dark:text-amber-400">
        {timeframe} EDT Parameters
      </div>
      <div className="space-y-1">
        <Label className="text-[11px]">Centroid Model Variant</Label>
        <Select
          value={selectedVariant}
          onValueChange={(v) => setSelectedVariant(v as CentroidVariant)}
        >
          <SelectTrigger className="h-7 text-xs">
            <SelectValue placeholder="Select Variant" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="best_fit">Best Fit (Optimal)</SelectItem>
            <SelectItem value="most_recent">Most Recent Swing</SelectItem>
            <SelectItem value="cherry_a">Cherry Pick A</SelectItem>
            <SelectItem value="cherry_b">Cherry Pick B</SelectItem>
            <SelectItem value="non_a">Non-A Model</SelectItem>
            <SelectItem value="non_b">Non-B Model</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </PopoverContent>
  </Popover>
</div>
```

---

## 📋 5. Implementation & Verification Checklist for Claude Code

When implementing this specification post-Session 8-5, execute in strict sequence:

### Phase 1: Dual-Chart Layout Refactoring (FIRST)

- [ ] Refactor Panel C in `app/terminal/terminal-workspace.tsx` / `components/charts/trading-chart.tsx` to mount `ResizablePanelGroup direction="vertical"`.
- [ ] Set Upper Panel to fixed `M5` and Lower Panel to fixed `M15`.
- [ ] Verify both chart canvases resize smoothly via `ResizableHandle withHandle`.

### Phase 2: Top Banner & Individual Header Controls Port

- [ ] Port the Top Banner from `seed-code/components/trading-chart.tsx` (Lines 470–500): `M5 on M15` Switch + `Auto-Refresh` button.
- [ ] Port the 3 Price View Modes (`BAR` / `CANDLE` / `HIDE`) onto both M5 and M15 chart headers (Lines 540–581).
- [ ] Port the `EDT Configuration` Popover with `CentroidVariant` selector onto both chart headers (Lines 583–620).

### Phase 3: Live Verification & Test Suite

- [ ] Verify M5 and M15 charts simultaneously receive live OHLCV price ticks via WebSocket.
- [ ] Verify toggling `M5 on M15` triggers `useMtfOverlay` and draws the gold/grey channel overlay on the M15 chart.
- [ ] Run `npm run test:ci` ensuring all 259+ test suites remain 100% green.
