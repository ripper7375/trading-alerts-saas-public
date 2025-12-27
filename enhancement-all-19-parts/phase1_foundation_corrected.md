# Phase 1: Foundation - Critical Tasks

**Sequential Execution Plan: Phase 1 of 6**
**Total Tasks**: 8
**Estimated Duration**: 4-6 hours
**Priority**: 🔴 CRITICAL - Must complete before Phase 2

---

## 📋 Phase Overview

**Primary Goal**: Establish stable, tested codebase with passing CI/CD

**Success Criteria**:

- ✅ All unit tests passing (100%)
- ✅ All integration tests passing (100%)
- ✅ GitHub Actions CI/CD green
- ✅ Zero TypeScript errors
- ✅ Zero ESLint errors
- ✅ Vercel deployment successful

---

## ⚠️ Prerequisites

Before starting Phase 1:

- [ ] All previous PRs deleted/closed
- [ ] Clean main/develop branch
- [ ] Local dev server runs successfully
- [ ] Database accessible (Railway PostgreSQL)
- [ ] Environment variables configured (.env.local)
- [ ] Node modules installed (npm install)

---

## 🎯 Task List

### Task 1.1: Fix Tier Configuration 🔴 CRITICAL

**Status**: ⏳ Not Started
**Priority**: HIGHEST - Blocks Tasks 1.2, 1.3, 1.4
**Estimated Time**: 30 minutes

#### Problem

FREE tier users cannot access proper symbols/timeframes. Configuration must match actual implementation with 5 FREE symbols and 3 FREE timeframes.

#### Files to Modify

- `lib/tier-config.ts`

#### Implementation

```typescript
// In lib/tier-config.ts

// ✅ CORRECT FREE tier symbols (5 symbols including crypto and indices)
export const FREE_SYMBOLS = [
  'BTCUSD', // Bitcoin - Crypto
  'EURUSD', // Euro - Forex Major
  'USDJPY', // Yen - Forex Major
  'US30', // Dow Jones - Index
  'XAUUSD', // Gold - Commodity
] as const;

// ✅ CORRECT PRO exclusive symbols (10 more)
export const PRO_EXCLUSIVE_SYMBOLS = [
  'AUDJPY', // Forex Cross
  'AUDUSD', // Forex Major
  'ETHUSD', // Ethereum - Crypto
  'GBPJPY', // Forex Cross
  'GBPUSD', // Forex Major - Cable
  'NDX100', // Nasdaq 100 - Index
  'NZDUSD', // Forex Major - Kiwi
  'USDCAD', // Forex Major - Loonie
  'USDCHF', // Forex Major - Swissie
  'XAGUSD', // Silver - Commodity
] as const;

// ✅ Total PRO symbols: 15 (5 FREE + 10 exclusive)
export const PRO_SYMBOLS = [...FREE_SYMBOLS, ...PRO_EXCLUSIVE_SYMBOLS] as const;

// ✅ CORRECT FREE timeframes (3 timeframes - higher timeframes only)
export const FREE_TIMEFRAMES = ['H1', 'H4', 'D1'] as const;

// ✅ CORRECT PRO exclusive timeframes (6 more)
export const PRO_EXCLUSIVE_TIMEFRAMES = [
  'M5', // 5 minutes
  'M15', // 15 minutes
  'M30', // 30 minutes
  'H2', // 2 hours
  'H8', // 8 hours
  'H12', // 12 hours
] as const;

// ✅ Total PRO timeframes: 9 (3 FREE + 6 exclusive)
// ❌ NO M1 or W1 in the system!
export const PRO_TIMEFRAMES = [
  'M5',
  'M15',
  'M30', // Intraday short
  'H1',
  'H2',
  'H4',
  'H8',
  'H12', // Intraday medium
  'D1', // Daily
] as const;

// ✅ CORRECT tier limits
export interface TierConfig {
  name: string;
  price: number;
  symbols: number;
  timeframes: number;
  chartCombinations: number; // symbols × timeframes
  maxAlerts: number;
  maxWatchlistItems: number;
  rateLimit: number; // requests per HOUR
}

export const FREE_TIER_CONFIG: TierConfig = {
  name: 'FREE',
  price: 0,
  symbols: 5, // ✅ 5 symbols
  timeframes: 3, // ✅ 3 timeframes
  chartCombinations: 15, // ✅ 5 × 3 = 15
  maxAlerts: 5, // ✅ 5 alerts (not 3!)
  maxWatchlistItems: 5, // ✅ 5 watchlist items
  rateLimit: 60, // ✅ 60 per HOUR (not per minute!)
};

export const PRO_TIER_CONFIG: TierConfig = {
  name: 'PRO',
  price: 29, // ✅ $29/month or $290/year
  symbols: 15, // ✅ 15 symbols
  timeframes: 9, // ✅ 9 timeframes
  chartCombinations: 135, // ✅ 15 × 9 = 135
  maxAlerts: 20, // ✅ 20 alerts
  maxWatchlistItems: 50, // ✅ 50 watchlist items
  rateLimit: 300, // ✅ 300 per HOUR
};

// Helper functions
export function canAccessSymbol(symbol: string, tier: Tier): boolean {
  const upperSymbol = symbol.toUpperCase();
  if (tier === 'PRO') return PRO_SYMBOLS.includes(upperSymbol as any);
  return FREE_SYMBOLS.includes(upperSymbol as any);
}

export function canAccessTimeframe(timeframe: string, tier: Tier): boolean {
  const upperTF = timeframe.toUpperCase();
  if (tier === 'PRO') return PRO_TIMEFRAMES.includes(upperTF as any);
  return FREE_TIMEFRAMES.includes(upperTF as any);
}
```

