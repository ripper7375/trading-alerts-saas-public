# V0.dev Component Prototypes - Complete Production Mapping Guide

This folder contains **17 v0.dev-generated components** that serve as visual references and seed code for Aider to build production-ready components for Trading Alerts SaaS V7.

---

## 📁 Recommended Folder Structure

```
seed-code/v0-components/
├── README.md (this file)
├── public-pages/                      # Marketing & public-facing pages
│   ├── homepage.tsx                   # Landing page with hero, features, pricing
│   ├── homepage-package.json
│   ├── pricing-page.tsx               # Detailed pricing comparison
│   ├── pricing-package.json
│   ├── registration-page.tsx          # Sign-up form with tier selection
│   └── registration-package.json
│
├── auth/                              # Authentication pages
│   ├── login-page.tsx                 # Login form with social auth
│   ├── login-package.json
│   ├── forgot-password-page.tsx       # Password reset request
│   └── forgot-password-package.json
│
├── dashboard/                         # Main dashboard pages
│   ├── dashboard-overview.tsx         # Main dashboard with stats, charts
│   ├── dashboard-package.json
│   ├── watchlist-page.tsx             # Symbol+timeframe watchlist
│   ├── watchlist-package.json
│   ├── alert-creation-modal.tsx       # Modal for creating alerts
│   ├── alert-modal-package.json
│   ├── alerts-list.tsx                # Active alerts with filters
│   ├── alerts-package.json
│   ├── billing-page.tsx               # Subscription management
│   ├── billing-package.json
│   ├── settings-layout.tsx            # Settings sidebar layout
│   ├── settings-package.json
│   ├── profile-settings.tsx           # Profile edit form
│   └── profile-package.json
│
├── components/                        # Reusable UI components
│   ├── chart-controls.tsx             # Symbol/timeframe selectors
│   ├── chart-controls-package.json
│   ├── empty-states.tsx               # Empty states for lists
│   ├── empty-states-package.json
│   ├── notification-bell.tsx          # Notification dropdown
│   ├── notification-package.json
│   ├── user-menu.tsx                  # User avatar dropdown
│   ├── user-menu-package.json
│   ├── footer.tsx                     # App footer
│   └── footer-package.json
│
├── layouts/                           # Existing seed code (DO NOT MODIFY)
│   ├── dashboard-layout.tsx
│   ├── dashboard-page.tsx
│   ├── dashboard-package.json
│   ├── dashboard-globals.css
│   └── professional-trader-avatar.png
│
├── charts/                            # Existing seed code (DO NOT MODIFY)
│   ├── trading-chart.tsx
│   ├── trading-chart-page.tsx
│   └── trading-chart-package.json
│
└── alerts/                            # Existing seed code (DO NOT MODIFY)
    ├── alert-card.tsx
    ├── alert-card-page.tsx
    └── alert-card-package.json
```

---

## 📊 Component Inventory - 17 New Components

### Category 1: Public Pages (3 components)

| #   | Component    | V0 File                              | Production Location                | Purpose                                        |
| --- | ------------ | ------------------------------------ | ---------------------------------- | ---------------------------------------------- |
| 1   | Homepage     | `public-pages/homepage.tsx`          | `app/(marketing)/page.tsx`         | Landing page with hero, features, testimonials |
| 2   | Pricing      | `public-pages/pricing-page.tsx`      | `app/(marketing)/pricing/page.tsx` | FREE vs PRO comparison table                   |
| 3   | Registration | `public-pages/registration-page.tsx` | `app/(auth)/register/page.tsx`     | Sign-up with tier selection                    |

### Category 2: Authentication (2 components)

| #   | Component       | V0 File                         | Production Location                   | Purpose                      |
| --- | --------------- | ------------------------------- | ------------------------------------- | ---------------------------- |
| 4   | Login           | `auth/login-page.tsx`           | `app/(auth)/login/page.tsx`           | Email/password + OAuth login |
| 5   | Forgot Password | `auth/forgot-password-page.tsx` | `app/(auth)/forgot-password/page.tsx` | Password reset request       |

