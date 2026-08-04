# Part 7: Tier Routes API - List of files completion

⚠️ **IMPORTANT ARCHITECTURAL CHANGE (v2.0.0):**

- All custom indicator endpoints have been REMOVED from Part 07
- Part 07 now contains ONLY tier-based access control routes
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
3. Socket.IO subscribe { symbol, timeframe }  ← Part 06 (Flask MT5 WebSocket)
    ↓ (Real-time OHLCV push; backend checks every 0.25s, pushes on price change)
    ↓
4. Receive initial_data event (full candle history on connect)
    ↓
5. Receive ohlcv_update events (live candle updates as market moves)
    ↓
6. Render/update candlestick chart via lightweight-charts
```

> **Note (2026-03-05):** Step 3 was previously documented as an HTTP GET to
> `/api/candles/{symbol}` (Part 20 / SQLite-Sync). This has been superseded by
> the Socket.IO WebSocket connection to Part 06 (Flask MT5 service). Both FREE
> and PRO users receive real-time updates — tier access control remains enforced
> at the Flask API level before any data is sent.

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

## V8 Update (2026-07-07) — Single-Symbol Architecture

`change-to-new-design.md` moved the product to one symbol (XAUUSD) and two timeframes (M5, M15)
for **both** tiers, with tier differentiation expressed through feature gates instead of
data-access limits. All 3 Part 07 files were updated accordingly — no files added or removed:

- **`app/api/tier/symbols/route.ts`** — now returns the single-symbol list (`SYMBOLS` from
  `lib/tier-config.ts`); the `proOnly` flag is gone since nothing is symbol-gated anymore.
- **`app/api/tier/check/[symbol]/route.ts`** — `allowed=true` only for XAUUSD, for any tier;
  unknown symbols return `allowed=false` with no upgrade prompt (no tier unlocks additional
  symbols in V8). Dropped the `upgradeRequired` response field.
- **`app/api/tier/combinations/route.ts`** — returns the two supported combinations
  (XAUUSD×M5, XAUUSD×M15), identical for both tiers; no tier gating, no upgrade prompt.

Tier differentiation for this platform is now: **Alerts** (FREE 0 / PRO 100, `app/api/alerts/*`),
**multi-timeframe visualization** (PRO-only, `app/api/market-data/channel/route.ts` — new,
tracked in `backend-file-inventory.md` under Part 09, not Part 07), and **drawing-engine line
alerts** (PRO-only). See `docs/files-completion-list/files-inventory/part-11-files-completion.md`
and `part-09-files-completion.md` for those.

---

**Last Updated:** 2026-07-07
**Version:** 3.0.0 (V8 single-symbol architecture — chart access no longer tier-gated)
**Related PR:** #293 (Remove MT5 Indicators), chart WebSocket migration (2026-03-05), V8 redesign (2026-07-07)
