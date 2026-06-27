# Frontend UI Files Inventory

**Last Updated:** 2026-06-27
**Total Files:** 154
**Purpose:** Complete inventory of all frontend UI files that create user visualization and/or allow user interaction

---

## Definition

**Frontend UI File** is defined as a file that:
- Creates user visualization (readable UI elements), AND/OR
- Allows user interaction (interactive UI elements)

---

## Complete Inventory Table

| NO. | Part | Paths and Filenames | Interactive UI Element | Readable UI Element |
|-----|------|---------------------|------------------------|---------------------|
| 1 | Part 05 | `app/(auth)/layout.tsx` |  | YES |
| 2 | Part 05 | `app/(auth)/login/page.tsx` | YES | YES |
| 3 | Part 05 | `app/(auth)/register/page.tsx` | YES | YES |
| 4 | Part 05 | `app/(auth)/verify-email/page.tsx` | YES | YES |
| 5 | Part 05 | `app/(auth)/verify-email/pending/page.tsx` |  | YES |
| 6 | Part 05 | `app/(auth)/forgot-password/page.tsx` | YES | YES |
| 7 | Part 05 | `app/(auth)/reset-password/page.tsx` | YES | YES |
| 8 | Part 05 | `app/admin/login/page.tsx` | YES | YES |
| 9 | Part 05 | `components/auth/register-form.tsx` | YES | YES |
| 10 | Part 05 | `components/auth/login-form.tsx` | YES | YES |
| 11 | Part 05 | `components/auth/social-auth-buttons.tsx` | YES |  |
| 12 | Part 08 | `app/(dashboard)/layout.tsx` | YES | YES |
| 13 | Part 08 | `app/(dashboard)/dashboard/page.tsx` | YES | YES |
| 14 | Part 08 | `app/(dashboard)/alerts/page.tsx` | YES | YES |
| 15 | Part 08 | `app/(dashboard)/alerts/new/page.tsx` | YES | YES |
| 16 | Part 08 | `app/(dashboard)/alerts/alerts-client.tsx` | YES | YES |
| 17 | Part 08 | `app/(dashboard)/watchlist/page.tsx` | YES | YES |
| 18 | Part 08 | `app/(dashboard)/watchlist/watchlist-client.tsx` | YES | YES |
| 19 | Part 08 | `app/(dashboard)/charts/page.tsx` | YES | YES |
| 20 | Part 08 | `app/(dashboard)/charts/[symbol]/[timeframe]/page.tsx` | YES | YES |
| 21 | Part 08 | `app/(dashboard)/settings/layout.tsx` | YES | YES |
| 22 | Part 08 | `app/(dashboard)/settings/page.tsx` | YES | YES |
| 23 | Part 08 | `app/(dashboard)/settings/account/page.tsx` | YES | YES |
| 24 | Part 08 | `app/(dashboard)/settings/appearance/page.tsx` | YES | YES |
| 25 | Part 08 | `app/(dashboard)/settings/billing/page.tsx` | YES | YES |
| 26 | Part 08 | `app/(dashboard)/settings/help/page.tsx` | YES | YES |
| 27 | Part 08 | `app/(dashboard)/settings/language/page.tsx` | YES | YES |
| 28 | Part 08 | `app/(dashboard)/settings/privacy/page.tsx` | YES | YES |
| 29 | Part 08 | `app/(dashboard)/settings/profile/page.tsx` | YES | YES |
| 30 | Part 08 | `app/(dashboard)/settings/security/page.tsx` | YES | YES |
| 31 | Part 08 | `app/(dashboard)/settings/terms/page.tsx` |  | YES |
| 32 | Part 08 | `app/(dashboard)/admin/page.tsx` | YES | YES |
| 33 | Part 08 | `app/(dashboard)/admin/users/page.tsx` | YES | YES |
| 34 | Part 08 | `app/(dashboard)/admin/fraud-alerts/page.tsx` | YES | YES |
| 35 | Part 08 | `app/(dashboard)/admin/api-usage/page.tsx` | YES | YES |
| 36 | Part 08 | `app/(dashboard)/admin/errors/page.tsx` | YES | YES |
| 37 | Part 08 | `components/dashboard/stats-card.tsx` |  | YES |
| 38 | Part 08 | `components/dashboard/recent-alerts.tsx` | YES | YES |
| 39 | Part 08 | `components/dashboard/watchlist-widget.tsx` | YES | YES |
| 40 | Part 08 | `components/dashboard/upgrade-prompt.tsx` | YES | YES |
| 41 | Part 08 | `components/layout/header.tsx` | YES | YES |
| 42 | Part 08 | `components/layout/sidebar.tsx` | YES | YES |
| 43 | Part 08 | `components/layout/mobile-nav.tsx` | YES | YES |
| 44 | Part 08 | `components/layout/footer.tsx` |  | YES |
| 45 | Part 09 | `app/(dashboard)/charts/[symbol]/[timeframe]/trading-chart-client.tsx` | YES | YES |
| 46 | Part 09 | `components/charts/trading-chart.tsx` | YES | YES |
| 47 | Part 09 | `components/charts/pro-indicator-overlay.tsx` | YES | YES |
| 48 | Part 09 | `components/charts/indicator-toggles.tsx` | YES | YES |
| 49 | Part 09 | `components/charts/chart-controls.tsx` | YES | YES |
| 50 | Part 09 | `components/charts/timeframe-selector.tsx` | YES | YES |
| 51 | Part 10 | `components/watchlist/symbol-selector.tsx` | YES | YES |
| 52 | Part 10 | `components/watchlist/timeframe-grid.tsx` | YES | YES |
| 53 | Part 10 | `components/watchlist/watchlist-item.tsx` | YES | YES |
| 54 | Part 11 | `components/alerts/alert-card.tsx` | YES | YES |
| 55 | Part 11 | `components/alerts/alert-form.tsx` | YES | YES |
| 56 | Part 11 | `components/alerts/alert-list.tsx` | YES | YES |
| 57 | Part 11 | `app/(dashboard)/alerts/new/create-alert-client.tsx` | YES | YES |
| 58 | Part 12 | `app/(marketing)/pricing/page.tsx` | YES | YES |
| 59 | Part 12 | `components/billing/subscription-card.tsx` | YES | YES |
| 60 | Part 12 | `components/billing/invoice-list.tsx` |  | YES |
| 61 | Part 12 | `components/pricing/tier-comparison.tsx` |  | YES |
| 62 | Part 14 | `components/admin/FraudAlertCard.tsx` | YES | YES |
| 63 | Part 14 | `components/admin/FraudPatternBadge.tsx` |  | YES |
| 64 | Part 14 | `components/admin/affiliate-filters.tsx` | YES | YES |
| 65 | Part 14 | `components/admin/affiliate-stats-banner.tsx` |  | YES |
| 66 | Part 14 | `components/admin/affiliate-table.tsx` | YES | YES |
| 67 | Part 14 | `components/admin/code-inventory-chart.tsx` |  | YES |
| 68 | Part 14 | `components/admin/commission-owings-table.tsx` | YES | YES |
| 69 | Part 14 | `components/admin/distribute-codes-modal.tsx` | YES | YES |
| 70 | Part 14 | `components/admin/pay-commission-modal.tsx` | YES | YES |
| 71 | Part 14 | `components/admin/pnl-breakdown-table.tsx` |  | YES |
| 72 | Part 14 | `components/admin/pnl-summary-cards.tsx` |  | YES |
| 73 | Part 14 | `components/admin/pnl-trend-chart.tsx` |  | YES |
| 74 | Part 14 | `components/admin/sales-performance-table.tsx` |  | YES |
| 75 | Part 14 | `components/admin/suspend-affiliate-modal.tsx` | YES | YES |
| 76 | Part 15 | `components/notifications/notification-bell.tsx` | YES | YES |
| 77 | Part 15 | `components/notifications/notification-list.tsx` | YES | YES |
| 78 | Part 16 | `app/layout.tsx` |  | YES |
| 79 | Part 16 | `app/(marketing)/layout.tsx` |  | YES |
| 80 | Part 16 | `app/(marketing)/page.tsx` | YES | YES |
| 81 | Part 17A-2 | `components/affiliate/stats-card.tsx` |  | YES |
| 82 | Part 17A-2 | `components/affiliate/code-table.tsx` | YES | YES |
| 83 | Part 17A-2 | `components/affiliate/commission-table.tsx` |  | YES |
| 84 | Part 17A-2 | `app/affiliate/register/page.tsx` | YES | YES |
| 85 | Part 17A-2 | `app/affiliate/verify/page.tsx` | YES | YES |
| 86 | Part 17A-2 | `app/affiliate/dashboard/page.tsx` | YES | YES |
| 87 | Part 17A-2 | `app/affiliate/dashboard/codes/page.tsx` | YES | YES |
| 88 | Part 17A-2 | `app/affiliate/dashboard/commissions/page.tsx` | YES | YES |
| 89 | Part 17A-2 | `app/affiliate/dashboard/profile/page.tsx` | YES | YES |
| 90 | Part 17A-2 | `app/affiliate/dashboard/profile/payment/page.tsx` | YES | YES |
| 91 | Part 17B-1 | `app/admin/affiliates/page.tsx` | YES | YES |
| 92 | Part 17B-1 | `app/admin/affiliates/[id]/page.tsx` | YES | YES |
| 93 | Part 17B-1 | `app/admin/affiliates/reports/profit-loss/page.tsx` | YES | YES |
| 94 | Part 17B-1 | `app/admin/affiliates/reports/sales-performance/page.tsx` | YES | YES |
| 95 | Part 17B-1 | `app/admin/affiliates/reports/commission-owings/page.tsx` | YES | YES |
| 96 | Part 17B-1 | `app/admin/affiliates/reports/code-inventory/page.tsx` | YES | YES |
| 97 | Part 17B-1 | `app/admin/settings/affiliate/page.tsx` | YES | YES |
| 98 | Part 18C | `components/payments/CountrySelector.tsx` | YES | YES |
| 99 | Part 18C | `components/payments/PlanSelector.tsx` | YES | YES |
| 100 | Part 18C | `components/payments/PaymentMethodSelector.tsx` | YES | YES |
| 101 | Part 18C | `components/payments/PriceDisplay.tsx` |  | YES |
| 102 | Part 18C | `components/payments/DiscountCodeInput.tsx` | YES | YES |
| 103 | Part 18C | `components/payments/PaymentButton.tsx` | YES |  |
| 104 | Part 18C | `app/checkout/page.tsx` | YES | YES |
| 105 | Part 19D | `app/(dashboard)/admin/disbursement/layout.tsx` | YES | YES |
| 106 | Part 19D | `app/(dashboard)/admin/disbursement/page.tsx` | YES | YES |
| 107 | Part 19D | `app/(dashboard)/admin/disbursement/affiliates/page.tsx` | YES | YES |
| 108 | Part 19D | `app/(dashboard)/admin/disbursement/batches/page.tsx` | YES | YES |
| 109 | Part 19D | `app/(dashboard)/admin/disbursement/batches/[batchId]/page.tsx` | YES | YES |
| 110 | Part 19D | `app/(dashboard)/admin/disbursement/transactions/page.tsx` | YES | YES |
| 111 | Part 19D | `app/(dashboard)/admin/disbursement/audit/page.tsx` | YES | YES |
| 112 | Part 19D | `app/(dashboard)/admin/disbursement/config/page.tsx` | YES | YES |
| 113 | Part 19D | `app/(dashboard)/admin/disbursement/accounts/page.tsx` | YES | YES |
| 114 | Drawing Engine | `components/charts/drawing/Toolbar.tsx` | YES | YES |
| 115 | Drawing Engine | `components/charts/drawing/DrawingLayer.tsx` | YES | YES |
| 116 | Part 05 | `app/(auth)/loading.tsx` |  | YES |
| 117 | Part 05 | `app/(auth)/verify-2fa/page.tsx` | YES | YES |
| 118 | Part 08 | `app/(dashboard)/admin/fraud-alerts/[id]/page.tsx` | YES | YES |
| 119 | Part 08 | `app/(dashboard)/admin/layout.tsx` | YES | YES |
| 120 | Part 08 | `app/(dashboard)/admin/loading.tsx` |  | YES |
| 121 | Part 08 | `app/(dashboard)/alerts/loading.tsx` |  | YES |
| 122 | Part 08 | `app/(dashboard)/charts/loading.tsx` |  | YES |
| 123 | Part 08 | `app/(dashboard)/dashboard/loading.tsx` |  | YES |
| 124 | Part 08 | `app/(dashboard)/settings/loading.tsx` |  | YES |
| 125 | Part 16 | `app/(marketing)/landing-content.tsx` | YES | YES |
| 126 | Part 17A-2 | `app/affiliate/dashboard/layout.tsx` | YES | YES |
| 127 | Part 17A-2 | `app/affiliate/layout.tsx` |  | YES |
| 128 | Part 17A-2 | `app/affiliate/register/layout.tsx` |  | YES |
| 129 | Part 17A-2 | `app/affiliate/verify/layout.tsx` |  | YES |
| 130 | Part 16 | `app/api-test/page.tsx` | YES | YES |
| 131 | Part 09 | `components/indicators/indicator-selector.tsx` | YES | YES |
| 132 | Part 16 | `components/theme-toggle.tsx` | YES | YES |
| 133 | Part 16 | `components/ui/alert-dialog.tsx` | YES | YES |
| 134 | Part 16 | `components/ui/avatar.tsx` |  | YES |
| 135 | Part 16 | `components/ui/badge.tsx` |  | YES |
| 136 | Part 16 | `components/ui/breadcrumb.tsx` | YES | YES |
| 137 | Part 16 | `components/ui/button.tsx` | YES | YES |
| 138 | Part 16 | `components/ui/card.tsx` |  | YES |
| 139 | Part 16 | `components/ui/dialog.tsx` | YES | YES |
| 140 | Part 16 | `components/ui/dropdown-menu.tsx` | YES | YES |
| 141 | Part 16 | `components/ui/input.tsx` | YES | YES |
| 142 | Part 16 | `components/ui/label.tsx` |  | YES |
| 143 | Part 16 | `components/ui/pagination.tsx` | YES | YES |
| 144 | Part 16 | `components/ui/popover.tsx` | YES | YES |
| 145 | Part 16 | `components/ui/progress.tsx` |  | YES |
| 146 | Part 16 | `components/ui/scroll-area.tsx` | YES | YES |
| 147 | Part 16 | `components/ui/select.tsx` | YES | YES |
| 148 | Part 16 | `components/ui/separator.tsx` |  | YES |
| 149 | Part 16 | `components/ui/sheet.tsx` | YES | YES |
| 150 | Part 16 | `components/ui/skeleton.tsx` |  | YES |
| 151 | Part 16 | `components/ui/switch.tsx` | YES | YES |
| 152 | Part 16 | `components/ui/tabs.tsx` | YES | YES |
| 153 | Part 16 | `components/ui/toast-container.tsx` | YES | YES |
| 154 | Part 16 | `components/ui/upgrade-button.tsx` | YES | YES |

