# Frontend UI Files Inventory

**Last Updated:** 2026-08-14
**Total Files:** 193
**Purpose:** Complete inventory of all frontend UI files that create user visualization and/or allow user interaction

---

## Definition

**Frontend UI File** is defined as a file that:

- Creates user visualization (readable UI elements), AND/OR
- Allows user interaction (interactive UI elements)

---

## Complete Inventory Table

| NO. | Part           | Paths and Filenames                                                    | Interactive UI Element | Readable UI Element |
| --- | -------------- | ---------------------------------------------------------------------- | ---------------------- | ------------------- |
| 1   | Part 05        | `app/(auth)/forgot-password/page.tsx`                                  | YES                    | YES                 |
| 2   | Part 05        | `app/(auth)/layout.tsx`                                                |                        | YES                 |
| 3   | Part 05        | `app/(auth)/loading.tsx`                                               |                        | YES                 |
| 4   | Part 05        | `app/(auth)/login/page.tsx`                                            | YES                    | YES                 |
| 5   | Part 05        | `app/(auth)/register/page.tsx`                                         | YES                    | YES                 |
| 6   | Part 05        | `app/(auth)/reset-password/page.tsx`                                   | YES                    | YES                 |
| 7   | Part 05        | `app/(auth)/verify-2fa/page.tsx`                                       | YES                    | YES                 |
| 8   | Part 05        | `app/(auth)/verify-email/page.tsx`                                     | YES                    | YES                 |
| 9   | Part 05        | `app/(auth)/verify-email/pending/page.tsx`                             |                        | YES                 |
| 10  | Part 05        | `components/auth/login-form.tsx`                                       | YES                    | YES                 |
| 11  | Part 05        | `components/auth/login-tracker.tsx`                                    |                        | YES                 |
| 12  | Part 05        | `components/auth/register-form.tsx`                                    | YES                    | YES                 |
| 13  | Part 05        | `components/auth/social-auth-buttons.tsx`                              | YES                    |                     |
| 14  | Part 05        | `components/auth/token-refresh-provider.tsx`                           |                        | YES                 |
| 15  | Part 08        | `app/(dashboard)/alerts/alerts-client.tsx`                             | YES                    | YES                 |
| 16  | Part 08        | `app/(dashboard)/alerts/loading.tsx`                                   |                        | YES                 |
| 17  | Part 08        | `app/(dashboard)/alerts/page.tsx`                                      | YES                    | YES                 |
| 18  | Part 08        | `app/(dashboard)/dashboard/loading.tsx`                                |                        | YES                 |
| 19  | Part 08        | `app/(dashboard)/dashboard/page.tsx`                                   | YES                    | YES                 |
| 20  | Part 08        | `app/(dashboard)/layout.tsx`                                           | YES                    | YES                 |
| 21  | Part 08        | `components/dashboard/recent-alerts.tsx`                               | YES                    | YES                 |
| 22  | Part 08        | `components/dashboard/stats-card.tsx`                                  |                        | YES                 |
| 23  | Part 08        | `components/dashboard/upgrade-prompt.tsx`                              | YES                    | YES                 |
| 24  | Part 08        | `components/layout/footer.tsx`                                         |                        | YES                 |
| 25  | Part 08        | `components/layout/header.tsx`                                         | YES                    | YES                 |
| 26  | Part 08        | `components/layout/mobile-nav.tsx`                                     | YES                    | YES                 |
| 27  | Part 08        | `components/layout/sidebar.tsx`                                        | YES                    | YES                 |
| 28  | Part 09        | `app/(dashboard)/charts/[symbol]/[timeframe]/page.tsx`                 | YES                    | YES                 |
| 29  | Part 09        | `app/(dashboard)/charts/[symbol]/[timeframe]/trading-chart-client.tsx` | YES                    | YES                 |
| 30  | Part 09        | `app/(dashboard)/charts/loading.tsx`                                   |                        | YES                 |
| 31  | Part 09        | `app/(dashboard)/charts/page.tsx`                                      | YES                    | YES                 |
| 32  | Part 09        | `components/charts/chart-controls.tsx`                                 | YES                    | YES                 |
| 33  | Part 09        | `components/charts/mtf/MtfToggle.tsx`                                  | YES                    | YES                 |
| 34  | Part 09        | `components/charts/timeframe-selector.tsx`                             | YES                    | YES                 |
| 35  | Part 09        | `components/charts/trading-chart.tsx`                                  | YES                    | YES                 |
| 36  | Drawing Engine | `components/charts/drawing/AlertDialog.tsx`                            | YES                    | YES                 |
| 37  | Drawing Engine | `components/charts/drawing/AlertsPanel.tsx`                            | YES                    | YES                 |
| 38  | Drawing Engine | `components/charts/drawing/DrawingLayer.tsx`                           | YES                    | YES                 |
| 39  | Drawing Engine | `components/charts/drawing/StyleEditor.tsx`                            | YES                    | YES                 |
| 40  | Drawing Engine | `components/charts/drawing/Toolbar.tsx`                                | YES                    | YES                 |
| 41  | Part 11        | `app/(dashboard)/alerts/[id]/edit/edit-alert-client.tsx`               | YES                    | YES                 |
| 42  | Part 11        | `app/(dashboard)/alerts/[id]/edit/page.tsx`                            | YES                    | YES                 |
| 43  | Part 11        | `app/(dashboard)/alerts/new/create-alert-client.tsx`                   | YES                    | YES                 |
| 44  | Part 11        | `app/(dashboard)/alerts/new/page.tsx`                                  | YES                    | YES                 |
| 45  | Part 11        | `components/alerts/alert-card.tsx`                                     | YES                    | YES                 |
| 46  | Part 11        | `components/alerts/alert-form.tsx`                                     | YES                    | YES                 |
| 47  | Part 11        | `components/alerts/alert-list.tsx`                                     | YES                    | YES                 |
| 48  | Part 11        | `components/alerts/alerts-pro-upgrade.tsx`                             | YES                    | YES                 |
| 49  | Part 12        | `app/(marketing)/pricing/page.tsx`                                     | YES                    | YES                 |
| 50  | Part 12        | `components/billing/invoice-list.tsx`                                  |                        | YES                 |
| 51  | Part 12        | `components/billing/subscription-card.tsx`                             | YES                    | YES                 |
| 52  | Part 12        | `components/pricing/tier-comparison.tsx`                               |                        | YES                 |
| 53  | Part 13        | `app/(dashboard)/settings/appearance/page.tsx`                         | YES                    | YES                 |
| 54  | Part 13        | `app/(dashboard)/settings/billing/page.tsx`                            | YES                    | YES                 |
| 55  | Part 13        | `app/(dashboard)/settings/help/page.tsx`                               | YES                    | YES                 |
| 56  | Part 13        | `app/(dashboard)/settings/language/page.tsx`                           | YES                    | YES                 |
| 57  | Part 13        | `app/(dashboard)/settings/layout.tsx`                                  | YES                    | YES                 |
| 58  | Part 13        | `app/(dashboard)/settings/loading.tsx`                                 |                        | YES                 |
| 59  | Part 13        | `app/(dashboard)/settings/page.tsx`                                    | YES                    | YES                 |
| 60  | Part 13        | `app/(dashboard)/settings/terms/page.tsx`                              |                        | YES                 |
| 61  | Part 14        | `app/(dashboard)/admin/api-usage/page.tsx`                             | YES                    | YES                 |
| 62  | Part 14        | `app/(dashboard)/admin/errors/page.tsx`                                | YES                    | YES                 |
| 63  | Part 14        | `app/(dashboard)/admin/fraud-alerts/[id]/page.tsx`                     | YES                    | YES                 |
| 64  | Part 14        | `app/(dashboard)/admin/fraud-alerts/page.tsx`                          | YES                    | YES                 |
| 65  | Part 14        | `app/(dashboard)/admin/layout.tsx`                                     | YES                    | YES                 |
| 66  | Part 14        | `app/(dashboard)/admin/loading.tsx`                                    |                        | YES                 |
| 67  | Part 14        | `app/(dashboard)/admin/page.tsx`                                       | YES                    | YES                 |
| 68  | Part 14        | `app/(dashboard)/admin/system/config-history/page.tsx`                 | YES                    | YES                 |
| 69  | Part 14        | `app/(dashboard)/admin/system/jobs/page.tsx`                           | YES                    | YES                 |
| 70  | Part 14        | `app/(dashboard)/admin/system/outbox/page.tsx`                         | YES                    | YES                 |
| 71  | Part 14        | `app/(dashboard)/admin/system/terminals/page.tsx`                      | YES                    | YES                 |
| 72  | Part 14        | `app/(dashboard)/admin/users/[id]/page.tsx`                            | YES                    | YES                 |
| 73  | Part 14        | `app/(dashboard)/admin/users/page.tsx`                                 | YES                    | YES                 |
| 74  | Part 14        | `components/admin/FraudAlertCard.tsx`                                  | YES                    | YES                 |
| 75  | Part 14        | `components/admin/FraudPatternBadge.tsx`                               |                        | YES                 |
| 76  | Part 14        | `components/admin/affiliate-filters.tsx`                               | YES                    | YES                 |
| 77  | Part 14        | `components/admin/affiliate-stats-banner.tsx`                          |                        | YES                 |
| 78  | Part 14        | `components/admin/affiliate-table.tsx`                                 | YES                    | YES                 |
| 79  | Part 14        | `components/admin/code-inventory-chart.tsx`                            |                        | YES                 |
| 80  | Part 14        | `components/admin/commission-owings-table.tsx`                         | YES                    | YES                 |
| 81  | Part 14        | `components/admin/distribute-codes-modal.tsx`                          | YES                    | YES                 |
| 82  | Part 14        | `components/admin/pay-commission-modal.tsx`                            | YES                    | YES                 |
| 83  | Part 14        | `components/admin/pnl-breakdown-table.tsx`                             |                        | YES                 |
| 84  | Part 14        | `components/admin/pnl-summary-cards.tsx`                               |                        | YES                 |
| 85  | Part 14        | `components/admin/pnl-trend-chart.tsx`                                 |                        | YES                 |
| 86  | Part 14        | `components/admin/sales-performance-table.tsx`                         |                        | YES                 |
| 87  | Part 14        | `components/admin/suspend-affiliate-modal.tsx`                         | YES                    | YES                 |
| 88  | Part 14        | `components/admin/system/retry-failed-events-button.tsx`               | YES                    | YES                 |
| 89  | Part 15        | `app/(dashboard)/notifications/page.tsx`                               | YES                    | YES                 |
| 90  | Part 15        | `components/notifications/notification-bell.tsx`                       | YES                    | YES                 |
| 91  | Part 15        | `components/notifications/notification-list.tsx`                       | YES                    | YES                 |
| 92  | Part 16        | `app/(marketing)/about/page.tsx`                                       | YES                    | YES                 |
| 93  | Part 16        | `app/(marketing)/blog/page.tsx`                                        | YES                    | YES                 |
| 94  | Part 16        | `app/(marketing)/careers/page.tsx`                                     | YES                    | YES                 |
| 95  | Part 16        | `app/(marketing)/changelog/page.tsx`                                   | YES                    | YES                 |
| 96  | Part 16        | `app/(marketing)/disclaimer/page.tsx`                                  |                        | YES                 |
| 97  | Part 16        | `app/(marketing)/docs/page.tsx`                                        | YES                    | YES                 |
| 98  | Part 16        | `app/(marketing)/help/page.tsx`                                        | YES                    | YES                 |
| 99  | Part 16        | `app/(marketing)/landing-content.tsx`                                  | YES                    | YES                 |
| 100 | Part 16        | `app/(marketing)/layout.tsx`                                           |                        | YES                 |
| 101 | Part 16        | `app/(marketing)/page.tsx`                                             | YES                    | YES                 |
| 102 | Part 16        | `app/(marketing)/privacy/page.tsx`                                     |                        | YES                 |
| 103 | Part 16        | `app/(marketing)/status/page.tsx`                                      | YES                    | YES                 |
| 104 | Part 16        | `app/(marketing)/terms/page.tsx`                                       |                        | YES                 |
| 105 | Part 16        | `app/error.tsx`                                                        |                        | YES                 |
| 106 | Part 16        | `app/global-error.tsx`                                                 |                        | YES                 |
| 107 | Part 16        | `app/globals.css`                                                      |                        | YES                 |
| 108 | Part 16        | `app/layout.tsx`                                                       |                        | YES                 |
| 109 | Part 16        | `app/not-found.tsx`                                                    |                        | YES                 |
| 110 | Part 16        | `app/providers.tsx`                                                    |                        | YES                 |
| 111 | Part 16        | `components/providers/theme-provider.tsx`                              |                        | YES                 |
| 112 | Part 16        | `components/theme-toggle.tsx`                                          | YES                    | YES                 |
| 113 | Part 16        | `components/ui/alert-dialog.tsx`                                       | YES                    | YES                 |
| 114 | Part 16        | `components/ui/avatar.tsx`                                             |                        | YES                 |
| 115 | Part 16        | `components/ui/badge.tsx`                                              |                        | YES                 |
| 116 | Part 16        | `components/ui/breadcrumb.tsx`                                         | YES                    | YES                 |
| 117 | Part 16        | `components/ui/button.tsx`                                             | YES                    | YES                 |
| 118 | Part 16        | `components/ui/card.tsx`                                               |                        | YES                 |
| 119 | Part 16        | `components/ui/dialog.tsx`                                             | YES                    | YES                 |
| 120 | Part 16        | `components/ui/dropdown-menu.tsx`                                      | YES                    | YES                 |
| 121 | Part 16        | `components/ui/input.tsx`                                              | YES                    | YES                 |
| 122 | Part 16        | `components/ui/label.tsx`                                              |                        | YES                 |
| 123 | Part 16        | `components/ui/pagination.tsx`                                         | YES                    | YES                 |
| 124 | Part 16        | `components/ui/popover.tsx`                                            | YES                    | YES                 |
| 125 | Part 16        | `components/ui/progress.tsx`                                           |                        | YES                 |
| 126 | Part 16        | `components/ui/scroll-area.tsx`                                        | YES                    | YES                 |
| 127 | Part 16        | `components/ui/select.tsx`                                             | YES                    | YES                 |
| 128 | Part 16        | `components/ui/separator.tsx`                                          |                        | YES                 |
| 129 | Part 16        | `components/ui/sheet.tsx`                                              | YES                    | YES                 |
| 130 | Part 16        | `components/ui/skeleton.tsx`                                           |                        | YES                 |
| 131 | Part 16        | `components/ui/switch.tsx`                                             | YES                    | YES                 |
| 132 | Part 16        | `components/ui/tabs.tsx`                                               | YES                    | YES                 |
| 133 | Part 16        | `components/ui/toast-container.tsx`                                    | YES                    | YES                 |
| 134 | Part 16        | `components/ui/upgrade-button.tsx`                                     | YES                    | YES                 |
| 135 | Part 17A-2     | `app/affiliate/dashboard/code-inventory/page.tsx`                      | YES                    | YES                 |
| 136 | Part 17A-2     | `app/affiliate/dashboard/codes/page.tsx`                               | YES                    | YES                 |
| 137 | Part 17A-2     | `app/affiliate/dashboard/commissions/page.tsx`                         | YES                    | YES                 |
| 138 | Part 17A-2     | `app/affiliate/dashboard/layout.tsx`                                   | YES                    | YES                 |
| 139 | Part 17A-2     | `app/affiliate/dashboard/page.tsx`                                     | YES                    | YES                 |
| 140 | Part 17A-2     | `app/affiliate/dashboard/payouts/page.tsx`                             | YES                    | YES                 |
| 141 | Part 17A-2     | `app/affiliate/dashboard/profile/page.tsx`                             | YES                    | YES                 |
| 142 | Part 17A-2     | `app/affiliate/dashboard/profile/payment/page.tsx`                     | YES                    | YES                 |
| 143 | Part 17A-2     | `app/affiliate/dashboard/resources/page.tsx`                           | YES                    | YES                 |
| 144 | Part 17A-2     | `app/affiliate/dashboard/statements/page.tsx`                          | YES                    | YES                 |
| 145 | Part 17A-2     | `app/affiliate/join/page.tsx`                                          | YES                    | YES                 |
| 146 | Part 17A-2     | `app/affiliate/layout.tsx`                                             |                        | YES                 |
| 147 | Part 17A-2     | `app/affiliate/page.tsx`                                               | YES                    | YES                 |
| 148 | Part 17A-2     | `app/affiliate/register/layout.tsx`                                    |                        | YES                 |
| 149 | Part 17A-2     | `app/affiliate/register/page.tsx`                                      | YES                    | YES                 |
| 150 | Part 17A-2     | `app/affiliate/settings/layout.tsx`                                    | YES                    | YES                 |
| 151 | Part 17A-2     | `app/affiliate/settings/payout/page.tsx`                               | YES                    | YES                 |
| 152 | Part 17A-2     | `app/affiliate/verify/layout.tsx`                                      |                        | YES                 |
| 153 | Part 17A-2     | `app/affiliate/verify/page.tsx`                                        | YES                    | YES                 |
| 154 | Part 17A-2     | `components/affiliate/code-table.tsx`                                  | YES                    | YES                 |
| 155 | Part 17A-2     | `components/affiliate/commission-table.tsx`                            |                        | YES                 |
| 156 | Part 17A-2     | `components/affiliate/stats-card.tsx`                                  |                        | YES                 |
| 157 | Part 17B-1     | `app/(dashboard)/admin/affiliates/[id]/page.tsx`                       | YES                    | YES                 |
| 158 | Part 17B-1     | `app/(dashboard)/admin/affiliates/page.tsx`                            | YES                    | YES                 |
| 159 | Part 17B-1     | `app/(dashboard)/admin/affiliates/reports/code-flows/page.tsx`         | YES                    | YES                 |
| 160 | Part 17B-1     | `app/(dashboard)/admin/affiliates/reports/code-inventory/page.tsx`     | YES                    | YES                 |
| 161 | Part 17B-1     | `app/(dashboard)/admin/affiliates/reports/commission-owings/page.tsx`  | YES                    | YES                 |
| 162 | Part 17B-1     | `app/(dashboard)/admin/affiliates/reports/profit-loss/page.tsx`        | YES                    | YES                 |
| 163 | Part 17B-1     | `app/(dashboard)/admin/affiliates/reports/sales-performance/page.tsx`  | YES                    | YES                 |
| 164 | Part 17B-1     | `app/(dashboard)/admin/settings/affiliate/page.tsx`                    | YES                    | YES                 |
| 165 | Part 18C       | `app/checkout/page.tsx`                                                | YES                    | YES                 |
| 166 | Part 18C       | `app/checkout/return/page.tsx`                                         | YES                    | YES                 |
| 167 | Part 18C       | `app/upgrade/success/page.tsx`                                         | YES                    | YES                 |
| 168 | Part 18C       | `components/payments/CountrySelector.tsx`                              | YES                    | YES                 |
| 169 | Part 18C       | `components/payments/DiscountCodeInput.tsx`                            | YES                    | YES                 |
| 170 | Part 18C       | `components/payments/PaymentButton.tsx`                                | YES                    |                     |
| 171 | Part 18C       | `components/payments/PaymentMethodSelector.tsx`                        | YES                    | YES                 |
| 172 | Part 18C       | `components/payments/PlanSelector.tsx`                                 | YES                    | YES                 |
| 173 | Part 18C       | `components/payments/PriceDisplay.tsx`                                 |                        | YES                 |
| 174 | Part 19.5      | `app/(dashboard)/admin/disbursement/accounts/page.tsx`                 | YES                    | YES                 |
| 175 | Part 19.5      | `app/(dashboard)/admin/disbursement/affiliates/[affiliateId]/page.tsx` | YES                    | YES                 |
| 176 | Part 19.5      | `app/(dashboard)/admin/disbursement/affiliates/page.tsx`               | YES                    | YES                 |
| 177 | Part 19.5      | `app/(dashboard)/admin/disbursement/audit/page.tsx`                    | YES                    | YES                 |
| 178 | Part 19.5      | `app/(dashboard)/admin/disbursement/batches/[batchId]/page.tsx`        | YES                    | YES                 |
| 179 | Part 19.5      | `app/(dashboard)/admin/disbursement/batches/page.tsx`                  | YES                    | YES                 |
| 180 | Part 19.5      | `app/(dashboard)/admin/disbursement/config/page.tsx`                   | YES                    | YES                 |
| 181 | Part 19.5      | `app/(dashboard)/admin/disbursement/layout.tsx`                        | YES                    | YES                 |
| 182 | Part 19.5      | `app/(dashboard)/admin/disbursement/page.tsx`                          | YES                    | YES                 |
| 183 | Part 19.5      | `app/(dashboard)/admin/disbursement/recipients/page.tsx`               | YES                    | YES                 |
| 184 | Part 19.5      | `app/(dashboard)/admin/disbursement/transactions/page.tsx`             | YES                    | YES                 |
| 185 | Part 19.5      | `components/affiliate/wise-recipient-form.tsx`                         | YES                    | YES                 |
| 186 | Part 22        | `app/(dashboard)/settings/account/account-settings-client.tsx`         | YES                    | YES                 |
| 187 | Part 22        | `app/(dashboard)/settings/account/page.tsx`                            | YES                    | YES                 |
| 188 | Part 22        | `app/(dashboard)/settings/privacy/page.tsx`                            | YES                    | YES                 |
| 189 | Part 22        | `app/(dashboard)/settings/profile/page.tsx`                            | YES                    | YES                 |
| 190 | Part 22        | `app/(dashboard)/settings/security/activity/page.tsx`                  | YES                    | YES                 |
| 191 | Part 22        | `app/(dashboard)/settings/security/page.tsx`                           | YES                    | YES                 |
| 192 | Part 22        | `app/(public)/settings/account/delete/cancel/page.tsx`                 | YES                    | YES                 |
| 193 | Part 22        | `app/(public)/settings/account/delete/confirm/page.tsx`                | YES                    | YES                 |

