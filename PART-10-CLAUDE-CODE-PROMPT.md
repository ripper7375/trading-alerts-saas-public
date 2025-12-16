# Part 10: Watchlist System - Claude Code Build Prompt

**Project:** Trading Alerts SaaS V7
**Task:** Build Part 10 (Watchlist System) autonomously
**Files to Build:** 8 files
**Estimated Time:** 3 hours
**Current Status:** Parts 6-9 complete and merged to main

---

## 🎯 YOUR MISSION

You are Claude Code, tasked with building **Part 10: Watchlist System** for the Trading Alerts SaaS V7 project. You will build 8 files autonomously following all project policies, architecture rules, and quality standards.

**Your approach:**
1. Read ALL essential files listed below (policies, architecture, requirements)
2. Build files one-by-one in the specified order
3. Follow coding patterns from policy files
4. Validate each file after creation (TypeScript, ESLint, Prettier)
5. Commit each file individually with descriptive commit messages
6. Test the watchlist page after all files are built

---

## 📋 ESSENTIAL FILES TO READ FIRST

**CRITICAL:** Read these files in order before writing any code. These files contain the "AI constitution" that guides all development.

### 1️⃣ **Project Overview & Current State**
```
PROGRESS.md                  # Current project status (Parts 6-9 complete)
README.md                    # Project overview
ARCHITECTURE.md              # System architecture and design patterns
IMPLEMENTATION-GUIDE.md      # Implementation best practices
```

### 2️⃣ **Policy Files (MUST READ - These are your rules)**
```
docs/policies/00-tier-specifications.md              # FREE vs PRO tier rules (CRITICAL)
docs/policies/01-approval-policies.md                # When to approve/fix/escalate
docs/policies/02-quality-standards.md                # TypeScript, error handling standards
docs/policies/03-architecture-rules.md               # File structure, architecture patterns
docs/policies/04-escalation-triggers.md              # When to ask for human help
docs/policies/05-coding-patterns.md                  # Copy-paste ready code patterns
docs/policies/06-aider-instructions.md               # Build workflow instructions
```

### 3️⃣ **Part 10 Requirements & Build Order**
```
docs/build-orders/part-10-watchlist.md               # Build order for all 8 files
docs/implementation-guides/v5_part_c.md              # Database schema with WatchlistItem model
docs/implementation-guides/v5_part_j.md              # Business requirements
```

### 4️⃣ **OpenAPI Specifications**
```
docs/trading_alerts_openapi.yaml                     # Next.js API contracts
```

### 5️⃣ **Seed Code References (CRITICAL - Use these patterns)**
```
seed-code/v0-components/watchlist-page-component/app/watchlist/page.tsx   # Main watchlist page
```

### 6️⃣ **Validation & Testing**
```
VALIDATION-SETUP-GUIDE.md                            # Validation tools and process
CLAUDE.md                                            # Automated validation guide
```

### 7️⃣ **Previous Work (for context and dependencies)**
```
docs/build-orders/part-02-database.md                # WatchlistItem model (DEPENDENCY)
docs/build-orders/part-04-tier-system.md             # Tier validation (DEPENDENCY)
docs/build-orders/part-09-charts.md                  # Charts (watchlist links to charts)
```

---

## 📦 PART 10 - FILES TO BUILD (In Order)

Build these 8 files in sequence:

### **File 1/8:** `app/(dashboard)/watchlist/page.tsx`
- Watchlist page with list of watchlist items
- "Add New" button to add symbol+timeframe combinations
- Show slots used vs. tier limit (e.g., "3/5 slots used")
- Tier-based add limits (FREE: 5, PRO: 50)
- Empty state when no items
- **Reference Seed Code:** `seed-code/v0-components/watchlist-page-component/app/watchlist/page.tsx`
- **Commit:** `feat(watchlist): add watchlist page`

