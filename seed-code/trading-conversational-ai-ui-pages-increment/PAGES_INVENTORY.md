# DavinTrade SaaS — Pages and Routes Directory

> **Base Codebase Path:** `D:\SaaS Project\trading-alerts-saas-public\seed-code\trading-conversational-ai-ui-pages-increment`  
> **Framework:** Next.js (App Router) | React 19 | TypeScript | Tailwind CSS  
> **Total Active Pages:** 24 `page.tsx` Routes + 1 `not-found.tsx` Custom Error Page

---

## 📑 Summary of Pages by Module

|   #   | Module / Feature Area         | Page Count | Route Prefix / Scope                                                      |
| :---: | :---------------------------- | :--------: | :------------------------------------------------------------------------ |
| **1** | **Core Terminal & Landing**   |     3      | `/`, `/terminal`, `/free`                                                 |
| **2** | **Dashboard & Alerts**        |     3      | `/dashboard`, `/alerts`, `/alerts/new`                                    |
| **3** | **Authentication & Security** |     4      | `/login`, `/register`, `/forgot-password`, `/verify-2fa`                  |
| **4** | **Settings Suite**            |     10     | `/settings/*` (`profile`, `appearance`, `security`, `billing`, etc.)      |
| **5** | **Subscriptions & Pricing**   |     2      | `/pricing`, `/checkout`                                                   |
| **6** | **Admin Management Suite**    |     5      | `/admin/*` (`overview`, `login`, `users`, `disbursement`, `fraud-alerts`) |
| **7** | **Partner Affiliate Portal**  |     3      | `/affiliate/*` (`dashboard`, `register`, `settings/payout`)               |
| **8** | **System & Error Pages**      |     1      | `/_not-found` (Custom 404)                                                |
|       | **Total Route Pages**         |   **31**   | _(24 unique `page.tsx` + 1 `not-found.tsx` + route groups)_               |

---

## 1. 📊 Core Terminal & Landing Pages

| Page Name & Purpose                                                       | Route URI   | Filename   | Relative Directory Path | Absolute Directory Path                                                                                          | Absolute File Path                                                                                                        |
| :------------------------------------------------------------------------ | :---------- | :--------- | :---------------------- | :--------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------ |
| **Landing Page (Home)**<br>Public marketing landing page                  | `/`         | `page.tsx` | `app`                   | `D:\SaaS Project\trading-alerts-saas-public\seed-code\trading-conversational-ai-ui-pages-increment\app`          | `D:\SaaS Project\trading-alerts-saas-public\seed-code\trading-conversational-ai-ui-pages-increment\app\page.tsx`          |
| **PRO AI Analyst Terminal**<br>4-panel resizable trading workbench        | `/terminal` | `page.tsx` | `app\terminal`          | `D:\SaaS Project\trading-alerts-saas-public\seed-code\trading-conversational-ai-ui-pages-increment\app\terminal` | `D:\SaaS Project\trading-alerts-saas-public\seed-code\trading-conversational-ai-ui-pages-increment\app\terminal\page.tsx` |
| **FREE Tier Analyst Terminal**<br>3-panel trading bench with upgrade CTAs | `/free`     | `page.tsx` | `app\free`              | `D:\SaaS Project\trading-alerts-saas-public\seed-code\trading-conversational-ai-ui-pages-increment\app\free`     | `D:\SaaS Project\trading-alerts-saas-public\seed-code\trading-conversational-ai-ui-pages-increment\app\free\page.tsx`     |

---

## 2. 📈 Dashboard & Real-Time Alert Engine

