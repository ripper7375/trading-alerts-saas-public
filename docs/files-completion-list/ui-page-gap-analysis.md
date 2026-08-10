# UI Page Gap Analysis — Codebase vs. `ui-pages.xlsx` (54 pages)

**Generated:** 2026-08-10
**Method:** Full enumeration of `app/**/page.tsx` (57 files), `app/api/**/route.ts` (122 endpoints), `operation-service` + `money-service` NestJS controllers, 21 OpenAPI specs in `docs/open-api-documents/`, all 33 Prisma models, and every internal `href` in `app/` + `components/`.
**Scope convention:** **Section A = hard gaps** (a backend endpoint, service controller, Prisma model, or OpenAPI path exists but no UI surfaces it — or a page renders mock data instead of the real endpoint). **Section B = UX/completeness gaps** (no backing endpoint yet; needed for a coherent product).

---

## 0. Register reconciliation — the count is not actually 54

| Measure                                                              | Count  |
| -------------------------------------------------------------------- | ------ |
| Rows in `ui-pages.xlsx`                                              | 54     |
| `page.tsx` files in `app/`                                           | 57     |
| Distinct Next.js routes in code (excl. `/test-api` dev scratch page) | 56     |
| Distinct routes actually covered by the register                     | **53** |

Three reconciling facts:

1. **Rows 18 and 18-5 are the same route.** Both map to `app/(dashboard)/charts/[symbol]/[timeframe]/page.tsx`. They are two screenshots (M5, M15) of one dynamic page, not two pages.
2. **`/test-api` is correctly excluded** — it is a dev scratch page (`app/test-api/page.tsx`) that calls four endpoints which do not exist (`/api/leaderboard/H4`, `/api/market-data/XAUUSD`, `/api/surveillance`, plus `/api/candles/XAUUSD`). It should be deleted before launch, not registered.
3. **Three pages exist in code but are missing from the register entirely** — all Admin detail pages:

| Route                                   | Suggested name                  | Access |
| --------------------------------------- | ------------------------------- | ------ |
| `/admin/affiliates/[id]`                | Admin Affiliate Detail          | ADMIN  |
| `/admin/fraud-alerts/[id]`              | Admin Fraud Alert Detail        | ADMIN  |
| `/admin/disbursement/batches/[batchId]` | Admin Disbursement Batch Detail | ADMIN  |

**Action:** add these three rows to the register before doing anything else — your real baseline is **56 pages**, not 54.

---

## 1. Complete operating workflows per user type

These are derived from the code (tier config, guards, middleware, Prisma models, endpoint surface), not assumed. The V8 architecture constrains the product heavily: **one symbol (XAUUSD), two timeframes (M5, M15), watchlists removed entirely, both tiers get identical market data.** Tier differentiation is _only_: alerts (FREE 0 / PRO 100), multi-timeframe overlay (PRO), and drawing-engine line alerts (PRO).

### 1.1 FREE tier user

```
DISCOVER    Landing → Pricing → About/Docs/Blog ................. [B-gap: none exist]
ACQUIRE     Register → Verify-email-pending → Verify-email → Login → (2FA)
ONBOARD     Welcome/first-run tour ............................... [B-gap: none]
CORE        Dashboard → Charts overview → Chart workspace (XAUUSD M5/M15)
              · real-time OHLCV: works
              · MTF overlay: correctly locked, routes to /pricing
              · drawing line alerts: correctly locked
            Alerts → PRO upgrade landing (maxAlerts = 0) ......... correct
NOTIFY      Notification bell → "View all" ....................... [A-gap: /notifications 404]
ACCOUNT     Settings: profile, account, security, privacy,
            appearance, language, terms, help ................... exists
CONVERT     Pricing → Checkout → Stripe or dLocal → return ....... [A-gap: no return page]
EXIT        Account deletion request → email → confirm/cancel .... [A-gap: confirm/cancel pages missing]
```

### 1.2 PRO tier user

Everything above, plus:

```
ALERTS      Alerts list → Create alert → Edit alert ............... [A-gap: no edit route]
            Pause/resume/delete ................................... exists (inline)
            Line alerts drawn on chart ............................ exists (in-chart panel)
CHARTS      MTF overlay unlocked, drawing tools unlocked ......... exists
BILLING     Subscription status, invoices, cancel, reactivate,
            payment method, trial state .......................... [A-gap: page is 100% mock]
            Payment history (Stripe + dLocal) .................... [A-gap: no UI]
SECURITY    2FA, sessions, login history, security alerts ........ [A-gap: SecurityAlert has no UI]
```

