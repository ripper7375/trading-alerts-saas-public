# UI Components Map - V0.dev to Production

Complete mapping guide for all 17 v0.dev generated components to their production file locations in Trading Alerts SaaS V7.

---

## 📊 Overview

**Total Components:** 17 new components + 3 existing seed components = **20 total**

**V0.dev Source:** `seed-code/v0-components/`
**Production Target:** `app/` and `components/`
**Build Tool:** Aider (builder) + Claude Code (validator)

---

## 📁 Complete Component Mapping

### Category 1: Public Pages (Marketing) - 3 Components

#### 1. Homepage / Landing Page

- **V0 Source:** `seed-code/v0-components/public-pages/homepage.tsx`
- **Production:** `app/(marketing)/page.tsx`
- **Route:** `/` (public)
- **Purpose:** Landing page with hero section, features, testimonials, pricing preview
- **Key Features:**
  - Hero with CTA buttons
  - Features grid (fractal detection, real-time alerts, tier comparison)
  - Testimonials carousel
  - Pricing preview with "Start Free" CTA
  - Mobile-responsive navigation
- **Aider Tasks:**
  - Replace static content with dynamic data from `lib/config/marketing.ts`
  - Add Next.js 15 metadata for SEO
  - Integrate pricing data from `lib/config/plans.ts`
  - Add Google Analytics tracking
  - Ensure mobile-first responsive design

---

#### 2. Pricing Page

- **V0 Source:** `seed-code/v0-components/public-pages/pricing-page.tsx`
- **Production:** `app/(marketing)/pricing/page.tsx`
- **Route:** `/pricing` (public)
- **Purpose:** Detailed FREE vs PRO tier comparison
- **Key Features:**
  - Side-by-side tier comparison table
  - Feature checkmarks (5 symbols vs 15 symbols, 3 timeframes vs 9 timeframes)
  - "Upgrade to PRO" CTA button
  - FAQ section
  - Annual/monthly toggle (for future)
- **Aider Tasks:**
  - Load tier features from `lib/config/plans.ts`
  - Add Stripe checkout integration for PRO upgrade
  - Add tier restriction tooltips
  - Connect "Get Started" to `/register?tier=PRO`
  - Add comparison calculator (potential savings)

---

#### 3. Registration Page

- **V0 Source:** `seed-code/v0-components/public-pages/registration-page.tsx`
- **Production:** `app/(auth)/register/page.tsx`
- **Route:** `/register` (public)
- **Purpose:** User sign-up with tier selection
- **Key Features:**
  - Email + password form
  - Name field
  - Tier selection (FREE default, PRO option with price)
  - Terms & Privacy checkboxes
  - Social OAuth buttons (Google, GitHub)
  - "Already have account?" link to `/login`
- **Aider Tasks:**
  - Add React Hook Form + Zod validation
  - POST to `/api/auth/register`
  - Add password strength indicator
  - Pre-select tier from query param `?tier=PRO`
  - Handle OAuth callbacks via NextAuth
  - Redirect to `/dashboard` on success

---

### Category 2: Authentication - 2 Components

#### 4. Login Page

- **V0 Source:** `seed-code/v0-components/auth/login-page.tsx`
- **Production:** `app/(auth)/login/page.tsx`
- **Route:** `/login` (public)
- **Purpose:** User authentication
- **Key Features:**
  - Email + password fields
  - "Remember me" checkbox
  - "Forgot password?" link
  - Social OAuth (Google, GitHub)
  - "Create account" link to `/register`
- **Aider Tasks:**
  - Integrate NextAuth.js `signIn()` function
  - Add credential validation
  - Handle redirect after login (callbackUrl)
  - Show error toast on failed login
  - Add loading state during authentication

---

#### 5. Forgot Password Page

- **V0 Source:** `seed-code/v0-components/auth/forgot-password-page.tsx`
- **Production:** `app/(auth)/forgot-password/page.tsx`
- **Route:** `/forgot-password` (public)
- **Purpose:** Password reset request
- **Key Features:**
  - Email input field
  - "Send Reset Link" button
  - Success message with instructions
  - Back to login link
