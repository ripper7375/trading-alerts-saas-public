# Frontend UI Testing Checklist

**Purpose**: Test all frontend functionality before starting UI optimizations (Option A)
**Status**: ⏳ Waiting for OAuth fix
**Last Updated**: 2026-01-09

---

## 🔐 Phase 1: Authentication & Authorization

### Google OAuth Sign-In
- [ ] Click "Sign in with Google"
- [ ] See Google consent screen (not error page)
- [ ] Authorize application
- [ ] Redirected to dashboard
- [ ] User created in database with tier=FREE, role=USER
- [ ] Profile picture loaded from Google

### Email/Password Registration
- [ ] Navigate to `/register`
- [ ] Fill registration form (name, email, password)
- [ ] Submit form
- [ ] User created in database
- [ ] Email verification sent
- [ ] Can access dashboard (or redirected to verify email)

### Email/Password Login
- [ ] Navigate to `/login`
- [ ] Enter credentials
- [ ] Submit form
- [ ] Session created
- [ ] Redirected to dashboard
- [ ] User tier and role displayed correctly

### Logout
- [ ] Click logout button
- [ ] Session destroyed
- [ ] Redirected to homepage
- [ ] Cannot access protected routes

### Password Reset Flow
- [ ] Navigate to `/forgot-password`
- [ ] Enter email
- [ ] Receive reset email
- [ ] Click reset link
- [ ] Set new password
- [ ] Can login with new password

---

## 🏠 Phase 2: Dashboard & Homepage

### Marketing Homepage (Unauthenticated)
- [ ] Navigate to `/` (root)
- [ ] Hero section loads
- [ ] "Get Started" CTA visible
- [ ] Pricing section visible
- [ ] Footer links work
- [ ] Responsive on mobile

### Dashboard (Authenticated - FREE Tier)
- [ ] Navigate to `/dashboard`
- [ ] Dashboard stats cards load
- [ ] Recent alerts widget visible
- [ ] Watchlist widget visible
- [ ] FREE tier limitations shown (5 symbols, 3 timeframes)
- [ ] "Upgrade to PRO" prompt visible
- [ ] Sidebar navigation works

---

## 📊 Phase 3: Watchlist & Symbols

### Watchlist Page
- [ ] Navigate to `/watchlist`
- [ ] Can add symbol to watchlist
- [ ] Can select timeframe (FREE: 3 options, PRO: 9 options)
- [ ] Can reorder watchlist items (drag-and-drop or buttons)
- [ ] Can remove symbols
- [ ] FREE tier: Limited to 5 symbols
- [ ] PRO tier: Up to 15 symbols

### Tier-Based Restrictions
- [ ] FREE user tries to add 6th symbol → Error message
- [ ] FREE user tries to select 4th timeframe → Disabled/locked
- [ ] PRO upgrade prompt shown when hitting limits

---

## 📈 Phase 4: Charts & Indicators

### Charts Page
- [ ] Navigate to `/charts`
- [ ] List of symbols displayed
- [ ] Can click symbol to view chart

### Trading Chart View
- [ ] Navigate to `/charts/[symbol]/[timeframe]`
- [ ] Chart canvas loads (lightweight-charts)
- [ ] Candlestick data displays
- [ ] Can switch timeframes
- [ ] Timeframe selector works
- [ ] Chart controls (zoom, pan) functional

### Indicators (FREE Tier)
- [ ] Toggle basic indicators
- [ ] See indicator overlays on chart:
  - [ ] Moving Averages
  - [ ] Bollinger Bands
  - [ ] RSI
  - [ ] MACD
- [ ] Indicator settings can be adjusted

### PRO Indicators (PRO Tier Only)
- [ ] FREE user sees "PRO" badge on advanced indicators
- [ ] FREE user cannot activate PRO indicators
- [ ] PRO user can activate:
  - [ ] Confluence Score
  - [ ] Advanced patterns
  - [ ] Multi-timeframe analysis

---

## 🔔 Phase 5: Alerts System

### Alerts Management Page
- [ ] Navigate to `/alerts`
- [ ] List of user's alerts displayed
- [ ] Can create new alert
- [ ] Can edit existing alert
- [ ] Can delete alert
- [ ] FREE tier: Limited to 5 alerts
- [ ] PRO tier: Up to 20 alerts

