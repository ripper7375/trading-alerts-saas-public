# Phase 3.5: Frontend UI Implementation (Antigravity Master Prompt)

## Context & Mission

You are tasked with implementing **complete frontend UI** for the Trading Alerts SaaS V7 platform using Antigravity (autonomous UI builder). This phase occurs **after backend APIs are complete** (Phase 3) and **before E2E testing** (Phase 4).

**Your mission:** Build all UI pages that consume the tested backend APIs from Phases 1-3, following strict architectural constraints to prevent structural violations.

---

## Prerequisites

✅ **Phase 1 completed:** Parts 1-15 backend tested
✅ **Phase 2 completed:** Part 16 utilities built
✅ **Phase 3 completed:** Parts 17A, 17B, 18 backend built with TDD
✅ **All backend APIs working** and tested with Supertest
✅ **OpenAPI specification available** for API contracts
✅ **Type definitions ready** in `types/*.ts`

**Repository:** https://github.com/ripper7375/trading-alerts-saas-v7

---

## 🚨 CRITICAL CONSTRAINTS - READ FIRST

### **RULE 1: DIRECTORY STRUCTURE - ABSOLUTELY NO CHANGES**

```
✅ CORRECT (Next.js Route Group):
app/(marketing)/pricing/page.tsx → URL: /pricing
app/(dashboard)/alerts/page.tsx → URL: /alerts
app/(dashboard)/admin/page.tsx → URL: /admin

❌ FORBIDDEN - DO NOT CREATE:
app/marketing/pricing/page.tsx
app/dashboard/alerts/page.tsx
app/dashboard/admin/page.tsx
```

**YOU MUST:**

- ✅ ONLY create/modify files INSIDE `app/(dashboard)/` and `app/(marketing)/`
- ✅ Keep the parentheses: `(dashboard)` and `(marketing)` - this is Next.js route group syntax
- ✅ NEVER create `app/dashboard/` or `app/marketing/` directories
- ✅ NEVER delete existing files from `app/(dashboard)/`

**IF YOU CREATE `app/dashboard/` → YOU FAILED THE TASK**

---

### **RULE 2: SEED COMPONENTS - USE AS REFERENCE ONLY**

**Seed components are REFERENCE PATTERNS, not to be copied verbatim.**

Available seed components in `seed-code/v0-components/`:

- Login/Registration forms
- Dashboard layouts
- Chart components
- Alert management
- Billing/subscription pages
- Admin dashboards
- Marketing homepage

**YOU MUST:**

- ✅ Study seed component patterns
- ✅ Adapt patterns to connect with REAL backend APIs
- ✅ Use actual types from `types/*.ts`
- ✅ Connect to actual API endpoints (not mocked data)

**YOU MUST NOT:**

- ❌ Copy seed components with mock data
- ❌ Use placeholder/dummy API calls
- ❌ Skip real backend integration

---

### **RULE 3: API INTEGRATION - REAL CONNECTIONS ONLY**

**All forms and data fetching MUST connect to actual backend APIs.**

Available APIs (from Phases 1-3):

**Authentication (Part 5):**

- `POST /api/auth/signup` - Register new user
- `POST /api/auth/signin` - Login user
- `POST /api/auth/signout` - Logout user
- `POST /api/auth/reset-password` - Password reset
- `GET /api/auth/session` - Get current session

**Subscription (Part 12):**

- `GET /api/subscription` - Get subscription status
- `POST /api/checkout` - Create Stripe checkout session
- `POST /api/subscription/cancel` - Cancel subscription
- `GET /api/invoices` - List invoices
- `POST /api/webhooks/stripe` - Stripe webhook (no UI needed)

**Alerts (Part 11):**

- `GET /api/alerts` - List user alerts
- `POST /api/alerts` - Create alert
- `PATCH /api/alerts/:id` - Update alert
- `DELETE /api/alerts/:id` - Delete alert

**Watchlist (Part 10):**

- `GET /api/watchlist` - Get watchlist
- `POST /api/watchlist` - Add symbol
- `DELETE /api/watchlist/:symbol` - Remove symbol

**Charts (Part 9):**

- `GET /api/charts/:symbol/:timeframe` - Get chart data
- `GET /api/indicators/:symbol` - Get indicators

