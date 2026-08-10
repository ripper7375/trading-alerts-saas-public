# Migration Order — Session 6-1b — Mock-Data Hotfix

> For a session that **wires already-existing UI to already-existing endpoints** (not a
> cross-stack PORT — everything here is monolith-internal, no NestJS service involved). Adapted
> from `TEMPLATE-PORT.md` with the dial at **Low**: bind the real data, change nothing else. No
> redesign, no new components beyond what's already built-and-unused (`invoice-list.tsx`,
> `subscription-card.tsx`), no layout changes — those are 6-2 (IA), 6-5 (settings/user), 6-6 (admin)
> and 6-11 (admin system ops)'s job, on pages that are truthful by the time they run.

**Session:** 6-1b · **Phase:** Phase 6 (Frontend Redesign) · **Variant:** PORT (monolith-internal,
low dial) · **Status:** CONFIRMED · **Generated:** 2026-08-10 ·
**Flags touched:** none · **Estimated time:** ~2-3h
**Target service:** monolith-internal (Next.js route handlers + React Server/Client Components
already in `app/`) · **Contract:** none (no OpenAPI surface changes; every endpoint used here
already exists and is documented in `docs/files-completion-list/ui-page-gap-analysis.md` rows
A1-1, A1-2, A1-3, A1-4)

---

## Context