- **Aider Tasks:**
  - POST to `/api/auth/forgot-password`
  - Generate password reset token
  - Send email via NodeMailer
  - Show success message
  - Add rate limiting (max 3 requests/hour)

---

### Category 3: Dashboard Pages - 8 Components

#### 6. Dashboard Overview

- **V0 Source:** `seed-code/v0-components/dashboard/dashboard-overview.tsx`
- **Production:** `app/(dashboard)/dashboard/page.tsx`
- **Route:** `/dashboard` (authenticated)
- **Purpose:** Main dashboard home with stats and quick actions
- **Key Features:**
  - Stats cards (active alerts, watchlist items, tier status)
  - Recent alerts list (last 5)
  - Quick action buttons (Create Alert, Add to Watchlist)
  - Account tier badge with upgrade CTA (if FREE)
  - Recent activity timeline
- **Aider Tasks:**
  - Fetch stats from `/api/dashboard/stats`
  - Fetch recent alerts from `/api/alerts?limit=5`
  - Add tier-specific messaging
  - Show upgrade banner for FREE users
  - Add real-time updates via WebSocket

---

#### 7. Watchlist Page

- **V0 Source:** `seed-code/v0-components/dashboard/watchlist-page.tsx`
- **Production:** `app/(dashboard)/watchlist/page.tsx`
- **Route:** `/watchlist` (authenticated)
- **Purpose:** Manage symbol+timeframe combinations
- **Key Features:**
  - Watchlist items grid (symbol, timeframe, current price, change %)
  - Add new symbol+timeframe button
  - Remove item button
  - Drag-and-drop reordering
  - Tier-based symbol filtering (FREE: 5, PRO: 15)
- **Aider Tasks:**
  - GET `/api/watchlist` to load items
  - POST `/api/watchlist` to add new item
  - DELETE `/api/watchlist/{id}` to remove item
  - PATCH `/api/watchlist/reorder` for drag-drop
  - Add tier validation before allowing new item
  - Show upgrade prompt if limit reached

---

#### 8. Alert Creation Modal

- **V0 Source:** `seed-code/v0-components/dashboard/alert-creation-modal.tsx`
- **Production:** `components/alerts/alert-modal.tsx`
- **Route:** N/A (modal component)
- **Purpose:** Create/edit price alerts
- **Key Features:**
  - Symbol selector (tier-filtered)
  - Timeframe selector (tier-filtered)
  - Alert type (price above/below, fractal breakout)
  - Target price input
  - Notification method (email, push)
  - Save button
- **Aider Tasks:**
  - Use React Hook Form + Zod validation
  - Validate symbol+timeframe tier access
  - POST to `/api/alerts`
  - Show success toast on creation
  - Close modal and refresh alerts list
  - Add "Upgrade to PRO" if tier limit reached

---

#### 9. Alerts List Page

- **V0 Source:** `seed-code/v0-components/dashboard/alerts-list.tsx`
- **Production:** `app/(dashboard)/alerts/page.tsx`
- **Route:** `/alerts` (authenticated)
- **Purpose:** View and manage all active alerts
- **Key Features:**
  - Alerts table (symbol, timeframe, type, target, status)
  - Filter by status (active, triggered, expired)
  - Filter by symbol
  - Edit alert button (opens modal)
  - Delete alert button
  - Create new alert button
  - Pagination
- **Aider Tasks:**
  - GET `/api/alerts` with filters
  - Add search and filter controls
  - DELETE `/api/alerts/{id}` for removal
  - Open alert-modal for editing
  - Add empty state if no alerts
  - Show tier usage (e.g., "3/5 alerts used" for FREE)

---

#### 10. Billing / Subscription Page