**Notifications (Part 15):**

- `GET /api/notifications` - List notifications
- `PATCH /api/notifications/:id/read` - Mark as read
- `DELETE /api/notifications/:id` - Delete notification

**Affiliate (Part 17A, 17B):**

- `POST /api/affiliate/register` - Become affiliate
- `GET /api/affiliate/dashboard` - Get stats
- `POST /api/affiliate/track` - Track click (automatic)
- `GET /api/admin/affiliates` - List all affiliates (admin)
- `POST /api/admin/affiliates/:id/payout` - Process payout (admin)

**dLocal Payments (Part 18):**

- `POST /api/payment/dlocal/create` - Create payment
- `GET /api/payment/dlocal/:id` - Get payment status
- `POST /api/webhooks/dlocal` - dLocal webhook (no UI needed)

**Admin (Part 14):**

- `GET /api/admin/users` - List users
- `PATCH /api/admin/users/:id` - Update user
- `GET /api/admin/api-usage` - API usage stats
- `GET /api/admin/errors` - Error logs

---

## UI Implementation Scope (Parts 5, 8-18)

### **Part 5: Authentication (3 pages)**

**Pages to Build:**

1. **Login Page** - `app/(marketing)/login/page.tsx`
   - Email/password form
   - "Forgot password" link
   - "Sign up" link
   - OAuth providers (Google)
   - API: `POST /api/auth/signin`
   - Seed: `seed-code/v0-components/next-js-login-form/`

2. **Signup Page** - `app/(marketing)/signup/page.tsx`
   - Email/password/name form
   - Password strength indicator
   - Terms acceptance checkbox
   - API: `POST /api/auth/signup`
   - Seed: `seed-code/v0-components/registration-form-component-v2/`

3. **Password Reset** - `app/(marketing)/forgot-password/page.tsx`
   - Email input form
   - Reset confirmation
   - API: `POST /api/auth/reset-password`
   - Seed: `seed-code/v0-components/forgot-password-form/`

**Components to Build:**

- `components/auth/LoginForm.tsx`
- `components/auth/SignupForm.tsx`
- `components/auth/PasswordResetForm.tsx`

**API Integration Example:**

```typescript
// components/auth/LoginForm.tsx
'use client';

import { signIn } from 'next-auth/react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function LoginForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError('Invalid email or password');
      setIsLoading(false);
      return;
    }

    router.push('/dashboard');
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields from seed component */}
      {error && <p className="text-red-600">{error}</p>}
      <button type="submit" disabled={isLoading}>
        {isLoading ? 'Signing in...' : 'Sign in'}
      </button>
    </form>
  );
}
```

---

### **Part 8: Dashboard & Layout (3 pages)**

**Pages to Build:**

1. **Dashboard Layout** - `app/(dashboard)/layout.tsx`
   - Sidebar navigation
   - Top header with user menu
   - Breadcrumbs
   - Mobile responsive
   - Seed: `seed-code/v0-components/dashboard-layout/`

2. **Dashboard Home** - `app/(dashboard)/dashboard/page.tsx`
   - Welcome message
   - Quick stats (alerts, watchlist count)
   - Recent activity
   - Upgrade prompt (if FREE tier)
   - API: `GET /api/alerts`, `GET /api/watchlist`
   - Seed: `seed-code/v0-components/dashboard-home-component/`

3. **Footer Component** - `components/layout/Footer.tsx`
   - Links to marketing pages
   - Copyright
   - Social links
   - Seed: `seed-code/v0-components/footer-component/`

**Components to Build:**

- `components/layout/DashboardSidebar.tsx`
- `components/layout/DashboardHeader.tsx`
- `components/layout/MobileNav.tsx`

**Example Layout:**

```typescript
// app/(dashboard)/layout.tsx
import { DashboardSidebar } from '@/components/layout/DashboardSidebar';
import { DashboardHeader } from '@/components/layout/DashboardHeader';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession();

  if (!session) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen flex">
      <DashboardSidebar />
      <div className="flex-1 flex flex-col">
        <DashboardHeader user={session.user} />
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
```

---

### **Part 9: Charts & Visualization (2 pages)**

**Pages to Build:**

