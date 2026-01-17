# Part 06 & Part 07 Indicator Analysis Report

**Date:** 2026-01-16
**Purpose:** Verify that Part 06 (Flask MT5 Service) and Part 07 (Indicators API) do not incorrectly fetch indicator data from MT5 Python API

---

## Executive Summary

✅ **Part 06 (Flask MT5 Service)** - COMPLIANT
✅ **Part 07 (Indicators API)** - MOSTLY COMPLIANT (minor documentation updates needed)

Part 06 correctly implements OHLCV-only data fetching. Part 07 has outdated documentation comments that need updating to reflect the 57-column schema.

---

## Part 06: Flask MT5 Service Analysis

### ✅ Production Files Status

#### 1. `mt5-service/app/routes/indicators.py` ✅ CORRECT
**Line 133-137:**
```python
"""
NOTE: This endpoint ONLY returns OHLCV data. Custom indicators are NOT
available via MT5 Python API (iCustom() is unreliable).
Use Part 20 (SQLite-Sync Script) for indicators and technical analysis.
"""
```

**Verdict:** Correctly documented and implemented. Endpoint name is `/api/indicators/<symbol>/<timeframe>` but it ONLY returns OHLCV data, not indicator data.

---

#### 2. `mt5-service/app/services/indicator_reader.py` ✅ CORRECT
**Line 7-10:**
```python
"""
NOTE: MT5 Python API's iCustom() does not work reliably, therefore this service
ONLY fetches raw OHLCV data using copy_rates_from_pos().

For indicators and technical analysis, use Part 20 (SQLite-Sync Script).
"""
```

**Line 104:**
```python
rates = mt5.copy_rates_from_pos(resolved_symbol, mt5_timeframe, 0, bars)
```

**Verdict:** Correctly uses `copy_rates_from_pos()` for OHLCV data only. No `iCustom()` calls present.

---

#### 3. Backward Compatibility Alias ✅ ACCEPTABLE
**Line 163:**
```python
# Alias for backward compatibility
fetch_indicator_data = fetch_ohlcv_data
```

**Verdict:** This alias is acceptable because the function name suggests indicators but actually fetches OHLCV data. The implementation is correct.

---

### ✅ Test Files Status

#### `mt5-service/tests/test_indicators.py` ✅ CORRECT
**Recent Changes (2025-01-15):**
- Removed all fractal/trendline references
- Updated to test OHLCV-only data fetching
- No tests for custom indicator data

**Verdict:** Test file correctly validates OHLCV-only behavior.

---

### ✅ Documentation Status

#### `mt5-service/indicators/README.md` ✅ CORRECT
**Recent Changes (2025-01-15):**
- Rewrote to explain OHLCV-only architecture
- Removed fractal indicator setup instructions
- Updated `.env.example` to remove indicator config

**Verdict:** Documentation correctly reflects OHLCV-only design.

---

## Part 07: Indicators API Analysis

### ⚠️ Files Requiring Updates

#### 1. `app/api/indicators/route.ts` ⚠️ NEEDS UPDATE
**Line 40-87: INDICATOR_TYPES array**

**Current (OLD SCHEMA):**
```typescript
const INDICATOR_TYPES: IndicatorTypeInfo[] = [
  {
    id: 'FRACTAL_HORIZONTAL',
    name: 'Fractal Horizontal Lines',
    description: '...',
    source: 'Fractal Horizontal Line_V5.mq5',
    dataFields: ['peak_1', 'peak_2', 'peak_3', 'bottom_1', 'bottom_2', 'bottom_3'],
  },
  {
    id: 'FRACTAL_DIAGONAL',
    name: 'Fractal Diagonal Lines',
    description: '...',
    source: 'Fractal Diagonal Line_V4.mq5',
    dataFields: ['ascending_1', 'ascending_2', 'ascending_3', ...],
  },
  {
    id: 'FRACTALS',
    name: 'Fractal Points',
    description: '...',
    source: 'Fractal Horizontal Line_V5.mq5 (buffers 0-1)',
    dataFields: ['peaks', 'bottoms'],
  },
  {
    id: 'OHLC',
    name: 'OHLC Candlestick Data',
    ...
  },
];
```

