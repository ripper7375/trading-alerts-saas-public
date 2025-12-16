# MVP Manual Testing Checklist

## Purpose

Since automated testing is optional for MVP, this checklist ensures all critical functionality is manually verified before deployment.

## Pre-Deployment Testing (Phase 4 - Before Going Live)

### ✅ **1. AUTHENTICATION FLOWS**

**Registration:**

- [ ] Can create new account with valid email
- [ ] Password validation works (min 8 chars, uppercase, lowercase, number)
- [ ] Cannot register with duplicate email (shows error)
- [ ] User defaults to FREE tier
- [ ] Verification email sent (check inbox/spam)
- [ ] Cannot login before email verification
- [ ] Email verification link works
- [ ] After verification, can login successfully

**Login:**

- [ ] Can login with correct credentials
- [ ] Cannot login with wrong password (shows error)
- [ ] Cannot login with non-existent email (shows error)
- [ ] "Remember me" option works (session persists)
- [ ] Redirects to dashboard after login

**Password Reset:**

- [ ] "Forgot password" sends reset email
- [ ] Reset link in email works
- [ ] Can set new password
- [ ] Can login with new password
- [ ] Old password no longer works

**Logout:**

- [ ] Logout button works
- [ ] After logout, cannot access protected pages
- [ ] Redirects to login page

---

### ✅ **2. TIER SYSTEM & ACCESS CONTROL**

**FREE Tier User:**

- [ ] Dashboard shows "FREE" badge
- [ ] Symbol selector shows ONLY "XAUUSD"
- [ ] Cannot select other symbols (disabled in UI)
- [ ] Can create up to 5 alerts
- [ ] Cannot create 6th alert (shows limit error)
- [ ] Can view charts for XAUUSD on all 7 timeframes
- [ ] Can create watchlist with XAUUSD items
- [ ] Cannot exceed 5 watchlist items
- [ ] API returns 403 if trying to access EURUSD

**PRO Tier User:**

- [ ] Dashboard shows "PRO" badge
- [ ] Symbol selector shows all 10 symbols
- [ ] Can select any symbol (EURUSD, BTCUSD, etc.)
- [ ] Can create up to 20 alerts
- [ ] Cannot create 21st alert (shows limit error)
- [ ] Can view charts for all symbols
- [ ] Can create watchlist with any symbols
- [ ] Can have up to 50 watchlist items
- [ ] All 10 symbols work in charts

---

### ✅ **3. WATCHLIST FUNCTIONALITY**

**Create Watchlist:**

- [ ] Can create new watchlist with custom name
- [ ] Watchlist appears in sidebar
- [ ] Can create multiple watchlists

**Add Items:**

- [ ] Can add symbol+timeframe combination
- [ ] Cannot add duplicate combinations
- [ ] Respects tier limits (FREE: 5, PRO: 50)
- [ ] Cannot add symbols outside tier access

**Manage Watchlist:**

- [ ] Can rename watchlist
- [ ] Can delete watchlist item
- [ ] Can delete entire watchlist
- [ ] Can reorder watchlists (if feature exists)

---

### ✅ **4. ALERTS SYSTEM**

**Create Alert:**

- [ ] Can create price alert (e.g., "XAUUSD crosses $2000")
- [ ] Alert form validates inputs (symbol, price, condition)
- [ ] Alert saves successfully
- [ ] Appears in alerts list

**Manage Alerts:**

- [ ] Can view all alerts
- [ ] Can filter alerts (active/inactive)
- [ ] Can edit alert conditions
- [ ] Can toggle alert on/off
- [ ] Can delete alert
- [ ] Deleted alerts removed from list

**Alert Triggers (if implemented):**

- [ ] Alert triggers when condition met
- [ ] Notification sent (email/in-app)
- [ ] Alert marked as triggered
- [ ] Can see trigger history

---

### ✅ **5. CHARTS & VISUALIZATION**