---

## Summary Statistics

### Total Counts
- **Total Frontend UI Files:** 154
- **Files with Interactive Elements:** 119
- **Files with Readable Elements:** 152
- **Interactive + Readable:** 117
- **Readable Only:** 35
- **Interactive Only:** 2

### Distribution by Part

| Part | File Count | Percentage |
|------|------------|------------|
| Part 05 (Authentication) | 13 | 8.4% |
| Part 08 (Dashboard & Layout) | 40 | 26.0% |
| Part 09 (Charts) | 7 | 4.5% |
| Part 10 (Watchlist) | 3 | 1.9% |
| Part 11 (Alerts) | 4 | 2.6% |
| Part 12 (Billing/Pricing) | 4 | 2.6% |
| Part 14 (Admin Tools) | 14 | 9.1% |
| Part 15 (Notifications) | 2 | 1.3% |
| Part 16 (Infrastructure & Shared UI) | 28 | 18.2% |
| Part 17A-2 (Affiliate Portal) | 14 | 9.1% |
| Part 17B-1 (Admin Affiliate) | 7 | 4.5% |
| Part 18C (Payment UX) | 7 | 4.5% |
| Part 19D (Disbursement UI) | 9 | 5.8% |
| Drawing Engine (Chart Drawing Tools) | 2 | 1.3% |