---

## Summary Statistics

### Total Counts

- **Total Frontend UI Files:** 193
- **Files with Interactive Elements:** 147
- **Files with Readable Elements:** 191
- **Interactive + Readable:** 145
- **Readable Only:** 46
- **Interactive Only:** 2

### Distribution by Part

| Part                                            | File Count | Percentage |
| ----------------------------------------------- | ---------- | ---------- |
| Part 05 (Authentication)                        | 14         | 7.3 %      |
| Part 08 (Dashboard & Core Layout)               | 13         | 6.7 %      |
| Part 09 (Charts & Visualizations)               | 8          | 4.1 %      |
| Drawing Engine (Chart Drawing Tools)            | 5          | 2.6 %      |
| Part 11 (Alerts System)                         | 8          | 4.1 %      |
| Part 12 (Billing & Pricing)                     | 4          | 2.1 %      |
| Part 13 (Settings)                              | 8          | 4.1 %      |
| Part 14 (Admin Dashboard & System Ops)          | 28         | 14.5 %     |
| Part 15 (Notifications & Real-Time)             | 3          | 1.6 %      |
| Part 16 (Infrastructure, Marketing & Shared UI) | 43         | 22.3 %     |
| Part 17A-2 (Affiliate Portal)                   | 22         | 11.4 %     |
| Part 17B-1 (Admin Affiliate Management)         | 8          | 4.1 %      |
| Part 18C (Payment UX & Checkout)                | 9          | 4.7 %      |
| Part 19.5 (Wise Disbursement UI)                | 12         | 6.2 %      |
| Part 22 (User Account & Security)               | 8          | 4.1 %      |