### **File 2/8:** `app/api/watchlist/route.ts`
- **GET:** List user's watchlist items with symbol+timeframe
- **POST:** Create new watchlist item
  - Validate tier limits (FREE: 5 items, PRO: 50 items)
  - Validate symbol access (tier-based)
  - Validate timeframe access (tier-based)
  - Prevent duplicate symbol+timeframe combinations
- Include authentication check
- **Commit:** `feat(api): add watchlist CRUD endpoints`

### **File 3/8:** `app/api/watchlist/[id]/route.ts`
- **GET:** Get single watchlist item by ID
- **PATCH:** Update watchlist item (change order)
- **DELETE:** Delete watchlist item
- Include authentication and ownership check
- **Commit:** `feat(api): add watchlist detail endpoints`

### **File 4/8:** `app/api/watchlist/reorder/route.ts`
- **POST:** Reorder watchlist items
- Accept array of item IDs in new order
- Update order field for each item
- Validate ownership of all items
- **Commit:** `feat(api): add watchlist reorder endpoint`

### **File 5/8:** `components/watchlist/symbol-selector.tsx`
- Symbol dropdown component
- Show only tier-allowed symbols
- Lock icon on PRO-only symbols for FREE users
- Search/filter functionality
- Show symbol icon and description
- **Commit:** `feat(watchlist): add tier-filtered symbol selector`

### **File 6/8:** `components/watchlist/timeframe-grid.tsx`
- Timeframe selection grid/buttons
- Disable PRO timeframes for FREE users (M5, M15, M30, H2, H8, H12)
- Visual lock indicators
- Show upgrade prompt when clicking locked timeframe
- **Commit:** `feat(watchlist): add timeframe grid with tier gates`

### **File 7/8:** `components/watchlist/watchlist-item.tsx`
- Display single watchlist item card
- Show: symbol, timeframe, current price, price change, status
- "View Chart" button linking to `/charts/[symbol]/[timeframe]`
- "Remove" button with confirmation
- Status indicator (support/resistance/normal)
- Dropdown menu with actions
- **Commit:** `feat(watchlist): add watchlist item component`

### **File 8/8:** `hooks/use-watchlist.ts`
- React hook for watchlist operations
- Fetch watchlist items (useQuery)
- Add item mutation (useMutation)
- Remove item mutation
- Reorder mutation
- Tier limit checking helper
- **Commit:** `feat(watchlist): add watchlist data hook`

---

## 🔧 GIT WORKFLOW

### **Branch Strategy**
```bash
# Create new branch (MUST start with 'claude/' and end with session ID)
git checkout -b claude/watchlist-system-{SESSION_ID}

# Build files one by one, commit each file individually
# After all 8 files complete:
git push -u origin claude/watchlist-system-{SESSION_ID}
```

### **Commit Message Format**
Use conventional commits:
```
feat(watchlist): add watchlist page
feat(api): add watchlist CRUD endpoints
feat(api): add watchlist detail endpoints
fix(watchlist): correct TypeScript type error in item component
```

### **Push Requirements**
- ✅ Branch MUST start with `claude/`
- ✅ Branch MUST end with session ID
- ✅ Push ONLY after all validations pass
- ✅ Create PR after push (do NOT merge to main directly)

---

## ✅ VALIDATION REQUIREMENTS

After building each file, run validation:

```bash
# Validate TypeScript types
npm run validate:types

# Validate code quality
npm run validate:lint

# Validate formatting
npm run validate:format

# Run all validations together
npm run validate
```

### **Auto-Fix Minor Issues**
```bash
# Auto-fix ESLint and Prettier issues
npm run fix
```

### **Validation Must Pass Before Committing**
- ✅ 0 TypeScript errors
- ✅ 0 ESLint errors (warnings OK if < 3)
- ✅ All files properly formatted
- ✅ No unused imports
- ✅ All functions have return types

---

## 🎯 KEY REQUIREMENTS FOR PART 10

### **1. Watchlist Item Model (Database Structure)**
The watchlist uses a **symbol+timeframe combination** model:

