# Part 7: Tier Routes API - List of files completion

⚠️ **IMPORTANT ARCHITECTURAL CHANGE (v2.0.0):**
- All custom indicator endpoints have been REMOVED from Part 07
- Part 07 now contains ONLY tier-based access control routes
- OHLCV (candlestick) data is fetched from Part 20 (SQLite-Sync) via `/api/candles/{symbol}`
- Custom indicators are NOT supported due to MT5 Python API limitations with iCustom()

---

## Production Files

**File 1/3:** ✅ `app/api/tier/symbols/route.ts`
- GET endpoint returning accessible symbols for user's tier
- Includes symbol metadata (name, category, proOnly flag)
- Authentication required
- Returns list of symbols with counts and tier information

**File 2/3:** ✅ `app/api/tier/check/[symbol]/route.ts`
- GET endpoint checking if user's tier can access a specific symbol
- Dynamic route with symbol parameter
- Returns access status and upgrade information if denied
- Validates symbol existence and tier permissions

**File 3/3:** ✅ `app/api/tier/combinations/route.ts`
- GET endpoint returning all allowed symbol+timeframe combinations
- Used by frontend to populate dropdowns and validate selections
- Returns combinations with limits and upgrade information
- Includes timeframe labels and metadata

---

## Test Files

Currently no dedicated test files for Part 07. Related tier functionality is tested in:
- `__tests__/api/tier.test.ts` - General tier API tests
- `__tests__/lib/tier-config.test.ts` - Tier configuration tests
- `__tests__/lib/tier-validation.test.ts` - Tier validation tests
- `__tests__/lib/tier-helpers.test.ts` - Tier helper function tests

---

## Removed Files (v2.0.0)

The following files were part of Part 07 in v1.x but have been REMOVED:

**❌ `app/api/indicators/route.ts`** - REMOVED
- Previously: GET endpoint returning available indicator types
- Reason: Custom indicators no longer supported

**❌ `app/api/indicators/[symbol]/[timeframe]/route.ts`** - REMOVED
- Previously: GET endpoint fetching indicator data from Flask MT5 service
- Reason: Custom indicators no longer supported

**❌ `lib/api/mt5-client.ts`** - REMOVED FROM PART 07 (moved to archive)
- Previously: Client library for MT5 service communication
- Reason: Part 07 no longer communicates with MT5 service
- Note: MT5 communication now handled by Part 20 (SQLite-Sync) for OHLCV data only

---

## Status Summary

- **Completed:** 3/3 files (100%)
- **Missing:** None
- **Removed (v2.0.0):** 3 files (indicator endpoints + MT5 client)

---

## Architecture Notes

### Current Architecture (v2.0.0)

Part 07 is now a **pure tier-based access control API** with no indicator functionality:

```
┌─────────────────────────────────────────────────────────────┐
│                     Part 07: Tier Routes API                 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  GET /api/tier/symbols                                      │
│    → Returns accessible symbols for user's tier            │
│                                                             │
│  GET /api/tier/check/{symbol}                               │
│    → Checks if user can access specific symbol             │
│                                                             │
│  GET /api/tier/combinations                                 │
│    → Returns all allowed symbol+timeframe combinations     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

```
Frontend (Chart Component)
    ↓
1. GET /api/tier/combinations
    ↓ (Get allowed symbol+timeframe pairs)
    ↓
2. User selects symbol + timeframe
    ↓
3. GET /api/candles/{symbol}?timeframe=H1  ← Part 20 (SQLite-Sync)
    ↓ (Fetch OHLCV data)
    ↓
4. Render candlestick chart
```

### Previous Architecture (v1.x - DEPRECATED)

```
┌─────────────────────────────────────────────────────────────┐
│         Part 07: Indicators API & Tier Routes (v1.x)        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Tier Routes (3 files) - Still present in v2.0             │
│    ✓ GET /api/tier/symbols                                  │
│    ✓ GET /api/tier/check/{symbol}                           │
│    ✓ GET /api/tier/combinations                             │
│                                                             │
│  Indicator Routes (2 files) - REMOVED in v2.0              │
│    ✗ GET /api/indicators                                    │
│    ✗ GET /api/indicators/{symbol}/{timeframe}               │
│                                                             │
│  MT5 Client (1 file) - REMOVED in v2.0                     │
│    ✗ lib/api/mt5-client.ts                                  │
│        └─ fetchIndicatorData()                              │
│        └─ getMT5Symbols()                                   │
│        └─ getMT5Timeframes()                                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Related Documentation

- **OpenAPI Spec:** `docs/open-api-documents/part-07-indicators-tier-openapi.yaml` (v2.0.0)
- **Tier Configuration:** `lib/tier-config.ts`
- **Tier Validation:** `lib/tier-validation.ts`
- **Part 20 (OHLCV Data):** `docs/files-completion-list/part-20-files-completion.md`
- **Part 06 (Flask MT5):** `docs/files-completion-list/part-06-files-completion.md`

---

## Migration Notes (v1.x → v2.0.0)

If you're upgrading from Part 07 v1.x:

1. **Remove indicator endpoint calls** - No longer available
2. **Use Part 20 for OHLCV data** - `/api/candles/{symbol}`
3. **Remove MT5 client imports** - No longer needed in Part 07
4. **Update OpenAPI references** - Use v2.0.0 spec
5. **Tier routes unchanged** - No breaking changes for tier endpoints

---

**Last Updated:** 2026-01-24
**Version:** 2.0.0 (Tier Routes Only)
**Related PR:** #293 (Remove MT5 Indicators)