### Distribution by Type

| Category                     | File Count | Percentage |
| ---------------------------- | ---------- | ---------- |
| Pages                        | 85         | 44.0 %     |
| Components                   | 79         | 40.9 %     |
| Layouts                      | 12         | 6.2 %      |
| Loading States               | 6          | 3.1 %      |
| Error Boundaries & Not-Found | 3          | 1.6 %      |
| App Clients & Global Styles  | 8          | 4.1 %      |

### Distribution by User Role

| User Role                 | File Count | Key Areas                                                                                 |
| ------------------------- | ---------- | ----------------------------------------------------------------------------------------- |
| **End Users**             | 53         | Dashboard, Alerts (PRO), Charts, Drawing Tools, Settings, Profile, Notifications          |
| **Affiliates**            | 23         | Affiliate Registration, Dashboard, Codes, Commissions, Payouts, Resources                 |
| **Admins**                | 47         | Admin Overview, User Management, Fraud Alerts, System Ops, Affiliate Admin, Disbursements |
| **Public/Marketing**      | 17         | Landing Page, Pricing, About, Blog, Careers, Changelog, Docs, Terms, Privacy              |
| **Authentication**        | 14         | Login, Register, Verify Email, Forgot Password, Reset Password, 2FA Verification          |
| **Shared/Infrastructure** | 30         | Root Layout, Error Boundaries, Theme Provider, shadcn/ui Component Primitives (22)        |