```typescript
// WatchlistItem model from Prisma schema
model WatchlistItem {
  id          String    @id @default(cuid())
  watchlistId String
  watchlist   Watchlist @relation(fields: [watchlistId], references: [id], onDelete: Cascade)

  symbol      String    // e.g., "XAUUSD"
  timeframe   String    // e.g., "H1"
  order       Int       @default(0)

  createdAt   DateTime  @default(now())

  @@unique([watchlistId, symbol, timeframe])  // No duplicates!
  @@index([watchlistId])
}

model Watchlist {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  name      String
  items     WatchlistItem[]
  order     Int      @default(0)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([userId])
}
```

### **2. Tier-Based Limits (CRITICAL)**

**FREE Tier:**
- Watchlist items: **5** symbol+timeframe combinations max
- Symbols: 5 (BTCUSD, EURUSD, USDJPY, US30, XAUUSD)
- Timeframes: 3 (H1, H4, D1)

**PRO Tier:**
- Watchlist items: **50** symbol+timeframe combinations max
- Symbols: 15 (all)
- Timeframes: 9 (all)

### **3. TypeScript Compliance (CRITICAL)**
- ✅ NO `any` types allowed
- ✅ All function parameters typed
- ✅ All return types specified
- ✅ Use Prisma-generated types where applicable
- ✅ Use proper React types (`FC`, `ReactNode`, etc.)

### **4. API Route Patterns**
- ✅ Authentication required (getServerSession)
- ✅ Ownership validation (user can only access their own data)
- ✅ Tier validation before creating items
- ✅ Input validation with Zod
- ✅ Proper HTTP status codes (200, 201, 400, 401, 403, 404, 409)

### **5. Error Handling**
- ✅ Try-catch blocks in async operations
- ✅ User-friendly error messages
- ✅ Handle duplicate combination (409 Conflict)
- ✅ Handle tier limit exceeded (403 Forbidden)
- ✅ Loading states for operations

### **6. Component Patterns**
- ✅ Use shadcn/ui components (Card, Button, Badge, Select, Dialog)
- ✅ Use Lucide icons
- ✅ Responsive design (mobile-first)
- ✅ Loading and empty states

---

## 🧪 TESTING REQUIREMENTS

After building all 8 files:

### **1. Start Development Server**
```bash
npm run dev
# Should start on http://localhost:3000
```

### **2. Manual Testing Checklist**
- [ ] Visit `http://localhost:3000/watchlist`
- [ ] Verify watchlist page loads without errors
- [ ] Check empty state displays correctly
- [ ] Click "Add New" button
- [ ] Verify symbol selector shows tier-appropriate options
- [ ] Verify timeframe grid shows tier-appropriate options
- [ ] Add a watchlist item (e.g., XAUUSD + H1)
- [ ] Verify item appears in list
- [ ] Check slots counter updates (1/5 for FREE)
- [ ] Try to add duplicate combination → should show error
- [ ] Click "View Chart" → should navigate to chart page
- [ ] Click "Remove" → item should be deleted
- [ ] Test tier limit: FREE user cannot add more than 5 items

### **3. API Testing**
```bash
# GET watchlist
curl http://localhost:3000/api/watchlist

# POST new item
curl -X POST http://localhost:3000/api/watchlist \
  -H "Content-Type: application/json" \
  -d '{"symbol": "XAUUSD", "timeframe": "H4"}'

# DELETE item
curl -X DELETE http://localhost:3000/api/watchlist/{id}
```

### **4. Console Checks**
- [ ] No console errors
- [ ] No React hydration warnings
- [ ] No missing key props warnings
- [ ] API calls return correct status codes

### **5. TypeScript Build**
```bash
npm run build
# Should complete with 0 errors
```

---

## 📝 CODING PATTERNS TO FOLLOW

### **Pattern 1: Watchlist Tier Limits**
```typescript
// lib/watchlist-config.ts

export const WATCHLIST_LIMITS = {
  FREE: 5,    // Max 5 symbol+timeframe combinations
  PRO: 50,    // Max 50 symbol+timeframe combinations
} as const;

export type UserTier = 'FREE' | 'PRO';

export function getWatchlistLimit(tier: UserTier): number {
  return WATCHLIST_LIMITS[tier];
}

export function canAddWatchlistItem(tier: UserTier, currentCount: number): boolean {
  return currentCount < WATCHLIST_LIMITS[tier];
}
```