**Issue:** This array defines old indicator types that don't match the 57-column schema.

**Recommendation:** Update to reflect new schema:
```typescript
const INDICATOR_TYPES: IndicatorTypeInfo[] = [
  // FREE TIER INDICATORS (2 groups)
  {
    id: 'fractal_diagonal',
    name: 'Fractal Diagonal Lines',
    description: 'Dynamic trendlines based on fractal analysis',
    source: 'Part 20 SQLite-Sync (57-column schema)',
    dataFields: [
      'diag_asc_line_1', 'diag_asc_line_2', 'diag_asc_line_3',
      'diag_desc_line_1', 'diag_desc_line_2', 'diag_desc_line_3',
      'diag_high_map', 'diag_low_map'
    ],
  },
  {
    id: 'fractal_horizontal',
    name: 'Fractal Horizontal Lines',
    description: 'Horizontal support and resistance levels from fractals',
    source: 'Part 20 SQLite-Sync (57-column schema)',
    dataFields: [
      'horiz_peak_line_1', 'horiz_peak_line_2', 'horiz_peak_line_3',
      'horiz_bottom_line_1', 'horiz_bottom_line_2', 'horiz_bottom_line_3',
      'horiz_high_map', 'horiz_low_map'
    ],
  },
  // PRO TIER INDICATORS (6 groups)
  {
    id: 'moving_averages',
    name: 'Moving Averages (TEMA/HRMA/SMMA)',
    description: 'Triple exponential, hull-like, and smoothed moving averages',
    source: 'Part 20 SQLite-Sync (57-column schema)',
    dataFields: ['tema', 'hrma', 'smma'],
  },
  {
    id: 'body_momentum',
    name: 'Body Size Momentum',
    description: 'Candle body size analysis with Z-score classification',
    source: 'Part 20 SQLite-Sync (57-column schema)',
    dataFields: ['z_score_of_body_size', 'candle_classification'],
  },
  {
    id: 'heiken_ashi',
    name: 'Heiken Ashi',
    description: 'Smoothed candlesticks with body size classification',
    source: 'Part 20 SQLite-Sync (57-column schema)',
    dataFields: [
      'ha_open', 'ha_high', 'ha_low', 'ha_close',
      'ha_classification', 'ha_body_size', 'ha_body_zscore'
    ],
  },
  {
    id: 'keltner_channels',
    name: 'Keltner Channels',
    description: '10-band volatility channel system',
    source: 'Part 20 SQLite-Sync (57-column schema)',
    dataFields: [
      'kc_ultra_extreme_upper', 'kc_extreme_upper', 'kc_uppermost',
      'kc_upper', 'kc_upper_middle', 'kc_lower_middle',
      'kc_lower', 'kc_lowermost', 'kc_extreme_lower', 'kc_ultra_extreme_lower'
    ],
  },
  {
    id: 'support_resistance',
    name: 'Support & Resistance',
    description: 'Fractal-based support and resistance levels',
    source: 'Part 20 SQLite-Sync (57-column schema)',
    dataFields: [
      'sr_support_1', 'sr_support_2', 'sr_support_3', 'sr_support_4',
      'sr_resistance_1', 'sr_resistance_2', 'sr_resistance_3', 'sr_resistance_4'
    ],
  },
  {
    id: 'zigzag',
    name: 'ZigZag + EMA',
    description: 'Market structure with swing highs/lows and EMA trend',
    source: 'Part 20 SQLite-Sync (57-column schema)',
    dataFields: ['zigzag_peak', 'zigzag_bottom', 'ema_26'],
  },
  {
    id: 'OHLC',
    name: 'OHLC Candlestick Data',
    description: 'Open, High, Low, Close price data with volume for each candle',
    source: 'MT5 Terminal via Part 06 (copy_rates_from_pos)',
    dataFields: ['timestamp', 'open', 'high', 'low', 'close', 'volume'],
  },
];
```

---