| Page Name & Purpose                                                   | Route URI     | Filename   | Relative Directory Path      | Absolute Directory Path                                                                                                        | Absolute File Path                                                                                                                      |
| :-------------------------------------------------------------------- | :------------ | :--------- | :--------------------------- | :----------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------- |
| **User Dashboard**<br>Account overview, metrics, quick actions        | `/dashboard`  | `page.tsx` | `app\(dashboard)\dashboard`  | `D:\SaaS Project\trading-alerts-saas-public\seed-code\trading-conversational-ai-ui-pages-increment\app\(dashboard)\dashboard`  | `D:\SaaS Project\trading-alerts-saas-public\seed-code\trading-conversational-ai-ui-pages-increment\app\(dashboard)\dashboard\page.tsx`  |
| **Alert Rules Manager**<br>Real-time price breach & alert rules table | `/alerts`     | `page.tsx` | `app\(dashboard)\alerts`     | `D:\SaaS Project\trading-alerts-saas-public\seed-code\trading-conversational-ai-ui-pages-increment\app\(dashboard)\alerts`     | `D:\SaaS Project\trading-alerts-saas-public\seed-code\trading-conversational-ai-ui-pages-increment\app\(dashboard)\alerts\page.tsx`     |
| **Create New Alert**<br>Threshold & drawn line rule configuration     | `/alerts/new` | `page.tsx` | `app\(dashboard)\alerts\new` | `D:\SaaS Project\trading-alerts-saas-public\seed-code\trading-conversational-ai-ui-pages-increment\app\(dashboard)\alerts\new` | `D:\SaaS Project\trading-alerts-saas-public\seed-code\trading-conversational-ai-ui-pages-increment\app\(dashboard)\alerts\new\page.tsx` |

---

## 3. 🔑 Authentication & Security Suite

| Page Name & Purpose                                                        | Route URI          | Filename   | Relative Directory Path      | Absolute Directory Path                                                                                                        | Absolute File Path                                                                                                                      |
| :------------------------------------------------------------------------- | :----------------- | :--------- | :--------------------------- | :----------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------- |
| **User Login**<br>Standard email and password login form                   | `/login`           | `page.tsx` | `app\(auth)\login`           | `D:\SaaS Project\trading-alerts-saas-public\seed-code\trading-conversational-ai-ui-pages-increment\app\(auth)\login`           | `D:\SaaS Project\trading-alerts-saas-public\seed-code\trading-conversational-ai-ui-pages-increment\app\(auth)\login\page.tsx`           |
| **User Registration**<br>Sign-up form with tier selection                  | `/register`        | `page.tsx` | `app\(auth)\register`        | `D:\SaaS Project\trading-alerts-saas-public\seed-code\trading-conversational-ai-ui-pages-increment\app\(auth)\register`        | `D:\SaaS Project\trading-alerts-saas-public\seed-code\trading-conversational-ai-ui-pages-increment\app\(auth)\register\page.tsx`        |
| **Forgot Password**<br>Password recovery dispatch request form             | `/forgot-password` | `page.tsx` | `app\(auth)\forgot-password` | `D:\SaaS Project\trading-alerts-saas-public\seed-code\trading-conversational-ai-ui-pages-increment\app\(auth)\forgot-password` | `D:\SaaS Project\trading-alerts-saas-public\seed-code\trading-conversational-ai-ui-pages-increment\app\(auth)\forgot-password\page.tsx` |
| **Two-Factor Verification**<br>6-Digit TOTP 2FA authenticator verification | `/verify-2fa`      | `page.tsx` | `app\(auth)\verify-2fa`      | `D:\SaaS Project\trading-alerts-saas-public\seed-code\trading-conversational-ai-ui-pages-increment\app\(auth)\verify-2fa`      | `D:\SaaS Project\trading-alerts-saas-public\seed-code\trading-conversational-ai-ui-pages-increment\app\(auth)\verify-2fa\page.tsx`      |

---

## 4. ⚙️ Account & Terminal Settings Suite