---

## Key Features by Category

### Authentication & Security (14 files)

- Login / Registration flows (`app/(auth)/login/page.tsx`, `app/(auth)/register/page.tsx`)
- Email verification & pending states (`app/(auth)/verify-email/page.tsx`, `app/(auth)/verify-email/pending/page.tsx`)
- Password recovery & reset (`app/(auth)/forgot-password/page.tsx`, `app/(auth)/reset-password/page.tsx`)
- Two-Factor Authentication (2FA TOTP) verification (`app/(auth)/verify-2fa/page.tsx`)
- Social authentication buttons & login trackers (`components/auth/login-tracker.tsx`, `components/auth/token-refresh-provider.tsx`)

### Dashboard & Core Navigation (13 files)

- Main user dashboard with stats and activity feed (`app/(dashboard)/dashboard/page.tsx`)
- Navigation architecture (`components/layout/header.tsx`, `components/layout/sidebar.tsx`, `components/layout/mobile-nav.tsx`, `components/layout/footer.tsx`)
- Dashboard widgets (`components/dashboard/stats-card.tsx`, `components/dashboard/recent-alerts.tsx`, `components/dashboard/upgrade-prompt.tsx`)

### Charts & Data Visualization (13 files)

- Interactive lightweight-charts v5 trading charts (`app/(dashboard)/charts/[symbol]/[timeframe]/page.tsx`)
- Chart controls & timeframe selector (`components/charts/chart-controls.tsx`, `components/charts/timeframe-selector.tsx`)
- Multi-timeframe (MTF) centroid channel toggle (`components/charts/mtf/MtfToggle.tsx`)
- HTML5 Canvas 6-tool Drawing Engine toolbar & overlay layer (`components/charts/drawing/Toolbar.tsx`, `components/charts/drawing/DrawingLayer.tsx`)
- Line-touch alert setup & style editor dialogs (`components/charts/drawing/AlertDialog.tsx`, `components/charts/drawing/AlertsPanel.tsx`, `components/charts/drawing/StyleEditor.tsx`)

