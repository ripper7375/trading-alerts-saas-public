# DavinTrade SaaS — Complete 31-Page & Route Inventory

> **Application Base Location**: `D:\SaaS Project\trading-alerts-saas-public\seed-code\trading-conversational-ai-ui\`  
> **Development Server URL**: `http://localhost:3009/`  
> **Framework & Engine**: Next.js 16.3.3 (Turbopack) | React 19 | TailwindCSS  
> **i18n & Regional Engine**: Native V8 `Intl` API + Centralized `<T>` Component Propagation

---

## 1. 📊 Main Quantitative Terminal & Alert Engine (5 Pages)

|  #  | Route URI                          | Page Name / Functional Description                                                                                                    |    i18n & Regional Status     |
| :-: | :--------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------ | :---------------------------: |
|  1  | `http://localhost:3009/`           | **PRO Tier Main AI Analyst Terminal**<br>4-Panel Interactive Workbench (Live Chart, AI Multi-Model Chat, Market Comments, Order Card) | ✅ Verified (100% Translated) |
|  2  | `http://localhost:3009/free`       | **FREE Tier AI Analyst Terminal**<br>3-Panel Bench (Read-Only History, Live M5/M15 XAUUSD Chart, Upgrade CTAs)                        | ✅ Verified (100% Translated) |
|  3  | `http://localhost:3009/dashboard`  | **Main User Dashboard**<br>System Overview, Quick Account Metrics, Live Tick Activity Stream                                          | ✅ Verified (100% Translated) |
|  4  | `http://localhost:3009/alerts`     | **Real-Time Alert Rules Manager**<br>Server-Side Price Breach & Line Alert Table, Rule Controls, Active Toggles                       | ✅ Verified (100% Translated) |
|  5  | `http://localhost:3009/alerts/new` | **Create New Alert Rule Form**<br>Custom Threshold & Drawn Line Rule Builder (500ms Evaluation)                                       | ✅ Verified (100% Translated) |

---

## 2. ⚙️ Account & Terminal Settings Suite (10 Pages)

|  #  | Route URI                                   | Page Name / Functional Description                                                                                                |    i18n & Regional Status     |
| :-: | :------------------------------------------ | :-------------------------------------------------------------------------------------------------------------------------------- | :---------------------------: |
|  6  | `http://localhost:3009/settings`            | **Settings Main Overview / Default Redirect**                                                                                     | ✅ Verified (100% Translated) |
|  7  | `http://localhost:3009/settings/profile`    | **Account Profile Settings**<br>Display Name, Primary Email, Avatar Customization, Trading Experience Level                       | ✅ Verified (100% Translated) |
|  8  | `http://localhost:3009/settings/appearance` | **Appearance & Theme Settings**<br>Dark Terminal Theme, Accent Highlights, Candlestick Up/Down Colors, Grid Opacity               | ✅ Verified (100% Translated) |
|  9  | `http://localhost:3009/settings/security`   | **Security & 2FA Settings**<br>Password Reset, TOTP Two-Factor Authentication, Active Session Revocation                          | ✅ Verified (100% Translated) |
| 10  | `http://localhost:3009/settings/billing`    | **Billing & Invoices**<br>Subscription Plan Overview, Payment Method Management, Historical Invoices                              | ✅ Verified (100% Translated) |
| 11  | `http://localhost:3009/settings/privacy`    | **Privacy & Data Preferences**<br>Data Export, Analytics Consent Toggles, Third-Party Privacy Controls                            | ✅ Verified (100% Translated) |
| 12  | `http://localhost:3009/settings/language`   | **Language, Timezone & Regional Formats**<br>12 Languages, Session Timezone Clocks (GMT/BST, ICT, IST), 10 dLocal & UK Currencies | ✅ Verified (100% Translated) |
| 13  | `http://localhost:3009/settings/help`       | **Help Center & Technical Support**<br>FAQs Accordion, Support Quick Links, Technical Support Ticket Form                         | ✅ Verified (100% Translated) |
| 14  | `http://localhost:3009/settings/terms`      | **Terms, Disclosures & Legal Notices**<br>Financial Risk Disclaimers, Quantitative SLA Terms, Privacy Disclosures                 | ✅ Verified (100% Translated) |
| 15  | `http://localhost:3009/settings/account`    | **Account & Deletion Grace Period**<br>Account Deactivation, 7-Day Grace Period Account Deletion Request                          | ✅ Verified (100% Translated) |

---

## 3. 💳 Subscriptions & Checkout Suite (2 Pages)

|  #  | Route URI                        | Page Name / Functional Description                                                                            |    i18n & Regional Status     |
| :-: | :------------------------------- | :------------------------------------------------------------------------------------------------------------ | :---------------------------: |
| 16  | `http://localhost:3009/pricing`  | **SaaS Pricing & Feature Matrix**<br>FREE vs PRO Tier Feature Comparison, Tier Switcher, Upgrade Buttons      | ✅ Verified (100% Translated) |
| 17  | `http://localhost:3009/checkout` | **Multi-Currency Local Checkout**<br>dLocal Emerging Markets (₹, ₫, ฿, ₦, Rs, Rp, R, ₺) & UK (£) Payment Form | ✅ Verified (100% Translated) |

