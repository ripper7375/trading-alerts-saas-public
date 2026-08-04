# Frontend UI Files Inventory

**Last Updated:** 2026-08-04
**Total Files:** 168
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
| 1   | Part 05        | `app/(auth)/layout.tsx`                                                |                        | YES                 |
| 2   | Part 05        | `app/(auth)/login/page.tsx`                                            | YES                    | YES                 |
| 3   | Part 05        | `app/(auth)/register/page.tsx`                                         | YES                    | YES                 |
| 4   | Part 05        | `app/(auth)/verify-email/page.tsx`                                     | YES                    | YES                 |
| 5   | Part 05        | `app/(auth)/verify-email/pending/page.tsx`                             |                        | YES                 |
| 6   | Part 05        | `app/(auth)/forgot-password/page.tsx`                                  | YES                    | YES                 |
| 7   | Part 05        | `app/(auth)/reset-password/page.tsx`                                   | YES                    | YES                 |
| 8   | Part 05        | `app/admin/login/page.tsx`                                             | YES                    | YES                 |
| 9   | Part 05        | `components/auth/register-form.tsx`                                    | YES                    | YES                 |
| 10  | Part 05        | `components/auth/login-form.tsx`                                       | YES                    | YES                 |
| 11  | Part 05        | `components/auth/social-auth-buttons.tsx`                              | YES                    |                     |
| 12  | Part 08        | `app/(dashboard)/layout.tsx`                                           | YES                    | YES                 |
| 13  | Part 08        | `app/(dashboard)/dashboard/page.tsx`                                   | YES                    | YES                 |
| 14  | Part 08        | `app/(dashboard)/alerts/page.tsx`                                      | YES                    | YES                 |
| 15  | Part 08        | `app/(dashboard)/alerts/new/page.tsx`                                  | YES                    | YES                 |
| 16  | Part 08        | `app/(dashboard)/alerts/alerts-client.tsx`                             | YES                    | YES                 |
| 17  | Part 08        | `app/(dashboard)/charts/page.tsx`                                      | YES                    | YES                 |
| 18  | Part 08        | `app/(dashboard)/charts/[symbol]/[timeframe]/page.tsx`                 | YES                    | YES                 |
| 19  | Part 08        | `app/(dashboard)/settings/layout.tsx`                                  | YES                    | YES                 |
| 20  | Part 08        | `app/(dashboard)/settings/page.tsx`                                    | YES                    | YES                 |
| 21  | Part 08        | `app/(dashboard)/settings/account/page.tsx`                            | YES                    | YES                 |
| 22  | Part 08        | `app/(dashboard)/settings/appearance/page.tsx`                         | YES                    | YES                 |
| 23  | Part 08        | `app/(dashboard)/settings/billing/page.tsx`                            | YES                    | YES                 |
| 24  | Part 08        | `app/(dashboard)/settings/help/page.tsx`                               | YES                    | YES                 |
| 25  | Part 08        | `app/(dashboard)/settings/language/page.tsx`                           | YES                    | YES                 |
| 26  | Part 08        | `app/(dashboard)/settings/privacy/page.tsx`                            | YES                    | YES                 |
| 27  | Part 08        | `app/(dashboard)/settings/profile/page.tsx`                            | YES                    | YES                 |
| 28  | Part 08        | `app/(dashboard)/settings/security/page.tsx`                           | YES                    | YES                 |
| 29  | Part 08        | `app/(dashboard)/settings/terms/page.tsx`                              |                        | YES                 |
| 30  | Part 08        | `app/(dashboard)/admin/page.tsx`                                       | YES                    | YES                 |
| 31  | Part 08        | `app/(dashboard)/admin/users/page.tsx`                                 | YES                    | YES                 |
| 32  | Part 08        | `app/(dashboard)/admin/fraud-alerts/page.tsx`                          | YES                    | YES                 |
| 33  | Part 08        | `app/(dashboard)/admin/api-usage/page.tsx`                             | YES                    | YES                 |
| 34  | Part 08        | `app/(dashboard)/admin/errors/page.tsx`                                | YES                    | YES                 |
| 35  | Part 08        | `components/dashboard/stats-card.tsx`                                  |                        | YES                 |
| 36  | Part 08        | `components/dashboard/recent-alerts.tsx`                               | YES                    | YES                 |
| 37  | Part 08        | `components/dashboard/upgrade-prompt.tsx`                              | YES                    | YES                 |
| 38  | Part 08        | `components/layout/header.tsx`                                         | YES                    | YES                 |
| 39  | Part 08        | `components/layout/sidebar.tsx`                                        | YES                    | YES                 |
| 40  | Part 08        | `components/layout/mobile-nav.tsx`                                     | YES                    | YES                 |
| 41  | Part 08        | `components/layout/footer.tsx`                                         |                        | YES                 |
| 42  | Part 09        | `app/(dashboard)/charts/[symbol]/[timeframe]/trading-chart-client.tsx` | YES                    | YES                 |
| 43  | Part 09        | `components/charts/trading-chart.tsx`                                  | YES                    | YES                 |
| 44  | Part 09        | `components/charts/chart-controls.tsx`                                 | YES                    | YES                 |
| 45  | Part 09        | `components/charts/timeframe-selector.tsx`                             | YES                    | YES                 |
| 46  | Part 09        | `components/charts/mtf/MtfToggle.tsx`                                  | YES                    | YES                 |
| 47  | Part 11        | `components/alerts/alert-card.tsx`                                     | YES                    | YES                 |
| 48  | Part 11        | `components/alerts/alert-form.tsx`                                     | YES                    | YES                 |
| 49  | Part 11        | `components/alerts/alert-list.tsx`                                     | YES                    | YES                 |
| 50  | Part 11        | `app/(dashboard)/alerts/new/create-alert-client.tsx`                   | YES                    | YES                 |
| 51  | Part 11        | `components/alerts/alerts-pro-upgrade.tsx`                             | YES                    | YES                 |
| 52  | Part 12        | `app/(marketing)/pricing/page.tsx`                                     | YES                    | YES                 |
| 53  | Part 12        | `components/billing/subscription-card.tsx`                             | YES                    | YES                 |
| 54  | Part 12        | `components/billing/invoice-list.tsx`                                  |                        | YES                 |
| 55  | Part 12        | `components/pricing/tier-comparison.tsx`                               |                        | YES                 |
| 56  | Part 14        | `components/admin/FraudAlertCard.tsx`                                  | YES                    | YES                 |
| 57  | Part 14        | `components/admin/FraudPatternBadge.tsx`                               |                        | YES                 |
| 58  | Part 14        | `components/admin/affiliate-filters.tsx`                               | YES                    | YES                 |
| 59  | Part 14        | `components/admin/affiliate-stats-banner.tsx`                          |                        | YES                 |
| 60  | Part 14        | `components/admin/affiliate-table.tsx`                                 | YES                    | YES                 |
| 61  | Part 14        | `components/admin/code-inventory-chart.tsx`                            |                        | YES                 |
| 62  | Part 14        | `components/admin/commission-owings-table.tsx`                         | YES                    | YES                 |
| 63  | Part 14        | `components/admin/distribute-codes-modal.tsx`                          | YES                    | YES                 |
| 64  | Part 14        | `components/admin/pay-commission-modal.tsx`                            | YES                    | YES                 |
| 65  | Part 14        | `components/admin/pnl-breakdown-table.tsx`                             |                        | YES                 |
| 66  | Part 14        | `components/admin/pnl-summary-cards.tsx`                               |                        | YES                 |
| 67  | Part 14        | `components/admin/pnl-trend-chart.tsx`                                 |                        | YES                 |
| 68  | Part 14        | `components/admin/sales-performance-table.tsx`                         |                        | YES                 |
| 69  | Part 14        | `components/admin/suspend-affiliate-modal.tsx`                         | YES                    | YES                 |
| 70  | Part 15        | `components/notifications/notification-bell.tsx`                       | YES                    | YES                 |
| 71  | Part 15        | `components/notifications/notification-list.tsx`                       | YES                    | YES                 |
| 72  | Part 16        | `app/layout.tsx`                                                       |                        | YES                 |
| 73  | Part 16        | `app/(marketing)/layout.tsx`                                           |                        | YES                 |
| 74  | Part 16        | `app/(marketing)/page.tsx`                                             | YES                    | YES                 |
| 75  | Part 17A-2     | `components/affiliate/stats-card.tsx`                                  |                        | YES                 |
| 76  | Part 17A-2     | `components/affiliate/code-table.tsx`                                  | YES                    | YES                 |
| 77  | Part 17A-2     | `components/affiliate/commission-table.tsx`                            |                        | YES                 |
| 78  | Part 17A-2     | `app/affiliate/register/page.tsx`                                      | YES                    | YES                 |
| 79  | Part 17A-2     | `app/affiliate/verify/page.tsx`                                        | YES                    | YES                 |
| 80  | Part 17A-2     | `app/affiliate/dashboard/page.tsx`                                     | YES                    | YES                 |
| 81  | Part 17A-2     | `app/affiliate/dashboard/codes/page.tsx`                               | YES                    | YES                 |
| 82  | Part 17A-2     | `app/affiliate/dashboard/commissions/page.tsx`                         | YES                    | YES                 |
| 83  | Part 17A-2     | `app/affiliate/dashboard/profile/page.tsx`                             | YES                    | YES                 |
| 84  | Part 17A-2     | `app/affiliate/dashboard/profile/payment/page.tsx`                     | YES                    | YES                 |
| 85  | Part 17B-1     | `app/admin/affiliates/page.tsx`                                        | YES                    | YES                 |
| 86  | Part 17B-1     | `app/admin/affiliates/[id]/page.tsx`                                   | YES                    | YES                 |
| 87  | Part 17B-1     | `app/admin/affiliates/reports/profit-loss/page.tsx`                    | YES                    | YES                 |
| 88  | Part 17B-1     | `app/admin/affiliates/reports/sales-performance/page.tsx`              | YES                    | YES                 |
| 89  | Part 17B-1     | `app/admin/affiliates/reports/commission-owings/page.tsx`              | YES                    | YES                 |
| 90  | Part 17B-1     | `app/admin/affiliates/reports/code-inventory/page.tsx`                 | YES                    | YES                 |
| 91  | Part 17B-1     | `app/admin/settings/affiliate/page.tsx`                                | YES                    | YES                 |
| 92  | Part 18C       | `components/payments/CountrySelector.tsx`                              | YES                    | YES                 |
| 93  | Part 18C       | `components/payments/PlanSelector.tsx`                                 | YES                    | YES                 |
| 94  | Part 18C       | `components/payments/PaymentMethodSelector.tsx`                        | YES                    | YES                 |
| 95  | Part 18C       | `components/payments/PriceDisplay.tsx`                                 |                        | YES                 |
| 96  | Part 18C       | `components/payments/DiscountCodeInput.tsx`                            | YES                    | YES                 |
| 97  | Part 18C       | `components/payments/PaymentButton.tsx`                                | YES                    |                     |
| 98  | Part 18C       | `app/checkout/page.tsx`                                                | YES                    | YES                 |
| 99  | Part 19D       | `app/(dashboard)/admin/disbursement/layout.tsx`                        | YES                    | YES                 |
| 100 | Part 19D       | `app/(dashboard)/admin/disbursement/page.tsx`                          | YES                    | YES                 |
| 101 | Part 19D       | `app/(dashboard)/admin/disbursement/affiliates/page.tsx`               | YES                    | YES                 |
| 102 | Part 19D       | `app/(dashboard)/admin/disbursement/batches/page.tsx`                  | YES                    | YES                 |
| 103 | Part 19D       | `app/(dashboard)/admin/disbursement/batches/[batchId]/page.tsx`        | YES                    | YES                 |
| 104 | Part 19D       | `app/(dashboard)/admin/disbursement/transactions/page.tsx`             | YES                    | YES                 |
| 105 | Part 19D       | `app/(dashboard)/admin/disbursement/audit/page.tsx`                    | YES                    | YES                 |
| 106 | Part 19D       | `app/(dashboard)/admin/disbursement/config/page.tsx`                   | YES                    | YES                 |
| 107 | Part 19D       | `app/(dashboard)/admin/disbursement/accounts/page.tsx`                 | YES                    | YES                 |
| 108 | Drawing Engine | `components/charts/drawing/Toolbar.tsx`                                | YES                    | YES                 |
| 109 | Drawing Engine | `components/charts/drawing/DrawingLayer.tsx`                           | YES                    | YES                 |
| 110 | Part 05        | `app/(auth)/loading.tsx`                                               |                        | YES                 |
| 111 | Part 05        | `app/(auth)/verify-2fa/page.tsx`                                       | YES                    | YES                 |
| 112 | Part 08        | `app/(dashboard)/admin/fraud-alerts/[id]/page.tsx`                     | YES                    | YES                 |
| 113 | Part 08        | `app/(dashboard)/admin/layout.tsx`                                     | YES                    | YES                 |
| 114 | Part 08        | `app/(dashboard)/admin/loading.tsx`                                    |                        | YES                 |
| 115 | Part 08        | `app/(dashboard)/alerts/loading.tsx`                                   |                        | YES                 |
| 116 | Part 08        | `app/(dashboard)/charts/loading.tsx`                                   |                        | YES                 |
| 117 | Part 08        | `app/(dashboard)/dashboard/loading.tsx`                                |                        | YES                 |
| 118 | Part 08        | `app/(dashboard)/settings/loading.tsx`                                 |                        | YES                 |
| 119 | Part 16        | `app/(marketing)/landing-content.tsx`                                  | YES                    | YES                 |
| 120 | Part 17A-2     | `app/affiliate/dashboard/layout.tsx`                                   | YES                    | YES                 |
| 121 | Part 17A-2     | `app/affiliate/layout.tsx`                                             |                        | YES                 |
| 122 | Part 17A-2     | `app/affiliate/register/layout.tsx`                                    |                        | YES                 |
| 123 | Part 17A-2     | `app/affiliate/verify/layout.tsx`                                      |                        | YES                 |
| 124 | Part 16        | `app/api-test/page.tsx`                                                | YES                    | YES                 |
| 125 | Part 16        | `components/theme-toggle.tsx`                                          | YES                    | YES                 |
| 126 | Part 16        | `components/ui/alert-dialog.tsx`                                       | YES                    | YES                 |
| 127 | Part 16        | `components/ui/avatar.tsx`                                             |                        | YES                 |
| 128 | Part 16        | `components/ui/badge.tsx`                                              |                        | YES                 |
| 129 | Part 16        | `components/ui/breadcrumb.tsx`                                         | YES                    | YES                 |
| 130 | Part 16        | `components/ui/button.tsx`                                             | YES                    | YES                 |
| 131 | Part 16        | `components/ui/card.tsx`                                               |                        | YES                 |
| 132 | Part 16        | `components/ui/dialog.tsx`                                             | YES                    | YES                 |
| 133 | Part 16        | `components/ui/dropdown-menu.tsx`                                      | YES                    | YES                 |
| 134 | Part 16        | `components/ui/input.tsx`                                              | YES                    | YES                 |
| 135 | Part 16        | `components/ui/label.tsx`                                              |                        | YES                 |
| 136 | Part 16        | `components/ui/pagination.tsx`                                         | YES                    | YES                 |
| 137 | Part 16        | `components/ui/popover.tsx`                                            | YES                    | YES                 |
| 138 | Part 16        | `components/ui/progress.tsx`                                           |                        | YES                 |
| 139 | Part 16        | `components/ui/scroll-area.tsx`                                        | YES                    | YES                 |
| 140 | Part 16        | `components/ui/select.tsx`                                             | YES                    | YES                 |
| 141 | Part 16        | `components/ui/separator.tsx`                                          |                        | YES                 |
| 142 | Part 16        | `components/ui/sheet.tsx`                                              | YES                    | YES                 |
| 143 | Part 16        | `components/ui/skeleton.tsx`                                           |                        | YES                 |
| 144 | Part 16        | `components/ui/switch.tsx`                                             | YES                    | YES                 |
| 145 | Part 16        | `components/ui/tabs.tsx`                                               | YES                    | YES                 |
| 146 | Part 16        | `components/ui/toast-container.tsx`                                    | YES                    | YES                 |
| 147 | Part 16        | `components/ui/upgrade-button.tsx`                                     | YES                    | YES                 |
| 148 | Drawing Engine | `components/charts/drawing/AlertDialog.tsx`                            | YES                    | YES                 |
| 149 | Drawing Engine | `components/charts/drawing/AlertsPanel.tsx`                            | YES                    | YES                 |
| 150 | Drawing Engine | `components/charts/drawing/StyleEditor.tsx`                            | YES                    | YES                 |

