# Part 11: Alerts System - Claude Code Build Prompt

**Project:** Trading Alerts SaaS V7
**Task:** Build Part 11 (Alerts System) autonomously
**Files to Build:** 10 files
**Estimated Time:** 4 hours
**Current Status:** Parts 6-10 complete and merged to main

---

## 🎯 YOUR MISSION

You are Claude Code, tasked with building **Part 11: Alerts System** for the Trading Alerts SaaS V7 project. You will build 10 files autonomously following all project policies, architecture rules, and quality standards.

**Your approach:**
1. Read ALL essential files listed below (policies, architecture, requirements)
2. Build files one-by-one in the specified order
3. Follow coding patterns from policy files
4. Validate each file after creation (TypeScript, ESLint, Prettier)
5. Commit each file individually with descriptive commit messages
6. Test the alerts page after all files are built

---

## 📋 ESSENTIAL FILES TO READ FIRST

**CRITICAL:** Read these files in order before writing any code. These files contain the "AI constitution" that guides all development.

### 1️⃣ **Project Overview & Current State**
```
PROGRESS-part-2.md                   # Current project status (Parts 6-10 complete)
README.md                            # Project overview
ARCHITECTURE.md                      # System architecture and design patterns
IMPLEMENTATION-GUIDE.md              # Implementation best practices
```

### 2️⃣ **Policy Files (MUST READ - These are your rules)**
```
docs/policies/00-tier-specifications.md              # FREE vs PRO tier rules (CRITICAL)
docs/policies/01-approval-policies.md                # When to approve/fix/escalate
docs/policies/02-quality-standards.md                # TypeScript, error handling standards
docs/policies/03-architecture-rules.md               # File structure, architecture patterns
docs/policies/04-escalation-triggers.md              # When to ask for human help
docs/policies/05-coding-patterns-part-1.md           # Copy-paste ready code patterns (Part 1)
docs/policies/05-coding-patterns-part-2.md           # Copy-paste ready code patterns (Part 2)
docs/policies/06-aider-instructions.md               # Build workflow instructions
```

### 3️⃣ **Part 11 Requirements & Build Order**
```
docs/build-orders/part-11-alerts.md                  # Build order for all 10 files
docs/implementation-guides/v5_part_k.md              # Alerts system business logic
```

### 4️⃣ **OpenAPI Specifications**
```
docs/trading_alerts_openapi.yaml                     # Next.js API contracts
```

### 5️⃣ **Seed Code References (CRITICAL - Use these patterns)**
```
seed-code/v0-components/alerts-management-page/app/page.tsx               # Alerts list page
seed-code/v0-components/alert-card-component/components/alert-card.tsx    # Alert card component
seed-code/v0-components/create-price-alert-modal/components/create-alert-modal.tsx  # Create alert modal
```

### 6️⃣ **Validation & Testing**
```
VALIDATION-SETUP-GUIDE.md                            # Validation tools and process
CLAUDE.md                                            # Automated validation guide
```

### 7️⃣ **Previous Work (for context and dependencies)**
```
docs/build-orders/part-02-database.md                # Alert model (DEPENDENCY)
docs/build-orders/part-04-tier-system.md             # Tier validation (DEPENDENCY)
docs/build-orders/part-07-indicators-api.md          # Flask MT5 API for prices
```

---

## 📦 PART 11 - FILES TO BUILD (In Order)

Build these 10 files in sequence:

### **File 1/10:** `app/(dashboard)/alerts/page.tsx`
- Alerts list page with tabs (Active/Paused/Triggered)
- "Create New Alert" button
- Summary cards (active count, paused count, triggered count)
- Filter by status and symbol
- Search functionality
- **Reference Seed Code:** `seed-code/v0-components/alerts-management-page/app/page.tsx`
- **Commit:** `feat(alerts): add alerts list page`

### **File 2/10:** `app/(dashboard)/alerts/new/page.tsx`
- Create alert page
- Alert form with tier-filtered symbols
- Condition type selector (price_above, price_below, price_equals)
- Target value input
- Show alert limit status
- **Commit:** `feat(alerts): add create alert page`

