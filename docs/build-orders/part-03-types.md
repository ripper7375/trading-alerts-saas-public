# Part 3: Type Definitions - Build Order

**From:** `docs/v5-structure-division.md` Part 3
**Total Files:** 6 files
**Estimated Time:** 1.5 hours
**Priority:** ⭐⭐⭐ High
**Complexity:** Low

---

## Overview

**Scope:** TypeScript type definitions for the entire V7 application, including tier types, user types, alert types, indicator types, and API types.

**Implementation Guide References:**

- `docs/trading_alerts_openapi.yaml` - Primary source for API type definitions and schemas
- `docs/flask_mt5_openapi.yaml` - Indicator and MT5-related type definitions
- `docs/policies/00-tier-specifications.md` - Tier constants and limits

**Key Changes from V4:**

- ✅ New `tier.ts` - Tier-specific types and constants
- ✅ Updated `user.ts` - Remove ENTERPRISE tier, add tier field
- ✅ All types aligned with 2-tier system (FREE/PRO)
- ✅ Types generated from Prisma and OpenAPI schemas

**Dependencies:**

- Requires Part 1 complete (TypeScript configuration)
- Requires Part 2 complete (Prisma schema for type generation)

**Integration Points:**

- Provides types for ALL subsequent parts (3-18)
- Referenced by API routes, components, and utilities
- Ensures type safety across the entire application

---

## File Build Order

Build these files **in sequence**:

---

### File 1/6: `types/index.ts`

**Purpose:** Central export file for all type definitions

**From v5-structure-division.md:**

> Main index file exporting all types

**Implementation Details:**

- **Pattern:** Barrel export pattern
- **Reference Guide:** `docs/policies/05-coding-patterns.md`

**Dependencies:**

- None (this file exports others, but can be created first)

**Build Steps:**

1. **Read Requirements**

   ```
   - All type files that will exist in types/ folder
   - Standard TypeScript barrel export pattern
   ```

2. **Generate Code**

   ```typescript
   // types/index.ts

   /**
    * Central type definitions for Trading Alerts SaaS V7
    *
    * This file exports all types used across the application.
    * Import from this file rather than individual type files.
    *
    * @example
    * import { User, Alert, Tier } from '@/types';
    */

   // Re-export all types
   export * from './user';
   export * from './tier';
   export * from './alert';
   export * from './indicator';
   export * from './api';

   // Re-export Prisma types
   export type {
     User,
     Alert,
     Subscription,
     Watchlist,
     WatchlistItem,
   } from '@prisma/client';
   ```

3. **Validation**
   - Valid TypeScript syntax
   - All type files referenced
   - No circular dependencies

4. **Commit**
   ```
   git add types/index.ts
   git commit -m "feat(types): add central type exports"
   ```

---

### File 2/6: `types/tier.ts`

**Purpose:** Tier-specific types and constants for 2-tier system

**From v5-structure-division.md:**

> NEW in V5 - Tier types and constants

**Implementation Details:**

- **Reference Guide:** `docs/policies/00-tier-specifications.md`
- **Pattern:** Type definitions with constants
- **OpenAPI Reference:** `docs/trading_alerts_openapi.yaml` → TierEnum

**Dependencies:**

- None

**Build Steps:**

1. **Read Requirements**

   ```
   - 00-tier-specifications.md (FREE vs PRO limits)
   - OpenAPI schema for Tier enum
   - 2-tier system: FREE (5 symbols, 3 timeframes), PRO (15 symbols, 9 timeframes)
   ```