#### Verification

```bash
# Check the config
cat lib/tier-config.ts | grep -A 5 "FREE_SYMBOLS"

# Test tier config
node -e "
const config = require('./lib/tier-config');
console.log('FREE_SYMBOLS:', config.FREE_SYMBOLS);
console.log('FREE_TIMEFRAMES:', config.FREE_TIMEFRAMES);
console.log('FREE symbol count:', config.FREE_SYMBOLS.length);  // Should be 5
console.log('PRO symbol count:', config.PRO_SYMBOLS.length);    // Should be 15
console.log('Can FREE access BTCUSD:', config.canAccessSymbol('BTCUSD', 'FREE'));
console.log('Can FREE access US30:', config.canAccessSymbol('US30', 'FREE'));
console.log('Can FREE access H1:', config.canAccessTimeframe('H1', 'FREE'));
"
```

#### Acceptance Criteria

- [ ] FREE_SYMBOLS has 5 symbols: BTCUSD, EURUSD, USDJPY, US30, XAUUSD
- [ ] PRO_SYMBOLS has 15 total symbols
- [ ] FREE_TIMEFRAMES has 3: H1, H4, D1
- [ ] PRO_TIMEFRAMES has 9 (includes H2, H8, H12, NO M1 or W1)
- [ ] FREE maxAlerts is 5 (not 3)
- [ ] Rate limits are per HOUR (60, 300)
- [ ] Chart combinations: 15 for FREE, 135 for PRO

#### Commit

```bash
git add lib/tier-config.ts
git commit -m "fix(phase1): correct tier configuration to match actual implementation

- FREE: 5 symbols (BTCUSD, EURUSD, USDJPY, US30, XAUUSD)
- PRO: 15 symbols total (adds 10 exclusive including ETHUSD, NDX100, XAGUSD)
- FREE: 3 timeframes (H1, H4, D1)
- PRO: 9 timeframes (M5, M15, M30, H1, H2, H4, H8, H12, D1)
- NO M1 or W1 in system
- FREE limits: 5 alerts, 5 watchlist items
- Rate limits: 60/hour FREE, 300/hour PRO
- Chart combinations: 15 FREE (5×3), 135 PRO (15×9)"
```

