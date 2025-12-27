# Antigravity AI Agent - Localhost UI Testing Prompt

**Project:** Trading Alerts SaaS V7
**Date:** 2025-12-27
**Test Scope:** Frontend UI Testing for Parts 5, 8-19

---

## CRITICAL CONSTRAINTS

**READ-ONLY MODE - DO NOT MODIFY CODE**

You are authorized to perform TESTING ONLY. You must:
- ✅ Run the application and test UI functionality
- ✅ Navigate through all pages and test user interactions
- ✅ Document bugs, issues, and observations
- ✅ Take screenshots of any issues found
- ✅ Report test results with pass/fail status
- ❌ **DO NOT** modify any files in the codebase
- ❌ **DO NOT** add or delete any code
- ❌ **DO NOT** commit any changes to git
- ❌ **DO NOT** create new files (except test reports in a designated folder)

---

## Project Overview

Trading Alerts SaaS is a Next.js 15 application with:
- **Frontend:** React 19, TailwindCSS, shadcn/ui components
- **Backend:** Next.js API Routes, Prisma ORM
- **Database:** PostgreSQL
- **Authentication:** NextAuth.js with Google OAuth + Credentials
- **Payments:** Stripe + dLocal (emerging markets)
- **Charts:** TradingView Lightweight Charts

---

## Prerequisites Setup (Before Testing)

### Step 1: Environment Setup

1. Ensure PostgreSQL database is running
2. Copy `.env.example` to `.env.local` and configure:
   ```bash
   cp .env.example .env.local
   ```

3. Required environment variables:
   ```
   DATABASE_URL=postgresql://username:password@localhost:5432/trading_alerts
   NEXTAUTH_SECRET=<generate with: openssl rand -base64 32>
   NEXTAUTH_URL=http://localhost:3000
   ```

4. Optional (for full feature testing):
   ```
   GOOGLE_CLIENT_ID=<for Google OAuth testing>
   GOOGLE_CLIENT_SECRET=<for Google OAuth testing>
   STRIPE_SECRET_KEY=<for payment testing>
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=<for payment testing>
   RESEND_API_KEY=<for email testing>
   ```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Database Setup

```bash
# Generate Prisma client
npm run db:generate

# Push schema to database (creates tables)
npm run db:push

# Seed initial data (creates admin users)
npm run db:seed
```

### Step 4: Start Development Server

```bash
npm run dev
```

Application should be accessible at: `http://localhost:3000`

---

## Test Accounts

After running `npm run db:seed`, these accounts are available:

| Account Type | Email | Password | Role | Notes |
|--------------|-------|----------|------|-------|
| Admin (Pure) | admin@tradingalerts.com | Admin123!@# | ADMIN | Admin dashboard access |
| Admin + Affiliate | admin-affiliate@tradingalerts.com | AdminAffiliate123!@# | ADMIN + Affiliate | Both admin and affiliate access |
| Test User | Create via /register | Your choice | USER | Regular user account |

---

## Parts to Test

### Part 5: Authentication System (20 files)

**Routes to Test:**
| Route | Expected Behavior |
|-------|------------------|
| `/login` | Login form with email/password + Google OAuth |
| `/register` | Registration form with password strength, affiliate code support |
| `/forgot-password` | 4-step password reset flow |
| `/reset-password?token=xxx` | Password reset with token validation |
| `/verify-email?token=xxx` | Email verification page |
| `/admin/login` | Admin-only login (credentials only, no OAuth) |

**Test Scenarios:**

1. **Login Flow**
   - [ ] Navigate to /login
   - [ ] Verify form renders with email, password fields
   - [ ] Verify "Sign in with Google" button is present
   - [ ] Test form validation (empty fields, invalid email)
   - [ ] Test invalid credentials error message
   - [ ] Test successful login redirects to /dashboard
   - [ ] Test "Forgot Password?" link works
   - [ ] Test "Create account" link works

2. **Registration Flow**
   - [ ] Navigate to /register
   - [ ] Verify all form fields render
   - [ ] Test password strength indicator (weak/medium/strong)
   - [ ] Test password confirmation validation
   - [ ] Test terms checkbox is required
   - [ ] Test affiliate code input (optional)
   - [ ] Test successful registration shows verification notice
   - [ ] Test "Already have an account?" link works