Session 6-1 (CONFIRMED, executed, closed 2026-08-10 — `DECISION-LOG.md` F11 stays OPEN pending
Davin's triage) independently re-verified that three pages render **fabricated data in
production** today, plus one settings page shows a fabricated count:

- `/settings/billing` (`app/(dashboard)/settings/billing/page.tsx`) — zero `fetch(` calls in 439
  lines; a hardcoded `mockInvoices` array backs the entire invoice table, usage stats, and the
  cancel dialog does nothing.
- `/admin/fraud-alerts/[id]` (`app/(dashboard)/admin/fraud-alerts/[id]/page.tsx`) — renders a
  hardcoded `MOCK_ALERT` object to an admin making a real fraud/block decision.
- `/admin` (`app/(dashboard)/admin/page.tsx`) — the "Recent Activity" panel is a generated mock
  list (the rest of the page's stats ARE real, via `/api/admin/analytics`).
- `/settings` (`app/(dashboard)/settings/page.tsx`) — the alerts-remaining count shown in the
  overview card is hardcoded `alerts: 3`.

This is a genuine, disclosed, non-hypothetical production correctness gap — every user viewing
`/settings/billing` today sees invoice/usage numbers that are not theirs, and every admin viewing
`/admin/fraud-alerts/[id]` is making a decision against data that isn't the real alert.

## User Review Required

> [!IMPORTANT]
> **No Rollback Flag / No Cutover Table Row:** Session 6-1b is deliberately flagless. Binding UI pages to the endpoints they were designed to consume is a correctness fix, not a cutover. There is no legacy implementation to fall back to, only fabricated mock data. Rollback is `git revert`.

> [!IMPORTANT]
> **Money Display Safety (`EXECUTOR-PROTOCOL.md` §7 & Plan §8):** `/settings/billing` displays monetary amounts. The Executor MUST NOT compute, convert, or format monetary amounts client-side — display only what the microservice/endpoint returns.

> [!NOTE]
> **Unproven Endpoint Response Shapes:** The backing endpoints (`GET /api/invoices`, `GET /api/subscription`, `POST /api/subscription/cancel`, `GET /api/admin/fraud-alerts/[id]`) have had zero UI consumers to date. The Executor MUST verify their runtime response shapes at CONFIRM before binding.

> [!NOTE]
> **Trial Fields Read vs Write Scope:** `TrialStatus` enum + 4 `User` trial fields (`trialStatus`, `trialConvertedAt`, `trialCancelledAt`, `hasUsedFreeTrial`) exist in the schema and endpoints. Reading and displaying trial state on `/settings/billing` is in scope for this session; any write path/flow for trial initiation or cancellation is out of scope.

## Entry criteria

- [x] Session 6-1 CONFIRMED, executed, closed (2026-08-10 — see `CLAUDE.md` Current entry).
- [x] The four target rows (A1-1, A1-2, A1-3, A1-4) hold in `docs/files-completion-list/ui-page-gap-analysis.md` as verified — re-confirmed at this session's own CONFIRM directly against live code, zero drift.
- [x] The four backing endpoints below still return the shapes cited (re-verified at CONFIRM per `LESSONS-LEARNED.md` L27) — all 4 held exactly, **plus two execution-time adaptation gaps found and resolved by Davin's live direction before starting** (see Deviations):
  - `GET /api/invoices` → `{ invoices: InvoiceItem[], hasMore: boolean }` (`app/api/invoices/route.ts`). ✅ exact.
  - `GET /api/subscription` → `{ tier: 'FREE'|'PRO', status, subscription: { id, status, provider, planType, currentPeriodEnd, expiresAt, cancelAtPeriodEnd, trialEnd, paymentMethod, dLocalPaymentMethod, dLocalCountry } | null }` (`app/api/subscription/route.ts`). ✅ exact as cited — but does NOT carry `User.trialStatus`/`trialConvertedAt`/`trialCancelledAt`/`hasUsedFreeTrial`, which File 1's own Port step 1 needs. Davin's live call: widen the response additively (Deviation 1).
  - `POST /api/subscription/cancel` → cancels Stripe/dLocal subscription and downgrades to FREE (`app/api/subscription/cancel/route.ts`). ✅ exact.
  - `GET /api/admin/fraud-alerts/[id]` → real `FraudAlert` row (404 if missing, 403 if non-admin); `PATCH` accepts `{ status: 'PENDING'|'REVIEWED'|'DISMISSED'|'BLOCKED', resolution?, notes? }` (`app/api/admin/fraud-alerts/[id]/route.ts`). ✅ exact — but the real `FraudAlert.notes` is `String?` (singular), not the mock's `string[]`, and `riskScore`/`paymentAttempts`/`previousAlerts`/`userAgent` don't exist on the schema at all. Davin's live call: adapt to real fields, drop mock-only fields (Deviation 2).
  - `GET /api/alerts` → countable list for FREE/PRO alert-count display on `/settings`. ✅ exact.
- [x] Monolith baseline re-measured at CONFIRM: `tsc --noEmit` clean; `eslint app components lib hooks --max-warnings 0` — 3 pre-existing warnings (0 errors), same 2 files Session 6-1 already recorded, 0 new; `test:ci` 129/129 suites, 2191/2191 tests — exact match to Session 6-1's baseline, zero drift. `git rev-parse HEAD` == `origin/main` (L38 check, no push gap).
- [x] Davin APPROVED — confirmed live in chat that the working copy's `APPROVED` status is his own authentic edit (`LESSONS-LEARNED.md` L11 check).

## Integration points

- **In:** real session (`getServerSession`), the 4 endpoints above (all monolith-native or flag-forwarded).
- **Out:** nothing new — no new routes, no new Prisma queries beyond what the 4 endpoints already run.
- **Owns:** no new tables, no new flags, no new queues.

## File Port Order

_(dependency order: read-only wiring first, the one destructive action — cancel — last)_

### File 1/4 — `/settings/billing`

- **SOURCE:** `app/(dashboard)/settings/billing/page.tsx` (439 lines, 100% mock) → **TARGET:** same file, rewired.
- **Kind:** port + adapt — replace `mockInvoices`/hardcoded usage stats with real `fetch` calls; mount the two already-built-but-unused components ([`components/billing/invoice-list.tsx`](file:///d:/SaaS%20Project/trading-alerts-saas-public/components/billing/invoice-list.tsx), [`components/billing/subscription-card.tsx`](file:///d:/SaaS%20Project/trading-alerts-saas-public/components/billing/subscription-card.tsx)) instead of hand-rolled markup where they cover the same UI.
- **Port steps:**
  1. `GET /api/subscription` on mount → drive tier badge, provider, `currentPeriodEnd`/`expiresAt`, payment method card, and trial-status banner from `User.trialStatus`/`trialConvertedAt`/`trialCancelledAt`/`hasUsedFreeTrial`.
  2. `GET /api/invoices` → real invoice table via `invoice-list.tsx`.
  3. Cancel dialog's confirm action → `POST /api/subscription/cancel`; on success, re-fetch `/api/subscription` and reflect the FREE downgrade without a page reload.
  4. Remove `mockInvoices` and mock comments entirely — no fallback-to-mock-on-error path. Real fetch failures show a real UI error state.
- **Invariants:** page must render correctly for a FREE user with no subscription/invoices (empty states); preserve dialog confirmation copy.
- **Parity proof:** component test(s) for the page covering real data render, empty state, cancel-success flow, cancel-failure flow (`__tests__/pages/settings/billing.test.tsx`).
- **Commit:** `fix(6-1b): wire /settings/billing to real invoices/subscription endpoints`

### File 2/4 — `/admin/fraud-alerts/[id]`

- **SOURCE:** `app/(dashboard)/admin/fraud-alerts/[id]/page.tsx` → **TARGET:** same file, rewired.
- **Kind:** port + adapt — replace `MOCK_ALERT`/`setAlert(MOCK_ALERT)` with real `fetch('/api/admin/fraud-alerts/' + id)`; wire status transitions (`PENDING`/`REVIEWED`/`DISMISSED`/`BLOCKED`) against the route's `updateSchema`.
- **Port steps:**
  1. Replace mock fetch with real fetch; handle 404 (alert not found) and 403 explicitly.
  2. Wire status-transition control to `PATCH` call matching route's `updateSchema` (`status`, `resolution`, `notes`).
  3. Link out to flagged user record only if an existing route exposes it cheaply — DO NOT build new endpoints or new detail pages (deferred to session 6-6).
- **Invariants:** admin actions are real/consequential — no optimistic UI update without confirmed server response; failed status update shows a real error.
- **Parity proof:** component test(s) covering real-data render, 404 case, and status-transition success/failure paths (`__tests__/pages/admin/fraud-alerts-detail.test.tsx`).
- **Commit:** `fix(6-1b): wire /admin/fraud-alerts/[id] to the real endpoint`

### File 3/4 — `/admin` Executive Dashboard (mock activity feed only)

- **SOURCE:** `app/(dashboard)/admin/page.tsx` (mock activity at line ~82) → **TARGET:** same file, activity section only.
- **Kind:** port + adapt — replace generated mock list with recent real `FraudAlert` rows queryable via `GET /api/admin/fraud-alerts`.
- **Port steps:**
  1. Read `GET /api/admin/fraud-alerts` list endpoint and confirm response shape.
  2. Replace `// Generate mock recent activity for now` generator with real recent fraud-alert items.
  3. Update panel heading to "Recent Fraud Alerts" (accurate label; do not build a broader aggregation feed — deferred to 6-11).
- **Invariants:** rest of `/admin` page (`/api/admin/analytics`-backed stats) stays untouched.
- **Parity proof:** extend page test coverage to assert panel renders real fetched fraud-alert data, not mock generator (`__tests__/pages/admin/dashboard.test.tsx`).
- **Commit:** `fix(6-1b): replace admin dashboard mock activity feed with real fraud-alert data`

### File 4/4 — `/settings` Overview (alert count only)

- **SOURCE:** `app/(dashboard)/settings/page.tsx` (`alerts: 3, // Mock data` at line 41) → **TARGET:** same file, one field.
- **Kind:** pure port — replace hardcoded count with real `GET /api/alerts` count.
- **Port steps:** fetch `/api/alerts` (or reuse count from existing fetch on page) and set real length; remove mock comment and literal.
- **Invariants:** rest of settings overview untouched.
- **Parity proof:** extend/add test asserting count reflects `/api/alerts` real response length (`__tests__/pages/settings/overview.test.tsx`).
- **Commit:** `fix(6-1b): show real alert count on /settings overview`

## Rules specific to this variant

- **No redesign, no new components beyond what's already built-and-unused (`invoice-list.tsx`, `subscription-card.tsx`), no layout/nav changes.** Missing links in settings grid and admin nav cross-links belong to 6-2 — do not touch.
- Every one of the 4 files must have real error states on fetch failure — no fallback-to-mock path anywhere.
- File 3 scope is strictly fraud-alert activity — do not wire `SystemConfigHistory` or outbox events (deferred to 6-11).
- If any endpoint response shape differs from Entry criteria, record it in Deviations before adapting.

## Slice-level verification (done when)

- [ ] All 4 files rewired to real endpoints; zero mock data/comments remain.
- [ ] New/extended component tests for all 4 files pass; `tsc --noEmit` clean; `eslint app components lib hooks --max-warnings 0` introduces 0 new warnings.
- [ ] `test:ci` full suite green, count recorded at CONFIRM.
- [ ] Live manual check of all 4 pages against real account data in production/staging.

## Cutover & rollback

Not applicable — no flag, no cutover row. Same-stack bugfix; rollback is `git revert`.

## Retire

Not applicable — no monolith logic retired; removed placeholders were never real production logic.

## Deviations

1. **`GET /api/subscription` response widened additively** — File 1's own Port step 1 requires driving the trial-status banner from `User.trialStatus`/`trialConvertedAt`/`trialCancelledAt`/`hasUsedFreeTrial`, but the CONFIRM-verified live response shape didn't carry any of the four. Neither field is exposed by any other existing GET endpoint either (repo-wide grep, zero hits). Davin's live call: add the 4 fields to `SubscriptionResponse.subscription` additively (new optional-shaped fields, no existing field renamed/removed) — not a new route, not a breaking change to any existing consumer, consistent with the order's own "Contract: none (no OpenAPI surface changes)" framing under the reading that a new route is what "surface change" means here, not an additive field. Recorded as an in-scope adaptation of File 1's own dependency, not scope creep.
2. **`/admin/fraud-alerts/[id]` adapted to the real `FraudAlert` schema, not the mock's invented shape** — the mock UI's `FraudAlertDetail` type has `notes: string[]`, `userAgent`, `paymentAttempts`, `previousAlerts`, `riskScore`, none of which exist on the real Prisma model or the route's response (real `notes` is a singular `String?`). Davin's live call: adapt the page to the real fields (`notes` rendered as a single note/reason line, `ipAddress` kept, `deviceFingerprint`/`additionalData` available if useful) and drop the four mock-only fields (Risk Score card, User Agent line, Payment Attempts/Previous Alerts counts) rather than fabricate them. This is a real behavior change from the mock's visual shape, disclosed here rather than silently trimmed.

## Known wrinkles / do-not-touch

- `lib/api/index.ts` stays untouched (`EXECUTOR-PROTOCOL.md` §5).
- `frontend/` mirror tree is out of scope (`EXECUTOR-PROTOCOL.md` §5).
- `DECISION-LOG.md` **F21** (GDPR account deletion) and **F50** (`COMMISSION_CREDITED` wrong recipient) are open but do not gate this session.

## Next-session handoff

Session **6-2** (IA + design system + shared shells) is next in Phase 6 — resolves F62 (admin tree consolidation), adds `app/not-found.tsx`, removes `/analytics`/`/indicators` dead nav links, and completes `/settings` grid links. Requires a full Advisor DRAFT (F62 structural impact).