---

### Task 1.2: Fix Indicators API Test 🔴 CRITICAL

**Status**: ⏳ Not Started
**Priority**: HIGHEST
**Estimated Time**: 45 minutes
**Prerequisites**: Task 1.1 complete

#### Problem

Test fails because:

1. Test uses wrong symbol (not in FREE tier)
2. Response structure doesn't match expectations
3. Mock data missing `proIndicatorsTransformed` field

#### Files to Modify

- `__tests__/api/indicators.test.ts`
- `app/api/indicators/[symbol]/[timeframe]/route.ts`

#### Implementation Part A: Update Test with CORRECT Symbols

```typescript
// In __tests__/api/indicators.test.ts

it('should return indicator data for FREE tier with valid symbol/timeframe', async () => {
  // Mock FREE tier session
  (getServerSession as jest.Mock).mockResolvedValue({
    user: { id: 'user-123', tier: 'FREE' },
  });

  // ✅ Use BTCUSD (valid FREE symbol) or XAUUSD
  mockFetchIndicatorData.mockResolvedValue({
    ohlc: [
      { time: 1234567890, open: 50000, high: 51000, low: 49000, close: 50500 },
    ],
    horizontal: { peak_1: [], bottom_1: [] },
    diagonal: { ascending_1: [], descending_1: [] },
    fractals: { peaks: [], bottoms: [] },
    metadata: { symbol: 'BTCUSD', timeframe: 'H1', bars: 1 },
    proIndicators: {},
    proIndicatorsTransformed: {}, // ← MUST be present
  });

  // ✅ Test with BTCUSD/H1 (both valid for FREE)
  const request = new NextRequest(
    'http://localhost:3000/api/indicators/btcusd/h1'
  );

  const response = await GET(request, {
    params: { symbol: 'btcusd', timeframe: 'h1' },
  });

  expect(response.status).toBe(200);

  const data = await response.json();

  // Match actual API response structure
  expect(data).toMatchObject({
    success: true,
    tier: 'FREE',
    data: expect.objectContaining({
      ohlc: expect.any(Array),
      horizontal: expect.any(Object),
      diagonal: expect.any(Object),
      fractals: expect.any(Object),
      metadata: expect.objectContaining({
        symbol: 'BTCUSD', // ✅ Valid FREE symbol
        timeframe: 'H1', // ✅ Valid FREE timeframe
      }),
      proIndicators: expect.any(Object),
      proIndicatorsTransformed: expect.any(Object),
    }),
    requestedAt: expect.any(String),
  });
});

// ✅ Add test for US30 (index - also FREE tier)
it('should allow FREE tier access to US30 index', async () => {
  (getServerSession as jest.Mock).mockResolvedValue({
    user: { id: 'user-123', tier: 'FREE' },
  });

  const request = new NextRequest(
    'http://localhost:3000/api/indicators/us30/h4'
  );

  const response = await GET(request, {
    params: { symbol: 'us30', timeframe: 'h4' },
  });

  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.data.metadata.symbol).toBe('US30');
});

// ✅ Add test for PRO-only symbol rejection
it('should reject FREE tier access to ETHUSD (PRO only)', async () => {
  (getServerSession as jest.Mock).mockResolvedValue({
    user: { id: 'user-123', tier: 'FREE' },
  });

  const request = new NextRequest(
    'http://localhost:3000/api/indicators/ethusd/h1'
  );

  const response = await GET(request, {
    params: { symbol: 'ethusd', timeframe: 'h1' },
  });

  expect(response.status).toBe(403);
  const data = await response.json();
  expect(data.error).toContain('ETHUSD');
});

// ✅ Add test for PRO-only timeframe rejection
it('should reject FREE tier access to M5 timeframe', async () => {
  (getServerSession as jest.Mock).mockResolvedValue({
    user: { id: 'user-123', tier: 'FREE' },
  });

  const request = new NextRequest(
    'http://localhost:3000/api/indicators/btcusd/m5'
  );

  const response = await GET(request, {
    params: { symbol: 'btcusd', timeframe: 'm5' },
  });

  expect(response.status).toBe(403);
  const data = await response.json();
  expect(data.error).toContain('M5');
});
```

