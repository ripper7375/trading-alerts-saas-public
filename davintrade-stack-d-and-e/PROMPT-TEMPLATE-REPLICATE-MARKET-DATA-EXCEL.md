# Prompt Template: Replicate Market Data V6 Excel Database (`market_data_v6_replicated_v<XX>.xlsx`)

> **Instructions for User:**
> Copy the prompt below into a fresh Antigravity session. Replace all occurrences of `<XX>` or `new<XX>` (e.g., `new4`, `v4`, `22 files`) with your current export batch number and file count.

---

_Copy the prompt block below into a new session. Replace `<XX>` with the batch number (e.g. 4),
`<COUNT_OF_FILES>` with the number of exported files (e.g. 22), and `v<xx-1>` with the previous
generator version._

---

```markdown
Hello Antigravity! I need you to replicate and generate an updated mock database Excel file:
`market_data_v6_replicated_v<XX>.xlsx`

Please process all <COUNT_OF_FILES> text files freshly exported into the following directory:
`d:\SaaS Project\trading-alerts-saas-public\davintrade-stack-d-and-e\engine-1-5-new<XX>\`

---

### 📚 1. Key Architectural & Schema Reference Documents

Before writing any code, please inspect and adhere strictly to the project's official schema references:

1. **Official 103-Column Architecture Guide:**
   `d:\SaaS Project\trading-alerts-saas-public\davintrade-stack-d-and-e\MARKET-DATA-V6-103-COLUMNS-AND-MQ5-INDICATORS-REFERENCE-EN.md`
2. **Authoritative Prisma Schema:**
   `d:\SaaS Project\trading-alerts-saas-public\prisma\market-data\schema.prisma`
   - Model `MarketDataV6`: **106 Prisma fields** (103 Contract columns + `id`, `createdAt`, `updatedAt`)
   - Model `IndicatorStatistic`: **88 Prisma fields**
3. **Existing Reference Generator Scripts:**
   - `d:\SaaS Project\trading-alerts-saas-public\davintrade-stack-d-and-e\create_market_data_v6_excel_v<xx-1>.py` (Gold standard reference pattern)

---

### 🎯 2. Deliverables & Output Paths

Generate and save two identical copies of the workbook:

1. `d:\SaaS Project\trading-alerts-saas-public\davintrade-stack-d-and-e\engine-1-5-new<XX>\market_data_v6_replicated_v<XX>.xlsx`
2. `d:\SaaS Project\trading-alerts-saas-public\davintrade-stack-d-and-e\market_data_v6_replicated_v<XX>.xlsx`

Name the Python generator script:
`d:\SaaS Project\trading-alerts-saas-public\davintrade-stack-d-and-e\create_market_data_v6_excel_v<XX>.py`

---

### 📑 3. Required Sheets & Exact Specifications

The Excel file must contain exactly 6 sheets formatted with professional styling:

1. **`market_data_v6`**
   - Contains all combined bars (M5 + M15, 6,000 data rows).
   - Exactly **106 columns** in strict Prisma schema order.
   - Freeze pane: `F2` (Row 1 frozen, first 5 columns frozen).
2. **`market_data_v6_M5`**
   - Micro execution timeframe (3,000 data rows, 106 columns).
   - Populated with M5 OHLCV base spine, M5 Centroids/Indicators (`cherry_a_*`, `fractal_*`, `sr_1`..`sr_8`, `sr_9`..`sr_16`, `body_*`, `zigzag_*`).
3. **`market_data_v6_M15`**
   - Macro structure timeframe (3,000 data rows, 106 columns).
   - Populated with M15 OHLCV base spine, M15 Centroids/Indicators (`non_a_*`, `non_b_*`, `sr_1`..`sr_8`, `body_*`, `zigzag_*`).
4. **`indicator_statistics`**
   - One row per companion `*_Statistic.txt` file present in `engine-1-5-new<XX>\`.
   - Exactly **88 columns** in strict Prisma schema order.
   - Must calculate deterministic SHA256 `config_hash` from the indicator parameters.
   - Freeze pane: `F2`.
5. **`Schema_Dictionary`**
   - Complete data dictionary for `MarketDataV6` (**106 rows** + 1 header row, 8 columns: `Col #`, `Column Name`, `Prisma Type`, `PostgreSQL Type`, `Nullability`, `Category`, `Source Indicator / Component`, `Description & Mathematical Role`).
6. **`Schema_Dict_IndicatorStat`**
   - Complete data dictionary for `IndicatorStatistic` (**88 rows** + 1 header row, 8 columns).

---

### ⚙️ 4. Execution Workflow for Antigravity

1. **Audit Input Directory:**
   - Scan `engine-1-5-new<XX>\` and list all `.txt` files.
   - Categorize them into data files (OHLCV, indicators) vs statistic companion files (`*_Statistic.txt`).
   - Identify latest bar timestamp across `OHLCV_XAUUSD_{M5,M15}.txt` to set `collected_at`, `calculated_at`, and `captured_at`.
2. **Implement Generator Script:**
   - Clone and adapt `create_market_data_v6_excel_v<xx-1>.py` into `create_market_data_v6_excel_v<XX>.py`.
   - Ensure header mapping accommodates all exported indicators in the folder (e.g. `cherry_a`, `non_a`, `non_b`, `best_fit_a/b`, `fractal_edt`, `sr_1..sr_8`, `sr_9..sr_16`, `zscore`, `zigzag`).
   - Ensure all `*_Statistic.txt` files are parsed into `indicator_statistics` rows with appropriate `source` enum and `live_bar_ts`.
3. **Run & Verify:**
   - Execute the Python script using `run_command`.
   - Inspect the generated Excel file using an automated Python verification check:
     - Verify all 6 sheet names exist.
     - Verify column counts (106 for market data sheets, 88 for indicator statistics).
     - Verify row counts (6,000 for combined, 3,000 for M5, 3,000 for M15).
     - Verify populated cell counts for key indicator columns.
     - Verify file sizes (> 1.9 MB) and existence at both destination paths.
4. **Deliver Report:**
   - Summarize the inventory of processed files, sheet statistics, row/col counts, and file locations.
```
