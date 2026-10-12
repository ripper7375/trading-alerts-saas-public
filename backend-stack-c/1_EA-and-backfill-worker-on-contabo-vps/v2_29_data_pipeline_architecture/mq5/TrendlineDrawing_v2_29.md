# TrendlineDrawing_v2_29 — Operator & Team User Guide

**Document Version:** 1.1.0  
**Target Audience:** Market Analysts, Chartists, MT5 Administrators, and Pipeline Engineers  
**Target System:** DavinTrade App / Backend Stack C Data Pipeline (16th Indicator)  
**Implementation Source:** [`TrendlineDrawing_v2_29.mq5`](file:///D:/SaaS%20Project/trading-alerts-saas-public/backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_data_pipeline_architecture/mq5/TrendlineDrawing_v2_29.mq5)  
**Export Destination:** `<Terminal Data Folder>/MQL5/Files/Trendline_Drawing_{SYMBOL}_{TF}.txt`

---

## 1. Executive Summary & Purpose

`TrendlineDrawing_v2_29.mq5` serves as the **16th Indicator** in the DavinTrade Stack C data collection pipeline. It empowers market analysts and administrators to draw standard graphical trendlines (`OBJ_TREND`) directly on MetaTrader 5 charts and automatically transforms these visual lines into time-series price data across historical bars up to the live bar (`Bar 0`).

The indicator automatically exports these trendline coordinates into high-speed TSV (Tab-Separated Values) text files every minute, which are then ingested into SQLite (`market_data_v6`), forwarded to the API Gateway, and rendered live on the DavinTrade App.

---

## 2. Key Architecture & Behaviors

### 2.1 The 12 Trendline Slots (`tl_1` to `tl_12`)

The system supports up to **12 independent trendlines** per chart (expanded from 6 to 12 slots), mapped directly into 12 dedicated columns in the data pipeline:

|  Slot Name  | Required Object Name Pattern | Exported Column | Database Column | Suggested Semantic Role            |
| :---------: | :--------------------------: | :-------------: | :-------------: | :--------------------------------- |
| **Slot 1**  |       `Trendline_TL1`        |     `tl_1`      |  `tl_1` (REAL)  | Major Structural Support 1         |
| **Slot 2**  |       `Trendline_TL2`        |     `tl_2`      |  `tl_2` (REAL)  | Major Structural Resistance 1      |
| **Slot 3**  |       `Trendline_TL3`        |     `tl_3`      |  `tl_3` (REAL)  | Primary Channel Boundary (Lower)   |
| **Slot 4**  |       `Trendline_TL4`        |     `tl_4`      |  `tl_4` (REAL)  | Primary Channel Boundary (Upper)   |
| **Slot 5**  |       `Trendline_TL5`        |     `tl_5`      |  `tl_5` (REAL)  | Intermediate Swing Trendline 5     |
| **Slot 6**  |       `Trendline_TL6`        |     `tl_6`      |  `tl_6` (REAL)  | Intermediate Swing Trendline 6     |
| **Slot 7**  |       `Trendline_TL7`        |     `tl_7`      |  `tl_7` (REAL)  | Intermediate Counter-Trendline 7   |
| **Slot 8**  |       `Trendline_TL8`        |     `tl_8`      |  `tl_8` (REAL)  | Intermediate Counter-Trendline 8   |
| **Slot 9**  |       `Trendline_TL9`        |     `tl_9`      |  `tl_9` (REAL)  | Short-Term / Intraday Trendline 9  |
| **Slot 10** |       `Trendline_TL10`       |     `tl_10`     | `tl_10` (REAL)  | Short-Term / Intraday Trendline 10 |
| **Slot 11** |       `Trendline_TL11`       |     `tl_11`     | `tl_11` (REAL)  | Micro Breakout / Wedge Line 11     |
| **Slot 12** |       `Trendline_TL12`       |     `tl_12`     | `tl_12` (REAL)  | Micro Breakout / Wedge Line 12     |

### 2.2 Mathematical Extrapolation Fallback (Auto-Extension to Bar 0)

When drawing trendlines in MT5, chartists do not need to manually extend lines to touch the current live bar (`Bar 0`):

- **If a line stops before Bar 0**: The indicator detects that MT5 returns `EMPTY_VALUE` past the second anchor point. It automatically computes the exact linear slope ($\Delta \text{Price} / \Delta \text{Time}$) between the two anchor points and projects the trendline forward to calculate the exact price at `Bar 0`.
- **If a line extends past Bar 0 into the future**: The export loop terminates strictly at `Bar 0` (current bar). Future coordinates are omitted, guaranteeing the 3,000-bar OHLCV historical alignment without data inflation.
- **Bars prior to line inception**: For historical bars before the earliest anchor time of the trendline, the indicator outputs an empty value (`""`), ensuring historical bars do not receive phantom prices before the trendline was drawn.

### 2.3 Empty Value Handling (`NULL` Mapping)

- Unused slots (e.g., if you only draw `Trendline_TL1` through `Trendline_TL4`, leaving TL5–TL12 empty) export as **empty string fields** (`""` between tabs `\t\t`).
- In the Python data collector (`export_collector_validator_v2.py`), these empty fields are staged as **`NULL`** in SQLite and PostgreSQL.

---

## 3. Step-by-Step Operator Guide

### Step 1: Attach the Indicator to the Chart

1. In MetaTrader 5, open the Navigator panel (`Ctrl + N`).
2. Navigate to **Indicators** and drag **`TrendlineDrawing_v2_29`** onto your target chart (e.g., `XAUUSD`, `M5` or `M15`).
3. Verify the **Inputs** parameters:
   - `InpTrendLinePrefix`: `"Trendline"` _(Default prefix)_
   - `InpExtendTrendlines`: `true` _(Auto-extrapolates short lines to Bar 0)_
   - `InpOnlyAfterStartTime`: `true` _(Suppresses values before origin)_
   - `InpBars`: `3000` _(Default depth matching the OHLCV spine)_
   - `InpAutoExport`: `true` _(Enables automated per-minute export)_
   - `InpExportSecond`: `59` _(Synchronized trigger at second :59)_
4. Click **OK**. A dark slate gray button labelled **`Export TL`** will appear in the top-left corner of the chart.

---

### Step 2: Drawing and Naming Trendlines

1. Select the **Draw Trendline** tool from the MT5 toolbar (or press `Alt + T`, or menu _Insert → Objects → Lines → Trendline_).
2. Draw your trendline across your selected price swing points.
3. Open the trendline's properties:
   - Double-click the trendline to select it (3 small square handles will appear).
   - Right-click the line and select **Trendline Properties...** (or press `Ctrl + B` to open the Object List).
4. Set the **Name** field under the **Common** tab:
   - **Name Format:** Must contain `Trendline_TL<1-12>` (e.g., `Trendline_TL1`, `Trendline_TL7`, `Trendline_TL12`).
   - _Examples of valid names:_
     - `Trendline_TL1`
     - `Trendline_TL8`
     - `Daily_Trendline_TL12`
   - _Examples of INVALID names:_
     - `TL1` _(Missing the `Trendline_` prefix)_
     - `trendline_tl1` _(Case mismatch)_
     - `Trendline_TL13` _(Exceeds maximum slot 12)_
5. Click **OK**.

> [!IMPORTANT]
> **One Trendline Per Slot Rule**: Never assign the same slot number to two different trendlines on the same chart (e.g., having two lines named `Trendline_TL1`). If duplicates are detected, the indicator will display an on-chart alert and log an error to prevent corrupted exports.

---

### Step 3: Triggering and Verifying the Export

There are two ways the indicator exports data:

1. **Manual Export (On-Demand)**:
   - Click the **`Export TL`** button at the top-left of the chart.
2. **Automated Pipeline Export**:
   - Occurs automatically at the 59th second of every minute (`:59`).

#### Checking the Journal Log

Open the **Experts** or **Journal** tab at the bottom of MT5. You should see:

```text
Trendline data successfully exported to: Trendline_Drawing_XAUUSD_M5.txt (3000 bars)
```

#### Inspecting the Output File

1. In MT5, go to **File → Open Data Folder**.
2. Navigate to `MQL5` → `Files`.
3. Open `Trendline_Drawing_XAUUSD_M5.txt` with a text editor.
4. Verify the **16-column TSV format** (4 key columns + 12 trendline slots):
   ```tsv
   tl_timestamp	tl_symbol	tl_timeframe	lt_close	tl_1	tl_2	tl_3	tl_4	tl_5	tl_6	tl_7	tl_8	tl_9	tl_10	tl_11	tl_12
   1788474300	XAUUSD	M5	4475.10000	4480.25000	4470.15000	4490.00000	4460.00000
   1788474600	XAUUSD	M5	4474.72000	4480.20000	4470.20000	4489.80000	4460.30000
   ```

---

## 4. Best Practices & Operating Rules

| Hierarchy Level                 | Recommended Slot Allocation         | Description                                                                  |
| :------------------------------ | :---------------------------------- | :--------------------------------------------------------------------------- |
| **Tier 1: Macro Structure**     | `Trendline_TL1` .. `Trendline_TL4`  | Multi-day or multi-week major swing highs/lows and primary trend channels.   |
| **Tier 2: Intermediate Swings** | `Trendline_TL5` .. `Trendline_TL8`  | Intraday swing corridors, counter-trend corrections, and mid-range channels. |
| **Tier 3: Micro & Breakout**    | `Trendline_TL9` .. `Trendline_TL12` | Flags, wedges, micro-consolidation borders, and immediate trigger lines.     |

- **Anchor Placement:** Place Anchor 1 at the earliest pivot and Anchor 2 at the confirmation pivot.
- **Deleting Lines:** If a trendline is broken or no longer valid, simply delete the object (`Del` key). Its corresponding slot will automatically revert to `NULL` on the very next export cycle.
- **Chart Cleanliness:** Avoid leaving temporary scratch lines named with `Trendline_TL*`.

---

## 5. Troubleshooting & FAQ

### Q1: The alert displays "DUPLICATE TRENDLINE ERROR — TL3". What should I do?

**A:** You have more than one trendline on the chart whose name contains `Trendline_TL3`.

1. Press `Ctrl + B` to open the MT5 **Objects List**.
2. Find the duplicate trendline objects.
3. Rename one of them to an unused slot (e.g., `Trendline_TL7`) or delete the obsolete line.
4. Click **Export TL** to re-validate.

### Q2: Do I need to enable "Ray Right" in the trendline settings?

**A:** No. `TrendlineDrawing_v2_29` has a built-in mathematical extrapolation engine. Whether "Ray Right" is checked or unchecked, the indicator will project the line forward to `Bar 0` automatically.

### Q3: Why are some values empty (`""`) in historical rows?

**A:** If a bar occurred before the trendline's Anchor 1 timestamp, the line did not exist at that time. Writing empty strings (`NULL`) prevents backward look-ahead bias in the pipeline.

### Q4: Does this work on other symbols (e.g., BTCUSD, EURUSD) or other timeframes (H1, M15)?

**A:** Yes. `TrendlineDrawing_v2_29` has no symbol or timeframe locks. It runs seamlessly on any instrument and timeframe configured in your MT5 terminal.

---

## 6. Technical Summary for Pipeline Integration

For backend engineers (Claude Code / Pipeline Team) integrating this source into the collection pipeline:

- **Export Pattern:** `Trendline_Drawing_{SYMBOL}_{TF}.txt`
- **Source Identifier:** `trendline_drawing`
- **Staging Table:** `raw_trendline_drawing`
- **Spine Join Key:** `timestamp_adj`, `symbol`, `timeframe`, `close` (columns 0–3 positional)
- **Data Columns (12):** `tl_1`, `tl_2`, `tl_3`, `tl_4`, `tl_5`, `tl_6`, `tl_7`, `tl_8`, `tl_9`, `tl_10`, `tl_11`, `tl_12` (type: `REAL`, nullable)
- **Total Columns Exported:** 16 columns (4 keys + 12 data values)
- **Database Widening:** Widens `market_data_v6` by +12 columns (from 103 columns $\rightarrow$ **115 columns**)
- **Broadcast Event:** Responds to MT5 custom chart event `CHARTEVENT_CUSTOM + 1000` with `sparam == "EXPORT_ALL"`
- **Time Alignment:** Whole-hour rounded server-to-UTC offset applied at source (Blueprint §7.1 compliant)