| Page Name & Purpose                                                    | Route URI              | Filename   | Relative Directory Path               | Absolute Directory Path                                                                                                                 | Absolute File Path                                                                                                                               |
| :--------------------------------------------------------------------- | :--------------------- | :--------- | :------------------------------------ | :-------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------- |
| **Settings Overview**<br>Main settings menu & entry point              | `/settings`            | `page.tsx` | `app\(dashboard)\settings`            | `D:\SaaS Project\trading-alerts-saas-public\seed-code\trading-conversational-ai-ui-pages-increment\app\(dashboard)\settings`            | `D:\SaaS Project\trading-alerts-saas-public\seed-code\trading-conversational-ai-ui-pages-increment\app\(dashboard)\settings\page.tsx`            |
| **Profile Settings**<br>User avatar, username, bio, experience level   | `/settings/profile`    | `page.tsx` | `app\(dashboard)\settings\profile`    | `D:\SaaS Project\trading-alerts-saas-public\seed-code\trading-conversational-ai-ui-pages-increment\app\(dashboard)\settings\profile`    | `D:\SaaS Project\trading-alerts-saas-public\seed-code\trading-conversational-ai-ui-pages-increment\app\(dashboard)\settings\profile\page.tsx`    |
| **Appearance Settings**<br>Themes, candle colors, accent highlights    | `/settings/appearance` | `page.tsx` | `app\(dashboard)\settings\appearance` | `D:\SaaS Project\trading-alerts-saas-public\seed-code\trading-conversational-ai-ui-pages-increment\app\(dashboard)\settings\appearance` | `D:\SaaS Project\trading-alerts-saas-public\seed-code\trading-conversational-ai-ui-pages-increment\app\(dashboard)\settings\appearance\page.tsx` |
| **Security Settings**<br>Password update, 2FA toggle, active sessions  | `/settings/security`   | `page.tsx` | `app\(dashboard)\settings\security`   | `D:\SaaS Project\trading-alerts-saas-public\seed-code\trading-conversational-ai-ui-pages-increment\app\(dashboard)\settings\security`   | `D:\SaaS Project\trading-alerts-saas-public\seed-code\trading-conversational-ai-ui-pages-increment\app\(dashboard)\settings\security\page.tsx`   |
| **Billing & Invoices**<br>Subscription plans, cards, invoice history   | `/settings/billing`    | `page.tsx` | `app\(dashboard)\settings\billing`    | `D:\SaaS Project\trading-alerts-saas-public\seed-code\trading-conversational-ai-ui-pages-increment\app\(dashboard)\settings\billing`    | `D:\SaaS Project\trading-alerts-saas-public\seed-code\trading-conversational-ai-ui-pages-increment\app\(dashboard)\settings\billing\page.tsx`    |
| **Privacy & Consent**<br>Data sharing preferences, telemetry, export   | `/settings/privacy`    | `page.tsx` | `app\(dashboard)\settings\privacy`    | `D:\SaaS Project\trading-alerts-saas-public\seed-code\trading-conversational-ai-ui-pages-increment\app\(dashboard)\settings\privacy`    | `D:\SaaS Project\trading-alerts-saas-public\seed-code\trading-conversational-ai-ui-pages-increment\app\(dashboard)\settings\privacy\page.tsx`    |
| **Language & Regional**<br>12 Languages, Session Timezones, Currencies | `/settings/language`   | `page.tsx` | `app\(dashboard)\settings\language`   | `D:\SaaS Project\trading-alerts-saas-public\seed-code\trading-conversational-ai-ui-pages-increment\app\(dashboard)\settings\language`   | `D:\SaaS Project\trading-alerts-saas-public\seed-code\trading-conversational-ai-ui-pages-increment\app\(dashboard)\settings\language\page.tsx`   |
| **Help & Support**<br>Support tickets, FAQ accordions, documentation   | `/settings/help`       | `page.tsx` | `app\(dashboard)\settings\help`       | `D:\SaaS Project\trading-alerts-saas-public\seed-code\trading-conversational-ai-ui-pages-increment\app\(dashboard)\settings\help`       | `D:\SaaS Project\trading-alerts-saas-public\seed-code\trading-conversational-ai-ui-pages-increment\app\(dashboard)\settings\help\page.tsx`       |
| **Terms & Disclosures**<br>SLA terms, risk notices, legal disclosures  | `/settings/terms`      | `page.tsx` | `app\(dashboard)\settings\terms`      | `D:\SaaS Project\trading-alerts-saas-public\seed-code\trading-conversational-ai-ui-pages-increment\app\(dashboard)\settings\terms`      | `D:\SaaS Project\trading-alerts-saas-public\seed-code\trading-conversational-ai-ui-pages-increment\app\(dashboard)\settings\terms\page.tsx`      |
| **Account Management**<br>Deactivation, 7-day deletion grace period    | `/settings/account`    | `page.tsx` | `app\(dashboard)\settings\account`    | `D:\SaaS Project\trading-alerts-saas-public\seed-code\trading-conversational-ai-ui-pages-increment\app\(dashboard)\settings\account`    | `D:\SaaS Project\trading-alerts-saas-public\seed-code\trading-conversational-ai-ui-pages-increment\app\(dashboard)\settings\account\page.tsx`    |