### Alerts Management (8 files)

- PRO-exclusive alert management overview (`app/(dashboard)/alerts/page.tsx`, `app/(dashboard)/alerts/alerts-client.tsx`)
- Alert creation & editing forms (`app/(dashboard)/alerts/new/page.tsx`, `app/(dashboard)/alerts/[id]/edit/page.tsx`, `app/(dashboard)/alerts/[id]/edit/edit-alert-client.tsx`)
- FREE user PRO-upgrade upsell landing (`components/alerts/alerts-pro-upgrade.tsx`)

### Settings & User Profile Management (16 files)

- Settings hub (`app/(dashboard)/settings/page.tsx`) with appearance, billing, help, language, privacy, and terms
- Profile & Account settings (`app/(dashboard)/settings/profile/page.tsx`, `app/(dashboard)/settings/account/page.tsx`, `app/(dashboard)/settings/account/account-settings-client.tsx`)
- Security settings & Security activity log (`app/(dashboard)/settings/security/page.tsx`, `app/(dashboard)/settings/security/activity/page.tsx`)
- Account deletion confirmation & cancellation public routes (`app/(public)/settings/account/delete/confirm/page.tsx`, `app/(public)/settings/account/delete/cancel/page.tsx`)

### Admin Dashboard & System Operations (28 files)