### 1.3 Affiliate

An Affiliate is a `User` with an `AffiliateProfile`. Note their portal (`app/affiliate/*`) is a **separate tree with its own layout** and is **not covered by `middleware.ts`**.

```
DISCOVER    /affiliate landing → /affiliate/join ................. [B-gap: both dead links]
JOIN        /affiliate/register → /affiliate/verify .............. exists
EARN        Dashboard (stats) → Referral codes → Code inventory .. [A-gap: code-inventory has no page]
            Commissions report ................................... exists
GET PAID    Payment setup (legacy Rise) .......................... exists but obsolete
            Payout options (Wise recipient) ...................... exists
            Payout / transfer status — "was I actually paid?" .... [A-gap: WiseTransfer, DisbursementTransaction
                                                                    and PaymentBatch have zero affiliate-facing UI]
            Monthly statement archive ............................ [B-gap: cron/send-monthly-reports exists, no UI]
NOTIFY      Commission-credited notifications .................... [A-gap: no notifications page; also F50 open]
```

### 1.4 Admin

```
ACCESS      /admin/login (separate portal, own auth path)
OVERSEE     Executive dashboard (analytics) ...................... exists (activity feed is mock)
            User management → user detail ........................ [A-gap: no detail page]
            API usage / rate limits .............................. exists
            System error logs .................................... exists
            Fraud alerts → alert detail .......................... [A-gap: detail page is 100% mock]
AFFILIATE   Affiliates directory → affiliate detail .............. exists
  PROGRAM   Reports: code-inventory, commission-owings,
            profit-loss, sales-performance ....................... exists (4 of 5)
            Report: code-flows ................................... [A-gap: endpoint exists, no page]
            Cancel an individual code ............................ [A-gap: endpoint exists, no UI]
            Affiliate program settings ........................... exists
DISBURSE    Overview → Affiliates → Batches → Batch detail →
            Transactions → Audit trail → Recipients → Config ..... exists
            Per-affiliate disbursement report .................... [A-gap: endpoint exists, no page]
            Provider config still offers MOCK/RISE only .......... [A-gap: WISE is the live provider]
            RiseWorks accounts page .............................. [A-gap: RiseWorks is archived (F42)]
OPERATE     MT5 terminal health / restart ........................ [B-gap: 5 OpenAPI endpoints, zero UI]
            Cron / job run monitor ............................... [B-gap]
            Outbox event monitor ................................. [B-gap: OutboxEvent model, zero UI]
            System config change history ......................... [B-gap: SystemConfigHistory model, zero UI]
```

---

## 2. SECTION A — Hard gaps (code-backed)

### A1. EXISTING pages that must be MODIFIED

Ordered by severity. Every claim below is a verified code reference.

---

#### A1-1 · `/settings/billing` — Page 22 — **PRO** — 🔴 CRITICAL

The entire page is fabricated. Zero `fetch` calls in 439 lines.

| What's wrong                    | Evidence                                                                                                                                                              | Fix                                                                         |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Invoice table is hardcoded      | `const mockInvoices` (line 60-61), `useState<InvoiceRecord[]>(mockInvoices)` (line 91)                                                                                | Wire `GET /api/invoices` — endpoint exists, **has no UI consumer anywhere** |
| Usage stats are hardcoded       | `// Mock usage data - in real app, fetch from API` (line 98-99)                                                                                                       | Wire `GET /api/subscription` — endpoint exists, **no UI consumer**          |
| Cancel dialog does nothing      | Confirmation copy at line ~212, no API call                                                                                                                           | Wire `POST /api/subscription/cancel` — endpoint exists, **no UI consumer**  |
| Two built components sit unused | `components/billing/invoice-list.tsx`, `components/billing/subscription-card.tsx` — imported by nothing                                                               | Mount both here                                                             |
| Trial state invisible           | Schema has `User.trialStatus`, `trialConvertedAt`, `trialCancelledAt`, `hasUsedFreeTrial` + `TrialStatus` enum. **Zero UI references.** PRO advertises a 7-day trial. | Add trial banner: days remaining, convert-now CTA, cancel-trial             |
| Payment provider not shown      | `Payment` model records Stripe vs dLocal                                                                                                                              | Show provider + last payment + next billing date                            |