3. **Password Reset Flow**
   - [ ] Navigate to /forgot-password
   - [ ] Test email submission step
   - [ ] Test countdown timer display
   - [ ] Test resend email functionality
   - [ ] Test invalid token handling

4. **Admin Login**
   - [ ] Navigate to /admin/login
   - [ ] Verify NO Google OAuth button (credentials only)
   - [ ] Test with admin credentials
   - [ ] Verify redirects to /admin/dashboard
   - [ ] Test non-admin user gets "Admin credentials required" error

---

### Part 8: Dashboard & Layout Components (9 files)

**Routes to Test:**
| Route | Expected Behavior |
|-------|------------------|
| `/dashboard` | Main dashboard with stats cards, widgets |

**Test Scenarios:**

1. **Dashboard Overview**
   - [ ] Login as regular user
   - [ ] Navigate to /dashboard
   - [ ] Verify stats cards display (alerts count, watchlists, tier info)
   - [ ] Verify recent alerts widget
   - [ ] Verify watchlist widget
   - [ ] Test "View All" links in widgets

2. **Layout Components**
   - [ ] Verify header renders with logo
   - [ ] Verify tier badge displays in header
   - [ ] Verify user menu (settings, logout options)
   - [ ] Verify sidebar navigation
   - [ ] Test navigation item highlighting (active state)
   - [ ] Test mobile navigation (resize to mobile viewport)
   - [ ] Verify footer renders correctly

3. **Tier-Based Navigation**
   - [ ] Login as FREE tier user
   - [ ] Verify PRO-only menu items are hidden or disabled
   - [ ] Note: Create PRO user or upgrade to test PRO view

---

### Part 9: Charts & Visualization (8 files)

**Routes to Test:**
| Route | Expected Behavior |
|-------|------------------|
| `/charts` | Charts page with symbol/timeframe selectors |
| `/charts/[symbol]/[timeframe]` | Individual chart view (e.g., /charts/EURUSD/H1) |

**Test Scenarios:**

1. **Charts Page**
   - [ ] Navigate to /charts
   - [ ] Verify symbol selector renders
   - [ ] Verify timeframe selector renders
   - [ ] Test tier filtering (FREE users see limited symbols/timeframes)
   - [ ] Test PRO-only timeframes show upgrade prompt

2. **Individual Chart**
   - [ ] Navigate to /charts/EURUSD/H1 (or valid symbol/timeframe)
   - [ ] Verify TradingView chart renders
   - [ ] Verify chart controls (zoom, export button for PRO)
   - [ ] Test chart loading states
   - [ ] Note: May need Flask MT5 service running for real data

---

### Part 10: Watchlist System

**Routes to Test:**
| Route | Expected Behavior |
|-------|------------------|
| `/watchlist` | Watchlist management page |

**Test Scenarios:**

1. **Watchlist Page**
   - [ ] Navigate to /watchlist
   - [ ] Verify watchlist table/grid renders
   - [ ] Test add to watchlist functionality
   - [ ] Test remove from watchlist
   - [ ] Test symbol search
   - [ ] Verify tier restrictions on symbols

---

### Part 11: Alerts System

**Routes to Test:**
| Route | Expected Behavior |
|-------|------------------|
| `/alerts` | Alerts management page |
| `/alerts/new` | Create new alert page |

**Test Scenarios:**

1. **Alerts List**
   - [ ] Navigate to /alerts
   - [ ] Verify alerts table renders
   - [ ] Test alert status indicators
   - [ ] Test delete alert functionality
   - [ ] Test pagination (if applicable)

2. **Create Alert**
   - [ ] Navigate to /alerts/new or click "Create Alert" button
   - [ ] Verify alert creation form/modal
   - [ ] Test symbol selector
   - [ ] Test condition type selection
   - [ ] Test price input validation
   - [ ] Test successful alert creation

---

### Part 12: E-commerce & Billing (11 files)

