# Complete TSX Files Inventory - Monolith Architecture

**Generated:** 2026-01-26
**Total Files:** 156 TSX files
**Architecture:** Next.js 14 App Router (Monolith)
**Scope:** `app/`, `components/`, `lib/`

---

## Summary

| Directory | File Count |
|-----------|------------|
| `app/` | 74 |
| `components/` | 77 |
| `lib/` | 5 |
| **Total** | **156** |

---

## App Directory (74 files)

### Authentication Routes (`app/(auth)/`) - 8 files
| # | File Path |
|---|-----------|
| 1 | `app/(auth)/forgot-password/page.tsx` |
| 2 | `app/(auth)/layout.tsx` |
| 3 | `app/(auth)/login/page.tsx` |
| 4 | `app/(auth)/register/page.tsx` |
| 5 | `app/(auth)/reset-password/page.tsx` |
| 6 | `app/(auth)/verify-2fa/page.tsx` |
| 7 | `app/(auth)/verify-email/page.tsx` |
| 8 | `app/(auth)/verify-email/pending/page.tsx` |

### Dashboard Routes (`app/(dashboard)/`) - 38 files

#### Admin Section (`app/(dashboard)/admin/`) - 16 files
| # | File Path |
|---|-----------|
| 9 | `app/(dashboard)/admin/api-usage/page.tsx` |
| 10 | `app/(dashboard)/admin/disbursement/accounts/page.tsx` |
| 11 | `app/(dashboard)/admin/disbursement/affiliates/page.tsx` |
| 12 | `app/(dashboard)/admin/disbursement/audit/page.tsx` |
| 13 | `app/(dashboard)/admin/disbursement/batches/[batchId]/page.tsx` |
| 14 | `app/(dashboard)/admin/disbursement/batches/page.tsx` |
| 15 | `app/(dashboard)/admin/disbursement/config/page.tsx` |
| 16 | `app/(dashboard)/admin/disbursement/layout.tsx` |
| 17 | `app/(dashboard)/admin/disbursement/page.tsx` |
| 18 | `app/(dashboard)/admin/disbursement/transactions/page.tsx` |
| 19 | `app/(dashboard)/admin/errors/page.tsx` |
| 20 | `app/(dashboard)/admin/fraud-alerts/[id]/page.tsx` |
| 21 | `app/(dashboard)/admin/fraud-alerts/page.tsx` |
| 22 | `app/(dashboard)/admin/layout.tsx` |
| 23 | `app/(dashboard)/admin/page.tsx` |
| 24 | `app/(dashboard)/admin/users/page.tsx` |

#### Alerts Section (`app/(dashboard)/alerts/`) - 4 files
| # | File Path |
|---|-----------|
| 25 | `app/(dashboard)/alerts/alerts-client.tsx` |
| 26 | `app/(dashboard)/alerts/new/create-alert-client.tsx` |
| 27 | `app/(dashboard)/alerts/new/page.tsx` |
| 28 | `app/(dashboard)/alerts/page.tsx` |

#### Charts Section (`app/(dashboard)/charts/`) - 3 files
| # | File Path |
|---|-----------|
| 29 | `app/(dashboard)/charts/[symbol]/[timeframe]/page.tsx` |
| 30 | `app/(dashboard)/charts/[symbol]/[timeframe]/trading-chart-client.tsx` |
| 31 | `app/(dashboard)/charts/page.tsx` |

#### Dashboard Main (`app/(dashboard)/`) - 2 files
| # | File Path |
|---|-----------|
| 32 | `app/(dashboard)/dashboard/page.tsx` |
| 33 | `app/(dashboard)/layout.tsx` |

#### Settings Section (`app/(dashboard)/settings/`) - 11 files
| # | File Path |
|---|-----------|
| 34 | `app/(dashboard)/settings/account/page.tsx` |
| 35 | `app/(dashboard)/settings/appearance/page.tsx` |
| 36 | `app/(dashboard)/settings/billing/page.tsx` |
| 37 | `app/(dashboard)/settings/help/page.tsx` |
| 38 | `app/(dashboard)/settings/language/page.tsx` |
| 39 | `app/(dashboard)/settings/layout.tsx` |
| 40 | `app/(dashboard)/settings/page.tsx` |
| 41 | `app/(dashboard)/settings/privacy/page.tsx` |
| 42 | `app/(dashboard)/settings/profile/page.tsx` |
| 43 | `app/(dashboard)/settings/security/page.tsx` |
| 44 | `app/(dashboard)/settings/terms/page.tsx` |