---

## 5. 💳 Subscriptions & Checkout Suite

| Page Name & Purpose                                              | Route URI   | Filename   | Relative Directory Path | Absolute Directory Path                                                                                          | Absolute File Path                                                                                                        |
| :--------------------------------------------------------------- | :---------- | :--------- | :---------------------- | :--------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------ |
| **Pricing & Plans**<br>Free vs Pro matrix, tier selection        | `/pricing`  | `page.tsx` | `app\pricing`           | `D:\SaaS Project\trading-alerts-saas-public\seed-code\trading-conversational-ai-ui-pages-increment\app\pricing`  | `D:\SaaS Project\trading-alerts-saas-public\seed-code\trading-conversational-ai-ui-pages-increment\app\pricing\page.tsx`  |
| **Checkout & Payments**<br>Multi-currency checkout (dLocal & UK) | `/checkout` | `page.tsx` | `app\checkout`          | `D:\SaaS Project\trading-alerts-saas-public\seed-code\trading-conversational-ai-ui-pages-increment\app\checkout` | `D:\SaaS Project\trading-alerts-saas-public\seed-code\trading-conversational-ai-ui-pages-increment\app\checkout\page.tsx` |

---

## 6. 🛡️ Admin Management Control Suite

| Page Name & Purpose                                                     | Route URI             | Filename   | Relative Directory Path  | Absolute Directory Path                                                                                                    | Absolute File Path                                                                                                                  |
| :---------------------------------------------------------------------- | :-------------------- | :--------- | :----------------------- | :------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------- |
| **Admin Overview**<br>MRR metrics, active users, system health          | `/admin`              | `page.tsx` | `app\admin`              | `D:\SaaS Project\trading-alerts-saas-public\seed-code\trading-conversational-ai-ui-pages-increment\app\admin`              | `D:\SaaS Project\trading-alerts-saas-public\seed-code\trading-conversational-ai-ui-pages-increment\app\admin\page.tsx`              |
| **Admin Login Gatekeeper**<br>Protected superuser login gate            | `/admin/login`        | `page.tsx` | `app\admin\login`        | `D:\SaaS Project\trading-alerts-saas-public\seed-code\trading-conversational-ai-ui-pages-increment\app\admin\login`        | `D:\SaaS Project\trading-alerts-saas-public\seed-code\trading-conversational-ai-ui-pages-increment\app\admin\login\page.tsx`        |
| **User Administration**<br>User account table, tier overrides, ban      | `/admin/users`        | `page.tsx` | `app\admin\users`        | `D:\SaaS Project\trading-alerts-saas-public\seed-code\trading-conversational-ai-ui-pages-increment\app\admin\users`        | `D:\SaaS Project\trading-alerts-saas-public\seed-code\trading-conversational-ai-ui-pages-increment\app\admin\users\page.tsx`        |
| **Disbursement Manager**<br>Affiliate commission payouts reconciliation | `/admin/disbursement` | `page.tsx` | `app\admin\disbursement` | `D:\SaaS Project\trading-alerts-saas-public\seed-code\trading-conversational-ai-ui-pages-increment\app\admin\disbursement` | `D:\SaaS Project\trading-alerts-saas-public\seed-code\trading-conversational-ai-ui-pages-increment\app\admin\disbursement\page.tsx` |
| **Fraud & Risk Monitor**<br>Anomaly detection logs & Sybil alerts       | `/admin/fraud-alerts` | `page.tsx` | `app\admin\fraud-alerts` | `D:\SaaS Project\trading-alerts-saas-public\seed-code\trading-conversational-ai-ui-pages-increment\app\admin\fraud-alerts` | `D:\SaaS Project\trading-alerts-saas-public\seed-code\trading-conversational-ai-ui-pages-increment\app\admin\fraud-alerts\page.tsx` |

