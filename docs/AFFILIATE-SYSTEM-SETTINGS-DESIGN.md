# Affiliate System Settings - Centralized Configuration Design

**Created:** 2025-11-15
**For:** Trading Alerts SaaS V7 - Affiliate Marketing Platform
**Purpose:** Centralized system for managing discount and commission percentages globally

---

## 📋 TABLE OF CONTENTS

1. [Overview](#overview)
2. [Business Requirements](#business-requirements)
3. [Database Schema](#database-schema)
4. [Admin UI - Settings Page](#admin-ui---settings-page)
5. [API Endpoints](#api-endpoints)
6. [Frontend Implementation](#frontend-implementation)
7. [Update Propagation](#update-propagation)
8. [Code Examples](#code-examples)
9. [Migration Strategy](#migration-strategy)

---

## 1. OVERVIEW

### Problem Statement

Currently, discount (20%) and commission (20%) percentages are:

- ❌ Hardcoded in multiple places
- ❌ Require code changes to update
- ❌ Can become inconsistent across pages
- ❌ Not controllable by admin in real-time

### Solution

Create a **centralized configuration system** where:

- ✅ Admin can change percentages from dashboard
- ✅ Changes propagate instantly to ALL pages
- ✅ Single source of truth in database
- ✅ All frontend pages fetch values dynamically
- ✅ No code deployment needed for percentage changes

---

## 2. BUSINESS REQUIREMENTS

### Admin Capabilities

**Admin should be able to:**

1. Change platform-wide default discount percentage (e.g., 20% → 30%)
2. Change platform-wide default commission percentage (e.g., 20% → 40%)
3. See preview of how changes affect pricing before saving
4. View history of percentage changes (audit log)

### Automatic Updates

**When admin changes percentages, update instantly on:**

- ✅ Marketing homepage (discount messaging)
- ✅ Pricing page (discount offers)
- ✅ Registration form (discount helper text)
- ✅ User billing dashboard (savings display)
- ✅ User settings page (affiliate benefits)
- ✅ Affiliate dashboard (commission rates)
- ✅ Admin dashboard (reports and analytics)
- ✅ Checkout page (discount preview)

### Constraints

**Important rules:**

1. ❌ **Do NOT retroactively change existing codes** - codes already generated keep their original percentages
2. ✅ **Only affect NEW codes** - generated after the change
3. ✅ **Do NOT change existing commissions** - already earned commissions stay the same
4. ✅ **Clear admin warning** - "This will affect all new codes generated after saving"

---

## 3. DATABASE SCHEMA

### New Table: `SystemConfig`

```prisma
model SystemConfig {
  id                        String   @id @default(cuid())
  key                       String   @unique  // "affiliate_discount_percent" or "affiliate_commission_percent"
  value                     String              // Stored as string, parsed as needed
  valueType                 String              // "number", "boolean", "string"
  description               String?             // Human-readable description
  category                  String              // "affiliate", "payment", "general"
  updatedBy                 String?             // Admin user ID who made the change
  updatedAt                 DateTime @updatedAt
  createdAt                 DateTime @default(now())

  @@index([category])
  @@index([key])
}

model SystemConfigHistory {
  id                        String   @id @default(cuid())
  configKey                 String              // Which setting was changed
  oldValue                  String              // Previous value
  newValue                  String              // New value
  changedBy                 String              // Admin user ID
  changedAt                 DateTime @default(now())
  reason                    String?             // Optional: why the change was made

  @@index([configKey])
  @@index([changedAt])
}
```

### Initial Data

```sql
INSERT INTO "SystemConfig" (id, key, value, valueType, description, category) VALUES
  ('cfg001', 'affiliate_discount_percent', '20', 'number', 'Default customer discount percentage for affiliate codes', 'affiliate'),
  ('cfg002', 'affiliate_commission_percent', '20', 'number', 'Default affiliate commission percentage', 'affiliate'),
  ('cfg003', 'affiliate_codes_per_month', '15', 'number', 'Number of codes distributed to each affiliate monthly', 'affiliate'),
  ('cfg004', 'affiliate_max_discount_percent', '50', 'number', 'Maximum allowed discount percentage', 'affiliate'),
  ('cfg005', 'affiliate_max_commission_percent', '50', 'number', 'Maximum allowed commission percentage', 'affiliate');
```

---

## 4. ADMIN UI - SETTINGS PAGE

### Location

**URL:** `/admin/settings/affiliate`

**Page Layout:**

```
┌──────────────────────────────────────────────────────────────────────┐
│  ADMIN DASHBOARD > Settings > Affiliate Program                      │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ⚙️ AFFILIATE PROGRAM SETTINGS                                       │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  📊 CURRENT CONFIGURATION                                       │ │
│  │                                                                  │ │
│  │  Last Updated: Nov 15, 2025 at 10:30 AM by admin@platform.com  │ │
│  │                                                                  │ │
│  │  ┌──────────────────────────────────────────────────────────┐  │ │
│  │  │  DEFAULT DISCOUNT PERCENTAGE                              │  │ │
│  │  │                                                            │  │ │
│  │  │  Current: 20%                                             │  │ │
│  │  │  New:     [________30________]%                          │  │ │
│  │  │                                                            │  │ │
│  │  │  ℹ️ This is the discount customers receive when using    │  │ │
│  │  │     affiliate codes. Affects pricing across all pages.   │  │ │
│  │  │                                                            │  │ │
│  │  │  Impact Preview:                                          │  │ │
│  │  │  • Regular Price: $29.00                                 │  │ │
│  │  │  • With 30% Discount: $20.30 (was $23.20 with 20%)      │  │ │
│  │  │  • Customer Saves: $8.70/month (was $5.80)              │  │ │
│  │  └──────────────────────────────────────────────────────────┘  │ │
│  │                                                                  │ │
│  │  ┌──────────────────────────────────────────────────────────┐  │ │
│  │  │  DEFAULT COMMISSION PERCENTAGE                            │  │ │
│  │  │                                                            │  │ │
│  │  │  Current: 20%                                             │  │ │
│  │  │  New:     [________40________]%                          │  │ │
│  │  │                                                            │  │ │
│  │  │  ℹ️ This is the commission affiliates earn on sales.     │  │ │
│  │  │     Affects all affiliate dashboards and reports.        │  │ │
│  │  │                                                            │  │ │
│  │  │  Impact Preview:                                          │  │ │
│  │  │  • Net Revenue (with 30% discount): $20.30              │  │ │
│  │  │  • Affiliate Earns (40% commission): $8.12              │  │ │
│  │  │  • Platform Keeps: $12.18                               │  │ │
│  │  │                                                            │  │ │
│  │  │  Comparison:                                              │  │ │
│  │  │  • Old (20%/20%): Affiliate $4.64, Platform $18.56      │  │ │
│  │  │  • New (30%/40%): Affiliate $8.12, Platform $12.18      │  │ │
│  │  └──────────────────────────────────────────────────────────┘  │ │
│  │                                                                  │ │
│  │  ┌──────────────────────────────────────────────────────────┐  │ │
│  │  │  ADVANCED SETTINGS                                        │  │ │
│  │  │                                                            │  │ │
│  │  │  Codes per Affiliate per Month: [___15___]               │  │ │
│  │  │  Maximum Discount Allowed: [___50___]%                   │  │ │
│  │  │  Maximum Commission Allowed: [___50___]%                 │  │ │
│  │  └──────────────────────────────────────────────────────────┘  │ │
│  │                                                                  │ │
│  │  ⚠️  IMPORTANT WARNINGS                                         │ │
│  │  ┌──────────────────────────────────────────────────────────┐  │ │
│  │  │  • Changes affect NEW codes only (generated after save)  │  │ │
│  │  │  • Existing codes keep their original percentages        │  │ │
│  │  │  • Changes appear instantly on all web pages             │  │ │
│  │  │  • All users will see new percentages immediately        │  │ │
│  │  │  • Action is logged in audit trail                       │  │ │
│  │  └──────────────────────────────────────────────────────────┘  │ │
│  │                                                                  │ │
│  │  Reason for Change (optional):                                  │ │
│  │  [___________________________________________________________]  │ │
│  │  [___________________________________________________________]  │ │
│  │                                                                  │ │
│  │  [Cancel]  [Preview Changes]  [Save Changes]                   │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  📜 CHANGE HISTORY                                                   │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ Date       │ Setting      │ Old  │ New  │ Changed By │ Reason  │ │
│  ├────────────┼──────────────┼──────┼──────┼────────────┼─────────┤ │
│  │ Nov 15 '25 │ Discount %   │ 20%  │ 30%  │ admin@...  │ Q4 promo│ │
│  │ Nov 15 '25 │ Commission % │ 20%  │ 40%  │ admin@...  │ Q4 promo│ │
│  │ Oct 1 '25  │ Discount %   │ 15%  │ 20%  │ admin@...  │ Standard│ │
│  └────────────┴──────────────┴──────┴──────┴────────────┴─────────┘ │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

### Confirmation Modal (When Saving)

```
┌────────────────────────────────────────────────────┐
│  ⚠️  Confirm Settings Change                       │
├────────────────────────────────────────────────────┤
│                                                     │
│  You are about to change:                          │
│                                                     │
│  • Discount: 20% → 30%                            │
│  • Commission: 20% → 40%                          │
│                                                     │
│  This will affect:                                 │
│  ✅ All new codes generated after this change      │
│  ✅ All web pages (updates instantly)              │
│  ✅ Marketing materials                            │
│  ✅ User dashboards                                │
│  ✅ Affiliate dashboards                           │
│                                                     │
│  This will NOT affect:                             │
│  ❌ Existing codes (keep original percentages)     │
│  ❌ Already-earned commissions                     │
│                                                     │
│  Are you sure you want to proceed?                 │
│                                                     │
│  [Cancel]              [Yes, Update Settings]      │
│                                                     │
└────────────────────────────────────────────────────┘
```

---

## 5. API ENDPOINTS

### GET /api/config/affiliate

**Purpose:** Fetch current affiliate settings (public endpoint, cached)

**Access:** Public (anyone can read)

```typescript
GET /api/config/affiliate

Response (200):
{
  "discountPercent": 30,
  "commissionPercent": 40,
  "codesPerMonth": 15,
  "maxDiscountPercent": 50,
  "maxCommissionPercent": 50,
  "updatedAt": "2025-11-15T10:30:00Z"
}
```

**Caching:**

- Cache for 5 minutes (reduces database load)
- Invalidate cache when admin saves changes

---

### GET /api/admin/settings/affiliate

**Purpose:** Fetch affiliate settings with full details (admin only)

**Access:** Admin only

```typescript
GET /api/admin/settings/affiliate
Authorization: Bearer <admin_token>

Response (200):
{
  "current": {
    "discountPercent": 20,
    "commissionPercent": 20,
    "codesPerMonth": 15,
    "maxDiscountPercent": 50,
    "maxCommissionPercent": 50
  },
  "lastUpdated": {
    "timestamp": "2025-11-01T08:00:00Z",
    "by": "admin@platform.com"
  },
  "limits": {
    "minDiscount": 5,
    "maxDiscount": 50,
    "minCommission": 10,
    "maxCommission": 50
  }
}
```

---

### PATCH /api/admin/settings/affiliate

**Purpose:** Update affiliate settings

**Access:** Admin only

```typescript
PATCH /api/admin/settings/affiliate
Authorization: Bearer <admin_token>

Request:
{
  "discountPercent": 30,
  "commissionPercent": 40,
  "reason": "Q4 promotion to boost affiliate sign-ups"
}

Response (200):
{
  "success": true,
  "updated": {
    "discountPercent": {
      "old": 20,
      "new": 30
    },
    "commissionPercent": {
      "old": 20,
      "new": 40
    }
  },
  "preview": {
    "regularPrice": 29.00,
    "discountedPrice": 20.30,
    "customerSavings": 8.70,
    "affiliateEarns": 8.12,
    "platformRevenue": 12.18
  },
  "message": "Settings updated successfully. Changes will affect all new codes and appear on all pages within 5 minutes."
}

Response (400) - Validation Error:
{
  "success": false,
  "error": "INVALID_PERCENTAGE",
  "message": "Discount percentage must be between 5% and 50%"
}
```

**Validation Rules:**

- `discountPercent`: 5-50
- `commissionPercent`: 10-50
- Both must be integers
- Creates audit log entry automatically

---

### GET /api/admin/settings/affiliate/history

**Purpose:** Fetch change history

**Access:** Admin only

```typescript
GET /api/admin/settings/affiliate/history?limit=20&offset=0
Authorization: Bearer <admin_token>

Response (200):
{
  "history": [
    {
      "id": "hist001",
      "configKey": "affiliate_discount_percent",
      "oldValue": "20",
      "newValue": "30",
      "changedBy": "admin@platform.com",
      "changedAt": "2025-11-15T10:30:00Z",
      "reason": "Q4 promotion to boost affiliate sign-ups"
    },
    {
      "id": "hist002",
      "configKey": "affiliate_commission_percent",
      "oldValue": "20",
      "newValue": "40",
      "changedBy": "admin@platform.com",
      "changedAt": "2025-11-15T10:30:00Z",
      "reason": "Q4 promotion to boost affiliate sign-ups"
    }
  ],
  "total": 2,
  "limit": 20,
  "offset": 0
}
```

---

## 6. FRONTEND IMPLEMENTATION

### Centralized Config Hook

**Create:** `lib/hooks/useAffiliateConfig.ts`

```typescript
import useSWR from 'swr';

interface AffiliateConfig {
  discountPercent: number;
  commissionPercent: number;
  codesPerMonth: number;
  maxDiscountPercent: number;
  maxCommissionPercent: number;
  updatedAt: string;
}

export function useAffiliateConfig() {
  const { data, error, isLoading } = useSWR<AffiliateConfig>(
    '/api/config/affiliate',
    {
      refreshInterval: 300000, // Refresh every 5 minutes
      dedupingInterval: 60000, // Dedupe requests within 1 minute
      revalidateOnFocus: true, // Revalidate when user focuses window
    }
  );

  return {
    config: data,
    isLoading,
    error,
    // Computed values
    discountPercent: data?.discountPercent ?? 20,
    commissionPercent: data?.commissionPercent ?? 20,
    // Helper functions
    calculateDiscountedPrice: (regularPrice: number) => {
      const discount = data?.discountPercent ?? 20;
      return regularPrice * (1 - discount / 100);
    },
    calculateCommission: (discountedPrice: number) => {
      const commission = data?.commissionPercent ?? 20;
      return discountedPrice * (commission / 100);
    },
  };
}
```

---

### Usage in Components

#### Marketing Homepage

**File:** `app/page.tsx`

```typescript
import { useAffiliateConfig } from '@/lib/hooks/useAffiliateConfig';

export default function HomePage() {
  const { discountPercent, calculateDiscountedPrice } = useAffiliateConfig();

  const regularPrice = 29.00;
  const discountedPrice = calculateDiscountedPrice(regularPrice);
  const savings = regularPrice - discountedPrice;

  return (
    <div>
      <h1>Get {discountPercent}% off with an affiliate code!</h1>
      <p>Pay just ${discountedPrice.toFixed(2)}/month (save ${savings.toFixed(2)})</p>
    </div>
  );
}
```

#### Pricing Page

**File:** `app/pricing/page.tsx`

```typescript
import { useAffiliateConfig } from '@/lib/hooks/useAffiliateConfig';

export default function PricingPage() {
  const { discountPercent } = useAffiliateConfig();

  return (
    <div>
      <div className="banner">
        Get {discountPercent}% off your next PRO subscription with a referral code!
        New codes available monthly!
      </div>
    </div>
  );
}
```

#### User Billing Dashboard

**File:** `app/dashboard/billing/page.tsx`

```typescript
import { useAffiliateConfig } from '@/lib/hooks/useAffiliateConfig';

export default function BillingPage() {
  const { discountPercent, calculateDiscountedPrice } = useAffiliateConfig();
  const hasCode = user.appliedAffiliateCode;

  const regularPrice = 29.00;
  const discountedPrice = calculateDiscountedPrice(regularPrice);

  return (
    <div>
      {hasCode ? (
        <>
          <p className="text-green-600">
            {discountPercent}% off this month
          </p>
          <p className="text-3xl">${discountedPrice.toFixed(2)}/month</p>
          <p className="text-sm">
            Use a new affiliate code at renewal to get {discountPercent}% off again!
          </p>
        </>
      ) : (
        <p className="text-3xl">${regularPrice.toFixed(2)}/month</p>
      )}
    </div>
  );
}
```

#### Affiliate Dashboard

**File:** `app/affiliate/dashboard/page.tsx`

```typescript
import { useAffiliateConfig } from '@/lib/hooks/useAffiliateConfig';

export default function AffiliateDashboard() {
  const { commissionPercent, calculateCommission, calculateDiscountedPrice } = useAffiliateConfig();

  const regularPrice = 29.00;
  const discountedPrice = calculateDiscountedPrice(regularPrice);
  const commission = calculateCommission(discountedPrice);

  return (
    <div>
      <h2>Earn {commissionPercent}% Commission</h2>
      <p>You earn ${commission.toFixed(2)} per sale</p>
    </div>
  );
}
```

---

## 7. UPDATE PROPAGATION

### How Changes Propagate Instantly

```
┌─────────────────────────────────────────────────────────────┐
│  ADMIN SAVES NEW PERCENTAGES (30% discount, 40% commission) │
└────────────────────┬────────────────────────────────────────┘
                     ↓
         ┌───────────────────────┐
         │ Update Database       │
         │ SystemConfig table    │
         └───────────┬───────────┘
                     ↓
         ┌───────────────────────┐
         │ Create Audit Log      │
         │ SystemConfigHistory   │
         └───────────┬───────────┘
                     ↓
         ┌───────────────────────┐
         │ Clear Cache           │
         │ (Redis/Memory cache)  │
         └───────────┬───────────┘
                     ↓
    ┌────────────────┴────────────────┐
    ↓                                  ↓
┌─────────────────┐         ┌─────────────────┐
│ Homepage        │         │ Pricing Page    │
│ Refetches data  │         │ Refetches data  │
│ Shows 30%       │         │ Shows 30%       │
└─────────────────┘         └─────────────────┘
    ↓                                  ↓
┌─────────────────┐         ┌─────────────────┐
│ User Dashboard  │         │ Affiliate Dash  │
│ Refetches data  │         │ Refetches data  │
│ Shows 30%       │         │ Shows 40%       │
└─────────────────┘         └─────────────────┘
```

### Caching Strategy

**Level 1: API Response Cache (Redis/Memory)**

- Duration: 5 minutes
- Invalidated when: Admin saves changes
- Benefit: Reduces database queries

**Level 2: SWR Client Cache**

- Duration: 1 minute (dedupe)
- Revalidation: Every 5 minutes, on focus
- Benefit: Instant UI updates

**Result:** Changes appear within **1-5 minutes** max across all pages

---

## 8. CODE EXAMPLES

### Backend: Settings Service

**File:** `lib/services/system-config.ts`

```typescript
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis'; // Optional: for caching

const CACHE_KEY = 'affiliate:config';
const CACHE_TTL = 300; // 5 minutes

export async function getAffiliateConfig() {
  // Try cache first
  const cached = await redis?.get(CACHE_KEY);
  if (cached) return JSON.parse(cached);

  // Fetch from database
  const configs = await prisma.systemConfig.findMany({
    where: {
      category: 'affiliate',
      key: {
        in: [
          'affiliate_discount_percent',
          'affiliate_commission_percent',
          'affiliate_codes_per_month',
          'affiliate_max_discount_percent',
          'affiliate_max_commission_percent',
        ],
      },
    },
  });

  // Transform to object
  const config = {
    discountPercent: parseInt(
      configs.find((c) => c.key === 'affiliate_discount_percent')?.value ?? '20'
    ),
    commissionPercent: parseInt(
      configs.find((c) => c.key === 'affiliate_commission_percent')?.value ??
        '20'
    ),
    codesPerMonth: parseInt(
      configs.find((c) => c.key === 'affiliate_codes_per_month')?.value ?? '15'
    ),
    maxDiscountPercent: parseInt(
      configs.find((c) => c.key === 'affiliate_max_discount_percent')?.value ??
        '50'
    ),
    maxCommissionPercent: parseInt(
      configs.find((c) => c.key === 'affiliate_max_commission_percent')
        ?.value ?? '50'
    ),
    updatedAt: configs[0]?.updatedAt.toISOString() ?? new Date().toISOString(),
  };

  // Cache result
  await redis?.setex(CACHE_KEY, CACHE_TTL, JSON.stringify(config));

  return config;
}

export async function updateAffiliateConfig(
  updates: {
    discountPercent?: number;
    commissionPercent?: number;
  },
  adminId: string,
  reason?: string
) {
  // Validate
  if (
    updates.discountPercent &&
    (updates.discountPercent < 5 || updates.discountPercent > 50)
  ) {
    throw new Error('Discount percentage must be between 5% and 50%');
  }
  if (
    updates.commissionPercent &&
    (updates.commissionPercent < 10 || updates.commissionPercent > 50)
  ) {
    throw new Error('Commission percentage must be between 10% and 50%');
  }

  const changes: Array<{ key: string; oldValue: string; newValue: string }> =
    [];

  // Update discount
  if (updates.discountPercent !== undefined) {
    const current = await prisma.systemConfig.findUnique({
      where: { key: 'affiliate_discount_percent' },
    });

    await prisma.systemConfig.update({
      where: { key: 'affiliate_discount_percent' },
      data: {
        value: updates.discountPercent.toString(),
        updatedBy: adminId,
      },
    });

    changes.push({
      key: 'affiliate_discount_percent',
      oldValue: current?.value ?? '20',
      newValue: updates.discountPercent.toString(),
    });
  }

  // Update commission
  if (updates.commissionPercent !== undefined) {
    const current = await prisma.systemConfig.findUnique({
      where: { key: 'affiliate_commission_percent' },
    });

    await prisma.systemConfig.update({
      where: { key: 'affiliate_commission_percent' },
      data: {
        value: updates.commissionPercent.toString(),
        updatedBy: adminId,
      },
    });

    changes.push({
      key: 'affiliate_commission_percent',
      oldValue: current?.value ?? '20',
      newValue: updates.commissionPercent.toString(),
    });
  }

  // Create audit log entries
  for (const change of changes) {
    await prisma.systemConfigHistory.create({
      data: {
        configKey: change.key,
        oldValue: change.oldValue,
        newValue: change.newValue,
        changedBy: adminId,
        reason,
      },
    });
  }

  // Clear cache
  await redis?.del(CACHE_KEY);

  return {
    success: true,
    changes,
  };
}
```

---

### API Route: GET /api/config/affiliate

**File:** `app/api/config/affiliate/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { getAffiliateConfig } from '@/lib/services/system-config';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const config = await getAffiliateConfig();

    return NextResponse.json(config, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
      },
    });
  } catch (error) {
    console.error('Error fetching affiliate config:', error);

    // Return defaults on error
    return NextResponse.json({
      discountPercent: 20,
      commissionPercent: 20,
      codesPerMonth: 15,
      maxDiscountPercent: 50,
      maxCommissionPercent: 50,
      updatedAt: new Date().toISOString(),
    });
  }
}
```

---

### API Route: PATCH /api/admin/settings/affiliate

**File:** `app/api/admin/settings/affiliate/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { updateAffiliateConfig } from '@/lib/services/system-config';

export async function PATCH(req: NextRequest) {
  try {
    // Check admin auth
    const session = await getServerSession();
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { discountPercent, commissionPercent, reason } = body;

    // Update settings
    const result = await updateAffiliateConfig(
      { discountPercent, commissionPercent },
      session.user.id,
      reason
    );

    // Calculate preview
    const regularPrice = 29.0;
    const discountedPrice = regularPrice * (1 - discountPercent / 100);
    const commission = discountedPrice * (commissionPercent / 100);
    const platformRevenue = discountedPrice - commission;

    return NextResponse.json({
      success: true,
      updated: {
        discountPercent: {
          old: parseInt(
            result.changes.find((c) => c.key === 'affiliate_discount_percent')
              ?.oldValue ?? '20'
          ),
          new: discountPercent,
        },
        commissionPercent: {
          old: parseInt(
            result.changes.find((c) => c.key === 'affiliate_commission_percent')
              ?.oldValue ?? '20'
          ),
          new: commissionPercent,
        },
      },
      preview: {
        regularPrice,
        discountedPrice: parseFloat(discountedPrice.toFixed(2)),
        customerSavings: parseFloat(
          (regularPrice - discountedPrice).toFixed(2)
        ),
        affiliateEarns: parseFloat(commission.toFixed(2)),
        platformRevenue: parseFloat(platformRevenue.toFixed(2)),
      },
      message:
        'Settings updated successfully. Changes will affect all new codes and appear on all pages within 5 minutes.',
    });
  } catch (error: any) {
    console.error('Error updating affiliate settings:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to update settings',
      },
      { status: 400 }
    );
  }
}
```

---

## 9. MIGRATION STRATEGY

### Step 1: Create Database Tables

```sql
-- Run this migration

CREATE TABLE "SystemConfig" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "key" TEXT NOT NULL UNIQUE,
  "value" TEXT NOT NULL,
  "valueType" TEXT NOT NULL,
  "description" TEXT,
  "category" TEXT NOT NULL,
  "updatedBy" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "SystemConfigHistory" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "configKey" TEXT NOT NULL,
  "oldValue" TEXT NOT NULL,
  "newValue" TEXT NOT NULL,
  "changedBy" TEXT NOT NULL,
  "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reason" TEXT
);

CREATE INDEX "SystemConfig_category_idx" ON "SystemConfig"("category");
CREATE INDEX "SystemConfig_key_idx" ON "SystemConfig"("key");
CREATE INDEX "SystemConfigHistory_configKey_idx" ON "SystemConfigHistory"("configKey");
CREATE INDEX "SystemConfigHistory_changedAt_idx" ON "SystemConfigHistory"("changedAt");

-- Insert initial values
INSERT INTO "SystemConfig" VALUES
  (gen_random_uuid(), 'affiliate_discount_percent', '20', 'number', 'Default customer discount percentage', 'affiliate', NULL, NOW(), NOW()),
  (gen_random_uuid(), 'affiliate_commission_percent', '20', 'number', 'Default affiliate commission percentage', 'affiliate', NULL, NOW(), NOW()),
  (gen_random_uuid(), 'affiliate_codes_per_month', '15', 'number', 'Codes per affiliate monthly', 'affiliate', NULL, NOW(), NOW()),
  (gen_random_uuid(), 'affiliate_max_discount_percent', '50', 'number', 'Maximum discount allowed', 'affiliate', NULL, NOW(), NOW()),
  (gen_random_uuid(), 'affiliate_max_commission_percent', '50', 'number', 'Maximum commission allowed', 'affiliate', NULL, NOW(), NOW());
```

### Step 2: Update All Frontend Pages

**Replace hardcoded percentages with dynamic fetching:**

```typescript
// ❌ OLD (hardcoded)
<p>Get 20% off with affiliate code!</p>

// ✅ NEW (dynamic)
const { discountPercent } = useAffiliateConfig();
<p>Get {discountPercent}% off with affiliate code!</p>
```

### Step 3: Update Code Generation

**File:** `lib/services/affiliate-codes.ts`

```typescript
// ❌ OLD (hardcoded)
async function generateCodes() {
  return prisma.affiliateCode.create({
    data: {
      discountPercent: 20, // Hardcoded
      commissionPercent: 20, // Hardcoded
      // ...
    },
  });
}

// ✅ NEW (dynamic)
async function generateCodes() {
  const config = await getAffiliateConfig();

  return prisma.affiliateCode.create({
    data: {
      discountPercent: config.discountPercent, // Dynamic
      commissionPercent: config.commissionPercent, // Dynamic
      // ...
    },
  });
}
```

---

## 📊 SUMMARY

### What This System Provides

✅ **Admin Control**

- Single dashboard to change all percentages
- Real-time preview of impact
- Audit trail of all changes

✅ **Instant Updates**

- Changes propagate to all pages within 5 minutes
- No code deployment needed
- Consistent across entire platform

✅ **Safety**

- Existing codes keep original percentages
- Validation prevents invalid values
- Audit log for compliance

✅ **Performance**

- Cached responses (5-minute TTL)
- Minimal database queries
- Fast page loads

### Pages That Update Automatically

1. Marketing homepage - discount messaging
2. Pricing page - discount offers
3. Registration form - discount helper
4. Checkout page - price preview
5. User billing dashboard - savings display
6. User settings - affiliate benefits
7. Affiliate dashboard - commission rates
8. Affiliate reports - earnings
9. Admin dashboard - all reports
10. Email templates - dynamic percentages

---

## 🚀 NEXT STEPS

1. **Database Migration:** Create `SystemConfig` and `SystemConfigHistory` tables
2. **Backend Services:** Implement `system-config.ts` service
3. **API Endpoints:** Create GET/PATCH routes
4. **Frontend Hook:** Implement `useAffiliateConfig()` hook
5. **Admin UI:** Build settings page at `/admin/settings/affiliate`
6. **Update Pages:** Replace all hardcoded percentages with dynamic values
7. **Testing:** Verify instant propagation across all pages
8. **Documentation:** Update admin guides

---

**Created:** 2025-11-15
**Version:** 1.0.0
**Status:** Design Complete - Ready for Implementation
