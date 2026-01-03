# Part 20 - Phase 02: MQL5 Service Development

**Purpose:** Create the MQL5 Service that runs inside MT5 terminals to collect indicator data and write to SQLite.

---

## Usage Instructions

1. Start a fresh Claude Code (web) chat
2. Attach these 3 documents:
   - `docs/build-orders/part-20-architecture-design.md`
   - `docs/build-orders/part-20-implementation-plan.md`
   - `docs/open-api-documents/part-20-sqlite-sync-postgresql-openapi.yaml`
3. Copy and paste the prompt below

---

## Phase 02 Prompt

```
# Part 20 - Phase 02: MQL5 Service Development

## Context
I'm implementing Part 20 of Trading Alerts SaaS. Phase 1 (Database Schema) is complete.

This phase creates the MQL5 Service that runs inside MT5 terminals to collect indicator data and write to SQLite.

Please refer to the attached documents:
- `part-20-architecture-design.md` - Section 5.2 (MQL5 Service Details)
- `part-20-implementation-plan.md` - Phase 2 details

## Prerequisites
- Phase 1 completed (SQL schemas exist)
- MT5 terminal with custom indicators installed:
  - Fractal Horizontal Line_V5.mq5
  - Fractal Diagonal Line_V4.mq5
  - Body Size Momentum Candle_V2.mq5
  - Keltner Channel_ATF_10 Bands.mq5
  - TEMA_HRMA_SMA-SMMA_Modified Buffers.mq5
  - ZigZagColor & MarketStructure_JSON Export_V27_TXT Input.mq5

## Your Task
Create the MQL5 Service and supporting include files.

## Files to Create

### 1. `mql5/Services/DataCollector.mq5`
Create MQL5 Service with:
- `#property service` declaration (NOT an EA)
- Input parameters:
  - `CollectionInterval` (int, default 30 seconds)
  - `DatabasePath` (string, default "C:\\MT5Data\\trading_data.db")
- OnStart() function with:
  - DatabaseOpen() to create/open SQLite database
  - Call to CreateTableIfNotExists() for the symbol
  - InitializeIndicators() to get all indicator handles using iCustom()
  - Main loop: `while(!IsStopped())` with Sleep()
  - CollectAndStoreData() called each interval
  - Cleanup: ReleaseIndicators() and DatabaseClose()
- InitializeIndicators() function:
  - Get handles for all 6 custom indicators using iCustom()
  - Return false if any handle is INVALID_HANDLE
- CollectAndStoreData() function:
  - CopyRates() to get OHLC data
  - Call buffer reading functions for each indicator
  - Build INSERT OR REPLACE SQL statement
  - DatabaseExecute() to write to SQLite
- ReleaseIndicators() function:
  - IndicatorRelease() for all handles

### 2. `mql5/Include/IndicatorBuffers.mqh`
Create include file with functions:
- `double GetIndicatorValue(int handle, int buffer_index)` - single value
- `string GetFractalsJSON(int handle)` - JSON with peaks/bottoms arrays
- `string GetHorizontalLinesJSON(int handle)` - JSON with 6 line arrays
- `string GetDiagonalLinesJSON(int handle)` - JSON with 6 line arrays
- `string GetMomentumJSON(int handle)` - JSON array of momentum candles
- `string GetKeltnerJSON(int handle)` - JSON with 10 band arrays
- `string GetZigZagJSON(int handle)` - JSON with peaks/bottoms
- Each function should:
  - Use CopyBuffer() to read indicator buffers
  - Filter out EMPTY_VALUE entries
  - Build proper JSON string
  - Handle errors gracefully

### 3. `mql5/Include/SymbolUtils.mqh`
Create include file with functions:
- `string NormalizeSymbol(string broker_symbol)` - strips suffixes like .i, .pro, m, .raw, .std
- `bool IsSymbolSupported(string symbol)` - checks against 15 supported symbols
- `bool CreateTableIfNotExists(int db, string symbol)` - creates SQLite table with correct schema

## Important Notes
- MQL5 Service runs 24/7 without needing a chart
- Use `#include <IndicatorBuffers.mqh>` and `#include <SymbolUtils.mqh>`
- All JSON must be valid (escape special characters)
- Handle database errors gracefully with Print() logging
- Buffer indices must match the actual indicator implementations

## Success Criteria
- [ ] All MQL5 files compile without errors in MetaEditor
- [ ] Service starts from Tools → Services in MT5
- [ ] SQLite database created at specified path
- [ ] Table created with correct schema
- [ ] Data written every 30 seconds
- [ ] All 13 indicator values captured in correct JSON format
- [ ] Symbol suffix correctly stripped (EURUSD.i → EURUSD)

## Commit Instructions
After creating all files, commit with message:
```
feat(mql5): add DataCollector service for MT5 indicator data

- Add MQL5 Service that runs continuously in MT5 terminal
- Read indicator buffers using CopyBuffer()
- Write to SQLite every 30 seconds
- Handle symbol suffix normalization
- Support all 13 indicators
```
```

---

## Next Step

After Phase 02, proceed to `part-20-phase03-prompts.md` (Sync Script Development).
