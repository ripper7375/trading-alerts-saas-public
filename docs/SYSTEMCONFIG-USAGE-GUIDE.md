# SystemConfig - Usage & Implementation Guide

**Project:** Trading Alerts SaaS V7
**Feature:** Dynamic Affiliate Settings Management
**Created:** 2025-11-16
**Purpose:** Guide for using and extending SystemConfig for current and future pages

---

## 📖 TABLE OF CONTENTS

1. [What is SystemConfig?](#what-is-systemconfig)
2. [How Does It Work?](#how-does-it-work)
3. [Auto-Detection for New Pages](#auto-detection-for-new-pages)
4. [Retrofitting Existing Pages](#retrofitting-existing-pages)
5. [Adding New Configuration Settings](#adding-new-configuration-settings)
6. [API Reference](#api-reference)
7. [Frontend Hook Reference](#frontend-hook-reference)
8. [Backend Pattern Reference](#backend-pattern-reference)
9. [Testing Changes](#testing-changes)
10. [Troubleshooting](#troubleshooting)

---

## 🎯 What is SystemConfig?

**SystemConfig is a centralized configuration system that allows admin to change affiliate discount and commission percentages from the dashboard without code deployment.**

### Key Benefits:

✅ **Zero Code Deployment** - Admin changes percentages via UI, not code
✅ **Automatic Propagation** - All pages update within 1-5 minutes
✅ **Retrofit-Friendly** - New pages automatically detect and use current values
✅ **Audit Trail** - Complete history of all changes in SystemConfigHistory
✅ **Historical Accuracy** - Existing codes keep original percentages (snapshot)

### Database Tables:

```prisma
model SystemConfig {
  id          String   @id @default(cuid())
  key         String   @unique  // "affiliate_discount_percent"
  value       String   // "20.0" (stored as string)
  valueType   String   // "number"
  description String?
  category    String   // "affiliate"
  updatedBy   String?
  updatedAt   DateTime @updatedAt
  createdAt   DateTime @default(now())
}

model SystemConfigHistory {
  id         String   @id @default(cuid())
  configKey  String   // "affiliate_discount_percent"
  oldValue   String   // "20.0"
  newValue   String   // "25.0"
  changedBy  String   // admin email
  changedAt  DateTime @default(now())
  reason     String?  // "Q1 marketing campaign"
}
```

### Current Configuration Keys:

| Key                            | Type   | Default | Description                             |
| ------------------------------ | ------ | ------- | --------------------------------------- |
| `affiliate_discount_percent`   | number | 20.0    | Customer discount percentage            |
| `affiliate_commission_percent` | number | 20.0    | Affiliate commission percentage         |
| `affiliate_codes_per_month`    | number | 15      | Codes distributed per affiliate monthly |

---

## 🔄 How Does It Work?

### Architecture Overview:

```
┌─────────────────────────────────────────────────────────────┐
│ 1. ADMIN CHANGES SETTINGS (Dashboard UI)                   │
├─────────────────────────────────────────────────────────────┤
│   Admin: Changes commission from 20% to 25%                │
│   ↓                                                         │
│   PATCH /api/admin/settings/affiliate                      │
│   ↓                                                         │
│   Backend: Updates SystemConfig table                      │
│   Backend: Creates SystemConfigHistory entry               │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. FRONTEND PAGES AUTO-UPDATE (1-5 minutes)                │
├─────────────────────────────────────────────────────────────┤
│   All pages using useAffiliateConfig() hook:               │
│   - Marketing homepage                                      │
│   - Pricing page                                            │
│   - Checkout page                                           │
│   - User billing dashboard                                  │
│   - Affiliate dashboard                                     │
│   - Admin affiliate management                              │
│   - ANY NEW PAGE YOU ADD LATER ✨                           │
│   ↓                                                         │
│   Hook fetches: GET /api/config/affiliate                  │
│   ↓                                                         │
│   SWR cache: Revalidates every 5 minutes                   │
│   ↓                                                         │
│   Pages display: "Earn 25% commission!" (updated)          │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. BACKEND CODE GENERATION (New codes use new values)      │
├─────────────────────────────────────────────────────────────┤
│   Monthly cron job (1st of month):                         │
│   ↓                                                         │
│   Fetches from SystemConfig table                          │
│   ↓                                                         │
│   Generates 15 codes per affiliate with 25% commission     │
│   ↓                                                         │
│   Existing codes keep 20% (no retroactive changes)         │
└─────────────────────────────────────────────────────────────┘
```

### Update Flow Timeline:

```
Time: 14:00 - Admin changes commission to 25%
Time: 14:00 - SystemConfig updated in database
Time: 14:00 - SystemConfigHistory entry created
Time: 14:01 - Pages with users online may still show 20% (cached)
Time: 14:05 - SWR auto-refresh triggers on most pages
Time: 14:05 - Pages now show 25% commission
Time: 14:10 - All pages guaranteed to show 25% (max cache time)
```

---

## 🆕 Auto-Detection for New Pages

### YES! SystemConfig Automatically Works for New Pages

**Answer to your question:** If you retrofit web pages or add new dashboards later, they will **AUTOMATICALLY** detect and use the current discount/commission percentages from SystemConfig — **WITHOUT any code modification to the SystemConfig system itself**.

### How It Works:

1. **You add a new page** (e.g., new affiliate analytics dashboard)
2. **You import the hook** in your new component:
   ```typescript
   import { useAffiliateConfig } from '@/lib/hooks/useAffiliateConfig';
   ```
3. **You use the hook** to get current percentages:
   ```typescript
   const { discountPercent, commissionPercent } = useAffiliateConfig();
   ```
4. **Done!** Your new page automatically shows current values and auto-updates when admin changes them

### Example: Adding a New Affiliate Analytics Dashboard

**Scenario:** You decide to add a new "Affiliate Performance Analytics" page in 2026.

**Step 1: Create the new page component**

```typescript
// app/affiliate/analytics/page.tsx (NEW FILE - created in 2026)
'use client';

import { useAffiliateConfig } from '@/lib/hooks/useAffiliateConfig';

export default function AffiliateAnalyticsPage() {
  // ✨ This automatically fetches current config from SystemConfig
  const { discountPercent, commissionPercent, calculateDiscountedPrice } = useAffiliateConfig();

  const regularPrice = 29.00;
  const discountedPrice = calculateDiscountedPrice(regularPrice);
  const commissionAmount = discountedPrice * (commissionPercent / 100);

  return (
    <div>
      <h1>Affiliate Performance Analytics</h1>

      {/* These values auto-update when admin changes settings */}
      <div className="metrics">
        <div>Current Discount: {discountPercent}%</div>
        <div>Current Commission: {commissionPercent}%</div>
        <div>Customer Pays: ${discountedPrice}</div>
        <div>You Earn: ${commissionAmount.toFixed(2)}</div>
      </div>

      {/* Your analytics charts, tables, etc. */}
    </div>
  );
}
```

**Step 2: Deploy**

```bash
# That's it! No SystemConfig modification needed
git add app/affiliate/analytics/page.tsx
git commit -m "feat: add affiliate analytics dashboard"
git push
```

**Step 3: Automatic Behavior**

- Page displays current percentages (whatever admin set)
- If admin changes commission from 25% to 30%, this page updates within 5 minutes
- No code changes to SystemConfig required
- No deployment needed for percentage updates

### Pages That Auto-Detect SystemConfig:

✅ **Current Pages (Already Implemented):**

- Marketing homepage
- Pricing page
- Checkout page
- User billing dashboard
- Affiliate dashboard
- Admin affiliate management

✅ **Future Pages (Will Auto-Detect When You Add Them):**

- Affiliate analytics dashboard (when you create it)
- Affiliate leaderboard page (when you create it)
- Public affiliate program info page (when you create it)
- Email templates (when you create them)
- Any new dashboard, widget, or page you add later

### The Magic: Why It Works Automatically

**The hook is the key:**

```typescript
// lib/hooks/useAffiliateConfig.ts (already implemented)
export function useAffiliateConfig() {
  // SWR fetches from /api/config/affiliate
  const { data } = useSWR<AffiliateConfig>('/api/config/affiliate', {
    refreshInterval: 300000, // 5 minutes
    revalidateOnFocus: true,
  });

  return {
    discountPercent: data?.discountPercent ?? 20, // Current value
    commissionPercent: data?.commissionPercent ?? 20, // Current value
    calculateDiscountedPrice: (price) =>
      price * (1 - (data?.discountPercent ?? 20) / 100),
  };
}
```

**What this means:**

- ANY component that imports and uses this hook automatically gets current values
- The hook handles fetching, caching, auto-refresh
- You just use the values in your UI
- SystemConfig changes propagate automatically

---

## 🔧 Retrofitting Existing Pages

### Scenario: You Have Old Pages That Hardcoded Percentages

**Problem:** You created some pages in 2025 that hardcoded "20%" and "20%" before SystemConfig existed.

**Solution:** Retrofit those pages to use the hook.

### Step-by-Step Retrofit Process:

#### Example: Old Hardcoded Page

```typescript
// OLD CODE (Hardcoded - BAD)
export default function OldAffiliatePage() {
  const discount = 20; // ❌ Hardcoded
  const commission = 20; // ❌ Hardcoded

  return (
    <div>
      <p>Earn {commission}% commission on every sale!</p>
      <p>Customers save {discount}%</p>
    </div>
  );
}
```

#### Step 1: Import the Hook

```typescript
// RETROFITTED CODE (Dynamic - GOOD)
import { useAffiliateConfig } from '@/lib/hooks/useAffiliateConfig';

export default function OldAffiliatePage() {
  // ✅ Now uses SystemConfig
  const { discountPercent, commissionPercent } = useAffiliateConfig();

  return (
    <div>
      <p>Earn {commissionPercent}% commission on every sale!</p>
      <p>Customers save {discountPercent}%</p>
    </div>
  );
}
```

#### Step 2: Find and Replace Hardcoded Values

**Search for hardcoded percentages:**

```bash
# Find all files with hardcoded "20%" or "20.0"
grep -r "20%" app/ components/ lib/
grep -r "20\.0" app/ components/ lib/

# Find all files with hardcoded commission calculations
grep -r "* 0.2" app/ components/ lib/
grep -r "× 0.2" app/ components/ lib/
```

**Replace with hook:**

```typescript
// Before
const discountAmount = price * 0.2; // ❌ Hardcoded 20%

// After
const { discountPercent } = useAffiliateConfig();
const discountAmount = price * (discountPercent / 100); // ✅ Dynamic
```

#### Step 3: Update Email Templates

**Email templates also need retrofitting:**

```typescript
// lib/email/templates/affiliate-welcome.tsx
import { useAffiliateConfig } from '@/lib/hooks/useAffiliateConfig';

export function AffiliateWelcomeEmail({ affiliateName }: { affiliateName: string }) {
  const { commissionPercent } = useAffiliateConfig();

  return (
    <div>
      <h1>Welcome, {affiliateName}!</h1>
      <p>
        You'll earn <strong>{commissionPercent}%</strong> commission on every sale!
      </p>
    </div>
  );
}
```

**For server-side emails (no React hooks):**

```typescript
// lib/email/send-affiliate-welcome.ts
import { prisma } from '@/lib/prisma';

export async function sendAffiliateWelcomeEmail(affiliateId: string) {
  // Fetch config from database directly (server-side)
  const commissionConfig = await prisma.systemConfig.findUnique({
    where: { key: 'affiliate_commission_percent' },
  });

  const commissionPercent = parseFloat(commissionConfig?.value || '20.0');

  const emailHtml = `
    <h1>Welcome!</h1>
    <p>You'll earn <strong>${commissionPercent}%</strong> commission on every sale!</p>
  `;

  await sendEmail({
    to: affiliate.email,
    subject: 'Welcome to Affiliate Program',
    html: emailHtml,
  });
}
```

### Retrofit Checklist:

When retrofitting old pages:

- [ ] Search for hardcoded percentages (20, 20.0, 0.2, etc.)
- [ ] Import `useAffiliateConfig` hook in frontend components
- [ ] Replace hardcoded values with `discountPercent` and `commissionPercent`
- [ ] Update calculations to use dynamic percentages
- [ ] Test the page shows correct values
- [ ] Test the page updates when admin changes settings
- [ ] Update email templates (both React and server-side)
- [ ] Update any PDF generators or print stylesheets
- [ ] Update any mobile app components (if applicable)

---

## ➕ Adding New Configuration Settings

### Scenario: You Want to Add a New Setting to SystemConfig

**Example:** You want to add "affiliate_bonus_threshold" (earn bonus when reaching X sales).

### Step-by-Step Guide:

#### Step 1: Add Database Seed

```typescript
// prisma/seed.ts (or add to existing seed)
await prisma.systemConfig.createMany({
  data: [
    // Existing settings
    {
      key: 'affiliate_discount_percent',
      value: '20.0',
      valueType: 'number',
      description: 'Default discount percentage for affiliate codes',
      category: 'affiliate',
    },
    {
      key: 'affiliate_commission_percent',
      value: '20.0',
      valueType: 'number',
      description: 'Default commission percentage for affiliates',
      category: 'affiliate',
    },
    {
      key: 'affiliate_codes_per_month',
      value: '15',
      valueType: 'number',
      description: 'Number of codes distributed to each affiliate monthly',
      category: 'affiliate',
    },

    // 🆕 NEW SETTING
    {
      key: 'affiliate_bonus_threshold',
      value: '50',
      valueType: 'number',
      description: 'Number of sales required to earn bonus reward',
      category: 'affiliate',
    },
  ],
  skipDuplicates: true,
});
```

#### Step 2: Update TypeScript Interface

```typescript
// lib/hooks/useAffiliateConfig.ts
export interface AffiliateConfig {
  discountPercent: number;
  commissionPercent: number;
  codesPerMonth: number;
  bonusThreshold: number; // 🆕 NEW
  regularPrice: number;
  lastUpdated: string;
}

export function useAffiliateConfig() {
  const { data, error, isLoading } = useSWR<AffiliateConfig>(
    '/api/config/affiliate',
    {
      refreshInterval: 300000,
      dedupingInterval: 60000,
      revalidateOnFocus: true,
    }
  );

  return {
    config: data,
    discountPercent: data?.discountPercent ?? 20,
    commissionPercent: data?.commissionPercent ?? 20,
    bonusThreshold: data?.bonusThreshold ?? 50, // 🆕 NEW
    calculateDiscountedPrice: (regularPrice: number) => {
      const discount = data?.discountPercent ?? 20;
      return regularPrice * (1 - discount / 100);
    },
    isLoading,
    error,
  };
}
```

#### Step 3: Update API Endpoint

```typescript
// app/api/config/affiliate/route.ts
export async function GET(req: NextRequest) {
  try {
    const configs = await prisma.systemConfig.findMany({
      where: {
        key: {
          in: [
            'affiliate_discount_percent',
            'affiliate_commission_percent',
            'affiliate_codes_per_month',
            'affiliate_bonus_threshold', // 🆕 NEW
          ],
        },
      },
    });

    const configMap = Object.fromEntries(configs.map((c) => [c.key, c.value]));

    return NextResponse.json({
      discountPercent: parseFloat(
        configMap.affiliate_discount_percent || '20.0'
      ),
      commissionPercent: parseFloat(
        configMap.affiliate_commission_percent || '20.0'
      ),
      codesPerMonth: parseInt(configMap.affiliate_codes_per_month || '15'),
      bonusThreshold: parseInt(configMap.affiliate_bonus_threshold || '50'), // 🆕 NEW
      regularPrice: 29.0,
      lastUpdated: configs[0]?.updatedAt || new Date(),
    });
  } catch (error) {
    console.error('Failed to fetch affiliate config:', error);
    return NextResponse.json(
      { error: 'Failed to fetch configuration' },
      { status: 500 }
    );
  }
}
```

#### Step 4: Update Admin Settings UI

```typescript
// app/admin/settings/affiliate/page.tsx
export default function AffiliateSettingsPage() {
  const [discountPercent, setDiscountPercent] = useState(20);
  const [commissionPercent, setCommissionPercent] = useState(20);
  const [codesPerMonth, setCodesPerMonth] = useState(15);
  const [bonusThreshold, setBonusThreshold] = useState(50);  // 🆕 NEW

  return (
    <form>
      {/* Existing fields */}
      <input
        type="number"
        value={discountPercent}
        onChange={(e) => setDiscountPercent(Number(e.target.value))}
      />

      <input
        type="number"
        value={commissionPercent}
        onChange={(e) => setCommissionPercent(Number(e.target.value))}
      />

      <input
        type="number"
        value={codesPerMonth}
        onChange={(e) => setCodesPerMonth(Number(e.target.value))}
      />

      {/* 🆕 NEW FIELD */}
      <label>Bonus Threshold (Sales Required)</label>
      <input
        type="number"
        value={bonusThreshold}
        onChange={(e) => setBonusThreshold(Number(e.target.value))}
        min={1}
        max={1000}
      />
      <p className="help-text">
        Affiliates earn a bonus reward after reaching this many sales
      </p>

      <button type="submit">Save Changes</button>
    </form>
  );
}
```

#### Step 5: Update Admin PATCH Endpoint

```typescript
// app/api/admin/settings/affiliate/route.ts
export async function PATCH(req: NextRequest) {
  const session = await getServerSession();
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const body = await req.json();
  const {
    discountPercent,
    commissionPercent,
    codesPerMonth,
    bonusThreshold,
    reason,
  } = body;

  const changes = [];

  // Handle existing settings...

  // 🆕 Handle new setting
  if (bonusThreshold !== undefined) {
    const current = await prisma.systemConfig.findUnique({
      where: { key: 'affiliate_bonus_threshold' },
    });

    await prisma.systemConfig.update({
      where: { key: 'affiliate_bonus_threshold' },
      data: {
        value: bonusThreshold.toString(),
        updatedBy: session.user.id,
      },
    });

    if (current && current.value !== bonusThreshold.toString()) {
      await prisma.systemConfigHistory.create({
        data: {
          configKey: 'affiliate_bonus_threshold',
          oldValue: current.value,
          newValue: bonusThreshold.toString(),
          changedBy: session.user.email,
          reason,
        },
      });

      changes.push({
        setting: 'bonusThreshold',
        oldValue: current.value,
        newValue: bonusThreshold.toString(),
      });
    }
  }

  return NextResponse.json({
    success: true,
    message:
      'Affiliate settings updated. Changes will propagate across all pages within 5 minutes.',
    changes,
  });
}
```

#### Step 6: Use in Your Pages

```typescript
// app/affiliate/dashboard/page.tsx
import { useAffiliateConfig } from '@/lib/hooks/useAffiliateConfig';

export default function AffiliateDashboard() {
  const { bonusThreshold } = useAffiliateConfig();
  const salesCount = 42; // From your data

  return (
    <div>
      <h2>Bonus Progress</h2>
      <p>
        You've made {salesCount} sales.
        Reach {bonusThreshold} sales to unlock your bonus reward!
      </p>
      <ProgressBar current={salesCount} target={bonusThreshold} />
    </div>
  );
}
```

### That's It! New Setting Complete

Now admin can change the bonus threshold from the dashboard, and all pages using `bonusThreshold` will automatically update within 5 minutes.

---

## 📡 API Reference

### Public Endpoint: Get Current Config

**Endpoint:** `GET /api/config/affiliate`

**Authentication:** None (public)

**Response:**

```json
{
  "discountPercent": 20.0,
  "commissionPercent": 20.0,
  "codesPerMonth": 15,
  "regularPrice": 29.0,
  "lastUpdated": "2025-11-16T15:30:00Z"
}
```

**Caching:** 5 minutes (300 seconds)

**Usage:**

```typescript
const response = await fetch('/api/config/affiliate');
const config = await response.json();
console.log(config.discountPercent); // 20.0
```

---

### Admin Endpoint: Get Settings with Metadata

**Endpoint:** `GET /api/admin/settings/affiliate`

**Authentication:** Required (Admin only)

**Response:**

```json
{
  "discountPercent": {
    "value": 20.0,
    "updatedBy": "admin@tradingalerts.com",
    "updatedAt": "2025-11-10T10:00:00Z"
  },
  "commissionPercent": {
    "value": 20.0,
    "updatedBy": "admin@tradingalerts.com",
    "updatedAt": "2025-11-10T10:00:00Z"
  },
  "codesPerMonth": {
    "value": 15,
    "updatedBy": "admin@tradingalerts.com",
    "updatedAt": "2025-11-10T10:00:00Z"
  }
}
```

---

### Admin Endpoint: Update Settings

**Endpoint:** `PATCH /api/admin/settings/affiliate`

**Authentication:** Required (Admin only)

**Request Body:**

```json
{
  "discountPercent": 25.0,
  "commissionPercent": 25.0,
  "codesPerMonth": 20,
  "reason": "Q1 marketing campaign to attract more affiliates"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Affiliate settings updated. Changes will propagate across all pages within 5 minutes.",
  "changes": [
    {
      "setting": "discountPercent",
      "oldValue": "20.0",
      "newValue": "25.0"
    },
    {
      "setting": "commissionPercent",
      "oldValue": "20.0",
      "newValue": "25.0"
    }
  ]
}
```

---

### Admin Endpoint: Get Change History

**Endpoint:** `GET /api/admin/settings/affiliate/history`

**Authentication:** Required (Admin only)

**Query Parameters:**

- `limit` (number, default: 50) - Number of history entries
- `offset` (number, default: 0) - Pagination offset
- `configKey` (string, optional) - Filter by specific setting

**Response:**

```json
{
  "history": [
    {
      "id": "clh1abc123",
      "configKey": "affiliate_commission_percent",
      "oldValue": "20.0",
      "newValue": "25.0",
      "changedBy": "admin@tradingalerts.com",
      "changedAt": "2025-11-15T15:45:00Z",
      "reason": "Q1 marketing campaign"
    }
  ],
  "total": 42,
  "limit": 50,
  "offset": 0
}
```

---

## 🪝 Frontend Hook Reference

### useAffiliateConfig()

**Location:** `lib/hooks/useAffiliateConfig.ts`

**Usage:**

```typescript
import { useAffiliateConfig } from '@/lib/hooks/useAffiliateConfig';

function MyComponent() {
  const {
    config,              // Full config object
    discountPercent,     // Current discount (e.g., 20)
    commissionPercent,   // Current commission (e.g., 20)
    calculateDiscountedPrice,  // Helper function
    isLoading,           // Loading state
    error,               // Error state
  } = useAffiliateConfig();

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error loading config</div>;

  return (
    <div>
      <p>Discount: {discountPercent}%</p>
      <p>Commission: {commissionPercent}%</p>
      <p>Price with discount: ${calculateDiscountedPrice(29.00)}</p>
    </div>
  );
}
```

**Return Values:**

| Property                   | Type                           | Description                          |
| -------------------------- | ------------------------------ | ------------------------------------ |
| `config`                   | `AffiliateConfig \| undefined` | Full config object                   |
| `discountPercent`          | `number`                       | Current discount % (fallback: 20)    |
| `commissionPercent`        | `number`                       | Current commission % (fallback: 20)  |
| `calculateDiscountedPrice` | `(price: number) => number`    | Helper to calculate discounted price |
| `isLoading`                | `boolean`                      | True while fetching config           |
| `error`                    | `any`                          | Error object if fetch failed         |

**Caching Behavior:**

- Auto-refreshes every 5 minutes
- Revalidates on window focus
- Deduplicates requests within 1 minute
- Uses SWR for optimal performance

---

## 🔧 Backend Pattern Reference

### Pattern 1: Code Generation (Cron Jobs)

**Use this pattern when generating new affiliate codes:**

```typescript
// app/api/cron/distribute-codes/route.ts
export async function POST(req: NextRequest) {
  // 1. Fetch current config from SystemConfig
  const configs = await prisma.systemConfig.findMany({
    where: {
      key: {
        in: [
          'affiliate_discount_percent',
          'affiliate_commission_percent',
          'affiliate_codes_per_month',
        ],
      },
    },
  });

  const configMap = Object.fromEntries(configs.map((c) => [c.key, c.value]));

  const discountPercent = parseFloat(
    configMap.affiliate_discount_percent || '20.0'
  );
  const commissionPercent = parseFloat(
    configMap.affiliate_commission_percent || '20.0'
  );
  const codesPerMonth = parseInt(configMap.affiliate_codes_per_month || '15');

  // 2. Generate codes with current config values
  const activeAffiliates = await prisma.affiliate.findMany({
    where: { status: 'ACTIVE' },
  });

  for (const affiliate of activeAffiliates) {
    const codes = Array.from({ length: codesPerMonth }, () => ({
      code: generateSecureCode(),
      affiliateId: affiliate.id,
      discountPercent, // ✅ From SystemConfig
      commissionPercent, // ✅ From SystemConfig
      expiresAt: endOfMonth(),
      status: 'ACTIVE',
    }));

    await prisma.affiliateCode.createMany({ data: codes });
  }

  return NextResponse.json({ success: true });
}
```

---

### Pattern 2: Manual Code Distribution

**Use this pattern when admin manually distributes codes:**

```typescript
// app/api/admin/affiliates/[id]/distribute-codes/route.ts
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  // Fetch current config
  const discountConfig = await prisma.systemConfig.findUnique({
    where: { key: 'affiliate_discount_percent' },
  });
  const commissionConfig = await prisma.systemConfig.findUnique({
    where: { key: 'affiliate_commission_percent' },
  });

  const discountPercent = parseFloat(discountConfig?.value || '20.0');
  const commissionPercent = parseFloat(commissionConfig?.value || '20.0');

  // Generate codes
  const codes = await Promise.all(
    Array(15)
      .fill(null)
      .map(() =>
        prisma.affiliateCode.create({
          data: {
            code: generateSecureCode(),
            affiliateId: params.id,
            discountPercent, // ✅ From SystemConfig
            commissionPercent, // ✅ From SystemConfig
            expiresAt: endOfMonth(),
            status: 'ACTIVE',
          },
        })
      )
  );

  return NextResponse.json({ codesDistributed: codes.length });
}
```

---

### Pattern 3: Email Templates (Server-Side)

**Use this pattern for sending emails with current percentages:**

```typescript
// lib/email/send-welcome.ts
export async function sendAffiliateWelcomeEmail(affiliateId: string) {
  const affiliate = await prisma.affiliate.findUnique({
    where: { id: affiliateId },
  });

  // Fetch current commission percentage
  const commissionConfig = await prisma.systemConfig.findUnique({
    where: { key: 'affiliate_commission_percent' },
  });

  const commissionPercent = parseFloat(commissionConfig?.value || '20.0');

  const emailHtml = `
    <h1>Welcome, ${affiliate.fullName}!</h1>
    <p>
      You'll earn <strong>${commissionPercent}%</strong> commission on every sale!
    </p>
  `;

  await sendEmail({
    to: affiliate.email,
    subject: 'Welcome to Affiliate Program',
    html: emailHtml,
  });
}
```

---

## 🧪 Testing Changes

### Test 1: Verify Current Values Display

```typescript
// Test that your page shows current config
test('displays current affiliate discount percentage', () => {
  render(<PricingPage />);

  // Should show current value from SystemConfig (not hardcoded 20%)
  expect(screen.getByText(/20% off/i)).toBeInTheDocument();
});
```

---

### Test 2: Verify Auto-Update

```typescript
// Test that page updates when config changes
test('updates discount when admin changes settings', async () => {
  const { rerender } = render(<PricingPage />);

  // Initially shows 20%
  expect(screen.getByText(/20% off/i)).toBeInTheDocument();

  // Admin changes to 25%
  await updateAffiliateSettings({ discountPercent: 25 });

  // Wait for SWR to revalidate (max 5 minutes, but can be instant in tests)
  await waitFor(() => {
    expect(screen.getByText(/25% off/i)).toBeInTheDocument();
  }, { timeout: 10000 });
});
```

---

### Test 3: Verify Backend Uses SystemConfig

```typescript
// Test that code generation uses SystemConfig
test('generates codes with current config percentages', async () => {
  // Set config to custom values
  await prisma.systemConfig.update({
    where: { key: 'affiliate_discount_percent' },
    data: { value: '25.0' },
  });

  await prisma.systemConfig.update({
    where: { key: 'affiliate_commission_percent' },
    data: { value: '30.0' },
  });

  // Generate codes
  await POST(mockRequest, { params: { id: 'affiliate123' } });

  // Verify codes have correct percentages
  const codes = await prisma.affiliateCode.findMany({
    where: { affiliateId: 'affiliate123' },
  });

  expect(codes[0].discountPercent).toBe(25.0);
  expect(codes[0].commissionPercent).toBe(30.0);
});
```

---

## 🔍 Troubleshooting

### Issue 1: Page Shows Old Percentages After Admin Changed Them

**Symptoms:**

- Admin changed commission to 25% in dashboard
- Page still shows 20% commission

**Causes:**

1. SWR cache hasn't refreshed yet (wait up to 5 minutes)
2. Browser cache preventing API call
3. Page not using `useAffiliateConfig()` hook

**Solutions:**

```typescript
// Solution 1: Force refresh the page
window.location.reload();

// Solution 2: Use SWR mutate to force immediate refresh
import { useSWRConfig } from 'swr';

function MyComponent() {
  const { mutate } = useSWRConfig();
  const config = useAffiliateConfig();

  const forceRefresh = () => {
    mutate('/api/config/affiliate');
  };

  return <button onClick={forceRefresh}>Refresh Config</button>;
}

// Solution 3: Verify page is using the hook
// Check that component imports and uses useAffiliateConfig()
import { useAffiliateConfig } from '@/lib/hooks/useAffiliateConfig';
```

---

### Issue 2: New Page Doesn't Show Dynamic Percentages

**Symptoms:**

- Created new page
- Page shows undefined or NaN for percentages

**Cause:**

- Forgot to import hook
- Hook not called in component
- Component is server-side (can't use hooks)

**Solutions:**

```typescript
// Solution 1: Import and use hook (Client Component)
'use client';  // ✅ Must be client component to use hooks

import { useAffiliateConfig } from '@/lib/hooks/useAffiliateConfig';

export default function NewPage() {
  const { discountPercent, commissionPercent } = useAffiliateConfig();

  return <div>Discount: {discountPercent}%</div>;
}

// Solution 2: Fetch from API (Server Component)
export default async function NewServerPage() {
  // Server components can't use hooks, fetch directly
  const response = await fetch('http://localhost:3000/api/config/affiliate', {
    cache: 'no-store'  // or { next: { revalidate: 300 } } for 5-min cache
  });
  const config = await response.json();

  return <div>Discount: {config.discountPercent}%</div>;
}
```

---

### Issue 3: Admin Settings Page Not Saving Changes

**Symptoms:**

- Admin clicks "Save Changes"
- Page shows success message
- But SystemConfig table not updated

**Cause:**

- PATCH endpoint not updating database
- Missing authentication
- Wrong API route

**Solutions:**

```typescript
// Verify PATCH endpoint updates database
export async function PATCH(req: NextRequest) {
  console.log('PATCH /api/admin/settings/affiliate called');

  const body = await req.json();
  console.log('Request body:', body);

  // Update SystemConfig
  const updated = await prisma.systemConfig.update({
    where: { key: 'affiliate_commission_percent' },
    data: {
      value: body.commissionPercent.toString(),
      updatedBy: session.user.id,
    },
  });

  console.log('Updated config:', updated);

  return NextResponse.json({ success: true });
}
```

---

### Issue 4: Codes Generated Before Config Change Still Using Old Percentages

**Symptoms:**

- Admin changed commission to 25%
- But existing codes still show 20%

**This is Expected Behavior!**

**Explanation:**

- Existing codes are snapshots (immutable)
- They keep their original percentages
- Only NEW codes use updated percentages
- This preserves historical accuracy

**Verification:**

```sql
-- Codes before change (keep 20%)
SELECT code, commissionPercent, createdAt
FROM AffiliateCode
WHERE createdAt < '2025-11-15 15:00:00';
-- Result: All show 20.0% ✅

-- Codes after change (use 25%)
SELECT code, commissionPercent, createdAt
FROM AffiliateCode
WHERE createdAt > '2025-11-15 15:00:00';
-- Result: All show 25.0% ✅
```

---

## 📋 Summary Checklist

### For Retrofitting Existing Pages:

- [ ] Search codebase for hardcoded percentages (20, 20.0, 0.2)
- [ ] Import `useAffiliateConfig` in all frontend components
- [ ] Replace hardcoded values with hook values
- [ ] Update email templates (React and server-side)
- [ ] Test pages show current config values
- [ ] Test pages update when admin changes settings

### For Adding New Pages:

- [ ] Import `useAffiliateConfig` in new component
- [ ] Use `discountPercent` and `commissionPercent` from hook
- [ ] Avoid hardcoding any percentages
- [ ] Test page displays current values
- [ ] Verify page auto-updates (wait 5 minutes or force refresh)

### For Adding New Settings:

- [ ] Add seed data to `prisma/seed.ts`
- [ ] Update `AffiliateConfig` TypeScript interface
- [ ] Update `useAffiliateConfig` hook return values
- [ ] Update `GET /api/config/affiliate` endpoint
- [ ] Update admin settings UI form
- [ ] Update `PATCH /api/admin/settings/affiliate` endpoint
- [ ] Update OpenAPI spec (optional but recommended)
- [ ] Test admin can view and change new setting
- [ ] Test pages display new setting value
- [ ] Test change history logs new setting changes

---

## 🎯 Key Takeaways

### ✅ YES - New Pages Auto-Detect SystemConfig

**If you retrofit web pages or add new dashboards later:**

1. **They WILL automatically detect and use current discount/commission percentages**
2. **WITHOUT any modification to SystemConfig itself**
3. **You just need to import and use the `useAffiliateConfig()` hook**
4. **Changes propagate within 1-5 minutes automatically**

### The Only Requirement:

**Frontend (Client Components):**

```typescript
import { useAffiliateConfig } from '@/lib/hooks/useAffiliateConfig';

const { discountPercent, commissionPercent } = useAffiliateConfig();
```

**Backend (Server-Side):**

```typescript
const config = await prisma.systemConfig.findUnique({
  where: { key: 'affiliate_commission_percent' },
});
const commissionPercent = parseFloat(config?.value || '20.0');
```

### SystemConfig is Future-Proof:

- ✅ Works with pages created in 2025
- ✅ Works with pages created in 2026
- ✅ Works with pages created in 2027+
- ✅ No SystemConfig modification needed for new pages
- ✅ Admin can change percentages anytime
- ✅ All pages update automatically

---

**Document Version:** 1.0.0
**Last Updated:** 2025-11-16
**Next Review:** When adding first retrofit page or new setting
