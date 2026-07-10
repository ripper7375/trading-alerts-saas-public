# Monolith → Microservice Migration: Stack Analysis

**Purpose:** A per-file breakdown of the entire current codebase by **migration-target stack**
— which piece of infrastructure each file belongs to once the Next.js monolith is split, per the
architecture already planned in
`monolith-to-microservice-architecture-uionly-stack-a-b-c/`. This is a companion to
`backend-file-inventory.md` and `frontend-ui-file-inventory.md`, not a replacement — see
"How this differs from the existing inventories" below before using it.

**Methodology:** Categorization follows
`monolith-to-microservice-architecture-uionly-stack-a-b-c/separation-between-frontend-and-backend/stack-categorization-reference-guide.md`
(the project's own established rule set — not invented for this doc). Where an existing per-file
categorization already existed
(`frontend-and-backend-categorization-microservice-best-practice-CORRECTED.md`, ~January 2026,
611 files), that ground truth was reused as-is. Every file added or changed since then (~215 of
the 651 total) was categorized fresh by mechanically applying the same rule set. **One override
was applied on top of the ground truth:** `mt5-service/`, `backend-stack-c/`, `railway-gateway/`,
and `frontend/` are tagged `SEPARATE_STACK` regardless of what the ~January 2026 doc said, because
those are already independently deployed services — a distinction that document predates.

**Source data:** the current, fully-reconciled unique file sets from `backend-file-inventory.md`
(500 files) and `frontend-ui-file-inventory.md` (150 files) as of 2026-07-08, unioned (651 total
after de-duplication — some paths appear in both docs' source material).

---

## The Five Stacks

| Stack              | Count | %     | Deploys to                                     | Meaning                                                                                                                                                                                                                                                             |
| ------------------ | ----- | ----- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **FRONTEND**       | 320   | 49.2% | Vercel (Next.js)                               | Stays in the Next.js app — pages, layouts, `app/api/**` routes (still edge functions until individually migrated), components, hooks, client-side chart/drawing logic                                                                                               |
| **BACKEND**        | 143   | 22.0% | Railway (NestJS, per the roadmap)              | Business logic, Prisma, cron/background jobs, email rendering, server-only utilities — candidates to migrate into the NestJS backend module-by-module                                                                                                               |
| **SEPARATE_STACK** | 126   | 19.4% | Already separate (Contabo VPS, Railway, Flask) | `backend-stack-c/` (EA + data pipeline + MTF render), `railway-gateway/` (NestJS ingest — see note below), `mt5-service/` (Flask, Part 06), `frontend/` (the transitional UI-only mirror) — **not part of this migration exercise**, already independently deployed |
| **SHARING**        | 56    | 8.6%  | Both / neither                                 | Types, build scripts, CI config, `tsconfig.json`/`package.json`-class config, OpenAPI specs, planning docs                                                                                                                                                          |
| **TEST**           | 6     | 0.9%  | Neither                                        | Cross-stack e2e/integration tests, test infrastructure                                                                                                                                                                                                              |

**Important nuance on `railway-gateway/`:** it's tagged `SEPARATE_STACK` here (already deployed,
out of scope for _this_ migration), but it is simultaneously the **existing proof-of-concept** for
the target BACKEND architecture — a real NestJS service, deployed to Railway, doing exactly what
the roadmap (`migration-roadmap-to-link-backend-stack-a-and-frontend-ui-only-stack-together.md`)
describes for Stack A. Anyone doing migration work should read `railway-gateway/` first as a
working reference implementation, not skip it as "irrelevant."

---

## How this differs from the existing inventories

`backend-file-inventory.md` / `frontend-ui-file-inventory.md` split files by **what they are**
(UI-rendering `.tsx` vs. business logic). This document splits files by **where they'll deploy**
after the monolith split. These axes disagree on a meaningful number of files:

| File                                       | UI-split says (existing docs)                                                  | Migration-stack says (this doc) | Why they differ                                                                                                                                              |
| ------------------------------------------ | ------------------------------------------------------------------------------ | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `app/api/alerts/route.ts`                  | Backend (`backend-file-inventory.md`, "API routes")                            | **FRONTEND**                    | Next.js API routes are Vercel edge functions — they ship with the Next.js bundle until individually migrated to NestJS; they're not a separate backend today |
| `components/charts/drawing/persistence.ts` | Backend (`.ts` logic module, per the `.tsx`=frontend/`.ts`=backend convention) | **FRONTEND**                    | Runs entirely in the browser (canvas pointer handling, drawing persistence calls) — deploys with the Vercel bundle regardless of file extension              |
| `emails/payment-confirmation.tsx`          | Frontend-eligible by extension, but already tracked as Backend (Templates)     | **BACKEND**                     | Server-side rendered by the email service — `.tsx` here is JSX-as-templating-syntax, not a browser component                                                 |
| `hooks/use-ohlcv-socket.ts`                | Backend (React hooks category, tracked in `backend-file-inventory.md`)         | **FRONTEND**                    | React hooks only run in the browser — the `use-*` naming pattern overrides directory location                                                                |

**Use `backend-file-inventory.md`/`frontend-ui-file-inventory.md`** for "is this file UI or logic."
**Use this doc** for "what happens to this file when we split the monolith."

---

## Migration Readiness Notes

- **`SEPARATE_STACK` (126 files) is the biggest head start** — nearly a fifth of the whole
  codebase is _already_ running as independent services. `railway-gateway/` in particular proves
  the NestJS-on-Railway pattern end-to-end (ingest → validate → queue → Postgres) at production
  quality; the same shape (controller → service → Prisma) is the template for migrating Stack A
  modules.
- **`BACKEND` (143 files) is the actual migration backlog** for the Next.js monolith → NestJS
  split. Per the roadmap, migrate **module-by-module**, not all at once. Natural first
  candidates, by self-containment:
  - `lib/alert-engine/*` (9 files) — already runs as an independent background worker
    (`scripts/alert-worker.ts`, its own `docker-compose.yml` service, its own `railway-worker.json`)
    with a narrow, well-defined interface (Redis pub/sub in, BullMQ dispatch out). Closest thing
    to "already migrated" in the BACKEND list.
  - `lib/disbursement/*`, `lib/affiliate/*` — self-contained business domains with their own
    Prisma models, minimal cross-domain coupling.
  - `lib/stripe/*`, `lib/dlocal/*` — payment providers behind a shared interface already
    (`lib/disbursement/providers/provider-factory.ts`), a natural module boundary.
  - Defer: `lib/auth/*`, `lib/tier*` — touched by nearly everything else; migrate last once
    session/tier-check patterns are proven in NestJS (an `ApiKeyGuard`-style guard already exists
    as a template in `railway-gateway/src/auth/api-key.guard.ts`, though session-based user auth
    is a different problem than the Gateway's bearer-token machine auth).
- **`FRONTEND` (320 files) mostly doesn't move** — this is the end state, not a migration
  backlog. The one action item: `app/api/**/route.ts` routes will need to become
  Railway API calls (`fetch(NEXT_PUBLIC_API_URL + ...)`) as each BACKEND module migrates, per
  roadmap step 5 ("Update frontend to point to Railway API").
- **`SHARING` (56 files)** is the roadmap's own recommendation to extract into an
  `@trading-alerts/types` package (see `stack-categorization-reference-guide.md`'s SHARING
  section) — not yet done; currently just root-level `types/`, config, and scripts duplicated by
  reference rather than by package.

---

## Appendix: Full File Listings by Stack

Grouped by top-level directory; expand each to see the files. Counts are the same "approximate,
not perfectly reconciled" caveat as the two source inventories — this is a snapshot for planning,
re-derive it if the codebase has moved on significantly.

### FRONTEND

<details>
<summary><code>(root)/</code> — 4 files</summary>

- `next.config.js`
- `postcss.config.js`
- `tailwind.config.ts`
- `vercel.json`

</details>

<details>
<summary><code>__tests__/api/</code> — 17 files</summary>

- `__tests__/api/admin-affiliates.test.ts`
- `__tests__/api/affiliate-conversion.test.ts`
- `__tests__/api/affiliate-dashboard.test.ts`
- `__tests__/api/affiliate-registration.test.ts`
- `__tests__/api/cron-jobs.test.ts`
- `__tests__/api/cron/process-pending.test.ts`
- `__tests__/api/disbursement/affiliates.test.ts`
- `__tests__/api/disbursement/audit.test.ts`
- `__tests__/api/disbursement/batches.test.ts`
- `__tests__/api/disbursement/execute.test.ts`
- `__tests__/api/disbursement/health.test.ts`
- `__tests__/api/disbursement/pay.test.ts`
- `__tests__/api/disbursement/reports.test.ts`
- `__tests__/api/notifications.test.ts`
- `__tests__/api/tier.test.ts`
- `__tests__/api/webhooks/dlocal/route.test.ts`
- `__tests__/api/webhooks/riseworks.test.ts`

</details>

<details>
<summary><code>__tests__/components/</code> — 9 files</summary>

- `__tests__/components/admin/affiliate-filters.test.tsx`
- `__tests__/components/admin/affiliate-stats-banner.test.tsx`
- `__tests__/components/affiliate/code-table.test.tsx`
- `__tests__/components/affiliate/commission-table.test.tsx`
- `__tests__/components/affiliate/stats-card.test.tsx`
- `__tests__/components/dashboard/recent-alerts.test.tsx`
- `__tests__/components/dashboard/stats-card.test.tsx`
- `__tests__/components/payments/PlanSelector.test.tsx`
- `__tests__/components/payments/PriceDisplay.test.tsx`

</details>

<details>
<summary><code>app/</code> — 3 files</summary>

- `app/error.tsx`
- `app/globals.css`
- `app/layout.tsx`

</details>

<details>
<summary><code>app/(auth)/</code> — 9 files</summary>

- `app/(auth)/forgot-password/page.tsx`
- `app/(auth)/layout.tsx`
- `app/(auth)/loading.tsx`
- `app/(auth)/login/page.tsx`
- `app/(auth)/register/page.tsx`
- `app/(auth)/reset-password/page.tsx`
- `app/(auth)/verify-2fa/page.tsx`
- `app/(auth)/verify-email/page.tsx`
- `app/(auth)/verify-email/pending/page.tsx`

</details>

<details>
<summary><code>app/(dashboard)/</code> — 41 files</summary>

- `app/(dashboard)/admin/api-usage/page.tsx`
- `app/(dashboard)/admin/disbursement/accounts/page.tsx`
- `app/(dashboard)/admin/disbursement/affiliates/page.tsx`
- `app/(dashboard)/admin/disbursement/audit/page.tsx`
- `app/(dashboard)/admin/disbursement/batches/[batchId]/page.tsx`
- `app/(dashboard)/admin/disbursement/batches/page.tsx`
- `app/(dashboard)/admin/disbursement/config/page.tsx`
- `app/(dashboard)/admin/disbursement/layout.tsx`
- `app/(dashboard)/admin/disbursement/page.tsx`
- `app/(dashboard)/admin/disbursement/transactions/page.tsx`
- `app/(dashboard)/admin/errors/page.tsx`
- `app/(dashboard)/admin/fraud-alerts/[id]/page.tsx`
- `app/(dashboard)/admin/fraud-alerts/page.tsx`
- `app/(dashboard)/admin/layout.tsx`
- `app/(dashboard)/admin/loading.tsx`
- `app/(dashboard)/admin/page.tsx`
- `app/(dashboard)/admin/users/page.tsx`
- `app/(dashboard)/alerts/alerts-client.tsx`
- `app/(dashboard)/alerts/loading.tsx`
- `app/(dashboard)/alerts/new/create-alert-client.tsx`
- `app/(dashboard)/alerts/new/page.tsx`
- `app/(dashboard)/alerts/page.tsx`
- `app/(dashboard)/charts/[symbol]/[timeframe]/page.tsx`
- `app/(dashboard)/charts/[symbol]/[timeframe]/trading-chart-client.tsx`
- `app/(dashboard)/charts/loading.tsx`
- `app/(dashboard)/charts/page.tsx`
- `app/(dashboard)/dashboard/loading.tsx`
- `app/(dashboard)/dashboard/page.tsx`
- `app/(dashboard)/layout.tsx`
- `app/(dashboard)/settings/account/page.tsx`
- `app/(dashboard)/settings/appearance/page.tsx`
- `app/(dashboard)/settings/billing/page.tsx`
- `app/(dashboard)/settings/help/page.tsx`
- `app/(dashboard)/settings/language/page.tsx`
- `app/(dashboard)/settings/layout.tsx`
- `app/(dashboard)/settings/loading.tsx`
- `app/(dashboard)/settings/page.tsx`
- `app/(dashboard)/settings/privacy/page.tsx`
- `app/(dashboard)/settings/profile/page.tsx`
- `app/(dashboard)/settings/security/page.tsx`
- `app/(dashboard)/settings/terms/page.tsx`

</details>

<details>
<summary><code>app/(marketing)/</code> — 4 files</summary>

- `app/(marketing)/landing-content.tsx`
- `app/(marketing)/layout.tsx`
- `app/(marketing)/page.tsx`
- `app/(marketing)/pricing/page.tsx`

</details>

<details>
<summary><code>app/admin/</code> — 8 files</summary>

- `app/admin/affiliates/[id]/page.tsx`
- `app/admin/affiliates/page.tsx`
- `app/admin/affiliates/reports/code-inventory/page.tsx`
- `app/admin/affiliates/reports/commission-owings/page.tsx`
- `app/admin/affiliates/reports/profit-loss/page.tsx`
- `app/admin/affiliates/reports/sales-performance/page.tsx`
- `app/admin/login/page.tsx`
- `app/admin/settings/affiliate/page.tsx`

</details>

<details>
<summary><code>app/affiliate/</code> — 11 files</summary>

- `app/affiliate/dashboard/codes/page.tsx`
- `app/affiliate/dashboard/commissions/page.tsx`
- `app/affiliate/dashboard/layout.tsx`
- `app/affiliate/dashboard/page.tsx`
- `app/affiliate/dashboard/profile/page.tsx`
- `app/affiliate/dashboard/profile/payment/page.tsx`
- `app/affiliate/layout.tsx`
- `app/affiliate/register/layout.tsx`
- `app/affiliate/register/page.tsx`
- `app/affiliate/verify/layout.tsx`
- `app/affiliate/verify/page.tsx`

</details>

<details>
<summary><code>app/api/</code> — 99 files</summary>

- `app/api/admin/affiliates/[id]/distribute-codes/route.ts`
- `app/api/admin/affiliates/[id]/reactivate/route.ts`
- `app/api/admin/affiliates/[id]/route.ts`
- `app/api/admin/affiliates/[id]/suspend/route.ts`
- `app/api/admin/affiliates/reports/code-flows/route.ts`
- `app/api/admin/affiliates/reports/code-inventory/route.ts`
- `app/api/admin/affiliates/reports/commission-owings/route.ts`
- `app/api/admin/affiliates/reports/profit-loss/route.ts`
- `app/api/admin/affiliates/reports/sales-performance/route.ts`
- `app/api/admin/affiliates/route.ts`
- `app/api/admin/analytics/route.ts`
- `app/api/admin/api-usage/route.ts`
- `app/api/admin/codes/[code]/cancel/route.ts`
- `app/api/admin/commissions/pay/route.ts`
- `app/api/admin/error-logs/route.ts`
- `app/api/admin/fraud-alerts/[id]/route.ts`
- `app/api/admin/fraud-alerts/route.ts`
- `app/api/admin/settings/affiliate/route.ts`
- `app/api/admin/users/route.ts`
- `app/api/affiliate/auth/register/route.ts`
- `app/api/affiliate/auth/verify-email/route.ts`
- `app/api/affiliate/dashboard/code-inventory/route.ts`
- `app/api/affiliate/dashboard/codes/route.ts`
- `app/api/affiliate/dashboard/commission-report/route.ts`
- `app/api/affiliate/dashboard/stats/route.ts`
- `app/api/affiliate/profile/payment/route.ts`
- `app/api/affiliate/profile/route.ts`
- `app/api/alerts/[id]/route.ts`
- `app/api/alerts/line/[id]/route.ts`
- `app/api/alerts/line/route.ts`
- `app/api/alerts/route.ts`
- `app/api/auth/[...nextauth]/route.ts`
- `app/api/auth/forgot-password/route.ts`
- `app/api/auth/register/route.ts`
- `app/api/auth/resend-verification/route.ts`
- `app/api/auth/reset-password/route.ts`
- `app/api/auth/verify-email/route.ts`
- `app/api/checkout/route.ts`
- `app/api/checkout/validate-code/route.ts`
- `app/api/config/affiliate/route.ts`
- `app/api/cron/check-expiring-subscriptions/route.ts`
- `app/api/cron/distribute-codes/route.ts`
- `app/api/cron/downgrade-expired-subscriptions/route.ts`
- `app/api/cron/expire-codes/route.ts`
- `app/api/cron/process-pending-disbursements/route.ts`
- `app/api/cron/send-monthly-reports/route.ts`
- `app/api/cron/sync-riseworks-accounts/route.ts`
- `app/api/disbursement/affiliates/[affiliateId]/commissions/route.ts`
- `app/api/disbursement/affiliates/[affiliateId]/route.ts`
- `app/api/disbursement/affiliates/payable/route.ts`
- `app/api/disbursement/audit-logs/route.ts`
- `app/api/disbursement/batches/[batchId]/execute/route.ts`
- `app/api/disbursement/batches/[batchId]/route.ts`
- `app/api/disbursement/batches/preview/route.ts`
- `app/api/disbursement/batches/route.ts`
- `app/api/disbursement/config/route.ts`
- `app/api/disbursement/health/route.ts`
- `app/api/disbursement/pay/route.ts`
- `app/api/disbursement/reports/affiliate/[affiliateId]/route.ts`
- `app/api/disbursement/reports/summary/route.ts`
- `app/api/disbursement/riseworks/accounts/route.ts`
- `app/api/disbursement/riseworks/sync/route.ts`
- `app/api/disbursement/transactions/route.ts`
- `app/api/drawings/[id]/route.ts`
- `app/api/drawings/route.ts`
- `app/api/invoices/route.ts`
- `app/api/market-data/channel/route.ts`
- `app/api/notifications/[id]/read/route.ts`
- `app/api/notifications/[id]/route.ts`
- `app/api/notifications/route.ts`
- `app/api/payments/dlocal/[paymentId]/route.ts`
- `app/api/payments/dlocal/check-three-day-eligibility/route.ts`
- `app/api/payments/dlocal/convert/route.ts`
- `app/api/payments/dlocal/create/route.ts`
- `app/api/payments/dlocal/exchange-rate/route.ts`
- `app/api/payments/dlocal/methods/route.ts`
- `app/api/payments/dlocal/validate-discount/route.ts`
- `app/api/subscription/cancel/route.ts`
- `app/api/subscription/route.ts`
- `app/api/tier/check/[symbol]/route.ts`
- `app/api/tier/combinations/route.ts`
- `app/api/tier/symbols/route.ts`
- `app/api/user/2fa/backup-codes/route.ts`
- `app/api/user/2fa/disable/route.ts`
- `app/api/user/2fa/setup/route.ts`
- `app/api/user/2fa/verify-setup/route.ts`
- `app/api/user/2fa/verify/route.ts`
- `app/api/user/account/deletion-cancel/route.ts`
- `app/api/user/account/deletion-confirm/route.ts`
- `app/api/user/account/deletion-request/route.ts`
- `app/api/user/login-history/route.ts`
- `app/api/user/password/route.ts`
- `app/api/user/preferences/route.ts`
- `app/api/user/profile/route.ts`
- `app/api/user/sessions/[id]/route.ts`
- `app/api/user/sessions/route.ts`
- `app/api/webhooks/dlocal/route.ts`
- `app/api/webhooks/riseworks/route.ts`
- `app/api/webhooks/stripe/route.ts`

</details>

<details>
<summary><code>app/api-test/</code> — 1 file</summary>

- `app/api-test/page.tsx`

</details>

<details>
<summary><code>app/checkout/</code> — 1 file</summary>

- `app/checkout/page.tsx`

</details>

<details>
<summary><code>components/</code> — 1 file</summary>

- `components/theme-toggle.tsx`

</details>

<details>
<summary><code>components/admin/</code> — 14 files</summary>

- `components/admin/FraudAlertCard.tsx`
- `components/admin/FraudPatternBadge.tsx`
- `components/admin/affiliate-filters.tsx`
- `components/admin/affiliate-stats-banner.tsx`
- `components/admin/affiliate-table.tsx`
- `components/admin/code-inventory-chart.tsx`
- `components/admin/commission-owings-table.tsx`
- `components/admin/distribute-codes-modal.tsx`
- `components/admin/pay-commission-modal.tsx`
- `components/admin/pnl-breakdown-table.tsx`
- `components/admin/pnl-summary-cards.tsx`
- `components/admin/pnl-trend-chart.tsx`
- `components/admin/sales-performance-table.tsx`
- `components/admin/suspend-affiliate-modal.tsx`

</details>

<details>
<summary><code>components/affiliate/</code> — 4 files</summary>

- `components/affiliate/code-table.tsx`
- `components/affiliate/commission-table.tsx`
- `components/affiliate/index.ts`
- `components/affiliate/stats-card.tsx`

</details>

<details>
<summary><code>components/alerts/</code> — 4 files</summary>

- `components/alerts/alert-card.tsx`
- `components/alerts/alert-form.tsx`
- `components/alerts/alert-list.tsx`
- `components/alerts/alerts-pro-upgrade.tsx`

</details>

<details>
<summary><code>components/auth/</code> — 3 files</summary>

- `components/auth/login-form.tsx`
- `components/auth/register-form.tsx`
- `components/auth/social-auth-buttons.tsx`

</details>

<details>
<summary><code>components/billing/</code> — 2 files</summary>

- `components/billing/invoice-list.tsx`
- `components/billing/subscription-card.tsx`

</details>

<details>
<summary><code>components/charts/</code> — 35 files</summary>

- `components/charts/chart-controls.tsx`
- `components/charts/drawing/AlertDialog.tsx`
- `components/charts/drawing/AlertsPanel.tsx`
- `components/charts/drawing/DrawingLayer.tsx`
- `components/charts/drawing/StyleEditor.tsx`
- `components/charts/drawing/Toolbar.tsx`
- `components/charts/drawing/alertsApi.ts`
- `components/charts/drawing/engine/DrawingEngine.ts`
- `components/charts/drawing/engine/PointerController.ts`
- `components/charts/drawing/engine/coords.ts`
- `components/charts/drawing/engine/pixelMath.ts`
- `components/charts/drawing/firedMarkers.ts`
- `components/charts/drawing/geometry/channel.ts`
- `components/charts/drawing/geometry/fib.ts`
- `components/charts/drawing/geometry/horizontal.ts`
- `components/charts/drawing/geometry/index.ts`
- `components/charts/drawing/geometry/levels.ts`
- `components/charts/drawing/geometry/trendline.ts`
- `components/charts/drawing/geometry/types.ts`
- `components/charts/drawing/marks/BaseMark.ts`
- `components/charts/drawing/marks/ChannelMark.ts`
- `components/charts/drawing/marks/FibExtensionMark.ts`
- `components/charts/drawing/marks/FibRetracementMark.ts`
- `components/charts/drawing/marks/HorizontalLineMark.ts`
- `components/charts/drawing/marks/TextMark.ts`
- `components/charts/drawing/marks/TrendlineMark.ts`
- `components/charts/drawing/persistence.ts`
- `components/charts/drawing/tierUsage.ts`
- `components/charts/drawing/tools/index.ts`
- `components/charts/drawing/types.ts`
- `components/charts/drawing/useFiredAlertMarkers.ts`
- `components/charts/mtf/MtfToggle.tsx`
- `components/charts/mtf/useMtfOverlay.ts`
- `components/charts/timeframe-selector.tsx`
- `components/charts/trading-chart.tsx`

</details>

<details>
<summary><code>components/dashboard/</code> — 3 files</summary>

- `components/dashboard/recent-alerts.tsx`
- `components/dashboard/stats-card.tsx`
- `components/dashboard/upgrade-prompt.tsx`

</details>

<details>
<summary><code>components/layout/</code> — 4 files</summary>

- `components/layout/footer.tsx`
- `components/layout/header.tsx`
- `components/layout/mobile-nav.tsx`
- `components/layout/sidebar.tsx`

</details>

<details>
<summary><code>components/notifications/</code> — 2 files</summary>

- `components/notifications/notification-bell.tsx`
- `components/notifications/notification-list.tsx`

</details>

<details>
<summary><code>components/payments/</code> — 7 files</summary>

- `components/payments/CountrySelector.tsx`
- `components/payments/DiscountCodeInput.tsx`
- `components/payments/PaymentButton.tsx`
- `components/payments/PaymentMethodSelector.tsx`
- `components/payments/PlanSelector.tsx`
- `components/payments/PriceDisplay.tsx`
- `components/payments/index.ts`

</details>

<details>
<summary><code>components/pricing/</code> — 1 file</summary>

- `components/pricing/tier-comparison.tsx`

</details>

<details>
<summary><code>components/providers/</code> — 2 files</summary>

- `components/providers/theme-provider.tsx`
- `components/providers/websocket-provider.tsx`

</details>

<details>
<summary><code>components/ui/</code> — 22 files</summary>

- `components/ui/alert-dialog.tsx`
- `components/ui/avatar.tsx`
- `components/ui/badge.tsx`
- `components/ui/breadcrumb.tsx`
- `components/ui/button.tsx`
- `components/ui/card.tsx`
- `components/ui/dialog.tsx`
- `components/ui/dropdown-menu.tsx`
- `components/ui/input.tsx`
- `components/ui/label.tsx`
- `components/ui/pagination.tsx`
- `components/ui/popover.tsx`
- `components/ui/progress.tsx`
- `components/ui/scroll-area.tsx`
- `components/ui/select.tsx`
- `components/ui/separator.tsx`
- `components/ui/sheet.tsx`
- `components/ui/skeleton.tsx`
- `components/ui/switch.tsx`
- `components/ui/tabs.tsx`
- `components/ui/toast-container.tsx`
- `components/ui/upgrade-button.tsx`

</details>

<details>
<summary><code>hooks/</code> — 7 files</summary>

- `hooks/use-alerts.ts`
- `hooks/use-auth.ts`
- `hooks/use-login-tracking.ts`
- `hooks/use-ohlcv-socket.ts`
- `hooks/use-optimistic-mutation.ts`
- `hooks/use-toast.ts`
- `hooks/use-websocket.ts`

</details>

<details>
<summary><code>lib/hooks/</code> — 1 file</summary>

- `lib/hooks/useAffiliateConfig.ts`

</details>

<details>
<summary><code>public/</code> — 1 file</summary>

- `public/manifest.json`

</details>

### BACKEND

<details>
<summary><code>(root)/</code> — 2 files</summary>

- `docker-compose.yml`
- `railway-worker.json`

</details>

<details>
<summary><code>__tests__/alert-engine/</code> — 4 files</summary>

- `__tests__/alert-engine/detect.test.ts`
- `__tests__/alert-engine/evaluator.test.ts`
- `__tests__/alert-engine/notify-bridge.test.ts`
- `__tests__/alert-engine/watches.test.ts`

</details>

<details>
<summary><code>__tests__/drawing/</code> — 8 files</summary>

- `__tests__/drawing/alertsApi.test.ts`
- `__tests__/drawing/engine/DrawingEngine.test.ts`
- `__tests__/drawing/engine/pixelMath.test.ts`
- `__tests__/drawing/firedMarkers.test.ts`
- `__tests__/drawing/geometry/geometry.test.ts`
- `__tests__/drawing/marks/newMarks.test.ts`
- `__tests__/drawing/persistence.test.ts`
- `__tests__/drawing/tierUsage.test.ts`

</details>

<details>
<summary><code>__tests__/lib/</code> — 21 files</summary>

- `__tests__/lib/admin/affiliate-management.test.ts`
- `__tests__/lib/affiliate/code-generator.test.ts`
- `__tests__/lib/affiliate/commission-calculator.test.ts`
- `__tests__/lib/affiliate/registration.test.ts`
- `__tests__/lib/cron/check-expiring-subscriptions.test.ts`
- `__tests__/lib/cron/downgrade-expired-subscriptions.test.ts`
- `__tests__/lib/db/prisma.test.ts`
- `__tests__/lib/db/seed.test.ts`
- `__tests__/lib/disbursement/constants.test.ts`
- `__tests__/lib/disbursement/providers/factory.test.ts`
- `__tests__/lib/disbursement/providers/mock.test.ts`
- `__tests__/lib/disbursement/providers/rise/webhook.test.ts`
- `__tests__/lib/disbursement/services/aggregator.test.ts`
- `__tests__/lib/disbursement/services/batch.test.ts`
- `__tests__/lib/disbursement/services/orchestrator.test.ts`
- `__tests__/lib/dlocal/constants.test.ts`
- `__tests__/lib/dlocal/currency-converter.test.ts`
- `__tests__/lib/dlocal/dlocal-payment.test.ts`
- `__tests__/lib/dlocal/payment-methods.test.ts`
- `__tests__/lib/dlocal/three-day-validator.test.ts`
- `__tests__/lib/geo/detect-country.test.ts`

</details>

<details>
<summary><code>emails/</code> — 5 files</summary>

- `emails/index.ts`
- `emails/payment-confirmation.tsx`
- `emails/payment-failure.tsx`
- `emails/renewal-reminder.tsx`
- `emails/subscription-expired.tsx`

</details>

<details>
<summary><code>lib/</code> — 9 files</summary>

- `lib/candle-data-helpers.ts`
- `lib/csrf.ts`
- `lib/logger.ts`
- `lib/rate-limit.ts`
- `lib/tier-config.ts`
- `lib/tier-helpers.ts`
- `lib/tier-validation.ts`
- `lib/tokens.ts`
- `lib/utils.ts`

</details>

<details>
<summary><code>lib/admin/</code> — 3 files</summary>

- `lib/admin/affiliate-management.ts`
- `lib/admin/code-distribution.ts`
- `lib/admin/pnl-calculator.ts`

</details>

<details>
<summary><code>lib/affiliate/</code> — 8 files</summary>

- `lib/affiliate/code-generator.ts`
- `lib/affiliate/commission-calculator.ts`
- `lib/affiliate/constants.ts`
- `lib/affiliate/conversion-processor.ts`
- `lib/affiliate/registration.ts`
- `lib/affiliate/report-builder.ts`
- `lib/affiliate/types.ts`
- `lib/affiliate/validators.ts`

</details>

<details>
<summary><code>lib/alert-engine/</code> — 9 files</summary>

- `lib/alert-engine/detect.ts`
- `lib/alert-engine/dispatcher.ts`
- `lib/alert-engine/evaluator.ts`
- `lib/alert-engine/notify-bridge.ts`
- `lib/alert-engine/queue.ts`
- `lib/alert-engine/state.ts`
- `lib/alert-engine/types.ts`
- `lib/alert-engine/watches.ts`
- `lib/alert-engine/worker.ts`

</details>

<details>
<summary><code>lib/api/</code> — 1 file</summary>

- `lib/api/index.ts`

</details>

<details>
<summary><code>lib/auth/</code> — 6 files</summary>

- `lib/auth/auth-options.ts`
- `lib/auth/errors.ts`
- `lib/auth/permissions.ts`
- `lib/auth/session-tracker.ts`
- `lib/auth/session.ts`
- `lib/auth/two-factor.ts`

</details>

<details>
<summary><code>lib/cache/</code> — 1 file</summary>

- `lib/cache/cache-manager.ts`

</details>

<details>
<summary><code>lib/constants/</code> — 1 file</summary>

- `lib/constants/business-rules.ts`

</details>

<details>
<summary><code>lib/cron/</code> — 3 files</summary>

- `lib/cron/check-expiring-subscriptions.ts`
- `lib/cron/downgrade-expired-subscriptions.ts`
- `lib/cron/monthly-distribution.ts`

</details>

<details>
<summary><code>lib/db/</code> — 2 files</summary>

- `lib/db/prisma.ts`
- `lib/db/seed.ts`

</details>

<details>
<summary><code>lib/disbursement/</code> — 17 files</summary>

- `lib/disbursement/constants.ts`
- `lib/disbursement/cron/disbursement-processor.ts`
- `lib/disbursement/providers/base-provider.ts`
- `lib/disbursement/providers/mock-provider.ts`
- `lib/disbursement/providers/provider-factory.ts`
- `lib/disbursement/providers/rise/amount-converter.ts`
- `lib/disbursement/providers/rise/rise-provider.ts`
- `lib/disbursement/providers/rise/siwe-auth.ts`
- `lib/disbursement/providers/rise/webhook-verifier.ts`
- `lib/disbursement/services/batch-manager.ts`
- `lib/disbursement/services/commission-aggregator.ts`
- `lib/disbursement/services/payment-orchestrator.ts`
- `lib/disbursement/services/payout-calculator.ts`
- `lib/disbursement/services/retry-handler.ts`
- `lib/disbursement/services/transaction-logger.ts`
- `lib/disbursement/services/transaction-service.ts`
- `lib/disbursement/webhook/event-processor.ts`

</details>

<details>
<summary><code>lib/dlocal/</code> — 5 files</summary>

- `lib/dlocal/constants.ts`
- `lib/dlocal/currency-converter.service.ts`
- `lib/dlocal/dlocal-payment.service.ts`
- `lib/dlocal/payment-methods.service.ts`
- `lib/dlocal/three-day-validator.service.ts`

</details>

<details>
<summary><code>lib/drawing/</code> — 2 files</summary>

- `lib/drawing/invalidate.ts`
- `lib/drawing/schema.ts`

</details>

<details>
<summary><code>lib/email/</code> — 7 files</summary>

- `lib/email/email.ts`
- `lib/email/subscription-emails.ts`
- `lib/email/templates/affiliate/code-distributed.tsx`
- `lib/email/templates/affiliate/code-used.tsx`
- `lib/email/templates/affiliate/monthly-report.tsx`
- `lib/email/templates/affiliate/payment-processed.tsx`
- `lib/email/templates/affiliate/welcome.tsx`

</details>

<details>
<summary><code>lib/errors/</code> — 3 files</summary>

- `lib/errors/api-error.ts`
- `lib/errors/error-handler.ts`
- `lib/errors/error-logger.ts`

</details>

<details>
<summary><code>lib/fraud/</code> — 1 file</summary>

- `lib/fraud/fraud-detection.service.ts`

</details>

<details>
<summary><code>lib/geo/</code> — 1 file</summary>

- `lib/geo/detect-country.ts`

</details>

<details>
<summary><code>lib/jobs/</code> — 2 files</summary>

- `lib/jobs/alert-checker.ts`
- `lib/jobs/queue.ts`

</details>

<details>
<summary><code>lib/monitoring/</code> — 1 file</summary>

- `lib/monitoring/system-monitor.ts`

</details>

<details>
<summary><code>lib/preferences/</code> — 1 file</summary>

- `lib/preferences/defaults.ts`

</details>

<details>
<summary><code>lib/redis/</code> — 1 file</summary>

- `lib/redis/client.ts`

</details>

<details>
<summary><code>lib/security/</code> — 1 file</summary>

- `lib/security/device-detection.ts`

</details>

<details>
<summary><code>lib/stripe/</code> — 2 files</summary>

- `lib/stripe/stripe.ts`
- `lib/stripe/webhook-handlers.ts`

</details>

<details>
<summary><code>lib/utils/</code> — 3 files</summary>

- `lib/utils/constants.ts`
- `lib/utils/formatters.ts`
- `lib/utils/helpers.ts`

</details>

<details>
<summary><code>lib/validations/</code> — 3 files</summary>

- `lib/validations/alert.ts`
- `lib/validations/auth.ts`
- `lib/validations/user.ts`

</details>

<details>
<summary><code>lib/websocket/</code> — 1 file</summary>

- `lib/websocket/server.ts`

</details>

<details>
<summary><code>middleware/</code> — 1 file</summary>

- `middleware/tier-check.ts`

</details>

<details>
<summary><code>prisma/</code> — 8 files</summary>

- `prisma/migrations/20251227000000_init/migration.sql`
- `prisma/migrations/20260214000000_rag_dual_memory/migration.sql`
- `prisma/migrations/20260224000000_update_kc_ha_body_columns/migration.sql`
- `prisma/migrations/20260705000000_add_market_data_v6/migration.sql`
- `prisma/migrations/20260705010000_drop_market_data/migration.sql`
- `prisma/migrations/20260706000000_drop_watchlists/migration.sql`
- `prisma/schema.prisma`
- `prisma/seed.ts`

</details>

### SEPARATE_STACK

<details>
<summary><code>.../</code> — 45 files</summary>

- `.../data-split-between-mql5-and-python/Export Data from MQL5 indicators.txt`
- `.../data-split-between-mql5-and-python/Python stacks calculation.txt`
- `.../mq5/2EDTCentroidRegressionBestFitNonMostRecent_v2_29.mq5`
- `.../mq5/2EDTCentroidRegressionCherryPickA_v2_29.mq5`
- `.../mq5/2EDTCentroidRegressionCherryPickB_v2_29.mq5`
- `.../mq5/2EDTCentroidRegressionMostRecentLineExtension_v2_29.mq5`
- `.../mq5/2EDTCentroidRegressionNonMostRecentLineExtensionA_v2_29.mq5`
- `.../mq5/2EDTCentroidRegressionNonMostRecentLineExtensionB_v2_29.mq5`
- `.../mq5/2EDTFractalBestFitv5_v2_29.mq5`
- `.../mq5/SingleBestResistanceLinev3_v2_29.mq5`
- `.../mq5/SingleBestSupportLinev3_v2_29.mq5`
- `.../mq5/ZigZagExportv43_v2_29.mq5`
- `.../mq5/ohlcvexportlightweight_v2_29.mq5`
- `.../mq5/zscoreohlccandleexport_v2_29.mq5`
- `.../mql5-to-python-transliteration/CERTIFICATION.md`
- `.../mql5-to-python-transliteration/README.md`
- `.../mql5-to-python-transliteration/golden_certification.py`
- `.../mql5-to-python-transliteration/golden_certification_report_M15.txt`
- `.../mql5-to-python-transliteration/golden_certification_report_M5.txt`
- `.../mql5-to-python-transliteration/test_phase1_golden.py`
- `.../mql5-to-python-transliteration/test_phase2_lines.py`
- `.../mql5-to-python-transliteration/test_phase3_centroid.py`
- `.../v2_29_data_pipeline_architecture/backfill_worker_api_gateway_v5.py`
- `.../v2_29_data_pipeline_architecture/centroid_regression.py`
- `.../v2_29_data_pipeline_architecture/export_collector_validator_v2.py`
- `.../v2_29_data_pipeline_architecture/fractal_lines.py`
- `.../v2_29_data_pipeline_architecture/gateway_contract_market_data.schema.json`
- `.../v2_29_data_pipeline_architecture/install_services.bat`
- `.../v2_29_data_pipeline_architecture/replay_quarantine.py`
- `.../v2_29_data_pipeline_architecture/sqlite_schema_v6_xauusd.sql`
- `.../v2_29_data_pipeline_architecture/sqlite_schema_v6_xauusd_preview.txt`
- `.../v2_29_data_pipeline_architecture/zigzag_metrics.py`
- `.../v2_29_data_pipeline_architecture/zscore_candle.py`
- `.../v2_29_multi-timeframe-visualisation/Multi-Timeframe-Visualisation-Architecture-Design.md`
- `.../v2_29_multi-timeframe-visualisation/mtf_render/__init__.py`
- `.../v2_29_multi-timeframe-visualisation/mtf_render/__main__.py`
- `.../v2_29_multi-timeframe-visualisation/mtf_render/data_source.py`
- `.../v2_29_multi-timeframe-visualisation/mtf_render/fixture.py`
- `.../v2_29_multi-timeframe-visualisation/mtf_render/renderer.py`
- `.../v2_29_multi-timeframe-visualisation/requirements.txt`
- `.../v2_29_multi-timeframe-visualisation/src/VISUALISATION_TASK_HANDOFF.md`
- `.../v2_29_multi-timeframe-visualisation/src/cover-prompt.md`
- `.../v2_29_multi-timeframe-visualisation/src/mtf_demo.png`
- `.../v2_29_multi-timeframe-visualisation/src/multi-timeframe-visualisation.jpg`
- `.../v2_29_multi-timeframe-visualisation/test_mtf_render.py`

</details>

<details>
<summary><code>backend-stack-c/</code> — 2 files</summary>

- `backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/architecture-document/old-architecture/README.md`
- `backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_data_pipeline_architecture/DATA_COLLECTION_PIPELINE_BLUEPRINT_v2_29.md`

</details>

<details>
<summary><code>frontend/</code> — 17 files</summary>

- `frontend/app/api/payments/dlocal/[paymentId]/route.ts`
- `frontend/app/api/payments/dlocal/check-three-day-eligibility/route.ts`
- `frontend/app/api/payments/dlocal/convert/route.ts`
- `frontend/app/api/payments/dlocal/create/route.ts`
- `frontend/app/api/payments/dlocal/exchange-rate/route.ts`
- `frontend/app/api/payments/dlocal/methods/route.ts`
- `frontend/app/api/payments/dlocal/validate-discount/route.ts`
- `frontend/components/payments/index.ts`
- `frontend/lib/dlocal/constants.ts`
- `frontend/lib/dlocal/currency-converter.service.ts`
- `frontend/lib/dlocal/dlocal-payment.service.ts`
- `frontend/lib/dlocal/payment-methods.service.ts`
- `frontend/lib/dlocal/three-day-validator.service.ts`
- `frontend/lib/jobs/queue.ts`
- `frontend/lib/validations/alert.ts`
- `frontend/types/alert.ts`
- `frontend/types/dlocal.ts`

</details>

<details>
<summary><code>mt5-service/</code> — 32 files</summary>

- `mt5-service/.env.example`
- `mt5-service/Dockerfile`
- `mt5-service/REDIS-PUBLISH-SNIPPET.md`
- `mt5-service/app/__init__.py`
- `mt5-service/app/redis_pub.py`
- `mt5-service/app/routes/__init__.py`
- `mt5-service/app/routes/admin.py`
- `mt5-service/app/routes/indicators.py`
- `mt5-service/app/services/__init__.py`
- `mt5-service/app/services/health_monitor.py`
- `mt5-service/app/services/indicator_reader.py`
- `mt5-service/app/services/mt5_connection_pool.py`
- `mt5-service/app/services/tier_service.py`
- `mt5-service/app/utils/__init__.py`
- `mt5-service/app/utils/constants.py`
- `mt5-service/app/utils/symbol_resolver.py`
- `mt5-service/app/websocket.py`
- `mt5-service/config/mt5_terminals.json`
- `mt5-service/config/mt5_terminals_test.json`
- `mt5-service/docs/symbol-resolution.md`
- `mt5-service/indicators/README.md`
- `mt5-service/requirements-dev.txt`
- `mt5-service/requirements.txt`
- `mt5-service/run.py`
- `mt5-service/tests/conftest.py`
- `mt5-service/tests/mock_mt5_server.py`
- `mt5-service/tests/mt5-mock-server-integration-tests-implementation.md`
- `mt5-service/tests/test_connection_pool.py`
- `mt5-service/tests/test_indicators.py`
- `mt5-service/tests/test_mt5_integration.py`
- `mt5-service/tests/test_redis_pub.py`
- `mt5-service/tests/test_symbol_resolver.py`

</details>

<details>
<summary><code>railway-gateway/</code> — 30 files</summary>

- `railway-gateway/.env.example`
- `railway-gateway/README.md`
- `railway-gateway/docker-compose.yml`
- `railway-gateway/jest.config.js`
- `railway-gateway/nest-cli.json`
- `railway-gateway/package-lock.json`
- `railway-gateway/package.json`
- `railway-gateway/prisma/schema.prisma`
- `railway-gateway/railway.toml`
- `railway-gateway/scripts/generate-market-data-dto.js`
- `railway-gateway/scripts/seed_local_xauusd_db.py`
- `railway-gateway/src/app.module.ts`
- `railway-gateway/src/auth/api-key.guard.ts`
- `railway-gateway/src/gateway/dto/market-data.dto.ts`
- `railway-gateway/src/gateway/gateway.module.ts`
- `railway-gateway/src/gateway/market-data.controller.ts`
- `railway-gateway/src/gateway/validation.service.ts`
- `railway-gateway/src/health/health.controller.ts`
- `railway-gateway/src/health/health.module.ts`
- `railway-gateway/src/main.ts`
- `railway-gateway/src/prisma/prisma.module.ts`
- `railway-gateway/src/prisma/prisma.service.ts`
- `railway-gateway/src/worker/market-data.processor.ts`
- `railway-gateway/src/worker/worker.module.ts`
- `railway-gateway/test/dto-contract.spec.ts`
- `railway-gateway/test/jest-e2e.json`
- `railway-gateway/test/local-e2e-harness.md`
- `railway-gateway/test/market-data.e2e-spec.ts`
- `railway-gateway/test/validation.service.spec.ts`
- `railway-gateway/tsconfig.json`

</details>

### SHARING

<details>
<summary><code>(root)/</code> — 4 files</summary>

- `.dockerignore`
- `components.json`
- `jest.config.js`
- `tsconfig.json`

</details>

<details>
<summary><code>.github/</code> — 11 files</summary>

- `.github/workflows/api-tests.yml`
- `.github/workflows/bundle-monitor.yml`
- `.github/workflows/ci-nextjs-progressive.yml`
- `.github/workflows/dependencies-security.yml`
- `.github/workflows/deploy.yml`
- `.github/workflows/e2e-tests.yml`
- `.github/workflows/load-test.yml`
- `.github/workflows/mt5-pipeline-tests.yml`
- `.github/workflows/openapi-validation.yml`
- `.github/workflows/security-checks.yml`
- `.github/workflows/tests.yml`

</details>

<details>
<summary><code>davintrade-draw-engine-and-line-alerts-stack/</code> — 4 files</summary>

- `davintrade-draw-engine-and-line-alerts-stack/Architecture Design Blueprint/DRAWING-ENGINE-AND-LINE-ALERTS-ARCHITECTURE.md`
- `davintrade-draw-engine-and-line-alerts-stack/Architecture Design Blueprint/Drawing-Engine-Line-Alerts-Architecture-Overview.pptx`
- `davintrade-draw-engine-and-line-alerts-stack/Architecture Design Blueprint/PHASE-4-SMOKE-TEST-RUNBOOK.md`
- `davintrade-draw-engine-and-line-alerts-stack/implementation-progress/implementation-progress-files-and-folder-directory.txt`

</details>

<details>
<summary><code>docs/</code> — 7 files</summary>

- `docs/PHASE-5-DELIVERY-AND-REALTIME-SPEC.md`
- `docs/SCALING-BULLMQ-AND-SOCKET-ADAPTER.md`
- `docs/open-api-documents/part-02-database-schema-openapi.yaml`
- `docs/open-api-documents/part-03-types-openapi.yaml`
- `docs/open-api-documents/part-04-tier-system-openapi.yaml`
- `docs/open-api-documents/part-07-indicators-tier-openapi.yaml`
- `docs/open-api-documents/part-15-notifications-realtime-openapi.yaml`

</details>

<details>
<summary><code>scripts/</code> — 19 files</summary>

- `scripts/alert-worker.ts`
- `scripts/archive-docs.sh`
- `scripts/check-coverage.js`
- `scripts/check-sync-needed.js`
- `scripts/collect-metrics.sh`
- `scripts/deploy-part20.sh`
- `scripts/health-check-ui.js`
- `scripts/health-check-ui.sh`
- `scripts/monitor-mt5-pipeline.ts`
- `scripts/rollback-to-part6.sh`
- `scripts/run-all-tests.sh`
- `scripts/setup-e2e.sh`
- `scripts/sync-frontend.sh`
- `scripts/test-mt5-deployment.ts`
- `scripts/test-prisma5-upgrade.ts`
- `scripts/validate-file.js`
- `scripts/validate_sqlite.py`
- `scripts/verify-alignment.sh`
- `scripts/verify-build-orders.sh`

</details>

<details>
<summary><code>types/</code> — 11 files</summary>

- `types/alert.ts`
- `types/api.ts`
- `types/disbursement.ts`
- `types/dlocal.ts`
- `types/index.ts`
- `types/indicator.ts`
- `types/next-auth.d.ts`
- `types/payment.ts`
- `types/prisma-stubs.d.ts`
- `types/tier.ts`
- `types/user.ts`

</details>

### TEST

<details>
<summary><code>__tests__/</code> — 1 file</summary>

- `__tests__/setup.ts`

</details>

<details>
<summary><code>__tests__/e2e/</code> — 1 file</summary>

- `__tests__/e2e/dlocal-payment-flow.test.ts`

</details>

<details>
<summary><code>__tests__/helpers/</code> — 1 file</summary>

- `__tests__/helpers/supertest-setup.ts`

</details>

<details>
<summary><code>__tests__/integration/</code> — 1 file</summary>

- `__tests__/integration/payment-creation.test.ts`

</details>

<details>
<summary><code>__tests__/types/</code> — 2 files</summary>

- `__tests__/types/disbursement.test.ts`
- `__tests__/types/dlocal.test.ts`

</details>

---

**Compiled:** 2026-07-08
**Status:** Initial version — regenerate via the categorization script if the codebase changes significantly