---

## Summary Statistics

### Total Counts

- **Total Frontend UI Files:** 150
- **Files with Interactive Elements:** 115
- **Files with Readable Elements:** 148
- **Interactive + Readable:** 113
- **Readable Only:** 35
- **Interactive Only:** 2

### Distribution by Part

| Part                                               | File Count | Percentage |
| -------------------------------------------------- | ---------- | ---------- |
| Part 05 (Authentication)                           | 13         | 8.7%       |
| Part 08 (Dashboard & Layout)                       | 37         | 24.7%      |
| Part 09 (Charts)                                   | 5          | 3.3%       |
| Part 11 (Alerts)                                   | 5          | 3.3%       |
| Part 12 (Billing/Pricing)                          | 4          | 2.7%       |
| Part 14 (Admin Tools)                              | 14         | 9.3%       |
| Part 15 (Notifications)                            | 2          | 1.3%       |
| Part 16 (Infrastructure & Shared UI)               | 28         | 18.7%      |
| Part 17A-2 (Affiliate Portal)                      | 14         | 9.3%       |
| Part 17B-1 (Admin Affiliate)                       | 7          | 4.7%       |
| Part 18C (Payment UX)                              | 7          | 4.7%       |
| Part 19D (Disbursement UI)                         | 9          | 6.0%       |
| Drawing Engine (Chart Drawing Tools + Line Alerts) | 5          | 3.3%       |