2. **Key Implementation Points**

   ```typescript
   // types/tier.ts

   /**
    * Tier System Types for V7
    *
    * V7 uses a simplified 2-tier system:
    * - FREE: 5 symbols × 3 timeframes (H1, H4, D1) = 15 combinations
    * - PRO: 15 symbols × 9 timeframes (all) = 135 combinations
    */

   //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   // TIER ENUM
   //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

   /**
    * User tier levels
    *
    * Note: ENTERPRISE tier removed in V7
    */
   export type Tier = 'FREE' | 'PRO';

   //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   // TIER LIMITS
   //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

   /**
    * Tier-specific feature limits
    */
   export interface TierLimits {
     maxAlerts: number;
     maxWatchlists: number;
     allowedSymbols: string[];
     allowedTimeframes: Timeframe[];
     features: {
       advancedCharts: boolean;
       exportData: boolean;
       apiAccess: boolean;
       prioritySupport: boolean;
     };
   }

   //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   // TIMEFRAME TYPES
   //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

   /**
    * All supported timeframes in V7
    *
    * FREE tier: H1, H4, D1 only
    * PRO tier: All 9 timeframes
    */
   export type Timeframe =
     | 'M5' // PRO only
     | 'M15' // PRO only
     | 'M30' // PRO only
     | 'H1' // FREE + PRO
     | 'H2' // PRO only
     | 'H4' // FREE + PRO
     | 'H8' // PRO only
     | 'H12' // PRO only
     | 'D1'; // FREE + PRO

   /**
    * Timeframe display labels
    */
   export const TIMEFRAME_LABELS: Record<Timeframe, string> = {
     M5: '5 Minutes',
     M15: '15 Minutes',
     M30: '30 Minutes',
     H1: '1 Hour',
     H2: '2 Hours',
     H4: '4 Hours',
     H8: '8 Hours',
     H12: '12 Hours',
     D1: '1 Day',
   };

   //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   // SYMBOL CONSTANTS
   //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

   /**
    * FREE tier symbols (5 symbols)
    */
   export const FREE_TIER_SYMBOLS = [
     'BTCUSD', // Bitcoin
     'EURUSD', // Euro
     'USDJPY', // Yen
     'US30', // Dow Jones
     'XAUUSD', // Gold
   ] as const;

   /**
    * PRO tier exclusive symbols (10 additional)
    */
   export const PRO_TIER_EXCLUSIVE_SYMBOLS = [
     'GBPUSD', // Pound
     'AUDUSD', // Australian Dollar
     'USDCAD', // Canadian Dollar
     'USDCHF', // Swiss Franc
     'NZDUSD', // New Zealand Dollar
     'EURJPY', // Euro-Yen
     'GBPJPY', // Pound-Yen
     'AUDJPY', // Aussie-Yen
     'NAS100', // Nasdaq
     'SPX500', // S&P 500
   ] as const;

   /**
    * All PRO tier symbols (15 total)
    */
   export const PRO_TIER_SYMBOLS = [
     ...FREE_TIER_SYMBOLS,
     ...PRO_TIER_EXCLUSIVE_SYMBOLS,
   ] as const;

   /**
    * All available symbols (union type)
    */
   export type Symbol = (typeof PRO_TIER_SYMBOLS)[number];

   //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   // TIER CONFIGURATION
   //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

   /**
    * FREE tier timeframes (3 timeframes)
    */
   export const FREE_TIER_TIMEFRAMES: Timeframe[] = ['H1', 'H4', 'D1'];

   /**
    * PRO tier timeframes (all 9 timeframes)
    */
   export const PRO_TIER_TIMEFRAMES: Timeframe[] = [
     'M5',
     'M15',
     'M30',
     'H1',
     'H2',
     'H4',
     'H8',
     'H12',
     'D1',
   ];

   /**
    * Complete tier configuration
    */
   export const TIER_CONFIG: Record<Tier, TierLimits> = {
     FREE: {
       maxAlerts: 5,
       maxWatchlists: 1,
       allowedSymbols: [...FREE_TIER_SYMBOLS],
       allowedTimeframes: FREE_TIER_TIMEFRAMES,
       features: {
         advancedCharts: false,
         exportData: false,
         apiAccess: false,
         prioritySupport: false,
       },
     },
     PRO: {
       maxAlerts: 20,
       maxWatchlists: 5,
       allowedSymbols: [...PRO_TIER_SYMBOLS],
       allowedTimeframes: PRO_TIER_TIMEFRAMES,
       features: {
         advancedCharts: true,
         exportData: true,
         apiAccess: true,
         prioritySupport: true,
       },
     },
   };

   //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   // HELPER TYPES
   //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

   /**
    * Symbol+Timeframe combination
    */
   export interface ChartCombination {
     symbol: Symbol;
     timeframe: Timeframe;
   }

   /**
    * Tier upgrade information
    */
   export interface TierUpgradeInfo {
     currentTier: Tier;
     targetTier: Tier;
     additionalSymbols: number;
     additionalTimeframes: number;
     additionalAlerts: number;
     pricePerMonth: number;
   }

   /**
    * Tier access result
    */
   export interface TierAccessResult {
     allowed: boolean;
     reason?: string;
     upgradeRequired?: boolean;
     requiredTier?: Tier;
   }
   ```