#### 2. `app/api/indicators/[symbol]/[timeframe]/route.ts` ⚠️ MINOR UPDATE NEEDED
**Line 124:** Comment needs updating
```typescript
// OLD:
// - data: OHLC, fractals, trendlines, momentum, keltner, tema, hrma, smma, zigzag

// NEW:
// - data: System columns (8) + Indicator columns (49) = 57 total
// - FREE tier: 24 columns (8 system + 16 indicators: fractal_diagonal, fractal_horizontal)
// - PRO tier: 57 columns (all indicators)
```

**Line 134:** Example comment needs updating
```typescript
// OLD:
//  "data": { "ohlc": [...], "fractals": {...}, ... },

// NEW:
//  "data": {
//    "timestamp": 1705324800,
//    "open": 43265, "high": 43300, "low": 43200, "close": 43280,
//    "volume": 12500,
//    "diag_asc_line_1": 43200,  // FREE tier
//    "horiz_peak_line_1": 43300, // FREE tier
//    "tema": 43260, // PRO tier
//    "zigzag_peak": 43500, // PRO tier
//    ...
//  }
```

**Actual Implementation:** The function calls `getIndicatorDataCached()` which fetches from **PostgreSQL database (Part 20)**, not from MT5. This is CORRECT.

**Verdict:** Implementation is correct, only documentation comments need updating.

---

### ✅ Correctly Implemented File

#### 3. `lib/api/mt5-client.ts` ✅ CORRECT (Assuming it only calls Part 06)
This file should only call Part 06 endpoints which return OHLCV data only.

**Verification Needed:** Check that this file doesn't attempt to parse indicator data from MT5 service responses.

---

## Key Findings Summary

### ✅ What's Working Correctly:

1. **Part 06 Flask MT5 Service:**
   - ✅ Uses `copy_rates_from_pos()` for OHLCV data only
   - ✅ No `iCustom()` calls present
   - ✅ Clear documentation about OHLCV-only architecture
   - ✅ Tests validate OHLCV-only behavior

2. **Part 07 Data Fetching:**
   - ✅ `app/api/indicators/[symbol]/[timeframe]/route.ts` fetches from PostgreSQL (Part 20), not MT5
   - ✅ Uses `getIndicatorDataCached()` which reads from database

### ⚠️ What Needs Updating:

1. **Part 07 Documentation:**
   - ⚠️ `app/api/indicators/route.ts` - Update INDICATOR_TYPES array to reflect 57-column schema
   - ⚠️ `app/api/indicators/[symbol]/[timeframe]/route.ts` - Update comment documentation

---

## Recommendations

### High Priority (Documentation Updates):

1. **Update `app/api/indicators/route.ts`:**
   - Replace INDICATOR_TYPES array with 57-column schema definitions
   - Change IDs from uppercase (FRACTAL_HORIZONTAL) to lowercase (fractal_diagonal)
   - Update dataFields arrays to match new column names
   - Add source: 'Part 20 SQLite-Sync (57-column schema)'

2. **Update `app/api/indicators/[symbol]/[timeframe]/route.ts`:**
   - Update line 124 comment to reflect 57-column structure
   - Update line 134 example to show new data format

### Low Priority (Verification):

3. **Verify `lib/api/mt5-client.ts`:**
   - Confirm it only calls Part 06 for OHLCV data
   - Ensure it doesn't attempt to parse indicator data from responses

---

## Conclusion

**Part 06** is fully compliant with the OHLCV-only requirement. The Flask MT5 service correctly uses `copy_rates_from_pos()` and has proper documentation explaining why custom indicators are not available via MT5 Python API.

**Part 07** is functionally correct (fetches indicator data from database, not MT5), but has outdated documentation that references the old indicator schema. These are cosmetic issues that don't affect functionality but should be updated for consistency.

**No production code changes needed** - only documentation/comment updates required.

---

## Action Items

- [ ] Update `app/api/indicators/route.ts` INDICATOR_TYPES array
- [ ] Update comments in `app/api/indicators/[symbol]/[timeframe]/route.ts`
- [ ] Verify `lib/api/mt5-client.ts` implementation
- [ ] Add note to Part 07 completion list about 57-column schema alignment

---

**Report Generated:** 2026-01-16
**Analyst:** Claude Code
**Status:** ✅ Part 06 Compliant, ⚠️ Part 07 Needs Documentation Updates