> **Part 10 (Watchlist) removed 2026-07-07** — the watchlist feature was deleted from the
> product for all tiers (V8 single-symbol architecture). See the 2026-07-07 reconciliation note.

### Distribution by Type

| Category       | File Count | Percentage |
| -------------- | ---------- | ---------- |
| Pages          | 55         | 36.7%      |
| Components     | 78         | 52.0%      |
| Layouts        | 11         | 7.3%       |
| Loading states | 6          | 4.0%       |

### Distribution by User Role

| User Role                 | File Count | Key Areas                                                                                      |
| ------------------------- | ---------- | ---------------------------------------------------------------------------------------------- |
| **End Users**             | 56         | Dashboard, Alerts (PRO-only), Charts (incl. drawing tools, line alerts, MTF overlay), Settings |
| **Affiliates**            | 14         | Registration, Dashboard, Commissions, Profile                                                  |
| **Admins**                | 38         | User Management, Fraud Detection, Disbursements, Reports                                       |
| **Public/Marketing**      | 4          | Landing Page, Pricing                                                                          |
| **Authentication**        | 10         | Login, Register, Password Reset, Verification, 2FA                                             |
| **Shared/Infrastructure** | 31         | Layouts, Notifications, Billing, shadcn/ui primitives, Theme                                   |

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