**Routes to Test:**
| Route | Expected Behavior |
|-------|------------------|
| `/pricing` | Pricing page with FREE vs PRO comparison |
| `/settings/billing` | Billing settings page |
| `/checkout` | Unified checkout page (Stripe + dLocal) |

**Test Scenarios:**

1. **Pricing Page**
   - [ ] Navigate to /pricing (or / and click pricing link)
   - [ ] Verify FREE tier card displays correctly
   - [ ] Verify PRO tier card displays ($29/month)
   - [ ] Verify feature comparison table
   - [ ] Test "Get Started" or "Upgrade" buttons
   - [ ] Verify symbol/timeframe limits are shown

2. **Billing Settings**
   - [ ] Login and navigate to /settings/billing
   - [ ] Verify current subscription display
   - [ ] Verify tier badge
   - [ ] Test invoice list (if user has history)
   - [ ] Test upgrade/cancel buttons

---

### Part 13: Settings System

**Routes to Test:**
| Route | Expected Behavior |
|-------|------------------|
| `/settings/profile` | Profile settings |
| `/settings/account` | Account settings |
| `/settings/appearance` | Theme/appearance settings |
| `/settings/language` | Language preferences |
| `/settings/privacy` | Privacy settings |
| `/settings/terms` | Terms of service |
| `/settings/help` | Help/support page |

**Test Scenarios:**

1. **Settings Navigation**
   - [ ] Navigate to /settings/profile
   - [ ] Verify settings tabs/sidebar navigation
   - [ ] Test each settings tab is accessible

2. **Profile Settings**
   - [ ] Verify profile form renders
   - [ ] Test name update
   - [ ] Test avatar upload (if implemented)
   - [ ] Test form validation
   - [ ] Test save functionality

3. **Appearance Settings**
   - [ ] Navigate to /settings/appearance
   - [ ] Test dark/light mode toggle
   - [ ] Verify theme persists after refresh

---

### Part 14: Admin Dashboard (Admin users only)

**Routes to Test:**
| Route | Expected Behavior |
|-------|------------------|
| `/admin` or `/admin/dashboard` | Admin overview |
| `/admin/users` | User management |
| `/admin/api-usage` | API usage analytics |
| `/admin/errors` | Error logs |

**Test Scenarios (Login as admin@tradingalerts.com):**

1. **Admin Overview**
   - [ ] Navigate to admin dashboard
   - [ ] Verify admin stats display
   - [ ] Verify quick action buttons

2. **User Management**
   - [ ] Navigate to /admin/users
   - [ ] Verify user table renders
   - [ ] Test user search
   - [ ] Test user role/tier editing (if available)

3. **Access Control**
   - [ ] Logout and login as regular user
   - [ ] Attempt to access /admin routes
   - [ ] Verify redirect or 403 error

---

### Part 15: Notifications & Real-time

**Test Scenarios:**

1. **Notification Bell**
   - [ ] Verify notification bell in header
   - [ ] Test clicking notification bell opens dropdown
   - [ ] Verify notification list styling

---

### Part 16: Utilities & Infrastructure

This part is primarily backend utilities. Limited UI testing required.

- [ ] Verify any utility modals/components function correctly
- [ ] Test empty states on pages

---

### Part 17: Affiliate Marketing Platform (Part 17A + 17B)

**Routes to Test:**
| Route | Expected Behavior |
|-------|------------------|
| `/affiliate/register` | Affiliate registration (requires logged-in user) |
| `/affiliate/verify?token=xxx` | Email verification |
| `/affiliate/dashboard` | Affiliate dashboard |
| `/affiliate/dashboard/codes` | Code inventory |
| `/affiliate/dashboard/commissions` | Commission reports |
| `/affiliate/dashboard/profile` | Affiliate profile |
| `/affiliate/dashboard/profile/payment` | Payment preferences |
| `/admin/affiliates` | Admin affiliate management |

**Test Scenarios:**

1. **Affiliate Registration**
   - [ ] Login as regular user first
   - [ ] Navigate to /affiliate/register
   - [ ] Verify registration form renders
   - [ ] Test country selector
   - [ ] Test payment method selection
   - [ ] Test terms agreement checkbox
   - [ ] Test form submission