3. **Validation**
   - All tier constants match 00-tier-specifications.md
   - FREE tier: 5 symbols, 3 timeframes
   - PRO tier: 15 symbols, 9 timeframes
   - No ENTERPRISE tier references
   - All types exported

4. **Commit**
   ```
   git add types/tier.ts
   git commit -m "feat(types): add tier system types and constants for 2-tier system"
   ```

---

### File 3/6: `types/user.ts`

**Purpose:** User-related type definitions

**From v5-structure-division.md:**

> Updated for 2-tier system, remove ENTERPRISE

**Implementation Details:**

- **Reference Guide:** `docs/implementation-guides/v5_part_c.md` (User model)
- **OpenAPI Reference:** `docs/trading_alerts_openapi.yaml` → User schema
- **Pattern:** Extends Prisma User type

**Dependencies:**

- Part 2 complete (Prisma schema)
- File 2/6 complete (tier.ts)

**Build Steps:**

1. **Read Requirements**

   ```
   - Prisma User model
   - OpenAPI User schema
   - NextAuth session structure
   ```

2. **Generate Code**

   ```typescript
   // types/user.ts

   import type { User as PrismaUser } from '@prisma/client';
   import type { Tier } from './tier';

   /**
    * User type (extends Prisma User)
    *
    * Note: This is a re-export with additional type safety
    */
   export type User = PrismaUser;

   /**
    * Public user profile (safe for client-side)
    *
    * Excludes sensitive fields like password hash
    */
   export interface PublicUserProfile {
     id: string;
     email: string;
     name: string | null;
     image: string | null;
     tier: Tier;
     createdAt: Date;
   }

   /**
    * User session data (from NextAuth)
    */
   export interface UserSession {
     user: {
       id: string;
       email: string;
       name: string | null;
       image: string | null;
       tier: Tier;
     };
     expires: string;
   }

   /**
    * User preferences
    */
   export interface UserPreferences {
     theme: 'light' | 'dark' | 'system';
     notifications: {
       email: boolean;
       push: boolean;
       alerts: boolean;
     };
     defaultTimeframe: string;
     defaultSymbol: string;
     language: string;
   }

   /**
    * User statistics
    */
   export interface UserStats {
     totalAlerts: number;
     activeAlerts: number;
     triggeredAlerts: number;
     totalWatchlists: number;
     joinedDate: Date;
     lastLogin: Date | null;
   }

   /**
    * User with relationships
    */
   export interface UserWithRelations extends User {
     alerts?: Alert[];
     watchlists?: Watchlist[];
     subscription?: Subscription | null;
   }

   /**
    * User update request
    */
   export interface UpdateUserRequest {
     name?: string;
     image?: string;
     preferences?: Partial<UserPreferences>;
   }
   ```

3. **Commit**
   ```
   git add types/user.ts
   git commit -m "feat(types): add user type definitions for 2-tier system"
   ```

---

### File 4/6: `types/alert.ts`

**Purpose:** Alert-related type definitions

**Implementation Details:**

- **Reference Guide:** `docs/implementation-guides/v5_part_*.md` (Alerts section)
- **OpenAPI Reference:** `docs/trading_alerts_openapi.yaml` → Alert schema
- **Pattern:** Type definitions with create/update request types

**Dependencies:**

- Part 2 complete (Prisma Alert model)
- File 2/6 complete (tier.ts for Symbol and Timeframe)

**Build Steps:**