## Reconciliation Note (2026-07-04) — no change (backend-only batch)

The 2026-07-04 batch pushed to `main` (affiliate code-flows report, conversion processor,
and edits to checkout / cron / dLocal / Stripe / disbursement backend files + `vercel.json`)
was **entirely backend**. No frontend UI files were added or modified, so this inventory is
unchanged (still 157) and nothing was synced into `frontend/`. Those files are tracked in
`backend-file-inventory.md` (new rows 533–534).

## Reconciliation Note (2026-06-28) — Phase 5 (drawing persistence + line alerts)

Added the 3 new drawing-engine **UI** components from the Phase 5 work (rows 155–157):
`AlertDialog.tsx`, `AlertsPanel.tsx`, `StyleEditor.tsx`. The rest of Phase 5 is backend (api
routes, alert-engine, `lib/drawing/*`) or `.ts` client helpers (`persistence.ts`, `alertsApi.ts`,
`tierUsage.ts`, `firedMarkers.ts`, `useFiredAlertMarkers.ts`) — those are tracked in
`backend-file-inventory.md` per the `.tsx`=UI / `.ts`=backend convention. All three were also
mirrored into the transitional `frontend/` UI stack.

---

## Key Features by Category

### Authentication (13 files)

- Login/Register flows
- Email verification
- Password reset
- Social auth integration
- Admin login