**Components to add:** `TrialStatusBanner`, `PaymentMethodCard`, `SubscriptionCancelDialog` (wired).

---

#### A1-2 · `/admin/fraud-alerts/[id]` — _unregistered_ — **ADMIN** — 🔴 CRITICAL

Renders fabricated data to an admin making fraud decisions.

- `// MOCK DATA` (line 63), `const MOCK_ALERT: FraudAlertDetail = {...}` (line 66), `setAlert(MOCK_ALERT)` (line 112)
- `GET /api/admin/fraud-alerts/[id]` **exists and is never called**

**Fix:** wire the real endpoint; add status transition actions using the `FraudAlertStatus` enum; link back to the flagged user and their `LoginHistory`/`SecurityAlert` records.

---

#### A1-3 · `/admin` Executive Dashboard — Page 29 — **ADMIN** — 🟠 HIGH

1. `// Generate mock recent activity for now` (line 82) — the activity feed is fabricated.
2. **Navigation is incomplete.** `app/(dashboard)/admin/layout.tsx` nav exposes only 4 entries: `/admin`, `/admin/api-usage`, `/admin/errors`, `/admin/users`. There is **no link** to `/admin/affiliates`, `/admin/disbursement`, `/admin/fraud-alerts`, or `/admin/settings/affiliate`. The app has **23 admin pages** in total (15 under `app/(dashboard)/admin/`, 8 under `app/admin/`) — **19 of them are unreachable from the main admin nav** and can only be opened by typing the URL. `/admin/disbursement/*` does have its own 8-entry sub-nav, but nothing links _into_ it.

**Fix:** build a real activity feed (from `SystemConfigHistory`, `DisbursementAuditLog`, `LoginHistory`, `FraudAlert`); rebuild the admin nav to cover all sections (see also **C-1**).

---

#### A1-4 · `/settings` Overview — Page 19 — **FREE / PRO** — 🟠 HIGH

1. `alerts: 3, // Mock data - would come from API` (line 41).
2. The settings grid links to only **4 of 9** subpages: `appearance`, `billing`, `privacy`, `profile`. Missing: `account`, `security`, `help`, `language`, `terms`.

**Fix:** real alert count from `/api/alerts`; complete the settings grid.

---

#### A1-5 · `/admin/disbursement/config` — Page 39 — **ADMIN** — 🟠 HIGH

Provider selector offers **MOCK** and **RISE** only (lines 261-291). Per `DisbursementProvider` enum and the completed Session 4A-W7 cutover, **WISE is the live production provider** and RiseWorks is archived (F42).

**Fix:** add `WISE` option; add Wise-specific config (funding mode `MANUAL`, funding SLA hours, source currency, fee bearer = PLATFORM, profile ID); deprecate the RISE option visually.

---

#### A1-6 · `/admin/disbursement/accounts` — Page 35 — **ADMIN** — 🟠 HIGH

Entirely RiseWorks-driven (`/api/disbursement/riseworks/accounts`, `/api/disbursement/riseworks/sync`). RiseWorks is archived.

**Fix:** either retire this page, or repurpose it as a **Wise account/balance view** (source balance, funding status, pending funding SLA countdown) — nothing currently shows whether the Wise source account is funded, which is the single manual step every payout cycle depends on.

---

#### A1-7 · `/pricing` — Page 02 — **Public** — 🟠 HIGH (broken fetch)

`app/(marketing)/pricing/page.tsx:155` and `components/payments/CountrySelector.tsx:69` both call `GET /api/geo/detect`.

**`app/api/geo/` does not exist.** Both fetches 404 on every page load.

**Fix:** create the route (or remove the calls and fall back to manual country selection).

---

#### A1-8 · `/checkout` — Page 05 — **Public** — 🟠 HIGH

| Issue                                 | Evidence                                                                                                                                                                           |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No post-payment return handling       | dLocal path does `window.location.href = data.paymentUrl` (line 160) and never comes back to a status page. `GET /api/payments/dlocal/[paymentId]` exists with **no UI consumer**. |
| Stripe discount codes never validated | `POST /api/checkout/validate-code` exists with **no consumer**. `DiscountCodeInput` only calls dLocal's `validate-discount`, so a code entered on the Stripe path is unvalidated.  |
| Orphan endpoint                       | `GET /api/payments/dlocal/exchange-rate` has no consumer (`PriceDisplay` uses `/convert`). Decide: wire or delete.                                                                 |