### Category 3: Dashboard Pages (8 components)

| #   | Component          | V0 File                              | Production Location                         | Purpose                             |
| --- | ------------------ | ------------------------------------ | ------------------------------------------- | ----------------------------------- |
| 6   | Dashboard Overview | `dashboard/dashboard-overview.tsx`   | `app/(dashboard)/dashboard/page.tsx`        | Stats, recent alerts, quick actions |
| 7   | Watchlist          | `dashboard/watchlist-page.tsx`       | `app/(dashboard)/watchlist/page.tsx`        | Symbol+timeframe management         |
| 8   | Alert Modal        | `dashboard/alert-creation-modal.tsx` | `components/alerts/alert-modal.tsx`         | Create/edit alert dialog            |
| 9   | Alerts List        | `dashboard/alerts-list.tsx`          | `app/(dashboard)/alerts/page.tsx`           | Active alerts with filters          |
| 10  | Billing            | `dashboard/billing-page.tsx`         | `app/(dashboard)/settings/billing/page.tsx` | Subscription upgrade/cancel         |
| 11  | Settings Layout    | `dashboard/settings-layout.tsx`      | `app/(dashboard)/settings/layout.tsx`       | Settings navigation sidebar         |
| 12  | Profile Settings   | `dashboard/profile-settings.tsx`     | `app/(dashboard)/settings/profile/page.tsx` | Profile edit form                   |

### Category 4: Reusable Components (4 components)

| #   | Component         | V0 File                            | Production Location                       | Purpose                    |
| --- | ----------------- | ---------------------------------- | ----------------------------------------- | -------------------------- |
| 13  | Chart Controls    | `components/chart-controls.tsx`    | `components/charts/chart-controls.tsx`    | Symbol/timeframe selectors |
| 14  | Empty States      | `components/empty-states.tsx`      | `components/ui/empty-state.tsx`           | No data placeholders       |
| 15  | Notification Bell | `components/notification-bell.tsx` | `components/layout/notification-bell.tsx` | Notification dropdown      |
| 16  | User Menu         | `components/user-menu.tsx`         | `components/layout/user-menu.tsx`         | User avatar + dropdown     |
| 17  | Footer            | `components/footer.tsx`            | `components/layout/footer.tsx`            | App footer with links      |

---

## 🎯 How Aider Uses These Components

### Pattern 1: Direct Page Adaptation (Public Pages, Auth, Dashboard)

**Example: Homepage**

```typescript
// V0 File: seed-code/v0-components/public-pages/homepage.tsx
// Has: Mock data, static content, hardcoded values

// Aider adapts to: app/(marketing)/page.tsx
// Adds: Next.js 15 metadata, real API calls, dynamic content
```

**Aider Prompt:**

```
Build app/(marketing)/page.tsx following seed-code/v0-components/public-pages/homepage.tsx.
Replace mock pricing with data from lib/config/plans.ts.
Add TypeScript types for all props.
Ensure responsive design matches seed component.
```

### Pattern 2: Component Extraction (Reusable Components)

**Example: Chart Controls**

```typescript
// V0 File: seed-code/v0-components/components/chart-controls.tsx
// Has: Symbol selector, timeframe selector, tier badge

// Aider adapts to: components/charts/chart-controls.tsx
// Adds: Tier validation, API integration, real-time updates
```

**Aider Prompt:**

```
Create components/charts/chart-controls.tsx from seed-code/v0-components/components/chart-controls.tsx.
Add tier validation using lib/tier/validator.ts.
Filter symbols based on user tier (FREE: 5 symbols, PRO: 15 symbols).
Connect timeframe selector to chart state.
```

### Pattern 3: Modal/Dialog Components

**Example: Alert Creation Modal**