### Dashboard & Core App (41 files)

- Main dashboard with stats
- Alert management (PRO-only, V8)
- Chart visualization
- Settings (9 pages)
- Admin tools (15+ pages)
- Layout components (header, sidebar, footer)

> Watchlist management removed 2026-07-07 — the watchlist feature was deleted from the
> product for all tiers (V8 single-symbol architecture: XAUUSD only, nothing to track a
> list of). `app/(dashboard)/watchlist/*` and `components/dashboard/watchlist-widget.tsx`
> were deleted; see the 2026-07-07 reconciliation note.

### Charts & Data Visualization (7 files)

- Interactive trading charts
- Timeframe selector
- Chart controls
- Drawing toolbar (6-tool selector) — `components/charts/drawing/Toolbar.tsx`
- Drawing overlay layer (pointer-driven canvas) — `components/charts/drawing/DrawingLayer.tsx`
- Multi-timeframe overlay toggle (PRO-gated, V8) — `components/charts/mtf/MtfToggle.tsx`

> **Removed 2026-07-08:** `indicator-toggles.tsx` and `pro-indicator-overlay.tsx` (the "Indicator
> toggles" / "PRO feature overlays" rows above) were deleted as dead code — neither was ever
> rendered by any page, and both modeled the decommissioned 63-column `MarketData` schema. See
> the 2026-07-08 reconciliation note.

> Note: only the `.tsx` UI surfaces of the drawing/MTF engines appear here. The drawing
> geometry/engine/marks `.ts` logic modules and `components/charts/mtf/useMtfOverlay.ts`
> (the MTF data-fetch hook) are inventoried in `backend-file-inventory.md` per the repo's
> `.tsx`=frontend / `.ts`=backend convention.

### Alerts System (5 files)

- Alert creation form
- Alert card display
- Alert list with filters
- Recent alerts widget
- PRO-upgrade landing for FREE users (V8: alerts are PRO-exclusive) —
  `components/alerts/alerts-pro-upgrade.tsx`

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

## Reconciliation Note (2026-07-05) — v6 XAUUSD pipeline: gateway + backend-stack-c inventory

Reviewed — **no changes**. The 2026-07-05 batch (backend-stack-c's `v2_29_data_pipeline_architecture`
and `v2_29_multi-timeframe-visualisation` stacks, the new `railway-gateway/` NestJS service, the
`market_data_v6` Prisma migrations, and the mt5-service Redis publish bridge) is entirely backend
infrastructure — Python, MQL5, NestJS, SQL, and config. None of it creates or modifies a React/TSX
UI file, so this inventory is unaffected. Full detail in `backend-file-inventory.md`'s own
2026-07-05 reconciliation note.

## Reconciliation Note (2026-07-07) — V8 single-symbol architecture: Watchlist removed, MTF + PRO-alerts UI added

Commit `f213bd12` ("Fix type-check errors, exclude prototype sub-projects from tsconfig/jest, fix
stale pre-V8 tests, fix lightweight-charts/next-auth Jest mocking, fix build script for Windows")
landed the V8 redesign described in `change-to-new-design.md`: the product moves from
multi-symbol/multi-timeframe tiering to a single XAUUSD symbol on M5/M15 for both tiers, with
tier differentiation now expressed through Alerts (PRO-only), multi-timeframe visualization
(PRO-only), and drawing-engine line alerts (PRO-only) instead of data-access gating. Full table
renumbered 1-153 (net **157 → 153**, -6 removed / +2 added).

**Removed (6 rows) — Watchlist feature deleted entirely, all tiers:**

- `app/(dashboard)/watchlist/page.tsx`, `app/(dashboard)/watchlist/watchlist-client.tsx` (were
  Part 08)
- `components/dashboard/watchlist-widget.tsx` (was Part 08)
- `components/watchlist/symbol-selector.tsx`, `components/watchlist/timeframe-grid.tsx`,
  `components/watchlist/watchlist-item.tsx` (were Part 10 — **Part 10 now has zero UI files**,
  removed from the Distribution by Part table)

Backing removal confirmed in code: the `Watchlist`/`WatchlistItem` Prisma models, the
`app/api/watchlist/*` routes, `hooks/use-watchlist.ts`, `lib/validations/watchlist.ts`, and
`types/watchlist.ts` were all deleted in the same commit (tracked in `backend-file-inventory.md`).

**Added (2 rows):**

- `components/charts/mtf/MtfToggle.tsx` (row 48, Part 09) — PRO-gated switch on the M15 chart
  that toggles the M5 equal-distance-channel overlay (backed by
  `app/api/market-data/channel/route.ts` and the `useMtfOverlay.ts` hook, both tracked in
  `backend-file-inventory.md`). FREE users see a locked control that routes to `/pricing`.
- `components/alerts/alerts-pro-upgrade.tsx` (row 53, Part 11) — replaces the alerts list/creation
  UI for FREE users, since Alerts are now PRO-exclusive (FREE: 0 alerts, PRO: 100).

**Modified-not-new** (already inventoried, content changed only — no rows added/removed):
`app/(dashboard)/alerts/page.tsx` (renders `AlertsProUpgrade` for FREE tier),
`app/(dashboard)/charts/page.tsx`, `components/charts/trading-chart.tsx` (wires in `MtfToggle` +
`useMtfOverlay`, M15-only), `components/charts/chart-controls.tsx`,
`components/charts/drawing/{Toolbar,DrawingLayer,useFiredAlertMarkers}.ts(x)`,
`components/layout/{sidebar,mobile-nav}.tsx` (Watchlist nav link removed),
`components/notifications/{notification-bell,notification-list}.tsx` (PRO-gated alert
notifications), `components/dashboard/upgrade-prompt.tsx`, `components/billing/subscription-card.tsx`,
`components/pricing/tier-comparison.tsx`, `app/(marketing)/{landing-content,pricing/page}.tsx`,
`app/(dashboard)/{admin/users,settings/{billing,help,page,privacy,terms}}/page.tsx`,
`app/(dashboard)/alerts/new/{create-alert-client,page}.tsx`, `app/test-api/page.tsx` — all updated
for V8 copy/limits (100 alerts, no watchlist mentions, single-symbol XAUUSD) but no structural
change to what's tracked here.

This batch's backend-only files (tier system rewrite, new `app/api/market-data/channel/route.ts`,
deleted watchlist backend files, `20260706000000_drop_watchlists` migration, Jest/tsconfig
infra fixes) are tracked in `backend-file-inventory.md`'s own 2026-07-07 reconciliation note.

## Reconciliation Note (2026-07-08) — dead-code removal: legacy indicator overlay components

Removed **2 rows** (net **153 → 151**, full table renumbered): `components/charts/
pro-indicator-overlay.tsx` and `components/charts/indicator-toggles.tsx` (formerly rows 44-45,
Part 09). Both were confirmed dead code — never imported by any page or parent component
(traced transitively; neither appeared anywhere outside their own definition and test files) —
and both modeled the old 63-column `MarketData` indicator schema that was decommissioned
2026-07-05. Verified safe with a full `tsc --noEmit` (0 errors) and full Jest run (111 suites,
2046 tests, all passing) after deletion.

The backing types/logic these components depended on (`lib/tier/{constants,validator,index}.ts`,
`types/indicator.ts`'s legacy interfaces, plus 4 more backend-only files in the same dead
subtree: `hooks/use-indicators.ts`, `lib/websocket/use-mt5-websocket.ts`,
`lib/api/{mt5-transform,mt5-client}.ts`) are tracked in `backend-file-inventory.md`'s own
2026-07-08 reconciliation note — that batch also deleted the corresponding test files
(`__tests__/components/charts/{indicator-toggles,pro-indicator-overlay}.test.tsx`,
`lib/tier/__tests__/validator.test.ts`).

`components/indicators/indicator-selector.tsx` (was row 125, Part 09) was found to be similarly
orphaned during this investigation (not imported anywhere, own standalone constants unrelated to
`lib/tier/constants.ts`) but was **not** removed in this pass — it wasn't part of the confirmed
deletion list at the time. It was deleted in a same-day follow-up; see the reconciliation note
below.

`frontend/` has mirror copies of both deleted components — left in place, consistent with this
repo's existing convention that `frontend/`'s divergent/legacy content is a separate cleanup, not
synced in the same pass (see the 2026-06-27 reconciliation note above).

## Reconciliation Note (2026-07-08, follow-up) — dead-code removal: indicator-selector.tsx

Removed **1 row** (net **151 → 150**, full table renumbered): `components/indicators/
indicator-selector.tsx` (formerly row 125, Part 09), the file flagged as orphaned-but-not-deleted
in the note above. Re-confirmed before deletion: only reference anywhere (root or `frontend/`) was
its own definition file and the `frontend/` mirror — no page, layout, or other component ever
imported `IndicatorSelector`. Unlike the pro-indicator-overlay/indicator-toggles cluster, this
component defines its own standalone `FREE_TIER_INDICATORS`/`PRO_ONLY_INDICATORS` constants
inline and never imported `lib/tier/constants.ts` or `types/indicator.ts`, so its removal has no
dependency overlap with that earlier cleanup. Verified safe with a clean `tsc --noEmit` (0 errors)
immediately after deletion.

`frontend/components/indicators/indicator-selector.tsx` (the mirror) was left in place, same
rationale as above.

## Reconciliation Note (2026-08-04) — Frontend UI Inventory Alignment & Component Audit

Conducted a full audit of all frontend UI pages, modal dialogs, drawer components, settings forms, affiliate portals, checkout flows, wise recipient onboarding forms, and interactive drawing toolbars:

- **Part 14 (Admin Dashboard UI):** Reconciled 14 frontend UI components (`components/admin/*`), 5 core admin pages (`app/(dashboard)/admin/*`), 2 fraud alert management pages, 10 disbursement pages, and 8 affiliate management admin pages.
- **Part 15 (Notifications & Real-Time UI):** Reconciled notification bell component (`components/notifications/notification-bell.tsx`), notification list drawer (`components/notifications/notification-list.tsx`), and real-time connection status badge.
- **Part 17 (Affiliate Portal UI):** Reconciled affiliate dashboard layout (`app/(affiliate)/layout.tsx`), overview page (`app/(affiliate)/dashboard/page.tsx`), promo code generator form (`components/affiliate/code-generator-form.tsx`), link builder, and payout history table.
- **Part 18 (dLocal Checkout & Fraud UI):** Reconciled unified checkout page ([`app/checkout/page.tsx`](file:///d:/SaaS%20Project/trading-alerts-saas-public/app/checkout/page.tsx)), country selector widget, dLocal payment method picker (`dlocal-payment-picker.tsx`), and admin fraud management interface ([`app/(dashboard)/admin/fraud-alerts/page.tsx`](<file:///d:/SaaS%20Project/trading-alerts-saas-public/app/(dashboard)/admin/fraud-alerts/page.tsx>)).
- **Part 19.5 (Wise Disbursement UI):** Reconciled Wise recipient bank account onboarding modal form ([`components/disbursement/wise-recipient-form.tsx`](file:///d:/SaaS%20Project/trading-alerts-saas-public/components/disbursement/wise-recipient-form.tsx)), dynamic bank field validator, recipient verification table, and payout batch execution UI.
- **Part 21 (Drawing Engine UI):** Reconciled 6-tool HTML5 canvas drawing toolbar ([`components/charts/drawing/Toolbar.tsx`](file:///d:/SaaS%20Project/trading-alerts-saas-public/components/charts/drawing/Toolbar.tsx)), canvas overlay ([`DrawingLayer.tsx`](file:///d:/SaaS%20Project/trading-alerts-saas-public/components/charts/drawing/DrawingLayer.tsx)), line alert configuration dialog ([`AlertDialog.tsx`](file:///d:/SaaS%20Project/trading-alerts-saas-public/components/charts/drawing/AlertDialog.tsx)), active alerts manager panel ([`AlertsPanel.tsx`](file:///d:/SaaS%20Project/trading-alerts-saas-public/components/charts/drawing/AlertsPanel.tsx)), and style customizer editor ([`StyleEditor.tsx`](file:///d:/SaaS%20Project/trading-alerts-saas-public/components/charts/drawing/StyleEditor.tsx)).
- **Part 22 (User Account & Profile Settings UI):** Reconciled 5 user settings pages under `app/(dashboard)/settings/*` (`profile`, `security` with 2FA TOTP wizard, `sessions` with active session revocation, `preferences`, `account` with 7-day deletion grace period controls).
- **Part 24 (Multi-Timeframe Visualization UI):** Reconciled `TradingChartClient` multi-timeframe centroid channel overlay toggle button, channel line series renderer over TradingView Lightweight Charts v5.

---

**Compiled:** 2026-06-26 (updated 2026-08-04)
**Status:** Complete ✅