2. **Affiliate Dashboard**
   - [ ] Login as admin-affiliate@tradingalerts.com
   - [ ] Navigate to /affiliate/dashboard
   - [ ] Verify quick stats cards
   - [ ] Test navigation to codes/commissions/profile

3. **Code Inventory**
   - [ ] Navigate to /affiliate/dashboard/codes
   - [ ] Verify code inventory table/report
   - [ ] Test period selector (if available)

4. **Commission Reports**
   - [ ] Navigate to /affiliate/dashboard/commissions
   - [ ] Verify commission report renders
   - [ ] Test period filtering

5. **Admin Affiliate Management**
   - [ ] Login as admin
   - [ ] Navigate to /admin/affiliates
   - [ ] Verify affiliate list/table
   - [ ] Test affiliate detail view

---

### Part 18: dLocal Payment Integration (37 files)

**Routes to Test:**
| Route | Expected Behavior |
|-------|------------------|
| `/checkout` | Unified checkout (Stripe + dLocal) |

**Test Scenarios:**

1. **Unified Checkout**
   - [ ] Navigate to checkout page (via pricing/upgrade)
   - [ ] Verify country selector
   - [ ] Verify plan selector (3-day vs Monthly)
   - [ ] Verify payment method grid updates based on country
   - [ ] Test local currency price display
   - [ ] Test discount code input (monthly only)
   - [ ] Verify Stripe option available
   - [ ] Note: Full payment testing requires live/test API keys

---

### Part 19: (If applicable)

Check if Part 19 exists in the build orders and test accordingly.

---

## Test Report Template

For each part tested, document findings in this format:

```markdown
## Part [X] - [Name] Test Report

**Date Tested:** YYYY-MM-DD
**Tester:** Antigravity AI
**Environment:** localhost:3000

### Summary
- Total Tests: X
- Passed: X
- Failed: X
- Blocked: X

### Detailed Results

| Test Case | Status | Notes |
|-----------|--------|-------|
| [Test name] | PASS/FAIL/BLOCKED | [Details] |

### Issues Found

#### Issue 1: [Title]
- **Severity:** Critical/High/Medium/Low
- **Route:** /path
- **Steps to Reproduce:**
  1. Step 1
  2. Step 2
- **Expected:** What should happen
- **Actual:** What actually happened
- **Screenshot:** [If available]

### Recommendations
- [List any recommendations for fixes]
```

---

## Testing Execution Order

For efficient testing, follow this order:

1. **Database & Environment (Prerequisite)**
   - Verify database is running
   - Verify .env.local is configured
   - Run npm install, db:generate, db:push, db:seed

2. **Part 5: Authentication** (Required first - all other parts need auth)
   - Test login/register flows
   - Create test users for subsequent testing

3. **Part 8: Dashboard & Layout** (Core navigation)
   - Establishes navigation testing for all other parts

4. **Parts 9-13: Core Features**
   - Charts, Watchlist, Alerts, Ecommerce, Settings

5. **Part 14: Admin Dashboard** (Use admin account)

6. **Parts 15-16: Supporting Features**

7. **Part 17: Affiliate System**

8. **Part 18: dLocal Payments**

---

## Expected Issues & Workarounds

### Known Limitations

1. **MT5 Service Not Running**
   - Charts may show placeholder or error data
   - This is expected without Windows VPS with MT5

2. **Google OAuth Not Configured**
   - "Sign in with Google" may fail
   - Test credentials login instead

3. **Stripe Not Configured**
   - Payment flows may fail
   - Document as "Blocked - Stripe keys required"

4. **Email Service Not Configured**
   - Verification emails won't send
   - Check console.log for email content

---

## Deliverables

After completing all tests, provide:

1. **Test Summary Report**
   - Overall pass/fail counts per part
   - Critical issues list

2. **Detailed Part Reports**
   - Individual test results per part
   - Screenshots of failures

3. **Recommendations**
   - Priority fixes list
   - UX improvement suggestions

---

## Contact

If you encounter issues that require clarification:
- Document the issue
- Continue with other tests
- Include in final report for human review

---

**Remember: READ-ONLY MODE - Do not modify any code!**
