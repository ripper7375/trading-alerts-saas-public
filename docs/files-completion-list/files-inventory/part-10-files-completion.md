# Part 10: Watchlist System - List of files completion

> ## ❌ REMOVED 2026-07-07 — Watchlist feature deleted from the product for all tiers
>
> Commit `f213bd12` deleted this entire feature as part of the V8 single-symbol architecture
> redesign (`change-to-new-design.md`): with only one symbol (XAUUSD) and two timeframes (M5,
> M15) in the platform, there is nothing left to build a "list of symbol/timeframe combinations
> to track" out of. **Part 10 now has zero files** — removed from both
> `backend-file-inventory.md` and `frontend-ui-file-inventory.md`'s Distribution-by-Part tables.
>
> All 9 files below (plus `types/watchlist.ts`, `lib/validations/watchlist.ts`, and the test
> files that lived under Parts 03/04/08/16 — see those docs' own 2026-07-07 notes) were deleted.
> The `Watchlist` and `WatchlistItem` Prisma models were dropped via
> `prisma/migrations/20260706000000_drop_watchlists/migration.sql`.
>
> **The content below is retained as a historical record of what this feature was**, not as a
> current-state file list. Do not use it to look for files that exist today.

---

## 📦 PART 10 - FILES COMPLETION (historical — feature removed 2026-07-07)

**File 1/9:** ✅ `app/(dashboard)/watchlist/page.tsx`
**File 2/9:** ✅ `app/(dashboard)/watchlist/watchlist-client.tsx`
**File 3/9:** ✅ `app/api/watchlist/route.ts`
**File 4/9:** ✅ `app/api/watchlist/[id]/route.ts`
**File 5/9:** ✅ `app/api/watchlist/reorder/route.ts`
**File 6/9:** ✅ `components/watchlist/symbol-selector.tsx`
**File 7/9:** ✅ `components/watchlist/timeframe-grid.tsx`
**File 8/9:** ✅ `components/watchlist/watchlist-item.tsx`
**File 9/9:** ✅ `hooks/use-watchlist.ts`

## Status Summary (historical — as of before 2026-07-07 removal)

- **Completed:** 9/9 files (100%)
- **Missing:** None
- **Current status (2026-07-07):** 0/0 — feature deleted. See the banner at the top of this
  document.

## File Details

### Frontend Components

#### File 1: `app/(dashboard)/watchlist/page.tsx`

- **Type:** Server Component (Next.js App Router)
- **Purpose:** Watchlist page entry point with server-side data fetching
- **Features:**
  - Authentication check and redirect
  - Fetches user's watchlist from database
  - Auto-creates default watchlist if doesn't exist
  - Passes initial data to client component
  - Tier-based limit calculation

#### File 2: `app/(dashboard)/watchlist/watchlist-client.tsx`

- **Type:** Client Component (Interactive UI)
- **Purpose:** Main interactive watchlist management interface
- **Features:**
  - Add/remove watchlist items
  - Symbol selector with tier filtering
  - Timeframe grid selection
  - Optimistic UI updates
  - Undo functionality (5-second window)
  - Duplicate combination prevention
  - Tier limit enforcement
  - Empty state messaging
  - Tier info card with upgrade prompt

#### File 6: `components/watchlist/symbol-selector.tsx`

- **Type:** Client Component (Reusable)
- **Purpose:** Dropdown for selecting trading symbols
- **Features:**
  - Search functionality
  - Tier-based symbol filtering (FREE: 5, PRO: 15)
  - Lock icons for PRO-only symbols
  - Symbol descriptions and icons
  - Disabled state support

#### File 7: `components/watchlist/timeframe-grid.tsx`

- **Type:** Client Component (Reusable)
- **Purpose:** Grid of selectable timeframe buttons
- **Features:**
  - 9 timeframes (M5, M15, M30, H1, H2, H4, H8, H12, D1)
  - Tier-based filtering (FREE: 3, PRO: 9)
  - Lock icons for PRO-only timeframes
  - Upgrade dialog component
  - Visual selection state
  - Affiliate pricing integration

#### File 8: `components/watchlist/watchlist-item.tsx`

- **Type:** Client Component (Reusable)
- **Purpose:** Individual watchlist item card display
- **Features:**
  - Symbol and timeframe display
  - Optional price data display
  - Status badges (support/resistance/normal)
  - Action menu (view chart, remove)
  - Delete confirmation dialog
  - Loading states
  - Timeframe name mapping

### Backend API Routes

#### File 3: `app/api/watchlist/route.ts`

- **Type:** API Route Handler
- **Methods:** GET, POST
- **Features:**
  - **GET:** Fetch user's watchlist with items
  - **POST:** Create new watchlist item
  - Tier limit validation
  - Symbol/timeframe access validation
  - Duplicate combination prevention
  - Auto-creates default watchlist

#### File 4: `app/api/watchlist/[id]/route.ts`

- **Type:** API Route Handler (Dynamic)
- **Methods:** GET, PATCH, DELETE
- **Features:**
  - **GET:** Fetch single watchlist item
  - **PATCH:** Update item order
  - **DELETE:** Remove item from watchlist
  - Ownership validation
  - Error handling

#### File 5: `app/api/watchlist/reorder/route.ts`

- **Type:** API Route Handler
- **Methods:** POST
- **Features:**
  - Bulk reorder of watchlist items
  - Accepts array of item IDs
  - Index becomes new order value
  - Ownership validation for all items
  - Transaction-based updates

### Hooks

#### File 9: `hooks/use-watchlist.ts`

- **Type:** React Hook
- **Purpose:** Watchlist data and operations management
- **Features:**
  - Fetch watchlist data
  - Add/remove items
  - Reorder items
  - Tier limit calculations
  - Error state management
  - Loading states
  - Duplicate combination checking

## Database Schema

### Watchlist Model

```prisma
model Watchlist {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  name      String
  order     Int      @default(0)
  items     WatchlistItem[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([userId, name])
  @@index([userId])
}
```

### WatchlistItem Model

```prisma
model WatchlistItem {
  id          String   @id @default(cuid())
  watchlistId String
  watchlist   Watchlist @relation(fields: [watchlistId], references: [id], onDelete: Cascade)
  userId      String
  symbol      String
  timeframe   String
  order       Int      @default(0)
  createdAt   DateTime @default(now())

  @@unique([userId, symbol, timeframe])
  @@index([watchlistId])
  @@index([userId])
}
```

## Tier-Based Access

### FREE Tier

- **Watchlist Items:** 5 maximum
- **Symbols:** 5 (BTCUSD, EURUSD, USDJPY, US30, XAUUSD)
- **Timeframes:** 3 (H1, H4, D1)

### PRO Tier

- **Watchlist Items:** 50 maximum
- **Symbols:** 15 (all major pairs)
- **Timeframes:** 9 (M5, M15, M30, H1, H2, H4, H8, H12, D1)

## Key Features Implemented

1. **Tier Validation:** Enforces symbol, timeframe, and item count limits
2. **Optimistic Updates:** Instant UI feedback with error rollback
3. **Undo Functionality:** 5-second undo window for removed items
4. **Duplicate Prevention:** Blocks duplicate symbol+timeframe combinations
5. **Search:** Symbol search by name or description
6. **Reordering:** Drag-and-drop support via reorder API
7. **Auto-Creation:** Automatic default watchlist creation
8. **Ownership Validation:** All operations validate user ownership
9. **Error Handling:** Comprehensive error messages and recovery

## Recent Updates

- ✅ Updated to reflect NEW flat 57-column MarketData schema
- ✅ Added watchlist-client.tsx component (previously undocumented)
- ✅ Confirmed all 9 files are implemented and functional
- ✅ Database schema includes unique constraints and indexes
- ✅ Full tier-based access control implemented