**Fix:** wire `checkout/validate-code` into `DiscountCodeInput` for the Stripe branch; add the return page (**A2-8**).

---

#### A1-9 · `/settings/security` — Page 27 — **FREE / PRO** — 🟡 MEDIUM

- Login history is capped at `?limit=20` with no pagination or full view.
- **`SecurityAlert` model has zero UI anywhere in the app.** It is written by `app/api/user/password/route.ts`, `app/api/user/2fa/disable/route.ts`, `app/api/user/2fa/verify-setup/route.ts`, and `operation-service`'s `two-factor.service.ts` / `users.service.ts`. Users are emailed about these events but can never review them in-product.

**Fix:** add a "Security activity" section listing `SecurityAlert` records; add "View all" → **A2-12**.

---

#### A1-10 · `/settings/account` — Page 20 — **FREE / PRO** — 🟡 MEDIUM

`POST /api/user/account/deletion-request` is wired, but `deletion-confirm` and `deletion-cancel` have **no UI at all** — the 7-day token-based grace flow cannot be completed or aborted from the product.

**Fix:** add a pending-deletion banner (from `AccountDeletionRequest.expiresAt`) with a "Cancel deletion" action, plus the two public pages in **A2-2 / A2-3**.

---

#### A1-11 · `/alerts` (Page 15) + `/alerts/new` (Page 16) — **PRO** — 🟡 MEDIUM

- `alert-form.tsx` header says _"for creating and editing price alerts"_ but there is **no edit route**. `GET`/`PATCH /api/alerts/[id]` exist. Editing is impossible today.
- The three tier endpoints — `GET /api/tier/symbols`, `/api/tier/combinations`, `/api/tier/check/[symbol]` — have **zero UI consumers**. Pages hard-code from `lib/tier-config.ts` instead. These are now served by `operation-service`'s `TierController` (Slice 10, live).

**Fix:** add the edit page (**A2-4**); drive quota/symbol gating from `/api/tier/*` so tier changes don't need a redeploy.

---

#### A1-12 · `components/layout/sidebar.tsx` + `mobile-nav.tsx` — affects **every FREE/PRO page** — 🟠 HIGH

Both nav components link to **`/analytics`** and **`/indicators`**. Neither page exists — both 404. Neither is a V8 product concept (watchlists and multi-symbol were removed).

Also: no nav entry for `/notifications`.

**Fix:** remove the two dead entries; add Notifications.

---

#### A1-13 · `components/notifications/notification-bell.tsx` — 🟠 HIGH

Line 477: `href="/notifications"` — **the page does not exist.** Every user who clicks "View all" hits a 404. See **A2-1**.

---

#### A1-14 · `/admin/affiliates/reports/code-inventory` — Page 43 — **ADMIN** — 🟡 MEDIUM

`POST /api/admin/codes/[code]/cancel` exists with **no UI consumer anywhere**. Admins cannot cancel an individual affiliate code.

**Fix:** add a per-row cancel action + confirm modal on this page (and/or on `/admin/affiliates/[id]`).

---

#### A1-15 · `/affiliate/dashboard/commissions` — Page 50 — **AFFILIATE** — 🟡 MEDIUM

Shows earned commissions only. `WiseTransfer`, `WiseBatchGroup`, `DisbursementTransaction`, and `PaymentBatch` have **zero affiliate-facing UI** — an affiliate cannot see whether a commission was actually paid out, when, via what rail, or why a transfer failed.

**Fix:** add payout status to each commission row (linked `DisbursementTransaction`), plus the payouts page in **A2-11**.

---

#### A1-16 · `/affiliate/dashboard/profile/payment` — Page 52 — **AFFILIATE** — 🟡 MEDIUM

This is the legacy RiseWorks payment setup. `/affiliate/settings/payout` (Page 53) is the live Wise flow. **Two competing payment-setup pages in one portal.**

**Fix:** retire Page 52 (or convert it to a redirect to Page 53). Also note `app/affiliate/dashboard/layout.tsx` links to both.

---

#### A1-17 · `/admin/users` — Page 30 — **ADMIN** — 🟡 MEDIUM

List only. No detail route, no row links out. An admin cannot inspect an individual user's subscription, alerts, sessions, login history, or fraud flags. See **A2-10**.

---

#### A1-18 · `app/(marketing)/layout.tsx` + `components/auth/register-form.tsx` — **Public** — 🟠 HIGH

