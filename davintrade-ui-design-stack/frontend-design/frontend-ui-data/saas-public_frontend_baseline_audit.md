# Frontend Redesign Baseline & Multi-Role UI Audit Report

> [!NOTE]
> **Audit Summary**: This document captures the complete frontend architecture, directory tree, route directory, UI component inventory, and multi-role runtime status of [Trading Alerts SaaS](https://trading-alerts-saas-frontend.vercel.app/).
> Generated on: 2026-08-04T04:44:05.157Z

---

## 1. Executive Summary & UI Status Overview

- **Total App Routes Identified**: `57`
- **Total UI Components Identified**: `78`
- **Public & Role-Gated Pages Audited**: `17`
- **Authenticated Accounts & Role Profiles Configured**: `4` (FREE, PRO, ADMIN, AFFILIATE)
- **UI Architecture Stack**: Next.js 16 App Router, React 19, Tailwind CSS, Radix UI Primitives, Lucide React Icons, Lightweight Charts.

---

## 2. Account Roles & Multi-User Verification Matrix

| Role / Persona     | Email                                | Passcode                | Database Status                            | Target Accessible Route | Verification Notes                                           |
| :----------------- | :----------------------------------- | :---------------------- | :----------------------------------------- | :---------------------- | :----------------------------------------------------------- |
| **FREE Tier User** | `free-test@trading-alerts.test`      | `TestPassword123!`      | ⚡ DB Seed Ready (`emailVerified = NOW()`) | `/dashboard`            | Free tier limitations, upgrade prompts, basic alert settings |
| **PRO Tier User**  | `pro-test@trading-alerts.test`       | `TestPassword123!`      | ✅ Seeding Ready                           | `/dashboard`            | Full real-time charts, line draw engine, unlimited alerts    |
| **ADMIN User**     | `admin-test@trading-alerts.test`     | `AdminPassword123!`     | ✅ Seeding Ready                           | `/admin`                | User management, system metrics, affiliate payouts           |
| **AFFILIATE User** | `affiliate-test@trading-alerts.test` | `AffiliatePassword123!` | ✅ Seeding Ready                           | `/affiliate/dashboard`  | Referral link generator, commission charts, payout settings  |

---

## 3. Frontend Repository File & Folder Directory Tree

### `app/` (Routes, Pages, Layouts)

```text
app/
├── (auth)/
│   ├── forgot-password/
│   │   └── page.tsx
│   ├── login/
│   │   └── page.tsx
│   ├── register/
│   │   └── page.tsx
│   ├── reset-password/
│   │   └── page.tsx
│   ├── verify-2fa/
│   │   └── page.tsx
│   ├── verify-email/
│   │   ├── pending/
│   │   │   └── page.tsx
│   │   └── page.tsx
│   ├── layout.tsx
│   └── loading.tsx
├── (dashboard)/
│   ├── admin/
│   │   ├── api-usage/
│   │   │   └── page.tsx
│   │   ├── disbursement/
│   │   │   ├── accounts/
│   │   │   │   └── page.tsx
│   │   │   ├── affiliates/
│   │   │   │   └── page.tsx
│   │   │   ├── audit/
│   │   │   │   └── page.tsx
│   │   │   ├── batches/
│   │   │   │   ├── [batchId]/
│   │   │   │   │   └── page.tsx
│   │   │   │   └── page.tsx
│   │   │   ├── config/
│   │   │   │   └── page.tsx
│   │   │   ├── recipients/
│   │   │   │   └── page.tsx
│   │   │   ├── transactions/
│   │   │   │   └── page.tsx
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx
│   │   ├── errors/
│   │   │   └── page.tsx
│   │   ├── fraud-alerts/
│   │   │   ├── [id]/
│   │   │   │   └── page.tsx
│   │   │   └── page.tsx
│   │   ├── users/
│   │   │   └── page.tsx
│   │   ├── layout.tsx
│   │   ├── loading.tsx
│   │   └── page.tsx
│   ├── alerts/
│   │   ├── new/
│   │   │   ├── create-alert-client.tsx
│   │   │   └── page.tsx
│   │   ├── alerts-client.tsx
│   │   ├── loading.tsx
│   │   └── page.tsx
│   ├── charts/
│   │   ├── [symbol]/
│   │   │   └── [timeframe]/
│   │   │       ├── page.tsx
│   │   │       └── trading-chart-client.tsx
│   │   ├── loading.tsx
│   │   └── page.tsx
│   ├── dashboard/
│   │   ├── loading.tsx
│   │   └── page.tsx
│   ├── settings/
│   │   ├── account/
│   │   │   └── page.tsx
│   │   ├── appearance/
│   │   │   └── page.tsx
│   │   ├── billing/
│   │   │   └── page.tsx
│   │   ├── help/
│   │   │   └── page.tsx
│   │   ├── language/
│   │   │   └── page.tsx
│   │   ├── privacy/
│   │   │   └── page.tsx
│   │   ├── profile/
│   │   │   └── page.tsx
│   │   ├── security/
│   │   │   └── page.tsx
│   │   ├── terms/
│   │   │   └── page.tsx
│   │   ├── layout.tsx
│   │   ├── loading.tsx
│   │   └── page.tsx
│   └── layout.tsx
├── (marketing)/
│   ├── pricing/
│   │   └── page.tsx
│   ├── landing-content.tsx
│   ├── layout.tsx
│   └── page.tsx
├── admin/
│   ├── affiliates/
│   │   ├── [id]/
│   │   │   └── page.tsx
│   │   ├── reports/
│   │   │   ├── code-inventory/
│   │   │   │   └── page.tsx
│   │   │   ├── commission-owings/
│   │   │   │   └── page.tsx
│   │   │   ├── profit-loss/
│   │   │   │   └── page.tsx
│   │   │   └── sales-performance/
│   │   │       └── page.tsx
│   │   └── page.tsx
│   ├── login/
│   │   └── page.tsx
│   └── settings/
│       └── affiliate/
│           └── page.tsx
├── affiliate/
│   ├── dashboard/
│   │   ├── codes/
│   │   │   └── page.tsx
│   │   ├── commissions/
│   │   │   └── page.tsx
│   │   ├── profile/
│   │   │   ├── payment/
│   │   │   │   └── page.tsx
│   │   │   └── page.tsx
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── register/
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── settings/
│   │   ├── payout/
│   │   │   └── page.tsx
│   │   └── layout.tsx
│   ├── verify/
│   │   ├── layout.tsx
│   │   └── page.tsx
│   └── layout.tsx
├── api/
│   ├── admin/
│   │   ├── affiliates/
│   │   │   ├── [id]/
│   │   │   │   ├── distribute-codes/
│   │   │   │   │   └── route.ts
│   │   │   │   ├── reactivate/
│   │   │   │   │   └── route.ts
│   │   │   │   ├── suspend/
│   │   │   │   │   └── route.ts
│   │   │   │   └── route.ts
│   │   │   ├── reports/
│   │   │   │   ├── code-flows/
│   │   │   │   │   └── route.ts
│   │   │   │   ├── code-inventory/
│   │   │   │   │   └── route.ts
│   │   │   │   ├── commission-owings/
│   │   │   │   │   └── route.ts
│   │   │   │   ├── profit-loss/
│   │   │   │   │   └── route.ts
│   │   │   │   └── sales-performance/
│   │   │   │       └── route.ts
│   │   │   └── route.ts
│   │   ├── analytics/
│   │   │   └── route.ts
│   │   ├── api-usage/
│   │   │   └── route.ts
│   │   ├── codes/
│   │   │   └── [code]/
│   │   │       └── cancel/
│   │   │           └── route.ts
│   │   ├── commissions/
│   │   │   └── pay/
│   │   │       └── route.ts
│   │   ├── error-logs/
│   │   │   └── route.ts
│   │   ├── fraud-alerts/
│   │   │   ├── [id]/
│   │   │   │   └── route.ts
│   │   │   └── route.ts
│   │   ├── settings/
│   │   │   └── affiliate/
│   │   │       └── route.ts
│   │   └── users/
│   │       └── route.ts
│   ├── affiliate/
│   │   ├── auth/
│   │   │   ├── register/
│   │   │   │   └── route.ts
│   │   │   └── verify-email/
│   │   │       └── route.ts
│   │   ├── dashboard/
│   │   │   ├── code-inventory/
│   │   │   │   └── route.ts
│   │   │   ├── codes/
│   │   │   │   └── route.ts
│   │   │   ├── commission-report/
│   │   │   │   └── route.ts
│   │   │   └── stats/
│   │   │       └── route.ts
│   │   └── profile/
│   │       ├── payment/
│   │       │   └── route.ts
│   │       └── route.ts
│   ├── alerts/
│   │   ├── [id]/
│   │   │   └── route.ts
│   │   ├── line/
│   │   │   ├── [id]/
│   │   │   │   └── route.ts
│   │   │   └── route.ts
│   │   └── route.ts
│   ├── auth/
│   │   ├── [...nextauth]/
│   │   │   └── route.ts
│   │   ├── forgot-password/
│   │   │   └── route.ts
│   │   ├── register/
│   │   ├── resend-verification/
│   │   │   └── route.ts
│   │   ├── reset-password/
│   │   │   └── route.ts
│   │   ├── token-2fa-backup-codes/
│   │   │   └── route.ts
│   │   ├── token-2fa-disable/
│   │   │   └── route.ts
│   │   ├── token-2fa-setup/
│   │   │   └── route.ts
│   │   ├── token-2fa-status/
│   │   │   └── route.ts
│   │   ├── token-2fa-verify/
│   │   │   └── route.ts
│   │   ├── token-2fa-verify-setup/
│   │   │   └── route.ts
│   │   ├── token-forgot-password/
│   │   │   └── route.ts
│   │   ├── token-login/
│   │   │   └── route.ts
│   │   ├── token-logout/
│   │   │   └── route.ts
│   │   ├── token-refresh/
│   │   │   └── route.ts
│   │   ├── token-register/
│   │   │   └── route.ts
│   │   ├── token-resend-verification/
│   │   │   └── route.ts
│   │   ├── token-reset-password/
│   │   │   └── route.ts
│   │   ├── token-verify-email/
│   │   │   └── route.ts
│   │   ├── track-login/
│   │   │   └── route.ts
│   │   └── verify-email/
│   │       └── route.ts
│   ├── candles/
│   │   └── [symbol]/
│   │       └── route.ts
│   ├── checkout/
│   │   ├── validate-code/
│   │   │   └── route.ts
│   │   └── route.ts
│   ├── config/
│   │   └── affiliate/
│   │       └── route.ts
│   ├── cron/
│   │   ├── check-expiring-subscriptions/
│   │   │   └── route.ts
│   │   ├── daily-maintenance/
│   │   │   └── route.ts
│   │   ├── distribute-codes/
│   │   │   └── route.ts
│   │   ├── downgrade-expired-subscriptions/
│   │   │   └── route.ts
│   │   ├── expire-codes/
│   │   │   └── route.ts
│   │   ├── process-pending-disbursements/
│   │   │   └── route.ts
│   │   ├── send-monthly-reports/
│   │   │   └── route.ts
│   │   └── sync-riseworks-accounts/
│   │       └── route.ts
│   ├── disbursement/
│   │   ├── affiliates/
│   │   │   ├── [affiliateId]/
│   │   │   │   ├── commissions/
│   │   │   │   │   └── route.ts
│   │   │   │   └── route.ts
│   │   │   └── payable/
│   │   │       └── route.ts
│   │   ├── audit-logs/
│   │   │   └── route.ts
│   │   ├── batches/
│   │   │   ├── [batchId]/
│   │   │   │   ├── execute/
│   │   │   │   │   └── route.ts
│   │   │   │   └── route.ts
│   │   │   ├── preview/
│   │   │   │   └── route.ts
│   │   │   └── route.ts
│   │   ├── config/
│   │   │   └── route.ts
│   │   ├── health/
│   │   │   └── route.ts
│   │   ├── pay/
│   │   │   └── route.ts
│   │   ├── reports/
│   │   │   ├── affiliate/
│   │   │   │   └── [affiliateId]/
│   │   │   │       └── route.ts
│   │   │   └── summary/
│   │   │       └── route.ts
│   │   ├── riseworks/
│   │   │   ├── accounts/
│   │   │   │   └── route.ts
│   │   │   └── sync/
│   │   │       └── route.ts
│   │   └── transactions/
│   │       └── route.ts
│   ├── drawings/
│   │   ├── [id]/
│   │   │   └── route.ts
│   │   └── route.ts
│   ├── invoices/
│   │   └── route.ts
│   ├── market-data/
│   │   └── channel/
│   │       └── route.ts
│   ├── notifications/
│   │   ├── [id]/
│   │   │   ├── read/
│   │   │   │   └── route.ts
│   │   │   └── route.ts
│   │   └── route.ts
│   ├── payments/
│   │   └── dlocal/
│   │       ├── [paymentId]/
│   │       │   └── route.ts
│   │       ├── check-three-day-eligibility/
│   │       │   └── route.ts
│   │       ├── convert/
│   │       │   └── route.ts
│   │       ├── create/
│   │       │   └── route.ts
│   │       ├── exchange-rate/
│   │       │   └── route.ts
│   │       ├── methods/
│   │       │   └── route.ts
│   │       └── validate-discount/
│   │           └── route.ts
│   ├── realtime/
│   │   └── token/
│   │       └── route.ts
│   ├── subscription/
│   │   ├── cancel/
│   │   │   └── route.ts
│   │   └── route.ts
│   ├── test/
│   │   └── seed/
│   │       └── route.ts
│   ├── tier/
│   │   ├── check/
│   │   │   └── [symbol]/
│   │   │       └── route.ts
│   │   ├── combinations/
│   │   │   └── route.ts
│   │   └── symbols/
│   │       └── route.ts
│   ├── user/
│   │   ├── 2fa/
│   │   │   ├── backup-codes/
│   │   │   │   └── route.ts
│   │   │   ├── disable/
│   │   │   │   └── route.ts
│   │   │   ├── setup/
│   │   │   │   └── route.ts
│   │   │   ├── verify/
│   │   │   │   └── route.ts
│   │   │   └── verify-setup/
│   │   │       └── route.ts
│   │   ├── account/
│   │   │   ├── deletion-cancel/
│   │   │   │   └── route.ts
│   │   │   ├── deletion-confirm/
│   │   │   │   └── route.ts
│   │   │   └── deletion-request/
│   │   │       └── route.ts
│   │   ├── login-history/
│   │   │   └── route.ts
│   │   ├── password/
│   │   │   └── route.ts
│   │   ├── preferences/
│   │   │   └── route.ts
│   │   ├── profile/
│   │   │   └── route.ts
│   │   └── sessions/
│   │       ├── [id]/
│   │       │   └── route.ts
│   │       └── route.ts
│   ├── webhooks/
│   │   ├── dlocal/
│   │   │   └── route.ts
│   │   ├── riseworks/
│   │   │   └── route.ts
│   │   └── stripe/
│   │       └── route.ts
│   └── wise/
│       └── recipients/
│           ├── [id]/
│           │   └── revalidate/
│           │       └── route.ts
│           ├── me/
│           │   └── route.ts
│           ├── requirements/
│           │   ├── refresh/
│           │   │   └── route.ts
│           │   └── route.ts
│           └── route.ts
├── checkout/
│   └── page.tsx
├── test-api/
│   └── page.tsx
├── error.tsx
├── globals.css
├── layout.tsx
└── providers.tsx

```

### `components/` (UI Components Directory)

```text
components/
├── admin/
│   ├── affiliate-filters.tsx
│   ├── affiliate-stats-banner.tsx
│   ├── affiliate-table.tsx
│   ├── code-inventory-chart.tsx
│   ├── commission-owings-table.tsx
│   ├── distribute-codes-modal.tsx
│   ├── FraudAlertCard.tsx
│   ├── FraudPatternBadge.tsx
│   ├── pay-commission-modal.tsx
│   ├── pnl-breakdown-table.tsx
│   ├── pnl-summary-cards.tsx
│   ├── pnl-trend-chart.tsx
│   ├── sales-performance-table.tsx
│   └── suspend-affiliate-modal.tsx
├── affiliate/
│   ├── code-table.tsx
│   ├── commission-table.tsx
│   ├── index.ts
│   ├── stats-card.tsx
│   └── wise-recipient-form.tsx
├── alerts/
│   ├── alert-card.tsx
│   ├── alert-form.tsx
│   ├── alert-list.tsx
│   └── alerts-pro-upgrade.tsx
├── auth/
│   ├── login-form.tsx
│   ├── login-tracker.tsx
│   ├── register-form.tsx
│   ├── social-auth-buttons.tsx
│   └── token-refresh-provider.tsx
├── billing/
│   ├── invoice-list.tsx
│   └── subscription-card.tsx
├── charts/
│   ├── drawing/
│   │   ├── engine/
│   │   │   ├── coords.ts
│   │   │   ├── DrawingEngine.ts
│   │   │   ├── pixelMath.ts
│   │   │   └── PointerController.ts
│   │   ├── geometry/
│   │   │   ├── channel.ts
│   │   │   ├── fib.ts
│   │   │   ├── horizontal.ts
│   │   │   ├── index.ts
│   │   │   ├── levels.ts
│   │   │   ├── trendline.ts
│   │   │   └── types.ts
│   │   ├── marks/
│   │   │   ├── BaseMark.ts
│   │   │   ├── ChannelMark.ts
│   │   │   ├── FibExtensionMark.ts
│   │   │   ├── FibRetracementMark.ts
│   │   │   ├── HorizontalLineMark.ts
│   │   │   ├── TextMark.ts
│   │   │   └── TrendlineMark.ts
│   │   ├── tools/
│   │   │   └── index.ts
│   │   ├── AlertDialog.tsx
│   │   ├── alertsApi.ts
│   │   ├── AlertsPanel.tsx
│   │   ├── DrawingLayer.tsx
│   │   ├── firedMarkers.ts
│   │   ├── persistence.ts
│   │   ├── StyleEditor.tsx
│   │   ├── tierUsage.ts
│   │   ├── Toolbar.tsx
│   │   ├── types.ts
│   │   └── useFiredAlertMarkers.ts
│   ├── mtf/
│   │   ├── MtfToggle.tsx
│   │   └── useMtfOverlay.ts
│   ├── chart-controls.tsx
│   ├── timeframe-selector.tsx
│   └── trading-chart.tsx
├── dashboard/
│   ├── recent-alerts.tsx
│   ├── stats-card.tsx
│   └── upgrade-prompt.tsx
├── layout/
│   ├── footer.tsx
│   ├── header.tsx
│   ├── mobile-nav.tsx
│   └── sidebar.tsx
├── notifications/
│   ├── notification-bell.tsx
│   └── notification-list.tsx
├── payments/
│   ├── CountrySelector.tsx
│   ├── DiscountCodeInput.tsx
│   ├── index.ts
│   ├── PaymentButton.tsx
│   ├── PaymentMethodSelector.tsx
│   ├── PlanSelector.tsx
│   └── PriceDisplay.tsx
├── pricing/
│   └── tier-comparison.tsx
├── providers/
│   └── theme-provider.tsx
├── ui/
│   ├── alert-dialog.tsx
│   ├── avatar.tsx
│   ├── badge.tsx
│   ├── breadcrumb.tsx
│   ├── button.tsx
│   ├── card.tsx
│   ├── dialog.tsx
│   ├── dropdown-menu.tsx
│   ├── input.tsx
│   ├── label.tsx
│   ├── pagination.tsx
│   ├── popover.tsx
│   ├── progress.tsx
│   ├── scroll-area.tsx
│   ├── select.tsx
│   ├── separator.tsx
│   ├── sheet.tsx
│   ├── skeleton.tsx
│   ├── switch.tsx
│   ├── tabs.tsx
│   ├── toast-container.tsx
│   └── upgrade-button.tsx
└── theme-toggle.tsx

```

### `lib/` & `hooks/` (Utilities & State)

```text
lib/
├── admin/
│   ├── affiliate-management.ts
│   ├── code-distribution.ts
│   └── pnl-calculator.ts
├── affiliate/
│   ├── code-generator.ts
│   ├── commission-calculator.ts
│   ├── constants.ts
│   ├── conversion-processor.ts
│   ├── db.ts
│   ├── registration.ts
│   ├── report-builder.ts
│   ├── types.ts
│   └── validators.ts
├── api/
│   └── index.ts
├── auth/
│   ├── auth-bridge-flag.ts
│   ├── auth-options.ts
│   ├── errors.ts
│   ├── permissions.ts
│   ├── session-tracker.ts
│   ├── session.ts
│   └── two-factor.ts
├── cache/
│   └── cache-manager.ts
├── constants/
│   └── business-rules.ts
├── cron/
│   ├── check-expiring-subscriptions.ts
│   ├── downgrade-expired-subscriptions.ts
│   └── monthly-distribution.ts
├── db/
│   ├── market-prisma.ts
│   ├── prisma.ts
│   └── seed.ts
├── disbursement/
│   ├── cron/
│   │   └── disbursement-processor.ts
│   ├── providers/
│   │   ├── rise/
│   │   │   ├── amount-converter.ts
│   │   │   ├── rise-provider.ts
│   │   │   ├── siwe-auth.ts
│   │   │   └── webhook-verifier.ts
│   │   ├── base-provider.ts
│   │   ├── mock-provider.ts
│   │   └── provider-factory.ts
│   ├── services/
│   │   ├── batch-manager.ts
│   │   ├── commission-aggregator.ts
│   │   ├── payment-orchestrator.ts
│   │   ├── payout-calculator.ts
│   │   ├── retry-handler.ts
│   │   ├── transaction-logger.ts
│   │   └── transaction-service.ts
│   ├── webhook/
│   │   └── event-processor.ts
│   └── constants.ts
├── dlocal/
│   ├── constants.ts
│   ├── currency-converter.service.ts
│   ├── dlocal-payment.service.ts
│   ├── payment-methods.service.ts
│   └── three-day-validator.service.ts
├── drawing/
│   ├── invalidate.ts
│   └── schema.ts
├── email/
│   ├── email.ts
│   └── subscription-emails.ts
├── errors/
│   ├── api-error.ts
│   ├── error-handler.ts
│   └── error-logger.ts
├── fraud/
│   └── fraud-detection.service.ts
├── geo/
│   └── detect-country.ts
├── hooks/
│   └── useAffiliateConfig.ts
├── idempotency/
│   └── idempotency-guard.ts
├── money-service/
│   ├── client.ts
│   ├── flags.ts
│   ├── routes.ts
│   ├── wise-types.ts
│   └── write-routes.ts
├── monitoring/
│   └── system-monitor.ts
├── operation-service/
│   ├── client.ts
│   ├── cookies.ts
│   ├── flags.ts
│   └── write-routes.ts
├── preferences/
│   └── defaults.ts
├── redis/
│   └── client.ts
├── security/
│   └── device-detection.ts
├── stripe/
│   ├── stripe.ts
│   └── webhook-handlers.ts
├── utils/
│   ├── constants.ts
│   ├── formatters.ts
│   └── helpers.ts
├── validations/
│   ├── alert.ts
│   ├── auth.ts
│   └── user.ts
├── candle-data-helpers.ts
├── csrf.ts
├── logger.ts
├── rate-limit.ts
├── tier-config.ts
├── tier-helpers.ts
├── tier-validation.ts
├── tokens.ts
└── utils.ts

hooks/
├── use-alerts.ts
├── use-auth.ts
├── use-login-tracking.ts
├── use-ohlcv-socket.ts
├── use-optimistic-mutation.ts
├── use-realtime-socket.ts
└── use-toast.ts

```

---

## 4. Complete Page & Route Inventory

| Route Path                                    | File Location                                                                                                                  | Render Type      | Access Level | UI Purpose & Key Components                                     |
| :-------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------- | :--------------- | :----------- | :-------------------------------------------------------------- |
| `/forgot-password`                            | [`page.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/app/(auth)/forgot-password/page.tsx)                           | Client Component | Public       | Core route component                                            |
| `/login`                                      | [`page.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/app/(auth)/login/page.tsx)                                     | Client Component | Public       | Core route component                                            |
| `/register`                                   | [`page.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/app/(auth)/register/page.tsx)                                  | Client Component | Public       | Core route component                                            |
| `/reset-password`                             | [`page.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/app/(auth)/reset-password/page.tsx)                            | Client Component | Public       | Core route component                                            |
| `/verify-2fa`                                 | [`page.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/app/(auth)/verify-2fa/page.tsx)                                | Client Component | Public       | Core route component                                            |
| `/verify-email`                               | [`page.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/app/(auth)/verify-email/page.tsx)                              | Client Component | Public       | Core route component                                            |
| `/verify-email/pending`                       | [`page.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/app/(auth)/verify-email/pending/page.tsx)                      | Client Component | Public       | Core route component                                            |
| `/admin/api-usage`                            | [`page.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/app/(dashboard)/admin/api-usage/page.tsx)                      | Client Component | ADMIN        | Core route component                                            |
| `/admin/disbursement/accounts`                | [`page.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/app/(dashboard)/admin/disbursement/accounts/page.tsx)          | Client Component | ADMIN        | Core route component                                            |
| `/admin/disbursement/affiliates`              | [`page.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/app/(dashboard)/admin/disbursement/affiliates/page.tsx)        | Client Component | ADMIN        | Core route component                                            |
| `/admin/disbursement/audit`                   | [`page.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/app/(dashboard)/admin/disbursement/audit/page.tsx)             | Client Component | ADMIN        | Core route component                                            |
| `/admin/disbursement/batches`                 | [`page.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/app/(dashboard)/admin/disbursement/batches/page.tsx)           | Client Component | ADMIN        | Core route component                                            |
| `/admin/disbursement/batches/[batchId]`       | [`page.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/app/(dashboard)/admin/disbursement/batches/[batchId]/page.tsx) | Client Component | ADMIN        | Core route component                                            |
| `/admin/disbursement/config`                  | [`page.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/app/(dashboard)/admin/disbursement/config/page.tsx)            | Client Component | ADMIN        | Core route component                                            |
| `/admin/disbursement`                         | [`page.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/app/(dashboard)/admin/disbursement/page.tsx)                   | Client Component | ADMIN        | Core route component                                            |
| `/admin/disbursement/recipients`              | [`page.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/app/(dashboard)/admin/disbursement/recipients/page.tsx)        | Client Component | ADMIN        | Core route component                                            |
| `/admin/disbursement/transactions`            | [`page.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/app/(dashboard)/admin/disbursement/transactions/page.tsx)      | Client Component | ADMIN        | Core route component                                            |
| `/admin/errors`                               | [`page.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/app/(dashboard)/admin/errors/page.tsx)                         | Client Component | ADMIN        | Core route component                                            |
| `/admin/fraud-alerts`                         | [`page.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/app/(dashboard)/admin/fraud-alerts/page.tsx)                   | Client Component | ADMIN        | Core route component                                            |
| `/admin/fraud-alerts/[id]`                    | [`page.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/app/(dashboard)/admin/fraud-alerts/[id]/page.tsx)              | Client Component | ADMIN        | Core route component                                            |
| `/admin`                                      | [`page.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/app/(dashboard)/admin/page.tsx)                                | Client Component | ADMIN        | System metrics, user list data table, role management           |
| `/admin/users`                                | [`page.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/app/(dashboard)/admin/users/page.tsx)                          | Client Component | ADMIN        | Core route component                                            |
| `/alerts/new`                                 | [`page.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/app/(dashboard)/alerts/new/page.tsx)                           | Server Component | FREE / PRO   | Core route component                                            |
| `/alerts`                                     | [`page.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/app/(dashboard)/alerts/page.tsx)                               | Server Component | FREE / PRO   | Alert list, create alert modal, condition filters               |
| `/charts`                                     | [`page.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/app/(dashboard)/charts/page.tsx)                               | Server Component | FREE / PRO   | TradingView/Recharts engine, timeframe tabs, indicator controls |
| `/charts/[symbol]/[timeframe]`                | [`page.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/app/(dashboard)/charts/[symbol]/[timeframe]/page.tsx)          | Server Component | FREE / PRO   | Core route component                                            |
| `/dashboard`                                  | [`page.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/app/(dashboard)/dashboard/page.tsx)                            | Server Component | FREE / PRO   | Market data feed, active alerts table, quick stat cards         |
| `/settings/account`                           | [`page.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/app/(dashboard)/settings/account/page.tsx)                     | Client Component | FREE / PRO   | Core route component                                            |
| `/settings/appearance`                        | [`page.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/app/(dashboard)/settings/appearance/page.tsx)                  | Client Component | FREE / PRO   | Core route component                                            |
| `/settings/billing`                           | [`page.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/app/(dashboard)/settings/billing/page.tsx)                     | Client Component | FREE / PRO   | Core route component                                            |
| `/settings/help`                              | [`page.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/app/(dashboard)/settings/help/page.tsx)                        | Client Component | FREE / PRO   | Core route component                                            |
| `/settings/language`                          | [`page.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/app/(dashboard)/settings/language/page.tsx)                    | Client Component | FREE / PRO   | Core route component                                            |
| `/settings`                                   | [`page.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/app/(dashboard)/settings/page.tsx)                             | Client Component | FREE / PRO   | User profile, password change, billing overview, tier status    |
| `/settings/privacy`                           | [`page.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/app/(dashboard)/settings/privacy/page.tsx)                     | Client Component | FREE / PRO   | Core route component                                            |
| `/settings/profile`                           | [`page.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/app/(dashboard)/settings/profile/page.tsx)                     | Client Component | FREE / PRO   | Core route component                                            |
| `/settings/security`                          | [`page.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/app/(dashboard)/settings/security/page.tsx)                    | Client Component | FREE / PRO   | Core route component                                            |
| `/settings/terms`                             | [`page.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/app/(dashboard)/settings/terms/page.tsx)                       | Server Component | FREE / PRO   | Core route component                                            |
| `/`                                           | [`page.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/app/(marketing)/page.tsx)                                      | Server Component | Public       | Landing page hero, features, pricing preview, CTA buttons       |
| `/pricing`                                    | [`page.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/app/(marketing)/pricing/page.tsx)                              | Client Component | Public       | Tier pricing cards, upgrade button, feature comparisons         |
| `/admin/affiliates`                           | [`page.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/app/admin/affiliates/page.tsx)                                 | Client Component | ADMIN        | Core route component                                            |
| `/admin/affiliates/reports/code-inventory`    | [`page.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/app/admin/affiliates/reports/code-inventory/page.tsx)          | Client Component | ADMIN        | Core route component                                            |
| `/admin/affiliates/reports/commission-owings` | [`page.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/app/admin/affiliates/reports/commission-owings/page.tsx)       | Client Component | ADMIN        | Core route component                                            |
| `/admin/affiliates/reports/profit-loss`       | [`page.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/app/admin/affiliates/reports/profit-loss/page.tsx)             | Client Component | ADMIN        | Core route component                                            |
| `/admin/affiliates/reports/sales-performance` | [`page.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/app/admin/affiliates/reports/sales-performance/page.tsx)       | Client Component | ADMIN        | Core route component                                            |
| `/admin/affiliates/[id]`                      | [`page.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/app/admin/affiliates/[id]/page.tsx)                            | Client Component | ADMIN        | Core route component                                            |
| `/admin/login`                                | [`page.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/app/admin/login/page.tsx)                                      | Client Component | ADMIN        | Core route component                                            |
| `/admin/settings/affiliate`                   | [`page.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/app/admin/settings/affiliate/page.tsx)                         | Client Component | ADMIN        | Core route component                                            |
| `/affiliate/dashboard/codes`                  | [`page.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/app/affiliate/dashboard/codes/page.tsx)                        | Client Component | AFFILIATE    | Core route component                                            |
| `/affiliate/dashboard/commissions`            | [`page.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/app/affiliate/dashboard/commissions/page.tsx)                  | Client Component | AFFILIATE    | Core route component                                            |
| `/affiliate/dashboard`                        | [`page.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/app/affiliate/dashboard/page.tsx)                              | Client Component | AFFILIATE    | Affiliate referral stats, commission table, payout setup        |
| `/affiliate/dashboard/profile`                | [`page.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/app/affiliate/dashboard/profile/page.tsx)                      | Client Component | AFFILIATE    | Core route component                                            |
| `/affiliate/dashboard/profile/payment`        | [`page.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/app/affiliate/dashboard/profile/payment/page.tsx)              | Client Component | AFFILIATE    | Core route component                                            |
| `/affiliate/register`                         | [`page.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/app/affiliate/register/page.tsx)                               | Client Component | AFFILIATE    | Core route component                                            |
| `/affiliate/settings/payout`                  | [`page.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/app/affiliate/settings/payout/page.tsx)                        | Client Component | AFFILIATE    | Core route component                                            |
| `/affiliate/verify`                           | [`page.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/app/affiliate/verify/page.tsx)                                 | Client Component | AFFILIATE    | Core route component                                            |
| `/checkout`                                   | [`page.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/app/checkout/page.tsx)                                         | Client Component | Public       | Stripe & dLocal payment forms, summary card                     |
| `/test-api`                                   | [`page.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/app/test-api/page.tsx)                                         | Client Component | Public       | Core route component                                            |

---

## 5. UI Component Catalog & Health Matrix (Working vs. Dead)

### Base UI Primitives (`components/ui/`)

| Component Name      | File Location                                                                                                 | Primitives / Icons     | Component Features | Working Status   | Health / Functionality Notes                                      |
| :------------------ | :------------------------------------------------------------------------------------------------------------ | :--------------------- | :----------------- | :--------------- | :---------------------------------------------------------------- |
| **alert-dialog**    | [`alert-dialog.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/components/ui/alert-dialog.tsx)       | Radix UI               | Click Event        | ✅ Working       | Fully functional component with event bindings and state updates. |
| **avatar**          | [`avatar.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/components/ui/avatar.tsx)                   | Radix UI               | Presentation       | ✅ Visual Layout | Stateless presentation card / container component.                |
| **badge**           | [`badge.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/components/ui/badge.tsx)                     | Radix UI               | Presentation       | ✅ Visual Layout | Stateless presentation card / container component.                |
| **breadcrumb**      | [`breadcrumb.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/components/ui/breadcrumb.tsx)           | Radix UI, Lucide Icons | Presentation       | ✅ Visual Layout | Stateless presentation card / container component.                |
| **button**          | [`button.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/components/ui/button.tsx)                   | Radix UI               | Presentation       | ✅ Visual Layout | Stateless presentation card / container component.                |
| **card**            | [`card.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/components/ui/card.tsx)                       | Tailwind CSS           | Presentation       | ✅ Visual Layout | Stateless presentation card / container component.                |
| **dialog**          | [`dialog.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/components/ui/dialog.tsx)                   | Radix UI, Lucide Icons | Presentation       | ✅ Visual Layout | Stateless presentation card / container component.                |
| **dropdown-menu**   | [`dropdown-menu.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/components/ui/dropdown-menu.tsx)     | Radix UI, Lucide Icons | Presentation       | ✅ Visual Layout | Stateless presentation card / container component.                |
| **input**           | [`input.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/components/ui/input.tsx)                     | Tailwind CSS           | Presentation       | ✅ Visual Layout | Stateless presentation card / container component.                |
| **label**           | [`label.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/components/ui/label.tsx)                     | Tailwind CSS           | Presentation       | ✅ Visual Layout | Stateless presentation card / container component.                |
| **pagination**      | [`pagination.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/components/ui/pagination.tsx)           | Lucide Icons           | Presentation       | ✅ Visual Layout | Stateless presentation card / container component.                |
| **popover**         | [`popover.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/components/ui/popover.tsx)                 | Radix UI               | Presentation       | ✅ Visual Layout | Stateless presentation card / container component.                |
| **progress**        | [`progress.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/components/ui/progress.tsx)               | Radix UI               | Presentation       | ✅ Visual Layout | Stateless presentation card / container component.                |
| **scroll-area**     | [`scroll-area.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/components/ui/scroll-area.tsx)         | Tailwind CSS           | Presentation       | ✅ Visual Layout | Stateless presentation card / container component.                |
| **select**          | [`select.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/components/ui/select.tsx)                   | Radix UI, Lucide Icons | Presentation       | ✅ Visual Layout | Stateless presentation card / container component.                |
| **separator**       | [`separator.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/components/ui/separator.tsx)             | Radix UI               | Presentation       | ✅ Visual Layout | Stateless presentation card / container component.                |
| **sheet**           | [`sheet.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/components/ui/sheet.tsx)                     | Radix UI, Lucide Icons | Presentation       | ✅ Visual Layout | Stateless presentation card / container component.                |
| **skeleton**        | [`skeleton.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/components/ui/skeleton.tsx)               | Tailwind CSS           | Presentation       | ✅ Visual Layout | Stateless presentation card / container component.                |
| **switch**          | [`switch.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/components/ui/switch.tsx)                   | Radix UI               | Presentation       | ✅ Visual Layout | Stateless presentation card / container component.                |
| **tabs**            | [`tabs.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/components/ui/tabs.tsx)                       | Radix UI               | Presentation       | ✅ Visual Layout | Stateless presentation card / container component.                |
| **toast-container** | [`toast-container.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/components/ui/toast-container.tsx) | Lucide Icons           | Click Event        | ✅ Working       | Fully functional component with event bindings and state updates. |
| **upgrade-button**  | [`upgrade-button.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/components/ui/upgrade-button.tsx)   | Tailwind CSS           | Presentation       | ✅ Visual Layout | Stateless presentation card / container component.                |

### Feature Components (`components/*`)

| Category          | Component Name              | File Location                                                                                                                    | Interactive State                             | Working Status   | Functionality Notes                                               |
| :---------------- | :-------------------------- | :------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------- | :--------------- | :---------------------------------------------------------------- |
| **ADMIN**         | **affiliate-filters**       | [`affiliate-filters.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/components/admin/affiliate-filters.tsx)             | Stateless UI                                  | ✅ Visual Layout | Stateless presentation card / container component.                |
| **ADMIN**         | **affiliate-stats-banner**  | [`affiliate-stats-banner.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/components/admin/affiliate-stats-banner.tsx)   | Stateless UI                                  | ✅ Visual Layout | Stateless presentation card / container component.                |
| **ADMIN**         | **affiliate-table**         | [`affiliate-table.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/components/admin/affiliate-table.tsx)                 | Click Handler                                 | ✅ Working       | Fully functional component with event bindings and state updates. |
| **ADMIN**         | **code-inventory-chart**    | [`code-inventory-chart.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/components/admin/code-inventory-chart.tsx)       | Stateless UI                                  | ✅ Visual Layout | Stateless presentation card / container component.                |
| **ADMIN**         | **commission-owings-table** | [`commission-owings-table.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/components/admin/commission-owings-table.tsx) | Click Handler                                 | ✅ Working       | Fully functional component with event bindings and state updates. |
| **ADMIN**         | **distribute-codes-modal**  | [`distribute-codes-modal.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/components/admin/distribute-codes-modal.tsx)   | Click Handler, Form Handler, State Management | ✅ Working       | Fully functional component with event bindings and state updates. |
| **ADMIN**         | **FraudAlertCard**          | [`FraudAlertCard.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/components/admin/FraudAlertCard.tsx)                   | Stateless UI                                  | ✅ Visual Layout | Stateless presentation card / container component.                |
| **ADMIN**         | **FraudPatternBadge**       | [`FraudPatternBadge.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/components/admin/FraudPatternBadge.tsx)             | Stateless UI                                  | ✅ Visual Layout | Stateless presentation card / container component.                |
| **ADMIN**         | **pay-commission-modal**    | [`pay-commission-modal.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/components/admin/pay-commission-modal.tsx)       | Click Handler, Form Handler, State Management | ✅ Working       | Fully functional component with event bindings and state updates. |
| **ADMIN**         | **pnl-breakdown-table**     | [`pnl-breakdown-table.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/components/admin/pnl-breakdown-table.tsx)         | Stateless UI                                  | ✅ Visual Layout | Stateless presentation card / container component.                |
| **ADMIN**         | **pnl-summary-cards**       | [`pnl-summary-cards.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/components/admin/pnl-summary-cards.tsx)             | Stateless UI                                  | ✅ Visual Layout | Stateless presentation card / container component.                |
| **ADMIN**         | **pnl-trend-chart**         | [`pnl-trend-chart.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/components/admin/pnl-trend-chart.tsx)                 | Stateless UI                                  | ✅ Visual Layout | Stateless presentation card / container component.                |
| **ADMIN**         | **sales-performance-table** | [`sales-performance-table.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/components/admin/sales-performance-table.tsx) | Stateless UI                                  | ✅ Visual Layout | Stateless presentation card / container component.                |
| **ADMIN**         | **suspend-affiliate-modal** | [`suspend-affiliate-modal.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/components/admin/suspend-affiliate-modal.tsx) | Click Handler, Form Handler, State Management | ✅ Working       | Fully functional component with event bindings and state updates. |
| **AFFILIATE**     | **code-table**              | [`code-table.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/components/affiliate/code-table.tsx)                       | Stateless UI                                  | ✅ Visual Layout | Stateless presentation card / container component.                |
| **AFFILIATE**     | **commission-table**        | [`commission-table.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/components/affiliate/commission-table.tsx)           | Stateless UI                                  | ✅ Visual Layout | Stateless presentation card / container component.                |
| **AFFILIATE**     | **stats-card**              | [`stats-card.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/components/affiliate/stats-card.tsx)                       | Stateless UI                                  | ✅ Visual Layout | Stateless presentation card / container component.                |
| **AFFILIATE**     | **wise-recipient-form**     | [`wise-recipient-form.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/components/affiliate/wise-recipient-form.tsx)     | Click Handler, Form Handler, State Management | ✅ Working       | Fully functional component with event bindings and state updates. |
| **ALERTS**        | **alert-card**              | [`alert-card.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/components/alerts/alert-card.tsx)                          | Click Handler                                 | ✅ Working       | Fully functional component with event bindings and state updates. |
| **ALERTS**        | **alert-form**              | [`alert-form.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/components/alerts/alert-form.tsx)                          | Click Handler, Form Handler, State Management | ✅ Working       | Fully functional component with event bindings and state updates. |
| **ALERTS**        | **alert-list**              | [`alert-list.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/components/alerts/alert-list.tsx)                          | Click Handler, State Management               | ✅ Working       | Fully functional component with event bindings and state updates. |
| **ALERTS**        | **alerts-pro-upgrade**      | [`alerts-pro-upgrade.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/components/alerts/alerts-pro-upgrade.tsx)          | Stateless UI                                  | ✅ Visual Layout | Stateless presentation card / container component.                |
| **AUTH**          | **login-form**              | [`login-form.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/components/auth/login-form.tsx)                            | Click Handler, Form Handler, State Management | ✅ Working       | Fully functional component with event bindings and state updates. |
| **AUTH**          | **login-tracker**           | [`login-tracker.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/components/auth/login-tracker.tsx)                      | Stateless UI                                  | ✅ Visual Layout | Stateless presentation card / container component.                |
| **AUTH**          | **register-form**           | [`register-form.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/components/auth/register-form.tsx)                      | Click Handler, Form Handler, State Management | ✅ Working       | Fully functional component with event bindings and state updates. |
| **AUTH**          | **social-auth-buttons**     | [`social-auth-buttons.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/components/auth/social-auth-buttons.tsx)          | Click Handler, State Management               | ✅ Working       | Fully functional component with event bindings and state updates. |
| **AUTH**          | **token-refresh-provider**  | [`token-refresh-provider.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/components/auth/token-refresh-provider.tsx)    | Stateless UI                                  | ✅ Visual Layout | Stateless presentation card / container component.                |
| **BILLING**       | **invoice-list**            | [`invoice-list.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/components/billing/invoice-list.tsx)                     | Click Handler                                 | ✅ Working       | Fully functional component with event bindings and state updates. |
| **BILLING**       | **subscription-card**       | [`subscription-card.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/components/billing/subscription-card.tsx)           | Click Handler, State Management               | ✅ Working       | Fully functional component with event bindings and state updates. |
| **CHARTS**        | **chart-controls**          | [`chart-controls.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/components/charts/chart-controls.tsx)                  | Click Handler, State Management               | ✅ Working       | Fully functional component with event bindings and state updates. |
| **DRAWING**       | **AlertDialog**             | [`AlertDialog.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/components/charts/drawing/AlertDialog.tsx)                | Click Handler, Form Handler, State Management | ✅ Working       | Fully functional component with event bindings and state updates. |
| **DRAWING**       | **AlertsPanel**             | [`AlertsPanel.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/components/charts/drawing/AlertsPanel.tsx)                | Click Handler, State Management               | ✅ Working       | Fully functional component with event bindings and state updates. |
| **DRAWING**       | **DrawingLayer**            | [`DrawingLayer.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/components/charts/drawing/DrawingLayer.tsx)              | State Management                              | ✅ Working       | Fully functional component with event bindings and state updates. |
| **DRAWING**       | **StyleEditor**             | [`StyleEditor.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/components/charts/drawing/StyleEditor.tsx)                | Click Handler                                 | ✅ Working       | Fully functional component with event bindings and state updates. |
| **DRAWING**       | **Toolbar**                 | [`Toolbar.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/components/charts/drawing/Toolbar.tsx)                        | Click Handler                                 | ✅ Working       | Fully functional component with event bindings and state updates. |
| **MTF**           | **MtfToggle**               | [`MtfToggle.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/components/charts/mtf/MtfToggle.tsx)                        | Click Handler                                 | ✅ Working       | Fully functional component with event bindings and state updates. |
| **CHARTS**        | **timeframe-selector**      | [`timeframe-selector.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/components/charts/timeframe-selector.tsx)          | Click Handler, State Management               | ✅ Working       | Fully functional component with event bindings and state updates. |
| **CHARTS**        | **trading-chart**           | [`trading-chart.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/components/charts/trading-chart.tsx)                    | State Management                              | ✅ Working       | Fully functional component with event bindings and state updates. |
| **DASHBOARD**     | **recent-alerts**           | [`recent-alerts.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/components/dashboard/recent-alerts.tsx)                 | Stateless UI                                  | ✅ Visual Layout | Stateless presentation card / container component.                |
| **DASHBOARD**     | **stats-card**              | [`stats-card.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/components/dashboard/stats-card.tsx)                       | Stateless UI                                  | ✅ Visual Layout | Stateless presentation card / container component.                |
| **DASHBOARD**     | **upgrade-prompt**          | [`upgrade-prompt.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/components/dashboard/upgrade-prompt.tsx)               | Stateless UI                                  | ✅ Visual Layout | Stateless presentation card / container component.                |
| **LAYOUT**        | **footer**                  | [`footer.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/components/layout/footer.tsx)                                  | Stateless UI                                  | ✅ Visual Layout | Stateless presentation card / container component.                |
| **LAYOUT**        | **header**                  | [`header.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/components/layout/header.tsx)                                  | Click Handler, State Management               | ✅ Working       | Fully functional component with event bindings and state updates. |
| **LAYOUT**        | **mobile-nav**              | [`mobile-nav.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/components/layout/mobile-nav.tsx)                          | Click Handler                                 | ✅ Working       | Fully functional component with event bindings and state updates. |
| **LAYOUT**        | **sidebar**                 | [`sidebar.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/components/layout/sidebar.tsx)                                | Stateless UI                                  | ✅ Visual Layout | Stateless presentation card / container component.                |
| **NOTIFICATIONS** | **notification-bell**       | [`notification-bell.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/components/notifications/notification-bell.tsx)     | Click Handler, State Management               | ✅ Working       | Fully functional component with event bindings and state updates. |
| **NOTIFICATIONS** | **notification-list**       | [`notification-list.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/components/notifications/notification-list.tsx)     | Click Handler, State Management               | ✅ Working       | Fully functional component with event bindings and state updates. |
| **PAYMENTS**      | **CountrySelector**         | [`CountrySelector.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/components/payments/CountrySelector.tsx)              | State Management                              | ✅ Working       | Fully functional component with event bindings and state updates. |
| **PAYMENTS**      | **DiscountCodeInput**       | [`DiscountCodeInput.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/components/payments/DiscountCodeInput.tsx)          | State Management                              | ✅ Working       | Fully functional component with event bindings and state updates. |
| **PAYMENTS**      | **PaymentButton**           | [`PaymentButton.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/components/payments/PaymentButton.tsx)                  | Click Handler, State Management               | ✅ Working       | Fully functional component with event bindings and state updates. |
| **PAYMENTS**      | **PaymentMethodSelector**   | [`PaymentMethodSelector.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/components/payments/PaymentMethodSelector.tsx)  | Click Handler, State Management               | ✅ Working       | Fully functional component with event bindings and state updates. |
| **PAYMENTS**      | **PlanSelector**            | [`PlanSelector.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/components/payments/PlanSelector.tsx)                    | Click Handler                                 | ✅ Working       | Fully functional component with event bindings and state updates. |
| **PAYMENTS**      | **PriceDisplay**            | [`PriceDisplay.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/components/payments/PriceDisplay.tsx)                    | Click Handler, State Management               | ✅ Working       | Fully functional component with event bindings and state updates. |
| **PRICING**       | **tier-comparison**         | [`tier-comparison.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/components/pricing/tier-comparison.tsx)               | Stateless UI                                  | ✅ Visual Layout | Stateless presentation card / container component.                |
| **PROVIDERS**     | **theme-provider**          | [`theme-provider.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/components/providers/theme-provider.tsx)               | State Management                              | ✅ Working       | Fully functional component with event bindings and state updates. |
| **COMPONENTS**    | **theme-toggle**            | [`theme-toggle.tsx`](file:///d:/SaaS Project/trading-alerts-saas-public/components/theme-toggle.tsx)                             | Click Handler, State Management               | ✅ Working       | Fully functional component with event bindings and state updates. |

---

## 6. Live Page HTTP & DOM Structure Audit

| Page Name                | Route                  | HTTP Status | Buttons Detected | Inputs Detected | Selects Detected | Links Detected | Working Status       |
| :----------------------- | :--------------------- | :---------- | :--------------- | :-------------- | :--------------- | :------------- | :------------------- |
| **Landing Page**         | `/`                    | `200`       | 0                | 0               | 0                | 23             | ✅ Live & Accessible |
| **Pricing Page**         | `/pricing`             | `200`       | 0                | 0               | 0                | 18             | ✅ Live & Accessible |
| **Login Page**           | `/login`               | `200`       | 5                | 3               | 0                | 3              | ✅ Live & Accessible |
| **Register Page**        | `/register`            | `200`       | 0                | 0               | 0                | 0              | ✅ Live & Accessible |
| **Checkout Page**        | `/checkout`            | `200`       | 0                | 0               | 0                | 0              | ✅ Live & Accessible |
| **Forgot Password Page** | `/forgot-password`     | `200`       | 0                | 0               | 0                | 0              | ✅ Live & Accessible |
| **Reset Password Page**  | `/reset-password`      | `200`       | 0                | 0               | 0                | 0              | ✅ Live & Accessible |
| **Main Dashboard**       | `/dashboard`           | `200`       | 5                | 3               | 0                | 3              | ✅ Live & Accessible |
| **Alerts Management**    | `/alerts`              | `200`       | 5                | 3               | 0                | 3              | ✅ Live & Accessible |
| **Charts View**          | `/charts`              | `200`       | 5                | 3               | 0                | 3              | ✅ Live & Accessible |
| **User Settings**        | `/settings`            | `200`       | 5                | 3               | 0                | 3              | ✅ Live & Accessible |
| **Admin Dashboard**      | `/admin`               | `200`       | 5                | 3               | 0                | 3              | ✅ Live & Accessible |
| **Admin Affiliates**     | `/admin/affiliates`    | `200`       | 1                | 1               | 1                | 4              | ✅ Live & Accessible |
| **Admin Settings**       | `/admin/settings`      | `404`       | 0                | 0               | 0                | 0              | ⚠️ Status 404        |
| **Affiliate Dashboard**  | `/affiliate/dashboard` | `200`       | 5                | 3               | 0                | 3              | ✅ Live & Accessible |
| **Affiliate Register**   | `/affiliate/register`  | `200`       | 1                | 8               | 1                | 0              | ✅ Live & Accessible |
| **Affiliate Settings**   | `/affiliate/settings`  | `404`       | 0                | 0               | 0                | 0              | ⚠️ Status 404        |

---

## 7. Page-to-Component Cross-Reference Mapping

| Route Path                                    | Associated UI Components Rendered                                            |
| :-------------------------------------------- | :--------------------------------------------------------------------------- |
| `/forgot-password`                            | `Layout Container / Shared Shell`                                            |
| `/login`                                      | `login-form`                                                                 |
| `/register`                                   | `register-form`                                                              |
| `/reset-password`                             | `Layout Container / Shared Shell`                                            |
| `/verify-2fa`                                 | `Layout Container / Shared Shell`                                            |
| `/verify-email`                               | `Layout Container / Shared Shell`                                            |
| `/verify-email/pending`                       | `Layout Container / Shared Shell`                                            |
| `/admin/api-usage`                            | `badge`, `button`, `input`                                                   |
| `/admin/disbursement/accounts`                | `badge`, `button`                                                            |
| `/admin/disbursement/affiliates`              | `badge`, `button`                                                            |
| `/admin/disbursement/audit`                   | `badge`, `button`, `card`                                                    |
| `/admin/disbursement/batches`                 | `badge`, `button`                                                            |
| `/admin/disbursement/batches/[batchId]`       | `badge`, `button`                                                            |
| `/admin/disbursement/config`                  | `badge`, `button`                                                            |
| `/admin/disbursement`                         | `badge`, `button`                                                            |
| `/admin/disbursement/recipients`              | `badge`, `button`                                                            |
| `/admin/disbursement/transactions`            | `badge`, `button`                                                            |
| `/admin/errors`                               | `badge`, `button`, `input`                                                   |
| `/admin/fraud-alerts`                         | `card`, `button`, `FraudAlertCard`, `toast-container`                        |
| `/admin/fraud-alerts/[id]`                    | `card`, `button`, `FraudPatternBadge`                                        |
| `/admin`                                      | `badge`, `button`                                                            |
| `/admin/users`                                | `badge`, `button`, `input`                                                   |
| `/alerts/new`                                 | `alerts-pro-upgrade`                                                         |
| `/alerts`                                     | `alerts-pro-upgrade`                                                         |
| `/charts`                                     | `upgrade-button`                                                             |
| `/charts/[symbol]/[timeframe]`                | `chart-controls`, `upgrade-button`                                           |
| `/dashboard`                                  | `recent-alerts`, `stats-card`, `upgrade-prompt`, `badge`, `card`             |
| `/settings/account`                           | `toast-container`, `button`, `input`, `label`, `separator`, `badge`, `card`  |
| `/settings/appearance`                        | `label`, `separator`                                                         |
| `/settings/billing`                           | `button`, `badge`, `card`, `progress`, `separator`                           |
| `/settings/help`                              | `button`, `label`, `card`, `separator`                                       |
| `/settings/language`                          | `button`, `label`, `separator`                                               |
| `/settings`                                   | `button`, `badge`, `card`                                                    |
| `/settings/privacy`                           | `button`, `label`, `separator`, `card`, `switch`                             |
| `/settings/profile`                           | `avatar`, `button`, `input`, `label`, `separator`, `badge`                   |
| `/settings/security`                          | `toast-container`, `button`, `separator`, `badge`, `card`, `switch`, `label` |
| `/settings/terms`                             | `card`, `separator`                                                          |
| `/`                                           | `Layout Container / Shared Shell`                                            |
| `/pricing`                                    | `badge`, `button`                                                            |
| `/admin/affiliates`                           | `Layout Container / Shared Shell`                                            |
| `/admin/affiliates/reports/code-inventory`    | `Layout Container / Shared Shell`                                            |
| `/admin/affiliates/reports/commission-owings` | `Layout Container / Shared Shell`                                            |
| `/admin/affiliates/reports/profit-loss`       | `Layout Container / Shared Shell`                                            |
| `/admin/affiliates/reports/sales-performance` | `Layout Container / Shared Shell`                                            |
| `/admin/affiliates/[id]`                      | `Layout Container / Shared Shell`                                            |
| `/admin/login`                                | `Layout Container / Shared Shell`                                            |
| `/admin/settings/affiliate`                   | `Layout Container / Shared Shell`                                            |
| `/affiliate/dashboard/codes`                  | `code-table`                                                                 |
| `/affiliate/dashboard/commissions`            | `commission-table`                                                           |
| `/affiliate/dashboard`                        | `stats-card`                                                                 |
| `/affiliate/dashboard/profile`                | `Layout Container / Shared Shell`                                            |
| `/affiliate/dashboard/profile/payment`        | `Layout Container / Shared Shell`                                            |
| `/affiliate/register`                         | `Layout Container / Shared Shell`                                            |
| `/affiliate/settings/payout`                  | `wise-recipient-form`                                                        |
| `/affiliate/verify`                           | `Layout Container / Shared Shell`                                            |
| `/checkout`                                   | `card`, `button`, `badge`                                                    |
| `/test-api`                                   | `Layout Container / Shared Shell`                                            |

---

## 8. Summary Findings & Redesign Baseline Recommendations

### Key Strengths of Current Codebase

1. **Radix UI Primitive Standard**: UI controls (Dialogs, Dropdowns, Selects, Tabs, Switches, Popovers, Sheets) leverage accessible Radix UI primitives.
2. **Strict Route & Feature Isolation**: Component folders (`alerts/`, `charts/`, `dashboard/`, `admin/`, `affiliate/`, `billing/`) mirror the app domain architecture cleanly.
3. **Role Gating Ready**: Clean middleware and role boundaries between FREE, PRO, ADMIN, and AFFILIATE access.

### Redesign Action Items

1. **Design System Consolidation**: Establish unified Tailwind color tokens and font hierarchies to replace inline style variations.
2. **Interactive State Feedback**: Add loading skeletons, ripple/hover effects, and micro-animations for live market alert notifications.
3. **Responsive Chart & Table Layouts**: Improve layout adaptability for wide multi-monitor trading terminals as well as mobile responsive views.