1. **Generate Code**

   ```typescript
   // types/alert.ts

   import type { Alert as PrismaAlert } from '@prisma/client';
   import type { Symbol, Timeframe } from './tier';

   /**
    * Alert type (extends Prisma Alert)
    */
   export type Alert = PrismaAlert;

   /**
    * Alert status
    */
   export type AlertStatus = 'ACTIVE' | 'TRIGGERED' | 'EXPIRED' | 'DISABLED';

   /**
    * Alert condition type
    */
   export type AlertConditionType =
     | 'PRICE_ABOVE'
     | 'PRICE_BELOW'
     | 'PRICE_CROSS_ABOVE'
     | 'PRICE_CROSS_BELOW'
     | 'INDICATOR_SIGNAL';

   /**
    * Create alert request
    */
   export interface CreateAlertRequest {
     symbol: Symbol;
     timeframe: Timeframe;
     conditionType: AlertConditionType;
     targetValue: number;
     message?: string;
   }

   /**
    * Update alert request
    */
   export interface UpdateAlertRequest {
     isActive?: boolean;
     targetValue?: number;
     message?: string;
   }

   /**
    * Alert with user data
    */
   export interface AlertWithUser extends Alert {
     user: {
       id: string;
       name: string | null;
       email: string;
     };
   }

   /**
    * Alert notification
    */
   export interface AlertNotification {
     alertId: string;
     symbol: Symbol;
     timeframe: Timeframe;
     condition: string;
     currentPrice: number;
     targetPrice: number;
     triggeredAt: Date;
     message?: string;
   }
   ```

2. **Commit**
   ```
   git add types/alert.ts
   git commit -m "feat(types): add alert type definitions"
   ```

---

### File 5/6: `types/indicator.ts`

**Purpose:** Indicator-related type definitions for trading data

**Implementation Details:**

- **Reference Guide:** `docs/flask_mt5_openapi.yaml`
- **Pattern:** Type definitions for indicator data from Flask MT5 service

**Dependencies:**

- File 2/6 complete (tier.ts for Symbol and Timeframe)

**Build Steps:**

1. **Generate Code**

   ```typescript
   // types/indicator.ts

   import type { Symbol, Timeframe } from './tier';

   /**
    * Indicator types from MT5
    */
   export type IndicatorType = 'FRACTAL_HORIZONTAL' | 'FRACTAL_DIAGONAL';

   /**
    * Candlestick data point
    */
   export interface Candlestick {
     time: number; // Unix timestamp
     open: number;
     high: number;
     low: number;
     close: number;
     volume?: number;
   }

   /**
    * Indicator data point
    */
   export interface IndicatorPoint {
     time: number;
     value: number;
     type?: 'SUPPORT' | 'RESISTANCE';
   }

   /**
    * Complete indicator data response
    */
   export interface IndicatorData {
     symbol: Symbol;
     timeframe: Timeframe;
     indicatorType: IndicatorType;
     candlesticks: Candlestick[];
     indicators: IndicatorPoint[];
     lastUpdate: string; // ISO timestamp
   }

   /**
    * Indicator request parameters
    */
   export interface IndicatorRequest {
     symbol: Symbol;
     timeframe: Timeframe;
     indicatorType: IndicatorType;
     bars?: number; // Number of bars to fetch (default: 100)
   }

   /**
    * Chart data (candlesticks + indicators)
    */
   export interface ChartData {
     symbol: Symbol;
     timeframe: Timeframe;
     data: Candlestick[];
     indicators: {
       fractalHorizontal?: IndicatorPoint[];
       fractalDiagonal?: IndicatorPoint[];
     };
     lastUpdate: Date;
   }
   ```

2. **Commit**
   ```
   git add types/indicator.ts
   git commit -m "feat(types): add indicator and chart data types"
   ```

---

### File 6/6: `types/api.ts`

**Purpose:** API request/response types and error types

**Implementation Details:**

- **OpenAPI Reference:** `docs/trading_alerts_openapi.yaml` (all schemas)
- **Pattern:** Standard API types for requests, responses, errors

**Dependencies:**

- All previous type files (this imports from them)

**Build Steps:**