**Chart Loading:**

- [ ] Chart loads for XAUUSD + M15
- [ ] Chart shows candlesticks (OHLC data)
- [ ] Chart shows horizontal indicator lines
- [ ] Chart shows diagonal indicator lines
- [ ] Chart shows fractal markers

**Timeframe Switching:**

- [ ] Can switch to M30 (chart updates)
- [ ] Can switch to H1 (chart updates)
- [ ] Can switch to H2 (chart updates)
- [ ] Can switch to H4 (chart updates)
- [ ] Can switch to H8 (chart updates)
- [ ] Can switch to D1 (chart updates)

**Symbol Switching (PRO only):**

- [ ] Can switch to EURUSD (chart loads)
- [ ] Can switch to BTCUSD (chart loads)
- [ ] All 10 symbols work

**Chart Controls:**

- [ ] Zoom in/out works
- [ ] Pan left/right works
- [ ] Reset zoom works
- [ ] Pause/resume auto-refresh works (if implemented)
- [ ] Manual refresh button works

**Data Accuracy:**

- [ ] Latest candle matches MT5 terminal price
- [ ] Indicator lines match MT5 chart
- [ ] Fractals match MT5 fractals

---

### ✅ **6. SUBSCRIPTION & PAYMENTS (Stripe)**

**Pricing Page:**

- [ ] Shows FREE tier ($0) with features
- [ ] Shows PRO tier ($29/month) with features
- [ ] "Upgrade to PRO" button visible for FREE users
- [ ] "Current Plan" shown for PRO users

**Upgrade Flow (USE TEST CARD):**

- [ ] Click "Upgrade to PRO"
- [ ] Redirects to Stripe Checkout
- [ ] Stripe page loads (test mode indicator visible)
- [ ] Can fill in test card: 4242 4242 4242 4242
- [ ] Expiry: any future date (e.g., 12/34)
- [ ] CVC: any 3 digits (e.g., 123)
- [ ] Payment succeeds
- [ ] Redirects back to dashboard
- [ ] Dashboard now shows "PRO" badge
- [ ] Can now access all 10 symbols
- [ ] Alert limit increased to 20

**Subscription Management:**

- [ ] Can view subscription status in Settings → Billing
- [ ] Shows next billing date
- [ ] "Cancel subscription" button visible
- [ ] Can click cancel (confirmation modal)
- [ ] After cancel, still PRO until period end
- [ ] After period ends, downgrades to FREE

**Invoice History:**

- [ ] Can view past invoices
- [ ] Can download invoice PDF
- [ ] Invoice shows correct amount ($29)

---

### ✅ **7. USER SETTINGS**

**Profile:**

- [ ] Can update name
- [ ] Can update profile image (if feature exists)
- [ ] Changes save successfully
- [ ] Changes reflect in header/sidebar

**Preferences:**

- [ ] Can change default timeframe
- [ ] Can toggle email notifications
- [ ] Can update notification frequency
- [ ] Settings persist after logout/login

**Appearance:**

- [ ] Can switch theme (light/dark)
- [ ] Theme persists after refresh
- [ ] All pages respect theme choice

**Account:**

- [ ] "Delete account" button visible
- [ ] Confirmation modal appears
- [ ] After deletion, cannot login
- [ ] Data removed from database (check admin panel)

---

### ✅ **8. ADMIN DASHBOARD** (If logged in as admin)

**User Management:**

- [ ] Can view all users
- [ ] Can search users by email
- [ ] Can filter by tier (FREE/PRO)
- [ ] Can see user details (created date, tier, alerts count)
- [ ] Can manually change user tier
- [ ] Can deactivate user account

**Analytics:**

- [ ] Dashboard shows total users
- [ ] Shows FREE vs PRO distribution
- [ ] Shows revenue metrics (if PRO users exist)
- [ ] Shows API usage statistics

**System Health:**