#### Watchlist Section (`app/(dashboard)/watchlist/`) - 2 files
| # | File Path |
|---|-----------|
| 45 | `app/(dashboard)/watchlist/page.tsx` |
| 46 | `app/(dashboard)/watchlist/watchlist-client.tsx` |

### Marketing Routes (`app/(marketing)/`) - 4 files
| # | File Path |
|---|-----------|
| 47 | `app/(marketing)/landing-content.tsx` |
| 48 | `app/(marketing)/layout.tsx` |
| 49 | `app/(marketing)/page.tsx` |
| 50 | `app/(marketing)/pricing/page.tsx` |

### Admin Portal (`app/admin/`) - 8 files
| # | File Path |
|---|-----------|
| 51 | `app/admin/affiliates/[id]/page.tsx` |
| 52 | `app/admin/affiliates/page.tsx` |
| 53 | `app/admin/affiliates/reports/code-inventory/page.tsx` |
| 54 | `app/admin/affiliates/reports/commission-owings/page.tsx` |
| 55 | `app/admin/affiliates/reports/profit-loss/page.tsx` |
| 56 | `app/admin/affiliates/reports/sales-performance/page.tsx` |
| 57 | `app/admin/login/page.tsx` |
| 58 | `app/admin/settings/affiliate/page.tsx` |

### Affiliate Portal (`app/affiliate/`) - 11 files
| # | File Path |
|---|-----------|
| 59 | `app/affiliate/dashboard/codes/page.tsx` |
| 60 | `app/affiliate/dashboard/commissions/page.tsx` |
| 61 | `app/affiliate/dashboard/layout.tsx` |
| 62 | `app/affiliate/dashboard/page.tsx` |
| 63 | `app/affiliate/dashboard/profile/page.tsx` |
| 64 | `app/affiliate/dashboard/profile/payment/page.tsx` |
| 65 | `app/affiliate/layout.tsx` |
| 66 | `app/affiliate/register/layout.tsx` |
| 67 | `app/affiliate/register/page.tsx` |
| 68 | `app/affiliate/verify/layout.tsx` |
| 69 | `app/affiliate/verify/page.tsx` |

### Root App Files - 5 files
| # | File Path |
|---|-----------|
| 70 | `app/checkout/page.tsx` |
| 71 | `app/error.tsx` |
| 72 | `app/layout.tsx` |
| 73 | `app/providers.tsx` |
| 74 | `app/test-api/page.tsx` |

---

## Components Directory (77 files)

### Admin Components (`components/admin/`) - 14 files
| # | File Path |
|---|-----------|
| 1 | `components/admin/FraudAlertCard.tsx` |
| 2 | `components/admin/FraudPatternBadge.tsx` |
| 3 | `components/admin/affiliate-filters.tsx` |
| 4 | `components/admin/affiliate-stats-banner.tsx` |
| 5 | `components/admin/affiliate-table.tsx` |
| 6 | `components/admin/code-inventory-chart.tsx` |
| 7 | `components/admin/commission-owings-table.tsx` |
| 8 | `components/admin/distribute-codes-modal.tsx` |
| 9 | `components/admin/pay-commission-modal.tsx` |
| 10 | `components/admin/pnl-breakdown-table.tsx` |
| 11 | `components/admin/pnl-summary-cards.tsx` |
| 12 | `components/admin/pnl-trend-chart.tsx` |
| 13 | `components/admin/sales-performance-table.tsx` |
| 14 | `components/admin/suspend-affiliate-modal.tsx` |

### Affiliate Components (`components/affiliate/`) - 3 files
| # | File Path |
|---|-----------|
| 15 | `components/affiliate/code-table.tsx` |
| 16 | `components/affiliate/commission-table.tsx` |
| 17 | `components/affiliate/stats-card.tsx` |