Marketing header/footer links to **10 non-existent pages**: `/about`, `/blog`, `/careers`, `/changelog`, `/disclaimer`, `/docs`, `/help`, `/privacy`, `/terms`, `/affiliate`.
`register-form.tsx` additionally links to `/terms` (line 534), `/privacy` (line 541), `/affiliate/join` (line 617) — all dead.

Note `/settings/terms` and `/settings/privacy` **do** exist but sit behind auth, so they cannot serve the public footer or the signup consent checkbox. See **Section B**.

---

### A2. NEW pages to CREATE (code-backed)

| #         | Route                                                  | User type                   | Backing evidence                                                                                                                                                                                                                                                                        | Priority |
| --------- | ------------------------------------------------------ | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| **A2-1**  | `/notifications`                                       | FREE, PRO, AFFILIATE, ADMIN | `GET /api/notifications`, `GET/DELETE /api/notifications/[id]`, `POST /api/notifications/[id]/read` + operation-service `NotificationsController` (Slice 9, live). `notification-list.tsx` is already built but only rendered inside the bell dropdown. The bell explicitly links here. | 🔴       |
| **A2-2**  | `/account/deletion-confirm` (public, token)            | FREE, PRO                   | `POST /api/user/account/deletion-confirm` — public token-only route, deliberately unguarded. Zero UI.                                                                                                                                                                                   | 🔴       |
| **A2-3**  | `/account/deletion-cancel` (public, token)             | FREE, PRO                   | `POST /api/user/account/deletion-cancel` — dual-mode anonymous-token-or-session. Zero UI.                                                                                                                                                                                               | 🔴       |
| **A2-4**  | `/alerts/[id]/edit`                                    | PRO                         | `GET`/`PATCH /api/alerts/[id]`; `alert-form.tsx` already supports edit mode                                                                                                                                                                                                             | 🟠       |
| **A2-5**  | `/admin/affiliates/reports/code-flows`                 | ADMIN                       | `GET /api/admin/affiliates/reports/code-flows` — the only one of the five report endpoints with no page. Also exposed by money-service `AdminAffiliateReportsController`.                                                                                                               | 🟠       |
| **A2-6**  | `/affiliate/dashboard/code-inventory`                  | AFFILIATE                   | `GET /api/affiliate/dashboard/code-inventory` — zero consumers. Admins get an inventory report; affiliates cannot see their own.                                                                                                                                                        | 🟠       |
| **A2-7**  | `/admin/disbursement/affiliates/[affiliateId]`         | ADMIN                       | `GET /api/disbursement/reports/affiliate/[affiliateId]`, `/api/disbursement/affiliates/[affiliateId]`, `/api/disbursement/affiliates/[affiliateId]/commissions` — three endpoints, no page                                                                                              | 🟠       |
| **A2-8**  | `/checkout/return` (or `/checkout/status/[paymentId]`) | FREE → PRO                  | `GET /api/payments/dlocal/[paymentId]` — no consumer. dLocal redirects the user away with no return destination; webhook confirmation is async so a polling status page is required.                                                                                                    | 🔴       |
| **A2-9**  | `/upgrade/success`                                     | FREE → PRO                  | Stripe `success_url` is `/dashboard?upgrade=success` and `cancel_url` is `/pricing?upgrade=cancelled` (`app/api/checkout/route.ts:147-148`, mirrored in money-service). **No page reads either query param.** Needs a real confirmation surface.                                        | 🟠       |
| **A2-10** | `/admin/users/[id]`                                    | ADMIN                       | `/api/admin/users`; `User` + `Subscription` + `Alert` + `UserSession` + `LoginHistory` + `SecurityAlert` + `FraudAlert` models                                                                                                                                                          | 🟠       |
| **A2-11** | `/affiliate/dashboard/payouts`                         | AFFILIATE                   | `WiseTransfer`, `WiseBatchGroup`, `DisbursementTransaction`, `PaymentBatch` models — zero affiliate-facing UI                                                                                                                                                                           | 🟠       |
| **A2-12** | `/settings/security/activity`                          | FREE, PRO                   | `SecurityAlert` model (written by 5 code paths, read by none) + full `GET /api/user/login-history`                                                                                                                                                                                      | 🟡       |

**Backend gap surfaced by the UI audit (not a page):** `GET /api/geo/detect` is called by two components but the route does not exist. Create it or remove the calls.