### **File 3/10:** `app/api/alerts/route.ts`
- **GET:** List user alerts with filters
- **POST:** Create alert with validations:
  - Check tier limits (FREE: 5, PRO: 20)
  - Validate symbol access (tier-based)
  - Validate timeframe access
  - Validate target value
- Return proper error codes
- **Commit:** `feat(api): add alerts CRUD endpoints`

### **File 4/10:** `app/api/alerts/[id]/route.ts`
- **GET:** Get alert by ID (with ownership check)
- **PATCH:** Update alert (status, target value)
- **DELETE:** Delete alert (soft delete → set status to 'cancelled')
- Authentication and ownership validation
- **Commit:** `feat(api): add alert detail endpoints`

### **File 5/10:** `components/alerts/alert-list.tsx`
- Alert list component
- Status badges (Active=green, Paused=gray, Triggered=orange)
- Display: symbol, timeframe, condition, target, status
- Bulk selection and actions
- **Commit:** `feat(alerts): add alert list component`

### **File 6/10:** `components/alerts/alert-form.tsx`
- Create/edit alert form
- Symbol selector (tier-filtered)
- Timeframe selector
- Condition type (radio buttons)
- Target value input with validation
- Notification preferences (email, push)
- **Reference Seed Code:** `seed-code/v0-components/create-price-alert-modal/components/create-alert-modal.tsx`
- **Commit:** `feat(alerts): add alert form component`

### **File 7/10:** `components/alerts/alert-card.tsx`
- Individual alert display card
- Show: name, symbol, target price, current price, distance
- Status badge
- Action buttons (View Chart, Edit, Delete)
- **Reference Seed Code:** `seed-code/v0-components/alert-card-component/components/alert-card.tsx`
- **Commit:** `feat(alerts): add alert card component`

### **File 8/10:** `lib/jobs/alert-checker.ts`
- Background job to check alert conditions
- Fetch current prices from MT5 service
- Check condition (price_above, price_below, price_equals)
- Trigger alerts when conditions met
- Create notification records
- **Commit:** `feat(alerts): add alert checking job`

### **File 9/10:** `lib/jobs/queue.ts`
- Job queue setup (simple setTimeout-based or BullMQ)
- Schedule alert checker to run every minute
- Job logging
- Error handling
- **Commit:** `feat(alerts): add job queue`

### **File 10/10:** `hooks/use-alerts.ts`
- React hook for alerts operations
- List alerts (useQuery)
- Create alert mutation
- Update alert mutation
- Delete alert mutation
- Tier limit checking helper
- **Commit:** `feat(alerts): add alerts data hook`

---

## 🔧 GIT WORKFLOW

### **Branch Strategy**
```bash
# Create new branch (MUST start with 'claude/' and end with session ID)
git checkout -b claude/alerts-system-{SESSION_ID}

# Build files one by one, commit each file individually
# After all 10 files complete:
git push -u origin claude/alerts-system-{SESSION_ID}
```

### **Commit Message Format**
Use conventional commits:
```
feat(alerts): add alerts list page
feat(api): add alerts CRUD endpoints
feat(alerts): add alert form component
fix(alerts): correct TypeScript type error in alert card
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

## 🎯 KEY REQUIREMENTS FOR PART 11

### **1. Alert Data Model**
```typescript
// From Prisma schema
model Alert {
  id            String       @id @default(cuid())
  userId        String
  user          User         @relation(fields: [userId], references: [id], onDelete: Cascade)

  symbol        String       // e.g., "XAUUSD"
  timeframe     String       // e.g., "H1"
  conditionType String       // "price_above" | "price_below" | "price_equals"
  targetValue   Float        // Target price
  status        AlertStatus  @default(ACTIVE)
  name          String?      // Optional custom name

  triggeredAt   DateTime?
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt

  notifications AlertNotification[]

  @@index([userId, status])
  @@index([status])
}

enum AlertStatus {
  ACTIVE
  PAUSED
  TRIGGERED
  CANCELLED
}
```

### **2. Tier-Based Alert Limits (CRITICAL)**

**FREE Tier:**
- Maximum **5** active alerts
- Only tier-allowed symbols (5 symbols: BTCUSD, EURUSD, USDJPY, US30, XAUUSD)
- All 3 FREE timeframes (H1, H4, D1)

**PRO Tier:**
- Maximum **20** active alerts
- All 15 PRO symbols
- All 9 PRO timeframes

**Validation Rules:**
- Check current alert count before creating new alert
- Return 403 if limit exceeded with upgrade prompt
- Validate symbol is allowed for user's tier
- Return 403 if symbol not allowed

### **3. Alert Condition Types**
```typescript
type ConditionType = 'price_above' | 'price_below' | 'price_equals';