```typescript
// V0 File: seed-code/v0-components/dashboard/alert-creation-modal.tsx
// Has: Form UI, validation, submit button

// Aider adapts to: components/alerts/alert-modal.tsx
// Adds: React Hook Form, Zod validation, API POST to /api/alerts
```

**Aider Prompt:**

```
Build components/alerts/alert-modal.tsx from seed-code/v0-components/dashboard/alert-creation-modal.tsx.
Use React Hook Form + Zod for validation.
Add tier checks before allowing alert creation.
POST to /api/alerts on submit.
Show success/error toasts.
```

---

## 🔄 Complete Workflow

### Step 1: V0.dev Generation

```bash
# You generate each component in v0.dev using the 17 prompts
# Download and save to seed-code/v0-components/{category}/{component-name}.tsx
```

### Step 2: Organization

```bash
# Organize files into categories:
seed-code/v0-components/
├── public-pages/
├── auth/
├── dashboard/
└── components/
```

### Step 3: Aider Reads & Adapts

```bash
# Aider automatically reads seed-code files (configured in .aider.conf.yml)
# Uses them as visual/structural reference
# Builds production files with:
#   - Real API integration
#   - Tier validation
#   - TypeScript types
#   - Error handling
#   - Loading states
```

### Step 4: Claude Code Validates

```bash
# Claude Code checks production files against:
#   - Quality standards (docs/policies/02-quality-standards.md)
#   - Architecture rules (docs/policies/03-architecture-rules.md)
#   - Coding patterns (docs/policies/05-coding-patterns.md)
```

### Step 5: You Test

```bash
npm run dev
# Test actual functionality in browser
```

---

## 📦 Dependencies from V0 Components

Based on package.json files in seed components, these dependencies are required:

### Core Dependencies (Already in package.json ✅)

- `next@^15.0.0`
- `react@^19.0.0`
- `react-dom@^19.0.0`

### UI Components (Already in package.json ✅)

- `@radix-ui/react-*` (14 components)
- `lucide-react@^0.303.0`
- `tailwind-merge@^2.2.0`
- `clsx@^2.1.0`

### Charts (Already in package.json ✅)

- `lightweight-charts@^4.1.1`

### Forms (Already in package.json ✅)

- `react-hook-form@^7.49.0`
- `zod@^3.22.4`
- `@hookform/resolvers@^3.3.3`

### Dates (Already in package.json ✅)

- `date-fns@^3.0.6`

**✅ All dependencies are already configured in root package.json!**

---

## 🔗 Integration Points

### API Endpoints Required

- `POST /api/alerts` - Create alert (alert-creation-modal.tsx)
- `GET /api/alerts` - List alerts (alerts-list.tsx)
- `GET /api/watchlist` - Get watchlist (watchlist-page.tsx)
- `POST /api/watchlist` - Add to watchlist (watchlist-page.tsx)
- `GET /api/tier/symbols` - Get allowed symbols (chart-controls.tsx)
- `GET /api/tier/check/{symbol}` - Check symbol access (chart-controls.tsx)
- `POST /api/checkout` - Upgrade to PRO (pricing-page.tsx, billing-page.tsx)
- `POST /api/subscription/cancel` - Cancel subscription (billing-page.tsx)

### Tier Validation Integration

```typescript
// All components must validate tier access:
import { validateTierAccess } from '@/lib/tier/validator';

const accessCheck = validateTierAccess(symbol, timeframe, user.tier);
if (!accessCheck.allowed) {
  // Show upgrade prompt
}
```

### NextAuth Session Integration

```typescript
// All dashboard pages need session:
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';

const session = await getServerSession(authOptions);
if (!session) redirect('/login');
```

---

## ⚠️ Important Guidelines

### DO ✅

- Use seed components as **visual reference**
- Extract layout patterns and component structure
- Adapt UI design to match Trading Alerts brand
- Add tier validation to all restricted features
- Connect to real APIs (not mock data)
- Add TypeScript types from OpenAPI specs
- Include error handling and loading states
- Test on mobile + desktop