### **Pattern 2: Watchlist Page (Server Component)**
```typescript
// app/(dashboard)/watchlist/page.tsx
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db/prisma';
import { WatchlistClient } from './watchlist-client';
import { WATCHLIST_LIMITS } from '@/lib/watchlist-config';

export default async function WatchlistPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/auth/login');
  }

  const tier = (session.user.tier as 'FREE' | 'PRO') || 'FREE';
  const limit = WATCHLIST_LIMITS[tier];

  // Fetch user's default watchlist with items
  const watchlist = await prisma.watchlist.findFirst({
    where: { userId: session.user.id },
    include: {
      items: {
        orderBy: { order: 'asc' },
      },
    },
  });

  return (
    <div className="container mx-auto py-6">
      <WatchlistClient
        initialItems={watchlist?.items ?? []}
        watchlistId={watchlist?.id}
        userTier={tier}
        limit={limit}
      />
    </div>
  );
}
```

### **Pattern 3: Watchlist API Route**
```typescript
// app/api/watchlist/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';
import { canAccessSymbol, canAccessTimeframe } from '@/lib/tier-config';
import { WATCHLIST_LIMITS } from '@/lib/watchlist-config';

const createItemSchema = z.object({
  symbol: z.string().min(1),
  timeframe: z.string().min(1),
});

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const watchlist = await prisma.watchlist.findFirst({
      where: { userId: session.user.id },
      include: {
        items: {
          orderBy: { order: 'asc' },
        },
      },
    });

    return NextResponse.json({
      watchlist,
      items: watchlist?.items ?? [],
    });
  } catch (error) {
    console.error('Get watchlist error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch watchlist' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validation = createItemSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { symbol, timeframe } = validation.data;
    const tier = (session.user.tier as 'FREE' | 'PRO') || 'FREE';

    // Validate symbol access
    if (!canAccessSymbol(tier, symbol)) {
      return NextResponse.json(
        { error: `Symbol ${symbol} is not available in your ${tier} tier` },
        { status: 403 }
      );
    }

    // Validate timeframe access
    if (!canAccessTimeframe(tier, timeframe)) {
      return NextResponse.json(
        { error: `Timeframe ${timeframe} is not available in your ${tier} tier` },
        { status: 403 }
      );
    }

    // Get or create default watchlist
    let watchlist = await prisma.watchlist.findFirst({
      where: { userId: session.user.id },
      include: { items: true },
    });

    if (!watchlist) {
      watchlist = await prisma.watchlist.create({
        data: {
          userId: session.user.id,
          name: 'My Watchlist',
        },
        include: { items: true },
      });
    }

    // Check tier limit
    const currentCount = watchlist.items.length;
    const limit = WATCHLIST_LIMITS[tier];

    if (currentCount >= limit) {
      return NextResponse.json(
        {
          error: `Watchlist limit reached`,
          message: `${tier} tier allows maximum ${limit} items. Upgrade to add more.`,
        },
        { status: 403 }
      );
    }

    // Check for duplicate
    const existing = watchlist.items.find(
      (item) => item.symbol === symbol && item.timeframe === timeframe
    );

    if (existing) {
      return NextResponse.json(
        { error: 'This symbol+timeframe combination already exists in your watchlist' },
        { status: 409 }
      );
    }

    // Create new item
    const newItem = await prisma.watchlistItem.create({
      data: {
        watchlistId: watchlist.id,
        symbol,
        timeframe,
        order: currentCount,
      },
    });

    return NextResponse.json({ item: newItem }, { status: 201 });
  } catch (error) {
    console.error('Create watchlist item error:', error);
    return NextResponse.json(
      { error: 'Failed to create watchlist item' },
      { status: 500 }
    );
  }
}
```

