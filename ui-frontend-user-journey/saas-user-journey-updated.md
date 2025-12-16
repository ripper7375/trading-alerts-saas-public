# Trading Alerts SaaS - Complete User Journey

## 📋 Table of Contents

1. [Page Structure Overview](#page-structure-overview)
2. [Journey 1: New Visitor (FREE Tier)](#journey-1-new-visitor-free-tier)
3. [Journey 2: Upgrading to PRO](#journey-2-upgrading-to-pro)
4. [Journey 3: Daily Trading Routine](#journey-3-daily-trading-routine)

---

## Page Structure Overview

### 🌐 **Public Pages** (Not logged in)

1. **Homepage** (`/`)
2. **Pricing Page** (`/pricing`)
3. **Login Page** (`/login`)
4. **Register Page** (`/register`)
5. **Forgot Password** (`/forgot-password`)

### 🔒 **Protected Pages** (Must be logged in)

6. **Dashboard Home** (`/dashboard`)
7. **Live Charts** (`/dashboard/charts`)
8. **Alerts Management** (`/dashboard/alerts`)
9. **Alert Detail** (`/dashboard/alerts/[id]`)
10. **Watchlist** (`/dashboard/watchlist`)
11. **Account Settings** (`/dashboard/settings`)
12. **Billing & Subscription** (`/dashboard/settings/billing`)

### 📊 **Total: 12 Main Pages**

---

## Journey 1: New Visitor (FREE Tier)

### 🏠 **Page 1: Homepage (`/`)**

**First Impression:**
I land on the homepage. Clean, modern design with Tailwind CSS and shadcn/ui components.

**What I See:**

```
┌───────────────────────────────────────────────────────┐
│  [Logo] Trading Alerts                    [Login] [Sign Up] │
├───────────────────────────────────────────────────────┤
│                                                         │
│           🎯 Never Miss a Trading Setup Again           │
│                                                         │
│     Get alerts when price touches key support/          │
│     resistance levels based on fractal analysis         │
│                                                         │
│           [Get Started Free] [See Pricing]              │
│                                                         │
├───────────────────────────────────────────────────────┤
│  📊 Real-time Fractal Analysis                          │
│  ├─ Horizontal Support/Resistance Lines                │
│  ├─ Diagonal Trendline Detection                       │
│  └─ Multi-point Validation System                      │
│                                                         │
│  🔔 Smart Alert System                                  │
│  ├─ Price proximity alerts                             │
│  ├─ Email & Push notifications                         │
│  └─ Customizable tolerance levels                      │
│                                                         │
│  📈 Professional Tools                                  │
│  ├─ 15 Major trading symbols                           │
│  ├─ 9 Timeframe options                                │
│  └─ Watchlist management                               │
└───────────────────────────────────────────────────────┘
```

**My Actions:**

1. I scroll down to see features
2. I notice the "FREE" badge on certain features
3. I click **"See Pricing"** to understand the tiers

---

### 💰 **Page 2: Pricing Page (`/pricing`)**

**What I See:**

```
┌──────────────────────┬──────────────────────┐
│   FREE TIER          │   PRO TIER           │
│   $0/month           │   $29/month          │
├──────────────────────┼──────────────────────┤
│ ✅ 5 Symbols         │ ✅ 15 Symbols        │
│ • BTCUSD             │ • AUDJPY, AUDUSD     │
│ • EURUSD             │ • BTCUSD, ETHUSD     │
│ • USDJPY             │ • EURUSD, GBPJPY     │
│ • US30               │ • GBPUSD, NDX100     │
│ • XAUUSD             │ • NZDUSD, US30       │
│                      │ • USDCAD, USDCHF     │
│ ✅ 3 Timeframes      │ • USDJPY, XAGUSD     │
│ • H1, H4, D1         │ • XAUUSD             │
│                      │                      │
│ ✅ 5 Alerts          │ ✅ 9 Timeframes      │
│ ✅ 5 Watchlist       │ • M5 - D1            │
│ ✅ 60 API req/hour   │                      │
│                      │ ✅ 20 Alerts         │
│ [Start Free]         │ ✅ 50 Watchlist      │
│                      │ ✅ 300 API req/hour  │
│                      │ ✅ Priority Updates  │
│                      │                      │
│                      │ [Start 7-Day Trial]  │
└──────────────────────┴──────────────────────┘
```

**My Thoughts:**

- "I can start with FREE to test the system"
- "5 symbols including XAUUSD (Gold) - that's what I trade!"
- "If I like it, $29/month for PRO seems reasonable"

**My Action:**
I click **"Start Free"** on the FREE tier card.

---

### 📝 **Page 3: Register Page (`/register`)**

**What I See:**

```
┌─────────────────────────────────────────┐
│         Create Your Account             │
│                                         │
│  Name: [_________________________]      │
│                                         │
│  Email: [_________________________]     │
│                                         │
│  Password: [_________________________]  │
│  (min 8 characters, 1 uppercase, 1 number) │
│                                         │
│  Confirm Password: [________________]   │
│                                         │
│  ☐ I agree to Terms of Service and     │
│     Privacy Policy                      │
│                                         │
│           [Create Account]              │
│                                         │
│  Already have an account? [Login]       │
└─────────────────────────────────────────┘
```

**My Experience:**

1. I fill in:
   - Name: "John Trader"
   - Email: "john@example.com"
   - Password: (secure password)
2. Form validates in real-time (Zod + React Hook Form)
   - ❌ "Password must contain uppercase" (red message)
   - ✅ After fixing: Green checkmark appears
3. I check the terms checkbox
4. I click **"Create Account"**

**Backend Process (I don't see this):**

- POST request to `/api/auth/register`
- Password hashed with bcrypt
- User created in PostgreSQL with `tier: "FREE"`
- Welcome email sent via Resend
- Auto-login with NextAuth.js session

**Result:**
✅ Account created! Redirected to `/dashboard`

---

### 🏡 **Page 4: Dashboard Home (`/dashboard`)**

**First Login Experience:**

```
┌────────────────────────────────────────────────────┐
│ ☰ Menu              Trading Alerts      🔔 ⚙️ [John] │
├────────────────────────────────────────────────────┤
│                                                        │
│  👋 Welcome, John!                  FREE TIER 🆓      │
│                                                        │
│  ⚡ Quick Start Tips:                                 │
│  1. Add symbols to your Watchlist                     │
│  2. View live charts with fractal lines               │
│  3. Create your first alert                           │
│                                                        │
│  ┌──────────────┬──────────────┬──────────────┐      │
│  │  Watchlist   │   Alerts     │  API Usage   │      │
│  │              │              │              │      │
│  │    0/5       │    0/5       │   0/60       │      │
│  │   symbols    │   active     │  req/hour    │      │
│  └──────────────┴──────────────┴──────────────┘      │
│                                                        │
│  📊 Your Watchlist (Empty)                            │
│  ┌────────────────────────────────────────────┐      │
│  │  No symbols yet.                           │      │
│  │                                            │      │
│  │  [+ Add Symbol to Watchlist]               │      │
│  └────────────────────────────────────────────┘      │
│                                                        │
│  🔔 Recent Alerts (None)                              │
│  ┌────────────────────────────────────────────┐      │
│  │  You haven't created any alerts yet.       │      │
│  │                                            │      │
│  │  [Create Your First Alert]                 │      │
│  └────────────────────────────────────────────┘      │
│                                                        │
│  💡 Upgrade to PRO                                    │
│  Get 15 symbols, 9 timeframes, and 20 alerts         │
│  [Upgrade Now - $29/month]                            │
└────────────────────────────────────────────────────┘
```

**Left Sidebar Menu:**

```
┌──────────────────┐
│ 🏠 Dashboard    │ ← Currently here
│ 📊 Live Charts  │
│ 🔔 Alerts       │
│ 📋 Watchlist    │
│ ⚙️ Settings     │
└──────────────────┘
```

**My Thoughts:**

- "Clean interface, not overwhelming"
- "I see I have 0/5 slots used - good!"
- "Let me add XAUUSD to my watchlist first"

**My Action:**
I click **"+ Add Symbol to Watchlist"**

---

### 📋 **Page 5: Watchlist (`/dashboard/watchlist`)**

**What I See:**

```
┌────────────────────────────────────────────────────┐
│ 🏠 Dashboard > Watchlist                               │
├────────────────────────────────────────────────────┤
│                                                        │
│  📋 My Watchlist (0/5 slots used)     [+ Add New]     │
│                                                        │
│  ┌────────────────────────────────────────────┐      │
│  │  Select Symbol and Timeframe:              │      │
│  │                                            │      │
│  │  Symbol: [▼ XAUUSD        ]               │      │
│  │           ├─ BTCUSD                        │      │
│  │           ├─ EURUSD                        │      │
│  │           ├─ USDJPY                        │      │
│  │           ├─ US30                          │      │
│  │           └─ XAUUSD ✓                      │      │
│  │                                            │      │
│  │  Timeframe: [▼ H1         ]               │      │
│  │             ├─ H1 ✓                        │      │
│  │             ├─ H4                          │      │
│  │             └─ D1                          │      │
│  │                                            │      │
│  │          [Add to Watchlist]                │      │
│  └────────────────────────────────────────────┘      │
│                                                        │
│  📊 Active Watchlist Items:                           │
│  (Empty - add your first item above)                  │
│                                                        │
│  ℹ️ FREE Tier: You can add up to 5 combinations      │
│     Upgrade to PRO for 50 watchlist items              │
└────────────────────────────────────────────────────┘
```

**My Experience:**

1. I select **XAUUSD** from dropdown
2. I select **H1** timeframe
3. I click **"Add to Watchlist"**
4. ✅ Success message: "XAUUSD H1 added to watchlist!"

**Updated View:**

```
│  📊 Active Watchlist Items (1/5):                     │
│  ┌────────────────────────────────────────────┐      │
│  │ XAUUSD - H1                    [View] [×]  │      │
│  │ Last updated: Just now                     │      │
│  │ Current: $2,650.50                         │      │
│  └────────────────────────────────────────────┘      │
```

**My Action:**
I click **"View"** to see the live chart with fractals.

---

### 📊 **Page 6: Live Charts (`/dashboard/charts?symbol=XAUUSD&timeframe=H1`)**

**The Main Event - What I See:**

```
┌────────────────────────────────────────────────────┐
│ 📊 Charts > XAUUSD - H1                               │
├────────────────────────────────────────────────────┤
│                                                        │
│  Symbol: [▼ XAUUSD] Timeframe: [▼ H1]  [⟳ Refresh]  │
│                                                        │
│  Last updated: 5 seconds ago | Next: 55s              │
│  ████████████████████ 5s                          │
│                                                        │
```

**TradingView Lightweight Charts Integration:**

The chart area now uses **TradingView Lightweight Charts** library, providing professional-grade visualization:

```
│  ┌──────────────────────────────────────────────┐    │
│  │         TradingView Lightweight Chart        │    │
│  │                                              │    │
│  │  [Interactive Candlestick Chart]             │    │
│  │                                              │    │
│  │  Features:                                   │    │
│  │  • Candlestick series (XAUUSD H1)           │    │
│  │  • Red horizontal line: P-P1 Resistance     │    │
│  │    at $2,655.20 (5 touches, 120 bars)       │    │
│  │  • Green horizontal line: B-B1 Support      │    │
│  │    at $2,645.00 (4 touches, 100 bars)       │    │
│  │  • Blue diagonal line: B-P1 Ascending       │    │
│  │    Support at +15.5° (6 touches)            │    │
│  │  • Orange diagonal line: P-B1 Descending    │    │
│  │    Resistance at -18.2° (5 touches)         │    │
│  │                                              │    │
│  │  Fractal Markers:                            │    │
│  │  ▲ Peak fractals (108-bar, 119-bar)         │    │
│  │  ▼ Bottom fractals (108-bar, 119-bar)       │    │
│  │                                              │    │
│  │  Interactive Controls:                       │    │
│  │  • Crosshair: Hover to see price/time       │    │
│  │  • Zoom: Scroll wheel or pinch              │    │
│  │  • Pan: Click and drag                      │    │
│  │  • Price scale: Right side                  │    │
│  │  • Time scale: Bottom                       │    │
│  │                                              │    │
│  │  Current Price Line: $2,650.50 (animated)   │    │
│  └──────────────────────────────────────────────┘    │
```

**Chart Interactions Available:**

1. **Crosshair Mode (Default):**
   - Hover anywhere on chart
   - See exact price and timestamp
   - Tooltip shows OHLC values
   - Distance to nearest fractal line

2. **Zoom Controls:**
   - Mouse wheel: Zoom in/out
   - Double-click: Reset zoom
   - Pinch gesture (mobile): Zoom
   - Buttons: [+] [-] [Reset]

3. **Pan/Navigate:**
   - Click and drag chart horizontally
   - Shift + drag: Vertical price range
   - Touch drag (mobile): Smooth panning
   - Keyboard arrows: Fine navigation

4. **Price Scale:**
   - Auto-scaling enabled
   - Right-click: Toggle log scale
   - Drag scale: Adjust price range
   - Double-click: Reset to auto

**Technical Implementation:**

```typescript
// components/charts/trading-chart.tsx
import { createChart, ColorType } from 'lightweight-charts';

// Chart initialized with:
- Width: Responsive (100% container)
- Height: 600px (desktop), 400px (mobile)
- Theme: Dark mode support
- Layout: Custom colors matching app theme
- Grid: Horizontal and vertical lines
- Crosshair: Both horizontal and vertical
- Time scale: Visible with proper formatting
- Price scale: Right side, auto-scaling
```

**Below the Chart - Fractal Line Details:**

```
│                                                        │
│  📍 Current Price: $2,650.50                          │
│  ════════════════════════════════════                 │
│                                                        │
│  🔴 Horizontal Lines (Peak-to-Peak Resistance):       │
│  ┌────────────────────────────────────────────┐      │
│  │ P-P1: $2,655.20 | 5 touches | 8.5° | 120 bars  │  │
│  │ Distance: +$4.70 (+0.18%)                  │      │
│  │ [Create Alert] [👁️ Focus on Chart]         │      │
│  ├────────────────────────────────────────────┤      │
│  │ P-P2: $2,658.80 | 3 touches | -2.3° | 80 bars │  │
│  │ Distance: +$8.30 (+0.31%)                  │      │
│  │ [Create Alert] [👁️ Focus on Chart]         │      │
│  └────────────────────────────────────────────┘      │
│                                                        │
│  🟢 Horizontal Lines (Bottom-to-Bottom Support):      │
│  ┌────────────────────────────────────────────┐      │
│  │ B-B1: $2,645.00 | 4 touches | -1.2° | 100 bars │ │
│  │ Distance: -$5.50 (-0.21%)  ⚠️ NEAR          │      │
│  │ [Create Alert] [👁️ Focus on Chart] ← Recommended │  │
│  └────────────────────────────────────────────┘      │
│                                                        │
│  🔵 Diagonal Lines (Ascending Support):               │
│  ┌────────────────────────────────────────────┐      │
│  │ B-P1: $2,648.30 | 6 touches | +15.5° | 150 bars │ │
│  │ 3 peaks + 3 bottoms | Distance: -$2.20     │      │
│  │ [Create Alert] [👁️ Focus on Chart]         │      │
│  └────────────────────────────────────────────┘      │
│                                                        │
│  🔶 Diagonal Lines (Descending Resistance):           │
│  ┌────────────────────────────────────────────┐      │
│  │ P-B1: $2,652.50 | 5 touches | -18.2° | 130 bars │ │
│  │ 2 peaks + 3 bottoms | Distance: +$2.00     │      │
│  │ [Create Alert] [👁️ Focus on Chart]         │      │
│  └────────────────────────────────────────────┘      │
│                                                        │
│  💡 Legend:                                           │
│  • 108 (▲▼) = Large fractal pattern (35-bar)         │
│  • 119 (◄►) = Small fractal pattern (13-bar)         │
│  • P-P = Peak-to-Peak (Resistance)                    │
│  • B-B = Bottom-to-Bottom (Support)                   │
│  • B-P = Bottom-to-Peak (Ascending)                   │
│  • P-B = Peak-to-Bottom (Descending)                  │
│  • Positive angle (°) = Ascending line                │
│  • Negative angle (°) = Descending line               │
└────────────────────────────────────────────────────┘
```

**Chart Loading States:**

When I first navigate to the chart page, I see:

```
┌────────────────────────────────────────────┐
│  📊 Loading Chart...                       │
│  ████████████████░░░░░░░░ 70%             │
│                                            │
│  ✓ Fetching price data                    │
│  ✓ Calculating fractals (108-bar)         │
│  ✓ Calculating fractals (119-bar)         │
│  ⏳ Drawing support/resistance lines       │
│  ⏳ Rendering chart with TradingView       │
└────────────────────────────────────────────┘
```

**Real-time Updates:**

Every 60 seconds (FREE tier) or 30 seconds (PRO tier), the chart updates:

1. **Smooth Update Animation:**
   - New candle appears seamlessly
   - Price lines adjust if needed
   - No jarring "flash" or full reload
   - Current price line animates to new position

2. **Update Indicator:**

   ```
   │  Last updated: Just now ✓              │
   │  Next update in: 57s                   │
   │  ████████████████████░░ 57s            │
   ```

3. **Background Sync:**
   - API call: `GET /api/indicators?symbol=XAUUSD&timeframe=H1`
   - Response includes: candlestick data + fractal lines
   - Chart updates using `chart.update()` method
   - No full page refresh needed

**My Experience:**

1. **Visual Understanding:**
   - I see the professional TradingView chart with smooth rendering
   - Candlesticks are clear and easy to read
   - Red horizontal line at $2,655.20 = resistance (peak-to-peak)
   - Green horizontal line at $2,645.00 = support (bottom-to-bottom)
   - Blue diagonal line = ascending support (bottom-to-peak)
   - Orange diagonal line = descending resistance (peak-to-bottom)

2. **Interactive Exploration:**
   - I hover over the chart and see the crosshair
   - Tooltip shows: Time, Open, High, Low, Close
   - I scroll to zoom in on the recent price action
   - I click and drag to pan back in time
   - Fractal markers (▲▼) are clearly visible

3. **Fractal Markers:**
   - ▲ Red triangle above peaks = 108-bar fractal (large pattern)
   - ▼ Green triangle below bottoms = 108-bar fractal
   - Smaller markers for 119-bar fractals (more sensitive)

4. **I Notice:**
   - ⚠️ "NEAR" warning on B-B1 support line
   - Current price $2,650.50 is only $5.50 away from support
   - The animated current price line makes it easy to track
   - This is a good level to create an alert!

5. **Line Details on Hover:**
   - When I hover over a line on the chart, a tooltip appears:
   ```
   ┌─────────────────────────────┐
   │ B-B1 Support               │
   │ Price: $2,645.00           │
   │ Touches: 4                 │
   │ Angle: -1.2°               │
   │ Age: 100 bars              │
   │ Distance: -$5.50 (-0.21%)  │
   │ [Create Alert Here]        │
   └─────────────────────────────┘
   ```

**My Action:**
I click **"Create Alert"** on the B-B1 support line.

---

### 🔔 **Page 7: Create Alert (Modal on Charts page)**

**What I See (Modal overlay):**

```
┌────────────────────────────────────────────┐
│  🔔 Create Price Alert                     │
├────────────────────────────────────────────┤
│                                            │
│  Symbol: XAUUSD (locked)                   │
│  Timeframe: H1 (locked)                    │
│                                            │
│  Alert Type:                               │
│  ◉ Price near Support/Resistance           │
│  ○ Price crosses Support/Resistance        │
│  ○ New fractal detected                    │
│                                            │
│  Target Line:                              │
│  [▼] B-B1: $2,645.00 (Support)            │
│                                            │
│  Tolerance:                                │
│  [±] [0.10]% (±$2.65)                     │
│                                            │
│  Alert will trigger when price reaches:    │
│  $2,642.35 - $2,647.65                    │
│                                            │
│  Notification Method:                      │
│  ☑ Email                                   │
│  ☑ Push Notification                       │
│  ☐ SMS (PRO only) 🔒                       │
│                                            │
│  Alert Name (optional):                    │
│  [Gold H1 Support B-B1_______________]     │
│                                            │
│  ⚠️ Alerts Used: 0/5 (FREE Tier)          │
│                                            │
│     [Cancel]          [Create Alert]       │
└────────────────────────────────────────────┘
```

**My Experience:**

1. Form is pre-filled with the line I clicked (B-B1 support)
2. I can adjust tolerance (default 0.10% is fine)
3. I check Email and Push notifications
4. I give it a custom name: "Gold H1 Support B-B1"
5. I click **"Create Alert"**

**Validation:**

- ✅ Symbol is in my FREE tier allowance (XAUUSD)
- ✅ Timeframe is in my FREE tier allowance (H1)
- ✅ I have 0/5 alerts, so I can create this

**Backend Process:**

- POST `/api/alerts`
- Validates tier access
- Creates alert in PostgreSQL
- Returns alert object with ID

**Result:**
✅ "Alert created successfully!"
Modal closes, I'm back on the chart.

---

### 🔔 **Page 8: Alerts Management (`/dashboard/alerts`)**

**I navigate to Alerts from sidebar. What I See:**

```
┌────────────────────────────────────────────────────┐
│ 🔔 Alerts > Active Alerts                              │
├────────────────────────────────────────────────────┤
│                                                        │
│  📊 Alerts Summary              [+ Create New Alert]   │
│  ┌──────────┬──────────┬──────────┐                   │
│  │ Active   │ Paused   │ Triggered│                   │
│  │   1/5    │    0     │    0     │                   │
│  └──────────┴──────────┴──────────┘                   │
│                                                        │
│  🟢 Active Alerts (1):                                │
│  ┌────────────────────────────────────────────┐      │
│  │ 🟢 Gold H1 Support B-B1                    │      │
│  │ XAUUSD • H1                         [⋮]    │      │
│  ├────────────────────────────────────────────┤      │
│  │ Target: $2,645.00 (Support Line B-B1)     │      │
│  │ Tolerance: ±0.10% ($2,642.35-$2,647.65)   │      │
│  │                                            │      │
│  │ Current Price: $2,650.50                   │      │
│  │ Distance: -$5.50 (-0.21%)                  │      │
│  │                                            │      │
│  │ Status: ⏰ Watching                        │      │
│  │ Created: 2 minutes ago                     │      │
│  │                                            │      │
│  │ Notifications: ✉️ Email, 📱 Push          │      │
│  │                                            │      │
│  │ [📊 View Chart] [✏️ Edit] [🗑️ Delete]     │      │
│  └────────────────────────────────────────────┘      │
│                                                        │
│  ⸬ Paused Alerts (0):                                │
│  (None)                                                │
│                                                        │
│  ✅ Triggered Alerts (Last 7 days) (0):               │
│  (None yet)                                            │
│                                                        │
│  ℹ️ Alert History                                     │
│  Alerts remain active until triggered or deleted.     │
│  Triggered alerts are shown here for 30 days.         │
└────────────────────────────────────────────────────┘
```

**My Experience:**

1. I see my alert is **Active** and **Watching**
2. Real-time updates show current price and distance
3. Clean card layout with all important info
4. Easy actions: View Chart, Edit, Delete

**[⋮] Menu Options:**

```
┌──────────────────┐
│ 📊 View Chart   │
│ ✏️ Edit Alert   │
│ ⸬ Pause Alert  │
│ 🔕 Mute for 1h  │
│ 🗑️ Delete Alert │
└──────────────────┘
```

---

### 🔧 **What Happens When Alert Triggers**

**Scenario:** Gold price drops from $2,650.50 to $2,645.80 (enters the alert zone)

**1. Email Notification:**

```
From: Trading Alerts <alerts@tradingalerts.com>
To: john@example.com
Subject: 🔔 Alert Triggered: Gold H1 Support B-B1

Hi John,

Your alert "Gold H1 Support B-B1" has been triggered!

Symbol: XAUUSD
Timeframe: H1
Target Line: B-B1 Support at $2,645.00
Current Price: $2,645.80
Triggered At: 2025-01-15 14:32:15 UTC

The price has reached the support level. Consider:
✅ Reviewing the chart for entry opportunities
✅ Checking for confirmation signals
✅ Managing your risk appropriately

[View Chart in Dashboard]

---
Trading Alerts - Never Miss a Setup
Manage your alerts: https://tradingalerts.com/dashboard/alerts
```

**2. Push Notification:**

```
┌──────────────────────────────┐
│ 🔔 Trading Alerts            │
│                              │
│ Alert Triggered!             │
│ Gold H1 Support B-B1         │
│                              │
│ XAUUSD now at $2,645.80      │
│ Target: $2,645.00 (B-B1)     │
│                              │
│ [View Chart]  [Dismiss]      │
└──────────────────────────────┘
```

**3. Alert Status Update:**
When I visit `/dashboard/alerts` again:

```
│  ✅ Triggered Alerts (Last 7 days) (1):               │
│  ┌────────────────────────────────────────────┐      │
│  │ ✅ Gold H1 Support B-B1                    │      │
│  │ XAUUSD • H1                                │      │
│  ├────────────────────────────────────────────┤      │
│  │ Target: $2,645.00                          │      │
│  │ Triggered: $2,645.80                       │      │
│  │ Time: Jan 15, 2025 14:32 UTC              │      │
│  │                                            │      │
│  │ ✉️ Email sent | 📱 Push notification sent │      │
│  │                                            │      │
│  │ [📊 View Chart] [🔄 Create Similar]       │      │
│  └────────────────────────────────────────────┘      │
```

---

### ⚙️ **Page 9: Account Settings (`/dashboard/settings`)**

**What I See:**

```
┌────────────────────────────────────────────────────┐
│ ⚙️ Settings > Account                                  │
├────────────────────────────────────────────────────┤
│                                                        │
│  👤 Profile Information                               │
│  ┌────────────────────────────────────────────┐      │
│  │ Name:  [John Trader__________________]     │      │
│  │                                            │      │
│  │ Email: [john@example.com______________]    │      │
│  │        ✅ Verified                         │      │
│  │                                            │      │
│  │ [Update Profile]                           │      │
│  └────────────────────────────────────────────┘      │
│                                                        │
│  🔒 Security                                          │
│  ┌────────────────────────────────────────────┐      │
│  │ Password: ••••••••                         │      │
│  │ Last changed: 3 days ago                   │      │
│  │                                            │      │
│  │ [Change Password]                          │      │
│  └────────────────────────────────────────────┘      │
│                                                        │
│  🔔 Notification Preferences                          │
│  ┌────────────────────────────────────────────┐      │
│  │ Alert Notifications:                       │      │
│  │ ☑ Email notifications                      │      │
│  │ ☑ Push notifications                       │      │
│  │ ☐ SMS notifications (PRO only) 🔒          │      │
│  │                                            │      │
│  │ Newsletter:                                │      │
│  │ ☑ Trading tips & market insights          │      │
│  │ ☑ Product updates                          │      │
│  │                                            │      │
│  │ [Save Preferences]                         │      │
│  └────────────────────────────────────────────┘      │
│                                                        │
│  💳 Subscription & Billing    [Manage Subscription]   │
│  ┌────────────────────────────────────────────┐      │
│  │ Current Plan: FREE TIER 🆓                 │      │
│  │                                            │      │
│  │ ✅ 5 symbols (BTCUSD, EURUSD, USDJPY,     │      │
│  │              US30, XAUUSD)                │      │
│  │ ✅ 3 timeframes (H1, H4, D1)              │      │
│  │ ✅ 5 alerts                                │      │
│  │ ✅ 5 watchlist items                       │      │
│  │                                            │      │
│  │ 📊 Usage This Month:                       │      │
│  │ • Alerts: 1/5 (20%)                       │      │
│  │ • Watchlist: 1/5 (20%)                    │      │
│  │ • API Calls: 45/60 per hour               │      │
│  │                                            │      │
│  │ Want more? Upgrade to PRO for:            │      │
│  │ • 15 symbols                               │      │
│  │ • 9 timeframes                             │      │
│  │ • 20 alerts                                │      │
│  │ • 50 watchlist items                       │      │
│  │ • Priority updates (30s vs 60s)           │      │
│  │                                            │      │
│  │      [Upgrade to PRO - $29/month]          │      │
│  └────────────────────────────────────────────┘      │
└────────────────────────────────────────────────────┘
```

---

## Journey 2: Upgrading to PRO

### 💳 **Page 10: Billing & Subscription (`/dashboard/settings/billing`)**

**I click "Upgrade to PRO" and see:**

```
┌────────────────────────────────────────────────────┐
│ 💳 Upgrade to PRO                                      │
├────────────────────────────────────────────────────┤
│                                                        │
│  🚀 PRO TIER - $29/month                              │
│                                                        │
│  What You Get:                                         │
│  ✅ 15 Symbols (AUDJPY, AUDUSD, BTCUSD, ETHUSD,       │
│     EURUSD, GBPJPY, GBPUSD, NDX100, NZDUSD, US30,     │
│     USDCAD, USDCHF, USDJPY, XAGUSD, XAUUSD)           │
│  ✅ 9 Timeframes (M5, M15, M30, H1, H2, H4, H8,       │
│     H12, D1)                                           │
│  ✅ 20 Alerts (vs 5 on FREE)                          │
│  ✅ 50 Watchlist Items (vs 5 on FREE)                 │
│  ✅ 300 API Requests/hour (vs 60 on FREE)             │
│  ✅ Priority Chart Updates (30s vs 60s)               │
│  ✅ SMS Notifications                                  │
│  ✅ Advanced Analytics (Coming Soon)                   │
│                                                        │
│  💰 Billing Options:                                  │
│  ◉ Monthly - $29/month                                │
│  ○ Yearly - $290/year (Save $58!)                    │
│                                                        │
│  🎁 7-Day Free Trial                                  │
│  Try PRO risk-free. Cancel anytime.                   │
│  Your card won't be charged until Jan 22, 2025.       │
│                                                        │
│  ┌────────────────────────────────────────────┐      │
│  │ 🎫 Discount Code (Optional)                │      │
│  │                                            │      │
│  │ Have a discount code from an affiliate?    │      │
│  │ [________________] [Apply]                 │      │
│  │                                            │      │
│  │ <!-- After applying valid code: -->        │      │
│  │ ✅ Code SMITH-A7K9P2M5 applied!            │      │
│  │    Regular Price: $29.00                   │      │
│  │    Discount (20%): -$5.80                  │      │
│  │    Your Price: $23.20/month                │      │
│  └────────────────────────────────────────────┘      │
│                                                        │
│  ┌────────────────────────────────────────────┐      │
│  │ 💳 Payment Information                     │      │
│  │                                            │      │
│  │ Card Number:                               │      │
│  │ [____-____-____-____]  [💳 Visa/MC/Amex]  │      │
│  │                                            │      │
│  │ Expiry:        CVV:                        │      │
│  │ [MM/YY]        [___]                       │      │
│  │                                            │      │
│  │ Name on Card:                              │      │
│  │ [_____________________________]            │      │
│  │                                            │      │
│  │ Billing Address:                           │      │
│  │ [Same as account address] ☑                │      │
│  │                                            │      │
│  │ ☐ Save card for future payments           │      │
│  │                                            │      │
│  │ 🔒 Secured by Stripe                       │      │
│  │                                            │      │
│  │     [Cancel]    [Start 7-Day Trial]        │      │
│  └────────────────────────────────────────────┘      │
│                                                        │
│  ℹ️ Terms:                                            │
│  • Subscription auto-renews monthly                   │
│  • Cancel anytime from this page                      │
│  • Downgrade to FREE tier anytime                     │
│  • No refunds for partial months                      │
└────────────────────────────────────────────────────┘
```

**My Experience:**

1. _(Optional)_ I enter discount code from affiliate (e.g., SMITH-A7K9P2M5)
2. I click **"Apply"** and see discount applied ($29 → $26.10)
3. I enter my payment details (Stripe embedded form)
4. Card validation happens in real-time
5. I click **"Start 7-Day Trial"**

**Backend Process (Discount Code Flow):**

1. User enters code and clicks "Apply"
2. POST `/api/checkout/validate-code`
   - Validates code exists and is ACTIVE
   - Checks code not expired
   - Checks code not already used
   - Returns discount percentage (20%)
3. Frontend calculates discounted price: $29.00 × 0.8 = $23.20
4. Code stored in session for use during payment

**Backend Process (Payment Flow):**

- POST `/api/webhooks/stripe`
- Creates Stripe customer
- Creates subscription with trial period (price: $23.20 if discount applied)
- If discount code used:
  - Marks AffiliateCode as USED
  - Calculates commission: $23.20 × 20% = $4.64
  - Creates Commission record (status: PENDING)
  - Links commission to affiliate
  - Sends email notification to affiliate
- Updates user tier to "PRO" immediately
- Creates subscription record in PostgreSQL with discount code in metadata

**Result:**
✅ "Welcome to PRO! Your trial starts now."
_(If discount used)_ ✅ "Discount code applied! You saved $5.80/month."

---

### 🎉 **Page 11: Dashboard After Upgrade**

**Immediate changes I notice:**

```
┌────────────────────────────────────────────────────┐
│ ☰ Menu              Trading Alerts      🔔 ⚙️ [John] │
├────────────────────────────────────────────────────┤
│                                                        │
│  🎉 Welcome to PRO, John!              PRO TIER ⭐    │
│                                                        │
│  🚀 You now have access to:                           │
│  ✅ 15 symbols (10 more than before!)                 │
│  ✅ 9 timeframes (6 more than before!)                │
│  ✅ 20 alerts (15 more than before!)                  │
│  ✅ Charts update every 30 seconds                    │
│                                                        │
│  ⏱️ Trial Period: 7 days remaining                    │
│  Next billing: Jan 22, 2025 ($29/month)               │
│                                                        │
│  ┌──────────────┬──────────────┬──────────────┐      │
│  │  Watchlist   │   Alerts     │  API Usage   │      │
│  │              │              │              │      │
│  │    1/50      │    1/20      │   45/300     │      │
│  │   symbols    │   active     │  req/hour    │      │
│  └──────────────┴──────────────┴──────────────┘      │
│                                                        │
│  💡 Suggested Next Steps:                             │
│  1. Add more symbols to your watchlist (GBPUSD?)      │
│  2. Try shorter timeframes (M5, M15)                  │
│  3. Create alerts for different symbols               │
└────────────────────────────────────────────────────┘
```

**When I go to Charts, I now see:**

```
│  Symbol: [▼ XAUUSD]                                   │
│          ├─ AUDJPY ← NEW! 🎉                          │
│          ├─ AUDUSD ← NEW! 🎉                          │
│          ├─ BTCUSD                                    │
│          ├─ ETHUSD ← NEW! 🎉                          │
│          ├─ EURUSD                                    │
│          ├─ GBPJPY ← NEW! 🎉                          │
│          ├─ GBPUSD ← NEW! 🎉                          │
│          ├─ NDX100 ← NEW! 🎉                          │
│          ├─ NZDUSD ← NEW! 🎉                          │
│          ├─ US30                                      │
│          ├─ USDCAD ← NEW! 🎉                          │
│          ├─ USDCHF ← NEW! 🎉                          │
│          ├─ USDJPY                                    │
│          ├─ XAGUSD ← NEW! 🎉 (Silver)                 │
│          └─ XAUUSD ✓                                  │
│                                                        │
│  Timeframe: [▼ H1]                                    │
│             ├─ M5 ← NEW! 🎉                           │
│             ├─ M15 ← NEW! 🎉                          │
│             ├─ M30 ← NEW! 🎉                          │
│             ├─ H1 ✓                                   │
│             ├─ H2 ← NEW! 🎉                           │
│             ├─ H4                                     │
│             ├─ H8 ← NEW! 🎉                           │
│             ├─ H12 ← NEW! 🎉                          │
│             └─ D1                                     │
│                                                        │
│  Last updated: 3 seconds ago | Next: 27s              │
│  ████████████████ 3s  ← Updates every 30s now! ⚡     │
```

---

## Journey 3: Daily Trading Routine

### 📅 **Typical Morning Workflow**

**8:00 AM - I log in to check my watchlist:**

```
┌────────────────────────────────────────────────────┐
│ 🏠 Dashboard                                           │
├────────────────────────────────────────────────────┤
│                                                        │
│  📊 Your Watchlist (5/50):                            │
│  ┌────────────────────────────────────────────┐      │
│  │ XAUUSD - H1        $2,645.80    [View]     │      │
│  │ ⚠️ Alert triggered! B-B1 Support           │      │
│  ├────────────────────────────────────────────┤      │
│  │ EURUSD - H4        1.0850       [View]     │      │
│  │ ✓ Near P-P2 Resistance (+0.15%)           │      │
│  ├────────────────────────────────────────────┤      │
│  │ GBPUSD - H1        1.2720       [View]     │      │
│  │ 📊 Normal trading range                    │      │
│  ├────────────────────────────────────────────┤      │
│  │ BTCUSD - M15       $42,150      [View]     │      │
│  │ ⚡ Volatile - 3 new fractals detected      │      │
│  ├────────────────────────────────────────────┤      │
│  │ US30 - D1          38,250       [View]     │      │
│  │ 📈 Trend continuation pattern              │      │
│  └────────────────────────────────────────────┘      │
│                                                        │
│  🔔 Active Alerts (3/20):                             │
│  • XAUUSD H1 - B-B1 Support ✅ TRIGGERED              │
│  • EURUSD H4 - P-P2 Resistance ⏰ Watching            │
│  • GBPUSD H1 - Diagonal Support ⏰ Watching           │
└────────────────────────────────────────────────────┘
```

**8:05 AM - I click on XAUUSD to review the triggered alert:**

1. TradingView chart loads with all fractal lines
2. I see price touched the B-B1 support perfectly
3. I use the interactive crosshair to examine the exact touch point
4. I analyze the setup:
   - Multiple bounces off support (visible on chart)
   - Ascending diagonal support nearby (blue line)
   - Good risk/reward ratio
   - I zoom in using scroll wheel to see recent price action detail

**8:10 AM - I check EURUSD (approaching resistance):**

1. Navigate to EURUSD H4 chart
2. TradingView chart loads smoothly
3. Price is $0.0016 (0.15%) away from P-P2 resistance
4. I hover over the resistance line to see tooltip with details
5. I decide to create a new alert for when it actually touches
6. Quick "Create Alert" process (2 clicks, pre-filled)

**8:15 AM - I scan other symbols:**

1. Open BTCUSD M15 (short timeframe for day trading)
2. TradingView renders the M15 chart with detailed candles
3. See 3 new fractals detected since yesterday
4. New diagonal ascending support forming (blue line)
5. I use click-and-drag to pan back and see the full pattern
6. Add to watchlist for monitoring

---

### 🔄 **Page 12: Managing Subscription (`/dashboard/settings/billing`)**

**When I want to manage my subscription:**

```
┌────────────────────────────────────────────────────┐
│ 💳 Subscription Management                             │
├────────────────────────────────────────────────────┤
│                                                        │
│  🎯 Current Plan: PRO TIER ⭐                         │
│                                                        │
│  Status: Active (Trial)                                │
│  Trial Ends: Jan 22, 2025 (5 days remaining)          │
│  Next Payment: $29.00 on Jan 22, 2025                 │
│                                                        │
│  Payment Method:                                       │
│  💳 Visa ending in 4242                               │
│  Expires: 12/2026                                      │
│  [Update Card]                                         │
│                                                        │
│  ┌────────────────────────────────────────────┐      │
│  │ 📊 Usage This Billing Period:              │      │
│  │                                            │      │
│  │ Alerts: 3/20 (15%)                         │      │
│  │ ████████████████████████████████          │      │
│  │                                            │      │
│  │ Watchlist: 5/50 (10%)                      │      │
│  │ ████████████████████████████████          │      │
│  │                                            │      │
│  │ API Calls: 1,245/300 per hour (peak)      │      │
│  │ ████████████████████████████████          │      │
│  └────────────────────────────────────────────┘      │
│                                                        │
│  💰 Billing History:                                  │
│  ┌────────────────────────────────────────────┐      │
│  │ No charges yet (Trial period)              │      │
│  │                                            │      │
│  │ Upcoming:                                  │      │
│  │ Jan 22, 2025 - $29.00 (Monthly)           │      │
│  └────────────────────────────────────────────┘      │
│                                                        │
│  ⚙️ Subscription Actions:                             │
│  [Switch to Annual Billing] (Save $58/year!)          │
│  [Update Payment Method]                               │
│  [Pause Subscription]                                  │
│  [Cancel Subscription]                                 │
│  [Download Invoices]                                   │
│                                                        │
│  ℹ️ Want to downgrade?                                │
│  You can switch to FREE tier anytime. Your alerts     │
│  and watchlist will be preserved, but you'll lose     │
│  access to PRO-only symbols and timeframes.           │
│                                                        │
│  [Downgrade to FREE]                                   │
└────────────────────────────────────────────────────┘
```

---

## 🎨 UI/UX Design Patterns

### Color Scheme (Throughout All Pages)

```
Background: #FFFFFF (Light mode) / #0F1419 (Dark mode)
Primary: #3B82F6 (Blue - Actions, Links)
Success: #10B981 (Green - Support lines, positive)
Danger: #EF4444 (Red - Resistance lines, alerts)
Warning: #F59E0B (Orange - Warnings, caution)
Neutral: #6B7280 (Gray - Text, borders)

TradingView Chart Colors:
- Background: #1E222D (Dark) / #FFFFFF (Light)
- Grid: #2B2B43 (Dark) / #E1E3EB (Light)
- Candles Up: #26A69A (Teal Green)
- Candles Down: #EF5350 (Red)
- Current Price Line: #2196F3 (Blue, animated)
- Support Lines: #4CAF50 (Green)
- Resistance Lines: #F44336 (Red)
- Diagonal Lines: #2196F3 (Blue) / #FF9800 (Orange)
```

### Component Library (shadcn/ui + TradingView)

- **Buttons:** Rounded, hover effects, loading states
- **Cards:** Shadow-sm, border, hover:border-primary
- **Forms:** Inline validation, error messages
- **Modals:** Backdrop blur, smooth animations
- **Dropdowns:** Search-enabled, keyboard navigation
- **Charts:** TradingView Lightweight Charts library
  - Responsive container
  - Touch-enabled zoom/pan
  - Crosshair with tooltips
  - Auto-scaling price axis
  - Smooth real-time updates

### TradingView Chart Integration Details

**Technical Stack:**

```typescript
// components/charts/trading-chart.tsx
import { createChart, ColorType, CrosshairMode } from 'lightweight-charts';

const chart = createChart(chartContainerRef.current, {
  layout: {
    background: { type: ColorType.Solid, color: '#1E222D' },
    textColor: '#D9D9D9',
  },
  grid: {
    vertLines: { color: '#2B2B43' },
    horzLines: { color: '#2B2B43' },
  },
  crosshair: {
    mode: CrosshairMode.Normal,
  },
  rightPriceScale: {
    borderColor: '#2B2B43',
  },
  timeScale: {
    borderColor: '#2B2B43',
    timeVisible: true,
    secondsVisible: false,
  },
});

// Add candlestick series
const candlestickSeries = chart.addCandlestickSeries({
  upColor: '#26A69A',
  downColor: '#EF5350',
  borderVisible: false,
  wickUpColor: '#26A69A',
  wickDownColor: '#EF5350',
});

// Add indicator lines (from MQL5 data)
const resistanceLine = chart.addLineSeries({
  color: '#F44336',
  lineWidth: 2,
  lineStyle: 0, // Solid
  priceLineVisible: false,
});

const supportLine = chart.addLineSeries({
  color: '#4CAF50',
  lineWidth: 2,
  lineStyle: 0,
  priceLineVisible: false,
});
```

**Data Flow:**

1. **Backend API** (`/api/indicators?symbol=XAUUSD&timeframe=H1`):
   - Flask microservice calls MT5 indicators
   - Fractal Horizontal Line_V5.mq5 calculates support/resistance
   - Fractal Diagonal Line_V4.mq5 calculates trendlines
   - Returns JSON: `{ candlesticks: [], lines: [] }`

2. **Frontend Processing**:
   - `use-indicators.ts` hook fetches data
   - Validates tier access (symbol + timeframe)
   - Transforms data for TradingView format
   - Updates chart with `series.setData()`

3. **Real-time Updates**:
   - Polling every 30s (PRO) or 60s (FREE)
   - Uses `chart.update()` for smooth transitions
   - No full page reload needed
   - Optimistic UI updates

**Interactive Features:**

1. **Crosshair Tooltips:**

```typescript
chart.subscribeCrosshairMove((param) => {
  if (param.time) {
    const data = param.seriesData.get(candlestickSeries);
    // Show OHLC tooltip
    setTooltip({
      time: param.time,
      open: data.open,
      high: data.high,
      low: data.low,
      close: data.close,
    });
  }
});
```

2. **Line Click Detection:**

```typescript
chart.subscribeClick((param) => {
  const nearestLine = findNearestLine(param.point.y);
  if (nearestLine) {
    showLineTooltip(nearestLine);
    // Show "Create Alert" button
  }
});
```

3. **Zoom/Pan Handlers:**

```typescript
// Scroll wheel zoom
chart.applyOptions({
  handleScroll: {
    mouseWheel: true,
    pressedMouseMove: true,
  },
  handleScale: {
    axisPressedMouseMove: true,
    mouseWheel: true,
    pinch: true,
  },
});
```

### Responsive Design

- **Desktop (1920x1080):**
  - Full sidebar
  - Large TradingView chart (1200x600px)
  - All chart controls visible
  - Fractal markers clearly labeled
- **Tablet (768x1024):**
  - Collapsible sidebar
  - Medium TradingView chart (700x450px)
  - Touch-optimized controls
  - Simplified fractal markers
- **Mobile (375x667):**
  - Bottom nav
  - Stacked layout
  - TradingView chart (350x400px)
  - Swipe gestures enabled
  - Pinch-to-zoom
  - Touch-drag to pan

---

## 🔐 Authentication Edge Cases

### What happens if I'm not logged in?

**Scenario:** I visit `/dashboard/charts` directly

```
┌────────────────────────────────────────────┐
│  🔒 Login Required                         │
├────────────────────────────────────────────┤
│                                            │
│  You must be logged in to view charts.     │
│                                            │
│  [Login] or [Create Free Account]          │
│                                            │
│  After login, you'll be redirected back    │
│  to /dashboard/charts                      │
└────────────────────────────────────────────┘
```

### Session Timeout

**After 30 days of inactivity:**

```
┌────────────────────────────────────────────┐
│  ⏱️ Session Expired                        │
├────────────────────────────────────────────┤
│                                            │
│  For your security, your session has       │
│  expired after 30 days of inactivity.      │
│                                            │
│  Please log in again to continue.          │
│                                            │
│  [Login]                                   │
└────────────────────────────────────────────┘
```

---

## 📱 Mobile Experience Highlights

### Bottom Navigation (Mobile)

```
┌─────────────────────────────────────────┐
│                                         │
│    (TradingView Chart - Full Width)     │
│                                         │
└─────────────────────────────────────────┘
┌───────┬────────┬────────┬────────┬──────┐
│  🏠   │   📊   │   🔔   │   📋   │  ⚙️  │
│ Home  │ Charts │ Alerts │ Watch  │ More │
└───────┴────────┴────────┴────────┴──────┘
```

### Mobile TradingView Chart Features

**Touch Gestures:**

- **Single Tap:** Show crosshair at that point
- **Long Press:** Show line details tooltip
- **Pinch:** Zoom in/out (scales time axis)
- **Two-finger Drag:** Pan horizontally through time
- **Single Drag:** Move chart left/right
- **Double Tap:** Reset zoom to fit all data

**Mobile-Optimized Controls:**

```
┌─────────────────────────────────────────┐
│ XAUUSD H1                    [⋮] [↻]   │
├─────────────────────────────────────────┤
│                                         │
│  [TradingView Chart - Touch Enabled]   │
│                                         │
│  Fractal markers larger for touch      │
│  Tap markers for details               │
│                                         │
├─────────────────────────────────────────┤
│ Current: $2,650.50  ↓ Lines Below      │
└─────────────────────────────────────────┘
```

**Scrollable Line Details:**
On mobile, fractal line details appear below the chart in a horizontally scrollable carousel:

```
┌────────────────────────────────────┐
│ ← Swipe to see more lines →       │
├────────────────────────────────────┤
│ ┌──────────┐ ┌──────────┐ ┌─────  │
│ │ P-P1     │ │ B-B1     │ │ B-P1  │
│ │ $2,655   │ │ $2,645   │ │ $2,64 │
│ │ [Alert]  │ │ [Alert]  │ │ [Aler │
│ └──────────┘ └──────────┘ └─────  │
└────────────────────────────────────┘
```

### Mobile Chart Performance

**Optimizations:**

- Reduced number of visible candles (100 vs 200 on desktop)
- Simplified fractal markers (no labels, only symbols)
- Lazy loading of historical data
- Touch event throttling for smooth performance
- Hardware acceleration enabled
- Efficient re-rendering with React.memo

**Loading State:**

```
┌─────────────────────────────────────┐
│ 📊 Loading XAUUSD H1...             │
│ ████████████████░░░░ 75%           │
│ Preparing TradingView chart...      │
└─────────────────────────────────────┘
```

---

## ⚡ Performance & Loading States

### Initial Page Load

```
┌────────────────────────────────────────┐
│  ⏳ Loading Trading Alerts...          │
│  ████████████████████████          │
│                                        │
│  Fetching fractal data...              │
└────────────────────────────────────────┘
```

### Chart Loading Sequence

**Step 1: Container Ready**

```
┌────────────────────────────────────────┐
│  📊 XAUUSD H1                          │
│  ┌──────────────────────────────────┐  │
│  │                                  │  │
│  │  Initializing TradingView...     │  │
│  │  ████████░░░░░░░░ 40%           │  │
│  │                                  │  │
│  └──────────────────────────────────┘  │
└────────────────────────────────────────┘
```

**Step 2: Loading Data**

```
┌────────────────────────────────────────┐
│  📊 XAUUSD H1                          │
│  ┌──────────────────────────────────┐  │
│  │                                  │  │
│  │  Loading candlestick data...     │  │
│  │  ✓ Fetched 200 candles          │  │
│  │  ⏳ Calculating fractals...       │  │
│  │  ████████████████░░ 75%         │  │
│  │                                  │  │
│  └──────────────────────────────────┘  │
└────────────────────────────────────────┘
```

**Step 3: Rendering**

```
┌────────────────────────────────────────┐
│  📊 XAUUSD H1                          │
│  ┌──────────────────────────────────┐  │
│  │                                  │  │
│  │  ✓ Chart rendered                │  │
│  │  ✓ Detected 12 fractals          │  │
│  │  ⏳ Drawing 8 trendlines...       │  │
│  │  ████████████████████ 95%       │  │
│  │                                  │  │
│  └──────────────────────────────────┘  │
└────────────────────────────────────────┘
```

**Step 4: Complete**

```
┌────────────────────────────────────────┐
│  📊 XAUUSD H1                    [⟳]  │
│  ┌──────────────────────────────────┐  │
│  │  [Fully Interactive Chart]       │  │
│  │  ✓ Ready to use                  │  │
│  │  • Crosshair enabled             │  │
│  │  • Zoom/pan active               │  │
│  │  • All features available        │  │
│  └──────────────────────────────────┘  │
│  Last updated: Just now ✓              │
└────────────────────────────────────────┘
```

### Real-time Updates (No disruption)

**Smooth Update Mechanism:**

1. **Background Fetch** (30s/60s interval):

   ```typescript
   const updateChart = async () => {
     const newData = await fetchLatestCandle();
     // Append to existing data
     candlestickSeries.update(newData);
     // Update indicator lines if changed
     updateIndicatorLines();
   };
   ```

2. **Visual Feedback:**

   ```
   │  Last updated: 2s ago ✓              │
   │  Next update: 28s                    │
   │  ████████████████████░░░ 28s        │
   ```

3. **No Flash/Jump:**
   - Chart doesn't reload completely
   - New candle appears smoothly
   - Price lines adjust with animation
   - Crosshair remains functional during update

4. **Optimistic UI:**
   - Alert creation: Instant feedback
   - Symbol switch: Skeleton loader
   - Timeframe change: Cached if available

**Performance Metrics:**

- Initial Load: < 2 seconds
- Chart Render: < 500ms
- Symbol Switch: < 1 second
- Timeframe Change: < 800ms
- Real-time Update: < 200ms (no visible delay)

---

## 🎯 Key User Experience Wins

### 1. **Zero Learning Curve**

- Intuitive navigation
- Pre-filled forms
- Contextual tooltips
- Onboarding hints
- **TradingView-standard chart interactions** (familiar to traders)

### 2. **Speed & Responsiveness**

- Server Components = fast initial load
- Optimistic updates = instant feedback
- **TradingView Lightweight Charts** = smooth rendering
- Chart caching = no re-renders
- 30-60s polling = real-time feel
- **Hardware-accelerated graphics** for charts

### 3. **Tier System Clarity**

- Always visible: FREE vs PRO badge
- No surprises: Locked features show 🔒
- Upgrade prompts: At right moment
- Trial period: Risk-free testing

### 4. **Alert System Excellence**

- One-click alert creation from chart
- **Click directly on TradingView lines** to create alerts
- Pre-filled with intelligent defaults
- Multiple notification channels
- Clear trigger conditions

### 5. **Professional Trading Focus**

- Clean, distraction-free interface
- **Industry-standard TradingView charts**
- Focus on actionable signals
- Multiple timeframe analysis
- Fractal validation (not just lines)
- **Interactive chart exploration** with zoom/pan

### 6. **Chart Interaction Excellence**

- **Crosshair with detailed tooltips**
- **Smooth zoom and pan** (mouse/touch)
- **Real-time price updates** without flashing
- **Mobile-optimized touch gestures**
- **Responsive design** adapts to screen size
- **Professional appearance** matching trading platforms

---

## 🚀 Summary: Why This Works

**For Beginners:**

- FREE tier lets them learn without commitment
- **TradingView charts are familiar and easy to use**
- Visual fractal lines make technical analysis accessible
- Alerts teach them to wait for setups
- Gradual exposure to more symbols/timeframes
- **Interactive chart exploration** builds confidence

**For Experienced Traders:**

- PRO tier has serious capabilities (15 symbols, 9 timeframes)
- **Professional-grade TradingView charts** match their expectations
- Multi-point fractal validation = high confidence
- Fast updates (30s) for intraday trading
- **Zoom/pan features** for detailed analysis
- Multiple alert types for different strategies
- **Industry-standard UI** doesn't require retraining

**For Everyone:**

- Clean, modern interface (not cluttered like MT5)
- **Smooth, responsive charts** with no lag
- Mobile-friendly (trade on the go)
- **Touch-optimized** for mobile trading
- Reliable alerts (never miss a setup)
- Affordable ($0 or $29/month)
- **Familiar TradingView interface** reduces learning curve

---

## 📊 Technical Architecture Summary

### Chart Technology Stack

**Frontend:**

```
Next.js 15 (App Router)
├── TradingView Lightweight Charts (GitHub: tradingview/lightweight-charts)
├── React 18 (Server + Client Components)
├── TypeScript
├── Tailwind CSS + shadcn/ui
└── Real-time data hooks (use-indicators.ts)
```

**Integration Points:**

```
components/charts/
├── trading-chart.tsx          # Main TradingView wrapper
│   ├── Chart initialization
│   ├── Candlestick series
│   ├── Line series (indicators)
│   ├── Crosshair handling
│   └── Real-time updates
│
├── indicator-overlay.tsx      # Fractal markers overlay
│   ├── Peak markers (▲)
│   ├── Bottom markers (▼)
│   └── Click handlers for alerts
│
├── chart-controls.tsx         # Zoom/pan controls
│   ├── Reset zoom button
│   ├── Timeframe selector
│   └── Symbol selector
│
└── timeframe-selector.tsx     # Tier-aware selector
    ├── FREE: H1, H4, D1
    └── PRO: M5-D1 (all 9)
```

**Data Flow:**

```
User Action → Frontend Request → Backend API → Flask Microservice
     ↓              ↓                  ↓              ↓
  Click Chart   /api/indicators   Validate Tier   Call MT5
     ↓              ↓                  ↓              ↓
Create Alert   Check Auth       Check Limits    Run MQL5
     ↓              ↓                  ↓              ↓
Update UI     Return JSON      Symbol+TF OK    Return Lines
     ↓              ↓                  ↓              ↓
TradingView   Parse Data       PostgreSQL      Fractals
  Updates     Update Chart      Save Alert      + Candles
```

**MQL5 Indicators:**

- **Fractal Horizontal Line_V5.mq5**: Calculates P-P and B-B horizontal lines
- **Fractal Diagonal Line_V4.mq5**: Calculates B-P and P-B diagonal trendlines
- Both indicators output JSON via Flask microservice
- Data transformed for TradingView format in frontend

---

## 📊 User Journey Metrics

### FREE User Success Path

1. **Day 1:** Sign up, add XAUUSD to watchlist, **explore TradingView chart**
2. **Day 2:** Create first alert on support level, **use zoom to analyze**
3. **Day 3:** Alert triggers, review chart **with interactive crosshair**
4. **Day 7:** Using 3/5 alerts, 2/5 watchlist items, **comfortable with chart UI**
5. **Day 14:** Consider upgrade (needs more symbols), **appreciates chart quality**
6. **Day 30:** Convert to PRO or stay FREE (both valid)

### PRO User Success Path

1. **Day 1:** Upgrade, add 10+ symbols to watchlist, **try M5/M15 timeframes**
2. **Day 2:** Create alerts on multiple pairs, **use advanced chart features**
3. **Day 7:** First profitable trade from alert, **chart zoom helped analysis**
4. **Day 30:** Renews subscription (high satisfaction), **relies on TradingView quality**
5. **Month 3:** Power user (15+ alerts, 30+ watchlist items), **expert with chart tools**

---

**This comprehensive user journey shows every interaction, every page, and every decision point in the Trading Alerts SaaS application, now enhanced with TradingView Lightweight Charts integration. The design prioritizes clarity, speed, professional-grade visualization, and actionable trading signals while maintaining a clean, familiar interface suitable for both beginners and experienced traders.**