---

## 4. 🛡️ Admin Management Control Suite (5 Pages)

|  #  | Route URI                                  | Page Name / Functional Description                                                                        |    i18n & Regional Status     |
| :-: | :----------------------------------------- | :-------------------------------------------------------------------------------------------------------- | :---------------------------: |
| 18  | `http://localhost:3009/admin`              | **Admin Main Control Overview**<br>Monthly Recurring Revenue (MRR), Active PRO Subscribers, System Health | ✅ Verified (100% Translated) |
| 19  | `http://localhost:3009/admin/login`        | **Admin Superuser Gatekeeper Login**<br>Protected Superuser Authentication Gate                           | ✅ Verified (100% Translated) |
| 20  | `http://localhost:3009/admin/users`        | **User Administration Table**<br>User Account Search, Tier Override, Account Suspension Controls          | ✅ Verified (100% Translated) |
| 21  | `http://localhost:3009/admin/disbursement` | **Payout Disbursement Reconciliation**<br>Affiliate Commission Payout Approvals & Disbursement Logs       | ✅ Verified (100% Translated) |
| 22  | `http://localhost:3009/admin/fraud-alerts` | **Fraud & Risk Monitor**<br>Automated Anomaly Detection Logs, Sybil Attack Alerts, Risk Scoring           | ✅ Verified (100% Translated) |

---

## 5. 🤝 Partner Affiliate Portal (3 Pages)

|  #  | Route URI                                         | Page Name / Functional Description                                                                      |    i18n & Regional Status     |
| :-: | :------------------------------------------------ | :------------------------------------------------------------------------------------------------------ | :---------------------------: |
| 23  | `http://localhost:3009/affiliate/dashboard`       | **Affiliate Partner Dashboard**<br>Unique Referral Link Generator, Conversion Metrics, Earnings History | ✅ Verified (100% Translated) |
| 24  | `http://localhost:3009/affiliate/register`        | **Partner Application Form**<br>Affiliate Partner Onboarding Application Form                           | ✅ Verified (100% Translated) |
| 25  | `http://localhost:3009/affiliate/settings/payout` | **Affiliate Payout Settings**<br>Bank Account, Wire & Crypto Wallet Payout Preferences                  | ✅ Verified (100% Translated) |

---

## 6. 🔑 Authentication & Security Suite (6 Pages)

|  #  | Route URI                                 | Page Name / Functional Description                                                  |    i18n & Regional Status     |
| :-: | :---------------------------------------- | :---------------------------------------------------------------------------------- | :---------------------------: |
| 26  | `http://localhost:3009/login`             | **User Sign In**<br>Standard Email & Password Login Form                            | ✅ Verified (100% Translated) |
| 27  | `http://localhost:3009/register`          | **User Sign Up & Tier Onboarding**<br>Account Registration Form with Plan Selection | ✅ Verified (100% Translated) |
| 28  | `http://localhost:3009/forgot-password`   | **Password Recovery Request**<br>Password Reset Email Dispatch Form                 | ✅ Verified (100% Translated) |
| 29  | `http://localhost:3009/verify-2fa`        | **Two-Factor OTP Verification**<br>TOTP Authenticator App 6-Digit Code Input Form   | ✅ Verified (100% Translated) |
| 30  | `http://localhost:3009/_not-found`        | **Custom 404 Error Page**<br>Styled 404 Page Not Found Screen                       | ✅ Verified (100% Translated) |
| 31  | `http://localhost:3009/settings/language` | _(Duplicate Route Reference in App Router Build Registry)_                          | ✅ Verified (100% Translated) |

---

## 🌐 Supported Regional Formats & Locales

- **Primary Tier-1 Target Market**: United Kingdom 🇬🇧 (`en-GB`, `Europe/London`, `GBP £`, `DD/MM/YYYY`)
- **dLocal Supported Emerging Markets (8 Countries)**:
  1. 🇮🇳 **India** (`INR` `₹`)
  2. 🇳🇬 **Nigeria** (`NGN` `₦`)
  3. 🇵🇰 **Pakistan** (`PKR` `Rs`)
  4. 🇻🇳 **Vietnam** (`VND` `₫`)
  5. 🇮🇩 **Indonesia** (`IDR` `Rp`)
  6. 🇹🇭 **Thailand** (`THB` `฿`)
  7. 🇿🇦 **South Africa** (`ZAR` `R`)
  8. 🇹🇷 **Turkey** (`TRY` `₺`)
- **Global Locales**: United States 🇺🇸 (`USD` `$`), Eurozone 🇪🇺 (`EUR` `€`), Japan 🇯🇵 (`JPY` `¥`)