### Create Alert Modal/Page
- [ ] Navigate to `/alerts/new`
- [ ] Select symbol (dropdown)
- [ ] Select timeframe
- [ ] Select condition (price above/below, indicator cross, etc.)
- [ ] Set target price/value
- [ ] Set notification method (email, in-app)
- [ ] Submit form
- [ ] Alert created successfully
- [ ] Alert appears in alerts list

### Alert Notifications
- [ ] Alert triggers when condition met
- [ ] User receives notification (in-app or email)
- [ ] Alert status updates (triggered, active, expired)

---

## ⚙️ Phase 6: Settings Pages

### Profile Settings (`/settings/profile`)
- [ ] Can update name
- [ ] Can update email (with verification)
- [ ] Can update profile picture
- [ ] Profile picture from Google OAuth displays
- [ ] Save button works
- [ ] Success message shown

### Account Settings (`/settings/account`)
- [ ] Can view account details
- [ ] User tier displayed (FREE or PRO)
- [ ] Account creation date shown
- [ ] Email verification status shown
- [ ] Connected accounts shown (Google, Twitter, etc.)

### Security Settings (`/settings/security`)
- [ ] Can change password
- [ ] Can enable/disable 2FA
- [ ] 2FA setup flow works (QR code, backup codes)
- [ ] Can view login history
- [ ] Can view active sessions
- [ ] Can revoke sessions

### Billing Settings (`/settings/billing`)
- [ ] Current subscription status shown
- [ ] Payment method displayed (if PRO)
- [ ] Next billing date shown (if PRO)
- [ ] Can download invoices
- [ ] Can cancel subscription
- [ ] "Upgrade to PRO" button (if FREE)

### Preferences (`/settings/preferences`)
- [ ] Can select language
- [ ] Can select theme (light/dark)
- [ ] Can set default timeframe
- [ ] Can configure notification preferences
- [ ] Save button works

---

## 💳 Phase 7: Pricing & Checkout

### Pricing Page
- [ ] Navigate to `/pricing`
- [ ] FREE tier card displayed
- [ ] PRO tier card displayed
- [ ] Feature comparison table
- [ ] "Upgrade to PRO" button works
- [ ] Affiliate discount code input visible

### Checkout Flow (Stripe)
- [ ] Click "Upgrade to PRO"
- [ ] Redirected to `/checkout` or Stripe checkout
- [ ] Can enter payment details
- [ ] Can apply discount code
- [ ] Can complete payment
- [ ] Redirected back after successful payment
- [ ] User tier updated to PRO

### Checkout Flow (dLocal - if applicable)
- [ ] Can select dLocal payment method
- [ ] Can select country
- [ ] Can see price in local currency
- [ ] Payment methods shown (based on country)
- [ ] Can complete 3-day trial (if eligible)
- [ ] Can complete monthly subscription

---

## 👤 Phase 8: Admin Panel (Admin Users Only)

### Admin Dashboard (`/admin`)
- [ ] Only accessible by admin users
- [ ] Overview stats displayed:
  - [ ] Total users
  - [ ] Total revenue
  - [ ] Active subscriptions
  - [ ] API usage
- [ ] Charts/graphs load

### User Management (`/admin/users`)
- [ ] List of all users displayed
- [ ] Can search/filter users
- [ ] Can view user details
- [ ] Can change user tier (FREE ↔ PRO)
- [ ] Can change user role (USER ↔ ADMIN)
- [ ] Can deactivate/activate users

### API Usage (`/admin/api-usage`)
- [ ] API usage stats displayed
- [ ] Can filter by date range
- [ ] Can filter by user
- [ ] Can filter by endpoint
- [ ] Export to CSV works

### Error Logs (`/admin/errors`)
- [ ] Recent errors displayed
- [ ] Can filter by severity
- [ ] Can filter by date
- [ ] Error details shown (stack trace, context)
- [ ] Can mark as resolved

---

## 🎁 Phase 9: Affiliate System (If Applicable)

### Affiliate Registration
- [ ] Navigate to `/affiliate/register`
- [ ] Fill registration form
- [ ] Submit form
- [ ] Affiliate account created
- [ ] Email verification sent