1. **Charts Page** - `app/(dashboard)/charts/page.tsx`
   - Symbol selector (dropdown)
   - Timeframe selector (H1, H4, D1, W1)
   - Chart type selector (candlestick, line)
   - Redirect to `/charts/[symbol]/[timeframe]`
   - Seed: `seed-code/v0-components/chart-controls-component/`

2. **Chart Display** - `app/(dashboard)/charts/[symbol]/[timeframe]/page.tsx`
   - Trading chart (use Recharts or lightweight-charts)
   - Indicator controls (MA, RSI, Bollinger Bands)
   - Timeframe selector
   - Symbol selector
   - Upgrade modal (if FREE tier)
   - API: `GET /api/charts/:symbol/:timeframe`
   - Seed: `seed-code/v0-components/trading-chart-component/`

**Components to Build:**

- `components/charts/TradingChart.tsx`
- `components/charts/SymbolSelector.tsx`
- `components/charts/TimeframeSelector.tsx`
- `components/charts/IndicatorControls.tsx`
- `components/charts/UpgradeModal.tsx`

**API Integration Example:**

```typescript
// app/(dashboard)/charts/[symbol]/[timeframe]/page.tsx
import { TradingChart } from '@/components/charts/TradingChart';

export default async function ChartPage({
  params,
}: {
  params: { symbol: string; timeframe: string };
}) {
  // Fetch chart data server-side
  const response = await fetch(
    `${process.env.NEXTAUTH_URL}/api/charts/${params.symbol}/${params.timeframe}`,
    { cache: 'no-store' }
  );

  if (!response.ok) {
    return <div>Failed to load chart data</div>;
  }

  const chartData = await response.json();

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">
        {params.symbol} - {params.timeframe}
      </h1>
      <TradingChart data={chartData} symbol={params.symbol} />
    </div>
  );
}
```

---

### **Part 10: Watchlist System (1 page)**

**Pages to Build:**

1. **Watchlist Page** - `app/(dashboard)/watchlist/page.tsx`
   - List of watched symbols
   - Current price display
   - Add/remove symbol buttons
   - Quick navigation to charts
   - API: `GET /api/watchlist`, `POST /api/watchlist`, `DELETE /api/watchlist/:symbol`
   - Seed: `seed-code/v0-components/watchlist-page-component/`

**Components to Build:**

- `components/watchlist/WatchlistClient.tsx`
- `components/watchlist/AddSymbolDialog.tsx`

**Client Component Example:**

```typescript
// components/watchlist/WatchlistClient.tsx
'use client';

import { useState } from 'react';

export function WatchlistClient({ initialWatchlist }: { initialWatchlist: any[] }) {
  const [watchlist, setWatchlist] = useState(initialWatchlist);
  const [isLoading, setIsLoading] = useState(false);

  async function removeSymbol(symbol: string) {
    setIsLoading(true);

    const response = await fetch(`/api/watchlist/${symbol}`, {
      method: 'DELETE',
    });

    if (response.ok) {
      setWatchlist(watchlist.filter(item => item.symbol !== symbol));
    }

    setIsLoading(false);
  }

  return (
    <div className="space-y-4">
      {watchlist.map(item => (
        <div key={item.symbol} className="flex justify-between p-4 border rounded">
          <span className="font-bold">{item.symbol}</span>
          <button
            onClick={() => removeSymbol(item.symbol)}
            disabled={isLoading}
          >
            Remove
          </button>
        </div>
      ))}
    </div>
  );
}
```

---

### **Part 11: Alerts System (3 pages)**

**Pages to Build:**

1. **Alerts List** - `app/(dashboard)/alerts/page.tsx`
   - Active alerts table
   - Triggered alerts history
   - Edit/delete buttons
   - "Create Alert" button
   - API: `GET /api/alerts`
   - Seed: `seed-code/v0-components/alerts-management-page/`

2. **Create Alert** - `app/(dashboard)/alerts/new/page.tsx`
   - Symbol selector
   - Condition selector (above/below)
   - Price input
   - Message input
   - Submit button
   - API: `POST /api/alerts`
   - Seed: `seed-code/v0-components/create-alert-modal/`

3. **Alerts Client Component** - `components/alerts/AlertsClient.tsx`
   - Client-side state management
   - Delete alert functionality
   - Edit alert modal

