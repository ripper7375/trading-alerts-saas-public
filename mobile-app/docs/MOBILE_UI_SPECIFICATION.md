# DavinTrade SaaS — Mobile UI Architecture & Specification

> **Target Build Destination:** [`D:\SaaS Project\trading-alerts-saas-public\mobile-app`](file:///D:/SaaS%20Project/trading-alerts-saas-public/mobile-app) _(Dedicated Standalone Mobile App Project)_  
> **Immutable Seed Reference 1 (Architecture & Mobile Shell):** [`D:\SaaS Project\trading-alerts-saas-public\seed-code\lovable-mobile-app`](file:///D:/SaaS%20Project/trading-alerts-saas-public/seed-code/lovable-mobile-app) _(READ-ONLY — Raw mobile layout shell, bottom navigation, touch gestures, drawers, and mobile components)_  
> **Immutable Seed Reference 2 (Business Logic & Design System):** [`D:\SaaS Project\trading-alerts-saas-public\seed-code\trading-conversational-ai-ui-pages-increment`](file:///D:/SaaS%20Project/trading-alerts-saas-public/seed-code/trading-conversational-ai-ui-pages-increment) _(READ-ONLY — DavinTrade AI design system, business workflows, MT5 trading logic, tier rules, and route inventory)_  
> **Shared Backend:** [`D:\SaaS Project\trading-alerts-saas-public`](file:///D:/SaaS%20Project/trading-alerts-saas-public) _(Next.js API + Prisma + PostgreSQL + Flask MT5 VPS + FCM Push Dispatcher)_  
> **Authoritative Page Master:** [`docs/files-completion-list/frontend-codebase-migration/ui-pages-pages-increment-codebase-2.xlsx`](file:///D:/SaaS%20Project/trading-alerts-saas-public/docs/files-completion-list/frontend-codebase-migration/ui-pages-pages-increment-codebase-2.xlsx)  
> **⚠️ Critical Protection Rule:** All directories inside `seed-code/*` are **STRICTLY READ-ONLY SEEDS** and must **NEVER** be modified or overwritten.

---

## 1. Executive Summary & Core Value Proposition

**DavinTrade** is an AI-powered conversational trading analyst and automated fractal support/resistance alert platform connected to live MetaTrader 5 (MT5) terminals.

The standalone mobile app built in [`mobile-app/`](file:///D:/SaaS%20Project/trading-alerts-saas-public/mobile-app) provides a high-performance, mobile-optimized experience focused on **portability, real-time alert monitoring, and instant push notifications**. Traders analyze charts and configure price breach rules on desktop, but rely on the mobile app to receive **instant, high-priority push notifications with custom alert chimes** when price targets are breached.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          UNIFIED SYSTEM ARCHITECTURE                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                               SHARED BACKEND                                │
│   Next.js API Routes (/api/*) + Prisma + PostgreSQL (Railway)               │
│       + Flask Multi-MT5 Service on Windows VPS (Fractal Engine)             │
│       + Stripe & dLocal Multi-Currency Webhooks + FCM Push Dispatcher       │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                ┌──────────────────────┴──────────────────────┐
                ▼                                             ▼
    ┌─────────────────────────┐                   ┌─────────────────────────┐
    │     Desktop Web UI      │                   │    Standalone Mobile    │
    │      (frontend/)        │                   │     (mobile-app/)       │
    │  • 4-Panel AI Terminal  │                   │  • 5-Tab Bottom Nav     │
    │  • Bento Grid Dashboard │                   │  • Sliding AI Drawer    │
    │  • Multi-column Tables  │                   │  • Swipeable Alert List │
    │  • Full Admin Console   │                   │  • High-Priority Push   │
    └─────────────────────────┘                   └─────────────────────────┘
                                                              │
                                            ┌─────────────────┴─────────────────┐
                                            ▼                                   ▼
                                 Mobile Web / PWA (iOS)             Android .apk (Capacitor)
                                 • Safari Home Screen               • Direct APK Download
                                 • Standard Web Push                • 0% Google Play Fee
                                                                    • Custom Audio Chimes
                                                                    • Screen Wake Lock
```

---

## 2. Seed Code Reference Duality & Roles

The Mobile UI build in [`mobile-app/`](file:///D:/SaaS%20Project/trading-alerts-saas-public/mobile-app) is constructed by fusing two complementary reference seeds:

| Seed Code Library                                                                        | Nature & Purpose                                        | Responsibilities in Mobile Build                                                                                                                                                                                                                                                                                                                                         |
| :--------------------------------------------------------------------------------------- | :------------------------------------------------------ | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`seed-code/lovable-mobile-app`** _(Seed 1 — Architecture)_                             | **Raw Fundamental Mobile Architecture**                 | • Mobile Viewport Layout Shell (`MobileLayout`, `AppHeader`, safe-area insets)<br>• 5-tab Bottom Navigation (`BottomNavigation`)<br>• Mobile touch primitives (`SwipeableItem`, `usePullToRefresh`)<br>• Mobile skeleton placeholders & empty state cards<br>• Capacitor Android native bridge configuration                                                             |
| **`seed-code/trading-conversational-ai-ui-pages-increment`** _(Seed 2 — Logic & Design)_ | **Business Workflows, Logic & DavinTrade Brand Design** | • DavinTrade brand tokens, dark/light theme palette, and typography<br>• AI Conversational Analyst chat streaming engine and prompt workflows<br>• MT5 fractal support/resistance calculation hooks & chart overlays<br>• User tier validation (FREE: 5 symbols / 3 TFs vs PRO: 15 symbols / 9 TFs)<br>• Stripe & dLocal checkout workflows and partner affiliate system |

> **⚠️ IMMUTABILITY NOTICE:** Both seed folders in `seed-code/*` serve as reference blueprints and must remain untouched. All new code is written into `D:\SaaS Project\trading-alerts-saas-public\mobile-app`.

---

## 3. Role & Scope Boundary Definition

Based on [`ui-pages-pages-increment-codebase-2.xlsx`](file:///D:/SaaS%20Project/trading-alerts-saas-public/docs/files-completion-list/frontend-codebase-migration/ui-pages-pages-increment-codebase-2.xlsx), there are 6 distinct user authentication states in the system:

### 3.1. Included Mobile User Roles (5 External Roles)

1. **Non-Login (NL)**: Public marketing, onboarding, tier comparison, auth flows, and legal compliance.
2. **FREE Tier User (FT)**: 5 symbols, 3 timeframes, 5 active alerts, basic dashboard, AI chat drawer, billing upgrade flows.
3. **PRO Tier User (PT)**: 15 symbols, 9 timeframes, 20 active alerts, MT5 real-time tick streaming, priority push notifications.
4. **Unified Affiliate + FREE User (AF)**: FREE tier analyst workbench + Full Mobile Partner Affiliate Portal.
5. **Unified Affiliate + PRO User (AP)**: PRO tier analyst workbench + Full Mobile Partner Affiliate Portal.

### 3.2. Explicitly Excluded Scopes from Mobile UI

- **❌ Admin Role (`/admin/*`)**: All 24 admin pages (User management, disbursements, fraud logs, system cron monitors, broadcast center) are strictly desktop-only. Admin users manage operations from desktop terminals.
- **❌ Non-Core Peripheral Content**: Non-essential marketing and development scratch pages (`/about`, `/blog`, `/careers`, `/changelog`, `/docs`, `/test-api`) are omitted from the mobile application shell.
- **❌ Retired Legacy Routes**: `/charts/[symbol]/[timeframe]` and `/charts` (retired in Codebase 2 and replaced by `/terminal` and `/free`).

---

## 4. Complete Mobile Page Inventory & Route Mapping

Below is the complete list of active pages included in the Mobile UI scope, mapped directly from [`ui-pages-pages-increment-codebase-2.xlsx`](file:///D:/SaaS%20Project/trading-alerts-saas-public/docs/files-completion-list/frontend-codebase-migration/ui-pages-pages-increment-codebase-2.xlsx):

| Excel Row | Page Title                    | App Route URI                          | Logic & Design Reference (Seed 2)                     |    Target Roles    | Mobile Pattern & Layout Adaptation (Seed 1)                                                                                                                                                                                    |
| :-------: | :---------------------------- | :------------------------------------- | :---------------------------------------------------- | :----------------: | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|  **02**   | **Landing Page**              | `/`                                    | `app/page.tsx`                                        |         NL         | Mobile hero with Value Proposition, Live Forex Ticker, "Download Android APK" & "Get Started" CTAs.                                                                                                                            |
|  **04**   | **Cancel Account Deletion**   | `/account/deletion-cancel`             | `app/account/deletion-cancel/page.tsx`                |     NL, FT, PT     | Compact confirmation card with direct return-to-dashboard button.                                                                                                                                                              |
|  **05**   | **Confirm Account Deletion**  | `/account/deletion-confirm`            | `app/account/deletion-confirm/page.tsx`               |     NL, FT, PT     | 7-day grace period notice with final confirmation action.                                                                                                                                                                      |
|  **36**   | **Affiliate Code Inventory**  | `/affiliate/dashboard/code-inventory`  | `app/affiliate/dashboard/code-inventory/page.tsx`     |       AF, AP       | Mobile card list of generated referral codes with 1-tap clipboard copy.                                                                                                                                                        |
|  **37**   | **Affiliate Referral Codes**  | `/affiliate/dashboard/codes`           | `app/affiliate/dashboard/codes/page.tsx`              |       AF, AP       | New referral link generator with custom tag inputs.                                                                                                                                                                            |
|  **38**   | **Affiliate Commissions**     | `/affiliate/dashboard/commissions`     | `app/affiliate/dashboard/commissions/page.tsx`        |       AF, AP       | 20% recurring commission ledger with filter chips (`Pending`, `Approved`, `Paid`).                                                                                                                                             |
|  **39**   | **Affiliate Payout Status**   | `/affiliate/dashboard/payouts`         | `app/affiliate/dashboard/payouts/page.tsx`            |       AF, AP       | Timeline progress tracker for bank/wire/USDT disbursements.                                                                                                                                                                    |
|  **40**   | **Affiliate Payment Setup**   | `/affiliate/dashboard/profile/payment` | `app/affiliate/dashboard/profile/payment/page.tsx`    |       AF, AP       | Mobile form for bank account, wire IBAN, or USDT TRC20 address.                                                                                                                                                                |
|  **41**   | **Affiliate Partner Profile** | `/affiliate/dashboard/profile`         | `app/affiliate/dashboard/profile/page.tsx`            |       AF, AP       | Partner profile details, contact email, and payout preferences.                                                                                                                                                                |
|  **42**   | **Affiliate Statements**      | `/affiliate/dashboard/statements`      | `app/affiliate/dashboard/statements/page.tsx`         |       AF, AP       | Monthly statement list with 1-tap PDF/CSV download trigger.                                                                                                                                                                    |
|  **43**   | **Affiliate Dashboard**       | `/affiliate/dashboard`                 | `app/affiliate/dashboard/page.tsx`                    |       AF, AP       | Mobile KPI cards (Total Earned, Unpaid Commission, Active Clicks, Conversion Rate).                                                                                                                                            |
|  **44**   | **Affiliate Join Intro**      | `/affiliate/join`                      | `app/affiliate/join/page.tsx`                         |     NL, FT, PT     | 20% commission benefit breakdown and partner application CTA.                                                                                                                                                                  |
|  **45**   | **Affiliate Registration**    | `/affiliate/register`                  | `app/affiliate/register/page.tsx`                     |     NL, FT, PT     | Simple 3-step partner onboarding form with terms acceptance.                                                                                                                                                                   |
|  **46**   | **Affiliate Marketing Kit**   | `/affiliate/resources`                 | `app/affiliate/resources/page.tsx`                    |       AF, AP       | Mobile social share banners, copy templates, and QR code generator.                                                                                                                                                            |
|  **47**   | **Affiliate Payout Settings** | `/affiliate/settings/payout`           | `app/affiliate/settings/payout/page.tsx`              |       AF, AP       | Threshold limit configuration ($50 min) and payout schedule picker.                                                                                                                                                            |
|  **48**   | **Affiliate Verification**    | `/affiliate/verify`                    | `app/affiliate/verify/page.tsx`                       |     NL, AF, AP     | Email/Identity verification gate for new affiliate accounts.                                                                                                                                                                   |
|  **49**   | **Affiliate Landing**         | `/affiliate`                           | `app/affiliate/page.tsx`                              |     NL, FT, PT     | Public partner marketing page highlighting 20% lifetime rev-share.                                                                                                                                                             |
|  **50**   | **Edit Alert Rule**           | `/alerts/[id]/edit`                    | `app/(dashboard)/alerts/[id]/edit/page.tsx`           |   FT, PT, AF, AP   | Mobile bottom sheet / form to update price threshold and cooldown.                                                                                                                                                             |
|  **51**   | **Create New Alert**          | `/alerts/new`                          | `app/(dashboard)/alerts/new/page.tsx`                 |   FT, PT, AF, AP   | Bottom sheet dialog with symbol picker, price target, and sound preview.                                                                                                                                                       |
|  **52**   | **Alerts Management**         | `/alerts`                              | `app/(dashboard)/alerts/page.tsx`                     |   FT, PT, AF, AP   | **Swipeable alert card feed** ([`Alerts.tsx`](file:///D:/SaaS%20Project/trading-alerts-saas-public/seed-code/lovable-mobile-app/src/pages/mobile/Alerts.tsx)), active toggle switch, swipe-to-delete.                          |
|  **58**   | **PRO Analyst Terminal**      | `/terminal`                            | `app/terminal/page.tsx`                               |       PT, AP       | Full Candlestick chart + MT5 fractal overlays + **Sliding Conversational AI Chat Drawer**.                                                                                                                                     |
|  **59**   | **FREE Analyst Terminal**     | `/free`                                | `app/free/page.tsx`                                   |       FT, AF       | 3-timeframe Candlestick chart + AI Chat Drawer + Upgrade CTAs.                                                                                                                                                                 |
|  **61**   | **Payment Return Status**     | `/checkout/return`                     | `app/checkout/return/page.tsx`                        |   FT, PT, AF, AP   | Payment polling loader, success checkmark, and redirect to `/terminal`.                                                                                                                                                        |
|  **62**   | **Checkout Page**             | `/checkout`                            | `app/checkout/page.tsx`                               |   FT, PT, AF, AP   | Stripe & dLocal multi-currency payment sheet (Credit Card, UPI, Pix, Local Bank).                                                                                                                                              |
|  **63**   | **User Dashboard**            | `/dashboard`                           | `app/(dashboard)/dashboard/page.tsx`                  |   FT, PT, AF, AP   | **Single-column vertical feed** ([`Dashboard.tsx`](file:///D:/SaaS%20Project/trading-alerts-saas-public/seed-code/lovable-mobile-app/src/pages/mobile/Dashboard.tsx)): Balance, stats, market items, recent alerts.            |
|  **64**   | **Risk Disclaimer**           | `/disclaimer`                          | `app/disclaimer/page.tsx`                             | NL, FT, PT, AF, AP | Formatted legal risk disclosures with scroll-to-accept.                                                                                                                                                                        |
|  **66**   | **Forgot Password**           | `/forgot-password`                     | `app/(auth)/forgot-password/page.tsx`                 |         NL         | Clean mobile input form with reset link dispatch.                                                                                                                                                                              |
|  **67**   | **Help Centre (Public)**      | `/help`                                | `app/help/page.tsx`                                   |         NL         | Searchable FAQ accordions and direct support contact.                                                                                                                                                                          |
|  **68**   | **Login Page**                | `/login`                               | `app/(auth)/login/page.tsx`                           |         NL         | Email/Password + Google OAuth login with tier-aware redirect.                                                                                                                                                                  |
|  **69**   | **Notification Centre**       | `/notifications`                       | `app/(dashboard)/notifications/page.tsx`              |   FT, PT, AF, AP   | In-app notification feed ([`NotificationCenter.tsx`](file:///D:/SaaS%20Project/trading-alerts-saas-public/seed-code/lovable-mobile-app/src/pages/mobile/NotificationCenter.tsx)) with unread badges and 1-tap "Mark all read". |
|  **70**   | **Pricing & Plans**           | `/pricing`                             | `app/pricing/page.tsx`                                |     NL, FT, AF     | Vertical pricing cards (Free vs Pro) with feature comparison toggles.                                                                                                                                                          |
|  **71**   | **Privacy Policy**            | `/privacy`                             | `app/privacy/page.tsx`                                | NL, FT, PT, AF, AP | GDPR & Data privacy notice with sticky back navigation.                                                                                                                                                                        |
|  **72**   | **User Register**             | `/register`                            | `app/(auth)/register/page.tsx`                        |         NL         | Quick registration form with promo code pre-fill support.                                                                                                                                                                      |
|  **73**   | **Reset Password**            | `/reset-password`                      | `app/(auth)/reset-password/page.tsx`                  |         NL         | Password reset token validation and new password entry.                                                                                                                                                                        |
|  **74**   | **Account Management**        | `/settings/account`                    | `app/(dashboard)/settings/account/page.tsx`           |   FT, PT, AF, AP   | Deactivate account or initiate 7-day deletion grace period.                                                                                                                                                                    |
|  **75**   | **Appearance & Theme**        | `/settings/appearance`                 | `app/(dashboard)/settings/appearance/page.tsx`        |   FT, PT, AF, AP   | Theme toggle (Dark / Light / OLED / System) & Candlestick color picker.                                                                                                                                                        |
|  **76**   | **Billing & Subscription**    | `/settings/billing`                    | `app/(dashboard)/settings/billing/page.tsx`           |   FT, PT, AF, AP   | Current tier badge, Stripe portal management, dLocal renewal button.                                                                                                                                                           |
|  **77**   | **Help & Support**            | `/settings/help`                       | `app/(dashboard)/settings/help/page.tsx`              |   FT, PT, AF, AP   | In-app support ticket submission and FAQ accordion list.                                                                                                                                                                       |
|  **78**   | **Language & Region**         | `/settings/language`                   | `app/(dashboard)/settings/language/page.tsx`          |   FT, PT, AF, AP   | 12 Languages selector, session timezones (UTC, NY, London, Tokyo), currencies.                                                                                                                                                 |
|  **79**   | **Privacy & Data**            | `/settings/privacy`                    | `app/(dashboard)/settings/privacy/page.tsx`           |   FT, PT, AF, AP   | Telemetry toggles and GDPR data export download button.                                                                                                                                                                        |
|  **80**   | **User Profile**              | `/settings/profile`                    | `app/(dashboard)/settings/profile/page.tsx`           |   FT, PT, AF, AP   | Avatar upload, display name, trading experience level.                                                                                                                                                                         |
|  **81**   | **Security Activity Log**     | `/settings/security/activity`          | `app/(dashboard)/settings/security/activity/page.tsx` |   FT, PT, AF, AP   | Device login history, IP address log, active session revocation.                                                                                                                                                               |
|  **82**   | **Security & 2FA**            | `/settings/security`                   | `app/(dashboard)/settings/security/page.tsx`          |   FT, PT, AF, AP   | Password change and TOTP 2FA authenticator QR setup.                                                                                                                                                                           |
|  **83**   | **Terms of Service**          | `/settings/terms`                      | `app/(dashboard)/settings/terms/page.tsx`             |   FT, PT, AF, AP   | In-app terms and SLA conditions.                                                                                                                                                                                               |
|  **84**   | **Settings Overview**         | `/settings`                            | `app/(dashboard)/settings/page.tsx`                   |   FT, PT, AF, AP   | **Mobile drill-down list** ([`Settings.tsx`](file:///D:/SaaS%20Project/trading-alerts-saas-public/seed-code/lovable-mobile-app/src/pages/mobile/Settings.tsx)) with chevron navigation items.                                  |
|  **85**   | **System Status**             | `/status`                              | `app/status/page.tsx`                                 | NL, FT, PT, AF, AP | MT5 terminals status, WebSocket latency, and API uptime badges.                                                                                                                                                                |
|  **86**   | **Terms (Public)**            | `/terms`                               | `app/terms/page.tsx`                                  |         NL         | Public Terms of Service page.                                                                                                                                                                                                  |
|  **88**   | **Upgrade Success**           | `/upgrade/success`                     | `app/upgrade/success/page.tsx`                        |   FT, PT, AF, AP   | Celebration confetti, PRO features unlocked summary, "Open Terminal" button.                                                                                                                                                   |
|  **89**   | **Verify 2FA**                | `/verify-2fa`                          | `app/(auth)/verify-2fa/page.tsx`                      |         NL         | 6-digit TOTP input with auto-submit on completion.                                                                                                                                                                             |
|  **90**   | **Verify Email Pending**      | `/verify-email/pending`                | `app/(auth)/verify-email/pending/page.tsx`            |         NL         | Pending email verification reminder with "Resend email" counter.                                                                                                                                                               |
|  **91**   | **Verify Email Action**       | `/verify-email`                        | `app/(auth)/verify-email/page.tsx`                    |         NL         | Email verification token handler with auto-login redirect.                                                                                                                                                                     |
|  **93**   | **Root Error Boundary**       | `app/global-error.tsx`                 | `app/global-error.tsx`                                |        ALL         | Native-feeling error card with "Try Again" and "Contact Support" buttons.                                                                                                                                                      |
|  **94**   | **404 Not Found**             | `app/not-found.tsx`                    | `app/not-found.tsx`                                   |        ALL         | Clean 404 illustration with "Back to Terminal" navigation.                                                                                                                                                                     |
|  **96**   | **First-Run Onboarding**      | `/welcome`                             | `app/welcome/page.tsx`                                |     NL, FT, PT     | 3-step interactive onboarding card: Select Markets -> Set 1st Alert -> Enable Push Notifications.                                                                                                                              |

---

## 5. Mobile Component Architecture & Touch Patterns

The Mobile UI in [`mobile-app/`](file:///D:/SaaS%20Project/trading-alerts-saas-public/mobile-app) implements interaction primitives adapted from Seed 1 ([`seed-code/lovable-mobile-app`](file:///D:/SaaS%20Project/trading-alerts-saas-public/seed-code/lovable-mobile-app)):

### 5.1. Navigation & Shell Primitives

- **`BottomNavigation` ([`BottomNavigation.tsx`](file:///D:/SaaS%20Project/trading-alerts-saas-public/seed-code/lovable-mobile-app/src/components/navigation/BottomNavigation.tsx))**:
  Fixed bottom tab bar with 5 primary destinations for logged-in users:
  1. **Terminal** (`/terminal` or `/free`) — Icon: `LineChart` / `TrendingUp`
  2. **Alerts** (`/alerts`) — Icon: `Bell` (with dynamic active/triggered badge counter)
  3. **Dashboard** (`/dashboard`) — Icon: `LayoutDashboard`
  4. **Affiliate** (`/affiliate/dashboard` - for AF/AP roles) or **Notifications** (`/notifications` - for FT/PT roles)
  5. **Settings** (`/settings`) — Icon: `User` / `Settings`
     _(Note: Automatically hidden on `/login`, `/register`, `/verify-_`, and modal sheets).\*

- **`MobileLayout` ([`MobileLayout.tsx`](file:///D:/SaaS%20Project/trading-alerts-saas-public/seed-code/lovable-mobile-app/src/components/layouts/MobileLayout.tsx))**:
  Wraps the viewport with `min-h-[100dvh]`, top safe-area padding `pt-[env(safe-area-inset-top)]`, and bottom nav spacing `pb-16 pb-[env(safe-area-inset-bottom)]`.

### 5.2. Mobile Gesture & Touch Components

- **`SwipeableItem` ([`SwipeableItem.tsx`](file:///D:/SaaS%20Project/trading-alerts-saas-public/seed-code/lovable-mobile-app/src/components/mobile/SwipeableItem.tsx))**:
  Enables horizontal swipe gestures on alert cards:
  - **Swipe Left**: Reveals red **Delete** action.
  - **Swipe Right**: Reveals green **Toggle Active/Pause** action.
- **`usePullToRefresh` ([`usePullToRefresh.ts`](file:///D:/SaaS%20Project/trading-alerts-saas-public/seed-code/lovable-mobile-app/src/hooks/usePullToRefresh.ts))**:
  Smooth rubber-band pull gesture on Dashboard and Alerts feeds with an animated spinner indicator ([`PullToRefreshIndicator`](file:///D:/SaaS%20Project/trading-alerts-saas-public/seed-code/lovable-mobile-app/src/components/mobile/PullToRefresh.tsx)).
- **`Vaul` Slide-up Bottom Drawer**:
  Used on `/terminal` and `/free` to summon the Conversational AI Analyst chat over the candlestick chart without navigating away.
- **`Mobile Skeletons` ([`Skeletons.tsx`](file:///D:/SaaS%20Project/trading-alerts-saas-public/seed-code/lovable-mobile-app/src/components/mobile/Skeletons.tsx))**:
  Shimmer pulse placeholders matching mobile card structures during MT5 network fetches.

---

## 6. Detailed Module Specifications

### 6.1. Conversational AI Analyst Terminal (`/terminal` & `/free`)

- **Mobile Adaptation**: On desktop, the terminal is a 4-panel split workbench. On mobile:
  - **Main Viewport (100% height)**: Candlestick chart with MT5 fractal levels (Peak-to-Peak horizontal lines & diagonal trend channels).
  - **Top Bar**: Symbol selector dropdown (`EURUSD`, `GBPUSD`, `XAUUSD`, `BTCUSD`, etc.) + Timeframe pill chips (`H1`, `H4`, `D1` on Free; `M5`–`D1` on Pro).
  - **Floating Action Pill / Sheet (`Ask Davin AI`)**: Tapping the floating bottom pill opens a slide-up drawer containing the full streaming AI chat panel ([`chat-panel.tsx`](file:///D:/SaaS%20Project/trading-alerts-saas-public/seed-code/trading-conversational-ai-ui-pages-increment/components/chat-panel.tsx)). Traders can ask _"What is the current fractal support for Gold?"_ and view AI analysis overlaid on the chart.

### 6.2. Real-Time Alert Engine (`/alerts`, `/alerts/new`, `/alerts/[id]/edit`)

- **Card Feed**: Each card displays Symbol badge, Direction (`Above` / `Below`), Target Price, Current Price, Status badge (`Active` / `Triggered`), and Created timestamp.
- **Swipe Actions**: Fast swipe-to-delete or tap to edit.
- **Tier Limit Gauge**: Sticky top bar showing current usage (e.g. `Free Plan: 3/5 Alerts Used — Upgrade for 20 Alerts`).
- **New Alert Modal**: Slide-up sheet with numeric price keyboard, quick "+0.5%", "-0.5%" quick-set buttons, and sound chime selector.

### 6.3. Push Notification Engine & Notification Center (`/notifications`)

- **Delivery Protocol**: Firebase Cloud Messaging (FCM) via Capacitor native bridge on Android, and Web Push on iOS PWA.
- **Payload Structure**:
  ```json
  {
    "notification": {
      "title": "🚨 EURUSD Price Breach!",
      "body": "Price crossed above 1.08500 at 14:32 UTC (M15 Fractal Resistance)"
    },
    "data": {
      "symbol": "EURUSD",
      "timeframe": "M15",
      "alertId": "alt_849204",
      "url": "/terminal?symbol=EURUSD"
    },
    "android": {
      "priority": "high",
      "notification": {
        "sound": "trading_alert_chime",
        "channelId": "davintrade_price_alerts"
      }
    }
  }
  ```
- **In-App Notification Center**: History feed with unread count badges, filter by symbol, and 1-tap deep link to open the affected chart.

### 6.4. Monetization & Checkout (`/pricing`, `/checkout`, `/settings/billing`)

- **Stripe & dLocal Integration**: Direct mobile checkout sheet supporting Credit/Debit Cards, Google Pay, Apple Pay, UPI (India), Pix (Brazil), and local payment methods across 8 emerging markets.
- **Zero App Store Fee**: Because the Android `.apk` is distributed directly from the website, 100% of subscription revenue is retained with zero Google 30% commission cuts.

### 6.5. Mobile Partner Affiliate Portal (`/affiliate/*`)

- **Mobile Overview**: 4 high-contrast KPI cards (Commissions Earned, Unpaid Balance, Clicks, Conversions).
- **1-Tap Share**: Referral link generator with native mobile share sheet trigger (`navigator.share` / WhatsApp / Telegram).
- **Payout Tracker**: Visual status timeline of monthly payout batches.

---

## 7. Cross-Device Responsive Behavior

The responsive engine uses Tailwind CSS breakpoints to adapt seamlessly across form factors:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          RESPONSIVE BREAKPOINT MATRIX                       │
├───────────────────┬────────────────────────────┬────────────────────────────┤
│   Compact Phone   │   Tablet / Pad / Foldable  │      Desktop / Laptop      │
│     (< 768px)     │       (768px - 1024px)     │         (> 1024px)         │
├───────────────────┼────────────────────────────┼────────────────────────────┤
│ • Bottom Tab Nav  │ • Collapsible Side Rail    │ • Full Top Header + Nav    │
│ • Single Column   │ • 2-Column Split Workspace │ • 4-Panel Resizable Bench  │
│ • Slide-up Drawer │ • Side-by-Side Chart & AI  │ • Multi-column Tables      │
│ • Full-bleed Card │ • 2-Column Bento Grid      │ • Full Admin Console       │
└───────────────────┴────────────────────────────┴────────────────────────────┘
```

1. **Safe-Area Inset Handling**: All fixed headers and bottom navigation bars include `pt-[env(safe-area-inset-top)]` and `pb-[env(safe-area-inset-bottom)]` to prevent collision with camera punch-holes, dynamic islands, or Android gesture navigation pills.
2. **Dynamic Viewport Height**: Core layouts use `h-[100dvh]` to eliminate layout jumps when the mobile virtual keyboard opens.
3. **Responsive Chart Container**: Charts use `<ResponsiveContainer width="100%" height="100%">` with auto-resizing canvas rendering.

---

## 8. Technical Implementation Stack

| Layer                        | Specification / Library                                                                |
| :--------------------------- | :------------------------------------------------------------------------------------- |
| **Framework & Engine**       | Vite 5, React 18, TypeScript 5.8, React Router v6                                      |
| **Styling & Components**     | Tailwind CSS 3.4, shadcn/ui (Radix UI Primitives), Lucide React                        |
| **Mobile Gestures & UX**     | `vaul` (Drawers), `framer-motion` (Swipe & Transitions), `embla-carousel-react`        |
| **Data Fetching & State**    | TanStack Query v5 (React Query), Context API (`AuthContext`, `NotificationContext`)    |
| **Native Android Container** | Capacitor 6 (`@capacitor/core`, `@capacitor/android`, `@capacitor/push-notifications`) |
| **Push Notification Server** | Firebase Admin SDK (FCM) + PostgreSQL `UserDeviceToken` registry                       |
| **Payments**                 | Stripe Elements SDK + dLocal Emerging Market Gateway                                   |
| **Live Market Feeds**        | WebSocket client + Server-Sent Events (SSE) from Windows VPS Flask MT5 service         |

---

## 9. Capacitor Configuration Blueprint

```typescript
// mobile-app/capacitor.config.ts
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.davintrade.app',
  appName: 'DavinTrade',
  webDir: 'dist',
  server: {
    // Points to production backend/app URL for API sync & updates
    url: 'https://app.davintrade.com',
    cleartext: false,
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#090d16',
      showSpinner: false,
    },
  },
};

export default config;
```

---

## 10. Implementation Execution Roadmap (For Future Agent Sessions)

```
┌────────────────────────────────────────────────────────┐
│  Phase 1: Initialize mobile-app Project Directory      │
│  • Scaffold mobile-app (Vite + React + Tailwind + UI)  │
│  • Port BottomNavigation, MobileLayout, SwipeableItem  │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│  Phase 2: Terminal & Alerts Mobile UI Implementation   │
│  • Build /terminal and /free with sliding AI Drawer    │
│  • Implement Swipeable Alert Feed on /alerts           │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│  Phase 3: Settings, Affiliate & Auth Mobile Screens    │
│  • Build /settings/* mobile drill-down navigation      │
│  • Build mobile-optimized /affiliate/* partner cards   │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│  Phase 4: Push Notification System & FCM Registration  │
│  • Connect Capacitor FCM token listener & chime audio  │
│  • Register device tokens to shared backend            │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│  Phase 5: Android .apk Build & Direct Website Hosting  │
│  • Generate signed release APK via Android Studio      │
│  • Add download landing page & in-app update checker   │
└────────────────────────────────────────────────────────┘
```

---

_Document officially registered in DavinTrade SaaS system documentation at `docs/MOBILE_UI_SPECIFICATION.md`._