### **Pattern 4: Watchlist Item Component**
```typescript
// components/watchlist/watchlist-item.tsx
'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { BarChart3, MoreVertical, Trash2, TrendingUp, TrendingDown } from 'lucide-react';
import Link from 'next/link';

interface WatchlistItemProps {
  id: string;
  symbol: string;
  timeframe: string;
  currentPrice?: number;
  priceChange?: number;
  priceChangePercent?: number;
  status?: 'support' | 'resistance' | 'normal';
  lastUpdated?: string;
  onRemove: (id: string) => void;
}

export function WatchlistItem({
  id,
  symbol,
  timeframe,
  currentPrice = 0,
  priceChange = 0,
  priceChangePercent = 0,
  status = 'normal',
  lastUpdated = 'N/A',
  onRemove,
}: WatchlistItemProps) {
  const isPositive = priceChange >= 0;

  const statusColors = {
    support: 'border-green-500 bg-green-50',
    resistance: 'border-red-500 bg-red-50',
    normal: 'border-blue-500 bg-blue-50',
  };

  const statusBadgeColors = {
    support: 'bg-green-100 text-green-800',
    resistance: 'bg-red-100 text-red-800',
    normal: 'bg-blue-100 text-blue-800',
  };

  return (
    <Card className={`border-l-4 ${statusColors[status]} hover:shadow-lg transition-shadow`}>
      <CardContent className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-xl font-bold text-gray-900">
              {symbol} - {timeframe}
            </h3>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/charts/${symbol}/${timeframe}`}>
                  <BarChart3 className="h-4 w-4 mr-2" />
                  View Chart
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onRemove(id)}
                className="text-red-600"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Remove
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Price */}
        <div className="mb-4">
          <p className="text-2xl font-bold text-gray-900">
            ${currentPrice.toFixed(2)}
          </p>
          <div className={`flex items-center gap-1 ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
            {isPositive ? (
              <TrendingUp className="h-4 w-4" />
            ) : (
              <TrendingDown className="h-4 w-4" />
            )}
            <span>
              {isPositive ? '+' : ''}${Math.abs(priceChange).toFixed(2)} ({isPositive ? '+' : ''}{priceChangePercent.toFixed(2)}%)
            </span>
          </div>
        </div>

        {/* Status Badge */}
        <Badge className={`${statusBadgeColors[status]} mb-3`}>
          {status === 'support' && '✓ Near Support'}
          {status === 'resistance' && '⚠️ Near Resistance'}
          {status === 'normal' && '📊 Normal Range'}
        </Badge>

        {/* Last Updated */}
        <p className="text-xs text-gray-500 mb-4">Updated {lastUpdated}</p>

        {/* Actions */}
        <div className="flex gap-2">
          <Button asChild className="flex-1">
            <Link href={`/charts/${symbol}/${timeframe}`}>
              <BarChart3 className="h-4 w-4 mr-2" />
              View Chart
            </Link>
          </Button>
          <Button
            variant="outline"
            onClick={() => onRemove(id)}
            className="text-red-600 hover:text-red-700"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

### **Pattern 5: useWatchlist Hook**
```typescript
// hooks/use-watchlist.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './use-auth';
import { WATCHLIST_LIMITS } from '@/lib/watchlist-config';

interface WatchlistItem {
  id: string;
  symbol: string;
  timeframe: string;
  order: number;
  createdAt: string;
}

interface WatchlistResponse {
  watchlist: {
    id: string;
    name: string;
    items: WatchlistItem[];
  } | null;
  items: WatchlistItem[];
}

export function useWatchlist() {
  const queryClient = useQueryClient();
  const { tier } = useAuth();

  const limit = WATCHLIST_LIMITS[tier];

  // Fetch watchlist
  const {
    data,
    isLoading,
    error,
  } = useQuery<WatchlistResponse>({
    queryKey: ['watchlist'],
    queryFn: async () => {
      const res = await fetch('/api/watchlist');
      if (!res.ok) {
        throw new Error('Failed to fetch watchlist');
      }
      return res.json();
    },
  });

  // Add item mutation
  const addItem = useMutation({
    mutationFn: async ({ symbol, timeframe }: { symbol: string; timeframe: string }) => {
      const res = await fetch('/api/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, timeframe }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to add item');
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlist'] });
    },
  });

  // Remove item mutation
  const removeItem = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/watchlist/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        throw new Error('Failed to remove item');
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlist'] });
    },
  });

  // Reorder mutation
  const reorderItems = useMutation({
    mutationFn: async (itemIds: string[]) => {
      const res = await fetch('/api/watchlist/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemIds }),
      });

      if (!res.ok) {
        throw new Error('Failed to reorder items');
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlist'] });
    },
  });

  const items = data?.items ?? [];
  const currentCount = items.length;
  const canAdd = currentCount < limit;
  const slotsRemaining = limit - currentCount;

  return {
    items,
    isLoading,
    error,
    addItem,
    removeItem,
    reorderItems,
    currentCount,
    limit,
    canAdd,
    slotsRemaining,
  };
}
```

### **Pattern 6: Symbol Selector Component**
```typescript
// components/watchlist/symbol-selector.tsx
'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Lock } from 'lucide-react';
import { FREE_SYMBOLS, PRO_SYMBOLS, UserTier } from '@/lib/tier-config';