function checkCondition(
  currentPrice: number,
  conditionType: ConditionType,
  targetValue: number
): boolean {
  switch (conditionType) {
    case 'price_above':
      return currentPrice > targetValue;
    case 'price_below':
      return currentPrice < targetValue;
    case 'price_equals':
      // Allow 0.5% tolerance
      const tolerance = targetValue * 0.005;
      return Math.abs(currentPrice - targetValue) <= tolerance;
    default:
      return false;
  }
}
```

### **4. TypeScript Compliance (CRITICAL)**
- ✅ NO `any` types allowed
- ✅ All function parameters typed
- ✅ All return types specified
- ✅ Use Prisma-generated types where applicable
- ✅ Use proper React types (`FC`, `ReactNode`, etc.)

### **5. API Route Patterns**
- ✅ Authentication required (getServerSession)
- ✅ Ownership validation (user can only access their own alerts)
- ✅ Tier validation before creating alerts
- ✅ Input validation with Zod
- ✅ Proper HTTP status codes (200, 201, 400, 401, 403, 404)

### **6. Error Codes**
```typescript
// Alert limit exceeded
{ status: 403, error: 'Alert limit exceeded', code: 'ALERT_LIMIT_EXCEEDED' }

// Symbol not allowed
{ status: 403, error: 'Symbol not allowed', code: 'SYMBOL_NOT_ALLOWED' }

// Invalid target value
{ status: 400, error: 'Invalid target value', code: 'INVALID_TARGET_VALUE' }

// Alert not found
{ status: 404, error: 'Alert not found', code: 'ALERT_NOT_FOUND' }
```

---

## 🧪 TESTING REQUIREMENTS

After building all 10 files:

### **1. Start Development Server**
```bash
npm run dev
# Should start on http://localhost:3000
```

### **2. Manual Testing Checklist**
- [ ] Visit `http://localhost:3000/alerts`
- [ ] Verify alerts page loads without errors
- [ ] Check summary cards show correct counts
- [ ] Click "Create New Alert" button
- [ ] Verify symbol selector shows tier-appropriate options
- [ ] Select condition type (above/below/equals)
- [ ] Enter target value
- [ ] Submit form → alert created
- [ ] Verify alert appears in Active tab
- [ ] Test status filter (Active/Paused/Triggered)
- [ ] Click "View Chart" → navigate to chart page
- [ ] Click "Edit" → edit form opens
- [ ] Click "Delete" → confirm and delete
- [ ] Test tier limit: FREE user cannot create more than 5 alerts

### **3. API Testing**
```bash
# GET alerts
curl http://localhost:3000/api/alerts

# POST new alert
curl -X POST http://localhost:3000/api/alerts \
  -H "Content-Type: application/json" \
  -d '{"symbol": "XAUUSD", "timeframe": "H1", "conditionType": "price_above", "targetValue": 2650.00}'

# PATCH alert
curl -X PATCH http://localhost:3000/api/alerts/{id} \
  -H "Content-Type: application/json" \
  -d '{"status": "PAUSED"}'

# DELETE alert
curl -X DELETE http://localhost:3000/api/alerts/{id}
```

### **4. Console Checks**
- [ ] No console errors
- [ ] No React hydration warnings
- [ ] API calls return correct status codes

### **5. TypeScript Build**
```bash
npm run build
# Should complete with 0 errors
```

---

## 📝 CODING PATTERNS TO FOLLOW