### Distribution by Type

| Category | File Count | Percentage |
|----------|------------|------------|
| Pages | 56 | 36.4% |
| Components | 81 | 52.6% |
| Layouts | 11 | 7.1% |
| Loading states | 6 | 3.9% |

### Distribution by User Role

| User Role | File Count | Key Areas |
|-----------|------------|-----------|
| **End Users** | 57 | Dashboard, Alerts, Charts (incl. drawing tools), Watchlist, Settings |
| **Affiliates** | 14 | Registration, Dashboard, Commissions, Profile |
| **Admins** | 38 | User Management, Fraud Detection, Disbursements, Reports |
| **Public/Marketing** | 4 | Landing Page, Pricing |
| **Authentication** | 10 | Login, Register, Password Reset, Verification, 2FA |
| **Shared/Infrastructure** | 31 | Layouts, Notifications, Billing, shadcn/ui primitives, Theme |

> User-role counts use a path-based heuristic and are approximate; the per-file
> source of truth is the inventory table above.

---

## Reconciliation Note (2026-06-26)

This inventory was reconciled against the actual `frontend/` UI stack (which mirrors the
monolith root). The frontend codebase was **ahead** of this document, so the document — not the
code — was corrected. Net change: **126 → 154** rows.

**Removed (11 phantom rows):** the **plural** `app/(dashboard)/admin/disbursements/…` page set.
These paths exist nowhere in the codebase; they were stale duplicates of the real **singular**
`app/(dashboard)/admin/disbursement/…` set already listed under Part 19D.