- **V0 Source:** `seed-code/v0-components/dashboard/billing-page.tsx`
- **Production:** `app/(dashboard)/settings/billing/page.tsx`
- **Route:** `/settings/billing` (authenticated)
- **Purpose:** Manage subscription and payments
- **Key Features:**
  - Current tier badge (FREE or PRO)
  - Subscription details (next billing date, amount)
  - Upgrade to PRO button (if FREE)
  - Cancel subscription button (if PRO)
  - Payment method (Stripe card)
  - Invoice history table
  - Download invoice links
- **Aider Tasks:**
  - GET `/api/subscription` for current status
  - POST `/api/checkout` for upgrade (Stripe Checkout)
  - POST `/api/subscription/cancel` for downgrade
  - GET `/api/invoices` for billing history
  - Handle Stripe webhook events
  - Show "Downgrade effective date" after cancellation

---

#### 11. Settings Layout

- **V0 Source:** `seed-code/v0-components/dashboard/settings-layout.tsx`
- **Production:** `app/(dashboard)/settings/layout.tsx`
- **Route:** `/settings/*` (authenticated)
- **Purpose:** Settings pages navigation sidebar
- **Key Features:**
  - Sidebar navigation (Profile, Account, Billing, Privacy, Language, Help)
  - Active link highlighting
  - Mobile-responsive drawer
  - Breadcrumbs
- **Aider Tasks:**
  - Create layout wrapper for all settings pages
  - Add navigation links
  - Highlight active route
  - Add mobile hamburger menu
  - Ensure nested pages render in main content area

---

#### 12. Profile Settings Page

- **V0 Source:** `seed-code/v0-components/dashboard/profile-settings.tsx`
- **Production:** `app/(dashboard)/settings/profile/page.tsx`
- **Route:** `/settings/profile` (authenticated)
- **Purpose:** Edit user profile information
- **Key Features:**
  - Name input field
  - Email (read-only, verified badge)
  - Avatar upload (with crop tool)
  - Bio textarea
  - Timezone selector
  - Save changes button
- **Aider Tasks:**
  - GET `/api/user/profile` to load current data
  - PATCH `/api/user/profile` to update
  - Add avatar upload to cloud storage (AWS S3 or Cloudinary)
  - Use react-image-crop for avatar cropping
  - Show success toast on save
  - Add form validation

---

### Category 4: Reusable Components - 4 Components

#### 13. Chart Controls Component

- **V0 Source:** `seed-code/v0-components/components/chart-controls.tsx`
- **Production:** `components/charts/chart-controls.tsx`
- **Route:** N/A (component)
- **Purpose:** Symbol and timeframe selectors for charts
- **Key Features:**
  - Symbol dropdown (tier-filtered: FREE=5, PRO=15)
  - Timeframe tabs (tier-filtered: FREE=3, PRO=9)
  - Tier badge indicator
  - Upgrade tooltip (if restricted)
- **Aider Tasks:**
  - Load allowed symbols from `/api/tier/symbols`
  - Filter timeframes based on user tier
  - Emit events on symbol/timeframe change
  - Show lock icon on restricted options
  - Add tooltip "Upgrade to PRO to access this symbol"

---

#### 14. Empty States Component

- **V0 Source:** `seed-code/v0-components/components/empty-states.tsx`
- **Production:** `components/ui/empty-state.tsx`
- **Route:** N/A (component)
- **Purpose:** Placeholder when lists are empty
- **Key Features:**
  - Icon (customizable)
  - Heading text
  - Description text
  - CTA button (optional)
  - Variants: No alerts, No watchlist items, No notifications
- **Aider Tasks:**
  - Create reusable empty state component
  - Accept props: icon, heading, description, actionLabel, onAction
  - Add variants for common cases
  - Ensure responsive design
  - Add to components/ui/ folder

---

#### 15. Notification Bell Component

- **V0 Source:** `seed-code/v0-components/components/notification-bell.tsx`
- **Production:** `components/layout/notification-bell.tsx`
- **Route:** N/A (component in header)
- **Purpose:** Header notification dropdown
- **Key Features:**
  - Bell icon with unread badge count
  - Dropdown with recent notifications (last 10)
  - Mark as read button
  - View all link to `/notifications`
  - Real-time updates via WebSocket