### **Pattern 1: Alert Tier Limits**
```typescript
// lib/alert-config.ts

export const ALERT_LIMITS = {
  FREE: 5,    // Max 5 active alerts
  PRO: 20,    // Max 20 active alerts
} as const;

export type UserTier = 'FREE' | 'PRO';
export type ConditionType = 'price_above' | 'price_below' | 'price_equals';

export function getAlertLimit(tier: UserTier): number {
  return ALERT_LIMITS[tier];
}

export function canCreateAlert(tier: UserTier, currentCount: number): boolean {
  return currentCount < ALERT_LIMITS[tier];
}

export function checkAlertCondition(
  currentPrice: number,
  conditionType: ConditionType,
  targetValue: number
): boolean {
  switch (conditionType) {
    case 'price_above':
      return currentPrice > targetValue;
    case 'price_below':
      return currentPrice < targetValue;
    case 'price_equals':
      const tolerance = targetValue * 0.005; // 0.5% tolerance
      return Math.abs(currentPrice - targetValue) <= tolerance;
    default:
      return false;
  }
}
```

### **Pattern 2: Alerts API Route**
```typescript
// app/api/alerts/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';
import { canAccessSymbol, canAccessTimeframe } from '@/lib/tier-config';
import { ALERT_LIMITS } from '@/lib/alert-config';

const createAlertSchema = z.object({
  symbol: z.string().min(1),
  timeframe: z.string().min(1),
  conditionType: z.enum(['price_above', 'price_below', 'price_equals']),
  targetValue: z.number().positive(),
  name: z.string().max(100).optional(),
});

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    const where: Record<string, unknown> = { userId: session.user.id };
    if (status) {
      where.status = status.toUpperCase();
    }

    const alerts = await prisma.alert.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ alerts });
  } catch (error) {
    console.error('Get alerts error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch alerts' },
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
    const validation = createAlertSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { symbol, timeframe, conditionType, targetValue, name } = validation.data;
    const tier = (session.user.tier as 'FREE' | 'PRO') || 'FREE';

    // Validate symbol access
    if (!canAccessSymbol(tier, symbol)) {
      return NextResponse.json(
        {
          error: 'Symbol not allowed',
          message: `${symbol} is not available on the ${tier} tier`,
          code: 'SYMBOL_NOT_ALLOWED',
          upgradeUrl: '/pricing',
        },
        { status: 403 }
      );
    }

    // Validate timeframe access
    if (!canAccessTimeframe(tier, timeframe)) {
      return NextResponse.json(
        {
          error: 'Timeframe not allowed',
          message: `${timeframe} is not available on the ${tier} tier`,
          code: 'TIMEFRAME_NOT_ALLOWED',
          upgradeUrl: '/pricing',
        },
        { status: 403 }
      );
    }

    // Check alert limit
    const currentAlertCount = await prisma.alert.count({
      where: {
        userId: session.user.id,
        status: 'ACTIVE',
      },
    });

    const limit = ALERT_LIMITS[tier];

    if (currentAlertCount >= limit) {
      return NextResponse.json(
        {
          error: 'Alert limit exceeded',
          message: `You have reached your ${tier} tier limit of ${limit} alerts`,
          code: 'ALERT_LIMIT_EXCEEDED',
          upgradeUrl: '/pricing',
        },
        { status: 403 }
      );
    }

    // Create alert
    const alert = await prisma.alert.create({
      data: {
        userId: session.user.id,
        symbol,
        timeframe,
        conditionType,
        targetValue,
        name: name || `${symbol} ${timeframe} Alert`,
        status: 'ACTIVE',
      },
    });

    return NextResponse.json({ alert }, { status: 201 });
  } catch (error) {
    console.error('Create alert error:', error);
    return NextResponse.json(
      { error: 'Failed to create alert' },
      { status: 500 }
    );
  }
}
```