**Renamed (1 row):** `app/(dashboard)/admin/error-logs/page.tsx` → `app/(dashboard)/admin/errors/page.tsx`
(the real path).

**Added (39 real UI files):** `loading.tsx` states, `verify-2fa` page, the `admin/layout.tsx`,
`fraud-alerts/[id]` page, affiliate route `layout.tsx` wrappers, `(marketing)/landing-content.tsx`,
`api-test` page, `indicators/indicator-selector.tsx`, `theme-toggle.tsx`, and the full
`components/ui/*` shadcn primitive library (22 files).

**Deliberately NOT added (kept out of the frontend-UI inventory):**
- `app/error.tsx`, `components/providers/theme-provider.tsx`, `components/providers/websocket-provider.tsx`
  — already inventoried in `backend-file-inventory.md`; adding them here would duplicate across inventories.
- `app/providers.tsx`, `components/auth/login-tracker.tsx` — non-visual infrastructure that renders no
  UI (`login-tracker` literally `return null`).

No files in `frontend/` were created, deleted, or modified by this reconciliation, and the separate
`drawing-engine-line-alerts-files-completion.md` was not touched.

## Reconciliation Note (2026-06-27) — root ↔ frontend/ UI content sync

A follow-up pass synced `frontend/` UI **content** to root (root was canonical). These were
content edits to already-listed files, so **no table rows changed** and counts are unaffected:

- **Charts (Phase A):** added `frontend/hooks/use-ohlcv-socket.ts` (a hook — tracked in
  `backend-file-inventory.md`, not here) to fix a broken import, and dropped the stale `tier`
  prop from `charts/[symbol]/[timeframe]/page.tsx` + `trading-chart-client.tsx`.
- **Checkout (Phase B):** `app/checkout/page.tsx` now matches root's Stripe-primary + dLocal flow.
- **Whitespace (Phase C):** `app/(auth)/verify-email/pending/page.tsx` normalized.
- **Fonts (Phase D):** `app/layout.tsx` restored the `Inter` Google Font (deployment requires it).

`app/api-test/page.tsx` (row 130) remains intentionally `frontend/`-only — it exercises the
api-client layer that the root monolith does not have.

---

## Key Features by Category

### Authentication (13 files)
- Login/Register flows
- Email verification
- Password reset
- Social auth integration
- Admin login

### Dashboard & Core App (44 files)
- Main dashboard with stats
- Alert management
- Chart visualization
- Watchlist management
- Settings (9 pages)
- Admin tools (15+ pages)
- Layout components (header, sidebar, footer)

### Charts & Data Visualization (8 files)
- Interactive trading charts
- Timeframe selector
- Indicator toggles
- PRO feature overlays
- Chart controls
- Drawing toolbar (6-tool selector) — `components/charts/drawing/Toolbar.tsx`
- Drawing overlay layer (pointer-driven canvas) — `components/charts/drawing/DrawingLayer.tsx`