**Components to Build:**

- `components/alerts/AlertCard.tsx`
- `components/alerts/CreateAlertModal.tsx`

**API Integration:**

```typescript
// app/(dashboard)/alerts/new/page.tsx
import { CreateAlertForm } from '@/components/alerts/CreateAlertForm';

export default function NewAlertPage() {
  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Create Price Alert</h1>
      <CreateAlertForm />
    </div>
  );
}

// components/alerts/CreateAlertForm.tsx
'use client';

export function CreateAlertForm() {
  async function handleSubmit(formData: FormData) {
    const response = await fetch('/api/alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        symbol: formData.get('symbol'),
        condition: formData.get('condition'),
        price: parseFloat(formData.get('price') as string),
        message: formData.get('message'),
      }),
    });

    if (response.ok) {
      router.push('/alerts');
    }
  }

  return (
    <form action={handleSubmit}>
      {/* Form fields */}
    </form>
  );
}
```

---

### **Part 12: E-commerce & Billing (2 pages)**

**Pages to Build:**

1. **Pricing Page** - `app/(marketing)/pricing/page.tsx`
   - FREE vs PRO comparison
   - Feature list
   - Pricing cards
   - "Upgrade" button (calls `/api/checkout`)
   - FAQ section
   - Affiliate code support (`?ref=CODE`)
   - API: `POST /api/checkout`
   - Seed: `seed-code/v0-components/pricing-page-component-v3/`

2. **Billing Settings** - `app/(dashboard)/settings/billing/page.tsx`
   - Current subscription display
   - Tier badge (FREE/PRO)
   - Next billing date
   - Cancel subscription button
   - Invoice history
   - API: `GET /api/subscription`, `POST /api/subscription/cancel`, `GET /api/invoices`
   - Seed: `seed-code/v0-components/billing-and-subscription-page-v3/`

**Components to Build:**

- `components/billing/SubscriptionCard.tsx`
- `components/billing/InvoiceList.tsx`

**Pricing Page Example:**

```typescript
// app/(marketing)/pricing/page.tsx
import { PricingCard } from '@/components/billing/PricingCard';

export default function PricingPage({
  searchParams,
}: {
  searchParams: { ref?: string };
}) {
  const referralCode = searchParams.ref;

  return (
    <div className="container mx-auto py-12">
      <h1 className="text-4xl font-bold text-center mb-12">
        Simple, Transparent Pricing
      </h1>

      <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
        <PricingCard
          tier="FREE"
          price={0}
          features={[
            '5 active alerts',
            'Basic charts',
            'Email notifications',
          ]}
          current={true}
        />

        <PricingCard
          tier="PRO"
          price={29}
          features={[
            'Unlimited alerts',
            'Advanced charts',
            'Real-time notifications',
            'Technical indicators',
            'Priority support',
          ]}
          referralCode={referralCode}
        />
      </div>
    </div>
  );
}
```

---

### **Part 13: Settings System (2 pages)**

**Pages to Build:**

1. **Settings Layout** - `app/(dashboard)/settings/page.tsx`
   - Tabbed navigation (Profile, Billing, Notifications)
   - Redirect to `/settings/profile` by default
   - Seed: `seed-code/v0-components/settings-page-with-tabs-v3/`

2. **Profile Settings** - `app/(dashboard)/settings/profile/page.tsx`
   - Name input
   - Email (read-only)
   - Timezone selector
   - Photo upload
   - Save button
   - API: `PATCH /api/user/profile`
   - Seed: `seed-code/v0-components/profile-settings-form/`

**Components to Build:**

- `components/settings/ProfileSettingsForm.tsx`
- `components/settings/PhotoUploadModal.tsx`
- `components/settings/UnsavedChangesModal.tsx`

---

### **Part 14: Admin Dashboard (3 pages)**

**Pages to Build:**

1. **Admin Overview** - `app/(dashboard)/admin/page.tsx`
   - Total users count
   - FREE vs PRO breakdown
   - Revenue metrics
   - Recent signups
   - API: `GET /api/admin/dashboard`
   - Seed: `seed-code/v0-components/part-14-admin-dashboard-overview/` (read-only)

