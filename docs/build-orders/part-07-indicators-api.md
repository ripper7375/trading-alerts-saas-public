# Part 7: Indicators API & Tier Routes - Build Order

**From:** `docs/v5-structure-division.md` Part 7
**Total Files:** 6 files
**Estimated Time:** 2 hours
**Priority:** ⭐⭐⭐ High
**Complexity:** Medium

---

## Overview

**Scope:** Next.js API routes for indicators and tier checking, connecting frontend to Flask MT5 service.

**Implementation Guide References:**

- `docs/implementation-guides/v5_part_g.md` - Indicators API business logic and tier-based access control

**Key Changes from V4:**

- ✅ NEW folder: `app/api/tier/` (3 tier-checking routes)
- ✅ Tier validation in indicators API before Flask call
- ✅ Symbol access checking before data retrieval

**Dependencies:**

- Part 3 complete (Types)
- Part 4 complete (Tier validation)
- Part 6 complete (Flask MT5 service running)

**Integration Points:**

- Called by Charts page
- Calls Flask MT5 service
- Validates tier access

---

## File Build Order

### Tier API Routes (3 files)

**File 1/6:** `app/api/tier/symbols/route.ts`

- GET endpoint
- Return allowed symbols for user's tier
- Use session to get tier
- Return FREE_TIER_SYMBOLS or PRO_TIER_SYMBOLS
- Commit: `feat(api): add tier symbols endpoint`

**File 2/6:** `app/api/tier/check/[symbol]/route.ts`

- GET endpoint with dynamic symbol param
- Validate if user can access symbol
- Return { allowed: boolean, reason?: string }
- Commit: `feat(api): add symbol access check endpoint`

**File 3/6:** `app/api/tier/combinations/route.ts`

- GET endpoint
- Return all allowed symbol+timeframe combinations
- Use getAllowedCombinations() from tier validator
- Return combinations array
- Commit: `feat(api): add tier combinations endpoint`

### Indicators API Routes (2 files)

**File 4/6:** `app/api/indicators/route.ts`

- GET endpoint (list all available indicators)
- Return indicator types
- Commit: `feat(api): add indicators list endpoint`

**File 5/6:** `app/api/indicators/[symbol]/[timeframe]/route.ts`

- GET endpoint with dynamic params
- Validate tier access (symbol + timeframe)
- Call Flask MT5 service
- Return indicator data
- Handle Flask service errors
- Commit: `feat(api): add indicator data endpoint with tier validation`

### MT5 Client (1 file)

**File 6/6:** `lib/api/mt5-client.ts`

- Axios client for Flask service
- getIndicatorData(symbol, timeframe, tier)
- Error handling
- Retry logic
- Commit: `feat(api): add MT5 service client`

---

## Testing After Part Complete

1. **Test Tier Endpoints**

   ```bash
   # Get allowed symbols (FREE user)
   curl http://localhost:3000/api/tier/symbols

   # Check symbol access
   curl http://localhost:3000/api/tier/check/XAUUSD

   # Get combinations
   curl http://localhost:3000/api/tier/combinations
   ```

2. **Test Indicators Endpoint**
   ```bash
   # Get indicator data (with auth)
   curl -H "Cookie: next-auth.session-token=..."      http://localhost:3000/api/indicators/XAUUSD/H1
   ```

---

## Success Criteria

- ✅ All 6 files created
- ✅ Tier endpoints return correct data
- ✅ Indicator endpoint validates tier
- ✅ Flask service integration works
- ✅ Error handling implemented
- ✅ PROGRESS.md updated

---

## Next Steps

- Ready for Part 9: Charts (uses these APIs)

---

**Last Updated:** 2025-11-18
**Alignment:** (E) Phase 3 → (B) Part 7 → (C) This file