> Note: only the `.tsx` UI surfaces of the drawing engine appear here. The drawing
> geometry/engine/marks `.ts` logic modules are inventoried in `backend-file-inventory.md`
> per the repo's `.tsx`=frontend / `.ts`=backend convention.

### Alerts System (4 files)
- Alert creation form
- Alert card display
- Alert list with filters
- Recent alerts widget

### Watchlist (3 files)
- Symbol selector
- Timeframe grid
- Watchlist item cards

### Billing & Payments (11 files)
- Pricing page with tier comparison
- Payment checkout flow
- Country/payment method selection
- Subscription management
- Invoice display

### Admin Tools (39 files)
- User management
- Fraud alert monitoring
- Affiliate management
- Commission tracking
- Disbursement system (9 pages)
- Business intelligence reports
- API usage monitoring
- Error log viewer

### Affiliate Portal (10 files)
- Registration/verification
- Dashboard with earnings stats
- Code management
- Commission tracking
- Payment profile

### Notifications (2 files)
- Notification bell
- Notification list/dropdown

---

## Notes

### File Naming Conventions
- **Pages:** Use `page.tsx` in app directory
- **Client Components:** Often suffixed with `-client.tsx` when server component wrapper exists
- **Components:** Kebab-case in `components/` directory
- **Layouts:** Use `layout.tsx` in app directory

### UI Framework
- **Framework:** React 18+ with Next.js 14 App Router
- **Styling:** Tailwind CSS with dark mode support
- **Components:** shadcn/ui component library
- **Icons:** Lucide React icons

### Accessibility
- All interactive components support keyboard navigation
- ARIA labels on interactive elements
- Semantic HTML structure
- Color contrast compliance

### Responsive Design
- Mobile-first approach
- Breakpoints: sm (640px), md (768px), lg (1024px), xl (1280px)
- Mobile navigation components
- Responsive tables and grids

---

## Source Files

This inventory was compiled from the following source documents:
1. `docs/files-completion-list/files-inventory/part-02-files-completion.md`
2. `docs/files-completion-list/files-inventory/part-03-files-completion.md`
3. `docs/files-completion-list/files-inventory/part-04-files-completion.md`
4. `docs/files-completion-list/files-inventory/part-05-files-completion.md`
5. `docs/files-completion-list/files-inventory/part-06-files-completion.md`
6. `docs/files-completion-list/files-inventory/part-07-files-completion.md`
7. `docs/files-completion-list/files-inventory/part-08-files-completion.md`
8. `docs/files-completion-list/files-inventory/part-09-files-completion.md`
9. `docs/files-completion-list/files-inventory/part-10-files-completion.md`
10. `docs/files-completion-list/files-inventory/part-11-files-completion.md`
11. `docs/files-completion-list/files-inventory/part-12-files-completion.md`
12. `docs/files-completion-list/files-inventory/part-13-files-completion.md`
13. `docs/files-completion-list/files-inventory/part-14-files-completion.md`
14. `docs/files-completion-list/files-inventory/part-15-files-completion.md`
15. `docs/files-completion-list/files-inventory/part-16-files-completion.md`
16. `docs/files-completion-list/files-inventory/part17a1-files-completion.md`
17. `docs/files-completion-list/files-inventory/part17a2-files-completion.md`
18. `docs/files-completion-list/files-inventory/part17b1-files-completion.md`
19. `docs/files-completion-list/files-inventory/part17b2-files-completion.md`
20. `docs/files-completion-list/files-inventory/part-18a-files-completion.md`
21. `docs/files-completion-list/files-inventory/part-18b-files-completion.md`
22. `docs/files-completion-list/files-inventory/part-18c-files-completion.md`
23. `docs/files-completion-list/files-inventory/part19a-files-completion.md`
24. `docs/files-completion-list/files-inventory/part19b-files-completion.md`
25. `docs/files-completion-list/files-inventory/part19c-files-completion.md`
26. `docs/files-completion-list/files-inventory/part19d-files-completion.md`
27. `docs/files-completion-list/files-inventory/drawing-engine-line-alerts-files-completion.md`

---

**Compiled:** 2026-06-26
**Status:** Complete ✅