interface SymbolSelectorProps {
  userTier: UserTier;
  selectedSymbol: string;
  onSymbolChange: (symbol: string) => void;
}

const SYMBOL_INFO: Record<string, { name: string; icon: string }> = {
  BTCUSD: { name: 'Bitcoin', icon: '₿' },
  EURUSD: { name: 'Euro / US Dollar', icon: '€' },
  USDJPY: { name: 'US Dollar / Yen', icon: '¥' },
  US30: { name: 'Dow Jones', icon: '📈' },
  XAUUSD: { name: 'Gold', icon: '🥇' },
  AUDJPY: { name: 'Australian Dollar / Yen', icon: '🦘' },
  AUDUSD: { name: 'Australian Dollar / USD', icon: '🇦🇺' },
  ETHUSD: { name: 'Ethereum', icon: '⟠' },
  GBPJPY: { name: 'British Pound / Yen', icon: '£' },
  GBPUSD: { name: 'British Pound / USD', icon: '💷' },
  NDX100: { name: 'Nasdaq 100', icon: '📊' },
  NZDUSD: { name: 'New Zealand Dollar / USD', icon: '🥝' },
  USDCAD: { name: 'USD / Canadian Dollar', icon: '🍁' },
  USDCHF: { name: 'USD / Swiss Franc', icon: '🇨🇭' },
  XAGUSD: { name: 'Silver', icon: '🥈' },
};