### **Pattern 3: Alert Card Component**
```typescript
// components/alerts/alert-card.tsx
'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { BarChart3, MoreVertical, Pencil, Trash2, Pause, Play } from 'lucide-react';
import Link from 'next/link';

interface AlertCardProps {
  id: string;
  name: string;
  symbol: string;
  timeframe: string;
  conditionType: 'price_above' | 'price_below' | 'price_equals';
  targetValue: number;
  currentPrice?: number;
  status: 'ACTIVE' | 'PAUSED' | 'TRIGGERED' | 'CANCELLED';
  createdAt: string;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
}

export function AlertCard({
  id,
  name,
  symbol,
  timeframe,
  conditionType,
  targetValue,
  currentPrice = 0,
  status,
  createdAt,
  onEdit,
  onDelete,
  onPause,
  onResume,
}: AlertCardProps) {
  const statusConfig = {
    ACTIVE: { label: 'Active', color: 'bg-green-100 text-green-800', icon: '🟢' },
    PAUSED: { label: 'Paused', color: 'bg-gray-100 text-gray-800', icon: '⏸️' },
    TRIGGERED: { label: 'Triggered', color: 'bg-orange-100 text-orange-800', icon: '✅' },
    CANCELLED: { label: 'Cancelled', color: 'bg-red-100 text-red-800', icon: '❌' },
  };

  const conditionLabels = {
    price_above: 'Price Above',
    price_below: 'Price Below',
    price_equals: 'Price Equals',
  };

  const distance = currentPrice - targetValue;
  const distancePercent = (distance / targetValue) * 100;

  return (
    <Card className="border-l-4 border-l-blue-500 hover:shadow-lg transition-shadow">
      <CardContent className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900">{name}</h3>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary">{symbol}</Badge>
              <span className="text-sm text-gray-500">{timeframe}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={statusConfig[status].color}>
              {statusConfig[status].icon} {statusConfig[status].label}
            </Badge>
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
                <DropdownMenuItem onClick={() => onEdit(id)}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                {status === 'ACTIVE' && (
                  <DropdownMenuItem onClick={() => onPause(id)}>
                    <Pause className="h-4 w-4 mr-2" />
                    Pause
                  </DropdownMenuItem>
                )}
                {status === 'PAUSED' && (
                  <DropdownMenuItem onClick={() => onResume(id)}>
                    <Play className="h-4 w-4 mr-2" />
                    Resume
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => onDelete(id)} className="text-red-600">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Condition */}
        <div className="mb-4">
          <p className="text-sm text-gray-600 mb-1">{conditionLabels[conditionType]}</p>
          <p className="text-2xl font-bold text-gray-900">${targetValue.toFixed(2)}</p>
        </div>

        {/* Current Price & Distance */}
        {currentPrice > 0 && (
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Current Price</span>
              <span className="font-semibold">${currentPrice.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center mt-1">
              <span className="text-sm text-gray-600">Distance</span>
              <span className={distance >= 0 ? 'text-green-600' : 'text-red-600'}>
                {distance >= 0 ? '+' : ''}${distance.toFixed(2)} ({distancePercent.toFixed(2)}%)
              </span>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-between items-center pt-4 border-t">
          <span className="text-xs text-gray-500">
            Created {new Date(createdAt).toLocaleDateString()}
          </span>
          <Button asChild size="sm">
            <Link href={`/charts/${symbol}/${timeframe}`}>
              <BarChart3 className="h-4 w-4 mr-2" />
              View Chart
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

### **Pattern 4: useAlerts Hook**
```typescript
// hooks/use-alerts.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './use-auth';
import { ALERT_LIMITS } from '@/lib/alert-config';

interface Alert {
  id: string;
  symbol: string;
  timeframe: string;
  conditionType: 'price_above' | 'price_below' | 'price_equals';
  targetValue: number;
  status: 'ACTIVE' | 'PAUSED' | 'TRIGGERED' | 'CANCELLED';
  name: string;
  createdAt: string;
  updatedAt: string;
  triggeredAt?: string;
}

interface CreateAlertInput {
  symbol: string;
  timeframe: string;
  conditionType: 'price_above' | 'price_below' | 'price_equals';
  targetValue: number;
  name?: string;
}