- **Aider Tasks:**
  - GET `/api/notifications?unread=true` to load
  - PATCH `/api/notifications/{id}/read` to mark read
  - Add WebSocket listener for new notifications
  - Show toast for new notification
  - Add sound effect (optional)

---

#### 16. User Menu Component

- **V0 Source:** `seed-code/v0-components/components/user-menu.tsx`
- **Production:** `components/layout/user-menu.tsx`
- **Route:** N/A (component in header)
- **Purpose:** User avatar dropdown menu
- **Key Features:**
  - User avatar image
  - User name + tier badge
  - Dropdown menu:
    - Dashboard link
    - Settings link
    - Billing link
    - Help & Support link
    - Sign out button
- **Aider Tasks:**
  - Load user data from NextAuth session
  - Add sign out via `signOut()` function
  - Show tier badge (FREE or PRO)
  - Add avatar fallback (user initials)
  - Add links to key pages

---

#### 17. Footer Component

- **V0 Source:** `seed-code/v0-components/components/footer.tsx`
- **Production:** `components/layout/footer.tsx`
- **Route:** N/A (component in layouts)
- **Purpose:** Application footer with links
- **Key Features:**
  - Company links (About, Blog, Careers)
  - Product links (Features, Pricing, API Docs)
  - Legal links (Privacy, Terms, Cookies)
  - Social media icons
  - Copyright notice
- **Aider Tasks:**
  - Create responsive footer
  - Add links to static pages
  - Add social media icons (Twitter, LinkedIn)
  - Show different footer for marketing vs dashboard layouts
  - Add newsletter signup form (optional)

---

## 🎯 Production File Organization Summary

```
app/
├── (marketing)/                       # Public marketing pages
│   ├── page.tsx                       # 1. Homepage ✅
│   └── pricing/
│       └── page.tsx                   # 2. Pricing ✅
│
├── (auth)/                            # Authentication pages
│   ├── login/
│   │   └── page.tsx                   # 4. Login ✅
│   ├── register/
│   │   └── page.tsx                   # 3. Registration ✅
│   └── forgot-password/
│       └── page.tsx                   # 5. Forgot Password ✅
│
└── (dashboard)/                       # Authenticated dashboard
    ├── dashboard/
    │   └── page.tsx                   # 6. Dashboard Overview ✅
    ├── watchlist/
    │   └── page.tsx                   # 7. Watchlist ✅
    ├── alerts/
    │   └── page.tsx                   # 9. Alerts List ✅
    └── settings/
        ├── layout.tsx                 # 11. Settings Layout ✅
        ├── profile/
        │   └── page.tsx               # 12. Profile Settings ✅
        └── billing/
            └── page.tsx               # 10. Billing ✅

components/
├── alerts/
│   └── alert-modal.tsx                # 8. Alert Creation Modal ✅
├── charts/
│   └── chart-controls.tsx             # 13. Chart Controls ✅
├── ui/
│   └── empty-state.tsx                # 14. Empty States ✅
└── layout/
    ├── notification-bell.tsx          # 15. Notification Bell ✅
    ├── user-menu.tsx                  # 16. User Menu ✅
    └── footer.tsx                     # 17. Footer ✅
```

---

## 🔄 Aider Integration Workflow

### For Each Component:

1. **Aider Reads V0 Seed File**

   ```
   Load: seed-code/v0-components/{category}/{component-name}.tsx
   Understand: UI structure, components used, layout patterns
   ```

2. **Aider Adapts to Production**

   ```
   Create: Production file at mapped location
   Add: Real API calls, tier validation, authentication
   Replace: Mock data with actual database queries
   Apply: TypeScript types from OpenAPI specs
   ```

3. **Claude Code Validates**

   ```
   Check: Type safety, error handling, tier validation
   Verify: Follows coding patterns (docs/policies/05-coding-patterns.md)
   Ensure: Quality standards met (docs/policies/02-quality-standards.md)
   ```