### Alerts Components (`components/alerts/`) - 3 files
| # | File Path |
|---|-----------|
| 18 | `components/alerts/alert-card.tsx` |
| 19 | `components/alerts/alert-form.tsx` |
| 20 | `components/alerts/alert-list.tsx` |

### Auth Components (`components/auth/`) - 4 files
| # | File Path |
|---|-----------|
| 21 | `components/auth/login-form.tsx` |
| 22 | `components/auth/login-tracker.tsx` |
| 23 | `components/auth/register-form.tsx` |
| 24 | `components/auth/social-auth-buttons.tsx` |

### Billing Components (`components/billing/`) - 2 files
| # | File Path |
|---|-----------|
| 25 | `components/billing/invoice-list.tsx` |
| 26 | `components/billing/subscription-card.tsx` |

### Charts Components (`components/charts/`) - 5 files
| # | File Path |
|---|-----------|
| 27 | `components/charts/chart-controls.tsx` |
| 28 | `components/charts/indicator-toggles.tsx` |
| 29 | `components/charts/pro-indicator-overlay.tsx` |
| 30 | `components/charts/timeframe-selector.tsx` |
| 31 | `components/charts/trading-chart.tsx` |

### Dashboard Components (`components/dashboard/`) - 4 files
| # | File Path |
|---|-----------|
| 32 | `components/dashboard/recent-alerts.tsx` |
| 33 | `components/dashboard/stats-card.tsx` |
| 34 | `components/dashboard/upgrade-prompt.tsx` |
| 35 | `components/dashboard/watchlist-widget.tsx` |

### Indicators Components (`components/indicators/`) - 1 file
| # | File Path |
|---|-----------|
| 36 | `components/indicators/indicator-selector.tsx` |

### Layout Components (`components/layout/`) - 4 files
| # | File Path |
|---|-----------|
| 37 | `components/layout/footer.tsx` |
| 38 | `components/layout/header.tsx` |
| 39 | `components/layout/mobile-nav.tsx` |
| 40 | `components/layout/sidebar.tsx` |

### Notifications Components (`components/notifications/`) - 2 files
| # | File Path |
|---|-----------|
| 41 | `components/notifications/notification-bell.tsx` |
| 42 | `components/notifications/notification-list.tsx` |

### Payments Components (`components/payments/`) - 6 files
| # | File Path |
|---|-----------|
| 43 | `components/payments/CountrySelector.tsx` |
| 44 | `components/payments/DiscountCodeInput.tsx` |
| 45 | `components/payments/PaymentButton.tsx` |
| 46 | `components/payments/PaymentMethodSelector.tsx` |
| 47 | `components/payments/PlanSelector.tsx` |
| 48 | `components/payments/PriceDisplay.tsx` |

### Pricing Components (`components/pricing/`) - 1 file
| # | File Path |
|---|-----------|
| 49 | `components/pricing/tier-comparison.tsx` |

### Providers (`components/providers/`) - 2 files
| # | File Path |
|---|-----------|
| 50 | `components/providers/theme-provider.tsx` |
| 51 | `components/providers/websocket-provider.tsx` |

### UI Components (`components/ui/`) - 22 files
| # | File Path |
|---|-----------|
| 52 | `components/ui/alert-dialog.tsx` |
| 53 | `components/ui/avatar.tsx` |
| 54 | `components/ui/badge.tsx` |
| 55 | `components/ui/breadcrumb.tsx` |
| 56 | `components/ui/button.tsx` |
| 57 | `components/ui/card.tsx` |
| 58 | `components/ui/dialog.tsx` |
| 59 | `components/ui/dropdown-menu.tsx` |
| 60 | `components/ui/input.tsx` |
| 61 | `components/ui/label.tsx` |
| 62 | `components/ui/pagination.tsx` |
| 63 | `components/ui/popover.tsx` |
| 64 | `components/ui/progress.tsx` |
| 65 | `components/ui/scroll-area.tsx` |
| 66 | `components/ui/select.tsx` |
| 67 | `components/ui/separator.tsx` |
| 68 | `components/ui/sheet.tsx` |
| 69 | `components/ui/skeleton.tsx` |
| 70 | `components/ui/switch.tsx` |
| 71 | `components/ui/tabs.tsx` |
| 72 | `components/ui/toast-container.tsx` |
| 73 | `components/ui/upgrade-button.tsx` |