- Admin overview & user management (`app/(dashboard)/admin/page.tsx`, `app/(dashboard)/admin/users/page.tsx`, `app/(dashboard)/admin/users/[id]/page.tsx`)
- Fraud alert inspection & badge indicators (`app/(dashboard)/admin/fraud-alerts/page.tsx`, `app/(dashboard)/admin/fraud-alerts/[id]/page.tsx`)
- System operations: config history audit (`app/(dashboard)/admin/system/config-history/page.tsx`), jobs (`app/(dashboard)/admin/system/jobs/page.tsx`), outbox events (`app/(dashboard)/admin/system/outbox/page.tsx`), terminals (`app/(dashboard)/admin/system/terminals/page.tsx`)
- Event retry modal button (`components/admin/system/retry-failed-events-button.tsx`)
- Admin affiliate analytics, PnL breakdown, sales performance, and code distribution dialogs

### Affiliate Portal (22 files)

- Affiliate registration, verification, and landing (`app/affiliate/register/page.tsx`, `app/affiliate/verify/page.tsx`, `app/affiliate/join/page.tsx`, `app/affiliate/page.tsx`)
- Affiliate dashboard (`app/affiliate/dashboard/page.tsx`, `app/affiliate/dashboard/codes/page.tsx`, `app/affiliate/dashboard/commissions/page.tsx`, `app/affiliate/dashboard/profile/page.tsx`, `app/affiliate/dashboard/profile/payment/page.tsx`)
- Code inventory report, payout history, monthly statements, and resource center (`app/affiliate/dashboard/code-inventory/page.tsx`, `app/affiliate/dashboard/payouts/page.tsx`, `app/affiliate/dashboard/statements/page.tsx`, `app/affiliate/dashboard/resources/page.tsx`)
- Dedicated payout settings page & Wise recipient onboarding form (`app/affiliate/settings/payout/page.tsx`, `components/affiliate/wise-recipient-form.tsx`)