export function SymbolSelector({
  userTier,
  selectedSymbol,
  onSymbolChange,
}: SymbolSelectorProps) {
  const allowedSymbols = userTier === 'PRO' ? PRO_SYMBOLS : FREE_SYMBOLS;

  return (
    <Select value={selectedSymbol} onValueChange={onSymbolChange}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Select a symbol" />
      </SelectTrigger>
      <SelectContent>
        {PRO_SYMBOLS.map((symbol) => {
          const isLocked = !allowedSymbols.includes(symbol);
          const info = SYMBOL_INFO[symbol];

          return (
            <SelectItem
              key={symbol}
              value={symbol}
              disabled={isLocked}
              className="py-3"
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">{info?.icon}</span>
                <div className="flex-1">
                  <div className="font-semibold">{symbol}</div>
                  <div className="text-xs text-gray-500">{info?.name}</div>
                </div>
                {isLocked && <Lock className="h-4 w-4 text-gray-400" />}
                {!allowedSymbols.includes(symbol) && (
                  <Badge variant="secondary" className="bg-purple-100 text-purple-700 text-xs">
                    PRO
                  </Badge>
                )}
              </div>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
```

---

## 🚨 CRITICAL RULES

### **DO:**
- ✅ Read ALL policy files before writing code
- ✅ Follow tier-based limits EXACTLY (FREE: 5, PRO: 50)
- ✅ Validate symbol AND timeframe access
- ✅ Prevent duplicate combinations (symbol+timeframe)
- ✅ Use TypeScript strictly (no `any` types)
- ✅ Reference seed code for component patterns
- ✅ Validate after each file
- ✅ Commit each file individually
- ✅ Use shadcn/ui components consistently
- ✅ Test thoroughly before pushing

### **DON'T:**
- ❌ Skip reading policy files
- ❌ Use `any` types
- ❌ Allow users to exceed tier limits
- ❌ Allow duplicate symbol+timeframe combinations
- ❌ Commit multiple files at once (commit one-by-one)
- ❌ Push without validation passing
- ❌ Skip ownership validation in API routes
- ❌ Push to main branch directly (use feature branch)
- ❌ Skip testing

---

## 🎯 SUCCESS CRITERIA

Part 10 is complete when:

- ✅ All 8 files created and committed
- ✅ All TypeScript validations pass (0 errors)
- ✅ All ESLint checks pass
- ✅ Watchlist page loads at `/watchlist` without errors
- ✅ Users can add symbol+timeframe combinations
- ✅ Tier limits enforced (FREE: 5, PRO: 50)
- ✅ Symbol/timeframe filtering works correctly
- ✅ Duplicate combinations prevented
- ✅ Items can be removed
- ✅ "View Chart" links work
- ✅ All API endpoints work (GET, POST, DELETE)
- ✅ All manual tests pass
- ✅ Code pushed to feature branch
- ✅ PR created (ready for review)

---

## 📊 PROGRESS TRACKING

Use the TodoWrite tool to track your progress:

```
1. Read all policy and architecture files
2. Build File 1/8: app/(dashboard)/watchlist/page.tsx
3. Build File 2/8: app/api/watchlist/route.ts
4. Build File 3/8: app/api/watchlist/[id]/route.ts
5. Build File 4/8: app/api/watchlist/reorder/route.ts
6. Build File 5/8: components/watchlist/symbol-selector.tsx
7. Build File 6/8: components/watchlist/timeframe-grid.tsx
8. Build File 7/8: components/watchlist/watchlist-item.tsx
9. Build File 8/8: hooks/use-watchlist.ts
10. Run full validation suite
11. Test watchlist manually
12. Push to feature branch
13. Create pull request
```

---

## 🚀 START HERE

1. **First, read these files in order:**
   - `PROGRESS.md` - Understand current state
   - `docs/policies/00-tier-specifications.md` - Learn tier system (CRITICAL)
   - `docs/policies/05-coding-patterns.md` - Learn code patterns
   - `docs/build-orders/part-10-watchlist.md` - Understand Part 10
   - `seed-code/v0-components/watchlist-page-component/app/watchlist/page.tsx` - Reference implementation

2. **Then, create your git branch:**
   ```bash
   git checkout main
   git pull origin main
   git checkout -b claude/watchlist-system-{SESSION_ID}
   ```

3. **Start building File 1/8:**
   - Read the build order for File 1
   - Reference seed code
   - Write the file following patterns
   - Validate: `npm run validate`
   - Fix any issues: `npm run fix`
   - Commit: `git commit -m "feat(watchlist): add watchlist page"`

4. **Repeat for Files 2-8**

5. **After all files complete:**
   - Run final validation
   - Test manually
   - Push to remote
   - Create PR

---

## 💬 WHEN TO ASK FOR HELP

Escalate to the user if:

- 🚨 Critical security issues found
- 🚨 Ambiguous requirements (can't determine correct approach)
- 🚨 Missing dependencies or seed code
- 🚨 Validation errors you can't resolve
- 🚨 Database schema questions (WatchlistItem model)
- 🚨 Unclear tier validation logic

Otherwise, work autonomously following the policies!

---

**Good luck! Build Part 10 with quality and precision. The user trusts you to follow all policies and deliver production-ready code.** 🚀