1. **Generate Code**

   ```typescript
   // types/api.ts

   /**
    * Standard API response wrapper
    */
   export interface ApiResponse<T = unknown> {
     data?: T;
     error?: ApiError;
     message?: string;
   }

   /**
    * API error structure
    */
   export interface ApiError {
     code: string;
     message: string;
     details?: Record<string, unknown>;
     field?: string; // For validation errors
   }

   /**
    * Pagination parameters
    */
   export interface PaginationParams {
     page: number;
     limit: number;
     sortBy?: string;
     sortOrder?: 'asc' | 'desc';
   }

   /**
    * Paginated response
    */
   export interface PaginatedResponse<T> {
     data: T[];
     pagination: {
       page: number;
       limit: number;
       total: number;
       totalPages: number;
       hasNext: boolean;
       hasPrevious: boolean;
     };
   }

   /**
    * Validation error details
    */
   export interface ValidationError {
     field: string;
     message: string;
     value?: unknown;
   }

   /**
    * Error response from API
    */
   export interface ErrorResponse {
     error: string;
     message: string;
     statusCode: number;
     timestamp: string;
     path?: string;
     validationErrors?: ValidationError[];
   }

   /**
    * Success response with message
    */
   export interface SuccessResponse {
     success: true;
     message: string;
     data?: unknown;
   }

   /**
    * Generic filter parameters
    */
   export interface FilterParams {
     search?: string;
     dateFrom?: string;
     dateTo?: string;
     status?: string;
     [key: string]: string | number | boolean | undefined;
   }
   ```

2. **Commit**
   ```
   git add types/api.ts
   git commit -m "feat(types): add API request/response types"
   ```

---

## Testing After Part Complete

Once all 6 files are built:

1. **Verify TypeScript Compilation**

   ```bash
   npx tsc --noEmit
   ```

   Expected: No errors

2. **Check Type Exports**

   ```bash
   # Create a test file that imports all types
   cat > test-types.ts << 'EOF'
   import {
     Tier,
     Symbol,
     Timeframe,
     User,
     Alert,
     IndicatorData,
     ApiResponse,
   } from './types';

   const tier: Tier = 'FREE';
   const symbol: Symbol = 'XAUUSD';
   const timeframe: Timeframe = 'H1';

   console.log('Types imported successfully!');
   EOF

   npx tsc test-types.ts --noEmit
   rm test-types.ts
   ```

3. **Verify Constants**
   ```bash
   # Create a test to verify tier constants
   node -e "
   const { TIER_CONFIG } = require('./types/tier');
   console.log('FREE symbols:', TIER_CONFIG.FREE.allowedSymbols.length); // Should be 5
   console.log('PRO symbols:', TIER_CONFIG.PRO.allowedSymbols.length); // Should be 15
   console.log('FREE timeframes:', TIER_CONFIG.FREE.allowedTimeframes.length); // Should be 3
   console.log('PRO timeframes:', TIER_CONFIG.PRO.allowedTimeframes.length); // Should be 9
   "
   ```

---

## Success Criteria

Part 3 is complete when:

- ✅ All 6 files built and committed
- ✅ TypeScript compilation succeeds with no errors
- ✅ All types aligned with 2-tier system
- ✅ No ENTERPRISE tier references
- ✅ FREE tier: 5 symbols, 3 timeframes
- ✅ PRO tier: 15 symbols, 9 timeframes
- ✅ All types exported from `types/index.ts`
- ✅ Types match OpenAPI schemas
- ✅ PROGRESS.md updated

---

## Next Steps

After Part 3 complete:

- Ready for Part 4: Tier System (uses types from this part)
- Ready for Part 5: Authentication (uses User and Tier types)
- Unblocks: All subsequent parts that use type definitions

---

## Escalation Scenarios

**Scenario 1: Type conflicts with Prisma**

- Issue: Generated Prisma types conflict with custom types
- Solution: Use Prisma types as base, extend with custom fields
- Example: `export interface UserWithStats extends User { stats: UserStats; }`

**Scenario 2: OpenAPI schema mismatch**

- Issue: OpenAPI schema doesn't match type definitions
- Escalate to: Review OpenAPI spec and update types to match
- Document: Any intentional deviations from OpenAPI

---

**Last Updated:** 2025-11-18
**Alignment:** (E) Phase 3 → (B) Part 3 → (C) This file