---

## 7. 🤝 Partner Affiliate Portal

| Page Name & Purpose                                                   | Route URI                    | Filename   | Relative Directory Path         | Absolute Directory Path                                                                                                           | Absolute File Path                                                                                                                         |
| :-------------------------------------------------------------------- | :--------------------------- | :--------- | :------------------------------ | :-------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------- |
| **Affiliate Dashboard**<br>Referral link generator, metrics, earnings | `/affiliate/dashboard`       | `page.tsx` | `app\affiliate\dashboard`       | `D:\SaaS Project\trading-alerts-saas-public\seed-code\trading-conversational-ai-ui-pages-increment\app\affiliate\dashboard`       | `D:\SaaS Project\trading-alerts-saas-public\seed-code\trading-conversational-ai-ui-pages-increment\app\affiliate\dashboard\page.tsx`       |
| **Affiliate Registration**<br>Partner application onboarding form     | `/affiliate/register`        | `page.tsx` | `app\affiliate\register`        | `D:\SaaS Project\trading-alerts-saas-public\seed-code\trading-conversational-ai-ui-pages-increment\app\affiliate\register`        | `D:\SaaS Project\trading-alerts-saas-public\seed-code\trading-conversational-ai-ui-pages-increment\app\affiliate\register\page.tsx`        |
| **Affiliate Payout Settings**<br>Bank, wire, and crypto payout setup  | `/affiliate/settings/payout` | `page.tsx` | `app\affiliate\settings\payout` | `D:\SaaS Project\trading-alerts-saas-public\seed-code\trading-conversational-ai-ui-pages-increment\app\affiliate\settings\payout` | `D:\SaaS Project\trading-alerts-saas-public\seed-code\trading-conversational-ai-ui-pages-increment\app\affiliate\settings\payout\page.tsx` |

---

## 8. 🚨 System & Error Pages

| Page Name & Purpose                               | Route URI           | Filename        | Relative Directory Path | Absolute Directory Path                                                                                 | Absolute File Path                                                                                                    |
| :------------------------------------------------ | :------------------ | :-------------- | :---------------------- | :------------------------------------------------------------------------------------------------------ | :-------------------------------------------------------------------------------------------------------------------- |
| **404 Page Not Found**<br>Styled 404 error screen | `/_not-found` (404) | `not-found.tsx` | `app`                   | `D:\SaaS Project\trading-alerts-saas-public\seed-code\trading-conversational-ai-ui-pages-increment\app` | `D:\SaaS Project\trading-alerts-saas-public\seed-code\trading-conversational-ai-ui-pages-increment\app\not-found.tsx` |

---

## 🏗️ Root & Layout Files

| File Type                   | Route Scope            | Filename        | Relative Path                         | Absolute File Path                                                                                                                      |
| :-------------------------- | :--------------------- | :-------------- | :------------------------------------ | :-------------------------------------------------------------------------------------------------------------------------------------- |
| **Root Application Layout** | Global (all pages)     | `layout.tsx`    | `app\layout.tsx`                      | `D:\SaaS Project\trading-alerts-saas-public\seed-code\trading-conversational-ai-ui-pages-increment\app\layout.tsx`                      |
| **Settings Sub-Layout**     | `/settings/*`          | `layout.tsx`    | `app\(dashboard)\settings\layout.tsx` | `D:\SaaS Project\trading-alerts-saas-public\seed-code\trading-conversational-ai-ui-pages-increment\app\(dashboard)\settings\layout.tsx` |
| **Root Providers**          | Global Client Contexts | `providers.tsx` | `app\providers.tsx`                   | `D:\SaaS Project\trading-alerts-saas-public\seed-code\trading-conversational-ai-ui-pages-increment\app\providers.tsx`                   |
| **Routing Middleware**      | Global Edge Middleware | `middleware.ts` | `middleware.ts`                       | `D:\SaaS Project\trading-alerts-saas-public\seed-code\trading-conversational-ai-ui-pages-increment\middleware.ts`                       |