---

## 3. SECTION B — UX / completeness gaps (no backing endpoint yet)

### B1. Existing surfaces to extend

| Surface                                | Gap                                                                                                                                      |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `app/` root                            | **No `not-found.tsx`** — the app has no 404 page. Only `app/error.tsx` exists. With 14 dead internal links this is actively user-facing. |
| `app/` root                            | No `global-error.tsx` (root-layout error boundary)                                                                                       |
| `/settings/help` — Page 23             | Support form is a stub: `// In a real implementation, this would send to a support system` (line 148). No ticketing backend.             |
| `/settings/terms`, `/settings/privacy` | Auth-gated only. Public duplicates needed for the marketing footer and the signup consent checkbox.                                      |
| `/(marketing)/page.tsx` — Page 01      | No `#features` / `#affiliate` anchor targets confirmed for the header links                                                              |

### B2. New pages to create

**Public / marketing (FREE + all):**

| Route               | Notes                                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------------------------ |
| `/about`            | linked from marketing header                                                                           |
| `/docs`             | linked from footer                                                                                     |
| `/blog`             | linked from footer                                                                                     |
| `/changelog`        | linked from footer                                                                                     |
| `/careers`          | linked from footer                                                                                     |
| `/disclaimer`       | linked from footer — **financial-risk disclaimer; treat as compliance-required for a trading product** |
| `/terms` (public)   | linked from footer **and the registration consent checkbox**                                           |
| `/privacy` (public) | same                                                                                                   |
| `/help` (public)    | linked from footer                                                                                     |
| `/affiliate`        | public affiliate-program landing page                                                                  |
| `/affiliate/join`   | linked from `register-form.tsx:617` — or redirect to `/affiliate/register`                             |
| `/status`           | footer links to external `status.tradingalerts.com`                                                    |

**Onboarding (FREE/PRO):**

| Route      | Notes                                                                         |
| ---------- | ----------------------------------------------------------------------------- |
| `/welcome` | First-run tour after email verification. No onboarding exists anywhere today. |

**Admin operations:**