- [ ] Can view error logs
- [ ] Can see API usage by endpoint
- [ ] Flask MT5 service status visible

---

### ✅ **9. ERROR HANDLING**

**Network Errors:**

- [ ] Graceful error when Flask service is down
- [ ] Graceful error when database is unreachable
- [ ] Retry mechanism works (if implemented)
- [ ] User-friendly error messages (not raw stack traces)

**Validation Errors:**

- [ ] Form shows validation errors inline
- [ ] API returns clear error messages
- [ ] 400 Bad Request for invalid input
- [ ] 401 Unauthorized for not logged in
- [ ] 403 Forbidden for tier restrictions
- [ ] 404 Not Found for missing resources
- [ ] 429 Too Many Requests for rate limit

**Edge Cases:**

- [ ] Handles empty states (no watchlists, no alerts)
- [ ] Handles loading states (spinners shown)
- [ ] Handles very long symbol names (truncation)
- [ ] Handles special characters in input

---

### ✅ **10. PERFORMANCE & UX**

**Page Load Times:**

- [ ] Dashboard loads in < 2 seconds
- [ ] Charts load in < 3 seconds
- [ ] API responses < 500ms average

**Responsiveness:**

- [ ] Works on desktop (1920x1080)
- [ ] Works on laptop (1366x768)
- [ ] Works on tablet (iPad)
- [ ] Works on mobile (iPhone/Android)
- [ ] Navigation menu responsive
- [ ] Charts resize properly

**Browser Compatibility:**

- [ ] Works in Chrome
- [ ] Works in Firefox
- [ ] Works in Safari
- [ ] Works in Edge

---

### ✅ **11. SECURITY CHECKS**

**Session Management:**

- [ ] Session expires after inactivity (if implemented)
- [ ] Cannot access protected routes without login
- [ ] Cannot access admin routes without admin role
- [ ] CSRF protection works (forms submit correctly)

**Data Privacy:**

- [ ] User can only see their own alerts
- [ ] User can only see their own watchlists
- [ ] User cannot access other users' data via API manipulation

**API Security:**

- [ ] Cannot bypass tier restrictions via direct API calls
- [ ] Cannot access EURUSD as FREE user via Postman
- [ ] Rate limiting works (test with Postman loop)

---

### ✅ **12. MT5 DATA INTEGRATION**

**Flask Service:**

- [ ] Flask service is running (health check returns OK)
- [ ] MT5 connection status is "connected"
- [ ] Can fetch indicator data via Flask API

**Data Accuracy:**

- [ ] OHLC data matches MT5 terminal
- [ ] Horizontal lines match MT5 chart
- [ ] Diagonal lines match MT5 chart
- [ ] Fractals match MT5 fractals
- [ ] Data updates when MT5 terminal updates

**All Symbols (PRO test):**

- [ ] XAUUSD data loads correctly
- [ ] EURUSD data loads correctly
- [ ] BTCUSD data loads correctly
- [ ] All 10 symbols tested and working

---

## **Post-Deployment Smoke Test (5 minutes)**

After deploying to production, run this quick smoke test:

1. [ ] Visit homepage (loads)
2. [ ] Register new account (works)
3. [ ] Verify email (works)
4. [ ] Login (works)
5. [ ] View XAUUSD chart (loads)
6. [ ] Create alert (works)
7. [ ] Create watchlist (works)
8. [ ] Upgrade to PRO with test card (works)
9. [ ] View EURUSD chart (loads)
10. [ ] Logout (works)

If all pass → **MVP is ready for users!** 🎉

---

## **Bug Tracking Template**

When you find a bug during testing:

**Bug #:** [Number]
**Found in:** [Feature/Page]
**Severity:** [Critical/High/Medium/Low]
**Steps to Reproduce:**

1.
2.
3.

**Expected:**
**Actual:**
**Screenshot:** (if applicable)
**Fix:** (after resolution)