#### Verification

```bash
# Run the corrected tests
npm test -- __tests__/api/indicators.test.ts

# All should pass:
# ✓ should return indicator data for FREE tier (BTCUSD/H1)
# ✓ should allow FREE tier access to US30
# ✓ should reject ETHUSD for FREE tier
# ✓ should reject M5 timeframe for FREE tier
```

#### Acceptance Criteria

- [ ] Test uses valid FREE symbols (BTCUSD, EURUSD, USDJPY, US30, XAUUSD)
- [ ] Test uses valid FREE timeframes (H1, H4, D1)
- [ ] Response includes all required fields
- [ ] proIndicatorsTransformed always defined
- [ ] Tests for PRO-only symbol rejection
- [ ] Tests for PRO-only timeframe rejection
- [ ] All indicator tests passing

#### Commit

```bash
git add __tests__/api/indicators.test.ts app/api/indicators/[symbol]/[timeframe]/route.ts
git commit -m "fix(phase1): correct indicators API tests with actual tier configuration

- Use BTCUSD (valid FREE symbol) instead of wrong symbols
- Test US30 (index) access for FREE tier
- Add tests for PRO-only symbol rejection (ETHUSD)
- Add tests for PRO-only timeframe rejection (M5)
- Verify correct response structure
- All tests now passing with actual implementation"
```

---

### Task 1.3: Fix Auth Validation Schema 🔴 CRITICAL

**Status**: ⏳ Not Started
**Priority**: HIGH
**Estimated Time**: 30 minutes
**Prerequisites**: Task 1.2 complete

#### Problem

`resetPasswordSchema` missing password matching validation.

#### Files to Modify

- `lib/validations/auth.ts`

#### Implementation

```typescript
// In lib/validations/auth.ts

import { z } from 'zod';

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, 'Reset token is required'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(100, 'Password is too long'),
    confirmPassword: z.string(),
  })
  .superRefine((data, ctx) => {
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Passwords do not match',
        path: ['confirmPassword'],
      });
    }
  });
```

#### Acceptance Criteria

- [ ] Password matching validation added
- [ ] Error message: "Passwords do not match"
- [ ] All auth validation tests pass

#### Commit

```bash
git add lib/validations/auth.ts
git commit -m "fix(phase1): add password matching validation to reset schema"
```

---

### Tasks 1.4-1.8: Continue as in original file

**Task 1.4**: Fix All Remaining Test Failures
**Task 1.5**: Fix TypeScript Errors  
**Task 1.6**: Fix ESLint Errors
**Task 1.7**: Verify CI/CD Pipeline
**Task 1.8**: Verify Vercel Deployment

_(Implementation remains same as original file)_

---

## ✅ Phase 1 Completion Checklist

### Critical Fixes ✅

- [ ] Tier config: 5 FREE symbols (BTCUSD, EURUSD, USDJPY, US30, XAUUSD)
- [ ] Tier config: 15 PRO symbols total
- [ ] Tier config: 3 FREE timeframes (H1, H4, D1)
- [ ] Tier config: 9 PRO timeframes (NO M1/W1, includes H2/H8/H12)
- [ ] Tier limits: 5 alerts, 5 watchlist items for FREE
- [ ] Rate limits: 60/hour FREE, 300/hour PRO

### Tests ✅

- [ ] All unit tests passing
- [ ] Indicators API tests with correct symbols
- [ ] Auth validation tests passing
- [ ] Coverage >70%

### Build ✅

- [ ] TypeScript clean
- [ ] ESLint clean
- [ ] CI/CD green
- [ ] Vercel deployed

---