### DON'T ❌

- Copy seed files directly to production without changes
- Keep mock data in production files
- Skip tier validation
- Forget authentication checks
- Ignore responsive design
- Use `any` types
- Skip error handling

---

## 📈 Expected Build Order

### Phase 1: Foundation (Existing)

- ✅ layouts/dashboard-layout.tsx
- ✅ charts/trading-chart.tsx
- ✅ alerts/alert-card.tsx

### Phase 2: Public Pages (Week 1)

1. public-pages/homepage.tsx → app/(marketing)/page.tsx
2. public-pages/pricing-page.tsx → app/(marketing)/pricing/page.tsx
3. public-pages/registration-page.tsx → app/(auth)/register/page.tsx

### Phase 3: Auth Pages (Week 1)

4. auth/login-page.tsx → app/(auth)/login/page.tsx
5. auth/forgot-password-page.tsx → app/(auth)/forgot-password/page.tsx

### Phase 4: Core Dashboard (Week 2)

6. dashboard/dashboard-overview.tsx → app/(dashboard)/dashboard/page.tsx
7. dashboard/watchlist-page.tsx → app/(dashboard)/watchlist/page.tsx
8. dashboard/alerts-list.tsx → app/(dashboard)/alerts/page.tsx

### Phase 5: Components (Week 2)

13. components/chart-controls.tsx → components/charts/chart-controls.tsx
14. components/empty-states.tsx → components/ui/empty-state.tsx
15. components/notification-bell.tsx → components/layout/notification-bell.tsx
16. components/user-menu.tsx → components/layout/user-menu.tsx
17. components/footer.tsx → components/layout/footer.tsx

### Phase 6: Settings & Billing (Week 3)

10. dashboard/billing-page.tsx → app/(dashboard)/settings/billing/page.tsx
11. dashboard/settings-layout.tsx → app/(dashboard)/settings/layout.tsx
12. dashboard/profile-settings.tsx → app/(dashboard)/settings/profile/page.tsx
13. dashboard/alert-creation-modal.tsx → components/alerts/alert-modal.tsx

---

## 🎓 For Aider: Adaptation Checklist

When adapting a seed component to production, ensure:

- [ ] Replace mock data with API calls
- [ ] Add TypeScript types (import from `@/lib/api-client`)
- [ ] Add tier validation where applicable
- [ ] Add authentication checks (session validation)
- [ ] Implement error handling (try-catch, error states)
- [ ] Add loading states (Skeleton, Spinner)
- [ ] Make responsive (mobile-first design)
- [ ] Add accessibility (ARIA labels, keyboard navigation)
- [ ] Follow coding patterns (docs/policies/05-coding-patterns.md)
- [ ] Use proper HTTP status codes
- [ ] Add user-friendly error messages
- [ ] Include success/error toasts
- [ ] Test with real data
- [ ] Validate with Claude Code

---

## 📚 Related Documentation

- **UI Components Map:** `docs/ui-components-map.md` - Complete production mapping
- **V5 Structure Division:** `docs/v5-structure-division.md` - Overall architecture
- **Coding Patterns:** `docs/policies/05-coding-patterns.md` - Code standards
- **Quality Standards:** `docs/policies/02-quality-standards.md` - Quality requirements
- **Aider Instructions:** `docs/policies/06-aider-instructions.md` - Aider workflow

---

## 🏁 Quick Start

**1. Generate all 17 components in v0.dev**
**2. Save to appropriate folders (public-pages/, auth/, dashboard/, components/)**
**3. Let Aider read and adapt automatically**
**4. Claude Code validates**
**5. Test in browser**

**Total Components: 17 new + 3 existing = 20 seed components**

---

**Last Updated:** 2025-11-14
**Version:** 2.0.0 (Complete 17-component structure)
**Status:** Ready for v0.dev component integration