### Affiliate Dashboard
- [ ] Navigate to `/affiliate/dashboard`
- [ ] Stats cards load:
  - [ ] Total codes distributed
  - [ ] Codes used
  - [ ] Commissions earned
  - [ ] Unpaid balance
- [ ] Code list displayed
- [ ] Can view code details

### Admin: Affiliate Management
- [ ] Navigate to `/admin/affiliates`
- [ ] List of affiliates displayed
- [ ] Can approve/reject affiliates
- [ ] Can suspend affiliates
- [ ] Can distribute codes
- [ ] Can pay commissions

---

## 📱 Phase 10: Mobile Responsiveness

### Mobile Menu
- [ ] Hamburger menu icon visible on mobile
- [ ] Click to open sidebar
- [ ] Navigation links work
- [ ] Can close sidebar

### Responsive Layouts
- [ ] Dashboard layout responsive
- [ ] Charts scale properly on mobile
- [ ] Tables scroll horizontally if needed
- [ ] Forms are touch-friendly
- [ ] Buttons are properly sized for touch

### Touch Interactions
- [ ] Can tap to select symbols
- [ ] Can swipe to reorder watchlist (if applicable)
- [ ] Modals/dialogs work on mobile
- [ ] Chart pan/zoom works with touch

---

## 🐛 Phase 11: Error Handling

### Network Errors
- [ ] Disconnect internet
- [ ] Try to load data
- [ ] Error message displayed
- [ ] Retry button works
- [ ] Reconnect shows data

### 404 Not Found
- [ ] Navigate to non-existent route
- [ ] 404 page displayed
- [ ] "Go Home" button works

### 500 Server Error (simulate)
- [ ] Trigger server error (if test endpoint exists)
- [ ] Error page displayed
- [ ] Error logged (check logs)

### Form Validation
- [ ] Try to submit empty form
- [ ] Validation errors shown
- [ ] Field-level errors displayed
- [ ] Can fix errors and resubmit

---

## ⚡ Phase 12: Performance & Loading States

### Loading Skeletons
- [ ] Dashboard shows skeleton while loading
- [ ] Charts show skeleton
- [ ] Tables show skeleton
- [ ] Smooth transition from skeleton to content

### Bundle Size (Before Optimization)
- [ ] Run Lighthouse audit
- [ ] Check "Total Blocking Time"
- [ ] Check "First Contentful Paint"
- [ ] Baseline metrics for comparison after Option A optimization

### Network Performance
- [ ] Check Network tab in DevTools
- [ ] Total JS bundle size: ~150-200KB (expected before optimization)
- [ ] Check for unnecessary requests
- [ ] Check for duplicate requests

---

## 📋 Summary Checklist

### Critical Issues (Must Fix Before Optimization)
- [ ] Authentication works (Google OAuth + Email/Password)
- [ ] Dashboard loads
- [ ] Charts display data
- [ ] Alerts can be created
- [ ] Settings can be updated
- [ ] No console errors

### Medium Priority Issues (Fix During Optimization)
- [ ] Loading states need improvement
- [ ] Bundle size too large
- [ ] Some components re-render unnecessarily
- [ ] Image optimization needed

### Low Priority Issues (Nice to Have)
- [ ] Minor UI alignment issues
- [ ] Animation improvements
- [ ] Better error messages

---

## 📊 Testing Results Template

After completing this checklist, fill out:

```markdown
## Testing Results - [Date]

### ✅ Working Features
- [List features that work correctly]

### 🐛 Issues Found
1. **[Issue Title]**
   - Severity: High/Medium/Low
   - Description: [What's wrong]
   - Steps to reproduce: [How to reproduce]
   - Expected: [What should happen]
   - Actual: [What actually happens]
   - Screenshot: [If applicable]

2. [Next issue...]

### 📈 Performance Baseline (Before Optimization)
- Lighthouse Performance Score: [X]/100
- Total JavaScript Bundle: [X] KB
- First Contentful Paint: [X] ms
- Time to Interactive: [X] ms

### ✅ Ready for Option A Optimization?
- [ ] All critical issues fixed
- [ ] Authentication working
- [ ] Core features functional
- [ ] Baseline metrics recorded
```

---

**Status**: Ready to start testing after OAuth configuration is complete
**Next**: Fix OAuth → Complete testing → Start Option A UI optimizations