### Payments, Billing & Checkout (13 files)

- Pricing page with tier comparison (`app/(marketing)/pricing/page.tsx`, `components/pricing/tier-comparison.tsx`)
- Unified checkout & payment method selector (`app/checkout/page.tsx`, `app/checkout/return/page.tsx`, `app/upgrade/success/page.tsx`)
- Subscription card, invoice list, discount code input, and country selector

### Wise Disbursement System UI (12 files)

- Admin disbursement dashboard & layout (`app/(dashboard)/admin/disbursement/layout.tsx`, `app/(dashboard)/admin/disbursement/page.tsx`)
- Payout execution batches, batch detail, transactions, audit logs, and configuration (`app/(dashboard)/admin/disbursement/batches/page.tsx`, `app/(dashboard)/admin/disbursement/transactions/page.tsx`, `app/(dashboard)/admin/disbursement/audit/page.tsx`, `app/(dashboard)/admin/disbursement/config/page.tsx`)
- Affiliate recipient verification & payout history (`app/(dashboard)/admin/disbursement/recipients/page.tsx`, `app/(dashboard)/admin/disbursement/affiliates/page.tsx`, `app/(dashboard)/admin/disbursement/affiliates/[affiliateId]/page.tsx`)

### Marketing & Public Pages (11 files)