2. **User Management** - `app/(dashboard)/admin/users/page.tsx`
   - Users table (email, tier, status, created)
   - Search/filter
   - Edit tier button
   - Ban/unban button
   - API: `GET /api/admin/users`, `PATCH /api/admin/users/:id`
   - Seed: `seed-code/v0-components/part-14-admin-user-management/` (read-only)

3. **API Usage** - `app/(dashboard)/admin/api-usage/page.tsx`
   - Endpoint usage stats
   - Calls by tier
   - Error rate tracking
   - Date range filter
   - API: `GET /api/admin/api-usage`
   - Seed: `seed-code/v0-components/part-14-api-usage-analytics/` (read-only)

**Note:** Admin pages only accessible to users with `role: 'ADMIN'`

---

### **Part 15: Notifications & Real-time (1 page)**

**Integration into existing pages:**

1. **Notification Bell Component** - `components/notifications/NotificationBell.tsx`
   - Badge count
   - Dropdown list
   - Mark as read
   - Delete notification
   - Real-time updates (WebSocket)
   - API: `GET /api/notifications`, `PATCH /api/notifications/:id/read`
   - Seed: `seed-code/v0-components/notification-component-v3/`

2. **Add to Dashboard Header:**
   - Place notification bell in `components/layout/DashboardHeader.tsx`
   - Connect to WebSocket for real-time updates

**WebSocket Integration:**

```typescript
// components/notifications/NotificationBell.tsx
'use client';

import { useEffect, useState } from 'react';

export function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    // Fetch initial notifications
    fetch('/api/notifications')
      .then(res => res.json())
      .then(data => {
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount);
      });

    // Connect to WebSocket
    const ws = new WebSocket(process.env.NEXT_PUBLIC_WS_URL!);

    ws.onmessage = (event) => {
      const notification = JSON.parse(event.data);
      setNotifications(prev => [notification, ...prev]);
      setUnreadCount(prev => prev + 1);
    };

    return () => ws.close();
  }, []);

  return (
    <div className="relative">
      {/* Bell icon with badge */}
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center">
          {unreadCount}
        </span>
      )}
      {/* Dropdown with notification list */}
    </div>
  );
}
```

---

### **Part 16: Utilities & Infrastructure (3 pages)**

**Pages to Build:**

1. **Marketing Homepage** - `app/(marketing)/page.tsx`
   - Hero section
   - Features overview
   - Pricing teaser
   - Call to action
   - Testimonials
   - API: None (static content)
   - Seed: `seed-code/v0-components/next-js-marketing-homepage-v2/`

2. **Empty States Component** - `components/ui/EmptyState.tsx`
   - Icon
   - Title
   - Description
   - Action button
   - Seed: `seed-code/v0-components/empty-states-components/`

3. **User Profile Dropdown** - `components/layout/UserProfileDropdown.tsx`
   - User avatar
   - Name/email
   - Settings link
   - Logout button
   - Seed: `seed-code/v0-components/user-profile-dropdown/`

---

### **Part 17A: Affiliate Marketing - Affiliate Portal**

**Note:** Seed components are READ-ONLY references. Build NEW components.

**Pages to Build:**

1. **Affiliate Dashboard** - `app/(dashboard)/affiliate/dashboard/page.tsx`
   - Referral code display
   - Copy link button
   - Total clicks
   - Total conversions
   - Total earnings
   - Current balance
   - API: `GET /api/affiliate/dashboard`
   - Seed: `seed-code/v0-components/part-17a-affiliate-dashboard/` (read-only reference)

**Components to Build:**

- `components/affiliate/ReferralCodeCard.tsx`
- `components/affiliate/StatsOverview.tsx`

---

### **Part 17B: Affiliate Marketing - Admin & Automation**

**Pages to Build:**

1. **Affiliate Management (Admin)** - `app/(dashboard)/admin/affiliates/page.tsx`
   - All affiliates table
   - Total clicks/conversions/earnings per affiliate
   - Payout button (if balance > $50)
   - API: `GET /api/admin/affiliates`, `POST /api/admin/affiliates/:id/payout`
   - Seed: `seed-code/v0-components/part-17b-admin-affiliate-management/` (read-only reference)