### Watchlist Components (`components/watchlist/`) - 3 files
| # | File Path |
|---|-----------|
| 74 | `components/watchlist/symbol-selector.tsx` |
| 75 | `components/watchlist/timeframe-grid.tsx` |
| 76 | `components/watchlist/watchlist-item.tsx` |

### Root Components - 1 file
| # | File Path |
|---|-----------|
| 77 | `components/theme-toggle.tsx` |

---

## Lib Directory (5 files)

### Email Templates (`lib/email/templates/affiliate/`) - 5 files
| # | File Path | Description |
|---|-----------|-------------|
| 1 | `lib/email/templates/affiliate/code-distributed.tsx` | Email when codes are distributed to affiliate |
| 2 | `lib/email/templates/affiliate/code-used.tsx` | Email when affiliate code is redeemed |
| 3 | `lib/email/templates/affiliate/monthly-report.tsx` | Monthly affiliate performance report |
| 4 | `lib/email/templates/affiliate/payment-processed.tsx` | Commission payment confirmation |
| 5 | `lib/email/templates/affiliate/welcome.tsx` | Welcome email for new affiliates |

---

## Directory Structure Overview

```
app/                                  # 74 TSX files
├── (auth)/                           # 8 files - Authentication flows
│   ├── forgot-password/
│   ├── login/
│   ├── register/
│   ├── reset-password/
│   ├── verify-2fa/
│   └── verify-email/
├── (dashboard)/                      # 38 files - Main dashboard
│   ├── admin/                        # 16 files
│   │   ├── api-usage/
│   │   ├── disbursement/             # 10 files
│   │   ├── errors/
│   │   ├── fraud-alerts/
│   │   └── users/
│   ├── alerts/                       # 4 files
│   ├── charts/                       # 3 files
│   ├── dashboard/                    # 1 file
│   ├── settings/                     # 11 files
│   └── watchlist/                    # 2 files
├── (marketing)/                      # 4 files - Landing pages
├── admin/                            # 8 files - Admin affiliate portal
│   ├── affiliates/
│   │   └── reports/                  # 4 files
│   ├── login/
│   └── settings/
├── affiliate/                        # 11 files - Affiliate portal
│   ├── dashboard/                    # 6 files
│   ├── register/
│   └── verify/
├── checkout/                         # 1 file
├── test-api/                         # 1 file
└── [root files]                      # 3 files (error, layout, providers)

components/                           # 77 TSX files
├── admin/                            # 14 files - Admin UI
├── affiliate/                        # 3 files - Affiliate UI
├── alerts/                           # 3 files - Alert components
├── auth/                             # 4 files - Auth forms
├── billing/                          # 2 files - Billing UI
├── charts/                           # 5 files - Trading charts
├── dashboard/                        # 4 files - Dashboard widgets
├── indicators/                       # 1 file - Chart indicators
├── layout/                           # 4 files - Page layouts
├── notifications/                    # 2 files - Notifications
├── payments/                         # 6 files - Payment forms
├── pricing/                          # 1 file - Pricing display
├── providers/                        # 2 files - React contexts
├── ui/                               # 22 files - shadcn/ui
├── watchlist/                        # 3 files - Watchlist UI
└── theme-toggle.tsx                  # 1 file

lib/                                  # 5 TSX files
└── email/
    └── templates/
        └── affiliate/                # 5 files - Email templates
            ├── code-distributed.tsx
            ├── code-used.tsx
            ├── monthly-report.tsx
            ├── payment-processed.tsx
            └── welcome.tsx
```

---

## File Count Summary

### By Directory
| Directory | Count | Percentage |
|-----------|-------|------------|
| `app/` | 74 | 47.4% |
| `components/` | 77 | 49.4% |
| `lib/` | 5 | 3.2% |
| **Total** | **156** | **100%** |