| Route                            | Notes                                                                                                                                                                                                                                                                                      |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/admin/system/terminals`        | `docs/open-api-documents/part-06-flask_mt5_openapi.yaml` defines 5 admin endpoints (`/api/admin/terminals/health`, `/stats`, `/{id}/logs`, `/{id}/restart`, `/restart-all`) with **zero UI**. Given the live `flask-api` outage noted in project state, this is operationally significant. |
| `/admin/system/jobs`             | 8 cron endpoints exist (`/api/cron/*`); no run history, no manual trigger, no failure visibility                                                                                                                                                                                           |
| `/admin/system/outbox`           | `OutboxEvent` model + `OutboxPublisherCron` live in production; no UI to see PENDING/PROCESSING/FAILED events                                                                                                                                                                              |
| `/admin/system/config-history`   | `SystemConfigHistory` model has zero UI — no audit view of who changed what config                                                                                                                                                                                                         |
| `/admin/notifications/broadcast` | No way to send a platform-wide notification despite the `Notification` model supporting it                                                                                                                                                                                                 |

**Affiliate:**

| Route                             | Notes                                                                                  |
| --------------------------------- | -------------------------------------------------------------------------------------- |
| `/affiliate/dashboard/statements` | `cron/send-monthly-reports` generates monthly statements; no in-product archive        |
| `/affiliate/resources`            | Marketing assets, banners, link builder — standard for affiliate programs, absent here |

---

## 4. SECTION C — Cross-cutting structural issues

**C-1 · The admin area is split across two incompatible trees.**

|             | `app/(dashboard)/admin/*`                                                                                                  | `app/admin/*`                                                                  |
| ----------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Pages       | 15                                                                                                                         | 8                                                                              |
| Layout      | `(dashboard)` layout + `getServerSession` guard, plus its own admin nav (4 entries) and a disbursement sub-nav (8 entries) | **No `layout.tsx` at all** — inherits the root layout, no nav, no shared guard |
| Entry point | `/dashboard`                                                                                                               | `/admin/login` (bespoke page)                                                  |

They share the `/admin` URL prefix but have **different navigation and no links between them**. An admin on `/admin/users` cannot navigate to `/admin/affiliates`, and an admin on `/admin/affiliates` has no chrome at all. Consolidating these is a prerequisite for the nav fix in A1-3.

**C-2 · `middleware.ts` protects only four route prefixes.**
Matcher covers `/dashboard`, `/alerts`, `/charts`, `/settings`. It **does not cover `/affiliate/*` or `/admin/*`** (the `/admin` exclusion is deliberate and documented — the bespoke `app/admin/login` page would otherwise be unreachable). Affiliate portal protection currently relies solely on per-layout checks.

**C-3 · 14 dead internal links** across the app:
`/about`, `/affiliate`, `/affiliate/join`, `/analytics`, `/blog`, `/careers`, `/changelog`, `/disclaimer`, `/docs`, `/help`, `/indicators`, `/notifications`, `/privacy`, `/terms`.
With no `not-found.tsx`, each one produces an unstyled Next.js default 404.

**C-4 · `lib/api/index.ts` is the only "consumer" of several endpoints.** Per project standing rules this file is **known-broken by design until Phase 7**, so treat any endpoint whose sole reference is `lib/api/index.ts` (`/api/invoices`, `/api/subscription`, `/api/candles/[symbol]`) as genuinely orphaned.

---

## 5. Summary by user type

| User type            | Pages to MODIFY                                     | New pages — Section A             | New pages — Section B |
| -------------------- | --------------------------------------------------- | --------------------------------- | --------------------- |
| **ADMIN**            | 7 (A1-2, A1-3, A1-5, A1-6, A1-14, A1-17, + nav C-1) | 3 (A2-5, A2-7, A2-10)             | 5                     |
| **AFFILIATE**        | 2 (A1-15, A1-16)                                    | 2 (A2-6, A2-11)                   | 4                     |
| **PRO**              | 6 (A1-1, A1-4, A1-9, A1-10, A1-11, A1-12)           | 5 (A2-1, A2-2, A2-3, A2-4, A2-12) | 2                     |
| **FREE**             | 5 (A1-4, A1-7, A1-8, A1-12, A1-18)                  | 5 (A2-1, A2-2, A2-3, A2-8, A2-9)  | 13                    |
| **Totals (deduped)** | **18**                                              | **12**                            | **20**                |

**Target page count:** 56 existing + 12 (Section A) + 20 (Section B) ≈ **88 pages**.

---

## 6. Recommended build order

**Phase 1 — Stop shipping fabricated data (do first).**
A1-1 billing, A1-2 fraud alert detail, A1-3 admin activity feed, A1-4 settings overview. These four pages currently show users and admins numbers that are not real.

**Phase 2 — Close broken user journeys.**
A2-8 checkout return + A2-9 upgrade success (money is currently taken with no confirmation surface); A2-2/A2-3 deletion confirm/cancel (GDPR flow is unfinishable — note this intersects open flag **F21**); A2-1 notifications page; A1-7 `/api/geo/detect`.

**Phase 3 — Fix navigation and 404s.**
`not-found.tsx`; A1-12 sidebar dead links; A1-13 bell link; C-1 admin tree consolidation; A1-18 marketing links + public `/terms`, `/privacy`, `/disclaimer`.

**Phase 4 — Surface orphaned capability.**
A2-4 alert edit, A2-5 code-flows, A2-6 affiliate code inventory, A2-7 per-affiliate disbursement, A2-10 user detail, A2-11 affiliate payouts, A1-14 code cancel, A1-11 tier endpoints.

**Phase 5 — Retire and align with the Wise migration.**
A1-5 config WISE option, A1-6 RiseWorks accounts page, A1-16 duplicate affiliate payment page, delete `/test-api`.

**Phase 6 — Section B content and admin ops.**
Marketing pages, onboarding, admin system-operations pages.

---

## 7. Caveats

- This audit covers the **monolith frontend only** (`app/`, `components/`, `hooks/`, `lib/`). The parallel `frontend/` tree is out of scope per `EXECUTOR-PROTOCOL.md` §5.
- Several backend endpoints are mid-migration to `operation-service` / `money-service` behind `MIGRATE_*` flags. Page-level fixes should target the monolith route handlers, which forward transparently when a flag is on.
- Two open decision-log flags intersect this report: **F21** (GDPR account-deletion product decision — affects A2-2/A2-3) and **F50** (`COMMISSION_CREDITED` resolves to the wrong recipient — affects affiliate notifications in A2-1).
- `/api/candles/[symbol]` appears orphaned because the chart uses a WebSocket (`hooks/use-ohlcv-socket.ts`) instead. That is by design, not a gap.