2. **Payout Report** - `app/(dashboard)/admin/affiliates/pnl-report/page.tsx`
   - Monthly payout summary
   - Total commissions paid
   - Pending payouts
   - API: `GET /api/admin/affiliates/pnl-report`
   - Seed: `seed-code/v0-components/part-17b-admin-payout-report/` (read-only reference)

---

### **Part 18: dLocal Payments**

**Pages to Build:**

1. **Payment Method Selector** - `app/(dashboard)/settings/billing/payment-method/page.tsx`
   - Stripe option (default)
   - dLocal option (international)
   - Country selector (shows dLocal if applicable)
   - API: `POST /api/payment/dlocal/create`
   - Seed: `seed-code/v0-components/part-18-payment-method-selector/`

2. **Price Display Component** - `components/billing/PriceDisplay.tsx`
   - Shows price in USD
   - Shows converted price (if dLocal selected)
   - Updates based on country selection
   - Seed: `seed-code/v0-components/part-18-price-display-component/`

**Components to Build:**

- `components/billing/PaymentMethodSelector.tsx`
- `components/billing/DLocalCheckout.tsx`

---

## Quality Requirements

### **For All Pages:**

**TypeScript:**

- ✅ All components must have proper TypeScript types
- ✅ Use types from `types/*.ts` (don't create duplicates)
- ✅ No `any` types allowed
- ✅ Props interfaces clearly defined

**Styling:**

- ✅ Use Tailwind CSS utility classes
- ✅ Use shadcn/ui components where applicable
- ✅ Responsive design (mobile-first)
- ✅ Dark mode compatible
- ✅ Consistent spacing and colors

**State Management:**

- ✅ Use React hooks (`useState`, `useEffect`)
- ✅ Server components where possible
- ✅ Client components only when needed (`'use client'`)
- ✅ Proper loading states
- ✅ Proper error states

**API Integration:**

- ✅ All forms submit to real API endpoints
- ✅ Error handling for failed requests
- ✅ Success messages after actions
- ✅ Loading indicators during requests
- ✅ Proper HTTP status code handling

**Accessibility:**

- ✅ Semantic HTML
- ✅ Proper ARIA labels
- ✅ Keyboard navigation
- ✅ Focus management

---

## File Structure Validation

**Before submitting, verify:**

```
app/
├── (marketing)/              ✅ Parentheses present
│   ├── page.tsx
│   ├── pricing/
│   │   └── page.tsx
│   ├── login/
│   │   └── page.tsx
│   └── signup/
│       └── page.tsx
├── (dashboard)/              ✅ Parentheses present
│   ├── layout.tsx
│   ├── dashboard/
│   │   └── page.tsx
│   ├── alerts/
│   │   ├── page.tsx
│   │   └── new/
│   │       └── page.tsx
│   ├── charts/
│   │   ├── page.tsx
│   │   └── [symbol]/
│   │       └── [timeframe]/
│   │           └── page.tsx
│   ├── watchlist/
│   │   └── page.tsx
│   ├── settings/
│   │   ├── page.tsx
│   │   ├── profile/
│   │   │   └── page.tsx
│   │   └── billing/
│   │       └── page.tsx
│   ├── affiliate/
│   │   └── dashboard/
│   │       └── page.tsx
│   └── admin/
│       ├── page.tsx
│       ├── users/
│       │   └── page.tsx
│       ├── api-usage/
│       │   └── page.tsx
│       └── affiliates/
│           └── page.tsx
components/
├── auth/
├── alerts/
├── charts/
├── billing/
├── notifications/
├── layout/
└── ui/
```

**DO NOT CREATE:**

- ❌ `app/marketing/` (no parentheses)
- ❌ `app/dashboard/` (no parentheses)
- ❌ Any other directory structure

---

## Testing Checklist (Before Phase 4)

Before handing off to Phase 4 E2E testing, manually verify:

### **Authentication Flow:**

- [ ] Can register new user
- [ ] Can login with credentials
- [ ] Can logout
- [ ] Can reset password
- [ ] Redirects work correctly

### **Dashboard:**

- [ ] Dashboard layout renders
- [ ] Sidebar navigation works
- [ ] User menu displays
- [ ] Mobile navigation works

### **Alerts:**

- [ ] Can view alerts list
- [ ] Can create new alert
- [ ] Can delete alert
- [ ] Loading states show

### **Charts:**

- [ ] Chart renders with data
- [ ] Can change symbol
- [ ] Can change timeframe
- [ ] Indicators work

### **Billing:**

- [ ] Pricing page displays
- [ ] Can initiate checkout (Stripe)
- [ ] Billing page shows subscription
- [ ] Can cancel subscription

### **Admin (if admin user):**

- [ ] Can access admin pages
- [ ] User management works
- [ ] API usage displays

### **Affiliate:**

- [ ] Can view affiliate dashboard
- [ ] Referral code displays
- [ ] Stats show correctly

---

## Common Issues & Solutions

### **Issue 1: Import Errors**

**Problem:** `Cannot find module '@/types/...'`

**Solution:**

```typescript
// Use correct import paths
import { Alert } from '@/types/alert';
import { User } from '@/types/user';
```

### **Issue 2: API Calls Failing**

**Problem:** `fetch` returns 404

**Solution:**

```typescript
// Ensure correct API endpoint
const response = await fetch('/api/alerts', {
  // Correct
  method: 'GET',
});

// NOT: fetch('/alerts') - wrong path
```

### **Issue 3: Session Not Available**

**Problem:** `session is null` in client component

**Solution:**

```typescript
// Use useSession in client components
'use client';
import { useSession } from 'next-auth/react';

export function MyComponent() {
  const { data: session } = useSession();

  if (!session) {
    return <div>Please login</div>;
  }

  return <div>Welcome {session.user.name}</div>;
}
```

---

## Timeline Estimate

| Part                       | Pages | Components | Estimated Time |
| -------------------------- | ----- | ---------- | -------------- |
| Part 5 (Auth)              | 3     | 3          | 6-8 hours      |
| Part 8 (Dashboard)         | 3     | 3          | 4-6 hours      |
| Part 9 (Charts)            | 2     | 5          | 8-10 hours     |
| Part 10 (Watchlist)        | 1     | 2          | 2-3 hours      |
| Part 11 (Alerts)           | 3     | 3          | 6-8 hours      |
| Part 12 (Billing)          | 2     | 2          | 4-6 hours      |
| Part 13 (Settings)         | 2     | 3          | 4-6 hours      |
| Part 14 (Admin)            | 3     | 0          | 6-8 hours      |
| Part 15 (Notifications)    | 0     | 2          | 3-4 hours      |
| Part 16 (Marketing)        | 3     | 3          | 4-6 hours      |
| Part 17A (Affiliate)       | 1     | 2          | 3-4 hours      |
| Part 17B (Admin Affiliate) | 2     | 0          | 4-6 hours      |
| Part 18 (dLocal)           | 2     | 2          | 3-4 hours      |

**Total: 5-7 days** (40-56 hours)

---

## Success Criteria

✅ **Phase 3.5 Complete When:**

- All pages listed above are built
- All forms connect to real backend APIs
- Loading and error states implemented
- Responsive design working
- No TypeScript errors
- No directory structure violations
- Manual testing checklist complete
- Ready for Phase 4 E2E testing

**Critical:**

- ✅ `app/(dashboard)/` structure maintained
- ✅ `app/(marketing)/` structure maintained
- ✅ All API calls use real endpoints (not mocked)
- ✅ All components use real types from `types/*.ts`

---

## Handoff to Phase 4

Once Phase 3.5 is complete, provide:

1. **Summary of pages built**
   - List all pages created
   - Note any deviations from plan

2. **Known issues**
   - Any bugs or incomplete features
   - Areas needing attention

3. **Manual test results**
   - Checklist completion status
   - Screenshots of key pages

4. **Ready for E2E testing**
   - All user flows functional
   - Backend integration working

---

## Notes for Antigravity

- **Use seed components as REFERENCE** - adapt them, don't copy verbatim
- **Connect to REAL APIs** - no mock data allowed
- **Follow directory structure STRICTLY** - parentheses are non-negotiable
- **Test as you build** - verify each page works before moving to next
- **Ask for clarification** if API contract unclear
- **Report blockers** if backend API missing or broken

---

**Ready to begin? Start with Part 5 (Authentication) as the foundation for all other pages.**