export function useAlerts(status?: string) {
  const queryClient = useQueryClient();
  const { tier } = useAuth();

  const limit = ALERT_LIMITS[tier];

  // Fetch alerts
  const {
    data,
    isLoading,
    error,
  } = useQuery<{ alerts: Alert[] }>({
    queryKey: ['alerts', status],
    queryFn: async () => {
      const params = status ? `?status=${status}` : '';
      const res = await fetch(`/api/alerts${params}`);
      if (!res.ok) {
        throw new Error('Failed to fetch alerts');
      }
      return res.json();
    },
  });

  // Create alert mutation
  const createAlert = useMutation({
    mutationFn: async (input: CreateAlertInput) => {
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to create alert');
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
  });

  // Update alert mutation
  const updateAlert = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; status?: string; targetValue?: number }) => {
      const res = await fetch(`/api/alerts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        throw new Error('Failed to update alert');
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
  });

  // Delete alert mutation
  const deleteAlert = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/alerts/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        throw new Error('Failed to delete alert');
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
  });

  const alerts = data?.alerts ?? [];
  const activeAlerts = alerts.filter((a) => a.status === 'ACTIVE');
  const currentCount = activeAlerts.length;
  const canCreate = currentCount < limit;
  const alertsRemaining = limit - currentCount;

  return {
    alerts,
    activeAlerts,
    isLoading,
    error,
    createAlert,
    updateAlert,
    deleteAlert,
    currentCount,
    limit,
    canCreate,
    alertsRemaining,
  };
}
```

### **Pattern 5: Alert Checker Job**
```typescript
// lib/jobs/alert-checker.ts
import { prisma } from '@/lib/db/prisma';
import { checkAlertCondition } from '@/lib/alert-config';

interface PriceData {
  symbol: string;
  timeframe: string;
  price: number;
}

async function fetchCurrentPrice(symbol: string, timeframe: string): Promise<number> {
  // Fetch from MT5 service or cached indicator data
  try {
    const response = await fetch(
      `${process.env.MT5_API_URL}/api/mt5/price?symbol=${symbol}&timeframe=${timeframe}`
    );

    if (!response.ok) {
      throw new Error('Failed to fetch price');
    }

    const data = await response.json();
    return data.price;
  } catch (error) {
    console.error(`Error fetching price for ${symbol}/${timeframe}:`, error);
    return 0;
  }
}

export async function checkAlerts(): Promise<void> {
  console.log('[AlertChecker] Starting alert check...');

  try {
    // Fetch all active alerts
    const activeAlerts = await prisma.alert.findMany({
      where: { status: 'ACTIVE' },
      include: { user: true },
    });

    console.log(`[AlertChecker] Found ${activeAlerts.length} active alerts`);

    // Group by symbol/timeframe to minimize API calls
    const symbolTimeframes = new Map<string, typeof activeAlerts>();

    for (const alert of activeAlerts) {
      const key = `${alert.symbol}-${alert.timeframe}`;
      if (!symbolTimeframes.has(key)) {
        symbolTimeframes.set(key, []);
      }
      symbolTimeframes.get(key)!.push(alert);
    }

    // Check each symbol/timeframe combination
    for (const [key, alerts] of symbolTimeframes) {
      const [symbol, timeframe] = key.split('-');
      const currentPrice = await fetchCurrentPrice(symbol, timeframe);

      if (currentPrice === 0) continue;

      for (const alert of alerts) {
        const conditionMet = checkAlertCondition(
          currentPrice,
          alert.conditionType as 'price_above' | 'price_below' | 'price_equals',
          alert.targetValue
        );

        if (conditionMet) {
          console.log(`[AlertChecker] Alert triggered: ${alert.id} (${alert.symbol} ${alert.conditionType} ${alert.targetValue})`);

          // Update alert status
          await prisma.alert.update({
            where: { id: alert.id },
            data: {
              status: 'TRIGGERED',
              triggeredAt: new Date(),
            },
          });

          // Create notification record
          await prisma.alertNotification.create({
            data: {
              alertId: alert.id,
              price: currentPrice,
              details: {
                symbol: alert.symbol,
                timeframe: alert.timeframe,
                conditionType: alert.conditionType,
                targetValue: alert.targetValue,
                currentPrice,
              },
            },
          });

          // TODO: Send real-time notification (WebSocket)
          // TODO: Send email notification
        }
      }
    }

    console.log('[AlertChecker] Alert check completed');
  } catch (error) {
    console.error('[AlertChecker] Error checking alerts:', error);
  }
}
```

### **Pattern 6: Job Queue**
```typescript
// lib/jobs/queue.ts

import { checkAlerts } from './alert-checker';

let alertCheckInterval: NodeJS.Timeout | null = null;

export function startAlertChecker(): void {
  if (alertCheckInterval) {
    console.log('[JobQueue] Alert checker already running');
    return;
  }

  console.log('[JobQueue] Starting alert checker (every 60 seconds)');

  // Run immediately on start
  checkAlerts();

  // Then run every 60 seconds
  alertCheckInterval = setInterval(async () => {
    await checkAlerts();
  }, 60000); // 60 seconds
}

export function stopAlertChecker(): void {
  if (alertCheckInterval) {
    clearInterval(alertCheckInterval);
    alertCheckInterval = null;
    console.log('[JobQueue] Alert checker stopped');
  }
}

// Export for Next.js API route to trigger manually if needed
export { checkAlerts };
```

---

## 🚨 CRITICAL RULES

### **DO:**
- ✅ Read ALL policy files before writing code
- ✅ Follow tier-based alert limits EXACTLY (FREE: 5, PRO: 20)
- ✅ Validate symbol AND timeframe access
- ✅ Implement all 3 condition types (above/below/equals)
- ✅ Use TypeScript strictly (no `any` types)
- ✅ Reference seed code for component patterns
- ✅ Validate after each file
- ✅ Commit each file individually
- ✅ Use shadcn/ui components consistently
- ✅ Test thoroughly before pushing

### **DON'T:**
- ❌ Skip reading policy files
- ❌ Use `any` types
- ❌ Allow users to exceed alert limits
- ❌ Skip ownership validation in API routes
- ❌ Commit multiple files at once (commit one-by-one)
- ❌ Push without validation passing
- ❌ Push to main branch directly (use feature branch)
- ❌ Skip testing

---

## 🎯 SUCCESS CRITERIA

Part 11 is complete when:

- ✅ All 10 files created and committed
- ✅ All TypeScript validations pass (0 errors)
- ✅ All ESLint checks pass
- ✅ Alerts page loads at `/alerts` without errors
- ✅ Users can create alerts with all 3 condition types
- ✅ Tier limits enforced (FREE: 5, PRO: 20)
- ✅ Symbol/timeframe filtering works correctly
- ✅ Alerts can be edited, paused, resumed, deleted
- ✅ Alert checker job runs and triggers alerts
- ✅ All API endpoints work (GET, POST, PATCH, DELETE)
- ✅ All manual tests pass
- ✅ Code pushed to feature branch
- ✅ PR created (ready for review)

---

## 📊 PROGRESS TRACKING

Use the TodoWrite tool to track your progress:

```
1. Read all policy and architecture files
2. Build File 1/10: app/(dashboard)/alerts/page.tsx
3. Build File 2/10: app/(dashboard)/alerts/new/page.tsx
4. Build File 3/10: app/api/alerts/route.ts
5. Build File 4/10: app/api/alerts/[id]/route.ts
6. Build File 5/10: components/alerts/alert-list.tsx
7. Build File 6/10: components/alerts/alert-form.tsx
8. Build File 7/10: components/alerts/alert-card.tsx
9. Build File 8/10: lib/jobs/alert-checker.ts
10. Build File 9/10: lib/jobs/queue.ts
11. Build File 10/10: hooks/use-alerts.ts
12. Run full validation suite
13. Test alerts manually
14. Push to feature branch
15. Create pull request
```

---

## 🚀 START HERE

1. **First, read these files in order:**
   - `PROGRESS-part-2.md` - Understand current state
   - `docs/policies/00-tier-specifications.md` - Learn tier system (CRITICAL)
   - `docs/policies/05-coding-patterns-part-1.md` - Learn code patterns
   - `docs/policies/05-coding-patterns-part-2.md` - More code patterns
   - `docs/build-orders/part-11-alerts.md` - Understand Part 11
   - `docs/implementation-guides/v5_part_k.md` - Alerts business logic
   - Seed code files for component patterns

2. **Then, create your git branch:**
   ```bash
   git checkout main
   git pull origin main
   git checkout -b claude/alerts-system-{SESSION_ID}
   ```

3. **Start building File 1/10:**
   - Read the build order for File 1
   - Reference seed code
   - Write the file following patterns
   - Validate: `npm run validate`
   - Fix any issues: `npm run fix`
   - Commit: `git commit -m "feat(alerts): add alerts list page"`

4. **Repeat for Files 2-10**

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
- 🚨 Database schema questions
- 🚨 Alert checker job implementation questions
- 🚨 MT5 price fetching integration questions

Otherwise, work autonomously following the policies!

---

**Good luck! Build Part 11 with quality and precision. The user trusts you to follow all policies and deliver production-ready code.** 🚀