4. **Auto-Commit or Escalate**
   ```
   If approved: Auto-commit to git
   If issues: Fix and re-validate
   If unclear: Escalate to human for decision
   ```

---

## 📋 Integration Checklist (Per Component)

When Aider adapts a component, verify:

- [ ] TypeScript types defined (no `any`)
- [ ] API integration complete (replace mock data)
- [ ] Tier validation added (where applicable)
- [ ] Authentication check (session required for dashboard pages)
- [ ] Error handling (try-catch blocks, error states)
- [ ] Loading states (Skeleton, Spinner)
- [ ] Responsive design (mobile, tablet, desktop)
- [ ] Accessibility (ARIA labels, keyboard navigation)
- [ ] Form validation (Zod schemas for forms)
- [ ] Success/error toasts
- [ ] Empty states (when no data)
- [ ] Proper HTTP status codes in API responses
- [ ] Follows Next.js 15 App Router conventions
- [ ] Uses server components where possible
- [ ] Client components marked with 'use client'

---

## 🔗 API Endpoints Required

Based on all 17 components, these API routes must exist:

| Endpoint                       | Method | Used By                                | Purpose                   |
| ------------------------------ | ------ | -------------------------------------- | ------------------------- |
| `/api/auth/register`           | POST   | Registration (#3)                      | Create new user account   |
| `/api/auth/forgot-password`    | POST   | Forgot Password (#5)                   | Send password reset email |
| `/api/dashboard/stats`         | GET    | Dashboard Overview (#6)                | Get user stats            |
| `/api/watchlist`               | GET    | Watchlist (#7)                         | List watchlist items      |
| `/api/watchlist`               | POST   | Watchlist (#7)                         | Add watchlist item        |
| `/api/watchlist/{id}`          | DELETE | Watchlist (#7)                         | Remove watchlist item     |
| `/api/watchlist/reorder`       | PATCH  | Watchlist (#7)                         | Reorder items             |
| `/api/alerts`                  | GET    | Alerts List (#9), Dashboard (#6)       | List all alerts           |
| `/api/alerts`                  | POST   | Alert Modal (#8)                       | Create alert              |
| `/api/alerts/{id}`             | PATCH  | Alert Modal (#8)                       | Update alert              |
| `/api/alerts/{id}`             | DELETE | Alerts List (#9)                       | Delete alert              |
| `/api/tier/symbols`            | GET    | Chart Controls (#13), Alert Modal (#8) | Get allowed symbols       |
| `/api/tier/check/{symbol}`     | GET    | Chart Controls (#13)                   | Check symbol access       |
| `/api/subscription`            | GET    | Billing (#10)                          | Get subscription status   |
| `/api/checkout`                | POST   | Pricing (#2), Billing (#10)            | Start Stripe checkout     |
| `/api/subscription/cancel`     | POST   | Billing (#10)                          | Cancel subscription       |
| `/api/invoices`                | GET    | Billing (#10)                          | Get invoice history       |
| `/api/user/profile`            | GET    | Profile Settings (#12)                 | Get user profile          |
| `/api/user/profile`            | PATCH  | Profile Settings (#12)                 | Update profile            |
| `/api/notifications`           | GET    | Notification Bell (#15)                | List notifications        |
| `/api/notifications/{id}/read` | PATCH  | Notification Bell (#15)                | Mark as read              |

---

## 📦 Dependencies Verification

All required dependencies for v0.dev components are already in `package.json`:

✅ **Core:** next@^15.0.0, react@^19.0.0, react-dom@^19.0.0
✅ **Auth:** next-auth@^4.24.5
✅ **Database:** @prisma/client@^5.7.0
✅ **Forms:** react-hook-form@^7.49.0, zod@^3.22.4, @hookform/resolvers@^3.3.3
✅ **UI:** @radix-ui/react-\* (14 components), lucide-react@^0.303.0
✅ **Charts:** lightweight-charts@^4.1.1
✅ **Payment:** stripe@^14.10.0, @stripe/stripe-js@^2.4.0
✅ **Utils:** date-fns@^3.0.6, clsx@^2.1.0, tailwind-merge@^2.2.0
✅ **Image:** react-image-crop@^10.1.5

**No additional dependencies needed!** ✅

---

## 🎓 Best Practices for Component Adaptation

### 1. Server Components First (Next.js 15)

```typescript
// Default to server components for pages
export default async function DashboardPage() {
  const session = await getServerSession();
  // ...
}
```

### 2. Client Components Only When Needed

```typescript
// Mark as client only if using hooks, events, or browser APIs
'use client';

export function AlertModal() {
  const [open, setOpen] = useState(false);
  // ...
}
```

### 3. Tier Validation Pattern

```typescript
import { validateTierAccess } from '@/lib/tier/validator'

const accessCheck = validateTierAccess(symbol, timeframe, user.tier)
if (!accessCheck.allowed) {
  return <UpgradePrompt reason={accessCheck.reason} />
}
```

### 4. Error Handling Pattern

```typescript
try {
  const response = await fetch('/api/alerts', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to create alert');
  toast.success('Alert created successfully!');
} catch (error) {
  console.error('Alert creation failed:', error);
  toast.error('Failed to create alert. Please try again.');
}
```

### 5. Loading States Pattern

```typescript
const [isLoading, setIsLoading] = useState(false)

if (isLoading) return <Skeleton />

return <ActualContent />
```

---

## 📊 Progress Tracking

| #   | Component          | V0 Generated | Organized | Production Built | Validated | Status  |
| --- | ------------------ | ------------ | --------- | ---------------- | --------- | ------- |
| 1   | Homepage           | ⬜           | ⬜        | ⬜               | ⬜        | Pending |
| 2   | Pricing            | ⬜           | ⬜        | ⬜               | ⬜        | Pending |
| 3   | Registration       | ⬜           | ⬜        | ⬜               | ⬜        | Pending |
| 4   | Login              | ⬜           | ⬜        | ⬜               | ⬜        | Pending |
| 5   | Forgot Password    | ⬜           | ⬜        | ⬜               | ⬜        | Pending |
| 6   | Dashboard Overview | ⬜           | ⬜        | ⬜               | ⬜        | Pending |
| 7   | Watchlist          | ⬜           | ⬜        | ⬜               | ⬜        | Pending |
| 8   | Alert Modal        | ⬜           | ⬜        | ⬜               | ⬜        | Pending |
| 9   | Alerts List        | ⬜           | ⬜        | ⬜               | ⬜        | Pending |
| 10  | Billing            | ⬜           | ⬜        | ⬜               | ⬜        | Pending |
| 11  | Settings Layout    | ⬜           | ⬜        | ⬜               | ⬜        | Pending |
| 12  | Profile Settings   | ⬜           | ⬜        | ⬜               | ⬜        | Pending |
| 13  | Chart Controls     | ⬜           | ⬜        | ⬜               | ⬜        | Pending |
| 14  | Empty States       | ⬜           | ⬜        | ⬜               | ⬜        | Pending |
| 15  | Notification Bell  | ⬜           | ⬜        | ⬜               | ⬜        | Pending |
| 16  | User Menu          | ⬜           | ⬜        | ⬜               | ⬜        | Pending |
| 17  | Footer             | ⬜           | ⬜        | ⬜               | ⬜        | Pending |

**Legend:**
⬜ Not started
🟡 In progress
✅ Complete

---

## 🏁 Quick Reference

**Total Seed Components:** 20 (17 new + 3 existing)
**Production Pages:** 11
**Production Components:** 9
**API Endpoints Required:** 21
**Dependencies:** All installed ✅
**Documentation:** Complete ✅

**Next Steps:**

1. Generate all 17 components in v0.dev
2. Save to `seed-code/v0-components/{category}/` folders
3. Run Aider in autonomous mode
4. Aider adapts each component with Claude Code validation
5. Test in browser
6. Deploy to production

---

**Last Updated:** 2025-11-14
**Version:** 1.0.0
**Status:** Documentation complete, ready for v0.dev generation