- Public landing page (`app/(marketing)/page.tsx`, `app/(marketing)/landing-content.tsx`)
- Marketing subpages: About, Blog, Careers, Changelog, Disclaimer, Documentation, Help Center, Privacy Policy, Status, Terms of Service

### Shared UI & Infrastructure Components (28 files)

- Root layout, error boundary (`app/error.tsx`, `app/global-error.tsx`), 404 page (`app/not-found.tsx`), and theme provider (`components/providers/theme-provider.tsx`)
- Complete 22-component shadcn/ui primitive suite (`components/ui/*`: alert-dialog, avatar, badge, breadcrumb, button, card, dialog, dropdown-menu, input, label, pagination, popover, progress, scroll-area, select, separator, sheet, skeleton, switch, tabs, toast-container, upgrade-button)

---

## Reconciliation Log

### Reconciliation Note (2026-08-14) — Phase 6 & Phase 7 Codebase Alignment

Conducted an exhaustive line-by-line audit across the codebase following Phase 6 (Gap Matrix Repair) and Phase 7 (API Client SDK Generation):

1. **Admin Hierarchy Reorganization (Session 6-2 / F62):** Consolidated all admin pages from legacy `app/admin/*` into `app/(dashboard)/admin/*` (`affiliates`, `reports/profit-loss`, `reports/sales-performance`, `reports/commission-owings`, `reports/code-inventory`, `settings/affiliate`).
2. **New Phase 6 Admin System & Reporting Pages:**
   - `app/(dashboard)/admin/system/config-history/page.tsx` (Config audit history)
   - `app/(dashboard)/admin/system/jobs/page.tsx`, `app/(dashboard)/admin/system/outbox/page.tsx`, `app/(dashboard)/admin/system/terminals/page.tsx` (System operations)
   - `app/(dashboard)/admin/users/[id]/page.tsx` (Admin user detail view)
   - `app/(dashboard)/admin/affiliates/reports/code-flows/page.tsx` (Affiliate code flow report)
   - `app/(dashboard)/admin/disbursement/affiliates/[affiliateId]/page.tsx` (Affiliate disbursement detail)
   - `app/(dashboard)/admin/disbursement/recipients/page.tsx` (Wise & RiseWorks payout recipients)
   - `components/admin/system/retry-failed-events-button.tsx` (Outbox event retry control)
3. **Security & Account Deletion Pages (Phase 6 / Phase 7):**
   - `app/(dashboard)/settings/security/activity/page.tsx` (Security activity log)
   - `app/(public)/settings/account/delete/confirm/page.tsx` & `app/(public)/settings/account/delete/cancel/page.tsx` (Human-in-the-loop deletion verification)
4. **Alerts & Realtime Updates:**
   - `app/(dashboard)/alerts/[id]/edit/page.tsx` & `app/(dashboard)/alerts/[id]/edit/edit-alert-client.tsx` (Alert editing interface)
   - `app/(dashboard)/notifications/page.tsx` (Dedicated notifications page)
5. **Affiliate Portal Enhancements:**
   - `app/affiliate/dashboard/code-inventory/page.tsx`, `app/affiliate/dashboard/payouts/page.tsx`, `app/affiliate/dashboard/resources/page.tsx`, `app/affiliate/dashboard/statements/page.tsx`
   - `app/affiliate/settings/layout.tsx` & `app/affiliate/settings/payout/page.tsx`
   - `components/affiliate/wise-recipient-form.tsx` (Wise bank account setup)
6. **Marketing Subpages & Error Boundaries:**
   - Added 10 marketing informational pages under `app/(marketing)/*`
   - Added error boundaries: `app/error.tsx`, `app/global-error.tsx`, `app/not-found.tsx`
7. **Dead Code Cleanup:** Removed retired paths `app/admin/login` and `app/api-test` (deleted at Session 6-12).
8. **Total Reconciliation:** Net file count verified at **193 active frontend UI files**.

---

**Compiled:** 2026-06-26 (updated 2026-08-14)
**Status:** Complete ✅ (100% verified against codebase)