### App Files by Route Group
| Route Group | Files | Percentage |
|-------------|-------|------------|
| `(dashboard)` | 38 | 51.4% |
| `affiliate` | 11 | 14.9% |
| `(auth)` | 8 | 10.8% |
| `admin` | 8 | 10.8% |
| Root files | 5 | 6.8% |
| `(marketing)` | 4 | 5.4% |
| **Total** | **74** | **100%** |

### Components by Category
| Category | Files | Percentage |
|----------|-------|------------|
| `ui/` (shadcn) | 22 | 28.6% |
| `admin/` | 14 | 18.2% |
| `payments/` | 6 | 7.8% |
| `charts/` | 5 | 6.5% |
| `auth/` | 4 | 5.2% |
| `layout/` | 4 | 5.2% |
| `dashboard/` | 4 | 5.2% |
| `affiliate/` | 3 | 3.9% |
| `alerts/` | 3 | 3.9% |
| `watchlist/` | 3 | 3.9% |
| `billing/` | 2 | 2.6% |
| `notifications/` | 2 | 2.6% |
| `providers/` | 2 | 2.6% |
| `indicators/` | 1 | 1.3% |
| `pricing/` | 1 | 1.3% |
| Root | 1 | 1.3% |
| **Total** | **77** | **100%** |

### Lib Files by Category
| Category | Files |
|----------|-------|
| Email Templates (Affiliate) | 5 |
| **Total** | **5** |

---

## File Type Analysis

### Page Files vs Client Components vs Layouts
| Type | Count | Description |
|------|-------|-------------|
| `page.tsx` | 51 | Next.js page components |
| `layout.tsx` | 12 | Next.js layout components |
| `*-client.tsx` | 4 | Client-side components |
| Other `.tsx` | 89 | Reusable components, templates |
| **Total** | **156** | |

### Dynamic Route Segments
| Pattern | Count | Example |
|---------|-------|---------|
| `[id]` | 3 | `app/admin/affiliates/[id]/page.tsx` |
| `[symbol]` | 2 | `app/(dashboard)/charts/[symbol]/...` |
| `[timeframe]` | 2 | `app/(dashboard)/charts/.../[timeframe]/...` |
| `[batchId]` | 1 | `app/(dashboard)/admin/disbursement/batches/[batchId]/page.tsx` |

---

## Feature Coverage

### User-Facing Features
| Feature | Pages | Components |
|---------|-------|------------|
| Authentication | 8 | 4 |
| Dashboard | 2 | 4 |
| Trading Charts | 3 | 5 |
| Alerts | 4 | 3 |
| Watchlist | 2 | 3 |
| Settings | 11 | - |
| Billing | 1 | 2 |
| Checkout | 1 | 6 |

### Admin Features
| Feature | Pages | Components |
|---------|-------|------------|
| User Management | 1 | - |
| Disbursement | 10 | - |
| Fraud Alerts | 2 | 2 |
| API Usage | 1 | - |
| Error Logs | 1 | - |
| Affiliate Reports | 4 | 6 |
| Affiliate Management | 2 | 8 |

### Affiliate Portal
| Feature | Pages | Components | Email Templates |
|---------|-------|------------|-----------------|
| Dashboard | 1 | 1 | - |
| Codes | 1 | 1 | 2 |
| Commissions | 1 | 1 | 1 |
| Profile | 2 | - | 1 |
| Registration | 1 | - | 1 |
| Verification | 1 | - | - |

---

## Notes

1. **Architecture**: Next.js 14 App Router with monolith structure
2. **Route Groups**: Uses `(auth)`, `(dashboard)`, `(marketing)` for organization
3. **UI Library**: shadcn/ui components in `components/ui/`
4. **Email Templates**: React Email templates in `lib/email/templates/`
5. **Client Components**: Files with `-client.tsx` suffix for client-side interactivity
6. **Dynamic Routes**: Uses `[param]` syntax for URL parameters
7. **Layouts**: Nested layouts for consistent UI across route groups

---

*This inventory was generated by examining the actual filesystem on 2026-01-26*
